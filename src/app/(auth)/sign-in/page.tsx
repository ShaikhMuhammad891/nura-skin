import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

import { TryAdminDemo } from "@/features/demo/components/try-admin-demo";
import { authCompleteUrl, nextFromRedirectUrl } from "@/lib/auth-gate";
import { env } from "@/lib/env";

/** Per-user, session-dependent: a blocking dynamic route (keeps real 404/redirect statuses). */
export const instant = false;

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await searchParams;
  const next = nextFromRedirectUrl(redirect_url, env.NEXT_PUBLIC_SITE_URL);
  return (
    <div className="flex flex-col items-center gap-8">
      <h1 className="sr-only">Sign in to Nura Skin</h1>
      <SignIn
        routing="hash"
        forceRedirectUrl={authCompleteUrl(next)}
        signUpForceRedirectUrl={authCompleteUrl(next)}
      />
      <TryAdminDemo />
    </div>
  );
}
