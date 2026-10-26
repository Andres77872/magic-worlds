# Database audit: `magic_worlds` on 192.168.1.90 (2026-10-24, plan revised 2026-10-25)

**Dates:**
- Audit snapshot: 2026-10-24.
- Plan revision: 2026-10-25. The 2026-10-24 plan was re-checked against backend HEAD `c056d82` and rewritten for a refactor with downtime allowed.

**Scope:**
- The live MySQL database `magic_worlds` on `192.168.1.90:3306` and the server it runs on.
- How `magic-worlds-api` reads and writes it: pool, transactions, queries, migrations, verifier.
- What each table means for the features of this SPA.

**Out of scope:**
- The other databases on the same server. They are noted only where they affect `magic_worlds`.
- MySQL user accounts, privileges and TLS/SSL transport. The audit covers architecture and the database schema.

**Method (2026-10-24 audit):**
- **Read-only.** Every query ran under `SET SESSION TRANSACTION READ ONLY`. No data, schema or code was changed.
- **Live evidence:**
  - `information_schema` (DDL, sizes, constraints);
  - exact `COUNT(*)` for all 126 tables;
  - `performance_schema` / `sys`: 2,000 statement digests from 2026-10-11 to 2026-10-24, plus full-scan, redundant-index and unused-index views;
  - data checks for orphans, stuck jobs, payload sizes and duplicate documents;
  - the backend's own `verify_mysql_schema()`, which passed: live = `db.sql`.
- **Code review** by three independent reviewers: the data-access layer and migration tooling; the Story Studio data model; and a route → service → SQL inventory of all 508 handlers.
- **Re-checks by hand.** Each high-severity claim was re-checked against the code or live data.

**Method (2026-10-25 revision):**
- Six read-only domain reviews of the 05 target against the code at `c056d82`:
  - foundation conventions;
  - cards, workspace and conversations;
  - jobs and media;
  - LLM execution and billing;
  - Story Studio;
  - voice, erasure and retention.
- Key claims were re-checked by hand: the corrected scope-key counts, the `/tasks` gate bug, the usage-day boundary, the unredacted `effective_config`, and the resource-task id format.
- Code only. The live database was not queried again.

**Line references:** findings 02–05 cite the audit snapshot. The two later commits shifted some `models.py` references by about +12 to +50 lines, and references into deleted migration files are stale. The plan (06) and the status section of 02 cite `c056d82`.

**Repo states:** SPA `8c7b556e`; BFF `f7229af` at the audit, `c056d82` at the revision. Schema marker `2026_10_voice_turn_metrics` (unchanged).

## Execution status (2026-10-26)

R1–R6 are implemented as **one bundled upgrade**, `2026_10_voice_turn_metrics` → `2026_10_db_refactor`, run by `scripts/upgrades/runner.py` in the BFF. **Not yet applied to `.90`.**

**Backup and rehearsal**
- The pre-refactor dump of `.90` is verified (sha256 recorded next to it).
- A restore into MySQL 8.4 passes the verifier, and its row counts equal live.

**Bundled dry run on that restore: OK**
- Tables go from 126 to 120. Apply takes about 2.2 s.
- Every step's preflight and parity postcheck passes, and so do a full FK orphan scan and `verify_mysql_schema`.

**G6 read parity:** 11,089 GETs from 24 users, comparing old code on v1 with new code on the upgraded copy.
- 3 `/tasks?operation=pdf_import` responses differ: they now return the imports (the NEW-03 fix).
- 1 `/llm/receipts` response differs: 4 legacy "unattributed" receipts are dropped together with `tb_operation_receipt`. The run acknowledges them with `MW_R5_DROP_UNATTRIBUTED_RECEIPTS=4`.

**R2 bytes per autosave:** 4.69 × text before, 1.44 × text after.

**Test suite (R0.4):**
- Before: 661 unit failures and 488 integration failures, plus 2 hanging files.
- After: green on its own, with `REQUIRE_DB_TESTS=1`, the G1/G5 gates and `scripts/verify_release.sh`.
- Strict xfails left open: a concurrent-admission deadlock, the transient-key filtering removed in 7f7eac7, and the missing `membership_feature_mutation` payload CHECKs.

**What deviated from 06**
- `story_structure_revision.op` is a plain column with an equality CHECK. It is not a generated column.
- R3b and the payload split were not done.
- The R6 janitor runs daily at 04:15 UTC. It can be switched off with `RETENTION_JANITOR_ENABLED=false`.

## Documents

| # | Document | What it holds |
|---|---|---|
| 01 | [Live inventory](01_live_inventory.md) | Server profile, the 126 tables by domain, sizes, data composition, workload (snapshot 2026-10-24) |
| 02 | [Findings register](02_findings.md) | 40 findings with severity, evidence, impact and fix, a **status update at `c056d82`**, and 8 new findings from the revision |
| 03 | [Story Studio data model](03_story_studio.md) | The 25 `story_*` tables: 73% of the bytes, and the largest write amplification |
| 04 | [Feature preservation matrix](04_feature_preservation_matrix.md) | Every user feature → routes → tables, and what must be preserved |
| 05 | [Target schema](05_target_schema.md) | **§0: the target for this refactor (126 → about 120).** §1–4: the original long-term design, kept for reference |
| 06 | [Refactor plan](06_migration_plan.md) | Per-domain upgrades in maintenance windows (R0–R6), validation gates G1–G8, runbook, decisions, effort |
| 07 | [Phase 0 closeout](07_phase0_closeout.md) | Live re-check on `.90` (2026-10-25). **HEAD is not deployed** there, and the stale schemas are already dropped. The backend unit suite is red (661 failures and 2 hanging files, all from before the audit), which blocks R0.4. Also holds the R0 status and the full test baseline. |
| — | [`evidence/`](evidence/) | Raw query outputs: exact row counts, top statements, scans, indexes, reference columns without an FK. No personal data. |

## Verdict

**The schema is carefully built, and it is too expensive to run and to change. The fixes that matter are narrower than the 2026-10-24 target suggested.**

What is strong:
- The live schema matches `db.sql` exactly, and boot refuses any drift.
- 171 FKs and 309 CHECKs enforce ownership, lifecycle and idempotency in the database itself.
- There are no stuck jobs.
- Most "redundant" indexes are deliberate composite-FK targets.
- Dynamic SQL is clean: 551 interpolation sites checked.

Already fixed in code since the audit (`fceaead`, `c056d82`). **None of it is deployed on `.90` yet** ([07](07_phase0_closeout.md)):
- UTC on every connection.
- Read-first identity.
- No provider download under a row lock.
- Pool bounds and an acquire timeout.
- Execution payloads redacted on wipe.
- Smoke isolation.
- The historical migration chain removed.

What remains:
1. **Operations.**
   - There are no backups or restore drills.
   - The database runs on a shared, default-sized MySQL 8.1 (an out-of-support release).
   - Slow log and deadlock logging are off.
2. **Validation is weaker than it looks.**
   - All 33 DB-backed test files skip unless a MySQL socket is configured.
   - Neither repo has CI.
   - Most model tests assert SQL text against a fake cursor.
3. **Growth.**
   - One novel autosave appends about 4.65 copies of the prose.
   - No table has a retention rule.
4. **Erasure gaps.**
   - "Delete my data" still leaves `effective_config`, 8 profile and default tables, and the media files on disk.
   - Deleting a chat leaves its full prompt history in the execution payloads.
5. **Hot paths.**
   - The tasks drawer reads 4 sources plus archive markers, then makes one lookup per media job, 3 times per poll.
   - Sweepers and JSON lookups have no fitting index.

**Several 05 consolidations do not survive contact with the code** ([06 §4](06_migration_plan.md#4-what-this-plan-does-not-do-deferred-from-05)):
- The single scope key would take 3–4 weeks and doesn't fit project-level or global rows.
- Many ids are not UUIDs.
- The billing merges would double-count or lose links.
- The `job` and `llm_execution` merges break lock and cascade semantics.

They are deferred or dropped.

**Downtime is allowed,** so the plan uses short maintenance windows instead of dual writes or online-migration tooling. Each domain ships as one reviewed upgrade script, gated by tests that run against a real database.

## Plan at a glance ([06](06_migration_plan.md))

| Release | What | Days |
|---|---|---:|
| R0 | Backups and restore drill; dedicated MySQL 8.4 LTS; commit the smoke work and **redeploy HEAD**; **validation gates G1–G8**; upgrade-script template | 6–8 |
| R1 | Sweeper, list and JSON indexes; `voice_key` FKs; drop dead indexes; D-1; `/tasks` gate fix; stale SPA prefixes | 3–4 |
| R2 | Story Studio: pointer receipts, no duplicate document, statistics columns, no term table, terminal receipt table | 11–14 |
| R3 | Tasks drawer as one query; archive markers removed; batched lookups (optional `media_asset`) | 4–5 |
| R4 | Erasure classification enforced by a test; profile tombstones; `effective_config` and file cleanup; D-4; usage-day boundary fix | 8–10 |
| R5 | Card header/body merge; operation context → columns; session voice setting → columns; drop `tb_operation_receipt` | 7–8 |
| R6 | Retention janitor for the FK-safe operational tables | 2.5 |

Total: about 42–52 engineer-days. Each release passes the gates in [06 §3](06_migration_plan.md#3-validation-framework):
- schema contract;
- DB tests always run;
- golden API scenarios before and after;
- a dry run on a production copy with parity checks;
- a usage report (unused indexes, full scans, dead tables and columns);
- API read parity;
- SPA build and smoke;
- in-window checks.

## Decisions needed

Full list with what each one blocks: [06 §7](06_migration_plan.md#7-decisions).

| ID | Decision | Recommendation |
|---|---|---|
| D-1 | `voice_consent_record` is never written | Drop it (R1) |
| D-2 | Call telemetry is written, never read | Keep it with a 90-day TTL (R6) |
| D-4 | Media and payloads when a chat is deleted | Delete narration audio, keep images, redact payloads (R4) |
| D-5 | Retention periods | Operational 90 d; payload redaction 30 d; financial set by legal |
| D-6 | Strategy | **Resolved:** per-domain in-place upgrades in windows |
| D-8 | Infrastructure | A dedicated MySQL 8.4 LTS instance (R0) |
| D-9 | BYOK profiles on wipe | Tombstone, because the FKs block a delete (R4) |
| D-11 | Windows: one per release or bundled; rollback horizon | One per release; 1 h |
| D-12 | Open billing-audit findings F1/F3/F4 | A separate track |

D-3 (workflows), D-7 (story history pruning) and D-10 (purge synthetic accounts) do not block this refactor.

**Destructive steps** need explicit approval:
- deleting `.dev/backups/*.sql.gz` once a managed backup exists. This includes `stale-magic-worlds-copies-20261024.sql.gz`, which holds user data.
- The 31 integration-test schemas and the 3 stale `magic_worlds_*` copies are already dropped ([07](07_phase0_closeout.md)).
