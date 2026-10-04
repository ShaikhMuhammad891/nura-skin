import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

/** Robots (docs/18, docs/15): only production is crawlable; private areas never are. */
export default function robots(): MetadataRoute.Robots {
  if (env.NEXT_PUBLIC_APP_ENV !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/account",
        "/checkout",
        "/cart",
        "/api",
        "/search",
        "/auth",
        "/finder/results",
      ],
    },
    sitemap: new URL("/sitemap.xml", env.NEXT_PUBLIC_SITE_URL).toString(),
  };
}
