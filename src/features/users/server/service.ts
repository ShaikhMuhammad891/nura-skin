import "server-only";

import { Prisma, type RoleKey } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { parseClaimRole } from "@/lib/auth-gate";
import { inTransaction, type DbClient } from "@/lib/server/db-types";

/**
 * Clerk → domain User sync (docs/10 §3, §4.1). Called from the Clerk webhook and from the JIT path
 * (`getCurrentUser`, `/auth/complete`), whichever lands first; both are idempotent on `clerkId`.
 * The DB role is the source of truth: Clerk metadata only seeds the role of a brand-new user
 * (staff are invited with `publicMetadata.role`, which only our backend can write).
 */
export type ClerkIdentity = {
  clerkId: string;
  email: string | null;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  /** `publicMetadata.role` at creation time. */
  metadataRole: unknown;
};

export const userWithRole = { role: { select: { key: true } } } as const;
export type UserWithRole = Prisma.UserGetPayload<{ include: typeof userWithRole }>;

export async function upsertFromClerk(
  db: DbClient,
  identity: ClerkIdentity,
): Promise<UserWithRole> {
  if (!identity.email) {
    throw new AppError("BAD_REQUEST", "A verified email address is required.");
  }
  const email = identity.email;
  const names = { firstName: identity.firstName, lastName: identity.lastName };

  const attempt = () =>
    inTransaction(db, async (tx) => {
      const existing = await tx.user.findUnique({
        where: { clerkId: identity.clerkId },
        include: userWithRole,
      });
      if (existing) {
        if (existing.deletedAt) return existing; // anonymized users are never resurrected
        return tx.user.update({
          where: { id: existing.id },
          data: { email, ...names },
          include: userWithRole,
        });
      }

      const roleKey: RoleKey = parseClaimRole(identity.metadataRole) ?? "CUSTOMER";
      const role = await tx.role.findUniqueOrThrow({ where: { key: roleKey } });
      return tx.user.create({
        data: {
          clerkId: identity.clerkId,
          email,
          ...names,
          roleId: role.id,
          wishlist: { create: {} },
        },
        include: userWithRole,
      });
    });

  try {
    return await attempt();
  } catch (error) {
    // Webhook and JIT upsert raced on the clerkId unique key: the other writer won, so re-read.
    if (isUniqueViolation(error, "clerk_id")) return attempt();
    if (isUniqueViolation(error, "email")) {
      throw new AppError("CONFLICT", "This email already belongs to another account.", {
        cause: error,
      });
    }
    throw error;
  }
}

/**
 * `user.deleted` → anonymize (FR-ACC-04). Orders stay for accounting, but personal data goes.
 * Idempotent; unknown users are ignored (the user may never have signed in to the store).
 */
export async function anonymizeUser(db: DbClient, clerkId: string): Promise<boolean> {
  return inTransaction(db, async (tx) => {
    const user = await tx.user.findUnique({ where: { clerkId } });
    if (!user || user.deletedAt) return false;
    await tx.user.update({
      where: { id: user.id },
      data: {
        email: `deleted+${user.id}@users.invalid`,
        firstName: null,
        lastName: null,
        phone: null,
        marketingConsent: false,
        deletedAt: new Date(),
      },
    });
    await tx.address.deleteMany({ where: { userId: user.id } });
    return true;
  });
}

/**
 * Links guest orders placed with this email to the account (docs/10 §4.3). Callers must pass a
 * **verified** email only, otherwise anyone could claim someone else's order history.
 */
export async function claimOrdersByVerifiedEmail(
  db: DbClient,
  userId: string,
  verifiedEmail: string,
): Promise<number> {
  const { count } = await db.order.updateMany({
    where: { userId: null, email: verifiedEmail },
    data: { userId },
  });
  return count;
}

export async function findUserByClerkId(db: DbClient, clerkId: string) {
  return db.user.findFirst({ where: { clerkId, deletedAt: null }, include: userWithRole });
}

function isUniqueViolation(error: unknown, column: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  return JSON.stringify(error.meta ?? {}).includes(column);
}
