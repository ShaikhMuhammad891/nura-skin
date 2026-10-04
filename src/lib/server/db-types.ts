import type { Prisma, PrismaClient } from "@/generated/prisma/client";

/** A root client or an interactive-transaction client. Services accept either. */
export type Tx = Prisma.TransactionClient;
export type DbClient = PrismaClient | Tx;

/** Runs `fn` in a transaction unless already inside one (services compose without nesting). */
export async function inTransaction<T>(db: DbClient, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if ("$transaction" in db && typeof db.$transaction === "function") {
    return (db as PrismaClient).$transaction(fn, {
      isolationLevel: "ReadCommitted",
      timeout: 15_000,
    });
  }
  return fn(db as Tx);
}
