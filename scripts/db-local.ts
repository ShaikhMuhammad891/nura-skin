/**
 * `pnpm db:local`: runs a persistent local Postgres on :5433 for development.
 * Data lives in `.local/postgres` (git-ignored). Stop with Ctrl+C.
 * Point DATABASE_URL / DIRECT_URL at postgresql://nura:nura@localhost:5433/nura_dev.
 */
import { join } from "node:path";

import { startLocalPg } from "./lib/embedded-pg";

async function main() {
  const port = Number(process.env.LOCAL_PG_PORT ?? 5433);
  const local = await startLocalPg({
    dir: join(process.cwd(), ".local", "postgres"),
    port,
    persistent: true,
    databases: ["nura_dev", "nura_shadow"],
    quiet: true,
  });

  console.log(`\nLocal Postgres ready on :${port}`);
  console.log(`  DATABASE_URL=${local.url("nura_dev")}`);
  console.log("Press Ctrl+C to stop.\n");

  const shutdown = async () => {
    await local.pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  // Keep the process alive until a signal arrives.
  setInterval(() => {}, 1 << 30);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
