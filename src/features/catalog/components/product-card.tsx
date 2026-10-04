import Link from "next/link";

import { Price } from "./price";
import { Rating } from "@/components/shared/rating";
import { Badge } from "@/components/ui/badge";

import { formatBadge } from "../merchandising";
import type { ProductCardDTO } from "../types";
import { ProductImage } from "./product-image";
import { QuickAddButton } from "./quick-add-button";

export function productHref(p: Pick<ProductCardDTO, "slug" | "type">): string {
  return p.type === "BUNDLE" ? `/routines/${p.slug}` : `/products/${p.slug}`;
}

/**
 * Product card (docs/13 §6.3). The whole card is one link (stretched over the card); quick add is
 * a sibling button layered above it, so there are no nested interactive elements.
 */
export function ProductCard({
  product,
  priority = false,
  headingLevel = "h3",
}: {
  product: ProductCardDTO;
  priority?: boolean;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  const canQuickAdd =
    product.type === "SINGLE" && product.variantCount === 1 && product.defaultVariantId;
  return (
    <article className="group relative flex flex-col gap-3">
      <div className="relative">
        <ProductImage
          image={product.image}
          slot={product.routineSlot}
          categorySlug={product.category.slug}
          type={product.type}
          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
          priority={priority}
          className="transition-transform duration-300 ease-standard group-hover:scale-[1.01]"
        />
        {product.badges.length ? (
          <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-1">
            {product.badges.slice(0, 2).map((badge) => (
              <Badge key={badge} variant="neutral" className="bg-surface/90">
                {formatBadge(badge)}
              </Badge>
            ))}
          </div>
        ) : null}
        {canQuickAdd ? (
          <div className="absolute right-3 bottom-3 z-10 lg:opacity-0 lg:transition-opacity lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
            <QuickAddButton variantId={product.defaultVariantId!} productName={product.name} />
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-overline font-semibold text-muted-foreground uppercase">
          {product.type === "BUNDLE" ? "Routine" : product.category.name}
        </p>
        <Heading className="text-heading-md font-semibold">
          <Link
            href={productHref(product)}
            className="rounded-sm group-focus-within:underline after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {product.name}
          </Link>
        </Heading>
        {product.subtitle ? (
          <p className="text-body-sm text-muted-foreground">{product.subtitle}</p>
        ) : null}
        <Rating value={product.ratingAvg} count={product.ratingCount} />
        <Price
          cents={product.priceFromCents}
          compareAtCents={product.compareAtCents}
          from={product.variantCount > 1}
          className="mt-1"
        />
      </div>
    </article>
  );
}

export function ProductGrid({
  products,
  priorityCount = 0,
  headingLevel,
  children,
}: {
  products: ProductCardDTO[];
  priorityCount?: number;
  headingLevel?: "h2" | "h3";
  /** Optional banner inserted after the second row (docs/15 P2). */
  children?: React.ReactNode;
}) {
  const insertAt = 8;
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4 lg:gap-x-8">
      {products.flatMap((product, i) => {
        const card = (
          <li key={product.id}>
            <ProductCard
              product={product}
              priority={i < priorityCount}
              headingLevel={headingLevel}
            />
          </li>
        );
        return i === insertAt && children
          ? [
              <li key="insert" className="col-span-full">
                {children}
              </li>,
              card,
            ]
          : [card];
      })}
    </ul>
  );
}
