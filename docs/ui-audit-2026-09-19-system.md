# Account and shared-system visual review — 2026-09-19

**Status reconciliation — 2026-10-14: historical review.** This document retains its dated source/fixture findings and recorded fixes. It does not prove current live behavior, enabled rollout, or comprehensive accessibility. Disabled features are WIP in the [status register](FEATURE_STATUS.md); current release work and unrevalidated UX recommendations belong in the [roadmap](ROADMAP.md).

This ledger records observed UI coverage, not a claim that every backend workflow or possible data combination was tested. Previews use actual production components with offline data. No purchases, generation, account changes, or content deletion were submitted.

## Reproduction and evidence

`src/ui/components/SystemAudit.stories.tsx` supplies real account, billing, notification, task, and failure surfaces. `Audit/Responsive comparison` embeds each subject in real 1280 × 1150 and 390 × 844 viewports; only the desktop audit image is scaled. Example:

`http://localhost:6006/iframe.html?id=audit-responsive-comparison--compare&viewMode=story&subject=audit-system--profile-account`

A static build on port 6007 was also used to prevent hot reload from resetting open dialogs. Later fixes were rechecked on 6006. Settled screenshots and accessibility state were inspected. Blank, stale, or timed-out captures were not counted as evidence.

## Observed account and system views

- **Profile:** Membership, Usage, Shared cards, Account, Security; loading, load error, and signed-out page. Account overflow measured 625px at 390px before the grid-minimum-width fix and 390px afterward. Selected horizontal tabs remain in view. Display-name editing was opened without submitting.
- **Membership:** three plans with collapsed and expanded limits; pay-as-you-go section; redemption dialog. The detailed limits now use native disclosures, shortening the initial comparison. Redemption input and disabled-submit state fit both widths.
- **Sharing:** empty public cards and populated public/unlisted rows, including a long title. Both modes preserve actions at phone width. Copy/revoke/unpublish were not submitted.
- **Account/security:** email fields, wrapped email rows, password fields and danger section. Delete-all-data dialog was opened and inspected without entering credentials or confirming deletion.
- **Billing:** populated plans and credit packs; loading, failure/retry, unavailable, and signed-out views. Final error uses the shared readable Callout.
- **Notifications:** populated success/warning/error/info rows; loading, empty, and failed fetch. Loading now has explicit feedback; failure no longer also claims there are no notifications.
- **Tasks:** active/completed/failed filters, expanded rows, error details, and empty drawer. Rows use dividers rather than nested cards. Collapsed detail controls are inert. The completed fixture contains no media assets; playback behavior is covered separately by the playlist/component tests.
- **Data-load failure banner:** full message and retry/dismiss controls remain visible on phone; no truncation.
- **Page/app error boundaries:** both fallback layouts and their retry/reload actions were rendered at both widths.

## Observed shared overlays and chrome

- **Authentication:** sign-in, registration and password-recovery form at both widths. No credentials entered and no request submitted. Authentication errors now use the same danger Callout as other forms.
- **First-run notice:** full opening copy at both widths. Initial panel focus prevents the phone dialog jumping past its introduction to a lower link. Acceptance was not submitted.
- **Cookies:** banner and preferences at both widths. Preference rows were consolidated using the plain SwitchRow variant.
- **Navigation:** mobile drawer and top bar, populated account menu with language choices, root/admin account menu, and service-dependency monitor. Phone popovers now open above their trigger rather than beyond the right edge. Service entries are divided rows rather than a stack of small cards.
- **Logout:** confirmation dialog at both widths, with visible cancel and confirm controls; logout not submitted.
- **Persona picker:** selected/default, error, and empty lists at both widths; quiet avatars, divided rows, and readable selected tint. The modal body owns scrolling instead of a nested scrolling card list.
- **Playlist:** paused player and expanded queue at both widths. Track identity now has its own row above transport controls, fixing disappearing titles on phone. Queue controls remain reachable.
- **Floating windows:** two stacked desktop windows and the phone bottom-sheet adaptation.
- **Update/service banners:** complete text and responsive controls at both widths.

## Shared corrections

- Creator navigation is transparent at rest, uses underlined section controls, wraps on desktop and scrolls on phone. A backdrop appears only while pinned. All-eight-section persona/anchor evidence is in the authoring ledger. The additional PersonaInAppShell fixture includes the actual MobileTopBar and independently scrolling main: navigation pins below the 56px phone header and keeps the target heading clear. A regression test covers the positive-coordinate observer boundary; measured navigation height now determines anchor clearance, including extra wrapped rows.
- SectionHeader uses a preferred width instead of flex-basis, avoiding a 160px-tall title when a caller uses a column layout.
- IconButton preserves explicit caller positioning instead of adding conflicting relative positioning. This fixes misplaced search-clear and lightbox-close controls.
- Parchment 400 was raised to a measured 4.52:1 against ink600, 4.98:1 against ink700 and 5.29:1 against ink800 for opaque text. This is not a claim of full WCAG certification or passing contrast for every alpha-composited pair.

## Scope limits

Backend completion, payments, credential mutation, generated media quality, every language/string length, and every device/browser combination are outside this visual pass. Route fixtures and browser review complement tests; neither is treated as a substitute for the other.

Final production build, Storybook build/typecheck and all-suite results are recorded in the overview ledger.
