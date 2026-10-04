"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import { createDemoSignInTicket } from "@/lib/server/clerk";
import { logger } from "@/lib/server/logger";
import { rateLimit } from "@/lib/server/rate-limit";

/** 10 demo sign-ins per hour per IP (docs/10 §9b). */
const DEMO_LIMIT = 10;
const DEMO_WINDOW_MS = 60 * 60 * 1000;

/**
 * "Try the admin" (docs/10 §9b, ADR-0016): signs the visitor in as a pooled DEMO_STAFF user via a
 * Clerk sign-in ticket. Only exists on the demo deployment (`DEMO_MODE_ENABLED=true`).
 */
export async function startDemoSessionForm(): Promise<void> {
  const pool = env.DEMO_STAFF_CLERK_USER_IDS;
  if (!env.DEMO_MODE_ENABLED || pool.length === 0) throw new AppError("NOT_FOUND");

  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`demo-signin:${ip}`, DEMO_LIMIT, DEMO_WINDOW_MS).ok) {
    throw new AppError(
      "RATE_LIMITED",
      "Too many demo sessions from this network. Try again later.",
    );
  }

  const clerkUserId = pool[Math.floor(Math.random() * pool.length)]!;
  const ticket = await createDemoSignInTicket(clerkUserId);
  logger.info({ clerkUserId }, "demo sign-in ticket issued");

  // <SignIn> consumes `__clerk_ticket` itself; `redirect_url` lands the session on the admin.
  const params = new URLSearchParams({ __clerk_ticket: ticket, redirect_url: "/admin" });
  redirect(`/sign-in?${params}`);
}
