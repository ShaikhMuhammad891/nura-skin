/**
 * `npm run user:role -- <email> <ROLE>`: grants a role to an existing user (docs/10 §3).
 * Bootstrap tool for the first admin, before the admin team UI exists (M8). Follows ADR-0015:
 * the DB change + audit commit first, then the Clerk metadata mirror is updated outside the tx.
 * The user must sign out and in again (or wait for the token refresh) for the proxy to see it.
 */
import { createClerkClient } from "@clerk/nextjs/server";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";

import { PrismaClient, type RoleKey } from "../src/generated/prisma/client";
import { ROLE_KEYS } from "../src/lib/permissions";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

async function main() {
  const [email, roleArg] = process.argv.slice(2);
  const role = roleArg?.toUpperCase() as RoleKey | undefined;
  if (!email || !role || !(ROLE_KEYS as readonly string[]).includes(role)) {
    console.error(`Usage: npm run user:role -- <email> <${ROLE_KEYS.join("|")}>`);
    process.exit(1);
  }
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("CLERK_SECRET_KEY is not set (.env.local).");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
  });
  try {
    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: { role: true },
    });
    if (!user) {
      throw new Error(`No user with email ${email}. Sign in to the store once first.`);
    }

    const target = await prisma.role.findUniqueOrThrow({ where: { key: role } });
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { roleId: target.id } });
      await tx.auditLog.create({
        data: {
          actorId: null,
          action: "user.role_changed",
          entityType: "User",
          entityId: user.id,
          before: { role: user.role.key },
          after: { role },
          metadata: { via: "scripts/set-role.ts" },
        },
      });
    });

    const clerk = createClerkClient({ secretKey });
    await clerk.users.updateUserMetadata(user.clerkId, { publicMetadata: { role } });
    console.log(`${email}: ${user.role.key} → ${role} (DB + Clerk metadata).`);
    console.log("Sign out and back in so your session token carries the new role.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
