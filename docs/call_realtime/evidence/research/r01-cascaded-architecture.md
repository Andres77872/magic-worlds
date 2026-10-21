# R01 — Cascaded (STT -> LLM -> TTS) realtime voice agents: architecture, frameworks, latency budgets

- **Date of research:** 2026-10-20
- **Scope:** Reference architectures and end-to-end ("mouth-to-ear" / voice-to-voice) latency budgets for cascaded voice agents; fully streaming pipelines; speculative/preemptive generation; prewarming; co-location; async tools; interruption handling; observability. Frameworks and platforms: Pipecat (+ Pipecat Cloud, SmallWebRTC), LiveKit Agents 1.x, TEN, Vocode, Vapi, Retell, Bland, Synthflow, ElevenLabs Agents, Deepgram Voice Agent API, Twilio ConversationRelay, Cloudflare Agents voice, OpenAI Agents SDK VoicePipeline, Ultravox.
- **Method:** ~25 web searches, then direct reads of primary sources (official docs via their `llms.txt` / `.md` endpoints, GitHub release notes via the GitHub API, arXiv abstracts/HTML, the raw `aiewf-eval` README). The shared web-search budget for this workflow ran out partway through; the rest of the evidence comes from **direct fetches of primary documentation** (not from new searches). A few items (Bland, Synthflow internals) are therefore thinner than the others.
- **Labels used below:** **[vendor]** = number reported by the vendor about its own product; **[indep]** = independent or third-party benchmark; **[est]** = my own engineering estimate; **[stale?]** = source older than ~12 months.

---

## 1. Executive summary

1. **Best-in-class cascaded agents in 2026 reach about 0.5–1.0 s voice-to-voice (V2V) at p50.** Measured examples: Salesforce AI Research's tutorial pipeline (Deepgram -> vLLM -> ElevenLabs) measured **755 ms time-to-first-audio** ([arXiv 2603.05413v2](https://arxiv.org/abs/2603.05413v2), 2026-03-17) [indep]. Pipecat's own example latency breakdown totals **1.044 s** ([Pipecat v1.9.0 release notes](https://github.com/pipecat-ai/pipecat/releases), 2026-09-11) [vendor]. Daily reports demos at **~500 ms** when all models are hosted in one GPU cluster and tuned for latency over throughput ([voiceaiandvoiceagents.com](https://voiceaiandvoiceagents.com/), June 2026) [vendor]. Retell claims **~600 ms**, measured at its own server, so the caller's network leg is excluded ([Retell docs](https://docs.retellai.com/reliability/check-estimated-latency.md)) [vendor]. Bland claims **sub-400 ms** by owning the whole stack ([Bland docs index](https://docs.bland.ai/llms.txt)) [vendor, unverified].
2. **The practical industry target is still "under ~1.5 s, ideally ~800 ms".** Daily's guide treats 1,500 ms V2V as the bar not to cross and 500 ms as the human norm. Retell advises keeping estimated latency under 1.5 s. Its documentation shows an example call with an 800 ms median but a 2,500 ms p99. **Tail latency (p95/p99) is where cascaded agents fail.**
3. **The single biggest lever is the arrangement of the stages, not any one fast component.** Run the stages one after another and even fast parts add up to about 1.2 s. Overlap them (stream STT, prime the LLM early, stream TTS on the first clause) and the total falls well below that ([Soniox wiki](https://soniox.com/wiki/voice-agent-latency-budget), 2026-07-02).
4. **Endpointing (deciding that the user finished) is the largest and least visible cost**, typically 200–600 ms. Most dashboards leave it out: Vapi's displayed total excludes endpointing and transport ([Vapi docs](https://docs.vapi.ai/assistants/model-intelligence/understanding-latency)). In one LiveKit community trace, end-of-turn delay alone was about 0.59 s of a 1.83 s turn.
5. **SOTA turn-taking is layered:** a short VAD trigger (~200 ms), then a small native-audio turn model (Pipecat Smart Turn v3.2: ~8M params, 23 languages including Spanish, 10–100 ms on CPU; LiveKit audio TurnDetector: 14 languages), then an optional single-token tag from the LLM that says whether the turn is complete (✓ / ○ / ◐). STT-native turn models (Deepgram Flux, including Flux Multilingual with Spanish; Cartesia Ink-2 turns) are the alternative.
6. **Speculative ("preemptive" / "eager") generation is now mainstream.** LiveKit enables preemptive LLM generation by default (TTS optional). Deepgram Flux `EagerEndOfTurn` trims "the last 100–200 ms" per Deepgram's own guide (Telnyx reports ~150 ms median and ~350 ms in the top 5%) at the cost of 50–70% more LLM calls. Pipecat 1.9 holds a speculative response until the turn is confirmed. ElevenLabs offers a `speculative_turn` flag (default off). Research systems go further: PredGen roughly halves latency (simulated), and RelayS2S reaches 81 ms P90 to the first chunk on *synthetic* dialogues (655 ms vs 823 ms cascaded P90 on real voice dialogues; excludes turn detection, TTS and network).
7. **LLM time to first answer token (TTFAT) dominates the compute budget.** In the independent aiewf-eval 30-turn benchmark (retrieved 2026-10-20), frontier and mid-size cloud models show **p50 ~500–1,000 ms and p95 ~800–2,200 ms**. Self-hosted NVFP4 models on local GPUs reach 63–101 ms p50, with no network time. Reasoning models are only usable if the first *non-thinking* token arrives in under ~700 ms.
8. **Text aggregation before TTS matters more than people expect.** ElevenLabs Agents starts TTS after "enough words and a comma" rather than a full sentence. ElevenLabs' TTS WebSocket (`stream-input`) withholds the first audio until about **120 characters** are buffered (default `chunk_length_schedule` = [120,160,250,290]) unless you flush or use `auto_mode`. The separate **Text-to-Dialogue WebSocket** (Eleven v3 / v4 models) instead uses a fixed server threshold of about **40 characters and 8 words** before first audio; `flush: true` forces generation there too. Which threshold applies to Magic Worlds depends on which endpoint the orchestrator uses (fact-check addition).
9. **Browser transport:** Pipecat, Daily and the Pipecat transport guide all say not to use WebSockets for client↔server realtime media in production. They recommend WebRTC (Opus, FEC, jitter buffer, AEC, timestamps). WebSockets remain fine for server↔server links and for prototypes.
10. **Interruption handling requires every stage to be cancellable**, client audio to be flushed immediately, and only the text actually heard to be committed to context (word- or character-level alignment; Twilio returns `utteranceUntilInterrupt` + `durationUntilInterruptMs`). Modern stacks add a backchannel-vs-barge-in classifier (LiveKit "adaptive", Krisp VIVA) and resume after a false interruption (LiveKit default 2.0 s).
11. **Async tools and the fast-brain/slow-brain pattern** keep the voice loop from blocking. Examples: LiveKit async tools with `ctx.update()`, LiveKit subagent delegation, Retell's advice to give tools a `message` parameter, and soft-timeout fillers (ElevenLabs recommends 3.0 s).
12. **For Magic Worlds**, the current design stacks several serial waits: a fixed 550 ms browser silence timeout, segment upload, batch whisper-large-v3, an LLM agent-graph hop, a wait for the full first sentence, then TTS and MP3/MSE buffering. **My rough estimate is a 1.9–3.3 s p50 today [est]; the audit's measurements should confirm it.** About 1 s can be recovered without changing vendors. The main changes: clause-level first TTS chunk, a turn model with a shorter VAD trigger, speculative LLM start, prompt-prefix caching, parallel moderation, and co-location (see §9).

---

## 2. Definitions and how to measure

| Term | Definition | Notes |
|---|---|---|
| **V2V / mouth-to-ear** | From the moment the user's speech actually ends to the moment the first agent audio reaches the user's ear | The only number users feel. It includes mic capture, encoding, network both ways, jitter buffers, endpointing, STT, LLM, aggregation, TTS and playout. |
| **TTFA** | Time to first audio byte, from user stop to first synthesized byte | Often measured server-side, so it **excludes** client network and playout (Retell measures this way). |
| **TTFT / TTFAT** | LLM time to first token / first *user-visible answer* token | aiewf-eval uses TTFAT so that reasoning tokens don't hide latency ([aiewf README](https://github.com/kwindla/aiewf-eval)). |
| **TTFS** | Time To Final Segment: user stops -> STT final transcript | Pipecat ships measured P99 TTFS defaults per STT provider and warns that 0.35 s vs 0.55 s is noticeable ([Pipecat STT latency tuning](https://docs.pipecat.ai/pipecat/fundamentals/stt-latency-tuning.md)). |
| **EOU delay** | VAD end of speech -> turn declared complete | LiveKit's `end_of_utterance_delay` includes `transcription_delay` ([LiveKit observability data](https://docs.livekit.io/agents/observability/data)). |

**Measurement practice (consensus across sources):**
- Anchor on **user-speech-stop**, adjusted for VAD `stop_secs`. Pipecat's `UserBotLatencyObserver` does exactly this and emits `on_latency_breakdown` with named **contributions** that sum to the total: endpointing wait, transcription, LLM, turn completion, sentence aggregation, TTS, and function calls ([Pipecat observer docs](https://docs.pipecat.ai/api-reference/server/utilities/observers/user-bot-latency-observer.md); v1.9.0, 2026-09-11).
- Report **p50, p90/p95 and p99 per call and per turn**. Retell exposes P50/P90/P95/P99 per call ([Retell check actual latency](https://docs.retellai.com/reliability/check-actual-latency.md)).
- OpenAI's voice-agent guide adds two points. Measure the wait for a **useful** spoken answer, not just the first sound. Measure acknowledgements ("I'm checking…") separately from the real answer ([OpenAI voice agents guide](https://developers.openai.com/api/docs/guides/voice-agents.md), retrieved 2026-10-20).
- Measure from a real client, ideally by analysing a recording of the conversation's waveform. The Modal team used Pyannote diarization on recordings to get true V2V ([Modal blog](https://modal.com/blog/low-latency-voice-bot), 2025-11-04).

---

## 3. The latency budget

### 3.1 Published breakdowns

**A. Daily / Pipecat "voice AI guide" reference round trip (macOS client, WebRTC)** — [voiceaiandvoiceagents.com](https://voiceaiandvoiceagents.com/), updated June 2026 [vendor, illustrative]

| Stage | ms |
|---|---|
| Mic input | 40 |
| Opus encode | 21 |
| Network + packet handling | 12 |
| Jitter buffer | 40 |
| Opus decode | 1 |
| **Transcription + endpointing** | **300** |
| **LLM TTFB** | **650** |
| Sentence aggregation | 20 |
| **TTS TTFB** | **120** |
| Return path (encode, network, jitter, decode, speaker) | 89 |
| **Total** | **1,293** |

About 200 ms of the total is the media path, which no model choice can remove. Same guide: Pipecat agents have hit **~500 ms** when every model runs in one GPU cluster tuned for latency.

**B. Pipecat `LatencyBreakdown.contributions` example** — [Pipecat v1.9.0 notes](https://github.com/pipecat-ai/pipecat/releases), 2026-09-11 [vendor]

| Contribution | s |
|---|---|
| Endpointing wait (VAD `stop_secs`) | 0.200 |
| Transcription (Deepgram) | 0.125 |
| LLM inference (OpenAI) | 0.336 |
| Turn completion (`filter_incomplete_user_turns`) | 0.024 |
| Speech synthesis (Cartesia) | 0.359 |
| **Total** | **1.044** |

**C. Salesforce AI Research tutorial, measured** — [arXiv 2603.05413v2](https://arxiv.org/html/2603.05413v2), 2026-03-17 [indep/academic]

| Stage (P50) | Self-hosted Qwen2.5-7B / vLLM on H200 | Cloud GPT-4.1-mini |
|---|---|---|
| Deepgram STT final | 337 ms | 402 ms |
| LLM TTFT | 337 ms (cold-start max 4,327 ms) | 457 ms |
| ElevenLabs TTS TTFB | 219 ms | 221 ms |
| Sequential estimate | 947 ms | 958 ms |
| **Measured streaming TTFA** | **755 ms** (LLM 296 + sentence detection 143 + TTS 316) | — |

Takeaways: overlapping the stages beat the serial estimate by ~200 ms. A **cold start inflated TTFT ~13x**, so warm-up matters. Sentence detection alone cost 143 ms.

**D. LiveKit community trace (production user, untuned)** — [LiveKit community](https://community.livekit.io/t/eot-value-leads-to-around-30-of-e2e-latency-tried-reducing-min-max-endpointint-in-turn-delay-plugin-but-no-luck/1450) [indep, anecdotal]
- EOU delay 0.59 s, transcription delay 0.53 s, LLM TTFT 0.85 s, TTS TTFB 0.38 s, for an e2e of about **1.83 s**. Endpointing was roughly 30% of the total.

**E. Illustrative serial budget** — [Soniox](https://soniox.com/wiki/voice-agent-latency-budget), 2026-07-02 [vendor]
- Endpoint detection 200–400, STT finalization 50–150, model first token 300–500, TTS first audio 100–200, network 100–200. Run serially, that is about **1,180 ms**. Soniox says to overlap the stages instead.

**F. Vendor platform claims (treat with caution)**
- Retell: "as low as 600 ms", user stop -> agent starts responding, measured at Retell's server ([docs](https://docs.retellai.com/reliability/check-estimated-latency.md)). Its marketing page cites 620 ms average, 180 ms TTFT and 140 ms barge-in ([Retell latency face-off 2025](https://www.retellai.com/resources/ai-voice-agent-latency-face-off-2025)) [vendor, stale?].
- Bland: sub-400 ms from a fully owned stack (telephony, STT, LLM, TTS) ([Bland docs](https://docs.bland.ai/llms.txt)) [vendor, no methodology].
- Modal + Pipecat + open-weights (Parakeet-TDT-0.6B-v3, Qwen3-4B, Kokoro-82M): **~1 s median** V2V when client and GPUs share a region ([Modal](https://modal.com/blog/low-latency-voice-bot), 2025-11-04) [vendor/indep].
- NVIDIA's Pipecat blueprint uses a looser 500–1,500 ms conversational target ([NVIDIA build](https://build.nvidia.com/pipecat/voice-agent-framework-for-conversational-ai/blueprintcard)).

### 3.2 A realistic "best-in-class cascaded" p50 budget (synthesis) [est, built from the sources above]

| Stage | Aggressive | Typical good | What it takes |
|---|---|---|---|
| Client capture + encode + uplink + jitter | 60 | 100 | WebRTC/Opus, nearby edge |
| Endpointing (VAD + turn model) | 150 | 250 | 200 ms VAD trigger + audio turn model; speculation hides part of this |
| STT finalization after end of speech | 50 | 150 | Streaming STT with partials, or a prewarmed fast batch STT on a short segment |
| LLM TTFAT | 150 | 400 | Small/fast non-reasoning model, cached prefix, co-located, warm connection |
| First-clause aggregation | 20 | 80 | Flush at the first comma or clause after N words, not at the full sentence |
| TTS TTFB | 75 | 150 | Flash/turbo-class streaming TTS over a persistent WebSocket |
| Downlink + jitter + playout | 50 | 100 | Small jitter buffer; PCM/Opus rather than a container that needs buffering |
| **Total V2V** | **~555** | **~1,230** (≈ **800–900** when speculation overlaps endpointing with the LLM) | |

---

## 4. Reference architecture and design principles

```
 Browser/phone ──WebRTC(Opus, AEC/NS/AGC)──► Edge/SFU ──► Agent worker (one process per call)
                                                         │
     ┌───────────────────────────────────────────────────┴──────────────────────────────────┐
     │ VAD(200ms trigger) ─► Turn model (audio, CPU) ─► [LLM ✓/○/◐ tag]                     │
     │ Streaming STT (partials, finals, eager-EOT) ──────────────► Context aggregator        │
     │                         ▲ speculative LLM on eager EOT (held until confirmed)        │
     │ LLM stream ─► text aggregator (first clause, then sentences) ─► streaming TTS (WS)   │
     │ TTS audio + word/char timestamps ─► output transport ─► "heard text" ledger          │
     │ Interruption: SystemFrame broadcast → cancel LLM/TTS/tools, flush client audio,      │
     │               commit only heard text; resume on false interruption                   │
     │ Observers: per-turn latency contributions, TTFB per service, p50/p95                  │
     └──────────────────────────────────────────────────────────────────────────────────────┘
   All services (STT, LLM, TTS) pinned to the same cloud region as the agent worker; persistent connections.
```

### 4.1 Fully streaming, overlapped pipeline
- **Frame-based pipelines** (Pipecat): frames move downstream (and sometimes upstream) through processors. Stages run concurrently, so early audio plays while later text is still being generated ([Pipecat overview](https://docs.pipecat.ai/pipecat/learn/overview)). **System frames** (such as `InterruptionFrame`) bypass the queues and are handled immediately ([Pipecat interruptions](https://docs.pipecat.ai/pipecat/fundamentals/interruptions.md)).
- **Node-based sessions** (LiveKit): `stt_node`, `llm_node`, `tts_node`, `transcription_node`, plus hooks such as `on_user_turn_completed`, which is the place for RAG injection or a fast filler ([LiveKit nodes](https://docs.livekit.io/agents/logic/nodes.md)).
- **Graph-of-extensions** (TEN): a C++ runtime with multi-language extensions (Python, Go, Node, C++), usually over Agora RTC, with its own TEN VAD and TEN Turn Detection ([TEN GitHub](https://github.com/TEN-framework/ten-framework); release 0.11.73, 2026-09-22).
- Common anti-pattern ([futureagi Pipecat latency guide](https://futureagi.com/blog/how-to-optimize-pipecat-latency-2026/), 2026, vendor): a custom processor that buffers frames, a non-streaming HTTP TTS, or a context aggregator that waits for the full LLM response. Any of these quietly turns the pipeline back into a serial one.

### 4.2 Turn detection (endpointing) — the biggest invisible cost
- **Layered SOTA** ([Daily guide](https://voiceaiandvoiceagents.com/), June 2026):
  1. VAD with a short ~200 ms trigger.
  2. A small native-audio turn model on CPU that hears intonation and filler sounds the transcript loses.
  3. An LLM prompt mixin in which the model emits a **single classifier token** first: ✓ = respond now; ○ = short incomplete, wait ~5 s; ◐ = long incomplete, wait ~10 s. The token is stripped before TTS. Pipecat ships this as `FilterIncompleteUserTurnStrategies` (v1.2.0, 2026-05-14; fixes in 1.7.0 and 1.8.0).
- **Pipecat Smart Turn v3.2**: Whisper-Tiny backbone with a linear head, about 8M parameters, 8 MB int8 for CPU or 32 MB fp32 for GPU. It supports **23 languages including Spanish** and runs in 10 ms on some CPUs and under 100 ms on most cloud instances (~65 ms on a Pipecat Cloud 1x instance). Recommended VAD `stop_secs` is 0.2. v3.2 (2026-01-07; still the current release as of 2026-10-20) misclassifies short utterances about 40% less often and is more robust to background noise ([Daily blog](https://www.daily.co/blog/smart-turn-v3-2-handling-noisy-environments-and-short-responses/); [smart-turn README](https://github.com/pipecat-ai/smart-turn); [Pipecat Smart Turn docs](https://docs.pipecat.ai/api-reference/server/utilities/turn-detection/smart-turn-overview.md)) [vendor]. Open weights on Hugging Face.
- **LiveKit TurnDetector** (audio-based, the default): combines words with intonation and rhythm. It supports 14 languages (including Spanish) with per-language thresholds and has `v1` (served on LiveKit Inference; free on LiveKit Cloud, billed beyond a monthly allowance when self-hosted) and `v1-mini` (local CPU, free) variants. It requires VAD `min_silence_duration` ≥ 0.25 s, so it cannot be paired with a sub-250 ms VAD trigger ([LiveKit turn detector](https://docs.livekit.io/agents/logic/turns/turn-detector.md)). The older text-only detector is deprecated and will be removed in Agents 2.0 ([LiveKit blog](https://livekit.com/blog/turn-detection-and-interruption-handling), 2026-06-30).
- **STT-native turn detection**: Deepgram Flux (about 260 ms end-of-turn per its quickstart [vendor]; **Flux Multilingual** `flux-general-multi` covers 10 languages (en, es, fr, de, hi, ru, pt, ja, it, nl) with optional `language_hint` biasing and auto-detection; EU endpoint available; $0.0078/min PAYG ([Flux Multilingual docs](https://developers.deepgram.com/docs/flux/language-prompting.md); [Deepgram pricing](https://deepgram.com/pricing)). The GA date "mid-April 2026" is **(unverified)**: the previously cited changelog URL (2026/4/15) is actually the Deepgram CLI launch announcement. Others: Cartesia Ink-2 "turns" WebSocket (eager-end thresholds 0.3–0.8, default 0.6), AssemblyAI Universal-Streaming, Gradium STT, Krisp VIVA turn, p99lab turn-1-mini ([Pipecat docs index](https://docs.pipecat.ai/llms.txt); Pipecat v1.13.0 notes, 2026-10-19).
- **Recommended starting values**: LiveKit uses `min_delay` 0.5 s and `max_delay` 3.0 s with the turn model, and offers a `dynamic` mode that adapts to each user's pause statistics ([LiveKit turn tuning](https://docs.livekit.io/agents/logic/turns/tuning/)). Vapi's English quick start is a smart-endpointing sigmoid wait function plus **`waitSeconds: 0.4`**; that 400 ms pause is added before *every* reply. For non-English, Vapi falls back to punctuation heuristics: 0.1 s after punctuation, 1.5 s without, 0.5 s after numbers ([Vapi pipeline config](https://docs.vapi.ai/customization/voice-pipeline-configuration.md)). Ultravox's default `turnEndpointDelay` is 0.384 s (12 × 32 ms frames) ([Ultravox VAD](https://docs.ultravox.ai/noise/understanding-vad.md)).
- ElevenLabs Agents exposes **turn eagerness** (patient/normal/eager). It recommends **patient** for emotionally sensitive conversations, which is relevant to companion roleplay ([ElevenLabs conversation flow](https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow.md); [expressive mode](https://elevenlabs.io/docs/eleven-agents/customization/voice/expressive-mode)).

### 4.3 STT: streaming partials vs. segmented batch
- **Streaming STT** with partials lets turn detection and speculative LLM start before the final transcript. The cost is a session that is open (and often billed) for the whole call. Deepgram's Voice Agent API bills by connection time ([pricingsaas](https://pricingsaas.com/companies/deepgram/diffs/2026W14), 2026-03).
- **Segmented batch STT is a legitimate low-latency choice** if the segment is short and the connection is warm:
  - Modal found that local VAD + Smart Turn segmentation plus Parakeet on final segments was **faster than the open-weights streaming STT implementations it tried** (it did not compare against commercial streaming APIs) ([Modal](https://modal.com/blog/low-latency-voice-bot)).
  - Pipecat 1.9 added `AssemblyAISyncSTTService`: VAD-segmented, one HTTP request per segment, with the **connection prewarmed when the user starts speaking** and recent turns sent as `conversation_context` (2026-09-11).
- **Groq Whisper** (the current Magic Worlds STT) [vendor; [Groq STT docs](https://console.groq.com/docs/speech-to-text.md), retrieved 2026-10-20]:

  | Model | $/hour | Real-time speed factor | WER |
  |---|---|---|---|
  | `whisper-large-v3` | $0.111 | 189× | 10.3% |
  | `whisper-large-v3-turbo` | $0.04 | 216× | 12% |

  Other details: **minimum billed length 10 s per request**, so short utterances cost as if they were 10 s. Groq recommends WAV for lowest latency and says passing `language` improves both accuracy and latency. The `prompt` parameter (max 224 tokens) can carry character names and context.
- 2026 streaming options seen in framework docs: Deepgram Flux / Nova-3, Cartesia Ink-2, AssemblyAI Universal-Streaming, ElevenLabs Scribe v2 Realtime (~150 ms vendor-stated latency, 90+ languages; it drives ElevenLabs' own turn-taking), Soniox `stt-rt-v5` (unverified), OpenAI `gpt-realtime-whisper` (has a `delay` setting from minimal to xhigh trading latency for accuracy; Pipecat v1.11), Speechmatics Agent STT, Gradium.
  - **Correction (fact-check):** OpenAI's transcription guide now recommends **`gpt-live-transcribe`** for live audio and **`gpt-transcribe`** for files and *committed-turn transcription over WebSocket*; `gpt-realtime-whisper` is described as available to existing integrations but "isn't the recommended starting model". `whisper-1`, `gpt-4o-transcribe` and `gpt-4o-mini-transcribe` are deprecated, with shutdown on 2027-02-26 ([OpenAI transcription guide](https://developers.openai.com/api/docs/guides/transcription.md); [OpenAI deprecations](https://developers.openai.com/api/docs/deprecations.md)). Detailed STT comparison belongs to the STT research note; this note only covers the architectural choice.

### 4.4 LLM: the dominant compute term
**Independent TTFAT data — aiewf-eval `aiwf_medium_context`** (30-turn conversation with tools and a KB in the system prompt; README retrieved 2026-10-20, latest cohorts dated 2026-10-17/19; [repo](https://github.com/kwindla/aiewf-eval)) [indep, maintained by Pipecat's founder]. Latency is service time to the first user-visible answer token. Local GPU rows exclude network.

| Model (setting) | Pass rate | TTFAT p50 | TTFAT p95 | Provider |
|---|---|---|---|---|
| claude-haiku-5-5 (thinking off, low) | 94.7% | 556 ms | 819 ms | Anthropic |
| gemini-3.5-flash-lite (minimal) | 94.3% | 617 ms | 1,145 ms | AI Studio |
| gpt-4.1 (**deprecated 2026-10-14, shutdown 2027-01-14**) | 95.9% | 743 ms | 1,086 ms | OpenAI |
| gpt-5.5 (none) | 98.2% | 780 ms | 1,173 ms | OpenAI |
| gpt-5.6-sol (none) *(added)* | 96.9% | 765 ms | 1,298 ms | OpenAI |
| gpt-5.6-terra (none) *(added)* | 92.7% | 826 ms | 1,257 ms | OpenAI |
| claude-haiku-5-5 (low) *(added)* | 97.2% | 651 ms | 1,563 ms | Anthropic |
| gemini-3.8-flash (low) *(added; newer but slower than 3.7)* | 99.9% | 1,411 ms | 1,967 ms | AI Studio |
| gemini-3.7-flash (low) | 99.9% | 821 ms | 1,656 ms | AI Studio |
| claude-sonnet-5-5 (low) | 99.9% | 838 ms | 2,140 ms | Anthropic |
| deepseek-v4-flash-0731 (low) | 97.3% | 689 ms | 1,648 ms | Baseten |
| gemma-4-31b-it (thinking off) | 96.4% | 497 ms | 629 ms | Baseten |
| qwen3.8-27b (thinking off, FP8) | 96.0% | 649 ms | 801 ms | Baseten |
| qwen3.8-27b (thinking off, NVFP4) | 95.1% | **101 ms** | 318 ms | Local RTX 5090 |
| kimi-k2.6 (thinking off) | 88.7% | 481 ms | 850 ms | Baseten |
| gpt-oss-120b (Groq; archived row — removed from the live table at the maintainer's request; its exact cohort mapping is recorded as unresolved) | 86.3% | **98 ms** | 217 ms | Groq |
| muse-spark-1.3 (low) | 100% | 2,965 ms | 9,143 ms | OpenRouter/Meta — too slow |

Lessons:
1. The benchmark author uses **~700 ms TTFAT** as the voice-readiness line. Models that saturate the benchmark with reasoning are usually too slow for it ([Daily blog](https://www.daily.co/blog/benchmarking-llms-for-voice-agent-use-cases/), 2026-02-02).
2. **p95 varies a lot between providers**: some rows have p95/p50 ratios near 3. Choose by p95, not by p50.
3. **Specialized inference providers or self-hosting cut TTFT 5–8x** [est, derived]. Caveats: the Groq row is archived with an unresolved cohort mapping, and the local-GPU rows exclude network time, so the real-world gain is smaller. Note the benchmark is task/tool-oriented, not roleplay. Roleplay quality must be judged separately.
4. LiveKit now hosts **Gemma 4 31B** on LiveKit Inference as its recommended default voice LLM, with an EU endpoint ([LiveKit hosted LLM](https://docs.livekit.io/agents/models/llm/livekit.md)). Mid-size open-weight models are now considered good enough for voice.

**TTFT levers (documented):**
- **Prompt length:** each token adds TTFT on every turn. Retell sees noticeable slowdown above roughly **8k tokens** and suggests moving rarely needed detail into the KB or retrieval ([Retell troubleshoot latency](https://docs.retellai.com/reliability/troubleshoot-latency.md)).
- **Prompt/prefix caching:** reusing a cached prefix skips prefill. OpenAI caches above a minimum length (1,024 tokens for GPT-5.6 and later), and cache hits require an **identical prefix** ([OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching.md)). Correction: for GPT-5.6+ caching is no longer just "automatic and free". Cache **writes cost 1.25×** normal input for the default 30-minute lifetime (2.5× for a 12-hour lifetime), reads cost 0.1× (0.05× on GPT-6.1 Sol), and you can place explicit cache breakpoints (up to 4 writes per request) or let OpenAI place them implicitly. Daily calls context caching "the biggest lever" for long conversations. The implication: static persona and lorebook go first, volatile content goes last.
- **Fast tiers / priority:** Retell "fast tier", OpenAI Priority/Ultrafast service tiers ([OpenAI ultrafast](https://developers.openai.com/api/docs/guides/ultrafast-mode.md)). Ultrafast is currently limited to **`gpt-6-astra` and `gpt-6.1-sol`**, has separate rate limits, and OpenAI strongly recommends using it over the Responses WebSocket.
- **Persistent connections:** OpenAI's Responses API WebSocket mode reduces per-turn overhead, reported up to ~40% faster end-to-end on rollouts with 20+ tool calls [vendor] ([WebSocket mode](https://developers.openai.com/api/docs/guides/websocket-mode.md)). It also supports a **warm-up `response.create` with `generate: false`** that prepares request state (tools, instructions) so the next generated turn starts faster. This is a directly usable prewarm hook at `speech_start` (fact-check addition). Pipecat 1.0 made a WebSocket-based OpenAI Responses service its default (2026-04-14).
- **Provider-side preprocessing:** synchronous content filtering (Azure OpenAI's default, for example) adds to first-token time. Retell recommends async or off ([Retell custom-LLM best practices](https://docs.retellai.com/integrate-llm/llm-best-practice.md)). This matters for Magic Worlds' moderation design.
- **Rate limits/quotas** cause queuing that looks like a slow model (Retell).
- **Reasoning:** if used, measure the time to the first non-thinking token (Daily guide). Keep effort at none/minimal on the voice loop and move deep reasoning to a background subagent (§4.9).

### 4.5 Text aggregation into TTS (first-chunk policy)
- Retell starts speaking as soon as it has the **first complete sentence**. The relevant metric is TTFT plus the time to finish that sentence ([Retell best practices](https://docs.retellai.com/integrate-llm/llm-best-practice.md)).
- **ElevenLabs Agents goes further:** it starts after receiving **enough words and a comma**, not a full sentence ([ElevenLabs conversation flow](https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow.md)). At 50–100 output tokens/s, a 20–30-token sentence costs 200–600 ms beyond TTFT, while a 6–8-word clause costs 60–160 ms [est].
- **ElevenLabs TTS WebSocket input streaming** ([API ref](https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input.md); [latency guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization.md)):
  - The default `chunk_length_schedule` is [120,160,250,290] characters: no audio until 120 characters arrive, unless you send `flush: true` or enable `auto_mode`. The latency guide's example of a stall: a 125-character schedule that only receives 50 characters waits.
  - Default `model_id` is `eleven_multilingual_v2`, a slower model. Pick a fast model explicitly. **Correction:** `eleven_turbo_v2` and `eleven_turbo_v2_5` are now listed as **deprecated** (functionally equivalent to Flash but slower), so "Turbo-class" should read **Flash v2.5** (`eleven_flash_v2_5`, ~75 ms inference, 32 languages) on this endpoint ([ElevenLabs models](https://elevenlabs.io/docs/overview/models.md)).
  - **Newer model missed by the original notes:** **Eleven v4 Turbo** (`eleven_v4_turbo`) is ElevenLabs' current "state of the art model for real-time speech synthesis". It has ~100 ms median inference, 90+ languages and high-fidelity cloning, and it is the TTS behind ElevenAgents' Expressive mode. It is served **only on the Text-to-Dialogue WebSocket** (`/v1/text-to-dialogue/stream-input`), allows **one registered voice per connection** (`eleven_v4` allows up to 10), and starts audio after a fixed ~40 characters / 8 words unless flushed. Eleven v3 Conversational (~280 ms) is now "previous generation" ([TTD WebSocket guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd.md)).
  - Use **one WebSocket per user session** and up to **5 contexts per connection**. Contexts time out after 20 s of inactivity (configurable up to 180 s); send empty text as a keepalive.
  - On barge-in, `close_context` the interrupted context and open a new one ([multi-context guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/multi-context-web-socket.md)).
  - Flash v2.5 inference is ~75 ms. Expected WebSocket TTFB is **100–150 ms** in North America, Europe and Southeast Asia and 150–200 ms in South and Northeast Asia. Serving regions are the US, Netherlands and Singapore; `api.us.elevenlabs.io` pins to the US.
  - **Professional Voice Clones are slower than Instant Voice Clones** [vendor]. This directly matters for cloned character voices.
- **Context-preserving continuations:** send the fragments of one LLM turn within the same context so prosody doesn't reset per sentence. ElevenLabs contexts, Cartesia continuations and Smallest AI `context_id` all work this way (Pipecat v1.10–1.12 notes).
- **Pronunciation:** Pipecat **1.12** (not 1.13) added `TTSService.pronunciation_transform_ipa()`. For ElevenLabs it emits SSML `<phoneme>` tags, which are read only by **`eleven_flash_v2` and `eleven_turbo_v2`** (the English-only models), and on the WebSocket only with `enable_ssml_parsing=True`. Eleven v3/v4 take IPA between slashes. This is useful for fantasy proper nouns, but **phoneme tags do not help Spanish calls on Flash v2.5**.

### 4.6 Transport: WebRTC vs. WebSocket, codecs, playout
- **Daily/Pipecat position:** do not use WebSockets in production for client↔server realtime media. TCP head-of-line blocking makes latency accumulate under packet loss. Opus over WebRTC is coupled to congestion control, has strong FEC, is timestamped (which makes playout and interruption bookkeeping easy), and brings browser AEC/NS/AGC. WebSocket reconnection and ping logic are hard to get right ([Daily guide](https://voiceaiandvoiceagents.com/); [Pipecat choosing a transport](https://docs.pipecat.ai/client/concepts/choosing-a-transport.md)).
- Transport options:

  | Transport | Notes |
  |---|---|
  | Daily (managed WebRTC) | ~75 PoPs, P50 first hop ~13 ms [vendor] |
  | LiveKit | Open-source SFU, self-hostable |
  | SmallWebRTC (Pipecat) | Peer-to-peer and serverless. Fine for single-region self-hosting and development. Not for distributed or mobile users at scale |
  | WebSocket | For server↔server links, telephony media streams and prototypes |

- Cloudflare's `@cloudflare/voice` is WebSocket-native by default (16 kHz PCM up, MP3 per sentence down). It is labelled **experimental**. For WebRTC it ships SFU utilities and custom-transport hooks, with more SFU adapters "planned"; the claim that there is a Pipecat-based WebRTC example is (unverified) ([Cloudflare blog](https://blog.cloudflare.com/voice-agents/), 2026-04-15). So WebSocket voice is still common in production-adjacent products. The trade-off is resilience on bad networks, not raw latency on good ones.
- **Echo cancellation failures cause self-interruption**, typically right when the bot starts speaking. Mitigations: a minimum VAD start-segment length and exponential smoothing of volume. Firefox's AEC is weak ([Daily guide](https://voiceaiandvoiceagents.com/)).

### 4.7 Interruption (barge-in) handling
- **Cancellation semantics (Pipecat):** an `InterruptionFrame` (SystemFrame) reaches every processor. Each cancels its in-flight task and drops queued data and control frames. The LLM stream is cancelled, TTS clears its buffers and timestamps, and the output transport drains unplayed audio. Frames marked `interruptible=False` survive, such as function-call results (v1.12 made `interruptible` a per-frame flag). Function calls can be `cancel_on_interruption` ([Pipecat interruptions](https://docs.pipecat.ai/pipecat/fundamentals/interruptions.md)).
- **Commit only what was heard:** Pipecat's output transport pushes `TTSTextFrame`s in sync with playback, and the assistant aggregator commits only spoken text. Twilio ConversationRelay sends an `interrupt` message with `utteranceUntilInterrupt` and `durationUntilInterruptMs` ([Twilio WS messages](https://www.twilio.com/docs/voice/conversationrelay/websocket-messages)). Ultravox uses ElevenLabs **character-level** alignment and Cartesia word timing to keep history accurate after interruptions ([Ultravox BYO TTS](https://docs.ultravox.ai/voices/bring-your-own.md)).
- **Spurious interruptions:**
  - min-words / min-duration thresholds: Pipecat `MinWordsUserTurnStartStrategy(min_words=3)`; LiveKit `min_duration` 0.5 s and `min_words`; Ultravox `minimumInterruptionDuration` 0.09 s.
  - Backchannel classifiers: LiveKit **adaptive** interruption mode (an audio model that separates real interruptions from backchannels) is the default "if available". **Correction:** it is not Cloud-only. Self-hosted agents can enable `mode: "adaptive"`, and usage beyond a monthly development allowance is billed ([LiveKit tuning](https://docs.livekit.io/agents/logic/turns/tuning/)). The original claim that it also needs a pipeline LLM and aligned-transcript STT is (unverified). Pipecat offers Krisp VIVA interruption prediction. ElevenLabs Agents exposes `interruption_ignore_terms` (backchannel words that never interrupt) and `turn_model` (`turn_v3` default).
  - **False-interruption resume:** LiveKit by default waits `false_interruption_timeout` = 2.0 s and then resumes ([LiveKit tuning](https://docs.livekit.io/agents/logic/turns/tuning/)).
  - Vapi `stopSpeakingPlan` (`numWords`, `voiceSeconds` 0.2, `backoffSeconds` 1.0) plus `acknowledgementPhrases` / `interruptionPhrases` lists.
- **Mute strategies** (Pipecat `FirstSpeechUserMuteStrategy`, `AlwaysUserMuteStrategy`) protect greetings or disclaimers. Disabling interruptions alone still lets the overlapping speech get transcribed and queued.
- **Empty interruptions:** by default Pipecat runs the LLM once when an interruption produced no transcript, so the conversation doesn't stall. This is configurable (`empty_user_turn`).
- Research frontier: *Continue, Adapt, or Yield* ([arXiv 2609.13117](https://arxiv.org/abs/2609.13117), 2026-09-11) shows that humans **adapt mid-turn** to collaborative overlaps 68.2% of the time, versus 34.8% for one full-duplex model (PersonaPlex). It is a single-model case study on 66 collaborative pairs. Binary stop/continue is a coarse model of real conversation.

### 4.8 Speculative / preemptive generation
| System | Trigger | What runs early | Cost / caveats | Reported gain |
|---|---|---|---|---|
| **LiveKit preemptive generation** (default ON) | Before end of turn is confirmed (needs STT preflight/interim support) | LLM only; `preemptive_tts` optional | Discarded if `on_user_turn_completed` changes context or tools. `max_speech_duration` 10 s, `max_retries` 3. Not guaranteed to help; bad for long monologues ([docs](https://docs.livekit.io/agents/build/audio)) | Reported per turn as `preemptive_lead_time` |
| **Deepgram Flux EagerEndOfTurn** | `eager_eot_threshold` 0.3–0.9 | Your LLM draft; `TurnResumed` cancels it | **+50–70% LLM calls** ([Deepgram](https://developers.deepgram.com/docs/flux/voice-agent-eager-eot)) | Deepgram: "trimming that last 100–200 ms" (the quickstart says "hundreds of ms"). Telnyx (2026-01-14): median -150 ms, top 5% -350 ms ([Telnyx](https://telnyx.com/release-notes/automatic-eager-end-of-turn-deepgram-flux)) [vendor] |
| **Pipecat eager EOT** (v1.9) | Flux / Cartesia eager events | LLM response **held** until the turn is confirmed; discarded if the committed transcript differs (`NormalizedMatch`) | Unconfirmed turns never reach context, and tool calls never execute speculatively | Spends the commit gap generating instead of waiting |
| **ElevenLabs speculative turn** | Silence before full confidence (Scribe v2 Realtime signals) | LLM | Higher LLM cost; off by default | n/a [vendor] |
| **PredGen** ([arXiv 2506.15556](https://arxiv.org/abs/2506.15556), 2025-06/10) | While the user is still speaking | Candidate responses | Small extra compute | **~2× lower latency** (simulated) |
| **RelayS2S** ([arXiv 2603.23346v2](https://arxiv.org/html/2603.23346v2), v1 2026-03-24, **v2 2026-09-09**) | Duplex S2S model (conformer encoder + Qwen2.5-0.5B backbone) drafts a 5-word prefix; a lightweight learned verifier (parameter count not reported in v2; the "~170K" figure is unverified) commits it; the cascade continues | Prefix speech | Fallback to cascade 8.1% (synthetic) / **29.3% (real voice)**; ~4.8% (synthetic) / **~17.5% (real)** of prefixes judged inappropriate | Synthetic: P90 first chunk **81 ms** vs 1,006 ms cascaded (GPT-4.1 back-end). **Real voice: 655 ms vs 823 ms P90**, average -479 ms, 99% of text quality. Excludes turn-detection lag, TTS and network. *(Corrected from v1 figures: "1,091 ms GPT-4o", "8% / 8.5%".)* |

Rules of thumb: speculate on the LLM, not on side effects. Hold the output until the turn commits. Discard on resume or on a transcript mismatch. Log the eager->resumed ratio to tune thresholds. Budget for the extra LLM calls. Skip speculation for long user turns.

### 4.9 Prewarming, co-location, async tools, fillers
- **Prewarming:**
  - Open STT, TTS and LLM sockets at call start and keep them alive: ElevenLabs contexts time out at 20 s, so send keepalives.
  - Prewarm per-segment HTTP connections **when the user starts speaking** (Pipecat AssemblyAI Sync).
  - Prewarm TTS contexts at turn start (Pipecat `on_turn_context_created`; Inworld context prewarm, v0.0.108, 2026-03-28).
  - LiveKit **instant connect** buffers microphone audio before the agent joins (`preConnectBuffer`).
  - Avoid cold starts: the Salesforce paper saw a 4.3 s first TTFT.
- **Co-location:**
  - All models in one cluster gave ~500 ms (Daily).
  - Modal pins services to one region set and tunnels around its proxy layer.
  - Deepgram's Voice Agent API and Cloudflare keep STT, LLM and TTS handoffs in-process or in-network.
  - Twilio runs ConversationRelay on single-tenant infrastructure co-located with its media edges.
  - Retell's infrastructure is in the US, so it tells custom-LLM hosts to run nearby. A client RTT above 300 ms causes spikes.
  - Pipecat Cloud regions: us-west, us-east, eu-central, ap-south ([regions](https://docs.pipecat.ai/pipecat-cloud/guides/regions.md)).
  - Synthflow targets <100 ms RTT in-region and cut LATAM RTT 48% with a regional PoP ([Synthflow call quality](https://docs.synthflow.ai/call-quality.md)) [vendor].
- **Async tools / fast-slow brain:**
  - LiveKit async tools become non-blocking when they call `ctx.update()`, can speak progress and support fillers (`ctx.with_filler`). **Subagent delegation** (talker-reasoner) hands slow reasoning to a separate model and context while the fast model keeps talking ([LiveKit async tools](https://docs.livekit.io/agents/logic/tools/async.md); [subagent delegation](https://docs.livekit.io/agents/logic/patterns/subagent-delegation.md)).
  - Keep 5–10 tools per agent ([LiveKit tool design](https://docs.livekit.io/agents/logic/tools/design.md)).
  - Function calls need two inference passes and can't be streamed, so plan a filler or a watchdog. Disable parallel tool calls unless needed (Daily guide). Pipecat 1.0 added `group_parallel_tools`.
- **Fillers / soft timeouts:**
  - ElevenLabs soft timeout is off by default (−1), recommended at **3.0 s**, and plays a static or small-LLM-generated filler once per turn ([ElevenLabs](https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow.md)).
  - LiveKit's "fast pre-response" speaks a short phrase from a smaller model in `on_user_turn_completed` while the main reply generates ([LiveKit nodes](https://docs.livekit.io/agents/logic/nodes.md)).
  - Pre-synthesize or cache fixed phrases (LiveKit `session.say()` with cached audio; Pipecat `TTSCacheMixin`).
- **Resilience:** ElevenLabs Agents retries the LLM at least 3 times across a backup chain ([LLM cascading](https://elevenlabs.io/docs/eleven-agents/customization/llm/llm-cascading.md)). Retell says to always close a response in `finally`, otherwise the agent goes silent until the user speaks. It also advises idempotent side effects, because discarded responses re-run tools.

---

## 5. Frameworks and platforms — what they are and what to learn from them

| Name | Kind | Status (2026-10) | Transport | Notable latency/architecture features |
|---|---|---|---|---|
| **Pipecat** | OSS Python framework (Daily), BSD-2 | v1.13.0 (2026-10-19); 1.0 on 2026-04-14; ~16.7k★ | Daily WebRTC, SmallWebRTC, LiveKit, WebSocket, telephony | Frame pipeline; SystemFrame interruptions; Smart Turn v3.2; LLM turn-completion tagging; eager EOT with held speculation; `UserBotLatencyObserver` contributions; per-provider P99 TTFS; evals with latency budgets; 100+ service integrations |
| **Pipecat Cloud** | Managed hosting for Pipecat | GA ~Jan 2026 (third-party, unverified) | Daily WebRTC + regional WS endpoints | **$0.01 per active session-minute** (agent-1x; 2x $0.02, 3x $0.03; reserved $0.0005/min for 1x); Daily WebRTC voice $0.001/min ([Daily pricing](https://www.daily.co/pricing/pipecat-cloud)) [vendor]. **Correction:** the pricing page claims "unlimited concurrency", and the docs set a per-deployment maximum pool of **50** in Daily-hosted regions (raised on request) with a user-set `max-agents`. The "default 10 concurrent instances" figure is not supported by either source ([scaling docs](https://docs.pipecat.ai/pipecat-cloud/fundamentals/scaling.md)) |
| **LiveKit Agents** | OSS Python/Node framework + SFU, Apache-2.0 | livekit-agents 1.8.8 (2026-10-15); ~14.9k★ | WebRTC (LiveKit SFU), SIP | Audio TurnDetector (14 languages); adaptive interruption (default when available; self-hosted use billed beyond a monthly allowance, *not* Cloud-only); preemptive generation on by default; instant connect; async tools and subagents; `DuplexModel` (GPT-Live, v1.8.1; via LiveKit Inference as `openai/gpt-live-1` in 1.8.8, which also adds `google/gemini-3.8-live` model strings and retires GPT Realtime 1.5/2 IDs); LiveKit Inference hosting STT/LLM/TTS (Gemma 4 31B default LLM, EU endpoint); OTel traces |
| **TEN Framework** | OSS graph runtime (Agora) | 0.11.73 (2026-09-22); ~11.2k★ | Agora RTC, WebSocket, SIP | TEN VAD (claims lighter than Silero) and TEN Turn Detection (vendor claims >98% accuracy); multi-language extensions; avatar and lip-sync examples |
| **Vocode** | OSS Python | **Effectively dormant**: last push 2024-11-15, last release v0.1.114a2 (2024-08) | WebSocket/telephony | Historical reference only; don't adopt [stale] |
| **Vapi** | Managed orchestration | Active | WebRTC/WebSocket/telephony | Start/stop speaking plans; smart endpointing (LiveKit/Vapi/Flux/Assembly/custom model); `waitSeconds` default 0.4 s; dashboard total excludes endpointing; GPT-Live support; squads |
| **Retell** | Managed orchestration | Active | WebRTC/telephony; custom LLM over WebSocket | ~600 ms claim; per-call P50–P99; "turtle" features flagged as latency-adding; custom-LLM `response_id` discard semantics; fast tier |
| **Bland** | Managed, owns full stack | Active | Telephony-first | Claims sub-400 ms with its own STT/LLM/TTS and self-hosted/on-prem options [vendor] |
| **Synthflow** | Managed no-code | Active | Telephony | Regional PoPs, network quality SLOs (RTT <100 ms) |
| **ElevenLabs Agents** | Managed (cascaded + new Realtime) | Active | WebRTC/WebSocket/telephony | Proprietary turn model; eagerness modes; speculative turn; first audio at the first comma; soft-timeout fillers; LLM cascading; custom LLM; Expressive mode on Eleven v4 Turbo; `turn_v3` turn model; new **Eleven Realtime v1 Mini/Max** voice mode (not available with custom LLMs; "rolling out gradually" per workspace) |
| **Deepgram Voice Agent API** | Managed single-WS STT+LLM+TTS | Active | WebSocket | Flux turn model, BYO LLM/TTS, in-process handoffs. **Corrected pricing from Deepgram's own page:** Standard $0.075/min PAYG ($0.068 Growth); Custom BYO-LLM **$0.065** ($0.059); BYO LLM+TTS $0.050 ($0.041); Standard BYO-TTS $0.065 ($0.051). Billed on WebSocket connection time ([Deepgram pricing](https://deepgram.com/pricing)). The earlier "~$0.056 BYO-LLM" came from a third-party snapshot and is wrong |
| **Twilio ConversationRelay** | Managed STT/TTS around your LLM WS | Active | PSTN/SIP | Token streaming (`last`, `interruptible`, `preemptible`); `interrupt` reports heard text; ElevenLabs Flash TTS option; co-located with media edges |
| **Cloudflare `@cloudflare/voice`** | Agents SDK mixin on Durable Objects | **Experimental** (2026-04-15) | WebSocket (WebRTC via Realtime SFU + Pipecat) | `withVoice(Agent)`; Workers AI Flux STT with turn detection + Aura TTS; per-sentence MP3; `context.signal` abort on interrupt; small provider interfaces |
| **OpenAI Agents SDK VoicePipeline** | SDK (chained mode) | Active | App-provided | STT -> workflow -> TTS with `AudioInput`/`StreamedAudioInput`; **no built-in interruption handling for streamed input** (you use `turn_started`/`turn_ended` events) ([docs](https://openai.github.io/openai-agents-python/voice/pipeline/)). OpenAI's guide now also lists Realtime S2S and **GPT-Live** (full duplex that delegates reasoning to your backend) |
| **Ultravox** | Speech-in LLM + external streaming TTS ("half-cascade") | v0.7 | WebSocket/SDK/telephony | No ASR stage; **$0.05/min**; ElevenLabs (its most-used voice provider) and Cartesia external voices with timing alignment; ran 0.864 s median in a Pipecat-run benchmark vs 1.536 s for GPT Realtime (2026-01) [vendor-published, indep harness] |

**Lessons worth copying (regardless of framework):**
1. **One cancellation primitive that every stage obeys.** Pipecat SystemFrames, LiveKit speech handles, Cloudflare `context.signal`.
2. **A "heard-text" ledger driven by TTS alignment timestamps**, so interruptions truncate context correctly. Twilio, Pipecat and Ultravox all do this.
3. **Separate endpointing from STT**, and make endpointing a pluggable strategy chain: VAD -> audio turn model -> LLM tag -> max timeout.
4. **Built-in per-turn latency attribution.** Pipecat contributions, LiveKit EOU/TTFT/TTFB metrics, Retell percentiles.
5. **Held speculation:** generate early, release only on commit.
6. **Per-session persistent provider sockets with keepalives**, and one TTS context per assistant turn.
7. **Fallbacks:** LLM cascade chains, a filler on timeout, never leave a turn unclosed.
8. **Scripted evals with latency budgets in CI** (Pipecat evals, LiveKit test framework, Retell/Vapi simulations).

---

## 6. Established best practice vs. SOTA vs. emerging

**(a) Established best practice (2025–2026 consensus)**
- Stream everything. Overlap stages. Measure V2V from user stop with p50/p95/p99.
- WebRTC for browser and mobile media; WebSocket for server↔server.
- Short VAD (~200 ms) plus a turn model instead of long fixed silence timeouts.
- Start TTS on the first sentence or clause, with one TTS context per turn on a persistent socket.
- Cancellable stages; commit only heard text; min-words/duration barge-in filters.
- Non-reasoning, fast-TTFT LLM on the voice loop; short system prompts (well under 8k tokens); a stable cached prefix.
- Co-locate STT, LLM, TTS and the agent worker in one region; warm connections.
- Async tools and fillers so the loop never goes silent for more than ~1.5–3 s.

**(b) Current SOTA / leading options**
- Turn-taking: Smart Turn v3.2 + LLM single-token tagging (Pipecat); LiveKit audio TurnDetector + adaptive interruption; Deepgram Flux / Flux Multilingual; Cartesia Ink-2 turns.
- Speculation: LiveKit preemptive generation (on by default); Pipecat eager EOT with held responses; Deepgram EagerEndOfTurn.
- Measured cascaded latency: about 0.75–1.05 s TTFA with cloud APIs, about 0.5 s with everything co-located on GPUs.
- Fast LLMs for voice: Haiku-class, Flash/Flash-Lite-class, GPT-5.x "none", and open 27–31B models (Gemma 4 31B, Qwen 3.8 27B) on low-latency hosts. Groq/Cerebras-class providers reach ~100 ms TTFT. **GPT-4.1 / 4.1-mini were deprecated on 2026-10-14 (shutdown 2027-01-14; OpenAI suggests `gpt-6-luna`)**, so don't build on them. OpenAI's GPT-6 Astra / GPT-6.1 Sol with the Ultrafast tier are not yet in the aiewf table, so their voice TTFAT is (unverified). Daily's open-weights **PhoneLLM Alpha 2** (2026-10-15) is a voice-specific option (see §10).

**(c) Emerging / experimental**
- **Speculative prefix handoff** (RelayS2S), where a tiny duplex model speaks the first words while the cascade catches up.
- **Input-time speculative decoding** (PredGen).
- **Full-duplex "talker" models delegating to a text backend:** OpenAI GPT-Live, now in LiveKit 1.8.x (`DuplexModel`) and Vapi.
- **Mid-turn adaptation** instead of a binary yield.
- **Media over QUIC / WebTransport**, which Daily expects in the future and which is not production-ready yet for Safari.
- **ElevenLabs Realtime models**, a managed single-vendor speech loop with ElevenLabs voices.

**(d) Pitfalls** — see §7.

---

## 7. Anti-patterns that kill latency

1. **Serial ("blocking") stages**: waiting for the full STT final, then the full LLM response, then TTS. This costs 1.2–2 s.
2. **A long fixed silence timeout as the only endpointer** (e.g. 500–800 ms of energy VAD), or extra "response wait" delays such as Vapi `waitSeconds` or Retell's response-wait slider (up to 5.5 s).
3. **Waiting for a full sentence or a large character buffer before TTS.** This includes the ElevenLabs default 120-character first chunk without flush/auto_mode and soft caps that are too large.
4. **Reasoning or thinking models on the voice loop**, or long system prompts above ~8k tokens re-sent every turn without caching.
5. **Breaking the cache prefix**: putting timestamps, per-turn retrieval or user-specific volatile data at the *top* of the prompt.
6. **Synchronous pre-generation moderation or guardrail LLM calls** that run serially before the main LLM, and synchronous provider content filters.
7. **New connection per turn** (TLS + WS handshakes to STT, LLM and TTS on every turn) and cold model containers.
8. **Cross-region hops**: agent in one region, STT in another, LLM gateway in a third, TTS in a fourth. Each hop adds RTT, and it adds it to *every* turn.
9. **Buffering processors** in a streaming framework, such as a context aggregator that waits for the full LLM output or a non-streaming HTTP TTS.
10. **Browser media over WebSocket/TCP on lossy mobile networks**, without AEC or jitter handling. Latency accumulates through head-of-line blocking.
11. **Container formats that need client-side prebuffering** (e.g. MSE needs enough appended data before `play()`) where raw PCM/Opus frames would play immediately [est].
12. **Uncancellable stages**: the bot keeps talking after barge-in, or context retains unheard text.
13. **Treating the dashboard total as the user's experience.** Vapi's total excludes endpointing and transport; Retell's excludes the client network.
14. **Optimizing p50 only.** Tails from provider queues, cold starts, tool calls and rate limits dominate perceived quality.
15. **Blocking tool calls with no filler.** Silence over ~2 s sounds like a dropped call.

---

## 8. Note on content policy (relevant to the architecture choice)
- Cascaded pipelines let the team choose an LLM whose policy fits verified-adult fictional roleplay, and swap it independently. Managed single-vendor loops (Deepgram Voice Agent with managed LLM, ElevenLabs Realtime, provider S2S models) tie you to that vendor's filters.
- Concrete evidence that filters bite: the aiewf benchmark notes that **AWS Nova 2.5 Sonic rejected the benchmark's standard system prompt** through a prompt-level content filter (it even blocked benign prompts containing the word "Replicate"). The maintainers had to restructure where context was placed ([aiewf README](https://github.com/kwindla/aiewf-eval), 2026-10-19).
- ElevenLabs Realtime models **cannot be used with a custom LLM** ([ElevenLabs realtime models](https://elevenlabs.io/docs/eleven-agents/customization/realtime-models.md)). An agent-graph roleplay LLM therefore rules out that mode.

---

## 9. Implications for Magic Worlds (prioritized)

**Current pipeline, as described and confirmed by a quick look at the code:**
- Browser AudioWorklet energy VAD with `silenceMsToEnd: 550`, `minSpeechMs: 250` (`src/features/call/components/CallScreen.tsx`). The segment is uploaded over a WebSocket.
- Server VAD gate.
- Groq `whisper-large-v3` batch STT (`magic-worlds-api/src/services/voice_orchestration/config.py`).
- LLM via the internal OpenAI-compatible agent-graph service (callbot graph + persona + lorebook).
- Sentence buffer that cuts only at `.`, `!` or `?` with a 160-character soft cap (`sentence_buffer.py`).
- ElevenLabs dialogue contexts with a flush-ahead gate (first three sentences flush immediately), or Fish Audio.
- MP3 streamed over the same WebSocket to a MediaSource playback buffer, barge-in truncation via a word ledger, quotas and moderation.

**Rough current-state V2V estimate [est; replace with measured numbers from the audit]:**

| Stage | Estimate |
|---|---|
| Fixed silence | 550 ms |
| Upload | 50–150 ms |
| Groq STT incl. network | 200–450 ms |
| Moderation (if serial) | 0–400 ms |
| LLM TTFT through the agent-graph hop | 500–1,200 ms |
| First full sentence | 150–500 ms |
| ElevenLabs TTFB (cloned voice) | 150–350 ms |
| MP3/MSE prebuffer + network | 80–250 ms |
| **Total** | **≈ 1.7–3.9 s, likely ~2–2.5 s p50** |

Best-in-class cascaded is ~0.8–1.0 s.

### P0 — measure and remove free latency (no vendor change)
1. **Per-turn latency attribution, Pipecat-style.**
   - Server: emit contributions for each turn: client `speech_end` (already stamped by the worklet) -> segment received -> STT done -> moderation done -> LLM first token -> first TTS text sent -> first audio byte sent.
   - Client: add first audio *played* (MSE `playing`/`timeupdate`) to close the loop.
   - Report p50/p95/p99 per call and per provider/model. Dashboards must include endpointing and playout.
2. **Clause-level first TTS chunk.**
   - For the *first* chunk of each turn, cut at the first `,` `;` `:` `—` or `…` after about 4–8 words, or after ~40–60 characters, whichever comes first. This is the ElevenLabs Agents approach. Later chunks stay sentence-level for prosody.
   - Make sure every pushed chunk is sent with `flush: true` (or `auto_mode`), so ElevenLabs' 120-character first-chunk schedule never applies. If the orchestrator's "dialogue contexts" use the **Text-to-Dialogue WebSocket** (Eleven v3/v4), the gate is instead a fixed ~40 characters / 8 words, and `flush: true` is still the escape hatch. The audit should confirm which endpoint is in use.
   - Expected saving: 150–400 ms [est].
3. **Shorten fixed endpointing, add a turn model.**
   - Drop the browser silence trigger toward **~200–300 ms**. Gate the commit on **Smart Turn v3.2** (open weights, ~8 MB int8, Spanish supported, ~10–100 ms CPU), run server-side on the uploaded audio or in-browser via ONNX Runtime Web. Keep a fallback max silence of ~1.2–2 s for "incomplete" verdicts.
   - Roleplay users pause mid-thought, so tune toward "patient", as ElevenLabs recommends for emotional conversations.
   - Optionally add LLM single-token completion tagging (✓/○/◐) in the callbot graph.
   - Expected saving: 200–350 ms on most turns, with fewer premature cut-offs [est].
4. **Move moderation and safety off the critical path.**
   - Run input moderation **in parallel** with LLM generation and gate *output release*, not *generation start*.
   - Check output per sentence or clause before it is pushed to TTS (streaming guardrail).
   - Make sure no provider-side synchronous content filter sits in front of the LLM.
5. **Groq STT quick wins.**
   - Always pass `language` (en/es) when known, and a short `prompt` with character and place names (≤224 tokens).
   - Upload 16 kHz mono WAV/PCM.
   - Keep an HTTP/2 keep-alive pool to Groq and prewarm it at `speech_start`, as Pipecat does.
   - Benchmark `whisper-large-v3-turbo`: 2.8× cheaper, slightly faster, +1.7 pts WER.
   - Note Groq's **10-second minimum billing** per request, which inflates cost for short roleplay utterances.

### P1 — structural improvements
6. **Speculative LLM start ("held speculation").** When VAD silence starts and the turn model says "likely complete", run STT and start the LLM immediately. Hold the output; release it on commit; cancel if the user resumes or the final transcript differs (normalized match).
   - Requires the agent-graph service to support **prompt cancellation** (abort the upstream stream) and quota accounting for discarded drafts.
   - Budget **+30–70% LLM calls** (Deepgram's figure is 50–70% for its eager mode). Skip speculation for user turns over ~10 s (LiveKit default).
7. **LLM TTFT engineering for roleplay prompts.**
   - Order the prompt as a stable cached prefix (system + persona + static lorebook/world facts), then rolling history, then **volatile per-turn lorebook hits and the user turn at the end**. This maximizes provider prefix caching.
   - Keep the voice prompt well under ~8k tokens: summarize older history and fetch lore by retrieval.
   - Use reasoning effort none/minimal.
   - Pick the call model by **measured TTFAT p95**, not p50 (aiewf shows wide p95 spreads).
   - Consider fast inference hosts for open roleplay-capable models (Groq/Cerebras/Baseten-class), which reach 100–650 ms p50.
   - Minimize hops inside the agent-graph service: one upstream call on the voice loop, persistent upstream connections, no blocking pre-steps.
8. **Streaming STT with partials and turn signals** as a step up from segmented batch. Candidates covering English and Spanish:
   - Deepgram **Flux Multilingual** (turn-native, eager EOT)
   - ElevenLabs Scribe v2 Realtime (the same vendor as TTS)
   - Soniox stt-rt
   - Cartesia Ink-2 turns
   - OpenAI `gpt-live-transcribe` (OpenAI's current recommendation for live audio; `gpt-realtime-whisper` is now legacy-for-existing-integrations)

   This requires continuous audio streaming instead of uploading segments (see item 10). Compare cost per minute against Groq's per-segment pricing with its 10 s minimum.
9. **Co-location.** Place the voice orchestrator, the agent-graph LLM service and the LLM provider endpoint in one region near the STT (Groq) and TTS (ElevenLabs serves from the US, Netherlands and Singapore; pin with `api.us.elevenlabs.io` if US-hosted). Measure the RTT of each hop. Consider a second region for Spanish-speaking users in the EU or LATAM.
10. **Transport.**
    - Short term: stream continuous 20 ms PCM/Opus frames over the existing WS rather than whole segments. This enables streaming STT and server-side turn detection and removes upload time.
    - Medium term: evaluate **WebRTC** (LiveKit self-hosted SFU, Pipecat SmallWebRTC for single-region, or Daily) for AEC/NS/AGC, Opus FEC and loss resilience on mobile networks.
    - Downlink: benchmark PCM/Opus over AudioWorklet against MP3+MSE for first-audio-played delay. MSE often needs a prebuffer [est].
11. **Fillers in-character.** If TTFT exceeds ~1.2–1.5 s, play a short, **pre-synthesized, per-character** acknowledgement (a breath, "Hmm…", "Mm.") in the character's cloned voice from a cache. Generic fillers break immersion. ElevenLabs recommends a 3.0 s soft timeout for business agents; companion roleplay can use a lower one with subtler sounds.

### P2 — robustness and quality
12. **Interruption polish.**
    - Min-words (2–3) or min-duration (~300–500 ms) barge-in threshold.
    - A backchannel list ("mm-hm", "sí", "ajá", "yeah") that doesn't interrupt.
    - **False-interruption resume** (LiveKit pattern: ~2 s with no transcript -> resume from the cut point).
    - Smoothed volume or a minimum start segment to avoid echo self-interrupts.
    - Keep the existing character/word ledger truncation, which matches best practice.
13. **TTS voice choice vs. latency.** ElevenLabs notes that PVCs are slower than IVCs and that higher output quality adds latency. For calls, prefer IVC voices on **Flash v2.5** (Turbo v2/v2.5 are deprecated) with ~22–24 kHz output. **Benchmark Eleven v4 Turbo** (~100 ms median inference [vendor], 90+ languages, expressive, one voice per Text-to-Dialogue connection) as the expressive real-time option for roleplay. Keep `eleven_v4` / v3 non-turbo for non-realtime narration. Continue the same-context continuation per turn for prosody. Use IPA/SSML pronunciation maps for fantasy names.
14. **Resilience.**
    - LLM fallback chain with a per-turn timeout (ElevenLabs cascades at least 3 attempts).
    - Always close the turn in `finally`.
    - Idempotent side effects (memory writes, quota debits) keyed by turn ID, because discarded or speculative turns re-run.
15. **Evals in CI.** Scripted multi-turn audio scenarios in English and Spanish with latency budgets (Pipecat evals pattern), plus quality grading of roleplay responses.

### P3 — strategic options
16. **Framework adoption vs. custom.** The custom orchestrator already has a ledger, flush-ahead and quotas. Adopting **Pipecat** (Python, matches the FastAPI backend) would bring Smart Turn, eager-EOT held speculation, the latency observers, 100+ service adapters and WebRTC transports for free. **LiveKit Agents** brings an SFU and adaptive interruption (Cloud-only). The lowest-risk path is to borrow the patterns (§5 "lessons"), and to prototype a Pipecat worker behind the same WS contract to compare measured V2V.
17. **Half-cascade (speech-in LLM + external TTS)**, as in Ultravox: it keeps ElevenLabs cloned voices and removes the STT stage. Evaluate only once roleplay quality, Spanish quality and content policy fit are verified. It also forfeits the agent-graph LLM unless the vendor supports BYO LLM. Full speech-to-speech and omni models are covered in the separate S2S research note.

---

## 10. Newer developments missed by the original notes (added by fact-check, 2026-10-20)

1. **Eleven v4 / Eleven v4 Turbo (ElevenLabs).** v4 Turbo is now ElevenLabs' flagship real-time TTS: ~100 ms median inference [vendor], 90+ languages including Spanish, high-fidelity cloning, and "interactive characters" as a stated use case. It is served only on the Text-to-Dialogue WebSocket, with one voice per connection, and it powers ElevenAgents' Expressive mode. Turbo v2/v2.5 are deprecated in favour of Flash. For Magic Worlds this is the most relevant TTS change: expressive character voices at near-Flash latency. The per-connection voice limit matters for multi-character scenes ([models](https://elevenlabs.io/docs/overview/models.md); [TTD WebSocket](https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd.md)).
2. **Deepgram Flux TTS (`/v2/speak`).** A turn-based, streaming-first TTS WebSocket. The server places flush boundaries itself, prosody carries across turns, and an `Interrupt` message returns **`text_spoken` / `text_remaining`**, so the server reports what the user heard and the client no longer has to rebuild it. The catalog lists only `flux-{voice}-en` voices (English). Price $0.045 per 1k characters PAYG ([Flux TTS overview](https://developers.deepgram.com/docs/flux-tts/overview.md); [voices](https://developers.deepgram.com/docs/flux-tts/voices.md); [pricing](https://deepgram.com/pricing)).
3. **Daily PhoneLLM Alpha 2 (2026-10-15).** Open-weights LLMs fine-tuned for voice-agent pipelines:
   - Mini: 30B total / 3.5B active, Nemotron 3 Nano base, **TTFT 17 ms** on one B200.
   - Max: 120B-A12B, Nemotron 3.5 Super base, ~27 ms TTFT on 2× B200.
   - Hosted on SageMaker, Baseten, Modal, and Cloudflare Workers AI (Mini: $0.06 / $0.24 per M tokens).
   - The model card lists English only and targets phone/tool agents, so roleplay and Spanish fit are unproven ([Daily blog](https://www.daily.co/blog/phonellm-alpha-2/); [HF card](https://huggingface.co/pipecat-ai/phonellm-max-alpha-2)).
4. **Pipecat Tone (rc1, 2026-10-16).** A 24M-parameter ONNX text classifier. Per turn it returns emotion, dialogue act, sarcasm, and whether the turn is only a listening sound ("mm-hm"). It runs in ~4–5 ms p95 on CPU. It can serve as a backchannel filter for barge-in. English only ([HF](https://huggingface.co/pipecat-ai/tone)).
5. **Pipecat Audience (RC2.1, 2026-10-14).** An addressee-detection model built for **multi-character voice experiences** (games, interactive stories). It scores which character a line is meant for, including "whole group" and "unclear" outcomes, in milliseconds on CPU. This is directly relevant if Magic Worlds adds multi-character calls. English only ([HF](https://huggingface.co/pipecat-ai/audience)).
6. **OpenAI model churn affecting cascades:**
   - GPT-4o / 4.1 / 4.1-mini were deprecated on 2026-10-14 (shutdown 2027-01-14).
   - `whisper-1` and the `gpt-4o-*-transcribe` models shut down on 2027-02-26; the replacements are `gpt-transcribe` / `gpt-live-transcribe`.
   - `tts-1` and `gpt-4o-mini-tts` shut down on 2027-01-06.
   - Ultrafast tier is available only on `gpt-6-astra` / `gpt-6.1-sol`.
   - Responses WebSocket supports a `generate: false` warm-up ([deprecations](https://developers.openai.com/api/docs/deprecations.md)).
7. **LiveKit Agents 1.8.8 (2026-10-15).** GPT-Live is available through LiveKit Inference (`openai/gpt-live-1`), `google/gemini-3.8-live` model strings were added, and the GPT Realtime 1.5/2 IDs were retired.
8. **ElevenLabs Agents turn controls:** `speculative_turn` (default false), `turn_model` (`turn_v3` default), `interruption_ignore_terms` and `spelling_patience` ([agents create API](https://elevenlabs.io/docs/api-reference/agents/create.md)).

---

## Sources (with dates)

| # | Source | Date / version |
|---|---|---|
| 1 | Daily — Voice AI & Voice Agents guide, https://voiceaiandvoiceagents.com/ | Updated June 2026 (orig. Feb 2025) |
| 2 | Pipecat GitHub releases (v1.13.0, v1.12.0, v1.11.0, v1.10.0, v1.9.0, v1.8.0, v1.7.0, v1.4.0, v1.3.0, v1.2.0, v0.0.108, v0.0.101), https://github.com/pipecat-ai/pipecat/releases | 2026-01-31 … 2026-10-19 |
| 3 | Pipecat docs — Overview, https://docs.pipecat.ai/pipecat/learn/overview | Retrieved 2026-10-20 |
| 4 | Pipecat docs — Interruptions, https://docs.pipecat.ai/pipecat/fundamentals/interruptions.md | Retrieved 2026-10-20 |
| 5 | Pipecat docs — STT latency tuning, https://docs.pipecat.ai/pipecat/fundamentals/stt-latency-tuning.md | Retrieved 2026-10-20 |
| 6 | Pipecat docs — UserBotLatencyObserver, https://docs.pipecat.ai/api-reference/server/utilities/observers/user-bot-latency-observer.md | Retrieved 2026-10-20 |
| 7 | Pipecat docs — Choosing a transport, https://docs.pipecat.ai/client/concepts/choosing-a-transport.md | Retrieved 2026-10-20 |
| 8 | Pipecat docs — Smart Turn overview, https://docs.pipecat.ai/api-reference/server/utilities/turn-detection/smart-turn-overview.md | Retrieved 2026-10-20 |
| 9 | Pipecat Cloud regions, https://docs.pipecat.ai/pipecat-cloud/guides/regions.md | Retrieved 2026-10-20 |
| 10 | Smart Turn v3.2 README, https://github.com/pipecat-ai/smart-turn | Repo last push 2026-01-29 |
| 11 | Daily — Pipecat Cloud pricing, https://www.daily.co/pricing/pipecat-cloud | Retrieved 2026-10-20 (aggregators conflict) |
| 12 | Pipecat 1.0 release (PyPI/GitHub), https://newreleases.io/project/pypi/pipecat-ai/release/1.0.0 | 2026-04-14 |
| 13 | LiveKit docs — Speech & audio (preemptive generation, instant connect), https://docs.livekit.io/agents/build/audio | Retrieved 2026-10-20 |
| 14 | LiveKit docs — Turn-taking tuning, https://docs.livekit.io/agents/logic/turns/tuning/ | Retrieved 2026-10-20 |
| 15 | LiveKit blog — Configuring turn detection and interruptions, https://livekit.com/blog/turn-detection-and-interruption-handling | 2026-06-30 |
| 16 | LiveKit docs — Pipeline nodes & hooks, https://docs.livekit.io/agents/logic/nodes.md | Retrieved 2026-10-20 |
| 17 | LiveKit docs — Async tools, https://docs.livekit.io/agents/logic/tools/async.md | Retrieved 2026-10-20 |
| 18 | LiveKit docs — Subagent delegation, https://docs.livekit.io/agents/logic/patterns/subagent-delegation.md | Retrieved 2026-10-20 |
| 19 | LiveKit docs — Tool loop design, https://docs.livekit.io/agents/logic/tools/design.md | Retrieved 2026-10-20 |
| 20 | LiveKit docs — Hosted by LiveKit (Gemma 4 31B), https://docs.livekit.io/agents/models/llm/livekit.md | Retrieved 2026-10-20 |
| 21 | LiveKit Agents releases (1.8.0–1.8.8), https://github.com/livekit/agents/releases | 1.8.8 = 2026-10-15 |
| 22 | LiveKit community — EOT ≈30% of e2e latency, https://community.livekit.io/t/eot-value-leads-to-around-30-of-e2e-latency-tried-reducing-min-max-endpointint-in-turn-delay-plugin-but-no-luck/1450 | Undated (2026) |
| 23 | LiveKit docs — Observability data, https://docs.livekit.io/agents/observability/data | Retrieved 2026-10-20 |
| 24 | Modal — Low-latency voice bot, https://modal.com/blog/low-latency-voice-bot | 2025-11-04 |
| 25 | Soniox — Voice agent latency budget, https://soniox.com/wiki/voice-agent-latency-budget | 2026-07-02 |
| 26 | Qiu et al. (Salesforce AI Research), Building Enterprise Realtime Voice Agents from Scratch, arXiv 2603.05413v2, https://arxiv.org/abs/2603.05413v2 | v1 2026-03-05; v2 2026-03-17 |
| 27 | RelayS2S, arXiv 2603.23346, https://arxiv.org/html/2603.23346v1 | 2026-03-24 |
| 28 | PredGen (Li & Grover), arXiv 2506.15556, https://arxiv.org/abs/2506.15556 | 2025-06-18; rev. 2025-10-08 |
| 29 | Continue, Adapt, or Yield, arXiv 2609.13117, https://arxiv.org/abs/2609.13117 | 2026-09-11 |
| 30 | aiewf-eval README (multi-turn voice LLM benchmark), https://github.com/kwindla/aiewf-eval | Retrieved 2026-10-20; cohorts to 2026-10-19 |
| 31 | aiewf-eval Groq gpt-oss-120b archive, https://github.com/kwindla/aiewf-eval/blob/main/docs/groq-gpt-oss-120b-archived-2026-10-17.md | 2026-10-17 |
| 32 | Daily — Benchmarking LLMs for voice agent use cases, https://www.daily.co/blog/benchmarking-llms-for-voice-agent-use-cases/ | 2026-02-02 |
| 33 | Ultravox — Pipecat integration + benchmark, https://www.ultravox.ai/blog/introducing-the-ultravox-integration-for-pipecat | 2026-01-16 (metadata conflicts) |
| 34 | Ultravox docs — How Ultravox works / BYO TTS / VAD, https://docs.ultravox.ai/gettingstarted/how-ultravox-works ; https://docs.ultravox.ai/voices/bring-your-own.md ; https://docs.ultravox.ai/noise/understanding-vad.md | Retrieved 2026-10-20 |
| 35 | Deepgram — Flux eager EOT for voice agents, https://developers.deepgram.com/docs/flux/voice-agent-eager-eot | Retrieved 2026-10-20 |
| 36 | Deepgram — Voice Agent architecture, https://developers.deepgram.com/docs/voice-agent-architecture.md | Retrieved 2026-10-20 |
| 37 | Deepgram changelog — Flux Multilingual GA, https://developers.deepgram.com/changelog/2026/4/15 | 2026-04-15 |
| 38 | Telnyx — Eager EOT default for Flux, https://telnyx.com/release-notes/automatic-eager-end-of-turn-deepgram-flux | Undated (2026) |
| 39 | PricingSaaS — Deepgram Voice Agent price change, https://pricingsaas.com/companies/deepgram/diffs/2026W14 | 2026-03-23/30 (third-party) |
| 40 | ElevenLabs docs — Conversation flow, https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow.md | Retrieved 2026-10-20 |
| 41 | ElevenLabs docs — Latency optimization, https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization.md | Retrieved 2026-10-20 |
| 42 | ElevenLabs docs — Multi-context WebSocket guide + API reference, https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/multi-context-web-socket.md ; https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input.md | Retrieved 2026-10-20 |
| 43 | ElevenLabs docs — Realtime models, https://elevenlabs.io/docs/eleven-agents/customization/realtime-models.md | Retrieved 2026-10-20 |
| 44 | ElevenLabs docs — LLM cascading, https://elevenlabs.io/docs/eleven-agents/customization/llm/llm-cascading.md | Retrieved 2026-10-20 |
| 45 | ElevenLabs docs — Expressive mode, https://elevenlabs.io/docs/eleven-agents/customization/voice/expressive-mode | Retrieved 2026-10-20 |
| 46 | Retell docs — Troubleshoot latency / Custom LLM best practices / Estimated latency, https://docs.retellai.com/reliability/troubleshoot-latency.md ; https://docs.retellai.com/integrate-llm/llm-best-practice.md ; https://docs.retellai.com/reliability/check-estimated-latency.md | Retrieved 2026-10-20 |
| 47 | Retell — Latency face-off 2025, https://www.retellai.com/resources/ai-voice-agent-latency-face-off-2025 | 2025 [stale?, vendor] |
| 48 | Vapi docs — Understanding latency / Voice pipeline configuration, https://docs.vapi.ai/assistants/model-intelligence/understanding-latency ; https://docs.vapi.ai/customization/voice-pipeline-configuration.md | Retrieved 2026-10-20 |
| 49 | Bland docs index (platform claims), https://docs.bland.ai/llms.txt | Retrieved 2026-10-20 |
| 50 | Synthflow — Call quality, https://docs.synthflow.ai/call-quality.md | Retrieved 2026-10-20 |
| 51 | Twilio — ConversationRelay overview + WebSocket messages, https://www.twilio.com/docs/voice/conversationrelay ; https://www.twilio.com/docs/voice/conversationrelay/websocket-messages | Retrieved 2026-10-20 |
| 52 | Cloudflare — Add voice to your agent, https://blog.cloudflare.com/voice-agents/ | 2026-04-15 (mod. 2026-07-15) |
| 53 | OpenAI — Voice agents guide, https://developers.openai.com/api/docs/guides/voice-agents.md | Retrieved 2026-10-20 |
| 54 | OpenAI Agents SDK — VoicePipeline, https://openai.github.io/openai-agents-python/voice/pipeline/ | Retrieved 2026-10-20 |
| 55 | OpenAI — Prompt caching / WebSocket mode / Ultrafast mode, https://developers.openai.com/api/docs/guides/prompt-caching.md ; https://developers.openai.com/api/docs/guides/websocket-mode.md ; https://developers.openai.com/api/docs/guides/ultrafast-mode.md | Retrieved 2026-10-20 |
| 56 | Groq — Speech to text docs, https://console.groq.com/docs/speech-to-text.md | Retrieved 2026-10-20 |
| 57 | TEN Framework GitHub (README, releases), https://github.com/TEN-framework/ten-framework | 0.11.73 = 2026-09-22 |
| 58 | Agora — TEN VAD & Turn Detection, https://www.agora.io/en/blog/making-voice-ai-agents-more-human-with-ten-vad-and-turn-detection | 2025 [stale?] |
| 59 | Vocode GitHub API metadata, https://github.com/vocodedev/vocode-core | Last push 2024-11-15 [stale] |
| 60 | NVIDIA — Pipecat voice agent blueprint, https://build.nvidia.com/pipecat/voice-agent-framework-for-conversational-ai/blueprintcard | Retrieved 2026-10-20 |
| 61 | futureagi — How to optimize Pipecat latency (vendor blog), https://futureagi.com/blog/how-to-optimize-pipecat-latency-2026/ | 2026 [vendor, unverified numbers] |

---

## Fact-check log (2026-10-20)

Method: primary sources only, fetched directly: GitHub API (releases, READMEs), Hugging Face model API, arXiv API, vendor `.md` docs and pricing pages. The shared web-search budget was exhausted during this pass, so no new search-engine queries were run. Items that could only be confirmed through third-party aggregators are marked (unverified) in the body.

| # | Claim (as originally written) | Verdict | Correction / note | Source |
|---|---|---|---|---|
| 1 | Pipecat v1.9.0 (2026-09-11) `LatencyBreakdown.contributions` example totals 1.044 s (LLM 0.336, Cartesia 0.359) | Confirmed | Published 2026-09-11T03:05Z; numbers match | https://github.com/pipecat-ai/pipecat/releases/tag/v1.9.0 |
| 2 | Pipecat v1.13.0 = 2026-10-19; 1.0 = 2026-04-14; ~16.7k★; BSD-2 | Confirmed | 16,655★ | https://github.com/pipecat-ai/pipecat/releases |
| 3 | Pipecat 1.13 added the IPA pronunciation transform | Corrected | Added in **v1.12.0**. ElevenLabs `<phoneme>` is read only by `eleven_flash_v2` / `eleven_turbo_v2` (English-only) | https://github.com/pipecat-ai/pipecat/releases/tag/v1.12.0 |
| 4 | Smart Turn v3.2: ~8M params, 8 MB int8 / 32 MB fp32, 23 languages incl. Spanish, 10–100 ms CPU, ~65 ms on Pipecat Cloud 1x, ~40% better on short utterances | Confirmed | v3.2 released 2026-01-07; "40%" = 40% fewer misclassifications. Still the latest release | https://github.com/pipecat-ai/smart-turn ; https://www.daily.co/blog/smart-turn-v3-2-handling-noisy-environments-and-short-responses/ |
| 5 | aiewf-eval TTFAT table rows (claude-haiku-5-5, gemini-3.5-flash-lite, gpt-5.5, gemini-3.7-flash, claude-sonnet-5-5, qwen3.8-27b, gemma-4-31b, kimi-k2.6, muse-spark-1.3, etc.) and the ~700 ms guideline | Confirmed | All values match the README. Added newer rows (gpt-5.6-sol/terra, haiku-5-5 low, gemini-3.8-flash). The Groq gpt-oss-120b row is archived with an unresolved cohort mapping | https://github.com/kwindla/aiewf-eval |
| 6 | GPT-4.1 recommended as a fast voice LLM | Corrected | GPT-4.1 / 4.1-mini **deprecated 2026-10-14, shutdown 2027-01-14** (replacement `gpt-6-luna`) | https://developers.openai.com/api/docs/deprecations.md |
| 7 | Deepgram Flux Multilingual `flux-general-multi`: 10 languages incl. Spanish | Confirmed | Language list confirmed. **"GA mid-April 2026" is unverified**: the cited changelog URL is the Deepgram CLI launch | https://developers.deepgram.com/docs/flux/language-prompting.md |
| 8 | Deepgram EagerEndOfTurn: +50–70% LLM calls; saves ~100–350 ms; Telnyx -150 ms median / -350 ms top 5% | Corrected (minor) | Deepgram's own figure is "the last 100–200 ms"; the 350 ms is Telnyx's tail figure (release 2026-01-14) | https://developers.deepgram.com/docs/flux/voice-agent-eager-eot.md ; https://telnyx.com/release-notes/automatic-eager-end-of-turn-deepgram-flux |
| 9 | Deepgram Voice Agent: $0.075/min standard; BYO-LLM ~$0.056/min | Corrected | BYO-LLM is **$0.065** PAYG ($0.059 Growth); BYO LLM+TTS $0.050; billed on WS connection time | https://deepgram.com/pricing |
| 10 | ElevenLabs WS: default `chunk_length_schedule` [120,160,250,290]; default `model_id` `eleven_multilingual_v2`; inactivity 20 s (max 180); 5 contexts/connection; Flash v2.5 ~75 ms; TTFB 100–150 ms NA/EU/SEA; regions US/NL/SG; PVC slower than IVC | Confirmed | All confirmed. Added: Text-to-Dialogue WS uses a fixed ~40 chars / 8 words threshold | https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input.md ; https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization.md |
| 11 | "Pick a Flash/Turbo-class model"; v3 as the expressive option | Corrected | Turbo v2/v2.5 are **deprecated**. **Eleven v4 Turbo** (~100 ms, 90+ languages) is the new real-time expressive model and v3 is "previous generation" | https://elevenlabs.io/docs/overview/models.md |
| 12 | ElevenLabs Realtime v1 Mini/Max not available with a custom LLM | Confirmed | Also "rolling out gradually" per workspace | https://elevenlabs.io/docs/eleven-agents/customization/realtime-models.md |
| 13 | ElevenLabs: first audio after "enough words and a comma"; soft timeout default -1, recommended 3.0 s; `speculative_turn` flag; "patient" for emotional conversations | Confirmed | `speculative_turn` default false (agents API); "patient" advice is on the Expressive-mode page | https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow.md ; https://elevenlabs.io/docs/api-reference/agents/create.md |
| 14 | Groq STT: v3 $0.111/h, 189×, 10.3% WER; turbo $0.04/h, 216×, 12% WER; 10 s minimum billing; prompt ≤224 tokens; WAV lowest latency | Confirmed | — | https://console.groq.com/docs/speech-to-text.md |
| 15 | LiveKit: min_delay 0.5 / max_delay 3.0; dynamic mode; false_interruption_timeout 2.0 s; preemptive generation default ON (TTS off, 10 s, 3 retries); TurnDetector 14 languages, v1 / v1-mini; text detector deprecated for 2.0; Gemma 4 31B default hosted LLM | Confirmed | Added: the audio detector needs VAD min silence ≥ 0.25 s | https://docs.livekit.io/agents/logic/turns/tuning.md ; https://docs.livekit.io/agents/logic/turns/turn-detector.md ; https://docs.livekit.io/agents/models/llm/livekit.md |
| 16 | LiveKit adaptive interruption needs LiveKit Cloud | Corrected | Default "if available"; self-hosted can enable it, billed beyond a monthly allowance | https://docs.livekit.io/agents/logic/turns/tuning.md |
| 17 | LiveKit Agents 1.8.8 (2026-10-15); `DuplexModel`/GPT-Live in 1.8.1 | Confirmed | 1.8.8 adds GPT-Live via LiveKit Inference and Gemini 3.8 Live strings | https://github.com/livekit/agents/releases |
| 18 | Salesforce arXiv 2603.05413v2 (2026-03-17): measured 755 ms TTFA | Confirmed | Also reports Qwen3-Omni DashScope ~702 ms audio-to-audio (useful for the S2S note) | https://arxiv.org/abs/2603.05413v2 |
| 19 | RelayS2S: P90 81 ms vs 1,091 ms cascaded GPT-4o; 8% fallback; 8.5% inappropriate; ~170K-param verifier | Corrected | v2 (2026-09-09): GPT-4.1 back-end, synthetic 81 vs **1,006 ms**; **real voice 655 vs 823 ms P90**; fallback 8.1% synthetic / 29.3% real; inappropriate ~4.8% / 17.5%; verifier size not reported (unverified) | https://arxiv.org/abs/2603.23346v2 |
| 20 | Continue/Adapt/Yield: humans adapt 68% vs 35% for a full-duplex model | Confirmed | 68.2% vs 34.8% (PersonaPlex), 66 collaborative pairs | https://arxiv.org/abs/2609.13117 |
| 21 | PredGen ~2× lower latency (simulated) | Confirmed | v2 2025-10-08 | https://arxiv.org/abs/2506.15556 |
| 22 | OpenAI prompt caching: automatic above 1,024 tokens for GPT-5.6+ with discounted reads | Corrected (nuance) | Writes cost 1.25× (30 min) / 2.5× (12 h); reads 0.1× (0.05× GPT-6.1 Sol); explicit or implicit breakpoints | https://developers.openai.com/api/docs/guides/prompt-caching.md |
| 23 | OpenAI `gpt-realtime-whisper` with `delay` minimal→xhigh as a streaming STT option | Corrected (status) | `delay` confirmed (Pipecat v1.11). OpenAI now recommends `gpt-live-transcribe` (live) / `gpt-transcribe`; `gpt-realtime-whisper` is for existing integrations | https://developers.openai.com/api/docs/guides/transcription.md |
| 24 | OpenAI Responses WebSocket mode up to ~40% faster | Confirmed | For rollouts with 20+ tool calls; added the `generate: false` warm-up. Ultrafast only on gpt-6-astra / gpt-6.1-sol | https://developers.openai.com/api/docs/guides/websocket-mode.md ; https://developers.openai.com/api/docs/guides/ultrafast-mode.md |
| 25 | Pipecat Cloud $0.01/active min, WebRTC $0.001/min, default 10 concurrent instances | Corrected | Prices confirmed. Concurrency: "unlimited" per pricing page; docs set a max pool of 50 per deployment in Daily-hosted regions | https://www.daily.co/pricing/pipecat-cloud ; https://docs.pipecat.ai/pipecat-cloud/fundamentals/scaling.md |
| 26 | Daily guide: 1,293 ms breakdown, ~500 ms co-located, 1,500 ms target, no WebSockets for client media in production, ✓/○/◐ tagging (5 s / 10 s) | Confirmed | Updated June 2026 | https://voiceaiandvoiceagents.com/ |
| 27 | Retell: "as low as 600 ms", server-measured; ~8k-token prompt slowdown; P50/P90/P95/P99 | Confirmed | — | https://docs.retellai.com/reliability/check-estimated-latency.md ; https://docs.retellai.com/reliability/check-actual-latency.md |
| 28 | Vapi: `waitSeconds` 0.4; non-English punctuation heuristics 0.1 / 1.5 / 0.5; dashboard total excludes endpointing and transport | Confirmed | The decision order also lists a "Vapi" smart-endpointing provider for non-English | https://docs.vapi.ai/customization/voice-pipeline-configuration.md |
| 29 | Twilio ConversationRelay `interrupt` returns `utteranceUntilInterrupt` + `durationUntilInterruptMs` | Confirmed | — | https://www.twilio.com/docs/voice/conversationrelay/websocket-messages |
| 30 | Cloudflare `@cloudflare/voice` experimental (2026-04-15), WS-native, 16 kHz PCM up / MP3 down, `context.signal` abort | Confirmed | The "Pipecat WebRTC example" detail is unverified | https://blog.cloudflare.com/voice-agents/ |
| 31 | OpenAI Agents SDK VoicePipeline has no built-in interruption handling for streamed input | Confirmed | — | https://openai.github.io/openai-agents-python/voice/pipeline/ |
| 32 | Modal: Parakeet-TDT-0.6B-v3 + Qwen3-4B + Kokoro-82M, ~1 s median, segmented STT faster than streaming | Corrected (nuance) | Faster than the *open-weights* streaming implementations they tried | https://modal.com/blog/low-latency-voice-bot |
| 33 | Ultravox $0.05/min, v0.7 | Confirmed | $0.05/min after 30 free minutes; `ultravox-v0_7-glm-4_6` is the latest open-weights checkpoint | https://www.ultravox.ai/pricing ; https://huggingface.co/fixie-ai |
| 34 | Vocode dormant (last push 2024-11-15; last release v0.1.114a2 2024-08); TEN 0.11.73 (2026-09-22) | Confirmed | — | https://github.com/vocodedev/vocode-core ; https://github.com/TEN-framework/ten-framework |
