import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

import { authCompleteUrl, nextFromRedirectUrl } from "@/lib/auth-gate";
import { env } from "@/lib/env";

/** Per-user, session-dependent: a blocking dynamic route (keeps real 404/redirect statuses). */
export const instant = false;

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await searchParams;
  const next = nextFromRedirectUrl(redirect_url, env.NEXT_PUBLIC_SITE_URL);
  return (
    <>
      <h1 className="sr-only">Create your Nura Skin account</h1>
      <SignUp
        routing="hash"
        forceRedirectUrl={authCompleteUrl(next)}
        signInForceRedirectUrl={authCompleteUrl(next)}
      />
    </>
  );
}
