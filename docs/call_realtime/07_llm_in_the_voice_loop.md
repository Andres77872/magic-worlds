# The LLM in the voice loop

**Research date:** 2026-10-20. **Scope:** the language-model stage of the Magic Worlds live call: everything between an accepted STT transcript and the first speakable sentence handed to TTS. It also covers what the model is told, what it may say, how it is stopped on barge-in, and what it remembers of interrupted turns. Four codebases take part: the BFF (`magic-worlds-api`), the agents API (`api.magic_llm`), the graph runtime (`magic-agents`) and the provider client (`magic-llm`). STT, TTS, turn-taking and safety have their own documents and appear here only where they meet the LLM. The lens is the cascaded pipeline. Speech-to-speech is in [11_speech_to_speech_and_omni_models.md](11_speech_to_speech_and_omni_models.md).

## Summary

- **Most of the time in the LLM hop is not spent in the model, and the hop is the largest latency we can control.**
  - Before calling the provider, api.magic_llm commits about 20 fsync'd durable events: run start to `llm_start` takes p50 874 ms (range 747-1,311) in dev.
  - After the stream it commits 12 more, taking 1.0-2.5 s.
  - The Claude Haiku provider window carries a fixed cost of about 1.85 s, which includes a cold TLS connect on most turns.
  - TTFT has never been measured. One tiny-prompt probe took 1,579 ms to first text.
  - Sources: C08 (BE-LLM-02), GAP-TOPOLOGY-RTT-MEASUREMENTS-04, GAP-REAL-DEV-CALL-FORENSICS-04 and -07.
- **The model is probably thinking before it speaks (INFERENCE).**
  - Dev Haiku turns imply about 1.4-1.85 s to the first token, connect included.
  - A public multi-turn benchmark measured Haiku 5.5 with thinking disabled at 556 / 819 ms p50 / p95.
  - Only `reasoning_effort: 'none'` switches thinking off on OpenRouter. The callbot contract does not require it, and the published profile's value is UNKNOWN (C37 (BE-LLM-10)).
- **There is no voice-grade control loop.**
  - No TTFT deadline, hedge, fallback or filler exists.
  - magic-llm silently retries a failure before any output, up to 3 attempts in total, so the worst case is about 92 s of silence (C07 (BE-LLM-05)).
  - The output cap is 1,536 tokens. Replies run p50 289 characters, about 17.6 s of audio, and 12 of 17 were interrupted.
- **The spoken-text contract fails turns instead of repairing them.**
  - Leading or trailing whitespace fails the live turn, yet the row is stored as completed (C10 (BE-LLM-01)).
  - Tag-like markup such as `<think>` or `<b>` also kills the turn (C38 (BE-LLM-13)).
  - Asterisk stage directions crash the Fish word ledger. This hit 2 of 15 dev Haiku replies.
  - The failed, unheard reply then enters history (GAP-REAL-DEV-CALL-FORENSICS-01, -02).
- **The prompt gets the basics right, but its markup is wrong and it cannot see interruptions.**
  - `callbot_chat.v2` already asks for spoken plain text, 1-3 sentences, normalization and tolerance of STT errors.
  - Its optional interjection syntax, `(laughs)` and `<#0.5#>`, dates from the MiniMax era. It is off by default and forced off for Fish.
  - History has no per-message interruption marker, and the call language is not pinned.
- **Target (estimate).** The LLM stage runs from an accepted transcript to the first sentence ready. It can fall from about 2.5-3.3 s in dev (INFERENCE) to about 0.8-1.0 s p50, which saves about 1.5-2.3 s per turn. That needs a voice fast path, warm pooled connections, thinking off and a cache-stable prompt.
- **Plan (§5).**
  - **P0:** measure the stage, repair rather than fail the output contract, turn thinking off, shorten replies and add a backstop cap, keep connections warm, add deadlines and a bounded retry.
  - **P1:** the fast path, a cache-stable layout, a model and host bake-off, hedge plus fallback, interruption-aware history, prompt v3, moderation off the first-sentence path, and policy-tier routing for 18+.
  - **P2:** speculative LLM start, a rolling summary, and a talker/reasoner split.
  - **P3:** filler A/B tests and a watch list.

---

## 1. What the LLM stage has to deliver

In a cascaded pipeline the LLM sets time to first audio through its time to the **first speakable unit**, not through total generation time ([r05 §1.2](evidence/research/r05-llm-for-voice.md)):

```
T_first_unit = network + queue + prefill(uncached prompt tokens)
             + hidden_reasoning_tokens / OTPS
             + tokens_in_first_clause / OTPS
```

Published 2026 budgets give the LLM roughly 30-45% of a sub-1.5 s voice-to-voice target:

| Source (date) | End-to-end target | LLM share |
|---|---|---|
| [ElevenLabs latency guide](https://elevenlabs.io/blog/voice-agent-latency-optimization) (Jun 23 2026, updated Oct 9 2026) (vendor-reported) | ~680 ms P50 / ~1,560 ms P95 to first audio | TTFT 250 ms P50 / 600 ms P95 |
| [Daily, PhoneLLM Alpha 1](https://www.daily.co/blog/announcing-pipecat-phonellm-alpha-1/) (Aug 27 2026) (vendor-reported) | ~1,500 ms P95 voice-to-voice | TTFT 650 ms |
| [Voice AI & Voice Agents primer](https://voiceaiandvoiceagents.com/) (updated Jun 2026) | ~1,500 ms | TTFT ≤ 600 ms; reasoning models: first non-thinking token < ~700 ms |
| [Inworld](https://inworld.ai/resources/fastest-llm-inference-api) (May 28 2026) (vendor-reported) | ~1 s | TTFT < ~600 ms |

Three consequences matter for Magic Worlds:

- **Hidden reasoning counts as TTFT.** At 125 tok/s, 300 hidden reasoning tokens cost 2.4 s, which is more than the whole budget (r05 §1.2).
- **Output speed matters only for the first clause.** That clause is a few dozen tokens. Total reply length matters for cost, overlap and barge-in, not for first audio.
- **Prefill matters only when uncached.** Dev callbot prompts are about 1.7-1.9k tokens, and about 1.7-1.87k of them are cached after the first turn (GAP-REAL-DEV-CALL-FORENSICS §4.1). Prefill is therefore small today. It grows with lorebooks, codex cards and long histories.

Magic Worlds' reconciled time from speech end to first audio is about 3.2-4.2 s at STT p50 on the ElevenLabs lane with moderation off. Hang-over, STT and the LLM hop make up about 80% of it ([reconciliation §7](evidence/audit/gap-finding-reconciliation.md); [02_turn_lifecycle_and_latency.md](02_turn_lifecycle_and_latency.md)). Of the three, the LLM hop is the biggest share and the most fixable.

---

## 2. Anatomy of the LLM stage today

Path convention for short file names in this section:

| File type | Location |
|---|---|
| Voice-orchestration files (`engine.py`, `llm_turn_runner.py`, `callbot_execution.py`, `transcript_sanitizer.py`, `sentence_buffer.py`) | `magic-worlds-api/src/services/voice_orchestration/` |
| Other BFF services | `magic-worlds-api/src/services/` |
| `route_chat.py` and `route_voice_call.py` | `magic-worlds-api/src/routes/user/` |
| `completions.py` | `api.magic_llm/src/routes/` |

### 2.1 One turn, end to end

```mermaid
sequenceDiagram
    autonumber
    participant ENG as BFF engine
    participant RUN as Runner and executor
    participant DB as BFF MySQL
    participant ML as api.magic_llm
    participant AUTH as api.auth
    participant MDB as api.magic_llm MySQL
    participant LLM as magic-llm client
    participant P as OpenRouter and model
    ENG->>RUN: stream_turn with transcript
    RUN->>DB: find_admission, prepare_context, admit (about 25-30 SQL, one txn)
    RUN->>ENG: turn_started (lock-step, spend check, 2 WS sends, start_speaker)
    RUN->>DB: started txn
    RUN->>ML: POST /v1/chat/completions on a new httpx client
    ML->>AUTH: validate_api_key then validate (2 sequential calls, no cache)
    ML->>MDB: interaction admission (2 txns)
    ML->>MDB: about 19-20 durable commits, checkpoint rewrites (p50 about 0.87 s)
    ML->>LLM: NodeLLM core_stream
    LLM->>P: new session, new TCPConnector, DNS, TCP, TLS
    P-->>LLM: first token after TTFT (never measured)
    LLM-->>ML: delta.content
    ML-->>RUN: SSE chunk (reasoning dropped)
    RUN-->>ENG: delta, lock-step hand-off
    ENG->>ENG: WS assistant_delta, SentenceBuffer, moderation, TTS
    P-->>LLM: last token
    ML->>MDB: 12 more commits (1.0-2.5 s)
    ML-->>RUN: final chunk, finish_reason always stop, then DONE
    RUN->>RUN: compare stored text with collected text exactly
    RUN->>DB: persist reply
```

Sources: [be-llm §3](evidence/audit/be-llm.md), [gap-topology-rtt-measurements](evidence/audit/gap-topology-rtt-measurements.md) and [gap-real-dev-call-forensics](evidence/audit/gap-real-dev-call-forensics.md).

### 2.2 Stage timings

| Stage | Dev measurement or estimate | Label | Source |
|---|---|---|---|
| BFF from segment row to api.magic_llm admitted, minus STT (intake bookkeeping, STT billing, `prepare_context`, admission txn, dispatch) | 208-400 ms (15 non-superseded turns) | FACT (dev DB, second-resolution bounds) | forensics §4.1 |
| of which the BFF serialized DB tax | about 60-100 ms p50; admission txn about 15-25 ms p50 | INFERENCE on measured unit costs | GAP-TOPOLOGY-RTT-MEASUREMENTS-03 |
| api.magic_llm admitted → interaction started | 65-137 ms | FACT | forensics §4.1 |
| api.magic_llm run start → `llm_start` commit (19 commits; `llm_start` is revision 20) | p50 874 ms (747-1,311); about 39-69 ms per commit | FACT (dev) | GAP-TOPOLOGY-RTT-MEASUREMENTS-04 (raised to critical by its verifier) |
| api.magic_llm admitted → `llm_start` | n=19: p50 898, p90 1,034, max 1,233 ms | FACT (dev) | GAP-REAL-DEV-CALL-FORENSICS-04 |
| Provider window `llm_start` → `llm_end`, Haiku | n=15: min 1,649, p50 2,389, max 3,706 ms; regression intercept about 1,850 ms at about 239 tok/s | FACT (dev) | forensics §4.1 |
| Provider window, Sonnet | n=4: 2,398-3,885 ms; intercept about 1,482 ms at about 98 tok/s | FACT (dev) | forensics §4.1 |
| Cold connect to OpenRouter | +86 ms p50 (re-measured +95 ms); TCP+TLS above 500 ms in 13/80 samples | MEASURED (dev network) | GAP-TOPOLOGY-RTT-MEASUREMENTS-02 |
| Connect + TTFT, Haiku | about 1.4-1.85 s | INFERENCE (fastest turn: 1,649 ms window − 52 tokens / 239 tok/s ≈ 1.43 s) | derived from forensics §4 |
| First sentence formed | 200-600 ms | INFERENCE | reconciliation §7 stage 10 |
| Post-stream tail in api.magic_llm | 1,008-2,528 ms, p50 1,797 ms | FACT (dev) | forensics §4.1 |
| Tiny-prompt probe, dispatch → first text (no BFF admission) | 1,578.8 ms first text; 4,480 ms total for 107 characters | FACT (one sample) | [be-llm §9](evidence/audit/be-llm.md) |

**What the two views say.**

- The reconciled budget uses the probe, about 1,579 ms, for dispatch through provider TTFT (stage 9). It adds 30-150 ms of BFF prep and 200-600 ms for the first sentence, giving about 1.8-2.3 s from transcript to first sentence.
- Dev call rows include real history and real admission, and they point higher. Adding BFF 0.2-0.4 s, pre-provider about 0.9 s, connect plus TTFT about 1.4-1.85 s and first sentence about 0.1-0.3 s gives **about 2.5-3.3 s (INFERENCE)**.
- The higher figure puts real turns at or above the top of the reconciled 3.2-4.2 s end-to-end range. That is consistent with the documented ~5.5 s sample and with the forensics' own composition of 4.4-5.4 s.
- Neither figure is a TTFT measurement (C13; GAP-REAL-DEV-CALL-FORENSICS-07, -12).

### 2.3 BFF admission and dispatch

**FACT** ([be-llm §3.1-3.6](evidence/audit/be-llm.md)):

- **Admission.** The engine calls `VoiceLlmTurnRunner.stream_turn`, which runs `CallbotExecutionService.execute`. That calls `execute_conversation_turn` with `feature='callbot'`.
  - Admission is one BFF transaction of roughly 25-30 SQL statements. It includes `SELECT … FOR UPDATE` on the session and on the newest 100 messages.
  - It writes an execution plan whose `frozen_payload` holds the whole graph and the full message list.
- **Lock-step start.** Before the HTTP POST, `on_start` publishes `turn_started` in lock-step.
  - The engine first awaits the spend check, two WebSocket sends and `start_speaker`.
  - Only then does a separate `started` transaction run (`llm_workflow_execution.py:92-101`).
  - This is serial but small: 1-15 ms (INFERENCE). C19 (BE-LLM-06) covers the whole chain.
- **New client per turn.** The executor is built without a shared client (`magic-worlds-api/src/services/voice_orchestration/engine.py:3793-3795`), so every turn opens a new `httpx.AsyncClient`.
  - In dev the BFF → api.magic_llm hop is plaintext localhost, so the handshake cost is negligible there.
  - The 5 s uvicorn keep-alive on every service would defeat pooling anyway (C09 (BE-LLM-03); GAP-TOPOLOGY-RTT-MEASUREMENTS-07).
- **Per-delta lock-step.** Every delta crosses a `Queue(maxsize=1)` hand-off. The engine awaits the WebSocket `assistant_delta` send before the text reaches the sentence buffer (C75 (BE-LLM-20), low).

### 2.4 api.magic_llm: the durable pipeline

The inline-graph path runs every step below on every voice turn (FACT, [be-llm §3.7](evidence/audit/be-llm.md); C08 (BE-LLM-02 + BE-LLM-21)):

1. **Delegated auth.** `validate_api_key` then `validate` are two sequential api.auth HTTP calls, with no cache (8-10 ms floor each in dev). A synchronous pymysql shadow-user lookup then runs on the event loop (BE-LLM-19).
2. **Interaction admission.** It fingerprints the whole request, runs `find_admission` and `admit` as two transactions, and validates the graph document. This duplicates the BFF's own admission.
3. **Runtime config.** It captures a deep-copied snapshot, including history, and builds a new native store. It runs `SELECT @@max_allowed_packet` on every request.
4. **Durable recording.** `recorder.record` writes graph start, then node start, output and end for each node, then each edge delivery, then `effect_prepared` and `llm_start`.
   - Each commit re-reads the snapshot and checkpoint, appends the event and **rewrites the full checkpoint** (48-123 KB).
   - The binlog is ROW/FULL, about 3-8 MB per turn (GAP-TOPOLOGY-RTT-MEASUREMENTS-04).
5. **After the stream.** One `llm_response` record holds every chunk, followed by node end, the end node and graph end: 12 more commits before `[DONE]`.

The callbot graph has five nodes and no tools. Durability buys replay and audit for a single-node chat completion whose result the BFF persists anyway. On the voice path that costs about 0.9 s p50 before the first provider byte. This is the largest controllable stage between speech end and first audio: it exceeds STT p50 (GAP-TOPOLOGY-RTT-MEASUREMENTS-04).

**The response is not buffered (FACT, checked in code on 2026-10-20).** The inline `agt` path returns `StreamingResponse(openai_agent_sse_adapter(...))` with `X-Accel-Buffering: no` and **without** `sse_buffer_wrapper` (`api.magic_llm/src/routes/completions.py:1056-1063`). The dev `SSE_BUFFER_INTERVAL_MS=300` applies only to the other completion paths (`completions.py:1289-1290`, `1637-1638`), so callbot deltas are not delayed by it.

### 2.5 magic-agents and magic-llm: connections, retries, output cap

| Topic | Current behaviour (FACT) | Consequence |
|---|---|---|
| Provider transport | Every provider call opens a new HTTP session: the default `AsyncHttpClient` is entered per request (`magic-llm/magic_llm/engine/openai_adapters/openai_base.py:65`), and the private variant also builds a new `TCPConnector` with `use_dns_cache=False`. **Path note (re-checked in code 2026-10-20):** the verifier attributes the callbot client to `private_transport=True` at `api.magic_llm/src/services/llm_execution.py:285-287`, but that factory is reached only through `dependencies()`, which only the recovery path calls (`api.magic_llm/src/util/inline_execution_recovery.py:266`). On the live path the BFF renders the client node itself, with no `private_transport` and no `retries` (`magic-worlds-api/src/services/llm_execution_transport.py:146-175`). The per-call connect holds on either path | DNS + TCP + TLS on every turn. +86-95 ms p50, with 0.5-1.5 s tails on about 16% of dev samples (C09 (BE-LLM-03); GAP-TOPOLOGY-RTT-MEASUREMENTS-02). Provider edges keep idle connections for ≥125 s, so the cost is entirely client-side |
| OpenRouter usage poll | Never delays first text: the poll (`magic-llm/magic_llm/engine/engine_openai.py:283-291`) runs only after the stream, and no voice run recorded a poll result (19/19 record `usage_source=provider` with `provider_extra=null`, where a successful poll would stamp `id_generation`). On the live path the BFF-rendered `openrouter.ai` base URL selects `ProviderOpenRouter` by hostname (`engine_openai.py:39`; path note above), so whether a poll runs and fails after the stream is UNKNOWN (C39, info) | C39 (BE-LLM-04) does not apply to calls. The forensics note's subtraction of a usage poll from the provider window is withdrawn |
| Retries | `controlled_stream` makes up to 3 attempts at a failure that occurs before any output, 1 s apart (`magic-llm/magic_llm/engine/attempt_control.py:278-326`; `RetryConfig` at `base_chat.py:29-31`, default `retries=3` at `base_chat.py:64` and `:72`). Platform rendering never sets `retries` (`llm_execution_transport.py:163-169`). Only BYOK request credentials (`api.magic_llm/src/util/request_credentials.py:117`) and the recovery factory (`llm_execution.py:287`) pin `retries=1`, and the callbot uses neither | A 30 s `sock_read` stall, a 5xx, a 408 or a 429 is retried blindly. Worst case about 3 × 30 + 2 ≈ 92 s of silence (C07; reconciliation K05) |
| Deadlines | Provider `sock_read` = role timeout (30 s). The BFF read timeout is 60 s, but 10 s `: keepalive` comments keep resetting it. The 120 s httpx "total" is not a total. The graph timeout is an input-wait budget | No TTFT or total deadline anywhere. `llm_timeout` is unreachable because no transport code contains `TIMEOUT` (`callbot_execution.py:253`) |
| Output cap | `max_output_tokens=1_536` (`magic-worlds-api/src/services/llm_features.py:67`); input 32,768; messages 80; timeout 30 s | Never binding: the dev max was 274 completion tokens. About 4× the roadmap's 300-400 (K06; C37) |
| `finish_reason` | api.magic_llm emits `stop` unless an error or tool call occurred (`completions.py:766-772`) | A `length` truncation looks like a complete reply (BE-LLM-17) |
| Reasoning stream | Only `delta.content` is forwarded; `reasoning_content` is dropped (`completions.py:745-751`) | Hidden thinking shows up only as silence before the first delta |

### 2.6 Model, reasoning and profile

- **Profile resolution (FACT).** `callbot` is a system-only feature: no user selection, no BYOK, `platform_credit_billed=False`. Resolution uses the `system_feature` profile, then `system_default` (`llm_profile_resolution.py:56-73`).
- **What the contract checks (FACT).** It requires only the `chat` and `streaming` capabilities. `reasoning_effort` is checked only to confirm the model supports it.
- **How thinking is switched off (FACT).** Only `'none'` becomes OpenRouter's `reasoning: {enabled: false}` (`magic-worlds-api/src/services/llm_execution_transport.py:198-205`). Any other value, including an unset one, leaves the provider default in place.
- **Models seen in dev (FACT).** Dev calls used Claude Haiku (15 turns) and Sonnet (4 turns). The versions were not recorded (UNKNOWN). Production's model, effort and route are UNKNOWN.
- **Why thinking is the likely culprit (INFERENCE, medium confidence).**
  - Claude Haiku 5.5 has thinking **on by default** (adaptive, effort `medium`). It can be disabled at effort ≤ high ([Anthropic models overview](https://platform.claude.com/docs/en/about-claude/models/overview), accessed 2026-10-20). Whether dev ran Haiku 5.5 is UNKNOWN.
  - Dev Haiku turns take about 1.4-1.85 s to the first token with connect included. Haiku 5.5 with thinking off measured 556 / 819 ms on aiewf's 12k-token multi-turn workload ([r94 §3.4](evidence/research/r94-gap-g4-contradictions-reconcile.md)). Our prompt is smaller and mostly cached, so the gap should go the other way.
  - The likeliest explanation is a profile without `'none'`, so Haiku thinks before every reply. The gap could also come from OpenRouter routing or an older Haiku version.
  - A second hint: dev replies average about 1.6-2.3 characters per completion token. Computed from the forensics table: 84 characters for 52 tokens, 637 for 274. That is low for plain prose. It is consistent with hidden reasoning tokens being billed as completion tokens, but nothing confirms it (UNKNOWN).
  - LLM-01 and LLM-03 settle this cheaply.
- **Status: FACT for the mechanism, UNKNOWN for production.** The callbot profile has no reasoning or latency guardrail (C37 (BE-LLM-10)).

### 2.7 Context: history, codex, lorebook and caching

| Element | Today (FACT) | Issue |
|---|---|---|
| History | 100 newest rows are loaded under `FOR UPDATE`. Completed user and assistant rows are kept, and assistant rows are projected to spoken words (`spoken_history_text`). The default `truncation_strategy` is `token_budget`, which **skips `max_messages`** and trims one message at a time with full re-tokenization (O(n²)), within ≤32,768 tokens | The prefix shifts every turn once a chat exceeds 100 rows or the budget, so caching breaks on long chats (C34 (BE-LLM-07)). A whole text chat can flow into a call |
| Chat codex | At most 24 cards and 6,000 characters, appended to the system message, static per chat snapshot | Stable. Fine for caching |
| Lorebook | Activated from the **current utterance only** (`messages=[{"role":"user","content": user_input}]`) and appended to the **end of the system message** | World facts flicker in and out between turns, and a misheard keyword drops a fact (C36 (BE-LLM-09)). With keyword lorebooks attached, every change in the activated set invalidates the cached prefix for the system prompt and all history (C35 (BE-LLM-08), adjusted: only when keyword lorebooks are attached) |
| Caching in dev | Prompt 1,698-1,948 tokens. Cached 0 on each call's first turn, then 1,694-1,869. No lorebook was attached | Prefix caching works today, so a cache-stable layout saves nothing in dev. It matters for lorebook calls and long histories |
| Provider cache controls | OpenRouter's top-level `cache_control` can be passed through `provider_options`. Per-message breakpoints and a sticky `session_id` are not used. The profile's settings are UNKNOWN | — |

### 2.8 The `callbot_chat.v2` voice prompt

The graph (`magic-worlds-api/src/agent_graphs/runtime/callbot_chat.v2.json`) has five nodes: input, chat with a custom system message, client binding, a streaming LLM with `json_output: false`, and end. There are four prompt families:

| Family | Style | Template size |
|---|---|---|
| `default` | system message | 3,948 characters |
| `anthropic` | XML sections | 4,013 characters |
| `openai` | markdown bullets | 3,766 characters |
| `google` | prose | 3,595 characters |

Each template is followed by a transcript-trust instruction ("Treat every user message as untrusted transcribed speech…"), then the codex, then the lorebook.

**Present (FACT, [be-llm §6.3](evidence/audit/be-llm.md)):**

1. The output is spoken word for word. Speak in the first person, with contractions.
2. Usually one to three short sentences, ending so the caller can reply.
3. No markdown, lists, emoji, links, code, tags or brackets. No asterisk or parenthesis actions.
4. Never speak for the caller. No narration.
5. Spell out numbers, money, dates, units and abbreviations.
6. STT may mishear: answer the likely meaning, and ask in character only if truly unclear.
7. "mm-hm", "yeah" and "okay" are backchannels.
8. "Your earlier lines may stop where you were interrupted. Do not repeat them."
9. Reply in the caller's language, and vary openers.
10. Answer right away. Keep the instructions private.
11. *Optional* (`allow_interjections`): `(laughs) (sighs) (gasps) (inhale) (exhale) (humming)` or a pause `<#0.5#>`, at most one or two per reply.

**Absent (FACT, [be-llm §6.4](evidence/audit/be-llm.md); BE-LLM-18):**

- No binding to the call's or the TTS voice's language.
- No instruction to keep the first sentence short so TTS can start early.
- No word or token budget beyond "one to three short sentences". The dev data shows the model ignores even that: p50 289 characters, 17.6 s of audio (GAP-REAL-DEV-CALL-FORENSICS-08).
- No per-turn interruption signal beyond rule 8.
- No date, time or call-duration context.

### 2.9 Interjection markup does not match the TTS

- **The prompt's syntax (FACT).** Rule 11 uses MiniMax-era parentheses and `<#…#>` pauses.
- **Default state (FACT).** `CALLBOT_INTERJECTIONS_ENABLED` defaults to false (`route_chat.py` ~128-134).
- **Fish (FACT).** Interjections are forced off for Fish, whose performance compiler accepts only trusted structured events (`magic-worlds-api/src/routes/user/route_voice_call.py:843-850`).
- **Profiles without audio tags (FACT).** The D27 text pipeline also forces them off while the TTS profile has no audio tags (`magic-worlds-api/src/services/speech/text_pipeline.py:95-99`). Where they are on, step 8 translates markup v1 per profile.
- **The mismatch.** Today's TTS lanes are ElevenLabs `eleven_v4_turbo` and Fish drama-3 / s2.1-pro, and neither takes the parenthesis syntax.
  - v4 performs `[bracket]` audio tags. Using them in Spanish is undocumented, and r92's advice is to emit English tag words (untested).
  - Fish S1 parentheses are deprecated, and the API does not convert them ([r05 §7.2](evidence/research/r05-llm-for-voice.md); [r92](evidence/research/r92-gap-g2-spanish-bilingual-evidence.md)).
- **Why it is dormant.** The prompt also forbids "tags or brackets", which contradicts any bracketed tag allow-list. With interjections enabled, the model would be told to emit syntax that only a translation step makes usable. The flag is off, so the mismatch does no harm yet. It does block any emotional delivery through the LLM.

### 2.10 The spoken-text contract

The BFF treats LLM output as untrusted and validates it fail-closed. That is the right instinct, but several defects turn benign output into failed turns.

| Defect | Mechanism (FACT) | Effect | ID |
|---|---|---|---|
| Whitespace | Deltas are forwarded raw (`llm_execution_text.py:125-134`), but the final text is `.strip()`ped (`:27-30`, `:142`). `validate_spoken_text` requires `text == text.strip()` (`transcript_sanitizer.py:135`). The runner then compares stored and collected text exactly (`llm_turn_runner.py:231-235`), and so does the engine (`engine.py:2715-2720`) | `' Hello '+'there.'` fails the live turn with `upstream_contract`, while the row is stored `completed:'Hello there.'`. The tail is never spoken, though the call continues (`fatal=False`). How often models emit this is UNKNOWN | C10 (BE-LLM-01), reproduced |
| Tag-like markup | `validate_spoken_text_fragment` rejects tag-like `<…>` structure. No component strips think tags. D27 step 1 would strip `<think>…</think>`, but the runner rejects the text first | `<think>hmm</think>Hello`, `I said <b>no</b>.` and `five < ten and ten > five` kill the turn. A lone `a < b` passes | C38 (BE-LLM-13) |
| Asterisk actions in the Fish lane | `_FISH_UNSAFE_TEXT` sentences are swapped for the sanitizer's cleaned text, so `logical_text ≠ span.text`, and `WordCallTurnLedger` raises `ValueError` | 2 of 15 dev Haiku replies contained asterisks despite rule 3. Both turns failed silently after 5.3-6.4 s | GAP-REAL-DEV-CALL-FORENSICS-01 (high) |
| Failed reply enters history | `_fail_turn` updates only the segment. The assistant row stays `completed` with its full, markup-bearing text | The next prompt contains a reply the caller never heard | GAP-REAL-DEV-CALL-FORENSICS-02 |
| Unpunctuated tail | `*` is not a sentence closer, so a final fragment waits for `VoiceLlmTurnCompleted`, after the 1-2.5 s post-stream tail | Short replies ending in an action or with no punctuation are delayed | GAP-REAL-DEV-CALL-FORENSICS-06 (low) |

### 2.11 Cancellation on barge-in, and what the LLM sees afterwards

**Cancellation chain (FACT, [be-llm §10](evidence/audit/be-llm.md)):**

1. The engine sets `cancel_event`.
2. The runner cancels the producer.
3. `_execute_owned` cancels the worker, which closes the httpx stream.
4. Starlette's `listen_for_disconnect` in api.magic_llm cancels the stream task group.
5. NodeLLM's `aclosing(core_stream)` closes the provider socket.

The upstream path is closed promptly. Two things remain open:

- **Whether the provider stops generating and billing** after the disconnect is UNKNOWN, for both OpenRouter and the model host.
- **Usage for cancelled turns is lost.** The BFF stores none, and api.magic_llm records `status='cancelled'` with `usage=None`.

**What the next turn pays.** The superseding turn awaits `previous.finished`. That covers cancellation-time DB work, up to 3 s of truncation settling and asset persistence. The new turn then waits up to another 3 s for any pending truncation.

- In dev, 4 of 19 LLM turns waited 0.7-6.4 s before their own LLM call began. These waits are measured upper bounds: the verifier notes each is overstated by the 0.2-0.4 s baseline.
- The api.magic_llm tail is **not** awaited on cancel (GAP-REAL-DEV-CALL-FORENSICS-05, adjusted; C20 (BE-LLM-14)).
- If the supersede arrives after `voice_turn_end`, the old reply is neither cut nor cancelled (GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-03; [05_turn_taking_and_interruptions.md](05_turn_taking_and_interruptions.md)).

**What the model sees** ([gap-real-call-overlap-history-billing §7](evidence/audit/gap-real-call-overlap-history-billing.md)):

| Situation | History today | Problem |
|---|---|---|
| Barge-in mid-reply with audio heard | Assistant text cut to the heard prefix, sentence-granular on ElevenLabs, with no marker | Can store up to a sentence that was never heard (C25). Nothing tells the model it was cut off, apart from rule 8 |
| Mid-stream cancel with nothing heard | Empty interrupted turn, excluded from history, which leaves two user messages in a row | The model does not know it was about to speak, so it may repeat the same opener |
| Barge-in after completion with nothing heard | **Full reply kept** | Unheard text is treated as said (C26, lowered to low: the window is narrow) |
| Supersede after `voice_turn_end` | Full reply kept | Same problem, and not narrow (C24) |
| AEC off: echo transcribed | The character's own voice enters as a user turn | The model answers itself (C05) |
| False barge-in (cough, backchannel) | Generation discarded, with no resume | Lost content (C15; BE-LLM-22) |

### 2.12 Errata applied in this document

| Earlier claim | Correction | Source |
|---|---|---|
| "No LLM retries" | magic-llm retries pre-output failures, up to 3 attempts in total, about 92 s worst case | K05; be-llm verifier BE-LLM-05 |
| "No `max_tokens` on the callbot" | `max_output_tokens=1,536` | K06 |
| "About 16 commits, 150-750 ms before the provider" | 19 commits before `llm_start` (revision 20), p50 874 ms; 32 per turn in total | GAP-TOPOLOGY-RTT-MEASUREMENTS-04 verifier |
| "The OpenRouter usage poll inflates the provider window and tail" | Not on the first-audio path: the poll runs only after the stream, and 19/19 voice runs record `usage_source=provider` with no `id_generation`. The verifier's private-transport explanation is reachable only on recovery (§2.5 path note), so a poll that runs and fails after the stream is not ruled out (C39, info) | GAP-TOPOLOGY-RTT-MEASUREMENTS-02 verifier; code re-check 2026-10-20 |
| "SSE buffering may delay callbot deltas" | Not applied on the inline `agt` path | code, `completions.py:1056-1063` |
| "The lorebook breaks caching on every turn" | Only when keyword lorebooks are attached and the activated set changes | C35 verifier |
| "Every sentence pays moderation" | Only sentence 1 is serial; N+1 is prepared while N plays | K07 |
| "Cold TLS is a top-3 wait" | 100-300 ms per turn in total (about +165 ms p50). The reconciliation verifier lowered C09 to medium on that mean; the register keeps it high because of the measured 0.5-1.5 s stalls on about 1 turn in 3 ([03](03_audit_findings.md) §1.1) | reconciliation verifier; GAP-TOPOLOGY-RTT-MEASUREMENTS-02 |
| "The supersede wait includes the api.magic_llm tail" | It does not; cancel closes the stream | GAP-REAL-DEV-CALL-FORENSICS-05 verifier |

---

## 3. TTFT and TTFAT: anatomy and budgets

### 3.1 What the published numbers measure

| Metric | Definition | Pitfall for voice |
|---|---|---|
| TTFT | Request sent → first streamed token of any kind | For reasoning models whose thoughts are not streamed (Claude, Gemini), the first visible token arrives only after all thinking |
| TTFAT | Time to first **answer** token, after thinking | This is the number that matters for speech |
| AA "first chunk" (leaderboard latency column) | First chunk on a **10k-token unique prompt**, from one GCP VM in `us-central1-a`, P50 over 72 h ([AA methodology v2.2.0, 2026-03-02](https://artificialanalysis.ai/methodology/performance-benchmarking)) | Per-model pages default to the **max-reasoning** variant: GPT-6 Luna (max) 89.84 s, Haiku 5.5 (max) about 245 s. AA lists no thinking-off variant for Haiku 5.5. Prompts are uncached |
| aiewf-eval TTFAT | Service time to the first user-visible answer token, over a **30-turn** scripted conversation with a ~12k-token knowledge base ([aiewf-eval](https://github.com/kwindla/aiewf-eval), cohorts to 2026-10-19) | Closer to a call, since later turns are cached, but the region is not stated and cache settings vary by row |

Two often-quoted numbers are **not planning numbers** (r94 §3.1):

- **Groq gpt-oss-120b at 98 ms.** This archived aiewf row (2026-10-17) was removed at the maintainer's request.
- **Groq gpt-oss-120b at 4.91 s on AA.** That is 0.68 s to the first reasoning chunk plus 4.22 s of high-effort reasoning.

Neither answers the voice question: thinking off or minimal, a 3-8k prompt, a warm cache, measured from our region.

### 3.2 Budget: today versus target

All figures run from an accepted transcript to the first sentence ready for TTS.

| Component | Today in dev (INFERENCE from FACT rows) | Target p50 (estimate) | How |
|---|---|---|---|
| BFF prep, admission, dispatch | 200-400 ms | 100-250 ms | Per-call caching of context and catalog, a lighter admission transaction, a pooled client (LLM-05, LLM-07) |
| api.magic_llm auth, admission, recording | ~0.85-1.0 s (p50 ~0.9 s) | < 150 ms | Voice fast path, cached delegated auth (LLM-07) |
| Connect + queue + prefill + hidden reasoning (TTFT) | ~1.4-1.85 s (Haiku, cold connect, reasoning setting UNKNOWN) | 0.45-0.8 s | Warm pool (LLM-05), thinking off (LLM-03), bake-off (LLM-09) |
| First speakable unit | 100-600 ms | 50-150 ms | Short first sentence (LLM-12), clause-level first chunk (TTS-04 in [08_text_to_speech.md](08_text_to_speech.md)) |
| **Total** | **~2.5-3.3 s** | **~0.8-1.0 s** (p95 about 1.3-1.9 s, from r94's p95 range) | |
| ElevenLabs budget for comparison | — | LLM TTFT 250 / 600 ms P50 / P95 (vendor-reported) | |

```mermaid
gantt
    title LLM stage from transcript to first sentence, dev today vs target (ms, estimates)
    dateFormat x
    axisFormat %S.%L
    section Today (dev)
    BFF prep and admission         :a1, 0, 300
    magic_llm auth admit record    :a2, 300, 1200
    Connect and TTFT               :a3, 1200, 2800
    First sentence                 :a4, 2800, 3050
    section Target
    BFF prep                       :b1, 0, 150
    Fast path                      :b2, 150, 270
    Warm TTFT thinking off         :b3, 270, 870
    First clause                   :b4, 870, 970
```

The target follows r94's planning rule (§3.4): mainstream hosted APIs with thinking off and a cached 3-8k prefix land at **about 0.45-0.8 s p50 and 0.8-1.4 s p95**. Fast-silicon or dedicated open models land at about 0.25-0.65 s p50. Any enabled reasoning adds about 1-5 s and excludes a model from the call lane. Until the fast path ships, a provider-side TTFAT is **not** the end-to-end LLM stage. Our own hops add roughly 1.1-1.3 s on top.

---

## 4. State of the art, and how it applies here

### 4.1 A voice fast path

- **Practice.** Production voice stacks call the model from the agent process over warm connections. They keep catalog, profile and audit lookups off the critical path ([r05 §9.4](evidence/research/r05-llm-for-voice.md)). The ElevenLabs latency guide (vendor-reported) attributes 20-200 ms to public-internet round trips alone. Durable or audited execution is recorded around the stream, not before it.
- **Magic Worlds.** About 0.9 s p50 of durable work sits before the first provider byte, plus a 1-2.5 s tail. Three ways to fix it:

| Option | What changes | Pros | Cons |
|---|---|---|---|
| A. Ephemeral execution mode in api.magic_llm | For BFF-owned single-node graphs like `callbot`: no per-node checkpoints, one commit after the stream, `[DONE]` sent before post-stream recording | Keeps credential custody, profile rendering and the agents API contract. Smallest blast radius | api.magic_llm work. Durable replay is lost for callbot, which is acceptable because the BFF persists the reply |
| B. Write-behind recording | Batch events, append-only instead of checkpoint rewrites, `PARTIAL_JSON` / `MINIMAL` binlog | Keeps durability | Still pays some DB work. Gains are smaller and less predictable |
| C. BFF calls the provider directly | An OpenAI-compatible HTTP client in the BFF, with the api.magic_llm record written asynchronously | Removes a whole hop: auth ×2, admission, SSE re-encoding | The BFF must not import `magic-agents`/`magic-llm` (enforced by tests). Duplicates provider rendering and key custody. A bigger architectural decision ([16_target_architectures.md](16_target_architectures.md)) |

Option A is the recommended first step (LLM-07). The forensics target is under 150 ms before the provider call.

### 4.2 Pooled, warm connections and prewarm

**Practice.** Hold one long-lived client per provider with keep-alive longer than the gap between turns. Use HTTP/2 where available, cache DNS, and prewarm at call start and on `speech_start` (r05 §9.4; GAP-TOPOLOGY-RTT-MEASUREMENTS-02).

**Magic Worlds today:**

- **Every hop is cold.**
  - The BFF builds a new httpx client per turn.
  - magic-llm builds a new session and a new connector per call, with DNS caching off.
  - The Groq STT pool expires after 5 s while users speak 10-31 s apart.
  - uvicorn's `timeout_keep_alive=5` on the BFF, api.magic_llm and api.auth would defeat pooling between services anyway.
- **The fix is client-side.** Provider edges kept idle connections for ≥125 s.
- **Dev-only artefact.** `--reload` starts uvicorn without `TCP_NODELAY`. That adds about 41 ms to each reused keep-alive request in dev only. Production launchers do not take this path (GAP-TOPOLOGY-RTT-MEASUREMENTS-01). Measure latency with the production launcher.

**Expected gain (estimate):** about 90 ms p50 per turn on the OpenRouter hop, plus the removal of 0.5-1.5 s connect tails on about 16% of turns. That tail rate holds for the dev network only.

### 4.3 Thinking off or minimal, per model

Knobs as of October 2026 ([r05 §6](evidence/research/r05-llm-for-voice.md), from provider docs accessed 2026-10-20):

| Model | Lowest setting | Live-loop fit |
|---|---|---|
| Claude Haiku 5.5 | `thinking: {type: "disabled"}` at effort ≤ high. **Default is adaptive thinking at `medium`** | Good once thinking is disabled |
| Claude Sonnet 5.5 | `between_tools`; `disabled` returns 400 | Poor: it cannot skip up-front reasoning reliably |
| Claude Opus 5.5 / Fable 5.1 | Cannot disable | Not for the live loop |
| GPT-6 Luna | `reasoning: none` | Candidate, but aiewf recorded 0/30 completions with `none`, so verify the integration |
| GPT-6.1 Sol / Astra | Lowest is `low` | Too slow and costly |
| Gemini 3.5 Flash-Lite | `thinking_level: minimal` (default) | Candidate |
| Gemini 3.6 Flash | `minimal`, but the default is `medium` | Set it explicitly. Daily reports many thinking tokens even at minimal |
| Gemini 3.8 Flash / 4 Argon | Lowest is `low` | Not a candidate (aiewf 1,411 / 1,967 ms at `low`) |
| gpt-oss-20b / 120b | `reasoning_effort: low`; cannot be off | Fast silicon hides most of it |
| Qwen 3.8 27B on Groq | `reasoning_effort: none` | Candidate. Groq marks it preview and does not cache it |

Operational rules:

- **Fix the reasoning setting per call.** On Anthropic a change invalidates the message cache.
- **Verify the flag end to end.** Check that it reaches the provider: some platforms drop thinking parameters (r05 cites a Vapi thread).
- **Assert zero reasoning tokens in usage on every turn.** Magic Worlds drops `reasoning_content` and maps only `'none'` to OpenRouter's off switch, so a "minimal" or unset profile silently thinks.

### 4.4 Model and host bake-off

r94 §3.4 shortlists these candidates. The figures are **provider-side estimates** for thinking off or minimal, a 3-8k-token prompt and a warm cache. They are not measurements.

| Candidate | Anchor (independent unless marked) | Expected p50 | Expected p95 | Confidence | 18+ tier fit (r91) |
|---|---|---|---|---|---|
| Claude Haiku 5.5, thinking disabled (Anthropic API) | aiewf thinking-off 556 / 819 ms | 0.45-0.60 s | 0.75-0.90 s | Medium | T0/T1 only |
| GPT-6 Luna, `none` | AA non-reasoning first chunk 0.83 s at 10k uncached; aiewf 0/30 completions with `none` | 0.55-0.80 s | 1.1-1.4 s | Low-medium | T0/T1 only |
| gpt-oss-120b `low`, Cerebras | AA first chunk 0.34 s at 10k uncached | 0.25-0.45 s | 0.5-0.9 s | Low-medium | T2 possible: Cerebras ToS is ambiguous ("?"), and gpt-oss carries its own refusal tuning |
| gpt-oss-120b `low`, Groq | AA first chunk 0.68 s at 10k uncached | 0.40-0.80 s | 0.8-1.5 s | Low | T2 possible (A\*) |
| Qwen 3.8 27B, `none` (Baseten, Groq preview, Cerebras) | aiewf Baseten 649 / 801 ms | 0.35-0.65 s | 0.6-0.9 s | Medium (Baseten), low (others) | T2 possible on Groq |
| Gemma 4 31B, thinking off | aiewf 497 / 629 ms, **max 33.3 s** | 0.40-0.55 s | 0.6-0.75 s | Medium | Open weights; host terms apply |
| Gemini 3.5 Flash-Lite, `minimal` | aiewf 617 / 1,145 ms | 0.55-0.70 s | 1.0-1.2 s | Medium | T0/T1 only |
| Self-hosted (PhoneLLM-class, Qwen NVFP4) | aiewf local 101 / 318 ms without network; Daily PhoneLLM <100 ms P95 (vendor-reported, unverified) | 0.10-0.30 s + RTT | 0.3-0.6 s + RTT | Low-medium | Full control |

Bake-off conditions:

- **Region and route.** Run from the production region, through the same route the call will use (OpenRouter or direct), with the real `callbot` prompt.
- **Prompt sizes.** Test today's ~1.9k tokens, and 3-8k with lorebook and codex.
- **Cache state.** Measure warm and cold. Remember the cache minimums: Gemini implicit caching needs 4,096 tokens, so today's ~1.9k prompt would **not** be cached on Gemini.
- **Metrics.** Collect TTFAT p50/p95/max, first-sentence time, reasoning tokens (must be 0 or minimal), completion success rate, `finish_reason`, and a refusal and persona-break rate on in-domain EN/ES 18+ fiction.
- **Rejection rule.** Reject any candidate whose p95 exceeds about 1.0 s (r94 §6).
- **Long tails.** Gemma's 33.3 s max shows why a watchdog is needed whatever the median (§4.10).
- **Also test.** Gemini 3.6 Flash at `minimal`, which neither aiewf nor AA has measured. Also test OpenRouter's `preferred_max_latency` (for example `{ "p90": 2.5 }`, a soft preference over a rolling 5-minute window) against a pinned provider.

### 4.5 Prompt-caching layout

Cache minimums and mechanics ([r05 §4.1](evidence/research/r05-llm-for-voice.md); [r94 §3.3](evidence/research/r94-gap-g4-contradictions-reconcile.md)):

| Provider | Minimum prefix | TTL | Notes |
|---|---|---|---|
| Anthropic | 512 tokens (Haiku, Sonnet and Opus 5.5) | 5 min (refreshed on read) or 1 h | Up to 4 explicit breakpoints or automatic top-level `cache_control`; 20-block lookback. `max_tokens: 0` pre-warm is **rejected with `stream: true` or thinking** |
| OpenAI (GPT-5.6+) | 1,024 tokens | 30 min default, 12 h option | Automatic prefix; `prompt_cache_key` mostly for accounting on 5.6+ |
| Gemini (implicit) | 4,096 tokens (3.6 / 3.8 Flash, 4 Argon); 3.5 Flash-Lite unlisted (unverified) | n/a | A 3k prompt is not cached |
| Groq | 128-1,024 tokens, **gpt-oss only** | ~2 h idle | 50% discount |
| Cerebras | 128-token blocks, all models | 5 min to 1 h | No discount |
| OpenRouter routing | — | — | Sticky `session_id` pins a conversation to one provider for about 10 minutes, best-effort. A hard-coded `provider.order` disables it, and Auto Exacto can override it on tool-calling requests ([OpenRouter latency page](https://openrouter.ai/docs/features/latency-and-performance), undated, accessed 2026-10-20) |

Recommended layout ([r05 §4.3](evidence/research/r05-llm-for-voice.md)):

```mermaid
flowchart TD
    S["System (frozen per call): voice rules, persona card, user persona, codex, always-on lore"] --> BP1["Cache breakpoint 1"]
    BP1 --> SUM["Rolling summary block (changes rarely, in big steps)"]
    SUM --> H["Verbatim spoken history (append-only)"]
    H --> BP2["Cache breakpoint 2 (automatic, moves forward each turn)"]
    BP2 --> D["Late dynamic block: activated lore, interruption note, scene state"]
    D --> U["Newest user transcript"]
```

What this changes for Magic Worlds:

- **Move the lorebook block.** Take it out of the system message and put it in the late dynamic block. Make activation sticky over the last few turns, which also fixes C36 flicker.
- **Window in blocks.** Window history in large blocks rather than one message at a time, so the prefix shifts rarely (C34).
- **Use provider controls.** Send a per-call `session_id` to OpenRouter and Anthropic breakpoints through the profile.
- **Prewarm.** Prewarm during ring or greeting with a short non-streaming request; Anthropic's `max_tokens: 0` cannot be combined with streaming or thinking.

**Expected gain:** zero in dev, where there is no lorebook and the cache already hits. On lorebook calls and long histories it is prefill time, plus cost at cache-read prices (0.1× base on Anthropic). The size is UNKNOWN until measured.

### 4.6 Speech-first prompting

Cross-vendor consensus ([OpenAI voice prompting guide](https://developers.openai.com/api/docs/guides/voice-prompting.md), [ElevenLabs prompting guide](https://elevenlabs.io/docs/eleven-agents/best-practices/prompting-guide), both accessed 2026-10-20; [r05 §7](evidence/research/r05-llm-for-voice.md); [r09](evidence/research/r09-naturalness-roleplay.md)):

- **Short first sentence.** It is the one the user waits for.
  - ElevenLabs Agents start TTS on a comma.
  - `eleven_v4_turbo` starts after about 40 characters or 8 words unless flushed ([r01 §4.4-4.9](evidence/research/r01-cascaded-architecture.md), vendor-reported).
  - A 4-8 word first clause lets the clause-level first chunk (TTS-04 in [08_text_to_speech.md](08_text_to_speech.md)) fire early.
- **Length by situation.** Use one or two sentences for direct answers and one question at a time. Go longer only on request, and offer to continue rather than monologue.
  - Vary turn length: one-word reactions are allowed (r09).
  - Back the rule with a token cap and handle `finish_reason: length` by ending on the last full sentence.
- **Plain spoken text, no markup.** Magic Worlds already says this. 2 of 15 Haiku replies still contained asterisk actions, so sanitize as well as prompt (§2.10).
- **Language pinning.** Reply in the call's configured language. Do not switch on names, loanwords, backchannels or isolated foreign words, and keep one language per turn.
  - r92 found that v4 drops the reference accent cross-lingually.
  - The current rule ("reply in the language they are speaking") is weaker than OpenAI's guidance.
- **Emotion tags matched to the TTS.** Use a neutral internal vocabulary, mapped per provider by the D27 pipeline (r09):
  - **ElevenLabs v4:** `[bracket]` audio tags as English tag words, even in Spanish (untested, r92).
  - **Fish Drama 3:** natural-language direction in any language.
  - Cap tags at 1-2 per reply, at sentence start.
  - Drop the "no brackets" rule only for the tags on the active allow-list.
  - Strip tags from history so the model does not imitate them after a fallback.
- **Repeat the one or two critical rules.** ElevenLabs suggests it. Here they are "spoken words only" and "never speak for the caller".
- **Pre-generate constrained lines.** Do not use the LLM for greeting, goodbye, error and "are you still there?" lines. Pre-generate them per character and voice (r05 §9.4). This also gives a ringback greeting (C53).

### 4.7 Interruption context in history

**Practice:**

- **OpenAI Realtime** truncates to `audio_end_ms` and deletes the unplayed transcript ([realtime conversations guide](https://developers.openai.com/api/docs/guides/realtime-conversations), accessed 2026-10-20).
- **Pipecat** commits only text whose audio actually played.
- **LiveKit** estimates the played text, which can be off by a word or two outside English.
- **Voice-Light** treats browser playback acknowledgements as the authoritative history ([arXiv 2609.20995](https://arxiv.org/abs/2609.20995), Sep 2026).

**Recommended representation** (r05 §10):

1. Store the heard prefix at word granularity where alignment exists. ElevenLabs returns per-character alignment, but Magic Worlds cuts at sentence level today (C25).
2. Add a per-turn note in the late dynamic block, not inside the assistant text. For example: "You were cut off after: '…'. The caller then said: …". Models imitate markers placed in their own text.
3. Drop replies nobody heard. Optionally keep a one-line note that the character was about to speak, so it does not repeat the same opener.
4. Never store a failed, unheard reply as completed (GAP-REAL-DEV-CALL-FORENSICS-02).

### 4.8 Speculative generation

| Source | Mechanism | Reported result |
|---|---|---|
| [LiveKit Agents](https://docs.livekit.io/agents/build/speech/) (rendered 2026-10-20) | `preemptive_generation` on by default. It runs the LLM only, on the final transcript before end of turn is confirmed. Discarded if context changes. Skipped above `max_speech_duration` (10 s). `max_retries` 3 | LiveKit says it "doesn't always reduce latency" and costs extra tokens |
| Endpoint Anticipation ([arXiv 2606.13450](https://arxiv.org/abs/2606.13450), Jun 2026) | Forecast end of turn up to 2.56 s ahead; speculative LLM and TTS | −505 ms average, +28.4% speculative compute |
| Voice-Light ([arXiv 2609.20995](https://arxiv.org/abs/2609.20995), Sep 2026) | Private speculative candidates, invalidated on any lexical change | 758 ms median final-VAD to first server audio (36-turn case study) |
| RelayS2S ([arXiv 2603.23346](https://arxiv.org/abs/2603.23346), Sep 2026) | A duplex model drafts a prefix, a verifier commits, the cascade continues | −479 ms average on real dialogues |
| Deepgram Flux eager end of turn; Telnyx (r01, vendor-reported) | Speculate on an early turn signal | +50-70% LLM calls (Deepgram); −150 ms median (Telnyx) |

**Applicability.** Magic Worlds uses batch Groq STT, which produces no partials. The feasible form works like this:

1. The client closes a candidate segment at a short pause of about 250-300 ms.
2. The server runs STT and the LLM speculatively, without persisting or billing a user turn and without starting TTS.
3. Release at the confirmed 550 ms silence. If the user resumes, discard and merge the segments.

**Preconditions:**

- **The fast path (LLM-07).** Otherwise every discarded speculation still writes ~32 durable commits.
- **Prefix caching.** Repeated attempts should pay little prefill.
- **An STT cost model.** Groq bills a 10 s minimum per request, so speculative STT on short clips multiplies STT cost ([06_speech_to_text.md](06_speech_to_text.md)).

**Expected gain (estimate):** −0.25 to −0.5 s on confirmed turns, in line with the literature. This is P2, after the deterministic wins.

### 4.9 Fillers: mixed evidence

- **For fillers.** In a VR study (CUI '25, [arXiv 2507.22352](https://arxiv.org/abs/2507.22352)), latency above 4 s degraded quality of experience, and natural fillers improved perceived response time at high delay.
- **Against fillers.** The "fillers make agents seem less intelligent" result is prior work cited in [arXiv 2508.11781](https://arxiv.org/pdf/2508.11781), not that paper's finding. Its own study found no significant filler-type effect on perceived intelligence.
- **OpenAI's guidance.** Avoid "Let me think" fillers on direct answers.
- **ElevenLabs.** It recommends a 3.0 s soft timeout with one filler per turn (r01, vendor-reported).
- **r09.** Use fillers only when the wait is long, gated at about 700-900 ms predicted.
- **When they backfire.** The answer would have arrived within about 700 ms anyway, they repeat, they clash with the content, they are in the wrong language, or the LLM then repeats its own acknowledgement.

**Roleplay-safe pattern:**

- Use pre-synthesized, per-voice, non-lexical cues: a breath, "mm", a hum.
- Trigger them only from the TTFT watchdog or a predicted long wait, and rotate them.
- Record them in history as non-lexical, or not at all.
- Never use one on the greeting.

Fillers mask latency without removing it. Today's 2.5-3.3 s LLM stage would trigger them on most turns, which is exactly when they read as a tic. Fix latency first; A/B test fillers after (LLM-18).

### 4.10 TTFT deadline, hedge and fallback

**Practice** (r05 §9.3; r01):

- Arm a first-token watchdog at about the provider's p90.
- On a miss, fire a backup request to a second provider or profile and use whichever streams first. Cancel the loser.
- Hedge only the tail: it costs duplicate prefill and loses cache affinity on the backup.
- Separately, bound total time and allow at most one silent retry before output.

```mermaid
flowchart TD
    A["Dispatch primary (warm pool, thinking off)"] --> B{"First token before T1 (start 2.5 s, tune to p90)?"}
    B -- yes --> C["Stream to SentenceBuffer"]
    B -- no --> D["Fire hedge to fallback profile, optional non-lexical cue"]
    D --> E{"First token from either before T2 (about 5 s)?"}
    E -- yes --> F["Use first stream, cancel the other"]
    E -- no --> G["Cancel both, speak pre-generated in-character recovery line, error category llm_timeout"]
    C --> H{"Total deadline 10-15 s or finish_reason length?"}
    H -- length --> I["End at last full sentence"]
    H -- deadline --> G
```

**Magic Worlds today:** no T1, no T2 and no fallback profile. There is up to about 92 s of blind retries, and `llm_timeout` is unreachable (C07).

**Expected gain (estimate):** the worst-case silence drops from about 92 s to about 5 s. p95 is cut on the tail turns. Cost is duplicate prefill on roughly the slowest 10% of turns.

### 4.11 Rolling summary for long calls

- **Practice.** Pipecat's context summarization is off by default ([docs](https://docs.pipecat.ai/pipecat/fundamentals/context-summarization.md), accessed 2026-10-20). When enabled:
  - it triggers at about 8,000 estimated tokens or 20 new messages;
  - it keeps the system message and the last 4 messages verbatim;
  - it runs in the background, and can use a cheaper model.
- **Cache compatibility.** Summarize in big steps, every 20-30 turns, and place the summary right after the static system block.
- **Avoid importing whole text chats.** Long prose turns teach the model to answer in prose.
- **After the call.** r09 adds a post-call "last time" brief of at most 150 tokens for the next call, written off the critical path.
- **Magic Worlds.** It has a 100-row, 32k-token window with no summary. A call that starts from a long text chat inherits that whole history in spoken projection. Today's dev prompts are small (~1.9k tokens), so this matters most for long chats and long calls (LLM-16).

### 4.12 The talker/reasoner split

- **Practice:**
  - [Talker-Reasoner](https://arxiv.org/abs/2410.08328) (2024, possibly stale but foundational): a fast talker converses while a slow reasoner plans.
  - [KAME](https://arxiv.org/abs/2510.02327) (ICASSP 2026): a fast front end speaks while back-end LLM text is injected in real time.
  - RelayS2S: a fast prefix, then a stronger continuation.
- **For a text cascade**, two moves:
  - Route by turn type: small talk to the fast model, while a long story, a plot pivot or a memory recall escalates with a short in-character holding line.
  - Run the reasoner asynchronously after each turn to update a structured scene and memory block in the late dynamic block, which keeps the cache intact.
- **Magic Worlds.** One profile serves every turn. A split becomes interesting once the talker is a small, fast model whose narrative quality needs support (LLM-17).

### 4.13 Guardrails off the critical path

**Practice** (r05 §12):

- Run input checks in parallel with the LLM.
- Check output at sentence granularity, gating audio **release** rather than synthesis.
- Start TTS for sentence 1 concurrently with its check, and moderate N+1 while N plays.
- Use small, fast classifiers on a pooled connection.
- Run slow judges asynchronously and act on the next turn.

**Magic Worlds:**

- N+1 is already prepared while N plays, so only sentence 1 is serial (K07).
- The classifier is off in dev. "Required" moderation without a classifier refuses calls.
- With the classifier on, each check would go through the durable api.magic_llm path under a 300 ms fail-closed budget. It would likely time out and turn calls text-only (C04, latent launch blocker; [14_safety_policy_and_compliance.md](14_safety_policy_and_compliance.md)).

**LLM-side implication:** keep the classifier off the durable path: give it the fast path or a direct pooled endpoint, and overlap sentence-1 checking with TTS synthesis (LLM-13).

### 4.14 Policy-tier routing for 18+

Content policy filters the LLM choice before latency or price do ([r91](evidence/research/r91-gap-g1-vendor-policy-retention-matrix.md)). Tiers:

| Tier | Content |
|---|---|
| T0 | General |
| T1 | Romance or suggestive, non-graphic |
| T2 | Explicit content between consenting adult fictional characters |
| V1 | Action violence |
| V2 | Graphic violence |

| Vendor (policy, date) | T2 | Note |
|---|---|---|
| OpenAI ([Model Spec 2026-08-18](https://model-spec.openai.com/2026-08-18.html)) | ✘ in practice | "Don't respond with erotica or gore" is a System-level rule and covers audio |
| Anthropic ([Usage Policy](https://www.anthropic.com/legal/aup), effective 2026-11-12) | ✘ | Bans erotic chats. The effective date is three weeks after the research date, and the previous version governs until then. Consumer chatbots must disclose AI at session start |
| Google ([Prohibited Use Policy](https://policies.google.com/terms/generative-ai/use-policy), 2024-12-17) | ✘ | — |
| xAI ([AUP](https://x.ai/legal/acceptable-use-policy), 2026-08-14) | ✔ (A) | Bans real-person sexual likeness and minors |
| Groq-hosted open weights ([AUP](https://console.groq.com/docs/legal/ai-policy), 2025-10-15) | A\* | Bans only illegal sexual content. Model licenses overlay |
| Cerebras ([ToS](https://www.cerebras.ai/terms-of-service), 2024-08-27, stale) | ? | Legality test plus an "objectionable" catch-all |

**Implications:**

- **Dev's Haiku is T0/T1 only.** Any T2 persona must resolve to xAI or open weights on Groq, Cerebras or self-hosted.
- **Pin the callbot profile per persona tier.** Record the tier → provider mapping in the published catalog so operations cannot drift.
- **Treat refusal rate as a bake-off metric.**
- **Anthropic disclosure.** If Claude stays in the call path, its per-session AI disclosure duty applies.
- **Fish.** It prohibits T2 ([Customer Agreement](https://fish.audio/enterprise-terms/), 2026-08-10). ElevenLabs is A\* ([use policy](https://elevenlabs.io/use-policy), 2026-10-09).
- **The TTS lane must match the LLM tier** ([14_safety_policy_and_compliance.md](14_safety_policy_and_compliance.md)).

### 4.15 Gaps at a glance

This table restates the gaps from §2 and §4 against the practice in each subsection, so that every one maps to a recommendation.

| Gap (today, FACT unless marked) | Best practice | Section | Fix |
|---|---|---|---|
| ~0.9 s p50 of durable commits before the provider, 1-2.5 s after it | Record around the stream, not before it | §2.4, §4.1 | LLM-07 |
| New provider session per call; BFF client per turn | Warm, pooled clients and a prewarm | §2.5, §4.2 | LLM-05 |
| Thinking setting unchecked; likely on in dev (INFERENCE) | Thinking off or minimal, asserted every turn | §2.6, §4.3 | LLM-03 |
| No TTFT or total deadline; ~92 s worst case | T1 watchdog, hedge, at most one retry | §2.5, §4.10 | LLM-06, LLM-10 |
| Whitespace and markup fail turns | Repair, then validate | §2.10 | LLM-02 |
| Long replies (p50 289 characters), 1,536-token cap, `finish_reason` always `stop` | 1-2 short sentences, a tight cap, a real `length` signal | §2.5, §4.6 | LLM-04, LLM-12 |
| Lorebook at the end of the system message; per-message trimming | A static prefix with a late dynamic block | §2.7, §4.5 | LLM-08 |
| History hides interruptions and keeps unheard text | Heard prefix plus a per-turn note | §2.11, §4.7 | LLM-11 |
| MiniMax-era interjection syntax; no language pin | Tags native to the TTS; a pinned call language | §2.8-2.9, §4.6 | LLM-12 |
| Moderation would run through the durable path under 300 ms | A fast classifier that overlaps with TTS | §4.13 | LLM-13 |
| No policy tier on the callbot profile | Tier → provider routing | §4.14 | LLM-14 |
| TTFT never measured | Per-turn stage marks | §2.2 | LLM-01 |

---

## 5. Recommendations

Priority scale:

| Priority | Meaning |
|---|---|
| P0 | Days of work, no vendor change |
| P1 | Weeks of work |
| P2 | Architectural, about a quarter |
| P3 | Experiment or watch |

Effort is S, M or L. Every millisecond figure is an **estimate** unless it is marked as measured, and estimates overlap, so they do not add linearly (§6). Cross-document roll-up: [17_recommendations_and_roadmap.md](17_recommendations_and_roadmap.md).

### 5.1 Summary

| ID | Title | Priority | Effort | Expected impact (estimate) | Depends on |
|---|---|---|---|---|---|
| LLM-01 | Measure the LLM stage on every turn | P0 | S-M | 0 ms directly. Makes every estimate here checkable | — |
| LLM-02 | Repair, don't fail, the spoken-text contract | P0 | S | Removes whitespace, markup and ledger turn failures (2/15 dev Haiku turns on Fish; whitespace rate UNKNOWN) | — |
| LLM-03 | Thinking off and a latency contract for the callbot profile | P0 | S | −0.5 to −1.3 s p50 if dev Haiku is thinking (to confirm with LLM-01) | LLM-01 |
| LLM-04 | Shorter replies, a backstop cap and a real `finish_reason` | P0 | S | Less unheard TTS spend and fewer overlaps. Today: reply p50 289 characters, 17.6 s of audio. The target is set from LLM-12 evals | LLM-03, LLM-12 |
| LLM-05 | Warm, pooled connections and prewarm on every LLM hop | P0 | S-M | About −90 ms p50, and removes 0.5-1.5 s connect stalls on ~16% of turns (dev network) | — |
| LLM-06 | Deadlines and a bounded retry | P0 | S-M | Worst-case silence about 92 s → about 5 s, with an in-character recovery | LLM-01 for thresholds |
| LLM-07 | Voice fast path in api.magic_llm | P1 | M-L | −0.7 to −1.1 s p50 on every turn. Takes the 1-2.5 s tail off the completion and supersede path | LLM-01 |
| LLM-08 | Cache-stable context layout | P1 | M | 0 in dev. Prefill time and cost on lorebook and long calls (size UNKNOWN) | LLM-01 |
| LLM-09 | Model and host bake-off | P1 | M | Provider TTFAT 0.45-0.8 s p50 hosted, 0.25-0.65 s on fast silicon (r94 estimates) | LLM-01, LLM-03, LLM-14 |
| LLM-10 | Hedge and fallback profile | P1 | M | Cuts the p95/max tail. Resilience to provider incidents | LLM-06, LLM-09 |
| LLM-11 | Interruption-aware history | P1 | M | Fewer repeated or incoherent replies after interruptions (quality) | Doc 05 supersede fix |
| LLM-12 | Speech-first prompt v3 | P1 | S-M | First sentence −0.1 to −0.3 s, a stable language, emotion tags that work | D27 mapping, doc 08 |
| LLM-13 | Guardrails off the LLM critical path | P1 | M | Avoids up to 300 ms on sentence 1, and avoids text-only calls when moderation is required | LLM-07, doc 14 |
| LLM-14 | Policy-tier routing for 18+ | P1 | M | Compliance. No refusal-driven persona breaks on T2 personas | LLM-09 |
| LLM-15 | Speculative LLM start | P2 | L | −0.25 to −0.5 s on confirmed turns, at roughly +28% LLM compute (literature) | LLM-07, LLM-08, docs 05/06 |
| LLM-16 | Rolling summary and post-call memory | P2 | M-L | A bounded prompt on long calls, and continuity across calls | LLM-08 |
| LLM-17 | Talker/reasoner split | P2 | L | Quality support for a small, fast talker, at no first-audio cost | LLM-09, LLM-16 |
| LLM-18 | Latency cues and pre-generated lines (A/B) | P3 | M | Perceived wait on tail turns, plus a greeting so the call does not start in silence (C53) | LLM-06, LLM-01 |
| LLM-19 | Watch list | P3 | S | — | — |

### 5.2 P0: days, no vendor change

**LLM-01: Measure the LLM stage on every turn**

- **What:**
  - Add a `first_token` event with a millisecond timestamp in api.magic_llm, and populate provider TTFT/TPS in `raw_usage`.
  - In the BFF, persist one per-turn latency row with these marks:
    - transcript accepted;
    - admitted;
    - dispatched;
    - api.magic_llm `llm_start`;
    - first delta;
    - first sentence submitted;
    - first audio.
  - Record the model id and version, reasoning tokens, cached and completion tokens, and the real `finish_reason`.
  - Run a synthetic call probe from the production region with the real prompt.
  - Run latency tests with the production launcher (no `--reload`) and as a non-root user.
- **Why:**
  - TTFT has never been measured: `raw_usage` ttft/tps are 0.0 in 19/19 runs (GAP-REAL-DEV-CALL-FORENSICS-07, -12; C13).
  - Root users skip the feature-flag validators (GAP-TOPOLOGY-RTT-MEASUREMENTS-05).
  - Dev Nagle adds about 41 ms per reused request (GAP-TOPOLOGY-RTT-MEASUREMENTS-01).
- **Validation:**
  - A per-turn row exists for 100% of LLM turns.
  - A p50/p95 dashboard per stage and per model.
  - The §2.2 inferences are confirmed or replaced.

**LLM-02: Repair, don't fail, the spoken-text contract**

- **What:**
  1. Compare normalized text on both sides, or forward stripped deltas. Never fail a turn over whitespace.
  2. Before validation, and before the Fish ledger, repair the text: strip `<think>…</think>` and other tag-like markup, asterisk or parenthesis actions, and emoji. Then validate the repaired text. Keep fail-closed only for output that genuinely cannot be spoken.
  3. On any failed turn, exclude the assistant row from history, or truncate it to what was heard.
  4. Add a regression test for each probe string in §2.10.
- **Why:** C10 (BE-LLM-01), C38 (BE-LLM-13), GAP-REAL-DEV-CALL-FORENSICS-01, -02 and -06. The ledger crash fix itself is also a P0 in [08_text_to_speech.md](08_text_to_speech.md). This item owns the LLM-side text repair and the history rule.
- **Validation:**
  - Zero `upstream_contract` and ledger failures in a 200-turn soak.
  - Stored assistant text equals what was spoken or heard.

**LLM-03: Thinking off and a latency contract for the callbot profile**

- **What:**
  - Extend the `callbot` feature contract: require `reasoning_effort: none`, or the provider's minimum where `none` does not exist. Refuse to publish a callbot profile without it.
  - Map the setting per provider:
    - OpenRouter: `reasoning.enabled=false`;
    - Anthropic: `thinking: disabled` with effort ≤ high;
    - Gemini: `minimal`;
    - gpt-oss: `low`.
  - Fix the setting per call so the cache is not invalidated.
  - Assert reasoning tokens = 0, or below a small ceiling for gpt-oss and Gemini, on every turn, and alert otherwise.
- **Why:**
  - C37 (BE-LLM-10).
  - Dev Haiku takes about 1.4-1.85 s to first token (INFERENCE), against 556 ms p50 for Haiku 5.5 with thinking off on aiewf.
  - Haiku 5.5 defaults to adaptive thinking.
- **Validation:** TTFT p50/p95 on the same model before and after, and reasoning tokens = 0.

**LLM-04: Shorter replies, a backstop cap and a real `finish_reason`**

- **What:**
  - Prompt for one or two short sentences, with a "want me to go on?" pattern for long content (LLM-12).
  - After LLM-03 confirms thinking is off, lower the callbot `max_output_tokens` from 1,536 to about 200. Sources range from 90-120 (forensics) and 150-250 (r05) to 300-400 (be-llm). A low cap with thinking on could cut off hidden reasoning, so the order matters.
  - Propagate the provider's `finish_reason` (BE-LLM-17). On `length`, end at the last full sentence.
  - Track the kept fraction (heard over spoken) as a KPI.
- **Why:**
  - GAP-REAL-DEV-CALL-FORENSICS-08: p50 289 characters and 17.6 s of audio, with 12 of 17 replies cut.
  - Verbosity is the largest LLM and TTS cost lever ([r10](evidence/research/r10-cost-scaling-ops.md)).
- **Validation:** reply characters p50, audio seconds p50, interrupted share, kept fraction, and TTS characters per minute.

**LLM-05: Warm, pooled connections and prewarm on every LLM hop**

- **What:**
  - One shared `httpx.AsyncClient` for the callbot in the BFF, as the moderation transport already does, with `keepalive_expiry` around 120 s.
  - One long-lived session and `TCPConnector` per provider in magic-llm, with the DNS cache on and keep-alive of at least 60 s. This covers both the default `AsyncHttpClient` that the live callbot path uses (`magic_llm/engine/openai_adapters/openai_base.py:65`) and the private transport (§2.5 path note).
  - uvicorn `timeout_keep_alive` around 75-120 s on internal services.
  - Prewarm the provider connection at `voice_start` and on client `speech_start`.
  - Cache delegated-auth validation for a short TTL, for example 30-60 s, with revocation in mind (BE-LLM-19).
- **Why:** C09 (BE-LLM-03, BE-STT-04); GAP-TOPOLOGY-RTT-MEASUREMENTS-02 and -07. Provider edges keep idle connections for at least 125 s.
- **Validation:**
  - After the first turn, the share of turns with a new TLS handshake is about 0.
  - The provider connect-time p95 drops.
  - api.auth calls fall from 2 per turn toward 0.

**LLM-06: Deadlines and a bounded retry**

- **What:**
  - Callbot retries: at most 1, only before any output, inside a total budget.
  - A first-token watchdog T1: start at 2.5 s, then tune to the measured p90 plus a margin.
  - A total turn deadline of 10-15 s.
  - Map timeouts to `llm_timeout`. Speak a pre-generated in-character recovery line and keep the call alive.
  - Stop the 10 s keep-alive comments from resetting the BFF's first-token timer.
- **Why:** C07 (BE-LLM-05), K05. Today the worst case is about 92 s of silence, and `llm_timeout` is unreachable.
- **Validation:**
  - No turn waits more than T2 plus the recovery line.
  - `llm_timeout` events are counted and alerted.

### 5.3 P1: weeks

**LLM-07: Voice fast path in api.magic_llm**

- **What:** an ephemeral execution mode for BFF-owned single-node graphs (§4.1, option A):
  - no per-node checkpoints, and one record written after the stream;
  - `[DONE]` sent before post-stream recording;
  - no duplicate interaction admission, since the BFF already admits;
  - delegated auth served from cache;
  - sync DB calls moved off the event loop.

  Keep option C, the BFF calling the provider directly, as an architecture alternative ([16_target_architectures.md](16_target_architectures.md)).
- **Why:** C08 (BE-LLM-02, BE-LLM-21); GAP-TOPOLOGY-RTT-MEASUREMENTS-04 (critical); GAP-REAL-DEV-CALL-FORENSICS-04 and -06.
- **Validation:**
  - api.magic_llm admitted → provider request: p50 under 150 ms.
  - Last token → `[DONE]`: under 100 ms.
  - Binlog per turn falls from 3-8 MB.

**LLM-08: Cache-stable context layout**

- **What:** apply the §4.5 layout:
  - a static system block per call;
  - lorebook moved to a late dynamic block, with activation that stays sticky over the last few user turns;
  - block-wise history windowing instead of per-message trimming, which also removes the O(n²) re-tokenization;
  - OpenRouter `session_id` set to the voice session;
  - Anthropic breakpoints through `provider_options`;
  - a prewarm during ring or greeting.
- **Why:** C34 (BE-LLM-07), C35 (BE-LLM-08), C36 (BE-LLM-09).
- **Validation:**
  - After turn 1, cached tokens are at least 90% of prompt tokens on lorebook calls.
  - TTFT is compared warm versus cold.

**LLM-09: Model and host bake-off**

- **What:** run the §4.4 protocol over the r94 shortlist, plus Gemini 3.6 Flash at `minimal`.
  - Measure from the production region, in EN and ES, at today's and lorebook prompt sizes.
  - Reject any candidate with p95 above about 1.0 s.
  - Publish the winner, and a fallback, per policy tier.
- **Why:** r94 §3.4. Dev model versions and settings are UNKNOWN, and provider estimates exclude our own hops.
- **Validation:** from the production region, the chosen profile's TTFAT is ≤ 0.8 s p50 and ≤ 1.0 s p95, and its refusal and persona-break rates fall within the agreed bounds.

**LLM-10: Hedge and fallback profile**

- **What:**
  - Publish a fallback callbot profile on a different provider.
  - When T1 is missed, hedge to it and use the first stream; cancel the loser.
  - On a pre-output error, fail over instead of retrying blindly.
  - Never hedge every turn.
- **Why:**
  - C07.
  - Long-tail outliers such as Gemma 4's 33.3 s maximum.
  - Preview-model churn on Groq.
- **Validation:** p95 and maximum TTFAT, a hedge rate of 10% or less, and the cost of duplicate prefill.

**LLM-11: Interruption-aware history**

- **What:**
  - Store the heard prefix at word level, using ElevenLabs alignment and the Fish word ledger.
  - Add a per-turn interruption note in the late dynamic block.
  - Drop replies nobody heard, adding a one-line note.
  - Never keep unheard text after completion (C26) or after a supersede that follows `voice_turn_end` (C24).
  - Keep echo out of user turns (C05, [05_turn_taking_and_interruptions.md](05_turn_taking_and_interruptions.md)).
- **Why:** C25, C26, GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-05 (system-prompt note only), and §2.11.
- **Validation:**
  - An offline replay comparing stored assistant text with what was heard.
  - The rate of repeated openers after an interruption.

**LLM-12: Speech-first prompt v3**

- **What:**
  - Pin the reply to the call's configured language, with OpenAI-style switching rules and one language per turn.
  - Keep the first sentence to about 8 words or fewer.
  - Set length by situation, with a continue-offer for long content.
  - Build the tag allow-list from the active TTS profile, in its native form:
    - ElevenLabs v4: English bracket words.
    - Fish: natural-language direction.
  - Use at most 1-2 tags per reply, at sentence start. Remove the MiniMax `(laughs)` / `<#…#>` syntax.
  - Strip tags from history.
  - Keep the per-family variants, and test them on a scripted EN/ES set.
- **Why:** BE-LLM-18; §2.8-2.9; r05 §7; r09; r92.
- **Validation:**
  - First-sentence length p50.
  - Language-switch rate.
  - The share of tags that are performed rather than read aloud.
  - A markup leak rate of zero.

**LLM-13: Guardrails off the LLM critical path**

- **What:**
  - Serve the sentence classifier from a small, fast model on a pooled connection that bypasses the durable path.
  - Check sentence 1 while TTS synthesizes it, and gate its release on the verdict.
  - Run input checks in parallel with the LLM.
  - Coordinate with the SAF recommendations in [14_safety_policy_and_compliance.md](14_safety_policy_and_compliance.md).
- **Why:** C04 (latent launch blocker) and K07.
- **Validation:**
  - With required moderation on, no call is refused and no sentence is skipped for lack of a verdict.
  - Latency added to sentence 1 at p95.

**LLM-14: Policy-tier routing for 18+**

- **What:**
  - Add a persona tier.
  - Map tier → callbot profile in the published catalog:
    - T2 goes to xAI or open weights on Groq, Cerebras or self-hosted.
    - T0/T1 may use Anthropic, OpenAI or Google.
  - Use separate vendor accounts for T2 traffic.
  - If Claude is used, add Anthropic's session-start AI disclosure.
  - Match the TTS lane to the tier.
- **Why:** [r91](evidence/research/r91-gap-g1-vendor-policy-retention-matrix.md) §4 lane table and P0 implication 3.
- **Validation:**
  - A catalog test proves that no T2 persona resolves to a ✘ vendor.
  - The refusal rate is measured on a T2 eval set.

### 5.4 P2: architectural

**LLM-15: Speculative LLM start**

- **What:**
  - Close a candidate segment at a pause of about 250-300 ms, then run STT and the LLM speculatively, keyed by a transcript hash.
  - Release at the confirmed 550 ms silence, or discard and merge.
  - Never persist or bill a speculative turn, and start no TTS before confirmation.
  - Skip utterances longer than about 10 s.
- **Why:** r05 §8 and r01. Only worthwhile after LLM-07, since each discarded run otherwise costs about 32 durable commits. Groq's 10 s minimum billing per STT request makes speculative STT expensive.
- **Validation:** the share of speculations used, the median saving, and the extra STT and LLM cost per minute.

**LLM-16: Rolling summary and post-call memory**

- **What:**
  - Every 20-30 turns, or at about 8k tokens, have a cheaper model write a summary block placed after the system block.
  - Keep the last N turns verbatim.
  - After the call, write a "last time" brief of at most 150 tokens into chat memory.
- **Why:** r05 §11 and r09. Today there is a 100-row, 32k window with no summary.
- **Validation:** prompt tokens stay bounded on long calls, and a continuity eval across calls passes.

**LLM-17: Talker/reasoner split**

- **What:**
  - Route by turn type.
  - Run an async reasoner that updates a scene and memory block in the late dynamic block.
  - Escalate long-form turns behind a short in-character holding line.
- **Why:** §4.12. Useful once the talker is a small model chosen for speed.
- **Validation:** a quality eval against the single-model baseline, with TTFAT unchanged.

### 5.5 P3: experiment or watch

**LLM-18: Latency cues and pre-generated lines (A/B)**

- **What:**
  - Pre-synthesize non-lexical cues per voice, triggered only by T1. Keep them out of history.
  - Pre-generate the greeting and the goodbye, error and "still there?" lines per character, which addresses C53.
  - A/B test against no cue.
- **Why:** §4.9: the evidence is mixed, and the cue only masks latency.
- **Validation:** perceived-latency ratings, and the barge-in rate right after a cue.

**LLM-19: Watch list**

- Self-hosted, PhoneLLM-class models.
- Whether GPT-6 Luna `none` completes reliably.
- Gemini 3.6 Flash at `minimal`.
- RelayS2S and KAME.
- OpenRouter `preferred_max_latency`.
- Anthropic's Usage Policy, effective 2026-11-12.
- Fish S1's retirement on 2026-12-31, after which parentheses are no longer interpreted.

---

## 6. Expected savings roll-up

All rows are estimates for the LLM stage, measured from an accepted transcript to the first sentence ready. Several overlap: a model change and turning thinking off address the same TTFT. Sum ranges with care.

| Lever | Expected saving | Turns affected | Confidence |
|---|---|---|---|
| Voice fast path (LLM-07) | −0.7 to −1.1 s p50 | All | Medium-high (measured dev cost) |
| Thinking off, model and host (LLM-03, LLM-09) | −0.5 to −1.3 s | All | Medium (the current reasoning setting is UNKNOWN) |
| Warm pooled connections (LLM-05) | About −0.09 s p50; removes 0.5-1.5 s stalls | All, plus ~16% with stalls (dev network) | High for the mechanism |
| BFF per-call caching and lighter admission | −30 to −150 ms (part of the 60-100 ms DB tax plus per-turn context reads) | All | Low-medium |
| Short first sentence and clause-level first chunk (LLM-12, TTS-04) | −0.1 to −0.6 s | Turns with long first sentences | Medium |
| Cache-stable prompt (LLM-08) | 0 in dev; UNKNOWN on lorebook or long calls | Lorebook and long-history calls | Low |
| Moderation overlap (LLM-13) | Avoids up to 300 ms, and a text-only failure | All, once moderation is required | Medium |
| Speculation (LLM-15) | −0.25 to −0.5 s | Confirmed speculative turns | Low (literature only) |
| Supersede path ([05_turn_taking_and_interruptions.md](05_turn_taking_and_interruptions.md)) | Up to 0.7-6.4 s | Overlap turns (4/19 in dev) | High (measured waits) |
| Deadlines (LLM-06) | Worst case about 92 s → about 5 s | Provider stalls | High |
| **LLM stage overall** | **About 2.5-3.3 s → 0.8-1.0 s p50** | | Medium |

Cost note: the LLM is about one-tenth of TTS cost per call minute when the prompt is cached, and reasoning tokens are billed as output (r10). Thinking off and shorter replies therefore cut latency and cost together.

---

## 7. Open questions

1. **Production profile.** What are the callbot model, version, `reasoning_effort`, `provider_options` and route (OpenRouter or direct)? All UNKNOWN; LLM-01 and LLM-03 depend on them.
2. **Production topology.** Are the BFF, api.magic_llm, api.auth and MySQL co-located? Which launcher and DB durability settings are used? Dev runs on a shared, saturated MySQL (GAP-TOPOLOGY-RTT-MEASUREMENTS-06).
3. **Disconnect behaviour.** Do OpenRouter and the model host stop generating and billing when the client disconnects on barge-in?
4. **Contract failure rate.** How often do the chosen models emit leading or trailing whitespace, `<think>` blocks or asterisk actions? This sets how often C10 and C38 fire.
5. **Hidden reasoning in usage.** Do dev completion tokens include hidden reasoning? The 1.6-2.3 characters-per-token ratio is only a hint.
6. **Haiku version.** Which Haiku version and settings did dev use? Neither is recorded.
7. **Gemini caching.** Does Gemini 3.5 Flash-Lite cache at about 2k tokens? It is not in the caching table (unverified).
8. **Spanish audio tags.** Do ElevenLabs v4 English tag words perform reliably inside Spanish replies? r92 calls this untested.
