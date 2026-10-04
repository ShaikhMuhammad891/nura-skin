/**
 * Stripe subscription → local state mapping (docs/11 §5.2, review R-04). Pure and convergent:
 * webhook handlers re-read the latest Stripe object and pass the relevant fields here.
 *
 * Why the order of checks matters:
 *  - `pause_collection` keeps Stripe's `status = "active"`, so it must be checked FIRST.
 *  - "Skip next delivery" is implemented with `trial_end`, which Stripe reports as `trialing`.
 *  - Stripe's own `paused` status means a trial ended without a payment method; this is not
 *    expected in our flows, so it is flagged for attention rather than silently mapped.
 */
export type LocalSubscriptionStatus = "INCOMPLETE" | "ACTIVE" | "PAUSED" | "PAST_DUE" | "CANCELED";

export type StripeSubscriptionSnapshot = {
  status:
    | "incomplete"
    | "incomplete_expired"
    | "trialing"
    | "active"
    | "past_due"
    | "canceled"
    | "unpaid"
    | "paused";
  /** Unix seconds. */
  current_period_end: number | null;
  trial_end: number | null;
  pause_collection: { behavior: string; resumes_at: number | null } | null;
  cancel_at_period_end: boolean;
};

export type MappedSubscription = {
  status: LocalSubscriptionStatus;
  nextChargeAt: Date | null;
  pausedUntil: Date | null;
  cancelAtPeriodEnd: boolean;
  needsAttention: boolean;
};

const fromUnix = (seconds: number | null): Date | null =>
  seconds == null ? null : new Date(seconds * 1000);

export function mapStripeSubscription(sub: StripeSubscriptionSnapshot): MappedSubscription {
  const cancelAtPeriodEnd = sub.cancel_at_period_end;

  if (sub.pause_collection && sub.status !== "canceled") {
    const resumesAt = fromUnix(sub.pause_collection.resumes_at);
    return {
      status: "PAUSED",
      nextChargeAt: resumesAt,
      pausedUntil: resumesAt,
      cancelAtPeriodEnd,
      needsAttention: false,
    };
  }

  switch (sub.status) {
    case "trialing":
      // A skipped delivery: the next charge is when the trial ends.
      return {
        status: "ACTIVE",
        nextChargeAt: fromUnix(sub.trial_end),
        pausedUntil: null,
        cancelAtPeriodEnd,
        needsAttention: false,
      };
    case "active":
      return {
        status: "ACTIVE",
        nextChargeAt: cancelAtPeriodEnd ? null : fromUnix(sub.current_period_end),
        pausedUntil: null,
        cancelAtPeriodEnd,
        needsAttention: false,
      };
    case "past_due":
    case "unpaid":
      return {
        status: "PAST_DUE",
        nextChargeAt: null,
        pausedUntil: null,
        cancelAtPeriodEnd,
        needsAttention: false,
      };
    case "canceled":
    case "incomplete_expired":
      return {
        status: "CANCELED",
        nextChargeAt: null,
        pausedUntil: null,
        cancelAtPeriodEnd: false,
        needsAttention: false,
      };
    case "incomplete":
      return {
        status: "INCOMPLETE",
        nextChargeAt: null,
        pausedUntil: null,
        cancelAtPeriodEnd,
        needsAttention: false,
      };
    case "paused":
      return {
        status: "PAUSED",
        nextChargeAt: null,
        pausedUntil: null,
        cancelAtPeriodEnd,
        needsAttention: true,
      };
  }
}
