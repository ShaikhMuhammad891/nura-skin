"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Finder inputs (docs/13 §6.2 "Radio cards (finder)", "Chips"). Native radios/checkboxes under the
 * hood for keyboard and screen-reader support; the visuals are the cards.
 */
export type Option<V extends string> = { value: V; label: string; hint?: string };

export function OptionCards<V extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  columns = 2,
}: {
  name: string;
  legend: string;
  options: Option<V>[];
  value: V | undefined;
  onChange: (value: V) => void;
  columns?: 1 | 2 | 3;
}) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div
        className={cn(
          "grid gap-3",
          columns === 2 && "sm:grid-cols-2",
          columns === 3 && "sm:grid-cols-3",
        )}
      >
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border border-border-strong bg-surface p-4 transition-shadow",
              "hover:bg-surface-alt has-[:checked]:border-primary has-[:checked]:shadow-glow",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="mt-1 size-4 shrink-0 accent-primary"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-body font-medium">{o.label}</span>
              {o.hint ? <span className="text-body-sm text-muted-foreground">{o.hint}</span> : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Chips<V extends string>({
  legend,
  options,
  values,
  onToggle,
  max,
  ranked = false,
}: {
  legend: string;
  options: Option<V>[];
  values: V[];
  onToggle: (value: V) => void;
  max?: number;
  /** Show the selection order as a rank badge. */
  ranked?: boolean;
}) {
  const full = max !== undefined && values.length >= max;
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const index = values.indexOf(o.value);
          const selected = index >= 0;
          const disabled = !selected && full;
          return (
            <label
              key={o.value}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border-strong px-4 text-body-sm transition-colors",
                "hover:bg-surface-alt has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <input
                type="checkbox"
                checked={selected}
                disabled={disabled}
                onChange={() => onToggle(o.value)}
                className="sr-only"
              />
              {selected ? (
                ranked ? (
                  <span
                    aria-hidden
                    className="inline-flex size-5 items-center justify-center rounded-full bg-primary-foreground text-caption font-semibold text-primary"
                  >
                    {index + 1}
                  </span>
                ) : (
                  <Check aria-hidden className="size-4" />
                )
              ) : null}
              {o.label}
              {ranked && selected ? <span className="sr-only">, priority {index + 1}</span> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border bg-surface p-4">
      <span className="flex flex-col gap-0.5">
        <span className="text-body font-medium">{label}</span>
        {hint ? <span className="text-body-sm text-muted-foreground">{hint}</span> : null}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-5 shrink-0 accent-primary"
      />
    </label>
  );
}
