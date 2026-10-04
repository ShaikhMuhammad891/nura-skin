"use client";

import { Tabs } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * Tier switcher for the results page (docs/04 C5). Panels are server-rendered and passed in;
 * Radix Tabs provides the roving-focus keyboard pattern.
 */
export function TierTabs({
  defaultTier,
  tabs,
}: {
  defaultTier: string;
  tabs: { value: string; label: string; badge?: string; panel: React.ReactNode }[];
}) {
  return (
    <Tabs.Root defaultValue={defaultTier} className="flex flex-col gap-8">
      <Tabs.List
        aria-label="Routine options"
        className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface-alt p-1"
      >
        {tabs.map((t) => (
          <Tabs.Trigger
            key={t.value}
            value={t.value}
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-body-sm font-medium text-muted-foreground",
              "data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-xs",
              "focus-visible:outline-2 focus-visible:outline-ring",
            )}
          >
            {t.label}
            {t.badge ? (
              <span className="text-caption font-semibold text-accent-foreground dark:text-accent">
                {t.badge}
              </span>
            ) : null}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {tabs.map((t) => (
        <Tabs.Content key={t.value} value={t.value} className="outline-none">
          {t.panel}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
