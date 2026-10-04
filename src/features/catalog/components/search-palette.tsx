"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type Results = {
  products: { slug: string; name: string; subtitle: string | null; type: string }[];
  ingredients: { slug: string; commonName: string; inciName: string }[];
  concerns: { slug: string; name: string }[];
};

type Item = { href: string; label: string; hint: string };

function toItems(r: Results): Item[] {
  return [
    ...r.products.map((p) => ({
      href: p.type === "BUNDLE" ? `/routines/${p.slug}` : `/products/${p.slug}`,
      label: p.name,
      hint: p.type === "BUNDLE" ? "Routine" : "Product",
    })),
    ...r.ingredients.map((i) => ({
      href: `/ingredients/${i.slug}`,
      label: i.commonName,
      hint: "Ingredient",
    })),
    ...r.concerns.map((c) => ({ href: `/concerns/${c.slug}`, label: c.name, hint: "Concern" })),
  ];
}

/**
 * ⌘K search palette (docs/13 §6.4, docs/16). A combobox over `/api/v1/search` with arrow-key
 * navigation; Enter on free text goes to the full results page, which also works without JS.
 */
export function SearchPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      controller.current?.abort();
      return;
    }
    const timer = setTimeout(async () => {
      controller.current?.abort();
      const ctrl = new AbortController();
      controller.current = ctrl;
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (res.ok) {
          const json = (await res.json()) as { data: Results };
          setItems(toItems(json.data));
          setActive(-1);
        }
      } catch {
        // Aborted or offline: keep the previous results.
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  const visibleItems = query.trim().length < 2 ? [] : items;

  function go(href: string) {
    setOpen(false);
    setQuery("");
    setItems([]);
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(visibleItems.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = visibleItems[active];
      if (item) go(item.href);
      else if (query.trim()) go(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Search (Ctrl K)"
          className="inline-flex h-11 items-center gap-2 rounded-md px-3 text-body-sm text-foreground hover:bg-surface-alt"
        >
          <Search aria-hidden className="size-4" />
          <span className="hidden lg:inline">Search</span>
          <kbd className="hidden rounded-xs border border-border px-1.5 text-caption text-muted-foreground xl:inline">
            ⌘K
          </kbd>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim" />
        <Dialog.Content className="fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface shadow-lg outline-none">
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search products, ingredients and concerns. Use the arrow keys to choose a result.
          </Dialog.Description>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search aria-hidden className="size-4 text-muted-foreground" />
            <input
              autoFocus
              role="combobox"
              aria-expanded={visibleItems.length > 0}
              aria-controls="search-results"
              aria-activedescendant={active >= 0 ? `search-item-${active}` : undefined}
              aria-autocomplete="list"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search products, ingredients, concerns…"
              className="h-14 flex-1 bg-transparent text-body outline-none"
            />
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close search"
                className="inline-flex size-9 items-center justify-center rounded-md hover:bg-surface-alt"
              >
                <X aria-hidden className="size-4" />
              </button>
            </Dialog.Close>
          </div>
          <ul
            id="search-results"
            role="listbox"
            aria-label="Results"
            className="max-h-80 overflow-y-auto p-2"
          >
            {visibleItems.map((item, i) => (
              <li
                key={item.href}
                id={`search-item-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item.href)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2.5 text-body-sm",
                  i === active && "bg-surface-alt",
                )}
              >
                <span className="font-medium">{item.label}</span>
                <span className="text-caption text-muted-foreground">{item.hint}</span>
              </li>
            ))}
          </ul>
          <p
            role="status"
            aria-live="polite"
            className="px-4 pb-3 text-caption text-muted-foreground"
          >
            {query.trim().length < 2
              ? "Type at least two characters."
              : loading
                ? "Searching…"
                : visibleItems.length
                  ? `${visibleItems.length} results. Press Enter to see all.`
                  : "No quick matches. Press Enter to search everything."}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
