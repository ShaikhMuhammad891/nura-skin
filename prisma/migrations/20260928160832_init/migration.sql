-- ── Hand-edited (see prisma/migrations/README.md) ──────────────────────────
-- Extensions must exist before CITEXT columns / trigram indexes are created.
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "RoleKey" AS ENUM ('CUSTOMER', 'SUPPORT', 'MARKETING_MANAGER', 'INVENTORY_MANAGER', 'ADMIN', 'DEMO_STAFF');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('SINGLE', 'BUNDLE');

-- CreateEnum
CREATE TYPE "RoutineSlot" AS ENUM ('CLEANSE', 'TREAT', 'MOISTURIZE', 'PROTECT');

-- CreateEnum
CREATE TYPE "TimeOfDay" AS ENUM ('AM', 'PM', 'BOTH');

-- CreateEnum
CREATE TYPE "SkinType" AS ENUM ('DRY', 'OILY', 'COMBINATION', 'NORMAL');

-- CreateEnum
CREATE TYPE "PurchaseType" AS ENUM ('ONE_TIME', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'MERGED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('STANDARD', 'SUBSCRIPTION_RENEWAL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('INCOMPLETE', 'ACTIVE', 'PAUSED', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('INITIAL', 'RECEIVE', 'SALE', 'RETURN_RESTOCK', 'ADJUSTMENT', 'DAMAGE');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'COMMITTED', 'RELEASED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING');

-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "RecommendationEngine" AS ENUM ('LLM', 'RULES_FALLBACK');

-- CreateEnum
CREATE TYPE "RoutineTier" AS ENUM ('ESSENTIAL', 'COMPLETE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "RationaleSource" AS ENUM ('TEMPLATE', 'LLM');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'DISPATCHED', 'FAILED');

-- CreateEnum
CREATE TYPE "SupportCaseType" AS ENUM ('ADVERSE_EVENT', 'RETURN', 'GENERAL');

-- CreateEnum
CREATE TYPE "SupportCaseStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('HEALTH_DATA', 'MARKETING_EMAIL', 'ANALYTICS_COOKIE');

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "session_id" TEXT,
    "user_id" TEXT,
    "path" TEXT,
    "referrer" TEXT,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "utm" JSONB,
    "device" TEXT,
    "country" CHAR(2),

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id","occurred_at")
) PARTITION BY RANGE ("occurred_at"); -- hand-edited: monthly partitions (review R-19)

-- CreateTable
CREATE TABLE "daily_store_metrics" (
    "date" DATE NOT NULL,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "revenue_cents" BIGINT NOT NULL DEFAULT 0,
    "discount_cents" BIGINT NOT NULL DEFAULT 0,
    "refund_cents" BIGINT NOT NULL DEFAULT 0,
    "new_customers" INTEGER NOT NULL DEFAULT 0,
    "checkout_started" INTEGER NOT NULL DEFAULT 0,
    "mrr_cents" BIGINT NOT NULL DEFAULT 0,
    "active_subscriptions" INTEGER NOT NULL DEFAULT 0,
    "churned_subscriptions" INTEGER NOT NULL DEFAULT 0,
    "finder_started" INTEGER NOT NULL DEFAULT 0,
    "finder_completed" INTEGER NOT NULL DEFAULT 0,
    "routine_add_to_cart" INTEGER NOT NULL DEFAULT 0,
    "computed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_store_metrics_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "daily_product_metrics" (
    "date" DATE NOT NULL,
    "variant_id" TEXT NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 0,
    "revenue_cents" BIGINT NOT NULL DEFAULT 0,
    "refunded_units" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "add_to_cart" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_product_metrics_pkey" PRIMARY KEY ("date","variant_id")
);

-- CreateTable
CREATE TABLE "daily_finder_step_metrics" (
    "date" DATE NOT NULL,
    "step_id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'all',
    "reached" INTEGER NOT NULL DEFAULT 0,
    "completed" INTEGER NOT NULL DEFAULT 0,
    "abandoned" INTEGER NOT NULL DEFAULT 0,
    "avg_ms" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_finder_step_metrics_pkey" PRIMARY KEY ("date","step_id","source")
);

-- CreateTable
CREATE TABLE "daily_concern_metrics" (
    "date" DATE NOT NULL,
    "concern_slug" TEXT NOT NULL,
    "consultations" INTEGER NOT NULL DEFAULT 0,
    "primary_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_concern_metrics_pkey" PRIMARY KEY ("date","concern_slug")
);

-- CreateTable
CREATE TABLE "daily_coupon_metrics" (
    "date" DATE NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "redemptions" INTEGER NOT NULL DEFAULT 0,
    "discount_cents" BIGINT NOT NULL DEFAULT 0,
    "revenue_cents" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "daily_coupon_metrics_pkey" PRIMARY KEY ("date","coupon_id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "routine_slot" "RoutineSlot",
    "position" INTEGER NOT NULL DEFAULT 0,
    "hero_image_key" TEXT,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subtitle" TEXT,
    "type" "ProductType" NOT NULL DEFAULT 'SINGLE',
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "category_id" TEXT NOT NULL,
    "short_description" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "how_to_use" TEXT NOT NULL,
    "routine_slot" "RoutineSlot",
    "time_of_day" "TimeOfDay" NOT NULL DEFAULT 'BOTH',
    "skin_types" "SkinType"[],
    "textures" TEXT[],
    "pregnancy_safe" BOOLEAN NOT NULL DEFAULT false,
    "fragrance_free" BOOLEAN NOT NULL DEFAULT false,
    "vegan" BOOLEAN NOT NULL DEFAULT false,
    "non_comedogenic" BOOLEAN NOT NULL DEFAULT false,
    "strength_level" INTEGER NOT NULL DEFAULT 1,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "featured_position" INTEGER,
    "badges" TEXT[],
    "rating_avg" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "units_sold_30d" INTEGER NOT NULL DEFAULT 0,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "search_vector" tsvector,
    "published_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "option_type" TEXT NOT NULL,
    "size_ml" INTEGER,
    "shade_hex" TEXT,
    "price_cents" INTEGER NOT NULL,
    "compare_at_price_cents" INTEGER,
    "cost_cents" INTEGER,
    "subscription_eligible" BOOLEAN NOT NULL DEFAULT true,
    "replenish_days" INTEGER NOT NULL DEFAULT 56,
    "weight_grams" INTEGER NOT NULL,
    "barcode" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "public_id" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "alt" TEXT NOT NULL,
    "blur_data_url" TEXT,
    "kind" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "inci_name" CITEXT NOT NULL,
    "common_name" TEXT NOT NULL,
    "aliases" TEXT[],
    "category" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "benefits" TEXT[],
    "cautions" TEXT,
    "pregnancy_safe" BOOLEAN,
    "is_fragrance" BOOLEAN NOT NULL DEFAULT false,
    "is_animal_derived" BOOLEAN NOT NULL DEFAULT false,
    "irritancy_level" INTEGER NOT NULL DEFAULT 0,
    "image_key" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_ingredients" (
    "product_id" TEXT NOT NULL,
    "ingredient_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "is_key_active" BOOLEAN NOT NULL DEFAULT false,
    "concentration_bp" INTEGER,

    CONSTRAINT "product_ingredients_pkey" PRIMARY KEY ("product_id","ingredient_id")
);

-- CreateTable
CREATE TABLE "ingredient_conflicts" (
    "id" TEXT NOT NULL,
    "ingredient_a_id" TEXT NOT NULL,
    "ingredient_b_id" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "ingredient_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concerns" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon_key" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "concerns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_concerns" (
    "product_id" TEXT NOT NULL,
    "concern_id" TEXT NOT NULL,
    "efficacy" INTEGER NOT NULL,

    CONSTRAINT "product_concerns_pkey" PRIMARY KEY ("product_id","concern_id")
);

-- CreateTable
CREATE TABLE "ingredient_concerns" (
    "ingredient_id" TEXT NOT NULL,
    "concern_id" TEXT NOT NULL,
    "evidence" INTEGER NOT NULL,
    "min_effective_bp" INTEGER,

    CONSTRAINT "ingredient_concerns_pkey" PRIMARY KEY ("ingredient_id","concern_id")
);

-- CreateTable
CREATE TABLE "bundle_items" (
    "id" TEXT NOT NULL,
    "bundle_product_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "time_of_day" "TimeOfDay" NOT NULL,
    "step_order" INTEGER NOT NULL,

    CONSTRAINT "bundle_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slug_redirects" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "from_slug" TEXT NOT NULL,
    "to_slug" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slug_redirects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_prices" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "purchase_type" "PurchaseType" NOT NULL,
    "interval_weeks" INTEGER,
    "unit_amount_cents" INTEGER NOT NULL,
    "stripe_product_id" TEXT NOT NULL,
    "stripe_price_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "coupon_id" TEXT,
    "subscription_interval_weeks" INTEGER,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "last_activity_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cart_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "purchase_type" "PurchaseType" NOT NULL DEFAULT 'ONE_TIME',
    "consultation_id" TEXT,
    "routine_tier" "RoutineTier",
    "seen_price_cents" INTEGER,
    "added_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "share_token" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_items" (
    "id" TEXT NOT NULL,
    "wishlist_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "number" INTEGER,
    "type" "OrderType" NOT NULL DEFAULT 'STANDARD',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "user_id" TEXT,
    "email" CITEXT,
    "cart_id" TEXT,
    "cart_hash" TEXT,
    "subscription_id" TEXT,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "subtotal_cents" INTEGER NOT NULL,
    "discount_cents" INTEGER NOT NULL DEFAULT 0,
    "shipping_cents" INTEGER NOT NULL,
    "tax_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL,
    "refunded_cents" INTEGER NOT NULL DEFAULT 0,
    "shipping_address" JSONB,
    "billing_address" JSONB,
    "shipping_method" TEXT,
    "stripe_checkout_session_id" TEXT,
    "stripe_payment_intent_id" TEXT,
    "stripe_invoice_id" TEXT,
    "attribution" JSONB,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "needs_attention" BOOLEAN NOT NULL DEFAULT false,
    "attention_reason" TEXT,
    "placed_at" TIMESTAMPTZ(3),
    "paid_at" TIMESTAMPTZ(3),
    "canceled_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "product_id" TEXT,
    "product_name" TEXT NOT NULL,
    "variant_name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "image_public_id" TEXT,
    "purchase_type" "PurchaseType" NOT NULL,
    "interval_weeks" INTEGER,
    "quantity" INTEGER NOT NULL,
    "unit_price_cents" INTEGER NOT NULL,
    "discount_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL,
    "refunded_quantity" INTEGER NOT NULL DEFAULT 0,
    "bundle_parent_id" TEXT,
    "consultation_id" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_events" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "from_status" "OrderStatus",
    "to_status" "OrderStatus" NOT NULL,
    "actor_id" TEXT,
    "source" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_notes" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "tracking_number" TEXT NOT NULL,
    "tracking_url" TEXT,
    "shipped_at" TIMESTAMPTZ(3) NOT NULL,
    "delivered_at" TIMESTAMPTZ(3),
    "created_by_id" TEXT,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "stripe_payment_intent_id" TEXT,
    "stripe_charge_id" TEXT,
    "stripe_invoice_id" TEXT,
    "amount_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "method" TEXT,
    "card_brand" TEXT,
    "card_last4" TEXT,
    "receipt_url" TEXT,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "stripe_refund_id" TEXT,
    "amount_cents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "restock" BOOLEAN NOT NULL DEFAULT false,
    "lines" JSONB,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "initiated_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "code" CITEXT NOT NULL,
    "description" TEXT,
    "type" "CouponType" NOT NULL,
    "value_bp" INTEGER,
    "value_cents" INTEGER,
    "min_subtotal_cents" INTEGER,
    "max_discount_cents" INTEGER,
    "applies_to" TEXT NOT NULL DEFAULT 'all',
    "eligible_category_ids" TEXT[],
    "eligible_product_ids" TEXT[],
    "applies_to_subscriptions" BOOLEAN NOT NULL DEFAULT false,
    "first_order_only" BOOLEAN NOT NULL DEFAULT false,
    "exclusive" BOOLEAN NOT NULL DEFAULT false,
    "max_redemptions" INTEGER,
    "per_customer_limit" INTEGER NOT NULL DEFAULT 1,
    "redemption_count" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "campaign" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "single_use_generated" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" CITEXT NOT NULL,
    "discount_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_requests" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "support_case_id" TEXT,
    "reason" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "photos" TEXT[],
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "refund_id" TEXT,
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_cases" (
    "id" TEXT NOT NULL,
    "type" "SupportCaseType" NOT NULL,
    "status" "SupportCaseStatus" NOT NULL DEFAULT 'OPEN',
    "user_id" TEXT,
    "email" CITEXT NOT NULL,
    "order_id" TEXT,
    "product_id" TEXT,
    "lot_number" TEXT,
    "description" TEXT NOT NULL,
    "severity" TEXT,
    "assignee_id" TEXT,
    "resolution" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "support_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "user_id" TEXT,
    "order_item_id" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "skin_type" "SkinType",
    "concerns" TEXT[],
    "usage_duration" TEXT,
    "would_recommend" BOOLEAN NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "moderation_flags" TEXT[],
    "rejection_reason" TEXT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "display_name" TEXT NOT NULL,
    "moderated_by_id" TEXT,
    "moderated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_images" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "alt" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "review_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_consultations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "anonymous_id" TEXT,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "source" TEXT,
    "parent_id" TEXT,
    "questionnaire_version" TEXT NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "last_step" TEXT,
    "profile" JSONB,
    "safety_flags" TEXT[],
    "engine" "RecommendationEngine",
    "prompt_version" TEXT,
    "model" TEXT,
    "candidate_snapshot" JSONB,
    "llm_raw_output" JSONB,
    "fallback_reason" TEXT,
    "latency_ms" INTEGER,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "completed_at" TIMESTAMPTZ(3),
    "claimed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "routine_consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_recommendations" (
    "id" TEXT NOT NULL,
    "consultation_id" TEXT NOT NULL,
    "tier" "RoutineTier" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "introduction_plan" JSONB NOT NULL,
    "excluded_products" JSONB NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "is_recommended" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "routine_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_steps" (
    "id" TEXT NOT NULL,
    "recommendation_id" TEXT NOT NULL,
    "time_of_day" "TimeOfDay" NOT NULL,
    "slot" "RoutineSlot" NOT NULL,
    "step_order" INTEGER NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "requires_variant_choice" BOOLEAN NOT NULL DEFAULT false,
    "rationale" TEXT NOT NULL,
    "rationale_source" "RationaleSource" NOT NULL DEFAULT 'TEMPLATE',
    "usage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "matched_concerns" TEXT[],
    "score" INTEGER NOT NULL,
    "swapped_from_id" TEXT,

    CONSTRAINT "routine_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "key" "RoleKey" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerk_id" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "phone" TEXT,
    "role_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT,
    "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
    "marketing_consent_at" TIMESTAMPTZ(3),
    "sensitive_data_consent_at" TIMESTAMPTZ(3),
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "last_seen_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT,
    "full_name" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "country" CHAR(2) NOT NULL,
    "phone" TEXT,
    "is_default_shipping" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "skin_type" "SkinType",
    "concerns" TEXT[],
    "sensitivity" INTEGER,
    "reactions" TEXT[],
    "is_pregnant_or_nursing" BOOLEAN NOT NULL DEFAULT false,
    "uses_prescription_topicals" BOOLEAN NOT NULL DEFAULT false,
    "fragrance_free" BOOLEAN NOT NULL DEFAULT false,
    "vegan" BOOLEAN NOT NULL DEFAULT false,
    "avoid_ingredient_ids" TEXT[],
    "climate" TEXT,
    "sun_exposure" TEXT,
    "routine_time_pref" TEXT,
    "monthly_budget_cents" INTEGER,
    "source_consultation_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_metrics" (
    "user_id" TEXT NOT NULL,
    "orders_count" INTEGER NOT NULL DEFAULT 0,
    "lifetime_value_cents" INTEGER NOT NULL DEFAULT 0,
    "first_order_at" TIMESTAMPTZ(3),
    "last_order_at" TIMESTAMPTZ(3),
    "active_subscriptions" INTEGER NOT NULL DEFAULT 0,
    "lifecycle_stage" TEXT NOT NULL,
    "computed_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_metrics_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "anonymous_id" TEXT,
    "type" "ConsentType" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "policy_version" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "ip_hash" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_role" "RoleKey",
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "ip" inet,
    "user_agent" TEXT,
    "request_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatched_at" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "to_hash" TEXT NOT NULL,
    "user_id" TEXT,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signed_action_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "user_id" TEXT,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signed_action_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "id" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT,
    "confirm_token_hash" TEXT,
    "confirmed_at" TIMESTAMPTZ(3),
    "unsubscribed_at" TIMESTAMPTZ(3),
    "welcome_coupon_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "back_in_stock_requests" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "notified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "back_in_stock_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by_id" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "on_hand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 20,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" TEXT,
    "reference" TEXT,
    "order_id" TEXT,
    "actor_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_reservations" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "order_id" TEXT,
    "subscription_id" TEXT,
    "invoice_period_start" TIMESTAMPTZ(3),
    "quantity" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(3),

    CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "stripe_subscription_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "interval_weeks" INTEGER NOT NULL,
    "current_period_start" TIMESTAMPTZ(3) NOT NULL,
    "current_period_end" TIMESTAMPTZ(3) NOT NULL,
    "next_charge_at" TIMESTAMPTZ(3),
    "paused_until" TIMESTAMPTZ(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "canceled_at" TIMESTAMPTZ(3),
    "cancel_reason" TEXT,
    "cancel_feedback" TEXT,
    "skip_count" INTEGER NOT NULL DEFAULT 0,
    "shipping_address" JSONB NOT NULL,
    "origin_order_id" TEXT,
    "consultation_id" TEXT,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_items" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "stripe_subscription_item_id" TEXT NOT NULL,
    "stripe_price_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_amount_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subscription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_events" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB,
    "actor_id" TEXT,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_events_name_occurred_at_idx" ON "analytics_events"("name", "occurred_at");

-- CreateIndex
CREATE INDEX "analytics_events_session_id_idx" ON "analytics_events"("session_id");

-- CreateIndex
CREATE INDEX "daily_product_metrics_variant_id_date_idx" ON "daily_product_metrics"("variant_id", "date");

-- CreateIndex
CREATE INDEX "daily_coupon_metrics_coupon_id_date_idx" ON "daily_coupon_metrics"("coupon_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_status_category_id_idx" ON "products"("status", "category_id");

-- CreateIndex
CREATE INDEX "products_status_is_featured_featured_position_idx" ON "products"("status", "is_featured", "featured_position");

-- CreateIndex
CREATE INDEX "products_status_units_sold_30d_idx" ON "products"("status", "units_sold_30d" DESC);

-- CreateIndex
CREATE INDEX "products_status_rating_avg_idx" ON "products"("status", "rating_avg" DESC);

-- CreateIndex
CREATE INDEX "products_skin_types_idx" ON "products" USING GIN ("skin_types");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE INDEX "product_variants_product_id_position_idx" ON "product_variants"("product_id", "position");

-- CreateIndex
CREATE INDEX "product_images_product_id_position_idx" ON "product_images"("product_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_slug_key" ON "ingredients"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_inci_name_key" ON "ingredients"("inci_name");

-- CreateIndex
CREATE INDEX "ingredients_aliases_idx" ON "ingredients" USING GIN ("aliases");

-- CreateIndex
CREATE INDEX "product_ingredients_ingredient_id_idx" ON "product_ingredients"("ingredient_id");

-- CreateIndex
CREATE INDEX "product_ingredients_product_id_position_idx" ON "product_ingredients"("product_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_conflicts_ingredient_a_id_ingredient_b_id_key" ON "ingredient_conflicts"("ingredient_a_id", "ingredient_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "concerns_slug_key" ON "concerns"("slug");

-- CreateIndex
CREATE INDEX "product_concerns_concern_id_efficacy_idx" ON "product_concerns"("concern_id", "efficacy" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "bundle_items_bundle_product_id_variant_id_key" ON "bundle_items"("bundle_product_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "slug_redirects_entity_type_from_slug_key" ON "slug_redirects"("entity_type", "from_slug");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_prices_stripe_price_id_key" ON "stripe_prices"("stripe_price_id");

-- CreateIndex
CREATE INDEX "carts_status_last_activity_at_idx" ON "carts"("status", "last_activity_at");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cart_id_variant_id_purchase_type_key" ON "cart_items"("cart_id", "variant_id", "purchase_type");

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_user_id_key" ON "wishlists"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_share_token_key" ON "wishlists"("share_token");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_wishlist_id_product_id_key" ON "wishlist_items"("wishlist_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_stripe_checkout_session_id_key" ON "orders"("stripe_checkout_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_stripe_payment_intent_id_key" ON "orders"("stripe_payment_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_stripe_invoice_id_key" ON "orders"("stripe_invoice_id");

-- CreateIndex
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "orders_status_paid_at_idx" ON "orders"("status", "paid_at");

-- CreateIndex
CREATE INDEX "orders_email_idx" ON "orders"("email");

-- CreateIndex
CREATE INDEX "orders_paid_at_idx" ON "orders"("paid_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_variant_id_idx" ON "order_items"("variant_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE INDEX "order_status_events_order_id_created_at_idx" ON "order_status_events"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "order_notes_order_id_created_at_idx" ON "order_notes"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "shipments_order_id_idx" ON "shipments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripe_payment_intent_id_key" ON "payments"("stripe_payment_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripe_charge_id_key" ON "payments"("stripe_charge_id");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_stripe_refund_id_key" ON "refunds"("stripe_refund_id");

-- CreateIndex
CREATE INDEX "refunds_order_id_idx" ON "refunds"("order_id");

-- CreateIndex
CREATE INDEX "webhook_events_provider_type_received_at_idx" ON "webhook_events"("provider", "type", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_is_active_expires_at_idx" ON "coupons"("is_active", "expires_at");

-- CreateIndex
CREATE INDEX "coupons_campaign_idx" ON "coupons"("campaign");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_redemptions_order_id_key" ON "coupon_redemptions"("order_id");

-- CreateIndex
CREATE INDEX "coupon_redemptions_coupon_id_user_id_idx" ON "coupon_redemptions"("coupon_id", "user_id");

-- CreateIndex
CREATE INDEX "coupon_redemptions_coupon_id_email_idx" ON "coupon_redemptions"("coupon_id", "email");

-- CreateIndex
CREATE INDEX "return_requests_status_created_at_idx" ON "return_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "support_cases_status_type_created_at_idx" ON "support_cases"("status", "type", "created_at");

-- CreateIndex
CREATE INDEX "reviews_product_id_status_created_at_idx" ON "reviews"("product_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reviews_product_id_status_rating_idx" ON "reviews"("product_id", "status", "rating");

-- CreateIndex
CREATE INDEX "reviews_status_created_at_idx" ON "reviews"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_product_id_user_id_key" ON "reviews"("product_id", "user_id");

-- CreateIndex
CREATE INDEX "review_images_review_id_idx" ON "review_images"("review_id");

-- CreateIndex
CREATE INDEX "routine_consultations_user_id_created_at_idx" ON "routine_consultations"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "routine_consultations_anonymous_id_idx" ON "routine_consultations"("anonymous_id");

-- CreateIndex
CREATE INDEX "routine_consultations_status_created_at_idx" ON "routine_consultations"("status", "created_at");

-- CreateIndex
CREATE INDEX "routine_consultations_engine_created_at_idx" ON "routine_consultations"("engine", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "routine_recommendations_consultation_id_tier_key" ON "routine_recommendations"("consultation_id", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "routine_steps_recommendation_id_time_of_day_step_order_key" ON "routine_steps"("recommendation_id", "time_of_day", "step_order");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_id_key" ON "users"("clerk_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "users"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "addresses_user_id_idx" ON "addresses"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_preferences_user_id_key" ON "customer_preferences"("user_id");

-- CreateIndex
CREATE INDEX "customer_metrics_lifecycle_stage_idx" ON "customer_metrics"("lifecycle_stage");

-- CreateIndex
CREATE INDEX "customer_metrics_lifetime_value_cents_idx" ON "customer_metrics"("lifetime_value_cents" DESC);

-- CreateIndex
CREATE INDEX "consent_records_user_id_type_created_at_idx" ON "consent_records"("user_id", "type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "consent_records_anonymous_id_type_created_at_idx" ON "consent_records"("anonymous_id", "type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at" DESC);

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_logs_idempotency_key_key" ON "email_logs"("idempotency_key");

-- CreateIndex
CREATE INDEX "email_logs_entity_type_entity_id_idx" ON "email_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "signed_action_tokens_token_hash_key" ON "signed_action_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "signed_action_tokens_expires_at_idx" ON "signed_action_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "back_in_stock_requests_variant_id_email_key" ON "back_in_stock_requests"("variant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_variant_id_key" ON "inventory_items"("variant_id");

-- CreateIndex
CREATE INDEX "inventory_movements_inventory_item_id_created_at_idx" ON "inventory_movements"("inventory_item_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "inventory_movements_order_id_idx" ON "inventory_movements"("order_id");

-- CreateIndex
CREATE INDEX "inventory_reservations_status_expires_at_idx" ON "inventory_reservations"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_status_idx" ON "subscriptions"("user_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_status_next_charge_at_idx" ON "subscriptions"("status", "next_charge_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_items_stripe_subscription_item_id_key" ON "subscription_items"("stripe_subscription_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_items_subscription_id_variant_id_key" ON "subscription_items"("subscription_id", "variant_id");

-- CreateIndex
CREATE INDEX "subscription_events_subscription_id_created_at_idx" ON "subscription_events"("subscription_id", "created_at");

-- CreateIndex
CREATE INDEX "subscription_events_type_created_at_idx" ON "subscription_events"("type", "created_at");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_ingredients" ADD CONSTRAINT "product_ingredients_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_ingredients" ADD CONSTRAINT "product_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_conflicts" ADD CONSTRAINT "ingredient_conflicts_ingredient_a_id_fkey" FOREIGN KEY ("ingredient_a_id") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_conflicts" ADD CONSTRAINT "ingredient_conflicts_ingredient_b_id_fkey" FOREIGN KEY ("ingredient_b_id") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_concerns" ADD CONSTRAINT "product_concerns_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_concerns" ADD CONSTRAINT "product_concerns_concern_id_fkey" FOREIGN KEY ("concern_id") REFERENCES "concerns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_concerns" ADD CONSTRAINT "ingredient_concerns_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_concerns" ADD CONSTRAINT "ingredient_concerns_concern_id_fkey" FOREIGN KEY ("concern_id") REFERENCES "concerns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_bundle_product_id_fkey" FOREIGN KEY ("bundle_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_prices" ADD CONSTRAINT "stripe_prices_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "routine_consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wishlist_id_fkey" FOREIGN KEY ("wishlist_id") REFERENCES "wishlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_bundle_parent_id_fkey" FOREIGN KEY ("bundle_parent_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_support_case_id_fkey" FOREIGN KEY ("support_case_id") REFERENCES "support_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_images" ADD CONSTRAINT "review_images_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_consultations" ADD CONSTRAINT "routine_consultations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_consultations" ADD CONSTRAINT "routine_consultations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "routine_consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_recommendations" ADD CONSTRAINT "routine_recommendations_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "routine_consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_steps" ADD CONSTRAINT "routine_steps_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "routine_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_steps" ADD CONSTRAINT "routine_steps_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_steps" ADD CONSTRAINT "routine_steps_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_steps" ADD CONSTRAINT "routine_steps_swapped_from_id_fkey" FOREIGN KEY ("swapped_from_id") REFERENCES "routine_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_preferences" ADD CONSTRAINT "customer_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_preferences" ADD CONSTRAINT "customer_preferences_source_consultation_id_fkey" FOREIGN KEY ("source_consultation_id") REFERENCES "routine_consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_metrics" ADD CONSTRAINT "customer_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "back_in_stock_requests" ADD CONSTRAINT "back_in_stock_requests_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_origin_order_id_fkey" FOREIGN KEY ("origin_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "routine_consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═════════════════════════════════════════════════════════════════════════════
-- Hand-edited section: everything Prisma cannot model (docs/08; prisma/migrations/README.md)
-- ═════════════════════════════════════════════════════════════════════════════

-- ── Sequences ────────────────────────────────────────────────────────────────
-- Customer-facing order numbers, assigned at payment (review R-12). Displayed as NURA-{n}.
CREATE SEQUENCE "order_number_seq" START WITH 100001;

-- ── CHECK constraints ────────────────────────────────────────────────────────
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_country_iso2" CHECK ("country" ~ '^[A-Z]{2}$');

ALTER TABLE "customer_preferences"
  ADD CONSTRAINT "customer_preferences_sensitivity_range" CHECK ("sensitivity" IS NULL OR "sensitivity" BETWEEN 1 AND 5),
  ADD CONSTRAINT "customer_preferences_budget_nonneg" CHECK ("monthly_budget_cents" IS NULL OR "monthly_budget_cents" >= 0);

ALTER TABLE "products"
  ADD CONSTRAINT "products_short_description_len" CHECK (char_length("short_description") <= 160),
  ADD CONSTRAINT "products_strength_range" CHECK ("strength_level" BETWEEN 1 AND 3),
  ADD CONSTRAINT "products_published_has_date" CHECK ("status" <> 'PUBLISHED' OR "published_at" IS NOT NULL),
  ADD CONSTRAINT "products_single_has_slot" CHECK ("type" = 'BUNDLE' OR "routine_slot" IS NOT NULL),
  ADD CONSTRAINT "products_rating_range" CHECK ("rating_avg" BETWEEN 0 AND 5 AND "rating_count" >= 0);

ALTER TABLE "product_variants"
  ADD CONSTRAINT "product_variants_price_positive" CHECK ("price_cents" > 0),
  ADD CONSTRAINT "product_variants_compare_at_gt_price" CHECK ("compare_at_price_cents" IS NULL OR "compare_at_price_cents" > "price_cents"),
  ADD CONSTRAINT "product_variants_cost_nonneg" CHECK ("cost_cents" IS NULL OR "cost_cents" >= 0),
  ADD CONSTRAINT "product_variants_replenish_range" CHECK ("replenish_days" BETWEEN 14 AND 180),
  ADD CONSTRAINT "product_variants_weight_nonneg" CHECK ("weight_grams" >= 0);

ALTER TABLE "product_images"
  ADD CONSTRAINT "product_images_alt_required" CHECK (char_length(btrim("alt")) >= 3),
  ADD CONSTRAINT "product_images_dimensions" CHECK ("width" > 0 AND "height" > 0);

ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_irritancy_range" CHECK ("irritancy_level" BETWEEN 0 AND 3);

ALTER TABLE "product_ingredients"
  ADD CONSTRAINT "product_ingredients_concentration_range" CHECK ("concentration_bp" IS NULL OR "concentration_bp" BETWEEN 1 AND 10000),
  ADD CONSTRAINT "product_ingredients_position_nonneg" CHECK ("position" >= 0);

ALTER TABLE "ingredient_conflicts"
  ADD CONSTRAINT "ingredient_conflicts_ordered_pair" CHECK ("ingredient_a_id" < "ingredient_b_id"),
  ADD CONSTRAINT "ingredient_conflicts_severity" CHECK ("severity" IN ('avoid_same_routine', 'avoid_same_day', 'caution'));

ALTER TABLE "product_concerns" ADD CONSTRAINT "product_concerns_efficacy_range" CHECK ("efficacy" BETWEEN 1 AND 3);
ALTER TABLE "ingredient_concerns"
  ADD CONSTRAINT "ingredient_concerns_evidence_range" CHECK ("evidence" BETWEEN 1 AND 3),
  ADD CONSTRAINT "ingredient_concerns_min_bp_range" CHECK ("min_effective_bp" IS NULL OR "min_effective_bp" BETWEEN 1 AND 10000);

ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "inventory_items"
  ADD CONSTRAINT "inventory_items_on_hand_nonneg" CHECK ("on_hand" >= 0),
  ADD CONSTRAINT "inventory_items_reserved_range" CHECK ("reserved" >= 0 AND "reserved" <= "on_hand"),
  ADD CONSTRAINT "inventory_items_threshold_nonneg" CHECK ("low_stock_threshold" >= 0);

ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_quantity_nonzero" CHECK ("quantity" <> 0),
  ADD CONSTRAINT "inventory_movements_balance_nonneg" CHECK ("balance_after" >= 0);

ALTER TABLE "inventory_reservations"
  ADD CONSTRAINT "inventory_reservations_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "inventory_reservations_one_owner" CHECK (("order_id" IS NULL) <> ("subscription_id" IS NULL));

ALTER TABLE "stripe_prices"
  ADD CONSTRAINT "stripe_prices_amount_positive" CHECK ("unit_amount_cents" > 0),
  ADD CONSTRAINT "stripe_prices_interval_matches_type" CHECK (
    ("purchase_type" = 'ONE_TIME' AND "interval_weeks" IS NULL) OR
    ("purchase_type" = 'SUBSCRIPTION' AND "interval_weeks" IN (4, 8, 12)));

ALTER TABLE "carts" ADD CONSTRAINT "carts_interval_allowed" CHECK ("subscription_interval_weeks" IS NULL OR "subscription_interval_weeks" IN (4, 8, 12));
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_quantity_range" CHECK ("quantity" BETWEEN 1 AND 10);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_amounts_nonneg" CHECK ("subtotal_cents" >= 0 AND "discount_cents" >= 0 AND "shipping_cents" >= 0 AND "tax_cents" >= 0 AND "refunded_cents" >= 0),
  ADD CONSTRAINT "orders_total_consistent" CHECK ("total_cents" = "subtotal_cents" - "discount_cents" + "shipping_cents" + "tax_cents"),
  ADD CONSTRAINT "orders_refund_le_total" CHECK ("refunded_cents" <= "total_cents"),
  -- Number and email are assigned/collected at payment (reviews R-11, R-12).
  ADD CONSTRAINT "orders_paid_has_number" CHECK ("paid_at" IS NULL OR "number" IS NOT NULL),
  ADD CONSTRAINT "orders_paid_has_email" CHECK ("paid_at" IS NULL OR "email" IS NOT NULL);

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "order_items_amounts_nonneg" CHECK ("unit_price_cents" >= 0 AND "discount_cents" >= 0),
  ADD CONSTRAINT "order_items_total_consistent" CHECK ("total_cents" = "unit_price_cents" * "quantity" - "discount_cents"),
  ADD CONSTRAINT "order_items_refunded_range" CHECK ("refunded_quantity" BETWEEN 0 AND "quantity");

ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_body_len" CHECK (char_length("body") BETWEEN 1 AND 2000);
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_nonneg" CHECK ("amount_cents" >= 0);
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount_positive" CHECK ("amount_cents" > 0);

ALTER TABLE "coupons"
  ADD CONSTRAINT "coupons_value_matches_type" CHECK (
    ("type" = 'PERCENTAGE' AND "value_bp" BETWEEN 1 AND 10000) OR
    ("type" = 'FIXED_AMOUNT' AND "value_cents" > 0) OR
    ("type" = 'FREE_SHIPPING')),
  ADD CONSTRAINT "coupons_redemptions_within_max" CHECK ("max_redemptions" IS NULL OR "redemption_count" <= "max_redemptions"),
  ADD CONSTRAINT "coupons_per_customer_positive" CHECK ("per_customer_limit" >= 1),
  ADD CONSTRAINT "coupons_window_ordered" CHECK ("starts_at" IS NULL OR "expires_at" IS NULL OR "starts_at" < "expires_at");

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_interval_allowed" CHECK ("interval_weeks" IN (4, 8, 12)),
  ADD CONSTRAINT "subscriptions_skip_nonneg" CHECK ("skip_count" >= 0);
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_quantity_range" CHECK ("quantity" BETWEEN 1 AND 10);

ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5),
  ADD CONSTRAINT "reviews_title_len" CHECK (char_length("title") BETWEEN 3 AND 80),
  ADD CONSTRAINT "reviews_body_len" CHECK (char_length("body") BETWEEN 30 AND 2000);

ALTER TABLE "routine_consultations" ADD CONSTRAINT "routine_consultations_has_owner" CHECK ("user_id" IS NOT NULL OR "anonymous_id" IS NOT NULL);
ALTER TABLE "routine_steps" ADD CONSTRAINT "routine_steps_variant_or_choice" CHECK ("requires_variant_choice" OR "variant_id" IS NOT NULL);
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_description_len" CHECK (char_length("description") BETWEEN 1 AND 4000);

-- ── Partial unique indexes ───────────────────────────────────────────────────
CREATE UNIQUE INDEX "addresses_one_default_per_user" ON "addresses" ("user_id") WHERE "is_default_shipping";
CREATE UNIQUE INDEX "product_variants_one_default_per_product" ON "product_variants" ("product_id") WHERE "is_default";
CREATE UNIQUE INDEX "carts_one_active_per_user" ON "carts" ("user_id") WHERE "status" = 'ACTIVE' AND "user_id" IS NOT NULL;
CREATE UNIQUE INDEX "stripe_prices_one_active_per_kind" ON "stripe_prices" ("variant_id", "purchase_type", COALESCE("interval_weeks", 0)) WHERE "active";
CREATE UNIQUE INDEX "inventory_reservations_order_variant" ON "inventory_reservations" ("order_id", "variant_id") WHERE "order_id" IS NOT NULL;
CREATE UNIQUE INDEX "inventory_reservations_renewal_variant" ON "inventory_reservations" ("subscription_id", "variant_id", "invoice_period_start") WHERE "subscription_id" IS NOT NULL;
CREATE UNIQUE INDEX "return_requests_one_open_per_order" ON "return_requests" ("order_id") WHERE "status" IN ('REQUESTED', 'APPROVED');

-- ── Query indexes Prisma can't express ───────────────────────────────────────
CREATE INDEX "products_name_trgm" ON "products" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "products_search_vector" ON "products" USING GIN ("search_vector");
CREATE INDEX "ingredients_inci_trgm" ON "ingredients" USING GIN (("inci_name"::text) gin_trgm_ops);
CREATE INDEX "ingredients_common_trgm" ON "ingredients" USING GIN ("common_name" gin_trgm_ops);
CREATE INDEX "inventory_items_available" ON "inventory_items" (("on_hand" - "reserved"));
CREATE INDEX "orders_needs_attention" ON "orders" ("created_at") WHERE "needs_attention";
CREATE INDEX "webhook_events_failed" ON "webhook_events" ("received_at") WHERE "status" = 'failed';

-- ── Append-only tables (ledger, audit) ───────────────────────────────────────
CREATE FUNCTION "reject_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "inventory_movements_append_only" BEFORE UPDATE OR DELETE ON "inventory_movements"
  FOR EACH ROW EXECUTE FUNCTION "reject_mutation"();
CREATE TRIGGER "audit_logs_append_only" BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "reject_mutation"();

-- ── Product full-text search vector (name A, subtitle B, ingredients C) ─────
-- 'simple' config: no stemming, so ingredient names like "niacinamide" match exactly.
CREATE FUNCTION "product_search_vector"(p_id TEXT, p_name TEXT, p_subtitle TEXT) RETURNS tsvector
LANGUAGE sql STABLE AS $$
  SELECT
    setweight(to_tsvector('simple', coalesce(p_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(p_subtitle, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce((
      SELECT string_agg(i."inci_name"::text || ' ' || i."common_name" || ' ' || array_to_string(i."aliases", ' '), ' ')
      FROM "product_ingredients" pi JOIN "ingredients" i ON i."id" = pi."ingredient_id"
      WHERE pi."product_id" = p_id), '')), 'C');
$$;

CREATE FUNCTION "products_set_search_vector"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."search_vector" := "product_search_vector"(NEW."id", NEW."name", NEW."subtitle");
  RETURN NEW;
END;
$$;

CREATE TRIGGER "products_search_vector_refresh" BEFORE INSERT OR UPDATE OF "name", "subtitle" ON "products"
  FOR EACH ROW EXECUTE FUNCTION "products_set_search_vector"();

CREATE FUNCTION "product_ingredients_refresh_search"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target TEXT := COALESCE(NEW."product_id", OLD."product_id");
BEGIN
  UPDATE "products" p SET "search_vector" = "product_search_vector"(p."id", p."name", p."subtitle")
  WHERE p."id" = target;
  RETURN NULL;
END;
$$;

CREATE TRIGGER "product_ingredients_search_refresh" AFTER INSERT OR UPDATE OR DELETE ON "product_ingredients"
  FOR EACH ROW EXECUTE FUNCTION "product_ingredients_refresh_search"();

-- ── Analytics partitions (review R-19) ───────────────────────────────────────
-- A monthly Inngest job calls ensure_analytics_partition(now() + interval '1 month') and drops
-- partitions older than 13 months. The DEFAULT partition catches anything outside the range.
CREATE FUNCTION "ensure_analytics_partition"(month_start DATE) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  first_day DATE := date_trunc('month', month_start)::date;
  part_name TEXT := format('analytics_events_y%sm%s', to_char(first_day, 'YYYY'), to_char(first_day, 'MM'));
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF "analytics_events" FOR VALUES FROM (%L) TO (%L)',
    part_name, first_day, (first_day + INTERVAL '1 month')::date);
  RETURN part_name;
END;
$$;

CREATE TABLE "analytics_events_default" PARTITION OF "analytics_events" DEFAULT;
SELECT "ensure_analytics_partition"((now() - INTERVAL '1 month')::date);
SELECT "ensure_analytics_partition"(now()::date);
SELECT "ensure_analytics_partition"((now() + INTERVAL '1 month')::date);
