# 08 — Database Design

PostgreSQL 16 (Neon) + Prisma. This document is the source of truth for the data model. The Prisma schema is written from it in milestone M1 (see §6 for the planning rules).

---

## 1. Global conventions

| Concern            | Convention                                                                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Primary keys       | `id String @id @default(cuid(2))`. Non-sequential, safe in URLs. Exceptions: `AnalyticsEvent.id BigInt @default(autoincrement())` (high volume, never exposed); `Order.number Int` from a sequence, displayed as `NURA-{number:06}`. |
| Timestamps         | `createdAt timestamptz default now()`, `updatedAt timestamptz @updatedAt` on every mutable table.                                                                                                                                    |
| Money              | `Int` minor units (cents) + `currency Char(3)` default `'USD'` on money-bearing aggregates (Order, Payment, Refund, Cart snapshot). Never `Float`/`Decimal` for money.                                                               |
| Percentages        | `Int` basis points (1500 = 15%) to avoid float rounding.                                                                                                                                                                             |
| Strings            | `citext` for emails and coupon codes (case-insensitive unique).                                                                                                                                                                      |
| Soft delete        | `archivedAt DateTime?` for Product, ProductVariant, Coupon, Category, Ingredient. Listings filter `archivedAt IS NULL`.                                                                                                              |
| Enums              | Postgres enums via Prisma for closed sets. Lookup **tables** for sets admins may extend (Concern, Category).                                                                                                                         |
| Naming             | Models PascalCase singular; tables snake_case plural via `@@map`; columns snake_case via `@map`.                                                                                                                                     |
| FKs                | Always declared. `onDelete` chosen per relation (listed). Commerce history uses `Restrict`/`SetNull`, never `Cascade` to orders.                                                                                                     |
| JSON               | `Jsonb` only for snapshots, flexible event properties and AI payloads, each with a Zod schema in code.                                                                                                                               |
| Optimistic locking | `version Int @default(0)` on InventoryItem, Product, Order and Subscription; updates use `WHERE version = $expected`.                                                                                                                |
| Row-level locks    | `SELECT … FOR UPDATE` on InventoryItem and Coupon during checkout and adjustments.                                                                                                                                                   |
| CHECK constraints  | Added in raw SQL migrations (Prisma doesn't model them); listed per table.                                                                                                                                                           |

---

## 2. Entity-relationship overview

```
Role 1─* User 1─1 CustomerPreference            User 1─* Address
                User 1─1 CustomerMetric           User 1─1 Wishlist 1─* WishlistItem *─1 ProductVariant
                User 1─* Cart 1─* CartItem *─1 ProductVariant
                User 1─* Order 1─* OrderItem *─1 ProductVariant (nullable after archive; snapshot kept)
                            Order 1─* Payment 1─* Refund
                            Order 1─* OrderStatusEvent, OrderNote, Shipment
                            Order *─1 Subscription (renewals)   Order 1─* CouponRedemption *─1 Coupon
                User 1─* Subscription 1─* SubscriptionItem *─1 ProductVariant
                User 1─* Review *─1 Product ; Review 1─* ReviewImage ; Review *─1 OrderItem (verification)
                User 1─* RoutineConsultation 1─* RoutineRecommendation 1─* RoutineStep *─1 ProductVariant
Category 1─* Product 1─* ProductVariant 1─1 InventoryItem 1─* InventoryMovement
                                        ProductVariant 1─* InventoryReservation *─1 Order
                                        ProductVariant 1─* StripePrice
         Product 1─* ProductImage       Product *─* Ingredient (ProductIngredient)
         Product *─* Concern (ProductConcern)   Ingredient *─* Concern (IngredientConcern)
         Ingredient *─* Ingredient (IngredientConflict)
         Product(BUNDLE) 1─* BundleItem *─1 ProductVariant
AnalyticsEvent, DailyMetric, AuditLog, WebhookEvent, OutboxEvent, EmailLog, SignedActionToken, NewsletterSubscriber,
BackInStockRequest, SlugRedirect, StoreSetting — standalone/loosely linked
```

---

## 3. Enums

| Enum                                 | Values                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `RoleKey`                            | `CUSTOMER`, `SUPPORT`, `MARKETING_MANAGER`, `INVENTORY_MANAGER`, `ADMIN`, `DEMO_STAFF` (portfolio demo only; see 10 §9b) |
| `ProductStatus`                      | `DRAFT`, `PUBLISHED`, `ARCHIVED`                                                                                         |
| `ProductType`                        | `SINGLE`, `BUNDLE`                                                                                                       |
| `RoutineSlot`                        | `CLEANSE`, `TREAT`, `MOISTURIZE`, `PROTECT`                                                                              |
| `TimeOfDay`                          | `AM`, `PM`, `BOTH`                                                                                                       |
| `SkinType`                           | `DRY`, `OILY`, `COMBINATION`, `NORMAL`                                                                                   |
| `PurchaseType`                       | `ONE_TIME`, `SUBSCRIPTION`                                                                                               |
| `CartStatus`                         | `ACTIVE`, `CONVERTED`, `MERGED`, `ABANDONED`                                                                             |
| `OrderType`                          | `STANDARD`, `SUBSCRIPTION_RENEWAL`                                                                                       |
| `OrderStatus` (fulfilment lifecycle) | `PENDING_PAYMENT`, `PAID`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELED`, `EXPIRED`                                   |
| `PaymentStatus`                      | `PENDING`, `SUCCEEDED`, `FAILED`, `PARTIALLY_REFUNDED`, `REFUNDED`                                                       |
| `RefundStatus`                       | `PENDING`, `SUCCEEDED`, `FAILED`, `CANCELED`                                                                             |
| `SubscriptionStatus`                 | `INCOMPLETE`, `ACTIVE`, `PAUSED`, `PAST_DUE`, `CANCELED`                                                                 |
| `InventoryMovementType`              | `RECEIVE`, `SALE`, `RETURN_RESTOCK`, `ADJUSTMENT`, `DAMAGE`, `INITIAL`                                                   |
| `ReservationStatus`                  | `ACTIVE`, `COMMITTED`, `RELEASED`                                                                                        |
| `ReviewStatus`                       | `PENDING`, `APPROVED`, `REJECTED`                                                                                        |
| `CouponType`                         | `PERCENTAGE`, `FIXED_AMOUNT`, `FREE_SHIPPING`                                                                            |
| `ConsultationStatus`                 | `IN_PROGRESS`, `COMPLETED`, `ABANDONED`                                                                                  |
| `RecommendationEngine`               | `LLM`, `RULES_FALLBACK`                                                                                                  |
| `RoutineTier`                        | `ESSENTIAL`, `COMPLETE`, `ADVANCED`                                                                                      |
| `OutboxStatus`                       | `PENDING`, `DISPATCHED`, `FAILED`                                                                                        |

---

## 4. Tables

Legend: **PK** primary key · **FK** foreign key · **UQ** unique · **IX** index · **CK** check constraint · `?` nullable.

### 4.1 Identity & customers

#### `Role` (`roles`)

Lookup table so that users reference a real row. The **permissions per role are defined in code** (`src/lib/permissions.ts`), not in the DB: they are versioned, reviewed in PRs and unit-tested, and cannot be escalated with a DB write.

| Field                 | Type       | Notes               |
| --------------------- | ---------- | ------------------- |
| id                    | String PK  |                     |
| key                   | RoleKey UQ |                     |
| name                  | String     | "Inventory Manager" |
| description           | String?    |                     |
| createdAt / updatedAt | DateTime   |                     |

#### `User` (`users`)

| Field                   | Type                  | Notes                                                                        |
| ----------------------- | --------------------- | ---------------------------------------------------------------------------- |
| id                      | String PK             |                                                                              |
| clerkId                 | String UQ             | Clerk user ID                                                                |
| email                   | citext UQ             | Primary verified email (synced from Clerk)                                   |
| firstName? / lastName?  | String                |                                                                              |
| phone?                  | String                | E.164                                                                        |
| roleId                  | String FK → Role      | default = CUSTOMER role; `onDelete: Restrict`                                |
| stripeCustomerId?       | String UQ             | Created lazily at first checkout                                             |
| marketingConsent        | Boolean default false |                                                                              |
| marketingConsentAt?     | DateTime              |                                                                              |
| sensitiveDataConsentAt? | DateTime              | Consent for finder health-adjacent data                                      |
| lastSeenAt?             | DateTime              |                                                                              |
| isDemo                  | Boolean default false | Seeded synthetic customers/staff; the only customers visible to `DEMO_STAFF` |
| deletedAt?              | DateTime              | Set on anonymization; email replaced with `deleted+{id}@invalid`             |
| createdAt / updatedAt   |                       |                                                                              |

IX: `(roleId)`, `(createdAt)`. CK: none.

#### `Address` (`addresses`)

| Field                      | Type                  | Notes                                                      |
| -------------------------- | --------------------- | ---------------------------------------------------------- |
| id                         | String PK             |                                                            |
| userId                     | FK → User, `Cascade`  |                                                            |
| label?                     | String                | "Home"                                                     |
| fullName                   | String                |                                                            |
| line1 / line2?             | String                |                                                            |
| city / region / postalCode | String                |                                                            |
| country                    | Char(2)               | ISO 3166-1 alpha-2; v1 allows `US` only (validated in Zod) |
| phone?                     | String                |                                                            |
| isDefaultShipping          | Boolean default false |                                                            |
| createdAt / updatedAt      |                       |                                                            |

IX: `(userId)`. **Partial UQ** (raw SQL): `UNIQUE (user_id) WHERE is_default_shipping` (at most one default). App limit: max 10 per user.

#### `CustomerPreference` (`customer_preferences`), the persistent skin profile

| Field                    | Type                                | Notes                                     |
| ------------------------ | ----------------------------------- | ----------------------------------------- |
| id                       | String PK                           |                                           |
| userId                   | FK UQ → User, `Cascade`             | 1:1                                       |
| skinType?                | SkinType                            |                                           |
| concerns                 | String[]                            | Concern slugs, ranked (index 0 = primary) |
| sensitivity?             | Int                                 | 1–5. CK `sensitivity BETWEEN 1 AND 5`     |
| reactions                | String[]                            | e.g. `fragrance`, `acids`, `retinoids`    |
| isPregnantOrNursing      | Boolean default false               | Sensitive                                 |
| usesPrescriptionTopicals | Boolean default false               |                                           |
| fragranceFree            | Boolean default false               |                                           |
| vegan                    | Boolean default false               |                                           |
| avoidIngredientIds       | String[]                            | Ingredient IDs                            |
| climate?                 | String                              | `humid`, `dry`, `temperate`, `cold`       |
| sunExposure?             | String                              | `low`, `moderate`, `high`                 |
| routineTimePref?         | String                              | `minimal`, `standard`, `enthusiast`       |
| monthlyBudgetCents?      | Int                                 | CK `>= 0`                                 |
| sourceConsultationId?    | FK → RoutineConsultation, `SetNull` | Last consultation that updated this       |
| updatedAt / createdAt    |                                     |                                           |

#### `CustomerMetric` (`customer_metrics`), materialized nightly

| Field                        | Type                           | Notes                                                       |
| ---------------------------- | ------------------------------ | ----------------------------------------------------------- |
| userId                       | String PK FK → User, `Cascade` |                                                             |
| ordersCount                  | Int                            | Paid, non-refunded                                          |
| lifetimeValueCents           | Int                            | Net of refunds                                              |
| firstOrderAt? / lastOrderAt? | DateTime                       |                                                             |
| activeSubscriptions          | Int                            |                                                             |
| lifecycleStage               | String                         | `lead`, `new`, `repeat`, `subscriber`, `at_risk`, `churned` |
| computedAt                   | DateTime                       |                                                             |

IX: `(lifecycleStage)`, `(lifetimeValueCents DESC)`.

### 4.2 Catalogue

#### `Category` (`categories`)

| Field                       | Type          | Notes                                                           |
| --------------------------- | ------------- | --------------------------------------------------------------- |
| id                          | PK            |                                                                 |
| slug                        | String UQ     | `cleansers`, `serums`, `moisturizers`, `sunscreens`, `routines` |
| name                        | String        |                                                                 |
| description?                | String        | SEO intro copy                                                  |
| routineSlot?                | RoutineSlot   | Default slot for products in this category                      |
| position                    | Int default 0 | Nav order                                                       |
| heroImageKey?               | String        | Asset manifest key                                              |
| seoTitle? / seoDescription? | String        |                                                                 |
| archivedAt?                 | DateTime      |                                                                 |

#### `Product` (`products`)

| Field                       | Type                        | Notes                                                                    |
| --------------------------- | --------------------------- | ------------------------------------------------------------------------ |
| id                          | PK                          |                                                                          |
| slug                        | String UQ                   |                                                                          |
| name                        | String                      | "Glow Serum"                                                             |
| subtitle?                   | String                      | "15% Vitamin C Brightening Serum"                                        |
| type                        | ProductType default SINGLE  |                                                                          |
| status                      | ProductStatus default DRAFT |                                                                          |
| categoryId                  | FK → Category, `Restrict`   |                                                                          |
| shortDescription            | String                      | ≤ 160 chars (CK)                                                         |
| description                 | Text                        | Sanitized Markdown                                                       |
| howToUse                    | Text                        |                                                                          |
| routineSlot?                | RoutineSlot                 | Null for bundles                                                         |
| timeOfDay                   | TimeOfDay default BOTH      |                                                                          |
| skinTypes                   | SkinType[]                  | Suitable skin types                                                      |
| pregnancySafe               | Boolean default false       | Must be set explicitly                                                   |
| fragranceFree               | Boolean                     |                                                                          |
| vegan                       | Boolean                     |                                                                          |
| nonComedogenic              | Boolean                     |                                                                          |
| strengthLevel               | Int default 1               | 1 gentle – 3 strong; used by sensitivity scoring. CK 1–3                 |
| isFeatured                  | Boolean default false       | Merchandising                                                            |
| featuredPosition?           | Int                         |                                                                          |
| badges                      | String[]                    | `bestseller`, `new`, `derm-favorite`                                     |
| ratingAvg                   | Decimal(3,2) default 0      | Denormalized (display only, not money)                                   |
| ratingCount                 | Int default 0               |                                                                          |
| unitsSold30d                | Int default 0               | Denormalized by nightly job for "bestselling" sort                       |
| seoTitle? / seoDescription? | String                      |                                                                          |
| searchVector                | tsvector (Unsupported)      | Generated column: name A, subtitle B, ingredients C (trigger-maintained) |
| publishedAt?                | DateTime                    |                                                                          |
| archivedAt?                 | DateTime                    |                                                                          |
| version                     | Int default 0               |                                                                          |
| createdById? / updatedById? | FK → User, `SetNull`        |                                                                          |
| createdAt / updatedAt       |                             |                                                                          |

IX: `(status, categoryId)`, `(status, isFeatured, featuredPosition)`, `(status, unitsSold30d DESC)`, `(status, ratingAvg DESC)`, GIN `(skinTypes)`, GIN `(searchVector)`, GIN trigram `(name gin_trgm_ops)`.
CK: `status <> 'PUBLISHED' OR published_at IS NOT NULL`; `type = 'BUNDLE' OR routine_slot IS NOT NULL` (singles need a slot).

#### `ProductVariant` (`product_variants`)

| Field                 | Type                                                        | Notes                                      |
| --------------------- | ----------------------------------------------------------- | ------------------------------------------ |
| id                    | PK                                                          |                                            |
| productId             | FK → Product, `Cascade` (only drafts are ever hard-deleted) |                                            |
| sku                   | String UQ                                                   | `NURA-SER-GLOW-30`                         |
| name                  | String                                                      | "30 ml", "Medium"                          |
| optionType            | String                                                      | `size` / `shade`                           |
| sizeMl?               | Int                                                         |                                            |
| shadeHex?             | String                                                      | For shade swatches                         |
| priceCents            | Int                                                         | CK `> 0`                                   |
| compareAtPriceCents?  | Int                                                         | CK `IS NULL OR > price_cents`              |
| costCents?            | Int                                                         | Admin-only (margin preview)                |
| subscriptionEligible  | Boolean default true                                        |                                            |
| replenishDays         | Int default 56                                              | Suggested interval source. CK 14–180       |
| weightGrams           | Int                                                         | Shipping                                   |
| barcode?              | String                                                      |                                            |
| position              | Int                                                         |                                            |
| isDefault             | Boolean                                                     | Partial UQ `(product_id) WHERE is_default` |
| archivedAt?           | DateTime                                                    |                                            |
| createdAt / updatedAt |                                                             |                                            |

IX: `(productId, position)`.

#### `ProductImage` (`product_images`)

| Field          | Type                           | Notes                                                     |
| -------------- | ------------------------------ | --------------------------------------------------------- |
| id             | PK                             |                                                           |
| productId      | FK → Product, `Cascade`        |                                                           |
| variantId?     | FK → ProductVariant, `SetNull` | Shade-specific images                                     |
| publicId       | String                         | Cloudinary public ID (never a URL)                        |
| width / height | Int                            |                                                           |
| alt            | String                         | Required (CK `length(alt) >= 3`)                          |
| blurDataUrl?   | Text                           |                                                           |
| kind           | String                         | `packshot`, `angle`, `texture`, `lifestyle`, `ingredient` |
| position       | Int                            |                                                           |

IX: `(productId, position)`.

#### `Ingredient` (`ingredients`)

| Field           | Type                       | Notes                                                                                                           |
| --------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| id              | PK                         |                                                                                                                 |
| slug            | String UQ                  | `niacinamide`                                                                                                   |
| inciName        | citext UQ                  | "Niacinamide"                                                                                                   |
| commonName      | String                     | "Vitamin B3"                                                                                                    |
| aliases         | String[]                   | Search synonyms                                                                                                 |
| category        | String                     | `humectant`, `exfoliant-bha`, `retinoid`, `antioxidant`, `emollient`, `uv-filter`, `soothing`, `fragrance`, ... |
| isActive        | Boolean                    | "Key active" candidate                                                                                          |
| description?    | Text                       | Glossary copy                                                                                                   |
| benefits        | String[]                   |                                                                                                                 |
| cautions?       | Text                       |                                                                                                                 |
| pregnancySafe   | Boolean?                   | Null = unknown → treated as NOT safe by the engine                                                              |
| isFragrance     | Boolean default false      | Includes essential oils/allergens                                                                               |
| isAnimalDerived | Boolean default false      | For the vegan filter                                                                                            |
| irritancyLevel  | Int default 0              | 0–3, used by sensitivity scoring                                                                                |
| imageKey?       | String                     | Asset manifest key                                                                                              |
| status          | String default 'PUBLISHED' | `DRAFT` when auto-created from an INCI paste                                                                    |
| archivedAt?     |                            |                                                                                                                 |

IX: GIN trigram `(inciName)`, GIN `(aliases)`.

#### `ProductIngredient` (`product_ingredients`)

| Field            | Type                  | Notes                                  |
| ---------------- | --------------------- | -------------------------------------- |
| productId        | FK, `Cascade`         | Composite PK (productId, ingredientId) |
| ingredientId     | FK, `Restrict`        |                                        |
| position         | Int                   | INCI order                             |
| isKeyActive      | Boolean default false |                                        |
| concentrationBp? | Int                   | Basis points (1000 = 10%)              |

IX: `(ingredientId)` (for "products containing X"), `(productId, position)`.

#### `IngredientConflict` (`ingredient_conflicts`)

Stored once per unordered pair. CK: `ingredient_a_id < ingredient_b_id`.

| Field                         | Type                       | Notes                                                                     |
| ----------------------------- | -------------------------- | ------------------------------------------------------------------------- |
| id                            | PK                         |                                                                           |
| ingredientAId / ingredientBId | FK → Ingredient, `Cascade` | UQ (a, b)                                                                 |
| severity                      | String                     | `avoid_same_routine` (split AM/PM), `avoid_same_day`, `caution`           |
| reason                        | String                     | Shown to users: "Both are strong exfoliants; combined they can irritate." |

Seeded examples: retinal ↔ salicylic acid (avoid_same_routine), retinal ↔ ethyl ascorbic acid (avoid_same_routine → vitamin C AM, retinal PM), retinal ↔ azelaic acid (caution), salicylic ↔ glycolic (avoid_same_routine).

#### `Concern` (`concerns`)

| Field       | Type   | Notes                                                                                                                                                   |
| ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id          | PK     |                                                                                                                                                         |
| slug        | UQ     | `acne`, `post-acne-marks`, `dullness`, `pigmentation`, `redness`, `dryness`, `dehydration`, `oiliness`, `pores`, `fine-lines`, `texture`, `sensitivity` |
| name        | String |                                                                                                                                                         |
| description | Text   | SEO hub copy                                                                                                                                            |
| iconKey     | String |                                                                                                                                                         |
| position    | Int    |                                                                                                                                                         |

#### `ProductConcern` (`product_concerns`)

PK (productId, concernId). Field `efficacy Int` 1–3 (CK), set by the formulator/admin. IX `(concernId, efficacy DESC)`.

#### `IngredientConcern` (`ingredient_concerns`)

PK (ingredientId, concernId). Field `evidence Int` 1–3 (1 = limited, 3 = strong clinical evidence), plus `minEffectiveBp?` (e.g. niacinamide 200 bp). Used by the rule scorer and in "why this" explanations.

#### `BundleItem` (`bundle_items`)

| Field           | Type                                  | Notes                           |
| --------------- | ------------------------------------- | ------------------------------- |
| id              | PK                                    |                                 |
| bundleProductId | FK → Product (type BUNDLE), `Cascade` |                                 |
| variantId       | FK → ProductVariant, `Restrict`       |                                 |
| quantity        | Int default 1                         | CK > 0                          |
| timeOfDay       | TimeOfDay                             | Display in the routine timeline |
| stepOrder       | Int                                   |                                 |

UQ `(bundleProductId, variantId)`. A bundle's own variant carries the bundle price; stock is derived as `min(component available / qty)`.

#### `SlugRedirect` (`slug_redirects`)

`id`, `entityType` (`product|routine|ingredient|category`), `fromSlug` UQ per type, `toSlug`, `createdAt`. Checked by the PDP when a slug is not found → 301.

### 4.3 Inventory

#### `InventoryItem` (`inventory_items`)

| Field             | Type                              | Notes                                                                |
| ----------------- | --------------------------------- | -------------------------------------------------------------------- |
| id                | PK                                |                                                                      |
| variantId         | FK UQ → ProductVariant, `Cascade` | 1:1                                                                  |
| onHand            | Int default 0                     | Physical stock                                                       |
| reserved          | Int default 0                     | Sum of ACTIVE reservations (denormalized, maintained in the same tx) |
| lowStockThreshold | Int default 20                    |                                                                      |
| version           | Int default 0                     |                                                                      |
| updatedAt         |                                   |                                                                      |

CK: `on_hand >= 0`, `reserved >= 0`, `reserved <= on_hand`. **Available = onHand − reserved** (computed, never stored).
IX: `((on_hand - reserved))` expression index for low-stock queries.

#### `InventoryMovement` (`inventory_movements`), append-only ledger

| Field           | Type                  | Notes                                      |
| --------------- | --------------------- | ------------------------------------------ |
| id              | PK                    |                                            |
| inventoryItemId | FK, `Restrict`        |                                            |
| type            | InventoryMovementType |                                            |
| quantity        | Int                   | Signed delta to onHand. CK `quantity <> 0` |
| balanceAfter    | Int                   | onHand after the movement                  |
| reason?         | String                | Required for ADJUSTMENT/DAMAGE (app-level) |
| reference?      | String                | PO number, order number, refund ID         |
| orderId?        | FK → Order, `SetNull` |                                            |
| actorId?        | FK → User, `SetNull`  | Null = system                              |
| createdAt       |                       |                                            |

IX: `(inventoryItemId, createdAt DESC)`, `(orderId)`. No updates or deletes (enforced by a DB trigger raising on UPDATE/DELETE).

#### `InventoryReservation` (`inventory_reservations`)

| Field                   | Type                             | Notes                                                             |
| ----------------------- | -------------------------------- | ----------------------------------------------------------------- |
| id                      | PK                               |                                                                   |
| variantId               | FK → ProductVariant              |                                                                   |
| orderId?                | FK → Order, `Cascade`            | Checkout reservations                                             |
| subscriptionId?         | FK → Subscription, `Cascade`     | Renewal reservations (created at `invoice.upcoming`; see 11 §5.2) |
| invoicePeriodStart?     | DateTime                         | Identifies which renewal a subscription reservation belongs to    |
| quantity                | Int                              | CK > 0                                                            |
| status                  | ReservationStatus default ACTIVE |                                                                   |
| expiresAt               | DateTime                         | Session expiry + 5 min buffer                                     |
| createdAt / resolvedAt? |                                  |                                                                   |

IX: `(status, expiresAt)` for the sweeper; partial UQ `(orderId, variantId) WHERE order_id IS NOT NULL`; partial UQ `(subscriptionId, variantId, invoicePeriodStart) WHERE subscription_id IS NOT NULL`. CK: exactly one of `order_id` / `subscription_id` is set.

### 4.4 Stripe mapping

#### `StripePrice` (`stripe_prices`)

| Field           | Type                           | Notes                                                                 |
| --------------- | ------------------------------ | --------------------------------------------------------------------- |
| id              | PK                             |                                                                       |
| variantId       | FK → ProductVariant, `Cascade` |                                                                       |
| purchaseType    | PurchaseType                   |                                                                       |
| intervalWeeks?  | Int                            | 4/8/12 for SUBSCRIPTION; null for ONE_TIME                            |
| unitAmountCents | Int                            | Amount Stripe will charge (sub price = price × 0.85, rounded half-up) |
| stripeProductId | String                         |                                                                       |
| stripePriceId   | String UQ                      |                                                                       |
| active          | Boolean                        | Old prices set inactive on price change (Stripe prices are immutable) |
| createdAt       |                                |                                                                       |

Partial UQ: `(variant_id, purchase_type, coalesce(interval_weeks,0)) WHERE active`.

### 4.5 Cart & wishlist

#### `Cart` (`carts`)

| Field                      | Type                      | Notes                                          |
| -------------------------- | ------------------------- | ---------------------------------------------- |
| id                         | PK                        | Also the value of the guest cookie (signed)    |
| userId?                    | FK → User, `Cascade`      |                                                |
| status                     | CartStatus default ACTIVE |                                                |
| couponId?                  | FK → Coupon, `SetNull`    | Applied coupon                                 |
| subscriptionIntervalWeeks? | Int                       | Cart-level interval for sub lines (FR-CART-03) |
| currency                   | Char(3) default USD       |                                                |
| lastActivityAt             | DateTime                  |                                                |
| createdAt / updatedAt      |                           |                                                |

Partial UQ: `(user_id) WHERE status = 'ACTIVE'`. IX `(status, lastActivityAt)` for cleanup (guest carts inactive for 60 days are deleted).

#### `CartItem` (`cart_items`)

| Field           | Type                                | Notes                                                            |
| --------------- | ----------------------------------- | ---------------------------------------------------------------- |
| id              | PK                                  |                                                                  |
| cartId          | FK, `Cascade`                       |                                                                  |
| variantId       | FK → ProductVariant, `Cascade`      |                                                                  |
| quantity        | Int                                 | CK 1–10                                                          |
| purchaseType    | PurchaseType default ONE_TIME       |                                                                  |
| consultationId? | FK → RoutineConsultation, `SetNull` | Links to the AI routine for the routine discount and attribution |
| routineTier?    | RoutineTier                         |                                                                  |
| addedAt         | DateTime                            |                                                                  |

UQ `(cartId, variantId, purchaseType)`.

#### `Wishlist` (`wishlists`) / `WishlistItem` (`wishlist_items`)

Wishlist: `id`, `userId` FK UQ `Cascade`, `shareToken` UQ? (P2), timestamps.
WishlistItem: `id`, `wishlistId` FK `Cascade`, `productId` FK `Cascade`, `variantId?` FK `SetNull`, `createdAt`; UQ `(wishlistId, productId)`.

### 4.6 Orders

#### `Order` (`orders`)

| Field                             | Type                                | Notes                                                                                                                                                                                                                                                                                                                                |
| --------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| id                                | PK                                  |                                                                                                                                                                                                                                                                                                                                      |
| number?                           | Int UQ                              | `nextval('order_number_seq')` starting at 100001, **assigned in `markPaid`** (review R-12). Pending and expired checkout attempts have no number, so customer-visible numbers are gap-free for real orders and abandoned checkouts don't pollute the order list. CK `status IN ('PENDING_PAYMENT','EXPIRED') OR number IS NOT NULL`. |
| type                              | OrderType default STANDARD          |                                                                                                                                                                                                                                                                                                                                      |
| status                            | OrderStatus default PENDING_PAYMENT | Fulfilment lifecycle                                                                                                                                                                                                                                                                                                                 |
| paymentStatus                     | PaymentStatus default PENDING       | Money lifecycle (orthogonal to fulfilment)                                                                                                                                                                                                                                                                                           |
| userId?                           | FK → User, `SetNull`                | Null for guests                                                                                                                                                                                                                                                                                                                      |
| email?                            | citext                              | Contact email. A guest's email is unknown until Stripe collects it, so this is **nullable while PENDING_PAYMENT** (review R-11). Signed-in users are pre-filled. CK `status IN ('PENDING_PAYMENT','EXPIRED') OR email IS NOT NULL`.                                                                                                  |
| cartId?                           | FK → Cart, `SetNull`                |                                                                                                                                                                                                                                                                                                                                      |
| cartHash?                         | String                              | Hash of the lines + coupon, used to reuse pending orders                                                                                                                                                                                                                                                                             |
| subscriptionId?                   | FK → Subscription, `SetNull`        | For renewals and the initial subscription order                                                                                                                                                                                                                                                                                      |
| currency                          | Char(3)                             |                                                                                                                                                                                                                                                                                                                                      |
| subtotalCents                     | Int                                 | Sum of line totals before order-level discounts                                                                                                                                                                                                                                                                                      |
| discountCents                     | Int default 0                       | All discounts (routine, coupon)                                                                                                                                                                                                                                                                                                      |
| shippingCents                     | Int                                 |                                                                                                                                                                                                                                                                                                                                      |
| taxCents                          | Int default 0                       | From Stripe Tax                                                                                                                                                                                                                                                                                                                      |
| totalCents                        | Int                                 | CK `total_cents = subtotal_cents - discount_cents + shipping_cents + tax_cents`                                                                                                                                                                                                                                                      |
| refundedCents                     | Int default 0                       | CK `refunded_cents <= total_cents`                                                                                                                                                                                                                                                                                                   |
| shippingAddress?                  | Jsonb                               | Snapshot {fullName, line1, …} from Stripe                                                                                                                                                                                                                                                                                            |
| billingAddress?                   | Jsonb                               |                                                                                                                                                                                                                                                                                                                                      |
| shippingMethod?                   | String                              |                                                                                                                                                                                                                                                                                                                                      |
| stripeCheckoutSessionId?          | String UQ                           |                                                                                                                                                                                                                                                                                                                                      |
| stripePaymentIntentId?            | String UQ                           |                                                                                                                                                                                                                                                                                                                                      |
| stripeInvoiceId?                  | String UQ                           | Renewals                                                                                                                                                                                                                                                                                                                             |
| attribution?                      | Jsonb                               | {firstTouch:{utm…}, lastTouch:{…}, finderConsultationId}                                                                                                                                                                                                                                                                             |
| needsAttention                    | Boolean default false               |                                                                                                                                                                                                                                                                                                                                      |
| attentionReason?                  | String                              | e.g. `stock_shortfall_after_payment`                                                                                                                                                                                                                                                                                                 |
| placedAt? / paidAt? / canceledAt? | DateTime                            |                                                                                                                                                                                                                                                                                                                                      |
| version                           | Int default 0                       |                                                                                                                                                                                                                                                                                                                                      |
| createdAt / updatedAt             |                                     |                                                                                                                                                                                                                                                                                                                                      |

IX: `(userId, createdAt DESC)`, `(status, paidAt)`, `(email)`, `(paidAt)` for analytics, `(needsAttention) WHERE needs_attention`.
**Cleanup:** `EXPIRED` checkout attempts older than 30 days are deleted by a nightly job, after their counts are captured in `DailyStoreMetric.checkoutStarted`. Admin order lists exclude `PENDING_PAYMENT`/`EXPIRED` by default (an "Abandoned checkouts" view shows them).

**Two orthogonal state machines** (in `features/orders/server/state-machine.ts`). Fulfilment and money are tracked separately. This avoids ambiguous combined states such as "shipped but partially refunded".

```
status (fulfilment):
  PENDING_PAYMENT → PAID | EXPIRED | CANCELED
  PAID            → PROCESSING | CANCELED (requires full refund)
  PROCESSING      → SHIPPED | CANCELED (requires full refund)
  SHIPPED         → DELIVERED
  EXPIRED, CANCELED, DELIVERED → terminal (DELIVERED may still be refunded)

paymentStatus (money, driven only by Stripe webhooks):
  PENDING → SUCCEEDED | FAILED
  SUCCEEDED → PARTIALLY_REFUNDED | REFUNDED
  PARTIALLY_REFUNDED → PARTIALLY_REFUNDED (additional) | REFUNDED
```

The admin UI shows both as badges ("Shipped" + "Partially refunded").

#### `OrderItem` (`order_items`)

| Field                           | Type                             | Notes                                                               |
| ------------------------------- | -------------------------------- | ------------------------------------------------------------------- |
| id                              | PK                               |                                                                     |
| orderId                         | FK, `Cascade`                    |                                                                     |
| variantId?                      | FK → ProductVariant, `SetNull`   |                                                                     |
| productId?                      | FK → Product, `SetNull`          |                                                                     |
| productName / variantName / sku | String                           | Snapshots                                                           |
| imagePublicId?                  | String                           | Snapshot                                                            |
| purchaseType                    | PurchaseType                     |                                                                     |
| intervalWeeks?                  | Int                              |                                                                     |
| quantity                        | Int                              | CK > 0                                                              |
| unitPriceCents                  | Int                              | List price at purchase                                              |
| discountCents                   | Int default 0                    | Line-level discounts (sub/routine/coupon allocation)                |
| totalCents                      | Int                              | CK `total_cents = unit_price_cents * quantity - discount_cents`     |
| refundedQuantity                | Int default 0                    | CK ≤ quantity                                                       |
| bundleParentId?                 | FK → OrderItem (self), `Cascade` | Bundle component lines point to the bundle line (component price 0) |
| consultationId?                 | String                           | Attribution to the AI routine                                       |

IX: `(orderId)`, `(variantId)`, `(productId)`.

#### `OrderStatusEvent` (`order_status_events`)

`id`, `orderId` FK Cascade, `fromStatus?`, `toStatus`, `actorId?` FK SetNull, `source` (`webhook|admin|system|customer`), `note?`, `createdAt`. IX `(orderId, createdAt)`.

#### `OrderNote` (`order_notes`)

`id`, `orderId`, `authorId` FK User, `body` (≤ 2000), `createdAt`. Staff-only.

#### `Shipment` (`shipments`)

`id`, `orderId` FK Cascade, `carrier` (`usps|ups|fedex|dhl|other`), `trackingNumber`, `trackingUrl` (from a carrier template), `shippedAt`, `deliveredAt?`, `createdById`. IX `(orderId)`.

### 4.7 Payments

#### `Payment` (`payments`)

| Field                          | Type                    | Notes                                         |
| ------------------------------ | ----------------------- | --------------------------------------------- |
| id                             | PK                      |                                               |
| orderId                        | FK → Order, `Restrict`  |                                               |
| provider                       | String default 'stripe' |                                               |
| stripePaymentIntentId?         | String UQ               |                                               |
| stripeChargeId?                | String UQ               |                                               |
| stripeInvoiceId?               | String                  |                                               |
| amountCents                    | Int                     |                                               |
| currency                       | Char(3)                 |                                               |
| status                         | PaymentStatus           |                                               |
| method?                        | String                  | `card`, `apple_pay`, `link`                   |
| cardBrand? / cardLast4?        | String                  | Display only (from Stripe; not PCI-sensitive) |
| receiptUrl?                    | String                  |                                               |
| failureCode? / failureMessage? | String                  |                                               |
| createdAt / updatedAt          |                         |                                               |

#### `Refund` (`refunds`)

| Field                 | Type                     | Notes                                                                   |
| --------------------- | ------------------------ | ----------------------------------------------------------------------- |
| id                    | PK                       |                                                                         |
| paymentId             | FK → Payment, `Restrict` |                                                                         |
| orderId               | FK → Order               |                                                                         |
| stripeRefundId        | String UQ                |                                                                         |
| amountCents           | Int                      | CK > 0                                                                  |
| reason                | String                   | `requested_by_customer`, `damaged`, `wrong_item`, `irritation`, `other` |
| note?                 | String                   |                                                                         |
| restock               | Boolean                  |                                                                         |
| lines?                | Jsonb                    | [{orderItemId, quantity}]                                               |
| status                | RefundStatus             |                                                                         |
| initiatedById         | FK → User                |                                                                         |
| createdAt / updatedAt |                          |                                                                         |

#### `WebhookEvent` (`webhook_events`), idempotency and audit for inbound webhooks

| Field                     | Type          | Notes                                                                    |
| ------------------------- | ------------- | ------------------------------------------------------------------------ |
| id                        | String PK     | **Provider event ID** (`evt_…`, `svix-id`), so duplicates fail on insert |
| provider                  | String        | `stripe`, `clerk`                                                        |
| type                      | String        |                                                                          |
| payload                   | Jsonb         | Trimmed payload (PII fields dropped after 30 days by a retention job)    |
| status                    | String        | `received`, `processed`, `failed`, `ignored`                             |
| attempts                  | Int default 0 |                                                                          |
| error?                    | Text          |                                                                          |
| receivedAt / processedAt? | DateTime      |                                                                          |

IX `(provider, type, receivedAt)`, `(status) WHERE status='failed'`.

### 4.8 Subscriptions

#### `Subscription` (`subscriptions`)

| Field                                 | Type                                | Notes                                                                      |
| ------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------- |
| id                                    | PK                                  |                                                                            |
| userId                                | FK → User, `Restrict`               | Subscriptions require an account (created at checkout if guest; see 11 §5) |
| stripeSubscriptionId                  | String UQ                           |                                                                            |
| stripeCustomerId                      | String                              |                                                                            |
| status                                | SubscriptionStatus                  |                                                                            |
| intervalWeeks                         | Int                                 | CK IN (4, 8, 12)                                                           |
| currentPeriodStart / currentPeriodEnd | DateTime                            |                                                                            |
| nextChargeAt?                         | DateTime                            | Reflects skips and pauses                                                  |
| pausedUntil?                          | DateTime                            |                                                                            |
| cancelAtPeriodEnd                     | Boolean default false               |                                                                            |
| canceledAt?                           | DateTime                            |                                                                            |
| cancelReason? / cancelFeedback?       | String                              |                                                                            |
| skipCount                             | Int default 0                       | Consecutive skips (at-risk signal)                                         |
| shippingAddress                       | Jsonb                               | Snapshot; editable                                                         |
| originOrderId?                        | FK → Order, `SetNull`               |                                                                            |
| consultationId?                       | FK → RoutineConsultation, `SetNull` |                                                                            |
| name                                  | String                              | "Clear Skin Routine Plan" (display)                                        |
| version                               | Int                                 |                                                                            |
| createdAt / updatedAt                 |                                     |                                                                            |

IX: `(userId, status)`, `(status, nextChargeAt)` (forecast and committed-stock query).

#### `SubscriptionItem` (`subscription_items`)

`id`, `subscriptionId` FK Cascade, `variantId` FK Restrict, `stripeSubscriptionItemId` UQ, `stripePriceId`, `quantity` (CK 1–10), `unitAmountCents`, timestamps. UQ `(subscriptionId, variantId)`.

#### `SubscriptionEvent` (`subscription_events`)

`id`, `subscriptionId`, `type` (`created|skipped|paused|resumed|interval_changed|item_swapped|item_added|payment_failed|renewed|cancel_requested|canceled|save_offer_accepted`), `data Jsonb`, `actorId?`, `source`, `createdAt`. Drives churn analytics and the customer timeline.

### 4.9 Reviews

#### `Review` (`reviews`)

| Field                         | Type                         | Notes                                    |
| ----------------------------- | ---------------------------- | ---------------------------------------- |
| id                            | PK                           |                                          |
| productId                     | FK → Product, `Cascade`      |                                          |
| userId?                       | FK → User, `SetNull`         | Null after anonymized deletion           |
| orderItemId?                  | FK → OrderItem, `SetNull`    | Verification proof                       |
| rating                        | Int                          | CK 1–5                                   |
| title                         | String                       | ≤ 80                                     |
| body                          | Text                         | 30–2000 (CK on length)                   |
| skinType?                     | SkinType                     |                                          |
| concerns                      | String[]                     |                                          |
| usageDuration?                | String                       | `<2w`, `2-4w`, `1-3m`, `3m+`             |
| wouldRecommend                | Boolean                      |                                          |
| status                        | ReviewStatus default PENDING |                                          |
| moderationFlags               | String[]                     | `profanity`, `pii`, `low_rating`, `link` |
| rejectionReason?              | String                       |                                          |
| isFeatured                    | Boolean default false        |                                          |
| helpfulCount                  | Int default 0                |                                          |
| displayName                   | String                       | "Maya C." (derived at submit, editable)  |
| moderatedById? / moderatedAt? |                              |                                          |
| createdAt / updatedAt         |                              |                                          |

UQ `(productId, userId)`. IX `(productId, status, createdAt DESC)`, `(productId, status, rating)`, `(status, createdAt)` for the moderation queue.

#### `ReviewImage` (`review_images`)

`id`, `reviewId` FK Cascade, `publicId`, `width`, `height`, `alt`, `position`. Max 3 per review (app-level check + trigger).

### 4.10 Coupons

#### `Coupon` (`coupons`)

| Field                                    | Type                  | Notes                                                      |
| ---------------------------------------- | --------------------- | ---------------------------------------------------------- |
| id                                       | PK                    |                                                            |
| code                                     | citext UQ             |                                                            |
| description?                             | String                | Internal                                                   |
| type                                     | CouponType            |                                                            |
| valueBp?                                 | Int                   | For PERCENTAGE (CK 1–10000)                                |
| valueCents?                              | Int                   | For FIXED_AMOUNT                                           |
| minSubtotalCents?                        | Int                   |                                                            |
| maxDiscountCents?                        | Int                   | Cap for percentage coupons                                 |
| appliesTo                                | String default 'all'  | `all`, `categories`, `products`, `routines_only`           |
| eligibleCategoryIds / eligibleProductIds | String[]              |                                                            |
| appliesToSubscriptions                   | Boolean default false | If true, also applies to the first subscription order only |
| firstOrderOnly                           | Boolean default false |                                                            |
| exclusive                                | Boolean default false | Doesn't stack with the routine discount                    |
| maxRedemptions?                          | Int                   | Global cap                                                 |
| perCustomerLimit                         | Int default 1         |                                                            |
| redemptionCount                          | Int default 0         | Incremented in the markPaid tx with `FOR UPDATE`           |
| startsAt? / expiresAt?                   | DateTime              |                                                            |
| campaign?                                | String                | Attribution                                                |
| isActive                                 | Boolean default true  |                                                            |
| singleUseGenerated                       | Boolean default false | Win-back and newsletter codes                              |
| createdById                              | FK → User             |                                                            |
| archivedAt?                              |                       |                                                            |
| createdAt / updatedAt                    |                       |                                                            |

CK: `(type='PERCENTAGE' AND value_bp IS NOT NULL) OR (type='FIXED_AMOUNT' AND value_cents IS NOT NULL) OR type='FREE_SHIPPING'`; `redemption_count <= coalesce(max_redemptions, redemption_count)`.
IX: `(isActive, expiresAt)`, `(campaign)`.

#### `CouponRedemption` (`coupon_redemptions`)

`id`, `couponId` FK Restrict, `orderId` FK Cascade UQ (one coupon per order), `userId?`, `email` citext, `discountCents`, `createdAt`. IX `(couponId, userId)`, `(couponId, email)` for per-customer limits (guests are counted by email).

### 4.11 AI Routine Finder

#### `RoutineConsultation` (`routine_consultations`)

| Field                        | Type                                         | Notes                                                                                   |
| ---------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| id                           | PK                                           |                                                                                         |
| userId?                      | FK → User, `Cascade` (deleted with the user) |                                                                                         |
| anonymousId?                 | String                                       | From the `nura_consult` cookie (random 128-bit)                                         |
| status                       | ConsultationStatus                           |                                                                                         |
| source?                      | String                                       | `home_hero`, `pdp_banner`, `email_checkin`, …                                           |
| parentId?                    | FK → self, `SetNull`                         | Re-consultation lineage                                                                 |
| questionnaireVersion         | String                                       | e.g. `q-2026.09`                                                                        |
| answers                      | Jsonb                                        | Raw answers keyed by step ID (Zod `AnswersSchema`)                                      |
| lastStep?                    | String                                       | For drop-off analytics                                                                  |
| profile?                     | Jsonb                                        | Normalized SkinProfile                                                                  |
| safetyFlags                  | String[]                                     | `pregnancy`, `prescription_retinoid`, `possible_rosacea`, `derm_referral`               |
| engine?                      | RecommendationEngine                         |                                                                                         |
| promptVersion? / model?      | String                                       |                                                                                         |
| candidateSnapshot?           | Jsonb                                        | Candidate IDs + scores sent to the LLM (audit and debugging)                            |
| llmRawOutput?                | Jsonb                                        | Validated structured output (retained 90 days, then nulled)                             |
| fallbackReason?              | String                                       | `timeout`, `invalid_output`, `unknown_id`, `conflict`, `rate_limited`, `provider_error` |
| latencyMs?                   | Int                                          |                                                                                         |
| inputTokens? / outputTokens? | Int                                          |                                                                                         |
| completedAt?                 | DateTime                                     |                                                                                         |
| claimedAt?                   | DateTime                                     | When the guest's consultation was attached to a user                                    |
| createdAt / updatedAt        |                                              |                                                                                         |

IX: `(userId, createdAt DESC)`, `(anonymousId)`, `(status, createdAt)`, `(engine, createdAt)`.
CK: `user_id IS NOT NULL OR anonymous_id IS NOT NULL`.

#### `RoutineRecommendation` (`routine_recommendations`), one per tier

| Field            | Type          | Notes                             |
| ---------------- | ------------- | --------------------------------- |
| id               | PK            |                                   |
| consultationId   | FK, `Cascade` |                                   |
| tier             | RoutineTier   | UQ (consultationId, tier)         |
| title            | String        | "Your Clear & Even Routine"       |
| summary          | Text          | AI-written, validated             |
| introductionPlan | Jsonb         | [{weeks:"1-2", instructions:"…"}] |
| excludedProducts | Jsonb         | [{productId, reason}]             |
| totalCents       | Int           | At recommendation time            |
| isRecommended    | Boolean       | The tier highlighted as ★         |

#### `RoutineStep` (`routine_steps`)

| Field                 | Type                            | Notes                                                           |
| --------------------- | ------------------------------- | --------------------------------------------------------------- |
| id                    | PK                              |                                                                 |
| recommendationId      | FK, `Cascade`                   |                                                                 |
| timeOfDay             | TimeOfDay (AM or PM)            |                                                                 |
| slot                  | RoutineSlot                     |                                                                 |
| stepOrder             | Int                             |                                                                 |
| productId             | FK → Product, `Restrict`        |                                                                 |
| variantId?            | FK → ProductVariant, `Restrict` | Null only while `requiresVariantChoice` (e.g. tinted SPF shade) |
| requiresVariantChoice | Boolean default false           | CK `requires_variant_choice OR variant_id IS NOT NULL`          |
| rationale             | Text                            | ≤ 400 chars                                                     |
| rationaleSource       | String default 'TEMPLATE'       | `TEMPLATE` \| `LLM`: phase B replaces templates (12 §4.8)       |
| usage                 | String                          | "2 pumps on damp skin"                                          |
| frequency             | String                          | `daily`, `2x_week`, `3x_week`, `alternate_days`                 |
| matchedConcerns       | String[]                        |                                                                 |
| score                 | Int                             | Rule score (0–100), for transparency and debugging              |
| swappedFromId?        | FK → RoutineStep, `SetNull`     | Swap history                                                    |

UQ `(recommendationId, timeOfDay, stepOrder)`.

### 4.12 Analytics

#### `AnalyticsEvent` (`analytics_events`), append-only; partition-ready

| Field      | Type                    | Notes                                                                                                                                    |
| ---------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| id         | BigInt PK autoincrement |                                                                                                                                          |
| name       | String                  | `finder_step_completed`                                                                                                                  |
| occurredAt | timestamptz             | Partition key (part of the composite PK `(id, occurredAt)`)                                                                              |
| sessionId? | String                  | `nura_sid`, **only when analytics consent was given**. Without consent, events are stored with `sessionId = null` (counted, not linked). |
| userId?    | String                  | No FK (the event store must not block user deletion; anonymized by a job)                                                                |
| path?      | String                  |                                                                                                                                          |
| referrer?  | String                  |                                                                                                                                          |
| properties | Jsonb                   | Validated per event name (Zod registry)                                                                                                  |
| utm?       | Jsonb                   |                                                                                                                                          |
| device?    | String                  | `mobile`, `tablet`, `desktop`                                                                                                            |
| country?   | Char(2)                 | From Vercel geo header                                                                                                                   |

IX: BRIN `(occurredAt)` (cheap on append-only), B-tree `(name, occurredAt)`, `(sessionId)`.
**Volume control (revised in review R-19):** at 100k sessions/month, storing every `page_view` would give ~3M rows/month and reach 20M rows in about 7 months on Neon storage. So:

- **No per-page `page_view` rows.** One `session_started` event per session (with landing path, referrer and UTM), plus **business/funnel events only** (`product_viewed`, `finder_*`, `cart_*`, `checkout_*`, `order_paid`, `subscription_*`). Generic traffic analytics come from Vercel Web Analytics. The result is ≈ 8–12 events/session instead of 30.
- **Declarative monthly partitioning from day one** (`PARTITION BY RANGE (occurred_at)`), created in raw migration SQL. Prisma queries the parent table normally. A monthly Inngest job creates the next partition and **drops partitions older than 13 months** (an instant drop instead of mass DELETEs).

#### Rollup tables (revised in review R-20)

The v1 draft used a single key-value `DailyMetric` with keys like `units:{variantId}`. That is flexible but untyped, and it makes "top products" or "coupon stats" queries awkward. It is split into typed rollups:

| Table                   | Grain (UQ)               | Columns                                                                                                                                                                                                                    |
| ----------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DailyStoreMetric`      | `(date)`                 | `sessions`, `orders`, `revenueCents`, `discountCents`, `refundCents`, `newCustomers`, `checkoutStarted`, `mrrCents`, `activeSubscriptions`, `churnedSubscriptions`, `finderStarted`, `finderCompleted`, `routineAddToCart` |
| `DailyProductMetric`    | `(date, variantId)`      | `units`, `revenueCents`, `refundedUnits`, `views`, `addToCart`                                                                                                                                                             |
| `DailyFinderStepMetric` | `(date, stepId, source)` | `reached`, `completed`, `abandoned`, `avgMs`                                                                                                                                                                               |
| `DailyConcernMetric`    | `(date, concernSlug)`    | `consultations`, `primaryCount`                                                                                                                                                                                            |
| `DailyCouponMetric`     | `(date, couponId)`       | `redemptions`, `discountCents`, `revenueCents`                                                                                                                                                                             |

All are rebuilt idempotently per date (`DELETE … WHERE date = $1` + `INSERT … SELECT` in one transaction). IX `(date)` on each, plus `(variantId, date)` / `(couponId, date)`. References to `DailyMetric` elsewhere in these docs mean this rollup family.

### 4.13 Audit & infrastructure

#### `AuditLog` (`audit_logs`), append-only

| Field            | Type                 | Notes                                                                                                         |
| ---------------- | -------------------- | ------------------------------------------------------------------------------------------------------------- |
| id               | PK                   |                                                                                                               |
| actorId?         | FK → User, `SetNull` | Null = system/webhook                                                                                         |
| actorRole?       | RoleKey              | Snapshot                                                                                                      |
| action           | String               | `product.publish`, `inventory.adjust`, `order.refund`, `coupon.create`, `user.role_change`, `auth.sign_in`, … |
| entityType       | String               |                                                                                                               |
| entityId         | String               |                                                                                                               |
| before? / after? | Jsonb                | Redacted diffs (secrets/PII removed)                                                                          |
| metadata?        | Jsonb                | {reason, amount}                                                                                              |
| ip?              | inet                 |                                                                                                               |
| userAgent?       | String               |                                                                                                               |
| requestId?       | String               |                                                                                                               |
| createdAt        |                      |                                                                                                               |

IX: `(entityType, entityId, createdAt DESC)`, `(actorId, createdAt DESC)`, `(action, createdAt DESC)`. Trigger prevents UPDATE/DELETE. Retention: 2 years.

#### `OutboxEvent` (`outbox_events`)

`id`, `name` (`order.paid`), `payload Jsonb`, `status OutboxStatus`, `attempts`, `availableAt`, `dispatchedAt?`, `lastError?`, `createdAt`. IX `(status, availableAt)`.

#### `EmailLog` (`email_logs`)

`id`, `template`, `toHash` (SHA-256 of the lowercased email), `userId?`, `entityType?`, `entityId?`, `idempotencyKey` UQ, `providerMessageId?`, `status` (`queued|sent|bounced|failed`), `createdAt`.

#### `SignedActionToken` (`signed_action_tokens`)

`id`, `tokenHash` UQ (SHA-256 of the random token; the raw token is only in the email), `action` (`subscription.skip`, `subscription.pause`, `order.view`, `consultation.view`), `subjectId`, `userId?`, `expiresAt`, `usedAt?`, `createdAt`. IX `(expiresAt)`.

#### `NewsletterSubscriber` (`newsletter_subscribers`)

`id`, `email` citext UQ, `status` (`pending|confirmed|unsubscribed`), `source`, `confirmTokenHash?`, `confirmedAt?`, `unsubscribedAt?`, `welcomeCouponId?`, `createdAt`.

#### `BackInStockRequest` (`back_in_stock_requests`) — P2

`id`, `variantId`, `email` citext, `notifiedAt?`, `createdAt`; UQ `(variantId, email)`.

#### `StoreSetting` (`store_settings`)

`key` String PK (`shipping.flat_rate_cents`, `shipping.free_threshold_cents`, `home.hero`, `announcement.bar`, `finder.enabled`, `finder.prompt_version`), `value Jsonb` (Zod-validated per key), `updatedById`, `updatedAt`. Cached with tag `settings`.

---

### 4.14 Support, returns & consent (added in review)

#### `SupportCase` (`support_cases`)

`id`, `type` (`adverse_event|return|general`), `status` (`open|in_progress|resolved`), `userId?` FK SetNull, `email` citext, `orderId?` FK SetNull, `productId?` FK SetNull, `lotNumber?`, `description` Text (≤ 4000), `severity?` (`mild|moderate|serious`; for adverse events), `assigneeId?` FK User, `resolution?` Text, `createdAt`, `updatedAt`. IX `(status, type, createdAt)`. Adverse-event cases are visible only with `customer:read_sensitive`.

#### `ReturnRequest` (`return_requests`)

`id`, `orderId` FK Restrict, `userId` FK, `supportCaseId?` FK, `reason` (`irritation|damaged|wrong_item|not_as_expected|other`), `lines Jsonb` [{orderItemId, quantity}], `photos` String[] (publicIds), `status` (`requested|approved|rejected|refunded`), `refundId?` FK Refund, `decidedById?`, `decidedAt?`, `createdAt`. CK: at most one open request per order (partial UQ `(order_id) WHERE status IN ('requested','approved')`).

#### `ConsentRecord` (`consent_records`)

Append-only. `id`, `userId?`, `anonymousId?`, `type` (`health_data|marketing_email|analytics_cookie`), `granted` Boolean, `policyVersion`, `source` (`finder|account|banner|checkout`), `ipHash`, `createdAt`. The latest record per (subject, type) wins. This replaces the single `sensitiveDataConsentAt`/`marketingConsentAt` timestamps as the source of truth; the timestamps on `User` become denormalized conveniences.

## 5. Critical queries & how the schema serves them

| Query                                                                       | Access path                                                                                                                                                                                           |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PLP: published serums for oily skin with niacinamide, sorted by bestselling | `products(status, category_id)` + GIN `skin_types` + semi-join `product_ingredients(ingredient_id)` + sort on `units_sold_30d`                                                                        |
| PDP by slug                                                                 | `products.slug` UQ; variants by `(product_id, position)`; images by `(product_id, position)`                                                                                                          |
| Available stock for variants in a cart                                      | `inventory_items.variant_id` UQ                                                                                                                                                                       |
| Finder candidate retrieval                                                  | SQL joining products ↔ variants ↔ inventory (available > 0) with filters on pregnancy/fragrance/vegan + `NOT EXISTS` avoid-list ingredient; then `product_concerns` for scoring. Result is ≤ 60 rows. |
| Orders to fulfil                                                            | `orders(status, paid_at)`                                                                                                                                                                             |
| Customer order history                                                      | `orders(user_id, created_at DESC)`                                                                                                                                                                    |
| Low stock                                                                   | expression index on `(on_hand - reserved)`                                                                                                                                                            |
| Committed stock (next 14 days)                                              | `subscriptions(status, next_charge_at)` join `subscription_items`                                                                                                                                     |
| Revenue by day (dashboard)                                                  | `daily_metrics(metric, date)`                                                                                                                                                                         |
| Webhook dedupe                                                              | `webhook_events.id` PK insert with `ON CONFLICT DO NOTHING`                                                                                                                                           |
| Finder funnel                                                               | `daily_metrics` `finder_step:*`; drill-down from `analytics_events(name, occurred_at)`                                                                                                                |

---

## 6. Prisma schema planning

### 6.1 File organisation

Use Prisma's multi-file schema (`prisma/schema/*.prisma`) with one file per domain: `identity.prisma`, `catalog.prisma`, `inventory.prisma`, `commerce.prisma` (cart, order, payment, coupon), `subscriptions.prisma`, `reviews.prisma`, `finder.prisma`, `analytics.prisma`, `infra.prisma`, and `base.prisma` (generator, datasource, enums).

### 6.2 Generator & datasource decisions

- `generator client { provider = "prisma-client"; previewFeatures = ["driverAdapters"(if still preview), "typedSql"]; output = "../src/generated/prisma" }`. The generated client is kept out of `node_modules` for explicit imports.
- `datasource db { provider = "postgresql"; url = env("DATABASE_URL"); directUrl = env("DIRECT_URL"); extensions = [pg_trgm, citext] }`.
- Runtime client: `new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })` singleton in `lib/server/db.ts` (global cached in dev to survive HMR).
- **Transaction requirement (review R-21):** checkout, inventory and coupon logic depend on **interactive transactions with `SELECT … FOR UPDATE`**. These need a session-capable connection: the Neon adapter's **WebSocket/Pool mode** (or a standard `pg` pool via `@prisma/adapter-pg` on Node runtime), **never the HTTP one-shot mode**. With Vercel Fluid compute, the pool is created once per instance (`max: 5`, idle timeout 10 s), and `attachDatabasePool` from `@vercel/functions` releases idle clients before suspension. This is verified in M1 by a test that holds a row lock in one transaction and asserts that a second transaction blocks.

### 6.3 Modelling rules

| Rule                                                   | Example                                                                                                                                                                                                   |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@@map`/`@map` to snake_case                           | `model OrderItem { unitPriceCents Int @map("unit_price_cents") … @@map("order_items") }`                                                                                                                  |
| `@db.` native types                                    | `@db.Char(3)` currency, `@db.Citext` email/code, `@db.Timestamptz(3)` all timestamps, `@db.Text` long text                                                                                                |
| Unsupported types                                      | `searchVector Unsupported("tsvector")?`, `ip Unsupported("inet")?`; queried via TypedSQL                                                                                                                  |
| Partial unique indexes / CHECKs / triggers / sequences | Added in **hand-edited migration SQL** (`prisma migrate dev --create-only`, then edit). Each is documented in `prisma/migrations/README.md`.                                                              |
| Relation actions                                       | Explicit `onDelete` on every relation, per §4                                                                                                                                                             |
| Self-relations                                         | `RoutineConsultation.parent` / `children` named `"ConsultationLineage"`; `OrderItem.bundleParent` named `"BundleComponents"`; `IngredientConflict` with two named relations `"ConflictA"` / `"ConflictB"` |
| Json typing                                            | `prisma-json-types-generator` with `/// [ShippingAddress]` comments, backed by Zod schemas in `src/lib/json-types.ts`                                                                                     |
| Decimal avoided                                        | Only `ratingAvg` uses `Decimal(3,2)`                                                                                                                                                                      |
| Enum changes                                           | Additive only in minor releases; removals require a 2-step migration                                                                                                                                      |

### 6.4 Representative model (planning shape, not final code)

```prisma
model InventoryItem {
  id                String              @id @default(cuid(2))
  variantId         String              @unique @map("variant_id")
  variant           ProductVariant      @relation(fields: [variantId], references: [id], onDelete: Cascade)
  onHand            Int                 @default(0) @map("on_hand")
  reserved          Int                 @default(0)
  lowStockThreshold Int                 @default(20) @map("low_stock_threshold")
  version           Int                 @default(0)
  movements         InventoryMovement[]
  updatedAt         DateTime            @updatedAt @map("updated_at") @db.Timestamptz(3)
  @@map("inventory_items")
  // CHECK (on_hand >= 0 AND reserved >= 0 AND reserved <= on_hand) — in migration SQL
}
```

### 6.5 Migration strategy (summary; full in `20-deployment-strategy.md`)

- `prisma migrate dev` locally against your own Neon branch. `prisma migrate deploy` runs in CI for preview branches and in a gated GitHub Action for production (never from Vercel build).
- **Expand → migrate → contract** for breaking changes (add the new column → dual-write → backfill job → switch reads → drop the old column in a later release).
- Seeds are idempotent upserts keyed by slug/SKU, so they are safe to re-run in staging.

### 6.6 Seed data plan

| Seed                          | Volume                                                 | Purpose                        |
| ----------------------------- | ------------------------------------------------------ | ------------------------------ |
| Roles                         | 5                                                      | RBAC                           |
| Staff users                   | 4 (one per staff role) linked to Clerk test users      | Demo logins                    |
| Categories / Concerns         | 5 / 12                                                 |                                |
| Ingredients                   | ~60 with concern evidence, 12 conflict pairs           | Engine accuracy                |
| Products / variants / bundles | 14 / 20 / 5                                            | Launch catalogue (see 02 §2.1) |
| Inventory                     | Realistic levels, 2 variants low-stock, 1 out of stock | Demo alerts and empty states   |
| Customers                     | 300 synthetic (faker, deterministic seed)              | Analytics demo                 |
| Orders                        | ~1,800 over 6 months with seasonality                  | Charts look real               |
| Subscriptions                 | ~220 in mixed states                                   | MRR/churn widgets              |
| Reviews                       | ~400 with skin-type distribution                       | PDP social proof               |
| Consultations                 | ~2,500 incl. abandoned at various steps                | Finder funnel                  |
| DailyMetric                   | Computed by running the rollup over seeded data        |                                |

---

## 7. Implementation notes (M1, as built)

The schema in `prisma/schema/*.prisma` implements this document with these deliberate additions and clarifications:

| Item                                                                                           | Detail                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Product.textures String[]`                                                                    | Texture tags (gel, cream, balm, fluid, tinted…) used by the finder's texture/climate fit (12 §4.4).                                                           |
| `CartItem.seenPriceCents`                                                                      | Price at add time; drives the "price updated" notice (FR-CHK-07).                                                                                             |
| `RoutineStep.rationaleSource`                                                                  | `TEMPLATE` or `LLM` (two-phase output, 12 §4.8).                                                                                                              |
| Enums `SupportCaseType`, `SupportCaseStatus`, `ReturnStatus`, `ConsentType`, `RationaleSource` | Replace the free-text status columns from §4.14.                                                                                                              |
| Soft actor references                                                                          | Actor/audit columns are plain IDs without FKs (see `prisma/migrations/README.md`).                                                                            |
| Order CHECKs                                                                                   | `paid_at IS NULL OR number IS NOT NULL` and `… OR email IS NOT NULL` (instead of status lists), because an order cancelled before payment also has no number. |
| Runtime adapter                                                                                | `@prisma/adapter-pg` (node-postgres pool) for local and Neon (ADR-0019).                                                                                      |
