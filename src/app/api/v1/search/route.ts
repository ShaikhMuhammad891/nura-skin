import { z } from "zod";

import { searchCatalog } from "@/features/catalog/server/search";
import { AppError } from "@/lib/errors";
import { db } from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";
import { createRoute } from "@/lib/server/route";

/** Storefront search for the ⌘K palette (docs/09 §4.4). 60 requests/min per IP. */
export const GET = createRoute({
  name: "search",
  auth: "public",
  query: z.object({ q: z.string().max(200).default("") }),
  cacheControl: "public, max-age=60, s-maxage=300",
  handler: async ({ query, request }) => {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`search:${ip}`, 60, 60_000).ok) throw new AppError("RATE_LIMITED");
    return { data: await searchCatalog(db, query.q) };
  },
});
