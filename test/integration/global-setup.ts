/**
 * Integration test bootstrap: a throwaway real Postgres per run (no Docker), fully migrated
 * with the same migration SQL as production, then seeded. Torn down (and deleted) afterwards.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";

import { seed } from "../../prisma/seed/seed";
import { startLocalPg, type LocalPg } from "../../scripts/lib/embedded-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

let local: LocalPg | undefined;

export async function setup() {
  const port = Number(process.env.TEST_PG_PORT ?? 5434);
  local = await startLocalPg({
    dir: mkdtempSync(join(tmpdir(), "nura-test-pg-")),
    port,
    persistent: false,
    databases: ["nura_test"],
    quiet: true,
  });

  const url = local.url("nura_test");
  // Test workers are spawned after global setup, so they inherit these.
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
  process.env.TEST_DATABASE_URL = url;

  execFileSync(
    process.execPath,
    [join("node_modules", "prisma", "build", "index.js"), "migrate", "deploy"],
    {
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
      stdio: "pipe",
    },
  );

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    await seed(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

export async function teardown() {
  await local?.pg.stop();
}
