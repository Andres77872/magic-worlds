# Component API reference

Summarized **load-bearing** API surface only — unions, required props, slots, portal behavior. The source file listed per component is authoritative; read it before relying on anything not listed here.

## Actions

### Button — `src/ui/primitives/Button.tsx`
Extends `ButtonHTMLAttributes`. `kind?: 'primary' | 'secondary' | 'ghost' | 'arcane' | 'danger'` (default primary), `size?: 'sm' | 'md' | 'lg'`, `full?: boolean`, `iconLeft?/iconRight?: ReactNode`. Kind semantics: primary = ember hero action; secondary = outline; ghost = text-only; arcane = AI/magic action; danger = destructive (blood). Pressed state scales `.98`.

### IconButton — `src/ui/primitives/IconButton.tsx`
`label: string` **required** (becomes `aria-label` + `title`), `size?: 'sm' | 'md' | 'lg'` (8/10/11 squares), `tone?: 'default' | 'active' | 'danger'`, `children` = lucide icon.

### Chip — `src/ui/primitives/Chip.tsx`
Button-semantics filter pill: `active?: boolean`, `icon?: ReactNode`. For non-interactive pills use `Tag` (`src/ui/primitives/Tag.tsx`, span, neutral only).

### Switch / SwitchRow — `src/ui/primitives/Switch.tsx`
`checked: boolean`, `onChange: (checked: boolean) => void`, `size?: 'sm' | 'md'`. `SwitchRow` adds `label` + `description` in a settings-row layout.

## Surfaces

### Card — `src/ui/primitives/Card.tsx`
Base surface: `rounded-xl bg-ink-700 border-parchment-50/[.08] shadow-md`. `interactive?: boolean` adds `hover:-translate-y-[3px]` + `shadow-card-hover`.

### Portrait — `src/ui/primitives/Portrait.tsx`
`name?` seeds the faint display initial + `gradientFor(name)` background; `src?` swaps to image; `height?: number | string`; `children` overlay on top (buttons etc.); bottom vignette for text legibility.

### IconTile — `src/ui/primitives/IconTile.tsx`
`icon: LucideIcon`, `tone?: 'ember' | 'arcane'`, `size?: 'sm' | 'md' | 'lg'` (40/52/56px), `glow?: boolean` lights `shadow-glow-*` when a `group` parent is hovered.

### GlowBackdrop — `src/ui/primitives/GlowBackdrop.tsx`
`variant?: 'hero' | 'center' | 'header' | 'page'`. `page` is the app-shell ambient pair — rendered ONCE in `src/app/router/AppRouter.tsx` (fixed, `-z-10`, with `isolate` on the shell); never add it per page. Known exception: this file inlines rgba values — don't copy that pattern.

## Overlays (all portal to `<body>`)

### Modal — `src/ui/primitives/Modal.tsx`
`open: boolean`, `onClose: () => void`, `title?`, `icon?`, `showClose?` (default true), `size?: 'sm' | 'md' | 'lg'`, `footer?: ReactNode` (action bar), `children`. Dim+blur scrim; scrim click and Escape close.

### Drawer — `src/ui/primitives/Drawer.tsx`
Right-anchored: same contract as Modal plus `eyebrow?: ReactNode` and `size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'`. Slide-in 220ms.

### Toast — `src/ui/primitives/Toast.tsx`
`open`, `tone: 'success' | 'error'`, `title`, `message?`, `onClose`, `autoCloseMs?: number | false`. Bottom-right (bottom-center mobile), `z-[110]`, `role=status/alert` by tone.

### ImageLightbox — `src/ui/primitives/ImageLightbox.tsx`
Fullsize image overlay; pairs with `AuthenticatedImage` (`src/ui/primitives/AuthenticatedImage.tsx`, bearer-token image fetch → blob URL).

## Forms

### Field / Input / Textarea — `src/ui/primitives/Field.tsx`
`Field`: `label?`, `error?` (replaces helper, blood tint), `helper?`, `htmlFor?`. Provides FieldContext so nested Input/Textarea/Select/Switch get the label wired to a generated id automatically. `Input`/`Textarea` extend native attributes and share `controlBaseClass` (ink-700 fill, parchment placeholder, ember focus ring) — reuse `controlClass`/`controlBaseClass` exports when building a custom control to match.

### Select — `src/ui/primitives/Select.tsx`
`options: readonly SelectOption[]` (`{ value, label, textValue?, description?, disabled? }`), `value: string | null | undefined`, `onChange: (value: string) => void`, `placeholder?`, `size?: 'sm' | 'md'`. Listbox is portaled + anchor-positioned; type-ahead via `textValue`.

### SuggestInput — `src/ui/primitives/SuggestInput.tsx`
Text input + suggestion dropdown; see `SuggestInputProps` in source.

## Identity & text

### Avatar — `src/ui/primitives/Avatar.tsx`
`name?` (seeds initial + gradient), `initial?` override, `src?`, `size?: number` (default 40), `ring?: 'ember' | 'arcane' | 'none'` — **ember = player, arcane = AI**, `status?: 'live' | 'think' | 'none'` (`think` runs `animate-think` arcane pulse).

### Badge — `src/ui/primitives/Badge.tsx`
`tone?: 'ember' | 'arcane' | 'live' | 'danger' | 'nsfw' | 'neutral' | 'glass'`, `icon?`. `glass` = blurred translucent (over images).

### Eyebrow — `src/ui/primitives/Eyebrow.tsx`
Uppercase tracked label, `tone?: 'ember' | 'arcane' | 'muted'`.

### SectionHeader — `src/ui/primitives/SectionHeader.tsx`
`icon?: LucideIcon`, `title`, `tone?: 'ember' | 'arcane'`, `right?: ReactNode` (count/action slot).

### PageHeader — `src/ui/primitives/PageHeader.tsx`
`eyebrow?`, `eyebrowTone?: 'ember' | 'arcane' | 'muted'`, `title`, `subtitle?`, `icon?` (emoji or IconTile), `actions?`, `size?: 'md' | 'lg'`, `as?: 'h1' | 'h2'`, `divider?: boolean`. The one masthead for top-level screens — kept crisp, no backdrop glow.

## Lists — `src/ui/components/lists/`

Card components live in the `Card/` subfolder; everything is re-exported from the `lists/index.ts` barrel (`@/ui/components/lists`).

### CardGrid — `Card/CardGrid.tsx`
Generic, typed `CardGrid<T>`: `items: T[]`, `renderCard(item, index)`, `getItemKey?`, `layout?: 'grid' | 'rail'` (grid = responsive auto-fill; rail = horizontal shelf with `railWidth?: 'default' | 'compact'` + `fadeEdges?`), `density?: 'comfortable' | 'compact'`, `loading?` + `loadingComponent?` (skeletons), `onLoadMore?/hasMore?/loadingMore?` (infinite scroll), `onSearch?/searchPlaceholder?` (debounce upstream), `emptyStateTitle/Description/Action`, `'data-testid'?`. Rail entrance animation via IntersectionObserver adding `.visible`.

### Card (domain) — `Card/Card.tsx`
`title` (seeds Portrait initial/gradient), `subtitle?`, `imageUrl?`, `themeSongUrl?`, `options?: CardOption[]` (context menu via `CardOptions.tsx`), `isLoading?`, `disabled?`, `highlight?` (ember border), `onClick?`.

### GalleryCard — `Card/GalleryCard.tsx`
Image-forward 3:4 variant for galleries; exports a `SkeletonCard` for loading states. Context menu: `Card/CardOptions.tsx`.

### Fixtures — `fixtures.ts`
Story/sample data: `characters`, `worlds`, `adventures`, `templates`, `characterChats`.

## Audio — `src/ui/components/audio/`

All are **views of the global playlist** (`AudioPlaylistProvider` in `src/app/providers/`, one shared audio element, queue persisted to localStorage `magic_worlds:playlist:v1`). There is no standalone `useAudioPlayer` — it was deleted.

- `AudioWavePlayer.tsx`: `src` (resolved absolute URL), `title?`, `durationMs?`, `peakSeed?` (deterministic idle pseudo-peaks), `trackMeta?` (cardName/cardType/cardId/artworkUrl), `showEnqueue?`, `showDownload?`.
- `WaveformSeekBar.tsx`: peaks + seek; ember progress.
- `PlaylistDock.tsx`: floating collapsible dock, bottom-right, `z-[45]`.
- `ThemeSongButton` (primitive): small circular enqueue/play button for card headers.

## Gotchas

### React 19 phantom submit
Swapping a regular button for a `type="submit"` button at the same position in a form footer fires an immediate phantom submit — React 19 commits the swap synchronously inside the discrete event, and the original click lands on the new submit button. Fix:

```tsx
const [ready, setReady] = useState(false)
// when entering the final step:
startTransition(() => setReady(true))
// in onSubmit:
if (!ready) return
```

### Playlist deep-import mock
Tests that mock `@/app/hooks` MUST also mock `@/app/hooks/usePlaylist` — audio components deep-import it, so the barrel mock alone won't intercept.

### GlowBackdrop rgba
`GlowBackdrop.tsx` hardcodes rgba glow colors (pre-existing exception to the tokens-only rule). Don't replicate; don't "fix" without a design pass.
