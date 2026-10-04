import { AlertTriangle, Info, Moon, Sun } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { ProductImage } from "@/features/catalog/components/product-image";
import { formatMoney } from "@/features/pricing/money";

import type { RoutineResultDTO, RoutineStepDTO, RoutineTierDTO } from "../types";
import { AddRoutineButton } from "./add-routine-button";
import { StartFinderButton } from "./start-button";
import { TierTabs } from "./tier-tabs";

const TIER_LABEL = { ESSENTIAL: "Essentials", COMPLETE: "Complete", ADVANCED: "Advanced" } as const;
const SLOT_LABEL = {
  CLEANSE: "Cleanse",
  TREAT: "Treat",
  MOISTURIZE: "Moisturize",
  PROTECT: "Protect",
};

function StepCard({ step, index }: { step: RoutineStepDTO; index: number }) {
  return (
    <li className="grid grid-cols-[72px_1fr] gap-4 rounded-xl border border-border bg-surface p-4 sm:grid-cols-[96px_1fr]">
      <ProductImage
        image={step.product.image}
        slot={step.slot}
        categorySlug={step.product.categorySlug}
        sizes="96px"
        className="rounded-md"
      />
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-overline font-semibold text-muted-foreground uppercase">
          Step {index + 1} · {SLOT_LABEL[step.slot]}
        </p>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <Link
            href={`/products/${step.product.slug}`}
            className="text-heading-sm font-semibold underline-offset-4 hover:underline"
          >
            {step.product.name}
          </Link>
          <span className="tabular text-body-sm text-muted-foreground">
            {formatMoney(step.priceCents)}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="neutral">{step.frequency}</Badge>
          {step.matchedConcerns.slice(0, 2).map((c) => (
            <Badge key={c} variant="sage">
              {c}
            </Badge>
          ))}
        </div>
        <p className="text-body-sm text-muted-foreground">{step.rationale}</p>
        {step.requiresVariantChoice ? (
          <p className="text-caption text-warning">Choose your shade on the product page.</p>
        ) : null}
      </div>
    </li>
  );
}

function TimeColumn({
  title,
  icon,
  steps,
}: {
  title: string;
  icon: React.ReactNode;
  steps: RoutineStepDTO[];
}) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="inline-flex items-center gap-2 text-heading-md font-semibold">
        {icon}
        {title}
      </h3>
      {steps.length ? (
        <ol className="flex flex-col gap-3">
          {steps.map((s, i) => (
            <StepCard key={s.id} step={s} index={i} />
          ))}
        </ol>
      ) : (
        <p className="text-body-sm text-muted-foreground">Nothing extra needed.</p>
      )}
    </section>
  );
}

function TierPanel({
  tier,
  consultationId,
  routineDiscountBp,
}: {
  tier: RoutineTierDTO;
  consultationId: string;
  routineDiscountBp: number;
}) {
  const discount = Math.round(routineDiscountBp / 100);
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-6 rounded-2xl bg-surface-alt p-6 lg:flex-row lg:items-end lg:justify-between lg:p-8">
        <div className="flex max-w-prose flex-col gap-2">
          <h2 className="font-display text-heading-xl font-normal">{tier.title}</h2>
          <p className="text-body text-muted-foreground">{tier.summary}</p>
          <p className="text-body-sm">
            <span className="tabular font-semibold">{formatMoney(tier.totalCents)}</span>
            <span className="text-muted-foreground">
              {" "}
              total · about {formatMoney(tier.monthlyCostCents)}/month
              {discount > 0 ? ` · save ${discount}% when you buy the full routine` : ""}
            </span>
          </p>
          {!tier.withinBudget ? (
            <p className="text-body-sm text-warning">A little over your monthly budget.</p>
          ) : null}
        </div>
        <AddRoutineButton consultationId={consultationId} tier={tier.tier} />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <TimeColumn title="Morning" icon={<Sun aria-hidden className="size-5" />} steps={tier.am} />
        <TimeColumn
          title="Evening"
          icon={<Moon aria-hidden className="size-5" />}
          steps={tier.pm}
        />
      </div>

      {tier.cautions.length ? (
        <ul className="flex flex-col gap-2">
          {tier.cautions.map((c) => (
            <li key={c} className="flex gap-2 text-body-sm">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
              {c}
            </li>
          ))}
        </ul>
      ) : null}

      {tier.introductionPlan.length ? (
        <section aria-labelledby={`intro-${tier.tier}`} className="flex flex-col gap-4">
          <h3 id={`intro-${tier.tier}`} className="font-display text-heading-xl font-normal">
            How to start
          </h3>
          <ol className="flex flex-col gap-3">
            {tier.introductionPlan.map((p) => (
              <li
                key={p.weeks}
                className="grid grid-cols-[96px_1fr] gap-4 border-t border-border pt-3"
              >
                <span className="text-body-sm font-semibold">Weeks {p.weeks}</span>
                <span className="text-body-sm text-muted-foreground">{p.instructions}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

/** Routine results (docs/04 C5, docs/15 P13): three tiers, recommended first. */
export function RoutineResults({
  result,
  signedIn,
}: {
  result: RoutineResultDTO;
  signedIn: boolean;
}) {
  const concerns = result.profileSummary.concerns;
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <p className="text-overline font-semibold text-muted-foreground uppercase">Your routine</p>
        <h1 className="font-display text-display-xl font-light">
          Built for {result.profileSummary.skinType} skin
          {concerns.length ? (
            <span className="text-muted-foreground">
              {" "}
              focused on{" "}
              {concerns
                .slice(0, 2)
                .map((c) => c.toLowerCase())
                .join(" and ")}
            </span>
          ) : null}
          .
        </h1>
        {result.notices.length ? (
          <ul className="flex flex-col gap-2">
            {result.notices.map((n) => (
              <li key={n} className="flex gap-2 rounded-lg bg-info-subtle p-3 text-body-sm">
                <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
                {n}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <TierTabs
        defaultTier={result.recommendedTier}
        tabs={result.tiers.map((t) => ({
          value: t.tier,
          label: TIER_LABEL[t.tier],
          badge: t.isRecommended ? "Recommended" : undefined,
          panel: (
            <TierPanel
              tier={t}
              consultationId={result.consultationId}
              routineDiscountBp={result.routineDiscountBp}
            />
          ),
        }))}
      />

      {result.excluded.length ? (
        <details className="group rounded-xl border border-border">
          <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between px-4 text-heading-sm font-semibold [&::-webkit-details-marker]:hidden">
            What we left out, and why ({result.excluded.length})
            <span
              aria-hidden
              className="text-muted-foreground transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <ul className="flex flex-col gap-2 px-4 pb-4">
            {result.excluded.map((e) => (
              <li key={e.slug} className="text-body-sm">
                <Link
                  href={`/products/${e.slug}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {e.name}
                </Link>
                <span className="text-muted-foreground">: {e.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="flex flex-col gap-6 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
        {signedIn ? (
          <p className="text-body-sm text-muted-foreground">
            Saved to your account.{" "}
            <Link href="/account" className="text-link underline underline-offset-4">
              See your routines
            </Link>
          </p>
        ) : (
          <p className="text-body-sm text-muted-foreground">
            <Link
              href={`/sign-in?redirect_url=${encodeURIComponent(`/finder/results/${result.consultationId}`)}`}
              className="text-link underline underline-offset-4"
            >
              Sign in or create an account
            </Link>{" "}
            to save this routine.
          </p>
        )}
        <StartFinderButton
          label="Edit my answers"
          reviseFrom={result.consultationId}
          variant="secondary"
        />
      </div>

      <p className="text-caption text-subtle-foreground">
        Cosmetic guidance based on your answers, not medical advice. Patch-test new products, and
        see a dermatologist for persistent or painful skin conditions.{" "}
        {result.engine === "RULES_FALLBACK" ? "Built by our rules engine." : null}
      </p>
    </div>
  );
}
