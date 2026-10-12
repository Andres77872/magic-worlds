# Current TTS / voice stack review (MiniMax baseline)

Review date: 2026-10-12. Read-only review of both repositories. Nothing was changed. This note is the baseline for the ElevenLabs migration research in this folder.

- Frontend: `/home/andres/WebstormProjects/magic-worlds` (React 19 SPA).
- Backend: `/home/andres/PycharmProjects/magic-worlds-api` (FastAPI BFF, aiomysql).

Every finding below was read in code by a reviewer. Findings marked **(re-checked)** were checked again in the source by a second pass.

Related earlier docs:
- [voice-calls-review-2026-10-11.md](../../voice-calls-review-2026-10-11.md)
- [voice-calls-latency-review-2026-10-11.md](../../voice-calls-latency-review-2026-10-11.md)

---

## 1. Features that use speech today

| Feature | What the user sees | Provider path |
|---|---|---|
| Chat narration (adventure chats and character chats; character chat reuses `InteractionCenterPanel`) | A play button on each AI reply, plus a per-session auto-narrate toggle. Narration is split into segments, each with its own voice: the narrator, each speaking character, and thoughts (only when "narrate thoughts" is on). | A. MiniMax HTTP `t2a_v2` job, stored as a local MP3 |
| Realtime voice calls (character chats in voice mode, `src/features/call`) | Phone-style conversation. | B. Groq STT, then the LLM, then MiniMax WebSocket `t2a_v2` streaming |
| Call history transcript | Replays the stored assistant audio. | The call MP3 is stored as a `tts_asset` (`source="call_character_tts"`) |
| Voice Studio (`src/features/voices`), voice picker, narrator voice | Users build presets on top of MiniMax system voices, pick a voice for a character, set the adventure narrator voice, and preview. | C. MiniMax `t2a_v2` preview, nothing stored |
| Admin voices console (`src/features/admin/voices`, root only) | Lists voices; designs, clones, tests and deletes them on the shared MiniMax account. | C. MiniMax voice APIs |
| Membership | Usage label and quota for `tts_generation`. | n/a |
| Theme songs (not TTS) | Character theme songs. | fal.ai `minimax/music-3` or `fal-ai/ace-step`. MiniMax music runs **through fal.ai**, not the MiniMax API. |

The novel/Story Studio, gallery and lorebook features do not use TTS.

---

## 2. Provider integration (MiniMax)

### Shared settings
- **Credentials:** one key, `MINIMAX_AUDIO_API_KEY`, sent as `Authorization: Bearer`. No GroupId. Shared by paths A, B and C (`src/services/minimax_credentials.py:8-17`).
- **Base URL:**
  - `MINIMAX_BASE_URL`, default `https://api.minimax.io` (`tts_generation/config.py:25,199-204`). Its parser allows `http`.
  - Calls use a separate setting, `VOICE_MINIMAX_TTS_WS_URL` (`voice_orchestration/config.py:25`).
- **Default voices:** there are two.
  - `TTS_DEFAULT_VOICE_ID` for chat narration.
  - `VOICE_MINIMAX_TTS_VOICE_ID` for calls.

### Path A: chat narration (`src/services/tts_generation/`, `src/services/chat_tts_delivery.py`, `src/routes/user/route_chat.py`)

**Trigger.** Over the chat WebSocket only. The frame is `{type:'tts', assistant_message_id, turn_id, request_id?}` (`WsTtsFrame`, `route_chat.py:212-227`, `extra="forbid"`; frontend `chatSocket.ts:300-312`). The client never sends text, voice or model.

**Building the request.**
- **Text.** `_narrated_segments` (`route_chat.py:1174-1221`):
  - reads `metadata.response_segments`;
  - skips thoughts unless `narrate_thoughts` is on;
  - strips `<think>`;
  - limits each clip to ≤ `min(TTS_MAX_TEXT_CHARS, 3000)`. One clip over the limit rejects the whole turn.
- **Voices.** `_build_segment_voice_resolver` (`route_chat.py:1137-1171`):
  - narrator clips use `snapshot.narrator_voice`;
  - speech clips use the speaking character's frozen snapshot `voice`;
  - thoughts use that voice with `vol*0.6`, floored at 0.5;
  - otherwise `TTS_DEFAULT_VOICE_ID`.
- **Jobs.** A runner creates **one job per segment** (up to 32). Only segment 0 has `enforce_quota=True` (`route_chat.py:1433`).
- **Enqueue.** `engine.enqueue_chat_tts_request` (`tts_generation/engine.py:108-159`):
  - locks the message row;
  - `registry.prepare_request` computes the text sha256 and the voice-recipe hash;
  - `find_reusable_chat_job` runs **before** the quota check (`engine.py:223-254`);
  - inserts a `tts_job` row with `status='pending'`, storing hashes only and never the text.

**Provider call.**
- Runs as a background task holding a per-process `asyncio.Semaphore(TTS_GLOBAL_CONCURRENCY=3)`.
- `POST {MINIMAX_BASE_URL}/v1/t2a_v2` (`minimax_adapter.py:130-199`, payload at `registry.py:205-241`):
  ```json
  {"model":"speech-2.8-turbo","text":"…","stream":false,"output_format":"hex",
   "voice_setting":{"voice_id":…,"speed"?,"vol"?,"pitch"?,"emotion"?},
   "audio_setting":{"format":"mp3","sample_rate":32000,"bitrate":128000,"channel":1},
   "language_boost": "<voice.language_boost or 'auto'>"}
  ```
- **Response validation** is strict: `base_resp.status_code==0`, `data.status==2`, and `extra_info` must match the requested format, sample rate, bitrate and size.

**Storage and delivery.**
- **Storage:** hex is decoded and written atomically (fsync) to `{TTS_STORAGE_ROOT}/YYYY/MM/{job_id}/{asset_id}.mp3`, plus a `tts_asset` row with `storage_backend='local_fs'`. Local disk only.
- **Completion:**
  - patches `adventure_message.metadata.tts_segments[index]`;
  - sends `tts_complete` / `tts_failed` to every socket for (user, project, group, adventure);
  - creates a "Narration failed" notification on failure.
- **Status endpoints:** `GET /tts/jobs/{id}`, `GET /tts/jobs/{id}/result` and `GET /tts/assets/{id}.mp3`. The last is an owner-checked `FileResponse` with `Cache-Control: private, max-age=3600`; Starlette serves Range requests.
- **Frontend polling and playback:**
  - polls every 3 s while focused (`InteractionCenterPanel.tsx:692-700`);
  - fetches MP3s as authenticated blobs (`fetchProtectedMediaBlob`, `index.ts:3592-3642`);
  - plays them with `SingleClipNarration` / `MultiClipNarration` (`TurnNarration.tsx`).
- TTS jobs are **not** part of the generic `/tasks` system or the BackgroundTasks drawer.

**Errors.**
- **MiniMax code mapping** (`minimax_adapter.py:17-22,396-409`):

  | Codes | Category |
  |---|---|
  | 1026, 1027 | `content_blocked` |
  | 1042 | `invalid` |
  | 1004, 1008, 2013, 20132, 2042, 2049 | `unavailable` |
  | 1002, 1039, 2045, 2056 | `rate_limited` |
  | 1001 | `timeout` |

- **Retried codes:** {1000, 1001, 1002, 1024, 1033, 1039, 2045, 2056}, with only 10–50 ms of backoff. `Retry-After` is ignored.

**Billing.**
- `MembershipModel.reserve_media_operation(operation="tts_generation")`.
- Seed plan limits:

  | Plan | Daily requests | Max in flight | Credits |
  |---|---|---|---|
  | free | 20 | 1 | 1 |
  | plus | 100 | 2 | 1 |
  | pro | 500 | 4 | 1 |

- No refund on failure.

### Path B: realtime voice calls (`src/services/voice_orchestration/`, `src/routes/user/route_voice_call.py`)

**Transport.** Hybrid:
- WebSocket `/character-chats/{id}/ws-voice` for control and downlink. Auth uses the subprotocols `['mw.bearer.v1', token]`.
- HTTP multipart `POST /character-chats/{id}/voice-segments` for uplink. The browser's VAD worklet cuts speech into 16 kHz PCM16 mono WAV segments. **Each POST stays open for the whole turn.**

**Pipeline.**
1. Server WAV validation and a silence-floor check.
2. Groq `whisper-large-v3`, batch, `verbose_json`.
3. Transcript sanitizer.
4. Callbot LLM through `magic_llm` (streaming, 30 s timeout).
5. `SentenceBuffer`: boundaries on `.!?` plus whitespace, a 160-character soft cap, and a 120 ms idle flush.
6. A TTS queue of up to 4 sentences.
7. MiniMax WebSocket `wss://api.minimax.io/ws/v1/t2a_v2`.

**MiniMax WebSocket session** (`streaming_tts_minimax.py`):
- **Handshake:** `connected_success`, then `task_start`, then `task_started`.
- **`task_start`:** `model:"speech-2.8-turbo"`, `voice_setting{voice_id,speed?,vol?,pitch?,emotion?}`, `audio_setting{sample_rate:32000, format:"mp3", channel:1}` (no bitrate), `language_boost`, and `text_normalization_mode:"basic"`. That last field is undocumented by MiniMax.
- **Per sentence:** one `task_continue{text}`. A sentence's stream ends at `is_final` or `task_finished`.
- **Socket use:** one prewarmed socket per turn. A sentence that arrives while another is streaming gets a private socket.
- **Timeouts:** 15 s to first audio, 10 s between frames.
- **Audio forwarding:** hex is decoded and forwarded as base64 `voice_audio_chunk{seq, content_type:'audio/mpeg', sample_rate:32000, channels:1, data_b64}`.

**Barge-in.** `_cancel_turn` closes that turn's provider socket, because `t2a_v2` has no cancel event. The browser plays chunks with MediaSource → ManagedMediaSource → Blob groups on one `<audio>` element (`voicePlaybackBuffer.ts`).

**Voice.** Taken from the chat's **frozen** `template_snapshot.character.voice` through `build_resolved_voice` (`tts_generation/registry.py:71-101`). Falls back to `VOICE_MINIMAX_TTS_VOICE_ID`.

**Billing, limits and storage.**
- **Billing:** 1 credit per 10 s of audio, counting STT ms plus TTS ms.
- **Limits:** daily minutes, maximum call length, global concurrency 8, and one call per user.
- **Storage:** the assistant MP3 is saved as a `tts_asset`.

**Callbot text conventions.** The callbot keeps MiniMax inline syntax `<#x#>` (pauses) and `(laughs)` interjections (`transcript_sanitizer.py:170-228`, `CALLBOT_INTERJECTIONS_ENABLED`).

### Path C: voice catalog and management (`src/services/minimax_voice_admin.py`, `src/routes/voice_presets.py`, `src/routes/admin_voices.py`)

**User routes** (`/voice-presets`):
- **Presets:** CRUD with fields `name, description, base_voice_id, base_voice_name, speed 0.5–2, volume (0,10], pitch -12..12, emotion, language_boost`. Global presets (`is_global=1`) are read-only, and no API creates them.
- **`GET /voice-presets/system-voices`:** MiniMax `/v1/get_voice`, **system voices only**, cached 5 minutes per process (`voice_presets.py:87-96`).
- **`POST /voice-presets/preview`:** MiniMax `t2a_v2`, ≤400 characters, returns hex.

**Root routes** (`/admin/voices`):

| Route | MiniMax endpoint |
|---|---|
| `design` | `/v1/voice_design` |
| `test` | `/v1/t2a_v2` (model, emotion, audio_format, sample_rate, language_boost) |
| `clone-file` | `/v1/files/upload` |
| `clone` | `/v1/voice_clone` (with clone_prompt, noise reduction, volume normalization) |
| list | `/v1/get_voice` |
| delete | `/v1/delete_voice` |

**Frontend surfaces:**
- **Admin voices console** (`src/features/admin/voices/`): `SynthLabPanel`, `SynthControls`, `TextArtifactToolbar` (`<#0.4#>` pauses, interjections, inline IPA `word/(ipa)`), `VoiceCloneForm`, `VoiceDesignForm`, `VoiceLibraryPanel`, `SystemVoiceBrowser`, `MiniMaxReferenceDrawer`, `hexAudio.ts`, `voiceIdRules.ts` (MiniMax custom-id rules), `voiceLanguage.ts` (language derived from the MiniMax id prefix), and `constants.ts` (emotions, models, formats, sample rates, `language_boost` values).
- **User Voice Studio** (`src/features/voices/`): `VoiceStudioPage`, `PresetEditor`, `PresetRecipeControls`, `SystemVoicePicker`, `recipe.ts`, `usePreviewVoice.ts`. It imports admin modules.
- **Voice picker** (`VoicePickerDialog.tsx`): presets (the user's plus global) and the system catalog.
  - Choosing a preset **copies its recipe** into the card.
  - Choosing a system voice stores `{voice_id}` only.

**Voice data model.** `CharacterVoice` is `{voice_id, speed, vol, pitch, emotion, language_boost, preset_id, preset_name}`. It is used by:
- character card props;
- adventure / character-chat snapshots (frozen copies);
- `narrator_voice` on adventure snapshots;
- the call runtime.

**Validation.** `voice_id` is checked only by length. It is never checked against the provider catalog.

**Admin-created voices.** Cloned and designed voices are **not reachable by users**: the user picker reads system voices only. MiniMax deletes unused cloned voices after 7 days.

**MiniMax features not used:** `voice_modify`, `pronunciation_dict`, timbre mixing, subtitles, and the HD model outside the admin lab.

---

## 3. Issues found (to fix or design away during the migration)

### High
1. **Unmetered paid preview.** `POST /voice-presets/preview` lets any logged-in user call paid synthesis (≤400 characters). It has no quota, no credit charge and no rate limit, and accepts any `voice_id`. No rate limiter exists anywhere in the API. (`voice_presets.py:99-118`) **(re-checked)**
2. **Multi-voice player stuck on Pause.**
   - The `pause` listener ignores pauses while `wantPlayRef` is true (`TurnNarration.tsx:216-218`).
   - When another audio source takes focus, `isPlaying` stays true. The toggle then calls `pause()` on audio that is already paused, so no event fires and the button never recovers (`:293-298`). **(re-checked)**
3. **One failed segment halts the rest of a multi-voice turn.** The player waits forever and shows Play instead of Retry (`TurnNarration.tsx:225-230,268-273`).
4. **Hydration erases narration in progress.**
   - `adoptServerTurns` merges TTS state from two copies that both came from the server (`InteractionCenterPanel.tsx:334-336`; `mergeHydratedChatTurns` spreads the hydrated turn in `chatTurnMerge.ts:81-92`). **(re-checked)**
   - In-flight clips, job IDs and pending state are lost on tab focus, reconnect or `onDone`.
   - A late poll can then attach audio to the newest reply, because job-id lookup falls back to the last AI turn (`chatTtsTurnState.ts:64,283-290`).

### Medium, backend narration and catalog
5. **Free re-synthesis.** Only segment 0 reserves quota, and the reuse check runs before quota. When segment 0 is reused, segments 1..N are synthesized free with no in-flight cap (`route_chat.py:1433`, `engine.py:223-254`). **(re-checked)**
6. **Character names break narration.** Speaker names containing `secret`, `bearer `, `minimax`, `base64`, `/home/` and similar fail the whole turn (`chat_tts_delivery.py:28-49`). **(re-checked)** A name like "Tracey" is redacted to `[redacted]`, and completion is then dropped silently after the provider was paid.
7. **No refund on failure.** Failed jobs are not refunded, while image generation refunds.
8. **Stuck jobs.**
   - Shutdown cancels tasks without terminalizing them.
   - Stale cleanup runs only on that user's next enqueue.
   - The 120 s stale cutoff is shorter than the worst-case run, so paid audio can be discarded.
9. **No retention or deletion of MP3s.** Deleting a chat, message or user leaves the files on disk (`models.py:5091-5137`).
10. **Voice validation mismatch.** `CharacterVoice` accepts `language_boost:""` and a `voice_id` with surrounding spaces; `build_resolved_voice` rejects both. One bad cast voice breaks all TTS in the session.
11. **Event-loop blocking.** Synchronous hex validation (about 4 passes) plus fsync run on the event loop, and the mirror timeout can never fire.
12. **Duplicate charges on retry.** Retrying on `asyncio.TimeoutError` with the same budget can double-charge, and rate-limit codes (including 2056 "usage limit") are retried almost immediately.

### Medium, realtime calls
13. **Transient auth outage ends the call.** A temporary auth-service outage ends the call as "session expired": `auth` is in `TERMINAL_ERROR_CATEGORIES` (`useVoiceCallController.ts:124-131` vs `voiceSocket.ts:473-478`). **(re-checked)**
14. **Reconnect queue guard can never be true.** The guard (`useVoiceCallController.ts:455`) never holds, so segments upload during a reconnect and the reply frames are lost. **(re-checked)**
15. **Audio sequence gap stalls playback.** After a resume, a seq gap stalls playback, because `drainInOrder` has no gap skip (`voicePlaybackBuffer.ts:273-281`).
16. **Sanitizer false positives.**
    - `bearer\s+…` matches "bearer of bad news".
    - Any 160+ letter run with whitespace removed counts as base64.
    - Both are fatal (`transcript_sanitizer.py:18,284-292`). **(re-checked)**
17. **Barge-in after the LLM finished but while TTS is still playing.** The turn is persisted as `completed` with the full text and **truncated** audio (`voice_orchestration/engine.py:1785-1821`). **(re-checked)**
18. **STT failure loses the utterance.** The segment stays `accepted`, so a retry returns `duplicate` (`engine.py:1468-1483`).
19. **Single process only.** All call state is in process memory, so the API is unsafe with more than one worker. This is latent; `serve.py` runs one process.

### Lower
- **MiniMax WebSocket payload:** streaming omits `bitrate`, and `text_normalization_mode` is not in MiniMax's docs.
- **Silent narration failures:** audio fetch and play errors are swallowed, and stuck jobs are polled forever with no backoff.
- **Frontend re-renders:** `sendTts` is a new function every render, so every `ChatTurn` re-renders on each streamed chunk.
- **Preview races:** voice previews race each other (`usePreviewVoice.runPreview`).
- **Admin console:**
  - the inventory refresh races;
  - the clone demo plays from the provider CDN and ignores `demo_audio_hex`;
  - the design form skips voice-id validation;
  - text is hard-coded English.
- **Accessibility:**
  - the failed narration state looks like idle;
  - call captions are not live regions;
  - start errors are hidden behind the consent modal.
- **Dead code:** `waitForTts`, `getCharacterChatCalls`, `_FORBIDDEN_TTS_V1_CLIENT_FIELDS`, and `TtsAssetModel.mark_deleted` is unused.

### Test gaps
- `TurnNarration` has no tests.
- The backend multi-segment runner is untested.
- The hydration tests feed data the real call site never passes.
- Nothing covers barge-in after the LLM finishes, STT exceptions, or the real voice controller together with the real socket.
- The live MiniMax contract test for narration is a skipped placeholder.
