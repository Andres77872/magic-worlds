# Audit: backend observability, latency metrics, moderation/safety in the loop, cost controls

Subsystem: live voice call ("phone a character"), cascaded pipeline. This note covers the BFF
(`magic-worlds-api`) pieces that **measure** the call (events, metrics, alerts, admin UI), the
pieces that **gate** it for safety (pre-TTS moderation, companion self-harm screen, abuse
counters) and the pieces that **meter and cap its cost** (quota reservations, per-call credit
billing, daily spend circuit, provider breakers/limiter).

Audit date: 2026-10-20. Code read-only. Every claim carries a `file:line` that was opened.
Labels: **FACT** (seen in code), **INFERENCE** (reasoned from code/docs, not measured),
**UNKNOWN** (not determinable from the repos).

Repos and short prefixes used below:

- `API` = `/home/andres/PycharmProjects/magic-worlds-api`
- `FE` = `/home/andres/WebstormProjects/magic-worlds`
- `LLM` = `/home/andres/PycharmProjects/api.magic_llm`

---

## 1. Executive summary

1. **Moderation is the single biggest risk on the call critical path.** Every TTS-bound
   sentence is awaited through an LLM classifier executed by `api.magic_llm` with a **300 ms
   fail-closed budget**, serially, before the sentence is pushed to TTS
   (`API/src/services/speech/moderation.py:73`, `API/src/services/voice_orchestration/engine.py:2393`,
   `API/src/services/voice_orchestration/call_tts_elevenlabs.py:237`). The project's own
   validation shows the classifier missing a **2 s** budget (2,003 ms) on the preview surface
   (`FE/docs/fish_audio_support/18_call_engine_development.md:126-131`). With production
   defaults (`VOICE_MODERATION_REQUIRED=true`) a classifier that cannot answer in 300 ms makes
   calls speak nothing (text only); with the classifier off the surface gate refuses calls; with
   `VOICE_MODERATION_REQUIRED=false` (the dev setting) text reaches TTS unmoderated. There is no
   configuration today that is both safe and audible. The look-ahead hook (`check_ahead`) exists
   but is unused (`moderation.py:551-569`).
2. **Self-harm detection on calls is inert.** The companion-safety detector has empty phrase
   lists and no classifier wired (`API/src/services/speech/companion_safety.py:16-27`,
   `companion_safety_lists.py` "intentionally EMPTY"). The moderation gate's `self_harm`
   category only suppresses *audio*; the reply text is streamed to the user before moderation
   runs (`engine.py:2613-2616` vs `engine.py:2393`).
3. **End-to-end latency is only partially measured and never alerted.** The D06
   "user stops speaking -> first audio" value (`user_stop_ttfb_ms`) is computed
   (`engine.py:2906-2910`) but excludes upload transit, downlink and browser playout; it lives
   only in an in-process histogram (lost on restart), has no alert and no SLO. The only latency
   alert watches `call_first_audio_ms` = "first sentence ready -> first TTS byte", which also
   silently includes the moderation wait (`metrics.py:1374`, `metrics.py:1467-1482`). STT, LLM
   TTFT and first-sentence timings are log-only events, and the LLM event is labelled with the
   **TTS** model (`engine.py:2612`, `engine.py:1686-1697`).
4. **Billing writes sit on the critical path.** STT credit debit (a multi-statement locking
   MySQL transaction plus a session read/write) is awaited after STT and before the LLM, on
   every turn (`engine.py:2244-2251`, `engine.py:3378-3455`). TTS debits are awaited inside the
   audio drain loop (`engine.py:2507-2508`), so DB latency stalls chunk forwarding.
5. **Observability plumbing loses data silently.** The allowlist sanitizer drops whole events'
   payloads (the billing event keeps only two ids; segment rejections lose `stage`/`reason`),
   the WS lane's structured fields go into `extra=` that neither log formatter prints, there is
   no metrics exporter, the alert monitor is off by default and alerts are ERROR log lines.
6. **Cost control covers TTS only.** The daily spend circuit meters TTS characters; STT audio
   seconds, callbot LLM tokens and moderation classifier tokens are outside it, and nothing rolls
   the four up per call.

Strengths are real (privacy-by-allowlist events, a thoughtful D06 metric design, fail-closed
defaults, atomic quota reservations, idempotent billing keys, breakers with half-open probes,
spend circuit that degrades to text, crisis resources UI). See section 9.

---

## 2. Architecture walkthrough (what exists today)

### 2.1 Event recorder and sanitizer

- `VoiceObservabilityRecorder.record(name, **fields)`
  (`API/src/services/voice_orchestration/observability.py:164-175`): sanitizes fields, appends
  to a bounded deque (2,048 events, `observability.py:20`), logs one line
  `voice_event name=%s at_ms=%s fields=%s` with the **Python dict repr** of the fields, and feeds
  `speech.metrics` (`feed_speech_metrics`).
- `emit_speech_event` (`observability.py:184-195`): same, unbuffered, for code outside a call.
- Sanitizer (`observability.py:319-339`): a key survives only if it is in
  `SAFE_OBSERVABILITY_FIELDS` (`observability.py:22-106`) **and** contains none of the
  forbidden markers (`observability.py:117-133`: `transcript, content, prompt, audio, bytes,
  base64, hex, url, token, authorization, api_key, trace_id, voice_id, request_body,
  response_body`). Strings are regex-redacted and capped at 120 chars
  (`observability.py:337-339`; patterns at `API/src/services/voice_orchestration/errors.py:78-95`).
  Dropped keys are dropped **silently** (no counter, no debug log).
- Timestamps: `now_ms()` = `int(time.time()*1000)` (wall clock) and `elapsed_ms` is a wall-clock
  difference clamped at 0 (`observability.py:311-316`).

### 2.2 In-process metrics

`SpeechMetrics` (`API/src/services/speech/metrics.py:258-506`): counters, gauges, histograms
(newest 2,048 samples per key for p50/p95, `metrics.py:123`, `metrics.py:230-255`), requests per
UTC day, 10 s buckets for the last hour, and one **timed** histogram
(`TIMED_HISTOGRAMS = {"call_first_audio_ms"}`, `metrics.py:129`). Keyed `(metric, provider)`.
Process-local, reset on restart (`metrics.py:7-14`). No exporter: "The BFF has no metrics library
(Q-07 picks an exporter)" (`metrics.py:4`). The BFF runs one uvicorn process with no `workers`
argument (`API/src/serve.py:28-33`), so process-local is at least internally consistent.

Event -> metric mapping (`metrics.py:755-776`, handlers `metrics.py:540-753`). Call-relevant:

| Event (producer) | Metric | Note |
|---|---|---|
| `voice_call_started` (`engine.py:930-937`) | `calls_started`, requests/day | |
| `voice_call_ended` (`engine.py:1188-1195`) | `calls_ended`, `calls_with_tts_failure` | only when `tts_failures` present (`metrics.py:545-552`) |
| `voice_turn_audio` (`engine.py:2913-2924`) | histogram `call_first_audio_ms` (timed, 1 h window) | `ttfb_ms` = first sentence ready -> first audio chunk |
| `voice_first_assistant_audio` (`engine.py:2910`) | `call_segment_to_first_audio_ms`, `call_user_stop_to_first_audio_ms` | D06 metric |
| `voice_turn_failed` (`engine.py:3156-3164`) | `call_turns_failed`, `call_turn_tts_failures` | |
| `moderation_verdict` (fed directly by the gate, `moderation.py:682-690`) | `moderation_<outcome>`, `moderation_ms` | not split by surface |
| `provider_request` (ElevenLabs HTTP `tts_http.py:92-137`; Fish runtime `fish_audio/runtime.py:55-59`) | `provider_requests/_errors/_429`, `provider_ttfb_ms`, `provider_latency_ms` | the **ElevenLabs call WS lane emits none** |
| `breaker_state` (`breakers.py:73-95`) | `breaker_open_<name>` gauges | |
| `voice_ws_close` (`engine.py:1699-1712`) | `call_input_timeout_closes` | keepalive-bug counter |
| `spend_circuit` | `spend_budget_pct` gauge | **no producer exists** (grep: only `metrics.py:62,627`) |
| `companion_safety_pause` / `_classifier_error` | counters | |

Events that are **log-only** (no metric): `voice_segment_received` (`engine.py:2210`),
`voice_stt_completed` (`engine.py:2233-2242`), `voice_turn_admitted` (`engine.py:2578`),
`voice_llm_first_delta` (`engine.py:2612`), `voice_tts_first_sentence` (`engine.py:2538`),
`voice_tts_first_audio` (`engine.py:2896-2905`), `voice_turn_finalized` (`engine.py:2756-2767`),
`voice_barge_in` (`engine.py:1399-1410`), `voice_turn_truncated` (`engine.py:1521-1529`,
`1621-1629`), `voice_tts_sentence_skipped` (`engine.py:2421-2428`, `3340-3348`),
`voice_call_billing_recorded` (`engine.py:3426-3437`), `voice_call_text_only` (`engine.py:2850-2856`).

### 2.3 DB aggregates, alerts, monitor, admin route and UI

- Root-only route `GET /admin/voices/metrics/{narration,calls,provider,moderation,spend}`
  (`API/src/routes/admin_voice_metrics.py:75`, root check `:85-88`), every query with
  `MAX_EXECUTION_TIME(5000)` (`metrics.py:802`, `metrics.py:841-846`). `/calls` returns
  `call_aggregates` (calls per provider/status, `consumed_seconds`, TTS-failure rate; DB has
  **no first-audio time**: `metrics.py:1168-1169`) plus the process snapshot of metrics starting
  with `call`, and evaluates `evaluate_call_alerts` + `evaluate_first_audio_alerts`
  (`admin_voice_metrics.py:158-176`).
- Alert rules: call TTS failure > 3 % over 1 h with >= 20 calls, else >= 3 failed calls
  (`metrics.py:1451-1464`); **first audio p50 > 400 ms** on `call_first_audio_ms` with >= 20
  distinct calls (`metrics.py:1374`, `metrics.py:1467-1482`); provider 429 share,
  billing/config breaker open, account events (`metrics.py:1485-1533`); keepalive bug
  (`metrics.py:1536-1547`); spend bands 50/80/95/100 (`metrics.py:1551-1567`).
- Monitor: `SpeechMetricsMonitor` runs every 300 s **only when
  `VOICE_METRICS_MONITOR_ENABLED=true` (default false)** (`metrics.py:1648-1660`), evaluates
  narration, call, first-audio, provider and keepalive rules (`metrics.py:1691-1712`; **not**
  spend), and "alerts" are `logger.error("voice_alert ...")` lines deduplicated 15 min
  (`metrics.py:1570-1606`). No pager/alert channel ("until the owner picks a channel (O-3)",
  `metrics.py:44-46`).
- Frontend: root console `MetricsModule` (`FE/src/features/admin/voices/components/metrics/MetricsModule.tsx:29-122`);
  the Calls view shows calls/outcomes/minutes/TTS failure and a "First audio, last hour" table
  of `call_first_audio_ms` (`CallMetricsView.tsx:16`, `:37-50`) with an honest hint
  ("first sentence ready to first audio frame. Target p50 <= 250 ms and p95 <= 600 ms",
  `FE/src/app/i18n/locales/adminVoices.ts:1035`). The end-to-end histogram is only visible as a
  raw row in the generic process panel (`MetricsTable.tsx:170-190`).

### 2.4 Moderation in the call loop

- Gate: `ModerationGate.check` (`API/src/services/speech/moderation.py:574-646`): cache (24 h,
  10k entries, keyed by SHA-256 of policy version + language + exact text,
  `moderation.py:79-80`, `:417-419`, `:606-611`) -> deterministic lists (EMPTY pending sign-off,
  `moderation_lists.py:1-8`, `:37-46`) -> classifier per sentence for calls
  (`moderation.py:702-707`) under `asyncio.timeout(0.3)` (`moderation.py:73`, `:720-726`).
  Timeout/error -> `unavailable` (`moderation.py:724-734`). Fresh blocks are reported to the
  abuse hook **inline** (`moderation.py:742-779`), which is a DB transaction
  (`abuse.py:144-146`, `:148-192`).
- Required vs optional: `VOICE_MODERATION_REQUIRED` default **true** (fail closed);
  `false` lets unclassified text pass "unmoderated" (`moderation.py:438-443`, `:636-641`;
  `moderation_transport.py:122-129`). Classifier enabled only with
  `VOICE_MODERATION_CLASSIFIER_ENABLED=true` + profile transport + published profile
  (`moderation_transport.py:9-15`, `:533-534`; wiring `API/src/main.py:1040-1054`).
- Surface gate: calls are admitted only if `passes_text` (classifier configured or moderation
  optional) (`API/src/services/speech/surface_gate.py:138-156`).
- Transport: plan (catalog + profile) cached 300 s with stale-while-revalidate, single-flight
  shielded resolution, user-hash cache 1 h (`moderation_transport.py:92-97`, `:337-394`). Each
  sentence = one `POST /v1/chat/completions` to `api.magic_llm` with the `speech_moderation`
  graph (`moderation_transport.py:447-470`). Token usage is logged only after a successful
  completion (`moderation_transport.py:471-485`).
- Engine use: `_warm_call_moderation` at each segment upload, in the background while STT runs
  (`engine.py:2043`, `engine.py:3279-3291`); `_call_sentence_verdict` awaited inside the
  speaker's `prepare` (`engine.py:2393-2414`, `engine.py:3293-3349`), which the pusher awaits
  serially per sentence (`call_tts_elevenlabs.py:228-264`). Outcomes: `allow` -> TTS; `block`
  -> sentence skipped; `unavailable` -> sentence skipped + one `moderation_unavailable` error
  frame per turn, counted as a call TTS failure (`engine.py:2400-2414`). "The text continues"
  (`engine.py:3305-3306`): deltas are already sent to the client (`engine.py:2613-2616`).

### 2.5 Companion safety (self-harm) in the call loop

- `_start_call_safety_screen` is fired **after** `VoiceLlmTurnStarted` (LLM admission), as a
  background task in parallel with the reply (`engine.py:2596`, `engine.py:3215-3265`). A pause
  sends a fatal `voice_safety_pause` error and ends the call with `voice_restricted`
  (`engine.py:3242-3263`); the call screen then shows `CrisisResourcesPanel`
  (`FE/src/features/call/components/CallScreen.tsx:574-581`).
- Detector: lists EMPTY until CN-7 sign-off and no classifier wired: "the detector is inert"
  (`companion_safety.py:16-27`, `companion_safety_lists.py` header); disabled unless
  `VOICE_SELF_HARM_DETECTION_ENABLED` (`companion_safety.py:396-397`). Classifier timeout
  default 1,500 ms, fail-open (`companion_safety.py:85`, `:205-226`).
- Logs: `voice.safety pause created ... risk=%s ... user_id=%s` at WARNING
  (`companion_safety.py:466-476`) and a `companion_safety_pause` event with `user_id` and `risk`
  (`companion_safety.py:477-483`; `risk` is a safe field, `observability.py:97`).

### 2.6 Cost controls

| Control | Unit | Where | Defaults |
|---|---|---|---|
| Daily call quota (reservation) | seconds | `quota.py:150-308` (atomic, capacity row lock `quota.py:736-742`) | 10 min/day, 600 s max call, 120 s idle, 1 call/user, 8 global (`API/src/services/voice_orchestration/config.py:30-44`) |
| Quota consumption on normal end | billable audio seconds (STT+TTS) | `engine.py:1135-1141` | |
| Quota consumption on stale sweep | **wall-clock** elapsed, capped at reserved | `quota.py:549-579` (`:574`) | stale after 900 s idle (`config.py:44`), sweep every 60 s (`engine.py:92`) |
| Per-call credits | 1 credit / 10 s of STT+TTS audio, ceil | `engine.py:81`, `engine.py:3378-3439` | debit via `MembershipModel.debit_operation_credits` (`engine.py:250-264`) |
| Daily spend circuit (global) | TTS chars at list price (Flash $0.04/1K, non-Flash x2) | `spend_circuit.py:62-105`, `engine.py:3170-3213`, `engine.py:3632-3634` | state cache 5 s (`spend_circuit.py:64`); 50/80/95/100 % levels; 100 % -> calls continue as text (`engine.py:2842-2876`) |
| Fish supplier budget | estimated micros per attempt | `fish_audio/admission.py:58-101`, `:103-142` | global account-row `FOR UPDATE` per reservation/extension |
| Breakers | per path transient (5 fails/30 s, 30 s cooldown), latched config/billing | `breakers.py:55-59`, `:267-361` | TTS only |
| Limiter | provider concurrency pools | `limiter.py:1-31` | TTS only |
| Abuse counters | events + drained chars, 7-day window | `abuse.py:55-72`, `:126-206` | warn 3, disable 24 h at 10 or any severe, review at 25; 20k drained chars = 1 event |

LLM (callbot) cost is admitted per execution in the LLM execution ledger
(`API/src/database/mysql/llm_execution_admission.py:181`, `:255-293`, `platform_credit_cost`),
separate from voice credits. Moderation executions have "no per-user admission" and are only
logged (`moderation_transport.py:19-25`). STT has no spend metering beyond the user's audio
seconds.

---

## 3. Frame / data formats relevant to this subsystem

- Upload: multipart POST `/character-chats/{id}/voice-segments`; the route stamps receipt as its
  first dependency, before auth (`API/tests/voice/test_voice_call_telemetry.py:282-285`). Form
  field `vad_json` may carry `speech_end_lag_ms` (strict int 0..120,000;
  `engine.py:3857`, `engine.py:3875-3880`). Client computes it as `performance.now()` at send
  minus last voiced audio (includes the VAD hang-over, hashing and any wait for `voice_ready`)
  (`FE/src/features/interaction/audio/speechEndLag.ts:1-31`).
- `voice_event` log line: `voice_event name=<name> at_ms=<epoch ms> fields={'k': v, ...}`
  (`observability.py:168-173`). With `LOG_FORMAT=json` the line becomes the `message` string of
  `{"timestamp","level","name","message"}` (`API/src/main.py:240-249`); `extra=` attributes are
  never emitted by either formatter (`main.py:240-249`, `main.py:293-299`).
- DB durable latency: only STT. `voice_transcript_segment.stt_summary` holds Groq
  `latency_ms`, `duration_ms`, `no_speech_prob`, `avg_logprob`, `compression_ratio`
  (`API/src/services/voice_orchestration/stt_groq_client.py:202-214`, persisted at
  `engine.py:2275-2281`). `tts_summary` has only `audio_chunks`, `status`, `timing_quality`
  (`engine.py:2753-2754`). `voice_session.metadata.billing` holds `stt_audio_ms`,
  `tts_audio_ms`, `billed_credits` (`engine.py:217-229`, `engine.py:3441-3455`).
- `api.magic_llm` stores `time_first_token_ms` per message in its own DB
  (`LLM/src/models/chat.py:61`, `LLM/src/db/messages.py:1471`, `:1693`), not joined with BFF
  voice events.

---

## 4. Configuration / defaults table

| Setting | Default | Defined at |
|---|---|---|
| Event buffer | 2,048 events | `observability.py:20` |
| Histogram reservoir | 2,048 newest samples | `metrics.py:123` |
| Alert window / buckets | 1 h / 10 s | `metrics.py:127-128` |
| First-audio alert | p50 > 400 ms, >= 20 calls | `metrics.py:1374`, `:1362` |
| Monitor | off (`VOICE_METRICS_MONITOR_ENABLED`), every 300 s | `metrics.py:1648-1660` |
| Metrics query timeout | 5,000 ms | `metrics.py:802` |
| Call sentence moderation budget | 300 ms | `moderation.py:73` |
| Narration/preview/admin moderation budget | 2,000 ms | `moderation.py:72`, `:76-77` |
| Moderation verdict cache | 24 h, 10,000 entries | `moderation.py:79-80` |
| Moderation required | true (`VOICE_MODERATION_REQUIRED`) | `moderation_transport.py:122-129` |
| Moderation classifier | off (`VOICE_MODERATION_CLASSIFIER_ENABLED`) | `moderation_transport.py:116-119` |
| Moderation plan cache / max stale / retry | 300 s / 300 s / 30 s | `moderation_transport.py:92-95` |
| Self-harm detection | off (`VOICE_SELF_HARM_DETECTION_ENABLED`) | `companion_safety.py:77`, `:299-301` |
| Self-harm classifier timeout | 1,500 ms (100..10,000) | `companion_safety.py:85-87` |
| Safety pause | 30 min | `companion_safety.py:82` |
| Spend state cache | 5 s | `spend_circuit.py:64` |
| Flash list price | 40 micro-USD/char | `spend_circuit.py:63` |
| Breaker transient | 5 failures / 30 s, cooldown 30 s | `breakers.py:55-57` |
| Voice-denial config trip | 3 distinct voices / 10 min | `breakers.py:58-59` |
| Credits | 10 audio s per credit | `engine.py:81` |
| TTS billing cadence | each sentence start or every 2,000 ms of delivered audio | `engine.py:117`, `engine.py:2507` |
| Idle sentence flush | 120 ms | `engine.py:88` |
| Max in-flight segments per call | 3 | `engine.py:83` |
| Stale sweep | every 60 s; stale after 900 s idle | `engine.py:92`, `config.py:44` |
| STT timeout | 30 s | `config.py:47` |
| Daily minutes / max call / idle / per-user / global | 10 / 600 s / 120 s / 1 / 8 | `config.py:30-41` |
| Client VAD hang-over | 550 ms | `FE/src/features/call/components/CallScreen.tsx:114` |
| Abuse thresholds | warn 3, disable 10, review 25; drained 20k chars/event | `abuse.py:55-72` |

---

## 5. Which per-stage latencies are measured, and where they go

`turn_started_ms` is set at the start of `_run_voice_turn` (`engine.py:2320`), i.e. after
validation, STT, STT billing and any supersede wait. `segment_started_ms` is set at
`accept_segment` entry (`engine.py:2022`).

| Stage | Measured? | Field / event | Sink | Gaps |
|---|---|---|---|---|
| Client end-of-speech -> upload sent | yes (client) | `vad.speech_end_lag_ms` | added into `user_stop_ttfb_ms` | includes 550 ms hang-over; not separated |
| Upload network transit | **no** | | | excluded from D06 by design (`metrics.py:56`) |
| Route receipt -> engine | yes | `route_lead_ms` (internal) | folded into `user_stop_ttfb_ms` (`engine.py:2908-2909`) | not emitted alone |
| Pre-STT DB + validation | no | | | derivable only by subtraction |
| STT | yes | `voice_stt_completed.latency_ms` | log + DB `stt_summary.latency_ms` | not a histogram; no RTF |
| STT billing + supersede + truncation waits | no | | | on critical path, invisible |
| LLM admission | yes | `voice_turn_admitted.latency_ms` (from turn start) | log | labelled with TTS provider/model |
| LLM TTFT | yes | `voice_llm_first_delta.latency_ms` (from turn start) | log | includes admission; LLM model/profile missing; not a histogram |
| First sentence ready | yes | `voice_tts_first_sentence.latency_ms`, `milestone` = boundary/idle/turn_end | log | good: says what released it |
| Moderation per sentence | partly | `moderation_verdict` `moderation_ms` | histogram (all surfaces mixed) + own log line | no `voice_session_id`/`turn_id`; skipped sentences logged separately |
| TTS first byte | partly | `voice_turn_audio.ttfb_ms` (sentence ready -> first chunk) | timed histogram + alert | includes moderation, Fish prep, `begin_turn`/slot wait; pure provider TTFB not isolated; WS lane emits no `provider_request` |
| First audio (server) | yes | `voice_first_assistant_audio.latency_ms` (segment -> first chunk) | histogram | measured before `send_audio_chunk` (`engine.py:2456-2470`) |
| D06 user stop -> first audio | yes (partial) | `user_stop_ttfb_ms` | histogram, no alert, no DB | excludes upload transit, downlink, jitter buffer, decode, playout |
| Client playout start / underruns | **no** | `voice_playback` reports exist (`engine.py:1266-1296`) | used only for flush-ahead gate | unused for metrics |
| Barge-in -> silence | **no** | `voice_barge_in` has `played_ms`, `drained_chars` | log | no cancel latency |
| Turn total | yes | `voice_turn_finalized.duration_ms` | log | |

Tests pin the D06 arithmetic (`API/tests/voice/test_voice_call_telemetry.py:224-302`) and the
turn-timing events (`API/tests/voice/test_voice_turn_latency.py:98-112`); nothing asserts a
latency budget.

---

## 6. Critical-path latency table (user stops speaking -> first audio heard)

Only the stages this subsystem owns or measures are estimated precisely; others are given for
context with their source. "INF" = inference.

| # | Stage | Estimate (ms) | Evidence | Notes |
|---|---|---|---|---|
| 1 | Client VAD silence hang-over | 550 (constant) | `FE/src/features/call/components/CallScreen.tsx:114` | counted in `speech_end_lag_ms` |
| 2 | Upload transit (multipart WAV) | 20-150 (INF) | route `route_voice_call.py:1159` | not measured anywhere |
| 3 | Route pre-engine: auth, workspace, chat, consent, form parse | 5-30 (INF) | `route_voice_call.py:1144-1159` | 4+ DB/cache reads |
| 4 | Engine pre-STT DB: `get_session`, `touch_call`, `find_segment`, `create_segment`, `update_segment` x1, 2 WS acks | 5-25 (INF) | `engine.py:2024`, `2050`, `2124-2138`, `2157-2160`, `2205-2209` | sequential awaits |
| 5 | Server VAD validation | 1-10 (INF) | `engine.py:2161-2175` | CPU on the single event loop |
| 6 | STT (Groq whisper-large-v3) | 250-800 (INF) | `engine.py:2228-2230` | persisted per segment as `stt_summary.latency_ms` |
| 7 | **STT credit debit + session metadata write** | 10-60 (INF), worse under lock contention | `engine.py:2244-2251`, `3389-3421`, `3441-3455`; debit body `API/src/database/mysql/models.py` (`debit_operation_credits`, ~10 statements incl. `FOR UPDATE`) | runs even for no-speech segments |
| 8 | `update_segment(completed)` | 2-10 (INF) | `engine.py:2275-2281` | |
| 9 | Supersede wait (only if a turn is in flight) | 0-300+ (INF) | `engine.py:2069-2074`; the old turn's `finally` awaits billing and spend tasks `engine.py:2793-2800` | barge-in path |
| 10 | Pending truncation wait | 0-50 (INF) | `engine.py:2322` | |
| 11 | LLM admission + TTFT (`api.magic_llm` callbot graph) | 800-1,600+ | doc evidence: first text 1,578.8 ms without app admission, `FE/docs/fish_audio_support/18_call_engine_development.md:119-123` | `voice_turn_admitted`, `voice_llm_first_delta` |
| 12 | Spend state read awaited at admission | 0-5 (cached 5 s) | `engine.py:2579-2583`, `spend_circuit.py:172-189` | |
| 13 | First sentence completion (token streaming to a boundary) or idle flush | 120 idle constant + generation time | `engine.py:88`, `engine.py:2563-2570`, `2618-2621` | |
| 14 | Fish only: pronunciation dictionary DB read + Fish admission `extend_stream` (global account `FOR UPDATE` + day `SUM`) | 5-30 (INF), grows with concurrency | `API/src/services/speech/performance.py:9-15`; `fish_audio/admission.py:103-142`, `:226-233` | per sentence |
| 15 | **Moderation verdict** (first sentence) | 0-300 (budget); at 300 the sentence is dropped | `moderation.py:73`, `engine.py:2393`, `call_tts_elevenlabs.py:237` | serial, before `push_text` |
| 16 | TTS context begin / slot wait / provider TTFB | 150-500 (INF) | `call_tts_elevenlabs.py:203-219`, `:228-264` | `queue_wait_ms` recorded |
| 17 | First chunk WS send | 1-5 (INF) | `engine.py:2470-2485` | first-audio stamped before the send |
| 18 | Downlink + browser decode/buffer | 50-250 (INF) | not measured server-side | |
| 19 | TTS debit after first chunk (delays chunk 2+, not chunk 1) | 10-60 per billing point (INF) | `engine.py:2507-2508` | jitter risk |

Rough INF total today: about 2.0-4.5 s from end of speech to first audible audio, dominated by the
550 ms hang-over, STT, LLM TTFT and (if enabled) moderation. The BFF-owned overhead in rows 3-5,
7-10, 12, 14, 15, 17 is roughly 40-450 ms and is mostly removable or overlappable.

---

## 7. Findings

Severity: critical (breaks calls / data loss / security), high, medium, low, info.

### BE-OBSERVABILITY-SAFETY-COST-01 - Required call moderation cannot meet its 300 ms budget; every configuration is either silent or unmoderated (critical)

- FACT: call sentences are classified one by one by an LLM classifier executed through
  `api.magic_llm` (`moderation.py:702-707`, `moderation_transport.py:447-470`) under a
  300 ms timeout (`moderation.py:73`, `:720-726`); timeout -> `unavailable` -> fail closed
  (`moderation.py:724-726`, `engine.py:2400-2414`).
- FACT: it is awaited serially in `prepare` before `push_text`, for the first sentence on the
  critical path (`call_tts_elevenlabs.py:228-245`, `engine.py:2364-2399`).
- FACT (doc evidence): the classifier returned `unavailable` after 2,003.164 ms against a
  2,000 ms preview budget, with the plan warmed (`FE/docs/fish_audio_support/18_call_engine_development.md:126-131`);
  "Calls remain off pending required moderation" (`FE/docs/fish_audio_support/11_implementation_status.md:34`).
- FACT: required defaults to true (`moderation_transport.py:122-129`); without a classifier
  the surface gate refuses calls (`surface_gate.py:138-156`); with `required=false`
  unclassified text passes unmoderated (`moderation.py:636-641`, warning at `main.py:1049-1054`).
- FACT: the look-ahead hook `check_ahead` (sentence N while N-1 plays) is not used anywhere
  (`moderation.py:551-569`; grep shows only a docstring mention at `engine.py:3310`).
- INFERENCE: an LLM-graph classifier over HTTP (graph bind + JSON + network + model TTFT +
  completion) will have p50 well above 300 ms; most call sentences would be dropped, the user
  hears nothing, and every turn emits `moderation_unavailable`, which also counts as a call TTS
  failure and can page (`metrics.py:120-122`, `metrics.py:1451-1464`). When it does succeed it
  adds up to 300 ms to first audio. The verdict cache (exact sentence hash) rarely hits for
  generated text.
- Recommendation: (1) move the classifier off the critical path: synthesize optimistically and
  gate *playout* (hold the first audio chunks of a sentence until its verdict, or release audio
  and cut on a late block), or classify the LLM token stream incrementally; (2) use a fast
  classifier sized for 50-150 ms (small local/hosted safety model, provider moderation endpoint,
  or the deterministic lists once signed off) and keep the LLM classifier for narration;
  (3) wire `check_ahead` so sentence N+1 is moderated while N plays; (4) add a health probe that
  measures classifier p95 against the call budget and refuses the call surface if it cannot
  meet it, instead of failing per sentence; (5) emit `moderation_ms` per surface with
  `voice_session_id`/`turn_id`.

### BE-OBSERVABILITY-SAFETY-COST-02 - Self-harm detection on calls is inert; moderation does not protect the user-visible text (high)

- FACT: detector inert: empty lists and no classifier (`companion_safety.py:16-27`,
  `companion_safety_lists.py` header "intentionally EMPTY", `SELF_HARM_PHRASES` built from `_EMPTY`),
  plus disabled by default (`companion_safety.py:77`, `:299-301`).
- FACT: the screen starts only after LLM admission, in parallel with the reply
  (`engine.py:2596`), so even a working detector races the character's spoken answer.
- FACT: assistant deltas are sent to the client immediately (`engine.py:2613-2616`); the
  moderation gate only decides whether a sentence is *voiced* ("the text continues",
  `engine.py:3305-3306`). Its `self_harm` category (`moderation.py:98`) therefore does not
  stop harmful text from reaching the user.
- FACT (strength): on a pause the call screen shows crisis resources
  (`CallScreen.tsx:574-581`).
- INFERENCE: for a companion product with live voice calls this leaves no functional
  suicidal-ideation detection or crisis referral in the call loop; companion-chatbot laws that
  took effect in 2025-2026 (e.g. California SB 243, New York's companion-AI provisions) expect
  such protocols. Applicability needs counsel review.
- Recommendation: ship the signed-off lists plus a fast classifier on the *final user
  transcript* (it is available right after STT, `engine.py:2274`), run it in parallel with LLM
  admission rather than after it, and on `imminent` prefer an in-call safe response (inject a
  safety instruction or a canned supportive line + resources) over an abrupt hang-up; screen
  assistant output text (not only audio) for self-harm encouragement.

### BE-OBSERVABILITY-SAFETY-COST-03 - STT credit debit is awaited on the critical path, before the LLM, and bills no-speech segments (medium)

- FACT: after STT, `_record_billable_audio(kind="stt")` is awaited (`engine.py:2244-2251`); it
  holds `runtime.billing_lock`, calls `debit_operation_credits` (`engine.py:3404-3410`,
  `engine.py:250-264`), then `_persist_billing_metadata` = `get_session` +
  `update_session_metadata` (`engine.py:3421`, `:3441-3455`). The debit is a multi-statement
  transaction with row locks (`MembershipModel.debit_operation_credits` in
  `API/src/database/mysql/models.py`, membership/limits/wallet/ledger statements and a
  `SELECT ... FOR UPDATE`).
- FACT: billing happens **before** the empty-transcript check (`engine.py:2244-2252`), so a
  segment STT judges as no-speech (but with `duration_ms > 0`) still consumes credits and
  daily minutes.
- INFERENCE: 10-60 ms per turn typical on a local MySQL, more under contention; zero user
  benefit from doing it synchronously (the call is already admitted and has a reservation).
- Recommendation: start the LLM turn first and debit in a background task (keep idempotency
  keys; reconcile on failure; end the call asynchronously on exhaustion as the TTS path already
  does); persist billing metadata at most every N seconds or at call end; do not bill
  `no_speech` rejections (or bill them at a capped rate) to avoid charging for noise.

### BE-OBSERVABILITY-SAFETY-COST-04 - TTS debits run inside the audio drain loop (medium)

- FACT: `deliver()` awaits `bill_delivered_tts` whenever a sentence starts or 2,000 ms of audio
  accumulated (`engine.py:2507-2508`, `engine.py:117`), which awaits the same debit + metadata
  write (`engine.py:2345-2362`, `3378-3455`). `deliver` is called from the speaker's drain loop
  (`call_tts_elevenlabs.py:266-283`), so the next chunk is not forwarded until the DB returns.
  On the first chunk `started > 0`, so the second chunk waits on a debit.
- INFERENCE: slow DB moments become audible gaps/underruns at sentence boundaries (the
  provider keeps streaming into the WS client buffer, so data is not lost, only delayed).
- Recommendation: decouple metering from delivery: account delivered audio in memory and flush
  debits from a separate per-call task (coalesced), never on the forwarding path.

### BE-OBSERVABILITY-SAFETY-COST-05 - End-to-end latency is partial, ephemeral and unalerted; per-stage metrics are log-only and mislabelled (high)

- FACT: `user_stop_ttfb_ms = speech_end_lag_ms + route_lead_ms + segment_to_audio_ms`
  (`engine.py:2906-2909`); first audio is stamped when the first chunk reaches `deliver`,
  before `send_audio_chunk` (`engine.py:2456-2470`). Upload transit, downlink, decode, jitter
  buffer and playout are excluded (`metrics.py:56`).
- FACT: it feeds only an in-process histogram (`metrics.py:562-565`), is not in the DB
  ("First audio is not in the DB", `metrics.py:1168-1169`, `:1472`), and has no alert rule; the
  only latency alert is on `call_first_audio_ms` (p50 > 400 ms, `metrics.py:1374`,
  `:1467-1482`), whose `ttfb_ms` starts at "first sentence ready" (`engine.py:2918`) and so
  includes moderation and context/slot waits as well as provider TTFB.
- FACT: STT, admission, LLM first delta and first sentence are log-only (`engine.py:2233-2242`,
  `2578`, `2612`, `2538`; not in `_FEED`, `metrics.py:755-776`). LLM events carry
  `_call_dimensions` = TTS provider + TTS model alias (`engine.py:1686-1697`); the callbot
  model/profile is never recorded. The ElevenLabs call WS lane emits no `provider_request`
  event (only HTTP and Fish do: `tts_http.py:92-137`, `fish_audio/runtime.py:55-59`).
- FACT: client `voice_playback` reports (played ms per turn) reach the server
  (`engine.py:1266-1296`) but are used only by the flush-ahead gate.
- FACT: there is no agreed end-to-end target; the docs list "agree and measure end-to-end
  p50/p95 and cancellation-to-silence targets" as open (`18_call_engine_development.md:140-145`).
- Recommendation: emit one **per-turn latency record** (STT, admission, LLM TTFT, first
  sentence, moderation, TTS TTFB, server first byte, client first playout, barge-in-to-silence)
  keyed by `voice_session_id`/`turn_id` and persist it (e.g. a column on
  `voice_transcript_segment.tts_summary` or a `voice_turn_timing` table); have the client report
  `first_playout_at` relative to its upload send time (it already sends `voice_playback`);
  add p50/p95 histograms per stage with LLM model and TTS model as separate labels; alert on
  end-to-end p95, not only on a TTS sub-interval.

### BE-OBSERVABILITY-SAFETY-COST-06 - The sanitizer silently drops fields, emptying some events (medium)

- FACT (static scan of `record(...)` keyword names against `SAFE_OBSERVABILITY_FIELDS` and the
  forbidden markers, `observability.py:22-133`, `:319-327`):
  - `voice_call_billing_recorded` (`engine.py:3426-3437`) loses `kind`, `audio_ms`,
    `previous_total_ms`, `billable_audio_ms`, `billable_audio_seconds`, `billed_credits`,
    `credit_delta` - only `user_id` and `voice_session_id` remain.
  - `voice_segment_rejected` (`engine.py:2192-2202`) loses `stage`, `reason` (and any
    `exc.details`); (`engine.py:2259-2271`) loses `stage`, `no_speech_prob`, `rms`, `peak`.
  - `voice_call_audio_link_failed` (`engine.py:3579`) loses `assistant_message_id`, `asset_id`,
    `error`.
- FACT: the marker `audio` forbids any field containing it, which is why the D06 field had to be
  named `user_stop_ttfb_ms` (`observability.py:81-84`).
- Recommendation: keep the allowlist (it is a strength) but make drops visible: count
  `observability_fields_dropped{event,field}` and fail a unit test when a producer passes an
  unknown key; add the billing and rejection diagnostics (they contain no text) to the allowlist
  under names without forbidden markers.

### BE-OBSERVABILITY-SAFETY-COST-07 - Log structure is lost: `extra=` fields never printed, events logged as dict repr (medium)

- FACT: the WS lane logs `speech_call_ws event=%s` with all useful fields in
  `extra={"speech_call_ws": payload}` (`tts_multicontext_ws.py:1029-1032`, fields at `:101-113`);
  the JSON formatter emits only timestamp/level/name/message (`main.py:240-249`) and the plain
  format string has no extras (`main.py:293-299`). `request_id`, `region`, `close_code`,
  `provider_code`, `queue_wait_ms`, `live_contexts` never reach the logs.
- FACT: `voice_event` lines embed a Python dict repr in the message (`observability.py:168-173`).
- FACT: durations use wall-clock `time.time()` (`observability.py:311-316`).
- Recommendation: a JSON formatter that merges `record.__dict__` extras and emits event fields
  as top-level JSON keys; use `time.monotonic_ns()`/`perf_counter` for durations.

### BE-OBSERVABILITY-SAFETY-COST-08 - No exporter, monitor off by default, alerts are log lines, dead gauge (medium)

- FACT: no metrics library/exporter (`metrics.py:4`); counters reset on restart
  (`metrics.py:7-14`); monitor default off (`metrics.py:1648-1660`); alerts = ERROR logs with no
  channel (`metrics.py:44-46`, `:1586-1596`); spend rules are not in the monitor
  (`metrics.py:1704-1710`); the `/calls` route does not evaluate the keepalive rule
  (`admin_voice_metrics.py:175`); `spend_budget_pct` has no producer (grep: only
  `metrics.py:62`, `:627`).
- Recommendation: adopt OpenTelemetry metrics (Prometheus/OTLP exporter) for the existing
  names; enable the monitor by default in production with a real notification channel; delete
  or wire the dead gauge.

### BE-OBSERVABILITY-SAFETY-COST-09 - No cross-service trace correlation (medium)

- FACT: BFF -> `api.magic_llm` headers are Authorization, Content-Type, delegation key, Accept,
  Idempotency-Key only (`API/src/services/llm_execution_transport.py:82-95`); no
  `traceparent`/request id anywhere in `API/src` (grep). `trace_id` is a forbidden observability
  marker (`observability.py:129`). `api.magic_llm` records `time_first_token_ms`
  (`LLM/src/models/chat.py:61`, `LLM/src/db/messages.py:1693`) but nothing links it to the
  voice turn.
- Recommendation: propagate W3C `traceparent` (one trace per call turn, spans for STT, LLM
  admission, LLM stream, moderation, TTS, delivery); log the LLM execution id on
  `voice_turn_admitted` so BFF overhead vs model TTFT can be separated. Rename the forbidden
  marker to the provider-specific field it was meant to hide.

### BE-OBSERVABILITY-SAFETY-COST-10 - Spend control and cost accounting cover TTS only; no per-call cost record (medium)

- FACT: the spend circuit meters TTS characters at list price (`spend_circuit.py:1-15`,
  `engine.py:3170-3213`, `engine.py:3632-3634`; Fish adds its own estimate,
  `fish_audio/admission.py:88-97`, `:140-142`). STT seconds, callbot LLM tokens (separate LLM
  execution ledger, `llm_execution_admission.py:255-293`) and moderation tokens (log line only,
  `moderation_transport.py:473-485`, "no per-user admission", `:19-25`) are not in it.
- FACT: moderation usage is logged only after a successful completion
  (`moderation_transport.py:463-485`); a call cancelled by the 300 ms timeout leaves no record.
- INFERENCE: cancelled HTTP requests do not necessarily stop the upstream model run, so timed-out
  classifications may still be paid. Groq STT pricing has a per-request minimum billed duration
  (to verify against current Groq pricing), which makes short call segments cost several times
  their audio length.
- Recommendation: a per-call cost record (CDR) at call end: STT audio s (and provider-billed s),
  LLM prompt/completion/cached tokens per turn, TTS chars sent/heard/drained, moderation calls
  and tokens, credits debited; feed all four into the daily circuit or separate circuits.

### BE-OBSERVABILITY-SAFETY-COST-11 - Crash-orphaned reservations block capacity and overcharge quota (medium)

- FACT: stale expiry needs 900 s idle or max duration (`quota.py:567-569`, `config.py:44`) and
  charges wall-clock elapsed capped at the reservation (`quota.py:574`), while normal end
  charges billable audio seconds (`engine.py:1135-1141`). A reservation takes
  `min(600 s, remaining daily)` (`quota.py:268`). The startup sweep uses the same rule
  (`engine.py:1771-1779`) although the BFF is single-process (`serve.py:28-33`), so at startup no
  reservation can be live.
- INFERENCE: after a crash, up to 8 global slots (`config.py:41`) stay occupied up to 15 min
  ("capacity is temporarily exhausted", `quota.py:252-258`), and a user who does not come back
  loses up to their whole daily allowance (600 s of 600 s) for a short call. Graceful shutdown
  is fine (`engine.py:1781-1795`).
- Recommendation: at startup release every reservation not owned by this process using the
  session's stored `metadata.billing.billable_audio_seconds`; in the stale path prefer the stored
  audio seconds over wall clock.

### BE-OBSERVABILITY-SAFETY-COST-12 - Abuse controls: live calls survive a disable; natural barge-in counts as abuse (medium)

- FACT: a moderation block reports to `VoiceAbuse.on_moderation_block` (`abuse.py:144-146`),
  which may create `abuse_disable_24h` (`abuse.py:170-192`) but does not end live calls; the
  per-segment admission re-checks consent only (`route_voice_call.py:1149-1157`,
  `admission.py:189-203`). Companion safety ends calls only for its own pauses
  (`companion_safety.py:484-497`).
- FACT: every barge-in adds the flushed-but-unheard characters to `drained_call_chars`
  (`engine.py:3351-3364`, `call_ledger.py:394-400`); 20k chars in 7 days = one scored event
  (`abuse.py:69-80`); warning at score 3, 24 h disable at 10 (`abuse.py:56-57`). Up to 3
  sentences / 8 s of audio can be flushed ahead (`call_tts_elevenlabs.py:55-58`).
- INFERENCE: a heavy user who interrupts a lot (normal in conversation) accumulates warnings;
  meanwhile a user disabled for a severe block keeps talking until hang-up. The block itself is
  also awaited inline inside the moderation check (`moderation.py:769-772`).
- Recommendation: end live calls on any abuse disable (reuse `end_calls_for_user`); score drained
  chars only above a per-turn plausibility threshold or as a ratio of sent chars; move the block
  hook off the verdict path.

### BE-OBSERVABILITY-SAFETY-COST-13 - Sensitive safety signals in plaintext logs (medium)

- FACT: `voice.safety pause created surface=%s risk=%s source=%s verdict_id=%s user_id=%s ...`
  at WARNING (`companion_safety.py:466-476`) and a `companion_safety_pause` event with
  `user_id` + `risk` (`companion_safety.py:477-483`); unstored pauses log the same at ERROR
  (`companion_safety.py:446-455`). Abuse disables log `user_id`, trigger and `severe`
  (`abuse.py:194-203`). 17 `exc_info=True`/`logger.exception` sites in
  `voice_orchestration` (grep) can print exception messages; redaction covers secrets only
  (`errors.py:78-95`).
- INFERENCE: a self-harm risk label tied to a user id is special-category (health) data; app
  logs usually have broader access and longer retention than the DB.
- Recommendation: log `verdict_id` / restriction id without `user_id` (or a keyed hash), keep
  the user link only in the restriction row; scrub exception text for provider payloads.

### BE-OBSERVABILITY-SAFETY-COST-14 - Fish lane spend admission serializes all calls per sentence (medium)

- FACT: every text extension of a Fish call takes `SELECT ... FOR UPDATE` on the single Fish
  account row, then sums the day's attempt costs, updates the attempt and upserts
  `voice_spend_daily` (`fish_audio/admission.py:103-142`), awaited before the text is sent
  (`fish_audio/admission.py:226-233`). The pronunciation dictionary is re-read per sentence in a
  DB transaction (`performance.py:9-15`, called from `engine.py:2386-2390`).
- INFERENCE: lock hold time grows with the day's attempt count (day `SUM`), and every concurrent
  Fish call queues behind it at each sentence, including the first.
- Recommendation: keep a per-day running total row (atomic `UPDATE ... SET total = total + ?
  WHERE total + ? <= budget`), cache dictionaries per call.

### BE-OBSERVABILITY-SAFETY-COST-15 - Moderation metrics are coarse and mislabelled (low)

- FACT: `moderation_verdict` feeds `moderation_<outcome>` and `moderation_ms` without a
  `surface` label (`moderation.py:682-690`, `metrics.py:605-609`), so 2 s narration batches and
  300 ms call sentences share one histogram; provider is always `elevenlabs`
  (`moderation.py:459`, `:482-484`) including Fish calls; companion-safety events also hard-code
  `provider="elevenlabs"` (`companion_safety.py:242`, `:479`).
- Recommendation: label by surface and by the call's TTS provider; add `voice_session_id` and
  `turn_id` to call verdicts.

### BE-OBSERVABILITY-SAFETY-COST-16 - Only TTS has breakers; STT/LLM/moderation have none (info)

- FACT: `SpeechBreakers` paths are narration/call TTS/preview/admin (`breakers.py:49-54`,
  `:283-300`); STT timeout default is 30 s (`config.py:47`); the moderation transport only
  rate-limits *resolution* retries (`moderation_transport.py:95`, `:389-391`), so a down
  classifier costs 300 ms per sentence for every call.
- Recommendation: per-dependency breakers (STT, LLM, moderation) with fast fail and a degraded
  mode (e.g. text-only or "please repeat").

---

## 8. Deviations from SOTA realtime voice-agent practice (this subsystem)

| Practice | State here |
|---|---|
| Per-turn, per-service metrics (STT TTFB/duration, LLM TTFT/tokens, TTS TTFB/chars, end-of-utterance delay) as first-class metrics (cf. Pipecat metrics frames, LiveKit Agents `metrics_collected` events) | Events exist but mostly log-only; only TTS sub-interval and server first byte are histograms |
| OpenTelemetry traces per turn across services | None; `trace_id` forbidden |
| Measure "first audio heard" on the client and report it | Not measured; `voice_playback` unused for metrics |
| Measure barge-in -> silence | Not measured |
| Guardrails in parallel with generation; gate playout, not synthesis | Serial, before synthesis, fail-closed |
| Fast safety classifiers (tens of ms) for realtime | LLM-graph classifier via a second service |
| Usage collector for cost per session | Credits per audio second; no CDR combining STT/LLM/TTS/moderation |
| Metering off the media path | Debits awaited on the critical path and inside the drain loop |
| Structured JSON logs with fields | Dict repr inside message; extras dropped |

---

## 9. Strengths

- Privacy-by-allowlist events: no transcript, prompt, audio, URL or token can reach
  observability (`observability.py:22-133`, `:319-339`); moderation and safety never log text
  (`moderation.py:44-45`, `companion_safety.py:40-41`).
- Raw user audio is not persisted; only its SHA-256 (`engine.py:2128-2138`).
- A deliberate D06 metric design: the route stamps receipt before auth and the client reports
  its end-of-speech lag (`test_voice_call_telemetry.py:224-302`, `speechEndLag.ts:1-31`);
  `voice_tts_first_sentence.milestone` tells what released the first sentence
  (`engine.py:2538`).
- Fail-closed moderation by default, prewarm during STT, stale-while-revalidate plan cache,
  shielded single-flight resolution (`moderation_transport.py:36-53`, `:376-394`).
- Spend circuit with graded levels that degrades live calls to text instead of cutting them,
  fails open on read errors, and survives restarts for the auto-narration switch
  (`spend_circuit.py:1-33`, `engine.py:2842-2876`); slice spend writes are off the first-audio
  path (`engine.py:3170-3182`).
- Atomic cross-worker quota reservations with a capacity lock (`quota.py:179-308`) and
  idempotent billing keys per STT segment / TTS slice (`engine.py:2249`, `:2360`).
- Breakers with half-open single probe, latched config/billing, transition events
  (`breakers.py:107-224`).
- Barge-in ledger that keeps only the heard prefix and counts drained characters
  (`call_ledger.py:13-21`, `:380-400`).
- Companion safety is async and fail-open (never blocks the reply), idempotent pauses, and the
  UI shows crisis resources (`companion_safety.py:387-497`, `CallScreen.tsx:574-581`).
- Root metrics route bounds every query and returns no user lists (`admin_voice_metrics.py:1-24`).

---

## 10. Open questions

1. What classifier p50/p95 does the published `moderation` profile achieve end to end? Is any
   production deployment planned with `VOICE_MODERATION_REQUIRED=false`?
2. Which log sink and retention apply to BFF logs (they carry `user_id` + safety risk)? Is
   `LOG_FORMAT=json` used in production?
3. Q-07 (metrics exporter) and O-3 (alert channel) owners and timelines.
4. Does a callbot turn also debit chat/LLM credits in addition to voice-call credits (double
   charge vs intended)? (`llm_execution_admission.py:255-293` suggests per-execution credit cost.)
5. Retention policy for `voice_transcript_segment.transcript_text` and stored assistant call
   audio.
6. Do cancelled `api.magic_llm` executions (moderation timeouts, superseded turns) stop upstream
   model generation and billing?
7. Is the product in scope of companion-chatbot laws (California SB 243, New York)?
8. Groq STT billed duration per short request (minimum billed length) for the current plan.

---

## Verification (adversarial)

A second pass tried to refute each finding against the code (magic-worlds-api, api.magic_llm,
frontend). Paths are relative to `magic-worlds-api/` unless noted. No source was modified.

| id | verdict | corrected severity | evidence / note |
|---|---|---|---|
| BE-OBSERVABILITY-SAFETY-COST-01 | adjusted | high | Verified: `moderation.py:73` (0.3 s call budget), `:720-734` (timeout or error gives `unavailable`), `:636-641` (`required=false` turns `unavailable` into allow), `moderation_transport.py:122-129` (required defaults to true), `surface_gate.py:138-156` plus `moderation.py:501` (`passes_text` is false with no classifier while required), `engine.py:2393-2414` (fail closed, sends `moderation_unavailable`), `metrics.py:120-122` (counted as a call TTS failure), `.env:78,81` (dev: classifier off, required=false). `check_ahead` exists only in a test. Corrections: (1) only the first sentence pays the full classifier latency serially. `_push` (`call_tts_elevenlabs.py:233-245`) prepares sentence N+1 right after N is pushed and before the `may_flush` wait, so later checks already overlap playback; `check_ahead` would add little beyond parallel checks of queued sentences. (2) The 2,003 ms sample is one preview-surface probe against the 2 s budget (doc 18:126-131), not a call-surface measurement. The 300 ms miss is a strong inference, not a measured fact. (3) This is a documented R4 launch gate, and calls are not launched with required moderation. It is a real architectural blocker but not a live production defect, so high fits better than critical. |
| BE-OBSERVABILITY-SAFETY-COST-02 | confirmed | high | `companion_safety_lists.py:29-35`: all lists are empty (`pending_signoff`). `companion_safety.py:299-301`: detection defaults to false. `:396-397`: returns early when off. `engine.py:2571-2596`: the screen starts only on `VoiceLlmTurnStarted`, after admission, as a detached task (`:3215-3225`). `:2613-2616`: deltas are sent at once. `:3305-3306`: "the text continues". Note: a crisis UI exists (`CallScreen.tsx:574-581`, `CrisisResourcesPanel`), but nothing can trigger it. |
| BE-OBSERVABILITY-SAFETY-COST-03 | confirmed | medium | `engine.py:2244-2252`: `_record_billable_audio(kind="stt")` is awaited inside intake, before the no-speech check at `:2253` and before the LLM turn. `:3388-3421`: under `billing_lock`, `debit_operation_credits` runs (`models.py:2900-2930`: transaction with `SELECT ... FOR UPDATE`) whenever `seconds_delta>0`, which is almost every turn. `_persist_billing_metadata` (`get_session` + `update_session_metadata`) runs on every call that is not exhausted. Empty transcripts with `duration_ms>0` are billed. The latency figure is an inference. |
| BE-OBSERVABILITY-SAFETY-COST-04 | confirmed | medium | `engine.py:2495-2508`: after `send_audio_chunk`, `deliver()` awaits `bill_delivered_tts` when a sentence starts or 2 s of audio has accumulated (`:117`). That awaits `_record_billable_audio` (debit plus metadata read/write under `billing_lock`, which STT billing also takes). `deliver` is awaited in `_drain` (`call_tts_elevenlabs.py:266-283`), so the next chunk waits. The triggering chunk itself has already been sent. An audible gap needs DB latency greater than the client's buffered audio (inference). |
| BE-OBSERVABILITY-SAFETY-COST-05 | confirmed | high | `engine.py:2877-2924`: `user_stop_ttfb_ms` = lag + route lead + segment to first chunk, recorded before `send_audio_chunk` (`:2456-2470`). `metrics.py:1168-1169`: "First audio is not in the DB". `:1467-1482`: the only latency alert is `call_first_audio_ms` p50, fed from `ttfb_ms`, which starts at `first_sentence_ready_ms` (`engine.py:2535-2537`). `_FEED` (`metrics.py:755-776`) has no entry for stt_completed, turn_admitted, llm_first_delta or tts_first_sentence. `_call_dimensions` (`engine.py:1686-1697`) uses the TTS provider and model. The only `provider_request` emitters are `tts_http.py` and the Fish runtime; the call WS lane has none. `report_playback` (`:1266-1296`) only gates flush-ahead. |
| BE-OBSERVABILITY-SAFETY-COST-06 | adjusted | low | The drops are real: `observability.py:319-327` keeps only allowlisted keys, and `kind`, `stage`, `reason`, `no_speech_prob`, `rms`, `peak`, `billed_credits`, `credit_delta`, `assistant_message_id`, `asset_id` and `error` are not in `SAFE_OBSERVABILITY_FIELDS`. The `*audio*` keys hit the forbidden marker. Nothing is counted. Corrections: (1) `voice_call_audio_link_failed` keeps user_id, adventure_id, voice_session_id and turn_id, and a WARNING with the message id and error class is logged just before it (`engine.py:3573-3578`). (2) Billing state is written to `voice_session.metadata.billing` on every record (`:3441-3455`). (3) Rejected segments keep `category`/`duration_ms`, and the DB row stores `error_category`/`stt_summary`. The diagnostics are degraded, not lost. |
| BE-OBSERVABILITY-SAFETY-COST-07 | adjusted | low | True: `tts_multicontext_ws.py:1029-1032` puts all fields in `extra=`. `main.py:240-249` (JSON) and `:293-299` (plain) drop extras, and nothing in `src/` reads `speech_call_ws` or adds handlers. `observability.py:168-173` logs a dict repr, and `now_ms` uses `time.time()` (`:311-316`). Overstated: `voice_ws_close` (`engine.py:1699-1712`) carries close_code, provider_code, retry_class and region, and `voice_turn_audio` carries live_contexts, queue_wait_ms and region. What is really lost is `request_id` and the lane-internal events (e.g. `first_audio_timeout`). |
| BE-OBSERVABILITY-SAFETY-COST-08 | confirmed | medium | `metrics.py:4-14`: no exporter (Q-07). `:1652-1660`: `VOICE_METRICS_MONITOR_ENABLED` defaults to false. `:1695-1703`: `run_once` evaluates narration, call, first_audio, provider and keepalive rules, but not spend (and not account_event either). Alerts are only `log_alerts`. The `spend_budget_pct` gauge (`:626-627`) has no `spend_circuit` producer anywhere in `src/`. `admin_voice_metrics.py:175` has no keepalive rule. |
| BE-OBSERVABILITY-SAFETY-COST-09 | adjusted | low | True: `llm_execution_transport.py:82-95` sends no traceparent or X-Request-Id. `trace_id` is a forbidden marker (`observability.py:129`), and voice events carry no execution id. Wrong details: the BFF does handle `X-Request-Id` on other routes (stories, assistant, lorebook, images, llm_inference), just not on voice. The BFF `execution_id` goes to api.magic_llm as `Idempotency-Key`, which `interaction_admission.py:28-36` uses as its persisted admission key, and the BFF ledger stores `execution_id` with `request_id` (`llm_execution_admission.py:250-262`). An offline DB join to `time_first_token_ms` is possible but laborious. This is a missing-tracing convenience gap, largely covered by finding 05. |
| BE-OBSERVABILITY-SAFETY-COST-10 | confirmed | medium | `spend_circuit.py:1-15` counts TTS synthesis only. `engine.py:3170-3213` records call slices at list price. `moderation_transport.py:19-25` (no per-user admission) and `:463-485`: the usage log line comes only after `_complete` returns, so timeouts and cancellations leave no record. STT seconds and callbot LLM tokens never feed the circuit. Upstream billing of cancelled requests remains unverified. |
| BE-OBSERVABILITY-SAFETY-COST-11 | adjusted | medium | Core confirmed: `quota.py:268` reserves `min(600, remaining)`. `:569-576` charges `min(elapsed, reserved)` on stale expiry. Startup runs the same sweep (`engine.py:1771-1779`). Graceful shutdown releases with billable seconds (`engine.py:1781-1796`), so only hard crashes orphan reservations. Corrections: idle ≥ 900 s implies elapsed ≥ 600 s, so with defaults every orphan is released once elapsed ≥ `max_call_seconds` (600 s), within about 10-11 min of call **start** (60 s sweep), not "up to 15 min". The charge is then always the full reservation, so with the 10-min default the user loses the remaining day's allowance. Missed impact: the per-user in-flight limit of 1 (`quota.py:236-248`) also blocks that user's own new calls (`busy`) until release. |
| BE-OBSERVABILITY-SAFETY-COST-12 | adjusted | low | True: the abuse service has no `end_calls` hook. Only the admin restrictions, minor reports and companion safety end live calls. Segment admission re-checks consent only (`admission.py:189-212`), and the block hook is awaited in `_report_blocks` (`moderation.py:754-772`). Mechanism wrong: `drained_chars()` (`call_ledger.py:394-400`) counts characters flushed whose audio was never **delivered** to the BFF, not "unheard" ones. Provider audio arrives faster than real time, so a barge-in typically drains little. With 20k characters per event, warning at score 3 (60k) and a 10-minute daily call quota, normal interrupters are unlikely to be warned, and a 24 h disable (200k) is implausible. |
| BE-OBSERVABILITY-SAFETY-COST-13 | confirmed | medium | `companion_safety.py:446-483` logs risk, source and user_id at ERROR/WARNING and emits `companion_safety_pause` with user_id and risk (both allowlisted). `abuse.py:194-203` logs user_id, trigger and the severe flag. `errors.py:77-100` redacts secrets, URLs and hex only. There are 17 `exc_info`/`logger.exception` sites in `voice_orchestration/`. The design is intentional (docstring `:39-40`). The safety-pause logs are dormant while detection is inert (finding 02); the abuse-disable logs are live. |
| BE-OBSERVABILITY-SAFETY-COST-14 | adjusted | low | True: `admission.py:103-142` takes `FOR UPDATE` on the account row and attempt, sums the day's attempts and upserts `voice_spend_daily`. `streaming.py:188-189` awaits `attempt.extend` before each unit is yielded. Corrections: Fish calls are off by default (`FISH_AUDIO_CALLS_ENABLED`, `fish_audio/config.py:87`). Fish account concurrency is small (dev 1) and global call concurrency is 8, so lock contention is bounded. `resolve_dictionaries` (`performance.py:9-15`) returns at once without a DB read when the performance has no `dictionary_refs`. |
