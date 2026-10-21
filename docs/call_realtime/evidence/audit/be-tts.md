# Audit evidence: backend streaming TTS (ElevenLabs multi-context WebSocket and Fish Audio lane)

Subsystem: backend streaming TTS for live voice calls. This covers sentence buffering, text normalization, the ElevenLabs multi-context dialogue socket, the Fish Audio timestamp socket, alignment and ledgers, the audio side of delivery, and how failures and costs are handled.

Repos (read-only): `/home/andres/PycharmProjects/magic-worlds-api` (BFF). All paths below are relative to that repo unless they are absolute.

Legend: **FACT** = read in code at the cited line. **INFERENCE** = reasoned from code plus general provider or industry knowledge. **UNKNOWN** = cannot be settled from the code. Provider behaviour such as real TTFB, alignment shape and `isFinal` semantics is UNKNOWN unless a repo doc or test records evidence.

---

## 1. Architecture walkthrough

### 1.1 Components

| Layer | File | Role |
| --- | --- | --- |
| Turn orchestration | `src/services/voice_orchestration/engine.py` (`_run_voice_turn` 2292-2812) | Consumes LLM events, feeds `SentenceBuffer`, builds the per-turn speaker, moderates/renders each sentence (`prepare`), delivers audio (`deliver`), bills, finalizes |
| Sentence segmentation | `src/services/voice_orchestration/sentence_buffer.py` | Streams LLM deltas into sentence spans with offsets |
| Per-turn speaker | `src/services/voice_orchestration/call_tts_elevenlabs.py` (`ElevenLabsTurnSpeaker`) | Pusher plus drainer tasks with the flush-ahead gate. Shared by the EL and Fish lanes |
| EL transport | `src/services/speech/providers/elevenlabs/tts_multicontext_ws.py` | One WS per call, one provider context per turn, reconnect/replay, watchdog timers |
| Fish transport | `src/services/speech/providers/fish_audio/streaming.py`, `timestamp_ws.py`, `admission.py`, `stream_mp3.py` | One WS and one lease per turn ("generation"). No replay |
| Ledgers | `voice_orchestration/call_ledger.py` (EL, char alignment), `call_word_ledger.py` + `speech/word_timing.py` (Fish, word timestamps) | Map delivered audio onto sentences/words for truncation, the flush gate and drained-char counting |
| Text pipeline | `src/services/speech/text_pipeline.py`, `number_words.py`, `emotion_map.py` | Sanitize (markdown/emoji/OOC/brackets), expand en/es numbers, translate markup v1 to audio tags |
| Delivery | `voice_orchestration/delivery.py` | JSON `voice_audio_chunk` frames, base64 MP3, per-socket send lock, stale/cancelled suppression |

### 1.2 Turn data flow (ElevenLabs lane, default)

1. **Call start** opens the speech socket early. `engine.py:883` runs `speech_provider.open_call(...)`. `ElevenLabsStreamingSpeech.open_call` (`tts_multicontext_ws.py:258-271`) checks the breaker, takes one `ttd_session` limiter permit for the call's lifetime (`:266`, released only in `close_call` `:483-485`) and starts `_connect_once` in the background (`_open` `:490-492`). FACT
2. **Segment upload (user stopped speaking)**: `accept_segment` calls `_warm_call_moderation` and `_warm_call_speech` (`engine.py:2043-2044`). `prewarm()` reopens the socket only if it closed while idle (`tts_multicontext_ws.py:329-333`, `_ensure_connecting` `:511-516`). This overlaps STT. FACT
3. **LLM admission** (`VoiceLlmTurnStarted`): the engine awaits the spend-circuit check (`engine.py:2579-2583`; the task started at turn begin, `:2343`), then `start_speaker(turn_id)` (`:2585`). The speaker's `_begin` calls `call.begin_turn` (`call_tts_elevenlabs.py:203-218`). This creates context `t_<turn_id>` and sends the init `{context_id, voices:[voice_id], voice_settings}` if the socket is open (`tts_multicontext_ws.py:335-367`, `_pump` `:621-628`). **The context is ready before the first LLM token.** FACT
4. **LLM deltas**: each `VoiceAssistantDelta` is first sent to the client as a text frame (`engine.py:2613-2616`, awaited). It is then appended to `turn.collected_text` and fed to `sentence_buffer.add_spans` (`:2617-2621`). Each completed span goes to `speak_later` → `speaker.submit` (`:2534-2540`). The ledger entry is created in order (`call_tts_elevenlabs.py:111-119`). FACT
5. **Idle tick**: `_with_idle_ticks(events, 0.12)` (`engine.py:2563`, `:3919-3944`) yields `None` when the LLM stream is quiet for 120 ms. `take_finished_span()` then releases a buffered sentence that already ends in `.!?` (`engine.py:2565-2570`, `sentence_buffer.py:103-113`). FACT
6. **Pusher** (`call_tts_elevenlabs.py:228-264`) handles one sentence at a time, serially:
   - `prepare(text)` (`engine.py:2364-2431`): `validate_spoken_text` → **per-sentence moderation** `_call_sentence_verdict` (awaited, 300 ms budget, fail-closed, `engine.py:2393-2414`, `:3293-3349`; `moderation.py:73`) → `sanitize_speech_text` + `render_speech_text(kind="speech")` (`engine.py:2417-2431`).
   - Flush-ahead gate `may_flush(index)` (`:160-167`): sentences 0-2 go at once. A later sentence waits while `unheard >= 3` or `ahead >= 8000 ms`, re-checked on playback reports, on audio and every 250 ms (`_wait` `:169-179`).
   - `call.push_text` → `_pump` sends `{context_id, inputs:[{text: sentence + " ", voice_id}], flush: true}` (`tts_multicontext_ws.py:629-643`). Then `ledger.mark_flushed` and `on_flush` (spend circuit, `engine.py:2433-2439`).
   - After the input sentinel, `end_turn` → `{context_id, close_context: true}` (`tts_multicontext_ws.py:383-388`, `:644-655`).
7. **Receiver** (`tts_multicontext_ws.py:659-745`): it base64-decodes `audio`, picks `alignment`, else `normalizedAlignment`, and stamps `char_offset = epoch_base + epoch_aligned`. It acks sentences and puts an `AudioChunk(codec="mp3", sample_rate=44100, alignment=...)` on the context queue. `isFinal` releases the context. Frames for dead or released contexts are dropped. FACT
8. **Drainer** (`call_tts_elevenlabs.py:266-292`) iterates `turn_audio(turn_id)` and calls `deliver(chunk)` (`engine.py:2441-2509`). `deliver` records first audio once, sends `voice_audio_chunk` (JSON + base64 MP3) through `VoiceDelivery.send_audio_chunk` (`delivery.py:233-268`), appends the bytes to the turn's in-memory audio, feeds the MP3 meter and the ledger, and **awaits billing** when a sentence started or 2 s of audio has accrued (`engine.py:2507-2508`, `:3378-3440`). FACT
9. **Turn end**: `speaker.finish()` waits for all provider audio (`engine.py:2637`). The engine then bills, sends `voice_audio_final` and `voice_turn_end` (with truncation), persists the assistant audio and transcript, and updates the segment (`:2648-2755`). In `finally`, an unfinished context is cancelled (`:2786-2792`). FACT

### 1.3 Barge-in (TTS side)

`_truncating_barge_in` (`engine.py:1367-1412`) decides the truncation, then `_cancel_turn` (`:1958-1976`). That sets `cancel_event`, sends `voice_cancelled` to the client **first** (`delivery.mark_turn_cancelled`) and then `_cancel_speech_turn` (`:1978-1997`): `speaker.stop()` and `call.cancel_turn(turn_id)`. On EL the context goes `dead` and its queue is drained, then `close_context` is sent (`tts_multicontext_ws.py:390-406`). Late frames for the dead context are dropped (`:698-704`). Drained characters (sent but never voiced) are counted for abuse scoring. FACT

### 1.4 Fish lane differences (behind `FISH_AUDIO_CALLS_ENABLED=false` by default)

- Selection: `tts_provider = fish_audio_streaming` when the resolved voice is Fish (`engine.py:783`). Default config: `calls_enabled=False`, `concurrency=1`, `daily_budget_micros=1_000_000` ($1/day) (`fish_audio/config.py:36-42`). FACT
- No prewarm at call open (`streaming.py:52-54`). `begin_turn` starts `_run` (`streaming.py:80-99`, `:168-226`). `_run` takes a DB lease (`admission.call_lease`, `:180`), opens the WS **early** and sends `start` with `format=mp3, sample_rate=44100, mp3_bitrate=128, chunk_length=100, latency='balanced'` (`timestamp_ws.py:205-216`). The handshake overlaps the LLM's first sentence. FACT
- Per sentence: `prepare` resolves pronunciation dictionaries (a DB transaction if refs exist, `performance.py:9-15`), moderates the *moderation text* of the performance plan and compiles it (`engine.py:2376-2416`). The Fish `units()` generator then calls `attempt.extend(text)`, a **DB transaction per sentence** (`streaming.py:183-192`, `admission.py:103-142`, `:226-234`), before sending `{'event':'text'}` and `{'event':'flush'}` msgpack (`timestamp_ws.py:187-202`).
- Audio: msgpack frames are decoded with revisable word snapshots (`timestamp_ws.py:69-149`). Only complete MP3 frames are forwarded (`stream_mp3.py:13-38`). Output goes to a bounded queue (8) (`streaming.py:24-25`, `:199-210`).
- Truncation is **word-level** through `RevisableWordTimeline` (`word_timing.py`, `call_word_ledger.py:91-97`).
- Errors: no replay and no voice replacement (`streaming.py:141-143`). Any error stops this turn's audio. The leg ends only on config/billing/voice-scoped errors (`engine.py:2947-2964`). Each new turn is a new generation.

---

## 2. Wire formats

### 2.1 ElevenLabs dialogue socket (FACT unless marked)

- URL: `wss://api.elevenlabs.io/v1/text-to-dialogue/multi-stream-input?model_id=eleven_v4_turbo&output_format=mp3_44100_64&sync_alignment=true&apply_text_normalization=auto[&language_code=xx]` (`tts_multicontext_ws.py:93-94`, `:237-248`; model row `capabilities.py:148-151`; call surface `capabilities.py:159`). The auth header is `xi-api-key` (`:524`). `open_timeout=3`, `ping_interval=None` (`:522-527`).
- Client → provider messages:
  - init `{"context_id":"t_<turn>","voices":["<voice_id>"],"voice_settings":{stability,similarity_boost}}` (`:624-627`; settings `capabilities.py:140`)
  - text `{"context_id":..,"inputs":[{"text":"<sentence> ","voice_id":..}],"flush":true}` (`:638-641`)
  - keepalive `{"context_id":..,"keep_alive":true}` after 15 s idle on an open context (`:1003-1007`)
  - close context `{"context_id":..,"close_context":true}` (`:655`); close socket `{"close_socket":true}` (`:468`)
- Provider → client: JSON with `audio` (base64 MP3), `alignment|normalizedAlignment {chars, charStartTimesMs, charDurationsMs}`, `isFinal|is_final`, `contextId|context_id`, optional in-band `error` (`:680-745`, `:785-831`).
- Not set: `auto_mode`, `chunk_length_schedule`, `inactivity_timeout` (fixed 20 s for TTD per comment `:81-82`), `optimize_streaming_latency`. INFERENCE: these TTS-socket knobs do not exist on the dialogue endpoint. UNKNOWN for `eleven_v4_turbo`.

### 2.2 Fish timestamp socket (FACT)

- `wss://api.fish.audio/v1/tts/live/with-timestamp`, headers `Authorization: Bearer`, `model: drama-3` (`timestamp_ws.py:25`, `:206-209`). `open_timeout=5`, `ping_interval=20`, `ping_timeout=20`, `max_queue=16`.
- msgpack events: `start` (request above), `text` (`unit + ' '`), `flush`, `stop`; the receiver handles `audio` (raw bytes, `chunk_seq`, `chunk_audio_offset_sec`, `alignment.segments[{text,start,end}]`), `finish` (reason `stop`) and `error`.

### 2.3 BFF → browser (FACT, `delivery.py:442-477`)

`{"type":"voice_audio_chunk","voice_session_id","turn_id","seq","content_type":"audio/mpeg","sample_rate","channels":1,"data_b64","is_final":false,"codec":"mp3","gain_db","substitution_reason"[, "voice_name"]}`. Call audio must be MP3 (`delivery.py:67-69`, `:118-122`). Allowed sample rates are `{22050, 24000, 44100}` (`models/tts.py:22`). `data_b64` is exempt from redaction (`delivery.py:598-599`). The browser plays it through MediaSource `appendBuffer` (`/home/andres/WebstormProjects/magic-worlds/src/features/interaction/audio/voicePlaybackBuffer.ts:390`; cross-ref only).

---

## 3. State machines

### 3.1 EL provider context (`tts_multicontext_ws.py:117`, `:150`)

```
init_pending --(socket attached; init sent)--> open --(end_turn: close_context sent)--> closing --(isFinal | 5 s idle after close/last audio)--> released
     |                                          |                                         |
     +--(cancel_turn before init)--> released   +--(cancel_turn)--> dead --(isFinal | 5 s idle)--> released
reconnect (_restart_socket): open/init_pending -> init_pending (epoch+1, unacked sentences replayed); closing/dead -> released (NOT replayed)
```

- At most 4 unreleased contexts (`MAX_LIVE_CONTEXTS`, `:74`). A 5th `begin_turn` waits. If the wait exceeds 3 s, a reconnect is triggered (`:976-983`).
- Reconnect budget: 1 per call, reset when a turn completes with audio (`:18-23`, `:833-843`, `:946-947`). A second failure calls `_fail_leg(stream_interrupted)` (`:843`, `:894-907`).

### 3.2 Engine speech leg

`runtime.tts_leg_ended` is set by: spend refusal (`engine.py:2842-2856`), voice unavailable with no substitute (`:2965-2974`), `tts_stream_interrupted` or a config/billing breaker (`:2980-2986`), and on Fish config/billing/voice-scoped errors (`:2955-2956`). **It is never cleared**: later turns are text-only (`start_speaker` `:2517`, `_warm_call_speech` `:3272`). FACT

### 3.3 Speaker

`start → _begin (2 attempts if voice replaced) → push ∥ drain → end_turn → audio_complete`. Errors go to `on_error`. A `True` answer (voice replaced, or `tts_timeout` on EL) resumes. Anything else stops the turn's audio while the text continues (`call_tts_elevenlabs.py:183-292`; `engine.py:2926-2990`). FACT

---

## 4. Configuration and defaults

| Setting | Value | Where |
| --- | --- | --- |
| Call model (EL) | alias `el_v4_turbo`, provider id `eleven_v4_turbo`, transport `ttd_ws` | `capabilities.py:148-151`, `:159` |
| Call output format (EL) | `mp3_44100_64` (44.1 kHz, 64 kbps, mono) | `capabilities.py:65`; `types.py:88-91` |
| Voice settings sent | `stability`, `similarity_boost` (default 0.5 / 0.75); speed not sent | `capabilities.py:68-72`, `:140` |
| Audio tags | supported (`tags=True`), `<break>` not (`brk=False`) | `capabilities.py:148-149` |
| Text normalization | `apply_text_normalization=auto` | `tts_multicontext_ws.py:94` |
| Alignment | `sync_alignment=true`, original `alignment` preferred | `:243`, `:714-716` |
| Max live contexts | 4 | `:74` |
| Connect timeout | 3.0 s | `:75` |
| First-audio timeout | 3.0 s | `:76` |
| Inter-chunk timeout | 5.0 s (not applied to `closing` contexts after first audio) | `:77`, `:994-995` |
| Keepalive | after 15 s idle per open context | `:78` |
| Completion idle release | 5 s after the later of close and last audio | `:79`, `:984-989` |
| Slot wait → reconnect | 3.0 s | `:80` |
| Provider inactivity (TTD) | 20 s, fixed | `:82` |
| Max stalled first-audio timeouts | 2 | `:87` |
| Watchdog tick | 0.25 s | `:89` |
| Handshake 429 retry | 1 s (max 5 s), jittered ×[1, 1.5), counts against the budget | `:91-92`, `:543-549` |
| Limiter pool | `ttd_session`, size = `ELEVENLABS_POOL_FLASH` (default 24), **in-process** | `config.py:54`; `limiter.py:1-13`, `:159` |
| Sentence soft cap | 160 chars (min 40) | `sentence_buffer.py:18`, `:64` |
| Sentence punctuation | `. ! ?` only | `sentence_buffer.py:19` |
| Open-paren hold / open-pause hold | 60 / 8 chars | `sentence_buffer.py:25-26` |
| Idle flush | 0.12 s | `engine.py:88` |
| Flush-ahead | 3 free sentences; then `<3` unheard and `<8000 ms` ahead; estimate lag 500 ms; recheck 0.25 s | `call_tts_elevenlabs.py:55-59` |
| Ledger default rate | 65 ms/char (about 15 chars/s) | `call_ledger.py:56` |
| Billing cadence (EL) | each sentence start or every 2000 ms delivered | `engine.py:117`, `:2507` |
| User credit | 1 credit per 10 s of STT+TTS audio | `engine.py:81`, `:3398-3401` |
| Call moderation timeout | 0.3 s per sentence, fail-closed; 24 h verdict cache | `moderation.py:23-27`, `:73` |
| Spend list price | 40 µUSD/char ($0.04 per 1K chars; v4 Turbo uses the Flash rate) | `spend_circuit.py:63`; `engine.py:3632-3634` |
| Playback report rate limit | 4 frames/s | `engine.py:119` |
| Max assistant reply | 8,000 chars | `transcript_sanitizer.py:12` |
| Dead constant | `VOICE_TTS_QUEUE_MAX_SENTENCES = 4` (defined, never used) | `engine.py:85` |
| Fish model | `drama-3` | `fish_audio/config.py:7` |
| Fish output | mp3, 44.1 kHz, 128 kbps; `chunk_length=100`, `latency='balanced'` | `timestamp_ws.py:210-212` |
| Fish per-generation caps | 1,200 chars, 64 units, 128 chunks, 20 MB, 90 s turn timeout | `timestamp_ws.py:26-31`, `:162-167`, `:192-196`; `streaming.py:109` |
| Fish lease | 120 s `lease_until`, 100 ms poll up to 5 s when concurrency is full | `admission.py:84`, `:149-161` |
| Fish queues | pending 4 sentences, output 8 chunks | `streaming.py:24-25` |

---

## 5. Critical path latency (user stops speaking → first audio byte leaves the BFF)

This covers only the TTS-owned stages after STT and LLM admission. The upstream stages (client VAD hangover, upload, STT, LLM TTFT) belong to other subsystem notes.

| # | Stage | Estimate (ms) | Evidence | Notes |
| --- | --- | --- | --- | --- |
| T0 | Socket ready | 0 when open; else residual of a 100-400 ms TLS+WS handshake not hidden by STT | `engine.py:2044`; `tts_multicontext_ws.py:329-333`, `:511-527` | The socket idle-closes 20 s after the last message (`:81-82`, `:774-781`). Prewarm runs at segment upload. INFERENCE for the handshake cost |
| T1 | Context init | 0 on the critical path | `engine.py:2585`; `tts_multicontext_ws.py:363-364` | Sent at LLM admission, before the first token |
| T2 | LLM writes the first full sentence | 100-600 (sentence length / token rate) | `sentence_buffer.py:154-180` | Sentence-level only, with no clause/comma early flush. CJK never cuts (see BE-TTS-02) |
| T3 | Boundary confirmation | 10-30 typical, 120 max | `sentence_buffer.py:173-176`; `engine.py:88`, `:2565-2570` | A boundary at the end of the buffer waits for the next delta or the 120 ms idle tick |
| T4 | Delta frame send before buffering | 0-5 per delta | `engine.py:2613-2618` | Awaited client WS send under a lock shared with audio frames |
| T5 | Per-sentence moderation | 0 on a cache hit; about 100-300 on a miss (hard cap 300) | `engine.py:2393`, `:3328`; `moderation.py:73`, `:721` | LLM classifier via api.magic_llm. A timeout makes the sentence **silent** (fail-closed) |
| T6 | Sanitize + render | < 1 | `engine.py:2417-2419` | Pure regex functions |
| T7 | Flush gate | 0 for sentences 0-2 | `call_tts_elevenlabs.py:160-162` | |
| T8 | WS send + EL TTFB (`eleven_v4_turbo`, mp3) | about 150-500 (UNKNOWN) | `tts_multicontext_ws.py:638-641` | No in-repo measurement found for v4 Turbo over TTD |
| T9 | Receive → decode → queue → drain → client send | 1-5 server side | `:705-743`; `engine.py:2470-2485`; `delivery.py:256-268` | JSON + base64 (+33% bytes) |
| T10 | Billing writes before the *next* chunk | 10-60 per occurrence (INFERENCE) | `engine.py:2507-2508`, `:3378-3440` | Inline DB: `record_call_usage`, `get_session`, `update_session_metadata` |
| F1 | Failure: first-audio timeout | +3000, then reconnect plus replay TTFB | `tts_multicontext_ws.py:76`, `:1009-1013` | Also the path for a half-open socket (BE-TTS-14) |
| Fish-a | Lease + connect (overlapped with LLM) | 5-30 DB + 100-300 TLS | `streaming.py:180`, `timestamp_ws.py:214-215` | Polls 100 ms up to 5 s when concurrency (default 1) is full |
| Fish-b | Dictionary DB + moderation + `extend_stream` DB per sentence | 10-70 + 0-300 | `performance.py:9-15`; `admission.py:103-142` | `SELECT … FOR UPDATE` on the account row plus a daily `SUM` |
| Fish-c | Fish TTFB | about 1,700 (one probe) | `/home/andres/WebstormProjects/magic-worlds/docs/fish_audio_support/17_call_transport_development.md` ("First audio arrived at 1,686 ms") | Doc evidence, single sample, measurement origin unclear |

**EL steady-state TTFA (after LLM TTFT), INFERENCE:** about 260-1,400 ms, typically about 400-800 ms. That is T2 + T3 + T5 + T8. Moderation (T5) is the largest app-owned, removable term.

---

## 6. Findings

Severity: critical / high / medium / low / info.

### BE-TTS-01: Per-sentence LLM moderation is serial on the first-audio critical path, and its timeout silently mutes sentences (high, latency)
- FACT: `prepare` awaits `_call_sentence_verdict` before the first sentence can be pushed (`engine.py:2393-2414`). The verdict is one classifier call per sentence through api.magic_llm with a 300 ms timeout (`moderation.py:23-27`, `:73`, `:705-740`). On timeout/error the outcome is `unavailable` and the sentence is dropped (fail-closed); a `moderation_unavailable` frame is sent once per turn (`engine.py:2400-2414`, `:3336-3349`). The docstring says the look-ahead (`check_ahead`) is "not built" (`engine.py:3309-3311`; `moderation.py:32-38`).
- Impact: adds 0-300 ms to every turn's TTFA on cache misses (almost all live sentences are unique). Classifier p95 slowness turns into **silent sentences** and audible gaps in replies. The cost is one LLM classification per spoken sentence.
- Recommendation: (a) cut first-sentence moderation latency with a fast local classifier or deterministic filter, keeping the LLM classifier asynchronous for later sentences; (b) pipeline `check_ahead` so sentence N+1 is classified while N is synthesized or played; (c) if policy allows, speculative synthesis that holds audio delivery until the verdict arrives. This conflicts with D26 "nothing reaches a provider before it passes", so a policy decision is needed. (d) Record per-turn moderation latency and the timeout rate. (e) Consider a softer degraded mode, such as fail-open for low-risk surfaces with post-hoc review, instead of mute.

### BE-TTS-02: Sentence segmentation recognises only ASCII `. ! ?` plus spaces; CJK/Thai replies get no audio until the LLM finishes (high, latency, confidence medium)
- FACT: `_SENTENCE_PUNCT = {".","!","?"}` (`sentence_buffer.py:19`). A boundary needs whitespace after the punctuation (`:177-178`). The soft-cap cut needs an ASCII space (`:208-212`). Repro: feeding `"こんにちは。元気ですか？…"` emits nothing until `flush()`. The v4 Turbo allow-list includes `ja, zh, ko, th, yue, my, lo` (`capabilities.py:82-94`). The call language comes from the chat's last turn language (`routes/user/route_voice_call.py:568-592`).
- Impact: in those languages the first audio waits for the whole LLM reply, which can be seconds, and the flush-ahead gate cannot pace anything.
- Recommendation: add full-width terminators `。！？` (and `…`, `；` for the first chunk), Devanagari `।`, Arabic `؟`, plus a character-count fallback cut for scripts without spaces. Use a proper multilingual segmenter (e.g. ICU/BlingFire or a pysbd-style tokenizer) with a per-language abbreviation list.

### BE-TTS-03: First audio waits for a complete sentence, and the abbreviation list suppresses common boundaries (medium, latency)
- FACT: no clause-level (comma/semicolon/dash) or min-words early flush exists for the first unit (`sentence_buffer.py:70-90`, `:154-180`). `_ABBREVIATIONS` includes `no` and `am` (`:11-16`), so `"No. I won't go there."` and `"Yes, I am. Let's go."` stay one unit. Spanish `"Creo que no. Vamos ya."` is held entirely. Spanish abbreviations (`Sra.`, `Dra.`, `Ud.`) are absent, so `"La Sra."` is spoken as its own sentence, which breaks prosody (repro run on the module).
- Impact: TTFA grows with the length of the first sentence. Roleplay openers such as "Well, my dear traveler, before we …" can be 100+ chars. Spanish, the second app language, splits in the wrong places.
- Recommendation: allow the **first** unit to flush at a clause boundary after about 20-40 chars or 4-6 words (later units keep sentence granularity for prosody). Remove `no`/`am` from the abbreviation list or require a following capital or digit. Add per-language abbreviations (es: `sr, sra, srta, dr, dra, ud, uds, etc`).

### BE-TTS-04: A reconnect drops the unplayed tail of a reply whose context is already `closing`, and reports the turn as complete (medium, correctness)
- FACT: `_restart_socket` releases `dead` **and `closing`** contexts and replays only `open`/`init_pending` ones (`tts_multicontext_ws.py:853-857`, doc `:20-22`). `_release(completed=False)` enqueues the end sentinel (`:938-945`), so `turn_audio` ends normally. The speaker then marks `audio_complete` and `ledger.mark_audio_complete()` with no error (`call_tts_elevenlabs.py:279-282`). The test codifies it: the `CLOSING` context yields `[]` after the drop (`tests/services/test_elevenlabs_multicontext_ws.py:266-294`). `replace_voice` goes through the same path (`:446-458`).
- Impact: for typical 1-3 sentence replies, `end_turn` (close_context) is sent as soon as the LLM finishes, so the context spends most of its playback in `closing`. Any socket drop or 1011, first-audio timeout of another context, slot-wait reconnect or voice replacement during that time silently cuts the reply. The client gets `voice_turn_end{completed, truncated:false}` and the stored text claims the full reply was spoken.
- Recommendation: treat `closing` contexts with unacked sentences like `open` ones: re-init, replay the unacked sentences, then re-send `close_context`. At minimum, emit a `tts_stream_interrupted` turn error and truncate the stored transcript to what was acked.

### BE-TTS-05: A provider stall after `close_context` is treated as normal completion (medium, robustness)
- FACT: the inter-chunk timeout is skipped for `closing` contexts once audio started (`tts_multicontext_ws.py:992-996`). The 5 s completion-idle rule then releases the context with `completed=True` (`:984-989`), which also **resets the reconnect budget** if it had audio (`:946-947`). There is no check of `context.outstanding()` (unacked sentences) at that release.
- Impact: a mid-reply stall produces about 5 s of silence followed by a "completed" turn with the tail missing, no error and no retry. It also resets the reconnect budget.
- Recommendation: at idle release, if `outstanding()` is true, classify it as a stall (`tts_timeout` / reconnect + replay). Apply the inter-chunk timeout to `closing` contexts that still have unacked text. Count `completion_idle_with_unacked` as a metric.

### BE-TTS-06: One reconnect budget, then the voice is gone for the rest of the call, with no provider fallback or re-open (high, robustness)
- FACT: budget = 1 reconnect, reset only by a completed turn with audio (`tts_multicontext_ws.py:18-23`, `:833-843`). A second failure calls `_fail_leg(stream_interrupted)`. The engine sets `tts_leg_ended=True` (`engine.py:2980-2986`), and it is never cleared (`:2517`, `:3272`). A non-1000, non-`input_timeout_exceeded` close while **idle** (e.g. 1006 on a NAT reset) still spends the budget and reconnects (`tts_multicontext_ws.py:773-783`). A handshake 429 retry also spends it (`:543-549`). There is no cross-provider fallback (Fish, or EL HTTP streaming) for calls.
- Impact: a brief network incident or provider blip (two events within one turn, or one idle drop plus one in-turn failure) turns a long paid call into text-only until the user hangs up and calls again.
- Recommendation: use a time-windowed budget with exponential backoff (e.g. 3 reconnects per 60 s) and allow a fresh socket on the next turn after a cooldown. Use a fallback TTS adapter, e.g. a hedged EL HTTP stream or a secondary provider (LiveKit Agents `tts.FallbackAdapter` is an industry pattern). Do not spend the budget on idle closes.

### BE-TTS-07: Billing DB writes run inline in the audio drain loop (medium, latency/jitter)
- FACT: `deliver` awaits `bill_delivered_tts` when a sentence starts or 2 s of audio accrued (`engine.py:2507-2508`). That calls `_record_billable_audio`, which takes `runtime.billing_lock`, calls `billing_service.record_call_usage` (a DB credit write), then `_persist_billing_metadata` = `store.get_session` + `store.update_session_metadata` (`engine.py:3378-3456`). The drainer cannot pull the next chunk until this completes (`call_tts_elevenlabs.py:269-278`).
- Impact: three or more DB round trips stall chunk forwarding every sentence start (including right after the first chunk) and every 2 s. Under DB contention, or with STT billing holding the same lock, this causes client buffer underruns or audible gaps. Exhaustion is still detected promptly, but the cost lands on the hot path.
- Recommendation: move metering to a per-call background task fed by a queue. Keep the exhaustion check by tracking the remaining credits in memory and enforcing with a small look-ahead. Batch the metadata persistence.

### BE-TTS-08: EL barge-in truncation is sentence-granular although char alignment exists (medium, correctness)
- FACT: `keep_end(played_ms)` keeps through the **end of the last sentence whose audio started** before `played_ms` (`call_ledger.py:13-17`, `:380-392`). Per-character timing is computed (`:277-294`) but used only to find sentence starts and acked chars. The Fish lane cuts at word level (`call_word_ledger.py:91-93`; `word_timing.py` `prefix`).
- Impact: if the user interrupts at the 2nd word of a 25-word sentence, the stored assistant turn, and therefore the LLM's next context, claims the whole sentence was said. That is a SOTA deviation: OpenAI Realtime `conversation.item.truncate(audio_end_ms)`, and Pipecat/LiveKit build transcripts from TTS word timestamps.
- Recommendation: cut at the last word boundary whose char start ≤ `played_ms` using the EL alignment (snap to whitespace), optionally appending an interruption marker ("—") for the LLM.

### BE-TTS-09: Alignment offsets assume the provider echoes exactly `len(sentence)+1` chars per flush, with no resync or validation (medium, robustness; confidence low)
- FACT: `char_offset = epoch_base + epoch_aligned` accumulates the count of received alignment chars (`tts_multicontext_ws.py:718-722`). The ledger assigns each entry a width of `sent_chars + 1` (`call_ledger.py:51-53`, `:206-215`) and maps the cumulative cursor to entries (`:296-302`). Nothing compares `alignment.chars` with the sent text. The fakes echo exact text including the trailing space (`tests/services/test_elevenlabs_multicontext_ws.py:130-160`).
- UNKNOWN: whether `eleven_v4_turbo` TTD alignment includes the trailing separator, audio-tag characters (`[laughs]`, `[short pause]` from `text_pipeline.py:420-436`) or collapsed whitespace.
- Impact: any per-sentence mismatch drifts cumulatively. Later sentences are attributed late or early, which corrupts `keep_end`, `unheard_flushed` (the flush gate) and drained-char abuse counts. Nothing detects it, because `voice_tts_alignment_fallback` fires only on *missing* alignment.
- Recommendation: re-anchor per sentence by matching `alignment.chars` against the sent text (as the Fish word timeline does). Emit an `alignment_drift_chars` metric. Run a live spike with tags and numbers to pin the provider contract.

### BE-TTS-10: The first-audio timeout gives up sentences only locally; late audio still plays after the "delayed" notice (low, ux/robustness)
- FACT: after the budget is spent, a first-audio timeout marks waiting sentences `given_up` and raises `tts_timeout` from `turn_audio` (`tts_multicontext_ws.py:1014-1023`). Nothing is sent to the provider, and `_on_message` does not filter `given_up` (`:705-743`). The engine sends "Voice audio is delayed" and resumes (`engine.py:2975-2979`). The speaker marks those ledger entries `skipped` (`call_tts_elevenlabs.py:284-288`), yet late alignment can still set their `audio_start_ms`. Skipped entries are excluded from `unheard_flushed`, so the gate can over-flush. With the budget unused, the first timeout triggers a full reconnect after 3 s of silence (`:1011-1013`).
- Impact: the user hears a delayed sentence after an error toast, and ledger and flush-gate accounting drift. A 3 s first-audio timeout plus reconnect means at least about 3.3 s of dead air before recovery.
- Recommendation: on a turn-scoped give-up, close the context and open a fresh one (`t_<turn>_r1`) for the remaining sentences. Consider a tighter adaptive first-audio timeout (about p99 TTFB, e.g. 1.2-1.5 s) with a hedged retry.

### BE-TTS-11: The Fish lane has no first-audio or inter-chunk watchdog; a stall can mean up to 90 s of silence (medium, robustness)
- FACT: the only bounds are `asyncio.timeout(90)` around the whole generation (`timestamp_ws.py:162-167`, `:204`) and WS ping 20/20 s (`:208-209`). Neither `FishSpeechCall._run` (`streaming.py:168-226`) nor the speaker adds per-chunk timers. The 90 s window also includes time the flush-ahead gate holds text back.
- Impact: a stalled Fish generation leaves the caller in silence for up to 90 s before `tts_timeout`. A long reply can also hit the 90 s cap legitimately.
- Recommendation: add first-audio (about 2-3 s after the first `flush`) and inter-chunk timers in the transport. Make the 90 s cap relative to the last text sent, not to connect.

### BE-TTS-12: Fish admission does serialized MySQL transactions per lease and per sentence on the critical path (medium, scalability/latency)
- FACT: `_reserve` upserts the account row, `SELECT … FOR UPDATE` (account-wide lock), counts active attempts and SUMs today's estimated cost, then INSERTs (`admission.py:58-95`). `extend_stream` does `FOR UPDATE` on the account plus the attempt, another daily `SUM`, an UPDATE and a spend-repo add **for every sentence** (`:103-142`), awaited before the text is dispatched (`streaming.py:189`). If concurrency is full (default `FISH_AUDIO_CONCURRENCY=1`, `config.py:41`), `call_lease` polls every 100 ms for up to 5 s (`admission.py:149-161`). The lease is fixed at 120 s and never renewed (`:84`, `:118`).
- Impact: every Fish sentence pays 5-50 ms or more of DB time, and all Fish calls across all workers serialize on one row lock. The daily `SUM` grows with traffic. The design is fine for a 1-concurrency dev flag but not scalable.
- Recommendation: reserve budget in larger blocks (e.g. 400 chars) to amortize. Move counters to Redis or atomic increments. Keep the strict per-sentence check only near the budget edge.

### BE-TTS-13: Fish replies over 1,200 chars (or 64 units) abort the generation and drop already-generated audio (medium, robustness)
- FACT: `push_text` raises 422 when `queued_chars + len + 1 > 1200` (`streaming.py:107-110`). The speaker then stops and calls `cancel_turn` (`call_tts_elevenlabs.py:248-257`). `_cancel_generation` empties the output queue (up to 8 generated chunks) (`streaming.py:126-131`). The transport has the same caps (`timestamp_ws.py:28`, `:192-196`). LLM replies may reach 8,000 chars (`transcript_sanitizer.py:12`). The prompt asks for 1-3 sentences, but a story request is "longer".
- Impact: story-style replies on Fish cut off abruptly mid-reply with "Voice audio stopped", losing audio already synthesized.
- Recommendation: roll over to a new generation (epoch+1) at the cap instead of cancelling, or drain the current generation (`stop`) before opening the next.

### BE-TTS-14: The EL socket has no WS ping and no keepalive between turns; half-open sockets surface as a 3 s first-audio timeout (low, latency; confidence medium)
- FACT: `ping_interval=None` (`tts_multicontext_ws.py:522-527`). Keepalive is sent only to `open` contexts (`:1003-1007`). `prewarm()` acts only when `_conn is None` (`:329-333`, `:511-513`).
- INFERENCE: a NAT or LB that silently drops an idle TCP flow between turns (shorter than the provider's 20 s close) leaves `_conn` non-None. The next turn's text vanishes until `FIRST_AUDIO_TIMEOUT_S=3` triggers reconnect + replay.
- Recommendation: enable `ping_interval` (about 10 s) or ping during `prewarm()` at segment upload, and reconnect proactively if no pong arrives within about 300 ms.

### BE-TTS-15: The ElevenLabs session limiter is per process while each call holds a slot for its whole duration (low, scalability)
- FACT: the limiter is in-process, sized as `ttd_session` = flash (24) (`limiter.py:1-13`, `:159`). Each call acquires at open and releases at close, including while idle (`tts_multicontext_ws.py:34-36`, `:266`, `:483-485`).
- Impact: N workers × 24 can exceed the account's dialogue-session limit, which shows up as handshake 429s that spend the reconnect budget (BE-TTS-06). It also caps concurrent calls per worker at 24.
- Recommendation: use a shared (Redis) semaphore with leases, and an admission-time check that returns "busy" before the call starts.

### BE-TTS-16: Calls stream MP3 inside JSON/base64 frames (low, audio-quality/latency)
- FACT: EL uses `mp3_44100_64` and Fish uses mp3 44.1 kHz/128 kbps (`capabilities.py:65`; `timestamp_ws.py:211`). The contract is MP3-only (`delivery.py:67-69`, `:118-122`). Frames are JSON with `data_b64` (`delivery.py:456-466`). The browser uses MSE (`voicePlaybackBuffer.ts:390`).
- INFERENCE: MP3 adds encoder delay and frame padding (about 26 ms per frame, plus priming), and MSE start-up buffering is browser-dependent. Base64 inflates bytes by 33% and costs CPU per chunk. A 44.1 kHz sample rate is unnecessary for voice. Fish's 128 kbps doubles bandwidth on mobile.
- Recommendation: evaluate `pcm_16000`/`pcm_24000` or Opus with an AudioWorklet ring buffer (or WebRTC). Send binary WS frames with a small header. At minimum use `mp3_22050_32` for the call surface.

### BE-TTS-17: Audio produced while the client socket is away is billed and persisted though never heard (low, cost/fairness)
- FACT: `send_audio_chunk` returns `DROPPED` when `websocket is None` (`delivery.py:157-159`, `:266-267`). `deliver` treats it as delivered: it appends, meters and bills (`engine.py:2486-2497`). This is intentional per the comment.
- Impact: users pay credits for audio generated during the resume grace that they never heard. During reconnect storms the provider still generates up to the 3 sentences / 8 s ahead allowed by the gate.
- Recommendation: pause pushing (gate closed) while the socket is away. Bill only on client playback reports, or refund the dropped duration.

### BE-TTS-18: Per-stage TTS latency is not decomposed per turn (low, observability)
- FACT: `voice_turn_audio.ttfb_ms` runs from first sentence ready to first chunk delivered (`engine.py:2913-2924`). That mixes moderation, gate, send, provider TTFB and decode. `moderation_ms` is logged per gate check without a turn id (`moderation.py:648-688`). There is no push→first-byte provider TTFB, no handshake/prewarm duration, no alignment drift, no `completion_idle` release counter and no "sentence muted by moderation timeout" ratio per turn (only `voice_tts_sentence_skipped` events).
- Recommendation: add `tts_provider_ttfb_ms` (first `push_text` → first audio), `tts_moderation_ms` on the first sentence, `tts_socket_connect_ms`, and stage histograms (p50/p95) keyed by provider, model and region. Add a client `playback_started_at` echo to close the loop to heard audio.

### BE-TTS-19: The client text frame is sent before the delta reaches the sentence buffer, and the LLM stream is consumed lock-step (low, latency)
- FACT: `engine.py:2613-2621` awaits `voice_assistant_delta` delivery before `add_spans`. The LLM runner's queue has `maxsize=1` and the producer awaits `consumed` for each event (`llm_turn_runner.py:164-167`, `:199-210`), so the LLM read loop waits on the engine's client-socket sends. The `Started` handler awaits `spend_check` before `start_speaker` (`engine.py:2579-2585`).
- Impact: a slow client socket delays sentence detection, and therefore TTS start and the LLM read rate.
- Recommendation: feed the sentence buffer first, and send text frames through a non-blocking per-call outbox.

### BE-TTS-20: Several smaller correctness and maintainability nits (low, maintainability)
- FACT: `VOICE_TTS_QUEUE_MAX_SENTENCES = 4` is never used (`engine.py:85`; grep shows only the definition). The speaker reads `last_queue_wait_ms` right after `begin_turn` (`call_tts_elevenlabs.py:216-217`), but Fish sets it only after the lease inside `_run` (`streaming.py:179-181`), so the first-audio `queue_wait_ms` reflects the previous turn or `None`. The EL adapter hard-codes `codec="mp3"` regardless of `output_format` (`tts_multicontext_ws.py:730`); this is safe today because only MP3 formats exist (`types.py:88-91`). The sanitizer keeps the words of asterisk actions (`*smiles*` → "smiles") as a fallback when the model disobeys the prompt (`text_pipeline.py:201`, `:220-224`; prompt forbids it in `src/agent_graphs/runtime/callbot_chat.v2.json`).
- Recommendation: delete the dead constant, set Fish queue wait per turn, derive the codec from the format, and drop `*…*` / `_…_` action spans for the speech surface.

### BE-TTS-21: The voice's emotion and tag prefix is not applied on the EL call lane (info, audio-quality)
- FACT: EL `prepare` calls `render_speech_text(…, kind="speech")` without `emotion` (`engine.py:2418-2419`), so `compose_tag_prefix` yields nothing (`emotion_map.py:136-150`). `voice.tag_prefix` is used only by Fish (`engine.py:2389`). Interjections such as `(laughs)` → `[laughs]` and pauses → `[short pause]` are still translated (`text_pipeline.py:420-436`).
- Note: this may be intentional, since a per-sentence prefix tag would be re-applied on every flush. It should be decided explicitly. Tags in a multi-context stream could be sent once at the start of the context.

### BE-TTS-22: Text normalization runs twice (local en/es expansion plus provider `auto`) (info, latency)
- FACT: `number_words.expand_numbers` runs at sanitizer step 6 (`text_pipeline.py:401-402`), and the socket also requests `apply_text_normalization=auto` (`tts_multicontext_ws.py:94`, `:244`).
- INFERENCE: for en/es, provider normalization is redundant. On some EL models it adds latency. Measure `off` for en/es.

---

## 7. Strengths (FACT)

- **Prewarm and early context init**: the socket opens at call start (`engine.py:883`) and reopens during STT (`:2044`). The provider context is initialized at LLM admission, before the first token (`:2585`; test `tests/voice/test_voice_turn_latency.py:78`).
- **Proper use of multi-context for interruption**: one context per turn, never reused (`tts_multicontext_ws.py:3-5`, `:337-338`). Barge-in sends `voice_cancelled` to the client before closing the provider context (`engine.py:1966-1976`). Dead-context frames are dropped at the receiver (`tts_multicontext_ws.py:698-704`). Delivery drops chunks of cancelled turns (`delivery.py:247-249`).
- **Flush-ahead gate** bounds provider spend and drained characters on barge-in (≤3 unheard sentences, <8 s ahead), paced by real client playback reports, with an estimate fallback (`call_tts_elevenlabs.py:14-21`, `:150-167`). This matches the SOTA "don't synthesize far ahead" practice.
- **Resilience engineering on EL**: classified handshake/in-band/close errors, a voice-scoped replacement path, a jittered 429 retry, breakers, a limiter, a keepalive before the 20 s inactivity limit, idle-close detection that does not spend the budget for 1000/`input_timeout_exceeded`, and replay of unacked sentences with offset continuity (`tts_multicontext_ws.py:518-564`, `:765-831`, `:863-877`).
- **Careful sentence buffer**: decimals, ellipsis, initials, open `(cue)`/`<#pause#>` markers held with escape limits, a soft cap at whitespace, a 120 ms idle release and exact span offsets for the ledger (`sentence_buffer.py`; 20 tests in `tests/voice/test_sentence_buffer.py`).
- **Text pipeline**: fail-closed tag allow-list, markdown/emoji/OOC stripping, en/es number expansion with Spanish gender agreement, interjection → audio-tag mapping, and no text in logs (`text_pipeline.py:1-31`, `number_words.py:1-37`).
- **Fish lane design**: word-level revisable timestamps for truncation, epoch isolation of stale frames, connect-early overlap, MP3 frame validation, and a deliberate no-replay rule to avoid duplicate speech and spend (`streaming.py`, `timestamp_ws.py`, `word_timing.py`, `call_word_ledger.py`).
- **End-to-end metric**: `user_stop_ttfb_ms` = client VAD lag + route lead + segment → first audio (`engine.py:2906-2910`), plus first-delta and first-sentence milestones (`:2538`, `:2612`).
- **Privacy**: keys sent only in headers. Logs are restricted to safe fields (`tts_multicontext_ws.py:101-113`, `:1029-1032`).
- **Test depth**: 40+ adapter cases (`tests/services/test_elevenlabs_multicontext_ws.py`), flush-ahead and contexts (`tests/voice/test_flush_ahead_and_contexts.py`), and Fish engine tests (`tests/voice/test_fish_call_engine.py`).

---

## 8. Cost notes

- EL call TTS is metered at text send at list price, 40 µUSD/char = $0.04 per 1K chars (`engine.py:2433-2439`, `:3184-3213`, `:3632-3634`; `spend_circuit.py:63`). INFERENCE: about 15 chars/s of speech is about 900 chars per minute of assistant audio, roughly $0.036 per assistant-minute at list price. Separators (+1 char per sentence) and audio tags count as characters. Real provider pricing for `eleven_v4_turbo` is UNKNOWN; the `character-cost` header is not available on WS.
- The flush-ahead gate caps waste on barge-in at about ≤3 sentences / <8 s of audio. Drained characters are tracked for abuse (`engine.py:3351-3376`).
- Per-sentence LLM moderation adds an LLM call per spoken sentence (BE-TTS-01). Its 24 h cache rarely hits for live dialogue.
- User billing: 1 credit per 10 s of combined STT+TTS audio, metered on delivered MP3 frames (`engine.py:81`, `:3378-3420`), including frames dropped while the socket is away (BE-TTS-17).
- Fish: configured price per million chars or UTF-8 bytes. The S2 default is $15/M (`fish_audio/config.py:46-47`, `:103-113`). The daily budget defaults to $1 (`:42`).

---

## 9. SOTA comparison (realtime cascaded voice agents)

| Practice | Here | Gap |
| --- | --- | --- |
| Persistent, prewarmed TTS connection | Yes for EL (call-level, reopened during STT). Fish connects per turn, early | No WS ping (BE-TTS-14) |
| Stream LLM tokens into TTS with minimal buffering | Sentence-level with flush per sentence | No first-clause flush (BE-TTS-03); moderation per sentence adds serial latency (BE-TTS-01) |
| Multilingual segmentation | ASCII punctuation only | CJK/Thai broken (BE-TTS-02) |
| Barge-in: cancel provider generation | Yes (`close_context`, dead-frame drop) | n/a |
| Truncate history to what was heard | Fish word-level; EL sentence-level | BE-TTS-08 |
| Word or char timestamps | Yes (EL chars, Fish words) | EL drift unguarded (BE-TTS-09) |
| Bounded synthesis ahead of playback | Yes (flush-ahead gate) | n/a |
| Failover / hedging | Reconnect once + replay | No cross-provider fallback; leg ends permanently (BE-TTS-06) |
| Stall detection | EL timers (except the `closing` stall); Fish only 90 s | BE-TTS-05, BE-TTS-11 |
| Low-latency audio transport | MP3 in JSON/base64 to MSE | PCM/Opus binary frames would cut latency (BE-TTS-16) |
| Per-stage latency histograms | Partial | BE-TTS-18 |

---

## 10. Open questions

1. Real `eleven_v4_turbo` TTD TTFB p50/p95 per region, and whether `apply_text_normalization=off` reduces it.
2. Does the TTD alignment echo the trailing space and audio-tag characters exactly (BE-TTS-09)? Does the provider always send `isFinal` after `close_context` (BE-TTS-05)?
3. Production moderation classifier p50/p95 and the `moderation_unavailable` rate for `surface=call`.
4. Are CJK/Thai calls used? What share of call languages is outside en/es?
5. How many API workers run in production (in-process limiter, BE-TTS-15)?
6. Does ElevenLabs answer WS pings on the dialogue socket? Have half-open sockets been observed (BE-TTS-14)?
7. Fish `latency` modes beyond `balanced`, the measurement origin of the 1,686 ms first-audio probe, and Fish socket reuse after `finish`.
8. Is the missing emotion prefix on EL calls intentional (BE-TTS-21)?
9. MSE start-up buffering on the frontend (cross-ref FE audit) and whether a PCM/Opus path is acceptable for the call contract.

---

## Verification (adversarial)

An independent pass reopened every cited line (and the code around it) to try to refute each finding. Paths are relative to `magic-worlds-api/`. The `sentence_buffer.py` claims were re-run against the module with Japanese, Chinese, Korean, Thai, English and Spanish streams.

| id | verdict | corrected severity | evidence / note |
| --- | --- | --- | --- |
| BE-TTS-01 | confirmed | high | `call_tts_elevenlabs.py:237` awaits `prepare()` before `push_text`; `engine.py:2393` awaits `_call_sentence_verdict` → `gate.check` (`moderation.py:574-650`), with the call timeout of 0.3 s (`moderation.py:73`, `:715`). On a timeout or error the verdict is `UNAVAILABLE` (`:719-729`). With `VOICE_MODERATION_REQUIRED` defaulting to true (`moderation_transport.py:122-129`), the sentence is dropped. `check_ahead` exists (`moderation.py:551`) but nothing calls it. The `moderation_unavailable` frame is sent once per turn through the `tts_error_frames` dedup (`engine.py:3005-3012`). Nuance: the pusher already moderates sentence N+1 while N plays, so the serial cost lands mainly on the first sentence, which is the TTFA. |
| BE-TTS-02 | adjusted | medium | Reproduced for ja and zh: the buffer emits nothing until `flush()`, and `take_finished` (the idle path) also returns None. **Korean is wrong in the finding**: it uses ASCII `. ! ?` plus spaces and splits normally. **Thai** is only partly affected: the 160-char soft cap cuts at spaces, so it is delayed but not held to the end of the reply. Lowered to medium because en/es (the product's languages) are unaffected. The impact is real for ja/zh/yue calls, which `capabilities.py:82-94` and the turn-language resolution (`route_voice_call.py:555-592`) allow. |
| BE-TTS-03 | confirmed | medium | `sentence_buffer.py:11-16` lists `no`/`am`. A repro gave `"No. I won't go there."` and `"I am. Let's go now."` merged, `"Creo que no. Vamos ya."` held as one unit, and `"La Sra."` emitted alone (`sra` is missing). There is no clause or min-words first flush, only sentence boundaries, the 160-char soft cap and the idle `take_finished`. |
| BE-TTS-04 | adjusted | medium | Mechanism confirmed: `_restart_socket` (`tts_multicontext_ws.py:845-862`) and `_on_voice_error` (`:879-893`) release `closing` contexts with `completed=False`. That queues the `None` sentinel, so `turn_audio` ends cleanly (`:411-423`), `_drain` sets `audio_complete` (`call_tts_elevenlabs.py:279-282`), and the engine stores `turn.collected_text` untruncated (`engine.py:2722-2727`). The test (`test_elevenlabs_multicontext_ws.py:266-294`) asserts `CLOSING == []`. **Correction**: the exposed window is the provider's generation tail (from `close_context` until `isFinal`, or 5 s idle), not "most of playback". Audio already received is unaffected, and only sentences still unacked are lost. |
| BE-TTS-05 | confirmed | medium | `_tick` (`tts_multicontext_ws.py:979-996`): a `closing` context with audio skips the inter-chunk timer (`if context.state == "closing" and not first: pass`). It is released 5 s after `max(close_sent_at, last_audio_at)` with `completed=True`, and `outstanding()` is never checked. `_release` then resets `_budget_used` (`:946-947`). |
| BE-TTS-06 | confirmed | high | Budget of 1 (`:833-843`), reset only by `_release(completed=True)` with audio (`:946-947`). A handshake 429 spends it (`:543-547`). An idle close that is not 1000 and not `input_timeout_exceeded` falls through to `_on_failure` (`:766-781`). The reconnect is immediate, with no backoff, so a second failure (for example a connect failure during an outage longer than 3 s) calls `_fail_leg`. `runtime.tts_leg_ended` is only ever set to True (`engine.py:2956/2968/2981/2849`) and gates `start_speaker` (`:2517`) and `prewarm` (`:3272`). No fallback adapter was found anywhere in `src`. |
| BE-TTS-07 | confirmed | medium | `deliver()` awaits `bill_delivered_tts` on sentence start or every 2 s (`engine.py:2507-2508`). That runs `_record_billable_audio` under `billing_lock` (shared with STT billing): `record_call_usage` → `MembershipModel.debit_operation_credits` when a new second or credit is due, then always `get_session` and `update_session_metadata` (`:3378-3456`). Nuance: the chunk that triggered the bill was already sent to the client. The stall delays the next chunks, which the provider queue buffers, so gaps need DB latency comparable to the client's buffered audio. That is most likely right after first audio. |
| BE-TTS-08 | confirmed | medium | `CallTurnLedger.keep_end` returns the `span_end` of the last sentence started before `played_ms` (`call_ledger.py:380-392`). Per-char `acked_chars` and `audio_end_ms` are computed (`:277-294`) but not used for the cut. The Fish `WordCallTurnLedger.keep_end` uses the word-timeline prefix (`call_word_ledger.py:91-93`). Note: this is the documented D06 item 3 rule, a deliberate design choice and not an accident. |
| BE-TTS-09 | confirmed | medium | `char_offset = epoch_base + epoch_aligned`, and `epoch_aligned` grows by the received alignment length (`tts_multicontext_ws.py:714-722`). `_ack` compares it with sent-length offsets (`len+1`, `:615-643`, `:747-752`). The ledger maps onto `sent_chars + 1` widths (`call_ledger.py:51-53`, `:277-302`). Nothing compares alignment chars with the sent text, and the fakes echo it exactly. The call profile `el_v4_turbo` has `supports_audio_tags=True` (`capabilities.py:148-151`), so tags can reach the provider text. That makes the mismatch plausible, but real-world drift is **unverified**: it needs the live spike. |
| BE-TTS-11 | confirmed | medium | The only bounds are `asyncio.timeout(self._turn_timeout)` (90 s, `timestamp_ws.py:162-167`, `:204`) around connect, the wait for units and every `recv`, plus `ping_interval=20, ping_timeout=20` (`:209`). `FishSpeechCall._run` (`streaming.py:168-226`) and the speaker's `_drain` add no timer, and the engine has no audio watchdog (its `_watchdog` only enforces call limits, `engine.py:1823-1836`). |
| BE-TTS-12 | confirmed | medium | `_reserve` (`admission.py:58-95`) runs an INSERT…ODKU, then an account-row `SELECT … FOR UPDATE`, a COUNT of active leases and a daily `SUM`. `extend_stream` (`:103-142`) runs per unit inside `units()` before the text is yielded to the sender (`streaming.py:189`), with the same `FOR UPDATE`, a `SUM`, an UPDATE and a spend-repo add. `call_lease` polls every 100 ms for 5 s (`:149-161`). `lease_until` is +120 s at insert, and no code renews it. `concurrency` defaults to 1 (`config.py:41`) and can be configured up to 100. The lane is gated by `calls_enabled` and `available('admin_lab')`. |
| BE-TTS-13 | confirmed | medium | `push_text` raises `fish_error(422)` past 1,200 queued chars (`streaming.py:107-113`), and `send_units` does the same past 64 units or 1,200 chars (`timestamp_ws.py:190-196`). The speaker's Word-ledger branch then calls `on_error` → `cancel_turn` (`call_tts_elevenlabs.py:248-257`). `_cancel_generation` empties `output` and cancels the task (`streaming.py:126-135`), so queued and already-sent-but-ungenerated audio (up to the flush-ahead window of about 8 s) is lost. The engine's Fish branch sends "Voice audio stopped; the reply continues as text." (`engine.py:2947-2962`). `MAX_VOICE_ASSISTANT_CHARS = 8_000` (`transcript_sanitizer.py:12`). |
