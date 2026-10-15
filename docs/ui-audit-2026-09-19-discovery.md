# Discovery and public UI audit — 2026-09-19

**Status reconciliation — 2026-10-14: historical review.** This document retains its dated source/fixture findings and recorded fixes. It does not prove current live behavior, enabled rollout, or comprehensive accessibility. Disabled features are WIP in the [status register](FEATURE_STATUS.md); current release work and unrevalidated UX recommendations belong in the [roadmap](ROADMAP.md).

## Method and evidence

Reviewed actual route components in **60 deterministic Audit/Discovery stories**, each with independent **1280px desktop and 390px mobile** iframe widths. Every story/state listed below was inspected in rendered browser screenshots at both widths. Long pages were inspected in successive sections; filters, menus and dialogs were opened before capture. Native screenshots are present in the audit conversation; screenshot files were not exported. Links reproduce both viewports. Source review alone was not counted as a visual pass.

Fixture source: src/features/gallery/components/DiscoveryAudit.stories.tsx. Auth, Data, Navigation and CookieConsent providers use synthetic records and fail-closed API mocks. Unexpected service calls reject locally. Auth forms use fictional values with inert mock services. No live user data, credentials, publication, deletion or paid requests were changed. Static Storybook 6007 prevented HMR from resetting interactions; later fixes were rechecked on 6006.

For grouped states below, replace the suffix after audit-discovery-- in the linked URL with the recorded slug. **Every listed state has desktop: inspected and mobile: inspected**, except explicit boundaries. Global shell/account, authoring and interaction screens have separate audit owners.

## Confirmed issues fixed and visually rechecked

- **DocsPage.tsx:** mobile navigation forced the grid beyond the viewport and clipped prose. Single-column minmax layout/min-width constraints fix it. Passive prose boxes became open articles/dividers; meaningful workspace links remain cards. Removed redundant glow and improved helper contrast. All 11 guide sections and search states rechecked.
- **LegalPage.tsx:** repeated highlight, article and sidebar boxes consolidated into open sections and one sidebar divider. Privacy's four highlights use a balanced desktop two-column grid. All four pages inspected through lower content at both widths.
- **NotFoundPage.tsx:** bounded artwork, long-path wrapping, readable helper text, removed redundant glow. Rechecked using an unusually long route.
- **GalleryPage/MediaGalleryPage/CommunityGalleryPage:** failed loads no longer compete with a misleading empty state. Community has a single error callout with Retry; explicit skeleton width prevents its loading card collapsing inside the flex layout. All final states rechecked.
- **SharedCardPage.tsx:** open metadata section, one primary Import, removed duplicate copy/import controls, Retry for failed loads and Community recovery for missing tokens. Existing/import-copy actions wrap on mobile. All six shared states and duplicate confirmation rechecked.
- **CardPreviewModal.tsx:** Import disabled while loading, errored, missing card data or importing; readable attribution and wrapping footer actions. All five domain types plus four status variants rechecked. Actual domain cards deliberately retained.
- **CardPicker.tsx / useAnchoredPopup.ts:** popup previously clipped left and beneath New Novel's footer on mobile. Body portal, viewport clamping, optional minimum width, scroll bounds and dismiss/focus handling fix this. Media inspected at both widths; authoring auditor independently confirmed New Novel at 390px.
- **MediaFilterBar.tsx / MediaThemeCard.tsx:** dates/filter hints now use readable semantic text; rechecked.
- **TwoWaysToPlay.tsx:** two passive raised panels replaced by open semantic articles, top rules and spacing, retaining meaningful mode accents. ClosingCTA.tsx/LandingFooter.tsx helper contrast improved. Final 6006 screenshots confirmed all changes at both widths.
- **GreetingHeader.tsx:** intrinsic sizing made mobile search jump from 234px to 300px when result count appeared. Bounded 360px field now fills the available mobile width consistently; final 6006 screenshot confirmed.
- **src/ui/components/lists/Card/GalleryCard.tsx:** Badge's built-in inline-flex defeated hidden classes and crowded mobile list titles. Responsive wrapper spans control race/type and version visibility. Final 6006 screenshots show metadata on desktop and clear mobile titles.
- **src/app/i18n/locales/en.ts and es.ts:** two guide passages incorrectly promised JSON export. Corrected to actual PNG download. Menu/failure feedback inspected; copy-only correction source-verified, not separately recaptured.
- **Shared issue reported to root:** IconButton's relative position overrode ImageLightbox's absolute close placement. Root fixed the primitive. Final 6006 screenshots confirm top-right close placement and gallery search-clear placement at both widths.

## Rendered route and state ledger

### Landing

Source: src/features/landing/components/LandingPage.tsx and local section components.

[Returning dashboard](http://localhost:6006/iframe.html?id=audit-discovery--landing-returning&viewMode=story): greeting/search; novel, chat and adventure hero slides; creation band; adventure, conversation and writing continuation rails; featured adventures with All and sci-fi filters; cast; lorebook, world and item shelves; full footer. Search Lyra showed resume-row and character matches; zzzz showed contextual no-results and recovery actions; Escape restored the dashboard.

[Guest](http://localhost:6006/iframe.html?id=audit-discovery--landing-guest&viewMode=story): hero, six creation shortcuts, eight feature examples, all three onboarding steps, both mode articles, six showcase examples, closing CTA and full footer. Other states: landing-fresh (authenticated empty library/CTA), landing-loading. All at both widths. No separate landing-owned API-error panel exists; global status feedback is covered by root. Persona/group dialog is covered below; New Novel is covered by authoring. Live session/call creation was not exercised.

### Card galleries

Sources: src/features/gallery/components/GalleryPage.tsx, galleryConfig.tsx, hooks/useCardGallery.ts, shared GalleryCard.

[Characters](http://localhost:6006/iframe.html?id=audit-discovery--characters&viewMode=story) and personas, worlds, items, adventures: all five private galleries inspected. public-characters, public-personas, public-worlds, public-items, public-adventures: all five public variants inspected with attribution/import actions. State fixtures: gallery-empty, gallery-loading, gallery-error, gallery-guest. Default persona shelf, singular count and image/fallback variants inspected.

Actual interactions: Large/Compact/List layouts; search zzzz, no-match message and clear; ten-action card menu; Delete confirmation opened/canceled; group selection at zero/two participants and persona dialog opened without final start; share-failure toast; Download PNG failure toast. PNG export directly downloads, so no export modal exists. Successful backend download/publication was not attempted.

Version history opened from gallery with no versions. Populated VersionHistoryDrawer and publisher/restorer CardHistoryDrawer were independently inspected by authoring at both widths through authoring-panels--version-history. Router-level auth gating belongs to root's shell audit.

### Community and shared links

Sources: src/features/gallery/components/CommunityGalleryPage.tsx, SharedCardPage.tsx, CardImportOverlays.tsx.

[Community](http://localhost:6007/iframe.html?id=audit-discovery--community&viewMode=story): Characters, Personas, Worlds, Items and Adventures shelves inspected, including mobile horizontal continuation. community-empty, community-loading, community-error: common status layouts inspected, final skeleton and Retry rechecked.

[Shared](http://localhost:6007/iframe.html?id=audit-discovery--shared&viewMode=story): shared, shared-imported, shared-loading, shared-error, shared-guest, shared-missing. Loaded artwork, open metadata, import/sign-in, existing/import-copy, recovery actions and mobile wrapping inspected. Import-a-copy confirmation opened; no backend import executed.

### Card preview overlays

Source: src/features/cards/components/CardPreviewModal.tsx.

[Character preview](http://localhost:6007/iframe.html?id=audit-discovery--preview-character&viewMode=story), preview-persona, preview-world, preview-item, preview-adventure: all five domain layouts within the actual modal inspected at both widths. preview-loading, preview-error, preview-imported, preview-importing: status messages, progress/disabled actions and wrapping inspected. Loading/error gating also covered by regression tests.

### Media

Sources: src/features/gallery/media/components and hooks/useMediaGallery.ts.

[Media](http://localhost:6006/iframe.html?id=audit-discovery--media&viewMode=story): combined image/theme grid, Images-only, Themes-only, card-type filters and no-match result (Themes + Items) with Clear filters. Fixture handlers honor filters. media-empty, media-loading, media-error, media-guest: all at both widths.

CardPicker opened with all options, searched to no results, then world selected; chip, clear and helper text inspected. Lightbox and prompt opened; final close fix rechecked. Delete-image confirmation opened without deletion. Theme transport/seek/playlist/download controls visually inspected; actual audio playback/download and backend generation were not exercised.

### User guide

Sources: src/features/docs/components/DocsPage.tsx and docsContent.ts.

[Guide](http://localhost:6007/iframe.html?id=audit-discovery--guide&viewMode=story): all 11 sections inspected in successive captures—Start, App map, Find your work, Cards, Play modes, Voice presets, Voice calls, Writing, Resources, Media and tasks, Best practices. Voice presets/Resources recaptured after settled anchors; lower utility rows inspected. Search voice, no matches zzzz, and Clear search inspected. Mobile prose/navigation remains within viewport.

### Legal/public information

Sources: src/features/legal/components/LegalPage.tsx and legalContent.ts.

[About](http://localhost:6007/iframe.html?id=audit-discovery--about&viewMode=story), [Contact](http://localhost:6007/iframe.html?id=audit-discovery--contact&viewMode=story), [Privacy](http://localhost:6007/iframe.html?id=audit-discovery--privacy&viewMode=story), [Disclaimer](http://localhost:6007/iframe.html?id=audit-discovery--disclaimer&viewMode=story): each header/highlight/article layout inspected through lower content. Contact included full lower sidebar; Privacy all seven prose sections; Disclaimer all five. Shared lower navigation uses the same inspected layout.

### Authentication and 404

Sources: src/features/auth/PasswordResetPage.tsx, EmailVerifyPage.tsx, GoogleCallbackPage.tsx; src/features/errorPages/components/NotFoundPage.tsx.

[Reset](http://localhost:6007/iframe.html?id=audit-discovery--reset-form&viewMode=story): reset-form, reset-missing, reset-success, reset-error, reset-submitting, reset-mismatch—six form/message states inspected with inert mock requests. Verification: verify-success, verify-loading, verify-error, verify-missing. Callback: google-loading, google-error. All 12 auth states inspected at both widths; real credentials/provider redirects/email delivery were not exercised.

[Not found](http://localhost:6007/iframe.html?id=audit-discovery--not-found&viewMode=story): long-path wrapping, artwork, copy and recovery actions inspected at both widths.

## Validation and limits

- Scoped Vitest: **13 files, 147 tests passed** after main fixes, covering gallery/media, preview, docs, legal, 404 and email verification. Earlier focused portal/modal run: **2 files, 18 tests passed**.
- Added behavioral checks for preview import gating and CardPicker portal/viewport bounds. Preserved concurrent gallery linked-card retry and media concurrency work.
- Final Storybook typecheck passed. Final GalleryCard/HeroSessionGallery checks: **2 files, 20 tests passed**. Root owns full repository build/test results.
- This is a rendered visual/state review at the two specified widths. It does not claim live backend integration, real OAuth/email delivery, paid generation, successful destructive/publication actions, media playback, every arbitrary data length, all locales or all browsers/devices. No confirmed visual defect in this owned scope was left unresolved.
