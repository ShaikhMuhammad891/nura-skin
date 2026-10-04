import "server-only";

import pino from "pino";

/**
 * Structured JSON logger with PII redaction (docs/20 §7, docs/18 §8).
 * Use `logger.child({ requestId, route })` per request; never log raw PII.
 */
export const REDACT_PATHS = [
  "*.email",
  "*.name",
  "*.firstName",
  "*.lastName",
  "*.phone",
  "*.address",
  "*.address.*",
  "*.shippingAddress",
  "*.billingAddress",
  "*.notes",
  "*.token",
  "*.secret",
  "*.password",
  "req.headers.cookie",
  "req.headers.authorization",
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { app: "nura-skin", env: process.env.NEXT_PUBLIC_APP_ENV ?? "local" },
  redact: { paths: REDACT_PATHS, censor: "[redacted]" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
