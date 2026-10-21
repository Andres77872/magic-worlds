# R10 — Cost, scaling and operations for realtime voice agents

> Cascaded (STT → LLM → TTS) vs speech-to-speech (S2S/omni), hosted vs self-hosted.
> Research date: **2026-10-20**. Author: research subagent (voice-AI cost/ops track).
> Evidence for `docs/call_realtime/`. Prices are list prices read from vendor pages on 2026-10-20 unless a date is given. "Vendor-reported" marks numbers that come from the vendor and have not been checked independently.

**How this was researched.** About 25 web searches plus direct reads of pricing pages, docs and rate-limit pages (OpenAI, Google Gemini, Deepgram, AssemblyAI, Groq, ElevenLabs, Fish Audio, Cartesia, Soniox, LiveKit, Pipecat/Daily, NVIDIA, Hugging Face, Baseten, Artificial Analysis). I also read the Magic Worlds backend (`/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/*`, `src/services/speech/*`) to tie the recommendations to the current code.

**Limitation.** The shared web-search budget ran out partway through. After that I only fetched known primary URLs directly. Three things could not be confirmed from official pages: Amazon's own Nova 2 Sonic price table (the AWS pricing page did not render its tables), Groq's rate limits for paid tiers, and how Fish Audio counts concurrency for streaming WebSockets. These are marked **[unverified]**.

---

## 0. Key findings

1. **TTS is most of the variable cost in a cascaded stack.** In the reference 10-minute roleplay call (§1), STT costs about $0.001–0.008/min. The LLM costs about $0.001–0.003/min with prompt caching, or $0.005–0.017/min without it. TTS costs $0.007–0.055/min depending on vendor. For the current ElevenLabs v4 Turbo lane, TTS is roughly 85–90% of the per-minute bill (§3).
2. **The cheapest full cascaded stacks cost about $0.010–0.021 per minute at list prices** (range widened in the fact-check: Inworld's own on-demand TTS prices are higher than the AA-listed ones). With premium cloned-voice TTS (ElevenLabs v4 Turbo) the figure is about $0.03/min, and with ElevenLabs v4 non-Turbo about $0.06/min. Bundled hosted "voice agent" products charge $0.05–0.08/min plus LLM. Examples: AssemblyAI Voice Agent $0.075/min all-in, Deepgram Voice Agent $0.075/min, ElevenLabs Agents $0.08/min + LLM, Cartesia agents $0.06/min, OpenAI GPT-Live-1 $0.05/min + backend LLM.
3. **S2S cost depends mainly on whether caching holds.** OpenAI Realtime bills the whole conversation again on every response. In the 10-minute call, `gpt-realtime-2.1` costs about **$0.06/min with caching and about $0.61/min without**. At 30 minutes the uncached figure is about $1.65/min. `gpt-realtime-2.1-mini` costs about $0.02/min cached and $0.18/min uncached. Changing instructions or tools mid-call, or truncation, breaks the cache ([OpenAI realtime costs guide](https://developers.openai.com/api/docs/guides/realtime-costs)).
4. **Gemini Live's per-token prices are low**, at $3/M audio in and $12/M audio out (about $0.005 and $0.018 per audio-minute). The real per-minute cost could be anywhere from **$0.011/min to about $0.10/min**, because the docs do not say whether accumulated context is billed again on every turn. Measure it with `usageMetadata` before committing. Sessions also have operational limits: a connection lasts about 10 minutes, and audio-only sessions are capped at 15 minutes unless context compression is enabled ([Gemini Live session docs](https://ai.google.dev/gemini-api/docs/live-session)).
5. **New this quarter: per-connected-minute S2S pricing.** OpenAI **GPT-Live-1** (API release 2026-09-10 per press coverage; the OpenAI model page gives no date) costs $0.05/min, billed per second, with the backend reasoning model billed separately. **Eleven Realtime v1 Mini/Max** (launch date 2026-10-20 per launch coverage, not stated on the primary page, (unverified)) is OpenAI-Realtime-compatible over WebSocket only. ElevenLabs' API pricing page lists it at $0.08 per additional connected audio minute **plus its own token charges**: Mini $0.20 in / $6.00 out per 1M tokens, Max $1.80 / $9.00 per 1M; burst above concurrency $0.16/min. Per-minute billing removes the context-replay risk but charges for silence.
6. **For Magic Worlds, voice identity and content policy rule out S2S as the main lane at present.** Cloned or custom character voices are limited or sales-gated on the S2S providers:
   - OpenAI: voices *from recordings* are limited to eligible customers via sales (usable with GPT-Live, Realtime, TTS and Chat Completions audio). Prompt-designed voices ("voice from a description") are open to all API customers but **work only with GPT-Live**, GPT-Live custom voices support English accents only, and the prompt-voice policy forbids imitating public figures or fictional characters ([OpenAI custom voices](https://developers.openai.com/api/docs/guides/custom-voices)).
   - Google: the Gemini **TTS** models (`gemini-3.8-flash-tts`, `gemini-3.8-flash-lite-tts`) now support consent-gated **voice replication** and **voice design** (200 stored voices per project). Whether replicated voices can be used in **Gemini Live** is not stated in the Live docs (unverified).
   - Eleven Realtime uses the ElevenLabs voice library (17.5k+ voices); cloned-voice support is not stated.
   Cascaded keeps any cloned voice, any LLM (including permissive ones) and per-stage cost control.
7. **Self-hosting pays for itself early on GPU cost alone, and late once engineering is counted.** Self-hosted TTS on an H100 at about $2.75/h, assuming ~48 concurrent calls per GPU, costs about $0.001–0.003 per call-minute. A two-GPU minimum (N+1) costs about $4k/month. That breaks even against ElevenLabs Turbo at about 145k call-min/month and against Fish at about 375k. If 0.5 FTE of ops/ML engineering (~$8k/month) is added, break-even moves to about 435k (ElevenLabs Turbo) and about 1.1M (Fish) call-min/month. The bigger obstacle is not cost. Few open models offer zero-shot cloning quality comparable to ElevenLabs or Fish under a commercial licence and with Spanish support (§4).
8. **Concurrency caps limit scale before cost does.**
   - ElevenLabs TTS concurrency: Pro 20 / Scale 30 / Business 30 for Flash/Turbo, half that for other models. Over WebSocket only active generation counts, requests queue for about 50 ms, then return 429.
   - Fish: 5/15/50 concurrent requests by cumulative spend, shared by every key and including ASR, with 429 and no `Retry-After`.
   - Groq Whisper: the docs table shows **20 RPM / 7.2k audio-seconds per hour** (the page has Free and Developer tabs and calls the table "base limits for the Developer plan"; which tab the values belong to is unclear). At about 4 utterances per call-minute that is only ~5 concurrent calls.
   - Gemini has **spend-based** limits *in addition to* RPM/TPM/RPD: $10 / $50 / $200 per rolling 10 minutes for Tier 1/2/3, applied depending on billing history and account standing, returning `429 RESOURCE_EXHAUSTED`.
9. **Stateful sessions need connection-aware ops:**
   - Fail readiness on SIGTERM.
   - Keep the grace period at least as long as the maximum call length. LiveKit suggests 10+ minutes for voice.
   - Autoscale on concurrent calls rather than CPU alone. LiveKit's default `load_threshold` is 0.7 and it advises scaling up at 0.5.
   - Keep scale-down cooldown longer than scale-up cooldown.
   - Reserve warm capacity to cover cold starts. Pipecat's formula is `max(baseline, CPS × ~30 s)`.
10. **Failover is harder for character voices.** A cloned voice exists on one provider, so failing over means a pre-cloned twin voice on a second provider (with consent) or a disclosed generic fallback voice. LiveKit's current TTS `FallbackAdapter` (livekit-agents 1.8.x) does not fall back at all once *any* audio for the segment has been pushed (`pushed_duration() > 0`), so text is not spoken twice. The older 0.x API used a 3 s threshold (`no_fallback_after_audio_duration=3.0`), which no longer exists in the current source.
11. **Caching is cheap and helps first-turn latency, but only covers scripted audio:** greetings, fillers, "can't hear you" lines, end-of-call lines. LLM replies in free-form roleplay will almost never repeat. Prompt caching is the bigger lever: put stable persona and lorebook text first, append history only, and put per-turn retrieval last.
12. **Meter wall-clock connected seconds with reserve-then-settle**, which the backend already does. Also keep a per-call COGS ledger of characters, tokens and audio-seconds at real rates. Provider units differ: characters (ElevenLabs/Fish TTS), session-open seconds (AssemblyAI streaming, Fish ASR), 10-second-minimum requests (Groq), per-response tokens with context replay (OpenAI Realtime), connected seconds (GPT-Live-1, Eleven Realtime).

---

## 1. Reference call model (used for every worked example)

| Parameter | Value | Rationale |
|---|---|---|
| Call length | 5 / **10** / 30 min | Magic Worlds default `VOICE_MAX_CALL_DURATION_SECONDS=600` |
| Turn rate | 4 exchanges per minute | Roleplay banter. Each exchange is ~15 s |
| User speech | 21 s/min (~35%) | ~2.5 words/s → ~70 tokens/min |
| Bot speech | 30 s/min (~50%) | ~600 characters/min at ~20 chars/s (range 450–750). A Deepgram-authored estimate of ~7,350 chars per 10-minute call is the same order ([Deepgram blog, 2026-03-11](https://deepgram.com/learn/elevenlabs-production-limits-concurrency-credits-compliance)) |
| TTS waste | +15% characters | Barge-in drains and look-ahead synthesis that is never played. The backend already counts this as `drained_chars()` in `call_ledger.py` |
| LLM static prefix | 4,000 tokens | Persona + lorebook + safety/style rules |
| LLM output | ~37 tokens/turn (~150 chars) | 1–2 spoken sentences |
| History growth | ~65 tokens/turn | User + assistant text appended |
| 10-min totals | 40 turns · 211.6k input tokens (205k cacheable) · 1.5k output tokens | Computed |
| S2S audio tokens (OpenAI) | input 1 token/100 ms, output 1 token/50 ms → 600 / 1,200 per audio-minute | [OpenAI realtime costs](https://developers.openai.com/api/docs/guides/realtime-costs) |
| S2S audio tokens (Gemini) | 25 tokens/s each way (~1,500/min) | Third-party reconciliation of $3/M → $0.005/min ([tokenkarma, 2026-09-17](https://tokenkarma.app/blog/gemini-live-api-pricing-voice-agents-2026/)); Google states only "a fixed rate per second" ([Live guide](https://ai.google.dev/gemini-api/docs/live-guide)) |

---

## 2. Price sheet (October 2026)

### 2.1 Speech-to-text

| Service | Mode | List price | Per call-minute in model | Billing semantics / notes | Source |
|---|---|---|---|---|---|
| **Groq whisper-large-v3** (current) | Batch per utterance | $0.111/audio-hour, **10 s minimum per request** | ~$0.0012 (4 utt × 10 s billed) | No streaming or partials. Short utterances are billed as 10 s, so effective price is ~3× list at 3 s average | [Groq STT docs](https://console.groq.com/docs/speech-to-text) |
| Groq whisper-large-v3-turbo | Batch | $0.04/h, 10 s min | ~$0.0004 | Higher WER (12% vs 10.3% on Groq's own table) | same |
| Deepgram Flux (English / Multilingual) | Streaming + turn detection | $0.0065 / $0.0078 per min (PAYG); $0.0057 / $0.0068 (Growth) | $0.0065–0.0078 | Includes end-of-turn model | [Deepgram pricing](https://deepgram.com/pricing) |
| Deepgram Nova-3 multilingual | Streaming | $0.0058/min PAYG | $0.0058 | — | same |
| AssemblyAI Universal-Streaming (EN/multi) | Streaming | $0.15/h | $0.0025 | **Billed on WebSocket open time, idle included**. 100 new streams/min on PAYG | [AssemblyAI pricing](https://www.assemblyai.com/pricing) |
| AssemblyAI Universal-3.6 Pro Realtime | Streaming | $0.45/h | $0.0075 | — | same |
| Soniox real-time | Streaming | $0.12/h | $0.002 | 60+ languages. No published per-account concurrency cap | [Soniox pricing](https://soniox.com/pricing) |
| ElevenLabs Scribe v2 Realtime | Streaming | $0.39/h | $0.0065 | Keyterms +$0.08/h | [ElevenLabs API pricing](https://elevenlabs.io/pricing/api) |
| Fish `transcribe-stream-1` (preview) | Streaming | $0.36/session-hour | $0.006 | Billed on connection-open time. **Counts toward the same concurrency pool as TTS** | [Fish pricing & limits](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits) |
| OpenAI gpt-realtime-whisper / gpt-live-transcribe | Streaming | $0.017/min | $0.017 | — | [OpenAI pricing](https://developers.openai.com/api/docs/pricing) |
| OpenAI gpt-4o-mini-transcribe / gpt-transcribe | Batch | $0.003 / $0.0045 per min | — | — | same |
| Google `gemini-3.5-transcribe-live` (added in fact-check) | Streaming | $3.50/1M audio tokens in (~$0.005/min) + $21/1M text out (~$0.004/min) | ~$0.009 | Google's per-minute figures assume 25 audio tokens/s and 175 text tokens/min. Batch `gemini-3.5-transcribe` is ~$0.003 + $0.002/min | [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| Self-hosted Parakeet TDT 0.6B v3 | Streaming or batch | GPU time | ~$0.0001–0.0003 (§4) | CC-BY-4.0, 25 European languages incl. **es**. Open-ASR RTFx ≈ 3,333 (batch) | [HF model card](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) (released 2025-08-14; >12 months old, so the card may be stale) |

**Takeaway.** STT is ≤ $0.008/min on every API option. Moving from Groq batch to a streaming STT is a **latency** decision (partial transcripts, early endpointing). Cost is at most ~$0.006/min more.

### 2.2 LLM (text, for cascaded)

| Model | Input / cached / output per 1M | 10-min-call cost/min, cached | Uncached | Source |
|---|---|---|---|---|
| gpt-5-mini | $0.25 / $0.025 / $2.00 | **$0.0010** | $0.0056 | [OpenAI pricing](https://developers.openai.com/api/docs/pricing) |
| gpt-5-nano | $0.05 / $0.005 / $0.40 | ~$0.0002 | ~$0.001 | same |
| gpt-5.4-mini | $0.75 / $0.075 / $4.50 | $0.0027 | $0.0165 | same |
| Gemini 3.8 Flash | $0.75 / $0.075 cache / $3.75 (**doubles on 2027-01-01** to $1.50 / $0.15 / $7.50) | $0.0026 | $0.0164 | [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| Gemini 2.5 Flash-Lite | $0.10 / $0.01 / $0.40 | ~$0.0003 | ~$0.0022 | same (still served "until further notice"; Google now recommends 3.5 Flash-Lite or 3.8 Flash for new projects) |
| Gemini 3.5 Flash-Lite (added in fact-check; current Flash-Lite) | $0.30 / $0.03 / $2.50 | ~$0.0012 (computed) | ~$0.007 (computed) | same |
| Groq gpt-oss-120b (500 tok/s) | $0.15 / 50% cached / $0.60 | $0.0017 | $0.0033 | [Groq models](https://console.groq.com/docs/models), [Groq prompt caching](https://console.groq.com/docs/prompt-caching) |
| Groq gpt-oss-20b (1,000 tok/s) | $0.075 / 50% / $0.30 | $0.0009 | $0.0016 | same |
| Groq qwen3.8-27b (preview, no caching) | $0.80 / — / $4.00 | $0.0175 | $0.0175 | same |

Caching rules (OpenAI, GPT-5.6+):
- Minimum 1,024 tokens.
- Cache reads cost 0.1× input (0.05× on GPT-6.1 Sol). Writes cost 1.25× for the default 30-minute TTL, or 2.5× for a 12-hour TTL (Responses API).
- Earlier models (including gpt-5-mini used in the cost model) have no write premium. Retention: `in_memory` keeps entries ~5–10 minutes of inactivity (up to 1 h); `24h` typically ~30 minutes and up to 24 h. Organisations without Zero Data Retention default to `24h`; ZDR organisations default to `in_memory`. GPT-5.5 / 5.5 Pro support only `24h`.
- Guidance: stable content first, append-only history, dynamic content last, and keep tools stable ([OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching)).

Groq caches only the gpt-oss family, at 50% off, and entries expire after about 2 hours unused.

**Takeaway.** With working prompt caching, the LLM costs about one tenth of TTS. Caching is still worth doing for **TTFT**, since cached prefill is faster, and for longer calls. Without caching, LLM cost grows linearly with turn count.

### 2.3 Text-to-speech

The per-minute column assumes ~690 billed chars/min (600 + 15% waste).

| Model | List price | Per call-minute | Arena Elo (AA, Oct 2026) | Notes | Source |
|---|---|---|---|---|---|
| **ElevenLabs v4 Turbo** (current call lane `eleven_v4_turbo`) | $0.04/1K chars (Flash/Turbo class) | **$0.0276** | 1333 (#1–2) | Concurrency: Pro 20 / Scale 30 / Business 30 | [AA leaderboard](https://artificialanalysis.ai/text-to-speech/leaderboard), [EL API pricing](https://elevenlabs.io/pricing/api) |
| ElevenLabs v4 | $0.08/1K | $0.0552 | 1328 | Half the concurrency of Flash/Turbo | same |
| **Fish Audio S2.1 Pro** (current alt lane) | $15 / 1M UTF-8 bytes | **$0.0107** (Spanish ≈ +3% bytes) | 1188; "Drama 3 Preview" 1247 | Concurrency 5 / 15 / 50 by cumulative prepaid spend. S1 retires 2026-12-31 | [Fish pricing & limits](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits) |
| Cartesia Sonic 3.6 | ~$37–50/1M (credit-derived) | ~$0.031 | 1289 | TTS concurrency only 5 (Startup) / 15 (Scale) | [Cartesia pricing](https://cartesia.ai/pricing) |
| Inworld Realtime TTS-2 / TTS-2 Flash | Inworld's page: **$25 / $15 per 1M on-demand**, $20 / $10 (Creator), down to $12.50 / $7 (Growth); AA lists $20.8 / $10.4 | $0.0173 / $0.0104 on-demand; $0.0138 / $0.0069 on Creator | 1265 / 1217 | Instant voice cloning and professional clones (2–100+ by plan); "200+ languages"; concurrency 5 requests on-demand, 10 Creator, 50 Builder | [Inworld pricing](https://inworld.ai/pricing), AA leaderboard |
| Google Gemini 3.8 Flash TTS / Flash-Lite TTS | ~$16.5 / $11 per 1M chars (AA). Token prices $9 / $6 per 1M audio tokens (25 tokens/s) through 2026-12-31, **doubling 2027-01-01** | $0.0114 / $0.0076 | 1278 / 1250 | Preset voices **plus voice design and consent-gated voice replication** via the Voices endpoint (200 stored voices/project, 1-year retention) | [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [voice replication](https://ai.google.dev/gemini-api/docs/voice-replication) |
| Deepgram Aura-2 | $0.030/1K | $0.0207 | — | TTS concurrency 45 (PAYG) / 60 (Growth) | [Deepgram pricing](https://deepgram.com/pricing) |
| Speechify Simba 3.2 | $6.6/1M (AA) | $0.0046 | 1245 | — | AA |
| Soniox TTS Real-Time v2 | $14.2/1M (AA), ~$0.70 per audio-hour of generated speech (Soniox; $4/1M text in + $21.50/1M audio out) | ~$0.010 (AA per-char price); ~$0.007 using Soniox's own per-audio-hour figure on ~34.5 s of billed speech per call-minute | 1179 | — | [Soniox pricing](https://soniox.com/pricing) |
| Mistral Voxtral 3 TTS (added in fact-check) | $13/1M (AA) | ~$0.009 | 1217 | Not evaluated for cloning/Spanish here | AA |
| Qwen-Audio-3.1-TTS-Plus (added in fact-check) | $19.3/1M (AA) | ~$0.013 | 1299 (#3) | Not evaluated for cloning/Spanish here | AA |
| OpenAI gpt-4o-mini-tts | $12/1M audio tokens | ~$0.015 | — | Preset voices | OpenAI pricing |
| Kokoro-82M (self-host, Apache-2.0) | ~$0.2–1.8/1M (GPU-time-derived) | ~$0.0002–0.0012 | 1065 | No cloning | AA; [Spheron, mod. 2026-10-19](https://www.spheron.network/blog/deploy-open-source-tts-gpu-cloud-2026/) |
| Groq Orpheus v1 English (preview) | $22/1M chars | $0.015 | — | Preview, English only | [Groq models](https://console.groq.com/docs/models) |

### 2.4 Speech-to-speech / realtime models

| Model | Price | Billing unit | 10-min reference call, cost/min | Voices / customisation | Source |
|---|---|---|---|---|---|
| OpenAI **gpt-realtime-2.1** | audio in $32 · cached $0.40 · out $64 · text in $4 · out $24 per 1M | Per response, **whole conversation re-processed** | **$0.059 cached / $0.61 uncached** | Preset voices; custom via sales | [pricing](https://developers.openai.com/api/docs/pricing), [model page](https://developers.openai.com/api/docs/models/gpt-realtime-2.1) |
| OpenAI gpt-realtime-2.1-mini | audio in $10 · cached $0.30 · out $20 | same | $0.020 / $0.18 | same | [model page](https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini) |
| OpenAI **GPT-Live-1** (full-duplex voice layer, API release 2026-09-10 per press) | **$0.05/min**, per second, no rounding; backend model + tools extra | Connected seconds | ~$0.051 (+ gpt-5-mini backend ≈ $0.001) | 12 voices at launch (press); voices from recordings via sales; prompt-designed voices GA but GPT-Live-only, English accents only. Endpoint `v1/live/sessions`; Realtime endpoint unsupported | [model page](https://developers.openai.com/api/docs/models/gpt-live-1), [custom voices](https://developers.openai.com/api/docs/guides/custom-voices), [DataNorth, 2026-09-11](https://datanorth.ai/news/openai-launches-gpt-live-1-in-the-api) |
| Google **Gemini 3.8 Live** (`gemini-3.8-live`, also `gemini-3.8-live-extended-thinking`; `gemini-3.1-flash-live-preview` is now legacy) | audio in $3 ($0.005/min) · out $12 ($0.018/min) · text in $0.75 · out $4.50 · image/video in $1 ($0.002/min); all three IDs share one price row. Free tier exists | Tokens; thinking billed as output | **$0.011** if billed incrementally, **~$0.097** if full context is billed every turn (**measure**) | Live models use the TTS voice set; custom/replicated voice support in Live not stated (unverified). Session context 128k tokens for native-audio models | [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [Live guide](https://ai.google.dev/gemini-api/docs/live-guide), [models](https://ai.google.dev/gemini-api/docs/models) |
| Amazon **Nova 2 Sonic** | speech in $3 · out $12 per 1M; text $0.33 / $2.75 (unverified: AWS Bedrock and Nova pricing pages did not render the rate tables on 2026-10-20) | Tokens | ~$0.015 (third-party estimate) | Preset expressive/polyglot voices; languages incl. **Spanish** (EN, FR, IT, DE, ES, PT, HI); **8-minute connection limit** with renewal pattern | [AWS Nova 2 user guide](https://docs.aws.amazon.com/nova/latest/nova2-userguide/using-conversational-speech.html), [llm-stats](https://llm-stats.com/models/nova-2-sonic) |
| **Eleven Realtime v1 Mini / Max** (`eleven_realtime_v1_mini` / `_max`; launch 2026-10-20 per coverage, (unverified) on primary page) | $0.08 per additional connected audio minute **+ tokens: Mini $0.20 in / $6.00 out per 1M; Max $1.80 / $9.00 per 1M**; burst $0.16/min above concurrency | Connected minutes + tokens | ≥ $0.08 | 17.5k+ library voices, 90+ languages; cloned-voice support **not stated**; WebSocket only (no WebRTC at launch). TTFA 620 ms (Mini) / 570 ms (Max), vendor-reported average on Big Bench Audio | [elevenlabs.io/realtime](https://elevenlabs.io/realtime), [EL API pricing](https://elevenlabs.io/pricing/api), [EL models](https://elevenlabs.io/docs/overview/models) |
| OpenAI `gpt-realtime-translate` (added in fact-check; live translation, not a dialogue agent) | $0.034/min | Minutes | n/a | — | [OpenAI pricing](https://developers.openai.com/api/docs/pricing) |

**Context growth over call length** (cost per minute, computed):

| Stack | 5-min call | 10-min call | 30-min call |
|---|---|---|---|
| gpt-realtime-2.1, cache hits | $0.058 | $0.059 | $0.071 |
| gpt-realtime-2.1, **cache broken** | $0.355 | $0.615 | **$1.651** |
| gpt-realtime-2.1-mini, cache hits / broken | $0.018 / $0.101 | $0.020 / $0.182 | $0.030 / $0.506 |
| Gemini 3.8 Live, incremental / full re-bill | $0.011 / $0.059 | $0.011 / $0.097 | $0.011 / $0.250 |
| GPT-Live-1 + gpt-5-mini backend | $0.051 | $0.051 | $0.051 |
| Cascaded (Groq STT + gpt-5-mini cached + EL v4 Turbo) | $0.030 | $0.030 | $0.030 |
| Cascaded (Groq STT + gpt-5-mini **uncached** + EL v4 Turbo) | $0.034 | $0.035 | $0.037 |

These match an independent estimate of $0.06–$0.11/min for the flagship and $0.02–$0.05/min for mini "once caching works", with uncached runaway up to about $0.46/min ([Forasoft, 2026-10-09, upd. 2026-10-12](https://www.forasoft.com/blog/article/openai-realtime-api-pricing)).

### 2.5 Bundled agents, orchestration hosting and transport (market reference)

| Offering | Price | Includes | Source |
|---|---|---|---|
| AssemblyAI Voice Agent API | $0.075/min ($4.50/h) | STT + LLM + TTS + turn-taking + tools, all-in | [AssemblyAI pricing](https://www.assemblyai.com/pricing) |
| Deepgram Voice Agent | $0.075/min standard; $0.050 BYO LLM+TTS | STT + TTS (+ LLM) | [Deepgram pricing](https://deepgram.com/pricing) |
| ElevenLabs Agents ("Speech Engine") | $0.08/min + LLM; burst $0.16/min above concurrency | STT + TTS + turn-taking | [EL API pricing](https://elevenlabs.io/pricing/api) |
| Cartesia agents | $0.06/min (+ $0.014/min telephony on a Cartesia number) | Managed agent call minutes | [Cartesia pricing](https://cartesia.ai/pricing) |
| LiveKit Cloud agent hosting | $0.01/agent-session-min; WebRTC $0.0004–0.0005/min; egress $0.10–0.12/GB | Hosting + transport | [LiveKit pricing](https://livekit.com/pricing) |
| Pipecat Cloud | agent-1x $0.01/session-min active (2x $0.02, 3x $0.03); **reserved agent-1x $0.0005/min** (always-on, billed until turned off); Daily WebRTC voice shown as "$0.001 / free for 1:1 voice sessions on Pipecat Cloud" (wording ambiguous) | Hosting + transport | [Pipecat Cloud pricing](https://www.daily.co/pricing/pipecat-cloud) |
| Own WebSocket (current) | Cloud egress only | MP3 at 128 kbps ≈ 0.96 MB per audio-minute → ~0.5 MB per call-minute → ≈ $0.00005/min at $0.09/GB | Derived |

**Takeaway.** Transport costs almost nothing in money. It affects **latency** and robustness: TCP head-of-line blocking on bad mobile networks, and 128 kbps MP3 being about 4× heavier than 24–32 kbps Opus.

---

## 3. Worked examples (10-minute reference call, list prices)

| Stack | STT | LLM | TTS | Transport/hosting | **Total $/min** | 300 min/month heavy user |
|---|---|---|---|---|---|---|
| **A. Current**: Groq Whisper batch + gpt-5-mini-class (cached) + ElevenLabs v4 Turbo | 0.0012 | 0.0010 | 0.0276 | ~0 | **≈ $0.030** | $9.0 |
| A′. Current with Fish S2.1 Pro lane | 0.0012 | 0.0010 | 0.0107 | ~0 | **≈ $0.013** | $3.9 |
| A″. Current, ElevenLabs v4 (non-Turbo), LLM uncached | 0.0012 | 0.0056 | 0.0552 | ~0 | ≈ $0.062 | $18.6 |
| **B. Optimised API**: Soniox/AssemblyAI streaming + gpt-oss-120b on Groq (cached) + Inworld TTS-2 | 0.002–0.0025 | 0.0017 | 0.0138 (Creator) – 0.0173 (on-demand) | ~0 | **≈ $0.018–0.021** | $5.3–6.4 |
| C. Budget: Soniox + gpt-oss-20b + Inworld TTS-2 Flash / Gemini Flash-Lite TTS | 0.002 | 0.0009 | 0.0069–0.0104 | ~0 | **≈ $0.010–0.013** | $3.0–4.0 |
| D. Self-hosted: Parakeet + vLLM 8–30B + Orpheus/Kokoro-class, at 35% utilisation | 0.0003 | 0.0009 | 0.0008–0.0027 | ~0 | **≈ $0.002–0.004** + engineering | ~$1 |
| E. Hosted LiveKit Cloud + Deepgram Flux + gpt-5-mini + Cartesia Sonic 3 (LiveKit Inference) | 0.0065 | 0.0011 | 0.030 | 0.0105 | ≈ $0.048 | $14.4 |
| S2S-1 gpt-realtime-2.1 (cached) | — | — | — | — | $0.059 | $17.8 |
| S2S-2 gpt-realtime-2.1-mini (cached) | — | — | — | — | $0.020 | $6.0 |
| S2S-3 GPT-Live-1 + cheap backend | — | — | — | — | $0.051 | $15.3 |
| S2S-4 Gemini 3.8 Live | — | — | — | — | $0.011–0.097 | $3.3–29 |
| S2S-5 Eleven Realtime | — | — | — | — | ≥ $0.08 + LLM | ≥ $24 |

**Sensitivity:**
- **Verbosity.** TTS cost scales linearly with characters. Capping replies at about 150 chars per turn, instead of letting a roleplay persona monologue at 400+, is the largest single cost lever in A. It also improves turn-taking.
- **Barge-in waste.** Look-ahead synthesis that is never heard is billed. The 15% waste assumed above can reach 30–40% when the TTS look-ahead buffers a whole paragraph. A cap of 1–2 sentences ahead of the playback cursor keeps it near 10%.
- **Silence-billed meters.** S2S per-minute products and session-billed STT (AssemblyAI, Fish ASR) charge for idle time. A 120 s idle timeout is billed in full.
- **Language.** Fish bills UTF-8 bytes, so accented Spanish costs about 2–5% more than English for the same text. ElevenLabs bills characters.
- **Reasoning tokens.** If a "thinking" model is used for voice, hidden reasoning tokens are billed as output. Gemini Live counts thinking in output pricing. Reasoning effort should be minimal or off for voice turns.

---

## 4. Self-hosting economics

### 4.1 GPU prices (Sep–Oct 2026, third-party aggregators; verify before budgeting)

| GPU | On-demand $/h | Source |
|---|---|---|
| H100 80GB | $1.99 (RunPod community) – $2.89 (RunPod secure) – $2.75 (Spheron PCIe) – $3.29–4.29 (Lambda) | [Spheron comparison](https://www.spheron.network/blog/gpu-cloud-pricing-comparison-2026/), [memetik Sep 2026](https://www.memetik.ai/guides/cloud-gpu-providers) |
| L40S 48GB | $0.79–0.99 | Hostinger / RunPod via aggregators |
| L4 24GB | $0.39–0.43 | RunPod via Layer3 Labs |
| A100 80GB | $1.04 (Apr 2026) → $1.43 (Oct 2026, Spheron) | [Spheron TTS guide](https://www.spheron.network/blog/deploy-open-source-tts-gpu-cloud-2026/) |

### 4.2 Throughput per GPU (realtime)

| Component | Data point | Quality of evidence |
|---|---|---|
| **ASR (Parakeet CTC 1.1B)** in NVIDIA's voice-agent blueprint | 3× H100 (one each for ASR, TTS and Nemotron-3-Nano LLM): ASR latency 40 ms at 1 stream → **67 ms at 64 streams**; end-to-end 0.79 s → 1.0 s | Vendor-reported ([NVIDIA Nemotron Speech FAQ, upd. 2026-06-09](https://perspectives.nvidia.com/nemotron-speech/task/faq/open-asr-models-throughput-benchmarks/)) |
| ASR (Parakeet 0.6B CTC NIM) | Streaming profile ~3 GB GPU memory; separate "low-latency" vs "high-throughput" streaming modes; FP8 on L40/H100 | [NIM ASR support matrix](https://docs.nvidia.com/nim/speech/latest/reference/support-matrix/asr.html) |
| ASR offline | Parakeet TDT 0.6B v3 RTFx ≈ 3,333 (Open ASR Leaderboard) | Independent leaderboard; batch, not streaming |
| **TTS Orpheus 3B** (LLM-based) | 7 → **16 realtime streams per H100 MIG slice** (24 with steady traffic) after TensorRT-LLM; TTFB ~200 ms on MIG, <150 ms on a full H100; ~83 tokens per audio-second | Vendor-reported ([Baseten](https://www.baseten.co/library/orpheus-tts/), [Baseten inference book](https://www.baseten.co/inference-engineering/book/06-modalities/tts-models/)) |
| TTS Orpheus | ~24 concurrent realtime connections per H100 at baseline → 216 after optimisation | Single-lab claim, not replicated (SAIL via [letsdatascience](https://letsdatascience.com/news/sail-optimizes-orpheus-tts-for-higher-throughput-4589dd62)) |
| **TTS Kokoro-82M** | RTF ~0.08 (L40S) / ~0.03 (A100) / ~0.02 (H100); ~30 streams on L40S, ~50 on A100, ~80 on H100 | Hosting-vendor estimate ([Spheron](https://www.spheron.network/blog/deploy-open-source-tts-gpu-cloud-2026/)) |
| TTS Fish Speech 1.5 (open) | RTF ~0.30 (L40S) / ~0.20 (A100) / ~0.12 (H100); ~8 streams on L40S, ~12 on A100, ~20 on H100; **CC BY-NC-SA 4.0 (non-commercial)**. Fish S2 open weights need a commercial licence | same |
| **LLM 8B on vLLM** | Low-latency chat up to ~16 concurrent requests per H100 SXM (Ori, likely 2024, may be stale). 64 concurrent at TTFT p50 142 ms / p99 890 ms, 48 tok/s per request (GeneralCompute, vendor). p95 TTFT rises from 195 ms at 10 concurrent to 1.45 s at 100 | Mixed; run `vllm bench serve` with real prompt lengths |

Serving techniques that recur across these sources:
- Stream over WebSockets; Baseten calls this "the biggest unlock".
- Quantise weights and KV cache to FP8.
- Use TensorRT-LLM in-flight batching for the token model, and dynamic batching with a ~15 ms window for the audio decoder (SNAC).
- Use H100 MIG partitions for small speech models.
- Keep TTS inputs short; Orpheus quality degrades past ~30 s of input.

### 4.3 Per-call-minute cost and break-even

A call does not use a TTS stream all the time. The bot speaks about 50% of the call, and streams run at roughly real time. So **one realtime TTS stream supports about 2 concurrent calls**. The LLM is active only about 1–2 s per 15 s exchange (~10% duty cycle).

| Self-hosted component | Assumption | $/call-min at 100% / 35% utilisation |
|---|---|---|
| Orpheus-class TTS on H100 @ $2.75/h | ~24 streams → ~48 calls | $0.00095 / $0.0027 |
| Kokoro on L40S @ $0.96/h | ~30 streams → ~60 calls | $0.00027 / $0.0008 |
| Parakeet streaming on L4 @ $0.43/h | ~64 streams | $0.00011 / $0.0003 |
| 8B LLM on H100 @ $2.75/h | ~16–64 concurrent generations → ~150 calls | $0.0003 / $0.0009 |

Break-even for self-hosting **TTS** (minimum 2× H100 for N+1, about $4,015/month):

| Compared against | Infra-only break-even | Including ~$8k/month of 0.5 FTE |
|---|---|---|
| ElevenLabs v4 ($0.055/min) | ~73k call-min/month | ~218k |
| ElevenLabs v4 Turbo ($0.028/min) | ~145k | ~435k |
| Inworld TTS-2 ($0.014/min at AA price; $0.017/min at Inworld on-demand) | ~279k (~232k on-demand) | ~834k (~695k on-demand) |
| Fish S2.1 Pro ($0.011/min) | ~375k | ~1.12M |

STT self-hosting (2× L4, about $628/month) breaks even at about 314k min/month against Soniox and about 510k against Groq batch. It is not worth it for cost alone. It is worth it only for latency control or privacy.

### 4.4 Non-cost factors that usually decide

- **Voice cloning quality, Spanish and licence.** Kokoro does not clone. Orpheus needs fine-tuning per voice and is mostly English. Open Fish Speech 1.5 is non-commercial. Fish S2 weights need a licence. For a product where users clone character voices, self-hosted TTS probably means licensing a clone-capable model or limiting it to a curated stock-voice tier.
- **The LLM is the one place self-hosting can win on policy rather than cost.** It gives control over 18+ roleplay content and removes rate limits. API LLM cost is already ≤ $0.003/min with caching.
- **Ops burden:**
  - GPU autoscaling is slow because cold starts take minutes, so peaks need pre-warmed headroom and utilisation falls to 30–50%.
  - Multi-zone redundancy is needed.
  - Model upgrades need evaluation.
  - On-call coverage is needed.
- **A hybrid usually wins.** Run the cheap high-volume lane self-hosted or with a low-cost vendor (stock voices, free tier), and keep premium cloned voices on ElevenLabs or Fish.

---

## 5. Scaling stateful WebSocket/WebRTC sessions

### 5.1 The session is a stateful pipeline

One call holds VAD state, the STT client, the LLM stream, one or more TTS sockets, playback ledgers and barge-in bookkeeping. Practices:

- **Pin each call to one process for its lifetime.** A single client WebSocket gives natural stickiness. Load-balancer affinity only matters for **reconnect/resume**. Magic Worlds has `VOICE_RESUME_GRACE_SECONDS=20` (max 300). A reconnect must land on the process that owns the call, or the call state must be externalised (e.g. Redis) so any process can rebuild it. Options: (a) put the session id in the WS URL and route with consistent hashing (Envoy/HAProxy ring-hash or the Nginx `hash` directive); (b) on reconnect, look up the owner (`session → pod` in Redis) and redirect the client; (c) make resume stateless by persisting the turn ledger at every turn boundary, which the code partly does already with `call_turn_truncation`.
- **Use the LiveKit/Pipecat model as a reference.** Agent workers dial *out* to a media server and pull jobs, and "agent servers do not need to expose any inbound hosts or ports" ([LiveKit deployments](https://docs.livekit.io/deploy/custom/deployments/)). Separating media termination (SFU/edge) from agent compute lets workers scale and drain independently.

### 5.2 Graceful drain on deploy

- On SIGTERM: **stop accepting new calls** (fail readiness, deregister from admission), let live calls finish, then exit. LiveKit: "Voice AI apps might require a 10+ minute grace period", set through `terminationGracePeriodSeconds`. The agent server's `drain_timeout` (Python, seconds) / `drainTimeout` (Node.js, ms) **defaults to one hour** ([LiveKit deployments](https://docs.livekit.io/deploy/custom/deployments/), [server options](https://docs.livekit.io/agents/server/options/)).
- Rule: `terminationGracePeriodSeconds ≥ max_call_duration + idle_timeout + margin`. For Magic Worlds that is 600 + 120 + ~60 s, so about 13 minutes. Alternatively send a "migrate" control frame so the client resumes on a new pod.
- Blue/green or rolling deploys with `maxUnavailable=0` and extra surge capacity. A deploy temporarily needs about 2× capacity for up to 10 minutes.
- Never deploy by killing pods that have active calls. Watch "calls terminated by deploy" as an SLO.

### 5.3 Autoscaling on concurrent calls

- Scale on a **custom metric: active calls per pod**, with event-loop lag and CPU as guards. LiveKit's default `load_fnc` is CPU with `load_threshold=0.7`, and the docs advise scaling up at 0.5. Short cooldowns for scale-up, long ones for scale-down, because pods drain slowly ([LiveKit deployments](https://docs.livekit.io/deploy/custom/deployments/)).
- Sizing reference: 4 vCPU / 8 GB handles **10–25 concurrent jobs**. In LiveKit's load test it peaked at ~3.8 cores and 2.8 GB at 30 sessions (vendor-reported). A thin orchestrator that calls hosted APIs, with no local VAD/ML, should fit far more calls per core. Measure.
- Warm capacity: Pipecat Cloud cold starts take ~30 s (up to a minute or more). Their formula is **Reserved = max(baseline sessions, peak CPS × ~30 s)**. Finished agents stay warm for 5 minutes ([Pipecat capacity planning](https://docs.pipecat.ai/deployment/pipecat-cloud/guides/capacity-planning)). Use time-based scaling for known evening peaks, which matter for companion apps.
- Use a **max-session-duration safety net** for runaway sessions. Pipecat's `--max-session-duration`; Magic Worlds already has `max_call_seconds` and a stale-session sweeper (`DEFAULT_VOICE_STALE_SESSION_SECONDS=900`).

### 5.4 Admission control

- Admit a call only when every downstream budget has room: own process capacity, provider concurrency (TTS/STT), provider rate limits (RPM/spend), the user's quota and the global spend circuit. Return a clear "busy, try in N s" response rather than starting a call that degrades. At its cap, Pipecat Cloud reportedly returns HTTP 429 to new sessions (unverified; not on the current pricing or capacity-planning pages).
- Magic Worlds already reserves atomically in MySQL with a singleton capacity row (`DatabaseVoiceQuotaStore.reserve_call`: per-user in-flight limit, `VOICE_GLOBAL_CONCURRENCY` default 8 / max 64). That is correct, but every reserve/release goes through one row lock. It is fine at tens of calls per second and becomes a hotspot beyond that. A Redis token bucket or per-shard capacity rows would be the next step.

### 5.5 Process hygiene

- asyncio orchestrators should keep CPU work off the event loop: MP3 frame scanning, resampling, VAD, JSON on large frames, moderation regexes. Event-loop lag shows up directly as audio stutter and higher TTFB. Track event-loop lag as a metric and use it as an autoscaling guard.
- Set WebSocket ping/pong and idle timeouts that sit **below** the provider's own (ElevenLabs call sockets have a 20 s inactivity timeout in config). Otherwise a provider disconnect looks like a user drop. The backend already validates `voice_idle_timeout_not_below_elevenlabs_inactivity`.

---

## 6. Provider rate limits and concurrency caps (what limits scale first)

| Provider / product | Limit | Behaviour at limit | Source |
|---|---|---|---|
| ElevenLabs TTS | Concurrent requests: Free 4/2 · Starter 6/3 · Creator 10/5 · **Pro 20/10** · Scale 30/15 · Business 30/15 (Flash-Turbo / other models). Enterprise custom | **WebSocket: only active generation counts.** Over the limit: priority queue by plan (~+50 ms), then **429**; honour `Retry-After`. Headers `current-concurrent-requests` / `maximum-concurrent-requests`. Rule of thumb: "concurrency 5 ≈ 100 simultaneous broadcasts" | [EL TTS limits](https://elevenlabs.io/docs/help-center/technical/how-many-text-to-speech-requests-can-i-make-and-can-i-increase-it/llms.txt), [EL rate-limit blog, upd. 2026-10-12](https://elevenlabs.io/blog/ai-rate-limiting-for-voice) |
| ElevenLabs STT / Realtime STT | Pro: 40 / 30 | — | same blog |
| ElevenLabs Agents & Eleven Realtime | Concurrent calls 4 / 6 / 10 / 20 / 30 / 40 (Free → Business); burst at $0.16/min | Burst billing | [EL API pricing](https://elevenlabs.io/pricing/api) |
| Fish Audio (TTS + ASR shared) | 5 (< $100 prepaid) · 15 (≥ $100) · 50 (≥ $1,000) · enterprise custom; shared across all keys | **429 without `Retry-After`**; exponential backoff | [Fish limits](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits) |
| Groq Whisper | Docs table shows 20 RPM · 2K RPD · **7.2K audio-seconds/hour** (tier unlabeled; the org's real limits are on the console) | Org-level | [Groq rate limits](https://console.groq.com/docs/rate-limits) |
| Deepgram | Streaming STT 150 (PAYG) / 225 (Growth) concurrent WSS; TTS 45 / 60; Voice Agent 45 / 60 | — | [Deepgram pricing](https://deepgram.com/pricing) |
| AssemblyAI streaming | 5 new streams/min (free), 100/min (PAYG); higher by contract | Rate of new sessions, not concurrency | [AssemblyAI pricing](https://www.assemblyai.com/pricing) |
| Cartesia | TTS concurrency 2 / 3 / 5 / 15 (Free → Scale); STT 8–60 | Separate pools | [Cartesia pricing](https://cartesia.ai/pricing) |
| OpenAI gpt-realtime-2.1 | RPM 400 / 10k / 20k and TPM 200k / 4M / 15M (Build / Launch / Grow); session cap not listed | — | [model page](https://developers.openai.com/api/docs/models/gpt-realtime-2.1) |
| OpenAI GPT-Live-1 | **Concurrent sessions 50 / 300 / 500** (Build / Launch / Grow); no free tier | — | [model page](https://developers.openai.com/api/docs/models/gpt-live-1) |
| Google Gemini (all models) | RPM / TPM / RPD per model **plus spend-based caps: $10 / $50 / $200 per rolling 10 min** (Tier 1 / 2 / 3), applied depending on billing history and account standing. Tier 2 needs $100 paid + 3 days; Tier 3 needs $1,000 + 30 days. Live API concurrent-session limits are not on this page | `429 RESOURCE_EXHAUSTED` | [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) |
| LiveKit Cloud | Concurrent agent sessions 5 / 20 / Scale shown as both "Starts at 50" and "Up to 600" (Build / Ship / Scale); LiveKit Inference concurrency 5 / 20 / 50 | Jobs queue server-side (community report) | [LiveKit pricing](https://livekit.com/pricing) |
| Pipecat Cloud | Pricing page says "unlimited concurrency"; the "10 by default / max 50 per pool / 429" figures could not be found on the pricing or capacity-planning pages (unverified) | 429 (unverified) | [Pipecat Cloud pricing](https://www.daily.co/pricing/pipecat-cloud) |

**What this means in calls:**

- **Gemini Live at Tier 1.** $10 per 10 minutes allows about 91 concurrent sessions if billing is incremental ($0.011/min). If the full context is billed every turn, only about 10 fit.
- **Groq Whisper per-utterance.** 20 RPM ÷ 4 utterances per call-minute gives about **5 concurrent calls**. 7,200 ASH ÷ 40 billed s/min gives about 3 call-hours per hour. Whether ASH counts the 10-second minimum is unknown.
- **ElevenLabs Pro WebSocket.** 20 Turbo slots, with only active generation counting, should support well over 20 concurrent calls (generation is ~3–10× faster than real time and the bot speaks ~50%). Bursts of simultaneous turn starts will hit queueing first.
- **Fish at 50 concurrent.** If a call holds one streaming WebSocket for its whole duration and that counts as one request **[unverified]**, the account caps at 50 concurrent calls, *including* any ASR.

---

## 7. Multi-provider failover and health checks

**Established patterns:**

- **Per-stage fallback chains.** LiveKit `FallbackAdapter` for STT, LLM and TTS:
  - TTS (current livekit-agents 1.8.x source): `FallbackAdapter(tts, *, max_retry_per_tts=2, sample_rate=None)`, with per-attempt `conn_options` defaulting to `max_retry=0` and the standard timeout. If a provider fails after **any** audio was pushed for the segment, the adapter logs "ignoring fallback" and does not try the next provider, which avoids repeating text already partly spoken. The older 0.x signature (`attempt_timeout` 10 s, `max_retry_per_tts` 1, `retry_interval` 5 s, `no_fallback_after_audio_duration=3.0`) is gone; the old Python API docs URL now returns 404.
  - STT: `attempt_timeout=10.0`, `max_retry_per_stt=1`, `retry_interval=5` (still current). Recovery is probed with a parallel stream on the same audio, and a provider is marked available again on the first non-empty final transcript.
  - LLM: `retryOnChunkSent` controls whether to retry after tokens have streamed ([LiveKit TTS FallbackAdapter source](https://github.com/livekit/agents/blob/main/livekit-agents/livekit/agents/tts/fallback_adapter.py), [STT source](https://github.com/livekit/agents/blob/main/livekit-agents/livekit/agents/stt/fallback_adapter.py), [LLM (JS)](https://docs.livekit.io/reference/agents-js/classes/agents.llm-1.FallbackAdapter.html)).
- Pipecat (pipecat-ai 1.13.0) `ServiceSwitcher` with `ServiceSwitcherStrategyFailover` ignores errors the service can recover from and switches only when the active service "is unable to work at all" (e.g. rejected API key, unknown model or voice). **Failed services do not rejoin automatically**: they stay unusable until the app calls `set_usable(True)` and switches back (e.g. in `on_service_switched`). `ErrorFrame.fatal` / `FatalErrorFrame` are deprecated and will be removed in 2.0.0. The earlier claim that this behaviour started "since v1.8" is not stated in the docs (unverified) ([Pipecat ServiceSwitcher](https://docs.pipecat.ai/api-reference/server/utilities/service-switchers/service-switcher), [error handling](https://docs.pipecat.ai/pipecat/fundamentals/error-handling)).
- **Circuit breakers** per provider × surface, with half-open probes. Magic Worlds has `SpeechBreakers` (`src/services/speech/breakers.py`) and a daily spend circuit (`spend_circuit.py`: 50/80/95/100% levels; at 100% new calls are refused and live calls continue as text).
- **Health checks.** Passive checks (error rate, TTFB p95 per provider over 1–5 minutes) catch more than active ones. Add an active synthetic canary every 30–60 s per provider: a 1-sentence TTS request and a 2-second STT clip, alerting on TTFB p95. Status pages lag. Deepgram's (competitor-authored) review counted 10 ElevenLabs incidents in 28 days in Feb 2026, including partial outages where core APIs stayed up while Agents degraded.
- **Hedging for the first sentence only.** Sending the first TTS sentence to two providers and keeping the faster one cuts tail latency, but costs ~2× on ~15% of characters and makes voice mismatch audible. It only works when both providers hold the same voice.

**Voice-identity constraint (specific to companion apps).** Failing over mid-call to a different TTS changes the character's voice. Options, in order of quality:
1. Clone each character voice on **two providers** (e.g. ElevenLabs and Fish), with consent covering both. Magic Worlds tracks `FISH_CONSENT_VERSION`.
2. Fall back to a designated "similar stock voice" and tell the user ("connection trouble, voice may sound different").
3. Degrade to text-only (current behaviour at the spend cap).

**STT and LLM failover is invisible to users, so it should be automatic:** Groq → OpenAI `gpt-4o-mini-transcribe`, primary LLM → secondary LLM with an equivalent persona prompt.

---

## 8. Regional deployment

- Place the orchestrator **next to the providers, not the user**. Each turn makes several server-side round trips (STT, LLM TTFT, TTS TTFB, moderation) and only about one user round trip. Most voice APIs serve primarily from US regions, so US-East/US-Central co-location is usually best even for EU or LATAM users. Measure the provider-side RTT from each candidate region.
- For distant users (Spain, LATAM), improve the last mile instead: a WebRTC/edge SFU (LiveKit Cloud or Daily) with Opus and UDP avoids TCP head-of-line blocking. Plain WebSocket over lossy mobile links causes bursty playback.
- Data residency costs extra: OpenAI regional-processing endpoints carry a **10% uplift** for models released on or after 2026-03-05 ([OpenAI pricing](https://developers.openai.com/api/docs/pricing)). Gemini on Google Cloud lists separate global and regional prices.
- In multi-region active-active, keep each call within one region. Replicate only quota and billing state, using a single-writer ledger or per-region allowances with reconciliation.

---

## 9. Caching

**TTS audio cache (scripted segments only):**
- Cache key: `sha256(provider, model, voice_id, voice_settings, language, normalised_text, output_format)`.
- Store MP3/Opus in object storage. Pre-render at character-save or voice-change time.
- Good candidates:
  - **Call openers/greetings** per character. Playing these immediately hides LLM and TTS cold start on turn 0, which is often the slowest turn.
  - Backchannels and fillers ("mm-hmm", "hold on…", in-character laughs).
  - System lines: can't hear you, reconnecting, time almost up, goodbye.
  - Safety interstitials.
- Hit rate on free-form LLM output is near zero, so do not semantic-cache roleplay replies.
- Invalidate when the voice clone is retrained or settings change.
- Check that the provider's terms allow storing and replaying output. Paid tiers normally do; free tiers often require attribution.

**Prompt cache (LLM):**
- Order the prompt as persona/system → stable lorebook core → tool schemas → history (append-only) → **per-turn lorebook retrieval and the new user turn last**. Any lorebook entry injected *before* history invalidates the cache from that point on every turn.
- Prewarm at call start, while the greeting plays, with a `max_tokens=1` request or OpenAI's explicit prewarm on GPT-5.6+.
- Use `prompt_cache_key` per character/user so cache routing follows the call (this matters for earlier models such as gpt-5-mini; on GPT-5.6+ the key is optional and mainly used for per-customer cache accounting, and it never guarantees a hit).

**S2S cache.** Keep `instructions` and tools fixed for the whole session. Avoid frequent truncation: OpenAI's `retention_ratio < 1` truncates in larger chunks less often, which keeps the cache hit rate up. Replace old items with a summary item only at rare checkpoints ([OpenAI realtime costs](https://developers.openai.com/api/docs/guides/realtime-costs)).

---

## 10. Metering and billing for consumer voice minutes

**Patterns:**

- **Reserve-then-settle.** Reserve the next chunk (or the whole max-call allowance) at admission, settle actual seconds on release, and sweep stale reservations. Magic Worlds already does this: `voice_usage_day` with `reserved_seconds` and `consumed_seconds`, a `max_call_seconds` cap, a 120 s idle timeout and a 900 s stale sweeper.
- **Bill per second, show minutes.** OpenAI's GPT-Live-1 bills "per second, without rounding up to a whole minute", which sets user expectations.
- **Connected time vs talk time.** Connected time is simplest and matches S2S per-minute and session-billed STT. Talk time (excluding long silences) is friendlier but needs a server-side speech meter. Common compromise: meter connected time, auto-end after N seconds of silence, and warn at 30–60 s left with an in-character wrap-up line.
- **Allowances.** Daily allowance (current default 10 min/day per user) or monthly pool, plus top-up minute packs. A monthly pool is easier to price: a 300 min/month heavy user costs $3–18 depending on stack (§3).
- **Voice-tier multipliers.** Premium voices (ElevenLabs v4) cost ~2× Turbo and ~5× Fish. Either restrict them to higher plans or burn minutes at a multiplier.
- **A real COGS ledger per call**, not only list-price estimates. Record characters sent and characters heard, STT billed seconds (with the 10 s minimum applied), LLM tokens (cached/uncached), provider and model, and compute cost with versioned price tables. The Fish config already versions prices (`fish-s2.1-pro-2026-10`). Reconcile weekly against invoices.
- **Unit-economics guardrail.** Target retail ≥ 3–5× COGS per voice minute. Bundled vendors price voice-agent minutes at $0.05–0.08, which gives a market anchor for what users and competitors pay.
- **Global spend circuit** with alert, pause and refuse levels. This already exists (D37). Also add per-user daily caps on cost, not just seconds, so that a premium voice plus verbose replies cannot exceed budget within the same seconds.

---

## 11. Abuse prevention (voice-specific)

| Abuse | Mitigation |
|---|---|
| Free-minute farming via multiple accounts | Verified email or phone before voice; per-device and per-IP velocity limits; free voice minutes only after age/attestation (Magic Worlds already has attestation); throttle free-tier concurrency globally |
| Concurrent sessions per account | Limit `max_inflight_per_user` to 1 (already enforced in the quota reservation); kill duplicate tabs |
| Idle or open-mic sessions burning session-billed services | Idle timeout below the provider's inactivity limit; server VAD gate before STT (exists); end the call after N minutes without human speech |
| Bot-to-bot / echo loops (TTS audio fed back into the mic, two tabs talking) | AEC in the browser; drop transcripts that match recently spoken TTS text (echo check); cap consecutive turns without new user content |
| **Voice laundering** (using a cloned character voice to say arbitrary dictated text, i.e. deepfake generation) | Cap characters per turn; persona instructions that refuse "repeat after me" verbatim requests; output moderation; consent-gated cloning (exists); never expose raw TTS from the call surface; watch the ratio of verbatim-echo turns |
| TTS cost amplification (prompting very long monologues, many barge-ins to force re-synthesis) | Per-turn character cap; look-ahead cap; per-call and per-day cost caps; `drained_chars` alerting (exists, D26) |
| WebSocket flooding / huge frames | Max frame size, max utterance duration, per-connection message-rate limit, auth on the upgrade (subprotocol token) and on resume |
| Session hijack on resume | Short-lived single-use resume tokens bound to user and session; 20 s grace (exists) |

---

## 12. Classification

### (a) Established best practice
- Model cost per **call-minute by stage**, using that stage's billing unit. Treat TTS characters and S2S context replay as the main drivers.
- Prompt caching with an append-only history and stable prefix, and dynamic retrieval last.
- Short spoken replies (≤ 1–2 sentences per turn). Cap TTS look-ahead.
- Reserve-then-settle metering, per-user in-flight cap of 1, idle and max-duration caps, a global spend circuit.
- Graceful drain: readiness fails on SIGTERM, grace period ≥ max call length, autoscale on active calls, longer scale-down cooldown.
- Circuit breakers plus per-stage fallback chains, with no TTS fallback after audio has started (current LiveKit: no fallback once any audio is pushed; the old 0.x API allowed it for the first 3 s).
- Pre-rendered greetings and system lines.

### (b) Current SOTA / leading options (Oct 2026)
- Cascaded quality leaders: ElevenLabs v4 / v4 Turbo (Elo 1328 / 1333, #2 / #1 on AA), Qwen-Audio-3.1-TTS-Plus (1299), Cartesia Sonic 3.6 (1289), Gemini 3.8 Flash TTS (1278), Inworld Realtime TTS-2 (1265). Price/quality leaders: Fish Drama 3 Preview (1247) / S2.1 Pro (1188), Speechify Simba 3.2, Inworld TTS-2 Flash, Mistral Voxtral 3 TTS ($13/1M, 1217), Gemini 3.8 Flash-Lite TTS. Cloning is now available on Gemini 3.8 Flash / Flash-Lite TTS (voice replication) and Inworld (instant + professional clones), not only ElevenLabs and Fish.
- Streaming STT cost leaders: Soniox `stt-rt-v5` ($0.12/h), AssemblyAI U-Streaming ($0.15/h), Google `gemini-3.5-transcribe-live` (~$0.009/min). Turn-aware STT: Deepgram Flux.
- S2S: gpt-realtime-2.1 / mini, GPT-Live-1 (full-duplex voice layer + separate reasoning model), Gemini 3.8 Live (+ extended-thinking variant), Nova 2 Sonic, Eleven Realtime v1 (launch reported 2026-10-20).
- Orchestration hosting: LiveKit Cloud / Pipecat Cloud at about $0.01/session-min.

### (c) Emerging / experimental
- **Split "voice layer + reasoning backend"** S2S priced per connected minute (GPT-Live-1, Eleven Realtime). This makes S2S cost predictable and lets you pick the LLM, but voice choice stays limited.
- **Spend-based rate limits** (Gemini) layered on top of RPM/TPM/RPD (not replacing them). Capacity planning has to track dollars per 10-minute window as well as request and token rates.
- **Promotional price windows.** Gemini 3.8 Flash and Flash TTS prices double on 2027-01-01, so budgets need dated price tables.
- LLM-based TTS served like LLMs (FP8, in-flight batching, MIG), reaching tens to hundreds of streams per H100 (claims not replicated).
- Edge and on-device pipelines (NVIDIA Jetson Thor; Kokoro on CPU) for cost-free STT/TTS on capable clients. Not yet viable for cloned premium voices.

### (d) Pitfalls / anti-patterns
- Using S2S with **mid-session instruction or tool changes**, or aggressive truncation, which breaks the cache and multiplies cost by 5–20×.
- Assuming Gemini Live per-minute rates are the whole bill without checking how context is billed. Leaving Live sessions open through silence. Not handling the ~10-minute connection lifetime (GoAway plus a session-resumption handle valid for 2 h). Nova 2 Sonic has an 8-minute connection limit that also needs a renewal/continuation path.
- Session-billed STT left open during long idle periods (AssemblyAI bills open time; "a 60-minute connection with 30 minutes of audio is billed 60").
- Per-utterance batch STT with a **10 s minimum** combined with an over-sensitive VAD: every cough becomes a 10 s charge and an RPM hit.
- Synthesising a whole paragraph ahead and then being interrupted, so unheard characters are billed.
- Retry storms on 429 at call start (Fish returns no `Retry-After`): spend increases while the experience still fails. Use jittered exponential backoff with admission control instead.
- Killing pods on deploy with calls in flight. CPU-only autoscaling for I/O-bound orchestrators.
- Treating list-price estimates as COGS without reconciling against invoices. Ignoring free-tier attribution and licensing (non-commercial open TTS weights).
- Cloned-voice failover that silently switches to a different voice mid-call.

---

## 13. Implications for Magic Worlds (prioritised)

Grounded in the current backend: Groq `whisper-large-v3` batch STT, ElevenLabs `eleven_v4_turbo` and Fish S2.1 Pro call TTS (MP3 128 kbps), `VOICE_GLOBAL_CONCURRENCY=8` (max 64), 10 min/day per user, 600 s max call, 120 s idle timeout, MySQL reserve/settle quota, spend circuit, breakers, `drained_chars` ledger.

**P0 — protect margin and capacity (low effort):**
1. **Per-call COGS ledger.** Extend `voice_spend_daily` and the call ledger to record, per call: characters sent and characters heard (waste ratio), STT billed seconds *with the Groq 10 s minimum*, LLM tokens split into cached and uncached, and S2S tokens if ever used. Compute cost from versioned price tables. KPIs: $/call-min p50/p95, waste ratio, cache-hit ratio.
2. **Cap spoken output per turn** at about 150–250 characters, enforced in the callbot graph and sentence buffer. **Cap TTS look-ahead** at 1–2 sentences ahead of the playback cursor. Expected effect: −20–40% TTS cost and better barge-in.
3. **Verify provider limits against `VOICE_GLOBAL_CONCURRENCY`:**
   - Read Groq's real org limits (RPM and ASH) in the console. The documented 20 RPM supports only about 5 concurrent calls.
   - Confirm the ElevenLabs tier's Turbo concurrency and Fish's spend tier.
   - Confirm how Fish counts WebSocket concurrency, which is shared with ASR.
   - Make admission check *all* of them, not just the global count.
4. **Prompt-cache layout for the callbot graph:** stable persona and lorebook core first, append-only history, per-turn lorebook hits and the user turn last; prewarm while the greeting plays. Verify `cached_tokens` in usage.

**P1 — latency and ops (medium effort):**
5. **Pre-render character greetings and system lines** (TTS cache keyed by voice, model, settings and text). Turn 0 becomes instant, and the first billed TTS of every call is removed.
6. **Graceful drain.** Readiness fails on SIGTERM, `terminationGracePeriodSeconds ≈ 780 s` (600 + 120 + 60), deploy surge capacity, and a client "migrate" frame using the existing resume path. Route resumes to the owning process (session→pod in Redis or consistent hashing), or persist enough turn state to rebuild anywhere.
7. **Autoscale on active calls per pod** plus event-loop lag. Keep scale-up at ~70% of per-pod capacity (LiveKit uses 0.5 against a 0.7 threshold) and use time-based pre-scaling for evening peaks.
8. **STT failover and streaming.** Add an automatic STT fallback (e.g. OpenAI `gpt-4o-mini-transcribe` at $0.003/min, or Deepgram). Evaluate a streaming STT (Soniox $0.12/h, AssemblyAI $0.15/h, Deepgram Flux for turn detection) to get partials and earlier endpointing. Cost increase is ≤ $0.006/min.
9. **Dual-provider voice twins for top characters** (ElevenLabs + Fish with dual consent) so a TTS outage degrades to "same voice, other vendor" instead of text-only.

**P2 — strategic options:**
10. **Tiered voice lanes:** a Standard tier (Fish S2.1 Pro / Inworld TTS-2 at ~$0.013–0.021/min all-in) and a Premium tier (ElevenLabs v4 Turbo/v4 at ~$0.03–0.06/min) with minute multipliers. At 10 min/day (300 min/month) a heavy Premium user costs about $9–18/month in COGS. Price plans or caps accordingly.
11. **S2S pilot, measured rather than assumed.** gpt-realtime-2.1-mini (≈ $0.02/min cached) and Gemini 3.8 Live (≈ $0.011–0.10/min; measure `usageMetadata`) suit a "quick stock-voice chat" mode. GPT-Live-1 ($0.05/min + any backend LLM) is attractive because the reasoning backend can be the existing graph. Blockers to check first: cloned-voice support, 18+ roleplay policy, Gemini 10-minute connection and 15-minute session limits, Gemini spend-based limits ($10 per 10 min at Tier 1), and the OpenAI cache-break risk.
12. **Self-hosting:** not before roughly 0.4–1M call-min/month, and only for (a) an LLM lane where content policy or rate limits are binding, or (b) a stock-voice free tier (Kokoro/Orpheus-class). Keep cloned premium voices on vendors unless a commercially licensed, Spanish-capable cloning model is validated.
13. **Transport:** consider Opus at 24–32 kbps over WebSocket, or WebRTC via LiveKit/Daily at about $0.0004–0.001/min, for mobile and remote (Spain/LATAM) users. Money is not the issue; jitter and head-of-line blocking are.

---

## 14. Open questions

- How does Gemini Live bill accumulated context per turn (incremental vs full re-bill)? Does context-window compression change it?
- Nova 2 Sonic official Bedrock rates and audio tokens per second (AWS page tables did not render).
- How Fish Audio counts streaming WebSocket TTS (`tts_timestamp_ws`) toward the 5/15/50 concurrency limit. Per open socket or per active generation?
- Groq Whisper limits for Developer and Enterprise tiers, and whether ASH counts the 10-second minimum.
- Eleven Realtime: cloned/professional voice support, content policy for 18+ fictional roleplay. (Price is now known: $0.08/additional connected min + Mini $0.20/$6 or Max $1.80/$9 per 1M tokens; included minutes per plan still to confirm.)
- GPT-Live-1: latency numbers (not published), and whether a non-OpenAI backend LLM can be plugged in through the Responses backend. Custom voices: prompt-designed voices are GA but English-accent-only on GPT-Live and may not imitate fictional characters; recorded-voice clones remain sales-gated.
- Gemini Live: can voices created with voice replication / voice design (Gemini 3.8 Flash TTS Voices endpoint) be used in `gemini-3.8-live` sessions?
- An independent, replicated realtime TTS concurrency per GPU for clone-capable open models with commercial licences and Spanish support.

---

## Sources

(Accessed 2026-10-20 unless noted. "No date" means the page shows no publication date.)

- OpenAI — API pricing (no date): https://developers.openai.com/api/docs/pricing
- OpenAI — Realtime API cost management guide (no date): https://developers.openai.com/api/docs/guides/realtime-costs
- OpenAI — GPT-Live-1 model page (no date): https://developers.openai.com/api/docs/models/gpt-live-1
- OpenAI — gpt-realtime-2.1 model page: https://developers.openai.com/api/docs/models/gpt-realtime-2.1
- OpenAI — gpt-realtime-2.1-mini model page: https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini
- OpenAI — Prompt caching guide: https://developers.openai.com/api/docs/guides/prompt-caching
- DataNorth — "OpenAI launches GPT-Live-1 in the API" (2026-09-11): https://datanorth.ai/news/openai-launches-gpt-live-1-in-the-api
- eesel.ai — GPT-Live-1 pricing (2026-09-11): https://www.eesel.ai/blog/gpt-live-1-pricing
- Forasoft — OpenAI Realtime API pricing (2026-10-09, upd. 2026-10-12): https://www.forasoft.com/blog/article/openai-realtime-api-pricing
- Google — Gemini Developer API pricing: https://ai.google.dev/gemini-api/docs/pricing
- Google — Gemini rate limits: https://ai.google.dev/gemini-api/docs/rate-limits
- Google — Live API session management: https://ai.google.dev/gemini-api/docs/live-session
- Google — Live API capabilities guide: https://ai.google.dev/gemini-api/docs/live-guide
- tokenkarma — Gemini Live API pricing reality check (2026-09-17): https://tokenkarma.app/blog/gemini-live-api-pricing-voice-agents-2026/
- llm-stats — Nova 2 Sonic (model released 2025-12-02): https://llm-stats.com/models/nova-2-sonic
- Maxim/Bifrost — Nova 2 Sonic cost calculator (third-party): https://www.getmaxim.ai/bifrost/llm-cost-calculator/provider/bedrock/model/amazon.nova-2-sonic-v1-0
- Deepgram — Pricing: https://deepgram.com/pricing
- Deepgram blog — "What happens when you push ElevenLabs past demo usage?" (2026-03-09, upd. 2026-03-11; competitor-authored): https://deepgram.com/learn/elevenlabs-production-limits-concurrency-credits-compliance
- AssemblyAI — Pricing: https://www.assemblyai.com/pricing
- Groq — Speech-to-text docs: https://console.groq.com/docs/speech-to-text
- Groq — Rate limits: https://console.groq.com/docs/rate-limits
- Groq — Models: https://console.groq.com/docs/models
- Groq — Prompt caching: https://console.groq.com/docs/prompt-caching
- ElevenLabs — API pricing: https://elevenlabs.io/pricing/api
- ElevenLabs — TTS concurrency help article: https://elevenlabs.io/docs/help-center/technical/how-many-text-to-speech-requests-can-i-make-and-can-i-increase-it/llms.txt
- ElevenLabs blog — AI rate limiting for voice (2026-06-26, upd. 2026-10-12): https://elevenlabs.io/blog/ai-rate-limiting-for-voice
- ElevenLabs — Eleven Realtime (launched 2026-10-20 per launch coverage): https://elevenlabs.io/realtime
- Fish Audio — API pricing and rate limits: https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits
- Fish Audio — Plans: https://fish.audio/plan/
- Cartesia — Pricing: https://cartesia.ai/pricing
- Soniox — Pricing: https://soniox.com/pricing
- Artificial Analysis — TTS leaderboard (Oct 2026 snapshot, no capture date): https://artificialanalysis.ai/text-to-speech/leaderboard
- LiveKit — Pricing: https://livekit.com/pricing
- LiveKit — Custom deployments (sizing, grace period, autoscaling): https://docs.livekit.io/deploy/custom/deployments/
- LiveKit — Agent server options (`load_threshold`, `drain_timeout`): https://docs.livekit.io/agents/server/options/
- LiveKit — TTS FallbackAdapter (legacy Python API docs; returns 404 as of 2026-10-20): https://docs.livekit.io/python/livekit/agents/tts/fallback_adapter.html
- LiveKit — TTS FallbackAdapter source (main, livekit-agents 1.8.8): https://github.com/livekit/agents/blob/main/livekit-agents/livekit/agents/tts/fallback_adapter.py
- LiveKit — STT FallbackAdapter source (main): https://github.com/livekit/agents/blob/main/livekit-agents/livekit/agents/stt/fallback_adapter.py
- LiveKit — STT FallbackAdapter (Python): https://docs.livekit.io/python/livekit/agents/stt/fallback_adapter.html
- OpenAI — Custom voices guide (added in fact-check): https://developers.openai.com/api/docs/guides/custom-voices
- Google — Gemini models list (added in fact-check): https://ai.google.dev/gemini-api/docs/models
- Google — Voice replication / voice design (added in fact-check): https://ai.google.dev/gemini-api/docs/voice-replication, https://ai.google.dev/gemini-api/docs/voice-design
- ElevenLabs — Models overview (added in fact-check): https://elevenlabs.io/docs/overview/models
- Inworld — Pricing (added in fact-check): https://inworld.ai/pricing
- AWS — Nova 2 Sonic user guide (added in fact-check): https://docs.aws.amazon.com/nova/latest/nova2-userguide/using-conversational-speech.html
- LiveKit — LLM FallbackAdapter (JS): https://docs.livekit.io/reference/agents-js/classes/agents.llm-1.FallbackAdapter.html
- Daily — Pipecat Cloud pricing: https://www.daily.co/pricing/pipecat-cloud
- Pipecat — Capacity planning: https://docs.pipecat.ai/deployment/pipecat-cloud/guides/capacity-planning
- Pipecat — ServiceSwitcher: https://docs.pipecat.ai/api-reference/server/utilities/service-switchers/service-switcher
- Pipecat — Error handling: https://docs.pipecat.ai/pipecat/fundamentals/error-handling
- NVIDIA — Nemotron Speech FAQ: open ASR throughput (upd. 2026-06-09): https://perspectives.nvidia.com/nemotron-speech/task/faq/open-asr-models-throughput-benchmarks/
- NVIDIA — ASR NIM support matrix: https://docs.nvidia.com/nim/speech/latest/reference/support-matrix/asr.html
- Hugging Face — nvidia/parakeet-tdt-0.6b-v3 (2025-08-14; >12 months, may be stale): https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3
- Baseten — Orpheus TTS library page (no date): https://www.baseten.co/library/orpheus-tts/
- Baseten — Inference Engineering book, TTS models (© 2026): https://www.baseten.co/inference-engineering/book/06-modalities/tts-models/
- Let's Data Science — SAIL optimises Orpheus-TTS (no date; single-lab claim): https://letsdatascience.com/news/sail-optimizes-orpheus-tts-for-higher-throughput-4589dd62
- Spheron — Deploy open-source TTS on GPU cloud (2026-04-09, mod. 2026-10-19): https://www.spheron.network/blog/deploy-open-source-tts-gpu-cloud-2026/
- Spheron — GPU cloud pricing comparison 2026: https://www.spheron.network/blog/gpu-cloud-pricing-comparison-2026/
- memetik — Cloud GPU providers ranked by H100 price (Sep 2026): https://www.memetik.ai/guides/cloud-gpu-providers
- Ori — Benchmarking Llama 3.1 8B on H100 with vLLM (likely 2024, possibly stale): https://blog.ori.co/benchmarking-llama-3.1-8b-instruct-on-nvidia-h100-and-a100-chips-with-the-vllm-inferencing-engine
- GeneralCompute — vLLM throughput/latency comparison (vendor): https://www.generalcompute.com/blog/generalcompute-vs-vllm-throughput-latency-and-cost-benchmarks
- Magic Worlds backend (code read 2026-10-20): `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/{config,quota,call_ledger}.py`, `src/services/speech/{spend_circuit,breakers,model_features}.py`, `src/services/speech/providers/fish_audio/config.py`

---

## Fact-check log (2026-10-20)

Method: primary vendor pages and source code fetched directly on 2026-10-20. The shared web-search budget was exhausted before this pass began, so no search-engine queries were run. Pages were fetched only from known primary URLs. Claims that could not be confirmed on a primary page are marked "(unverified)" in the text above.

| # | Claim (as originally written) | Verdict | Correction / note | Source |
|---|---|---|---|---|
| 1 | gpt-realtime-2.1: audio $32 in / $0.40 cached / $64 out; text $4 / $24 per 1M; RPM 400 / 10k / 20k, TPM 200k / 4M / 15M | Confirmed | Context window 128k, max output 32k. gpt-realtime-2 has the same audio prices | [OpenAI pricing](https://developers.openai.com/api/docs/pricing), [model page](https://developers.openai.com/api/docs/models/gpt-realtime-2.1) |
| 2 | gpt-realtime-2.1-mini: audio $10 / $0.30 / $20 | Confirmed | Text $0.60 / $0.06 / $2.40 | [model page](https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini) |
| 3 | OpenAI Realtime re-sends the whole conversation each response; user audio 1 token/100 ms, assistant audio 1 token/50 ms; instruction/tool changes and truncation break the cache; `retention_ratio < 1` advice | Confirmed | Recomputed the 10-min cached ($0.058/min) and uncached ($0.61/min) figures from these rates: consistent | [Realtime costs guide](https://developers.openai.com/api/docs/guides/realtime-costs) |
| 4 | GPT-Live-1: $0.05/min billed per second; backend billed separately; concurrent sessions 50 / 300 / 500; no free tier; API GA 2026-09-10 | Confirmed with caveat | Price, billing and limits are on the model page. The 2026-09-10 date comes from press (DataNorth), and the model page gives no date. Endpoint `v1/live/sessions` | [model page](https://developers.openai.com/api/docs/models/gpt-live-1), [DataNorth](https://datanorth.ai/news/openai-launches-gpt-live-1-in-the-api) |
| 5 | "OpenAI custom voices go through sales" | Corrected | Recorded-voice clones are for eligible customers via sales. Prompt-designed voices are GA but work only with GPT-Live, which supports English accents only. Policy bars imitating public figures or fictional characters | [OpenAI custom voices](https://developers.openai.com/api/docs/guides/custom-voices) |
| 6 | OpenAI prompt caching (GPT-5.6+): min 1,024; reads 0.1×; writes 1.25× (30 min) / 2.5× (12 h); explicit prewarm | Confirmed | GPT-6.1 Sol reads at 0.05×. Prewarm is `prompt_cache_options.prewarm` | [Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching) |
| 7 | "Older models cache in memory for about 5–10 minutes" | Corrected | Non-ZDR orgs default to `24h` retention (~30 min typical, up to 24 h). `in_memory` (5–10 min, up to 1 h) is the default only with ZDR | same |
| 8 | OpenAI regional processing +10% for models released on/after 2026-03-05 | Confirmed | FedRAMP endpoints also +10% | [OpenAI pricing](https://developers.openai.com/api/docs/pricing) |
| 9 | gpt-5-mini $0.25 / $0.025 / $2.00; gpt-5-nano $0.05 / $0.005 / $0.40; gpt-5.4-mini $0.75 / $0.075 / $4.50 | Confirmed | — | same |
| 10 | Gemini Live: audio $3 in / $12 out per 1M (~$0.005 / $0.018 per min), text $0.75 / $4.50; model "Gemini 3.8 Live / 3.1 Flash Live" | Confirmed with additions | Google now prints the per-minute figures itself. IDs: `gemini-3.8-live`, `gemini-3.8-live-extended-thinking`, and legacy `gemini-3.1-flash-live-preview`, all on one price row. How context is billed per turn is still not documented | [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [Live guide](https://ai.google.dev/gemini-api/docs/live-guide), [models](https://ai.google.dev/gemini-api/docs/models) |
| 11 | Gemini Live: ~10-min connection; audio-only session 15 min without compression; resumption handle valid 2 h | Confirmed | Audio+video sessions 2 min without compression. Context compression allows unlimited sessions | [Live session](https://ai.google.dev/gemini-api/docs/live-session) |
| 12 | Gemini spend-based limits $10 / $50 / $200 per rolling 10 min; "replacing RPM/TPM" | Corrected | The dollar figures are right, but they apply **in addition to** RPM/TPM/RPD, depending on billing history and account standing | [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) |
| 13 | Gemini 3.8 Flash $0.75 / $0.075 / $3.75, doubling 2027-01-01; Flash TTS / Flash-Lite TTS $9 / $6 per 1M audio tokens doubling 2027-01-01 | Confirmed | Gemini 3.6 Flash has the same prices. Newer Flash-Lite `gemini-3.5-flash-lite` ($0.30 / $0.03 / $2.50) added | [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| 14 | Gemini Flash TTS / Live "preset voices" | Corrected | Gemini 3.8 Flash and Flash-Lite TTS support voice design and consent-gated voice replication (200 voices per project). Use in Live is not documented (unverified) | [Voice replication](https://ai.google.dev/gemini-api/docs/voice-replication), [Voice design](https://ai.google.dev/gemini-api/docs/voice-design) |
| 15 | ElevenLabs TTS v4 $0.08/1K, v4 Turbo $0.04/1K; Scribe v2 Realtime $0.39/h (+$0.08/h keyterms); Agents $0.08/min, burst $0.16 | Confirmed | v4 Turbo is #1 on AA (Elo 1333). `eleven_turbo_v2/_v2_5` are deprecated in favour of Flash | [EL API pricing](https://elevenlabs.io/pricing/api), [EL models](https://elevenlabs.io/docs/overview/models) |
| 16 | ElevenLabs TTS concurrency Free 4/2 … Pro 20/10, Scale 30/15, Business 30/15; WebSocket counts only active generation; ~50 ms queue then 429; headers; "5 ≈ 100 broadcasts" | Confirmed | The help article has the table, and the blog (upd. 2026-10-12) has the WebSocket, queue and header details. STT Pro 40 / Realtime STT 30 confirmed from the blog, whose table is partly garbled | [EL help](https://elevenlabs.io/docs/help-center/technical/how-many-text-to-speech-requests-can-i-make-and-can-i-increase-it/llms.txt), [EL blog](https://elevenlabs.io/blog/ai-rate-limiting-for-voice) |
| 17 | Eleven Realtime v1 Mini/Max: $0.08 per connected minute + LLM; WebSocket only; 17.5k voices; 90+ languages; TTFA 620 / 570 ms; launched 2026-10-20 | Corrected / partly unverified | Added token prices (Mini $0.20 / $6.00, Max $1.80 / $9.00 per 1M) and concurrency 4 / 6 / 10 / 20 / 30 / 40. The launch date is not on the primary page (unverified). Cloned-voice support is still not stated | [elevenlabs.io/realtime](https://elevenlabs.io/realtime), [EL API pricing](https://elevenlabs.io/pricing/api) |
| 18 | Fish S2.1 Pro $15 / 1M UTF-8 bytes; S1 retires 2026-12-31; concurrency 5 / 15 / 50 by prepaid funds, shared with ASR; 429 without Retry-After; `transcribe-stream-1` $0.36 per session-hour | Confirmed | After retirement, `s1` requests are served by `s2.1-pro`. The docs imply a WebSocket holds a slot until its final chunk or close, but do not say so outright (still unverified) | [Fish pricing & limits](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits) |
| 19 | Groq whisper-large-v3 $0.111/h, 10 s minimum, WER 10.3%; turbo $0.04/h, 12% | Confirmed | No streaming mentioned | [Groq STT](https://console.groq.com/docs/speech-to-text) |
| 20 | Groq Whisper limits 20 RPM / 2K RPD / 7.2K ASH (tier unlabeled) | Confirmed (tier still ambiguous) | The page text calls the table "base limits for the Developer plan" but shows Free and Developer tabs | [Groq rate limits](https://console.groq.com/docs/rate-limits) |
| 21 | Groq gpt-oss-120b $0.15 / $0.60 (~500 tok/s), gpt-oss-20b $0.075 / $0.30 (1,000 tok/s), qwen3.8-27b preview $0.80 / $4.00; caching 50% on gpt-oss only, ~2 h expiry; Orpheus English $22 / 1M chars | Confirmed | Caching also covers gpt-oss-safeguard-20b. The docs say "2 hours" in one place and "a few hours" in another | [Groq models](https://console.groq.com/docs/models), [Groq caching](https://console.groq.com/docs/prompt-caching) |
| 22 | Deepgram Flux $0.0065 / $0.0078 (PAYG), Nova-3 multi $0.0058, Aura-2 $0.030/1K, Voice Agent $0.075 ($0.050 BYO LLM+TTS); concurrency 150 / 225, 45 / 60 | Confirmed | Voice Agent is billed on WebSocket connection time | [Deepgram pricing](https://deepgram.com/pricing) |
| 23 | AssemblyAI U-Streaming $0.15/h billed on session open time; Universal-3.6 Pro Realtime $0.45/h; Voice Agent $0.075/min all-in; 5 / 100 new streams per min | Confirmed | — | [AssemblyAI pricing](https://www.assemblyai.com/pricing) |
| 24 | Soniox real-time $0.12/h; TTS ~$0.70 per audio-hour → ~$0.010 per call-minute | Partly corrected | STT confirmed (model `stt-rt-v5`). Soniox's own TTS figure gives ~$0.007 per call-minute; the $0.010 came from AA's per-character price | [Soniox pricing](https://soniox.com/pricing) |
| 25 | Cartesia Sonic 3.6 ~$37–50 / 1M (credits); TTS concurrency 2 / 3 / 5 / 15; agents $0.06/min | Confirmed | Telephony is $0.014/min extra. AA lists Sonic 3.6 at $49 / 1M | [Cartesia pricing](https://cartesia.ai/pricing) |
| 26 | Inworld TTS-2 / Flash $20.8 / $10.4 per 1M (AA) | Corrected | Inworld lists $25 / $15 on-demand, $20 / $10 Creator, and down to $12.50 / $7 Growth. Instant and professional cloning are available. Worked examples B and C and the break-even row were updated | [Inworld pricing](https://inworld.ai/pricing) |
| 27 | AA TTS Elo: v4 Turbo 1333, v4 1328, Sonic 3.6 1289, Gemini 3.8 Flash TTS 1278, TTS-2 1265, Flash-Lite TTS 1250, Drama 3 1247, Simba 3.2 1245, TTS-2 Flash 1217, Fish S2.1 Pro 1188, Soniox 1179, Kokoro 1065 | Confirmed | Added Qwen-Audio-3.1-TTS-Plus (1299, #3) and Voxtral 3 TTS (1217) | [AA leaderboard](https://artificialanalysis.ai/text-to-speech/leaderboard) |
| 28 | LiveKit Cloud $0.01 per agent-session-min; WebRTC $0.0004–0.0005/min; egress $0.10–0.12/GB; concurrency 5 / 20 / up to 600 | Confirmed with caveat | The Scale concurrency row shows both "Starts at 50" and "Up to 600". LiveKit Inference Cartesia Sonic 3 is $0.030/min | [LiveKit pricing](https://livekit.com/pricing) |
| 29 | LiveKit: 10+ min grace for voice; default `load_threshold` 0.7, scale at 0.5; 4 cores / 8 GB → 10–25 jobs; load test ~3.8 cores / 2.8 GB at 30 sessions; no inbound ports | Confirmed | The 0.5 figure is given as an example, not a rule | [LiveKit deployments](https://docs.livekit.io/deploy/custom/deployments/) |
| 30 | LiveKit `drain_timeout` defaults to 30 minutes | Corrected | The default is **one hour** (seconds in Python, ms in Node.js) | [LiveKit server options](https://docs.livekit.io/agents/server/options/) |
| 31 | LiveKit TTS FallbackAdapter: `attempt_timeout` 10 s, `max_retry_per_tts` 1, `retry_interval` 5 s, `no_fallback_after_audio_duration=3.0` | Corrected (outdated) | Current source (1.8.8): `max_retry_per_tts=2`, `sample_rate`, with `conn_options` timeouts. There is no fallback once any audio has been pushed. The old docs URL returns 404. STT adapter defaults (10 s / 1 / 5 s) are still current | [TTS source](https://github.com/livekit/agents/blob/main/livekit-agents/livekit/agents/tts/fallback_adapter.py), [STT source](https://github.com/livekit/agents/blob/main/livekit-agents/livekit/agents/stt/fallback_adapter.py) |
| 32 | Pipecat ServiceSwitcher "since v1.8 fails over only when a service truly cannot recover, and recovered services rejoin as candidates" | Corrected | Failed services stay unusable until `set_usable(True)`, with no automatic rejoin. The version claim is not in the docs (unverified). `fatal` errors are deprecated, with removal in 2.0.0. Latest pipecat-ai is 1.13.0 | [ServiceSwitcher](https://docs.pipecat.ai/api-reference/server/utilities/service-switchers/service-switcher), [error handling](https://docs.pipecat.ai/pipecat/fundamentals/error-handling) |
| 33 | Pipecat Cloud: reserved $0.01/min; 10 concurrent instances by default, max 50 per pool, 429 at cap | Corrected / unverified | Reserved agent-1x is **$0.0005/min** (always-on). The pricing page says "unlimited concurrency". The 10 / 50 / 429 figures were not found (unverified) | [Pipecat Cloud pricing](https://www.daily.co/pricing/pipecat-cloud) |
| 34 | Pipecat capacity planning: ~30 s warm-up, Reserved = max(baseline, CPS × ~30 s), 5-min warm cooldown | Confirmed | Full cold starts "vary widely", up to a minute or more | [Pipecat capacity planning](https://docs.pipecat.ai/deployment/pipecat-cloud/guides/capacity-planning) |
| 35 | Parakeet TDT 0.6B v3: CC-BY-4.0, 25 European languages incl. Spanish, RTFx ≈ 3,333, released 2025-08-14 | Confirmed | No successor is named on the card. Streaming is via NeMo chunked inference only | [HF card](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) |
| 36 | NVIDIA blueprint: 3× H100, Parakeet CTC 1.1B, ASR 40 → 67 ms at 64 streams, E2E 0.79 → 1.0 s | Confirmed | Page last updated 2026-06-09 | [NVIDIA FAQ](https://perspectives.nvidia.com/nemotron-speech/task/faq/open-asr-models-throughput-benchmarks/) |
| 37 | Baseten Orpheus: 16 streams (variable) / 24 (steady) per H100 MIG 40GB slice; ~83 tokens/s | Confirmed | TTFB figures are not on the library page. They come from the Baseten book, which was not re-checked | [Baseten Orpheus](https://www.baseten.co/library/orpheus-tts/) |
| 38 | Spheron: H100 PCIe $2.75/h, A100 $1.04 → $1.43/h, L40S $0.96; Kokoro RTF ~0.03 and 30 / 50 / 80 streams; Fish Speech 1.5 RTF 0.15–0.25, CC BY-NC-SA | Partly corrected | Prices and stream counts confirmed. Kokoro RTF is per GPU (~0.08 L40S / 0.03 A100 / 0.02 H100). Fish Speech 1.5 RTF is 0.12–0.30 | [Spheron TTS guide](https://www.spheron.network/blog/deploy-open-source-tts-gpu-cloud-2026/) |
| 39 | Nova 2 Sonic speech $3 / $12, text $0.33 / $2.75 per 1M | Unverified | AWS Bedrock and Nova pricing pages did not render rate tables. Added from the AWS user guide: Spanish supported, 8-minute connection limit | [AWS Nova 2 guide](https://docs.aws.amazon.com/nova/latest/nova2-userguide/using-conversational-speech.html) |

**Newer developments added in this pass:**
- Google `gemini-3.5-transcribe-live` streaming STT (~$0.009/min) and `gemini-3.5-transcribe`.
- `gemini-3.8-live-extended-thinking` and `gemini-3.5-live-translate-preview`. `gemini-3.1-flash-live-preview` is now legacy.
- `gemini-3.5-flash-lite` is the current Flash-Lite.
- Gemini TTS voice replication and voice design.
- OpenAI `gpt-realtime-translate` ($0.034/min), and OpenAI prompt-voice design restricted to GPT-Live.
- Inworld cloning.
- AA entries Qwen-Audio-3.1-TTS-Plus and Voxtral 3 TTS.
- ElevenLabs Turbo v2/v2.5 deprecation.
- Current framework versions: livekit-agents 1.8.8, pipecat-ai 1.13.0.
