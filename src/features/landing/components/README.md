# Landing — the adaptive front door

One route, two experiences, picked in `LandingPage.tsx` by auth + content:

- **Guest / empty account** — the marketing front door: `LandingHero` (+ `HeroPreviewCard`),
  `AccessMenu` (large create cards), `HowItWorksSection`, `TwoWaysToPlay`, `ShowcaseWorlds`,
  `ClosingCTA`. Copy and sample data live in `landingContent.ts`.
- **Returning user** — a zoned dashboard ordered by intent (resume → start new → manage → create),
  each zone visually distinct per the Reverie zone grammar.

## Dashboard zones (top → bottom)

| Zone | Component(s) | Treatment |
|---|---|---|
| 1 · Hero | `GreetingHeader` (global search) + `HeroSessionGallery` or `HeroScene` | Cinematic band, max-w 1240px; ambient candlelight comes from the app shell (`GlowBackdrop variant="page"` in `AppRouter`), not a section glow. Returning users with active sessions get a one-slide-per-view paged carousel (chevrons + dots, hidden scrollbar) of the last 10 chats/adventures; users without sessions get the featured begin-mode hero. Artwork blur-bleed, gradient + monogram fallback. |
| 2 · Begin | `BeginZone` (+ `FilterChips`) and `CastRail` | Image-forward `GalleryCard` grid of templates (capped — the gallery exhausts); chips scope this zone only. The cast rail carries the arcane Chat affordance. |
| 3 · Library | `LibraryShelf` (+ `StoryCard`) | The quiet band: hairline divider, muted eyebrow, Chip tabs (personas / worlds / items / novels) over one compact rail. |
| 4 · Create | `CreateBand` | Raised workbench panel: ember hairline shimmer + `IconTile` tiles from `CREATE_ACTIONS`. |

While the search field has a query, zones 2–4 are replaced by `SearchResults` — grouped,
cross-section matches rendered with each zone's own card language.

## View-models (pure, unit-tested)

- `sceneModel.ts` — adventure template → discovery "scene" (title/tags/filter/search helpers).
- `resumeModel.ts` — in-progress adventures + character chats → one recency-sorted
  `ResumeSession` list (titles, snippets, mono meta) used by the hero gallery
  and search results.
- `searchModel.ts` — `searchDashboard()` sweeps every in-memory list into capped, ordered groups.
- `libraryCards.ts` — typed entity → `GalleryCard` props, mirroring `galleryConfig.tsx` so the
  dashboard and galleries present identical cards.

Conventions: components stay presentational (callbacks in, no data fetching); `LandingPage`
owns auth gating (`requireAuth`), persona picking, and navigation; copy follows the Reverie
voice (sentence case, no emoji, ember = play/create, arcane = the AI side).
