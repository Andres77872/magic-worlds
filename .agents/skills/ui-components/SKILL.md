---
name: ui-components
description: Catalog of this repo's reusable React UI primitives and components (Button, Modal, Drawer, Card, CardGrid, PageHeader, Field/Input/Select, Badge, Avatar, etc.) plus composition recipes for pages, forms, overlays, and card grids. Use when building or changing any screen, page, settings view, dialog, drawer, form, list, or widget — always reuse these primitives instead of writing raw markup. Covers import conventions (@/ alias, barrel exports), spacing/density rules, and known gotchas like the React 19 phantom-submit bug.
---

# Reverie UI components

**Reuse first.** Before writing JSX, scan the catalogs below — nearly every visual pattern in the app already has a primitive. A new generic pattern belongs in `src/ui/primitives/` (exported from `src/ui/primitives/index.ts`); an app-specific composite belongs in `src/ui/components/` (exported from `src/ui/components/index.ts`). Both get a co-located `*.stories.tsx` (see the `ui-storybook` skill) and, if interactive, a `*.test.tsx`.

For fuller prop signatures and behavior notes, read [references/component-api.md](references/component-api.md). The component source file is always authoritative.

## Where things live, how to import

- `@/` alias = `src/`. Import from barrels: `import { Button, Modal, Field, Input, cx } from '@/ui/primitives'`.
- Lucide icons render through the `Icon` primitive or with explicit `size={16..18} strokeWidth={1.75}` — 1.75 is the Reverie stroke standard, not lucide's default 2.
- `cx(...)` (from primitives) is the class-combining helper; `gradientFor(seed)` makes the deterministic portrait/avatar gradients.
- Styling is Tailwind utilities from theme tokens only (see `ui-design-system` skill).

## Primitive catalog — `src/ui/primitives/`

| Component | Purpose | Key props |
|---|---|---|
| `Button` | Action control | `kind: primary\|secondary\|ghost\|arcane\|danger`, `size: sm\|md\|lg`, `full`, `iconLeft/iconRight` |
| `IconButton` | Square icon-only action | `label` (required, becomes aria-label), `size: sm\|md\|lg`, `tone: default\|active\|danger` |
| `Chip` | Interactive filter/toggle pill | `active`, `icon` (button semantics) |
| `Tag` | Static neutral pill | span semantics, no tones |
| `Badge` | Inline status | `tone: ember\|arcane\|live\|danger\|nsfw\|neutral\|glass`, `icon` |
| `Switch` / `SwitchRow` | Boolean toggle / settings row with label+description | `checked`, `onChange`, `size: sm\|md` |
| `Card` | Base surface | `interactive` → hover-lift + ember glow |
| `Modal` | Centered dialog (portal, scrim) | `open`, `onClose`, `title`, `icon`, `size: sm\|md\|lg`, `footer`, `showClose` |
| `Drawer` | Right-anchored slide-in panel (portal) | same shape + `eyebrow`, `size: sm\|md\|lg\|xl\|2xl` |
| `Toast` | Floating notice (portal, z-[110]) | `tone: success\|error`, `title`, `autoCloseMs` |
| `Field` / `Input` / `Textarea` | Form wrapper + text controls | `label`, `error`, `helper`; FieldContext auto-wires `htmlFor` |
| `Select` | Themed select (portaled listbox) | `options: SelectOption[]`, `value`, `onChange`, `size: sm\|md` |
| `SuggestInput` | Input + autocomplete dropdown | see source |
| `Avatar` | Initial/image disc | `name` seeds gradient, `ring: ember\|arcane\|none` (ember=player, arcane=AI), `status: live\|think\|none` |
| `Portrait` | Card-header portrait frame | `name` seeds initial+gradient, `src`, `height`, overlay `children` |
| `Eyebrow` | Uppercase tracked label | `tone: ember\|arcane\|muted` |
| `SectionHeader` | Icon + serif title row | `icon`, `title`, `tone: ember\|arcane`, `right` slot |
| `PageHeader` | Top-of-screen masthead | `eyebrow`, `title`, `subtitle`, `icon`, `actions`, `size: md\|lg`, `divider` |
| `IconTile` | Tinted glyph plate | `icon`, `tone: ember\|arcane`, `size: sm\|md\|lg`, `glow` (on group-hover) |
| `GlowBackdrop` | Decorative radial glows | `variant: hero\|center\|header\|page` — `page` lives ONLY in AppRouter |
| `Icon` | Lucide wrapper | `icon`, `size` (default 18), `strokeWidth` (default 1.75) |
| `ThemeSongButton` | Enqueue-theme-song play button | sizes; views the global playlist |
| `AuthenticatedImage` / `ImageLightbox` | Auth-aware img / fullsize viewer | see source |

## Components catalog — `src/ui/components/`

| Component | Purpose |
|---|---|
| `Sidebar` | App nav rail (galleries, profile, logout) |
| `LoginModal`, `ConfirmDialog`, `LogoutConfirmDialog`, `AppWarningModal`, `PersonaPickerDialog` | App dialogs built on Modal |
| `LoadingSpinner`, `ServicesDownBanner` | Status surfaces |
| `common/EmptyState` | Empty gallery/list placeholder (`message`, `icon`, `secondaryText`, `button`) |
| `common/ModeBadge`, `common/AttributeList` | Mode indicator; key-value metadata list |
| `lists/Card/CardGrid` | Generic gallery: `layout: grid\|rail`, `density: comfortable\|compact`, search, infinite scroll, skeletons, empty state |
| `lists/Card/Card` | Domain card (Portrait header, options menu, theme song, highlight/disabled) |
| `lists/Card/GalleryCard` | Image-forward 3:4 card for galleries |
| `lists/Card/CardOptions`, `lists/TemplateList` | Card context menu; template list (all re-exported from the `@/ui/components/lists` barrel) |
| `audio/AudioWavePlayer`, `audio/WaveformSeekBar`, `audio/PlaylistDock` | Views of the global playlist (`AudioPlaylistProvider`); dock floats bottom-right `z-[45]` |

## Composition recipes

### Page scaffold

```tsx
<PageHeader
  eyebrow="Library" eyebrowTone="ember"
  icon={<IconTile icon={Swords} tone="ember" />}
  title="Your adventures" subtitle="Pick up where you left off"
  actions={<Button kind="primary">New adventure</Button>}
  divider
/>
{/* content sections */}
```

Ambient glow is app-shell-level only — `GlowBackdrop variant="page"` already sits in `AppRouter` (fixed, -z-10). Never add per-page/section glows at the top of screens.

### Form

```tsx
<Field label="Character name" error={errors.name} helper="Shown to other players">
  <Input placeholder="Enter a name…" value={name} onChange={e => setName(e.target.value)} />
</Field>
<Field label="Alignment">
  <Select options={ALIGNMENTS} value={alignment} onChange={setAlignment} />
</Field>
<SwitchRow label="Public" description="Visible in the gallery" checked={pub} onChange={setPub} />
```

FieldContext wires `label htmlFor` to the control's generated id — works for Input/Textarea/Select/Switch without manual ids.

### Overlay (Modal / Drawer)

```tsx
<Modal open={open} onClose={close} title="Create character" size="lg"
  footer={<>
    <Button kind="ghost" onClick={close}>Cancel</Button>
    <Button kind="primary" onClick={submit}>Create</Button>
  </>}>
  …fields…
</Modal>
```

**React 19 phantom-submit gotcha:** conditionally swapping a plain button for a `type="submit"` button at the same footer position fires an instant phantom submit (sync discrete-event commit). Fix: wrap the swap in `startTransition` and guard the submit handler with a ready flag. Details in [references/component-api.md](references/component-api.md#gotchas).

### Card grid

```tsx
<CardGrid
  items={characters}
  getItemKey={c => c.id}
  layout="grid" density="comfortable"
  onSearch={setQuery} searchPlaceholder="Search characters…"
  onLoadMore={loadMore} hasMore={hasMore} loadingMore={loadingMore}
  emptyStateTitle="No characters yet"
  renderCard={c => <Card title={c.name} subtitle={c.class} imageUrl={c.portrait} onClick={() => open(c)} />}
/>
```

`layout="rail"` gives a horizontal shelf (used on the dashboard); Portrait gradient/initial seeds from `title`.

## Spacing & layering

- Density steps: tight `p-3 gap-2` · comfortable `p-4 gap-3` · spacious `p-6 gap-4`.
- z-index ladder: content `z-0/2/10` → PlaylistDock `z-[45]` → Modal/Drawer `z-50` → Toast `z-[110]`.
