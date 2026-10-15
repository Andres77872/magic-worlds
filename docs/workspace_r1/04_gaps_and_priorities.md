# Workspace R1: gaps, priorities, and roadmap

**Reviewed:** 2026-10-14. **Status: WIP rollout.** The former G01–G15/G17–G20 implementation gaps are now implemented in source; the current gap is release evidence and the specific residuals below. Default UI rollout is disabled; local opt-in is true. Dates and individual assignees are **TBD**.

Use [02](02_current_status_and_findings.md) for current facts, [12](12_implementation_plan_and_acceptance.md) for the dated implementation record and [13](13_validation_and_coverage.md) for historical local acceptance evidence. A documentation checklist does not make a disabled product available.

## Implementation ledger

| Earlier gap IDs | Current status | Implementation |
|---|---|---|
| G01–G04 | Implemented | Owned roots/selectors, private repository scope, captured operation destinations, workspace-local persona/lore defaults |
| G05–G06 | Implemented; release acceptance WIP | Workspace epochs and stale guards, exact bootstrap, migration/resume and compatibility-handshake code |
| G07–G10 | Implemented | Flat collections/membership, one Library, independent bulk selection, destination-local import deduplication, atomic dependency-aware copies |
| G11–G14 | Implemented | Server-filtered paginated pickers, workspace links/history and creation return context, strict organization DTOs, scoped assistant knowledge/history |
| G15, G18–G20 | Implemented | Protected-default/archive/account cleanup, admitted operation recovery, call switching/history and origin-aware notices, media associations |
| G17 | Implemented; historical baseline superseded | R1 migration preserves frozen image-profile/resource-task predecessor. Canonical schema now `2026_10_voice_native`; workspace compatibility marker stays stable |
| G16 | Deferred / TBD | Account-wide search, nested/smart groups, portable bundles; human collaboration needs separate permissions/concurrency design |

The implementation is mapped to current files in [02](02_current_status_and_findings.md) and the coverage inventory in [16](16_scope_inventory.md). This table records the presence of the implementation and existing tests, not fresh production proof.

## Remaining roadmap

| ID | Priority / status | Gap / action | Acceptance gate | Owner role |
|---|---|---|---|---|
| W-01 | P0 · WIP rollout | Inventory deployed revisions and the compatibility frontend; verify exact schema chain and coordinated rollout | Restore-tested DB/blob backups, quiescence/drain evidence, exact bootstrap, shipped compatibility release, supported failure/recovery states, [11](11_migration_and_rollout.md) steps completed on intended environment | Release/backend |
| W-02 | P0 · WIP acceptance | Prove flag false remains scoped/default-only; prove flag true unlocks complete R1 UI | Capability handshake before private traffic; stale-tab prompt; nondefault content unavailable notice without leakage; owned direct-ID/list reads; no dropped unsaved changes; call ended before switch | Frontend/QA |
| W-03 | P1 · Source-confirmed gap | Parent/child card_type enum ordering still differs under the item draft/version composite FK; reproduce and repair | Negative/positive item draft/publish/version evidence; either migration and regression test, or documented proof the old mismatch is superseded | Backend |
| W-04 | P1 · Source-confirmed gaps / one TBD | `ImageAssetModel.create_asset` still allows only fal parents; reference scans omit assistant snapshots; TTS deletion has no reference guard. Unbound assistant default uniqueness needs investigation | Focused source/test evidence for assistant default uniqueness, retained snapshot assets, image parent rules and TTS deletion. Track confirmed defects individually | Backend |
| W-05 | P1 · WIP coverage | Measure production-like copy/migration/query performance including assistant/jobs/retained executions | Bounds, EXPLAIN/query timings, lock/cancel behavior and fingerprint preservation for representative datasets, not only seeded cards | Backend/ops |
| W-06 | P2 · Gap confirmed | Cross-workspace playlist card previews currently suppressed; origin label remains | Product decision: accept current behavior or implement owned-origin navigation/preview with unsaved/call guards and race tests | Frontend/product |
| W-07 | P2 · Deferred / TBD | Cross-workspace search, nested/smart groups, bundle transfer and human collaboration | Separate approved scope/contracts, ownership/permissions and migration/test plan | Product/architecture |

P0 protects content/isolation and rollout. P1 resolves confirmed integrity issues and establishes environment evidence. P2 is follow-up product scope. The older local test counts and failures are dated; do not treat them as a current blocker without revalidation. Other feature flags gate the content types surfaced within R1 independently.

## Completion rule

R1 can leave **WIP rollout** only when its intended frontend build enables the product UI and the matching deployed API/schema passes the release evidence above. Keep each confirmed defect open until its acceptance gate is met. A migration on the owner's dev/test database and local browser smoke do not close production gates.
