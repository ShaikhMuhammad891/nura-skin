"use client";

import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/features/pricing/money";
import { cn } from "@/lib/utils";

import {
  REQUIRED_STEPS,
  STEP_ORDER,
  stepSchemas,
  type Answers,
  type ConcernSlug,
  type StepId,
} from "../questionnaire";
import { recommendAction, saveAnswerAction } from "../server/actions";
import { Analyzing } from "./analyzing";
import { Chips, OptionCards, Toggle, type Option } from "./controls";

type Named = { slug: string; name: string };

const DEFAULTS: Answers = {
  concerns: { ranked: [] },
  reactions: { items: [] },
  conditions: { items: [], sensitiveConsent: false },
  "current-routine": { actives: [] },
  lifestyle: { climate: "temperate", sunExposure: "moderate", wearsMakeup: false },
  preferences: {
    fragranceFree: false,
    vegan: false,
    tintedSpf: null,
    avoid: [],
    pregnancySafeOnly: false,
  },
  budget: { monthlyCents: 8000 },
  notes: { text: "" },
};

const COPY: Record<StepId, { title: string; hint?: string }> = {
  "skin-type": { title: "How does your skin usually feel by midday?" },
  "skin-type-helper": {
    title: "Let's work it out together",
    hint: "Two quick questions and we'll infer your skin type.",
  },
  concerns: {
    title: "What would you most like to improve?",
    hint: "Pick up to three, in order of priority.",
  },
  sensitivity: { title: "How easily does your skin react to new products?" },
  reactions: { title: "Have any of these caused redness or stinging before?" },
  conditions: {
    title: "Do any of these apply to you right now?",
    hint: "This keeps your routine safe. It's optional to share.",
  },
  "current-routine": {
    title: "Which actives do you already use?",
    hint: "So we don't double up. Skip if you're not sure.",
  },
  lifestyle: { title: "Your environment" },
  "routine-time": { title: "How much time do you want to spend?" },
  preferences: { title: "Anything you prefer or avoid?" },
  budget: {
    title: "What's your monthly skincare budget?",
    hint: "Products last 1–3 months, so this is the monthly cost, not the price.",
  },
  notes: {
    title: "Anything else we should know?",
    hint: "Optional. For example: 'I cycle a lot outdoors' or 'I prefer light textures'.",
  },
};

function visibleSteps(answers: Answers): StepId[] {
  return STEP_ORDER.filter(
    (s) => s !== "skin-type-helper" || answers["skin-type"]?.skinType === "UNSURE",
  );
}

function toggleIn<V extends string>(values: V[], value: V, exclusive: V[] = []): V[] {
  if (values.includes(value)) return values.filter((v) => v !== value);
  if (exclusive.includes(value)) return [value];
  return [...values.filter((v) => !exclusive.includes(v)), value];
}

/**
 * The Routine Finder questionnaire (docs/04 C4, docs/15 P11). One question per screen, validated
 * client-side with the same Zod schemas the server enforces, autosaved on Continue, resumable.
 */
export function FinderWizard({
  consultationId,
  initialAnswers,
  initialStep,
  concerns,
  actives,
}: {
  consultationId: string;
  initialAnswers: Answers;
  initialStep: StepId;
  concerns: Named[];
  actives: Named[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>({ ...DEFAULTS, ...initialAnswers });
  const [step, setStep] = useState<StepId>(initialStep);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [analyzing, setAnalyzing] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const steps = visibleSteps(answers);
  const index = Math.max(0, steps.indexOf(step));
  const draft = answers[step];
  const valid = stepSchemas[step].safeParse(draft).success;
  const optional = !REQUIRED_STEPS.includes(step) && step !== "skin-type-helper";

  // Move focus to the new question for keyboard and screen-reader users.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  function set<S extends StepId>(id: S, value: Answers[S]) {
    setError(null);
    setAnswers((a) => ({ ...a, [id]: value }));
  }

  function finish() {
    setAnalyzing(true);
    const minimum = new Promise((r) => setTimeout(r, 2800));
    startTransition(async () => {
      const [result] = await Promise.all([recommendAction({ consultationId }), minimum]);
      if (result.ok) {
        router.push(`/finder/results/${consultationId}`);
        return;
      }
      setAnalyzing(false);
      const missing = result.error.details?.missingSteps as StepId[] | undefined;
      if (missing?.[0]) setStep(missing[0]);
      setError(result.error.message);
    });
  }

  function advance(skip = false) {
    startTransition(async () => {
      if (!skip) {
        const result = await saveAnswerAction({ consultationId, stepId: step, answer: draft });
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        if (result.data.nextStepId) setStep(result.data.nextStepId);
        else finish();
        return;
      }
      const next = steps[index + 1];
      if (next) setStep(next);
      else finish();
    });
  }

  if (analyzing) return <Analyzing />;

  const concernOptions: Option<ConcernSlug>[] = concerns.map((c) => ({
    value: c.slug as ConcernSlug,
    label: c.name,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-body-sm text-muted-foreground">
          <span>
            Question {index + 1} of {steps.length}
          </span>
          {optional ? <span>Optional</span> : null}
        </div>
        <div
          role="progressbar"
          aria-label="Questionnaire progress"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={index + 1}
          className="h-1.5 overflow-hidden rounded-full bg-surface-alt"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300 ease-standard"
            style={{ width: `${((index + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-heading-xl font-normal outline-none lg:text-display-lg lg:font-light"
        >
          {COPY[step].title}
        </h1>
        {COPY[step].hint ? (
          <p className="text-body text-muted-foreground">{COPY[step].hint}</p>
        ) : null}
      </div>

      <div>{renderStep()}</div>

      {error ? (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep(steps[index - 1] ?? step)}
          disabled={index === 0 || pending}
        >
          <ArrowLeft aria-hidden />
          Back
        </Button>
        <div className="flex gap-3">
          {optional ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => advance(true)}
              disabled={pending}
            >
              Skip
            </Button>
          ) : null}
          <Button type="button" onClick={() => advance()} disabled={!valid} loading={pending}>
            {index === steps.length - 1 ? "See my routine" : "Continue"}
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );

  function renderStep() {
    switch (step) {
      case "skin-type":
        return (
          <OptionCards
            name="skinType"
            legend={COPY[step].title}
            value={answers["skin-type"]?.skinType}
            onChange={(skinType) => set("skin-type", { skinType })}
            options={[
              { value: "DRY", label: "Tight or flaky", hint: "Dry" },
              { value: "OILY", label: "Shiny all over", hint: "Oily" },
              {
                value: "COMBINATION",
                label: "Shiny T-zone, normal or dry cheeks",
                hint: "Combination",
              },
              { value: "NORMAL", label: "Comfortable", hint: "Normal" },
              { value: "UNSURE", label: "Not sure", hint: "We'll help you work it out" },
            ]}
          />
        );
      case "skin-type-helper": {
        const h =
          answers["skin-type-helper"] ?? ({} as Partial<NonNullable<Answers["skin-type-helper"]>>);
        const update = (patch: Partial<NonNullable<Answers["skin-type-helper"]>>) =>
          set("skin-type-helper", { ...h, ...patch } as NonNullable<Answers["skin-type-helper"]>);
        return (
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <p className="text-heading-sm font-semibold">
                An hour after cleansing with nothing on, your skin feels…
              </p>
              <OptionCards
                name="afterCleansing"
                legend="After cleansing"
                value={h.afterCleansing}
                onChange={(afterCleansing) => update({ afterCleansing })}
                options={[
                  { value: "tight", label: "Tight" },
                  { value: "comfortable", label: "Comfortable" },
                  { value: "shiny_tzone", label: "Shiny on my T-zone" },
                  { value: "shiny_all", label: "Shiny all over" },
                ]}
              />
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-heading-sm font-semibold">
                How often do you get shine on your cheeks?
              </p>
              <OptionCards
                name="cheekShine"
                legend="Cheek shine"
                columns={3}
                value={h.cheekShine}
                onChange={(cheekShine) => update({ cheekShine })}
                options={[
                  { value: "never", label: "Never" },
                  { value: "sometimes", label: "Sometimes" },
                  { value: "often", label: "Often" },
                ]}
              />
            </div>
          </div>
        );
      }
      case "concerns": {
        const ranked = answers.concerns?.ranked ?? [];
        return (
          <Chips
            legend={COPY[step].title}
            options={concernOptions}
            values={ranked}
            max={3}
            ranked
            onToggle={(v) => set("concerns", { ranked: toggleIn(ranked, v) })}
          />
        );
      }
      case "sensitivity": {
        const level = answers.sensitivity?.level;
        return (
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">{COPY[step].title}</legend>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <label
                  key={n}
                  className={cn(
                    "flex h-16 cursor-pointer items-center justify-center rounded-xl border border-border-strong bg-surface text-heading-md font-semibold",
                    "hover:bg-surface-alt has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground",
                    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                  )}
                >
                  <input
                    type="radio"
                    name="sensitivity"
                    checked={level === n}
                    onChange={() => set("sensitivity", { level: n })}
                    className="sr-only"
                  />
                  {n}
                </label>
              ))}
            </div>
            <div className="flex justify-between text-body-sm text-muted-foreground">
              <span>Rarely reacts</span>
              <span>Reacts to almost everything</span>
            </div>
          </fieldset>
        );
      }
      case "reactions": {
        const items = answers.reactions?.items ?? [];
        type R = (typeof items)[number];
        return (
          <Chips<R>
            legend={COPY[step].title}
            values={items}
            onToggle={(v) => set("reactions", { items: toggleIn(items, v, ["none", "not_sure"]) })}
            options={[
              { value: "fragrance", label: "Fragrance" },
              { value: "acids", label: "Exfoliating acids" },
              { value: "retinoids", label: "Retinoids / retinol" },
              { value: "vitamin_c", label: "Vitamin C" },
              { value: "essential_oils", label: "Essential oils" },
              { value: "none", label: "None of these" },
              { value: "not_sure", label: "Not sure" },
            ]}
          />
        );
      }
      case "conditions": {
        const c = answers.conditions ?? { items: [], sensitiveConsent: false };
        type C = (typeof c.items)[number];
        const shared = c.items.some((i) => i !== "none" && i !== "prefer_not");
        return (
          <div className="flex flex-col gap-6">
            <Chips<C>
              legend={COPY[step].title}
              values={c.items}
              onToggle={(v) =>
                set("conditions", {
                  ...c,
                  items: toggleIn(c.items, v, ["none", "prefer_not"]),
                })
              }
              options={[
                { value: "pregnant", label: "Pregnant" },
                { value: "breastfeeding", label: "Breastfeeding" },
                { value: "trying", label: "Trying to conceive" },
                { value: "rosacea", label: "Diagnosed rosacea" },
                { value: "eczema", label: "Diagnosed eczema" },
                { value: "prescription", label: "Using prescription skincare" },
                { value: "none", label: "None of these" },
                { value: "prefer_not", label: "Prefer not to say" },
              ]}
            />
            {shared ? (
              <label className="flex cursor-pointer gap-3 rounded-xl border border-border bg-surface-alt p-4 text-body-sm">
                <input
                  type="checkbox"
                  checked={c.sensitiveConsent}
                  onChange={(e) => set("conditions", { ...c, sensitiveConsent: e.target.checked })}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span>
                  <Lock aria-hidden className="mr-1 inline size-3.5" />I agree that Nura may use
                  this health information only to tailor my routine. It&apos;s never used for
                  marketing. See our{" "}
                  <Link
                    href="/legal/health-data"
                    className="text-link underline underline-offset-4"
                  >
                    health data policy
                  </Link>
                  .
                </span>
              </label>
            ) : null}
          </div>
        );
      }
      case "current-routine": {
        const list = answers["current-routine"]?.actives ?? [];
        return (
          <Chips
            legend={COPY[step].title}
            values={list}
            onToggle={(v) => set("current-routine", { actives: toggleIn(list, v) })}
            options={actives.map((a) => ({ value: a.slug, label: a.name }))}
            max={15}
          />
        );
      }
      case "lifestyle": {
        const l = answers.lifestyle!;
        return (
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <p className="text-heading-sm font-semibold">Climate where you live</p>
              <OptionCards
                name="climate"
                legend="Climate"
                value={l.climate}
                onChange={(climate) => set("lifestyle", { ...l, climate })}
                options={[
                  { value: "humid", label: "Humid" },
                  { value: "dry", label: "Dry" },
                  { value: "temperate", label: "Temperate" },
                  { value: "cold", label: "Cold" },
                ]}
              />
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-heading-sm font-semibold">Time in the sun on a typical day</p>
              <OptionCards
                name="sun"
                legend="Sun exposure"
                columns={3}
                value={l.sunExposure}
                onChange={(sunExposure) => set("lifestyle", { ...l, sunExposure })}
                options={[
                  { value: "low", label: "Mostly indoors" },
                  { value: "moderate", label: "Some time outside" },
                  { value: "high", label: "Outdoors a lot" },
                ]}
              />
            </div>
            <Toggle
              label="I wear makeup most days"
              hint="We'll make sure your evening cleanse removes it properly."
              checked={l.wearsMakeup}
              onChange={(wearsMakeup) => set("lifestyle", { ...l, wearsMakeup })}
            />
          </div>
        );
      }
      case "routine-time":
        return (
          <OptionCards
            name="routineTime"
            legend={COPY[step].title}
            columns={3}
            value={answers["routine-time"]?.value}
            onChange={(value) => set("routine-time", { value })}
            options={[
              { value: "minimal", label: "2 minutes", hint: "The essentials only" },
              { value: "standard", label: "5 minutes", hint: "A complete routine" },
              { value: "enthusiast", label: "I love my routine", hint: "Targeted extras welcome" },
            ]}
          />
        );
      case "preferences": {
        const p = answers.preferences!;
        return (
          <div className="flex flex-col gap-3">
            <Toggle
              label="Fragrance-free only"
              checked={p.fragranceFree}
              onChange={(fragranceFree) => set("preferences", { ...p, fragranceFree })}
            />
            <Toggle
              label="Vegan only"
              checked={p.vegan}
              onChange={(vegan) => set("preferences", { ...p, vegan })}
            />
            <Toggle
              label="Tinted sunscreen"
              hint="Evens tone lightly. Leave off if you prefer untinted."
              checked={p.tintedSpf === true}
              onChange={(on) => set("preferences", { ...p, tintedSpf: on ? true : null })}
            />
            <Toggle
              label="Pregnancy-safe ingredients only"
              hint="Choose this if you'd rather not share details above."
              checked={p.pregnancySafeOnly}
              onChange={(pregnancySafeOnly) => set("preferences", { ...p, pregnancySafeOnly })}
            />
          </div>
        );
      }
      case "budget": {
        const cents = answers.budget?.monthlyCents ?? 8000;
        return (
          <div className="flex flex-col gap-4">
            <p className="font-display text-display-lg font-light" aria-live="polite">
              {formatMoney(cents)}
              <span className="text-body text-muted-foreground"> / month</span>
            </p>
            <label htmlFor="budget" className="sr-only">
              Monthly budget in dollars
            </label>
            <input
              id="budget"
              type="range"
              min={3000}
              max={20000}
              step={500}
              value={cents}
              aria-valuetext={`${formatMoney(cents)} per month`}
              onChange={(e) => set("budget", { monthlyCents: Number(e.target.value) })}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-body-sm text-muted-foreground">
              <span>$30</span>
              <span>$200</span>
            </div>
          </div>
        );
      }
      case "notes": {
        const text = answers.notes?.text ?? "";
        return (
          <div className="flex flex-col gap-2">
            <label htmlFor="notes" className="sr-only">
              Notes
            </label>
            <textarea
              id="notes"
              rows={4}
              maxLength={500}
              value={text}
              onChange={(e) => set("notes", { text: e.target.value })}
              className="w-full rounded-sm border border-border-strong bg-surface p-3 text-body"
            />
            <p className="text-right text-caption text-muted-foreground">{text.length}/500</p>
          </div>
        );
      }
    }
  }
}
