import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma client over a node-postgres pool (docs/08 §6.2, review R-21).
 * A real pool (not an HTTP one-shot driver) is required for interactive transactions and
 * `SELECT … FOR UPDATE` row locks (inventory, coupons, checkout). Works for Neon too:
 * point DATABASE_URL at the pooled (-pooler) endpoint.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({
    connectionString,
    // Small per-instance pool: serverless instances are many; Neon's pooler fans in.
    max: 5,
    idleTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { __nuraPrisma?: PrismaClient };

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example).");
  return url;
}

/** Singleton; cached on globalThis in development to survive hot reloads. */
export const db: PrismaClient =
  globalForPrisma.__nuraPrisma ?? createPrismaClient(connectionString());

if (process.env.NODE_ENV !== "production") globalForPrisma.__nuraPrisma = db;

export type Db = PrismaClient;
/** Transaction client type, for services that accept `db` or a `tx`. */
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
