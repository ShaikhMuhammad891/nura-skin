import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";

import { PrismaClient } from "../../src/generated/prisma/client";

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL missing: run via `pnpm test:int`");
  return url;
}

export function createTestPrisma(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: testDatabaseUrl(), max: 4 }),
  });
}

export async function connectPg(): Promise<Client> {
  const client = new Client({ connectionString: testDatabaseUrl() });
  await client.connect();
  return client;
}

/**
 * Runs `fn` inside a transaction that is always rolled back, so constraint tests never
 * leave data behind. Returns the error thrown by the database (if any).
 */
export async function inRollback(
  client: Client,
  fn: (client: Client) => Promise<unknown>,
): Promise<unknown> {
  await client.query("BEGIN");
  try {
    await fn(client);
    return undefined;
  } catch (error) {
    return error;
  } finally {
    await client.query("ROLLBACK");
  }
}

export function pgErrorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : undefined;
}

export function pgConstraint(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "constraint" in error
    ? String((error as { constraint: unknown }).constraint)
    : undefined;
}
