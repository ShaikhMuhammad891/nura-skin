import { JsonLd } from "@/components/shared/json-ld";
import { env } from "@/lib/env";

import type { ProductDetailDTO } from "../types";
import { productHref } from "./product-card";
import { PurchasePanel } from "./purchase-panel";

/**
 * The live part of a PDP: the purchase panel plus the Product JSON-LD, rendered from per-request
 * stock (`getLiveOffer`) so the structured data's `availability` is truthful.
 */
export function PurchaseSection({
  product,
  requestedVariantId,
  availability,
  subscriptionDiscountBp,
}: {
  product: ProductDetailDTO;
  requestedVariantId?: string;
  availability: Record<string, number>;
  subscriptionDiscountBp: number;
}) {
  const fallback = product.variants.find((v) => v.isDefault) ?? product.variants[0];
  const initial = product.variants.find((v) => v.id === requestedVariantId) ?? fallback;
  if (!initial) return null;

  const url = new URL(productHref(product), env.NEXT_PUBLIC_SITE_URL).toString();
  return (
    <>
      <PurchasePanel
        productName={product.name}
        variants={product.variants}
        initialVariantId={initial.id}
        availability={availability}
        subscriptionDiscountBp={subscriptionDiscountBp}
        subscribable={product.type === "SINGLE"}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.shortDescription,
          sku: initial.sku,
          brand: { "@type": "Brand", name: "Nura Skin" },
          url,
          ...(product.ratingCount > 0
            ? {
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: product.ratingAvg.toFixed(1),
                  reviewCount: product.ratingCount,
                },
              }
            : {}),
          offers: product.variants.map((v) => ({
            "@type": "Offer",
            sku: v.sku,
            name: v.name,
            price: (v.priceCents / 100).toFixed(2),
            priceCurrency: "USD",
            availability:
              (availability[v.id] ?? 0) > 0
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            url: `${url}?variant=${v.id}`,
          })),
        }}
      />
    </>
  );
}
