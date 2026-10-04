/**
 * Legal and help documents (docs/15 P21). Nura Skin is a portfolio demo store: these documents
 * describe how the demo behaves and must not be read as a real company's terms.
 */
export type LegalDoc = {
  slug: string;
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
};

const DEMO_NOTE =
  "Nura Skin is a portfolio demonstration store. No real orders are fulfilled and payments run in Stripe test mode.";

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "privacy",
    title: "Privacy policy",
    updated: "2026-10-01",
    intro: `${DEMO_NOTE} This policy explains what data the demo collects and why.`,
    sections: [
      {
        heading: "What we collect",
        body: [
          "Account details you give us through our sign-in provider (name, email).",
          "Orders, carts and routine-finder answers, so the store can work.",
          "Basic, consent-based analytics about which pages are used.",
        ],
      },
      {
        heading: "How we use it",
        body: [
          "To run your account, cart, checkout and routines. We never sell personal data.",
          "Routine-finder answers are used only to build your recommendation. Sensitive answers (such as pregnancy) are covered by our Consumer Health Data policy.",
        ],
      },
      {
        heading: "Processors",
        body: [
          "Authentication (Clerk), payments (Stripe), hosting and database providers process data on our behalf under their own security commitments.",
        ],
      },
      {
        heading: "Your rights",
        body: [
          "You can export or delete your data from account settings, or by emailing hello@nuraskin.app.",
        ],
      },
    ],
  },
  {
    slug: "health-data",
    title: "Consumer health data privacy policy",
    updated: "2026-10-01",
    intro: `${DEMO_NOTE} Some routine-finder answers can count as consumer health data. This page explains how we treat them.`,
    sections: [
      {
        heading: "What counts as health data here",
        body: [
          "Answers about pregnancy or breastfeeding, skin sensitivities, and reactions to products.",
        ],
      },
      {
        heading: "Consent",
        body: [
          "We ask for explicit consent before saving these answers to your account. Without consent they are used for one recommendation and not stored against your profile.",
        ],
      },
      {
        heading: "Withdrawing consent",
        body: [
          "You can withdraw consent and delete saved answers at any time from your skin profile.",
        ],
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms of use",
    updated: "2026-10-01",
    intro: DEMO_NOTE,
    sections: [
      {
        heading: "Not medical advice",
        body: [
          "Product and routine information is cosmetic guidance only. See a dermatologist for medical skin conditions.",
        ],
      },
      {
        heading: "Orders",
        body: [
          "Prices are shown in US dollars. Orders placed in this demo are never charged or shipped.",
        ],
      },
    ],
  },
  {
    slug: "subscription-terms",
    title: "Routine Plan terms",
    updated: "2026-10-01",
    intro: `${DEMO_NOTE} These terms describe how subscriptions would work.`,
    sections: [
      {
        heading: "Billing and changes",
        body: [
          "Plans renew on the interval you choose (4, 8 or 12 weeks). You can skip, swap, pause or cancel online at any time before the next charge.",
          "We email a reminder before each renewal.",
        ],
      },
    ],
  },
  {
    slug: "shipping-returns",
    title: "Shipping & returns",
    updated: "2026-10-01",
    intro: DEMO_NOTE,
    sections: [
      {
        heading: "Shipping",
        body: [
          "Free standard shipping on orders over $50; otherwise a flat rate applies at checkout.",
        ],
      },
      {
        heading: "Returns",
        body: [
          "30-day returns, even if opened. If a product irritates your skin, stop using it and contact us: we will refund it and help adjust your routine.",
        ],
      },
    ],
  },
  {
    slug: "cookies",
    title: "Cookie policy",
    updated: "2026-10-01",
    intro: DEMO_NOTE,
    sections: [
      {
        heading: "Essential cookies",
        body: [
          "Sign-in session, cart and routine-finder progress. These are required for the store to work.",
        ],
      },
      {
        heading: "Analytics",
        body: ["Only set after you consent, and only to understand which pages are used."],
      },
    ],
  },
  {
    slug: "accessibility",
    title: "Accessibility statement",
    updated: "2026-10-01",
    intro:
      "We aim to meet WCAG 2.2 AA across the store. Every page is tested with automated checks and keyboard navigation.",
    sections: [
      {
        heading: "Feedback",
        body: [
          "If something is hard to use, email hello@nuraskin.app and tell us what you were trying to do.",
        ],
      },
    ],
  },
];

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}
