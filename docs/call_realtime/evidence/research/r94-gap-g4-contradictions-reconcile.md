# r94: Reconciling contradictions between research notes (gap G4)

- **Date:** 2026-10-20
- **Scope:** four contradictions found between the research notes r01–r10 and the codebase audit, each settled with a single value for the final `docs/call_realtime` documents:
  1. Gemini Live billing, and the per-minute cost of the 10-minute reference call.
  2. LiveKit endpointing defaults.
  3. LLM time to first answer token (TTFAT): what the two benchmark numbers measure, and what to expect per shortlisted provider.
  4. Out-of-date codebase facts in r03.
- **Method:** WebSearch was not available. Primary pages were re-fetched with WebFetch on 2026-10-20: Gemini Live best practices, Gemini pricing, Gemini Live session management, four LiveKit docs pages, the aiewf-eval README and its Groq archive, Artificial Analysis (AA) methodology, provider and leaderboard pages, Groq reasoning docs and OpenRouter latency docs. Codebase facts were checked against the audit files (`docs/call_realtime/evidence/audit/fe-capture.md`, `be-llm.md`, `e2e-latency-trace.md`) and against the source files themselves. Cost figures were computed with a small script, not taken from vendors.
- **Labels:** **[doc]** a first-party documentation statement; **[vendor]** a vendor-reported number; **[indep]** an independent benchmark; **[est]** my own derivation (its assumptions are stated next to it); **[code]** checked in source.

---

## 0. Verdicts at a glance

| # | Contradiction | Verdict | Value to use in the final docs |
|---|---|---|---|
| 1a | r07: Gemini Live re-bills all context tokens on every turn. r10: the docs are silent on this. | **r07 is right.** The Live API best-practices page (updated 2026-09-15) says so explicitly [doc]. r10 checked only the pricing, Live guide and session pages, which do not cover it. | Billing compounds per turn: the full context window is billed every turn, and accumulated audio is billed at the audio-input rate. |
| 1b | Audio tokens per second | Google now publishes **about 25 tokens per second of audio** [doc]. This matches the pricing page's per-minute conversions. | 25 tokens/s in both directions, so 1,500 tokens per audio-minute. |
| 1c | 10-minute call: r07 says $0.15–0.30/min; r10 says $0.011–0.097/min | Both ranges come from the same mechanism under different assumptions. r10's lower bound of $0.011 is ruled out by the docs. | **≈ $0.16/min ($1.58 per 10-minute call)** with the default continuous-listening setup. ≈ $0.10/min if the client sends only speech. ≈ $0.07–0.08/min with an aggressive sliding window. [est, computed] |
| 2 | LiveKit defaults: r02 says 0.3 s / 2.5 s; r01 and r08 say 0.5 s / 3.0 s | **Both are documented, but they apply to different modes.** The parameter defaults are 0.5 / 3.0 s. When the **audio turn detector** is active, any delay you leave unset defaults to 0.3 / 2.5 s instead. The audio detector is the `AgentSession` default. | "0.5 s / 3.0 s by default; 0.3 s / 2.5 s for unset values when the audio TurnDetector is used (the default turn-detection mode)." r01's "0.5/3.0 *with the turn model*" is wrong for the audio model. |
| 3 | Groq gpt-oss-120b TTFAT: r01 says 98 ms; r05 says 4.91 s | They measure different things. 98 ms is an **archived** aiewf row: multi-turn, effort not stated, cohort unresolved, removed at the maintainer's request. 4.91 s is **AA's high-reasoning, 10k-token unique-prompt** measurement, which is 0.68 s to the first chunk plus 4.22 s of reasoning. | Use neither as a planning number. With thinking off or low, a 3–8k-token prompt and a warm cache, expect **≈ 0.4–0.8 s p50 on Groq** and **≈ 0.25–0.45 s on Cerebras** [est]. See §3.4 for every shortlisted provider. |
| 4 | r03: 800 ms of silence, a 7.5 s segment cap and an 8 s server limit | **Superseded.** Production uses **550 ms** (`CallScreen.tsx:114`). `maxSegmentMs` is raised to **29.5 s** after consent and ready. The server limit is **30 s** (`config.py:42`). | Mark r03 §0 item 2, §6.1, §6.2 "Long user turns", §8(d) and §10 (P0 item 4, P2 item 4) as superseded (§4). The related claims in r02, r01 and r07 are also stale (§4.3). |

---

## 1. Gemini Live billing

### 1.1 What the primary pages say now

**Live API best practices** ([ai.google.dev/gemini-api/docs/live-api/best-practices](https://ai.google.dev/gemini-api/docs/live-api/best-practices), last updated **2026-09-15**, fetched 2026-10-20). Its "Pricing and billing" section has four subsections. All of the following are first-party documentation [doc]:

- **Billing is by tokens and compounds.** The page describes billing as compounding over the active context window of the persistent session. A "turn" is one user input plus the model's response.
- **Every turn bills all tokens in the session context window.** That means the current turn's new tokens plus all tokens accumulated in earlier turns, up to the configured window size. Per-turn cost therefore rises as the session gets longer.
- **Audio history is billed at the audio-input rate.** Accumulated native audio tokens are charged at the standard audio-input rate on every turn.
- **Transcription is extra.** With `inputAudioTranscription` or `outputAudioTranscription` enabled, transcription text tokens are charged at the text **output** rate, on top of the audio cost.
- **Compression caps the bill.** With `contextWindowCompression`, for example a 25,000-token trigger and an 8,000-token sliding window (the page's own example values), older tokens are evicted. Later turns are billed only for the retained history plus new tokens.
- **Proactive audio bills listening time.** When proactive audio is on, input tokens are charged for the **entire time the API is listening**; output is charged only when the model responds. Proactive audio is **permanently enabled on `gemini-3.8-live` and `gemini-3.8-live-extended-thinking`**. It is not supported on `gemini-3.1-flash-live-preview`, which bills audio only while you are actively streaming input.
- **Token rate.** Native audio accumulates at **approximately 25 tokens per second**. Without compression, audio-only sessions are limited to 15 minutes and audio+video sessions to 2 minutes. Session-resumption tokens are valid for 2 hours.

**Gemini pricing page** ([ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing), last updated **2026-10-19**) [doc]:

- **Price row.** `gemini-3.8-live`, `gemini-3.8-live-extended-thinking` and `gemini-3.1-flash-live-preview` share one row:
  - Input: text $0.75; audio **$3.00 per 1M tokens, or $0.005/min**; image/video $1.00 per 1M ($0.002/min).
  - Output: text $4.50; audio **$12.00 per 1M tokens, or $0.018/min**.
  - The free tier is free of charge.
- **No context-caching row** exists for any Live model.
- **The pricing page says nothing about per-turn billing or context carry-over.** This explains r10's "docs are silent": r10 read this page, the Live guide and the session page, but not the best-practices page.

**Live session management** ([ai.google.dev/gemini-api/docs/live-session](https://ai.google.dev/gemini-api/docs/live-session), last updated 2026-09-15) [doc]:

- A connection lasts about 10 minutes. The server sends a `GoAway` message with `timeLeft` before it closes.
- Audio-only sessions are limited to 15 minutes without compression, 2 minutes with video.
- Resumption tokens are valid for 2 hours.
- The page does **not** give default values for compression `triggerTokens` or `slidingWindow`. Its JS example passes an empty `slidingWindow: {}`.

**Gemini 3.8 Live model page** ([ai.google.dev/gemini-api/docs/models/gemini-3.8-live](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live), page footer 2026-10-19, fetched 2026-10-20 during fact-check) [doc]:

- Status **Stable** ("latest update September 2026"). tokenkarma dates GA to 2026-09-15. `gemini-3.1-flash-live-preview` is now listed as a **"Legacy Live API preview model"** with a recommendation to move to 3.8 Live (no shutdown date given).
- Input limit 131,072 tokens, output limit 65,536.
- **Proactive audio is always on**: `proactive_audio: false` returns an error.
- **Affective dialogue was removed** from this model; `enable_affective_dialog` must be deleted.
- **Thinking is supported with interleaved reasoning**, and `thinking_level` is not accepted. (This affects assumption A4 below.)
- **Caching is listed as not supported.**

**Third-party cross-check.** tokenkarma ([2026-09-17](https://tokenkarma.app/blog/gemini-live-api-pricing-voice-agents-2026/)) uses 25 tokens/s and gives "$0.011 for a one-minute exchange with no thinking" (30 s user audio + 30 s model audio). r10's lower bound came from this figure. The same article says a working agent costs "30 to 90 cents" per minute in practice, with no derivation for that range. It says context is re-sent on every tool call and resumed session, but it does not describe the documented per-turn full-context re-billing. Its $0.011 is a one-minute figure and should not be extrapolated to a 10-minute call.

### 1.2 Audio tokens per second: settled

- **25 tokens/s in each direction**, as stated by Google on the best-practices page.
- The pricing page's own conversions agree. 1,500 tokens/min × $3/M = $0.0045/min, which Google rounds to $0.005. 1,500 tokens/min × $12/M = $0.018/min. The Live Translate and Transcribe Live footnotes on the same page also use 25 tokens/s.
- r10's line "Google states only 'a fixed rate per second'" is superseded.
- For comparison (from r07, not re-verified here):
  - OpenAI realtime is about 10 tokens/s in and 20 tokens/s out.
  - Qwen-Omni realtime is 7 tokens/s in and 12.5 tokens/s out.

### 1.3 Cost model

For turn *k* of a session with no compression:

```
cost_k = prefix_text_tokens × $0.75/M                     (system instruction, re-billed each turn)
       + audio_context_k × $3/M                            (all accumulated user + model audio, at the INPUT rate)
       + new_model_audio_k × $12/M                         (this turn's spoken reply)
       + transcription_text_k × $4.50/M                    (if input/output transcription is on)
audio_context_k = Σ_{j<k} (user_audio_j + model_audio_j) + user_audio_k
```

**Assumptions** (marked; each needs checking against `usageMetadata`):

- **A1. Model audio is re-billed.** The model's own past audio is part of the "accumulated native audio" and is re-billed at the input rate. The docs say the context includes all tokens from previous turns, and a turn includes the model's response.
- **A2. The system instruction is re-billed every turn** as text input.
- **A3. Input audio volume depends on what the client streams.** Silence or background audio counts as input context if it is streamed. Under proactive audio, which is always on for 3.8 Live, the docs bill input for the whole listening time. A client that streams continuously, as Google's examples and barge-in both require, therefore adds about 25 tokens/s of input for the whole wall-clock duration.
- **A4. Thinking is ignored.** The models overview calls `gemini-3.8-live` the "Default Live API model" for agents without reasoning delays, and the extended-thinking variant is the high-reasoning one. **Fact-check caveat (2026-10-20):** the 3.8 Live model page says thinking is "supported with interleaved reasoning" and that `thinking_level` cannot be set. If the default model emits any thinking tokens, they would be billed on top of S2/S3 (at the text-output rate, by analogy with other Gemini models; not stated for Live). Check `usageMetadata` for thinking tokens in the pilot.

**Reference call.** The parameters are taken from r10 §1 so that the S2S and cascade figures remain directly comparable:

- **Length and turns:** 10 minutes, matching `DEFAULT_VOICE_MAX_CALL_DURATION_SECONDS = 600` [code]. 4 exchanges per minute, so 40 turns.
- **Speech:** the user speaks 21 s/min and the bot 30 s/min.
- **Prompt and transcripts:** a 4,000-token persona/lorebook prefix. Transcripts are about 37 bot tokens and 17.5 user tokens per turn.

### 1.4 Recomputed costs [est, computed 2026-10-20]

| Scenario | 5-min call | **10-min call** | 30-min call | Peak context at 10 min |
|---|---|---|---|---|
| S1 floor: no re-billing. List per-minute rates only. **Ruled out by the docs.** | $0.012/min | $0.012/min ($0.12) | $0.012/min | 16.8k |
| S2 documented compounding, **client sends only speech** (local VAD gating) | $0.060/min | **$0.098/min ($0.98)** | $0.251/min* | 16.8k |
| **S3 documented compounding, mic streamed continuously (default; proactive audio listening)** | $0.091/min | **$0.158/min ($1.58)** | $0.428/min* | 26.5k |
| S3 + compression, 25k trigger / 8k window (doc example values) | $0.091/min | $0.148/min ($1.48) | $0.162/min | 25.4k |
| S3 + compression, 12k trigger / 6k window | $0.071/min | **$0.078/min ($0.78)** | $0.082/min | 12.4k |
| S2 + compression, 12k trigger / 6k window | $0.060/min | **$0.072/min ($0.72)** | $0.079/min | 12.3k |
| S3 at 6 turns/min (r07's assumption) | $0.131/min | $0.232/min | $0.637/min* | 26.5k |
| S2 at 6 turns/min | $0.086/min | $0.143/min | $0.372/min* | 16.8k |
| S3 with a 1k-token prefix instead of 4k | $0.082/min | $0.149/min | $0.419/min* | 23.5k |

\* A 30-minute audio-only session is **not possible without compression** (15-minute limit [doc]). Those cells only show how the cost grows.

**Marginal cost per minute** inside the 10-minute call. This matters for spend caps and for the cost of long calls:

- **S2:** rises from $0.029 in minute 1 to **$0.167 in minute 10**.
- **S3:** rises from $0.037 in minute 1 to **$0.280 in minute 10**.

**Tier-1 spend cap.** Google applies spend-based limits of $10 per rolling 10 minutes at Tier 1 ($50 at Tier 2, $200 at Tier 3), in addition to RPM/TPM. Exceeding it returns 429 `RESOURCE_EXHAUSTED`. The page adds that whether these limits apply "depends on your billing history and account standing", and lists a separate overall billing-tier cap ($250 at Tier 1) ([rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), last updated 2026-10-15, re-fetched 2026-10-20). At average cost the $10 / 10 min limit allows:

| Scenario | Concurrent 10-minute calls at Tier 1 |
|---|---|
| S3 | ≈ **6** |
| S2 | ≈ 10 |
| S3 + 12k/6k compression | ≈ 13 |
| S1 (r10's figure) | ≈ 84, but not achievable |

Calls that are all near their end cost more per minute, so the real figure is lower.

### 1.5 Reconciliation

- **r10's $0.097/min** equals S2: speech-only audio, 4 turns/min, full re-billing. r10 computed it correctly, but labelled it "if" rather than as the documented behaviour.
- **r10's $0.011/min** equals S1. The best-practices page rules it out, so it must not appear as a lower bound. r10's line "$10 per 10 minutes allows about 91 concurrent sessions if billing is incremental" must also be dropped.
- **r07's $0.15–0.30/min** matches S3 at 4–6 turns/min. Its claim that "Gemini's docs confirm every turn is billed for all context tokens" is **correct**, and the citation is the right page.
- **Settled single figure for the S2S-vs-cascade comparison:** **Gemini 3.8 Live ≈ $0.16/min on the 10-minute reference call (S3)**. Show a lever range beside it: **$0.07–0.10/min** with client-side speech gating and/or a 12k/6k sliding window. Never present it as cheaper than about $0.07/min for a 10-minute call.

**Consequences for the comparison** (the other S2S and cascade figures are from r10 and are not re-verified here):

| Stack (10-minute reference call) | $/min | Source |
|---|---|---|
| Cascade A (current: Groq Whisper + gpt-5-mini-class cached + ElevenLabs v4 Turbo) | ≈ 0.030 | r10 §3 |
| Cascade A′ (Fish S2.1 Pro lane) | ≈ 0.013 | r10 §3 |
| gpt-realtime-2.1-mini (cache hits) | ≈ 0.020 | r10 §2.4 |
| GPT-Live-1 + cheap backend | ≈ 0.051 | r10 §2.4 |
| Grok Voice 3.0 (flat) | 0.08 | r07 §3.4 / xAI rate card |
| **Gemini 3.8 Live, documented billing** | **≈ 0.16 (0.07–0.10 with levers)** | this note |
| gpt-realtime-2.1 (cache broken) | ≈ 0.61 | r10 §2.4 |

- r07's statement that "Gemini 3.8 Live and Nova 2 Sonic have the lowest list prices" is true only of **list** prices.
- On effective cost for a 10-minute call, Gemini 3.8 Live is **5× cascade A** and about **8× gpt-realtime-2.1-mini with cache hits**. It is cheaper than Grok's flat $0.08 only when compression is aggressive.
- Nova 2 Sonic's carry-over billing was not checked here. Treat it as possibly compounding too, until it is measured. (Fact-check 2026-10-20: the [Amazon Nova pricing page](https://aws.amazon.com/nova/pricing/) says text-token rates apply to "adding conversation history to the session", but gives no rates or accumulation rule. The [Nova 2 Sonic guide](https://docs.aws.amazon.com/nova/latest/nova2-userguide/using-conversational-speech.html) states an **8-minute connection limit** with a renewal pattern. The aiewf-eval README references a "Nova 2.5 Sonic" study dated 2026-10-19; that model name was not found in the AWS pages fetched (unverified).)

### 1.6 Still unknown (measure with `usageMetadata` before any commitment)

1. Is the model's own output audio re-billed at the input rate (A1)? This decides whether S2 and S3 are upper bounds or exact.
2. Under proactive audio, does streamed silence enter the context window, or is it only billed while listening?
3. What counts as a "turn" when proactive audio decides not to respond? Is a "turn" billed then?
4. Does sliding-window compression keep the system instruction? (The page does not say what is evicted.)
5. ~~Is there any implicit caching discount for Live?~~ **Closed (fact-check 2026-10-20):** no. The pricing page lists no caching row for Live, and the 3.8 Live model page lists "Caching" as **not supported**.
6. Does `gemini-3.8-live` emit billable thinking tokens by default (see A4)?

---

## 2. LiveKit endpointing defaults

### 2.1 What the primary pages say (all rendered 2026-10-20; no version dates shown)

- **[Turn handling options reference](https://docs.livekit.io/reference/agents/turn-handling-options/)** [doc]:
  - `EndpointingOptions`: `mode` defaults to `fixed`, `min_delay` to **0.5 s** and `max_delay` to **3.0 s**. The dynamic-mode EMA coefficient defaults to 0.9.
  - With the **audio turn detector**, any `min_delay` and `max_delay` you don't set default to **0.3 s and 2.5 s** instead of 0.5 s and 3.0 s.
  - If `turn_detection` is omitted, the session defaults to the `TurnDetector`.
  - Interruption defaults: `min_duration` 0.5 s, `false_interruption_timeout` 2.0 s, `resume_false_interruption` True.
  - Preemptive generation is on by default: `preemptive_tts` False, `max_speech_duration` 10 s, `max_retries` 3.
- **[Turn detector page](https://docs.livekit.io/agents/logic/turns/turn-detector/)** [doc]:
  - The generic default wait is 0.5–3.0 s. With the audio detector it drops to **0.3 / 2.5 s**. The text detector keeps 0.5 / 3.0 s.
  - The audio detector **requires VAD with `min_silence_duration ≥ 0.25 s`**; a lower value raises `ValueError` at session start. The Silero default of 0.55 s qualifies.
  - The audio detector comes in two models: `v1`, served on LiveKit Inference, and `v1-mini`, which runs locally on CPU. It covers 14 languages, Spanish included.
  - If the audio model gives no prediction within about 1 s, the turn is committed anyway. By default, a timeout on v1 also **falls back to v1-mini for the rest of the session**.
  - **Which variant is the default** (added in fact-check 2026-10-20): agents deployed to LiveKit Cloud, and local `dev` mode with Cloud credentials, use **v1**; self-hosted agents in production (`start`) use **v1-mini**.
  - The text detector (`MultilingualModel`, fine-tuned from Qwen2.5-0.5B-Instruct per the [Hugging Face model card](https://huggingface.co/livekit/turn-detector), about 50–160 ms on CPU, ~396 MB on disk) is **deprecated, with removal planned for 2.0**. (The Hugging Face card still recommends `MultilingualModel` for new projects; the docs page is the newer statement.)
- **[Turns overview](https://docs.livekit.io/agents/logic/turns/)** [doc]: when `turn_detection` is not specified, `AgentSession` **enables the audio turn detector automatically**. This page does not say whether that is v1 or v1-mini; the turn-detector page does (see above).
- **[Tuning page](https://docs.livekit.io/agents/logic/turns/tuning/)** [doc]: the options tables list only 0.5 s / 3.0 s (Python) and 500 / 3,000 ms (Node), with no audio-detector note. **This is the page r01 and r08 cited.** It explains how they got 0.5 / 3.0 s without the qualifier.

### 2.2 Which default applies when

| Turn-detection mode | `min_delay` default | `max_delay` default | Notes |
|---|---|---|---|
| **Audio TurnDetector** (`inference.TurnDetector()`, v1 on LiveKit Cloud / v1-mini when self-hosted). **This is the `AgentSession` default when `turn_detection` is omitted.** | **0.3 s** | **2.5 s** | Applies only to values you leave unset. Needs VAD `min_silence_duration ≥ 0.25 s`. Commits after about 1 s if the model doesn't answer; a v1 timeout falls back to v1-mini. |
| Text turn detector (`MultilingualModel`, deprecated) | 0.5 s | 3.0 s | Being removed in Agents 2.0 |
| VAD-only, STT endpointing, realtime-model, manual | 0.5 s (parameter default) | 3.0 s | The docs give no mode-specific values, so the parameter defaults apply. |
| `mode="dynamic"` (Python only) | Adapts inside [min, max] | — | EMA α = 0.9 over the session's pause statistics |

**Verdict:**

- **r02 is correct** for the audio detector.
- **r01 is wrong in one phrase.** "LiveKit uses `min_delay` 0.5 s and `max_delay` 3.0 s *with the turn model*" holds only for the deprecated text model. Its fact-check row 15 should add the 0.3 / 2.5 s audio-detector default.
- **r08's knob table** should footnote `endpointing.min_delay`/`max_delay`: "0.5 / 3.0 s generic; 0.3 / 2.5 s when the audio turn detector is active, which is the default."
- **Final-docs wording:** "LiveKit's documented endpointing defaults are 0.5 s minimum and 3.0 s maximum. With its audio turn detector, which `AgentSession` uses by default, unset values become 0.3 s and 2.5 s."

### 2.3 Why it matters for Magic Worlds

- **Today's fixed hang-over.** Magic Worlds uses a fixed **550 ms** silence hang-over with no turn model (§4). LiveKit's default for its audio-model path is a **300 ms** minimum wait, gated by a learned end-of-turn model, with a **2.5 s** backstop.
- **Endpointing recommendation for the final docs:** about **250–300 ms of silence plus an audio turn model** (LiveKit v1-mini or Pipecat Smart Turn v3.x), and a **max wait of about 2.5 s** for "incomplete" verdicts. Optionally, dynamic per-user adaptation.
- **Open point: do the delays stack?** The docs measure `min_delay` from the "last detected speech". The fetched pages do not say whether this starts at the raw end of speech or at the VAD end-of-speech event, which itself lags by `min_silence_duration`. Measure `end_of_turn_delay` before claiming a 300 ms end-of-turn.

---

## 3. LLM time to first answer token (TTFAT)

### 3.1 What each number measures

| Aspect | aiewf-eval: "Groq gpt-oss-120b 98 ms" (r01) | Artificial Analysis: "Groq 4.91 s" (r05) |
|---|---|---|
| Source and date | [aiewf-eval](https://github.com/kwindla/aiewf-eval) README, cohorts to 2026-10-18/19. The row now lives only in the [Groq archive](https://github.com/kwindla/aiewf-eval/blob/main/docs/groq-gpt-oss-120b-archived-2026-10-17.md) (2026-10-17). | [AA gpt-oss-120B providers](https://artificialanalysis.ai/models/gpt-oss-120b/providers), accessed 2026-10-20. [Methodology v2.2.0](https://artificialanalysis.ai/methodology/performance-benchmarking), 2026-03-02. |
| Metric | "Service time to the first user-visible answer token or tool-call output". The archived row is labelled **"Published latency"** P50/P95/max: 98 / 217 / 2,117 ms, with an 86.3% pass rate. | **TTFAT, measured after thinking time.** Separately: time to first chunk, which for reasoning models is the first *reasoning* token. |
| Workload | 30-turn scripted conversation with tools and a **~12k-token knowledge base**. The first scripted response of each conversation is excluded. | **10k-token unique prompt** per run (generated at test time), single turn. |
| Cache state | "Caching settings differ across rows." Not stated for this row. Later turns of a 30-turn conversation likely benefit from automatic prefix caching (Groq caches gpt-oss automatically) [inference]. | Prompts are unique, so there is no prefix reuse to exploit (AA measures cache-hit rates separately). |
| Reasoning | **Effort not stated** in the archive. The README's own caveat: reasoning that leaks into content may start the timer before the final answer. | **High** reasoning. AA lists only the High variant for this model. Reasoning time is **4.22 s** on Groq. |
| Client and network | Region not stated. Local-GPU rows omit network; cloud rows don't say. | One GCP VM in `us-central1-a`; network is included. P50 over 72 hours. |
| Status | **Archived and removed from the live table at the maintainer's request.** Copied without recalculation. "Exact-cohort mapping" unresolved. | Current |

**Why the gap is about 50×:** Groq's AA TTFAT is **0.68 s** to the first (reasoning) chunk on an uncached 10k prompt, plus **4.22 s** of high-effort reasoning at about 474 tokens/s (roughly 2k reasoning tokens), giving **4.91 s**. The 98 ms row assumes a near-zero prefill (warm cache), near-zero reasoning, a nearby client, and possibly the early-timer artefact. **Neither number answers the voice question:** thinking off or minimal, a 3–8k prompt, a warm cache, measured from the app's region.

### 3.2 Related caveats found while re-fetching

- **AA's per-model pages default to the max-reasoning variant.**
  - GPT-6 Luna (max) shows 89.84 s TTFAT; Claude Haiku 5.5 (max) shows about 245 s. AA lists **no thinking-off variant for Haiku 5.5**.
  - The leaderboard's latency column is **first chunk**, not TTFAT. For reasoning models whose thoughts are not streamed (Gemini, Claude), first chunk can include all the thinking time. That explains Gemini 3.5 Flash-Lite at 7.53 s and Haiku 5.5 (low) at 8.39 s on the leaderboard ([AA leaderboard](https://artificialanalysis.ai/leaderboards/models), accessed 2026-10-20).
  - AA's leaderboard values come from its default 10k workload, per methodology v2.2.0 (the leaderboard page itself does not restate the prompt length).
- **aiewf does not rank `gpt-6-luna (none)`.** It shows 0/30 completions in the Responses-repair table, so it is unranked with no TTFAT. Only `gpt-6-luna (low)` is ranked, at 917 / 1,439 ms. There is no independent multi-turn TTFAT for Luna with thinking off. Check that an integration with reasoning `none` actually completes before shortlisting it.
- **gpt-oss reasoning cannot be turned off.** Groq documents only `low`, `medium` and `high`. `include_reasoning: false` hides the reasoning but the docs do not say it saves time. Qwen 3.8 27B on Groq supports `reasoning_effort: none` ("will not use any reasoning tokens") ([Groq reasoning docs](https://console.groq.com/docs/reasoning), accessed 2026-10-20, undated).
- **OpenRouter publishes no added-latency figure.** Magic Worlds routes through it today (audit `be-llm.md`). Its [latency page](https://openrouter.ai/docs/features/latency-and-performance) (undated, accessed 2026-10-20) describes the overhead as minimal and lists these factors and options:
  - Edge caches are cold for the first 1–2 minutes in a new region.
  - Latency rises when the account's credit balance is low.
  - Fallbacks add latency.
  - **A sticky `session_id` pins a conversation to one provider for about 10 minutes to keep the KV cache** (the page calls it a "10-minute best-effort pin"). Hard-coding `provider.order` disables this. **Also (fact-check 2026-10-20):** Auto Exacto can switch providers mid-session on tool-calling requests, overriding the pin.
  - `preferred_max_latency` (for example `{ "p90": 2.5 }`) is a soft routing preference evaluated over a rolling 5-minute window.

### 3.3 Prompt-cache minimums that matter at 3–8k tokens (from r05 §4.1; re-fetched in the 2026-10-20 fact-check)

| Provider | Minimum cacheable prefix | Implication |
|---|---|---|
| Anthropic | 512 tokens (Haiku 5.5; also Sonnet/Opus 5.5). Haiku 4.5 is 4,096. | Caches at 3k. `max_tokens: 0` pre-warm is documented, but is rejected with `stream: true`, extended thinking, structured outputs or forced `tool_choice`, and must use the same thinking config as the real requests. |
| OpenAI (GPT-5.6+) | 1,024 tokens (GPT-5.5 and earlier: varies by request settings) | Caches at 3k. GPT-5.6+ also accepts `prompt_cache_options.ttl: "12h"` (default 30 min). |
| Gemini (implicit) | **4,096 tokens** for 3.1 Pro Preview, 3.6 Flash, 3.8 Flash and 4 Argon. **3.5 Flash-Lite is not in the caching table (unverified).** Live models: caching not supported. | A 3k prompt is **not cached**; 5–8k is |
| Groq | 128–1,024 tokens, **gpt-oss models only** (20b, 120b, safeguard-20b). Qwen 3.8 27B is **not** cached on Groq. | gpt-oss caches with a 50% discount; Qwen on Groq gets no warm-cache benefit |
| Cerebras | 128-token blocks, on by default for all models | Caches, but with no price discount |

### 3.4 Expected TTFAT per shortlisted provider: thinking off or minimum, 3–8k-token prompt, warm cache

These are **provider-side** expectations [est]. Each is derived from the closest independent anchor, adjusted for:

- **Prompt size:** shorter than aiewf's ~12k and AA's 10k.
- **Cache:** warm, versus AA's uniquely generated prompts.
- **Reasoning:** none or low.

They are not measurements. Use them to rank candidates before Magic Worlds runs its own p50/p95 bake-off from the production region.

| Candidate (thinking setting) | Closest independent anchor | Expected p50 | Expected p95 | Confidence | Notes |
|---|---|---|---|---|---|
| **Claude Haiku 5.5** (`thinking: disabled`, effort ≤ high), Anthropic API | aiewf "thinking off, low": **556 / 819 ms** (12k KB, 30 turns) [indep] | 0.45–0.60 s | 0.75–0.90 s | Medium | Needs `cache_control`; pre-warm with `max_tokens: 0`. AA has no thinking-off data. |
| **GPT-6 Luna** (`reasoning: none`), OpenAI | AA non-reasoning first chunk **0.83 s** at 10k uncached [indep]. Sibling: aiewf gpt-5.5 (none) 780 / 1,173 ms | 0.55–0.80 s | 1.1–1.4 s | Low–medium | aiewf: 0/30 completions with `none`, so verify the integration. Caches at ≥1,024 tokens. |
| **gpt-oss-120b** (`low`; cannot be off), **Cerebras** | AA first chunk **0.34 s** at 10k uncached; high-effort reasoning adds 1.15 s at ~1,734 tokens/s [indep] (Cerebras's own catalog claims ~3,000 tokens/s [vendor]) | 0.25–0.45 s | 0.5–0.9 s | Low–medium | Assumes 30–150 low-effort reasoning tokens (≈ 20–90 ms) [est]. There is no independent tail data. |
| **gpt-oss-120b** (`low`), **Groq** | AA first chunk **0.68 s** at 10k uncached; high effort 4.91 s [indep]. The aiewf 98 ms row is **not usable**. | 0.40–0.80 s | 0.8–1.5 s | Low | Reasoning at ~474 tokens/s adds 60–320 ms for 30–150 tokens [est]. Automatic caching gives a 50% discount and lower latency, but the latency gain is unquantified. |
| **Qwen 3.8 27B** (thinking off / `none`), Baseten, Groq (preview) or Cerebras | aiewf Baseten FP8: **649 / 801 ms** [indep]. Groq ~450 tokens/s and Cerebras ~1,850 tokens/s are vendor figures. | 0.35–0.65 s | 0.6–0.9 s | Medium (Baseten), low (others) | AA's non-reasoning first chunk of 4.06 s at 48 tokens/s reflects a slow default host. Groq marks it preview ("may be discontinued at short notice"), so there is a churn risk. **Groq does not prompt-cache it** (caching is gpt-oss only), so the warm-cache assumption does not hold on Groq; Cerebras caches it (no discount). |
| **Gemma 4 31B** (thinking off), Baseten or LiveKit Inference | aiewf: **497 / 629 ms**, but **max 33.3 s** [indep] | 0.40–0.55 s | 0.6–0.75 s | Medium | The max outlier means a TTFT watchdog or hedge is needed. AA's non-reasoning first chunk of 1.87 s is from another host. |
| **Gemini 3.5 Flash-Lite** (`minimal`; cannot be fully off) | aiewf: **617 / 1,145 ms** [indep] | 0.55–0.70 s | 1.0–1.2 s | Medium | Implicit-cache minimum for 3.5 Flash-Lite is not listed on the caching page (4,096 for 3.6/3.8 Flash; unverified for Flash-Lite). Gemini 3.8 Flash's lowest level is `low` (confirmed on the thinking page, 2026-10-14), with aiewf 1,411 / 1,967 ms, so it is not a candidate. **Missed newer option:** Gemini 3.6 Flash also supports `minimal`; no aiewf or AA thinking-minimal figure for it was found. |
| **Self-hosted / dedicated** (Nemotron-class PhoneLLM, Qwen NVFP4) | aiewf local Qwen 3.8 27B NVFP4 on an RTX 5090: **101 / 318 ms** with no network [indep]. Daily PhoneLLM: <100 ms P95 for a single request on a B200 [vendor] (unverified: no primary source fetched; aiewf does not list PhoneLLM) | 0.10–0.30 s + RTT | 0.3–0.6 s + RTT | Low–medium | Fast thinking-off variants can be weak on quality: nemotron-3.5-lightning (thinking off) has a 69.6% pass rate, from a **partial** run (16 of 30 conversations complete). |

**Planning rule for the final docs:** with thinking off and a cached 3–8k prefix, mainstream hosted APIs land at **about 0.45–0.8 s p50 and 0.8–1.4 s p95**. Fast-silicon or dedicated open models land at **about 0.25–0.65 s p50**. Anything with reasoning enabled adds about 1–5 s and is excluded from the call lane.

**Magic Worlds adds its own overhead on top.** The one documented probe measured **1,578.8 ms to first text** with a tiny prompt and no BFF admission. That covers the api.magic_llm, OpenRouter and model path (stages 9–16 in `be-llm.md`). The audit attributes an estimated 150–750 ms to the durable checkpoint and admission work in api.magic_llm (BE-LLM-02). The provider TTFAT above is therefore *not* the end-to-end LLM stage until that hop is slimmed down.

---

## 4. Out-of-date codebase facts (r03 and related notes)

### 4.1 Verified current values [code, 2026-10-20]

| Fact | r03 says | Current value | Evidence |
|---|---|---|---|
| Silence hang-over that ends a turn | 800 ms by default (450 ms "strict") | **550 ms in production**. 800 ms is only the worklet's fallback ("balanced"). The 450 ms "strict" setting is **unreachable**, because the hook never passes `aggressiveness` and `voice_start` hard-codes `balanced`. | `src/features/call/components/CallScreen.tsx:114` sets `vad: { silenceMsToEnd: 550, minSpeechMs: 250 }`. Worklet fallback at `voiceVadProcessor.worklet.js:225`. Audit `fe-capture.md` lines 176 and 349. |
| Client segment cap (`maxSegmentMs`) | 7,500 ms | **7,500 ms only until consent and ready**. It is then reconfigured to **server limit − 500 = 29,500 ms**. | `useVoiceCallController.ts:129` (`DEFAULT_MAX_SEGMENT_MS = 7_500`), `:131` (`SEGMENT_LIMIT_MARGIN_MS = 500`), `:545-547` (`configure({ maxSegmentMs: max - 500 })`). Audit `fe-capture.md:178`. |
| Server segment limit | "rejects segments over 8 s" | **30 s** (`DEFAULT_VOICE_MAX_SEGMENT_DURATION_MS = 30_000`), plus a 2,000,000-byte cap | `magic-worlds-api/src/services/voice_orchestration/config.py:42-43`. The "8 s" text is a stale comment at `src/features/interaction/audio/voiceVadWorklet.ts:17`. |
| Uplink transport | (r03: "posted as WAV"; correct) | Whole-utterance 16 kHz PCM16 WAV sent as a **multipart HTTP POST** to `/character-chats/{id}/voice-segments`. The voice WebSocket carries **no client audio**, only control frames. | `src/infrastructure/api/index.ts:5439`, `src/infrastructure/api/voiceSocket.ts:6`, `src/shared/types/voice.types.ts:112-138`. Audit `fe-capture.md:24`. |

### 4.2 r03 passages to mark superseded, with corrected content

1. **§0 TL;DR item 2** ("waits for … 800 ms of silence by default … about 1.0–1.5 s").
   - **Superseded.** Use a 550 ms hang-over.
   - Recompute end of speech to transcript as 550 ms + upload 60–700 ms (uncompressed whole-utterance PCM, per the audit) + Groq 150–500 ms, which gives **about 0.75–1.75 s** [est].
   - The audit puts the client side alone at 620–1,300 ms before STT can start.
2. **§6.1 bullets** ("`silenceMsToEnd` = 800 ms", "`maxSegmentMs` is 7,500 ms, and the server rejects segments over 8 s") and the **estimate table's 800 ms row**: superseded by the values in §4.1.
3. **§6.2 "Long user turns: hard 7.5–8 s cut splits monologues"**: superseded. Monologues are cut only at 29.5 s. The real failure modes are the opposite (audit FE-CAPTURE-02 and FE-CAPTURE-04):
   - Non-stationary noise can hold a segment open until the **29.5 s** cut. The character then does not answer for up to about 30 s.
   - Any **pause over 550 ms splits a turn**. A re-simulated 600 ms mid-sentence pause produced two segments. The server merges them only if the first turn's user message was not yet persisted.
4. **§8(d) pitfalls** "Fixed silence timeouts (800 ms+)" and "Hard max-segment cuts (7.5 s)".
   - Keep the general pitfalls, but remove them as descriptions of Magic Worlds.
   - Magic Worlds' pitfall is a fixed 550 ms timeout with no turn model, and a 29.5 s noise-held maximum.
5. **§10 P0 item 4** ("Drop `silenceMsToEnd` from 800 to ~500 ms") is **obsolete**, because it is already 550 ms. Replace it with: add a turn-completion check (Smart Turn v3.x or LiveKit v1-mini, or a text-completeness heuristic) with a **dynamic hang-over**:
   - about 200–300 ms when the utterance is complete;
   - 800–1,500 ms when it is incomplete;
   - plus a learned speech VAD to stop noise from holding segments open.
6. **§10 P2 item 4** ("Lift the 8 s segment cap") is **obsolete**. Replace it with:
   - stream the uplink, which removes the per-segment cap;
   - keep a server-side maximum as a guard against noise, but cut on speech-aware VAD, not energy.

### 4.3 The same stale facts in other notes

- **r02 §11 P0 item 2** ("The client already uploads whole-utterance PCM segments of at most 8 s, which matches Smart Turn's 8 s window"): **superseded**. Segments can be up to 29.5 s. Smart Turn must be run on the **last ≤ 8 s** of the segment, which is its documented input window.
- **r01's Magic Worlds current-state section** ("The segment is uploaded over a WebSocket") and **r07 §11** ("each utterance uploaded over WebSocket"): **wrong**. The upload is a multipart HTTP POST; the voice WebSocket carries downlink audio and control frames only. The workflow's product-context brief has the same error. The final docs should say "HTTP POST per utterance; WebSocket for control plus downlink MP3".
- `voiceVadWorklet.ts:17` (8 s) and `:23` (~800 ms) are **stale code comments**. The audit already lists them in `fe-capture.md:348-350`. Fixing them belongs in the code backlog, not here.

---

## 5. Best practice, current leading options, emerging techniques and pitfalls (for these four issues)

**(a) Established best practice**

- Quote every latency figure with its **conditions**: prompt length, cache state, reasoning setting, client region, percentile and date. AA and aiewf differ on all of these.
- For token-billed speech-to-speech models, compute cost **per turn with context carry-over**, not from per-minute list prices. Confirm with the provider's usage fields: Gemini `usageMetadata`, OpenAI `usage` with `cached_tokens`.
- For framework defaults, quote the **mode-specific** value (LiveKit 0.3 / 2.5 s with the audio detector).
- Re-derive codebase facts from source at the time of writing. Comments and docs in the repo were wrong in three places here.

**(b) Current leading options**

- **Gemini 3.8 Live:**
  - It has strong pause handling, a low list price and documented context compression. **Language count corrected (fact-check 2026-10-20):** the Live capabilities page (2026-09-18) lists **99 languages**, while the Live overview page (2026-10-06) says "70 supported languages"; the 3.8 Live model page gives no count. Quote "70–99 depending on the Google page" rather than "97+".
  - Server-side automatic VAD is on by default; Google recommends `silenceDurationMs` 500–800 ms and says the server's internal default is about 800 ms.
  - Affective dialogue is no longer available on 3.8 Live (removed per the model page).
  - Its effective cost on a 10-minute call is about $0.16/min unless managed.
- **LiveKit audio turn detector v1 / v1-mini:**
  - It is the default in `AgentSession` (v1 on LiveKit Cloud, v1-mini when self-hosted), covers 14 languages including Spanish, and uses 0.3 / 2.5 s defaults.
- **Pipecat Smart Turn:** latest is **v3.2** (23 languages, ~8M params on Whisper Tiny, 8 s max input window trimmed from the start, ~10–100 ms CPU inference) per the [smart-turn repo](https://github.com/pipecat-ai/smart-turn).
- **Fast thinking-off LLMs for the call lane:**
  - Haiku 5.5 (thinking disabled).
  - Gemma 4 31B and Qwen 3.8 27B on dedicated or fast hosts.
  - gpt-oss-120b (low) on Cerebras.
  - GPT-6 Luna (none), pending verification.

**(c) Emerging**

- Proactive audio and always-listening billing in S2S models (Gemini 3.8 Live) make **client-side speech gating** a cost lever, which it was not before. It trades against barge-in and proactive behaviour.
- OpenRouter-style **latency-percentile routing** (`preferred_max_latency`) and sticky sessions that keep the KV cache.
- Benchmarks such as aiewf that measure **multi-turn TTFAT**, rather than single-shot first chunk.

**(d) Pitfalls**

- Using AA per-model pages (max reasoning, uncached 10k) or archived leaderboard rows as voice TTFT targets.
- Treating "$0.005 + $0.018 per minute" as Gemini Live's cost.
- Running Gemini Live sessions longer than 15 minutes without compression, which fails the session.
- Ignoring Google's spend-based caps ($10 per 10 minutes at Tier 1 allows only about 6 concurrent calls under S3).
- Copying framework defaults without the mode qualifier.
- Relying on code comments for limits (the 8 s and ~800 ms comments).

---

## 6. Implications for Magic Worlds (prioritized)

1. **P0: settle the numbers in the final docs.**
   - **Gemini 3.8 Live:** ≈ $0.16/min on the 10-minute reference call (lever range $0.07–0.10). Audio at 25 tokens/s. Compounding billing is documented.
   - **LiveKit:** "0.5 / 3.0 s; 0.3 / 2.5 s with the audio detector, which is the default".
   - **Call-lane LLM:** TTFAT expectations from §3.4.
   - **Capture:** 550 ms hang-over, 29.5 s client cap, 30 s server cap, HTTP POST uplink.
   - Remove r10's $0.011 lower bound and its "91 concurrent sessions" line.
2. **P0: the S2S pilot decision changes.**
   - Gemini 3.8 Live is no longer the cheapest S2S option. On a 10-minute call it costs about 5× the current cascade (about $0.030/min) and about 8× gpt-realtime-2.1-mini with cache hits.
   - It remains a candidate for a "stock-voice quick chat" mode only if:
     - (a) compression is set (trigger about 12k, window about 6k);
     - (b) the client gates audio to speech, if barge-in quality allows;
     - (c) `usageMetadata` per turn is logged in the pilot to confirm S2 or S3;
     - (d) the plan respects the 15-minute session limit, the ~10-minute connection lifetime and the $10 per 10 minutes Tier-1 spend cap.
   - Its policy blocker for 18+ content (r07) is unchanged.
3. **P0: LLM lane bake-off with the right conditions.**
   - Measure TTFAT at p50 and p95 from the production region with a 3–8k cached prefix and thinking off.
   - Candidates: Haiku 5.5 (disabled), Gemma 4 31B or Qwen 3.8 27B on a fast host, gpt-oss-120b (low) on Cerebras, and GPT-6 Luna (none) once integration is confirmed.
   - Use an OpenRouter sticky `session_id` = voice session, or call the provider directly.
   - Reject any candidate whose p95 exceeds about 1.0 s.
   - First remove the api.magic_llm overhead: the probe shows 1.58 s to first text on a tiny prompt.
4. **P1: endpointing.**
   - Replace the fixed 550 ms with about 250–300 ms of silence plus an audio turn model, with a 2.5 s backstop. This matches LiveKit's audio-detector defaults.
   - Measure `end_of_turn_delay` to confirm that the delays don't stack.
5. **P1: capture fixes implied by the corrected facts.**
   - A learned VAD so noise can't hold segments open to 29.5 s.
   - Smart Turn run on the last 8 s of the segment.
   - A streaming uplink over the existing WebSocket.
6. **P2: clean up the code comments** (`voiceVadWorklet.ts:17,23`) so that future research doesn't pick up the stale 8 s and 800 ms values again.

---

## 7. Errata to apply to the earlier notes (for the synthesizer)

| Note | Location | Replace | With |
|---|---|---|---|
| r10 | §0 item 4, §2.4 Gemini row, context-growth table, §3 S2S-4 row, §6 Tier-1 line, §13 item 11, §14 open question | "docs do not say whether accumulated context is billed again"; "$0.011 if billed incrementally"; "$0.011–0.097"; "~91 concurrent sessions"; open question on incremental vs full re-billing | "Per-turn full-context billing is documented (best practices, 2026-09-15). 10-minute call ≈ $0.16/min with continuous streaming, ≈ $0.10/min with speech-only audio, ≈ $0.07–0.08/min with a 12k/6k sliding window. ≈ 6 concurrent calls per $10 / 10 min at Tier 1." Close the open question. |
| r10 | §1 assumptions, Gemini audio-token row | "Google states only 'a fixed rate per second'" | "Google: approximately 25 tokens/s (Live API best practices, 2026-09-15)" |
| r07 | §0 item 7, §3.3, §6 item 4 | "$0.15–0.30/min (estimate)" | "≈ $0.16/min at 4 turns/min (up to ≈ $0.23 at 6 turns/min) with continuous streaming; $0.07–0.10 with levers" |
| r07 | §6 item 4 | "Gemini 3.8 Live and Nova 2 Sonic have the lowest list prices" | Add: "…but Gemini's effective 10-minute cost (≈ $0.16/min) is above GPT-Live-1 and gpt-realtime-2.1-mini with cache hits." |
| r07 | §3.3 | (missing) | Add: "Proactive audio is permanently on for 3.8 Live, so input is billed for all listening time. Transcription is billed at the text-output rate." |
| r01 | §4.2 and fact-check row 15 | "LiveKit uses `min_delay` 0.5 s and `max_delay` 3.0 s with the turn model" | "0.5 / 3.0 s generic. Unset values become 0.3 / 2.5 s with the audio TurnDetector (the AgentSession default)." |
| r08 | §4.4 knob table | `min_delay` 0.5 s / `max_delay` 3.0 s | Add a footnote: "0.3 / 2.5 s when the audio turn detector is active (default)" |
| r01 | §4.4 aiewf table, Groq row | "98 ms" shown in bold alongside live rows | Move to a footnote: "archived 2026-10-17 at the maintainer's request; effort not stated; cohort unresolved; do not use for planning" |
| r05 | §0 item 3, §2.1 | "Groq at 4.91 s" | Add: "high reasoning, uncached 10k prompt: 0.68 s first chunk + 4.22 s reasoning. Not a thinking-off figure." |
| r03 | §0 item 2, §6.1, §6.2, §8(d), §10 P0 item 4, §10 P2 item 4 | 800 ms / 7.5 s / 8 s | 550 ms / 29.5 s / 30 s, per §4.2 above |
| r02 | §11 P0 item 2 (Smart Turn bullet) | "segments of at most 8 s" | "segments up to 29.5 s; run Smart Turn on the last ≤ 8 s" |
| r01, r07 | r01 Magic Worlds current-state section; r07 §11 | "uploaded over a WebSocket" | "uploaded by multipart HTTP POST (`/character-chats/{id}/voice-segments`); the WebSocket carries control frames and downlink audio" |
| any note | Gemini Live language count | "97+ languages" | "70 (Live overview) to 99 (Live capabilities) languages; Google's pages disagree" (added in fact-check 2026-10-20) |

---

## 8. Newer developments the notes missed (added in fact-check 2026-10-20)

All fetched from primary pages on 2026-10-20 unless marked.

- **Gemini 3.8 Live is GA/Stable** (tokenkarma dates GA to 2026-09-15; the model page says "Stable", latest update September 2026). `gemini-3.1-flash-live-preview` is now labelled **"Legacy"** with a migration recommendation. On 3.8 Live, proactive audio cannot be disabled, affective dialogue was removed, caching is unsupported, and thinking is interleaved with no `thinking_level` control.
- **New Gemini speech SKUs relevant to a cascade:** `gemini-3.5-transcribe-live` (audio in $3.50/1M, blended ≈ $0.009/min for Live Transcribe) and `gemini-3.5-live-translate-preview` (blended ≈ $0.0368/min) appear on the pricing page dated 2026-10-19. Also new: `gemini-3.8-flash-tts` and `gemini-3.8-flash-lite-tts`. None of these were benchmarked for latency here.
- **New Gemini text models:** `gemini-4-argon` and `gemini-3.6-flash` are on the pricing and thinking pages. 3.6 Flash supports `thinking_level: minimal`; 4 Argon's lowest is `low`. Neither appears in the TTFAT anchors above; 3.6 Flash (minimal) is worth adding to the bake-off. `gemini-omni-1.1-flash` is a **video-generation** model, not a voice-to-voice Live model, despite its name.
- **OpenAI:** `gpt-live-1` is $0.05/min, **billed per second** with no rounding, with backend model and tool usage billed separately. `gpt-realtime-2.1-mini` is $10 / $20 per 1M audio in/out with cached audio input at $0.30. GPT-6 Luna is $0.10 / $0.50 per 1M (cached $0.01). GPT-5.6+ supports a 12-hour prompt-cache TTL.
- **xAI:** `grok-voice-3.0` is $0.08/min ($4.80/h); `grok-voice-2.0` is marked deprecated.
- **ElevenLabs:** `eleven_v4_turbo` (~100 ms median inference, 90+ languages) and `eleven_v4` are current; `eleven_turbo_v2_5` and `eleven_turbo_v2` are deprecated in favour of the Flash v2.5 / v2 models (~75 ms).
- **LiveKit:** default audio-detector variant is v1 on Cloud and v1-mini when self-hosted; v1 timeouts fall back to v1-mini.
- **Pipecat Smart Turn v3.2** is the current release (23 languages).
- **Amazon Nova 2 Sonic:** 8-minute connection limit with a renewal pattern; conversation history added to a session is billed at text-token rates. "Nova 2.5 Sonic" is referenced only by aiewf-eval (unverified).
- **OpenRouter:** Auto Exacto can override sticky `session_id` pins on tool-calling requests.

---

## Sources

| Source | URL | Date |
|---|---|---|
| Google: Gemini Live API best practices (Pricing and billing; Context and Session management) | https://ai.google.dev/gemini-api/docs/live-api/best-practices | Last updated 2026-09-15; fetched 2026-10-20 |
| Google: Gemini Developer API pricing (Live rows) | https://ai.google.dev/gemini-api/docs/pricing | Last updated 2026-10-19; fetched 2026-10-20 |
| Google: Live API session management | https://ai.google.dev/gemini-api/docs/live-session | Last updated 2026-09-15; fetched 2026-10-20 |
| Google: Gemini rate limits (spend-based caps, via r10) | https://ai.google.dev/gemini-api/docs/rate-limits | Cited from r10 (accessed 2026-10-20) |
| tokenkarma: Gemini Live API pricing reality check | https://tokenkarma.app/blog/gemini-live-api-pricing-voice-agents-2026/ | 2026-09-17 |
| LiveKit: turn handling options reference | https://docs.livekit.io/reference/agents/turn-handling-options/ | Rendered 2026-10-20 (no version date) |
| LiveKit: turn detector | https://docs.livekit.io/agents/logic/turns/turn-detector/ | Rendered 2026-10-20 |
| LiveKit: turns overview | https://docs.livekit.io/agents/logic/turns/ | Rendered 2026-10-20 |
| LiveKit: turn tuning | https://docs.livekit.io/agents/logic/turns/tuning/ | Rendered 2026-10-20 |
| aiewf-eval README (TTFAT leaderboard) | https://github.com/kwindla/aiewf-eval | Cohorts to 2026-10-18/19; fetched 2026-10-20 |
| aiewf-eval Groq gpt-oss-120b archive | https://github.com/kwindla/aiewf-eval/blob/main/docs/groq-gpt-oss-120b-archived-2026-10-17.md | 2026-10-17 |
| Artificial Analysis: performance benchmarking methodology v2.2.0 | https://artificialanalysis.ai/methodology/performance-benchmarking | 2026-03-02 |
| Artificial Analysis: gpt-oss-120B providers | https://artificialanalysis.ai/models/gpt-oss-120b/providers | Accessed 2026-10-20 (72-hour medians) |
| Artificial Analysis: model leaderboard | https://artificialanalysis.ai/leaderboards/models | Accessed 2026-10-20 |
| Artificial Analysis: Claude Haiku 5.5 providers | https://artificialanalysis.ai/models/claude-haiku-5-5/providers | Accessed 2026-10-20 |
| Artificial Analysis: GPT-6 Luna providers | https://artificialanalysis.ai/models/gpt-6-luna/providers | Accessed 2026-10-20 |
| Groq: reasoning docs | https://console.groq.com/docs/reasoning | Undated; accessed 2026-10-20 |
| OpenRouter: latency and performance | https://openrouter.ai/docs/features/latency-and-performance | Undated; accessed 2026-10-20 |
| Audit: front-end capture | `docs/call_realtime/evidence/audit/fe-capture.md` | 2026-10-20 |
| Audit: backend LLM | `docs/call_realtime/evidence/audit/be-llm.md` | 2026-10-20 |
| Audit: end-to-end latency trace | `docs/call_realtime/evidence/audit/e2e-latency-trace.md` | 2026-10-20 |
| Code: `CallScreen.tsx:114`; `useVoiceCallController.ts:129,131,545-547`; `voiceVadProcessor.worklet.js:43,225`; `voiceVadWorklet.ts:17,23`; `index.ts:5439`; `voiceSocket.ts:6`; `voice.types.ts:112-138`; `magic-worlds-api/.../voice_orchestration/config.py:31,42-43` | local repositories | Read 2026-10-20 |
| Cost computation script | `/tmp/claude-1000/-home-andres-WebstormProjects-magic-worlds/9c4c3da7-06b7-4cee-a58b-d2b1e4f9477c/scratchpad/g4/gemini_cost.py` | 2026-10-20 |
| Google: Gemini 3.8 Live model page (added in fact-check) | https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live | Footer 2026-10-19; fetched 2026-10-20 |
| Google: Gemini models overview (added in fact-check) | https://ai.google.dev/gemini-api/docs/models | Last updated 2026-10-19; fetched 2026-10-20 |
| Google: Live API capabilities (99 languages, VAD default; added in fact-check) | https://ai.google.dev/gemini-api/docs/live-api/capabilities | Last updated 2026-09-18; fetched 2026-10-20 |
| Google: Live API overview ("70 supported languages"; added in fact-check) | https://ai.google.dev/gemini-api/docs/live-api | Last updated 2026-10-06; fetched 2026-10-20 |
| Google: context caching (implicit minimums; added in fact-check) | https://ai.google.dev/gemini-api/docs/caching | Last updated 2026-10-13; fetched 2026-10-20 |
| Google: thinking levels (added in fact-check) | https://ai.google.dev/gemini-api/docs/thinking | Last updated 2026-10-14; fetched 2026-10-20 |
| OpenAI: API pricing (added in fact-check) | https://developers.openai.com/api/docs/pricing | Fetched 2026-10-20 |
| OpenAI: prompt caching (added in fact-check) | https://developers.openai.com/api/docs/guides/prompt-caching | Fetched 2026-10-20 |
| Anthropic: prompt caching (added in fact-check) | https://platform.claude.com/docs/en/build-with-claude/prompt-caching | Fetched 2026-10-20 |
| Groq: prompt caching, models, speech-to-text (added in fact-check) | https://console.groq.com/docs/prompt-caching ; https://console.groq.com/docs/models ; https://console.groq.com/docs/speech-to-text | Fetched 2026-10-20 |
| Cerebras: models overview and prompt caching (added in fact-check) | https://inference-docs.cerebras.ai/models/overview ; https://inference-docs.cerebras.ai/capabilities/prompt-caching | Fetched 2026-10-20 |
| xAI: models and voice pricing (added in fact-check) | https://docs.x.ai/docs/models | Fetched 2026-10-20 |
| ElevenLabs: models (added in fact-check) | https://elevenlabs.io/docs/overview/models | Fetched 2026-10-20 |
| Pipecat: smart-turn repo (added in fact-check) | https://github.com/pipecat-ai/smart-turn | Fetched 2026-10-20 |
| LiveKit: turn-detector model card (added in fact-check) | https://huggingface.co/livekit/turn-detector | Fetched 2026-10-20 |
| AWS: Nova 2 Sonic guide and Nova pricing (added in fact-check) | https://docs.aws.amazon.com/nova/latest/nova2-userguide/using-conversational-speech.html ; https://aws.amazon.com/nova/pricing/ | Fetched 2026-10-20 |

---

## Fact-check log (2026-10-20)

Method: every claim below was re-fetched from its primary page with WebFetch on 2026-10-20. WebSearch was unavailable (the session's search budget was exhausted), so newer developments were found only by reading current primary catalog and pricing pages, not by open search. The Gemini cost table was re-derived by re-running `gemini_cost.py`; every figure in §1.4 reproduced exactly. Codebase facts were re-checked with `grep` in both repositories.

| # | Claim | Verdict | Source |
|---|---|---|---|
| 1 | Gemini Live bills every turn for all tokens in the session context window; accumulated audio at the audio-input rate; transcription at the text-output rate; best-practices page last updated 2026-09-15 | Confirmed | https://ai.google.dev/gemini-api/docs/live-api/best-practices |
| 2 | Native audio accumulates at about 25 tokens/s | Confirmed (Context management section; matches pricing-page conversions) | https://ai.google.dev/gemini-api/docs/live-api/best-practices |
| 3 | Proactive audio is permanently on for `gemini-3.8-live` / `-extended-thinking` and unsupported on `gemini-3.1-flash-live-preview` | Confirmed; the model page adds that `proactive_audio: false` errors | https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live |
| 4 | Live pricing row: text in $0.75, audio in $3.00/1M ($0.005/min), audio out $12.00/1M ($0.018/min), text out $4.50; no caching row; page dated 2026-10-19 | Confirmed | https://ai.google.dev/gemini-api/docs/pricing |
| 5 | 15-min audio-only / 2-min audio+video session limit without compression; ~10-min connection with `GoAway`; 2-hour resumption tokens; no numeric compression defaults | Confirmed | https://ai.google.dev/gemini-api/docs/live-session |
| 6 | Tier-1 spend-based limit of $10 per rolling 10 minutes | Confirmed (page dated 2026-10-15); added Tier 2/3 values, the "depends on billing history" qualifier and the $250 Tier-1 billing cap | https://ai.google.dev/gemini-api/docs/rate-limits |
| 7 | A4: `gemini-3.8-live` is the non-reasoning default | Corrected to a caveat: the model page says thinking is supported with interleaved reasoning and `thinking_level` is not accepted, so the default may emit thinking tokens | https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live |
| 8 | Gemini 3.8 Live supports "97+ languages" | Corrected: capabilities page says 99; Live overview says 70; the model page gives no count | https://ai.google.dev/gemini-api/docs/live-api/capabilities ; https://ai.google.dev/gemini-api/docs/live-api |
| 9 | §1.6 open question: implicit caching discount for Live | Closed: the 3.8 Live model page lists caching as not supported | https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live |
| 10 | LiveKit `EndpointingOptions` defaults 0.5 / 3.0 s; unset values become 0.3 / 2.5 s with the audio turn detector; `TurnDetector()` is the default; EMA 0.9; interruption and preemptive-generation defaults | Confirmed | https://docs.livekit.io/reference/agents/turn-handling-options/ |
| 11 | Audio detector v1 (Inference) / v1-mini (local CPU), 14 languages incl. Spanish, VAD `min_silence_duration ≥ 0.25 s`, ~1 s commit timeout, text `MultilingualModel` deprecated for 2.0 | Confirmed; added v1-on-Cloud / v1-mini-self-hosted default and v1→v1-mini timeout fallback (fills the "page does not say" gap) | https://docs.livekit.io/agents/logic/turns/turn-detector/ ; https://docs.livekit.io/agents/logic/turns/ |
| 12 | Tuning page shows only 0.5 / 3.0 s with no audio-detector note | Confirmed | https://docs.livekit.io/agents/logic/turns/tuning/ |
| 13 | aiewf Groq gpt-oss-120b archived row: 98 / 217 / 2,117 ms, 86.3% pass, removed at the maintainer's request, effort not stated | Confirmed | https://github.com/kwindla/aiewf-eval/blob/main/docs/groq-gpt-oss-120b-archived-2026-10-17.md |
| 14 | aiewf rows: Haiku 5.5 thinking-off 556/819 ms; gpt-6-luna (none) 0/30 unranked; luna (low) 917/1,439; gpt-5.5 (none) 780/1,173; Qwen 3.8 27B Baseten 649/801 and local NVFP4 101/318; Gemma 4 31B 497/629, max 33.3 s; 3.5 Flash-Lite (minimal) 617/1,145; 3.8 Flash (low) 1,411/1,967; Lightning thinking-off 69.6% | Confirmed; added that the Lightning row is partial (16/30) | https://github.com/kwindla/aiewf-eval |
| 15 | AA Groq gpt-oss-120b (High): first chunk 0.68 s, reasoning 4.22 s, TTFAT 4.91 s, ~474 tok/s; Cerebras 0.34 s / 1.15 s / 1.49 s, ~1,734 tok/s | Confirmed | https://artificialanalysis.ai/models/gpt-oss-120b/providers |
| 16 | AA methodology v2.2.0 (2026-03-02): 10k unique prompts, us-central1-a VM, P50 over 72 h, TTFAT after thinking | Confirmed | https://artificialanalysis.ai/methodology/performance-benchmarking |
| 17 | AA leaderboard: Gemini 3.5 Flash-Lite 7.53 s, Haiku 5.5 (low) 8.39 s, GPT-6 Luna (max) 89.84 s, Luna non-reasoning 0.83 s, Qwen 3.8 27B non-reasoning 4.06 s @ 48 tok/s, Gemma 4 31B non-reasoning 1.87 s; Haiku 5.5 providers page only has the max variant (~245 s) | Confirmed | https://artificialanalysis.ai/leaderboards/models ; https://artificialanalysis.ai/models/claude-haiku-5-5/providers ; https://artificialanalysis.ai/models/gpt-6-luna/providers |
| 18 | Groq: gpt-oss reasoning only `low/medium/high`; Qwen 3.8 27B accepts `none`; Qwen 3.8 27B is preview at ~450 tok/s | Confirmed | https://console.groq.com/docs/reasoning ; https://console.groq.com/docs/models |
| 19 | §3.4 Qwen 3.8 27B row assumes a warm prompt cache on every host, Groq included | Corrected: Groq caching covers gpt-oss models only; Qwen 3.8 27B is not cached on Groq | https://console.groq.com/docs/prompt-caching |
| 20 | Cache minimums: Anthropic 512 (Haiku 5.5), OpenAI 1,024 (GPT-5.6+), Gemini 4,096 implicit, Cerebras 128-token blocks with no discount | Confirmed; Gemini 3.5 Flash-Lite is absent from the caching table (unverified for that model) | https://platform.claude.com/docs/en/build-with-claude/prompt-caching ; https://developers.openai.com/api/docs/guides/prompt-caching ; https://ai.google.dev/gemini-api/docs/caching ; https://inference-docs.cerebras.ai/capabilities/prompt-caching |
| 21 | Gemini 3.8 Flash's lowest thinking level is `low`; 3.5 Flash-Lite lowest is `minimal` and cannot be fully off | Confirmed | https://ai.google.dev/gemini-api/docs/thinking |
| 22 | OpenRouter: no added-latency number; cold edge caches 1–2 min; low-balance latency; ~10-min sticky `session_id` pin disabled by `provider.order`; `preferred_max_latency` soft | Confirmed; added the Auto Exacto override and the 5-minute evaluation window | https://openrouter.ai/docs/features/latency-and-performance |
| 23 | Grok Voice 3.0 flat $0.08/min | Confirmed (`grok-voice-3.0`, $4.80/h; 2.0 deprecated) | https://docs.x.ai/docs/models |
| 24 | GPT-Live-1 + cheap backend ≈ $0.051/min; gpt-realtime-2.1-mini cached audio input | Confirmed list prices: `gpt-live-1` $0.05/min billed per second plus backend; gpt-realtime-2.1-mini $10/$20 per 1M audio, cached $0.30 (the per-minute derivations in r10 were not re-run) | https://developers.openai.com/api/docs/pricing |
| 25 | Cascade A uses "ElevenLabs v4 Turbo" | Confirmed the model exists (`eleven_v4_turbo`, ~100 ms) | https://elevenlabs.io/docs/overview/models |
| 26 | Smart Turn documented input window is 8 s (run on the last ≤ 8 s) | Confirmed; latest is v3.2 | https://github.com/pipecat-ai/smart-turn |
| 27 | Daily PhoneLLM <100 ms P95 on a B200 | Unverified (no primary source fetched; not in aiewf) | — |
| 28 | Codebase: 550 ms at `CallScreen.tsx:114`; `DEFAULT_MAX_SEGMENT_MS = 7_500` and `SEGMENT_LIMIT_MARGIN_MS = 500` at `useVoiceCallController.ts:129,131`, reconfigure at `:546-547`; worklet fallback 800/450 at `voiceVadProcessor.worklet.js:225`; stale 8 s / ~800 ms comments at `voiceVadWorklet.ts:17,23`; server `config.py:42-43` 30,000 ms / 2,000,000 bytes; `config.py:31` 600 s call cap; POST `/character-chats/{id}/voice-segments` at `index.ts:5439` | Confirmed (paths: `src/features/interaction/hooks/useVoiceCallController.ts`, `src/features/interaction/audio/`) | local repositories, grep 2026-10-20 |
