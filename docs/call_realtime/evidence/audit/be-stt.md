# Audit evidence: backend speech-to-text path (Groq Whisper) and pre-STT gating

Subsystem: **BE-STT** (backend STT, server VAD gate, and the STT-calling sections of the call engine)
Audit date: 2026-10-20 · Auditor: workflow sub-agent (read-only code audit; no source modified; no live provider calls made)

Repositories read:

- Backend BFF: `/home/andres/PycharmProjects/magic-worlds-api` (FastAPI, Python 3.12 in Docker `Dockerfile:31,49`; local venv 3.13)
- Frontend SPA (only to confirm what reaches the STT): `/home/andres/WebstormProjects/magic-worlds`

Legend used throughout: **FACT** = seen in code at the cited line · **INFERENCE** = reasoned from code and/or provider docs, not measured · **UNKNOWN** = cannot be determined from the repo.

---

## 1. Scope and files

| File | Lines | Role |
|---|---|---|
| `src/services/voice_orchestration/stt.py` | 141 | STT seam: `VoiceAudioSegment`, `SttTranscript`, `call_stt_prompt`, `SegmentSpeechToTextProvider` protocol, `build_stt_client` factory |
| `src/services/voice_orchestration/stt_groq_client.py` | 571 | Groq adapter: multipart request, verbose_json parsing, hallucination/no-speech heuristics, error mapping, timeouts |
| `src/services/voice_orchestration/server_vad.py` | 323 | Pre-STT validation ("server VAD"): WAV parse, format checks, energy stats, silence floor |
| `src/services/voice_orchestration/config.py` | 459 | `VoiceConfig` (STT + VAD settings, env parsing, readiness) |
| `src/services/voice_orchestration/engine.py` | 4154 | `accept_segment` / `_intake_segment` (lines 2000-2290) call VAD + STT; billing; supersede |
| `src/services/voice_orchestration/transcript_sanitizer.py` | 308 | Post-STT transcript sanitizing (`sanitize_transcript_text`) |
| `src/services/speech/interfaces.py` | 88-98 | `SpeechToTextProvider` (batch) and `RealtimeSpeechToTextProvider` (declared, unimplemented) |
| `src/routes/user/route_voice_call.py` | 1115-1243, 538-711 | HTTP segment upload route; STT language + prompt resolution at call start |
| `tests/voice/test_groq_stt_client.py` | 660 | Adapter unit tests (MockTransport) |
| `tests/voice/test_live_groq_stt_contract.py` | 103 | Opt-in live contract test (env-gated) |
| `tests/voice/test_server_vad.py` | 236 | Server VAD unit tests |

---

## 2. How it works today (architecture walkthrough)

### 2.1 Transport into the STT path (FACT)

Microphone audio does **not** stream to the server. The browser AudioWorklet VAD cuts a segment and the SPA uploads it as one **HTTP multipart POST** per segment, *after* end of speech:

- Client upload: `src/infrastructure/api/index.ts:5420-5445` (frontend) — form fields `voice_session_id, client_call_id, seq, started_at_ms, duration_ms, encoding, sample_rate, channels, audio_sha256, vad_json, audio` plus `Idempotency-Key: voice:{voice_session_id}:{seq}:{sha256}`.
- Server route: `POST /character-chats/{session_id}/voice-segments` at `route_voice_call.py:1130-1223`.
  - `_mark_segment_received` dependency stamps `received_at_ms` before auth (`route_voice_call.py:1120-1122`).
  - Before the body is parsed: `ensure_voice_available`, user context, `resolve_workspace_context(intent="new_work")`, `get_user_chat`, `build_admission_context(require_capacity=False)` (consent re-check, `admission.py:189-213`), Content-Length pre-check (`route_voice_call.py:1158, 1226-1243`; limit `max_segment_bytes + 64 KiB` at `:80`).
  - Then `request.form()`, `upload.read(max_segment_bytes + 1)`, encoding must equal `audio/wav;codec=pcm_s16le` (`:115, 1180-1182`), `sample_rate == 16000 and channels == 1` (`:1185-1186`).
  - Calls `engine.accept_segment(...)` (`:1194-1220`). **The HTTP request stays open for the whole turn** (STT + LLM + TTS); the frontend comment confirms "The POST resolves only after the server turn finished" (`useVoiceCallController.ts:621-622`).

What the client sends (FACT, frontend, context only): 16 kHz mono PCM16 WAV; 300 ms pre-roll (`voiceVadWorklet.ts:20`), speech, and at most 200 ms of the trailing silence (`voiceVadProcessor.worklet.js:48, 377-379`); turn ends after 550 ms of silence (`CallScreen.tsx:114`); hard cut at 7.5 s (`voiceVadWorklet.ts:18`, `useVoiceCallController.ts:129`, cut mid-speech at `voiceVadProcessor.worklet.js:344-348`); min speech 250 ms (`useVoiceCallController.ts:144`).

### 2.2 Engine intake (FACT, `engine.py:2000-2284`)

`accept_segment` (per segment, in the route's request task):

1. `store.get_session(...)` ownership/active check (`:2024-2032`); runtime lookup (`:2033-2035`).
2. `sha256(audio_bytes)` must equal the form's `audio_sha256` (`:2037-2039`); idempotency key must match (`:2040`, `:3847-3852`).
3. Per-call in-flight cap `MAX_INFLIGHT_SEGMENTS_PER_CALL = 3` → `VoiceSegmentCapacityError` (HTTP 429) (`:83, 2041-2042`).
4. **Pre-warms while STT runs**: `_warm_call_moderation` (classifier plan) and `_warm_call_speech` (re-open the TTS socket) (`:2043-2044`, `:3267-3291`).
5. `touch_call` (quota reservation touch, DB) (`:2050`, `:1070-1078`).
6. `async with runtime.intake_lock:` → `_intake_segment` (`:2051-2061`). **Intake (DB bookkeeping + VAD + STT + STT billing) is serialized per call.**
7. Inside `_intake_segment`:
   - `find_segment` (dedupe by `(voice_session_id, seq, role="user")`) → duplicate result (`:2124-2126`).
   - `create_segment(status="received")` (+ `IntegrityError` race → duplicate) (`:2127-2144`).
   - WS ack `received` (`:2157-2160`).
   - `validate_voice_segment(...)` (server VAD) (`:2161-2175`); on error → `update_segment(rejected)`, WS ack `rejected`, observability `voice_segment_rejected stage=validation` (`:2176-2203`).
   - `update_segment(status="accepted", vad_summary)` + WS ack `accepted` + `voice_segment_received` event (`:2205-2210`).
   - Build `VoiceAudioSegment` (`:2212-2224`) and **`await self.stt_client.transcribe_segment(audio_segment, language=runtime.stt_language, prompt=runtime.stt_prompt)`** (`:2228-2230`). No try/except around it.
   - `voice_stt_completed` event with `latency_ms` (`:2233-2242`).
   - If `transcript.duration_ms > 0`: **`_record_billable_audio(kind="stt")`** (DB credit ledger + billing metadata) (`:2243-2251`, `:3378-3440`) — before the no-speech check.
   - If `transcript.is_empty or duration == 0` → `update_segment(rejected, no_speech)`, event `voice_segment_rejected stage=stt` (`:2252-2272`).
   - `sanitize_transcript_text` (`:2274`) → `update_segment(completed, transcript_text, stt_summary)` (`:2275-2281`) → cancelled check (`:2282-2283`).
8. Back in `accept_segment`: supersede the previous turn (keep heard prefix, cancel, wait), and **merge** the previous unadmitted turn's user text with this one (`:2066-2088`); then `_run_voice_turn` (LLM + TTS) (`:2092-2104`).
9. The user's `transcript_final` frame is sent to the client only when the LLM admits the turn (`VoiceLlmTurnStarted`) (`:2571-2595`).

### 2.3 Server VAD gate (FACT, `server_vad.py`)

`validate_voice_segment` (`:312-323`):

- `_validate_common` (`:207-219`): non-empty, `byte_length <= max_segment_bytes` (2,000,000), client-declared `duration_ms >= 250` and `<= max_segment_duration_ms` (30,000).
- Only `audio/wav` base type is accepted (`:319-322`); WebM/Opus explicitly removed (tests `test_server_vad.py:223-236`).
- `_validate_wav` (`:250-309`): RIFF/WAVE chunk walk (`:133-166`), PCM (`audio_format == 1`), 16 kHz, mono, 16-bit, metadata vs header cross-check; recomputes duration from samples and requires `|declared - actual| <= 500 ms` (`:285-286`).
- `_pcm16_stats` (`:178-204`): vectorised RMS, peak, speech-sample ratio (threshold 0.015 FS = 491/32767).
- `_validate_energy` (`:222-247`): **energy gate OFF by default** (`vad_energy_gate_enabled=False`); only rejects `peak < 0.002` (≈ -54 dBFS, "digital silence"). Strict gate (rms ≥ 0.012, peak ≥ 0.025, ratio ≥ 0.03) is opt-in.
- It is **not** a voice-activity detector in the ML sense: no Silero/WebRTC VAD, no trimming, no speech-duration estimate beyond an amplitude threshold.

Measured CPU cost of `_pcm16_stats` (local venv, Python 3.13; synchronous on the event loop): 3 s → 3.3 ms, 7.5 s → 7.9 ms, 30 s → 33.5 ms, 62.5 s (byte limit) → 65.6 ms (≈1.1 ms per audio second). (FACT, measured in this audit with `.venv/bin/python`.)

### 2.4 Groq adapter (FACT, `stt_groq_client.py`)

- Batch only: docstring "Groq STT is not streaming in v1. Each accepted VAD segment is submitted as a single multipart request and returns a final transcript/no-speech signal" (`:36-39`). `.env.example:656-658` repeats "request/response HTTP multipart only — no streaming, no partial transcripts".
- Guards per call: voice enabled, provider `groq`, model **must equal** `whisper-large-v3`, key present (`:59-64`).
- Request (`:66-98`): `POST {VOICE_STT_BASE_URL}/audio/transcriptions` (`config.py:396-400`), multipart:
  - `model=whisper-large-v3`, `response_format=verbose_json`, `timestamp_granularities[]=segment`
  - `language=<primary subtag>` only when a valid hint exists (`_stt_language` → `normalize_language_code`, `:149-151`; `speech/types.py:129-139` accepts any 2-3 letter subtag)
  - `prompt=<names>` only when 1..200 chars after whitespace collapse (`:154-159`)
  - `file=(voice-{voice_session_id}-{seq}.wav, bytes, "audio/wav")` (`stt.py:75-77`, `:497-505`)
  - **no `temperature`** (provider default 0), no word timestamps.
  - Headers: `Authorization: Bearer <GROQ_API_KEY>`, `Accept: application/json`.
- HTTP client: one `httpx.AsyncClient` per engine, created lazily on first use (`:139-145`), `follow_redirects=False`, default limits (no explicit `Limits`, no HTTP/2). httpx 0.28.1 defaults: `keepalive_expiry=5.0` s, `DEFAULT_LIMITS = Limits(max_connections=100, max_keepalive_connections=20)` (`.venv/lib/python3.13/site-packages/httpx/_config.py:178, 247`). Built once per process via `build_default_voice_call_engine` → `build_stt_client(config=config)` (`engine.py:3792`); closed on shutdown (`engine.py:1809`).
- Timeout (`:548-556`): with default 30 s → `connect=5, read=30, write=30, pool=5`. No overall deadline (httpx `read` is per-read inactivity). **No retry, no hedging, no circuit breaker, no fallback provider.**
- Errors (`:99-108, 517-545`): `TimeoutException` → `stt_timeout`; other `RequestError` → `provider_submission`; 429 → `stt_rate_limited` (+ `Retry-After` integer seconds, capped 86,400, `:559-567`); 408 → `stt_timeout`; 5xx/other 4xx → `provider_submission`. HTTP error bodies are logged redacted/truncated (`:508-522`); timeouts and connection errors are **not** logged by the adapter.
- Response parsing (`:340-415`): strict typed parse of `text`, `duration`, `segments[*].{avg_logprob, compression_ratio, no_speech_prob}` (required); optional segment fields type-checked; `x_groq.id` required if `x_groq` present → hashed (`:192-197`). Aggregates: `no_speech_prob = max`, `avg_logprob = mean`, `compression_ratio = max` over segments.
- No-speech / hallucination verdict `_likely_no_speech_reason` (`:278-300`):
  1. empty text → ordinary no-speech (`is_empty`).
  2. **every** decode segment has `no_speech_prob > 0.6 AND avg_logprob < -1.0` → `no_speech_prob` (Whisper defaults, `:223-224`).
  3. **any** segment `compression_ratio > 2.4` → `compression_ratio` (`:225, 287-288`). Comment: "Whisper retries at a higher temperature; with a single provider attempt the transcript is rejected instead" (`:220-222`).
  4. Only when exactly 1 decode segment: whole transcript equals the prompt (names) → `hallucination_phrase` (`:292-295`); credit phrases/prefixes (en/es) + "amara org" → always dropped (`:234-262, 296-297`); short conversational phrases ("you", "thank you", "bye", "gracias", …) dropped only if low confidence (`no_speech_prob >= 0.3` or `avg_logprob <= -0.5`) (`:263-275, 298-310`). Keys are case/accent/punctuation-insensitive (`:313-317`).
  - A rejected transcript carries no text; only the reason is logged (`:172-178`).
- Privacy: raw audio excluded from repr (`stt.py:54`), provider request id hashed, secrets redacted (`errors.py:77-101`).

### 2.5 Language and vocabulary (FACT)

- Call language resolved once at call start: `_resolve_call_voice` → `resolver.resolve_detail(...).language`; `stt_language = call_language` (`route_voice_call.py:555-614`). Resolver order: **turn language (last chat turn) → voice language → user preferred language → None** (`speech/resolver.py:734-745`). Fixed for the whole call ("R1-BE-04", `engine.py:602-604, 2225-2229`).
- `stt_prompt` = `call_stt_prompt(character.name, persona.name)` → e.g. `"Lyra Emberwick, Aria."`; deduped case-insensitively; returns `None` if > 200 chars (`stt.py:21-41`, `route_voice_call.py:701-711`).
- The language Groq returns (`SttTranscript.language`) is not used anywhere downstream (grep: no consumer of `transcript.language`).

### 2.6 Post-STT transcript sanitizing (FACT, `transcript_sanitizer.py:240-300`)

Strips control chars; collapses whitespace; empty → `no_speech`; private-payload shapes → fatal `conflict`; role markers neutralised; injection hints only flagged; `> 4000` chars → fatal `upstream_contract` (`:11, 287-292`).

### 2.7 Billing of STT audio (FACT)

STT seconds are charged to the user as call audio: `_record_billable_audio(kind="stt", audio_ms=transcript.duration_ms)` (`engine.py:2243-2251`), 1 credit per 10 s of STT+TTS audio (`engine.py:81, 3398`), DB write via `billing_service.record_call_usage` and `_persist_billing_metadata` under `runtime.billing_lock` (`:3389-3421`). Charged even when the segment is then rejected as no-speech (billing at `:2244` precedes the `is_empty` check at `:2252`), except when Groq reports `duration == 0` (test `test_voice_call_lifecycle.py` "zero_stt_duration_is_no_speech_and_not_billed").

---

## 3. Frames / data formats on the STT path

| Item | Format | Source |
|---|---|---|
| Upload audio | WAV RIFF, PCM s16le, 16,000 Hz, 1 ch (32 KB/s; 3 s ≈ 96 KB) | `stt.py:14-16`, `route_voice_call.py:115, 1185` |
| Upload metadata | multipart fields + `vad_json` (allowed keys: speech_ms, silence_ms, rms, peak, source, aggressiveness, speech_ratio, speech_end_lag_ms) | `engine.py:3860-3862` |
| WS acks | `voice_segment_ack` status `received` → `accepted` / `rejected` (validation only) | `engine.py:2157-2209` |
| HTTP response | `VoiceSegmentResult.as_response()` status `accepted/duplicate/rejected/cancelled` + reason | `engine.py:176-201` |
| Groq request | multipart `model, response_format=verbose_json, timestamp_granularities[]=segment, [language], [prompt], file` | `stt_groq_client.py:66-84` |
| Groq response | verbose_json `{task, language, duration, text, segments[{id, seek, start, end, text, tokens, temperature, avg_logprob, compression_ratio, no_speech_prob}], x_groq{id}}` | `stt_groq_client.py:340-415` |
| Stored | `voice_transcript_segment` row: status, transcript_text, vad_summary, stt_summary (no audio) | `engine.py:2128-2138, 2275-2281` |
| User transcript to client | `transcript_final` frame, sent at LLM admission | `engine.py:2586-2595` |

## 4. Segment state machine (FACT)

```
(no row) --create--> received --VAD ok--> accepted --STT ok + sanitize--> completed --(turn)--> ...
                         |                    |                   \--cancel_event--> cancelled
                         |                    |--STT empty/hallucination--> rejected(no_speech)
                         |--VAD error--> rejected(<category>)
                                              |--STT exception / sanitize fatal --> (stays "accepted" forever)  <-- gap
duplicate seq --> HTTP "duplicate" with stored status (any state, including stuck "accepted")
```

## 5. Configuration and defaults

| Setting | Default | Defined at | Notes |
|---|---|---|---|
| `VOICE_STT_PROVIDER` | `groq` (only value allowed) | `config.py:91, 120-121` | |
| `VOICE_STT_MODEL` | `whisper-large-v3` (only value allowed) | `config.py:20, 92, 122-125`; re-checked `stt_groq_client.py:61`; `availability_issues` `config.py:417-418` | turbo impossible without code change |
| `VOICE_STT_BASE_URL` | `https://api.groq.com/openai/v1` | `config.py:19, 93, 129-134` | `http` also accepted |
| `VOICE_STT_TIMEOUT_SECONDS` | 30.0 (0.1..120) | `config.py:47, 49, 94` | → connect 5 / read 30 / write 30 / pool 5 (`stt_groq_client.py:548-556`) |
| `GROQ_API_KEY` | none | `config.py:95` | required when enabled |
| `VOICE_MAX_SEGMENT_DURATION_MS` | 30,000 (min 250) | `config.py:42, 101` | client cuts at 7,500 |
| `VOICE_MAX_SEGMENT_BYTES` | 2,000,000 | `config.py:43, 102` | ≈ 62.5 s PCM16 |
| min segment duration | 250 ms (hard-coded) | `server_vad.py:21` | client minSpeech 250 ms |
| duration tolerance | 500 ms | `server_vad.py:37` | |
| `VOICE_VAD_ENERGY_GATE_ENABLED` | false | `config.py:111` | |
| `VOICE_VAD_SILENCE_FLOOR_PEAK` | 0.002 | `config.py:112`, `server_vad.py:32` | the only active energy check |
| `VOICE_VAD_MIN_RMS / MIN_PEAK / MIN_SPEECH_RATIO` | 0.012 / 0.025 / 0.03 | `config.py:113-115` | only with strict gate |
| speech sample threshold | 0.015 FS | `server_vad.py:36` | |
| No-speech thresholds | no_speech_prob > 0.6 AND avg_logprob < -1.0 (all segments) | `stt_groq_client.py:223-224` | Whisper defaults |
| Compression ratio threshold | > 2.4 (any segment) → reject | `stt_groq_client.py:225` | Whisper uses this to trigger a retry, not to reject |
| Low-confidence for conversational phrases | no_speech_prob ≥ 0.3 or avg_logprob ≤ -0.5 | `stt_groq_client.py:232-233` | |
| STT prompt max | 200 chars (else dropped) | `stt.py:22, 41`; `stt_groq_client.py:159` | Whisper limit 224 tokens |
| Transcript max | 4,000 chars (fatal beyond) | `transcript_sanitizer.py:11, 287-292` | |
| In-flight segments per call | 3 | `engine.py:83` | |
| End-call drain | 2.0 s | `engine.py:90` | |
| Credits | 1 per 10 s of STT+TTS audio | `engine.py:81` | |
| Global concurrency | 8 calls | `config.py:41` | |
| httpx keep-alive expiry | 5.0 s (library default) | `httpx/_config.py:178` | not overridden |
| Effective dev `.env` | `VOICE_MODE_ENABLED=true`, STT settings unset (defaults) | backend `.env` (keys not read) | |

Provider facts (Groq docs, fetched 2026-10-20, https://console.groq.com/docs/speech-to-text and /docs/rate-limits):

- `whisper-large-v3`: $0.111/hour, WER 10.3%, speed factor 189x. `whisper-large-v3-turbo`: $0.04/hour, WER 12%, speed factor 216x, transcription only.
- **Minimum billed length: 10 seconds per request.** Max file 25 MB (free) / 100 MB (dev). `prompt` max 224 tokens; `temperature` default 0; `language` ISO-639-1 "improves accuracy and latency"; WAV suggested for lower latency.
- Rate limits shown for both Whisper models: 20 RPM, 2K RPD, 7.2K audio-seconds/hour, 28.8K audio-seconds/day (page does not clearly say which tier). `retry-after` only on 429.

---

## 6. Latency on the critical path (user stops speaking → STT text ready → LLM start)

The STT subsystem owns steps 3-7. Steps 1-2 are listed for context (owned by the frontend/transport audits).

| # | Stage | Estimate (ms) | Evidence | Reasoning |
|---|---|---|---|---|
| 1 | Client VAD silence hang-over | 550 (constant) | `CallScreen.tsx:114` | fixed silence before segment is cut (context) |
| 2 | Browser → BFF upload of WAV (after speech end) | 10-800 | `route_voice_call.py:1159, 1177`; `stt.py:14-16` | 32 KB/s PCM: 3 s = 96 KB; ~40 ms at 20 Mbit/s up, ~150 ms at 5 Mbit/s, ~770 ms at 1 Mbit/s; plus 1 RTT. Opus would be ~10x smaller (INFERENCE) |
| 3 | Route pre-checks before body parse (auth cache, workspace, chat, consent 1-2 queries, form parse) | 5-40 | `route_voice_call.py:1141-1159`; `admission.py:141-145` | 4-6 sequential DB reads (INFERENCE; DB RTT not measured) |
| 4 | Engine pre-STT bookkeeping (get_session, touch_call, find_segment, create_segment, 2 WS acks, sha256, WAV stats, update accepted) | 5-50 | `engine.py:2024, 2037, 2050, 2124-2209`; VAD measured 3.3 ms per 3 s | 5 DB round trips + 2 socket sends, serialized under `intake_lock` |
| 5 | Groq connection re-establishment (pooled connection expired after 5 s idle) | 20-150 | `stt_groq_client.py:139-145`; `httpx/_config.py:178` | users rarely speak within 5 s of their previous upload because the character talks in between → new TCP + TLS (2 RTT) + DNS most turns (INFERENCE) |
| 6 | Groq transcription request (upload ~96 KB + inference + JSON) | 150-500 typical p50; tail up to 30,000 | `stt_groq_client.py:90-109` | Groq inference at ~189x real time is ~15-30 ms for 3-5 s; remainder is network/queueing (INFERENCE; **no measured production number exists** — `voice_stt_completed.latency_ms` is logged but not aggregated) |
| 7 | Post-STT billing + segment completion (record_call_usage, persist billing metadata, update completed) | 5-40 | `engine.py:2243-2251, 2275-2281, 3389-3421` | 2-4 DB writes under `billing_lock` (may wait behind TTS billing of the playing turn) |
| — | **STT subsystem share (3-7)** | **~200-800 typical** | | excludes steps 1-2 and LLM/TTS |

No stage of the STT can start before end-of-speech + hang-over + full upload, because there is no streaming STT and no audio streaming during speech (`stt_groq_client.py:36-39`; `interfaces.py:95-98`).

Existing metrics that cover this path: `call_user_stop_to_first_audio_ms` and `call_segment_to_first_audio_ms` histograms (`speech/metrics.py:56, 562-565`). There is no STT-stage histogram (see BE-STT-09).

## 7. Cost per minute (INFERENCE from Groq pricing)

- large-v3: $0.111/h = $0.00185 per billed audio minute; **10 s floor** → ≥ $0.000308 per request.
- A call minute typically yields 4-8 segments with a 550 ms hang-over (pauses split utterances; the server merges them, `engine.py:2075-2088`) → 40-80 billed seconds ≈ **$0.0012-0.0025 per call minute**, even when the user actually spoke 15-25 s (2-4x overbilling vs actual audio).
- turbo: $0.04/h → ≈ $0.0004-0.0009 per call minute.
- STT is a small fraction of total call cost (TTS dominates), so STT cost is not the main lever; latency and robustness are.
- The app charges users by *actual* STT duration (`engine.py:2243-2251`), not the provider's 10 s floor; roadmap already lists "tracking Groq's 10 s per-request STT billing floor" (`docs/voice_refactor/00_current_status_and_roadmap.md:95`).

---

## 8. Findings

### BE-STT-01 · high · latency — Batch-only STT after end of speech; no streaming, no partial transcripts
- FACT: "Groq STT is not streaming in v1. Each accepted VAD segment is submitted as a single multipart request" (`stt_groq_client.py:36-39`); `.env.example:656-658` ("no streaming, no partial transcripts, no provider WebSocket"). `RealtimeSpeechToTextProvider` is "Declared only; unimplemented until D07 stage 2 (S-19)" (`speech/interfaces.py:95-98`). The engine awaits a single final transcript (`engine.py:2228-2230`).
- Impact: the whole STT round trip (step 5-6 above, ~200-650 ms) plus the full-audio upload sits serially after the 550 ms hang-over. SOTA streaming STT (Deepgram Nova-3/Flux, AssemblyAI Universal-Streaming, ElevenLabs Scribe v2 Realtime, Soniox, Speechmatics, gpt-4o-transcribe streaming) finalizes ~100-300 ms after speech ends because audio was decoded incrementally, and exposes partials for semantic end-of-turn and speculative LLM start.
- Recommendation: (a) stream PCM/Opus frames over the existing call WebSocket during speech; (b) implement `RealtimeSpeechToTextProvider` behind the existing seam with one streaming vendor; (c) interim option without a vendor change: **speculative batch STT** — start the Groq request at a short silence (~200-250 ms) and reuse it if no further speech arrives before the 550 ms hang-over, discarding it otherwise (cuts ~300 ms off p50). Use partials/finals to drive a semantic turn detector.
- Confidence: high.

### BE-STT-02 · high · robustness — 30 s STT timeout, no retry, no fallback, no circuit breaker: a Groq stall means up to 30 s of dead air and a lost utterance
- FACT: default `VOICE_STT_TIMEOUT_SECONDS = 30.0` (`config.py:47`) → `read=30, write=30` (`stt_groq_client.py:548-556`), no total deadline. One attempt only; `TimeoutException`/`RequestError`/5xx/429 are raised straight out (`:99-108, 517-545`). `_intake_segment` has no except around STT (`engine.py:2228`); `accept_segment` only has `finally` (`:2105-2110`); the route converts to HTTP 504/502/429 (`route_voice_call.py:1222-1223`, `admission.py:107-113`). The client resends only on a network `TypeError`, never on 5xx/504 (`useVoiceCallController.ts:597-608`), and shows a notice (`:612-615`). A resend with the same `seq` would be answered `duplicate` from the stuck row (`engine.py:2124-2126, 3811-3827`), so even a correct client retry cannot recover the utterance. While the stalled STT holds `intake_lock`, every later segment of the call queues behind it (`engine.py:2051`). No breaker exists for Groq (grep of `voice_orchestration/*.py` finds none).
- Impact: a transient Groq slowdown (p99 tail, 5xx, 429) makes the character go silent for up to 30 s and drops what the user said; the user must notice and repeat.
- Recommendation: total STT budget ~3-5 s (≈ 5-10x p95), one immediate retry on connect errors/5xx, a hedged second request after ~1.5 s (or to `whisper-large-v3-turbo`/a second provider), a process breaker that fails fast and surfaces a spoken/visual "didn't catch that" cue, and a server-side retry path (keep the audio bytes for the retry within the request).
- Confidence: high.

### BE-STT-03 · medium · robustness — STT exceptions leave the segment row "accepted" forever and record no event
- FACT: status becomes `accepted` before STT (`engine.py:2205`); on STT/sanitizer exception nothing updates it (no except, `:2228-2281`); `_cancelled_segment`/`_fail_turn` only run after intake (`:2286-2290, 2783`). No `voice_segment_rejected`/`voice_turn_failed` event is emitted for an STT failure; the adapter logs HTTP-status failures (`stt_groq_client.py:522`) but not timeouts or connection errors (`:99-108`). The duplicate path then returns `reason="accepted"` for that seq forever (`engine.py:3815-3823`).
- Impact: orphan rows, transcript gaps without an error marker, and STT outages invisible to the metrics monitor.
- Recommendation: wrap STT in try/except → `update_segment(status="failed", error_category=...)`, record `voice_segment_rejected stage=stt category=<stt_*>` and a provider event; test it (no engine test covers an STT exception; `test_voice_call_lifecycle.py` only blocks STT).
- Confidence: high.

### BE-STT-04 · medium · latency — Groq connection is re-established on most turns (httpx 5 s keep-alive, lazy client, no prewarm)
- FACT: the client is created lazily on the first request with library defaults (`stt_groq_client.py:139-145`); httpx 0.28.1 `keepalive_expiry=5.0` (`.venv/lib/python3.13/site-packages/httpx/_config.py:178, 247`). No warm-up at call start or on client `speech_start` — `_warm_call_speech`/`_warm_call_moderation` warm TTS and moderation only (`engine.py:2043-2044, 3267-3291`). The `voice_segment_meta` WS frame exists server-side but only echoes a status (`route_voice_call.py:1544-1548`) and the SPA never sends it (grep).
- Impact (INFERENCE): between user utterances the character usually talks > 5 s, so the pooled TLS connection is gone; each turn pays DNS + TCP + TLS (2+ RTT, ~20-150 ms) on the critical path; the first turn of each process also pays client creation.
- Recommendation: create the client at startup with `httpx.Limits(keepalive_expiry=60-120)` (and optionally HTTP/2), warm it at `voice_start`, and send a lightweight `speech_start` WS frame from the client to (re)warm STT (and LLM context) while the user is still talking. Roadmap item L-04 "a shared HTTP client" (`docs/voice_refactor/00_current_status_and_roadmap.md:81`) covers part of this.
- Confidence: medium (RTT not measured).

### BE-STT-05 · medium · latency — 8-12 sequential DB round trips and STT billing sit on the critical path around STT, serialized per call
- FACT: route reads before body (`route_voice_call.py:1144-1157`); engine `get_session` (`engine.py:2024`), `touch_call` (`:2050`), `find_segment` (`:2124`), `create_segment` (`:2128`), `update_segment(accepted)` (`:2205`), STT, then `record_call_usage` + `_persist_billing_metadata` (`:2244-2251, 3404-3421`) and `update_segment(completed)` (`:2275`) — all awaited before `_run_voice_turn`, all inside `intake_lock` (`:2051`). STT billing also takes `billing_lock`, shared with the playing turn's TTS billing (`:3389`).
- Impact (INFERENCE): 15-90 ms with a local MySQL; several hundred ms with a remote/managed DB or under load. Roadmap L-04 already proposes "fewer DB round trips and STT billing off the critical path".
- Recommendation: start the LLM turn right after the transcript is known; persist segment status and STT billing concurrently (`asyncio.create_task` with a join before turn completion), fold `find_segment`+`create_segment` into one `INSERT ... ON DUPLICATE KEY`, and cache consent/workspace per call (they are re-read on every segment).
- Confidence: medium.

### BE-STT-06 · medium · correctness — `compression_ratio > 2.4` silently discards genuine repetitive speech (laughter, chants, "sí, sí, sí")
- FACT: any decode segment with ratio > 2.4 → whole transcript rejected as `no_speech` (`stt_groq_client.py:225, 287-288`); comment admits Whisper would instead retry at a higher temperature (`:220-222`). The client treats `no_speech` as silent (`useVoiceCallController.ts:179, 553`).
- Evidence computed in this audit (zlib ratio, the same metric Whisper uses): "Ha ha ha …" ×12 → 2.47; "Run! Run! …" ×10 → 3.12; "Sí, sí, …" ×9 → 2.50; "la la …" ×20 → 4.0; "I want to open the gate." → 0.76.
- Impact: in a roleplay companion app, laughing, chanting, singing or emphatic repetition produce no reply and no feedback; it looks like the call is broken. Also a repetition loop at the end of a long real utterance discards the real part.
- Recommendation: on high ratio, retry once at `temperature=0.2-0.4` (Whisper's own fallback), or keep the transcript but collapse the repetition, and only drop it when also low-confidence (`avg_logprob < -1`) or very short duration; never silently drop — show "didn't catch that".
- Confidence: medium (ratios computed on representative text; real Groq segmentation may differ).

### BE-STT-07 · medium · correctness — STT language is forced for the whole call; mid-call language switch and mismatched hints are silently mistranscribed
- FACT: `stt_language = call_language` resolved once (turn language → voice language → preferred) (`route_voice_call.py:592-609`, `speech/resolver.py:734-745`) and sent on every request (`engine.py:2228-2230`, `stt_groq_client.py:71-73`). Groq's detected `language` is parsed but never used (no consumer). Any 2-3 letter subtag passes `normalize_language_code` (`speech/types.py:129-139`) though Groq accepts ISO-639-1 only.
- Impact (INFERENCE, known Whisper behaviour): with `language=en` forced, Spanish speech is typically output as an English translation or garbled text; the LLM then answers the wrong content. A 3-letter catalog code (e.g. `fil`) would make every segment of the call fail with HTTP 400 → `provider_submission`.
- Recommendation: keep forcing (it helps short clips) but verify: if `avg_logprob` is low, re-run once without `language` and switch the call's STT language when the detected language is confident on 2 consecutive segments; restrict the hint to an allow-list of Whisper ISO-639-1 codes.
- Confidence: medium.

### BE-STT-08 · medium · audio-quality — The server "VAD" lets almost everything through to Whisper; no neural VAD, no trimming
- FACT: energy gate OFF by default (`config.py:107-115`, `server_vad.py:25-36`); the only content check is `peak < 0.002` (`server_vad.py:243-247`). The client VAD is RMS-based with hysteresis (`voiceVadProcessor.worklet.js:14-18`).
- Impact: every client false trigger (cough, keyboard, TV, music, leaked TTS) becomes a billed Groq request (10 s floor) and a hallucination risk handled only by the phrase/threshold heuristics; such segments are also charged to the user (BE-STT-12).
- Recommendation: run Silero VAD (ONNX, ~1 ms per 30 ms frame on CPU) server-side on each segment: reject segments with < ~200 ms of detected speech, trim leading/trailing non-speech before upload to Groq (reduces hallucinations), and record speech-ms for tuning. Roadmap lists "a neural VAD (for example Silero)" (`00_current_status_and_roadmap.md:95`).
- Confidence: high.

### BE-STT-09 · medium · observability — No STT latency histogram, error/429 counters or no-speech rate
- FACT: the metrics feed handles only `voice_call_started/ended, voice_turn_audio, voice_first_assistant_audio, voice_turn_failed, …` (`speech/metrics.py:756-769`); `voice_stt_completed` and `voice_segment_rejected` (`engine.py:2233-2242, 2259-2271`) are log-only. The Groq adapter emits no `provider_request` event, so `provider_errors`/`provider_429` (`metrics.py:61`) never include STT. STT exceptions record nothing (BE-STT-03).
- Impact: STT p50/p95, timeouts, rate-limit pressure, and hallucination-filter firing rates cannot be monitored or alerted; roadmap V-05 notes stage measurements are still missing.
- Recommendation: emit `provider_request` (provider=groq, surface=call, latency, status, 429) and feed `call_stt_ms`, `call_stt_failures`, `call_no_speech_by_reason` (no_speech_prob / compression_ratio / hallucination_phrase / empty / validation) and segment duration histograms; persist a per-turn timing summary (roadmap L-12).
- Confidence: high.

### BE-STT-10 · medium · latency/UX — Uncompressed WAV is the only accepted format and is uploaded only after speech ends
- FACT: `VOICE_PCM_WAV_CONTENT_TYPE = "audio/wav;codec=pcm_s16le"` enforced in `VoiceAudioSegment.__post_init__` (`stt.py:14-16, 63-69`), the route (`route_voice_call.py:1180-1186`) and VAD (`server_vad.py:319-322`); WebM/Opus explicitly removed (`test_server_vad.py:223-236`). Groq itself accepts flac/ogg/webm (Groq docs).
- Impact (INFERENCE): 256 kbit/s upload after end-of-speech is on the critical path; on mobile uplinks a 3-5 s utterance takes 150-800 ms to upload, then is re-uploaded BFF → Groq.
- Recommendation: short term accept Ogg/Opus (or FLAC) and forward it to Groq as-is; long term stream frames during speech (see BE-STT-01) so only the last ~100 ms remains at end-of-turn.
- Confidence: medium.

### BE-STT-11 · medium · ux — The user sees what was heard only after the LLM admits the turn; no partials
- FACT: `transcript_final` is sent inside the `VoiceLlmTurnStarted` branch (`engine.py:2571-2595`), i.e. after STT, billing, supersede and the LLM service's admission (user message persisted). Roadmap V-07 lists "Earlier transcript delivery" (`00_current_status_and_roadmap.md:83`).
- Impact: users get no confirmation that they were heard during the slowest part of the turn; mis-hearings are discovered late.
- Recommendation: send a provisional `transcript_final` (or `transcript_interim`) as soon as `_intake_segment` returns, and a correction/merge frame on supersede.
- Confidence: high.

### BE-STT-12 · low · cost — Groq's 10 s per-request floor and the pinned large-v3 model; users are charged for no-speech segments
- FACT: model pinned in three places (`config.py:122-125, 417-418`; `stt_groq_client.py:61`). STT billing happens before the no-speech check (`engine.py:2243-2252`), so noise/hallucination-rejected segments consume user credits. Short segments down to 250 ms are allowed (`server_vad.py:21`).
- Impact (INFERENCE): provider cost per call minute ≈ 2-4x actual speech; turbo would cut it ~2.8x and is slightly faster; users in noisy rooms lose credits with no reply.
- Recommendation: evaluate `whisper-large-v3-turbo` on es/en roleplay samples (roadmap L-06); do not charge users for `no_speech` outcomes; track billed (10 s floor) vs actual seconds; drop sub-300 ms segments server-side (roadmap suggestion).
- Confidence: high for the facts, medium for the ratios.

### BE-STT-13 · low · audio-quality — Vocabulary prompt is thin and static
- FACT: prompt = character + persona names only, fixed at call start (`stt.py:25-41`, `route_voice_call.py:704-711`); dropped entirely (not truncated) above 200 chars (`stt.py:41`). When an utterance is split (550 ms pause or 7.5 s cut), the second piece is transcribed without the first piece's text as context; the texts are concatenated afterwards (`engine.py:2075-2088`).
- Impact: invented world/item/place names and words cut at the 7.5 s boundary (`voiceVadProcessor.worklet.js:344-348`) are mis-recognised more often.
- Recommendation: prompt = names + key lore terms (top-N from the world/lorebook) + the tail of the previous unadmitted segment's transcript (Whisper's documented continuity technique), truncated by tokens rather than dropped; cut long segments at a low-energy point instead of a hard 7.5 s boundary.
- Confidence: medium.

### BE-STT-14 · low · scalability — Groq rate limits vs. call concurrency; no queue/backoff
- FACT: `VOICE_GLOBAL_CONCURRENCY` default 8 (`config.py:41`); 429 maps to a user-facing `stt_rate_limited` with `Retry-After` (`stt_groq_client.py:524-530`); no server-side backoff. Groq docs list 20 RPM / 7.2K audio-s per hour for Whisper (tier not stated).
- Impact (INFERENCE): 8 calls × 6-10 segments/min = 48-80 RPM — beyond a 20 RPM tier; if the 10 s floor counts toward audio-seconds limits, 7.2K ASH allows only ~720 requests/hour. Roadmap already requires checking limits before raising concurrency (`00_current_status_and_roadmap.md:93`).
- Recommendation: confirm the org tier; read `x-ratelimit-*` headers into a token bucket that queues briefly or fails over; alarm on 429 share (needs BE-STT-09).
- Confidence: medium (tier UNKNOWN).

### BE-STT-15 · low · correctness — Prompt read-back detection only matches the whole prompt
- FACT: `if prompt and phrase == _hallucination_key(prompt)` and only for single-segment transcripts (`stt_groq_client.py:289-295`).
- Impact: a partial read-back ("Lyra Emberwick." from prompt "Lyra Emberwick, Aria.") over noise is accepted as user speech and triggers a reply.
- Recommendation: treat a transcript whose tokens are a subset of the prompt's tokens as read-back when confidence is low (`no_speech_prob ≥ 0.3` or `avg_logprob ≤ -0.5`).
- Confidence: medium.

### BE-STT-16 · low · robustness — Strict response contract turns benign provider changes into lost utterances
- FACT: per-segment `avg_logprob`, `compression_ratio`, `no_speech_prob` are required (`stt_groq_client.py:371-388`); `x_groq` present without `id` raises (`:392-399`); any violation → `upstream_contract` 502 (`:490-494`).
- Impact: if Groq omits a metric (e.g. for a model variant) or adds an `x_groq` shape without `id`, every utterance fails.
- Recommendation: keep the text strict, but degrade metrics to "unknown" (skip heuristics) and make `x_groq.id` optional; alert on contract drift instead of failing the turn.
- Confidence: medium.

### BE-STT-17 · low · robustness — In-flight STT is not cancelled on call end; late results are billed after quota release
- FACT: `end_call` cancels turns via `cancel_event` and drains for only 2 s (`engine.py:90, 1129-1133, 1883-1894`), then releases quota with the current `billable_audio_seconds` (`:1135-1141`). The STT request itself is not cancelled; when it returns, `_record_billable_audio` runs without checking `runtime.ending` (`:2243-2251, 3378-3425`).
- Impact (INFERENCE): a slow STT finishing after end-of-call charges credits and rewrites billing metadata after the session's consumed seconds were settled; provider cost is incurred for a call that already ended.
- Recommendation: cancel the STT task on end (`task.cancel()` around the HTTP call) and skip billing when `runtime.ending` and the turn is cancelled, or reconcile late charges explicitly.
- Confidence: low-medium.

### BE-STT-18 · low · security-privacy — STT base URL accepts plain http; session id leaks into the uploaded filename
- FACT: `schemes=frozenset({"http", "https"})` (`config.py:129-134, 292-297`) — the Bearer key would travel in clear if misconfigured. Filename sent to Groq is `voice-{voice_session_id}-{seq}.wav` (`stt.py:75-77`).
- Recommendation: require https unless an explicit dev flag is set; send a neutral filename (`segment.wav`).
- Confidence: high.

### BE-STT-19 · low · latency — WAV statistics run synchronously on the event loop
- FACT: `_pcm16_stats` is pure CPU in the request task (`server_vad.py:178-204`); measured ≈1.1 ms per audio second (3 s → 3.3 ms; 30 s → 33.5 ms; 62.5 s → 65.6 ms).
- Impact: small for the 7.5 s client cap (~8 ms) but it blocks every other call's frame forwarding in this single-process BFF; worst case ~65 ms for an adversarial 2 MB upload.
- Recommendation: lower the server cap to match the client (e.g. 10 s) or offload with `asyncio.to_thread` for long segments.
- Confidence: high.

### BE-STT-20 · info · maintainability — Stale cross-repo limits comment
- FACT: frontend says "the server rejects segments over 8 s" (`voiceVadWorklet.ts:17`) while the server default is 30,000 ms (`config.py:42`; live evidence `docs/audits/evidence/voice-presets-2026-10-17/application-call.json`, removed 2026-10-26 and kept in git at `77174215`, reports `max_segment_duration_ms = 30000`).
- Recommendation: align the comment/limit (a 10 s server limit would also bound BE-STT-19).

### BE-STT-21 · info · ux — STT verdict cannot protect against false barge-ins (cross-reference)
- FACT: no-speech is decided only after the full STT round trip (`engine.py:2252-2272`) while the client barge-in fires on VAD `speech_start` (`useVoiceCallController.ts:644-676`). A cough that STT later rejects has already cut the character off; there is no resume (roadmap "pause-then-confirm barge-in", `00_current_status_and_roadmap.md:95`).
- Recommendation: with streaming STT, confirm barge-in on the first non-empty partial (or ≥ N words) before truncating playback; until then, duck the audio instead of cancelling.

---

## 9. Strengths (things done well)

1. **Clean provider seam**: `SegmentSpeechToTextProvider` protocol + `build_stt_client` factory + neutral `transcribe()` (`stt.py:109-141`); a `RealtimeSpeechToTextProvider` seam is already declared (`interfaces.py:95-98`), so a streaming vendor can be added without touching the engine contract.
2. **Layered hallucination defence**: Whisper's own no-speech rule applied only when *all* decode windows agree (`stt_groq_client.py:282-286`); bilingual (en/es) credit-line phrases and prefixes incl. Amara.org; conversational phrases ("thank you", "gracias") dropped only when low-confidence so a real "thank you" survives; prompt read-back detection; accent/punctuation-insensitive matching; extensive unit tests (`test_groq_stt_client.py:497-660`).
3. **Vocabulary biasing** with character and persona names, normalised and deduplicated (`stt.py:25-41`), tested (`test_groq_stt_client.py:497-515`).
4. **Language hint** per call with primary-subtag normalisation and auto-detect fallback (`stt_groq_client.py:149-151`; `test_groq_stt_client.py:143-151`).
5. **Privacy by construction**: raw audio excluded from repr/logs and never persisted; hallucinated text never logged; provider request id hashed; secret redaction (Groq `gsk_` keys, Bearer, provider URLs, base64 audio) for errors and logs (`errors.py:77-101`); observability forbids transcript/audio fields (`observability.py:117-133`).
6. **Defence-in-depth input validation** before any provider call: admission/consent before parsing mic bytes, Content-Length pre-check, SHA-256 match, idempotency key, WAV header walk, exact format, metadata vs data cross-check (`route_voice_call.py:1136-1186`; `server_vad.py:133-309`).
7. **Idempotent segment intake** with race handling (`engine.py:2124-2144`) and a single safe client resend on network errors.
8. **Prewarming during STT**: TTS socket reopen and moderation plan resolution run concurrently with STT (`engine.py:2043-2044, 3267-3291`).
9. **Fast, exact PCM stats** (vectorised, verified against a reference loop) (`server_vad.py:186-204`; `test_server_vad.py:185-220`).
10. **Good segment shaping on the client** for Whisper: 300 ms pre-roll and trailing silence trimmed to 200 ms reduce clipped onsets and end-of-clip hallucinations (`voiceVadProcessor.worklet.js:313-324, 377-379`).
11. **Split-utterance merge**: a pause that splits an utterance supersedes the unadmitted turn and merges the text (`engine.py:2066-2088`).
12. **End-to-end user-stop metric** (`user_stop_ttfb_ms`) combining the client's speech-end lag with server time (`engine.py:2906-2910`; `metrics.py:56`).
13. **Opt-in live provider contract test** that checks latency recording and error sanitising against the real Groq API (`test_live_groq_stt_contract.py`).

## 10. Open questions / unknowns

1. Real Groq latency p50/p95/p99 from the deployment region for 2-5 s clips: `voice_stt_completed.latency_ms` is logged but never aggregated; no measured value exists in repo docs/evidence (UNKNOWN).
2. Groq org tier and actual RPM / audio-seconds limits; does the 10 s billing floor count toward the ASH/ASD limits? (UNKNOWN)
3. Network RTT between the BFF host and `api.groq.com` (determines the cost of BE-STT-04) (UNKNOWN).
4. Real-call rates of `no_speech` by reason (thresholds were never tuned on call data — roadmap item) and false-drop rate of genuine speech (UNKNOWN).
5. Does Groq apply Whisper's temperature fallback server-side when `temperature` is unset? (UNKNOWN; affects BE-STT-06)
6. How often do callers switch language mid-call or have a voice/preferred language different from what they speak? (UNKNOWN; BE-STT-07)
7. Does browser AEC reliably stop the character's own TTS from being uploaded on mobile/speakerphone? The server has no transcript-vs-recent-assistant-text echo filter (grep finds none) (UNKNOWN).
8. Is `whisper-large-v3-turbo` accuracy acceptable for es/en roleplay names (product decision L-06)? (UNKNOWN)
9. Product: should the user's own speech seconds (and rejected noise) consume call credits? (policy)
10. DB round-trip latency in production (local vs managed MySQL), which sizes BE-STT-05 (UNKNOWN).

## 11. External references used

- Groq Speech-to-Text docs: https://console.groq.com/docs/speech-to-text (models, pricing, 10 s minimum billing, prompt 224 tokens, temperature default 0, WAV for lower latency, verbose_json metadata).
- Groq rate limits: https://console.groq.com/docs/rate-limits (20 RPM / 2K RPD / 7.2K ASH / 28.8K ASD for Whisper; retry-after on 429).
- Streaming STT landscape (indicative, vendor-adjacent 2026 blogs): https://www.retellai.com/blog/best-speech-to-text-models ; https://futureagi.com/blog/best-voice-ai-june-2026/ ; https://futureagi.com/blog/best-voice-ai-may-2026/ ; https://www.stork.ai/blog/best-speech-to-text-api-developers-2026 (Deepgram Flux integrated end-of-turn < 300 ms median; Scribe v2 Realtime < 150 ms; AssemblyAI Universal-Streaming 300-600 ms; Deepgram streaming ≈ $0.0077/min). Treat these figures as indicative.
- In-repo intent: `docs/voice_refactor/00_current_status_and_roadmap.md:81, 83, 93, 95` (L-04 shared client / STT billing off path, L-06 language hint or turbo, V-07 streaming STT and earlier transcript, Groq 10 s floor, Silero VAD, threshold tuning).

## Verification (adversarial)

Second pass, 2026-10-20, read-only. Each cited line was re-opened. The verifier also looked for code that could contradict the finding: retries or deadlines around the STT call, cleanup sweeps, startup prewarm, metrics feeds, and tests. Paths are in `/home/andres/PycharmProjects/magic-worlds-api` unless marked FE (frontend).

| id | verdict | corrected severity | evidence / note |
|---|---|---|---|
| BE-STT-01 | confirmed | high | `stt_groq_client.py:36-39` (docstring: not streaming in v1); `.env.example:656-658`; `interfaces.py:95-98` (`RealtimeSpeechToTextProvider` "Declared only"). Grep finds no implementation of `open_stream` in voice code; the only hit is an unrelated Fish TTS socket. FE `CallScreen.tsx:114` sets `silenceMsToEnd: 550`. `engine.py:2228-2230` makes one awaited call per segment. Minor nuance: audio-only turn detectors do not need partial transcripts, but a speculative LLM start does. |
| BE-STT-02 | confirmed | high | `config.py:47` = 30.0 s (max 120). `_request_timeout` (`stt_groq_client.py:548-556`) sets per-phase limits (connect 5, read 30, write 30, pool 5) with no overall deadline. One `post` and no retry. Grep finds no `wait_for` or `asyncio.timeout` around intake in `engine.py`. The breakers in `speech/breakers.py` do not cover Groq. `admission.py:95-118` maps the errors to 504/502/429. `engine.py:3811-3827` returns `duplicate` with the stored `accepted` status. `intake_lock` is held across STT (`engine.py:2051`), and `MAX_INFLIGHT_SEGMENTS_PER_CALL=3` gives a 429 `busy` on the 4th segment. FE `useVoiceCallController.ts:597-615` resends only on `TypeError`. Correction: the user does see a non-fatal "upload failed" notice (`:616-619`), so the failure is not silent. |
| BE-STT-03 | confirmed | medium | `engine.py:2205` sets `accepted` before STT, and `:2228` has no try/except. The `finally` at `:2105-2110` only discards the turn in memory. No sweep exists: the only `UPDATE voice_transcript_segment` is the per-id update at `models.py:7807`, and the `failed`/`stt_processing` states it allows are never used for STT. `metrics.py` `call_turn_failure_categories_sql` counts only `status='failed'`, so these rows are invisible to it. `FakeGroqSttClient(fail=...)` exists in `tests/fakes/voice.py:84-99` but no test passes `fail=`, so no engine test covers an STT exception. The adapter logs only HTTP-status errors (`:517-522`). |
| BE-STT-04 | confirmed | medium | `stt_groq_client.py:139-145` creates the client lazily with no `limits` and no `http2`. httpx `_config.py:178` has `keepalive_expiry=5.0`. The only callers of `stt_client` in `engine.py` are construction (`:3792`), close (`:1809`) and transcribe (`:2228`): there is no warm-up. Only TTS and moderation warm-ups exist (`:3267-3291`). The SPA never sends `voice_segment_meta` (FE grep finds none, and `useVoiceCallController.ts:908-910` says no VAD frame is sent). The server handler only echoes a status frame (`route_voice_call.py:1544-1548`). Mitigation: the client is shared by every call in the process, so under concurrent load the pool may stay warm. The RTT cost remains unmeasured. |
| BE-STT-05 | confirmed | medium | Sequential awaits: route consent/workspace/chat (`route_voice_call.py:1144-1157`), `get_session` (`engine.py:2024`), `touch_call` (`:2050`), `find_segment`/`create_segment`/`update accepted` (`:2124-2205`), STT billing `record_call_usage` and `_persist_billing_metadata` (another `get_session` plus an update, `:3389-3421, 3438-3440`), and `update completed` (`:2275`). That is about 9 DB ops in the engine plus about 4 in the route, consistent with "8-12+". The `billing_lock` is shared with TTS billing (`bill_delivered_tts` at `:2345-2362`). Roadmap L-04 exists (`docs/voice_refactor/00_current_status_and_roadmap.md:81`). The latency figures are inference. |
| BE-STT-06 | adjusted | low | The mechanism is real: `stt_groq_client.py:287-288` uses `any` segment above 2.4, which rejects the whole transcript, and FE `SILENT_REJECTIONS` hides `no_speech` (`useVoiceCallController.ts:179, 553`). The examples overstate it. Re-computed zlib ratios: "Sí, sí, sí." = 0.83, 6x "sí" = 1.67, 6x "Run!" = 1.88, 10x "la" = 2.31. A trip needs about 9-12 repetitions (12x "ha" = 2.47, 9x "sí" = 2.50) or a long run such as 20x "ja" (3.15). Short laughter and emphatic triples pass. The real risk is a Whisper tail loop discarding a genuine utterance, which is rare with segments of 7.5 s or less. Whether Groq applies temperature fallback is unknown. |
| BE-STT-07 | confirmed | medium | `route_voice_call.py:592-609` sets `stt_language=call_language` once. `resolver.py:734-745` orders turn, then voice, then preferred. The turn language is the last **assistant** message's language (`turn_language.py:22-50`), so a user speaking a different language than the character gets a wrong forced hint. `transcript.language` has no consumer. `types.py:129-139` accepts `[a-z]{2,3}`. Nuance: Whisper accepts some 3-letter codes (`haw`, `yue`), so only codes outside Whisper's list (for example `fil`) would cause a 400. |
| BE-STT-08 | confirmed | medium | `server_vad.py:25-36` and `config.py:107-115` have `vad_energy_gate_enabled=False` and a floor of `peak<0.002` only (`:238-247`). There is no neural VAD and no trimming. The client VAD is also RMS with an adaptive noise floor (FE `voiceVadProcessor.worklet.js:13, 276`), so no neural VAD runs anywhere. STT billing runs before the no-speech check (`engine.py:2243-2251`), so the user is charged for noise segments at their actual duration. The 10 s floor is Groq's charge to the operator. |
| BE-STT-09 | confirmed | medium | `_FEED` (`metrics.py:756-776`) has no `voice_stt_completed` or `voice_segment_rejected`. The observability recorder feeds every event, but only `_FEED` keys produce metrics (`observability.py:174`). `voice_orchestration` has no `provider_request` emitter (grep). There is no `stt_ms` metric anywhere. Per-row `stt_summary.latency_ms` exists in the DB, but no aggregate reads it. |
| BE-STT-10 | confirmed | medium | `stt.py:14-16, 63-69`, `server_vad.py:319-322`, and `route_voice_call.py:115, 1180-1186` accept WAV PCM16 only. `test_server_vad.py:223-236` pins the removal of WebM/Opus. 16 kHz x 16 bit = 256 kbit/s. Trade-off: WAV is what lets the server compute energy stats and cross-check duration without decoding. The upload-time figure is inference. This finding overlaps BE-STT-01. |
| BE-STT-11 | adjusted | low | True: `transcript_final` is sent only in the `VoiceLlmTurnStarted` branch (`engine.py:2571-2595`). The impact is overstated. `on_start` fires in `_execute_owned.run()` **before** the LLM request is dispatched (`llm_workflow_execution.py:94-101`), so the transcript reaches the user before LLM time-to-first-token, not during "the slowest part". The added delay is STT billing, the segment update, the supersede wait and admission (context prepare, catalog, DB admit), on the order of tens to a few hundred ms. The client also already gets `received` and `accepted` acks before STT (`engine.py:2157-2209`). |
