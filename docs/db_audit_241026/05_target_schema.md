# 05 — Target schema: one consolidated, robust `magic_worlds`

**Goal:** fewer parallel mechanisms, explicit relations, bounded growth and cheaper evolution, while keeping every feature in [04](04_feature_preservation_matrix.md).

**Result (original long-term design, §1–4):**
- **126 → about 100 tables.** Dropped as a target on 2026-10-25; the current refactor (§0) ends at 120.
- The scope key in 67 tables drops from 3 columns to 1.
- About **75% fewer bytes are written per novel autosave**.
- Two kinds of binary payload move out of MySQL.
- Every money, quota and media relation becomes an FK.

This is a target to validate phase by phase ([06](06_migration_plan.md)), not a big-bang rewrite.

> **Revised 2026-10-25.** §0 is the target for the current refactor ([06](06_migration_plan.md) R1–R6). §1–4 are the original long-term design, kept for reference. **Where they conflict, §0 wins.** The table count lands at about 120, not about 100.
>
> **Status 2026-10-26.** §0 is applied to `.90`: 120 tables, marker `2026_10_db_refactor` ([README](README.md#execution-status-2026-10-26)). The §1–4 consolidations are not planned. The priority is performance and operations, not the table count.

## 0. Target for this refactor (checked against backend `c056d82`)

### Conventions

| # | Verdict | Reason |
|---|---|---|
| C1 one scope key | **Deferred** | About 3–4 weeks: 350 + 313 scope predicates, 237 triple lists, 134 `resolve_app_scope` calls. It does not fit project-level rows (12 LLM/image tables have no group hash), global rows (empty triple), the circular default-workspace pointer, or legal-kept `user_attestation`. Isolation is unchanged either way. |
| C2 one UUID type | **Dropped** | Many ids are not UUIDs: `usr-…`, `vk_…`, `pd_`/`pv_`, `vsa_`, 32-hex, client opaque ids, request-id or sha256 task ids. UUIDv7 fails the `[1-5]` CHECKs and has no stdlib generator on Python 3.12. The `BIGINT` widening of `user_id`/`adventure_id` is deferred. |
| C3 time | **UTC done** via `init_command`. **`DATETIME(3)` deferred.** | The verifier parser rejects `CURRENT_TIMESTAMP(3)`, and story snapshots rely on second precision. |
| C4 lookup tables | **Dropped** | Seeds are exact-matched by the verifier, so they save no schema release. |
| C5 policy out of DDL | **Dropped: keep all CHECKs** | The database is the only guard for ETL and scripts. |
| C6 blobs out of MySQL | **Deferred** (story backlog) | 5.5 MB today |
| C7 retention classes | **Kept**, declared in code | R6, FK-safe leaf tables first |
| C8 erasure declared | **Kept**, enforced by a test | R4 |
| C9 naming | **Deferred** | Merged tables keep the surviving table's name. |

### Domains

| Domain | Today → this refactor | Changes |
|---|---|---|
| Identity | 5 → 5 | None. PERF-01 is fixed. |
| Workspaces & library | 6 → 5 | `tb_content_operation_context` → origin columns on `tb_llm_execution_plan` (R5). The job context rows are dropped; they were never read. `tb_workspace_scope` stays. |
| Cards | 6 → 5 | `tb_card_body` merged into `tb_card` (R5), keeping the deferred-join list indexes. `tb_card_copy_receipt` stays: it needs `intent_hash` conflict detection and no expiry. |
| Conversations + assistants | 5 → 5 | `tb_llm_assistant_turn` stays as a 1:1 child, because it cascades from its conversation. Multi-valued index with a `MEMBER OF` rewrite (R1). |
| Lorebooks | 5 → 5 | Generated, indexed columns for the extraction lookup on execution `result` (R1). |
| Jobs & media | 7 → 7 | Per-kind job tables stay. `archived_at` on image and TTS jobs; `resource_task` narrowed to PDF import and lorebook extraction; the tasks drawer becomes one `UNION ALL` (R3). Optional R3b: one `media_asset` (−2 tables) with a composite FK from `tb_workspace_media`. |
| LLM + image profiles & execution | 21 → 20 | `tb_operation_receipt` dropped (R5). Profiles tombstoned on wipe (R4). Typed target columns on the execution (R4). Optional payload split (+1). Defaults, reservation and execution merges deferred. |
| Billing & quotas | 16 → 16 | Every table kept. Usage day computed once per transaction (R4). Dead columns dropped. |
| Voice | 29 → 27 | `voice_consent_record` dropped (D-1, R1). `session_voice_setting` → columns on `adventure_session` (R5). `voice_key` FKs on 6 columns (R1). `voice_quota_capacity`, `voice_call_metrics`, the voice reservation and the usage tables stay. |
| Story Studio | 25 → 24 | Drop `story_scene_term`, `story_scene_statistics`, `story_novel_statistics`; add `story_scene_text` and a novel terminal-receipt table. Pointer receipts and no duplicate document (R2). `story_operation_receipt` and `story_export_job` stay. |
| System | 1 → 1 | `content_schema_revision` stays. There is no `schema_migration`. |
| **Total** | **126 → 120** (applied to `.90` on 2026-10-26) | |

### Corrections to §1–4

- **"45 `uq_*_scoped_identity` keys" and "148 indexes" (C1).** The real counts are 8 such keys and 109 declared keys with `project_hash`.
- **`tb_card` + `tb_card_body`: "the list query always joins both" is wrong.** The list counts and pages on `tb_card` alone (`workspace_models.py:671-706`).
- **The jobs target has no home for `resource_task` ids** (`X-Request-Id` or sha256, owner-scoped PK) or for `story_export_job`. Theme songs do have a kind-specific column, `model_alias`.
- **`llm_execution_payload` with an operational TTL breaks replay, retry, recovery and story history.** Redact in place instead. Graph-by-reference does not work: the stored graph is bound per call.
- **`reservation`** conflates voice call seconds with credits, which are debited after the call and never reserved.
- **`usage_day`'s key drops the group scope and `plan_code`.**
- **`credit_ledger` would double-count PAYG spends,** which today write a row in both ledgers.
- **`idempotency_receipt` loses** the copy receipt's conflict detection and the story receipts' per-story key and durable role.
- **Voice:** `voice_consent` is deleted by the wipe today, not kept. `voice_reference` should not get a `voice_key` FK: it is a derived table.
- **§4 "the verifier reads `schema_migration` and allows additive objects"** no longer applies. The verifier stays strict, and changes ship in windows.

## 1. Conventions (apply to every new or rebuilt table)

| # | Convention | Replaces | Why |
|---|---|---|---|
| C1 | **One scope key.** `account_scope(scope_id BIGINT PK, user_id, project_hash, user_group_hash, default_workspace_id, created_at, UNIQUE(user_id, project_hash, user_group_hash))`. Scoped tables carry `scope_id`, and `workspace_id` where content is workspace-bound. Composite FKs `(parent_id, scope_id)` keep the "child cannot cross tenants" guarantee. | The `(user_id, project_hash, user_group_hash)` triple in 67 tables and 148 indexes; the 45 `uq_*_scoped_identity` keys; `tb_workspace_scope` | The same isolation with an 8-byte key instead of about 90 bytes. Simpler WHERE clauses. One place to change scope semantics. |
| C2 | **One UUID type.** `CHAR(36) CHARACTER SET ascii COLLATE ascii_bin`, UUIDv7 for new rows. Numeric surrogates are `BIGINT UNSIGNED`. | `varchar(64) utf8mb4_bin` (229 columns), `char(36) utf8mb4_bin` (91), `char(35)` / `char(32)` / `varchar(128)` variants | Deterministic width, 1 byte/char in sort and temp buffers, time-ordered inserts. |
| C3 | **Time.** `DATETIME(3)` in UTC. The pool sets `time_zone='+00:00'` on connect. SQL uses `UTC_TIMESTAMP(3)` / `UTC_DATE()` only. | 219 `DATETIME(0)` columns; mixed `NOW()`, `CURDATE()`, `UTC_TIMESTAMP()`, `UTC_DATE()` | Quota day boundaries stop depending on the host time zone (OPS-08). |
| C4 | **Vocabularies in lookup tables.** `operation`, `job_kind`, `llm_feature` (exists), `ledger_event_type`, referenced by FK. Keep `ENUM` only for closed, structural sets (status lifecycles). | Many `ENUM`s and `CHECK (x IN (...))` lists (resource_task, receipts, plan operations) | Adding an operation becomes a row insert, not DDL plus a verifier change plus a migration. |
| C5 | **Integrity in the DB, policy in the app.** Keep CHECKs for invariants: non-negative amounts, lifecycle/timestamp consistency, scope non-empty. Remove business-policy CHECKs, such as the receipt table pinned to `card_generation`. JSON CHECKs only assert `type: object/array`. | 309 CHECKs (85 `json_schema_valid`, 40 `regexp_like`) | Product changes no longer need DDL. |
| C6 | **Blobs out of MySQL.** Rows hold `storage_backend`, `storage_path`, `sha256` and `bytes`. Bytes live in the media store. | `story_import_source.content`, `story_export_file_chunk.data` | Smaller buffer-pool footprint, backups and binlog. |
| C7 | **Bounded growth.** Every append-only table declares a retention class: `legal` (keep), `financial` (keep, prunable after N years), `operational` (TTL), `derived` (rebuildable). A janitor job enforces it. | Unbounded revisions, receipts, payloads, events, metrics | Growth is a policy decision, not an accident. |
| C8 | **Erasure is declared.** Every table with a user/owner column is classified `wipe`, `keep-legal`, `keep-financial-redacted` or `cascade`. A schema test fails if a table is unclassified. | The hand-maintained list at `models.py:6128-6170` | Prevents INT-01 recurring. |
| C9 | **Naming.** Every table that gets rebuilt drops the `tb_`/`cat_` prefixes and uses `created_at`/`updated_at` and the `pk_/uq_/ix_/fk_/ck_` prefixes. Tables kept as-is are **not** renamed just for style. | 36 `tb_*`/`cat_*` tables, `creation_at`, `adventure_created_at` | Consistent names, with minimal churn. |

## 2. Domain-by-domain target

Legend: **=** unchanged · **~** altered (columns or keys) · **⊕** new or merged · **✕** removed.

### Identity & account (5 → 4)

| Target | From | Notes |
|---|---|---|
| ~ `tb_user` | `tb_user` | `BIGINT UNSIGNED` id. The identity upsert only fires when the identity is missing or changed (PERF-01). |
| = `user_preferences`, `user_attestation`, `user_notification` | same | |
| (`user_membership` moves to Billing) | | |

### Workspaces & library (6 → 5)

| Target | From | Notes |
|---|---|---|
| ⊕ `account_scope` | `tb_workspace_scope` + the triple | Holds `scope_id` and the default-workspace pointer |
| ~ `tb_workspace` | same | Gains `scope_id` |
| = `tb_collection`, `tb_collection_card` | same | |
| ~ `tb_workspace_media` | same | Real FK `asset_id → media_asset` (polymorphic today) |
| ✕ `tb_content_operation_context` | — | Becomes origin columns on `job` and `llm_execution` (`origin_workspace_id`, `requested_collection_ids`, `terminal_organization`) |

### Cards (6 → 4)

| Target | From | Notes |
|---|---|---|
| ⊕ `card` | `tb_card` + `tb_card_body` (always 1:1; the list query always joins both) | One row per card: header and published body |
| = `card_version`, `card_draft`, `card_share_link` | `tb_card_version`, `tb_card_draft`, `card_share_link` | |
| ✕ `tb_card_copy_receipt` | → `idempotency_receipt` | |

### Conversations (5 → 4)

| Target | From | Notes |
|---|---|---|
| ~ `adventure_session` | + `session_voice_setting.tier_override` | 1:1 and cascades, so it becomes a column. Multi-valued index on `character_ids_snapshot` (PERF-06). |
| = `adventure_message`, `assistant_conversation`, `assistant_message` | same | Their semantics differ too much to merge safely, so they stay separate. |
| ✕ `tb_llm_assistant_turn` | → `llm_execution` assistant columns | Already 1:1 with the execution (PK = `execution_id`) |

### Lorebooks (5 → 5)

All five tables are unchanged. They only gain `scope_id`.

### Jobs & media (7 + 2 story tables → 4)

| Target | From | Notes |
|---|---|---|
| ⊕ `job` | `image_job`, `tts_job`, `theme_song_job`, `resource_task`, `story_export_job` | Holds the common lifecycle: `job_id`, `scope_id`, `workspace_id`, `kind`, `status`, `lease_expires_at`, `attempt_token`, `provider*`, `trace_id`, `input_summary`, `result_summary`, `error_*`, attempt counters, `submitted/completed/created/updated/archived_at`, `target_type/target_id`, origin columns. **Indexes:** `(kind, status, created_at)` for the sweepers and `(scope_id, workspace_id, archived_at, status, created_at)` for the tasks drawer. |
| ⊕ `job_image` | the image-specific columns | Prompt, profile, credential mode, card/adventure/turn refs, webhook dedupe |
| ⊕ `job_tts` | the TTS-specific columns | Adventure/message/turn/segment, voice, `reservation_id` (was `turn_charge_id`) |
| ⊕ `media_asset` | `image_asset`, `tts_asset`, `theme_song_asset`, export files, import sources | `kind`, storage, `sha256`, dimensions/duration, `deleted_at` |
| ✕ `story_export_file_chunk` | → `media_asset` | |

**What this fixes for users:**
- The tasks drawer becomes one indexed query. Today it uses 4 sources, plus `resource_task` rows used as archive markers for other tables' jobs.
- Each sweeper becomes one indexed predicate.

### LLM profiles & execution (18 + 3 image = 21 → 16)

| Target | From | Notes |
|---|---|---|
| = `llm_feature` | `cat_llm_feature` | |
| = `tb_llm_profile`, `_revision`, `_current`, `_role`, `_audit` | same | The audit table gains image-profile events |
| = `tb_image_profile` | same | LLM and image profiles stay separate: different versioning |
| ⊕ `llm_profile_default` | `tb_llm_system_defaults`, `tb_llm_user_defaults`, `tb_llm_system_feature_profile`, `tb_llm_user_feature_profile` | `(project_hash, user_id NULL, feature_key NULL)`, unique through a functional key |
| ⊕ `image_profile_default` | `tb_image_system_default`, `tb_image_user_default` | Same shape |
| = `tb_llm_project_state`, `tb_llm_catalog_snapshot` | same | `project_state` is a lock anchor; it is documented as one |
| = `tb_llm_workflow`, `_revision`, `_current` | same | Admin agent studio (decision D-3) |
| ⊕ `llm_execution` | `tb_llm_execution_plan` + `tb_llm_assistant_turn` + `tb_llm_card_generation` + the novel terminal receipt | The billing/provenance record: kept as financial, with content redacted on wipe |
| ⊕ `llm_execution_payload` | `frozen_payload`, `result` | **Operational TTL** (e.g. 30 days), deleted on wipe. It stores a graph **reference** (`graph_key` + hash) instead of copying `agt` on every call. |
| ✕ `tb_operation_receipt` | → `idempotency_receipt` | |

### Billing, membership & quotas (16 + 3 from other domains = 19 → 11)

| Target | From | Notes |
|---|---|---|
| = `membership_plan`, `membership_plan_limit`, `membership_plan_feature_flag`, `membership_feature_mutation`, `membership_quota_reset`, `user_membership` | same | |
| ~ `credit_wallet` | `payg_credit_wallet` | |
| ⊕ `credit_ledger` | `membership_credit_ledger` + `payg_credit_ledger` + `tts_turn_charge_ledger` | `bucket` (`included`, `payg_free`, `payg_billed`), `event_type`, signed `delta`, `balance_after` (wallet buckets), `operation_id` FK, **`reservation_id` FK**, idempotency key |
| ⊕ `credit_grant` | `credit_code_grant` + `email_credit_grant` | `source` (`code` / `email`) |
| ⊕ `reservation` | `tb_operation_reservation` + `tts_turn_charge` + `voice_quota_reservation` | `kind` (`llm_operation`, `narration_turn`, `voice_call`), `status`, lease, `usage_day`, reserved/consumed units, typed nullable columns per kind |
| ⊕ `usage_day` | `membership_usage_day` + `membership_operation_usage_day` + `tb_operation_usage_day` + `voice_usage_day` | `(user_id, operation, payer_mode, usage_date)` with `credits_used`, `accepted_count`, `request_count`, `billable_seconds`, `reserved_seconds`, `consumed_seconds`. An `operation='*'` row is the per-user lock anchor, as `membership_usage_day` is today. |

**Why this merge matters:**
- Today a credit can be linked to its cause in **three different ways**:
  - a junction table (`tts_turn_charge_ledger`);
  - a JSON array of ledger ids (`tb_operation_reservation.credit_ledger_ids`);
  - a `varchar(64)` column (`tts_turn_charge.ledger_entry_id`, `voice_preview_render.ledger_entry_id`).
- None of the last two are FK-checked.
- One `reservation_id` FK makes refunds and reconciliation provable in SQL.

**Do this merge last.** Billing invariants were re-audited on 2026-10-17 (`docs/billing/plan-audit-2026-10-17/`), and its tests are the parity gate.

### Voice (29 → 24)

| Target | From | Notes |
|---|---|---|
| ~ catalog: `voice_catalog`, `_language`, `_acceptance`, `_event`, `voice_sample_asset`, `voice_reference`, `voice_default` | same | **Add FKs on `voice_key`** (6 tables reference it with no FK; 0 orphans today) |
| = safety/legal: `voice_consent`, `voice_consent_record` (D-1), `voice_minor_report`, `voice_user_restriction`, `voice_abuse_counter`, `voice_free_activation` | same | Kept on wipe |
| ~ `voice_runtime_setting` | + `voice_quota_capacity` | The global capacity lock becomes a keyed row in the settings table |
| = `voice_preset`, `voice_pronunciation_dictionary`, `_version`, `voice_preview_render` | same | `voice_preview_render.ledger_entry_id` becomes a ledger FK |
| ~ `voice_session` | + `voice_call_metrics` (1:1, upserted at call end) | |
| = `voice_transcript_segment`, `voice_turn_metrics` | same | |
| = `speech_provider_account`, `speech_provider_attempt`, `voice_spend_daily` | same | The spend rollup stays: it is a fast circuit-breaker read |
| ✕ `session_voice_setting`, `voice_quota_capacity`, `voice_call_metrics` | merged into other tables | |
| ✕ `voice_quota_reservation`, `voice_usage_day` | → `reservation`, `usage_day` | |

### Story Studio (25 → 21)

The full reasoning is in [03](03_story_studio.md).

| Target | From |
|---|---|
| ~ `story_novel` | + typed statistics columns and `annotation_revision` |
| = `story_part`, `story_chapter` | |
| ~ `story_scene` | Header plus counter columns. **No document copy.** |
| ⊕ `story_scene_text` | `plain_text` keyed by `(scene_id, revision)` |
| ~ `story_scene_revision` | Compressed or delta body, plus `story_id`, `schema_version`, `byte_size`. Serves the current document. |
| ⊕ `story_snapshot`, `story_snapshot_scene` | Out of `story_structure_revision.operation._snapshot`. The scene rows are relational revision pins. |
| ~ `story_structure_revision` | Stores changed units plus keyframes |
| = `story_annotation`, `story_annotation_event`, `story_card_ref`, `story_generation`, `story_generation_variant`, `story_writing_log`, `story_erase_record` | |
| ~ `story_plan_item` | Plus an FK to `story_scene` |
| ~ `story_scene_retrieval` | Plus a compressed term vector |
| ~ `story_import_source` | Record plus storage path; the blob goes to the media store |
| ⊕ `story_media_ref` | Replaces the `JSON_SEARCH '$**.coverAssetId'` scans |
| ⊕ `story_assistant_setting` | `story_assistant_preference` + `story_assistant_preset` (optional) |
| ✕ `story_scene_term`, `story_scene_statistics`, `story_novel_statistics`, `story_annotation_head`, `story_export_job` / `_file_chunk` (→ `job` / `media_asset`), `story_operation_receipt` (→ `idempotency_receipt`, plus terminal accounting → `llm_execution`) | |

### Shared infrastructure (1 → 2)

| Target | From | Notes |
|---|---|---|
| ⊕ `idempotency_receipt` | `story_operation_receipt` (replay part), `tb_card_copy_receipt`, `tb_operation_receipt` | `(scope_id, operation, request_id)` unique; `subject_type/subject_id`; `status`; `response` (a pointer, not a copy, for story units); `expires_at`. A nullable `story_id` FK keeps cascade-on-erase. |
| ⊕ `schema_migration` | `content_schema_revision` | Full history: `version`, `name`, `checksum`, `applied_at`, `applied_by`, `duration_ms`, `outcome` |

## 3. Tally

| Domain | Today | Target |
|---|---:|---:|
| Identity | 5 | 4 |
| Workspaces & library | 6 | 5 |
| Cards | 6 | 4 |
| Conversations + assistants | 5 | 4 |
| Lorebooks | 5 | 5 |
| Jobs & media | 7 | 4 |
| LLM + image profiles & execution | 21 | 16 |
| Billing & quotas | 16 | 11 |
| Voice | 29 | 24 |
| Story Studio | 25 | 21 |
| Shared infra / system | 1 | 2 |
| **Total** | **126** | **100** |

Tables are counted once, in their target domain. `user_membership`, `voice_quota_reservation` and `voice_usage_day` move into Billing.

## 4. What does not change

- **One MySQL schema, raw SQL, no ORM.** There is no reason to change the stack.
- **The runtime schema verifier stays**, but it reads the contract from `schema_migration` plus `db.sql`, and it has an allow-list for additive objects (MIG findings).
- **The hard guarantees stay.** Ownership via composite FKs, idempotent replay, the terminal-commit atomicity of chat turns, legal retention, and the no-provider-URL rule for public media.
- **Adventure and character chat** keep sharing `adventure_session` / `adventure_message`.
- **LLM and image profiles** stay separate tables.
