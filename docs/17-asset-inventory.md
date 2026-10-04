# 17 — Asset Inventory

Nura Skin is fictional, so **every image is purpose-made** from this inventory. The final product contains **no random stock photos and no placeholder images**. This is enforced technically:

- Every image in the UI is referenced by an **asset key** from `src/config/assets.ts` (key → Cloudinary publicId, alt, width, height).
- `scripts/check-asset-manifest.ts` runs in CI. It fails if code references a key that is missing from the manifest, or if a manifest entry's publicId doesn't exist in Cloudinary.
- Product images live in the DB (`ProductImage.publicId`), and **publishing a product requires ≥ 1 image with alt text**.
- A lint rule bans hard-coded image URLs (`https://` in `src` or `/images/*` paths).

---

## 1. Production workflow

1. **Generate** with an image model (Midjourney v7, Imagen, GPT-image, Flux or similar), using the prompts below plus the shared **style suffix** and **negative prompt** (§1.2). Generate 4–8 candidates per asset and pick one with the art-direction checklist.
2. **Labels:** AI models render text unreliably. Packaging is generated with **blank labels**, then the label artwork (wordmark, product name, key active %, step number) is **composited in post** (Figma/Photoshop smart-object label templates with perspective warp). This keeps typography crisp and on-brand.
3. **Retouch:** fix artefacts (hands, reflections, edges); colour-match to the palette using a shared LUT (`nura-warm.cube`); never smooth skin texture.
4. **Export masters:** PNG/TIFF at master size (sRGB). Packshots are exported twice: on porcelain `#FAF7F2` and with a **transparent background** (for the dark-mode plinth frame and OG composites).
5. **Upload** to Cloudinary `nura/brand/...` or `nura/products/{slug}/...`. Record it in the manifest with **alt text**. Delivery transforms come from Cloudinary (`f_auto,q_auto`, named transforms).
6. **Review** against the checklist: correct packaging colour code, consistent light direction (key light from the **left**), palette, no text artefacts, diverse representation across the set, no depiction of product results.

### 1.1 Naming convention

`{TYPE}-{GROUP}-{NN}[-{VARIANT}]` → e.g. `PRD-GLOW-SERUM-01-PACKSHOT`, `IMG-HERO-01-MOBILE`. Cloudinary publicId = lowercase kebab of the key under its folder.

### 1.2 Shared prompt components

**Style suffix (append to every photographic prompt):**

> _editorial beauty photography, soft diffused natural window light from the left, gentle soft shadows, warm neutral palette of porcelain white, linen, sand beige and muted terracotta clay, calm minimal composition with generous negative space, photorealistic, medium format camera, 85mm lens, f/5.6, high detail, subtle film grain, colour graded warm and soft, 5000K_

**Negative prompt (or "avoid" clause):**

> _text, letters, logos, brand names, watermark, extra bottles, duplicated objects, distorted packaging, warped labels, plastic-looking skin, heavy retouching, airbrushed skin, glitter, neon, saturated colours, flowers explosion, fruit splash, harsh flash, busy background, cluttered props, deformed hands, extra fingers_

**Packaging reference block** (used in product prompts; from 14 §5):

> _minimal premium skincare packaging, frosted glass or soft-touch matte aluminium, porcelain-white body, blank matte white label with no text, cap colour coded_

Cap colour codes: **Cleanse** = sand beige `#E4D9CA` · **Treat** = terracotta clay `#B8785A` · **Moisturize** = muted sage green `#7D8C6E` · **Protect** = deep dew teal `#4E6E6A`.

---

## 2. Product images

### 2.1 Shot set per product

| Shot                  | Suffix      | Master size   | Ratio | Purpose                                             | Where used                                                  |
| --------------------- | ----------- | ------------- | ----- | --------------------------------------------------- | ----------------------------------------------------------- |
| Packshot (front)      | `-PACKSHOT` | 2400×3000     | 4:5   | Primary product image; plain porcelain background   | ProductCard, PDP gallery #1, cart, emails, OG               |
| Angle / plinth        | `-ANGLE`    | 2400×3000     | 4:5   | 3/4 view on a travertine plinth with a shadow       | PDP gallery #2, card hover (optional)                       |
| Texture swatch        | `-TEXTURE`  | 2400×2400     | 1:1   | Macro of the formula texture                        | PDP gallery #3, **card hover on desktop**, ingredient story |
| In-hand / application | `-INHAND`   | 2400×3000     | 4:5   | Hand holding or dispensing the product; human scale | PDP gallery #4                                              |
| Transparent cut-out   | `-CUTOUT`   | 2000×2500 PNG | 4:5   | Packshot without a background                       | Dark-mode frames, OG composites, bundles, email rows        |

**Totals:** 14 products × 5 = 70 product masters + 2 extra shade packshots (Tinted Glow Medium/Deep) + 2 refill pouches + 1 travel mini = **75**.

### 2.2 Product packaging specification & packshot prompts

Each packshot prompt = _specific description_ + packaging reference block + _"standing upright, centered, on a seamless porcelain-white #FAF7F2 background, soft shadow falling to the right"_ + style suffix.

| Key                       | Product                        | Container & cap                                                                         | Packshot prompt (specific part)                                                                                                                                                                          | Alt text                                                     |
| ------------------------- | ------------------------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| PRD-CLOUD-MILK-01         | Cloud Milk Cleanser 150 ml     | Soft-touch matte porcelain-white aluminium squeeze tube, flip cap, **sand** cap         | "a 150ml soft-touch matte white aluminium squeeze tube standing on its sand-beige flip cap, blank white label, a tiny drop of milky white cleanser resting beside it"                                    | "Cloud Milk Cleanser, a white tube with a sand-coloured cap" |
| PRD-CLOUD-MILK-02         | Cloud Milk Cleanser 30 ml mini | Mini tube, sand cap                                                                     | "a small 30ml travel-size matte white squeeze tube with a sand-beige cap, blank label, next to a folded linen washcloth corner"                                                                          | "Cloud Milk Cleanser travel size"                            |
| PRD-CLARIFY-GEL-01        | Clarify Gel Cleanser 150 ml    | Frosted translucent tube (gel visible faintly), **sand** cap                            | "a 150ml frosted translucent squeeze tube with a faint clear gel visible inside, sand-beige flip cap, blank label, a few clear water droplets on the surface"                                            | "Clarify Gel Cleanser, a frosted tube with a sand cap"       |
| PRD-MELT-BALM-01          | Melt Cleansing Balm 100 ml     | Wide frosted glass jar, aluminium lid in **sand** anodized finish; small wooden spatula | "a wide low frosted glass jar with a sand-beige anodized aluminium lid set slightly ajar, revealing a golden-ivory solid cleansing balm, a small pale wooden spatula resting against it"                 | "Melt Cleansing Balm in a frosted glass jar"                 |
| PRD-DEW-SERUM-01          | Dew Serum 30 ml                | Frosted glass dropper bottle, **clay** collar, white bulb                               | "a 30ml frosted glass dropper bottle with a terracotta clay collar and a white rubber bulb, blank label, a single clear glossy serum droplet on the surface in front"                                    | "Dew Serum, frosted dropper bottle with a clay collar"       |
| PRD-CLEAR-SERUM-01        | Clear Serum 30 ml              | Frosted glass dropper, **clay** collar                                                  | "a 30ml frosted glass dropper bottle with a terracotta clay collar, blank label, the dropper pipette lying beside it with a drop of slightly milky translucent serum"                                    | "Clear Serum, frosted dropper bottle"                        |
| PRD-GLOW-SERUM-01         | Glow Serum 30 ml               | **Amber-tinted** frosted glass dropper (light-protective), **clay** collar              | "a 30ml amber-tinted frosted glass dropper bottle with a terracotta clay collar, blank white label, warm light glowing through the amber glass, a small golden serum droplet"                            | "Glow Serum, amber frosted dropper bottle"                   |
| PRD-RENEW-NIGHT-01        | Renew Night Serum 30 ml        | **Opaque** matte porcelain airless pump bottle (light-protective), **clay** pump        | "a 30ml opaque matte porcelain-white airless pump bottle with a terracotta clay pump head, blank label, subtle evening mood with slightly cooler dimmer light while staying in palette"                  | "Renew Night Serum, white airless pump with a clay pump"     |
| PRD-CALM-SERUM-01         | Calm Serum 30 ml               | Frosted glass dropper, **clay** collar; a centella leaf prop                            | "a 30ml frosted glass dropper bottle with a terracotta clay collar, blank label, a single fresh centella asiatica leaf lying beside it"                                                                  | "Calm Serum with a centella leaf"                            |
| PRD-BARRIER-CREAM-01      | Barrier Cream 50 ml            | Frosted glass jar, **sage** aluminium lid                                               | "a 50ml frosted glass cosmetic jar with a muted sage-green aluminium lid, blank label, lid leaning against the jar revealing a thick rich white cream with a soft swirl"                                 | "Barrier Cream, frosted jar with a sage lid"                 |
| PRD-BARRIER-CREAM-02      | Barrier Cream 100 ml refill    | Matte paper-laminate stand-up pouch, sage spout cap                                     | "a matte off-white paper-laminate stand-up refill pouch with a small muted sage-green spout cap, blank label, next to a frosted glass jar with a sage lid"                                               | "Barrier Cream refill pouch beside the jar"                  |
| PRD-WATER-GEL-01          | Water Gel Cream 50 ml          | Frosted glass jar, **sage** lid                                                         | "a 50ml frosted glass cosmetic jar with a muted sage-green aluminium lid, blank label, open to show a translucent bouncy light-blue-tinted gel cream, a few fresh water droplets around"                 | "Water Gel Cream, frosted jar with a sage lid"               |
| PRD-WATER-GEL-02          | Water Gel Cream 100 ml refill  | Pouch, sage spout                                                                       | "matte off-white stand-up refill pouch with a muted sage-green spout cap, blank label, a clear water droplet on its surface"                                                                             | "Water Gel Cream refill pouch"                               |
| PRD-NIGHT-RECOVERY-01     | Night Recovery Cream 50 ml     | Heavier frosted glass jar, **sage** lid with a debossed dew-drop                        | "a heavy-walled 50ml frosted glass jar with a muted sage-green lid featuring a small debossed teardrop symbol, blank label, a rich buttery ivory cream visible, a folded linen napkin in the background" | "Night Recovery Cream in a heavy frosted jar"                |
| PRD-DAILY-VEIL-01         | Daily Veil SPF 50              | Slim matte porcelain aluminium tube, **dew teal** cap                                   | "a slim 50ml matte white aluminium sunscreen tube with a deep dew-teal flip cap, blank label, a sharp crisp shadow suggesting bright sunlight, standing on its cap"                                      | "Daily Veil SPF 50, white tube with a teal cap"              |
| PRD-MINERAL-SHIELD-01     | Mineral Shield SPF 50          | Matte tube, **dew teal** cap, a smooth river stone prop                                 | "a 50ml matte white aluminium sunscreen tube with a deep dew-teal cap, blank label, resting against a smooth pale river stone, bright clean sunlight"                                                    | "Mineral Shield SPF 50 beside a pale stone"                  |
| PRD-TINTED-GLOW-01-LIGHT  | Tinted Glow SPF 30 (Light)     | Frosted glass pump bottle, **dew teal** pump; a tint swatch                             | "a 50ml frosted glass pump bottle with a deep dew-teal pump, blank label, a small smear of light ivory-beige tinted fluid on the surface beside it"                                                      | "Tinted Glow SPF 30 in shade Light"                          |
| PRD-TINTED-GLOW-01-MEDIUM | … (Medium)                     | Same                                                                                    | same, "…smear of medium warm golden-beige tinted fluid…"                                                                                                                                                 | "Tinted Glow SPF 30 in shade Medium"                         |
| PRD-TINTED-GLOW-01-DEEP   | … (Deep)                       | Same                                                                                    | same, "…smear of deep rich brown tinted fluid…"                                                                                                                                                          | "Tinted Glow SPF 30 in shade Deep"                           |

### 2.3 Angle / plinth template (`-ANGLE`)

> _"Three-quarter view of [PRODUCT DESCRIPTION FROM 2.2] standing on a rough-hewn travertine stone plinth, a second smaller travertine block behind it, long soft shadow falling to the right, plaster wall background in warm porcelain tone"_ + packaging block + style suffix.
> Variable per product: the product description from §2.2, plus the prop: Clarify (water droplets on the plinth), Calm (centella leaf), Glow (thin slice of orange peel, blurred in the background), Mineral Shield (river stone), Night Recovery (evening light, a linen fold), and all others with no extra prop.

### 2.4 Texture swatch prompts (`-TEXTURE`, 1:1)

Base: _"extreme macro close-up of a skincare texture swatch on [SURFACE], shallow depth of field, soft left window light, sensorial"_ + style suffix (without the 85mm lens term; use "100mm macro lens").

| Key                           | Surface                                 | Texture description                                                                                 |
| ----------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| PRD-CLOUD-MILK-01-TEXTURE     | Porcelain ceramic tile                  | "a soft milky white lotion swirl with a silky satin sheen"                                          |
| PRD-CLARIFY-GEL-01-TEXTURE    | Clear glass pane                        | "a clear slightly bubbly gel smear with tiny air bubbles, fresh and watery"                         |
| PRD-MELT-BALM-01-TEXTURE      | Travertine                              | "a scoop of golden-ivory solid balm beginning to melt into oil at the edges"                        |
| PRD-DEW-SERUM-01-TEXTURE      | Glass                                   | "glossy clear hyaluronic serum droplets and a stretchy viscous string between two droplets"         |
| PRD-CLEAR-SERUM-01-TEXTURE    | Glass                                   | "a slightly milky translucent serum smear with a light satin finish"                                |
| PRD-GLOW-SERUM-01-TEXTURE     | Glass over sand linen                   | "a golden-amber translucent serum droplet with warm light refracting through it"                    |
| PRD-RENEW-NIGHT-01-TEXTURE    | Dark stone (in-palette deep stone)      | "a pale buttery-yellow lightweight emulsion smear, evening mood"                                    |
| PRD-CALM-SERUM-01-TEXTURE     | Glass with centella leaf blurred behind | "a soft creamy off-white serum swatch with a gentle sheen"                                          |
| PRD-BARRIER-CREAM-01-TEXTURE  | Porcelain                               | "a thick rich white cream with a sculpted peak and swirl, luxurious"                                |
| PRD-WATER-GEL-01-TEXTURE      | Glass with water droplets               | "a translucent pale-aqua bouncy gel-cream dollop with water droplets beading on it"                 |
| PRD-NIGHT-RECOVERY-01-TEXTURE | Linen fabric                            | "a dense buttery ivory cream smear with visible richness"                                           |
| PRD-DAILY-VEIL-01-TEXTURE     | Glass                                   | "a sheer white fluid sunscreen smear that turns invisible at its edges"                             |
| PRD-MINERAL-SHIELD-01-TEXTURE | Pale stone                              | "a smooth soft-white mineral sunscreen cream smear"                                                 |
| PRD-TINTED-GLOW-01-TEXTURE    | Porcelain                               | "three smears side by side of tinted fluid in light ivory, medium golden beige and deep rich brown" |

### 2.5 In-hand template (`-INHAND`)

> _"Close-up of a hand with natural unpolished short nails and visible real skin texture [ACTION] [PRODUCT DESCRIPTION], soft focus bathroom background with a plaster wall and a linen towel"_ + packaging block + style suffix.
> Hand skin tones rotate across products for representation (Fitzpatrick II, IV, VI, III, V, I, …) according to a **documented rotation list** in the manifest. Actions: cleanser, "squeezing a small amount onto fingertips"; serum, "holding the dropper above the palm with a drop falling"; cream, "scooping a small amount with two fingers"; SPF, "squeezing two finger-lengths of sunscreen onto index and middle fingers" (demonstrating correct dosage). Balm: "holding the jar with the spatula".

### 2.6 Bundle / routine flat-lays (5)

| Key                   | Purpose      | Size                             | Where used                        | Prompt (+ style suffix, overhead)                                                                                                                                                                                                                                                                                                                            |
| --------------------- | ------------ | -------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RTN-BARRIER-RESCUE-01 | Routine hero | 2400×2400 (1:1) + 2400×3000 crop | Routine card, routine page, email | "Overhead flat lay on warm linen fabric of four minimal skincare products arranged in a gentle diagonal line from left to right: a white tube with a sand cap, a frosted dropper bottle with a clay collar, a frosted jar with a sage lid, and a white tube with a deep teal cap; oat grains scattered sparingly, a folded linen towel corner, blank labels" |
| RTN-CLEAR-SKIN-01     | same         | same                             | same                              | "…frosted translucent tube with a sand cap, frosted dropper bottle with a clay collar, frosted jar with sage lid holding translucent gel cream, white tube with a teal cap; fresh water droplets, a smooth pale stone…"                                                                                                                                      |
| RTN-GLOW-01           | same         | same                             | same                              | "…frosted glass jar with a sand lid containing golden balm, an amber frosted dropper bottle with a clay collar, a frosted jar with a sage lid, a white tube with a teal cap; a thin strip of orange peel, warm golden light…"                                                                                                                                |
| RTN-AGE-RENEWAL-01    | same         | same                             | same                              | "…five products: white tube with a sand cap, amber dropper with a clay collar, opaque white airless pump with a clay pump, heavy frosted jar with a sage lid, white tube with a teal cap; split composition with morning sunlight on the left half and dusky evening light on the right half suggesting AM and PM"                                           |
| RTN-STARTER-DUO-01    | same         | same                             | same                              | "…two products: white tube with a sand cap and white tube with a teal cap, placed parallel with generous space, a single eucalyptus sprig"                                                                                                                                                                                                                   |

---

## 3. Hero images

| Key                  | Purpose           | Master size           | Style                                                                         | Where used            | Prompt (+ style suffix)                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------- | ----------------- | --------------------- | ----------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IMG-HERO-01-DESKTOP  | Home hero (LCP)   | 3200×1800 (16:9)      | Editorial, subject right, negative space left for the headline                | `/` hero ≥ 1024 px    | "A woman in her early thirties with warm medium-deep brown skin and natural visible skin texture, eyes gently closed, touching her cheek lightly with her fingertips after applying serum, bare shoulders, hair pulled back loosely, positioned on the right third of the frame, a warm plaster wall background washed in soft morning sunlight with a subtle window shadow pattern, serene and confident" |
| IMG-HERO-01-MOBILE   | Home hero mobile  | 1500×1875 (4:5)       | Same scene, vertical, subject lower-centre, space at the top for the headline | `/` hero < 1024 px    | same scene, "vertical composition, subject in the lower two thirds, open plaster wall above"                                                                                                                                                                                                                                                                                                               |
| IMG-HERO-FINDER-01   | Finder intro      | 2400×2400             | Calm, consultation feeling                                                    | `/finder` intro       | "Overhead view of a minimalist travertine vanity tray with three unlabeled skincare products and a small handwritten-style blank notecard (no text), soft morning light, a calm sense of a personalised plan"                                                                                                                                                                                              |
| IMG-HERO-ROUTINES-01 | Routines index    | 3200×1400 (panoramic) | Flat-lay panorama                                                             | `/routines`           | "Wide panoramic flat lay on sand-coloured linen of many minimal skincare bottles, tubes and jars with sand, clay, sage and teal caps grouped into four small clusters, lots of breathing room"                                                                                                                                                                                                             |
| IMG-HERO-SCIENCE-01  | Science page      | 3200×1600             | Lab-meets-editorial                                                           | `/science`            | "A bright minimalist cosmetic formulation lab bench with frosted glass beakers, a precision scale and pipettes, warm plaster walls, soft daylight, no people, calm and precise"                                                                                                                                                                                                                            |
| IMG-HERO-ABOUT-01    | About page        | 3200×1800             | Human, team                                                                   | `/about`              | "Three people of different ages and ethnicities in simple neutral clothing sitting around a light wooden table, laughing naturally while testing skincare textures on the backs of their hands, sunlit studio with plaster walls"                                                                                                                                                                          |
| IMG-AUTH-01          | Auth split panel  | 1600×2400 (2:3)       | Quiet texture                                                                 | Sign-in/up left panel | "Macro close-up of water droplets on frosted glass with a soft terracotta clay reflection, abstract and calm"                                                                                                                                                                                                                                                                                              |
| IMG-CAT-CLEANSERS    | Category hero     | 2400×1000             | Product-group still life                                                      | `/shop/cleansers`     | "Three cleanser containers — a white tube, a frosted translucent tube, a frosted glass jar — all with sand-beige caps, arranged on a wet travertine ledge with water droplets"                                                                                                                                                                                                                             |
| IMG-CAT-SERUMS       | Category hero     | 2400×1000             |                                                                               | `/shop/serums`        | "Five frosted and amber glass dropper bottles and one airless pump, all with terracotta clay collars, arranged at staggered heights on travertine blocks"                                                                                                                                                                                                                                                  |
| IMG-CAT-MOISTURIZERS | Category hero     | 2400×1000             |                                                                               | `/shop/moisturizers`  | "Three frosted glass jars with sage-green lids, one open showing a cream swirl, on a folded linen towel"                                                                                                                                                                                                                                                                                                   |
| IMG-CAT-SUNSCREENS   | Category hero     | 2400×1000             | Sunlit                                                                        | `/shop/sunscreens`    | "Three sunscreens — two white tubes and a frosted pump bottle — with deep teal caps, on a sun-drenched pale stone ledge with a crisp palm-leaf shadow"                                                                                                                                                                                                                                                     |
| IMG-BANNER-FINDER    | PLP inline banner | 2400×800              | Light, inviting                                                               | PLP promo, email      | "Soft-focus close-up of a person's hands holding a phone (screen facing away) next to a travertine tray of unlabeled skincare products, warm morning light"                                                                                                                                                                                                                                                |

## 4. Lifestyle photography

| Key         | Purpose                 | Size      | Where used                               | Prompt (+ style suffix)                                                                                                                                                                                     |
| ----------- | ----------------------- | --------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IMG-LIFE-01 | "Morning routine"       | 2400×3000 | Home ingredient story / onboarding email | "A man in his late twenties with light olive skin and light stubble applying sunscreen to his cheek in front of a bathroom mirror, morning sunlight, a white towel over his shoulder, natural skin texture" |
| IMG-LIFE-02 | "Evening routine"       | 2400×3000 | PDP Renew Night, onboarding day 14       | "A woman in her fifties with fair freckled skin and silver hair applying a few drops of serum with her fingertips in a softly lit bathroom at dusk, calm expression"                                        |
| IMG-LIFE-03 | Sensitive-skin story    | 2400×3000 | Concern hub: redness, Calm Serum         | "A young woman with light skin and visible natural cheek redness gently patting on moisturiser, soft neutral bathroom, reassuring mood, no makeup"                                                          |
| IMG-LIFE-04 | Breakouts story         | 2400×3000 | Concern hub: acne                        | "A teenager or young adult with deep brown skin and a few visible blemishes on the jaw rinsing their face with water at a sink, droplets on the skin, candid"                                               |
| IMG-LIFE-05 | Pregnancy-safe story    | 2400×3000 | Pregnancy-safe collection, safety copy   | "A visibly pregnant woman with medium tan skin in a soft knit top applying a mineral sunscreen to her face by a sunny window, gentle smile"                                                                 |
| IMG-LIFE-06 | Subscription / delivery | 2400×1600 | Subscription section, emails             | "Hands opening an unbleached kraft mailer box revealing minimal skincare products nestled in paper, a routine card with blank text inside, on a wooden table"                                               |
| IMG-LIFE-07 | Community / reviews     | 2400×1600 | Testimonial strip background             | "Four people of diverse ages, genders and skin tones in a sunlit room, candid shared laughter, soft neutral clothing, editorial group portrait"                                                             |
| IMG-LIFE-08 | Mature skin             | 2400×3000 | Concern hub: fine lines                  | "A man in his sixties with deep brown skin and natural wrinkles massaging cream into his face, warm window light, dignified and relaxed"                                                                    |
| IMG-LIFE-09 | Dry skin / winter       | 2400×3000 | Concern hub: dryness                     | "A person in a chunky oatmeal knit sweater applying a rich cream to the back of their hand, frosty window light, cosy"                                                                                      |
| IMG-LIFE-10 | Oily skin / humid       | 2400×3000 | Concern hub: oiliness                    | "A young man with East Asian features and a slight natural shine on his T-zone patting a gel cream onto his face, humid summer morning light"                                                               |

## 5. Ingredient images

Macro "ingredient portraits" used on ingredient pages, the ingredient story and PDP key-actives (small crops). Master 2400×2400 (1:1). Base: _"minimal still-life portrait of [SUBJECT] on [SURFACE], centered, lots of negative space"_ + style suffix.

| Key                 | Ingredient          | Subject / surface                                                                                                | Where used                                  |
| ------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| IMG-ING-NIACINAMIDE | Niacinamide         | "a small heap of fine white crystalline powder in a frosted glass dish, travertine"                              | `/ingredients/niacinamide`, Clear Serum PDP |
| IMG-ING-HYALURONIC  | Hyaluronic acid     | "a clear viscous gel stretching between a glass rod and a glass surface, water droplets"                         | Dew Serum                                   |
| IMG-ING-VITAMIN-C   | Ethyl ascorbic acid | "a halved fresh orange with a single golden serum drop on a glass slide beside it"                               | Glow Serum                                  |
| IMG-ING-RETINAL     | Retinal             | "a pale yellow powder in a small amber glass vial, dim warm evening light"                                       | Renew Night Serum                           |
| IMG-ING-AZELAIC     | Azelaic acid        | "wheat and barley grain stalks with fine white powder in a ceramic dish" (azelaic acid occurs in grains)         | Calm Serum                                  |
| IMG-ING-CENTELLA    | Centella asiatica   | "fresh round centella asiatica leaves with dew droplets on a wet stone"                                          | Calm Serum                                  |
| IMG-ING-SALICYLIC   | Salicylic acid      | "a strip of white willow bark and a small dish of fine white powder"                                             | Clarify Gel                                 |
| IMG-ING-CERAMIDES   | Ceramides           | "overlapping translucent creamy wax flakes arranged like tiles, suggesting a skin barrier"                       | Barrier Cream                               |
| IMG-ING-SQUALANE    | Squalane            | "a clear golden oil droplet on a green olive leaf"                                                               | Water Gel Cream                             |
| IMG-ING-PEPTIDES    | Peptides            | "a clear glass pipette releasing a drop into a small clear pool on frosted glass, abstract molecular reflection" | Night Recovery                              |
| IMG-ING-ZINC-OXIDE  | Zinc oxide          | "a smooth heap of bright white mineral powder on a pale river stone in bright sun"                               | Mineral Shield                              |
| IMG-ING-OAT         | Colloidal oat       | "rolled oats and fine oat flour in a ceramic bowl on linen"                                                      | Cloud Milk                                  |
| IMG-ING-PANTHENOL   | Panthenol           | "a clear honey-like viscous drop on a glass surface"                                                             | Dew Serum                                   |
| IMG-ING-SUNFLOWER   | Sunflower oil       | "a sunflower head and a small glass dish of pale golden oil"                                                     | Melt Balm                                   |

## 6. Icons (vector; hand-drawn to the 13 §7 grid)

Icons are **drawn as SVG**, not AI-generated. The AI prompt column is used only for **concept exploration**. Size 24×24, 1.5 px stroke, round caps and joins, `currentColor`.

| Key(s)             | Set             | Items                                                                                                                           | Where used                                   | Concept prompt                                                                                                                               |
| ------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| ICN-CONCERN-* (12) | Concerns        | acne, post-acne-marks, dullness, pigmentation, redness, dryness, dehydration, oiliness, pores, fine-lines, texture, sensitivity | Finder concern chips, concern hubs, filters  | "Set of 12 minimal line icons for skincare concerns, single 1.5px stroke, round caps, geometric, consistent 24px grid, monochrome, on white" |
| ICN-SLOT-* (4)     | Routine slots   | cleanse (water drop + foam), treat (dropper), moisturize (jar), protect (sun shield)                                            | Step cards, packaging step circle, timelines | "Four minimal line icons: cleansing foam droplet, serum dropper, cream jar, sun with shield, 1.5px stroke"                                   |
| ICN-TIME-* (2)     | AM / PM         | sun, moon                                                                                                                       | Badges                                       | —                                                                                                                                            |
| ICN-SKINTYPE-* (4) | Skin types      | dry (cracked leaf), oily (droplet shine), combination (half/half), normal (balanced circle)                                     | Finder step 1 cards                          | "Four abstract minimal line icons representing dry, oily, combination and normal skin, 1.5px stroke"                                         |
| ICN-FLAG-* (5)     | Product flags   | pregnancy-safe, fragrance-free, vegan, non-comedogenic, dermatologist-reviewed (fictional)                                      | PDP, cards, filters                          | —                                                                                                                                            |
| ICN-UI             | UI              | Lucide set (search, bag, heart, user, chevrons, etc.)                                                                           | Everywhere                                   | n/a (library)                                                                                                                                |
| ICN-BRAND-SYMBOL   | Dew-drop symbol | Symbol                                                                                                                          | Favicon, loaders                             | n/a (logo process)                                                                                                                           |

## 7. Illustrations (SVG; AI concept → vector redraw)

Style per 14 §7: 1.5 px line, tint-fill offsets. Master artboards are listed below; delivered as optimized SVG with `currentColor`.

| Key                  | Purpose                             | Artboard | Where used                    | Concept prompt                                                                                                                                         |
| -------------------- | ----------------------------------- | -------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ILL-HIW-01           | "Answer 10 questions"               | 320×240  | Home "How it works"           | "Minimal single-line illustration of a hand tapping selection cards on a phone, soft clay tinted shape offset behind, botanical-scientific line style" |
| ILL-HIW-02           | "We match ingredients to your skin" | 320×240  | Same                          | "Minimal line illustration of an ingredient molecule connecting with a leaf and a droplet, clay and sage tint shapes offset"                           |
| ILL-HIW-03           | "Get your routine, explained"       | 320×240  | Same                          | "Minimal line illustration of four skincare bottles in a row with numbered circles above, sun and moon icons"                                          |
| ILL-SCIENCE-PIPELINE | Engine diagram                      | 1200×600 | `/science`                    | "Clean line-art flow diagram style illustration: questionnaire card → funnel filter → balance scale → checklist shield → routine bottles"              |
| ILL-SCIENCE-SKIN     | Skin barrier cross-section          | 1200×700 | `/science`, Barrier Cream PDP | "Minimal line cross-section of skin layers with a brick-and-mortar barrier metaphor, labelled areas left blank"                                        |
| ILL-EMPTY-SEARCH     | Empty search                        | 240×180  | E1, E2                        | "Line illustration of a magnifying glass over an empty travertine plinth"                                                                              |
| ILL-EMPTY-CART       | Empty cart                          | 240×180  | E3                            | "Line illustration of an empty kraft shopping bag with a single leaf peeking out"                                                                      |
| ILL-EMPTY-WISHLIST   | Empty wishlist                      | 240×180  | E4                            | "Line illustration of an outlined heart shaped by a thin botanical stem"                                                                               |
| ILL-EMPTY-ORDERS     | Empty orders                        | 240×180  | E5                            | "Line illustration of an open empty mailer box"                                                                                                        |
| ILL-EMPTY-SUBS       | Empty subscriptions                 | 240×180  | E6                            | "Line illustration of a calendar page with a small droplet on one day"                                                                                 |
| ILL-EMPTY-ROUTINE    | Empty routine                       | 240×180  | E7, E11                       | "Line illustration of four empty numbered circles waiting to be filled"                                                                                |
| ILL-EMPTY-ADMIN      | Admin generic empty                 | 200×150  | E12                           | "Line illustration of an empty neat shelf"                                                                                                             |
| ILL-EMPTY-DONE       | All caught up                       | 200×150  | E13–E15                       | "Line illustration of a checkmark made from a leaf stem"                                                                                               |
| ILL-ERROR-404        | 404 page                            | 400×300  | ER1                           | "Line illustration of a single dropper bottle wandering off a path of stepping stones"                                                                 |
| ILL-ERROR-500        | Error pages                         | 400×300  | ER3–ER5                       | "Line illustration of a tipped-over jar with a small calm puddle"                                                                                      |
| ILL-SAFETY           | Safety notice                       | 160×120  | Finder SafetyNotice           | "Line illustration of a gentle hand holding a small shield with a leaf"                                                                                |
| ILL-ANALYZING        | Analyzing animation base            | 200×200  | `/finder/analyzing`           | Animated SVG dew drop ring (hand-built)                                                                                                                |

## 8. Backgrounds & textures

| Key                   | Purpose                    | Size                     | Where used                    | Prompt (+ style suffix, no subject)                                                               |
| --------------------- | -------------------------- | ------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------- |
| BG-TEXTURE-PLASTER    | Section background         | 2400×1600, tileable crop | Manifesto band, auth          | "Seamless subtle warm porcelain plaster wall texture, very low contrast, even soft light"         |
| BG-TEXTURE-LINEN      | Section / email background | 2400×1600 tileable       | Emails, routine sections      | "Seamless close-up of natural undyed linen fabric weave, very low contrast, warm sand tone"       |
| BG-TEXTURE-TRAVERTINE | Plinth and card surfaces   | 2400×1600                | Ingredient story, OG template | "Honed travertine stone surface with subtle natural pores, warm beige, even soft light, top-down" |
| BG-SHADOW-WINDOW      | Hero overlay               | 3200×1800 PNG alpha      | Hero accents, social          | "Soft window-frame and leaf shadow projected on a plain wall, isolated shadow only, high key"     |
| BG-DEW-GRADIENT       | Finder background          | CSS-generated            | Finder                        | n/a: CSS radial gradients from dew-100 to porcelain (no image)                                    |

Backgrounds are delivered at a heavy compression target (≤ 120 KB AVIF) and never used behind body text without a solid surface.

## 9. Brand & logo files (vector, designed by hand)

| Key                                        | Files                                                                                                            | Where used                    |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| LOGO-WORDMARK                              | SVG (ink), SVG (reversed), PNG @2x for email                                                                     | Header, footer, emails        |
| LOGO-LOCKUP                                | SVG with "SKIN"                                                                                                  | Packaging, about              |
| LOGO-SYMBOL                                | SVG                                                                                                              | Favicon source, social avatar |
| FAV-*                                      | `favicon.ico` (32), `icon.svg`, `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`, `maskable-512.png` | App icons (`app/manifest.ts`) |
| OG-DEFAULT                                 | 1200×630 composite (travertine + wordmark + tagline)                                                             | Default OG                    |
| OG-TEMPLATE-PRODUCT / ROUTINE / INGREDIENT | Code-generated (`opengraph-image.tsx`) using `-CUTOUT` / ingredient images + brand fonts                         | Dynamic OG                    |

## 10. Social media assets

| Key                                      | Purpose                            | Size           | Where used        | Prompt / construction                                                                                                                                                |
| ---------------------------------------- | ---------------------------------- | -------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SOC-AVATAR                               | Profile image                      | 1080×1080      | All platforms     | LOGO-SYMBOL on clay-500 background                                                                                                                                   |
| SOC-IG-TPL-QUOTE                         | Review quote card template         | 1080×1350      | Instagram feed    | Figma template: linen background (BG-TEXTURE-LINEN), Fraunces quote, skin-type chip                                                                                  |
| SOC-IG-TPL-INGREDIENT (cover + 4 slides) | Ingredient explainer carousel      | 1080×1350 each | Instagram         | Cover uses IMG-ING-*; slides are typographic with ILL icons                                                                                                          |
| SOC-IG-ROUTINE-FLATLAY-01..04            | Routine flat-lays with step labels | 1080×1350      | Instagram         | Crops of RTN-* + composited step labels                                                                                                                              |
| SOC-STORY-TPL-FINDER                     | Story with finder CTA              | 1080×1920      | IG/TikTok stories | Prompt: "Vertical close-up of a person's face in soft morning light looking at their reflection, space at the top and bottom for text" + style suffix; + text layers |
| SOC-PIN-TPL-ROUTINE                      | Pinterest routine infographic      | 1000×1500      | Pinterest         | RTN-* + step list layout                                                                                                                                             |
| SOC-TIKTOK-COVER-TPL                     | Video cover                        | 1080×1920      | TikTok            | Texture macro (PRD-*-TEXTURE) + headline area                                                                                                                        |
| SOC-LAUNCH-01                            | Launch announcement                | 1080×1350      | IG                | "Minimal still life of all fourteen blank-label Nura products arranged in four colour-coded groups on stepped travertine plinths, sunlit" + style suffix             |

## 11. Email assets

| Key               | Purpose               | Size           | Where used        | Notes / prompt                                                                                                                                   |
| ----------------- | --------------------- | -------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| EML-HEADER-LOGO   | Header                | 240×60 @2x PNG | All emails        | From LOGO-WORDMARK                                                                                                                               |
| EML-HERO-WELCOME  | Welcome / newsletter  | 1200×600       | NewsletterWelcome | Crop of IMG-HERO-01-DESKTOP (subject right)                                                                                                      |
| EML-HERO-ORDER    | Order confirmation    | 1200×500       | OrderConfirmation | Crop of IMG-LIFE-06 (kraft box)                                                                                                                  |
| EML-HERO-ROUTINE  | Routine saved         | 1200×500       | RoutineSaved      | Crop of IMG-HERO-FINDER-01                                                                                                                       |
| EML-HERO-REMINDER | Renewal reminder      | 1200×500       | RenewalReminder   | "Minimal calendar page with a small sprig of eucalyptus and a frosted jar, soft light" + style suffix                                            |
| EML-HERO-REVIEW   | Review request        | 1200×500       | ReviewRequest     | Crop of IMG-LIFE-07                                                                                                                              |
| EML-HERO-CHECKIN  | 90-day check-in       | 1200×500       | CheckinInvite     | "Overhead of a half-used frosted serum bottle and a cream jar on linen next to a small notebook with a blank page, morning light" + style suffix |
| EML-ICON-*        | Slot and social icons | 48×48 @2x PNG  | Email bodies      | Rasterized from ICN-* (emails can't use SVG)                                                                                                     |
| EML-PRODUCT-THUMB | Product rows          | 160×200 @2x    | Dynamic           | Cloudinary transform `t_email_thumb` from `-PACKSHOT`                                                                                            |

All email images are hosted on Cloudinary with absolute URLs and have `alt` text. Layouts still work with images off.

## 12. Seeded UGC (review photos) & case-study assets

| Key                                                       | Purpose                                     | Size      | Where used                | Prompt                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------- | ------------------------------------------- | --------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UGC-REVIEW-01..08                                         | Seeded review photos (clearly demo content) | 1200×1500 | PDP reviews (seed)        | Phone-camera aesthetic prompts, e.g. "Casual smartphone photo of a Glow Serum frosted amber dropper bottle with a blank label on a bathroom shelf next to a toothbrush cup, natural indoor light, slightly imperfect framing" (vary products, settings and hands' skin tones). **Never** face close-ups implying results. |
| CS-PERSONA-MAYA / DANIEL / SOFIA / PRIYA / MARCUS / ELENA | Persona portraits for the case study        | 800×800   | `22-portfolio-case-study` | e.g. "Editorial portrait of a 29-year-old East Asian woman with combination skin, casual linen shirt, soft window light, neutral plaster background, natural expression" (per 03 personas)                                                                                                                                |
| CS-MOCKUP-DESKTOP / MOBILE                                | Device mockups of real screenshots          | 2400×1600 | Case study, README        | Real app screenshots composited into device frames (not AI-generated UI)                                                                                                                                                                                                                                                  |
| CS-ARCH-DIAGRAM                                           | Architecture diagram                        | SVG       | Case study                | Drawn from 06 §1 (Excalidraw/Figma)                                                                                                                                                                                                                                                                                       |

---

## 13. Totals & tracking

| Group                         | Count              |
| ----------------------------- | ------------------ |
| Product images                | 75                 |
| Routine flat-lays             | 5 (+ crops)        |
| Heroes & banners              | 12                 |
| Lifestyle                     | 10                 |
| Ingredient portraits          | 14                 |
| Icons (custom)                | 27 (+ Lucide)      |
| Illustrations                 | 17                 |
| Backgrounds                   | 4 (+ 1 CSS)        |
| Brand/logo/OG/favicons        | ~15 files          |
| Social                        | 8 templates/assets |
| Email                         | 9 (+ icon set)     |
| UGC & case study              | 16                 |
| **Total purpose-made assets** | **≈ 210**          |

**Phasing (review R-22):** ~210 purpose-made assets with label compositing and retouching is roughly 60–90 hours of production work. **Release 1 ships ~90 assets** (every packshot and texture shot, the 5 flat-lays, all heroes and category heroes, 6 lifestyle, 8 ingredient portraits, all icons and empty-state illustrations, logo/favicons/OG). Angle and in-hand shots, the remaining lifestyle and ingredient images, social and email extras follow in Release 2. The "no placeholder" rule still holds: components for R2 imagery (e.g. PDP gallery slots 2 and 4) render only the images that exist, and never a placeholder.

Tracking lives in a sheet exported from `src/config/assets.ts` (`pnpm assets:report`): key, status (`prompted → generated → retouched → uploaded → reviewed`), publicId, alt and the pages that reference it. **Launch criterion:** 100% of the keys referenced in code are `reviewed`.
