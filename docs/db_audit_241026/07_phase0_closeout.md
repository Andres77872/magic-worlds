# 07 — Phase 0 closeout and R0 readiness (2026-10-25)

**Date:** 2026-10-25, one day after the audit.

**Scope:** each old Phase 0 step checked against its "Done when" line, the backend test baseline, and what R0 of the revised plan ([06](06_migration_plan.md)) still needs before R1.

**Method:**
- **Code:** BFF HEAD `c056d82`, which adds two commits after the audit:
  - `fceaead`: the Phase 0 fixes;
  - `c056d82`: deletes the old migration tooling.

  Plus uncommitted smoke-isolation work in 33 `scripts/smoke_novel_*` files.
- **Live:** read-only queries on `192.168.1.90` (`SET SESSION TRANSACTION READ ONLY`): server variables, schemas, digests, per-connection state.
- **Tests:** the backend tests that cover each fix (395 passed), plus the whole suite run directory by directory, at HEAD and at `f7229af` (see [Test baseline](#test-baseline)).

Line references in 01–06 that point into deleted files are stale: `*_migration.py`, `*_cutover.py`, `novel_schema_backup.py`, `voice_native_purge.py`, `migrations/*.sql`. Lines in `models.py` have shifted by about 50.

## Headline

1. **The fixes are not deployed.** The API on `.90` connects from `192.168.1.90` (PID 1, so a container). Its connection IDs put its oldest pool connections at 45 hours or more, against 21 hours since `fceaead`. So the process predates the fixes:
   - the `tb_user` upsert ran 255 more times after the audit, last at 2026-10-25 20:29 UTC;
   - `AUTO_INCREMENT` moved from 234,978 to 235,263.

   No live "Done when" can be checked until HEAD is deployed.
2. **Closed:** 0.4, 0.7 and 0.10. Step 0.6 is closed in code, and 0.9 is closed for novel smokes.
3. **The backend unit suite is red, and it was red before the audit.** 661 tests fail, 4 modules fail to collect, and 2 test files hang. The same failures occur at the audit commit `f7229af`, so `fceaead` and `c056d82` broke nothing. But R0.4 ("all gates green; that run is the baseline") cannot pass until the suite is fixed. See [Test baseline](#test-baseline).

The old Phase 1 no longer exists. The revised plan ([06 §2](06_migration_plan.md#2-where-things-stand-at-c056d82)) drops, replaces or reassigns each of its steps, and the next work is **R0**. [What blocks R1](#what-blocks-r1) maps this closeout onto R0.

## Phase 0 status

| Step | Finding | Status | Evidence | What is left |
|---|---|---|---|---|
| 0.2 Backups + restore drill | OPS-03 | **Open** | No schedule. The only event on the server belongs to another schema (`deepresearch`). Dumps still sit in `magic-worlds-api/.dev/backups/`. | Everything (R0.1). It is required before the first maintenance window. |
| 0.3 Slow log, deadlocks, digests | OPS-05 | **Open (server)** | `slow_query_log=OFF`, `long_query_time=10`, `innodb_print_all_deadlocks=OFF`, `performance_schema_digests_size=10000` | Server config. Part of the dedicated 8.4 instance (R0.2). |
| 0.4 UTC on every connection | OPS-08 | **Closed in code** | `init_command` sets `time_zone='+00:00'` (`runtime_config.py:496,541`). No `SET time_zone` is left in `src/`. Tests pass. Its "Done when" is met. | Server `default-time-zone` is still `SYSTEM` (the host is UTC). The isolation level is not set explicitly. Both are hygiene. |
| 0.5 Pool settings | PERF-04 | **Partial** | `POOL_SETTINGS` = min 1, max 10, `pool_recycle` 3600, `connect_timeout` 10, plus a 30 s acquire timeout (`connection.py:24-27`) | No separate pool for the ~10 background loops, and no load test. Not scheduled in 06. |
| 0.6 Identity read-first | PERF-01 | **Closed in code, live check pending** | `get_or_create_user` reads first and writes only on a new or changed identity (`models.py:5669-5695`). `test_shadow_user.py` covers it. | After the redeploy: the `INSERT INTO tb_user` digest (57,481) and `AUTO_INCREMENT` (235,263) stay flat under normal traffic. |
| 0.7 Downloads outside locks | PERF-02 | **Closed** | Both engines commit a `mirroring` claim, store with no transaction open, then re-lock to finish: `theme_song_generation/engine.py:665-720`, `image_generation/engine.py:1182-1260`. A live-claim lease stops two image finalizers mirroring at once. Engine tests pass. | — |
| 0.8 Account wipe | INT-01 | **Partial** | Prompts and results are redacted: the wipe sets `frozen_payload`/`result` to the `account-wipe-v1` marker, and replays are refused with 410. `test_user_data_wipe.py` asserts it. | User-owned BYOK and default rows are kept (see [Wipe gaps](#wipe-gaps)). There is no classification test. Both move to R4. |
| 0.9 Smoke scripts off the project DB | OPS-07 | **Closed for novel smokes** | Every `smoke_novel_*` allocates `magic_worlds_novel_<kind>_test_<hex>` and drops it in `finally`. The uncommitted work adds Redis namespaces. `voice_smoke.py` uses the public API with supplied credentials, by design. | Commit the smoke work (R0.3). Purging the 24 synthetic accounts in `magic_worlds` is decision D-10. |
| 0.10 Drop stale schemas | OPS-06 | **Closed** | Live: 0 `mw_*` schemas, 0 `magic_worlds_*` copies | The copies were dumped first to `.dev/backups/stale-magic-worlds-copies-20261024.sql.gz`. That file holds user data on the laptop, so delete it once 0.2 exists. |
| 0.11 Pin MySQL 8.4 LTS | OPS-02, OPS-04 | **Open** | Live: 8.1.0, 128 MB buffer pool, `max_connections` 151 (the 623 connection errors are unchanged since the audit). `docker-compose.yml:280` still uses `mysql:8`. The backend repo has no CI. | Pinning `mysql:8.4.x` in compose is a one-line change. The server move is R0.2 (decision D-8). |

## Other findings that changed

| Finding | Status | Why |
|---|---|---|
| MIG-03 (two mechanisms, rigid chain) | **Superseded** | `c056d82` deleted both mechanisms: the frozen SQL, the reverse-text predecessor builders and the chain guidance in `bootstrap.py`. Nothing replaces them yet. The upgrade-script contract in [06 §3.2](06_migration_plan.md#32-upgrade-script-contract) is the replacement (R0.5). |
| MIG-04 (stop-the-world migrations) | **Superseded** | The full-table fingerprint code is gone. Downtime is now allowed (06), so stop-the-world upgrades are by design. |
| ACC-02 (migrations shipped in runtime) | **Mostly closed** | Every `*_cutover.py`, `*_migration.py`, `novel_schema_backup.py`, `voice_native_purge.py` and `voice_orphan_sweep.py` is deleted, as is the unreachable `fish_calls_migration` branch. Only the `voice_legacy_models.py` rename is left (R1). |
| MIG-05 (always-skipping freeze test) | **Partial** | The freeze test is deleted. `tests/test_schema_bootstrap.py:265,651,1187,1194,1201` still pins the table count (126) and the revision literal. G1 updates them per release. |

## Wipe gaps

There are 98 tables with a user column. The wipe deletes 61 of them, by its explicit list or through FK cascades, and keeps `tb_user` itself. Of the other 36, one (`tb_llm_execution_plan`) is now redacted, and **35 are untouched**. Most of those should be kept:
- financial history (ledgers, wallets, usage days, grants, reservations);
- legal records (`user_attestation`, `voice_consent_record`, `voice_minor_report`, `voice_user_restriction`);
- admin-actor columns (`*_by_user_id` on catalog, defaults and workflow tables).

These rows hold the user's own content or configuration, and nothing classifies them:

| Table | Column | Likely class |
|---|---|---|
| `tb_llm_profile`, `tb_image_profile` | `owner_user_id` (BYOK) | `wipe` |
| `tb_llm_user_defaults`, `tb_llm_user_feature_profile`, `tb_image_user_default` | `user_id` | `wipe` |
| `tb_llm_profile_audit` | `actor_user_id` | `keep-financial-redacted` or `wipe` for owned profiles |
| `voice_abuse_counter`, `voice_free_activation`, `user_membership` | `user_id` | needs a decision (abuse and free-tier state usually survive an erasure) |

R4's erasure classification should start from this list. The classification test then stops the list from drifting again.

## What blocks R1

There is nothing left to close from the old Phase 1. [06 §2](06_migration_plan.md#2-where-things-stand-at-c056d82) decides each of its steps:

| Old steps | Outcome in 06 |
|---|---|
| 1.1, 1.2 | Dropped |
| 1.3 | Replaced by the §3.2 upgrade-script contract |
| 1.4 | Done |
| 1.5, 1.8 | Moved to R4 |
| 1.6 | Moved to R6 |
| 1.7 | Deferred |
| 1.9 | Split between R1 and R6 |

The next release, R1, starts after R0:

| R0 step | Status at 2026-10-25 | Closed when | Needs |
|---|---|---|---|
| R0.1 Backups + restore drill | **Open.** No schedule. The dumps sit on the laptop. | A restored copy passes `verify_mysql_schema` and a row-count diff | Owner: off-host storage |
| R0.2 Dedicated MySQL 8.4 (D-8) | **Open.** `.90` runs 8.1.0 with server defaults. Compose uses `mysql:8`. | The verifier passes on 8.4 and row counts are equal | Owner: decision D-8 and the host |
| R0.3 Commit smoke work; redeploy HEAD | **Open.** Uncommitted in the BFF: 33 `scripts/smoke_novel_*` files, `scripts/smoke_novel_feature_flags.py`, `tests/scripts/test_novel_smoke_runtime.py`, `.coveragerc`, `docs/deployment.md`. `.90` runs a build from before `fceaead`. | Committed. Deployed. The PERF-01 counters stay flat. | Owner: the redeploy |
| R0.4 Gates G1–G8, `verify_release.sh` | **Blocked by the red unit suite** ([Test baseline](#test-baseline)) | All gates green on the current schema | Code: repair or quarantine the failing tests first |
| R0.5 Upgrade-script template | **Open; can start now** | R1's script dry-runs through it | Code |

**Can start now without owner action:**
- the test-suite repair;
- R0.5;
- the G1–G3 harnesses;
- committing the smoke work.

**Needs the owner:** R0.1, R0.2 and the redeploy in R0.3.

Before committing `docs/deployment.md`: it trips `tests/test_no_mongo_imports.py`, which forbids the word `motor`.

## Test baseline

**Run:** 2026-10-25, BFF `c056d82` plus the working tree, one test directory at a time. A single full run hung for 25 minutes. `pytest-timeout` is not installed, so one stuck test stalls everything. For comparison, the failing groups also ran on a detached worktree at the audit commit `f7229af`.

| Group | HEAD `c056d82` | Audit `f7229af` |
|---|---|---|
| `tests/agent_graphs` | 175 passed | — |
| `tests/integration` | 13 passed, 680 skipped (no MySQL socket configured) | — |
| `tests/models` | **10 failed**, 1,885 passed | Same 10 fail |
| `tests/routes` | **522 failed**, 1,616 passed | Same 522 fail |
| `tests/scripts` | 365 passed | — |
| `tests/services` | **18 failed**, 8,004 passed, 1 collection error. **2 files hang:** `test_fish_audio.py`, `test_fish_call_admission.py`. Run file by file, with each hanging file capped at 180 s. | Same 18 fail; both files hang |
| `tests/voice` | **59 failed**, 1,068 passed | Same 59 fail |
| `tests/test_*.py` | **52 failed, 3 collection errors**, 1,391 passed | 64 failed, 3 errors |
| `tests/providers` | 0 tests collected | — |

**At the top level:**
- 13 of the audit-time failures are gone, because their tests were deleted with the migration code.
- One failure is new: `test_no_mongo_imports.py`. The uncommitted `docs/deployment.md` causes it.
- **No test that passed at the audit fails now.**

**Main causes (grouped by error message, not checked test by test):**
- **499 tests** (445 routes, 46 top-level, 8 voice) fail with `RuntimeError: MySQL pool is not initialized`. A request reaches a real DB call that the fixtures don't fake. The likeliest source is the new feature-flag and membership checks: 16 more fail with `FEATURE_FLAG_UNAVAILABLE`, and 4 model tests fail with `KeyError: 'revision'` in `feature_flags.py`.
- **4 collection errors**, from tests that no longer match the code:
  - `test_chat_ws_workspace.py` and `test_conversation_persistence.py` import `DEFAULT_RESPONSE_XML`, which the XML → JSON chat change (`ca80cdc`) removed. So does `tests/services/test_turn_language.py`.
  - `test_voice_call_chat_integration.py` imports `VoiceOrchestrationEngine`, which no longer exists.
- **Voice call guards** map errors to `internal` where the tests expect `tts_unavailable`, `permission_*` or `disabled`.
- **Schema contract (relevant to G1):** `tests/test_schema_bootstrap.py::test_every_runtime_typed_json_column_has_a_named_database_shape_check` fails at both commits.
- **Hangs**, at both commits:
  - `tests/services/test_fish_audio.py::test_cancelled_supplier_attempt_releases_capacity_once`;
  - `tests/services/test_fish_call_admission.py`, after its first test fails.

  Both are cancellation and capacity-release tests.

**For R0.4:**
1. Add `pytest-timeout` (for example `timeout = 120` in `pytest.ini`) so a hang fails one test instead of stalling the run.
2. Fix or explicitly quarantine the failures above.
3. Record the green run as the baseline.

Until then, a green G2 or G3 would be built on a suite that already ignores 661 failing tests.
