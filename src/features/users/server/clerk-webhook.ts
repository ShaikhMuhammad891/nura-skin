import "server-only";

import type { SessionJSON, UserJSON, WebhookEvent } from "@clerk/nextjs/server";
import { Webhook } from "svix";

import type { Prisma } from "@/generated/prisma/client";
import { writeAudit } from "@/features/audit/server/log";
import { AppError } from "@/lib/errors";
import { isStaffRole } from "@/lib/permissions";
import type { DbClient } from "@/lib/server/db-types";

import { anonymizeUser, findUserByClerkId, upsertFromClerk, type ClerkIdentity } from "./service";

/**
 * Clerk webhook processing (docs/10 §2, §8). Signature-verified with svix; replay-safe through
 * `WebhookEvent.id = svix-id`. Handlers are idempotent because Clerk delivers at least once.
 */
export type VerifiedClerkEvent = { id: string; event: WebhookEvent };

export function verifyClerkWebhook(
  rawBody: string,
  headers: Headers,
  secret: string,
): VerifiedClerkEvent {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signature = headers.get("svix-signature");
  if (!id || !timestamp || !signature) throw new AppError("BAD_REQUEST", "Missing svix headers.");
  try {
    // svix 2.x verifies only (throws on a bad signature/timestamp); the body is parsed after.
    new Webhook(secret).verify(rawBody, {
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": signature,
    });
  } catch (error) {
    throw new AppError("BAD_REQUEST", "Invalid webhook signature.", { cause: error });
  }
  return { id, event: JSON.parse(rawBody) as WebhookEvent };
}

export type ProcessResult = "processed" | "duplicate" | "ignored";

export async function processClerkEvent(
  db: DbClient,
  { id, event }: VerifiedClerkEvent,
  toIdentity: (user: UserJSON) => ClerkIdentity,
): Promise<ProcessResult> {
  const existing = await db.webhookEvent.findUnique({ where: { id } });
  if (existing?.status === "processed" || existing?.status === "ignored") return "duplicate";
  if (!existing) {
    await db.webhookEvent.create({
      data: {
        id,
        provider: "clerk",
        type: event.type,
        payload: event.data as unknown as Prisma.InputJsonValue,
      },
    });
  }

  try {
    const handled = await dispatch(db, event, toIdentity);
    const status = handled ? "processed" : "ignored";
    await db.webhookEvent.update({
      where: { id },
      data: { status, attempts: { increment: 1 }, processedAt: new Date(), error: null },
    });
    return status;
  } catch (error) {
    await db.webhookEvent.update({
      where: { id },
      data: {
        status: "failed",
        attempts: { increment: 1 },
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

async function dispatch(
  db: DbClient,
  event: WebhookEvent,
  toIdentity: (user: UserJSON) => ClerkIdentity,
): Promise<boolean> {
  switch (event.type) {
    case "user.created":
    case "user.updated":
      await upsertFromClerk(db, toIdentity(event.data));
      return true;
    case "user.deleted":
      if (event.data.id) await anonymizeUser(db, event.data.id);
      return true;
    case "session.created":
      await auditStaffSignIn(db, event.data);
      return true;
    default:
      return false;
  }
}

/** Staff sign-ins are audited (FR-ADM-08); customer sessions are not. */
async function auditStaffSignIn(db: DbClient, session: SessionJSON): Promise<void> {
  const user = await findUserByClerkId(db, session.user_id);
  if (!user || !isStaffRole(user.role.key)) return;
  await writeAudit(db, {
    actorId: user.id,
    actorRole: user.role.key,
    action: "staff.sign_in",
    entityType: "User",
    entityId: user.id,
    metadata: { sessionId: session.id },
  });
}
