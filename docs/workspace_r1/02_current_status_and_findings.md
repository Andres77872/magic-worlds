# Workspace R1: current status and findings

**Reviewed:** 2026-10-14, America/Mexico_City. **Product status: WIP rollout.** Workspace R1 is implemented in the current frontend and BFF source, with dated local tests, migration and browser-smoke evidence in [13](13_validation_and_coverage.md). The frontend UI flag defaults to false in `.env.example`; local `.env` opts in. Deployment/production availability is not established by this review.

This replaces the obsolete pre-implementation findings from 2026-10-12. [12](12_implementation_plan_and_acceptance.md) retains the implementation history; its base commit IDs, uncommitted state and test totals are dated records, not current checkout assertions.

## Capability status

| Capability | Current implementation | Availability / remaining evidence |
|---|---|---|
| Owned personal workspaces, protected default, archive/restore | BFF routes/models/strict context and `WorkspaceProvider` exist | Local enabled; default product UI disabled. Deployed version and release evidence TBD |
| Library, collections, multi-membership, Uncollected | `features/library`, relational membership and mixed-card endpoint exist | Product surfaces gated by `VITE_FEATURE_WORKSPACES_ENABLED`; folder membership does not automatically activate AI context |
| Independent batch copy | `workspace_copy.py`, bounded command/receipt, dependency/resource/media remapping and copy dialog exist | Local transactional/migration tests recorded; production representative volume and rollback evidence required |
| Workspace-bound private traffic | `apiService.withWorkspace`, X-Workspace-Id selectors, socket query and BFF owned context exist | **Always active transport** even with product flag false. No account-wide/private fallback |
| Stale requests, navigation and local state | Auth/workspace epochs, async navigation coordinator, origin capture and browser-storage namespacing exist | Race/unsaved-change tests exist; intended release pair must pass handshake and stale-tab smoke |
| Scoped story, assistant, media and call activity | Existing roots/operations carry workspace origin; source inventory in [16](16_scope_inventory.md) | Other product flags remain independent; workspace opt-in does not enable disabled novels/adventures/calls/lorebooks |
| Account-level controls | Profiles/BYOK, billing, consent, presets, quotas and account-wide one-call rule retain their boundaries | Do not conflate app workspaces with the ElevenLabs account workspace |
| Migration tooling | `20261012_workspace_r1.py`, frozen predecessor/target schemas, interruption/resume verifier exist | Dev migration/rehearsal reported in 13. No production migration claimed |
| Compatibility release | Earlier stale-tab compatibility build recorded in 12/13 | Verify its actual shipped/live status; repository code is insufficient |

## Flags and compatibility

[featureFlags.ts](/home/andres/WebstormProjects/magic-worlds/src/shared/featureFlags.ts) checks `VITE_FEATURE_WORKSPACES_ENABLED === 'true'`. Default false hides Library, switcher, collection/copy/create-workspace surfaces and keeps the protected default workspace selected. The provider still performs capabilities → GET /workspaces before private loading, and private requests still carry an owned selector. Existing nondefault content stays preserved with an unavailable notice. It is incorrect to describe flag false as disabling workspace isolation.

The capability response remains `{workspace_r1:true, contract_version:1, schema_revision:"2026_10_workspace_r1"}`. The current canonical BFF schema is **`2026_10_voice_native`**. The capability marker is a stable compatibility contract; it must not track every later database revision. Strict bootstrap verifies the actual canonical schema independently.

The workspace cutover now derives its target from frozen `migrations/2026_10_workspace_r1.sql`, not the evolving `db.sql`. It verifies supported later voice revisions as `superseded` without replaying R1. Unknown/unsupported schema states still stop. Follow the release environment's verified migration chain; don't run an old revision blindly against a newer schema.

## Source and test evidence

| Concern | Sources and existing tests |
|---|---|
| Startup and scoped state | [WorkspaceProvider.tsx](/home/andres/WebstormProjects/magic-worlds/src/app/providers/WorkspaceProvider.tsx), [DataProvider.tsx](/home/andres/WebstormProjects/magic-worlds/src/app/providers/DataProvider.tsx), [AppProvider.tsx](/home/andres/WebstormProjects/magic-worlds/src/app/providers/AppProvider.tsx) |
| Navigation, archive and call switches | [NavigationProvider.tsx](/home/andres/WebstormProjects/magic-worlds/src/app/providers/NavigationProvider.tsx), [workspaces](/home/andres/WebstormProjects/magic-worlds/src/features/workspaces), [useWorkspaceReadOnly.ts](/home/andres/WebstormProjects/magic-worlds/src/shared/hooks/useWorkspaceReadOnly.ts) |
| Library, copy and captured creation | [library](/home/andres/WebstormProjects/magic-worlds/src/features/library), [api client](/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/index.ts), [workspace storage](/home/andres/WebstormProjects/magic-worlds/src/shared/workspaceStorage.ts) |
| Ownership and endpoints | [workspaces.py context](/home/andres/PycharmProjects/magic-worlds-api/src/services/workspaces.py), [workspaces.py routes](/home/andres/PycharmProjects/magic-worlds-api/src/routes/workspaces.py), [workspace_models.py](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/workspace_models.py), [workspace_copy.py](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/workspace_copy.py) |
| Migration and schema | [workspace_cutover.py](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/workspace_cutover.py), [migration CLI](/home/andres/PycharmProjects/magic-worlds-api/scripts/migrations/20261012_workspace_r1.py), [frozen R1 schema](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/migrations/2026_10_workspace_r1.sql) |
| Frontend examples of negative/race tests | [Sidebar.workspace.test.tsx](/home/andres/WebstormProjects/magic-worlds/src/ui/components/Sidebar.workspace.test.tsx), [workspaceRouting.test.ts](/home/andres/WebstormProjects/magic-worlds/src/features/workspaces/workspaceRouting.test.ts), [WorkspaceNavigationBridge.test.tsx](/home/andres/WebstormProjects/magic-worlds/src/features/workspaces/WorkspaceNavigationBridge.test.tsx), [workspace read-only tests](/home/andres/WebstormProjects/magic-worlds/src/shared/hooks/useWorkspaceReadOnly.test.tsx) |
| Backend examples | [test_workspace_database.py](/home/andres/PycharmProjects/magic-worlds-api/tests/integration/test_workspace_database.py), [test_workspace_cutover_database.py](/home/andres/PycharmProjects/magic-worlds-api/tests/integration/test_workspace_cutover_database.py), [test_chat_ws_workspace.py](/home/andres/PycharmProjects/magic-worlds-api/tests/test_chat_ws_workspace.py), [test_turn_charge_workspace_database.py](/home/andres/PycharmProjects/magic-worlds-api/tests/integration/test_turn_charge_workspace_database.py) |

Tests were inspected as evidence of coverage; no new runtime test result is asserted. Dated test failures in 13 are historical findings and require rechecking before being called current. Later voice work specifically records fixing the old AuthProxyChain test drift.

## Concrete gaps and release gates

1. **WIP deployment:** deployed build/revision inventory, shipped stale-tab compatibility release, production backup/restore/quiescence, flag-false and flag-true acceptance are unproven. [11](11_migration_and_rollout.md) gives the coordinated order.
2. **Cross-workspace playlist previews:** current [PlaylistDock.tsx](/home/andres/WebstormProjects/magic-worlds/src/ui/components/audio/PlaylistDock.tsx) labels the origin and suppresses another workspace's card preview. Decide whether an origin-aware preview/action is required; existing audio can remain account-level.
3. **Source-confirmed integrity gaps (runtime reproductions still needed):** current `db.sql` defines `tb_card.card_type` as `(character, world, adventure_template, item)` but draft/version child enums as `(character, world, item)` under a composite FK; the earlier item-draft failure remains a schema concern. In [models.py](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py), `ImageAssetModel.create_asset` still accepts only `fal` parents even though image jobs allow OpenRouter; `_require_unreferenced_media_asset` scans card/activity/receipt/card-generation stores but omits assistant output snapshots; `TtsAssetModel.mark_deleted` still updates without a reference check. These are existing cross-feature defects, not new R1 implementation work. Unbound-assistant default-persona handling remains **TBD investigation**. Track and reproduce each before selecting a repair/migration; do not treat a dated full-suite pass as closure.
4. **Representative operation volume:** earlier 35,000-card testing did not seed every assistant, TTS/theme-song and retained execution path. Those paths have integration coverage; environment volume/migration timings still need measurement.
5. **Deferred product scope:** account-wide cross-workspace search, nested/smart collections, shared human workspaces and bundle transfer remain future design work. Flat personal workspaces and independent copying are the implemented R1 boundary.

The [gap and roadmap ledger](04_gaps_and_priorities.md) assigns status and acceptance evidence to each remaining item. This pass changed Markdown only; no flag, source, schema, database or deployment was changed.
