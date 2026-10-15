# Gap closure 13: codebase checks (age gate, clone audio, presets, membership ops, ingress, loudness, canary, language, brackets)

> **Research scope (reviewed 2026-10-14):** Historical evidence from the dates stated below, including the retired MiniMax baseline. Vendor prices, model/API facts and policy claims were not reverified in this documentation pass. Current application status is **WIP** and is tracked in [00](../00_current_status_and_roadmap.md); later native ElevenLabs code/cutover supersedes migration-era implementation assumptions here.

Date: 2026-10-12

## Scope

This note closes the gaps in [09_research_critic_gaps.md](09_research_critic_gaps.md) that can be answered by reading code. It covers nine items. For each one it records what exists, what does not, where new behaviour would hook in, and what that means for the ElevenLabs migration plan.

Method:
- Read-only review of `/home/andres/WebstormProjects/magic-worlds` (SPA) and `/home/andres/PycharmProjects/magic-worlds-api` (BFF), plus a short look at the sibling `/home/andres/PycharmProjects/api.auth` for registration and Stripe webhooks.
- No API keys were used, no paid API was called, and no database was queried.
- External facts carry `[verified: url]` (read today on an official page), `[secondary: url]` or `[unverified]`.

Two caveats:
- **Line numbers come from the working trees as of 2026-10-12.** Both repos have uncommitted changes, for example `src/database/mysql/db.sql` and `src/services/tts_generation/engine.py` in the BFF.
- **Gap ids differ between the task and 09.** The task brief calls the age gate "G15" and canary routing "G16". In 09 these are **G16** (age gate) and **G17** (rollout and canary); 09's G15 is the staging spike. This note uses 09's ids.

## Summary

| # | Gap (09 id) | Status | One-line finding | Plan implication |
|---|---|---|---|---|
| 1 | Age gate (G16) | Closed (code side) | The 18+ gate is a dismissible modal whose acceptance is a browser-wide `localStorage` flag. Nothing reaches the server, and narration and previews have no server-side age or consent check. | Add a per-account, server-recorded adult attestation, enforced on narration, calls and previews. The legal question of whether self-attestation is enough stays open. |
| 2 | Clone source audio (G6) | Closed | Clone samples go from memory straight to MiniMax. Nothing is written to disk or the DB, and nothing is logged. | MiniMax custom voices **cannot** be re-created from local data. Default to retiring them. The new root console must keep a consent and audit record. |
| 3 | Global presets (G6) | Closed (code side) | No seed, migration or API creates `is_global=1` rows; only hand-written SQL can. | The production count is still a data question. A curated re-seed needs a new mechanism (root API or migration script). |
| 4 | Membership ops (G10, owner decision 14) | Closed | Operations are a hard-coded tuple, and startup validates every plan against the seeded set. `reserve_media_operation` already accepts a per-call `credit_cost`. TTS never refunds. | Character-based TTS can reuse the `credit_cost` override with no schema change. New operations need a lockstep migration. Rollback is not free. |
| 5 | Webhook ingress (G4) | Closed (code side) | One inbound webhook exists (`POST /webhooks/fal`, signed and idempotent). The public base URL is optional, and the dev setup has none. Stripe webhooks live in api.auth. | The route pattern is reusable. Ingress is not confirmed, so **polling must be the primary path** and webhooks only speed it up. |
| 6 | Loudness/transcode (G12) | Closed (code side) | The theme-song path uses `lameenc`: WAV→MP3 in a worker thread, with no ffmpeg, no gain and no loudness measurement. The TTS path stores provider MP3 as-is inside a DB row lock. | A static per-voice `gain_db` applied to PCM before `lameenc` is cheap and reuses the path. Runtime LUFS normalization needs a new dependency. |
| 7 | Canary routing (G17) | Closed (code side) | Backend flags are global env booleans, and `user_group_hash` is per process. There is one TTS provider per process, pinned by a type `Literal` and a DB CHECK. Frontend flags are build-time. | A cohort router has to be built. Routing by user on shared cards needs dual-id voice resolution, which favours read-time translation during the canary. |
| 8 | Language (G8) | Closed (code side) | The only per-user language is `user_preferences.preferred_language` (en/es, server-authoritative). Cards and sessions carry no language field, and the LLM writes in "the conversation's language". | Add a per-turn `language` field to the turn-metadata graph output. Fall back to the voice's language, then `preferred_language`, then auto. |
| 9 | Square brackets (G11) | Closed (code side) | Narration text reaches the TTS provider with brackets and markdown intact. Only whitespace and zero-width characters are normalized. The chat prompts never mention brackets. | Build a shared narration sanitizer: strip or neutralize every `[...]` that does not come from our own tag allow-list, and add a "no square brackets" prompt rule. |

## 1. Age gate (09 G16)

### 1.1 What exists in the frontend

| Fact | Evidence |
|---|---|
| Acceptance key `magic_worlds:app-warning-accepted:v1`, value `'accepted'` | `/home/andres/WebstormProjects/magic-worlds/src/ui/components/AppWarningModal.tsx:7-8` |
| Read from `localStorage`; a read error counts as "not accepted" | `AppWarningModal.tsx:14-20` |
| Opens when not accepted and the hash is not `#/disclaimer` or `#/privacy` | `AppWarningModal.tsx:12, 22-32` |
| "Accept" only writes `localStorage` and closes the modal. **There is no API call.** | `AppWarningModal.tsx:35-42` |
| No close affordance: `onClose={() => {}}`, `showClose={false}` | `AppWarningModal.tsx:47, 50` |
| The 18+ line is one of ten bullets; the voice bullet appears only when the calls flag is on | `AppWarningModal.tsx:67-79` |
| Mounted once, globally, regardless of login state | `/home/andres/WebstormProjects/magic-worlds/src/app/router/AppRouter.tsx:214` |
| Copy: "You must be 18 or older to use Magic Worlds. By accepting, you confirm…" | `/home/andres/WebstormProjects/magic-worlds/src/app/i18n/locales/en.ts:879`; es `es.ts:889` |
| Same modal: "NSFW content is not currently allowed." | `en.ts:884` |
| Storybook describes it as a first-run acknowledgement stored in `localStorage` | `AppWarningModal.stories.tsx:13` |

Properties that follow from this code:
- **Device- and browser-scoped, not account-scoped.** The key has no user id. A second account on the same browser inherits the acceptance, and a new browser or cleared site data prompts again.
- **Shown before login.** The attestation is never tied to an authenticated identity.
- **Versioned only by the key suffix `:v1`.** Changing the copy does not re-prompt unless the key changes.
- **The server cannot prove any user attested.**

### 1.2 What exists in the backend and api.auth

| Fact | Evidence |
|---|---|
| `tb_user` has no DOB, age, terms or adult columns (identity, `user_type`, `display_name`, `creation_at` only) | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:1-18` |
| `user_preferences` stores only `preferred_language` | `db.sql:20-31` |
| A grep for `age`, `adult`, `birth`, `terms_accepted`, `accepted_at`, `consent` in the BFF finds **only** the voice-call consent | grep over `src/` |
| api.auth registration accepts only `username`, `password`, `user_group_hash` (`extra="forbid"`), so there is no age or terms field | `/home/andres/PycharmProjects/api.auth/src/Util/Models.py:2149-2154` |
| A grep for `terms_accepted`, `date_of_birth`, `is_adult`, `age_verified`, `minimum_age` in api.auth finds nothing | grep over `api.auth/src` |

**Voice-call consent is the only per-user consent the server stores:**
- **Table `voice_consent`:** PK `(user_id, project_hash, user_group_hash, consent_version)`, with `accepted_at` and `revoked_at` (`db.sql:195-207`).
- **`VoiceConsentModel`:** `accept` uses an upsert that clears `revoked_at`; there are also `get_current` and `revoke`. `revoke` has **no caller** (`/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:5674-5731`).
- **Version:** `VOICE_CONSENT_VERSION` defaults to `"voice-v1"` (`src/services/voice_orchestration/config.py:26`, env read at `:308-312`).
- **Recording:** `POST /character-chats/{session_id}/voice-consent` records the consent (`src/routes/user/route_voice_call.py:574-589`).
- **Enforcement:** call start requires it at `route_voice_call.py:484` via `require_current_voice_consent` (`src/services/voice_orchestration/admission.py:96-107`). A missing consent maps to HTTP 428 `consent_required` / `consent_stale` (`admission.py:75-76`).
- **Content of the consent:** it covers AI interaction, microphone, processing, transcripts and no recordings (`en.ts:4820-4827`). It contains **no age statement**, and it names the provider: "replies are spoken with MiniMax text-to-speech" (`en.ts:4823`).

**No check at all** on these speech surfaces:
- **Chat narration:** the WS `tts` frame (`src/routes/user/route_chat.py:2268`) goes to `_handle_chat_tts_request` (`route_chat.py:1224`), then to `TtsGenerationEngine.enqueue_chat_tts_request` (`src/services/tts_generation/engine.py:112`). No consent or age check anywhere on that path.
- **User voice preview:** `POST /voice-presets/preview` requires only authentication (`src/routes/voice_presets.py:99-118`).
- **Card content:** cards carry no content rating. A grep for `nsfw` / `content_rating` finds only the fal image-safety field.

External: the ElevenLabs Terms say "If you are under 18 years of age … you may not use our Services" (§1(a), "Eligibility and Use Restrictions") [verified: https://elevenlabs.io/terms-of-use]. The page does not discuss operators who serve end users, nor age verification. The OEM flow-down obligations are covered in 05 §6.2 / §6.9 [secondary: 05_elevenlabs_platform_pricing_limits_policy.md].

### 1.3 Where a server-side gate could hook in

**Data.** There are two options:
- **(a) Reuse `voice_consent` with a separate version namespace** (for example `adult-v1`). Cheap, but it mixes two meanings in one table.
- **(b) Add a small `user_attestation` table.** Columns: `(user_id, project_hash, user_group_hash, kind enum('adult_18', …), version, accepted_at, revoked_at, source)`. The `VoiceConsentModel` upsert/get/revoke shape can be copied as-is.

Option (b) is recommended.

**Capture:**
- When `AppWarningModal` is accepted by a logged-in user, POST the attestation.
- On login, if the local key says "accepted" but the server has no row, show the modal again rather than migrating silently. The sync logic in `LanguageProvider.tsx:91-105` is the model to follow.

**Enforce, server-side, at every speech entry point:**

| Surface | Hook point |
|---|---|
| Chat narration | `_handle_chat_tts_request` (`route_chat.py:1224`), before `enqueue_chat_tts_request` (`engine.py:112`) |
| Voice calls | `build_admission_context` / `require_current_voice_consent` (`admission.py:96-158`) and WS start (`route_voice_call.py:484`) |
| Voice consent | Refuse `POST …/voice-consent` (`route_voice_call.py:574`) without an adult attestation |
| Voice preview | `voice_presets.py:99` |
| Root console (design/clone/test) | Root only; record the actor (see §2) |

- **Error shape:** reuse the HTTP 428 precondition pattern (`admission.py:75-76`) with a new category such as `age_attestation_required`, so the SPA can reopen the modal.
- **Versioning:** use an env-driven version string, as `VOICE_CONSENT_VERSION` already is.

### 1.4 Implication for the plan

- **Today's 18+ gate is not auditable.** It is a dismissible, device-scoped, pre-login self-attestation with no server evidence. Even if self-attestation were legally enough, there is no per-account record to show it.
- **Minimum engineering scope:**
  - a server-recorded per-account attestation;
  - enforcement on narration, calls and previews;
  - a voice-consent copy rewrite (it names MiniMax) with a `VOICE_CONSENT_VERSION` bump.
- **Still open (legal, owner decision 16):** whether self-attestation is enough or real age verification is required, and whether NSFW stays banned. The modal already says NSFW is not allowed (`en.ts:884`), which supports disabling mature narration.

## 2. Clone source audio (09 G6)

### 2.1 Findings

**The upload path never touches disk:**
- `POST /admin/voices/clone-file` is root only (`src/routes/admin_voices.py:42-48, 107-147`).
- It reads the upload into memory, capped at `clone_upload_max_bytes + 1` (`admin_voices.py:119-122`; the default is 20 MiB, `src/services/minimax_voice_admin.py:50`), and checks the content type (`admin_voices.py:133-138`).
- `upload_clone_file` posts the bytes as multipart to MiniMax `/v1/files/upload` and returns only `file_id`, `bytes`, `filename` and `purpose` (`minimax_voice_admin.py:67, 313-366`). There is **no disk write and no DB insert**.

**The clone call keeps nothing:**
- `clone_voice` posts `{file_id, voice_id, clone_prompt{prompt_audio:int, prompt_text}, text, model, language_boost, need_noise_reduction, need_volume_normalization}` to `/v1/voice_clone` (`minimax_voice_admin.py:68, 368-421`).
- It returns `voice_id` and an optional `demo_audio_url`. Nothing is persisted.

**Nothing records who cloned what:**
- **No logging:** `minimax_voice_admin.py` and `routes/admin_voices.py` contain no `logger` calls, so there is no audit of who cloned which voice from which file and when.
- **No consent fields:** `AdminVoiceCloneRequest` (`src/models/admin_voice.py:213-253`, `extra="forbid"`) has no consent, attestation or speaker-identity field. Purposes are `voice_clone` | `prompt_audio` (`admin_voice.py:47-49`), and `prompt_audio` is a MiniMax file id (`admin_voice.py:196-202`).
- **No local storage:** the configured roots are `IMAGE_STORAGE_ROOT`, `THEME_SONG_STORAGE_ROOT` and `TTS_STORAGE_ROOT` (`.env.example:304, 369, 433`). None is for voice samples. A grep for `clone_file|voice_clone|clone_sample|prompt_audio|minimax_file|clone_audit` outside the three admin modules finds nothing, and no table in `db.sql` references clone samples or MiniMax file ids.
- **No consent capture in the frontend:** `src/features/admin/voices/components/VoiceCloneForm.tsx` (294 lines) uploads through `apiService` (`src/infrastructure/api/index.ts:2067`) and sets `clone_prompt` at `VoiceCloneForm.tsx:170`. It has no consent checkbox and no rights copy (grep for `consent|rights|permission`).
- **Designed voices are equally unrecoverable.** `design_voice` (`minimax_voice_admin.py:218`) sends the prompt to MiniMax, and the prompt is not stored locally.

External:
- MiniMax deletes a cloned voice that is not used within 7 days [verified: https://platform.minimax.io/docs/api-reference/voice-cloning-clone].
- The MiniMax Files API can list files by `purpose` (`voice_clone`, `prompt_audio`, …), returning `file_id`, `bytes`, `created_at`, `filename` and `purpose` [verified: https://platform.minimax.io/docs/api-reference/file-management-list.md].
- `GET /v1/files/retrieve_content` is described as downloading "the contents of a generated file" [verified: https://platform.minimax.io/docs/api-reference/file-management-retrieve-content.md]. Whether it returns *uploaded* clone sources, and how long MiniMax keeps them, is [unverified].

### 2.2 Conclusion

**MiniMax custom voices (cloned or designed) cannot be re-created on ElevenLabs from local data.** There is no source audio, no designed-voice prompt, no consent record and no `file_id` ↔ `voice_id` mapping.

The only recovery routes are outside the codebase:
1. The operator's own off-platform copies of the source recordings.
2. A free, keyed check of MiniMax `files/list?purpose=voice_clone` plus `retrieve_content` [unverified]. Even if that works, files map to voices only by filename or upload time.

Either way, an ElevenLabs Instant Voice Clone needs **fresh consent from the speaker** (03, 05). Old consent was never recorded, so it cannot be carried over.

### 2.3 Implication for the plan

- **Default for owner decision 12: retire MiniMax custom voices and ask owners to re-select.** Before cut-over, list them through the existing root inventory (`GET /admin/voices?voice_type=…`, `admin_voices.py:166-179`), then ask the operator, voice by voice, whether source audio and consent exist off-platform.
- **The new root console must persist an audit and consent record for every clone and design.** At minimum: actor, timestamp, voice id, sample SHA-256, a consent-attestation version, and optionally the sample itself under a new storage root with a retention period. This is the `voice_consent_record` that 03 proposes. G13's legal text and retention questions remain open.

## 3. Global presets and seeds (09 G6)

### 3.1 Findings

**Schema:**
- The `voice_preset` table is at `db.sql:1276-1309`. Its comment says a row with `user_id NULL` and `is_global=1` "marks a seeded global default (read-only)" (`db.sql:1276-1278`).
- A CHECK constraint requires global rows to have `user_id IS NULL`, `project_hash = ''` and `user_group_hash = ''` (`db.sql:1303-1307`). Global rows are therefore not tied to any project.

**No seed exists anywhere:**
- `db.sql` has no `INSERT INTO voice_preset`.
- `src/database/mysql/bootstrap.py` seeds only membership, voice quota capacity and LLM features.
- No migration mentions `voice_preset`: neither `src/database/mysql/migrations/*.sql` (five files) nor `scripts/migrations/*.py` (five files).

**No API can create one:**
- `VoicePresetModel.create` hard-codes `is_global` to `0` in its INSERT (`models.py:15142`). Update and delete only touch rows with `is_global = 0` (`models.py:15176-15181, 15231`). The class docstring calls global rows "operator-provisioned" (`models.py:14858-14860`).
- The `voice_presets.py` routes are user CRUD (`:62, 74, 121, 130, 145`), `system-voices` (`:87`) and `preview` (`:99`). None is root-only, and none sets `is_global`.
- The root voice console (`admin_voices.py`) has no preset endpoints.

**Listing and display:**
- A user sees their own rows plus **every** global row, with no scope filter on the global rows (`models.py:15098-15101`).
- In tests, `is_global=1` rows exist only as fixtures (`tests/models/test_voice_preset_model.py:128`).
- The frontend shows a "default" badge and hides editing for global rows (`src/features/voices/components/VoiceStudioPage.tsx:186, 230`; `VoicePickerDialog.tsx:164`). The global row in `src/features/admin/playAdminAuditFixtures.tsx:33` is Storybook data.

### 3.2 Implication for the plan

- **Global presets can only exist through hand-written SQL.** The code never creates them. 08 says the same; this note adds the evidence on seeds, bootstrap and migrations.
- **The production count is still a data question.** Run 08 §18's `is_global` count on a read replica.
- **If the count is zero (likely), there is nothing to migrate.** "Curated ElevenLabs presets" then needs a creation path:
  - (a) a root-only `POST /admin/voice-presets` that sets `is_global=1`, which keeps provisioning in the console; or
  - (b) an idempotent `scripts/migrations/*.py` seed.
  Seeding through `db.sql` plus a bootstrap contract would make the catalog a startup invariant, which is too rigid for a catalog that changes.
- **Because global rows are project-agnostic** (empty scope), a seeded preset appears in every project that shares the database.

## 4. Membership operations (09 G10, owner decision 14)

### 4.1 How operations are defined today

| Layer | What | Evidence |
|---|---|---|
| Python constants | `MEMBERSHIP_OPERATIONS` (8 ops: `ai_card_generation, image_generation, card_image_generation, theme_song_generation, tts_generation, chat_interaction, voice_call, lorebook_resource_extraction`) | `models.py:57-66` |
| | `MEMBERSHIP_MEDIA_OPERATIONS = {image_generation, card_image_generation, theme_song_generation, tts_generation}` | `models.py:67` |
| | `MEMBERSHIP_DURATION_OPERATIONS = {"voice_call": {"seconds_per_credit": 10}}` | `models.py:68-70` |
| Schema | `membership_plan` (daily credit pool), `membership_plan_limit` (per plan × op: `daily_request_limit`, `max_in_flight`, `credit_cost`) | `db.sql:721-743` |
| | Usage rollups, `membership_credit_ledger` (`credit_cost`, `event_type reserved/refunded`, `credit_source included/payg_free/payg_billed`, idempotency hash, `billable_seconds`), PAYG wallet and ledger | `db.sql:758-861` |
| Seeds | 3 plans (`free` 50, `plus` 100, `pro` 500 daily credits) × 8 ops; every `credit_cost` is 1 | `db.sql:909-942`; mirrored in `src/database/mysql/bootstrap.py:19-49` |
| Startup contract | **Every** plan, including custom root-made plans, must carry exactly the seeded op set. Unknown or missing ops are a seed mismatch, and a mismatch **aborts startup** | `bootstrap.py:1108-1180` (`_membership_seed_issues`), `bootstrap.py:1777-1783` |
| Runtime contract | Loading a plan's limits raises if any op in `MEMBERSHIP_OPERATIONS` is missing | `models.py:1359-1363` |
| | `count_in_flight` has a hard-coded branch per op and raises on an unknown op | `models.py:2062-2117` |
| | Root plan editing validates the op set | `src/database/mysql/membership_admin_models.py:123-130` |
| | Root list returns ops dynamically | `src/routes/admin_membership.py:349` |
| Profile DTO | `PROFILE_CARD_OPERATIONS` is a strict copy of the op set | `src/routes/user/route_auth.py:273-282` |
| | `billing_unit` must be `audio_seconds` for `voice_call` and `action` for everything else | `route_auth.py:542-562` |
| | The monthly op set must match exactly | `route_auth.py:579-583` |
| | `billable_seconds` may be non-zero only for `voice_call` | `route_auth.py:597` |
| Usage reports | "used" = ledger row count for every op except `voice_call` | `models.py:3657`; `membership_admin_models.py:871` |
| Frontend | Unknown ops are tolerated: humanized fallback (`src/features/profile/components/membership.helpers.ts:6-28`), i18n `defaultValue` (`membershipFormat.ts:14`, `UsageSection.tsx:371`), `billing_unit` typed as an open string (`src/shared/types/auth.types.ts:41`); only `audio_seconds` gets special rendering (`UsageSection.tsx:354`) | as cited |

### 4.2 Reservation, debit and refund primitives

- **`reserve_media_operation`** (`models.py:2929-3157`):
  - accepts only `MEMBERSHIP_MEDIA_OPERATIONS`;
  - takes an optional **per-call `credit_cost` override** (`:2930, :2945-2946, :2966`), which image profiles already use with their own price (`src/services/image_generation/engine.py:371-381`);
  - a cost of zero only counts against the in-flight cap;
  - spends included credits first, then PAYG free, then PAYG billed;
  - writes ledger rows and returns `ledger_ids`.
- **`debit_operation_credits`** (`models.py:2651-2928`): a post-hoc, idempotent debit of an arbitrary `credit_count` plus `billable_seconds`. Voice calls use it after measuring audio (`src/services/voice_orchestration/engine.py:202-218`; availability check at `models.py:2597-2648`).
- **`refund_credit_ledger`** (`models.py:3159+`): an idempotent refund of reserved ledger rows. Its callers:
  - the image engine, on the failure transition (`image_generation/engine.py:1017-1024`), with ledger ids stored in `image_job.input_summary.credit_ledger_ids` (`:403`);
  - LLM admission (`src/database/mysql/llm_execution_admission.py:609`);
  - the interrupted-turn cutover (`interrupted_turn_cutover.py:118`).
- **Gap: the TTS and theme-song engines never refund.** TTS `_enforce_quota` (`tts_generation/engine.py:318-370`) discards the returned ledger ids, and theme songs reserve at `theme_song_generation/engine.py:797` with no refund. This confirms 00 issue #7.
- **`tb_operation_reservation` is LLM-only.** It is FK-bound to `tb_llm_execution_plan` (`db.sql:1874-1904`, FK at `:1895`), so voice operations cannot reuse it.
- **Previews are unmetered today:** both `POST /voice-presets/preview` (`voice_presets.py:99-118`) and root `POST /admin/voices/test` (`admin_voices.py:91-104`).

### 4.3 What adding the new operations would require

| Step | `voice_preview` | `voice_design` / `voice_clone` (only if non-root users get them) | Character-based TTS billing |
|---|---|---|---|
| Add to `MEMBERSHIP_OPERATIONS` (+ media set) | yes | yes | no new op needed (design A below) |
| `db.sql` seed rows + `bootstrap.py` seed tuples | 3 rows | 3 rows each | none |
| **Data migration** inserting a limit row for **every existing plan, custom ones included**, run **before** the new code boots | yes | yes | none |
| `count_in_flight` branch | needs a source; previews have no job table. Add a `voice_preview` cache/job table, or a branch returning 0 | job table or `tb_…` row | unchanged (`tts_job`) |
| `PROFILE_CARD_OPERATIONS` + DTO contract | yes | yes | only for design B |
| i18n labels (en/es) | yes (the fallback works without them) | yes | none |
| Refund wiring | refund on provider failure | refund on failure | **store ledger ids** in `tts_job.input_summary` (as `image_job` does) and refund on the failure transition |

Character-based TTS has two designs:
- **A (recommended for v1).** Compute `credit_cost = ceil(len(normalized_text) / chars_per_credit)` before the job is created and pass it to the existing override (`models.py:2930`):
  - no schema or DTO change (`billing_unit` stays `action`);
  - the per-segment character cap already exists (`max_chars` in `_narrated_segments`, `route_chat.py:1174-1211`).
  - Trade-off: `daily_request_limit` keeps counting segments, while the daily credit pool absorbs the variable cost.
- **B.** Generalize `MEMBERSHIP_DURATION_OPERATIONS` into a "metered unit" map (for example `characters`) and debit post-hoc with `debit_operation_credits`. This needs a ledger unit column (today only `billable_seconds`), a DTO `billing_unit` extension (`route_auth.py:542-562, 597`) and frontend rendering.

Reuse hits are created before the quota check (`_create_or_reuse_chat_job` at `engine.py:193`, quota at `:258`), so they remain free under either design.

### 4.4 Implication for the plan

- **Rollout risk: a new operation is a one-way, lockstep change.** After the migration adds rows, the *old* build refuses to start ("unknown operation", `bootstrap.py:1166-1167`). Before migration, the *new* build refuses to start ("missing" ops). Rollback therefore needs a reverse migration. The plan should:
  - add `voice_preview` (and any others) in a release **before** the provider switch;
  - keep that release provider-neutral.
- **Root-only design and clone need no membership ops.** These are platform costs; meter them only if owner decision 8 opens them to users.

## 5. Webhook ingress (09 G4)

### 5.1 Findings

**The one inbound webhook:**
- `POST /webhooks/fal` (`src/routes/webhooks/fal.py:13-48`) is mounted with no user auth (`src/routes/__init__.py:26, 62`).
- It reads the raw body before parsing (`fal.py:26`). The verifier comes from `app.state` (`fal.py:20`; set at `src/main.py:856`). Errors are safe categories with redacted logging (`fal.py:40-66`).
- **Idempotency** comes from locking the job row by provider request id and returning if it is already terminal (`image_generation/engine.py:245-260`).

**The verifier is specific to fal:**
- `FalWebhookVerifier` checks an ED25519 signature against a JWKS (`src/services/image_generation/webhook.py:37-76`).
- The signed message is `request_id\nuser_id\ntimestamp\nsha256(body)` (`:149-150`). The timestamp leeway is 300 s (`:143-146`). The JWKS is cached for 24 h and force-refreshed on a failed verify.
- `pynacl` is in `requirements.txt`. It is not a generic HMAC helper.

**Public base URL:**
- `FAL_WEBHOOK_PUBLIC_BASE_URL` is optional (`image_generation/config.py:21, 104-118, 196-199, 270-273`).
- `.env.example:276-279` says a missing value "no longer blocks image submissions; the API uses bounded POST wait plus local job/result polling".
- In the **dev backend `.env`, `FAL_WEBHOOK_PUBLIC_BASE_URL` is unset**, and `FRONTEND_PUBLIC_BASE_URL` is an `http` URL on a local or LAN host. The values were checked without printing them.
- `FRONTEND_PUBLIC_BASE_URL` is used only for billing return URLs (`src/services/billing_config.py:113`).

**Stripe webhooks are not in the BFF:**
- api.auth hosts them (`/home/andres/PycharmProjects/api.auth/src/routes/stripe_webhooks.py`). It verifies the Stripe `t=…,v1=…` HMAC-SHA256 with `hmac.compare_digest` and a 300 s tolerance (`api.auth/src/Util/stripe/security.py:53-117`), rate-limits signature failures, and deduplicates through a delivery ledger.
- The BFF only consumes facts server-to-server (`src/routes/billing_subscriptions.py:1-15`; `/home/andres/WebstormProjects/magic-worlds/docs/billing/SETUP.md:50-58`).
- `POST /billing/webhooks/processor` in `docs/billing/README.md:355` is a planned surface and is not implemented in the BFF.

**Deployment shape:**
- uvicorn binds `0.0.0.0:APP_PORT` (`src/serve.py:28-33`), and docker-compose maps the port directly (`docker-compose.yml:34-35`).
- There is no reverse proxy, TLS or proxy-header configuration in the repo.
- Owned storage is "local filesystem only: single-instance or persistent-volume" (`.env.example:300`).

**Periodic-job precedent:**
- `VoiceCallEngine.start_maintenance` (`voice_orchestration/engine.py:1062`), started in the lifespan (`main.py:1031-1035`);
- the resource-task loop (`src/services/resource_tasks.py:113-114`).
Both run per process.

External:
- **Retries:** ElevenLabs webhooks send an `ElevenLabs-Signature` header. Retries are **disabled by default**. When enabled, there are up to 5 retries (immediate, 30 s, 2 min, 8 min, 30 min, plus jitter). 4xx responses are not retried.
- **Auto-disable:** a webhook is disabled after 10 consecutive failures if it has had no success in 7 days.
- **Events:** `voice_removal_notice`, `voice_removal_notice_withdrawn`, `voice_removed`.
- Source: [verified: https://elevenlabs.io/docs/eleven-api/resources/webhooks].
- **Signing scheme:** the official page defers to the SDK. A secondary guide describes `t=<ts>,v0=<hex HMAC-SHA256 of "ts.body">` with a 30-minute window [secondary: https://hookdeck.com/webhooks/platforms/guide-to-elevenlabs-webhooks-features-and-best-practices]. A community source says `v1` and 5 minutes [secondary: https://openskillindex.com/skills/comeonoliver-skillshub-elevenlabs-webhooks-events]. The exact scheme is [unverified] until a staging delivery is captured.

### 5.2 Implication for the plan

- **Building the route is mechanical.** A `POST /webhooks/elevenlabs` follows the existing pattern: raw-body verification, a handler that is safe to replay, and redacted logging. It needs:
  - a new HMAC verifier modelled on api.auth's `security.py` (constant-time compare, timestamp window);
  - an `ELEVENLABS_WEBHOOK_SECRET` env var;
  - dedupe on `(event type, voice_id, event_timestamp)`.
- **Public HTTPS ingress is not confirmed.** The repo has none; dev runs on LAN HTTP; fal already falls back to polling. So:
  - **daily polling of the catalog is the primary removal-detection path.** It can run in a lifespan maintenance loop like `start_maintenance`. If the BFF is ever scaled out, the loop needs a DB lease.
  - **webhooks are an accelerator**, enabled only where a public URL exists. The ElevenLabs retry toggle should be turned on when they are.
- **Still open from G4:** the owner-facing UX for deprecating voices.

## 6. Loudness and transcode path (09 G12)

### 6.1 Findings

**What the theme-song transcode does:**
- `src/services/theme_song_generation/transcode.py`: WAV→MP3 **in-process through `lameenc`, with no ffmpeg** (`:1-8`).
- It accepts only RIFF/WAVE PCM (`:39-47`): mono or stereo, the listed sample rates (`:19`), and sample widths of 1–4 bytes reduced to 16-bit by truncation (`:81-102`).
- It encodes CBR, 192 kbps by default, at quality 2 (`:18, :105-117`).
- It does **no resampling, no gain, no loudness measurement and no MP3 decoding**.

**Where it runs:**
- The theme-song storage mirror downloads the WAV, then calls `asyncio.to_thread(transcode_wav_to_mp3, …)` (`theme_song_generation/storage.py:96-129`, thread at `:108`), then writes the file in a thread (`:279`).

**Tooling and dependencies:**
- `requirements.txt` has `lameenc>=1.8.0,<2.0.0` ("provider WAV is re-encoded to MP3 in-process").
- There is no numpy, pydub, pyloudnorm or soundfile.
- The `Dockerfile` is `python:3.12-slim` (`:31, :45`) and installs only git and Playwright Chromium. **There is no ffmpeg.**
- Python 3.12 still ships the deprecated stdlib `audioop`, which was removed in 3.13 [unverified].

**The TTS asset pipeline has no transcode:**
- `save_provider_audio` accepts only `audio/mpeg` / `mp3` (`src/services/tts_generation/storage.py:82-129`). It decodes MiniMax's hex payload and calls the **synchronous** `_atomic_write` directly in the coroutine (`:117`).
- The engine calls it **inside a DB transaction that holds the `tts_job` row lock** (`tts_generation/engine.py:611-639`).

**Today's thought dimming is a MiniMax request parameter, not audio processing:**
- It sets `vol = max(0.5, base_vol × 0.6)` (`route_chat.py:1129-1134`).

**Frontend playback:**
- Narration plays through `HTMLAudioElement` (`src/features/interaction/components/TurnNarration.tsx:125`) with the global playlist volume (`src/app/providers/AudioPlaylistProvider.tsx:128, 302`).
- There is no WebAudio gain node for narration.

External: ElevenLabs `output_format` includes `pcm_8000…pcm_48000` and `wav_8000…wav_48000`. `pcm_44100` and `wav_44100` need Pro or above. The default is `mp3_44100_128` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert].

### 6.2 Can a loudnorm or gain step reuse the path?

**Partly.**

| Reusable as-is | Missing |
|---|---|
| WAV parsing, PCM16 conversion, the `lameenc` encoder and the `to_thread` pattern | An MP3 decoder (`lameenc` only encodes), so ElevenLabs must return `wav_24000` / `pcm_24000`, not MP3 |
| | Integrated-loudness measurement (EBU R128 K-weighting plus gating). This needs `pyloudnorm` + numpy/scipy, or an ffmpeg binary in the image. |
| | Gain application on PCM16. Simple with stdlib `array` / `memoryview` (or `audioop` on 3.12 only). |

Recommended shape:
- Request WAV or PCM from ElevenLabs.
- Apply a **static per-voice `gain_db`**, measured once per voice and model during G7 acceptance and stored in the catalog, plus a fixed thought offset (for example −4 to −6 dB).
- Encode with `lameenc` (mono, 64–128 kbps).
- Run all of this in `to_thread` **before** entering the transaction at `engine.py:611`, so the row lock is not held during CPU work. Move `_atomic_write` to a thread as well.

This adds no new dependency. Runtime per-clip LUFS normalization should wait until measurements (G12) show static gain is not enough.

Streaming calls cannot use this path: they are MP3 chunks over WS. For calls, rely on per-voice catalog choice or client-side gain.

### 6.3 Implication for the plan

- **The narration pipeline needs a format switch from MP3 to WAV/PCM.** That means changing the `mp3`-only literals in `tts_generation/storage.py:23-25, 99-109` and the registry, and adding a thread-offloaded "gain + encode" step.
- **Thought dimming can stay server-side (gain) or move to the client (`audio.volume`).** Both are cheap. This feeds owner decision 10.

## 7. Provider routing for a canary (09 G17)

### 7.1 Existing mechanisms

| Mechanism | Granularity | Evidence | Usable for a canary? |
|---|---|---|---|
| Backend `*_ENABLED` env flags (`TTS_ENGINE_ENABLED`, `VOICE_MODE_ENABLED`, `THEME_SONG_ENGINE_ENABLED`, `IMAGE_ENGINE_ENABLED`, `ASSISTANTS_ENABLED`, `CALLBOT_INTERJECTIONS_ENABLED`, `VOICE_VAD_ENERGY_GATE_ENABLED`, `BILLING_PROVIDER_SYNC_ENABLED`, `PATREON_PROVIDER_SYNC_ENABLED`, `LOREBOOK_PDF_OCR_ENABLED`) | Process-global | grep; parsers in `src/runtime_config.py:75, 177` (no flag registry, no per-user evaluation) | Only as a kill switch |
| `AppScope.user_group_hash` | **Per process.** It comes from `app.state.user_group_hash`, not from the user | `src/services/scope.py:33-37`; `main.py:609-610` | No. "Per group" means per deployment. |
| `tb_user.user_type` (`consumer` / `admin` / `root`) | Per user | `db.sql:7`; root check pattern `admin_voices.py:42-48` | Yes, for an internal-only first stage |
| `user_membership.plan_code` | Per user | `db.sql:745-756` | Risky. Plans also carry credits, and Stripe reconcile rewrites `plan_code` (`billing_subscriptions.py:6`). |
| Image and LLM profiles (system default per project + per-user default; the profile carries the provider) | Per user, user-chosen | `db.sql:475-544` (`provider enum('fal','openrouter')` at `:484`); provider picked per request in `image_generation/engine.py:360-381`; LLM `tb_llm_system_defaults` / `tb_llm_user_feature_profile` at `db.sql:1785-1833` | The closest precedent for per-user provider routing, but users choose it, not root |
| Frontend flags | **Build-time** Vite env, the same for every user of a build | `src/shared/featureFlags.ts:14-16, 30-36`; `.env` `VITE_FEATURE_VOICES_ENABLED`, `VITE_FEATURE_CALLS_ENABLED` | No |

**TTS is pinned to one provider per process:**
- `main.py:916-942` builds one `MiniMaxT2AProvider` and one `TtsGenerationEngine(provider=…)`.
- The registry types the provider as `Literal["minimax"]` (`src/services/tts_generation/registry.py:24`).
- `tts_job` has `CHECK … provider = 'minimax'` (`db.sql:670`).
- The voice-call engine is built once (`main.py:956-965`).

The `tts_job` reuse index includes `model_alias`, `provider_model_id` and `voice_id_hash` (`db.sql:694`), so a per-job provider switch will not wrongly reuse audio across providers.

### 7.2 Where a cohort router would hook in

- **Narration:** replace `provider=` at `main.py:936-940` with a `ProviderRouter` that picks the provider per job. Inputs: the voice recipe's provider discriminator (08 §12.1) and a cohort check. The resolver is built per segment at `route_chat.py:1137-1171`.
- **Calls:** decide at `engine.start_call` (`route_voice_call.py:515`) and persist the provider on `voice_session`.
- **Cohort source,** cheapest first:
  - an env allow-list of `user_hash` values;
  - `user_type in (root, admin)`;
  - a deterministic `hash(user_hash) % 100 < VOICE_CANARY_PERCENT`;
  - a root-managed `voice_provider_cohort` table.
- **Prerequisites:** widen the `tts_job.provider` CHECK and the registry `Literal` first, as an expand step.

### 7.3 Implication for the plan

- **Shared cards break user-based routing without dual ids.** Voices belong to characters, and characters are shared through community cards and snapshots. A canary user playing a card whose voice is a MiniMax id needs an ElevenLabs id at request time. So a canary **requires a mapping that the resolver reads at request time** (old id → new id) during the dual-provider period. This argues for read-time translation (C2 claim A) at least until the switch, with the one-shot rewrite (claim B) only at contract time.
- **The SPA must handle both voice shapes in one build.** Its flags are build-time, so it cannot follow a per-user provider switch unless the server tells it per voice.

## 8. Language source of truth (09 G8)

### 8.1 Where the app knows a language

| Source | Scope | Values | Read by | Evidence |
|---|---|---|---|---|
| `user_preferences.preferred_language` | Per user (server) | `en` / `es`, default `en` | UI only: `GET`/`PATCH /user/preferences` | `db.sql:20-31`; `UserPreferencesModel` `models.py:5140-5190`; `route_auth.py:293-314, 2316, 2347` |
| SPA language | Per browser, then synced | `en` / `es` | On login, the server value wins if `has_preference`; otherwise the local value is pushed up | `src/app/providers/LanguageProvider.tsx:38-55, 91-105`; key `magic_worlds:language` `src/app/i18n/languages.ts:12`; browser detection `:49-57` |
| App assistant `locale` | Per turn | `en` / `es` | App assistant prompt only | `src/models/assistant.py:311`; `src/services/assistants/app.py:24-27` |
| `CharacterVoice.language_boost`, `voice_preset.language_boost` (default `'auto'`) | Per voice recipe | MiniMax hint string | TTS registry, falling back to model default `"auto"` | `src/models/character.py:22`; `db.sql:1293`; `registry.py:32, 223-226` |
| `VOICE_STT_LANGUAGE` | Process-global | Optional ISO hint | Groq STT `language` | `voice_orchestration/config.py:47, 89, 336-338`; `stt_groq_client.py:59`; `.env.example:489` |
| Cards, worlds, adventures, sessions | n/a | **No language field** | n/a | grep of `db.sql` and `src/models/{character,world,adventure_template,item,story}.py` |
| Chat LLM graphs | Implicit | "the conversation's language" | Turn metadata: `forwardOptions` "stay in the conversation's language"; `imagePrompt` English only | `src/agent_graphs/runtime/adventure_chat.v2.json:58`, `character_chat.v2.json:58`, `character_group_chat.v2.json:58` |
| Callbot graph | n/a | No language instruction | n/a | `callbot_chat.v2.json` |

`preferred_language` is not read by any LLM, TTS or STT path; it appears only in `route_auth.py` and `models.py`.

External: ElevenLabs `language_code` takes **ISO 639-1**. It is ignored when the model does not support it, and it is not supported on `multilingual_v2` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert]. This settles G8's 639-1 vs 639-3 question for the HTTP TTS endpoint. Per-model support (v3/v4/Flash) stays [unverified].

### 8.2 Proposed `language_code` policy

The language of the *content* is stored nowhere, and a Spanish-UI user can play an English card. The UI locale is therefore only a fallback. Resolve `language_code` per narration job in this order:
1. **Turn language** from the existing metadata graph, which already reasons about "the conversation's language": add a `language` (ISO 639-1) field to its output and store it on the assistant message.
2. **Voice language:** an explicit per-voice language migrated from `language_boost`, only when it names a single language.
3. **User `preferred_language`** (server value).
4. **Omit** (provider auto-detect).

Notes:
- Include the resolved `language_code` in the TTS reuse/signature hash.
- For calls, the same chain can replace the global `VOICE_STT_LANGUAGE` with the user's `preferred_language`.
- Mixed-language turns use the turn value. Per-segment detection is a later refinement.

## 9. Literal square brackets in narration text (09 G11)

### 9.1 Findings

**Parsing leaves brackets intact:**
- `parse_response_segments` (`src/services/chat_segments.py:436-541`) accepts only `<narrator>`, `<say>` and `<think>` children.
- Segment content goes through `_safe_segment_text` (`:151-156`), which checks only stripping, the 4000-character cap and secret-marker strings (`:15-35`).
- There is **no bracket or markdown handling**, so brackets are stored verbatim.

**Narration sends brackets and markdown to the provider:**
- `_narrated_segments` (`route_chat.py:1174-1221`) applies only `strip_think_reasoning` plus whitespace collapse (`:1209`).
- `normalize_tts_text` (`registry.py:248-253`) removes only zero-width characters and NUL and collapses whitespace.
- So **brackets, `*emphasis*` and markdown links reach the TTS provider unchanged today.**

**The calls path is partly sanitized:**
- `normalize_text_for_tts` (`src/services/voice_orchestration/transcript_sanitizer.py:170-228`) turns markdown links and images into their visible text (`:80-81, 206-207`), strips emphasis, and removes only **empty** brackets (`:92, 219`). Non-empty `[text]` passes through.
- `validate_spoken_text` fails closed on `[INST]`/`[SYS]` and other role markers (`:33-39, 116-123`).
- On the user STT side, `sanitize_transcript_text` **rewrites** role markers into bracketed text such as `[quoted instruction marker]` (`:33-39, 305-345`). That text is persisted and sent to the LLM, which can echo it.

**Prompts say nothing about brackets:**
- The chat graphs require XML, forbid markdown fences and inline tags ("write actions as plain text or in a <narrator> tag", "Do not use markdown") but never mention square brackets or OOC (`adventure_chat.v2.json:33`, `character_chat.v2.json:33`, `character_group_chat.v2.json:33`).
- The callbot prompt forbids markdown, asterisks and stage directions (`callbot_chat.v2.json:32`). Its MiniMax interjections use parentheses, covered in 06.

**Markdown still appears in practice:**
- The SPA renders segment content as GFM markdown (`src/features/interaction/components/ChatMessage.tsx:4-5, 134-150`). A Markdown link with label `text` and illustrative target `url` becomes a link; `*x*` becomes emphasis.

**Text from outside the LLM can carry brackets:**
- user messages (roleplay "[OOC: …]" conventions);
- card fields and lorebook entries;
- markdown URL import (`src/services/markdown_import.py`).
There is no Tavern / W++ card importer (grep for `chara_card|sillytavern|first_mes` finds nothing), so bracket-heavy W++ text arrives only if pasted by hand.

**Frequency** cannot be measured without a DB query. Add "count of `response_segments` content containing `[`" to the 08 §18 read-replica batch.

### 9.2 Implication for the plan

On v3/v4 every `[...]` is an audio-tag candidate, and the code passes LLM and user brackets straight through. That is both an audio-artifact risk and an injection path from user-authored card text.

The plan needs **one shared narration sanitizer** for narration and calls, built from `transcript_sanitizer.normalize_text_for_tts` moved into a shared module:
1. Markdown links and images become their visible text; emphasis is stripped.
2. Drop whole OOC blocks (`[OOC: …]`, `(OOC …)`) from spoken text.
3. Strip the bracket characters from every other `[...]` and keep the words. ElevenLabs documents no escape for literal brackets [unverified].
4. Prepend audio tags **only after** sanitizing, and only from our own allow-list (emotion and thought mapping, G11). Never pass a tag that appears in LLM or user text.
5. Hash the sanitized text for reuse (`normalized_text_sha256`).
6. Add a prompt line to the three chat graphs: "Do not use square brackets in narration, dialogue or thoughts".
7. Unit-test with `[Chapter 2]`, `[OOC: brb]`, `[link](http://x)`, a `[whispers]` injected through card text, and `[quoted instruction marker]`.

## Remaining open items (not closable from code)

- **G16:** legal sufficiency of self-attestation versus real age verification; whether mature narration stays disabled.
- **G6:**
  - production counts: distinct MiniMax voice ids, custom vs system voices, `is_global` rows, out-of-range recipes;
  - whether the operator holds off-platform clone sources and consent;
  - whether MiniMax `retrieve_content` returns uploaded clone files.
- **G4:**
  - the exact ElevenLabs signature scheme (`v0` vs `v1`, timestamp window), from a captured staging delivery;
  - whether production has public HTTPS ingress.
- **G12:** measured LUFS spread across candidate voices, to decide whether static `gain_db` is enough.
- **G8:** per-model `language_code` support on v3/v4/Flash.
- **G11:**
  - how often brackets appear in stored segments (read-replica query);
  - whether v4 reads stripped-bracket text naturally.
- **G10 / decision 14:** the price of a `voice_preview` operation and the `chars_per_credit` value. Both need the cost model from the G15 spike.

## Sources

### Codebase (read-only, working trees as of 2026-10-12)

Frontend (`/home/andres/WebstormProjects/magic-worlds`):
- `/home/andres/WebstormProjects/magic-worlds/src/ui/components/AppWarningModal.tsx`
- `/home/andres/WebstormProjects/magic-worlds/src/ui/components/AppWarningModal.stories.tsx`
- `/home/andres/WebstormProjects/magic-worlds/src/app/router/AppRouter.tsx`
- `/home/andres/WebstormProjects/magic-worlds/src/app/i18n/locales/en.ts`
- `/home/andres/WebstormProjects/magic-worlds/src/app/i18n/locales/es.ts`
- `/home/andres/WebstormProjects/magic-worlds/src/app/i18n/languages.ts`
- `/home/andres/WebstormProjects/magic-worlds/src/app/providers/LanguageProvider.tsx`
- `/home/andres/WebstormProjects/magic-worlds/src/app/providers/AudioPlaylistProvider.tsx`
- `/home/andres/WebstormProjects/magic-worlds/src/shared/featureFlags.ts`
- `/home/andres/WebstormProjects/magic-worlds/src/shared/voiceFeatureFlag.ts`
- `/home/andres/WebstormProjects/magic-worlds/src/shared/billingFeatureFlag.ts`
- `/home/andres/WebstormProjects/magic-worlds/src/shared/types/auth.types.ts`
- `/home/andres/WebstormProjects/magic-worlds/src/features/profile/components/membership.helpers.ts`
- `/home/andres/WebstormProjects/magic-worlds/src/features/profile/components/UsageSection.tsx`
- `/home/andres/WebstormProjects/magic-worlds/src/features/admin/membership/components/membershipFormat.ts`
- `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/VoiceCloneForm.tsx`
- `/home/andres/WebstormProjects/magic-worlds/src/features/admin/playAdminAuditFixtures.tsx`
- `/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/VoiceStudioPage.tsx`
- `/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/VoicePickerDialog.tsx`
- `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/ChatMessage.tsx`
- `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/TurnNarration.tsx`
- `/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/index.ts`
- `/home/andres/WebstormProjects/magic-worlds/.env` (flag names only)
- `/home/andres/WebstormProjects/magic-worlds/docs/billing/README.md`
- `/home/andres/WebstormProjects/magic-worlds/docs/billing/SETUP.md`

Backend (`/home/andres/PycharmProjects/magic-worlds-api`):
- `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql`
- `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/membership_admin_models.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/llm_execution_admission.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/migrations/` (directory listing)
- `/home/andres/PycharmProjects/magic-worlds-api/scripts/migrations/` (directory listing)
- `/home/andres/PycharmProjects/magic-worlds-api/src/main.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/serve.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/runtime_config.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/scope.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/__init__.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/webhooks/fal.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_membership.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/billing_subscriptions.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_auth.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_voice_call.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/models/admin_voice.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/models/character.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/models/assistant.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/billing_config.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_segments.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/markdown_import.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/resource_tasks.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/assistants/app.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/webhook.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/config.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/engine.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/transcode.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/storage.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/engine.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/storage.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/errors.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/admission.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/transcript_sanitizer.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/stt_groq_client.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/runtime/adventure_chat.v2.json`
- `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/runtime/character_chat.v2.json`
- `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/runtime/character_group_chat.v2.json`
- `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/runtime/callbot_chat.v2.json`
- `/home/andres/PycharmProjects/magic-worlds-api/requirements.txt`
- `/home/andres/PycharmProjects/magic-worlds-api/Dockerfile`
- `/home/andres/PycharmProjects/magic-worlds-api/docker-compose.yml`
- `/home/andres/PycharmProjects/magic-worlds-api/.env.example`
- `/home/andres/PycharmProjects/magic-worlds-api/.env` (variable presence only; values not printed)
- `/home/andres/PycharmProjects/magic-worlds-api/tests/models/test_voice_preset_model.py`

api.auth (`/home/andres/PycharmProjects/api.auth`):
- `/home/andres/PycharmProjects/api.auth/src/Util/Models.py`
- `/home/andres/PycharmProjects/api.auth/src/routes/stripe_webhooks.py`
- `/home/andres/PycharmProjects/api.auth/src/Util/stripe/security.py`

Related research notes:
- [00_current_tts_review.md](00_current_tts_review.md)
- [03_elevenlabs_voices_catalog_cloning_design.md](03_elevenlabs_voices_catalog_cloning_design.md)
- [05_elevenlabs_platform_pricing_limits_policy.md](05_elevenlabs_platform_pricing_limits_policy.md)
- [06_backend_minimax_inventory.md](06_backend_minimax_inventory.md)
- [07_frontend_minimax_inventory.md](07_frontend_minimax_inventory.md)
- [08_voice_data_model_migration_surface.md](08_voice_data_model_migration_surface.md)
- [09_research_critic_gaps.md](09_research_critic_gaps.md)

### External (read 2026-10-12)

- [verified] ElevenLabs webhooks (header name, retries, auto-disable, voice removal events): https://elevenlabs.io/docs/eleven-api/resources/webhooks
- [verified] ElevenLabs Create speech: `output_format` list, tier limits and `language_code` (ISO 639-1; not supported on multilingual_v2): https://elevenlabs.io/docs/api-reference/text-to-speech/convert
- [verified] ElevenLabs Terms of Use §1(a), under-18 restriction: https://elevenlabs.io/terms-of-use
- [secondary] Hookdeck guide to ElevenLabs webhooks (`t=…,v0=…` HMAC-SHA256 scheme): https://hookdeck.com/webhooks/platforms/guide-to-elevenlabs-webhooks-features-and-best-practices
- [secondary, conflicting] Community skill page describing a `v1` scheme: https://openskillindex.com/skills/comeonoliver-skillshub-elevenlabs-webhooks-events
- [verified] MiniMax Voice Clone, 7-day deletion of unused cloned voices: https://platform.minimax.io/docs/api-reference/voice-cloning-clone
- [verified] MiniMax Files List (purpose filter `voice_clone` / `prompt_audio`): https://platform.minimax.io/docs/api-reference/file-management-list.md
- [verified] MiniMax Files Retrieve Content ("download the contents of a generated file"): https://platform.minimax.io/docs/api-reference/file-management-retrieve-content.md
