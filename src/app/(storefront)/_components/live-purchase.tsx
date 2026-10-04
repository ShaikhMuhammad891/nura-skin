import { PurchaseSection } from "@/features/catalog/components/purchase-section";
import { getLiveOffer } from "@/features/catalog/server/queries";
import type { ProductDetailDTO } from "@/features/catalog/types";

/** Streams the per-request stock and discount into the PDP purchase panel (docs/16 StockIndicator). */
export async function LivePurchase({
  product,
  requestedVariantId,
}: {
  product: ProductDetailDTO;
  requestedVariantId?: string;
}) {
  const offer = await getLiveOffer(product.variants.map((v) => v.id));
  return (
    <PurchaseSection
      product={product}
      requestedVariantId={requestedVariantId}
      availability={offer.availability}
      subscriptionDiscountBp={offer.subscriptionDiscountBp}
    />
  );
}
