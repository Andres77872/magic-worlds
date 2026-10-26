# 06 — Refactor plan: per-domain upgrades in maintenance windows

**Revised 2026-10-25.** This replaces the 2026-10-24 plan (Phases 0–4, strategy A "v2 rebuild + ETL").

**What changed:**
- **Downtime is allowed.** Each upgrade runs while the API is stopped, so the online-change machinery is no longer needed:
  - no dual writes;
  - no `SCHEMA_VERIFY=warn`;
  - no forward-only runner with `ALGORITHM=`/`LOCK=` assertions;
  - no `schema_migration` history table.
- **The target was re-checked against the code.** Six domain reviews read backend HEAD `c056d82`. Several 05 merges turned out to lose guarantees or cost weeks for little gain; they are deferred (§4).
- **Strategy (D-6, resolved): per-domain in-place upgrades.**
  - The main reason for a v2 rebuild was the scope key (C1) and ID (C2) change across 67 tables. Both are now deferred or dropped.
  - Without them, each domain ships as its own reviewed upgrade, in its own short window.
  - The scripts compose: several releases can run back to back in one window if one outage is preferred (D-11).

**Goal:** finish the optimization refactor quickly, with three things proven at every release:
1. **Validations.** Every DB constraint and app validator that guards a feature still holds.
2. **Integration.** The BFF matches the schema, and the SPA still works against the BFF.
3. **Usage.** No dead tables, columns or indexes, and the hot queries use fitting indexes.

Paths are in `magic-worlds-api/` unless they start with `magic-worlds/`. Sizes: **d** = engineer-days, one engineer, tests included.

## 1. Principles

- **Features first.** The capabilities in [04](04_feature_preservation_matrix.md) must keep working. Response shapes stay identical unless a release lists the difference.
- **One release = one domain = one upgrade script.** It ships together with its `db.sql`, `CONTENT_SCHEMA_REVISION` bump, code and tests. This is the process `docs/database.md` already prescribes: a reviewed, scoped upgrade with writers stopped and a verified backup.
- **The strict verifier stays.** It is the proof that the live database matches the code. Boot still refuses any drift.
- **Keep every CHECK and FK unless a release replaces it with an equal or stronger one.** ETL and scripts bypass the app validators, so the database is the last guard.
- **Validate before and after.** Each release is recorded on the previous code and schema, then compared on the new ones (§3).
- **Rollback = restore.** MySQL DDL is not transactional, so a failed upgrade is not resumed. Restore the pre-window backup and start the previous image.

## 2. Where things stand at `c056d82`

Since the audit snapshot (`f7229af`), two backend commits landed:
- `fceaead`: UTC sessions, pool bounds, read-first identity, provider downloads outside row locks, payload redaction on wipe, smoke isolation.
- `c056d82`: removed the whole historical migration chain and its tooling.

Live status is in [07](07_phase0_closeout.md), from read-only queries on `.90` on 2026-10-25:
- **HEAD is not deployed.** The API on `.90` predates `fceaead`: the `tb_user` upsert digest and `AUTO_INCREMENT` are still growing. Every "done in code" item below is unverified live until the redeploy.
- **The smoke-isolation work in 33 `scripts/smoke_novel_*` files is uncommitted.**

The tables below give the old steps' dispositions. 07 tracks what R0 still needs and the backend test baseline. That baseline is red before any release: 661 failing tests and 2 hanging test files, all from before the audit, block R0.4.

### Old Phase 0

| Step | Status | Notes |
|---|---|---|
| 0.2 Backups + restore drill | **Open** | Required before the first window. Moves to R0. |
| 0.3 Slow log, deadlock log | Open | Server config. Moves to R0. |
| 0.4 UTC on every connection | **Done** | `init_command` (`src/runtime_config.py:496,541`); no `SET time_zone` left. Gap: test harness pools bypass it (G2). |
| 0.5 Pool bounds | Partial | `maxsize` 10, `pool_recycle`, `connect_timeout`, 30 s acquire timeout (`src/database/mysql/connection.py:24-27,206`). No separate background pool. |
| 0.6 Read-first identity | **Done in code** | `models.py:5675-5695`. Live check after the redeploy: the upsert digest and `AUTO_INCREMENT` stay flat (07). |
| 0.7 No provider download under `FOR UPDATE` | **Done** | `mirroring` claim committed first (`image_generation/engine.py:1147-1250`, `theme_song_generation/engine.py:667-714`) |
| 0.8 Account wipe | Partial | `frozen_payload`/`result` redacted. Still open: `effective_config`, 8 unhandled tables, media files on disk. Moves to R4. |
| 0.9 Smoke isolation | **Done for novel smokes** | Synthetic database names only (`scripts/novel_smoke_database.py:26,127`). The Redis-namespace follow-up is uncommitted; commit it in R0. |
| 0.10 Drop stale schemas | **Done (live)** | 0 `mw_*` schemas and 0 `magic_worlds_*` copies remain (07). They were dumped first to `.dev/backups/stale-magic-worlds-copies-20261024.sql.gz`, which holds user data on the laptop. Delete it once R0.1 exists (**destructive: explicit approval**). |
| 0.11 MySQL 8.4 LTS | Open | Compose still uses `mysql:8` (`docker-compose.yml:280`); `.90` runs 8.1.0. Moves to R0. |

### Old Phase 1 ("make the schema safe to change")

| Step | Disposition |
|---|---|
| 1.1 `schema_migration` table | **Dropped.** The revision marker plus the strict verifier already gate boot. Each window's backup sha and parity report go in the release record (outside source control). |
| 1.2 Verifier warn mode | **Dropped.** With windows allowed, an index ships as an upgrade; it is never hot-patched. |
| 1.3 Forward-only runner | **Replaced** by the small upgrade-script contract in §3.2 (~1 d). |
| 1.4 Migration code out of `src/` | **Done** in `c056d82`. Left: rename `voice_legacy_models.py` (R1). |
| 1.5 Erasure classification test | **Kept**, in R4. |
| 1.6 Retention janitor | **Kept**, in R6, limited to FK-safe leaf tables. Corrected: `tb_operation_reservation` cannot be deleted. It is an FK parent (`db.sql:3045,3066,3101`) and the only refund link. |
| 1.7 Deadlock/lock-wait retry | **Deferred.** `transaction_cursor` is an `@asynccontextmanager` (`connection.py:253`) and cannot re-run its body. A per-request `SET innodb_lock_wait_timeout` would bring back the pooled-session leak. If needed later: one pool-wide value in `init_command`, plus a callable retry like `voice_access._with_deadlock_retry`. |
| 1.8 Media on chat delete (D-4) | **Kept**, in R4. |
| 1.9 Stale SPA prefixes; D-1, D-2 | **Kept**: prefixes and D-1 in R1, D-2 in R6. |

## 3. Validation framework

No CI exists in either repo. All 33 DB-backed backend test files skip unless `LLM_PROFILE_TEST_MYSQL_SOCKET` (or `NOVEL_STORY_TEST_MYSQL_CONFIG`) is set (`tests/integration/test_llm_profile_database.py:20-22`). The default `pytest` run therefore proves nothing about SQL. Most model tests assert SQL text against a fake cursor, so they break on a rewrite but cannot show it is correct. **Build the gates first (R0); every release must pass all of them.**

### 3.1 Gates

| Gate | What it proves | How |
|---|---|---|
| **G1 Schema contract** | `db.sql` is valid and matches the code's contract | Load `db.sql` into an empty MySQL 8.4 database. `verify_mysql_schema` passes. `tests/test_schema_bootstrap.py` pins are updated: table count (`:265,1187,1194,1201`), revision literal (`:651`), CHECK pins (`:1571-1592`, `:1767-1781`), charset/FK-type equality (`:1974-2008`). |
| **G2 DB tests always run** | SQL works against a real server | A pinned `mysql:8.4.x` test service with the env vars set. `REQUIRE_DB_TESTS=1` turns "missing socket" skips into failures. The harness pools go through `load_mysql_config`, which adds the UTC `init_command`. Today `tests/integration/test_llm_profile_database.py:33`, `test_membership_feature_mysql.py:38` and `scripts/novel_smoke_database.py:133-159` bypass it. Run once with a non-UTC server `time_zone`. Also run the 32 `scripts/smoke_novel_*.py` and the billing probes in `magic-worlds/docs/billing/plan-audit-2026-10-17/test_accounting_findings.py`. |
| **G3 Golden API scenarios** | The BFF behaves the same, so the SPA keeps working | An `httpx.ASGITransport` harness on an isolated database, the same pattern as the novel smokes, with provider fakes from `tests/fakes`. There is one scenario per row group in 04 §1–14, including replay, quotas and refunds, and archive/trash. Responses are stored as canonical JSON: sorted keys, ids and timestamps replaced by stable placeholders. MySQL JSON re-sorts object keys, so story replays are canonical-equal, not byte-equal. Recorded on release N-1, compared on release N. Allowed differences are listed per release; the target is none. Two probe suites: **cross-tenant** (another scope's ids give 404 on every id-bearing route) and **erasure** (after a wipe, each table holds what its C8 class says). |
| **G4 Dry run on a production copy** | The upgrade transforms real data correctly | Restore the latest backup into a scratch schema on the target server and run the script with `--dry-run`. Post-checks: per moved table, row count plus a hash of the business columns through the mapping; an orphan scan for every FK the release touches; seed reconciliation (custom plans, root-managed `voice_runtime_setting` values, `cat_llm_feature` = registry); the release's domain checks (§5); then `verify_mysql_schema`. |
| **G5 Usage report** | No dead schema, and the hot queries are indexed | **Runtime:** after G3 on the test server, read `sys.schema_unused_indexes` (allow-list FK-support and composite-FK parent indexes), `sys.statements_with_full_table_scans` (allow-list tiny lookup tables) and `performance_schema.table_io_waits_summary_by_table` (a table never read or never written is dead). EXPLAIN pins for the tasks drawer, library list, sweepers and usage lookups. **Static:** a test that every table and column named in SQL under `src/` exists in `db.sql`, and every `db.sql` table and column is used in `src/` or allow-listed. |
| **G6 API read parity on the copy** | Real users see the same data | For each real account, a fixed set of GETs before and after the dry run, compared as canonical JSON: `/user/me`, plan summary, `/llm/capacity-usage`, library, collections, sessions, messages, `/tasks`, studio index, scene, history, snapshots, search, reader, erase preview, writing progress. Same allow-list as G3. |
| **G7 SPA** | The frontend builds and talks to the BFF | `pnpm test`, `pnpm build` (the real green signal), `pnpm lint` (pre-existing React Compiler errors are not caused by this work). For every release, a browser smoke of the screens it touches, against the dev BFF on the upgraded copy. The SPA contract tests mock `fetch`, so G3 is what actually covers integration. |
| **G8 In-window checks** | The live upgrade succeeded | Drain query = 0, backup sha recorded, script post-checks green, verifier green, `/ready` 200, protected `/user/me`, a G3 smoke subset on a dedicated test account, then a wipe of that account. |

Provide one entry point, for example `scripts/verify_release.sh` in the BFF. It runs G1, G2, G3 and G5, plus `pnpm test && pnpm build` in the SPA. Hook it into CI when CI exists.

### 3.2 Upgrade-script contract

This replaces the deleted tooling and the old 1.3 runner. It lives in `scripts/upgrades/NNN_<name>.py`, outside `src/` (ACC-02).

- **Declares** a `FROM` revision and a `TO` revision.
- **`preflight`:**
  - the marker equals `FROM`;
  - the drain query returns 0 (§6 step 3);
  - the release's data preconditions hold, for example "no id collisions" or "receipt rebuild equals stored ack".
  - It refuses with a list of offending rows otherwise.
- **`apply`:** DDL plus data moves (`INSERT … SELECT` or Python), with `FOREIGN_KEY_CHECKS` on, so violations surface instead of being skipped. Load in FK order. If a column must be backfilled after the insert, set `updated_at = updated_at` explicitly, because 60 columns are `ON UPDATE CURRENT_TIMESTAMP`. Reset `AUTO_INCREMENT` to `MAX+1` where ids are copied.
- **`postcheck`:** the G4 checks. Then write the `TO` marker last, then run `verify_mysql_schema`.
- **Modes:**
  - `--dry-run` (default) runs against a scratch restore;
  - `--apply` requires `--backup-sha`.
- **Output:** a JSON report kept outside the repository (`docs/database.md` rule).

Releases run in order, each checking its `FROM` marker, so bundling several into one window is just running them in sequence.

## 4. What this plan does not do (deferred from 05)

| 05 proposal | Decision | Why (evidence) |
|---|---|---|
| **C1** `account_scope.scope_id` | **Deferred** | 350 `project_hash=%s` + 313 `user_group_hash=%s` predicates, 237 triple column lists, 134 `resolve_app_scope` calls, 904 test references: about 3–4 weeks. It also does not fit the data: 12 LLM/image tables have no group hash (`tb_llm_project_state` PK = `project_hash`, `db.sql:2726`), global rows use an empty triple (`user_notification`, `db.sql:205-225`), the default-workspace pointer becomes circular, and legal-kept `user_attestation` uses the triple PK. At ~152K rows the index savings are negligible. Revisit with ACC-01. |
| **C2** `CHAR(36) ascii` for every id, UUIDv7 | **Dropped** | Many ids are not UUIDs: `usr-{uuid}` (`auth_adapter.py:161`), `vk_`+hex, `pd_`/`pv_`, `vsa_`, 32-hex event and attempt ids, client opaque ids (`models.py:359`), resource-task ids that are an `X-Request-Id` or a sha256 (`routes/lorebooks.py:468`). UUIDv7 fails `db.sql:2668,2691` (`[1-5]`) and is not in Python 3.12 (`Dockerfile:32`). |
| C2 `user_id`/`adventure_id` → `BIGINT UNSIGNED` | **Deferred** | Not urgent now that PERF-01 is fixed (235K of 2.1 B used). In place it means dropping and re-adding 89 FKs on 111 columns, plus fixing the validators capped at 2^31-1 (`voice_catalog_models.py:54`, `voice_safety_models.py:40`, `voice_preview_models.py:39`). |
| **C3** `DATETIME(3)`, `UTC_TIMESTAMP` everywhere | **Deferred** | The UTC problem is already solved by `init_command`. The verifier parser rejects `CURRENT_TIMESTAMP(3)` (`bootstrap.py:382,397,665,684`), snapshot code relies on second precision (`story_scene_store.py:47-51`), and 96 `.isoformat()` outputs and 61 test files would change. |
| **C4** lookup tables | **Dropped** | The verifier exact-matches seeds (`bootstrap.py:1775-1783`), so a new operation still needs a schema release. |
| **C5** remove business CHECKs | **Dropped** | Keep all 309. The app copies exist only at HTTP entry points; ETL and scripts bypass them. |
| **C9** renames | **Deferred** | 501 references to the 36 `tb_`/`cat_` tables; the SPA reads `adventure_created_at`/`adventure_last_update` (`DataProvider.tsx:231-257`). Merged tables keep the surviving table's name. |
| `job` + `job_image` + `job_tts` | **Dropped** | ~83 statements and their lock semantics: the TTS reuse lookup and in-flight `FOR UPDATE` range locks would become locking joins (`models.py:10364-10470`). Resource-task ids need `varchar(64)` with an owner-scoped PK (`db.sql:3132`). `story_export_job` has its own state machine and must cascade from the novel. R3 delivers the user-facing gain (one drawer query) without it. |
| `media_asset` | **Optional** (R3b) | MySQL forbids CHECKs on columns used in FK referential actions, so "kind = tts ⇒ job set" stops being DB-enforced. The real-FK gain is for `tb_workspace_media` only. |
| `llm_execution` merge (card generation, assistant turn, novel terminal) | **Dropped** | The children are clean 1:1 tables already. `tb_llm_assistant_turn` cascades from its conversation (`db.sql:3067`), which a composite `SET NULL` with NOT NULL scope columns cannot express. The novel stop fence can exist before any execution (`novel_assistant_control_store.py:12-28`). |
| Agent graph stored by reference | **Dropped** | The stored `agt` is the file graph plus bound role settings plus per-call metadata (`symbolic_workflows.py:36-70`, `conversation_execution.py:136-139`). `graph_hash` is re-verified on replay (`llm_execution_admission.py:204,277`). |
| Payload TTL that deletes | **Dropped** | About 17 readers: replay, retry (reuses the parent payload, `:527`), recovery, story history. Expiry must write the erased marker in place (`story_erasure.py:46-60`). |
| Defaults merge (6 → 2) | **Deferred** | LLM resolution never falls through; image resolution does (`llm_profile_resolution.py:56-73` vs `image_profile_models.py:290-309`). Archive rules differ, and the FKs would need MATCH SIMPLE. 4 rows. |
| `reservation`, `usage_day`, `credit_ledger`, `credit_grant` merges | **Deferred: billing tables stay** | `membership_credit_ledger` rows are mutated in place (`models.py:3490,3715`). A PAYG spend writes a row in both ledgers (merging double-counts). There are 5 ledger-link styles, not 3. The voice reservation lifecycle is row presence (`quota.py:429-433`). Voice quota is per scope; the admin overview groups by `plan_code`. |
| `idempotency_receipt` | **Dropped** | The copy receipt needs `intent_hash` conflict detection and no expiry (`workspace_copy.py:150-155`). Story receipts are per-story domain records (§5 R2). `tb_operation_receipt` is not a receipt (R5). |
| `voice_quota_capacity` → settings row; `voice_call_metrics` → `voice_session` | **Kept as tables** | The capacity row is the lock anchor and has a seed check (`quota.py:736-742`, `bootstrap.py:1797-1808`). Metrics are fire-and-forget, feature-flagged telemetry; a TTL should delete rows, not null columns. |
| Story compression, structure deltas, snapshot tables, `story_media_ref`, pins, batched erase, blobs to the media store | **Deferred** (story backlog, ~12 d) | Not needed for the main byte win. Pruning needs pins and decision D-7 first. |

## 5. Releases

Recommended order: **R0 → R1 → R2 → R4 → R3 → R5 → R6.**
- Story (R2) is the growth problem.
- Erasure (R4) must be right before real users arrive.
- Cards and workspace (R5) has the lowest value and can be cut.

Code for later releases can be written in parallel branches. Windows ship in order, because each script checks its `FROM` marker.

### R0 — Groundwork (no schema change) · 6–8 d

| Step | Done when |
|---|---|
| R0.1 Nightly `mysqldump --single-transaction` plus a tar of the image, theme-song and TTS roots, taken together (`docs/operations.md`), stored off-host and encrypted. A restore drill into a scratch instance. | The restored copy passes `verify_mysql_schema` and a row-count diff. The runbook is in BFF `docs/database.md`. |
| R0.2 **D-8:** a dedicated MySQL 8.4 LTS instance for the stack: buffer pool ≥ 1 GB, `max_connections` sized to the pools, `default-time-zone='+00:00'`, `slow_query_log` at 0.2 s, `innodb_print_all_deadlocks=ON`, `binlog_transaction_compression=ON`. Move `magic_worlds` by dump/restore in a window. Pin `mysql:8.4.x` in compose and in the test service. | The verifier passes on 8.4 (its text normalization is version-sensitive, OPS-04), and row counts are equal. |
| R0.3 Commit the open smoke-isolation work. **Redeploy the API on `.90` from HEAD.** | The `tb_user` upsert digest and `AUTO_INCREMENT` stay flat under normal traffic (PERF-01 live check, 07). Every later release starts from a deployed HEAD. |
| R0.4 Gates G1–G8 and `scripts/verify_release.sh`. | All gates are green on the current schema. That run is the baseline. |
| R0.5 Upgrade-script template (§3.2). | R1's script dry-runs through it. |

### R1 — Indexes, FKs and hygiene (additive; small SQL rewrites) · 3–4 d

**Indexes:**
- Sweepers:
  - `voice_session`: write `last_heartbeat_at` at insert, make the orphan predicate sargable, and add `(status, last_heartbeat_at)` plus `(started_at)` for the admin aggregates (`models.py:7005-7009,7180-7192`; `speech/metrics.py:899,935`).
  - Media sweeps: one index per predicate, checked with EXPLAIN in G5 (image `models.py:8162-8195`, theme `:9336-9392`, TTS `:10492-10533`).
- Workspace list indexes that end in `updated_at` (`db.sql:758,917,3142`) are rebuilt to end in `created_at`, which is what every list sorts on.
- `voice_catalog_event (event_type, created_at)`.
- `user_notification (user_id, dismissed_at, created_at)`. Today's inbox index does not fit the `(project_hash = '' OR …)` predicate (`models.py:1267-1290`).

**JSON predicates (PERF-06):**
- A multi-valued index on `adventure_session.character_ids_snapshot`, with the predicate rewritten to `%s MEMBER OF(character_ids_snapshot)` (`models.py:11060,11082`). `:14172` ORs a `JSON_SEARCH`; split it into a UNION or leave it.
- Stored generated columns plus an index for `result.$.resource_id` / `$.lorebook_id` on `tb_llm_execution_plan` (`lorebook_extraction_records.py:84-91`) and for the job reference in `voice_catalog_event` (`voice_catalog_models.py:1782`).

**FKs:**
- `voice_key` → `voice_catalog` on `voice_catalog_language`, `_acceptance`, `_event` (nullable), `voice_default`, `voice_sample_asset` and `voice_preset`.
- Not on `voice_reference`: it is a derived table of regex-collected keys, rebuilt nightly (`speech/voice_references.py:64-76`), and an FK there would take shared locks during card saves.
- The preflight requires 0 orphans.

**Dead schema (each item confirmed by G5 before the drop):**
- Indexes:
  - `idx_tb_card_user`, `idx_tb_card_scope`, `uq_tb_card_scoped_type_identity`;
  - `idx_adventure_session_user`, `idx_adventure_session_template`, `idx_adventure_message_stream`;
  - the assistant `kind`/`active`/`role`/`owner` indexes;
  - `uq_lorebook_resource_scoped_identity`, `idx_lorebook_name`, `idx_lorebook_resource_title`, `idx_lorebook_resource_hash`;
  - `idx_user_notification_source`;
  - `idx_*_asset_deleted`, `idx_workspace_media_asset`, `idx_tts_job_quota`;
  - `idx_voice_segment_messages`, `idx_llm_execution_profile`, `idx_email_credit_grant_status`/`_email_message`.
- **Keep** the FK-support indexes (`fk_workspace_scope_default`, `idx_llm_assistant_execution_scope`, `idx_lorebook_resource_link_book_workspace`, `idx_content_operation_context_scope`) and the composite-FK parents (`uq_llm_execution_scope`, `uq_operation_reservation_scope`).

**Decision D-1** (recommended: drop): drop `voice_consent_record` and `voice_catalog.consent_record_id`, and replace `chk_voice_catalog_ivc_consent` with `source_kind <> 'ivc'`. `ivc` rows are refused everywhere (`voice_catalog_models.py:284-285`, `catalog/admin.py:723-724`).

**Code-only fixes:**
- Rename `voice_legacy_models.py` (5 importers).
- `/tasks?operation=pdf_import` is gated on the `lorebook_extraction` flag and returns nothing (`routes/tasks.py:101`).
- Remove the dead `INFORMATION_SCHEMA` branch in the wipe (`models.py:6203`).
- Remove `/generated-images/` and `/generated-audio/` from `magic-worlds/src/infrastructure/api/mediaUrl.ts:6-7` (preflight: no stored row contains them).

**Gate focus:** G5 EXPLAIN pins; G3 unchanged; G4 orphan scan for the new FKs.

### R2 — Story Studio (25 → 24 tables) · 11–14 d

This release cuts the bytes appended per autosave from about 4.65 × text to about 1.4 × text. It also removes the 31 MB term table and the duplicate document copy.

| Change | Detail | Days |
|---|---|---:|
| **Pointer receipts** for the three prose kinds: scene write (including AI and variant accept), changeset accept, changeset undo | The receipt stores the header fields, `statistics` (ICU-dependent, not recomputable) and, per scene, `id`, `revision`, `contentHash`, `baseRevision`. On replay, `document`, `body` and `plainText` are rebuilt from the hash-checked revision. One `decode_ack` helper serves `_receipt` (`story_scene_store.py:157-164`) and `_changeset` (`story_generation_changeset_store.py:63-67`). The upgrade converts a receipt only where the rebuild equals the stored ack; the others stay inline. **No receipt TTL:** receipts are domain records (changeset undo, replace undo/redo, stop fences, lost-response results). | 2 |
| **Drop `story_scene.document_json`** | Read the current document by joining `story_scene_revision` on `(scene_id, revision)`, and raise if it is missing. Every revision-bumping write already checkpoints (10 call sites: creation, import, copy, package, revision restore, changeset, snapshot restore, replace, and two in the scene store). Move `chk_story_scene_document` onto the revision table; first count legacy `schemaVersion ≠ 1` rows. Move `plain_text` to `story_scene_text(scene_id PK, revision, plain_text)`. | 2.5 |
| **Statistics as typed columns** on `story_scene` and `story_novel` | Filled by the existing aggregate SQL, so they are exact by construction. Keep the "NULL word count ⇒ NULL bucket" rule (`story_statistics_store.py:40-41`). Drop `story_scene_statistics` and `story_novel_statistics`. The library word sort becomes indexable. | 1.5 |
| **Drop `story_scene_term`** | Ranking is a pure function of the candidates' prose (`services/story_retrieval.py:10-13,90-120`), and stale scenes are already scored from prose (`story_retrieval_store.py:41-46`). Migrate no term rows: a cold cache gives the same ranking. Optional: a compact per-scene vector in `story_scene_retrieval`. | 1 |
| **Novel terminal receipt table** | Keyed by `operation_id`, with a cascading story FK. The admission lookup gets an index (today it filters by `request_id` with none, `llm_novel_terminal_receipt.py:38-41`). The erase preview keeps counting it. The `assistant-stop:` fence stays in `story_operation_receipt`. | 1 |
| **Small fixes** | `story_scene_revision` gains `story_id`, `schema_version` (replaces `JSON_EXTRACT` at `story_revision_store.py:54`) and `byte_size`. FK `story_plan_item → story_scene`. A scoped title index replaces `idx_story_novel_title`. `story_generation(story_id, scene_id, created_at)` replaces `idx_story_generation_chapter_created`. A stored generated `op` column plus `(story_id, op, revision)` on `story_structure_revision` (`story_snapshot_store.py:82,93`). | 1 |
| Upgrade script, story parity, dry runs | See below | 4.5 |

**Kept unchanged:** `story_operation_receipt` (key `(story_id, request_id)`, durable records, erase preview), `story_export_job` + chunks, the `story_import_source` blob, `story_annotation_head`, assistant preference and preset.

**Story parity, in G4 and G6:**
1. Row counts.
2. Per scene: the document at the current revision equals v1 `document_json`; the digest equals `content_hash`; the text equals `plain_text`.
3. Per revision: metadata equal, digest = `content_hash`, `schema_version` = the JSON value.
4. Per receipt: `intent_hash` equal, and a replay through the real `_receipt`/`_changeset` equals the parsed v1 ack.
5. Statistics equal where v1 was fresh, plus `scripts/smoke_novel_statistics.py:29-44`.
6. API snapshots per novel: studio index (including `sourceVersion`), scenes, revision pages, structure history, snapshots, library in every sort, fixed searches, reader, erase preview, writing progress.
7. 20 fixed assistant queries, cold v2 cache against warm v1.
8. A restore round trip on a sample of revisions.

**Tests to add:**
- replay of a scene write and of a changeset accept after later edits;
- a clear error when the current revision row is missing;
- a NULL word count (no ICU) with the new columns and the word sort;
- the terminal lookup by `operation_id`, and erase with terminal receipts present.

### R3 — Jobs and the tasks drawer (smaller cut) · 4–5 d (+2.5–3 d with R3b)

**Changes:**
- Keep `image_job`, `tts_job`, `theme_song_job` and `story_export_job` as they are (§4).
- Add `archived_at` to `image_job` and `tts_job`. The upgrade sets it from the `resource_task` archive markers (`image_generation`/`text_to_speech` rows, same owner and workspace) and deletes the markers. Narrow the `resource_task` CHECKs to `pdf_import`/`lorebook_extraction` with target types `resource`/`lorebook` (`db.sql:3134-3136`).
- `/tasks` becomes one `UNION ALL` over the four sources with `(owner, workspace, archived_at, created_at, id)` indexes, using batched asset lookups (`list_for_jobs`, `models.py:8969`) and batched session lookups (`media_tasks.py:57-68,96-100`). Keep the `task_from_*` builders and the TTS status mapping (`models/task.py:113-116`, `media_tasks.py:77-81`) so the wire shape (`models/task.py:50-77`) is identical. Today the SPA calls this 3× per poll (`BackgroundTasksProvider.tsx:146-169`).
- Batch the N+1 sites at `models.py:8255,8407,9421,9516,10347`.
- **Dead schema:**
  - values: `image_job.operation 'image_edit'`, `theme_song_job.source 'chat_theme_song_prompt'`, the `provider 'minimax'` default;
  - columns: `image_job.last_webhook_body_sha256` (written, never read);
  - code: `TtsAssetModel.mark_deleted`.
- **R3b (optional):**
  - one `media_asset` (kind plus per-kind CHECKs, owner columns, ids preserved; all three are `uuid4`, and the preflight asserts no collision);
  - a composite FK `tb_workspace_media(asset_id, media_kind) → media_asset(asset_id, kind)`;
  - every query filters on `kind`.
  - Keep the three storage roots, because relative paths collide across kinds.
  - Without R3b, G4 gets an orphan check for `tb_workspace_media` instead.

**Validations to keep:** every lifecycle, identity and provider CHECK on the job and asset tables (`db.sql:725-751,905,1078`), `uq_image_job_provider_request`, the asset → job FKs and their SET NULL/CASCADE rules, and `_required_asset_parent_job` / `_validate_job_asset_ownership` (`models.py:799-863`).

**Tests:**
- a real-DB golden `/tasks` test across the four kinds (status mapping, archive, pagination, gating);
- CHECK-violation tests per lifecycle;
- rewrite the SQL-text tests `tests/routes/test_tasks_routes.py`, `services/test_media_tasks.py`, `services/test_resource_tasks.py`;
- with R3b, a cross-kind route test (an image route must not serve an audio id).

### R4 — Erasure, LLM execution and billing correctness · 8–10 d

**C8 classification:** a map in code that assigns every one of the 98 tables with a user column to `wipe`, `cascade`, `keep-financial-redacted`, `keep-financial`, `keep-legal` or `keep-admin-actor`. A test parses `db.sql` and fails on any unclassified table, in the style of the FK-safety test at `tests/models/test_user_data_wipe.py:202-237`.

**The 8 tables the wipe does not handle today:**

| Table | What it holds | Class |
|---|---|---|
| `tb_llm_profile`, `_revision`, `_current`, `tb_image_profile` | Name, description, `draft_config`, `custom_provider` endpoint, `provider_options` | Tombstone (D-9): scrub, then archive. Hard delete is blocked by NO ACTION FKs from the kept executions and the audit (`db.sql:2938-2939,3008-3009`). `custom_provider.base_url` takes a placeholder that satisfies `db.sql:2808`. |
| `tb_llm_profile_audit` | `change_summary` | Redact |
| `tb_llm_user_defaults`, `tb_llm_user_feature_profile`, `tb_image_user_default` | The user's default picks | Wipe |

**Other privacy gaps:**
- Also redact `tb_llm_execution_plan.effective_config`, which embeds `custom_provider` and `provider_options` (`models/llm_execution.py:120-121`). The wipe redacts only `frozen_payload` and `result` (`models.py:6197-6201`).
- Unlink image, theme-song, narration and call-audio files after commit. Today only preview MP3s are unlinked (`models.py:6214`).

**D-4, chat delete (recommended):**
- Delete narration audio with the chat, using the call-audio purge pattern (`models.py:22808-22853`), and unlink the files after commit.
- Keep images, since cards may reference them (`models.py:9099-9105`).
- Redact the chat and callbot execution payloads and results; today the full chat history survives.
- This needs typed target columns on `tb_llm_execution_plan` (`adventure_id`, `story_id`, `scene_id`, `subject_id`). The same columns fix story erase missing executions that have no context row (`story_erasure_store.py:73-79`).

**Billing correctness:**
- Compute the usage day once per transaction and pass it to every statement. Today admission reads `UTC_DATE()` once (`llm_execution_admission.py:543`) while `_ensure_usage_rows` re-evaluates `CURRENT_DATE()` per statement (`models.py:2352-2412`), and the `_charge` UPDATEs don't check rowcount. A transaction that crosses midnight can silently undercount.
- Keep every billing table.
- Drop write-only `tts_turn_charge.ledger_entry_id` (`turn_charge_models.py:190`), after G4 shows no reader.

**Payload split (optional, 1.5 d):**
- `tb_llm_execution_payload(execution_id PK, frozen_payload, result)`, 1:1. Header reads stop dragging ~28 KB LOBs.
- Expiry, later in R6, writes the erased marker; it never deletes.

**Docs to correct:**
- `voice_consent` is deleted by the wipe (`models.py:6163`), not kept.
- The DDL comments on abuse counters, restrictions and free activation (`db.sql:1925,1959,1989`) say the wipe deletes them, but it keeps them.
- The wipe promises a "CN-9" retention job (`models.py:6091`) that doesn't exist.

**Accounting parity, in G4 and G6, per user and per UTC day:**
1. `membership_usage_day.credits_used`.
2. `(accepted_count, billable_seconds)` per operation.
3. `tb_operation_usage_day.request_count` per scope, operation and payer.
4. Voice reserved and consumed seconds.
5. `SUM(counted_chars)` of the turn charges.
6. Ledger count, `SUM(credit_cost)` and `SUM(billable_seconds)` by `(op, date, source, event_type)`, plus a row hash.
7. Wallet balances against the last `*_balance_after`.
8. Per execution: status, payer and cost, and the linked ledger ids.
9. Per turn charge: `credits_final` = Σ reserved linked rows.
10. `/user/me`, `/llm/capacity-usage` and the root overview, compared as JSON with the clock pinned.

**Tests to add:**
- the C8 test;
- tombstoned profiles and wiped defaults;
- media files unlinked on wipe;
- a DB test for chat delete and `_purge_call_content` (today only route mocks, `test_character_chat_routes.py:969`);
- story erase of an execution with no context row;
- a usage-day midnight test with the clock pinned.

### R5 — Cards, workspace, conversations (−4 tables) · 7–8 d

| Change | Detail |
|---|---|
| **Merge `tb_card_body` into `tb_card`** (keep the name) | This makes the 1:1 structural; today only app code enforces it (`models.py:11969,11991`). Keep the deferred-join list: count and page on the card header with `FORCE INDEX idx_tb_card_workspace_recent/_type` (`workspace_models.py:682-683`), plus its EXPLAIN test (`tests/integration/test_workspace_database.py:483`). Keep `chk_tb_card_latest_version_pair`, `chk_tb_card_lineage`, `chk_card_body_props_object`, `uq_tb_card_id_type` (the FK target for version, draft and share) and `normalize_for_storage` (`card_body.py:165`). The upgrade joins on `(card_id, card_type)` and asserts equal counts. |
| **`tb_content_operation_context` → origin columns on `tb_llm_execution_plan`** | Job context rows are written and never read (`models.py:637-655`): stop writing them. Execution consumers (7 SQL sites) read the columns instead. A nullable composite FK to the workspace; the wipe NULLs it before deleting workspaces (today it deletes context rows, `models.py:6148`). Keep the collections CHECK (≤ 20 unique UUIDs), `canonical_collection_ids` and the replay fingerprint, including the `{"source":"migration"}` marker (`llm_execution_admission.py:409-425`). Index `(…scope, origin_workspace_id, feature_key, execution_sequence)`. |
| **`session_voice_setting` → `adventure_session.narration_tier_override` + `narration_tier_updated_at`** | CHECK: both NULL or both set; tier in `standard`/`expressive`. The UPDATE must set `adventure_last_update = adventure_last_update`, or the chat jumps to the top of the list (`db.sql:247`). `conversation_version` stays untouched. |
| **Drop `tb_operation_receipt`** | It duplicates card generation (`db.sql:3103-3109`). Serve `/llm/receipts*` (no SPA caller, `routes/llm_profiles.py:335,345`) from `tb_llm_card_generation`, or remove the route. Remove the legacy "unattributed" block (`llm_execution_admission.py:189-194`) once the preflight shows 0 such rows, and update the `JSON_SEARCH` at `models.py:8720`. |

**Kept:** `tb_card_copy_receipt` (intent-hash conflict, success-only, 200 + `X-Idempotent-Replay`), `tb_llm_assistant_turn` (cascades from its conversation), and `adventure_message` / `assistant_message` as separate tables.

**Tests to add:**
- a card cannot exist without its body;
- a tier change leaves `adventure_last_update` and `conversation_version` unchanged;
- after a wipe, content executions return 404 while profile and Studio test executions stay readable;
- deleting a conversation keeps its execution;
- EXPLAIN uses the multi-valued index.

### R6 — Retention janitor (code only, no schema change) · 2.5 d

A single-flight janitor: `GET_LOCK`, batched `DELETE … ORDER BY pk LIMIT 1000`, and retention classes declared next to the C8 map. It runs on its own connection, not the shared 10-slot pool.

| Table | Rule | FK-safe |
|---|---|---|
| `voice_turn_metrics`, `voice_call_metrics` (D-2) | 90 d | Leaf tables |
| `speech_provider_attempt` | 90 d | No FKs |
| `voice_catalog_event` | `history_sweep:*` 30 d, `reconciliation:*` 90 d, `sync_run` 90 d; keep lifecycle events | Yes |
| `voice_usage_day` | 90 d (only today's row is read, `quota.py:131-139`) | Yes |
| `voice_abuse_counter` | 90 d (the window is 7 d, `abuse.py:55`) | Yes |
| `voice_preview_render` | `failed` after 7 d | Yes |
| Execution payloads | Redact in place after N days (D-5). Recovery then returns 410. | `UPDATE` only |

**Never deleted:**
- `tb_operation_reservation` (FK parent, the only refund link);
- ledgers and `tts_turn_charge`;
- story receipts (domain records);
- `tts_job` (cascades `tts_asset`).

**Needs D-5:** the copy receipt, `voice_session` and its segments, image and theme-song jobs, `resource_task`, notifications, the profile audit, and ready preview renders.

## 6. Maintenance-window runbook (every release)

1. **T-1 day.** G1–G7 green on the release branch. G4 dry run on last night's backup; record the timing.
2. **Block ingress** at the proxy. Keep the API process running, so the sweepers settle in-flight work. fal webhooks are blocked too; image jobs finalize through the poll path.
3. **Drain.** Wait until this query returns 0:
   - live LLM leases;
   - rows in `voice_quota_reservation`;
   - open `tts_turn_charge`;
   - `rendering` previews;
   - non-terminal image, TTS and theme-song jobs;
   - running exports and resource tasks.

   Timeout is 15 min. Settle stragglers through the existing sweep and refund paths. Never edit ledgers by hand (`docs/operations.md`).
4. **Stop the API.** Back up the database and the media roots together, and record the sha.
5. **Run the upgrade** with `--apply --backup-sha …`.
6. **Start release N** with ingress still blocked. Run G8.
7. **Go or no-go.**
   - **Go:** open ingress, then watch the error rate, slow log and deadlock log for 24 h.
   - **No-go:** stop, restore the backup, start the release N-1 image, open ingress.
8. **After ingress opens,** a rollback loses the writes made since then. Agree on a rollback horizon in advance (D-11).

At today's size (~122 MB plus media) a window is about 30–60 minutes, mostly the drain and the checks.

## 7. Decisions

| ID | Decision | Blocks | Recommendation |
|---|---|---|---|
| D-1 | `voice_consent_record` | R1 | Drop it. Classify it `keep-legal` if legal wants the DDL kept. |
| D-2 | Call telemetry is written, never read | R6 | Keep both tables with a 90-day TTL. They are used by hand (`magic-worlds/docs/call_realtime/18_improvement_plan.md`). |
| D-3 | Admin agent-studio workflows | — | No change in this refactor. |
| D-4 | Media and payloads on chat delete | R4 | Delete narration audio, keep images, redact chat execution payloads. |
| D-5 | Retention periods | R6 (beyond the non-controversial set) | Operational 90 d, payload redaction 30 d, financial set by legal. |
| D-6 | Strategy | — | **Resolved:** per-domain in-place upgrades in windows (this plan). |
| D-7 | Story history coalescing and pruning | Story backlog | Deferred. Pins first. |
| D-8 | Infrastructure | R0 | A dedicated MySQL 8.4 LTS instance |
| D-9 (new) | BYOK profiles on wipe | R4 | Tombstone: scrub, then archive |
| D-10 (new) | Synthetic smoke/e2e accounts in the project DB | — | Purge them through the wipe after R4 (OPS-07) |
| D-11 (new) | One window per release, or bundled windows; rollback horizon | R1+ | One per release; 1 h horizon |
| D-12 (new) | Open billing-audit findings F1/F3/F4 (`magic-worlds/docs/billing/plan-audit-2026-10-17/`) | — | A separate track. R4 fixes only the usage-day boundary. |

## 8. Effort and outcome

| Release | Days |
|---|---:|
| R0 Groundwork and gates | 6–8 |
| R1 Indexes, FKs, hygiene | 3–4 |
| R2 Story Studio | 11–14 |
| R3 Jobs and tasks drawer (+R3b) | 4–5 (+2.5–3) |
| R4 Erasure, LLM, billing correctness | 8–10 |
| R5 Cards, workspace, conversations | 7–8 |
| R6 Retention janitor | 2.5 |
| **Total** | **≈ 42–52** (≈ 9–10 weeks for one engineer; about 6 weeks with two, since R2 and R3/R5 code in parallel) |

The full 05 target was estimated at more than 100 d: C1 alone is 3–4 weeks, the billing merges 15–25 d, and the jobs unification 14–17 d.

| Metric | Today | After R6 |
|---|---:|---:|
| Tables | 126 | ≈ 120 (R1 −1 with D-1, R2 −1, R5 −4; R3b −2, payload split +1) |
| Bytes appended per novel autosave | ~4.65 × text | ~1.4 × text |
| Story Studio on disk (today's data) | 89 MB | ≈ 45 MB (term table ≈ 31 MB, duplicate document) |
| `/tasks` per poll group | 4 sources + archive markers + N+1 per media job | One `UNION ALL`, batched lookups |
| Erasure | Hand list; 8 tables and the media files unhandled | Classified and enforced by a test |
| Tables with a retention rule | 0 | 8 operational tables, then D-5 |
| DB tests in the default run | 0 of 33 files | All, plus golden scenarios and parity |
| Adding an index | 6 steps + downtime, the scripts deleted | 1 upgrade script + `db.sql` + revision bump, in a window |
