# Gap: reconciling severities, duplicates, answered questions and contradictions across the 10 audit notes

- **Gap subsystem:** finding reconciliation (IDs `GAP-FINDING-RECONCILIATION-*`).
- **Date:** 2026-10-20.
- **Inputs:** the 10 subsystem notes in this folder: `fe-capture.md`, `fe-playback-transport.md`, `fe-ui.md`,
  `be-route-transport.md`, `be-stt.md`, `be-engine-turntaking.md`, `be-llm.md`, `be-tts.md`,
  `be-observability-safety-cost.md`, `e2e-latency-trace.md`. Each note ends with an independent verification
  table (verdict `confirmed` or `adjusted`, plus a corrected severity).
- **Cross-checks:** the sibling gap note `gap-segment-post-and-control-plane-unknowns.md`, research note
  `../research/r94-gap-g4-contradictions-reconcile.md`, a few code lines I reopened, and read-only aggregates
  of the dev database (section 6).
- **Labels:** FACT = I opened the cited line. INFERENCE = reasoned from facts. UNKNOWN = not determinable from
  the repos or the dev data.
- **Path conventions:** a bare `name.md:line` is a note in this folder. `FE:` = `/home/andres/WebstormProjects/magic-worlds`,
  `API:` = `/home/andres/PycharmProjects/magic-worlds-api`.
- No source code was changed. The only database access was `START TRANSACTION READ ONLY` + `SELECT` + rollback.

---

## 0. TL;DR

1. **209 finding IDs collapse to 126 canonical issues.** 80 clusters hold 163 IDs, and 46 unverified IDs stay
   single. 83 IDs (40%) are aliases of another note's finding (FACT, Appendix A/B).
2. **Final canonical severity:** 0 critical, **13 high**, 47 medium, 59 low, 7 info.
3. **Verification covered exactly the 119 critical/high/medium IDs** (80 confirmed, 39 adjusted). None of the
   90 low/info IDs was verified. Their severities are the authors' own (FACT, section 2.4).
4. **Severity inflation is systematic and one-directional:** 28 of 119 verified IDs (24%) were downgraded and
   none were upgraded. The only critical became high. 6 of 25 highs became medium, and 21 of 93 mediums became
   low. The highest downgrade rates are in `e2e-latency-trace.md` and `be-observability-safety-cost.md`
   (6 of 14 verified each).
5. **Ranked high issues:** C01 batch uplink and batch STT · C08 api.magic_llm durable pipeline before the first
   byte · C09 no pooled connections · C02 no semantic end-of-turn · C10 whitespace kills completed turns · C07 no
   LLM deadline (worst case about 92 s) · C06 single-shot STT with a 30 s timeout · C11 resume seq gap · C14 one
   TTS reconnect budget · C05 echo self-supersede · C03 energy-only VAD · C12 inert self-harm detection · C04 the
   300 ms moderation gate (a latent launch blocker). C13, the lack of measurable latency, is medium but should be
   scheduled first, because every latency fix needs it to be verified.
6. **Three questions asked in several notes are already answered elsewhere:**
   - Upstream cancel propagation: A01, answered by `be-llm.md` §10.
   - AEC-off uploads: A02, answered by FE-CAPTURE-01.
   - Client flush on a local barge-in: A03, answered by `fe-playback-transport.md` §2.7 and strengths.

   Eight more are answered or partly answered (section 4).
7. **32 contradictions, 21 of them material** (section 5). The ones that change conclusions:
   - VAD hang-over: 800 ms vs the real 550 ms (K01).
   - Segment cap: 7.5 s vs the effective 29.5 s (K02).
   - Dead-socket detection: 50-75 s vs "up to 50 s" (K03).
   - LLM retries: "none" vs magic-llm's 3 × 30 s (K05).
   - Output cap: "no max_tokens" vs 1,536 (K06).
   - STT p50: estimates of 150-900 ms vs a measured dev p50 of 526 ms (K19).
8. **New dev-DB evidence** (n is small; dev only):
   - STT `latency_ms`: p50 526, p95 1,002, max 1,481 ms on 0.9-2.1 s clips (n = 23).
   - 5 of 23 STT-completed user segments ended `failed/internal`.
   - 1 orphan `accepted` row confirms BE-STT-03.
   - Assistant replies run p50 17.6 s of audio, and 16 of 17 run 7.8 s or longer.
9. **Reconciled speech-end to first audio, EL lane, moderation off:** about **3.2-4.2 s** at STT p50 and about
   3.6-4.7 s at STT p95. The single documented sample ("first audio 4.9 s after upload") is above this range, so
   the real tail is likely worse (INFERENCE, section 7).

---

## 1. Method and rules

1. I extracted every finding heading (ID and header severity) and every verification row (ID, verdict,
   corrected severity) from the 10 notes with a script. The first parser matched "critical" inside titles such
   as "critical path". It was replaced by severity-position regexes, and every row in Appendix A was
   spot-checked.
2. **R1, final per-ID severity:** the verifier's corrected severity when the ID was verified, otherwise the
   header severity. Unverified IDs are flagged `not verified`.
3. **R2, canonical severity:** the severity best supported by the combined verified facts. Normally this is the
   highest verified member severity. It is lower when another verifier refuted the basis of that severity, and
   such cases are listed in section 2.3 with the decisive fact.
4. **R3, one owner per ID:** every ID belongs to exactly one canonical issue. A cluster's title, category and
   recommendation come from its best-verified member. Other members are listed as aliases.
5. **R4, contradictions:** two notes, or a note and its verifier, that state incompatible facts. I resolved each
   one against the code or data where I could, and marked it UNKNOWN where I could not.

---

## 2. Severity reconciliation

### 2.1 Per-note statistics (FACT, computed from the headings and verification tables)

Severity columns read critical/high/medium/low/info.

| Note | IDs | Header | Verified | Confirmed | Adjusted | Downgraded | Upgraded | Final |
|---|---|---|---|---|---|---|---|---|
| fe-capture.md | 20 | 0/3/9/6/2 | 12 | 9 | 3 | 3 | 0 | 0/3/6/9/2 |
| fe-playback-transport.md | 23 | 0/3/7/12/1 | 10 | 6 | 4 | 3 | 0 | 0/1/8/13/1 |
| fe-ui.md | 28 | 0/1/10/14/3 | 11 | 8 | 3 | 2 | 0 | 0/0/10/15/3 |
| be-route-transport.md | 19 | 0/1/9/7/2 | 10 | 6 | 4 | 3 | 0 | 0/1/6/10/2 |
| be-stt.md | 21 | 0/2/9/8/2 | 11 | 9 | 2 | 2 | 0 | 0/2/7/10/2 |
| be-engine-turntaking.md | 20 | 0/2/8/9/1 | 10 | 6 | 4 | 2 | 0 | 0/1/8/10/1 |
| be-llm.md | 22 | 0/4/11/6/1 | 15 | 12 | 3 | 0 | 0 | 0/4/11/6/1 |
| be-tts.md | 22 | 0/3/9/8/2 | 12 | 10 | 2 | 1 | 0 | 0/2/10/8/2 |
| be-observability-safety-cost.md | 16 | 1/2/11/1/1 | 14 | 7 | 7 | 6 | 0 | 0/3/6/6/1 |
| e2e-latency-trace.md | 18 | 0/4/10/4/0 | 14 | 7 | 7 | 6 | 0 | 0/3/6/9/0 |
| **Total** | **209** | **1/25/93/75/15** | **119** | **80** | **39** | **28** | **0** | **0/20/78/96/15** |

INFERENCE: `be-llm.md` was the most accurate on severity (15 verified, 0 downgrades). The cross-cutting notes
(`e2e-latency-trace.md`, `be-observability-safety-cost.md`) were the least accurate, because they restated
other subsystems' mechanisms from a distance. Most of their downgrades come from missed mitigations: the 500 ms
barge-in minimum, the 1,536-token cap, and process-local histograms that do exist.

### 2.2 The 28 downgrades (header severity to final severity)

| ID | Header | Final | Verifier row | Canonical | Decisive correction (short) |
|---|---|---|---|---|---|
| BE-OBSERVABILITY-SAFETY-COST-01 | critical | high | `be-observability-safety-cost.md:677` | C04 | Not a live defect: the classifier is off and optional in dev (`API:.env:78,81` per the verifier). The 2,003 ms sample is a preview-surface probe. Only sentence 1 pays the latency serially. |
| BE-ENGINE-TURNTAKING-01 | high | medium | `be-engine-turntaking.md:727` | C24 | Mechanism confirmed. It needs the AEC-off, raw-fallback or warm-up path. |
| BE-TTS-02 | high | medium | `be-tts.md:351` | C18 | en/es are unaffected. Korean splits normally, and Thai is only delayed. |
| E2E-LATENCY-TRACE-08 | high | medium | `e2e-latency-trace.md:425` | C15 | A 500 ms backchannel filter exists (`useVoiceCallController.ts:132-137, 706`). |
| FE-PLAYBACK-TRANSPORT-02 | high | medium | `fe-playback-transport.md:529` | C22 | The flush-ahead gate freezes at the last playback report, which bounds the exposure. |
| FE-PLAYBACK-TRANSPORT-03 | high | medium | `fe-playback-transport.md:530` | C23 | Detection is 25-75 s after the drop. Resume works for clean closes. |
| FE-UI-01 | high | medium | `fe-ui.md:612` | C16 | 500 ms matches LiveKit's default minimum interruption duration. |
| BE-ENGINE-TURNTAKING-08 | medium | low | `be-engine-turntaking.md:734` | C22 | The gate does not advance on wall clock once a report exists. |
| BE-OBSERVABILITY-SAFETY-COST-06 | medium | low | `be-observability-safety-cost.md:682` | C70 | Diagnostics are degraded, not lost. |
| BE-OBSERVABILITY-SAFETY-COST-07 | medium | low | `be-observability-safety-cost.md:683` | C71 | `voice_ws_close` and `voice_turn_audio` carry the key fields. |
| BE-OBSERVABILITY-SAFETY-COST-09 | medium | low | `be-observability-safety-cost.md:685` | C72 | X-Request-Id exists on other routes. The execution id travels as the Idempotency-Key. |
| BE-OBSERVABILITY-SAFETY-COST-12 | medium | low | `be-observability-safety-cost.md:688` | C69 | `drained_chars` counts undelivered characters, not unheard ones. A barge-in drains little. |
| BE-OBSERVABILITY-SAFETY-COST-14 | medium | low | `be-observability-safety-cost.md:690` | C66 | Fish is off by default, and concurrency of 1 bounds lock contention. |
| BE-ROUTE-TRANSPORT-02 | medium | low | `be-route-transport.md:868` | C65 | Sticky routing on the chat id in the URL is feasible today. |
| BE-ROUTE-TRANSPORT-09 | medium | low | `be-route-transport.md:875` | C61 | TTS-side billing is hidden behind up to 8 s of lead. The real critical-path write is STT billing (C19). |
| BE-ROUTE-TRANSPORT-10 | medium | low | `be-route-transport.md:876` | C06 | The timeout is env-tunable. Only the model pin needs code. (C06 stays high through BE-STT-02.) |
| BE-STT-06 | medium | low | `be-stt.md:387` | C74 | A trip needs about 9-12 repetitions. "Sí, sí, sí." has a ratio of 0.83. |
| BE-STT-11 | medium | low | `be-stt.md:392` | C64 | `transcript_final` arrives before LLM TTFT, not during it. |
| E2E-LATENCY-TRACE-05 | medium | low | `e2e-latency-trace.md:422` | C64 | The admission involved is the BFF's own (`llm_workflow_execution.py:93-96`), not api.magic_llm's. |
| E2E-LATENCY-TRACE-07 | medium | low | `e2e-latency-trace.md:424` | C20 | The truncation task starts at the barge-in frame and mostly overlaps. |
| E2E-LATENCY-TRACE-10 | medium | low | `e2e-latency-trace.md:427` | C13 | Process-local p50/p95 histograms and per-stage events exist. |
| E2E-LATENCY-TRACE-11 | medium | low | `e2e-latency-trace.md:428` | C07 | "No max_tokens" is wrong: there is a 1,536 cap. (C07 stays high through BE-LLM-05.) |
| E2E-LATENCY-TRACE-13 | medium | low | `e2e-latency-trace.md:430` | C66 | The account slot cap, not the row lock, is the binding limit. |
| FE-CAPTURE-10 | medium | low | `fe-capture.md:464` | C21 | The server turn ends with generation, usually well before playback ends. |
| FE-CAPTURE-11 | medium | low | `fe-capture.md:465` | C67 | Both warm-ups already overlap STT. |
| FE-CAPTURE-12 | medium | low | `fe-capture.md:466` | C63 | The 10 s floor costs about $0.0003 per request (the verifier's figure, to be re-checked). |
| FE-PLAYBACK-TRANSPORT-08 | medium | low | `fe-playback-transport.md:535` | C68 | A following segment supersedes the turn and truncates it with the last report. |
| FE-UI-08 | medium | low | `fe-ui.md:619` | C73 | The text label keeps changing, so the screen does not look dead. |

### 2.3 Adjusted with the same severity (11) and contested canonical severities

These 11 IDs were `adjusted`, but kept their severity: FE-PLAYBACK-TRANSPORT-09 (`fe-playback-transport.md:536`),
FE-UI-06 (`fe-ui.md:617`), BE-ROUTE-TRANSPORT-05 (`be-route-transport.md:871`), BE-ENGINE-TURNTAKING-04
(`be-engine-turntaking.md:730`), BE-ENGINE-TURNTAKING-07 (`:733`), BE-LLM-05 (`be-llm.md:684`), BE-LLM-08 (`:688`),
BE-LLM-15 (`:695`), BE-TTS-04 (`be-tts.md:353`), BE-OBSERVABILITY-SAFETY-COST-11 (`be-observability-safety-cost.md:687`),
E2E-LATENCY-TRACE-14 (`e2e-latency-trace.md:431`). Their corrections feed the contradictions in section 5
(K05, K09, K14, K17, K18, K24).

Clusters whose verified members disagree, and the rule applied:

| Canonical | Member severities (verified) | Canonical | Decisive fact |
|---|---|---|---|
| C04 moderation gate | high (BE-OBS-01, E2E-03, BE-TTS-01), medium (BE-LLM-15, BE-ENGINE-04) | **high, latent** | Required moderation defaults to true in code (`moderation_transport.py:122-129` per `be-observability-safety-cost.md:677`), but the dev config has the classifier off and moderation optional (`be-llm.md:695`; `FE:docs/fish_audio_support/evidence/2026-10-15-call-profiles.json`: `configured_classifier_enabled=false`, `configured_required=false`). Today it costs 0 ms. Turning it on as designed adds up to 300 ms per turn and makes classifier unavailability silence the call. |
| C05 echo self-supersede | high (FE-CAPTURE-01), medium (FE-UI-02, E2E-09) | **high, conditional** | Uploads continue during playback when AEC is off (`fe-capture.md:455`; `useVoiceCallController.ts:920-935`). How often AEC is off in production is UNKNOWN. |
| C06 STT single-shot | high (BE-STT-02), medium (BE-ENGINE-12, E2E-12), low (BE-ROUTE-10) | **high** | BE-ROUTE-10 was lowered for the env-tunable timeout, which does not refute the missing retry, hedge, breaker or fallback (`be-stt.md:383`). |
| C07 LLM deadlines | high (BE-LLM-05), low (E2E-11) | **high** | E2E-11's basis ("no max_tokens") was refuted, but the BE-LLM-05 verifier found magic-llm retries of 3 × 30 s + 1 s, about 92 s of silence in the worst case (`be-llm.md:684`). |
| C13 latency not measurable | high (BE-OBS-05), medium (FE-CAPTURE-09, FE-PB-05, BE-STT-09), low (E2E-10) | **medium** (changed from the generated high) | 4 of the 5 verified aliases are medium or lower. Server-side p50/p95 histograms and per-stage events exist in process (`e2e-latency-trace.md:427`). The gap is client-perceived latency, persistence and a per-turn row: an enabler, not something the user feels. It is still scheduled first. |
| C61 billing in the drain loop | medium (BE-TTS-07, BE-OBS-04), low (BE-ROUTE-09) | **low, contested** | Audio leads playback by up to 8 s, and the first chunk is sent before the first billing (`be-route-transport.md:875`; `be-tts.md:356` agrees that gaps need DB latency comparable to the buffered audio). Re-rate to medium if production DB p95 approaches the first-chunk duration. |
| C66 Fish spend lock | medium (BE-TTS-12), low (BE-OBS-14, E2E-13) | **low, contested** | Fish is off by default, and `FISH_AUDIO_CONCURRENCY=1` is the binding limit (`e2e-latency-trace.md:430`; `be-observability-safety-cost.md:690`). It is enabled in dev (K17). |

### 2.4 Policy for the 90 unverified IDs

- All 90 are low (75) or info (15). The verification pass sampled only critical, high and medium IDs (FACT).
- 26 of them merge into clusters that have at least one verified member, so that member's verified evidence
  covers them.
- 18 form 7 low clusters with no verified member: C62 and C75-C80. They are duplicates of each other only,
  merged on mechanism.
- The other 46 stay single (Appendix C).
- INFERENCE: given the 24% downgrade rate one level up, these are unlikely to be under-rated. Two exceptions
  look under-rated and should be verified before the backlog is frozen:
  - BE-ENGINE-TURNTAKING-15: stored call audio does not match the cut transcript.
  - FE-PLAYBACK-TRANSPORT-12: socket closures that skip `connecting` leave the UI "live" on a dead call.

---

## 3. Canonical issues

### 3.1 High issues, ranked

Ranking rule (INFERENCE): first what costs latency or correctness on every turn, then failure modes that end or
corrupt a call, then compliance and launch gates.

| Rank | Canonical | Why here |
|---|---|---|
| 1 | **C01** batch uplink and batch STT (6 IDs) | The largest structural serial wait. The 550 ms hang-over, the upload and the full STT (dev p50 526 ms) all sit before the LLM. |
| 2 | **C08** api.magic_llm durable pipeline (2 IDs) | A second admission, about 16 recorder commits and history snapshots happen before the first provider byte, on every turn. |
| 3 | **C09** no pooled or prewarmed connections (2 IDs) | A new TCP (and TLS) handshake on the BFF to api.magic_llm, magic-llm to provider and Groq hops of every turn. Cheap to fix. |
| 4 | **C02** no semantic end-of-turn (3 IDs) | Every pause over 550 ms ends the turn. Fragments and superseded turns waste LLM and TTS work and feel rude. |
| 5 | **C10** whitespace contract (1 ID, reproduced) | A turn that is already stored as completed fails live. How often depends on the model (UNKNOWN). |
| 6 | **C07** LLM deadlines (2 IDs) | No TTFT deadline, filler or fallback. Retries can mean about 92 s of silence. |
| 7 | **C06** STT single-shot, 30 s (5 IDs) | One Groq stall freezes the call under `intake_lock` for up to 30 s. |
| 8 | **C11** resume seq gap (1 ID) | Resuming mid-reply leaves a permanent gap, and the turn never ends on the client. |
| 9 | **C14** one TTS reconnect budget (1 ID) | A second socket failure silences the voice for the rest of the call. |
| 10 | **C05** echo self-supersede (5 IDs) | The character interrupts itself on AEC-off devices. The rate is UNKNOWN. |
| 11 | **C03** energy-only VAD (2 IDs) | Noise opens turns and fires barge-ins. It shares fixes with C02 and C05. |
| 12 | **C12** self-harm detection inert (1 ID) | A compliance and safety gap. Lists are empty and the screen runs after the text has streamed. |
| 13 | **C04** 300 ms moderation gate (5 IDs) | Latent. It costs nothing today, but it blocks launch with required moderation. |

### 3.2 Merge rationale for the multi-ID clusters (the non-obvious ones)

- **C01:** FE-CAPTURE-03, BE-ROUTE-01, BE-STT-01 and E2E-01 describe the same serial chain from three vantage
  points. FE-PB-06 (no HTTP/2 or keep-alive guarantees for the held POSTs) and BE-STT-10 (no streaming or
  partials) are parts of the same fix: stream audio over a persistent channel into a streaming STT.
- **C02 vs C03:** C02 is about *when* the turn ends (no semantic or prosodic end-of-turn model). C03 is about
  *what* counts as speech (no neural VAD). They are kept separate because the fixes differ: a turn-detector
  model vs Silero or WebRTC-class VAD. Both point to `voiceVadProcessor.worklet.js`.
- **C04:** five notes each found the serial 300 ms per-sentence verdict. BE-LLM-15 and BE-ENGINE-04 add that the
  classifier is off in dev and that `check_ahead` is unbuilt. The overlap correction (K07) applies to all five.
- **C05:** FE-CAPTURE-01 (uploads continue), FE-UI-02 (the hint copy is wrong), E2E-09 (auto barge-in is
  skipped but the uploads are not), BE-ENGINE-19 (no server echo guard) and FE-CAPTURE-19 (info) are one causal
  chain.
- **C06:** BE-OBS-16 (info) is only the "model pinned in code" fragment, and BE-ROUTE-10 is the timeout fragment.
- **C13:** ten IDs across nine notes. Every note found a piece of the missing latency measurement: the client
  first-audible mark (FE-CAPTURE-09, FE-PB-05, FE-UI-19), stage events that are only logged (BE-STT-09,
  BE-ROUTE-16, BE-TTS-18, BE-ENGINE-17, BE-LLM-16) and the missing persistence and per-turn row (BE-OBS-05,
  E2E-10). This is the most duplicated issue in the audit.
- **C15:** six IDs for irrevocable barge-in. BE-STT-21 and BE-LLM-22 (info) only note that the LLM generation
  is thrown away.
- **C19:** five IDs count the same serial DB and billing round trips between the segment and the LLM dispatch.
  The estimates range from about 13 to about 15 round trips. The BE-ROUTE-09 verifier moved the STT-billing
  write here (`be-route-transport.md:875`).
- **C21:** the turn is bound to the POST. `gap-segment-post-and-control-plane-unknowns.md:39-61` shows this
  orphans turns but rarely loses them.
- **C22:** the server drops audio while the socket is away (BE-ROUTE-08), the client does not hold uploads
  during a reconnect (FE-PB-02), the dropped audio is billed (BE-ENGINE-08), and it is stored as heard
  (BE-TTS-17).
- **C25:** truncation granularity (sentence-level EL cut, `currentTime` ignoring output latency) and the missing
  interruption marker in history.
- **C31:** BE-ROUTE-04 and BE-OBS-11 are the same crash-orphan sweep. The verifier fixed the window at 10-11 min
  after call start (K14).
- **C77:** four notes each describe a part of the serial call setup.

The full canonical table (80 clusters) is in Appendix B. The 46 unverified singles are in Appendix C.

### 3.3 Duplicate inflation

- 209 IDs → 126 canonical issues (40% reduction). 163 IDs sit in 80 clusters, an average of 2.0 per cluster.
- Largest clusters: C13 (10 IDs), C01 and C15 (6 each), C04, C05, C06 and C19 (5 each).
- Effect on headline counts (INFERENCE): summed across notes, the audit reports 20 high findings after
  verification. These are 13 distinct high issues. Anything that counts findings per note (dashboards,
  roadmaps) should count canonical IDs instead.

---

## 4. Open questions already answered elsewhere

| # | Question (asked in) | Answer (source) | What remains open |
|---|---|---|---|
| A01 | Does a barge-in or supersede cancel the LLM upstream? (`e2e-latency-trace.md:258` B5, `:409` Q7; `be-engine-turntaking.md:688` Q1; `be-observability-safety-cost.md:663` Q6) | **Yes, up to api.magic_llm's provider call.** The BFF producer cancel closes the httpx stream. Starlette's `listen_for_disconnect` cancels the stream task group, and the adapter's `finally` cancels the producer (`be-llm.md:362-372` steps 1-3; strengths `be-llm.md:641`). FACT per be-llm. | Whether OpenRouter or the provider stops generating and billing is UNKNOWN (`be-llm.md:368` step 4, Q4 `:654`). Cancelled usage is lost on both sides (`be-llm.md:369-370`). |
| A02 | With AEC off, does the client keep uploading during playback? (`be-engine-turntaking.md:690` Q2; BE-ENGINE-19 `:645-647`; `be-stt.md:364` Q7) | **Yes.** Auto barge-in is skipped without AEC, but `handleCapturedSegment` uploads every segment (`fe-capture.md:237`, verifier `:455`; `e2e-latency-trace.md:426`; `FE:src/features/interaction/hooks/useVoiceCallController.ts:920-935`). | How well browser AEC works on each platform is UNKNOWN (`fe-capture.md:438`, `fe-playback-transport.md:515`, `e2e-latency-trace.md:407`). |
| A03 | Does the frontend drop queued chunks on a local barge-in? (`be-route-transport.md:851` Q4) | **Yes, immediately.** The turn is marked cancelled, queues are cleared, the MediaSource is detached and later chunks for that turn are refused (`fe-playback-transport.md:156`, strengths `:491`, `:497`; `voicePlaybackBuffer.ts:573-617`; `voiceSocket.ts:448-493`). | Head-of-line blocking on the wire still applies to control frames behind queued audio (C28). |
| A04 | Is the server's 4/s `voice_playback` limit per turn or per call? (`fe-playback-transport.md:518` Q8) | **Per call.** A sliding 1 s window; excess frames are silently ignored (`be-engine-turntaking.md:285`; `gap-segment-post-and-control-plane-unknowns.md` Q3). | None. The client sends 2/s. |
| A05 | Does a call turn also debit chat/LLM credits? (`be-observability-safety-cost.md:659` Q4) | **No.** The callbot contract sets `platform_credit_billed=False` (`be-llm.md:282`). FACT per be-llm. | None. |
| A06 | Does the 4-sentence TTS queue ever block the LLM loop? (`be-llm.md:658` Q8) | **No queue limit exists.** `VOICE_TTS_QUEUE_MAX_SENTENCES = 4` is never used, and the speaker queue is unbounded (`be-engine-turntaking.md:651`; `be-tts.md:274`). Pacing comes from the flush-ahead gate. | Memory bound on very long replies (C79, low). |
| A07 | Does the BFF send meaningful `voice_status` frames? (`fe-ui.md:588` Q1) | **Only two:** `listening` at ready, and `uploading_segment` as the echo of `voice_segment_meta` (`be-route-transport.md:120`, `:225`). No retry hints. | None. |
| A08 | What are real STT latencies? (`be-stt.md:358` Q1; `be-engine-turntaking.md:694` Q4; `e2e-latency-trace.md:406` Q4; `be-route-transport.md:850` Q3) | **Partly, from dev:** p50 526, p95 1,002, max 1,481 ms, n = 23 short clips (section 6). | Production region, longer clips, p99. |
| A09 | Is moderation required and is the classifier on? (`be-llm.md:655` Q5; `e2e-latency-trace.md:405` Q3; `be-observability-safety-cost.md:654` Q1) | **Partly.** Dev has the classifier off and moderation optional (`be-llm.md:695`; call-profiles JSON). The code default for `required` is true (`be-observability-safety-cost.md:677`). | Production setting and classifier p50/p95. |
| A10 | Production process topology? (`be-route-transport.md:848` Q1; `be-tts.md` Q5) | **Partly.** The container runs a single uvicorn process (Dockerfile:87, cited by the BE-ROUTE-02 verifier `be-route-transport.md:868`). | Replicas, proxy timeouts, HTTP/2. |
| A11 | Is there a TLS-terminating proxy in front of the BFF? (`fe-playback-transport.md:513` Q3; `fe-capture.md:441` Q4; `e2e-latency-trace.md:400` Q1) | **Partly (INFERENCE):** the deployed test build is served over HTTPS (FE-PB-06 verifier `fe-playback-transport.md:533`; roadmap `FE:docs/voice_refactor/00_current_status_and_roadmap.md:60`). | Proxy read/idle timeouts and the HTTP version. |

Also answered by the sibling gap note `gap-segment-post-and-control-plane-unknowns.md:39-61`:

- `fe-playback-transport.md:516` Q6: an aborted POST does not cancel the turn.
- `fe-playback-transport.md:517` Q7: a pre-ready close does not orphan the reservation. It is recorded as
  `failed/internal`.

---

## 5. Contradictions

### 5.1 Material: these change a conclusion, an estimate or a recommendation

| # | Topic | Statement A | Statement B | Resolution |
|---|---|---|---|---|
| K01 | VAD silence hang-over | 800 ms (450 strict): `be-engine-turntaking.md:381`, `:400` (latency row 1), `:452`, verifier `:729` | 550 ms: `e2e-latency-trace.md:142`, `:174`; `fe-capture.md:176-178` | **550 ms, FACT.** `FE:src/features/call/components/CallScreen.tsx:114` sets `vad: { silenceMsToEnd: 550, minSpeechMs: 250 }`. 800/450 is only the worklet fallback, and 450 "strict" is unreachable (r94 §4.1 agrees). be-engine's latency row 1 and its total are about 250 ms too high. |
| K02 | Client segment cap | 7.5 s: `e2e-latency-trace.md:136`, `:145`; `be-stt.md:46`, `:157`, `:290`, `:326`; verifier `be-stt.md:387` ("segments of 7.5 s or less"); FE-PB-06 verifier `fe-playback-transport.md:533` | 29.5 s after consent and ready: `fe-capture.md:178` | **29.5 s, FACT.** `useVoiceCallController.ts:128` (`DEFAULT_MAX_SEGMENT_MS = 7_500`, "until the server advertises its own"), `:130` (margin 500), `:544-548` (`configure({ maxSegmentMs: max - 500 })`), called at `:726` (voice_ready) and `:1058` (consent). The server allows 30 s (`config.py:42`). This weakens the BE-STT-06 downgrade rationale ("rare with segments of 7.5 s or less"): tail loops are more likely on 20-30 s clips. Upload size and STT time for long turns are also higher than estimated. |
| K03 | Client dead-socket detection | 50-75 s after the last frame: `fe-playback-transport.md:131`, `:307`. Verifier `:530`: 25-75 s after the drop when idle | "up to 50 000 ms": `fe-ui.md:256`; "only after 50 s": `fe-ui.md:467` | **50-75 s after the last inbound frame, FACT** (`voiceSocket.ts:20-21`, check only on the 25 s tick `:586-600`). Measured from the moment of a silent drop, it is 25-75 s, depending on how recently a frame arrived. fe-ui understates it, so its UX impact (C23) is understated. |
| K04 | Server detection of a half-open socket while sending | About 40 s: `be-route-transport.md:591`; "≤ 40 s": `fe-playback-transport.md:311` | The keepalive closes it: `be-engine-turntaking.md:639` | **UNKNOWN.** The BE-ROUTE-05 verifier says the WS keepalive pong shares the per-socket send lock, which is blocked behind a stuck `drain` with no timeout (`be-route-transport.md:871`). Detection may therefore take as long as the TCP retransmission timeout (minutes) while audio is being sent (INFERENCE). It needs a test with a dropped peer mid-reply. |
| K05 | LLM retries | "Retries: None (FACT)": `be-llm.md:377`; "the only bounds are ... 30 s": `:461` | magic-llm retries 3 times (30 s each + 1 s backoff), about 92 s worst case: BE-LLM-05 verifier `be-llm.md:684` | **The verifier wins.** The BFF dispatches once, but magic-llm retries the provider call blindly. The worst-case silence in C07 is about 92 s, not 30-60 s. |
| K06 | Callbot output cap | "The callbot graph sets no `max_tokens`": `e2e-latency-trace.md:333`; L-08 "no max_tokens in graph ... OPEN": `:369` | `max_output_tokens 1,536`: `be-llm.md:282`, `:294`, `:512`; verifier `e2e-latency-trace.md:428` | **1,536 FACT** (feature contract `llm_features.py:66-68`, per be-llm). L-08 is partly done: a cap exists but is about 4 times the roadmap's 300-400. |
| K07 | Moderation look-ahead | "Wire `check_ahead` so sentence N+1 is moderated while N plays": `be-observability-safety-cost.md:368`; `be-tts.md:181`; `be-llm.md:561` | Sentence N+1 is already prepared right after N is pushed: verifier `be-observability-safety-cost.md:677` | **Already overlapping, FACT.** `API:src/services/voice_orchestration/call_tts_elevenlabs.py:228-265` (`_push`) awaits `_prepare(text)` before the `may_flush` wait loop. Only sentence 1 pays moderation serially. The `check_ahead` recommendation is mostly moot. The real fix is a faster first-sentence check. |
| K08 | What `transcript_final` waits for | api.magic_llm admission: E2E-05 `e2e-latency-trace.md` (finding text) | BFF's own `LlmExecutionRepository.admit`; `on_start` fires before the api.magic_llm POST: `e2e-latency-trace.md:422`, `be-stt.md:392` | **BFF admission, FACT per both verifiers.** It reaches the UI before LLM TTFT. |
| K09 | Flush-ahead gate while the socket is away | Generation keeps going on a wall-clock estimate: `be-route-transport.md:874`; FE-PB-02 | It freezes at the last playback report. Wall clock is used only if no report arrived for that turn: `be-engine-turntaking.md:734` | **Freezes, FACT** (`call_tts_elevenlabs.py:150-158`, per the verifier). Billed, unheard exposure is at most 3 free sentences plus up to 8 s ahead, which is why C22 is medium, not high. |
| K10 | First-audio p50 alert (RB-1) | "an RB-1 page alert": `e2e-latency-trace.md:427` | A `logger.error("voice_alert ...")` line, monitor off by default, no pager channel: `be-observability-safety-cost.md:134-138`, verifier `:684` | **Log line only, FACT.** No one is paged. With `VOICE_METRICS_MONITOR_ENABLED=false`, the rule is not even evaluated. |
| K11 | What gets billed | "Only delivered audio is billed": `be-route-transport.md:836` (strength) | Audio dropped while the socket is away is billed as delivered: `be-route-transport.md:874`, `be-engine-turntaking.md:734` | **Both are partly true.** Audio drained by a cancel is not billed. Audio dropped with `DROPPED` (no socket) is billed and stored. The strength needs that qualifier. |
| K12 | Stored reply vs heard | "The stored reply matches what the user heard": `e2e-latency-trace.md:389` (strength) | C24 (supersede after `voice_turn_end` keeps the full reply), C25 (sentence-granular cut, output latency ignored), C26 (barge-in after completion keeps the unheard reply), C27 | **Only on the mid-stream barge-in path.** The strength must be qualified. |
| K13 | TTS queue limit | "TTS queue max sentences 4 (FACT)": `e2e-latency-trace.md:154` | The constant is dead and the queue is unbounded: `be-engine-turntaking.md:651`; `be-tts.md:274` | **Dead constant, FACT per two notes.** |
| K14 | Crash-orphan window | Up to 15 min: `be-observability-safety-cost.md:535`; 10-15 min: `be-route-transport.md:555` | About 10-11 min after call **start**, then the full reservation is charged: verifier `be-observability-safety-cost.md:687` | **10-11 min** (600 s max call + 60 s sweep cadence). The verifier also found that the user's own new calls are blocked until then. |
| K15 | ElevenLabs TTFB evidence | "No in-repo measurement found": `be-tts.md:162` (T8) | "TTS TTFB 149 ms": `be-engine-turntaking.md:394`; `e2e-latency-trace.md:193`; `FE:docs/voice_refactor/00_current_status_and_roadmap.md:61` | **One local sample exists** (149 ms). There is still no distribution. |
| K16 | Groq HTTP client | "The Groq HTTP client is persistent" (strength): `e2e-latency-trace.md:394` | `keepalive_expiry=5.0`, so pooled connections expire between turns: `be-stt.md:96`, `:195`, `:235`, verifier `:385` | **Both are true, but the strength is misleading.** The client object persists, while its connections almost never survive the gap between two turns. |
| K17 | Fish lane prewarm and enablement | "No prewarm": E2E-14 finding | `connect_early=True` opens the socket at `begin_turn`: verifier `e2e-latency-trace.md:431`; `:241` | **Prewarm exists**, at LLM admission rather than during STT. Fish is off by default in code (`fish_audio/config.py:87` per `be-observability-safety-cost.md:690`), but enabled in the dev `.env` (line 102, checked during this pass; values not reproduced). |
| K18 | Minimum barge-in duration | "no minimum duration": BE-ENGINE-07 finding; "no backchannel filter": E2E-08 finding | `BARGE_IN_MIN_SPEECH_MS = 500` while audible: verifiers `be-engine-turntaking.md:733`, `e2e-latency-trace.md:425`; `fe-capture.md:372` | **500 ms, FACT.** Short coughs are filtered. Backchannels of 500 ms or more still cut the reply irrevocably (C15). |
| K19 | STT latency estimates | 150-500 ms p50: `be-stt.md:196`; 350-800: `e2e-latency-trace.md:181`; 250-900: `be-engine-turntaking.md:405`; 250-800: `be-observability-safety-cost.md:316` | Measured in dev: p50 526, p90 847, p95 1,002, max 1,481 ms (n = 23, clips 0.9-2.1 s) | **The measured p50 sits at the top of be-stt's range and in the middle of the others.** p95 is about 1 s even for short clips. `latency_ms` includes connection setup (`stt_groq_client.py:90-109`: `start` wraps the whole `post`), which fits C09. be-stt's 150-500 ms is optimistic. |
| K20 | End-to-end total (speech end to first audio) | 2.5-5 s: `be-engine-turntaking.md:417`; typical 2.6-4.0 s: `e2e-latency-trace.md:200-202`; 2.0-4.5 s: `be-observability-safety-cost.md:331`; 1.9-3.3 s: `../research/r01-cascaded-architecture.md:23` | One sample: 4.9 s after upload (`roadmap.md:61`) | **Reconciled: about 3.2-4.2 s typical** with the measured anchors (section 7). be-engine's lower bound uses the wrong hang-over (K01). r01's 1.9-3.3 s is a design-target estimate, not the current system. |
| K21 | fe-capture simulation numbers | Finding text `fe-capture.md:250` | Simulation table `fe-capture.md:417-421`; re-simulation `:455-460` | The three disagree on false-trigger counts. **Use the verifier's re-simulation** (`:455-460`) and treat all three as illustrative, not measured. |

### 5.2 Minor: wrong details that do not change a conclusion

| # | Item | Correction (source) |
|---|---|---|
| K22 | BE-STT-06 repetition examples | "Sí, sí, sí." has a zlib ratio of 0.83. A trip needs about 9-12 repetitions (`be-stt.md:387`). |
| K23 | BE-TTS-02 language list | Korean is not affected. Thai is delayed, not held (`be-tts.md:351`). |
| K24 | FE-UI-06 `idle_timeout` | Idle ends cannot cut mid-word. Only `max_duration` and `quota` can (`fe-ui.md:617`). |
| K25 | BE-OBS-12 "drained = unheard" | `drained_chars` counts characters whose audio was never delivered to the BFF (`be-observability-safety-cost.md:688`). |
| K26 | BE-ENGINE-09 path | The verifier cites `conversation_execution.py:56-86` for the history builder (`be-engine-turntaking.md:735`). Use that path. |
| K27 | E2E-02 citation | `CallScreen.tsx:100` should be `:114` (`e2e-latency-trace.md:419`). |
| K28 | Sticky routing key | The docs never name `voice_session_id`. Sticky routing on the chat id in the URL is feasible (`be-route-transport.md:868` vs `:417`, `:523`). |
| K29 | STT timeout "pinned in code" | `VOICE_STT_TIMEOUT_SECONDS` is env-tunable from 0.1 to 120 s. Only the model and provider are pinned (`be-route-transport.md:876`; `be-stt.md:155`). |
| K30 | "No X-Request-Id" | It exists on the stories, assistant, lorebook, images and llm_inference routes, but not on voice (`be-observability-safety-cost.md:685`). |
| K31 | Dropped observability fields | Rejected segments keep `category` and `duration_ms`, and the DB row stores `error_category` and `stt_summary` (`be-observability-safety-cost.md:682`). |
| K32 | Moderation "off" | Off is a dev configuration. The code default for `required` is true (`be-observability-safety-cost.md:677`, `be-llm.md:695`). |

### 5.3 Errata for the synthesizer

When these notes are folded into the top-level `docs/call_realtime` documents, apply K01, K02, K05, K06, K07,
K09, K10, K13, K14, K16, K18 and K19 literally. Qualify the strengths in K11, K12 and K16. Do not cite
be-engine's 2.5 s lower bound or be-stt's 150-500 ms STT range.

---

## 6. New dev-database evidence (FACT for the dev DB; small n)

**Method:** scripts in the session scratchpad (`stt_dev_stats.py`, `stt_dev_status.py`, `asst_dev_stats.py`).
Each connects with the dev `.env` settings, runs `START TRANSACTION READ ONLY`, runs SELECT only, and rolls
back. No credential is printed. The table is `voice_transcript_segment`, whose schema is at
`API:src/database/mysql/db.sql:484`. Rows span 2026-10-19 23:48 to 2026-10-20 22:23.

```sql
SELECT status, role, duration_ms, stt_summary, created_at FROM voice_transcript_segment WHERE role='user' ORDER BY created_at;
SELECT status, error_category, duration_ms, JSON_EXTRACT(stt_summary,'$.latency_ms'), JSON_EXTRACT(stt_summary,'$.model'),
       JSON_EXTRACT(stt_summary,'$.no_speech_reason'), created_at, completed_at
  FROM voice_transcript_segment WHERE role='user' AND status <> 'completed' ORDER BY created_at;
SELECT tts_summary, CHAR_LENGTH(transcript_text) FROM voice_transcript_segment WHERE role='assistant';
```

| Measure | Value |
|---|---|
| User segments | 24: completed 17, failed 5, cancelled 1 (`end_call`), accepted 1 |
| Segment `duration_ms` | p50 1,312, p90 1,879, max 2,092 (all of them 3 s or shorter) |
| STT `stt_summary.latency_ms` (n = 23) | min 422, **p50 526**, p90 847, **p95 1,002**, max 1,481, mean 606 |
| Failed user segments | 5, all `error_category='internal'`, all `whisper-large-v3`, STT latency 459-761 ms, `completed_at` within about 1 s of `created_at` |
| Orphan row | 1 `accepted` row with no `stt_summary` and no `completed_at` (2026-10-20 22:20:55) |
| Assistant `tts_summary.duration_ms` (n = 17) | min 7,784, **p50 17,554**, p90 22,883, max 24,163. 16 of 17 are 7.8 s or longer. |
| Assistant text length (n = 17) | min 56, p50 127, max 317 characters |

Interpretation:

- **STT (FACT/INFERENCE):** even 1-2 s clips take about 0.5 s at p50 and 1 s at p95. `latency_ms` wraps the
  whole `post`, connection setup included (`API:src/services/voice_orchestration/stt_groq_client.py:90-109`).
  The 5 s keepalive expiry (C09/BE-STT-04) is therefore likely part of this figure (INFERENCE). Groq inference
  alone is about 15-30 ms per the be-stt estimate (`be-stt.md:196`).
- **"internal" failures (FACT, cause UNKNOWN):**
  - 5 of 23 segments that reached STT ended `failed/internal`, about 22%.
  - Each failed about 1 s after `created_at`, which places the failure after STT and before an LLM reply could
    complete (INFERENCE).
  - `internal` comes either from a non-orchestration exception, logged as `[VOICE_INTERNAL]` with a traceback
    (`API:src/services/voice_orchestration/engine.py:3112`), or from "Voice turn did not complete." (`:2643`).
  - The `[VOICE_INTERNAL]` log lines for those timestamps will tell which. This is not one of the audited
    findings, and is new.
- **Orphan `accepted` row:** confirms BE-STT-03 (C32) in real data.
- **Long replies (FACT for dev, INFERENCE for meaning):** the median reply carries 17.6 s of audio for 127
  characters, which is about 7 characters per second.
  - That is about half the rate the notes assume: the ledger default is 65 ms per character, about 15
    characters per second (`be-tts.md:132`, `call_ledger.py:56`), and the be-tts cost inference also uses about
    15 characters per second (`be-tts.md:304`).
  - Either the voice and tags slow speech (cues, pauses), or `tts_summary.duration_ms` measures something other
    than pure audio (UNKNOWN, needs a check of the writer).
  - If the 65 ms/char default ever maps `played_ms` to characters without alignment, the heard prefix would be
    over-estimated by up to 2 times (INFERENCE, strengthens C25).
  - The BE-ENGINE-TURNTAKING-01 verifier says every reply has an unprotected tail of up to 8 s, and a short
    reply is unprotected in full (`be-engine-turntaking.md:727`). In dev, only 1 of 17 replies is under 8 s.
    The full-reply case is therefore rare, but nearly every reply reaches the 8 s tail (INFERENCE, C24).
  - Long replies also raise the share of turns where barge-in behaviour (C15, C16) and socket-away audio (C22)
    matter.

---

## 7. Reconciled latency budget (EL lane, speech end to first audible audio)

Anchors that replace inferred values: the hang-over of 550 ms (K01), STT from dev data (K19), LLM first text
from one callbot transport probe (`FE:docs/fish_audio_support/evidence/2026-10-15-call-profiles.json`:
`callbot_transport_probe.first_text_ms = 1,578.794`; `be-llm.md:338`), and EL TTFB from one sample (K15).

| # | Stage | Reconciled (ms) | Source | Label |
|---|---|---|---|---|
| 1 | VAD hang-over | 550 (constant) | `CallScreen.tsx:114`; `e2e-latency-trace.md:174` | FACT |
| 2 | WAV build + SHA-256 | 2-15 | `e2e-latency-trace.md:175` | INFERENCE |
| 3 | Upload | 20-150 (700 on a mobile uplink) | `e2e-latency-trace.md:176` | INFERENCE |
| 4 | Route preamble | 15-60 | `e2e-latency-trace.md:177` | INFERENCE |
| 5 | `accept_segment` + segment rows and acks | 10-40 | `e2e-latency-trace.md:178`, `:180` | INFERENCE |
| 6 | Groq STT | **526 p50 / 1,002 p95** | dev DB (section 6); `stt_groq_client.py:90-109` | FACT (dev, short clips) |
| 7 | STT billing + segment `completed` | 10-40 | `e2e-latency-trace.md:182` | INFERENCE |
| 8 | Callbot prepare + BFF admission | 30-150 | `e2e-latency-trace.md:184` | INFERENCE |
| 9 | Dispatch, api.magic_llm pipeline, magic-llm, provider TTFT | **about 1,579** (one probe; range 600-2,500) | `be-llm.md:338`; `e2e-latency-trace.md:185-188` | FACT for one sample |
| 10 | First sentence complete | 200-600 | `e2e-latency-trace.md:190` | INFERENCE |
| 11 | Moderation, sentence 1 | 0 in dev; up to 300 if required | `e2e-latency-trace.md:191`; K07 | FACT (config) |
| 12 | EL first audio | 150-350 (149 sample) | `e2e-latency-trace.md:193` | INFERENCE + 1 sample |
| 13 | Downlink + base64 decode | 10-40 | `e2e-latency-trace.md:195` | INFERENCE |
| 14 | MSE append + output | 50-150 (400 with Bluetooth) | `e2e-latency-trace.md:196` | INFERENCE |
| | **Total** | **about 3.2-4.2 s** (STT p50); **about 3.6-4.7 s** (STT p95); add up to 0.3 s with required moderation | sum | INFERENCE |

Notes:

- The sum is 2,658 ms fixed (550 + 3 + 526 + 1,579) plus 495-1,580 ms of variable stages (INFERENCE).
- Stages 1, 6 and 9 make up about 80% of the typical total. These are C02/C03, C01 and C08/C09/C07.
- The documented "first audio 4.9 s after upload" (`roadmap.md:61`) is about 5.5 s from speech end. It is
  above the reconciled range, so tails are worse and need real p95 data (C13).

---

## 8. Consensus strengths (confirmed by two or more notes; qualified where a contradiction applies)

1. The EL socket is prewarmed during STT, and a per-turn context opens in parallel with the LLM.
   Sources: `e2e-latency-trace.md:387`, `be-tts.md:289-290`, `be-stt.md:349`, `be-llm.md:639`,
   `be-engine-turntaking.md:672`.
2. Cancellation is prompt end to end, as far as api.magic_llm.
   Sources: `be-llm.md:641`, `be-engine-turntaking.md:667`.
   - Qualifier: provider-side stop is UNKNOWN (A01).
3. Truncation to the heard prefix on mid-stream barge-in.
   Sources: `fe-playback-transport.md:496`, `fe-capture.md:373`, `fe-ui.md:531`, `be-llm.md:643`,
   `be-engine-turntaking.md:661`, `be-observability-safety-cost.md:644`.
   - Qualifier: not on the supersede-after-end path or the completed-turn path (K12).
4. Immediate client flush with stale-frame defence by turn id and seq.
   Sources: `fe-playback-transport.md:491`, `:497`, `fe-ui.md:534`, `e2e-latency-trace.md:390`.
5. A flush-ahead gate paced by real playback reports bounds TTS spend and drained characters.
   Sources: `be-tts.md:291`, `be-engine-turntaking.md:674`, `e2e-latency-trace.md:388`.
6. A 500 ms minimum interruption while audible, LiveKit-style, plus an AEC warm-up.
   Sources: `fe-capture.md:372`, `fe-playback-transport.md:498`, `fe-ui.md:537`.
7. Idempotent, SHA-checked uploads with exactly one safe resend.
   Sources: `fe-playback-transport.md:500`, `fe-capture.md:376`, `be-stt.md:348`, `e2e-latency-trace.md:390`.
8. Typed, allow-listed protocol on both sides.
   Sources: `fe-playback-transport.md:490`, `be-route-transport.md:818`.
   - Qualifier: strictness also ends calls (C29).
9. Privacy by construction: no raw audio is persisted (only its SHA), and logs are allow-listed.
   Sources: `be-stt.md:346`, `be-observability-safety-cost.md:626-629`, `fe-playback-transport.md:502`.
10. An end-to-end `user_stop_ttfb_ms` metric design, with process-local p50/p95 histograms.
    Sources: `be-stt.md:353`, `be-tts.md:296`, `be-engine-turntaking.md:682`, `fe-capture.md:377`,
    `e2e-latency-trace.md:427`.
    - Qualifier: not persisted, no client mark, alerts are log lines only (C13, K10).
11. Atomic cross-worker quota reservation, and graceful shutdown that releases with billed seconds.
    Sources: `be-route-transport.md:819`, `be-observability-safety-cost.md:640`, verifier
    `be-route-transport.md:870`.
12. A bounded callbot contract: a system profile only, 1,536 output tokens, 30 s.
    Source: `be-llm.md:644`.
    - Qualifier: the output cap is still about 4 times the roadmap target (K06).

---

## 9. Remaining open questions (deduplicated; the first source is listed, aliases in brackets)

1. Production callbot model, provider route and `reasoning_effort`, and their TTFT p50/p95
   (`be-llm.md:651` [`e2e-latency-trace.md:404`]).
2. Production topology: replicas, reverse proxy read and idle timeouts, HTTP/2, and co-location and RTT of
   api.magic_llm, api.auth and MySQL (`be-route-transport.md:848-849` [`be-llm.md:652`, `be-stt.md:360`, `:367`,
   `e2e-latency-trace.md:400-403`, `fe-capture.md:441`, `fe-playback-transport.md:513`,
   `be-engine-turntaking.md:696`]).
3. Production moderation setting and classifier p50/p95 against the 300 ms budget
   (`be-observability-safety-cost.md:654` [`be-llm.md:655`, `e2e-latency-trace.md:405`, `be-tts.md` Q3]).
4. Whether OpenRouter and the provider stop generating and billing on disconnect (`be-llm.md:654`). This is
   all that remains of A01.
5. Browser AEC effectiveness per platform, and the raw-fallback rate (`fe-capture.md:438-439`
   [`fe-playback-transport.md:515`, `e2e-latency-trace.md:407`, `be-stt.md:364`, `fe-ui.md:599`]). This sizes C05.
6. Real per-stage p50/p95 on target devices, including the client first-audible mark (`e2e-latency-trace.md:406`
   [`fe-ui.md:598`, `fe-capture.md:440`, `be-route-transport.md:850`, `be-llm.md:657`]).
7. Cause of the 5 dev `failed/internal` segments, from the `[VOICE_INTERNAL]` log lines (new, section 6).
8. What `tts_summary.duration_ms` measures, and the real characters per second of call voices (new, section 6).
9. Whether the model emits leading or trailing whitespace or `<think>` blocks (`be-llm.md:653`). This sizes C10
   and C38.
10. Half-open socket detection on the server while audio is being sent (K04, needs a test).
11. EL and Fish chunk sizes and cadence, and MP3 encoder gaps between flushes (`fe-playback-transport.md:511-512`
    [`be-route-transport.md:852`, `be-tts.md` Q1-Q2]).
12. Groq tier, rate limits and the per-request billing floor (`be-stt.md:359` [`fe-capture.md:444`,
    `be-observability-safety-cost.md:666`]).
13. Product and legal: per-call consent display, companion-chatbot law scope, transcript retention, whether
    speech seconds consume credits, half-duplex for AEC-off devices, and calls surviving navigation
    (`fe-ui.md:592`, `:596`; `be-observability-safety-cost.md:661`, `:665`; `be-stt.md:366`; `fe-capture.md:445`).
14. Language mix outside en/es (sizes C18 and C33) (`be-tts.md` Q4 [`be-stt.md:363`]).
15. Whether the 20 s resume grace is enough for mobile handoffs (`be-route-transport.md:853`).

---

## Appendix A. Per-ID reconciliation (209 IDs)

Columns: heading location, header severity, verifier verdict with its row line in the same note, final severity (R1), and the canonical issue. ↓ marks a downgrade.

| ID | Heading | Header | Verification | Final | Canonical |
|---|---|---|---|---|---|
| FE-CAPTURE-01 | `fe-capture.md:237` | high | confirmed (:455) | **high** | C05 |
| FE-CAPTURE-02 | `fe-capture.md:246` | high | confirmed (:456) | **high** | C03 |
| FE-CAPTURE-03 | `fe-capture.md:255` | high | confirmed (:457) | **high** | C01 |
| FE-CAPTURE-04 | `fe-capture.md:261` | medium | confirmed (:458) | **medium** | C02 |
| FE-CAPTURE-05 | `fe-capture.md:268` | medium | confirmed (:459) | **medium** | C15 |
| FE-CAPTURE-06 | `fe-capture.md:274` | medium | confirmed (:460) | **medium** | C45 |
| FE-CAPTURE-07 | `fe-capture.md:281` | medium | confirmed (:461) | **medium** | C46 |
| FE-CAPTURE-08 | `fe-capture.md:288` | medium | confirmed (:462) | **medium** | C47 |
| FE-CAPTURE-09 | `fe-capture.md:295` | medium | confirmed (:463) | **medium** | C13 |
| FE-CAPTURE-10 | `fe-capture.md:302` | medium | adjusted (:464) | **low** ↓ | C21 |
| FE-CAPTURE-11 | `fe-capture.md:308` | medium | adjusted (:465) | **low** ↓ | C67 |
| FE-CAPTURE-12 | `fe-capture.md:314` | medium | adjusted (:466) | **low** ↓ | C63 |
| FE-CAPTURE-13 | `fe-capture.md:320` | low | not verified | **low** | single |
| FE-CAPTURE-14 | `fe-capture.md:326` | low | not verified | **low** | single |
| FE-CAPTURE-15 | `fe-capture.md:331` | low | not verified | **low** | C77 |
| FE-CAPTURE-16 | `fe-capture.md:336` | low | not verified | **low** | single |
| FE-CAPTURE-17 | `fe-capture.md:341` | low | not verified | **low** | single |
| FE-CAPTURE-18 | `fe-capture.md:346` | low | not verified | **low** | C80 |
| FE-CAPTURE-19 | `fe-capture.md:355` | info | not verified | **info** | C05 |
| FE-CAPTURE-20 | `fe-capture.md:360` | info | not verified | **info** | single |
| FE-PLAYBACK-TRANSPORT-01 | `fe-playback-transport.md:289` | high | confirmed (:528) | **high** | C11 |
| FE-PLAYBACK-TRANSPORT-02 | `fe-playback-transport.md:299` | high | adjusted (:529) | **medium** ↓ | C22 |
| FE-PLAYBACK-TRANSPORT-03 | `fe-playback-transport.md:307` | high | adjusted (:530) | **medium** ↓ | C23 |
| FE-PLAYBACK-TRANSPORT-04 | `fe-playback-transport.md:315` | medium | confirmed (:531) | **medium** | C27 |
| FE-PLAYBACK-TRANSPORT-05 | `fe-playback-transport.md:323` | medium | confirmed (:532) | **medium** | C13 |
| FE-PLAYBACK-TRANSPORT-06 | `fe-playback-transport.md:331` | medium | confirmed (:533) | **medium** | C01 |
| FE-PLAYBACK-TRANSPORT-07 | `fe-playback-transport.md:344` | medium | confirmed (:534) | **medium** | C15 |
| FE-PLAYBACK-TRANSPORT-08 | `fe-playback-transport.md:352` | medium | adjusted (:535) | **low** ↓ | C68 |
| FE-PLAYBACK-TRANSPORT-09 | `fe-playback-transport.md:360` | medium | adjusted (:536) | **medium** | C48 |
| FE-PLAYBACK-TRANSPORT-10 | `fe-playback-transport.md:368` | low | not verified | **low** | single |
| FE-PLAYBACK-TRANSPORT-11 | `fe-playback-transport.md:376` | low | not verified | **low** | single |
| FE-PLAYBACK-TRANSPORT-12 | `fe-playback-transport.md:384` | low | not verified | **low** | single |
| FE-PLAYBACK-TRANSPORT-13 | `fe-playback-transport.md:392` | low | not verified | **low** | C25 |
| FE-PLAYBACK-TRANSPORT-14 | `fe-playback-transport.md:400` | low | not verified | **low** | C52 |
| FE-PLAYBACK-TRANSPORT-15 | `fe-playback-transport.md:408` | low | not verified | **low** | C76 |
| FE-PLAYBACK-TRANSPORT-16 | `fe-playback-transport.md:416` | low | not verified | **low** | C49 |
| FE-PLAYBACK-TRANSPORT-17 | `fe-playback-transport.md:424` | low | not verified | **low** | single |
| FE-PLAYBACK-TRANSPORT-18 | `fe-playback-transport.md:432` | low | not verified | **low** | C29 |
| FE-PLAYBACK-TRANSPORT-19 | `fe-playback-transport.md:442` | low | not verified | **low** | C78 |
| FE-PLAYBACK-TRANSPORT-20 | `fe-playback-transport.md:450` | low | not verified | **low** | C77 |
| FE-PLAYBACK-TRANSPORT-21 | `fe-playback-transport.md:458` | low | not verified | **low** | single |
| FE-PLAYBACK-TRANSPORT-22 | `fe-playback-transport.md:469` | medium | confirmed (:537) | **medium** | C57 |
| FE-PLAYBACK-TRANSPORT-23 | `fe-playback-transport.md:477` | info | not verified | **info** | single |
| FE-UI-01 | `fe-ui.md:268` | high | adjusted (:612) | **medium** ↓ | C16 |
| FE-UI-02 | `fe-ui.md:284` | medium | confirmed (:613) | **medium** | C05 |
| FE-UI-03 | `fe-ui.md:296` | medium | confirmed (:614) | **medium** | C49 |
| FE-UI-04 | `fe-ui.md:306` | medium | confirmed (:615) | **medium** | C50 |
| FE-UI-05 | `fe-ui.md:317` | medium | confirmed (:616) | **medium** | C51 |
| FE-UI-06 | `fe-ui.md:331` | medium | adjusted (:617) | **medium** | C52 |
| FE-UI-07 | `fe-ui.md:340` | medium | confirmed (:618) | **medium** | C53 |
| FE-UI-08 | `fe-ui.md:349` | medium | adjusted (:619) | **low** ↓ | C73 |
| FE-UI-09 | `fe-ui.md:359` | medium | confirmed (:620) | **medium** | C54 |
| FE-UI-10 | `fe-ui.md:371` | medium | confirmed (:621) | **medium** | C55 |
| FE-UI-11 | `fe-ui.md:381` | medium | confirmed (:622) | **medium** | C56 |
| FE-UI-12 | `fe-ui.md:392` | low | not verified | **low** | single |
| FE-UI-13 | `fe-ui.md:405` | low | not verified | **low** | single |
| FE-UI-14 | `fe-ui.md:413` | low | not verified | **low** | single |
| FE-UI-15 | `fe-ui.md:419` | low | not verified | **low** | single |
| FE-UI-16 | `fe-ui.md:426` | low | not verified | **low** | single |
| FE-UI-17 | `fe-ui.md:438` | low | not verified | **low** | single |
| FE-UI-18 | `fe-ui.md:448` | low | not verified | **low** | C77 |
| FE-UI-19 | `fe-ui.md:457` | low | not verified | **low** | C13 |
| FE-UI-20 | `fe-ui.md:464` | low | not verified | **low** | single |
| FE-UI-21 | `fe-ui.md:472` | low | not verified | **low** | single |
| FE-UI-22 | `fe-ui.md:480` | low | not verified | **low** | single |
| FE-UI-23 | `fe-ui.md:488` | low | not verified | **low** | single |
| FE-UI-24 | `fe-ui.md:495` | low | not verified | **low** | single |
| FE-UI-25 | `fe-ui.md:504` | low | not verified | **low** | single |
| FE-UI-26 | `fe-ui.md:511` | info | not verified | **info** | single |
| FE-UI-27 | `fe-ui.md:515` | info | not verified | **info** | single |
| FE-UI-28 | `fe-ui.md:520` | info | not verified | **info** | single |
| BE-ROUTE-TRANSPORT-01 | `be-route-transport.md:491` | high | confirmed (:867) | **high** | C01 |
| BE-ROUTE-TRANSPORT-02 | `be-route-transport.md:515` | medium | adjusted (:868) | **low** ↓ | C65 |
| BE-ROUTE-TRANSPORT-03 | `be-route-transport.md:536` | medium | confirmed (:869) | **medium** | C30 |
| BE-ROUTE-TRANSPORT-04 | `be-route-transport.md:555` | medium | confirmed (:870) | **medium** | C31 |
| BE-ROUTE-TRANSPORT-05 | `be-route-transport.md:577` | medium | adjusted (:871) | **medium** | C28 |
| BE-ROUTE-TRANSPORT-06 | `be-route-transport.md:600` | medium | confirmed (:872) | **medium** | C29 |
| BE-ROUTE-TRANSPORT-07 | `be-route-transport.md:617` | medium | confirmed (:873) | **medium** | C21 |
| BE-ROUTE-TRANSPORT-08 | `be-route-transport.md:630` | medium | confirmed (:874) | **medium** | C22 |
| BE-ROUTE-TRANSPORT-09 | `be-route-transport.md:651` | medium | adjusted (:875) | **low** ↓ | C61 |
| BE-ROUTE-TRANSPORT-10 | `be-route-transport.md:664` | medium | adjusted (:876) | **low** ↓ | C06 |
| BE-ROUTE-TRANSPORT-11 | `be-route-transport.md:682` | low | not verified | **low** | C77 |
| BE-ROUTE-TRANSPORT-12 | `be-route-transport.md:694` | low | not verified | **low** | single |
| BE-ROUTE-TRANSPORT-13 | `be-route-transport.md:709` | low | not verified | **low** | C52 |
| BE-ROUTE-TRANSPORT-14 | `be-route-transport.md:723` | low | not verified | **low** | single |
| BE-ROUTE-TRANSPORT-15 | `be-route-transport.md:738` | low | not verified | **low** | single |
| BE-ROUTE-TRANSPORT-16 | `be-route-transport.md:748` | low | not verified | **low** | C13 |
| BE-ROUTE-TRANSPORT-17 | `be-route-transport.md:770` | low | not verified | **low** | C78 |
| BE-ROUTE-TRANSPORT-18 | `be-route-transport.md:784` | info | not verified | **info** | C76 |
| BE-ROUTE-TRANSPORT-19 | `be-route-transport.md:800` | info | not verified | **info** | C80 |
| BE-STT-01 | `be-stt.md:216` | high | confirmed (:382) | **high** | C01 |
| BE-STT-02 | `be-stt.md:222` | high | confirmed (:383) | **high** | C06 |
| BE-STT-03 | `be-stt.md:228` | medium | confirmed (:384) | **medium** | C32 |
| BE-STT-04 | `be-stt.md:234` | medium | confirmed (:385) | **medium** | C09 |
| BE-STT-05 | `be-stt.md:240` | medium | confirmed (:386) | **medium** | C19 |
| BE-STT-06 | `be-stt.md:246` | medium | adjusted (:387) | **low** ↓ | C74 |
| BE-STT-07 | `be-stt.md:253` | medium | confirmed (:388) | **medium** | C33 |
| BE-STT-08 | `be-stt.md:259` | medium | confirmed (:389) | **medium** | C03 |
| BE-STT-09 | `be-stt.md:265` | medium | confirmed (:390) | **medium** | C13 |
| BE-STT-10 | `be-stt.md:271` | medium | confirmed (:391) | **medium** | C01 |
| BE-STT-11 | `be-stt.md:277` | medium | adjusted (:392) | **low** ↓ | C64 |
| BE-STT-12 | `be-stt.md:283` | low | not verified | **low** | C63 |
| BE-STT-13 | `be-stt.md:289` | low | not verified | **low** | single |
| BE-STT-14 | `be-stt.md:295` | low | not verified | **low** | single |
| BE-STT-15 | `be-stt.md:301` | low | not verified | **low** | single |
| BE-STT-16 | `be-stt.md:307` | low | not verified | **low** | single |
| BE-STT-17 | `be-stt.md:313` | low | not verified | **low** | C62 |
| BE-STT-18 | `be-stt.md:319` | low | not verified | **low** | single |
| BE-STT-19 | `be-stt.md:324` | low | not verified | **low** | single |
| BE-STT-20 | `be-stt.md:330` | info | not verified | **info** | C80 |
| BE-STT-21 | `be-stt.md:334` | info | not verified | **info** | C15 |
| BE-ENGINE-TURNTAKING-01 | `be-engine-turntaking.md:427` | high | adjusted (:727) | **medium** ↓ | C24 |
| BE-ENGINE-TURNTAKING-02 | `be-engine-turntaking.md:449` | high | confirmed (:728) | **high** | C02 |
| BE-ENGINE-TURNTAKING-03 | `be-engine-turntaking.md:468` | medium | confirmed (:729) | **medium** | C19 |
| BE-ENGINE-TURNTAKING-04 | `be-engine-turntaking.md:482` | medium | adjusted (:730) | **medium** | C04 |
| BE-ENGINE-TURNTAKING-05 | `be-engine-turntaking.md:496` | medium | confirmed (:731) | **medium** | C20 |
| BE-ENGINE-TURNTAKING-06 | `be-engine-turntaking.md:510` | medium | confirmed (:732) | **medium** | C21 |
| BE-ENGINE-TURNTAKING-07 | `be-engine-turntaking.md:524` | medium | adjusted (:733) | **medium** | C15 |
| BE-ENGINE-TURNTAKING-08 | `be-engine-turntaking.md:536` | medium | adjusted (:734) | **low** ↓ | C22 |
| BE-ENGINE-TURNTAKING-09 | `be-engine-turntaking.md:548` | medium | confirmed (:735) | **medium** | C25 |
| BE-ENGINE-TURNTAKING-10 | `be-engine-turntaking.md:560` | low | not verified | **low** | C62 |
| BE-ENGINE-TURNTAKING-11 | `be-engine-turntaking.md:570` | low | not verified | **low** | single |
| BE-ENGINE-TURNTAKING-12 | `be-engine-turntaking.md:578` | medium | confirmed (:736) | **medium** | C06 |
| BE-ENGINE-TURNTAKING-13 | `be-engine-turntaking.md:587` | low | not verified | **low** | C38 |
| BE-ENGINE-TURNTAKING-14 | `be-engine-turntaking.md:597` | low | not verified | **low** | C69 |
| BE-ENGINE-TURNTAKING-15 | `be-engine-turntaking.md:605` | low | not verified | **low** | single |
| BE-ENGINE-TURNTAKING-16 | `be-engine-turntaking.md:613` | low | not verified | **low** | C61 |
| BE-ENGINE-TURNTAKING-17 | `be-engine-turntaking.md:622` | low | not verified | **low** | C13 |
| BE-ENGINE-TURNTAKING-18 | `be-engine-turntaking.md:633` | low | not verified | **low** | C28 |
| BE-ENGINE-TURNTAKING-19 | `be-engine-turntaking.md:642` | low | not verified | **low** | C05 |
| BE-ENGINE-TURNTAKING-20 | `be-engine-turntaking.md:651` | info | not verified | **info** | C79 |
| BE-LLM-01 | `be-llm.md:404` | high | confirmed (:681) | **high** | C10 |
| BE-LLM-02 | `be-llm.md:414` | high | confirmed (:682) | **high** | C08 |
| BE-LLM-03 | `be-llm.md:432` | high | confirmed (:683) | **high** | C09 |
| BE-LLM-04 | `be-llm.md:446` | medium | confirmed (:685) | **medium** | C39 |
| BE-LLM-05 | `be-llm.md:457` | high | adjusted (:684) | **high** | C07 |
| BE-LLM-06 | `be-llm.md:468` | medium | confirmed (:686) | **medium** | C19 |
| BE-LLM-07 | `be-llm.md:480` | medium | confirmed (:687) | **medium** | C34 |
| BE-LLM-08 | `be-llm.md:492` | medium | adjusted (:688) | **medium** | C35 |
| BE-LLM-09 | `be-llm.md:500` | medium | confirmed (:689) | **medium** | C36 |
| BE-LLM-10 | `be-llm.md:508` | medium | confirmed (:690) | **medium** | C37 |
| BE-LLM-11 | `be-llm.md:516` | medium | confirmed (:691) | **medium** | C17 |
| BE-LLM-12 | `be-llm.md:531` | medium | confirmed (:692) | **medium** | C26 |
| BE-LLM-13 | `be-llm.md:539` | medium | confirmed (:693) | **medium** | C38 |
| BE-LLM-14 | `be-llm.md:547` | medium | confirmed (:694) | **medium** | C20 |
| BE-LLM-15 | `be-llm.md:555` | medium | adjusted (:695) | **medium** | C04 |
| BE-LLM-16 | `be-llm.md:563` | low | not verified | **low** | C13 |
| BE-LLM-17 | `be-llm.md:575` | low | not verified | **low** | single |
| BE-LLM-18 | `be-llm.md:583` | low | not verified | **low** | single |
| BE-LLM-19 | `be-llm.md:597` | low | not verified | **low** | single |
| BE-LLM-20 | `be-llm.md:605` | low | not verified | **low** | C75 |
| BE-LLM-21 | `be-llm.md:613` | low | not verified | **low** | C08 |
| BE-LLM-22 | `be-llm.md:621` | info | not verified | **info** | C15 |
| BE-TTS-01 | `be-tts.md:178` | high | confirmed (:350) | **high** | C04 |
| BE-TTS-02 | `be-tts.md:183` | high | adjusted (:351) | **medium** ↓ | C18 |
| BE-TTS-03 | `be-tts.md:188` | medium | confirmed (:352) | **medium** | C17 |
| BE-TTS-04 | `be-tts.md:193` | medium | adjusted (:353) | **medium** | C40 |
| BE-TTS-05 | `be-tts.md:198` | medium | confirmed (:354) | **medium** | C41 |
| BE-TTS-06 | `be-tts.md:203` | high | confirmed (:355) | **high** | C14 |
| BE-TTS-07 | `be-tts.md:208` | medium | confirmed (:356) | **medium** | C61 |
| BE-TTS-08 | `be-tts.md:213` | medium | confirmed (:357) | **medium** | C25 |
| BE-TTS-09 | `be-tts.md:218` | medium | confirmed (:358) | **medium** | C42 |
| BE-TTS-10 | `be-tts.md:224` | low | not verified | **low** | single |
| BE-TTS-11 | `be-tts.md:229` | medium | confirmed (:359) | **medium** | C43 |
| BE-TTS-12 | `be-tts.md:234` | medium | confirmed (:360) | **medium** | C66 |
| BE-TTS-13 | `be-tts.md:239` | medium | confirmed (:361) | **medium** | C44 |
| BE-TTS-14 | `be-tts.md:244` | low | not verified | **low** | single |
| BE-TTS-15 | `be-tts.md:249` | low | not verified | **low** | single |
| BE-TTS-16 | `be-tts.md:254` | low | not verified | **low** | C76 |
| BE-TTS-17 | `be-tts.md:259` | low | not verified | **low** | C22 |
| BE-TTS-18 | `be-tts.md:264` | low | not verified | **low** | C13 |
| BE-TTS-19 | `be-tts.md:268` | low | not verified | **low** | C75 |
| BE-TTS-20 | `be-tts.md:273` | low | not verified | **low** | C79 |
| BE-TTS-21 | `be-tts.md:277` | info | not verified | **info** | single |
| BE-TTS-22 | `be-tts.md:281` | info | not verified | **info** | single |
| BE-OBSERVABILITY-SAFETY-COST-01 | `be-observability-safety-cost.md:341` | critical | adjusted (:677) | **high** ↓ | C04 |
| BE-OBSERVABILITY-SAFETY-COST-02 | `be-observability-safety-cost.md:373` | high | confirmed (:678) | **high** | C12 |
| BE-OBSERVABILITY-SAFETY-COST-03 | `be-observability-safety-cost.md:396` | medium | confirmed (:679) | **medium** | C19 |
| BE-OBSERVABILITY-SAFETY-COST-04 | `be-observability-safety-cost.md:415` | medium | confirmed (:680) | **medium** | C61 |
| BE-OBSERVABILITY-SAFETY-COST-05 | `be-observability-safety-cost.md:427` | high | confirmed (:681) | **high** | C13 |
| BE-OBSERVABILITY-SAFETY-COST-06 | `be-observability-safety-cost.md:455` | medium | adjusted (:682) | **low** ↓ | C70 |
| BE-OBSERVABILITY-SAFETY-COST-07 | `be-observability-safety-cost.md:473` | medium | adjusted (:683) | **low** ↓ | C71 |
| BE-OBSERVABILITY-SAFETY-COST-08 | `be-observability-safety-cost.md:485` | medium | confirmed (:684) | **medium** | C59 |
| BE-OBSERVABILITY-SAFETY-COST-09 | `be-observability-safety-cost.md:497` | medium | adjusted (:685) | **low** ↓ | C72 |
| BE-OBSERVABILITY-SAFETY-COST-10 | `be-observability-safety-cost.md:510` | medium | confirmed (:686) | **medium** | C58 |
| BE-OBSERVABILITY-SAFETY-COST-11 | `be-observability-safety-cost.md:527` | medium | adjusted (:687) | **medium** | C31 |
| BE-OBSERVABILITY-SAFETY-COST-12 | `be-observability-safety-cost.md:543` | medium | adjusted (:688) | **low** ↓ | C69 |
| BE-OBSERVABILITY-SAFETY-COST-13 | `be-observability-safety-cost.md:561` | medium | confirmed (:689) | **medium** | C60 |
| BE-OBSERVABILITY-SAFETY-COST-14 | `be-observability-safety-cost.md:575` | medium | adjusted (:690) | **low** ↓ | C66 |
| BE-OBSERVABILITY-SAFETY-COST-15 | `be-observability-safety-cost.md:587` | low | not verified | **low** | single |
| BE-OBSERVABILITY-SAFETY-COST-16 | `be-observability-safety-cost.md:597` | info | not verified | **info** | C06 |
| E2E-LATENCY-TRACE-01 | `e2e-latency-trace.md:288` | high | confirmed (:418) | **high** | C01 |
| E2E-LATENCY-TRACE-02 | `e2e-latency-trace.md:293` | high | confirmed (:419) | **high** | C02 |
| E2E-LATENCY-TRACE-03 | `e2e-latency-trace.md:297` | high | confirmed (:420) | **high** | C04 |
| E2E-LATENCY-TRACE-04 | `e2e-latency-trace.md:302` | medium | confirmed (:421) | **medium** | C19 |
| E2E-LATENCY-TRACE-05 | `e2e-latency-trace.md:310` | medium | adjusted (:422) | **low** ↓ | C64 |
| E2E-LATENCY-TRACE-06 | `e2e-latency-trace.md:312` | medium | confirmed (:423) | **medium** | C17 |
| E2E-LATENCY-TRACE-07 | `e2e-latency-trace.md:316` | medium | adjusted (:424) | **low** ↓ | C20 |
| E2E-LATENCY-TRACE-08 | `e2e-latency-trace.md:320` | high | adjusted (:425) | **medium** ↓ | C15 |
| E2E-LATENCY-TRACE-09 | `e2e-latency-trace.md:323` | medium | confirmed (:426) | **medium** | C05 |
| E2E-LATENCY-TRACE-10 | `e2e-latency-trace.md:326` | medium | adjusted (:427) | **low** ↓ | C13 |
| E2E-LATENCY-TRACE-11 | `e2e-latency-trace.md:330` | medium | adjusted (:428) | **low** ↓ | C07 |
| E2E-LATENCY-TRACE-12 | `e2e-latency-trace.md:335` | medium | confirmed (:429) | **medium** | C06 |
| E2E-LATENCY-TRACE-13 | `e2e-latency-trace.md:337` | medium | adjusted (:430) | **low** ↓ | C66 |
| E2E-LATENCY-TRACE-14 | `e2e-latency-trace.md:340` | medium | adjusted (:431) | **medium** | C43 |
| E2E-LATENCY-TRACE-15 | `e2e-latency-trace.md:345` | low | not verified | **low** | C65 |
| E2E-LATENCY-TRACE-16 | `e2e-latency-trace.md:347` | low | not verified | **low** | C48 |
| E2E-LATENCY-TRACE-17 | `e2e-latency-trace.md:352` | low | not verified | **low** | C63 |
| E2E-LATENCY-TRACE-18 | `e2e-latency-trace.md:354` | low | not verified | **low** | C21 |

## Appendix B. Canonical clusters (80)

Members show (verified final severity, V) or (header severity, u = unverified); `a→b` is a verifier downgrade. C13 was set to medium by rule R2 (section 2.3).

| Canonical ID | Severity | Category | Issue | Members |
|---|---|---|---|---|
| GAP-FINDING-RECONCILIATION-C01 | **high** | latency | Batch, post-endpoint uplink and batch STT: whole-utterance PCM WAV over HTTP after the 550 ms hang-over; no audio streaming, no streaming STT, no partials | FE-CAPTURE-03 (high, V); BE-ROUTE-TRANSPORT-01 (high, V); BE-STT-01 (high, V); E2E-LATENCY-TRACE-01 (high, V); FE-PLAYBACK-TRANSPORT-06 (medium, V); BE-STT-10 (medium, V) |
| GAP-FINDING-RECONCILIATION-C02 | **high** | ux | No semantic end-of-turn: fixed 550 ms energy-silence endpoint; pauses create premature fragment turns | E2E-LATENCY-TRACE-02 (high, V); BE-ENGINE-TURNTAKING-02 (high, V); FE-CAPTURE-04 (medium, V) |
| GAP-FINDING-RECONCILIATION-C03 | **high** | robustness | Energy-only VAD on both sides, no neural VAD anywhere: noise opens turns, fires barge-in, holds segments open up to 29.5 s | FE-CAPTURE-02 (high, V); BE-STT-08 (medium, V) |
| GAP-FINDING-RECONCILIATION-C04 | **high** | latency | Required per-sentence moderation is a serial 300 ms fail-closed gate through api.magic_llm before the first TTS push (latent launch blocker; off in dev) | BE-OBSERVABILITY-SAFETY-COST-01 (critical→high, V); E2E-LATENCY-TRACE-03 (high, V); BE-TTS-01 (high, V); BE-LLM-15 (medium, V); BE-ENGINE-TURNTAKING-04 (medium, V) |
| GAP-FINDING-RECONCILIATION-C05 | **high** | robustness | Echo self-supersede: with AEC off, raw fallback or the 3 s warm-up, segments still upload during playback and any transcript supersedes the reply; hint copy is wrong; no server echo guard | FE-CAPTURE-01 (high, V); FE-UI-02 (medium, V); E2E-LATENCY-TRACE-09 (medium, V); BE-ENGINE-TURNTAKING-19 (low, u); FE-CAPTURE-19 (info, u) |
| GAP-FINDING-RECONCILIATION-C06 | **high** | robustness | STT is single-shot with a 30 s timeout under intake_lock; no retry, hedge, breaker or fallback; model pinned in code | BE-STT-02 (high, V); BE-ENGINE-TURNTAKING-12 (medium, V); E2E-LATENCY-TRACE-12 (medium, V); BE-ROUTE-TRANSPORT-10 (medium→low, V); BE-OBSERVABILITY-SAFETY-COST-16 (info, u) |
| GAP-FINDING-RECONCILIATION-C07 | **high** | robustness | LLM has no TTFT/turn deadline, hedge, fallback profile or filler; llm_timeout unreachable; magic-llm retries blindly (3 x 30 s + 1 s), worst case about 92 s of silence | BE-LLM-05 (high, V); E2E-LATENCY-TRACE-11 (medium→low, V) |
| GAP-FINDING-RECONCILIATION-C08 | **high** | latency | api.magic_llm runs a durable-execution pipeline (second admission, about 16 recorder commits, hook writes, full-history snapshots) before the first provider byte | BE-LLM-02 (high, V); BE-LLM-21 (low, u) |
| GAP-FINDING-RECONCILIATION-C09 | **high** | latency | No pooled or prewarmed connections on per-turn hops: new httpx client BFF->api.magic_llm, new aiohttp session magic-llm->provider, Groq pool expires after 5 s | BE-LLM-03 (high, V); BE-STT-04 (medium, V) |
| GAP-FINDING-RECONCILIATION-C10 | **high** | correctness | Leading or trailing whitespace in the LLM reply fails the live turn after it is stored completed (reproduced) | BE-LLM-01 (high, V) |
| GAP-FINDING-RECONCILIATION-C11 | **high** | robustness | Resume mid-reply leaves a permanent audio seq gap: no server replay, client never skips the gap, turn never ends | FE-PLAYBACK-TRANSPORT-01 (high, V) |
| GAP-FINDING-RECONCILIATION-C12 | **high** | security-privacy | Self-harm detection on calls is inert (empty lists, disabled) and moderation only gates voicing, not the streamed text | BE-OBSERVABILITY-SAFETY-COST-02 (high, V) |
| GAP-FINDING-RECONCILIATION-C13 | **medium** | observability | End-to-end and per-stage latency cannot be measured in production: client first-audible mark never reported, server metric partial and in-process, stages log-only, no per-turn record | BE-OBSERVABILITY-SAFETY-COST-05 (high, V); FE-CAPTURE-09 (medium, V); FE-PLAYBACK-TRANSPORT-05 (medium, V); BE-STT-09 (medium, V); E2E-LATENCY-TRACE-10 (medium→low, V); FE-UI-19 (low, u); BE-ROUTE-TRANSPORT-16 (low, u); BE-TTS-18 (low, u); BE-ENGINE-TURNTAKING-17 (low, u); BE-LLM-16 (low, u) |
| GAP-FINDING-RECONCILIATION-C14 | **high** | robustness | One TTS reconnect budget; a second failure ends the voice leg for the rest of the call; no provider fallback or re-open | BE-TTS-06 (high, V) |
| GAP-FINDING-RECONCILIATION-C15 | **medium** | ux | Barge-in is immediate and irrevocable (500 ms of voiced energy): no pause-then-confirm, no resume, LLM generation discarded | E2E-LATENCY-TRACE-08 (high→medium, V); FE-CAPTURE-05 (medium, V); FE-PLAYBACK-TRANSPORT-07 (medium, V); BE-ENGINE-TURNTAKING-07 (medium, V); BE-STT-21 (info, u); BE-LLM-22 (info, u) |
| GAP-FINDING-RECONCILIATION-C16 | **medium** | ux | Short interjections said over the character are discarded: the 500 ms interruption threshold also gates segment capture | FE-UI-01 (high→medium, V) |
| GAP-FINDING-RECONCILIATION-C17 | **medium** | latency | First TTS unit waits for a whole sentence; abbreviation list swallows "no." and "am."; Spanish abbreviations missing | E2E-LATENCY-TRACE-06 (medium, V); BE-TTS-03 (medium, V); BE-LLM-11 (medium, V) |
| GAP-FINDING-RECONCILIATION-C18 | **medium** | latency | Sentence segmentation is ASCII-only: ja/zh/yue replies get no audio until the LLM finishes (ko unaffected, th delayed) | BE-TTS-02 (high→medium, V) |
| GAP-FINDING-RECONCILIATION-C19 | **medium** | latency | Serial BFF DB and STT-billing chain (about 13-15 round trips incl. debit + metadata rewrite) between segment receipt and LLM dispatch | BE-ENGINE-TURNTAKING-03 (medium, V); BE-STT-05 (medium, V); E2E-LATENCY-TRACE-04 (medium, V); BE-OBSERVABILITY-SAFETY-COST-03 (medium, V); BE-LLM-06 (medium, V) |
| GAP-FINDING-RECONCILIATION-C20 | **medium** | latency | Next turn waits (unbounded) for the previous turn cleanup, plus up to 3 s for a pending truncation write | BE-ENGINE-TURNTAKING-05 (medium, V); BE-LLM-14 (medium, V); E2E-LATENCY-TRACE-07 (medium→low, V) |
| GAP-FINDING-RECONCILIATION-C21 | **medium** | robustness | Turn lifetime is bound to the segment HTTP POST: long-held requests, proxy read timeouts, duplicate resend clears client state, 429 busy without retry | BE-ENGINE-TURNTAKING-06 (medium, V); BE-ROUTE-TRANSPORT-07 (medium, V); FE-CAPTURE-10 (medium→low, V); E2E-LATENCY-TRACE-18 (low, u) |
| GAP-FINDING-RECONCILIATION-C22 | **medium** | correctness | Audio produced while the socket is away is dropped, billed and stored as heard; uploads are not held during reconnect; resume has no replay | BE-ROUTE-TRANSPORT-08 (medium, V); FE-PLAYBACK-TRANSPORT-02 (high→medium, V); BE-ENGINE-TURNTAKING-08 (medium→low, V); BE-TTS-17 (low, u) |
| GAP-FINDING-RECONCILIATION-C23 | **medium** | robustness | Client dead-socket detection takes 50-75 s after the last frame, longer than the 20 s server grace; half-open drops mid-reply cannot resume | FE-PLAYBACK-TRANSPORT-03 (high→medium, V) |
| GAP-FINDING-RECONCILIATION-C24 | **medium** | correctness | A user segment that supersedes a turn after voice_turn_end neither cancels nor truncates it (AEC-off, raw-fallback and warm-up paths) | BE-ENGINE-TURNTAKING-01 (high→medium, V) |
| GAP-FINDING-RECONCILIATION-C25 | **medium** | correctness | Truncation over-approximates what was heard (sentence-granular EL cut, currentTime ignores output latency) and the interruption is invisible to the LLM | BE-TTS-08 (medium, V); BE-ENGINE-TURNTAKING-09 (medium, V); FE-PLAYBACK-TRANSPORT-13 (low, u) |
| GAP-FINDING-RECONCILIATION-C26 | **medium** | correctness | Barge-in after completion with nothing heard keeps the full unheard reply in history (inconsistent with the mid-stream path) | BE-LLM-12 (medium, V) |
| GAP-FINDING-RECONCILIATION-C27 | **medium** | correctness | A listening snapshot after resume cancels a reply the user is still hearing, without reporting played_ms | FE-PLAYBACK-TRANSPORT-04 (medium, V) |
| GAP-FINDING-RECONCILIATION-C28 | **medium** | latency | No send timeout or slow-consumer policy on the call socket: head-of-line blocking, keepalive blocked behind drain, unbounded waits | BE-ROUTE-TRANSPORT-05 (medium, V); BE-ENGINE-TURNTAKING-18 (low, u) |
| GAP-FINDING-RECONCILIATION-C29 | **medium** | robustness | Strict protocol: any unknown, extra-field, binary or malformed client frame ends a live call; 4408 copy misleading mid-call | BE-ROUTE-TRANSPORT-06 (medium, V); FE-PLAYBACK-TRANSPORT-18 (low, u) |
| GAP-FINDING-RECONCILIATION-C30 | **medium** | robustness | Deploys drop every live call: uvicorn closes sockets with 1012 before the lifespan shutdown can notify | BE-ROUTE-TRANSPORT-03 (medium, V) |
| GAP-FINDING-RECONCILIATION-C31 | **medium** | correctness | Crash-orphaned reservations: quota charged by wall clock up to the full reservation; capacity slots and the user own in-flight slot blocked for about 10-11 min | BE-ROUTE-TRANSPORT-04 (medium, V); BE-OBSERVABILITY-SAFETY-COST-11 (medium, V) |
| GAP-FINDING-RECONCILIATION-C32 | **medium** | robustness | STT exceptions leave the segment row accepted forever with no event (one such row exists in the dev DB) | BE-STT-03 (medium, V) |
| GAP-FINDING-RECONCILIATION-C33 | **medium** | correctness | STT language hint is forced for the whole call from the last assistant turn language; detected language unused | BE-STT-07 (medium, V) |
| GAP-FINDING-RECONCILIATION-C34 | **medium** | latency | History window is token_budget by default (skips max_messages), trims one message at a time with O(n^2) re-tokenization and shifts the prefix every turn | BE-LLM-07 (medium, V) |
| GAP-FINDING-RECONCILIATION-C35 | **medium** | cost | Prompt layout defeats provider prompt caching (lorebook appended to the system message, recomputed per utterance) | BE-LLM-08 (medium, V) |
| GAP-FINDING-RECONCILIATION-C36 | **medium** | correctness | Lorebook activation scans only the current, possibly misheard, utterance | BE-LLM-09 (medium, V) |
| GAP-FINDING-RECONCILIATION-C37 | **medium** | latency | No reasoning or latency guardrail on the callbot model; output cap 1,536 tokens vs the roadmap 300-400 | BE-LLM-10 (medium, V) |
| GAP-FINDING-RECONCILIATION-C38 | **medium** | robustness | Fail-closed spoken-text contract kills the turn on benign markup (<think>, <b>, "a < b") | BE-LLM-13 (medium, V); BE-ENGINE-TURNTAKING-13 (low, u) |
| GAP-FINDING-RECONCILIATION-C39 | **medium** | latency | OpenRouter usage poll on a new TLS session blocks stream completion by an estimated 0.2-1 s | BE-LLM-04 (medium, V) |
| GAP-FINDING-RECONCILIATION-C40 | **medium** | correctness | A TTS socket restart drops the unplayed tail of a closing context and reports the turn complete | BE-TTS-04 (medium, V) |
| GAP-FINDING-RECONCILIATION-C41 | **medium** | robustness | A provider stall after close_context is released as a normal completion after 5 s and resets the reconnect budget | BE-TTS-05 (medium, V) |
| GAP-FINDING-RECONCILIATION-C42 | **medium** | robustness | EL alignment offsets assume an exact len+1 echo per flush with no resync (drift unverified) | BE-TTS-09 (medium, V) |
| GAP-FINDING-RECONCILIATION-C43 | **medium** | robustness | Fish lane: no first-audio or inter-chunk watchdog (only a 90 s turn timeout); latency mode balanced (lane enabled in dev .env) | BE-TTS-11 (medium, V); E2E-LATENCY-TRACE-14 (medium, V) |
| GAP-FINDING-RECONCILIATION-C44 | **medium** | robustness | Fish replies over 1,200 chars or 64 units abort the generation and drop generated audio | BE-TTS-13 (medium, V) |
| GAP-FINDING-RECONCILIATION-C45 | **medium** | robustness | Mute/unmute and noise starting mid-call produce fake speech turns (floor decays on zeros, no recalibration) | FE-CAPTURE-06 (medium, V) |
| GAP-FINDING-RECONCILIATION-C46 | **medium** | robustness | Weak mid-call mic failure handling: only track ended observed; failures shown as self-clearing notices | FE-CAPTURE-07 (medium, V) |
| GAP-FINDING-RECONCILIATION-C47 | **medium** | robustness | Mic liveness watchdog can misclassify a live stream and the raw (AEC-off) fallback is permanent for the session | FE-CAPTURE-08 (medium, V) |
| GAP-FINDING-RECONCILIATION-C48 | **medium** | audio-quality | Fallback playback paths are choppy or slow (Blob-group gaps, 2 s ManagedMediaSource stall) | FE-PLAYBACK-TRANSPORT-09 (medium, V); E2E-LATENCY-TRACE-16 (low, u) |
| GAP-FINDING-RECONCILIATION-C49 | **medium** | ux | Captions run ahead of the audio (deltas shown at LLM speed; no alignment sent) | FE-UI-03 (medium, V); FE-PLAYBACK-TRANSPORT-16 (low, u) |
| GAP-FINDING-RECONCILIATION-C50 | **medium** | ux | Mobile layout hides captions behind a fixed 188 px portrait | FE-UI-04 (medium, V) |
| GAP-FINDING-RECONCILIATION-C51 | **medium** | ux | Quota UX: no warning before a quota end (client uses max_call only), dead-end Call again after it | FE-UI-05 (medium, V) |
| GAP-FINDING-RECONCILIATION-C52 | **medium** | ux | Abrupt limit ends: no warning, character cut mid-word on max_duration/quota, implicit cuts report nothing heard | FE-UI-06 (medium, V); BE-ROUTE-TRANSPORT-13 (low, u); FE-PLAYBACK-TRANSPORT-14 (low, u) |
| GAP-FINDING-RECONCILIATION-C53 | **medium** | ux | No greeting or ringback: the user must speak first into silence | FE-UI-07 (medium, V) |
| GAP-FINDING-RECONCILIATION-C54 | **medium** | ux | Text-only degradation (spend circuit) shown as a transient generic error | FE-UI-09 (medium, V) |
| GAP-FINDING-RECONCILIATION-C55 | **medium** | security-privacy | Live-call privacy footer understates what is saved (corrected copy stuck in draft) | FE-UI-10 (medium, V) |
| GAP-FINDING-RECONCILIATION-C56 | **medium** | ux | Any navigation silently ends the call; no minimized call | FE-UI-11 (medium, V) |
| GAP-FINDING-RECONCILIATION-C57 | **medium** | maintainability | Playback/transport tests are jsdom/mock only; risky paths (seq gap, snapshot, reconnect barge-in) untested | FE-PLAYBACK-TRANSPORT-22 (medium, V) |
| GAP-FINDING-RECONCILIATION-C58 | **medium** | cost | Spend control and cost accounting cover TTS only; no per-call cost record; timed-out moderation usage unrecorded | BE-OBSERVABILITY-SAFETY-COST-10 (medium, V) |
| GAP-FINDING-RECONCILIATION-C59 | **medium** | observability | No metrics exporter, monitor off by default, alerts are log lines, dead spend gauge | BE-OBSERVABILITY-SAFETY-COST-08 (medium, V) |
| GAP-FINDING-RECONCILIATION-C60 | **medium** | security-privacy | Self-harm risk labels and abuse disables logged in plaintext with user_id | BE-OBSERVABILITY-SAFETY-COST-13 (medium, V) |
| GAP-FINDING-RECONCILIATION-C61 | **low** | latency | Billing DB writes (debit + metadata rewrite) awaited inside the TTS audio drain loop | BE-TTS-07 (medium, V); BE-OBSERVABILITY-SAFETY-COST-04 (medium, V); BE-ROUTE-TRANSPORT-09 (medium→low, V); BE-ENGINE-TURNTAKING-16 (low, u) |
| GAP-FINDING-RECONCILIATION-C62 | **low** | cost | Users are charged for rejected/no-speech segments and for STT that finishes after the call ended | BE-ENGINE-TURNTAKING-10 (low, u); BE-STT-17 (low, u) |
| GAP-FINDING-RECONCILIATION-C63 | **low** | cost | Groq 10 s per-request billing floor amplified by segment-per-request STT and premature cuts | E2E-LATENCY-TRACE-17 (low, u); FE-CAPTURE-12 (medium→low, V); BE-STT-12 (low, u) |
| GAP-FINDING-RECONCILIATION-C64 | **low** | ux | transcript_final is sent only after BFF admission (on VoiceLlmTurnStarted), not right after STT | BE-STT-11 (medium→low, V); E2E-LATENCY-TRACE-05 (medium→low, V) |
| GAP-FINDING-RECONCILIATION-C65 | **low** | scalability | Process-local call runtime; a misrouted resume ends the call; scale-out needs sticky routing | BE-ROUTE-TRANSPORT-02 (medium→low, V); E2E-LATENCY-TRACE-15 (low, u) |
| GAP-FINDING-RECONCILIATION-C66 | **low** | scalability | Fish per-sentence spend admission takes an account-wide FOR UPDATE lock and a daily SUM | BE-TTS-12 (medium, V); BE-OBSERVABILITY-SAFETY-COST-14 (medium→low, V); E2E-LATENCY-TRACE-13 (medium→low, V) |
| GAP-FINDING-RECONCILIATION-C67 | **low** | latency | No early user-is-speaking signal: server warm-ups wait for the segment | FE-CAPTURE-11 (medium→low, V) |
| GAP-FINDING-RECONCILIATION-C68 | **low** | correctness | Control frames (barge-in, playback, end) are dropped, not queued, while the socket reconnects | FE-PLAYBACK-TRANSPORT-08 (medium→low, V) |
| GAP-FINDING-RECONCILIATION-C69 | **low** | ux | Abuse scoring counts drained chars for every cancel (incl. end_call and natural barge-in); live calls survive an abuse disable; end_call discards the heard prefix | BE-OBSERVABILITY-SAFETY-COST-12 (medium→low, V); BE-ENGINE-TURNTAKING-14 (low, u) |
| GAP-FINDING-RECONCILIATION-C70 | **low** | observability | Observability sanitizer silently drops non-allowlisted fields | BE-OBSERVABILITY-SAFETY-COST-06 (medium→low, V) |
| GAP-FINDING-RECONCILIATION-C71 | **low** | observability | extra= log fields never printed; events logged as dict repr; wall-clock durations | BE-OBSERVABILITY-SAFETY-COST-07 (medium→low, V) |
| GAP-FINDING-RECONCILIATION-C72 | **low** | observability | No cross-service trace correlation for voice (no traceparent / X-Request-Id on the voice path) | BE-OBSERVABILITY-SAFETY-COST-09 (medium→low, V) |
| GAP-FINDING-RECONCILIATION-C73 | **low** | ux | Status line exposes pipeline internals; no thinking visual during upload/STT | FE-UI-08 (medium→low, V) |
| GAP-FINDING-RECONCILIATION-C74 | **low** | correctness | compression_ratio > 2.4 rejects the whole transcript (needs about 9+ repetitions; mostly tail loops) | BE-STT-06 (medium→low, V) |
| GAP-FINDING-RECONCILIATION-C75 | **low** | latency | Lock-step LLM hand-off: each delta waits for the UI WebSocket send before reaching the sentence buffer | BE-LLM-20 (low, u); BE-TTS-19 (low, u) |
| GAP-FINDING-RECONCILIATION-C76 | **low** | audio-quality | Downlink is MP3 base64 inside JSON text frames with no timing metadata | BE-ROUTE-TRANSPORT-18 (info, u); BE-TTS-16 (low, u); FE-PLAYBACK-TRANSPORT-15 (low, u) |
| GAP-FINDING-RECONCILIATION-C77 | **low** | latency | Call setup is serial end to end (mic, consent POST, WS open, voice_start, DB gates, voice_ready) | FE-PLAYBACK-TRANSPORT-20 (low, u); FE-UI-18 (low, u); FE-CAPTURE-15 (low, u); BE-ROUTE-TRANSPORT-11 (low, u) |
| GAP-FINDING-RECONCILIATION-C78 | **low** | security-privacy | Access token in Sec-WebSocket-Protocol, validated only at the handshake; resume skips access gates | FE-PLAYBACK-TRANSPORT-19 (low, u); BE-ROUTE-TRANSPORT-17 (low, u) |
| GAP-FINDING-RECONCILIATION-C79 | **low** | maintainability | Dead VOICE_TTS_QUEUE_MAX_SENTENCES constant, unbounded speaker queue and small TTS nits | BE-TTS-20 (low, u); BE-ENGINE-TURNTAKING-20 (info, u) |
| GAP-FINDING-RECONCILIATION-C80 | **low** | maintainability | Stale cross-repo comments and dead config (8 s segment comment, unreachable strict VAD, doc drift) | FE-CAPTURE-18 (low, u); BE-STT-20 (info, u); BE-ROUTE-TRANSPORT-19 (info, u) |

## Appendix C. Unverified singles (46: 39 low, 7 info)

These keep their header severity. None merges with another note's finding.

| ID | Severity | Heading | Title |
|---|---|---|---|
| FE-CAPTURE-13 | low | `fe-capture.md:320` | Speech in the first 400 ms of any capture (re)start is learned as noise (LOW, UX) |
| FE-CAPTURE-14 | low | `fe-capture.md:326` | Mute does not discard an utterance in progress (LOW, UX) |
| FE-CAPTURE-16 | low | `fe-capture.md:336` | In-worklet resampler has a wide transition band (LOW, audio-quality) |
| FE-CAPTURE-17 | low | `fe-capture.md:341` | Stereo/multi-channel inputs: only channel 0 is read and no `channelCount` constraint (LOW, robustness) |
| FE-PLAYBACK-TRANSPORT-10 | low | `fe-playback-transport.md:368` | No jitter or prebuffer policy and no underrun handling on the MSE path (low, audio-quality) |
| FE-PLAYBACK-TRANSPORT-11 | low | `fe-playback-transport.md:376` | `openSocket` replaces a live or connecting WebSocket without closing it (low, robustness) |
| FE-PLAYBACK-TRANSPORT-12 | low | `fe-playback-transport.md:384` | Socket closures that don't go through `connecting` leave the UI "live" on a dead call (low, robustness) |
| FE-PLAYBACK-TRANSPORT-17 | low | `fe-playback-transport.md:424` | iOS audio session and gain specifics are unhandled (low, audio-quality) |
| FE-PLAYBACK-TRANSPORT-21 | low | `fe-playback-transport.md:458` | Small unbounded or long-lived state (low, maintainability) |
| FE-UI-12 | low | `fe-ui.md:392` | Accessibility gaps in the live surface (LOW, ux/a11y) |
| FE-UI-13 | low | `fe-ui.md:405` | Interrupt control causes layout shift and is unavailable while "Thinking" (LOW, ux) |
| FE-UI-14 | low | `fe-ui.md:413` | Muted state not reflected in status or hint (LOW, ux) |
| FE-UI-15 | low | `fe-ui.md:419` | Autoplay-blocked replies are labelled "Speaking" (LOW, ux) |
| FE-UI-16 | low | `fe-ui.md:426` | Client merge heuristic can overwrite a real user line (LOW, correctness) |
| FE-UI-17 | low | `fe-ui.md:438` | Full consent modal before every new call (LOW, ux) |
| FE-UI-20 | low | `fe-ui.md:464` | No device selection, Media Session, or network-quality cue (LOW, ux) |
| FE-UI-21 | low | `fe-ui.md:472` | "Call again" silently no-ops when setup is blocked (LOW, correctness) |
| FE-UI-22 | low | `fe-ui.md:480` | User-ended calls never show the end panel (LOW, ux) |
| FE-UI-23 | low | `fe-ui.md:488` | Speaking visual is synthetic; user level hidden while the character talks (LOW, ux) |
| FE-UI-24 | low | `fe-ui.md:495` | Interim states of an interrupted line (LOW, correctness) |
| FE-UI-25 | low | `fe-ui.md:504` | App audio (playlist) is not paused at call start (LOW, robustness) |
| BE-ROUTE-TRANSPORT-12 | low | `be-route-transport.md:694` | No handshake timeout or per-user socket cap; frame size limit is far above need (low, security) |
| BE-ROUTE-TRANSPORT-14 | low | `be-route-transport.md:723` | Global capacity ceiling and a single lock row; rate-limit state is in memory (low, scalability) |
| BE-ROUTE-TRANSPORT-15 | low | `be-route-transport.md:738` | Supersede runs before the new call can actually start (low, robustness) |
| BE-STT-13 | low | `be-stt.md:289` | low · audio-quality — Vocabulary prompt is thin and static |
| BE-STT-14 | low | `be-stt.md:295` | low · scalability — Groq rate limits vs. call concurrency; no queue/backoff |
| BE-STT-15 | low | `be-stt.md:301` | low · correctness — Prompt read-back detection only matches the whole prompt |
| BE-STT-16 | low | `be-stt.md:307` | low · robustness — Strict response contract turns benign provider changes into lost utterances |
| BE-STT-18 | low | `be-stt.md:319` | low · security-privacy — STT base URL accepts plain http; session id leaks into the uploaded filename |
| BE-STT-19 | low | `be-stt.md:324` | low · latency — WAV statistics run synchronously on the event loop |
| BE-ENGINE-TURNTAKING-11 | low | `be-engine-turntaking.md:570` | (low, robustness): no ordering by `seq` |
| BE-ENGINE-TURNTAKING-15 | low | `be-engine-turntaking.md:605` | (low, correctness): stored call audio does not match the cut transcript |
| BE-LLM-17 | low | `be-llm.md:575` | Provider `finish_reason` is masked as `stop` |
| BE-LLM-18 | low | `be-llm.md:583` | The prompt lacks call-language binding and first-sentence brevity, and uses legacy cue markup |
| BE-LLM-19 | low | `be-llm.md:597` | Sync DB calls on the api.magic_llm event loop add jitter to every concurrent stream |
| BE-TTS-10 | low | `be-tts.md:224` | The first-audio timeout gives up sentences only locally; late audio still plays after the "delayed" notice (low, ux/robu |
| BE-TTS-14 | low | `be-tts.md:244` | The EL socket has no WS ping and no keepalive between turns; half-open sockets surface as a 3 s first-audio timeout (low |
| BE-TTS-15 | low | `be-tts.md:249` | The ElevenLabs session limiter is per process while each call holds a slot for its whole duration (low, scalability) |
| BE-OBSERVABILITY-SAFETY-COST-15 | low | `be-observability-safety-cost.md:587` | Moderation metrics are coarse and mislabelled (low) |
| FE-CAPTURE-20 | info | `fe-capture.md:360` | Privacy posture of the uplink (INFO, security-privacy) |
| FE-PLAYBACK-TRANSPORT-23 | info | `fe-playback-transport.md:477` | Minor protocol leftovers (info) |
| FE-UI-26 | info | `fe-ui.md:511` | Internal error codes shown to end users (INFO, ux) |
| FE-UI-27 | info | `fe-ui.md:515` | History lacks interruption markers and end reasons in rows (INFO, ux) |
| FE-UI-28 | info | `fe-ui.md:520` | Avatar "live" dot is clipped by the circular mask (INFO, ux) |
| BE-TTS-21 | info | `be-tts.md:277` | The voice's emotion and tag prefix is not applied on the EL call lane (info, audio-quality) |
| BE-TTS-22 | info | `be-tts.md:281` | Text normalization runs twice (local en/es expansion plus provider `auto`) (info, latency) |

---

## Verification (adversarial)

Second pass, 2026-10-20. A separate agent tried to refute each reconciled finding against the code. No source file was
changed. The only database access was one read-only SELECT. It re-ran `stt_dev_stats.py` and `stt_dev_status.py`, plus a
small extra query on the failed rows, with `START TRANSACTION READ ONLY`, SELECT and rollback.

Path prefixes:

- `API:` is `/home/andres/PycharmProjects/magic-worlds-api/src`.
- `FE:` is `/home/andres/WebstormProjects/magic-worlds/src`.
- `LLMLIB:` is `/home/andres/PycharmProjects/magic-llm`.
- `MLLM:` is `/home/andres/PycharmProjects/api.magic_llm`.
- `AGT:` is `/home/andres/PycharmProjects/magic-agents`.

**Summary:** 64 findings: 49 confirmed, 15 adjusted, 0 refuted. Four severities went down and none went up:

- C09: high to medium.
- C11: high to medium.
- C26: medium to low.
- X03: medium to low.

X06 stays medium, but its "slow speech" half is refuted.

The adjustments fix three kinds of problem in this note:

- **Interpretation errors in section 6.** `completed_at` is stamped when STT completes, not when the turn fails. The "7 chars/s" figure mixes the heard (truncated) text with the full delivered audio.
- **Conditions left out:** C24, C31, C14.
- **Wrong examples or impacts:** C03, C04, C13, C25, C35, C38.

| id | verdict | corrected severity | evidence/note |
|---|---|---|---|
| C01 | confirmed | high | `FE:features/interaction/hooks/useVoiceCallController.ts:564-628`: the whole segment goes out as one HTTP POST, after VAD flush. `API:routes/user/route_voice_call.py:1160-1220`: a multipart form with a WAV file. `API:services/voice_orchestration/stt_groq_client.py:36-39`: "not streaming in v1", one `post` per segment. `CallScreen.tsx:114`: `silenceMsToEnd: 550`. Nothing starts before the user stops. |
| C08 | confirmed | high | `MLLM:src/routes/completions.py:991-1004`: the inline agt path runs `prepare_interaction`. `MLLM:src/db/interaction.py`: `find_admission` and `admit` are separate `_transaction`s. `AGT:magic_agents/execution/llm_storage.py:23-46`: `before_attempt` awaits two `scope.record` commits (`effect_prepared`, `llm_start`) right before dispatch. The "about 16 commits" count and the magnitude are still INFERENCE. The 1,579 ms first-text probe leaves room for it. Re-rate after C13 measurement. |
| C09 | adjusted | medium | The mechanism is confirmed. The CallbotExecutionService is built without `client` (`API:services/voice_orchestration/engine.py:3792-3795`), so `_client()` opens a new `httpx.AsyncClient` per stream (`API:services/llm_execution_transport.py:276-277, 315-325`). magic-llm opens a new `aiohttp.ClientSession` per request (`LLMLIB:magic_llm/util/http.py:100-102`, `engine/engine_openai.py:264`). The Groq client has httpx default limits (`stt_groq_client.py:139-145`, expiry 5 s). **Lowered:** in dev the BFF to api.magic_llm hop is plaintext localhost (`.env` `MAGIC_LLM_API_URL=http://localhost…`), so its handshake is negligible. The real cost is about one TCP+TLS setup each to OpenRouter and Groq, roughly 1-2 RTT per hop (about 100-300 ms per turn). It is cheap to fix and runs every turn, but it is not one of the largest serial waits. |
| C02 | confirmed | high | `FE:features/call/components/CallScreen.tsx:114` (550/250). The controller comment at `useVoiceCallController.ts:907-910` says no `voice_vad` frame is sent. `API:services/voice_orchestration/server_vad.py` only validates segments, and there is no turn-detector anywhere. The server merges text only while the superseded user message is not yet persisted (`engine.py:2075-2087`). |
| C10 | confirmed | high | Probe: `validate_spoken_text(' Hello there.')` and `('Hello there.\n')` both raise `VoiceOrchestrationError` (`API:services/voice_orchestration/transcript_sanitizer.py:131-137`). The runner compares the stripped stored text with the raw concatenation (`llm_turn_runner.py:180, 234`; `llm_execution_text.py:27-30, 142`). The engine repeats the check (`engine.py:2715-2720`). How often it happens depends on the model (UNKNOWN). |
| C07 | confirmed | high | There is no TTFT or turn deadline. The only `wait_for` calls in `engine.py` are truncation, end and watchdog waits (`:1119, 1493, 1656, 1675, 1827, 1888`). `LLMLIB:magic_llm/engine/attempt_control.py:278-326`: `controlled_stream` retries before any semantic output, with `asyncio.sleep(delay)`. 408/429/5xx are not permanent (`:257-261`). Defaults: `retries=3`, `RetryConfig.delay=1.0` (`base_chat.py:31-33, 62`). The callbot contract `timeout_seconds=30` (`API:services/llm_features.py:66-68`) is per attempt, which gives the about 92 s worst case. |
| C06 | confirmed | high | `stt_groq_client.py:90-109`: one `post`, no retry. `config.py:47`: a 30 s default, env-tunable up to 120 s. `engine.py:2051-2061`: `intake_lock` is held across `_intake_segment`, which awaits STT at `:2228`. The model is pinned (`config.py:122-124`, `stt_groq_client.py:61-62`). The client resends only on `TypeError` (`useVoiceCallController.ts:597-608`), so a 504 or 502 loses the utterance, with a notice. |
| C11 | adjusted | medium | Confirmed: chunks sent with no socket return `DROPPED`, but `audio_last_seq` still advances (`API:services/voice_orchestration/delivery.py:264-267`; `engine.py:2470-2490`). The buffer accepts only `expectedSeq` in order and never skips (`FE:features/interaction/audio/voicePlaybackBuffer.ts:175-176, 361-364`). **Corrections:** (1) The server snapshot already carries `last_audio_seq` (`engine.py:993-1004`, `delivery.py:341-357`), but the SPA never reads it (grep: only `shared/types/voice.types.ts:186`). The fix is client-side. (2) "Never ends" is too strong: the next turn's first chunk calls `startTurn`/`resetActivePlayback` (`voicePlaybackBuffer.ts:185, 575-600`), so the stuck state self-heals at the next reply. The loss is the remainder of one reply after a mid-reply reconnect, so medium. |
| C14 | adjusted | high | Budget 1 (`API:services/speech/providers/elevenlabs/tts_multicontext_ws.py:833-843`). A second failure calls `_fail_leg`. `tts_stream_interrupted` sets `runtime.tts_leg_ended=True` for the rest of the call (`engine.py:2979-2985`). **Mechanism correction:** the budget is reset by a turn that *completes with audio* (`_release(completed=True)` with `has_audio`, `:944-947`), not by a successful reconnect. Two failures end the leg only when no turn completes with audio between them. A typical case is an outage longer than the immediate, unbacked-off reconnect, or a 429 on the handshake (`:543-547`). That is still a permanent text-only call after a few seconds of provider trouble, so high stays. |
| C05 | confirmed | high | `useVoiceCallController.ts:676-687` skips auto barge-in when AEC is off, on the raw fallback, or in warm-up. `handleCapturedSegment` (`:921-935`) uploads unconditionally. `engine.py:2066-2074` supersedes on any non-empty transcript, and there is no echo filter. The hint copy is wrong (`FE:app/i18n/locales/en.ts:6150`, "interrupting by voice is disabled"). High is conditional on the AEC-off share (UNKNOWN). |
| C03 | adjusted | high | The client is confirmed energy-only: an RMS gate with an adaptive floor (`FE:features/interaction/audio/voiceVadProcessor.worklet.js:265-304`). **Correction:** it is not "energy-only on both sides". The server energy gate is disabled by default (`API:services/voice_orchestration/server_vad.py:25-36`, `vad_energy_gate_enabled=False`). The server applies only a `peak<0.002` floor, and Groq's no-speech heuristic is the only filter after the client. So no VAD of any kind gates noise server-side. The impact stands. |
| C12 | confirmed | high | `API:services/speech/companion_safety_lists.py:24-35`: `pending_signoff`, every list `_EMPTY`. `companion_safety.py:299-301`: `detection_enabled` defaults to False, and `:396` returns early. `SelfHarmDetector` is built with no classifier (`:357`; grep finds no `classifier=` wiring). The detector itself says it is inert (`:27`). |
| C04 | adjusted | high | Confirmed: `_push` awaits `_prepare` before the `may_flush` wait (`API:services/voice_orchestration/call_tts_elevenlabs.py:228-245`), so only sentence 1 is serial (K07). The 300 ms fail-closed verdict is at `engine.py:3293-3335`. **Impact correction:** the two code defaults are `REQUIRED=true` (`speech/moderation_transport.py:122-129`) and `CLASSIFIER_ENABLED=false` (`:117`). Together they make the surface gate refuse calls up front (`speech/surface_gate.py` step 5), not "add up to 300 ms". With the classifier on through the durable api.magic_llm path (C08), a 300 ms budget is likely to time out on most sentences. Those sentences are skipped, which makes the call effectively text-only (per `be-llm.md:695`). "Up to 300 ms" is the best case. |
| C13 | adjusted | medium | Confirmed: the client mark is only `performance.mark` with no reader (`FE:features/interaction/audio/callPlaybackTiming.ts:2, 28-33`). There is no exporter, and the monitor defaults to off (`API:services/speech/metrics.py:4, 1649-1660`). **Correction:** "per-stage latency cannot be measured" is too broad. STT latency is persisted per segment (`stt_summary.latency_ms`), and X04 itself is computed from it. The gaps are the client first-audible mark, the LLM, TTS and first-audio stages, and an aggregate. |
| C15 | confirmed | medium | `sendBargeIn` cancels playback at once. There is no duck, pause or resume path (`useVoiceCallController.ts:644-673`; `voicePlaybackBuffer.ts` `resume()` is autoplay only). The 500 ms minimum is at `:132-137, 706`. |
| C16 | confirmed | medium | `minSpeechMs` is raised to 500 while playing (`useVoiceCallController.ts:706`). The worklet discards segments below `minSpeechSamples` (`voiceVadProcessor.worklet.js:394`), so a short answer said entirely during playback never reaches STT. |
| C17 | confirmed | medium | `API:services/voice_orchestration/sentence_buffer.py:11-16` lists `am` and `no` and lacks `sra`/`sr.` variants for Spanish. The only boundaries are `. ! ?` and the soft cap. There is no clause-level first chunk. |
| C18 | confirmed | medium | `_SENTENCE_PUNCT = {".", "!", "?"}` (`sentence_buffer.py:19`). Full-width `。！？` is not a boundary. |
| C19 | confirmed | medium | Serial awaits in `engine.py:2024-2275`: `get_session`, `touch_call`, `find_segment`, `create_segment`, the ack, `update accepted`, the ack, STT, `_record_billable_audio` (debit plus metadata read and write), `update completed`. Then `_await_pending_truncation` and admission. The magnitude depends on DB RTT (UNKNOWN). |
| C20 | confirmed | medium | `engine.py:2068-2074`: `await previous.finished.wait()` has no timeout. `_await_pending_truncation` waits up to `VOICE_TRUNCATION_WAIT_SECONDS` (`:1669-1683`). |
| C21 | confirmed | medium | `accept_segment` runs the whole turn inside the POST (`engine.py:2090-2103`). The client retries only on `TypeError` (`useVoiceCallController.ts:597-608`), so a 429 `busy` is dropped with a notice. |
| C22 | confirmed | medium | `engine.py:2487-2490`: `VoiceDeliveryDisconnected` becomes `DROPPED`, and the comment says "Delivered (or accepted while the socket is away): billable and stored". The audio is appended to `assistant_audio` and billed. K09 bounds the exposure. |
| C23 | confirmed | medium | `FE:infrastructure/api/voiceSocket.ts:20-21` (25 s heartbeat, 50 s liveness) and `:586-600` (checked only on the 25 s tick). That is 50-75 s after the last frame, or 25-75 s after a silent drop. The server grace is 20 s, and the client resume window is 15 s (`:24`). |
| C24 | adjusted | medium | The mechanism is confirmed for supersede: `_supersede_heard_prefix` returns early when `turn.end_published` (`engine.py:1426-1433`). After the turn finishes, `current_turn` is None, so a new segment supersedes nothing (`:2064, 2105-2109`). **Missing condition:** an explicit `voice_barge_in` after `voice_turn_end` *does* truncate. `_barge_in_target` includes `runtime.last_turn` while `_truncation_window_open` (`:1336-1365`), and the AEC-on client sends that frame. So the unprotected tail applies only when no barge-in frame is sent: AEC off, raw fallback, the 3 s warm-up, or speech under 500 ms. It is not "every reply". |
| C25 | adjusted | medium | Confirmed: `keep_end` keeps the whole sentence whose audio started before `played_ms` (`API:services/voice_orchestration/call_ledger.py:380-392`). The history builder adds no interruption marker (`API:services/conversation_execution.py:56-86`). **Refuted detail:** "65 ms/char is about 2× the measured rate". (1) `DEFAULT_MS_PER_CHAR` is used only on the no-alignment fallback (`call_ledger.py:56, 332, 417`). (2) The 7 chars/s figure comes from truncated rows (see X06). Untruncated dev turns run about 78-88 ms/char (`gap-call-audio-assets-and-mp3-timeline.md:92-123`), so 65 is about 20-35% fast, not 2×. That sibling table also shows a real EL over-keep of about 70 chars (msg 550). |
| C26 | adjusted | low | The mechanism is confirmed: `kept is None` keeps the full text (`engine.py:1541-1556`). **Lowered:** `keep_end` is None only when `played_ms` is at or before the first sentence's start (`call_ledger.py:380-392`). Auto barge-in requires `playing` status plus 500 ms of user speech (`useVoiceCallController.ts:683-686`), and a supersede without a report uses `delivered_ms` as the bound. The case needs a completed reply interrupted before *any* audio played, for example the manual Interrupt during buffering. That window is narrow. |
| C27 | confirmed | medium | `handleStateSnapshot` (`useVoiceCallController.ts:741-755`): `state==='listening'` with playback not idle calls `playback.cancel` without sending `voice_barge_in`/`played_ms`. The server is `listening` once generation ends, while the client may still be playing buffered audio. |
| C28 | confirmed | medium | `delivery.py:212-231`: `send_json` under the per-socket `send_lock` with no timeout. The in-call `voice_pong` also goes through `delivery.send_frame` (`route_voice_call.py:1499`), so it queues behind a stalled audio send. Server half-open detection time is still UNKNOWN (K04). |
| C29 | confirmed | medium | `route_voice_call.py:320-330`: an unknown type or a `ValidationError` (all models are `extra="forbid", strict=True`, `:135-272`) raises `VoiceOrchestrationError(..., fatal=True)`. |
| C30 | confirmed | medium | `uvicorn/protocols/websockets/websockets_impl.py:148-154` sends `fail_connection(1012)` from `connection.shutdown()`. `uvicorn/server.py` calls that before `lifespan.shutdown()`, which is where `voice_engine.shutdown()` sends `server_shutdown` (`API:main.py:1383-1386`). `serve.py` sets no graceful timeout. |
| C31 | adjusted | medium | Confirmed: `quota.py:268` reserves `min(600, remaining)`. `:566-576` charges `min(elapsed, reserved)`, which is the full reservation at the max-duration expiry. With the defaults (10 daily minutes, `config.py:30`), that is the rest of the day. **Missing mitigation:** if the client resumes against the restarted process within its 15 s window, `resume_call` finds no runtime and calls `end_call`. That releases the reservation with the session's billed seconds (`engine.py:965-977, 1158-1165`). The full charge therefore needs a restart longer than the resume window, or a client that is gone. |
| C32 | confirmed | medium | `engine.py:2205` sets `accepted`, and `:2228` awaits STT with no try/except. The route converts the error to HTTP (`route_voice_call.py:1221-1222`), and no `update_segment` or event runs. The dev DB shows 1 `accepted` row (2026-10-20 22:20:55) with no `stt_summary` and no `completed_at`. The cause of that particular row (an STT error, or a cancel at call end) is not provable from the row. |
| C33 | confirmed | medium | `route_voice_call.py:555-612`: `stt_language=call_language` is resolved once per call from the last turn language, then the preference. `engine.py:2228-2230` passes `runtime.stt_language` on every segment. Grep finds no consumer of the detected language. |
| C34 | confirmed | medium | `AGT:magic_agents/node_system/utils.py:346-360` re-runs `estimate_tokens` over the whole list after each drop. Note: the callbot contract budget is `max_input_tokens=32_768` (`llm_features.py:66-68`), so the loop runs only once the loaded history (at most 100 rows) exceeds 32k tokens. "About 1 s" is a worst case. |
| C35 | adjusted | medium | Confirmed: the lorebook is appended to the system prompt per utterance (per `be-llm.md:688`). **Impact correction:** this does not apply on "every turn". The prefix changes only when keyword lorebooks are attached and the activated set changes. A call with no lorebook has a static system prefix. The history-prefix shift is C34. |
| C36 | confirmed | medium | `API:services/lorebook_loader.py:242-249`: `messages=[{"role":"user","content": user_input}]`, so only the current utterance is scanned. |
| C37 | confirmed | medium | `llm_features.py:66-68`: `max_output_tokens=1_536`, capabilities only `chat`/`streaming`, and no reasoning limit. The 17.6 s p50 is delivered audio, which is valid (see X06). |
| C38 | adjusted | medium | Probe: `<think>hmm</think>Hello`, `I said <b>no</b>.` and `five < ten and ten > five` are rejected. **But `a < b` passes** (`validate_spoken_text('a < b')` is OK), so that example is wrong. The rejection needs tag-like `<…>` structure. |
| C39 | confirmed | medium | `LLMLIB:magic_llm/engine/engine_openai.py:281-292` awaits `_poll_openrouter_usage_async` (a new `AsyncHttpClient`, `:171-176`) inside the stream generator, after the last chunk and before it returns. The size of the delay is INFERENCE. |
| C40 | confirmed | medium | `tts_multicontext_ws.py:845-862`: `_restart_socket` releases `closing` contexts with `completed=False`. `_release` queues the `None` sentinel (`:937-947`), so `turn_audio` ends cleanly and `_drain` marks `audio_complete` (`call_tts_elevenlabs.py:279-282`). |
| C41 | confirmed | medium | `_tick` (`tts_multicontext_ws.py:983-996`): a closing context with audio skips the inter-chunk timer. It is released with `completed=True` after `COMPLETION_IDLE_S`, which resets `_budget_used` (`:946-947`). |
| C42 | confirmed | medium | `tts_multicontext_ws.py:713-722`: `char_offset = epoch_base + epoch_aligned`, cumulative with no resync. It also falls back to `normalizedAlignment` (`:715-716`), whose character counts can differ from the sent text. Real drift is unverified. |
| C43 | confirmed | medium | `API:services/speech/providers/fish_audio/timestamp_ws.py:162-167, 204`: only a 90 s `asyncio.timeout` per turn. `:212`: `'latency':'balanced'`. `fish_audio/config.py:36, 87`: calls are off by default. |
| C44 | confirmed | medium | `fish_audio/streaming.py` `push_text` raises `fish_error(422)` past 1,200 queued chars. `timestamp_ws.py:28, 192` caps at 1,200 chars and 64 units. Dev replies max out at 317 chars, so this is untriggered in dev. |
| C45 | confirmed | medium | `useMicrophoneCapture.ts:571-580`: `mute()` only disables the track, so the worklet sees zeros and the floor falls (`worklet.js:298-304`). Calibration is not re-run on unmute. Re-simulated by the FE verifier (`fe-capture.md:461`). |
| C46 | confirmed | medium | `useMicrophoneCapture.ts:521` adds only `'ended'` listeners. Grep finds no `mute`, `devicechange` or `statechange`. Errors become non-fatal notices (`useVoiceCallController.ts:980-988`). |
| C47 | confirmed | medium | `useMicrophoneCapture.ts:421`: `dead = maxObservedLevel === 0 \|\| track.muted`. `:430-435` sets `RAW_AUDIO_CONSTRAINTS` once, and only `start()` resets it (`:559-566`). That is permanent for the session. |
| C48 | confirmed | medium | `voicePlaybackBuffer.ts:44` (`MANAGED_STALL_MS = 2_000`) and the Blob-group fallback path (`:420`). The size of the gaps per browser is unmeasured. |
| C49 | confirmed | medium | Deltas are appended at LLM speed (`useVoiceCallController.ts:944-948`), and audio chunks carry no alignment (per `fe-ui.md:614`). |
| C50 | confirmed | medium | `CallScreen.tsx:473`: `<Avatar … size={188}>` in a non-scrolling stage (per `fe-ui.md:615`). |
| C51 | confirmed | medium | Per `fe-ui.md:616`, the client reads no `remaining_daily_seconds`. The quota end is a fatal `quota_exceeded`. |
| C52 | confirmed | medium | `handleEnded` and the fatal-error path call `stopLocalResources`, which cancels playback (`useVoiceCallController.ts:901-905, 889-892`). The finding is wrong for `idle_timeout` (K24). |
| C53 | confirmed | medium | Grep finds no greeting or ringback in `API:services/voice_orchestration`. `CallScreen.tsx` shows only a hint and spinner. |
| C54 | confirmed | medium | The spend notice uses `tts_unavailable` + `provider_unavailable` (`engine.py:2857-2873`). Note: C14's leg end (`tts_stream_interrupted`, `engine.py:2979-2985`) is a second sticky text-only path, so the UX gap is wider than "spend circuit" alone. |
| C55 | confirmed | medium | `CallScreen.tsx:637` shows `call.screen.privacyNote` unless the version is `voice-v3`. `en.ts:6155` says "Only transcript text and metadata are saved", while the engine persists character audio (`engine.py:3469-3510`). |
| C56 | confirmed | medium | Per `fe-ui.md:622`: unmount ends the call. No navigation interceptor was found. |
| C57 | confirmed | medium | `FE:../tests/browser/` holds only voice-console, voice-presets and feature-flag scripts. There are no call playback or transport browser tests. |
| C58 | confirmed | medium | Per `be-observability-safety-cost.md:686`, `spend_circuit.py` covers TTS only. Cancelled LLM usage is lost (A01). |
| C59 | confirmed | medium | `API:services/speech/metrics.py:4` (no exporter), `:1649-1660` (`VOICE_METRICS_MONITOR_ENABLED` defaults to False), `:1604, 1711` (`log_alerts` only). |
| C60 | confirmed | medium | Per `be-observability-safety-cost.md:689`. The safety-pause logs are dormant while C12 holds, and the abuse-disable logs are live. |
| X03 | adjusted | low | The listed contradictions hold against the code: K01 (`CallScreen.tsx:114` vs `worklet.js:225`), K02 (`useVoiceCallController.ts:128, 544-548` plus `engine.py:864` advertising 30,000), K03, K05, K06, K07 and K10 were re-checked above. **Lowered:** these are documentation errata, with no product behaviour. **Missed:** this note's own section 6 has two interpretation errors (X05, X06) that belong in the errata. |
| X04 | confirmed | medium | Re-ran `stt_dev_stats.py`: n = 23, min 422, p50 526, p90 846.6, p95 1,002.1, max 1,481, mean 606.2. Segments p50 1,312 ms, max 2,092. `stt_groq_client.py:90-109`: `start` wraps the `post`. |
| X05 | adjusted | medium | The counts are confirmed (5 `failed/internal`, all `whisper-large-v3`, 459-761 ms). **Timing inference refuted:** `completed_at` is stamped by the *first* terminal status, `COALESCE(completed_at, CURRENT_TIMESTAMP)` (`API:database/mysql/models.py:7807-7820`). For these rows that is the post-STT `completed` update (`engine.py:2275`), not the later `failed`. "Within about 1 s of creation" therefore measures STT, not the failure. An extra read-only query shows 2 of the 5 have `turn_id` plus user and assistant message ids (fe6100ca seq 1 and 3). Seq 3 has `audio_chunks=2`, so it failed after LLM admission and after TTS audio started. The other 3 have no `turn_id`, so they failed before `voice_turn_start`. Cause still UNKNOWN (no log files in the repo). |
| X06 | adjusted | medium | "Long replies" is confirmed: asset durations are the whole-frame MP3 of all delivered audio (`engine.py:4046-4047`), so `duration_ms` is **not** UNKNOWN. Untruncated replies run 12.5-22.7 s for 227-317 chars. **"Slow, about 7 chars/s" is refuted:** 12 of 17 rows are truncated, so `transcript_text` holds the heard prefix while the asset holds the full delivered audio (`gap-call-audio-assets-and-mp3-timeline.md:92-123`). Untruncated rates are about 78-88 ms/char (11-13 chars/s), so the 2× inference in C25 does not hold. |
