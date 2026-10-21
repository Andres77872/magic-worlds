# R04: Streaming text-to-speech for realtime agents (the October 2026 landscape) and expressive character voices

- **Research date:** 2026-10-20. All web sources were accessed on this date. Publication or update dates are given where the source states one.
- **Scope:** Streaming TTS for cascaded voice agents (STT → LLM → TTS), with a focus on expressive, cloned character voices in English and Spanish, and on provider content policy for 18+ fictional roleplay.
- **Method:** About 22 web searches (the shared search budget ran out partway through) and about 55 fetches of primary pages: vendor docs, API references, pricing pages, changelogs, GitHub and Hugging Face model cards, arXiv, and the Artificial Analysis (AA) and Vapi Humanness Index leaderboards. I also read the Magic Worlds backend call path (`/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/*`, `src/services/speech/providers/*`) so the recommendations match the code.
- **How to read the numbers:**
  - *Vendor-reported* means the figure comes from the vendor's own page.
  - *Independent* means AA or Vapi measured it.
  - Most vendor TTFB numbers are **server-side model latency and exclude the network**. Independent numbers include the network round trip.
  - Anything older than about 12 months is flagged **[possibly stale]**.
  - A few items come from memory and were not re-verified this session. They are flagged **[unverified]**.

---

## 0. TL;DR

1. **The market moved a lot in 2026.** The current leaders on AA's Provider-Voice TTS leaderboard (accessed 2026-10-20) are:
   - **Eleven v4 Turbo** (Elo 1333) and **Eleven v4** (1328), released around 2026-09-28.
   - Alibaba **Qwen-Audio-3.1-TTS-Plus** (1299).
   - **Cartesia Sonic 3.6** (1289).
   - **Google Gemini 3.8 Flash TTS** (1278).
   - **Inworld Realtime TTS-2** (1265).
   - **Fish Audio Drama 3 Preview** (1247), the top open-weights model. *(Fact-check 2026-10-20: Fish launched Drama 3 for real on 2026-10-13 in the app and API, with open weights. AA still labels the entry "Preview".)*
   - Speechify **Simba 3.2** (1245).

   The 2025 workhorses rank well below them: ElevenLabs Flash v2.5 is at 1077, Cartesia Sonic 3 at 1057, Hume Octave 2 at 1055, Rime Mist v2 at 904, and Kokoro at 1065.

   *Fact-check addition (2026-10-20):* AA's top 25 also includes entries this list skipped. They are Alibaba **Qwen-Audio-3.0-TTS-Plus** (1264), BreezeBlue **Breeze TTS 2** (1222, $34/1M), StepFun **StepAudio 2.5 TTS** (1216, $85/1M), VUI Labs **Luna TTS** (1211, $15/1M) and **Soniox TTS Real-Time v2** (1179, $14.2/1M).
2. **Sub-200 ms first audio over the network is now table stakes for realtime-grade models.**
   - Vapi's independent measurements (June 2026, network included, 50 trials) give Cartesia Sonic 3.5 a **128 ms** median, Fish S2.1-Pro **141 ms**, Sonic 3 166 ms, ElevenLabs Flash v2 226 ms, Inworld TTS-2 288 ms, MiniMax Speech 2.8 325 ms, Simba 3.2 428 ms, and Eleven v3 (non-conversational) 758 ms.
   - Vendor claims are 2–3x lower: Inworld says 100 ms P90 server-side, ElevenLabs says about 150 ms time-to-first-speech for v4 Turbo, and Fish says about 100 ms for S2-Pro on an H200. Fish's Drama 3 model card reports an 88.9 ms median TTFA for a single stream on one H200 (self-hosted, vendor-reported).
3. **Expressive "acting" models now stream.** Eleven v4 Turbo / v3 Conversational (audio tags, over the Text-to-Dialogue WebSocket), Fish S2.1-Pro and Drama 3 (free-form `[natural language]` cues), Inworld TTS-2 (`[steering instructions]`), Gemini 3.8 Flash TTS (style plus inline tags), MiniMax Speech 2.8 (`(laughs)` interjections) and Azure HD Omni (`[style]` tags) all expose emotion controls with streaming output. A companion product no longer has to choose between low latency and acting.
4. **Several vendors are deprecating or exiting:**
   - **Hume is sunsetting its TTS and EVI APIs.** Access ends **2026-11-13**, and account data is deleted after that date. Cloned or designed voices cannot be exported. *(That last point comes from Cartesia, a competitor. Hume's own notice does not mention exports.)*
   - **OpenAI deprecated `tts-1`, `tts-1-hd` and `gpt-4o-mini-tts`** (shutdown **2027-01-06**) in favour of the speech-to-speech `gpt-realtime-2.1-mini`.
   - **PlayHT** was acquired by Meta (July 2025), and play.ht no longer resolves.
   - **Rime Arcana** was retired from Rime's cloud API on 2026-08-15. Rime's own changelog confirms this, and requests to `arcana*` IDs are now served by Coda.
   - **Inworld TTS-1/1-Max** were discontinued 2026-06-15.
   - **Fish S1** retires 2026-12-31.
   - **Cartesia sonic-2 / sonic-turbo** sunset after 2026-10-20.
   - **ElevenLabs Turbo v2.5** is deprecated.

   Abstract the provider and keep the consented source audio for every cloned voice.
5. **Clone portability is a hidden cost.**
   - ElevenLabs says IVCs and PVCs made before v4 **must be retrained for v4**.
   - Cartesia PVCs are tied to a dated model snapshot. *(Softened in Sept 2026: new PVCs now train automatically on all eligible models.)*
   - Hume clones die with the API.

   For a character app with many custom voices, plan for re-provisioning voices on every model generation.
6. **Text input streaming with a context or continuation is the standard pattern.** Use one socket per call, one context per turn, flush at sentence or turn end, and close or cancel the context on barge-in. ElevenLabs (`multi-stream-input`, up to 5 contexts), Cartesia (`context_id` + `continue`), Fish (`/v1/tts/live`), MiniMax (`task_continue`) and Inworld all support it.
7. **First-chunk policy dominates perceived TTS latency.**
   - ElevenLabs' classic WebSocket waits for **120 characters** by default (`chunk_length_schedule` `[120,160,250,290]`).
   - The Text-to-Dialogue WebSocket waits about **40 characters and 8 words**.
   - Cartesia buffers up to **3000 ms** (`max_buffer_delay_ms`).
   - Fish defaults to `chunk_length` 300 and `min_chunk_length` 50.

   Send a clause-sized first chunk and flush it explicitly, or use `auto_mode`.
8. **Output format matters at the edge.** MP3 at 44.1 kHz and 128 kbps (the current Magic Worlds call format) costs more bytes and decode latency than PCM, Opus or mu-law. Every major vendor offers raw PCM, and Fish, MiniMax, Azure and Google offer Opus. For browser playback, PCM into an AudioWorklet ring buffer, or Opus via WebCodecs (not Baseline yet), are the low-latency options.
9. **Content policy is uneven, and so is the evidence for it.**
   - ElevenLabs' use policy (updated 2026-10-09) prohibits *visual* depictions of explicit sexual acts and certain erotic categories. It has no blanket ban on adult audio, but it prohibits creating "harmful emotional dependency."
   - Fish's terms (effective 2024-08-18, **[possibly stale]**) prohibit submissions that "contain sexually explicit content or pornography."
   - Inworld's AUP (2025-06-11) treats sexually explicit or suggestive content as inappropriate for minors and requires AI disclosure.
   - Cartesia's policy page could not be retrieved.

   This needs a legal read before any explicit-audio feature ships.

---

## 1. What "good" means for a realtime character-voice TTS

| Dimension | Why it matters for Magic Worlds | How to measure |
|---|---|---|
| **TTFA (time to first audio)**, end to end | Directly adds to voice-to-voice latency after the LLM's first sentence | Client-side: from first text sent to TTS until first PCM sample played. Report p50/p95 per provider, model, voice type and region |
| **Server TTFB** (vendor-reported) | Lower bound only. Excludes network, decode and jitter buffer | Vendor docs. Do not compare across vendors |
| **Naturalness / acting** | Companion retention depends on emotional delivery | AA Speech Arena Elo, Vapi Humanness Index, internal A/B with your own characters |
| **Text-input streaming + continuity** | LLM tokens arrive gradually. Per-sentence HTTP calls break prosody between sentences | Does the API keep context across chunks (contexts, continuations)? |
| **Cancellation granularity** | Barge-in must stop generation and billing fast | Is there a context `close`/`cancel` without dropping the socket? |
| **Word/char timestamps** | "Truncate to what was heard", captions, lip-sync | Alignment granularity and whether it is on the original or normalized text |
| **Cloning** (instant / pro) | Custom character voices are core | Seconds of audio needed, quality vs PVC, cross-lingual ability, re-training on model upgrades |
| **Spanish quality** | Second launch language | AA added 9 non-English language leaderboards, including Spanish, in Sept 2026 ([AA on X](https://x.com/ArtificialAnlys/status/2102490340678856997)) (unverified: the X post wasn't retrievable on 2026-10-20, and AA's TTS leaderboard pages showed no language filter). Test with es-MX and es-ES |
| **Price** | Calls are long. TTS is often the largest per-minute cost after the LLM | $/1M chars. ~800–1,000 chars ≈ 1 min of speech (Cartesia estimates 750–800 credits/min; Inworld assumes ~1,000 chars/min) |
| **Content policy** | 18+ fictional roleplay | AUP/terms, enforcement (classifier blocking?), account-level risk |

---

## 2. Independent benchmarks (October 2026)

### 2.1 Artificial Analysis: Provider Voice leaderboard (Speech Arena Elo; accessed 2026-10-20)

Source: [artificialanalysis.ai/text-to-speech/leaderboard](https://artificialanalysis.ai/text-to-speech/leaderboard). The page shows no explicit update date; the newest entries are dated Oct 2026. The method is blind pairwise human votes on naturalness, using each provider's native voices. Prices are AA's figures per 1M characters at default settings and may differ from list prices. ElevenLabs' own pricing page, for example, shows $40/1M for Flash where AA lists $50.

| Rank band | Model | Provider | Elo | AA $/1M chars |
|---|---|---|---|---|
| 1–2 | Eleven v4 Turbo | ElevenLabs | 1333 | 40 |
| 1–2 | Eleven v4 | ElevenLabs | 1328 | 80 |
| 3–4 | Qwen-Audio-3.1-TTS-Plus | Alibaba | 1299 | 19.3 |
| 3–5 | Sonic 3.6 | Cartesia | 1289 | 49 |
| 4–7 | Gemini 3.8 Flash TTS | Google | 1278 | 16.5 |
| 5–8 | Realtime TTS-2 | Inworld | 1265 | 20.8 |
| 8–10 | Gemini 3.8 Flash-Lite TTS | Google | 1250 | 11.0 |
| 3–7 | Qwen-Audio-3.0-TTS-Plus *(added in fact-check)* | Alibaba | 1264 | 19.3 |
| 8–10 | Fish Audio Drama 3 Preview | Fish Audio | 1247 | 15 (AA figure; Fish list price is $50/1M chars, see §3.3) |
| 8–10 | Simba 3.2 | Speechify | 1245 | 6.6 |
| 11 | Breeze TTS 2 *(added)* | BreezeBlue | 1222 | 34 |
| 11–17 | StepAudio 2.5 TTS *(added)* | StepFun | 1216 | 85 |
| 11–17 | Luna TTS *(added)* | VUI Labs | 1211 | 15 |
| 11–17 | Realtime TTS-2 Flash | Inworld | 1217 | 10.4 |
| 11–17 | Voxtral 3 TTS | Mistral | 1217 | 13 |
| 11–17 | v3 Conversational | ElevenLabs | 1212 | 50 |
| 11–17 | Gemini 3.1 Flash TTS | Google | 1212 | 18.3 |
| 18–21 | Sonic 3.5 | Cartesia | 1190 | 49 |
| 18–23 | Fish Audio S2.1 Pro (Oct 2026) | Fish Audio | 1188 | 15 |
| 18–23 | Ming-3.0-tts (open weights) | Ant Group | 1188 | n/a |
| 18–24 | Eleven v3 | ElevenLabs | 1182 | 100 |
| 22 | Soniox TTS Real-Time v2 *(added)* | Soniox | 1179 | 14.2 |
| 21–25 | Speech 2.8 HD | MiniMax | 1173 | 100 |
| 26–29 | Speech 2.8 Turbo | MiniMax | 1154 | 60 |
| 28–33 | Azure HD 2.5 | Microsoft | 1141 | 22 |
| 36–42 | Chatterbox HD | Resemble AI | 1109 | 40 |
| 43–53 | OpenAudio S1 | Fish Audio | 1085 | 15 |
| 48–56 | Flash v2.5 | ElevenLabs | 1077 | 50 |
| 48–57 | GPT-Realtime-2 (S2S, as TTS) | OpenAI | 1075 | 191.6 |
| 53–63 | Kokoro 82M v1.0 (open) | Kokoro | 1065 | 0.7 |
| 54–66 | Chirp 3: HD | Google | 1061 | 30 |
| 54–68 | Sonic 3 | Cartesia | 1057 | 49 |
| 54–69 | Coda | Rime | 1056 | 50 |
| 55–70 | Octave 2 | Hume AI | 1055 | 87.5 |
| 58–70 | Flux TTS | Deepgram | 1051 | 45 |
| 62–75 | Higgs Audio V3 TTS | Boson AI | 1043 | 15 |
| 74–79 | Chatterbox (open) | Resemble AI | 1024 | 25 |
| 83–86 | VibeVoice 1.5B | Microsoft | 956 | n/a |
| 86–89 | Qwen3 TTS | Alibaba | 930 | 13.8 |
| 89–94 | Mist V2 | Rime | 904 | 31.1 |

**Notes:**

- The top 5 are within about 50 Elo, and ranks shift monthly. In June 2026, Alibaba's **Fun-Realtime-TTS** briefly took #1 on the Speech Arena at Elo 1219 ($27.59/1M), ahead of Gemini 3.1 Flash TTS (1214), Inworld TTS-2 Research Preview (1209) and Sonic 3.5 (1203). AA noted the top five were within 24 Elo ([AA article, 2026-06-03](https://artificialanalysis.ai/articles/fun-realtime-tts-new-text-to-speech-model-topping-artificial-analysis-leaderboard)). *Fact-check:* the June article lists Sonic 3.5 at $39/1M (not $49). A Speechify press release dated 2026-07-07 says Simba 3.2 then ranked #1 on AA, so #1 also changed in July.
- AA also runs a **Controlled Voice** arena and a **Pronunciation Robustness** leaderboard. Fish Drama 3 Preview led Pronunciation Robustness ahead of Eleven v4, and Ant Group's Ming-3.0-tts was announced as the #1 open-weights model in Controlled Voice ([AA on X, Oct 2026](https://x.com/ArtificialAnlys/status/2112389514404462613); [AA on X re Drama 3](https://x.com/ArtificialAnlys/status/2110081938140582085)).
- AA's TTS overview page publishes **throughput** (chars/sec of generation) but **not TTFA**. Polly Standard is fastest at 1,583.6 chars/s ([AA TTS overview](https://artificialanalysis.ai/text-to-speech)). For realtime latency you need another source.
- Arena Elo measures **English naturalness with stock voices**. It does not measure cloned-voice similarity, Spanish quality, or behaviour under streamed input. Use it as a shortlist, not a decision.

### 2.2 Vapi Humanness Index: measured streaming latency

Source: [humannessindex.vapi.ai](https://humannessindex.vapi.ai/). Standings are as of 2026-10-20. Latency is the "median first audio across 50 sequential live streaming trials, June 2026, **includes network round-trip** from the benchmark machine". That wording is on the per-model pages; the home page only labels the column "Latency". The region is not stated. *Fact-check:* the index's `/api/models` feed lists 22 entries, and none of them is Eleven v4/v4 Turbo, Sonic 3.6, Fish Drama 3, Gemini or Qwen. Humanness comes from blind A/B votes against a human baseline (= 100).

| Model | Measured median first audio | Humanness | Price shown (per 1M chars) |
|---|---|---|---|
| Cartesia Sonic 3.5 | **128 ms** | 70 | $50 (Pro plan) |
| Fish Audio S2.1-Pro | **141 ms** | 84 | $15 |
| Cartesia Sonic 3 | 166 ms | 66 | $50 |
| ElevenLabs Flash v2 | 226 ms | 76 | $50 (Vapi's figure; ElevenLabs' own page says $40) |
| xAI Grok TTS (streaming) | 285 ms | 88 | $15 |
| Inworld TTS-2 | 288 ms | 70 | $25 (on-demand; corrected from "n/a". Vapi dates the research preview 2026-05-05) |
| ElevenLabs Turbo v2 | 302 ms | 77 | $50 |
| MiniMax Speech 2 Turbo | 315 ms | 70 | n/a |
| MiniMax Speech 2.8 | 325 ms | 93 | $60 |
| Inworld TTS-1.5-max | 337 ms | 79 | $35 |
| MiniMax Speech 2 HD | 357 ms | 89 | $100 |
| Speechify Simba 3.2 | 428 ms | 97 | $10 |
| xAI Grok TTS (non-streaming) | 460 ms | 94 | $15 |
| ElevenLabs Eleven v3 (non-conversational) | 758 ms | 97 | $100 |

Sources: [Vapi index home](https://humannessindex.vapi.ai/), [Sonic 3.5 page](https://humannessindex.vapi.ai/models/cartesia-sonic-3-5), [Sonic 3 page](https://humannessindex.vapi.ai/models/cartesia-sonic-3). Eleven v4 Turbo and Fish Drama 3 had no measured latency on the pages I could retrieve.

**Takeaways:**

- On these numbers, the most humanlike voices (v3, Simba, MiniMax HD) cost 300–750 ms of first-audio latency. The fastest (Sonic, Fish S2.1-Pro, Flash) score lower on humanness. Fish S2.1-Pro is the best balance in this table: 141 ms, humanness 84, $15/1M.
- **Vendor vs independent gap.** Inworld TTS-2 is vendor-reported at 100 ms P90 server-side ([Inworld docs](https://docs.inworld.ai/tts/tts-models)) against 288 ms measured. Cartesia claims "sub 90 ms" against 128 ms measured. ElevenLabs Flash is about 75 ms inference (vendor) against 226 ms measured (Flash v2). Budget for about **+100–200 ms** over vendor TTFB for network, TLS/WS framing and first-chunk buffering.

### 2.3 Vendor-published cross-vendor latency claims (vendor-reported, treat with care)

ElevenLabs' v4 page claims v4 Turbo has about **100 ms median inference** and about **150 ms median time to first speech** that "stays consistent in long interactions". It cites Cartesia Sonic 3.6 at **262 ms** and OpenAI gpt-4o-mini-tts at **814 ms** time to first speech, all measured by ElevenLabs ([elevenlabs.io/v4](https://elevenlabs.io/v4); launch about 2026-09-28 per [TechTimes, 2026-09-30](https://www.techtimes.com/articles/328298/20260930/elevenlabs-eleven-v4-shifts-voice-ai-reading-acting-turbo-hits-sub-150ms-latency.htm)). The Sonic 3.6 figure conflicts with Vapi's 128 ms for Sonic 3.5. Methodology and region drive these differences.

---

## 3. Commercial providers: details

### 3.1 ElevenLabs (incumbent in Magic Worlds)

**Models** ([models overview](https://elevenlabs.io/docs/overview/models); latency excludes network):

| model_id | Latency (vendor) | Languages | Audio tags | Streaming transport | Notes |
|---|---|---|---|---|---|
| `eleven_v4_turbo` | ~100 ms median inference; ~150 ms time to first speech | 90+ | Yes | **Text-to-Dialogue (TTD) WebSocket** | Realtime and agents. One registered voice per connection. PVC supported. $40/1M |
| `eleven_v4` | n/a | 90+ | Yes | TTD (HTTP + WS) | "Most emotive". Up to 10 voices. 10k chars per request. $80/1M |
| `eleven_v3_conversational` | ~280 ms | 70+ | Yes | TTD WS | Previous generation. GA around Aug 2026 ([ElevenLabs on X](https://x.com/ElevenLabs/status/2090136227617952145)). $40/1M |
| `eleven_v3` | n/a | 70+ | Yes | TTD | Previous generation. Vapi-measured 758 ms. $80/1M |
| `eleven_flash_v2_5` | ~75 ms | 32 | No | Classic TTS WS (`stream-input`, `multi-stream-input`) | Fastest classic model. Text normalization off by default (enterprise can enable). $40/1M |
| `eleven_turbo_v2_5` | n/a | 32 | No | Classic | **Deprecated**. Use Flash |
| `eleven_multilingual_v2` | higher | 29 | No | Classic | Long-form, stable, best number reading |

**Pricing** ([API pricing](https://elevenlabs.io/pricing/api), accessed 2026-10-20):

- Flash, Turbo, v4 Turbo and v3 Conversational cost **$0.04/1K chars ($40/1M)**.
- v2 Multilingual, v3 and v4 cost **$0.08/1K ($80/1M)**.
- The per-character rate is the same on all plans. Plans only change the included characters.

At about 900 chars/min, v4 Turbo works out to about **$0.036/min**.

**WebSocket families.** There are four, and the difference matters:

1. **Classic TTS WS:** `wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input`. It does **not** support `eleven_v3` or `eleven_v4` ([realtime TTS guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tts)). Query params and defaults ([API reference](https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input)):
   - `model_id`: default `eleven_multilingual_v2`.
   - `output_format`: default MP3.
   - `inactivity_timeout`: default **20 s**, max **180 s**.
   - `sync_alignment`: default false.
   - `auto_mode`: default false.
   - `apply_text_normalization`.
   - `seed`.
   - `enable_ssml_parsing`: needed for phoneme pronunciation dictionaries.
   - `enable_logging`: default true. Set it to false for zero-retention, enterprise only.

   `generation_config.chunk_length_schedule` defaults to **`[120, 160, 250, 290]`**, and each value must be between 50 and 500. The first audio is generated only after **120 characters** are buffered, unless you send `flush: true` or enable `auto_mode`. Keep-alive is a single space `" "`. An empty string `""` closes the socket.
2. **Classic multi-context WS:** `.../text-to-speech/{voice_id}/multi-stream-input`. **Up to 5 concurrent contexts per connection**, and every message carries a `context_id`. Best practice from ElevenLabs ([conversational agents best practices](https://elevenlabs.io/docs/best-practices/conversational-agents)):
   - Open **one WS per end-user session**.
   - Stream text in small chunks with `flush: true` at sentence ends.
   - On barge-in, send `{context_id: old, close_context: true}` and start a new context.
   - Keep a context alive with an empty-text message.
   - The inactivity timeout can be raised to 180 s.
3. **TTD WS:** `/v1/text-to-dialogue/stream-input`, for `eleven_v3*` and `eleven_v4*` only ([TTD realtime guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd)):
   - The server buffers until **about 40 characters and 8 words** before the first audio. This is a fixed threshold: there is no `chunk_length_schedule`, and the reference documents no `auto_mode`. `flush` forces generation.
   - Inactivity is **fixed at 20 s** per context. Reset it with `{keep_alive: true}`.
   - Responses use snake_case (`is_final`, `char_start_times_ms`).
   - **Concurrency differs from the classic WS.** Each open TTD connection *holds a dialogue session from a dedicated pool for its whole lifetime*. On the classic WS only active generation counts ([TTS vs TTD comparison](https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets)).
4. **TTD multi-context WS:** `/v1/text-to-dialogue/multi-stream-input`. Max **5 contexts**, `close_context`, `close_socket`, `keep_alive`, `flush`, `new_turn`, and `is_final_audio_for_turn` events. A protocol error (for example, messaging a closing context) **closes the whole connection** ([API reference](https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-multi-websocket)).
   - *Doc inconsistency:* this reference page still says `model_id` "must start with `eleven_v3`" (default `eleven_v3_conversational`), while the guides and the v4 page use `eleven_v4_turbo`. Magic Worlds already runs `eleven_v4_turbo` on it in production code. Watch for reference drift. *(Re-checked 2026-10-20: the inconsistency is still there. The TTD realtime guide and the TTS-vs-TTD page say "must start with `eleven_v3` or `eleven_v4`", while the multi-context API reference still says `eleven_v3` only. Pipecat now ships an `ElevenLabsDialogueTTSService` on this multi-context TTD endpoint with default model `eleven_v4_turbo`, which is independent evidence that v4 Turbo works there.)*
   - Regional servers: default, US, EU-residency, India and Singapore.

**`auto_mode`** (classic WS) "automatically handles generation triggers" and turns off the server chunk schedule. Pipecat enables it by default when it sends whole sentences ([Pipecat ElevenLabs](https://docs.pipecat.ai/server/services/tts/elevenlabs); [ElevenLabs latency guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization)).

**Latency guidance** ([latency optimization](https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization)):

- Flash over WebSocket has a TTFB of **100–150 ms** in North America, Europe and SE Asia, and **150–200 ms** in South and NE Asia.
- Routing is global by default, and the `x-region` header shows the serving region. `api.us.elevenlabs.io` pins to the US.
- **Voice type affects latency.** Default, synthetic and IVC voices are fastest. **PVC is slower** on Flash v2.5, and that optimization is still "in progress".
- Higher-quality output formats add latency.

**Alignment.** Classic WS returns `alignment` (original text) and `normalizedAlignment`, each with `chars`, `charStartTimesMs` and `charDurationsMs`, **relative to the chunk**. TTD returns `alignment` with snake_case keys, and `normalized_alignment` is reserved and unused. In Pipecat's experience, **audio tags like `[laughs]` appear in the alignment** and leak into transcript or LLM context unless filtered ([Pipecat](https://docs.pipecat.ai/server/services/tts/elevenlabs)).

**Normalization** ([normalization best practices](https://elevenlabs.io/docs/best-practices/prompting/normalization)):

- Flash v2.5 is weak at numbers. It reads "$1,000,000" as "one thousand thousand dollars".
- ElevenLabs recommends normalizing upstream, either by instructing the LLM or with regex plus `inflect` / `number-to-words`. Targets include phone numbers, currency, dates, times, URLs, units and "Dr." to "Doctor".

**Cloning:**

- IVC needs about 10 s of audio. ElevenLabs claims "v4 IVCs outperform Multilingual v2 PVCs".
- PVCs work again in v4. They were unavailable in v3.
- **Existing IVCs and PVCs must be retrained for v4.**
- Every clone requires verified consent ([elevenlabs.io/v4](https://elevenlabs.io/v4)).
- v4 disables SSML `<break>`. Use audio tags such as `[long pause]` instead.

**Policy** ([use policy, updated 2026-10-09](https://elevenlabs.io/use-policy)):

- It prohibits "visual depictions of explicit sexual acts", erotic material involving incest, bestiality or necrophilia, non-consensual intimate content, and anything sexualizing minors.
- Account holders must be 18+, and voice recordings of under-18s are forbidden.
- It prohibits "creating harmful emotional dependency or undue influence" and requires AI disclosure where law or materiality demands it.
- There are no companion-specific rules. An 18+ fictional-audio use is not categorically banned by the text, but the dependency clause is relevant to companion design.

### 3.2 Cartesia Sonic

**Models** ([latest model doc](https://docs.cartesia.ai/build-with-cartesia/tts-models/latest); [2026 changelog](https://docs.cartesia.ai/changelog/2026)):

| Model | Release | Notes |
|---|---|---|
| `sonic-3.6` (snapshot `sonic-3.6-2026-08-27`) | GA 2026-08-27 (beta 2026-08-17, unverified: the changelog gives no beta date) | 44 languages incl. `es`. Context-adaptive pacing and emotiveness without SSML. IVCs keep accent better and can speak multiple languages. New fields `locale` and `normalization` (an `accent` field is unverified: it isn't on the Sonic 3.6 model page). Self-hosted release 2026-09-17. Pronunciation dictionaries ignore case by default |
| `sonic-3.5` | GA May 2026 (release 2026-05-04 per Vapi) | Speed and volume controls. PVC support from June. Vapi-measured **128 ms** |
| `sonic-3` | Oct 2025 **[possibly stale]** | Vapi 166 ms. Dated snapshots |
| sonic-2, sonic-turbo, `sonic-3-2025-10-27` | Sunset after **2026-10-20** | |

**Changelog items that affect integrations:**

- PVC requests need a **dated model ID** (March 2026). From September 2026, new PVCs train automatically on all eligible models.
- Voice embeddings were removed from TTS endpoints, so a voice ID is now required. *Corrected:* this took effect **2026-06-01** (not Feb 2026). The same day, `sonic`, `sonic-english`, `sonic-multilingual` and some sonic-2/turbo snapshots were discontinued.
- Number, date, currency and phone pronunciation improved (Feb 2026).
- `cartesia-js` v3 added `flush_id` (Mar 2026).

**WebSocket** ([API reference](https://docs.cartesia.ai/api-reference/tts/websocket)):

- Endpoint: `wss://api.cartesia.ai/tts/websocket?cartesia_version=2026-08-14`. Browsers can use an `access_token` query param.
- Request fields:
  - `context_id` and `continue`.
  - `max_buffer_delay_ms`: 0–5000, default **3000**.
  - `flush`.
  - `add_timestamps` (word) and `add_phoneme_timestamps`.
  - `use_normalized_timestamps`.
  - `pronunciation_dict_id`.
  - `generation_config`: speed 0.6–1.5, volume 0.5–2.0, emotion from `neutral`, `calm`, `angry`, `content`, `sad`.
- Output is **raw only**: `pcm_f32le`, `pcm_s16le`, `pcm_mulaw` or `pcm_alaw`, at 8–48 kHz. There is no MP3 or Opus on the WS.
- Cancel with `{context_id, cancel: true}`.
- Responses: `chunk` (with `step_time`), `timestamps`, `phoneme_timestamps`, `flush_done`, `done`, `error`.

**Continuations** ([guide](https://docs.cartesia.ai/build-with-cartesia/capability-guides/stream-inputs-using-continuations)):

- Chunks in one context must concatenate into a valid transcript. Keep the leading spaces.
- **End sentences with punctuation**, or text waits in the buffer until `max_buffer_delay_ms` and the audio may end with odd sounds.
- Set the buffer to 0 only if you buffer client-side.

**Pricing** ([pricing](https://cartesia.ai/pricing)):

- 1 credit = 1 character.
- Effective cost by plan: Pro $5 for 100K (about $50/1M), Startup $49 for 1.25M ($39.2/1M), Scale $299 for 8M (about $37.4/1M).
- About 750–800 credits per minute of audio, so roughly **$0.03–0.04/min**.
- Concurrency: 2 (free), 3, 5 and 15 (Scale).
- IVC from Pro. PVC from Startup (2 slots).

Spanish is supported, with locale codes like `es-MX`. Emotion control on the WS is a 5-value enum plus contextual inference. That is coarser than the audio-tag models.

### 3.3 Fish Audio (incumbent in Magic Worlds)

**Models** ([intro](https://docs.fish.audio/developer-guide/getting-started/introduction); [models overview](https://docs.fish.audio/developer-guide/models-pricing/models-overview)):

| Model | Status | Languages | Expression control | Latency |
|---|---|---|---|---|
| `s2.1-pro` | Recommended production model. A free `s2.1-pro-free` variant exists with no TTFA guarantees | 83 | Free-form `[bracket]` natural-language cues (e.g. `[whispers sweetly]`). Multi-speaker | Vapi-measured **141 ms** |
| `drama-3` | *Corrected:* preview went to API users on 2026-09-23 as `drama-3-preview`. **Launched 2026-10-13** in the web app, the mobile apps and the API, with **open weights** the same day. 35B MoE with about 3B active per token (HF card; the HF metadata says 36B). Fish's launch post gives no stage label; AA still says "Preview". It is **not yet listed** in the docs models overview or the pricing page | 83 | Natural-language direction of tone, pacing and character, written in any language. Mid-sentence style shifts. Multi-character scenes. Editing and inpainting are invite-only, with an API "coming soon" | Self-hosted: 88.9 ms median TTFA at concurrency 1 on one H200 (HF card, vendor). API: not published |
| `s2-pro` | Previous generation. Open weights (Mar 2026) | 80+ | `[bracket]` cues | Vendor-reported ~100 ms TTFA, RTF 0.195 on H200 |
| `s1` (OpenAudio S1) | **Deprecated. Retires 2026-12-31** (routed to s2.1-pro) | 13 incl. Spanish | `(parenthesis)` tags, 64+ | RTF ~1:7 |

Drama 3 sources: [Fish on X (launch)](https://x.com/FishAudio/status/2102805658005635294), [Fish on X (#1 open weights)](https://x.com/FishAudio/status/2110749191853248829), [AA on X](https://x.com/ArtificialAnlys/status/2110081938140582085), and the [eesel review](https://www.eesel.ai/blog/fish-audio-drama-3-review). *Verified 2026-10-20* from the LICENSE file in the HF repo and Fish's launch post ([fish.audio/blog/fish-audio-drama-3](https://fish.audio/blog/fish-audio-drama-3)): the Drama 3 weights are under the **Fish Audio Community License v1.0 (FACL)**.

- Commercial use is free only while the licensee and its affiliates make **less than US$500,000** in trailing-12-month revenue. Above that, you must notify Fish within 30 days, and a 90-day transition period applies.
- **"Hosted Services"** (offering the model to third parties to generate speech from their own inputs, such as through an API or a cloning service) **always need a separate license, whatever the revenue.** A legal read is needed on whether a consumer app that voices user-driven characters counts.
- The HF repo tag still says `fish-audio-research-license`, which conflicts with the LICENSE file. S2 stays under the Research License.

**S2-Pro architecture** ([HF card](https://huggingface.co/fishaudio/s2-pro); [MarkTechPost, 2026-03-10](https://www.marktechpost.com/2026/03/10/fish-audio-releases-fish-audio-s2-a-new-generation-of-expressive-text-to-speech-tts-with-absurdly-controllable-emotion/)):

- Dual-AR: a 4B slow AR plus a 400M fast AR, over a 10-codebook RVQ codec at about 21 Hz.
- Served with SGLang (continuous batching, paged KV, RadixAttention prefix caching).
- The S2-Pro weights are under the **Fish Audio Research License**. Commercial use requires a separate license.

**Live WebSocket** ([protocol reference](https://docs.fish.audio/api-reference/endpoint/websocket/tts-live)):

- Endpoint: `wss://api.fish.audio/v1/tts/live`, with **msgpack** frames. Magic Worlds uses the `/with-timestamp` variant (`timestamp_ws.py:25`). *Fact-check:* neither the public protocol reference nor the streaming guide documents `/with-timestamp`, so treat it as undocumented or unstable surface.
- `model` header: `s1`, `s2-pro`, `s2.1-pro`, `s2.1-pro-free` or `drama-3`.
- Event flow: `start` → `text`* → `flush`? → `stop`. The server replies with `audio`* and then `finish`.
- `start.request` fields:
  - `format`: wav, pcm, mp3 or **opus**. Default mp3.
  - `sample_rate`: default 44.1k, or 48k for Opus.
  - `opus_bitrate`: 24–64 kbps or auto.
  - `latency`: `normal` (default, best quality), `balanced`, or **`low`** (lowest), per the protocol reference. *Doc conflict found in fact-check:* the [realtime streaming guide](https://docs.fish.audio/features/realtime-streaming) instead calls **`balanced` the default with the lowest TTFA**, recommends it "for voice agents and live LLM output", and does not mention `low`. The SDK and raw-WS defaults may differ. Measure rather than trust either page.
  - `chunk_length`: 100–300, default 300.
  - `min_chunk_length`: 0–100, default 50.
  - `normalize`: default true. Rewrites numbers, dates and units.
  - `language`: BCP-47. Affects only normalization and timestamps, not the voice.
  - `condition_on_previous_chunks`: default true. This is the prosody-continuity mechanism.
  - `prosody.speed`, `prosody.volume`, and sampling params.
- The guide says "keep the connection warm" and "don't batch tokens yourself; use `FlushEvent` for deliberate breaks" ([realtime streaming guide](https://docs.fish.audio/features/realtime-streaming)).

**Pricing** ([pricing and rate limits](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits)):

- **$15 per 1M UTF-8 bytes** for s2.1-pro, s2-pro and s1. `s2.1-pro-free` is $0, with no TTFA or DPA guarantees (Fish made it free in June–July 2026).
- **Drama 3 (corrected):** the pricing page still doesn't list `drama-3`, and AA lists $15/1M. But Fish's launch post sets the **list price at $50 per 1M characters**, with a launch offer of **$10/1M from 2026-10-13 to 2026-11-12**. From 2026-11-13, Drama 3 costs more than ElevenLabs v4 Turbo ($40/1M) and about 3.3x S2.1-Pro. **Magic Worlds uses `drama-3` for calls (`provider_capabilities.py:34`), so re-cost it before the promo ends.**
- **Billing is by UTF-8 bytes.** Spanish accented letters and `ñ`, `¿` and `¡` are 2 bytes, so Spanish costs a few percent more per character than English. Non-Latin scripts cost much more.
- Concurrency: 5 (under $100 prepaid), 15 ($100+), 50 ($1,000+). Voice Design costs $0.01 per request.
- For S2.1-Pro, that is roughly **$0.012–0.016/min**, about 2.5x cheaper than ElevenLabs v4 Turbo. Drama 3 at list price is about $0.045/min.

**Policy** ([terms](https://fish.audio/terms), effective 2024-08-18, **[possibly stale]**):

- User submissions must not "contain sexually explicit content or pornography".
- Content exploiting minors and impersonation are banned.
- The minimum age is 13, with guardian rules.
- Usage data and content may be used to train models.

The last two points are a privacy consideration for user roleplay text.

### 3.4 Inworld Realtime TTS-2

**Models** ([docs](https://docs.inworld.ai/tts/tts-models)):

- `inworld-tts-2`: 100 ms P90 TTFB server-side. Natural-language steering. Instant cloning and PVC (beta). Enhanced timestamps with phonemes and visemes. Zero data retention.
- `inworld-tts-2-flash`: 20 ms P90 server-side. No steering, but non-verbal tags still work.
- Both cover "200+ languages and locales".
- Launched 2026-09-02 ([Yahoo Finance press release](https://finance.yahoo.com/technology/ai/articles/inworld-launches-realtime-tts-2-160000791.html)). The release says "available now through Inworld's API" and does not use the word "GA". A research preview had existed since about 2026-05-05 (per Vapi). The launch release claims "<100 ms at the 99th percentile" under launch test conditions, and 25 ms TTFB for TTS-2 Flash in Coval benchmarking. The docs say P90 100 ms and 20 ms. Monthly plans step the price down from $25/1M to $20, $17.50, $15 and $12.50 (Growth).
- TTS-1, TTS-1-Max and 1.5 are deprecated. 1/1-Max were discontinued **2026-06-15**.

**Steering** ([steering docs](https://docs.inworld.ai/tts/capabilities/steering)):

- Steering instructions are `[say with a falling pitch] text`. They must be in English and persist until another tag or `[reset]`, including across a WebSocket context.
- Non-verbal tags: `[laugh]`, `[sigh]`, `[breathe]`, `[clear throat]` and more.
- Any bracket text that isn't a known sound is treated as an instruction. That matters if your LLM emits bracketed stage directions.

**Pricing** ([pricing](https://inworld.ai/pricing)):

- TTS-2 ranges from $25/1M on demand to $12.50 (Growth tier), and down to $5 on Enterprise.
- Flash ranges from $15 to $7, and below $5 on Enterprise.
- Concurrency: 5 on demand up to 500 on Growth.
- That works out to about **$0.0125–0.025/min**.

Vapi measured 288 ms. AA ranks TTS-2 at Elo 1265, which is strong.

**Policy** ([AUP, 2025-06-11](https://inworld.ai/aup/); [terms](https://inworld.ai/terms)):

- Users must be 18+.
- AI disclosure is required.
- The AUP lists sexually explicit or suggestive content as inappropriate for minors. Its wording on adult products is ambiguous, so **get a legal read**.
- Inworld markets "social and companions" use cases.

### 3.5 Rime

Rime's [models doc](https://docs.rime.ai/docs/models) covers two current models, both on HTTP and WebSockets:

- **Coda** (May 2026): sub-100 ms model latency on GPU self-hosted, plus 25–50 ms of cloud RTT. 10 cloud languages including Spanish. **Each voice speaks one language.** 313 voices. Word timestamps. Speed and `spell()` controls.
- **Mist v3** (Mar 2026): about **37 ms P50** TTFA in Rime's benchmark. English, French, German and Spanish.

**Arcana** is no longer in the docs. *Verified against Rime's own [changelog](https://docs.rime.ai/docs/changelog):*

- 2026-05-19: Coda launched as the "recommended successor to Arcana".
- 2026-07-29: Rime announced the switch.
- 2026-08-15: Arcana was retired from the cloud API. Requests to `arcana`/`arcanav2`/`arcanav3` are now served by Coda.
- On-prem Arcana images still run but get no updates after 2026-08-15.

([third-party review](https://www.theaidirectory.com.au/review-rime-australia-2026/)) Arcana v3 had about 120 ms on-prem latency and English–Spanish code-switching ([Rime blog](https://www.rime.ai/resources/arcana-v3); [Together AI](https://www.together.ai/blog/rime-arcana-v3-turbo-and-rime-arcana-v3-now-available-on-together-ai)).

The AA Elo is 1056 for Coda and 904 for Mist V2. Rime suits low-latency call-center voices more than expressive characters, and it has no documented cloning.

### 3.6 Hume Octave 2: **being shut down**

Octave 2 offered 11 languages, about 100 ms vendor latency, voice design from a text prompt (English only), cloning from 15 s, "continuation" for emotional consistency, and WS input streaming at `/v0/tts/stream/input` ([Hume TTS docs](https://dev.hume.ai/docs/text-to-speech-tts/overview.md)).

**Hume is sunsetting the TTS and EVI APIs. Access ends 2026-11-13 at 12:01 a.m. EST, and account data is then deleted.** The changelog notice is dated 2026-10-02 (verified) ([Hume changelog](https://dev.hume.ai/voice/changelog); [Cartesia's migration article](https://www.cartesia.ai/learn/top-hume-ai-alternatives)). Designed and cloned voices are not exportable. *That claim comes from Cartesia's article; Hume's own pages say nothing about exports and point to assist@hume.ai.* Hume should not be considered.

### 3.7 Deepgram Aura-2 (and "Flux TTS")

Aura-2 voices are named `aura-2-<voice>-<lang>`. Coverage is English (~40 voices), **Spanish (~17 voices: es-MX, es-CO, es-ES, es-419, es-AR)**, Dutch, French, German, Italian and Japanese. Some Spanish voices code-switch with English ([Deepgram TTS models](https://developers.deepgram.com/docs/tts-models)). The docs page gives no latency or cloning information. Aura-2 targets enterprise agents with a neutral, professional style and no custom cloning.

AA lists **"Flux TTS"** from Deepgram at Elo 1051 and $45/1M. *Verified on [deepgram.com/pricing](https://deepgram.com/pricing):* Flux TTS is a listed product at **$0.045/1K chars pay-as-you-go ($45/1M)** and $0.0405/1K on Growth. A promo matches spend $1 for $1 up to $500, through 2026-12-31. The TTS docs pages still don't describe Flux TTS.

The Aura-2 price is **$30/1M** pay-as-you-go and $27/1M on Growth. *Verified current list price; this was flagged [unverified] before.* Aura-1 is $15/1M. Deepgram is not a fit for expressive cloned characters.

### 3.8 OpenAI gpt-4o-mini-tts: **deprecated**

`gpt-4o-mini-tts` had prompt-steerable style (accent, emotion, whispering), 13 voices (`marin` and `cedar` recommended), and English-optimized voices with Whisper-language coverage. Output formats are MP3, Opus, AAC, FLAC, WAV and PCM. **For lowest latency, use WAV or PCM.** Custom voices are available with consent recordings ([TTS guide](https://developers.openai.com/api/docs/guides/text-to-speech)).

**Announced 2026-10-01:** `tts-1`, `tts-1-hd` and `gpt-4o-mini-tts` shut down **2027-01-06**. The replacement is `gpt-realtime-2.1-mini` via the Realtime API, which is *not* supported on `/v1/audio/speech` ([deprecations](https://developers.openai.com/api/docs/deprecations)). ElevenLabs measured gpt-4o-mini-tts at 814 ms TTFS (vendor-reported, competitor). OpenAI is effectively leaving cascaded TTS and pushing speech-to-speech instead.

*Fact-check context (same deprecations page):*

- **2026-07-20 announcement:** `gpt-realtime`, `gpt-4o-realtime`, `gpt-realtime-mini` and `gpt-4o-mini-realtime` move to `gpt-realtime-2.1` / `gpt-realtime-2.1-mini`, and the `gpt-audio*` models move to `gpt-audio-1.5`. Shutdown is 2027-01-20.
- **2026-08-26 announcement:** `whisper-1`, `gpt-4o-transcribe`, `gpt-4o-mini-transcribe` and `gpt-4o-transcribe-diarize` shut down 2027-02-26. The replacements are `gpt-live-transcribe` or `gpt-transcribe`. This matters for the STT and omni notes.

### 3.9 Google: Gemini TTS (3.8 Flash / Flash-Lite) and Cloud TTS Chirp 3 HD

**Gemini TTS** ([speech generation docs](https://ai.google.dev/gemini-api/docs/speech-generation); [pricing](https://ai.google.dev/gemini-api/docs/pricing)):

- Models: `gemini-3.8-flash-tts` (130+ languages), `gemini-3.8-flash-lite-tts` (100+ languages), plus previews `gemini-3.1-flash-tts-preview` and `gemini-2.5-pro-preview-tts`.
- Voices: 30 prebuilt, an Extended Voice Library, and **custom voices** via Voice design or replication (200 per project, 1-year TTL that resets on use).
- Style is set with `speech_metadata.style` and inline tags.
- **Streaming output** (`stream: true`) returns headerless PCM at 24 kHz. Mu-law, A-law and 8/16 kHz are also available.
- Up to 2 speakers per request.
- **Pricing** is per audio token, at 25 tokens per second:
  - 3.8 Flash TTS costs $9/1M output tokens until 2026-12-31 (**≈$0.0135/min**), then $18/1M (≈$0.027/min) from 2027-01-01. Input text is $0.50–1.00/1M tokens.
  - Flash-Lite costs about $0.009/min until 2026-12-31, then $0.018/min.
- **Latency is undocumented** (re-confirmed: the speech-generation page makes no latency statement). OpenRouter's reported P50 for 3.1 Flash TTS is 4.37 s (unverified: the OpenRouter page fetched on 2026-10-20 showed no latency stats), and one reviewer saw 10–19 s per clip ([OpenRouter](https://openrouter.ai/google/gemini-3.1-flash-tts-preview); [Voyager review](https://voyager.so/resources/models/gemini-3-1-flash-tts)).
- *Fact-check:* the pricing page also lists Batch prices (3.8 Flash TTS: $4.50/1M audio tokens through 2026-12-31). The 3.1 Flash TTS preview costs $20/1M audio tokens, and 2.5 Flash Preview TTS costs $10/1M. Stateless voice keys (`store=False`) have a 7-day TTL. Those are third-party figures for the *3.1 preview*. The docs give no text-input streaming over a socket for TTS, and the TTS docs point interactive bidirectional use to the **Live API**.
- Verdict: excellent quality per dollar (AA 1278 / 1250), **but not verified as realtime-grade for streamed LLM text**. It needs a latency test before it is considered.

**Chirp 3 HD** ([docs, updated 2026-10-13](https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd)):

- 30 voices, including es-ES and es-US.
- **Text-input streaming** via gRPC streaming synthesis. Streaming output formats: PCM, OGG_OPUS, MULAW and ALAW.
- Pace via `speaking_rate` (0.25–2.0). Pause markup (`[pause short]` and similar) via the `markup` field.
- Custom IPA or X-SAMPA pronunciations.
- SSML is not supported in streaming.
- Instant Custom Voice is a separate, gated product.
- AA Elo is 1061 at $30/1M. Chirp 3 HD is solid, but not expressive enough for character acting.

### 3.10 Microsoft Azure HD voices (DragonHD, HD Omni, HD Flash)

Source: [Azure HD voices](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/high-definition-voices), updated 2026-09-24.

- **Latency** is "less than 300 ms" for HD, and over 500 ms for Azure OpenAI HD voices.
- **DragonHD** has 30+ fine-tuned voices, including **es-ES Tristan and Ximena**. It supports `[style]` inline tags or `mstts:express-as`, with 50+ styles (whispering, sarcastic, shy, pleading…) and paralinguistics (laughter, sighing, breathing). **Styles work on English content only.**
- **DragonHD Omni** has 700+ voices, all multilingual, with natural-language style prompts (Ava and Andrew initially), paralinguistics in all languages, word-boundary events, and tunable `temperature`, `top_p`, `top_k` and `cfg_scale`.
- **HD Flash** covers zh-CN and en-US only.
- Output formats: Opus, MP3, PCM and truesilk at 8–48 kHz.
- AA Elo for "Azure HD 2.5" is 1141 at $22/1M.

Azure is an option for enterprise compliance. Custom Neural Voice and personal voice are gated, which makes it a poor fit for user-created character clones.

### 3.11 MiniMax Speech 2.8 (HD / Turbo)

**Models:** `speech-2.8-hd` and `speech-2.8-turbo`, 40 languages, 7 emotions plus "sound tags". Legacy models are 2.6 and 02 ([models intro](https://platform.minimax.io/docs/guides/models-intro)).

**WebSocket** `wss://api.minimax.io/ws/v1/t2a_v2` ([API reference](https://platform.minimax.io/docs/api-reference/speech-t2a-websocket)):

- Events: `task_start` → `task_continue`* → `task_finish`.
- Formats: mp3 (default), pcm, flac, wav, μ-law and **opus**, at 8–44.1 kHz.
- `voice_setting`:
  - `emotion`: happy, sad, angry, fearful, disgusted, surprised or calm. `whisper` is not available on 2.8.
  - `speed`, `vol` and `pitch`.
  - `timbre_weights` to mix up to 4 voices.
- **Interjections** on 2.8: `(laughs)`, `(sighs)`, `(gasps)`, `(breath)` and more. Pauses use `<#x#>`.
- `continuous_sound=true` gives better prosody on long text. The default (false) splits text for parallel inference and lower latency.
- Word-level streaming subtitles (`subtitle_type=word_streaming`).
- 10k chars per `task_continue`. The connection closes after 120 s of idle.

*Fact-check note:* platform.minimax.io could not be fetched on 2026-10-20, so the WebSocket details above were **not re-verified** this pass. AA confirms that Speech 2.8 HD and Turbo exist (released Feb 2026). AA prices are $100/1M for HD and $60/1M for Turbo. Vapi measured Speech 2.8 at 325 ms with humanness 93. MiniMax is very expressive but expensive, and 2–3x slower than Sonic or Fish.

Note: Magic Worlds' markup v1 already uses MiniMax-style `<#x#>` pauses and `(laughs)` cues. See `sentence_buffer.py` and the `text_pipeline.py` docstring.

### 3.12 Resemble AI (hosted Chatterbox HD)

Resemble's hosted service claims "sub 200 ms" latency (vendor-reported, from the [Chatterbox README](https://github.com/resemble-ai/chatterbox)). AA lists **Chatterbox HD** at Elo 1109 and $40/1M. Every output carries a Perth watermark. The open model is covered in §4.

### 3.13 PlayHT (Play AI)

Meta acquired Play AI around 2025-07-13, and the whole team joined Meta ([TechCrunch, 2025-07-13](https://techcrunch.com/2025/07/13/meta-acquires-voice-startup-play-ai/)). As of 2026-10-20, **`play.ht` does not resolve in DNS** (my fetch failed with ENOTFOUND). Treat PlayHT as **discontinued**.

### 3.14 Sesame CSM

CSM-1B was open-sourced on 2025-03-13 **[possibly stale]**. It is a Llama backbone plus a Mimi-code audio decoder, and it **conditions on conversation history (text and audio per speaker)**. It is English-focused, Apache-2.0, and its policy prohibits impersonation without consent ([GitHub](https://github.com/SesameAILabs/csm)). The repo documents no streaming server, and no public Sesame API appears there. Its value is as a research reference for *context-conditioned* conversational prosody, not as a production option.

### 3.15 Others worth tracking

- **Speechify Simba 3.2:** AA 1245 at $6.6/1M, Vapi humanness 97 at 428 ms. A cheap, humanlike option, but too slow for first-audio. *Corrected:* the 2026-07-07 press release says Simba 3.2 supports instant voice cloning from short clips (no quality figures given). It lists $10/1M on the entry tier and $6/1M on Scale ([PR](https://www.prweb.com/releases/speechifys-simba-3-2-ranks-1-on-independent-artificial-analysis-tts-leaderboard-worlds-best-real-time-voice-model-above-elevenlabs-openai-google-deepmind--others-302819731.html)).
- **xAI Grok TTS:** Vapi streaming 285 ms, humanness 88, $15.
- **Alibaba:** Qwen-Audio-3.1-TTS-Plus (AA 1299, $19.3) and Fun-Realtime-TTS (cloning, voice design, dialects; $27.59). Strong quality per dollar. Check data residency and content policy. *Fact-check:* the international Model Studio TTS page lists `qwen-audio-3.1-tts-flash`, `qwen-audio-3.0-tts-plus`, `qwen-audio-3.0-tts-flash` and `qwen3-tts-flash`, but **not** `qwen-audio-3.1-tts-plus`, so availability of the AA #3 model outside China is unconfirmed. Its examples are HTTP and SSE. Incremental text input is covered in a separate realtime guide that wasn't checked.
- **Newer AA entrants (added in fact-check):** BreezeBlue Breeze TTS 2 (1222), StepFun StepAudio 2.5 TTS (1216, $85), VUI Labs Luna TTS (1211, $15) and Soniox TTS Real-Time v2 (1179, $14.2). Soniox is mainly an STT vendor, so a single STT+TTS vendor is now an option. None of these was checked for streaming, cloning or Spanish.
- **Mistral Voxtral 3 TTS** (1217, $13), **Gradium** (Kyutai spin-off, 1175, $47.8), and **Smallest.ai Lightning V3.1 Pro** (1169).

### 3.16 Master comparison: realtime-relevant commercial options for character voices

| Provider / model | Elo (AA) | Measured TTFA (Vapi) | Vendor TTFB | Text-in streaming + context | Expressive control | Cloning | Spanish | Timestamps | ≈ $/1M chars | Status notes |
|---|---|---|---|---|---|---|---|---|---|---|
| ElevenLabs v4 Turbo | 1333 | n/a | ~100 ms inference / ~150 ms TTFS | TTD WS (+multi-context, 5 ctx) | Audio tags, 1 voice/conn | IVC (10 s), PVC. **Retrain for v4** | 90+ langs | char alignment | 40 | TTD sessions held for the socket's lifetime |
| ElevenLabs Flash v2.5 | 1077 | 226 ms (Flash v2) | ~75 ms | Classic WS, multi-context | None (no tags) | IVC fast, PVC slower | 32 langs | char alignment | 40 | Weak number normalization |
| Cartesia Sonic 3.6 | 1289 | 128 ms (3.5) | "sub-90 ms" | WS `context_id` + `continue` | Contextual, 5-emotion enum, speed, volume | IVC, PVC (dated snapshot) | 44 langs, locales | word + phoneme | 37–50 | PCM only on WS |
| Fish S2.1-Pro | 1188 | 141 ms | n/a | WS live (msgpack), conditions on previous chunks | Free-form `[cues]` | Zero-shot refs, voice models | 83 langs | `/with-timestamp` WS | 15 per 1M **bytes** | Terms ban explicit sexual submissions |
| Fish Drama 3 | 1247 | n/a | 88.9 ms self-hosted, H200 (HF card) | WS live (`drama-3`) | Natural-language direction, scenes | Same | 83 | likely | **50 list; 10 promo until 2026-11-12** (AA: 15) | Launched 2026-10-13 (AA still says "Preview"). Open weights under FACL v1.0 (< $500k revenue; hosted services need a license) |
| Inworld TTS-2 | 1265 | 288 ms | 100 ms P90 server (docs); "<100 ms P99" (launch PR) | WS contexts (implied) | English steering instructions + non-verbal tags | IVC 3–30 s, PVC beta | 200+ locales | phoneme/viseme | 12.5–25 | ZDR available |
| Inworld TTS-2 Flash | 1217 | n/a | 20 ms P90 server | yes | Non-verbal only | IVC | 200+ | basic | 7–15 | |
| MiniMax 2.8 Turbo | 1154 | 325 ms (2.8) | n/a | WS task_continue | 7 emotions, `(laughs)` | Yes | 40 | word streaming | 60 | |
| Gemini 3.8 Flash TTS | 1278 | n/a (3.1 preview: seconds) | n/a | Output streaming. Text-in streaming not documented for TTS | Style prompt + inline tags | Voice design/replication | 130+ | n/a | ≈16.5 (AA) | Latency unproven. Price doubles 2027-01-01 |
| Azure DragonHD | 1141 | n/a | <300 ms | SDK streaming | 50+ styles (English only), paralinguistics | Gated | es-ES voices | word boundary (Omni) | 22 | |
| Rime Coda | 1056 | n/a | <100 ms model + 25–50 ms RTT | WS | Speed only | n/a | yes (1 lang per voice) | word | 50 | Arcana retired |
| Deepgram Aura-2 | n/a | n/a | n/a | WS | None | No | 17 Spanish voices | n/a | 30 (27 Growth) | Flux TTS $45 |
| Hume Octave 2 | 1055 | n/a | ~100 ms | WS | Descriptions, design | 15 s | yes | partial | 87.5 | **Shuts down 2026-11-13** |
| OpenAI gpt-4o-mini-tts | n/a | n/a | n/a | HTTP chunked | Instructions | Custom voices (consent) | yes | no | n/a | **Shuts down 2027-01-06** |

---

## 4. Open-weight TTS (self-hosting options)

| Model | Size | Languages | Streaming | Expressiveness | Cloning | License (commercial?) | Notes |
|---|---|---|---|---|---|---|---|
| **Fish Drama 3** (2026-10-13) | 35B MoE / 3B active (HF metadata: 36B). An int4 variant (`drama-3-int4`, ~7B) is also on HF | 83 | SGLang-Omni and vLLM-Omni serving. 88.9 ms median TTFA at c=1 on H200 (vendor) | Natural-language direction | Yes | **FACL v1.0, verified:** commercial use free only below US$500k trailing revenue. **Hosted or API services always need a license** | #1 open weights on AA (1247) |
| **Fish S2-Pro** (Mar 2026) | ~5B (4B + 0.4B dual-AR) | 80+ | SGLang streaming. ~100 ms TTFA on H200 (vendor) | `[free-form tags]` | Yes | **Research license.** Commercial needs a deal | [HF](https://huggingface.co/fishaudio/s2-pro) |
| **Ming-3.0-tts** (Ant Group) | n/a | n/a | n/a | n/a | n/a | n/a | AA Elo 1188. #1 open weights on Controlled Voice (Oct 2026) |
| **Kyutai TTS 1.6B en_fr** | 1.6B | EN, FR | **True text-streaming** (starts after the first few words). Delayed Streams Modeling | Limited | **Restricted** to pre-computed voice embeddings | CC-BY 4.0 | Rust WS server (`moshi-server`). 75x realtime throughput per compute unit ([HF](https://huggingface.co/kyutai/tts-1.6b-en_fr); [DSM paper, 2025-09](https://arxiv.org/abs/2509.08753)) **[possibly stale]** |
| **Chatterbox** (Resemble) | Turbo 350M (EN), Nano 110M (EN, 3x realtime on 8 CPU cores), Multilingual V3 500M (23+ langs), Single-language packs incl. **Latam and Spain Spanish** | as listed | Turbo built for agents | `exaggeration`, `cfg_weight`. Turbo/Nano tags `[laugh]`, `[chuckle]` | ~10 s reference | **MIT** | Perth watermark on all outputs ([GitHub](https://github.com/resemble-ai/chatterbox)) |
| **Orpheus 3B** (Canopy) | 3B (Llama) | EN (+ multilingual research previews, Apr 2025) | ~200 ms, ~100 ms with input streaming (vendor) | `<laugh>`, `<sigh>`, `<groan>`… | Zero-shot | Apache-2.0 | vLLM. **[possibly stale]**: no updates since mid-2025 ([GitHub](https://github.com/canopyai/Orpheus-TTS)) |
| **Kokoro 82M v1.0** | 82M | 8 langs, 54 voices | Fast. ~$0.65–0.80/1M via APIs | None | **No** | Apache-2.0 | AA Elo 1065, beats Flash v2.5's 1077 tier on price. Good for a non-clone fallback ([HF](https://huggingface.co/hexgrad/Kokoro-82M)) **[possibly stale; Jan 2025]** |
| **Dia 1.6B / Dia2 (1B, 2B)** | 1.6B / 1–2B | **English only** | Dia2 can start from the first words. Streaming server "upcoming" | 21 nonverbal tags | Audio-prefix conditioning | Apache-2.0 code | Dialogue-oriented ([dia](https://github.com/nari-labs/dia), [dia2](https://github.com/nari-labs/dia2)) |
| **IndexTTS-2 / 2.5** (bilibili) | n/a | 2.5: zh, en, ja, **es**, ar | Not documented. RTF 0.21 on RTX 4090 (2.5) | Emotion via reference audio, 8-dim vector or text. Timbre/emotion disentangled. Duration control | Yes | bilibili model license. Commercial on request | 2.5 released 2026-08-10 ([GitHub](https://github.com/index-tts/index-tts)) |
| **Higgs Audio v3 (4B)** (Boson) | ~4B | 100+ | API streaming | Inline emotion/style/prosody | Zero-shot | **Non-commercial.** Commercial license needed | AA 1043 ([GitHub](https://github.com/boson-ai/higgs-audio)) |
| **VibeVoice-Realtime-0.5B** (Microsoft) | 0.5B | EN + 9 experimental incl. ES | ~300 ms first audible (vendor) | Limited | n/a | MIT, "research only" | Open-sourced 2025-12-03. **TTS-1.5B code removed 2025-09-05** over misuse. In 2026 the repo shifted to ASR (ASR-7B, ASR-BitNet, ASR-Streaming 2026-09-03) ([GitHub](https://github.com/microsoft/VibeVoice)) |
| **Sesame CSM-1B** | 1B | EN | Not documented | Context-conditioned prosody | Via context audio | Apache-2.0 | Research reference **[possibly stale]** |
| **F5-TTS** | ~0.3B | EN/ZH (+ community finetunes) | Not streaming-native | Limited | Zero-shot | Weights CC-BY-NC **[unverified, memory]** | Flow matching. Mostly superseded for realtime |

**Assessment.**

- For Magic Worlds, the only open-weight options that are both commercially usable and good at Spanish cloning are **Chatterbox Multilingual V3 / Latam-Spain packs (MIT)** and **Fish Drama 3** (community license, revenue-gated). Kokoro is a cheap emergency fallback with stock voices only. *Fact-check caveat:* FACL's "Hosted Services" clause may cover a consumer app that synthesizes speech from user-driven inputs, which would need a paid license at any revenue. Get a legal read before self-hosting Drama 3.
- Self-hosting moves the content-policy risk into Magic Worlds' own hands, which may suit an 18+ product. It costs GPU operations and makes per-call cost at low utilization worse than $15/1M APIs.
- Watermarking (Chatterbox Perth) and Kyutai's restriction to voice embeddings are deliberate anti-misuse choices. Expect more of them.

---

## 5. Techniques and best practices

### 5.1 Latency anatomy of the TTS leg

```
LLM token stream ─► [text aggregator] ─► WS send ─► provider buffer (threshold) ─► model TTFB ─► audio frames
   ─► backend relay (base64/JSON) ─► client WS ─► decode (MP3/Opus/PCM) ─► jitter buffer ─► AudioWorklet ─► speaker
```

The provider buffer threshold and the client-side buffering are usually larger than model TTFB:

- ElevenLabs classic WS waits for 120 chars by default.
- ElevenLabs TTD waits for about 40 chars and 8 words.
- Cartesia waits up to 3,000 ms if a sentence lacks closing punctuation.
- Fish's default `chunk_length` is 300 with `min_chunk_length` 50.

At about 15 characters/s of speech, 120 characters is about 8 s of audio. Waiting for that much text before speaking is a self-inflicted delay whenever the LLM is slower than the threshold.

### 5.2 Text chunking strategy: established best practice

1. **Small first chunk, then sentences.** Emit the first segment of each turn at the first *clause* boundary (`,` `;` `:` `—` `…`) once it has about 4–8 words or 25–40 characters, and **flush it explicitly**. After that, emit whole sentences, or sentence pairs once audio is well ahead. The ElevenLabs default schedule `[120,160,250,290]` has the same shape: small first, then growing. Vendors show it at character granularity, but explicit flushes let you drive it from the application.
2. **Flush at sentence end and at turn end.** ElevenLabs recommends `flush: true` at complete sentences and at the end of each conversational turn ([realtime TTS guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tts); [conversational best practices](https://elevenlabs.io/docs/best-practices/conversational-agents)). Fish uses `FlushEvent`. Cartesia uses `flush` and closing punctuation.
3. **Either the application aggregates or the provider buffers, not both.** Pipecat defaults to sentence aggregation with ElevenLabs `auto_mode` *on* (server buffering off). In token mode, `auto_mode` is off and the server schedule does the work ([Pipecat](https://docs.pipecat.ai/server/services/tts/elevenlabs)). Cartesia says to set `max_buffer_delay_ms=0` only if you buffer client-side ([continuations](https://docs.cartesia.ai/build-with-cartesia/capability-guides/stream-inputs-using-continuations)). Fish says "don't batch tokens yourself" ([Fish streaming](https://docs.fish.audio/features/realtime-streaming)). Double buffering (an application sentence buffer *and* a provider threshold) adds the two delays together.
4. **Boundary detection must handle the language and the markup:**
   - Spanish opening marks `¿` and `¡`, and abbreviations such as `Sr.`, `Sra.`, `Srta.`, `Dr.`, `Dra.`, `Ud.`, `Uds.`, `pág.`, `etc.`.
   - Decimals in both `3.5` and `3,5`.
   - Ellipses as `...` and `…` (U+2026).
   - Unclosed markup such as `(laughs`, `<#0.5#`, `[whispers`.
   - Quotes and closing brackets after punctuation.
5. **Keep chunks transcript-valid:** preserve leading spaces and don't split words, numbers or tags across sends (Cartesia continuation rules).
6. **Research direction:** models trained on *interleaved* text and speech (Apple's SpeakStream, [arXiv 2505.19206, 2025-05](https://arxiv.org/abs/2505.19206); Kyutai DSM, [arXiv 2509.08753, 2025-09](https://arxiv.org/abs/2509.08753); Dia2) start speaking after a few words with no sentence buffering. Fish's `condition_on_previous_chunks` and the low-threshold TTD buffering are commercial approximations. Expect "word-level text-in" to become the norm.

### 5.3 Prosody continuity across chunks

| Provider | Mechanism |
|---|---|
| ElevenLabs | One **context** per turn (`context_id`). Text accumulates in the context and prosody carries across flushes. TTD `new_turn` starts a new speaker turn |
| Cartesia | `context_id` + `continue: true`. `max_buffer_delay_ms` buffering |
| Fish | Session-level `condition_on_previous_chunks=true` (default) |
| MiniMax | `continuous_sound=true` (better prosody, slower) |
| Hume | "Continuation" (discontinued) |
| HTTP-only APIs | Pass `previous_text` / `next_text` or request stitching where supported [ElevenLabs HTTP; not re-verified this session]. Otherwise each sentence is synthesized cold, which causes audible pitch and energy resets |

Anti-pattern: a new HTTP request or socket per sentence. Magic Worlds' own `sentence_buffer.py` docstring records this bug from the earlier implementation ("a fresh provider socket per token fragment… broke prosody").

### 5.4 Barge-in and cancellation

- Use a **context-level cancel** so the socket stays warm: ElevenLabs `close_context`, Cartesia `cancel: true`. Fish's live protocol has no per-context cancel. You `stop` or drop the session and open a new one, so **prewarm the next session**.
- **Truncate to what was heard** using alignment or timestamps (ElevenLabs char alignment, Cartesia word timestamps, Fish `/with-timestamp`, Inworld phonemes and visemes, MiniMax word subtitles, Azure word boundary) together with client playback position reports.
- **Bound the generated-ahead audio** so a barge-in wastes little (and bills little). Magic Worlds' flush-ahead gate already does this: no more than 3 unheard sentences and less than 8 s ahead.
- Strip audio tags from alignment-derived transcripts before they go back into the LLM history (Pipecat warning).

### 5.5 Text normalization

- Vendor normalization quality varies by model. ElevenLabs Flash is poor at numbers. Cartesia improved number, date and currency reading in Feb 2026 and added a `normalization` field. Fish has `normalize` (default true, language-aware via `language`). MiniMax `text_normalization_mode` only applies `quality` on HTTP. Azure has `enhancePronunciation`.
- Best practice: **normalize upstream**, deterministically and per locale. Expand numbers, currency, dates, times, phone numbers, units and abbreviations. Then disable or keep vendor normalization deliberately, because some vendors add latency for it. MiniMax says normalization adds "slightly higher latency". Also instruct the LLM to write "spoken-form" text ([ElevenLabs normalization guide](https://elevenlabs.io/docs/best-practices/prompting/normalization)).
- Locale matters. "01/02" means different dates in en-US and es, and Spanish numbers have gender agreement ("una persona", "veintiún años").

### 5.6 Roleplay markup: emotes, stage directions and audio tags

Roleplay LLMs emit `*smiles*`, `(laughs)`, `[OOC]` and markdown. There are three strategies:

1. **Drop.** Remove action text entirely. This is safe, but you lose the emotion.
2. **Translate.** Map a whitelist of emotes to the provider's tag dialect, and drop the rest.
3. **Direct.** Let the LLM emit provider-native direction, constrained by a schema.

Translation needs a per-provider dialect table:

| Provider | Inline syntax |
|---|---|
| ElevenLabs v3/v4 | `[laughs]`, `[whispers]`, `[long pause]`, `[door slams]`. No SSML `<break>` in v4 |
| Fish S2.x / Drama 3 | `[free-form natural language]`, e.g. `[whispers sweetly]`. Drama 3 adds natural-language direction |
| Inworld TTS-2 | `[instruction]` (English) persists until `[reset]`. Sound tags `[laugh]`, `[sigh]` |
| MiniMax 2.8 | `(laughs)`, `(sighs)`, `(gasps)`… and `<#0.5#>` pauses |
| Azure HD | `[excited]` style tags (English content), paralinguistics |
| Google Chirp 3 HD | `[pause short]` / `[pause long]` (markup field only) |
| Gemini TTS | `speech_metadata.style` + inline tags |
| Chatterbox Turbo | `[laugh]`, `[chuckle]`, `[cough]` |
| Orpheus | `<laugh>`, `<sigh>`, `<groan>` |
| Dia | `(laughs)`, `(sighs)`… (21 tags) |

**Pitfalls:**

- Unknown bracket text is *spoken*, or on Inworld it is treated as an instruction.
- Tags count toward billed characters.
- Tags appear in alignment output.
- Tag text must not be split across chunks.
- Fish and Inworld cues are free-form, so an LLM can inject arbitrary direction. Constrain it with an allow-list.

### 5.7 Output formats and transport

- **PCM (s16le) at 16–24 kHz** has zero decode delay and the simplest client path (AudioWorklet ring buffer). It costs 256–384 kbps raw, and **+33% when base64-in-JSON** (ElevenLabs, Cartesia and MiniMax all base64 or hex their audio). Fine for a desktop or LTE web client.
- **Opus** (RFC 6716, frames of 2.5–60 ms, 6–510 kbps; libopus 1.6.1 released 2026-01-14) gives the best quality per bit for streaming ([opus-codec.org](https://opus-codec.org/)). Fish, MiniMax, Google, Azure and OpenAI offer it. It needs a decoder in the browser: WebCodecs `AudioDecoder` is "Limited availability", not Baseline, and requires a secure context ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioDecoder)). Otherwise use a WASM Opus decoder. Raw Opus packets also need framing, or an Ogg container.
- **MP3** is universally decodable. But each frame carries 1,152 samples (about 26 ms at 44.1 kHz) plus encoder and decoder delay and bit reservoir, and progressive decode needs frame-boundary handling. 128 kbps at 44.1 kHz is overkill for speech. If MP3 stays, 22.05 kHz at 32–64 kbps is enough for voice and halves to quarters the bytes. OpenAI's own guidance is "for fastest response times, use wav or pcm" ([OpenAI TTS guide](https://developers.openai.com/api/docs/guides/text-to-speech)), and ElevenLabs notes higher-quality formats increase latency ([latency guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization)).
- Match the provider's native sample rate (often 24 kHz) to avoid resampling. Pipecat warns that an unsupported rate falls back to 24 kHz and plays at the wrong speed.

### 5.8 Connection prewarming and keep-alive

| Provider | Idle timeout | Keep-alive |
|---|---|---|
| ElevenLabs classic WS | 20 s default, up to 180 s (`inactivity_timeout`) | `" "` (classic) / empty text per context (multi) |
| ElevenLabs TTD | **fixed 20 s** per context | `{keep_alive: true}` |
| MiniMax | 120 s after the last result | Next event |
| Fish live | Not stated. Session ends after `stop` | "Keep the connection warm" |
| Cartesia | Not stated on the WS reference | Reuse the socket across contexts |

**Best practice:**

- Open the TTS socket **when the call starts, or while STT is finalizing**, not after the LLM's first token. Doing so overlaps the TLS and WS handshake (often 100–300 ms) with STT and the LLM. Magic Worlds' Fish path already opens the stream early so "the handshake overlaps the model's first [token]" (`fish_audio/streaming.py`).
- Pin the region nearest to the backend: ElevenLabs `api.us.elevenlabs.io` or EU residency, Cartesia's nearest endpoint. Read ElevenLabs' `x-region` header to confirm routing.
- Be aware of **concurrency accounting.** An open ElevenLabs TTD socket holds a dialogue-pool session for its whole lifetime. An idle classic WS doesn't count.

### 5.9 Caching common phrases

- Cache **deterministic, high-frequency utterances per (voice, model, settings, normalized text hash)**: call greetings, "Mm-hm" and "Ajá" backchannels, short fillers ("Let me think…" / "Déjame pensar…"), error and hold lines, and quota or time-limit warnings. Play them instantly at turn start while the real reply streams in. Seeded generation (ElevenLabs `seed`) makes cache entries reproducible.
- Cache invalidation is needed on voice retraining, model upgrade, or a voice-settings change. Magic Worlds already hashes normalized text (`normalized_text_sha256` in `text_pipeline.py`), which is a natural cache key.
- Caveat: a canned filler in the wrong emotional register breaks immersion. Keep a small per-character set and use it sparingly.

### 5.10 Pronunciation dictionaries

- **ElevenLabs:** pronunciation dictionary locators must be set at connection or context init. Phoneme rules need `enable_ssml_parsing` on the classic WS. v4 adds IPA support. Pipecat deprecated ElevenLabs dictionaries in favour of client-side `text_transforms`, because dictionaries break word-completion tracking.
- **Cartesia:** `pronunciation_dict_id`, case-insensitive by default from Sept 2026, with access control.
- **Others:** Azure `<lexicon>` (alias only on HD) and `<phoneme>` (DragonHD). Chirp 3 HD custom IPA or X-SAMPA. MiniMax `pronunciation_dict.tone`. LiveKit `text_transforms.replace()` buffers across token boundaries ([LiveKit text docs](https://docs.livekit.io/agents/build/text/)).
- For fantasy names (character, place and spell names from lorebooks), a **lorebook-driven replacement map** (`Aelyth` → `AY-lith`) applied before TTS is provider-agnostic and keeps alignment consistent.

### 5.11 Character voice cloning: lifecycle and risk

- **Instant clones are now good enough for most characters.** ElevenLabs IVC needs about 10 s, Inworld 3–30 s, Hume 15 s (sunset), Fish uses reference audio, Chatterbox about 10 s. Cross-lingual IVC (an English sample speaking Spanish) is advertised by Cartesia 3.6 and ElevenLabs v4. Test the accent carry-over: Chatterbox warns that a mismatched reference language causes accent transfer.
- **PVC** gives the best fidelity but is slower on some realtime models (ElevenLabs Flash) and is tied to model snapshots (Cartesia).
- **Re-provisioning** is needed on model generations (ElevenLabs v4), and vendors exit (Hume, PlayHT). **Store the consented source audio and the transcript for every voice**, so you can re-clone on any provider.
- **Consent.** Every major vendor requires consent for real-person voices, and ElevenLabs requires *verified* consent for clones. A user-uploaded "character voice" is a real person's voice, so keep consent attestations.

### 5.12 Metrics to instrument

Track per call and per turn:

- LLM TTFT
- First text chunk sent
- TTS first byte
- First audio played (client-reported)
- Inter-chunk gaps and underruns
- Characters billed vs characters heard
- Barge-in waste
- Provider errors and timeouts by region, model and voice type (IVC vs PVC)

Report p50 and p95, not means.

---

## 6. Classification

### (a) Established best practice

- Bidirectional streaming TTS over a persistent WebSocket, **one socket per call and one context per turn**, with explicit flushes. Reuse the socket across turns, cancel per context on barge-in.
- A small first chunk with an explicit flush, then sentence-sized chunks. Never per-token sockets or per-sentence cold HTTP calls.
- Normalize text upstream per locale. Strip markdown and emoji. Allow-list the markup.
- Word or character timestamps for truncation and captions. Strip tags from the history.
- Raw PCM or Opus to the client. Native sample rate. No resampling.
- Prewarm connections. Pin regions. Keep-alive below the idle timeout.
- Measure end-to-end TTFA at p95 on the client.

### (b) Current SOTA and leading options (Oct 2026)

- **Quality and acting with realtime latency:** Eleven v4 Turbo (vendor ~150 ms TTFS, Elo 1333, $40/1M) and Cartesia Sonic 3.6 (Elo 1289, measured ~128 ms for 3.5).
- **Price and performance with expressive tags:** Fish S2.1-Pro (measured 141 ms, $15/1M bytes) and Inworld TTS-2 (Elo 1265, $12.5–25/1M, steering).
- **Most directable:** Fish Drama 3 (launched 2026-10-13, open weights, **$50/1M list** after the $10 promo ends 2026-11-12) and Inworld TTS-2 steering.
- **Cheapest quality:** Gemini 3.8 Flash / Flash-Lite TTS (~$0.009–0.0135/min through 2026). Realtime latency is unverified.
- **Open weights:** Fish Drama 3, Ming-3.0-tts, Chatterbox (MIT), Kokoro (fallback).

### (c) Emerging and experimental

- Natural-language "direction" instead of fixed tags (Drama 3, Inworld steering, Azure HD Omni style prompts, Gemini style).
- Word-level text-in streaming architectures (DSM / Kyutai, SpeakStream, Dia2) that remove sentence buffering.
- Context-conditioned conversational TTS that uses prior audio turns (Sesame CSM, Fish `condition_on_previous_chunks`).
- Single-word repair and regeneration (Drama 3).
- Viseme timestamps for avatars (Inworld TTS-2).
- Pronunciation-robustness leaderboards (AA). Multilingual arenas, including Spanish (AA, Sept 2026).
- Watermarking by default (Chatterbox Perth) and embedding-restricted cloning (Kyutai).

### (d) Pitfalls and anti-patterns

- Trusting vendor TTFB. It excludes the network and is often P50 or P90 server-side. Independent measurements are 1.3–3x higher.
- Leaving default server thresholds (120 chars) in place while also sentence-buffering client-side, which doubles the buffering.
- Using MP3 at 44.1 kHz and 128 kbps for a speech-only realtime stream.
- Sending unclosed sentences to Cartesia, which waits up to 3 s.
- Splitting tags across chunks. Letting unknown `[brackets]` reach Inworld or ElevenLabs.
- Reading `*smiles*` aloud.
- Per-turn sockets (handshake on every turn). Missing keep-alive (20 s idle closes on ElevenLabs).
- Assuming clones survive model upgrades.
- Building on vendors in exit: Hume (2026-11-13), OpenAI TTS (2027-01-06), PlayHT (gone), Rime Arcana, Fish S1 (2026-12-31).
- Ignoring billing units: Fish bills UTF-8 bytes, Gemini bills audio tokens, and the Gemini price doubles in 2027.
- Feeding alignment text that contains audio tags back into LLM context.
- Not checking content policy for 18+ audio. Fish's terms ban explicit sexual submissions.

---

## 7. Implications for Magic Worlds (prioritized)

These are tied to what the call path does today, based on a quick read of `/home/andres/PycharmProjects/magic-worlds-api`:

- **ElevenLabs:** calls use `eleven_v4_turbo` over **`/v1/text-to-dialogue/multi-stream-input`**, with `sync_alignment=true`, `apply_text_normalization=auto` and **`mp3_44100_128`** (`src/services/speech/providers/elevenlabs/tts_multicontext_ws.py:93,241-244`). A keepalive is sent after 15 s idle.
- **Fish:** calls use `drama-3` or `s2.1-pro` over **`wss://api.fish.audio/v1/tts/live/with-timestamp`**, with mp3 at 128 kbps, `chunk_length: 100` and `latency: 'balanced'` (`src/services/speech/providers/fish_audio/timestamp_ws.py:25,212`).
- **Text aggregation:** `SentenceBuffer` emits at a confident sentence boundary, or at a 160-character soft cap (`src/services/voice_orchestration/sentence_buffer.py`). There is no clause-level first chunk.
- **Flush-ahead:** the first three sentences flush at once. After that, a sentence flushes only while fewer than 3 are unheard and less than 8 s is ahead (`call_tts_elevenlabs.py:14-20`).
- **Text pipeline:** removes markdown emphasis (`*…*`) but keeps the words (`src/services/speech/text_pipeline.py:200-201`), expands numbers for en/es, translates markup v1 per provider, and runs moderation.

### P0: latency wins at low risk

1. **Instrument end-to-end TTS TTFA before changing anything.** Measure LLM first sentence-ready → provider first byte → client first sample played, at p50 and p95, split by provider, model, voice type (IVC vs PVC) and language. Without it you can't validate vendor claims (vendor numbers ran 1.3–3x below independent measurements in this research).
2. **Add a clause-level first chunk.** For the first unit of each turn only, cut at the first `,` `;` `:` `—` `…` after about 25–40 characters or about 5–8 words, and flush it. Keep sentence units afterwards. On ElevenLabs TTD, the server's own threshold is about 40 chars and 8 words, so a smaller first chunk needs `flush: true`, which the code already sends per sentence. A 160-character soft cap at about 15 chars/s means a long first sentence can delay speech by several seconds of LLM generation. Also handle Spanish `¿` `¡`, Spanish abbreviations, the `…` character and `3,5` decimals in `SentenceBuffer`.
3. **Use a lighter output format for calls.** Move from `mp3_44100_128` to **PCM at 16 or 24 kHz** into an AudioWorklet ring buffer. Alternatively use **Opus** where the provider supports it (Fish yes, MiniMax yes, ElevenLabs v4 lists MP3, PCM and µ-law), or at least `mp3_22050_32`. This cuts bytes 2–4x, removes MP3 decode and frame-boundary latency, and simplifies barge-in truncation by sample count. Keep MP3 for narration and downloads.
4. **Test Fish `latency: 'low'`** against `'balanced'` on `drama-3` and `s2.1-pro`. The protocol reference calls `low` the lowest, but the streaming guide calls `balanced` the lowest-TTFA voice-agent mode and doesn't mention `low`, so measure it. `chunk_length` is already at its minimum of 100. A/B quality, especially for Spanish.
4a. **Re-cost `drama-3` before 2026-11-12** (added in fact-check). Its list price is $50/1M chars after the $10 launch promo, compared with $15/1M bytes for `s2.1-pro` and $40/1M for Eleven v4 Turbo. Consider defaulting calls to `s2.1-pro` and keeping Drama 3 for premium characters.
5. **Plan capacity for ElevenLabs TTD.** Each open TTD connection holds a dialogue-pool session for the *whole call*, including silences. Confirm the pool size for the plan and alert on it. Idle sockets on the classic WS don't count, so a Flash v2.5 fallback has different capacity characteristics.

### P1: quality, character and robustness

6. **Decide how call TTS handles roleplay emotes.** If `*smiles softly*` reaches TTS as "smiles softly", it is spoken aloud. Either tell the callbot prompt never to emit action text in calls, or map a small allow-list of emotes to provider tags and drop the rest: ElevenLabs `[laughs]`/`[sighs]`/`[whispers]`, Fish `[laughing]`-style cues, MiniMax `(laughs)`. Never forward unknown brackets.
7. **Strip audio tags and pause markers from the alignment-derived "heard" transcript** before it enters LLM history and the barge-in ledger (Pipecat documents that v3 and v4 tags show up in alignment).
8. **Normalize Spanish correctly.** Make number expansion gender-aware ("una", "veintiún"), use locale-aware dates, and send `language` / `language_code` (es-MX vs es-ES) where supported. Remember that Fish bills UTF-8 bytes, so Spanish costs a little more.
9. **Plan voice lifecycle and portability.** Store consented source audio and transcripts for every character voice. Expect re-cloning on model upgrades: ElevenLabs requires retraining clones for v4, and Cartesia PVCs are snapshot-bound. Keep a provider-neutral voice record so a voice can be re-provisioned on Fish, ElevenLabs, Cartesia or Inworld.
10. **Add a third provider as a fast fallback** behind the existing breakers. **Cartesia Sonic 3.6** (fastest measured, 44 languages, word timestamps, PCM, IVC/PVC) or **Inworld TTS-2** (cheap, steering, 200+ locales, ZDR) are the strongest candidates. Run a policy and legal check for 18+ fictional audio first. Gemini 3.8 Flash TTS is attractive on price but needs a streaming-latency test, and its price doubles on 2027-01-01.
11. **Cache phrases per character:** greeting, backchannels and short fillers in en and es, keyed by `(voice, model, settings, normalized_text_sha256)`. Play them instantly at call start or when the LLM is slow. Invalidate on voice retrain.
12. **Use a lorebook pronunciation map.** Generate replacement rules from lorebook proper nouns and apply them before TTS. This is provider-agnostic, unlike vendor pronunciation dictionaries, which also break word tracking.

### P2: strategic

13. **Content-policy posture.** ElevenLabs' policy (2026-10-09) bans *visual* explicit depictions and some erotic categories, plus "harmful emotional dependency". Fish's terms (2024) ban sexually explicit submissions. Inworld's AUP is ambiguous on adult products. For 18+ voice, get a legal read and consider a self-hosted open-weight path: Chatterbox Multilingual V3 or the Latam/Spain packs (MIT, watermarked), or Fish Drama 3 under its community license. That makes explicit content Magic Worlds' own policy decision. *(The FACL bans cloning a real person's voice without consent, and its "Hosted Services" clause needs legal review.)*
14. **Track deprecations and exits:**
    - Hume ends 2026-11-13. Confirm there is no residual use.
    - Fish S1 retires 2026-12-31. The code already uses S2.1/Drama 3.
    - OpenAI TTS ends 2027-01-06.
    - Cartesia sonic-2 sunset after 2026-10-20.
    - ElevenLabs Turbo v2.5 is deprecated. The code aliases it to Flash in `capabilities.py:192`.
    - The ElevenLabs TTD reference page still says `eleven_v3`-only. Watch for API drift around `eleven_v4_turbo` on multi-context.
15. **Re-benchmark quarterly.** AA's #1 changed at least four times in 2026: Fun-Realtime-TTS in June, Simba 3.2 in July (per Speechify's PR), Sonic 3.6 in late Aug–Sept, and Eleven v4 from 2026-09-28. Keep a small internal arena: the same character lines in en and es, cloned voices, streamed input, and measured TTFA.

---

## 8. Open questions

- What is Eleven v4 Turbo's real end-to-end TTFA on the TTD multi-context WS from the Magic Worlds backend region? (No independent measurement found.) Does `auto_mode` or a lower threshold exist for TTD?
- What are the ElevenLabs dialogue-pool limits per plan? Each call holds one session for its lifetime.
- What is Fish Drama 3's latency on the live WS? Is `latency: 'low'` good enough for drama-3? *(Price and launch are now answered: launched 2026-10-13 at $50/1M chars list, with a $10 promo until 2026-11-12. The docs pricing page still omits it.)* Is the undocumented `/v1/tts/live/with-timestamp` endpoint supported for `drama-3`?
- Do Fish's current terms still ban "sexually explicit content" in submissions (effective 2024-08-18)? Is there a separate API AUP? What are Cartesia's AUP terms (page not retrievable)? Is Inworld's AUP restriction on minors-inappropriate content limited to minors' products?
- Is Gemini 3.8 Flash TTS realtime-grade for streamed text input? What is its content-filter behaviour for mature fiction?
- How good is cross-lingual IVC for Spanish (an English sample speaking Spanish) on v4, Sonic 3.6, Fish S2.1 and Inworld TTS-2? No independent Spanish benchmark was retrieved. AA's Spanish arena exists but wasn't fetched.
- What does the browser support matrix for WebCodecs `AudioDecoder` with Opus look like for the Magic Worlds user base, especially Safari and iOS? If it is too narrow, the fallback is PCM.

---

## 9. Sources

All sources were accessed 2026-10-20. Publication or update dates are given where known.

**Benchmarks**
- Artificial Analysis TTS leaderboard (Provider Voice), no explicit date, entries through Oct 2026: https://artificialanalysis.ai/text-to-speech/leaderboard
- Artificial Analysis TTS overview (throughput): https://artificialanalysis.ai/text-to-speech
- AA article "Fun-Realtime-TTS…", 2026-06-03: https://artificialanalysis.ai/articles/fun-realtime-tts-new-text-to-speech-model-topping-artificial-analysis-leaderboard
- AA on X: multilingual TTS arenas (Sept 2026): https://x.com/ArtificialAnlys/status/2102490340678856997
- AA on X: Ming-3.0-tts (Oct 2026): https://x.com/ArtificialAnlys/status/2112389514404462613
- AA on X: Drama 3 Preview #1 open weights (Oct 2026): https://x.com/ArtificialAnlys/status/2110081938140582085
- Vapi Humanness Index, standings 2026-10-20, latency trials June 2026: https://humannessindex.vapi.ai/ ; https://humannessindex.vapi.ai/models/cartesia-sonic-3-5 ; https://humannessindex.vapi.ai/models/cartesia-sonic-3

**ElevenLabs**
- Models overview (undated): https://elevenlabs.io/docs/overview/models
- Eleven v4 page (launch about 2026-09-28): https://elevenlabs.io/v4
- TechTimes on v4, 2026-09-30: https://www.techtimes.com/articles/328298/20260930/elevenlabs-eleven-v4-shifts-voice-ai-reading-acting-turbo-hits-sub-150ms-latency.htm
- Realtime TTS WS guide: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tts
- stream-input API reference: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input
- TTD realtime guide: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd
- TTD multi-context API reference: https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-multi-websocket
- TTS vs TTD WebSockets: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets
- Conversational agents / multi-context best practices: https://elevenlabs.io/docs/best-practices/conversational-agents
- Latency optimization: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization
- Normalization best practices: https://elevenlabs.io/docs/best-practices/prompting/normalization
- API pricing: https://elevenlabs.io/pricing/api
- Prohibited use policy, updated 2026-10-09: https://elevenlabs.io/use-policy
- v3 Conversational GA (X post, about Aug 2026): https://x.com/ElevenLabs/status/2090136227617952145
- LiveKit issue on v3 multi-context (about Feb 2026, superseded): https://github.com/livekit/agents/issues/4901

**Cartesia**
- Sonic 3.6 model doc: https://docs.cartesia.ai/build-with-cartesia/tts-models/latest
- Changelog 2026: https://docs.cartesia.ai/changelog/2026
- TTS WebSocket API reference: https://docs.cartesia.ai/api-reference/tts/websocket
- Continuations guide: https://docs.cartesia.ai/build-with-cartesia/capability-guides/stream-inputs-using-continuations
- Pricing: https://cartesia.ai/pricing
- Hume alternatives article (Oct 2026): https://www.cartesia.ai/learn/top-hume-ai-alternatives

**Fish Audio**
- Developer intro: https://docs.fish.audio/developer-guide/getting-started/introduction
- Models overview: https://docs.fish.audio/developer-guide/models-pricing/models-overview
- Pricing and rate limits: https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits
- Realtime streaming guide: https://docs.fish.audio/features/realtime-streaming
- Live WS protocol: https://docs.fish.audio/api-reference/endpoint/websocket/tts-live
- S2-Pro model card (tech report 2026-03-09): https://huggingface.co/fishaudio/s2-pro
- MarkTechPost on S2, 2026-03-10: https://www.marktechpost.com/2026/03/10/fish-audio-releases-fish-audio-s2-a-new-generation-of-expressive-text-to-speech-tts-with-absurdly-controllable-emotion/
- Drama 3 launch (X, about 2026-09-23): https://x.com/FishAudio/status/2102805658005635294 ; open weights #1 (X, Oct 2026): https://x.com/FishAudio/status/2110749191853248829
- eesel Drama 3 review (2026): https://www.eesel.ai/blog/fish-audio-drama-3-review
- Terms of service, effective 2024-08-18: https://fish.audio/terms

**Inworld**
- TTS models: https://docs.inworld.ai/tts/tts-models
- Steering: https://docs.inworld.ai/tts/capabilities/steering
- Pricing: https://inworld.ai/pricing
- Launch press release (about 2026-09-02): https://finance.yahoo.com/technology/ai/articles/inworld-launches-realtime-tts-2-160000791.html
- AUP, 2025-06-11: https://inworld.ai/aup/ ; Terms, 2025-06-11: https://inworld.ai/terms

**Rime**
- Models doc: https://docs.rime.ai/docs/models
- Arcana v3 launch (early 2026): https://www.rime.ai/resources/arcana-v3
- Together AI on Arcana v3: https://www.together.ai/blog/rime-arcana-v3-turbo-and-rime-arcana-v3-now-available-on-together-ai
- Third-party review (Arcana retirement claim): https://www.theaidirectory.com.au/review-rime-australia-2026/

**Hume**
- TTS overview (sunset notice): https://dev.hume.ai/docs/text-to-speech-tts/overview.md
- Changelog (notice about 2026-10-02): https://dev.hume.ai/voice/changelog

**Deepgram**
- TTS models: https://developers.deepgram.com/docs/tts-models

**OpenAI**
- TTS guide: https://developers.openai.com/api/docs/guides/text-to-speech
- Deprecations (TTS announced 2026-10-01, shutdown 2027-01-06): https://developers.openai.com/api/docs/deprecations

**Google**
- Gemini speech generation: https://ai.google.dev/gemini-api/docs/speech-generation
- Gemini pricing: https://ai.google.dev/gemini-api/docs/pricing
- Chirp 3 HD, updated 2026-10-13: https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd
- OpenRouter Gemini 3.1 Flash TTS: https://openrouter.ai/google/gemini-3.1-flash-tts-preview
- Voyager review of Gemini 3.1 Flash TTS (2026): https://voyager.so/resources/models/gemini-3-1-flash-tts

**Microsoft**
- Azure HD voices, updated 2026-09-24: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/high-definition-voices
- VibeVoice repo: https://github.com/microsoft/VibeVoice

**MiniMax**
- Models intro: https://platform.minimax.io/docs/guides/models-intro
- T2A WebSocket reference: https://platform.minimax.io/docs/api-reference/speech-t2a-websocket

**Others and open models**
- Speechify Simba 3.2 PR (2026): https://www.prweb.com/releases/speechifys-simba-3-2-ranks-1-on-independent-artificial-analysis-tts-leaderboard-worlds-best-real-time-voice-model-above-elevenlabs-openai-google-deepmind--others-302819731.html
- Meta acquires Play AI (TechCrunch, 2025-07-13): https://techcrunch.com/2025/07/13/meta-acquires-voice-startup-play-ai/
- Kyutai delayed-streams-modeling repo: https://github.com/kyutai-labs/delayed-streams-modeling ; Kyutai TTS model card: https://huggingface.co/kyutai/tts-1.6b-en_fr
- DSM paper, arXiv 2509.08753 (2025-09-10): https://arxiv.org/abs/2509.08753
- SpeakStream, arXiv 2505.19206 (2025-05-25): https://arxiv.org/abs/2505.19206
- Chatterbox: https://github.com/resemble-ai/chatterbox
- Orpheus: https://github.com/canopyai/Orpheus-TTS
- Kokoro-82M (v1.0 2025-01-27): https://huggingface.co/hexgrad/Kokoro-82M
- Higgs Audio: https://github.com/boson-ai/higgs-audio
- IndexTTS (2.5 on 2026-08-10): https://github.com/index-tts/index-tts
- Dia: https://github.com/nari-labs/dia ; Dia2: https://github.com/nari-labs/dia2
- Sesame CSM (2025-03-13): https://github.com/SesameAILabs/csm

**Frameworks and web platform**
- Pipecat ElevenLabs TTS: https://docs.pipecat.ai/server/services/tts/elevenlabs
- LiveKit Agents text and transcriptions: https://docs.livekit.io/agents/build/text/
- Opus codec (libopus 1.6.1, 2026-01-14): https://opus-codec.org/
- MDN AudioDecoder: https://developer.mozilla.org/en-US/docs/Web/API/AudioDecoder

**Magic Worlds code consulted (local)**
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/providers/elevenlabs/tts_multicontext_ws.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/providers/fish_audio/timestamp_ws.py`, `streaming.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/sentence_buffer.py`, `call_tts_elevenlabs.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/text_pipeline.py`, `capabilities.py`, `model_features.py`

---

## Fact-check log (2026-10-20)

I checked the claims below against primary sources with WebFetch on 2026-10-20. The shared WebSearch budget for this run was already used up, so all checks are direct fetches of vendor pages. platform.minimax.io and x.com could not be fetched.

Verdicts:

- **confirmed:** the primary source matches the note.
- **corrected:** the note was wrong or incomplete and has been edited.
- **unverified:** the claim could not be checked and is marked "(unverified)" in the text.

| # | Claim | Verdict | Evidence / correction | Source |
|---|---|---|---|---|
| 1 | Eleven v4 and v4 Turbo released about 2026-09-28. v4 Turbo has ~100 ms median inference and ~150 ms TTFS. Competitor figures cited: Sonic 3.6 262 ms, gpt-4o-mini-tts 814 ms | confirmed | The v4 page has the latency figures. TechTimes dates the release 2026-09-28 | https://elevenlabs.io/v4 ; https://www.techtimes.com/articles/328298/20260930/elevenlabs-eleven-v4-shifts-voice-ai-reading-acting-turbo-hits-sub-150ms-latency.htm |
| 2 | IVCs and PVCs made before v4 must be retrained. SSML `<break>` is disabled in v4. Every clone needs verified consent | confirmed | Stated on the v4 page | https://elevenlabs.io/v4 |
| 3 | ElevenLabs model table: v4 Turbo on TTD WS; v3 Conversational ~280 ms; Flash v2.5 ~75 ms with 32 languages; Turbo v2.5 deprecated | confirmed | Turbo v2, Turbo v2.5 and scribe_v1 are the deprecated models. v3, v3 Conversational and Multilingual v2 are "previous generation", not deprecated | https://elevenlabs.io/docs/overview/models |
| 4 | ElevenLabs API price: $0.04/1K for Flash, Turbo, v4 Turbo and v3 Conversational; $0.08/1K for v2, v3 and v4; same rate on every plan | confirmed | Matches the pricing page. AA and Vapi list Flash at $50/1M, which conflicts with ElevenLabs' own page | https://elevenlabs.io/pricing/api |
| 5 | Classic WS defaults: `chunk_length_schedule` [120,160,250,290] with each value 50–500; `inactivity_timeout` 20 s (max 180 s); no v3 or v4 on the classic WS | confirmed | The realtime guide says "does not support `eleven_v3` or `eleven_v4`". The keep-alive is a single space | https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input ; https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tts |
| 6 | TTD WS: ~40 chars and 8 words before first audio; fixed 20 s inactivity; 5 contexts; each connection holds a dialogue-pool session for its lifetime | confirmed | The doc inconsistency is still present: the API reference says `eleven_v3` only, while the guides say v3 or v4. Pipecat's `ElevenLabsDialogueTTSService` defaults to `eleven_v4_turbo` | https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd ; https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-multi-websocket ; https://docs.pipecat.ai/server/services/tts/elevenlabs |
| 7 | AA Provider Voice Elo values and prices (v4 Turbo 1333 … Mist V2 904) | corrected | Every listed value matches. The list was incomplete, so I added Qwen-Audio-3.0-TTS-Plus 1264, Breeze TTS 2 1222, StepAudio 2.5 1216, Luna TTS 1211 and Soniox TTS RT v2 1179 | https://artificialanalysis.ai/text-to-speech/leaderboard |
| 8 | Hume TTS and EVI sunset, access ends 2026-11-13 12:01 a.m. EST, notice 2026-10-02; voices not exportable | corrected | The date and notice are confirmed. The non-export claim comes only from Cartesia (a competitor); Hume's own pages are silent on it | https://dev.hume.ai/voice/changelog ; https://www.cartesia.ai/learn/top-hume-ai-alternatives |
| 9 | OpenAI deprecated `tts-1`, `tts-1-hd` and `gpt-4o-mini-tts` (announced 2026-10-01, shutdown 2027-01-06); replacement `gpt-realtime-2.1-mini`, not on `/v1/audio/speech` | confirmed | I added the related realtime, audio and transcription deprecations (shutdowns 2027-01-20 and 2027-02-26) | https://developers.openai.com/api/docs/deprecations ; https://developers.openai.com/api/docs/guides/text-to-speech |
| 10 | Inworld TTS-2 at 100 ms P90 and Flash at 20 ms P90 (server-side); TTS-1 and 1-Max discontinued 2026-06-15; pricing $25→$12.50 and Flash $15→$7; concurrency 5–500 | confirmed | The launch press release (2026-09-02) instead says "<100 ms P99" and 25 ms for Flash (Coval). The release doesn't say "GA". The research preview was around 2026-05-05 | https://docs.inworld.ai/tts/tts-models ; https://inworld.ai/pricing ; https://finance.yahoo.com/technology/ai/articles/inworld-launches-realtime-tts-2-160000791.html |
| 11 | Inworld steering is English-only, persists until another tag or `[reset]`, and unknown brackets are treated as instructions | confirmed | Steering works only on `inworld-tts-2`. Flash ignores instructions but keeps non-verbal tags | https://docs.inworld.ai/tts/capabilities/steering |
| 12 | Fish Drama 3 is a "preview" (about 2026-09-23/25), open weights 2026-10-13, price n/a (AA $15) | **corrected** | `drama-3-preview` went to API users 2026-09-23. Drama 3 launched 2026-10-13 in the app and API with open weights. **List price $50/1M chars, $10 promo until 2026-11-12.** It is not yet on the docs pricing or models pages | https://fish.audio/blog/fish-audio-drama-3 ; https://www.eesel.ai/blog/fish-audio-drama-3-review ; https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits |
| 13 | Drama 3 weights under the Fish Audio Community License, free below $500k revenue (marked **verify**) | corrected (verified + caveat) | FACL v1.0 is confirmed, below $500k trailing-12-month revenue. **Hosted or API services always need a license.** The HF tag still says research license. The model is 35B MoE with 3B active (HF metadata 36B), with 88.9 ms TTFA at c=1 on H200 | https://huggingface.co/fishaudio/drama-3 ; https://huggingface.co/fishaudio/drama-3/raw/main/LICENSE |
| 14 | Fish live WS fields: `chunk_length` 100–300 (default 300), `min_chunk_length` 0–100 (default 50), `latency` normal (default) / balanced / low, Opus supported, `condition_on_previous_chunks` true | confirmed, with a doc conflict | The streaming guide contradicts the reference: it calls `balanced` the default and lowest-TTFA mode. `/with-timestamp` is not publicly documented. No per-context cancel exists; `stop` drains the buffer | https://docs.fish.audio/api-reference/endpoint/websocket/tts-live ; https://docs.fish.audio/features/realtime-streaming |
| 15 | Fish pricing $15/1M UTF-8 bytes; S1 retires 2026-12-31; concurrency 5/15/50 | confirmed | `s2.1-pro-free` costs $0 | https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits ; https://docs.fish.audio/developer-guide/models-pricing/models-overview |
| 16 | Cartesia Sonic 3.6 GA 2026-08-27 (snapshot `sonic-3.6-2026-08-27`); sonic-2, sonic-turbo and `sonic-3-2025-10-27` sunset after 2026-10-20; 44 languages | confirmed | The voice-embedding removal took effect **2026-06-01** (corrected from Feb). New PVCs auto-train on all eligible models (Sept). The 08-17 beta date and the `accent` field are unverified | https://docs.cartesia.ai/changelog/2026 ; https://docs.cartesia.ai/build-with-cartesia/tts-models/latest |
| 17 | Cartesia WS: `max_buffer_delay_ms` 0–5000 (default 3000); raw PCM, mu-law and A-law only, no MP3 or Opus; `cancel: true`; speed 0.6–1.5; 5 emotions | confirmed | The vendor claims "first audio in under 90ms" | https://docs.cartesia.ai/api-reference/tts/websocket ; https://cartesia.ai/sonic |
| 18 | Cartesia pricing: 1 credit = 1 char; 750–800 credits/min; plans $5/100K, $49/1.25M, $299/8M; TTS concurrency 2/3/5/15 | confirmed | | https://cartesia.ai/pricing |
| 19 | Vapi measured latencies (Sonic 3.5 128 ms, Fish S2.1-Pro 141 ms, Flash v2 226 ms, Inworld TTS-2 288 ms …): median of 50 trials, June 2026, network included | confirmed / corrected | The latencies are confirmed. Inworld TTS-2's price on Vapi is $25 (not n/a), and Flash v2 shows $50. No v4, Sonic 3.6 or Drama 3 entries exist | https://humannessindex.vapi.ai/ ; https://humannessindex.vapi.ai/models/cartesia-sonic-3-5 ; https://humannessindex.vapi.ai/models/inworld-tts-2 ; https://humannessindex.vapi.ai/models/elevenlabs-flash-v2 ; https://humannessindex.vapi.ai/api/models |
| 20 | Gemini 3.8 Flash TTS costs $9/1M audio tokens until 2026-12-31, then $18 (Flash-Lite $6, then $12); 130+ and 100+ languages; 30 voices; 200 custom voices with a 1-year TTL; PCM 24 kHz streaming; latency undocumented | confirmed | The OpenRouter 4.37 s P50 figure is **unverified** (not shown on the page fetched) | https://ai.google.dev/gemini-api/docs/pricing ; https://ai.google.dev/gemini-api/docs/speech-generation |
| 21 | Rime Arcana retired from cloud 2026-08-15 (third-party report); Coda and Mist v3 details | corrected (now primary-sourced) | Rime's changelog confirms 2026-08-15, with `arcana*` routed to Coda. Coda launched 2026-05-19; Mist v3 is ~37 ms P50 | https://docs.rime.ai/docs/changelog ; https://docs.rime.ai/docs/models |
| 22 | Deepgram Aura-2 at $30/1M "at 2025 launch [unverified]"; Flux TTS docs not retrievable | corrected | Current list prices are Aura-2 $30/1M ($27 Growth) and Flux TTS $45/1M ($40.5 Growth). Aura-2 has 17 Spanish voices | https://deepgram.com/pricing ; https://developers.deepgram.com/docs/tts-models |
| 23 | Azure HD: <300 ms; DragonHD 30+ voices incl. es-ES Tristan and Ximena; styles on English content only; HD Omni 700+ voices; HD Flash zh-CN/en-US only | confirmed | The page is updated 2026-09-24. Its summary table still says Omni has "500+", while the detail section says 700+ | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/high-definition-voices |
| 24 | Speechify Simba 3.2 has an "unclear cloning story" | corrected | The 2026-07-07 PR says it supports instant voice cloning and prices it at $10→$6/1M. Simba was AA #1 in July | https://www.prweb.com/releases/speechifys-simba-3-2-ranks-1-on-independent-artificial-analysis-tts-leaderboard-worlds-best-real-time-voice-model-above-elevenlabs-openai-google-deepmind--others-302819731.html |
| 25 | AA added 9 non-English leaderboards incl. Spanish in Sept 2026 | unverified | The X post returned 402. AA's TTS pages show no language filter | https://x.com/ArtificialAnlys/status/2102490340678856997 ; https://artificialanalysis.ai/text-to-speech |
| 26 | MiniMax Speech 2.8 WS details (events, formats, emotions, interjections, 120 s idle) | unverified | platform.minimax.io fetches failed. Only the model's existence and AA prices are confirmed | https://artificialanalysis.ai/text-to-speech/leaderboard |
| 27 | Supporting items: libopus 1.6.1 (2026-01-14); WebCodecs AudioDecoder "Limited availability"; Meta acquired Play AI (2025-07-13); Chatterbox variants and MIT/Perth; Kyutai TTS CC-BY 4.0 with embedding-only cloning; VibeVoice code removal 2025-09-05; Kokoro v1.0 still latest; IndexTTS-2.5 (2026-08-10, es); S2-Pro architecture and Research License; ElevenLabs use policy updated 2026-10-09; Fish terms effective 2024-08-18 | confirmed | | https://opus-codec.org/ ; https://developer.mozilla.org/en-US/docs/Web/API/AudioDecoder ; https://techcrunch.com/2025/07/13/meta-acquires-voice-startup-play-ai/ ; https://github.com/resemble-ai/chatterbox ; https://huggingface.co/kyutai/tts-1.6b-en_fr ; https://github.com/microsoft/VibeVoice ; https://huggingface.co/hexgrad/Kokoro-82M ; https://github.com/index-tts/index-tts ; https://huggingface.co/fishaudio/s2-pro ; https://elevenlabs.io/use-policy ; https://fish.audio/terms |

**Newer developments the original notes missed (now added in the body):**

1. Fish Drama 3 is launched, not preview. Its $50/1M list price makes it more expensive than Eleven v4 Turbo once the promo ends on 2026-11-12. Magic Worlds uses `drama-3` for calls.
2. FACL's "Hosted Services" clause applies at any revenue level.
3. New AA top-25 entrants: Qwen-Audio-3.0-TTS-Plus, Breeze TTS 2, StepAudio 2.5, Luna TTS and Soniox TTS Real-Time v2.
4. Pipecat now has an `ElevenLabsDialogueTTSService` with default `eleven_v4_turbo`.
5. OpenAI's 2026 realtime, audio and transcription deprecations (`gpt-realtime-2.1`, `gpt-audio-1.5`, `gpt-live-transcribe`).
6. Deepgram Flux TTS pricing.
7. Cartesia PVCs auto-train on all eligible models.
8. The Fish `balanced` vs `low` documentation conflict, and the undocumented `/with-timestamp` endpoint.
9. Alibaba's international catalog lacks `qwen-audio-3.1-tts-plus`.
