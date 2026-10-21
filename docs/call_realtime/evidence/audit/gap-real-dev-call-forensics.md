# Gap: forensics of the 8 real dev voice calls (MySQL)

Subsystem: real dev call forensics, from the BFF `magic_worlds` DB and the api.magic_llm `magic_messages` DB.
Finding prefix: `GAP-REAL-DEV-CALL-FORENSICS-`.
Labels: **FACT** (read from DB rows or code), **INFERENCE** (deduced from facts), **UNKNOWN** (needs data we do not have).
No transcript or reply text is quoted anywhere in this note. Only lengths, statuses, flags and timestamps appear.

---

## 0. TL;DR

### Q1: real per-stage timings

- **MLLM pre-provider recording.** FACT, measured over 19 LLM turns at ms resolution: 768-1233 ms, p50 898. This is the time from MLLM admission to the provider call.
  - `be-llm.md` §9 stage 13 estimated 100-600.
  - `e2e-latency-trace.md` stages 12+13 estimated 50-300 typical.
- **Provider window** (from `llm_start` to `llm_end`): 1649-3885 ms. It covers TTFT, generation and the post-stream OpenRouter usage poll.
  - The fixed cost is about 1.85 s for Haiku (regression intercept), at about 239 tok/s.
- **Post-LLM tail:** 1.0-2.5 s.
- **STT** (Groq whisper-large-v3): p50 526 ms, p90 868 ms, range 422-1481 ms.
- **BFF pre-LLM overhead:** 208-400 ms.
- **Supersede waits:** 0.7-6.4 s in 4 of 19 turns. This contradicts the "rare" downgrade of E2E-LATENCY-TRACE-07.
- **User-stop to first audio:** INFERENCE, about 4-6 s. The estimate was 2.6-4.0 s. No first-audio or TTFT timestamp is persisted anywhere.

### Q2: five user segments failed with `internal`

- **fe6100 s1 and s3** (Fish lane). FACT, root cause reproduced.
  - The reply contained markup. `_fish_spoken_text` cleaned the sentence.
  - `WordCallTurnLedger.mark_flushed` then raised `ValueError` ("exact original source geometry"). The speaker task died silently.
  - The error surfaced only at `speaker.finish()` after the LLM ended, and `_fail_turn` recorded `internal`.
- **c84998 s1 and c515d1 s1, s2.** FACT: each failed before MLLM admission, with no plan row, no messages and no Fish attempt.
  - The cause is a non-`VoiceOrchestrationError` exception inside `CallbotExecutionService.execute`, before the admission commit.
  - The exact exception is UNKNOWN. The traceback exists only in the PyCharm console.

### Q3: EL call 890eb3 ended `failed/internal`

- FACT: this outcome is only reachable through the `voice_call_ws` exception branches, via `release_socket(failure_category="internal")`.
- Turn 4's audio was fully billed by 22:23:45, but the turn finished only at 22:24:07. The call failed in that same second.
- INFERENCE: an exception in the WS receive loop at that moment. Candidates are a pong send failure, a `RuntimeError` from `receive_json` after a failed engine send, or an exception in `end_call`/`barge_in`/`report_playback`.
- The exact exception is UNKNOWN.

### Q4: 1c5bef s1 stuck `accepted`

- FACT: this is BE-STT-03 in real data.
  - The segment has no `stt_summary`, and its STT seconds were not billed.
  - The next segment was admitted 18 s later under the intake lock, so the STT call failed fast and did not hit the 30 s timeout.

### Q5: the three `disconnected` ends

- INFERENCE: mostly the FE-UI-11 navigation path.
  - On unmount the FE closes the WS with code 1000 and does not send `voice_end` first. The server immediately stores `disconnected`.
  - Gaps of 10-11 s (bcf13a, fe6100) and about 60 s (c515d1) after the last activity fit user navigation.
- The 20 s grace path cannot be excluded without the `[VOICE_DISCONNECT] ... code=` log line.

---

## 1. Scope and method

- **Data sources** (FACT, all read-only: `SET SESSION TRANSACTION READ ONLY`, then a rollback):
  - BFF `magic_worlds`:
    - `voice_session` (8 rows), `voice_transcript_segment` (user and assistant rows)
    - `adventure_message` (lengths only), `tb_llm_execution_plan` (`feature_key='callbot'`)
    - `speech_provider_attempt`, `lorebook_attachment` (0 rows)
  - MLLM `magic_messages`:
    - `tb_interaction` (admitted, started, finished)
    - `tb_execution` (llm_request started and completed)
    - `tb_execution_event` (`graph_start`, `node_start`, `llm_start`, `llm_end`, `graph_end`, ...)
- **Resolution.** BFF columns are `DATETIME` at second resolution. `CURRENT_TIMESTAMP` truncates, so every BFF instant is known only to within 1 s. MLLM tables have ms resolution. All times below are UTC (the dev host is CST = UTC-6).
- **Joins** (FACT):
  - BFF turn: `turn_id` = `tb_llm_execution_plan.execution_id`.
  - MLLM run: `admitted_at` ≈ plan `created_at` (within 2 s, no ambiguity in this data set).
  - Per-turn BFF overhead is an interval (`[lo, hi]`), because the segment `created_at` is truncated.
- **Process context** (FACT):
  - The BFF runs uvicorn `--reload`. The worker that served 9ff8d8 onward started at 21:48:40 UTC. c515d1 and bcf13a ran on the previous worker, which reloaded around 20:49-20:54 UTC.
  - The api.magic_llm worker has run since Oct 19 19:19 UTC with no reloads.
  - Logs go only to the PyCharm stdout pipe. There are no log files.
- **Tools** (scratch only, outside the repo):
  - `q.py`, a read-only pymysql helper.
  - `build_table.py`, which joins the data and builds the timing table.
  - `probe/fish_asterisk_probe.py`, which reproduces Q2.
  - All of them live under `/tmp/claude-1000/-home-andres-WebstormProjects-magic-worlds/9c4c3da7-06b7-4cee-a58b-d2b1e4f9477c/scratchpad/forensics/`.
- No source file was modified.

---

## 2. Observed architecture: one turn as the data shows it

1. **Browser.** The AudioWorklet energy VAD closes a segment after 550 ms of silence (`src/features/call/components/CallScreen.tsx:114`).
   - The segment is uploaded as WAV PCM16, 16 kHz mono (`vad_summary.validation_source = wav_pcm16`).
2. **BFF intake** (`_intake_segment`, `engine.py:2112-2284`), under `intake_lock`:
   - It creates the segment row, acks, validates, and sets `accepted` (`engine.py:2205`).
   - It runs Groq STT (`engine.py:2228`, no try/except) and bills STT, then marks the segment `completed`.
3. **Supersede.** If the previous turn is still running, `accept_segment` cancels it and awaits `previous.finished` (`engine.py:2072-2074`).
4. **Voice turn** (`_run_voice_turn`, `engine.py:2292-2805`):
   - `llm_runner.stream_turn` calls `CallbotExecutionService.execute` (`callbot_execution.py:177-254`).
   - That calls `execute_conversation_turn`, which runs the admission transaction and writes `tb_llm_execution_plan` (`conversation_execution.py:89-240`).
   - The BFF then POSTs to api.magic_llm. The magic-agents native graph writes durable events for every step, and magic-llm streams from OpenRouter.
5. **Deltas to TTS.**
   - Deltas go into `SentenceBuffer`. A sentence boundary needs whitespace after the punctuation (`sentence_buffer.py:154-180`).
   - A 120 ms idle tick releases a finished final sentence (`engine.py:88`, `engine.py:2563-2569`).
   - Each span goes through the `ElevenLabsTurnSpeaker`, which serves both the EL and Fish lanes (`call_tts_elevenlabs.py:228-265`).
   - The provider is either the EL multi-context WS or the Fish timestamp WS. The Fish lane holds a DB lease row in `speech_provider_attempt`.
   - Audio reaches the client as base64 MP3 frames over the voice WS.
6. **Turn end.** `speaker.finish()` (`engine.py:2637`) runs, then truncation to the heard prefix, then the assistant segment and message are persisted.
   - Any exception lands in `_fail_turn` (`engine.py:3103-3160`). A non-VOE exception becomes `internal`, and the user segment is updated to `failed` with `tts_summary={"audio_chunks": n, "status": "failed"}`.
   - The error frame is `fatal=False`, so the call continues.

### Config and defaults that shaped the data

| Setting | Value | Evidence |
|---|---|---|
| VAD silence to end of segment | 550 ms | `src/features/call/components/CallScreen.tsx:114` |
| WS heartbeat (client) | 25 s | `src/infrastructure/api/voiceSocket.ts:20` |
| Resume grace after a non-1000 close | 20 s | `voice_orchestration/config.py:45` |
| Close codes that end immediately | {1000} | `engine.py:100`, `engine.py:1028` |
| End-call drain | 2.0 s | `engine.py:90` |
| Truncation window grace and wait | 2000 ms and 3.0 s | `engine.py:108-109` |
| EL billing write interval | 2000 ms of delivered audio | `engine.py:117`, `engine.py:2507` |
| Idle flush of a finished sentence | 0.12 s | `engine.py:88` |
| SentenceBuffer soft cap | 160 chars | `sentence_buffer.py:18` |
| Fish unsafe-text regex | `[*_#~\[\]<>|`()]` plus emoji ranges | `engine.py:3593` |
| Fish push cap | 1200 chars | `speech/providers/fish_audio/streaming.py:106-112` |
| Callbot catalog TTL | 60 s | `callbot_execution.py:91` |
| Call limits (rows) | max 600 s, idle 120 s | DB `voice_session` |

---

## 3. Call inventory (FACT, DB `voice_session`)

| Call | TTS | Started (UTC) | Duration | Consumed s | User segments | Status / end_reason |
|---|---|---|---|---|---|---|
| c84998 | fish_audio_streaming | Oct 19 23:48:33 | 9 s | 2 | 2 (s1 failed internal, s2 cancelled end_call) | ended / user |
| c515d1 | fish | Oct 20 21:37:31 | 85 s | 2 | 2 (both failed internal) | ended / disconnected |
| 18b5b0 | fish | 21:39:29 | 3 s | 0 | 0 | ended / user |
| bcf13a | fish (Sonnet profile) | 21:39:46 | 92 s | 90 | 4 completed | ended / disconnected |
| 9ff8d8 | fish | 21:53:12 | 70 s | 89 | 5 completed | ended / user |
| fe6100 | fish | 22:19:28 | 52 s | 21 | 3 (s1 and s3 failed internal, s2 completed) | ended / disconnected |
| 1c5bef | fish | 22:20:52 | 64 s | 48 | 4 (s1 stuck accepted, s2-s4 completed) | ended / user |
| 890eb3 | elevenlabs_streaming (consent voice-v2) | 22:22:55 | 72 s | 65 | 4 completed | **failed / internal** |

Totals:

- **Segments:** 24 user segments. 23 had STT completed. 19 reached the LLM, and 17 produced assistant audio.
- **Failures:** 5 failed with `internal` (3 before admission, 2 in the Fish ledger), 1 is stuck `accepted`, and 1 was cancelled by end_call.
- **By call:** 3 of 8 calls had at least one internal turn failure, and 1 call itself failed as internal.
- **Same character:** all calls used the same character card.

---

## 4. Per-turn timing (FACT, except where marked)

Columns:

- `seg→admit` is the interval from the segment row to MLLM `admitted_at`. It is a [lo, hi] range because of second resolution.
- `pre` is from MLLM admitted to `llm_start`.
- `prov` is from `llm_start` to `llm_end`.
- `tail` is from `llm_end` to interaction finished.
- `msg/reply` is the stored message length over the LLM reply length. A smaller message means the reply was truncated to the heard prefix.

| Call.seq | Clip ms | STT ms | seg→admit ms | pre | prov | tail | MLLM total | Model | ct | Reply chars | msg/reply | Audio ms | Outcome |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| c84998.1 | 924 | 674 | - | - | - | - | - | - | - | - | - | - | failed internal, pre-admission |
| c515d1.1 | 908 | 761 | - | - | - | - | - | - | - | - | - | - | failed internal, pre-admission |
| c515d1.2 | 892 | 459 | - | - | - | - | - | - | - | - | - | - | failed internal, pre-admission |
| bcf13a.1 | 1156 | 451 | 618-1618 | 990 | 2756 | 1595 | 5341 | sonnet | 105 | 211 | 92/211 | 15386 | ok, cut |
| bcf13a.2 | 1340 | 422 | **5816-6816** | 1233 | 3885 | 2483 | 7601 | sonnet | 235 | 514 | 95/514 | 24163 | ok, cut (supersede wait) |
| bcf13a.3 | 2044 | 520 | 414-1414 | 958 | 2398 | 1909 | 5265 | sonnet | 110 | 242 | full | 21420 | ok |
| bcf13a.4 | 1260 | 453 | 43-1043 | 847 | 2795 | 1797 | 5439 | sonnet | 130 | 289 | full | 22727 | ok |
| 9ff8d8.1 | 2092 | 585 | 793-1793 | 777 | 1649 | 1031 | 3457 | haiku | 52 | 84 | 79/84 | 7784 | ok, cut |
| 9ff8d8.2 | 1236 | 576 | 780-1780 | 1042 | 2951 | 2291 | 6284 | haiku | 262 | 615 | 56/615 | 15882 | ok, cut |
| 9ff8d8.3 | 1660 | 526 | 298-1298 | 809 | 2272 | 1576 | 4657 | haiku | 174 | 386 | 127/386 | 20402 | ok, cut |
| 9ff8d8.4 | 1700 | 474 | 609-1609 | 904 | 2040 | 1617 | 4561 | haiku | 144 | 326 | 109/326 | 18939 | ok, cut |
| 9ff8d8.5 | 1564 | 1017 | 1182-2182 | 898 | 2965 | 2143 | 6006 | haiku | 140 | 317 | full | 17554 | ok |
| fe6100.1 | 1356 | 553 | 509-1509 | 939 | 2389 | 2001 | 5329 | haiku | 126 | 283 (markup) | full, unheard | 0 | **failed internal, Fish ledger** |
| fe6100.2 | 900 | 468 | 584-1584 | 768 | 2127 | 1369 | 4264 | haiku | 96 | 214 | 79/214 | 16039 | ok, cut |
| fe6100.3 | 1516 | 505 | 8-1008 | 864 | 2956 | 2560 | 6380 | haiku | 274 | 637 (markup) | full, unheard | 2 chunks | **failed internal, Fish ledger** |
| 1c5bef.1 | 1932 | none | - | - | - | - | - | - | - | - | - | - | stuck accepted (BE-STT-03) |
| 1c5bef.2 | 836 | 456 | 0-856 | 1034 | 2546 | 1150 | 4730 | haiku | 60 | 111 | 91/111 | 8411 | ok, cut |
| 1c5bef.3 | 1316 | 868 | 781-1781 | 775 | 3069 | 2272 | 6116 | haiku | 183 | 416 | 160/416 | 23118 | ok, cut |
| 1c5bef.4 | 1308 | 562 | **4418-5418** | 970 | 3706 | 1920 | 6596 | haiku | 131 | 299 | full | 12487 | ok (supersede wait) |
| 890eb3.1 | 916 | 1481 | 1561-2561 | 838 | 2031 | 1235 | 4104 | haiku | 60 | 122 | 74/122 | 8777 | ok, cut |
| 890eb3.2 | 1276 | 494 | 589-1589 | 835 | 2429 | 2374 | 5638 | haiku | 229 | 497 | 190/497 | 17789 | ok, cut |
| 890eb3.3 | 1340 | 472 | **1219-2219** | 871 | 1814 | 1582 | 4267 | haiku | 107 | 252 | 110/252 | 14576 | ok, cut (supersede wait) |
| 890eb3.4 | 1756 | 556 | **2451-3451** | 930 | 1802 | 1331 | 4063 | haiku | 111 | 227 | full | 17633 | ok (supersede wait, then 22 s end stall) |

c84998.2 is omitted: STT took 610 ms, then the segment was cancelled by end_call.

### 4.1 Stage distributions vs prior estimates

| Stage | Measured | Prior estimate | Verdict |
|---|---|---|---|
| Clip length | 836-2092, p50 1316 | - | short utterances |
| Groq STT | n=23: min 422, p50 526, p90 868, max 1481, mean 606 | e2e stage 7: 350-800 typical (`e2e-latency-trace.md:181`); be-stt 150-500 p50 (`be-stt.md:196`) | e2e is right; be-stt is optimistic |
| BFF pre-LLM (segment row to MLLM admitted, minus STT; 15 non-superseded turns) | intersection of the per-turn intervals: **[208, 400] ms** | e2e stage 11: 10-40 typical (`e2e-latency-trace.md:185`) | higher; it includes intake bookkeeping, STT billing, `prepare_context` and the admission transaction |
| MLLM admitted to interaction started | 65-137 | e2e stage 12: 50-150 | consistent |
| MLLM pre-provider (admitted to `llm_start`) | n=19: min 768, p50 898, p90 1034, max 1233, mean 910 | e2e stages 12+13: 50-150 + 60-150 (`e2e-latency-trace.md:186-187`); be-llm stage 13: 100-600 (`be-llm.md:335`) | **5-10x above e2e, about 2x above be-llm** |
| Last pre-provider durable event to `llm_start` | 27-81 | - | the handshake share is small; recording dominates |
| Durable events per run | 66 total, 39 before `llm_start`, 127-209 KB of event payload | be-llm: "about 16 native commits plus about 19 hook writes" | confirmed in count |
| Provider window (Haiku, n=15) | min 1649, p50 2389, p90 3069, max 3706 | not modelled as one stage | regression intercept about 1850 ms, about 239 tok/s |
| Provider window (Sonnet, n=4) | 2398-3885 | - | intercept about 1482 ms, about 98 tok/s |
| MLLM tail (`llm_end` to finished) | n=19: min 1031, p50 1797, p90 2374, max 2560; of which `llm_end` to run completed is 1008-2528 and run completed to finished is 20-71 | be-llm post-stream tail 200-1000 (`be-llm.md:347`) | **about 2x above** |
| MLLM total | 3457-7601, p50 5329 | - | - |
| Prompt tokens | 1698-1948 | - | the history grows slowly |
| Cached prompt tokens | 0 on each call's first LLM turn, then 1694-1869 | - | prefix caching works |
| Completion tokens | 52-274, p50 130 | - | - |
| Reply length | 84-637 chars, p50 289 | - | long for voice (finding 08) |
| Assistant audio | 7.8-24.2 s, p50 17.6 s | - | - |
| Segment row to assistant persisted | 5-35 s, p50 15 | - | dominated by audio length, not latency |
| `raw_usage` ttft, tps, ttf | all `0.0` | - | **TTFT is never measured** |

### 4.2 User-stop to first audio (INFERENCE)

No first-token or first-audio timestamp is persisted.

- `tb_execution_event` has `llm_start` and `llm_end` but no first-delta event.
- The BFF segment rows carry no per-turn latency.
- `voice_llm_first_delta` and `voice_first_assistant_audio` go to logs and process-local histograms only (`e2e-latency-trace.md:427`).

Composition for a typical non-superseded Haiku turn:

| Step | Estimate (ms) |
|---|---|
| VAD hangover | 550 |
| Upload (LAN) | ~50 |
| STT | ~530 |
| BFF pre-LLM | ~300 |
| MLLM pre-provider | ~900 |
| Provider TTFT: the ~1850 intercept minus the 100-600 usage poll | ~1250-1750 |
| First sentence at ~239 tok/s | ~100-200 |
| Fish or EL first audio (`e2e-latency-trace.md:245`) | ~700-1200 |
| **Total** | **about 4.4-5.4 s** |

- A superseded turn adds another 0.7-6.4 s.
- The e2e "typical 2.6-4.0 s" (`e2e-latency-trace.md:201`) is optimistic, mainly because of the MLLM pre-provider stage and the provider fixed cost.

### 4.3 What the MLLM tail does and does not delay (FACT)

- **Not the first audio, and normally not the last sentence.**
  - The engine wraps the event stream in `_with_idle_ticks(..., 0.12)`.
  - On an idle tick it releases a sentence that already ends in punctuation (`engine.py:88`, `engine.py:2563-2569`; `sentence_buffer.py:92-113`).
- **It does delay four things**, because they wait for `VoiceLlmTurnCompleted` (`engine.py:2620-2629`):
  - `speaker.finish()`, and with it turn completion and the persists;
  - `previous.finished`, so it adds directly to supersede waits;
  - any final text that does not end in `.`, `!` or `?` plus a closer. `'*'` is not a closer (`sentence_buffer.py:21`).

### 4.4 Supersede waits (FACT, measured)

A turn whose MLLM admission came 0-1 s after the previous assistant segment persisted waited on `await previous.finished.wait()` (`engine.py:2072-2074`):

| Turn | Wait (BFF pre-LLM interval minus the normal ~0.2-0.4 s) |
|---|---|
| bcf13a.2 | 5.4-6.4 s |
| 1c5bef.4 | 3.9-4.9 s |
| 890eb3.4 | 1.9-2.9 s |
| 890eb3.3 | 0.7-1.7 s |

- That is 4 of 19 LLM turns, in 3 of 5 multi-turn calls.
- E2E-LATENCY-TRACE-07 was downgraded to "rare worst case" (`e2e-latency-trace.md:424`). Real use contradicts that: users talk over long replies, and every such turn pays for the previous turn's MLLM tail, finish and truncation before its own LLM call starts.
- This matches the mechanism described in GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-06.

### 4.5 Truncation and history (FACT)

- **Truncation rate.** 12 of 17 audio turns were cut to the heard prefix. The kept fraction ranges from 9% to 94% (adventure_message lengths vs LLM reply lengths).
- **Next-turn history.** It carries the heard prefix, which is correct. This was checked against plan `n_msgs` and message lengths.
- **Asset transcript mismatch.** In 4 turns, the assistant segment or asset transcript keeps the full reply while the stored message is truncated:
  - bcf13a.1 (211 vs 92), 9ff8d8.1 (84 vs 79), 1c5bef.2 (111 vs 91), 890eb3.1 (122 vs 74).
  - All 4 are the first LLM turn of their call. The cut was applied after the asset was persisted. This is the signature described in GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-07.
- **Failed Fish turns.** The two failed Fish turns (messages 534 and 538) are stored `completed` at full length (283 and 637), although 0 and about 2 chunks were heard. Finding 02 covers this.

---

## 5. Root causes

### 5.1 fe6100 s1 and s3: the Fish word-ledger geometry crash (FACT, reproduced)

**Chain:**

1. The callbot prompt forbids asterisk actions and markdown (`agent_graphs/runtime/callbot_chat.v2.json:18-20,37`). Even so, 2 of 15 Haiku replies used asterisks. Messages 534 and 538 are the only replies with `*` in this data set (FACT, `plan_summary` flags).
2. `transcript_sanitizer` accepts markdown in spoken text (`transcript_sanitizer.py:84-90`), so the contract check passes.
3. On the Fish lane, `prepare()` routes each sentence through `_fish_spoken_text` (`engine.py:2382-2390`, `engine.py:3596-3616`).
   - When `_FISH_UNSAFE_TEXT` matches, the text is replaced by `sanitize_speech_text(...).moderation_text`, which is cleaned.
   - The compiled plan's `logical_text` is that cleaned text (`speech/providers/fish_audio/performance_compiler.py:137-242`).
4. `ElevenLabsTurnSpeaker._push` (`call_tts_elevenlabs.py:228-265`) calls `ledger.mark_flushed(index, sent_chars=..., mapped=prepared)` at `:249`, before `push_text` at `:251`.
5. `WordCallTurnLedger.mark_flushed` raises `ValueError('Call word timing requires exact original source geometry')` whenever `mapped.logical_text != source_text[index]` (`call_word_ledger.py:32-35`).
6. The `_push` task dies. Nothing reaches Fish, and the error is not observed until `speaker.finish()` awaits the task (`call_tts_elevenlabs.py:126-130`, `engine.py:2637`), after the LLM stream completes.
7. `_fail_turn` maps the non-VOE `ValueError` to `internal` (`engine.py:3103-3116`). It writes the user segment `failed`, `tts_summary.audio_chunks = n`, and sends a non-fatal error frame.

**DB corroboration (FACT):**

- fe6100.1: 0 chunks. The Fish attempt has 0 units and was released at 22:19:34. The LLM ended at 22:19:36.8, so the user heard silence for the whole MLLM run (5.3 s) and then got an error.
- fe6100.3: 2 chunks. The first span (20 chars, no markup) was flushed and spoken. The second span (115 chars, with markup) raised. The attempt has 21 units, released at 22:20:05. The LLM ended at 22:20:09.4.
- The Fish 1200-char cap was not involved (the max reply was 637).

**Probe (FACT):** `probe/fish_asterisk_probe.py` drives the real `SentenceBuffer`, `_fish_spoken_text`, `prepare_performance` and `WordCallTurnLedger`.

| Case | Result |
|---|---|
| Leading aside | span #0 (46 chars) raises `ValueError` |
| Mid aside | span #0 (20 chars) flushes, span #1 (115 chars) raises |
| Plain text | passes |

**Test gap (FACT):**

- `tests/voice/test_fish_call_engine.py:148-162` tests the cleaning in isolation.
- `tests/voice/test_call_word_ledger.py:43` asserts that a mismatch raises.
- No test sends a cleaned sentence through the Fish speaker with a word ledger.

**Side effect (FACT):**

- The failed reply (283 chars, with markup) stays `completed` and appears in the next turn's LLM history: plan `30a0f169` has 4 history messages, assistant 83, user 11, assistant 283 with markup, user 11.
- INFERENCE: this may reinforce the forbidden style in the following replies of the same call.

### 5.2 c84998 s1, c515d1 s1, c515d1 s2: pre-admission internal failures (root cause UNKNOWN)

**FACT:**

- STT completed for all three.
- There is no `tb_llm_execution_plan` row, no new `adventure_message` row (`conversation_version` stays 1), no `tb_interaction` and no Fish attempt.
- `tts_summary` is `{status: failed, audio_chunks: 0}`, which is the signature of `_fail_turn`.
- The error was therefore raised by the producer before the admission commit, as a non-`VoiceOrchestrationError`.
- `CallbotExecutionService.execute` maps only `ProfileError` and `LlmExecutionTransportError` (`callbot_execution.py:177-254`, `:79-85`). Everything else propagates and becomes `internal` (`engine.py:3103-3116`).
- Code reached in that window:
  - `get_scoped_session`
  - `prepare_context` / `_resolve_callbot_chat_context` (prompt and codex)
  - the workflow build and catalog cache (60 s TTL, `callbot_execution.py:91`)
  - `find_admission` and the admission transaction in `conversation_execution.py:89-240`.

**Excluded (FACT):**

| Hypothesis | Why it is excluded |
|---|---|
| BE-LLM-01 / BE-LLM-13 (spoken-contract or padded failures) | no plan row, and no padded replies anywhere |
| Fish admission or the 1200-char cap | no attempt row |
| `VoiceLlmTurnContext` validation | constructed before the try; validators raise `ValueError` (`llm_turn_runner.py:14-41`), but the inputs were valid STT text |
| VOE "Voice turn did not complete." at `engine.py:2643` | requires `user_message_persisted`, and no message exists |
| Lorebook | `lorebook_attachment` has 0 rows |
| Profile errors | they would map to a non-internal category |
| A code or profile change | c515d1 and bcf13a ran on the same worker 2 minutes apart, and bcf13a succeeded |
| "First call after a restart" as a deterministic cause | 9ff8d8 was the first call after the 21:48:40 UTC reload and succeeded |

**INFERENCE:** a transient or state-dependent exception, for example a stale pooled DB connection, a catalog fetch race, or a context-resolution error on a fresh adventure.

- c84998 and c515d1 were the first voice turns on their adventures (95 and 97).
- c515d1 was most likely the first voice call on its worker.
- This cannot be decided from the DB.

**To settle it:** search the PyCharm console for `[VOICE_INTERNAL] voice turn failed voice_session_id=c515d1b0-...` around 21:37:35-21:37:57 UTC (15:37 local) on Oct 20, and for `c8499880-...` around 23:48:35 UTC on Oct 19. The traceback is logged by `logger.exception` at `engine.py:3116`.

**Billing (FACT):** these two calls produced no assistant audio, yet each still recorded `consumed_seconds = 2` (the STT audio). The earlier credit-ledger read showed a 1-credit charge each.

### 5.3 890eb3: EL call ended failed/internal (exception UNKNOWN)

**FACT:**

- `status='failed'`, `end_reason='internal'`. That combination is written only by `release_socket(..., failure_category=...)` (`engine.py:1043-1068`).
- `release_socket` is called only by `_end_failed_socket_call` (`route_voice_call.py:1605-1628`).
- `_end_failed_socket_call` is called from three `voice_call_ws` exception branches (`route_voice_call.py:1572-1598`):
  - `HTTPException` that is not a 404 or workspace error
  - `VoiceOrchestrationError` with category `internal`
  - generic `Exception`, which logs `[VOICE_INTERNAL] voice call failed ... error_type=...` at `:1591-1595`.

**Timeline (FACT, second resolution):**

| Time (UTC) | Event |
|---|---|
| 22:23:32 | Segment 4 created; STT done at :33 |
| 22:23:34.5-35.5 | MLLM admission; it waited for turn 3 to finish |
| 22:23:39.6 | LLM done (MLLM total 4063 ms) |
| 22:23:45 | Last `last_heartbeat_at`, which is the last EL billing write (`engine.py:2507`, `engine.py:3441-3455`). All 17.6 s of turn-4 audio had been delivered and billed |
| 22:24:07 | Turn 4 assistant segment persisted `completed`; message 554 stored at full length (227 = reply) |
| 22:24:07 | Session `ended_at` |

**INFERENCE:**

- **The 22 s stall.** It sits between the last delivered audio and turn completion. That matches EL's 20 s input-inactivity close of the multi-context WS while `speaker.finish()` waited for the context's final message.
- **Candidate exceptions in the route loop** (`route_voice_call.py:1492-1548`) at 22:24:07:
  - a. A pong send failure. `delivery.send_frame` wraps any exception into `VoiceDeliveryDisconnected(ConnectionError)` (`delivery.py:162`, `:212-231`), which the generic branch treats as `internal`. The same mechanism is described in GAP-SEGMENT-POST-AND-CONTROL-PLANE-UNKNOWNS-03.
  - b. `receive_json` raising `RuntimeError` after an engine-side send had failed and set the application state to DISCONNECTED (GAP-SEGMENT-POST-AND-CONTROL-PLANE-UNKNOWNS §2.5).
  - c. An exception from `engine.end_call` (user hang-up during the stall), `barge_in` or `report_playback`.
- (c) is consistent with the end happening in the same second as turn completion. The exact class is UNKNOWN.

**To settle it:** search the console for `[VOICE_INTERNAL] voice call failed session_id=104 error_type=` around 16:24:07 local, and for any EL close or `input_timeout` line for this voice session.

### 5.4 1c5bef s1: stuck `accepted` (BE-STT-03 confirmed in real data)

**FACT:**

- Status `accepted`, `stt_summary` NULL, `error_category` NULL, `tts_summary` NULL, clip 1932 ms.
- STT billing for the call is 3460 ms = 836 + 1316 + 1308, which excludes this clip.
- `engine.py:2205` sets `accepted` before STT, and `engine.py:2228` has no try/except (`be-stt.md:228`, `be-stt.md:384`).
- s2 was created 18 s later. Intake is serialized under `intake_lock`, so the s1 STT call ended (failed) in under 18 s. It was a fast failure, not the 30 s timeout.
  - `_raise_http_status` would log `voice STT provider HTTP %s` (`stt_groq_client.py:517-522`).
  - A transport error maps to `provider_submission` (`stt_groq_client.py:99-108`).
  - Either way, the segment row is never updated.

**INFERENCE:** the user heard nothing and repeated the greeting. s2 has the same transcript length class (11 chars) as other greetings.

### 5.5 The three `disconnected` ends

**FACT (code):**

- FE unmount runs `stopLocalResources({closeSocket: true})`, which closes with code 1000 (`voiceSocket.ts:255-266`).
- Only after that does it send the keepalive HTTP `endVoiceCall(reason:'user')` (`useVoiceCallController.ts:1201-1212`). It never sends `voice_end` over the socket first.
- The server's receive loop gets `WebSocketDisconnect(1000)`. `socket_disconnected` ends the call immediately as `disconnected` (`engine.py:1012-1033`, `engine.py:100`), so the later HTTP end is a no-op.
- `pagehide` does send `end()` first (`useVoiceCallController.ts:1180-1199`).
- `leave()` races `endCall()` against a 400 ms timer and then navigates (`CallScreen.tsx:199-209`). This is FE-UI-11 (`fe-ui.md:381`).
- A non-1000 close would instead arm the 20 s grace (`config.py:45`) and end through `_end_after_grace` (`engine.py:1838`).

**FACT (data):**

| Call | Last activity | `ended_at` | Gap |
|---|---|---|---|
| c515d1 | last failed turn 21:37:56 | 21:38:56 | ~60 s |
| bcf13a | turn 4 persisted 21:41:08; INFERENCE: reply playback ended about 21:41:16 | 21:41:18 | ~10 s |
| fe6100 | failed turn 3 at about 22:20:09.4 | 22:20:20 | ~11 s |

- The turn-failure frame is non-fatal (`engine.py:3118-3123`), and the FE closes only on fatal categories (`useVoiceCallController.ts:162-166`, `:889-892`). So the failures did not themselves close the socket.

**INFERENCE:**

- For bcf13a and fe6100, the 10-11 s gaps are shorter than the 20 s grace, so a grace end would need the socket to drop while the turn was still running. That makes the 1000 navigation path the likely one.
- For c515d1, after two silent failures, either path fits.
- `disconnected` therefore conflates "user left the call screen" with "network lost", and the close code is only logged (`route_voice_call.py:1565`), never stored.

---

## 6. Latency contributors (summary)

| Stage | ms | Evidence | Notes |
|---|---|---|---|
| VAD end-of-speech hangover | 550 (constant) | `src/features/call/components/CallScreen.tsx:114` | fixed tax on every turn |
| Upload | UNKNOWN | - | not persisted |
| Groq STT | 422-1481 (p50 526, p90 868) | DB `stt_summary.latency_ms`; `engine.py:2228` | serial; batch-only |
| BFF pre-LLM | 208-400 | DB intervals; `conversation_execution.py:89-240` | intake, billing, context, admission tx |
| Supersede wait | 0, or 700-6400 in 4/19 turns | `engine.py:2072-2074` | waits for the previous turn's finish, tail and truncation |
| MLLM admit to start | 65-137 | MLLM `tb_interaction` | - |
| MLLM durable pre-provider recording | 768-1233 (p50 898) | `tb_execution_event` (39 events); `be-llm.md:335` | largest controllable cost |
| Provider window | 1649-3885 (Haiku p50 2389; about 1850 fixed) | `tb_execution` `llm_request`; `magic_llm/engine/engine_openai.py:171-185,262-292` | new client per stream and post-stream usage poll inside it; TTFT unmeasured |
| First sentence to first audio | UNKNOWN; estimate 700-1200 | `e2e-latency-trace.md:245` | not persisted |
| MLLM post-LLM tail | 1008-2528 (+20-71 to finished) | `tb_execution_event` (27 post-LLM events) | off the first-audio path, on the turn-completion and supersede path |
| Fish ledger failure | whole turn silent (5.3-6.4 s), then an error | `call_word_ledger.py:32-35` | correctness, not latency |
| EL end-of-turn stall | about 22000 (1 turn) | DB 890eb3 | INFERENCE: EL inactivity close |

---

## 7. Findings

### GAP-REAL-DEV-CALL-FORENSICS-01: the Fish word ledger crashes every turn whose sentence needs markup or emoji cleaning (high, correctness)

- **FACT.** §5.1. Reproduced. 2 of 15 Haiku turns failed this way in real use (fe6100 s1, s3).
- **Evidence:**
  - `engine.py:3593-3616`, `engine.py:2382-2390`
  - `call_tts_elevenlabs.py:228-265` (`mark_flushed` at `:249` before `push_text` at `:251`)
  - `call_word_ledger.py:32-35`, `engine.py:2637`, `engine.py:3103-3116`
  - `callbot_chat.v2.json:18-20`
- **Impact.**
  - The user hears silence for the full LLM run (about 5-6 s), then gets a generic error.
  - The turn is recorded as `internal`, with no hint of the cause.
  - Any model drift toward asterisks, parentheses, brackets, underscores or emoji takes down the Fish lane.
- **Recommendation.**
  - Build the word ledger from the cleaned text. Alternatively, map the cleaned plan back to source offsets, or sanitize at the `SentenceBuffer` boundary before ledger registration so `source_text == logical_text`.
  - Short-term: catch the geometry `ValueError` in `_push` and fall back to char-level `CallTurnLedger` timing.
  - Make a dead `_push` task fail fast: check `task.done()` on each `speak_later` call instead of only at `finish()`.
  - Add a composed engine test (Fish lane plus a reply with `*aside*`).
  - Also strip stage directions in the LLM stream (a cheap regex) before TTS.
- **Confidence:** high.

### GAP-REAL-DEV-CALL-FORENSICS-02: a failed turn's unheard reply is stored `completed` and fed into the next prompt (medium, correctness)

- **FACT.** Messages 534 and 538 are `completed` at full length (283 and 637). 0 chunks and about 2 chunks were heard. Plan `30a0f169` history includes the 283-char reply with markup.
- **Evidence:**
  - `engine.py:3103-3160` (`_fail_turn` updates only the user segment)
  - `conversation_execution.py:89-240` (the assistant message is completed by the execution path)
  - `call_turn_truncation.py:62-68` (truncation runs only on the success and barge-in paths)
- **Impact.**
  - The model "remembers" saying things the user never heard. The conversation desynchronizes.
  - The forbidden markup style gets reinforced in context.
- **Recommendation.**
  - In `_fail_turn`, apply the same heard-prefix truncation used for barge-in.
  - With 0 heard, mark the assistant message as failed or excluded from history.
  - Add a regression test.
- **Confidence:** high.

### GAP-REAL-DEV-CALL-FORENSICS-03: pre-admission `internal` turn failures leave no durable diagnosis (high, robustness)

- **FACT.** §5.2. 3 of 23 STT-completed segments, in 2 of 8 calls, failed before admission. No plan, message or event row exists. The only trace is a console `logger.exception`.
- **Evidence:**
  - `callbot_execution.py:79-85`, `callbot_execution.py:177-254`
  - `engine.py:3103-3116`
  - `llm_turn_runner.py:147-249`
  - `route_voice_call.py:1588-1598`
- **Impact.**
  - Calls go silent on the first turn. c515d1 failed twice and the user left; c84998 ended.
  - The root cause cannot be recovered after the fact.
  - The process logs only to an IDE pipe in dev, and the categories carry no detail.
- **Recommendation.**
  - Persist `error_type` and a redacted one-line summary in the failed segment's `tts_summary`/`error_detail`.
  - Log to a rotating file in dev.
  - Map known transient exceptions (DB pool, catalog fetch) to retryable categories, and retry once before admission.
  - Add a startup warm-up of the catalog and context path.
  - Then grep the console lines listed in §5.2 to close the UNKNOWN.
- **Confidence:** medium. The mechanism is certain; the exception is unknown.

### GAP-REAL-DEV-CALL-FORENSICS-04: MLLM durable recording costs 0.77-1.23 s before every provider call (high, latency)

- **FACT.** n=19, p50 898 ms. 39 durable events (127-209 KB of payload per run) are written between admission and `llm_start`. Only 27-81 ms separate the last of these events from `llm_start`.
- **Evidence:** MLLM `tb_execution_event` and `tb_interaction` (ms resolution); `be-llm.md:335`; `e2e-latency-trace.md:186-187`.
- **Impact.**
  - It is the single largest controllable stage on the first-audio path, about 20% of user-stop to first audio.
  - Both existing estimates understated it, by 2x and 5-10x.
- **Recommendation.**
  - Use a voice "fast path" in api.magic_llm: write-behind or batched event recording, skip per-node checkpoints for the 4-node callbot graph, and record after the first token.
  - Alternatively, have the BFF call the provider directly for the callbot and keep the durable record asynchronous.
  - Target: under 150 ms.
- **Confidence:** high.

### GAP-REAL-DEV-CALL-FORENSICS-05: supersede waits of 0.7-6.4 s are common in real use (high, latency)

- **FACT.** §4.4. 4 of 19 LLM turns, in 3 of 5 multi-turn calls.
- **Evidence:** `engine.py:2072-2074`; `e2e-latency-trace.md:424` (adjusted to "rare"); `gap-real-call-overlap-history-billing.md` -06.
- **Impact.**
  - A user who talks over a long reply waits for the previous turn's MLLM tail, speaker finish and truncation before their own LLM call even starts.
  - The worst case was +6.4 s.
- **Recommendation.**
  - Start the new turn's admission and LLM call right after cancelling. Only serialize the history write: pass the heard prefix explicitly, or have admission wait on a short, bounded truncation future of 200-300 ms rather than `previous.finished`.
  - Cancel the MLLM stream early so the tail is not awaited.
  - Re-open E2E-LATENCY-TRACE-07 at medium or high.
- **Confidence:** high.

### GAP-REAL-DEV-CALL-FORENSICS-06: the MLLM post-LLM tail (1.0-2.5 s) delays turn completion (medium, latency)

- **FACT.** 27 events are recorded after `llm_end` (1008-2528 ms) before the SSE stream ends. The BFF waits for `VoiceLlmTurnCompleted` before `speaker.finish()`. The 120 ms idle flush keeps it off first audio.
- **Evidence:** `engine.py:88`, `engine.py:2563-2569`, `engine.py:2620-2637`; `be-llm.md:347`.
- **Impact.**
  - It feeds finding 05 directly.
  - It delays the persists, `voice_turn_end` and end-of-call drain.
  - Final text without a terminal punctuation closer (for example ending in `*`) waits for it.
- **Recommendation.** Emit a terminal `done` SSE event to the client before the post-LLM recording, make that recording asynchronous, and add `*` and `_` handling to the sentence closers or strip them.
- **Confidence:** high.

### GAP-REAL-DEV-CALL-FORENSICS-07: provider fixed cost of about 1.85 s per turn, and TTFT is never measured (medium, latency)

- **FACT.**
  - The provider-window regression intercept is about 1850 ms (Haiku), against about 239 tok/s.
  - magic-llm creates a new HTTP client per stream, and the OpenRouter usage poll is a GET on another new client after the stream, inside the `llm_request` window.
  - `raw_usage` `ttft`, `tps` and `ttf` are 0.0 in all 19 runs.
- **Evidence:** `magic_llm/engine/engine_openai.py:171-185`, `engine_openai.py:262-292`; MLLM `tb_execution.raw_usage`.
- **Impact.**
  - INFERENCE: TTFT is about 1.25-1.75 s, including new TCP and TLS for every turn.
  - No dashboard can show it.
  - The usage poll inflates every LLM span and delays `llm_end`.
- **Recommendation.**
  - Keep a pooled, keep-alive client per provider.
  - Use streamed usage (`stream_options.include_usage`, or OpenRouter `usage: {include: true}`) instead of the post-stream poll.
  - Record a `first_token` event with a ms timestamp.
  - Pre-warm the provider connection when the call starts.
- **Confidence:** medium.

### GAP-REAL-DEV-CALL-FORENSICS-08: replies are too long for voice, and most get interrupted (medium, ux)

- **FACT.**
  - Reply p50 is 289 chars, with a maximum of 637. Audio p50 is 17.6 s and the maximum 24.2 s.
  - 12 of 17 audio turns were cut by the user, keeping 9-94%.
  - Completion tokens: p50 130, max 274.
- **Evidence:** DB `adventure_message` lengths vs plan reply lengths; `callbot_chat.v2.json:18-20,37`.
- **Impact.**
  - Users pay TTS and LLM costs for unheard text.
  - Long turns raise the chance of overlap, and so of finding 05.
  - Interrupt-heavy dialogue feels unnatural.
- **Recommendation.**
  - Add a hard `max_tokens` (about 90-120) for callbot profiles.
  - Prompt for 1-2 short sentences, with a "continue?" pattern for long content.
  - Track the kept fraction as a KPI.
- **Confidence:** high.

### GAP-REAL-DEV-CALL-FORENSICS-09: the EL call 890eb3 failed `internal` from the WS loop after a 22 s end-of-turn stall (medium, robustness)

- **FACT.** §5.3. The outcome path is FACT. The exception class is UNKNOWN.
- **Evidence:**
  - `route_voice_call.py:1492-1548`, `route_voice_call.py:1572-1598`, `route_voice_call.py:1605-1628`
  - `engine.py:1043-1068`
  - `delivery.py:162`, `delivery.py:212-231`
- **Impact.**
  - A healthy call that had just finished a turn was recorded as an internal failure, with no resume grace.
  - The 22 s stall blocks the next turn (supersede).
  - Failure metrics are polluted.
- **Recommendation.**
  - Route `VoiceDeliveryDisconnected`, `RuntimeError("not connected")` and send failures to `socket_disconnected(code=1006)`.
  - Store the exception class in session metadata.
  - Close the EL context (or send the EL keepalive) right after the final audio, so `finish()` does not wait on provider inactivity.
  - Bound `finish()` with a timeout once all audio is delivered.
- **Confidence:** medium.

### GAP-REAL-DEV-CALL-FORENSICS-10: BE-STT-03 is confirmed in real data; a failed STT leaves the segment `accepted` and silent (medium, robustness)

- **FACT.** §5.4.
- **Evidence:** `engine.py:2205`, `engine.py:2228`; `stt_groq_client.py:99-108`, `stt_groq_client.py:517-522`; `be-stt.md:228`, `be-stt.md:384`.
- **Impact.**
  - 1 of 24 segments (4%) is in this state.
  - The user gets no feedback and has to repeat themselves.
  - The row is invisible to failure metrics, and the STT seconds are neither billed nor recorded.
- **Recommendation.**
  - Wrap STT in try/except. Update the segment to `failed` with the category and send a non-fatal "didn't catch that" frame.
  - Retry once on `provider_submission` or a 5xx.
  - Add a test with `FakeGroqSttClient(fail=...)`.
- **Confidence:** high.

### GAP-REAL-DEV-CALL-FORENSICS-11: an FE unmount closes 1000 without `voice_end`, so navigation is stored as `disconnected` (medium, observability)

- **FACT.** §5.5. 3 of 8 calls ended `disconnected`. 2 of them were likely navigation (INFERENCE).
- **Evidence:**
  - `useVoiceCallController.ts:1201-1212`, `useVoiceCallController.ts:1093-1110`
  - `voiceSocket.ts:234-238`, `voiceSocket.ts:255-266`
  - `engine.py:1012-1033`; `CallScreen.tsx:199-209`; `fe-ui.md:381`
- **Impact.**
  - Analytics cannot tell user hang-ups and navigation apart from network loss.
  - Navigation silently kills the call (FE-UI-11).
  - The close code is only logged.
- **Recommendation.**
  - Send `voice_end{reason:'navigation'}` before closing on unmount, as `pagehide` already does.
  - Use an app close code (for example 4001) for intentional leaves.
  - Persist the close code and the reason source in session metadata.
- **Confidence:** medium.

### GAP-REAL-DEV-CALL-FORENSICS-12: no durable per-turn latency record; this forensics had to reconstruct it (medium, observability)

- **FACT.** No column or event holds the first LLM token, the first TTS audio sent or the user-stop-to-first-audio time.
  - BFF timestamps are second resolution.
  - The upload time is not stored.
  - Logs exist only on stdout.
- **Evidence:** DB schema (`voice_transcript_segment`, `voice_session`); `e2e-latency-trace.md:427`; `models.py:7754-7830`.
- **Impact.**
  - Every latency number above is either an interval or an inference.
  - Regressions go unnoticed.
- **Recommendation.**
  - Persist a per-turn `latency_summary` JSON on the user segment: `speech_end_lag`, `upload`, `stt`, `admission`, `llm_first_delta`, `first_sentence`, `tts_first_audio`, `client_first_play`.
  - Switch the voice tables to `DATETIME(3)`.
  - Ship structured logs to a file.
- **Confidence:** high.

### GAP-REAL-DEV-CALL-FORENSICS-13: misleading timestamp and status semantics (low, observability)

- **FACT.**
  - `voice_session.last_heartbeat_at` is written only by `mark_active` and `update_metadata`, that is, by billing writes (`models.py:7324-7375`). `touch_call` on a ping updates only `voice_quota_reservation` (`quota.py:327-341`).
  - The user segment's `completed_at` keeps the STT time, and `update_segment_status` uses `COALESCE(completed_at, CURRENT_TIMESTAMP)` (`models.py:7754-7830`). So a later turn failure keeps the STT time, and the failure time is lost.
  - The segment `status` conflates STT status with turn status.
- **Impact.** Anyone reading the rows draws wrong conclusions. For example, `last_heartbeat_at` looks like liveness but is really the last billing write.
- **Recommendation.** Add `turn_status` and `turn_failed_at` (or a turn table), rename or document `last_heartbeat_at`, and store `last_ping_at`.
- **Confidence:** high.

### GAP-REAL-DEV-CALL-FORENSICS-14: calls with zero assistant audio due to an internal error are still charged (low, cost)

- **FACT.** c84998 and c515d1 have `consumed_seconds=2` and no assistant audio. Each showed a 1-credit charge in the earlier ledger read.
- **Evidence:** DB `voice_session.consumed_seconds`; `engine.py:2112-2284` (STT billed at intake, before the turn).
- **Impact.** Users pay for calls that failed on the server side.
- **Recommendation.** Refund, or do not settle, a call whose turns all failed with an `internal`/server category.
- **Confidence:** medium.

### GAP-REAL-DEV-CALL-FORENSICS-15: the asset transcript keeps the full reply while the message is truncated (low, correctness)

- **FACT.** 4 turns, all the first LLM turn of their call (§4.5). This is the same signature as GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-07.
- **Evidence:** DB `voice_transcript_segment` (assistant) vs `adventure_message` lengths; `call_turn_truncation.py:62-68`; `call_ledger.py:380-412`.
- **Impact.** Replay and export show text the user never heard, and that disagrees with the chat history.
- **Recommendation.** Apply the truncation to the asset transcript too, or persist the asset after the truncation settles.
- **Confidence:** medium.

### GAP-REAL-DEV-CALL-FORENSICS-16: most Fish provider attempts end `uncertain` (info, cost)

- **FACT.** 9 of 15 Fish attempts are `uncertain`. A lease released without `attempt.finish()` (on cancel or end) yields `uncertain` (`speech/providers/fish_audio/streaming.py:174-225`).
- **Impact.** Provider usage reconciliation is approximate for most turns, because interruptions are the norm (finding 08).
- **Recommendation.** Record units sent and audio received on cancel, so a cancelled attempt is `settled_partial` rather than `uncertain`.
- **Confidence:** medium.

---

## 8. Strengths (FACT)

- **Prefix caching works.** After each call's first turn, 1694-1869 of 1698-1948 prompt tokens are cache reads.
- **Heard-prefix history works.** Barge-in truncation keeps 9-94% of a reply, and the next turn's LLM history carries exactly the heard prefix.
- **Admission is idempotent and joinable.** `turn_id` equals `execution_id`, so BFF and MLLM rows join exactly.
- **Fish leases are released on cancel and end.** No orphaned `speech_provider_attempt` leases were found.
- **STT is fast and well described.**
  - Under 1 s in 21 of 23 segments.
  - `stt_summary` keeps latency, `no_speech_prob`, `avg_logprob` and `compression_ratio`.
  - `vad_summary` keeps RMS, peak and speech ratio.
- **No spoken-contract failures.**
  - No padded or whitespace-contract failures (BE-LLM-01 / BE-LLM-13) were observed.
  - The Fish 1200-char cap was never approached (max 637).
- **Turn failures are non-fatal** (`engine.py:3118-3123`). The call survives a failed turn.
- **The 120 ms idle flush** keeps the final sentence off the MLLM tail (`engine.py:88`).
- **The MLLM ms-resolution timeline** makes stage attribution possible after the fact.

---

## 9. Open questions (UNKNOWN) and how to settle them

1. **Which exception broke c84998 s1 and c515d1 s1/s2?**
   - Search the PyCharm run console (BFF) for `[VOICE_INTERNAL] voice turn failed` with voice session `c8499880` (Oct 19, about 17:48:35 local) and `c515d1b0` (Oct 20, about 15:37:35 and 15:37:56 local).
2. **Which exception ended 890eb3?**
   - Search for `[VOICE_INTERNAL] voice call failed session_id=104 error_type=` around 16:24:07 local.
   - Look for EL close or inactivity lines between 16:23:45 and 16:24:07.
3. **Which close codes did c515d1, bcf13a and fe6100 send?** Look for `[VOICE_DISCONNECT] voice call socket dropped ... code=... outcome=...` (`route_voice_call.py:1565`).
4. **Why did 1c5bef s1 STT fail?** Look for a `voice STT provider HTTP` warning around 16:20:55 local, or an unlogged transport exception.
5. **What are the true TTFT and first-audio times per turn?** They are not persisted. Rerun with finding 12 instrumented, or read the `voice_llm_first_delta` and `voice_first_assistant_audio` log events from the console.
6. **How long does the upload take?** It is not persisted.
7. **Does the markup in the history of the failed fe6100.1 turn raise the chance of markup in later replies?** fe6100.3 again contained markup. Test this with an A/B run in which the failed reply is excluded.
8. **Is the EL 20 s inactivity close what stalled 890eb3.4?** Verify with EL WS close logs, or reproduce: deliver all audio and keep the context open for more than 20 s.

### Read-only verification queries (no transcript columns)

```sql
SET SESSION TRANSACTION READ ONLY;
-- calls
SELECT LEFT(voice_session_id,6) vs, tts_provider, status, end_reason, started_at, ended_at,
       last_heartbeat_at, consumed_seconds FROM voice_session ORDER BY started_at;
-- segments (lengths and statuses only)
SELECT LEFT(voice_session_id,6) vs, seq, role, status, error_category, duration_ms,
       CHAR_LENGTH(transcript_text) tlen, JSON_EXTRACT(stt_summary,'$.latency_ms') stt_ms,
       JSON_EXTRACT(tts_summary,'$.audio_chunks') chunks, created_at, completed_at
FROM voice_transcript_segment ORDER BY voice_session_id, seq, role;
-- assistant message lengths
SELECT message_id, adventure_id, status, CHAR_LENGTH(content) len, created_at, updated_at
FROM adventure_message WHERE role='assistant' AND adventure_id BETWEEN 95 AND 104;
```

On the MLLM side (`magic_messages`):

- From `tb_interaction`, take `admitted_at`, `started_at` and `finished_at`.
- Join `tb_execution` (`llm_request` started and completed) and `tb_execution_event` (`kind IN ('llm_start','llm_end')`) by run, at ms resolution.

## Verification (adversarial)

Code was re-read in all three repos, and finding 01 was reproduced with a probe. The MySQL and `magic_messages` numbers (row counts, ms timings, message lengths) were **not** re-queried; verdicts on them rest on the code mechanism and on the internal consistency of the per-turn table in §4.

| id | verdict | corrected severity | evidence / note |
|---|---|---|---|
| GAP-REAL-DEV-CALL-FORENSICS-01 | confirmed | high | `call_tts_elevenlabs.py:249` calls `WordCallTurnLedger.mark_flushed` before `push_text`, outside the `ProviderError` try. `call_word_ledger.py:32-35` raises `ValueError` when `mapped.logical_text != span.text`. `engine.py:2382` swaps any `_FISH_UNSAFE_TEXT` sentence for the sanitizer's `moderation_text`, and `compile_performance` makes that cleaned text the `logical_text`. `_run` (`call_tts_elevenlabs.py:183-197`) re-raises and cancels `_drain` (cutting audio already flowing) but never sets `stopped`, so `speak_later` keeps submitting. `finish()` re-raises at `engine.py:2637`, and `_fail_turn` maps the error to `internal` (`:3112`). A probe on the real `SentenceBuffer`, `_fish_spoken_text`, `PerformancePlan` and `WordCallTurnLedger` raised the geometry `ValueError` for `*leans closer* Well, traveller, listen to me.` and accepted a plain sentence. `test_fish_call_engine.py:148-162` and `test_call_word_ledger.py:40-43` test each half only. |
| GAP-REAL-DEV-CALL-FORENSICS-02 | confirmed | medium | `_fail_turn` (`engine.py:3103-3163`) only runs `update_segment(status="failed")`. It never touches `adventure_message` and never sets `runtime.last_turn`, so no later barge-in can cut the reply. History (`conversation_execution.py:65-86`) includes every `completed` assistant row, and `spoken_history_text` passes plain text through with its markup. Truncation runs only from `_truncating_barge_in`, `_supersede_heard_prefix` and the success path (`engine.py:2664, 2691, 2725`). |
| GAP-REAL-DEV-CALL-FORENSICS-03 | adjusted | medium | The gap is real. Only `error_category` is persisted (`update_segment_status` has no error-detail field), `voice_turn_failed` carries only the category, and logging is stdout-only (`main.py:288-298`). The localization holds: the turn's try starts at `engine.py:2562` and the LLM stream is lazy, so a non-VOE raised in `CallbotExecutionService.execute` (which converts only `ProfileError`, `LlmExecutionTransportError` and `CancelledError`, `callbot_execution.py:201-254`) produces the `{failed, 0}` signature. Two corrections. First, this is an observability gap whose root cause is unknown, so "high" overstates it. Second, `logger.exception` at `engine.py:3116` does log the traceback, so the cause can be recovered from a retained console. |
| GAP-REAL-DEV-CALL-FORENSICS-04 | confirmed | high | The mechanism is verified. magic-agents `recorder.record` (`recorder.py:179+`) deep-copies the checkpoint under a lock for each event. api.magic_llm `_append` and `_save` (`native_execution.py:264-335`) run synchronous INSERT and UPDATE statements, with snapshot and checkpoint reads, on every transition. All of it is awaited before `NodeLLM` invokes `on_llm_start` (`NodeLLM.py:1435-1448`). The 768-1233 ms figures were not re-queried, and attributing them to recording rather than to graph build or windowing is an inference from event timestamps. |
| GAP-REAL-DEV-CALL-FORENSICS-05 | adjusted | medium | `engine.py:2072-2074` does await `previous.finished`, but the mechanism is misstated. A superseded turn is cancelled (`_cancel_turn` sets `cancel_event`), `stream_turn` cancels the producer (`llm_turn_runner.py:194-209`), and `_execute_owned` cancels the worker, which closes the httpx stream (`llm_execution_transport.py:315-340`). The MLLM tail is therefore **not** awaited, and the recommendation to cancel upstream is already in place. What the wait covers is cancellation-time DB work (`_finish_safely`, `reconcile`, `_finish_mid_stream_turn`), `_settled_truncation` (up to 3 s, `:1644-1666`) and asset persistence. When the previous turn has already sent `voice_turn_end`, `_cancel_turn` returns False and the wait covers its whole persist. The new turn then runs `_await_pending_truncation` (up to 3 s, `:2322`). Two 3 s caps can explain about 6 s. The §4.4 numbers subtract STT but not the 0.2-0.4 s baseline named in the header, so each wait is overstated by that much (890eb3.3 is about 0.35-1.5 s). |
| GAP-REAL-DEV-CALL-FORENSICS-06 | adjusted | low | The code facts hold. The idle flush releases only text that ends in `.!?` plus a closer, and `*` is not a closer (`sentence_buffer.py:21, 103-113`). The tail is flushed on `VoiceLlmTurnCompleted` (`engine.py:2624-2629`), and `finish()` comes after the stream (`:2637`). "Feeds the supersede waits directly" is wrong, because a cancel closes the upstream stream (see 05). In normal turns the 1-2.5 s tail ends long before the 8-24 s of paced audio, because push is gated by `MAX_AUDIO_AHEAD_MS=8000` and `MAX_SENTENCES_AHEAD=3` (`call_tts_elevenlabs.py:55-57`). So `finish()` is bounded by playback, not by the tail. The audible impact is limited to short replies whose last fragment has no sentence punctuation. |
| GAP-REAL-DEV-CALL-FORENSICS-07 | confirmed | medium | `engine_openai.py:256-292` opens a new `AsyncHttpClient` (a new `aiohttp.ClientSession`, `http.py:92-101`) for each stream. It then awaits `_poll_openrouter_usage_async` (another new client, `:171-185`) inside the generator. That is before `NodeLLM`'s `on_llm_end` (`NodeLLM.py:1450-1478`), so the poll falls inside `llm_start`→`llm_end`. The BFF logs only `voice_llm_first_delta` measured from turn start (`engine.py:2612`); provider TTFT is not persisted anywhere. The regression constants and the `raw_usage` zeros were not re-queried. |
| GAP-REAL-DEV-CALL-FORENSICS-08 | confirmed | medium | `callbot_chat.v2.json:18` asks for "one to three short sentences". The only cap is the callbot `max_output_tokens=1536` (`llm_features.py:66-68`), which is never binding (max 274). The statistics are consistent with the §4 table: p50 289, 12 of 17 audio turns cut, 9-94% kept. |
| GAP-REAL-DEV-CALL-FORENSICS-09 | adjusted | medium | Verified: `failed` plus `internal` comes only from the `route_voice_call.py` exception branches, through `_end_failed_socket_call` and `release_socket` (`engine.py:1043-1066`). The only other `failed` write is `start_failed` (`:1916`). `VoiceDeliveryDisconnected` is a `ConnectionError` (`delivery.py:162`) raised on any send failure (`:216-229`). A pong failure therefore lands in the generic `except` (`route_voice_call.py:1588`) and ends the call at once, with no resume grace. Corrections: (a) The EL-inactivity inference is weak. The adapter sends `keep_alive` every 15 s on open contexts and releases closing contexts after 5 s idle (`tts_multicontext_ws.py:77-82, 985-1007`). (b) The ordering is ambiguous. `end_call` cancels and drains turns first (`engine.py:1129-1133`), so turn 4 persisting in the same second also fits "the exception came first, and the stalled turn was then cancelled". (c) The VOE and `HTTPException` branches log nothing, so the suggested grep finds generic exceptions only. |
| GAP-REAL-DEV-CALL-FORENSICS-10 | adjusted | low | Verified: the segment stays `accepted` (`engine.py:2205`, then an unguarded `transcribe_segment` at `:2228`; `accept_segment` has no `except`), and no voice event or metric records an STT failure. "The user gets no feedback" is wrong. The VOE reaches the route (`route_voice_call.py:1194-1218`) and becomes an HTTP error. The FE catch (`useVoiceCallController.ts:614-618`) then shows a non-fatal `VOICE_UPLOAD_FAILED` notice. HTTP-status failures are also logged (`stt_groq_client.py:522`). What remains: an orphan `accepted` row, no retry, and nothing in the metrics. |
| GAP-REAL-DEV-CALL-FORENSICS-11 | confirmed | medium | The unmount cleanup (`useVoiceCallController.ts:1202-1216`) calls `stopLocalResources({closeSocket:true})`, which runs `VoiceSocket.close(1000)` (`voiceSocket.ts:255-272`) without `end()`, and only then sends the HTTP end. `socket_disconnected` ends a 1000 close at once as `disconnected` (`engine.py:1028-1035`, `_NORMAL_CLOSE_CODES={1000}`). Only workspace switches end through the coordinator (`NavigationProvider.tsx:349`). The CallScreen `leave` path (`CallScreen.tsx:199-208`, which calls `teardownForEnd`) and `pagehide` both send `voice_end` first. Nit: `pagehide` sends reason `user`, not `navigation`. |
| GAP-REAL-DEV-CALL-FORENSICS-12 | adjusted | low | The durability gap is real. `voice_session` and `voice_transcript_segment` use second-resolution `datetime` (`db.sql`), no per-turn latency summary is stored, and logs go to stdout only. "No event stores the first LLM token, first audio or user-stop to first audio" is wrong. `voice_llm_first_delta`, `voice_tts_first_sentence` and `voice_first_assistant_audio` (with the user-stop fields) are recorded with `latency_ms` (`engine.py:2612, 2538, 2910`). They are logged as structured `voice_event` lines with `at_ms` (`observability.py:164-175`) and fed to process-local p50/p95 metrics (E2E-LATENCY-TRACE-10). What is missing is persistence across restarts and a joined per-turn row. |
