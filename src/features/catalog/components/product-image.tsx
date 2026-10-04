import Image from "next/image";

import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

import type { ImageDTO, SlotKey } from "../types";
import { ProductArt } from "./product-art";

/**
 * Product image (docs/16 CloudImage, ADR-0010: the DB stores Cloudinary public IDs, never URLs).
 * Renders the Cloudinary asset when the cloud is configured and the product has one; otherwise
 * the illustrated packshot.
 */
export function cloudinaryUrl(cloudName: string, publicId: string, width: number): string {
  return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,c_limit,w_${width}/${publicId}`;
}

export function ProductImage({
  image,
  slot,
  categorySlug,
  type,
  sizes,
  priority = false,
  className,
}: {
  image: ImageDTO | null;
  slot: SlotKey | null;
  categorySlug: string;
  type?: "SINGLE" | "BUNDLE";
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const cloud = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!image || !cloud) {
    return <ProductArt slot={slot} categorySlug={categorySlug} type={type} className={className} />;
  }
  return (
    <div
      className={cn(
        "relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-surface-alt",
        className,
      )}
    >
      <Image
        src={cloudinaryUrl(cloud, image.publicId, 1200)}
        alt={image.alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized
        className="object-cover"
      />
    </div>
  );
}
