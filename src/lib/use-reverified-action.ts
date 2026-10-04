"use client";

import { useReverification } from "@clerk/nextjs";

import type { SerializedError } from "@/lib/errors";

type Result<T> = { ok: true; data: T } | { ok: false; error: SerializedError };

/**
 * Step-up for sensitive admin actions (docs/10 §6, docs/15 AU5). Our actions report
 * `REVERIFICATION_REQUIRED` as a normal result; this adapts it to the hint shape Clerk's
 * `useReverification` understands, so Clerk shows its modal and then retries the action.
 * If the user cancels, the promise rejects (check with `isReverificationCancelledError`).
 */
export function toReverificationHint<T>(result: Result<T>) {
  if (!result.ok && result.error.code === "REVERIFICATION_REQUIRED") {
    const level =
      typeof result.error.details?.level === "string" ? result.error.details.level : "strict";
    return {
      clerk_error: {
        type: "forbidden" as const,
        reason: "reverification-error" as const,
        metadata: { reverification: level },
      },
    };
  }
  return result;
}

export function useReverifiedAction<TInput, TData>(
  action: (input: TInput) => Promise<Result<TData>>,
): (input: TInput) => Promise<Result<TData>> {
  return useReverification(async (input: TInput) => toReverificationHint(await action(input))) as (
    input: TInput,
  ) => Promise<Result<TData>>;
}
