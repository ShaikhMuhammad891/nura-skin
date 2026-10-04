import { describe, expect, it } from "vitest";

import { mapStripeSubscription, type StripeSubscriptionSnapshot } from "./stripe-status";

const periodEnd = Date.UTC(2026, 10, 1) / 1000;
const trialEnd = Date.UTC(2026, 11, 27) / 1000;
const resumesAt = Date.UTC(2027, 0, 15) / 1000;

const snapshot = (patch: Partial<StripeSubscriptionSnapshot>): StripeSubscriptionSnapshot => ({
  status: "active",
  current_period_end: periodEnd,
  trial_end: null,
  pause_collection: null,
  cancel_at_period_end: false,
  ...patch,
});

describe("mapStripeSubscription (review R-04)", () => {
  it("active → ACTIVE, next charge at period end", () => {
    expect(mapStripeSubscription(snapshot({}))).toMatchObject({
      status: "ACTIVE",
      nextChargeAt: new Date(periodEnd * 1000),
    });
  });

  it("pause_collection wins even though Stripe still says active", () => {
    const mapped = mapStripeSubscription(
      snapshot({ status: "active", pause_collection: { behavior: "void", resumes_at: resumesAt } }),
    );
    expect(mapped).toMatchObject({ status: "PAUSED", pausedUntil: new Date(resumesAt * 1000) });
  });

  it("a skip (trial_end) shows as ACTIVE with the next charge at trial end", () => {
    expect(
      mapStripeSubscription(snapshot({ status: "trialing", trial_end: trialEnd })),
    ).toMatchObject({
      status: "ACTIVE",
      nextChargeAt: new Date(trialEnd * 1000),
    });
  });

  it("cancel at period end keeps ACTIVE but has no next charge", () => {
    expect(mapStripeSubscription(snapshot({ cancel_at_period_end: true }))).toMatchObject({
      status: "ACTIVE",
      cancelAtPeriodEnd: true,
      nextChargeAt: null,
    });
  });

  it.each([
    ["past_due", "PAST_DUE"],
    ["unpaid", "PAST_DUE"],
    ["canceled", "CANCELED"],
    ["incomplete_expired", "CANCELED"],
    ["incomplete", "INCOMPLETE"],
  ] as const)("%s → %s", (stripe, local) => {
    expect(mapStripeSubscription(snapshot({ status: stripe })).status).toBe(local);
  });

  it("Stripe's own `paused` status is flagged for attention", () => {
    expect(mapStripeSubscription(snapshot({ status: "paused" }))).toMatchObject({
      status: "PAUSED",
      needsAttention: true,
    });
  });

  it("a canceled subscription ignores a stale pause_collection", () => {
    const mapped = mapStripeSubscription(
      snapshot({
        status: "canceled",
        pause_collection: { behavior: "void", resumes_at: resumesAt },
      }),
    );
    expect(mapped.status).toBe("CANCELED");
  });
});
