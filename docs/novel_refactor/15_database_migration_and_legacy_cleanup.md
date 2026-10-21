# Database migration and legacy cleanup

**Current installed schema (read from the database 2026-10-18 07:58 CST, rechecked 13:05: same revision, 124 tables, 21 novels):** `2026_10_novel_export_jobs`, 124 tables / 169 foreign keys. Every upgrade after `2026_10_novel_erase` was additive and scoped, with a verified backup first; each one's evidence is in [14](14_status_and_roadmap.md). **Since 2026-10-19** the database is at `2026_10_llm_custom_providers` (another session; still 124 tables, 21 novels on 2026-10-20). The novel migration chain reverses the later revisions (`LATER` in `story_import_format_migration.py`) and its tests pass again (2026-10-20). **Open:** the export-job store also deviates from this document's "no second job-history store" rule (D5 slice 13). **At `2026_10_novel_erase` (112 tables / 157 foreign keys)** the scoped upgrade added one empty erasure-record table and advanced the marker. A fresh verified private backup and row fingerprints verified all 4,449 original content rows across 110 content tables unchanged. Earlier annotation/statistics/bookmark upgrades remain historical evidence below. [Current erasure evidence](01_current_state_and_evidence.md#d2-deliberate-novel-erasure-evidence--2026-10-16) records installed verification.

**Data preservation correction:** 2026-10-16, America/Mexico_City. After the full project database resets, the user required recovery of all non-novel content. **Preserve recovered non-novel content and current novels during every remaining schema change. Whole-database resets are disabled.** Earlier disposable-data approval is superseded and must not be reused for another reset. [14](14_status_and_roadmap.md) remains the delivery authority.

Use coordinated schema/code changes with a verified private backup and a scoped upgrade rehearsed in an isolated copy. Preserve existing rows and IDs. No old-client support window, cohort rollout, shadow conversion, migration journal, compatible-reader release or rollback-build matrix is required. A development environment does not make unrelated feature content expendable.

Revision checks, undo, recoverable trash, scoped requests and atomic AI acceptance remain product behavior. The 136-capability target and open NE findings remain unchanged. Recovery evidence is recorded below.

## Novel erasure installation — 2026-10-16

The installed `2026_10_novel_erase` target adds only `story_erase_record` and
advances the bookmarks predecessor marker. The new table stores minimal
owner/workspace/novel/request identities, intent/source digests and time; no
title, prose or original confirmation payload. Installation leaves it empty.
The canonical target is **112 tables / 157 foreign keys**.

The scoped migration whitelists exactly that one CREATE, verifies canonical
schema agreement and requires a private backup of every exact predecessor
table on the same database/server. All original content row counts and logical
hashes must match before and after DDL. The marker changes separately. Partial
DDL is resumable only with the same empty-table and predecessor-preservation
proof; rollback must not drop the table or restore an entire database.

The retained synthetic upgrade preserved **53 original rows**. The project
installation then stopped only the matching owned API, created a fresh private
bookmarks-predecessor backup, rechecked source/index hashes, applied the one-table
upgrade and installed the verified source bundle before restarting the API.

Private pre-upgrade backup: `magic-worlds-api/.dev/backups/novel-erase-pre-20261017T042326Z-2e271000.sql.gz`.
Compressed SHA-256: `b3560d53d47c7e33ee51ec3bd7960dbeade07874439d7af6fb0dec50d1350981`. SQL and metadata are mode 0600. The backup
retains all **111 predecessor tables / 4,450 rows**, including the
marker. The upgrade verified all **4,449 original content rows across 110
content tables unchanged** before and after DDL. Only the marker advanced;
`story_erase_record` remains empty. Exact schema (112 tables / 157 foreign keys),
API health and eight expected erasure/Studio/history route contracts passed
read-only verification. All 55 final source/doc hashes and both existing staged
patches are preserved. No project test CRUD/erasure, reset, reseed, database drop,
file/media/record cleanup or whole-database restoration was used. [01](01_current_state_and_evidence.md#d2-deliberate-novel-erasure-evidence--2026-10-16)
and [14](14_status_and_roadmap.md#d2-deliberate-novel-erasure--2026-10-16)
retain evidence and remaining phase gates.

## Bookmark installation — 2026-10-16

The `2026_10_novel_statistics` predecessor advances through one atomic additive
ALTER on `story_annotation`: a defaulted `kind` column, kind-list index and
bookmark label/state check. No existing column, identity or content is rewritten.
The scoped migration validates the exact predecessor, server/database identity,
verified private backup and every original content-column fingerprint before
DDL. It verifies the complete target and those same original columns afterward,
then advances the marker. A completed-DDL/predecessor-marker retry is allowed
only when that complete contract and original-data proof still hold.

Private pre-upgrade backup:
`magic-worlds-api/.dev/backups/novel-bookmarks-pre-20261017T012902Z-f1b80ddb.sql.gz`.
Compressed SHA-256:
`21049c65fd681eabc927befa4b14147c6613a033d51a4586e57d87949490ccc1`.
SQL and metadata are mode 0600 and retain all 111 tables/4,315 rows, including
the marker. The installed verification preserved all **4,314 original content
rows** and checked the full **111-table / 156-FK** target. A later read-only
default migration invocation reports no remaining additions.

The rehearsal allocated a new retained synthetic database and preserved all 68
original rows, including a valid missing-file record. Original note receipt
intents and frozen hashes remain unchanged. No project database test writes,
reset, file/media/record cleanup or database drop was used.

## Saved-statistics installation — 2026-10-16

The statistics upgrade added only `story_scene_statistics` and
`story_novel_statistics` to the 109-table annotations predecessor. Read-only
preflight verified all 28 current canonical scene documents, hashes and plain
projections before creating either table. Original tables/rows/IDs were not
rewritten. The migration populated the two caches for six novels, checked all
original content fingerprints and advanced only the schema marker.

Private pre-upgrade backup:
`magic-worlds-api/.dev/backups/novel-statistics-pre-20261016T194150Z-559c9bf5.sql.gz`.
Compressed SHA-256:
`1dcdfd61973bed8b492765291bf251bdcfde903466138972bff697da5c1dbf98`.
The verified dump/metadata are private mode-0600 files, including database/server
identity, expanded/compressed hashes, per-table counts and logical row hashes.
Arbitrary binary values use hex SQL literals.

The applied result verified **4,276 original content rows across the 108 content
tables of the 109-table predecessor unchanged**; the marker row advances
separately. Read-only runtime verification confirmed **111 tables / 156 foreign
keys**, all six root caches current and no stale cache among 28 scenes. API
startup and health passed with matching source/schema. Missing-file records and
all recovered non-novel content were retained. No reset, reseed, file/record
cleanup or project database test write was used. Isolated migration, transaction
and scale evidence is in [01](01_current_state_and_evidence.md#d2-saved-statistics-evidence--2026-10-16).

## Scope of schema changes

The target is the MySQL database owned by `magic-worlds-api` for this project's development/test environment. Resolve its effective host and database name before any change. Review the exact tables, constraints and seeds needed by the implemented feature. Do not drop/recreate the project database, reseed unrelated features, or discard non-novel rows to simplify a novel schema change.

The configured project database on **2026-10-16** is `magic_worlds` on `192.168.1.90:3306`. `test_magic_worlds` appears as the unit-test environment default in BFF `tests/conftest.py`, alongside an invalid mock host; it is not a live recovery or reset target. A config variable does not authorize destructive changes.

Other databases, sibling services such as `api.auth` or `api.magic_llm`, and provider storage remain outside this work. Stop matching project workers only when the reviewed change requires it. Verify the target schema and retained data before resuming writes. The retired `scripts/reset_development_database.py --apply` path now refuses before reading configuration or connecting to MySQL.

## Revalidated implementation constraints

BFF paths are relative to `/home/andres/PycharmProjects/magic-worlds-api`; frontend links resolve inside this repository. The earlier source review and tests are recorded in [01](01_current_state_and_evidence.md#deep-migration-and-cleanup-revalidation--2026-10-15). No new application tests are needed for this documentation-only policy change.

| Current source | Consequence for this development refactor |
|---|---|
| `src/database/mysql/db.sql`: `story_novel`, `story_chapter`, `story_card_ref`, `story_generation`; chapter body is Markdown | The historical chapter-body storage was replaced by the scene contract. Further extensions must preserve installed rows and identities through scoped changes |
| `src/database/mysql/bootstrap.py`: exact schema, revision marker and seed verification | Update `db.sql`, marker, bootstrap expectations and seed together; provide scoped changes for the configured database. Preserve unrelated rows |
| Historical `StoryModel.update_chapter` mixed body/metadata/order; delete methods physically deleted | Replace those operations with revision-aware document/metadata/structure services and product trash/erase semantics. Schema installation must not erase unrelated content |
| `src/services/story_generation.py`, `_format_chapters`; status-only generation acceptance | Read canonical scene revisions and apply author-approved content/status atomically. Remove the old status-only path rather than support historical test generations |
| `assistant_conversation`, `assistant_message`, `tb_llm_assistant_turn`: kind and result-shape constraints | Update all enums, target FKs/checks and Ask/proposal shapes with the runtime registry and DTOs. A union-only change is insufficient |
| `src/services/llm_features.py`, `cat_llm_feature`, `tb_llm_profile_role`; card-only `tb_operation_receipt` | Seed deliberate novel assistant/helper contracts and supported roles; use manuscript write/application receipts. Reuse LLM admission without treating card receipts as generic |
| [DataProvider](../../src/app/providers/DataProvider.tsx), [useChapterDraft](../../src/features/novel/hooks/useSceneDraft.ts), [codexMention](../../src/features/novel/editor/extensions/codexMention.ts), [useWordGoal](../../src/features/novel/hooks/useWordGoal.ts) | Current queues/CAS, canonical positions and shared stable references replace the historical paths. Preserve installed browser journals and database records |

## Required storage changes by phase

These are target storage responsibilities, not executable DDL or a table-per-entity prescription. Use the [reuse and overlap decisions](07_target_architecture.md#reuse-and-overlap-decisions) before adding stores. Final names/types are chosen during implementation. Prefer one clean target schema without extra compatibility stores. Later extensions require scoped upgrades that preserve the installed data.

| Phase / storage | Required behavior |
|---|---|
| D1–D2 · Novel/chapter metadata | Keep `story_novel` and chapter grouping where useful; add independent metadata/structure revisions and lifecycle/default fields. Remove chapter `body` as a second writable authority when documents take over |
| D1–D2 · Scene/document storage | Independent scene identity, parent/order, metadata/inheritance, canonical structured JSON, schema version, current revision/hash. Preserve installed scene identities and revisions during later schema extensions |
| D1–D2 · Document/structure revisions | Immutable body checkpoints, parent/actor/source and restore lineage; structure and named snapshot manifests retain the document revisions and metadata needed to restore or export |
| D1 · Write/application receipts | Scoped request identity, intent digest and acknowledged revision/vector. Same intent replays once; changed intent rejects. Persist with the body/revision/accepted decision |
| D2 · Parts/lifecycle | Optional parts, scene/chapter ordering, archive/trash/restore and separate permanent erase. Structure edits do not overwrite unrelated prose |
| D2–D3 · Codex references | Explicit novel/chapter/scene scope, stable reference IDs, pinned snapshots/version, precedence and enablement. Chapter defaults/refs are inherited; a chapter goal is not multiplied across scenes |
| D3 · Generations/proposals/stash | Extend `story_generation` and its existing execution identity with safe instruction/history fields and source/application lineage. Exact instructions already enter `tb_llm_execution_plan.frozen_payload`; avoid a duplicate raw-prompt/execution log. Add reviewed variants, changesets and reusable manual/generated snippets where current status rows are insufficient; retain existing generations |
| D3 · Unified assistant/profile tables | Extend the existing three assistant tables with novel binding and Ask/proposal shapes; seed feature/role contracts and update handler/feature filters. No separate novel conversation store. `role_key` currently allows `primary`, `metadata`, `preflight`; add keys only if the chosen contract needs them |
| D3–D4 · Canon and derived memory | Approved facts/style, revision-bound summaries, source evidence, dependency invalidation and temporal scope. Initial retrieval can use scoped lexical search |
| D4 · Review/planning/branches | Revision-bound annotations/tasks, plot/knowledge links and branch manifests with independently qualified writable heads |
| D3–D5 · Shared background tasks | Extend existing operation/target/result contracts and SQL constraints for novel work, including task aggregation and result links. Link novel manifests/step checkpoints to shared tasks; do not add a second job-history store/provider. Existing request leases alone do not implement durable multi-step resume |
| D5–D6 · Delivery and reuse | Novel import sources/reports and frozen export manifests/artifacts linked to shared resources/tasks where applicable. Keep current chapter-goal persistence and media providers; add whole-novel statistics, novel asset bindings, versioned series canon/overrides and bounded presets |

Use the existing ownership model and scoped FKs, practical sibling/revision/history indexes, unique document heads and scoped receipt IDs. Keep current body/head, revision and accepted-operation state consistent in one transaction. Update account content wipe and owned-artifact cleanup for the new descendants. Schema installation must retain content independently of ordinary user-authorized erase operations.

Do not add `story_migration_record`, legacy chapter-to-scene alias tables, raw legacy-body archives, dual Markdown/JSON writers or schema-capability states solely for this development transition. Markdown remains an import/export/context representation where useful. Import fidelity and source retention apply to future author imports, not mandatory conversion of discarded test rows.

## Development data policy

Automated novel smoke checks create a new uniquely named synthetic database and never select, reset or reuse the configured project database. Both BFF `scripts/smoke_novel_persistence.py` and `scripts/smoke_novel_copy.py` use the shared isolated allocator and retain their fixtures for inspection. Use a small novel with chapters/scenes, Codex references and text. Add only the profile/assistant configuration needed for the slice; installing sample data does not require a live provider call. Manual project operations preserve existing accounts/workspaces and content.

Preserve existing non-novel records, current manuscripts, generations, checkpoints, receipts and snapshots. The discarded pre-refactor novel format does not require a compatibility bridge, but that historical decision does not permit discarding the current scene format or unrelated content.

Preserve current draft storage and pending requests. Retire only exact acknowledged/explicitly discarded records. Cleanup of known obsolete keys, including old `magic_worlds:novel:wordGoal:{storyId}:{chapterId}` entries, must first establish that they contain no recoverable input and stay within the exact API/account/workspace. Do not recreate the current journal store, clear another writer's newer input or touch unrelated sites, accounts or service storage.

## API and code replacement

Change frontend and BFF together and remove obsolete callers/routes in the same development slice. There is no requirement to keep the old frontend usable or to offer a legacy read-only Markdown projection. If an old route remains reachable, it must use the new service/preconditions or reject unsupported input; it cannot remain a second writer.

| Surface | Target replacement |
|---|---|
| Story gallery/read/create | Lightweight summaries, explicit structure/documents and creation of valid initial revision records |
| Chapter body/metadata/order updates | Separate revision-aware document, metadata and structure operations; remove the unguarded catch-all writer |
| Novel/chapter DELETE used as ordinary removal | Product trash/restore with deliberate erase as a separate operation; database reset remains outside this user flow |
| Card-ref operations | Scoped novel/chapter/scene references, inheritance and version checks |
| Context preview/generate/stream | One canonical context compiler and one proposal/review/commit path; no fallback to removed chapter bodies |
| Generation accept/stash/discard/result reads | Revision-bound application and reusable stash; retain replay/recovery for new requests, with no historical test-result compatibility adapter |
| Assistant conversations and profile selection | Matching new kind/shape/role contracts across SQL, Python, TypeScript, registry, feature filters and seed data |

## Migration gates and operating sequence

Use this three-step development sequence for the schema slice being implemented. M1–M3 replace the earlier seven production-rollout gates.

| Step | Work | Completion check |
|---|---|---|
| M1 · Implement current schema and code | Update current `db.sql`, marker/seed/bootstrap, BFF models/services/routes and frontend contracts/callers; remove superseded persistence assumptions | One intended schema and code version; no migration journal, dual read/write or old-client support layer |
| M2 · Apply scoped schema changes | Identify the target, verify a private backup, rehearse the exact upgrade in an isolated copy, preserve existing rows, and apply only required changes | Exact schema/seed verification succeeds and retained-data checks pass |
| M3 · Smoke and clean up | Run the three lean checks in [12](12_validation_and_acceptance.md#database-migration-and-cleanup-acceptance); remove applicable CL leftovers and update status | Fresh fixtures can be edited/reopened and the obsolete writer/code path is gone |

A small reviewed upgrade script or documented sequence is sufficient; a production rollout program and old-worker matrix are unnecessary. Keep the exact schema check and private backup. If installation fails, repair the scoped change without resetting the database. Returning to an older commit does not authorize discarding content.

The installed D2 schema does not require completing D3–D6. Add storage through scoped changes as each feature is implemented, then run the relevant preservation and smoke checks.

## Database, code and feature cleanup register

**Status, 2026-10-18 (evidence in [14](14_status_and_roadmap.md#roadmap-and-dependencies), M3 and CL rows):** for D1–D2, CL-01/02 (superseded body writers, tables and status-only accept routes), CL-03 (ordered saves and revision checks instead of `updatedAt` merges), CL-05 (canonical scene JSON instead of Markdown round trips, stable offsets and mention IDs) and CL-07 (obsolete goal/draft keys) are done; CL-06's reusable stash exists since D4 (R11), but the old generation `stashed` status is still a live write path (`POST …/generations/{id}/stash`, used by the assistant's *Stash* button), so two stash paths remain (audit 2026-10-18). **Still open:** CL-06 (retire one stash path), CL-04 (inline AI still compiles its own context and accepts through its own path, apart from the assistant), CL-08 (feature exposure now follows per-plan grants; dead controls and exports not yet audited), CL-09 (story persistence still lives in `models.py`; obsolete migration scaffolding remains) and CL-10 (ongoing). Later-phase writers in CL-01/02 are retired as each replacement lands. Keep this as a removal inventory, not a separate test program or production rollout checklist. Named owners/dates remain TBD.

| ID / phase | Concrete cleanup |
|---|---|
| CL-01 · D1–D2 | Remove superseded novel body/cache columns through scoped changes; retain unrelated rows and target grouping tables. Update lifecycle/wipe/artifact handling for new data |
| CL-02 · D1–D3 | Remove old unguarded mutation and status-only accept routes/callers; use the current revision-aware services |
| CL-03 · D1–D2 | Replace overlapping saves, `updatedAt` merges and full-story refetch ownership with revision-aware controllers and smaller DTOs; keep workspace/auth guards |
| CL-04 · D1–D3 | Unify inline/chat acceptance/context; remove implicit Tab/unrelated-edit acceptance and duplicate body/status commits; retain all seven commands |
| CL-05 · D2–D3 | Remove canonical Markdown round trips, first-match selection offsets, name-only mention persistence and annotation-inclusive prose counts; retain useful import/export code |
| CL-06 · D2–D4 | Replace chapter-only Codex/context assumptions and `stashed` status as a snippet store with scoped refs and proper reusable stash |
| CL-07 · D1–D2 | Clear known obsolete project browser fixtures and remove legacy goal/draft key migration code; create the current local-storage format directly |
| CL-08 · D2–D3 | Update rail/gallery/editor routes, assistant history/profile filters and feature flags to the target contracts; remove dead controls and exports |
| CL-09 · D1–D3 | Extract the story persistence domain, remove superseded serializers/validators/graphs/adapters and obsolete novel migration scaffolding. Re-export duplicated novel `lorebookEntrySnapshot`/`clonedEntryIds` from shared Codex utilities; retain novel trigger fallback. Apply the reuse map before adding parallel infrastructure; keep unrelated voice/workspace code out of this refactor |
| CL-10 · Each phase | Update the relevant tests/stories/i18n/docs and small fixtures to current behavior. Delete fixtures/tests whose sole purpose is retired rollout/backfill compatibility; keep meaningful product regressions |

Do not delete the full feature catalog or working author jobs merely to remove their old implementation. Existing sample data, legacy readers and conversion-only adapters are not product capabilities that must be preserved.

### Feature preservation and replacement proof

| Family | Target behavior to keep |
|---|---|
| Gallery/create/write/metadata/goals | Create and reopen a fresh novel, edit prose and metadata, use chapter goals without multiplying them across scenes |
| Inline AI/review/history | Seven commands, deliberate acceptance/rejection, undo/redo and new-request replay/provenance through the common pipeline |
| Codex/context/structure | Scoped stable refs/pins, canonical context, safe scene operations and ordinary product trash/restore |
| D4–D6 planned capabilities | Retain catalog commitments and implement when their phase arrives; the DB reset neither removes nor delivers them |

## Completion and evidence limits

For scoped schema changes, use the three lean DEV checks in [12](12_validation_and_acceptance.md#database-migration-and-cleanup-acceptance), the applicable cleanup inventory, and normal focused checks for code actually changed. Run `pnpm build` after frontend application implementation; a documentation-only edit needs link/consistency validation, not another frontend/backend suite run.

No backfill corpus, old-client/browser migration matrix, repeated migration stress tests, multi-version rollout, observation window, retention sign-off or production acceptance exercise is required. A verified backup, isolated rehearsal and preservation checks are required for schema changes. Runtime prose integrity, ownership, schema validation and AI commit correctness remain in their feature contracts. Current implementation status stays in [14](14_status_and_roadmap.md#migration-and-cleanup-tracking).


## Execution checkpoint — 2026-10-16

**Historical reset evidence only. The preservation rule above supersedes the earlier approval; these commands must not be repeated.**

D1 installed schema marker `2026_10_novel_revisions` with 103 tables / 145 foreign
keys. After direct approval, `scripts/reset_development_database.py --apply`
rebuilt only `magic_worlds` on `192.168.1.90:3306`, installed current seeds and
passed exact verification. The API restarted healthy. The provider-free
`scripts/smoke_novel_persistence.py` then passed fresh save/reopen, receipt replay,
concurrent CAS rejection, immutable checkpoint restore and atomic acceptance
replay through revision 5, including the transaction-level workspace lock.

This fulfills the D1 reset/smoke slice. D2 scene schema, structure history and
chapter-writer retirement remain open. See [14](14_status_and_roadmap.md) for the
current register and [16](16_document_and_structure_decision.md) for the accepted
D2 document contract. No production deployment or full feature completion is claimed.


## Scene schema execution checkpoint — 2026-10-16

**Historical reset evidence only; whole-database resets are now disabled.**

Within the user's explicit project-only reset authorization, the development DB
was rebuilt with `2026_10_novel_scenes` (106 tables / 151 foreign keys). Exact
verification, API restart/health and the provider-free scene/structure smoke
passed. The D1 chapter-body writer/revision/receipt tables and obsolete callers
were removed. Scene document, metadata, structure and context revisions now have
separate authorities. This is the current storage slice; the earlier D1 marker
above is historical. Later assistant/memory/portability/series tables and all
remaining feature gates stay in scope. Current delivery evidence is in [14](14_status_and_roadmap.md#d2-scene-integration--2026-10-16).

## Non-novel content recovery — 2026-10-16

The full database reset was broader than necessary for novel schema work. It
removed unrelated project content. The user required recovery of all non-novel
content; the former blanket reset policy is superseded by the preservation rule
at the start of this document.

The private `fish-calls-pre-20261015T154013Z.sql.gz` backup passed its recorded
SHA-256 check. An isolated restore reproduced its 101 tables / 3,269 rows.
MySQL retained full row-image binary logs. Strict, checksum-verified replay of
only `magic_worlds` events rebuilt the state immediately before the first reset
at **2026-10-16 06:45:47 UTC**, stopping before `binlog.000166` position
**572329275**. All replay events were rewritten to a new isolated recovery
database; no reset statement was replayed. The first project event after the
backup was at 15:42:35 UTC, after that backup completed, so strict replay had no
snapshot overlap or suppressed duplicate-key errors.

A separate clone of the current scene-schema database then rehearsed the merge.
Recovered users were matched by immutable account hash, retaining current user
IDs and remapping recovered ownership references consistently, including the
assistant snapshots and voice audit payloads that contain numeric user IDs.
This avoided assigning recovered content to synthetic novel test users whose
numeric IDs had been reused after the reset.

The live transaction completed at **09:54:13 UTC**. It verified **3,885 recovered
rows across 96 non-novel tables**: 3,830 inserted, 41 updated and 14 already
identical. Current additional records remained. All 151 foreign-key checks
passed with enforcement enabled. Every current `story_*` row was verified
unchanged; old novel tables/rows and the old schema marker were excluded. The
installed `2026_10_novel_scenes` marker, exact schema check and API health passed.

Recovered content includes 43 cards, 60 adventure/character conversations with
257 messages, 11 assistant conversations with 23 messages, 50 catalog voices,
98 image records, 58 narration records, 5 theme-song records, profiles, lorebooks,
membership/credit records, preferences and workspace ownership. Files were not
changed. The user confirmed that some media records normally have no file.

Private pre-recovery backup:
`magic-worlds-api/.dev/backups/before-non-novel-recovery-20261016T094523Z.sql.gz`.
Private result manifest:
`magic-worlds-api/.dev/backups/non-novel-recovery-result-20261016T095413Z.json`.
The reset utility now rejects `--apply` before reading configuration or opening
a connection; startup diagnostics no longer instruct a project-wide reset.
These operational recovery checks do not close remaining D2–D6 feature gates.
