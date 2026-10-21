# R07: Speech-to-speech, omni and realtime models (single-provider voice-to-voice)

**Research date:** 2026-10-20 · **Scope:** the landscape as of October 2026 for native speech-to-speech (S2S) models, "omni" models (one model handles audio, text and sometimes video), full-duplex research, and hybrid patterns (half-cascade, audio-in LLM, voice-layer delegation). The goal is to decide what Magic Worlds should adopt next to its current cascaded pipeline (client VAD, then Groq whisper-large-v3 batch STT, then the agent-graph LLM, then ElevenLabs or Fish streaming TTS).

**Method and caveats**
- Most claims come from primary vendor docs, changelogs and pricing pages fetched on 2026-10-20. Independent numbers come from the Artificial Analysis (AA) Speech-to-Speech leaderboard and the Full-Duplex-Bench papers.
- Vendor numbers are labelled **(vendor-reported)**.
- Anything older than about 12 months is marked **[possibly stale]**.
- A shared web-search quota ran out partway through. Later facts were taken directly from known primary URLs. A few items I could not re-verify are marked **[unverified]**.
- Page contents were read through a summarizing fetcher. Exact numbers were cross-checked where possible, but the primary page should be re-read before anything contractual.
- **Fact-checked 2026-10-20** against primary pages (see the "Fact-check log" at the end). Corrections are inline; claims that could not be confirmed carry "(unverified)"; newer releases are collected in §13.

---

## 0. TL;DR

1. **The market moved a lot in 2026.** OpenAI now ships `gpt-realtime-2` (May 7, 2026) and `gpt-realtime-2.1` / `-2.1-mini` (Jul 6, 2026), which are reasoning S2S models. It also ships **GPT-Live-1** (Sep 10, 2026), a full-duplex "voice layer" that hands reasoning off to a backend agent. Google shipped **Gemini 3.8 Live** and **3.8 Live Extended Thinking** (GA Sep 15, 2026). xAI shipped **Grok Voice 3.0** (October 2026; xAI's release notes give only the month, so the exact day "Oct 14" is (unverified)). It also deprecated Grok Voice 2.0, and 3.0 kept 2.0's price. ElevenLabs launched **Eleven Realtime v1 Mini/Max** today (Oct 20, 2026). **Hume is shutting down its EVI and TTS APIs on Nov 13, 2026.**
2. **On reasoning benchmarks, the top S2S models now match cascades.** Independent AA Big Bench Audio scores are 92–99% for the top S2S systems: Grok Voice 3.0, Gemini 3.8 Live, gpt-realtime-2.x, Eleven Realtime Max and Qwen Audio 3.0. Time to first audio (TTFA) is about **0.57–1.35 s**.
3. **Full-duplex behaviour is now a measured product feature.** It is scored as AA "Conversational Dynamics", a Full-Duplex-Bench subset. The best commercial models score 94–98%. Open full-duplex models (Moshi, PersonaPlex, Freeze-Omni) handle turn-taking well but reason poorly: Big Bench Audio is 4–33%.
4. **Character voices are the blocker for Magic Worlds.** None of the big-three S2S APIs (OpenAI, Google, Amazon) lets an app freely clone arbitrary voices for its users:
   - OpenAI recording-based custom voices need a consent recording from the speaker, are sales-gated, and are capped at 20 per org. OpenAI also explicitly forbids imitating "a named person, public figure, or fictional character".
   - Gemini Live custom voices (`replicated_voice_config`) are allowlist-only.
   - Nova 2 Sonic has fixed voices only.
   - Only xAI (Grok custom voices, which xAI's docs say work in realtime `session.update`; one community report disagrees), Alibaba Qwen (voice-cloning guide), ElevenLabs (17k library voices; clones in Realtime unconfirmed) and Ultravox (clones on paid plans) are plausible.
5. **Content policy is the second blocker.** Google's GenAI policy prohibits sexually explicit content. OpenAI's ChatGPT adult mode was paused indefinitely on 2026-03-26, and API adult content is not offered (unverified for the API; the source tracker covers ChatGPT only). Anthropic prohibits it. ElevenLabs' conversational-AI terms reportedly bar sexual content from LLMs used in agents. A pure S2S stack ties you to the vendor's LLM, its policy, and its built-in moderation, which can cut audio mid-speech. Today the app can choose its LLM through the agent graph.
6. **You cannot moderate the text before it is spoken in S2S.** The best available approach is running guardrails on streaming output transcripts. For example, the OpenAI Agents SDK runs guardrails every 100 characters and relies on speech being slower than text. GPT-Live cannot be made to say exact text at all.
7. **Advertised S2S per-minute prices understate real cost.** Every turn re-bills the whole context:
   - Measured gpt-realtime-mini apps cost about **$0.07/min** for a typical session and **$0.12–0.15/min** for heavy Q&A, from one author's 4,000 sessions (corrected 2026-10-20; the article gives a typical $0.070/min, not a $0.05–0.08 range). This note's own raw-audio estimate of about $0.015/min is not from that article (unverified).
   - Gemini's docs confirm every turn is billed for all context tokens.
   - Injecting RAG or lorebook text breaks the prompt cache.
8. **Half-cascade is the realistic hybrid.** A realtime model runs in text-output mode, and your own TTS speaks with cloned voices. This works on OpenAI Realtime (`output_modalities: ["text"]`) and Qwen Omni Realtime (`modalities: ["text"]`). It does **not** work on Gemini Live native-audio models, which output audio only. LiveKit documents it as a "realtime hybrid architecture". It keeps exact scripts and any voice, but the vendor LLM still writes the words.
9. **Recommendation for Magic Worlds:** keep the cascaded pipeline as the primary path for character calls, then borrow S2S-era techniques: semantic turn detection, preambles or fillers, a fast/slow split, and transcript-time guardrails. Add a provider-agnostic, OpenAI-Realtime-protocol adapter so S2S or half-cascade can be piloted per character behind a flag, for SFW characters with stock or designed voices. Do not build on Hume (sunset) or Gemini 2.5 native audio (legacy).

---

## 1. Taxonomy of approaches

| Pattern | What it is | Examples (Oct 2026) | Who writes the words | Voice source |
|---|---|---|---|---|
| **Cascaded** | STT, then text LLM, then TTS, all streamed | Magic Worlds today; Pipecat or LiveKit pipelines; managed cascades (Deepgram Voice Agent, Cartesia Line, Inworld Realtime, ElevenLabs Agents default; listed by AA as "Default Cascaded System") | Your LLM | Any TTS, including clones |
| **Native S2S, turn-based (half-duplex + barge-in)** | One model, audio in and audio out, with VAD turn detection | gpt-realtime-2.1 / mini, Gemini 3.8 Live, Nova 2 Sonic, Grok Voice 3.0 | Vendor model | Vendor voices |
| **Native full-duplex** | Listens while speaking; models overlap, backchannels and pauses | GPT-Live-1, Qwen3.8-Omni-Flash-Realtime ("full-duplex interaction", unverified), Moshi, NVIDIA PersonaPlex, MiniCPM-o 4.5, Freeze-Omni | Vendor or open model | Vendor or fixed voices |
| **Voice layer + delegation** | A fast full-duplex voice model talks and delegates reasoning or tools to a backend agent | GPT-Live-1 (Responses or client delegation); Gemini 3.8 Live Extended Thinking (thinks in the background) | The voice model paraphrases backend output | Vendor voices |
| **Half-cascade (realtime hybrid)** | Realtime model hears audio and returns **text**; your own TTS speaks it | OpenAI Realtime text modality + TTS; Qwen Omni Realtime text modality; Azure Voice Live (gpt-realtime + Azure custom neural voice) | Vendor model | **Any TTS** |
| **Audio-in LLM (no STT)** | LLM ingests audio and streams text; TTS speaks | Ultravox (open; hosted $0.05/min); Gemini or gpt-audio via standard APIs; Phi-4-mm in Azure | Audio LLM | Any TTS |
| **Managed "S2S" that is internally cascaded** | Single API, cascaded inside | Azure Voice Live (STT + GPT-5.x + Azure TTS); reportedly Eleven Realtime (see §3.5) | Vendor | Vendor library |

---

## 2. Independent benchmark snapshot (Artificial Analysis, accessed 2026-10-20)

AA's [Speech-to-Speech leaderboard](https://artificialanalysis.ai/speech-to-speech) is the best independent cross-vendor source. It scores four things:
- **S2S Index:** equal weight across Big Bench Audio reasoning, τ-Voice agentic performance, Speech Agent Arena preference and task success.
- **Conversational Dynamics:** a weighted subset of Full-Duplex-Bench v1 and v1.5 covering pause handling, turn-taking, user interruption and backchannels.
- **TTFA:** average seconds to first audio on Big Bench Audio.
- **Price:** USD per hour of input and output audio.

Selected rows (TTFA in seconds; price in $/hr):

| Model | S2S Index | Big Bench Audio | Conv. Dynamics | TTFA | $/hr in / out |
|---|---|---|---|---|---|
| Grok Voice 3.0 (xAI, listed as "SpaceXAI") | **86.9** | 99% | 97.0% | 0.81 | flat $4.80/hr (xAI rate card; AA shows no price; see §3.4) |
| Grok Voice 2.0 (deprecated Oct 2026) | 81.3 | 97% | 95.1% | **0.70** | – |
| GPT-Live-1 (Astra, medium) | 83.2 | 90% | 94.9% | 1.34 | $3.00/hr voice + backend |
| Gemini 3.8 Live Extended Thinking (High) | 82.6 | 98% | 91.9% | 1.35 | – |
| GPT-Live-1 (Sol, low) | 80.1 | 89% | 97.3% | 1.24 | – |
| Gemini 3.8 Live | 76.0 | 92% | 96.1% | 1.18 | ≈$0.30 / $1.08 (from Google per-minute rates) |
| GPT-Realtime-2.1 High | 75.2 | 96% | 95.7% | 1.21 | – (same token rates as 2 → ≈$1.15 / $4.61) |
| GPT-Realtime-2 (High) | 73.6 | 97% | 95.3% | 1.14 | $1.15 / $4.61 |
| Gemini 3.1 Flash Live High | 72.0 | 97% | 74.3% | 2.99 | $0.35 / $1.38 |
| GPT-Realtime-2.1 Minimal | 70.7 | 87% | 92.7% | 0.97 | – |
| GPT-Realtime-1.5 | 70.3 | 81% | 95.7% | 0.81 | $1.15 / $4.61 |
| Qwen Audio 3.0 Realtime Plus | 69.5 | 99% | 98.4% | 1.54 | $0.03 / $0.18 |
| Qwen Audio 3.0 Realtime Flash | 67.7 | 96% | 96.9% | 1.55 | – |
| Gemini 3.1 Flash Live Minimal | 64.2 | 71% | 72.3% | 0.96 | $0.35 / $1.38 |
| Qwen3.5 Omni Flash Realtime | – | 59% | – | 0.79 | $0.16 / $0.82 |
| Qwen3.5 Omni Plus Realtime | – | 99% | – | 2.64 | $0.16 / $0.82 |
| GPT-Realtime-2.1 Mini High | – | 75% | 91.7% | 4.28 | – |
| GPT-Realtime-2.1 Mini Minimal | 54.4 | 63% | 91.8% | 0.85 | – |
| Eleven Realtime v1 Max | – | 99% | 94.1% | **0.57** | – (not published) |
| Eleven Realtime v1 Mini | – | 76% | 95.8% | 0.62 | – |
| Nova 2.0 Sonic (Mar 2026) | – | 88% | – | 1.14 | $0.27 / $1.08 |
| Deepslate Opal | – | 85% | 85.7% | **0.44** | – |
| Krafton Raon SpeechChat | – | 58% | 86.2% | 0.04 (sic) | – |
| Step-Audio R1.1 (Realtime) | – | 98% | – | 1.53 | $0.06 / $1.69 |
| StepAudio 3 Realtime | – | 100% | 98.9% | 8.83 | – |
| NVIDIA PersonaPlex (open) | – | 19% | 91.0% | – | self-host |
| NVIDIA Nemotron Voicechat (open) | – | 27% | 52.9% | – | self-host |
| Kyutai Moshi (open) | – | 4% | 61.0% | – | self-host |
| VITA Freeze-Omni (open) | – | 33% | 58.7% | – | self-host |

**How to read this table**
- TTFA is measured on reasoning questions, so it is not the "chit-chat" voice-to-voice latency a roleplay call would see. Thinking-heavy configurations push TTFA past 1.2 s, and StepAudio 3 Realtime takes 8.8 s.
- Rows added on 2026-10-20 from the live leaderboard show that newer is not always faster. The older Grok Voice 2.0 (0.70 s) and GPT-Realtime-1.5 (0.81 s) beat their successors on TTFA. GPT-Realtime-2.1 Mini at High reasoning takes 4.28 s. Gemini 3.1 Flash Live scores only 72–74% on Conversational Dynamics, so 3.8 Live is a large step up on turn-taking.
- The Speech Agent Arena is task-oriented (for example, booking a dental appointment), and only models with tool calling are included. **There is no independent roleplay, persona-consistency or character-voice benchmark for S2S.** That is a gap Magic Worlds would need to fill with its own evals.
- AA lists cascaded baselines (Deepgram Voice Agent, ElevenLabs Agents, Cartesia Line, Inworld Realtime) only in the Arena section, with no reasoning or latency numbers. **There is no apples-to-apples published comparison between cascaded and S2S systems.**
- The independent [Voice AI & Voice Agents primer](https://voiceaiandvoiceagents.com/) (updated June 2026) still says a well-tuned cascade was faster in practice than OpenAI's and Google's S2S models. It also says S2S models "do not follow instructions or call tools as reliably" as text LLMs. That guidance was written before the 2.x and 3.8 generation and may be partly stale.

---

## 3. Commercial providers in depth

### 3.1 OpenAI Realtime API: gpt-realtime → 1.5 → 2 → 2.1 (+ mini)

**Timeline** (from the [OpenAI API changelog](https://developers.openai.com/api/docs/changelog))
- 2025-08-28: Realtime API GA with `gpt-realtime`.
- 2025-10-06: `gpt-realtime-mini`.
- 2025-12-15: improved mini snapshots; custom voices for eligible customers.
- 2026-02-23: `gpt-realtime-1.5`.
- 2026-05-07: `gpt-realtime-2` "with configurable reasoning", plus `gpt-realtime-translate` and `gpt-realtime-whisper`.
- 2026-05-12: the Realtime **beta** interface was removed.
- 2026-07-06: `gpt-realtime-2.1` and `gpt-realtime-2.1-mini`, with better alphanumerics, silence and noise handling, and interruption behaviour. OpenAI also reported a p95 latency cut of at least 25% across realtime models through caching (vendor-reported, via [community announcement](https://community.openai.com/t/new-realtime-models-on-the-api-gpt-realtime-2-1-and-gpt-realtime-2-1-mini/1385896)). Azure lists both as version `2026-07-07`.
- 2026-07-28: `gpt-transcribe` (file transcription and final transcripts of committed Realtime turns, $0.0045/min) and `gpt-live-transcribe` (low-latency streaming, $0.017/min). *(Added 2026-10-20.)*
- 2026-08-26: deprecation notice. `whisper-1`, `gpt-4o-transcribe`, `gpt-4o-mini-transcribe` and `gpt-4o-transcribe-diarize` shut down on 2027-02-26.
- 2026-09-10: `gpt-live-1` GA. 2026-10-15: native Decisions integration in GPT-Live. 2026-10-16: prompt-to-voice and nine new GPT-Live voices.
- `gpt-realtime-translate` is priced at $0.034/min.

**Model facts** ([gpt-realtime-2.1 model page](https://developers.openai.com/api/docs/models/gpt-realtime-2.1))
- 128k context and 32k max output tokens.
- Input: text, audio, image. Output: text, audio.
- Function calling and prompt caching.
- Knowledge cutoff 2024-09-30.
- Default rate limits: Build tier 400 RPM / 200k TPM.
- Microsoft's [Foundry doc](https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/realtime-2) (updated 2026-09-23) says the 2.x series has a **256k** context window, which conflicts with OpenAI's page.
- `reasoning.effort` levels: minimal, low, medium, high (confirmed in Microsoft's Foundry doc; OpenAI's model page does not name the levels). Press coverage also mentions xhigh (unverified; not in the Foundry list).
- **Response phases:** `commentary` (preambles such as "let me think…") and `final_answer`. If the user interrupts during thinking, the model discards the chain of thought.
- 2.x does **not** support the session `truncation` property; manage context with `conversation.item.truncate` and `conversation.item.delete`.
- Microsoft notes that instruction following is **stricter** than in 1.x, so narrow wording in prompts may need broadening.

**Pricing** ([pricing page](https://developers.openai.com/api/docs/pricing), per 1M tokens)

| Model | Audio in | Audio cached | Audio out | Text in | Text out |
|---|---|---|---|---|---|
| gpt-realtime-2.1 / 2 | $32 | $0.40 | $64 | $4 | $24 |
| gpt-realtime-1.5 / gpt-realtime | $32 | $0.40 | $64 | $4 | $16 |
| gpt-realtime-2.1-mini / gpt-realtime-mini | $10 | $0.30 | $20 | $0.60 | $2.40 |

- Audio is about 10 tokens/s for user audio and about 20 tokens/s for assistant audio ([realtime cost guide](https://developers.openai.com/api/docs/guides/realtime-costs)).
- Raw audio cost for 2.x is therefore about **$0.019 per minute of user speech** and **$0.077 per minute of model speech**, before context re-billing (see §6).

**Turn detection** ([VAD guide](https://developers.openai.com/api/docs/guides/realtime-vad))
- `server_vad` uses silence. It takes `threshold`, `prefix_padding_ms` and `silence_duration_ms`.
- `semantic_vad` uses a classifier that estimates whether the user has finished the thought. `eagerness` can be low, medium/auto or high.
- `create_response=false` and `interrupt_response=false` let you keep VAD but gate responses manually. OpenAI suggests this for moderation, input validation or RAG ([conversations guide](https://developers.openai.com/api/docs/guides/realtime-conversations)).

**Interruptions** ([conversations guide](https://developers.openai.com/api/docs/guides/realtime-conversations))
- Over WebSocket, the client must send `conversation.item.truncate` with `audio_end_ms`. This matches Magic Worlds' "truncate to what was heard".
- Over WebRTC or SIP, the server truncates unplayed audio automatically.

**Session behaviour** ([conversations guide](https://developers.openai.com/api/docs/guides/realtime-conversations))
- Sessions last at most **60 minutes**.
- The voice is fixed once audio has been emitted.
- There are 10 stock voices (alloy, ash, ballad, coral, echo, sage, shimmer, verse, marin, cedar); OpenAI recommends marin or cedar.
- Text-only output is available per response with `output_modalities: ["text"]`. This enables half-cascade.
- Out-of-band responses (`conversation: "none"`) can be used for side classifications.

**Transports:** WebRTC (browser; added 2025-12-17), WebSocket (server) and SIP. The changelog shows dedicated SIP IP ranges from 2026-01-13. GeoIP routing of `sip.api.openai.com` is (unverified).

**Custom voices** ([custom voices guide](https://developers.openai.com/api/docs/guides/custom-voices))
- Recording-based voices work in Realtime, TTS, Chat Completions audio and GPT-Live.
- Requirements and limits:
  - "Eligible customers", with access through sales.
  - Two recordings from the same person: a consent phrase read exactly (16 languages, Spanish included) and a sample of 30 s or less (newer guidance: 10–30 s with at least 5 s of actual speech; uploads up to 10 MiB).
  - 20 recording-based voices per organization (separate from the 100 prompt-to-voice voices).
  - Adult voices only.
  - Explicitly: "Don't request imitation of a named person, public figure, or fictional character."
  - Not compatible with Zero Data Retention.
- **This rules out user-uploaded clones of arbitrary character voices.**

### 3.2 OpenAI GPT-Live-1: a full-duplex voice layer with delegation

- **GA 2026-09-10.** Endpoint `v1/live/sessions`, over WebRTC (recommended), WebSocket or SIP. A sideband WebSocket allows monitoring ([guide](https://developers.openai.com/api/docs/guides/live), [model page](https://developers.openai.com/api/docs/models/gpt-live-1)).
- **Architecture.**
  - The voice layer listens and speaks at the same time, and decides when to delegate.
  - The backend reasons and runs tools. You choose between **Responses delegation**, where OpenAI runs a backend model such as `gpt-5.6-*`, and **client delegation**, where you connect your own agent. OpenAI's guide says only "a supported Responses model". DataCamp's tutorial uses `gpt-5.6-sol`, `gpt-5.6-terra` and `gpt-5.6-luna`. AA's "Astra" and "Sol" labels probably name the backend used.
  - Model page: input and output are audio and text (no image or video); the knowledge cutoff is 2025-07-31; the only endpoint is `v1/live/sessions`.
  - The delegation mode is fixed per session.
- **Pricing.** **$0.05/min of session time**, billed per second, plus backend tokens. The meter keeps running during silence and mute. 15 s are billed when the session is created and credited against the running duration, so this is a 15 s minimum rather than an extra charge ([DataCamp tutorial](https://www.datacamp.com/tutorial/gpt-live-1-api), 2026-09-15).
- **Rate limits.** Concurrency-based: 50 sessions on Build, 300 on Launch, 500 on Grow.
- **How backend output reaches speech** ([live-conversations guide](https://developers.openai.com/api/docs/guides/live-conversations)):
  - `session.thinking.append` adds silent context.
  - `session.commentary.append` gives text the model should say, but it "may paraphrase, add words, or stay silent".
  - `session.instructions.append` may interrupt speech.
  - Each append is limited to 500 tokens.
  - **There is no guaranteed way to make GPT-Live speak exact text.** OpenAI advises playing a pre-rendered clip yourself when wording matters.
- **Context.** 128k tokens. Past 90% use, a replacement voice engine starts with the instructions plus up to 8,192 tokens of history. Instructions can be up to 16,384 tokens.
- **Transcripts.** Input and output transcript deltas carry `start_ms`/`end_ms`. There is **no "turn complete" event**.
- **Moderation.** Built-in moderation can cut assistant audio or end the session.
- **Interruptions.** A spoken interruption does **not** cancel backend work, so apps must version tasks and drop stale results. Only client delegation lets you discard results before the voice model sees them.
- **Voices** ([live-conversations guide](https://developers.openai.com/api/docs/guides/live-conversations)):
  - 21 voices across English, Portuguese, German, French, Hindi, Japanese and Korean, with the German, French, Hindi, Japanese and Korean voices added 2026-10-16. **No Spanish-native voice is listed.**
  - Prompt-to-voice (GA 2026-10-16, free to create, up to 100 per org) works **only in GPT-Live**.
  - Custom voices in GPT-Live currently support **English accents only** (unverified: this is not stated on the live-conversations, live or custom-voices pages as fetched on 2026-10-20).
  - The documented default voice is `marin`, which is not in the 21-voice table.
- **Benchmarks.** OpenAI claims about 30 points over gpt-realtime-2.1 on Full-Duplex-Bench, and a customer (Speak) reported almost 80% fewer interruptions. Both are vendor-reported and unreproduced, per [Rime's review](https://www.rime.ai/resources/openai-gpt-live-api-capabilities-limits-and-alternatives) (2026-09-28, written by a competitor). AA independently gives 94.9–97.3% Conversational Dynamics.
- **Relevance to Magic Worlds.** The architecture is the right idea: a fast talker plus a slow thinker. But the voice layer paraphrases, so character lines would not be verbatim, and the voices are OpenAI's. Plain adoption is a poor fit for authored roleplay. Copy the pattern in your own cascade instead (§9).

### 3.3 Google Gemini Live API: 3.8 Live, 3.8 Live Extended Thinking, 3.1 Flash Live, 2.5 native audio

**Timeline** ([Gemini API changelog](https://ai.google.dev/gemini-api/docs/changelog))
- 2025-05-20: 2.5 native-audio dialog models, with affective dialog and proactive audio.
- 2025-09-23 and 2025-12-12: `gemini-2.5-flash-native-audio-preview-*`.
- 2026-03-26: `gemini-3.1-flash-live-preview`.
- 2026-08-26: `gemini-3.5-transcribe-live`, a streaming STT model with interim and final results, a smart mode and multiple VAD strategies.
- **2026-09-15: `gemini-3.8-live` and `gemini-3.8-live-extended-thinking`, both GA.** The same launch included Gemini 3.5 Live Translate (speech-to-speech translation, 70+ languages). At launch, Google said Extended Thinking ranked #1 on the AA S2S leaderboard; Grok Voice 3.0 has since overtaken it.
- 2026-09-18: 2.5 access limited to users who used them before. The Gemini API changelog says these models "are not deprecated and remain available until further notice".
- 2026-09-22: `gemini-3.8-flash-tts` and `gemini-3.8-flash-lite-tts` GA, with voice design, voice replication (with consent check) and an Extended Voice Library at `/v1beta/voices`. *(Added 2026-10-20.)*
- Vertex / Gemini Enterprise Agent Platform lists `gemini-live-2.5-flash-native-audio` (released 2025-12-12) for **retirement on 2026-12-13** ([Vertex page](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-live-api)). The footnote says the date applies to that platform, and the model may stay reachable through the Gemini API. Vertex also publishes a "Migrate from Gemini 2.5 Flash Live API to Gemini 3.8 Live" guide.

**Capabilities** ([Google blog](https://blog.google/innovation-and-ai/technology/developers-tools/build-real-time-voice-applications-gemini-audio/), 2026-09-15; [Live guide](https://ai.google.dev/gemini-api/docs/live-guide))
- Asynchronous function calling: tools run while audio continues. This differs by model:
  - 3.8 Live supports `NON_BLOCKING` and `BLOCKING`, plus `SILENT`, `WHEN_IDLE` and `INTERRUPTED` scheduling.
  - 3.8 Live Extended Thinking supports `NON_BLOCKING` only, with no scheduling.
  - 3.1 Flash Live is "sequential only".
- Alphanumeric precision.
- 97+ languages per the blog; the Live guide lists **99**. Consistent accents; automatic language switching, which can be restricted by instruction.
- Native-audio models have a **128k** context.
- Thinking:
  - 3.8 Live has no `thinkingLevel` setting.
  - Extended Thinking offers low, medium and high.
  - 3.1 Flash Live offers minimal through high.
- **Affective dialog and proactive audio** exist on the 2.5 native-audio models (v1alpha/v1beta) and are *not supported in 3.1 Flash Live*. The Live guide (re-read 2026-10-20) needs `v1beta` and excludes only 3.1 Flash Live, but does not confirm 3.8 support [unverified].

**Output modality.** "Native audio models only support AUDIO response modality." Text comes only from output transcription. **No half-cascade is possible**, and Pipecat warns that recent models may not support text output ([Pipecat docs](https://docs.pipecat.ai/server/services/s2s/gemini-live)).

**Turn-taking** ([Live guide](https://ai.google.dev/gemini-api/docs/live-guide))
- Automatic VAD with start and end sensitivity, `prefixPaddingMs` and `silenceDurationMs`. Google recommends 500–800 ms; the server default is about 800 ms.
- Client-side VAD can be used with `activityStart`/`activityEnd`.
- Hybrid mode: client `audioStreamEnd` plus a server fallback.
- On interruption, Google discards unsent generation and cancels pending function calls.
- **Pitfall:** Google keeps only what was *delivered* to the client in history, not what was *played*. If audio sits in a client buffer, history over-counts what the user actually heard.

**Session limits** ([session management](https://ai.google.dev/gemini-api/docs/live-session))
- Audio-only sessions last **15 min** without compression; audio+video sessions last 2 min.
- Connections last about 10 min.
- Session resumption handles are valid for 2 h.
- A `GoAway` message warns before disconnection.
- Sliding-window context compression allows unlimited sessions.

**Voices**
- **30 prebuilt voices** in Live (Zephyr, Kore, Puck, Charon…) across 24 listed locales, including es-US ([Vertex voice config](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api/configure-language-voice)).
- Custom voices in Live (`replicated_voice_config`, a 10–20 s sample) are available to **select customers only**, through the Google Cloud account team. A developer forum reported "not allowlisted" errors even after TTS-side consent passed.
- Self-serve voice replication (10–30 s clip plus a consent recording, adult speaker, 200 voices per project) is documented **only for the Gemini 3.8 Flash TTS and Flash-Lite TTS models** ([voice replication](https://ai.google.dev/gemini-api/docs/voice-replication)).

**Pricing** ([pricing](https://ai.google.dev/gemini-api/docs/pricing); 3.8 Live, 3.8 Extended Thinking and 3.1 Flash Live share it)
- Audio: $3 in / $12 out per 1M tokens. Text: $0.75 in / $4.50 out.
- Per minute: **$0.005 for input audio** and **$0.018 for output audio**, at 25 tokens/s.
- The free tier is free, but **free-tier data is used to improve Google products**; paid-tier data is not.
- **Every turn is billed for all tokens in the context window**, and audio history is re-billed at the audio input rate ([best practices](https://ai.google.dev/gemini-api/docs/live-api/best-practices)). No Live-specific caching discount is documented.

**Independent benchmarks**
- Full-Duplex-Bench v1 (2025, [possibly stale]) found Gemini Live had the **lowest takeover rate during pauses**: pause TOR 0.255–0.310 versus Moshi's 0.98. Its turn-taking latency, however, was 1.30 s ([FDB v1 paper](https://arxiv.org/html/2503.04721)).
- AA scores 3.8 Live at 96.1% Conversational Dynamics with 1.18 s TTFA.

**Policy.** Google's [Generative AI Prohibited Use Policy](https://policies.google.com/terms/generative-ai/use-policy) (last modified 2024-12-17) prohibits "sexually explicit content… for the purpose of pornography or sexual gratification", with possible exceptions for artistic purposes.

### 3.4 xAI Grok Voice Agent API (Grok Voice 3.0)

- Launched 2025-12-17 at $0.05/min ([xAI news](https://x.ai/news/grok-voice-agent-api)). The news page returned HTTP 403 on re-check; AA lists Grok Voice Fast 1.0 at $3.00/hr, which matches $0.05/min. **Grok Voice 3.0** (`grok-voice-3.0`; alias `grok-voice-latest`) is **$0.08/min ($4.80/hr)** plus $0.004 per text input, confirmed on xAI's own [models and pricing page](https://docs.x.ai/docs/models). Silence is not excluded from billing, per eesel's reading. Server-side tools are billed per call ([eesel review](https://www.eesel.ai/blog/grok-voice-3-pricing), edited 2026-10-15).
- **Version history** ([xAI release notes](https://docs.x.ai/docs/release-notes); headings give the month only):
  - Dec 2025: Speech to Speech API GA.
  - Apr 2026: Grok Voice 1.0.
  - May 2026: Custom Voices (clone from a short clip, for TTS and S2S) and Smart Turn end-of-turn detection for streaming STT.
  - Jul 2026: Grok Voice 2.0; `grok-voice-latest` pointed to it from 2026-08-05.
  - Sep 2026: Grok Voice Transcribe 2.0 became the default STT.
  - Oct 2026: Grok Voice 3.0. `grok-voice-2.0` was deprecated with an upgrade path "at the same price", and `grok-voice-transcribe-1.0` reached end of life on 2026-10-02.
- AA ranks it **#1 on the S2S Index (86.9)**, with Big Bench Audio 99%, Conversational Dynamics 97.0% and TTFA 0.81 s.
- **API** ([docs](https://docs.x.ai/docs/guides/voice/agent))
  - OpenAI-Realtime-compatible wire format at `wss://api.x.ai/v1/realtime`, with ephemeral tokens for browsers.
  - Audio formats: PCM 8–48 kHz, G.711 and Opus.
  - `server_vad` or manual commit; `idle_timeout_ms`.
  - Up to 100 key terms.
  - Reasoning `high` or `none`.
  - Output speed 0.7–1.5.
  - **`force_message` for verbatim scripted lines.** Most S2S APIs lack this. It is a `conversation.item.create` item type that speaks fixed text through TTS without calling the model. It is an xAI extension, not part of the OpenAI Realtime protocol.
  - No text-only output mode is documented, so half-cascade on Grok is unsupported as far as the docs show.
  - Session resumption works within 30 min of inactivity.
  - 20+ languages; Spanish and Portuguese need regional codes.
- **Custom voices.** The docs (re-read 2026-10-20) say a cloned `voice_id` from the Custom Voices API works as the `voice` on `session.update`, "exactly like a built-in voice". However, a [LiveKit community thread](https://community.livekit.io/t/grok-realtimemodel-not-accepting-custom-xai-voice-clone-only-default-voices-work/1117) reported clones being rejected on the realtime endpoint. **Verify by testing.**
- **Concurrency** scales with lifetime spend since 2026-01-01: 10 sessions at $0, 20 at $50, 50 at $250, 100 at $1,000 and 200 at $5,000. These figures are from eesel; xAI's voice-agent page does not state them.
- **Policy.** I could not fetch xAI's acceptable-use page (HTTP 403). The consumer Grok app offers an opt-in "Spicy Mode" that permits suggestive content but blocks explicit sex acts ([AI Haven tracker](https://aihaven.com/ai-adult-content-policy-tracker/), 2026-07-05). The API policy for fictional mature roleplay is [unverified] and must be confirmed in writing.

### 3.5 ElevenLabs Eleven Realtime v1 (Mini / Max), launched 2026-10-20

- **Claims** ([ElevenLabs blog](https://elevenlabs.io/blog/realtime); vendor-reported, with evaluations credited to AA)
  - TTFA 0.57 s (Max) and 0.62 s (Mini).
  - Big Bench Audio 98.8% (Max) and 75.9% (Mini).
  - Full-Duplex-Bench 94.1% (Max) and 95.8% (Mini).
  - Tool task success 87.1% (Max) and 60.3% (Mini).
  - 90+ languages; any of the 17,000+ library voices.
  - Mini is positioned for "interactive characters".
- **API.** OpenAI-Realtime-compatible over **WebSocket only** (`wss://api.elevenlabs.io/v1/convai/realtime`, model `eleven_realtime_v1_mini`), or through ElevenAgents.
- **Price** was not published at launch.
- **Architecture dispute.** The New Stack ([2026-10-20](https://thenewstack.io/elevenlabs-voice-agent-tradeoffs/), by Amanda Caswell, headline "ElevenLabs wants to run your voice agent. Here's what developers give up."; I could only read the search snippet, and the body could not be fetched on re-check) reports that both models are **cascaded internally**, and that developers cannot select or configure the underlying LLM, STT or TTS (unverified). ElevenLabs' own blog calls it "a new class of Speech to Speech models" that replaces separate STT, turn-taking, LLM and TTS components. It uses neither "cascaded" nor "native".
- **Not yet in the ElevenLabs changelog** as of 2026-10-20 (latest entry 2026-10-12). Clone support and pricing are therefore still unconfirmed.
- **Related ElevenLabs releases that matter for the cascade** *(added 2026-10-20, from the [changelog](https://elevenlabs.io/docs/changelog))*:
  - 2026-09-28: Eleven v4 and **v4 Turbo** (real-time, vendor-reported median inference latency of about 100 ms; better cloning in 90+ languages).
  - 2026-10-05: ElevenAgents' default TTS changed from `eleven_flash_v2` to `eleven_v4_turbo`.
  - 2026-10-12: the realtime STT WebSocket gained a `turn_prediction` commit strategy. This is a semantic end-of-turn option usable in a cascade.
- **Unknowns.** Whether user Instant or Professional Voice Clones work in Realtime is **not stated** [open question]. ElevenLabs' [use policy](https://elevenlabs.io/use-policy) (updated 2026-10-09) bans explicit sexual visual depictions, non-consensual intimate content, and cloning a voice without consent. The AI Haven tracker says ElevenLabs' conversational-AI terms bar customer-provided LLMs from generating sexual content [unverified against the primary text].

### 3.6 Amazon Nova 2 Sonic (Bedrock)

**Docs** ([Nova 2 Sonic user guide](https://docs.aws.amazon.com/nova/latest/nova2-userguide/using-conversational-speech.html))
- Bidirectional streaming.
- Languages: English (US, UK, India, AU), French, Italian, German, **Spanish**, Portuguese and Hindi, with automatic detection and code-switching.
- Turn-taking with interruptions.
- Asynchronous tool calls.
- Mixed text and audio input.
- **8-minute connection limit**, renewed using a session-continuation pattern from the code samples.

**Voices** ([language support](https://docs.aws.amazon.com/nova/latest/nova2-userguide/sonic-language-support.html))
- Fixed voices only; Spanish (US) has `lupe` and `carlos`.
- `tiffany` and `matthew` are polyglot voices that speak all supported languages.
- No custom voices are documented.

**Pricing:** AA lists $0.27/hr input and $1.08/hr output, about **$0.0045/min in and $0.018/min out**. The DeepLearning.AI and third-party summaries give $3 / $12 per 1M speech tokens. AA scores it at 88% Big Bench Audio with 1.14 s TTFA.

**Fit:** cheap, but there is no voice customization. Not suitable for character voices.

### 3.7 Azure Voice Live API

- A managed, OpenAI-Realtime-compatible WebSocket API ([overview](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live), updated 2026-10-18).
- **It formalizes the hybrid.** Every model can output through **Azure TTS voices, including custom neural voice**. That includes gpt-realtime-2.1 (Pro), gpt-realtime-2.1-mini (Standard) and cascaded GPT-5.x, 4.1 and Phi-4-mm models.
- **Extras:** noise suppression, echo cancellation, "advanced end-of-turn detection", phrase lists, custom speech and avatars.
- **Tiers:** Pro, Standard and Lite, based on the chosen model.
- **Model list (re-read 2026-10-20):**
  - Realtime: `gpt-realtime-2.1` (also `-datazone` and `-regional` variants) and `gpt-realtime-1.5` are Pro; `gpt-realtime-2.1-mini` is Standard.
  - Cascaded: `gpt-5.6-terra` is Pro and `gpt-5.6-luna` is Standard. GPT-5.4, 5.2, 5.1, 5, 4.1 and 4o are also listed.
  - `phi4-mm-realtime` (preview) is Lite.
  - A new first-party **`azure-realtime`** (Pro) uses dedicated `azure-realtime-native` voices.
  - Input STT can be `mai-transcribe-2` or `mai-transcribe-2-streaming`.
  - Audio is about 10 tokens/s in and 20 tokens/s out for OpenAI models. *(Added 2026-10-20.)*
- **Limits:** custom voice and avatar access is **Limited Access** (intake form), with separate training and hosting fees. Microsoft's Responsible AI policy also applies, which is conservative for mature content.

### 3.8 Alibaba Qwen Omni Realtime (Model Studio / DashScope)

**Realtime models** ([Model Studio realtime doc](https://www.alibabacloud.com/help/en/model-studio/realtime), updated 2026-10-16)
- `qwen3.8-omni-flash-realtime`, `qwen3.5-omni-plus/flash-realtime` and the older `qwen3-omni-flash-realtime-2025-09-15`. The "full-duplex interaction" label for 3.8 is (unverified): the re-read realtime page describes turn-based control (server VAD, semantic VAD or manual) and does not say full-duplex.
- Transports: WebSocket, WebRTC and AOQ.
- VAD: `server_vad`, plus `semantic_vad`, which filters backchannels and noise.
- **Text-only output** with `modalities: ["text"]`, so half-cascade is possible.
- WebSocket sessions last up to **120 minutes**; no WebRTC limit is stated. 3.8 accepts up to 196,608 input tokens, but retained context is capped at 100 audio turns or 600 s of audio, and the oldest history is dropped first.
- Audio is billed at 7 tokens/s in and 12.5 tokens/s out for 3.8 and 3.5; the 2025-09-15 model uses 12.5 tokens/s both ways. Audio under 1 s is billed as 1 s. Input re-accumulates every turn.
- A voice-cloning guide exists for custom voices; I did not verify that cloned voices work in realtime sessions.
- Speech generation covers 36 languages and dialects; recognition covers 113.
- Regions: Singapore and Beijing.

**Benchmarks:** AA scores Qwen Audio 3.0 Realtime Plus at 99% Big Bench Audio and **98.4%** Conversational Dynamics, at **$0.03 / $0.18 per hour**, which is very cheap. Its TTFA of 1.54 s is relatively slow.
- **Caution (added 2026-10-20):** "Qwen Audio 3.0 Realtime" is the name AA uses. Model Studio's realtime page does not list it, and AA does not list `qwen3.8-omni-flash-realtime`. Do not assume the Qwen Audio 3.0 scores and price apply to Qwen 3.8 Omni (unverified mapping).
- AA's Qwen3.5 Omni rows are much weaker or more expensive: Flash Realtime scores 59% Big Bench Audio at 0.79 s; Plus Realtime scores 99% at 2.64 s; both cost $0.16 / $0.82 per hour.

**Open weights:** [Qwen3-Omni](https://github.com/QwenLM/Qwen3-Omni) (2025-09-22, Apache-2.0)
- 30B-class MoE Thinker–Talker design.
- 19 speech-input languages (the README lists 18) and 10 speech-output languages, both including **Spanish**.
- Only 3 voices (Ethan, Chelsie, Aiden); no cloning.
- Needs **79–145 GB VRAM** in BF16 under Transformers for the Instruct model (15–120 s video inputs); the Thinking model needs 69–132 GB. `disable_talker()` saves about 10 GB.

**Considerations:** data residency (Singapore or China) and content policy need review.

### 3.9 Ultravox (audio-in LLM, text out)

- **Open model** ([GitHub](https://github.com/fixie-ai/ultravox), MIT): an audio projector on an open LLM (default backbone Llama 3.3 70B; 8B variant). It ingests audio and **emits streaming text**, skipping ASR. The latest release is v0.7 (2025-12). No speech output.
- **Hosted Ultravox Realtime** ([pricing](https://www.ultravox.ai/pricing), 2026-10-09): **$0.05/min** after 30 free minutes on pay-as-you-go; Pro is $100/month. "TTS included" is (unverified): the pricing page does not mention TTS. Plans include 1 custom voice clone (pay-as-you-go) or 5 (Pro). Pay-as-you-go is capped at 5 concurrent calls.
- **Why it matters:** this is the cleanest "skip STT" pattern. It keeps paralinguistic cues from the user's audio while you keep TTS control, or self-host it. With self-hosting, the LLM's content behaviour is yours to control, but persona and roleplay quality depends on the backbone.

### 3.10 Hume EVI: shutting down, do not adopt

- Hume announced on 2026-10-02 that its **EVI and TTS (Octave) APIs end on 2026-11-13 at 12:01 a.m. EST**, after which account data is permanently deleted. Expression-measurement APIs and the new VoiceEQ evaluation platform continue, per Cartesia's summary ([Hume EVI docs](https://dev.hume.ai/docs/speech-to-speech-evi/overview); [Cartesia migration note](https://www.cartesia.ai/learn/top-hume-ai-alternatives)).
- Before the shutdown, EVI 4-mini supported Spanish and 10 other languages (EN, JA, KO, ES, FR, PT, IT, DE, RU, HI, AR; confirmed on the EVI overview), BYO-LLM, voice cloning and design, prosody-based end-of-turn detection, and 30-minute sessions. Pricing was about $0.04–0.07/min (unverified: the current [pricing page](https://www.hume.ai/pricing) no longer shows EVI prices).
- **Lesson:** small S2S vendors are a platform risk. Keep an adapter layer.

### 3.11 Other names on the board

- **StepFun:** Step-Audio R1.1 Realtime (98% Big Bench Audio, 1.53 s TTFA, $0.06 / $1.69 per hour) and StepAudio 3 Realtime (top dynamics, but 8.8 s TTFA).
- **Newer realtime entrants:** Deepslate Opal (0.44 s TTFA), Boson Higgs Realtime, Krafton Raon SpeechChat and Phonic, which has a LiveKit plugin. These are emerging and largely unvetted.
- **Sesame CSM** ([research post](https://www.sesame.com/research/crossing_the_uncanny_valley_of_voice), 2025-02-27, [possibly stale]):
  - A context-aware conversational *TTS*, Llama backbone plus Mimi RVQ, in 1B, 3B and 8B sizes. It is **not** full-duplex and needs an LLM to supply text.
  - Mostly English.
  - With conversational context, human raters still preferred real recordings.
  - A public developer API was not confirmed [open question].

---

## 4. Master comparison: commercial S2S for a character-voice roleplay app

| Provider / model | Duplex | TTFA (AA) | Custom / cloned voice | Spanish | Text-out (half-cascade) | Session limit | List price | Mature-fiction policy fit |
|---|---|---|---|---|---|---|---|---|
| OpenAI gpt-realtime-2.1 | Turn-based + barge-in; semantic_vad | 0.97–1.21 s | Consent-recording voices, sales-gated, 20/org; no fictional-character imitation | Yes (multilingual; stock voices English-native) | **Yes** | 60 min | ≈$0.019/min in + $0.077/min out + context | Poor (no adult content offered in API) |
| OpenAI gpt-realtime-2.1-mini | same | 0.85 s (Minimal) | same | Yes | **Yes** | 60 min | ≈$0.006/min in + $0.024/min out + context | Poor |
| OpenAI GPT-Live-1 | **Full-duplex** | 1.24–1.34 s | Prompt-to-voice (GPT-Live only), English accents; consent voices | **No Spanish-native voice listed** | No (paraphrases) | 128k context, engine swap at 90% | $0.05/min + backend | Poor; built-in moderation cuts audio |
| Gemini 3.8 Live | Turn-based + strong pause handling | 1.18 s | Allowlist-only `replicated_voice_config` | Yes (97+ languages, es-US) | **No** (audio only) | 15 min without compression; about 10 min per connection | $0.005 + $0.018/min + full-context re-billing | Prohibited (GenAI policy) |
| Gemini 3.8 Live Ext. Thinking | same | 1.35 s | same | Yes | No | same | same token rates | Prohibited |
| Grok Voice 3.0 | Turn-based + barge-in | 0.81 s | Custom voices documented to work in realtime (one conflicting community report) | Yes (regional codes) | Not documented | Resume within 30 min of inactivity | **$0.08/min flat** | Unclear; possibly most permissive [verify] |
| Eleven Realtime v1 Mini/Max | Not stated | 0.57–0.62 s | 17k library voices; user clones unconfirmed | Yes (90+) | Unknown | Unknown | Not published | Restrictive for sexual content in agents [verify] |
| Nova 2 Sonic | Turn-based | 1.14 s | **None** (fixed voices) | Yes (lupe, carlos, polyglot) | Text input yes; text output n/a | 8 min per connection (renewable) | ≈$0.0045 + $0.018/min | AWS AUP (not reviewed) |
| Azure Voice Live | Depends on model | n/a | **Azure custom neural voice** (Limited Access) | Yes | n/a (TTS built in) | n/a | Pro / Std / Lite tiers | Microsoft RAI (conservative) |
| Qwen 3.8 Omni Flash Realtime | Full-duplex claimed (unverified; docs describe turn-based VAD) | Not on AA (Qwen Audio 3.0 rows: ≈1.5 s; mapping unverified) | Voice-cloning guide exists [verify in realtime] | Likely (36 output languages) | **Yes** | 120 min (WebSocket) | Not on AA (Qwen Audio 3.0: ≈$0.03 / $0.18 per hour; mapping unverified) | Unknown; China/Singapore regions |
| Ultravox Realtime | Turn-based | n/a | 1–5 clones by plan | Backbone-dependent | Natively text-out (open model) | n/a | $0.05/min | Self-hostable open weights |
| Hume EVI 3 / 4-mini | — | — | — | — | — | — | — | **Sunset 2026-11-13** |

---

## 5. Open-weight omni and full-duplex models, and the research behind them

| Model | Date | Type | Languages (speech) | Voices / cloning | License | Notes |
|---|---|---|---|---|---|---|
| **Kyutai Moshi** ([arXiv 2410.00037](https://arxiv.org/abs/2410.00037)) | Sep 2024 [stale] | Full-duplex, two parallel audio streams + "inner monologue" text | English | Fixed | CC-BY / Apache / MIT | 160 ms theoretical, about 200 ms practical latency; AA Big Bench Audio **4%** |
| **NVIDIA PersonaPlex** ([GitHub](https://github.com/NVIDIA/personaplex); arXiv 2602.06053) | 2026 (Feb) | Moshi fine-tune; **text role prompts** + voice conditioning | English (Fisher-trained) | **18 fixed voice embeddings**, no arbitrary cloning | MIT code / NVIDIA Open Model License | AA: Conversational Dynamics 91%, reasoning 19%; LiveKit plugin exists |
| **NVIDIA Nemotron Voicechat** | 2026 | Full-duplex | — | — | — | AA: reasoning 27%, dynamics 52.9% |
| **MiniCPM-o 4.5** ([GitHub](https://github.com/OpenBMB/MiniCPM-o)) | 2026 (API 2026-05-17) | 9B full-duplex omni (video + audio) | **English and Chinese only** | Cloning from a short reference; "role play" | Apache-2.0 | Good for EN/ZH companions; no Spanish |
| **Qwen3-Omni** ([GitHub](https://github.com/QwenLM/Qwen3-Omni)) | 2025-09-22 | MoE Thinker–Talker omni | 19 in / 10 out, **incl. Spanish** | 3 voices, no cloning | Apache-2.0 | 79–145 GB VRAM; `disable_talker()` gives text-out mode (audio-in LLM) |
| **Step-Audio 2 mini** ([GitHub](https://github.com/stepfun-ai/Step-Audio2)) | Aug–Sep 2025 | End-to-end audio LLM with tool calling and paralinguistics | ZH, EN, JA, AR, Cantonese | Timbre switching, no cloning | Apache-2.0 | Paralinguistic score 80–83, far ahead of GPT-4o Audio's 43 |
| **Kimi-Audio 7B** ([GitHub](https://github.com/MoonshotAI/Kimi-Audio)) | Apr 2025 [stale] | 12.5 Hz semantic tokens + Whisper features; Qwen2.5-7B init | ZH / EN | — | Apache / MIT | Strong ASR (LibriSpeech 1.28 / 2.42 WER) |
| **GLM-4-Voice 9B** ([GitHub](https://github.com/zai-org/GLM-4-Voice)) | Late 2024 [stale] | 12.5 Hz tokenizer + CosyVoice flow-matching decoder | ZH / EN | Emotion, speed and dialect control | Apache code + model license | First audio after about 10 speech tokens |
| **LLaMA-Omni 2** ([GitHub](https://github.com/ictnlp/LLaMA-Omni2)) | May 2025 [stale] | Qwen2.5 + streaming AR speech decoder (CosyVoice2) | EN or EN/ZH | — | **Non-commercial** | 0.5B–32B sizes |
| **Freeze-Omni** ([GitHub](https://github.com/VITA-MLLM/Freeze-Omni)) | Nov 2024 [stale] | Frozen Qwen2-7B + speech encoder/decoder + chunk-level duplex state head | — | — | see repo | AA reasoning 33%; FDB: best interruption quality among open models |
| **Baichuan-Omni-1.5** | Jan 2025 [stale; not re-verified] | Omni | ZH / EN focus | — | — | Not re-checked in this pass |
| **Kyutai Unmute** ([GitHub](https://github.com/kyutai-labs/unmute)) | 2025–2026 | **Cascade** around any text LLM (Kyutai STT + TTS 1.6B) | EN / FR | Voice embeddings only; cloning restricted to precomputed embeddings ([TTS card](https://huggingface.co/kyutai/tts-1.6b-en_fr)) | MIT / CC-BY | TTS latency about 450–750 ms; STT 1B has semantic VAD, 0.5 s delay; an H100 serves about 400 STT streams |

**Research findings on full duplex**
- **Full-Duplex-Bench v1** ([arXiv 2503.04721](https://arxiv.org/html/2503.04721), Mar 2025):
  - dGSLM and Moshi take the turn during user pauses about 93–98% of the time, so they are too eager.
  - Moshi responds fast (0.27 s turn latency) but the quality of its replies to interruptions is poor (GPT-4o judge score 0.77/5).
  - Freeze-Omni, a cascade-like design, gives the best interruption replies (3.6) but is slow (0.95 s).
  - Gemini Live had the best pause handling (TOR 0.26–0.31) and backchannel timing, but 1.3 s turn latency.
- **Later versions:** v1.5 (arXiv 2507.23159, data 2025-08-15) adds overlap scenarios (backchannels, side conversations, ambient speech). **v2** ([arXiv 2510.07838](https://arxiv.org/abs/2510.07838); WebRTC orchestrator released 2026-02-23) is a live WebRTC examiner. It found full-duplex systems "get confused when users talk at the same time", struggle with corrections, and lose track of entities. **v3** (arXiv 2604.04847, Apr 2026) tests tool use under real disfluencies ([repo](https://github.com/DanielLin94144/Full-Duplex-Bench)).
- **SyncLLM** ([arXiv 2409.15594](https://arxiv.org/abs/2409.15594), Meta, EMNLP 2024):
  - Time-synchronizes Llama-3-8B with the wall clock.
  - Trained on about 212k hours of synthetic plus about 2k hours of real dialogue.
  - Tolerates up to 240 ms network latency.
- **dGSLM** (2022), the original two-tower textless dialogue model, natural backchannels but weak semantics [stale; known via FDB results].
- **Takeaway:** the full-duplex and "natural timing" problem is now largely solved in commercial models, with 94–98% on the AA Full-Duplex-Bench subset. Open full-duplex models trade intelligence for timing. **None of the open full-duplex models offers Spanish plus arbitrary voice cloning plus strong reasoning.**

---

## 6. Cost: native S2S compared with the raw audio math

1. **Context re-billing dominates.**
   - OpenAI resends the full conversation every response. The [cost guide](https://developers.openai.com/api/docs/guides/realtime-costs) says caching is best-effort, and editing earlier items or changing instructions or tools mid-session breaks it. `retention_ratio` and `token_limits.post_instructions` cap growth.
   - Gemini bills **all context tokens every turn**, and audio history at 25 tokens/s.
   - Qwen re-accumulates input every turn.
2. **Measured data** ([HackerNoon](https://hackernoon.com/openai-realtime-api-pricing-in-2026-real-world-data-from-4000-measured-sessions), 2026-06-11; 4,000 gpt-realtime-mini sessions, single-author data):
   - A typical session (a real-estate tour agent) costs **$0.070/min**; heavy Q&A $0.12–0.15/min; the worst case was $2.05 for a 14-minute session ($0.146/min) at 480k tokens, because history was resent every turn without pruning. *(Corrected 2026-10-20: the article gives one typical figure, not a $0.05–0.08 range.)*
   - This note's raw-audio estimate of about $0.015/min is its own calculation, not the article's (unverified). The article's own "hard ceiling" is about $0.12 per minute of continuous AI speech.
   - **RAG injections reset the cached prefix, costing about $0.007–0.009 each.** In Magic Worlds terms, every mid-call lorebook injection busts the cache.
   - The author's recommended default quote is **$0.20/min** for gpt-realtime-mini products (corrected from "$0.15–0.20"). The author notes gpt-realtime-2 is about 3× more expensive for audio.
3. **Flat-rate options** bill silence:
   - GPT-Live: $0.05/min plus backend.
   - Grok Voice 3.0: $0.08/min.
   - Ultravox: $0.05/min.
   - In companion calls, users pause, think and listen, so idle-session auto-close matters.
4. **Gemini 3.8 Live and Nova 2 Sonic have the lowest list prices**, about $0.023/min for one minute each way. With full-context re-billing and no documented caching, an estimate (not measured) for a 10-minute call at about 6 turns/min with 10–15k audio tokens of history is **$0.15–0.30/min** unless context compression keeps the window small. **Measure before trusting the list price.**
5. **Self-hosting open omni models removes per-minute fees** but adds GPU cost. Qwen3-Omni needs 79+ GB per instance in BF16, before batching or vLLM optimisation. Quality is also weaker than commercial models for Spanish and persona work.

The current cascade's unit costs (Groq STT, the agent-graph LLM, ElevenLabs or Fish TTS) are covered in the STT/TTS evidence notes. The S2S numbers above are the comparison point.

---

## 7. Character voices: the deciding constraint

| Need | Best S2S answer (Oct 2026) | Cascade answer |
|---|---|---|
| Per-character cloned voice from a user-provided sample | xAI custom voices (verify in realtime); Qwen cloning (verify); Ultravox clones (1–5); MiniCPM-o (EN/ZH self-host) | Any cloning TTS (ElevenLabs IVC/PVC, Fish, etc.) |
| Designed voice from a text prompt | OpenAI prompt-to-voice (**GPT-Live only, English accents**); Google voice design (**TTS models**, not Live) | Same TTS vendors' voice design |
| Fictional-character likeness | **OpenAI forbids requesting imitation of a fictional character**; Google and ElevenLabs require consent of the real speaker | Policy depends on the TTS vendor; designed voices "inspired by" are safer |
| Spanish character voices | Gemini (es-US), Nova (lupe, carlos), Eleven (90+ languages); no Spanish-native GPT-Live voice | Full control |
| Change voice mid-call (multi-character scenes) | OpenAI: voice is fixed after first audio; GPT-Live: new session; Gemini: per session | Per-utterance voice switching with multi-context TTS (already supported by the ElevenLabs multi-context WebSocket) |

**Conclusion:** for an app whose identity is *bring-your-own-character-voice*, native S2S currently means accepting a stock or designed voice, or depending on the least mature or least documented providers. **Half-cascade or cascade is the only way to keep per-character clones and multi-voice scenes.**

---

## 8. Content policy, moderation and observability for fictional mature roleplay

- **No text gate before speech.** In S2S, audio and transcript stream together. Mitigations:
  - **Streaming output-transcript guardrails** ([OpenAI Agents SDK](https://openai.github.io/openai-agents-js/guides/voice-agents/build/)) run every 100 characters by default (`debounceTextLength`) and on the final transcript. A trip emits `guardrail_tripped` and cuts the response. Because "speech usually takes longer than transcript generation", this *often* stops unsafe output before it is heard. It is not guaranteed.
  - **Manual response gating** (`create_response:false`) for input checks.
  - **Vendor moderation**, which can cut audio or end sessions (GPT-Live). This is opaque, and it may false-positive on consensual fiction and end a paid call.
- **Transcripts are approximate and late.** OpenAI calls input transcription "a rough guide" (unverified wording: the re-read conversations guide says only that transcript and audio cannot be precisely aligned, so truncation does not yield an exact transcript) and it is asynchronous. LiveKit reports that user transcripts often arrive *after* the agent's reply. GPT-Live has no turn-complete event. Responses cut by interruption keep no final transcript (Agents SDK). This hurts memory extraction, safety audit, quota accounting by text and the chat-log UI.
- **Vendor LLM lock-in.** In S2S, and in half-cascade, the vendor's model writes the character's lines.
  - Google prohibits sexually explicit content, Anthropic prohibits it, and OpenAI paused ChatGPT adult mode indefinitely (2026-03-26, confirmed in the tracker). "No API adult tier" is (unverified): the tracker does not address the API ([AI Haven](https://aihaven.com/ai-adult-content-policy-tracker/); [OpenAI forum thread](https://community.openai.com/t/you-said-you-wanted-it-you-now-have-age-verification-you-now-have-a-usage-policy-that-allows-it-so-when-can-verified-adults-create-adult-fiction/1399668)).
  - This is incompatible with the app's 18+ verified tier unless calls for those characters stay on the cascade with an LLM whose policy fits.
- **Data retention.**
  - OpenAI keeps data 30 days by default, ZDR is eligible with limits, voice creation is not ZDR-compatible, and BAA needs Modified Retention (per Rime).
  - Gemini free-tier data is used to improve products; paid-tier data is not.
  - GPT-Live stored sessions expire after 30 days.
  - Hume deletes all data after 2026-11-13.
- **Controllability.** Only xAI documents a verbatim `force_message`. OpenAI GPT-Live cannot guarantee exact text. Realtime 2.x preambles are "promptable" but generated. For safety disclaimers, crisis-resource lines and break nudges (the Magic Worlds `safety` feature), **pre-rendered TTS clips played by the app** are the reliable route on every S2S stack.

---

## 9. Hybrid patterns and when each wins

| Pattern | Wins when | Loses when |
|---|---|---|
| **Full cascade** (today) | Custom or cloned voices, multi-voice scenes, own LLM and policy, text-first moderation, exact lorebook and persona control, transcripts as source of truth | Needs good engineering to hit about 1 s; loses user prosody and emotion; turn-taking depends on your VAD or end-of-turn model |
| **Half-cascade** (realtime model in text-out mode → own TTS) | You want S2S-grade turn detection and paralinguistic understanding but keep voices and exact scripts. Supported by OpenAI Realtime and Qwen Realtime; Azure Voice Live productizes it | The vendor LLM still writes lines (policy lock-in); two bills; text-out mode can drift (LiveKit notes OpenAI "is more likely to reply in text only after extensive history"); not possible on Gemini native audio |
| **Audio-in LLM** (Ultravox / Qwen3-Omni with talker disabled / Gemini or gpt-audio via standard APIs) | Skip STT latency; keep emotion and prosody; self-host for policy control (Ultravox, Qwen3-Omni) | Open audio-LLMs lag frontier text LLMs at persona writing; no streaming partial transcripts for UI or safety; VRAM cost |
| **Voice layer + backend delegation** (GPT-Live) | Agentic tasks where paraphrase is fine and a natural full-duplex "front desk" matters | Authored character dialogue (paraphrase breaks voice and lore); vendor voice; silence billed |
| **Native S2S end-to-end** | SFW companions with stock or designed voices, language practice, mixed-language users, lowest engineering effort | Character clones, mature content, multi-voice, auditability |
| **Cascade with S2S fallback (or the reverse)** | Graceful degradation per character, plan or region | Two behaviours to QA; persona consistency differs across engines |

**Emerging techniques worth copying into a cascade.** These are the S2S-era ideas that do not require an S2S model:
1. **Semantic end-of-turn detection** (OpenAI `semantic_vad`; Qwen `semantic_vad` that filters backchannels; Gemini hybrid client/server VAD; Kyutai STT semantic VAD).
2. **Preambles and fillers** (gpt-realtime-2 `commentary` phase): a fast, short in-character acknowledgement while the heavy LLM thinks.
3. **Fast-talker / slow-thinker split** (GPT-Live delegation; Gemini Extended Thinking "thinks in the background").
4. **Task versioning** to drop stale results after barge-in.
5. **Act on transcript deltas before end of turn** (GPT-Live's Decisions integration; use a small model on partials).
6. **Transcript-delta guardrails** with a debounce.
7. **Context-window compression and summarization** with application-owned memory ("keep important facts and task state in your application", per OpenAI).

---

## 10. Classification

**(a) Established best practice**
- Keep the transport, client playback buffer and barge-in truncation under app control.
  - Truncate history to *played* audio: OpenAI `conversation.item.truncate` with `audio_end_ms`. Gemini, by contrast, only knows what was *delivered*.
- Use ephemeral or short-lived tokens for browser-to-vendor connections (OpenAI, Gemini, xAI).
- Use WebRTC for browser S2S (OpenAI and GPT-Live recommend it). Send small audio chunks of 20–100 ms and resample to 16 kHz for Gemini.
- Plan session lifetimes and resume with handles:
  - OpenAI: 60 min.
  - Gemini: about 10 min per connection and 15 min per session without compression; resumption handles last 2 h.
  - Nova: 8 min per connection.
  - Qwen: 120 min.
- Keep instructions and tools stable mid-session to preserve caching; prune history to about 10 items or summarize.
- Play app-critical lines (disclaimers, crisis lines) as pre-rendered audio.

**(b) Current SOTA and leading options (Oct 2026)**
- **Intelligence plus dynamics:** Grok Voice 3.0 (S2S Index 86.9, 0.81 s), GPT-Live-1, Gemini 3.8 Live and Extended Thinking, gpt-realtime-2.1.
- **Latency:** Eleven Realtime v1 (0.57–0.62 s, vendor and AA), Deepslate Opal (0.44 s).
- **Dynamics per dollar:** Qwen Audio 3.0 Realtime (98.4% dynamics at $0.03 / $0.18 per hour).
- **Cheapest big-vendor list price:** Gemini 3.8 Live and Nova 2 Sonic.

**(c) Emerging and experimental**
- Full-duplex voice layers with delegation (GPT-Live, Sep 2026).
- Prompt-to-voice design (OpenAI, Oct 2026; Google, Sep 2026).
- Allowlisted voice replication inside Live APIs.
- Open full-duplex persona models (PersonaPlex, MiniCPM-o 4.5).
- Full-Duplex-Bench v2 and v3 live and tool-use evaluations.
- Eleven Realtime (day-0, architecture disputed).

**(d) Pitfalls and anti-patterns**
- Trusting list per-minute prices: context re-billing gives 3–10× multipliers, and RAG or lorebook injections break the cache.
- Building on a single small S2S vendor without an adapter (Hume sunset with about 6 weeks' notice).
- Expecting verbatim delivery from S2S or GPT-Live.
- Assuming a cloned voice works in a vendor's realtime endpoint because it works in their TTS endpoint (Gemini allowlist, xAI conflicting reports).
- Relying on S2S transcripts as the record of truth.
- Ignoring silence billing on flat per-minute plans.
- Using Gemini native audio for text-out (unsupported).
- Leaving 2.5-era Gemini models in production (Vertex retirement 2026-12-13; on the Gemini API they are access-limited but "not deprecated" as of 2026-09-18).
- Assuming instruction-following parity between 1.x and 2.x prompts (2.x is stricter).
- Letting vendor moderation silently end paid roleplay calls.

---

## 11. Implications for Magic Worlds (prioritized)

The current pipeline:
- **Client:** browser AudioWorklet VAD, with each utterance uploaded over WebSocket.
- **Backend:** server VAD gate, then Groq whisper-large-v3 batch STT, then the agent-graph callbot LLM (persona plus lorebook), then sentence-buffered ElevenLabs multi-context or Fish streaming TTS.
- **Return path:** MP3 over the same WebSocket.
- **Already in place:** barge-in with truncation to what was heard, quotas and moderation.

**P0: Keep the cascade as the primary engine for character calls.** Do not migrate wholesale to S2S.
- Three reasons, each sourced above:
  1. **Character-voice cloning and multi-voice scenes** are not available self-serve on OpenAI, Google or Amazon S2S, and OpenAI forbids fictional-character imitation.
  2. **18+ fictional roleplay** conflicts with Google's and OpenAI's policies, and S2S locks the writer LLM to the vendor.
  3. **Text-first moderation, transcripts and lorebook control** are native to the cascade and degraded in S2S.
- The cascade's real weaknesses are turn-taking naturalness and the batch-STT latency. Both are fixable without S2S; see P1.

**P1: Import S2S-era techniques into the cascade.** These are the cheapest wins.
1. **Replace batch STT with streaming STT plus semantic end-of-turn.** Candidates: `gpt-live-transcribe` / `gpt-realtime-whisper` ($0.017/min), `gemini-3.5-transcribe-live` (about $0.009/min blended, 85+ languages, interim results, smart mode), or the Kyutai STT 1B semantic VAD (EN/FR, self-host). This removes the post-VAD STT wait and lets the LLM start on stable partials.
   - Note that `whisper-1` / `gpt-4o-*-transcribe` are deprecated, with shutdown on 2027-02-26.
   - *Added 2026-10-20:* more streaming STT options with built-in end-of-turn detection:
     - the ElevenLabs realtime STT `turn_prediction` commit strategy (2026-10-12);
     - xAI Smart Turn for streaming STT (May 2026) and Grok Voice Transcribe 2.0 (Sep 2026);
     - `gpt-transcribe` ($0.0045/min) for final transcripts.
2. **Add an in-character "preamble" fast path.** A small, fast model emits a short reaction ("Mm…", "Ah, you're back!") from partial transcripts while the persona graph runs. This mirrors gpt-realtime-2's `commentary` phase and GPT-Live's fast/slow split. Version tasks so barge-in drops stale results.
3. **Add transcript-delta guardrails on the LLM text stream before TTS.** Debounce about 100 characters. Because the cascade is text-first, the check can run *before* audio, which S2S cannot do.
4. **Add backchannel-aware barge-in.** Do not treat "mm-hm" or "yeah" as an interruption (Qwen semantic_vad, Full-Duplex-Bench v1.5 behaviour). Today any VAD speech probably truncates the reply.

**P1: Build a provider-agnostic realtime adapter on the OpenAI Realtime wire protocol.**
- OpenAI, xAI Grok, ElevenLabs Realtime and Azure Voice Live are explicitly OpenAI-Realtime-compatible. Qwen's events look similar.
- One adapter makes S2S, half-cascade and transcribe-only experiments cheap and protects against vendor churn (Hume).
- Run it server-side so the backend keeps quotas, the moderation tap and the transcript store. Accept the extra hop, or use WebRTC with a sideband for latency-critical tests.

**P2: Pilot a "Live mode (beta)" for SFW characters only, behind a feature flag.** Two variants:
- **(a) Half-cascade:** gpt-realtime-2.1-mini (or Qwen 3.8 Omni Flash Realtime) in text-out mode, with persona and lorebook in instructions, feeding the existing ElevenLabs/Fish TTS with the character's cloned voice. Measure TTFA against the cascade, persona fidelity and cost.
  - Lorebook injection busts the cache: put lore in the instructions at session start and keep it stable.
- **(b) Pure S2S with a stock or designed voice:** Gemini 3.8 Live (cheapest; es-US; 97+ languages; GA) or Grok Voice 3.0 (best independent index; `force_message`; custom voices to verify).
  - Enforce compression and resumption (15-min and 10-min limits on Gemini).
  - Measure real cost with full-context re-billing.
- Success metrics: voice-to-voice p50/p95, interruption false-positive rate, persona-consistency evals in English and Spanish, cost per call-minute including silence, and moderation trips.

**P2: Evaluate Grok Voice 3.0 and Eleven Realtime specifically for character calls.**
- They are the only top-tier S2S options that might combine custom voices with a plausibly workable policy.
- Get **written** confirmation from each vendor on:
  - fictional mature content for verified adults;
  - cloned-voice support on the realtime endpoint;
  - data retention;
  - whether built-in moderation can be tuned.
- Until confirmed, mature characters stay on the cascade.

**P3: Watch open full-duplex models for self-hosted, policy-controlled calls.**
- Models: PersonaPlex (role prompts, 18 voices, English), MiniCPM-o 4.5 (cloning, EN/ZH), Qwen3-Omni (Spanish, 79+ GB VRAM).
- Today they fail on Spanish, cloning or reasoning (PersonaPlex 19% Big Bench Audio).
- Revisit when a Moshi-class model ships Spanish and voice conditioning. Ultravox self-hosted with a strong backbone is the most practical audio-in experiment, but quality and policy depend on the backbone.

**Do not:**
- Adopt Hume EVI (sunset 2026-11-13).
- Start on Gemini 2.5 native audio (legacy, Vertex discontinuation 2026-12-13).
- Use GPT-Live for authored character dialogue (paraphrase, vendor voices, no Spanish-native voice).
- Rely on S2S transcripts for memory extraction or quota accounting.

---

## 12. Open questions

1. Does Eleven Realtime accept user Instant or Professional Voice Clones, what does it cost, and is it really cascaded inside?
2. Do xAI custom voices work on `/v1/realtime` today, and what does xAI's API acceptable-use policy say about consensual adult fiction?
3. Does Gemini 3.8 Live support affective dialog or proactive audio, and is there implicit caching for Live context re-billing?
4. Do Qwen realtime sessions accept cloned voices, and what is the Spanish speech-output quality?
5. What is the actual voice-to-voice latency of half-cascade (gpt-realtime-2.1-mini text-out → ElevenLabs Flash) against an optimized cascade with streaming STT? No published head-to-head exists.
6. Is there any independent benchmark for roleplay or persona consistency over long voice sessions? None was found.
7. The context window conflict for gpt-realtime-2.x: OpenAI says 128k, Microsoft says 256k. Re-checked 2026-10-20; both pages still disagree. Until tested, budget for 128k on OpenAI direct.
8. *(Added 2026-10-20.)* What does Eleven Realtime cost, and when will it appear in the ElevenLabs changelog and docs? The latest changelog entry is 2026-10-12.

---

## 13. Newer developments found during the fact-check (2026-10-20)

These items were missing from the first pass. All come from primary changelogs or docs unless noted.

- **OpenAI**
  - `gpt-transcribe` ($0.0045/min) and `gpt-live-transcribe` ($0.017/min) shipped 2026-07-28. They are the migration targets for the `whisper-1` / `gpt-4o-*-transcribe` shutdown on 2027-02-26.
  - `gpt-realtime-translate` costs $0.034/min.
  - GPT-Live gained a native Decisions integration on 2026-10-15.
- **Google**
  - Gemini 3.5 Live Translate launched alongside 3.8 Live on 2026-09-15.
  - Gemini 3.8 Flash TTS and Flash-Lite TTS went GA on 2026-09-22, with voice design, voice replication (consent-gated, 200 voices per project, 10–30 s clip) and an Extended Voice Library. This is a cascade-side cloning TTS from a big vendor, but Google's content policy still applies.
  - Function-calling behaviour differs across the three Live models (§3.3).
- **xAI**
  - Grok Voice 2.0 (Jul 2026) is now deprecated in favour of 3.0 at the same price.
  - AA still lists 2.0 with the fastest TTFA among top-index models (0.70 s, S2S Index 81.3).
  - Custom Voices (May 2026), Smart Turn for streaming STT (May 2026) and Grok Voice Transcribe 2.0 (Sep 2026) also shipped.
- **ElevenLabs**
  - Eleven v4 and v4 Turbo shipped 2026-09-28 (v4 Turbo is real-time, about 100 ms median inference latency, vendor-reported). ElevenAgents' default TTS is now `eleven_v4_turbo` (2026-10-05).
  - The realtime STT `turn_prediction` commit strategy shipped 2026-10-12.
  - For Magic Worlds' existing ElevenLabs TTS path, **v4 Turbo is probably a bigger near-term win than Eleven Realtime**.
- **Microsoft**
  - Voice Live now has a first-party `azure-realtime` model with dedicated native voices, plus GPT-5.6 Terra and Luna cascades and `mai-transcribe-2-streaming` STT.
- **Benchmarks**
  - AA rows the first pass omitted: Grok Voice 2.0; GPT-Realtime-1.5 (0.81 s TTFA); Gemini 3.1 Flash Live High and Minimal (72.0 / 64.2 index but only 72–74% Conversational Dynamics); Qwen3.5 Omni Flash and Plus Realtime; GPT-Realtime-2.1 Mini High (4.28 s TTFA).
  - Full-Duplex-Bench added Gemini 3.1 Flash Live (2026-05-10) and Gemini 2.5 Native Audio plus PersonaPlex (2026-02-21) to v1/v1.5.
  - No v4 of the benchmark appears on the repo as of the 2026-05-20 news entry.
- **Open models**
  - No newer MiniCPM-o than 4.5. MiniCPM-V 4.7 (2026-10-12) is vision-only.
  - No open-weight Qwen3.5-Omni or Qwen3.8-Omni is listed on the Qwen3-Omni repo.
  - Ultravox is still at v0.7 (2025-12).
- **Limits of this check:** the web-search quota was exhausted, so newer items could only be found through primary changelogs (OpenAI, Gemini, xAI, ElevenLabs, Azure). Releases from Amazon (Nova Sonic after 2.0), Hume, StepFun, Kyutai or Sesame after the first pass could not be searched for (unverified).

---

## Sources (accessed 2026-10-20 unless noted)

**OpenAI**
- OpenAI API Pricing: https://developers.openai.com/api/docs/pricing (accessed 2026-10-20)
- OpenAI API Changelog: https://developers.openai.com/api/docs/changelog (entries through 2026-10-16)
- gpt-realtime-2.1 model page: https://developers.openai.com/api/docs/models/gpt-realtime-2.1 (accessed 2026-10-20)
- New Realtime models gpt-realtime-2.1 / mini (community announcement): https://community.openai.com/t/new-realtime-models-on-the-api-gpt-realtime-2-1-and-gpt-realtime-2-1-mini/1385896 (2026-07)
- GPT-Realtime-2 announcement (X): https://x.com/OpenAI/status/2052438194625593804 (2026-05-07)
- GPT-Live guide: https://developers.openai.com/api/docs/guides/live (accessed 2026-10-20)
- GPT-Live live-conversations guide: https://developers.openai.com/api/docs/guides/live-conversations (accessed 2026-10-20)
- gpt-live-1 model page: https://developers.openai.com/api/docs/models/gpt-live-1 (accessed 2026-10-20)
- Custom voices guide: https://developers.openai.com/api/docs/guides/custom-voices (accessed 2026-10-20)
- Realtime VAD guide: https://developers.openai.com/api/docs/guides/realtime-vad (accessed 2026-10-20)
- Realtime conversations guide: https://developers.openai.com/api/docs/guides/realtime-conversations (accessed 2026-10-20)
- Realtime cost guide: https://developers.openai.com/api/docs/guides/realtime-costs (accessed 2026-10-20)
- OpenAI Agents SDK (JS), voice agents build guide (guardrails, delegation): https://openai.github.io/openai-agents-js/guides/voice-agents/build/ (accessed 2026-10-20)

**Third-party coverage of OpenAI**
- DataCamp, GPT-Live-1 API tutorial: https://www.datacamp.com/tutorial/gpt-live-1-api (2026-09-15)
- Rime, OpenAI GPT-Live API capabilities, limits, alternatives: https://www.rime.ai/resources/openai-gpt-live-api-capabilities-limits-and-alternatives (2026-09-28; written by a competitor)
- HackerNoon, OpenAI Realtime API pricing from 4,000 sessions: https://hackernoon.com/openai-realtime-api-pricing-in-2026-real-world-data-from-4000-measured-sessions (2026-06-11)

**Microsoft Azure**
- Microsoft Foundry, GPT Realtime 2.x overview: https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/realtime-2 (updated 2026-09-23)
- Azure Voice Live API overview: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live (updated 2026-10-18)

**Google**
- Gemini API changelog: https://ai.google.dev/gemini-api/docs/changelog (accessed 2026-10-20)
- Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing (accessed 2026-10-20)
- Gemini Live guide: https://ai.google.dev/gemini-api/docs/live-guide (accessed 2026-10-20)
- Gemini Live session management: https://ai.google.dev/gemini-api/docs/live-session (accessed 2026-10-20)
- Gemini Live best practices (billing per turn): https://ai.google.dev/gemini-api/docs/live-api/best-practices (accessed 2026-10-20)
- Google blog, Gemini 3.8 Live: https://blog.google/innovation-and-ai/technology/developers-tools/build-real-time-voice-applications-gemini-audio/ (2026-09-15)
- Vertex / Gemini Enterprise, Live API voice and language config: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api/configure-language-voice (accessed 2026-10-20)
- Gemini voice replication: https://ai.google.dev/gemini-api/docs/voice-replication (accessed 2026-10-20)
- Vertex Gemini 2.5 Flash Live API (discontinuation date): https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-live-api (accessed 2026-10-20)
- Google Generative AI Prohibited Use Policy: https://policies.google.com/terms/generative-ai/use-policy (last modified 2024-12-17)

**Benchmarks**
- Artificial Analysis Speech-to-Speech leaderboard: https://artificialanalysis.ai/speech-to-speech (accessed 2026-10-20; includes Oct 2026 models)

**xAI**
- xAI Grok Voice Agent API announcement: https://x.ai/news/grok-voice-agent-api (2025-12-17)
- xAI Voice Agent docs: https://docs.x.ai/docs/guides/voice/agent (accessed 2026-10-20)
- eesel, Grok Voice 3.0 pricing: https://www.eesel.ai/blog/grok-voice-3-pricing (edited 2026-10-15)
- LiveKit community thread, Grok realtime custom voice clone rejected: https://community.livekit.io/t/grok-realtimemodel-not-accepting-custom-xai-voice-clone-only-default-voices-work/1117 (2026)

**ElevenLabs**
- ElevenLabs, Introducing Eleven Realtime: https://elevenlabs.io/blog/realtime (2026-10-20)
- The New Stack, ElevenLabs voice agent trade-offs: https://thenewstack.io/elevenlabs-voice-agent-tradeoffs/ (2026-10-20; body not retrievable, snippet only)
- ElevenLabs Prohibited Use Policy: https://elevenlabs.io/use-policy (updated 2026-10-09)

**Amazon**
- AWS Nova 2 Sonic user guide: https://docs.aws.amazon.com/nova/latest/nova2-userguide/using-conversational-speech.html (accessed 2026-10-20)
- AWS Nova 2 Sonic language and voice support: https://docs.aws.amazon.com/nova/latest/nova2-userguide/sonic-language-support.html (accessed 2026-10-20)

**Hume**
- Hume EVI overview (sunset notice): https://dev.hume.ai/docs/speech-to-speech-evi/overview (accessed 2026-10-20; notice dated 2026-10-02)
- Cartesia, Hume alternatives after sunset: https://www.cartesia.ai/learn/top-hume-ai-alternatives (2026-10)
- Hume pricing: https://www.hume.ai/pricing (accessed 2026-10-20)

**Alibaba Qwen**
- Alibaba Model Studio realtime (Qwen Omni realtime): https://www.alibabacloud.com/help/en/model-studio/realtime (updated 2026-10-16)
- Qwen3-Omni GitHub: https://github.com/QwenLM/Qwen3-Omni (release 2025-09-22)

**Ultravox**
- Ultravox GitHub: https://github.com/fixie-ai/ultravox (v0.7, 2025-12)
- Ultravox pricing: https://www.ultravox.ai/pricing (2026-10-09)

**Open models**
- Step-Audio 2 GitHub: https://github.com/stepfun-ai/Step-Audio2 (2025-07 to 2025-09)
- Kimi-Audio GitHub: https://github.com/MoonshotAI/Kimi-Audio (2025-04; possibly stale)
- MiniCPM-o GitHub: https://github.com/OpenBMB/MiniCPM-o (MiniCPM-o 4.5; API 2026-05-17)
- LLaMA-Omni 2 GitHub: https://github.com/ictnlp/LLaMA-Omni2 (2025-05; possibly stale)
- Freeze-Omni GitHub: https://github.com/VITA-MLLM/Freeze-Omni (2024-11; possibly stale)
- GLM-4-Voice GitHub: https://github.com/zai-org/GLM-4-Voice (late 2024; possibly stale)
- NVIDIA PersonaPlex GitHub: https://github.com/NVIDIA/personaplex (2026)

**Kyutai and Sesame**
- Moshi paper: https://arxiv.org/abs/2410.00037 (2024-09/10; possibly stale)
- Kyutai Unmute GitHub: https://github.com/kyutai-labs/unmute (2026)
- Kyutai delayed-streams-modeling (STT/TTS): https://github.com/kyutai-labs/delayed-streams-modeling (accessed 2026-10-20)
- Kyutai TTS 1.6B model card: https://huggingface.co/kyutai/tts-1.6b-en_fr (paper 2025-09-10)
- Sesame, Crossing the uncanny valley of voice (CSM): https://www.sesame.com/research/crossing_the_uncanny_valley_of_voice (2025-02-27; possibly stale)

**Full-duplex research**
- Full-Duplex-Bench GitHub (v1 to v3): https://github.com/DanielLin94144/Full-Duplex-Bench (v3 code 2026-05-20)
- Full-Duplex-Bench v1 paper: https://arxiv.org/html/2503.04721 (2025-03)
- Full-Duplex-Bench v2 paper: https://arxiv.org/abs/2510.07838 (2025-10)
- SyncLLM paper: https://arxiv.org/abs/2409.15594 (2024-09; possibly stale)

**Frameworks and guides**
- LiveKit Agents, realtime models and half-cascade: https://docs.livekit.io/agents/models/realtime/ (accessed 2026-10-20)
- Pipecat, Gemini Live service: https://docs.pipecat.ai/server/services/s2s/gemini-live (accessed 2026-10-20)
- Voice AI & Voice Agents primer: https://voiceaiandvoiceagents.com/ (updated 2026-06)

**Content policy**
- AI Haven, AI adult content policy tracker: https://aihaven.com/ai-adult-content-policy-tracker/ (updated 2026-07-05)
- OpenAI community thread on adult fiction for verified adults: https://community.openai.com/t/you-said-you-wanted-it-you-now-have-age-verification-you-now-have-a-usage-policy-that-allows-it-so-when-can-verified-adults-create-adult-fiction/1399668 (2026)

**Added during the 2026-10-20 fact-check**
- xAI models and pricing (Grok Voice 3.0 rate card): https://docs.x.ai/docs/models
- xAI release notes (voice version history): https://docs.x.ai/docs/release-notes
- ElevenLabs changelog (Eleven v4 / v4 Turbo, `turn_prediction`): https://elevenlabs.io/docs/changelog
- Qwen3-Omni GitHub (languages, voices, VRAM table): https://github.com/QwenLM/Qwen3-Omni

---

## Fact-check log (2026-10-20)

Skeptical re-check of the most load-bearing claims against primary sources. The web-search quota was exhausted at the start of the check, so every item was verified by fetching known primary URLs directly. Verdicts: **confirmed**, **corrected** (the note was edited) or **unverified** (the note is now marked).

| # | Claim | Verdict | Source |
|---|---|---|---|
| 1 | `gpt-realtime-2` released 2026-05-07; Realtime beta removed 2026-05-12; `gpt-realtime-2.1` / `-2.1-mini` released 2026-07-06 | Confirmed | https://developers.openai.com/api/docs/changelog |
| 2 | gpt-realtime-2.1 / 2 prices: audio $32 in / $0.40 cached / $64 out; text $4 / $24; 1.5 text out $16; mini $10 / $0.30 / $20 audio, $0.60 / $2.40 text | Confirmed | https://developers.openai.com/api/docs/pricing |
| 3 | gpt-realtime-2.1 has a 128k context, 32k max output, 2024-09-30 cutoff, Build tier 400 RPM / 200k TPM; Microsoft says 256k | Confirmed (the conflict is real; both pages re-read) | https://developers.openai.com/api/docs/models/gpt-realtime-2.1 ; https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/realtime-2 |
| 4 | `reasoning.effort` is minimal / low / medium / high, plus xhigh | Partly corrected: the four levels are confirmed (Foundry); xhigh is marked unverified | https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/realtime-2 |
| 5 | GPT-Live-1 GA 2026-09-10; $0.05/min billed per second; `v1/live/sessions`; concurrency 50 / 300 / 500 | Confirmed. Added the 2025-07-31 knowledge cutoff, and that the 15 s pre-bill is credited against duration | https://developers.openai.com/api/docs/models/gpt-live-1 ; https://www.datacamp.com/tutorial/gpt-live-1-api |
| 6 | GPT-Live has 21 voices and no Spanish voice; 500-token appends; 16,384-token instructions; engine swap past 90% of 128k with 8,192 tokens of history; no turn-complete event; exact text not guaranteed | Confirmed | https://developers.openai.com/api/docs/guides/live-conversations |
| 7 | GPT-Live custom voices support English accents only | Unverified (not found on the live, live-conversations or custom-voices pages) | https://developers.openai.com/api/docs/guides/custom-voices |
| 8 | OpenAI custom voices: sales-gated; 20 recording-based voices per org; 16 consent languages including Spanish; no fictional-character imitation; not ZDR-compatible; prompt-to-voice (100 per org) is GPT-Live only | Confirmed. Clarified that 20 is the recording-based cap; the newer sample guidance is 10–30 s | https://developers.openai.com/api/docs/guides/custom-voices |
| 9 | Realtime sessions max 60 min; voice fixed after first audio; 10 voices (marin / cedar recommended); WebSocket clients truncate manually, WebRTC / SIP truncate automatically | Confirmed. The "rough guide" transcription wording was not found and is marked unverified | https://developers.openai.com/api/docs/guides/realtime-conversations |
| 10 | `whisper-1` / `gpt-4o-*-transcribe` shut down 2027-02-26; `gpt-live-transcribe` and `gpt-realtime-whisper` cost $0.017/min | Confirmed. Added `gpt-transcribe` ($0.0045/min, 2026-07-28) | https://developers.openai.com/api/docs/changelog ; https://developers.openai.com/api/docs/pricing |
| 11 | `gemini-3.8-live` and `-extended-thinking` GA 2026-09-15; `gemini-3.5-transcribe-live` 2026-08-26; `gemini-3.1-flash-live-preview` 2026-03-26 | Confirmed. Added 3.8 Flash TTS / voice replication (2026-09-22) and 3.5 Live Translate | https://ai.google.dev/gemini-api/docs/changelog ; Google blog 2026-09-15 |
| 12 | Gemini Live pricing: audio $3 in / $12 out per 1M tokens ($0.005 / $0.018 per min); text $0.75 / $4.50; free-tier data used to improve products | Confirmed (one table shared by 3.8 Live, Extended Thinking and 3.1 Flash Live) | https://ai.google.dev/gemini-api/docs/pricing |
| 13 | Gemini session limits: 15 min audio-only, 2 min audio+video, about 10 min per connection, 2 h resumption tokens; native audio is AUDIO-only output | Confirmed | https://ai.google.dev/gemini-api/docs/live-session ; https://ai.google.dev/gemini-api/docs/live-guide |
| 14 | Gemini Live supports 97+ languages | Corrected / clarified: the blog says 97+, the Live guide lists 99 | https://ai.google.dev/gemini-api/docs/live-guide |
| 15 | Gemini 2.5 Flash native audio discontinued 2026-12-13 | Corrected / clarified: that is the Vertex / Agent Platform retirement of `gemini-live-2.5-flash-native-audio`; the Gemini API says 2.5 models are "not deprecated" (access-limited from 2026-09-18) | https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-live-api ; https://ai.google.dev/gemini-api/docs/changelog |
| 16 | Gemini Live has 30 prebuilt voices and 24 locales including es-US; custom voices for select customers only (10–20 s sample); self-serve replication only on 3.8 Flash and Flash-Lite TTS (200 per project) | Confirmed (es-ES is not listed) | https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api/configure-language-voice ; https://ai.google.dev/gemini-api/docs/voice-replication |
| 17 | Grok Voice 3.0 costs $0.08/min ($4.80/hr) plus $0.004 per text input; alias `grok-voice-latest` | Confirmed on xAI's own rate card | https://docs.x.ai/docs/models ; https://docs.x.ai/docs/guides/voice/agent |
| 18 | Grok Voice 3.0 released Oct 14, 2026 | Unverified day: xAI release notes give only "October" (2026); 2.0 was deprecated at the same price | https://docs.x.ai/docs/release-notes |
| 19 | xAI `force_message` for verbatim lines; cloned `voice_id` works in realtime `session.update`; reasoning `high` or `none`; 30-minute resumption | Confirmed. Added that no text-only output mode is documented | https://docs.x.ai/docs/guides/voice/agent |
| 20 | AA leaderboard numbers (Grok Voice 3.0 86.9 / 99% / 97.0% / 0.81 s; GPT-Live-1 83.2 and 80.1; Gemini 3.8 Live 76.0 / 1.18 s; Qwen Audio 3.0 Realtime Plus $0.03 / $0.18; Eleven Max 0.57 s; open models) | Confirmed. Added the missing rows (Grok Voice 2.0, GPT-Realtime-1.5, Gemini 3.1 Flash Live, Qwen3.5 Omni) | https://artificialanalysis.ai/speech-to-speech |
| 21 | Eleven Realtime v1 Mini / Max launched 2026-10-20: 0.57 / 0.62 s, BBA 98.8 / 75.9%, FDB 94.1 / 95.8%, tools 87.1 / 60.3%, 90+ languages, 17k voices, WebSocket only, price not published | Confirmed. The clone and price questions remain open | https://elevenlabs.io/blog/realtime |
| 22 | Eleven Realtime is cascaded internally (The New Stack) | Unverified (article body not retrievable; the vendor blog calls it a speech-to-speech model) | https://thenewstack.io/elevenlabs-voice-agent-tradeoffs/ |
| 23 | Hume EVI and TTS APIs end 2026-11-13 at 12:01 a.m. EST, announced 2026-10-02, data deleted afterwards | Confirmed (expression measurement is not shut down). The EVI pricing of $0.04–0.07/min is unverified, because the pricing page no longer shows EVI | https://dev.hume.ai/docs/speech-to-speech-evi/overview ; https://www.cartesia.ai/learn/top-hume-ai-alternatives |
| 24 | Nova 2 Sonic: 8-minute connection limit; EN / FR / IT / DE / ES / PT / HI; Spanish voices lupe and carlos; polyglot tiffany and matthew; no custom voices | Confirmed | https://docs.aws.amazon.com/nova/latest/nova2-userguide/using-conversational-speech.html ; https://docs.aws.amazon.com/nova/latest/nova2-userguide/sonic-language-support.html |
| 25 | Azure Voice Live supports gpt-realtime-2.1 (Pro) and 2.1-mini (Standard) with Azure TTS including custom voice (Limited Access) | Confirmed. Added `azure-realtime`, GPT-5.6 Terra / Luna and `mai-transcribe-2-streaming` | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live |
| 26 | Qwen3.8-Omni-Flash-Realtime: 120-min sessions, 196,608 input tokens, 100 turns / 600 s retained, 7 / 12.5 tokens per second, text-only output, 36 / 113 languages | Confirmed (120 min is the WebSocket limit) | https://www.alibabacloud.com/help/en/model-studio/realtime |
| 27 | Qwen3.8-Omni realtime is "full-duplex", and its AA scores and price are those of Qwen Audio 3.0 | Unverified: the docs describe turn-based VAD, and AA lists no Qwen 3.8 Omni row, so the mapping is unproven | https://www.alibabacloud.com/help/en/model-studio/realtime ; https://artificialanalysis.ai/speech-to-speech |
| 28 | HackerNoon: typical gpt-realtime-mini cost $0.05–0.08/min; recommended quote $0.15–0.20/min; raw math about $0.015/min | Corrected: typical is $0.070/min and the recommended default is $0.20/min. The $0.015 raw figure is not the article's and is marked unverified | https://hackernoon.com/openai-realtime-api-pricing-in-2026-real-world-data-from-4000-measured-sessions |
| 29 | Agents SDK voice guardrails: `debounceTextLength` default 100; `guardrail_tripped`; speech is slower than the transcript; truncated responses keep no final transcript | Confirmed | https://openai.github.io/openai-agents-js/guides/voice-agents/build/ |
| 30 | Ultravox: $0.05/min, 1 clone (pay-as-you-go) or 5 (Pro), 5 concurrent calls on pay-as-you-go; open model v0.7 (2025-12) on Llama 3.3 70B, MIT, text-out only | Confirmed. "TTS included" is unverified | https://www.ultravox.ai/pricing ; https://github.com/fixie-ai/ultravox |
| 31 | Full-Duplex-Bench v3 is arXiv 2604.04847 (Apr 2026), with code on 2026-05-20 | Confirmed (no v4) | https://github.com/DanielLin94144/Full-Duplex-Bench |
| 32 | PersonaPlex: Moshi-based, 18 fixed voices, English (Fisher), MIT code plus NVIDIA Open Model License; MiniCPM-o 4.5: 9B, EN / ZH, cloning, Apache-2.0 | Confirmed | https://github.com/NVIDIA/personaplex ; https://github.com/OpenBMB/MiniCPM-o |
| 33 | Qwen3-Omni: 19 in / 10 out languages including Spanish, 3 voices, 79–145 GB BF16 | Confirmed (the Instruct model; the README lists 18 input languages) | https://github.com/QwenLM/Qwen3-Omni |
| 34 | OpenAI ChatGPT adult mode paused indefinitely on 2026-03-26; ElevenLabs conversational-AI terms bar customer LLMs from sexual content | Confirmed as the tracker states them (a secondary source). "No API adult tier" is unverified | https://aihaven.com/ai-adult-content-policy-tracker/ |
