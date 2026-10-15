# Implementation plan, actual progress, and acceptance

> **Scope / status (reviewed 2026-10-14):** R1 design/coverage contract and dated implementation evidence. Source is implemented; default product UI rollout remains **WIP**, locally opted in. [02](02_current_status_and_findings.md) owns current status and schema compatibility; [04](04_gaps_and_priorities.md) owns remaining gaps/TBD. Historical test totals, branch state and migration notes below apply to their stated dates, not deployment availability.

**Historical status recorded 2026-10-12 (not current checkout/deployment state):** Phases 1–5 are implemented and integrated, uncommitted, into the main checkouts: API at base `21127be`, frontend at base `43ee765`. The owner's local dev database `magic_worlds` is migrated to `2026_10_workspace_r1`, and the local frontend `.env` sets `VITE_FEATURE_WORKSPACES_ENABLED=true`. Nothing is committed, shipped or deployed. The compatibility release is built in the `workspace-r1-compat` worktree but not shipped. The remaining Phase 6 production steps belong to the owner.\
**Refreshed:** 2026-10-12.

## Actual progress

| Work | Status | Evidence |
|---|---|---|
| Selected workflows/full activity scope | Documentation complete | 01, 03 |
| Refreshed image-profile/unified-assistant/voice/notification baseline | Documentation complete | 02, 14, 16 |
| Architecture and formerly open decisions | Selected in this specification | 05, 10, 15 |
| Workspace/collection/operation/copy contracts | Documentation complete | 06, 07, 09, 15 |
| Private/account path classification and frontend ownership map | Documentation complete | 16 |
| Navigation/history, default/archive/call outcomes | Documentation complete | 08, 15 |
| Single library/folder browser, persistent search, unchanged cards, existing creator/assistant compatibility | Prototype approved by user and specification reconciled 2026-10-12; standalone walkthrough is separate from app implementation | 08, 14, 15, 16 |
| Migration states and acceptance/test plan | Documentation complete; requires implemented tooling/tests | 11, 13 |
| Workspace API (BFF) code | Implemented; integrated into the main checkout, uncommitted | Main checkout `magic-worlds-api` (base `21127be`, originally built on branch `workspace-r1` from `f77e60f`): new `routes/workspaces.py`, `services/workspaces.py`, `database/mysql/workspace_models.py`, `workspace_copy.py`, `workspace_cutover.py`, `llm_execution_origin.py`, `routes/media_projection.py`; scoping across every document 16 row |
| Workspace SQL/migration | Implemented and rehearsed on throwaway databases. Applied to the owner's local dev database `magic_worlds` on 2026-10-12 (see document 13). Not applied to production | `db.sql` R1 target, frozen predecessor `migrations/2026_10_image_profiles.sql`, CLI `scripts/migrations/20261012_workspace_r1.py` (check-only by default, `--apply`, fingerprint equality, resumable phases) |
| Workspace frontend code | Implemented; integrated into the main checkout, uncommitted | Main checkout `magic-worlds` (base `43ee765`, originally built on branch `workspace-r1` from `f0f5769`); local `.env` has the flag `true`: `WorkspaceProvider`, `WorkspaceGate` handshake, `features/library`, `features/workspaces`, scoped clients via `apiService.withWorkspace`, `VITE_FEATURE_WORKSPACES_ENABLED` |
| Compatibility release (pre-R1 frontend) | Built, not shipped | Worktree `magic-worlds-compat`, branch `workspace-r1-compat` from `f0f5769`: `WORKSPACE_REQUIRED` (HTTP 422, chat close 4422, voice `voice_error`) → immediate version check and one blocking reload dialog |
| Feature build/runtime tests | Passing locally except recorded pre-existing failures | See "Verification evidence" below |
| Production deployment | Not done | Phase 6, pending the owner |

The phase rows below record the 2026-10-12 implementation and verification state. New endpoints/tables/DTOs were the implementation requirements for that pass. Unrelated changes in either working tree are not workspace progress. A checked box below means the code exists, uncommitted, in the main checkouts and its tests pass locally. It does not mean committed, shipped or deployed.

## Phase 1: Specification gate

**Owner:** Frontend/BFF implementer. **Dependency:** Current source review.

- [x] Select full root/activity isolation and independent copies.
- [x] Select operation-context storage, default-persona authority, source/media copy policy, batch bounds, and URL/lifecycle rules.
- [x] Define strict workspace/collection metadata, errors, and the all-or-nothing copy contract.
- [x] Define the frontend startup handshake, flag-gated UI state, stale-tab handling and deploy order (documents 08, 11).
- [x] Classify current content/private/account routes and frontend ownership in document 16.
- [x] Record the approved unified Library sidebar entry, compact collection folders, persistent search, unchanged cards and existing creator/assistant entry/return flows across the specification.
- [x] Before coding, confirm the current source still matches the refreshed integration points; update only real drift.

Source drift recorded 2026-10-12 (implementation branches `workspace-r1` in both repositories, created from API `f77e60f` and frontend `f0f5769`):

- **Starting revision.** The committed API is at `2026_10_image_profiles`, as document 11 requires. Its exact DDL is frozen as `src/database/mysql/migrations/2026_10_image_profiles.sql`; the historical cutovers now verify against that frozen file instead of the changed `db.sql`.
- **`resource_task` (landed upstream in `21127be` without a revision change).** Resolved during integration:
  - The cutover predecessor is the frozen image-profiles schema plus the frozen `migrations/2026_10_resource_tasks.sql`.
  - A database without the table stops before any change. The stop message says to run `scripts/migrations/20261012_resource_tasks.py --apply` first, and that script refuses R1 databases.
  - `resource_task` gets `workspace_id`, FK `fk_resource_task_workspace` and `idx_resource_task_workspace_status`. The migration backfills existing rows into the owner's default workspace.
  - The task list, cancel and `POST /lorebook-resources/import-pdf` are workspace-scoped; import uses `new_work` admission. A foreign task's cancel returns 404.
  - The frontend Tasks drawer and resource-task events carry the workspace.
- **Owner-first key order.** Workspace FKs and unique keys use `(user_id, project_hash, user_group_hash, workspace_id[, id])`, so each list index also serves as the FK child index.
- **Renamed FKs.** MySQL rejects re-adding a same-named foreign key in one `ALTER` (error 1826), and each table's final `ALTER` must be atomic. The changed assistant-conversation FKs are therefore `fk_assistant_conversation_card_workspace` and `fk_assistant_conversation_lorebook_workspace`.
- **Scope checks on new tables.** Every new table that carries `project_hash`/`user_group_hash` also gets an explicit `chk_*_scope_nonempty`, matching the existing schema invariant.
- **CORS.** The API already allows `*` request headers, so the new selector headers need no allow-list change. `ETag` and `X-Idempotent-Replay` were added to `expose_headers`.

**Exit:** Documents 05/06/08/09/15/16 are the implementation specification. Production inventory is a migration/release prerequisite, not a remaining domain-design choice.

## Phase 2: Canonical schema and BFF boundary

**Owner:** magic-worlds-api. **Dependency:** Phase 1/source-drift check.

- [x] Add the structures/root/relationship columns and exact contracts in document 06; preserve image profiles and current schema metadata.
- [x] Implement WorkspaceContext alongside exact AppScope, protected default initialization, read-only/archive rules and shared admission locks.
- [x] Update private CRUD/history/default/activation/child repositories and strict hydrators for every row in document 16.
- [x] Implement companion operation context in admission, finalization, recovery and internal writers; distinguish content operations from global profile controls.
- [x] Implement deleted-initial-collection warnings without changing existing content CAS/charging.
- [x] Add versioned migration/check-only tooling and preceding-schema verification; support every defined partial state.
- [x] Update account wipe/quiescence and all-workspace media reference checks.

**Exit:** Real MySQL repository/route/schema/admission tests prove direct-ID isolation and preserved historical data without relying on the new frontend.

## Phase 3: Workspace navigation and explicit destinations

**Owner:** magic-worlds. **Dependency:** Phase 2 API/DTO contracts.

- [x] Add WorkspaceProvider at the specified position and a single async navigation/history coordinator.
- [x] Extend account/auth guards with workspace ID/epoch for reads, writes, streams, persona selection and local activity drafts.
- [x] Add captured X-Workspace-Id and X-Initial-Collection-Ids headers; socket query; preserve context across refresh/retry.
- [x] Implement workspace management, protected default, archive/read-only/restore UX. Read-only covers the creators, version history, lorebook studio/gallery/resources, Story Studio and Codex, the media gallery, the card and app assistants, chats, Chatroom, Calls, Started adventures and the dashboard. Reading, search, export/download, Copy and Restore stay available.
- [x] Scope manual/AI/import creation and generated reconciliation; keep content models/prompt schemas unchanged.
- [x] Guard indexed/unindexed browser navigation, legacy owned links, failed saves and queued switches.
- [x] End calls before switch commit; close existing read-only floating previews and prevent stale callbacks.
- [x] Retain account-level credentials, language, profiles and global controls.
- [x] Add the startup handshake: no private request or `X-Workspace-Id` until capabilities and `GET /workspaces` succeed; "updating" and stale-build states per document 08.
- [x] Add `VITE_FEATURE_WORKSPACES_ENABLED`; with it `false`, keep today's sidebar/galleries on default-workspace transport, hide workspace/collection/copy creation, and show the "temporarily unavailable" notice when other workspaces exist.
- [x] Move pre-R1 content browser-storage entries into the protected default workspace once.
- [x] Build the compatibility release on the current pre-R1 frontend: `WORKSPACE_REQUIRED` → immediate version check and blocking reload dialog, no auto-reload. Built in `magic-worlds-compat`; shipping it is a Phase 6 step.

**Exit:** Direct creation/switching, browser history, active-call transitions and every handshake result pass interaction/race tests. The UI stays behind `VITE_FEATURE_WORKSPACES_ENABLED=false` until later phases pass.

## Phase 4: Collections and independent copying

**Owner:** Frontend + BFF. **Dependency:** Phases 2–3.

- [x] Implement strict collection CRUD/versioning, atomic membership, Uncollected, and mixed-type paginated cards/counts.
- [x] Replace the four private card sidebar entries with Library; render collection folders and unchanged GalleryCards together; preserve search and all three gallery view modes.
- [x] Add the New menu for every enabled type/persona/import/collection, preserve existing creator/template/generator/assistant flows, and capture/restore library return state.
- [x] Add bulk selection independent of the six-character AI group-chat mode.
- [x] Implement the bounded all-or-nothing copy transaction: dependency/ID maps, resource remapping, memberships, media associations and success-only receipt; any failure rolls everything back.
- [x] Add destination-aware import conflicts; explicit Copy again and stable replay/deleted-result behavior.
- [x] Add published-content/dependency summary, destination collection loading, progress, "nothing was copied" error with Try again, the 20-card selection limit, and result navigation.
- [x] Register destination media associations.

**Exit:** Novel-cast/Sandbox workflow passes across four card types/personas, source edits, shared/different book states, concurrency, lost responses, injected failures leaving no rows, and deletion.

## Phase 5: Full existing-feature integration

**Owner:** Frontend + BFF. **Dependency:** Phases 3–4.

- [x] Update Codex/cast/world/persona/media pickers with server filters, full pagination and explicit selection.
- [x] Scope story/session sources, candidate generations/recovery, lore extraction/CAS, and unified assistant knowledge/focus/history.
- [x] Scope text/voice history/transcripts and worker/turn origins while preserving account-wide call supersede, quotas and profile selection.
- [x] Add scoped media discovery and background-origin status/navigation for image/theme-song/TTS paths.
- [x] Add durable content notice origin and account playlist labels; handle archived/deleted targets. Residual: the playlist does not preview a track whose owning card lives in another workspace; it shows the origin label only.
- [x] Update English/Spanish UI copy and component stories using existing primitives/tokens.

**Exit:** Every document 16 row has a reviewed implementation path and evidence; no account-wide content fallback exists behind a workspace label.

## Phase 6: Verification and coordinated release

**Owner:** Frontend/BFF release. **Dependency:** All prior exits.

- [x] Pass document 13 scenarios, frontend relevant tests/build, and story typecheck when applicable. Done locally; see document 13 "Verification results". The only frontend failure is the pre-existing `DocsPage` test, which also fails on `f0f5769`.
- [x] Pass real MySQL constraint/transaction/copy/migration tests, strict bootstrap, schema/runtime alignment and content preservation. 34 integration files: 697 passed; the 53 failures are pre-existing with identical node IDs on `f77e60f`. A local end-to-end migration of a seeded pre-R1 database kept its fingerprint, and the API's strict startup verification passed.
- [x] Regression-check auth, LLM/image profiles/BYOK, writer graphs, voice accounting and provider transport without live provider calls. Offline unit/route suite: 7452 passed; the 7 failures are pre-existing on `f77e60f`.
- [x] Measure representative query plans/volumes and copy transaction duration at the maximum bounds. Done locally at 35,000 cards (document 13). The two problems found were fixed: copy locking blocked the owner's other workspaces, and library plans were fragile. Production volumes are still unmeasured.
- [ ] Inventory deployed revision, rehearse backup/restore and all interrupted migration states, and verify quiescence/restart.
  - Done locally: interrupted and unsupported states (`test_workspace_cutover_database`), SIGKILL/resume and backup/restore rehearsals at volume, and a full-data rehearsal of the dev dump followed by the real dev-database migration (document 13).
  - Remaining for the **owner**: the production revision inventory, production backup and quiescence/restart.
- [ ] Ship the compatibility release before the window and confirm it is live. Built and green in `magic-worlds-compat`; shipping is up to the **owner**.
- [ ] (**Owner**) Follow the document 11 deploy order: stop the API, deploy the R1 frontend with the flag `false`, migrate, start the API, pass handshake and flag-`false` smoke checks, then redeploy with the flag `true` and pass the R1 UI smoke checks.

### Residuals and merge notes (2026-10-12)

- **Integration (2026-10-12).** The R1 diffs were applied to the main checkouts with `git apply --3way` and the conflicts were resolved: 6 in the API and 7 in the frontend, all in the resource-task, PDF-import and Tasks work. Both checkouts are uncommitted, with some files staged and some unstaged. The `workspace-r1` and `workspace-r1-compat` worktrees still exist and can be removed once the main checkouts are committed. `resource_task` scoping is described under "Source drift" above.
- **Performance fixes from the volume run.**
  - `lock_workspace` takes `FOR UPDATE OF w FOR SHARE OF s`, so a copy no longer blocks the owner's reads in other workspaces.
  - `LibraryModel.list_cards` uses a deferred join with a forced workspace index. It joins bodies only for search and role filters and never joins drafts for counts.
  - The default library page dropped from 24.6 ms to 2.7 ms at 5,000 cards.
- **Archived-workspace replay.** Replaying a lorebook extraction admitted before `21127be` into a workspace that has since been archived returns 409 `WORKSPACE_ARCHIVED`.
- **`studio_test` classification.** A root user's built-in card/novel execution sent without workspace context is classified as `studio_test` (profile testing), not content work. This is harmless for consumers. Revisit it if root content runs should carry a workspace origin.
- **Playlist previews.** The playlist does not preview a track whose card lives in another workspace; it shows the origin label only.
- **Pre-existing gaps, unchanged by R1:**
  - Creating an unbound default persona through the assistant does not clear other defaults.
  - Finalizing an OpenRouter image requires a fal parent.
  - The asset reference check ignores assistant output snapshots.
  - TTS `mark_deleted` performs no reference check.
- **Pre-existing test failures** are listed in document 13; none were introduced by R1.
- **Pre-existing `tb_card_draft` / `tb_card_version` enum mismatch.** Item-card drafts fail with ERROR 1452 (document 13). It exists in the frozen pre-R1 schema and needs its own migration.
- **CLAUDE.md is stale.** Its provider nesting line predates R1. The R1 order is ApiStatus → Auth → LlmSession → Language → **Workspace** → Navigation → OriginNavigation → CreationOrigin → CookieConsent → Data → BackgroundTasks → AudioPlaylist → FloatingWindows.

## Acceptance guarantees

| ID | Required user-visible or persistence guarantee |
|---|---|
| A01 | Existing content appears in protected default workspaces with unchanged IDs/content/snapshots |
| A02 | Cards, context, stories, sessions, voice history and assistants are separated by owned workspace |
| A03 | One card has multiple memberships; repeated add/remove and collection deletion preserve card content |
| A04 | Mixed supported types browse/search/count/page coherently with role/feature filtering |
| A05 | Cast collections are usable in Codex and roleplay pickers without automatic context import |
| A06 | Copies are private independent published cards with correct lorebook/resource/media dependencies |
| A07 | Concurrent/repeated same requests return one stable mapping; Copy again creates another copy; deleted results stay deleted |
| A08 | Import conflicts are destination-local and source content copied elsewhere does not block import |
| A09 | Generation/save/assistant/turn/media completion after switching cannot mutate the new workspace |
| A10 | Default persona, per-character live persona reference and global lore context are workspace-local |
| A11 | Matching picker/collection cards beyond the first page remain reachable |
| A12 | Default cannot be archived; others become read-only, admitted work completes, deleted grouping warns, fresh work is rejected |
| A13 | Manual/AI/public/share/file imports show/capture workspace and optional memberships; public copies remain private |
| A14 | Shared media cannot be deleted while any retained content still needs its bytes; a deletion racing a copy either fails the copy (nothing created) or is refused after it |
| A15 | Save/discard/cancel/failed-save behavior holds across menu, Back/Forward, external hashes and queued links |
| A16 | A copy is all-or-nothing: any failure creates no card, book, resource, link, membership, association or receipt; later source edits/deletion do not alter completed copies; resource snapshots/hashes/provenance stay valid |
| A17 | Call switches await end; archive blocks live calls; account-wide single-call/quotas remain unchanged |
| A18 | Origin notices/tasks/playlist labels navigate safely, including archived/deleted targets and legacy notices |
| A19 | Empty/concurrent initialization yields one usable default; account wipe cannot be followed by content resurrection |
| A20 | API capability/strict-schema/migration recovery rejects unsupported states and preserves current image profiles/BYOK |
| A21 | Sidebar has one Library entry for cards; former owned type-gallery links resolve to library filters; unrelated navigation remains |
| A22 | Compact collection folders and cards of all supported types share one browser grid/list; cards start after the folder row; existing card design, gallery scaffold and view preference are retained |
| A23 | Search remains visible at root and in collections; query/type/empty-state recovery and folder counts are accurate without per-folder count requests |
| A24 | Library New reaches all enabled existing creators including persona, imports, and flat collection creation; destination/return state is visible and preserved |
| A25 | Templates, direct generation and card assistant keep their current behavior and one saved identity; history handoff respects origin and initial membership |
| A26 | Returning from creation restores browsing state; a result hidden by existing filters is reachable through explicit View card without silently clearing filters |
| A27 | Every frontend/API build pairing during rollout either works on the protected default workspace or shows an explicit updating/reload state; no private request or workspace header before the handshake, no account-wide fallback, no automatic reload, the flag-`false` state hides workspace UI without hiding default content, and pre-R1 browser storage lands in the default workspace |

R1 is complete only when these selected guarantees pass. Documentation completion establishes readiness to implement, not readiness to migrate or deploy.
