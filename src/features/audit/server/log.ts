import "server-only";

import type { Prisma, RoleKey } from "@/generated/prisma/client";
import type { DbClient } from "@/lib/server/db-types";

/**
 * Audit log writer (FR-ADM-08). Append-only in the database (trigger). Before/after diffs are
 * redacted: secrets and PII never enter the audit trail.
 */
const REDACTED_KEYS = new Set([
  "email",
  "phone",
  "firstName",
  "lastName",
  "fullName",
  "line1",
  "line2",
  "shippingAddress",
  "billingAddress",
  "password",
  "token",
  "tokenHash",
  "secret",
  "stripeCustomerId",
]);

export function redactForAudit(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactForAudit);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        REDACTED_KEYS.has(k) ? "[redacted]" : redactForAudit(v),
      ]),
    );
  }
  return value;
}

export type AuditEntry = {
  actorId: string | null;
  actorRole?: RoleKey | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  requestId?: string;
  ip?: string | null;
  userAgent?: string | null;
};

export async function writeAudit(db: DbClient, entry: AuditEntry): Promise<void> {
  const json = (v: unknown) =>
    v === undefined ? undefined : (redactForAudit(v) as Prisma.InputJsonValue);
  await db.auditLog.create({
    data: {
      actorId: entry.actorId,
      actorRole: entry.actorRole ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: json(entry.before),
      after: json(entry.after),
      metadata: json(entry.metadata),
      requestId: entry.requestId,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}
