import { SignOutButton, UserProfile } from "@clerk/nextjs";
import type { Metadata } from "next";

import { Container, Section } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Verify your identity" };

const SIGN_IN_AGAIN = "/sign-in?redirect_url=%2Fadmin";

/**
 * Staff MFA gate (docs/10 §6). The proxy sends staff here when the session has no verified second
 * factor, or when the first factor is older than 12 h (`?reason=reauth`). Either way the fix is a
 * fresh sign-in; without MFA enrolled, staff enrol first using Clerk's security settings.
 */
export default async function MfaRequiredPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const reauth = reason === "reauth";

  return (
    <Section>
      <Container className="flex flex-col gap-6">
        <h1 className="font-display text-display-lg font-light">
          {reauth ? "Please sign in again" : "Two-step verification required"}
        </h1>
        <p className="max-w-prose text-body-lg text-muted-foreground">
          {reauth
            ? "For your security, admin sessions expire 12 hours after sign-in."
            : "The admin area needs two-step verification. Set up an authenticator app below, then sign out and sign back in with your code."}
        </p>
        <div>
          <SignOutButton redirectUrl={SIGN_IN_AGAIN}>
            <Button>Sign out and sign in again</Button>
          </SignOutButton>
        </div>
        {!reauth && <UserProfile routing="hash" />}
      </Container>
    </Section>
  );
}
