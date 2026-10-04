import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 does not auto-load .env files; mirror Next.js precedence (.env.local wins).
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed/index.ts",
  },
  datasource: {
    // Migrations need a direct (non-pooled) connection; the app runtime uses DATABASE_URL.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
    // Scratch database for `migrate dev` / drift checks (`pnpm db:drift`). Never point at real data.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL || undefined,
  },
});
