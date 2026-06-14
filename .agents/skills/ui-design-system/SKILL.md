---
name: ui-design-system
description: The Reverie design system for this app — dark candlelit look and feel, all color/typography/radius/shadow/motion tokens, and the ember-vs-arcane accent rules. Use when styling or restyling any UI (pages, drawers, components), choosing colors, fonts, spacing, shadows, or animations, adding Tailwind classes, or reviewing a UI diff for visual consistency. Consult before writing any color, font, radius, shadow, or motion value — hardcoded values are forbidden; everything comes from tokens in src/ui/styles/theme.css.
---

# Reverie design system

Reverie is an AI-roleplay product; the brand feeling is **literary, theatrical, and candlelit** — a dimly-lit reading room where stories come alive. In one line: *mysterious, warm, literate — never twee, never corporate.*

Single source of truth: the Tailwind v4 `@theme` block in `src/ui/styles/theme.css`. Every token there becomes a Tailwind utility automatically (`--color-ink-800` → `bg-ink-800`, `--shadow-glow-ember` → `shadow-glow-ember`, `--font-narrative` → `font-narrative`). Components use those utilities in `className` — never raw hex/px/bezier values, no CSS-in-JS, no component-scoped stylesheets.

For exact values (hex, px, beziers, full tables), read [references/tokens.md](references/tokens.md). When adding or changing a token, edit `theme.css` AND register its name in `src/ui/docs/tokens.ts` (the Storybook docs read live values via `getComputedStyle`, names from that file).

## The feeling, in five rules

1. **Canvas is dark by default.** Depth is built by *lightening* surfaces (ink-900 → ink-600), not by heavy drop shadows. Never pure black.
2. **Foreground is warm parchment**, never pure white.
3. **Ember (candlelight gold) is the single hero accent** — primary actions, active states, the player's own voice, focus rings.
4. **Arcane violet marks the AI side** — avatar rings, the "thinking" shimmer, AI suggestions, memory. Used sparingly so it stays special.
5. **Serif for story, sans for system.** Cormorant Garamond / Spectral carry the narrative; Hanken Grotesk carries the UI. Never mix the jobs.

When ember and arcane appear in one view, ember dominates; arcane only flags what the AI did or is doing.

## Color decisions

| Need | Use |
|---|---|
| Page / modal background | `bg-ink-800` (default; ink-900 = deepest/void, code blocks) |
| Card / control surface | `bg-ink-700`; raised layers ink-600, faint accents ink-500 |
| Primary text, headings | `text-parchment-50` |
| Secondary / muted / placeholder | parchment-200 / 300 / 400 (500 = faintest) |
| Primary action, focus, player side | `ember-500` fill with `text-on-ember`; hover ember-400, pressed ember-600 |
| AI presence (rings, shimmer, suggestions) | `arcane-500`; tints via `/15`–`/25` alpha + arcane-300 text |
| Success / danger / warning | `verdant-500` / `blood-500` / `amber-500` |
| Hairline borders / dividers | `border-parchment-50/[.08]`–`/10` (low-alpha parchment, not gray) |

## Typography

| Job | Utility | Examples |
|---|---|---|
| Display headings, character names, page titles | `font-display` (Cormorant Garamond) | PageHeader titles, modal titles |
| Story / roleplay prose | `font-narrative` (Spectral) | chat turns, descriptions in cards |
| UI chrome: buttons, labels, nav, forms | `font-ui` (Hanken Grotesk) | default on `<body>` |
| Meta: timestamps, turn counters, code | `font-mono` (Space Mono) | badges, counters |

Type-scale utilities: `text-display` (clamp 44–84px), `text-h1` (clamp 34–52px), `text-h2` 34px, `text-h3` 24px, `text-narrative` 18px/1.62, `text-body` 15px/1.55, `text-label` 13px, `text-caption` 12px, `text-eyebrow` 12px/0.18em tracking.

## Motion

- Default transition: **220ms** with `--ease-out` `cubic-bezier(0.16, 1, 0.3, 1)` (Tailwind's default duration/easing are set to these — plain `transition-all` is already on-brand).
- Signature effects: hover-lift `-translate-y-[3px]` + `shadow-card-hover` on interactive cards; `animate-think` (arcane avatar pulse while AI generates); `animate-shimmer` / `.image-shimmer` (placeholder sweep while images load).
- `prefers-reduced-motion: reduce` collapses ALL animation globally in `theme.css` — never add motion that bypasses it (no JS-driven animation without checking the media query).

## Elevation & glow

Shadows `shadow-sm/md/lg/xl` for elevation (md = default card, lg = modal/drawer). Glows add candlelight: `shadow-glow-ember` (buttons/tiles on hover), `shadow-glow-arcane` (AI elements), `shadow-card-hover` (elevation + ember glow combined), `shadow-card-hover-arcane` (twin for AI-side cards). Radii: `rounded-xs` 6px → `rounded-2xl` 28px; controls use `rounded-md`, cards `rounded-lg`/`xl`.

## Hard rules

- **Never hardcode** a color, font, radius, shadow, or duration in a component — use token utilities. No `#fff`, no `#000`, no `white`/`black`.
- Focus ring is global and always visible (`:focus-visible` = ember ring in theme.css) — do not `outline-none` without replacing it, do not invent per-component focus styles.
- Microcopy: sentence case, no emoji, no exclamation-mark enthusiasm. Voice rules in Storybook → Design System/Brand/Voice.
- z-index ladder (convention, not tokens): content `z-0`/`z-[2]`/`z-[10]` → PlaylistDock `z-[45]` → Modal/Drawer `z-50` → lightbox / above-modal overlay `z-[60]` (ImageLightbox — opened from inside a drawer, must paint above it) → portal popover/dropdown `z-[100]` (Select, SuggestInput, CardOptions, ChatActions menus — must clear modals/drawers) → Toast `z-[110]`. Pick from the ladder; don't invent new layers.
- Ambient page glow is app-shell-level only: `GlowBackdrop variant="page"` lives once in `AppRouter` (fixed, -z-10). Never add page-top section glows.

## Known exceptions (don't "fix" blindly, don't copy)

- `src/ui/primitives/GlowBackdrop.tsx` inlines rgba values — pre-existing exception, do not replicate the pattern elsewhere.
- z-index has no tokens yet; the ladder above is the convention.
- Storybook a11y is `test: 'todo'` on purpose: axe flags the intentional low-contrast hairlines/muted text. Real a11y regressions to care about: missing labels/alt, focus order, keyboard operability, ARIA roles. Primary text and ember/arcane fills clear AA.
