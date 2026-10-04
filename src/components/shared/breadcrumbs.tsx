import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

import { JsonLd } from "./json-ld";

export type Crumb = { label: string; href: string };

/** Breadcrumbs with BreadcrumbList JSON-LD (docs/13 §6.4). The last crumb is the current page. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <>
      <nav aria-label="Breadcrumb" className={cn("text-body-sm", className)}>
        <ol className="flex flex-wrap items-center gap-1 text-muted-foreground">
          {items.map((item, i) => {
            const last = i === items.length - 1;
            return (
              <li key={item.href} className="flex items-center gap-1">
                {i > 0 ? <ChevronRight aria-hidden className="size-3.5" /> : null}
                {last ? (
                  <span aria-current="page" className="text-foreground">
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="rounded-sm hover:text-foreground hover:underline"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: items.map((item, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: item.label,
            item: new URL(item.href, env.NEXT_PUBLIC_SITE_URL).toString(),
          })),
        }}
      />
    </>
  );
}
