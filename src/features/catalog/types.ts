/**
 * Catalogue DTOs (docs/09 §4, docs/16 §5). Plain, serializable shapes: they cross `"use cache"`
 * boundaries and the RSC → client boundary, so no Prisma `Decimal` or `Date` instances.
 */
export type SkinTypeKey = "DRY" | "OILY" | "COMBINATION" | "NORMAL";
export type SlotKey = "CLEANSE" | "TREAT" | "MOISTURIZE" | "PROTECT";
export type TimeKey = "AM" | "PM" | "BOTH";

export type ImageDTO = { publicId: string; width: number; height: number; alt: string };

export type CategoryRef = { slug: string; name: string };
export type ConcernRef = { slug: string; name: string };

export type ProductCardDTO = {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  shortDescription: string;
  type: "SINGLE" | "BUNDLE";
  category: CategoryRef;
  routineSlot: SlotKey | null;
  timeOfDay: TimeKey;
  skinTypes: SkinTypeKey[];
  concerns: (ConcernRef & { efficacy: number })[];
  fragranceFree: boolean;
  pregnancySafe: boolean;
  vegan: boolean;
  nonComedogenic: boolean;
  badges: string[];
  ratingAvg: number;
  ratingCount: number;
  unitsSold30d: number;
  isFeatured: boolean;
  featuredPosition: number | null;
  /** ISO timestamp. */
  publishedAt: string | null;
  priceFromCents: number;
  compareAtCents: number | null;
  variantCount: number;
  defaultVariantId: string | null;
  keyActives: string[];
  keyActiveSlugs: string[];
  image: ImageDTO | null;
};

export type VariantDTO = {
  id: string;
  sku: string;
  name: string;
  optionType: string;
  sizeMl: number | null;
  shadeHex: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  subscriptionEligible: boolean;
  replenishDays: number;
  isDefault: boolean;
};

export type ProductIngredientDTO = {
  slug: string;
  inciName: string;
  commonName: string;
  isKeyActive: boolean;
  /** Basis points (1000 = 10%). */
  concentrationBp: number | null;
  benefits: string[];
};

export type ConflictDTO = {
  severity: "avoid_same_routine" | "avoid_same_day" | "caution";
  reason: string;
  /** The ingredient in this product. */
  ingredient: { slug: string; commonName: string };
  /** The ingredient it clashes with. */
  other: { slug: string; commonName: string };
};

export type BundleStepDTO = {
  stepOrder: number;
  timeOfDay: TimeKey;
  quantity: number;
  variantId: string;
  product: Pick<
    ProductCardDTO,
    "slug" | "name" | "subtitle" | "routineSlot" | "image" | "category"
  >;
  variantName: string;
  priceCents: number;
};

export type ProductDetailDTO = ProductCardDTO & {
  description: string;
  howToUse: string;
  textures: string[];
  strengthLevel: number;
  seoTitle: string | null;
  seoDescription: string | null;
  variants: VariantDTO[];
  images: ImageDTO[];
  ingredients: ProductIngredientDTO[];
  conflicts: ConflictDTO[];
  /** Bundles only: component steps in order. */
  steps: BundleStepDTO[];
  updatedAt: string;
};

export type CategoryDTO = CategoryRef & {
  description: string | null;
  routineSlot: SlotKey | null;
  heroImageKey: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type ConcernDTO = ConcernRef & { description: string; iconKey: string };

export type IngredientSummaryDTO = {
  slug: string;
  inciName: string;
  commonName: string;
  category: string;
  isActive: boolean;
  benefits: string[];
};

export type IngredientDetailDTO = IngredientSummaryDTO & {
  aliases: string[];
  description: string | null;
  cautions: string | null;
  pregnancySafe: boolean | null;
  isFragrance: boolean;
  irritancyLevel: number;
  evidence: (ConcernRef & { evidence: number; minEffectiveBp: number | null })[];
  conflicts: {
    severity: ConflictDTO["severity"];
    reason: string;
    other: { slug: string; commonName: string };
  }[];
  productSlugs: string[];
};

export type ReviewDTO = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  skinType: string | null;
  verifiedPurchase: boolean;
  createdAt: string;
};

export type ReviewSummaryDTO = {
  average: number;
  count: number;
  /** Index 0 = 1 star … 4 = 5 stars. */
  distribution: [number, number, number, number, number];
};
