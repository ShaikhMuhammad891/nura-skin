/**
 * Local PostgreSQL without Docker (dev & test only). Production uses Neon (docs/20).
 * Uses real Postgres binaries via `embedded-postgres`, so SQL behaviour (locks, CHECKs,
 * triggers, partitioning) matches production.
 */
import { existsSync } from "node:fs";

import EmbeddedPostgres from "embedded-postgres";

export type LocalPg = {
  pg: EmbeddedPostgres;
  port: number;
  url: (database: string) => string;
};

export const LOCAL_PG_USER = "nura";
export const LOCAL_PG_PASSWORD = "nura";

export async function startLocalPg(options: {
  dir: string;
  port: number;
  persistent: boolean;
  databases: string[];
  quiet?: boolean;
}): Promise<LocalPg> {
  const pg = new EmbeddedPostgres({
    databaseDir: options.dir,
    port: options.port,
    user: LOCAL_PG_USER,
    password: LOCAL_PG_PASSWORD,
    persistent: options.persistent,
    onLog: options.quiet ? () => {} : (m) => process.stdout.write(`[pg] ${m}`),
    onError: (e) => process.stderr.write(`[pg:error] ${String(e)}\n`),
  });

  // initdb only on first run; a persistent data directory is reused afterwards.
  if (!existsSync(`${options.dir}/PG_VERSION`)) await pg.initialise();
  await pg.start();

  const client = pg.getPgClient();
  await client.connect();
  try {
    for (const db of options.databases) {
      const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [db]);
      if (!rowCount) await client.query(`CREATE DATABASE "${db}"`);
    }
  } finally {
    await client.end();
  }

  return {
    pg,
    port: options.port,
    url: (database) =>
      `postgresql://${LOCAL_PG_USER}:${LOCAL_PG_PASSWORD}@localhost:${options.port}/${database}`,
  };
}
