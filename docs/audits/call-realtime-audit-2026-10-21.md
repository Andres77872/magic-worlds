# Audit: `docs/call_realtime` research and Phase 0 implementation

**Date:** 2026-10-21. **Audited:**
- the research corpus in [`docs/call_realtime/`](../call_realtime/README.md): README, docs 00-17, `phase0/`, and 30 evidence notes (~33k lines);
- the uncommitted Phase 0 code in this SPA and in `magic-worlds-api`.

**Method.** Read-only. No code was changed. Six independent reviewers checked:
1. the Phase 0 BFF code;
2. the Phase 0 SPA code;
3. the findings register (03);
4. the architecture and latency docs (01, 02, 15);
5. 50 external claims, against primary sources on the web;
6. cross-doc consistency and the roadmap (16, 17).

The headline findings were then re-checked by hand. Each reviewer ran its own tests and probes.

**Repo states:**

| Repo | HEAD |
|---|---|
| SPA | `20fab88e` |
| BFF | `9d75cf4` |
| api.magic_llm | `be1ab64` |
| magic-llm | `12eff00` |
| magic-agents | `a7fb424` |

Line refs below are HEAD (H) or working tree (WT), as marked.

---

## 1. Verdict

**The research is accurate on code facts, strong on vendor facts, and weaker on its own summaries.**
- Every configuration default in doc 01 matches HEAD.
- A random sample of 40 code refs hit 40/40 at HEAD.
- 45 findings re-verified from the register, including all 15 highs: **0 false positives**.
- 44 of 50 external claims were confirmed against primary sources.

The weak spots are in the layer people will quote:
- the "~80%" headline (it is ~72% at central values);
- the "145 verified" claim (59 are marked unverified in the register itself);
- several INFERENCE numbers labelled FACT;
- a latency budget that is a stitched model, with one small double count;
- one cost line that changes a decision (the Fish lane);
- two legal lines that are wrong or out of date.

**Phase 0 is well built at its core, but not shippable as documented.**
- What holds:
  - nothing awaited sits on the turn path;
  - no content reaches the rows;
  - the clocks are kept apart;
  - the tolerant parser works;
  - the new tests pass, and there are no new failures against HEAD.
- What blocks or skews it:
  - **One rollout blocker.** The SPA-first order breaks every call.
  - **One latent regression.** The tolerant parser can still kill a call over version skew, which is the bug R02 was meant to remove.
  - **Several measurement defects** that skew V2V or lose coverage against gate G0.
- **The status table overclaims.** R05 and R08 are marked "Shipped" but were only partly done, the `navigation` reason is listed as shipped but the SPA never sends it, and G0 was quietly redefined.

**The most important thing the research missed:** `LLM_TOTAL_TIMEOUT` does nothing, so an LLM stall has no upper bound at all. The docs say ~92 s (§5.1).

**Nothing is committed.**
- `docs/call_realtime/` itself is untracked.
- The Phase 0 code in both repos is uncommitted and mixed with unrelated in-flight work: LLM profiles, custom providers, Fish, the novel editor.
- The new BFF test files are untracked.
- During the audit, another session was also editing the SPA tree: `Button.tsx` and three `*.stories.tsx` files.

---

## 2. Phase 0: blockers before it ships

| # | Severity | Issue | Evidence | Scenario |
|---|---|---|---|---|
| B1 | **High** | **The SPA cannot ship before the BFF.** The SPA always sends `protocol_version` and `llm` in `voice_start`. The committed BFF's `VoiceStartFrame` is `extra="forbid", strict=True`, and an invalid handshake is fatal | SPA WT `useVoiceCallController.ts:1336-1338`; BFF H `route_voice_call.py:185-196`, `:320-330`. Reproduced by a probe | Every call from the new SPA to the current BFF closes with 4408 ("The call could not start"). `phase0/README.md` says "Steps 2 and 3 may ship in either order": that is wrong. It also contradicts `01_protocol_v2.md` §2.1 ("server-first") |
| B2 | **Medium (latent)** | **Frames with extra fields are processed, but each one counts toward the fatal limit of 1,000 ignored frames** | BFF WT `route_voice_call.py:402` (returns `("extra_fields",)` on a valid frame), `:1596-1599` | A future SPA adds one field to `voice_playback` (about 2 per second). The call is killed with 4408 "Too many invalid voice frames" after about 500 s, inside the 600 s cap. That is C29, the version-skew kill R02 exists to remove. Fix: count `extra_fields` without letting it trip the limit |
| B3 | Medium | **The rollout cannot be reversed by a flag.** The new BFF refuses to boot without the `2026_10_voice_turn_metrics` revision, and the previous BFF refuses to boot after it. `VOICE_TURN_METRICS_ENABLED=false` does not decouple the two | BFF WT `bootstrap.py` `CONTENT_SCHEMA_REVISION` | A rollback after the migration needs a schema step too. Document it, or make the marker tolerant |
| B4 | Medium | **Phase 0 is entangled with non-Phase-0 work.** The SPA controller now awaits `prepareLlmDispatch('callbot')` before `voice_start`, which adds a new fatal `call_model_unavailable` path, and sends `llm`. `CallScreen` and `CallSetup` depend on the uncommitted llmProfiles changes | SPA WT `useVoiceCallController.ts:1123-1141`, `CallScreen.tsx:220` | Phase 0 does not "change no call behaviour" as shipped. The reviewer showed that the 8 Phase 0 sources and 7 tests, applied alone on HEAD, typecheck and pass 186/186. **Split before committing** |

---

## 3. Phase 0: measurement defects (fix before trusting G0)

| # | Sev | Issue | Evidence |
|---|---|---|---|
| M1 | Med | **`barge_in_onset_to_pause_ms` is close to 0 ms.** The worklet posts `speech_start` only after `minSpeechSamples`, which is 500 ms while audio is audible. The pause follows synchronously. So the field measures detection → pause, not onset → pause. The doc example (530 ms) and the unit test imply onset semantics; the controller test asserts `expect.any(Number)` | SPA WT `voiceVadProcessor.worklet.js:339-341`; controller `:962-965`, `:721`, `:689` |
| M2 | Med | **Autoplay-blocked turns contaminate V2V.** A turn that was blocked and then played after a tap is `outcome: played`. Its `v2v_ms` includes the human tap delay. `autoplay_blocked` is stored only in `client_detail` JSON, so the 02 §9 query cannot exclude these turns. This skews iOS p95 | SPA WT `callPlaybackTiming.ts:139-144`, `:222-225`; BFF WT `turn_metrics.py:55-63` |
| M3 | Med | **Coverage is lost when the caller leaves the screen in-app.** The socket hook's cleanup closes the socket (1000) before the controller's unmount flush runs, so every open turn is dropped and no `voice_end` is sent | SPA WT `useVoiceCallSocket.ts:154-157` (registered at controller `:989`) runs before controller `:1278-1291` |
| M4 | Med | **Coverage is lost on server-initiated ends.** The SPA flushes on `voice_ended`, but `record_client_turn_metrics` returns False once `runtime.ending` is set, so those frames are dropped and not even counted | BFF WT `engine.py:3043-3045`; SPA WT controller `:531` |
| M5 | Med | **`call_turn_index` and the call's `segments` count every upload attempt, duplicates included.** A duplicate that arrives after the original was written replaces `records[seq]` with a skip record, and a later client frame is accepted but never written. This skews G0's "every segment has a row" | BFF WT `turn_metrics.py:376`, `:383`, `:392-397`. Reproduced by a probe |
| M6 | Med | **`config_fingerprint` does not hash what 02 §5 says it does.** It covers STT, the max segment, VAD, the resume grace and the build. It omits the TTS lane and format, the LLM cap and the sentence-buffer limits. Baselines and experiment arms keyed on it can mix configurations | BFF WT `turn_metrics.py:97-113` vs `phase0/02_turn_metrics.md` §5 |
| M7 | Low | A late client frame also rewrites `played_ms`, `kept_chars`, `barge_in` and `truncated`, not only `client_*` (01 §3.3 and 02 §7 say `client_*` only) | BFF WT `voice_metrics_models.py:30-34`, `turn_metrics.py:490-497` |
| M8 | Low | The units are inconsistent: `tts_utf8_bytes` counts prepared text, while chars and sentences count sent text. Absent client `chunks`, `stalls` and `stall_ms` are stored as 0, not NULL. VAD no-speech rejections become `no_speech`. A turn superseded after it published becomes `interrupted` | BFF WT `engine.py:2516`, `:2532`, `:3032`, `:2986`; `route_voice_call.py:279-310` |
| M9 | Low | "One row per uploaded segment" is not true for segments refused before the record exists: auth, form or size errors at the route, and the hash, idempotency and capacity checks | BFF WT `engine.py` ~2098 |
| M10 | Low | Stalls are double counted. `waiting` and `stalled` for one stall count 2. A trailing `waiting` before end of stream counts as a stall. Every Blob group boundary is a stall | SPA WT `callPlaybackTiming.ts:239-249`; `voicePlaybackBuffer.ts:127-133` |
| M11 | Low | Telemetry runs unguarded in critical spots: `_note_turn_usage` runs ahead of `speaker.abort()` and TTS billing in `_run_voice_turn`'s `finally`. A future exception there would skip cleanup | BFF WT `engine.py:2914` |
| M12 | Low | `drain()` waits on sleeping `_flush_later` tasks and has a fixed 5 s timeout, unlike its docstring and 02 §7. There is a narrow write race in which a client UPDATE hits 0 rows (`written=True` is set before the INSERT commits). A flood of metrics frames never trips the abuse limit | BFF WT `turn_metrics.py:456-462`, eng `:3048-3051` |
| M13 | Low | `owned_client` (the R09 cold-pool baseline) is set but never logged or stored, although 03 §1 says it is logged | BFF WT `llm_exchange_timing.py` |
| M14 | Low | A turn cut by the next `voice_turn_start` reports a stale `played_ms`. A turn whose `voice_turn_end` was lost in a resume has no settle timer. The Interrupt button with nothing audible reports `interrupted` | SPA WT `voicePlaybackBuffer.ts:195-203`; `callPlaybackTiming.ts:267`, `:104-111`; controller `:683-694` |

**Checked and sound:**
- Never on the path: every hook is synchronous and rows go through a strong-ref background task.
- The ContextVar is scoped and reset per turn, and cannot leak across turns or calls.
- No transcript, reply, prompt or token reaches a row or a log.
- Monotonic and wall clocks are converted once, and the units are correct.
- Client and server field names, `StrictInt` types, ranges and enums agree exactly. The client rounds and clamps every value, so the server never drops a frame as invalid.
- `usage_details` is read only after the strict validator, and its exceptions are swallowed. It cannot fail a call that used to pass.
- The Groq 10 s billing floor is correct.
- The migration is read-only by default, and `--apply` requires a backup.
- The FK cascades from `voice_session`.

---

## 4. Phase 0: status table vs reality (`phase0/README.md`)

| Item | Claimed | Actual |
|---|---|---|
| R01 | Shipped | Mostly. "20 stage marks": `stages_ms` holds at most 20, but 02 §2 lists 21 rows (the extra row is the `received` origin). R01 in 17 defines `v2v_ms` with leading silence; Phase 0 excludes it until R73, which itself depends on R01. R01's "budget test" and "hand-labelled interruption sample" are not in the verification. Rows are keyed per segment, not per `turn_id`. That is a reasonable change, but 17 does not reflect it |
| R02 | Partly shipped | The BFF side is done. **`voice_end.reason: "navigation"` is listed as shipped, but the SPA never sends it**: `voiceSocket.ts:273` hard-codes `'user'`, and the unmount path closes the socket first (M3). The README's "Still open" list and 01 §5 contradict the shipped row. Not done and not listed as open: "send failures go to disconnected-with-grace". 12 §5.3's outcome taxonomy was applied only to the metrics row; the engine catch-all `"internal"` and the hard-coded assistant `status="completed"` remain (BFF WT `engine.py:3370`, `:3784`). R02's own metric, the `failed_internal` share, therefore does not exist |
| R03 | Deferred | The whole item was deferred on OD12. But only the V2V rules and the alert channel depend on OD12 and on data. Enabling the monitor, feeding the four unfed events and adding the sanitizer-drop counter could ship now. OD12 is "needed by Phase 0" yet missing from 17's decision summary |
| R04 | BFF half | Correct, and honest about api.magic_llm. But 17 lists R04 with "Depends: None", and its validation ("the parts sum to the BFF TTFT") is impossible under Phase 0's no-api.magic_llm constraint. "Every api.magic_llm exchange" means voice-turn streamed exchanges only |
| R05 | **Shipped** | **Only the dimension columns shipped.** No production-like baseline: `--reload`, non-root users, `SSE_BUFFER_INTERVAL_MS=0`, a non-shared DB, a topology note and RTT from ES/LatAm are all absent. The fingerprint is also incomplete (M6) |
| R06 | Units shipped | No egress-bytes, moderation-token or price-table-version columns. Prices wait for OD2/OD3, but 17 gives R06 no dependency and no OD lists it under Blocks. This delays $/call-min, which G0 in 16 requires, and R26, R65, R85 and R87 |
| R07 | Deferred | It blocks R25, R40, R41, R48, R82 and R86, and nothing in 16 or 17 reschedules them |
| R08 | **Shipped** | Only the four stale comments (all now accurate). Not done: re-running the overlap forensics, and verifying BE-ENGINE-TURNTAKING-15 and FE-PLAYBACK-TRANSPORT-12. `voiceVadProcessor.worklet.js:222` still describes only the fallback |
| Verification: "tests/voice: the same 64 failures as HEAD" | — | Now **59 failed / 1,056 passed (WT) vs 64 / 1,018 (HEAD)**. All 59 also fail at HEAD with matching messages (no MySQL pool, or feature-flag fixtures). 5 Fish tests now pass from unrelated work |
| Verification: "SPA: touched test files (10), 230 pass" | — | Not reproducible. 9 voice, call and grep-gate files: **206/206 pass**. With the 2 other modified files (llmProfiles, novel): 258 tests, **1 fail** (`LlmFeatureControl.test.tsx`, unrelated work) |
| Verification: `pnpm build` | Exit 0 | Confirmed, exit 0 |
| Gate G0 | Defined in README and 02 §10 | **Three different G0s exist.** 16:767 asks for V2V with leading silence, $/call-min, a language and device split, and "stage intervals sum to V2V". That last check can never pass, because Phase 0 forbids mixing clocks. 17:213 asks for alerts reaching a person, a non-zero pre-provider split and the replay corpus. Phase 0 asks for frame coverage on completed and interrupted turns and a non-null TTFT. Phase 0 cannot pass 16's or 17's gate, every later gate depends on G0, and 16 and 17 never link to `phase0/`. Also, G0 coverage should be measured on `client_outcome IS NOT NULL`, not `client_v2v_ms` (v2v is legitimately null for max-length cuts and for turns interrupted before audio) |

Other doc mismatches in `phase0/`:
- 02 §7 says the write waits 15 s. The code waits **125 s for v2 clients** and 15 s for old ones (`turn_metrics.py:38`, `:40`, `:409-417`).
- The README says the client gates on `client_metrics >= 1`; the code requires `=== 1`.
- The kill switch needs a restart and is case-insensitive, not "exactly `false` … without a deploy".
- "README §4" is a broken section reference.
- "17 §5" should be §4.

---

## 5. Issues the research missed or understated

### 5.1 An LLM stall has no upper bound (High; feeds C07)

`build_magic_llm_timeout` passes `timeout=LLM_TOTAL_TIMEOUT` **together with** connect, read, write and pool (BFF `src/services/magic_llm_config.py:85-124`). httpx has no total deadline: `timeout=` is only the fallback for phases not given. Since all four phases are given, **`LLM_TOTAL_TIMEOUT` (120 s, documented in `.env.example` and `docs/configuration.md`) is silently ignored.**

Nothing else bounds the stall either:
- api.magic_llm sends `: keepalive` every 10 s (`completions.py:80`), which resets the BFF's 60 s read timeout;
- magic-llm streams with `ClientTimeout(total=None, sock_read=30)` and no connect timeout (`magic_llm/util/http.py:261-262`), which trickled bytes also reset.

**Scenario:** an overloaded provider or gateway queues the request while sending comments, and the caller hears silence for minutes. The docs' "~92 s worst case" is the byte-silent case only. R18's deadline is therefore more urgent than 17 suggests, and it must be a wall-clock watchdog, not a socket timeout.

### 5.2 Other items

- **The working-tree N01 fix still crashes on some inputs** (Low). `_fish_source_geometry` raises `ValueError` when the cleaned text shares no characters with the source (BFF WT `engine.py:3990-3991`). It runs unguarded inside `prepare`, so it hits the same silent-turn path. Reproduced: `*3*` → `three` and `😊 5` → `five` both raise.
- **The STT timeout is not a total deadline.** It is applied as connect 5 / read 30 / write 30 / pool 5, so the worst case is about 65 s, not 30 s (`stt_groq_client.py:548-556`).
- **The spend check is awaited before api.magic_llm dispatch.** 02 §7 says it is "not serial unless slower than the LLM", but it overlaps only BFF prep (BFF H `engine.py:2343`, `:2581`).
- **BFF token validation on every segment POST is missing from the latency budget.** The cache TTL is 30 s, but segments arrive 10-31 s apart, so misses are common: one api.auth call each, with dev Nagle on top.
- **Other stages missing from the budget:**
  - the sentence-boundary idle tick (0.12 s), when a boundary lands at the end of a delta;
  - the effective endpoint, about 600-700 ms in practice, not 550;
  - the wait for the previous turn's persistence on quick follow-ups (5 of 13 transitions in dev);
  - first-frame `deliver` work.

---

## 6. Findings register (03): verification

**Coverage:** all 15 high findings, plus a seeded stratified sample of 20 medium and 10 low.

**Accuracy:**
- No false positives.
- Line refs match HEAD within ±2 lines in every case opened.
- The arithmetic and ids are clean: 145 = 15 + 53 + 67 + 10, no duplicates, no dangling refs, all 17 errata in §11 applied.

| Change needed | Findings |
|---|---|
| **Fixed or in progress in the uncommitted tree** | C29 (unknown frames fatal) is fixed, but see B2. N01 (Fish ledger crash) is fixed, but see §5.2. C13 (no V2V) is in progress. The README's ten-things item 1 ("any unknown frame is fatal today") is outdated against the working tree |
| **Condition overstated** | **C24** (talk-over after `voice_turn_end`). On the default AEC-on path, auto barge-in fires and truncates even after the end (`engine.py:1354-1365`). The issue remains for AEC-off and raw-fallback calls, and for the first 3 s of the first reply. "Speech under 500 ms" is not a trigger: it produces no segment (contradicts C16). Severity is medium, not high. **C07**: 92 s is not a bound (§5.1). **C14**: the reconnect budget resets after every completed turn with audio, so "text-only for the rest of the call" needs a failure *and* a failed immediate reconnect within one turn window |
| **Severity** | C24 high → medium. C50 medium → low: the captions scroll, they are not hidden. N09 medium → low: dev only, production uses `src.serve`. C10 and C04 are debatable (latent, and C04 fails loudly) |
| **Attribution** | C09: `use_dns_cache=False` exists only in `PrivateAsyncHttpClient` (BYOK and recovery), not on the platform callbot path. The per-turn httpx client and the per-call aiohttp session are correct. FE-PB-17: "no `navigator.audioSession` use" is false; `play-and-record` has been set since `ffc4ad8c` (2026-10-11) |
| **"145 verified"** | The register itself marks **59 of 145 (41%)** as unverified (`u`): 38 low singles, 9 info, and C62, C75-C80, N12, N13, N16-N18. The README and 03's headline should say "145 de-duplicated, 86 verified" |

---

## 7. Architecture (01) and latency model (02)

### Doc 01

**Configuration:** every default value matches HEAD exactly. There are nuances:
- the STT timeout semantics (§5.2);
- the EL budget reset (C14);
- billing also fires at every sentence start;
- moderation modes are missing from the table. The code default (`required=true`, classifier off) refuses calls, so the README's "moderation off" path is the dev `.env`, not the code default.

**Behaviour errors:**
1. **Turn ordering.** `VoiceLlmTurnStarted` (and with it `transcript_final` and `voice_turn_start`) is emitted after BFF admission and **before** the HTTP dispatch to api.magic_llm. `on_start()` is awaited before `produce_output` (BFF H `llm_workflow_execution.py:96-101`), and the lock-step queue makes dispatch wait for the engine's handling. Doc 01 §4.1's mermaid and doc 02 §3 put these after the provider stream starts.
2. **Barge-in outcome.** A mid-stream barge-in with a heard prefix is stored **`completed`**, with `truncated` set and its MP3 kept (Q-19 option a, BFF H `engine.py:2651-2660`). It is stored `interrupted` only if that update fails. Doc 01 §5.1 and the §7.2 state edge say `interrupted`.
3. **Phase transition.** uploading → transcribing fires on the `received` ack, not `accepted` (SPA H controller `:767-774`). The §6.2 text and §7.1 mermaid are wrong; the §7.1 table is right.
4. **Overstated strengths:**
   - Moderation "look-ahead from sentence 2" does not exist. `_push` is strictly sequential, although "only sentence 1 pays moderation serially" still holds.
   - The stale-frame filter drops only cancelled turns and seq ≤ the last seen, not "older turns".
   - The 500 ms barge-in minimum is bypassed when the user is already speaking as playback becomes audible.
5. **Protocol completeness:** about a dozen fields are missing:
   - `voice_ready.original_voice_name`, and `limits.max_call_seconds` / `idle_timeout_seconds`;
   - `voice_audio_chunk.codec` and `voice_name` (`voice_name` is also missing from the TS type);
   - `played_ms` and `kept_chars` on `voice_turn_end`;
   - the WS-S4 truncation fields on `voice_cancelled`;
   - `retry_after_seconds`.

   Undocumented behaviour: `voice_ping` is accepted before the handshake, and a mid-call `voice_start` is ignored.

### Doc 02 (and the README headline)

The central sums and phase arithmetic reproduce (3,826 / 3,906 ms; 3.4 → 2.3 → 1.57 → 0.94 s). The model has these problems:

| Claim | Problem | Corrected reading |
|---|---|---|
| "Three stages ≈ 80% of the wait" (README, 16, 17) | 80% only at the fast end; central 2,736 / 3,826 = **72%**. 02 §4 and 01 §4.3 say so; the README does not | ~70% |
| LLM hop 100 + 880 + 680 = 1,660 ms | The 680 ms TTFT row is back-derived from a span (898 ms) that already contains row 7: about 80 ms is counted twice. The 680 ms provider TTFT is unverified and may be optimistic (forensics show a ~1.85 s provider-window intercept) | Recoverable ≈ **1.5 s**, not 1.6. The 2.3 s target is unchanged |
| "3.6-4.7 s at STT p95" | Only STT is moved to p95. 16 computes targets' p95 with an extra +0.35-0.6 s LLM tail, but not today's | Today's p95 by 16's own method: **~4.7-5.0 s** |
| "~1.58 s … ~0.87 s of it durable commits" | Two different runs: a 2026-10-15 probe with minimal history, and 2026-10-20 runs with 48-123 KB checkpoints | INFERENCE, not FACT |
| "fsync'd durable recording" as the cause | fsync measured 1.5-1.95 ms per commit against a 39-69 ms commit cadence. fsync explains ~40 of ~874 ms; the DB vs serialization split is UNKNOWN | Say "synchronous durable commits" (rewriting 48-123 KB checkpoints) |
| "One documented sample ≈ 5.5 s" (FACT) | 4.9 s from an older doc plus an assumed ~0.6 s | INFERENCE |
| Row 6 "FACT bound [208, 400]" | It spans different stages than claimed: it excludes most of row 4 and includes dispatch → MLLM admitted | Drop the bound or redefine it |
| DB units, row 1 "549-552 ms", STT p95 (n = 23) | Inference on measured units, a simulation, and a p95 that sits between the 2nd and 3rd largest values | Label as such |
| "Cause of the 5 failed segments UNKNOWN" | The forensics note reproduced 2 of the 5 (the N01 Fish ledger crash) | Wrong in the other direction |

**Takeaway:** treat "3.2-4.2 s" as an INFERENCE with roughly ±0.3 s of model error on top. This is exactly why Phase 0 measurement matters, so finish it before relying on any phase estimate.

---

## 8. External claims (50 load-bearing claims checked)

**Result:**
- 44 confirmed: 39 on primary sources, 5 on secondary.
- 3 contradicted.
- 1 outdated.
- 2 misattributed.
- None wholly unverifiable.

Vendor prices, benchmarks, model names and dates are typically exact to the digit. These were confirmed:
- Groq's 10 s minimum;
- eot-bench ES (24.5% at 600 ms);
- AA STT and TTS boards;
- Hume EVI's 2026-11-13 shutdown;
- Gemini Live context re-billing (recomputes to about $0.15/min);
- LiveKit defaults;
- the NY and CA effective dates.

| # | Claim | Verdict | Impact |
|---|---|---|---|
| 1 | **Fish lane ≈ $0.013/min** (13, 11) | **Misattributed.** That is S2.1-Pro's price ($15 per 1M UTF-8 bytes). The code default is **`drama-3`** (`model_features.py:10`, `fish_audio/config.py:7`): a $10 promo until 2026-11-12, then **$50 per 1M chars** | **Changes a decision.** From 2026-11-13 the Fish lane costs ≈ **$0.037/min, more than the EL lane ($0.030)**. 13's "make Fish the default lane" holds only with `s2.1-pro`. 08 already has the Drama 3 price; 13 and 11 do not. **Time-sensitive: 3 weeks** |
| 2 | NY notice must say the AI is "unable to feel human emotions" (14, SAF-05) | **Contradicted.** GBS §1702 requires only that the user is told they are not communicating with a human; the wording came from bill A6767 | Drop that requirement from SAF-05. Keep the notice at start and every ≥3 h |
| 3 | EU Art. 50(2) marking deadline 2026-12-02 "rests on a provisional agreement" | **Outdated.** Now Regulation (EU) 2026/1744, in force 2026-07-27 | The deadline is law and **6 weeks away**. Schedule the counsel read (SAF-16) now |
| 4 | WebKit 326286 affects "iOS 26.2 to 27" | **Partly contradicted.** iOS 26.2 is reportedly clean; 27 is affected. A 2026-10-20 comment says WebRTC remote audio crackles too | Target iOS 27 in the device matrix. The WebRTC pilot will not fix the crackle. An EC-off track ("headphones mode") is the only workaround |
| 5 | Eleven Realtime is "the fastest S2S on the AA board" | **Contradicted:** Raon (0.04 s) and Deepslate Opal (0.44 s) are faster; 11's own table lists Opal | None |
| 6 | Retell 800 ms median / 2.5 s p99 | Misattributed: from a learn article, not the cited docs page | None |

**New facts the corpus lacks:**
- GPT-Live-1.1 (2026-10-15) adds Mexican-Spanish voices in ChatGPT, with the API pending. This is a watch-list trigger for the S2S stance.
- Deepgram Flux-multi launched 2026-04-15, which closes an open item in 00 #15.

---

## 9. Consistency and roadmap (16, 17)

**Links:**
- 1,676 relative links, 0 broken.
- 1 broken section ref and 4 that point to the wrong section (§4 above; `03_api_magic_llm_plan.md` P8 → 07 §2.4; `r02:95` → §5.3; `17:308` → 05 §7.4).

**Code refs:**
- 4,185 own-repo refs; 98% resolve, and the sample hit 40/40 at HEAD.
- **44-48% now point at changed lines in the working tree.** Examples: `engine.py` 236/236, `useVoiceCallController.ts` 78/78, `route_voice_call.py` 59/59.
- The docs pin **no commit SHAs**, so this rot is invisible. Add the SHAs listed at the top of this audit to README and 00.
- About 50% of refs are bare basenames, which is ambiguous across repos.
- `LLM` means api.magic_llm in one evidence note and magic-llm in another.

**Numbers that disagree across docs:**
- **BFF pre-LLM DB cost:** "13-15 serial round trips" (README, 01, 04) vs "23-29 transactions + 8 commits" (03, 15, 17). These are never reconciled.
- **api.magic_llm commits per turn:** 19-20 before `llm_start` / 32 total / "about 28" / "about 20 per request" / "20-32 before the provider" (phase0/03). These mix two measures.
- **Dead air after Phase 1:** "about 5 s" (17 summary, ten things) vs "no turn > ~10 s" (Phase 1 exit) and R18's 10-15 s deadline.
- **Smaller ones:** item 7's −100..−450 vs R14 + R15 = −150..−450; 08's "85-90%" vs "83-93%" elsewhere; −780 ms booked for a −600..−800 range (midpoint −700); three different LLM-stage savings.

**Roadmap logic:**
- **Dependency cycle:** R24 ↔ R46.
- **Decision loops:**
  - R48 depends on OD1, which is decided by X2, which is R48's own validation; OD1's Blocks list omits R48.
  - OD2 is decided by X3 and blocks R44, which X3 validates.
  - Resolve both as: ship in shadow mode → experiment → decide.
- **Cross-phase edges:**
  - Phase 1 items depend on Phase 2 items: R24 → R46, R29 → R50, R34 → R57.
  - R12, R17, R20 and R24 are validated through the Phase 2 harness R68.
  - Both Gantts start Phase 1 before G0 closes, and do not encode 16's "tail-value P0 items only" restriction.
- **Double counts in the phase estimates:**
  - R44 is booked in both Phase 2 (−90) and Phase 3 (−150).
  - Speculation is booked twice (R78 −150, plus −250 "overlapping endpointing").
  - R73's −80 cannot appear in Phase 0's V2V, which excludes leading silence, yet it is subtracted from a baseline that includes it.
  - R09 is booked at the top of its range.
- **Contradictory recommendations:**

  | Pair | Conflict |
  |---|---|
  | R12 vs R71 | "Never write cue markup" vs a tag palette with 1-2 tags per reply |
  | R18 vs R69 | Two filler mechanisms (a holding line at 1.5-2.5 s TTFT, non-lexical cues at ~1.2 s), with no arbitration |
  | R30 vs R59 | A greeting under 3 s vs 2-3 s of spoken disclosure first, so the opening runs ~5-6 s |
  | R22 vs R23 | R23 needs uploads during playback, but R22 makes AEC-off calls half-duplex |

- **Owner decisions:**
  - 17's summary lists 8 of 13 ODs and omits OD5, OD6, OD11, OD12 and OD13. OD12 is needed in Phase 0.
  - The Blocks and Depends columns disagree for OD7/R52 and OD8/R39.
  - R06's prices sit under no OD.
- **Coverage:** every high finding in 03 maps to at least one R item.
- **Errata:** E14 is only partly applied (14:205 still prescribes "check-ahead"). E8's "inference" label is dropped in the README.

---

## 10. What to do, in order

### Before Phase 0 is committed or deployed
1. **Deploy the BFF first**, and fix the README's "either order" (B1). The SPA cannot learn the server's version before `voice_ready`, and `voice_start` is the handshake. So server-first must be a hard rule in the rollout steps, not an option. (The only alternative is a client fallback that retries `voice_start` without the new fields after a 4408 during the handshake.)
2. **Stop `extra_fields` from counting toward the fatal limit** (B2), and add a test that a valid frame with an extra field never ends a long call.
3. **Split the Phase 0 hunks** from the LLM-profile and `llm`-in-`voice_start` work in both repos (B4). `git add` the new BFF test files and `docs/call_realtime/`.
4. **Write a rollback note** for the schema marker coupling (B3).

### Before G0 data is trusted
5. **Fix coverage holes and V2V contamination:**
   - M3: flush and send `voice_end` before the socket hook's cleanup;
   - M4: accept client frames while `runtime.ending`;
   - M2: promote `autoplay_blocked` and `playback_path` to columns, or exclude blocked turns in the V2V query;
   - M1: stamp onset from the worklet's first voiced frame, or rename the field;
   - M5: make duplicates not advance `call_turn_index`, and do not replace written records.
6. **Make `config_fingerprint` match 02 §5** (M6).
7. **Reconcile G0** across 16, 17 and phase0, and link `phase0/` from 16 and 17:
   - measure coverage on `client_outcome IS NOT NULL`;
   - drop the impossible "intervals sum to V2V" check;
   - record what was descoped.
8. **Correct the status table:**
   - R05 → partial;
   - R08 → partial;
   - R02's "navigation" → not shipped;
   - test counts (59 failures; 9 files, 206 pass).

### Time-sensitive, independent of Phase 0
9. **Fish default model and pricing before 2026-11-13** (§8 #1). Switch the call default to `s2.1-pro`, or accept the Fish lane becoming the most expensive one. Correct 11 and 13.
10. **Bound the LLM wait now** (§5.1). Add a wall-clock TTFT watchdog and a turn deadline in the BFF (R18), and remove or fix the inert `LLM_TOTAL_TIMEOUT`. Today a stall has no upper bound.
11. **Schedule the EU Art. 50(2) counsel read** (deadline 2026-12-02, now law), and fix the NY notice wording in SAF-05.

### Doc hygiene
12. Pin commit SHAs in README and 00, and drop or qualify "~80%" and "145 verified".
13. Fix doc 01's turn ordering, barge-in outcome and protocol fields.
14. Relabel the FACT numbers in §7, and reconcile the DB-cost and commit-count figures.
15. Break the R24 ↔ R46 cycle, order the OD1/X2 and OD2/X3 loops, and resolve the four contradictory recommendation pairs.

---

## 11. Test and build results (this audit)

| Target | Result |
|---|---|
| BFF `tests/voice/test_voice_protocol_v2_turn_metrics.py` (untracked) | 20 passed |
| BFF `tests/test_voice_turn_metrics_migration.py` (untracked) | 15 passed |
| BFF `tests/services/test_llm_execution_text.py` | 52 passed (HEAD 51) |
| BFF `tests/voice` | WT 59 failed / 1,056 passed; HEAD 64 / 1,018. **No new failures** (junit comparison: all 59 fail at HEAD with the same messages) |
| BFF `tests/test_schema_bootstrap.py` | WT 11 failed / 103 passed; HEAD 15 / 99 |
| SPA `pnpm build` | Exit 0 (chunk-size warning only) |
| SPA voice, call and grep-gate tests (9 files) | 206/206 pass |
| SPA `LlmFeatureControl.test.tsx` | 12/13. 1 failure from the unrelated llmProfiles work |
| SPA `src/features/interaction` | 24 fail / 760. 20 also fail at HEAD; `InteractionCenterPanel*` (8-9) fail from other in-flight edits (Button, llmProfiles), not Phase 0. With HEAD plus only the Phase 0 sources: 87/87 |
| SPA plain `pnpm test` | Also collects a stale copy under `.claude/worktrees/wonderful-wiles-d5ea10/`, whose vendor grep gate (`src/test/`) fails. Scoped: 15/15 |

**Not run:**
- no real MySQL;
- no live provider;
- no real call.

All BFF test runs were forced to an invalid DB host by `tests/conftest.py`.

**Reviewer scratch output** (probes, HEAD extractions, ref scripts): `/tmp/claude-1000/-home-andres-WebstormProjects-magic-worlds/5a2ec06b-a6a7-4baf-a1ff-bbac6afec0f7/scratchpad/{bff,spa,findings,arch,facts,consistency}/`.

## 12. Fix status (2026-10-21, after the audit)

B1, B2 and M1 to M5 are fixed in the working trees of both repos, not committed. They sit on top of SPA `8f73f42c` and BFF `1faf8a1`, which committed the Phase 0 work while the fixes were in progress. The SPA commit also carries the LLM-profile work, so B4 (split before committing) no longer applies as written.

| # | Fix | Where |
|---|---|---|
| B1 | Docs only: the server-first rollout is a hard rule. The client cannot learn the server's version before `voice_ready`, and `voice_start` already carries the new fields | `phase0/README.md` rollout, `01` §2.1 |
| B2 | `extra_fields` is still counted, but no longer counts toward the 1,000-frame bound | BFF `turn_metrics.py` (`_LIMITED_FRAME_KINDS`, `VoiceCallTelemetry.ignore`) |
| M1 | The worklet's `speech_start` carries `onset_lag_ms` (the audio since the first voiced frame). The controller dates the onset back by it. The barge-in interval starts at the later of the onset and `playing` | SPA `voiceVadProcessor.worklet.js`, `useMicrophoneCapture.ts`, `useVoiceCallController.ts`, `callPlaybackTiming.ts` |
| M2 | A turn blocked before it first played sends no `speech_end_to_playing_ms`, `first_chunk_to_playing_ms` or `v2v_ms` | SPA `callPlaybackTiming.ts`; `01` §3.2 |
| M3 | An effect declared before the socket hook flushes the open turns and sends `voice_end{navigation}` on unmount, while the socket is still open. `navigation` goes only to a v2 server; a v1 server gets `user`. The HTTP end stays as the escape hatch | SPA `useVoiceCallController.ts`, `useVoiceCallSocket.ts`, `voiceSocket.ts`, `voice.types.ts` |
| M4 | Frames during `ending`, and for 10 s after the end from the same socket, still reach their rows. The call row's counters do not include them | BFF `engine.py` (`record_client_turn_metrics`, `end_call`), `turn_metrics.py` (`ended_call_frame`); `02` §7 |
| M5 | `call_turn_index` counts distinct seqs. A retry never replaces a written record, so the record keeps its client frame | BFF `turn_metrics.py` (`seq_index`, `begin_turn`); `02` §5, §7 |

| Re-run | Result |
|---|---|
| BFF Phase 0 file, `test_llm_execution_text.py`, migration test | 91 passed (Phase 0 file: 24, 4 new) |
| BFF `tests/voice` | 59 failed / 1,060 passed: the same 59 by name as §11 |
| SPA call path (16 files) | 323/323 |
| SPA grep gate | 15/15. It had failed on 3 lines of this audit, which were reworded |
| SPA `pnpm build` | Exit 0 |
| SPA wider `voice`/`call` name match (117 files) | 14 files fail. Current HEAD fails the same 14 (48 tests). `InteractionCenterPanel.voiceRefresh` is flaky (1 to 4 failures per run) |

Still open from §10: B3 (rollback note), M6 onward. The BFF migration script `scripts/migrations/20261020_voice_turn_metrics.py` is still untracked.
