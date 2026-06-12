# Reverie token reference

Transcribed from `src/ui/styles/theme.css` on 2026-06-12. **If values here disagree with theme.css, theme.css wins.** Token names become Tailwind utilities (`--color-ink-800` → `bg-ink-800` / `text-ink-800` / `border-ink-800`; `--shadow-md` → `shadow-md`; `--font-ui` → `font-ui`; `--text-body` → `text-body`).

## Colors

### Ink — dark canvas (surfaces)

| Token | Hex | Use for |
|---|---|---|
| `ink-900` | `#0e0c14` | Deepest void: code blocks, loading overlays, hero backdrops |
| `ink-800` | `#14111c` | **Default page & modal background** (set on `<body>`) |
| `ink-700` | `#1b1726` | Cards, control fills (inputs, selects) |
| `ink-600` | `#251f31` | Raised surfaces, blockquotes, tags |
| `ink-500` | `#322b41` | Scrollbar thumb, faintest surface accents |

### Parchment — warm foreground (text)

| Token | Hex | Use for |
|---|---|---|
| `parchment-50` | `#f6efe2` | **Primary text**, headings, dialog titles |
| `parchment-100` | `#e7ddcb` | Body-text variant, prose |
| `parchment-200` | `#c9bfae` | Secondary text, chat prose |
| `parchment-300` | `#9a9184` | Muted text, hints, captions |
| `parchment-400` | `#6e6a78` | Placeholders, very muted |
| `parchment-500` | `#4c4858` | Faintest (editor placeholder text) |

Hairlines/dividers: low-alpha parchment, e.g. `border-parchment-50/[.08]`, `border-parchment-50/10`, `border-parchment-50/[.13]` (inputs), `/22` (input hover).

### Ember — primary accent (candlelight gold)

| Token | Hex | Use for |
|---|---|---|
| `ember-300` | `#f6cc8c` | Lightest: icon accents in tinted tiles, inline code text |
| `ember-400` | `#f2b968` | Hover state of primary fills, section icons, caret color |
| `ember-500` | `#e8a24a` | **Primary action fill, focus ring, glow accent, list markers** |
| `ember-600` | `#ce8431` | Pressed/active state |
| `ember-700` | `#a0641f` | Darkest variant |
| `on-ember` | `#1a1206` | Dark text **on** ember fills (buttons, badges) |

### Arcane — AI / magic (violet)

| Token | Hex | Use for |
|---|---|---|
| `arcane-300` | `#c3b0f2` | Text on arcane tints, AI-suggestion text, roleplay "thoughts" |
| `arcane-400` | `#a98eec` | Section icons, blockquote accents |
| `arcane-500` | `#8f6fe3` | **Primary arcane: avatar think-ring, AI markers** |
| `arcane-600` | `#6e4fc4` | Darker variant |
| `arcane-700` | `#523a98` | Darkest variant |

Arcane is usually applied as a tint: `bg-arcane-500/15`, `border-arcane-500/40`, text `arcane-300`.

### Semantic

| Token | Hex | Use for |
|---|---|---|
| `verdant-500` | `#6fbf8b` | Success, live status dot |
| `blood-500` | `#e2685f` | Danger, errors, destructive actions |
| `amber-500` | `#e8b04a` | Warning (rare — close to ember on purpose) |

## Fonts

| Token / utility | Family (fallbacks) | Role |
|---|---|---|
| `font-display` | Cormorant Garamond (Hoefler Text, Georgia, serif) | Display headings, character names, page/modal titles |
| `font-narrative` | Spectral (Georgia, Times New Roman, serif) | Story prose, roleplay text |
| `font-ui` | Hanken Grotesk (ui-sans-serif, system-ui) | UI chrome — default on `<body>` |
| `font-mono` | Space Mono (ui-monospace, SF Mono, Menlo) | Timestamps, turn counters, code |

Fonts load via Google Fonts in `index.html` (app) and `.storybook/preview-head.html` (Storybook).

## Type scale

| Utility | Size | Line-height | Extras |
|---|---|---|---|
| `text-display` | `clamp(44px, 6vw, 84px)` | 1.02 | tracking -0.01em, weight 600 |
| `text-h1` | `clamp(34px, 4vw, 52px)` | 1.06 | |
| `text-h2` | 34px | 1.12 | |
| `text-h3` | 24px | 1.2 | |
| `text-narrative` | 18px | 1.62 | story prose |
| `text-body` | 15px | 1.55 | default copy |
| `text-label` | 13px | 1.3 | form labels |
| `text-caption` | 12px | — | meta, fine print |
| `text-eyebrow` | 12px | — | tracking 0.18em (pair with uppercase) |

## Radii

| Utility | Value | Typical use |
|---|---|---|
| `rounded-xs` | 6px | Inline chips, code |
| `rounded-sm` | 9px | Small containers, blockquotes |
| `rounded-md` | 12px | Controls: buttons, inputs, small modals |
| `rounded-lg` | 16px | Cards, medium modals |
| `rounded-xl` | 22px | Large cards, broad surfaces |
| `rounded-2xl` | 28px | Modal headers, portraits |

## Shadows & glows

| Utility | Value | Use |
|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,.4)` | Subtle lift |
| `shadow-md` | `0 6px 18px -6px rgba(0,0,0,.55)` | Default card |
| `shadow-lg` | `0 18px 44px -12px rgba(0,0,0,.65)` | Modal / drawer |
| `shadow-xl` | `0 36px 80px -20px rgba(0,0,0,.7)` | Heaviest lift |
| `shadow-glow-ember` | 1px ember ring + warm halo (`rgba(232,162,74,.35)`) | Primary buttons/tiles on hover |
| `shadow-glow-arcane` | 1px arcane ring + violet halo (`rgba(143,111,227,.35–.4)`) | AI elements |
| `shadow-card-hover` | shadow-lg + glow-ember combined | Interactive card hover |
| `shadow-card-hover-arcane` | shadow-lg + glow-arcane combined | AI-side (chat-flavored) card hover |

## Motion

| Token | Value | Notes |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Snappy; the Tailwind default timing function |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Smooth bidirectional (think pulse) |
| `--default-transition-duration` | 220ms | Tailwind default — `transition-all` is on-brand as-is |
| `animate-think` | `think 1.8s ease-in-out infinite` | Arcane box-shadow pulse (Avatar `status="think"`) |
| `animate-shimmer` | `shimmer 1.6s linear infinite` | Background-position sweep; pair with `.image-shimmer` |
| Rail card entrance | 480ms opacity/translateY via `[data-card-wrapper='rail'].visible` | Added by CardGrid's IntersectionObserver |

`@media (prefers-reduced-motion: reduce)` collapses all animation/transition to 0.001ms globally.

## Component-layer classes (theme.css `@layer components`)

- `.image-shimmer` — animated placeholder over loading generated images (arcane sweep on ink-700).
- `.chat-prose` — markdown + roleplay prose for GM turns (Spectral 17px/1.62; `.rp-dialogue` parchment-50 / `.rp-action` italic parchment-300 / `.rp-thought` italic arcane-300 in parentheses).
- `.story-editor-shell` / `.story-editor-prose` — novel-editor canvas (Spectral 18px/1.78, ember caret, AI-suggestion classes `.ai-suggestion-text`, `.ai-pending-widget`, `.codex-mention`).

## z-index ladder (convention — not tokenized)

`z-0` / `z-[2]` / `z-[10]` content layers → `z-[45]` PlaylistDock → `z-50` Modal/Drawer overlays → `z-[110]` Toast.

## File map

- `src/ui/styles/theme.css` — token source of truth (`@theme`), keyframes, base layer (focus ring, scrollbars, selection), component layer.
- `src/ui/docs/tokens.ts` — token NAME registry for Storybook docs (no values — Swatch components read live values via `getComputedStyle`). Update when adding tokens.
- `src/ui/docs/` — MDX foundations (Colors, Typography, SpacingRadii, Elevation, Motion, NarrativeProse) + brand (Logo, Voice).
