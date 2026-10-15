# Research 15: Workspace R1 impact on the voice refactor

> **Research scope (reviewed 2026-10-14):** Historical evidence from the dates stated below, including the retired MiniMax baseline. Vendor prices, model/API facts and policy claims were not reverified in this documentation pass. Current application status is **WIP** and is tracked in [00](../00_current_status_and_roadmap.md); later native ElevenLabs code/cutover supersedes migration-era implementation assumptions here.

Date: 2026-10-12

## Scope

Workspace R1 (personal workspaces, collections, copy to workspace, workspace-local activity) was committed after the research behind this program was done. The earlier notes read backend HEAD `f77e60f` and frontend HEAD `f0f5769`. This note re-reads every speech and voice path at:
- backend `magic-worlds-api` HEAD `f37eefd`;
- frontend `magic-worlds` HEAD `c7307c6`.

At those commits the content schema revision is `2026_10_workspace_r1`. The note records what changed for voice, what did not, and what the voice plan must do about it. The decisions that follow from it are **D39** and **03 §5.15**.

Method:
- Read-only review of both repositories and of the Workspace R1 specification ([docs/workspace_r1](../../workspace_r1/README.md), mainly documents 06, 12, 15 and 16).
- No database was queried and nothing was deployed.
- Line numbers are as of the commits above.

**Workspace R1 status.** It is committed in both repositories and migrated on the owner's local dev database only. It is **not deployed**: the production steps belong to the owner ([workspace_r1 12, Phase 6](../../workspace_r1/12_implementation_plan_and_acceptance.md)). The R1 specification's own status lines still say "uncommitted"; they predate the commits.

## Summary

| # | Area | Finding | Consequence for the voice plan |
|---|---|---|---|
| 1 | Schema baseline | `CONTENT_SCHEMA_REVISION = "2026_10_workspace_r1"` (`bootstrap.py:17`). No frozen `migrations/2026_10_workspace_r1.sql` exists yet | Voice migration 1 starts from `2026_10_workspace_r1`, freezes it first, and follows the cutover pattern (§8) |
| 2 | Handshake coupling | The SPA treats any `schema_revision` other than `2026_10_workspace_r1` as a predecessor API (`workspaceContract.ts:94`). The BFF hard-codes that value (`services/workspaces.py:27`, `models/workspaces.py:78`) | Voice migrations must **not** change the workspace capability's `schema_revision`, or every deployed SPA build blocks private content |
| 3 | `tts_job` | Gains `workspace_id` (not null, owner-first FK), an operation-context row and a `tts` media association per asset | `tts_turn_charge` needs the same scope columns and FK. Narration admission inherits the session's workspace |
| 4 | Archived workspaces | A fresh narration needs an active workspace. A reusable job is returned even when archived. Settlement and call-audio persistence run as continuations | The per-turn charge is reserved only after the active-workspace lock. Reuse hits stay free and allowed |
| 5 | Calls | Call start is `new_work`, resume and end are `control_admitted`, consent is `read`. Supersede, quotas and the one-call rule stay account-wide. Archive is refused with `WORKSPACE_ACTIVE_CALL` | No change to the D06 call design. The call-audio `tts_job` rows already carry the workspace |
| 6 | Account-level voice | `voice_preset`, admin voices, `voice_consent`, `voice_usage_day`, quotas, `user_preferences`, membership and `tts_asset` bytes have no workspace | Catalog, Studio, presets, attestation, preferences, caps and budget guards stay account-level |
| 7 | Copy to workspace | Copies `props.voice` verbatim from the published body; clears only the default-persona flag | A copy is a D32 shape-only copy. It creates new live V1 references that R5 must cover |
| 8 | Live-source lookups | Session creation accepts only cards of the request's workspace. Read-time "newer version" annotation treats a card in another workspace as absent | D36 refresh resolves the source card in the session's workspace only |
| 9 | Hard-coded MiniMax checks not in 03 §5.14 | `create_pending_job allowed={"minimax"}`, the asset-parent check `provider="minimax"`, the `voice_session` insert guard, call-audio rows with MiniMax literals | Added to the R0 widening list |
| 10 | Frontend gaps on voice surfaces | Voice socket ignores close codes 4404/4422; narration and the narrator voice editor are not read-only gated; no label for `WORKSPACE_ACTIVE_CALL`; `tts` media never listed | Fixed in R0 in the files the voice plan already changes |

## 1. Schema: what is workspace-scoped

All paths are under `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/`.

| Table | Workspace column | Evidence | Note |
|---|---|---|---|
| `tts_job` | yes, `workspace_id char(36) not null` | `db.sql:794`; FK `fk_tts_job_workspace (user_id, project_hash, user_group_hash, workspace_id)` `:863`; key `idx_tts_job_workspace_status` `:864` | `idx_tts_job_reuse` (`:859`) and `idx_tts_job_quota` (`:860`) do not include it |
| `tts_asset` | no | `db.sql:867-886`; only `fk_tts_asset_job … on delete cascade` | Ownership through the job; bytes stay account-owned |
| `adventure_session` | yes | `db.sql:236`, FK `:291`, key `:292` | `uq_adventure_session_scoped_identity` (`:251`) has no workspace |
| `adventure_message` | no (inherits) | FK to the session scope, cascade (`:312-316`) | |
| `voice_session` | no (inherits) | FK `fk_voice_session_adventure_scope` (`:435-439`) | History lists join `adventure_session.workspace_id` |
| `voice_transcript_segment` | no (inherits) | cascades from `voice_session` and `adventure_session` | |
| `voice_consent`, `voice_usage_day`, `voice_quota_reservation` | no | owner tuple only (`:353`, `:366`, `:388`) | account-level |
| `voice_quota_capacity` | no | global singleton (`:380`) | |
| `voice_preset` | no | `:1485-1515` | account-level, unchanged by R1 |
| `tb_card` | yes | `:1122`, FK `:1163`, `uq_tb_card_workspace_identity` `:1164` | voice lives in `props` of body/draft/version |
| `tb_card_body`, `tb_card_draft`, `tb_card_version` | no (inherit) | cascade from `tb_card` | |
| `tb_workspace_media` | yes | `media_kind enum ('image','theme_song','tts')` `:175`; PK `(workspace_id, media_kind, asset_id)`; no FK to any asset table | discovery association only |
| `tb_content_operation_context` | yes | `operation_kind enum ('llm_execution','image_job','theme_song_job','tts_job')` `:111`; PK `(operation_kind, operation_id)` | no `voice_session` kind |
| `membership_*`, `payg_*`, credit tables, `user_preferences` | no | `:888-1112`, `:20-31` | account-level |

Line starts of the tables the voice plan touches: `user_preferences` 20, `tb_workspace` 36, `tb_content_operation_context` 109, `tb_workspace_media` 169, `adventure_session` 228, `voice_consent` 353, `voice_session` 408, `tts_job` 788, `tts_asset` 867, `membership_plan_limit` 899, `membership_credit_ledger` 955, `tb_card` 1115, `voice_preset` 1485, `content_schema_revision` 2287 (seed `2296`).

MiniMax literals in the schema: `tts_job.provider` default `'minimax'` (`:804`) and CHECK `and provider = 'minimax'` (`:835`); `voice_session.tts_provider` default `'minimax_streaming'` (`:421`); `tts_job.source enum ('chat_tts_request','call_character_tts')` (`:800`).

## 2. Narration

Paths under `/home/andres/PycharmProjects/magic-worlds-api/src/`.

**Where the workspace comes from.**
1. The chat socket resolves `?workspace_id=` with `intent="read"` (`routes/user/route_chat.py:2215-2218`). A missing selector closes with 4422 and a foreign one with 4404 (`:2162-2165`).
2. A `tts` frame passes that id to `_handle_chat_tts_request(..., workspace_id=…)` (`:2322-2330`), which re-reads the session in that workspace (`:1319`) and calls `engine.enqueue_chat_tts_request(..., workspace_id=…)` (`:1403-1416`).

**Engine** (`services/tts_generation/engine.py`).
- `enqueue_chat_tts_request` takes `workspace_id` (`:125`). Its docstring (`:135-139`): a requested narration is fresh work and needs an active workspace; a reusable job is returned even after an archive.
- `_create_or_reuse_chat_job_in_workspace` (`:247-352`) runs in one transaction:
  1. `lock_assistant_message_for_tts(…, workspace_id)` (`:264`);
  2. `find_reusable_chat_job(…, workspace_id=…)` (`:283`);
  3. `_enforce_quota` (`:315`);
  4. `create_pending_job(…, workspace_id=…)` (`:318-336`).
- A `WorkspaceError` becomes `TtsGenerationError(INVALID, internal_code="workspace_archived" | "workspace_not_found")` (`:208-245`).
- Finalization re-checks the stored origin (`:687`). `get_job` and `get_result` take `workspace_id` (`:104-117`).
- `tts_job_public_from_row` sets `organization` (`:1080`).

**Persistence** (`database/mysql/models.py`).
- `TtsJobModel.create_pending_job` (`:8840`) takes `workspace_id` and `continuation: bool = False` (`:8860-8861`). In the caller's transaction it runs:
  1. `_admit_media_job_origin` (`:8957`, defined `:575-601`): `lock_workspace(…, require_active=not continuation)`, a shared lock that serializes with archive;
  2. `_require_media_session_in_workspace` (`:626-649`);
  3. the insert with `workspace_id` (`:8994-9003`);
  4. `_record_media_job_origin` (`:604-623`): one `tb_content_operation_context` row, `operation_kind='tts_job'`, `requested_collection_ids = []`, `terminal_organization` left null.
- `lock_assistant_message_for_tts` (`:9029-9072`) joins the session with `workspace_id` and does not check archive.
- `find_reusable_chat_job` (`:9118-9200`) adds `AND workspace_id = %s` (`:9157`).
- `create_pending_job` validation `allowed={"minimax"}` (`:8935`); sources limited to `chat_tts_request`, `call_character_tts` (`:8918`).
- `TtsAssetModel.create_asset` (`:9407`) locks the parent job and calls `_associate_job_asset(media_kind="tts")` (`:9491`, defined `:801-823`) in the finishing transaction, deliberately without an archive check. `_required_asset_parent_job` asserts `provider == "minimax"` (`:766`, called at `:9465`).
- Asset reads and `mark_deleted` are account-scoped (`:9527`, `:9546`). `routes/tts.py:107-121`: binary downloads need no workspace selector. `GET /tts/jobs/{id}` and `/result` require `X-Workspace-Id` with `intent="read"` (`:63-72`, `:148-157`).

**Quota and in-flight are per account.** `MembershipModel.count_in_flight` (`:2207`), `tts_generation` branch `:2243-2250`: `FROM tts_job WHERE user_id = %s AND status IN (…)`, without even the project scope. `reserve_media_operation` (`:3074`), `refund_credit_ledger` (`:3304`), `TtsJobModel.count_in_flight` (`:9203`) and the stale terminalization (`engine.py:354`) use the owner tuple with no workspace.

**No workspace in** `services/chat_tts_delivery.py` (socket key `(user_id, project_hash, user_group_hash, adventure_id)`, `:55-65`; frames carry no organization), `tts_generation/registry.py`, `minimax_adapter.py`, `storage.py`, `config.py`, `errors.py`.

**Notifications.** `notify_job_failed(job_kind="tts")` (`services/notifications.py:131`, called from `main.py:929-935`) writes `metadata.workspace_id` (`:45-52`). The inbox row stays account-scoped.

## 3. Calls

Paths under `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_voice_call.py` unless stated.

| Step | Intent | Evidence |
|---|---|---|
| WS `/character-chats/{session_id}/ws-voice` selector | `?workspace_id=` required before any call traffic | `selector_from_request(…, query=True)` `:969`; errors sent by `_send_workspace_error` `:392` with categories `:55` |
| New call | `new_work` | `_create_admitted_voice_session` `:501`, `:513`; `engine.start_call(…, workspace_id=…)` `:548-564`; comment `:511-512`: supersede and quotas stay account-wide |
| Resume | `control_admitted` | `:580-582` |
| Voice consent | `read` | `:613`, `:625`; consent is account-wide, only the target chat is validated |
| Segment upload | `new_work` | `:633`, `:650` |
| End | `control_admitted` (works when archived) | `:746`, `:759` |
| `GET /voice-calls`, per-chat calls, transcript | `read` | `:814`, `:835`, `:859` |

- `_supersede_active_voice_calls` (`:462-498`) and `VoiceSessionModel.list_active_for_user` (`models.py:6191`) are owner-tuple only: **one live call per account**, across workspaces.
- `VoiceSessionModel.create_starting_session` (`models.py:5960`) requires `workspace_id`, takes `lock_active_workspace` and inserts from `adventure_session … AND a.workspace_id = %s` (`:6055-6090`). The workspace is not stored on `voice_session`. MiniMax guard: `tts_provider != "minimax_streaming"` raises (`:6027-6033`; validator `:5509-5520`).
- Archive with a live call: `routes/workspaces.py:194-198` + `WorkspaceModel.set_archived` (`workspace_models.py:277-298`) → `WORKSPACE_ACTIVE_CALL` (409).
- **Call audio is stored as `tts_job` rows.** `voice_orchestration/engine.py:2361-2466` (`_persist_call_audio_asset`) calls `create_pending_job(source="call_character_tts", provider="minimax", model_alias="speech_2_8_turbo", provider_model_id="speech-2.8-turbo", …, workspace_id=…, continuation=True)` (`:2419-2444`), then completes the job and creates the asset. Each call turn therefore writes an operation-context row and a `tts` media association, even after an archive.
- Voice LLM turns are admitted through `execute_conversation_turn` with `ContentOrigin(workspace_id=…)` (`services/conversation_execution.py:74-80`), which needs an active workspace. Archive is refused during a call, so this is consistent.
- No workspace references in `voice_orchestration/config.py`, `quota.py`, `admission.py`, `streaming_tts_minimax.py`, `stt*.py`, `delivery.py`.
- The `voice_call` in-flight branch counts `WHERE user_id = %s` only (`models.py:2251-2258`).

## 4. Account-level voice surfaces (unchanged by R1)

- `routes/voice_presets.py`, `routes/admin_voices.py`, `services/minimax_voice_admin.py`, `models/voice_preset.py`, `models/admin_voice.py`: no workspace references. `VoicePresetModel` is at `models.py:16367`.
- Workspace R1 lists "voice consent/quota accounting, user/system voice presets, admin voices/agents" as intentionally unchanged account boundaries ([workspace_r1 16](../../workspace_r1/16_scope_inventory.md)).
- In the SPA, `pageAccess.ts:42-43` marks `voice-studio` and `admin-voices` as account pages ("never wait for the handshake"). Studio, picker, presets, preview and admin voices use the unscoped `apiService` singleton (`VoiceStudioPage.tsx:55,69-70,97`; `VoicePickerDialog.tsx:60-61`; `PresetEditor.tsx:112,115`; `usePreviewVoice.ts:26`; `admin/voices/**`).

## 5. Cards, copies, personas and live sources

- `CharacterVoice` V1 is unchanged (`models/character.py:11-40`). `props.voice` is part of `CARD_PROPS['character']` (`card_body.py:32-44`).
- **Copy to workspace** (`database/mysql/workspace_copy.py`). `_copied_body` (`:112-123`) deep-copies `name`, `description`, `alias` and every `CARD_PROPS` field from the **published** body. `props.voice` is copied verbatim, including `preset_id`/`preset_name`, which point at an account-level preset. For characters it sets `is_default_persona = False` and remaps `default_persona_id`. It associates only image and theme-song media with the destination (`:340-347`). The source may be archived; the destination must be active (`:142-153`).
- Public clone (`models.py:11795-11802`) also keeps the voice.
- **Default persona is per workspace** (`CharacterCardModel.set_default_persona`, `models.py:13124`; `get_default_persona`, `:13281`).
- **Live sources.** Session creation resolves embedded cards, template and persona only in the request's workspace (`route_adventure_session.py:852-898`, `:1609-1612`; `route_character_chat.py:1501-1515`). On read, `_annotate_snapshot_newer_versions` (`:1098-1128`) calls `CardModel.get_latest_version_map(…, workspace_id=sess["workspace_id"])` (`models.py:12835-12870`): a card that is deleted, foreign or in another workspace is "simply absent". Every snapshot-mutating route uses `new_work` and fails with `WORKSPACE_ARCHIVED` (409); the narrator-voice `PUT` is one of them (`:1721`, `:1749-1760`).
- Snapshots never carry workspace metadata; `organization` is a separate response field (`route_adventure_session.py:117-131`, `:906-910`).

## 6. Account wipe

`delete_all_user_data` (`models.py:5237-5311`) locks the owner's `tb_workspace` rows, then deletes in this order:

1. tb_operation_receipt
2. tb_llm_card_generation
3. tb_card_copy_receipt
4. tb_workspace_media
5. tb_content_operation_context
6. tb_collection_card
7. tb_collection
8. assistant_conversation
9. lorebook_resource_link
10. lorebook_attachment
11. lorebook_entry
12. lorebook
13. lorebook_resource
14. voice_preset
15. card_share_link
16. tb_card
17. voice_quota_reservation
18. voice_session
19. voice_usage_day
20. voice_consent
21. adventure_session
22. story_novel
23. image_asset
24. theme_song_asset
25. image_job
26. theme_song_job
27. tts_job
28. resource_task
29. tb_workspace_scope
30. tb_workspace
31. user_notification
32. user_preferences

`tts_asset`, `voice_transcript_segment`, `adventure_message` and card bodies, drafts and versions go by cascade. Membership and billing rows are kept.

## 7. Workspace contract the voice routes must follow

From [workspace_r1 15](../../workspace_r1/15_execution_contracts.md) and `services/workspaces.py`:

| Request family | Selector |
|---|---|
| Existing private REST and SSE content routes | `X-Workspace-Id` header, required, no fallback |
| Text and voice WebSockets | `workspace_id` URL query |
| Auth, billing, profiles, voice presets, account notifications, binary assets | none |

- `WorkspaceIntent = 'read' | 'new_work' | 'finalize_admitted' | 'control_admitted' | 'manage_workspace'` (`services/workspaces.py:30`). Only `new_work` is enforced by `resolve_workspace_context` (`:102-115`): it raises `WORKSPACE_ARCHIVED` when the workspace is archived. `finalize_admitted` and `manage_workspace` are declared but unused; continuations use the boolean `continuation` and `ContentOrigin.continuation`.
- Foreign or mismatched roots return 404 and never reveal another workspace. Archived content can be read, exported and used as a copy source.
- Error codes: 422 `WORKSPACE_REQUIRED`, `WORKSPACE_SELECTOR_MISMATCH`; 404 `WORKSPACE_NOT_FOUND`, `CONTENT_NOT_FOUND`; 409 `WORKSPACE_ARCHIVED`, `WORKSPACE_ACTIVE_CALL`.
- `organization` is a server-owned read field. It is never part of a request body, stored snapshot, chat frame or prompt (`models/media_organization.py`).

## 8. Migration chain

- `workspace_cutover.py` (`PREVIOUS_REVISION = '2026_10_image_profiles'`, `TARGET_REVISION = '2026_10_workspace_r1'`, `:38-39`) is the pattern:
  1. advisory lock;
  2. exact revision gate;
  3. schema verification against a **frozen** predecessor (`migrations/2026_10_image_profiles.sql` plus the `2026_10_resource_tasks.sql` delta);
  4. a data fingerprint before and after;
  5. a compare-and-set on `content_schema_revision`.
- `bootstrap.py:1699-1716`: an `upgrades` map from each older revision to its scripts, with `20261012_workspace_r1.py` appended as the final step.
- `tests/test_schema_bootstrap.py` (~`:600-667`) asserts the revision and the ordered step lists.
- Frozen predecessor files: `2026_09_agent_tables.sql`, `2026_09_card_tables.sql`, `2026_10_assistant_tables.sql`, `2026_10_image_job_fal_only.sql`, `2026_10_image_profiles.sql`, `2026_10_resource_tasks.sql`. **There is no `2026_10_workspace_r1.sql` yet.**
- Runtime verification is exact (`EXPECTED_SCHEMA` parsed from `db.sql`, `bootstrap.py:1053`, `:1635`). Any change to a CHECK, enum or default needs this chain.
- **Capability coupling.** The SPA handshake (`src/infrastructure/api/workspaceContract.ts:91-94`) returns `supported` only when `schema_revision === '2026_10_workspace_r1'` (`src/shared/types/workspace.types.ts:44`); anything else is `predecessor`, which blocks private content behind the "updating" state. The BFF reports a hard-coded value (`services/workspaces.py:27`, `models/workspaces.py:78`). The value names the **workspace contract**, not the content revision, and must stay unchanged when a voice migration advances `CONTENT_SCHEMA_REVISION`.

## 9. Frontend

Paths under `/home/andres/WebstormProjects/magic-worlds/src/`.

- **Scoping mechanism.** `apiService.withWorkspace(id)` (`infrastructure/api/index.ts:548-560`) returns a frozen client that adds `X-Workspace-Id` (`:563-570`, merged at `:853`). The exported singleton is unscoped. `useScopedApi`, `useSessionWorkspace` (`features/interaction/hooks/useSessionWorkspace.ts:31-39`) and `organizationWorkspaceId` pick the client. `fetchProtectedMediaBlob` (`:3971-4021`) never adds the header.
- **Voice API methods (current lines).**

  | Method | Line | Scope |
  |---|---|---|
  | `listAdminVoices` | 1963 | account |
  | `designAdminVoice` | 1973 | account |
  | `deleteAdminVoice` | 1982 | account |
  | `testAdminVoice` | 1995 | account |
  | `uploadAdminVoiceCloneSample` | 2435 | account |
  | `cloneAdminVoice` | 2453 | account |
  | `listVoicePresets` | 2297 | account |
  | `createVoicePreset` | 2304 | account |
  | `updateVoicePreset` | 2313 | account |
  | `deleteVoicePreset` | 2322 | account |
  | `listSystemVoices` | 2329 | account |
  | `previewVoice` | 2336 | account |
  | `saveVoiceConsent` | 3891 | scoped (call workspace) |
  | `uploadVoiceSegment` | 3901 | scoped (call workspace) |
  | `endVoiceCall` | 3934 | scoped (call workspace) |
  | `getTtsJob` | 3954 | scoped (session) |
  | `fetchTtsAudioBlob` | 3967 | unscoped |
  | `waitForTts` | 4024 | unused |
  | `getRecentVoiceCalls` | 4568 | scoped |
  | `getCharacterChatCalls` | 4576 | unused |
  | `getVoiceCallTranscript` | 4584 | scoped |
  | `updateAdventureSnapshot` | 4467 | scoped (committed workspace) |
  | `setDefaultPersona` | 2485 | scoped (comment still says "account default") |
- **Sockets.**
  - `chatSocket.ts` requires a workspace (`:116-117`), sends `?workspace_id=` (`:135`) and handles close 4404 (`CHAT_SESSION_NOT_FOUND`) and 4422 (dispatches `workspace:required`) at `:225-238`.
  - `voiceSocket.ts` requires a workspace (`:163-164`) and sends it (`:260`), but `voiceCloseLabel` (`:33-46`) and `onclose` (`:297-345`) know only 1000, 4401, 4403 and 4408. A 4404 or 4422 falls through to resume or reconnect, so it can loop, and no `workspace:required` event is fired.
- **Calls.**
  - `useVoiceCallController.ts:212-219` holds the call workspace's client.
  - Before a committed switch, `NavigationProvider.tsx:347-354` ends the live call.
  - `CallScreen.tsx:193-194` blocks redial on `WORKSPACE_*` errors but has no up-front read-only check.
  - `voiceCallLabels.ts:63-68` maps `WORKSPACE_ARCHIVED`, `WORKSPACE_NOT_FOUND`, `WORKSPACE_SELECTOR_MISMATCH` and `WORKSPACE_REQUIRED`, but **not** `WORKSPACE_ACTIVE_CALL` or `CHAT_SESSION_NOT_FOUND`.
  - The `CharacterChatSidebar.tsx:182-200` "Call" button is not read-only gated; `CallsPage`, `LandingPage` and `ChatroomPage` are.
  - `VoiceCallSummary` has no `organization` field.
- **Narration.**
  - TTS requests ride the scoped chat socket (`InteractionCenterPanel.tsx:466`, `:589`, `:806-816`).
  - Polling uses the session's client and only runs while that workspace is selected (`:420-441`, `:168`).
  - Audio blobs use the unscoped singleton (`TurnNarration.tsx:117,234`).
  - **Narration is not read-only gated:** `onRequestNarration` is passed regardless of `readOnly` (`:1367`), and `ChatTurn.tsx:135-143` renders `TurnNarration` regardless of `actionsDisabled`.
- **Narrator voice.**
  - `InteractionLeftPanel.tsx:55`, `:222-268` opens `VoicePickerDialog` (`:263`).
  - `AdventureInteraction.tsx:120-126,165` never checks read-only, and `DataProvider.saveInProgressSnapshot` (`:642-656`) uses the committed workspace's client rather than the session's.
  - The character editor's voice field is gated (`CharacterCreator.tsx:668-964` inside `ReadOnlyFieldset`).
- **Media.**
  - `WorkspaceMediaKind` includes `tts` (`shared/types/workspace.types.ts:199`), but `useMediaGallery.ts:106-115,166,183` only requests `image` and `theme_song`.
  - The playlist is theme-song only and stamps an origin workspace (`AudioPlaylistProvider.tsx:78-84`).
  - Background tasks label `text_to_speech` tasks with their origin (`TasksPanel.tsx:524,554`).
- **Reusable helpers.**
  - `useWorkspaceReadOnly(workspaceId?)` (`shared/hooks/useWorkspaceReadOnly.ts:44-48`), `ReadOnlyFieldset`, `ArchivedWorkspaceBanner`.
  - `WorkspaceOriginLabel` / `useWorkspaceOrigin`, `isWorkspaceApiError` (`index.ts:379-390`), `registerActiveVoiceCall` / `hasActiveVoiceCall` (`features/call/activeVoiceCall.ts`).
- **Copy.**
  - i18n: `workspaceActivity.call.workspaceArchived` / `workspaceUnavailable` / `stale`, `workspaceActivity.chat.*`, `workspaceUi.errors.activeCall`, `workspaceContent.saveErrors.archived`.
  - There is no narration-specific archived key.
- **Provider order now:** ApiStatus → Auth → LlmSession → Language → **Workspace** → Navigation → OriginNavigation → CreationOrigin → CookieConsent → Data → BackgroundTasks → AudioPlaylist → FloatingWindows (`app/providers/AppProvider.tsx:26-53`). The project `CLAUDE.md` line predates this.

## 10. Line drift in the voice plan

Workspace R1 added about 3,000 lines to `models.py` and about 280 to `db.sql`. Many line numbers cited by the plan documents and by research notes 00–14 refer to `f77e60f`/`f0f5769`. The ones the plan relies on most, at the new commits:

| Item | Old citation | Now |
|---|---|---|
| `tts_job` provider CHECK | `db.sql:670` | `db.sql:835` (constraint starts `:826`) |
| `idx_tts_job_reuse` | `db.sql:694` | `db.sql:859` |
| `voice_session.consent_version` | `db.sql:260` | `db.sql:418` |
| `voice_preset` | `db.sql:1276-1309` | `db.sql:1485-1515` |
| `MembershipModel.count_in_flight` | `models.py:2061-2117` | `models.py:2207` (TTS branch `:2243-2250`, call branch `:2251-2258`) |
| `reserve_media_operation` | `models.py:2929` | `models.py:3074` |
| `refund_credit_ledger` | `models.py:3159` | `models.py:3304` |
| `delete_all_user_data` | — | `models.py:5237-5311` |
| `voice_session` provider validator | `models.py:5343-5353` | `models.py:5509-5520`; insert guard `:6027-6033` |
| `TtsJobModel.create_pending_job` | `models.py:8497-8502` (provider set) | `models.py:8840`; provider set `:8935` |
| `lock_assistant_message_for_tts` | `models.py:8577` | `models.py:9029` |
| `find_reusable_chat_job` | `models.py:8650` | `models.py:9118` |
| `VoicePresetModel` | `models.py:14858` | `models.py:16367` |
| `bootstrap.py` upgrade chain | `:1697-1711` | `:1699-1716` |
| FE `apiService` voice methods | `index.ts:1585-4206` | §9 table above |

Other citations should be re-read before the code change they support (03 §4 note on line drift).

## Sources

- Workspace R1 specification: [README](../../workspace_r1/README.md), [06 Database model](../../workspace_r1/06_database_model_and_changes.md), [12 Plan and progress](../../workspace_r1/12_implementation_plan_and_acceptance.md), [15 Execution contracts](../../workspace_r1/15_execution_contracts.md), [16 Scope inventory](../../workspace_r1/16_scope_inventory.md).
- Backend `/home/andres/PycharmProjects/magic-worlds-api` at `f37eefd`: the files and lines cited above.
- Frontend `/home/andres/WebstormProjects/magic-worlds` at `c7307c6`: the files and lines cited above.
