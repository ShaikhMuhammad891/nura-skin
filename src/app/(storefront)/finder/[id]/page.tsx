import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { Container, Section } from "@/components/layout/container";
import { getConcerns, getIngredients } from "@/features/catalog/server/queries";
import { FinderWizard } from "@/features/finder/components/finder-wizard";
import { missingRequiredSteps, nextStep, type StepId } from "@/features/finder/questionnaire";
import { getConsultation } from "@/features/finder/server/service";
import { AppError } from "@/lib/errors";
import { db } from "@/lib/server/db";

import { currentConsultationOwner } from "../_lib/owner";

/** Per-visitor (cookie / session): a blocking dynamic route. */
export const instant = false;

export const metadata: Metadata = {
  title: "Routine Finder",
  robots: { index: false, follow: false },
};

/** The questionnaire for one consultation (docs/15 P11): owner-only, resumes where it stopped. */
export default async function FinderQuestionsPage({ params }: PageProps<"/finder/[id]">) {
  const { id } = await params;
  const owner = await currentConsultationOwner();
  const consultation = await getConsultation(db, id, owner).catch((error: unknown) => {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  });
  if (consultation.status === "COMPLETED") redirect(`/finder/results/${id}`);

  const [concerns, ingredients] = await Promise.all([getConcerns(), getIngredients()]);
  const answers = consultation.answers;
  const resumeAt: StepId =
    (consultation.lastStep && nextStep(consultation.lastStep, answers)) ??
    missingRequiredSteps(answers)[0] ??
    consultation.lastStep ??
    "skin-type";

  return (
    <Section className="pt-10 lg:pt-16">
      <Container className="max-w-2xl">
        <FinderWizard
          consultationId={id}
          initialAnswers={answers}
          initialStep={resumeAt}
          concerns={concerns.map((c) => ({ slug: c.slug, name: c.name }))}
          actives={ingredients
            .filter((i) => i.isActive)
            .map((i) => ({ slug: i.slug, name: i.commonName }))}
        />
      </Container>
    </Section>
  );
}
