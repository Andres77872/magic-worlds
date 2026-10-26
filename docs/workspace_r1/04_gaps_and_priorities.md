# Workspace R1: gaps, priorities, and roadmap

**Source/documentation reconciliation:** 2026-10-15. **Status: WIP rollout.** The former G01–G15/G17–G20 implementation gaps are now implemented in source; the current gap is release evidence and the specific residuals below. The product UI is always on since the flag was removed on 2026-10-18; that is not a deployed-build assertion. Dates and individual assignees are **TBD**.

Use [02](02_current_status_and_findings.md) for current facts and [10](10_risks_and_decisions.md#acceptance-guarantees-a01-a27) for the A01-A27 acceptance guarantees; dated 2026-10-12 implementation/validation records are in git history. A documentation checklist does not make a disabled product available.

## Implementation ledger

| Earlier gap IDs | Current status | Implementation |
|---|---|---|
| G01–G04 | Implemented | Owned roots/selectors, private repository scope, captured operation destinations, workspace-local persona/lore defaults |
| G05–G06 | Implemented; release acceptance WIP | Workspace epochs and stale guards, exact bootstrap, migration/resume and compatibility-handshake code |
| G07–G10 | Implemented | Flat collections/membership, one Library, independent bulk selection, destination-local import deduplication, atomic dependency-aware copies |
| G11–G14 | Implemented | Server-filtered paginated pickers, workspace links/history and creation return context, strict organization DTOs, scoped assistant knowledge/history |
| G15, G18–G20 | Implemented | Protected-default/archive/account cleanup, admitted operation recovery, call switching/history and origin-aware notices, media associations |
| G17 | Implemented; historical baseline superseded | R1 migration preserves frozen image-profile/resource-task predecessor. Canonical schema is now the revision named by `CONTENT_SCHEMA_REVISION` in the BFF bootstrap (`2026_10_db_refactor` at the 2026-10-26 docs cleanup; a running database is not asserted here); workspace compatibility marker stays stable |
| G16 | Deferred / TBD | Account-wide search, nested/smart groups, portable bundles; human collaboration needs separate permissions/concurrency design |

The implementation is mapped to current files in [02](02_current_status_and_findings.md) and the coverage inventory in [16](16_scope_inventory.md). This table records the presence of the implementation and existing tests, not fresh production proof.

## Remaining roadmap

| ID | Priority / status | Gap / action | Acceptance gate | Owner role |
|---|---|---|---|---|
| W-01 | P0 · WIP rollout; test environment cut over, production open | Inventory deployed revisions and the compatibility frontend; verify exact schema chain and coordinated rollout. Progress: R1 committed on master (BFF `f37eefd`, SPA `c7307c6`); the `.90` test database was cut over 2026-10-12 and serves the 2026-10-14 test deployment, whose deployed commits and UI flag value were not recorded. The compatibility release is uncommitted in worktree `magic-worlds-compat` (branch `workspace-r1-compat`); its live status is unverified. **2026-10-26:** the R1 cutover tool, its migration and frozen DDL were deleted in BFF `fceaead`; the upgrade chain now runs through BFF `scripts/upgrades` from `2026_10_voice_turn_metrics` to `2026_10_db_refactor`, and databases on earlier markers must be newly provisioned ([BFF database guide](/home/andres/PycharmProjects/magic-worlds-api/docs/database.md)). The removed cutover runbook (doc 11) is in git: `git show 2d13abe2:docs/workspace_r1/11_migration_and_rollout.md`. Decide whether to retire the compatibility worktree (its pre-R1-tab `WORKSPACE_REQUIRED` reload check is likely moot) | Restore-tested DB/blob backups, quiescence/drain evidence, exact bootstrap against `2026_10_db_refactor`, retired or shipped compatibility release, supported failure/recovery states on the intended environment | Release/backend |
| W-02 | P0 · WIP acceptance | The workspace UI flag was removed in SPA `692e56bb` (2026-10-18), so the R1 UI is always on; prove the complete R1 UI in the intended environment | Capability handshake before private traffic; stale-tab prompt; nondefault content unavailable notice without leakage; owned direct-ID/list reads; no dropped unsaved changes; call ended before switch. UI smoke (from the removed runbook): the single Library sidebar entry, compact collection folders with mixed cards and persistent root/folder search; every enabled New-menu type, persona and import, direct generation and card-assistant destination, and the same saved identity after an editor save; legacy type links resolving to library filters; collections, plus a copy that succeeds, a copy forced to fail (nothing created) and a replayed request ID | Frontend/QA |
| W-03 | P1 · Source-confirmed schema mismatch; dated runtime failure recorded | Parent/child card_type enum ordering still differs under the `(card_id, card_type)` FKs `fk_card_draft_card_type`/`fk_card_version_card` → `tb_card.uq_tb_card_id_type`; item draft/version routes are reachable. A 2026-10-12 local item-draft insert failed with ERROR 1452 because InnoDB compares the ENUMs by position; `tb_card_version` has the same shape, and the mismatch already exists in the frozen pre-R1 schema. Remaining: fresh reproduction on the current schema, repair migration and an item-draft test (none exists) | Negative/positive item draft/publish/version evidence; either migration and regression test, or documented proof the old mismatch is superseded | Backend |
| W-04 | P1 · Open umbrella | Image/media integrity and assistant default handling; independently tracked below | Close each subitem with focused source/runtime evidence; one successful path cannot close all four | Backend |
| W-05 | P1 · WIP coverage | Measure production-like copy/migration/query performance including assistant/jobs/retained executions | Bounds, EXPLAIN/query timings, lock/cancel behavior and fingerprint preservation for representative datasets, not only seeded cards | Backend/ops |
| W-06 | P2 · Gap confirmed | Cross-workspace playlist card previews currently suppressed; origin label remains | Product decision: accept current behavior or implement owned-origin navigation/preview with unsaved/call guards and race tests | Frontend/product |
| W-07 | P2 · Deferred / TBD | Cross-workspace search, nested/smart groups, bundle transfer and human collaboration | Separate approved scope/contracts, ownership/permissions and migration/test plan. Account-wide search, if added, must be an explicit search mode that labels each result's source workspace; it must never silently merge other workspaces' cards into current-workspace pickers | Product/architecture |
| W-08 | P2 · Decision TBD | A root user's built-in card/novel execution sent without workspace context is classified `studio_test` (profile testing), not content work; harmless for consumers today | Decide whether root content runs must carry a workspace origin; if so, add the context and a test | Backend/product |

### W-05 local baseline (2026-10-12, not production)

Throwaway MySQL 8.0.46, 128 MiB buffer pool (smaller than the 155 MB dataset), `innodb_flush_log_at_trx_commit=1` / `sync_binlog=1`; 301 owners and 35,000 cards (one heavy user with 5,000 across all four types, including 150 personas), 71,449 fingerprinted rows. The seed had no theme-song, TTS, LLM-execution or assistant rows; those migration paths have integration coverage only. These numbers sized the removed R1 cutover window; they predate the BFF `fc79bbc` index changes and are not production evidence.

| Measure | Local result |
|---|---|
| Clean R1 migration | 11.6 s end to end, about 13.6 ms per owner (mostly per-owner commits); 10,000 owners ≈ 2.3 min is an extrapolation |
| SIGKILL mid-backfill, then `--apply` | Check-only reported phase `backfill` with an unchanged fingerprint; the resume completed in 9.3 s with the fingerprint equal to the pre-migration check |
| Backup/restore | `mysqldump --single-transaction` 0.74 s (67 MB); restore 5–8 s; the restored copy's fingerprint matched |
| Copy at maximum bounds (20 cards, 100 book states, 100 resources, ~8 MiB payload, 20 collections) | Median 0.546 s, maximum 0.569 s, 1,562 statements; replay 1.5 ms with no writes |
| Heavy-user library after the deferred-join/forced-index and `lock_workspace` `FOR UPDATE OF w FOR SHARE OF s` fixes | Default page 24.6 → 2.7 ms; search 24.1 → 9.7 ms; Uncollected 40.1 → 13.5 ms; offset 4800 27.4 → 4.3 ms (folder counts about 10 ms and the workspace list under 1 ms in the first run; not re-measured). Before the lock fix a copy stalled the same owner's reads in every workspace for about 0.5 s; now it blocks only its two workspaces |

The owner's dev database (1,772 fingerprinted rows, 3 owner scopes) migrated in about 7 s.

### W-04 source verification and independent closure

Rechecked read-only on October 15 in [models.py](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/models.py). These are source mechanisms, not new database reproductions.

| Item | Current evidence / status | Required closure evidence |
|---|---|---|
| W-04a | Confirmed source restriction: `ImageJobModel` allows `fal`/`openrouter`, while `ImageAssetModel.create_asset` passes only `fal` to the parent validator | Successful owned OpenRouter asset finalization plus invalid-parent/provider rejection, or an explicit supported-contract decision |
| W-04b | Confirmed omission: the shared image/theme-song reference scanner enumerates eight stores but omits retained assistant output snapshots | Deletion is refused for retained assistant-result references across workspaces; unrelated/unreferenced deletion remains valid |
| W-04c | Confirmed omission: `TtsAssetModel.mark_deleted` locks the owned asset and sets `deleted_at` without equivalent reference validation. Latent: no current route or caller invokes it; guard it before exposing deletion. **Closed by removal (2026-10-26):** `TtsAssetModel.mark_deleted` was deleted in BFF `765528e`; any future TTS deletion path must validate references first | Referenced `tts_asset` narration/history audio remains readable; ownership/isolation and unreferenced deletion behavior are proven |
| W-04d | Source-confirmed mechanism: unbound card-assistant creation (`_apply_card_assistant_target`) inserts through `_create_body_card_with_cursor` without `_clear_other_default_personas_with_cursor`, whereas `create_organized_body_card` clears other defaults and card generation rejects any result whose `is_default_persona` is not false; workspace default-persona uniqueness needs a runtime reproduction and repair | Concurrent/bound/unbound creation, publish/restore and cross-workspace default cases reproduce the unbound path; record repair evidence or an explicit no-defect disposition |

P0 protects content/isolation and rollout. P1 resolves confirmed integrity issues and establishes environment evidence. P2 is follow-up product scope. The older local test counts and failures are dated; do not treat them as a current blocker without revalidation. Other feature flags gate the content types surfaced within R1 independently.

## Completion rule

R1 can leave **WIP rollout** only when its intended frontend build enables the product UI and the matching deployed API/schema passes the release evidence above. Keep each confirmed defect open until its acceptance gate is met. A migration on the owner's dev/test database and local browser smoke do not close production gates.
