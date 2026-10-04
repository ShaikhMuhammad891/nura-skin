import "server-only";

import type { z } from "zod";

import { AppError, serializeError, toAppError } from "@/lib/errors";

import { getActor, type Actor } from "./actor";
import { authorize, type AuthPolicy } from "./authorize";
import { logger } from "./logger";

/**
 * Route Handler wrapper for the REST surface (docs/09 §2, ADR-0017).
 * Produces the standard envelope `{ data, meta }` / `{ error }`, sets `x-request-id`,
 * and never leaks internal error details.
 */
type RouteContext<TQuery, TBody, TParams> = {
  actor: Actor;
  requestId: string;
  request: Request;
  query: TQuery;
  body: TBody;
  params: TParams;
};

type RouteResult = {
  data: unknown;
  meta?: Record<string, unknown>;
  status?: number;
  headers?: HeadersInit;
};

type RouteConfig<
  TQuery extends z.ZodType,
  TBody extends z.ZodType,
  TParams extends z.ZodType,
> = AuthPolicy & {
  name: string;
  query?: TQuery;
  body?: TBody;
  params?: TParams;
  cacheControl?: string;
  handler: (
    ctx: RouteContext<z.output<TQuery>, z.output<TBody>, z.output<TParams>>,
  ) => Promise<RouteResult | Response>;
};

export function createRoute<
  TQuery extends z.ZodType = z.ZodUndefined,
  TBody extends z.ZodType = z.ZodUndefined,
  TParams extends z.ZodType = z.ZodUndefined,
>(config: RouteConfig<TQuery, TBody, TParams>) {
  return async (
    request: Request,
    context?: { params?: Promise<Record<string, string | string[]>> },
  ): Promise<Response> => {
    const requestId = request.headers.get("x-vercel-id") ?? crypto.randomUUID();
    const log = logger.child({ requestId, route: config.name });
    const baseHeaders = { "x-request-id": requestId };

    try {
      // Authorize before touching the body: unauthorized callers learn nothing about the schema.
      const actor = await getActor();
      authorize(config, actor);

      const url = new URL(request.url);
      // When a schema is omitted its generic defaults to ZodUndefined, so `undefined` is exactly
      // its output type; TypeScript can't correlate the optional config field with the generic.
      const query = (
        config.query ? parseOrThrow(config.query, Object.fromEntries(url.searchParams)) : undefined
      ) as z.output<TQuery>;
      const params = (
        config.params ? parseOrThrow(config.params, (await context?.params) ?? {}) : undefined
      ) as z.output<TParams>;
      const body = (
        config.body ? parseOrThrow(config.body, await readJson(request)) : undefined
      ) as z.output<TBody>;

      const result = await config.handler({ actor, requestId, request, query, body, params });
      if (result instanceof Response) {
        result.headers.set("x-request-id", requestId);
        return result;
      }

      return Response.json(
        { data: result.data, meta: { requestId, ...result.meta } },
        {
          status: result.status ?? 200,
          headers: {
            ...baseHeaders,
            "cache-control": config.cacheControl ?? "no-store",
            ...Object.fromEntries(new Headers(result.headers)),
          },
        },
      );
    } catch (error) {
      const appError = toAppError(error);
      if (appError.code === "INTERNAL") log.error({ err: error }, "route failed");
      const headers: Record<string, string> = { ...baseHeaders, "cache-control": "no-store" };
      const retryAfter = appError.details?.retryAfterSeconds;
      if (appError.code === "RATE_LIMITED" && typeof retryAfter === "number") {
        headers["retry-after"] = String(retryAfter);
      }
      return Response.json(
        { error: serializeError(appError, requestId) },
        { status: appError.status, headers },
      );
    }
  };
}

function parseOrThrow<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw toAppError(parsed.error);
  return parsed.data;
}

async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new AppError("BAD_REQUEST", "Expected application/json.");
  }
  try {
    return await request.json();
  } catch {
    throw new AppError("BAD_REQUEST", "Malformed JSON body.");
  }
}
