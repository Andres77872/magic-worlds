# Voice calls — latency review (2026-10-11)

> **Historical review; source/status refreshed 2026-10-14.** Calls remain **WIP default rollout** (`VITE_FEATURE_CALLS_ENABLED=false` in `.env.example`), locally opted in. The original findings/test totals describe the 2026-10-11 MiniMax implementation; current call synthesis is ElevenLabs-only. [Voice current status/roadmap](voice_refactor/00_current_status_and_roadmap.md) owns current availability, remaining gates and TBD work. Source fixes are not deployment or real-device acceptance.

## Current source reconciliation (2026-10-14)

- The call path now uses Groq batch STT, reply-only callbot execution and ElevenLabs multi-context streaming TTS. Retired MiniMax socket/protocol/tuning recommendations below are historical; there is no MiniMax speech fallback.
- The frontend retains 550 ms silence endpointing, buffered/truncated upload handling and playback fallbacks. Client `speech_end_lag_ms` and server `user_stop_ttfb_ms` already add a speech-end/first-server-audio baseline, with admission/first-delta/first-sentence timing. Browser first-audible and full transport measurement, earlier transcript timing, streaming STT/transport and semantic end-of-turn remain acceptance/backlog work; the original suggested savings are estimates.
- Backend effective voice availability is env AND DB, plus provider readiness, owned workspace, attestation/consent, eligibility, quota/budget and moderation gates. The frontend flag alone cannot prove a usable call.
- [15 §13](voice_refactor/15_implementation_plan_and_acceptance.md#13-native-catalog-and-legacy-removal-2026-10-14) records one local diagnostic provider smoke: correct Groq transcript, completed ElevenLabs turn, stored transcript and settlement; 149 ms TTS TTFB and 4.9 s from upload to first audio. That single sample establishes neither end-to-end speech-end-to-audible latency nor P50/P95.
- The local smoke used optional moderation (`VOICE_MODERATION_REQUIRED=false`, classifier off). Required moderation/model latency and deployed-URL smoke remain open. Real iPhone/Firefox checks and the documented single-process delivery constraint must remain visible until evidenced.

This refresh reads source and retains dated evidence; it does not rerun the original tests, alter code, make provider calls or deploy anything.

This review covers the time from "the user stops talking" to "the first assistant audio is audible". It traces that path across five repos:

- the frontend (this repo);
- `magic-worlds-api`;
- `api.magic_llm`;
- `magic-agents`;
- `magic-llm`.

No code was changed. It follows on from [voice-calls-review-2026-10-11.md](voice-calls-review-2026-10-11.md), where this delay was the item still open from BE-09.

**Status:** a follow-up pass the same day applied part of this review and removed every post-reply generation from voice calls. §7 lists what changed, what was deferred and why, and the deployment constraint. Nothing is committed yet.

**How it was done:**
- I read the code path end to end, and the key claims below were re-checked against the source.
- Network round trips from the dev machine were measured with `ping` and `curl`.
- External numbers come from published benchmarks, listed in §6.

**Caveat:** the per-stage timings in §2 are **estimates**. No live per-turn timings were available, because the dev servers log to the IDE console. §5 shows how to get the real numbers from the events the backend already logs.

---

## 1. Summary

- **Estimated delay today:**
  - About **2.5–7 s** when the reply has two or more sentences.
  - About **4–10 s** when the reply is a single sentence. The callbot prompt asks for "one to three sentences", so this case is common.
- **Production target:** published voice-agent budgets put mouth-to-ear at about **1.1–1.5 s**.
  - Twilio: 1,115 ms median target.
  - Pipecat's reference budget: 1,293 ms.

Five changes account for most of the gap. None of them needs a protocol change:

| # | Lever | Est. saving | Where |
|---|---|---|---|
| L-01 | Stop holding the **last sentence** until the metadata LLM finishes | **1.5–4 s** on 1-sentence replies; removes the tail gap on others | API (+ agents API for the clean fix) |
| L-02 | **Pre-warm the MiniMax socket** in parallel with STT/LLM instead of opening it after the first sentence | 0.3–0.9 s | API |
| L-03 | Cut the client silence wait from **800 ms** to about 550 ms (later about 250 ms with a turn-detection model) | 0.25–0.55 s | Frontend (+ API for the model) |
| L-04 | Remove the plumbing before the LLM call: a new HTTP client every turn, a catalog fetch every turn, ~90–100 sequential DB round trips, billing on the critical path | 0.1–0.3 s (more with a remote DB) | API |
| L-05 | Cut `api.magic_llm` overhead before the provider call: uncached auth, durable-recorder commits, a **new TCP+TLS connection to the provider for every LLM call** | 0.2–1.0 s (**measure first**) | agents API, magic-agents, magic-llm |

Phase 1 is L-01–L-04 plus the profile check (L-08). It should take a typical turn to about **2–3 s**. Getting to about 1–1.5 s needs the Phase 3 architecture (§4): streaming audio and STT with model-based end-of-turn detection.

---

## 2. Where the time goes (single turn, estimates)

| # | Stage | Code | Est. today |
|---|---|---|---|
| 1 | End-of-speech detection (energy VAD, fixed hangover) | `CallScreen.tsx:57` `silenceMsToEnd: 800`; `voiceVadProcessor.worklet.js:216, 341-342` | **0.80–0.95 s** |
| 2 | WAV encode + SHA-256 + multipart upload (starts only after step 1) | `voiceVadWorklet.ts:95-139, 155, 228-235`; `index.ts:3510-3537` | <0.05 s on localhost; 0.1–0.6 s on mobile or production |
| 3 | Route: auth (30 s cache), user upsert, chat, consent, form parse | `route_voice_call.py:596-652` | 0.02–0.06 s |
| 4 | Pre-STT DB work: session, touch, find, create + read-back, `accepted` | `engine.py:1281-1458` | 0.01–0.03 s |
| 5 | **Groq STT** (`whisper-large-v3`, batch, language auto-detect) | `stt_groq_client.py:31-92`; `config.py:24` | **0.3–0.8 s** (Pipecat P99 for Groq: 1.54 s) |
| 6 | STT billing (~22 round trips) + `completed` update | `engine.py:1491-1523`, `1909-1986` | 0.01–0.04 s |
| 7 | Admission: session read again, `find_admission`, lorebook, catalog (2 GETs, new client), `admit` (~30 statements), `started` | `callbot_execution.py:76`; `conversation_execution.py:87-203`; `llm_execution_transport.py:304-318` | 0.1–0.3 s |
| 8 | `api.magic_llm` before the provider request: auth, admission, graph build, recorder commits, new provider connection | see L-05 | **0.2–1.0 s (unmeasured)** |
| 9 | Provider time to first token | depends on the published `callbot` profile | 0.3–0.8 s (more if it is a reasoning model) |
| 10a | 2+ sentences: wait for the first `. ! ?` followed by a space | `sentence_buffer.py:97-102` | 0.2–0.8 s |
| 10b | **1 sentence: wait for the whole reply, then the metadata LLM, then the finish transaction** | `callbot_chat.v2.json`; `engine.py:1731-1737`; `llm_turn_runner.py:213` | **1.5–4 s** |
| 11 | **MiniMax**: connect, `connected_success`, `task_start` / `task_started`, `task_continue`, first audio | `streaming_tts_minimax.py:446-484, 536-544` | **0.5–1.4 s** |
| 12 | Base64 JSON frame, MSE append, `play()`, MP3 priming, device output | `delivery.py:150-183`; `voicePlaybackBuffer.ts:114-145, 283-310` | 0.05–0.15 s |

**Measured from the dev machine:**
- MySQL host `192.168.1.90`: 0.14 ms ping. With ~100 sequential round trips per turn, the database costs tens of ms here. It costs far more against a remote DB.
- Groq: TCP 38 ms, TLS done at 80 ms.
- MiniMax edge: TCP 15 ms, TLS done at ~50 ms. The cold-DNS first connection took ~620 ms to first byte.

---

## 3. Findings

### L-01 — The last sentence waits for the metadata LLM · P0 · est. 1.5–4 s

**Evidence:**
- The voice graph `src/agent_graphs/runtime/callbot_chat.v2.json` runs `mw_llm` (`stream: true`) and then `mw_metadata_llm` (`stream: false`, `tool_choice: required`). The metadata call receives `mw_llm`'s output, so it can only start once the reply is complete.
- `validate_callbot_completion` makes that tool call mandatory (`callbot_execution.py:20-34`).
- `SentenceBuffer` treats `. ! ?` as a boundary only when whitespace follows it. Punctuation at the end of the buffer returns `None` (`sentence_buffer.py:97-102`).
- A complete reply never ends in whitespace, because `validate_spoken_text` requires `text == text.strip()`. So the last sentence is released only by `flush()` on `VoiceLlmTurnCompleted` (`engine.py:1731-1737`).
- That event fires after `await producer` (`llm_turn_runner.py:213`), i.e. after the whole SSE stream: metadata LLM included, plus MW's finish transaction.

**What the metadata call produces, and who uses it:**
- It writes 1–4 `forwardOptions` and a 40–90-word `imagePrompt`.
- **The call UI uses neither.** `grep` finds no reference to them in `src/features/call` or the voice hooks and components.

**Impact:**
- **One-sentence replies:** nothing plays until the reply has been fully generated *and* the metadata LLM has run. That LLM uses a new TCP+TLS connection (L-05) and a non-streaming tool call.
- **Longer replies:** the last sentence comes out late, which leaves an audible gap before it.
- **Barge-in:** the turn stays "in flight" (`end_published` false) for that whole window. A user who speaks during it gets a superseding cancel, and the next turn waits for the cancel to unwind (`engine.py:1324-1327`, `llm_workflow_execution.py:18-55`).

**Options** (the BE-09 deferred item):
1. **Quick, MW only:** flush when the buffer ends in terminal punctuation (plus closers) and no delta has arrived for about 120–150 ms.
   - The decimal, ellipsis and abbreviation guards already in `SentenceBuffer` cover most false positives.
   - A wrong guess costs only a slightly unnatural split.
2. **Clean:** the agents API emits a "content finished" event in the SSE stream when `mw_llm` ends, and MW flushes on it. This is the executor end-of-text event noted under BE-09.
3. **Best:** a voice-only graph without `mw_metadata_llm`.
   - Generate the metadata after `voice_turn_end` in the background, or lazily when the chat is opened.
   - This also removes a second provider call from every turn, and the 30 s metadata role timeout from the turn.

### L-02 — The MiniMax socket opens lazily, every turn, after the first sentence · P0 · est. 0.3–0.9 s

**Evidence:**
- The TTS worker opens the socket when it takes the first sentence off the queue (`streaming_tts_minimax.py:446-484`).
- It then runs sequentially: WebSocket upgrade → `connected_success` → `task_start` → `task_started` → `task_continue`.
- `close_turn` closes the socket at the end of every turn (`engine.py:1841`).
- MiniMax's documented idle timeout is 120 s, and the server sends no pings.

**Recommendations:**
- **Start the connect and `task_start` as soon as STT returns**, or even when the segment arrives, so they overlap admission and the LLM time to first token. The handshake then costs nothing on the critical path.
- **Keep one socket and task per call across turns**, with client pings. Close only on call end or barge-in.
  - Barge-in today closes the socket. MiniMax's bidirectional endpoint `/ws/v1/t2a_v2_bidi` has `task_cancel` and `task_flush`, which allow interrupts without reconnecting.
- If production runs in US-West, try `wss://api-uw.minimax.io`. MiniMax documents it as having lower time to first audio.
- **Small items:**
  - Set an MP3 `bitrate` (e.g. 64k); it is unset today, so MiniMax's default applies.
  - Validate hex once with `bytes.fromhex` instead of the two per-character Python loops (`streaming_tts_minimax.py:62, 777, 801-804`).

### L-03 — The client waits 800 ms of silence before cutting · P0/P1 · est. 0.25–0.55 s

**Evidence:**
- `CallScreen.tsx:57` forces `silenceMsToEnd: 800`. The worklet's own `strict` preset is 450 ms, but nothing uses it.
- Endpointing is energy-only. The silence counter resets on any single voiced 8 ms frame (`voiceVadProcessor.worklet.js:341-342`), so reverb or background noise stretches the wait further.

**Industry defaults** (sources in §6):
- Fixed-silence defaults are **400–550 ms**: OpenAI 500, LiveKit 500 / 550, Vapi 400, Twilio ~500.
- Semantic turn models (Smart Turn v3.1, LiveKit's turn detector) cut a turn about **200–300 ms** after the pause.

**Why shortening is safe here:** the server already supersedes and merges (contract C2). A cut that turns out to be too early is merged with the continuation.

**What it costs:**
- More superseded turns.
- More Groq requests, each billed at a 10 s minimum.
- More cancelled LLM calls. These get cheap once L-01 is fixed.

**Plan:**
1. Move to about **550 ms** and watch the supersede rate (`voice_segment_cancelled` events).
2. Then use **Smart Turn v3.1** with a tentative cut at about 250 ms of silence:
   - It runs server-side on the uploaded audio: ONNX, 8 MB, about 10–60 ms on CPU, 23 languages including Spanish.
   - It runs in parallel with STT, and the turn starts only when the model says "complete" (fallback: about 2–3 s of silence).
   - Nothing plays until the turn is confirmed, so the assistant never talks over the user.

**Related:** while assistant audio plays, `minSpeechMs` rises to 500 ms (`useVoiceCallController.ts:100, 552`). A short "yes" said over the end of a reply is therefore dropped. This is a turn-taking issue rather than latency, but users experience it as "it didn't hear me".

### L-04 — Plumbing before the LLM call (magic-worlds-api) · P1 · est. 0.1–0.3 s

**Evidence:**
- From the POST to the LLM request there are about **90–100 sequential MySQL round trips**. Each `execute_query` is a statement plus a COMMIT (`connection.py:207-231`).
- `CallbotExecutionService` is built with `client=None` (`engine.py:2076-2078`). So **every turn opens a new `httpx.AsyncClient`** for:
  - the catalog fetch (`llm_execution_transport.py:304-312`);
  - the completion stream (`llm_execution_transport.py:244-247`).
- **The execution catalog is fetched every turn and never cached:** sequential `GET /models`, then `GET /providers`, then a DB snapshot read (`llm_execution_transport.py:315-318`, called at `conversation_execution.py:171`). Each of those GETs is authenticated again inside `api.magic_llm` (L-05).
- **Duplicated work:**
  - `get_scoped_session` runs twice (route `route_voice_call.py:608` and `callbot_execution.py:76`).
  - `find_admission` runs before `admit`, which repeats the same existence check.
  - `repository.started` is its own transaction (`llm_execution_admission.py:503-509`).
- **Billing on the critical path:** the STT debit is a transaction of about 17 statements plus a metadata read and write. It runs before the turn starts (`engine.py:1491-1499`).
- `_lock_project` takes a **project-wide row lock** in every `admit`, `started` and `finish` (`llm_profile_models.py:67-72`). That is invisible with one user and a source of queueing under load.

**Recommendations:**
- Pass one shared, pooled `httpx.AsyncClient` (HTTP keep-alive) to `CallbotExecutionService`.
- Cache the catalog with a TTL. `auth_adapter.py:387` already has a 300 s pattern.
- Run lorebook and catalog concurrently.
- Fold `find_admission` and `started` into `admit`, and drop the duplicate session read.
- Move STT billing, the `completed` update and `touch_call` off the critical path: run them as a background task or after the LLM request is sent.
- Skip per-segment checks the live runtime already holds (user, chat, scope, consent were checked at call start).
- Collapse create + read-back into one INSERT.

### L-05 — Overhead in `api.magic_llm`, magic-agents and magic-llm before the provider request · P1 · est. 0.2–1.0 s · measure first

**Evidence:**
- **Auth:** delegated auth makes two sequential HTTP calls to `api.auth`, with no cache. It then runs a synchronous DB lookup that blocks the event loop (`completion_auth.py:370-400`, `src/db/registration.py:43`).
- **Graph build:** `prepare_agent_graph_for_runtime` runs twice, plus deep copies, plus a new `MagicLLM` per client node per request (`agt_flow.py`, `NodeClientLLM.py:105`).
- **Durable execution recorder (likely the largest hidden cost):**
  - Every `record()` deep-copies the growing checkpoint, which carries the encoded chat history, and commits a transaction (`magic-agents/execution/recorder.py:179-261`).
  - It records graph start, each node's start, output and end, edge deliveries, `effect_prepared` and `llm_start`. That is an estimated 25–35 sequential commits before the provider request.
- **Provider connection:** **magic-llm opens a new `aiohttp.ClientSession` for every LLM call** (`engine_openai.py:244` → `AsyncHttpClient.__aenter__` in `util/http.py`). There are 25 such `async with AsyncHttpClient()` sites. Both the reply and the metadata call therefore pay a fresh TCP+TLS handshake to the provider (about 100 ms+ each).

**Recommendations:**
1. Add one timing log first: request received → provider request sent → first provider byte.
2. Then:
   - reuse one `aiohttp` session per provider base URL;
   - cache delegated-auth validation for a short TTL and make the user lookup async;
   - batch recorder writes, or commit only at `graph_start` and before each provider effect.

### L-06 — STT: Groq `whisper-large-v3`, batch, no language hint · P1/P2

**Evidence:** the config **rejects any model except `whisper-large-v3`** (`config.py:24, 125-128`). `VOICE_STT_LANGUAGE` is unset, so Whisper auto-detects the language. `verbose_json` with segment timestamps is used for the no-speech filter, which is fine.

**Options:**
- **Set `language`** from the chat or user locale. Groq's docs say it improves both accuracy and latency.
- **Allow `whisper-large-v3-turbo`:**

  | Model | Speed | Price | WER |
  |---|---|---|---|
  | `whisper-large-v3-turbo` | 216× | $0.04/h | 12% |
  | `whisper-large-v3` | 189× | $0.111/h | 10.3% |

  On short clips, network, queueing and upload dominate. Expect a modest latency gain and a large cost cut. A/B test the Spanish quality.
- Keep 16 kHz mono WAV: Groq recommends WAV for the lowest latency.
- **Structural limit:** batch STT pays the whole transcription *after* endpointing. Pipecat measures Groq at P99 1.54 s from end of speech to transcript. Streaming STT measures 250–360 ms P95: Deepgram nova-3 247 / 298 ms (median / P95), AssemblyAI 256 / 362 ms. See Phase 3.

### L-07 — `transcript_final` waits for LLM admission · P1 · perceived latency

**Evidence:** `transcript_final` and `voice_turn_start` are sent from the `VoiceLlmTurnStarted` handler (`engine.py:1689-1715`). That runs after admission (L-04), not when STT returns.

**Impact:** the user sees their own words 0.1–0.3 s later than necessary, and the wait for a reply feels longer.

**Fix:** send the transcript as soon as STT returns. It needs either a frame without `turn_id` or a turn id assigned before admission, so it needs a small protocol tweak.

### L-08 — The `callbot` LLM profile (DB configuration, not code) · P1

**Evidence:** the model, `max_output_tokens` (default 16,384, `llm_profiles.py:16`), temperature and `reasoning_effort` (default `None` = provider default) come from the published `callbot` profile. I couldn't read it because `/llm/features` needs auth.

**Check:**
- **Model:** a fast, non-reasoning model, or reasoning set to none or minimal. Groq notes reasoning adds 10–40% to time to first token, and thinking tokens delay the first spoken word.
- **`max_output_tokens`:** about 300–400 for voice.
- **Prompt caching:** a stable system prompt first and history appended, so the provider can cache. Caching needs at least 1,024 tokens.
- **Metadata role:** if it stays in the graph, put it on the fastest tool-capable model.

### L-09 — Upload and transport · P2

**Evidence:**
- The upload starts only after endpointing.
- The body is uncompressed PCM16: 32 KB/s, about 800 ms (25 KB) of trailing silence, plus 300 ms of pre-roll.
- Encoding copies the data one sample at a time, even though it is already Int16, then reads the blob back to hash it (`voiceVadWorklet.ts:116-120, 155`).
- There are no retries: a failed POST loses the utterance (`useVoiceCallController.ts:483-486`).
- The HTTP connection likely goes cold between turns:
  - The POST stays open for the whole turn.
  - The user then listens to the reply.
  - Uvicorn's default `timeout_keep_alive` is 5 s, so in production each upload probably pays TCP+TLS again unless a proxy keeps the client connection alive.

**Recommendations:**
- Trim the trailing silence to about 200 ms; keep a little for Whisper.
- Raise keep-alive at the proxy (or `--timeout-keep-alive`).
- Hash the `Int16Array` directly.
- Add one retry for network errors. The `Idempotency-Key` already makes this safe.
- **Long-term:** stream binary audio frames during speech over the WebSocket that is already open. That removes the per-turn HTTP request and enables streaming STT. It reverses contract C6, so it belongs in Phase 3.

### L-10 — Downlink and playback · P2 · tens of ms

**Evidence:**
- Audio arrives as base64 JSON text frames, 33% larger. The client drops binary frames (`voiceSocket.ts:376`).
- A new MediaSource is created each turn. Setting it up on `voice_turn_start` mostly hides that cost.
- MP3 priming adds about 35 ms.
- There is no jitter buffer, which is good for latency.

**Options:**
- Binary frames.
- A persistent MediaSource.
- Longer term: MiniMax `pcm` at 24 kHz played through an AudioWorklet with a 60–120 ms pre-buffer.

**iOS risk (correctness more than latency):**
- The ManagedMediaSource stall fallback costs 2 s.
- It never arms if `startstreaming` never fires, because the timer arms only when `appendedCount > 0` (`voicePlaybackBuffer.ts:462-471`). The turn would then stay silent with no fallback.
- Verify on a real iPhone.

### L-11 — The next turn waits for the previous turn's cleanup · P2 · est. 0.1–0.5 s

**Evidence:**
- After `voice_turn_end`, the old turn still does all of this before `turn.finished` is set (`engine.py:1773-1844`, `1357-1362`):
  - hex-encodes and stores the full MP3;
  - writes the job and asset rows;
  - writes the assistant segment rows;
  - runs `close_turn`, which waits for the WebSocket close handshake with a `close_timeout` of up to 5 s.
- The next turn's `await previous.finished.wait()` (`engine.py:1327`) waits for all of it.
- Per-sentence TTS billing also runs *before* the next sentence's `task_continue` (`engine.py:1655`), adding 10–30 ms between sentences.

**Fix:** after `voice_turn_end`, mark the turn finished for ordering purposes and run persistence, cleanup and billing in a background task.

### L-12 — Observability cannot attribute the delay · P0 enabler

**Evidence:**
- The backend logs these timing events (`observability.py:78-90`, INFO `voice_event name=… fields=…`):

  | Event | Measures |
  |---|---|
  | `voice_stt_completed` | Groq round trip |
  | `voice_llm_first_delta` | from turn start; **lumps** admission, catalog, agents-API overhead and time to first token |
  | `voice_tts_first_audio` | from synthesize start; includes the handshake |
  | `voice_first_assistant_audio` | from segment arrival on the server |

- **Missing:**
  - the client's speech-end and upload time;
  - "first sentence ready" (the one timer that exposes L-01);
  - admission and catalog duration;
  - agents-API internal time;
  - TTS connect time separated from time to first audio;
  - when audio became audible on the client.
- Nothing is persisted, apart from STT `latency_ms` in `stt_summary`.
- The field whitelist silently drops keys such as `stage`, and `now_ms()` uses wall-clock time rather than a monotonic clock.

**Recommendation:** add those marks, and persist one per-turn timing summary (in `tts_summary` or a small table) so P50 and P95 can be read. Client side, use `performance.mark` at VAD speech-end, upload sent, first chunk received and the `playing` event.

---

## 4. Roadmap

**Phase 1 — no protocol change; a few days. Target: ~2–3 s typical.**
- L-01: the idle flush now; the voice graph without the metadata LLM next.
- L-02: pre-warmed MiniMax socket, kept per call.
- L-03 step 1: 550 ms.
- L-04: shared client, catalog TTL, background billing.
- L-07.
- L-08: profile check.
- L-12: timing marks, so every later step is measured.

**Phase 2 — plumbing across repos.**
- L-05: provider session reuse, auth cache, recorder batching.
- L-06: `language` hint; turbo A/B.
- L-09: trim, keep-alive, retry.
- L-11: background cleanup.
- L-10: binary frames, `bitrate`.

**Phase 3 — architecture. Target: ~1–1.5 s.**
- Stream audio frames over the open WebSocket (or WebRTC/Opus) during speech.
- Use a streaming STT with model-based end-of-turn, e.g. Deepgram Flux with `EagerEndOfTurn` / `TurnResumed`. Alternatively, run Smart Turn on the server.
- Start the LLM speculatively and play only when the turn is confirmed.
- Switch to the MiniMax bidi endpoint (`task_cancel` for barge-in).
- Optionally, PCM through an AudioWorklet.

---

## 5. Getting real numbers today (no code change)

The `:8010` backend already logs `voice_event` lines at INFO in the IDE console. For a few turns, collect:

- `voice_stt_completed` `latency_ms`
- `voice_llm_first_delta` `latency_ms`
- `voice_tts_first_audio` `latency_ms`
- `voice_first_assistant_audio` `latency_ms`

Then:

```
waiting for a speakable sentence ≈ first_assistant_audio − stt − llm_first_delta − tts_first_audio
```

That difference covers reply generation up to the first boundary plus pre-turn DB and billing work. A large value on one-sentence replies confirms L-01.

Still invisible in the logs:
- the client's 800 ms hangover;
- the upload;
- playback start.

`first_assistant_audio` starts counting when the segment reaches the engine.

Since the follow-up pass (§7), two more events split that difference:
- `voice_turn_admitted` `latency_ms`: admission and catalog time.
- `voice_tts_first_sentence` `latency_ms` and `milestone`: when the first sentence was released, and whether a boundary, a quiet stream (`idle`) or the end of the turn released it.

---

## 6. Sources

- Twilio, core latency guide (Nov 2025): https://www.twilio.com/en-us/blog/developers/best-practices/guide-core-latency-ai-voice-agents
- Voice AI & Voice Agents primer (Pipecat), budgets and LLM/TTS TTFT tables: https://voiceaiandvoiceagents.com/
- Pipecat STT benchmark: https://github.com/pipecat-ai/stt-benchmark
- Pipecat measured TTFS P99 (Groq 1.54 s): https://raw.githubusercontent.com/pipecat-ai/pipecat/main/src/pipecat/services/stt_latency.py
- Smart Turn v3.1: https://www.daily.co/blog/improved-accuracy-in-smart-turn-v3-1/ · https://docs.pipecat.ai/server/utilities/turn-detection/smart-turn-overview
- LiveKit turn detector and tuning: https://docs.livekit.io/agents/logic/turns/turn-detector/ · https://docs.livekit.io/agents/logic/turns/tuning/
- OpenAI Realtime VAD: https://developers.openai.com/api/docs/guides/realtime-vad
- OpenAI latency optimisation: https://developers.openai.com/api/docs/guides/latency-optimization.md
- OpenAI prompt caching: https://developers.openai.com/api/docs/guides/prompt-caching
- Deepgram Flux eager end-of-turn: https://developers.deepgram.com/docs/flux/voice-agent-eager-eot
- Groq speech-to-text docs: https://console.groq.com/docs/speech-to-text
- Groq latency guide: https://console.groq.com/docs/production-readiness/optimizing-latency
- MiniMax WebSocket TTS: https://platform.minimax.io/docs/api-reference/speech-t2a-websocket.md
- MiniMax bidi WebSocket TTS: https://platform.minimax.io/docs/api-reference/speech-t2a-websocket-bidi.md
- MSE and MP3 seamless playback: https://web.dev/articles/mse-seamless-playback
- ManagedMediaSource: https://developer.mozilla.org/en-US/docs/Web/API/ManagedMediaSource

Not verified:
- MiniMax `speech-2.8-turbo` time to first audio; only reseller claims of under 250 ms exist.
- Groq Whisper median per-request latency.
- MP3 playback under ManagedMediaSource on iOS.
- Any MSE vs AudioWorklet startup benchmark.

---

## 7. Status after the follow-up pass (2026-10-11)

Nothing is committed. Changes are in `magic-worlds-api`, `api.magic_llm` (contract only) and this repo.

> **Deploy `magic-worlds-api` and `api.magic_llm` together.** The `callbot` contract changed on both sides (`llm_features.py`: one `primary` role). The agents API refuses a plan whose roles don't match its contract (`LLM_FEATURE_ROLES_INVALID`). Shipping one side alone breaks voice calls until the other ships. `contract_revision` stays `llm_features_v2`, so models already verified for `callbot` stay verified.

### 7.1 Per finding

| # | Status | What changed / why not |
|---|---|---|
| L-01 | **Applied** | Voice calls generate nothing after the reply: no metadata LLM, so no suggestion chips and no image prompt for voice turns (images, extraction and summaries never ran for voice). The reply streams alone and the last sentence is spoken as soon as the reply goes quiet (details in 7.2). |
| L-02 | **Applied (per turn)** | The turn's MiniMax socket (connect + `task_start`) is opened when the turn is admitted, overlapping the LLM's time to the first sentence. Not kept across turns: each turn still runs its own MiniMax task. |
| L-03 | **Applied (step 1)** | `CallScreen` cuts a turn after **550 ms** of silence (was 800). Smart Turn (step 2) is not started. Watch `voice_segment_cancelled` for a rise in superseded turns. |
| L-04 | **Partly applied** | The execution catalog (two agents-API GETs per turn) is cached per user for 60 s and dropped on any failed turn. **Not done:** a shared HTTP client (a pooled connection races uvicorn's 5 s keep-alive close, and the gain is small now that the catalog is cached), fewer DB round trips, STT billing off the critical path (changes failure semantics). |
| L-05 | **Deferred** | Other work is in progress in `api.magic_llm` and `magic-llm`, and recorder batching changes durability guarantees. Measure first with the new timings. |
| L-06 | **Deferred** | `whisper-large-v3` is pinned as a contract: voice config, the Groq client, the DB column default and session-row validation. Turbo trades accuracy and price for a small gain, so it is a product decision. Language auto-detect is kept. |
| L-07 | **Deferred** | Needs a protocol change (a transcript frame before a turn id exists). The catalog cache already shortens the wait. |
| L-08 | **Configuration** | Check the published `callbot` profile: a fast non-reasoning model and about 300–400 `max_output_tokens`. Only the `primary` role matters now; a `metadata` binding in the profile is ignored for calls (text chat still uses it). |
| L-09 | **Partly applied** | The worklet sends only the first **200 ms** of the end-of-turn pause (the full pause still seeds the next pre-roll). The WAV is built with one bulk copy and hashed from the same bytes. An upload that fails at the network level is resent once (the `Idempotency-Key` makes a resend `duplicate`, never a second turn). **Not done:** proxy keep-alive (deployment), streaming audio over the socket (Phase 3). |
| L-10 | **Partly applied** | MiniMax hex audio is validated with `bytes.fromhex` (about 50× faster per frame, same strictness). The iOS ManagedMediaSource stall fallback now arms from the first received chunk, so a source that never asks for data falls back to Blob playback after 2 s instead of staying silent. **Not done:** binary frames, persistent MediaSource, PCM. Still verify on a real iPhone. |
| L-11 | **Deferred** | The previous turn's cleanup usually overlaps the client still playing that reply. Moving it to the background changes ordering guarantees between turns. |
| L-12 | **Applied** | New events: `voice_turn_admitted` (admission time from turn start) and `voice_tts_first_sentence` (`milestone` = `boundary`, `idle` or `turn_end`: what released the first sentence). Client-side marks and a persisted per-turn summary are not done. |

### 7.2 How the reply-only voice turn works

**Graph and contract (`magic-worlds-api`):**
- `callbot_chat.v2.json` keeps `mw_user_input → mw_chat → mw_llm → mw_end` with one client. The four metadata nodes are gone, and the registry hash in `builtin_agents.v1.json` is updated.
- The `callbot` contract has one `primary` streaming role (30 s).

**Execution:**
- A voice turn runs through `execute_admitted_reply` / `collect_execution_reply`. These stream the text and keep the usage from the final chunk.
- A stream that still carries a tool call, or reports usage twice, is rejected.
- Text chat still uses the tool path, unchanged.

**Stored turn:**
- `turn_metadata_status: "not_requested"`, with no `turn_metadata`.
- Voice turns stored earlier, with metadata, still validate and replay.
- A record that mixes the two shapes is rejected.
- Text-chat turns still require their metadata.

**Engine:**
- Even without the metadata call, the last sentence used to wait for the turn to be persisted and completed.
- Now the engine flushes it once the stream has been quiet for **120 ms** after a finished sentence.
- A number right before the final period is held, because it may be a decimal.

### 7.3 Verification

- **`magic-worlds-api`:** full suite **6,641 passed**. The 6 failures are the existing `TestAuthProxyChain` ones.
  - New tests: `tests/voice/test_callbot_reply_only.py`, `tests/voice/test_voice_turn_latency.py`, prewarm and hex cases in `test_minimax_streaming_tts.py`, and `take_finished` cases in `test_sentence_buffer.py`.
  - `tests/integration/test_callbot_profile_execution_database.py` was updated for the reply-only stream but **not run**: it needs an isolated MySQL socket (`LLM_PROFILE_TEST_MYSQL_SOCKET`).
- **`api.magic_llm`:** the callbot tests were updated.
  - The ones that run pass, including the profile-test graph for `callbot`, which runs the BFF's real payload through the native runtime.
  - `test_callbot_production_workflow` still fails, like about 200 other tests in those untracked files: they call `run_agent_authenticated_inline(execution_context=…)`, which the current source no longer accepts. This is pre-existing and not caused by this change.
- **Frontend:** `pnpm test` **2,199 passed**, `pnpm build` green, eslint clean on the touched files.
- **Not done:** no live provider call was made (Groq, MiniMax, LLM). Latency gains are still estimates until the new timing events are read from real calls (§5).
