/**
 * Ingredient knowledge base: the data the routine engine reasons over (docs/12 §5).
 * Deliberately conservative: pregnancySafe = null means "unknown" and the engine treats it
 * as NOT safe. Values are portfolio-grade approximations of the cosmetic-science consensus
 * and should get a domain-expert review before any real-world use (review §6 checklist).
 */

export type ConcernSlug =
  | "acne"
  | "post-acne-marks"
  | "dullness"
  | "pigmentation"
  | "redness"
  | "dryness"
  | "dehydration"
  | "oiliness"
  | "pores"
  | "fine-lines"
  | "texture"
  | "sensitivity";

export type ConcernSeed = { slug: ConcernSlug; name: string; description: string; iconKey: string };

export const CONCERNS: ConcernSeed[] = [
  {
    slug: "acne",
    name: "Breakouts",
    iconKey: "ICN-CONCERN-ACNE",
    description:
      "Clogged pores, blemishes and the occasional breakout. Gentle exfoliation and oil balance help most.",
  },
  {
    slug: "post-acne-marks",
    name: "Post-acne marks",
    iconKey: "ICN-CONCERN-MARKS",
    description:
      "Flat marks left behind after a blemish heals. They fade with time, sun protection and brightening ingredients.",
  },
  {
    slug: "dullness",
    name: "Dullness",
    iconKey: "ICN-CONCERN-DULLNESS",
    description:
      "Skin that looks tired or lacks radiance. Antioxidants and gentle renewal restore glow.",
  },
  {
    slug: "pigmentation",
    name: "Dark spots",
    iconKey: "ICN-CONCERN-PIGMENTATION",
    description:
      "Uneven tone and dark spots from sun or inflammation. Daily SPF is the foundation.",
  },
  {
    slug: "redness",
    name: "Redness",
    iconKey: "ICN-CONCERN-REDNESS",
    description: "Flushing or persistent redness. Calming ingredients and a minimal routine help.",
  },
  {
    slug: "dryness",
    name: "Dryness",
    iconKey: "ICN-CONCERN-DRYNESS",
    description: "Tight, flaky skin that lacks oil. Barrier lipids like ceramides replenish it.",
  },
  {
    slug: "dehydration",
    name: "Dehydration",
    iconKey: "ICN-CONCERN-DEHYDRATION",
    description:
      "Skin that lacks water. Any skin type can be dehydrated. Humectants draw water in.",
  },
  {
    slug: "oiliness",
    name: "Excess oil",
    iconKey: "ICN-CONCERN-OILINESS",
    description:
      "Shine that builds through the day. Oil-balancing ingredients and light textures help.",
  },
  {
    slug: "pores",
    name: "Visible pores",
    iconKey: "ICN-CONCERN-PORES",
    description: "Pores that look enlarged or congested. Keeping them clear minimizes their look.",
  },
  {
    slug: "fine-lines",
    name: "Fine lines",
    iconKey: "ICN-CONCERN-LINES",
    description: "Early lines and loss of bounce. Retinoids, peptides and SPF are the proven trio.",
  },
  {
    slug: "texture",
    name: "Uneven texture",
    iconKey: "ICN-CONCERN-TEXTURE",
    description: "Rough or bumpy skin. Gentle cell turnover smooths it over weeks.",
  },
  {
    slug: "sensitivity",
    name: "Sensitivity",
    iconKey: "ICN-CONCERN-SENSITIVITY",
    description:
      "Skin that stings or reacts easily. Fewer, gentler, fragrance-free products work best.",
  },
];

export type IngredientSeed = {
  slug: string;
  inciName: string;
  commonName: string;
  aliases?: string[];
  category: string;
  isActive?: boolean;
  pregnancySafe: boolean | null;
  isFragrance?: boolean;
  isAnimalDerived?: boolean;
  irritancyLevel: 0 | 1 | 2 | 3;
  description: string;
  benefits?: string[];
  cautions?: string;
};

export const INGREDIENTS: IngredientSeed[] = [
  // ── Key actives ────────────────────────────────────────────────────────────
  {
    slug: "niacinamide",
    inciName: "Niacinamide",
    commonName: "Vitamin B3",
    aliases: ["nicotinamide", "vitamin b3"],
    category: "vitamin",
    isActive: true,
    pregnancySafe: true,
    irritancyLevel: 1,
    description: "Balances oil, supports the skin barrier and visibly evens tone.",
    benefits: ["oil balance", "barrier support", "even tone"],
  },
  {
    slug: "zinc-pca",
    inciName: "Zinc PCA",
    commonName: "Zinc PCA",
    category: "oil-control",
    isActive: true,
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "A zinc salt that helps regulate excess oil.",
    benefits: ["oil control"],
  },
  {
    slug: "salicylic-acid",
    inciName: "Salicylic Acid",
    commonName: "Salicylic acid (BHA)",
    aliases: ["bha", "beta hydroxy acid"],
    category: "exfoliant-bha",
    isActive: true,
    pregnancySafe: false,
    irritancyLevel: 2,
    description: "An oil-soluble exfoliant that clears inside pores and reduces breakouts.",
    benefits: ["unclogs pores", "fewer breakouts"],
    cautions:
      "Avoid during pregnancy in leave-on products; don't layer with retinoids in the same routine.",
  },
  {
    slug: "sodium-hyaluronate",
    inciName: "Sodium Hyaluronate",
    commonName: "Hyaluronic acid",
    aliases: ["hyaluronic acid", "ha"],
    category: "humectant",
    isActive: true,
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "Draws water into the skin for plump, bouncy hydration.",
    benefits: ["hydration", "plumpness"],
  },
  {
    slug: "panthenol",
    inciName: "Panthenol",
    commonName: "Pro-vitamin B5",
    aliases: ["vitamin b5", "d-panthenol"],
    category: "soothing",
    isActive: true,
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "Soothes and hydrates while supporting barrier repair.",
    benefits: ["soothing", "hydration"],
  },
  {
    slug: "ethyl-ascorbic-acid",
    inciName: "3-O-Ethyl Ascorbic Acid",
    commonName: "Vitamin C",
    aliases: ["vitamin c", "ethyl ascorbic acid"],
    category: "antioxidant",
    isActive: true,
    pregnancySafe: true,
    irritancyLevel: 1,
    description: "A stable vitamin C that brightens and fades dark spots over 8–12 weeks.",
    benefits: ["brightening", "antioxidant"],
    cautions: "Use in the morning; keep separate from retinoids.",
  },
  {
    slug: "ferulic-acid",
    inciName: "Ferulic Acid",
    commonName: "Ferulic acid",
    category: "antioxidant",
    isActive: true,
    pregnancySafe: true,
    irritancyLevel: 1,
    description: "An antioxidant that stabilizes and boosts vitamin C.",
    benefits: ["antioxidant"],
  },
  {
    slug: "tocopherol",
    inciName: "Tocopherol",
    commonName: "Vitamin E",
    aliases: ["vitamin e"],
    category: "antioxidant",
    isActive: true,
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "A skin-softening antioxidant.",
    benefits: ["antioxidant", "softening"],
  },
  {
    slug: "retinal",
    inciName: "Retinal",
    commonName: "Retinaldehyde",
    aliases: ["retinaldehyde", "retinoid", "vitamin a"],
    category: "retinoid",
    isActive: true,
    pregnancySafe: false,
    irritancyLevel: 3,
    description: "A fast-acting retinoid that smooths texture and softens fine lines.",
    benefits: ["smoother texture", "fewer fine lines"],
    cautions: "Not for use during pregnancy or breastfeeding. Start slowly; always use SPF.",
  },
  {
    slug: "azelaic-acid",
    inciName: "Azelaic Acid",
    commonName: "Azelaic acid",
    category: "exfoliant-other",
    isActive: true,
    pregnancySafe: true,
    irritancyLevel: 1,
    description:
      "Calms redness, clears pores and fades post-acne marks. Gentle enough for sensitive skin.",
    benefits: ["calms redness", "fades marks"],
  },
  {
    slug: "centella-asiatica",
    inciName: "Centella Asiatica Extract",
    commonName: "Cica",
    aliases: ["cica", "gotu kola"],
    category: "soothing",
    isActive: true,
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "A botanical that calms and comforts reactive skin.",
    benefits: ["soothing"],
  },
  {
    slug: "ceramide-np",
    inciName: "Ceramide NP",
    commonName: "Ceramides",
    aliases: ["ceramides", "ceramide 3"],
    category: "barrier-lipid",
    isActive: true,
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "Skin-identical lipids that rebuild a dry, compromised barrier.",
    benefits: ["barrier repair"],
  },
  {
    slug: "cholesterol",
    inciName: "Cholesterol",
    commonName: "Cholesterol",
    category: "barrier-lipid",
    isActive: true,
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "A barrier lipid that works with ceramides and fatty acids.",
    benefits: ["barrier repair"],
  },
  {
    slug: "squalane",
    inciName: "Squalane",
    commonName: "Squalane",
    category: "emollient",
    isActive: true,
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "A weightless, skin-like oil that softens without clogging.",
    benefits: ["softening", "moisture"],
  },
  {
    slug: "ectoin",
    inciName: "Ectoin",
    commonName: "Ectoin",
    category: "soothing",
    isActive: true,
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "A protective molecule that holds water and calms stressed skin.",
    benefits: ["hydration", "soothing"],
  },
  {
    slug: "palmitoyl-tripeptide-1",
    inciName: "Palmitoyl Tripeptide-1",
    commonName: "Peptide",
    aliases: ["peptides"],
    category: "peptide",
    isActive: true,
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "A signal peptide that supports firmness.",
    benefits: ["firmness"],
  },
  {
    slug: "palmitoyl-tetrapeptide-7",
    inciName: "Palmitoyl Tetrapeptide-7",
    commonName: "Peptide",
    aliases: ["peptides"],
    category: "peptide",
    isActive: true,
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "A peptide that helps calm and support mature skin.",
    benefits: ["firmness", "calming"],
  },
  {
    slug: "zinc-oxide",
    inciName: "Zinc Oxide",
    commonName: "Mineral UV filter",
    aliases: ["mineral sunscreen"],
    category: "uv-filter",
    isActive: true,
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "A gentle mineral filter that protects against UVA and UVB.",
    benefits: ["broad-spectrum protection"],
  },
  {
    slug: "avobenzone",
    inciName: "Butyl Methoxydibenzoylmethane",
    commonName: "Avobenzone",
    aliases: ["avobenzone"],
    category: "uv-filter",
    isActive: true,
    pregnancySafe: null,
    irritancyLevel: 1,
    description: "A chemical filter that absorbs UVA light.",
    benefits: ["UVA protection"],
  },
  {
    slug: "octisalate",
    inciName: "Ethylhexyl Salicylate",
    commonName: "Octisalate",
    aliases: ["octisalate"],
    category: "uv-filter",
    isActive: true,
    pregnancySafe: null,
    irritancyLevel: 1,
    description: "A chemical filter that absorbs UVB light.",
    benefits: ["UVB protection"],
  },
  {
    slug: "colloidal-oatmeal",
    inciName: "Avena Sativa Kernel Flour",
    commonName: "Colloidal oatmeal",
    aliases: ["oat", "oatmeal"],
    category: "soothing",
    isActive: true,
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "Finely milled oat that soothes and protects dry, itchy skin.",
    benefits: ["soothing"],
  },
  {
    slug: "iron-oxides",
    inciName: "Iron Oxides",
    commonName: "Mineral pigments",
    category: "colorant",
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "Mineral pigments that tint and add visible-light protection.",
  },

  // ── Supporting ingredients ─────────────────────────────────────────────────
  {
    slug: "water",
    inciName: "Aqua",
    commonName: "Water",
    aliases: ["water"],
    category: "solvent",
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "The base of most formulas.",
  },
  {
    slug: "glycerin",
    inciName: "Glycerin",
    commonName: "Glycerin",
    category: "humectant",
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "A classic humectant that keeps skin hydrated.",
  },
  {
    slug: "propanediol",
    inciName: "Propanediol",
    commonName: "Propanediol",
    category: "humectant",
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "A plant-derived humectant and solvent.",
  },
  {
    slug: "coco-glucoside",
    inciName: "Coco-Glucoside",
    commonName: "Coco-glucoside",
    category: "surfactant",
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "A mild, sugar-derived cleanser.",
  },
  {
    slug: "sodium-lauroyl-methyl-isethionate",
    inciName: "Sodium Lauroyl Methyl Isethionate",
    commonName: "Gentle surfactant",
    category: "surfactant",
    pregnancySafe: true,
    irritancyLevel: 1,
    description: "A gentle, foaming, sulfate-free cleanser.",
  },
  {
    slug: "oat-kernel-oil",
    inciName: "Avena Sativa Kernel Oil",
    commonName: "Oat oil",
    category: "emollient",
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "A lipid-rich oil that cushions dry skin.",
  },
  {
    slug: "sunflower-seed-oil",
    inciName: "Helianthus Annuus Seed Oil",
    commonName: "Sunflower seed oil",
    category: "emollient",
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "A light oil rich in linoleic acid that dissolves makeup and SPF.",
  },
  {
    slug: "caprylic-capric-triglyceride",
    inciName: "Caprylic/Capric Triglyceride",
    commonName: "Coconut-derived emollient",
    category: "emollient",
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "A silky emollient.",
  },
  {
    slug: "shea-butter",
    inciName: "Butyrospermum Parkii Butter",
    commonName: "Shea butter",
    aliases: ["shea"],
    category: "emollient",
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "A rich butter that seals in moisture.",
  },
  {
    slug: "beeswax",
    inciName: "Cera Alba",
    commonName: "Beeswax",
    category: "emollient",
    pregnancySafe: true,
    isAnimalDerived: true,
    irritancyLevel: 0,
    description: "A protective wax (animal-derived: not vegan).",
  },
  {
    slug: "cetearyl-alcohol",
    inciName: "Cetearyl Alcohol",
    commonName: "Fatty alcohol",
    category: "emulsifier",
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "A non-drying fatty alcohol that stabilizes creams.",
  },
  {
    slug: "polyglyceryl-4-oleate",
    inciName: "Polyglyceryl-4 Oleate",
    commonName: "Emulsifier",
    category: "emulsifier",
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "Helps oils rinse off cleanly.",
  },
  {
    slug: "dimethicone",
    inciName: "Dimethicone",
    commonName: "Silicone",
    category: "emollient",
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "Gives a smooth, breathable finish.",
  },
  {
    slug: "allantoin",
    inciName: "Allantoin",
    commonName: "Allantoin",
    category: "soothing",
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "A soothing, skin-conditioning ingredient.",
  },
  {
    slug: "xanthan-gum",
    inciName: "Xanthan Gum",
    commonName: "Xanthan gum",
    category: "thickener",
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "A natural thickener.",
  },
  {
    slug: "citric-acid",
    inciName: "Citric Acid",
    commonName: "Citric acid",
    category: "ph-adjuster",
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "Adjusts pH in tiny amounts.",
  },
  {
    slug: "phenoxyethanol",
    inciName: "Phenoxyethanol",
    commonName: "Preservative",
    category: "preservative",
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "A widely used, well-tolerated preservative.",
  },
  {
    slug: "ethylhexylglycerin",
    inciName: "Ethylhexylglycerin",
    commonName: "Preservative booster",
    category: "preservative",
    pregnancySafe: true,
    irritancyLevel: 0,
    description: "Boosts preservation and conditions skin.",
  },
  {
    slug: "fragrance",
    inciName: "Parfum",
    commonName: "Fragrance",
    aliases: ["parfum", "perfume"],
    category: "fragrance",
    isFragrance: true,
    pregnancySafe: true,
    irritancyLevel: 2,
    description: "Added scent. Excluded automatically for sensitive or fragrance-free profiles.",
  },
];

export type IngredientConcernSeed = {
  ingredient: string;
  concern: ConcernSlug;
  evidence: 1 | 2 | 3;
  minEffectiveBp?: number;
};

export const INGREDIENT_CONCERNS: IngredientConcernSeed[] = [
  { ingredient: "niacinamide", concern: "oiliness", evidence: 3, minEffectiveBp: 200 },
  { ingredient: "niacinamide", concern: "pores", evidence: 2, minEffectiveBp: 200 },
  { ingredient: "niacinamide", concern: "acne", evidence: 2, minEffectiveBp: 200 },
  { ingredient: "niacinamide", concern: "post-acne-marks", evidence: 2, minEffectiveBp: 200 },
  { ingredient: "niacinamide", concern: "pigmentation", evidence: 2, minEffectiveBp: 200 },
  { ingredient: "niacinamide", concern: "redness", evidence: 2, minEffectiveBp: 200 },
  { ingredient: "niacinamide", concern: "dullness", evidence: 1 },
  { ingredient: "zinc-pca", concern: "oiliness", evidence: 2 },
  { ingredient: "zinc-pca", concern: "acne", evidence: 1 },
  { ingredient: "salicylic-acid", concern: "acne", evidence: 3, minEffectiveBp: 50 },
  { ingredient: "salicylic-acid", concern: "pores", evidence: 3, minEffectiveBp: 50 },
  { ingredient: "salicylic-acid", concern: "texture", evidence: 2, minEffectiveBp: 50 },
  { ingredient: "salicylic-acid", concern: "oiliness", evidence: 2 },
  { ingredient: "sodium-hyaluronate", concern: "dehydration", evidence: 3, minEffectiveBp: 10 },
  { ingredient: "sodium-hyaluronate", concern: "dryness", evidence: 2 },
  { ingredient: "sodium-hyaluronate", concern: "fine-lines", evidence: 1 },
  { ingredient: "panthenol", concern: "sensitivity", evidence: 2, minEffectiveBp: 100 },
  { ingredient: "panthenol", concern: "dehydration", evidence: 2 },
  { ingredient: "panthenol", concern: "redness", evidence: 1 },
  { ingredient: "ethyl-ascorbic-acid", concern: "dullness", evidence: 3, minEffectiveBp: 200 },
  { ingredient: "ethyl-ascorbic-acid", concern: "pigmentation", evidence: 2, minEffectiveBp: 200 },
  {
    ingredient: "ethyl-ascorbic-acid",
    concern: "post-acne-marks",
    evidence: 2,
    minEffectiveBp: 200,
  },
  { ingredient: "ethyl-ascorbic-acid", concern: "fine-lines", evidence: 1 },
  { ingredient: "ferulic-acid", concern: "dullness", evidence: 1 },
  { ingredient: "retinal", concern: "fine-lines", evidence: 3, minEffectiveBp: 3 },
  { ingredient: "retinal", concern: "texture", evidence: 3, minEffectiveBp: 3 },
  { ingredient: "retinal", concern: "acne", evidence: 2, minEffectiveBp: 3 },
  { ingredient: "retinal", concern: "pigmentation", evidence: 2, minEffectiveBp: 3 },
  { ingredient: "retinal", concern: "post-acne-marks", evidence: 2, minEffectiveBp: 3 },
  { ingredient: "azelaic-acid", concern: "redness", evidence: 3, minEffectiveBp: 1000 },
  { ingredient: "azelaic-acid", concern: "post-acne-marks", evidence: 3, minEffectiveBp: 1000 },
  { ingredient: "azelaic-acid", concern: "acne", evidence: 2, minEffectiveBp: 1000 },
  { ingredient: "azelaic-acid", concern: "pigmentation", evidence: 2, minEffectiveBp: 1000 },
  { ingredient: "azelaic-acid", concern: "texture", evidence: 1 },
  { ingredient: "centella-asiatica", concern: "redness", evidence: 2 },
  { ingredient: "centella-asiatica", concern: "sensitivity", evidence: 2 },
  { ingredient: "ceramide-np", concern: "dryness", evidence: 3 },
  { ingredient: "ceramide-np", concern: "sensitivity", evidence: 2 },
  { ingredient: "cholesterol", concern: "dryness", evidence: 2 },
  { ingredient: "squalane", concern: "dryness", evidence: 2 },
  { ingredient: "squalane", concern: "dehydration", evidence: 1 },
  { ingredient: "ectoin", concern: "sensitivity", evidence: 2 },
  { ingredient: "ectoin", concern: "dehydration", evidence: 1 },
  { ingredient: "ectoin", concern: "redness", evidence: 1 },
  { ingredient: "palmitoyl-tripeptide-1", concern: "fine-lines", evidence: 2 },
  { ingredient: "palmitoyl-tetrapeptide-7", concern: "fine-lines", evidence: 2 },
  { ingredient: "colloidal-oatmeal", concern: "sensitivity", evidence: 2 },
  { ingredient: "colloidal-oatmeal", concern: "dryness", evidence: 2 },
  { ingredient: "colloidal-oatmeal", concern: "redness", evidence: 1 },
  { ingredient: "zinc-oxide", concern: "pigmentation", evidence: 2 },
  { ingredient: "zinc-oxide", concern: "fine-lines", evidence: 2 },
  { ingredient: "zinc-oxide", concern: "sensitivity", evidence: 1 },
  { ingredient: "zinc-oxide", concern: "redness", evidence: 1 },
  { ingredient: "shea-butter", concern: "dryness", evidence: 2 },
  { ingredient: "glycerin", concern: "dehydration", evidence: 2 },
  { ingredient: "glycerin", concern: "dryness", evidence: 1 },
];

export type ConflictSeverity = "avoid_same_routine" | "avoid_same_day" | "caution";

export type IngredientConflictSeed = {
  a: string;
  b: string;
  severity: ConflictSeverity;
  reason: string;
};

/** Note: vitamin C + niacinamide is intentionally NOT a conflict (a persistent myth). */
export const INGREDIENT_CONFLICTS: IngredientConflictSeed[] = [
  {
    a: "retinal",
    b: "salicylic-acid",
    severity: "avoid_same_routine",
    reason:
      "Both speed up cell turnover. Together they can over-exfoliate and irritate, so use them at different times of day.",
  },
  {
    a: "retinal",
    b: "ethyl-ascorbic-acid",
    severity: "avoid_same_routine",
    reason:
      "Vitamin C works best in the morning and retinal at night. Layering them together adds irritation without extra benefit.",
  },
  {
    a: "retinal",
    b: "azelaic-acid",
    severity: "caution",
    reason:
      "Both are active. Fine together once your skin is used to each, but introduce them one at a time.",
  },
  {
    a: "ethyl-ascorbic-acid",
    b: "salicylic-acid",
    severity: "caution",
    reason: "Two acidic actives in one routine can sting sensitive skin. Start on alternate days.",
  },
];
