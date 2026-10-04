import "server-only";

import type { z } from "zod";

import { AppError, serializeError, toAppError, type SerializedError } from "@/lib/errors";

import { getActor, type Actor } from "./actor";
import { authorize, type AuthPolicy } from "./authorize";
import { hasRecentReverification } from "./clerk";
import type { DbClient } from "./db-types";
import { logger } from "./logger";

/**
 * Server Action wrapper (docs/06 §3.2, docs/09 §2.8, ADR-0017).
 * Order: validate input → resolve actor → authorize → step-up check → handler → map errors.
 * Staff actions by DEMO_STAFF run in a transaction that is always rolled back (ADR-0016).
 * Rate limiting arrives with Upstash (M4).
 */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: SerializedError };

export type ActionContext = {
  actor: Actor;
  requestId: string;
  /**
   * The database client handlers must use for writes. In demo mode it is a transaction that is
   * rolled back after the handler returns.
   */
  db: DbClient;
  /** True when writes are discarded: handlers must skip external effects (Stripe, Clerk, email). */
  demo: boolean;
};

type ActionConfig<TSchema extends z.ZodType, TResult> = AuthPolicy & {
  /** Stable name for logs/metrics, e.g. "cart.addItem". */
  name: string;
  schema: TSchema;
  /** Sensitive action: requires a Clerk re-verification within 10 minutes (docs/10 §6). */
  reverify?: boolean;
  handler: (input: z.output<TSchema>, ctx: ActionContext) => Promise<TResult>;
};

/** Thrown inside the demo transaction to force a rollback while carrying the handler's result. */
class DemoRollback<T> extends Error {
  constructor(readonly result: T) {
    super("demo rollback");
  }
}

export function createAction<TSchema extends z.ZodType, TResult>(
  config: ActionConfig<TSchema, TResult>,
): (input: z.input<TSchema>) => Promise<ActionResult<TResult>> {
  return async (input) => {
    const requestId = crypto.randomUUID();
    const log = logger.child({ requestId, action: config.name });

    try {
      const parsed = config.schema.safeParse(input);
      if (!parsed.success) throw toAppError(parsed.error);

      const actor = await getActor();
      authorize(config, actor);

      // Demo staff can't change anything real, so there is nothing to step up for.
      const demo = config.auth === "staff" && actor.isDemo;
      if (config.reverify && !demo && !(await hasRecentReverification())) {
        throw new AppError("REVERIFICATION_REQUIRED", undefined, {
          details: { level: "strict" },
        });
      }

      // Imported lazily: the client needs DATABASE_URL, which pure action tests don't set.
      const { db } = await import("./db");

      if (!demo) {
        const data = await config.handler(parsed.data, { actor, requestId, db, demo: false });
        return { ok: true, data };
      }

      try {
        await db.$transaction(async (tx) => {
          const result = await config.handler(parsed.data, {
            actor,
            requestId,
            db: tx,
            demo: true,
          });
          throw new DemoRollback(result);
        });
        throw new Error("demo transaction committed");
      } catch (error) {
        if (error instanceof DemoRollback) {
          log.info("demo action rolled back");
          return { ok: true, data: error.result as TResult };
        }
        throw error;
      }
    } catch (error) {
      const appError = toAppError(error);
      if (appError.code === "INTERNAL") {
        log.error({ err: error }, "action failed");
      } else {
        log.info({ code: appError.code }, "action rejected");
      }
      return { ok: false, error: serializeError(appError, requestId) };
    }
  };
}

/** Narrow helper for handlers: throw a typed domain error. */
export function fail(...args: ConstructorParameters<typeof AppError>): never {
  throw new AppError(...args);
}
