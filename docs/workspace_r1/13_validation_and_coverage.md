# Validation strategy and impact coverage

> **Scope / status (reviewed 2026-10-14):** R1 design/coverage contract and dated implementation evidence. Source is implemented; default product UI rollout remains **WIP**, locally opted in. [02](02_current_status_and_findings.md) owns current status and schema compatibility; [04](04_gaps_and_priorities.md) owns remaining gaps/TBD. Historical test totals, branch state and migration notes below apply to their stated dates, not deployment availability.

**Status:** Executable-test requirements for the selected specification, plus the local verification results of the 2026-10-12 implementation pass (see "Verification results" at the end).\
**Refreshed:** 2026-10-12.

Coverage here means which behaviors and repositories must be checked. It is not a percentage of code exercised.

## Scenario matrix

| Area | Positive case | Negative/race/recovery case | Acceptance |
|---|---|---|---|
| Ownership | Owned workspace read/create/update | Other owner, application mismatch, direct ID from wrong workspace | A02 |
| Membership | Add/remove same-workspace card, mixed types | Foreign collection, duplicate add, repeated remove, deleted card | A03–A04 |
| Pagination | Search/filter with more than one page | Card in several collections, count mismatch, equal timestamps | A11 |
| Switching | Workspace and route commit together | Slow reads, failed save, canceled switch, Back/Forward | A09, A15 |
| Creation | Manual/AI/import captured destination and memberships | Switch retains origin; archive rejects fresh admission; deleted admitted collection completes with warning | A09, A12, A13 |
| Generation replay | Same operation returns original result | Changed destination under same ID, process restart, later card deletion | A07, A09 |
| Copy | Four card types plus personas and dependencies | Shared lorebook, different attachment snapshots, bad resource reference, batch failure | A06–A08 |
| Copy failure/replay | Lost response/concurrent identical request returns one mapping | Failure at any step (archived destination, deleted collection or source, lock timeout, injected DB error) leaves no destination rows and no receipt; same request ID after a failure runs fresh; replay never recreates deleted copies | A07, A16 |
| Defaults/context | Workspace persona and global lore | Default in A does not clear B; A's global lore absent from B | A10 |
| Stories/sessions | New selections from current workspace | Old snapshot source deleted or absent from scoped library | A01, A05 |
| Assistants | Card/lorebook bound and unbound; app history | Late final target, retained retry, focus/resources from prior workspace | A09 |
| Jobs/sockets | Origin retained and result navigation | Startup recovery, switch, archive, deleted target, stale frames | A09, A12 |
| Media | Reused same-account assets stay accessible | Delete while body/draft/version/story/session/receipt still refers to asset | A14 |
| Migration | Existing content and empty accounts | Rerun, interruption, unsupported marker, ownership/link mismatch | A01 |
| Lifecycle | Protected default, other workspaces archive/restore, content wipe | Default archive rejected; admitted jobs/children complete and end/cancel controls remain available; wipe prevents late resurrection | A12, A19 |

Exercise all supported card types. Character personas need separate cases because role filtering and default selection are special. Adventure templates have embedded snapshots and currently do not share the character/world/item version-history behavior.

## Expected outcomes added by the readiness refresh

| Area | Required assertions | Acceptance |
|---|---|---|
| Contracts | Workspace header required on existing private routes; optional initial collection header validated/captured only on new-card flows; path/header mismatch rejected; socket query binds session; public/account/binary exemptions preserved | A02, A13, A20 |
| Metadata | Exact organization fields accepted in read/result DTOs; no organization in bodies/drafts/versions/snapshots/prompts/exports; operation replay differs intentionally from current membership reads | A01, A07, A13 |
| Membership races | Full bad batch rolls back; repeated remove is unchanged; deletion/finalization serialize; missing admitted initial groups yield stable COLLECTION_REMOVED warnings | A03, A12 |
| Default persona | Set/publish/restore/create races cannot produce multiple published defaults in a workspace; historical flags remain unchanged; omitted copied persona pointer becomes null | A10 |
| Copy admission | Whole input validation; bounds reject instead of truncate; same-ID different intent conflicts; shared dependency states map once; differing snapshots remain distinct | A06, A07, A16 |
| Copy atomicity | Two identical concurrent requests create one copy; an error injected after each insert stage rolls back every card/book/resource/link/attachment/membership/association/receipt; an asset deletion racing a copy either fails the copy or is refused afterwards | A07, A14, A16 |
| Resources | Independent linked rows and embedded metadata copied/remapped; evaluation/source hashes remain valid; live references never point to source workspace | A06, A16 |
| Browser history | Indexed restoration/approval/cancel, unindexed external hashes, duplicate popstate/hashchange, failed save and stale queued validation cannot commit | A15 |
| Calls | Switch cancellation leaves call running; commit awaits end; failed end keeps source; live-call archive is conflict; starting B still supersedes account call A | A17 |
| Notifications | Global billing notices stay global; job notice origin survives deletion; no active-gallery fallback; archived origin opens read-only; legacy unresolved target unavailable | A18 |
| Media discovery | Copied asset appears in both associated workspaces while job history stays in origin; detached assets remain visible; TTS owner resolved through job | A14, A18 |
| Migration | Exact image-profile predecessor, frozen prior contracts, interrupted DDL/backfill/constraint/marker states, orphan/deleted-target operations, unsupported scopes | A01, A20 |
| Account initialization/wipe | One pointer/default under concurrent first requests; empty user has no invented app scope; retained callbacks/copies cannot recreate wiped roots | A19 |
| Profiles and accounting | LLM/image/voice preset/default/credentials/quota ownership unchanged; fresh archived user attempt rejected, planned admitted-job children retain origin; completion warnings do not change charging | A12, A17, A20 |
| Unified library | One sidebar Library entry, compact folders/cards in one browser, card grid begins after folders without portrait-height empty folder tiles, root/folder navigation, no type sections or collection-chip bar; compare actual GalleryCard and retained view preference with baseline | A21, A22 |
| Search/folder counts | Root search matches folders and cards; folder search is visibly scoped; clear/escape/no-results/loading preserve navigation; type/persona filters do not hide folders; aggregate counts and card paging agree | A23 |
| Creation entry | Every feature-enabled card type/persona opens its existing creator from New; root/folder initial membership, import destination, captured return query/type/view; no nested-folder option | A24 |
| Assistant compatibility | Stable conversation across template/editor transition; pre-template assistant and direct generator remain; first target creation captures collection; bound edits preserve memberships; history handoff resolves origin | A25 |
| Saved result reconciliation | Direct generation/assistant persist once, editor save updates same ID; restored search can exclude result; View card reaches origin and Back restores filters without duplication | A25, A26 |
| Rollout compatibility | Handshake results: unreachable, 404/older contract (blocking "updating" state with retry), newer contract (reload dialog), supported (continue); no private request and no `X-Workspace-Id` before the handshake; flag `false` shows today's sidebar/galleries on default-workspace transport and no workspace/collection/copy creation; flag `false` with extra workspaces shows the notice and resolves foreign links as unavailable; compatibility release turns `WORKSPACE_REQUIRED` into one blocking reload dialog without auto-reload or stacked toasts; one-time browser-storage move into the default is idempotent | A27 |

## Frontend starting points

| Existing file | Extend for |
|---|---|
| [DataProvider auth transitions](/home/andres/WebstormProjects/magic-worlds/src/app/providers/DataProvider.authTransitions.test.tsx) | Workspace transitions, stale read/write ownership |
| [DataProvider tests](/home/andres/WebstormProjects/magic-worlds/src/app/providers/DataProvider.test.tsx) | Scoped loading and initial default workspace |
| [Background task tests](/home/andres/WebstormProjects/magic-worlds/src/app/providers/BackgroundTasksProvider.test.tsx) | Origin labels, switching, completion navigation |
| [Gallery hook tests](/home/andres/WebstormProjects/magic-worlds/src/features/gallery/hooks/useCardGallery.test.tsx) | Workspace/collection paging and selection invalidation |
| [Import hook tests](/home/andres/WebstormProjects/magic-worlds/src/features/gallery/hooks/useCardImport.test.tsx) | Destination-aware conflict and retained request |
| [Codex tests](/home/andres/WebstormProjects/magic-worlds/src/features/novel/hooks/useCodex.test.tsx) | Explicit filtered selection and unchanged snapshots |
| [Chapter draft tests](/home/andres/WebstormProjects/magic-worlds/src/features/novel/hooks/useChapterDraft.test.tsx) | Save/flush during workspace switch |
| [Gallery link tests](/home/andres/WebstormProjects/magic-worlds/src/features/gallery/galleryLinks.test.ts) | Workspace hashes, legacy links, history |
| [Generated-card contract tests](/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/cardContract.test.ts) | Intentional organization metadata shape |
| [Assistant contract tests](/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/assistantContract.test.ts) | Unified conversation workspace metadata |

Also test the shared assistant hook/adapters and the new workspace/collection components. Use interaction tests for important behavior, not assertions that merely mirror implementation.

Review keyboard/touch opening versus selecting folders/cards, New-menu focus/Escape restoration, small-screen persistent search/type controls, accessible collection count labels and no-match recovery. Prototype walkthrough checks do not prove application/API implementation. The manual editor's full existing fields and assistant states must remain covered in application acceptance even when a standalone illustration abbreviates them.

## BFF starting points

| Existing file | Extend for |
|---|---|
| [Ownership tests](/home/andres/PycharmProjects/magic-worlds-api/tests/test_ownership.py) | Owner/application/workspace boundaries |
| [Card sharing tests](/home/andres/PycharmProjects/magic-worlds-api/tests/routes/test_card_sharing.py) | Destination deduplication and public imports |
| [Resource clone tests](/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_card_resource_clone.py) | Dependency mapping, atomic copy, blob cleanup |
| [Story routes](/home/andres/PycharmProjects/magic-worlds-api/tests/routes/test_story_routes.py) | Scoped sources and snapshot retention |
| [Lorebook loader](/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_lorebook_loader.py) | Workspace-global activation |
| [Media ownership](/home/andres/PycharmProjects/magic-worlds-api/tests/models/test_media_asset_ownership.py) | Shared immutable media and deletion references |
| [Unified assistant routes](/home/andres/PycharmProjects/magic-worlds-api/tests/routes/test_assistant_routes.py) | All kinds and unbound history |
| [Assistant storage contracts](/home/andres/PycharmProjects/magic-worlds-api/tests/models/test_assistant_storage_contract.py) | Root workspace and exact row shapes |
| [Card execution DB integration](/home/andres/PycharmProjects/magic-worlds-api/tests/integration/test_card_profile_execution_database.py) | Atomic card/membership finalization and replay |
| [Assistant execution DB integration](/home/andres/PycharmProjects/magic-worlds-api/tests/integration/test_assistant_profile_execution_database.py) | Origin, CAS, late completion and recovery |
| [Schema bootstrap](/home/andres/PycharmProjects/magic-worlds-api/tests/test_schema_bootstrap.py) | New exact schema and revision states |
| [Schema/runtime alignment](/home/andres/PycharmProjects/magic-worlds-api/tests/models/test_schema_runtime_alignment.py) | Columns, SQL selection, and validators |

New tests should verify the workspace migration, collection repository, batch copy operation, and preserved content with a real ephemeral MySQL instance where database semantics matter. Mock-only route tests cannot prove composite constraints or transaction behavior.

## Additional current-project starting points

| Existing file | Extend for |
|---|---|
| [NavigationProvider tests](/home/andres/WebstormProjects/magic-worlds/src/app/providers/NavigationProvider.test.tsx) | Indexed/unindexed history, failed/canceled switches, queued request generations |
| [Voice controller tests](/home/andres/WebstormProjects/magic-worlds/src/features/interaction/hooks/useVoiceCallController.test.ts) | End-before-switch and stale callback ownership without breaking token refresh |
| [Voice integration](/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/VoiceCall.integration.test.tsx) | End acknowledgement, failed end, quota/account lifecycle integration |
| [Notification UI tests](/home/andres/WebstormProjects/magic-worlds/src/features/notifications/components/NotificationsPage.test.tsx) | Guarded origin actions, legacy/archived/deleted target behavior |
| [Voice route admission](/home/andres/PycharmProjects/magic-worlds-api/tests/voice/test_voice_route_admission.py) | Workspace start/resume/transcripts and account-wide supersede |
| [Voice lifecycle](/home/andres/PycharmProjects/magic-worlds-api/tests/voice/test_voice_call_lifecycle.py) | Archive/switch/end and quota release |
| [Callbot DB integration](/home/andres/PycharmProjects/magic-worlds-api/tests/integration/test_callbot_profile_execution_database.py) | Retained voice-turn origin, CAS, recovery |
| [Extraction DB integration](/home/andres/PycharmProjects/magic-worlds-api/tests/integration/test_lorebook_extraction_profile_database.py) | Book/independent resource scope and deleted/changed-source CAS |
| [Notice service tests](/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_notification_service.py) | Durable origin without changing global notice schema |
| [Image-profile cutover tests](/home/andres/PycharmProjects/magic-worlds-api/tests/integration/test_image_profile_cutover_database.py) | Preserve predecessor schema/profiles/jobs while adding workspace cutover |
| [Image profile routes](/home/andres/PycharmProjects/magic-worlds-api/tests/routes/test_image_profile_routes.py) | Unchanged account/application defaults and BYOK boundaries |
| [API status tests](/home/andres/WebstormProjects/magic-worlds/src/app/providers/ApiStatusProvider.test.tsx) | Services-down banner while the API is stopped; "updating" state for private pages during the handshake |
| [Version check tests](/home/andres/WebstormProjects/magic-worlds/src/app/hooks/useAppVersionCheck.test.tsx), [update banner tests](/home/andres/WebstormProjects/magic-worlds/src/ui/components/AppUpdateBanner.test.tsx) | Immediate check on `WORKSPACE_REQUIRED` or a newer contract version; blocking reload dialog without auto-reload |
| [Feature flag tests](/home/andres/WebstormProjects/magic-worlds/src/shared/featureFlags.test.ts) | `VITE_FEATURE_WORKSPACES_ENABLED` gates UI only, never transport |

Create new workspace/collection/copy/context/migration tests during implementation; those paths do not exist yet. Exercise every inventory row in [document 16](16_scope_inventory.md), including worker callbacks, private export/import, generic recovery/receipts, and account wipe.

## Repository validation boundaries

Frontend: run relevant Vitest tests and `pnpm build`. If stories change, run `pnpm typecheck:stories` and inspect key states. Separate pre-existing lint failures from regressions.

BFF: run focused unit/route tests, real database integration, schema bootstrap, and migration interruption/resume checks using its configured environment.

Upstream repos: no workspace feature test suite is required if their contracts remain unchanged. Use BFF transport regression tests to prove existing auth delegation, inline graph execution, and BYOK behavior. Broaden upstream tests only if an actual upstream contract changes.

No live provider calls are necessary to verify card organization.

## Performance and rollout checks

Measure scoped query plans and representative card counts before choosing indexes and batch limits. Verify cold workspace load, large collections, search paging, and copy transaction duration at the maximum bounds. Do not invent latency targets or claim measured improvements from this static review.

Documentation link/structure checks validate this report only. They are not substitutes for the above feature acceptance tests.

## Planned validation commands and evidence

From the frontend repo, run focused `pnpm exec vitest run <changed test paths>`, then `pnpm build`. Run `pnpm typecheck:stories` when stories change. Record pre-existing unrelated failures separately; do not treat a documentation check as a build result.

From the BFF repo, use its configured `.venv/bin/python -B -m pytest <focused test paths>` and real ephemeral MySQL fixtures for constraints/transactions/migrations. Confirm the pytest provider markers: live auth is not among the default excluded markers, so exclude it explicitly when doing offline regression checks. No live provider or production database is required for feature correctness tests.

Record exact source revisions/working-tree state, commands, DB fixture version/schema, outcomes, preservation reports, and unresolved failures before release. Query plans, copy transaction duration, cold loads and large-collection behavior are measured then. Specification/source/link checks and the separate fixture prototype's build/navigation checks do not certify these application/runtime gates.

## Verification results (2026-10-12, local)

The results below up to "Volume, query plans…" come from the `workspace-r1` worktrees (API from `f77e60f`, frontend from `f0f5769`) and a throwaway MySQL 8 container. Results after the integration into the main checkouts, including the dev-database migration, are in "Main-checkout integration and dev database migration" at the end. No production database, deployed build or live provider was used.

### Frontend (`magic-worlds-workspace-r1`)

| Check | Result |
|---|---|
| `pnpm exec vitest run` | 270 files: 2558 passed, 1 failed. The failure is the pre-existing `DocsPage` "documents reusable Markdown and text resources" test, which also fails on `f0f5769` |
| `pnpm build` (typecheck + production build) | Green |
| `pnpm typecheck:stories` | Green |
| Unscoped-client audit | Every private call goes through `apiService.withWorkspace(...)` or a scoped hook; the bare singleton is used only for capabilities, `GET /workspaces`, account/public routes and global profile controls |

New and extended coverage includes `WorkspaceProvider`, `NavigationProvider.workspace`, `AppRouter.workspace` / `AppRouter.library` (handshake states, flag-`false` notice), `Sidebar.workspace` (flag `false` keeps today's galleries), `WorkspaceSwitcher`, `WorkspaceNavigationBridge`, `workspaceRouting`, `LibraryPage`, `CopyToWorkspaceDrawer`, `CreationDestination`, `workspaceStorage` (one-time pre-R1 storage move), `workspaceContract` / `workspaceTransport` (headers, socket query, `workspace:required`), `assistantContract` (card `organization_warnings`), `lorebookWorkspaceWire` (no `organization` in bodies or prompts), and archived read-only coverage (`useWorkspaceReadOnly`, the four creators, `CardHistoryDrawer`, lorebook studio/gallery/resources, `NovelStudio.readOnly` with real TipTap, Codex, media gallery, card and app assistants, Chatroom, Calls, Started adventures and the dashboard).

### Compatibility release (`magic-worlds-compat`)

`WORKSPACE_REQUIRED` from HTTP (422), the chat socket (close 4422) or the voice socket (`voice_error`) triggers one immediate version check and one blocking reload dialog with no auto-reload and no stacked toasts. Covered by `workspaceRequired`, `WorkspaceRequiredNotice`, `chatSocket`, `voiceSocket`, `useAppVersionCheck` and `Toast` tests; re-run 2026-10-12: Vitest 2282/2283 (the only failure is the pre-existing `DocsPage` "documents reusable Markdown and text resources" test, which also fails on `f0f5769`), `pnpm build` and `pnpm typecheck:stories` green.

### API (`magic-worlds-api-workspace-r1`)

| Check | Result |
|---|---|
| Unit/route suite (offline, provider markers excluded) | 7452 passed, 746 skipped, 7 failed. All 7 failures are pre-existing and also fail on `f77e60f`: `TestAuthProxyChain` (6, need a running api.auth) and `test_runtime_config::test_database_docs_expose_only_fresh_provision_or_explicit_recreation` (1) |
| Real MySQL integration (34 files, per-test databases) | 34 files: 697 passed, 53 failed. All 53 failures are pre-existing (listed below); `test_workspace_database` 4/4 and `test_workspace_cutover_database` 12/12 pass |

New workspace coverage: `test_workspace_database` (protected default created once; lifecycle versions and archive rules; collections, membership, counts and the mixed library list; all-or-nothing copy with request-ID replay), `test_workspace_cutover_database` (check-only reports without mutation, then `--apply` assigns defaults and preserves data; resume from every recognized partial state; stop before any change when an origin cannot be derived; unsupported states stop without mutation), plus `test_card_workspace_routes`, `test_llm_execution_workspace_routes`, `test_chat_ws_workspace`, `test_voice_workspace_scope`, `test_conversation_workspace_scope`, `test_assistant_workspace_scope`, `test_story_workspace_models`, `test_lorebook_extraction_workspace`, `test_card_generation_organization` and `test_system_writer_origin`.

Pre-existing integration failures. The node IDs are identical on the pre-R1 baseline worktree at `f77e60f`; the reconciliation and studio files were re-diffed after the final run:

- `test_callbot_profile_execution_database`: 1 (`invalid_spoken` parameter case).
- `test_llm_profile_execution_database`: 2 (repeated cancellation cleanup; feature contract role binding).
- `test_llm_tools_execution_database`: 4 (app-assistant BYOK cases).
- `test_studio_profile_terminal_attempts_database`: 7 (profile cases).
- `test_conversation_reconciliation_database`: 39 (21 expect a dict without `execution_id`/dispatch, which changed in `9b391ac`; 18 expect `ProfileError` where the route maps to `HTTPException`).

### End-to-end smoke (local)

A pre-R1 database was provisioned from the frozen `2026_10_image_profiles` schema and seeded with legacy cards of all four types, a default persona and another owner's card. The migration CLI ran check-only, then `--apply` with an equal fingerprint. The R1 API (auth dependency overridden for a local user, providers disabled) then started with strict verification passing. With the R1 frontend at flag `true`:

- The handshake ran before any private request. Every private request carried `X-Workspace-Id`, with no 422 `WORKSPACE_REQUIRED` and no 404.
- Migrated cards and the persona default marker appeared in "My library". The other owner's card did not appear.
- Collections, folder view and search URL sync, workspace switching, create/archive/restore of a second workspace and a copy with its result navigation all worked.
- With the second workspace archived:
  - The banner offered Restore.
  - The character creator disabled all 18 inputs, Save, Publish and generation, but kept Back, Version history, section navigation and Cancel.
  - Lorebooks, Novels and Resources disabled New/Upload/From URL.
  - Chatroom disabled New chat and New group chat.
  - The dashboard hid its create band; any remaining create entry showed the archived message instead of navigating.
- Idle pages issued no polling requests.

Expected 503s came only from the disabled LLM, media and assistant services. The flag-`false` state was covered by unit tests rather than a browser pass.

### Volume, query plans, copy bounds and migration rehearsal (local)

Environment: throwaway MySQL 8.0.46 container, 128 MiB buffer pool (smaller than the 155 MB dataset), every timing at durability `innodb_flush_log_at_trx_commit=1` / `sync_binlog=1`. Raw output is in the session scratchpad `perf/RESULTS.md`.

- **Volume.** 301 owners and 35,000 cards. One heavy user has 5,000 cards across all four types, including 150 personas. Lorebooks, entries, attachments, resources, links, sessions, stories and image jobs were seeded too: 71,449 fingerprinted rows.
- **Backup.** `mysqldump --single-transaction` took 0.74 s (67 MB); restore took 5–8 s. A restored copy's check-only fingerprint equals the original's.
- **Interrupted migration.**
  - `--apply` was killed with SIGKILL mid-backfill: all defaults existed and 300 of 35,000 cards were assigned.
  - Check-only then reported phase `backfill` with an unchanged fingerprint.
  - Re-running `--apply` resumed and completed in 9.3 s with the fingerprint equal to the pre-migration check. Afterwards only `content_schema_revision` differs, as designed.
- **Clean migration.** 11.6 s end to end at this volume, about 13.6 ms per owner, mostly per-owner commits. 10,000 owners would take roughly 2.3 min (an extrapolation, not a measurement). Strict `verify_mysql_schema` passed afterwards.
- **Query plans.**
  - No library query scans `tb_card` across owners.
  - Median page times were 7–83 ms. They depended on table statistics: an empty `tb_card_draft` made the optimizer materialize and sort the whole workspace for each page.
  - The `total` count joined body and draft for every card.
  - Type-filtered pages used the pre-R1 `idx_tb_card_scope` index, which has no `workspace_id`, reading the user's cards across workspaces.
  - Deep offsets cost what OFFSET costs. Folder counts took about 10 ms and the workspace list under 1 ms.
- **Copy at maximum bounds.**
  - Test copy: 20 cards, 100 lorebook states (85 live, 10 shared, 15 snapshots), 100 resources, a payload of 8,372,207 of 8,388,608 bytes, and 20 destination collections.
  - Median 0.546 s, maximum 0.569 s, 1,562 statements. A replay took 1.5 ms and wrote nothing.
  - While a copy ran, the same owner's library and collection reads on any workspace waited about 0.5 s. `lock_workspace` locked the shared `tb_workspace_scope` row (no `FOR UPDATE OF w`). Other owners were not blocked.
- **Fixes applied after this run.**
  - `lock_workspace` now takes `FOR UPDATE OF w FOR SHARE OF s`, so a copy only blocks its own two workspaces.
  - `LibraryModel.list_cards` now uses a deferred join with `FORCE INDEX (idx_tb_card_workspace_recent)`, or `idx_tb_card_workspace_type` when filtering by type. It joins bodies only for search and role filters and never joins drafts for counts.
  - Re-measured on the heavy user (5,000 cards):

    | Call | Before | After |
    |---|---|---|
    | Default page | 24.6 ms | 2.7 ms |
    | Search `q='a'` | 24.1 ms | 9.7 ms |
    | Uncollected | 40.1 ms | 13.5 ms |
    | Offset 4800 | 27.4 ms | 4.3 ms |
    | Item filter | 3.5 ms | 1.3 ms |
- **Pre-existing schema bug found (not R1).**
  - `tb_card_draft.card_type` lists `character, world, item`, but the `tb_card` column it references lists `character, world, adventure_template, item`.
  - InnoDB compares the two columns by position in the list, so an item-card draft insert fails with ERROR 1452. `tb_card_version` has the same shape.
  - It already exists in the frozen pre-R1 schema and needs its own migration.

### Main-checkout integration and dev database migration (2026-10-12)

The R1 diffs were applied to the main checkouts and the conflicts resolved: API at base `21127be`, which adds `resource_task` and PDF import, and frontend at base `43ee765`. Re-run there:

| Check | Result |
|---|---|
| Frontend `pnpm exec vitest run` | 2577 passed / 2578; the only failure is the pre-existing `DocsPage` test |
| Frontend `pnpm build`, `pnpm typecheck:stories` | Green |
| API offline unit/route suite | 7529 passed. The 6 failures are the pre-existing `TestAuthProxyChain` cases, which need a running api.auth |
| API real-MySQL integration suites | 705 passed. The 53 failures are the same pre-existing node IDs listed above |
| Schema bootstrap test | 78 tables, 135 FKs |

**Dev database (`magic_worlds`, the owner's local dev server).**

1. **Backup.** `mysqldump --single-transaction` saved to `~/magic-worlds-db-backups/magic_worlds_pre_r1_20261012_074625.sql` (3 MB, mode 600).
2. **Full-data rehearsal.** The dump was restored into a throwaway container, then migrated check-only, with `--apply`, and check-only again. Strict `verify_mysql_schema` passed.
3. **Check-only on the real database.** Phase `predecessor`, 71 tables, 1,772 fingerprinted rows, digest `def13dbd9a38579a…`. This matches the rehearsal.
4. **`--apply`.** Took about 7 s and ended at phase `target`, revision `2026_10_workspace_r1`, with the same digest.
   - It created 3 owner-scope default workspaces.
   - It assigned 16 cards, 38 adventure sessions, 5 novels, 1 lorebook, 5 resources, 9 assistant conversations and 19 resource tasks, plus 94 image, 8 theme-song and 12 TTS jobs.
   - It backfilled 35 LLM-execution operation contexts and 104 media associations.
5. **Check-only afterwards.** Phase `target`; nothing pending.
6. **Startup.** The API starts against the migrated database, with strict schema verification passing.
7. **Browser smoke.** The owner's existing session was used with the flag `true`.
   - The handshake (capabilities, then `GET /workspaces`) ran before any private request.
   - "My library" listed the migrated cards.
   - Explore, Chatroom, Started adventures, Notifications, Novels, Calls, Lorebooks, Resources, Media, Voices, Assistant and the Tasks drawer all rendered.
   - Every API request returned 2xx with two exceptions. First, a 401 at startup triggered the normal refresh-and-retry. Second, 8 image downloads in Media returned 404 because their files are missing from the local `.image_storage`. Their `image_asset` rows exist, but their whole folders are gone; these are uploads from 2026-09-20. R1 changes neither `routes/media_assets.py` nor `ImageAssetModel.get_owned_asset`, and the assets whose files exist return 200.

Restore the pre-R1 dev database, if needed:

```bash
mysql -h 192.168.1.90 -u root -p -e "DROP DATABASE magic_worlds; CREATE DATABASE magic_worlds CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"
mysql -h 192.168.1.90 -u root -p magic_worlds < ~/magic-worlds-db-backups/magic_worlds_pre_r1_20261012_074625.sql
```

Stop the API first. The dump has no `CREATE DATABASE`, and a restore over the R1 schema would leave the new R1 tables behind. The pre-R1 API code does not start against an R1 schema.

### Still requiring the real environment

- Inventory of the deployed revision, quiescence/restart, and a production backup/restore.
- Live-provider paths (by design, none are required for feature correctness).
- The volume run seeded no theme-song, TTS, LLM-execution or assistant rows. Those migration paths are covered by the integration suites, not by volume.
