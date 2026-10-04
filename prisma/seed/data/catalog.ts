/**
 * Launch catalogue (docs/02 §2.1–2.2). Shared by the seed script and the engine's pure tests.
 * Prices in cents; concentrations in basis points (1000 = 10%).
 */
import type { ConcernSlug } from "./knowledge";

export type SkinTypeKey = "DRY" | "OILY" | "COMBINATION" | "NORMAL";
export type SlotKey = "CLEANSE" | "TREAT" | "MOISTURIZE" | "PROTECT";
export type TimeKey = "AM" | "PM" | "BOTH";

export type VariantSeed = {
  sku: string;
  name: string;
  optionType: "size" | "shade";
  sizeMl?: number;
  shadeHex?: string;
  priceCents: number;
  compareAtPriceCents?: number;
  costCents: number;
  subscriptionEligible?: boolean;
  replenishDays: number;
  weightGrams: number;
  isDefault?: boolean;
  onHand: number;
  lowStockThreshold?: number;
};

export type ProductSeed = {
  slug: string;
  name: string;
  subtitle: string;
  category: "cleansers" | "serums" | "moisturizers" | "sunscreens";
  routineSlot: SlotKey;
  timeOfDay: TimeKey;
  skinTypes: SkinTypeKey[];
  textures: string[];
  pregnancySafe: boolean;
  fragranceFree: boolean;
  vegan: boolean;
  nonComedogenic: boolean;
  strengthLevel: 1 | 2 | 3;
  isFeatured?: boolean;
  featuredPosition?: number;
  badges?: string[];
  shortDescription: string;
  description: string;
  howToUse: string;
  /** INCI in descending order of concentration. */
  inci: { ingredient: string; key?: boolean; bp?: number }[];
  concerns: [ConcernSlug, 1 | 2 | 3][];
  variants: VariantSeed[];
};

export type BundleSeed = {
  slug: string;
  name: string;
  subtitle: string;
  shortDescription: string;
  description: string;
  howToUse: string;
  sku: string;
  priceCents: number;
  costCents: number;
  isFeatured?: boolean;
  featuredPosition?: number;
  items: { sku: string; timeOfDay: TimeKey; stepOrder: number }[];
};

export const CATEGORIES = [
  {
    slug: "cleansers",
    name: "Cleansers",
    routineSlot: "CLEANSE",
    position: 1,
    description: "Gentle cleansers that respect your barrier. Step one, morning and night.",
  },
  {
    slug: "serums",
    name: "Serums",
    routineSlot: "TREAT",
    position: 2,
    description: "Targeted treatments with transparent concentrations of proven actives.",
  },
  {
    slug: "moisturizers",
    name: "Moisturizers",
    routineSlot: "MOISTURIZE",
    position: 3,
    description: "Barrier-first moisturizers for every skin type and season.",
  },
  {
    slug: "sunscreens",
    name: "Sunscreens",
    routineSlot: "PROTECT",
    position: 4,
    description: "Daily broad-spectrum protection: the most effective anti-aging step there is.",
  },
  {
    slug: "routines",
    name: "Routines",
    routineSlot: null,
    position: 5,
    description: "Complete, compatible routines, built to work together.",
  },
] as const;

const BASE_PRESERVATIVES = [{ ingredient: "phenoxyethanol" }, { ingredient: "ethylhexylglycerin" }];

export const PRODUCTS: ProductSeed[] = [
  {
    slug: "cloud-milk-cleanser",
    name: "Cloud Milk Cleanser",
    subtitle: "Oat & Ceramide Cream Cleanser",
    category: "cleansers",
    routineSlot: "CLEANSE",
    timeOfDay: "BOTH",
    skinTypes: ["DRY", "NORMAL", "COMBINATION"],
    textures: ["cream", "milk"],
    pregnancySafe: true,
    fragranceFree: true,
    vegan: true,
    nonComedogenic: true,
    strengthLevel: 1,
    isFeatured: true,
    featuredPosition: 3,
    badges: ["bestseller"],
    shortDescription:
      "A soft, non-foaming cream cleanser that removes the day without stripping. Skin feels calm, never tight.",
    description:
      "Colloidal oat and ceramides cleanse while you cushion your barrier. Made for dry, sensitive and reactive skin, and gentle enough for morning and night.",
    howToUse:
      "Massage one pump onto damp skin for 30 seconds. Rinse with lukewarm water. Morning and evening.",
    inci: [
      { ingredient: "water" },
      { ingredient: "glycerin" },
      { ingredient: "coco-glucoside" },
      { ingredient: "oat-kernel-oil" },
      { ingredient: "colloidal-oatmeal", key: true, bp: 100 },
      { ingredient: "ceramide-np", key: true, bp: 20 },
      { ingredient: "panthenol" },
      { ingredient: "cetearyl-alcohol" },
      { ingredient: "xanthan-gum" },
      { ingredient: "citric-acid" },
      ...BASE_PRESERVATIVES,
    ],
    concerns: [
      ["sensitivity", 3],
      ["dryness", 2],
      ["redness", 1],
    ],
    variants: [
      {
        sku: "NURA-CLN-CLOUD-150",
        name: "150 ml",
        optionType: "size",
        sizeMl: 150,
        priceCents: 2400,
        costCents: 520,
        replenishDays: 60,
        weightGrams: 190,
        isDefault: true,
        onHand: 420,
      },
      {
        sku: "NURA-CLN-CLOUD-30",
        name: "30 ml travel",
        optionType: "size",
        sizeMl: 30,
        priceCents: 900,
        costCents: 190,
        subscriptionEligible: false,
        replenishDays: 21,
        weightGrams: 45,
        onHand: 160,
      },
    ],
  },
  {
    slug: "clarify-gel-cleanser",
    name: "Clarify Gel Cleanser",
    subtitle: "0.5% Salicylic Acid Gel Cleanser",
    category: "cleansers",
    routineSlot: "CLEANSE",
    timeOfDay: "BOTH",
    skinTypes: ["OILY", "COMBINATION", "NORMAL"],
    textures: ["gel"],
    pregnancySafe: false,
    fragranceFree: true,
    vegan: true,
    nonComedogenic: true,
    strengthLevel: 2,
    shortDescription:
      "A fresh gel cleanser with salicylic acid that clears pores and helps prevent breakouts without over-drying.",
    description:
      "Low-dose salicylic acid works inside pores while zinc PCA keeps shine in check. A soft, sulfate-free lather rinses clean.",
    howToUse:
      "Massage onto damp skin, focusing on the T-zone, for 30–60 seconds, then rinse. Use once or twice daily.",
    inci: [
      { ingredient: "water" },
      { ingredient: "sodium-lauroyl-methyl-isethionate" },
      { ingredient: "glycerin" },
      { ingredient: "coco-glucoside" },
      { ingredient: "salicylic-acid", key: true, bp: 50 },
      { ingredient: "zinc-pca", key: true, bp: 10 },
      { ingredient: "panthenol" },
      { ingredient: "xanthan-gum" },
      { ingredient: "citric-acid" },
      ...BASE_PRESERVATIVES,
    ],
    concerns: [
      ["acne", 3],
      ["oiliness", 3],
      ["pores", 2],
    ],
    variants: [
      {
        sku: "NURA-CLN-CLARIFY-150",
        name: "150 ml",
        optionType: "size",
        sizeMl: 150,
        priceCents: 2400,
        costCents: 540,
        replenishDays: 60,
        weightGrams: 185,
        isDefault: true,
        onHand: 380,
      },
    ],
  },
  {
    slug: "melt-cleansing-balm",
    name: "Melt Cleansing Balm",
    subtitle: "Makeup & SPF Removing Balm",
    category: "cleansers",
    routineSlot: "CLEANSE",
    timeOfDay: "PM",
    skinTypes: ["DRY", "NORMAL", "COMBINATION", "OILY"],
    textures: ["balm", "oil"],
    pregnancySafe: true,
    fragranceFree: false,
    vegan: true,
    nonComedogenic: false,
    strengthLevel: 1,
    shortDescription:
      "A buttery balm that melts into a silky oil, lifting makeup and sunscreen, then rinses away milky-clean.",
    description:
      "Sunflower and oat oils dissolve long-wear makeup and water-resistant SPF. Lightly scented with a soft, natural fragrance, so fragrance-free routines skip it.",
    howToUse:
      "Evening. Massage a scoop onto dry skin, add water to emulsify, then rinse. Follow with your usual cleanser if you like.",
    inci: [
      { ingredient: "sunflower-seed-oil" },
      { ingredient: "caprylic-capric-triglyceride" },
      { ingredient: "polyglyceryl-4-oleate" },
      { ingredient: "oat-kernel-oil", key: true },
      { ingredient: "tocopherol" },
      { ingredient: "fragrance" },
    ],
    concerns: [["dryness", 1]],
    variants: [
      {
        sku: "NURA-CLN-MELT-100",
        name: "100 ml",
        optionType: "size",
        sizeMl: 100,
        priceCents: 3200,
        costCents: 700,
        replenishDays: 75,
        weightGrams: 240,
        isDefault: true,
        onHand: 210,
      },
    ],
  },
  {
    slug: "dew-serum",
    name: "Dew Serum",
    subtitle: "1.5% Hyaluronic Acid + 5% Panthenol",
    category: "serums",
    routineSlot: "TREAT",
    timeOfDay: "BOTH",
    skinTypes: ["DRY", "NORMAL", "COMBINATION", "OILY"],
    textures: ["serum", "gel"],
    pregnancySafe: true,
    fragranceFree: true,
    vegan: true,
    nonComedogenic: true,
    strengthLevel: 1,
    isFeatured: true,
    featuredPosition: 2,
    shortDescription:
      "Multi-weight hyaluronic acid and pro-vitamin B5 flood skin with water for a plump, dewy finish.",
    description:
      "Three weights of hyaluronic acid hydrate at different depths while panthenol soothes. Works for every skin type and layers under anything.",
    howToUse: "Apply 2–3 drops to damp skin morning and evening, before moisturizer.",
    inci: [
      { ingredient: "water" },
      { ingredient: "glycerin" },
      { ingredient: "panthenol", key: true, bp: 500 },
      { ingredient: "sodium-hyaluronate", key: true, bp: 150 },
      { ingredient: "propanediol" },
      { ingredient: "allantoin" },
      { ingredient: "xanthan-gum" },
      ...BASE_PRESERVATIVES,
    ],
    concerns: [
      ["dehydration", 3],
      ["dryness", 2],
      ["sensitivity", 1],
    ],
    variants: [
      {
        sku: "NURA-SER-DEW-30",
        name: "30 ml",
        optionType: "size",
        sizeMl: 30,
        priceCents: 3400,
        costCents: 610,
        replenishDays: 56,
        weightGrams: 110,
        isDefault: true,
        onHand: 350,
      },
    ],
  },
  {
    slug: "clear-serum",
    name: "Clear Serum",
    subtitle: "10% Niacinamide + 1% Zinc PCA",
    category: "serums",
    routineSlot: "TREAT",
    timeOfDay: "BOTH",
    skinTypes: ["OILY", "COMBINATION", "NORMAL"],
    textures: ["serum"],
    pregnancySafe: true,
    fragranceFree: true,
    vegan: true,
    nonComedogenic: true,
    strengthLevel: 2,
    badges: ["bestseller"],
    shortDescription:
      "Balances oil, refines the look of pores and fades post-breakout marks with a proven niacinamide dose.",
    description:
      "10% niacinamide with 1% zinc PCA regulates shine and supports a calmer, clearer complexion. Lightweight and fast-absorbing.",
    howToUse:
      "Apply 2–3 drops morning and/or evening after cleansing. Start once daily if your skin is sensitive.",
    inci: [
      { ingredient: "water" },
      { ingredient: "niacinamide", key: true, bp: 1000 },
      { ingredient: "zinc-pca", key: true, bp: 100 },
      { ingredient: "glycerin" },
      { ingredient: "propanediol" },
      { ingredient: "xanthan-gum" },
      ...BASE_PRESERVATIVES,
    ],
    concerns: [
      ["oiliness", 3],
      ["pores", 3],
      ["acne", 2],
      ["post-acne-marks", 2],
    ],
    variants: [
      {
        sku: "NURA-SER-CLEAR-30",
        name: "30 ml",
        optionType: "size",
        sizeMl: 30,
        priceCents: 3000,
        costCents: 480,
        replenishDays: 56,
        weightGrams: 110,
        isDefault: true,
        onHand: 18,
        lowStockThreshold: 25,
      },
    ],
  },
  {
    slug: "glow-serum",
    name: "Glow Serum",
    subtitle: "15% Vitamin C Brightening Serum",
    category: "serums",
    routineSlot: "TREAT",
    timeOfDay: "AM",
    skinTypes: ["DRY", "NORMAL", "COMBINATION", "OILY"],
    textures: ["serum"],
    pregnancySafe: true,
    fragranceFree: true,
    vegan: true,
    nonComedogenic: true,
    strengthLevel: 2,
    isFeatured: true,
    featuredPosition: 1,
    badges: ["derm-favorite"],
    shortDescription:
      "A stable 15% vitamin C with ferulic acid and vitamin E that brightens dullness and fades dark spots.",
    description:
      "Ethyl ascorbic acid is a stable form of vitamin C that doesn't oxidize in the bottle. Ferulic acid and vitamin E boost its antioxidant protection. Best in the morning under SPF.",
    howToUse: "Morning. Apply 3 drops to clean skin before moisturizer and sunscreen.",
    inci: [
      { ingredient: "water" },
      { ingredient: "ethyl-ascorbic-acid", key: true, bp: 1500 },
      { ingredient: "propanediol" },
      { ingredient: "glycerin" },
      { ingredient: "sodium-hyaluronate" },
      { ingredient: "ferulic-acid", key: true, bp: 50 },
      { ingredient: "tocopherol", key: true, bp: 50 },
      { ingredient: "xanthan-gum" },
      ...BASE_PRESERVATIVES,
    ],
    concerns: [
      ["dullness", 3],
      ["pigmentation", 2],
      ["post-acne-marks", 2],
    ],
    variants: [
      {
        sku: "NURA-SER-GLOW-30",
        name: "30 ml",
        optionType: "size",
        sizeMl: 30,
        priceCents: 4800,
        costCents: 900,
        replenishDays: 56,
        weightGrams: 115,
        isDefault: true,
        onHand: 260,
      },
    ],
  },
  {
    slug: "renew-night-serum",
    name: "Renew Night Serum",
    subtitle: "0.05% Encapsulated Retinal",
    category: "serums",
    routineSlot: "TREAT",
    timeOfDay: "PM",
    skinTypes: ["NORMAL", "COMBINATION", "DRY", "OILY"],
    textures: ["serum", "emulsion"],
    pregnancySafe: false,
    fragranceFree: true,
    vegan: true,
    nonComedogenic: true,
    strengthLevel: 3,
    shortDescription:
      "Encapsulated retinal smooths texture and softens fine lines, released gradually to keep irritation low.",
    description:
      "Retinal works faster than retinol with fewer steps to activation. Encapsulation and a squalane base keep it comfortable. Not for use during pregnancy or breastfeeding.",
    howToUse:
      "Evening only. Start 2–3 nights a week with a pea-sized amount on dry skin, then build up. Always wear SPF the next day.",
    inci: [
      { ingredient: "water" },
      { ingredient: "squalane" },
      { ingredient: "glycerin" },
      { ingredient: "caprylic-capric-triglyceride" },
      { ingredient: "niacinamide", bp: 200 },
      { ingredient: "retinal", key: true, bp: 5 },
      { ingredient: "tocopherol" },
      { ingredient: "cetearyl-alcohol" },
      { ingredient: "xanthan-gum" },
      ...BASE_PRESERVATIVES,
    ],
    concerns: [
      ["fine-lines", 3],
      ["texture", 3],
      ["acne", 1],
    ],
    variants: [
      {
        sku: "NURA-SER-RENEW-30",
        name: "30 ml",
        optionType: "size",
        sizeMl: 30,
        priceCents: 5600,
        costCents: 1100,
        replenishDays: 70,
        weightGrams: 120,
        isDefault: true,
        onHand: 190,
      },
    ],
  },
  {
    slug: "calm-serum",
    name: "Calm Serum",
    subtitle: "10% Azelaic Acid + Centella",
    category: "serums",
    routineSlot: "TREAT",
    timeOfDay: "BOTH",
    skinTypes: ["DRY", "NORMAL", "COMBINATION", "OILY"],
    textures: ["serum", "cream"],
    pregnancySafe: true,
    fragranceFree: true,
    vegan: true,
    nonComedogenic: true,
    strengthLevel: 2,
    shortDescription:
      "Azelaic acid and cica calm visible redness, clear pores and fade post-acne marks. Gentle enough for sensitive skin.",
    description:
      "10% azelaic acid is one of the few actives that addresses redness, breakouts and marks at once, and it's pregnancy-friendly. Centella adds comfort.",
    howToUse:
      "Apply a thin layer once daily (morning or evening) for two weeks, then up to twice daily.",
    inci: [
      { ingredient: "water" },
      { ingredient: "azelaic-acid", key: true, bp: 1000 },
      { ingredient: "propanediol" },
      { ingredient: "glycerin" },
      { ingredient: "centella-asiatica", key: true },
      { ingredient: "panthenol" },
      { ingredient: "cetearyl-alcohol" },
      { ingredient: "xanthan-gum" },
      ...BASE_PRESERVATIVES,
    ],
    concerns: [
      ["redness", 3],
      ["post-acne-marks", 3],
      ["acne", 2],
      ["sensitivity", 2],
    ],
    variants: [
      {
        sku: "NURA-SER-CALM-30",
        name: "30 ml",
        optionType: "size",
        sizeMl: 30,
        priceCents: 4200,
        costCents: 760,
        replenishDays: 56,
        weightGrams: 115,
        isDefault: true,
        onHand: 240,
      },
    ],
  },
  {
    slug: "barrier-cream",
    name: "Barrier Cream",
    subtitle: "3% Ceramide Complex Moisturizer",
    category: "moisturizers",
    routineSlot: "MOISTURIZE",
    timeOfDay: "BOTH",
    skinTypes: ["DRY", "NORMAL", "COMBINATION"],
    textures: ["cream"],
    pregnancySafe: true,
    fragranceFree: true,
    vegan: true,
    nonComedogenic: true,
    strengthLevel: 1,
    badges: ["bestseller"],
    shortDescription:
      "A rich-but-breathable cream with ceramides, cholesterol and fatty acids in the skin's own 3:1:1 ratio.",
    description:
      "Rebuilds a dry or compromised barrier with skin-identical lipids. Comforting under makeup and a lifesaver in winter.",
    howToUse: "Smooth over face and neck morning and evening, after serum.",
    inci: [
      { ingredient: "water" },
      { ingredient: "glycerin" },
      { ingredient: "caprylic-capric-triglyceride" },
      { ingredient: "squalane" },
      { ingredient: "cetearyl-alcohol" },
      { ingredient: "ceramide-np", key: true, bp: 300 },
      { ingredient: "cholesterol", key: true, bp: 100 },
      { ingredient: "shea-butter" },
      { ingredient: "panthenol" },
      { ingredient: "xanthan-gum" },
      ...BASE_PRESERVATIVES,
    ],
    concerns: [
      ["dryness", 3],
      ["sensitivity", 3],
      ["redness", 1],
    ],
    variants: [
      {
        sku: "NURA-MOI-BARRIER-50",
        name: "50 ml",
        optionType: "size",
        sizeMl: 50,
        priceCents: 3800,
        costCents: 700,
        replenishDays: 56,
        weightGrams: 210,
        isDefault: true,
        onHand: 300,
      },
      {
        sku: "NURA-MOI-BARRIER-100R",
        name: "100 ml refill",
        optionType: "size",
        sizeMl: 100,
        priceCents: 5800,
        costCents: 1000,
        replenishDays: 112,
        weightGrams: 130,
        onHand: 90,
      },
    ],
  },
  {
    slug: "water-gel-cream",
    name: "Water Gel Cream",
    subtitle: "Oil-Free Ectoin Gel Moisturizer",
    category: "moisturizers",
    routineSlot: "MOISTURIZE",
    timeOfDay: "BOTH",
    skinTypes: ["OILY", "COMBINATION", "NORMAL"],
    textures: ["gel", "gel-cream"],
    pregnancySafe: true,
    fragranceFree: true,
    vegan: true,
    nonComedogenic: true,
    strengthLevel: 1,
    shortDescription:
      "A bouncy, oil-free gel that hydrates and calms without shine. Made for oily and combination skin.",
    description:
      "Ectoin and squalane lock in water and protect against daily stress while leaving a fresh, matte finish.",
    howToUse: "Apply morning and evening after serum. Layer a little extra on dry areas.",
    inci: [
      { ingredient: "water" },
      { ingredient: "glycerin" },
      { ingredient: "squalane" },
      { ingredient: "ectoin", key: true, bp: 100 },
      { ingredient: "sodium-hyaluronate" },
      { ingredient: "propanediol" },
      { ingredient: "xanthan-gum" },
      ...BASE_PRESERVATIVES,
    ],
    concerns: [
      ["dehydration", 3],
      ["oiliness", 1],
      ["sensitivity", 1],
    ],
    variants: [
      {
        sku: "NURA-MOI-WATERGEL-50",
        name: "50 ml",
        optionType: "size",
        sizeMl: 50,
        priceCents: 3400,
        costCents: 600,
        replenishDays: 56,
        weightGrams: 200,
        isDefault: true,
        onHand: 280,
      },
      {
        sku: "NURA-MOI-WATERGEL-100R",
        name: "100 ml refill",
        optionType: "size",
        sizeMl: 100,
        priceCents: 5200,
        costCents: 900,
        replenishDays: 112,
        weightGrams: 125,
        onHand: 75,
      },
    ],
  },
  {
    slug: "night-recovery-cream",
    name: "Night Recovery Cream",
    subtitle: "Peptide & Shea Night Cream",
    category: "moisturizers",
    routineSlot: "MOISTURIZE",
    timeOfDay: "PM",
    skinTypes: ["DRY", "NORMAL"],
    textures: ["cream", "rich"],
    pregnancySafe: true,
    fragranceFree: true,
    vegan: false,
    nonComedogenic: false,
    strengthLevel: 1,
    shortDescription:
      "A cocooning night cream with peptides and shea that supports firmness while you sleep.",
    description:
      "Two signal peptides support the look of firmness while shea and beeswax seal in moisture overnight. Contains beeswax, so it isn't vegan.",
    howToUse:
      "Evening. Warm a small amount between fingertips and press into skin as the last step.",
    inci: [
      { ingredient: "water" },
      { ingredient: "shea-butter" },
      { ingredient: "glycerin" },
      { ingredient: "squalane" },
      { ingredient: "cetearyl-alcohol" },
      { ingredient: "palmitoyl-tripeptide-1", key: true },
      { ingredient: "palmitoyl-tetrapeptide-7", key: true },
      { ingredient: "beeswax" },
      { ingredient: "tocopherol" },
      { ingredient: "phenoxyethanol" },
    ],
    concerns: [
      ["fine-lines", 2],
      ["dryness", 3],
    ],
    variants: [
      {
        sku: "NURA-MOI-NIGHT-50",
        name: "50 ml",
        optionType: "size",
        sizeMl: 50,
        priceCents: 5200,
        costCents: 950,
        replenishDays: 56,
        weightGrams: 230,
        isDefault: true,
        onHand: 150,
      },
    ],
  },
  {
    slug: "daily-veil-spf-50",
    name: "Daily Veil SPF 50",
    subtitle: "Invisible Hybrid Sunscreen",
    category: "sunscreens",
    routineSlot: "PROTECT",
    timeOfDay: "AM",
    skinTypes: ["DRY", "NORMAL", "COMBINATION", "OILY"],
    textures: ["fluid"],
    pregnancySafe: false,
    fragranceFree: true,
    vegan: true,
    nonComedogenic: true,
    strengthLevel: 1,
    isFeatured: true,
    featuredPosition: 4,
    badges: ["bestseller"],
    shortDescription:
      "A weightless, invisible SPF 50 fluid with niacinamide. No white cast, no greasy finish, just daily protection.",
    description:
      "A hybrid of mineral and chemical filters for broad-spectrum SPF 50 that disappears on every skin tone. 2% niacinamide supports an even complexion.",
    howToUse:
      "Morning, last step. Apply two finger-lengths to face and neck. Reapply every two hours in the sun.",
    inci: [
      { ingredient: "zinc-oxide", key: true, bp: 1000 },
      { ingredient: "octisalate", key: true, bp: 500 },
      { ingredient: "avobenzone", key: true, bp: 300 },
      { ingredient: "water" },
      { ingredient: "glycerin" },
      { ingredient: "niacinamide", key: true, bp: 200 },
      { ingredient: "caprylic-capric-triglyceride" },
      { ingredient: "dimethicone" },
      ...BASE_PRESERVATIVES,
    ],
    concerns: [
      ["pigmentation", 2],
      ["fine-lines", 2],
      ["redness", 1],
    ],
    variants: [
      {
        sku: "NURA-SPF-VEIL-50",
        name: "50 ml",
        optionType: "size",
        sizeMl: 50,
        priceCents: 3600,
        costCents: 650,
        replenishDays: 35,
        weightGrams: 95,
        isDefault: true,
        onHand: 460,
      },
    ],
  },
  {
    slug: "mineral-shield-spf-50",
    name: "Mineral Shield SPF 50",
    subtitle: "20% Zinc Oxide Mineral Sunscreen",
    category: "sunscreens",
    routineSlot: "PROTECT",
    timeOfDay: "AM",
    skinTypes: ["DRY", "NORMAL", "COMBINATION", "OILY"],
    textures: ["cream"],
    pregnancySafe: true,
    fragranceFree: true,
    vegan: true,
    nonComedogenic: true,
    strengthLevel: 1,
    shortDescription:
      "A 100% mineral SPF 50 for sensitive skin and pregnancy. Sheer, comfortable, reef-conscious.",
    description:
      "20% zinc oxide gives gentle broad-spectrum protection that suits reactive and rosacea-prone skin. Squalane keeps it comfortable.",
    howToUse:
      "Morning, last step. Apply two finger-lengths and blend well. Reapply every two hours in the sun.",
    inci: [
      { ingredient: "zinc-oxide", key: true, bp: 2000 },
      { ingredient: "water" },
      { ingredient: "caprylic-capric-triglyceride" },
      { ingredient: "glycerin" },
      { ingredient: "squalane" },
      { ingredient: "polyglyceryl-4-oleate" },
      { ingredient: "tocopherol" },
      ...BASE_PRESERVATIVES,
    ],
    concerns: [
      ["sensitivity", 2],
      ["pigmentation", 2],
      ["redness", 2],
      ["fine-lines", 2],
    ],
    variants: [
      {
        sku: "NURA-SPF-MINERAL-50",
        name: "50 ml",
        optionType: "size",
        sizeMl: 50,
        priceCents: 3800,
        costCents: 720,
        replenishDays: 35,
        weightGrams: 100,
        isDefault: true,
        onHand: 22,
        lowStockThreshold: 30,
      },
    ],
  },
  {
    slug: "tinted-glow-spf-30",
    name: "Tinted Glow SPF 30",
    subtitle: "Mineral Tinted Sunscreen",
    category: "sunscreens",
    routineSlot: "PROTECT",
    timeOfDay: "AM",
    skinTypes: ["DRY", "NORMAL", "COMBINATION", "OILY"],
    textures: ["fluid", "tinted"],
    pregnancySafe: true,
    fragranceFree: true,
    vegan: true,
    nonComedogenic: true,
    strengthLevel: 1,
    shortDescription:
      "A sheer mineral tint that evens tone and protects in one step. Iron oxides add visible-light defense.",
    description:
      "Zinc oxide plus iron oxides for SPF 30 with a natural, skin-like glow. Three adaptable shades.",
    howToUse:
      "Morning, last step. Apply two finger-lengths and blend outward. Reapply every two hours in the sun.",
    inci: [
      { ingredient: "zinc-oxide", key: true, bp: 1500 },
      { ingredient: "water" },
      { ingredient: "caprylic-capric-triglyceride" },
      { ingredient: "glycerin" },
      { ingredient: "iron-oxides", key: true },
      { ingredient: "squalane" },
      { ingredient: "tocopherol" },
      ...BASE_PRESERVATIVES,
    ],
    concerns: [
      ["pigmentation", 2],
      ["dullness", 2],
      ["redness", 1],
    ],
    variants: [
      {
        sku: "NURA-SPF-TINT-LIGHT",
        name: "Light",
        optionType: "shade",
        shadeHex: "#E8C9AE",
        priceCents: 4000,
        costCents: 760,
        replenishDays: 35,
        weightGrams: 100,
        isDefault: true,
        onHand: 140,
      },
      {
        sku: "NURA-SPF-TINT-MEDIUM",
        name: "Medium",
        optionType: "shade",
        shadeHex: "#C49A74",
        priceCents: 4000,
        costCents: 760,
        replenishDays: 35,
        weightGrams: 100,
        onHand: 120,
      },
      {
        sku: "NURA-SPF-TINT-DEEP",
        name: "Deep",
        optionType: "shade",
        shadeHex: "#7A5237",
        priceCents: 4000,
        costCents: 760,
        replenishDays: 35,
        weightGrams: 100,
        onHand: 0,
      },
    ],
  },
];

export const BUNDLES: BundleSeed[] = [
  {
    slug: "barrier-rescue-routine",
    name: "Barrier Rescue Routine",
    subtitle: "For dry, sensitive & reactive skin",
    shortDescription:
      "Four gentle, fragrance-free steps that calm reactive skin and rebuild a stressed barrier.",
    description:
      "Cleanse without stripping, flood with hydration, replenish lipids and protect with mineral SPF. Pregnancy-friendly.",
    howToUse: "AM: cleanser, serum, cream, SPF. PM: cleanser, serum, cream.",
    sku: "NURA-RTN-BARRIER",
    priceCents: 11800,
    costCents: 2600,
    isFeatured: true,
    featuredPosition: 1,
    items: [
      { sku: "NURA-CLN-CLOUD-150", timeOfDay: "BOTH", stepOrder: 1 },
      { sku: "NURA-SER-DEW-30", timeOfDay: "BOTH", stepOrder: 2 },
      { sku: "NURA-MOI-BARRIER-50", timeOfDay: "BOTH", stepOrder: 3 },
      { sku: "NURA-SPF-MINERAL-50", timeOfDay: "AM", stepOrder: 4 },
    ],
  },
  {
    slug: "clear-skin-routine",
    name: "Clear Skin Routine",
    subtitle: "For oily & breakout-prone skin",
    shortDescription: "Clear pores, balance oil and fade marks with four steps that work together.",
    description:
      "Salicylic acid cleanser, 10% niacinamide, an oil-free gel moisturizer and an invisible SPF.",
    howToUse: "AM: cleanser, serum, gel cream, SPF. PM: cleanser, serum, gel cream.",
    sku: "NURA-RTN-CLEAR",
    priceCents: 11000,
    costCents: 2300,
    isFeatured: true,
    featuredPosition: 2,
    items: [
      { sku: "NURA-CLN-CLARIFY-150", timeOfDay: "BOTH", stepOrder: 1 },
      { sku: "NURA-SER-CLEAR-30", timeOfDay: "BOTH", stepOrder: 2 },
      { sku: "NURA-MOI-WATERGEL-50", timeOfDay: "BOTH", stepOrder: 3 },
      { sku: "NURA-SPF-VEIL-50", timeOfDay: "AM", stepOrder: 4 },
    ],
  },
  {
    slug: "glow-routine",
    name: "Glow Routine",
    subtitle: "For dull, uneven skin",
    shortDescription: "Melt away the day, brighten with vitamin C and protect your glow.",
    description: "A cleansing balm, 15% vitamin C serum, oil-free hydration and daily SPF 50.",
    howToUse: "AM: vitamin C, gel cream, SPF. PM: balm, gel cream.",
    sku: "NURA-RTN-GLOW",
    priceCents: 13400,
    costCents: 2850,
    isFeatured: true,
    featuredPosition: 3,
    items: [
      { sku: "NURA-CLN-MELT-100", timeOfDay: "PM", stepOrder: 1 },
      { sku: "NURA-SER-GLOW-30", timeOfDay: "AM", stepOrder: 2 },
      { sku: "NURA-MOI-WATERGEL-50", timeOfDay: "BOTH", stepOrder: 3 },
      { sku: "NURA-SPF-VEIL-50", timeOfDay: "AM", stepOrder: 4 },
    ],
  },
  {
    slug: "age-renewal-routine",
    name: "Age Renewal Routine",
    subtitle: "For fine lines & texture",
    shortDescription:
      "Vitamin C by day, retinal by night, rich repair and SPF: the proven anti-aging routine, done right.",
    description:
      "Five steps split across morning and evening so actives never clash. Not suitable during pregnancy.",
    howToUse: "AM: cleanser, vitamin C, SPF. PM: cleanser, retinal (start 2–3×/week), night cream.",
    sku: "NURA-RTN-AGE",
    priceCents: 18900,
    costCents: 4000,
    items: [
      { sku: "NURA-CLN-CLOUD-150", timeOfDay: "BOTH", stepOrder: 1 },
      { sku: "NURA-SER-GLOW-30", timeOfDay: "AM", stepOrder: 2 },
      { sku: "NURA-SER-RENEW-30", timeOfDay: "PM", stepOrder: 3 },
      { sku: "NURA-MOI-NIGHT-50", timeOfDay: "PM", stepOrder: 4 },
      { sku: "NURA-SPF-VEIL-50", timeOfDay: "AM", stepOrder: 5 },
    ],
  },
  {
    slug: "starter-duo",
    name: "Starter Duo",
    subtitle: "The two steps everyone needs",
    shortDescription: "A gentle cleanser and a daily SPF: the foundation of every good routine.",
    description: "Start here, then add treatments when you're ready.",
    howToUse: "AM: cleanser, SPF. PM: cleanser.",
    sku: "NURA-RTN-DUO",
    priceCents: 5400,
    costCents: 1170,
    items: [
      { sku: "NURA-CLN-CLOUD-150", timeOfDay: "BOTH", stepOrder: 1 },
      { sku: "NURA-SPF-VEIL-50", timeOfDay: "AM", stepOrder: 2 },
    ],
  },
];

export const STORE_SETTINGS: Record<string, unknown> = {
  "shipping.flat_rate_cents": 650,
  "shipping.free_threshold_cents": 6000,
  "subscription.discount_bp": 1500,
  "subscription.intervals_weeks": [4, 8, 12],
  "routine.discount_bp": 1000,
  "routine.min_lines": 3,
  "pricing.max_line_discount_bp": 2500,
  "finder.enabled": true,
  "finder.prompt_version": "v1",
  "announcement.bar": [
    "Free shipping over $60, always free on Routine Plans",
    "Subscribers save 15% on every delivery",
  ],
};

export const ROLES = [
  { key: "CUSTOMER", name: "Customer" },
  { key: "SUPPORT", name: "Support" },
  { key: "MARKETING_MANAGER", name: "Marketing Manager" },
  { key: "INVENTORY_MANAGER", name: "Inventory Manager" },
  { key: "ADMIN", name: "Admin" },
  { key: "DEMO_STAFF", name: "Demo Staff" },
] as const;
