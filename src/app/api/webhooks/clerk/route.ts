import { processClerkEvent, verifyClerkWebhook } from "@/features/users/server/clerk-webhook";
import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import { identityFromUserJson } from "@/lib/server/clerk";
import { db } from "@/lib/server/db";
import { logger } from "@/lib/server/logger";

/**
 * Clerk → app user sync (docs/10 §2, §8). Public in the proxy; authenticity comes from the svix
 * signature. Non-2xx makes Clerk retry, so only processing failures return 500.
 */
export async function POST(request: Request) {
  const log = logger.child({ route: "webhooks.clerk" });
  const secret = env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    log.error("CLERK_WEBHOOK_SIGNING_SECRET is not set");
    return new Response("Webhook not configured", { status: 503 });
  }

  let verified;
  try {
    verified = verifyClerkWebhook(await request.text(), request.headers, secret);
  } catch (error) {
    log.warn({ reason: error instanceof AppError ? error.message : "unknown" }, "rejected");
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    const result = await processClerkEvent(db, verified, identityFromUserJson);
    log.info({ svixId: verified.id, type: verified.event.type, result }, "clerk webhook");
    return Response.json({ received: true, result });
  } catch (error) {
    log.error({ err: error, svixId: verified.id, type: verified.event.type }, "processing failed");
    return new Response("Processing failed", { status: 500 });
  }
}
