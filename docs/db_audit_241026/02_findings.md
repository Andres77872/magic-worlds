# 02 — Findings register

**Severity scale:**
- **Critical:** exploitable or causes data loss now.
- **High:** a correctness, privacy or availability risk that is likely to bite.
- **Medium:** a cost or fragility that grows with use.
- **Low:** hygiene.

The **Phase** column refers to the 2026-10-24 plan. The revised plan in [06_migration_plan.md](06_migration_plan.md) uses releases R0–R6. The [status update](#status-at-backend-c056d82-2026-10-25) below maps each finding to its release.

**Evidence sources:**
- Paths are in `magic-worlds-api/src/` unless they start with `magic-worlds/`.
- Live numbers are from 2026-10-24 ([01](01_live_inventory.md), [`evidence/`](evidence/)).
- The `STO-*` findings are detailed in [03](03_story_studio.md).

**Out of scope:** MySQL user accounts, privileges and TLS/SSL transport. The former OPS-01 is removed; the other IDs keep their numbers.

## Summary

| ID | Sev | Finding | Phase |
|---|---|---|---|
| OPS-02 | High | Shared, default-sized instance: 128 MB buffer pool for ~262 GB of data; connection limit hit 623 times | 0 |
| OPS-03 | High | No scheduled backups or restore drills; the 2026-10-16 reset needed a bespoke binlog replay | 0 |
| OPS-08 | High (latent) | Three clocks, and `SET time_zone` leaks across pooled connections | 0 |
| PERF-01 | High | `tb_user` upsert on every request: a write, an X-lock and an AUTO_INCREMENT burn (234,978 ids for 24 users) | 0 |
| PERF-02 | High | Image and theme-song finalize hold `FOR UPDATE` plus a pool slot across a provider download | 0 |
| INT-01 | High | "Delete my data" keeps full prompts (`frozen_payload.messages`) and user-owned BYOK profiles | 0 |
| RET-01 | High | No time-based retention for any table; LLM payloads are ~28 KB per call, kept forever | 1 |
| MIG-01 | High | The exact-match verifier turns any online index fix into a failed boot on the next restart | 1 |
| SCH-01 | High | The tenant triple is copied into 67 tables, 148 indexes and 45 FK-target unique keys | 3 |
| STO-01 | **Critical** (growth) | One autosave writes ~4 full prose copies; history is never pruned | 2–3 |
| STO-02/03/04 | High | Duplicate current document; whole-novel statistics recomputed per autosave; two full outlines per structure op | 3 |
| PERF-03 | Medium (High at scale) | Global serialization: every LLM admission locks one `tb_llm_project_state` row; every call admission locks `voice_quota_capacity` | 2 |
| PERF-04 | Medium | One 10-connection pool, no acquire/connect timeouts, shared with ~10 background loops | 0 |
| PERF-05 | Medium | Polling sweepers without a leading index scale with history | 2 |
| PERF-06 | Medium | JSON predicates in hot lookups (lorebook extraction, character usage, catalog events) | 2 |
| PERF-07 | Medium | N+1 asset reads; one acquire + transaction + COMMIT per statement (834K COMMITs) | 2 |
| PERF-10 | Medium | No deadlock/lock-wait handling outside voice access; request paths can wait 50 s | 1 |
| INT-02 | Medium | 130 reference columns have no FK, including three different ledger-link styles | 2–3 |
| INT-03 | Medium | Polymorphic references (`tb_workspace_media`, `resource_task` used as archive markers, operation context) | 3 |
| INT-04 | Medium | 65 audio and 61 image assets of deleted chats are still live in the media library | 1 |
| SCH-02 | Medium | Four ID representations; UUIDs in `utf8mb4` varchar(64) | 3 |
| SCH-03 | Medium | Parallel near-duplicate mechanisms: jobs ×5, assets ×5, reservations ×4, usage-day ×4, defaults ×6, receipts ×4 | 3 |
| SCH-04 | Medium | Product policy in DDL (309 CHECKs, 103 ENUMs) plus the exact verifier means every product change needs DDL | 1–3 |
| OPS-04 | Medium | MySQL 8.1.0 (EOL Innovation release); compose uses a floating `mysql:8` tag | 0 |
| OPS-05 | Medium | Slow log off, deadlocks not logged, digest table full | 0 |
| OPS-06 | Medium | 31 leftover integration DBs (~1.5 GB) and 3 stale copies holding user data | 0 |
| OPS-07 | Medium | Smoke/test data in the project DB; a smoke harness ran against `magic_worlds` itself | 0 |
| ACC-01 | Medium | `models.py` is 22.8K lines with 31 classes and ~15 domains; SQL is duplicated across modules | 3 |
| MIG-02 | Medium | No applied-migration history; the marker's `applied_at` is stale | 1 |
| MIG-03 | Medium | Two migration mechanisms; a single-predecessor chain; dead guidance in the verifier | 1 |
| MIG-04 | Medium | Every migration is stop-the-world: full-table fingerprints twice, no `ALGORITHM=`/`LOCK=` | 1 |
| RET-02 | Medium | Agent graph (`agt`) copied into every execution row; blobs and LOB overhead | 2 |
| STO-05…09 | Medium | Term index shape, three-job receipts, blobs, cascading erase, JSON-only references | 2–3 |
| PERF-08/09 | Low | Uncapped OFFSETs, inconsistent LIKE escaping, ~4 s verifier boot | 2 |
| ACC-02/03 | Low | Misnamed live module, migrations shipped in runtime, small API sharp edges | 1 |
| MIG-05 | Low | A schema-freeze test that always skips; tests pin the table count | 1 |
| SCH-05/06/07 | Low | Naming, `DATETIME(0)`, 2 truly redundant indexes | 3 |
| LEG-01 | Low | Stale or unwired tables, routes and prefixes (see the list) | 1 |
| STO-10 | Low | Story index fit | 2 |

## Status at backend `c056d82` (2026-10-25)

Two backend commits landed after the snapshot: `fceaead` and `c056d82`. Six domain reviews then re-read the code. Findings not listed here are unchanged.

"Fixed" means fixed in code. The API on `.90` still runs a build from before `fceaead`, so live checks wait for the redeploy ([07](07_phase0_closeout.md)).

### Changed status

| ID | Status now | Evidence | Release |
|---|---|---|---|
| OPS-06 | **Fixed (live).** 0 `mw_*` schemas and 0 `magic_worlds_*` copies remain. The dump taken first (`.dev/backups/stale-magic-worlds-copies-20261024.sql.gz`) holds user data; delete it once backups exist. | [07](07_phase0_closeout.md) | R0.1 |
| OPS-07 | **Fixed in code.** Smoke harnesses only create `magic_worlds_novel_*_test_*` databases. The existing synthetic accounts remain (D-10). | `scripts/novel_smoke_database.py:26,127` | — |
| OPS-08 | **Fixed.** Every pooled connection opens in UTC; no per-transaction `SET time_zone` remains. Gap: test harness pools bypass it (NEW-04). | `src/runtime_config.py:496,541` | R0 (G2) |
| PERF-01 | **Fixed.** Read first; write only when the identity is new or changed. | `models.py:5675-5695` | — |
| PERF-02 | **Fixed.** A `mirroring` claim is committed first, storage is written outside the transaction, then a short finalize. | `image_generation/engine.py:1147-1250`, `theme_song_generation/engine.py:667-714` | — |
| PERF-04 | **Partial.** Has `maxsize` 10, `pool_recycle`, `connect_timeout` and a 30 s acquire timeout. No separate background pool. | `connection.py:24-27,206` | R6 (janitor connection) |
| PERF-10 | **Re-scoped.** `transaction_cursor` is an `@asynccontextmanager` and cannot re-run its body. A per-request lock-wait `SET` would bring back the session leak. | `connection.py:253` | Deferred |
| INT-01 | **Partial.** `frozen_payload`/`result` are redacted on wipe. Still open: see NEW-02. | `models.py:6197-6201` | R4 |
| RET-01 | **Corrected.** `tb_operation_reservation` cannot get a TTL: it is an FK parent and the only refund link. Execution payloads may only be redacted in place, because replay, retry, recovery and history read them. | `db.sql:3045,3066,3101`; `llm_execution_admission.py:527` | R6 |
| RET-02 | **Corrected.** The stored `agt` is the file graph plus bound settings plus per-call metadata, and its hash is re-verified on replay. Storing it by reference is dropped. | `symbolic_workflows.py:36-70`; `llm_execution_admission.py:204,277` | Dropped |
| SCH-01 | **Counts corrected.** 67 tables carry `project_hash`, 55 carry `user_group_hash`, 54 carry the full triple. 12 LLM/image tables have no group hash. There are **8** `uq_*_scoped_identity` keys (not 45), **45** `scope_nonempty` CHECKs (not 58), and **109** declared keys that contain `project_hash` (not 148). | `db.sql` parse | C1 deferred |
| SCH-02 | **Corrected.** Many ids are not UUIDs (`usr-…`, `vk_…`, `pd_`/`pv_`, `vsa_`, 32-hex, client opaque ids, request-id or sha256 task ids). `CHAR(36)` and UUIDv7 are dropped. | `auth_adapter.py:161`; `models.py:359`; `db.sql:2668,2691` | Dropped |
| INT-02 | **Corrected.** **7** catalog columns lack a `voice_key` FK (not 6). There are **5** ledger-link styles (not 3): the junction table, a JSON array, a comma-separated string, `image_job.input_summary` JSON, and none at all for theme songs. | `voice_preview_models.py:95-111`; `image_generation/engine.py:636` | R1 (FKs) |
| MIG-01 | **Kept as designed.** Downtime is allowed, so the strict verifier stays and changes ship as upgrades in a window. | — | R0 (template) |
| MIG-02, MIG-04 | **Superseded.** No history table and no online fingerprints are needed. Each window's backup sha and parity report are kept in the release record. | — | — |
| MIG-03 | **Superseded.** The whole historical chain, the frozen SQL and the cutover modules were deleted. A database at an older marker can only be re-provisioned. | `c056d82`; BFF `docs/database.md` | R0 (template) |
| MIG-05 | **Partial.** The always-skipping schema-freeze test was deleted. The table-count and revision pins remain. | `tests/test_schema_bootstrap.py:265,651` | Each release |
| ACC-02 | **Mostly fixed.** Only the rename of `voice_legacy_models.py` is left. | — | R1 |
| LEG-01 | **Partial.** The frozen SQL is gone. The stale SPA prefixes and D-1/D-2 remain. | `magic-worlds/src/infrastructure/api/mediaUrl.ts:6-7` | R1, R6 |

### New findings from the revision

| ID | Sev | Finding | Evidence | Release |
|---|---|---|---|---|
| NEW-01 | Medium | **Usage-day boundary.** Admission reads `UTC_DATE()` once, while `_ensure_usage_rows` re-evaluates `CURRENT_DATE()` in every statement, and the `_charge` UPDATEs don't check rowcount. A transaction that crosses midnight can silently undercount. | `llm_execution_admission.py:543`; `models.py:2352-2412` | R4 |
| NEW-02 | High | **Erasure still incomplete.** `tb_llm_execution_plan.effective_config` keeps `custom_provider`/`provider_options`. 8 tables are not handled: the profiles, revisions, current pointers, image profiles, profile audit and 3 default tables. Image, theme-song, narration and call-audio files stay on disk; only preview MP3s are unlinked. | `models/llm_execution.py:120-121`; `models.py:6197-6214` | R4 |
| NEW-03 | Low | **`/tasks?operation=pdf_import` returns nothing.** The resource list is gated on the `lorebook_extraction` flag. | `routes/tasks.py:101` | R1 |
| NEW-04 | High | **Validation gap.** All 33 DB-backed test files skip without `LLM_PROFILE_TEST_MYSQL_SOCKET`. There is no CI in either repo. Model tests assert SQL text against a fake cursor. Harness pools bypass the UTC `init_command`. | `tests/integration/test_llm_profile_database.py:20-33`; `scripts/novel_smoke_database.py:133-159` | R0 (G1–G8) |
| NEW-05 | Medium | **Chat delete and story erase leave content.** Chat delete keeps the execution `frozen_payload` (full chat history) and `result`, narration audio, and the files behind soft-deleted call audio. Story erase redacts only executions it finds through `tb_content_operation_context`. | `models.py:11404-11450,22808-22853`; `story_erasure_store.py:73-79` | R4 (D-4) |
| NEW-06 | Low | **Story replays are canonical-equal, not byte-equal.** MySQL JSON re-sorts object keys. Parity checks must compare canonical JSON. | `story_scene_store.py:164,168` | R2 (G3) |
| NEW-07 | Low | **Docs and code disagree on the wipe.** `voice_consent` is deleted, though docs say it is kept. DDL comments say abuse counters, restrictions and free activation are deleted, but they are kept. The promised "CN-9" retention job does not exist. | `models.py:6091,6163`; `db.sql:1925,1959,1989` | R4 |
| NEW-08 | Low | **Story receipts are domain records, not a replay cache.** Changeset undo, replace undo/redo, assistant stop fences and lost-response results all read them, so they cannot expire. | `story_generation_changeset_store.py:63-110`; `story_replacement_store.py:88-93`; `novel_assistant_control_store.py:20-41` | R2 (no TTL) |

---

## A. Operations, security, infrastructure

### OPS-02 — High — under-provisioned, shared instance

**Evidence:**
- `innodb_buffer_pool_size` = 128 MB, the default.
- Data on the instance is ~262 GB (`booru_spyder` 151 GB, `magic_arxiv` 106 GB).
- `max_connections` = 151: `Max_used_connections` = 152, `Connection_errors_max_connections` = 623, 130 threads connected at capture.
- `magic_auth` held 26 idle connections, the oldest idle for 4.4 h.

**Impact:**
- Noisy-neighbour I/O.
- The magic-worlds pool can be refused connections at startup or on reconnect, which is an outage.

**Fix:**
- Give the magic-worlds stack (`magic_worlds`, `magic_auth`, `auth`, `magic_llm`) its own instance, or at least its own `mysqld`.
- Buffer pool ≥ 1 GB.
- Size `max_connections` to the sum of the pools plus headroom.
- Per-user connection caps.

### OPS-03 — High — no backup schedule or restore drill

**Evidence:**
- `.dev/backups/` on the developer machine holds pre-migration dumps, one of them `*.sql.gz.incomplete`.
- The 2026-10-16 06:45 UTC whole-DB reset was recovered by staging a dump plus a binlog replay into `magic_worlds_recover_*`. The recovery took 3 hours and merged 3,830 rows (`non-novel-recovery-result-20261016T095413Z.json`).
- Only non-novel data was recovered (`scripts/reset_development_database.py:1-5`).

**Impact:**
- There is no defined RPO or RTO.
- Backups sit on a laptop, unencrypted, and contain user data.
- The binlogs on the same host are the only point-in-time recovery source.

**Fix:**
- A nightly consistent dump (`mysqldump --single-transaction` or `mysqlsh util.dumpSchemas`).
- Continuous binlog shipping off-host, encrypted, with a retention policy.
- A monthly restore test into a scratch instance, verified by row counts and the schema verifier.
- A written runbook.

### OPS-04 — Medium — version and environment skew

**Evidence:**
- `.90` runs MySQL **8.1.0**, an Innovation release that is out of support.
- `docker-compose.yml:280` uses `image: mysql:8`, which today resolves to 8.4 LTS.
- The verifier compares normalized `information_schema` text for defaults, checks and expressions.

**Impact:** a server upgrade can change that rendering and block boot (MIG-01).

**Fix:** pin 8.4 LTS (`mysql:8.4.x`) everywhere, and run `test_schema_bootstrap` against that exact image in CI.

### OPS-05 — Medium — the database is hard to observe

**Evidence:**
- `slow_query_log=OFF`.
- `innodb_print_all_deadlocks=OFF`.
- `performance_schema` digest table full (10,000/10,000; the NULL bucket holds 94 M statements).
- InnoDB estimates are 3× off: `story_scene` is estimated at 585 rows and has 1,635.

**Fix:**
- Slow log at `long_query_time=0.2`.
- Print deadlocks.
- A larger `performance_schema_digests_size`, or per-stack instances.
- A weekly digest snapshot into the ops dashboard.
- `ANALYZE TABLE` after bulk imports.

### OPS-06 — Medium — stale databases on the server

**Evidence:**
- 31 `mw_novel_*_it_*` / `mw_story_exec_it_*` schemas from 2026-10-17, ~1.5 GB, one of them 1.27 GB.
- `magic_worlds_old_20260803`, `magic_worlds_recover_20261016_e2d0672c` and `magic_worlds_recoverycheck_20261016_b9d4cb23`: copies of real user rows.

**Impact:**
- Personal data sits outside the erasure path; "Delete my data" cannot reach these copies.
- They waste disk and buffer pool.

**Fix:**
- Confirm nothing references them, then drop them.
- Integration tests should use ephemeral containers (testcontainers), or uniquely named databases with guaranteed teardown plus a nightly janitor.

### OPS-07 — Medium — test data inside the project database

**Evidence:**
- 6 `novel-smoke` users, created 08:11–09:22 on 2026-10-16 right after the reset.
- About 10 `e2e_*`/`voice_*`/`test*`/`refreshdbg*` accounts.
- All 21 novels are "… smoke" or "… check (test novel)".
- `story_card_ref` points at `smoke-character`.
- `docs/database.md` says the smoke harnesses "allocate synthetic databases", but at least one ran against `magic_worlds` itself.
- Two usernames are real people's email-derived handles.

**Fix:**
- Smoke/e2e scripts refuse to run when `MYSQL_DATABASE == 'magic_worlds'` unless an explicit flag is passed.
- Separate dev data from shared staging.
- Purge synthetic accounts through the normal wipe once INT-01 is fixed.

### OPS-08 — High (latent) — three clocks, and the session time zone leaks

**Evidence — the per-transaction leak:**
- `llm_execution_admission.py:488` runs `SET time_zone='+00:00'` inside an ordinary pooled transaction, as does `services/speech/catalog/sync_jobs.py:449`. Neither is ever reset.
- `voice_catalog_models.py:1769-1772` acknowledges "whatever the server or pooled-session time zone".

**Evidence — mixed time sources in SQL:**
- `NOW()` (177 sites), `CURRENT_TIMESTAMP` defaults (154 columns) and `CURDATE()`/`CURRENT_DATE()` (28 sites) follow the session zone. Membership usage days use `CURDATE()`: `models.py:1709,1762`, and the digests show `… usage_date = CURDATE() FOR UPDATE`.
- `UTC_TIMESTAMP()` (59 sites) and `UTC_DATE()` do not.

**Evidence — server:** `time_zone=SYSTEM` on a UTC host.

**Impact:** harmless today only because the host is in UTC. On any non-UTC server (a managed DB, a laptop, a new host):
- Comparisons go wrong depending on which pooled connection serves the request. The voice heartbeat is written with `CURRENT_TIMESTAMP` (`models.py:7335,7366`) but swept with `NOW() - INTERVAL` (`models.py:7162`), so live calls can be killed or orphans never swept.
- Daily quota boundaries shift.

**Fix:**
- Add `init_command="SET time_zone='+00:00', transaction_isolation='REPEATABLE-READ'"` in `load_mysql_config` (`runtime_config.py:526`).
- Set the server `default-time-zone='+00:00'`.
- Delete the per-transaction `SET`s.
- Standardize on `UTC_TIMESTAMP(3)`/`UTC_DATE()`.

---

## B. Performance and scalability

### PERF-01 — High — identity upsert on every authenticated request

**Evidence:**
- `models.py:5686-5692` runs `INSERT … AS new_user ON DUPLICATE KEY UPDATE`, then a `SELECT` on a second pooled connection.
- It is called through `shadow_user.py:30`, which 54 call sites and ~10 routers use.
- Digest: 57,226 executions, 60.6 s total lock time, max 1.44 s.
- Live: 24 users, max `user_id` 221,308, `AUTO_INCREMENT` 234,978 (`innodb_autoinc_lock_mode=2`).

**Impact:**
- Every read request becomes a write with an X-lock on the user row plus a commit.
- The signed `INT` key, used by almost every FK, is consumed at roughly 7K ids per day at dev traffic.

**Fix:**
- Read first. Insert only when missing, and update only when `username`/`user_type` changed.
- Optionally add a short per-process cache keyed by `user_hash`.
- Widen to `BIGINT UNSIGNED` during the Phase 3 rebuild.

### PERF-02 — High — provider downloads inside row locks

**Evidence — theme songs:** `services/theme_song_generation/engine.py:667-730`.
1. `transaction_cursor` → `SELECT … FOR UPDATE` on `theme_song_job`.
2. `storage.save_provider_audio` (`:681`): an HTTP download (60 s timeout per operation) plus a WAV→MP3 transcode.
3. Then the card patch and the commit.

**Evidence — images:** the webhook path (`services/image_generation/engine.py:340`) and the poll path (`:1034`) call `_finalize_locked_job`, which calls `save_provider_image` (`:1152`) under the job lock, then locks the card.

**Impact:**
- A pool slot (1 of 10) and a row lock are held for the whole download.
- Retried webhooks or polls block for up to 50 s, then return 1205 and a 500.

**Fix:** copy the TTS pattern (`services/tts_generation/engine.py:1483-1542`):
1. Commit the `mirroring` status.
2. Write to storage outside any transaction.
3. Finalize in a short transaction.

### PERF-03 — Medium (High at scale) — global serialization rows

**Evidence:**
- `_lock_project` (`llm_profile_models.py:104-109`) runs `INSERT … ODKU` on `tb_llm_project_state`, which has one row per project.
- It is called by every admission (`llm_execution_admission.py:489`) and every finish (`:790`).
- With one `PROJECT_HASH`, all users' LLM starts and completions serialize.
- Voice call admission locks the singleton `voice_quota_capacity` row (`services/voice_orchestration/quota.py:738`).

**Fix:**
- Keep the project lock for policy/profile mutations only.
- Admission should read policy with a consistent read plus a revision check, and lock per user.
- For calls, use per-user rows plus an atomic global counter row: `UPDATE … SET in_flight=in_flight+1 WHERE in_flight < cap`.

### PERF-04 — Medium — pool configuration

**Evidence:**
- `runtime_config.py:526-534` passes no `minsize`/`maxsize`/`pool_recycle`/`connect_timeout`, so aiomysql uses `maxsize=10` and infinite waits.
- A single uvicorn process (`serve.py:36`) shares the pool across:
  - HTTP and WebSocket chat;
  - voice calls;
  - ~10 background loops (`main.py:1231-1325`).
- Long holders:
  - catalog-sync lease (`sync_jobs.py:447-462`);
  - history sweep `GET_LOCK` (`ops/history_sweep.py:267-311`);
  - export `GET_LOCK(…,10)` (`story_export_job_store.py:79`);
  - PERF-02.

**Fix:**
- Set an explicit `maxsize`.
- `connect_timeout=5`; `pool_recycle` below the smallest idle timeout.
- Wrap `acquire()` in `asyncio.timeout`.
- Give background jobs a separate small pool.

### PERF-05 — Medium — sweepers that scan

**Evidence** (digests; each poll runs about every 30–60 s):

| Sweeper | Executions | Index use | Rows examined |
|---|---:|---|---:|
| `tts_job` stale sweep | 22,807 | none in 11,459 | 987,685 |
| `voice_session` orphan sweep (`models.py:7160-7168`; `status IN … AND COALESCE(last_heartbeat_at, started_at) < …`, and the only status index starts with `user_id`) | 28,074 | none in all | — |
| `voice_quota_reservation ORDER BY started_at_ms` | 56,254 | none in all | — |
| `tts_turn_charge` correlated `EXISTS`/`NOT EXISTS` against `tts_job` | 2 × 22,808 | — | — |

**Impact:** cheap now; linear in history, and there is no retention (RET-01).

**Fix:**
- Add `(source, status, created_at)` on `tts_job`.
- Add `(status, started_at)` on `voice_session` and write `last_heartbeat_at` non-null at start, so the predicate is sargable.
- Add `(started_at_ms)` on the reservation table.
- In the target schema, `job(kind, status, created_at)` serves every sweeper.

### PERF-06 — Medium — JSON predicates in lookups

**Evidence:**
- `lorebook_extraction_records.py:88-91` matches `JSON_UNQUOTE(JSON_EXTRACT(e.result,'$.resource_id'))` on `tb_llm_execution_plan`, whose rows are about 33 KB each.
- `JSON_CONTAINS(character_ids_snapshot, …)` on `adventure_session` (`models.py:11019,11041,14131`).
- `JSON_EXTRACT(payload,'$.job')` on `voice_catalog_event` (`voice_catalog_models.py:1782`).

**Fix:**
- Use a real column or a stored generated column with an index.
- For the character usage lookup, use a multi-valued index: `INDEX ((CAST(character_ids_snapshot AS CHAR(64) ARRAY)))`.

### PERF-07 — Medium — chatty access pattern

**Evidence:**
- The image/theme-song job lists (`models.py:8355-8385`, `:9475`) run one `list_for_job` per job. Digests: `image_asset` 31K selects, `tts_asset` 19K.
- `execute_query` (`database/mysql/connection.py:208-232`) does one pool acquire, one transaction and one COMMIT **per statement**. `COMMIT` is the #1 digest: 834K executions, 530 s.

**Fix:**
- Batch with `job_id IN (…)`. The helper already exists: `ImageAssetModel.list_for_jobs` (`models.py:8928`), used at `:8293` but not at `:8383`.
- Group a request's reads into one `transaction_cursor`, or use `autocommit=True` for pure single reads.

### PERF-08 — Low — pagination and search sharp edges

**Evidence:**
- 22 OFFSET sites. These have no `le=` cap on `offset`: `images.py:338`, `theme_songs.py:184,235`, `tasks.py:84`, `notifications.py:153`, `admin_billing.py:1186,1473`, `admin_membership.py:511`.
- LIKE escaping is implemented 5 different ways. The credit-code admin search does not escape wildcards (`models.py:4602`).

**Fix:**
- Cap `offset`, or move to keyset pagination.
- Use one shared `escape_like()`.

### PERF-09 — Low — the verifier costs about 4 s per boot

**Evidence:**
- About 120 `information_schema` queries per boot.
- About 1,440 boots in 13 days = 860 s of server time. This is dev/test churn.

**Fix:** cache the verification result, keyed on the `db.sql` hash plus the `schema_migration` checksum.

### PERF-10 — Medium — no deadlock or lock-wait strategy

**Evidence:**
- 182 `FOR UPDATE` and 40 `FOR SHARE` under REPEATABLE READ, with gap locks on range predicates (for example, wipe at `models.py:6119-6123`).
- A 1213 retry exists only in `services/speech/voice_access.py:130-325`, and nothing handles 1205.
- `innodb_lock_wait_timeout` is 50 s.
- There is no global DB-error handler, so these surface as 500s.

**Fix:**
- A retry decorator on `transaction_cursor` for idempotent bodies.
- `SET SESSION innodb_lock_wait_timeout=5` on request paths.
- A central lock-order document. Today it is local comments, such as `llm_execution_admission.py:500-503`.

---

## C. Integrity, privacy, lifecycle

### INT-01 — High — the account wipe keeps user content

**Evidence:**
- `delete_all_user_data` (`models.py:6068-6190`) deletes from a hand-maintained list of 45 tables.
- That list does **not** include `tb_llm_execution_plan`. Its `frozen_payload` has top-level keys `agt` (the agent graph) and **`messages` (the full prompt, including chat or novel text)**:
  - 12–56 KB per call;
  - for example, `chat_character` averages 40.7 KB and `chat_adventure` 52.3 KB.
- Its docstring says executions "stay as billing history", but nothing redacts their content.
- Also kept:
  - `tb_llm_profile`/`tb_image_profile` rows the user owns (BYOK profiles);
  - `tb_llm_profile_audit`;
  - `speech_provider_attempt`.
- The story erase path already rewrites `frozen_payload` (`story_erasure_store.py:154`), so the pattern exists. The account wipe does not use it.

**Impact:** a right-to-erasure request leaves conversation content behind. There is no test that new tables get classified.

**Fix:**
1. Redact `frozen_payload`/`result` on wipe; keep the accounting columns.
2. Delete or anonymize user-owned profiles.
3. Add a schema test: every table with `user_id`/`owner_user_id`/`*_by_user_id` must appear in an erasure classification (convention C8).

### INT-02 — Medium — references without foreign keys

**Evidence:** 130 `*_id`/`*_key` columns with no FK ([`evidence/reference_columns_without_fk.tsv`](evidence/reference_columns_without_fk.tsv)). Most are deliberate (lineage, provider ids, idempotency keys). The ones that matter:

| Reference | Live state |
|---|---|
| `voice_key` in 6 catalog tables → `voice_catalog` | 0 orphans, but nothing enforces it |
| `tb_operation_reservation.credit_ledger_ids` (**JSON array** of ledger ids) | no FK possible |
| `tts_turn_charge.ledger_entry_id`, `voice_preview_render.ledger_entry_id` (`varchar(64)` pointing at a `BIGINT` ledger id) | no FK |
| `story_plan_item.scene_id`, `story_scene_revision.generation_id`/`variant_id` | 0 orphans |
| `story_card_ref.card_id` | **7 of 14 orphaned**: the frozen snapshots of deleted cards, including smoke ids |
| `image_job.adventure_id`, `tts_job.adventure_id` | 64 / 65 orphaned (see INT-04) |

**Fix:**
- Add FKs where both sides are owned rows.
- Replace JSON or string ledger links with a `reservation_id` FK on the ledger (target `credit_ledger`).
- Expose "source removed" for codex refs.

### INT-03 — Medium — polymorphic references

**Evidence:**
- `tb_workspace_media.asset_id` can point into any of 3 asset tables.
- `tb_content_operation_context(operation_kind, operation_id)` points at jobs or executions.
- `resource_task` stores `image_generation`/`text_to_speech` rows that exist only as **archive markers** for other tables' jobs. The tasks drawer runs `NOT EXISTS (SELECT … FROM resource_task … archived_at IS NOT NULL)` against each job table (digests, 4,199 executions each).
- `membership_credit_ledger.reference_id`, `user_notification.source_id`.

**Fix:** the unified `job` and `media_asset` tables ([05](05_target_schema.md)). They make these real FKs and the drawer a single query.

### INT-04 — Medium — media of deleted chats stays live

**Evidence:**
- **Audio:** 65 audio assets (8.9 MB) still have `deleted_at IS NULL` and are listed in `tb_workspace_media`, though their `adventure_id` no longer exists. 36 are `call_character_tts` and 29 are `chat_tts_request`.
- **Images:** 61 image assets are in the same state.
- `delete_session` (`models.py:11363-11400`) purges call content (`_purge_call_content`) but does not remove narration audio.
- Part of this may predate the 2026-10-16 reset.

**Fix:**
- Decide the product rule: keep generated media in the library, or delete it with the chat (**D-4**).
- Implement the rule and cover it with a test.
- Call audio in particular is probably expected to go with the call.

### INT-05 — Low — `voice_consent_record` is never written

It is the legal record of a cloned voice's subject consent (D20). It exists in DDL and in comments only (`models.py:6076,6161`; `voice_native_purge.py:57`), with 0 rows. Either implement the root-recorded consent flow or drop the table (**D-1**).

---

## D. Growth and retention

### RET-01 — High — nothing expires

**Evidence:**
- No time-based `DELETE` exists for any table.
- The sweepers only change status.
- The only pruning is: export files (newest N kept), voice reservations on settle, and the nightly `voice_reference` scan.

**Unbounded tables:**
- **LLM:** `tb_llm_execution_plan` (`frozen_payload` ~28 KB per call), `tb_llm_profile_audit`, `tb_llm_assistant_turn`, `tb_llm_card_generation`, `tb_content_operation_context`.
- **Story:** story history (STO-01/04/06), `story_annotation_event`, `story_writing_log`, `story_generation`.
- **Accounting:** `tb_operation_receipt`, `tb_operation_reservation` (expired leases are filtered out, never deleted), all usage-day tables and ledgers.
- **Media:** all media job/asset tables (soft-deleted rows stay), `voice_preview_render`.
- **Voice:** `voice_session`, `voice_transcript_segment`, both voice metrics tables, `speech_provider_attempt`, `voice_catalog_event` (+1 row per hour from the history sweep).
- **Misc:** `user_notification`, `resource_task`, `tb_card_version`, `tb_card_copy_receipt`.

**Fix:** a single-flight janitor (`GET_LOCK`, batched `DELETE … ORDER BY pk LIMIT 1000`) driven by a retention class per table (C7):

| Class | Rule |
|---|---|
| Events, metrics, attempts | TTL |
| Replay receipts, reservations | TTL after the replay window |
| Execution payloads | Redact after N days, keep accounting |
| Ledgers | Keep; partition or archive monthly |
| Story history | After pins exist (STO-09) |

### RET-02 — Medium — bytes that need not be in rows

**Evidence:**
- Every execution stores the full agent graph (`agt`). The graphs are server-owned files under `src/agent_graphs/`.
- Story import/export blobs (STO-07).
- Off-page LOB overhead: `story_scene` holds 11.4 MB of payload in 29.6 MB on disk, and `tb_llm_execution_plan` 9 MB in 13.5 MB.

**Fix:**
- Store `graph_key`, `graph_sha256` and settings instead of the graph.
- Move blobs to the media store.
- Compress large JSON at the application layer.

---

## E. Schema design

### SCH-01 — High — the tenant triple is everywhere

**Evidence:**
- `(user_id, project_hash, user_group_hash)` is copied into 67 tables, 148 indexes and 67 FK column sets.
- 58 `chk_*_scope_nonempty` CHECKs.
- 45 `uq_*_scoped_identity` keys exist only as composite-FK targets; `sys.schema_redundant_indexes` flags them.
- Live data has 2 distinct `project_hash` values (18 chars) and 2 `user_group_hash` values (64 and 35 chars).

**Impact:**
- About 90 bytes of tenant prefix in every secondary-index entry.
- 3–4 predicates in every scoped query.
- Scope semantics are spread over 67 tables.

**Fix:** `account_scope.scope_id` (C1). The guarantee stays intact through composite FKs on `(id, scope_id)`.

### SCH-02 — Medium — inconsistent identifiers

**Evidence:**

| Representation | Columns | Examples |
|---|---:|---|
| `varchar(64) utf8mb4_bin` | 229 | `story_id`, `card_id`, `scene_id` |
| `char(36) utf8mb4_bin` | 91 | workspace, job, asset, execution |
| `char(35)`, `char(32)`, `varchar(128)` | various | |
| `INT AUTO_INCREMENT` | — | `user_id`, `adventure_id` (enumerable) |

**Fix:** convention C2, applied when a table is rebuilt.

### SCH-03 — Medium — parallel mechanisms for the same concept

**Evidence:**

| Concept | Today | Count |
|---|---|---:|
| Async job | `image_job`, `tts_job`, `theme_song_job`, `resource_task`, `story_export_job` | 5 |
| Stored file | `image_asset`, `tts_asset`, `theme_song_asset`, plus 2 blob columns | 5 |
| Lease/reservation | `tb_operation_reservation`, `tts_turn_charge`, `voice_quota_reservation`, plus preview in-flight | 4 |
| Daily usage | `membership_usage_day`, `membership_operation_usage_day`, `tb_operation_usage_day`, `voice_usage_day` | 4 |
| Credit link styles | junction table, JSON array, string column | 3 |
| Default profile | 4 LLM tables + 2 image tables | 6 |
| Idempotency receipt | `story_operation_receipt`, `tb_operation_receipt`, `tb_card_copy_receipt`, `tb_llm_card_generation` | 4 |
| Lock anchor | `tb_llm_project_state`, `voice_quota_capacity` | 2 |

**Fix:** [05](05_target_schema.md) merges each concept into one table.

### SCH-04 — Medium — product policy is in DDL

**Evidence:**
- 309 CHECKs, including 85 `json_schema_valid` and 40 `regexp_like`.
- 103 ENUMs.
- Examples:
  - `tb_operation_receipt` hard-codes `feature_key='card_generation' AND operation='ai_card_generation'` (a generic table usable by one feature only).
  - `resource_task.operation IN (4 values)`.
  - Status and kind lists everywhere.
- Combined with MIG-01, a new operation or status needs: DDL, db.sql, the verifier, a migration script, a predecessor bump and backup downtime.

**Fix:** conventions C4/C5 — lookup tables with FKs for vocabularies; CHECKs only for invariants.

### SCH-05 / SCH-06 / SCH-07 — Low

- **Naming (SCH-05):** `tb_`/`cat_` prefixes on 36 tables; `creation_at` vs `created_at`; `adventure_created_at`/`adventure_last_update`; plain indexes named `fk_*`.
- **Precision (SCH-06):** `DATETIME(0)` everywhere. Event ordering relies on id tie-breakers. Use `DATETIME(3)` for events and logs.
- **Redundant indexes (SCH-07):** two are truly redundant left prefixes: `adventure_session.idx_adventure_session_user` and `tb_card.idx_tb_card_user`. `sys.schema_unused_indexes` lists 56, but that is weak evidence at dev traffic; re-check after a week of real load.

---

## F. Data-access code

### ACC-01 — Medium — one 22.8K-line module plus scattered SQL

**Evidence:**
- `database/mysql/models.py` holds 31 classes covering ~15 domains. `MembershipModel` alone spans lines 1443–4488.
- ~45 `story_*_store.py` modules take the model class as a parameter.
- 68 raw SQL calls sit in services and routes.

**Duplication:**
- The `assistant_message` history query is in two places (`models.py:20507`, `assistant_turn_store.py:503`).
- `adventure_message` SQL is spread across 3 modules.
- LIKE escaping is implemented 5 ways.

**Fix:** per-domain repository packages, aligned with the target domains in [05](05_target_schema.md), plus one SQL-helpers module. Do this as part of each Phase 3 domain move, not as a separate rewrite.

### ACC-02 — Low — legacy naming and packaging

- `voice_legacy_models.py` is **live** runtime code. It is imported by the catalog service, voice references, voice write, global presets and `models.py:18128`. Rename it.
- All `*_cutover.py`, `*_migration.py`, `novel_schema_backup.py`, `voice_native_purge.py` and `voice_orphan_sweep.py` modules are imported only by scripts and tests, yet they ship in the runtime package.
- `bootstrap.py:1881` lazily imports `fish_calls_migration` on a branch that `:1873` makes unreachable.

**Fix:** move them to a `migrations/` package outside `src/`.

### ACC-03 — Low

- `execute_query` returns `lastrowid` or `rowcount` depending on the statement (`database/mysql/connection.py:221`).
- If `commit()` itself raises, the rollback hooks are skipped (`connection.py:241-247`).
- `get_db` is unused.
- One value is interpolated into SQL (`models.py:18179`). It is whitelisted at `:18072`, but switch it to `%s`.
- Dynamic SQL is otherwise clean: 551 interpolation sites were checked.

---

## G. Migration tooling

### MIG-01 — High — the exact-match verifier blocks safe online changes

**Evidence:** `bootstrap.py:1827-2032` checks:
- column order and attributes;
- index names, columns, prefixes, direction and **visibility**;
- FKs and normalized CHECK text;
- table options;
- exact seed rows.

It rejects any extra table, view or trigger. It runs only at boot (`database/mysql/connection.py:154`).

**Impact:**
- A DBA adds or hides an index during an incident; the API keeps running; the next deploy or crash-restart refuses to boot.
- Adding one index today takes:
  1. a db.sql edit;
  2. two new scripts;
  3. a revision bump;
  4. a patch to the previous migration's reverse delta;
  5. test pins;
  6. a backup with downtime.

**Fix:**
- Keep it strict for **missing or changed** objects.
- Allow **additive** indexes from an allow-list (or warn on them).
- Add an env switch, `SCHEMA_VERIFY=strict|warn`.
- Read the expected contract from `schema_migration` plus db.sql.

### MIG-02 — Medium — no history

**Evidence:**
- Only `content_schema_revision(singleton)` exists. Its `applied_at` reads 2026-10-18 10:45, but the last delta created its tables on 2026-10-21.
- Backup SHAs live only in CLI output (`voice_turn_metrics_migration.py:119-120`).

**Fix:** an append-only `schema_migration` table: version, script, db.sql sha256, backup sha, start/finish, operator, outcome.

### MIG-03 — Medium — two mechanisms, one rigid chain

**Evidence:**
- **Newer migrations** rebuild the predecessor schema by text-reversing *today's* db.sql (`voice_turn_metrics_migration.py:27-44`; exact strings in `llm_custom_provider_migration.py:12,47-50`). A cosmetic db.sql edit can therefore break old migrations.
- **Older migrations** use the 19 frozen files in `database/mysql/migrations/*.sql`.
- Each step accepts exactly one predecessor.
- `bootstrap.py:1736-1822` hard-codes the upgrade guidance, including dead `novel_*` branches.

**Fix:**
- Forward-only numbered migrations, each with an up script and a checksum.
- Retire the reverse-text technique.
- Squash the history into a new baseline at the Phase 3 cut.

### MIG-04 — Medium — every migration is stop-the-world

**Evidence:**
- `preserved()` (`story_export_job_migration.py:49-58`) compares every predecessor table's row fingerprints to the backup, before and after the DDL.
- `table_fingerprint` (`novel_schema_backup.py:29-35`) loads each table into memory through a buffered cursor.
- Any write between backup and apply aborts the migration.
- No DDL sets `ALGORITHM=`/`LOCK=`, so MySQL silently picks COPY where needed.

**Fix:**
- Fingerprint only the tables the step touches, streamed with `SSCursor`.
- Declare `ALGORITHM=INSTANT|INPLACE, LOCK=NONE` and fail if MySQL can't honour it.
- Use expand/contract for anything that must stay online.

### MIG-05 — Low

- `tests/test_workspace_r1_schema_freeze.py:40-45` always skips, because the revision moved on.
- Other tests pin the table count (126) and the revision literal. They need updating on every change.

---

## H. Legacy, stale and unwired

### LEG-01 — Low

| Item | Evidence | Action |
|---|---|---|
| 17 empty tables | [01 §3](01_live_inventory.md#3-tables-by-domain) | Most are live features with no data yet. Keep them unless they are listed below. |
| `tb_llm_workflow*` (3) | Admin agent studio only. 0 rows. No user-facing execution path reads published workflows. | Decision **D-3** |
| `voice_consent_record` | Never written (INT-05) | **D-1** |
| `voice_call_metrics`, `voice_turn_metrics` | Written, never read by any API or admin view | **D-2:** expose in admin metrics or export |
| Routes with no SPA caller | Generic OAuth, `POST /billing/credits/recharge`, `/llm/receipts*`, `POST /images/text-to-image`, `POST /stories/{id}/generate`, `/admin/voices/restrictions*`, voice metrics history-sweep/reconciliation | Keep (they are capabilities). Review each. |
| Stale SPA media prefixes | `magic-worlds/src/infrastructure/api/mediaUrl.ts`: `/generated-images/`, `/generated-audio/` | Remove |
| Frozen SQL for retired chains | `database/mysql/migrations/*.sql` (19), `scripts/migrations/*` before `voice_contract` | Archive at the Phase 3 baseline |
| Dev backups with user data | `magic-worlds-api/.dev/backups/*.sql.gz` | Move to the managed backup store (OPS-03), then delete |
