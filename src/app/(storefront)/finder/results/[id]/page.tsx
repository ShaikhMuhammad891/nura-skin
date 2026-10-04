import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { Container, Section } from "@/components/layout/container";
import { RoutineResults } from "@/features/finder/components/routine-results";
import { getResult } from "@/features/finder/server/service";
import { getPricingSettings } from "@/features/settings/server/settings";
import { AppError } from "@/lib/errors";
import { db } from "@/lib/server/db";

import { currentConsultationOwner } from "../../_lib/owner";

/** Per-visitor (cookie / session): a blocking dynamic route. */
export const instant = false;

export const metadata: Metadata = {
  title: "Your routine",
  robots: { index: false, follow: false },
};

/** Routine results (docs/15 P13): owner-only; unfinished consultations go back to the questions. */
export default async function FinderResultsPage({ params }: PageProps<"/finder/results/[id]">) {
  const { id } = await params;
  const owner = await currentConsultationOwner();
  const pricing = await getPricingSettings(db);
  const result = await getResult(db, id, owner, pricing.routineDiscountBp).catch(
    (error: unknown) => {
      if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
      if (error instanceof AppError && error.code === "CONFLICT") redirect(`/finder/${id}`);
      throw error;
    },
  );

  return (
    <Section className="pt-10 lg:pt-16">
      <Container className="max-w-5xl">
        <RoutineResults result={result} signedIn={owner.userId !== null} />
      </Container>
    </Section>
  );
}
