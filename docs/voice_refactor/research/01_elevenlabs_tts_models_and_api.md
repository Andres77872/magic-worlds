# ElevenLabs TTS models and core API

> **Research scope (reviewed 2026-10-14):** Historical evidence from the dates stated below, including the retired MiniMax baseline. Vendor prices, model/API facts and policy claims were not reverified in this documentation pass. Current application status is **WIP** and is tracked in [00](../00_current_status_and_roadmap.md); later native ElevenLabs code/cutover supersedes migration-era implementation assumptions here.

Research date: **2026-10-12**. Research only. No code was changed.

**Scope.** This note covers ElevenLabs text-to-speech **models** and the **core TTS API** as of October 2026:
- the model lineup, limits, prices and capabilities;
- the HTTP endpoints, the WebSocket endpoints and the Text to Dialogue endpoints;
- `voice_settings` and the output formats;
- expressiveness (audio tags), pauses, pronunciation, language and normalization;
- request stitching, the error model, latency and routing.

It ends with recommendations for magic-worlds and a full MiniMax → ElevenLabs **parameter mapping**. The voice catalog and voice management APIs (voice library, cloning, design, remix) are covered only where they touch TTS parameters. They belong in a separate note. Baseline for the current stack: [00_current_tts_review.md](./00_current_tts_review.md).

**Confidence tags.**
- **[verified: url]** means the fact was read today (2026-10-12) on an official ElevenLabs page.
- **[secondary: url]** means a non-official source.
- **[unverified]** means the fact comes from memory or from inference and must be tested.
- **[derived]** means a number computed here from verified figures.

**Verification pass (2026-10-12).** An adversarial fact-check re-fetched the official pages (as `.md` from `elevenlabs.io/docs/...`, plus `elevenlabs.io/pricing` and `/pricing/api`) and re-tested 38 load-bearing claims. Corrections are made in place and marked *(corrected during verification)*. New material is marked *(added during verification)*, mostly in [§18](#18-added-during-verification-voice-slots-voice-library-rules-and-other-gaps). The full table is in the [Verification log](#verification-log-2026-10-12).

---

## Contents

0. [Key findings](#0-key-findings)
1. [Model lineup (October 2026)](#1-model-lineup-october-2026)
2. [TTS endpoints](#2-tts-endpoints)
3. [voice_settings](#3-voice_settings)
4. [Output formats](#4-output-formats)
5. [Expressiveness and emotion](#5-expressiveness-and-emotion)
6. [Pauses](#6-pauses)
7. [Pronunciation](#7-pronunciation)
8. [Missing knobs: pitch and volume](#8-missing-knobs-pitch-and-volume)
9. [Language](#9-language)
10. [Text normalization, continuity and seed](#10-text-normalization-continuity-and-seed)
11. [Character limits and chunking](#11-character-limits-and-chunking)
12. [Error model and retries](#12-error-model-and-retries)
13. [Latency, routing and concurrency](#13-latency-routing-and-concurrency)
14. [Codebase impact: what breaks when MiniMax is removed](#14-codebase-impact-what-breaks-when-minimax-is-removed)
15. [Recommendations for magic-worlds](#15-recommendations-for-magic-worlds)
16. [Open questions](#16-open-questions)
17. [Sources](#17-sources)
18. [Added during verification: voice slots, Voice Library rules and other gaps](#18-added-during-verification-voice-slots-voice-library-rules-and-other-gaps)
19. [Verification log (2026-10-12)](#verification-log-2026-10-12)

---

## 0. Key findings

1. **Eleven v4 shipped on 2026-09-28**, two weeks before this research. It comes in two variants: `eleven_v4` (highest quality, 90+ languages, 10,000 characters) and `eleven_v4_turbo` (real-time, about 100 ms median inference) [verified: https://elevenlabs.io/docs/changelog/2026/9/28.md]. ElevenLabs recommends v4 over v3 for almost every case [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4]. Note that ElevenLabs says the model is "under active, continuous development" and that "its behavior may shift over time" (same page).
2. **v4 removes most of the old knobs.**
   - It uses only **Stability** and **Similarity**.
   - **Style and Speed are not available** in v4, and **SSML is not supported** [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4].
   - Delivery is controlled with inline **audio tags** (`[whispers]`, `[sad]`, `[laughs]`…), punctuation and text structure.
3. **No ElevenLabs model has a pitch or a volume parameter.** `voice_settings` has only `stability`, `similarity_boost`, `style`, `use_speaker_boost` and `speed` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert]. MiniMax `pitch` and `vol` have no direct equivalent.
4. **`speed` is narrow and model-gated.**
   - The range is 0.7–1.2, against MiniMax's 0.5–2.0 [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices].
   - Speed is not available on Eleven v3 [verified: https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech] or on Eleven v4 [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4].
5. **v3 and v4 cannot use the classic TTS WebSocket.**
   - `/v1/text-to-speech/{voice_id}/stream-input` does not support `eleven_v3` or `eleven_v4`.
   - Real-time v3/v4 goes through the **Text to Dialogue WebSocket** (`/v1/text-to-dialogue/stream-input`). It has a different protocol, session-based metering and a fixed 20-second inactivity timeout [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets].
6. **The MiniMax inline syntax does not carry over.**
   - Pauses `<#0.4#>` become SSML `<break time="0.4s" />`, but only on v2 and Flash.
   - Interjections `(laughs)` become audio tags `[laughs]`, but only on v3 and v4.
   - Inline IPA `word/(ipa)` becomes `"/ipa/"` on v4, a `<phoneme>` tag on `eleven_flash_v2`, or a pronunciation-dictionary rule ([§6](#6-pauses), [§7](#7-pronunciation)).
7. **No MP3 output at 32 kHz.**
   - MP3 is offered only at 22.05, 24 and 44.1 kHz [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert].
   - The call pipeline hard-codes `sample_rate: 32000` on both sides of the wire: frontend `src/shared/types/voice.types.ts:170` and backend `src/services/voice_orchestration/delivery.py:352`. That contract must change ([§14](#14-codebase-impact-what-breaks-when-minimax-is-removed)).
8. **Flash v2.5 does not normalize numbers by default.**
   - Turning normalization on (`apply_text_normalization: "on"`) is **Enterprise-only** for v2.5 models [verified: https://elevenlabs.io/docs/overview/models].
   - The callbot currently relies on MiniMax provider-side normalization for digits and money (`transcript_sanitizer.py:176-178`).
9. **Pricing.** API pricing is per 1K characters, in USD [verified: https://elevenlabs.io/pricing/api]:

   | Models | Standard price | Launch promo (ends 2026-10-12) |
   |---|---|---|
   | v4, v3, Multilingual v2 | **$0.08** | v4 at $0.022 |
   | v4 Turbo, v3 Conversational, Flash/Turbo | **$0.04** | v4 Turbo at $0.011 |

   So assume the standard price. *(Re-checked during verification: the page still reads "72% off until Oct 12" on 2026-10-12, so the promo ends today [verified: https://elevenlabs.io/pricing/api].)*
10. **Voice Library voices can cost more than the model rate, and can disappear** *(added during verification)*. Some shared voices carry a legacy **credit multiplier** (e.g. 2× credits), some are paid-plan only, and an owner can stop sharing with a 30-day to 2-year notice period (or none). Voice Library voices do not use custom voice slots. See [§18](#18-added-during-verification-voice-slots-voice-library-rules-and-other-gaps). This matters directly for the voice catalog.
11. **Errors use a new structured body**: `detail.{type, code, message, status (legacy), request_id, param}` [verified: https://elevenlabs.io/docs/eleven-api/resources/errors]. Older help-center pages still document the legacy `detail.status` values (`quota_exceeded`, `too_many_concurrent_requests`, `system_busy`…).

---

## 1. Model lineup (October 2026)

### 1.1 Current TTS models

| Model id | Tier | Languages | Max chars / request | Latency (published) | API price / 1K chars | Relative cost [derived] | Primary API surface | Source |
|---|---|---|---|---|---|---|---|---|
| `eleven_v4` | Flagship quality, most expressive | 90+ | 10,000 (about 10 min) | not published | $0.08 (promo $0.022 until 2026-10-12) | 1.0× | TTS HTTP (`/v1/text-to-speech`), Text to Dialogue HTTP | [verified: https://elevenlabs.io/docs/overview/models] [verified: https://elevenlabs.io/pricing/api] |
| `eleven_v4_turbo` | Real-time, expressive | 90+ | not listed | about 100 ms median inference† | $0.04 (promo $0.011) | 0.5× | Text to Dialogue **WebSocket** | [verified: https://elevenlabs.io/docs/overview/models] [verified: https://elevenlabs.io/docs/changelog/2026/9/28.md] |
| `eleven_v3` | Previous-generation expressive | 70+ | 5,000 (about 5 min) | not published | $0.08 | 1.0× | TTS HTTP, TTD HTTP, TTD WS | [verified: https://elevenlabs.io/docs/overview/models] |
| `eleven_v3_conversational` | Previous-generation real-time expressive | 70+ | not listed | about 280 ms† | $0.04 | 0.5× | TTD WebSocket (default model there) | [verified: https://elevenlabs.io/docs/overview/models] [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket] |
| `eleven_multilingual_v2` | Stable, lifelike, long-form | 29 | 10,000 | not published | $0.08 | 1.0× | TTS HTTP and TTS WS (the **default** `model_id` of the TTS endpoints) | [verified: https://elevenlabs.io/docs/overview/models] [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert] |
| `eleven_flash_v2_5` | Fastest, multilingual | 32 | 40,000 | about 75 ms† | $0.04 | 0.5× | TTS HTTP and TTS WS | [verified: https://elevenlabs.io/docs/overview/models] |
| `eleven_flash_v2` | Fastest, English only | 1 (`en`) | 30,000 | about 75 ms† | $0.04 | 0.5× | TTS HTTP and TTS WS | [verified: https://elevenlabs.io/docs/overview/models] |

† "Excluding application & network latency" [verified: https://elevenlabs.io/docs/overview/models].

The Flash v2.5 language list adds `hu`, `no` and `vi` to the 29 Multilingual v2 languages. The full v4 list (about 90 languages, given as ISO 639-3 names) and the v3 list (about 70) are on the models page [verified: https://elevenlabs.io/docs/overview/models].

Other model ids that matter for the voice studio (not TTS):
- `eleven_ttv_v3` and `eleven_multilingual_ttv_v2`: Text to Voice, that is, voice design.
- `eleven_multilingual_sts_v2` and `eleven_english_sts_v2`: voice changer.

[verified: https://elevenlabs.io/docs/overview/models]

ElevenLabs' current selection guide [verified: https://elevenlabs.io/docs/eleven-api/choosing-the-right-model]:
- **Quality and content creation:** `eleven_v4`.
- **Low latency:** `eleven_v4_turbo`.
- **Lowest latency:** `eleven_flash_v2_5` / `eleven_flash_v2` ("Use the 2.5 model for language support outside of English").

### 1.2 Capability matrix

Legend: ✅ documented as supported · ❌ documented as not supported · ⚠️ partial or conflicting docs · ? not documented.

| Capability | `eleven_v4` | `eleven_v4_turbo` | `eleven_v3` | `eleven_v3_conversational` | `eleven_multilingual_v2` | `eleven_flash_v2_5` | `eleven_flash_v2` |
|---|---|---|---|---|---|---|---|
| TTS HTTP `POST /v1/text-to-speech/{id}` (+`/stream`) | ✅ (1) | ? (2) | ✅ (1) | ? | ✅ | ✅ | ✅ |
| TTS WebSocket `stream-input` / `multi-stream-input` | ❌ (3) | ❌ (3) | ❌ (3) | ❌ | ✅ | ✅ | ✅ |
| Text to Dialogue HTTP (`/v1/text-to-dialogue`) | ✅ (4) | ? | ✅ (default) | ? | ❌ | ❌ | ❌ |
| Text to Dialogue WebSocket | ✅ guide / ⚠️ API reference says v3 only (5) | ✅ (1 voice only) | ✅ (up to 10 voices) | ✅ (default, 1 voice) | ❌ | ❌ | ❌ |
| Audio tags `[…]` | ✅ | ✅ | ✅ | ✅ | ❌ (6) | ❌ (6) | ❌ (6) |
| SSML `<break time="…"/>` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| SSML `<phoneme>` tags | ❌ (SSML unsupported) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (English only) (7) |
| Native inline IPA `"/…/"` | ✅ | ? | ⚠️ (8) | ? | ❌ | ❌ | ❌ |
| Pronunciation dictionary **phoneme** rules | ✅ | ? | ✅ | ? | ❌ (skipped) | ❌ (skipped) | ✅ |
| Pronunciation dictionary **alias** rules | ✅ | ? | ✅ | ? | ✅ | ✅ | ✅ |
| Request stitching (`previous_request_ids`…) | ✅ (9) | ? | ❌ | ? | ✅ | ✅ | ✅ |
| `voice_settings` honored | stability, similarity only | stability, similarity per model page; **only `stability` can be sent on the TTD WS** (13) | stability only (10) | stability (TTD WS) | all 5 | all 5 | all 5 |
| `language_code` | ? (11) | ? | ✅ | ? | ❌ (ignored) | ✅ | ✅ |
| Character timestamps | ✅ via `/with-timestamps` and TTD with-timestamps (12) | ✅ TTD WS `sync_alignment` | ✅ | ✅ | ✅ | ✅ | ✅ |
| Professional Voice Clones | ✅ (rolling out) | ✅ | ⚠️ "not fully optimized" | ? | ✅ | ✅ (latency) | ✅ |

Notes and sources:
1. The help center says v4/v3 run on "Create speech" and "Stream speech" with model id `eleven_v4` / `eleven_v3` [verified: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-do-audio-tags-work-with-eleven-v3-and-v4] [verified: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/what-is-eleven-v4]. The streaming guide and IPA examples call `textToSpeech.stream/convert` with `eleven_v4` [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/streaming] [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices]. The launch changelog, however, says "Use `eleven_v4` through the Text to Dialogue API" [verified: https://elevenlabs.io/docs/changelog/2026/9/28.md]. Treat TTS-HTTP v4 as supported but verify it in a spike. *(Added during verification: more evidence for TTS-HTTP v4. The "What is Eleven v4?" article says "You can generate with Create speech and Stream speech using model ID `eleven_v4`" [verified: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/what-is-eleven-v4]. The errors page and the API introduction use `text_to_speech.convert(... model_id="eleven_v4")` in their SDK samples [verified: https://elevenlabs.io/docs/eleven-api/resources/errors] [verified: https://elevenlabs.io/docs/api-reference/introduction]. The models page still says only "Eleven v4 is available via the Text to Dialogue API" [verified: https://elevenlabs.io/docs/overview/models].)*
2. No page lists a character limit or a TTS-HTTP surface for `eleven_v4_turbo`. The launch post positions it for the TTD WebSocket only [verified: https://elevenlabs.io/docs/changelog/2026/9/28.md].
3. "That endpoint does **not** support the `eleven_v3` or `eleven_v4` models" [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tts].
4. "Eleven v4 is available via the Text to Dialogue API" [verified: https://elevenlabs.io/docs/overview/models]. TTD "is available on the Eleven v4 and Eleven v3 models" [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue].
5. The guide says `model_id` "must start with `eleven_v3` or `eleven_v4`", with up to 10 voices for `eleven_v4` and 1 for `eleven_v4_turbo` [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd]. The AsyncAPI reference still says "Eleven v3 dialogue models only (`model_id` must start with `eleven_v3`)" [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket]. The docs disagree.
6. Audio tags are documented only for v3/v4 [verified: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-do-audio-tags-work-with-eleven-v3-and-v4]. On other models, bracketed text is likely read aloud or degrades the audio. The help center notes that characters like `[`, `]`, `{`, `<` "will usually result in low quality speech" [verified: https://elevenlabs.io/docs/help-center/troubleshooting/what-characters-are-accepted-when-generating-audio]. The exact behavior is [unverified].
7. Best practices: "Phoneme tags are only compatible with the `eleven_flash_v2` model" [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices]. The help center says Flash v2 **and Turbo v2**, and English only [verified: https://elevenlabs.io/docs/help-center/technical/do-pauses-and-ssml-phoneme-tags-work-with-the-api].
8. One help article says "Eleven v3 includes native support for IPA" [verified: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-can-i-force-a-certain-pronunciation-of-a-word-or-name]. The current best-practices page documents inline IPA for v4 only.
9. The stitching guide states "Request stitching is not available for the `eleven_v3` model", yet its code sample uses `eleven_v4` with `previous_request_ids` [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/request-stitching].
10. The playground notes say Speed, Similarity and Speaker Boost are "not available for the Eleven v3 model" [verified: https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech]. For TTD WS: "Only `stability` is supported for `eleven_v3` dialogue models" [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket].
11. `language_code` is "not supported for multilingual_v2 models". Unsupported codes "will be ignored" [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert] [verified: https://elevenlabs.io/docs/changelog/2026/6/29.md]. v4 is not mentioned.
12. Timestamp endpoints take any TTS `model_id`. No per-model exclusions are documented. TTD WS alignment is sent "when available" [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd].
13. *(Corrected during verification.)* The v4 page says both variants "use two voice settings: Stability and Similarity" [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4]. But `eleven_v4_turbo` is only documented on the TTD WebSocket, and that socket's `TextToDialogueWebsocketVoiceSettings` schema has a single property, `stability` (0–1, default 0.5). It is accepted only on the first message [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket]. In practice, the call path cannot set Similarity. Only the HTTP TTD `settings.similarity` (added 2026-09-28) exposes it, and that applies to `eleven_v4`.

### 1.3 Deprecated and removed models

| Model id | Status | Replacement | Source |
|---|---|---|---|
| `eleven_monolingual_v1`, `eleven_multilingual_v1` | Deprecated in 2025-09 (first planned removal 2025-12-15). **Removal on 2026-07-09**, so already removed. | `eleven_multilingual_v2` or another current model | [verified: https://elevenlabs.io/docs/changelog/2025/9/29.md] [verified: https://elevenlabs.io/docs/changelog/2026/6/8.md] |
| `eleven_turbo_v2_5` | Deprecated, "functionally equivalent" to Flash v2.5 but slower. No removal date published. | `eleven_flash_v2_5` | [verified: https://elevenlabs.io/docs/overview/models] |
| `eleven_turbo_v2` | Deprecated, as above | `eleven_flash_v2` | [verified: https://elevenlabs.io/docs/overview/models] |
| `eleven_v3` | Current but "previous generation". Out of alpha since 2026-02-02. | `eleven_v4` | [verified: https://elevenlabs.io/docs/changelog/2026/2/2.md] [verified: https://elevenlabs.io/docs/overview/models] |

Timeline [verified: changelog entries listed in [§17](#17-sources)]:

| Date | Event |
|---|---|
| 2025-06-08 | v3 alpha |
| 2025-08-20 | v3 on the API |
| 2025-09-08 | `language_code` on all TTS models |
| 2026-02-02 | v3 GA |
| 2026-02-09 | `eleven_v3_conversational` |
| 2026-07-09 | v1 models removed |
| 2026-09-28 | v4 and v4 Turbo |
| 2026-10-05 | v4 becomes the default conversational model for Agents |

### 1.4 Discovering models at runtime: `GET /v1/models`

`ModelResponseModel` fields [verified: https://elevenlabs.io/docs/api-reference/models/list]:
- `model_id`, `name`, `description`
- `can_do_text_to_speech`, `can_do_voice_conversion`, `can_be_finetuned`
- `can_use_style`, `can_use_speaker_boost`, `serves_pro_voices`
- `token_cost_factor`, `model_rates.character_cost_multiplier`, `model_rates.cost_discount_multiplier`
- `maximum_text_length_per_request`
- `languages[] {language_id, name}`
- `concurrency_group`, `requires_alpha_access`

`max_characters_request_free_user` and `max_characters_request_subscribed_user` are **deprecated and not enforced**. Use `maximum_text_length_per_request` instead [verified: https://elevenlabs.io/docs/changelog/2026/9/28.md].

**Recommendation.** Cache this list in the BFF, with the same 5-minute pattern as today's system-voice cache. Use it to:
- validate `model_id`;
- clamp text length;
- decide whether to send `style` / `use_speaker_boost`;
- choose the concurrency pool (`concurrency_group`).

---

## 2. TTS endpoints

### 2.1 Hosts and authentication

| Server | Base URL | Use | Source |
|---|---|---|---|
| Production (default, global routing) | `https://api.elevenlabs.io` / `wss://api.elevenlabs.io` | Routed to the nearest cluster | [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert] |
| Production US | `https://api.us.elevenlabs.io` | Opts out of global routing and always uses US servers | [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization] |
| EU / India / Singapore residency | `https://api.{eu,in,sg}.residency.elevenlabs.io` | Enterprise isolated environments. These need a **separate account and API key**. | [verified: https://elevenlabs.io/docs/overview/administration/data-residency] |

- **Auth.** Send the `xi-api-key` header. Keys can be scoped to specific endpoints, given a credit quota and IP-allowlisted [verified: https://elevenlabs.io/docs/api-reference/authentication].
- **Single-use tokens.** These exist for client-side WebSocket use: the `single_use_token` query parameter, or the same field in the first message [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket]. magic-worlds should keep the key server-side in the BFF, as it does today with MiniMax.

### 2.2 HTTP endpoints

| Method and path | Returns | Notes | Source |
|---|---|---|---|
| `POST /v1/text-to-speech/{voice_id}` | Binary audio ("file download") | Accepts `wav_*` formats | [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert] |
| `POST /v1/text-to-speech/{voice_id}/stream` | Raw audio bytes with chunked transfer encoding | **No `wav_*`** in the `output_format` enum | [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/stream] [verified: https://elevenlabs.io/docs/api-reference/streaming] |
| `POST /v1/text-to-speech/{voice_id}/with-timestamps` | JSON `{audio_base64, alignment, normalized_alignment}` | Character timing in **seconds** | [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps] |
| `POST /v1/text-to-speech/{voice_id}/stream/with-timestamps` | Stream of JSON chunks, same shape | | [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/stream-with-timestamps] |
| `POST /v1/text-to-dialogue` (+ `/stream`, `/with-timestamps`, `/stream/with-timestamps`) | Audio, or JSON with `voice_segments` | Multi-voice; v3/v4 only | [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert] [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps] |

One wording conflict: the latency guide calls HTTP streaming "Server-sent events" [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization], but the API reference describes raw chunked audio bytes [verified: https://elevenlabs.io/docs/api-reference/streaming]. Plan for raw bytes, since that is what the SDKs read.

### 2.3 Query parameters (TTS HTTP)

| Param | Type / default | Semantics | Source |
|---|---|---|---|
| `output_format` | enum, default `mp3_44100_128` | `codec_samplerate_bitrate` ([§4](#4-output-formats)) | [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert] |
| `enable_logging` | bool, default `true` | `false` turns on **zero retention mode**: no history and **no request stitching**. Enterprise only. | same |
| `optimize_streaming_latency` | int 0–4, **deprecated** | 0 = none … 3 = max; 4 = max plus the normalizer turned off. Do not use it. | same |

### 2.4 Body parameters (TTS HTTP; the same on all four endpoints)

| Field | Type / default | Semantics and limits | Source |
|---|---|---|---|
| `text` | string, required | Text to speak | [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert] |
| `model_id` | string, default **`eleven_multilingual_v2`** | Must have `can_do_text_to_speech` | same |
| `language_code` | ISO 639-1, nullable | "Used to enforce a language for the model and text normalization". Ignored if unsupported. Not supported on multilingual_v2. | same |
| `voice_settings` | object, nullable | Per-request override of the stored voice settings ([§3](#3-voice_settings)) | same |
| `pronunciation_dictionary_locators` | list of `{pronunciation_dictionary_id, version_id?}` | Applied in order. **Up to 3 per request.** Latest version if `version_id` is omitted. | same |
| `seed` | int 0..4294967295 | Best-effort determinism, "not guaranteed" | same |
| `previous_text` / `next_text` | string | Continuity context for concatenated generations | same |
| `previous_request_ids` / `next_request_ids` | list, **max 3** | Continuity from earlier or later generations. These override `previous_text` / `next_text`. Best with the same model. | same |
| `use_pvc_as_ivc` | bool, default false | Use the IVC version of a PVC for lower latency or more expressiveness. **No longer deprecated** as of 2026-09-28. | same, and [verified: https://elevenlabs.io/docs/changelog/2026/9/28.md] |
| `apply_text_normalization` | `auto` / `on` / `off`, default `auto` | Spell out numbers, dates and so on ([§10](#10-text-normalization-continuity-and-seed)) | [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert] |
| `apply_language_text_normalization` | bool, default false | Language-specific normalization. **Japanese only.** "Can heavily increase the latency". | same |

### 2.5 Response bodies

- **`/v1/text-to-speech/{id}` and `/stream`:** raw audio in the requested `output_format`. There is no JSON envelope and no hex. MiniMax returned hex inside JSON (`registry.py:27`).
- **`/with-timestamps`:**
  - `audio_base64`;
  - `alignment` and `normalized_alignment`, each `{characters[], character_start_times_seconds[], character_end_times_seconds[]}`.

  `normalized_alignment` refers to the normalized text, for example digits spelled out [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps].
- **TTS WebSocket frames:** `{audio (base64), alignment?, normalizedAlignment?}`, with **camelCase** fields `charStartTimesMs`, `charDurationsMs` and `chars`. Times are relative to the chunk. The last frame is `{isFinal: true}` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input].
- **TTD WebSocket frames:** use **snake_case**:
  - `{audio, alignment?{chars, char_start_times_ms, char_durations_ms}}`;
  - `{is_final_audio_for_turn}`;
  - `{is_final}`;
  - errors as `{message, error, code (WS close code), param}`.

  [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket]
- **TTD `/with-timestamps`:** also returns `voice_segments[] {voice_id, start_time_seconds, end_time_seconds, character_start_index, character_end_index, dialogue_input_index}`. This maps each `inputs[]` line to its time range in the single audio file [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps].

### 2.6 Response headers

| Header | Meaning | Source |
|---|---|---|
| `request-id` | ID of this generation. Feeds `previous_request_ids` / `next_request_ids`. Include it in support tickets. | [verified: https://elevenlabs.io/docs/api-reference/introduction] [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/request-stitching] |
| `character-cost` | Characters billed for this generation | [verified: https://elevenlabs.io/docs/api-reference/introduction] |
| `x-trace-id` | Debug trace id | [verified: https://elevenlabs.io/docs/api-reference/introduction] |
| `x-region` | Backend region that served the request | [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization] |
| `current-concurrent-requests`, `maximum-concurrent-requests` | Live concurrency use and the plan cap | [verified: https://elevenlabs.io/docs/overview/models] |
| `x-character-count` | Said to appear in one localized revision of the intro page as the cost header | [secondary: web search summary of https://elevenlabs.io/docs/api-reference/introduction.md] |
| `history-item-id` | Not documented anywhere | [unverified] |
| `Retry-After` on 429 | Not documented | [unverified] |

**Recommendation.** For every provider call, log `request-id`, `character-cost`, `x-region` and the two concurrency headers in place of MiniMax's `extra_info` checks (`00_current_tts_review.md` §2, path A). Store `request-id` per narration segment so a single bad segment can be regenerated with `previous_request_ids` / `next_request_ids`.

### 2.7 TTS WebSockets (non-v3/v4 models)

**`wss://…/v1/text-to-speech/{voice_id}/stream-input`** [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input]

Query parameters:

| Param | Default / range |
|---|---|
| `model_id` | `eleven_multilingual_v2` |
| `language_code` | |
| `enable_logging` | `true` |
| `output_format` | |
| `inactivity_timeout` | 20, maximum **180** s |
| `sync_alignment` | `false` |
| `auto_mode` | `false` |
| `apply_text_normalization` | |
| `seed` | |
| `enable_ssml_parsing` | `false` |
| `authorization`, `single_use_token` | |

Messages:
1. **First message:** `{"text": " ", voice_settings?, generation_config?{chunk_length_schedule}, pronunciation_dictionary_locators?, xi-api-key?}`. Pronunciation dictionaries can be set only here.
2. **Text messages:** `{"text": "… ", try_trigger_generation?, flush?}`. Text should end with a space.
3. **Close:** `{"text": ""}`. Sending `" "` keeps the connection alive [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tts].

Behavior:
- **Buffering.** The default `chunk_length_schedule` is `[120, 160, 250, 290]` characters, each item in the range 50–500. `auto_mode=true` "automatically handles generation triggers". `flush: true` forces generation at the end of a turn.
- **Phoneme dictionaries.** These need `enable_ssml_parsing=true` [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tts].
- **Concurrency.** "only the time where our model is generating audio counts towards your concurrency limit" [verified: https://elevenlabs.io/docs/overview/models].
- **Voice settings on WS.** `speed` is documented "from 0.7 to 1.2". `style` and `use_speaker_boost` are "available on V2+ models" [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input].

**`wss://…/v1/text-to-speech/{voice_id}/multi-stream-input`** [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input] [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/multi-context-web-socket]

- **Contexts.** Up to **5 concurrent contexts** per connection. Every message carries `context_id`, and server frames carry `contextId`.
- **Messages:**
  - initialize a context: `{text:" ", context_id, voice_settings?…}`;
  - send text: `{text, context_id, flush?}`;
  - close a context: `{context_id, close_context: true}`;
  - keep a context alive: `{context_id, text: ""}`;
  - close everything: `{close_socket: true}`.
- **Barge-in.** "When a user interrupts your agent, you should close the current context and create a new one." This gives a provider-side **cancel** that MiniMax `t2a_v2` lacks (`00_current_tts_review.md`, path B, barge-in).
- **Connection use.** Open "one WebSocket connection for each end-user session". Contexts time out after 20 s by default; `inactivity_timeout` can raise this to 180 s.
- **Turn boundary marker** *(added during verification)*. Since 2026-09-21, the multi-context socket emits `is_final_audio_for_turn` "after every buffered byte for that turn, including MP3 and Opus output". Clients can use it as an exact turn boundary without switching to PCM [verified: https://elevenlabs.io/docs/changelog/2026/9/21.md]. This maps directly onto the call pipeline's `is_final` frame and the MSE `audio/mpeg` player.

### 2.8 Text to Dialogue (v3/v4 multi-voice)

**HTTP `POST /v1/text-to-dialogue`** [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert]

Request fields:

| Field | Notes |
|---|---|
| `inputs[] {text, voice_id}` | Up to **10 unique voice IDs**. Keep the **total under 2,000 characters** for reliable generation; "Longer requests can terminate early in streaming responses or return a validation error". |
| `model_id` | Default `eleven_v3` |
| `language_code` | |
| `settings {stability (default 0.5), similarity (0–1, default 0.75; "Not supported by every model")}` | **One settings object for the whole request.** There are no per-voice settings. |
| `previous_text` / `future_text` | Maximum **100 characters** each |
| `previous_request_ids` / `next_request_ids` | Maximum 3 each. "Not supported by every model." |
| `pronunciation_dictionary_locators` | Maximum 3 |
| `seed`, `apply_text_normalization`, `use_pvc_as_ivc` | |

The continuity fields, `use_pvc_as_ivc` and `similarity` were added on 2026-09-28 [verified: https://elevenlabs.io/docs/changelog/2026/9/28.md]. A 2026-04-07 entry described `settings` as `stability` and `speed` [verified: https://elevenlabs.io/docs/changelog/2026/4/7.md]. The current reference shows `stability` and `similarity` only.

- **Tags per line.** Audio tags go inside each line's text; "`voice_id` still selects the speaker voice for that turn" [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue].
- **Guidance.** ElevenLabs recommends "generating several generations and allowing the user to select the best one" (same page).

**WebSocket `wss://…/v1/text-to-dialogue/stream-input`** [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket] [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd]

- **Query parameters:** `model_id` (default `eleven_v3_conversational`), `output_format`, `language_code`, `sync_alignment`, `apply_text_normalization`, `seed` (minimum **1**), `enable_logging`.
- **First message:** `{voices: [...], voice_settings?{stability}, pronunciation_dictionary_locators?, xi_api_key?}`.
- **Text messages:** `{inputs: [{text, voice_id, new_turn?}], flush?, close_socket?, keep_alive?}`.
- **Buffering.** The server buffers "about 40 characters and 8 words" before the first audio. There is no `chunk_length_schedule`.
- **Inactivity.** **Fixed 20 s.** Send `{"keep_alive": true}` to stay open.
- **Voices per connection:**

  | Model | Registered voices |
  |---|---|
  | `eleven_v4_turbo` | exactly 1 |
  | `eleven_v4` | up to 10 (guide) |
  | `eleven_v3_conversational` | 1 |
  | `eleven_v3` | up to 10 |

- **Metering.** Each open connection holds one **dialogue session** from a separate pool, for as long as it is open. Generation does not use standard concurrency. Session limits per plan [verified: https://elevenlabs.io/docs/overview/models]:

  | Free | Starter | Creator | Pro | Scale / Business |
  |---|---|---|---|---|
  | 14 | 21 | 35 | 70 | 105 |

  Over the limit, the connection is rejected with `too_many_concurrent_requests`.

**Multi-context TTD WebSocket `wss://…/v1/text-to-dialogue/multi-stream-input`:**
- 5 contexts per connection, each with its own `voices`.
- `close_context` per context.
- Protocol errors (a missing `context_id`, an unregistered voice, too many contexts) **close the whole connection**.
- The reference says v3 models only.

[verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-multi-websocket]

---

## 3. voice_settings

### 3.1 Fields

| Field | Default | Range | Semantics | Source |
|---|---|---|---|---|
| `stability` | 0.5 | 0–1 | Randomness between generations. Lower gives a broader emotional range; higher can sound monotone. | [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert] |
| `similarity_boost` | 0.75 | 0–1 | How closely the output follows the original voice. Too high reproduces artifacts from poor source audio. | same; [verified: https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech] |
| `style` | 0 | 0–1 | Style exaggeration. Extra compute and latency when non-zero; "slightly less stable". ElevenLabs recommends **keeping it at 0**. | same |
| `use_speaker_boost` | true | bool | Boosts similarity; adds latency; "rather subtle" | same |
| `speed` | 1.0 | **0.7–1.2** | Below 1 slows down, above 1 speeds up; extreme values degrade quality | [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices] |

- **Common starting point:** "stability around 50, similarity around 75, and keeping style at 0" [verified: https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech].
- **Precedence:** settings in the request override the voice's stored settings "only on the given request" [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert].

### 3.2 Which models honor which setting

| Model | stability | similarity | style | speaker boost | speed | Source |
|---|---|---|---|---|---|---|
| `eleven_v4` | ✅ | ✅ | ❌ | ? (not listed) | ❌ | [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4] |
| `eleven_v4_turbo` (TTD WebSocket) | ✅ | ❌ cannot be sent: the WS schema has `stability` only *(corrected during verification)* | ❌ | ❌ | ❌ | [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket] |
| `eleven_v3` | ✅ | ❌ | ? | ❌ | ❌ | [verified: https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech] |
| `eleven_multilingual_v2`, Flash v2/v2.5 | ✅ | ✅ | ✅ (check `can_use_style`) | ✅ (check `can_use_speaker_boost`) | ✅ | [verified: https://elevenlabs.io/docs/api-reference/models/list] |

There is a conflict on speed. A playground FAQ says speed "is available for all voices and all models", but the same page also says "Speed is not available for the Eleven v3 model" [verified: https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech]. The v4 page is explicit: no Speed slider. Whether the API **rejects** `speed`/`style` on v3/v4 or silently ignores them is [unverified]. The error catalog has `invalid_voice_settings` [verified: https://elevenlabs.io/docs/eleven-api/resources/errors]. The BFF should strip unsupported fields per model.

### 3.3 v3 stability modes (Creative / Natural / Robust)

Earlier ElevenLabs v3 prompting docs described three stability positions [secondary: https://elevenlabs.io/docs/best-practices/prompting (old URL, now redirects; content summarized by web search)]:

| Mode | Behavior |
|---|---|
| **Creative** | More emotional and expressive, but prone to hallucinations |
| **Natural** | Closest to the original recording |
| **Robust** | Highly stable, but less responsive to directional prompts such as tags |

The current best-practices page no longer documents these modes, and no official page maps them to numbers. The common assumption is Creative = 0.0, Natural = 0.5, Robust = 1.0 [unverified]. For v4, ElevenLabs only says lower stability means "more expressive, varied delivery" [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4].

**Practice.** Use stability 0.3–0.5 for expressive narration with tags, and 0.6–0.8 for steady narrators [unverified: empirical guideline, to be tuned in a listening test].

### 3.4 Stored default-settings endpoints

| Endpoint | Purpose | Source |
|---|---|---|
| `GET /v1/voices/settings/default` | Global defaults (`stability`, `use_speaker_boost`, `similarity_boost`, `style`, `speed`) | [verified: https://elevenlabs.io/docs/api-reference/voices/settings/get-default] |
| `GET /v1/voices/{voice_id}/settings` | The stored settings of one voice | [verified: https://elevenlabs.io/docs/api-reference/voices/settings/get] |
| `POST /v1/voices/{voice_id}/settings/edit` | Edits stored settings. Returns `{status: "ok"}`. | [verified: https://elevenlabs.io/docs/api-reference/voices/settings/update] |

For magic-worlds, **do not** store per-character recipes as account-level voice settings. They are shared by every user of that voice. Always send `voice_settings` per request from the character snapshot, as the BFF does today with MiniMax `voice_setting`.

---

## 4. Output formats

### 4.1 Catalog

Allowed `output_format` values on `/v1/text-to-speech/{id}`, `/with-timestamps` and `/v1/text-to-dialogue` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert]:

| Codec | Values | Plan gating | Source |
|---|---|---|---|
| MP3 | `mp3_22050_32`, `mp3_24000_48`, `mp3_44100_32`, `mp3_44100_64`, `mp3_44100_96`, `mp3_44100_128` (**default**), `mp3_44100_192` | 192 kbps needs **Creator** or above | [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert] |
| PCM s16le (raw, no header) | `pcm_8000`, `pcm_16000`, `pcm_22050`, `pcm_24000`, `pcm_32000`, `pcm_44100`, `pcm_48000` | 44.1 kHz PCM needs **Pro** or above | same; [verified: https://elevenlabs.io/docs/help-center/troubleshooting/what-audio-formats-do-you-support] |
| WAV | `wav_8000` … `wav_48000` (same rates as PCM) | 44.1 kHz needs **Pro** or above. **Not on `/stream`.** | [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/stream] [verified: https://elevenlabs.io/docs/changelog/2026/2/2.md] |
| Opus | `opus_48000_32`, `_64`, `_96`, `_128`, `_192` | Container (Ogg or WebM) is not documented [unverified] | [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert] |
| Telephony | `ulaw_8000`, `alaw_8000` | μ-law "commonly used for Twilio" | same |

Gaps compared with MiniMax:
- **No MP3 at 32 kHz.**
- **No FLAC.** The admin synth lab offers `flac` today: `src/features/admin/voices/constants.ts:80`, `src/models/admin_voice.py:43`.
- **Every format is mono or unspecified.** There is no channel parameter [unverified].

### 4.2 Which format for which job

| Job | Recommended | Why |
|---|---|---|
| Stored narration assets (`tts_asset`, served as `audio/mpeg` with Range) | `mp3_44100_128` | The default; available on every tier; equal to or better than today's MiniMax 32 kHz / 128 kbps. `mp3_44100_192` (Creator+) adds file size for little gain on speech [unverified]. |
| Browser MediaSource streaming in calls (`addSourceBuffer('audio/mpeg')`, `voicePlaybackBuffer.ts:261`) | `mp3_44100_64` or `mp3_22050_32` | Keeps the current `audio/mpeg` pipeline. ElevenLabs' own load test and streaming guide use `mp3_22050_32` for low latency [verified: https://elevenlabs.io/docs/overview/models] [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/streaming]. "Higher-bitrate output … rarely worth optimising" for latency [verified: https://elevenlabs.io/docs/eleven-api/concepts/audio-streaming]. |
| Low-latency gapless playback (alternative) | `pcm_24000` or `pcm_16000` into an AudioWorklet | No MP3 frame alignment or decoder priming; easy barge-in truncation. Needs a new frontend player. |
| Telephony (not used today) | `ulaw_8000` | Twilio |
| Admin synth-lab "lossless" downloads | `wav_44100` (Pro+) or `wav_24000` | No FLAC |

---

## 5. Expressiveness and emotion

### 5.1 How emotion is controlled

**v4 and v3.** Inline **audio tags** in square brackets. They are "natural-language instructions, not an enum parameter" [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue]. Supporting controls:
- punctuation: ellipses add pauses and weight, CAPITALS add emphasis [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices];
- the stability setting;
- the choice of voice: "Tags land more readily when the delivery is already in the voice's training data" (same page).

**Multilingual v2 and Flash.** There are no tags. Emotion comes from:
- narrative context ("she said excitedly"), but the model **speaks the descriptive text**, which then has to be trimmed;
- punctuation;
- `stability` (lower is more expressive) and `style` [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech] [verified: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-to-produce-emotions].

### 5.2 Documented audio tags (non-exhaustive)

| Category | Documented examples | Source |
|---|---|---|
| Emotion | `[sad]`, `[angry]`, `[happily]`, `[happy]`, `[sorrowful]`, `[excited]`, `[curious]`, `[sarcastic]`, `[crying]`, `[mischievously]`, `[annoyed]`, `[appalled]`, `[thoughtful]`, `[surprised]`, `[frustrated sigh]`, `[happy gasp]` | [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices] [verified: https://elevenlabs.io/blog/v3-audiotags] |
| Delivery and pacing | `[whispers]`, `[whispering]`, `[shouts]`, `[shouting]`, `[softly]`, `[quietly]`, `[pause]`, `[short pause]`, `[long pause]`, `[rushed]`, `[drawn out]`, `[slowly]`, `[low, gravelly voice]`, `[Quiet, measured narration]`, `[Building tension, measured pace]` | same, and [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4] |
| Human reactions (non-verbal) | `[laughs]`, `[laughs harder]`, `[starts laughing]`, `[laughing]`, `[chuckles]`, `[giggles]`, `[wheezing]`, `[sighs]`, `[exhales]`, `[exhales sharply]`, `[inhales deeply]`, `[clears throat]`, `[snorts]`, `[swallows]`, `[gulps]`, `[gasps]` | [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices] |
| Dialogue flow | `[jumping in]`, `[interrupting]`, `[overlapping]`, `[starting to speak]`, plus em dashes and ellipses for cut-offs | [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue] |
| Sound effects | `[gunshot]`, `[applause]`, `[clapping]`, `[explosion]`, `[leaves rustling]`, `[gentle footsteps]` | [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue] |
| Accents and characters (experimental) | `[strong French accent]` (`[strong X accent]`), `[British accent]`, `[pirate voice]`, `[robotic voice]`, `[sings]`, `[woo]` | [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices] [verified: https://elevenlabs.io/blog/v3-audiotags] |
| Overall direction | `[football]`, `[wrestling match]`, `[auctioneer]` | [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue] |

**v4 prompting best practices** [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices]:
- Be explicit about **voice quality**. A tag "can occasionally be interpreted as a request for a sound effect rather than a delivery instruction". Prefer `[low, gravelly voice]` over ambiguous cues.
- Match tags to the voice: "A meditative voice shouldn't shout".
- Tags can be combined, and they apply until the delivery shifts again.
- Text structure "strongly influences output". Use natural speech patterns and proper punctuation.
- ElevenLabs publishes its LLM "Enhance" prompt, which auto-inserts tags without changing words. *(Corrected during verification.)* Its rules:
  - place tags "typically immediately before the dialogue segment they modify or immediately after" (e.g. `This is hard. [sighs]`), not only as a prefix;
  - tags must describe something auditory, for the voice only (no music or sound effects);
  - never add, remove or change words;
  - emphasis may still be added with CAPITALS, `?`, `!` and ellipses.

  Its negative list bans `[standing]`, `[grinning]`, `[pacing]` and `[music]`. It also tells the LLM not to "introduce or imply any sensitive topics … profanity, hate speech, or other NSFW content" [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices]. For a roleplay app, reuse the tag rules but write our own content rule, because the stock prompt would sanitize mature fiction.
- v4 cross-language: when the generated language differs from the voice's language, v4 produces **native-accent** speech rather than carrying over the voice's accent. This is "a deliberate change", and `[strong X accent]` tags can try to override it [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4].

### 5.3 Mapping table: MiniMax `emotion` → ElevenLabs

MiniMax values in the codebase:
- the backend allow-list is `happy, sad, angry, fearful, disgusted, surprised, calm` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:18`; enum `/home/andres/PycharmProjects/magic-worlds-api/src/models/admin_voice.py:30-37`);
- "Auto" is the empty value, meaning the field is omitted (`/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/constants.ts:65-75`).

There is no emotion **parameter** in ElevenLabs. Emotion becomes a text prefix on v3/v4, or a settings and prompt hint on v2/Flash.

| MiniMax `emotion` | v4 / v3: audio tag prefix (suggested) | v2 / Flash: closest knobs | Notes |
|---|---|---|---|
| *(auto / omitted)* | no tag | defaults | The model infers from context |
| `happy` | `[happy]` / `[cheerfully]` | stability around 0.35, `style` 0.2–0.4 (v2 only), exclamation marks | `[happy]` and `[happily]` are in the docs |
| `sad` | `[sad]` / `[sorrowful]` | stability around 0.4, `speed` 0.9–0.95, ellipses | |
| `angry` | `[angry]` (`[shouting]` for intensity) | stability around 0.3, `style` 0.3–0.5, CAPS for emphasis | |
| `fearful` | `[nervously]` / `[trembling, fearful voice]` | stability around 0.3, dashes and ellipses | Not a listed tag; free-form tags are allowed |
| `disgusted` | `[disgusted]` / `[groaning]` | stability around 0.4 | `[groaning]` is documented in TTD examples |
| `surprised` | `[surprised]` / `[gasps]` | exclamation marks and question marks | Both are documented |
| `calm` | `[calm]` / `[softly]` / `[measured]` | stability 0.6–0.75, `speed` 0.95 | `[calm]` and `[softly]` appear in docs and blog examples |

Free-form tags are allowed [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue]. The suggested stability, style and speed values are [unverified] starting points to tune.

Design choices:
- **Recommendation.** Replace the `emotion` enum with a free-text **`delivery`** field, for example `"warm, measured"`. The BFF renders it as `[warm, measured]` at the start of each clip on v3/v4 and drops it on v2/Flash.
- Keep a mapping layer so legacy presets with `emotion: "happy"` still work.
- Never send a tag to a non-v3/v4 model ([§1.2](#12-capability-matrix), note 6).

### 5.4 Mapping table: MiniMax interjections → ElevenLabs

MiniMax toolbar interjections are listed at `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/constants.ts:108`. The callbot keeps `(laughs)`-style interjections (`/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/transcript_sanitizer.py:176-178`).

| MiniMax | ElevenLabs v4/v3 | Source / confidence |
|---|---|---|
| `(sighs)` | `[sighs]` | [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices] |
| `(laughs)` | `[laughs]` | verified, same page |
| `(gasps)` | `[gasps]` | [verified: https://elevenlabs.io/blog/v3-audiotags] |
| `(inhale)` | `[inhales deeply]` | verified, Enhance prompt in best practices |
| `(exhale)` | `[exhales]` | verified, best practices |
| `(humming)` | `[humming]` / `[hums]` | [unverified] free-form |

On v2/Flash these must be **stripped**, or the model will read or garble them.

---

## 6. Pauses

| Model | Mechanism | Limits | Source |
|---|---|---|---|
| Multilingual v2, Flash v2, Flash v2.5 | SSML `<break time="1.5s" />`. Time in seconds; "an exact and natural pause", not raw silence. | **Up to 3 s** per break. "Too many break tags … can cause instability" (speed-up, artifacts). No numeric count limit is documented. | [verified: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-can-i-add-pauses] [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices] |
| v4, v3 | **No SSML.** Use `[pause]`, `[short pause]`, `[long pause]`, `[Brief pause]`, ellipses `…`, line breaks, dashes. | Not exact. Ellipses add hesitation. | [verified: https://elevenlabs.io/docs/help-center/technical/do-pauses-and-ssml-phoneme-tags-work-with-the-api] [verified: https://elevenlabs.io/blog/v3-audiotags] |
| All | Punctuation: `-` / `—` for short pauses, `-- --` for longer ones | "less consistent" | [verified: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-can-i-add-pauses] |

Whether `<break>` needs `enable_ssml_parsing=true` on the TTS WebSocket is not documented. The docs mention that flag only for phoneme dictionaries [unverified]. Test it.

**Mapping MiniMax `<#x#>`** (pattern `<#[0-9]+(?:\.[0-9]+)?#>`, `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/transcript_sanitizer.py:51`; toolbar inserts `<#0.4#>` at `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/TextArtifactToolbar.tsx:11`):

| MiniMax | v2 / Flash | v4 / v3 |
|---|---|---|
| `<#x#>` with x ≤ 3 | `<break time="x s" />` | Use the thresholds below |
| `<#x#>` with x > 3 | Clamp to 3 s, or split into two requests and concatenate | Same thresholds |

v4 / v3 thresholds:
- x < 0.5: `…`
- 0.5 ≤ x < 1.5: `[short pause]`
- x ≥ 1.5: `[long pause]`

**Sanitizer conflict.** `_SPEECH_MARKUP_TAG_PATTERN = r"<\s*/?\s*[a-zA-Z!][^>]*>"` (`transcript_sanitizer.py:52`) treats any `<break …/>` in callbot output as fatal markup (`:116-123`). The sanitizer has to allow-list `<break time="…"/>`. A cleaner design: have the LLM emit a provider-neutral marker (keep `<#x#>`) and translate it per model at the edge.

---

## 7. Pronunciation

### 7.1 Inline control per model

| Mechanism | Models | Syntax | Source |
|---|---|---|---|
| Native inline IPA | `eleven_v4` | IPA in forward slashes, best wrapped in quotes: `The term "/ˌbaɪoʊˈkemɪstri/" refers…`. The IPA **replaces** the word; it is not appended. | [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices] |
| SSML `<phoneme>` | `eleven_flash_v2` (help center also lists `eleven_turbo_v2`); **English only**; one word per tag | `<phoneme alphabet="cmu-arpabet" ph="M AE1 D IH0 S AH0 N">Madison</phoneme>` or `alphabet="ipa"`. CMU Arpabet is "more reliable"; stress markers matter. | [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices] [verified: https://elevenlabs.io/docs/help-center/technical/do-pauses-and-ssml-phoneme-tags-work-with-the-api] |
| Respelling | all | e.g. "trapezIi", capitals, dashes, apostrophes | [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices] |

### 7.2 Pronunciation Dictionaries API

| Endpoint | Purpose | Source |
|---|---|---|
| `POST /v1/pronunciation-dictionaries/add-from-file` (multipart: `name`, `file` .pls, `description?`, `workspace_access?`) | Create from a W3C PLS lexicon | [verified: https://elevenlabs.io/docs/api-reference/pronunciation-dictionaries/create-from-file] |
| `POST /v1/pronunciation-dictionaries/add-from-rules` (`rules[]`, `name`, `description?`, `workspace_access?`) | Create from JSON rules | [verified: https://elevenlabs.io/docs/api-reference/pronunciation-dictionaries/create-from-rules] |
| `POST /v1/pronunciation-dictionaries/{id}/add-rules` | Add rules; replaces rules with the same `string_to_replace`. Returns a **new `version_id`**. | [verified: https://elevenlabs.io/docs/api-reference/pronunciation-dictionaries/rules/add] |
| `POST /v1/pronunciation-dictionaries/{id}/remove-rules` (`rule_strings[]`) | Remove rules; returns a new version | [verified: https://elevenlabs.io/docs/api-reference/pronunciation-dictionaries/rules/remove] |
| `POST /v1/pronunciation-dictionaries/{id}/set-rules` | Replace all rules at once (added 2026-03) | [verified: https://elevenlabs.io/docs/api-reference/pronunciation-dictionaries/rules/set] |
| `GET /v1/pronunciation-dictionaries/{id}` | Metadata, `latest_version_id`, and the full `rules[]` (since 2026-02) | [verified: https://elevenlabs.io/docs/api-reference/pronunciation-dictionaries/get] |
| `GET /v1/pronunciation-dictionaries` (`include_archived`, default true) | List | [verified: https://elevenlabs.io/docs/changelog/2026/7/20.md] |
| `PATCH /v1/pronunciation-dictionaries/{id}` (`archived`, `name`) | Rename or archive without a new version | [verified: https://elevenlabs.io/docs/api-reference/pronunciation-dictionaries/update] |
| `GET /v1/pronunciation-dictionaries/{id}/{version_id}/download` | Export the PLS | [verified: https://elevenlabs.io/docs/api-reference/pronunciation-dictionaries/download] |

Rule shapes [verified: https://elevenlabs.io/docs/api-reference/pronunciation-dictionaries/create-from-rules]:
- alias: `{type: "alias", string_to_replace, alias, case_sensitive (default true), word_boundaries (default true)}`;
- phoneme: `{type: "phoneme", string_to_replace, phoneme, alphabet ("ipa" | "cmu-arpabet"), case_sensitive, word_boundaries}`.

`case_sensitive` and `word_boundaries` were added in 2026-03 [verified: https://elevenlabs.io/docs/changelog/2026/3/2.md].

Rules and limits:
- **Model applicability.** "Pronunciation dictionary phoneme tags only work with eleven_v4, eleven_flash_v2 and eleven_v3 models. Other models skip dictionary phoneme tags". Use alias rules for those. Non-English IPA/CMU requires `eleven_v4` [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/pronunciation-dictionaries].
- **Matching.** The dictionary is searched "start to end and only the very first replacement is used" [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices].
- **Per request.** **Up to 3** locators per request, applied in order [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert].
- **On WebSockets.**
  - Locators are allowed only in the first message.
  - Matches "will only be respected within a provided chunk".
  - Phoneme dictionaries require `enable_ssml_parsing=true` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input] [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tts].

### 7.3 Mapping MiniMax inline IPA `word/(ipa)`

The toolbar inserts `word/(wɜːrd)` (`/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/TextArtifactToolbar.tsx:17`).

| Target model | Translation |
|---|---|
| `eleven_v4` | `word/(ipa)` becomes `"/ipa/"`. The word is replaced by its IPA in slashes. |
| `eleven_flash_v2` (English) | `<phoneme alphabet="ipa" ph="ipa">word</phoneme>` |
| `eleven_multilingual_v2` / `eleven_flash_v2_5` | No IPA. Use a pronunciation-dictionary **alias** rule (`word` → respelling), or respell inline. |

**Product opportunity.** Lorebook and character names are the main mispronunciation risk in roleplay. Two ways to cover them:
- one pronunciation dictionary per **adventure or world**, built from the lorebook (alias and phoneme rules), passed as one of the 3 locators;
- a server-side substitution step (alias only) that works on every model.

---

## 8. Missing knobs: pitch and volume

**Confirmed.** No `pitch` or `volume` parameter exists in TTS `voice_settings` (stability, use_speaker_boost, similarity_boost, style, speed only), in the TTS WebSocket `RealtimeVoiceSettings`, or in TTD `settings` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert] [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input] [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert].

Alternatives:

| Need | Option | Notes / source |
|---|---|---|
| Different pitch or timbre | Choose a different base voice (voice library) | The idiomatic ElevenLabs approach: "Voice selection is most important" [verified: https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech] |
| | **Voice Remix** `POST /v1/text-to-voice/{voice_id}/remix` with `voice_description` such as "lower, deeper voice" | Changes "gender, accent, speaking style, pacing" of owned or default voices and creates a **new voice id** [verified: https://elevenlabs.io/docs/api-reference/text-to-voice/remix] [verified: https://elevenlabs.io/docs/overview/capabilities/voice-remixing] |
| | **Voice Design** `POST /v1/text-to-voice/design` (`model_id` **defaults to `eleven_multilingual_ttv_v2`**; `eleven_ttv_v3` is the other allowed value; *corrected during verification*) | Creates a new voice from a description [verified: https://elevenlabs.io/docs/api-reference/text-to-voice/design]. Caveat for the studio: "Voice Design voices work with Eleven v4, but they may not be as performative or sound as good as with earlier models" [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4] *(added during verification)*. |
| | Post-process pitch shift (ffmpeg `rubberband`, or `asetrate` + `atempo`) | Audible artifacts; not possible on the streaming path without re-encoding [unverified] |
| Loudness of a voice | `loudness` (-1..1, 0 ≈ -24 LUFS, default 0.5) exists **only at voice creation** (design/remix) | [verified: https://elevenlabs.io/docs/api-reference/text-to-voice/design] |
| Per-clip volume (e.g. "thoughts" at 60%) | **Client gain** (`HTMLAudioElement.volume` or a Web Audio `GainNode`) driven by segment metadata | Lossless, free, reversible [unverified: standard Web API] |
| | Server-side gain or loudness normalization (ffmpeg `loudnorm`, `volume=0.6`) before storing the MP3 | Re-encode cost. Good for consistent loudness across voices from different sources [unverified]. |
| | A delivery tag: `[whispers]` / `[softly]` / `[quietly]` | Semantic and v3/v4 only. Changes timbre, not just level. |

Mapping:
- **MiniMax `pitch` (-12..12 semitones):** cannot be carried over. Migrate each preset with pitch ≠ 0 to a different voice, or a remixed voice.
- **MiniMax `vol` (0..10]:** becomes client playback gain. The thoughts dimming (`vol*0.6`, floor 0.5, `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:1129-1134`) becomes `segment.kind === 'thought'` → `[whispers]`/`[softly]` on v3/v4, plus client gain around 0.7.

---

## 9. Language

- **Semantics.** `language_code` is ISO 639-1, "used to enforce a language for the model and text normalization". Unsupported codes "will be ignored", and the parameter is "not supported for multilingual_v2 models" [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert] [verified: https://elevenlabs.io/docs/changelog/2026/6/29.md].
- **Coverage.** The 2025-09-08 changelog says "All Text to Speech models now support language codes" [verified: https://elevenlabs.io/docs/changelog/2025/9/8.md]. The 2026-06-29 note narrows that.
- **When it helps most.** For "short or ambiguous prompts, such as when the text includes only numbers", so the normalizer applies the right language rules [verified: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-do-i-select-the-language-and-accent].
- **Accent.** "The accent … comes from the voice you're using" on older models [verified: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-do-i-select-the-language-and-accent]. v4 instead speaks the target language natively when it differs from the voice's language [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4].

**Mapping MiniMax `language_boost`.** Values come from `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/constants.ts:92-105`. The default is `"auto"`: `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:32` and `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:740-742`.

| MiniMax `language_boost` | ElevenLabs `language_code` | Available on |
|---|---|---|
| `auto` | omit (null) | all |
| `English` | `en` | all |
| `Spanish` | `es` | all |
| `Chinese` | `zh` | all (v4 lists Mandarin and Cantonese separately; which code selects Cantonese is [unverified]) |
| `Japanese` | `ja` (plus optional `apply_language_text_normalization: true`, with high latency) | all |
| `Korean` | `ko` | all |
| `French` | `fr` | all |
| `German` | `de` | all |
| `Portuguese` | `pt` | all |
| `Russian` | `ru` | all |
| `Italian` | `it` | all |
| `Arabic` | `ar` | all |

"All" means every model listed in [§1.1](#11-current-tts-models). The model's language list is the authority [verified: https://elevenlabs.io/docs/overview/models].

Rules:
- Never send `language_code` to `eleven_multilingual_v2`. It is ignored, but drop it so cache keys stay clean.
- Whether v4 accepts ISO 639-1 codes or needs ISO 639-3 (its language list is printed in 639-3) is [unverified]. The parameter is documented as 639-1.

---

## 10. Text normalization, continuity and seed

### 10.1 Text normalization

`apply_text_normalization` takes `auto` (default), `on` or `off` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert]. Normalization "does add latency" [verified: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/why-are-numbers-dates-symbols-and-acronyms-not-properly-pronounced-or-spoken-in-the-correct-language].

- **Flash v2.5.** "By default, normalization is disabled for Flash v2.5 to maintain the low latency". Setting `on` is **Enterprise-only** for v2.5 models [verified: https://elevenlabs.io/docs/overview/models]. Flash reads "$1,000,000" as "one thousand thousand dollars"; Multilingual v2 reads it correctly [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices].
- **Conflicting statement.** The 2025-09-08 changelog says "Normalization has been enabled for Eleven v3, Flash, and Turbo models" [verified: https://elevenlabs.io/docs/changelog/2025/9/8.md]. Test this with digits.
- **Recommended mitigation for real-time.** Have the LLM **write numbers, dates, currencies and abbreviations as words**. ElevenLabs publishes a ready prompt block and regex examples for this [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices].
- **Impact on magic-worlds.** The callbot leaves digits to MiniMax provider-side normalization (`text_normalization_mode` at `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:753`; docstring at `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/transcript_sanitizer.py:176-178`). With Flash v2.5 this regresses unless the callbot prompt normalizes numbers.

### 10.2 Continuity and request stitching

| Mechanism | Endpoint | Limits | Source |
|---|---|---|---|
| `previous_text` / `next_text` | TTS HTTP | No length limit documented | [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert] |
| `previous_request_ids` / `next_request_ids` | TTS HTTP | **Max 3**; override the text fields; best with the same model; IDs must be **≤ 2 hours old**; a streamed response must be **fully read** before its ID can condition another request; unavailable with `enable_logging=false`; "not available for the `eleven_v3` model" | [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/request-stitching] |
| `previous_text` / `future_text`, request ids | TTD HTTP | Text **≤ 100 characters**; 3 ids; "Not supported by every model" | [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert] |

**For multi-segment narration** (narrator → character A → narrator…, one job per segment today: `00_current_tts_review.md`, path A):
- **Same-voice segments.** `previous_request_ids` gives prosodic continuity, for example consecutive narrator paragraphs. This needs the earlier segment to finish first, which serializes those jobs.
- **Different-voice segments.** Pass neighbouring text as `previous_text` / `next_text` (no serialization) so the line reacts to its context. For example, a reply to a shout can sound defensive. Do not pass another voice's request id; the docs speak of continuity "when concatenating together multiple generations" of the same voice [unverified interpretation].
- **Regenerating one bad clip.** Pass `previous_request_ids=[clip n-1]` and `next_request_ids=[clip n+1]`. This is the documented use case for `next_request_ids` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert]. It requires storing `request-id` per segment.
- **Whole turn in one TTD request.** `/v1/text-to-dialogue/with-timestamps` returns `voice_segments[].dialogue_input_index` [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps]. One request could render a whole turn (≤ 10 voices, ≤ 2,000 characters) as one coherent dialogue, with segment boundaries for the UI. The trade-off: one shared `settings` object for all voices, so per-character stability is lost, and retries are all-or-nothing.

### 10.3 Seed

`seed` is an integer, 0..4294967295 (TTD WS minimum 1). Determinism is "best effort … not guaranteed" [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert] [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket].

Use a stable seed derived from `(message_id, segment_index)` so that cache misses and retries sound close to the original. Include the seed in the reuse hash (`voice_signature_sha256`, `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:104-119`). That hash must also gain `model_id`, `output_format` and the new settings fields.

---

## 11. Character limits and chunking

| Surface | Limit | Source |
|---|---|---|
| `eleven_v4` TTS | 10,000 characters per request (about 10 min) | [verified: https://elevenlabs.io/docs/overview/models] |
| `eleven_v3` TTS | 5,000 | same |
| `eleven_multilingual_v2` | 10,000 | same |
| `eleven_flash_v2_5` | 40,000 | same |
| `eleven_flash_v2` | 30,000 | same |
| `eleven_turbo_v2_5` / `eleven_turbo_v2` (deprecated) | 40,000 / 30,000 | [verified: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/whats-the-maximum-amount-of-characters-and-text-i-can-generate] |
| Text to Dialogue (any model) | Keep **≤ 2,000 total** across `inputs[]`; ≤ 10 unique voices | [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue] |
| Runtime authority | `maximum_text_length_per_request` from `GET /v1/models` | [verified: https://elevenlabs.io/docs/api-reference/models/list] |
| Over-limit error | `text_too_long` (validation_error); legacy `max_character_limit_exceeded` (400) | [verified: https://elevenlabs.io/docs/eleven-api/resources/errors] [verified: https://elevenlabs.io/docs/help-center/technical/api-error-code-400-or-401] |

The current per-clip cap is `min(TTS_MAX_TEXT_CHARS, 3000)` (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:155,930-934`). That is below every TTS model limit, so per-segment HTTP calls need no extra chunking. Today one over-limit clip **rejects the whole turn**. With ElevenLabs it can be split instead.

Recommended chunking for long text [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech]:
- split on paragraph, then sentence boundaries;
- stitch with `previous_request_ids` on v2/Flash/v4, or with `previous_text` / `next_text`;
- stream for playback.

Keep chunks well under the limit, around 800–1,500 characters. Very long single generations drift, and Multilingual v2 is "most stable on long-form generations" [verified: https://elevenlabs.io/docs/overview/models]. The chunk size itself is [unverified] guidance.

---

## 12. Error model and retries

### 12.1 Error body

```json
{"detail": {"type": "validation_error", "code": "invalid_parameters",
            "message": "…", "status": "invalid_parameters",
            "request_id": "3c807fc4…", "param": "keyterms"}}
```

`status` is a "legacy field that is no longer used, instead use the `code` property" [verified: https://elevenlabs.io/docs/eleven-api/resources/errors]. FastAPI-style 422 bodies are `detail: [{loc, msg, type}]` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert]. Parse both shapes.

### 12.2 Types, codes and retry policy

| HTTP | `type` | TTS-relevant `code` (new) | Legacy `detail.status` seen in help center | Retry? | magic-worlds category (`TtsErrorCategory`) |
|---|---|---|---|---|---|
| 400 | `validation_error` | `text_too_long`, `text_too_short`, `empty_text`, `invalid_text`, `invalid_parameters`, `missing_required_field`, `invalid_voice_settings`, `invalid_voice_id`, `unsupported_model`, `invalid_output_format` | `max_character_limit_exceeded`; `model_can_not_do_text_to_speech` [secondary: https://community.make.com/t/elevn-labs-error-how-do-i-fix-it/70957] | No | `invalid` |
| 400 | `invalid_request` | `bad_request`, `malformed_json`, `invalid_content_type`, `request_too_large` | | No | `invalid` |
| 401 | `authentication_error` | `invalid_api_key`, `missing_api_key`, `invalid_authorization_header`, `unauthorized` | `invalid_api_key`; `detected_unusual_activity` (free tier abuse block) | No; alert ops | `unavailable` (config) |
| 402 | `payment_required` | `insufficient_credits` | `quota_exceeded` | No; alert ops | `unavailable` / quota |
| 403 | `authorization_error` | `voice_access_denied`, `model_access_denied`, `feature_not_available`, `subscription_required`, `insufficient_permissions` | | No | `invalid` (voice) / `unavailable` |
| 404 | `not_found` | `voice_not_found`, `model_not_found`, `pronunciation_dictionary_not_found`, `history_item_not_found` | `voice_not_found` | No; mark the voice broken | `invalid` |
| 409 | `conflict` | `already_processing`, `concurrent_modification` | | Yes (Voice Design 409: "Retry the request") | `rate_limited` |
| 422 | (FastAPI validation) | | `value_error` | No | `invalid` |
| 429 | `rate_limit_error` | `rate_limit_exceeded` | | Yes, **exponential backoff** | `rate_limited` |
| 429 | `rate_limit_error` | `concurrent_limit_exceeded` | `too_many_concurrent_requests` | Yes, but **wait for in-flight requests**; queue rather than hammer | `rate_limited` |
| 429 | `rate_limit_error` | `system_busy` | `system_busy` | Yes; "if you retry the request, it will succeed" | `unavailable` |
| 500 | `internal_error` | `internal_error` | | Yes, limited | `unavailable` |
| 503 | `service_unavailable` | `service_unavailable`, `maintenance` | | Yes, with backoff | `unavailable` |

Sources for the rows:
- Types and codes: [verified: https://elevenlabs.io/docs/eleven-api/resources/errors].
- Legacy statuses: [verified: https://elevenlabs.io/docs/help-center/technical/api-error-code-400-or-401], [verified: https://elevenlabs.io/docs/help-center/technical/api-error-code-429], [verified: https://elevenlabs.io/docs/help-center/technical/api-error-code-422].
- `detected_unusual_activity`: [verified: https://elevenlabs.io/docs/help-center/account/general/what-does-unusual-activity-detected-free-tier-usage-disabled-if-you-are-using-proxy-vpn-you-might-need-to-purchase-a-paid-plan-to-not-trigger-our-abuse-detectors-mean].
- Voice Design 409: [verified: https://elevenlabs.io/docs/changelog/2026/9/28.md].

The "magic-worlds category" column is a proposal.

There is **no documented content-moderation error code** for TTS. MiniMax's `content_blocked` (1026/1027, `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:20`) has no known ElevenLabs equivalent [unverified]. Keep the category; it can be removed later.

**WebSocket errors:**
- TTD WS sends `{message, error, code, param}` and then closes with `code` [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket].
- A TTD WS over the session cap is rejected with `too_many_concurrent_requests` [verified: https://elevenlabs.io/docs/overview/models].

**Recommended backoff policy.** This replaces the current 10–50 ms retries on rate-limit codes (`/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:17-25`), which `00_current_tts_review.md` §3.12 flags as a duplicate-charge risk.
- Retry only `429/rate_limit_exceeded`, `429/system_busy`, `5xx` and network errors **before any audio byte was received**. Once streaming has started, do not retry the same request. Fail the segment, or re-request with `previous_request_ids` continuity.
- Use exponential backoff with full jitter: base 500 ms, factor 2, cap 8 s, at most 3 attempts. Honor `Retry-After` if present, though it is [unverified] that ElevenLabs sends it.
- For `concurrent_limit_exceeded`, re-queue behind a **process-wide semaphore** sized from `maximum-concurrent-requests`, instead of sleeping and retrying.
- Never retry 400/401/402/403/404/422.
- Charge or refund based on the presence of `character-cost`. ElevenLabs bills per request regardless of the client outcome; free API regenerations do not exist ("Free regenerations … are not available via the API") [verified: https://elevenlabs.io/docs/help-center/account/general/do-i-use-quota-on-every-generation].

---

## 13. Latency, routing and concurrency

### 13.1 Published latency

| Figure | Value | Source |
|---|---|---|
| Flash v2/v2.5 model inference | about 75 ms (excluding network and application) | [verified: https://elevenlabs.io/docs/overview/models] |
| v4 Turbo median inference | about 100 ms | [verified: https://elevenlabs.io/docs/overview/models] |
| v3 Conversational | about 280 ms | same |
| Flash + WebSocket TTFB by region | NA, EU, SE Asia: **100–150 ms**; South Asia, NE Asia: 150–200 ms | [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization] |
| Network round-trip | 20–200 ms, depending on distance | [verified: https://elevenlabs.io/docs/eleven-api/concepts/latency] |
| v4, v3, Multilingual v2 TTFB | not published | [unverified] |

Latency guidance [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization] [verified: https://elevenlabs.io/docs/eleven-api/concepts/latency]:
- use Flash models;
- stream;
- stay close to the region;
- prefer default, synthetic and IVC voices over PVC, which are slower. `use_pvc_as_ivc` can reduce PVC latency.

### 13.2 Routing

- `api.elevenlabs.io` is globally routed to the US, Netherlands or Singapore.
- Check the `x-region` header.
- `api.us.elevenlabs.io` pins to the US.
- The old `api-global-preview.elevenlabs.io` is obsolete. It was deprecated on 2026-02-09 [verified: https://elevenlabs.io/docs/changelog/2026/2/9.md] *(date added during verification)*.

[verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization]

Residency hosts are Enterprise and use separate accounts [verified: https://elevenlabs.io/docs/overview/administration/data-residency]. **Practical point.** The BFF's host location matters more than the end user's, because every request goes BFF → ElevenLabs. Pick the region nearest the BFF.

### 13.3 Connection reuse

- For WebSockets, ElevenLabs recommends "one WebSocket connection for each end-user session" and multiple contexts inside it [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/multi-context-web-socket].
- For HTTP, use a single shared `httpx.AsyncClient`/`aiohttp` session with keep-alive and HTTP/2, so per-request TLS handshakes are avoided [unverified: general practice; not stated by ElevenLabs].

### 13.4 Concurrency limits (standard HTTP and TTS WS generation time)

| Plan | Multilingual v2 | Flash | Priority |
|---|---|---|---|
| Free | 2 | 4 | 3 |
| Starter | 3 | 6 | 4 |
| Creator | 5 | 10 | 5 |
| Pro | 10 | 20 | 5 |
| Scale | 15 | 30 | 5 |
| Business | 15 | 30 | 5 |
| Enterprise | Elevated | Elevated | 6 |

[verified: https://elevenlabs.io/docs/overview/models]

Notes:
- Over the limit, requests "are processed in a queue … typically only adds ~50ms" (same page). Yet the errors page documents a 429 `concurrent_limit_exceeded` [verified: https://elevenlabs.io/docs/eleven-api/resources/errors]. Handle both.
- The marketing pricing table lists Business at 25 concurrent requests [verified: https://elevenlabs.io/pricing], which conflicts with the 15 above. The 429 help article also says Business is 15 [verified: https://elevenlabs.io/docs/help-center/technical/api-error-code-429]. Plan for 15 and read `maximum-concurrent-requests` at runtime.
- Which column v4 and v4 Turbo fall into is [unverified]. Read `concurrency_group` from `GET /v1/models`.
- Rule of thumb: "a concurrency limit of 5 can typically support up to approximately 100 simultaneous audio broadcasts" [verified: https://elevenlabs.io/docs/overview/models].

---

## 14. Codebase impact: what breaks when MiniMax is removed

| # | Current assumption | Location | ElevenLabs reality | Action |
|---|---|---|---|---|
| 1 | Call audio frames are 32 kHz mono MP3 | `/home/andres/WebstormProjects/magic-worlds/src/shared/types/voice.types.ts:165-173` (`sample_rate: 32000`), `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/delivery.py:349-353`, `streaming_tts_minimax.py:22`, call asset `engine.py:2394` | No MP3 at 32 kHz | Widen the contract to `sample_rate: 22050 \| 24000 \| 44100`. The MSE `audio/mpeg` player itself is unaffected. |
| 2 | Narration and preview audio come back as **hex** in JSON | `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:27`; preview returns hex (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:99-118`); `src/features/admin/voices/hexAudio.ts:10-26` | Binary bytes, or base64 in the timestamp and WS variants | Drop hex validation (this also removes the event-loop-blocking hex passes, `00_current_tts_review.md` §3.11). Return preview audio as `audio/mpeg` bytes or base64. |
| 3 | `<#x#>` pauses and `(laughs)` are legal speech | `transcript_sanitizer.py:51,170-228`; `TextArtifactToolbar.tsx:11-17`; `constants.ts:30,108` | `<break>` only on v2/Flash; `[tags]` only on v3/v4 | Use a provider-neutral marker plus per-model translation. Allow `<break>` / `[…]` in the sanitizer, or translate after it. |
| 4 | Brackets are stripped or are markup | `_EMPTY_BRACKETS`, `_MD_LINK` (`transcript_sanitizer.py:81,92`) | Audio tags are `[text]` | Make sure `[whispers] …` is not eaten as a Markdown link fragment. Tag text must survive `normalize_text_for_tts`. |
| 5 | Provider normalizes digits | `streaming_tts_minimax.py:24-26,753` | Flash v2.5 normalization is off by default, and `on` is Enterprise-only | Make the LLM normalize numbers ([§10.1](#101-text-normalization)), or use `eleven_v4_turbo`, whose normalization behavior is [unverified]. |
| 6 | Recipe = speed 0.5–2, vol (0,10], pitch ±12, emotion enum, language_boost | `/home/andres/PycharmProjects/magic-worlds-api/src/models/character.py:17-24`; `src/shared/types/voicePreset.types.ts:8-18`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:54-68` | speed 0.7–1.2 on v2/Flash only; no vol or pitch; emotion → tags; language_code | New recipe schema plus a migration ([§15.4](#154-parameter-mapping-characterpreset-recipe-charactervoice--voicepreset)) |
| 7 | One model, `speech-2.8-turbo` | `registry.py:24-26`; `streaming_tts_minimax.py:21`; admin `constants.ts:60-63` | Model is a per-surface choice | Registry entries per surface (narration / call / preview), driven by `GET /v1/models` |
| 8 | Language derived from the voice id prefix | `src/features/admin/voices/voiceLanguage.ts`; `constants.ts:110-137` | ElevenLabs voice ids are opaque. Language lives in `labels` and `verified_languages[]` | Read language from voice metadata [verified: https://elevenlabs.io/docs/api-reference/voices/search] |
| 9 | Reuse hash = voice id + recipe | `registry.py:104-119` | Output also depends on model, format, settings, seed and dictionary version | Extend the hash |
| 10 | Admin lab formats mp3/wav/flac × 6 rates | `/home/andres/PycharmProjects/magic-worlds-api/src/models/admin_voice.py:41-53,95-130` | A fixed `output_format` enum, no FLAC | Replace with an `output_format` select ([§15.5](#155-parameter-mapping-admin-synth-lab-synthsettings--admin-test-request)) |

---

## 15. Recommendations for magic-worlds

### 15.1 Model choice per surface

| Surface | Primary | Fallback / alternative | Rationale |
|---|---|---|---|
| **(a) Chat narration** (stored, multi-voice, expressive) | **`eleven_v4`** via `POST /v1/text-to-speech/{voice_id}`, one request per segment as today | `eleven_multilingual_v2`, for long-form stability or if v4 behavior regresses ("its behavior may shift over time"). Alternative architecture: one `POST /v1/text-to-dialogue/with-timestamps` per turn. | v4 is the most expressive, uses audio tags (narrator mood, whispered thoughts), has the best IVC fidelity and 90+ languages, and costs the same $0.08/1K as v2 and v3. Per-segment calls keep **per-character settings** and per-segment retry. TTD loses per-voice settings, but gives one coherent scene with `voice_segments`. Prototype both and A/B by ear. Keep the model id configurable, because v4 is two weeks old. |
| **(b) Realtime calls** (lowest latency) | **`eleven_flash_v2_5`** on the **multi-context TTS WebSocket** (`/multi-stream-input`): one socket per call, one context per assistant turn, `flush` at sentence end, `close_context` on barge-in, `auto_mode=true` or a reduced `chunk_length_schedule` | **`eleven_v4_turbo`** on the **TTD WebSocket**: about 100 ms median, audio tags, same voice quality family as narration. Gate behind a flag until the reference and guide agree that v4 is supported, and until barge-in (close or reopen the socket, or TTD multi-context) and the 20 s `keep_alive` are proven. On that socket only `stability` can be set, once per connection, so a character recipe reduces to voice + stability + tags *(added during verification)*. | Flash v2.5 is the documented low-latency path (75 ms; 100–150 ms TTFB in NA/EU). It has a mature protocol and a real **cancel** (`close_context`), which MiniMax lacks. It costs $0.04/1K. Its weaknesses are number normalization ([§10.1](#101-text-normalization)) and no tags. v4 Turbo would unify narration and call voices (same expressive family, tags) at the same $0.04/1K. |
| **(c) Previews and catalog** | Catalog browsing: the voice's **`preview_url`** (and `verified_languages[].preview_url`) from `GET /v2/voices`. **No synthesis cost.** | Custom-text preview: the **same model as the target surface** (`eleven_v4` for narrator and character voices) so users hear what they will get; `eleven_flash_v2_5` for cheap quick auditions | Removes most paid preview calls. Still close the "unmetered preview" hole (`00_current_tts_review.md` §3.1): a rate limit, a per-user daily cap and a short text cap (≤ 200 characters). |

Sources for this table:
- `preview_url`: [verified: https://elevenlabs.io/docs/api-reference/voices/search].
- Prices: [verified: https://elevenlabs.io/pricing/api].
- Protocols and limits: see [§2.7](#27-tts-websockets-non-v3v4-models) and [§2.8](#28-text-to-dialogue-v3v4-multi-voice).

### 15.2 Output formats

| Use | Format |
|---|---|
| Stored narration and call-transcript assets | `mp3_44100_128`. Keep `Content-Type: audio/mpeg`, Range serving and the `tts_asset` schema. Record `output_format`, `model_id` and `request_id` on the asset. |
| Call streaming | `mp3_44100_64` (or `mp3_22050_32` if bandwidth matters), with the frame contract changed from 32000. Keep MSE `audio/mpeg`. Later option: `pcm_24000` with an AudioWorklet for sample-accurate barge-in. |
| Admin lab | `mp3_44100_128` (default), `mp3_44100_192` (Creator+), `wav_44100` (Pro+) / `wav_24000`, `pcm_24000`. FLAC is no longer offered. |

### 15.3 Best practices to adopt

1. **The BFF owns model capabilities.** Build a table from `GET /v1/models` plus hard-coded rules from [§1.2](#12-capability-matrix). Strip unsupported settings and markup per model: no `speed`/`style` on v4, no tags on v2/Flash, no `<break>` on v3/v4, no `language_code` on Multilingual v2.
2. **Keep a neutral text format** in LLM output and storage (`<#0.4#>`, `(laughs)`, `word/(ipa)`, or a new neutral form). Translate per model at send time. This keeps chat history provider-agnostic.
3. **LLM-side text normalization** for numbers and abbreviations in the callbot and narration prompts. Reuse ElevenLabs' published normalization prompt and "Enhance" tag prompt [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices].
4. **Seeded, idempotent jobs.** Use a stable `seed`. Extend the reuse hash with `model_id`, `output_format`, settings, `language_code`, dictionary version and seed. Store `request-id` for stitching and regeneration.
5. **Observability.** Log `request-id`, `character-cost`, `x-region` and concurrency headers. Reconcile `character-cost` with the membership quota. *(Corrected during verification.)* The documented rates:
   - Multilingual v2: 1 credit per character.
   - Flash/Turbo: "between 0.5 and 1 credit per character" for API usage [verified: https://elevenlabs.io/pricing].
   - Eleven v3: 1 credit per character on the website, with API generations "discounted" [verified: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-much-does-it-cost-to-generate-using-eleven-v3-alpha].
   - Eleven v4 / v4 Turbo: no per-character credit rate is published. Only USD per 1K characters is listed [unverified for credits].

   Treat the `character-cost` header and `model_rates.character_cost_multiplier` from `GET /v1/models` as the source of truth. Remember that Voice Library multipliers come on top ([§18](#18-added-during-verification-voice-slots-voice-library-rules-and-other-gaps)).
6. **Concurrency.** Size one process-wide semaphore from `maximum-concurrent-requests`, with separate pools for HTTP narration and call sockets. TTD WebSockets use a separate session pool.
7. **Retries.** Use the policy in [§12.2](#122-types-codes-and-retry-policy). Never retry after streaming starts.
8. **Privacy.** `enable_logging=true` (the default) keeps generations in ElevenLabs history. Zero retention is Enterprise-only and disables stitching [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert]. Roleplay text is sensitive, so consider periodic history cleanup through the History API. `DELETE /v1/history/{history_item_id}` returns `{status: "ok"}` [verified: https://elevenlabs.io/docs/api-reference/history/delete]. How long ElevenLabs retains data after deletion is [unverified].
9. **Pronunciation.** One dictionary per world or adventure, generated from lorebook names. Use alias rules, which work on every model, and phoneme rules for v4.
10. **Plan gating.** `mp3_44100_192` needs Creator+. 44.1 kHz PCM/WAV needs Pro+. "The voice library is not available via the API to free tier users" [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech]. Voice slots, voice-operation quotas, paid-only library voices and credit multipliers are in [§18](#18-added-during-verification-voice-slots-voice-library-rules-and-other-gaps) *(added during verification)*.

### 15.4 Parameter mapping: character/preset recipe (`CharacterVoice` / `VoicePreset`)

Current fields:
- `CharacterVoice {voice_id, speed, vol, pitch, emotion, language_boost, preset_id, preset_name}`: `/home/andres/PycharmProjects/magic-worlds-api/src/models/character.py:11-24` and `/home/andres/WebstormProjects/magic-worlds/src/shared/types/voicePreset.types.ts:8-18`;
- preset fields (`volume` instead of `vol`): `voicePreset.types.ts:20-36`;
- preview payload: `/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:23-34`.

| MiniMax field (range) | ElevenLabs target | v4 / v4 Turbo | v3 | Multilingual v2 / Flash | Migration rule |
|---|---|---|---|---|---|
| `voice_id` (MiniMax system or custom id, ≤ 256) | `voice_id` (path param; opaque ElevenLabs id) | ✅ | ✅ | ✅ | **No 1:1 id mapping.** Build a curated table `minimax_voice_id → elevenlabs_voice_id` from listening tests for global and seeded presets. Unmapped user voices fall back to a per-gender/age default and are flagged for the user. Validate ids against the ElevenLabs catalog (today only length is checked; `00_current_tts_review.md` §2). |
| `speed` (0.5–2.0, default 1) | `voice_settings.speed` (**0.7–1.2**, default 1) | ❌ (use tags `[slowly]`, `[rushed]`, `[drawn out]`) | ❌ | ✅ | Clamp to [0.7, 1.2]. On v3/v4, translate <0.9 to `[slowly]` and >1.1 to `[rushed]` in the delivery prefix, or drop it. |
| `vol` / preset `volume` ((0,10], default 1) | **No equivalent.** Client gain metadata (`playback_gain`), or a server `volume`/`loudnorm` post-process | — | — | — | Store as `playback_gain = clamp(vol, 0.25, 2.0)` [unverified scale] and apply in the player. Recommend loudness-normalizing all stored clips instead. |
| `pitch` (-12..12 semitones, default 0) | **No equivalent** | — | — | — | Drop. For presets with pitch ≠ 0, pick or remix a different voice (`/v1/text-to-voice/{id}/remix`). Optional offline pitch-shift is not recommended. |
| `emotion` (happy, sad, angry, fearful, disgusted, surprised, calm, auto) | Text prefix tag (v3/v4) or stability/style hints (v2/Flash) | ✅ via `[tag]` | ✅ via `[tag]` | ⚠️ via stability/style only | See [§5.3](#53-mapping-table-minimax-emotion--elevenlabs). Replace the enum with a free-text `delivery` (e.g. "warm, wry"), keeping the legacy enum mapping. |
| `language_boost` (auto, English, Spanish…) | `language_code` (ISO 639-1) | ? | ✅ | ❌ on v2 (omit) / ✅ Flash | See [§9](#9-language). `auto` → omit. |
| *(none)* | `voice_settings.stability` (0–1, default 0.5) | ✅ | ✅ | ✅ | **New field.** Default 0.5. Expressive characters 0.3–0.4, narrators 0.6. |
| *(none)* | `voice_settings.similarity_boost` (0–1, 0.75) | ✅ on v4 (as "Similarity"); ❌ on v4 Turbo over the TTD WS, which accepts `stability` only *(corrected during verification)* | ❌ | ✅ | **New field.** Default 0.75. |
| *(none)* | `voice_settings.style` (0–1, 0) | ❌ | ? | ✅ | **New, advanced.** Default 0 (ElevenLabs advice). |
| *(none)* | `voice_settings.use_speaker_boost` (bool, true) | ? | ❌ | ✅ | **New, advanced.** Default true; false for lowest latency in calls. |
| *(none)* | `model_id` override | | | | Optional per preset (e.g. force `eleven_multilingual_v2` for a voice that misbehaves on v4). Default: the surface model. |
| *(none)* | `pronunciation_dictionary_locators` | ✅ | ✅ | alias only | Per world or adventure, not per voice |
| `preset_id`, `preset_name` | unchanged (app metadata) | | | | Keep |
| thoughts: `vol*0.6`, floor 0.5 (`route_chat.py:1129-1134`) | `[whispers]`/`[softly]` prefix (v3/v4) plus client gain around 0.7 | ✅ | ✅ | gain only | Rewrite `_dim_voice_for_thought` as `_thought_delivery` |

Proposed recipe shape (illustration, not code to apply):

```jsonc
// CharacterVoice v2 (provider: "elevenlabs")
{
  "provider": "elevenlabs",
  "voice_id": "JBFqnCBsd6RMkjVDRZzb",
  "model_id": null,                 // null = surface default
  "stability": 0.45,
  "similarity_boost": 0.75,
  "style": 0.0,
  "use_speaker_boost": true,
  "speed": 1.0,                     // honored on v2/Flash only
  "delivery": "warm, wry",          // rendered as [warm, wry] on v3/v4
  "language_code": null,            // ISO 639-1 or null
  "playback_gain": 1.0,             // replaces vol
  "preset_id": "…", "preset_name": "…"
}
```

### 15.5 Parameter mapping: admin synth lab (`SynthSettings` / admin test request)

The current lab is defined in `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/constants.ts:38-105` and `/home/andres/PycharmProjects/magic-worlds-api/src/models/admin_voice.py:95-130`.

| MiniMax lab control | Values today | ElevenLabs control | Values |
|---|---|---|---|
| `model` | `speech-2.8-hd`, `speech-2.8-turbo` | `model_id` | `eleven_v4` (≈ hd), `eleven_multilingual_v2`, `eleven_v3`, `eleven_flash_v2_5` (≈ turbo), `eleven_flash_v2`. Populate from `GET /v1/models` where `can_do_text_to_speech`. `eleven_v4_turbo` only if a TTS HTTP path is confirmed. |
| `audio_format` × `sample_rate` | mp3/wav/flac × 8000/16000/22050/24000/32000/44100 | single `output_format` | `mp3_22050_32`, `mp3_24000_48`, `mp3_44100_{32,64,96,128,192}`, `wav_{8000…48000}` (not on `/stream`), `pcm_*`, `opus_48000_*`, `ulaw_8000`, `alaw_8000`. Drop FLAC and MP3 at 32 kHz. |
| `emotion` | `''`/calm/happy/sad/angry/fearful/disgusted/surprised | Delivery tag insert (v3/v4) and `stability` slider | Free-text tags ([§5.2](#52-documented-audio-tags-non-exhaustive)) |
| `language_boost` | auto + 11 languages | `language_code` | ISO 639-1, or none |
| `speed` | 0.5–2 | `voice_settings.speed` | 0.7–1.2; disabled for v3/v4 |
| `vol` | (0,10] | — | Remove. Optional preview-only gain. |
| `pitch` | -12..12 | — | Remove |
| *(new)* | | `stability`, `similarity_boost`, `style`, `use_speaker_boost`, `seed`, `apply_text_normalization`, `language_code`, `pronunciation_dictionary_locators`, `previous_text`/`next_text` | Expose in an "Advanced" panel, gated per model |
| Toolbar: pause `<#0.4#>` | `TextArtifactToolbar.tsx:11` | `<break time="0.4s" />` (v2/Flash) / `[short pause]` or `…` (v3/v4) | Model-aware insert |
| Toolbar: interjections `(sighs)` … `(humming)` | `constants.ts:108` | `[sighs]`, `[laughs]`, `[gasps]`, `[inhales deeply]`, `[exhales]`, `[humming]` + `[whispers]`, `[shouting]`, `[sarcastic]`, `[curious]` | v3/v4 only; hide on v2/Flash |
| Toolbar: inline IPA `word/(wɜːrd)` | `TextArtifactToolbar.tsx:17` | v4: `"/wɜːrd/"`; `eleven_flash_v2`: `<phoneme alphabet="ipa" ph="wɜːrd">word</phoneme>`; others: "add to pronunciation dictionary" | Model-aware insert |
| Default test text `…<#0.4#> (sighs) …` | `constants.ts:29-30` | `…opens… [sighs] Speak carefully…` (v4) | |
| Hex audio decode | `hexAudio.ts` | Binary or base64 | Replace helper |

---

## 16. Open questions

1. **v4 on the plain TTS HTTP endpoint.** Is `eleven_v4` officially supported on `POST /v1/text-to-speech/{id}` and `/stream`? The help center and examples say yes; the launch changelog says "through the Text to Dialogue API". Is `eleven_v4_turbo` usable over HTTP at all, and what is its character limit?
2. **v4 on the TTD WebSocket.** Does the TTD WebSocket accept `eleven_v4` / `eleven_v4_turbo`? The guide says yes; the AsyncAPI reference says v3 only. What about the TTD multi-context WS?
3. **Unsupported settings on v3/v4.** Are `speed`, `style` and `use_speaker_boost` **rejected** (`invalid_voice_settings`) or silently ignored? The answer decides whether the BFF must strip them.
4. **Stitching on v4.** Does request stitching work on v4? The guide says it is unavailable on v3 but uses v4 in its sample. Do `previous_text` / `next_text` work on v3/v4 over TTS HTTP?
5. **Flash v2.5 normalization.** What is the actual default for `apply_text_normalization: auto`? The models page says disabled; the 2025-09 changelog says enabled. Can non-Enterprise plans use `on`?
6. **`language_code` on v4.** Is it supported on `eleven_v4` / `eleven_v4_turbo`, and are ISO 639-1 codes accepted (for example, how is Cantonese vs Mandarin selected)?
7. **Bracketed text on v2/Flash.** What happens when audio tags reach those models: spoken literally, ignored, or degraded audio?
8. **`<break>` on the TTS WebSocket.** Does it need `enable_ssml_parsing=true`?
9. **Response headers.** Confirm the exact set: `character-cost` vs `x-character-count`, `history-item-id`, and whether `Retry-After` is sent on 429.
10. **Concurrency pools.** Which pool (`concurrency_group`) do `eleven_v4` and `eleven_v4_turbo` count against? What is the real Business-plan limit (15 vs 25)?
11. **Opus container.** Ogg or WebM for `opus_48000_*`, for possible MSE use?
12. **Moderation.** Is there TTS content moderation for roleplay text (adult or violent fiction), and what error code does it return? MiniMax has 1026/1027.
13. **v3 stability values.** Are only discrete values accepted (0.0 / 0.5 / 1.0, "Creative/Natural/Robust"), or any float?
14. **Pricing after the promo.** v4 pricing after the launch promo ends on 2026-10-12: the page shows $0.08/1K standard, $0.022 promo. Confirm the plan, and whether the subscription "1 credit per character" also applies to v4 Turbo at 0.5.
15. **v4 maturity.** v4 "will keep evolving". Do we need a pinned model snapshot for reproducible narration? None is documented.

---

## 17. Sources

### Official ElevenLabs documentation (read 2026-10-12)

**Models and capabilities**
- https://elevenlabs.io/docs/llms.txt
- https://elevenlabs.io/docs/overview/models
- https://elevenlabs.io/docs/overview/capabilities/text-to-speech
- https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4
- https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices
- https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue
- https://elevenlabs.io/docs/overview/capabilities/voice-remixing
- https://elevenlabs.io/docs/overview/administration/data-residency
- https://elevenlabs.io/docs/eleven-api/choosing-the-right-model
- https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech

**Text to Speech API reference**
- https://elevenlabs.io/docs/api-reference/introduction
- https://elevenlabs.io/docs/api-reference/authentication
- https://elevenlabs.io/docs/api-reference/streaming
- https://elevenlabs.io/docs/api-reference/text-to-speech/convert
- https://elevenlabs.io/docs/api-reference/text-to-speech/stream
- https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps
- https://elevenlabs.io/docs/api-reference/text-to-speech/stream-with-timestamps
- https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input
- https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input

**Text to Dialogue API reference**
- https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert
- https://elevenlabs.io/docs/api-reference/text-to-dialogue/stream
- https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps
- https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket
- https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-multi-websocket

**Models, voices and voice settings API reference**
- https://elevenlabs.io/docs/api-reference/models/list
- https://elevenlabs.io/docs/api-reference/voices/settings/get-default
- https://elevenlabs.io/docs/api-reference/voices/settings/get
- https://elevenlabs.io/docs/api-reference/voices/settings/update
- https://elevenlabs.io/docs/api-reference/voices/search
- https://elevenlabs.io/docs/api-reference/text-to-voice/design
- https://elevenlabs.io/docs/api-reference/text-to-voice/remix

**Pronunciation dictionaries API reference**
- https://elevenlabs.io/docs/api-reference/pronunciation-dictionaries/create-from-file
- https://elevenlabs.io/docs/api-reference/pronunciation-dictionaries/create-from-rules
- https://elevenlabs.io/docs/api-reference/pronunciation-dictionaries/get
- https://elevenlabs.io/docs/api-reference/pronunciation-dictionaries/update
- https://elevenlabs.io/docs/api-reference/pronunciation-dictionaries/download
- https://elevenlabs.io/docs/api-reference/pronunciation-dictionaries/list
- https://elevenlabs.io/docs/api-reference/pronunciation-dictionaries/rules/set
- https://elevenlabs.io/docs/api-reference/pronunciation-dictionaries/rules/add
- https://elevenlabs.io/docs/api-reference/pronunciation-dictionaries/rules/remove

**Guides and concepts**
- https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/streaming
- https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/request-stitching
- https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/pronunciation-dictionaries
- https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tts
- https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/multi-context-web-socket
- https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets
- https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd
- https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization
- https://elevenlabs.io/docs/eleven-api/concepts/latency
- https://elevenlabs.io/docs/eleven-api/concepts/audio-streaming
- https://elevenlabs.io/docs/eleven-api/resources/errors

**Help center**
- https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-do-audio-tags-work-with-eleven-v3-and-v4
- https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/what-is-eleven-v4
- https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/what-is-eleven-v3-alpha
- https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-can-i-add-pauses
- https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-can-i-force-a-certain-pronunciation-of-a-word-or-name
- https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-do-i-select-the-language-and-accent
- https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-to-produce-emotions
- https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-much-does-it-cost-to-generate-using-eleven-v3-alpha
- https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/whats-the-maximum-amount-of-characters-and-text-i-can-generate
- https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/why-are-numbers-dates-symbols-and-acronyms-not-properly-pronounced-or-spoken-in-the-correct-language
- https://elevenlabs.io/docs/help-center/technical/api-error-code-400-or-401
- https://elevenlabs.io/docs/help-center/technical/api-error-code-422
- https://elevenlabs.io/docs/help-center/technical/api-error-code-429
- https://elevenlabs.io/docs/help-center/technical/do-pauses-and-ssml-phoneme-tags-work-with-the-api
- https://elevenlabs.io/docs/help-center/technical/how-much-does-it-cost-to-use-the-api
- https://elevenlabs.io/docs/help-center/technical/is-it-possible-to-get-a-time-stamped-transcript-of-the-audio-output
- https://elevenlabs.io/docs/help-center/technical/how-can-i-see-information-about-api-requests-for-my-account
- https://elevenlabs.io/docs/help-center/troubleshooting/what-audio-formats-do-you-support
- https://elevenlabs.io/docs/help-center/troubleshooting/what-characters-are-accepted-when-generating-audio
- https://elevenlabs.io/docs/help-center/account/general/do-i-use-quota-on-every-generation
- https://elevenlabs.io/docs/help-center/account/general/is-there-a-limit-to-how-many-credits-i-can-use-at-once
- https://elevenlabs.io/docs/help-center/account/general/what-does-unusual-activity-detected-free-tier-usage-disabled-if-you-are-using-proxy-vpn-you-might-need-to-purchase-a-paid-plan-to-not-trigger-our-abuse-detectors-mean
- https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-are-custom-rates-and-credit-multipliers

**Changelog**
- https://elevenlabs.io/docs/changelog/llms.txt (index)
- https://elevenlabs.io/docs/changelog/2025/6/8.md (v3 alpha)
- https://elevenlabs.io/docs/changelog/2025/8/20.md (v3 on the API)
- https://elevenlabs.io/docs/changelog/2025/9/8.md (`language_code` on all models; normalization)
- https://elevenlabs.io/docs/changelog/2025/9/29.md (v1 deprecation)
- https://elevenlabs.io/docs/changelog/2026/1/19.md (output_format expansion)
- https://elevenlabs.io/docs/changelog/2026/2/2.md (v3 GA; WAV on TTD)
- https://elevenlabs.io/docs/changelog/2026/2/9.md (`eleven_v3_conversational`)
- https://elevenlabs.io/docs/changelog/2026/2/16.md (dictionary rules in GET)
- https://elevenlabs.io/docs/changelog/2026/2/23.md (voice design loudness; speed description)
- https://elevenlabs.io/docs/changelog/2026/3/2.md (set-rules; case_sensitive / word_boundaries)
- https://elevenlabs.io/docs/changelog/2026/4/7.md (TTD settings model)
- https://elevenlabs.io/docs/changelog/2026/6/8.md (v1 removal 2026-07-09)
- https://elevenlabs.io/docs/changelog/2026/6/29.md (`language_code` clarification)
- https://elevenlabs.io/docs/changelog/2026/7/20.md (dictionary list include_archived)
- https://elevenlabs.io/docs/changelog/2026/9/28.md (Eleven v4 launch; TTD continuity; models API deprecations)
- https://elevenlabs.io/docs/changelog/2026/10/5.md (v4 default for agents; SDK v2.71.0)

**Pricing and blog**
- https://elevenlabs.io/pricing/api
- https://elevenlabs.io/pricing
- https://elevenlabs.io/blog/v3-audiotags

### Secondary sources
- https://elevenlabs.io/docs/best-practices/prompting (old v3 prompting URL, now redirects; Creative/Natural/Robust content seen only via web-search summary)
- https://community.make.com/t/elevn-labs-error-how-do-i-fix-it/70957 (`model_can_not_do_text_to_speech` report)
- Web-search summary of localized revisions of https://elevenlabs.io/docs/api-reference/introduction.md (`x-character-count` header variant)

### Codebase files (read-only)

**Baseline**
- `/home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/research/00_current_tts_review.md`

**Frontend**
- `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/constants.ts:14-108`
- `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/TextArtifactToolbar.tsx:5-17`
- `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/hexAudio.ts:10-26`
- `/home/andres/WebstormProjects/magic-worlds/src/features/voices/recipe.ts:1-18`
- `/home/andres/WebstormProjects/magic-worlds/src/shared/types/voicePreset.types.ts:8-60`
- `/home/andres/WebstormProjects/magic-worlds/src/shared/types/voice.types.ts:164-174`
- `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/audio/voicePlaybackBuffer.ts:261,345,613-617`

**Backend**
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:18-119,205-241`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:15-25`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:25`
- `/home/andres/PycharmProjects/magic-worlds-api/src/models/character.py:11-40`
- `/home/andres/PycharmProjects/magic-worlds-api/src/models/admin_voice.py:28-53,95-130`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:20-34,87-118`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:155,930-934,1129-1171`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:21-32,727-754`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/transcript_sanitizer.py:51-52,81,92,116-123,170-228`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/delivery.py:349-353`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:2318-2340,2394`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/sentence_buffer.py:17`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:25`

---

## 18. Added during verification: voice slots, Voice Library rules and other gaps

*Everything in this section was added during the 2026-10-12 verification pass.* These items affect the **voice catalog** and the **Voice Studio / admin voice console** directly, even though the voice-management APIs belong in a separate note.

### 18.1 Custom voice slots and voice operations per plan

| Plan | Custom voice slots (help center) | Custom voice slots (pricing page) | Voice operations / month | API concurrency (models page) |
|---|---|---|---|---|
| Free | 3 | 3 | 55 | 2 |
| Starter | 10 | 10 | 65 | 3 |
| Creator | 30 | 30 | 95 | 5 |
| Pro | 160 | 160 | 290 | 10 |
| Scale | 660 | 660 | 1,040 | 15 |
| Business | **660** | **2,200** | 1,040 | 15 (pricing page: 25) |

Sources:
- slots and voice operations [verified: https://elevenlabs.io/docs/help-center/account/general/how-many-voice-slots-do-i-get-per-tier-and-how-can-i-increase-it];
- the pricing-page "Custom voice slots" row [verified: https://elevenlabs.io/pricing];
- concurrency [verified: https://elevenlabs.io/docs/overview/models].

The two official pages disagree for Business (660 vs 2,200).

Rules that shape the catalog design [verified: same help-center article]:
- "Adding and editing voices are voice operations", with a monthly quota.
- Default and Legacy voices, and **voices saved from the Voice Library, do not take up custom voice slots**.
- Only cloned, designed and remixed voices count.

**Implication.** The admin console's design / clone / remix flow (today MiniMax `voice_design` / `voice_clone`) consumes scarce slots on one shared ElevenLabs account. A per-user "create my own voice" feature would exhaust 30–660 slots quickly. Keep user-facing Voice Studio presets as **recipes over shared voices** (as today over MiniMax system voices). Reserve slot-consuming creation for root/admin use, with a slot counter in the console.

### 18.2 Voice Library usage rules

| Rule | Detail | Source |
|---|---|---|
| Free tier | "The voice library is not available via the API to free tier users" | [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech] |
| Paid-only voices | Some library voices are restricted to paid subscribers, either by owner choice or because they carry a credit multiplier | [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/why-cant-i-use-some-voices-from-the-voice-library] |
| Credit multipliers | Legacy "custom rate" voices cost more: "if a voice has a 2x multiplier, generating audio will cost twice as many credits". New shares can no longer set custom rates. The multiplier depends on the owner's rate and the user's plan. | [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-are-custom-rates-and-credit-multipliers] [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/why-cant-i-use-some-voices-from-the-voice-library] |
| Notice period | An owner who stops sharing can set a notice period of 30 days to 2 years, or none. With none, access ends "immediately". During a notice period, `GET /v1/voices/{voice_id}` returns `disable_at_unix`. A voice-removal **webhook** can be configured. | [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-a-notice-period] |
| Live Moderation | Owners of shared PVCs can enable Live Moderation. Requests are then checked against "prohibited categories", which "may result in extra latency". | [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-live-moderation] |
| PVCs on v3 vs v4 | "PVCs are not fully optimized for Eleven v3 … if you'd like to use a Professional Voice Clone or a voice from the Voice Library, we recommend trying Eleven v4" | [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices] |

**Catalog recommendations.**
1. When curating the `minimax_voice_id → elevenlabs_voice_id` table ([§15.4](#154-parameter-mapping-characterpreset-recipe-charactervoice--voicepreset)), **exclude** library voices that have a credit multiplier, are paid-only beyond our plan, have no notice period, or have Live Moderation enabled. Live Moderation is a risk for mature roleplay text, and it adds latency.
2. Prefer **default voices** and voices **we own** (designed or cloned on our account) for anything persisted in character cards.
3. Run a daily job that checks `disable_at_unix` on every voice referenced by a character, preset or narrator. Subscribe to the voice-removal webhook, and flag affected characters in the UI before the voice disappears.
4. Bill users from the `character-cost` header, not from text length, so multipliers are charged correctly.

### 18.3 Other gaps found

| Item | Detail | Source |
|---|---|---|
| Pay-as-you-go | The API pricing page now offers a **Pay as you go** payment model next to subscriptions ("Pay only for what you use"). Starter is $6/month (first month $1). | [verified: https://elevenlabs.io/pricing/api] |
| Credit rollover | Unused subscription credits roll over for up to two months (balance cap 3× the monthly quota) while subscribed. Pay-as-you-go top-ups are separate. | [verified: https://elevenlabs.io/pricing] |
| Free regenerations | "only available via the website. They are not available via the API" | [verified: https://elevenlabs.io/docs/help-center/account/general/do-i-use-quota-on-every-generation] |
| Agents default | On 2026-10-05 the Agents conversational TTS default changed **from `eleven_flash_v2` to `eleven_v4_turbo`**. This signals that ElevenLabs considers v4 Turbo production-ready for real-time. | [verified: https://elevenlabs.io/docs/changelog/2026/10/5.md] |
| CLI default | ElevenLabs CLI v1.2.0 made `eleven_v3` its default TTS model (2026-09-07). It is irrelevant to the BFF, but shows that defaults differ per surface: the API default is still `eleven_multilingual_v2`. | [verified: https://elevenlabs.io/docs/changelog/2026/9/7.md] [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert] |
| Enterprise per-key concurrency | Service-account API keys can carry `tts_concurrency_limit` (Enterprise, 2026-09-28). This is useful to isolate narration from calls if we ever move to Enterprise. | [verified: https://elevenlabs.io/docs/changelog/2026/9/28.md] |
| v4 accent behavior is not toggleable | ElevenLabs is "exploring ways to make it a toggle", with no timeline. A character with a deliberate foreign accent who speaks another language will lose the accent on v4 unless tags such as `[strong French accent]` work. | [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4] |

---

## Verification log (2026-10-12)

Method: each claim was re-read on the live official page (fetched as `.md` from `elevenlabs.io/docs`, or as HTML from the pricing pages) on 2026-10-12, with an attempt to refute it. "Confirmed" means the live page states it. "Corrected" means the note was edited. "Unverified" means no official page settles it.

| # | Claim | Status | Source |
|---|---|---|---|
| 1 | Eleven v4 and v4 Turbo launched 2026-09-28; v4 Turbo median inference about 100 ms | confirmed | https://elevenlabs.io/docs/changelog/2026/9/28.md |
| 2 | Model ids `eleven_v4`, `eleven_v4_turbo`, `eleven_v3`, `eleven_v3_conversational`, `eleven_multilingual_v2`, `eleven_flash_v2_5`, `eleven_flash_v2` are current | confirmed | https://elevenlabs.io/docs/overview/models |
| 3 | Character limits: v4 10,000; v3 5,000; Multilingual v2 10,000; Flash v2.5 40,000; Flash v2 30,000 | confirmed | https://elevenlabs.io/docs/overview/models |
| 4 | Languages: v4 90+, v3 70+, Multilingual v2 29, Flash v2.5 32 (adds hu, no, vi) | confirmed | https://elevenlabs.io/docs/overview/models |
| 5 | v4 uses only Stability and Similarity; no Style, no Speed, no SSML | confirmed | https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4 |
| 6 | v4 Turbo over TTD WS honors stability + similarity | **corrected**: the TTD WS `voice_settings` schema has `stability` only | https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket |
| 7 | `voice_settings` fields are stability, similarity_boost, style, use_speaker_boost, speed, with defaults 0.5 / 0.75 / 0 / true / 1 | confirmed | https://elevenlabs.io/docs/api-reference/text-to-speech/convert |
| 8 | Speed range 0.7–1.2 | confirmed | https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices |
| 9 | Speed, Similarity and Speaker Boost are not available on v3 (the playground FAQ also says speed works on "all models": conflict persists) | confirmed | https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech |
| 10 | No pitch or volume parameter in any TTS / TTD settings | confirmed | https://elevenlabs.io/docs/api-reference/text-to-speech/convert |
| 11 | TTS WS `stream-input` does not support v3/v4; TTD WS requires `eleven_v3*` / `eleven_v4*` (guide) | confirmed | https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets |
| 12 | The TTD WS API reference still says "Eleven v3 dialogue models only" (docs conflict) | confirmed | https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket |
| 13 | TTD WS: fixed 20 s inactivity, `keep_alive`; buffer about 40 characters and 8 words; v4 Turbo and v3 Conversational take 1 voice, v4 and v3 take up to 10 | confirmed | https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd |
| 14 | TTD WS dialogue sessions per plan 14 / 21 / 35 / 70 / 105 / 105; over the cap returns `too_many_concurrent_requests` | confirmed | https://elevenlabs.io/docs/overview/models |
| 15 | TTD multi-context WS: 5 contexts; protocol errors close the whole connection; reference says v3 only | confirmed | https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-multi-websocket |
| 16 | TTS-HTTP supports `eleven_v4` (`/v1/text-to-speech/{id}`, `/stream`) | confirmed (help center and SDK samples), with the models-page conflict retained | https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/what-is-eleven-v4 |
| 17 | `model_id` default `eleven_multilingual_v2` on TTS; `eleven_v3` on TTD HTTP; `eleven_v3_conversational` on TTD WS | confirmed | https://elevenlabs.io/docs/api-reference/text-to-speech/convert |
| 18 | `output_format` enum and default `mp3_44100_128`; no MP3 at 32 kHz; 192 kbps needs Creator+; 44.1 kHz PCM/WAV needs Pro+ | confirmed | https://elevenlabs.io/docs/api-reference/text-to-speech/convert |
| 19 | `/stream` has no `wav_*` formats; TTD HTTP accepts WAV (since 2026-02-02) | confirmed | https://elevenlabs.io/docs/api-reference/text-to-speech/stream |
| 20 | `language_code` is ISO 639-1, ignored if unsupported, not supported on multilingual_v2 | confirmed | https://elevenlabs.io/docs/changelog/2026/6/29.md |
| 21 | Flash v2.5 normalization off by default; `on` is Enterprise-only for v2.5 | confirmed | https://elevenlabs.io/docs/overview/models |
| 22 | `apply_language_text_normalization` is Japanese-only and adds latency | confirmed | https://elevenlabs.io/docs/api-reference/text-to-speech/convert |
| 23 | Up to 3 pronunciation dictionary locators per request | confirmed | https://elevenlabs.io/docs/api-reference/text-to-speech/convert |
| 24 | Dictionary phoneme rules only on `eleven_v4`, `eleven_flash_v2`, `eleven_v3`; non-English IPA/CMU requires v4 | confirmed | https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/pronunciation-dictionaries |
| 25 | SSML `<break>` up to 3 s, not on v3/v4; SSML phoneme tags on Flash v2 (and Turbo v2), English only | confirmed | https://elevenlabs.io/docs/help-center/technical/do-pauses-and-ssml-phoneme-tags-work-with-the-api |
| 26 | Request stitching: max 3 ids, ≤ 2 h old, stream must be fully read, "not available for the `eleven_v3` model"; sample uses `eleven_v4` | confirmed | https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/request-stitching |
| 27 | TTD continuity fields (`previous_text`/`future_text` ≤ 100 characters, request ids ≤ 3), `use_pvc_as_ivc`, `settings.similarity` added 2026-09-28 | confirmed | https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert |
| 28 | TTD: ≤ 10 unique voices; keep ≤ 2,000 total characters | confirmed | https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert |
| 29 | `GET /v1/models` fields incl. `maximum_text_length_per_request`, `concurrency_group`, `model_rates`; the free/subscribed max-character fields are deprecated and not enforced | confirmed | https://elevenlabs.io/docs/api-reference/models/list |
| 30 | API prices per 1K characters: v4 / v3 / Multilingual v2 $0.08; v4 Turbo / v3 Conversational / Flash $0.04; promo v4 $0.022, v4 Turbo $0.011 "until Oct 12" | confirmed | https://elevenlabs.io/pricing/api |
| 31 | "1 credit = 1 character on v2/v3/v4" | **corrected**: verified only for Multilingual v2 (and v3 on the website); no v4 credit rate is published; Flash 0.5–1 | https://elevenlabs.io/pricing |
| 32 | Concurrency table (Free 2/4 … Business 15/30, priority 3–6); queue adds about 50 ms; pricing page says Business 25 | confirmed (conflict retained) | https://elevenlabs.io/docs/overview/models |
| 33 | Error body `detail.{type, code, message, status (legacy), request_id, param}` and the code catalog (`rate_limit_exceeded`, `concurrent_limit_exceeded`, `system_busy`, `insufficient_credits`, `invalid_voice_settings`, …) | confirmed | https://elevenlabs.io/docs/eleven-api/resources/errors |
| 34 | v1 models removed 2026-07-09; `eleven_turbo_v2(_5)` deprecated with no removal date; global-preview host deprecated 2026-02-09 | confirmed | https://elevenlabs.io/docs/changelog/2026/6/8.md |
| 35 | Voice Design uses `eleven_ttv_v3` | **corrected**: the default is `eleven_multilingual_ttv_v2`; `eleven_ttv_v3` is optional; `loudness` -1..1 (default 0.5) | https://elevenlabs.io/docs/api-reference/text-to-voice/design |
| 36 | Enhance prompt "prepends tags only" | **corrected**: tags go before or after a segment; emphasis via caps and punctuation is allowed; the prompt also forbids NSFW content | https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices |
| 37 | Response headers `request-id`, `character-cost`, `x-trace-id`, `x-region`, `current-concurrent-requests`, `maximum-concurrent-requests` | confirmed | https://elevenlabs.io/docs/api-reference/introduction |
| 38 | `history-item-id` header, `Retry-After` on 429, the `x-character-count` header variant | unverified | no official page found |
| 39 | Whether `speed` / `style` are rejected or ignored on v3/v4; v4 concurrency group; `language_code` on v4; Opus container; v3 Creative/Natural/Robust numeric values | unverified | no official page settles these; keep the spike items in [§16](#16-open-questions) |
| 40 | Content-moderation error code for TTS | unverified (none in the error catalog; Live Moderation exists for some shared voices, [§18.2](#182-voice-library-usage-rules)) | https://elevenlabs.io/docs/eleven-api/resources/errors |
| 41 | Voice slots per plan; Voice Library voices do not use slots; multipliers; notice period / `disable_at_unix` | added during verification (Business slots conflict: 660 vs 2,200) | https://elevenlabs.io/docs/help-center/account/general/how-many-voice-slots-do-i-get-per-tier-and-how-can-i-increase-it |
| 42 | Multi-context TTS WS `is_final_audio_for_turn` exact for MP3/Opus (2026-09-21) | added during verification | https://elevenlabs.io/docs/changelog/2026/9/21.md |
| 43 | Voice Design voices "may not be as performative" on v4 | added during verification | https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4 |

Spot-checked codebase citations (all matched): `/home/andres/WebstormProjects/magic-worlds/src/shared/types/voice.types.ts:170`, `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/delivery.py:349-353`, `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:18,27`, `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/transcript_sanitizer.py:51-52,176-178`, `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:155,930-934,1129-1134`, `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:753`, `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:17-25`.
