import "server-only";

import type { UserJSON } from "@clerk/nextjs/server";
import { auth, clerkClient, currentUser, type User as ClerkUser } from "@clerk/nextjs/server";
import { cache } from "react";

import {
  findUserByClerkId,
  upsertFromClerk,
  type ClerkIdentity,
  type UserWithRole,
} from "@/features/users/server/service";

import { db } from "./db";

/**
 * The single Clerk adapter (docs/10 §7.1, review R-34): version-specific Clerk APIs live here so an
 * SDK change touches one file. Everything else works with our own User and Actor types.
 */

/** Maps the Backend API user (JIT path) to our identity shape. */
export function identityFromClerkUser(user: ClerkUser): ClerkIdentity {
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
  return {
    clerkId: user.id,
    email: primary?.emailAddress ?? null,
    emailVerified: primary?.verification?.status === "verified",
    firstName: user.firstName,
    lastName: user.lastName,
    metadataRole: user.publicMetadata?.role,
  };
}

/** Maps the webhook payload (`user.created` / `user.updated`) to our identity shape. */
export function identityFromUserJson(user: UserJSON): ClerkIdentity {
  const primary = user.email_addresses.find((e) => e.id === user.primary_email_address_id);
  return {
    clerkId: user.id,
    email: primary?.email_address ?? null,
    emailVerified: primary?.verification?.status === "verified",
    firstName: user.first_name,
    lastName: user.last_name,
    metadataRole: (user.public_metadata as Record<string, unknown> | null)?.role,
  };
}

/** The signed-in Clerk user id for this request, or null. */
export async function getClerkUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/**
 * Step-up check for sensitive actions (docs/10 §6): Clerk's `strict` preset means the user
 * re-verified (second factor) within the last 10 minutes.
 */
export async function hasRecentReverification(): Promise<boolean> {
  const { has } = await auth();
  return has({ reverification: "strict" });
}

/** One-time sign-in ticket for a pooled demo staff user (docs/10 §9b): 5-minute TTL. */
export async function createDemoSignInTicket(clerkUserId: string): Promise<string> {
  const clerk = await clerkClient();
  const { token } = await clerk.signInTokens.createSignInToken({
    userId: clerkUserId,
    expiresInSeconds: 300,
  });
  return token;
}

/**
 * The current domain User (`cache()`-memoized per request). Read-only with respect to cookies, so
 * it is safe in Server Components; if the webhook hasn't landed yet it JIT-upserts the row.
 */
export const getCurrentUser = cache(async (): Promise<UserWithRole | null> => {
  const clerkId = await getClerkUserId();
  if (!clerkId) return null;

  const existing = await findUserByClerkId(db, clerkId);
  if (existing) return existing;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;
  const user = await upsertFromClerk(db, identityFromClerkUser(clerkUser));
  return user.deletedAt ? null : user;
});

/** Identity for `/auth/complete`: includes whether the primary email is verified. */
export async function getCurrentClerkIdentity(): Promise<ClerkIdentity | null> {
  const clerkUser = await currentUser();
  return clerkUser ? identityFromClerkUser(clerkUser) : null;
}
