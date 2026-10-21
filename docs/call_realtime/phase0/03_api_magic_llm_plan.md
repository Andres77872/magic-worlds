# Phase 0 · api.magic_llm: request/response measurement plan

**Date:** 2026-10-20. **Status:** plan only. Nothing in `api.magic_llm`, `magic-agents` or `magic-llm` was changed for Phase 0.

**Roadmap items:**
- R04 (TTFT and the api.magic_llm stage split);
- the api.magic_llm parts of R09 (connections and auth);
- R18 (bounded waits);
- R38 (voice fast lane);
- R67 (tracing).

Each item is in [17](../17_recommendations_and_roadmap.md).

## 1. What the BFF measures today, and what it cannot

Phase 0 times the exchange from the BFF side (`magic-worlds-api/src/services/llm_exchange_timing.py`, rows in [02](02_turn_metrics.md)).

| Seen by the BFF (shipped) | Mark or column |
|---|---|
| Request sent | `llm_dispatch` |
| Response headers (2xx, `text/event-stream`) | `llm_headers` |
| First SSE bytes | `llm_first_byte` |
| First non-empty `delta.content` | `llm_first_text` → `llm_ttft_ms` |
| `[DONE]` | `llm_done` → `llm_stream_ms` |
| BFF-level retries | `llm_requests` |
| A per-turn client was created (cold pool) | logged as `owned_client`; the R09 baseline |
| `usage.prompt_tokens`, `usage.completion_tokens` | `llm_input_tokens`, `llm_output_tokens` |
| `usage_details.by_model[].calls` | `llm_provider_calls` |
| `usage_details.by_model[].details.cached_tokens_read` and `.reasoning_tokens` | `llm_cached_tokens`, `llm_reasoning_tokens` |

`usage_details` v1 was already on the final stream chunk (`api.magic_llm/src/routes/completions.py:776`, built by `src/util/usage_extractor.py:331-421`). The BFF checked that it was an object and then dropped it. Phase 0 reads it, with no api.magic_llm change.

What `llm_ttft_ms` cannot separate, because only api.magic_llm knows it:

1. **Its own pre-provider time:** auth (it re-authenticates every request, 41-82 ms in dev), admission, catalog, graph build, and the durable commits before the provider request. The audit measured about 20-32 commits per voice turn, p50 about 0.87 s before the provider request (C08).
2. **The provider's own TTFT** and which attempt produced it.
3. **Retries inside magic-llm.** The default is 3 attempts (`magic-llm/magic_llm/engine/base_chat.py:64`), about 92 s of silence in the worst case (K05). An attempt that failed before any output reports no usage, so `llm_provider_calls` undercounts them.
4. **Whether each upstream connection was reused.**
5. **The provider's real stop reason.** api.magic_llm reports `stop` for every non-error end (`completions.py:769`), so a `length` cut is invisible.

## 2. Compatibility rules (read before any change)

The BFF parses api.magic_llm responses strictly. A field added in the wrong place fails every call with `LLM_EXECUTION_RESULT_INVALID` or `LLM_EXECUTION_STREAM_INVALID`.

| BFF check | Where | Consequence |
|---|---|---|
| `usage` must have exactly `prompt_tokens`, `completion_tokens`, `total_tokens`, and the total must add up | `magic-worlds-api/src/services/llm_completion_metadata.py:18-27` | **Never add keys to `usage`**, not even `prompt_tokens_details`. Details go in `usage_details` |
| Non-stream bodies may only have `id, object, created, model, choices, usage, usage_details, source` | `llm_completion_metadata.py:6`; `llm_execution_text.py:37`; `llm_execution_tools.py:57` | A new top-level key on a non-stream body is rejected. The BFF must allow it first (B1) |
| `finish_reason` must be `stop` (text) | `llm_execution_text.py` (stream and non-stream) | **Do not change `finish_reason`.** Report the provider's reason beside it (P5) |
| Stream chunks: `object == chat.completion.chunk`, `model == inline-agt`, one choice | `llm_execution_text.py` | Unknown top-level keys on a chunk are ignored today |
| Response headers | `llm_execution_transport.py` | Unknown headers are ignored |

**Rollout order:**
1. The BFF learns to read and allow the new field (B1).
2. api.magic_llm sends it.
3. The BFF adds columns once values flow.

The same order R02 uses for the socket.

## 3. Proposed wire contract

### 3.1 `Server-Timing` response header (pre-stream stages)

The response headers leave before the provider is called, so a header can carry the stages that end before the stream starts:

```
Server-Timing: auth;dur=58, admit;dur=91, prep;dur=214
```

| Metric | From → to |
|---|---|
| `auth` | Request received → caller authenticated |
| `admit` | → execution admitted (quota, idempotency, catalog) |
| `prep` | → graph built and the execution row committed; the stream starts |

The BFF already marks `llm_headers`, so `llm_dispatch → llm_headers` minus these three is network plus queueing. The header is standard (W3C), costs nothing to ignore, and needs no BFF change to ship.

### 3.2 `diagnostics` object on the final chunk (provider stages)

This is a sibling of `usage_details` on the final stream chunk, and on non-stream bodies after B1:

```json
"diagnostics": {
  "schema_version": "v1",
  "stages_ms": {
    "received_to_provider_request": 640,
    "provider_request_to_first_byte": 410,
    "provider_first_token": 455,
    "provider_stream": 1320,
    "post_stream": 1850
  },
  "commits": {"before_provider": 21, "total": 32},
  "attempts": [
    {"provider": "openrouter", "model": "…", "outcome": "error", "error_category": "timeout",
     "wait_ms": 30000, "conn_reused": false},
    {"provider": "openrouter", "model": "…", "outcome": "ok", "conn_reused": true,
     "provider_finish_reason": "stop"}
  ],
  "provider_finish_reason": "stop",
  "fast_lane": false
}
```

The rules:
- every field is optional;
- durations are whole milliseconds on api.magic_llm's monotonic clock;
- no content, keys, URLs or prompts.

`post_stream` is reported on the stored execution, not on the chunk, because the chunk leaves before it ends.

## 4. Plan items

| # | Item | api.magic_llm change | Evidence | BFF consumer | Done when |
|---|---|---|---|---|---|
| **B1** | Accept `diagnostics` (BFF, first) | None | §2 | Add `diagnostics` to `COMPLETION_FIELDS`. Read it leniently next to `note_llm_usage_details` (`llm_execution_text.py`). Unknown shapes are skipped | BFF tests: a body with `diagnostics` passes, a malformed one is ignored |
| **P1** | `Server-Timing` with `auth`, `admit`, `prep` | Build it in `create_chat_session` (`src/routes/completions.py:1324`) from monotonic marks; add it to the `StreamingResponse` headers | §1 item 1 | Parse it leniently in `stream_execution` after the content-type check; new columns `mllm_auth_ms`, `mllm_admit_ms`, `mllm_prep_ms` in a later revision | Present on 100% of executions; `auth + admit + prep ≤ llm_dispatch → llm_headers` |
| **P2** | Populate `time_first_token_ms` | Set it from the first provider content token (`src/models/chat.py:61`; written by `src/db/messages.py:1693`, `:2032`). It read 0.0 in all 19 dev runs | R04, C07 | None (api.magic_llm's own dashboards). The BFF's `llm_ttft_ms` minus this is overhead | Non-zero on 100% of completed executions |
| **P3** | Real attempt count and retry waits | Count every magic-llm attempt, including pre-output failures, through the retry callback or a wrapper around `RetryConfig` (`magic-llm/magic_llm/engine/base_chat.py:64-72`); report `diagnostics.attempts` | K05; `usage_details` counts only attempts with usage | `llm_attempts`, `llm_retry_wait_ms`; R18 sets its deadlines from them | Attempts on 100% of executions; equal to `llm_provider_calls` whenever no attempt failed |
| **P4** | `conn_reused` per stage | Once R09 gives shared sessions, report reuse for auth and for each provider attempt (aiohttp `TraceConfig.on_connection_reuseconn`). The per-call sessions with `use_dns_cache=False` make it always false today | C09; R09 | `llm_conn_reused`; the R09 gate (≥ 95% after turn 1) | Reported on 100% of attempts |
| **P5** | Provider stop reason | Keep `finish_reason` as is. Add `diagnostics.provider_finish_reason` (`stop`, `length`, `content_filter`, …) from the provider's last chunk | R04; §2 | `llm_finish_reason`; turns cut by `length` become visible | Present on 100% of completed executions |
| **P6** | Commits per turn | Count durable commits before the provider request and in total (`src/db/native_execution.py:313-353` rewrites 48-123 KB per commit) | C08: about 20-32 commits per voice turn | `mllm_commits_before_provider`; the R38 baseline | Reported on 100% of executions |
| **P7** | Unknown vs zero in `usage_details` | `details` fields default to 0 when a provider does not report them (`usage_extractor.py:110-112`). Add `details.reported: [...]` listing the fields the provider actually sent, or send null | R10 needs "0 reasoning tokens" to mean 0 | Store null when not reported | R10's assertion (reasoning = 0) can be trusted |
| **P8** | Keep `SSE_BUFFER_INTERVAL_MS` at 0 for voice | Default is 0 (`src/util/const.py:264`). Above 0, every token waits up to that interval (`completions.py:1289`, `:1637`, `:1777`). Exempt voice executions explicitly, or refuse a non-zero value at startup | §3 of [07](../07_llm_in_the_voice_loop.md) | `llm_first_byte → llm_first_text` shows it | A deployment check fails on a non-zero value |
| **P9** | Keep-alive vs read timeout | The 10 s agent keep-alive (`AGENT_KEEPALIVE_SECONDS`, `completions.py:80`) stops the BFF's 60 s read timeout from ever firing. Send keep-alives as SSE comments the BFF can tell apart, and stop them after a provider deadline | R18 | R18's TTFT watchdog uses `llm_dispatch` and `llm_first_text`, not the socket timeout | A stalled provider ends the turn at the R18 deadline |
| **P10** | Auth cache | Cache validated tokens for their remaining lifetime (41-82 ms per request in dev) | R09 | `mllm_auth_ms` (P1) falls | `auth` p50 < 5 ms after the first request of a call |
| **P11** | Trace context | Extract `traceparent` from the BFF's `execution_headers` (`magic-worlds-api/src/services/llm_execution_transport.py:82-95`) and propagate it to magic-llm spans | R67 | The BFF sends `traceparent` once R67 starts | ≥ 99% of turns traced end to end |
| **P12** | Voice fast lane (R38, option A) | An ephemeral execution mode: no durable per-node checkpoint before the provider request; events appended after the stream; the post-stream tail kept off the next turn | C08; LAT-06 −600 to −800 ms p50 | `diagnostics.fast_lane`; X-experiments compare arms on `llm_ttft_ms` | `commits.before_provider` ≈ 0; `received_to_provider_request` within the measured admission range (65-137 ms) |

**BFF-side items that touch this exchange but need no api.magic_llm change:**
- **R09, BFF half:** one process-wide `httpx.AsyncClient` for api.magic_llm with `keepalive_expiry` ≥ 120 s. `_client(config)` creates one per turn today, which is what `owned_client` records.
- **R18, BFF half:** the TTFT watchdog and total deadline, set from the Phase 0 distribution of `llm_ttft_ms`.

## 5. Order

1. **Now (Phase 0, shipped):** the BFF view in §1, including `usage_details`.
2. **B1, then P1, P2, P5 and P6.** Small, read-only diagnostics. They give R04's split and the R38 baseline.
3. **P3 and P9 with R18.** The attempt count and keep-alive behaviour decide the deadlines.
4. **P4 and P10 with R09.**
5. **P7 before R10's assertion** is used as a gate.
6. **P12 (R38) after two weeks of P1 and P6 data**, gated on R57 (see risk 5 in [17](../17_recommendations_and_roadmap.md) §12).
7. **P11 with R67.**

## 6. Questions for the api.magic_llm owners

1. Can the execution row commit be deferred until after the provider request for executions marked ephemeral (P12)? What must stay durable for idempotency?
2. Is `time_first_token_ms` meant to be per execution or per provider attempt (P2)?
3. Should `diagnostics` also go in the stored execution record (for `post_stream`), and where?
4. Who owns the magic-llm retry policy for the voice lane: the graph's client node, or a request-level override (P3)?
