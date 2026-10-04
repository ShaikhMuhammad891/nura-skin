# 13 — Design System: "Nura Dew"

**Design direction:** _Clinical calm meets editorial warmth._ Think of a dermatologist's clean clarity presented with the tactile softness of a premium beauty magazine: warm porcelain neutrals, a single earthy clay accent, generous whitespace, a refined serif for display and a precise sans for UI.

**Source of truth:** `src/styles/tokens.json` → generated into Tailwind v4 `@theme` CSS variables (`scripts/generate-tokens.ts`). Components never use raw hex values; they only use tokens.

---

## 1. Colour

### 1.1 Core palette (light, the default)

| Token                    | Hex       | Use                                                                                     | Contrast on `porcelain`    |
| ------------------------ | --------- | --------------------------------------------------------------------------------------- | -------------------------- |
| `porcelain` (background) | `#FAF7F2` | Page background                                                                         | —                          |
| `linen` (surface-alt)    | `#F2ECE3` | Section bands, cards on porcelain, input fill                                           | —                          |
| `sand` (border)          | `#E4D9CA` | Hairlines, dividers, input borders (decorative)                                         | 1.3:1 (decorative only)    |
| `stone` (border-strong)  | `#8C8177` | Input borders, focus-adjacent UI (3:1 requirement)                                      | 3.7:1 ✓ UI                 |
| `white` (surface)        | `#FFFFFF` | Cards, popovers, modals                                                                 | —                          |
| `ink` (foreground)       | `#1F1A17` | Body text, primary buttons                                                              | 16.1:1 ✓                   |
| `ink-muted`              | `#5E554E` | Secondary text, captions                                                                | 6.8:1 ✓                    |
| `ink-subtle`             | `#7A7068` | Placeholder, disabled text (never for essential info)                                   | 4.6:1 ✓                    |
| `clay-50`                | `#FBF3EE` | Accent tint backgrounds                                                                 | —                          |
| `clay-100`               | `#F4E3D8` | Badges, highlight fills                                                                 | —                          |
| `clay-300`               | `#DDAA8F` | Illustrations, decorative strokes                                                       | —                          |
| `clay-500` (accent)      | `#B8785A` | Brand accent: finder CTA fill (with ink text), active indicators, large display accents | 3.3:1 (large text/UI only) |
| `clay-600` (accent-text) | `#9A5B3F` | Links, accent text                                                                      | 4.9:1 ✓                    |
| `clay-700`               | `#7C4630` | Hover for accent text                                                                   | 6.9:1 ✓                    |
| `sage-100`               | `#E5EADF` | "Gentle / sensitive-safe" tint, success backgrounds                                     | —                          |
| `sage-500`               | `#7D8C6E` | Ingredient illustration strokes, secondary accent                                       | 3.4:1 (UI)                 |
| `sage-700`               | `#4F5D45` | Sage text (e.g. "Pregnancy-safe" badge text)                                            | 6.5:1 ✓                    |
| `dew-100`                | `#E3ECEA` | Cool tint for the finder background and "hydration" topics                              | —                          |
| `dew-600`                | `#4E6E6A` | Cool accent text                                                                        | 5.6:1 ✓                    |

### 1.2 Semantic tokens

| Token                                | Light                 | Dark                  | Use                                     |
| ------------------------------------ | --------------------- | --------------------- | --------------------------------------- |
| `--background`                       | porcelain             | `#16120F`             | Page                                    |
| `--surface`                          | white                 | `#201B17`             | Cards/popovers                          |
| `--surface-alt`                      | linen                 | `#2A241F`             | Bands, inputs                           |
| `--foreground`                       | ink                   | `#F2ECE4`             | Text                                    |
| `--muted-foreground`                 | ink-muted             | `#B5ABA1`             | Secondary text                          |
| `--border`                           | sand                  | `#3A322C`             | Hairlines                               |
| `--border-strong`                    | stone                 | `#6E645B`             | Input borders                           |
| `--primary` / `--primary-foreground` | ink / porcelain       | `#F2ECE4` / `#16120F` | Primary buttons (inverted in dark mode) |
| `--accent` / `--accent-foreground`   | clay-500 / ink        | `#D39A7D` / `#16120F` | Finder CTA, highlights                  |
| `--link`                             | clay-600              | `#E0B39B`             | Links                                   |
| `--ring`                             | clay-600              | `#E0B39B`             | Focus ring                              |
| `--success` / `--success-bg`         | `#3C6E4A` / sage-100  | `#8DBE98` / `#1E2A21` | Success states                          |
| `--warning` / `--warning-bg`         | `#8A5A0B` / `#F8EBD2` | `#E3B45E` / `#2E2413` | Low stock, cautions                     |
| `--danger` / `--danger-bg`           | `#A93A2A` / `#F7E1DC` | `#F08F7E` / `#2F1814` | Errors, destructive                     |
| `--info` / `--info-bg`               | `#35607E` / `#E1EBF2` | `#8EB7D4` / `#16222B` | Informational notices                   |

### 1.3 Data-visualization palette (admin)

Categorical (validated for CVD distinctness with `scripts/check-palette.ts`, AA against the surface): `#9A5B3F` clay, `#4E6E6A` dew, `#7D8C6E` sage, `#C9A227` ochre, `#6B5B95` plum, `#8C8177` stone. Sequential (heatmaps): clay-50 → clay-700. Diverging (deltas): danger ↔ stone ↔ success. Charts always have a "View as table" alternative (NFR-A11Y-10).

### 1.4 Colour rules

- **One accent per view.** Clay is used sparingly: one primary accent CTA per screen (the finder), plus links.
- Primary purchase buttons are **ink** (black-brown), not clay. This reads as premium and keeps AA contrast.
- Status is never communicated by colour alone: always add an icon and a label.
- Product imagery carries the colour; the UI stays neutral.

---

## 2. Typography

| Role      | Family                                                            | Weights       | Notes                                                                                    |
| --------- | ----------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------- |
| Display   | **Fraunces** (variable; axes `opsz`, `wght`, `SOFT`=50, `WONK`=0) | 300–600       | Soft, editorial serif; headings and hero statements; optical sizing automatic            |
| UI / Body | **Inter** (variable)                                              | 400, 500, 600 | `font-feature-settings: "cv11", "ss01"`; tabular numerals for prices and tables (`tnum`) |
| Mono      | **JetBrains Mono**                                                | 400           | SKUs, INCI lists (optional), admin IDs, code                                             |

Loaded via `next/font/google` (self-hosted at build time), with `display: swap`, subsets `latin`, and variables `--font-display`, `--font-sans`, `--font-mono`. Fallback metrics are adjusted (`adjustFontFallback`) to minimize CLS.

### 2.1 Type scale (fluid, `clamp()` between 360 px and 1440 px)

| Token         | Size (mobile → desktop) | Line height | Tracking         | Family / weight  | Use                            |
| ------------- | ----------------------- | ----------- | ---------------- | ---------------- | ------------------------------ |
| `display-2xl` | 44 → 80 px              | 1.02        | −0.02em          | Fraunces 350     | Home hero                      |
| `display-xl`  | 36 → 60 px              | 1.05        | −0.02em          | Fraunces 350     | Page heroes                    |
| `display-lg`  | 30 → 44 px              | 1.1         | −0.015em         | Fraunces 400     | Section titles                 |
| `heading-xl`  | 26 → 32 px              | 1.2         | −0.01em          | Fraunces 450     | PDP product name               |
| `heading-lg`  | 22 → 24 px              | 1.25        | −0.005em         | Inter 600        | Card groups, admin page titles |
| `heading-md`  | 18 → 20 px              | 1.3         | 0                | Inter 600        | Card titles                    |
| `heading-sm`  | 16 px                   | 1.4         | 0                | Inter 600        | Subsections                    |
| `body-lg`     | 18 px                   | 1.6         | 0                | Inter 400        | Editorial paragraphs           |
| `body`        | 16 px                   | 1.6         | 0                | Inter 400        | Default                        |
| `body-sm`     | 14 px                   | 1.5         | 0                | Inter 400        | Secondary info, admin tables   |
| `caption`     | 12 px                   | 1.4         | 0.01em           | Inter 500        | Meta, helper text              |
| `overline`    | 12 px                   | 1.2         | 0.12em uppercase | Inter 600        | Eyebrows ("STEP 2 · TREAT")    |
| `price`       | 16–20 px                | 1           | 0                | Inter 600 `tnum` | Prices                         |

**Rules:** max line length 68ch for body copy; never use Fraunces below 20 px; minimum body size 16 px on mobile (this also prevents iOS input zoom).

---

## 3. Spacing & layout

- **Base unit 4 px.** Scale: `0.5`=2, `1`=4, `2`=8, `3`=12, `4`=16, `5`=20, `6`=24, `8`=32, `10`=40, `12`=48, `16`=64, `20`=80, `24`=96, `32`=128.
- **Section rhythm:** storefront sections are `py-16` (mobile) / `py-24` (desktop); editorial hero `py-20` / `py-32`.
- **Container:** `max-w-[1320px]`, gutters 16 px (mobile) / 24 px (tablet) / 40 px (desktop). Editorial text column `max-w-[680px]`.
- **Grid:** 4 columns (mobile), 8 (tablet ≥ 768), 12 (desktop ≥ 1024). The PLP product grid has 2 / 3 / 4 columns, with gap 16 / 24 / 32.
- **Breakpoints:** `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`.
- **Admin layout:** 256 px sidebar (collapsible to 72 px), content `max-w-[1440px]`, density "comfortable" (row 48 px) or "compact" (row 36 px) toggle.

---

## 4. Border radius

| Token         | Value   | Use                                                 |
| ------------- | ------- | --------------------------------------------------- |
| `radius-xs`   | 4 px    | Badges, checkboxes                                  |
| `radius-sm`   | 8 px    | Inputs, small buttons, table cells with fills       |
| `radius-md`   | 12 px   | Buttons, dropdowns, toasts                          |
| `radius-lg`   | 16 px   | Cards, product image frames                         |
| `radius-xl`   | 24 px   | Modals, sheets, feature panels, finder option cards |
| `radius-full` | 9999 px | Pills, avatars, the sticky finder pill, swatches    |

Product images use `radius-lg`, and the organic "pebble" shape (`17-asset` background) is used **only** in decorative illustrations, never on UI.

---

## 5. Elevation & shadows (warm-tinted, low contrast)

| Token         | Value                                    | Use                                   |
| ------------- | ---------------------------------------- | ------------------------------------- |
| `shadow-xs`   | `0 1px 2px rgb(31 26 23 / 0.05)`         | Inputs, subtle cards                  |
| `shadow-sm`   | `0 2px 8px -2px rgb(31 26 23 / 0.08)`    | Cards on hover                        |
| `shadow-md`   | `0 8px 24px -6px rgb(31 26 23 / 0.12)`   | Popovers, dropdowns, cart drawer edge |
| `shadow-lg`   | `0 24px 48px -12px rgb(31 26 23 / 0.18)` | Modals                                |
| `shadow-glow` | `0 0 0 6px rgb(184 120 90 / 0.15)`       | Finder selected-option halo           |

Dark mode swaps shadows for **surface lightness steps** plus a 1 px `--border` (shadows are nearly invisible on dark).

---

## 6. Components (specs)

### 6.1 Buttons

| Variant       | Light                                        | Hover / Active           | Use                                              |
| ------------- | -------------------------------------------- | ------------------------ | ------------------------------------------------ |
| `primary`     | bg ink, text porcelain                       | bg `#39312B` / scale .98 | Add to cart, Checkout, Save                      |
| `accent`      | bg clay-500, text ink                        | bg clay-300              | **Find my routine**, only one per view           |
| `secondary`   | bg transparent, 1 px border-strong, text ink | bg linen                 | Secondary actions                                |
| `ghost`       | transparent, text ink                        | bg linen                 | Toolbar, icon buttons                            |
| `link`        | text clay-600, underline offset 4 on hover   | clay-700                 | Inline actions                                   |
| `destructive` | bg danger, text white                        | darker                   | Admin destructive (always behind a confirmation) |

Sizes: `sm` h-36 px-3 text 14 · `md` h-44 px-5 text 15 (default; meets the 44 px touch target) · `lg` h-52 px-7 text 16 · `icon` 44×44.
States: `disabled` (opacity 50%, `aria-disabled`, no pointer events); `loading` (spinner replaces the leading icon, label stays for width stability, `aria-busy`); focus ring 2 px `--ring` + 2 px offset `--background`.
Full-width on mobile for primary CTAs in the PDP sticky bar and the cart.

### 6.2 Inputs & form controls

- Height 44 px, `radius-sm`, bg `surface`, border `border-strong`, text 16 px (prevents iOS zoom).
- Label above (14 px, 500), helper text below (12 px muted), error text below in `--danger` with an icon, `aria-invalid`, `aria-describedby`.
- Focus: border `ink` + ring. Error: border `danger`.
- Variants: Text, Email, Number (steppers for quantity), Textarea (auto-grow, char counter), Select (Radix), Combobox (ingredient search), Checkbox (20 px), Radio cards (finder), Switch, Slider (budget, with value bubble and live-region), Chips (multi-select, `aria-pressed`), Date range picker (admin), File dropzone (admin/reviews).
- Required fields are marked with "(required)" text in the label, not only an asterisk.

### 6.3 Cards

| Card                        | Anatomy                                                                                                                                                                                                                                                  | Behaviour                                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `ProductCard`               | 4:5 image (hover swaps to the texture shot on pointer devices), badges top-left, wishlist top-right, eyebrow (category), name (heading-md), subtitle (body-sm muted), rating, price from, "Quick add" (desktop hover, mobile always-visible icon button) | Entire card is a link; quick add is a separate button (no nested interactive elements inside the link: an overlay pattern) |
| `RoutineCard`               | Horizontal product image stack, title, step count, "Save $X" chip, price                                                                                                                                                                                 |                                                                                                                            |
| `StepCard` (finder results) | Step number + slot overline, image 1:1, name, frequency badge, rationale (2 lines, expandable), actions (Why this? / Swap)                                                                                                                               | `layoutId` animation on swap                                                                                               |
| `IngredientCard`            | Illustration, name, common name, 1-line benefit                                                                                                                                                                                                          |                                                                                                                            |
| `KpiTile` (admin)           | Label, value (tnum), delta chip (▲/▼ + %), sparkline                                                                                                                                                                                                     |                                                                                                                            |
| Surface                     | `surface` bg, `radius-lg`, `border` 1 px or `shadow-xs`                                                                                                                                                                                                  |                                                                                                                            |

### 6.4 Navigation

- **Announcement bar** (40 px, linen): rotating messages (free shipping threshold, subscriber perk), pausable (`aria-live="off"`, a pause button).
- **Header** (72 px desktop / 60 px mobile), sticky, background `porcelain/85` + backdrop blur after scroll, border-bottom sand. Left: logo. Center (desktop): Shop (mega-menu: categories, concerns, routines, featured image), Routines, Ingredients, Science. Right: Search (⌘K), Account, Wishlist, Cart (count badge), and a "Find my routine" accent button (desktop).
- **Mega-menu:** opens on click and on keyboard (not hover-only), with 150 ms hover-intent delay for pointer users; closes on Esc; focus trapped while open.
- **Mobile:** hamburger → full-height `Sheet` from the left with accordion sections; the bottom of the sheet has the finder CTA. The sticky finder pill (bottom center, 56 px from bottom) appears after 40% scroll on storefront pages.
- **Footer:** 4 columns (Shop, Learn, Help, Company) + newsletter + social + legal; collapses to accordions on mobile.
- **Breadcrumbs** on the PLP, PDP and ingredient pages (with JSON-LD).
- **Admin:** left sidebar grouped (Overview · Catalogue · Inventory · Orders · Customers · Marketing · Insights · Settings), permission-filtered; topbar with a global command menu (⌘K: jump to an order by number, a product by name, actions).
- **Account:** left nav (desktop) / horizontal scroll tabs (mobile).

### 6.5 Tables (admin)

- TanStack Table with server-side sorting, filtering and pagination via URL params.
- Sticky header; zebra-free; row hover linen; row height 48/36 (density toggle); numeric columns right-aligned with `tnum`.
- Column visibility menu, saved views (Zustand + localStorage per user), bulk-select with an action bar that slides up from the bottom.
- Status as `Badge` (icon + label). Empty state and loading skeleton rows.
- Mobile (< 768): tables become stacked cards with the key fields; horizontal scroll only as a fallback for wide data (with a scroll shadow cue).
- Accessibility: `<table>` semantics, `aria-sort` on sortable headers, and the row actions menu is keyboard reachable.

### 6.6 Modals, sheets & overlays

| Component             | Desktop                                                                              | Mobile                               | Use                                              |
| --------------------- | ------------------------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------ |
| `Dialog`              | Centered, max-w 560, `radius-xl`, `shadow-lg`, scrim `ink/40` + blur 2 px            | Becomes a bottom sheet (Vaul drawer) | Confirmations, forms                             |
| `AlertDialog`         | Centered, destructive confirmation; typed confirmation variant for high-risk actions | Bottom sheet                         | Refunds, archive                                 |
| `Sheet` (side)        | Right, w 440                                                                         | Full width                           | Cart drawer, filters (mobile), swap alternatives |
| `Popover` / `Tooltip` | Radix; tooltips only on hover/focus, never for essential info                        | Tooltips are replaced by inline text |                                                  |
| `Toast` (sonner)      | Bottom-right, 4 s, pausable on hover                                                 | Top-center                           | Feedback; `role=status`                          |
| `CommandMenu`         | cmdk dialog                                                                          | Full screen                          | Search, admin commands                           |

All overlays: focus trap, Esc to close, return focus to the trigger, `aria-modal`, scroll lock without layout shift (`scrollbar-gutter: stable`).

### 6.7 Forms (patterns)

- React Hook Form + Zod resolver; validate on blur, re-validate on change after the first error.
- Submit via Server Action with `useActionState`; the server `fieldErrors` map into RHF `setError`.
- The error summary at the top of long forms (admin product editor) links to the fields; focus moves to the summary on failed submit.
- Autosave indicator for the admin editor ("Saved · 2 s ago").
- Multi-step forms (finder, admin product editor) show progress, and Back never loses data.
- Address form: autocomplete attributes (`shipping address-line1`, etc.); US state select.

### 6.8 Feedback & status components

Badge (neutral, accent, success, warning, danger, info, outline) · Alert/Callout (with icon, title, body, action) · Skeleton (shimmer disabled under reduced motion) · Spinner · Progress bar (finder, free shipping) · EmptyState (illustration + title + body + CTA) · ErrorState · Stepper.

---

## 7. Iconography

- **Lucide** icons at 1.5 px stroke (matching the thin brand line), sizes 16/20/24, `currentColor`.
- Custom brand icons (concerns, routine slots, product benefits) drawn to the same grid: 24 px, 1.5 px stroke, round caps. Listed in `17-asset-inventory.md` (ICN-*).
- Decorative icons get `aria-hidden`; icon-only buttons get `aria-label`.

---

## 8. Motion

**Principle:** _motion like skincare: gentle, purposeful, never flashy._ Motion explains state changes (drawer opens, a step advances, an item is added) rather than decorating.

| Token            | Duration                                      | Easing                                               | Use                                    |
| ---------------- | --------------------------------------------- | ---------------------------------------------------- | -------------------------------------- |
| `motion-instant` | 100 ms                                        | `ease-out`                                           | Hover colour, press scale              |
| `motion-fast`    | 180 ms                                        | `cubic-bezier(0.2, 0, 0, 1)`                         | Dropdowns, tooltips, toasts            |
| `motion-base`    | 280 ms                                        | `cubic-bezier(0.2, 0, 0, 1)` (emphasized decelerate) | Sheets, dialogs, cart drawer           |
| `motion-slow`    | 480 ms                                        | `cubic-bezier(0.3, 0, 0, 1)`                         | Finder step transitions, hero reveal   |
| `spring-soft`    | Framer spring `{stiffness: 260, damping: 30}` | —                                                    | Layout animations (step swap, reorder) |

**Signature animations**

| Name           | Where               | Description                                                                                                                                    |
| -------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero reveal    | Home                | Headline lines rise 12 px + fade, staggered 60 ms; the image scales 1.04 → 1 over 1.2 s. Plays once.                                           |
| Finder step    | Finder              | The outgoing step slides −24 px + fades; the incoming step slides from +24 px. The progress bar animates width. Focus moves to the new legend. |
| Option select  | Finder cards        | Border to ink + `shadow-glow`; check icon draws (SVG path length) in 200 ms                                                                    |
| Analyzing      | `/finder/analyzing` | A soft "dew drop" ring pulses (2.4 s loop) while status lines type in with checkmarks. Under reduced motion: static drop and instant lines.    |
| Routine build  | Results             | Step cards stagger in (50 ms) along the AM/PM timeline line, which draws top-to-bottom                                                         |
| Add to cart    | Global              | Button → check morph (240 ms); the cart count badge bumps (scale 1 → 1.2 → 1); the drawer opens                                                |
| Swap           | Results             | `layoutId` crossfade between the old and new StepCard                                                                                          |
| Scroll reveals | Editorial sections  | Fade + 16 px rise, once, `viewport: {once: true, amount: 0.3}`. Never on product grids (perceived slowness).                                   |

**Rules**

- Only `transform` and `opacity` are animated (GPU-friendly; no layout thrash).
- `prefers-reduced-motion: reduce` → all Framer animations use `MotionConfig reducedMotion="user"`, CSS transitions reduce to opacity only (≤ 100 ms), and auto-rotating content stops.
- No animation blocks interaction; exit animations are interruptible.
- `LazyMotion` + `domAnimation`; the `m.` components are used to keep the bundle small.

---

## 9. Mobile behaviour

| Area        | Mobile pattern                                                                                                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header      | 60 px, logo centered, menu left, search + cart right                                                                                                                                |
| PDP         | Gallery as a swipeable carousel with dots + pinch-zoom lightbox; **sticky bottom purchase bar** (price + Add to cart) once the main CTA scrolls out of view; accordions for details |
| PLP         | Filters in a bottom sheet with a sticky "Show 24 results" button; active filter chips in a horizontal scroll row                                                                    |
| Cart        | Full-screen sheet; sticky checkout footer with total                                                                                                                                |
| Finder      | One question per screen; large 56 px option cards; thumb-zone Next/Back bar fixed at the bottom; the keyboard doesn't cover inputs (visualViewport handling)                        |
| Checkout    | Stripe embed is responsive; the order summary collapses into an expandable header ("Show order summary · $118.00")                                                                  |
| Account     | Tabs as a horizontal scroller; tables become cards                                                                                                                                  |
| Admin       | Usable ≥ 768 px (tablet); < 768 shows a "Best on a larger screen" notice but key pages (orders, inventory adjust) remain functional as stacked cards                                |
| Touch       | Targets ≥ 44 px; no hover-dependent functionality; swipe-to-dismiss on sheets                                                                                                       |
| Performance | Hero image is art-directed 4:5 on mobile (smaller file); LCP image `priority` + `fetchPriority="high"`                                                                              |

---

## 10. Dark mode strategy

**Decision:** the storefront ships **light-first** with full dark mode support following the system preference and a manual toggle (footer and account settings). The admin defaults to the system preference, with a toggle in the topbar.

**Why not dark-only or light-only:** premium skincare photography is shot on warm light backgrounds, so light is the brand-defining experience. But evening shoppers (the PM routine browsing peak, 9–11 pm) and admins on long sessions benefit from dark mode. Supporting it through semantic tokens costs little when it is designed in from day one.

**Implementation**

- `next-themes` with the `class` strategy (`.dark` on `<html>`), `defaultTheme="system"`, `enableSystem`, and no flash (the inline script sets the class before paint).
- **All** component styles reference semantic tokens (§1.2). A lint rule (custom ESLint / Tailwind plugin config) forbids raw palette classes such as `bg-porcelain` inside components; only `bg-background`, `text-foreground`, etc. are allowed.
- **Imagery in dark mode:** product packshots are on transparent or porcelain backgrounds inside a `surface-alt` frame, so a light image frame on a dark page is intentional ("product on a lit plinth"). Lifestyle images are unchanged. Illustrations use `currentColor` strokes and adapt automatically.
- **Elevation in dark mode:** surfaces step lighter (`#16120F` → `#201B17` → `#2A241F`) instead of using shadows.
- **Charts:** palette variants validated for dark surfaces.
- **Emails:** light only, with `color-scheme` meta and dark-mode-safe logo (transparent PNG with a subtle stroke).
- **Stripe Embedded Checkout** appearance follows the active theme (`appearance.theme: 'night'` variables mapped from tokens).
- **Testing:** Playwright visual snapshots in both themes for 8 key pages; axe run in both.

---

## 11. Accessibility checklist baked into the system

- Focus visible on every interactive component (token `--ring`), never removed.
- Contrast pairs validated in `tokens.json` by a CI script (fails below 4.5:1 for text pairs marked `text`).
- Skip link ("Skip to content") as the first focusable element.
- Landmarks: `header`, `nav` (labelled), `main`, `footer`; one `h1` per page.
- Live regions: cart updates ("Added Glow Serum to cart"), finder progress, form errors.
- Reduced motion (§8), reduced transparency (`prefers-reduced-transparency` → solid header background).
- Language attribute and proper heading order; images have alt text (enforced in the admin).
