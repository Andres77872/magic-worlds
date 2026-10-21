# R03: Streaming speech-to-text for realtime voice agents (the October 2026 landscape)

> Research notes (evidence for the `docs/call_realtime` report). Written 2026-10-20.
> Scope: hosted and open streaming STT for a cascaded STT → LLM → TTS voice agent. It also covers batch-per-utterance (the current Groq Whisper design) against streaming, Whisper hallucinations, and audio formats.
> Conventions: **(vendor)** marks a vendor-reported number. **(AA)** marks Artificial Analysis independent data. **(Pipecat)** marks the open Pipecat STT benchmark. **(OASR)** marks the Hugging Face Open ASR Leaderboard. **(stale?)** marks a source older than about 12 months. Prices are list or pay-as-you-go prices in USD unless stated. Per-minute prices are converted to per-hour (×60).
> Research limits: the shared web-search budget ran out partway through. Facts gathered after that point come from direct fetches of primary pages: vendor docs, Hugging Face model cards and datasets, GitHub READMEs, and arXiv. The Artificial Analysis streaming leaderboard values were pulled from the data embedded in its public page on 2026-10-20.
> Fact-checked 2026-10-20 against primary pages (direct fetches only; web search was exhausted). Corrections are applied inline and listed in the "Fact-check log" at the end. Unconfirmed items are marked **(unverified)**.

---

## 0. TL;DR

1. **Streaming STT is now cheap and fast, and accuracy is close to batch.** On AA's streaming benchmark (English agent-style audio), the best models reach about 2.5–3.6% WER. They deliver the final transcript **50–200 ms after end of speech**, at **$0.08–0.54 per audio hour**. Soniox v5 RT ($0.12/h, about 54 ms to final) and AssemblyAI Universal-3.6 Pro RT ($0.45/h, about 3.6% WER, about 190 ms) are the clearest value and accuracy picks. Microsoft MAI-Transcribe-2-Streaming (2.5% WER, about 130 ms, $0.54/h intro) is the new accuracy leader.
2. **The current Magic Worlds design adds latency that streaming removes.** Today a turn waits for the browser energy VAD (800 ms of silence by default), then uploads a WAV, then makes a Groq Whisper request. Estimated end-of-speech → transcript is **about 1.0–1.5 s**. A streaming STT has the text ready when the endpoint fires. It can also do *semantic* endpointing and fire an **eager end-of-turn**, which lets the LLM start before the user has fully finished.
3. **Accuracy is not the main reason to leave Whisper large-v3, especially in Spanish.** On OASR's Spanish set (batch), whisper-large-v3 averages **3.35% WER** (FLEURS 2.30%). The leaders are at about 2.25–2.5%. The reasons to move are **latency, partials, turn detection, and hallucinations on non-speech**.
4. **Endpointing dominates the latency budget, not STT inference.** Every serious 2026 streaming STT now ships turn semantics: Deepgram Flux, AssemblyAI U3 Pro, Soniox, Cartesia Ink-2, ElevenLabs `turn_prediction`, Kyutai semantic VAD, and OpenAI semantic VAD. The STT choice and the turn-taking design are now one decision.
5. **Vocabulary biasing for fantasy names is widely supported** but differs a lot by vendor:
   - Soniox `context`: 8k tokens of free text plus terms.
   - AssemblyAI `prompt`: 1,750 characters, or 100 keyterms.
   - Deepgram `keyterm`: 100 terms / 500 tokens.
   - ElevenLabs: 50 keyterms of 20 characters or fewer.
   - Speechmatics: 1,000 custom words.
   - OpenAI: a non-binding `prompt` plus `keywords`.
   - Whisper: a 224-token prompt.

   Most of them allow **mid-session updates**, so the list can change when the scene or character changes.
6. **Whisper on non-speech is a known failure mode.** In the ICASSP 2025 study, **40.3%** of non-speech inputs produced hallucinations. On test clips of real speech padded with non-speech noise, WebRTC VAD only cuts WER from 104.8% to 68.3%. **Silero VAD cuts it to 8.0%**, and Silero plus delooping plus a "bag of hallucinations" filter reaches 6.5%. Magic Worlds already has the BoH and threshold filters but gates speech with **energy-based** VADs. (The paper tested WebRTC VAD, which is GMM-based. That plain energy VADs behave like WebRTC VAD here is our inference, not a tested result.)

---

## 1. How to read streaming-STT numbers (metrics that matter for agents)

| Metric | What it measures | Why it matters | Typical 2026 range |
|---|---|---|---|
| Time to first partial | Audio → first text token while the user speaks | Live captions, early intent, word-confirmed barge-in | 50–300 ms |
| **Time to final (TTF / TTFS)** after end of speech | VAD-detected end of speech → final transcript | Directly on the critical path once the turn is declared over | **20 ms–1.5 s**; top tier is under 300 ms |
| End-of-turn (EOT) latency | Speech end → the model or system *declares* the turn over | Usually the biggest component (silence timeouts) | 200 ms (eager) to 1.5 s (silence timeouts) |
| Streaming WER and first-partial WER | Accuracy of finals, and of the earliest usable text | Partials drive speculative LLM calls | Finals 2.5–8% (AA, English) |
| Semantic WER | Only the errors that change an LLM's understanding (an LLM judges each one) | Closer to agent impact than raw WER | 0.8–5% (Pipecat, English) |
| p95/p99 TTFS | Tail latency | Without finalization support, an app effectively waits for p95 on every turn (Daily, Feb 2026) | Best p99 is about 250–330 ms (Pipecat) |

Methodology notes:
- **AA-WER Streaming** ([Artificial Analysis](https://artificialanalysis.ai/speech-to-text/streaming), live page, accessed 2026-10-20):
  - About 8 h of audio: AA-AgentTalk 50%, VoxPopuli 25%, Earnings22 25%. The audio is streamed in chunks.
  - Time to final is measured from the **SileroVAD-detected end of speech**. Models with forced endpointing get a finalize request at that point. The others use the first natural final within 2 s.
  - This means "time to final" is **transcript availability, not the vendor's turn decision.** Deepgram Flux shows 21 ms because its transcript updates are already current when speech stops. That is different from Flux's about 260 ms EOT decision.
- **Pipecat STT benchmark** ([github.com/pipecat-ai/stt-benchmark](https://github.com/pipecat-ai/stt-benchmark), updated Sept 2026; [Daily blog, 2026-02-13](https://www.daily.co/blog/benchmarking-stt-for-voice-agents/)):
  - 1,000 English turn samples, streamed as 16 kHz PCM from one US location.
  - TTFS is measured from the VAD stop (200 ms Silero `stop_secs`) to the last final segment.
  - Turn detection is disabled where possible, which is why Flux was excluded.
  - Semantic WER is LLM-judged. Differences under about 0.25 pp among the leaders fall within the 95% CI. The current judge is Claude Sonnet 5.5 (adaptive thinking, medium effort). Rows marked † were scored by the previous judge, Claude Sonnet 4.5, and are due to be re-scored. The 1,000 samples come from `pipecat-ai/smart-turn-data-v3.1-train` (README, Sept 2026).
- **Streaming WER is typically 1–3 points worse than batch** on the same model ([Coval, 2026-06-04](https://www.coval.ai/blog/best-speech-to-text-providers-in-2026-independent-benchmarks-and-how-to-choose/), secondary claim). Never compare a batch leaderboard number against a streaming one.
- Both independent streaming benchmarks are **English-only**. For Spanish, the only broad independent data is batch (OASR, §4). Plan an in-house bilingual bake-off (§8).

---

## 2. Independent results: streaming STT (English)

### 2.1 Artificial Analysis AA-WER Streaming (data extracted 2026-10-20)

Sorted by final-transcript WER. Price is AA's normalized $/1,000 min, converted to $/h.

| Rank | Model (provider) | Final WER | First-partial WER | Time to final after EOS | Time to first partial | ≈ $/h |
|---|---|---|---|---|---|---|
| 1 | MAI-Transcribe-2-Streaming (Microsoft AI) | **2.51%** | 2.52% | 0.128 s | 0.122 s | 0.54 |
| 2 | Grok Voice Transcribe 2.0 (xAI, listed as "SpaceXAI") | 2.73% | 3.36% | 0.490 s | 0.489 s | 0.20 |
| 3 | Muse Voice Transcribe (Meta) | 3.06% | 3.57% | 0.163 s | 0.127 s | 0.18 |
| 4 | Cartesia Ink Preview (external endpoints) | 3.11% | 4.13% | 0.105 s | 0.089 s | 0.24 |
| 5 | Cartesia Ink Preview (semantic endpoints) | 3.21% | 4.95% | 0.427 s | 0.214 s | 0.24 |
| 6 | Resonant-1 Realtime (Reson8) | 3.22% | 3.98% | 0.278 s | 0.244 s | 1.35 |
| 7 | Voxtral Mini Transcribe RT 3, 960 ms (Mistral) | 3.34% | 7.67% | 1.119 s | 0.230 s | 0.48 |
| 8 | Cartesia Ink-2 (semantic endpoints) | 3.36% | 4.89% | 0.431 s | 0.168 s | 0.24 |
| 9 | Saaras v4 Realtime (Sarvam) | 3.54% | 12.34% | 0.422 s | 0.206 s | 0.31 |
| 10 | Voxtral Mini Transcribe RT 3, 480 ms | 3.57% | 5.95% | 0.755 s | 0.270 s | 0.48 |
| 11 | **AssemblyAI Universal-3.6 Pro RT (min latency)** | 3.57% | 3.57% | 0.192 s | 0.188 s | 0.45 |
| 12 | **ElevenLabs Scribe v2 Realtime** | 3.59% | 3.59% | 0.141 s | 0.134 s | 0.39 |
| 13 | Qwen3 ASR Flash Realtime (Alibaba) | 3.73% | 19.94% | 0.476 s | 0.401 s | 0.32 |
| 14 | Zoom Scribe Live | 3.80% | 3.80% | 0.205 s | 0.205 s | 0.25 |
| 15 | AssemblyAI U3.6 Pro RT (max accuracy) | 3.85% | 3.85% | 0.197 s | 0.193 s | 0.45 |
| 16 | GPT Live Transcribe (OpenAI) | 3.92% | 6.35% | 0.812 s | 0.256 s | 1.02 |
| 17 | Grok Voice Transcribe 1.0 | 3.93% | 18.28% | 0.373 s | 0.245 s | 0.20 |
| 18 | Alebex STT | 3.96% | 4.30% | 0.742 s | 0.566 s | 0.09 |
| 19 | Gemini 3.5 Transcribe Live (Google) | 4.00% | 5.77% | 0.395 s | 0.250 s | 0.54 |
| 20 | AssemblyAI U3.5 RT Pro (min latency) | 4.02% | 4.04% | 0.191 s | 0.185 s | 0.45 |
| 21 | Cartesia Ink-2 (external endpoints) | 4.02% | 4.02% | 0.067 s | 0.067 s | 0.24 |
| 24 | Inworld STT 1 Realtime | 4.18% | 4.18% | 0.071 s | 0.068 s | 0.08 |
| 25 | Speechmatics Agent STT Linden 1 | 4.42% | 4.58% | 0.157 s | 0.128 s | 0.30 |
| 26 | **Soniox v4 RT** | 4.49% | 4.78% | 0.062 s | 0.054 s | 0.12 |
| 27 | **Soniox v5 RT** | 4.50% | 4.71% | **0.054 s** | 0.047 s | **0.12** |
| 29 | Google Chirp 3 Streaming | 4.80% | 4.93% | 1.276 s | 1.200 s | 0.96 |
| 30 | OpenAI GPT Realtime Whisper | 4.89% | 7.31% | 0.688 s | 0.206 s | 1.02 |
| 32 | Mistral Voxtral Mini Transcribe Realtime (2602) | 5.24% | 9.57% | 0.682 s | 0.320 s | 0.36 |
| 33 | Azure STT Real-time | 5.25% | 5.89% | 0.625 s | 0.215 s | 1.00 |
| 34 | NVIDIA Nemotron 3 ASR 1120 ms (open) | 5.36% | 5.35% | 0.418 s | 0.362 s | self-host |
| 35 | Amazon Transcribe Streaming | 5.79% | 7.28% | 0.620 s | 0.253 s | 1.44 |
| 36 | NVIDIA Nemotron 3 ASR 560 ms (open) | 5.96% | 5.97% | 0.252 s | 0.215 s | self-host |
| 38 | **Deepgram Nova-3 Realtime** | 6.59% | 6.59% | 0.066 s | 0.064 s | 0.29 |
| 40 | **Deepgram Flux (EN)** | 7.39% | 7.39% | 0.021 s | 0.020 s | 0.39 |
| 42 | Gladia Solaria-1 Realtime | 7.82% | 9.14% | **1.523 s** | 0.431 s | 0.75 |
| 43 | Speechmatics Realtime (Enhanced) | 8.05% | 8.33% | 0.317 s | 0.201 s | 1.05 |
| 44 | AssemblyAI Universal-Streaming English | 8.18% | 8.41% | 0.034 s | 0.032 s | 0.15 |
| 46 | RevAI Streaming | 10.14% | 12.19% | 0.697 s | 0.178 s | 0.20 |

Source: [artificialanalysis.ai/speech-to-text/streaming](https://artificialanalysis.ai/speech-to-text/streaming), values from the page's embedded data on 2026-10-20 (47 entries). Rankings are as of that date. MAI-Transcribe-2-Streaming took #1 in early October 2026 ([AA on X](https://x.com/ArtificialAnlys/status/2105694108736188894); [TechCity Authority, Oct 2026](https://www.techcityauthority.com/2026/10/microsoft-ai-streaming-transcription-model.html): 60 languages with auto-detect, $0.54/h intro price through end of 2026).

Fact-check notes on this table (2026-10-20, re-extracted from the page's embedded data):
- All values above match the live data. The table skips some ranks. Two of the skipped ones are relevant: #28 **Modulate STT Streaming English** (4.77% / 0.621 s / about $0.05/h, the cheapest entry) and #31 **Smallest Pulse realtime** (4.98% / 0.132 s / $0.24/h).
- AA release dates: MAI-Transcribe-2-Streaming 2026-10-01; U3.6 Pro RT 2026-09-29; Grok Voice Transcribe 2.0 2026-09-18; Speechmatics Linden 1 2026-09-16; Soniox v5 RT 2026-06-16. **Voxtral Mini Transcribe RT 3 is dated 2026-10-20 (today).** It is a new hosted Mistral model, not the open 2602 checkpoint (see §5).
- The "Soniox v4 RT" row is historical. Since 2026-06-30, Soniox routes `stt-rt-v4` to `stt-rt-v5` ([Soniox models](https://soniox.com/docs/stt/models)).

Observations:
- A large "first-partial WER" gap means early partials are unreliable for speculative LLM calls. Examples: Qwen3 ASR Flash at 19.9% against 3.7% for finals, and Grok 1.0 at 18.3%. Models where first-partial WER equals final WER commit only stable words: AssemblyAI, Scribe v2 RT, Deepgram, Zoom, and Inworld.
- Vendor latency claims can be very far from independent results. Gladia advertises about 270 ms finals **(vendor)** ([Gladia](https://www.gladia.io/product/real-time)), but AA measured 1.52 s.
- Deepgram's English accuracy now trails the leaders. Nova-3 is at 6.6% and Flux at 7.4%, against about 3.5% for the top tier. Its latency and turn-detection features still lead.

### 2.2 Pipecat STT benchmark (semantic WER, TTFS), September 2026

| Service / model | Semantic WER (mean / pooled) | TTFS median | TTFS p95 |
|---|---|---|---|
| Meta muse-voice-transcribe-1.0 | **0.80% / 0.73%** | 392 ms | 1,292 ms |
| AssemblyAI universal-3-6-pro | 0.89% / 0.80% | 307 ms | 401 ms |
| Azure | 0.98% / 1.01% | 1,016 ms | 1,345 ms |
| Soniox stt-rt-v4 | 1.04% / 1.13% | 249 ms | 281 ms |
| Soniox stt-rt-v5 | 1.11% / 1.09% | 260 ms | 305 ms |
| Speechmatics linden-1 | 1.11% / 0.96% | 369 ms | 438 ms |
| xAI grok-voice-transcribe-2.0 | 1.12% / 0.79% | 1,322 ms | 1,895 ms |
| AssemblyAI universal-3-5-pro | 1.12% / 0.95% | 282 ms | 354 ms |
| Cartesia ink-2 | 1.14% / 1.02% | 299 ms | 328 ms |
| AWS | 1.26% / 1.35% | 1,136 ms | 1,527 ms |
| Deepgram nova-3-general | 1.32% / 1.37% | **247 ms** | **298 ms** |
| Smallest AI pulse | 1.85% / 1.94% | 398 ms | 533 ms |
| NVIDIA Nemotron 3.0 ASR (en, open)† | 1.90% / 1.95% | **221 ms** | **238 ms** |
| Google gemini-3.5-transcribe-live | 1.93% / 1.97% | 458 ms | 532 ms |
| OpenAI gpt-realtime-whisper | 2.41% / 2.30% | 740 ms | 878 ms |
| AssemblyAI universal-streaming-english | 2.81% / 2.42% | 256 ms | 362 ms |
| ElevenLabs scribe_v2_realtime | 3.05% / 3.13% | 281 ms | 348 ms |
| OpenAI gpt-4o-transcribe | 3.10% / 2.95% | 637 ms | 965 ms |
| Cartesia ink-whisper | 3.32% / 3.78% | 266 ms | 364 ms |
| Gradium (Kyutai spin-off) | 3.81% / 3.79% | 585 ms | 614 ms |
| Mistral voxtral-mini-transcribe-realtime-2602 | 4.49% / 5.11% | 525 ms | 973 ms |
| NVIDIA Nemotron 3.5 ASR (multilingual, open)† | 4.54% / 4.58% | 236 ms | 253 ms |

† Scored by the older judge, which reports WER about 15% higher. Source: [pipecat-ai/stt-benchmark README](https://github.com/pipecat-ai/stt-benchmark) (Sept 2026). An August 2026 snapshot hosted on [soniox.com/benchmarks](https://soniox.com/benchmarks) uses the same harness. Soniox hosts it (vendor-hosted copy of an independent harness), and that snapshot also gives p99: Nemotron 252 ms, Soniox 313 ms, Deepgram 326 ms.

The two independent benchmarks agree that **AssemblyAI U3.x Pro, Soniox, Speechmatics Linden, Cartesia Ink-2 and Deepgram Nova-3** form the low-latency, high-accuracy frontier. They also agree that **OpenAI's streaming transcription, Google Chirp/Gemini Live, Azure and AWS are 2–5× slower to final**.

---

## 3. Provider-by-provider (hosted)

### 3.1 Deepgram: Nova-3 and Flux
- **Flux** is a "conversational speech recognition" model with built-in turn detection, served at `wss://api.deepgram.com/v2/listen` ([Flux quickstart](https://developers.deepgram.com/docs/flux/quickstart), accessed 2026-10-20).
  - Events: `TurnInfo` (transcripts), `EagerEndOfTurn`, `TurnResumed`, and `EndOfTurn`.
  - `eot_threshold` (0.5–1.0, default 0.7). `eager_eot_threshold` (0.3–0.9) enables early responses. `eot_timeout_ms` (500–60,000, default 5,000).
  - A `Configure` message changes these settings mid-stream. With `eot_threshold=1.0`, the app can drive turns itself via `ForceEndTurn`.
  - About 260 ms EOT **(vendor)**. Deepgram warns that **eager EOT raises LLM calls by 50–70%**.
  - Chunking: an **80 ms chunk is strongly recommended**; 16 kHz linear16 is recommended. Opus and Ogg/WebM containers are also accepted.
- **Flux Multilingual** (`flux-general-multi`) is live ([language prompting](https://developers.deepgram.com/docs/flux/language-prompting)). The GA date of 2026-04-15 is **(unverified)**: the changelog link previously cited here is about the Deepgram CLI and does not mention Flux, and the language-prompting page gives no release date.
  - 10 languages: en, **es**, fr, de, hi, ru, pt, ja, it, nl.
  - `language_hint` biases toward the hinted languages and handles code-switching between them. Hints can be changed mid-call.
  - The recommended pattern is to detect the language on the first EndOfTurn and then lock it with Configure.
- **Keyterm prompting** works on Nova-3 and Flux, monolingual and multilingual ([docs](https://developers.deepgram.com/docs/keyterm)).
  - The binding limit is the **500-token cap** across all terms, and exceeding it is an error. "Up to 100" terms is the intro's guidance, not a hard count. About 20–50 terms is recommended.
  - Capitalize proper nouns. **Malformed terms silently boost nothing.**
  - The list can be replaced mid-stream via `Configure`, on Nova-3 (`/v1/listen`) and Flux (`/v2/listen`). Each update replaces the whole list. Mid-stream Nova-3 keyterm updates are recent: they were added 2026-10-02 (global endpoint only), and since 2026-10-19 each `Configure` returns `ConfigureSuccess` or `ConfigureFailure`. An over-limit update fails with `CONFIGURE_KEYTERM_LIMIT_EXCEEDED` and keeps the previous list. An earlier changelog entry (2026-10-08) said it closed the stream with code 1011 ([changelog](https://developers.deepgram.com/changelog)).
  - Whether keyterms work on `flux-general-multi` is still not confirmed: neither the keyterm page nor the Flux language-prompting page says so.
- **Pricing** ([deepgram.com/pricing](https://deepgram.com/pricing), accessed 2026-10-20). The section is labelled "limited-time promotional rates on streaming". Flux EN and the two Nova-3 rates are shown beside struck-through higher prices. Flux Multi and the add-ons have no strikethrough. Growth-tier rates are about 12% lower (Flux EN $0.0057/min).

  | Item | Pay-as-you-go | Per hour |
  |---|---|---|
  | Flux EN | $0.0065/min | $0.39/h |
  | Flux Multi | $0.0078/min | $0.47/h |
  | Nova-3 mono | $0.0048/min | $0.29/h |
  | Nova-3 multi | $0.0058/min | $0.35/h |
  | Keyterm add-on | $0.0013/min | +$0.08/h |
  | Diarization add-on | $0.002/min | |

  Streaming concurrency is 150 (PAYG) and 225 (Growth).
- **Independent results:**
  - AA: Nova-3 6.59% WER / 66 ms; Flux 7.39% / 21 ms.
  - Pipecat: Nova-3 1.32% semantic WER, 247 ms median, 298 ms p95 (the best tail among hosted models).
  - A competitor's Pipecat test claims Flux EOT at a 568 ms mean and 1,319 ms p95 ([AssemblyAI blog](https://assemblyai.com/blog/assemblyai-vs-deepgram-best-voice-agent-api), competitor marketing).
- **Spanish caveat:** a May 2026 community thread reports frequent Spanish and bilingual (es/en code-switching) misrecognitions. The poster was comparing Nova-3 `language=multi` with **Flux Multilingual** for a LiveKit agent. A second user (2026-05-29) reported that the name "Nestor" was not recognized. Only the Deepgram community bot replied, with no human staff answer; the last reply was 2026-07-25 ([discussion #1605](https://github.com/orgs/deepgram/discussions/1605), opened 2026-05-08). This is anecdotal but relevant.

### 3.2 AssemblyAI: Universal-3.6 Pro Realtime, Universal-Streaming (EN / Multilingual)
- Models ([models page](https://www.assemblyai.com/docs/getting-started/models); [pricing](https://www.assemblyai.com/pricing), accessed 2026-10-20):

  | Model | Languages | Price |
  |---|---|---|
  | `universal-3-6-pro` (default; AA release date 2026-09-29) | 32, with native code-switching | $0.45/h |
  | `universal-3-5-pro` | 19 (the models overview page says 18) | $0.45/h |
  | `universal-streaming-multilingual` | 6: en, **es**, de, fr, pt, it | $0.15/h |
  | `universal-streaming-english` | English | $0.15/h |

  - Add-ons: diarization +$0.12/h. Keyterms are included on Pro and Multilingual, and cost +$0.04/h on EN. "Voice Focus" is +$0.10/h. Prompting (beta) is +$0.05/h.
  - **Billing is by WebSocket session duration, idle time included.**
  - 100 new streams per minute on PAYG.
- API ([streaming API reference](https://www.assemblyai.com/docs/api-reference/streaming-api/universal-3-pro-streaming)):
  - Endpoint: `wss://streaming.assemblyai.com/v3/ws`.
  - Encodings: pcm_s16le (default 16 kHz), mulaw, opus, ogg_opus, aac.
  - Turn detection on U3 Pro is **punctuation-based after `min_turn_silence`**, with `max_turn_silence` as a hard cap (1,536 ms default on 3.5 Pro; 1,280 ms on Universal-Streaming).
  - `keyterms_prompt`: up to 100 terms. `prompt`: up to 1,750 characters of context on Pro. That the two cannot be combined is **(unverified)**: the API reference and model page list both and do not say whether they can be used together.
  - **`agent_context`** (missed in the first pass): the agent's last spoken reply, the TTS text, passed as context for the next user turn. Up to 1,750 characters. It can be set at connect time and replaced after every agent reply. It works on U3.6 Pro and U3.5 Pro only, and is meant for short or ambiguous replies and spelled-out entities. This is exactly the "last assistant utterance as prior" idea in §8(c).
  - **`mode`**: `max_accuracy`, `balanced` or `min_latency`. It is a preset that sets the default `min_turn_silence` and `interruption_delay`, and can be switched mid-session.
  - Client messages: `ForceEndpoint`, `Terminate`, and `UpdateConfiguration`. `UpdateConfiguration` covers prompt, keyterms, silence settings, `mode`, `language_codes`, `agent_context` and `session_heartbeat` mid-session.
  - EU and US data-residency endpoints exist (`streaming.eu.assemblyai.com`, `streaming.us.assemblyai.com`).
  - Chunks should be 50–1,000 ms and sent at real-time pace. Sending in a tight loop gives inconsistent turns.
- **Independent results:**
  - AA: U3.6 Pro RT 3.57% / 192 ms; Universal-Streaming EN 8.18% / 34 ms.
  - Pipecat: U3.6 Pro 0.89% semantic WER (#2 overall), 307 ms median, 401 ms p95.
- Multilingual Universal-Streaming launched 2025-11-12 with a 6-language average WER of 11.77% against Nova-3's 12.76%, and p50 303 ms **(vendor)** ([blog](https://www.assemblyai.com/blog/introducing-multilingual-universal-streaming)). No Spanish-only figure was published.

### 3.3 Soniox: stt-rt-v5
- **$0.12/h real-time**, $0.10/h async, 60+ languages, one model with automatic language identification ([pricing](https://soniox.com/pricing), accessed 2026-10-20). The `context` feature is billed as input text tokens at $4 per 1M (real-time).
- **Semantic endpointing** ([docs](https://soniox.com/docs/stt/rt/endpoint-detection)) returns an `<end>` token. It uses pauses, intonation and context, not just silence.
  - `endpoint_latency_adjustment_level` (0–3), `endpoint_sensitivity` (−1 to 1), and `max_endpoint_delay_ms` (500–3,000, default 2,000).
  - Suggested low-latency start: level 2, sensitivity 0.3, max 1,500 ms.
  - Manual finalization is also supported.
- **Context** ([docs](https://soniox.com/docs/stt/concepts/context)) has four parts:
  - `general`: key-value pairs such as domain and participant names.
  - `text`: free-form background or history.
  - `terms`: rare or invented words, explicitly meant to fix the spelling of difficult names.
  - `translation_terms`.

  The cap is **8,000 tokens (about 10,000 characters)**. This is the richest vocabulary and context channel among hosted options, and fits character names and lorebook terms well.
- **Independent results:**
  - AA: v5 RT 4.50% WER, **54 ms to final** (fastest among accurate models), $0.12/h (cheapest of the frontier).
  - Pipecat: 1.11% semantic WER, 260 ms median, 305 ms p95.
- **Release:** `stt-rt-v5` was released on **2026-06-16** and `stt-async-v5` on 2026-06-11 ([Soniox models](https://soniox.com/docs/stt/models)). `stt-rt-v4` (released 2026-02-05) was removed on 2026-06-30 and now routes to v5. The models are API-compatible across versions.

### 3.4 Speechmatics: Agent STT (Linden 1), Realtime
- **Agent STT / Linden 1** launched 2026-09-17 ([Speechmatics](https://www.speechmatics.com/company/articles-and-news/meet-agent-stt-powered-by-linden-1-fast-accurate-speech-recognition); [press release](https://www.globenewswire.com/news-release/2026/09/17/3364138/0/en/speechmatics-launches-agent-stt-for-the-speech-errors-that-derail-voice-agents.html)).
  - 55+ languages. Spanish is not called out, and "fully multilingual agents" are promised for Linden 2.
  - Up to 1,000 custom-vocabulary words. Real-time diarization and speaker ID.
  - Turn detection is currently **pause-based**. The launch page says "smart turn detection" is **coming soon**, not in early access.
  - About 350 ms mean and about 440 ms p95 finalization **(vendor)**.
  - $0.30/h list, about $0.16/h at volume.
- Independent results: AA 4.42% / 157 ms. Pipecat 1.11% semantic WER, 369 ms / 438 ms p95.
- The legacy "Realtime Enhanced" model is $1.05/h (AA-normalized), 8.05% AA WER.

### 3.5 Gladia: Solaria
- Real-time is **€0.68/h** self-serve. 100+ languages, auto language detection, custom vocabulary, "name consistency". 30 concurrent real-time sessions on self-serve. Diarization is async only ([pricing](https://www.gladia.io/pricing), accessed 2026-10-20).
- Solaria-3 appears **async-only**, and real-time runs on Solaria-1. This is **partly verified**: the pricing page lists both Solaria models only in its async tables and does not say which model serves real-time. AA's real-time entry is `solaria-1`.
- Vendor latency is about 103 ms partial and about 270 ms final, but **AA measured 1.52 s to final and 7.82% WER**. It is not competitive for agents on independent data.

### 3.6 ElevenLabs: Scribe v2 Realtime
- Endpoint: `wss://api.elevenlabs.io/v1/speech-to-text/realtime`, model `scribe_v2_realtime` ([API reference](https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime), accessed 2026-10-20).
  - Formats: `pcm_8000` … `pcm_48000` (default `pcm_16000`) and `ulaw_8000`.
  - `commit_strategy`: `manual`, `vad`, or **`turn_prediction`** (the default where supported).
  - `keyterms`. `previous_text` context, accepted only with the first chunk. `language_code` plus `secondary_languages`. Language detection, entity detection, and `filter_background_audio`.
  - `enable_logging=false` (zero retention) is **enterprise-only**.
- Realtime keyterms: up to **50 terms of 20 characters or fewer** ([STT overview](https://elevenlabs.io/docs/capabilities/speech-to-text)). About 150 ms latency **(vendor)**. 90+ languages.
- Price: **$0.39/h** realtime, plus $0.08/h for keyterms ([API pricing](https://elevenlabs.io/pricing/api)). Batch Scribe v2 is $0.22/h.
- Independent results: AA 3.59% / 141 ms (good). Pipecat 3.05% semantic WER, 281 ms / 348 ms p95, which is noticeably weaker accuracy on conversational turns.
- **Relevance:** Magic Worlds already uses ElevenLabs TTS, so this is the single-vendor option.

### 3.7 OpenAI: gpt-live-transcribe, gpt-realtime-whisper, gpt-4o-(mini-)transcribe
- The **realtime transcription session** uses `session.update` with `type: "transcription"` over WebSocket or WebRTC. Audio is `audio/pcm` at **24 kHz**.
  - Recommended model: **`gpt-live-transcribe`**. It does **not** support server or semantic VAD, so the client must VAD and send `input_audio_buffer.commit`.
  - The guide's only other model is `gpt-transcribe`. It is WebSocket-only, transcribes after a committed turn, and returns the detected language. `gpt-realtime-whisper` appears on the pricing page and on AA, but not in the current realtime-transcription guide.
  - Each `keywords` entry must be a single line and must not contain `<` or `>`, or the `session.update` is rejected. Use `languages` (an array), not `language`.
  - `audio.input.transcription.delay` is one of `minimal | low | medium | high | xhigh`, trading latency for WER.
  - `prompt`, plus non-binding `keywords`, plus a `languages` list.
  - No word timestamps, speaker labels or confidence scores ([realtime transcription guide](https://developers.openai.com/api/docs/guides/realtime-transcription); [VAD guide](https://developers.openai.com/api/docs/guides/realtime-vad), accessed 2026-10-20).
- **Pricing** ([pricing](https://developers.openai.com/api/docs/pricing)):

  | Model | Per minute | Per hour |
  |---|---|---|
  | gpt-live-transcribe | $0.017 | $1.02 |
  | gpt-realtime-whisper | $0.017 | $1.02 |
  | gpt-transcribe (batch) | $0.0045 | $0.27 |
  | gpt-4o-transcribe | $0.006 | |
  | gpt-4o-mini-transcribe | $0.003 | |
- **Deprecation** ([deprecations](https://developers.openai.com/api/docs/deprecations)): whisper-1, gpt-4o-transcribe, gpt-4o-mini-transcribe and gpt-4o-transcribe-diarize were deprecated on **2026-08-26** and shut down on **2027-02-26**. The replacements are gpt-live-transcribe and gpt-transcribe.
- Independent results:
  - AA: GPT Live Transcribe 3.92% / **812 ms** to final; GPT Realtime Whisper 4.89% / 688 ms.
  - Pipecat: gpt-realtime-whisper 740 / 878 ms p95.
  - These are accurate but **among the slowest finals** and the **most expensive per hour**. They only make sense inside an OpenAI-centric stack.

### 3.8 Google: Chirp 3 and Gemini Transcribe Live
- Chirp 3 is GA on Speech-to-Text V2 with streaming, diarization, auto language detection, a built-in denoiser and speech adaptation ([release notes](https://docs.cloud.google.com/speech-to-text/docs/release-notes)). About $0.016/min, or $0.96/h (third-party listing and AA). Google bills in 15-second increments, per a third-party report.
- AA: Chirp 3 Streaming 4.80% / **1.28 s** to final. Gemini 3.5 Transcribe Live 4.00% / 395 ms at $0.54/h. Pipecat: gemini-3.5-transcribe-live 458 / 532 ms.

### 3.9 Microsoft: Azure Speech and MAI-Transcribe-2-Streaming
- Azure real-time is about $1.00/h (AA-normalized). AA: 5.25% / 625 ms. Pipecat: 0.98% semantic WER but **1,016 ms median TTFS**.
- Azure exposes `ProfanityOption` = Masked / Removed / Raw ([SDK reference](https://learn.microsoft.com/en-us/python/api/azure-cognitiveservices-speech/azure.cognitiveservices.speech.profanityoption)). For 18+ roleplay you must set **Raw** explicitly. **Confirmed:** the default is `masked`. The Speech REST API for short audio documents `profanity` = `masked` (default) / `removed` / `raw` ([REST short audio](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short), updated 2026-06-05). The SDK enum page does not state a default.
- On OASR's batch Spanish set, `microsoft/azure-speech-06-2026` is **#1 (2.25% avg)**.
- **MAI-Transcribe-2-Streaming** (released 2026-10-01 per AA) is #1 on AA: 2.51% / 128 ms, $0.54/h intro price through the end of 2026, 60 languages with auto-detect. It is available on Microsoft Foundry, the MAI Playground, Vercel and **Azure Voice Live**, with LiveKit support "coming soon" ([TechCity Authority, 2026-10-01](https://www.techcityauthority.com/2026/10/microsoft-ai-streaming-transcription-model.html)). Turn detection and vocabulary features are not documented in the sources checked. Spanish streaming accuracy is not yet independently published.

### 3.10 AWS Transcribe Streaming
- About $1.44/h (AA-normalized). Billed per second with no minimum, per AWS (third-party sources conflict). Custom vocabulary is included.
- AA: 5.79% / 620 ms. Pipecat: 1,136 ms median, 1,527 ms p95.
- Hard to justify for a latency-critical agent.

### 3.11 Groq Whisper (batch, very fast): the current provider
- `whisper-large-v3` costs $0.111/h (speed factor 189×) and `whisper-large-v3-turbo` costs $0.04/h (216×) **(vendor)** ([Groq STT docs](https://console.groq.com/docs/speech-to-text), accessed 2026-10-20).
  - **Minimum billed length is 10 seconds per request.**
  - Groq downsamples audio to 16 kHz mono itself. WAV gives the lowest latency.
  - `prompt` ≤ 224 tokens. `language` (ISO-639-1) improves accuracy *and* latency.
  - `verbose_json` returns per-segment `no_speech_prob`, `avg_logprob` and `compression_ratio`.
- AA (batch): Groq Whisper Large v3 Turbo 4.6% AA-WER, speed factor 200.8, about $0.04/h ([AA STT](https://artificialanalysis.ai/speech-to-text)).
- OASR Spanish: whisper-large-v3 averages 3.35% (FLEURS 2.30 / MCV 4.29 / MLS 3.47); turbo averages 3.85%.
- **Cost under the 10 s minimum:** if the average user turn is 3 s, the effective price is about $0.37 per hour of *speech*. That is still cheap, but it erodes most of the cost advantage over Soniox ($0.12/h of streamed audio).

### 3.12 Cartesia: Ink-2 (and ink-whisper)
- Ink-2 (`ink-2`, plus `ink-preview`) has built-in turn detection with `turn.start`, `turn.update`, `turn.eager_end`, `turn.resume` and `turn.end`. Languages: en, fr, hi, ja, **es** ([docs](https://docs.cartesia.ai/build-with-cartesia/stt/latest)).
  - **Corrected timeline** ([Cartesia changelog](https://docs.cartesia.ai/changelog)):
    - **May 2026:** Ink-2 launched, English-only. Sonic 3.5 went GA the same month and became the default for Line agents together with Ink 2.
    - **June 2026:** turn-detection threshold controls were added for turn start, turn end and eager end.
    - **July 2026:** **keyterm prompting** was added.
    - **September 2026:** "Ink-2 is now multilingual", adding es, fr, hi and ja.
  - The docs' 2026-09-17 date for `ink-2` and `ink-preview` is the multilingual snapshot. The earlier note that Ink-2 launched on 2026-06-16 alongside Sonic-3.5 is not supported by the changelog.
- Price: AA-normalized about $0.24/h. A Cartesia guide quotes 3 credits/s and $0.39/h on the Scale plan; the two conflict. The 3 credits/s and $0.39/h figures are **(unverified)**: Cartesia's 2026-10-02 "best STT models" page only says Ink 2 is "priced per minute of audio".
- AA: Ink-2 semantic endpoints 3.36% / 431 ms, external endpoints 4.02% / 67 ms. Ink Preview external 3.11% / 105 ms. Pipecat: ink-2 1.14% / 299 ms / 328 ms p95, but p99 is 1,584 ms in the August snapshot.
- Cartesia claims Ink-2 cuts about 0.5 s in Pipecat via eager turn-end **(vendor)** ([Cartesia, 2026-10-02](https://www.cartesia.ai/learn/best-speech-to-text-models)).
- **Relevance:** this is a coherent STT and TTS pair if Cartesia Sonic is adopted for TTS.

### 3.13 Others worth knowing (2026 entrants)
- **xAI Grok Voice Transcribe 2.0**: very accurate (AA 2.73%; Pipecat 0.79% pooled), cheap ($0.20/h), but slow to final (0.49 s AA; 1.3 s median and 1.9 s p95 in Pipecat).
- **Meta Muse Voice Transcribe**: the best Pipecat semantic WER (0.80%), $0.18/h (AA). Its p95 TTFS is 1.29 s, and commercial availability and terms are unclear.
- **Inworld STT 1 Realtime**: 4.18% / 71 ms at about $0.08/h (AA). Inworld is a companion and gaming voice vendor, so worth a look.
- **Smallest.ai Pulse** and **Zoom Scribe Live** are mid-pack.

---

## 4. Spanish (and bilingual) accuracy evidence

There is no independent **streaming** Spanish benchmark. The best proxy is OASR's batch Spanish track (FLEURS + Common Voice + MLS). The data was pulled from `hf-audio/multilingual_evals/multilingual_es.csv` at the revision the leaderboard pins, on 2026-10-20 ([OASR space](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard); [paper v4, 2026-03-30](https://arxiv.org/abs/2510.06961)).

| Model | Avg WER (es) | FLEURS | MCV | MLS | Streaming-capable sibling? |
|---|---|---|---|---|---|
| microsoft/azure-speech-06-2026 | **2.25** | 1.75 | 2.24 | 2.77 | Azure real-time (slow, ~1 s) |
| microsoft/azure-speech-07-2026 (newer snapshot, missed in the first pass) | 2.30 | 1.75 | 2.36 | 2.79 | Azure real-time |
| elevenlabs/scribe_v2 | 2.32 | 1.85 | 2.55 | 2.55 | Scribe v2 Realtime |
| assemblyai/universal-3-pro | 2.49 | 2.20 | 2.76 | 2.52 | U3.x Pro Realtime |
| assemblyai/universal-3-5-pro | 2.52 | 2.04 | 2.71 | 2.80 | U3.5/3.6 Pro Realtime |
| reson8/resonant-1 | 2.66 | 2.24 | 2.93 | 2.81 | Resonant-1 Realtime |
| speechmatics/enhanced | 2.74 | 2.61 | 2.05 | 3.55 | Speechmatics RT |
| openai/gpt-transcribe | 2.74 | 1.98 | 3.11 | 3.14 | gpt-live-transcribe |
| nvidia/canary-1b-v2 (open) | 3.23 | 2.63 | 3.94 | 3.13 | (chunked only) |
| **openai/whisper-large-v3 (≈ Groq)** | **3.35** | 2.30 | 4.29 | 3.47 | none (batch) |
| soniox/stt-async-v5 | 3.37 | 2.40 | 4.27 | 3.44 | stt-rt-v5 |
| meta/muse-voice-transcribe | 3.64 | 2.74 | 4.52 | 3.67 | yes |
| nvidia/parakeet-tdt-0.6b-v3 (open) | 3.71 | 3.25 | 3.53 | 4.36 | chunked |
| openai/whisper-large-v3-turbo | 3.85 | 2.73 | 4.98 | 3.85 | none |
| mistralai/Voxtral-Mini-4B-Realtime-2602 (open) | 4.18 | 2.80 | 5.02 | 4.73 | native streaming |
| nvidia/nemotron-3.5-asr-streaming-0.6b (open) | 5.43 | 4.23 | 6.91 | 5.16 | native streaming |

Other Spanish datapoints:
- **Nemotron 3.5 ASR Streaming** FLEURS-es: 4.87% at 80 ms, 4.39% at 320 ms, 4.11% at 1.12 s, and 4.13–5.04% with auto language ID ([model card](https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b), 2026-06-04).
- **Voxtral Mini 4B Realtime** FLEURS-es: 5.34% at 160 ms, 4.59% at 240 ms, **3.31% at 480 ms**, 2.98% at 960 ms ([model card](https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602), Feb 2026).
- **Parakeet TDT 0.6B v3** FLEURS-es: 3.45% (batch) ([model card](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3), 2025-08-14, **stale?**).

Takeaways:
- Spanish read speech is "easy" for all top systems (2–4%). Conversational, emotional roleplay speech with invented names will be much harder, and leaderboard numbers will understate the error.
- **Code-switching** (es/en in one call) can multiply WER. One article gives an illustrative 5% → 15–20% ([Coval](https://www.coval.ai/blog/best-speech-to-text-providers-in-2026-independent-benchmarks-and-how-to-choose/)). Prefer models with native code-switching: AssemblyAI U3.6 Pro, Deepgram Flux-multi with hints, Soniox, and Scribe v2 `secondary_languages`. Otherwise **lock the language per call** from the user and character settings.
- Whisper's language ID is unreliable on very short clips, so passing `language` (as the current code does) is correct.

---

## 5. Open and self-hosted streaming STT

| Model | Type | Langs | Latency knob | Accuracy evidence | License | Notes |
|---|---|---|---|---|---|---|
| **NVIDIA Nemotron Speech Streaming EN 0.6B** (2026-03-13) | Cache-aware FastConformer-RNNT | en | chunk 80 / 160 / 560 / 1,120 ms → OASR-avg WER 8.43 / 7.67 / 7.07 / 6.93% | AA: 5.36% @1,120 ms, 5.96% @560 ms; Pipecat 1.90% semantic, **221 ms / 238 ms p95** (best tail of all) | NVIDIA Open Model License | NeMo, Transformers ≥5.13, NeMo-Speech.cpp GGUF, Riva/NIM ([card](https://huggingface.co/nvidia/nemotron-speech-streaming-en-0.6b)) |
| **NVIDIA Nemotron 3.5 ASR Streaming 0.6B** (2026-06-04) | same | 40 locales incl. es-US / es-ES; `target_lang=auto` | 80 ms – 1.12 s | FLEURS-es 4.1–5.0% (above) | OpenMDW-1.1 (commercial OK) | Built-in punctuation and capitalization. A good self-hosted bilingual option. |
| **NVIDIA Parakeet TDT 0.6B v3** (2025-08) | FastConformer-TDT (offline, chunked streaming) | 25 EU incl. es | chunked (e.g. 2 s chunk + 2 s right context) | OASR-en 6.38 avg; es 3.71 avg; RTFx ~3,300–13,000 | CC-BY-4.0 | Excellent *batch per utterance* replacement for Whisper on a GPU. Not true low-latency streaming. |
| NVIDIA Canary-1B-v2 | AED | 25 EU | offline | OASR-es 3.23 | CC-BY-4.0 | Batch |
| **Mistral Voxtral Mini 4B Realtime 2602** (Feb 2026) | Causal audio encoder + 3.4B LM | 13 incl. es | configurable delay 80 ms – 2.4 s (default 480 ms) | FLEURS-es 3.31% @480 ms; AA (hosted) 5.24%; Pipecat 4.49% semantic, 525 / 973 ms | **Apache 2.0** | vLLM Realtime API; single GPU with ≥16 GB ([card](https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602); arXiv 2602.11298). The successor, **Voxtral Mini Transcribe Realtime 3** (v3.0), is hosted-only under Mistral's "Premier" tier, not Apache 2.0. Mistral describes it as "for agentic use-cases with configurable latency and **turn detection**" ([Mistral models](https://docs.mistral.ai/getting-started/models/models_overview/)). AA dates it 2026-10-20 and measures 3.3–3.6% WER, but it is slow to final (0.76–1.12 s). |
| **Kyutai STT** (delayed streams modeling; mid-2025, **stale?**) | Decoder-only, fixed delay | 1B: en / fr (0.5 s delay + **semantic VAD**); 2.6B: en (2.5 s) | fixed | no WER published on the README | CC-BY-4.0 weights; Rust server | H100 ≈ 400 real-time streams; L40S 64 connections ([repo](https://github.com/kyutai-labs/delayed-streams-modeling)). **No Spanish.** The commercial spin-off Gradium scores 6.6% on AA. |
| **Moonshine** (Moonshine Voice) | Streaming encoder-decoder, on-device | STT: en, **es**, zh, ja, ko, vi, uk, ar (language list **(unverified)**: neither the repo README nor the docs overview lists languages) | n/a | vendor claim "higher accuracy than Whisper Large V3 at the top end" (unverified) | MIT, except legacy non-English models | Runs on CPU, WASM, mobile ([repo](https://github.com/moonshine-ai/moonshine); [docs](https://moonshine-voice.readthedocs.io/en/latest/)). Original paper: about 5× less compute than Whisper tiny ([arXiv 2410.15608](https://arxiv.org/abs/2410.15608), Oct 2024, **stale?**). |
| **Whisper-streaming / SimulStreaming** | Policies over Whisper large-v3 | 99 | LocalAgreement (whisper_streaming, about 3.3 s latency on long-form, [arXiv 2307.14743](https://arxiv.org/abs/2307.14743), 2023, **stale**); AlignAtt in SimulStreaming (about 5× faster than whisper_streaming, IWSLT 2025) | n/a | MIT | [SimulStreaming](https://github.com/ufal/SimulStreaming) needs a GPU with ≥10 GB. Still seconds of lag, so not competitive with native streaming models for agents. |
| **WhisperLive** (Collabora) | Server wrapping faster-whisper / TensorRT / OpenVINO | 99 | buffer re-decode | none published | MIT | "Nearly-live" ([repo](https://github.com/collabora/WhisperLive)) |
| **faster-whisper** | CTranslate2 Whisper | 99 | batch | same as Whisper | MIT | Up to 4× faster than openai/whisper. `vad_filter=True` uses Silero, but the default only removes silences longer than 2 s, so tune `min_silence_duration_ms` ([repo](https://github.com/SYSTRAN/faster-whisper)). |

Biasing on open models: NeMo supports **GPU-PB phrase boosting** (CTC, RNN-T/TDT, Canary) at decode time without retraining, plus CTC-WS and Flashlight boosting ([NeMo docs](https://docs.nvidia.com/nemo-framework/user-guide/latest/nemotoolkit/asr/asr_customization/word_boosting.html)). Streaming support is not documented, so verify it.

**When self-hosting makes sense:** at roughly 1–2 GPU-hours of cost per 50–400 concurrent streams, self-hosting beats $0.12–0.45/h hosted pricing only at **sustained** high concurrency. It also helps when data residency or zero retention matters. That second point is relevant for 18+ roleplay audio, because hosted zero-retention is often enterprise-only (for example ElevenLabs `enable_logging=false`). Otherwise hosted streaming at $0.12–0.45/h is cheaper than the engineering cost.

---

## 6. Batch-per-utterance (current) vs streaming

### 6.1 Today's Magic Worlds path (from the code)
- **Browser:**
  - The AudioWorklet resamples to 16 kHz with an FIR low-pass and gates on **per-frame RMS against an adaptive noise floor**, with hysteresis.
  - It keeps 300 ms of pre-roll and ends a segment after **`silenceMsToEnd` = 800 ms** (450 ms in "strict" mode).
  - `maxSegmentMs` is 7,500 ms, and the server rejects segments over 8 s.
  - Each segment is posted as 16 kHz PCM WAV (`src/features/interaction/audio/voiceVadProcessor.worklet.js`).
- **Server:**
  - An energy-statistics VAD gate (`server_vad.py`), then **one Groq `whisper-large-v3` request per segment** with `verbose_json`, `language` when known, and a ≤200-character vocabulary `prompt`.
  - Hallucination filters: `no_speech_prob > 0.6 AND avg_logprob < -1.0`, `compression_ratio > 2.4`, prompt-echo detection, and an en/es "bag of hallucinations" (credits, "thanks for watching", "Amara.org", "gracias por ver", low-confidence "thank you" / "gracias") (`magic-worlds-api/src/services/voice_orchestration/stt_groq_client.py`).

**Estimated end-of-speech → transcript** (not measured here; the code records `latency_ms` per request, so measure it):

| Step | Estimate |
|---|---|
| Silence wait | 800 ms |
| WAV upload (about 32 KB/s of audio) | 30–150 ms |
| Groq round trip (network, queue, about 15–20 ms compute for 3 s at about 190×) | 150–500 ms |
| **Total** | **about 1.0–1.5 s** before the LLM even starts |

### 6.2 Trade-offs

| Dimension | Batch per utterance (Groq Whisper) | Streaming STT |
|---|---|---|
| Latency after end of speech | Endpoint wait + upload + full decode (serial) | Final text ready within 50–300 ms of the endpoint (AA/Pipecat). The endpoint itself can be semantic and earlier. |
| Partials | None | Live captions, eager/speculative LLM, word-confirmed barge-in |
| Turn detection | Only what the client VAD gives (energy + fixed silence) | Built-in semantic or acoustic EOT (Flux, U3 Pro, Soniox, Ink-2, Scribe `turn_prediction`) |
| Long user turns | Hard 7.5–8 s cut splits monologues mid-sentence into separate turns | Unbounded turns. The STT tracks the whole utterance. |
| Accuracy | Full bidirectional context. Whisper-v3 es ≈ 3.35% (OASR). | 1–3 pp worse than batch on the same model (Coval), but frontier streaming ≈ Whisper batch or better |
| Hallucination on non-speech | High risk (Whisper LM prior) without a strong VAD | Lower in practice for transducer/CTC models (Nova, Parakeet/Nemotron). LLM-decoder STTs (gpt-*, Voxtral) can still hallucinate. |
| Cost model | Per request, 10 s minimum (Groq) | Per streamed audio second (Deepgram, Soniox) or **per session time incl. idle** (AssemblyAI) |
| Complexity | Stateless HTTP, trivial retries and fallbacks | Long-lived WS per call, reconnect and resume, ordering, partial-revision handling, concurrency limits |
| Vendor portability | Very high (OpenAI-compatible endpoint) | Turn semantics and events differ per vendor, so you need an adapter layer |

**Hybrid patterns** used in production:
1. **Streaming for the turn, batch for the record.** Stream for latency and turn detection, then re-transcribe the finished utterance asynchronously for the stored transcript, memory and moderation. This is optional and costs $0.04–0.27/h.
2. **Streaming primary, batch fallback.** If the streaming WS fails, fall back to client VAD + Groq. This is basically the current path, kept as a fallback.
3. **Gate the stream with the client VAD** (send audio only from speech start minus pre-roll until N seconds after the endpoint, with KeepAlive in between). This cuts per-audio-second cost. The trade-off is that barge-in detection during TTS playback then relies on the client VAD plus echo cancellation.

---

## 7. Whisper hallucinations on silence and noise, and mitigations

**Evidence:**
- **Barański et al., "Investigation of Whisper ASR Hallucinations Induced by Non-Speech Audio"** (ICASSP 2025; [arXiv 2501.11378](https://arxiv.org/abs/2501.11378), [HTML](https://arxiv.org/html/2501.11378v1)), large-v3:
  - **40.3%** of 301k non-speech inferences produced hallucinations (121,378 of 301,317), and 9.1% of those were loops. Settings: English, temperature 0.
  - Most frequent phrases: "thank you" 24.8%, "thanks for watching" 10.3%, "so" 3.8%, "thank you for watching" 2.6%, "the" 2.5%, "you" 2.2%, "subtitles by the amara org community" 0.46%.
  - WER on **Common Voice speech clips (about 10 s, all correctly transcribed by Whisper) padded with 1–30 s of non-speech audio** before and/or after the speech (Table VII). NO means the noise does not overlap the speech; OL means it does. The table measures speech augmented with noise, **not** a pure non-speech set:

    | Pipeline | WER, NO | WER, OL |
    |---|---|---|
    | No processing | 104.8% | 112.0% |
    | **WebRTC VAD** | **68.3%** | 75.4% |
    | **Silero VAD** | **8.0%** | 10.8% |
    | Delooping + bag of hallucinations (BoH) | 17.1% | 21.1% |
    | **Silero + delooping + BoH** | **6.5%** | 9.4% |
- **Koenecke et al., "Careless Whisper"** (FAccT 2024; [arXiv 2402.08021](https://arxiv.org/abs/2402.08021), **stale?** but foundational):
  - About **1%** of transcriptions contained entire hallucinated phrases, and **38%** of those contained explicit harms such as violence or false associations.
  - Hallucinations were more common for speakers with **long pauses**.
  - This matters for safety: a hallucinated violent or sexual phrase could trip moderation, or be sent to the LLM as if the user had said it.

**Mitigation checklist** (✓ = Magic Worlds already does it):
1. **A neural VAD gate before Whisper** (Silero or TEN-class). Energy and WebRTC-style VAD let most non-speech through. Silero runs in under 1 ms per 30+ ms chunk on one CPU thread, at 8 or 16 kHz, MIT license ([repo](https://github.com/snakers4/silero-vad)). **✗ (both of today's VADs are energy-based).**
2. Whisper's own decode thresholds: `no_speech_prob > 0.6 & avg_logprob < −1`, `compression_ratio > 2.4`. **✓**
3. A bag-of-hallucinations filter in **both languages**. **✓** Today it only matches when the *whole* transcript is a known phrase. Also strip known phrases appended to real speech, such as "… Thank you." or "Subtítulos realizados por …".
4. Delooping (collapse repeated n-grams). Partly covered by the compression ratio.
5. Prompt hygiene: keep the prompt to names and terms, never sentences the model can "read back". **✓** (prompt-echo check). Never feed the previous transcript as the prompt (`condition_on_previous_text`-style loops).
6. Trim long leading and trailing silence. Pre-roll should be about 200–300 ms. **✓** (300 ms pre-roll, 200 ms trailing kept)
7. Minimum speech duration and minimum voiced ratio before sending. **✓** (`minSpeechMs`)
8. Treat a low-confidence transcript **during TTS playback** as likely echo or noise. Require stronger evidence for barge-in.
9. The structural fix is to move to a streaming transducer or CTC model, which has no free-running LM prior over silence. Hallucination largely disappears; the trade-off is weaker LM-style formatting.

---

## 8. Best practices: established, SOTA, emerging, pitfalls

### (a) Established best practice
- **Measure end-of-speech → final transcript (p50/p95/p99) and end-of-speech → first TTS audio** on your own traffic. Vendor latency numbers are often wrong by 2–5× (Gladia 270 ms claimed against 1.52 s measured).
- **16 kHz mono 16-bit PCM** is the universal sweet spot. Most models run at 16 kHz internally, and Groq and Whisper downsample to it anyway.
  - Exceptions: OpenAI realtime needs **24 kHz PCM**, and telephony uses 8 kHz μ-law (worse accuracy).
  - Resample once, with an anti-alias filter (the current worklet does this ✓).
  - Do not send MP3 or low-bitrate lossy input.
  - Opus (Ogg/WebM) is accepted by Deepgram and AssemblyAI. It is a reasonable browser → server uplink codec (about 10× less bandwidth than PCM's 256 kb/s) if the server forwards it or decodes it to PCM.
- **Chunking:** send 20–100 ms frames at real-time pace (Deepgram: 80 ms strongly recommended; AssemblyAI: 50–1,000 ms, paced). Silero works on about 32 ms frames.
- **Browser capture:** use `echoCancellation: true`, which is mandatory for barge-in while TTS plays from speakers. A/B test `noiseSuppression` and `autoGainControl`, because aggressive browser noise suppression can smear consonants. Some vendors offer server-side voice isolation instead (AssemblyAI "Voice Focus", ElevenLabs `filter_background_audio`).
- **Pass the known language** instead of auto-detecting on short clips. Lock the language per call unless code-switching is expected.
- **Vocabulary biasing:** about 20–50 high-value proper nouns (character name, user persona name, place and faction names from the active lorebook entries). Capitalize proper nouns, avoid common words, and update mid-session when the scene changes. Validate syntax, because Deepgram silently ignores malformed keyterms.
- **Keep the STT WS warm** (open at call start, KeepAlive messages). This avoids TLS and WS setup on the first turn.

### (b) Current SOTA and leading options (Oct 2026)
- **Accuracy plus speed:**
  - MAI-Transcribe-2-Streaming (2.5% / 0.13 s, $0.54/h).
  - AssemblyAI U3.6 Pro RT (3.6% / 0.19 s; 0.89% semantic WER).
  - ElevenLabs Scribe v2 RT (3.6% / 0.14 s).
  - Cartesia Ink-2 (3.4% / 0.43 s semantic; 1.14% semantic WER).
- **Best value:** Soniox v5 RT (4.5% / 0.054 s; 1.11% semantic WER; **$0.12/h**, 60+ languages, 8k-token context).
- **Integrated conversational STT (turn events):** Deepgram Flux (EagerEOT / TurnResumed), Cartesia Ink-2 (`eager_end` / `resume`), AssemblyAI U3 Pro (punctuation-aware turns, ForceEndpoint), Soniox (`<end>` semantic endpoint), ElevenLabs (`turn_prediction`).
- **Open:** Nemotron Speech Streaming EN (best tail latency, 221 / 238 ms), Nemotron 3.5 ASR Streaming (multilingual incl. es), Voxtral Mini 4B Realtime (Apache 2.0, es 3.3% FLEURS @480 ms).

### (c) Emerging and experimental techniques
- **Eager / speculative end-of-turn:** start the LLM (and even TTS) on an eager EOT or a stable partial, and cancel on `TurnResumed`. This cuts about 150–500 ms. Cost: +50–70% LLM calls (Deepgram).
- **Tunable delay at inference time:** Voxtral Realtime (80 ms – 2.4 s), OpenAI `transcription.delay` (minimal … xhigh), Nemotron `att_context_size` (80 ms – 1.12 s), Soniox `endpoint_latency_adjustment_level`. You can pick a lower delay for snappy back-and-forth and a higher one for long monologues.
- **Context-conditioned streaming ASR:** pass free-text scene context, not just keyword lists (Soniox `context.text`, AssemblyAI `prompt` up to 1,750 characters, OpenAI `prompt`, ElevenLabs `previous_text`). The last assistant utterance is a strong prior for the user's reply (names, the topic just raised). AssemblyAI now ships a dedicated field for this: **`agent_context`** (the agent's TTS text, up to 1,750 characters, updated after each reply on U3.5/U3.6 Pro).
- **LLM-judged "semantic WER"** for evaluation (Pipecat) and LLM post-correction of entity spellings against the lorebook. Post-correction adds latency, so do it for the stored transcript, not the live turn.
- **Audio-only turn-end models** layered on a VAD: Pipecat **Smart Turn v3.2** (about 8M parameters on a Whisper-Tiny backbone, 8 MB int8 CPU build, 23 languages incl. es, BSD-2; [repo](https://github.com/pipecat-ai/smart-turn)). Latency: "as little as 10 ms" on some CPUs, **under 100 ms on most cloud instances**, and about 65 ms on a standard Pipecat Cloud instance. Useful if Magic Worlds keeps its own segmentation.
- **On-device streaming STT** (Moonshine on WASM, Kyutai 1B on iPhone, NeMo-Speech.cpp GGUF). Privacy and zero cost per minute, but browser CPU budgets and Spanish quality are unproven.

### (d) Pitfalls and anti-patterns
- Fixed silence timeouts (800 ms+) as the **only** turn signal: they are slow on clear turn ends and still cut off slow or hesitant speakers.
- Hard max-segment cuts (7.5 s) that split one user turn into several LLM turns.
- Energy-only VAD in front of Whisper. Most hallucinations survive it (the WebRTC-VAD result above).
- Comparing batch WER with streaming WER, or English benchmarks with Spanish production audio.
- Speculating on **unstable partials**. Models with a high first-partial WER, such as Qwen3 Flash (20%) and Grok 1.0 (18%), will trigger wasted or wrong LLM calls.
- Session-billed streams left open while idle (AssemblyAI bills session duration). Close or gate them.
- Ignoring concurrency caps: Deepgram 150 streams on PAYG, AssemblyAI 100 new streams per minute, Gladia 30 sessions on self-serve.
- Sending audio faster than real time (AssemblyAI warns this produces inconsistent turns).
- Profanity masking enabled by default on some APIs (Azure `ProfanityOption`). In adult fiction, masked words corrupt the LLM input.
- Keyterm stuffing with common words or long phrases. Watch per-vendor limits: ElevenLabs allows only 20 characters per term, Whisper only 224 prompt tokens.
- Trusting the "first-partial" moment for barge-in without echo cancellation. TTS leakage then becomes "user speech".

---

## 9. Comparison summary for decision-making

| Option | Streaming finals (AA) | English accuracy | Spanish | Turn detection | Vocabulary / context | $/h | Fit for Magic Worlds |
|---|---|---|---|---|---|---|---|
| Soniox stt-rt-v5 | 54 ms | 4.5% AA / 1.11% sem | ✓ (60+ langs, auto LID) | Semantic `<end>`, tunable | **8k-token context + terms** | **0.12** | ★★★ best value, great for names |
| AssemblyAI U3.6 Pro RT | 192 ms | 3.6% / **0.89%** | ✓ (32 langs, code-switch) | Punctuation-aware turns + ForceEndpoint; `mode` presets | prompt 1,750 chars, 100 keyterms (whether they combine is unverified), **`agent_context`** 1,750 chars | 0.45 (session-billed) | ★★★ accuracy pick |
| Deepgram Flux (multi) | 21 ms (transcript), about 260 ms EOT (vendor) | 7.4% (EN model) | ✓ (10 langs, hints) | **Eager EOT / TurnResumed** | 100 keyterms (multi unconfirmed) | 0.39–0.47 (+0.08 keyterms) | ★★ turn-taking pick, weaker accuracy |
| ElevenLabs Scribe v2 RT | 141 ms | 3.6% / 3.05% sem | ✓ (90+) | `turn_prediction` / VAD / manual | 50 keyterms of ≤20 chars + `previous_text` | 0.39 (+0.08) | ★★ single-vendor with current TTS |
| Cartesia Ink-2 | 67–431 ms | 3.4–4.0% / 1.14% | ✓ (5 langs; es since Sept 2026) | Full turn lifecycle incl. eager | keyterm prompting (since July 2026; limits not checked) | ~0.24 (AA) | ★★ if Cartesia TTS is adopted |
| MAI-Transcribe-2-Streaming | 128 ms | **2.5%** | ✓ (60, auto) | n/d | n/d | 0.54 intro (through 2026) | ★★ watch; new (2026-10-01; Foundry / Azure Voice Live) |
| Speechmatics Linden 1 | 157 ms | 4.4% / 1.11% | ? (55+, es not called out) | Pause-based (smart turn in EA) | 1,000 words | 0.30 (→0.16) | ★ |
| OpenAI gpt-live-transcribe | 812 ms | 3.9% | ✓ | client VAD only | prompt + keywords | 1.02 | ✗ slow and pricey |
| Groq whisper-large-v3 (batch) | n/a (≈ endpoint + 150–500 ms) | AA 4.6% (turbo) | ✓ 3.35% OASR | none | 224-token prompt | 0.111 (10 s min) | current baseline / fallback |
| Nemotron 3.5 ASR Streaming (self-host) | ~250 ms | 4.54% sem (old judge) | ✓ (FLEURS 4.1–5%) | none (pair with VAD + Smart Turn) | GPU-PB (verify streaming) | GPU cost | ★ only at scale or for privacy |
| Voxtral Mini 4B RT (self-host) | 0.5–1.1 s | 5.2% (hosted) | ✓ 3.3% FLEURS @480 ms | none | n/d | GPU cost | ★ Apache 2.0 option |

---

## 10. Implications for Magic Worlds (prioritized)

**P0. Cheap, no vendor change (days):**
1. **Instrument the STT leg.** Log per turn:
   - client `speech_end` timestamp (`at_ms`) → segment received → Groq response (`latency_ms` exists) → LLM first token → first TTS byte, as p50/p95 by language;
   - billed vs actual audio seconds (the Groq 10 s minimum);
   - no-speech and hallucination drop rates by reason.

   Without this, no STT swap can be judged.
2. **Add a Silero VAD check server-side** (ONNX, <1 ms per 32 ms frame) before calling Groq. Optionally also run it in the browser via onnxruntime-web, replacing or augmenting the RMS gate.
   - Reject segments with <~250 ms of Silero-voiced audio.
   - Evidence: in the ICASSP 2025 study, on speech padded with non-speech noise, WER falls from 68% with WebRTC VAD to 8% with Silero.
3. **Extend the BoH filter** to strip hallucinated *suffixes or prefixes* on otherwise-real transcripts ("…Thank you.", "Subtítulos realizados por la comunidad de Amara.org"), not only whole-transcript matches. Add delooping.
4. **Shrink the silence wait safely.** Drop `silenceMsToEnd` from 800 to ~500 ms *and* add a turn-completion check: Smart Turn v3.2 (audio, 23 langs incl. es, about 10–100 ms on CPU depending on the host) or a quick text heuristic on the Whisper transcript (does it end in terminal punctuation or a complete clause?). If the check says "incomplete", wait up to ~1.2 s. Expected gain is about 200–400 ms per turn.
5. **Vocabulary prompt.** Keep it to names and terms only, within Groq's 224 tokens: the character name, the user persona name, and the top lorebook entity names. Make sure the Spanish and English spellings are both included when they differ.

**P1. Adopt streaming STT behind the existing `SpeechToTextProvider` seam (weeks):**
1. **Architecture:**
   - The client streams 16 kHz PCM (or Opus) continuously in 20–100 ms frames over the existing call WS.
   - The backend proxies to a vendor streaming WS opened at call start (warm), pushing keyterms and context at session start and via mid-session updates.
   - Keep the client VAD for UI, barge-in pre-signal and optional cost gating.
   - Keep Groq batch as an automatic **fallback** when the streaming WS fails.
2. **Shortlist for a bake-off** (2–3 vendors):
   - **Soniox stt-rt-v5**: $0.12/h, fastest finals, 60+ languages, 8k-token `context` for names and lorebook, tunable semantic endpointing.
   - **AssemblyAI U3.6 Pro RT**: top accuracy, 32 langs with code-switching, prompt + keyterms, `agent_context` (feed the character's last line), ForceEndpoint; mind the session-time billing.
   - **Deepgram Flux-multi**: if eager EOT / speculative LLM is the priority. Verify Spanish quality and keyterms on the multi model first.
   - **ElevenLabs Scribe v2 RT**: only if consolidating vendors matters more than accuracy (the 3.05% Pipecat semantic WER is weaker).
   - **Cartesia Ink-2**: only if Cartesia Sonic TTS is adopted.
3. **Bake-off protocol:**
   - 300–500 real, consented call utterances split about 50/50 en/es, including fantasy names, whispers and emotional delivery, background noise, and short replies ("sí", "no", "ajá").
   - Metrics: semantic WER (LLM-judged), **name/entity accuracy**, TTFS p50/p95/p99, false endpoint rate (cut-offs), missed endpoint rate (dead air), hallucinations on silence and noise, and barge-in false positives during TTS playback.
4. **Content and privacy gate:** before switching, confirm each vendor's acceptable-use terms for adult fiction audio, data retention and zero-retention availability, and that no profanity masking or redaction is on by default.

**P2. Exploit streaming (after P1):**
1. **Eager EOT → speculative LLM:** start the callbot graph on eager EOT or stable final text. Cancel or restart on resume, and only start TTS once the EOT is confirmed. Budget for +50–70% LLM calls.
2. **Word-confirmed barge-in:** truncate TTS only when the STT returns ≥1–2 real words (or Silero speech ≥300 ms plus a partial), not on raw energy. This cuts false interruptions from coughs, laughter and echo.
3. **Live captions** from partials in the call UI. This also gives users visible feedback that they were heard.
4. **Lift the 8 s segment cap.** With streaming, user monologues stay one turn.
5. **Two-pass transcripts (optional):** keep the streaming final for the live turn, and asynchronously re-transcribe with a batch model (Groq turbo $0.04/h or Soniox async $0.10/h) for stored history, memory and moderation, if the bake-off shows a material accuracy gap.
6. **Self-hosting** (Nemotron 3.5 ASR Streaming or Voxtral Mini 4B Realtime) only if sustained concurrency or zero-retention requirements justify running GPUs.

---

## Sources

| # | Source | Date |
|---|---|---|
| 1 | Artificial Analysis, Speech-to-Text Streaming leaderboard (AA-WER Streaming): https://artificialanalysis.ai/speech-to-text/streaming | live; data extracted 2026-10-20 |
| 2 | Artificial Analysis, Speech-to-Text (batch AA-WER v2): https://artificialanalysis.ai/speech-to-text | live; accessed 2026-10-20 |
| 3 | Artificial Analysis on X (MAI-Transcribe-2-Streaming #1): https://x.com/ArtificialAnlys/status/2105694108736188894 | ~2026-10-01 |
| 4 | TechCity Authority, "Microsoft AI's first streaming transcription model tops accuracy leaderboard": https://www.techcityauthority.com/2026/10/microsoft-ai-streaming-transcription-model.html | 2026-10 |
| 5 | Pipecat STT benchmark (README results): https://github.com/pipecat-ai/stt-benchmark | updated Sept 2026 |
| 6 | Daily, "Benchmarking STT for Voice Agents": https://www.daily.co/blog/benchmarking-stt-for-voice-agents/ | 2026-02-13 |
| 7 | Soniox, hosted Pipecat benchmark snapshot: https://soniox.com/benchmarks | Aug 2026 (vendor-hosted) |
| 8 | Open ASR Leaderboard paper (arXiv 2510.06961): https://arxiv.org/abs/2510.06961 | v4 2026-03-30 |
| 9 | Open ASR Leaderboard space + data (`hf-audio/multilingual_evals` es CSV, `hf-audio/open-asr-leaderboard-results` en CSV): https://huggingface.co/spaces/hf-audio/open_asr_leaderboard | accessed 2026-10-20 |
| 10 | Coval, "Best STT Providers 2026": https://www.coval.ai/blog/best-speech-to-text-providers-in-2026-independent-benchmarks-and-how-to-choose/ | 2026-06-04 |
| 11 | Deepgram Flux quickstart: https://developers.deepgram.com/docs/flux/quickstart | accessed 2026-10-20 |
| 12 | Deepgram Flux multilingual & language prompting: https://developers.deepgram.com/docs/flux/language-prompting | accessed 2026-10-20 |
| 13 | ~~Deepgram changelog, Flux Multilingual GA: https://developers.deepgram.com/changelog/2026/4/15~~. On re-check this page is the Deepgram CLI announcement and does not mention Flux. Use the changelog index instead: https://developers.deepgram.com/changelog | GA date unverified |
| 14 | Deepgram Keyterm Prompting docs: https://developers.deepgram.com/docs/keyterm | accessed 2026-10-20 |
| 15 | Deepgram pricing: https://deepgram.com/pricing | accessed 2026-10-20 |
| 16 | Deepgram GitHub discussion #1605 (Spanish/bilingual accuracy): https://github.com/orgs/deepgram/discussions/1605 | 2026-05-08 |
| 17 | AssemblyAI vs Deepgram (competitor claims on Flux EOT): https://assemblyai.com/blog/assemblyai-vs-deepgram-best-voice-agent-api | n/d (vendor) |
| 18 | AssemblyAI models page: https://www.assemblyai.com/docs/getting-started/models | accessed 2026-10-20 |
| 19 | AssemblyAI pricing: https://www.assemblyai.com/pricing | accessed 2026-10-20 |
| 20 | AssemblyAI Universal-3 Pro streaming API reference: https://www.assemblyai.com/docs/api-reference/streaming-api/universal-3-pro-streaming | accessed 2026-10-20 |
| 21 | AssemblyAI streaming model selection: https://www.assemblyai.com/docs/streaming/universal-3-pro | accessed 2026-10-20 |
| 22 | AssemblyAI, Multilingual Universal-Streaming launch: https://www.assemblyai.com/blog/introducing-multilingual-universal-streaming | 2025-11-12 |
| 23 | Soniox pricing: https://soniox.com/pricing | accessed 2026-10-20 |
| 24 | Soniox endpoint detection docs: https://soniox.com/docs/stt/rt/endpoint-detection | accessed 2026-10-20 |
| 25 | Soniox context docs: https://soniox.com/docs/stt/concepts/context | accessed 2026-10-20 |
| 26 | Speechmatics, Agent STT / Linden 1 launch: https://www.speechmatics.com/company/articles-and-news/meet-agent-stt-powered-by-linden-1-fast-accurate-speech-recognition | 2026-09-17 |
| 27 | Speechmatics press release (GlobeNewswire): https://www.globenewswire.com/news-release/2026/09/17/3364138/0/en/speechmatics-launches-agent-stt-for-the-speech-errors-that-derail-voice-agents.html | 2026-09-17 |
| 28 | Gladia pricing: https://www.gladia.io/pricing | accessed 2026-10-20 |
| 29 | Gladia real-time product page: https://www.gladia.io/product/real-time | accessed 2026-10-20 (vendor) |
| 30 | ElevenLabs STT overview: https://elevenlabs.io/docs/capabilities/speech-to-text | accessed 2026-10-20 |
| 31 | ElevenLabs realtime STT API reference: https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime | accessed 2026-10-20 |
| 32 | ElevenLabs API pricing: https://elevenlabs.io/pricing/api | accessed 2026-10-20 |
| 33 | OpenAI realtime transcription guide: https://developers.openai.com/api/docs/guides/realtime-transcription | accessed 2026-10-20 |
| 34 | OpenAI realtime VAD guide: https://developers.openai.com/api/docs/guides/realtime-vad | accessed 2026-10-20 |
| 35 | OpenAI pricing: https://developers.openai.com/api/docs/pricing | accessed 2026-10-20 |
| 36 | OpenAI deprecations (2026-08-26 transcription models): https://developers.openai.com/api/docs/deprecations | accessed 2026-10-20 |
| 37 | Digital Applied, GPT Transcribe vs Whisper/Deepgram/Scribe v2: https://www.digitalapplied.com/blog/openai-gpt-transcribe-stt-model-comparison-2026 | 2026-08-06 |
| 38 | Groq Speech-to-Text docs: https://console.groq.com/docs/speech-to-text | accessed 2026-10-20 |
| 39 | Cartesia Ink 2 docs: https://docs.cartesia.ai/build-with-cartesia/stt/latest | accessed 2026-10-20 |
| 40 | Cartesia, "Best speech-to-text models": https://www.cartesia.ai/learn/best-speech-to-text-models | 2026-10-02 (vendor) |
| 41 | Google Speech-to-Text release notes (Chirp 3 GA): https://docs.cloud.google.com/speech-to-text/docs/release-notes | accessed 2026-10-20 |
| 42 | Azure Speech SDK ProfanityOption: https://learn.microsoft.com/en-us/python/api/azure-cognitiveservices-speech/azure.cognitiveservices.speech.profanityoption | updated 2025-02-27 |
| 43 | NVIDIA Parakeet TDT 0.6B v3 model card: https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3 | 2025-08-14 (stale?) |
| 44 | NVIDIA Nemotron Speech Streaming EN 0.6B: https://huggingface.co/nvidia/nemotron-speech-streaming-en-0.6b | 2026-03-13 |
| 45 | NVIDIA Nemotron 3.5 ASR Streaming 0.6B: https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b | 2026-06-04 |
| 46 | NVIDIA NeMo word boosting docs: https://docs.nvidia.com/nemo-framework/user-guide/latest/nemotoolkit/asr/asr_customization/word_boosting.html | accessed 2026-10-20 |
| 47 | Kyutai delayed-streams-modeling repo: https://github.com/kyutai-labs/delayed-streams-modeling | accessed 2026-10-20 (models mid-2025, stale?) |
| 48 | Kyutai stt-1b-en_fr model card: https://huggingface.co/kyutai/stt-1b-en_fr | accessed 2026-10-20 |
| 49 | Mistral Voxtral Mini 4B Realtime 2602 model card: https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602 | Feb 2026 |
| 50 | Moonshine Voice repo: https://github.com/moonshine-ai/moonshine | accessed 2026-10-20 |
| 51 | Moonshine Voice docs: https://moonshine-voice.readthedocs.io/en/latest/ | accessed 2026-10-20 |
| 52 | Moonshine paper (arXiv 2410.15608): https://arxiv.org/abs/2410.15608 | 2024-10-21 (stale) |
| 53 | Macháček et al., Whisper-Streaming (arXiv 2307.14743): https://arxiv.org/abs/2307.14743 | 2023 (stale) |
| 54 | SimulStreaming repo: https://github.com/ufal/SimulStreaming | IWSLT 2025 |
| 55 | WhisperLive repo: https://github.com/collabora/WhisperLive | accessed 2026-10-20 |
| 56 | faster-whisper repo: https://github.com/SYSTRAN/faster-whisper | accessed 2026-10-20 |
| 57 | Barański et al., Whisper hallucinations induced by non-speech audio (ICASSP 2025): https://arxiv.org/abs/2501.11378 · https://arxiv.org/html/2501.11378v1 | 2025-01-20 |
| 58 | Koenecke et al., "Careless Whisper" (arXiv 2402.08021): https://arxiv.org/abs/2402.08021 | 2024 (stale, foundational) |
| 59 | Silero VAD repo: https://github.com/snakers4/silero-vad | accessed 2026-10-20 |
| 60 | Pipecat Smart Turn (v3.2): https://github.com/pipecat-ai/smart-turn | accessed 2026-10-20 |
| 61 | Local code (evidence of the current pipeline): `magic-worlds-api/src/services/voice_orchestration/stt_groq_client.py`, `server_vad.py`, `config.py`; `magic-worlds/src/features/interaction/audio/voiceVadProcessor.worklet.js` | read 2026-10-20 |
| 62 | Soniox models and release history: https://soniox.com/docs/stt/models | accessed 2026-10-20 |
| 63 | Cartesia changelog (Ink-2 timeline): https://docs.cartesia.ai/changelog | accessed 2026-10-20 |
| 64 | Mistral models overview (Voxtral Mini Transcribe Realtime 3): https://docs.mistral.ai/getting-started/models/models_overview/ | accessed 2026-10-20 |
| 65 | Azure Speech REST API for short audio (`profanity` default `masked`): https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short | updated 2026-06-05 |
| 66 | Deepgram changelog index (Nova-3 / Flux Configure updates, Sept–Oct 2026): https://developers.deepgram.com/changelog | accessed 2026-10-20 |

---

## Fact-check log (2026-10-20)

Method: a skeptical second pass over the most load-bearing claims, checked against primary pages by direct fetch. The shared web-search budget was already exhausted, so no new search-engine discovery was possible, and newer developments were found only through the primary pages fetched. The Artificial Analysis values were re-extracted from the page's embedded JSON, all 47 entries.

| # | Claim (as originally written) | Verdict | Correction / note | Source |
|---|---|---|---|---|
| 1 | AA streaming table values (MAI 2.51% / 0.128 s / $0.54/h; Soniox v5 4.50% / 0.054 s / $0.12/h; U3.6 Pro 3.57% / 0.192 s; Scribe v2 RT 3.59% / 0.141 s; Nova-3 6.59%; Flux 7.39% / 0.021 s; Gladia 1.523 s; and the rest) | Confirmed | All re-extracted values match. Added the skipped Modulate (4.77%, about $0.05/h) and Smallest Pulse (4.98%) rows, plus AA release dates. | https://artificialanalysis.ai/speech-to-text/streaming |
| 2 | MAI-Transcribe-2-Streaming took #1 in early Oct 2026; 60 languages, auto-detect, $0.54/h intro through end of 2026 | Confirmed | AA release date 2026-10-01. Added availability: Foundry, MAI Playground, Vercel and Azure Voice Live, with LiveKit "coming soon". | https://www.techcityauthority.com/2026/10/microsoft-ai-streaming-transcription-model.html |
| 3 | Pipecat STT benchmark table (semantic WER, TTFS median / p95, † older judge) | Confirmed | All rows match the README. Added the judge (Claude Sonnet 5.5; † = Sonnet 4.5) and the dataset (smart-turn-data-v3.1-train). The p99 values are also in the README itself. | https://github.com/pipecat-ai/stt-benchmark |
| 4 | Daily blog 2026-02-13: 200 ms Silero stop, Flux excluded, apps wait for p95 without finalization | Confirmed | None. | https://www.daily.co/blog/benchmarking-stt-for-voice-agents/ |
| 5 | Deepgram Flux: `/v2/listen`, the event set, eot_threshold 0.5–1.0 (default 0.7), eager 0.3–0.9, eot_timeout_ms 500–60,000 (default 5,000), 80 ms chunks, eager EOT +50–70% LLM calls, Configure | Confirmed | None. | https://developers.deepgram.com/docs/flux/quickstart |
| 6 | Flux Multilingual (`flux-general-multi`) GA since 2026-04-15, citing changelog/2026/4/15 | Corrected (date unverified) | The model and its 10 languages, including es, are confirmed. The cited changelog page is the Deepgram CLI announcement, and no GA date was found. | https://developers.deepgram.com/docs/flux/language-prompting ; https://developers.deepgram.com/changelog/2026/4/15 |
| 7 | Deepgram keyterms: 100 terms / 500 tokens; mid-stream replace via Configure | Corrected (nuance) | The 500-token cap is the hard limit, and "100" is guidance only. Mid-stream Nova-3 keyterm updates are new (2026-10-02, global endpoint only), and ConfigureSuccess/Failure acks were added 2026-10-19. Keyterms on flux-general-multi remain unconfirmed. | https://developers.deepgram.com/docs/keyterm ; https://developers.deepgram.com/changelog |
| 8 | Deepgram PAYG pricing (Flux EN $0.0065, Flux Multi $0.0078, Nova-3 $0.0048 / $0.0058, keyterm +$0.0013, diarization $0.002 per min; concurrency 150 / 225), "promotional" | Confirmed | Only Flux EN and the Nova-3 rates carry strikethrough promo pricing. Flux Multi and the add-ons do not. | https://deepgram.com/pricing |
| 9 | AssemblyAI `universal-3-6-pro` is the default streaming model, 32 languages, $0.45/h, session-duration billing, 100 new streams per minute | Confirmed | The models overview page is stale: it still names U3.5 Pro as recommended, with 18 languages. Added the AA release date of 2026-09-29. | https://www.assemblyai.com/docs/streaming/universal-3-pro ; https://www.assemblyai.com/pricing |
| 10 | AssemblyAI: `prompt` (1,750 chars) and `keyterms_prompt` (100) "cannot be combined" | Unverified | The docs list both but do not state exclusivity. Marked (unverified). **Missed features added:** `agent_context` (the agent's last TTS text, 1,750 chars) and `mode` presets. | https://www.assemblyai.com/docs/api-reference/streaming-api/universal-3-pro-streaming |
| 11 | Soniox: $0.12/h RT, $0.10/h async, 60+ languages, context billed at $4/1M tokens; context up to 8,000 tokens (about 10k characters); endpoint params and suggested 2 / 0.3 / 1,500 ms | Confirmed | None. | https://soniox.com/pricing ; https://soniox.com/docs/stt/concepts/context ; https://soniox.com/docs/stt/rt/endpoint-detection |
| 12 | Soniox v5 release timing "unclear (June or October 2026)" | Corrected | `stt-rt-v5` was released 2026-06-16. v4 was removed 2026-06-30 and now aliases to v5. | https://soniox.com/docs/stt/models |
| 13 | ElevenLabs Scribe v2 RT: endpoint, formats, commit_strategy incl. `turn_prediction`, `previous_text` on the first chunk only, zero retention enterprise-only, 50 keyterms of ≤20 chars, $0.39/h + $0.08/h keyterms, batch $0.22/h | Confirmed | No Scribe v3 is listed. | https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime ; https://elevenlabs.io/docs/capabilities/speech-to-text ; https://elevenlabs.io/pricing/api |
| 14 | OpenAI: gpt-live-transcribe has no server or semantic VAD, 24 kHz PCM, delay minimal…xhigh, no word timestamps; $0.017/min; whisper-1 and the gpt-4o-(mini-)transcribe(-diarize) models deprecated 2026-08-26, shutdown 2027-02-26 | Confirmed | Added: the guide's second model is `gpt-transcribe` (WebSocket-only), `gpt-realtime-whisper` is absent from the guide, and the keywords syntax rules. | https://developers.openai.com/api/docs/guides/realtime-transcription ; https://developers.openai.com/api/docs/pricing ; https://developers.openai.com/api/docs/deprecations |
| 15 | Groq: large-v3 $0.111/h (189×), turbo $0.04/h (216×), 10 s minimum billing, 224-token prompt, 16 kHz downsampling, WAV for lowest latency, verbose_json fields; AA turbo 4.6% | Confirmed | AA batch: Groq turbo AA-WER 4.62% at $0.667 per 1k min. | https://console.groq.com/docs/speech-to-text ; https://artificialanalysis.ai/speech-to-text |
| 16 | Speechmatics Agent STT / Linden 1, launched 2026-09-17: 55+ languages, 1,000 words, pause-based turns, "smart turn in early access", ~350 ms mean / ~440 ms p95, $0.30 → $0.16/h | Corrected (minor) | Smart turn detection is "coming soon", not in early access. Everything else is confirmed. | https://www.speechmatics.com/company/articles-and-news/meet-agent-stt-powered-by-linden-1-fast-accurate-speech-recognition |
| 17 | Cartesia Ink-2: docs date 2026-09-17; "launched 2026-06-16 with Sonic-3.5"; languages en/fr/hi/ja/es; vocabulary n/d | Corrected | The changelog says Ink-2 launched in **May 2026** (English); Sonic 3.5 went GA in May; turn controls came in June; **keyterm prompting in July**; multilingual (es/fr/hi/ja) in **September 2026**. The 3 credits/s and $0.39/h pricing is unverified. | https://docs.cartesia.ai/changelog ; https://docs.cartesia.ai/build-with-cartesia/stt/latest ; https://www.cartesia.ai/learn/best-speech-to-text-models |
| 18 | Gladia: €0.68/h real-time, 30 concurrent sessions, diarization async-only; Solaria-3 async-only and RT on Solaria-1 | Partly confirmed | Price, concurrency and diarization are confirmed. The pricing page does not say which model serves RT; AA's RT entry is `solaria-1`. | https://www.gladia.io/pricing |
| 19 | OASR Spanish (batch) table: azure-speech-06-2026 #1 at 2.25; whisper-large-v3 3.35; and the rest | Confirmed | All values match. Added the missed newer snapshot `azure-speech-07-2026` (2.30). | https://huggingface.co/datasets/hf-audio/multilingual_evals/resolve/main/multilingual_es.csv |
| 20 | Nemotron 3.5 ASR Streaming 0.6B: 2026-06-04, OpenMDW-1.1, 40 locales incl. es-US / es-ES, FLEURS-es 4.87 / 4.39 / 4.11 (auto 5.04 / 4.48 / 4.13) | Confirmed | None. | https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b |
| 21 | Nemotron Speech Streaming EN 0.6B: 2026-03-13, NVIDIA Open Model License, chunk WERs 8.43 / 7.67 / 7.07 / 6.93, Transformers ≥5.13, GGUF | Confirmed | None. | https://huggingface.co/nvidia/nemotron-speech-streaming-en-0.6b |
| 22 | Voxtral Mini 4B Realtime 2602: Apache 2.0, 13 languages, delay 80 ms – 2.4 s (default 480), FLEURS-es 5.34 / 4.59 / 3.31 / 2.98, ≥16 GB GPU | Confirmed | **Missed newer model added:** Voxtral Mini Transcribe Realtime 3 (hosted "Premier", not open; configurable latency and turn detection; AA-dated 2026-10-20). | https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602 ; https://docs.mistral.ai/getting-started/models/models_overview/ |
| 23 | Barański et al. (ICASSP 2025): 40.3% of non-speech inferences hallucinated; "WER on the non-speech set" 104.8 → WebRTC 68.3 → Silero 8.0 → Silero + BoH 6.5 | Corrected (framing) | 40.3%, the 9.1% loop share, the phrase frequencies and the WER numbers are confirmed. But the WER table is measured on **Common Voice speech padded with non-speech noise** (NO; the OL column was added), not on a pure non-speech set. The step from "energy VAD" to "WebRTC VAD" is our inference. | https://arxiv.org/html/2501.11378v1 |
| 24 | Koenecke et al., "Careless Whisper": ~1% of transcriptions hallucinated, 38% of those harmful, more common with longer non-vocal durations | Confirmed | None. | https://arxiv.org/abs/2402.08021 |
| 25 | Smart Turn v3.2: ~8M params, 23 languages incl. es, "about 10–65 ms on CPU", BSD-2 | Corrected | About 10 ms on fast CPUs, **under 100 ms on most cloud instances**, and about 65 ms on Pipecat Cloud. Not "≤65 ms CPU". | https://github.com/pipecat-ai/smart-turn |
| 26 | Azure profanity default "historically Masked; verify" | Confirmed | The REST API documents `profanity` default = `masked`. | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short |
| 27 | Kyutai STT: 1B en/fr with 0.5 s delay and semantic VAD; 2.6B en with 2.5 s; H100 400 streams; L40S 64 connections; CC-BY-4.0; no Spanish | Confirmed | None. | https://github.com/kyutai-labs/delayed-streams-modeling |
| 28 | Moonshine Voice STT languages include es | Unverified | The README and docs overview do not list languages. Marked (unverified). | https://github.com/moonshine-ai/moonshine ; https://moonshine-voice.readthedocs.io/en/latest/models/ |
| 29 | Silero VAD <1 ms per 30+ ms chunk on one CPU thread, 8 / 16 kHz, MIT; faster-whisper VAD default removes only >2 s silences, up to 4× faster | Confirmed | None. | https://github.com/snakers4/silero-vad ; https://github.com/SYSTRAN/faster-whisper |
| 30 | Coval: streaming WER 1–3 pp worse than batch; code-switching 5% → 15–20% | Confirmed (secondary source) | Coval cites no underlying study for either claim. | https://www.coval.ai/blog/best-speech-to-text-providers-in-2026-independent-benchmarks-and-how-to-choose/ |
| 31 | Google Chirp 3 GA on STT V2 with streaming, diarization, auto LID, denoiser, adaptation | Confirmed | GA was 2025-10-13. The release notes have no 2026 STT entries and no Chirp 4. | https://docs.cloud.google.com/speech-to-text/docs/release-notes |
| 32 | AssemblyAI Multilingual Universal-Streaming launch 2025-11-12: 6 languages, 11.77% vs Nova-3 12.76%, p50 303 ms | Confirmed (vendor) | No Spanish-only figure was published. | https://www.assemblyai.com/blog/introducing-multilingual-universal-streaming |

Not re-checked here, so the original wording stands: Inworld, Zoom, Reson8, Sarvam, Alebex, and Meta Muse availability and terms (AA numbers only); NeMo GPU-PB streaming support; SimulStreaming and WhisperLive details; the AssemblyAI competitor claim about Flux EOT.
