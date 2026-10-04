# ADR-0010: Cloudinary publicIds + CI-checked asset manifest

- **Status:** Accepted · **Date:** 2026-09-28 · **Refs:** 17 §0, 06 §10

## Decision

- Brand images are referenced only by **asset key** through `src/config/assets.ts` (key → Cloudinary publicId, alt, width, height). Product images are stored in the DB as `publicId`s.
- `scripts/check-asset-manifest.ts` fails CI if code references an unknown key or a manifest publicId doesn't exist.
- Lint bans hard-coded image URLs.
- Product publishing requires ≥ 1 image with alt text.
- Components never render placeholders. Optional gallery slots render only the images that exist (review R-22).

## Consequences

- ✅ "No placeholder images" is enforced by tooling, not discipline; alt text is always present.
- ⚠️ Adding an image requires a manifest entry and an upload before the code can merge.
