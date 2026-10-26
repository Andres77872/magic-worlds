# 04 — Feature preservation matrix

**The contract for the refactor:** endpoints may change; **every capability below must keep working**, with the same data and the same guarantees. These guarantees include ownership isolation, idempotent replay, quota/credit correctness, legal retention and erasure.

## How this matrix was built

The inventory was built from three sources and cross-checked against the live table list:
- **Backend handlers.** All 508 handlers in `magic-worlds-api/src/routes/**` were parsed (AST), and calls were followed down to the SQL that names tables.
- **SPA calls.** All calls in `src/infrastructure/api/index.ts`, `chatSocket.ts` and `voiceSocket.ts` were matched to those routes.
- **Uncertain mappings** are marked `?`.

The "Target" column uses the table names from the long-term design in [05_target_schema.md](05_target_schema.md) §2.

> **Revised 2026-10-25.** The current refactor follows [05 §0](05_target_schema.md#0-target-for-this-refactor-checked-against-backend-c056d82). For this refactor, read the Target column like this:
> - **Unchanged tables:**
>   - `job`, `job_image`, `job_tts` → the existing per-kind job tables;
>   - `media_asset` → the three asset tables (unless R3b is done);
>   - `llm_execution` → `tb_llm_execution_plan` with its existing 1:1 children;
>   - `reservation`, `usage_day`, `credit_ledger`, `credit_wallet`, `credit_grant` → the existing billing tables;
>   - `idempotency_receipt` → `tb_card_copy_receipt` / `story_operation_receipt`;
>   - `account_scope` → `tb_workspace_scope`.
> - **Changes that do happen:**
>   - `card` → `tb_card` with the body merged in;
>   - `adventure_session.narration_tier_override`;
>   - origin columns on `tb_llm_execution_plan`;
>   - the R2 story changes.
>
> The parity gate is now gates G1–G8 in [06 §3](06_migration_plan.md#3-validation-framework).

## Cross-cutting table sets

Almost every route touches the sets below, so the domain tables leave them out.

| Set | Today | Target |
|---|---|---|
| **WSR** — ownership resolver | `tb_workspace`, `tb_workspace_scope`, plus the root tables (`tb_card`, `adventure_session`, `assistant_conversation`, `lorebook`, `lorebook_resource`, `story_novel`, `image_job`, `tts_job`, `theme_song_job`) | `account_scope`, `tb_workspace`, the same roots, and `job` |
| **GATE** — identity and feature gate on every authenticated route | `tb_user`, `user_membership`, `membership_plan` | Same tables. The identity upsert is fixed (PERF-01). |
| **ADM** — LLM admission and metering | `tb_llm_execution_plan`, `tb_operation_reservation`, `tb_content_operation_context`, `tb_operation_receipt`, `tb_operation_usage_day`, `membership_credit_ledger`, `membership_usage_day`, `membership_operation_usage_day` | `llm_execution` (+ `llm_execution_payload`), `reservation`, `credit_ledger`, `usage_day`, `idempotency_receipt` |
| **VRES** — effective-voice projection | `voice_catalog`, `voice_catalog_language`, `voice_catalog_acceptance`, `voice_default`, `user_preferences` | Unchanged |
| **CARD** | `tb_card`, `tb_card_body`, `tb_card_draft` | `card`, `card_draft` |
| **MEDIA** | `image_asset`, `theme_song_asset`, `tts_asset`, `tb_workspace_media` | `media_asset`, `tb_workspace_media` (now with a real FK) |

**Parity gate for every phase:**
1. The BFF test suite passes, including the integration tests.
2. The SPA contract tests pass.
3. The scenario checklist below passes against the migrated database.
4. Row-level parity holds: counts plus content hashes per domain, comparing the source with the ETL output.

## 1. Account, profile, preferences, attestation

| Feature | Routes today | Tables today | Target | Must preserve |
|---|---|---|---|---|
| Register, login, Google, refresh | `/auth/*` (proxied to api.auth) | `tb_user`, `payg_credit_wallet`, `payg_credit_ledger`, `email_credit_grant`, `user_notification` | `tb_user`, `credit_wallet`, `credit_ledger`, `credit_grant`, `user_notification` | The shadow-user projection, and the email-grant offer on signup |
| Password, email, verification | `/auth/password/*`, `/user/me/emails*` | none (api.auth) | — | — |
| Profile and plan summary | `/user/me`, avatar | `tb_user` + usage/ledger reads | `tb_user`, `usage_day`, `credit_ledger`, `credit_wallet` | The same numbers: credits used, remaining, in-flight |
| Preferences | `/user/preferences` | `user_preferences` | unchanged | The language and narration tier |
| Runtime feature flags (SSE) | `/user/me/features(/events)` | `membership_plan_feature_flag`, `user_membership`, `membership_plan`, `membership_feature_mutation` | unchanged | The outbox publish order and the revision checks |
| Delete my data | `DELETE /user/data` | 36 tables deleted directly, plus cascades (`models.py:6142-6208`); execution `frozen_payload`/`result` redacted | Driven by a per-table classification (C8, R4) | **Target, not yet done:** every user-column table classified and test-enforced; profiles tombstoned; `effective_config` redacted; media files unlinked. Legal and guard records are kept. |
| 18+/Terms attestation | `/user/attestations` | `user_attestation` | unchanged | Versioned legal record, kept on wipe |
| Minor report | `/reports/minor*` | `voice_minor_report` | unchanged | — |

## 2. Workspaces, library, collections

| Feature | Routes today | Tables today | Target | Must preserve |
|---|---|---|---|---|
| Workspaces: CRUD, switch, archive, restore | `/workspaces*` | `tb_workspace`, `tb_workspace_scope` | `tb_workspace`, `account_scope` (absorbs the default pointer) | One protected default per owner/app. Archive blocks new work. |
| Origin navigation | `/workspaces/resolve-content` | WSR + `lorebook_entry` | WSR | Content opens from any workspace or link |
| Library listing | `/workspaces/{id}/cards` | CARD, `tb_collection*` | `card`, `card_draft`, `tb_collection*` | Sorting, draft markers, collection badges |
| Source status | `/workspaces/{id}/cards/source-status` | `tb_card`, `tb_card_draft`, `lorebook*`, `adventure_session` | `card`, `card_draft`, … | The "source changed or removed" badges |
| Collections | `/workspaces/{id}/collections*` | `tb_collection`, `tb_collection_card` | unchanged | Membership never crosses workspaces (composite FK) |
| Copy to workspace | `/workspaces/{dest}/copy-cards` | CARD, `tb_card_copy_receipt`, lorebook*, MEDIA | `card`, `idempotency_receipt`, lorebook*, `media_asset`, `tb_workspace_media` | **Replay of a double submit returns the first result** |
| Creation origin | card create (`initialCollectionIds`) | `tb_collection_card`, `tb_content_operation_context` | `tb_collection_card`; origin columns on `job` / `llm_execution` | The requested collections are immutable history |
| Workspace media | `/workspaces/{id}/media` | `tb_workspace_media`, MEDIA, job tables | `tb_workspace_media` → `media_asset`, `job` | The same listing and visibility |

## 3. Cards

| Feature | Routes today | Tables today | Target | Must preserve |
|---|---|---|---|---|
| CRUD for 4 card types | `/characters`, `/worlds`, `/items`, `/adventure-templates` | CARD, collections, MEDIA, VRES, `voice_reference`, pronunciation | `card` (header + published body merged), … | Lineage (`original_card_id`, `clone_source_card_id`) and the effective-voice fields |
| Versions (character/world/item) | `/{type}/{id}/versions*` | `tb_card_version` | `card_version` | Immutable versions. Templates are never versioned. |
| Drafts and publish | `/{type}/{id}/draft`, `/publish` | `tb_card_draft`, `tb_card_body`, `tb_card_version` | `card_draft`, `card`, `card_version` | Draft row exists only while there are pending edits |
| Usage ("where used") | `/{type}/{id}/usage` | CARD, `story_card_ref`, `adventure_session` | same; JSON `character_ids_snapshot` gets a multi-valued index (PERF-06) | — |
| Card media | `PATCH /{type}/{id}/media` | MEDIA, CARD | `media_asset`, `card` | — |
| AI card generation (sync, stream, recover) | `/{type}/ai*` | `tb_llm_card_generation`, ADM, `tb_llm_catalog_snapshot` | `llm_execution` (card result columns), ADM | **Result recovery after a lost stream** |
| Share links | `/cards/.../share*`, `/cards/shared/{token}*` | `card_share_link`, CARD, MEDIA, `lorebook_attachment` | unchanged | Revocation, and import from a token |
| Public / community, clone, duplicate | `/cards/public*`, `/clone`, `/duplicate` | `tb_card`, `tb_card_body`, VRES | `card` | Clone lineage stays attributed to the root |
| PNG export | `/cards/{type}/{id}/export.png` | CARD (read-only) | `card` | — |
| Public media | `/images/public/{id}`, `/theme-songs/public/{id}.mp3` | `card_share_link`, `tb_card*`, assets | `media_asset` | Public routes derived only from owned asset ids |

## 4. Adventure play, character chat, interrupted turns

| Feature | Routes today | Tables today | Target | Must preserve |
|---|---|---|---|---|
| Sessions: start, list, open, delete, template snapshot | `/adventure-sessions*` | `adventure_session`, CARD, VRES | `adventure_session` (+ `narration_tier_override` column) | Delete cascades to calls, segments and narration |
| Messages: history, edit, delete, clear, branches/swipes | `/{base}/{id}/messages*`, `/activate` | `adventure_message`, `image_asset`, `voice_transcript_segment` | unchanged | `adventure_message` stays the **authoritative history** |
| Real-time turn (WS) | `WS /{base}/{id}/ws` | messages, lorebook activation, `session_voice_setting`, `tts_job`/`tts_asset`, ADM | messages, lorebook, `job` + `job_tts`, `media_asset`, ADM | Terminal commit of message, provenance and accounting together |
| Interrupted-turn reconcile | `/{base}/{id}/turns/{req}` | `tb_llm_execution_plan`, messages | `llm_execution` | Reconcile after a stream drop |
| Voice refresh | `/{base}/{id}/voice(s)/refresh` | `voice_reference`, `voice_session`, CARD | unchanged | — |
| Chat images | `/{base}/{id}/messages/{mid}/images` | `image_job`, `image_asset` | `job` + `job_image`, `media_asset` | — |
| Character chat 1:1 and group | `/character-chats*` | `adventure_session` (kind = chat), messages | unchanged | — |
| Chat codex cards | `/character-chats/{id}/codex-cards*` | `adventure_session` (snapshot JSON) | unchanged | — |
| Session narration tier | `/{base}/{id}/voice-settings` | `session_voice_setting` | `adventure_session.narration_tier_override` | Same override semantics. Cascade is automatic now that it is a column. |

## 5. Assistants (card, lorebook, app, novel)

| Feature | Routes today | Tables today | Target | Must preserve |
|---|---|---|---|---|
| Card, lorebook, app and novel assistants | `/assistant/conversations*`, `/turns/{req}(/stop)`, `/novel-preview` | `assistant_conversation`, `assistant_message`, `tb_llm_assistant_turn`, ADM, target tables | `assistant_conversation`, `assistant_message`, `llm_execution` (assistant columns), ADM | One tool call per card/lorebook reply. Stop and recover a turn. Novel terminal accounting moves from `story_operation_receipt` to `llm_execution`. |

## 6. Lorebooks and resources

| Feature | Routes today | Tables today | Target | Must preserve |
|---|---|---|---|---|
| Lorebook and entry CRUD, validate | `/lorebooks*` | `lorebook`, `lorebook_entry` | unchanged | — |
| Attachments | `/lorebook-attachments*` | `lorebook_attachment` | unchanged | — |
| Activation preview | `/lorebooks/activation-preview` | lorebook* | unchanged | The same activation result |
| Resources, PDF import, link to lorebook | `/lorebook-resources*` | `lorebook_resource`, `lorebook_resource_link`, `resource_task` | lorebook*, `job` (kind `pdf_import`) | Shown in the tasks drawer |
| URL → Markdown import | `/imports/markdown` | none | — | — |
| Resource extraction (LLM) | `/lorebook-resources/{id}/metadata-*`, `/lorebooks/{id}/resource-extractions*` | lorebook*, `resource_task`, ADM | lorebook*, `job` (kind `lorebook_extraction`), ADM | Request-status recovery |

## 7. Images, image profiles, gallery

| Feature | Routes today | Tables today | Target | Must preserve |
|---|---|---|---|---|
| Portrait and chat image generation, jobs, results | `/images/card-portrait`, `/images/jobs*` | `image_job`, `image_asset`, `tb_workspace_media` | `job` + `job_image`, `media_asset`, `tb_workspace_media` | Webhook idempotency (`provider_request_id`, `last_webhook_*`) |
| Upload, delete, read image | `/images/upload`, `/images/assets/{id}` | `image_asset`, `tb_workspace_media` | `media_asset` | Soft delete (`deleted_at`) and owned blob cleanup |
| fal webhook | `/webhooks/fal` | `image_job`, `image_asset` | `job_image`, `media_asset` | — |
| Image profiles (user, BYOK) | `/images/*profiles*`, `/user/images/profiles*` | `tb_image_profile`, `tb_image_user_default`, `tb_llm_project_state` | `tb_image_profile`, `image_profile_default` | User profiles stay free (BYOK). System profiles cost credits. |
| Gallery | card + media routes | CARD, MEDIA | `card`, `media_asset` | — |

## 8. TTS narration and theme songs

| Feature | Routes today | Tables today | Target | Must preserve |
|---|---|---|---|---|
| Turn narration (WS push) and playback | WS, `/tts/jobs/{id}`, `/tts/assets/{id}.mp3` | `tts_job`, `tts_asset`, `tts_turn_charge`, `tts_turn_charge_ledger`, pronunciation | `job` + `job_tts`, `media_asset`, `reservation` (kind `narration_turn`), `credit_ledger` | **One reservation per turn. It settles once, and failed segments are refunded.** |
| Scene narration | `/{base}/{id}/scene-narration` | `tts_job`, `tts_asset`, `adventure_message`, … | same as turn narration | — |
| Theme songs: generate, list, delete | `/theme-songs*` | `theme_song_job`, `theme_song_asset`, `tb_workspace_media`, ADM? | `job` (kind `theme_song`), `media_asset` | Owned MP3 transcode stays out of MySQL |

## 9. Voice

| Feature | Routes today | Tables today | Target | Must preserve |
|---|---|---|---|---|
| Live voice call | `WS /character-chats/{id}/ws-voice`, consent, segments, end | `voice_session`, `voice_transcript_segment`, `voice_consent`, `adventure_message`, `voice_usage_day`, `voice_quota_reservation`, `voice_quota_capacity`, `voice_abuse_counter`, `voice_call_metrics`, `voice_turn_metrics`, `speech_provider_*` | `voice_session` (+ call-metrics columns), `voice_transcript_segment`, `voice_turn_metrics`, `voice_consent`, `usage_day`, `reservation` (kind `voice_call`), a capacity row in `voice_runtime_setting`, `voice_abuse_counter`, `speech_provider_*` | Capacity admission, idle/max timeouts, consent version, and telemetry with no transcript in metrics |
| Call history and transcript | `/voice-calls*` | `voice_session`, `voice_transcript_segment` | unchanged | — |
| Voice capabilities | `/voices/capabilities` | `user_preferences`, `voice_user_restriction`, `voice_free_activation` | unchanged | — |
| Catalog and samples | `/voices/catalog*` | `voice_catalog`, `_language`, `_acceptance`, `voice_sample_asset` | unchanged, plus FKs added on `voice_key` | — |
| Effective voice | `/voices/effective` | `voice_reference`, `voice_preset`, VRES | unchanged | — |
| Presets and recipe preview | `/voice-presets*` | `voice_preset`, `voice_preview_render` | unchanged | The preview cache, and in-flight counting |
| Pronunciation | `/voice-performance/*` | `voice_pronunciation_dictionary`, `_version` | unchanged | Immutable versions |
| Defaults (admin-set) | `/admin/voices/defaults*` | `voice_default` | unchanged | — |
| Consent and restrictions | voice-consent; `/admin/voices/restrictions*` (API only) | `voice_consent`, `voice_user_restriction` | unchanged | The kill switch survives a data wipe |

## 10. Story Studio

All rows are `/stories/...`, feature gate `novels`. See [03_story_studio.md](03_story_studio.md) for the per-table reasoning.

| Sub-feature | Tables today | Target | Must preserve |
|---|---|---|---|
| Library, lifecycle, creation from cards/outline | `story_novel`, part/chapter/scene, `story_structure_revision`, `story_card_ref`, `story_novel_statistics`, `story_operation_receipt` | `story_novel` (+ statistics columns), part/chapter/scene, structure log, `story_card_ref`, `idempotency_receipt` | Word-count sort, archive/trash |
| Structure: reorganize, studio index | part/chapter/scene, `story_structure_revision`, `story_scene_statistics` | same, plus `story_scene` counter columns | Undo/redo |
| Scene editor, excerpts, reader | `story_scene`, `story_scene_revision`, `story_writing_log`, annotations | `story_scene` (header), `story_scene_revision` (current document), `story_scene_text`, … | 1.2 s autosave, conflict detection, revision numbering |
| Inline generation, changesets, undo | `story_generation`, `story_scene_revision`, receipts, ADM | same, with receipts moved to `idempotency_receipt` | Accept/stash/discard, accept together, undo |
| Revisions and history | `story_scene_revision`, `story_generation`, `tb_llm_execution_plan` | compressed revisions + pins | **Every restorable revision stays restorable.** Pins come before pruning (STO-09). |
| Snapshots: list, compare, view, restore, annotations | `story_structure_revision` (`operation._snapshot`), revisions, `story_annotation_event` | `story_snapshot`, `story_snapshot_scene`, revisions, `story_annotation_event` | Frozen notes in snapshots |
| Annotations and bookmarks | `story_annotation`, `_event`, `_head` | `story_annotation`, `_event`; `story_novel.annotation_revision` | Anchor remap on every save |
| Planning | `story_plan_item` | unchanged, with an FK to `story_scene` | — |
| Search, replace, retrieval | scene/chapter/part, revisions, `story_scene_retrieval`, `story_scene_term` | `story_scene_text`, `story_scene_retrieval` (term vector) | **The same BM25 ranking**, scoped to candidates |
| Statistics, writing log | `story_scene_statistics`, `story_novel_statistics`, `story_writing_log` | columns on `story_scene` / `story_novel`, `story_writing_log` | The same counts and daily-goal semantics |
| Imports: manuscript and package | `story_import_source` (blob), all structure tables | `story_import_source` (record + storage path) | Original-file download, sha check |
| Exports: preview, download, jobs, package | `story_export_job`, `story_export_file_chunk` (blob) | `job` (kind `story_export`), `media_asset` | Cancel/retry, keeping 5 files per novel |
| Copy with provenance | all `story_*`, structure revisions | same | Copy provenance |
| Codex | `story_card_ref`, CARD, `tb_card_version`, lorebook* | same | The frozen `snapshot` survives source deletion |
| Novel assistant | assistant tables, ADM | assistant tables, `llm_execution` | Terminal accounting |
| Presets and preferences | `story_assistant_preset`, `_preference` | `story_assistant_setting` (optional merge) | Trash/restore of presets |
| Variants | `story_generation_variant`, … | unchanged | — |
| Erase: preview, request, status | `story_erase_record`, cascade | same tombstone; heavy children purged in batches (STO-08) | **Atomic barrier.** Replay after erase is refused. |

## 11. Billing, membership, credits

| Feature | Routes today | Tables today | Target | Must preserve |
|---|---|---|---|---|
| Plans and limits | `/billing/plans` | `membership_plan`, `_limit`, `_feature_flag` | unchanged | Custom plans managed by root |
| Stripe checkout and portal | `/billing/*checkout`, `/billing/portal` | `tb_user` (Stripe sits behind api.auth) | unchanged | — |
| Reconcile entitlements | `/billing/reconcile` | `user_membership`, ledgers, `membership_quota_reset`, wallet, `membership_feature_mutation`, `user_notification` | `user_membership`, `credit_ledger`, `credit_wallet`, `membership_quota_reset`, outbox | Idempotent reconcile |
| Credit codes, email grants | `/billing/credit-codes/redeem`, `/billing/email-credit-grants*` | `credit_code_grant`, `email_credit_grant`, ledgers, wallet | `credit_grant`, `credit_ledger`, `credit_wallet` | Single redemption per code/user. Expiry. |
| Daily quotas (LLM, TTS chars, call seconds) | inside ADM, voice quota, turn charge | `membership_plan_limit`, `membership_usage_day`, `membership_operation_usage_day`, `tb_operation_usage_day`, `voice_usage_day`, `tts_turn_charge*` | `membership_plan_limit`, `usage_day`, `reservation`, `credit_ledger` | **Same caps, in-flight limits, refunds and day boundary.** The UTC day must be explicit (OPS-08). |
| PAYG wallet | via `/user/me`, reconcile, redeem | `payg_credit_wallet`, `payg_credit_ledger` | `credit_wallet`, `credit_ledger` (payg buckets) | Free vs billed buckets, `balance_after` |
| Patreon link | `/patreon/link/*` (gated) | none locally | — | — |
| LLM capacity usage | `/llm/capacity-usage` | `tb_operation_usage_day` | `usage_day` | — |

## 12. Notifications, tasks

| Feature | Routes today | Tables today | Target | Must preserve |
|---|---|---|---|---|
| Notifications | `/notifications*` | `user_notification` | unchanged | Dedupe key |
| Background tasks drawer | `/tasks*` | `resource_task`, `image_job`, `tts_job`, `theme_song_job`, assets | `job` (one query instead of 4 sources plus archive markers) | Archive and delete per task. The same operation names in the UI. |

## 13. LLM profiles

| Feature | Routes today | Tables today | Target | Must preserve |
|---|---|---|---|---|
| Model catalog, features, resolve effective profile, retry profiles | `/llm/*` | `cat_llm_feature`, `tb_llm_profile*`, `tb_llm_catalog_snapshot`, `tb_llm_execution_plan` | same, plus `llm_execution` | The same resolution order |
| My profiles (BYOK and custom provider): CRUD, test, compatibility | `/user/llm/profiles*` | `tb_llm_profile`, `_revision` (`custom_provider` JSON), `_current`, `_audit` | unchanged | Immutable revisions. Keys are never stored. |
| My feature defaults | `/user/llm/preferences` | `tb_llm_user_defaults`, `tb_llm_user_feature_profile` | `llm_profile_default` | — |
| Root profiles, policy, audit, catalog sync | `/admin/llm/*` | `tb_llm_profile*`, `tb_llm_system_defaults`, `tb_llm_system_feature_profile`, `tb_llm_project_state`, `_audit`, `_catalog_snapshot` | `tb_llm_profile*`, `llm_profile_default`, `tb_llm_project_state`, `_audit`, `_catalog_snapshot` | Policy generation / etag |
| Workflows (admin agent studio) | `/admin/agents*` | `tb_llm_workflow`, `_revision`, `_current` (0 rows) | unchanged (**decision D-3**) | Admin-only. No user-facing execution path reads published workflows. |
| Root image profiles and global default | `/admin/images/*` | `tb_image_profile`, `tb_image_system_default`, `tb_llm_project_state` | `tb_image_profile`, `image_profile_default` | — |

## 14. Admin consoles

| Console | Tables today | Target |
|---|---|---|
| Credit codes, email grants | `credit_code_grant`, `email_credit_grant` | `credit_grant` |
| Membership (plans, mutations, members, assign, overview, quota resets) | `membership_*`, `user_membership`, wallet, usage | the same plan tables, `usage_day`, `credit_ledger`, `credit_wallet` |
| Voices (catalog, sync, samples, acceptance, defaults, Fish, runtime settings) | `voice_catalog*`, `voice_sample_asset`, `voice_default`, `voice_reference`, `voice_runtime_setting`, `voice_spend_daily` | unchanged |
| Voice metrics (narration, calls, provider, moderation, spend) | `tts_job`, `tts_turn_charge`, `voice_session`, segments, preview, abuse, spend | `job_tts`, `reservation`, `voice_session`, … |
| Global voice presets, minor reports | `voice_preset`, `voice_minor_report` | unchanged |

**SPA-only features with no DB:** docs, landing, error pages, floating windows, safety nudges.

## 15. Gaps the inventory surfaced

These are kept as-is unless a decision is taken; see the decisions in [README](README.md#decisions-needed).

- **`voice_consent_record`** has a DDL definition and nothing else. No runtime code reads or writes it; it appears only in comments. It is meant as a legal record of a cloned-voice subject's consent. **Either wire it or drop it** (decision D-1).
- **`voice_call_metrics` and `voice_turn_metrics`** are written and never read: no API or admin view uses them. The target keeps the rows, either queryable or exported (D-2).
- **Workflow tables** are admin-only, with 0 rows (D-3).
- **Backend capabilities with no SPA surface.** Generic OAuth providers, `POST /billing/credits/recharge`, `/llm/receipts*`, `POST /images/text-to-image`, non-streaming `/stories/{id}/generate`, `/admin/voices/restrictions*` (API only), and voice metrics history-sweep/reconciliation. These are preserved, since they are capabilities, but each is a candidate for removal.
- **Stale SPA media prefixes.** `src/infrastructure/api/mediaUrl.ts` lists `/generated-images/` and `/generated-audio/`, which no backend route serves. They are legacy and safe to drop.
