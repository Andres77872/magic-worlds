# Backend MiniMax Inventory (magic-worlds-api)

Research date: 2026-10-12

## Scope

This document lists every MiniMax touchpoint in the backend repository `/home/andres/PycharmProjects/magic-worlds-api` (git HEAD `f77e60f`). That includes code, config, DDL, Pydantic DTOs, prompts and agent graphs, tests and fakes, and docs. It also lists the MiniMax-specific semantics that would silently break if only the HTTP client were swapped: audio format assumptions, hex encoding, recipe ranges, text markup, status codes and persisted provider literals. For each item it gives the ElevenLabs equivalent or a migration action. It ends with the REMOVAL/REPLACEMENT CHECKLIST that drives the refactor.

- **Out of scope:** Groq STT, LLM profiles (`api.magic_llm`) and the frontend. Frontend touchpoints are listed only where the backend wire contract forces a frontend change.
- **No code was edited.** Both repositories were read-only for this research.

Confidence tags:
- `[verified: url]` means the fact was read today on the cited official page.
- `[secondary: url]` means a non-official or indirect source.
- `[unverified]` means inference or memory, to be checked before implementation.
- Codebase facts carry an absolute path and line number.

---

## Contents

- [0. Executive summary: top risks](#0-executive-summary-top-risks)
- [Method and footprint](#method-and-footprint)
- [1. Config and env vars](#1-config-and-env-vars)
- [2. Provider adapters, contracts and abstraction seams](#2-provider-adapters-contracts-and-abstraction-seams)
- [3. Data model (DDL, enums, embedded JSON)](#3-data-model-ddl-enums-embedded-json)
- [4. Pydantic models](#4-pydantic-models)
- [5. Text conventions](#5-text-conventions)
- [6. Error mapping, retries, billing/quota and observability](#6-error-mapping-retries-billingquota-and-observability)
- [7. Theme songs](#7-theme-songs)
- [8. Tests and fakes](#8-tests-and-fakes)
- [9. Docs, READMEs, .env.example, compose, pytest.ini](#9-docs-readmes-envexample-compose-pytestini)
- [10. Frontend cross-repo touchpoints forced by backend contracts](#10-frontend-cross-repo-touchpoints-forced-by-backend-contracts)
- [11. REMOVAL/REPLACEMENT CHECKLIST](#11-removalreplacement-checklist)
- [12. Open questions](#12-open-questions)
- [Sources](#sources)
- [Verification log (2026-10-12)](#verification-log-2026-10-12)

---

## 0. Executive summary: top risks

1. **The DB CHECK constraint is enforced by schema parity.**
   - `tts_job` has `CHECK (... and provider = 'minimax')` at `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:670` and a default of `'minimax'` at `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:639`.
   - `bootstrap.py` compares live CHECK constraints against `db.sql` at `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py:1510-1540`.
   - Inserting `provider='elevenlabs'` therefore needs four things together: a schema revision bump, a migration script, an upgrade-chain entry, and Python validator changes at `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:8501` and `:8994`.
   - There is precedent: `20260920_theme_song_fal.sql` widened the theme-song check to `IN ('minimax','fal')` (`/home/andres/PycharmProjects/magic-worlds-api/docs/database.md:203-215`).
2. **The `speech_2_8_turbo` literal breaks `/tasks` and chat TTS delivery for any other alias.**
   - Enforced at `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py:980` (raise) and `:997` (hard-coded).
   - Also enforced at `/home/andres/PycharmProjects/magic-worlds-api/src/models/tts.py:61` (`Literal["speech_2_8_turbo"]`) and `/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_tts_delivery.py:536-537`.
   - It flows into `/tasks` through `/home/andres/PycharmProjects/magic-worlds-api/src/services/media_tasks.py:7-17`.
   - New ElevenLabs rows and legacy MiniMax rows must both project, or one set crashes the task list.
3. **Persisted callbot turns carry `tts_provider: 'minimax_streaming'`.**
   - The value is written at `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/callbot_execution.py:124`.
   - It is required on read at `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/conversation_turn_store.py:395` and `:604`.
   - It is also required on `voice_session` rows at `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:5346`, `:5801` and `:5845`, with the DDL default at `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:263`.
   - Validators must accept the legacy value plus the new one. Otherwise history replay and reconciliation fail for existing calls.
4. **32 kHz MP3 and hex encoding are assumed end to end, but ElevenLabs has no 32 kHz MP3.**
   - ElevenLabs MP3 formats are `mp3_22050_32`, `mp3_24000_48` and `mp3_44100_{32,64,96,128,192}`; the default is `mp3_44100_128` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert].
   - The 32 kHz value is hard-coded in `NormalizedTtsAudio`, `TtsRegistryModel`, `VoiceAudioChunk`, the delivery frame guard (`/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/delivery.py:352`), the call-audio persistence (`/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:2394`) and the frontend type literal.
   - Hex is the MiniMax wire encoding. ElevenLabs returns raw bytes over HTTP and base64 over WebSocket. Every `hex_audio` / `hex_payload` / `audio_hex` / `trial_audio` field must become bytes.
5. **The voice recipe semantics do not map.**
   - The MiniMax recipe is `voice_id`, `speed` 0.5–2, `vol` (0,10], `pitch` -12..12, `emotion`, `language_boost`.
   - The ElevenLabs recipe is `voice_id`, `model_id`, `voice_settings{stability, similarity_boost, style, use_speaker_boost, speed}`, `language_code` and `seed` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert].
   - ElevenLabs has no TTS volume and no pitch. Emotion becomes v3/v4 audio tags.
   - Inner-thought dimming (`vol*0.6`, `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:1129-1134`) has no direct equivalent.
6. **MiniMax voice IDs are embedded in user data.**
   - Locations: card `props.voice` (three tables), `adventure_session.template_snapshot` (characters plus `narrator_voice`), `voice_preset.base_voice_id`, raw `voice_id` in `voice_transcript_segment.tts_summary` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:2081`), and the env defaults.
   - `build_resolved_voice` accepts any string. Unmapped IDs would fail at synthesis time with `404 voice_not_found` [verified: https://elevenlabs.io/docs/developers/resources/errors].
   - A data migration (mapping table or reset-to-default) is required.
7. **The prompt contract uses MiniMax text markup.**
   - The callbot prompt teaches `<#0.5#>` pauses and `(laughs)` interjections (`/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/runtime/callbot_chat.v2.json:32`).
   - The sanitizer treats `<#x#>` as the only allowed angle-bracket markup (`/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/transcript_sanitizer.py:47-51`).
   - Changing the prompt requires regenerating the graph hash at `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/builtin_agents.v1.json:40`.
8. **The consent copy names MiniMax.** It must disclose "MiniMax streaming TTS" (`/home/andres/PycharmProjects/magic-worlds-api/.env.example:477-480`), so `VOICE_CONSENT_VERSION` must be bumped when the provider changes.
9. **Theme songs do not call the MiniMax API.**
   - They use fal.ai `minimax/music-3` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/registry.py:30`), and that is the default alias.
   - Removing it is a product decision (keep, switch default to `ace_step`, or adopt ElevenLabs Music). It is not required to remove the MiniMax Audio integration.
10. **The provider seams exist but are narrow and named after MiniMax.**
    - Usable Protocols: `TtsProvider`, `StreamingTtsClient`, `AudioStorage`, `VoiceAdminService`.
    - Their data types, config, `app.state` names (`minimax_tts_provider`, `minimax_voice_admin_*`), readiness checks and error classifiers are MiniMax-specific.

---

## Method and footprint

**How the inventory was built.**
- Case-insensitive `grep -rni minimax` over `src/`, `tests/`, `docs/`, `.env.example`, `docker-compose.yml`, `pytest.ini` and `requirements.txt`.
- Additional greps for MiniMax semantics that do not use the word: `speech_2_8_turbo`, `speech-2.8-turbo`, `32000`/`32_000`, `hex_audio`, `hex_payload`, `audio_hex`, `trial_audio`, `language_boost`, `emotion`, `vol`, `pitch`, `<#`, `minimax_streaming`, `base_resp`, `trace_id`.
- Line numbers were confirmed per file with `grep -n` / `sed -n`.

| Area | Literal "minimax" mentions | Files |
|---|---|---|
| `src/` | 403 | 44 |
| `tests/` | 814 | 68 |
| `docs/` (backend) | 49 | 9 |
| `.env.example` | MiniMax AUDIO section, CHAT TTS section, VOICE section, live test flags | 1 |
| `docker-compose.yml` | lines 124–129, 154–155 | 1 |
| `requirements.txt` | 0. There is no MiniMax SDK: it uses `httpx`, `websockets>=16`, `fal-client`, `lameenc` | 1 |

**The three MiniMax integration paths (plus one non-MiniMax path):**

| Path | Transport | Endpoint(s) | Entry point |
|---|---|---|---|
| A. Chat narration (async jobs) | HTTP `POST {MINIMAX_BASE_URL}/v1/t2a_v2`, `output_format:"hex"`, MP3 32 kHz / 128 kbps / mono | `T2A_HTTP_PATH` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:15` |
| B. Realtime voice calls | WebSocket `wss://api.minimax.io/ws/v1/t2a_v2`, `task_start` / `task_continue` / `task_finish`, hex chunks | `DEFAULT_MINIMAX_STREAMING_TTS_WS_URL` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:25` |
| C. Root voice admin + presets | HTTP `/v1/voice_design`, `/v1/get_voice`, `/v1/delete_voice`, `/v1/t2a_v2`, `/v1/files/upload`, `/v1/voice_clone` | constants | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:63-69` |
| D. Theme songs (not MiniMax API) | fal.ai queue, endpoint `minimax/music-3` | `MINIMAX_MUSIC_3_ENDPOINT` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/registry.py:30` |

---

## 1. Config and env vars

### 1.1 Shared credential loader

| Fact | Location |
|---|---|
| `MINIMAX_AUDIO_API_KEY_ENV = "MINIMAX_AUDIO_API_KEY"` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_credentials.py:8` |
| `load_minimax_audio_api_key(environ)`, built on `parse_optional_text_setting` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_credentials.py:11-17` |
| Consumers: TTS engine config, voice orchestration config, voice admin config | see 1.2–1.4 |

**ElevenLabs equivalent.**
- Authentication uses one header, `xi-api-key` [verified: https://elevenlabs.io/docs/api-reference/authentication].
- Keys can be scoped to endpoints, given a credit quota and IP-allowlisted [verified: https://elevenlabs.io/docs/api-reference/authentication].
- Recommendation: two scoped keys. One TTS-only key for paths A and B, and one voices-write key for path C. The current single shared key would then become `ELEVENLABS_TTS_API_KEY` plus `ELEVENLABS_VOICE_ADMIN_API_KEY`, or a single `ELEVENLABS_API_KEY` if scoping is not wanted.
- The key format is not documented officially. Third parties report an `sk_` prefix [secondary: https://docs.gitguardian.com/secrets-detection/secrets-detection-engine/detectors/specifics/elevenlabs_api_key], [secondary: https://trevorfox.com/api-key-tester/elevenlabs/].

### 1.2 Chat narration config (`TtsEngineConfig`)

File: `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py`

| Line(s) | Item | MiniMax-specific? | ElevenLabs action |
|---|---|---|---|
| 25 | `DEFAULT_MINIMAX_BASE_URL = "https://api.minimax.io"` | yes | `https://api.elevenlabs.io`. Allow the regional hosts `api.us.elevenlabs.io`, `api.eu.residency.elevenlabs.io`, `api.in.residency.elevenlabs.io`, `api.sg.residency.elevenlabs.io` [verified: https://elevenlabs.io/docs/api-reference/introduction.md] |
| 26–27 | `DEFAULT_MODEL_ALIAS="speech_2_8_turbo"`, `DEFAULT_PROVIDER_MODEL_ID="speech-2.8-turbo"` | yes | e.g. alias `eleven_multilingual_v2` (quality, 29 languages, 10k chars) or `eleven_flash_v2_5` (~75 ms, 32 languages, 40k chars) [verified: https://elevenlabs.io/docs/overview/models] |
| 28–37 | Defaults and ceilings: timeout 60/60, ack 1.0/1.0, max_job_age 120/120, max_text_chars 3000/3000, max_output_bytes 10 MiB, mirror timeout 20, global_concurrency 3 (ceiling 20), provider_max_attempts 2 (ceiling 2) | partly | Retune `TTS_GLOBAL_CONCURRENCY` to the plan concurrency limit (e.g. Creator: 5 Multilingual / 10 Flash) [verified: https://elevenlabs.io/docs/overview/models]. Keep the 3000-char app cap (all EL models allow 5k or more) |
| 38–49 | `_TTS_ENGINE_SETTING_NAMES`, orphan-rejected when `TTS_ENGINE_ENABLED` is false. `MINIMAX_*` names are intentionally excluded because they are shared | yes (by omission) | Add the `ELEVENLABS_*` TTS names (model, output format, voice settings defaults) and decide which names are shared |
| 53–68 | `TtsEngineConfig.minimax_api_key`, `.minimax_base_url` | yes | rename to `provider_api_key` / `provider_base_url` (provider-neutral) |
| 88–92 | Raises unless the alias and model ID equal the MiniMax pair ("TTS model identifiers must use the valid MiniMax model") | yes | replace with a registry lookup over allowed ElevenLabs models |
| 179–264 | `from_env`. `MINIMAX_BASE_URL` accepts `http` or `https` (199–204) | yes | require `https` for EL; read `ELEVENLABS_*` |
| 266–282 | `availability_issues`: `missing_minimax_audio_api_key`, `missing_tts_default_voice_id`, `missing_storage_root`, `invalid_minimax_base_url`, `invalid_tts_model` | yes | rename the issue codes (provider-neutral or `elevenlabs_*`). Tests assert these strings |
| 288–294 | `readiness` | no | keep |

### 1.3 Realtime voice config (`VoiceOrchestrationConfig`)

File: `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py`

| Line(s) | Item | ElevenLabs action |
|---|---|---|
| 25 | `DEFAULT_MINIMAX_STREAMING_TTS_WS_URL = "wss://api.minimax.io/ws/v1/t2a_v2"` | Replace with the multi-context URL template `wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/multi-stream-input` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input]. The voice ID is part of the path, so one connection is bound to one voice |
| 40–66 | `_VOICE_MODE_ONLY_ENV_NAMES` includes `CALLBOT_INTERJECTIONS_ENABLED`, `VOICE_TTS_PROVIDER`, `VOICE_MINIMAX_TTS_WS_URL`, `VOICE_MINIMAX_TTS_VOICE_ID` | rename to `VOICE_ELEVENLABS_TTS_WS_URL`, `VOICE_ELEVENLABS_TTS_VOICE_ID`, `VOICE_ELEVENLABS_TTS_MODEL`, `VOICE_ELEVENLABS_OUTPUT_FORMAT` |
| 91–94 | `tts_provider="minimax_streaming"`, `minimax_api_key`, `minimax_tts_ws_url`, `minimax_tts_voice_id` | rename provider-neutral, with a new provider value such as `elevenlabs_multi_context` |
| 153–156 | Raises unless `tts_provider == "minimax_streaming"` | replace with an allow-list |
| 157–172 | WS URL validation (`ws`/`wss`) | require `wss`; validate the `{voice_id}` placeholder |
| 280–445 | `from_env`; `reject_orphan_settings` at 287–292 | update names |
| 453–477 | `availability_issues`: `unsupported_voice_tts_provider`, `missing_minimax_audio_api_key`, `invalid_voice_minimax_tts_ws_url`, `missing_voice_minimax_tts_voice_id` | rename |

### 1.4 Voice admin config

File: `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py`

| Line(s) | Item | ElevenLabs action |
|---|---|---|
| 44 | `DEFAULT_MINIMAX_BASE_URL` (a duplicate of the TTS one) | share one provider base URL |
| 45–50 | timeout 60; `SYSTEM_VOICE_CACHE_TTL_SECONDS` 300; clone timeout 300; clone upload max 20 MiB | keep the semantics. The EL IVC file-size limits are not stated on the page read today [unverified] |
| 51–62 | Allowed clone content types: mp3, m4a, wav | IVC accepts multipart `files` [verified: https://elevenlabs.io/docs/api-reference/voices/ivc/create]. The accepted MIME list was not confirmed [unverified] |
| 63–69 | Paths `/v1/voice_design`, `/v1/get_voice`, `/v1/delete_voice`, `/v1/t2a_v2`, `/v1/files/upload`, `/v1/voice_clone`; `VOICE_TEST_MODEL="speech-2.8-turbo"` | replace (see 2.3) |
| 96–192 | `MiniMaxVoiceAdminConfig` with `MINIMAX_VOICE_ADMIN_TIMEOUT_SECONDS`, `MINIMAX_VOICE_CLONE_TIMEOUT_SECONDS`, `MINIMAX_VOICE_CLONE_MAX_UPLOAD_BYTES` | rename `VOICE_ADMIN_*` (provider-neutral) |
| 195 | `load_minimax_voice_admin_config` | rename |

### 1.5 Env var master table

| Env var | Defined / documented | Consumers | ElevenLabs replacement |
|---|---|---|---|
| `MINIMAX_AUDIO_API_KEY` | `/home/andres/PycharmProjects/magic-worlds-api/.env.example:392`, `:423`; `/home/andres/PycharmProjects/magic-worlds-api/docker-compose.yml:126` | 1.1 → 1.2, 1.3, 1.4; log text at `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:1347`; `/home/andres/PycharmProjects/magic-worlds-api/src/main.py:760-767` error message | `ELEVENLABS_API_KEY` (or scoped split) |
| `MINIMAX_BASE_URL` | `/home/andres/PycharmProjects/magic-worlds-api/.env.example:391`, `:422`; `/home/andres/PycharmProjects/magic-worlds-api/docker-compose.yml:125` | 1.2, 1.4; logged at `/home/andres/PycharmProjects/magic-worlds-api/src/main.py:995-1009` | `ELEVENLABS_BASE_URL` (default `https://api.elevenlabs.io`; residency hosts allowed) |
| `MINIMAX_VOICE_ADMIN_TIMEOUT_SECONDS` | `/home/andres/PycharmProjects/magic-worlds-api/.env.example:397`; `/home/andres/PycharmProjects/magic-worlds-api/docker-compose.yml:127` | 1.4 | `VOICE_ADMIN_TIMEOUT_SECONDS` |
| `MINIMAX_VOICE_CLONE_TIMEOUT_SECONDS` | `/home/andres/PycharmProjects/magic-worlds-api/.env.example:401`; `/home/andres/PycharmProjects/magic-worlds-api/docker-compose.yml:128` | 1.4 | `VOICE_ADMIN_CLONE_TIMEOUT_SECONDS` |
| `MINIMAX_VOICE_CLONE_MAX_UPLOAD_BYTES` | `/home/andres/PycharmProjects/magic-worlds-api/.env.example:403`; `/home/andres/PycharmProjects/magic-worlds-api/docker-compose.yml:129` | 1.4 | `VOICE_ADMIN_CLONE_MAX_UPLOAD_BYTES` |
| `TTS_DEFAULT_VOICE_ID` | `/home/andres/PycharmProjects/magic-worlds-api/.env.example:424` (`<minimax-tts-voice-id-from-secret-config>`); `/home/andres/PycharmProjects/magic-worlds-api/docker-compose.yml:133` | registry default voice (`/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:264-276`) | keep the name. The value becomes an EL `voice_id` (e.g. a premade voice) |
| `TTS_ENGINE_ENABLED`, `TTS_STORAGE_ROOT`, `TTS_TIMEOUT_SECONDS`, `TTS_ACK_TARGET_SECONDS`, `TTS_MAX_JOB_AGE_SECONDS`, `TTS_MAX_TEXT_CHARS`, `TTS_MAX_OUTPUT_BYTES`, `TTS_MIRROR_TIMEOUT_SECONDS`, `TTS_GLOBAL_CONCURRENCY`, `TTS_PROVIDER_MAX_ATTEMPTS` | `/home/andres/PycharmProjects/magic-worlds-api/.env.example:416-455`; `/home/andres/PycharmProjects/magic-worlds-api/docker-compose.yml:132-142` | 1.2 | keep (provider-neutral). Retune concurrency |
| new: `TTS_MODEL_ALIAS`, `TTS_OUTPUT_FORMAT` | — | — | add: model choice (`eleven_multilingual_v2` / `eleven_flash_v2_5` / `eleven_v3` / `eleven_v4`) and `mp3_44100_128` |
| `VOICE_TTS_PROVIDER` | `/home/andres/PycharmProjects/magic-worlds-api/.env.example:495` (`minimax_streaming`); `/home/andres/PycharmProjects/magic-worlds-api/docker-compose.yml:153` | 1.3 | new value e.g. `elevenlabs_multi_context` |
| `VOICE_MINIMAX_TTS_WS_URL` | `/home/andres/PycharmProjects/magic-worlds-api/.env.example:496`; `/home/andres/PycharmProjects/magic-worlds-api/docker-compose.yml:154` | 1.3 | `VOICE_ELEVENLABS_TTS_WS_URL` |
| `VOICE_MINIMAX_TTS_VOICE_ID` | `/home/andres/PycharmProjects/magic-worlds-api/.env.example:497`; `/home/andres/PycharmProjects/magic-worlds-api/docker-compose.yml:155` | 1.3; engine guard `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:512-515` | `VOICE_ELEVENLABS_TTS_VOICE_ID` (or `VOICE_TTS_DEFAULT_VOICE_ID`) |
| `VOICE_CONSENT_VERSION` | `/home/andres/PycharmProjects/magic-worlds-api/.env.example:480` (`voice-v1`); `/home/andres/PycharmProjects/magic-worlds-api/docker-compose.yml:146` | consent gating | bump (e.g. `voice-v2`), because the disclosure copy changes |
| `VOICE_GLOBAL_CONCURRENCY` | `/home/andres/PycharmProjects/magic-worlds-api/.env.example:505`; `/home/andres/PycharmProjects/magic-worlds-api/docker-compose.yml:160` | voice engine | size to EL concurrency; one WS per call [verified: https://elevenlabs.io/docs/developers/guides/cookbooks/multi-context-web-socket] |
| `CALLBOT_INTERJECTIONS_ENABLED` | `/home/andres/PycharmProjects/magic-worlds-api/.env.example:221-226`; `/home/andres/PycharmProjects/magic-worlds-api/docker-compose.yml:95` | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:114-120`, prompt | keep. Re-scope to EL audio tags (v3/v4) or disable for Flash (see section 5) |
| `RUN_VOICE_TTS_PROVIDER_CONTRACT_TESTS` | `/home/andres/PycharmProjects/magic-worlds-api/.env.example:531` | live WS contract test | keep the name; retarget to EL |
| `RUN_MINIMAX_PROVIDER_CONTRACT_TESTS` | `/home/andres/PycharmProjects/magic-worlds-api/.env.example:653` | placeholder live test | rename `RUN_TTS_PROVIDER_CONTRACT_TESTS` / `RUN_ELEVENLABS_PROVIDER_CONTRACT_TESTS` |
| `THEME_SONG_DEFAULT_MODEL_ALIAS` | `/home/andres/PycharmProjects/magic-worlds-api/.env.example:340` (`minimax_music_3`) | theme songs | product decision (section 7) |

### 1.6 Startup wiring (`main.py`)

File: `/home/andres/PycharmProjects/magic-worlds-api/src/main.py`

| Line(s) | Item | Action |
|---|---|---|
| 51 | import `load_callbot_interjections_enabled` | keep |
| 83 | import `MiniMaxVoiceAdminService`, `load_minimax_voice_admin_config` | rename |
| 99–104 (101) | import `MiniMaxT2AProvider` | replace with a provider factory |
| 670–671 | interjection policy on app state | keep |
| 760–767 | TTS config validation. The error message names `MINIMAX_AUDIO_API_KEY` | rename |
| 770–775 | voice config validation | rename |
| 797–803 | TTS storage probe | keep |
| 915–941 (920, 925, 927, 939) | `app.state.minimax_tts_provider = MiniMaxT2AProvider(config=tts_config)` and the engine built with `provider=minimax_tts_provider` | rename to `app.state.tts_provider`; build from the registry |
| 943–953 (947–950) | `app.state.minimax_voice_admin_config` / `minimax_voice_admin_service`. **Always constructed; only warns if unavailable** | rename to `voice_admin_*`. Keep the soft-fail |
| 955–981 | voice engine; requires `tts_storage` and `LLM_PROFILES_ENABLED` | keep; swap the streaming client |
| 995–1009 | logs `minimax_base_url` | rename |
| 1069–1075 | shutdown closes the voice admin service (`isinstance(..., MiniMaxVoiceAdminService)` at 1074) | rename |
| 1458–1495 | `_check_tts_engine`: state name `minimax_tts_provider` (1471, 1479); `isinstance(provider, MiniMaxT2AProvider)` (1483) | replace the `isinstance` with a Protocol/attribute check |
| 1499–1521 | `_check_voice_call` | update |
| 1719–1733, 1847–1877 | readiness wiring | update the issue codes |

---

## 2. Provider adapters, contracts and abstraction seams

### 2.1 Path A: chat narration HTTP adapter

**Request side.**
- `TtsModelRegistry.to_provider_payload` at `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:205-241` builds the MiniMax body:
  - `model`, `text`, `stream:false`, `output_format:"hex"`;
  - `voice_setting{voice_id, speed?, vol?, pitch?, emotion?}`;
  - `audio_setting{format:"mp3", sample_rate:32000, bitrate:128000, channel:1}`;
  - `language_boost`.

**Adapter.** File: `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py`

| Line(s) | Item | MiniMax semantic | ElevenLabs replacement |
|---|---|---|---|
| 15 | `T2A_HTTP_PATH="/v1/t2a_v2"` | endpoint | `POST /v1/text-to-speech/{voice_id}?output_format=mp3_44100_128` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert] |
| 17–25 | `RETRYABLE_MINIMAX_T2A_CODES={1000,1001,1002,1024,1033,1039,2045,2056}`, `_RATE_LIMIT_CODES`, `_CONTENT_BLOCKED_CODES={1026,1027}`, `_INVALID_INPUT_CODES={1042}`, `_UNAVAILABLE_CODES={1004,1008,2013,20132,2042,2049}`, `_MAX_TTS_PROVIDER_ATTEMPTS=2`, backoff 0.01–0.05 s | `base_resp.status_code` | HTTP status plus `detail.type` / `detail.code` (section 6) |
| 28–56 | `NormalizedTtsAudio(hex_audio, file_size_bytes, duration_ms, sample_rate==32000, channels==1, bitrate==128000, content_type audio/mpeg, format mp3)` | hex, 32 kHz | `audio_bytes: bytes`; sample rate from the requested `output_format` (44100 / 22050 / 24000); bitrate from the format |
| 62–111 | `TtsProviderCompletion`; on success requires `provider_status_code == 2` (98–99) | MiniMax `data.status == 2` | HTTP 200; record the `request-id` header |
| 114–119 | `TtsProvider` Protocol: `provider_name`, `synthesize(model, request) -> completion`, `close` | — | **keep as the seam**; move to a neutral module |
| 122–214 | `MiniMaxT2AProvider`; `Authorization: Bearer` at 145 | Bearer | `xi-api-key` header [verified: https://elevenlabs.io/docs/api-reference/authentication] |
| 217–294 | `_completion_from_body` requires `trace_id`, `base_resp`, `data{audio,status}`, `status==2`, `extra_info` | JSON envelope | The EL response body is the audio stream (`application/octet-stream`/`audio/mpeg`). Metadata comes in headers: `request-id`, `x-trace-id`, `character-cost` [verified: https://elevenlabs.io/docs/api-reference/introduction.md]. Another page shows `x-character-count`, an inconsistency (see Open questions) |
| 312–362 | `_extract_audio`: strict `extra_info` match (sample rate, bitrate, channels, format, size) | provider echo | No echo. Validate by MP3 frame-header parsing (the parser exists at `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:2286-2343`) |
| 396–421 | provider code and HTTP category mapping | — | replace |
| 502–503 | `Retry-After` honored for HTTP errors | — | keep. The EL errors page recommends exponential backoff on 429 and does not mention `Retry-After` [verified: https://elevenlabs.io/docs/developers/resources/errors] |

**ElevenLabs request body fields** [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert]:
- `text` and `model_id` (default `eleven_multilingual_v2`).
- `language_code`.
- `voice_settings{stability (default 0.5), similarity_boost (0.75), style (0), use_speaker_boost (true), speed (1)}`.
- `pronunciation_dictionary_locators` (at most 3).
- `seed` (0–4294967295).
- `previous_text` / `next_text`, and `previous_request_ids` / `next_request_ids` (at most 3).
- `use_pvc_as_ivc`.
- `apply_text_normalization` (`auto`/`on`/`off`) and `apply_language_text_normalization`.
- Query parameter `enable_logging` (false means zero retention, Enterprise only).

**Improvement opportunity.** Narration is split into per-message segments (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:1174-1221`). Passing `previous_text`/`next_text` (or `previous_request_ids`) would give prosody continuity across segments. MiniMax had no equivalent. Whether request stitching works with `eleven_v3`/`eleven_v4` is [unverified].

There is a trade-off with zero retention. `enable_logging=false` (Enterprise zero-retention) makes history features unavailable for that request, **including request stitching** [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert]. Zero retention and `previous_request_ids` stitching are therefore mutually exclusive, while `previous_text`/`next_text` still work. *(Added during verification.)*

**Engine coupling.** File: `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py`

| Line(s) | Item | Action |
|---|---|---|
| 27 | `from ...minimax_adapter import TtsProvider` (and data types) | re-import from the neutral module |
| 38–39 | allowed `audio/mpeg`, `mp3` | keep if the output stays MP3 |
| 52–69 | private-field markers include `minimax_api_key` | rename/add `provider_api_key`, `xi-api-key` |
| 94 | global semaphore | size to the EL plan |
| 193–294 | `_create_or_reuse_chat_job`: reuse lookup (227–240) runs **before** quota (257–258); `provider=model.provider` (269) | keep. The reuse query filters by provider, so no cross-provider reuse happens |
| 318–323 | `reserve_media_operation(operation="tts_generation")` | keep (app units) |
| 525–578 | retry loop | reclassify (section 6) |
| 580–698 | finalize: `save_provider_audio(hex_payload=audio.hex_audio)` (626–637); `provider_trace_id_hash` (605, 683); **`provider_url_hash=_sha256_or_none(audio.hex_audio)` (664)** | bytes. Hash bytes or null. Source the trace hash from the `request-id` header |
| 974–1004 | `tts_job_public_from_row`: **raises if `model_alias != "speech_2_8_turbo"` (980)**; hard-codes the alias (997) | accept a set of known aliases (legacy plus EL); return the stored alias |
| 1011–1035 | asset projection (mp3 only) | keep for MP3 |

### 2.2 Path B: realtime streaming TTS

File: `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py` (904 lines)

| Line(s) | Item | MiniMax semantic | ElevenLabs multi-context replacement |
|---|---|---|---|
| 20–47 | `MP3_CONTENT_TYPE`; `DEFAULT_MINIMAX_STREAMING_MODEL="speech-2.8-turbo"`; `MINIMAX_SAMPLE_RATE=32_000`; `MINIMAX_CHANNELS=1`; `MINIMAX_TEXT_NORMALIZATION_MODE="basic"`; first-audio timeout 15 s; receive timeout 10 s; `MINIMAX_REUSE_TURN_SOCKET=True`; idle 60 s; prewarm wait 3 s; rate/timeout/unavailable code sets | constants | query params `model_id` (e.g. `eleven_flash_v2_5`), `output_format` (e.g. `mp3_22050_32` or `mp3_44100_64`), `inactivity_timeout` (default 20, max 180), `apply_text_normalization`, `language_code`, `sync_alignment`, `auto_mode`, `enable_ssml_parsing`, `enable_logging`, `seed` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input] |
| 50–84 | `VoiceAudioChunk(seq, hex_audio, is_final, sample_rate==32000, channels==1, audio/mpeg, latency_ms, first_audio, result_summary)`; `audio_bytes` decodes hex | hex, 32 kHz | `audio_bytes: bytes` decoded from base64 `audio`; sample rate from the format |
| 87–105 | `StreamingTtsClient` Protocol: `provider_name`; `synthesize(text, *, turn_id, voice, cancel_event) -> AsyncIterator[VoiceAudioChunk]`; `prepare_turn`; `cancel(reason, turn_id)`; `close_turn`; `close` | — | **keep as the seam**. It maps cleanly onto contexts: `prepare_turn` initializes a context, `cancel` sends `close_context`, `close` sends `close_socket` |
| 108–133 | WS and connect-factory Protocols | — | keep |
| 136–181, 184 | `_TurnSession`, `_Synthesis` | per-turn socket reuse | one socket per call; one `context_id` per turn (at most 5 concurrent contexts per connection) [verified: https://elevenlabs.io/docs/developers/guides/cookbooks/multi-context-web-socket] |
| 219–622 | `MiniMaxStreamingTtsClient` | — | new `ElevenLabsMultiContextTtsClient` |
| 244–266 | `prepare_turn` (prewarm) | `task_start` early | open the socket at call start; send the context init `{"text":" ", "context_id":…, "voice_settings":…}` |
| 268–390 | `synthesize`: `task_continue`, plus `task_finish` for private sessions | — | send `{"text":…, "context_id":…, "flush":true}` at sentence end; end with `close_context` |
| 392–407 | `cancel`, `close_turn` | app-side drop | `{"context_id":…, "close_context":true}` gives clean barge-in [verified: https://elevenlabs.io/docs/developers/guides/cookbooks/multi-context-web-socket] |
| 506–544 | handshake `connected_success` → `task_start` → `task_started` | MiniMax events | no handshake events; the first server message carries `audio`/`contextId` |
| 572–580 | `_voice_id` fallback to `minimax_tts_voice_id` | — | rename. Note: the voice ID is in the URL path, so a voice change mid-call needs a new socket |
| 593–614 | Bearer headers; `max_size` 2 MB | — | `xi-api-key` header (server-to-server, so headers are allowed); review `max_size` for base64 frames |
| 616–622 | `_validate_ready` | — | rename |
| 698–701 | `build_streaming_tts_client` (single-provider factory) | — | provider registry factory |
| 727–754 | `_task_start_payload`: mirrors the HTTP `voice_setting`; `audio_setting{sample_rate:32000, format:"mp3", channel:1}`; `language_boost`; `text_normalization_mode` | recipe | `voice_settings{stability, similarity_boost, style, use_speaker_boost, speed}`. The WS `speed` range is 0.7–1.2 [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input] |
| 803–825 | `_raise_for_provider_error` on `base_resp`; rate limits map to `tts_unavailable` | — | WS error frames / close codes (shape not fully documented [unverified]) |
| 828–856 | `_extract_audio_hex` | hex | base64 `audio` |
| 859–872 | final detection (`is_final`) | — | `{"isFinal": true, "contextId": …}` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input] |

**Model constraint.** The TTS-vs-TTD WebSocket guide states "No eleven_v3 or eleven_v4 on this endpoint" for the TTS WebSocket (`/v1/text-to-speech/{voice_id}/stream-input`) and describes the TTS WebSocket as being for non-v3 models such as Flash or Multilingual v2 [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets]. *(Corrected during verification: the stream-input and multi-stream-input API reference pages do not themselves state this restriction. They only give the default `model_id` `eleven_multilingual_v2`.)* Third-party integrators fall back to HTTP streaming for v3 [secondary: https://github.com/livekit/agents/pull/4936]. Realtime calls should therefore use `eleven_flash_v2_5` (~75 ms) or a Turbo-class model.

If audio tags (`[laughs]`) are wanted in calls, there are two options:
- The same guide says the **Text to Dialogue WebSocket** requires a `model_id` starting with `eleven_v3` or `eleven_v4` [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets]. Its latency and fitness for single-speaker callbot turns are [unverified]. *(Added during verification.)*
- Use the HTTP `/stream` endpoint per sentence with v3/v4, at the cost of latency [unverified].

**Voice engine coupling.** File: `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py`

| Line(s) | Item | Action |
|---|---|---|
| 16 | import `ResolvedVoice` | follow the rename |
| 50 | import streaming client/types | follow the rename |
| 58–66 | `VOICE_CALL_OPERATION="voice_call"`, `VOICE_CALL_SECONDS_PER_CREDIT=10`, `VOICE_TTS_QUEUE_MAX_SENTENCES=4`, `VOICE_TTS_IDLE_FLUSH_SECONDS=0.12` | keep; align `flush` with the EL `chunk_length_schedule` |
| 512–515 | requires `config.minimax_tts_voice_id` ("Voice engine requires a valid MiniMax default voice_id") | rename |
| 611 | `tts_provider` stored on the session | write the new value |
| 1246 | `tts_client.cancel` | keep (maps to `close_context`) |
| 1564–1660 | TTS worker: `_mp3_duration_ms` used for billing per sentence (1587); `normalize_text_for_tts` (1603); synthesize (1609); `sample_rate=chunk.sample_rate` (1637) | keep. Verify that frame parsing works when EL chunk boundaries are not frame-aligned [unverified] |
| 1722, 1869 | `prepare_turn`, `close_turn` | keep |
| 1937 | `_record_billable_audio` | keep |
| 2081 | `tts_summary` stores the **raw `voice_id`** | hash it (privacy improvement), or keep it for support. Decide |
| 2088–2111 | `build_default_voice_call_engine(callbot_interjections_enabled=…)` | keep |
| 2227–2233 | `_chunk_audio_bytes` | bytes |
| 2286–2343 | MP3 frame parser (MPEG-1/2/2.5, 44.1/48/32/22.05/24/16 kHz…); docstring says "for MiniMax chunks" | keep; fix the docstring |
| 2346–2444 | `_persist_call_audio_asset`: `hex_payload=audio_bytes.hex()` (2391); **`sample_rate=32_000` (2394)**; **`model_alias="speech_2_8_turbo"`, `provider="minimax"`, `provider_model_id="speech-2.8-turbo"` (2406–2415)**; `source="call_character_tts"` | bytes; real sample rate; provider identity from the active client |

**Delivery to the browser.** File: `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/delivery.py`

| Line(s) | Item | Action |
|---|---|---|
| 159 | `send_audio_chunk(..., sample_rate=32_000)` default | remove the default |
| 212–240 | `voice_ready_frame` does not advertise the audio format | improvement: advertise `content_type`/`sample_rate` |
| 342–364 | `voice_audio_chunk_frame`: default `sample_rate: int = 32_000` (349, added during verification); **raises unless `sample_rate == 32_000 and channels == 1` (352)**; emits base64 `data_b64` with `audio/mpeg` | allow the chosen EL rate set; frontend type change (section 10) |
| 455 | redaction markers | add EL markers |

### 2.3 Path C: voice admin, catalog and presets

**Service.** File: `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py` (807 lines)

| Line(s) | MiniMax operation | ElevenLabs equivalent | Notes |
|---|---|---|---|
| 209–216 | per-process system-voice cache with a lock | keep the cache for `/v2/voices` | — |
| 218–236 | `design_voice` → `/v1/voice_design` (single call, returns hex `trial_audio` and a `voice_id`) | Two steps: (1) `POST /v1/text-to-voice/design` with `voice_description`, `model_id` (`eleven_multilingual_ttv_v2` / `eleven_ttv_v3`), `text` (100–1000 chars) or `auto_generate_text`, `loudness` (-1..1), `seed`, `guidance_scale`, `stream_previews`, `should_enhance`, and `reference_audio_base64`/`prompt_strength` (v3 only). It returns `previews[]{audio_base_64, generated_voice_id, media_type, duration_secs, language}` [verified: https://elevenlabs.io/docs/api-reference/text-to-voice/design]. (2) `POST /v1/text-to-voice` with `voice_name`, `voice_description`, `generated_voice_id`, `labels`, `played_not_selected_voice_ids`, which returns `voice_id` [verified: https://elevenlabs.io/docs/api-reference/text-to-voice/create.md] | UX becomes "pick one of N previews, then save". The DTOs and frontend change |
| 238–273 | `list_voices` → `/v1/get_voice` (`voice_type` all/system/cloning/generation) | `GET /v2/voices` (`page_size` up to 100, `next_page_token`, `search`, `sort`, `voice_type`, `category` premade/cloned/generated/professional, `voice_ids` up to 100, `include_total_count`) [verified: https://elevenlabs.io/docs/api-reference/voices/search]; plus the shared library `GET /v1/shared-voices` [verified: https://elevenlabs.io/docs/api-reference/voices/voice-library/get-shared.md] | Pagination is new; the MiniMax list was one shot. Categories replace the MiniMax groups |
| 275–297 | `delete_voice` → `/v1/delete_voice` (`voice_type` + `voice_id`) | `DELETE /v1/voices/{voice_id}` returns `{"status":"ok"}` [verified: https://elevenlabs.io/docs/api-reference/voices/delete] | `voice_type` is no longer needed in the route |
| 299–311 | `test_voice` → `/v1/t2a_v2` with `VOICE_TEST_MODEL` | `POST /v1/text-to-speech/{voice_id}` | returns bytes, not hex |
| 313–366 | `upload_clone_file` → `/v1/files/upload` (purpose, returns int `file_id`) | none (folded into the IVC multipart) | delete the separate route, or keep it as a local staging upload |
| 368–421 | `clone_voice` → `/v1/voice_clone` (`file_id`, `voice_id`, `prompt_audio`, `text`, `model`, `language_boost`, noise reduction, volume normalization; returns a `demo_audio` URL) | `POST /v1/voices/add` (multipart `name`, `files`, `remove_background_noise`, `description`, `labels`) returns `{voice_id, requires_verification}` [verified: https://elevenlabs.io/docs/api-reference/voices/ivc/create] | No caller-chosen `voice_id` (EL assigns it). No demo audio (generate a test instead). `requires_verification` must be surfaced |
| 427–538 | Bearer posts (488, 518) | `xi-api-key` | — |
| 576–608 | `_raise_for_base_resp`; codes 1002, 1039, 2045, 2056 map to 429 | HTTP status + `detail.code` | section 6 |
| 615–641 | `_voice_test_payload` defaults: speed 1, vol 1, pitch 0, sample_rate 32000, bitrate 128000 (MP3 only), `language_boost` "auto", `output_format` "hex" | EL convert body | — |
| 644–702 | `_voice_test_response` | — | replace |
| 705–750 | voice groups and entries (`system_voice`, `voice_cloning`, `voice_generation`); `deletable` for cloned/generated | `category` premade → not deletable; cloned/generated/professional → deletable (workspace-owned) [unverified for professional] | — |
| 79–87 | `_CLONE_STATUS_DETAIL` codes 2037, 2039, 2042, 2048, 1043, 1044, 1008 | EL `detail.code` | — |
| 89–93 | `_VOICE_GROUP_KEYS` | EL `category` | — |
| 199–206 | `MiniMaxVoiceAdminError(status_code, public_detail, internal_code)` | rename `VoiceAdminError` | — |

**Shared-library import (new capability).** `POST /v1/voices/add/{public_user_id}/{voice_id}` with body `{new_name, bookmarked}` returns `{voice_id}` [verified: https://elevenlabs.io/docs/api-reference/voices/voice-library/share.md]. This would let root curate community voices into the workspace. MiniMax had no equivalent.

**Routes.**

| File:line | Item | Action |
|---|---|---|
| `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:28-36` | `VoiceAdminService` Protocol (design/test/upload/clone/list/delete) | keep the seam; reshape the methods for two-step design and multipart clone |
| `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:39` | prefix `/admin/voices` | keep |
| `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:42-48` | `require_root_user` | keep |
| `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:51-68` | reads `app.state.minimax_voice_admin_config` / `minimax_voice_admin_service` | rename |
| `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:75-88` | `POST /design` (summary at 78 names MiniMax) | replace with `POST /design` (previews) plus `POST /design/save` |
| `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:91-104` | `POST /test` (94) | replace |
| `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:107-147` | `POST /clone-file` (110) | delete or merge into `/clone` multipart |
| `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:150-163` | `POST /clone` (153) | replace with multipart IVC |
| `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:166-179` | `GET` list (169) | replace (paginated `/v2/voices`) |
| `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:182-196` | `DELETE /{voice_type}/{voice_id}` (185) | `DELETE /{voice_id}` |
| `/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:14` | imports `MiniMaxVoiceAdminError` | rename |
| `/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:20` | `PREVIEW_TEXT_LIMIT=400` | keep |
| `/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:23-42` | `VoicePresetPreviewPayload` with MiniMax ranges | replace with EL settings |
| `/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:62-151` | preset CRUD | keep the routes; change payloads |
| `/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:87-96` | `/system-voices` (docstring 92 says MiniMax system voices) | `/v2/voices?category=premade` plus curated workspace voices |
| `/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:99-118` | `/preview` is **unmetered** | EL bills per character. Add metering or a rate limit (cost exposure) |
| `/home/andres/PycharmProjects/magic-worlds-api/src/routes/tts.py:26-37` | `_FORBIDDEN_TTS_V1_CLIENT_FIELDS` (dead code) | delete |
| `/home/andres/PycharmProjects/magic-worlds-api/src/routes/tts.py:62`, `:143` | status endpoints | keep |
| `/home/andres/PycharmProjects/magic-worlds-api/src/routes/tts.py:103-140` | asset route (`.mp3` only, `audio/mpeg`, `FileResponse`) | keep while the output stays MP3 |
| `/home/andres/PycharmProjects/magic-worlds-api/src/routes/__init__.py:7,18,22,35,53,61` | router registration | keep |

### 2.4 Storage contract (hex)

File: `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/storage.py`

| Line(s) | Item | Action |
|---|---|---|
| 19–49 | `StoredTtsAudio` (`local_fs`, `.mp3`, `audio/mpeg`) | keep |
| 52–70 | `AudioStorage` Protocol: `save_provider_audio(hex_payload=…)` | change to `audio_bytes: bytes` |
| 82–129 | `LocalTtsStorage.save_provider_audio`; hex decode (191–221); atomic fsync write (224–238); path `YYYY/MM/{job_id}/{asset_id}.mp3` | drop the hex decode; keep the atomic write |
| 152–160 | storage probe | keep |

### 2.5 Seams: what exists vs what is missing

| Seam | Status | Location | Gap for ElevenLabs |
|---|---|---|---|
| `TtsProvider` Protocol | exists | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:114-119` | lives in the MiniMax module; its data types carry hex and 32 kHz |
| `StreamingTtsClient` Protocol + factory | exists | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:87-105`, `:698-701` | the factory is single-provider; `VoiceAudioChunk` is hex/32 kHz |
| `AudioStorage` Protocol | exists | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/storage.py:52-70` | `hex_payload` parameter |
| `VoiceAdminService` Protocol | exists | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:28-36` | method shapes mirror MiniMax (single-step design, file upload + clone) |
| Provider-neutral voice recipe | **missing** | `ResolvedVoice` `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:35-68` | MiniMax ranges hard-coded |
| Provider/model registry | **missing** (a single locked model) | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:21-32`, `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:88-92` | needs a multi-model registry (narration vs call models) |
| Provider-neutral error classifier | **missing** | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:15-25`, `:396-421`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:803-825`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:576-608` | three separate MiniMax code tables |
| Provider-neutral admin DTOs | **missing** | `/home/andres/PycharmProjects/magic-worlds-api/src/models/admin_voice.py` | `AdminVoiceBaseResponse`, groups, hex fields |
| Neutral `app.state` names | **missing** | `/home/andres/PycharmProjects/magic-worlds-api/src/main.py:920-949` | `minimax_tts_provider`, `minimax_voice_admin_*` |
| Readiness check by Protocol | **missing** | `/home/andres/PycharmProjects/magic-worlds-api/src/main.py:1483` | `isinstance(provider, MiniMaxT2AProvider)` |

---

## 3. Data model (DDL, enums, embedded JSON)

### 3.1 DDL

File: `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql`

| Line(s) | Table.column / constraint | Current | Action |
|---|---|---|---|
| 250–299 | `voice_session` | — | — |
| 261 | `voice_session.stt_provider` | default `'groq'` | out of scope |
| 263 | `voice_session.tts_provider` | `varchar(32) default 'minimax_streaming'` | migrate the default; keep legacy rows |
| 265 | `voice_session.sample_rate` | default 16000 (STT upload rate) | not TTS; keep |
| 301–330 (318) | `voice_transcript_segment.tts_summary` JSON | contains raw `voice_id`, provider info | legacy rows keep MiniMax data; new rows EL |
| 546–595 | `theme_song_job` | — | — |
| 558 | `theme_song_job.provider` | default `'minimax'` (stale; fal is active) | migrate the default to `'fal'` |
| 582 | `theme_song_job` CHECK | `provider in ('minimax','fal')` | narrow after verifying no legacy rows remain (cutover precedent) |
| 597–622 | `theme_song_asset` | content_type enum `audio/mpeg`, mp3 | keep |
| 624–698 | `tts_job` | — | — |
| 635, 637 | source enum, status enum | — | keep (`call_character_tts` source etc.) |
| 638 | `tts_job.model_alias` | `varchar(128)` (no DDL enum) | no DDL change; Python literals change |
| 639 | `tts_job.provider` | default `'minimax'` | default `'elevenlabs'` |
| 641 | `tts_job.voice_id_hash` | hash of the recipe signature | semantic change (new signature fields) |
| 649 | `tts_job.provider_trace_id_hash` | hash of the MiniMax `trace_id` | hash of the EL `request-id` |
| **670** | `tts_job` CHECK | `... and provider = 'minimax'` | widen to `IN ('minimax','elevenlabs')` (keep legacy rows) |
| 694 | `idx_tts_job_reuse` | reuse index | keep |
| 700–719 | `tts_asset` | `storage_backend` enum `local_fs` (704); varchar `content_type` / `output_format`; `provider_url_hash` (713) | keep. `provider_url_hash` semantics change (it was sha256 of the hex string) |
| 916–942 | `membership_plan_limit` seeds: `tts_generation` free 20,1,1 (923), `voice_call` free 50,1,1 (925); plus (931, 933); pro (939, 941) | app units | keep. Re-price against EL per-character cost (section 6.5) |
| 84 | `adventure_session.template_snapshot` JSON | contains character `voice` and `narrator_voice` recipes | data migration |
| 150 | `adventure_message.metadata` JSON | may carry voice/TTS metadata | audit |
| 1004, 1029, 1054 | `tb_card_body.props`, `tb_card_version.props`, `tb_card_draft.props` JSON | character `props.voice` (MiniMax recipe) | data migration |
| 1276–1309 | `voice_preset` (comment at 1276–1278 says MiniMax): `base_voice_id` (1287), `base_voice_name` (1288), `speed` (1289), `volume` (1290), `pitch` (1291), `emotion` (1292), `language_boost` default `'auto'` (1293), `is_global` (1294), `metadata` JSON (1295) | MiniMax recipe columns | add EL columns (`model_id`, `stability`, `similarity_boost`, `style`, `use_speaker_boost`, `language_code`), or store them in `metadata` |
| last lines | `content_schema_revision` = `'2026_10_image_profiles'` | — | bump (e.g. `2026_1x_elevenlabs_voice`) |

### 3.2 Python row validators that duplicate DDL semantics

File: `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py`

| Line(s) | Item | Action |
|---|---|---|
| 300–301 | TTS statuses | keep |
| 395–408 | `_safe_tts_storage_path` (`.mp3`) | keep |
| 653–679 | `_required_asset_parent_job(provider=…)` | accept the new provider |
| 723–754 (749) | row normalizers; `tts_asset` must be `mp3`/`audio/mpeg` | keep while MP3 |
| 5195–5215, 5332–5352 (**5346**) | `voice_session` row validation requires `tts_provider == "minimax_streaming"`, `groq`, `whisper-large-v3`, pcm encoding, 16 kHz | accept `{legacy, new}` |
| 5774–5850 (5801, 5845) | `VoiceSessionModel.create` defaults and check | write the new provider |
| 7654 | `theme_song_job.provider` allowed `{"minimax","fal"}` | narrow later |
| 8424–8540 (**8501**) | `TtsJobModel.create_pending_job` allowed `{"minimax"}` | allow `elevenlabs` |
| 8650–8700 | `find_reusable_chat_job` filters by provider | keep (prevents cross-provider reuse) |
| 8934–9034 (**8994**) | `TtsAssetModel.create_asset`: mp3 only; parent provider must be `"minimax"` | allow `elevenlabs` |
| 14858–15076 (14862, 14863) | `VoicePresetModel`: `_EMOTIONS`, `_WRITE_FIELDS` (excludes `metadata`), MiniMax ranges, `_from_row` | replace the ranges; add EL fields |

Other files:

| File:line | Item | Action |
|---|---|---|
| `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/conversation_turn_store.py:388-397` (395), `:597-606` (604) | callbot metadata `voice.tts_provider` must equal `'minimax_streaming'` | accept `{legacy, new}` |
| `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/card_body.py:44` | `"voice"` in character `CARD_PROPS` | keep the key; the value schema changes |
| `/home/andres/PycharmProjects/magic-worlds-api/src/services/conversation_execution.py:171` | copies voice metadata | keep |

### 3.3 Schema parity and migration precedent

**How parity is enforced.**
- `bootstrap.py` declares `CONTENT_SCHEMA_REVISION` (`/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py:17`).
- It seeds plan limits (24–49).
- `TableContract` includes CHECK constraints (97–101), and they are compared against the live DB (1510–1540).
- Revision guidance and the upgrade chain are at 1691–1719, and reference e.g. `scripts/migrations/20261012_image_profiles.py`.
- An app with a changed `db.sql` and no migration refuses to start.

**Precedents:**
- `20260920_theme_song_fal.sql` widened `theme_song_job` provider to `IN ('minimax','fal')` (`/home/andres/PycharmProjects/magic-worlds-api/docs/database.md:203-215`). This is the template for widening `tts_job`.
  - *Verification note:* that SQL file is **not present** in the repo. `git ls-files` lists only `scripts/migrations/20261009_llm_profiles.py`, `20261010_interrupted_turns.py`, `20261011_unified_assistants.py` and `20261012_image_profiles.py`, plus an untracked `20261012_resource_tasks.py` on disk.
  - It is still named in the upgrade chain at `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py:1701`, `:1703`.
  - Use the docs text and the current `.py` migrations as the template.
  - The upgrade chain appends `20261012_image_profiles.py` as the last step at `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py:1709`. Any EL migration must be appended there.
- `theme_song_cutover.py` (`/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/theme_song_cutover.py:1-27`) is a reviewed deletion of retired direct-MiniMax theme songs, called from `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/llm_profile_migration.py:102-109`. This is the template for any TTS cutover that deletes legacy rows instead of keeping them.

**Recommended migration shape.**
1. Widen the CHECK constraints and validators to accept both providers.
2. Change the defaults.
3. Add the voice-ID mapping and rewrite JSON recipes (cards, drafts, versions, snapshots, presets) in a reviewed script.
4. Bump the revision.

Keep legacy `tts_job`/`tts_asset` rows playable, since they are just MP3 files on local disk.

### 3.4 Enum and literal inventory

| Literal | Where | Kind |
|---|---|---|
| `'minimax'` | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:639` (default), `:670` (CHECK); `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:8501`, `:8994`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:2407`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:24` (`TtsRegistryModel.provider: Literal["minimax"]`, added during verification); `/home/andres/PycharmProjects/magic-worlds-api/tests/fakes/tts.py:84` | provider |
| `'minimax_streaming'` | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:263`; `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:5346`, `:5801`, `:5845`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/callbot_execution.py:124`; `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/conversation_turn_store.py:395`, `:604`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:91-94`, `:153-156`; `/home/andres/PycharmProjects/magic-worlds-api/tests/fakes/voice.py:119-190`; `/home/andres/PycharmProjects/magic-worlds-api/tests/fakes/voice_runtime.py:396` | streaming provider |
| `'speech_2_8_turbo'` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:26`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:21-32`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py:980`, `:997`; `/home/andres/PycharmProjects/magic-worlds-api/src/models/tts.py:61`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_tts_delivery.py:536`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:2406-2415`; `/home/andres/PycharmProjects/magic-worlds-api/tests/fakes/tts.py:364`, `:387` | model alias |
| `'speech-2.8-turbo'` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:27`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:20-47` (`DEFAULT_MINIMAX_STREAMING_MODEL`); `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:63-69` (`VOICE_TEST_MODEL`); `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:2406-2415` | provider model ID |
| `32000` / `32_000` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:28-56`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:21-32`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:20-47` (`MINIMAX_SAMPLE_RATE`), `:50-84`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/delivery.py:159`, `:349` (default param, added during verification), `:352`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:2394`, `:2329` (MP3 parser rate table, legitimate); `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:615-641`; `/home/andres/PycharmProjects/magic-worlds-api/src/models/admin_voice.py:53` | sample rate |
| `'hex'` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:21-32` (`output_format`); `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:615-641` | encoding |
| emotions `happy, sad, angry, fearful, disgusted, surprised, calm` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:18`; `/home/andres/PycharmProjects/magic-worlds-api/src/models/admin_voice.py:28-38`; `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:14862`; `/home/andres/PycharmProjects/magic-worlds-api/src/models/character.py:11-42`; `/home/andres/PycharmProjects/magic-worlds-api/src/models/voice_preset.py:8-37` | MiniMax emotion enum |
| `language_boost` `'auto'` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:21-32`, `:35-68`; `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:1293`; `/home/andres/PycharmProjects/magic-worlds-api/src/models/voice_preset.py:8-37`; `/home/andres/PycharmProjects/magic-worlds-api/src/models/character.py:11-42`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:727-754` | MiniMax language hint |
| `'minimax_music_3'` | `/home/andres/PycharmProjects/magic-worlds-api/src/models/theme_song.py:36-37`, `:172`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/config.py:23-24`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/registry.py:33-37`, `:83-95`; `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/runtime/theme_song_prompt_minimax_music_3.v2.json`; `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/builtin_agents.v1.json:35`, `:55` | fal theme-song alias |
| `'minimax/music-3'` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/registry.py:30` | fal endpoint |

---

## 4. Pydantic models

### 4.1 `/home/andres/PycharmProjects/magic-worlds-api/src/models/admin_voice.py` (wholly MiniMax-shaped)

| Line(s) | Model / constant | MiniMax semantic | Action |
|---|---|---|---|
| 10–25 | query / concrete / delete voice types (enum values `system`, `voice_cloning`, `voice_generation`, `all`; corrected during verification, since the app value is `system`, and `system_voice` is only the MiniMax response group key at `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:89-93`) | `get_voice` `voice_type` | replace with EL `category` / `voice_type` filters |
| 28–38 | `AdminVoiceEmotion` | MiniMax emotion enum | delete (v3/v4 audio tags are text, not a parameter) |
| 40–45 | audio format `mp3`/`flac`/`wav` | — | replace with an EL `output_format` subset |
| 47–49 | clone file purpose | `files/upload` purpose | delete |
| 53 | `SUPPORTED_SAMPLE_RATES` {8000, 16000, 22050, 24000, 32000, 44100} | MiniMax | replace with EL format strings |
| 57 | `_VOICE_ID_PATTERN` (MiniMax custom-ID rule) | caller-chosen IDs | delete (EL assigns IDs) |
| 60–64 | `AdminVoiceBaseResponse(status_code, status_msg)` embedded in every response | `base_resp` | delete |
| 67–84 | design request: prompt ≤2000, preview_text ≤500, voice_id ≤128 | — | EL: `voice_description`, `text` 100–1000 or `auto_generate_text`, `model_id`, `loudness`, `seed`, `guidance_scale`, `should_enhance` [verified: https://elevenlabs.io/docs/api-reference/text-to-voice/design] |
| 87 | design response, `trial_audio` hex | — | `previews[]` of base64 audio + `generated_voice_id` |
| 95–130 | test request: model, speed, vol, pitch, emotion, audio_format, sample_rate, language_boost | — | `model_id`, `voice_settings`, `output_format`, `language_code` |
| 133–145 | test response `audio_hex` | — | bytes / base64 |
| 148–172 | entry, groups, list | — | `voice_id`, `name`, `category`, `labels`, `preview_url`, `verified_languages` [verified: https://elevenlabs.io/docs/api-reference/voices/search] |
| 175 | delete response | — | `{status}` |
| 184 | clone file response, `file_id: int` | — | delete |
| 196 | clone prompt | — | delete |
| 213–253 | clone request | — | multipart: `name`, `files`, `remove_background_noise`, `description`, `labels` |
| 256 | clone response | — | `{voice_id, requires_verification}` |

### 4.2 Voice presets and character voice

| File:line | Model | Fields (MiniMax) | Action |
|---|---|---|---|
| `/home/andres/PycharmProjects/magic-worlds-api/src/models/voice_preset.py:8-37` (docstring 9 names MiniMax) | create payload | `base_voice_id`, `base_voice_name`, speed 0.5–2, volume (0,10], pitch -12..12, emotion, `language_boost="auto"` | replace with an EL recipe |
| `/home/andres/PycharmProjects/magic-worlds-api/src/models/voice_preset.py:40-78` | update payload | same | replace |
| `/home/andres/PycharmProjects/magic-worlds-api/src/models/character.py:11-42` (docstring 15 names MiniMax defaults) | `CharacterVoice` (`extra=forbid`, strict): voice_id ≤256, speed, vol, pitch, emotion, language_boost ≤64, preset_id, preset_name | — | replace. **Strict `extra=forbid` means old JSON with `vol`/`pitch` fails validation once the fields are removed.** Migrate the data first, or keep the deprecated fields optional and ignored |
| `/home/andres/PycharmProjects/magic-worlds-api/src/models/character.py:62` | `Character.voice` | — | keep |
| `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_adventure_session.py:92`, `:120` | `AdventureSnapshotEnvelope.narrator_voice`, `UpdateTemplateSnapshotRequest.narrator_voice: Optional[CharacterVoice]` | — | follows `CharacterVoice` |
| `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_adventure_session.py:1661-1670` | validates via `build_resolved_voice` | — | follows |

### 4.3 TTS and task DTOs

| File:line | Item | Action |
|---|---|---|
| `/home/andres/PycharmProjects/magic-worlds-api/src/models/tts.py:46-52` | `TtsAssetPublic`: `content_type Literal["audio/mpeg"]`; `sample_rate` 8k–48k; `bitrate` 32k–320k; `output_format Literal["mp3"]` | keep (EL MP3 fits these ranges) |
| `/home/andres/PycharmProjects/magic-worlds-api/src/models/tts.py:61` | `TtsJobPublic.model_alias: Literal["speech_2_8_turbo"]` | widen to a `Literal` union of legacy + EL aliases, or `str` with a registry check |
| `/home/andres/PycharmProjects/magic-worlds-api/src/models/task.py:15`, `:37`, `:98` | `task_from_tts_job` | keep; verify with new aliases |
| `/home/andres/PycharmProjects/magic-worlds-api/src/services/media_tasks.py:7-17` | projects TTS jobs into `/tasks` via `tts_job_public_from_row` | **regression risk**: one unexpected alias crashes the whole task list |
| `/home/andres/PycharmProjects/magic-worlds-api/src/models/theme_song.py:36-37`, `:172` | theme alias literals; default `"minimax_music_3"` | section 7 decision |

### 4.4 Recipe field mapping: MiniMax to ElevenLabs

| MiniMax field (range) | ElevenLabs field (range/default) | Mapping note |
|---|---|---|
| `voice_id` (MiniMax system/custom ID) | `voice_id` (path parameter) | no 1:1 mapping; needs a curated table |
| `speed` 0.5–2.0 | `voice_settings.speed` default 1; WS range 0.7–1.2 [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input] | clamp to 0.7–1.2. The HTTP range is assumed the same [unverified] |
| `vol` (0,10] | none for TTS. Voice design has `loudness` -1..1 [verified: https://elevenlabs.io/docs/api-reference/text-to-voice/design] | drop. Thought dimming needs post-processing gain or a different technique |
| `pitch` -12..12 | none | drop (or choose a different voice) |
| `emotion` (7 values) | v3/v4 audio tags in text (`[whispers]`, `[sighs]`, `[excited]`, `[sarcastic]`, `[crying]`, `[laughs]`) [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices]; `style` 0–1 (exaggeration) | emotion becomes a prompt/text concern for v3/v4; `style` for v2 models |
| `language_boost` ("auto", language names) | `language_code` (ISO 639-1) | convert names to codes. Not all models accept `language_code` [unverified] |
| — | `stability` (0.5), `similarity_boost` (0.75), `use_speaker_boost` (true) | new fields; expose as advanced preset knobs |
| — | `model_id` | new: per-recipe or global |
| — | `seed` | new: deterministic regeneration; include in the reuse signature |
| — | `pronunciation_dictionary_locators` (at most 3) | new: lorebook names and fantasy terms (improvement) |

---

## 5. Text conventions

| Convention | Location | MiniMax meaning | ElevenLabs equivalent |
|---|---|---|---|
| Pause markers `<#0.5#>` | prompt `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/runtime/callbot_chat.v2.json:32`; sanitizer pattern `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/transcript_sanitizer.py:47-51` ("the sole angle-bracket markup allowed"); exemption in `_contains_unspeakable_structure` 116–123; kept by `normalize_text_for_tts` 170–228 | MiniMax inline pause syntax | `<break time="0.5s" />` (at most 3 s) for v2/Flash models; **not supported on v3/v4** [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices]. On WS it may require `enable_ssml_parsing=true` [verified param exists: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input; necessity unverified]. `<break …/>` would be rejected by the current tag guard `_SPEECH_MARKUP_TAG_PATTERN` |
| Interjections `(laughs)`, `(sighs)` | prompt line 32; sanitizer keeps parentheticals; `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/sentence_buffer.py:23-36`, `:126-132` never split inside `<#…#>` or `(…)` | MiniMax reads them as cues | v3/v4 audio tags use square brackets `[laughs]` [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices]. On Flash/v2, `(laughs)` would be spoken literally or dropped [unverified]. Square brackets pass the current sanitizer tag regex; the sentence buffer must also not split inside `[…]` |
| Interjection gating | `CALLBOT_INTERJECTIONS_ENABLED` (`/home/andres/PycharmProjects/magic-worlds-api/.env.example:221-226`); `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:114-120`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/system_prompts.py:155-159`, `:668-681`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/callbot_execution.py:54-60`, `:122` | prompt section toggled | keep the toggle. The section text must match the model family (tags for v3/v4, none or `<break>` for Flash) |
| Text normalization `"basic"` | `MINIMAX_TEXT_NORMALIZATION_MODE` streaming constants (20–47), sent in `_task_start_payload` (727–754) | MiniMax normalizes numbers | `apply_text_normalization` `auto`/`on`/`off` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert]. The models page says Flash v2.5 normalization is off by default and only Enterprise can turn it on [verified: https://elevenlabs.io/docs/overview/models]. The best-practices page says normalization is enabled by default (conflict). The prompt's "spell out numbers" instruction therefore becomes load-bearing for Flash |
| Sanitizer digit handling | `normalize_text_for_tts` 170–228 keeps digits (relies on MiniMax normalization); false-positive handling 282–293 | — | add digit-to-words, or rely on the prompt for Flash |
| Narration text normalization | `normalize_tts_text` `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:248-261` | — | review for v3 tags (do not strip `[…]`) |
| Phonemes | not used | — | phoneme tags only on `eleven_flash_v2`; v4 understands IPA in slashes [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices]. Pronunciation dictionaries are the better route |
| Graph hash | `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/builtin_agents.v1.json:20` (maps `callbot_chat`), `:40` (sha256 `ed7950766e…`); `/home/andres/PycharmProjects/magic-worlds-api/src/services/builtin_agent_graphs.py:79` (`callbot_chat` marker set), `:175` (symbolic key set), `:234` (`chat_workflow` key set). Corrected during verification: `:36-40` and `:108` of that file belong to the `theme_song_prompt_minimax_music_3` graph, not callbot (see section 11.8). Graph version `mw-callbot-chat-v2` (`/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/runtime/callbot_chat.v2.json:3`) | — | any prompt edit means a new graph version (v3), a regenerated hash, and updated tests (`tests/agent_graphs/test_builtin_agent_registry.py`, `tests/services/test_system_prompts.py`) |

---

## 6. Error mapping, retries, billing/quota and observability

### 6.1 MiniMax code tables in use

| Table | Location | Codes |
|---|---|---|
| T2A retryable | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:17` | 1000, 1001, 1002, 1024, 1033, 1039, 2045, 2056 |
| T2A rate limit | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:19` | 1002, 1039, 2045, 2056 |
| T2A content blocked | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:20` | 1026, 1027 |
| T2A invalid input | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:21` | 1042 |
| T2A unavailable | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:22` | 1004, 1008, 2013, 20132, 2042, 2049 |
| Admin 429 mapping | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:576-608` | 1002, 1039, 2045, 2056 |
| Admin clone detail | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:79-87` | 2037, 2039, 2042, 2048, 1043, 1044, 1008 |
| Streaming | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:20-47`, `:803-825` | rate/timeout/unavailable sets; rate limits map to `tts_unavailable` |

### 6.2 ElevenLabs error model

Error body [verified: https://elevenlabs.io/docs/developers/resources/errors]:
`{"detail": {"type", "code", "message", "status" (legacy), "request_id", "param"}}`

Validation errors (422) return `detail[]` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert].

| HTTP | `detail.type` | Example `detail.code` | App category (`TtsErrorCategory`) | Retry? |
|---|---|---|---|---|
| 400 | `validation_error` / `invalid_request` | `text_too_long`, `invalid_voice_settings`, `invalid_voice_id`, `unsupported_model`, `invalid_output_format` | `invalid_input` | no |
| 401 | `authentication_error` | — | `unavailable` (config) | no; alert |
| 402 | `payment_required` | `insufficient_credits` | `unavailable` (provider quota) | no; alert |
| 403 | `authorization_error` | (key scope / IP allowlist) | `unavailable` | no; alert |
| 404 | `not_found` | `voice_not_found` | `invalid_input` (stale voice ID) | no; consider falling back to the default voice |
| 409 | `conflict` | — | `invalid_input` | no |
| 422 | validation (`detail[]`) | — | `invalid_input` | no |
| 429 | `rate_limit_error` | `rate_limit_exceeded`, `concurrent_limit_exceeded`, `system_busy` | `rate_limited` | yes, exponential backoff |
| 500 | `internal_error` | — | `unavailable` | yes |
| 503 | `service_unavailable` | `maintenance` | `unavailable` | yes |

There is no documented "content blocked" type equivalent to MiniMax 1026/1027 [unverified]. Keep the category, but expect it to be unused.

### 6.3 Retries

- **Narration HTTP.** `TTS_PROVIDER_MAX_ATTEMPTS=2` (ceiling 2) with a tiny backoff of 0.01–0.05 s (`/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:23-25`). For `concurrent_limit_exceeded`, a sub-100 ms backoff is too short. Raise it to a jittered 0.5–2 s, still within `TTS_TIMEOUT_SECONDS` [unverified tuning].
- **Streaming.** Retries are not appropriate mid-turn. On `close_context` / error, drop the turn (current behavior) and reconnect the socket for the next turn.
- **Admin.** No retry (current behavior).

### 6.4 Concurrency

- `TTS_GLOBAL_CONCURRENCY` defaults to 3 (`/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:28-37`).
- `VOICE_GLOBAL_CONCURRENCY` defaults to 8 (`/home/andres/PycharmProjects/magic-worlds-api/.env.example:505`).
- EL concurrency is per plan, Multilingual / Flash [verified: https://elevenlabs.io/docs/overview/models]:

| Plan | Multilingual | Flash |
|---|---|---|
| Free | 2 | 4 |
| Starter | 3 | 6 |
| Creator | 5 | 10 |
| Pro | 10 | 20 |
| Scale / Business | 15 | 30 |

- Narration and calls share the account pool, so the sum of both semaphores must not exceed the plan limit for the chosen models.
- Multi-context WS allows at most 5 concurrent contexts per connection [verified: https://elevenlabs.io/docs/developers/guides/cookbooks/multi-context-web-socket].

### 6.5 Billing and quota

- **App units are provider-neutral.**
  - `reserve_media_operation(operation="tts_generation")` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py:318-323`).
  - Quota is enforced only for segment 0 (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:1433`).
  - Reuse happens before quota (`/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py:227-240` then `:257-258`).
  - Voice calls bill audio seconds (`VOICE_CALL_SECONDS_PER_CREDIT=10`, `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:58-66`) using `_mp3_duration_ms` per sentence (`:1587`) and `_record_billable_audio` (`:1937`).
- **Provider cost model changes.** EL bills per character [verified: https://elevenlabs.io/pricing/api]. Prices per 1K characters:

  | Model | Price per 1K characters |
  |---|---|
  | v4 | $0.022, a promotion ending 2026-10-12 (normally $0.08) |
  | v4 Turbo | $0.011 (normally $0.04) |
  | v3 | $0.08 |
  | v3 Conversational | $0.04 |
  | Multilingual v2 | $0.08 |
  | Flash/Turbo | $0.04 |

  The v4 promo date is today. Assume normal pricing for planning.
- **Cost observability.** Record the `character-cost` response header [verified: https://elevenlabs.io/docs/api-reference/introduction.md] per job, as an integer column or in `input_summary`. That enables per-user cost dashboards. Today nothing records provider cost.
- **Unmetered preview.** `/voice-presets/preview` (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:99-118`) costs EL characters (400 chars max per call). Add a per-user rate limit.
- **Duration-based billing with EL chunks.** The MP3 frame parser handles 44.1 kHz and 22.05 kHz. However, EL WebSocket chunk boundaries are not guaranteed to be MP3-frame-aligned [unverified], so per-chunk parsing could under-count. Parse per sentence, by concatenating the chunks, or use `alignment` timing data when `sync_alignment` is enabled.

### 6.6 Observability and redaction

| File:line | Item | Action |
|---|---|---|
| `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/errors.py:58-69` | `_SECRET_PATTERNS`: `Bearer`, `gsk_`, `sk-` (hyphen, 16+ chars), `(GROQ\|MINIMAX\|…)_KEY=`, `(https\|wss)://api.(groq\|minimax).…`, hex ≥64, `provider_trace`, `trace/request id` | add `ELEVENLABS` to the key-name group; `xi-api-key\s*[:=]`; `\bsk_[A-Za-z0-9]{20,}\b` (EL key shape [secondary]); `api(\.[a-z]+)*\.elevenlabs\.io` and `wss://…elevenlabs.io`; base64 MP3 (`SUQz`/`//uQ`/`//NE` prefixes) |
| `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/transcript_sanitizer.py:17`, `:19` | provider URL and key patterns | add EL |
| `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/observability.py:39-55` | forbidden markers (hex, voice_id, …) | add base64 audio, `context_id` (safe), `request-id` |
| `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/errors.py:11`, `:57-63`, `:210-234` (225–229: `minimax_api_key`, `trace`, `voice`, `audio_hex`, `hex_audio`) | sensitive patterns and safe code | rename/add |
| `/home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/errors.py:28-30`, `:45`, `:56` | MiniMax redaction patterns in image errors | rename to a shared redaction helper |
| `/home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/config.py:27-29` | comment about shared MiniMax settings | update |
| `/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_tts_delivery.py:28-49`, `:776` | `_PRIVATE_TEXT_MARKERS` includes `"minimax"` and `"bearer "` as **substrings**, so a speaker named "Minimaxine" or text containing "minimax" is wrongly blocked | do not add `"elevenlabs"` as a substring marker; use regexes for secrets |
| `/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_image_delivery.py:23-41` | markers include `minimax`, `minimax_api_key` | same |
| `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/errors.py:110`, `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/engine.py:1227` | markers | keep if the fal minimax alias stays |
| Trace IDs | `provider_trace_id_hash` (engine.py:605, :683) from the MiniMax `trace_id` | hash the EL `request-id`. Note that `previous_request_ids` needs the **raw** request ID of a prior segment, kept in memory within a message, not persisted |

**Privacy improvement.** `enable_logging=false` gives zero-retention mode on Enterprise [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert]. That aligns with the "no raw-audio retention" consent copy.

---

## 7. Theme songs

Theme songs run through fal.ai, not the MiniMax Open Platform. Removing the MiniMax Audio integration does not require touching them. The user request to "remove the minimax support" may still extend to the fal `minimax/music-3` model, so the inventory is listed here.

| File:line | Item |
|---|---|
| `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/registry.py:27` | `THEME_SONG_PROVIDER="fal"` |
| `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/registry.py:30` | `MINIMAX_MUSIC_3_ENDPOINT="minimax/music-3"` |
| `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/registry.py:33-37`, `:40-55`, `:83-95` | identities and model entry: max 300 s, style 1500, lyrics 3000, `num_inference_steps` 30, `guidance_scale` 1.7 |
| `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/config.py:23`, `:24`, `:33-35` | default alias `minimax_music_3`; selectable aliases; comment |
| `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/fal_adapter.py:1-8`, `:136-146`, `:221-245` | module doc; `FAL_KEY`; minimax returns a duration |
| `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/prompt_agent.py:1-10`, `:42-52`, `:102`, `:471`, `:532` | per-model writer graph selection |
| `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/transcode.py:1-8` | WAV to MP3 via `lameenc`. **Reusable** if EL PCM output is ever chosen |
| `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/runtime/theme_song_prompt_minimax_music_3.v2.json` | writer graph |
| `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/builtin_agents.v1.json:35`, `:55` | registry entry and hash |
| `/home/andres/PycharmProjects/magic-worlds-api/src/models/theme_song.py:36-37`, `:172` | alias literals, default |
| `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:558`, `:582`; `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:7654` | provider default `'minimax'` (stale) and check |
| `/home/andres/PycharmProjects/magic-worlds-api/.env.example:335-356` | theme-song section (`THEME_SONG_DEFAULT_MODEL_ALIAS=minimax_music_3` at 340) |
| `/home/andres/PycharmProjects/magic-worlds-api/docs/api_usage/theme_songs.md:10-52`, `:101`, `:138` | docs |

**Options:**
- **(a) Keep it.** It is a fal-hosted model with no MiniMax credential.
- **(b) Switch the default** to `ace_step` and later retire `minimax_music_3` via a reviewed cutover (precedent: `theme_song_cutover.py`).
- **(c) Add ElevenLabs Music** as a third alias. `POST /v1/music` takes a `prompt` or `composition_plan`, `music_length_ms` 3000–600000, `model_id` (`music_v1`/`music_v2`/`music_v2_5`), `force_instrumental` and `output_format` [verified: https://elevenlabs.io/docs/api-reference/music/compose]. That needs a new provider value (`'elevenlabs'`) in the `theme_song_job` CHECK and a writer graph that emits a composition plan.

---

## 8. Tests and fakes

**Totals:** 814 literal MiniMax mentions across 68 test files, plus at least 41 MiniMax-semantic references in 6 files that never use the word. The counts below are `grep -ci minimax` per file. The "tests" column is the `def test_` count where it was measured.

### 8.1 MiniMax-specific test files (replace wholesale)

| File | MiniMax refs | Tests | Notes |
|---|---|---|---|
| `/home/andres/PycharmProjects/magic-worlds-api/tests/voice/test_minimax_streaming_tts.py` | 182 | 45 | WS protocol (`task_start`/`continue`/`finish`, hex, `is_final`); rewrite for multi-context |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_minimax_voice_admin.py` | 84 | 34 | design/list/delete/test/upload/clone with `base_resp` codes |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_tts_minimax_adapter.py` | 46 | 13 | `t2a_v2` envelope, `extra_info`, status 2 |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/voice/test_live_minimax_tts_contract.py` | 21 | 3 (live) | needs `RUN_VOICE_TTS_PROVIDER_CONTRACT_TESTS`, `MINIMAX_AUDIO_API_KEY`, `VOICE_MINIMAX_TTS_VOICE_ID`; asserts 32000 |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_tts_live_minimax_contract.py` | 6 | placeholder (skipped) | marker `live_minimax_provider` |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_minimax_credentials.py` | 12 | 3 | credential loader |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_tts_adapter_static_guard.py` | 5 | — | **requires the file `minimax_adapter.py` to exist** and confines the base URL to config + adapter. Must be rewritten in the same change as the adapter rename |

### 8.2 Tests with MiniMax config, literals or assertions (update)

| File | MiniMax refs | Tests / notes |
|---|---|---|
| `/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_theme_song_prompt_agent.py` | 22 | theme songs (section 7 decision) |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/test_config_hygiene.py` | 16 | lines 65, 94, 211–224, 227–281 (env name hygiene) |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_tts_privacy.py` | 14 | redaction |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_tts_config.py` | 14 | 8 tests |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/conftest.py` | 13 | stale fixture 192–216; TTS fixtures 247–329 |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/fakes/tts.py` | 13 | see 8.3 |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/voice/test_voice_config_readiness.py` | 12 | 9 tests; issue-code strings |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/voice/test_voice_call_billing.py` | 12 | MP3 duration at 32 kHz |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_theme_song_registry.py` | 12 | theme |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/test_content_generation_readiness.py` | 12 | `app.state.minimax_*` (5) |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_theme_song_engine.py` | 11 | theme |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/routes/test_admin_voices.py` | 10 | 14 tests (corrected during verification from 13); `app.state.minimax_*` (5) |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_tts_engine.py` | 10 | — |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/voice/test_voice_privacy_sentinels.py` | 9 | — |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/routes/test_tts_routes.py` | 9 | — |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/fakes/voice.py` | 8 | see 8.3 |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/voice/test_voice_observability_privacy.py` | 8 | — |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/startup/test_startup.py` | 8 | — |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_theme_song_fal_adapter.py` | 8 | theme |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/routes/test_chat_tts_request_enqueue.py` | 7 | — |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/voice/test_voice_call_lifecycle.py` | 7 | — |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/voice/test_voice_delivery.py` | 6 | 32 kHz frame guard |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/voice/test_voice_engine_happy_path.py` | 6 | — |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/models/test_media_asset_ownership.py` | 6 | provider literal |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/voice/test_call_audio_persistence.py` | 5 | hard-coded identity at engine.py:2406–2415 |
| `tests/voice/test_groq_stt_client.py`, `test_voice_barge_in.py`, `test_voice_e2e_fake_turn.py`, `test_voice_route_admission.py` (all under `/home/andres/PycharmProjects/magic-worlds-api/tests/voice/`) | 4 each | — |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/voice/conftest.py` | 3 | lines 7, 24–25 |
| `tests/models/test_theme_song_models.py`, `tests/models/test_tts_models.py`, `tests/services/test_theme_song_adapter_static_guard.py`, `tests/services/test_theme_song_config.py` (under `/home/andres/PycharmProjects/magic-worlds-api/`) | 3 each | — |
| `tests/integration/test_system_writer_database.py`, `tests/integration/test_theme_song_cutover_database.py`, `tests/services/test_image_generation_engine.py`, `tests/services/test_tts_storage.py`, `tests/test_chat_tts_delivery.py`, `tests/test_health.py` (`app.state.minimax_*` ×2), `tests/test_runtime_config.py`, `tests/voice/test_live_groq_stt_contract.py`, `tests/voice/test_voice_quota_consent.py` (under `/home/andres/PycharmProjects/magic-worlds-api/`) | 2 each | — |
| `tests/agent_graphs/test_builtin_agent_registry.py`, `tests/fakes/theme_song.py`, `tests/fakes/voice_runtime.py`, `tests/integration/test_llm_profile_database.py`, `tests/models/test_conversation_terminal_transition.py`, `tests/models/test_media_job_summary_contract.py`, `tests/models/test_query_contract_limits.py`, `tests/models/test_schema_runtime_alignment.py`, `tests/models/test_tts_persistence_contract.py`, `tests/models/test_voice_session_model.py`, `tests/services/test_system_prompts.py`, `tests/services/test_theme_song_live_fal_contract.py`, `tests/services/test_tts_registry.py`, `tests/services/test_tts_reuse_query.py`, `tests/voice/test_callbot_reply_only.py`, `tests/voice/test_transcript_sanitizer.py`, `tests/voice/test_voice_schema_bootstrap.py` (under `/home/andres/PycharmProjects/magic-worlds-api/`) | 1 each | — |

**MiniMax semantics without the word "minimax":**

| File | Refs | What |
|---|---|---|
| `/home/andres/PycharmProjects/magic-worlds-api/tests/models/test_voice_preset_model.py` | 13 | speed/volume/pitch/emotion ranges |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_tts_voice_override.py` | 9 | recipe override into the payload |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/models/test_public_dto_strictness.py` | 7 | strict DTO literals |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/routes/test_voice_presets.py` | 7 | preset payloads |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/voice/test_sentence_buffer.py` | 3 | `<#…#>` / `(…)` non-split |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_voice_presets_data.py` | 2 | MiniMax voice ID `English_radiant_girl` round-trips through the card body |

### 8.3 Fakes and fixtures

| File:line | Item | Action |
|---|---|---|
| `/home/andres/PycharmProjects/magic-worlds-api/tests/fakes/tts.py:17` | imports `NormalizedTtsAudio`, `TtsProviderCompletion` from `minimax_adapter` | re-import from the neutral module |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/fakes/tts.py:84` | `provider_name="minimax"` | parameterize |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/fakes/tts.py:364`, `:387` | `speech_2_8_turbo` | EL alias |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/fakes/tts.py:379-386` | `fake_tts_config(minimax_api_key=…, minimax_base_url=…)` | rename |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/fakes/voice.py:10`, `:19`, `:22`, `:119-190` | imports `VoiceAudioChunk`; sentinels; `FakeMiniMaxStreamingTtsClient` (`provider_name` `"minimax_streaming"`) | rename `FakeStreamingTtsClient` |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/fakes/voice_runtime.py:396` | `'tts_provider': 'minimax_streaming'` | new value; keep a legacy fixture |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/conftest.py:192-216` | **stale**: `fake_theme_song_generation_stack` imports a non-existent `FakeMiniMaxThemeSongProvider` (the real class is `FakeFalThemeSongProvider`, `/home/andres/PycharmProjects/magic-worlds-api/tests/fakes/theme_song.py:54`) and sets `app.state.minimax_theme_song_provider` | delete (dead fixture) |
| `/home/andres/PycharmProjects/magic-worlds-api/tests/conftest.py:247-329` | TTS fixtures set the MINIMAX env and `app.state.minimax_tts_provider` | rename |
| `/home/andres/PycharmProjects/magic-worlds-api/pytest.ini:5`, `:11` | addopts excludes `live_minimax_provider`; the marker is declared | rename marker `live_tts_provider` |

**`app.state.minimax_*` usages:** `src/main.py` ×16, `src/routes/admin_voices.py` ×2, `src/services/minimax_voice_admin.py` ×2, `tests/conftest.py` ×1, `tests/routes/test_admin_voices.py` ×5, `tests/services/test_minimax_voice_admin.py` ×4, `tests/test_content_generation_readiness.py` ×5, `tests/test_health.py` ×2, `tests/voice/test_live_minimax_tts_contract.py` ×1.

---

## 9. Docs, READMEs, .env.example, compose, pytest.ini

| File:line | Content | Action |
|---|---|---|
| `/home/andres/PycharmProjects/magic-worlds-api/.env.example:221-226` | `CALLBOT_INTERJECTIONS_ENABLED` | rewrite for EL tags |
| `/home/andres/PycharmProjects/magic-worlds-api/.env.example:335-356` | theme songs, `minimax_music_3` | decision (section 7) |
| `/home/andres/PycharmProjects/magic-worlds-api/.env.example:383-405` | MINIMAX AUDIO section (`MINIMAX_BASE_URL`, `MINIMAX_AUDIO_API_KEY`, admin timeouts and limits) | replace with ELEVENLABS section |
| `/home/andres/PycharmProjects/magic-worlds-api/.env.example:407-459` | CHAT TTS (MiniMax T2A): 416 `TTS_ENGINE_ENABLED`; 422–423 MiniMax repeat; 424 `TTS_DEFAULT_VOICE_ID`; 426–428 locked contract text; 433–455 TTS_* | replace text; keep TTS_* |
| `/home/andres/PycharmProjects/magic-worlds-api/.env.example:461-525` | VOICE section: **477–480 consent must disclose "MiniMax streaming TTS"**; 492–497 `VOICE_TTS_PROVIDER` / `VOICE_MINIMAX_TTS_WS_URL` / `VOICE_MINIMAX_TTS_VOICE_ID` | replace + bump consent |
| `/home/andres/PycharmProjects/magic-worlds-api/.env.example:528-539` | live test flags `RUN_VOICE_TTS_PROVIDER_CONTRACT_TESTS` (531) | retarget |
| `/home/andres/PycharmProjects/magic-worlds-api/.env.example:645-653` | live MiniMax tests `RUN_MINIMAX_PROVIDER_CONTRACT_TESTS` (653) | rename |
| `/home/andres/PycharmProjects/magic-worlds-api/docker-compose.yml:95` | `CALLBOT_INTERJECTIONS_ENABLED` | keep |
| `/home/andres/PycharmProjects/magic-worlds-api/docker-compose.yml:124-129` | `MINIMAX_*` (125 base URL with default, 126 key, 127–129 admin) | replace |
| `/home/andres/PycharmProjects/magic-worlds-api/docker-compose.yml:131-142` | `TTS_*` | keep |
| `/home/andres/PycharmProjects/magic-worlds-api/docker-compose.yml:145-169` (153–155) | `VOICE_*`, `VOICE_MINIMAX_*` | replace 154–155 |
| `/home/andres/PycharmProjects/magic-worlds-api/docker-compose.yml:202`, `:241` | `tts_storage` volume | keep |
| `/home/andres/PycharmProjects/magic-worlds-api/pytest.ini:5`, `:11` | `live_minimax_provider` marker | rename |
| `/home/andres/PycharmProjects/magic-worlds-api/requirements.txt` | no MiniMax SDK | optional: add `elevenlabs` SDK (`AsyncElevenLabs`) [verified: https://github.com/elevenlabs/elevenlabs-python], or stay with `httpx` + `websockets` (recommended for parity with the strict adapters) |
| `/home/andres/PycharmProjects/magic-worlds-api/docs/README.md:22` | MiniMax mention | update |
| `/home/andres/PycharmProjects/magic-worlds-api/docs/architecture.md:19-20` | MiniMax in the architecture | update |
| `/home/andres/PycharmProjects/magic-worlds-api/docs/configuration.md:203-204`, `:209-215` | MiniMax env docs | update |
| `/home/andres/PycharmProjects/magic-worlds-api/docs/operations.md:101` | ops note | update |
| `/home/andres/PycharmProjects/magic-worlds-api/docs/database.md:149-157`, `:203-215` | retired theme-song cutover review (149-157, corrected during verification: these lines describe theme songs, not `tts_job` provider); theme-song migration precedent (203-215) | update + add the EL migration entry |
| `/home/andres/PycharmProjects/magic-worlds-api/docs/development.md:139`, `:149` | live test instructions | update |
| `/home/andres/PycharmProjects/magic-worlds-api/docs/api_usage/tts.md:4`, `:22`, `:27`, `:30`, `:78`, `:173`, `:178-200`, `:207`, `:238` | TTS API doc (model alias, provider, format) | update |
| `/home/andres/PycharmProjects/magic-worlds-api/docs/api_usage/voice.md:8`, `:14`, `:235`, `:256`, `:266` | "MiniMax streaming TTS", "recipes over MiniMax system voices", "supports MiniMax voice design…" | update |
| `/home/andres/PycharmProjects/magic-worlds-api/docs/api_usage/theme_songs.md:10-52`, `:101`, `:138` | minimax_music_3 | decision |
| `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/README.md:51` | graph doc | update with prompt changes |

---

## 10. Frontend cross-repo touchpoints forced by backend contracts

| File:line | Contract | Impact |
|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/shared/types/voice.types.ts:165-174` | `voice_audio_chunk` type literals `content_type:'audio/mpeg'`, `sample_rate: 32000`, `channels: 1` | change to `number` (or a union of the EL rates) together with `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/delivery.py:352` |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/audio/voicePlaybackBuffer.ts:261`, `:345`, `:613-617` | `MediaSource` `'audio/mpeg'` | sample-rate agnostic; no change if the output stays MP3 |
| `/home/andres/WebstormProjects/magic-worlds/src/shared/types/adminVoice.types.ts:63` | `AdminVoiceSampleRate` | follows `/home/andres/PycharmProjects/magic-worlds-api/src/models/admin_voice.py:53` |
| `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/constants.ts:53`, `:84` | MiniMax emotion/format/sample-rate constants | follows the admin DTO redesign |
| `/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/index.ts:1589`, `:1598`, `:1611`, `:1620`, `:2067`, `:2078` | admin voice calls: list `?voice_type=`, `/design`, `DELETE /admin/voices/{voice_type}/{voice_id}`, `/test`, `/clone-file`, `/clone` | every route reshape in 2.3 breaks these calls (added during verification) |
| `/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/index.ts:1954`, `:1961` | **user-facing** Voice Studio calls `/voice-presets/system-voices` (typed `AdminVoiceListResponse`) and `/voice-presets/preview` (typed `AdminVoiceTestResponse`) | the non-root studio reuses the admin DTOs, so changing `AdminVoiceListResponse`/`AdminVoiceTestResponse` breaks the user studio too (added during verification) |
| `/home/andres/WebstormProjects/magic-worlds/src/features/voices/usePreviewVoice.ts:31`; `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/hexAudio.ts:10`; `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/SynthLabPanel.tsx:42`; `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/VoiceDesignForm.tsx:39` | hex audio decoding of `audio_hex` / `trial_audio` (`hexToBlob`) | becomes base64 or binary when the backend drops hex (added during verification) |
| `/home/andres/WebstormProjects/magic-worlds/src/shared/types/adminVoice.types.ts:35`, `:81`, `:95`, `:108`, `:121-122` | `trial_audio`, `audio_hex`, `file_id` (two DTOs), `demo_audio_url` / `demo_audio_hex` | `demo_audio_hex` does not exist in the backend `AdminVoiceCloneResponse` (`/home/andres/PycharmProjects/magic-worlds-api/src/models/admin_voice.py:256-263`, `extra=forbid`), so it is stale already (added during verification) |
| `/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/voiceSocket.ts:70` | client payload denylist includes `audio_hex` | harmless; keep (added during verification) |
| *(pointer)* | The full frontend inventory (i18n `en.ts`/`es.ts` ×8 each, stories, `MiniMaxReferenceDrawer.tsx` ×16; 72 literal mentions in `src/`) lives in `/home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/research/07_frontend_minimax_inventory.md` | — |

---

## 11. REMOVAL/REPLACEMENT CHECKLIST

All paths are absolute. Actions:
- **delete**
- **replace** (with the ElevenLabs equivalent)
- **rename** (to a provider-neutral name)
- **migrate data**

Backend root: `/home/andres/PycharmProjects/magic-worlds-api`. Frontend root: `/home/andres/WebstormProjects/magic-worlds`.

### 11.1 Config, credentials and startup

| item | file:line | action | notes/risk |
|---|---|---|---|
| `MINIMAX_AUDIO_API_KEY` constant + loader | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_credentials.py:8`, `:11-17` | replace | `ELEVENLABS_API_KEY` (optionally a scoped split for TTS vs voice admin); rename the module `provider_credentials.py` |
| TTS base URL default | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:25` | replace | `https://api.elevenlabs.io`; allow the residency hosts; require https |
| TTS model alias + provider model ID | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:26-27` | replace | choose the narration model (`eleven_multilingual_v2` / `eleven_v3` / `eleven_v4`) |
| TTS defaults and ceilings | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:28-37` | replace (retune) | concurrency to plan limits; backoff |
| `_TTS_ENGINE_SETTING_NAMES` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:38-49` | rename | add the EL model/format settings; keep orphan rejection |
| `TtsEngineConfig.minimax_api_key/base_url` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:53-68` | rename | `provider_api_key`, `provider_base_url` |
| MiniMax-only model guard | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:88-92` | replace | registry lookup |
| `from_env` MiniMax reads (http allowed) | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:179-264` (199–204) | replace | https only |
| TTS availability issue codes | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:266-282` | rename | tests assert the strings |
| Streaming WS URL default | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:25` | replace | multi-context URL template with `{voice_id}` |
| Voice-mode env names | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:40-66` | rename | `VOICE_ELEVENLABS_*` |
| Voice config fields | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:91-94` | rename | `tts_provider` value change |
| Provider guard `minimax_streaming` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:153-156` | replace | allow-list |
| WS URL validation | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:157-172` | replace | wss only; `{voice_id}` placeholder |
| Voice `from_env` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:280-445` | replace | — |
| Voice availability issue codes | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:453-477` | rename | tests assert the strings |
| Voice admin config + env names | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:44-50`, `:96-195` | rename | `VOICE_ADMIN_*` |
| `main.py` imports | `/home/andres/PycharmProjects/magic-worlds-api/src/main.py:83`, `:101` | replace | provider factory |
| TTS config error message names the MiniMax key | `/home/andres/PycharmProjects/magic-worlds-api/src/main.py:760-767` | rename | — |
| `app.state.minimax_tts_provider` construction | `/home/andres/PycharmProjects/magic-worlds-api/src/main.py:915-941` (920, 925, 927, 939) | rename | `app.state.tts_provider` |
| `app.state.minimax_voice_admin_*` | `/home/andres/PycharmProjects/magic-worlds-api/src/main.py:943-953` | rename | keep the soft-fail warning |
| Base URL log | `/home/andres/PycharmProjects/magic-worlds-api/src/main.py:995-1009` | rename | — |
| Shutdown `isinstance(MiniMaxVoiceAdminService)` | `/home/andres/PycharmProjects/magic-worlds-api/src/main.py:1069-1075` | rename | — |
| Readiness `isinstance(provider, MiniMaxT2AProvider)` | `/home/andres/PycharmProjects/magic-worlds-api/src/main.py:1471`, `:1479`, `:1483` | replace | Protocol-based check |
| Readiness wiring | `/home/andres/PycharmProjects/magic-worlds-api/src/main.py:1719-1733`, `:1847-1877` | rename | issue codes |

### 11.2 Chat narration (path A)

| item | file:line | action | notes/risk |
|---|---|---|---|
| Adapter module `minimax_adapter.py` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py` (whole file) | replace | new `elevenlabs_adapter.py`; static-guard test pins the filename |
| `T2A_HTTP_PATH` + MiniMax code sets + backoff | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:15-25` | replace | HTTP status + `detail.code`; longer jittered backoff for 429 |
| `NormalizedTtsAudio` (hex, 32 kHz, 128 kbps) | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:28-56` | rename | bytes; sample rate from the format |
| `TtsProviderCompletion` status==2 | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:62-111` (98–99) | replace | HTTP 200 + `request-id` |
| `TtsProvider` Protocol | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:114-119` | rename | move to a neutral module (keep the seam) |
| `MiniMaxT2AProvider` + Bearer | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:122-214` (145) | replace | `xi-api-key` |
| `_completion_from_body` / `_extract_audio` (`extra_info`) | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:217-294`, `:312-362` | replace | validate MP3 frames locally |
| Code/HTTP category mapping | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:396-421` | replace | section 6 table |
| `Retry-After` handling | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:502-503` | replace | keep reading it if present |
| `_VALID_VOICE_EMOTIONS` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:18` | delete | emotions become tags (v3/v4) |
| `TtsRegistryModel` literals | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:21-32` | replace | multi-model registry |
| `ResolvedVoice` ranges | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:35-68` | replace | EL recipe (`stability`, `similarity_boost`, `style`, `use_speaker_boost`, `speed` 0.7–1.2, `language_code`, `model_id`, `seed`) |
| `build_resolved_voice` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:71-101` | replace | tolerate legacy fields during migration |
| `voice_signature_sha256` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:104-119` | replace | include `model_id`, settings, seed |
| `to_provider_payload` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:205-241` | replace | EL body + `output_format` query |
| `normalize_tts_text` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:248-261` | replace | preserve `[tags]` for v3/v4 |
| Default voice check | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:264-276` | replace | EL voice ID |
| Engine import of the MiniMax module | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py:27` | rename | — |
| Engine private markers | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py:52-69` | rename | add `xi-api-key` |
| `save_provider_audio(hex_payload=…)` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py:626-637` | replace | bytes |
| `provider_url_hash = sha256(hex)` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py:664` | replace | semantic break vs legacy rows; hash bytes or set null |
| `provider_trace_id_hash` source | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py:605`, `:683` | replace | `request-id` header |
| `tts_job_public_from_row` alias literal | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py:980`, `:997` | replace | accept legacy + EL aliases; breaks `/tasks` otherwise |
| Asset projection | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py:1011-1035` | replace (only if non-MP3) | keep for MP3 |
| `AudioStorage.save_provider_audio(hex_payload)` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/storage.py:52-70` | replace | bytes |
| Hex decode in local storage | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/storage.py:82-129`, `:191-221` | delete | keep the atomic write 224–238 |
| TTS error sensitive patterns/markers | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/errors.py:57-63`, `:210-234` (225–229) | replace | add EL key/header/URL patterns |
| `__init__` exports | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/__init__.py` | rename | — |
| Chat delivery alias check | `/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_tts_delivery.py:536-537` | replace | allow-set of aliases |
| Chat delivery asset checks | `/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_tts_delivery.py:583-600` | replace (only if format changes) | — |
| `_PRIVATE_TEXT_MARKERS` "minimax" substring | `/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_tts_delivery.py:28-49`, `:776` | replace | regex secrets; fixes the false positive on names |
| Segment voice docstring | `/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_segments.py:116` | rename | — |
| Route TTS imports | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:107` | rename | — |
| Text cap 3000 | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:155`, `:928-934` | replace (model-aware) | v3 5k, v2/v4 10k, Flash 40k [verified models page] |
| Thought dimming `vol*0.6` | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:1129-1134` | replace | no EL volume; options: post-gain, `[whispers]` tag (v3/v4), different voice settings, or drop |
| Segment voice resolver | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:1137-1171` | replace | EL recipe |
| Log line naming `MINIMAX_AUDIO_API_KEY` | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:1347` | rename | — |
| Dead forbidden-fields constant | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/tts.py:26-37` | delete | dead code |

### 11.3 Realtime calls (path B)

| item | file:line | action | notes/risk |
|---|---|---|---|
| Streaming module `streaming_tts_minimax.py` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py` (whole file) | replace | new `streaming_tts_elevenlabs.py` (multi-context) |
| Streaming constants (model, 32 kHz, `basic` normalization, timeouts, socket reuse, code sets) | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:20-47` | replace | `model_id=eleven_flash_v2_5`; `inactivity_timeout` up to 180 |
| `VoiceAudioChunk` hex/32 kHz | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:50-84` | rename | bytes from base64; variable rate |
| `StreamingTtsClient` Protocol | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:87-105` | rename | move to a neutral module (keep the seam) |
| `MiniMaxStreamingTtsClient` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:219-622` | replace | contexts per turn; `close_context` on barge-in |
| `prepare_turn` prewarm | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:244-266` | replace | context init `text:" "` |
| `synthesize` (`task_continue`/`finish`) | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:268-390` | replace | `flush:true` per sentence |
| `cancel` / `close_turn` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:392-407` | replace | `close_context:true` |
| Handshake events | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:506-544` | delete | no EL handshake |
| `_voice_id` fallback | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:572-580` | rename | voice is in the URL path |
| Bearer headers / `max_size` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:593-614` | replace | `xi-api-key` |
| Single-provider factory | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:698-701` | replace | registry factory |
| `_task_start_payload` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:727-754` | replace | `voice_settings`, `generation_config.chunk_length_schedule` |
| `_raise_for_provider_error` (`base_resp`) | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:803-825` | replace | EL WS error/close handling [unverified shape] |
| `_extract_audio_hex` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:828-856` | replace | base64 `audio` |
| Final detection | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:859-872` | replace | `isFinal` + `contextId` |
| Package import | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/__init__.py:31` | rename | — |
| Engine imports | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:16`, `:50` | rename | — |
| "MiniMax default voice_id" guard | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:512-515` | rename | — |
| Session `tts_provider` write | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:611` | replace | new value |
| Per-sentence MP3 duration billing | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:1579-1599` (1587) | replace (verify) | chunk alignment risk [unverified] |
| `sample_rate=chunk.sample_rate` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:1637` | replace | variable rate |
| Raw `voice_id` in `tts_summary` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:2081` | replace | hash for privacy, or keep (decide) |
| MP3 parser docstring "for MiniMax chunks" | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:2286-2343` | rename | parser logic reusable |
| Call-audio persistence hex | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:2391` | replace | bytes |
| Call-audio `sample_rate=32_000` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:2394` | replace | real rate |
| Call-audio MiniMax identity | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:2406-2415` | replace | from the active client |
| `send_audio_chunk` 32 kHz default | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/delivery.py:159` | replace | — |
| `voice_audio_chunk_frame` 32 kHz guard | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/delivery.py:342-364` (352) | replace | coordinate with the FE type |
| `voice_ready_frame` format advertisement | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/delivery.py:212-240` | replace (improvement) | advertise content type and rate |
| Delivery redaction markers | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/delivery.py:455` | replace | add EL |
| Callbot metadata `tts_provider` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/callbot_execution.py:124` | replace | new value; legacy kept on read |
| Voice secret patterns | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/errors.py:58-69` | replace | add `ELEVENLABS`, `xi-api-key`, `sk_`, `elevenlabs.io` |
| Observability forbidden markers | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/observability.py:39-55` | replace | add base64 audio markers |
| Sanitizer provider URL/key patterns | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/transcript_sanitizer.py:17`, `:19` | replace | add EL |

### 11.4 Text conventions and prompts

| item | file:line | action | notes/risk |
|---|---|---|---|
| `<#x#>` pause marker pattern | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/transcript_sanitizer.py:47-51` | replace | `<break time=…/>` (Flash/v2) or none (v3/v4) |
| Unspeakable-structure exemption | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/transcript_sanitizer.py:116-123` | replace | allow `<break …/>` if used |
| `normalize_text_for_tts` (pauses, `(laughs)`, digits) | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/transcript_sanitizer.py:170-228`, `:282-293` | replace | digit handling if Flash normalization is off |
| Sentence buffer no-split rules | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/sentence_buffer.py:23-36`, `:126-132` | replace | add `[…]` and `<break …/>` |
| Callbot prompt interjection/pause section | `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/runtime/callbot_chat.v2.json:32` | replace | new graph version (v3) |
| Callbot graph hash | `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/builtin_agents.v1.json:20`, `:40` | replace | regenerate the sha256 |
| Builtin graph loader references | `/home/andres/PycharmProjects/magic-worlds-api/src/services/builtin_agent_graphs.py:79`, `:175`, `:234` | replace | version bump. Corrected during verification: `:36-40` and `:108` are theme-song references (moved to 11.8) |
| Interjection prompt section | `/home/andres/PycharmProjects/magic-worlds-api/src/services/system_prompts.py:155-159`, `:668-681` | replace | model-family-aware text |
| Interjection policy loader | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:114-120`, `:706`, `:746-755` | rename (keep) | — |
| Callbot `allow_interjections` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/callbot_execution.py:54-60`, `:122` | rename (keep) | — |
| Graph README | `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/README.md:51` | replace | — |

### 11.5 Voice admin, catalog and presets (path C)

| item | file:line | action | notes/risk |
|---|---|---|---|
| Voice admin module | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py` (whole file) | replace | new `voice_admin_elevenlabs.py` |
| Admin endpoint paths + test model | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:63-69` | replace | `/v1/text-to-voice/design`, `/v1/text-to-voice`, `/v2/voices`, `/v1/voices/add`, `DELETE /v1/voices/{id}`, `/v1/text-to-speech/{id}` |
| Allowed clone content types | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:51-62` | replace | confirm EL accepted types [unverified] |
| Format/content-type map | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:72-76` | replace | — |
| Clone status detail codes | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:79-87` | replace | EL `detail.code` |
| Voice group keys | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:89-93` | replace | EL `category` |
| `MiniMaxVoiceAdminError` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:199-206` | rename | `VoiceAdminError` |
| System voice cache | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:209-216`, `:238-273` | replace | paginated `/v2/voices`; cache premade |
| `design_voice` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:218-236` | replace | two-step design + save |
| `delete_voice` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:275-297` | replace | — |
| `test_voice` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:299-311`, `:615-702` | replace | bytes/base64 |
| `upload_clone_file` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:313-366` | delete | folded into IVC multipart |
| `clone_voice` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:368-421` | replace | `/v1/voices/add`; surface `requires_verification` |
| Bearer posts | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:427-538` (488, 518) | replace | `xi-api-key` |
| `_raise_for_base_resp` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:576-608` | replace | shared EL classifier |
| Voice groups / `deletable` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:705-750` | replace | premade not deletable |
| `VoiceAdminService` Protocol | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:28-36` | replace | reshape the methods |
| Admin route state names | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:51-68` | rename | — |
| `POST /design` | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:75-88` | replace | previews + save endpoint |
| `POST /test` | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:91-104` | replace | — |
| `POST /clone-file` | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:107-147` | delete | merge into `/clone` |
| `POST /clone` | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:150-163` | replace | multipart |
| `GET /admin/voices` | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:166-179` | replace | pagination + shared library import (new) |
| `DELETE /{voice_type}/{voice_id}` | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:182-196` | replace | `DELETE /{voice_id}`; FE route change |
| Admin DTOs (all) | `/home/andres/PycharmProjects/magic-worlds-api/src/models/admin_voice.py:10-256` | replace | see section 4.1; FE types follow |
| `_VOICE_ID_PATTERN` | `/home/andres/PycharmProjects/magic-worlds-api/src/models/admin_voice.py:57` | delete | EL assigns IDs |
| `AdminVoiceBaseResponse` | `/home/andres/PycharmProjects/magic-worlds-api/src/models/admin_voice.py:60-64` | delete | — |
| `AdminVoiceEmotion` | `/home/andres/PycharmProjects/magic-worlds-api/src/models/admin_voice.py:28-38` | delete | — |
| `SUPPORTED_SAMPLE_RATES` | `/home/andres/PycharmProjects/magic-worlds-api/src/models/admin_voice.py:53` | replace | EL format strings |
| Preset route error import | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:14` | rename | — |
| `VoicePresetPreviewPayload` | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:23-42` | replace | EL recipe |
| `/voice-presets/system-voices` | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:87-96` | replace | `/v2/voices` premade + curated |
| `/voice-presets/preview` (unmetered) | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:99-118` | replace | add a rate limit/metering (cost) |
| Preset payload models | `/home/andres/PycharmProjects/magic-worlds-api/src/models/voice_preset.py:8-78` | replace | EL recipe fields |
| `CharacterVoice` | `/home/andres/PycharmProjects/magic-worlds-api/src/models/character.py:11-42` | replace | strict `extra=forbid`; migrate data first or keep legacy fields optional |
| `VoicePresetModel` ranges/emotions/write fields | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:14858-15076` (14862, 14863) | replace | add EL fields; `metadata` excluded from `_WRITE_FIELDS` |
| Narrator voice validation | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_adventure_session.py:92`, `:120`, `:1661-1670` | replace | follows `CharacterVoice` |
| Call voice resolution | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_voice_call.py:22`, `:404-424` | replace | EL recipe; voice is in the WS URL |

### 11.6 Database and data migration

| item | file:line | action | notes/risk |
|---|---|---|---|
| `tts_job` CHECK `provider = 'minimax'` | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:670` | migrate data | widen to `IN ('minimax','elevenlabs')`; schema parity requires a migration script + revision bump |
| `tts_job.provider` default | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:639` | migrate data | `'elevenlabs'` |
| `tts_job.provider_trace_id_hash` semantics | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:649` | migrate data | new source (`request-id`) |
| `tts_asset.provider_url_hash` semantics | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:713` | migrate data | was sha256(hex); document the break |
| `voice_session.tts_provider` default | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:263` | migrate data | new default; legacy rows stay |
| `theme_song_job.provider` default `'minimax'` | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:558` | migrate data | stale default; set `'fal'` |
| `theme_song_job` CHECK | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:582` | migrate data | narrow only after a cutover; add `'elevenlabs'` if EL Music is adopted |
| `voice_preset` MiniMax columns | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:1276-1309` | migrate data | add EL columns; map `base_voice_id`; drop/ignore pitch/volume |
| Card `props.voice` (body/version/draft) | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:1004`, `:1029`, `:1054`; `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/card_body.py:44` | migrate data | voice ID mapping table or reset to default |
| `adventure_session.template_snapshot` voices | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:84` | migrate data | characters + `narrator_voice` |
| `adventure_message.metadata` | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:150` | migrate data (audit) | may embed TTS/voice metadata |
| `voice_transcript_segment.tts_summary` | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:318` | migrate data (none; legacy readable) | readers must tolerate both shapes |
| Content schema revision | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql` (last lines), `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py:17` | migrate data | bump |
| Upgrade chain | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py:1691-1719` | migrate data | add the `scripts/migrations/2026xxxx_elevenlabs_voice.py` entry |
| Plan limit seeds | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:916-942`; `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py:24-49` | migrate data (re-price only) | app units unchanged; review vs EL cost |
| `voice_session` validator (`minimax_streaming`) | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:5346` | replace | accept legacy + new |
| `VoiceSessionModel.create` defaults/check | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:5801`, `:5845` | replace | — |
| Theme provider allowed set | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:7654` | replace | follows the section 7 decision |
| `TtsJobModel` provider allow `{"minimax"}` | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:8501` | replace | add `elevenlabs` |
| `TtsAssetModel` parent provider `"minimax"` | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:8994` | replace | add `elevenlabs` |
| Asset parent helper | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:653-679` | replace | — |
| Turn store `tts_provider` check | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/conversation_turn_store.py:395`, `:604` | replace | accept legacy; otherwise replay breaks |
| `TtsJobPublic.model_alias` literal | `/home/andres/PycharmProjects/magic-worlds-api/src/models/tts.py:61` | replace | union incl. legacy |
| `/tasks` projection | `/home/andres/PycharmProjects/magic-worlds-api/src/services/media_tasks.py:7-17`; `/home/andres/PycharmProjects/magic-worlds-api/src/models/task.py:15`, `:37`, `:98` | replace (verify) | a single bad alias breaks the list |
| Voice ID mapping table (new) | — | migrate data | curated MiniMax→EL map for system voices; cloned/designed voices must be re-created in EL (cannot be ported) |

### 11.7 Redaction (non-voice modules)

| item | file:line | action | notes/risk |
|---|---|---|---|
| Image errors MiniMax patterns | `/home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/errors.py:28-30`, `:45`, `:56` | rename | shared redaction helper |
| Image config comment | `/home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/config.py:27-29` | rename | — |
| Image delivery markers | `/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_image_delivery.py:23-41` | replace | regex instead of substring |
| Theme errors/engine markers | `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/errors.py:110`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/engine.py:1227` | rename (if the alias is removed) | — |

### 11.8 Theme songs (decision-dependent)

| item | file:line | action | notes/risk |
|---|---|---|---|
| `minimax/music-3` endpoint + model entry | `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/registry.py:30`, `:33-37`, `:83-95` | replace or keep | fal-hosted; not MiniMax API |
| Default alias `minimax_music_3` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/config.py:23-24`, `:33-35`; `/home/andres/PycharmProjects/magic-worlds-api/src/models/theme_song.py:36-37`, `:172`; `/home/andres/PycharmProjects/magic-worlds-api/.env.example:340` | replace (default → `ace_step` or EL Music) | FE picker follows |
| fal adapter minimax branch | `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/fal_adapter.py:221-245` | delete (if the alias is retired) | — |
| Writer graph + hashes | `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/runtime/theme_song_prompt_minimax_music_3.v2.json`; `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/builtin_agents.v1.json:35`, `:55`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/prompt_agent.py:42-52`, `:102`, `:471`, `:532`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/builtin_agent_graphs.py:36-40` (output JSON schema `minimax_music_3_theme_song`), `:108` (marker set), `:175` (symbolic key set). The `builtin_agent_graphs.py` references were added during verification | delete (if retired) | regenerate the registry |
| Legacy theme rows | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/theme_song_cutover.py:1-27` (precedent) | migrate data | reviewed cutover |
| EL Music (optional new) | — | replace (add) | `POST /v1/music`; new provider value |

### 11.9 Tests, fakes, env, docs

| item | file:line | action | notes/risk |
|---|---|---|---|
| Streaming tests (182 refs / 45 tests) | `/home/andres/PycharmProjects/magic-worlds-api/tests/voice/test_minimax_streaming_tts.py` | replace | multi-context protocol tests |
| Voice admin tests (84 / 34) | `/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_minimax_voice_admin.py` | replace | — |
| Adapter tests (46 / 13) | `/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_tts_minimax_adapter.py` | replace | — |
| Live WS contract (3) | `/home/andres/PycharmProjects/magic-worlds-api/tests/voice/test_live_minimax_tts_contract.py` | replace | EL key + voice; assert the EL rate |
| Live HTTP placeholder | `/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_tts_live_minimax_contract.py` | replace | — |
| Credential tests (3) | `/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_minimax_credentials.py` | replace | — |
| Adapter static guard | `/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_tts_adapter_static_guard.py` | replace | pins the filename and base URL locations |
| Config hygiene | `/home/andres/PycharmProjects/magic-worlds-api/tests/test_config_hygiene.py:65`, `:94`, `:211-281` | replace | env names |
| TTS fakes | `/home/andres/PycharmProjects/magic-worlds-api/tests/fakes/tts.py:17`, `:84`, `:364`, `:379-387` | rename | — |
| Voice fakes | `/home/andres/PycharmProjects/magic-worlds-api/tests/fakes/voice.py:10`, `:19`, `:22`, `:119-190` | rename | — |
| Voice runtime fake | `/home/andres/PycharmProjects/magic-worlds-api/tests/fakes/voice_runtime.py:396` | replace | keep a legacy case |
| Dead theme fixture | `/home/andres/PycharmProjects/magic-worlds-api/tests/conftest.py:192-216` | delete | imports a non-existent class |
| TTS fixtures | `/home/andres/PycharmProjects/magic-worlds-api/tests/conftest.py:247-329` | rename | — |
| Voice test conftest | `/home/andres/PycharmProjects/magic-worlds-api/tests/voice/conftest.py:7`, `:24-25` | rename | — |
| Remaining 50+ test files (section 8.2) | see section 8.2 | replace | literals: provider, alias, 32000, hex, issue codes, `app.state` names |
| Semantic-only tests | `/home/andres/PycharmProjects/magic-worlds-api/tests/models/test_voice_preset_model.py`, `/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_tts_voice_override.py`, `/home/andres/PycharmProjects/magic-worlds-api/tests/models/test_public_dto_strictness.py`, `/home/andres/PycharmProjects/magic-worlds-api/tests/routes/test_voice_presets.py`, `/home/andres/PycharmProjects/magic-worlds-api/tests/voice/test_sentence_buffer.py`, `/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_voice_presets_data.py` | replace | recipe ranges, markup, voice IDs |
| pytest marker | `/home/andres/PycharmProjects/magic-worlds-api/pytest.ini:5`, `:11` | rename | `live_tts_provider` |
| `.env.example` MiniMax section | `/home/andres/PycharmProjects/magic-worlds-api/.env.example:383-405` | replace | — |
| `.env.example` chat TTS section | `/home/andres/PycharmProjects/magic-worlds-api/.env.example:407-459` | replace | — |
| `.env.example` consent copy | `/home/andres/PycharmProjects/magic-worlds-api/.env.example:477-480` | replace | bump `VOICE_CONSENT_VERSION`; legal copy in FE |
| `.env.example` voice TTS vars | `/home/andres/PycharmProjects/magic-worlds-api/.env.example:492-497` | replace | — |
| `.env.example` live test flags | `/home/andres/PycharmProjects/magic-worlds-api/.env.example:528-539`, `:645-653` | rename | — |
| `.env.example` interjections | `/home/andres/PycharmProjects/magic-worlds-api/.env.example:221-226` | replace | — |
| Compose env | `/home/andres/PycharmProjects/magic-worlds-api/docker-compose.yml:124-129`, `:153-155` | replace | — |
| Backend docs | `/home/andres/PycharmProjects/magic-worlds-api/docs/README.md:22`; `/home/andres/PycharmProjects/magic-worlds-api/docs/architecture.md:19-20`; `/home/andres/PycharmProjects/magic-worlds-api/docs/configuration.md:203-215`; `/home/andres/PycharmProjects/magic-worlds-api/docs/operations.md:101`; `/home/andres/PycharmProjects/magic-worlds-api/docs/database.md:149-157`, `:203-215`; `/home/andres/PycharmProjects/magic-worlds-api/docs/development.md:139`, `:149`; `/home/andres/PycharmProjects/magic-worlds-api/docs/api_usage/tts.md` (lines in section 9); `/home/andres/PycharmProjects/magic-worlds-api/docs/api_usage/voice.md:8`, `:14`, `:235`, `:256`, `:266`; `/home/andres/PycharmProjects/magic-worlds-api/docs/api_usage/theme_songs.md:10-52`, `:101`, `:138` | replace | — |

### 11.10 Frontend coupling (coordinate in the same release)

| item | file:line | action | notes/risk |
|---|---|---|---|
| `voice_audio_chunk.sample_rate: 32000` literal | `/home/andres/WebstormProjects/magic-worlds/src/shared/types/voice.types.ts:165-174` | replace | must ship with `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/delivery.py:352` |
| Admin voice sample-rate type | `/home/andres/WebstormProjects/magic-worlds/src/shared/types/adminVoice.types.ts:63` | replace | follows the admin DTOs |
| Admin voice constants | `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/constants.ts:53`, `:84` | replace | — |
| Playback buffer | `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/audio/voicePlaybackBuffer.ts:261`, `:345`, `:613-617` | no change (if MP3) | rate-agnostic |
| Admin + studio API client (added during verification) | `/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/index.ts:1589`, `:1598`, `:1611`, `:1620`, `:1954`, `:1961`, `:2067`, `:2078` | replace | follows the backend route/DTO redesign; `DELETE` loses `voice_type` |
| Hex audio decoding (added during verification) | `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/hexAudio.ts:10`; `/home/andres/WebstormProjects/magic-worlds/src/features/voices/usePreviewVoice.ts:31`; `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/SynthLabPanel.tsx:42`; `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/VoiceDesignForm.tsx:39` | replace | base64/binary; design becomes N previews |
| Admin DTO hex/file fields (added during verification) | `/home/andres/WebstormProjects/magic-worlds/src/shared/types/adminVoice.types.ts:35`, `:81`, `:95`, `:108`, `:121-122` | replace | drop the stale `demo_audio_hex` |

### 11.11 Items added during verification (2026-10-12)

These touchpoints were missing from sections 1–11. Every row was confirmed by direct read of the cited line.

| item | file:line | action | notes/risk |
|---|---|---|---|
| Non-root preset routes reuse **admin** DTOs | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:87` (`response_model=AdminVoiceListResponse`), `:99` (`response_model=AdminVoiceTestResponse`, hex `audio_hex`), `:23-42` (`AdminVoiceEmotion`, MiniMax ranges) | replace | the user Voice Studio shares the admin wire contract. Redesign both together, or give the studio its own DTOs (recommended) |
| User-visible error copy names MiniMax | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:86`, `:233`, `:326`, `:341`, `:357`, `:437`, `:460`, `:494`, `:500`, `:526`, `:532`, `:545`, `:553`, `:559`, `:582`, `:593`, `:606`, `:661`, `:756`, `:764` (`public_detail="MiniMax …"`) | replace | these reach non-root users through `/voice-presets/system-voices` and `/voice-presets/preview` (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:55`, `:95`, `:117`). Use provider-neutral copy |
| OpenAPI summaries name MiniMax | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:78`, `:94`, `:110`, `:153`, `:169`, `:185`; imports `:22-24` | rename | the original note listed only `:78` |
| Clone response moderation fields | `/home/andres/PycharmProjects/magic-worlds-api/src/models/admin_voice.py:256-263` (`demo_audio_url`, `input_sensitive`, `input_sensitive_type`) | delete | MiniMax moderation flags; IVC returns `requires_verification` instead |
| Registry hard-coded provider/encoding literals | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:24` (`provider: Literal["minimax"]`), `:27` (`output_format: Literal["hex"]`), `:29` (`sample_rate: Literal[32000]`), `:32` (`language_boost: Literal["auto"]`) | replace | part of the `:21-32` range, now itemized |
| `voice_audio_chunk_frame` default rate | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/delivery.py:349` | replace | second `32_000` default besides `:159` |
| `VoiceAudioChunk` guard message | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:70` ("do not match MiniMax streaming") | replace | — |
| Hex helpers | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:506-528` (`_looks_like_hex`, `_hex_size_bytes`); `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:875-904`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:773` (`_is_exact_hex`) | delete | go away with the whole-file replacements |
| Engine redaction key list | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py:888` (`hex_audio`, `audio_hex` markers) | replace | add base64 / `audio_base_64` |
| Voice-start capability flag | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_voice_call.py:113` (`media_source_mp3`) | keep (MP3) / replace (PCM) | the client advertises MP3 MediaSource support. If calls move to PCM (open question 14), this capability contract changes |
| `TtsJobPublic` consumer: notifications | `/home/andres/PycharmProjects/magic-worlds-api/src/services/notifications.py:8`, `:13`, `:49` | verify | strict `TtsJobPublic` typing, so the `model_alias` literal widening (4.3) must keep notifications valid |
| TTS segment metadata in messages | `/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_tts_delivery.py:503-526` (`tts_segments` with `assets`) | migrate data (none) | refines the `adventure_message.metadata` audit (db.sql:150). It stores job IDs, status and asset projections (sample rate/bitrate), not voice IDs. Legacy 32 kHz entries stay valid under `TtsAssetPublic` ranges |
| Docstrings naming MiniMax | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/sentence_buffer.py:26`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/transcode.py:4`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/prompt_agent.py:4` | rename | cosmetic |
| Upgrade chain references a missing SQL file | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py:1701`, `:1703`, `:1709` | migrate data | `20260920_theme_song_fal.sql` is not in git; new EL migration appended after `20261012_image_profiles.py` (and the untracked `20261012_resource_tasks.py` if it lands first) |
| Local operator `.env` (untracked) | `/home/andres/PycharmProjects/magic-worlds-api/.env` sets `MINIMAX_AUDIO_API_KEY`, `TTS_DEFAULT_VOICE_ID`, `VOICE_MINIMAX_TTS_VOICE_ID` (names only; values not read) | replace | ops step: provision `ELEVENLABS_*` and an EL default voice ID, then rotate/remove the MiniMax key |
| Local legacy audio | `/home/andres/PycharmProjects/magic-worlds-api/.tts_storage/` (e.g. `2026/`) | keep | legacy MiniMax MP3 assets referenced by `tts_asset` rows |
| Test: TTS alias literal | `/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_notification_service.py:45` (`model_alias="speech_2_8_turbo"`) | replace | not in section 8 (no "minimax" word) |
| Test: interjection prompt contract | `/home/andres/PycharmProjects/magic-worlds-api/tests/test_character_chat_routes.py:1024-1025` (`(laughs)` in rendered callbot prompt) | replace | changes with the v3/v4 tag syntax |
| Test: narrator voice recipes | `/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_segment_voice_resolver.py:70`; `/home/andres/PycharmProjects/magic-worlds-api/tests/routes/test_adventure_character_contracts.py:183`, `:232`, `:244` | replace | follow `CharacterVoice` changes |
| Test: voice_preset schema/wipe | `/home/andres/PycharmProjects/magic-worlds-api/tests/test_schema_bootstrap.py:1710` (`chk_voice_preset_metadata_object`); `/home/andres/PycharmProjects/magic-worlds-api/tests/models/test_user_data_wipe.py:63` | replace (if `voice_preset` columns/tables change) | schema parity + data-wipe coverage for any new voice-mapping table |
| Test: theme alias | `/home/andres/PycharmProjects/magic-worlds-api/tests/routes/test_theme_song_routes.py:58` (`model_alias == "minimax_music_3"`) | decision (section 7) | one of the 68 files with a literal mention, but absent from the 8.2 table |
| Fakes: sentinels and class names | `/home/andres/PycharmProjects/magic-worlds-api/tests/fakes/tts.py:23-26` (`SENTINEL_MINIMAX_*`, `SENTINEL_TRACE_ID`), `:83` (`FakeMiniMaxTtsProvider`), `:403-418`; `/home/andres/PycharmProjects/magic-worlds-api/tests/fakes/voice.py:128`, `:201`, `:204`; `/home/andres/PycharmProjects/magic-worlds-api/tests/conftest.py:255`, `:265-266`, `:299`, `:308`, `:313`, `:326` | rename | add EL sentinels (`xi-api-key`, `sk_…`, `api.elevenlabs.io`) so the privacy tests cover the new provider |
| Docs: interjection and preset contract | `/home/andres/PycharmProjects/magic-worlds-api/docs/configuration.md:146`; `/home/andres/PycharmProjects/magic-worlds-api/docs/api_usage/voice.md:18`, `:235-245` (preset routes incl. `/system-voices`, `/preview`) | replace | — |
| Docs: TTS envelope details | `/home/andres/PycharmProjects/magic-worlds-api/docs/api_usage/tts.md:23` (`POST /v1/t2a_v2`, hex decoding), `:32-35` (`status: 2`, hex, 32 kHz/128 kbps `extra_info`), `:124` (`"sample_rate": 32000` example) | replace | missing from the section 9 line list |

---

## 12. Open questions

1. **Narration model.** Should narration use `eleven_multilingual_v2` (stable, 29 languages, $0.08/1K), `eleven_v3` (expressive tags, 5k chars), or `eleven_v4` (10k chars, 90+ languages; promo price ends 2026-10-12)? The choice determines whether emotion/interjections are expressed as tags.
2. **Call model.** Does `eleven_v4_turbo` (~100 ms) work on the multi-context WebSocket? The docs say v3/v4 are not supported on the TTS WebSocket, but they do not mention the turbo variant explicitly [unverified].
3. **Cost headers.** Which response header carries cost: `character-cost` (introduction page) or `x-character-count` (another page)? Verify with a live call before building cost telemetry.
4. **Flash v2.5 normalization.** Is it off by default (models page) or on (best-practices page)? This decides whether the sanitizer must spell out numbers.
5. **Chunk alignment.** Are EL WebSocket MP3 chunks frame-aligned? If not, per-chunk duration parsing for billing must change to per-sentence parsing.
6. **Voice migration.** How many rows hold MiniMax voice IDs (cards/drafts/versions/snapshots/presets)? The DB was not queried (read-only). And should unmapped voices reset to the default EL voice or be blocked until reassigned?
7. **Legacy rows.** Should legacy `tts_job` / `tts_asset` / `voice_session` rows be kept and readable (recommended: widen checks), or removed via a reviewed cutover like `theme_song_cutover.py`?
8. **Theme songs.** Keep fal `minimax/music-3`, default to `ace_step`, or adopt ElevenLabs Music? Does "remove minimax support" include the fal-hosted model?
9. **Voice IDs in transcripts.** Should `tts_summary` keep the raw `voice_id` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:2081`) or a hash?
10. **API keys.** One EL API key, or scoped keys (TTS-only vs voices-write) plus a credit quota per key?
11. **Zero retention.** Is Enterprise zero-retention (`enable_logging=false`) required to keep the consent copy promise of "no raw-audio retention"?
12. **Recipe migration.** How should `pitch` and `vol` user settings be handled? Options: drop silently, warn in the UI, or map loudness at preset design time.
13. **Admin UX.** Should the admin console expose the shared Voice Library import (`/v1/voices/add/{public_user_id}/{voice_id}`)? Should IVC `requires_verification` be surfaced?
14. **Delivery format.** Should calls stay on MP3 (`mp3_22050_32` / `mp3_44100_64`), or move to PCM with app-side encoding (`lameenc` exists in `transcode.py`)?

---

## Sources

### External (official ElevenLabs, verified 2026-10-12)

1. https://elevenlabs.io/docs/api-reference/text-to-speech/convert
2. https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input
3. https://elevenlabs.io/docs/developers/guides/cookbooks/multi-context-web-socket
4. https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input
5. https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets
6. https://elevenlabs.io/docs/overview/models
7. https://elevenlabs.io/docs/developers/resources/errors
8. https://elevenlabs.io/docs/api-reference/introduction.md
9. https://elevenlabs.io/docs/api-reference/authentication
10. https://elevenlabs.io/docs/api-reference/voices/search
11. https://elevenlabs.io/docs/api-reference/voices/voice-library/get-shared.md
12. https://elevenlabs.io/docs/api-reference/voices/voice-library/share.md
13. https://elevenlabs.io/docs/api-reference/text-to-voice/design
14. https://elevenlabs.io/docs/api-reference/text-to-voice/create.md
15. https://elevenlabs.io/docs/api-reference/voices/ivc/create
16. https://elevenlabs.io/docs/api-reference/voices/delete
17. https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices
18. https://elevenlabs.io/pricing/api
19. https://elevenlabs.io/docs/api-reference/music/compose
20. https://github.com/elevenlabs/elevenlabs-python

### External (secondary)

21. https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tts
22. https://github.com/livekit/agents/pull/4936
23. https://trevorfox.com/api-key-tester/elevenlabs/
24. https://docs.gitguardian.com/secrets-detection/secrets-detection-engine/detectors/specifics/elevenlabs_api_key

### Codebase files (backend, read-only)

- `/home/andres/PycharmProjects/magic-worlds-api/src/main.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_credentials.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/storage.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/errors.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/__init__.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/delivery.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/errors.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/observability.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/callbot_execution.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/transcript_sanitizer.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/sentence_buffer.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/__init__.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_tts_delivery.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_image_delivery.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_segments.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/media_tasks.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/conversation_execution.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/system_prompts.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/builtin_agent_graphs.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/errors.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/config.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/registry.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/config.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/fal_adapter.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/prompt_agent.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/transcode.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/errors.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/engine.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/__init__.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/tts.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_voice_call.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_adventure_session.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/models/admin_voice.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/models/voice_preset.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/models/character.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/models/tts.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/models/task.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/models/theme_song.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql`
- `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/card_body.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/conversation_turn_store.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/theme_song_cutover.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/llm_profile_migration.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/runtime/callbot_chat.v2.json`
- `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/runtime/theme_song_prompt_minimax_music_3.v2.json`
- `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/builtin_agents.v1.json`
- `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/README.md`
- `/home/andres/PycharmProjects/magic-worlds-api/.env.example`
- `/home/andres/PycharmProjects/magic-worlds-api/docker-compose.yml`
- `/home/andres/PycharmProjects/magic-worlds-api/pytest.ini`
- `/home/andres/PycharmProjects/magic-worlds-api/requirements.txt`
- `/home/andres/PycharmProjects/magic-worlds-api/docs/README.md`
- `/home/andres/PycharmProjects/magic-worlds-api/docs/architecture.md`
- `/home/andres/PycharmProjects/magic-worlds-api/docs/configuration.md`
- `/home/andres/PycharmProjects/magic-worlds-api/docs/operations.md`
- `/home/andres/PycharmProjects/magic-worlds-api/docs/database.md`
- `/home/andres/PycharmProjects/magic-worlds-api/docs/development.md`
- `/home/andres/PycharmProjects/magic-worlds-api/docs/api_usage/tts.md`
- `/home/andres/PycharmProjects/magic-worlds-api/docs/api_usage/voice.md`
- `/home/andres/PycharmProjects/magic-worlds-api/docs/api_usage/theme_songs.md`
- `/home/andres/PycharmProjects/magic-worlds-api/tests/` (68 files with MiniMax mentions, plus 6 semantic-only files; enumerated in section 8)
- `/home/andres/PycharmProjects/magic-worlds-api/tests/fakes/tts.py`, `/home/andres/PycharmProjects/magic-worlds-api/tests/fakes/voice.py`, `/home/andres/PycharmProjects/magic-worlds-api/tests/fakes/voice_runtime.py`, `/home/andres/PycharmProjects/magic-worlds-api/tests/fakes/theme_song.py`, `/home/andres/PycharmProjects/magic-worlds-api/tests/conftest.py`, `/home/andres/PycharmProjects/magic-worlds-api/tests/voice/conftest.py`

### Codebase files (frontend, read-only cross-check)

- `/home/andres/WebstormProjects/magic-worlds/src/shared/types/voice.types.ts`
- `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/audio/voicePlaybackBuffer.ts`
- `/home/andres/WebstormProjects/magic-worlds/src/shared/types/adminVoice.types.ts`
- `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/constants.ts`
- `/home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/research/00_current_tts_review.md` (baseline)

---

## Verification log (2026-10-12)

An adversarial fact-check pass was run against backend git HEAD `f77e60f` and the frontend working tree. It was read-only for both repos; only this file was edited.

### What was checked

- **About 150 file:line citations were re-read with `sed -n`/`grep -n`.** Coverage:
  - every checklist row in sections 11.1–11.10, prioritized;
  - the env and compose tables (1.5, 9);
  - DDL lines (3.1);
  - the `models.py` validators (3.2);
  - the enum inventory (3.4);
  - the admin DTOs (4.1);
  - the text-convention rows (5);
  - the redaction rows (6.6);
  - the test fakes and fixtures (8.3);
  - the frontend contract rows (10).
- **Counts were recomputed:**
  - `src/`: 403 mentions in 44 files. Confirmed.
  - `tests/`: 814 mentions in 68 files. Confirmed.
  - Per-file counts and `def test_` counts for the 8.1/8.2 headline files: all confirmed except `test_admin_voices.py`.
- **Broad case-insensitive greps** for `minimax`, `t2a`, `speech-2`/`speech_2_8`, `language_boost`, `emotion`, `pitch`, `voice_id`/`voiceId`, `voice_preset`, `narrator_voice`, `tts_provider`, hex fields (`hex_audio`/`hex_payload`/`audio_hex`/`trial_audio`/`.hex()`), `<#`, `(laughs)`, `MINIMAX_`, `base_resp`, `32000`/`32_000`. Scope:
  - backend: `src/`, `tests/`, `scripts/`, the agent graphs, `db.sql` and its `migrations/`, `.env.example`, `docker-compose.yml`, `pytest.ini`, `docs/`, `Dockerfile`, `test_main.http`, and the untracked `.env` (variable names only);
  - frontend: `src/` for the wire contracts.
- **External claims spot-checked on live official pages:**
  - the MP3 `output_format` list, default `mp3_44100_128`, default `model_id`, `voice_settings` defaults, `apply_text_normalization` values and `enable_logging` semantics [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert];
  - multi-context WS `inactivity_timeout` 20/180, speed 0.7–1.2, `audio`/`isFinal`/`contextId` frames and the `xi-api-key` header [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input];
  - the v3/v4 TTS-WebSocket restriction [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets].
  - All other external claims were not re-checked in this pass.

### Corrections made in place

1. **Theme-song graph lines filed under callbot.** `builtin_agent_graphs.py:36-40` and `:108` belong to `theme_song_prompt_minimax_music_3`, not `callbot_chat`. The callbot references are `:79`, `:175` and `:234`. Fixed in section 5 and 11.4, and the theme-song lines were added to 11.8.
2. **v3/v4 WebSocket source.** The claim was attributed to the stream-input API reference page, which does not state it. Only the TTS-vs-TTD guide does. Fixed the citation, and added the Text to Dialogue WebSocket (which requires `eleven_v3`/`eleven_v4`) as a call-path option.
3. **Admin voice-type enum values.** `admin_voice.py:10-25` uses `system`, not `system_voice`. `system_voice` is the MiniMax response group key.
4. **Line offsets:**
   - `.env.example` interjection block is `221-226`, not `218-226` (4 places).
   - `main.py` `_check_tts_engine` starts at `1458` and `_check_voice_call` at `1499`; shutdown block is `1069-1075`.
5. **Test count.** `tests/routes/test_admin_voices.py` has 14 tests, not 13.
6. **`docs/database.md:149-157`** describes the retired theme-song cutover review, not the `tts_job` provider.
7. **Migration precedent file is missing.** `20260920_theme_song_fal.sql` is not in the repo, though `bootstrap.py:1701`/`:1703` still name it. Documented in 3.3 together with the append point `bootstrap.py:1709`.

### Additions

- **Section 2.1:** zero retention (`enable_logging=false`) disables request stitching [verified].
- **Section 2.2:** `delivery.py:349`, a second `32_000` default.
- **Section 3.4:** `registry.py:24` and `tests/fakes/tts.py:84` (`'minimax'`), plus `delivery.py:349` and `engine.py:2329` (`32_000`).
- **Section 10 / 11.10:**
  - the frontend API client calls for admin and studio voice routes;
  - the hex-decoding sites (`usePreviewVoice.ts`, `hexAudio.ts`, `SynthLabPanel.tsx`, `VoiceDesignForm.tsx`);
  - the admin DTO hex/file fields, including the stale `demo_audio_hex`;
  - a pointer to note 07.
- **New section 11.11, with 24 rows.** Most important:
  - The **user** Voice Studio routes (`/voice-presets/system-voices`, `/voice-presets/preview`) reuse the admin DTOs, including hex `audio_hex`.
  - Twenty user-visible `public_detail` strings name MiniMax.
  - The `media_source_mp3` call capability.
  - The `notifications.py` consumer of `TtsJobPublic`.
  - The `tts_segments` metadata in `adventure_message.metadata`.
  - Seven test files or groups and several fake sentinels missing from section 8.
  - The `docs/api_usage/tts.md` and `voice.md` lines missing from section 9.
  - The operator `.env` and the `.tts_storage/` legacy assets.

### Not issues (checked and confirmed)

- The `emotion` / `voice` / `32000` hits in content-generation and story graphs are prose or LLM token limits, not TTS.
- `scripts/profiles/create_low_thinking_variants.py` mentions voice calls only for LLM profile verification.
- `src/database/mysql/migrations/*.sql` has no MiniMax or TTS literals.
- `_FORBIDDEN_TTS_V1_CLIENT_FIELDS` (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/tts.py:26-37`) has no references in `src/` or `tests/`, so the dead-code claim stands. Its comment calls it an "executable source guard".
