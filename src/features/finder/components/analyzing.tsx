"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const STAGES = [
  "Understanding your skin",
  "Checking every product against your answers",
  "Removing anything that doesn't suit you",
  "Matching ingredients to your concerns",
  "Making sure every step works together",
];

/** "Analyzing" moment (docs/15 P12): the engine's real pipeline stages, paced for reading. */
export function Analyzing() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStage((s) => Math.min(STAGES.length - 1, s + 1)), 550);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col gap-8 py-8" aria-busy="true">
      <h1 className="font-display text-heading-xl font-normal lg:text-display-lg lg:font-light">
        Building your routine…
      </h1>
      <ol className="flex flex-col gap-4">
        {STAGES.map((label, i) => (
          <li
            key={label}
            className={cn(
              "flex items-center gap-3 text-body transition-opacity duration-300",
              i > stage && "opacity-40",
            )}
          >
            {i < stage ? (
              <Check aria-hidden className="size-5 text-success" />
            ) : i === stage ? (
              <Loader2 aria-hidden className="size-5 animate-spin text-accent" />
            ) : (
              <span aria-hidden className="size-5 rounded-full border border-border-strong" />
            )}
            {label}
          </li>
        ))}
      </ol>
      <p role="status" className="sr-only">
        {STAGES[stage]}
      </p>
    </div>
  );
}
