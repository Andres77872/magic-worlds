# End-to-end latency trace: one voice-call turn (ElevenLabs and Fish lanes)

Audit date: 2026-10-20. Scope: critical path from "user stops speaking" to "first assistant audio audible", both TTS lanes, barge-in path, and documented intent vs code. Read-only audit; no source file was modified.

Evidence labels:

- **FACT**: read directly in code or docs at the cited line.
- **INFERENCE**: reasoned from code and typical network or provider behavior, not measured here.
- **UNKNOWN**: needs a measurement or a deployment fact that is not in the repositories.

Path legend (all paths are absolute; the short forms in tables expand as follows):

| Prefix | Absolute root |
|---|---|
| `FE:` | `/home/andres/WebstormProjects/magic-worlds/` |
| `API:` | `/home/andres/PycharmProjects/magic-worlds-api/` |
| `MLLM-API:` | `/home/andres/PycharmProjects/api.magic_llm/` |
| `MLLM:` | `/home/andres/PycharmProjects/magic-llm/` |
| `MAG:` | `/home/andres/PycharmProjects/magic-agents/` |

---

## 1. Architecture walkthrough (one turn)

```
Browser                                    magic-worlds-api (BFF, 1 uvicorn proc)           Upstreams
-------                                    ---------------------------------------           ---------
mic -> getUserMedia (AEC/NS/AGC on)
    -> AudioWorklet energy VAD (16 kHz)
       pre-roll 300 ms, hangover 550 ms
    -> WAV PCM16 + SHA-256
    -> HTTP POST multipart  ------------->  route upload_voice_segment
       (held open for the whole turn)        auth, user, workspace, chat, consent, form parse
                                             engine.accept_segment
                                               prewarm EL socket + moderation plan  ----->  ElevenLabs WS (multi-context)
                                               supersede previous turn (wait finished)
                                               _intake_segment: DB rows, acks
                                               Groq STT (batch, whisper-large-v3) ----->  api.groq.com
                                               STT billing DB writes
                                             _run_voice_turn
                                               await pending truncation (<=3 s)
                                               llm_runner.stream_turn
                                                 callbot execution: session, lorebook,
                                                 catalog (60 s TTL), admit tx,
                                                 new httpx client per turn  ----------->  api.magic_llm /v1/chat/completions (SSE)
                                                                                             admission/audit DB, magic-agents graph,
                                                                                             magic-llm new aiohttp session -> provider
                                               on VoiceLlmTurnStarted: spend check,
                                               start_speaker, transcript_final,
                                               voice_turn_start
                                               deltas -> SentenceBuffer (.!? + ws,
                                               or 120 ms idle flush)
                                               per sentence: [Fish: dictionaries]
                                               -> moderation (300 ms, fail-closed)
                                               -> flush-ahead gate -> TTS push ---->  EL context / Fish socket
                                               TTS chunk -> deliver -> voice WS
voice WS <- voice_audio_chunk (base64 mp3)
   -> MSE SourceBuffer / ManagedMediaSource
      / Blob groups -> HTMLAudioElement
   -> voice_playback every 500 ms ------->  report_playback (flush-ahead gate, truncation)
```

FACT: microphone bytes go over HTTP, not over the voice WebSocket (`FE:src/infrastructure/api/voiceSocket.ts:1-12`). The client also does not send `voice_vad` frames to the server (`FE:src/features/interaction/hooks/useVoiceCallController.ts:907-918`), so the server has no live "user is speaking" signal.

FACT: the BFF runs a single uvicorn process (`API:src/serve.py:28-33`). Call runtime state is process-local (`API:src/services/voice_orchestration/engine.py:556-632`, docstring "single process / sticky routing only").

## 2. Frame formats

### 2.1 Client to server (voice WebSocket `/character-chats/{id}/ws-voice`, `API:src/routes/user/route_voice_call.py:1452-1603`)

| Frame | Fields | Server handling |
|---|---|---|
| `voice_start` | built by `buildVoiceStartFrame` (`FE:.../useVoiceCallController.ts:1255-1273`) | admit the session (`route_voice_call.py:926-1035`) |
| `voice_ping` | heartbeat every 25 s (`FE:src/infrastructure/api/voiceSocket.ts:19-25`) | touch + `voice_pong` |
| `voice_barge_in` | `turn_id`, `played_ms` (`voiceSocket.ts:212-232`) | `engine.barge_in` (`engine.py:1299-1684`) |
| `voice_playback` | turn id + played ms, every 500 ms while playing (`useVoiceCallController.ts:150`) | `engine.report_playback` (`engine.py:1267-1297`), rate-capped at 4 frames/s |
| `voice_end` | - | end call, 2 s drain |
| `voice_resume` | resume within 15 s client window (server grace 20 s) | rebind socket |
| `voice_segment_meta` | segment metadata | metadata only |

Auth is the Bearer token in `Sec-WebSocket-Protocol` (`voiceSocket.ts:291`).

### 2.2 Client to server, HTTP segment upload

`apiService.uploadVoiceSegment` (`FE:src/infrastructure/api/index.ts:5418-5446`):

- multipart FormData: WAV PCM16 mono 16 kHz, seq, sha256, duration, speech_end lag fields
- header `Idempotency-Key: voice:{vsid}:{seq}:{sha}`
- one retry on `TypeError` after 300 ms (`useVoiceCallController.ts:154, 564-630`)
- the POST resolves only after the server turn finishes (`useVoiceCallController.ts:622-628`)

### 2.3 Server to client (`API:src/services/voice_orchestration/delivery.py`)

| Frame | Builder line | Key fields |
|---|---|---|
| `voice_ready` | 297 | session, limits, audio format |
| `voice_state_snapshot` | 341 | resume snapshot |
| `voice_status` | 361 | state, message, retry_after_seconds |
| `voice_segment_ack` | 372 | seq, status received/accepted/rejected |
| `transcript_final` | 392 | seq, turn_id, text, no_speech_prob |
| `voice_turn_start` | 415 | seq, turn_id |
| `voice_assistant_delta` | 433 | turn_id, content |
| `voice_audio_chunk` | 442 | seq, content_type, sample_rate, channels, `data_b64`, is_final, codec, gain_db, substitution_reason, voice_name |
| `voice_audio_final` | 480 | turn_id, last_seq |
| `voice_turn_end` | 489 | status, truncated, played_ms, kept_chars, duration_ms |
| `voice_cancelled` | 529 | turn_id, reason |
| `voice_error` | 556 | code, message |
| `voice_ended` | 575 | reason |
| `voice_pong` | 583 | - |

FACT: audio is sent as base64 inside JSON (`delivery.py:442-478`), which adds about 33% overhead. `send_frame` takes a per-socket lock and calls `send_json` with no timeout (`delivery.py:212-231`).

## 3. Client state machines

### 3.1 Call controller (`FE:.../useVoiceCallController.ts`)

- **lifecycle**: idle -> starting (getUserMedia -> ensureSession -> consent POST -> `voice_start`) -> ready (`voice_ready` within 15 s, L127) -> ended or error. Order is at L995-1090.
- **turnPhase**: none -> uploading -> waiting -> playing -> none. The upload `finally` resets the phase (L622-628).
- **derived state** `deriveVoiceCallState` (L222-239): listening, user speaking, thinking, assistant speaking, reconnecting.
- **barge-in sub-state** (L644-717): auto barge-in fires on worklet `speech_start` only while playback is `playing`, and only after the 3 s AEC warmup on the first reply (L143). It is disabled entirely when echo cancellation is off or the raw fallback is in use (L676-687). While audio plays, `minSpeechMs` rises to 500 (L137, L689-717). A 2 s settle window follows a barge-in (L146).

### 3.2 Playback buffer (`FE:src/features/interaction/audio/voicePlaybackBuffer.ts`)

- **path selection**: MSE `audio/mpeg` -> ManagedMediaSource (iOS) -> Blob groups.
- **states**: idle -> prepared (MediaSource created at `startTurn`, before audio, L155-163, L316-358) -> buffering -> playing -> ended or cancelled.
- **ManagedMediaSource**: a 2 s stall triggers fallback to Blob groups (L44, L553-564).
- **Blob groups**: each group plays only after the previous one ends (L419-436), which creates gap risk.
- **playedMs**: comes from `audio.currentTime` (L147-153).
- **unlock**: a silent-WAV primer unlocks autoplay (L220-259).

### 3.3 VAD worklet (`FE:src/features/interaction/audio/voiceVadProcessor.worklet.js`)

- **calibrating** (400 ms, L70) -> **silence** -> **candidate speech**. `speech_start` fires after `minSpeechMs` of voiced samples (L339-342).
- **in speech**: the silence counter resets on any voiced frame (L352-353). After `silenceMsToEnd` of silence, `flushSegment` posts the segment and then `speech_end` with `silence_tail_ms` (L372-416).
- **gate**: energy RMS against an adaptive noise floor (x3 multiplier, stay-in ratio 0.8, L57-58, L276-277).
- **max segment**: 7.5 s (L43). The segment is split at the limit, with a 500 ms margin in the controller (L129-131).

## 4. Configuration defaults that shape latency

| Knob | Value | Evidence | Label |
|---|---|---|---|
| VAD silence to end (call) | 550 ms | `FE:src/features/call/components/CallScreen.tsx:100-114` | FACT |
| VAD worklet defaults | strict 450 / balanced 800 ms, minSpeech 250 ms, threshold 0.01 | `voiceVadProcessor.worklet.js:223-228` | FACT |
| Pre-roll / trailing silence kept | 300 / 200 ms | `voiceVadProcessor.worklet.js:44,48` | FACT |
| Max client segment | 7,500 ms | `useVoiceCallController.ts:129` | FACT |
| Barge-in min speech | 500 ms | `useVoiceCallController.ts:137` | FACT |
| AEC warmup (first reply) | 3,000 ms | `useVoiceCallController.ts:143` | FACT |
| Playback report interval | 500 ms | `useVoiceCallController.ts:150` | FACT |
| Mic liveness to raw fallback | 3,000 ms | `useMicrophoneCapture.ts:85,408-439` | FACT |
| STT model | Groq `whisper-large-v3` (pinned) | `API:src/services/voice_orchestration/config.py:19-20,122` | FACT |
| STT timeout / retry | 30 s, no retry | `config.py:30-49`, `stt_groq_client.py:548-556` | FACT |
| Server max segment | 30,000 ms / 2,000,000 B | `config.py:30-49` | FACT |
| Max inflight segments per call | 3 | `engine.py:83-86` | FACT |
| TTS queue max sentences | 4 | `engine.py:83-86` | FACT |
| Idle flush of sentence tail | 120 ms | `engine.py:89` | FACT |
| Truncation wait / grace | 3.0 s / 2,000 ms | `engine.py:105-106` | FACT |
| Moderation per call sentence | 300 ms, fail-closed when required | `API:src/services/speech/moderation.py:73` | FACT |
| Flush-ahead | 3 free sentences, then cap 3 unheard or 8 s ahead, recheck 250 ms | `call_tts_elevenlabs.py:55-59` | FACT |
| EL model / format | `eleven_v4_turbo`, `mp3_44100_64`, multi-stream-input dialogue | `API:src/services/speech/capabilities.py:65,148-159`; `tts_multicontext_ws.py:73-93` | FACT |
| EL timeouts | connect 3 s, first audio 3 s, inter-chunk 5 s, inactivity 20 s | `tts_multicontext_ws.py:73-93` | FACT |
| Fish format / latency | mp3 44.1 kHz 128 kbps, `latency: balanced`, chunk_length 100 | `fish_audio/timestamp_ws.py:206-213` | FACT |
| Fish turn cap | 1,200 chars per turn, 90 s turn timeout | `timestamp_ws.py:25-29`; `fish_audio/streaming.py:109` | FACT |
| LLM HTTP timeouts | total 120, connect 5, read 60, write 10, pool 5 s | `API:src/services/magic_llm_config.py:24-28` | FACT |
| Callbot catalog TTL | 60 s per user | `callbot_execution.py:91,106-120` | FACT |
| Global call concurrency / per user | 8 / 1 | `config.py:30-49` | FACT |
| Daily minutes / max call / idle | 10 min / 600 s / 120 s | `config.py:30-49` | FACT |

## 5. Critical-path timeline, ElevenLabs lane (default)

T0 is the moment the user actually stops speaking. Estimates are INFERENCE unless a measurement is cited. "Serial" means the stage blocks first audio. "Overlapped" means it runs concurrently with another stage.

| # | Stage | Component | Evidence | What waits on what | Best / typical / worst ms | Serial? |
|---|---|---|---|---|---|---|
| 1 | VAD hangover | worklet | `CallScreen.tsx:100-114`; worklet L352-353 | segment end waits for 550 ms of continuous sub-threshold energy; reverb or noise can extend it | 550 / 600-700 / 900+ | serial |
| 2 | WAV build + SHA-256 | main thread | `voiceVadWorklet.ts:175-203` | upload waits for the hash | 2 / 5 / 15 | serial |
| 3 | Upload WAV (about 80 KB for 2.5 s of 16 kHz PCM16, 256 kbps) | browser to BFF | `index.ts:5418-5446` | the server sees nothing until the full body arrives | 20 / 50-150 / 700 (mobile uplink) | serial |
| 4 | Route preamble: auth, local user, workspace, chat, consent, form parse, WAV checks | BFF | `route_voice_call.py:1130-1223` | each awaited in sequence | 15 / 30-60 / 150 | serial |
| 5 | `accept_segment`: get_session, sha, capacity; EL and moderation prewarm launched; touch_call; intake lock | engine | `engine.py:2000-2110` (prewarm L2043-2044) | prewarm is fire-and-forget and overlaps 6-10 | 3 / 10 / 30 | serial (prewarm overlapped) |
| 5b | Supersede previous turn, if any | engine | `engine.py:2072-2074` | waits for `previous.finished` (persistence of the old turn) | 0 / 0 / 500-3,000 | serial when a turn is live |
| 6 | Segment rows + 2 acks (`received`, `accepted`) + validation | engine/DB/WS | `engine.py:2124-2208` | DB writes before STT | 5 / 10-25 / 60 | serial |
| 7 | Groq STT `whisper-large-v3`, batch multipart, verbose_json | Groq | `engine.py:2228`; `stt_groq_client.py:66-98` | turn waits for the full transcript | 200 / 350-800 / 1,500+ (30 s timeout) | serial |
| 8 | STT billing: billing tx + get_session + update_session_metadata; segment `completed` | DB | `engine.py:2245, 2275, 3378-3455` | LLM start waits for these writes | 5 / 10-30 / 80 | serial |
| 9 | Await pending truncation | engine | `engine.py:2322` | only after a barge-in on the previous turn | 0 / 0 / 3,000 | serial |
| 10 | Callbot execution prepare: scoped session, find_admission, prompt render, lorebook (DB), catalog (2 GETs + snapshot, cold every 60 s), admit transaction | BFF to DB and api.magic_llm | `callbot_execution.py:185-225`; `conversation_execution.py:89-239`; `route_chat.py:741-838`; `llm_execution_transport.py:384-406` | serial awaits | 30 / 60-150 / 400 (cold catalog) | serial |
| 11 | `on_start` -> `started` DB write -> new `httpx.AsyncClient` per turn (new TCP, plus TLS if https) -> POST SSE | BFF | `llm_workflow_execution.py:69-131`; `llm_execution_transport.py:276-277,315-325` | dispatch waits for the DB write and the new connection | 5 / 10-40 / 150 | serial |
| 12 | api.magic_llm: prepare_interaction (DB admit), inline agent run, audited_events (DB update inside the stream) | api.magic_llm | `MLLM-API:src/routes/completions.py:991-1065`; `src/services/interaction_admission.py:137-196` | first SSE byte waits for these | 20 / 50-150 / 400 | serial |
| 13 | magic-agents graph `user_input -> chat -> llm(stream) -> end`; magic-llm opens a new aiohttp session (new TCP+TLS to the provider) per call | magic-agents/magic-llm | `API:src/agent_graphs/runtime/callbot_chat.v2.json`; `MLLM:magic_llm/util/http.py:92-102`; `MAG:magic_agents/node_system/NodeLLM.py:1403,1451` | provider request waits for the handshake | 30 / 60-150 / 300 | serial |
| 14 | Provider TTFT (callbot profile model) | LLM provider | doc sample: first text 1,578.794 ms end to end (`FE:docs/fish_audio_support/18_call_engine_development.md:121-123`) | first delta | 150 / 300-900 / 2,000+ (reasoning models) | serial |
| 15 | On first event: spend check await, `start_speaker` (EL `begin_turn` / context init), `transcript_final`, safety screen task, `voice_turn_start` | engine | `engine.py:2571-2600` | the transcript reaches the UI only now | 1 / 5 / 20 | serial (begin_turn overlaps 16) |
| 16 | First sentence completes: `.!?` + whitespace, or 120 ms idle flush | SentenceBuffer | `sentence_buffer.py:150-176`; `engine.py:89, 2564` | needs the next token after the punctuation, or an idle tick | 120 / 200-600 / 1,500 (long first sentence, 160-char soft cap) | serial |
| 17 | Per-sentence moderation (`_call_sentence_verdict`) | engine to api.magic_llm classifier | `engine.py:2393, 3293-3350`; `moderation.py:73,574-639,703-707` | push waits for the verdict; cache hit or optional/absent classifier returns at about 0 | 0 / 0-300 / 300, then fail-closed silence | serial |
| 18 | Flush-ahead gate (first 3 sentences free) -> EL `push_text` with `flush:true` | EL adapter | `call_tts_elevenlabs.py:228-264`; `tts_multicontext_ws.py:615-645` | first sentence passes immediately | 1 / 2 / 5 | serial |
| 19 | EL first audio chunk (socket prewarmed during STT) | ElevenLabs | doc: TTS TTFB 149 ms (`FE:docs/voice_refactor/00_current_status_and_roadmap.md`) | first chunk | 120 / 150-350 / 3,000 (first-audio timeout) | serial |
| 20 | `deliver`: `_record_first_audio`, base64 frame send, ledger, inline TTS billing writes | engine | `engine.py:2458-2508` | the first chunk is sent before billing; later chunks wait for each `deliver` | 2 / 5-20 / 60 | serial for the first frame |
| 21 | WS downlink + JSON parse + base64 decode (atob + Uint8Array.from) | browser | `voicePlaybackBuffer.ts:729-732` | - | 5 / 10-40 / 150 | serial |
| 22 | MSE append -> `play()` -> decoder -> device output | browser/OS | `voicePlaybackBuffer.ts:155-163,316-358` | MP3 decoder priming plus output buffer; Bluetooth adds latency | 30 / 50-150 / 400 (BT) | serial |

**Totals (INFERENCE, EL lane, no live previous turn, warm catalog):**

- Best: about 1.4-1.8 s.
- Typical: about 2.6-4.0 s.
- Worst common: 5-7 s or more (cold catalog, slow STT, reasoning model, long first sentence, mobile uplink, moderation timing out to silence).

The single recorded app-level sample, "first audio 4.9 s after upload" (`FE:docs/voice_refactor/00_current_status_and_roadmap.md`), sits above this typical band once the 550 ms hangover and the upload are added. It is consistent with a slow TTFT or a cold path. The historical review estimated 2.5-7 s against a 1.1-1.5 s target (git `5a29ad5:docs/voice-calls-latency-review-2026-10-11.md`).

**Top contributors, in order:**

1. LLM path, stages 10-14: 0.3-1.5 s of TTFT plus 0.1-0.6 s of BFF and api.magic_llm overhead.
2. Batch STT, stage 7: 0.35-0.8 s.
3. VAD hangover, stage 1: 0.55 s constant.
4. First-sentence wait, stage 16: 0.2-0.6 s.
5. Moderation, stage 17, up to 0.3 s.
6. The DB and connection-setup tax spread across stages 4-13: about 0.1-0.4 s in total.

**What already overlaps (FACT):**

- The EL socket prewarm and the moderation plan warm run concurrently with STT (`engine.py:2043-2044`).
- The EL `begin_turn` context init runs while the LLM writes (`engine.py:2585`).
- The MediaSource is prepared at turn start (`voicePlaybackBuffer.ts:155-163`).
- The spend check is a task started before the LLM (`engine.py:2343`), but it is awaited on the first event.

**Overlap opportunities not taken (INFERENCE):**

- Upload streaming or incremental STT during speech, so stages 3 and 7 overlap stage 1.
- STT billing and the segment `completed` update moved off the path (stage 8; already listed as L-04).
- The catalog, session, lorebook and admission reads prefetched at call start or during STT (stage 10).
- Persistent HTTP clients in BFF -> api.magic_llm and in magic-llm -> provider (stages 11 and 13).
- `transcript_final` sent right after STT instead of after LLM admission (stage 15).
- A clause-level first TTS chunk (stage 16).
- Moderation of sentence N+1 while sentence N plays (`check_ahead`, not built: `engine.py:3310-3311`, `moderation.py:551`).

## 6. Critical-path timeline, Fish lane (gated off)

FACT: `FISH_AUDIO_CALLS_ENABLED=false` by default; R4 is not accepted (`FE:docs/fish_audio_support/17_call_transport_development.md:5-7`; `18_call_engine_development.md:4`).

Stages 1-16 are identical to the EL lane, except that there is no call-level socket prewarm (`API:src/services/speech/providers/fish_audio/streaming.py:52-54`). Differences from stage 15 onward:

| # | Stage | Evidence | What waits | Best / typical / worst ms | Serial? |
|---|---|---|---|---|---|
| F1 | `call_lease`: DB reservation of account capacity, 5 s deadline, 0.1 s poll | `fish_audio/streaming.py:180`; `fish_audio/admission.py:145-161` | the socket opens only after the lease | 3 / 5-20 / 5,000 (contention) | overlapped with the LLM if leased at admission |
| F2 | Socket connect + `start` (`connect_early=True`) | `streaming.py:197`; `timestamp_ws.py:206-213` | overlaps LLM TTFT | 80 / 150-300 / 1,000 | overlapped |
| F3 | Per sentence: `prepare_performance` -> `resolve_dictionaries` (a DB transaction when dictionaries exist) | `engine.py:2386`; `API:src/services/speech/performance.py:9-23` | moderation waits for the plan | 0 / 2-10 / 50 | serial |
| F4 | Moderation (same as stage 17) | `engine.py:2393` | - | 0 / 0-300 / 300 | serial |
| F5 | Per sentence: `attempt.extend` = `SELECT ... speech_provider_account ... FOR UPDATE` (account-wide row lock) + attempt FOR UPDATE + SUM of the day's cost + UPDATE + daily spend add | `streaming.py:189`; `admission.py:103-133` | the text is sent only after this commit; concurrent calls serialize on the account row | 3 / 5-20 / 200+ under concurrency | serial |
| F6 | text + flush -> first audio (`latency: balanced`) | `timestamp_ws.py:206-213` | measured: native first audio 1,686 ms (raw socket, includes connect); engine first accepted audio 927 ms with fake STT/LLM (cancel case 550 ms) | 400 / 700-1,200 / 90,000 (no first-audio timeout; only the 90 s turn timeout) | serial |
| F7 | deliver: same as stages 20-22 (128 kbps MP3 makes the frames twice as large as EL's 64 kbps) | `engine.py:2458-2508` | - | as EL | serial |

**Fish totals (INFERENCE):** about 0.4-0.8 s slower than EL at first audio, on the first chunk alone (balanced latency mode, no prewarm benefit at STT time, per-sentence DB extend). Measured data points are only the two isolated probes above. No browser p50/p95 exists (`18_call_engine_development.md:100-102`).

## 7. Barge-in trace

| # | Step | Evidence | ms (INFERENCE unless noted) |
|---|---|---|---|
| B1 | User starts talking over playback; the worklet needs 500 ms of voiced energy (minSpeech raised while playing) to emit `speech_start` | `useVoiceCallController.ts:137, 689-717`; worklet L339-342 | 500-700 after onset |
| B2 | `maybeAutoBargeIn`: requires playback `playing`, AEC on, not raw fallback, and the 3 s warmup elapsed on the first reply | `useVoiceCallController.ts:676-687` | 0 |
| B3 | `sendBargeIn`: read `played_ms`, cancel playback locally (pause, remove src), send `voice_barge_in{turn_id, played_ms}` | `useVoiceCallController.ts:644-673` | local silence immediately (about 5-20 ms) |
| B4 | Server `barge_in` -> `_truncating_barge_in` -> `_decide_truncation` (heard prefix from played_ms plus the ledger) -> `_cancel_turn` sets cancel_event, sends `voice_cancelled`, calls `speech_call.cancel_turn` (EL `close_context`; Fish socket close) | `engine.py:1299-1684, 1958-1997`; `tts_multicontext_ws.py:390-406` | Fish socket close measured at 81 ms after cancel (`18_call_engine_development.md:95`) |
| B5 | LLM producer cancelled; the httpx stream closes. Whether api.magic_llm cancels the provider call upstream is UNKNOWN (INFERENCE: the client disconnect probably propagates through StreamingResponse) | `llm_turn_runner.py:184-230` | - |
| B6 | Interrupted turn finishes: speaker finish, settled truncation (up to 3 s), assistant persistence and audio asset write | `engine.py:2637-2730` | 50-3,000 |
| B7 | The user's new utterance ends (550 ms hangover) and uploads. `accept_segment` supersede waits `previous.finished`. `_run_voice_turn` waits up to 3 s for pending truncation | `engine.py:2072-2074, 2322` | adds 0-3,000 to the next turn |

**Behavioral consequences:**

- **No false-interruption recovery (FACT).** A backchannel ("mm-hm", a cough, a laugh over 500 ms) stops playback irrevocably: the client cancels and the server truncates. There is no pause-then-resume. Resume after a false interruption is listed as backlog in `FE:docs/voice_refactor/00_current_status_and_roadmap.md`.
- **Echo self-interruption risk (INFERENCE).**
  - Auto barge-in is disabled when echo cancellation is off.
  - `handleCapturedSegment` still uploads every segment during playback (`useVoiceCallController.ts:920-935`).
  - On the server, a new segment supersedes the live turn (`engine.py:2072-2074`). Residual echo transcribed as text therefore still cancels the reply on the server side.
  - The headphones hint is only advisory (`CallScreen.tsx:529-534`).
  - Whether Chrome, Safari and Firefox AEC treat HTMLAudioElement output as the echo reference is UNKNOWN on real devices.
- **Mid-utterance pauses (INFERENCE).** A pause longer than 550 ms inside one user utterance yields a fragment turn. Text merges with the next segment only if the previous user message was not yet persisted (`engine.py:2075-2090`). Otherwise the assistant may start replying to a fragment while the user is still talking. There is no server-side VAD or semantic end-of-turn signal to hold the reply.
- **First reply (FACT).** Barge-in is blind for the first 3 s of the first reply (AEC warmup).

## 8. Observability of the path

- **FACT: server timing.**
  - Server events: `voice_turn_admitted` with latency, first audio `_record_first_audio` (`engine.py:2878-2924`), and `user_stop_ttfb_ms = speech_end_lag + route_lead + segment_to_audio` (`engine.py:2909`).
  - `speech_end_lag_ms` is computed on the client as `sent - speech_end` and includes the hangover (`FE:src/features/interaction/audio/speechEndLag.ts:96-118`).
- **FACT: the client mark stays local.** The browser `mw.voice.first_audible` mark is a local `performance.mark` only (`FE:src/features/interaction/audio/callPlaybackTiming.ts:1-84`). It is never reported to the server.
  - The server-side metric therefore ends at "first chunk handed to the socket". It excludes WS downlink, decode, MSE buffering and device output (stages 21-22).
  - It also does not decompose STT, LLM admission, TTFT, first sentence, moderation and TTS TTFB per turn in a persisted form.
- **FACT: storage.** Observability is an in-process ring buffer of 2,048 events plus logs (`API:src/services/voice_orchestration/observability.py`). Persisted per-turn timing is open item L-12.

## 9. Findings

Each finding uses the ids reported in the structured output.

- **E2E-LATENCY-TRACE-01 (high, latency, FACT).** Post-endpoint batch pipeline.
  - The client uploads uncompressed WAV only after the 550 ms hangover, and STT runs in batch only after the whole body arrives.
  - Nothing (upload, ASR, transcript, LLM prefill) overlaps the user's speech.
  - Evidence: `voiceVadProcessor.worklet.js:372-416`; `index.ts:5418-5446`; `engine.py:2228`; `stt_groq_client.py:66-98`.
  - Cost: hangover, upload, STT and billing all sit serially on every turn, about 0.9-1.8 s typical before the LLM is even asked.
- **E2E-LATENCY-TRACE-02 (high, ux, FACT).** Turn detection uses only an energy threshold with a fixed 550 ms hangover.
  - There is no semantic or prosodic end-of-turn model and no server-side VAD signal; the client deliberately does not send `voice_vad`.
  - Short hangover: fragments on hesitation. Long hangover: dead air.
  - Evidence: `CallScreen.tsx:100-114`; `useVoiceCallController.ts:907-918`; worklet `L276-277, L352-353`.
- **E2E-LATENCY-TRACE-03 (high, latency/robustness, FACT + docs).** Required per-sentence moderation is serial before the first TTS push.
  - It has a 300 ms budget and fails closed.
  - The only measured required-mode run returned `unavailable` after 2,003 ms against a 2,000 ms budget (`18_call_engine_development.md:126-131`).
  - With `VOICE_MODERATION_REQUIRED` on and a classifier slower than 300 ms, every sentence would fail closed, giving text-only or silent calls.
  - `check_ahead` (moderating N+1 while N plays) is not built (`engine.py:3310-3311`).
- **E2E-LATENCY-TRACE-04 (medium, latency, FACT).** Serial DB and connection tax before the first LLM token.
  - STT billing transaction and session metadata update (`engine.py:2245, 3378-3455`).
  - Segment row writes and acks (`engine.py:2124-2208`).
  - Scoped session, admission, lorebook, catalog (cold every 60 s), admit transaction, `started` write (`conversation_execution.py:89-239`; `llm_workflow_execution.py:69-131`).
  - A new httpx client per turn to api.magic_llm (`llm_execution_transport.py:315-325`).
  - api.magic_llm's own admission and audit writes (`completions.py:991-1065`; `interaction_admission.py:137-196`).
  - A new aiohttp session (TCP+TLS) per provider call in magic-llm (`http.py:92-102`).
  - Doc levers L-04 and L-05 are still open.
- **E2E-LATENCY-TRACE-05 (medium, ux, FACT).** `transcript_final` is sent only after LLM admission (the first LLM event, `engine.py:2588`), not after STT (`engine.py:2228`).
  - The user's words appear on screen only after the BFF and magic_llm admission completes, which delays the "I heard you" confirmation by 0.1-0.6 s.
- **E2E-LATENCY-TRACE-06 (medium, latency, FACT).** The first TTS unit is a whole sentence.
  - A sentence boundary needs terminal punctuation followed by whitespace, or a 120 ms idle tick, with a 160-char soft cap. There is no clause or comma-level first chunk.
  - A long first sentence delays first audio by up to about 1 s.
  - Evidence: `sentence_buffer.py:18, 150-176`; `engine.py:89, 2607-2621`.
- **E2E-LATENCY-TRACE-07 (medium, latency, FACT).** The next turn waits for the previous turn to be cleaned up.
  - Supersede awaits `previous.finished` (which includes persistence and the asset write), and `_await_pending_truncation` waits up to 3 s.
  - After a barge-in this adds 0-3 s to the next reply. L-11 is open.
  - Evidence: `engine.py:2072-2074, 2322, 105-106`.
- **E2E-LATENCY-TRACE-08 (high, ux, FACT).** Barge-in has no false-interruption handling.
  - 500 ms of voiced energy irrevocably cancels playback and truncates the reply. There is no pause-and-confirm, no backchannel filter and no resume.
  - Evidence: `useVoiceCallController.ts:644-717`; `engine.py:1299-1684`.
- **E2E-LATENCY-TRACE-09 (medium, robustness, INFERENCE).** Echo self-supersede risk.
  - Segments captured during playback always upload, and on the server a new segment supersedes the live turn. When AEC is off or ineffective, the assistant's own voice can cancel its reply even though client auto barge-in is disabled.
  - Evidence: `useVoiceCallController.ts:676-687, 920-935`; `engine.py:2072-2074`.
- **E2E-LATENCY-TRACE-10 (medium, observability, FACT).** The end-to-end metric is incomplete.
  - `user_stop_ttfb_ms` stops at the server send. The browser first-audible mark is never reported.
  - There is no persisted per-stage breakdown (STT, admission, TTFT, first sentence, moderation, TTS TTFB, downlink, playback start), so p50/p95 per stage cannot be computed.
  - Evidence: `engine.py:2878-2924`; `callPlaybackTiming.ts:1-84`; `observability.py`.
- **E2E-LATENCY-TRACE-11 (medium, latency/robustness, FACT).** LLM call budgets are not voice-specific.
  - Read timeout is 60 s and total 120 s, with no TTFT deadline.
  - There is no filler, earcon or "thinking" cue for slow first tokens (the earcon above 700 ms is backlog).
  - The callbot graph sets no `max_tokens` (L-08 open).
  - Evidence: `magic_llm_config.py:24-28`; `callbot_chat.v2.json`.
- **E2E-LATENCY-TRACE-12 (medium, latency, FACT).** STT is pinned to `whisper-large-v3` (not turbo) with no retry. A transient Groq error drops the turn after waiting up to 30 s.
  - Evidence: `config.py:19-20, 122`; `stt_groq_client.py:548-556`.
- **E2E-LATENCY-TRACE-13 (medium, scalability, FACT).** Fish per-sentence admission takes an account-wide `FOR UPDATE` row lock and a SUM of the day's cost before each sentence is sent.
  - Concurrent Fish calls serialize on one row, and every sentence pays a DB round-trip on the audio path.
  - Evidence: `admission.py:103-133`; `streaming.py:189`.
- **E2E-LATENCY-TRACE-14 (medium, robustness, FACT).** Fish stall guard and turn cap.
  - The only stall guard is the 90 s turn timeout; there is no first-audio or inter-chunk timeout (EL has 3 s and 5 s).
  - A 1,200-character turn cap raises 422 for long replies.
  - The connection uses `latency: balanced` instead of the low-latency mode.
  - Evidence: `timestamp_ws.py:25-29, 206-213`; `streaming.py:109`.
- **E2E-LATENCY-TRACE-15 (low, scalability, FACT).** Call runtime state is process-local on a single uvicorn process. Scale-out needs sticky routing or shared state (V-12).
  - Evidence: `engine.py:556-632`; `serve.py:28-33`.
- **E2E-LATENCY-TRACE-16 (low, audio-quality, FACT).** Fallback playback paths add gaps and stalls.
  - Blob-group playback waits for each group to end before starting the next.
  - ManagedMediaSource stalls for 2 s before falling back.
  - Base64-in-JSON adds about 33% overhead and main-thread decode.
  - Evidence: `voicePlaybackBuffer.ts:44, 419-436, 553-564, 729-732`; `delivery.py:442-478`.
- **E2E-LATENCY-TRACE-17 (low, cost, docs).** The Groq 10 s minimum billing per request (backlog note) makes short utterances cost more than their duration. Segment-per-request batch STT amplifies it.
  - Evidence: `FE:docs/voice_refactor/00_current_status_and_roadmap.md` (call backlog).
- **E2E-LATENCY-TRACE-18 (low, robustness, FACT).** The HTTP POST is held open for the whole turn.
  - Turn duration depends on reply length, so long replies hold connections and are exposed to proxy idle timeouts.
  - `MAX_INFLIGHT_SEGMENTS_PER_CALL=3` bounds the queue.
  - Evidence: `useVoiceCallController.ts:622-628`; `engine.py:83-86`.

## 10. Documented intent vs code

| Item | Docs say | Code reality | Status |
|---|---|---|---|
| L-01 remove metadata LLM from callbot graph | proposed in 2026-10-11 review | `callbot_chat.v2.json` is `user_input -> chat -> llm -> end`; idle flush of 120 ms present (`engine.py:89`) | DONE |
| L-02 MiniMax TTS prewarm | proposed | superseded by the EL multi-context prewarm (`engine.py:741-938`, `2044`) | SUPERSEDED |
| L-03 VAD 800 -> 550 ms | proposed | `CallScreen.tsx:100-114` sets 550 | DONE |
| L-04 shared HTTP client, fewer DB trips, STT billing off path | deferred | new httpx client per turn; STT billing on path (`engine.py:2245`) | OPEN |
| L-05 api.magic_llm overhead | deferred | admission and audit DB inside the request; new aiohttp session per call | OPEN |
| L-06 Whisper language hint / turbo | deferred | language hint and name prompt present (`route_voice_call.py:592-609, 704-709`); model still `whisper-large-v3` | PARTIAL |
| L-08 fast non-reasoning callbot profile, 300-400 max tokens | deferred | no `max_tokens` in graph; profile is data (UNKNOWN which model) | OPEN |
| L-11 previous turn cleanup off next turn's path | deferred | `previous.finished.wait()` and the 3 s truncation wait remain | OPEN |
| L-12 persisted per-turn timing | deferred | in-memory ring buffer only | OPEN |
| V-01 moderation release blocker | required mode unproven | measured 2,003 ms vs 2,000 ms budget; call path budget is 300 ms; dev classifier disabled | OPEN, blocking |
| V-05 latency gate | open | estimates above; single sample 4.9 s from upload to first audio | OPEN |
| V-06 real devices | open | AEC/MSE device behavior unverified | OPEN |
| V-07 earlier transcript, streaming STT, semantic EOT, binary/PCM playback | open | none implemented (`transcript_final` after admission; batch STT; base64 MP3) | OPEN |
| V-12 single process / sticky routing | open | single uvicorn, process-local runtime | OPEN |
| V-13 EL spike tests | not run | - | OPEN |
| Fish R4 | not accepted | flag off; remaining: required moderation within budget, full authenticated flow, debit reconciliation, disconnect/slow-playback/device, p50/p95 and cancellation-to-silence targets (`18_call_engine_development.md:140-146`) | GATED |
| Fish doc 06: first-audible mark correlated with stage timings | proposed | mark exists but local only; no correlation shipped server-side | PARTIAL |
| Fish doc 06: never feed raw deltas; approved complete units only | intent | honored: sentence buffer plus moderation gate before push | DONE |
| Fish doc 06: barge-in closes socket immediately, does not drain | intent | honored: cancel closes the socket (81 ms measured) | DONE |
| Moderation `check_ahead` (S-29) | planned | hook exists (`moderation.py:551`) but unused; engine docstring says not built (`engine.py:3310-3311`) | OPEN |
| Backlog: Silero VAD, pause-then-confirm barge-in, earcon above 700 ms, preemptive LLM, quota leasing, pub/sub | backlog | none implemented | BACKLOG |

## 11. Strengths

- The EL socket is prewarmed during STT, so TTS connect cost is mostly hidden (`engine.py:2044`). Multi-context per-turn contexts give clean cancellation via `close_context`.
- The flush-ahead gate is driven by real playback reports, which limits wasted synthesis after barge-in (`call_tts_elevenlabs.py:55-59`).
- Truncation keeps only the heard prefix, using `played_ms` and the character or word ledger, so the stored reply matches what the user heard.
- Uploads are idempotent (Idempotency-Key with sha) with one network retry. Stale frames are suppressed on both sides by turn id and seq (`voiceSocket.ts:448-463`).
- The VAD keeps a 300 ms pre-roll, an adaptive noise floor and hysteresis, a raw-mic fallback on silent devices, and a Safari `play-and-record` audio session.
- The MediaSource is prepared at turn start, and MSE streaming is used where available. Autoplay is unlocked with a silent primer.
- The metadata LLM is gone from the call graph (L-01), and VAD was cut to 550 ms (L-03).
- Preflight checks run concurrently at call start. The Groq HTTP client is persistent.
- Fish generations are epoch-isolated with bounded queues, and cancellation closes the socket instead of draining it.
- Rich voice_* telemetry and a server `user_stop_ttfb_ms` metric already exist as a base for p50/p95.

## 12. Open questions

1. Deployment topology:
   - Is there a reverse proxy, HTTP/2, or keep-alive between the browser and the BFF?
   - Is api.magic_llm reached over http or https, and on the same host?
   - This decides the cost of the per-turn new client.
2. Which model and settings does the published callbot profile use (reasoning or not, max output tokens, provider region)? TTFT dominates the budget.
3. Is `VOICE_MODERATION_REQUIRED` true in the target deployment, and which classifier model backs it? What is its p95 against the 300 ms call budget?
4. Real p50/p95 per stage on target devices. Only single samples exist: TTS TTFB 149 ms, 4.9 s from upload to first audio, Fish 927 ms with fake STT/LLM.
5. Does browser AEC (Chrome, Safari, Firefox; laptop and phone speakers) treat HTMLAudioElement or MSE output as the echo reference well enough to avoid self-supersede?
6. Firefox MSE support for `audio/mpeg` and which fallback path it takes in practice.
7. Does the client disconnect cancel upstream provider generation through api.magic_llm and magic-agents, or does generation (and spend) continue after barge-in?
8. Does Fish `latency: normal/low` (vs `balanced`) materially reduce first audio for drama-3, and does an idle prewarmed Fish socket consume account concurrency?

## Verification (adversarial)

A second pass tried to disprove each finding against the code (frontend `magic-worlds`, BFF `magic-worlds-api`, `api.magic_llm`, `magic-llm`). Verdicts: 6 confirmed, 8 adjusted, 0 refuted. Line numbers are those observed on 2026-10-20.

| id | verdict | corrected severity | evidence / note |
|---|---|---|---|
| E2E-LATENCY-TRACE-01 | confirmed | high | `voiceVadProcessor.worklet.js:353` flushes only after `silenceFramesToEnd`; `CallScreen.tsx:114` sets `silenceMsToEnd: 550`. `voiceVadWorklet.ts:188` sets the encoding to `audio/wav;codec=pcm_s16le` at 16 kHz. `index.ts:5418-5444` sends one multipart POST. `engine.py:2228` runs batch STT after `create_segment`, `update_segment(accepted)` and the acks. Nothing overlaps the user's speech. |
| E2E-LATENCY-TRACE-02 | confirmed | high | The gate is RMS-only (`worklet.js:276-277`). The controller deliberately sends no `voice_vad` (`useVoiceCallController.ts:908`), and the server has no `voice_vad` handler (`route_voice_call.py:257-258` lists ping and barge_in, among others). Fragments merge only when the earlier user message was not persisted (`engine.py:2075-2079`). The cited `CallScreen.tsx:100` is off by about 14 lines; the value is at line 114. |
| E2E-LATENCY-TRACE-03 | confirmed | high | `moderation.py:73` `CALL_SENTENCE_TIMEOUT_SECONDS=0.3`. The `asyncio.timeout` is at `:721`. With `required=True` (code default, `.env.example:514`), an unavailable verdict stays unavailable. `engine.py:2393` awaits the verdict inside `prepare`, and `call_tts_elevenlabs.py:237` awaits `prepare` before `push_text`. Dev `.env:78,81` has the classifier off and moderation optional. Doc 18:126 records `unavailable` at 2,003 ms against a 2,000 ms budget; that was a preview probe, and the call-sentence probe was never dispatched. Nuance: `_push` runs concurrently with `_drain`, so for N≥2 sentence N+1 is already moderated while N plays. The serial cost is therefore mainly on the first sentence, and a fail-closed verdict mutes a sentence while its text still streams. |
| E2E-LATENCY-TRACE-04 | confirmed | medium | All listed stages are serial: `_record_billable_audio` with `_persist_billing_metadata` (`engine.py:2245,3404-3421`) and `update_segment(completed)`; then `get_scoped_session`, `find_admission`, `prepare_context` (`append_lorebook_context`, `route_chat.py:808`), the catalog (`CATALOG_TTL_SECONDS=60`) and `admit` (`conversation_execution.py:89-190`). Next come `repository.started` through `on_dispatch` (`llm_execution_transport.py:328`) and a new `httpx.AsyncClient` per stream, because the executor is built with `client=None` (`engine.py:3793`). `prepare_interaction` writes in api.magic_llm (`completions.py:1002`), and `magic-llm` opens a new `aiohttp.ClientSession()` per request (`http.py:92`, used by every engine). Additional serial step not in the finding: `llm_turn_runner.py:160-170` `deliver()` blocks the executor until the engine has consumed `VoiceLlmTurnStarted`. That consumption awaits the spend check and two WS sends (`engine.py:2575-2600`), so the api.magic_llm dispatch waits for them too. |
| E2E-LATENCY-TRACE-05 | adjusted | low | The frame is sent on `VoiceLlmTurnStarted` (`engine.py:2582-2592`), after `await spend_check`, as the finding says. The mechanism is misstated, though. The admission is the BFF's own `LlmExecutionRepository.admit`, and `on_start` fires inside `run()` before the api.magic_llm POST (`llm_workflow_execution.py:93-96`), not after an api.magic_llm admission. The delay is BFF DB, lorebook and catalog work. It is UI-only feedback; the user still waits for audio. |
| E2E-LATENCY-TRACE-06 | confirmed | medium | `sentence_buffer.py:150-181` cuts only on `.!?` followed by whitespace, with a soft cap of 160 (`:18`) and no clause cut. Nuance: the 120 ms idle tick (`engine.py:88`, `take_finished_span`) releases only text that already ends with sentence punctuation. It is not an independent boundary. |
| E2E-LATENCY-TRACE-07 | adjusted | low | The mechanics are real. `engine.py:2072-2074` awaits `previous.finished` only when the previous turn is still running. That covers `speaker.finish`, `_settled_truncation` and `_persist_assistant_call_turn` (`:2636-2740`). `_await_pending_truncation` waits up to 3 s (`:1669-1683`, `:2322`). The 0-3 s impact is overstated. On the barge-in path, the truncation task (`_decide_truncation`, `:1566-1576`) and the cancelled turn's finalization start at the barge-in frame. They overlap the user's continued speech, the 550 ms hangover, the upload and STT, so the 3 s cap is a rare worst case. The serial cost bites mainly on supersede-without-barge-in (AEC off, inside the 3 s warmup, speech before audio) or on slow DB and storage. |
| E2E-LATENCY-TRACE-08 | adjusted | medium | Confirmed as irrevocable. `sendBargeIn` cancels playback at once (`useVoiceCallController.ts:644-672`), and the server's `_cancel_turn` sets `cancel_event` and kills the TTS context (`engine.py:1958-1994`). There is no resume or pause-then-confirm. "No backchannel filter" is wrong: `BARGE_IN_MIN_SPEECH_MS=500` (`:132-137`) is applied while audible (`:706`), and its purpose is to ignore "mm-hm" and echo (LiveKit min interruption duration). Short coughs and backchannels under 500 ms of voiced energy do not interrupt; longer laughs or "yeah, right" do. The 3 s AEC warmup applies only to the call's first playback (`:705`, reset at `:998`). |
| E2E-LATENCY-TRACE-09 | confirmed | medium | Auto barge-in is skipped without AEC (`useVoiceCallController.ts:681`), yet `handleCapturedSegment` uploads every segment (`:920-934`). The server supersedes on any non-empty transcript, and `_supersede_heard_prefix` documents this exact AEC-off path (`engine.py:1414-1424`). Mitigations: the 500 ms minimum speech while audible, the server RMS and peak gates, and STT no-speech. Echo at speaker level can still pass them. This remains an inference; device behavior is unverified. |
| E2E-LATENCY-TRACE-10 | adjusted | low | The browser mark is local only (`callPlaybackTiming.ts:1-34`), and nothing is persisted per turn ("The DB holds no first-audio time", `metrics.py:1470-1474`). Two claims are wrong. Every event is also written to structured logs (`observability.py:164-175`). `feed_speech_metrics` keeps process-local p50/p95 histograms for `call_user_stop_to_first_audio_ms`, `call_first_audio_ms` and `moderation_ms` (`metrics.py:55-60,184-250`), served at `/admin/voices/metrics/calls` with an RB-1 page alert on first-audio p50 above 400 ms (`metrics.py:1374,1467-1482`). Server-side p50/p95 and stage attribution (per-stage events with seq and turn_id in logs) exist. The real gaps are client-perceived latency, persistence across restarts and processes, and a joined per-turn row. |
| E2E-LATENCY-TRACE-11 | adjusted | low | "No voice-specific budgets / no max_tokens" is wrong. The `callbot` FeatureContract caps `max_output_tokens=1,536`, `timeout_seconds=30`, `max_input_tokens=32,768` and `max_messages=80` (`llm_features.py:66-68`). `effective_roles` clamps the profile to these (`llm_profile_resolution.py:149-157`), and `bind_workflow_settings` always injects `max_tokens` into the graph (`symbolic_workflows.py:118`). Still true: there is no TTFT deadline or fallback profile, no filler or earcon (no matches in the voice_orchestration, interaction or call code), and the httpx read timeout is 60 s (`magic_llm_config.py:26`). 1,536 tokens is still well above a 300-400 voice cap, and `reasoning_effort` is data-driven. |
| E2E-LATENCY-TRACE-12 | confirmed | medium | `config.py:20` sets `whisper-large-v3`, and `transcribe_segment` refuses any other model (`stt_groq_client.py:61`), so a code change is needed. There is a single POST with no retry (`:92-107`), a 30 s default timeout (`config.py:47`), and no retry wrapper in `engine.py`. The client is persistent. The latency gain from turbo on Groq is likely small for short clips; the 30 s single-shot failure mode is the main issue. |
| E2E-LATENCY-TRACE-13 | adjusted | low | Confirmed: `extend_stream` (`admission.py:103-140`) runs `SELECT ... FOR UPDATE` on the account row and the attempt row, then a daily SUM, an UPDATE and `VoiceSpendDailyRepo.add` for each unit (`streaming.py:189`). However, `FISH_AUDIO_CONCURRENCY` defaults to 1 (`config.py:41,89`), so the account slot cap, not the row lock, is the binding throughput limit. For sentences N≥2 the extra transaction overlaps playback. The latency is paid mainly on the first unit. |
| E2E-LATENCY-TRACE-14 | adjusted | medium | Confirmed: the turn timeout is 90 s with no first-audio or inter-chunk deadline (`timestamp_ws.py:162-167,204`), unlike EL's 3 s and 5 s (`tts_multicontext_ws.py:76-77`); `latency:'balanced'` (`:212`); the 1,200-character cap (`:28`, `streaming.py:109`) makes the speaker stop with the text continuing, and 1,536 output tokens can exceed it. One detail is wrong: "no prewarm". `connect_early=True` opens the socket and takes the lease at `begin_turn`, which is at LLM admission, so the handshake overlaps LLM TTFT (`streaming.py:180-193`). Only call-level or STT-time prewarm is absent (`streaming.py:52`). WS ping 20/20 detects dead links at about 40 s. Dev `.env:102` has `FISH_AUDIO_CALLS_ENABLED=true`. |
