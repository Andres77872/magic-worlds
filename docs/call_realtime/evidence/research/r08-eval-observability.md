# R08 — Evaluating, observing and testing realtime voice agents

> Research notes (evidence file) for the `docs/call_realtime` report. Written 2026-10-20.
> Scope: what to measure in a realtime voice agent (cascaded STT -> LLM -> TTS and speech-to-speech / omni), how to measure mouth-to-ear latency correctly, tracing, simulation/testing platforms, public benchmarks, load testing, regression testing with audio fixtures, A/B testing turn-detection parameters, and privacy-preserving logging. Ends with prioritized implications for Magic Worlds.
>
> Method note: ~30 web searches plus ~45 primary-source fetches (official docs, arXiv, vendor engineering blogs, leaderboards). The shared web-search budget ran out partway through. A few topics are therefore backed by fewer sources than I wanted: published accuracy numbers for turn-detection and barge-in models, Spanish-specific WER leaderboards, and vendor zero-retention terms. They are flagged where relevant. Vendor numbers are labelled **vendor-reported**. Sources older than 12 months are flagged **(possibly stale)**.
>
> **Fact-checked 2026-10-20** against primary sources (about 45 direct page fetches; the shared web-search budget was already exhausted, so no new search queries were possible). Corrections are made in place and marked "*(corrected 2026-10-20)*"; claims that could not be confirmed are marked **(unverified)**. See the "Fact-check log" at the end.

---

## 0. TL;DR

1. **Measure voice-to-voice (V2V) latency on one clock at the user's endpoint.** That means the end of the user's last voiced sample to the first *audible* sample of the reply. Report p50/p95/p99 and the first turn separately. Most vendor and framework numbers leave something out. Vapi's dashboard omits endpointing and transport. LiveKit's formula is EOU + TTFT + TTFB. Most observability tools use time-to-first-audio-byte as a proxy. A September 2026 IETF draft (`draft-nygate-ippm-mrl-00`) now formalises "mouth-to-ear response latency" with single-clock capture, an offline-annotated end of speech, RMS-based onset detection, calibration and a JSON report schema ([IETF, 2026-09-07](https://datatracker.ietf.org/doc/html/draft-nygate-ippm-mrl-00)).
2. **Decompose every turn into stages**, the way both major OSS frameworks now do: VAD hang-over / endpointing wait, STT final, turn-decision, LLM TTFT, text aggregation (first sentence), TTS TTFB/TTFA, transport, and playback. Pipecat's `UserBotLatencyObserver` and LiveKit's `ChatMessage.metrics` (`end_of_turn_delay`, `transcription_delay`, `llm_node_ttft`, `tts_node_ttfb`, `playback_latency`, `e2e_latency`) are the reference schemas ([Pipecat](https://docs.pipecat.ai/server/utilities/observers/user-bot-latency-observer), [LiveKit](https://docs.livekit.io/testing/observability/data.md)).
3. **Interruption and turn-taking quality are first-class metrics, not afterthoughts.** Track false barge-in rate, missed interruptions, cut-off-user rate (premature endpointing), stop latency, and backchannel handling. Full-Duplex-Bench formalised these as Takeover Rate, latency and backchannel JSD. Artificial Analysis uses a subset as its "Conversational Dynamics" score ([FDB v1](https://arxiv.org/html/2503.04721v3), [AA methodology](https://artificialanalysis.ai/methodology/speech-to-speech-benchmarking)).
4. **Tracing has converged on OpenTelemetry** with a conversation -> turn -> {stt, llm, tts} span tree and GenAI semantic-convention attributes. Pipecat, LiveKit, Langfuse, Arize/Phoenix (OpenInference), Braintrust, Opik and Coval all consume it. LiveKit 1.7.0 prefixed content attributes with `lk.pii.` so they can be stripped or redacted ([LiveKit tracing](https://docs.livekit.io/deploy/observability/tracing/)).
5. **Testing has converged on three layers.** First, deterministic turn-level unit tests in text mode on every commit. Second, LLM-simulated users plus an LLM judge on every PR (text) and nightly (audio). Third, production monitoring with recordings and per-turn metrics. Pipecat Evals, LiveKit Agent Simulations, Vapi Simulations and ElevenLabs Tests all follow this pattern. Tests should be **run N times and scored as pass rates**, because agents are non-deterministic ([Pipecat Evals](https://docs.pipecat.ai/pipecat/evals), [ElevenLabs](https://elevenlabs.io/docs/eleven-agents/customization/agent-testing)).
6. **Public benchmarks barely touch roleplay or companion quality.** Big Bench Audio covers reasoning, Full-Duplex-Bench covers turn-taking, τ-Voice covers customer-service tool use, and Audio MultiChallenge covers multi-turn memory and voice editing. Static audio benchmarks also correlate poorly with user preference (Kendall τ ≤ 0.33) ([Talk Arena / "Mind the Gap", ACL 2025](https://arxiv.org/pdf/2502.15919)). Magic Worlds needs its own persona, safety and bilingual evals.
7. **Load testing voice is not HTTP load testing.** Every simulated caller holds a full-duplex audio stream. Ramp, spike and soak profiles reveal provider concurrency caps, LLM queuing, and p95 blow-ups from roughly 600 ms to 8 s ([Coval, 2026-03-07](https://www.coval.ai/blog/voice-load-testing-methodology)).

---

## 1. What to measure — metric catalog

### 1.1 Latency (per turn)

| Metric | Definition (recommended) | Notes / reference implementations |
|---|---|---|
| **Voice-to-voice (V2V) / mouth-to-ear (MRL)** | End of user's last voiced sample -> first audible sample of agent reply, both on the *user endpoint's* clock | IETF draft defines Ingress MRL (packet arrival) and Playout MRL (after de-jitter buffer); "headline" onset = 10 dB above noise floor, ≥ −50 dBov, sustained 20 ms ([IETF draft](https://datatracker.ietf.org/doc/html/draft-nygate-ippm-mrl-00)). Twilio calls this "mouth-to-ear turn gap" and separately a "platform turn gap" that excludes last-mile transit ([Twilio, 2025-11-17](https://www.twilio.com/en-us/blog/developers/best-practices/guide-core-latency-ai-voice-agents)). |
| **Time to first *substantive* audio** | Same, but to the first non-filler content | Dasha recommends tracking fillers separately ([Dasha](https://dasha.ai/blog/voice-ai-latency)). The IETF draft flags a "discontiguous" response when a >150 ms gap occurs within 2 s after onset (filler then pause). |
| **Endpointing wait** | VAD speech-end -> turn committed | Pipecat reports it as an "endpointing wait" contribution tagged `VAD stop_secs`. LiveKit reports it as `end_of_utterance_delay` / `end_of_turn_delay`. |
| **STT final latency** | Speech end -> final transcript | LiveKit `transcription_delay`. Coval benchmarks "TTFS = time to final segment from a shared VAD end-of-speech anchor" ([Coval benchmarks repo](https://github.com/coval-ai/benchmarks)). For batch STT like Groq Whisper, this equals upload + queue + inference. |
| **LLM TTFT / TTFAT** | Request -> first token / first *answer* token | Pipecat separates TTFB from TTFAT (TTFB + thinking time) for reasoning models ([Pipecat metrics](https://docs.pipecat.ai/guides/fundamentals/metrics)). |
| **Text aggregation** | First LLM token -> first speakable sentence | Pipecat `text_aggregation`. Often 20–200 ms and invisible unless measured. |
| **TTS TTFB vs TTFA** | Request -> first byte vs first *audible* sample | Pipecat: TTFA = TTFB + leading silence. Coval's TTS benchmark counts front-loaded silence against the provider. |
| **Playback latency** | First audio frame received by client -> playback start | LiveKit `playback_latency`. In browsers, add `AudioContext.baseLatency + outputLatency` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/outputLatency)). |
| **First-turn / greeting latency** | Connect -> first bot speech | Pipecat `on_first_bot_speech_latency`. Must be reported separately and never silently pooled with later turns (IETF draft). |
| **Tool / RAG latency** | Per function call or retrieval | Pipecat `function_calls` breakdown. For Magic Worlds this covers lorebook retrieval and moderation. |

**Targets seen in 2025–2026 sources:**

| Source | Target |
|---|---|
| Twilio (2025-11-17, vendor) | Mouth-to-ear 1,115 ms target / 1,400 ms upper; STT 350/500; LLM TTFT 375/750; TTS TTFB 100/250. ConversationRelay internal p50 491 ms / p95 713 ms (**vendor-reported**) |
| Pipecat guide (voiceaiandvoiceagents.com, June 2026 update) | Example round trip: the table sums to 1,293 ms, while the text says "about 1,200 ms". Rows: mic 40, Opus encode 21×2, network 10×2, packet handling 2×2, jitter buffer 40×2, Opus decode 1×2, STT+endpointing 300, LLM 650, sentence aggregation 20, TTS 120, speaker 15. Recommends a **1,500 ms** V2V target. Reports a *demonstrated* 500 ms with all models in one GPU cluster tuned for latency ([guide](https://voiceaiandvoiceagents.com/)) |
| Hamming (2026-01-24 / 2026-02-10, vendor) | *(corrected 2026-10-20)* The two posts use different bands. **Jan 24 post (TTFA):** <300 ms excellent, 300–800 good, 800–1,500 acceptable, >1,500 breakdown. **Feb 10 post (TTFW):** <300 natural, 300–500 acceptable, 500–800 noticeable, >800 breakdown. Component targets (Jan 24): STT <200, TTFT <400, TTS TTFB <150, network <100, turn detection <400 ms. End-to-end (Jan 24): p50 <1.5 s, p90 <2.5 s, p95 <3.5 s (the same post's reference table says <5 s), p99 <8 s. Feb 10: p90 3.5 s is the alert threshold, and p95 >5 s sustained for 5 min is critical ([Hamming framework](https://hamming.ai/blog/how-to-evaluate-voice-agents-2026), [Hamming metrics](https://hamming.ai/blog/voice-agent-analytics-post-call-metrics-definitions-formulas-dashboards)) |
| Coval load-test guide (2026-03-07) | p50 <800 ms, p95 <2 s, p99 <4 s at peak. Alert on p95 |
| Human conversation | Modal inter-turn gap ≈200 ms across 10 languages ([Stivers et al., PNAS 2009](https://doi.org/10.1073/pnas.0903616106) — **possibly stale** but foundational). One-way delay <150 ms acceptable for interactive voice per ITU-T G.114 (2003, **possibly stale**) |

The Hamming thresholds are internally inconsistent across posts (e.g. p90 3.5 s vs 2.5 s). Treat them as rough industry bands, not standards.

### 1.2 Interruption / turn-taking metrics

| Metric | Definition | How to compute |
|---|---|---|
| **False barge-in rate** | Agent stopped (or truncated) for input that was not a real interruption: noise, cough, backchannel ("mm-hm", "ajá"), echo of the agent's own audio | Barge-in events where the post-interrupt STT is empty, is <N words, is a backchannel lexicon hit, or the user is silent for `false_interruption_timeout` (LiveKit uses 2.0 s and can resume speaking) ([LiveKit turns](https://docs.livekit.io/agents/build/turns/)) |
| **Missed interruption rate** | User clearly spoke over the agent but the agent kept talking | User-channel VAD speech ≥ X ms with ≥ M words during agent playback, and no stop within Y ms |
| **Stop latency** | User speech onset -> agent audio actually silent *at the client* | FDB v1.5 measures "stop latency". Hamming targets TTS suppression <200 ms (**vendor**) |
| **Cut-off-user rate (premature endpoint)** | Agent took the turn while the user had not finished | User resumes speaking within ~0.5–1.5 s of turn commit *and* before or just after agent onset. Or an LLM/annotator judges the transcript incomplete. FDB v1 "Pause handling" TOR measures exactly this: lower is better ([FDB v1](https://arxiv.org/html/2503.04721v3)) |
| **No-response / missed turn** | User finished, agent never responded within T | FDB "smooth turn-taking" TOR (ideal 1). Coval "agent-fails-to-respond" |
| **Overlap and gap distribution** | Distribution of floor-transfer offsets (negative = overlap, positive = gap) | Compare with human distributions. FDB uses Jensen-Shannon divergence vs the ICC corpus for backchannel timing |
| **Interruption frequency per call** | Agent talking over user, per turn or per call | Hamming: <5% of turns good, >10% poor (**vendor**) |
| **Heard ratio** | `played_ms / generated_ms` or `kept_chars / generated_chars` | Needed for barge-in truncation correctness and for billing |

**Formal definitions from Full-Duplex-Bench v1** ([arXiv 2503.04721](https://arxiv.org/html/2503.04721v3)):
- *Takeover Rate (TOR)*: per turn, TO = 1 if the model produces more than silence or a backchannel, else 0. TOR is the mean.
- *Backchannel*: a segment <1 s with fewer than two words. Frequency is in events/s, and timing JSD is computed vs human data in 200 ms windows.
- *Turn-taking latency*: end of user speech -> model response onset, computed only when TO = 1.
- *Interruption*: TOR (ideal 1), a GPT-4o 0–5 relevance score, and latency after interruption.
- Reported results (Table III): Moshi turn-taking latency 0.265 s but pause TOR ≈0.98 (it interrupts pauses). Freeze-Omni, described in the paper as "a cascaded full-duplex system with a frozen LLM pipeline", had a lower pause TOR (0.48–0.64). *(corrected 2026-10-20)* Its turn-taking latency was 0.95 s and its smooth-turn-taking TOR only 0.34. The 1.41 s figure is its latency *after a user interruption*, not its turn-taking latency. Gemini Live had pause TOR 0.26–0.31 and turn-taking latency 1.30 s.

This is the core trade-off any turn-detection A/B test must expose: **latency vs cutting users off**.

### 1.3 Recognition and synthesis quality

- **WER/CER** = (S + D + I) / N, after text normalisation. Coval pins Whisper's `EnglishTextNormalizer` + `jiwer`. For Spanish you need a Spanish normaliser (accents, numbers, "¿¡"), and CER is more stable than WER for short turns. Hamming bands: clean <5% excellent; noisy office <8%; street <12%; strong accents <10% (**vendor**). For roleplay, **entity/name error rate** matters more than raw WER: character names, invented places, lorebook terms. The Pipecat guide lists names, emails, addresses and numbers as top voice failure modes ([guide §8.2](https://voiceaiandvoiceagents.com/)).
- **TTS intelligibility via ASR round trip**: transcribe the synthesized audio with a reference ASR and compute WER against the input text. This catches TTS hallucination, skipped words and truncation. It is the standard method in Seed-TTS-style evals: Whisper-large-v3 for EN, Paraformer for ZH ([MiniMax-Speech, arXiv 2505.07916](https://arxiv.org/pdf/2505.07916)) and Coval's TTS benchmark.
- **Speaker similarity (SIM)** for cloned or custom voices: cosine similarity of speaker embeddings (WavLM-large verifier is the de-facto standard, ERes2Net as a cross-check). Absolute scores depend on the encoder, so compare only within the same encoder ([Soniqo, July 2026](https://www.soniqo.audio/blog/voice-cloning-benchmarks), via search snippet). This matters for Magic Worlds: it is the only automatic way to detect that a character's voice has drifted between providers, models or settings.
- **Naturalness**: subjective MOS (ITU-T P.800; crowdsourced P.808) or preference/Elo arenas. Artificial Analysis's Speech Arena uses blind pairwise votes and Bradley–Terry Elo. Automatic MOS predictors (UTMOS/UTMOSv2, DNSMOS) are useful as **drift detectors**, not as absolute quality judgements. Numbers change by model variant (e.g. `utmos22_strong`).
- **Prosody/emotion fit** (roleplay): judge with an audio-capable LLM on sampled turns. Arize's cookbook does tone classification by slicing turn audio and sending it to `gpt-audio-mini` ([Arize](https://arize.com/docs/ax/cookbooks/evaluate/tracing-and-evaluating-audio)). Calibrate against human labels.

### 1.4 Task, persona and safety outcomes

- **Customer-service style**: task success, containment, first-call resolution (Hamming formulas). τ-Voice scores the final DB state deterministically ([Sierra, 2026-05-01](https://sierra.ai/blog/tau-voice-benchmarking-real-time-voice-agents-on-real-world-tasks)).
- **Companion/roleplay adaptation** (not covered by public benchmarks): persona consistency (stays in character, voice and style), lore fidelity (no contradictions with the lorebook), memory across turns (Audio MultiChallenge's "Inference Memory" and "Self-Coherence" axes are the closest public proxy), language adherence (replies in Spanish when the user speaks Spanish, no code-switching mid-sentence), response length appropriate for speech, unspeakable-markup leaks (asterisks, emojis, stage directions read aloud), safety policy adherence (refusal false-positive and false-negative rates on adult-fiction vs disallowed content), and user-side signals (call length, hang-up within 30 s, repeated "what?" / re-asks, barge-in frequency as frustration).
- **Economics**: cost per connected minute, broken into STT audio-seconds, LLM tokens (cached vs uncached), TTS characters (billed vs heard), and moderation. LiveKit's `session.usage` and Pipecat's usage metrics show the per-model schema.

---

## 2. Measuring mouth-to-ear latency correctly

### 2.1 Why most reported numbers are wrong

- **Boundary mismatch.** Vapi's displayed latency sums per-component medians (transcriber + model TTFT + voice TTFA) and *excludes endpointing and transport*, while acknowledging both add user-perceived delay ([Vapi](https://docs.vapi.ai/assistants/model-intelligence/understanding-latency)). LiveKit's documented approximation is `eou.end_of_utterance_delay + llm.ttft + tts.ttfb`, with `e2e_latency` as the simpler pre-computed field ([LiveKit data hooks](https://docs.livekit.io/testing/observability/data.md)). The Pipecat guide warns that "most observability tools measure time-to-first-audio-byte as a proxy", which misses endpointing variation and network RTT.
- **Summing medians ≠ median of sums**, and tails compound. Always compute percentiles over per-turn totals.
- **The VAD hang-over is real latency.** If the VAD needs 500–800 ms of silence to decide the user stopped, those milliseconds are part of what the user experiences. Pipecat adjusts the start timestamp back by `stop_secs`. LiveKit counts it inside `end_of_utterance_delay`.
- **Server "first audio sent" ≠ client "first audio heard".** Missing pieces include downlink network, client decode (MP3 frame decoding, `decodeAudioData`), jitter/playback buffering, `AudioContext.baseLatency + outputLatency` (device/OS output, typically 10–40 ms, larger on Bluetooth), and any leading silence in TTS audio.
- **Clock sync.** Subtracting a server timestamp from a client timestamp introduces clock skew. The IETF draft avoids it entirely by taking t0 and t1 from **one monotonic clock at the calling endpoint**.

### 2.2 Three practical methods (use all three)

1. **Production, client-side single-clock telemetry (always on).** In the browser, stamp `t0` = the end of the last voiced frame. Take it from the AudioWorklet's sample clock, converted to `performance.now()` and corrected for the hang-over. Stamp `t1` = when the first reply sample is scheduled to play, plus `baseLatency + outputLatency`, or use `getOutputTimestamp()` to map the audio-context time to `performance.now()`. Send `t1 − t0` and the client-side sub-intervals to the server as a small metrics frame. Server-side stage durations (STT, TTFT, TTS TTFB) are *intervals on the server clock* and can be attached without any clock sync. `outputLatency` is Baseline 2025 "newly available", so feature-detect it and record `null` when absent ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/outputLatency)).
2. **Synthetic probe with acoustic loopback (lab / CI nightly).** Play a pre-recorded, hash-pinned stimulus into the client: a virtual mic, or a fake media stream in headless Chrome with `--use-file-for-fake-audio-capture`. Record the client's audio output on the same machine and clock. Annotate the stimulus end-of-speech offline, not with runtime VAD. Detect reply onset with RMS thresholds: headline +10 dB over the noise floor, ≥ −50 dBov, sustained 20 ms. Report sensitive/headline/strict variants to expose onset uncertainty. Calibrate the harness against a reference responder with known delays. This is the IETF draft method, and its `mrl-report/1` schema (n_attempted/n_reported/n_discarded, discard reasons, mean/p50/p95/max, turn index) is a good template ([IETF draft](https://datatracker.ietf.org/doc/html/draft-nygate-ippm-mrl-00)). Add simulated packet loss and jitter, as the Pipecat guide recommends.
3. **Manual waveform check (sanity, monthly or after big changes).** "Record the conversation, load the recording into an audio editor" and measure from the end of user speech to the start of bot speech ([Pipecat guide §5.1](https://voiceaiandvoiceagents.com/)). Cheap, and catches gross instrumentation bugs.

### 2.3 Reporting rules

- Report **p50, p95, p99 and max**, with n, per segment: first turn vs later turns, language, voice/provider, device class (desktop/mobile/Bluetooth), region, and with/without tool calls.
- Exclude turns where the user barged in before the agent spoke, but count them separately.
- Track **jitter** (the stdev of V2V within a call). Hamming suggests a stdev <100 ms (**vendor**). Users notice inconsistency as much as slowness.

---

## 3. Tracing and observability

### 3.1 The converged span model

| Framework | Hierarchy | Key latency attributes |
|---|---|---|
| **Pipecat** | `conversation` -> `turn` -> `stt` / `llm` / `tts` (realtime: `llm_setup`, `stt`, `llm_response`, `llm_tool_call` / `llm_tool_result`) | `metrics.ttfb` (s) on each service span (for realtime response spans it is time to first response). Turn: `turn.number`, `turn.type`, `turn.was_interrupted`, `turn.duration_seconds`, plus `conversation.id`. `turn.user_bot_latency_seconds` is **(unverified)**: it is not listed on the current OTel page. LLM: `gen_ai.usage.input_tokens` / `output_tokens` / `cache_read.input_tokens`, and `gen_ai.usage.audio.*` for realtime. TTS: `metrics.character_count`. *(added 2026-10-20)* Pipecat v1.6.0 renamed several span attributes to current GenAI conventions (e.g. `gen_ai.provider.name`, `gen_ai.usage.reasoning.output_tokens`), so dashboards built on the old names break. v1.7.0 added `metrics.audio_seconds` on `stt` spans ([Pipecat OTel](https://docs.pipecat.ai/server/utilities/opentelemetry), [Pipecat releases](https://github.com/pipecat-ai/pipecat/releases)) |
| **LiveKit Agents** | session -> `agent_turn` (+ `realtime_inference` child since 1.8.0) | `lk.*` turn timings, `lk.speech_id`. GenAI semconv `gen_ai.*`. Content attributes renamed `lk.pii.*` in 1.7.0: 12 span attributes (e.g. `lk.pii.user_transcript`) plus about 50 structured log fields. `allow_pii=False` drops them. `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=false` drops GenAI content globally ([LiveKit tracing](https://docs.livekit.io/deploy/observability/tracing/)). *(added 2026-10-20)* Recent 1.8.x releases changed tracing again. 1.8.5 added span-to-conversation correlation. 1.8.7 (October 2026) added end-to-end latency for *realtime* agents (needs a local VAD), moved telemetry attributes, and replaced the removed OTel Events API. Pin the Agents version when you mirror attribute names ([LiveKit releases](https://github.com/livekit/agents/releases)) |
| **OpenInference (Arize/Phoenix)** | `conversation.turn` (span kind `AUDIO`) -> `USER` / `LLM` -> `TOOL` | `input.audio.url`, `input.audio.transcript`, `output.audio.*`, `time_to_first_token_ms`, `session.id`. Inline base64 audio is capped by default at 32k chars (`OPENINFERENCE_BASE64_AUDIO_MAX_LENGTH=32000`, ≈0.5 s of 24 kHz mono PCM16). Prefer external URLs. `OPENINFERENCE_HIDE_INPUT_AUDIO` / `_OUTPUT_AUDIO` for redaction ([Arize](https://arize.com/docs/ax/cookbooks/evaluate/tracing-and-evaluating-audio)) |

Practical notes:
- In **Pipecat + Langfuse**, one trace = one whole conversation, unlike Langfuse's usual one-trace-per-request plus session grouping ([Langfuse Pipecat integration, 2025-05-29](https://langfuse.com/integrations/frameworks/pipecat)). Langfuse can store audio attachments (mp3/wav/ogg/opus/webm) in S3-compatible storage, deduplicated by SHA-256, with a 1 GB self-hosted default limit ([Langfuse multi-modality](https://langfuse.com/docs/observability/features/multi-modality)).
- The Langfuse/LiveKit example needs the `x-langfuse-ingestion-version` header, or spans can take up to 10 minutes to appear **(unverified)**: the current Langfuse LiveKit integration page does not mention the header or the delay. Flush the tracer provider on shutdown. That part *is* confirmed: "flush the provider on shutdown so no spans are lost when a job ends" ([Langfuse LiveKit](https://langfuse.com/integrations/frameworks/livekit)).
- The **OTel GenAI semantic conventions** moved to their own repo (`open-telemetry/semantic-conventions-genai`). The core repo's `docs/gen-ai` README states that they "have moved … and [are] no longer maintained in this repository". They are still evolving; the new repo's schema URL section reads "TODO" ([repo](https://github.com/open-telemetry/semantic-conventions-genai)). Its stated scope is GenAI clients, MCP and provider-specific conventions. There is no standard audio/voice-turn convention yet, so pin your own attribute names and version them.
- Braintrust traces LiveKit sessions as session/agent-turn/user-speaking/agent-speaking spans and can attach raw audio. Third-party reviews note that turn-taking and audio-conditioned metrics are not first-class there, so you build them ([Braintrust LiveKit docs](https://www.braintrust.dev/docs/integrations/livekit-agents), via search snippet).

### 3.2 Metric pipelines vs traces

Traces are for debugging individual turns. Dashboards and alerts need **durable, aggregatable per-turn metric rows**: a table or time-series store with stage durations and dimensions. Both frameworks emit per-turn metric objects in addition to spans: LiveKit `ChatMessage.metrics` and `session_usage_updated`, Pipecat `MetricsFrame`, `ServiceMetricsObserver` and `UserBotLatencyObserver`. Process-local reservoirs are fine for a debug endpoint but lose data on restart and cannot be merged across workers for accurate fleet-wide p95. Use histograms with mergeable buckets (Prometheus/OTel exponential histograms) or store raw per-turn rows.

### 3.3 Production monitoring products (voice-specific)

| Product | Kind | Voice-specific strengths | Weaknesses / notes |
|---|---|---|---|
| **Coval** | Simulation + eval + observe | Latency per stage (STT/LLM/TTS TTFB, e2e), interruption rate, fails-to-respond, WER vs reference, audio sentiment, OTel trace metrics, CLI/GitHub Actions/MCP; public STT/TTS benchmark ([Pipecat Coval page](https://docs.pipecat.ai/pipecat/evals/platforms/coval)) | Raised $28 M. Coval's own blog confirms the amount ("We raised $28M"); the image is labelled Series A. The June 2026 date is **(unverified)**. Pricing not public |
| **Cekura** | Testing + monitoring | "AI Interrupting User", "Stop Time After User Interruption", latency percentiles, gibberish detection, pitch. Needs stereo recordings for precise turn metrics. Ingests completed calls via REST ([Pipecat Cekura page](https://docs.pipecat.ai/pipecat/evals/platforms/cekura)) | Pricing from Cekura's own comparison page: $0.25 per voice-test minute, $0.05 per monitored call, $0.025 per chat reply, 300 free credits (**vendor**). Runs an orchestration benchmark that it also sells against: benchmarks.cekura.ai, 82 caller scenarios × 7 platform configurations × 3 runs, 6 of the configurations self-submitted by the platforms ([Cekura, 2026-09-04](https://www.cekura.ai/blogs/hamming-alternative)) |
| **Hamming** | Testing + load + analytics | 4-layer framework (infra / execution / user behaviour / business), large-concurrency load tests ("supports 50K+ concurrent test calls", **vendor**), A/B testing | Marketing-heavy, thresholds inconsistent across posts |
| **Bluejay, Roark** | Simulation / observability | Listed by Pipecat with native integrations (Roark has a drop-in observer) | Not evaluated in depth here |
| **Langfuse / Arize-Phoenix / Braintrust / Opik** | General LLM observability | OTel ingestion, LLM-judge evals, datasets, audio attachments | Voice-turn metrics (V2V, barge-in) must be computed by you |
| **LiveKit Cloud Insights** | Framework-native | Transcripts + traces + logs + audio on one timeline. PII redaction before storage | Tied to LiveKit Cloud |

---

## 4. Testing: unit, simulation, regression, load

### 4.1 The three-layer test pyramid (current consensus)

1. **Deterministic turn-level tests (every commit, text mode).** LiveKit runs pytest/Vitest against `AgentSession.run(user_input=...)` with structural assertions on messages, tool calls and handoffs, plus an optional `.judge(llm, intent=...)` ([LiveKit test framework](https://docs.livekit.io/agents/start/testing/test-framework/)). ElevenLabs offers "Next Reply" tests (LLM-judged), "Tool Call" tests (exact/regex/LLM parameter matching) and creates tests from past conversations ("Create test from this conversation"). *(added 2026-10-20)* ElevenLabs also has **Simulation** tests: multi-turn conversations with a simulated user, max turns 1–50, default 5 ([ElevenLabs](https://elevenlabs.io/docs/eleven-agents/customization/agent-testing)).
2. **Simulated conversations (every PR in text mode, nightly or pre-release in audio mode).** An LLM persona pursues a goal and a judge grades the whole conversation. LiveKit says: "Use text runs on every pull request, and save audio runs for a nightly or pre-release pass". LiveKit Agent Simulations run on LiveKit Cloud ([LiveKit testing](https://docs.livekit.io/testing/)). Vapi Simulations pair a *scenario* (intent + success criteria + latency limits for voice runs) with a *personality* (tester model, transcriber, voice). Chat mode is cheaper and voice mode does final validation. The claim that legacy Test Suites are deprecated is **(unverified)**. The current Vapi docs, including the old `/test/test-suites` URL, describe only Evals and Simulations and contain no deprecation notice ([Vapi](https://docs.vapi.ai/observability/simulations-overview)). Pipecat Evals (`pipecat eval run`) supports YAML scripted (`turns:`) and simulated (`persona:`) scenarios, text and audio modes (local Kokoro plus Moonshine or Whisper, no keys), a default local Ollama judge (the docs' example is `gemma4:12b`), and assertions on content, function calls, interruptions (`send_after`), DTMF, vision and **latency budgets**. "A speech-to-speech agent … is evaluated in audio mode only" ([Pipecat Evals](https://docs.pipecat.ai/pipecat/evals)). *(added 2026-10-20)* Pipecat v1.8–v1.13 (Aug–Oct 2026) added audio-file user turns, a `pipecat eval suite` dashboard that shows live pass rates, multi-scenario files, judged function-call expectations, and `allow_continue` / classifier judges ([Pipecat releases](https://github.com/pipecat-ai/pipecat/releases)).
3. **Production monitoring** with recordings and per-turn metrics, feeding failures back into layer 1 or 2 as permanent tests. Hamming recommends converting every production failure into a regression test and "shadow mode" replay of production recordings through new prompts ([Hamming](https://hamming.ai/blog/how-to-evaluate-voice-agents-2026)).

**Probabilistic pass rates.** ElevenLabs supports `repeat_count` 2–20 per test and colour-codes 100% / ≥80% / <80%. The Pipecat guide frames voice evals as "probabilistic evals" where some behaviours need 8/10 and others 9.99/10 ([guide §8.1](https://voiceaiandvoiceagents.com/)). Gate deploys on pass-rate deltas. Hamming suggests blocking if task success drops >3% or latency rises >10% (**vendor**).

**Suggested scenario mix** (Hamming, **vendor**): ~40% happy path, 30% edge cases, 15% error handling, 10% adversarial, 5% acoustic variation (noise, accents, speakerphone).

### 4.2 Regression testing with recorded audio fixtures

Best practice, drawn from Coval's open benchmark harness ([coval-ai/benchmarks](https://github.com/coval-ai/benchmarks)) and the IETF draft:
- **Pin fixtures by SHA-256** and refuse to score if a hash changed. Loudness-normalise (Coval uses −20 dBFS RMS).
- Keep a **clean control set** plus **stress sets**: accent, noise-with-gaps, reverb, far-field, clipping, phone codec. Add voice-agent-specific sets of spontaneous conversational turns.
- **Version the methodology** and mark results before and after a change as incomparable.
- Rank by **median and show the p25–p99 spread**. Exclude TCP/TLS handshakes for model latency (pre-warm), and *separately* measure cold-start and handshake cost, which users do feel on the first turn.
- For turn-taking regressions, include **real human recordings with disfluencies** (fillers, long pauses, hesitations, false starts, self-corrections). FDB-v3 found self-correction handling and multi-step reasoning to be the most consistent failure modes across all systems ([FDB-v3, arXiv 2604.04847, 2026-04-06](https://arxiv.org/abs/2604.04847)).
- For each fixture, assert: endpoint decisions (no premature cut at a mid-utterance pause), STT WER/CER and entity accuracy, no false barge-in on backchannel or noise clips played during agent speech, a stage-latency budget, and the TTS round-trip WER on the reply.

### 4.3 Load testing realtime voice

From Coval's methodology ([2026-03-07](https://www.coval.ai/blog/voice-load-testing-methodology)):
- HTTP tools (k6 HTTP, Locust, JMeter) miss stream-specific failures: jitter accumulation, turn-taking collapse, STT/TTS queue saturation, and WebSocket connection exhaustion.
- **Phases**: baseline (10 concurrent, ≥5 repeats per scenario) -> ramp (double every 10 min: 10 -> 640) -> spike (50 -> 250 -> 50 -> 500, measure recovery) -> soak (70–80% capacity for 8–24 h for leaks and pool exhaustion) -> target.
- **Pass criteria at peak**: p50 <800 ms, p95 <2 s, p99 <4 s, completion >95%, jitter <30 ms, loss <0.5%. Plot p95, completion and error rate against concurrency to find the knee.
- **First bottleneck is usually LLM inference queuing**, which compounds across turns. Also check per-key TTS concurrency caps ("often not prominently documented"), STT session caps and LLM token-throughput limits.
- **Realistic callers**: pauses, interruptions, variable utterance length, background noise. Avoid pure script replay.
- Tooling: `k6/websockets` (the experimental module is deprecated) supports a global event loop and timers. Binary receive needs `binaryType = "arraybuffer"` ([k6 docs](https://grafana.com/docs/k6/latest/javascript-api/k6-websockets/)). For audio-paced sending, a custom Python asyncio or Node harness that streams real fixture audio at real-time pace and measures client-side V2V per simulated caller is usually simpler and more faithful. Stub paid providers with latency-faithful fakes for scale tests, and run small real-provider tests to discover their actual caps.

### 4.4 A/B testing turn-detection and barge-in parameters

- **Randomise per call (or per user), not per turn**, because turn behaviour has within-call carry-over (users adapt to an agent that interrupts them). Stratify by language and device.
- **Primary metric** (pick one): V2V p50. **Guardrails**: cut-off-user rate, false barge-in rate, missed interruption rate, re-ask rate, early hang-up rate, and call length. Tuning by feel is explicitly discouraged by LiveKit: "Preemptive generation in particular doesn't always reduce latency", so verify with metrics ([LiveKit tuning](https://docs.livekit.io/agents/logic/turns/tuning.md)).
- **Knobs and documented defaults** (LiveKit, as a reference point):

| Knob | Default |
|---|---|
| `endpointing.min_delay` | 0.5 s |
| `endpointing.max_delay` | 3.0 s |
| `endpointing.mode` | `"fixed"`. `"dynamic"` (Python) "adapts within the range based on session pause statistics" |
| `interruption.min_duration` | 0.5 s |
| `interruption.min_words` | 0 |
| `interruption.false_interruption_timeout` | 2.0 s, with `resume_false_interruption=True` |
| `min_consecutive_speech_delay` | *(corrected 2026-10-20)* **0.0 s** (Python only). This is the gap between consecutive *agent* utterances, and it does not affect user-side turn detection. The docs suggest 0.2–0.4 s when agent utterances run together, e.g. `say()` followed by a tool-driven `generate_reply()` |
| `preemptive_generation.enabled` | *(added)* **True**. `preemptive_tts` False, `max_speech_duration` 10 s, `max_retries` 3 |

- **Classic endpointing bands** (Hamming, **vendor**): aggressive 200–300 ms (cut-off risk), balanced 400–600 ms, conservative 700–1000 ms.
- **Semantic/acoustic turn detectors** shift the trade-off curve rather than just moving along it. Pipecat Smart Turn v3.2 is an ~8M-param Whisper-Tiny-based classifier for 23 languages, including Spanish. It runs in ~10–100 ms on CPU, and ~65 ms on Pipecat Cloud (**vendor-reported**) ([smart-turn](https://github.com/pipecat-ai/smart-turn)). LiveKit's adaptive interruption model separates backchannels from barge-ins acoustically, with no transcript needed. LiveKit publishes no accuracy numbers; it only says the model "adds minimal latency". *(added 2026-10-20)* The model needs Python Agents ≥1.5.0 or Node ≥1.2.0. It is meant to be language-agnostic, though it "might perform better with English". It is on by default only on LiveKit Cloud, or in dev mode with Cloud credentials, and only when a VAD is used. Self-hosted agents must set `mode="adaptive"` explicitly ([LiveKit adaptive interruption](https://docs.livekit.io/agents/logic/turns/adaptive-interruption-handling.md)). I found no independent, published false-barge-in or premature-cut benchmark across these models (search budget exhausted). **Build the evaluation set yourself**: EN/ES fixtures with labelled pauses, backchannels and true interruptions.
- **Offline first, then online.** Replay labelled fixtures through each parameter set to draw a latency-vs-cut-off curve and choose 2–3 candidates. Only then A/B in production.

---

## 5. Public benchmarks (what they measure and what they miss)

| Benchmark | What it measures | Latest status (as of 2026-10-20) | Relevance to companion/roleplay voice |
|---|---|---|---|
| **Full-Duplex-Bench v1** ([2503.04721](https://arxiv.org/html/2503.04721v3)) | Pause handling, backchanneling, smooth turn-taking, user interruption (TOR, latency, JSD, GPT-4o relevance) | Static, offline. Code on GitHub | High for turn-taking design. Adaptable to cascaded systems via its server-client scripts |
| **FDB v1.5** ([2507.23159](https://arxiv.org/abs/2507.23159)) | Overlap: user interruption, user backchannel, talking to others, background speech. Stop/response latency, prosodic adaptation | ICASSP 2026. Finds "responsive" vs "floor-holding" strategies | High (side conversations and TV in background are common at home) |
| **FDB v2** ([2510.07838](https://arxiv.org/abs/2510.07838)) | Multi-turn, real-time, automated *examiner* over WebRTC/WebSocket. Daily/correction/entity-tracking/safety tasks at fast and slow pacing | Accepted by ACL 2026 (arXiv comment). The "short paper" label is **(unverified)**. Framework released 2026-02-23 ([repo](https://github.com/DanielLin94144/Full-Duplex-Bench)) | Medium-high. The examiner pattern can be reused against a WebSocket agent |
| **FDB v3** ([2604.04847](https://arxiv.org/abs/2604.04847)) | Tool use under real disfluencies (5 types). Pass@1, latency, interruption avoidance | Paper on arXiv 2026-04-06 (repo news says 2026-04-15). Code and data released 2026-05-20. GPT-Realtime best Pass@1 0.600. Cascaded Whisper -> GPT-4o -> TTS baseline had a perfect (100%) turn-take rate but 10.12 s task latency, the highest of the 6 configurations. No v4 as of 2026-10-20 | Medium (tool-heavy). Disfluency audio is a useful fixture source |
| **Big Bench Audio** ([HF](https://huggingface.co/datasets/ArtificialAnalysis/big_bench_audio)) | 1,000 spoken BBH reasoning questions (4 categories, 23 TTS voices). MIT | AA harness v1.2 since May 2026 (judge and grader updated). v1.1 (Mar–May 2026) used a Claude Sonnet 4.6 judge and counted unanswered questions as wrong. v1.0 used Claude Sonnet 3.5 and did not penalise errors, so scores across harness versions are not comparable (AA methodology page; the HF card shows no version). Top S2S models ≈97–99% (saturating) **(unverified in this pass)** | Low (reasoning, not conversation) |
| **τ-Voice** ([Sierra, 2026-05-01](https://sierra.ai/blog/tau-voice-benchmarking-real-time-voice-agents-on-real-world-tasks); [2603.13686](https://arxiv.org/pdf/2603.13686)) | 278 τ-bench tasks in full duplex with noise, accents, G.711 8 kHz and frame drops. Deterministic DB-state scoring | Voice SOTA rose from 30% (gpt-realtime-1.0, Aug 2025) to 67% (grok-voice-think-fast-1.0, Apr 2026), about 79% of text capability, up from about 45% when the paper was written (**reported by Sierra**). Paper on arXiv 2026-03-14. Caller simulator uses GPT-4.1. Accents come from ElevenLabs TTS voices, not human speakers | Low-medium (customer service), but the simulator design (200 ms ticks, LLM turn-taking policy every 2 s) is a good blueprint |
| **Audio MultiChallenge** ([Scale](https://labs.scale.com/leaderboard/audiomc); arXiv 2512.14865, 2025-12-16. The ACL 2026 venue is **(unverified)**: arXiv lists no venue) | 452 conversations, 47 speakers, 1,712 rubrics, 14.99 h of user audio. Inference memory (132 conversations, 42 audio-cue-gated), instruction retention (120), self-coherence (83), voice editing (117) | Top overall: gemini-3.8-flash (high) 60.4, salesforce-launa-omni-1 59.7, gemini-4-argon (high) 58.4. Best entries explicitly marked as *audio-output* (†): gemini-3.1-flash-live-preview (Thinking) 36.1 and gpt-realtime-1.5 34.7. gpt-realtime-2 (xHigh) scores 48.5 but its output modality is unlabelled. Voice Editing average pass 18.0% | **High**: memory, self-coherence and mid-sentence corrections are exactly what persona calls stress |
| **VoiceBench** ([2410.17196](https://arxiv.org/abs/2410.17196v3)) | Speaker/environment/content robustness of voice assistants (~5.8k items) | 2024, **possibly stale** | Medium (robustness methodology) |
| **URO-Bench** ([2502.17810](https://arxiv.org/abs/2502.17810)) | Understanding, reasoning, oral conversation. Basic and pro tracks, 20 test sets each | EMNLP Findings 2025 | Medium (includes paralinguistics) |
| **VocalBench** ([2505.15727](https://arxiv.org/html/2505.15727v3)) | ~9.4k items, 15 abilities incl. *speech generation quality* (EN + ZH) | 2025 | Medium (evaluates acoustics, not just text) |
| **Talk Arena** ("Mind the Gap!", [arXiv 2502.15919](https://arxiv.org/pdf/2502.15919), 2025-02-21. The ACL 2025 venue is **(unverified)**: neither arXiv nor talkarena.org states it) | 7,500 interactive large-audio-model (LAM) interactions from 484 participants | Static benchmarks predict preference poorly: no single benchmark exceeds Kendall τ = 0.33, and combined features give R² 0.30. The claim that an ASR + text-LLM pipeline was among the preferred was not re-checked | **High as a caution**: you must run your own preference tests |
| **Artificial Analysis S2S** ([leaderboard](https://artificialanalysis.ai/speech-to-speech), [methodology](https://artificialanalysis.ai/methodology/speech-to-speech-benchmarking)) | Index v2.0 (since Aug 2026): Big Bench Audio reasoning + τ-Voice + Speech Agent Arena Elo + task success. Conversational Dynamics (FDB v1/v1.5 subset) shown separately (removed from the index in v2.0). TTFA; cost per hour | Leaderboard on 2026-10-20 (index score / TTFA / $ per hour of input audio): Grok Voice 3.0 86.9 / 0.81 s / $4.80; GPT-Live-1 (Astra, medium) 83.2 / 1.34 s / $5.83; Gemini 3.8 Live Extended Thinking (High) 82.6 / 1.35 s / $3.50; Grok Voice 2.0 81.3 / 0.70 s; GPT-Live-1 (Sol, low) 80.1; Gemini 3.8 Live 76.0 / 1.18 s / $0.84; GPT-Realtime-2.1 High 75.2 / 1.21 s / $10.75. Fastest TTFA overall: Raon SpeechChat 0.04 s (outlier), Deepslate Opal 0.44 s, **Eleven Realtime v1 Max 0.57 s / Mini 0.62 s**, Gemini 2.5 Flash Native Audio Dialog 0.63 s. *(corrected 2026-10-20)* Cost per hour of input audio runs from ~$0.84 (Gemini 3.8 Live) to ~$10.75–11.44 (GPT-Realtime-2.1 High, GPT-Realtime-1.5), not "$0.8 to $4+". Several $0.00 rows look like data anomalies | Medium. Covers native S2S models only, not cascades. TTFA definition is "first audio token" on Big Bench Audio, not mouth-to-ear |
| **Coval STT/TTS benchmarks** ([repo](https://github.com/coval-ai/benchmarks)) | TTS TTFA (incl. leading silence), RTF, WER. STT TTFS from a shared VAD anchor, WER, first-partial latency. Runs every 30 min from us-east-1 | Rankings shift by snapshot (e.g. Palabra TTS v1 median TTFA 103 ms on 2026-07-23, **vendor-adjacent**) | High for vendor selection, with region adjustment (Magic Worlds users are not all in us-east-1) |

**Takeaways on benchmarks:**
- The original AA index (June 2026) weighted reasoning, conversational dynamics and τ-Voice equally, with GPT-Realtime-2 (High) leading at 77.2% ([AA announcement, 2026-06-23](https://artificialanalysis.ai/articles/announcing-the-artificial-analysis-speech-to-speech-index)). Index versions changed twice within about two months, so always cite the version. The versions were v1.0 (June–Aug 2026); v1.1 (Aug 2026), which added Speech Agent Arena (Bradley–Terry Elo anchored on GPT Realtime 1.5 = 1000) and moved to 4 equal parts; and v2.0 (Aug 2026 onward), which replaced Conversational Dynamics with Task Success Rate (Wilson 95% CI).
- Reasoning on Big Bench Audio is saturated (≈97–99%, **unverified in this pass**). The differentiators are **agentic tasks (<70%) and multi-turn memory/voice editing (≤60%)**. *(updated 2026-10-20)* Conversational Dynamics is also nearly saturated among frontier S2S models. AA still displays it: StepAudio 3 Realtime 98.9%, Qwen Audio 3.0 Realtime Plus 98.4%, GPT-Live-1 (Sol) 97.3%, Grok Voice 3.0 97.0%, with older or open models far lower (Moshi 61%, Freeze-Omni 58.7%). This is probably why AA dropped it from the index.
- The trade-off between reasoning effort and latency is real for omni models too. In the June 2026 AA snapshot, "high" reasoning settings had a TTFA of 2.33 s (GPT-Realtime-2 High) and 2.98 s (Gemini 3.1 Flash Live High). The "~0.8 s" comparison point is GPT-Realtime-1.5 at 0.82 s, which AA does not label as non-reasoning. *(updated 2026-10-20)* **This has moved.** On the October 2026 leaderboard, GPT-Realtime-2 (High) is at 1.14 s and the top reasoning entries (GPT-Live-1, Gemini 3.8 Live Extended Thinking) at 1.34–1.35 s. Gemini 3.1 Flash Live High is still 2.99 s. Re-measure rather than reuse snapshot numbers.

---

## 6. Privacy-preserving logging of audio and transcripts

**Established practice:**
- **Content-free telemetry by default.** Log durations, counts, IDs, provider/model, and outcome codes. Exclude transcripts, prompts, audio and URLs. LiveKit implements this with `lk.pii.*`-prefixed attributes plus `allow_pii=False` (which drops whole attributes, GenAI content, message events and exception details) and the OTel env var `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=false` ([LiveKit tracing](https://docs.livekit.io/deploy/observability/tracing/)). OpenInference has `OPENINFERENCE_HIDE_INPUT_AUDIO` / `_OUTPUT_AUDIO`.
- **Separate, access-controlled content store** for opt-in or sampled recordings and transcripts used in debugging and evals. Give it short retention, encryption, audit logging, and per-user deletion that propagates to eval datasets. Reference recordings by opaque ID, never by URL in logs.
- **Pseudonymise** user IDs in eval and analytics stores. GDPR Art. 4(5) pseudonymisation requires that the re-identification key be "kept separately". Raw voice recordings become **biometric data** under Art. 4(14) when processed to "allow or confirm the unique identification" of a person, as with speaker-embedding comparisons ([GDPR Art. 4](https://gdpr-info.eu/art-4-gdpr/)). Speaker-similarity evals on *user* audio could therefore change the legal basis. Running SIM on *TTS output vs reference character voices* does not identify users.
- **Transcript redaction is imperfect and often English-only.** Deepgram entity redaction (PII/PCI/PHI) is English-only; for non-English audio "only numbers are redacted". Flux (`/v2/listen`) supports number redaction only (`numbers`, `aggressive_numbers`), and passing `pci` or `pii` fails with HTTP 400. *(corrected 2026-10-20)* The docs describe redaction only as tags in the transcript output and do not address the source audio. Assume audio is **not** redacted ([Deepgram](https://developers.deepgram.com/docs/redaction)). Presidio states that "there is no guarantee that Presidio will find all sensitive information" ([Presidio](https://presidio.dataprivacystack.org/)). *(corrected 2026-10-20)* Presidio is *transitioning* to a community-owned project under the Data Privacy Stack; the page does not say the transition is complete. For Spanish, plan on custom recognisers plus human spot checks.
- **Eval data from production** should come from users who consented, with a documented sampling rate. For 18+ content, keep eval reviewers and LLM judges within the same policy envelope as production. That means a judge/provider whose terms permit adult fiction, and reviewers who are trained and access-logged.
- **Provider retention**: verify zero/limited-retention modes for each STT/LLM/TTS vendor that receives call audio or text. Not researched here (search budget exhausted).

---

## 7. Emerging and experimental

- **Standardised MRL measurement** (IETF `draft-nygate-ippm-mrl-00`, Sept 2026): calibration-backed, schema-defined latency reports could become the comparable "number" across vendors. It is an individual draft, not adopted, and its constants are still open: 150 ms continuity gap, 2 s window.
- **Automated examiners** (FDB-v2) and **full-duplex user simulators** (τ-Voice: 200 ms ticks, LLM turn-taking policy) are replacing scripted callers. Expect simulation platforms to adopt interruption-capable simulated users widely.
- **Learned interruption/backchannel classifiers** (LiveKit adaptive, Krisp/Smart Turn) add a new stage to instrument. LiveKit already emits `InterruptionMetrics` (`detection_delay`, `num_backchannels`, `num_interruptions`).
- **Audio-LLM judges** for tone, emotion and persona fit (Arize cookbook with `gpt-audio-mini`). They need human calibration, and their content policies may not accept adult fiction.
- **Coding-agent-in-the-loop evals**: Pipecat Evals and Coval expose CLI and MCP surfaces so that coding agents can run voice evals while changing prompts or pipelines.
- *(added 2026-10-20)* **Latency attribution built into the frameworks.** Pipecat v1.9.0 added `LatencyBreakdown.contributions`, which splits each user-to-bot latency into labelled parts (e.g. "endpointing wait [config: VAD stop_secs]"), with `min_contribution_secs` for grouping. LiveKit Agents 1.8.7 (October 2026) added end-to-end latency measurement for *realtime* (S2S) agents, which needs a local VAD. Frameworks are therefore converging on per-turn "where did the time go" reports for both cascaded and omni pipelines ([Pipecat releases](https://github.com/pipecat-ai/pipecat/releases), [LiveKit releases](https://github.com/livekit/agents/releases)).
- *(added 2026-10-20)* **Preference arenas for full voice agents.** AA's Speech Agent Arena (added to the S2S index in v1.1, August 2026) runs blind pairwise preference over agentic and non-agentic scenarios. It is the first large public preference signal for S2S agents, but it covers native S2S models only.
- *(added 2026-10-20)* **New S2S entrants since mid-2026** on the AA leaderboard include GPT-Live-1 (Astra / Sol), GPT-Realtime-2.1 (incl. Mini), Grok Voice 2.0 / 3.0, Gemini 3.8 Live (+ Extended Thinking), Qwen Audio 3.0 Realtime, StepAudio 3 Realtime and **Eleven Realtime v1 (Max / Mini)**. Eleven Realtime is ElevenLabs' own speech-to-speech entry. It matters for Magic Worlds because the call path already uses ElevenLabs voices, but whether it supports custom or cloned voices and adult fiction is **(unverified)**.

---

## 8. Pitfalls and anti-patterns

1. **Reporting averages or median-of-components** instead of percentiles of per-turn end-to-end totals. A 300–500 ms average can hide 10% of turns at 1.5–3 s (Hamming).
2. **Starting the clock at "STT final" or "request received"**. This hides the VAD hang-over, upload time and endpointing, which are often the largest controllable components.
3. **Stopping the clock at "first byte sent"**. This hides decode, buffering, leading silence, device output latency and downlink jitter.
4. **Cross-clock subtraction** (client timestamp minus server timestamp) without sync. Use intervals per clock.
5. **Pooling the first turn** (cold connections, greeting synthesis, prompt-cache miss) with steady-state turns.
6. **Tuning endpointing by feel.** Every latency win must be paired with cut-off-user and false-barge-in guardrails.
7. **Text-only evals for a voice product.** Text mode is right for fast PR checks, but STT errors on names, Spanish accents, TTS markup leaks and barge-in only show up in audio mode.
8. **Single-run pass/fail** on non-deterministic agents.
9. **Trusting public leaderboards for a roleplay product.** They test reasoning or customer-service tasks. Talk Arena shows weak correlation with user preference.
10. **HTTP-style load tests** that do not stream audio at real-time pace, and load tests against real paid providers without knowing their concurrency caps.
11. **Logging transcripts or audio in general-purpose logs and traces**, or attaching base64 audio inline to spans (size caps, retention sprawl).
12. **Unpinned fixtures and unversioned scoring** (normaliser, ASR judge model, MOS predictor version), which make regressions unreproducible.

---

## 9. Implications for Magic Worlds (prioritized)

**Current state (quick code read, not a full audit).**

Frontend:
- `src/features/interaction/audio/callPlaybackTiming.ts` computes `speech_end_to_first_audible_ms` per turn. It only emits a local `performance.mark('mw.voice.first_audible')`, explicitly documented as "a playback proxy, not a hardware audio measurement", and the value is **not sent to the backend**.
- `src/features/interaction/audio/speechEndLag.ts` uploads `vad.speech_end_lag_ms` (VAD speech end, hang-over included, -> upload sent).

Backend (`magic-worlds-api`):
- `src/services/voice_orchestration/engine.py` records stage events (`voice_segment_received`, `voice_turn_admitted`, `voice_llm_first_delta`, `voice_tts_first_sentence`, `voice_first_assistant_audio`) as cumulative `latency_ms` from turn start.
- It computes `user_stop_ttfb_ms` = client lag + server receipt -> first audio frame. This *excludes* uplink transit, downlink transit, client decode/buffer and device output.
- `src/services/speech/metrics.py` keeps **process-local** reservoir histograms with nearest-rank p50/p95. These are not durable and not mergeable across workers.
- Telemetry is content-free by design. `src/services/voice_orchestration/observability.py` has an allow-list plus forbidden markers (`transcript`, `audio`, `prompt`, `url`, …). This is aligned with best practice.
- There is no OpenTelemetry. There are 55 voice test files (fake e2e turns, latency ordering, barge-in truncation, privacy sentinels, a live Groq STT contract). I did not find a recorded-audio regression corpus, a simulated-caller harness, or a load-test harness.

**P0 — make the latency number true and durable (1–2 weeks)**

1. **Close the client loop.** After the first audible reply sample, send a `voice_turn_client_metrics` frame over the existing WebSocket with:
   - `speech_end_to_first_audible_ms`, corrected by `AudioContext.baseLatency + outputLatency` when available (record which correction was applied);
   - `vad_hangover_ms`;
   - `upload_ms` (send start -> ack);
   - `first_audio_frame_received -> playing` (decode + buffer);
   - the barge-in stop latency (user speech onset -> local playback silenced);
   - device/browser class.
   
   Server-side stage *intervals* join by `turn_id`, so no clock sync is needed. This becomes the headline V2V metric, replacing the server-egress proxy.
2. **Persist per-turn metric rows** (MySQL table or time-series) with stage durations:
   - server VAD gate;
   - Groq STT request (upload + queue + inference);
   - moderation;
   - LLM TTFT and first-sentence (text aggregation);
   - TTS TTFB/TTFA per provider (ElevenLabs WS, Fish);
   - egress -> client playing.
   
   Add dimensions (language, voice provider/tier, cloned vs stock voice, first turn flag, lorebook size bucket, reconnects). Compute p50/p95/p99 by day and provider. Keep process-local reservoirs only for the live admin view.
3. **Add interruption metrics** to the same rows:
   - `barged_in`;
   - `false_barge_in`: barge-in whose following segment is empty/backchannel/<2 words, or user silent ≥2 s;
   - `missed_interruption`: user speech ≥X ms during playback without a stop;
   - `cut_off_user`: user resumes within ~1 s after the turn commit;
   - `heard_ratio` (`played_ms`/generated).
   
   The existing `played_ms`, `kept_chars` and `truncated` fields are a good base.

**P1 — regression and simulation (2–4 weeks)**

4. **Audio fixture corpus (EN + ES).** Use consented internal recordings plus TTS-generated speakers, SHA-256-pinned and loudness-normalised. Include:
   - clean and stress variants (noise, reverb, laptop mic, Bluetooth, mobile);
   - mid-utterance pauses;
   - Spanish/English code-switching;
   - character and lore proper nouns;
   - backchannels and coughs to play *during* agent speech.
   
   Run it nightly through the real client segmenter (headless Chrome fake mic) and the server VAD gate + Groq STT. Assert endpoint decisions, CER/WER and entity accuracy, false barge-in, and per-stage latency budgets. Use the IETF-style onset detection on the captured output for a lab V2V number.
5. **Text-mode persona simulations on every PR** (callbot graph + persona + lorebook), with an LLM judge that is permitted to evaluate adult fiction. Rubrics: stays in character, lore-consistent, replies in the user's language, speech-friendly length, no markup or stage directions read aloud, and safety policy (both over-refusal and under-refusal). Run each scenario 5–10 times and gate on pass-rate deltas. Pipecat Evals' YAML scenario format is a good model even without adopting Pipecat.
6. **Audio-mode simulations nightly or pre-release.** An LLM caller speaks over the real WebSocket protocol, with barge-ins and backchannels. FDB-v2's examiner and τ-Voice's tick-based simulator are the blueprints. Track V2V p95 and interruption metrics per run. Add Audio-MultiChallenge-style multi-turn memory and "voice editing" probes ("no wait, I meant…"), since those are weak spots even for frontier models.
7. **Adopt OpenTelemetry** with a `voice_call` -> `turn` -> `stt|moderation|llm|tts|playback` span tree. Mirror Pipecat/LiveKit attribute names (`metrics.ttfb`, `turn.was_interrupted`, `turn.duration_seconds`, `gen_ai.usage.*`, `gen_ai.provider.name`). Do not rely on `turn.user_bot_latency_seconds`: it is unverified and not listed in the current Pipecat OTel docs. Pin the convention version, because Pipecat v1.6.0 and LiveKit 1.8.7 both renamed or moved attributes in 2026. Keep content attributes out entirely, or behind an `mw.pii.*` prefix that is stripped by default, consistent with the existing allow-list. Export to a self-hosted Langfuse or Phoenix if content-bearing debug traces are ever needed, with a separate retention policy.

**P2 — scale and tuning (later)**

8. **Load test** with a custom asyncio WebSocket harness that streams fixture audio in real time. Use latency-faithful provider fakes for scale runs and small real-provider runs to find the actual ElevenLabs/Fish concurrency and Groq rate limits. Follow Coval's ramp/spike/soak profiles. Watch V2V p95, TTS queue wait (`queue_wait_ms` already exists), WebSocket handshake failures, and memory over soak.
9. **A/B turn-detection and barge-in parameters per call**: client VAD silence threshold, server VAD gate, min barge-in duration/words, and backchannel filter. Use V2V p50 as the primary metric and cut-off-user, false barge-in, re-ask and early hang-up as guardrails. Select candidates offline on the fixture corpus first. If a semantic turn detector (e.g. Smart Turn v3.2, EN+ES supported, BSD-2) is trialled, measure it the same way.
10. **Voice quality monitoring for character voices.** On a daily sample of TTS outputs, run:
    - ASR round-trip CER (catches truncation and hallucinated audio);
    - speaker similarity (WavLM) against each character's reference clip (catches voice drift after provider or model changes);
    - UTMOS as a drift signal.
    
    Run quarterly blind EN/ES preference tests (CMOS/arena-style) when changing TTS vendors.
11. **Cost per connected minute** dashboard per provider and tier: STT seconds, LLM tokens (cached/uncached), TTS billed vs heard characters, and moderation calls. Barge-in truncation makes "billed but unheard" a meaningful waste metric.

**If evaluating speech-to-speech / omni models:**
- Use the AA S2S leaderboard (cite the index version) and FDB v1/v1.5 results only as a shortlist.
- Then run the *same* Magic Worlds fixture, simulation and persona suites against the candidate. Pipecat notes that S2S agents can only be evaluated in audio mode, so audio-mode simulation must exist before any omni migration decision.
- Pay particular attention to:
  - custom/cloned voice support (most omni models have fixed voice sets);
  - adult-fiction content policy;
  - Spanish quality;
  - TTFA at the reasoning settings you would actually use. It was 2.3–3.0 s at "high" in the June 2026 AA snapshot. *(updated 2026-10-20)* The October 2026 leaderboard shows 1.1–1.35 s for the top reasoning entries (GPT-Realtime-2 High, GPT-Live-1, Gemini 3.8 Live Extended Thinking), while Gemini 3.1 Flash Live High is still ~3.0 s. These are AA "first audio token" figures, not mouth-to-ear.
  - Cost: input audio alone ranges from ~$0.84/h (Gemini 3.8 Live) to ~$10–11/h (GPT-Realtime-2.1 High, GPT-Realtime-1.5) on AA.
  - Shortlist candidate given the existing ElevenLabs integration: Eleven Realtime v1 (Max/Mini, TTFA 0.57/0.62 s on AA). Its voice-cloning support and content policy are unverified.

---

## Sources

| # | Source | Date |
|---|---|---|
| 1 | IETF draft-nygate-ippm-mrl-00, "Mouth-to-Ear Response Latency for Conversational Voice Systems" — https://datatracker.ietf.org/doc/html/draft-nygate-ippm-mrl-00 | 2026-09-07 |
| 2 | Pipecat OpenTelemetry docs — https://docs.pipecat.ai/server/utilities/opentelemetry | accessed 2026-10-20 |
| 3 | Pipecat UserBotLatencyObserver — https://docs.pipecat.ai/server/utilities/observers/user-bot-latency-observer | accessed 2026-10-20 |
| 4 | Pipecat metrics guide — https://docs.pipecat.ai/guides/fundamentals/metrics | accessed 2026-10-20 |
| 5 | Pipecat Evals — https://docs.pipecat.ai/pipecat/evals | accessed 2026-10-20 |
| 6 | Pipecat eval platform pages (Cekura, Coval) — https://docs.pipecat.ai/pipecat/evals/platforms/cekura , https://docs.pipecat.ai/pipecat/evals/platforms/coval | accessed 2026-10-20 |
| 7 | "Voice AI & Voice Agents" guide (Pipecat / Daily) — https://voiceaiandvoiceagents.com/ | June 2026 update (orig. Feb 2025) |
| 8 | LiveKit tracing — https://docs.livekit.io/deploy/observability/tracing/ | accessed 2026-10-20 (Agents 1.7.0/1.8.0 notes) |
| 9 | LiveKit data hooks / metrics — https://docs.livekit.io/testing/observability/data.md | accessed 2026-10-20 |
| 10 | LiveKit testing overview / test framework — https://docs.livekit.io/testing/ , https://docs.livekit.io/agents/start/testing/test-framework/ | accessed 2026-10-20 |
| 11 | LiveKit turns, tuning, adaptive interruption — https://docs.livekit.io/agents/build/turns/ , https://docs.livekit.io/agents/logic/turns/tuning.md , https://docs.livekit.io/agents/logic/turns/adaptive-interruption-handling.md | accessed 2026-10-20 |
| 12 | Vapi, understanding latency — https://docs.vapi.ai/assistants/model-intelligence/understanding-latency | accessed 2026-10-20 |
| 13 | Vapi simulations overview — https://docs.vapi.ai/observability/simulations-overview | accessed 2026-10-20 |
| 14 | Twilio, "A Guide to Core Latency in AI Voice Agents" — https://www.twilio.com/en-us/blog/developers/best-practices/guide-core-latency-ai-voice-agents | 2025-11-17 |
| 15 | Dasha, "Voice AI Latency: Set a Real Budget" — https://dasha.ai/blog/voice-ai-latency | undated (search snippet) |
| 16 | Coval, "Voice Load Testing Methodology" — https://www.coval.ai/blog/voice-load-testing-methodology | 2026-03-07 |
| 17 | Coval benchmarks repo — https://github.com/coval-ai/benchmarks | 2026 |
| 18 | Hamming, "How to Evaluate Voice Agents" — https://hamming.ai/blog/how-to-evaluate-voice-agents-2026 | 2026-01-24 |
| 19 | Hamming, "Voice Agent Analytics & Post-Call Metrics" — https://hamming.ai/blog/voice-agent-analytics-post-call-metrics-definitions-formulas-dashboards | 2026-02-10 |
| 20 | Cekura orchestration benchmark / comparison page — https://www.cekura.ai/blogs/hamming-alternative | 2026-09-04 |
| 21 | ElevenLabs agent testing docs — https://elevenlabs.io/docs/eleven-agents/customization/agent-testing | accessed 2026-10-20 |
| 22 | Arize, tracing and evaluating audio — https://arize.com/docs/ax/cookbooks/evaluate/tracing-and-evaluating-audio | accessed 2026-10-20 (post late-2025) |
| 23 | Braintrust LiveKit integration — https://www.braintrust.dev/docs/integrations/livekit-agents | accessed via search 2026-10-20 |
| 24 | Langfuse multi-modality — https://langfuse.com/docs/observability/features/multi-modality ; Pipecat integration — https://langfuse.com/integrations/frameworks/pipecat (changelog 2025-05-29) | accessed 2026-10-20 |
| 25 | OTel GenAI semantic conventions repo — https://github.com/open-telemetry/semantic-conventions-genai | accessed 2026-10-20 |
| 26 | Full-Duplex-Bench v1 — https://arxiv.org/html/2503.04721v3 | 2025 |
| 27 | Full-Duplex-Bench v1.5 — https://arxiv.org/abs/2507.23159 | 2025-07-30, rev. 2026-04-26 |
| 28 | Full-Duplex-Bench v2 — https://arxiv.org/abs/2510.07838 | 2025-10 (ACL 2026) |
| 29 | Full-Duplex-Bench v3 — https://arxiv.org/abs/2604.04847 | 2026-04-06 |
| 30 | Full-Duplex-Bench GitHub — https://github.com/DanielLin94144/Full-Duplex-Bench | news through 2026-05-20 |
| 31 | Artificial Analysis S2S leaderboard — https://artificialanalysis.ai/speech-to-speech | accessed 2026-10-20 |
| 32 | AA S2S index announcement — https://artificialanalysis.ai/ja/articles/announcing-the-artificial-analysis-speech-to-speech-index | 2026-06-23 |
| 33 | AA S2S methodology — https://artificialanalysis.ai/methodology/speech-to-speech-benchmarking | accessed 2026-10-20 (index v2.0 since Aug 2026) |
| 34 | Sierra τ-Voice blog — https://sierra.ai/blog/tau-voice-benchmarking-real-time-voice-agents-on-real-world-tasks ; paper https://arxiv.org/pdf/2603.13686 | 2026-05-01 / 2026-03 |
| 35 | Scale Audio MultiChallenge leaderboard — https://labs.scale.com/leaderboard/audiomc (arXiv 2512.14865, ACL 2026) | accessed 2026-10-20 |
| 36 | Talk Arena / "Mind the Gap!" — https://arxiv.org/pdf/2502.15919 | 2025-02 (ACL 2025) |
| 37 | VoiceBench — https://arxiv.org/abs/2410.17196v3 | 2024-12 (**possibly stale**) |
| 38 | URO-Bench — https://arxiv.org/abs/2502.17810 | 2025 (EMNLP Findings) |
| 39 | VocalBench — https://arxiv.org/html/2505.15727v3 | 2025 |
| 40 | Big Bench Audio dataset — https://huggingface.co/datasets/ArtificialAnalysis/big_bench_audio | accessed 2026-10-20 |
| 41 | Pipecat Smart Turn — https://github.com/pipecat-ai/smart-turn | v3.2, accessed 2026-10-20 |
| 42 | MDN AudioContext.outputLatency — https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/outputLatency | page 2023, Baseline 2025 |
| 43 | k6 websockets — https://grafana.com/docs/k6/latest/javascript-api/k6-websockets/ | accessed 2026-10-20 |
| 44 | Deepgram redaction — https://developers.deepgram.com/docs/redaction | accessed 2026-10-20 |
| 45 | Presidio — https://presidio.dataprivacystack.org/ | accessed 2026-10-20 |
| 46 | GDPR Art. 4 — https://gdpr-info.eu/art-4-gdpr/ | regulation 2016 |
| 47 | MiniMax-Speech (Seed-TTS eval protocol: WER + WavLM SIM) — https://arxiv.org/pdf/2505.07916 | 2025-05 |
| 48 | Soniqo, voice cloning benchmarks (UTMOS / encoder caveats) — https://www.soniqo.audio/blog/voice-cloning-benchmarks | July 2026 (search snippet) |
| 49 | Stivers et al., "Universals and cultural variation in turn-taking", PNAS — https://doi.org/10.1073/pnas.0903616106 | 2009 (**possibly stale**, foundational; not re-fetched) |
| 50 | ITU-T G.114 one-way transmission time — https://www.itu.int/rec/T-REC-G.114 | 2003 (**possibly stale**; not re-fetched) |
| 51 | Pipecat releases (v1.6.0–v1.13.0) — https://github.com/pipecat-ai/pipecat/releases | Aug–Oct 2026, accessed 2026-10-20 (added in fact-check) |
| 52 | LiveKit Agents releases (1.8.3–1.8.8) — https://github.com/livekit/agents/releases | Sep–Oct 2026, accessed 2026-10-20 (added in fact-check) |
| 53 | Langfuse LiveKit integration — https://langfuse.com/integrations/frameworks/livekit | accessed 2026-10-20 (added in fact-check) |
| 54 | OTel core semconv `docs/gen-ai` move notice — https://github.com/open-telemetry/semantic-conventions/tree/main/docs/gen-ai | accessed 2026-10-20 (added in fact-check) |
| 55 | Coval blog index ("We raised $28M") — https://www.coval.ai/blog | accessed 2026-10-20 (added in fact-check) |
| 56 | τ-Voice arXiv abstract — https://arxiv.org/abs/2603.13686 | 2026-03-14 (added in fact-check) |

---

## Fact-check log (2026-10-20)

Method: each claim was checked against its primary source by fetching the page directly. The shared web-search budget was exhausted before this pass started, so no new search queries were possible. Claims that could only have been confirmed through search are marked **(unverified)** in the body.

**Verdicts:** confirmed = matches the primary source. corrected = the body text was changed. unverifiable = the primary source does not state it, and it is now marked "(unverified)" in the body.

| # | Claim (as originally written) | Verdict | Correction / note | Source |
|---|---|---|---|---|
| 1 | IETF `draft-nygate-ippm-mrl-00`, 2026-09-07. Onset +10 dB / ≥ −50 dBov / 20 ms. 150 ms gap, 2 s window. `mrl-report/1` with n_attempted / n_reported / n_discarded. Individual draft | confirmed | Author is Daniel Nygate. Status Informational, expires 2027-03-11. The sensitive variant is 6 dB / −55 dBov / 10 ms and the strict variant 12 dB / −45 dBov / 30 ms. No -01 yet | https://datatracker.ietf.org/doc/html/draft-nygate-ippm-mrl-00 |
| 2 | Twilio (2025-11-17): mouth-to-ear 1,115 / 1,400 ms. STT 350/500, TTFT 375/750, TTS TTFB 100/250. ConversationRelay p50 491 / p95 713 ms | confirmed | Also gives a platform turn gap of 885 / 1,100 ms. Author is Phil Bredeson | https://www.twilio.com/en-us/blog/developers/best-practices/guide-core-latency-ai-voice-agents |
| 3 | LiveKit `ChatMessage.metrics` fields (`end_of_turn_delay`, `transcription_delay`, `llm_node_ttft`, `tts_node_ttfb`, `playback_latency`, `e2e_latency`) and the formula EOU + TTFT + TTFB | confirmed | `llm_node_ttft` / `tts_node_ttfb` are empty with realtime models. `InterruptionMetrics` fields confirmed | https://docs.livekit.io/testing/observability/data.md |
| 4 | LiveKit 1.7.0 added the `lk.pii.*` prefix (12 attributes). `allow_pii=False`. `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT`. `realtime_inference` span in 1.8.0 | confirmed | The rename also covers about 50 log fields. Newer 1.8.5 and 1.8.7 tracing changes were added to the body | https://docs.livekit.io/deploy/observability/tracing/ ; https://github.com/livekit/agents/releases |
| 5 | LiveKit turn defaults, including `min_consecutive_speech_delay` "0.2–0.4 s when utterances merge" | corrected | The default is **0.0 s** (Python only), and the setting applies to the gap between agent utterances; 0.2–0.4 s is a troubleshooting suggestion. Other defaults are confirmed (0.5 / 3.0 / fixed / 0.5 / 0 / 2.0 + resume). Added that preemptive generation is **on by default** | https://docs.livekit.io/agents/logic/turns/tuning.md |
| 6 | LiveKit adaptive interruption publishes no accuracy numbers | confirmed | Added: minimum SDK versions, on by default only on Cloud/dev mode with a VAD, language-agnostic | https://docs.livekit.io/agents/logic/turns/adaptive-interruption-handling.md |
| 7 | Smart Turn v3.2: ~8M params, Whisper-Tiny base, 23 languages incl. Spanish, BSD-2, 10–100 ms CPU, ~65 ms on Pipecat Cloud | confirmed | No v4 exists. The CPU build is an 8 MB int8 model | https://github.com/pipecat-ai/smart-turn |
| 8 | AA S2S leaderboard: Grok Voice 3.0 86.9, GPT-Live-1 Astra medium 83.2, Gemini 3.8 Live Extended Thinking 82.6. Index v2.0 since Aug 2026 | confirmed | Model names and scores are confirmed. Version history v1.0 → v1.1 → v2.0 added | https://artificialanalysis.ai/speech-to-speech ; https://artificialanalysis.ai/methodology/speech-to-speech-benchmarking |
| 9 | AA cost per hour of input audio "~$0.8 to $4+" | corrected | Actual range is ~$0.84 (Gemini 3.8 Live) to $10.75 (GPT-Realtime-2.1 High) and $11.44 (GPT-Realtime-1.5). Some $0.00 rows are anomalies | https://artificialanalysis.ai/speech-to-speech |
| 10 | June 2026 AA snapshot: "high" TTFA 2.3–3.0 s vs ~0.8 s for non-reasoning. Used in §9 as the TTFA to expect | corrected (outdated) | The June figures are confirmed: 2.33 s (GPT-Realtime-2 High) and 2.98 s (Gemini 3.1 Flash Live High). The 0.82 s figure is GPT-Realtime-1.5, which is not labelled non-reasoning. In October 2026 GPT-Realtime-2 High is at 1.14 s and the top reasoning entries at 1.34–1.35 s | https://artificialanalysis.ai/articles/announcing-the-artificial-analysis-speech-to-speech-index ; https://artificialanalysis.ai/speech-to-speech |
| 11 | Original AA index (2026-06-23): 3 equal parts, GPT-Realtime-2 (High) leads at 77.2% | confirmed | — | https://artificialanalysis.ai/articles/announcing-the-artificial-analysis-speech-to-speech-index |
| 12 | τ-Voice: 278 tasks. 30% (gpt-realtime-1.0, Aug 2025) → 67% (grok-voice-think-fast-1.0, Apr 2026). ≈79% of text. 200 ms ticks, policy every 2 s | confirmed | arXiv date 2026-03-14. Caller simulator is GPT-4.1. Accents come from TTS | https://sierra.ai/blog/tau-voice-benchmarking-real-time-voice-agents-on-real-world-tasks ; https://arxiv.org/abs/2603.13686 |
| 13 | Audio MultiChallenge: 452 conversations / 47 speakers / 1,712 rubrics. Top ≈60% (Gemini 3.8 Flash high). Best audio-output ≈35–36%. Voice Editing 18%. ACL 2026 | confirmed except venue → unverifiable | Scores confirmed (60.40; best † 36.06 / 34.73; 17.99%). arXiv lists no venue, so ACL 2026 is unverified. gpt-realtime-2 (xHigh) at 48.45 has unlabelled modality | https://labs.scale.com/leaderboard/audiomc ; https://arxiv.org/abs/2512.14865 |
| 14 | FDB v1 results: Freeze-Omni pause TOR 0.48–0.64 "but 1.4 s latency" | corrected | Freeze-Omni turn-taking latency is 0.953 s. 1.409 s is its post-interruption latency. Moshi and Gemini Live figures confirmed | https://arxiv.org/html/2503.04721v3 |
| 15 | FDB v1.5 accepted at ICASSP 2026. FDB v2 at ACL 2026 (short) | confirmed / "short" unverifiable | Both acceptances confirmed in the arXiv comments; "short" is not stated | https://arxiv.org/abs/2507.23159 ; https://arxiv.org/abs/2510.07838 |
| 16 | FDB v3 (arXiv 2604.04847, 2026-04-06) "released 2026-05-20". GPT-Realtime Pass@1 0.600. Cascade 10.1 s | confirmed (clarified) | 2026-05-20 is the code and data release; the paper came out in April. Cascade latency is 10.12 s. No v4 | https://arxiv.org/abs/2604.04847 ; https://github.com/DanielLin94144/Full-Duplex-Bench |
| 17 | Big Bench Audio: 1,000 questions, 4 categories, 23 voices, MIT. v1.2 harness since May 2026. Top ≈97–99% | confirmed except top-score range → unverifiable | v1.2 confirmed on the AA methodology page (the HF card has no version). Earlier harness judges (Sonnet 3.5 → Sonnet 4.6) added. The top-score range was not re-checked | https://huggingface.co/datasets/ArtificialAnalysis/big_bench_audio ; https://artificialanalysis.ai/methodology/speech-to-speech-benchmarking |
| 18 | Talk Arena / "Mind the Gap" (ACL 2025): 7,500 votes from 484 users. Kendall τ ≤ 0.33, R² 0.30 | confirmed numbers; venue unverifiable | The abstract says 7,500 LAM *interactions* from 484 participants. The venue is not stated on arXiv or talkarena.org | https://arxiv.org/abs/2502.15919 ; https://talkarena.org/ |
| 19 | Vapi: "Legacy Test Suites are deprecated" | unverifiable | Current docs (and the old test-suites URL) describe only Evals and Simulations and contain no deprecation notice | https://docs.vapi.ai/observability/simulations-overview ; https://docs.vapi.ai/test/test-suites |
| 20 | ElevenLabs agent tests: Next Reply, Tool Call, `repeat_count` 2–20, 100% / ≥80% / <80% colours, tests from past conversations | confirmed | Missed **Simulation** tests (multi-turn, 1–50 turns, default 5); now added | https://elevenlabs.io/docs/eleven-agents/customization/agent-testing |
| 21 | Pipecat Evals: `pipecat eval run`, YAML scripted/simulated, text and audio modes, local Kokoro/Moonshine/Whisper, Ollama judge, latency budgets, S2S audio-only | confirmed | Newer v1.8–v1.13 eval features added | https://docs.pipecat.ai/pipecat/evals ; https://github.com/pipecat-ai/pipecat/releases |
| 22 | Pipecat OTel turn attribute `turn.user_bot_latency_seconds` | unverifiable | Not listed on the OTel page. `turn.type` and `conversation.id` are. Added the v1.6.0 GenAI attribute renames | https://docs.pipecat.ai/server/utilities/opentelemetry |
| 23 | Pipecat TTFAT = TTFB + thinking; TTFA = TTFB + leading silence; `text_aggregation`; `on_first_bot_speech_latency`; VAD `stop_secs` adjustment | confirmed | `on_first_bot_speech_latency` is on the UserBotLatencyObserver page, not the metrics page | https://docs.pipecat.ai/guides/fundamentals/metrics ; https://docs.pipecat.ai/server/utilities/observers/user-bot-latency-observer |
| 24 | Pipecat guide: ≈1.2–1.3 s example, 1,500 ms target, ~500 ms co-located, "8/10 vs 9.99/10" probabilistic evals | confirmed | The table sums to 1,293 ms (the text says ~1,200). 500 ms is a "demonstrated" result. Missing network and packet-handling rows added | https://voiceaiandvoiceagents.com/ |
| 25 | Hamming: "TTFW <300 excellent, <500 good, <800 acceptable"; e2e p90 <2.5 / p95 <3.5 s; alert p95 >5 s; WER condition bands; jitter stdev <100 ms; TTS suppression <200 ms; scenario mix; >3% / >10% deploy blocks | corrected (bands) / rest confirmed | The Jan 24 post uses TTFA bands of <300 / 300–800 / 800–1,500. The Feb 10 TTFW bands are <300 natural, 300–500 acceptable, 500–800 noticeable, >800 breakdown. The other numbers are confirmed in one of the two posts | https://hamming.ai/blog/how-to-evaluate-voice-agents-2026 ; https://hamming.ai/blog/voice-agent-analytics-post-call-metrics-definitions-formulas-dashboards |
| 26 | Coval load-test methodology (2026-03-07): phases, pass criteria p50 <800 / p95 <2 s / p99 <4 s, jitter <30 ms, loss <0.5%, 600 ms → 8 s, LLM queuing is the first bottleneck | confirmed | Phase 5 scales to 10,000 concurrent calls | https://www.coval.ai/blog/voice-load-testing-methodology |
| 27 | Coval benchmarks repo: every 30 min from us-east-1, −20 dBFS RMS, SHA-256 pinning, Whisper EnglishTextNormalizer, TTFS from a shared VAD anchor, TTFA incl. silence | confirmed | — | https://github.com/coval-ai/benchmarks |
| 28 | Coval $28 M Series A, June 2026 | amount confirmed; date unverifiable | The Coval blog shows "We raised $28M" with no date | https://www.coval.ai/blog |
| 29 | Cekura pricing $0.25 per test minute, $0.05 per monitored call; runs its own orchestration benchmark (2026-09-04) | confirmed | Benchmark details added | https://www.cekura.ai/blogs/hamming-alternative |
| 30 | OTel GenAI semconv moved to `open-telemetry/semantic-conventions-genai` | confirmed | The core repo shows a "have moved" notice. The new repo's schema URL is "TODO", and it has no audio/voice convention | https://github.com/open-telemetry/semantic-conventions/tree/main/docs/gen-ai ; https://github.com/open-telemetry/semantic-conventions-genai |
| 31 | Langfuse/LiveKit needs the `x-langfuse-ingestion-version` header or spans take up to 10 min | unverifiable | Not on the current Langfuse LiveKit page. Flush-on-shutdown confirmed | https://langfuse.com/integrations/frameworks/livekit |
| 32 | Langfuse: Pipecat trace = whole conversation; audio attachments in S3-compatible storage, SHA-256 dedup, 1 GB self-hosted limit | confirmed | The limit is set with `LANGFUSE_S3_MEDIA_MAX_CONTENT_LENGTH` | https://langfuse.com/integrations/frameworks/pipecat ; https://langfuse.com/docs/observability/features/multi-modality |
| 33 | Arize cookbook uses `gpt-audio-mini`; 32k-char base64 cap; `OPENINFERENCE_HIDE_INPUT_AUDIO` | confirmed | The env var is `OPENINFERENCE_BASE64_AUDIO_MAX_LENGTH` | https://arize.com/docs/ax/cookbooks/evaluate/tracing-and-evaluating-audio |
| 34 | k6: `k6/experimental/websockets` deprecated in favour of `k6/websockets`; global event loop; `binaryType = "arraybuffer"` | confirmed | — | https://grafana.com/docs/k6/latest/javascript-api/k6-websockets/ |
| 35 | Deepgram redaction English-only, Flux numbers-only, "applies to transcripts, not the audio itself" | corrected (nuance) | Non-English: numbers only. Flux rejects `pci`/`pii` with HTTP 400. The docs do not address audio at all, so "transcript-only" is an inference | https://developers.deepgram.com/docs/redaction |
| 36 | Presidio "now community-owned under the Data Privacy Stack" | corrected | The page says it is *transitioning* to a community-owned project. The disclaimer quote is confirmed | https://presidio.dataprivacystack.org/ |
| 37 | MDN `AudioContext.outputLatency` is Baseline 2025 newly available | confirmed | Baseline since March 2025 | https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/outputLatency |

**Newer developments added in this pass:**
- Eleven Realtime v1 (Max/Mini) as an ElevenLabs S2S entry on AA.
- GPT-Realtime-2.1, Gemini 3.8 Live, Qwen Audio 3.0 Realtime and StepAudio 3 Realtime on AA.
- AA Speech Agent Arena, and Conversational Dynamics saturation.
- Pipecat v1.6–v1.13: GenAI attribute renames, `metrics.audio_seconds`, `LatencyBreakdown.contributions`, eval-suite dashboard, audio-file user turns.
- LiveKit Agents 1.8.5–1.8.8: tracing changes and realtime e2e latency.
- LiveKit preemptive generation is on by default.
- ElevenLabs Simulation tests.

**Not checked (search budget exhausted):**
- Stivers 2009 and ITU-T G.114 (foundational).
- Soniqo and the Braintrust snippet.
- The Dasha blog.
- The Big Bench Audio top-score range.
- Vendor zero-retention terms (already flagged as not researched).
