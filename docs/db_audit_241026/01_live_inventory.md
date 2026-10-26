# 01 — Live inventory: `magic_worlds` on 192.168.1.90

**Captured:** 2026-10-24, read-only (`SET SESSION TRANSACTION READ ONLY`), via `information_schema`, `performance_schema`, `sys` and the backend's own verifier. Raw outputs are in [`evidence/`](evidence/).

## 1. Server

| Item | Value | Note |
|---|---|---|
| Version | MySQL **8.1.0** (Innovation release) | 8.1 is out of support. The LTS line is 8.4. |
| Uptime at capture | 13.5 days | `performance_schema` counters cover that window. Digests start 2026-10-11. |
| `innodb_buffer_pool_size` | **128 MB** (the default) | Shared by every schema on the instance: about **260 GB** of data. |
| `max_connections` | 151 | `Max_used_connections` = 152. `Connection_errors_max_connections` = **623**. |
| Threads connected | 130 | magic_worlds holds 17 (excluding this audit). magic_auth holds 26, idle for up to 4.4 h. |
| `wait_timeout` | 28,800 s | The app pool sets no `pool_recycle`. |
| `innodb_lock_wait_timeout` | 50 s | |
| Durability | `innodb_flush_log_at_trx_commit=1`, `sync_binlog=1`, binlog ROW | Binlogs kept 30 days. The 2026-10-16 recovery relied on them. |
| `slow_query_log` | **OFF** | |
| `innodb_print_all_deadlocks` | OFF | Deadlocks are not logged. |
| `time_zone` | `SYSTEM` (the OS is UTC) | `NOW()` equals `UTC_TIMESTAMP()` only because the host is in UTC. |
| `performance_schema_digests_size` | 10,000 (full) | Statements first seen after the table filled fall into the NULL bucket. Established digests keep counting. |

### Other schemas on the same instance

| Schema(s) | Size | Relation to magic-worlds |
|---|---:|---|
| `booru_spyder`, `magic_arxiv`, `magic_data_source`, … | ~262 GB | Unrelated projects. They compete for the 128 MB buffer pool and the 151 connections. |
| `magic_auth` | 1.3 GB | Stack sibling. `api_audit_log` 806 MB / 260K rows and `error_logs` 520 MB, with no visible retention. Out of scope; noted. |
| `auth`, `magic_llm` | small | Stack siblings. |
| `magic_worlds_old_20260803`, `magic_worlds_recover_20261016_e2d0672c`, `magic_worlds_recoverycheck_20261016_b9d4cb23` | 33 MB | **Stale copies of user data** from the 2026-10-16 reset/recovery. |
| 31 × `mw_novel_*_it_*` / `mw_story_exec_it_*` | ~1.5 GB (one is 1.27 GB) | **Integration-test databases that were never dropped** (all from 2026-10-17). |

## 2. Schema at a glance

| Metric | Value |
|---|---:|
| Base tables | **126** (no views, triggers, routines or events) |
| Columns | 1,464 |
| Indexes | 423 |
| Foreign keys | 171 |
| CHECK constraints | 309 |
| JSON columns | 93 |
| ENUM columns | 103 |
| `DATETIME` columns | 219, **all precision 0** |
| Schema marker | `content_schema_revision.revision = 2026_10_voice_turn_metrics` |
| Marker `applied_at` | 2026-10-18 10:45:28. **Stale:** the last delta created its tables 2026-10-21 06:07. |
| Live vs `db.sql` | **Identical.** `verify_mysql_schema()` passed against the live DB (4.2 s). |
| Data + index | 100.6 MB + 21.7 MB. Total rows (exact): 151,883. |

The drift risk is zero today. The strict verifier blocks startup on any mismatch.

## 3. Tables by domain

| Domain | Tables | Rows | Size (MB) | Empty tables |
|---|---:|---:|---:|---|
| Identity & account | 5 | 78 | 0.2 | — |
| Workspaces & library | 6 | 771 | 0.8 | — |
| Cards | 6 | 116 | 0.5 | `tb_card_copy_receipt`, `card_share_link` |
| Adventure & character chat | 2 | 231 | 4.7 | — |
| Assistants | 3 | 261 | 5.6 | — |
| Lorebooks | 5 | 17 | 0.6 | `lorebook_attachment`, `lorebook_resource_link` |
| Media jobs & assets | 7 | 478 | 1.3 | — |
| Image profiles | 3 | 11 | 0.2 | — |
| LLM profiles & execution | 18 | 420 | 15.0 | `tb_llm_user_defaults`, `tb_llm_user_feature_profile`, `tb_llm_workflow`, `tb_llm_workflow_revision`, `tb_llm_workflow_current` |
| Billing, membership & quotas | 16 | 2,377 | 1.6 | — |
| Voice | 29 | 1,444 | 2.5 | `session_voice_setting`, `voice_consent_record`, `voice_minor_report`, `voice_quota_reservation`, `voice_user_restriction` |
| Story Studio | 25 | 145,678 | **89.2** | `story_assistant_preference`, `story_erase_record`, `story_generation_variant` |
| System | 1 | 1 | 0.0 | — |
| **Total** | **126** | **151,883** | **122** | **17 empty** |

Members of each domain:
- **Identity:** `tb_user`, `user_preferences`, `user_attestation`, `user_notification`, `user_membership`.
- **Workspaces:** `tb_workspace`, `tb_workspace_scope`, `tb_workspace_media`, `tb_collection`, `tb_collection_card`, `tb_content_operation_context`.
- **Cards:** `tb_card`, `tb_card_body`, `tb_card_draft`, `tb_card_version`, `tb_card_copy_receipt`, `card_share_link`.
- **Chat:** `adventure_session`, `adventure_message`.
- **Assistants:** `assistant_conversation`, `assistant_message`, `tb_llm_assistant_turn`.
- **Lorebooks:** `lorebook`, `lorebook_entry`, `lorebook_attachment`, `lorebook_resource`, `lorebook_resource_link`.
- **Media:** `image_job`, `image_asset`, `tts_job`, `tts_asset`, `theme_song_job`, `theme_song_asset`, `resource_task`.
- **Image profiles:** `tb_image_profile`, `tb_image_system_default`, `tb_image_user_default`.
- **LLM:** `cat_llm_feature`, and these tables, written here without the `tb_llm_` prefix:
  - `profile`, `profile_revision`, `profile_current`, `profile_role`, `profile_audit`;
  - `system_defaults`, `user_defaults`, `system_feature_profile`, `user_feature_profile`;
  - `workflow`, `workflow_revision`, `workflow_current`;
  - `project_state`, `catalog_snapshot`, `execution_plan`, `card_generation`;
  - plus `tb_operation_receipt`.
- **Billing:**
  - plans: `membership_plan`, `_plan_limit`, `_plan_feature_flag`, `_feature_mutation`, `_quota_reset`;
  - usage: `membership_usage_day`, `membership_operation_usage_day`;
  - ledgers: `membership_credit_ledger`, `payg_credit_wallet`, `payg_credit_ledger`;
  - grants: `credit_code_grant`, `email_credit_grant`;
  - LLM operations: `tb_operation_reservation`, `tb_operation_usage_day`;
  - narration: `tts_turn_charge`, `tts_turn_charge_ledger`.
- **Voice:** 29 tables (`voice_*`, `speech_provider_*`, `session_voice_setting`).
- **Story:** 25 `story_*` tables.

## 4. Largest tables (exact rows)

| Table | Rows | Data MB | Index MB | Free MB | What fills it |
|---|---:|---:|---:|---:|---|
| `story_scene_term` | 138,339 | 19.6 | 11.6 | 7.0 | Hand-built inverted index. 94% of the payload is the repeated `story_id` + `scene_id` strings; the terms themselves are 0.6 MB. |
| `story_scene` | 1,635 | 29.6 | 1.6 | 5.0 | `document_json` (5.6 MB) **and** a derived `plain_text` copy (5.4 MB). Off-page LOB overhead takes 11.4 MB of payload to 29.6 MB on disk. |
| `tb_llm_execution_plan` | 275 | 13.5 | 0.5 | 4.0 | `frozen_payload` JSON, **~28 KB per LLM call**, kept forever. |
| `story_scene_revision` | 1,753 | 12.6 | 0 | 4.0 | A full `document_json` copy per revision. |
| `story_import_source` | 8 | 5.5 | 0 | 3.0 | Uploaded source files stored as `MEDIUMBLOB` (~700 KB each). |
| `adventure_message`, `assistant_message`, `tb_llm_assistant_turn` | 198 / 154 / 56 | 2.5 each | — | — | `metadata` / `output_snapshot` JSON dominates. |
| `story_structure_revision` | 134 | 2.5 | 0 | 4.0 | A full structure snapshot per revision. |

Story Studio is **73% of the bytes**, though it has the fewest real users. It is the main consolidation target.

## 5. What the data is

The instance on `.90` is the **development/staging** database. The data is mostly synthetic:
- **24 users.** 6 are `novel-smoke` accounts created by smoke harnesses at 08:11–09:22 on 2026-10-16, right after the reset. About 10 are `e2e_*` / `voice_*` / `test*` / `refreshdbg*` accounts. One is root, and a few are personal accounts.
- **21 novels.** All are titled "… smoke" or "… check (test novel)".
- **Real-person identifiers.** Two usernames are email-derived handles of real people. This is personal data on a shared dev server, so treat backups and stale copies accordingly. The handles are not reproduced in this audit.

The consequence matters for the refactor: **the schema can be consolidated now, at almost no data-migration cost.** That window closes as soon as real users arrive.

## 6. Workload (performance_schema, 2026-10-11 → 2026-10-24)

2,000 digests, 2.08 M statements, 2,054 s of server time in `magic_worlds`.

| Rank | Statement (normalized) | Execs | Total s | Note |
|---:|---|---:|---:|---|
| 1 | `COMMIT` | 834,109 | 530 | Every request ends in an explicit commit (`autocommit=False`), including read-only ones. |
| 2–5 | Verifier `information_schema` queries (columns, indexes, FKs, checks) | 111,688 each | 860 | About 1,440 startup verifications in 13 days. This is dev-loop and test churn, not the request path. |
| 6 | `INSERT INTO tb_user … ON DUPLICATE KEY UPDATE` | 57,226 | 103 (**60.6 s of lock time**) | The per-request identity upsert. Each one burns an AUTO_INCREMENT value: 24 rows, max `user_id` 221,308, next 234,978. |
| 7 | `tts_job` stale sweep | 22,807 | 46 | No usable index. Examined rows grow with the table. |
| 8 | `voice_session` stale sweep | 28,074 | 45 | Every execution uses no index (`OR` + `COALESCE` predicate). |
| 9 | `voice_quota_reservation ORDER BY started_at_ms` | 56,254 | 43 | Every execution uses no index. |
| 10 | `tts_turn_charge` sweeps (2 statements) | 22,808 ×2 | 62 | Correlated `EXISTS`/`NOT EXISTS` against `tts_job` on each poll. |
| 11 | `voice_preview_render` stale sweep | 22,807 | 36 | |

The sweepers poll roughly every 30 s each. At today's sizes they are cheap. Unindexed ones scale linearly with history.

### Full scans, redundant and unused indexes

- **Full scans** are mostly harmless at today's sizes: the optimizer scans tiny tables. The ones that will matter as data grows:
  - `image_job` (4.36 M rows read);
  - `story_scene_term` (3.18 M);
  - `tts_job` (0.9 M);
  - `voice_session` (0.26 M);
  - `voice_preview_render` (0.21 M).
- **Redundant indexes.** `sys.schema_redundant_indexes` lists 45. Nearly all are **intentional**: `(id, user_id, project_hash, user_group_hash)` unique keys that exist only as targets for scope-carrying composite FKs. Two are truly redundant left prefixes:
  - `adventure_session.idx_adventure_session_user`;
  - `tb_card.idx_tb_card_user`.
- **Unused indexes.** `sys.schema_unused_indexes` lists 56 since restart. This is weak evidence at dev traffic. See the evidence file before dropping any.
