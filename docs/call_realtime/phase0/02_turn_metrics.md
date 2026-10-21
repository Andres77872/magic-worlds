# Phase 0 · Per-turn record: stages, usage and storage

**Date:** 2026-10-20. **Roadmap items:**
- R01 (per-turn latency and hearing record);
- the BFF side of R04 (LLM request/response timing);
- the STT/TTS/LLM usage units of R06;
- the dimensions of R05.

**Code:**
- `magic-worlds-api/src/services/voice_orchestration/turn_metrics.py` (collector and writer);
- `src/services/llm_exchange_timing.py` (transport stamps);
- `src/database/mysql/voice_metrics_models.py` (store);
- schema revision `2026_10_voice_turn_metrics`.

## 1. Principles

1. **One row per uploaded segment.** A segment is the unit the BFF receives. Rejected, no-speech and superseded segments get a row too, because they cost STT money and shape latency. Rows without a `turn_id` are the segments whose turn never started.
2. **Monotonic server clock.** Every stage is a `time.monotonic()` mark on the call engine's clock (`VoiceCallEngine._clock`). The route's wall-clock receipt (`received_at_ms`) is converted once into that clock. No interval mixes client and server clocks. The client sends intervals only.
3. **First mark wins.** A mark is set once. A retry or a second chunk never moves it.
4. **Never on the path.** The turn mutates an in-memory record. A background task writes the row after the turn, and a write failure is logged, never raised. No awaited write sits between the user's stop and first audio.
5. **No content.** No transcript, reply text, audio, prompt, URL or token. Only ids, counts, durations, categories and model identities.

## 2. Stage marks

The marks are stored in `stages_ms` as milliseconds from `received`. The interval columns are listed in §3.

| Mark | Where it is set | Notes |
|---|---|---|
| `received` | `route_voice_call.upload_voice_segment` (`received_at_ms`) | Before auth and the multipart read |
| `accepted` | `VoiceCallEngine.accept_segment` entry | After the form read and the session lookup |
| `intake_locked` | After `runtime.intake_lock` is acquired | Shows serialized intake behind an earlier segment |
| `validated` | After `validate_voice_segment` | |
| `stt_start` / `stt_end` | Around `stt_client.transcribe_segment` | |
| `turn_start` | `_run_voice_turn` entry | After the supersede wait and text merge |
| `llm_admitted` | `VoiceLlmTurnStarted` received | The BFF catalog read and admission commit are done |
| `llm_dispatch` | `stream_execution`, just before the `POST /v1/chat/completions` | Via `llm_exchange_timing`. The first dispatch wins; `llm_requests` counts all of them |
| `llm_headers` | Response headers received (2xx, `text/event-stream`) | api.magic_llm accepted the request |
| `llm_first_byte` | First SSE bytes | |
| `llm_first_text` | First non-empty `delta.content` parsed in `collect_execution_text` | **TTFT seen by the BFF** |
| `llm_done` | `[DONE]` parsed | |
| `first_delta` | First `VoiceAssistantDelta` in the engine | Includes the runner's queue hop |
| `first_sentence` | First span submitted to the speaker (`speak_later`) | |
| `first_audio` | First non-empty TTS chunk in `deliver` | |
| `first_audio_sent` | `send_audio_chunk` returned for that chunk | Server half of V2V ends here |
| `llm_completed` | `VoiceLlmTurnCompleted` received | Includes the post-stream persistence |
| `audio_final` | `voice_audio_final` sent | |
| `turn_end` | `voice_turn_end` sent | |
| `finalized` | The engine returns from the turn (asset stored, segment updated) | |

## 3. Interval columns

| Column | From → to | What it isolates |
|---|---|---|
| `speech_end_lag_ms` | client: last voiced audio → upload sent (`vad.speech_end_lag_ms`) | Hang-over, hashing, wait for ready |
| `intake_ms` | `received` → `stt_start` | Auth, form read, DB writes, intake serialization, validation |
| `stt_ms` | `stt_start` → `stt_end` | STT round trip |
| `claim_ms` | `stt_end` → `turn_start` | Supersede wait for the previous turn |
| `pre_dispatch_ms` | `turn_start` → `llm_dispatch` | Pending truncation, catalog, BFF admission commit, payload build |
| `llm_ttft_ms` | `llm_dispatch` → `llm_first_text` | api.magic_llm pipeline plus provider TTFT (R04's BFF view) |
| `first_sentence_ms` | `llm_first_text` → `first_sentence` | Sentence buffering of the first unit |
| `tts_first_audio_ms` | `first_sentence` → `first_audio` | Moderation verdict (sentence 1), TTS time to first audio |
| `server_first_audio_ms` | `received` → `first_audio_sent` | **Server half of V2V** |
| `user_stop_first_audio_ms` | `speech_end_lag_ms + server_first_audio_ms` | The D06 number, kept for continuity. It omits upload transit (client→BFF), so it reads low by one uplink |
| `llm_stream_ms` | `llm_dispatch` → `llm_done` | Whole generation |
| `llm_tail_ms` | `llm_done` → `llm_completed` | Post-stream persistence before the turn can finish |
| `turn_ms` | `turn_start` → `turn_end` | |

The true mouth-to-ear number is `client_v2v_ms`, from the client frame ([01](01_protocol_v2.md) §3). The gap `client_v2v_ms − user_stop_first_audio_ms` is upload transit plus downlink and playback start-up, and it is plotted on its own.

## 4. Usage and hearing columns (R06 units)

| Column | Source | Notes |
|---|---|---|
| `stt_provider`, `stt_model` | `SttTranscript` | |
| `stt_audio_ms` | `SttTranscript.duration_ms` | Audio actually sent |
| `stt_billed_ms` | `max(stt_audio_ms, minimum)`, where the minimum is a per-provider billing floor | Groq bills at least 10 s per request (`STT_BILLING_FLOOR_MS`) |
| `llm_requests` | Dispatches seen by the transport | More than 1 means a BFF-level retry |
| `llm_provider_calls` | `usage_details.by_model[].calls` on the final chunk, summed | Provider attempts that reported usage. An attempt that failed before any output reports none, so this undercounts magic-llm retries ([03](03_api_magic_llm_plan.md) P3). Null when `usage_details` was absent |
| `llm_input_tokens`, `llm_output_tokens` | `VoiceLlmTurnCompleted.metadata.usage` | `prompt_tokens` and `completion_tokens` |
| `llm_cached_tokens`, `llm_reasoning_tokens` | `usage_details.by_model[].details.cached_tokens_read` and `.reasoning_tokens`, summed | api.magic_llm already sends these (`usage_details` v1); the BFF used to validate and drop them. A provider that does not report them gives 0, not null ([03](03_api_magic_llm_plan.md) P5) |
| `reply_chars` | Code points of the streamed reply | |
| `tts_sentences`, `tts_chars`, `tts_utf8_bytes` | Ledger entries that were sent to the provider (`status == "flushed"`) | EL bills characters; Fish's admission counts UTF-8 bytes |
| `audio_chunks`, `delivered_audio_ms` | `turn.audio_last_seq`, `ledger.delivered_ms` | |
| `played_ms` | Latest `voice_playback` or barge-in `played_ms` for the turn | Server view |
| `kept_chars`, `truncated`, `barge_in` | Barge-in truncation of the turn | |

Prices are not stored. Cost is computed in queries from these units and a versioned price table, which R06 adds once the owner confirms the lanes' prices (OD2 and OD3 in [17](../17_recommendations_and_roadmap.md) §13). Storing units keeps old rows re-priceable.

## 5. Dimensions (R05)

| Column | Value |
|---|---|
| `engine` | `cascade_v1` (the engine adapter of R76 will add values) |
| `experiment_arm` | Null until X1-X12 run |
| `deploy_env` | `DEPLOY_ENV`, default `dev` |
| `region` | `DEPLOY_REGION`, null when unset |
| `config_fingerprint` | First 16 hex characters of the SHA-256 of the latency-relevant settings: VAD gate, STT model and timeout, TTS lane and output format, LLM output cap, sentence buffer limits, build id (`APP_BUILD`) |
| `call_turn_index` | 1-based segment index in the call. First turns pay cold connections, so they are reported apart |

## 6. Outcome taxonomy

| `outcome` | Meaning |
|---|---|
| `completed` | The reply finished (it may still have been truncated by a later barge-in) |
| `interrupted` | A barge-in stopped the turn, or the LLM stream ended `interrupted` |
| `superseded` | A newer segment replaced this one |
| `cancelled` | The call ended, or the provider cancelled the turn |
| `no_speech` | STT returned nothing usable |
| `rejected` | Server validation refused the segment |
| `failed` | An exception ended the turn. `error_stage` and `error_type` say where and why |

`error_stage` is one of `intake`, `stt`, `admission`, `llm`, `tts`, `delivery` or `finalize`: the last stage the turn reached when it failed. `error_type` is the voice error category, or the exception class name for an unexpected error.

## 7. Write policy

- **During the turn:** the record lives on the call runtime (`_VoiceCallRuntime.turn_metrics`, by segment seq) with a `turn_id → seq` index.
- **Server part final:** set when `accept_segment` returns or raises, in its `finally` block.
- **Client part:** set when `voice_turn_client_metrics` arrives, or marked "not expected" when the client did not advertise the frame or the turn never published.
- **Flush:** the row is inserted once both parts are final, or 15 s after the server part became final, or when the call ends. A client frame that arrives after the flush updates only the `client_*` columns.
- **Call row:** `voice_call_metrics` is upserted when the call ends: in `end_call` and in the call's `_forget_call`.
- **Writer:** a background task with strong references, the same way the engine's spend tasks work. `shutdown()` drains it within the engine's drain budget.

## 8. Schema

Both tables cascade from `voice_session`, so the account and chat deletion paths remove them with the call.

```sql
create table voice_turn_metrics (… see db.sql …)
create table voice_call_metrics (… see db.sql …)
```

The exact DDL is in `magic-worlds-api/src/database/mysql/db.sql`. It is applied by `scripts/migrations/20261020_voice_turn_metrics.py`:
- a read-only check by default;
- `--apply --backup <private.sql.gz>` adds the two tables;
- existing rows are not touched.

## 9. Queries for the first dashboards

```sql
-- V2V by day and lane (client clock), completed or interrupted turns that played.
SELECT DATE(created_at) AS day, tts_provider,
       COUNT(*) AS turns,
       SUM(client_v2v_ms IS NOT NULL) / COUNT(*) AS client_coverage
FROM voice_turn_metrics
WHERE turn_id IS NOT NULL AND outcome IN ('completed', 'interrupted')
GROUP BY day, tts_provider;

-- Where the time goes (server), last 7 days. Percentiles via window functions.
WITH t AS (
  SELECT intake_ms, stt_ms, claim_ms, pre_dispatch_ms, llm_ttft_ms,
         first_sentence_ms, tts_first_audio_ms, server_first_audio_ms,
         PERCENT_RANK() OVER (ORDER BY server_first_audio_ms) AS pr
  FROM voice_turn_metrics
  WHERE created_at >= NOW() - INTERVAL 7 DAY AND server_first_audio_ms IS NOT NULL)
SELECT MIN(CASE WHEN pr >= 0.5 THEN server_first_audio_ms END) AS p50,
       MIN(CASE WHEN pr >= 0.95 THEN server_first_audio_ms END) AS p95,
       AVG(intake_ms), AVG(stt_ms), AVG(claim_ms), AVG(pre_dispatch_ms),
       AVG(llm_ttft_ms), AVG(first_sentence_ms), AVG(tts_first_audio_ms)
FROM t;

-- Heard ratio and unheard TTS characters per lane.
SELECT tts_provider,
       SUM(LEAST(COALESCE(client_played_ms, played_ms, delivered_audio_ms), delivered_audio_ms))
         / NULLIF(SUM(delivered_audio_ms), 0) AS heard_ratio,
       SUM(tts_chars) AS tts_chars
FROM voice_turn_metrics WHERE turn_id IS NOT NULL GROUP BY tts_provider;

-- STT spend units: billed vs sent seconds (the 10 s floor effect).
SELECT stt_provider, SUM(stt_audio_ms) / 1000 AS sent_s, SUM(stt_billed_ms) / 1000 AS billed_s
FROM voice_turn_metrics WHERE stt_ms IS NOT NULL GROUP BY stt_provider;
```

## 10. Gate G0

Phase 0 exits when, for two weeks:
- `client_coverage` is at least 0.9 of the completed and interrupted turns;
- every segment has a row;
- `llm_ttft_ms` is non-null on every executed turn.

The SPA's share of `client_outcome IS NULL` explains any shortfall: old builds, closed sockets, and turns that ended with the call.
