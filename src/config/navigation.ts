/**
 * Storefront navigation (docs/13 §6.4).
 */
export type NavItem = { label: string; href: string };

export const mainNav: NavItem[] = [
  { label: "Shop", href: "/shop" },
  { label: "Routine finder", href: "/finder" },
  { label: "Routines", href: "/routines" },
  { label: "Ingredients", href: "/ingredients" },
  { label: "Science", href: "/science" },
  { label: "Cart", href: "/cart" },
];

export const footerNav: { title: string; items: NavItem[] }[] = [
  {
    title: "Shop",
    items: [
      { label: "Cleansers", href: "/shop/cleansers" },
      { label: "Serums", href: "/shop/serums" },
      { label: "Moisturizers", href: "/shop/moisturizers" },
      { label: "Sunscreens", href: "/shop/sunscreens" },
      { label: "Routines", href: "/routines" },
    ],
  },
  {
    title: "Learn",
    items: [
      { label: "Routine finder", href: "/finder" },
      { label: "Ingredient glossary", href: "/ingredients" },
      { label: "How our engine works", href: "/science" },
    ],
  },
  {
    title: "Help",
    items: [
      { label: "FAQ", href: "/faq" },
      { label: "Track an order", href: "/orders/lookup" },
      { label: "Shipping & returns", href: "/legal/shipping-returns" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "About", href: "/about" },
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Health data policy", href: "/legal/health-data" },
      { label: "Terms", href: "/legal/terms" },
    ],
  },
];
