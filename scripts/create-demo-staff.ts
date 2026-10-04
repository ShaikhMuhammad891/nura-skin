/**
 * `npm run demo:staff -- [count]`: provisions pooled DEMO_STAFF users for the portfolio demo
 * (docs/10 §9b, ADR-0016). Creates (or reuses) Clerk users with `+clerk_test` emails, mirrors the
 * role into Clerk public metadata, and upserts the DB rows with `isDemo = true`.
 * Prints the value for `DEMO_STAFF_CLERK_USER_IDS`. Run against the demo deployment's instances only.
 */
import { createClerkClient } from "@clerk/nextjs/server";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";

import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

async function main() {
  const count = Number(process.argv[2] ?? "3");
  if (!Number.isInteger(count) || count < 1 || count > 10) {
    console.error("Usage: npm run demo:staff -- [count 1-10]");
    process.exit(1);
  }
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("CLERK_SECRET_KEY is not set (.env.local).");

  const clerk = createClerkClient({ secretKey });
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
  });

  try {
    const role = await prisma.role.findUniqueOrThrow({ where: { key: "DEMO_STAFF" } });
    const ids: string[] = [];

    for (let n = 1; n <= count; n++) {
      // `+clerk_test` addresses never receive mail and verify with code 424242 in dev instances.
      const email = `demo-staff-${n}+clerk_test@nuraskin.dev`;
      const existing = await clerk.users.getUserList({ emailAddress: [email] });
      const clerkUser =
        existing.data[0] ??
        (await clerk.users.createUser({
          emailAddress: [email],
          firstName: "Demo",
          lastName: `Staff ${n}`,
          skipPasswordRequirement: true,
          publicMetadata: { role: "DEMO_STAFF" },
        }));
      await clerk.users.updateUserMetadata(clerkUser.id, {
        publicMetadata: { role: "DEMO_STAFF" },
      });

      await prisma.user.upsert({
        where: { clerkId: clerkUser.id },
        update: { roleId: role.id, isDemo: true },
        create: {
          clerkId: clerkUser.id,
          email,
          firstName: "Demo",
          lastName: `Staff ${n}`,
          roleId: role.id,
          isDemo: true,
          wishlist: { create: {} },
        },
      });
      ids.push(clerkUser.id);
      console.log(`${email} → ${clerkUser.id}`);
    }

    console.log(
      `\nAdd to the demo deployment's env:\nDEMO_MODE_ENABLED=true\nDEMO_STAFF_CLERK_USER_IDS=${ids.join(",")}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
