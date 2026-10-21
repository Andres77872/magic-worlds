# R02: Turn-taking (VAD, end-of-turn detection, barge-in and interruption handling)

Research notes for the Magic Worlds realtime voice-call report. Compiled 2026-10-20.

**Method and caveats**
- Sources are primary wherever possible: vendor docs, changelogs, model cards, GitHub READMEs and arXiv. Each source carries a date, or is marked "accessed 2026-10-20" when the page shows none.
- Numbers that come from a vendor about its own product are marked **(vendor-reported)**.
- **eot-bench**, the most complete public end-of-turn (EoT) leaderboard, is built and run by LiveKit, which also has the top entry. It is open and reproducible, but it is still a vendor-run benchmark.
- Krisp's comparison tables are likewise run by Krisp.
- The shared web-search budget for this workflow ran out partway through. Later facts were checked by fetching known primary URLs directly. A few items are marked *unverified* where no primary source could be read, mainly browser AEC coverage of Web Audio playback.
- **Fact-checked 2026-10-20** against primary pages (see the log at the end). The fact-check also had no web-search budget left, so it found newer releases by fetching vendor docs directly. A release that no fetched page mentions could still have been missed.

---

## 0. TL;DR

1. **Fixed silence timeouts are a poor tradeoff.** On eot-bench (English) a silence-only VAD baseline is the worst entry:
   - 55.6% false cut-offs at a 300 ms budget, and 21.7% at 600 ms.
   - 1,600 ms of dead air needed to keep false cut-offs at 5%.
   - Learned EoT models reach 4.5–12% false cut-offs at 600 ms, and 543–1,150 ms at 5% ([eot-bench](https://github.com/livekit/eot-bench), 2026).
2. **RMS/energy VAD is the weakest acoustic layer.** A Google study (Jan 2026) measured peak MCC for:
   - RMS: 0.11. The authors (Google LLC) say it "underperforms random guessing for most of its range."
   - WebRTC VAD: 0.41.
   - Silero: 0.72 ([arXiv 2601.17270](https://arxiv.org/abs/2601.17270)).
   - Magic Worlds' browser worklet VAD is RMS with an adaptive noise floor.
3. **2025–2026 SOTA is audio-native or fused audio+semantic EoT models.** They decide in roughly 10–50 ms after a short (200–300 ms) VAD pause:
   - LiveKit Turn Detector v1 / v1-mini (Jun 2026)
   - Pipecat Smart Turn v3.2 (Jan 2026)
   - Krisp Turn Prediction v3 (May 2026)
   - p99lab turn-1-mini (Oct 2026)
   - STT-integrated detectors: Deepgram Flux / Flux Multilingual, AssemblyAI Universal-3.6 Pro, Soniox, Kyutai STT semantic VAD, NVIDIA Parakeet-EOU.
   - Text-only EoT models are being phased out in favour of audio models. LiveKit's multilingual text model is deprecated and slated for removal in Agents 2.0. Whether Speechmatics' SLM approach is also deprecated is unverified.
4. **Spanish is supported by most of them, but accuracy is lower.** Smart Turn v3 reports 91.97% accuracy for Spanish against 94.31% for English. LiveKit's v0.4.1 text model cut Spanish errors by 33.9%. Flux Multilingual (`flux-general-multi`, 10 languages including `en` and `es`) launched on 2026-04-29.
5. **Barge-in is now its own modelling problem: interruption vs backchannel.**
   - VAD-only barge-in fires on about 66% of backchannels (Krisp test set, vendor-reported).
   - Krisp Interruption Prediction v1 cuts that to 5.9% false positives with 0.83 s mean interruption time.
   - LiveKit adaptive interruption reports 86% precision / 100% recall at 500 ms overlap, and rejects 51% of VAD barge-ins (vendor-reported).
   - A "≥3 words" rule is accurate (balanced accuracy 0.948) but slow (1.53 s).
6. **Barge-in should be recoverable.** Pause or duck the audio on suspicion, confirm with words or a model, and resume if it was a cough or backchannel. LiveKit ships this by default (`false_interruption_timeout=2.0 s`, `resume_false_interruption=True`).
7. **Truncate the assistant turn to what was actually heard** (word-level timestamps), and say so to the LLM.
   - OpenAI Realtime over WebSocket: the client must send `conversation.item.truncate` with `audio_end_ms`.
   - Gemini Live: discards un-sent generation.
   - Pipecat: commits only TTS text frames that were played.

---

## 1. Why fixed silence timeouts are a bad tradeoff

A silence timeout treats every pause the same. The hard case is the pause *inside* a turn: thinking, listing, saying a number, or a Spanish speaker's "este…". With a fixed threshold you choose one point on a single curve:

- **Short timeout (300–500 ms):** fast replies, but frequent cut-offs.
  - eot-bench VAD baseline: **55.6% false cut-offs at 300 ms** and 21.7% at 600 ms ([eot-bench README](https://github.com/livekit/eot-bench), 2026).
  - Google's Gemini Live guide warns that `silenceDurationMs` around 100–200 ms "split utterances and reduce quality". It recommends 500–800 ms; the server default is about 800 ms ([Gemini Live guide](https://ai.google.dev/gemini-api/docs/live-guide), accessed 2026-10-20).
- **Long timeout (1–2 s):** few cut-offs, but every reply carries that dead air.
  - The eot-bench VAD baseline needs **1,600 ms** to reach a 5% false cut-off rate and 1,000 ms for 10%.
  - LiveKit Turn Detector v1 reaches the same budgets at 543 ms and 295 ms.
- **The underlying problem:** "VAD knows when there's speech and when there isn't. What it doesn't know is why there's a pause" ([Speechmatics, 2025-05-12](https://blog.speechmatics.com/semantic-turn-detection)).
- **Prosody and semantics carry the information.** LiveKit's v1 write-up gives the example "I would like to order one large pizza…": the transcript is identical whether or not the speaker continues, and only the delivery differs ([LiveKit, 2026-06-17](https://livekit.com/blog/solving-end-of-turn-detection)).
- **The established pattern:**
  1. A cheap acoustic VAD with a *short* hangover (200–300 ms) proposes a candidate end of turn.
  2. A learned EoT model decides "complete vs hold".
  3. A max-silence backstop (2–3 s) forces the turn closed.
- **Framework defaults reflect this pattern:**
  - Pipecat recommends VAD `stop_secs=0.2` with Smart Turn deciding ([Pipecat docs](https://docs.pipecat.ai/server/utilities/turn-detection/smart-turn-overview)).
  - LiveKit defaults to `min_delay=0.3 s` / `max_delay=2.5 s` with the audio detector, and requires VAD `min_silence_duration ≥ 0.25 s` ([LiveKit turn detector docs](https://docs.livekit.io/agents/logic/turns/turn-detector)).
  - AssemblyAI: `min_turn_silence` 400 ms (semantic) / `max_turn_silence` 1,280 ms (acoustic fallback) in the Universal-Streaming "balanced" preset ([AssemblyAI docs](https://www.assemblyai.com/docs/streaming/universal-streaming/turn-detection)).
  - Pipecat's default stop strategy is now `LocalSmartTurnAnalyzerV3` (as of v0.0.102). `SmartTurnParams.stop_secs` (default 3.0 s) is the silence backstop that forces a turn complete. The plain `SpeechTimeoutUserTurnStopStrategy` defaults to `user_speech_timeout=0.6` s.

**Magic Worlds today.** Turns end after a fixed 550 ms of RMS silence (`vad: { silenceMsToEnd: 550, minSpeechMs: 250 }` in `src/features/call/components/CallScreen.tsx`). The server mitigates breath pauses by merging a cut segment with its continuation while the first turn has not been admitted ("supersede"). That is a useful repair mechanism, but it is a reactive patch on a fixed-timeout endpoint, not a turn decision.

---

## 2. Acoustic VAD layer

### 2.1 Options

| VAD | Type / size | Latency / compute | Accuracy evidence | Browser use | License |
|---|---|---|---|---|---|
| **Silero VAD v6.x**: v6.0 2025-08-26, v6.1 2025-11-05, v6.2 2025-11-06, v6.2.1 2026-02-24, v6.2.2 2026-09-17, v6.2.3 2026-09-23 (latest; no v7) ([releases](https://github.com/snakers4/silero-vad/releases)) | Small RNN, about 2 MB JIT/ONNX; 8 and 16 kHz; 30+ ms chunks (512 samples at 16 kHz is typical) | "<1 ms per chunk on one CPU thread" (vendor) | v6.0: "16% less errors on noisy real-life data" and 11% fewer on multi-domain validation vs v5 (vendor). v6.2 improves child, cartoon, muted and phone-quality voices. Weak spots: music with voice-like instruments, very high-pitched voices. Google: MCC 0.72 vs WebRTC 0.41 vs RMS 0.11 ([arXiv 2601.17270](https://arxiv.org/abs/2601.17270), 2026-01-24, independent) | `@ricky0123/vad-web` (onnxruntime-web 1.22) ships `silero_vad_legacy`, `_v5` and `_v6` ONNX files ([repo](https://github.com/ricky0123/vad)) | MIT |
| **TEN VAD** (Agora / TEN framework) | about 277 KB WASM lib; 16 kHz; 10 or 16 ms hop | RTF 0.0086 vs Silero 0.0127 on a Xeon 6348; Web on M1 RTF 0.010 (vendor) | Vendor PR curves beat Silero and WebRTC. Third-party rerun at threshold 0.5: TEN P 0.942 / R 0.915; Silero P 0.938 / R 0.938; WebRTC P 0.821 / R 0.983 ([wavekat-vad](https://docs.rs/wavekat-vad)). Claims a faster speech-to-silence transition than Silero ("several hundred ms" Silero lag, vendor) | Official WASM + JS (since 2025-06; build guide and demo 2025-11) ([repo](https://github.com/TEN-framework/ten-vad)) | Apache-2.0 **plus extra conditions**: may not be deployed in a way that "competes with Agora's offerings", and is permitted only for your own applications ([LICENSE](https://huggingface.co/TEN-framework/ten-vad/blob/main/LICENSE)). Needs legal review |
| **WebRTC VAD** (GMM) | Tiny, 10/20/30 ms frames | Negligible | Lowest of the learned options: 50% TPR at 5% FPR (Picovoice, vendor-run); MCC 0.41 (Google) | Built into libwebrtc; JS ports exist | BSD |
| **Picovoice Cobra** | Proprietary | RTF 0.000399 (C SDK) / 0.00171 (Python SDK) (vendor, 2026-01 update) | **Vendor-run:** TPR at 5% FPR is 98.9% for Cobra vs 87.7% for Silero (version unstated) vs 50% for WebRTC. At 1% FPR: 95% vs 80.4% ([Picovoice, 2025-11-12, upd. 2026-01-23](https://picovoice.ai/blog/best-voice-activity-detection-vad/)) | WASM SDK | Commercial; AccessKey required |
| **RMS / energy gate** (current Magic Worlds worklet) | None | Free | MCC 0.11; "underperforms random guessing for most of its range" (Google, independent) | Trivial | n/a |

**Takeaways**
- Use a learned VAD as the acoustic layer: Silero v6 is the safe open default; TEN VAD is smaller and faster but carries the license caveat.
- Treat VAD as a **speech-presence** detector, never as a turn decision.
- In the Google study, hysteresis helped WebRTC VAD (+0.06 MCC, 0.41 → 0.47) but not Silero (0.72 → 0.71) or RMS (0.11 → 0.10).
- Larger averaging windows *reduce* ROC AUC and AP, so smoothing over long windows is not free.

### 2.2 Browser-side considerations
- Running Silero in an `AudioWorklet`: the worklet feeds 512-sample frames to a Worker running onnxruntime-web (WASM or SIMD), or runs in the worklet directly if the bundle allows it.
  - `@ricky0123/vad-web` already wraps this, with pre-speech padding, positive/negative thresholds and a redemption (hangover) period.
  - TEN VAD ships its own WASM.
- The VAD must see **post-AEC** audio (the `getUserMedia` processed track). Otherwise the agent's own voice from the speakers registers as speech (see §6.3).
- A two-tier VAD is common in practice:
  - Client VAD gates uploads and bandwidth, and gives instant UI and barge-in feedback.
  - The server re-runs a learned VAD and EoT model on the received audio for the authoritative decision.
  - Gemini Live calls this "hybrid VAD": client end-of-speech finalizes the turn early while server VAD remains a fallback ([Gemini Live guide](https://ai.google.dev/gemini-api/docs/live-guide)).

---

## 3. Semantic / learned end-of-turn detection

### 3.1 Taxonomy
1. **Text-based EoT.** A small LM reads the running transcript and scores P(end of turn).
   - Examples: LiveKit's multilingual text model (Qwen2.5-0.5B, now **deprecated** and slated for removal in Agents SDK 2.0; the SDK is at 1.8.x); Speechmatics' SmolLM2-360M `<|im_end|>` probability approach.
   - Needs streaming STT partials and is blind to prosody.
2. **Audio-native EoT.** A classifier on the raw waveform of the current turn.
   - Examples: Smart Turn v3.x (Whisper-tiny encoder + linear head), Krisp TP v3, p99lab turn-1-mini, LiveKit v1-mini.
3. **Fused audio + semantic.** LiveKit Turn Detector v1 combines an audio encoder, an adapter into a fine-tuned LLM, and a recurrent acoustic branch, joined by a fusion head ([LiveKit, 2026-06-17](https://livekit.com/blog/solving-end-of-turn-detection)).
4. **Context-aware audio LLM.** ultraVAD (Llama-8B + Ultravox audio projector) scores P(`<eot>` | dialog history, last user audio). It uses the agent's previous question as context and supports 26 languages ([Ultravox, 2025-09-09](https://ultravox.ai/blog/context-aware-audio-native-endpointing-how-we-built-ultravad)).
5. **STT-integrated EoT.** The streaming recognizer emits turn events itself.
   - Examples: Deepgram Flux (`StartOfTurn` / `EagerEndOfTurn` / `TurnResumed` / `EndOfTurn`), AssemblyAI Universal-Streaming / Universal-3.6 Pro, Speechmatics EndOfUtterance, Soniox, Kyutai STT (pause-prediction head), NVIDIA Parakeet-Realtime-EOU (`<EOU>` token).
6. **LLM-gated completion.** The main LLM's first token is a completeness marker; incomplete turns are suppressed and re-prompted after a timeout. Pipecat implements this as `FilterIncompleteUserTurnStrategies` (config `UserTurnCompletionConfig`) with markers `●` complete / `◐` incomplete-short / `○` incomplete-long and `incomplete_short_timeout` 5.0 s / `incomplete_long_timeout` 10.0 s ([Pipecat docs](https://docs.pipecat.ai/api-reference/server/utilities/turn-management/filter-incomplete-turns)). The old `filter_incomplete_user_turns` flag on `LLMUserAggregatorParams` is deprecated and goes away in Pipecat 2.0.0. Pipecat also lists an `LLMTurnCompletionUserTurnStopStrategy` stop strategy.
7. **Full-duplex / VAP-style.** The model continuously predicts both speakers' future voice activity ([Voice Activity Projection, Ekstedt & Skantze, 2022](https://arxiv.org/abs/2205.09812); older than 12 months but foundational). Native duplex S2S models such as Moshi have no explicit EoT at all.

### 3.2 Leading options (2025–2026)

| Option | Kind | Langs (es?) | Latency / size | Published quality | Availability / license |
|---|---|---|---|---|---|
| **LiveKit Turn Detector v1** (2026-06-17) | Fused audio + LLM | 14 incl. **es** | Inference not disclosed; free on LiveKit Cloud | eot-bench EN: FC 9.9% @300 ms, 4.5% @600 ms; latency 543 ms @5% FC, 295 ms @10% (vendor-run benchmark) | LiveKit Inference only (cloud); free for agents hosted on LiveKit Cloud. Self-hosted/local: 7,500 free requests per month for development, then billed per request on the Ship and Scale plans. Build-plan sessions fall back to v1-mini at the limit |
| **LiveKit v1-mini** | Same architecture, pruned and quantized, CPU | 14 incl. es | "Significantly" lower latency than v1 | EN: FC 27.8% @300 / 12.1% @600; 1,070 ms @5%, 698 ms @10%. One third-party user reports near-chance results (AUC 0.565) on their own Romanian telephony data, a language outside training, against ≥0.79 AUC on all 14 benchmark languages. The issue is open with no maintainer reply ([issue #14](https://github.com/livekit/eot-bench/issues/14), 2026-09-05) | Bundled in Agents SDK ≥ 1.6.1 (Py) / 1.4.7 (TS). Code Apache-2.0; weights under the "LiveKit Model License" |
| LiveKit multilingual *text* model v0.4.1-intl (2025-12-12) | Text, Qwen2.5-0.5B-Instruct distilled from a Qwen2.5-7B-Instruct teacher | 14 incl. es | 50–160 ms per turn on CPU, <500 MB RAM (unverified: not in the 2025-12-12 blog) | FPR at a fixed TPR of 99.3%: 18.66% → 11.34% overall (−39%); **Spanish 21.50% → 14.00% (−33.9%)** ([blog](https://livekit.com/blog/improved-end-of-turn-model-cuts-voice-ai-interruptions-39)). English FPR 13.00% (≈87% TNR, derived) | Open weights; **deprecated**, slated for removal in Agents SDK 2.0 (not yet released; current 1.8.x) |
| **Pipecat Smart Turn v3.2** (v3 2025-09-11; v3.2 2026-01-07) | Audio-native, Whisper-tiny encoder + linear head, about 8M params, ≤8 s input | **23** incl. es | CPU int8 8 MB: 12.6 ms (c7a.2xlarge) to 94.8 ms (t3.medium); GPU 3–7 ms | v3 test set: EN 94.31%, **ES 91.97%** (FP 4.48%, FN 3.55%). v3.2: 40% fewer misclassified short utterances ("yes", "okay"); trained with cafe/office noise. eot-bench EN: FC 35.2% @300 / 14.8% @600; 1,051 ms @5%. Krisp-run: balanced accuracy 77.4% | **BSD-2-Clause**; weights, data and training code open; ONNX ([HF](https://huggingface.co/pipecat-ai/smart-turn-v3)) |
| **Krisp Turn Prediction v3** (blog "Updated May 2026"; exact 2026-05-06 date unverified) | Audio-native, frame-streaming, about 9M params, 30 MB, CPU (`krisp-viva-tp-v3`) | 12+ incl. **es** | Frame-by-frame (no batch after the pause) | Share of true shifts detected ≤200 ms: 0.69 (v2: 0.47 at FPR 0.11) at FPR 0.10. Balanced accuracy 88.05 / AUC 94.58 (87.85 / 94.09 with Krisp background-voice cancellation) vs Flux 87.10, Smart Turn v3.2 77.41, LiveKit text 82.70 (Krisp-run, English test set) | Commercial Krisp VIVA SDK licence + API key; integrations in Pipecat and jambonz |
| **p99lab turn-1-mini** (v1.2.3, Oct 2026) | Audio-only streaming, 5.3M params; 5.4 MB int8 safetensors (7.0 MB int8 ONNX) | **English only** | 1.29 ms median per 160 ms step on one M4 Pro core (p95 1.45 ms) | eot-bench EN (validation split): FC 22.6% @300 / 9.6% @600; 849 ms @5%, 581 ms @10% (self-scored, 95% CIs overlap v1-mini) | **Apache-2.0** ([HF](https://huggingface.co/p99lab/turn-1-mini)) |
| **Deepgram Flux** `flux-general-en` (2025-10-01) / **Flux Multilingual** `flux-general-multi` (2026-04-29) | STT-integrated EoT | `flux-general-multi` is one model covering 10 languages: en, **es**, fr, de, hi, ru, pt, ja, it, nl. It handles mid-sentence code-switching and takes a `language_hint` bias | Quickstart docs: "~260ms end-of-turn detection". Launch blog: EoT p90 1 s / p95 1.5 s; `EagerEndOfTurn` arrives 150–250 ms before `EndOfTurn`. Multilingual press release: EoT decisions "under 400 milliseconds" | Vendor: about 30% fewer false interruptions and 200–600 ms lower agent latency vs pipeline approaches. eot-bench EN: FC 12.9% @300 / 9.9% @600; 1,151 ms @5%; 548 ms @10% | Hosted or self-hosted. Same price for multi and EN (unverified: the press release mentions only a promotional rate). `eot_threshold` 0.5–1.0 (default 0.7); `eager_eot_threshold` 0.3–0.9 (default unset, so eager mode is off); `eot_timeout_ms` default 5,000 |
| **AssemblyAI** Universal-Streaming / **Universal-3.6 Pro** Realtime (`speech_model: "universal-3-6-pro"`, the default; blog 2026-09-30) | STT-integrated semantic + acoustic | U-3.6 Pro: 32 languages with native code-switching. U-3.5 Pro: 19. `universal-streaming-multilingual`: en, es, de, fr, pt, it, switching per turn. The notes' `language_codes:["en","es"]` parameter is not in current docs (unverified) | Vendor: median 307 ms from stop to final formatted transcript (Pipecat STT benchmark) | eot-bench (AssemblyAI entry): FC 49.4% @300 / 14.6% @600; 1,049 ms @5%. Entity-aware holds for phone numbers, codes and emails | Hosted. Universal-Streaming presets (`end_of_turn_confidence_threshold` / `min_turn_silence` / `max_turn_silence`): aggressive (0.4 / 160 / 400 ms), balanced (0.4 / 400 / 1,280), conservative (0.7 / 800 / 3,600). U-3.6 Pro uses a `mode` parameter instead; `end_of_turn_confidence_threshold` is deprecated there. Mid-stream `UpdateConfiguration` takes effect without reconnecting. `ForceEndpoint` message |
| **Soniox** | STT-integrated | Multilingual | n/a | eot-bench EN: FC 5.5% @600 ms; 647 ms @5%; 512 ms @10% (could not reach a 300 ms budget) | Hosted |
| **Speechmatics** | STT EndOfUtterance (silence after last word) + semantic option in Flow / voice SDK | Many | Silence trigger 0–2 s (0 disables); recommended 0.5–0.8 s for voice AI | No public EoT metrics found | Hosted; `ForceEndOfUtterance` for client-side turn detection ([docs](https://docs.speechmatics.com/speech-to-text/realtime/end-of-turn)). **New:** silence-based EndOfUtterance works on the Enhanced and Standard tiers only. The newer **Melia 1** model rejects the setting, so it needs client-side detection (VAD / EoT model) plus `ForceEndOfUtterance` |
| **Kyutai STT** semantic VAD (2025) | Pause-probability head inside streaming STT | `stt-1b-en_fr` (EN/FR only) | 0.5 s STT delay; "flush trick" processes the buffer at about 4× realtime, so about 125 ms instead of 500 ms | No public metrics | Open weights; semantic VAD only in the Rust server ([kyutai.org/stt](https://kyutai.org/stt)) |
| **NVIDIA Parakeet-Realtime-EOU-120m-v1** | Streaming RNNT emitting `<EOU>` | **English only** | EOU latency p50 160 ms, p90 280 ms, p95 320 ms (on TTS-generated DialogStudio audio, vendor) | WER 9.30% (160 ms streaming) | NVIDIA Open Model License ([HF](https://huggingface.co/nvidia/parakeet_realtime_eou_120m-v1)) |
| **ultraVAD** (2025-09-09) | Context-aware audio LLM (Llama-8B) | 26 | GPU; runs speculatively alongside the LLM. The reply "usually arrives before the first TTS packets" (about 500 ms budget) | eot-bench EN: FC 27.7% @300 / 11.9% @600; 899 ms @5% | Open weights (HF `fixie-ai/ultraVAD`); licence not stated on the HF card or in the blog (unverified) |
| **OpenAI Realtime `semantic_vad`** | Classifier inside the S2S service | Model languages | `eagerness` low / medium (auto) / high have max timeouts of **8 s / 4 s / 2 s** ([openai-python types](https://github.com/openai/openai-python/blob/main/src/openai/types/realtime/realtime_audio_input_turn_detection.py)) | eot-bench EN, "OpenAI GPT Realtime 2": 1,143 ms @5% FC, 824 ms @10%. The newer `gpt-realtime-2.1` claims better silence, noise and interruption handling than GPT-Realtime-2 but is not on eot-bench | Only inside OpenAI Realtime |
| **Gemini Live** automatic activity detection | Server VAD with start/end sensitivity enums | Model languages | `silenceDurationMs` default about 800 ms; 500–800 recommended | No metrics | Only inside Gemini Live; can be disabled for manual `activityStart` / `activityEnd` |

Other eot-bench entries ([README](https://github.com/livekit/eot-bench)), all English:
- JoinIn AI Baton: 12.3% / 4.8%; 577 ms @5%.
- VAP (silent agent): 46.9% / 14.6%.
- Gradium: 55.6% / 12.6%.
- Cartesia Ink 2: 1,056 ms @5%.

### 3.3 How the benchmarks measure turn-taking (and why the numbers differ)
- **eot-bench** treats every ≥100 ms silence inside a real user turn as a decision point: "hold" for the mid-turn pauses, "eot" for the final one.
  - It sweeps threshold, `action_delay` and timeout per model, then reports two numbers: false cut-off rate at a fixed latency budget, and latency at a fixed false cut-off budget.
  - Latency here is "conversational dead air, not compute". This is the most product-relevant framing available.
  - Data: `livekit/eot-bench-data`, Apache-2.0, 14 languages incl. Spanish, task-oriented human-to-agent turns.
  - Per-language results exist only in the interactive leaderboard, which could not be retrieved as text.
- **Krisp** (`Krisp-AI/turn-taking-test-v1`): 4 h, 30 speakers, 976 shift and 1,754 hold clips, English. It reports balanced accuracy, AUC, F1, and the fraction of shifts detected within 200 / 400 / 600 ms at a given FPR.
- **Smart Turn**: per-clip accuracy, FP and FN on its own synthetic and human test set. These numbers are not comparable with eot-bench.
- **Deepgram**: precision, recall and F1 against median detection latency, plus its "VAQI" index.
- **Caution:** each vendor ranks first on its own benchmark.
  - Krisp ranks Flux close to TP v3. LiveKit ranks Flux behind v1 but well ahead of Smart Turn and AssemblyAI.
  - Smart Turn v3.2 sits mid-pack on both external benchmarks.
  - **Treat every number as directional** and run an in-domain evaluation (roleplay, EN/ES, browser mics).

### 3.4 Multilingual / Spanish support summary

| Model | Spanish | Evidence |
|---|---|---|
| Smart Turn v3.x | Yes | 91.97% accuracy (EN 94.31%); Spanish is among the weaker European languages |
| LiveKit v1 / v1-mini | Yes | One of 14 languages; per-language figures only in the interactive leaderboard |
| LiveKit text (deprecated) | Yes | −33.9% errors in v0.4.1 |
| Krisp TP v3 | Yes | Listed; no per-language numbers |
| Krisp Interruption Prediction v1 | **No** | English only |
| LiveKit adaptive interruption | Yes (language-agnostic) | Docs: works with any language in most cases, may do better on English |
| Deepgram Flux | Yes (`flux-general-multi`) | Since 2026-04-29; `language_hint` (for example `["en","es"]`) |
| AssemblyAI | Yes | U-3.6 Pro (32 languages, code-switching); `universal-streaming-multilingual` (en, es, de, fr, pt, it). Beta status of the latter unverified |
| ultraVAD | Yes | 26 languages, built by translating the training corpus |
| turn-1-mini, Parakeet-EOU | No | English only |
| Kyutai STT | No | EN / FR |

Text-free audio models generalize somewhat across languages; LiveKit says its adaptive interruption model "generalizes effectively to languages it has never seen before". Accuracy can still collapse on languages missing from training: one user reports AUC 0.565 for v1-mini on Romanian telephony audio (unreviewed issue). **Spanish is covered by every serious multilingual option, but always validate.**

---

## 4. Adaptive endpointing and mid-thought pauses

1. **Dynamic endpointing.**
   - LiveKit `endpointing.mode="dynamic"` adapts the delay inside [min_delay, max_delay] from per-session pause statistics, using an EMA with α=0.9 ([turn handling options](https://docs.livekit.io/reference/agents/turn-handling-options/)). This suits slow or deliberate speakers and roleplayers who "think aloud".
   - Speechmatics' ADAPTIVE mode "adjusts delay based on speech rate, pauses, and disfluencies" (third-party package description).
2. **Context-aware holds.** Lengthen the hold when the agent just asked for something that is spoken in chunks: numbers, names, lists or a story.
   - AssemblyAI recommends raising `min_turn_silence` temporarily (for example to 1,000 ms) with an `UpdateConfiguration` message while collecting entities, then re-applying the mode to restore defaults. Changes take effect without reconnecting ([AssemblyAI, 2026-09-30](https://www.assemblyai.com/blog/turn-detection-endpointing-voice-agent)).
   - ultraVAD uses the prior agent question as context ("My number is 408…" vs "My area code is 408.").
3. **Speculative / eager generation.** Start the LLM on a *tentative* end of turn and discard it if the user resumes.
   - Deepgram `EagerEndOfTurn` + `TurnResumed`: `EagerEndOfTurn` fires 150–250 ms before `EndOfTurn` ([Flux launch blog](https://deepgram.com/learn/introducing-flux-conversational-speech-recognition)), but eager mode "can increase LLM API calls by 50-70%" ([Flux quickstart](https://developers.deepgram.com/docs/flux/quickstart)). The 0.3–0.5 eager-threshold range is from Telnyx docs (unverified).
   - LiveKit `preemptive_generation` is enabled by default. The LLM runs early, TTS starts only after the turn is confirmed (`preemptive_tts=False`), it skips utterances longer than 10 s, and it allows 3 retries per turn.
   - Pipecat `EagerUserTurnStopStrategy` uses `speculation_timeout` 5 s.
   - For an LLM-cost-sensitive product, speculate the LLM only, not TTS, and only when the EoT probability is high-ish.
4. **Backstops.** Always keep a hard max-silence (LiveKit `max_delay` 2.5–3 s; AssemblyAI `max_turn_silence`; Flux `eot_timeout_ms` 5 s default). Also add a "user is still talking" cap (LiveKit `user_turn_limit`).
5. **Short-utterance failure mode** ("yes", "no", "ok").
   - The agent hangs when the STT never returns a final transcript for very short speech, or when `min_words` filters suppress it.
   - LiveKit recommends a `transcription_timeout` (for example 5 s) that asks the user to repeat, and warns that `interruption.min_words` can swallow short answers ([LiveKit, 2026-08-24](https://livekit.com/blog/short-utterances)).
   - Smart Turn v3.2 was specifically retrained for short answers (−40% errors).
6. **LLM-gated incomplete-turn markers.** The cheapest semantic layer if you already run an LLM per turn: the main model emits a completeness marker first and waits silently if the turn is incomplete. It costs one token of latency per turn, but a false "complete" still talks over the user, so it complements an acoustic EoT model rather than replacing it.

---

## 5. Barge-in: detecting real interruptions

### 5.1 Approaches and published numbers

| Method | What it does | Numbers |
|---|---|---|
| VAD-only | Any speech while the agent talks stops it | Krisp test set: **FPR 66.3% on backchannels**, mean interruption time (MIT) 0.375 s; 32% FPR on laughter, cough and sneeze (vendor-run) |
| Minimum duration | Speech must persist N ms | LiveKit default `min_duration=0.5 s`. A practitioner measured +120 ms on their own barge-in path. They cite third-party (Future AGI) research saying a guard adds about 200 ms and cuts false barge-ins by 60–80% ([dev.to, Ken Imoto, Jun 30](https://dev.to/kenimo49/barge-in-is-the-voice-agent-feature-nobody-benchmarks-i-added-it-and-lost-120ms-4o7m), anecdotal) |
| Minimum words (from STT partials) | Interrupt only after ≥N recognized words | Krisp test, 3 words: FPR 3.6%, balanced accuracy 0.948, but **MIT 1.53 s**; 0% FPR on non-verbal sounds. Pipecat `MinWordsUserTurnStartStrategy` (`min_words` required, no default) applies only while the bot is speaking; otherwise one word triggers |
| **Krisp Interruption Prediction v1** (blog "Updated May 2026") | Audio classifier, 6M params, 24 MB, 40 ms frames, **English only** (`krisp-viva-ip-v1`) | Threshold 0.4: FPR **5.9%**, MIT 0.833 s, balanced accuracy 0.906. Threshold 0.7: FPR 2.7%, MIT 1.085 s. 4.5% FPR on non-verbal sounds ([Krisp blog](https://krisp.ai/blog/voice-ai-turn-taking-interruption-prediction/)). **Pipecat integration:** `KrispVivaIPUserTurnStartStrategy` |
| **LiveKit adaptive interruption handling** (2026-03-19) | Audio encoder + CNN on overlap audio after VAD fires | **86% precision / 100% recall** at 500 ms of overlap speech; **rejects 51% of VAD barge-ins**; faster than VAD in 64% of true barge-ins; inference ≤30 ms; median 216 ms of audio to trigger; multilingual (vendor-reported, [blog](https://livekit.com/blog/adaptive-interruption-handling)). It is the default on LiveKit Cloud and in dev mode (Py ≥1.5.0 / TS ≥1.2.0). **Self-hosted agents can opt in** with `interruption.mode="adaptive"`: the model runs on LiveKit Inference with LiveKit API credentials, and usage counts against a dev allowance (40,000 requests per month per the blog). It falls back to VAD when Inference is unavailable or the limit is reached ([docs](https://docs.livekit.io/agents/logic/turns/adaptive-interruption-handling/)) |

**Design notes from these sources**
- **Separate "user started speaking" from "user wants the floor".**
  - A backchannel ("mm-hmm", "ajá", "sí", "vale", "claro", "ok") should *not* stop the agent.
  - It should not become a user turn either: LiveKit drops a confirmed backchannel before the LLM.
  - The Magic Worlds prompt currently tells the LLM to "carry on briefly" when it sees "mm-hm". That only works if the agent was already stopped, which is the worst of both outcomes.
- **Boundary cooldowns.** Near the start and end of an agent turn, a short utterance is often a real answer or correction, not a backchannel. LiveKit therefore applies `backchannel_boundary=(1.0, 1.0)` s, during which plain VAD handles barge-in and late transcripts count as real turns.
- **Score barge-in latency jointly with accuracy.** The practitioner write-up proposes "minimum latency to reach 90% barge-in accuracy" as a joint metric. Most published benchmarks report only response latency.

### 5.2 False-interruption recovery (resume after a false barge-in)
- **LiveKit defaults:** `false_interruption_timeout=2.0 s`, `resume_false_interruption=True`. If VAD stopped the agent but no transcript materializes (cough, noise), the agent **resumes where it left off** ([LiveKit blog, 2026-06-30](https://livekit.com/blog/turn-detection-and-interruption-handling)).
- On noisy lines, repeated phrases often come from pause-and-resume cycles. Adaptive mode, a higher `min_duration` or `min_words`, and noise cancellation help.
- **Duck instead of cut.** On a VAD trigger, lower the TTS gain (for example by about 24 dB) or pause the audio rather than discarding it. Then confirm, or resume if it was a false alarm (dev.to practitioner recommendation).
- Recovery means the client must be able to *pause* playback, not just flush it, and the server must not have cancelled the LLM and TTS stream yet:
  1. **Soft interrupt:** pause or duck audio and hold the server stream.
  2. **Hard interrupt:** cancel the LLM, close the TTS context, truncate, and commit.
  3. **Resume:** unpause.

### 5.3 Echo-triggered false barge-ins
- **Symptom:** the agent's own voice from the speakers leaks into the mic, VAD fires, and the agent interrupts itself (the first failure mode in the practitioner report).
- **Primary fix: AEC.** `getUserMedia` with `echoCancellation: true` uses the browser's canceller.
  - The W3C Media Capture spec now defines modes. `"all"` must try to remove *all* system playout; `"remote-only"` removes only audio from `RTCPeerConnection`s; `true` must cancel at least as much as remote-only and *should* cancel as much as `"all"` ([W3C mediacapture-main](https://w3c.github.io/mediacapture-main/)).
  - Chrome lists "echoCancellationMode for getUserMedia()" with M141 as its planned first milestone. The entry is still "Proposed" with `is_released: false`, and was last edited 2025-09-08 ([chromestatus API](https://chromestatus.com/api/v0/features/5585747985563648), read 2026-10-20). M141 reached stable around late September 2025, so that milestone is **stale**. As of October 2026 there is no evidence the `"all"` / `"remote-only"` values have shipped in Chrome; feature-detect them and do not assume them.
  - **Implication:** cancellation of non-WebRTC playout (the Web Audio or `<audio>` MP3 playback Magic Worlds uses over a WebSocket) is *implementation-defined*. **Unverified here:** how well Chrome, Safari and Firefox cancel Web Audio playout today. Measure it on target browsers and devices; mobile speakerphone is the risky case.
- **Secondary mitigations:**
  - an AEC warm-up window after playback starts (Magic Worlds already has `AEC_WARMUP_MS`);
  - raising the VAD start threshold while the agent speaks;
  - disabling auto barge-in when AEC is off (Magic Worlds already does this);
  - **self-echo transcript filtering:** drop barge-in candidates whose transcript fuzzy-matches the text being spoken at that moment;
  - an interruption classifier (LiveKit and Krisp are trained on overlap audio);
  - a "use headphones" hint.
- Telephony-grade stacks run server-side AEC with the TTS stream as reference. With browser capture this is usually unnecessary *if* browser AEC covers the playout path, which is the open question above.

---

## 6. Truncating the assistant turn to what was actually heard

### 6.1 Mechanisms by stack
- **OpenAI Realtime** (current docs use `gpt-realtime-2.1`; `gpt-realtime-2` and `gpt-realtime` are also referenced).
  - Over **WebRTC/SIP** the server knows playout and truncates automatically.
  - Over **WebSocket** the client must stop playback and send `conversation.item.truncate {item_id, content_index, audio_end_ms}`.
  - Truncation removes the transcript of the unplayed portion, because the model "can't precisely align transcript and audio". `output_audio_buffer.clear` covers the WebRTC push-to-talk case ([OpenAI realtime conversations](https://developers.openai.com/api/docs/guides/realtime-conversations)).
- **Gemini Live.** On interruption, "the ongoing generation is canceled and discarded"; only what was already *sent* to the client stays in history. The server sends `serverContent.interrupted=true` and the client must flush queued audio. Note "sent" is not "played", so client-buffered audio can still diverge.
- **Pipecat.** "Only text that was actually spoken is committed." The transport emits `TTSTextFrame`s in sync with playback, so unplayed text never reaches the context. `on_assistant_turn_stopped` carries an `interrupted` flag ([Pipecat interruptions](https://docs.pipecat.ai/pipecat/fundamentals/interruptions.md)).
- **ElevenLabs WebSocket TTS (incl. multi-context).**
  - Each audio message carries `alignment` and `normalizedAlignment` with `chars`, `charStartTimesMs` and `charDurationsMs`, **relative to that chunk**.
  - Accumulate chunk offsets to get absolute times, then cut at the last character whose start is earlier than `played_ms`.
  - `close_context` stops a context without killing the socket ([ElevenLabs docs](https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input)).
  - Pipecat notes `normalizedAlignment` can contain "overlapping restarts" producing garbled words. Prefer raw `alignment` unless a pronunciation dictionary is used. Flash normalized chunks can start with a leading space ([Pipecat source](https://reference-server.pipecat.ai/en/latest/_modules/pipecat/services/elevenlabs/tts.html)).
- **Fish Audio streaming WS.** The documented `audio` and `finish` events carry **no timestamps**. Word-timestamp alignment is mentioned only as an internal use of `language` and `normalize` ([Fish docs](https://docs.fish.audio/api-reference/endpoint/websocket/tts-live)). Without alignment, truncation must be estimated (proportional characters per ms per sentence) or done by forced alignment or ASR on the generated audio.
- **Played-time accuracy.** `played_ms` must be measured at the *output* (AudioContext `currentTime` minus `outputLatency` / `baseLatency`), not at buffer enqueue. Otherwise the cut lands 50–300 ms late, which is general Web Audio behaviour rather than a sourced figure.

### 6.2 Feeding interruption context to the LLM
Established practice (OpenAI, Pipecat, LiveKit): the stored assistant message contains **only the heard text**, so the model does not think it said things the user never heard. Additional recommendations:

- **Mark the interruption explicitly.** Recommendation, not a sourced standard: frameworks set metadata flags, but most do not inject them into the prompt.
  - Example: `"…someone wanted us to reach the bell tower before—"` plus a short system or context note such as `[The caller interrupted you here.]`, or Pipecat's `interrupted` flag mapped into the prompt.
  - This lets the character react naturally ("Sorry, go on…") and avoids repeating itself.
  - Keep the note out of TTS output.
- **Do not include the unheard remainder** in the main history. Optionally keep it as hidden "what I was about to say" so the character can resume after a false or short interruption.
- **Merge interrupted user fragments.** If the user's barge-in turn is a backchannel, do not create a user message at all. If it is a correction ("no, wait—"), the next user message should be processed with the truncated assistant message immediately before it.
- **Overlapping speech.** Cascaded pipelines are half-duplex: once a barge-in is confirmed, the agent stops talking.
  - Academic benchmarks show current systems "can interrupt too aggressively" and "rarely backchannel" ([Talking Turns, ICLR 2025](https://arxiv.org/abs/2503.01174)).
  - Full-duplex benchmarks evaluate pause handling, backchanneling, smooth turn-taking and user interruption ([Full-Duplex-Bench, ASRU 2025](https://arxiv.org/abs/2503.04721); [FLEXI, 2025-09](https://arxiv.org/abs/2509.22243)).
  - In a cascaded design, approximate this by letting the agent *continue* through backchannels and yield on real interruptions.

---

## 7. Speech-to-speech / omni models: turn-taking specifics

| Stack | Turn detection | Interruption | Notes |
|---|---|---|---|
| **OpenAI Realtime** (gpt-realtime family; latest `gpt-realtime-2.1`, a reasoning S2S model at $32 / $64 per 1M audio input / output tokens, same as gpt-realtime-2) | `server_vad`: threshold 0.5, `prefix_padding_ms` 300, `silence_duration_ms` 500; optional `idle_timeout_ms`. `semantic_vad`: eagerness low / medium / high with max wait 8 / 4 / 2 s (`auto` = medium) | `interrupt_response` (cancel on speech). WebSocket clients must `conversation.item.truncate` with `audio_end_ms` | eot-bench lists "OpenAI GPT Realtime 2" at 1,143 ms latency @5% FC; 2.1 claims better interruption, silence and noise handling but has no published EoT metrics. Can be turned off (`turn_detection: null`) so an external detector drives `input_audio_buffer.commit` and `response.create`. Higher reasoning effort on 2.x adds latency |
| **Gemini Live** | Automatic activity detection: start/end sensitivity enums, `prefixPaddingMs`, `silenceDurationMs` (default about 800 ms) | Server cancels generation and sets `interrupted`; client flushes audio | Manual mode: `activityStart` / `activityEnd` with the client's own VAD (use ≥500 ms end threshold and leading audio). Community report: long pause-heavy speech splits into multiple turns. Conflicting docs on whether `prefixPaddingMs` delays barge-in. LiveKit adaptive interruption is **not** compatible with Gemini Live |
| **External EoT on S2S** | LiveKit's audio detector and Smart Turn work without STT, so they can drive realtime models once built-in detection is off | LiveKit adaptive interruption works with OpenAI Realtime only when server turn detection is off. A confirmed backchannel then drops the whole buffered turn and clears the buffered audio. With an STT pipeline only the backchannel part of the transcript is dropped | Usually worth it: built-in S2S VADs sit mid-pack on eot-bench |

Native full-duplex models (Moshi-class) remove explicit EoT altogether: the model listens and speaks continuously. They are still research-grade for custom-voice roleplay (see the separate S2S research note).

---

## 8. Best practices (established)

1. **Layer the stack.**
   1. Learned VAD (Silero / TEN / Cobra) with a short hangover of 200–300 ms.
   2. Learned EoT model (audio-native or STT-integrated) deciding complete vs hold.
   3. Max-silence backstop of 2–3 s.
   4. Optional LLM-gated incomplete-turn check.
2. **Tune at operating points, not single thresholds.** Pick a false cut-off budget (for example 5%) and minimize latency at that budget, per language.
3. **Keep the VAD stop time short** and let the EoT model own the wait (Pipecat: VAD `stop_secs=0.2`; LiveKit: VAD silence ≥0.25 s plus the detector).
4. **Don't stack delays.** When the STT does its own EoT, set framework `min_delay=0` (LiveKit). Don't add a platform wait timer over semantic EoT (AssemblyAI).
5. **Speculate the LLM on probable EoT and cancel on resume.** Start TTS only on confirmation unless cost permits more.
6. **Barge-in in two stages:** pause or duck on speech onset, then confirm with words or an interruption model. Resume on a false alarm, with a timeout of about 1.5–2 s.
7. **Never treat backchannels as turns or interruptions.** Apply boundary cooldowns near agent turn edges.
8. **Truncate assistant history to played audio** using TTS alignment, measured at true output time, and flag the interruption.
9. **Handle short utterances explicitly:** add a transcription timeout, avoid word minimums that drop "yes" and "no", and use models retrained on short answers.
10. **Measure in production:**
    - response latency (end of speech to first audio);
    - barge-in latency (speech onset to silence);
    - false cut-offs (user resumes within about 1 s after the agent starts);
    - false barge-ins (stop followed by no transcript or a backchannel);
    - resumes per call;
    - "repeat-yourself" rate.
    LiveKit and Pipecat expose interruption metrics and replay tools for this.

## 9. Emerging / experimental
- Fused audio + LLM EoT (LiveKit v1) and context-conditioned audio LLM endpointing (ultraVAD), which use the *agent's last line* as context.
- Frame-streaming EoT (Krisp TP v3, turn-1-mini at 1.3 ms per 160 ms step), which avoids a batch inference after each pause.
- Dedicated interruption-intent models (Krisp IP v1, LiveKit adaptive).
- STT-native EoT tokens (Parakeet-EOU `<EOU>`; Kyutai pause head with a flush-at-4×-realtime trick).
- VAP / full-duplex next-token-pair prediction (FLEXI) and agent-side backchannel generation, still mostly research.
- An open per-language EoT benchmark (eot-bench, 14 languages) makes in-house evaluation feasible.

### 9.1 Newer developments found during the 2026-10-20 fact-check
- **OpenAI `gpt-realtime-2.1`** is now the model in the Realtime docs' session examples. It updates GPT-Realtime-2 with better alphanumeric recognition and better silence, noise and interruption handling (vendor claim), and adds configurable reasoning effort. Its EoT behaviour is not on eot-bench, which lists only "GPT Realtime 2". The Realtime VAD guide also names transcription-only models `gpt-live-transcribe` and `gpt-realtime-whisper`. Neither supports turn detection, so the client must commit each audio turn with `input_audio_buffer.commit` ([OpenAI VAD guide](https://developers.openai.com/api/docs/guides/realtime-vad); [model page](https://developers.openai.com/api/docs/models/gpt-realtime-2.1)).
- **AssemblyAI Universal-3.6 Pro Realtime** (`universal-3-6-pro`) is the default streaming model, with 32 languages and native code-switching. It replaces `end_of_turn_confidence_threshold` with a `mode` parameter, supports mid-stream `UpdateConfiguration`, and does entity-aware holds. Universal-3.5 Pro (19 languages) is still listed.
- **Speechmatics Melia 1** does not accept the silence-based `end_of_utterance_silence_trigger`. Turn detection must come from the client (VAD or EoT model) via `ForceEndOfUtterance`.
- **Pipecat turn strategies:** Pipecat now wires the Krisp interruption model in as `KrispVivaIPUserTurnStartStrategy`. It also has `LLMTurnCompletionUserTurnStopStrategy` and `ExternalUserTurnCompletionStopStrategy`, and `LocalSmartTurnAnalyzerV3` became the default stop strategy in v0.0.102.
- **Deepgram Flux Multilingual** has a dedicated docs page: one `flux-general-multi` model, 10 languages, `language_hint` biasing, and native mid-sentence code-switching ([docs](https://developers.deepgram.com/docs/flux/language-prompting)).
- **LiveKit Agents** is at 1.8.x (the text detector install pin is `livekit-agents[turn-detector]~=1.8`). The 2.0 release that will remove the text detector has not shipped.

## 10. Pitfalls / anti-patterns
- **A fixed silence timeout as the turn decision.** Too short cuts users off; too long adds dead air on every turn.
- **An RMS/energy VAD as the speech detector.** Google measured MCC 0.11; it is music- and noise-sensitive, which matters in roleplay calls with background ambience.
- **Hard-cancelling the LLM and TTS on the first VAD blip** while the agent speaks. On the Krisp test set this fires on about 66% of backchannels, and the stream cannot be resumed.
- **Treating "mm-hmm" as a user turn,** which generates a new reply that talks over the user's next words.
- **`min_words` filters without exceptions,** which silently drop "yes" and "no" so the agent waits forever.
- **Stacking endpointing delays** (VAD silence, framework `min_delay` and STT endpointing) into multi-second pauses.
- **Truncating by sentence or estimate when alignment is available.** The LLM then believes the user heard more or less than they did, and may repeat itself or reference unheard content.
- **Measuring `played_ms` at enqueue time** instead of true output time.
- **Assuming browser AEC covers all playout paths** without testing. Spec semantics differ for `RTCPeerConnection` vs local playout, and mobile speakerphone is the risky case.
- **Trusting cross-vendor leaderboards blindly.** Each vendor wins its own benchmark, and unseen languages can collapse (one user reports Romanian AUC 0.565 for v1-mini on their own telephony data).
- **Speculative TTS on every eager EoT,** which multiplies TTS cost. Eager LLM calls alone are +50–70%.

---

## 11. Implications for Magic Worlds (prioritized)

**Current pipeline as observed in code**
- **Client VAD:** an RMS energy gate in an AudioWorklet (`src/features/interaction/audio/voiceVadProcessor.worklet.js`) with:
  - an adaptive noise floor (gate = max(threshold, 3 × floor)) and hysteresis;
  - a **fixed 550 ms** silence end, `minSpeechMs` 250, and pre-roll;
  - segments of at most 8 s.
- **Server:** a further RMS/peak gate (`server_vad.py`: rms ≥ 0.012, peak ≥ 0.025, strict gate off by default), then a Groq Whisper batch per segment (no partials).
- **Split turns:** "supersede" merges a split utterance while the earlier turn is not yet admitted.
- **Barge-in:** fires on worklet `speech_start` while audible playback is `playing`, with `minSpeechMs` raised to 500 ms during playback. It is skipped during an AEC warm-up and when AEC is off, and it is a **hard** `voice_barge_in` with `played_ms`.
- **Truncation:** `KeepHeardPrefixPolicy` keeps text up to the **end of the last sentence whose audio started before `played_ms`**, using the ElevenLabs alignment word ledger (`call_word_ledger.py`). The Fish lane has no documented alignment.
- **Prompting:** the prompt tells the LLM that "mm-hm" means listening and that its earlier lines "may stop where the caller interrupted".

**P0: biggest quality wins, low vendor risk**
1. **Replace the RMS speech gate with a learned VAD in the browser.**
   - Silero v6 via onnxruntime-web (the `@ricky0123/vad-web` pattern, MIT) or TEN VAD WASM (smaller, but get legal sign-off on the Agora non-compete clause).
   - Keep RMS only as a fallback.
   - Mirror the same learned VAD server-side on the uploaded PCM in place of the RMS/peak gate, to reject noise and echo segments before paying for Whisper.
   - Evidence: Silero MCC 0.72 vs RMS 0.11 (Google, independent).
2. **Add a learned EoT decision and shorten the VAD hangover.**
   - Drop `silenceMsToEnd` to about 250–300 ms as a *candidate* end of turn.
   - Run **Smart Turn v3.2** (BSD-2, 8 MB ONNX, 23 languages incl. Spanish, about 12–60 ms on cloud CPU) on the turn audio. The client already uploads whole-utterance PCM segments of at most 8 s, which matches Smart Turn's 8 s window.
   - If the model says incomplete, hold up to a backstop of about 2.5–3 s and merge the continuation (reuse the existing supersede/merge path). If complete, commit.
   - Expected gain, directional from eot-bench: Smart Turn reaches ~1,050 ms at 5% false cut-offs vs ~1,600 ms for silence-only, or many fewer cut-offs at the same latency.
   - Alternatives:
     - LiveKit v1-mini: check the "LiveKit Model License".
     - p99lab turn-1-mini: Apache, English only.
     - Krisp TP v3: commercial, best published "fast shift" numbers.
3. **Make barge-in two-stage and recoverable.**
   1. On `speech_start` during playback, **pause or duck** local playback (keep the buffer) and tell the server "suspected" (hold the LLM/TTS stream, no cancel).
   2. Confirm when the transcript of the overlap audio is non-empty, is not a backchannel (EN/ES lexicon such as "mm-hmm, uh-huh, yeah, ok, right / ajá, mhm, sí, vale, claro, ya, ok") and is not self-echo. Or confirm on an interruption-model score, or ≥ about 700 ms of continuous speech.
   3. Otherwise **resume** after about 1.5 s. This mirrors LiveKit's `false_interruption_timeout=2.0`.
   - Backchannels then never cancel the character and never create a user turn. Apply a 1 s boundary cooldown at the start and end of agent speech.
4. **Word-level truncation and an explicit interruption marker.**
   - Switch `KeepHeardPrefixPolicy` from sentence-level to **word-level**: keep words whose alignment start is earlier than `played_ms`, after accumulating per-chunk offsets and computing `played_ms` from `AudioContext.currentTime − outputLatency`.
   - Inject a short non-spoken marker into the next LLM call, for example "(you were cut off after: '…before the last light—')".
   - For Fish Audio, estimate the cut from per-sentence character-rate interpolation until a timestamp source exists.

**P1: structural upgrades**
5. **Move STT to streaming with partials and integrated EoT.** Partials enable word-count barge-in confirmation, backchannel detection and speculative LLM starts.
   - Options supporting Spanish:
     - Deepgram **Flux Multilingual** (`flux-general-multi`, `language_hint: ["en","es"]`, `eot_threshold` 0.7, `eager_eot_threshold` about 0.4 if LLM cost allows);
     - AssemblyAI Universal-3.6 Pro (`speech_model: "universal-3-6-pro"`, 32 languages with code-switching, balanced `mode`; check the current docs for how to restrict or hint languages, because the `language_codes` parameter cited earlier could not be verified);
     - Soniox (best eot-bench numbers at 600 ms among STT vendors).
   - Check each provider's acceptable-use terms for 18+ fictional content before committing.
   - This is a bigger change than P0 (it replaces segment upload with continuous streaming), so P0 is the low-risk first step on the current architecture.
6. **Speculative LLM on probable EoT.** Start the agent-graph call when the EoT probability is high but the backstop has not elapsed; cancel if the user resumes; start TTS only on commit. Budget about +50% LLM calls (Deepgram's figure), or gate on a high probability.
7. **Echo hardening.**
   - Measure browser AEC effectiveness on the actual playback path (Web Audio MP3) across Chrome, Safari and Firefox on desktop and mobile speakerphone.
   - Feature-detect `echoCancellation: "all"` and prefer it when available. It is in the W3C spec, but Chrome's entry is still "Proposed" with a stale M141 target, and no browser is confirmed to ship it as of 2026-10.
   - Add a server-side self-echo filter that drops barge-in or user transcripts fuzzy-matching the assistant text audible at that moment.
8. **Adaptive per-user endpointing.**
   - Keep an EMA of the user's intra-turn pauses (LiveKit dynamic mode) within [0.3, 3] s.
   - Use language-specific thresholds; Spanish shows higher FP and FN for Smart Turn.
   - Lengthen the hold right after the character asks an open or "tell me" question.

**P2: measurement and future**
9. **Build a turn-taking eval harness:**
   - Replay recorded EN/ES call audio (with consent) plus `livekit/eot-bench-data` (Spanish split) through VAD and EoT candidates, and report FC@300/600 ms and latency@5% per language.
   - In production, log false cut-off proxies (user continues within 1 s of the agent's first audio), false barge-ins (barge-in followed by an empty or backchannel transcript), resumes, and barge-in latency (speech onset to playback paused, target ≤200–300 ms).
10. **If an S2S path is added:**
    - OpenAI Realtime: prefer `semantic_vad` with `eagerness: "low"` or `"auto"` for roleplay pacing.
    - WebSocket transport requires client `conversation.item.truncate` with `audio_end_ms` from true playout time.
    - Gemini Live: `silenceDurationMs` 500–800 and flush audio on `interrupted`.
    - Built-in detectors sit mid-pack on eot-bench, so consider disabling them and driving turns with the same external EoT model, which keeps behaviour consistent across the cascaded and S2S lanes.
11. **Agent-side backchannels** ("mm", "ajá" while the user tells a long story) are a differentiator for companion roleplay but remain experimental; research shows current systems rarely do it well.

---

## Sources

| # | Source | Date |
|---|---|---|
| 1 | [LiveKit docs: Turn detector](https://docs.livekit.io/agents/logic/turns/turn-detector) | accessed 2026-10-20 |
| 2 | [LiveKit blog: Improved end-of-turn model cuts interruptions 39%](https://livekit.com/blog/improved-end-of-turn-model-cuts-voice-ai-interruptions-39) | 2025-12-12 |
| 3 | [LiveKit blog: Solving end-of-turn detection (Turn Detector v1)](https://livekit.com/blog/solving-end-of-turn-detection) | 2026-06-17 |
| 4 | [livekit/eot-bench (README + leaderboard)](https://github.com/livekit/eot-bench) | 2026 (vendor-run) |
| 5 | [eot-bench issue #14: v1-mini near chance on Romanian](https://github.com/livekit/eot-bench/issues/14) | 2026 |
| 6 | [LiveKit docs: Adaptive interruption handling](https://docs.livekit.io/agents/logic/turns/adaptive-interruption-handling/) | accessed 2026-10-20 |
| 7 | [LiveKit blog: Adaptive Interruption Handling](https://livekit.com/blog/adaptive-interruption-handling) | 2026-03-19 |
| 8 | [LiveKit reference: Turn handling options](https://docs.livekit.io/reference/agents/turn-handling-options/) | accessed 2026-10-20 |
| 9 | [LiveKit blog: Configuring turn detection and interruptions](https://livekit.com/blog/turn-detection-and-interruption-handling) | 2026-06-30 |
| 10 | [LiveKit blog: Short utterances](https://livekit.com/blog/short-utterances) | 2026-08-24 |
| 11 | [p99lab/turn-1-mini model card](https://huggingface.co/p99lab/turn-1-mini) | Oct 2026 |
| 12 | [Daily: Announcing Smart Turn v3](https://www.daily.co/blog/announcing-smart-turn-v3-with-cpu-inference-in-just-12ms/) | 2025-09-11 |
| 13 | [Daily: Smart Turn v3.2](https://www.daily.co/blog/smart-turn-v3-2-handling-noisy-environments-and-short-responses/) | 2026-01-07 |
| 14 | [pipecat-ai/smart-turn (GitHub)](https://github.com/pipecat-ai/smart-turn) and [HF model card](https://huggingface.co/pipecat-ai/smart-turn-v3) | accessed 2026-10-20 |
| 15 | [Pipecat docs: Smart Turn overview](https://docs.pipecat.ai/server/utilities/turn-detection/smart-turn-overview) | accessed 2026-10-20 |
| 16 | [Pipecat docs: User turn strategies](https://docs.pipecat.ai/api-reference/server/utilities/turn-management/user-turn-strategies.md) | accessed 2026-10-20 |
| 17 | [Pipecat docs: Interruptions](https://docs.pipecat.ai/pipecat/fundamentals/interruptions.md) | accessed 2026-10-20 |
| 18 | [Pipecat docs: Filter incomplete turns](https://docs.pipecat.ai/api-reference/server/utilities/turn-management/filter-incomplete-turns) | accessed 2026-10-20 |
| 19 | [Krisp blog: Turn Prediction v3 and Interruption Prediction v1](https://krisp.ai/blog/voice-ai-turn-taking-interruption-prediction/) | "Updated May 2026" (exact day unverified; vendor-run) |
| 20 | [Krisp-AI/turn-taking-test-v1 dataset](https://huggingface.co/datasets/Krisp-AI/turn-taking-test-v1) | accessed 2026-10-20 |
| 21 | [Deepgram Flux: End-of-turn configuration](https://developers.deepgram.com/docs/flux/configuration) | accessed 2026-10-20 |
| 22 | [Deepgram Flux quickstart](https://developers.deepgram.com/docs/flux/quickstart) | accessed 2026-10-20 |
| 23 | [Deepgram: Introducing Flux](https://deepgram.com/learn/introducing-flux-conversational-speech-recognition) | 2025-10-01 |
| 24 | [Deepgram press release: Flux Multilingual](https://deepgram.com/learn/deepgram-launches-flux-multilingual-press-release), [Flux Multilingual docs](https://developers.deepgram.com/docs/flux/language-prompting); [SiliconANGLE](https://siliconangle.com/2026/04/29/deepgram-expands-flux-10-languages-mid-call-switching-voice-agents/). The changelog URL `/changelog/2026/4/15` cited before announces the Deepgram CLI, not Flux Multilingual | 2026-04-29 |
| 25 | [AssemblyAI docs: Turn detection](https://www.assemblyai.com/docs/streaming/universal-streaming/turn-detection) | accessed 2026-10-20 |
| 26 | [AssemblyAI blog: Turn detection and endpointing for voice agents](https://www.assemblyai.com/blog/turn-detection-endpointing-voice-agent) | 2026-09-30 |
| 27 | [Speechmatics docs: Turn detection](https://docs.speechmatics.com/speech-to-text/realtime/end-of-turn) | accessed 2026-10-20 |
| 28 | [Speechmatics blog: Semantic turn detection](https://blog.speechmatics.com/semantic-turn-detection) | 2025-05-12 |
| 29 | [Kyutai STT (semantic VAD, flush trick)](https://kyutai.org/stt) | 2025 |
| 30 | [OpenAI: Realtime VAD guide](https://developers.openai.com/api/docs/guides/realtime-vad) | accessed 2026-10-20 |
| 31 | [OpenAI: Realtime conversations (interruptions and truncation)](https://developers.openai.com/api/docs/guides/realtime-conversations) | accessed 2026-10-20 |
| 32 | [openai-python: realtime turn detection types (eagerness timeouts)](https://github.com/openai/openai-python/blob/main/src/openai/types/realtime/realtime_audio_input_turn_detection.py) | accessed 2026-10-20 |
| 33 | [Google: Gemini Live API guide](https://ai.google.dev/gemini-api/docs/live-guide) | accessed 2026-10-20 |
| 34 | [Ultravox: How we built ultraVAD](https://ultravox.ai/blog/context-aware-audio-native-endpointing-how-we-built-ultravad) | 2025-09-09 |
| 35 | [NVIDIA Parakeet-Realtime-EOU-120m-v1](https://huggingface.co/nvidia/parakeet_realtime_eou_120m-v1) | accessed 2026-10-20 |
| 36 | [snakers4/silero-vad](https://github.com/snakers4/silero-vad) and [releases](https://github.com/snakers4/silero-vad/releases) | v6.0 2025-08-26 … v6.2.3 2026-09 |
| 37 | [TEN-framework/ten-vad](https://github.com/TEN-framework/ten-vad) and [LICENSE](https://huggingface.co/TEN-framework/ten-vad/blob/main/LICENSE) | 2025-06 to 2025-11 updates |
| 38 | [wavekat-vad (third-party TEN / Silero / WebRTC rerun)](https://docs.rs/wavekat-vad) | 2026 |
| 39 | [ricky0123/vad (browser Silero VAD)](https://github.com/ricky0123/vad) | accessed 2026-10-20 |
| 40 | [Picovoice: Best VAD 2026 (vendor-run benchmark)](https://picovoice.ai/blog/best-voice-activity-detection-vad/) | 2025-11-12, updated 2026-01-23 |
| 41 | [McKinnon et al. (Google): Window Size Versus Accuracy Experiments in VADs, arXiv 2601.17270](https://arxiv.org/abs/2601.17270) | 2026-01-24 |
| 42 | [W3C Media Capture and Streams (echoCancellation modes)](https://w3c.github.io/mediacapture-main/) | Editor's draft, accessed 2026-10-20 |
| 43 | [Chrome Platform Status: echoCancellationMode for getUserMedia()](https://chromestatus.com/feature/5585747985563648) | target M141 (stale), status "Proposed", not released; entry last edited 2025-09-08 |
| 44 | [Imoto: Barge-In Is the Voice-Agent Feature Nobody Benchmarks (DEV)](https://dev.to/kenimo49/barge-in-is-the-voice-agent-feature-nobody-benchmarks-i-added-it-and-lost-120ms-4o7m) | 2026-06-30 (practitioner, anecdotal) |
| 45 | [ElevenLabs: Multi-context WebSocket API](https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input) | accessed 2026-10-20 |
| 46 | [Pipecat ElevenLabs TTS source (alignment handling)](https://reference-server.pipecat.ai/en/latest/_modules/pipecat/services/elevenlabs/tts.html) | accessed 2026-10-20 |
| 47 | [Fish Audio: WebSocket TTS live](https://docs.fish.audio/api-reference/endpoint/websocket/tts-live) | accessed 2026-10-20 |
| 48 | [Arora et al.: Talking Turns, arXiv 2503.01174 (ICLR 2025)](https://arxiv.org/abs/2503.01174) | 2025-03-03 |
| 49 | [Lin et al.: Full-Duplex-Bench, arXiv 2503.04721 (ASRU 2025)](https://arxiv.org/abs/2503.04721) | v3 2025-08-16 |
| 50 | [Ge et al.: FLEXI, arXiv 2509.22243](https://arxiv.org/abs/2509.22243) | 2025-09-26 |
| 51 | [Ekstedt & Skantze: Voice Activity Projection, arXiv 2205.09812](https://arxiv.org/abs/2205.09812) | 2022-05-19 (older than 12 months; foundational) |

**Local code referenced:**
- Frontend:
  - `src/features/call/components/CallScreen.tsx`
  - `src/features/interaction/audio/voiceVadProcessor.worklet.js`
  - `src/features/interaction/hooks/useVoiceCallController.ts`
- Backend (`/home/andres/PycharmProjects/magic-worlds-api`), under `src/services/voice_orchestration/`:
  - `server_vad.py`
  - `call_ledger.py`
  - `call_word_ledger.py`
  - `engine.py`
  - `src/agent_graphs/runtime/callbot_chat.v2.json`

---

## Fact-check log (2026-10-20)

**Method**
- Each claim was checked against a primary page with WebFetch.
- No web-search budget was left for this pass, so newer releases were found only by reading vendor docs and model pages directly. A 2026 release that none of these pages mention could still be missing.
- "Confirmed" means the primary source states it. "Corrected" means the text above was changed. "Unverifiable" means it is now marked *(unverified)* in the text.

| # | Claim (as originally written) | Verdict | Correction / note | Source |
|---|---|---|---|---|
| 1 | eot-bench EN: VAD baseline 55.6% / 21.7% FC at 300 / 600 ms, 1,600 ms @5%; LiveKit v1 9.9% / 4.5%, 543 / 295 ms; all other leaderboard rows | Confirmed | Every row matches the README. The dataset `livekit/eot-bench-data` is Apache-2.0 and covers 14 languages including Spanish | https://github.com/livekit/eot-bench |
| 2 | Google arXiv 2601.17270: peak MCC RMS 0.11 / WebRTC 0.41 / Silero 0.72; RMS "worse than random guessing across most of its range" | Corrected (wording) | The MCC values and Google LLC affiliation are right. The exact quote is "underperforms random guessing for most of its range". Hysteresis: WebRTC 0.41 → 0.47, Silero 0.72 → 0.71 | https://arxiv.org/html/2601.17270v1 |
| 3 | LiveKit Turn Detector v1 / v1-mini released 2026-06-17, 14 languages incl. es, v1-mini in Agents ≥1.6.1 Py / 1.4.7 TS, LiveKit Model License | Confirmed | Added pricing: v1 is free on LiveKit Cloud; self-hosted gets 7,500 dev requests per month, then per-request billing on Ship/Scale; Build-plan sessions fall back to v1-mini | https://livekit.com/blog/solving-end-of-turn-detection ; https://docs.livekit.io/agents/logic/turns/turn-detector |
| 4 | LiveKit text model "deprecated, removed in Agents 2.0"; 50–160 ms CPU, <500 MB RAM; English TNR 87.0% | Corrected / partly unverifiable | The model is "slated for removal" in 2.0, which has not shipped (current SDK 1.8.x). The −39% and Spanish −33.9% figures are confirmed. The CPU latency and RAM figures are not in the blog. The 87% TNR is derived from the 13.00% FPR | https://livekit.com/blog/improved-end-of-turn-model-cuts-voice-ai-interruptions-39 ; https://docs.livekit.io/agents/logic/turns/turn-detector |
| 5 | LiveKit defaults: audio detector `min_delay` 0.3 / `max_delay` 2.5 s; VAD `min_silence_duration` ≥0.25 s; `false_interruption_timeout` 2.0, `resume_false_interruption` True, `min_duration` 0.5, `backchannel_boundary` (1.0, 1.0), preemptive generation on, `preemptive_tts` False, 10 s, 3 retries, dynamic alpha 0.9 | Confirmed | Generic (non-audio-detector) defaults are 0.5 / 3.0 s | https://docs.livekit.io/reference/agents/turn-handling-options/ |
| 6 | LiveKit adaptive interruption (2026-03-19): 86% P / 100% R at 500 ms, rejects 51%, faster in 64%, ≤30 ms, median 216 ms; "LiveKit Cloud inference only; self-hosted falls back to VAD" | Corrected | The numbers are confirmed. Self-hosted agents *can* opt in with `mode="adaptive"`, which runs on LiveKit Inference (40k dev requests per month per the blog) and falls back to VAD only if Inference is unavailable or the limit is hit. It is on by default in Py ≥1.5.0 / TS ≥1.2.0 | https://livekit.com/blog/adaptive-interruption-handling ; https://docs.livekit.io/agents/logic/turns/adaptive-interruption-handling/ |
| 7 | Smart Turn v3 (2025-09-11) / v3.2 (2026-01-07): 23 languages, EN 94.31% / ES 91.97% (FP 4.48%, FN 3.55%), 12.6 ms c7a.2xlarge to 94.8 ms t3.medium, 8 MB int8, ≤8 s, BSD-2, v3.2 −40% short-utterance errors | Confirmed | No newer Smart Turn version was found; the repo heading is still v3.2. Pipecat ships it as `LocalSmartTurnAnalyzerV3` | https://www.daily.co/blog/announcing-smart-turn-v3-with-cpu-inference-in-just-12ms/ ; https://www.daily.co/blog/smart-turn-v3-2-handling-noisy-environments-and-short-responses/ ; https://github.com/pipecat-ai/smart-turn |
| 8 | Krisp TP v3 / IP v1 dated 2026-05-06; TP v3 9M / 30 MB, 12+ languages incl. es, 0.69 shifts ≤200 ms, BA 88.05 / AUC 94.58; IP v1 6M, English only, FPR 5.9% / MIT 0.833 s; VAD-only 66.3% FPR; 3-word rule BA 0.948 / MIT 1.53 s | Confirmed (numbers); date unverifiable | The page shows only "Updated May 2026". The headline numbers are pre-background-voice-cancellation; with BVC they are 87.85 / 94.09 | https://krisp.ai/blog/voice-ai-turn-taking-interruption-prediction/ |
| 9 | p99lab turn-1-mini v1.2.3 (Oct 2026), 5.3M params, 5.4 MB int8, English only, 1.29 ms per 160 ms step, eot-bench 22.6% / 9.6%, 849 ms, Apache-2.0, self-scored | Confirmed | Added: 581 ms @10%, M4 *Pro* core, p95 1.45 ms, validation split | https://huggingface.co/p99lab/turn-1-mini |
| 10 | Deepgram Flux Multilingual: "multi adds 10 langs incl. es", Apr 2026 (changelog 2026-04-15), same price as EN; `eot_threshold` 0.5–1.0 default 0.7, `eager_eot_threshold` 0.3–0.9, `eot_timeout_ms` 5,000; "~260 ms" EoT | Corrected | `flux-general-multi` covers 10 languages *in total* (en, es, fr, de, hi, ru, pt, ja, it, nl), launched 2026-04-29. The cited changelog URL is the Deepgram CLI announcement. Equal pricing is unverified. Eager mode is off by default. "~260ms" is confirmed in the quickstart | https://developers.deepgram.com/docs/flux/language-prompting ; https://deepgram.com/learn/deepgram-launches-flux-multilingual-press-release ; https://developers.deepgram.com/docs/flux/configuration ; https://developers.deepgram.com/docs/flux/quickstart |
| 11 | Deepgram eager EoT saves 150–250 ms and adds 50–70% LLM calls; Flux ~30% fewer false interruptions, 200–600 ms lower latency, EoT within 1.5 s at p95 | Confirmed (re-attributed) | 150–250 ms is how much earlier EagerEndOfTurn fires than EndOfTurn (launch blog). +50–70% comes from the quickstart. The 0.3–0.5 eager range comes from Telnyx and is unverified | https://deepgram.com/learn/introducing-flux-conversational-speech-recognition ; https://developers.deepgram.com/docs/flux/quickstart |
| 12 | AssemblyAI U-3.6 Pro with `language_codes:["en","es"]`; Universal-Streaming multi "in beta"; presets aggressive / balanced / conservative; 307 ms median; entity-aware holds | Corrected / partly unverifiable | The presets, 307 ms (Pipecat STT benchmark), entity-aware holds and `ForceEndpoint` are confirmed. `language_codes` does not appear in the current docs or blog. U-3.6 Pro covers 32 languages with code-switching, and `universal-streaming-multilingual` covers en/es/de/fr/pt/it per turn (beta status unverified). On U-3.6 Pro, `end_of_turn_confidence_threshold` is deprecated in favour of `mode`, and `UpdateConfiguration` works mid-stream | https://www.assemblyai.com/docs/streaming/universal-streaming/turn-detection ; https://www.assemblyai.com/docs/streaming/universal-3-pro ; https://www.assemblyai.com/blog/turn-detection-endpointing-voice-agent |
| 13 | OpenAI Realtime: `semantic_vad` eagerness low / medium / high max timeouts 8 / 4 / 2 s; `server_vad` 0.5 / 300 / 500 ms; WebSocket clients must send `conversation.item.truncate` with `audio_end_ms`; WebRTC/SIP auto-truncates | Confirmed | Newer development: current docs use `gpt-realtime-2.1` (an update to GPT-Realtime-2 with better interruption, silence and noise handling). eot-bench evaluated only "GPT Realtime 2" | https://github.com/openai/openai-python/blob/main/src/openai/types/realtime/realtime_audio_input_turn_detection.py ; https://developers.openai.com/api/docs/guides/realtime-conversations ; https://developers.openai.com/api/docs/models/gpt-realtime-2.1 |
| 14 | Gemini Live: server default about 800 ms, recommends 500–800, 100–200 ms splits utterances; hybrid VAD; manual `activityStart` / `activityEnd` (≥500 ms); interruption "canceled and discarded", `interrupted=true` | Confirmed | None | https://ai.google.dev/gemini-api/docs/live-guide |
| 15 | Silero VAD v6.0 2025-08-26 … v6.2.3 Sep 2026; v6.0 16% / 11% fewer errors | Confirmed | Added v6.1 (2025-11-05) and v6.2.2 (2026-09-17). There is no v7 | https://github.com/snakers4/silero-vad/releases |
| 16 | Chrome "echoCancellationMode" targeted for M141, status "Proposed" | Corrected (stale) | The entry is still "Proposed" with `is_released: false`, last edited 2025-09-08. M141 shipped in 2025 without it, so the target is stale and the feature has not shipped as of 2026-10 | https://chromestatus.com/api/v0/features/5585747985563648 |
| 17 | Picovoice Cobra RTF 0.0006 on an i7; TPR @5% FPR Cobra 98.9 / Silero 87.7 / WebRTC 50; @1% 95 / 80.4 | Corrected (RTF) | The TPR figures are confirmed. The 2026-01-23 update gives RTF 0.000399 (C) / 0.00171 (Python). The Silero version is unstated | https://picovoice.ai/blog/best-voice-activity-detection-vad/ |
| 18 | TEN VAD: 277 KB Web build, 10/16 ms hop, RTF 0.0086 vs Silero 0.0127 (Xeon 6348), Web M1 0.010, WASM 2025-06 / guide 2025-11; licence non-compete clause | Confirmed | No 2026 updates in the repo news | https://github.com/TEN-framework/ten-vad ; https://huggingface.co/TEN-framework/ten-vad/blob/main/LICENSE |
| 19 | ultraVAD (2025-09-09): Llama-8B, 26 languages, runs speculatively about 500 ms before TTS; "open weights" | Confirmed; licence unverifiable | Neither the HF card nor the blog states a licence | https://ultravox.ai/blog/context-aware-audio-native-endpointing-how-we-built-ultravad ; https://huggingface.co/fixie-ai/ultraVAD |
| 20 | v1-mini "near chance (AUC 0.565) on Romanian" (eot-bench issue #14) | Corrected (framing) | This is a third-party user's result on their own Romanian telephony data, not an eot-bench result. The same report gives ≥0.79 AUC on all 14 benchmark languages. The issue (opened 2026-09-05) has no maintainer response | https://github.com/livekit/eot-bench/issues/14 |
| 21 | NVIDIA Parakeet-Realtime-EOU-120m-v1: English only, EOU p50 / p90 / p95 160 / 280 / 320 ms on TTS DialogStudio audio, WER 9.30% @160 ms, NVIDIA Open Model License | Confirmed | None | https://huggingface.co/nvidia/parakeet_realtime_eou_120m-v1 |
| 22 | Kyutai `stt-1b-en_fr` EN/FR, 0.5 s delay, semantic VAD in the Rust server only, flush at about 4× realtime ≈ 125 ms | Confirmed | None | https://kyutai.org/stt |
| 23 | Pipecat `FilterIncompleteUserTurnStrategies` ● / ◐ / ○ with 5 s / 10 s; `MinWordsUserTurnStartStrategy` only while the bot speaks; `EagerUserTurnStopStrategy` `speculation_timeout` 5 s; VAD `stop_secs` 0.2 with Smart Turn | Confirmed | Added: `KrispVivaIPUserTurnStartStrategy`, `LLMTurnCompletionUserTurnStopStrategy`, `SmartTurnParams.stop_secs` 3.0 s backstop, and that the legacy `filter_incomplete_user_turns` is removed in Pipecat 2.0.0 | https://docs.pipecat.ai/api-reference/server/utilities/turn-management/filter-incomplete-turns ; https://docs.pipecat.ai/api-reference/server/utilities/turn-management/user-turn-strategies.md ; https://docs.pipecat.ai/server/utilities/turn-detection/smart-turn-overview |
| 24 | Speechmatics EndOfUtterance 0–2 s, recommended 0.5–0.8 s, `ForceEndOfUtterance` | Confirmed + added | New: the **Melia 1** model rejects silence-based EndOfUtterance and needs client-side detection plus `ForceEndOfUtterance` | https://docs.speechmatics.com/speech-to-text/realtime/end-of-turn |
| 25 | ElevenLabs multi-context WS: `alignment` / `normalizedAlignment` with `chars` / `charStartTimesMs` / `charDurationsMs` relative to the chunk; `close_context`. Fish Audio WS: no timestamps | Confirmed | None | https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input ; https://docs.fish.audio/api-reference/endpoint/websocket/tts-live |
| 26 | dev.to practitioner: duration guard costs 120–200 ms and cuts false barge-ins 60–80%; −24 dB ducking | Confirmed (re-attributed) | 120 ms is the author's own measurement. About 200 ms and 60–80% come from cited third-party (Future AGI) research | https://dev.to/kenimo49/barge-in-is-the-voice-agent-feature-nobody-benchmarks-i-added-it-and-lost-120ms-4o7m |
| 27 | LiveKit short-utterance guidance (2026-08-24): `transcription_timeout` about 5 s, `min_words` can swallow short answers; false-interruption resume (2026-06-30) | Confirmed | None | https://livekit.com/blog/short-utterances ; https://livekit.com/blog/turn-detection-and-interruption-handling |
