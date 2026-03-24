# Design System Document

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Sovereign Nocturne."** This vision transcends standard enterprise dashboards by treating the UI as an elite, high-contrast editorial space. It is designed to feel authoritative, obsidian-deep, and meticulously curated.

We break the "template" look by rejecting rigid, boxy grids in favor of **intentional asymmetry** and **tonal depth**. The interface should feel less like a software application and more like a high-end physical object—a dark glass monolith where information is revealed through light, texture, and sophisticated layering rather than structural lines.

## 2. Colors & Surface Philosophy
The palette is rooted in a deep, midnight foundation (`#020617`), punctuated by vibrant indigo and purple accents that signify intelligence and action.

### The "No-Line" Rule
To maintain a premium, editorial aesthetic, **1px solid borders are prohibited for sectioning.** Boundaries must be defined solely through background color shifts. Use `surface-container-low` for sections sitting on a `surface` background. If you need to separate content, use white space from our Spacing Scale (`8` or `12`).

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the `surface-container` tiers (Lowest to Highest) to create "nested" depth:
*   **Base:** `surface` (#0c1324)
*   **Subtle Recess:** `surface-container-low` (#151b2d)
*   **Interactive Cards:** `surface-container-highest` (#2e3447)

### The "Glass & Gradient" Rule
Floating elements (modals, dropdowns, floating nav) must use **Glassmorphism**. Combine semi-transparent surface colors with a `backdrop-blur` (12px–20px). Main CTAs and Hero backgrounds should utilize a "Signature Texture"—a subtle linear gradient transitioning from `primary` (#c3c0ff) to `primary-container` (#5247e6) at a 135-degree angle to provide visual "soul."

## 3. Typography
Our typography is a dialogue between the modern precision of **Manrope** and the functional clarity of **Inter**.

*   **Display & Headlines (Manrope):** These are the "Editorial Voice." Use `display-lg` (3.5rem) with tight letter-spacing (-0.02em) for hero statements. The high-contrast pairing of bold Manrope against the deep background establishes an enterprise-grade authority.
*   **Body & Labels (Inter):** For data-heavy environments, Inter provides maximum legibility. Use `body-md` (0.875rem) for primary content to keep the interface feeling spacious and light.
*   **Hierarchy as Identity:** Use `secondary` (#ddb7ff) for key categorical labels to pull the eye toward secondary metadata without competing with the primary headlines.
*   **Prestige Accent:** Use `Cormorant Garamond` sparingly for "Reimagined" or "Elite" headline accents to add bespoke prestige.

## 4. Elevation & Depth
Depth is conveyed through **Tonal Layering** rather than traditional structural dividers.

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section. This creates a soft, natural lift that mimics the way light interacts with dark materials.
*   **Ambient Shadows:** When an element must "float" (e.g., an active state), use extra-diffused shadows.
    *   *Spec:* `0px 20px 40px rgba(7, 13, 31, 0.4)`
    *   The shadow should never be pure black; it must be a tinted version of `surface-container-lowest`.
*   **The "Ghost Border" Fallback:** If accessibility requires a border, use a **Ghost Border**. Apply `outline-variant` at 15% opacity. This provides a tactile edge without cluttering the visual field.

## 5. Components

### Buttons
*   **Primary:** A vibrant gradient of `primary-container` to `primary`. Roundedness: `lg` (0.5rem). Text should be `on-primary` (#1f00a4) for high-contrast legibility.
*   **Secondary/Ghost:** No fill. A Ghost Border (15% opacity `outline-variant`) that brightens to 40% on hover.
*   **Tertiary:** Pure text with a "Check-in Now" arrow icon, using `primary` color.

### Cards & Containers
*   Forbid divider lines. Use `surface-container-high` for the card body.
*   **Interactive State:** On hover, the background should shift to `surface-container-highest` with a subtle `primary` glow (2px outer glow, 10% opacity).

### Inputs & Fields
*   **Text Inputs:** Use `surface-container-lowest` for the field background. The label should be `label-md` in `on-surface-variant`.
*   **Focus State:** The border transitions from transparent to a `secondary` ghost border (20% opacity) with a subtle inner glow.

### Lists
*   **List Items:** Separate items with `2` (0.5rem) of vertical white space instead of lines. Use a `surface-container-low` background on hover to indicate selection.

## 6. Do's and Don'ts

### Do
*   **DO** use wide margins (Spacing `16` or `20`) between major sections to let the typography breathe.
*   **DO** use `Cormorant Garamond` sparingly for "Reimagined" or "Elite" accents in headlines to add a touch of bespoke prestige.
*   **DO** use `Material Symbols Outlined` with a low-opacity `secondary_container` background for icon containers (24px padding, `xl` roundedness).

### Don't
*   **DON'T** use 100% opaque white borders. They break the "No-Line" rule and look "templated."
*   **DON'T** use standard drop shadows with high opacity. They muddy the deep dark background.
*   **DON'T** crowd the layout. If you can't fit it without a divider line, you need more white space.
