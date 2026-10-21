# Backend call engine: turn lifecycle, server VAD, barge-in, truncation, concurrency

Audit notes, 2026-10-20. Subsystem: the live voice-call engine of `magic-worlds-api`
(`VoiceCallEngine`). Read-only audit, no source modified.

Legend: **FACT** = read in code at the cited `file:line`. **INFERENCE** = reasoned from
facts, not observed at runtime. **UNKNOWN** = not determinable from the code read.

Paths are abbreviated:

| Short | Absolute |
| --- | --- |
| `engine.py` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py` |
| `server_vad.py` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/server_vad.py` |
| `config.py` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py` |
| `call_ledger.py` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/call_ledger.py` |
| `call_word_ledger.py` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/call_word_ledger.py` |
| `call_tts_elevenlabs.py` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/call_tts_elevenlabs.py` |
| `llm_turn_runner.py` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/llm_turn_runner.py` |
| `callbot_execution.py` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/callbot_execution.py` |
| `sentence_buffer.py` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/sentence_buffer.py` |
| `transcript_sanitizer.py` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/transcript_sanitizer.py` |
| `delivery.py` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/delivery.py` |
| `observability.py` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/observability.py` |
| `call_turn_truncation.py` | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/call_turn_truncation.py` |
| `conversation_turn_store.py` | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/conversation_turn_store.py` |
| `conversation_execution.py` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/conversation_execution.py` |
| `conversation_turn_lifecycle.py` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/conversation_turn_lifecycle.py` |
| `route_voice_call.py` | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_voice_call.py` |
| `tts_multicontext_ws.py` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/providers/elevenlabs/tts_multicontext_ws.py` |
| `moderation.py` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/moderation.py` |
| `useVoiceCallController.ts` | `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/hooks/useVoiceCallController.ts` |
| `voiceVadProcessor.worklet.js` | `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/audio/voiceVadProcessor.worklet.js` |
| `roadmap.md` | `/home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/00_current_status_and_roadmap.md` |
| `fish18.md` | `/home/andres/WebstormProjects/magic-worlds/docs/fish_audio_support/18_call_engine_development.md` |

---

## 1. Architecture in one paragraph

A call has two transports (FACT). A **WebSocket** (`route_voice_call.py:1452-1571`) carries the
handshake, server frames (acks, transcript, deltas, base64 MP3 chunks, turn start/end,
cancel, errors) and client control frames (`voice_ping`, `voice_barge_in`, `voice_playback`,
`voice_end`, `voice_resume`). Each user utterance is uploaded as a **separate HTTP POST**
(multipart, 16 kHz mono PCM16 WAV) to `/character-chats/{id}/voice-segments`
(`route_voice_call.py:1130-1223`), which calls `VoiceCallEngine.accept_segment`
(`engine.py:2000-2110`). **The whole turn runs inside that HTTP request task**:
`_VoiceTurn.task = asyncio.current_task()` (`engine.py:2046`), and the POST returns only
after STT, LLM, TTS drain and persistence finished (`engine.py:2092-2104`, client comment
`useVoiceCallController.ts:622`). Per-call state lives in a process-local
`_VoiceCallRuntime` (`engine.py:555-630`, "single process / sticky routing only"); the
container runs one uvicorn process (`src/serve.py`, no workers option).

Key objects (FACT):

- `_VoiceCallRuntime` (`engine.py:555-630`): `intake_lock`, `billing_lock`,
  `truncation_lock`, `segments` (in-flight turns), `current_turn`, `last_turn`,
  `pending_truncation`, `playback` (latest `played_ms` per turn), `speech_call` (TTS
  multi-context socket), flags `tts_leg_ended`, `spend_refused`, `ending`.
- `_VoiceTurn` (`engine.py:504-552`): one uploaded segment from intake to end; `cancel_event`,
  `finished`, `cancel_reason` (`superseded | end_call | barge_in`), `user_text`,
  `user_message_persisted`, `turn_id` (set only once `voice_turn_start` is published),
  `collected_text`, `llm_completed`, `end_published`, `ledger`, `speaker`,
  `truncation`, `mid_stream_keep`, `truncation_task`, `audio_final_at`.
- `VoiceLlmTurnRunner.stream_turn` (`llm_turn_runner.py:148-250`): wraps the callbot
  executor (`callbot_execution.py:177-254` -> `conversation_execution.execute_conversation_turn`)
  into events `VoiceLlmTurnStarted | VoiceAssistantDelta | VoiceLlmTurnCompleted |
  VoiceLlmTurnAborted`, with a lockstep queue (`maxsize=1`, each event awaits `consumed`,
  `llm_turn_runner.py:155-164`) and upstream cancellation (`producer.cancel()`,
  `llm_turn_runner.py:195-208`).
- `ElevenLabsTurnSpeaker` (`call_tts_elevenlabs.py:66-292`), used for **both** ElevenLabs
  and Fish lanes: a pusher task (moderate + render + flush-ahead gate + `push_text`) and a
  drainer task (`turn_audio` -> `deliver`).
- `CallTurnLedger` / `WordCallTurnLedger` (`call_ledger.py:171-418`,
  `call_word_ledger.py:12-97`): sentence entries, delivered-audio timeline, `keep_end(played_ms)`
  (barge-in cut) and `drained_chars()`.
- `VoiceDelivery` (`delivery.py:166-294`): per-socket send lock, cancelled-turn set (late
  chunks dropped), stale-seq detection.

---

## 2. Turn lifecycle, step by step (FACT unless marked)

### 2.1 Route (before the engine)

`upload_voice_segment` (`route_voice_call.py:1130-1221`): receipt timestamp dependency
(`_mark_segment_received`, `:1120-1122`), auth, `_http_user_context`, `resolve_workspace_context`
(`intent="new_work"`), `get_user_chat`, `build_admission_context` (consent only,
`require_capacity=False`), Content-Length guard, `request.form()`, field validation
(16 kHz mono only, `:1185-1186`), then `engine.accept_segment(...)`.

### 2.2 `accept_segment` (`engine.py:2000-2110`)

1. `store.get_session` ownership/active check (`:2024-2032`), runtime lookup (`:2033-2035`).
2. SHA-256 of the bytes must match metadata (`:2037-2040`); idempotency key shape (`:3847-3852`).
3. Capacity: `len(runtime.segments) >= MAX_INFLIGHT_SEGMENTS_PER_CALL (3)` -> `VoiceSegmentCapacityError`
   -> HTTP 429, `retry_after_seconds=1` (`:2041-2042`, `errors.py:185-189`, `admission.py:124-125`).
4. Warm-ups fired, not awaited: moderation plan (`_warm_call_moderation`, `:3279-3291`) and TTS
   socket prewarm (`_warm_call_speech`, `:3267-3277`) (`:2043-2044`).
5. `_VoiceTurn(task=current_task)` added to `runtime.segments`; `last_activity_at` updated (`:2046-2048`).
6. `touch_call` (quota reservation DB touch) (`:2050`).
7. **`async with runtime.intake_lock`** (`:2051`): `_intake_segment(...)` (2.3). If the result is
   a `VoiceSegmentResult` (rejected/duplicate/cancelled) it returns without superseding (`:2062-2064`).
   Otherwise, still under the lock, `previous = runtime.current_turn; runtime.current_turn = turn`
   (`:2065-2067`): **turns supersede in intake-lock arrival order, not by `seq`**.
8. Supersede (outside the lock, `:2069-2088`): if `previous` not finished:
   `_supersede_heard_prefix(previous)` then `_cancel_turn(previous, "superseded")` then
   **`await previous.finished.wait()` (no timeout)**. If the previous turn was superseded before its
   user message was persisted, its text is merged: `f"{previous.user_text} {text}"` (bounded by
   `DEFAULT_MAX_TRANSCRIPT_CHARS = 4000`, `transcript_sanitizer.py:11`).
9. `turn.user_text = text`; if this turn was itself cancelled meanwhile -> `_cancelled_segment`
   (`:2089-2091`); else `_run_voice_turn(...)` (`:2092-2104`).
10. `finally` (`:2105-2110`): remove from `segments`, clear `current_turn` if still this turn,
    `turn.finished.set()`, update `last_activity_at`.

### 2.3 `_intake_segment` (`engine.py:2112-2284`), all under `intake_lock`

| Step | Code | I/O |
| --- | --- | --- |
| Duplicate check by `(voice_session_id, seq, role=user)` | `:2124-2126` | DB read |
| Create segment row `status=received` (IntegrityError -> duplicate) | `:2127-2156` | DB write |
| `voice_segment_ack{received}` | `:2157-2160` | WS send |
| Server "VAD" validation (`validate_voice_segment`) | `:2161-2175` | CPU on event loop |
| On reject: row `rejected`, ack `rejected`, event | `:2176-2203` | DB + WS |
| Row `accepted`, ack `accepted`, `voice_segment_received` | `:2205-2210` | DB + WS |
| **STT** `stt_client.transcribe_segment(audio, language=stt_language, prompt=stt_prompt)` | `:2212-2242` | HTTP (Groq) |
| **STT billing** `_record_billable_audio(kind="stt")` when `duration_ms > 0` (before the empty check) | `:2243-2251` | DB (debit + get + update) under `billing_lock` |
| Empty/no-speech -> row `rejected/no_speech` | `:2252-2272` | DB |
| `sanitize_transcript_text`, row `completed` with transcript | `:2274-2281` | DB |
| If cancelled meanwhile -> `cancelled` | `:2282-2283` | DB |

### 2.4 Server "VAD" (`server_vad.py`)

It is **not a voice activity detector**, it is a WAV/format/energy validator (FACT):
`_validate_common` (byte/duration bounds, `min_segment_duration_ms=250`, `:207-219`),
`_parse_wav` (RIFF/fmt/data, `:133-166`), PCM16 16 kHz mono only (`:250-263`), stats via
`math.sumprod` plus a Python-level `map` over samples (`:178-204`), duration tolerance
500 ms (`:285-286`). The energy gate is **off by default** (`vad_energy_gate_enabled=False`,
`server_vad.py:31`, `config.py:111`); only digital silence (`peak < 0.002`) is rejected
(`server_vad.py:243-247`). No-speech decisions are deferred to Groq Whisper metrics
(`no_speech_prob`, `avg_logprob`, compression ratio, hallucination phrases; `stt_groq_client.py:171-213, 278-306`).
Measured locally (scratch benchmark of the same stats code): ~2.7 ms for 3 s, ~9 ms for
10 s, ~27 ms for 30 s of audio, executed synchronously on the event loop.

### 2.5 `_run_voice_turn` (`engine.py:2292-2812`)

1. `await self._await_pending_truncation(runtime)` (`:2322`, `:1669-1683`): a barge-in cut of the
   previous reply must land before this LLM reads history; bounded by
   `VOICE_TRUNCATION_WAIT_SECONDS = 3.0` (`:109`).
2. Ledger: `WordCallTurnLedger` for Fish, `CallTurnLedger` for ElevenLabs (`:2325-2327`).
3. Spend-circuit read started as a task (`:2343`, `:2814-2840`).
4. `llm_runner.stream_turn(VoiceLlmTurnContext(...), cancel_event=turn.cancel_event)`
   (`:2542-2561`), wrapped in `_with_idle_ticks(events, 0.12 s)` (`:2563`, `:3919-3944`):
   a `None` tick every 120 ms of LLM silence lets a buffered sentence that already ends with
   punctuation be spoken (`:2564-2570`).
5. `VoiceLlmTurnStarted` (`:2571-2606`): mark user message persisted, ids; if cancelled, stay
   unpublished; else `turn.turn_id = ...` (**published**), await spend check (may switch the call to
   text-only), `start_speaker(turn_id)` (TTS `begin_turn` overlaps the LLM), send
   `voice_transcript_final`, start companion-safety screen task, send `voice_turn_start`.
6. `VoiceAssistantDelta` (`:2607-2621`): send `voice_assistant_delta`, append to
   `collected_text`, `SentenceBuffer.add_spans` -> `speak_later` -> `speaker.submit(span)`.
7. `VoiceLlmTurnCompleted` (`:2622-2632`): `llm_completed=True` if `completed`; flush the tail span
   (only if not cancelled), else `sentence_buffer.reset()`.
8. `await speaker.finish()` (`:2635-2637`): close input, wait until all sentences pushed **and**
   the context's audio drained. Because of the flush-ahead gate (2.6) a long reply keeps the
   turn alive roughly until playback is within 3 sentences / 8 s of the end.
9. Completion checks (`:2638-2647`), final TTS billing (`:2648-2650`).
10. Mid-stream barge-in outcome: `_finish_mid_stream_turn` (store the heard prefix as
    `completed`) or, if the LLM had completed before the cancel landed, `_decide_truncation`
    (`:2654-2664`).
11. Moderation-blocked notice / spend notice (`:2665-2681`).
12. `voice_audio_final`, `audio_final_at`, **`end_published = True`** (`:2682-2687`).
13. `_settled_truncation` (≤3 s) and `voice_turn_end{status, partial, truncated, played_ms, kept_chars}`
    (`:2688-2710`). `runtime.last_turn = turn` only if the LLM status was `completed` (`:2711-2713`).
14. Contract check `completion.content == collected_text` (`:2714-2720`).
15. If stored status `completed` and audio exists: `_persist_assistant_call_turn` (owned MP3 asset:
    storage write + `tts_job`/`tts_asset` transaction + assistant segment row + message
    metadata patch) (`:2721-2746`, `:3469-3588`, `:4002-4138`).
16. User segment row -> `completed|cancelled|failed` with turn ids (`:2747-2755`), `voice_turn_finalized`.
17. Errors: `CancelledError` re-raised (`:2777-2778`); other exceptions -> superseded-unpublished
    turns become `cancelled`, else `_fail_turn` (non-fatal `voice_error`, `voice_audio_final`,
    `voice_turn_end{failed}`, row `failed`) and re-raise (`:2779-2784`, `:3103-3164`).
18. `finally` (`:2785-2812`): stop/cancel the TTS context if audio incomplete, `speaker.abort()`,
    final billing, await spend tasks, cancel spend check, `delivery.forget_turn`, close speech
    socket if spend-refused.

### 2.6 TTS speaker (`call_tts_elevenlabs.py`)

- `_run` (`:183-201`): `_begin` (`begin_turn`, with one retry after a voice replacement,
  `:203-219`) then pusher and drainer tasks.
- `_push` (`:228-264`): per sentence **sequentially**: `prepare` (engine closure: spoken-text
  validation, Fish performance compile, **moderation verdict**, D27 sanitize/render;
  `engine.py:2364-2431`) -> flush-ahead gate `may_flush` (`:160-167`) -> `push_text` -> `on_flush`
  spend metering. After the last sentence, `end_turn`.
- Flush-ahead: first 3 sentences free (`FLUSH_AHEAD_FREE_SENTENCES=3`, `:55`); later ones only
  while `< 3` flushed sentences unheard and `< 8000 ms` audio ahead of playback (`:56-57`).
  Playback = client `voice_playback` (latest, max) else `now - first_chunk_at - 500 ms`
  (`:150-158`). Rechecked on playback reports, audio, and every 250 ms (`:59`, `:169-179`).
- `_drain` (`:266-292`): `async for chunk in call.turn_audio(turn_id)` -> `await deliver(chunk)`
  (engine `deliver`, `engine.py:2441-2509`), which sends the WS chunk, feeds the MP3 meter and the
  ledger, and **awaits billing DB writes inline** at each sentence start or every 2 s of audio
  (`engine.py:2507-2508`, `VOICE_EL_BILLING_INTERVAL_MS=2000` at `:117`).
- `cancel_turn` in the EL adapter ends the turn's audio iterator immediately (queue `None`) and
  sends `close_context` (`tts_multicontext_ws.py:390-406`).

### 2.7 Frames emitted per normal turn (FACT, order)

`voice_segment_ack{received}` -> `voice_segment_ack{accepted}` -> (STT) ->
`voice_transcript_final` -> `voice_turn_start` -> `voice_assistant_delta`* (interleaved with)
`voice_audio_chunk`* -> `voice_audio_final` -> `voice_turn_end` -> (optional later)
`voice_cancelled{barge_in, truncated:true}` (WS-S4, `engine.py:1630-1642`). A cancel sends
`voice_cancelled{reason}` immediately (`delivery.py:270-287`). HTTP response body:
`VoiceSegmentResult.as_response()` (`engine.py:186-201`).

---

## 3. State machines

### 3.1 Call state reported in snapshots (`engine.py:1865-1870`)

`listening` (no current turn or finished) | `assistant_thinking` (current turn, no audio yet) |
`assistant_speaking` (current turn with `audio_last_seq > 0`). Call end reasons are
`user | quota | superseded | disconnected | idle_timeout | max_duration | server_shutdown |
voice_restricted` (`delivery.py:64`).

### 3.2 Turn (`_VoiceTurn`) flags

```
created (in segments) --intake_lock--> intake
  intake: received -> accepted -> [STT] -> completed | rejected(no_speech/validation) | duplicate | cancelled
  completed transcript --claim current_turn--> waiting previous.finished (supersede)
  --> running LLM (unpublished) --VoiceLlmTurnStarted & !cancel--> published (turn_id set)
  published --LLM completed--> llm_completed
  --speaker.finish--> end_published (voice_audio_final + voice_turn_end)
  --> persisting (asset, segment rows) --> finished (finally)
cancel_event can be set by: supersede (_cancel_turn "superseded"), barge_in, end_call.
_cancel_turn is a no-op once end_published or finished (engine.py:1958-1960).
```

### 3.3 Stored rows

- User transcript segment (`voice_transcript_segment`, role=user): `received -> accepted ->
  completed` then final `completed | cancelled | failed`, or `rejected` / `cancelled`
  (`engine.py:2127-2290, 2747-2755`).
- Conversation messages: user message stored `completed` at admission; assistant row
  `streaming` -> `completed` (full text) | `interrupted` (empty content) | `failed` (empty)
  (`conversation_turn_store.py:624-693`, `conversation_execution.py:180-186, 221-223`).
- Truncations: completed reply cut to the heard prefix (`call_turn_truncation.py:168-269`); a
  mid-stream interrupted reply converted to `completed` with the heard prefix and `usage: null`
  (`conversation_turn_store.py:714-813`). Both refuse with `not_latest` once a newer message exists.
- Assistant voice segment row + owned MP3 asset only for stored-`completed` turns with audio
  (`engine.py:2721-2746`).

---

## 4. Concurrency model

| Mechanism | Where | Effect |
| --- | --- | --- |
| `intake_lock` (FIFO asyncio.Lock) | `engine.py:2051-2067` | Validation + STT + STT billing serialized per call; the claim of `current_turn` happens under it |
| One current turn | `engine.py:2065-2074` | A newer transcript cancels the previous turn and **waits for it to finish** before its own LLM starts. LLM/TTS of consecutive turns never overlap. STT of turn N+1 overlaps LLM/TTS of turn N |
| In-flight cap | `engine.py:83, 2041` | 3 segments per call (HTTP 429 beyond) |
| `billing_lock` | `engine.py:3389-3421` | DB debit + session-metadata read-modify-write serialized per call; shared by STT billing (intake) and TTS billing (drain) |
| `truncation_lock` + chained tasks | `engine.py:1567-1575, 1588-1589` | PD-1 updates applied in order |
| Shielded persistence | `conversation_turn_lifecycle.py:11-33`; `llm_turn_runner.py:246-250`; `callbot_execution.py:227-247` | A cancellation never interrupts an admission/terminal commit; reconciliation decides completed vs cancelled |
| Engine-owned background task sets | `engine.py:697-702` | spend, safety, truncation tasks held with strong refs and `discard` callbacks |
| Watchdog per call (1 s) | `engine.py:1823-1836` | max duration, quota, idle |
| Maintenance sweep (60 s) | `engine.py:1813-1821, 3637-3698` | stale reservations / orphan sessions |
| Delivery send lock per socket | `delivery.py:212-231` | All frames (audio, cancel, pong) serialized; no send timeout |

Task-leak review (FACT): speaker tasks aborted in the turn `finally` (`engine.py:2791-2792`);
`_with_idle_ticks` cancels its pending `__anext__` future (`:3941-3944`); runner `finally`
cancels producer/queue/cancellation tasks (`llm_turn_runner.py:239-250`); watchdog/pending-end
cancelled in `end_call` (`engine.py:1126-1128`); `delivery.forget_turn/forget_call`
(`:2803-2804, 1875`); playback map bounded to 4 turns (`:121, 1294-1295`). No leak found.
Remaining after-life work: turn tasks that outlive the 2 s end-call drain keep running against a
forgotten runtime (sends become no-ops; DB writes and billing still execute; see finding 10).

---

## 5. Barge-in and truncation paths

Inputs: `voice_barge_in{reason, turn_id?, played_ms?}` (WS loop, `route_voice_call.py:1500-1508`)
and `voice_playback{turn_id, played_ms}` every 500 ms from the client
(`useVoiceCallController.ts:150`), stored as the max per turn, rate limited to 4/s per call
(`engine.py:1267-1297`).

Target selection `_barge_in_target` (`engine.py:1354-1365`): the current turn if published, not
finished and not end-published; else the current/last turn if end-published and inside the
truncation window (`_truncation_window_open`, `:1337-1352`: until playback reached the delivered
audio, or `audio_final_at + delivered_ms + 2000 ms`). **An unpublished current turn (STT /
admission / "thinking") is never a target** (barge-in returns False).

`played` = frame `played_ms`, else latest playback report, else `delivered_ms`, clamped to
`[0, delivered_ms]` (`:1375-1376`).

| Case | Code | What happens |
| --- | --- | --- |
| A. Barge-in, LLM still streaming | `:1384-1391`, `:1447-1473`, `:1475-1539` | Heard prefix decided synchronously (`MID_STREAM_BARGE_IN_POLICY = KeepHeardPrefixPolicy`, `call_ledger.py:97-129`), turn cancelled (LLM producer cancelled upstream, TTS context closed, late chunks dropped). When the cancelled turn ends, `complete_interrupted_call_turn` turns the `interrupted` row into `completed` with the prefix (≤3 s, `wait_for`). Nothing heard -> stays `interrupted`, empty |
| A'. Cancel raced a completed LLM commit | `:2661-2664` | Reply cut after completion at the same `played_ms` |
| B. Barge-in, LLM completed, audio still generating | `:1380-1382`, `:1541-1576`, `:1578-1642` | PD-1 truncation task scheduled; turn cancelled; `voice_turn_end` carries the cut after `_settled_truncation` (≤3 s) |
| C. Barge-in after `voice_turn_end`, window open | `:1359-1361`, `:1630-1642` | PD-1 truncation; WS-S4 `voice_cancelled{truncated}` |
| D1. Supersede (new transcript) while previous streams | `:2069-2074`, `:1414-1446` | Same as A/B with `played` = latest playback report (≤500 ms stale) at the moment the new segment's STT finished |
| D2. **Supersede after previous `voice_turn_end`** | `:1426-1434` returns early on `end_published`; `:1958-1960` | **Nothing**: no truncation, no `voice_cancelled`. See finding 01 |
| E. `end_call` while a turn streams | `:1129-1133`, `:1958-1976` | Turn cancelled (`reason=end_call`); no heard-prefix policy -> assistant row `interrupted`, empty |

Cut granularity (FACT): ElevenLabs ledger keeps up to the **end of the last sentence whose audio
started before `played_ms`** (`call_ledger.py:380-392`), i.e. sentence-granular even though
per-character alignment is tracked (`acked_chars`, `:277-294`). Fish uses the revisable
word timeline (`call_word_ledger.py:91-93`). The stored MP3 asset keeps all delivered audio even
when the transcript is cut (`engine.py:2714-2745`).

Drained characters (flushed text whose audio never arrived) are counted on every
`_cancel_speech_turn`, regardless of reason (barge-in, supersede, end_call), into the D26 abuse
counter (`engine.py:1993-1994`, `:3351-3376`).

---

## 6. What the LLM sees after interruptions

`build_conversation_messages` (`conversation_execution.py:56-86`) keeps only `completed`, active
rows; content only, no metadata. Therefore (FACT):

- Truncated replies appear as a shorter assistant message with **no marker** that the user
  interrupted (metadata `voice.truncated/played_ms` is not rendered).
- Interrupted replies with nothing heard disappear; the history shows two consecutive user
  messages.
- A pause-split utterance whose first half was already admitted produces two user messages (the
  merge only happens when the superseded turn's user message was not yet persisted,
  `engine.py:2075-2088`).
- History window: last 100 messages (`conversation_turn_store.py:106-108`).
- Ordering guarantee: the next turn waits for the previous turn to finish
  (`engine.py:2074`) and for a pending PD-1 truncation (≤3 s, `:2322`), so in the common path the
  cut lands before the next admission reads history (tests:
  `tests/voice/test_voice_barge_in_truncation.py:256-283`,
  `tests/voice/test_mid_stream_barge_in.py:211`).

---

## 7. Configuration and timing constants

| Constant | Default | Where |
| --- | --- | --- |
| `VOICE_CALL_SECONDS_PER_CREDIT` | 10 s | `engine.py:81` |
| `MAX_INFLIGHT_SEGMENTS_PER_CALL` | 3 | `engine.py:83` |
| `VOICE_TTS_QUEUE_MAX_SENTENCES` | 4 (**unused**) | `engine.py:85` |
| `VOICE_TTS_IDLE_FLUSH_SECONDS` | 0.12 s | `engine.py:88` |
| `VOICE_END_CALL_DRAIN_SECONDS` | 2.0 s | `engine.py:90` |
| `VOICE_WATCHDOG_INTERVAL_SECONDS` | 1.0 s | `engine.py:91` |
| `VOICE_SWEEP_INTERVAL_SECONDS` | 60 s | `engine.py:92` |
| `VOICE_ORPHAN_SESSION_GRACE_SECONDS` / limit | 60 s / 200 | `engine.py:94-95` |
| `VOICE_TRUNCATION_WINDOW_GRACE_MS` | 2000 ms | `engine.py:108` |
| `VOICE_TRUNCATION_WAIT_SECONDS` | 3.0 s | `engine.py:109` |
| `VOICE_EL_BILLING_INTERVAL_MS` | 2000 ms | `engine.py:117` |
| `VOICE_PLAYBACK_MAX_FRAMES_PER_SECOND` | 4 | `engine.py:119` |
| `VOICE_PLAYBACK_TURNS_KEPT` | 4 | `engine.py:121` |
| `MAX_SPEECH_END_LAG_MS` | 120000 | `engine.py:3857` |
| STT model / base URL | `whisper-large-v3` / Groq OpenAI-compatible | `config.py:19-20` |
| `VOICE_STT_TIMEOUT_SECONDS` | 30.0 s (max 120) | `config.py:47, 49` |
| Daily minutes per user | 10 | `config.py:30` |
| Max call duration | 600 s | `config.py:31` |
| Idle timeout | 120 s (must be ≤150 for EL) | `config.py:32, 38` |
| EL socket inactivity | 20 s | `config.py:36` |
| Max calls in flight per user / global | 1 / 8 (max 64) | `config.py:40-41, 48` |
| Max segment duration / bytes | 30000 ms / 2,000,000 B | `config.py:42-43` |
| Stale session | 900 s | `config.py:44` |
| Resume grace | 20 s (max 300) | `config.py:45-46` |
| Server energy gate | off; floor peak 0.002; rms 0.012; peak 0.025; ratio 0.03 | `config.py:111-115`, `server_vad.py:31-35` |
| Min segment duration | 250 ms | `server_vad.py:21` |
| Required WAV | 16 kHz, mono, 16-bit | `server_vad.py:22-24` |
| Speech sample threshold / duration tolerance | 0.015 / 500 ms | `server_vad.py:36-37` |
| Max transcript / assistant chars | 4000 / 8000 | `transcript_sanitizer.py:11-12` |
| Sentence soft cap / open paren / pause marker hold | 160 / 60 / 8 chars | `sentence_buffer.py:18, 25-26` |
| Flush-ahead free / max unheard / max ahead | 3 / 3 / 8000 ms | `call_tts_elevenlabs.py:55-57` |
| Playback estimate lag / gate recheck | 500 ms / 0.25 s | `call_tts_elevenlabs.py:58-59` |
| Ledger default speech rate | 65 ms/char | `call_ledger.py:56` |
| Mid-stream policy | keep heard prefix | `call_ledger.py:129` |
| Callbot catalog cache | 60 s TTL, 256 entries | `callbot_execution.py:91-92` |
| Call sentence moderation budget | 300 ms, fail closed when required | `moderation.py:73`, `engine.py:3293-3349` |
| EL multi-context: live contexts / connect / first audio / inter-chunk / keepalive | 4 / 3 s / 3 s / 5 s / 15 s | `tts_multicontext_ws.py:74-78` |
| Client VAD silence to end (cross-ref) | 800 ms (450 strict) | `voiceVadProcessor.worklet.js:225` |
| Client AEC warm-up before auto barge-in (per call) | 3000 ms | `useVoiceCallController.ts:143, 685, 705, 998` |
| Client barge-in settle / playback report / queued upload spacing | 2000 / 500 / 120 ms | `useVoiceCallController.ts:146, 150, 152` |

---

## 8. Critical-path latency: user stops speaking -> first audio heard

Instrumentation that exists (FACT): client `vad.speech_end_lag_ms` plus server
`voice_first_assistant_audio.user_stop_ttfb_ms = speech_end_lag + route_lead + segment_to_audio`
(`engine.py:2906-2910`), plus `voice_stt_completed`, `voice_turn_admitted`,
`voice_llm_first_delta`, `voice_tts_first_sentence`, `voice_tts_first_audio`,
`voice_turn_audio{ttfb_ms, queue_wait_ms}` (`engine.py:2233-2242, 2578, 2612, 2538, 2896-2924`).
Documented samples: one local call "TTS TTFB 149 ms; first audio 4.9 s after upload"
(`roadmap.md:61`); callbot first text at 1,578.794 ms through api.magic_llm in one diagnostic
(`fish18.md`, "Authenticated profile follow-up").

| # | Stage | Estimate (ms) | Evidence / reasoning |
| --- | --- | --- | --- |
| 1 | Client VAD silence hang-over | 800 (constant; 450 strict) | `voiceVadProcessor.worklet.js:225` (client subsystem) |
| 2 | WAV hash + upload of the whole utterance (32 KB per s of audio) | 20-150 | INFERENCE; batch upload after end of speech, `route_voice_call.py:1130-1177` |
| 3 | Route auth, workspace, chat, consent lookups, multipart parse | 5-40 | INFERENCE; `route_voice_call.py:1141-1159` (≈3-4 DB reads) |
| 4 | Engine pre-intake: session read + quota touch | 2-10 | `engine.py:2024, 2050` |
| 5 | Intake DB writes + 2 ack frames + validation CPU | 5-25 | `engine.py:2124-2210`; VAD CPU ≈0.9 ms per s of audio (local benchmark) |
| 6 | STT (Groq whisper-large-v3, batch, verbose_json) | 250-900 typical; up to 30000 timeout | INFERENCE for typical; `engine.py:2228-2230`, `config.py:47` (STT subsystem) |
| 7 | STT billing (debit tx + session read + metadata write) + segment `completed` write | 5-30 | `engine.py:2243-2281, 3389-3455` (serialized under `billing_lock`) |
| 8 | Wait for previous turn to finish (supersede) | 0 typical; previous teardown 20-300; bounded only by inner waits (≤3 s + ≤3 s) | `engine.py:2069-2074, 1493-1505, 1656` |
| 9 | Pending truncation wait | 0 typical; ≤3000 | `engine.py:2322, 1669-1683` |
| 10 | BFF admission: scoped session, catalog (60 s cache; else 2 agents-API GETs), prompt render, find_admission, admit transaction (locks session + 100 messages) | 10-60 warm; +100-400 cold catalog | INFERENCE; `callbot_execution.py:106-120, 185-225`, `conversation_execution.py:110-198`, `conversation_turn_store.py:94-115` |
| 11 | LLM TTFT via api.magic_llm graph + provider | 300-1600 | One measured 1,578 ms (`fish18.md`); LLM subsystem |
| 12 | First full sentence (punctuation + following whitespace, or 120 ms idle tick, or 160-char cap) | 100-700 | INFERENCE from `sentence_buffer.py:154-180`, `engine.py:88, 2563-2570` |
| 13 | Per-sentence moderation before the push | 0 (optional, no classifier/cached) to 300 (required) | `moderation.py:73, 636-641`; `call_tts_elevenlabs.py:237` |
| 14 | TTS begin_turn (overlapped with LLM) + socket prewarm (overlapped with STT) | ~0 on the path when warm | `engine.py:2585, 2044, 3267-3277` |
| 15 | TTS first audio byte (EL v4 Turbo multi-context) | ~150 (one sample) to 3000 timeout | `roadmap.md:61`; `tts_multicontext_ws.py:76` |
| 16 | Server -> client base64 JSON frame | 5-50 | INFERENCE; `delivery.py:233-268` |
| 17 | Client jitter buffer / playback start | UNKNOWN (client subsystem) | |
| | **Total (user stop -> first audio)** | **≈2.5-5 s** (one documented 4.9 s after upload) | Sum of the above; dominated by 1, 6, 11, 12 |

Hidden serialized work on the path (FACT): ≈15 sequential DB round trips between segment receipt
and the LLM HTTP request (route ≈4, engine ≈9 incl. billing, admission ≈2+ transaction); STT
billing and segment status writes are not needed to start the LLM.

---

## 9. Findings

### BE-ENGINE-TURNTAKING-01 (high, correctness/ux): supersede after `voice_turn_end` neither cancels nor truncates

- FACT: `_supersede_heard_prefix` returns early when `turn.end_published` (`engine.py:1426-1434`);
  `_cancel_turn` is a no-op once `end_published` (`:1958-1960`); `accept_segment` only calls both
  when `previous.finished` is not set (`:2069-2074`) and never consults `runtime.last_turn`'s open
  truncation window on a new segment (the only users of `last_turn` are `_turn_by_id` and
  `_barge_in_target`, `:1327-1365`).
- FACT: the supersede path exists precisely because "the SPA sends no barge-in frame when echo
  cancellation is off (or on the raw-fallback mic)" (`engine.py:1419-1421`); the client also skips
  auto barge-in during the first 3 s of the call's first playback (`useVoiceCallController.ts:681-685`).
- INFERENCE: short callbot replies (≤3 sentences, <8 s) finish generation in 1-3 s, so
  `voice_turn_end` is published while most of the audio is still playing. For those clients nearly
  every talk-over lands in D2 (section 5): the stored reply keeps its full text (the LLM believes
  everything was heard), and no `voice_cancelled{superseded}` stops the old playback (the client only
  switches when the next `voice_turn_start` arrives, `useVoiceCallController.ts:785-800`).
- Tests cover supersede before the end and after LLM completion, not after `voice_turn_end`
  (`tests/voice/test_mid_stream_barge_in.py:355-419`).
- Recommendation: on a non-empty transcript, if `last_turn` (or the finished previous turn) is
  inside `_truncation_window_open`, run `_decide_truncation` and send `voice_cancelled{superseded,
  truncated}`; estimate `played_ms` at the user's speech onset (segment `started_at_ms` mapped to
  the playback clock) rather than at STT completion; add a regression test.

### BE-ENGINE-TURNTAKING-02 (high, latency/ux): no semantic end-of-turn; fixed silence + batch STT; premature turns

- FACT: the server performs no turn detection: `server_vad.py` only validates format/energy
  (gate off by default, `server_vad.py:31, 238-247`); endpointing is the client's fixed
  800 ms silence (`voiceVadProcessor.worklet.js:225`); STT starts only after the whole segment
  arrives (`engine.py:2228`).
- FACT: when a user pauses mid-thought, the first half becomes a full turn (admitted, persisted,
  LLM started, possibly spoken). The continuation supersedes it after its own STT
  (`engine.py:2066-2074`); text is merged only if the first user message was not yet persisted
  (`:2075-2088`), which admission does within tens of ms, so usually the history keeps two user
  messages and an interrupted/empty or partially-kept reply (`conversation_execution.py:80-86`).
- FACT: a barge-in while the turn is unpublished ("thinking") is ignored (`engine.py:1354-1365`), and
  there is no client "user resumed speaking" signal to hold the pending reply.
- Recommendation: semantic/end-of-utterance model (transcript + prosody) to adapt the hang-over
  (short for complete sentences, long for trailing "and…"), streaming STT with interim results,
  a `voice_user_speaking` hint that holds (not cancels) an unpublished turn's first audio, and
  merging continuation text into the held turn. Already listed as backlog V-07/V-12
  (`roadmap.md:83, 95`).

### BE-ENGINE-TURNTAKING-03 (medium, latency): ≈15 serialized DB round trips plus STT billing before the LLM request

- FACT: route lookups (`route_voice_call.py:1144-1157`), `get_session` + `touch_call`
  (`engine.py:2024, 2050`), `find_segment`, `create_segment`, `update_segment(accepted)`
  (`:2124-2205`), STT billing (`record_call_usage` + `get_session` + `update_session_metadata`, under
  `billing_lock`, `:2243-2251, 3389-3455`), `update_segment(completed)` (`:2275-2281`), then
  `get_scoped_session`, `find_admission`, admit transaction (`callbot_execution.py:185`,
  `conversation_execution.py:110-198`).
- INFERENCE: 20-80 ms on a local MySQL, 100-200 ms+ with a remote DB or pool contention; billing also
  contends with the previous turn's TTS billing on the same `billing_lock`.
- Recommendation: start admission immediately after STT; move STT billing, ack frames and segment
  status writes to a per-call background writer (ordered); cache the session row for the call;
  collapse status updates. Matches deferred lever L-04 (`roadmap.md:81`).

### BE-ENGINE-TURNTAKING-04 (medium, latency): sentence-only first chunk and serial per-sentence moderation

- FACT: TTS gets text only at a sentence boundary that is followed by whitespace, a 120 ms idle
  tick, or a 160-char soft cap (`sentence_buffer.py:154-180, 18`; `engine.py:2563-2570`). No clause
  or comma-level first chunk.
- FACT: each sentence is moderated sequentially inside `_push` before its `push_text`
  (`call_tts_elevenlabs.py:237-260`; `engine.py:2393-2414`) with a 300 ms budget that fails closed
  when moderation is required (`moderation.py:73`); look-ahead `check_ahead` is not built
  (`engine.py:3310-3311`, `moderation.py:33-35`). A dev diagnostic measured a moderation call at
  2,003 ms against a 2 s budget (`fish18.md`), so a required classifier would likely time out at
  300 ms and silence sentences.
- Recommendation: emit the first chunk at the first clause/≥4-6 words; moderate sentence N+1 while
  N is synthesized/played; optionally synthesize speculatively and release audio only on `allow`.

### BE-ENGINE-TURNTAKING-05 (medium, latency/robustness): next turn serialized behind the previous turn's bookkeeping

- FACT: the new turn awaits `previous.finished.wait()` without timeout (`engine.py:2074`); `finished`
  is set only in `accept_segment`'s `finally` (`:2109`), after the previous turn ran
  `_finish_mid_stream_turn` (≤3 s, `:1493-1505`), `_settled_truncation` (≤3 s, `:1656`), the owned
  MP3 persistence (storage write + DB transaction + segment row + metadata patch,
  `:2721-2746, 4075-4130`) and the segment update (`:2747-2755`).
- INFERENCE: with a barge-in frame the teardown usually overlaps the user's speech; on the supersede
  path (no barge-in frame) and for fast replies it adds tens to hundreds of ms, up to seconds when
  the DB is slow. Documented as deferred lever L-11 (`roadmap.md:81`).
- Recommendation: split history-critical writes (interrupted/heard-prefix terminal, PD-1 cut) from
  bookkeeping (asset, segment rows, billing metadata) and run the latter in a background task;
  release the "turn slot" right after the history-critical write; bound the wait.

### BE-ENGINE-TURNTAKING-06 (medium, robustness): turn lifetime bound to the segment's HTTP POST

- FACT: the turn runs in the request task (`engine.py:2046`) and the POST returns after the
  playback-paced TTS drain and persistence (`engine.py:2635-2637`, `call_tts_elevenlabs.py:55-59`;
  client comment `useVoiceCallController.ts:622`). Replies may be up to 8000 chars
  (`transcript_sanitizer.py:12`).
- INFERENCE: long replies keep a request open for tens of seconds to minutes, exposed to reverse
  proxy read timeouts and browser connection limits; a dropped response makes the client resend
  once (`useVoiceCallController.ts:596-608`), which returns `duplicate` immediately while the
  original turn continues, and the client then clears its turn state (`:621-627`).
- Recommendation: acknowledge after intake/STT (202 + turn id) and run the turn as an
  engine-owned task; or move segment audio onto the existing WebSocket (binary frames, enabling
  streaming STT).

### BE-ENGINE-TURNTAKING-07 (medium, ux): barge-in is immediate and irreversible; no false-interruption recovery

- FACT: any accepted `voice_barge_in` kills the TTS context and cancels the LLM producer at once
  (`engine.py:1384-1391, 1958-1994`; `llm_turn_runner.py:195-198`). There is no minimum
  speech duration/words check, no pause-then-resume, and no way to resume the same reply.
- INFERENCE: coughs, backchannels ("mm-hm") or residual echo past the client's gates cut the
  character off and leave a partial reply; the next segment may be rejected as no-speech, leaving
  silence.
- Recommendation: two-phase interruption (duck/pause on speech start, confirm with ≥N words or
  ≥300-500 ms of speech, resume the paused audio if not confirmed), as in LiveKit's false
  interruption handling. Backlog lists "pause-then-confirm barge-in" (`roadmap.md:95`).

### BE-ENGINE-TURNTAKING-08 (medium, cost/correctness): audio produced while the socket is away is billed and counted as delivered

- FACT: `deliver` treats `DROPPED` (no socket) like delivered: billed, metered, ledger-timed and
  stored (`engine.py:2486-2496`, `delivery.py:266-267`). The flush-ahead gate keeps advancing on the
  wall-clock estimate without playback reports (`call_tts_elevenlabs.py:150-158`). Resume sends
  only a state snapshot with `last_audio_seq` and replays nothing (`engine.py:992-1003`). Resume
  grace is 20 s (`config.py:45`).
- INFERENCE: during a 20 s network blip the full reply can be generated, charged to the user and
  stored as completed although never heard.
- Recommendation: pause flushing while `runtime.socket is None`, do not bill dropped chunks, keep a
  short replay buffer for resume, or store the turn cut at the last delivered position.

### BE-ENGINE-TURNTAKING-09 (medium, correctness): interruptions are invisible to the LLM and over-approximated

- FACT: history renders content only (`conversation_execution.py:80-86`); truncation metadata is not
  rendered; nothing-heard replies are dropped; the ElevenLabs cut keeps the whole sentence in which
  playback stopped (`call_ledger.py:380-392`) although char alignment exists
  (`call_ledger.py:277-294`).
- INFERENCE: the model may repeat itself, ignore that it was cut off, or believe the user heard a
  sentence they talked over.
- Recommendation: cut at the word boundary from alignment (`acked_chars`), and annotate the stored
  assistant turn for the model (e.g. a trailing `…[interrupted]` or a system note "the user
  interrupted you after: …").

### BE-ENGINE-TURNTAKING-10 (low, cost): billing for rejected audio and after the call ended

- FACT: STT billing precedes the empty/no-speech check (`engine.py:2243-2252`), so noise segments that
  Whisper rejects still consume user credits. Intake does not check `cancel_event`/`runtime.ending`
  before STT (`:2124-2230`), so a segment queued on `intake_lock` during `end_call` is still
  transcribed and billed. `end_call` computes `consumed_seconds` after a 2 s drain
  (`:1131-1149`) while late turns still bill in their `finally` (`:2793-2796`).
- Recommendation: check cancellation before STT; decide whether no-speech STT is billable; settle
  billing after all turns finished (or credit-reconcile on end).

### BE-ENGINE-TURNTAKING-11 (low, robustness): no ordering by `seq`

- FACT: turns are claimed in `intake_lock` arrival order (`engine.py:2051-2067`); merged text is
  `previous + current` (`:2080`) with no seq comparison. Concurrent uploads exist (client queued
  flush spaced 120 ms, fire-and-forget `void uploadSegment`, `useVoiceCallController.ts:152, 632-641`),
  and each request does variable DB work before reaching the lock.
- Recommendation: track the last claimed seq; hold or reject out-of-order segments; merge in seq order.

### BE-ENGINE-TURNTAKING-12 (medium, robustness): intake (including STT, 30 s timeout) is serialized under `intake_lock`

- FACT: STT runs while holding `intake_lock` (`engine.py:2051-2061, 2228`) with a 30 s default timeout
  (`config.py:47`); in-flight cap is 3 (`engine.py:83`).
- INFERENCE: one slow STT call stalls all later segments of the call (and a 4th upload gets 429);
  there is no hedged/retried STT request.
- Recommendation: shorter STT timeout (2-5 s) with one hedged retry, and release the lock around the
  HTTP call while preserving claim order (sequence numbers).

### BE-ENGINE-TURNTAKING-13 (low, robustness): spoken-text contract can fail a turn mid-stream on benign text

- FACT: every cumulative LLM prefix is validated (`llm_turn_runner.py:176-182`); a tag-like `<word>`,
  a line starting with `System:`/`Assistant:`, or patterns such as `request id:` raise a fatal
  `upstream_contract` (`transcript_sanitizer.py:39, 60-66, 80, 146-161`), failing the turn
  (`engine.py:3103-3164`). User transcripts matching private-payload shapes raise a fatal `conflict`
  from intake (`transcript_sanitizer.py:273-278`) leaving the segment row `accepted`.
- Recommendation: for speech, skip/sanitize the offending sentence and continue; keep hard failure for
  real secrets; mark the segment failed on intake exceptions.

### BE-ENGINE-TURNTAKING-14 (low, ux): `end_call` discards the heard prefix and counts drained characters as abuse

- FACT: end-call cancellation has no heard-prefix decision (only barge-in/supersede call
  `_decide_mid_stream_keep`, `engine.py:1389, 1445`), so a reply cut by hang-up while streaming is
  stored `interrupted`/empty; drained characters are counted for every cancel reason
  (`:1993-1994, 3351-3364`), although the counter is described as barge-in drain (`:593-595`).
- Recommendation: apply the same heard-prefix policy on end_call; count drained chars only for barge-in.

### BE-ENGINE-TURNTAKING-15 (low, correctness): stored call audio does not match the cut transcript

- FACT: the asset stores all delivered audio with the kept text as transcript
  (`engine.py:2714-2745`); a barge-in that lands during asset persistence leaves the asset transcript
  untruncated (known limitation, `roadmap.md:83`).
- Recommendation: trim the MP3 at `played_ms` frame boundary (the frame meter already exists) or store
  `played_ms` on the asset; re-patch after late truncation.

### BE-ENGINE-TURNTAKING-16 (low, latency): TTS billing awaited inline in the audio drain loop

- FACT: `deliver` awaits `bill_delivered_tts` (debit + session read + metadata write under
  `billing_lock`) at each sentence start or every 2 s of audio (`engine.py:2507-2508, 2345-2362,
  3389-3455`); the drainer awaits `deliver` before reading the next chunk
  (`call_tts_elevenlabs.py:275`).
- INFERENCE: DB latency becomes inter-chunk jitter; contention with the next segment's STT billing.
- Recommendation: accumulate billable audio and flush from a per-call billing task.

### BE-ENGINE-TURNTAKING-17 (low, observability): hidden waits are not measured

- FACT: events cover STT latency, admission, first delta, first sentence, first audio, user-stop TTFB
  (`engine.py:2233-2242, 2578, 2612, 2538, 2896-2924`) but not: pre-STT intake/DB time, STT billing
  time, wait for the previous turn, pending-truncation wait, barge-in-to-cancel latency, time from
  first sentence to its push (moderation + gate). No persisted per-turn timing summary (L-12,
  `roadmap.md:81`). Several billing fields recorded in `voice_call_billing_recorded` are not in
  `SAFE_OBSERVABILITY_FIELDS` and are silently dropped (`engine.py:3426-3437`, `observability.py:22-110, 319-327`).
- Recommendation: per-turn span timeline (monotonic marks per stage) emitted once per turn and stored
  on the segment row; histogram metrics for each stage.

### BE-ENGINE-TURNTAKING-18 (low, robustness): unbounded waits and send without timeout

- FACT: `await previous.finished.wait()` has no timeout (`engine.py:2074`); `send_frame` awaits
  `websocket.send_json` under a per-socket lock without a timeout (`delivery.py:212-231`), and the
  turn awaits its sends inline.
- INFERENCE: a stalled (not closed) client socket stalls the turn, the next turn and the WS loop
  (pongs share the lock) until the server's WS keepalive closes it.
- Recommendation: bounded sends (drop or end on timeout) and a bounded supersede wait.

### BE-ENGINE-TURNTAKING-19 (low, robustness): no server-side self-echo guard

- FACT: any non-empty transcript supersedes the current turn (`engine.py:2066-2074`); nothing compares
  it with the assistant text currently playing. The client disables auto barge-in without AEC
  (`useVoiceCallController.ts:681`), but whether it also stops capture/uploads during playback is
  UNKNOWN.
- Recommendation: reject or flag transcripts with high overlap with the assistant's last delivered
  sentences (echo), especially when the client reports AEC off.

### BE-ENGINE-TURNTAKING-20 (info, maintainability): dead constant and unbounded speaker queue

- FACT: `VOICE_TTS_QUEUE_MAX_SENTENCES = 4` is never used (`engine.py:85`); the speaker queue is an
  unbounded `asyncio.Queue()` (`call_tts_elevenlabs.py:95`); output is bounded indirectly by the
  8000-char reply limit.

---

## 10. Strengths (FACT)

- Real barge-in with truncation to what was heard, driven by client `played_ms`
  (`engine.py:1367-1412`), covering four timing cases (mid-stream, post-completion, post-end window,
  completion-vs-cancel race at `:2661-2664`), with idempotent, latest-only DB updates
  (`call_turn_truncation.py:235-242`, `conversation_turn_store.py:769-780`).
- The next turn's history waits for the truncation (≤3 s) so the model normally reads the cut reply
  (`engine.py:2322`), with tests (`tests/voice/test_voice_barge_in_truncation.py:256-283`).
- Upstream cancellation is prompt: the LLM producer task is cancelled on `cancel_event`
  (`llm_turn_runner.py:185-198`) and the TTS context is closed with late frames dropped by turn
  (`engine.py:1978-1994`, `delivery.py:246-249`, `tts_multicontext_ws.py:390-406`).
- Cancellation-safe persistence: shielded commits plus reconciliation (`conversation_turn_lifecycle.py:11-33`,
  `callbot_execution.py:227-247`), so a cancel can never corrupt a completed message.
- Overlaps: TTS context `begin_turn` starts at turn publication, in parallel with the LLM
  (`engine.py:2585`); the TTS socket and the moderation plan are prewarmed during STT (`:2043-2044`).
- Flush-ahead gate bounds TTS spend and drained audio to ~3 sentences / 8 s ahead of playback
  (`call_tts_elevenlabs.py:55-57, 160-167`).
- Idle-tick sentence release (120 ms) avoids waiting for the next token after a final period
  (`engine.py:3919-3944`, `sentence_buffer.py:103-113`).
- Supersede merges a split utterance's text when the first part was not yet admitted
  (`engine.py:2075-2088`), and idempotent segment uploads (`:2124-2144, 3811-3827`).
- Clean task lifecycle (section 4) and bounded maps; resumable socket with 20 s grace
  (`engine.py:1012-1041`).
- Per-stage telemetry already exists, including the D06 `user_stop_ttfb_ms` (`engine.py:2878-2924`).

---

## 11. Open questions / UNKNOWN

1. Does api.magic_llm propagate a client disconnect (BFF producer cancel) to the model provider, or
   does generation (and token billing) continue upstream? (LLM subsystem.)
2. What does the client do with uploads while the assistant is playing and AEC is off: does it keep
   capturing (echo segments) or gate the mic?
3. How long does `close_context` take to release an ElevenLabs slot (`MAX_LIVE_CONTEXTS = 4`,
   `tts_multicontext_ws.py:74, 343-347`)? Rapid barge-ins could make `begin_turn` wait.
4. Real distribution of STT latency, admission time and moderation time per turn (no p50/p95 yet,
   `roadmap.md:61, 81`).
5. Reverse proxy timeouts in front of the BFF for the long-lived segment POST.
6. Is the 10 s/credit audio billing intended to include STT seconds of rejected noise segments?

---

## 12. Gap vs state-of-the-art cascaded voice agents (summary for the report)

| Practice | This engine |
| --- | --- |
| Streaming STT with interim results + endpointing | Batch STT after full segment upload (gap) |
| Semantic / model-based turn detection | Fixed client silence 800 ms (gap) |
| Preemptive LLM on interim transcript | No; LLM starts after STT + DB + billing + admission (gap) |
| Clause-level first TTS chunk | Sentence-level (partial gap; idle tick helps) |
| Barge-in with truncation to heard audio | Yes (strength), sentence-granular for ElevenLabs; missing in post-end supersede (gap) |
| False-interruption recovery | No (gap) |
| Cancellation propagation LLM + TTS | Yes (strength) |
| Interruption marked in LLM context | No (gap) |
| Background persistence off the critical path | Partly (spend/safety/truncation tasks), but asset/segment/billing writes block the next turn (gap) |
| Per-stage latency metrics | Partial (strength), hidden waits unmeasured |

---

## Verification (adversarial)

Second-pass check, 2026-10-20, by opening the cited code and looking for guards, tests or
defaults that would contradict each finding. No source was modified. Paths are abbreviated as
in the table at the top of this file. Findings 10 and 11 were not in the batch handed to the
verifier.

| id | verdict | corrected severity | evidence/note |
| --- | --- | --- | --- |
| BE-ENGINE-TURNTAKING-01 | adjusted | medium | Mechanism confirmed. `_supersede_heard_prefix` returns when `turn.end_published` is set (`engine.py:1426-1434`). `_cancel_turn` returns False for the same flag (`engine.py:1958-1960`). `accept_segment` never reads `runtime.last_turn` (`engine.py:2069-2088`; `last_turn` appears only at `:627, 1328, 1359, 2713`). `voice_turn_end` is sent once audio is drained, not once it has played (`engine.py:2684-2711`). Flush-ahead lets 3 sentences go at once and up to 8 s of audio ahead of playback (`call_tts_elevenlabs.py:55-57, 160-167`), so every reply has an unprotected tail, and a short reply is unprotected in full. Tests cover only a pre-end supersede (`tests/voice/test_mid_stream_barge_in.py:419-449` holds the audio). Severity lowered: the client sends a barge-in frame (handled through `last_turn` by `_barge_in_target`, `engine.py:1354-1365`) except in these cases: echo cancellation is off, the raw fallback is active (only after a dead-mic liveness failure, `useMicrophoneCapture.ts:415-434`), or speech starts within 3 s of the first playback of the call (`useVoiceCallController.ts:143, 681-685, 705`). `autoBargeIn` is never set to false by any caller. |
| BE-ENGINE-TURNTAKING-02 | confirmed | high | The client ends a segment after a fixed `silenceMsToEnd: 800` (450 only for `strict`). The controller passes `aggressiveness: 'balanced'` (`voiceVadProcessor.worklet.js:225`, `useVoiceCallController.ts:1265`). The server energy gate is off by default and only a digital-silence floor applies (`server_vad.py:31, 238-247`). STT is a single batch POST to Groq (`stt_groq_client.py:91-98`). The merge is gated on `not previous.user_message_persisted` (`engine.py:2075-2079`). `_barge_in_target` takes only a turn that is `published` (`engine.py:1357`). The client sends no VAD frames to the server (`useVoiceCallController.ts:905-910`). |
| BE-ENGINE-TURNTAKING-03 | confirmed | medium | Verified serial steps: the route's workspace, chat and consent reads; then `get_session` (`:2024`), `touch_call` (an UPDATE, `quota.py:327-338`), `find_segment`, `create_segment`, `update_segment(accepted)` (`:2124-2205`), STT, `record_call_usage` plus `get_session` plus `update_session_metadata` under `billing_lock` (`:3389-3455`), `update_segment(completed)` (`:2275-2281`), `get_scoped_session` and `prepare_context` (`callbot_execution.py:183-205`), `find_admission`, and the admit transaction (`conversation_execution.py:110-198`). Correction: the STT debit is not free to drop from the gate. An exhausted debit ends the call (`engine.py:3419-3425`), so it must run beside admission and gate audio, not be skipped. Lever L-04 exists in `roadmap.md:81`. |
| BE-ENGINE-TURNTAKING-04 | adjusted | medium | Confirmed: there is no clause or word-count first chunk (`sentence_buffer.py:66-88, 154-180`, with a 160-character soft cap). The pusher awaits `prepare`, and so moderation, for each sentence in order before `push_text` (`call_tts_elevenlabs.py:228-264`). The call budget is 300 ms and fails closed (`moderation.py:73`; `required` defaults to true, `:461`). `check_ahead` is not built (`engine.py:3309-3311`). Corrections: (a) the 120 ms idle tick only releases a buffer that already ends in sentence punctuation (`take_finished_span`, `sentence_buffer.py:90-111`; `engine.py:2565-2569`), so it does not release partial text. (b) Blocked or unavailable sentences are not silent: the turn sends `moderation_unavailable` once (`engine.py:2400-2414`) and `tts_unavailable` when every sentence was blocked (`:2664-2679`). (c) The 2,003 ms diagnostic came from a preview against a 2 s budget, with the development classifier disabled (`fish18.md:126-130`), not from a call sentence. Verdicts are cached for 24 h per text. |
| BE-ENGINE-TURNTAKING-05 | confirmed | medium | `await previous.finished.wait()` has no timeout (`engine.py:2074`). `finished` is set only in the `finally` block of `accept_segment` (`:2105-2109`), after `_run_voice_turn` has run `_finish_mid_stream_turn` (up to 3 s, `:1493-1505`), `_settled_truncation` (up to 3 s, `:1656`), `_persist_assistant_call_turn` with the asset write (`:2721-2742`), `update_segment` (`:2743-2752`), and, in its own `finally`, the final TTS billing and the spend-task awaits (`:2785-2800`). A fast follow-up after `voice_turn_end` also waits, because `_cancel_turn` is then a no-op while `finished` is still unset. Lever L-11 is in `roadmap.md:81`. |
| BE-ENGINE-TURNTAKING-06 | confirmed | medium | `_VoiceTurn(task=asyncio.current_task())` (`engine.py:2046`). The POST returns only after `_run_voice_turn` (`:2092-2104`), which is paced by the flush-ahead gate (`call_tts_elevenlabs.py:55-59`). The client comment says the POST resolves only after the turn (`useVoiceCallController.ts:619-627`). The resend runs only on a fetch `TypeError` (`:597-608`). A resend hits `find_segment` and returns `duplicate` (`engine.py:2124-2126`). The `finally` then clears `serverTurnActiveRef`/`serverTurnIdRef` and the turn phase while the original turn runs. The 8000-character cap is `MAX_VOICE_ASSISTANT_CHARS` in `transcript_sanitizer.py:12`, not in `call_tts_elevenlabs.py`. |
| BE-ENGINE-TURNTAKING-07 | adjusted | medium | Confirmed on the server: an accepted barge-in cancels the TTS context and the LLM producer at once (`engine.py:1384-1391`, `:1958-1994`; `llm_turn_runner.py:195-198`). There is no pause and resume, and no word-level confirmation. Correction: the claim "no minimum duration" is wrong. During playback the client raises VAD `minSpeechMs` to `BARGE_IN_MIN_SPEECH_MS = 500` (`useVoiceCallController.ts:137, 706`). `speech_start`, which triggers auto barge-in, is posted only after that much voiced audio (`voiceVadProcessor.worklet.js:337-342`), and the 3 s AEC warm-up also applies. Short coughs are filtered. Backchannels or echo of 500 ms or more still cut the reply irreversibly. |
| BE-ENGINE-TURNTAKING-08 | adjusted | low | Confirmed: with no socket, `send_audio_chunk` returns `DROPPED` (`delivery.py:266-267`). The deliver path treats `DROPPED` as delivered: it stores, meters and records the chunk in the ledger, and bills it (`engine.py:2486-2509`). Resume sends only a snapshot (`engine.py:992-1003`). Correction: the flush-ahead gate does not keep advancing on wall clock during the grace period. `played_ms()` uses the latest reported playback when one exists (`call_tts_elevenlabs.py:150-158`), and the client reports every 500 ms while playing (`useVoiceCallController.ts:492-499`). The gate therefore freezes at the last report, and exposure is limited to the 3 free sentences plus up to 8 s or 3 unheard sentences ahead. The wall-clock estimate applies only if no report arrived for that turn. The impact is a few seconds of billed, unheard audio on a network drop, and a full reply only when it is short. |
| BE-ENGINE-TURNTAKING-09 | confirmed | medium | `build_conversation_messages` appends only `completed` rows and uses only `content` (`conversation_execution.py:56-86`). Interrupted or empty assistant rows are dropped, and no truncation flag or marker reaches the model. No "interrupted" annotation exists in `agent_graphs` or `route_chat`. `keep_end` returns the `span_end` of the last sentence whose audio started (`call_ledger.py:380-392`), although per-character start times are parsed (`:277-294`). This is the documented D06 sentence-granular policy, but it still over-approximates what was heard. One cited path is wrong: `/home/andres/PycharmProjects/magic-worlds/src/services/conversation_execution.py` does not exist. The real file is under `magic-worlds-api`. |
| BE-ENGINE-TURNTAKING-12 | confirmed | medium | STT is awaited inside `async with runtime.intake_lock` (`engine.py:2051-2061`, `:2228-2230`). `DEFAULT_VOICE_STT_TIMEOUT_SECONDS = 30.0` (`config.py:47`), and neither `.env.example` nor `docker-compose.yml` overrides it. The Groq client makes one attempt, with no retry or hedge (`stt_groq_client.py:91-108`). `MAX_INFLIGHT_SEGMENTS_PER_CALL = 3` (`engine.py:83`). Note: `runtime.segments` holds running turns until they finish, so the 429 cap counts running turns as well as intake. |
