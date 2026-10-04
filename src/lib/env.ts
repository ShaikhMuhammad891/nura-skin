import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Validated environment (docs/20 §2). The build fails fast on missing/malformed values.
 * Server variables are only readable on the server; accessing them from client code throws.
 * Later milestones extend this schema (database, Clerk, Stripe, …).
 */
export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
    DATABASE_URL: z.url().startsWith("postgres"),
    DIRECT_URL: z.url().startsWith("postgres").optional(),
    /** HMAC key for cart/consultation cookies; the previous key stays valid during rotation. */
    COOKIE_SECRET: z.string().min(32),
    COOKIE_SECRET_PREVIOUS: z.string().min(32).optional(),
    CLERK_SECRET_KEY: z.string().startsWith("sk_"),
    /** Svix signing secret of the Clerk webhook endpoint; unset until the endpoint exists. */
    CLERK_WEBHOOK_SIGNING_SECRET: z.string().startsWith("whsec_").optional(),
    STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
    /** Webhook endpoint secret (local: printed by `stripe listen`); unset until configured. */
    STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
    /** Portfolio demo (ADR-0016). DEMO_STAFF is rejected by the permission resolver when off. */
    DEMO_MODE_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    /** Pooled demo staff (Clerk user ids, comma-separated), created by `npm run demo:staff`. */
    DEMO_STAFF_CLERK_USER_IDS: z
      .string()
      .optional()
      .transform((v) =>
        (v ?? "")
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      ),
  },
  client: {
    NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
    NEXT_PUBLIC_APP_ENV: z.enum(["local", "preview", "staging", "production"]).default("local"),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
    /** Cloudinary cloud (ADR-0010); unset → products show illustrated packshots. */
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z
      .string()
      .regex(/^[a-z0-9-]+$/i)
      .optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  },
  emptyStringAsUndefined: true,
  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
});
