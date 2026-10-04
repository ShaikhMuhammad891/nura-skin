import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container, Section } from "@/components/layout/container";
import { getCurrentUser } from "@/lib/server/clerk";

/** Per-user, session-dependent: a blocking dynamic route (keeps real 404/redirect statuses). */
export const instant = false;

export const metadata: Metadata = { title: "Your account" };

/**
 * Account home (docs/15). M2 ships the authenticated shell; orders, Routine Plans, addresses and
 * the skin profile arrive with M5–M7. The proxy already requires sign-in; this re-checks (10 §1.4).
 */
export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) notFound();

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return (
    <Section>
      <Container className="flex flex-col gap-4">
        <p className="text-overline font-semibold text-muted-foreground uppercase">Your account</p>
        <h1 className="font-display text-display-lg font-light">
          {name ? `Welcome back, ${user.firstName ?? name}.` : "Welcome back."}
        </h1>
        <p className="max-w-prose text-body-lg text-muted-foreground">
          Signed in as {user.email}. Your orders, Routine Plans and saved routines will appear here.
        </p>
      </Container>
    </Section>
  );
}
