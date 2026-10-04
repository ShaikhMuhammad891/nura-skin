import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container, Section } from "@/components/layout/container";
import { StartFinderButton } from "@/features/finder/components/start-button";
import { listUserConsultations } from "@/features/finder/server/service";
import { formatMoney } from "@/features/pricing/money";
import { getCurrentUser } from "@/lib/server/clerk";
import { db } from "@/lib/server/db";

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
  const routines = await listUserConsultations(db, user.id);
  return (
    <Section>
      <Container className="flex flex-col gap-4">
        <p className="text-overline font-semibold text-muted-foreground uppercase">Your account</p>
        <h1 className="font-display text-display-lg font-light">
          {name ? `Welcome back, ${user.firstName ?? name}.` : "Welcome back."}
        </h1>
        <p className="max-w-prose text-body-lg text-muted-foreground">
          Signed in as {user.email}. Your orders and Routine Plans will appear here.
        </p>

        <section aria-labelledby="routines" className="mt-8 flex flex-col gap-4">
          <h2 id="routines" className="font-display text-heading-xl font-normal">
            Your routines
          </h2>
          {routines.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {routines.map((r) => {
                const rec = r.recommendations[0];
                return (
                  <li key={r.id}>
                    <Link
                      href={`/finder/results/${r.id}`}
                      className="flex h-full flex-col gap-1 rounded-xl border border-border bg-surface p-5 hover:shadow-sm"
                    >
                      <span className="text-caption text-muted-foreground">
                        {r.completedAt?.toLocaleDateString("en-US", { dateStyle: "medium" })}
                      </span>
                      <span className="text-heading-sm font-semibold">
                        {rec?.title ?? "Your routine"}
                      </span>
                      {rec ? (
                        <span className="text-body-sm text-muted-foreground">
                          {rec.summary} · {formatMoney(rec.totalCents)}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed border-border p-6">
              <p className="text-body text-muted-foreground">
                You haven&apos;t built a routine yet. It takes about three minutes.
              </p>
              <StartFinderButton label="Find my routine" />
            </div>
          )}
        </section>
      </Container>
    </Section>
  );
}
