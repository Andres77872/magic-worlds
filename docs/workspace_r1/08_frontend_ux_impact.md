# Frontend UX impact

> **Lifecycle: active R1 contract. Documentation reconciliation: 2026-10-15.** The foundation is implemented; rollout and specific integrity acceptance remain open. [02](02_current_status_and_findings.md) owns source/status and schema compatibility; [04](04_gaps_and_priorities.md) owns remaining work. Normative requirements below remain acceptance/regression contracts, not claims that every guarantee has runtime evidence. Dated implementation/validation records are in git history.

**Status:** Approved interaction specification; application screens are implemented in source. Default product rollout remains WIP; the original prototype approval is dated 2026-10-12.\
**Refreshed:** 2026-10-12.

## Information architecture

The approved [library prototype](/home/andres/.codex/visualizations/2026/10/12/01a12edd-8ae3-7fb1-be3a-d0c89aefbe9e/library-r1.html) is the local visual reference for the decisions below. The first explanatory mockup and screenshots of the old sidebar are not target designs. This document defines product behavior; existing GalleryPage/GalleryCard and the complete creators/assistant remain the implementation reference. The prototype's fixtures, compact initial view and abbreviated editor walkthrough do not introduce new persistence behavior, force a new default view preference, or authorize reducing editor fields.

The sidebar has one **Library / Biblioteca** entry for private cards. Remove the separate Characters, Worlds, Items, and Adventures gallery entries from that menu; personas do not gain another sidebar entry. Type-specific creators, query adapters, and owned legacy links remain supported behind the unified library. The pre-R1 screenshot records the old menu; the approved unified browser is implemented in source.

Inside Library, display collection folders and existing cards together in one file-browser-style content grid or list. Collections are navigable folder entries, not a row of chips/buttons and not another top-level sidebar section. The active workspace remains visible in the app chrome. Preserve unrelated feature navigation and the established account/content boundaries.

The default library root combines all flat collection folders with all supported owned cards in the workspace, including cards already collected. Opening a folder shows that collection's mixed card membership. This preserves the selected many-to-many model: a card shown at the root and in a collection is the same card, and can belong to several collections. Folder presentation does not introduce exclusive filesystem ownership, nested collections, or cross-workspace moves.

Use the existing GalleryPage scaffold, PageHeader, search control, GalleryViewToggle and CardGrid. Preserve GalleryCard unchanged: portrait ratio, image/fallback, title, identity/version/draft badges, description, actions, tags, and row variant. Use its existing metadata slots to identify the type in mixed results; preserve a persona's default marker. Organization changes the dataset and browsing controls, not the card design.

Novel A is an organizational name, not a special novel container. Preferred use chooses an initial destination, not feature access restrictions.

## Interaction map

| Surface | Proposed change | Reuse |
|---|---|---|
| Sidebar/header | One Library entry replacing the four card-type entries; visible workspace switcher and management | Existing Sidebar, Select/list patterns, Modal |
| Workspace management | Create/rename/archive/restore and concise content summary | Field, Input, Textarea, Button, ConfirmDialog |
| Library/gallery | Collection folders and unchanged cards in one grid/list; persistent search, type filter, bulk selection | CardGrid, GalleryCard, GalleryViewToggle, PageHeader, Select |
| Card menu | Add to collection, Copy to workspace, existing export/duplicate | Existing card menu and Drawer |
| Copy drawer | Source count, destination workspace, optional collections, dependency summary | Drawer, Select, SelectionCheck, status primitives |
| Creation/import | Library New menu opens each existing creator or import flow with visible, captured destination | CreatorIntro, TemplateGallery, SavedCardGenerator, CreatorStudio, AssistantChatbot, current import overlays |
| Pickers | Workspace-local search and collection filter; pagination | Codex picker, cast/world/persona/media pickers |
| Task/assistant surfaces | Origin labels, correctly scoped history/context, safe navigation | Existing task menu and shared assistant core |

Reuse the [component catalog](/home/andres/WebstormProjects/magic-worlds/.agents/skills/ui-components/SKILL.md) and [Reverie design system](/home/andres/WebstormProjects/magic-worlds/.agents/skills/ui-design-system/SKILL.md). Human organization actions use the existing ember semantics; arcane denotes AI activity. Use theme tokens, existing focus behavior, and sentence-case copy. These docs introduce no custom color, spacing, or motion values.

## Selected library browsing contract

| Element | Selected behavior |
|---|---|
| Root | One content surface containing folders followed by cards; no separate type sections |
| Collection | Recognizable folder icon, name and visible card count; open on click/tap or Enter |
| Location | Library root label or `Library > Collection`; a compact parent/back action on mobile |
| Views | Preserve large grid, compact grid and list; existing GalleryCard/row designs remain |
| Type | One local selector: All types, Character, Persona, World, Item, Adventure; All types by default |
| Uncollected | Local `Only uncollected` filter at the root, not another app menu entry |
| Search | Always-visible current gallery search with clear action; never replaced by folder navigation |
| Selection | Explicit selection control/mode; opening a card/folder remains distinct from selecting it |

Folders use a new collection entry composed from existing primitives. Distinguish them with a folder icon and the word Collection; never turn them into imitation character portraits. They share the same browser grid/list with the cards. Folder rows/tiles have keyboard access and a menu for rename/delete. Deleting a collection retains its cards, and the confirmation states that effect.

Keep folder entries compact; do not stretch them into empty portrait-sized cards. Start cards on the next grid row after the folder entries so a portrait cannot force the folder row to its full height. This is one browser content surface, without separate type sections or a collection button bar. Card geometry remains the existing GalleryCard geometry, and the user's existing large/compact/list preference remains authoritative.

The root obtains the owned collection list and paginated mixed-card list separately. Compose the folders once, then append card pages without repeating them. Preserve collection position ordering and the document 15 stable card ordering. Folder `card_count` is the total of accessible supported cards, not a second count stored in the database. Do not issue a per-folder list request to count every folder.

Type filters restrict cards and do not hide folder navigation. At the root, text search matches collection labels/descriptions and the existing supported card search fields. Inside a collection it searches that collection's cards, with the collection named in the placeholder. Offer an explicit Search entire library action with the same query when a local search finds nothing; no silent widening into other workspaces. Clear/focus/search-loading behavior and server filtering before pagination remain.

On opening a folder, clear a root search and start that collection at All types. On returning, restore the root's captured search, filters and loaded position. Type/search changes never modify membership or AI context. Show separate collection/card result counts. Differentiate empty library, empty collection, no matches, loading and errors; a no-match state offers query/filter recovery rather than suggesting that content was deleted.

Folder appearance is a browsing convention over flat memberships. Use Add to collection and Remove from collection, never an ambiguous Move that implies a root ownership transfer. Optional drag-and-drop adds membership with feedback; the menu/selection action provides the keyboard/touch equivalent. Do not make drag-and-drop the only way to organize cards.

## Creation from the unified library

The library header retains a prominent New / Nuevo action in the position used by the current gallery create action. Its menu contains New collection, Character, Persona, World, Item, Adventure, and Import card, respecting existing feature flags. New collection is available at the root; a collection does not offer nested collection creation in R1. Type filtering does not remove the other available creation types from this menu.

Choosing a card type goes directly to its existing creator intro/editor route. Preserve TemplateGallery, empty-card entry, SavedCardGenerator, creator fields/section navigation/live preview, media controls, save/draft/publish behavior, and AssistantChatbot. Do not insert a second wizard asking for manual versus AI before opening that creator, and do not replace it with an abbreviated library form. Persona uses the existing character creator with its persona role.

Capture a creation origin before opening the creator: workspace ID, optional current collection ID, and a client return location containing root/folder, query, type/role, view mode and scroll hint. Display `Will be saved in Workspace / Collection` in the creator chrome before any submission. Root creation has no initial collection; folder creation preselects that folder. A type filter is not a destination and does not silently switch the selected creator type.

Use document 15's selectors for manual saves, direct generation, unbound card-assistant creation, duplicates and imports. A delayed result retains its origin. Existing-card edit/assistant operations preserve that card's membership; opening an existing card from a folder is not another add-to-collection command.

After a successful manual creation, return to the captured library location and highlight a matching result. Preserve existing generation/assistant-to-editor behavior: those flows may already persist a card before opening its editor. Subsequent save updates that identity, rather than creating another card. Back to Library returns to the captured context. If a saved result is excluded by the restored search/type filter, show a concise success notice with View card; do not silently clear filters or force navigation. View card resolves its origin through guarded navigation and can temporarily reveal/focus it; Back restores the prior view.

## Card assistant compatibility

AssistantChatbot stays mounted as the existing stable sibling of CreatorIntro and CreatorStudio. The template-to-editor transition must retain the conversation, draft binding, turn state and captured creation origin. The assistant stays available before choosing a template as well as inside the editor; direct generation remains a separate existing affordance.

Bind each conversation and turn to the creator's captured workspace. An unbound card conversation creating its first saved target also captures optional initial collection membership. Its successful target is upserted under that origin and handed to the existing editor exactly once; replay does not duplicate the card or restore removed memberships. Assistant output/model bodies remain content-only.

For an already bound conversation, resolve the target's workspace and identity before editing. Preserve target/CAS, explicit pending-snapshot application, draft/publish semantics, errors, retry/recovery and charging. Library navigation must not convert a saved assistant target into an unsaved duplicate.

The account sidebar Assistant entry remains a feature, with workspace-local content history/knowledge as already specified. Continue in editor from its card history validates the conversation origin, uses the existing assistant conversation handoff parameter, restores a bound target or an unbound creator, and carries the appropriate library return context. It never substitutes the currently selected workspace for the conversation's origin. An unbound conversation with no retained collection intent displays Library as its destination until the user explicitly selects a valid collection.

This compatibility work extends organization and navigation; it does not redesign the existing assistant panel or introduce a competing assistant inside the library browser.

## Bulk organization

Bulk selection is distinct from the existing six-character AI group-chat selection in GalleryPage. The toolbar should show the number selected and offer Add to collection, Remove from this collection, and Copy to workspace.

Make selection semantics explicit: Select this page versus a future Select all matching results. R1 can support loaded/page selection without promising an unlimited cross-page operation.

Preserve selection while adjusting safe local views only when card identities remain valid. Clear it on workspace switch. Never imply that Remove from collection deletes a card.

## Copy drawer

Show the origin workspace and destination clearly. Select the workspace first, then load its valid collections. Disable submission while those collections are unresolved or invalid.

A summary names attached lorebooks and explains independent copies. Exact media internals belong in implementation docs; product copy only needs the decision-relevant effect. Existing destination copies can be opened or an additional copy created explicitly.

After success, offer View copies in the destination. Do not forcibly switch while the user has unsaved work.

A copy is all-or-nothing (document 15). While it runs, show a progress state in the drawer and disable resubmission. On any error, show the reason and say plainly that nothing was copied; offer Try again. There is no partial result, pending copy, background status or resume to display.

Generate the request ID when the user submits a given selection, destination and collection set. Try again after an error or an uncertain response (timeout, dropped connection) reuses that ID, so a copy that actually succeeded comes back as the same result instead of a duplicate. Changing the cards, destination or collections, or choosing Copy again after success, uses a new ID. The copy limit is 20 cards: when more are selected, disable Copy to workspace and explain the limit instead of sending a request that will be rejected.

## Workspace-switch state machine

1. Resolve the requested owned workspace.
2. Run the active editor's save/discard/cancel guard.
3. Commit the new workspace identity and URL together.
4. Clear old content selections and reset relevant panels.
5. Start scoped reads and render loading/empty/error states for the new scope.
6. Ignore late UI updates from the previous scope.
7. Keep already admitted operations attached to their original destination.

A canceled switch preserves the original workspace and URL. A failed save must not proceed as if it succeeded. Aborting a browser request does not prove that the server operation was canceled.

The implemented async navigation coordinator uses the existing interceptors and novel flush guards for workspace changes. Browser hash/popstate handling participates in guarded navigation; the former bypass was a pre-R1 finding. Preserve this behavior across browser history, workspace menu, assistant/notification links and task actions.

## Frontend state and API ownership

[DataProvider](/home/andres/WebstormProjects/magic-worlds/src/app/providers/DataProvider.tsx) keys ownership by account/auth and workspace ID/epoch. Loads wait for workspace readiness, and late mutation results validate the captured owner.

Place WorkspaceProvider inside LanguageProvider and outside NavigationProvider. Navigation owns the switch coordinator and guard registry; WorkspaceProvider owns list/selected ID/epoch and exposes an internal commit action. DataProvider remains inside Navigation and reads both contexts. Retain LlmSessionProvider and account-level credentials/preferences; do not remount the authenticated app on switching.

Pass captured workspace context into API methods. Do not read a mutable active workspace from the singleton at retry time.

Include workspace in content-related local storage, such as assistant focus and library filter state. Account/global UI preferences may stay global. Stable resource IDs may already identify some local preferences; audit them before adding redundant keys.

## Existing writing and roleplay flows

The novel Codex accepts multiple cards. Preserve collection filtering and complete paging in its existing picker; retain the explicit Add selected action. No automatic import, manuscript rewrite, or TipTap replacement is required.

Cast, world, and persona selectors should consume scoped data. A persona default belongs to the workspace. Existing activity snapshots remain displayed even when the live library lacks a source card; do not replace preserved content silently.

Roleplay sockets and read-only floating previews stop applying old events when context changes. Existing floating windows are previews with edit callbacks, not additional editors: close them on a committed switch, even when the page stays the same. Account-wide playlist playback can continue with its origin label. A live voice call ends before the workspace commit; canceled switches leave it running.

## Empty, error, and accessibility states

| State | Suggested message/action |
|---|---|
| Empty workspace | No cards here yet. Create a card or copy one from another workspace. |
| Empty collection | Add cards to this collection. |
| Search without results | No matching cards in this workspace. Clear filters. |
| Remove membership | Remove from collection; the card remains in your library. |
| Copy success | Cards copied to Novel A. View copies. |
| Archived workspace | This workspace is archived. Restore it to create or edit content. |
| Save failed during switch | Keep the workspace open and offer Retry; do not lose the draft |

Provide keyboard-accessible workspace and collection controls, labeled selection buttons, focus restoration after dialogs, announced operation results, and non-color active/selected indicators. Use existing reduced-motion and responsive drawer patterns.

The final UX acceptance guarantees are [A21–A27 in document 10](10_risks_and_decisions.md#acceptance-guarantees-a01-a27).

## Selected URL and browser-history algorithm

Keep the existing creator/activity feature hashes and add `workspace=<uuid>` to content routes, for example `#/character?workspace=<uuid>&card=<id>`. Keep global auth/profile/billing/admin/community/share routes at their existing hashes. Add the canonical mixed-library browser through the current PageType/router mapping, not a replacement router; old owned type-gallery hashes are compatibility inputs as specified below.

The canonical private browser entry is `#/library?workspace=<uuid>`, optionally with `collection=<uuid>`, `q`, `card_type`/`character_role`, and the existing view preference. Existing owned type-gallery hashes resolve to this library with the corresponding type filter; they do not recreate removed sidebar entries. Keep creator routes and assistant handoff hashes. Type-specific private API routes remain valid implementation adapters, while public/community navigation retains its explicit paths.

Initial content links with a workspace validate it before loading. Legacy links containing an owned resource ID call the document 15 resolve-content endpoint, then enter its workspace through the same coordinator. Legacy library links without an ID restore a valid saved workspace or the protected default. Never resolve a resource under the active workspace merely because its URL lacks the parameter.

1. Stamp owned history entries with a namespaced state containing entry ID, monotonic index, workspace ID, and canonical hash. Preserve unrelated history-state fields.
2. On app navigation, resolve destination first, capture a navigation request generation, and run all registered async save/discard/cancel guards. Perform novel flush through existing hooks; a failed save stays in the source.
3. When popstate moves to an indexed app entry, immediately restore the committed entry using the known index delta and a suppressed matching restoration event. Present guards while the source workspace/content remains active. Approval traverses to the requested entry with a one-use commit token; cancel leaves the restored entry.
4. For unindexed external/legacy hash changes, restore the committed URL with replaceState before any content state/fetch changes. Treat the affected entry as a transient normalized entry; approval replaces it with the guarded destination, cancellation retains the committed URL. Do not infer a history delta from an unknown entry.
5. Coalesce the popstate/hashchange pair by entry/hash identity; restoration events never push a new route or run guards again. Reentrant requests retain one latest queued target and generation tokens; obsolete guard/validation completions cannot commit.
6. After guards succeed, end an active voice call and await end/quota-release acknowledgement. If that fails, keep the source and offer retry. Revalidate destination archive/version state, then commit workspace ID/epoch and route in one coordinated React update.
7. Apply local discard/reset only at commit. Clear selections, local origin forms, assistant binding/focus panels and floating previews; close origin sockets/listeners; start scoped loads. Preserve already admitted server work and its status/origin.
8. A destination becoming archived/invalid during switching keeps the source intact and shows its error; an intentional archived-content link may enter read-only mode. If another tab archives the selected workspace, retain it read-only and offer Restore or Switch.

Read/write/stream callbacks compare `accountKey, authEpoch, workspaceId, workspaceEpoch` before updating active UI. Server submissions retain captured context after switches; aborting a fetch never implies operation cancellation.

Persist last-used workspace/filter hints under stable `API origin + userHash + workspaceId` keys; do not use the transient accountKey sequence as a durable identity. Selection within a browser tab remains independent. Cross-tab storage changes do not silently switch the active editor. Authentication epochs still protect requests; token rotation preserves current ownership.

## Lifecycle and origin interactions

The protected default workspace can be renamed and has an explanatory unavailable Archive action. Other workspaces are read-only after archive; Restore and Copy/export remain available. Copy drawers identify Published content, show remapped/omitted persona references, and reuse their request ID for Try again as described under Copy drawer. A copy into an archived destination or a deleted collection fails with nothing copied. For asynchronous AI generation, an initial collection deleted during completion produces a clear grouping warning and a correctly located result.

Call history/transcript browsing is workspace-local, while the existing account/application one-live-call policy remains. Archive reports an active-call conflict until the user ends it. Call launching and pending persona selection capture origin before asynchronous work.

The notification inbox remains account-wide with origin labels for content notices. Use guarded origin navigation for View status/result; archived results open read-only, missing targets show unavailable/retained status. Generation/media task UI uses explicit origin; the generic tasks list covers theme songs, PDF import/extraction, images and TTS.

Contracts and inventory: [document 15](15_execution_contracts.md), [document 16](16_scope_inventory.md).

## Release compatibility and rollout UI

The R1 API requires `X-Workspace-Id` on every private content request and never falls back to account-wide data (document 15). A browser may therefore run a frontend build that does not match the API: an old tab left open through the cutover, or a new build loaded while the API is stopped or rolled back. These requirements make every such combination either work on the protected default workspace or show an explicit state. The frontend never sends a private request without a validated workspace and never shows an empty library as if content were gone.

### One build, two UI states (historical)

> **Graduated 2026-10-18.** The flag below was removed in SPA `692e56bb`; the full R1 UI is always on and there is no flag-`false` state. This subsection and the deploy order below record the R1 rollout design.

The R1 build always sends workspace-scoped requests; it has no account-wide code path. A build-time flag, `VITE_FEATURE_WORKSPACES_ENABLED`, follows the existing `VITE_FEATURE_*` convention in `src/shared/featureFlags.ts` and controls only what the user sees:

| Flag | What the user sees | Requests |
|---|---|---|
| `false` (rollout default) | Legacy type-gallery UI: Characters/Worlds/Items/Adventures sidebar entries and type galleries, current hashes. No workspace switcher, Library, collections, Copy to workspace or New collection | Every private request carries the protected default workspace ID from `GET /workspaces` |
| `true` | The full R1 UI in this document | Captured workspace per request (document 15) |

With the flag `false`, the frontend offers no way to create workspaces or collections. Owned legacy links still go through `resolve-content`. If the account has more than one active workspace (possible only after the UI was enabled and then switched off again), show a persistent notice: "Some workspaces are temporarily unavailable. Their content is safe." Links, notifications and assistant links that resolve to a non-default workspace show the same unavailable state. They never open the record under the default workspace and never fall back to a gallery as if it were deleted.

### Startup handshake

After sign-in, before any private content request:

1. Call `GET /workspaces/capabilities` with no workspace header.
2. Call `GET /workspaces` to obtain the protected default and the selectable list.
3. Only then let DataProvider and other private loaders start. Until then, private pages show the existing loading state, never an empty library.

Public pages (landing, community, shared-card preview, docs, legal) and account pages (profile, billing, model/image profiles, voices) do not wait for the handshake.

| Handshake result | Frontend behavior |
|---|---|
| `workspace_r1:true` and `contract_version` equal to the build's supported version | Continue |
| API unreachable | Existing services-down banner (ApiStatusProvider). Private pages show "Your library is unavailable while the service is updating" and retry on the existing health-poll cadence |
| 404, no `workspace_r1`, or an older `contract_version` (predecessor API) | Same blocking state for private pages, with retry. Never fall back to account-wide reads |
| Newer `contract_version` than the build supports | The build is stale: run the version check immediately and show the reload dialog below; block private writes |
| 401 | Existing refresh/expiry behavior |

The blocking states keep local unsaved content and never reload automatically.

### Stale browser tabs

Tabs open on the previous build keep running it after the cutover. They already poll `/version.json` every 2 minutes while focused (`useAppVersionCheck`) and show the existing update banner. While the API is stopped they show the services-down banner. R1 relies on both, plus a small **compatibility release** of the current frontend, shipped before the maintenance window, that adds one behavior:

- `WORKSPACE_REQUIRED` arrives as an HTTP 422 `detail.code`, a chat-socket close 4422 or a voice-socket `voice_error`; the compatibility release treats all three the same, and 4422 is terminal (no reconnect).
- Any of them runs the version check immediately and replaces per-request error toasts and the data-load banner with a blocking dialog on private pages: "This page is out of date. Reload to continue. Changes that were not saved before the update can't be saved from this tab."
- The dialog never reloads by itself, so the user can copy unsaved text first. Repeated failures do not stack further toasts or retries.

Tabs older than the compatibility release only show the existing non-blocking update banner and request errors until reloaded. The API rejects their unscoped writes, so nothing is written to the wrong place. The compatibility release's changes are still uncommitted and its shipped/live status is unverified (W-01 in [04](04_gaps_and_priorities.md)).

### Browser storage carried over

Content-related browser storage written before R1 is not scoped to a workspace (for example the app-assistant knowledge focus and saved library filters). On the first R1 load, move each such entry into the protected default workspace's key once, then delete the old key. Never assign it to another workspace. Account/global preferences stay as they are: language, gallery view mode, sidebar state, playlist, cookie consent and auth token. Entries already keyed by a stable record ID (novel word goal per story, auto-narrate per session) need no change.

### Deploy order (historical; frontend view)

The R1 cutover runbook (document 11) and its tooling were removed after the cutover; current upgrades follow the BFF database guide.

1. **Before the window:** ship the compatibility release.
2. **Stop the API** (document 11 quiescence). Open tabs show the services-down banner.
3. **Deploy the R1 frontend with the flag `false`** while the API is still stopped. `version.json` is static, so open tabs get the update banner; reloaded tabs wait in the "updating" state.
4. **Migrate and start the R1 API.** Loaded R1 tabs pass the handshake and continue in the default workspace.
5. **Run smoke checks** with the flag `false`.
6. **Redeploy with the flag `true`.** Tabs on the flag-`false` build keep working, because their requests are already correct, and get the update banner.

**Rollback:** before activation, if the API is restored to the predecessor, also redeploy the pre-R1 frontend; otherwise the R1 build keeps private pages blocked, by design. After activation, the emergency switch was a redeploy with the flag `false`; since graduation there is no such switch, so rollback means redeploying a compatible build pair.

## Research basis and design validation

The selected layout follows the user's explicit direction. Research informs the interaction details, not a replacement visual design: [Google Drive's organization guidance](https://support.google.com/drive/answer/2375091?hl=en) supports meaningful folder names and explicit organization actions; [NN/g's breadcrumbs guidance](https://www.nngroup.com/articles/breadcrumbs/) supports location/parent navigation and cautions against oversized mobile trails; Carbon's [search](https://www.carbondesignsystem.com/building-blocks/core/components/search/guidelines), [filtering](https://preview.carbondesignsystem.com/building-blocks/core/patterns/filtering) and [empty-state](https://www.carbondesignsystem.com/building-blocks/core/patterns/empty-states) guidance supports visible search scope, recoverable filters and differentiated empty states. These were read 2026-10-12 and are design references, not usability-test results.

For release and regression acceptance, review the library root, mixed folder, New menu for every available type, creator intro, manual creator, direct-generation result, card assistant, history handoff, no-match/empty/error states, mobile search and keyboard paths. Compare cards and the gallery scaffold with current GalleryPage/GalleryCard, not the earlier explanatory mockup. A standalone prototype may simulate persistence and abbreviate a walkthrough; it is not authority to replace any existing editor fields or assistant behavior.
