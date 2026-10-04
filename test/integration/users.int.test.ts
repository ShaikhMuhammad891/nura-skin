/** Clerk user sync, guest-order claim and webhook idempotency against the real DB (docs/10). */
import type { UserJSON, WebhookEvent } from "@clerk/nextjs/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { processClerkEvent } from "../../src/features/users/server/clerk-webhook";
import {
  anonymizeUser,
  claimOrdersByVerifiedEmail,
  upsertFromClerk,
  type ClerkIdentity,
} from "../../src/features/users/server/service";
import type { PrismaClient } from "../../src/generated/prisma/client";

import { createPendingOrderRow, uid } from "./factories";
import { createTestPrisma } from "./helpers";

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createTestPrisma();
});
afterAll(async () => {
  await prisma.$disconnect();
});

function identity(overrides: Partial<ClerkIdentity> = {}): ClerkIdentity {
  const id = uid();
  return {
    clerkId: `user_${id}`,
    email: `person-${id}@example.test`,
    emailVerified: true,
    firstName: "Maya",
    lastName: "Chen",
    metadataRole: undefined,
    ...overrides,
  };
}

/** Minimal webhook-shaped identity mapper (the real one lives in lib/server/clerk.ts). */
const fromJson = (u: UserJSON): ClerkIdentity => ({
  clerkId: u.id,
  email: u.email_addresses[0]?.email_address ?? null,
  emailVerified: true,
  firstName: u.first_name,
  lastName: u.last_name,
  metadataRole: (u.public_metadata as Record<string, unknown>)?.role,
});

const userEvent = (type: "user.created" | "user.updated", clerkId: string, email: string) =>
  ({
    type,
    data: {
      id: clerkId,
      first_name: "Ana",
      last_name: null,
      email_addresses: [{ email_address: email }],
      public_metadata: {},
    },
  }) as unknown as WebhookEvent;

describe("upsertFromClerk", () => {
  it("creates a CUSTOMER with a wishlist, then updates profile fields idempotently", async () => {
    const who = identity();
    const created = await upsertFromClerk(prisma, who);
    expect(created.role.key).toBe("CUSTOMER");
    expect(await prisma.wishlist.count({ where: { userId: created.id } })).toBe(1);

    const newEmail = `renamed-${uid()}@example.test`;
    const updated = await upsertFromClerk(prisma, { ...who, email: newEmail, firstName: "M" });
    expect(updated.id).toBe(created.id);
    expect(updated).toMatchObject({ email: newEmail, firstName: "M" });
    expect(await prisma.wishlist.count({ where: { userId: created.id } })).toBe(1);
  });

  it("seeds a staff role from Clerk metadata only at creation; the DB stays authoritative", async () => {
    const who = identity({ metadataRole: "SUPPORT" });
    const created = await upsertFromClerk(prisma, who);
    expect(created.role.key).toBe("SUPPORT");

    // A later metadata change (e.g. a mirror still in flight) must not change the DB role.
    const again = await upsertFromClerk(prisma, { ...who, metadataRole: "ADMIN" });
    expect(again.role.key).toBe("SUPPORT");
  });

  it("falls back to CUSTOMER for unknown metadata roles", async () => {
    const created = await upsertFromClerk(prisma, identity({ metadataRole: "SUPERUSER" }));
    expect(created.role.key).toBe("CUSTOMER");
  });

  it("survives the webhook/JIT race on the same clerkId (one row, no error)", async () => {
    const who = identity();
    const results = await Promise.all([
      upsertFromClerk(prisma, who),
      upsertFromClerk(prisma, who),
      upsertFromClerk(prisma, who),
    ]);
    expect(new Set(results.map((u) => u.id)).size).toBe(1);
    expect(await prisma.user.count({ where: { clerkId: who.clerkId } })).toBe(1);
  });

  it("rejects an email that belongs to another account", async () => {
    const first = await upsertFromClerk(prisma, identity());
    await expect(upsertFromClerk(prisma, identity({ email: first.email }))).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("requires an email", async () => {
    await expect(upsertFromClerk(prisma, identity({ email: null }))).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("anonymizeUser (FR-ACC-04)", () => {
  it("scrubs personal data, keeps orders, and never resurrects the user", async () => {
    const who = identity();
    const user = await upsertFromClerk(prisma, who);
    const order = await createPendingOrderRow(prisma);
    await prisma.order.update({ where: { id: order.id }, data: { userId: user.id } });

    expect(await anonymizeUser(prisma, who.clerkId)).toBe(true);
    expect(await anonymizeUser(prisma, who.clerkId)).toBe(false); // idempotent

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after).toMatchObject({ firstName: null, lastName: null, phone: null });
    expect(after.email).toMatch(/@users\.invalid$/);
    expect(after.deletedAt).not.toBeNull();
    expect(await prisma.order.count({ where: { userId: user.id } })).toBe(1);

    // A late user.updated must not restore the scrubbed data.
    const late = await upsertFromClerk(prisma, who);
    expect(late.email).toMatch(/@users\.invalid$/);
  });

  it("ignores users that never reached the store", async () => {
    expect(await anonymizeUser(prisma, `user_${uid()}`)).toBe(false);
  });
});

describe("claimOrdersByVerifiedEmail (docs/10 §4.3)", () => {
  it("links only unowned orders with a case-insensitively matching email", async () => {
    const user = await upsertFromClerk(prisma, identity());
    const other = await upsertFromClerk(prisma, identity());
    const email = `guest-${uid()}@example.test`;

    const mine = await createPendingOrderRow(prisma);
    await prisma.order.update({ where: { id: mine.id }, data: { email: email.toUpperCase() } });
    const someoneElses = await createPendingOrderRow(prisma);
    await prisma.order.update({
      where: { id: someoneElses.id },
      data: { email, userId: other.id },
    });

    expect(await claimOrdersByVerifiedEmail(prisma, user.id, email)).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: mine.id } })).userId).toBe(user.id);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: someoneElses.id } })).userId).toBe(
      other.id,
    );
    expect(await claimOrdersByVerifiedEmail(prisma, user.id, email)).toBe(0);
  });
});

describe("processClerkEvent (webhook idempotency, docs/10 §8)", () => {
  it("processes an event once; redeliveries of the same svix id are duplicates", async () => {
    const clerkId = `user_${uid()}`;
    const email = `hook-${uid()}@example.test`;
    const svixId = `msg_${uid()}`;
    const event = userEvent("user.created", clerkId, email);

    expect(await processClerkEvent(prisma, { id: svixId, event }, fromJson)).toBe("processed");
    expect(await processClerkEvent(prisma, { id: svixId, event }, fromJson)).toBe("duplicate");

    expect(await prisma.user.count({ where: { clerkId } })).toBe(1);
    const row = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: svixId } });
    expect(row).toMatchObject({ provider: "clerk", type: "user.created", status: "processed" });
  });

  it("anonymizes on user.deleted", async () => {
    const clerkId = `user_${uid()}`;
    await processClerkEvent(
      prisma,
      { id: `msg_${uid()}`, event: userEvent("user.created", clerkId, `d-${uid()}@example.test`) },
      fromJson,
    );
    const deleted = { type: "user.deleted", data: { id: clerkId, deleted: true } } as WebhookEvent;
    await processClerkEvent(prisma, { id: `msg_${uid()}`, event: deleted }, fromJson);
    expect((await prisma.user.findUniqueOrThrow({ where: { clerkId } })).deletedAt).not.toBeNull();
  });

  it("audits staff sign-ins but not customer sessions", async () => {
    const staff = await upsertFromClerk(prisma, identity({ metadataRole: "ADMIN" }));
    const customer = await upsertFromClerk(prisma, identity());
    const session = (userId: string) =>
      ({ type: "session.created", data: { id: `sess_${uid()}`, user_id: userId } }) as WebhookEvent;

    await processClerkEvent(
      prisma,
      { id: `msg_${uid()}`, event: session(staff.clerkId) },
      fromJson,
    );
    await processClerkEvent(
      prisma,
      { id: `msg_${uid()}`, event: session(customer.clerkId) },
      fromJson,
    );

    const audits = await prisma.auditLog.findMany({ where: { action: "staff.sign_in" } });
    expect(audits.some((a) => a.actorId === staff.id)).toBe(true);
    expect(audits.some((a) => a.actorId === customer.id)).toBe(false);
  });

  it("records unhandled event types as ignored", async () => {
    const svixId = `msg_${uid()}`;
    const event = { type: "email.created", data: {} } as unknown as WebhookEvent;
    expect(await processClerkEvent(prisma, { id: svixId, event }, fromJson)).toBe("ignored");
    expect(await processClerkEvent(prisma, { id: svixId, event }, fromJson)).toBe("duplicate");
  });

  it("marks failures and lets a redelivery succeed", async () => {
    const svixId = `msg_${uid()}`;
    const bad = userEvent("user.created", `user_${uid()}`, "");
    (bad.data as { email_addresses: unknown[] }).email_addresses = [];

    await expect(processClerkEvent(prisma, { id: svixId, event: bad }, fromJson)).rejects.toThrow();
    const failed = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: svixId } });
    expect(failed).toMatchObject({ status: "failed", attempts: 1 });

    const good = userEvent("user.created", `user_${uid()}`, `ok-${uid()}@example.test`);
    expect(await processClerkEvent(prisma, { id: svixId, event: good }, fromJson)).toBe(
      "processed",
    );
    const retried = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: svixId } });
    expect(retried).toMatchObject({ status: "processed", attempts: 2 });
  });
});
