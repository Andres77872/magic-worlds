# design-sync notes — Reverie design system (magic-worlds)

Project: **Reverie Design System** · claude.ai/design id `7888d2e2-9907-4930-9b2c-24a6b4ac3aea`.
Shape: **storybook**. Scope: **src/ui only** (primitives + components, 57 components / 198 stories).

## The big picture (why this repo is unusual)

magic-worlds is an **unbuilt app**, not a published component library — no `dist/`, no
`.d.ts`, `package.json` has no `exports`/`module`/`types`. The storybook-shape converter,
however, requires a built DS package (compiled JS dist **and** a `.d.ts` tree for the
component export list + prop contracts). So this sync **fabricates that package** under
`.design-sync/dist/` (gitignored, regenerated each sync).

`src/ui` is also **deeply coupled to app infrastructure** (api singleton, providers, i18n,
hooks). The bundle bundles src/ui from source; the coupling is handled with stubs + a
provider, both config-only (no lib forks).

## Regenerating everything (re-sync order)

```sh
# 1. staged scripts + deps (fresh clone only for the installs)
cp -r <skill>/package-build.mjs <skill>/package-validate.mjs <skill>/resync.mjs \
      <skill>/lib <skill>/storybook <skill>/non-storybook .ds-sync/      # always
(cd .ds-sync && npm i esbuild ts-morph @types/react playwright && npx playwright install chromium)  # fresh clone
# 2. the scoped storybook reference (the compare oracle) — rebuild when src/ui changes
npx storybook build -c .design-sync/sb-config -o "$(git rev-parse --show-toplevel)/.design-sync/sb-reference"
# 3. the compiled Tailwind CSS (cfg.cssEntry + oracle injection). The storybook static
#    build ships utilities UN-compiled, so this uses the app's own vite build. Run AFTER
#    step 2 so it can inject the CSS into the oracle's iframe.html.
node .design-sync/make-css.mjs
# 4. the stand-in dist (.d.ts tree + bundle/types/css entry) — REQUIRED before the converter
node .design-sync/make-dist.mjs
# 5. driver (closing receipt). First sync omits --remote.
node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules ./node_modules \
  --entry .design-sync/dist/index.js --out ./ds-bundle [--remote .design-sync/.cache/remote-sync.json]
```

Intermediate fix-loop build (not the driver): `node .ds-sync/package-build.mjs --config
.design-sync/config.json --node-modules ./node_modules --entry .design-sync/dist/index.js
--out ./ds-bundle` then `node .ds-sync/package-validate.mjs ./ds-bundle`.

## Committed inputs (durable set) and how they fit together

- `config.json` — `entry` is passed on the CLI (`.design-sync/dist/index.js`), not in config.
  `tsconfig` = `../tsconfig.paths.json` (relative to PKG_DIR = `.design-sync/dist`).
- `ds-entry.ts` — the bundle's source entry (esbuild bundles it). Re-exports the src/ui
  barrels + the 7 unbarreled storied components + forces primitive `Card` + the provider.
- `tsconfig.paths.json` — esbuild `@/` resolution for the bundle. **Three jobs**: (1) the real
  `tsconfig.app.json` can't be used — its `@/*` glob's literal `/*` collides with the
  converter's `/* */` comment-stripper, so the plugin returns null and resolves nothing;
  (2) the plugin returns a *directory* for barrel imports, so every directory-barrel needs an
  explicit `index.ts` entry; (3) redirects the `@/infrastructure/api*` boundary to inert stubs.
  Keep specific entries before `@/*`. Any value MUST avoid the literal sequences `/*`, `*/`, `//`.
- `stubs/{api,mediaUrl,useAuthenticatedMediaUrl}.ts` — inert api boundary. The real api builds
  `apiService` at module scope reading `import.meta.env` (fatal in an esbuild IIFE — `{}.env.X`
  throws and kills the whole bundle) and opens network/ws side effects. Previews never call the
  backend. **`import.meta.env` is only safe to leave in LAZY (in-function) code; never in a
  module-scope const that the bundle evaluates.**
- `preview-provider.tsx` — `ReveriePreviewProvider` (cfg.provider). Wraps `I18nextProvider` +
  the app's full `AppProvider` chain so context-coupled components (Sidebar, LoginModal,
  LanguageMenu, banners, audio) render instead of throwing `use<X> outside <Provider>`. With
  the api stubbed, providers settle into a logged-out/empty state — a valid preview baseline.
  It MUST be a bundle export so provider + consumer share one set of React context instances.
- `tsconfig.dts.json` + `make-dist.mjs` — emit the `.d.ts` tree (rootDir src/, emitDeclarationOnly,
  noEmitOnError false → emits despite ~18 type errors) and write `dist/{package.json,index.js,
  index.d.ts}`. `dist/package.json` has a `name` so the converter's PKG_DIR walk stops there.
- `sb-config/` — src/ui-scoped storybook (oracle). `main.ts` narrows `stories` to src/ui and
  **drops standalone MDX** (NarrativeProse.mdx imports `@/features/...` which the addon-docs MDX
  pass can't alias-resolve; foundation MDX aren't bundle components anyway). `preview.tsx`
  re-exports the real `.storybook/preview` (no drift); `preview-head.html` copies the Google
  Fonts links so the oracle renders with the brand fonts.

## Decisions & gotchas

- **Fonts**: Cormorant Garamond / Spectral / Hanken Grotesk / Space Mono load from Google Fonts
  at runtime (a remote `@import` scraped into styles.css) → `[FONT_REMOTE]`, no `[FONT_MISSING]`.
  Designs built with the DS load the real fonts from Google. No local font files are shipped.
- **Two `Card`s**: primitive `Card` (Primitives/Card) and `lists/Card/Card` (Components/Lists/Card)
  both export the name `Card`. A flat global can hold one — ds-entry forces the **primitive**.
  `Components/Lists/Card` therefore renders the primitive in its preview (expected mismatch — a
  genuine name collision; can't be excluded via titleMap since both resolve to name "Card").
  **The collision LEAKS**: any story that renders the lists `Card` via the global (its `Card`
  import redirects to `window.Reverie.Card` = primitive) collapses to the primitive's children-only
  render. Confirmed in **CardGrid** (Default + With Search stories → mismatch; the grid shell,
  Loading/Empty/Rail render fine). Not fixable by an owned preview (the compiled story imports the
  same forced global). Only a distinct bundle export name for the lists Card would fix it, which the
  storybook title→name pairing can't express. Accepted limitation: 6 story mismatches total.
- **Framing is noise, not a defect**: previews render the component top-left on the full dark
  Reverie ink canvas (the page body); Storybook centers it in a small dark card. This canvas/
  centering difference is FRAMING — ignored per the §4 rubric. It is the only systematic visual
  delta across the whole roster; the actual product grid card (cardMode) frames each story in a
  light, content-sized cell and looks clean.
- **[STORY_CAP] tails** (default cap 6/component): Select 6/9, Illustration 6/7, CardGrid 6/7 —
  the captured stories grade match; the tail stories are uncaptured (verified-by-upload on re-sync).
  Raise with `--max-stories N` per component if a tail variant needs individual grading.
- **PlaylistDock**: only story (`--seeded`) seeds the playlist via its own `usePlaylist`, which
  story-imports bundles as a *separate* context from cfg.provider's ("no shim can fix that, by
  construction"). Story is skipped → floor card. Authoring a faithful preview would need the
  bundle's own playlist seeded, which the compiled-story pipeline can't express.
- **Illustration**: story imports `heroArt` from `@/assets/marketing` (dir-barrel of `.webp`).
  Fixed via a tsconfig.paths index entry + `cfg.storyImports.loaders {.webp,.png: dataurl}`
  (tree-shaking keeps only the used asset).
- **GRID_OVERFLOW overrides**: AppWarningModal + LogoutConfirmDialog → `cardMode: single`;
  FloatingWindow → `cardMode: column`.

## Verification findings (grading, all 57 components)

124+ stories `match`; the non-match grades are documented and accepted, not defects:
- **Semi-transparent tone fills composite paler in the preview** than in Storybook (e.g. Badge
  `bg-ember-500/15`, AppUpdateBanner `bg-ember-500/10`) — the alpha fill sits over the preview's
  capture backdrop vs Storybook's small centered dark card. Not a CSS/token mismatch; the markup
  and tokens are identical. Affects Badge/ModeBadge (graded `match`) and AppUpdateBanner (`close`).
- **App-shell components render in the logged-out/empty state** (api stubbed) while their stories
  mock a signed-in user / active tasks / pending update → `close` (the component renders correctly,
  the state differs). Sidebar (Signed In ×2), MobileTopBar (Signed In, With Active Tasks),
  SidebarAccountMenu (Signed In/Root/Collapsed), AppUpdateBanner (Available). ApiStatusMonitor
  MATCHES (its stories drive state via explicit props, not runtime context).
- **Context-gated banners** diverge by visibility: ServicesDownBanner (Storybook forces offline,
  preview's stubbed ApiStatus is online → banner self-hides) and CookieConsentBanner (reverse:
  preview shows it, Storybook's decorator resolves already-consented) → both `close`.
- **Card collision stories skipped** (`cfg.overrides.{Card,CardGrid}.skip`): the lists-Card stories
  and CardGrid Default/With Search render the primitive Card (collision), so they're skipped rather
  than ship a wrong render. `Card` then shows only its 2 primitive stories; `CardGrid` shows
  Loading/Empty/Rail/Skeletons.
- **PlaylistDock** ships a floor card (its only story can't share the preview's playlist context).

## Known render warns (triaged — not new on re-sync)

`[RENDER_THIN]` on icon-/minimal-only components (Icon, IconButton, CopyTextButton,
WaveformSeekBar, CardOptions, GalleryCardSkeleton, ServicesDownBanner) — they legitimately
paint no text. `[RENDER_THIN] variants render identically` on overlay primitives (Modal,
Drawer, Toast, Tooltip, ImageLightbox) and PersonaPickerDialog — closed/trigger states look
alike statically; verify the open state against storybook in compare.

## Re-sync risks (what to watch)

- **`make-dist.mjs` index list** must stay in sync with `ds-entry.ts` (the 7 unbarreled
  components + forced `Card`). If a new src/ui component is added outside the barrels, add it to
  BOTH or it won't pair with its storybook title.
- **import.meta.env**: a new module-scope `import.meta.env` reachable from src/ui will crash the
  whole bundle at load. If a future build shows every preview blank, suspect this and stub the
  offending leaf via tsconfig.paths.
- **New app contexts**: if a new src/ui component reads a context not in `AppProvider`, it'll
  throw `use<X> outside <Provider>`; add that provider to ReveriePreviewProvider.
- **Prop contracts**: `.d.ts` prop types that reference `@/`-aliased types resolve to weak
  shapes (ts-morph in the converter has no `@/` paths). Core props (variant/size/etc.) are fine.
- **Stubs drift**: if src/ui starts importing new symbols from `@/infrastructure/api*`, extend
  the matching stub or the bundle build will fail to resolve them.
