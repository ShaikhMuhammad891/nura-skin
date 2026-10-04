import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";

import { startDemoSessionForm } from "../server/actions";

/** "Try the admin" entry point (docs/10 §9b); renders nothing outside the demo deployment. */
export function TryAdminDemo() {
  if (!env.DEMO_MODE_ENABLED || env.DEMO_STAFF_CLERK_USER_IDS.length === 0) return null;
  return (
    <form action={startDemoSessionForm} className="flex flex-col items-center gap-2 text-center">
      <p className="text-body-sm text-muted-foreground">Reviewing the portfolio?</p>
      <Button type="submit" variant="secondary">
        Try the admin demo
      </Button>
      <p className="max-w-xs text-caption text-subtle-foreground">
        Synthetic data only. Changes are simulated and never saved.
      </p>
    </form>
  );
}
