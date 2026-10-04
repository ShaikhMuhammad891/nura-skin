"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { reviseAction, startConsultationAction } from "../server/actions";

/** Starts a consultation (or a prefilled revision) and opens the questionnaire. */
export function StartFinderButton({
  label = "Start the consultation",
  reviseFrom,
  variant = "accent",
}: {
  label?: string;
  /** Completed consultation to copy answers from ("Edit answers"). */
  reviseFrom?: string;
  variant?: "accent" | "secondary";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function start() {
    startTransition(async () => {
      const result = reviseFrom
        ? await reviseAction({ consultationId: reviseFrom })
        : await startConsultationAction({ source: "finder_intro" });
      if (result.ok) router.push(`/finder/${result.data.id}`);
      else setError(result.error.message);
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" variant={variant} size="lg" onClick={start} loading={pending}>
        {label}
        <ArrowRight aria-hidden />
      </Button>
      {error ? (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
