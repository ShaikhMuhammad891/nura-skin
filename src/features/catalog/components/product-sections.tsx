import { AlertTriangle, Info, Moon, Star, Sun } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { SKIN_TYPE_LABELS } from "../filters";
import { formatConcentration, SLOT_LABELS } from "../merchandising";
import type { ConflictDTO, ProductDetailDTO, ReviewDTO, ReviewSummaryDTO } from "../types";

/** PDP content sections (docs/16 §5: KeyActives, GoodFor, HowToUse, IngredientConflicts, InciList). */

export function SectionTitle({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="font-display text-heading-xl font-normal">
      {children}
    </h2>
  );
}

export function KeyActives({ product }: { product: ProductDetailDTO }) {
  const actives = product.ingredients.filter((i) => i.isKeyActive);
  if (!actives.length) return null;
  return (
    <section aria-labelledby="key-actives" className="flex flex-col gap-4">
      <SectionTitle id="key-actives">Key actives</SectionTitle>
      <ul className="grid gap-3 sm:grid-cols-2">
        {actives.map((a) => (
          <li
            key={a.slug}
            className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4"
          >
            <div className="flex items-baseline justify-between gap-2">
              <Link
                href={`/ingredients/${a.slug}`}
                className="text-heading-sm font-semibold underline-offset-4 hover:underline"
              >
                {a.commonName}
              </Link>
              {a.concentrationBp ? (
                <span className="tabular text-body-sm font-semibold text-accent-foreground dark:text-accent">
                  {formatConcentration(a.concentrationBp)}
                </span>
              ) : null}
            </div>
            <p className="text-caption text-muted-foreground">{a.inciName}</p>
            {a.benefits.length ? (
              <p className="text-body-sm text-muted-foreground">
                {a.benefits.slice(0, 2).join(" · ")}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function GoodFor({ product }: { product: ProductDetailDTO }) {
  const prefs = [
    product.fragranceFree && "Fragrance-free",
    product.pregnancySafe && "Pregnancy-safe",
    product.vegan && "Vegan",
    product.nonComedogenic && "Non-comedogenic",
  ].filter(Boolean) as string[];
  return (
    <section aria-labelledby="good-for" className="flex flex-col gap-4">
      <SectionTitle id="good-for">Good for</SectionTitle>
      <dl className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <dt className="text-body-sm font-medium">Skin types</dt>
        <dd className="flex flex-wrap gap-2">
          {product.skinTypes.map((s) => (
            <Badge key={s} variant="outline">
              {SKIN_TYPE_LABELS[s]}
            </Badge>
          ))}
        </dd>
        {product.concerns.length ? (
          <>
            <dt className="text-body-sm font-medium">Concerns</dt>
            <dd className="flex flex-wrap gap-2">
              {product.concerns.map((c) => (
                <Link key={c.slug} href={`/concerns/${c.slug}`} className="rounded-xs">
                  <Badge variant="sage">{c.name}</Badge>
                </Link>
              ))}
            </dd>
          </>
        ) : null}
        {prefs.length ? (
          <>
            <dt className="text-body-sm font-medium">Formula</dt>
            <dd className="flex flex-wrap gap-2">
              {prefs.map((p) => (
                <Badge key={p} variant="neutral">
                  {p}
                </Badge>
              ))}
            </dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}

export function HowToUse({ product }: { product: ProductDetailDTO }) {
  const times =
    product.timeOfDay === "BOTH"
      ? ["Morning", "Evening"]
      : product.timeOfDay === "AM"
        ? ["Morning"]
        : ["Evening"];
  return (
    <section aria-labelledby="how-to-use" className="flex flex-col gap-4">
      <SectionTitle id="how-to-use">How to use</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {product.routineSlot ? (
          <Badge variant="accent">Step · {SLOT_LABELS[product.routineSlot]}</Badge>
        ) : null}
        {times.map((t) => (
          <Badge key={t} variant="neutral">
            {t === "Morning" ? <Sun aria-hidden /> : <Moon aria-hidden />}
            {t}
          </Badge>
        ))}
      </div>
      <p className="max-w-prose text-body text-muted-foreground">{product.howToUse}</p>
    </section>
  );
}

const SEVERITY: Record<ConflictDTO["severity"], { label: string; tone: string }> = {
  avoid_same_routine: { label: "Use at a different time of day", tone: "text-danger" },
  avoid_same_day: { label: "Use on different days", tone: "text-warning" },
  caution: { label: "Introduce gradually", tone: "text-info" },
};

export function IngredientConflicts({ conflicts }: { conflicts: ConflictDTO[] }) {
  if (!conflicts.length) return null;
  return (
    <section aria-labelledby="conflicts" className="flex flex-col gap-4">
      <SectionTitle id="conflicts">Don&apos;t layer with</SectionTitle>
      <ul className="flex flex-col gap-3">
        {conflicts.map((c) => {
          const s = SEVERITY[c.severity];
          const Icon = c.severity === "caution" ? Info : AlertTriangle;
          return (
            <li
              key={`${c.ingredient.slug}-${c.other.slug}`}
              className="flex gap-3 rounded-lg border border-border bg-surface p-4"
            >
              <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", s.tone)} />
              <div className="flex flex-col gap-1">
                <p className="text-body-sm font-semibold">
                  <Link
                    href={`/ingredients/${c.other.slug}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {c.other.commonName}
                  </Link>{" "}
                  <span className={cn("font-medium", s.tone)}>· {s.label}</span>
                </p>
                <p className="text-body-sm text-muted-foreground">{c.reason}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function InciList({ product }: { product: ProductDetailDTO }) {
  return (
    <details className="group rounded-lg border border-border">
      <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between px-4 text-heading-sm font-semibold [&::-webkit-details-marker]:hidden">
        Full ingredient list (INCI)
        <span
          aria-hidden
          className="text-muted-foreground transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <p className="px-4 pb-4 font-mono text-body-sm leading-relaxed text-muted-foreground">
        {product.ingredients.map((i, idx) => (
          <span key={i.slug}>
            <Link
              href={`/ingredients/${i.slug}`}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              {i.inciName}
            </Link>
            {idx < product.ingredients.length - 1 ? ", " : "."}
          </span>
        ))}
      </p>
    </details>
  );
}

export function ReviewsSection({
  summary,
  reviews,
}: {
  summary: ReviewSummaryDTO;
  reviews: ReviewDTO[];
}) {
  return (
    <section aria-labelledby="reviews" className="flex flex-col gap-6">
      <SectionTitle id="reviews">Reviews</SectionTitle>
      {summary.count === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-heading-sm font-semibold">No reviews yet</p>
          <p className="mt-1 text-body-sm text-muted-foreground">
            Bought this? Reviews open from your account after delivery.
          </p>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          <div className="flex flex-col gap-3">
            <p className="font-display text-display-lg font-light">
              {summary.average.toFixed(1)}
              <span className="text-body text-muted-foreground"> / 5</span>
            </p>
            <p className="text-body-sm text-muted-foreground">
              {summary.count} {summary.count === 1 ? "review" : "reviews"}
            </p>
            <ul className="flex flex-col gap-1.5">
              {[5, 4, 3, 2, 1].map((stars) => {
                const n = summary.distribution[stars - 1] ?? 0;
                const pct = summary.count ? Math.round((n / summary.count) * 100) : 0;
                return (
                  <li key={stars} className="flex items-center gap-2 text-caption">
                    <span className="tabular w-10">{stars} star</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-alt">
                      <span
                        className="block h-full rounded-full bg-foreground"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="tabular w-8 text-right text-muted-foreground">{n}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <ul className="flex flex-col divide-y divide-border">
            {reviews.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 py-5 first:pt-0">
                <span className="inline-flex" aria-label={`${r.rating} out of 5 stars`} role="img">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      aria-hidden
                      className={cn(
                        "size-3.5",
                        i <= r.rating ? "fill-foreground text-foreground" : "text-border-strong",
                      )}
                    />
                  ))}
                </span>
                {r.title ? <p className="text-heading-sm font-semibold">{r.title}</p> : null}
                <p className="max-w-prose text-body text-muted-foreground">{r.body}</p>
                <p className="text-caption text-subtle-foreground">
                  {r.authorName}
                  {r.skinType
                    ? ` · ${SKIN_TYPE_LABELS[r.skinType as keyof typeof SKIN_TYPE_LABELS] ?? r.skinType} skin`
                    : ""}
                  {r.verifiedPurchase ? " · Verified purchase" : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
