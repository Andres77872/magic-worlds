# 12. Gap closure: ElevenLabs model, settings and realtime protocol facts

**Date:** 2026-10-12

## Scope

This note closes, or narrows to a named staging test, the critic gaps and contradictions from `09_research_critic_gaps.md` that concern raw ElevenLabs facts:

- **G8:** narration language selection.
- **G9:** Studio model capability behaviour.
- **G14:** realtime calls, unresolved protocol facts. The task brief called this "G13", but in `/home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/research/09_research_critic_gaps.md:184` it is **G14**. G13 in note 09 is the IVC and design compliance gap, which this note does not cover.
- **Contradictions:** C6 (narration architecture, factual inputs only), C7 (v4 on TTS HTTP), C8 (close_context on barge-in), C17 (Flash normalization default) and C18 (Speech Engine 3.5x vs 4x).

The note gives:

- an endpoint × model support matrix and character limits;
- a settings × model behaviour matrix;
- facts on language, normalization and bracket handling;
- a protocol fact sheet for the TTS and TTD WebSockets, Speech Engine and Scribe v2 Realtime;
- response headers and error envelopes;
- the codebase consequences;
- a list of contract tests to run in staging for everything that is still open.

**How this note was researched.** It is read-only. No API key was used, no paid endpoint was called, and no database was queried.

Tag meanings:

- **[verified: url]** means an official ElevenLabs page or spec was read today.
- **[secondary: url]** is a third party, usually an open-source integration that reports a live call against the ElevenLabs API with its date. Where a cell says "live" or "probe", it means that third party's observation, not ours.
- **[unverified]** means no source was found; each such item maps to a contract test in §13.

## 1. Resolution summary

| Item | Question | Answer | Status |
|---|---|---|---|
| **C7** | Does `eleven_v4` work on `POST /v1/text-to-speech/{voice_id}`, or only through Text to Dialogue (TTD)? | **It works on TTS HTTP.** The help center says "You can generate with Create speech and Stream speech using model ID `eleven_v4`". The API introduction's JS sample calls `textToSpeech.convert` with `modelId: 'eleven_v4'`. Live probes returned 200 on `convert`, `/with-timestamps` and `/stream/with-timestamps`. The models-page sentence "available via the Text to Dialogue API" is not exclusive. `eleven_v4_turbo` also returned audio over TTS HTTP, but that is not documented (§2). | **Resolved.** v4 is [verified]; v4_turbo on HTTP is [secondary] |
| **C8** | Does `close_context` give a clean cancel on barge-in? | **No.** On TTS multi-context, a context that was flushed "will continue flushing". On TTD multi-context, `close_context` "flush[es] the context's remaining audio, emit[s] its `is_final` message, and close[s] it", so even unflushed buffered text is generated. Audio keeps arriving after the close, and the slot is held until `is_final` (about 5 s observed). Barge-in therefore means three things: drop the old context's audio locally by `context_id`, send `close_context` only to free the slot, and start a new context id (§8.5). | **Resolved.** Whether the discarded audio is billed stays open (CT-11) |
| **C17** | Flash v2.5 normalization: off by default, with "on" Enterprise-only, or on by default? | **The official sources contradict each other** (§6). The models page says it is off by default and "on" is Enterprise-only. Best practices says it is on by default for all TTS models. A 2025-09-08 changelog says it was enabled for Flash. The API default is `"auto"`, which means the system decides. **Decision we can make now:** do not depend on provider normalization for Flash. Normalize numbers and symbols upstream (LLM prompt and sanitizer). | **Partly resolved.** CT-08 measures `auto` cheaply through `normalized_alignment` |
| **C18** | Speech Engine 3.5x (02) or 4x (05)? | **Neither is an ElevenLabs multiplier.** Both divide the list price of **$0.08/min** (burst $0.16/min) by a different do-it-yourself (DIY) baseline. Note 02's "about 3.5x" is about ElevenAgents with a custom LLM (C1) against Option B at $0.0225/min. Note 05's "about 4x" is Speech Engine against $0.0189–0.0213 per call-minute. Plan with the absolute $0.08/min plus our LLM cost. | **Resolved** |
| **C6** | Narration: per-segment TTS, or one TTD request per turn? | This is a product decision; the facts that bear on it are below. Per-segment v4 over TTS HTTP is supported and carries **per-request** `voice_settings` (stability, similarity_boost), so it can honour per-character Studio recipes. TTD HTTP has **one global `settings` object** (`stability`, `similarity`) and `inputs[]` is only `{text, voice_id}`. The TTD WebSocket allows stability only, on the first message. TTD HTTP also recommends **at most 2,000 characters in total per request**. Longer requests "can terminate early in streaming responses or return a validation error". | **Facts supplied.** Decision stays with the product owner |
| **G8** | Which `language_code`, in what format, on which model? | The API takes ISO 639-1 codes and says an unsupported code "will be ignored". Live behaviour differs by model: Flash v2.5 **returns 400** for a code it does not support, while v3 accepted it. The parameter is not supported on `eleven_multilingual_v2`. `eleven_v4_turbo` accepts `yue` (Cantonese) and `zh` (Mandarin), even though the docs list v4 languages by ISO 639-3 names (`cmn` for Mandarin). A recommended request-time policy is in §5.2. | **Facts resolved** [secondary]. CT-07 confirms Spanish on each model |
| **G9** | Settings behaviour on v3/v4, speed range, clamping vs rejection, TTD similarity naming | See §4. On v4, `style` and `speed` are **accepted and ignored** (same byte count) [secondary]. Speed outside 0.7–1.2 is **rejected with 400 `invalid_voice_settings` on Multilingual v2, not clamped** [secondary]. The figure 0.25–4.0 appears only in ElevenLabs' skills repo and in no spec or SDK. TTD HTTP names the field `similarity`; TTS names it `similarity_boost`. Whether v3 stability snaps to discrete values is undocumented. | **Mostly resolved.** CT-05 and CT-06 cover the rest |
| **G14.a** | `eleven_v4_turbo` on the multi-context TTS socket, or over HTTP? | **Not on any TTS socket.** The handshake returns HTTP 400 `unsupported_model`, "Use the text-to-dialogue websocket endpoint instead" [secondary]. It **works** on the TTD WebSocket (one voice), on TTD multi-context, and over TTS HTTP `/stream/with-timestamps` [secondary]. | **Resolved** |
| **G14.b** | `close_context` on barge-in | See C8 | **Resolved** |
| **G14.c** | WS error and close-frame shapes | TTD sockets send a JSON `{message, error, code, param}` and then close with `code`. TTS sockets have **no documented error message**. Integrations handle a JSON `error` field and 1008 closes (§8.6). | **Partly resolved.** CT-10 and CT-13 |
| **G14.d** | Unknown `voice_id` on stream-input | TTS WS closes with **1008** and reason "A voice with voice_id X does not exist." [secondary]. HTTP returns `voice_not_found` (type `not_found`, 404) [verified errors page]. | **Resolved** for TTS. TTD is in CT-10 |
| **G14.e** | Are WS MP3 chunks frame-aligned? | **No ElevenLabs statement exists.** Do not assume it. The frontend already copes; backend billing does not (§12.1). | **Open.** CT-15. The code fix is cheap and safe either way |
| **G14.f** | Scribe realtime session cap | **Undocumented.** An error `session_time_limit_exceeded` exists. One aggregator claims 10 min [secondary]. | **Open.** CT-17 |
| **G14.g** | Per-character voices in Speech Engine | Only `first_message` is client-overridable at conversation start. The config schema has `supported_voices` (per-voice stability, speed and similarity, switched with `<Label>text</Label>` markup) [verified OpenAPI]. Whether Speech Engine honours it is untested. | **Open.** CT-20 |

## 2. Endpoint × model support matrix

**Legend:**

- **Yes (doc):** documented [verified].
- **Yes (live):** a third party reports a successful live call [secondary].
- **No (doc):** documented as unsupported.
- **No (400):** rejected at handshake or request with `unsupported_model`.
- **?:** neither documented nor probed.

`eleven_turbo_v2_5` is deprecated in favour of `eleven_flash_v2_5` (same 40,000 limit, same price tier). Treat its column as legacy.

| Endpoint | `eleven_v4` | `eleven_v4_turbo` | `eleven_v3` | `eleven_multilingual_v2` | `eleven_flash_v2_5` | `eleven_turbo_v2_5` |
|---|---|---|---|---|---|---|
| `POST /v1/text-to-speech/{voice_id}` (convert) | Yes (doc) [1][2]; live 200 [S2] | Yes (live) [S2]; not documented | Yes (doc) | Yes (doc), default model | Yes (doc) | Yes (doc, legacy) |
| `POST …/{voice_id}/stream` | Yes (doc) "Stream speech" [1] | Yes (live) on the `/stream/with-timestamps` variant [S4] | Yes (doc) | Yes (doc) | Yes (doc) | Yes (doc) |
| `POST …/{voice_id}/with-timestamps` | Yes (live): 200 with `alignment` + `normalized_alignment`, tag characters included [S1] | ? (the stream variant works [S4]) | Yes (live) [S1] | Yes (doc) | Yes (doc) | Yes (doc) |
| `POST …/{voice_id}/stream/with-timestamps` | Yes (live) [S4] | Yes (live) [S4] | Yes (live) [S4] | Yes (doc) | Yes (doc) | Yes (doc) |
| WS `/v1/text-to-speech/{voice_id}/stream-input` | **No (doc)** "No `eleven_v3` or `eleven_v4` on this endpoint" [3]; **No (400)** [S4] | **No (400)** [S4] | **No (doc)** [3] | Yes (doc) | Yes (doc) | Yes (doc) |
| WS `/v1/text-to-speech/{voice_id}/multi-stream-input` | **No (400)** `unsupported_model` [S3][S5] | **No (400)** [S3][S5] | No (doc) [3]; `eleven_v3_conversational` returns 400 [S3] | Yes (doc) | Yes (doc), 101 live [S3] | Yes (doc) |
| `POST /v1/text-to-dialogue` (+ `/stream`, `/with-timestamps`, `/stream/with-timestamps`) | **Yes (doc)** [4] | Yes (live) `/v1/text-to-dialogue/stream` [S6] | Yes (doc), default `eleven_v3` [5] | ? (TTD is documented for the v3/v4 families only) | ? (TTD WS returns **403** [S3]) | ? |
| WS `/v1/text-to-dialogue/stream-input` | **Yes (doc)**, up to 10 voices [3][6] | **Yes (doc)**, **exactly 1 voice** [3][4] | Yes (doc); default `eleven_v3_conversational` (1 voice) [7] | **No (doc)**: `model_id` must start with `eleven_v3` or `eleven_v4` [3] | No (doc); **403** live [S3] | No (doc) |
| WS `/v1/text-to-dialogue/multi-stream-input` | Yes (live), with barge-in through new contexts [S5][S6] | Yes (live) [S5][S6] | Yes (doc) [8] | No (doc) | No (doc) | No (doc) |
| `POST /v1/flows/text-to-speech` (added 2026-08-17) | **No.** The discriminated union is Flash v2.5, Multilingual v2 and v3 only [9] | No | Yes (doc) | Yes (doc) | Yes (doc) | No |
| Speech Engine / Agents TTS config (`tts.model_id`) | Yes (doc), in the enum [9] | Yes (doc), the **default** for Speech Engine [9] | Yes (doc) | Yes (doc) | Yes (doc) | Yes (doc) |

**Notes on the matrix:**

1. **Stale reference pages.** The TTD WebSocket and TTD multi-context AsyncAPI pages still say "Eleven v3 dialogue models only (`model_id` must start with `eleven_v3`)" [7][8]. Three sources contradict them: the TTD guide, the TTS-vs-TTD page ("`model_id` must start with `eleven_v3` or `eleven_v4`") [3][6], and live use of v4 and v4_turbo [S3][S5][S6]. Treat the reference pages as stale.
2. **What the 400 says.** The TTS-socket rejection is an HTTP 400 at the WebSocket upgrade, with body `{"detail":{"type":"validation_error","code":"unsupported_model","message":"Model 'eleven_v4' is not supported on the text-to-speech websocket endpoint. Use the text-to-dialogue websocket endpoint instead."}}` [S3]. Client libraries surface it as a failed handshake, not as a close frame.
3. **GET /v1/models.** It reports `eleven_v4` with `can_do_text_to_speech: true`, `can_use_style: false` and `character_cost_multiplier: 1.0` [S1]. Another account reports `can_use_speaker_boost: false` for v4 and no alpha gate [S7]. The response also carries `maximum_text_length_per_request` and `concurrency_group` [9]. These two fields answer the v4_turbo character limit and its concurrency pool **for free** (CT-01).
4. **Concurrency metering differs by endpoint** [10]:
   - HTTP TTS and HTTP TTD count against the standard plan concurrency while generating.
   - The TTS WebSocket counts only generation time.
   - Each open TTD WebSocket (single or multi-context) holds one **dialogue session** for its whole life. The limits are Pro 70 and Scale/Business 105; over the limit the error is `too_many_concurrent_requests`.

## 3. Character limits

| Model / endpoint | Per-request limit | Source |
|---|---|---|
| `eleven_v4` | 10,000 (about 10 min) | [verified: models page][10] |
| `eleven_v4_turbo` | **Not listed.** hermes-agent hard-codes 10,000 but did not measure it | [unverified]; [secondary: S2]. Read `maximum_text_length_per_request` from `GET /v1/models` (CT-01) |
| `eleven_v3` | 5,000 | [verified][10] |
| `eleven_multilingual_v2` | 10,000 | [verified][10] |
| `eleven_flash_v2_5` / `eleven_turbo_v2_5` | 40,000 | [verified][10]; Turbo v2.5 limit per the help center [11] |
| `eleven_flash_v2` / `eleven_turbo_v2` | 30,000 | [verified][10][11] |
| TTD HTTP (all four variants) | At most 10 unique voice IDs. **Keep the total of `inputs[].text` at or below 2,000 characters** for reliable generation | [verified: OpenAPI `inputs` description][9] |
| TTD WebSocket | Text is streamed; there is no per-message limit. Up to 10 voices on `eleven_v4`, 1 on `eleven_v4_turbo` and `eleven_v3_conversational` | [verified][3][7] |
| TTS WebSocket | Text is streamed; buffering follows `chunk_length_schedule` (default first chunk 120 characters) | [verified][12] |

**Consequence for C6.** A whole narrated turn often runs past 2,000 characters. One TTD request per turn would then need to be split, and the split loses TTD's main benefit, cross-speaker prosody over the whole turn. Per-segment TTS HTTP has no such limit; each segment is far below 10,000.

## 4. Voice settings × model behaviour (G9)

### 4.1 What each schema declares

| Schema (endpoint) | stability | similarity | style | use_speaker_boost | speed | Strict? |
|---|---|---|---|---|---|---|
| `VoiceSettingsResponseModel` (TTS HTTP convert/stream/timestamps) | 0–1, default 0.5 | `similarity_boost` 0–1, default 0.75 | number, **no bounds**, default 0 | bool, default true | number, **no bounds**, default 1.0 | No (`additionalProperties` not false) [9] |
| `RealtimeVoiceSettings` (TTS WS, first message only) | 0–1 | `similarity_boost` 0–1 | "available on V2+ models" | "available on V2+ models" | "from 0.7 to 1.2" | — [9][13] |
| `ToDialogueSettingsResponseModel` (TTD HTTP, **one global object**) | 0–1, default 0.5 | **`similarity`** 0–1, default 0.75, "Not supported by every model" | — | — | — | `DialogueInput` is only `{text, voice_id}`: **no per-input settings** [9] |
| `TextToDialogueWebsocketVoiceSettings` (TTD WS, first message only) | 0–1, default 0.5 | — | — | — | — | "Only `stability` is supported" [7] |
| Flows TTS per-model unions (`additionalProperties: false`) | v3: stability only. Flash v2.5: stability, similarity_boost, speed 0.7–1.2. Multilingual v2: all five, style 0–1, speed 0.7–1.2 | | | | | Yes [9] |
| Speech Engine / Agents `TTSConversationalConfig` | yes | yes | — | — | 0.7–1.2 | `supported_voices[]` carries per-voice stability, speed and similarity_boost [9] |

### 4.2 Observed behaviour per model on TTS HTTP

| Model | stability | similarity_boost | style | use_speaker_boost | speed |
|---|---|---|---|---|---|
| `eleven_v4` / `eleven_v4_turbo` | **Honoured** (documented control) [1][14] | **Honoured** (documented as "Similarity") [14] | **Accepted, ignored.** Same audio length and byte count with `style: 0.5` [S1]; "Style and Speed sliders are not available" [1] | Accepted without error [S7]; models API reports `false` [S7]; treat as ignored | **Accepted, ignored** with `speed: 1.1` [S1]. Do not send |
| `eleven_v3` | Honoured. The playground UI historically showed three stops (Creative/Natural/Robust); the API is a continuous 0–1 field. Discreteness is [unverified] (CT-06) | "Not available for v3" in the playground [15]; ignored or rejected over the API is [unverified] (CT-05) | `can_use_style: false` [S1]; ignored is likely, [unverified] | Not available in the playground [15] | "Speed is not available for the Eleven v3 model" [15]; `speed: 1.5` **returned 200** live [S8], with no confirmed audible effect |
| `eleven_multilingual_v2` | Honoured | Honoured | Honoured (0–1) | Honoured | Honoured **within 0.7–1.2**. 0.25, 1.5, 2.0 and 4.0 return **HTTP 400 `invalid_voice_settings`** naming the 0.7–1.2 range; **no clamping** [S8] |
| `eleven_flash_v2_5` | Honoured | Honoured | "Flash models ignore some voice settings" [S9]; the Flows schema has no style for Flash [9] | Not in the Flows Flash schema [9]; likely ignored | 0.7–1.2 (Flows schema [9]); out of range probably 400 as on Multilingual v2, [unverified] (CT-05) |

**Speed range, settled.**

- **0.7–1.2** is the range in every official schema that bounds speed: the TTS WS `RealtimeVoiceSettings`, the Flows Flash/Multilingual schemas and the Agents/Speech Engine config [9]. It is also the playground range [15], and Multilingual v2 enforces it live [S8].
- **0.25–4.0** comes from one place: ElevenLabs' own agent-skills repository ("Range is 0.25-4.0 for the REST API; the Agents Platform restricts to 0.7-1.2. Not supported on Eleven v4") [S9]. Note 07 (E4) took it from a Mintlify mirror. Neither the Python nor the JS SDK has a 0.25 bound; the Python `VoiceSettings.speed` is unbounded, and only the realtime settings type documents 0.7–1.2.
- The live 400 on Multilingual v2 contradicts 0.25–4.0. **Studio should clamp to 0.7–1.2 and send speed only to Multilingual v2 and Flash.**

**Out-of-range values.**

- `stability` and `similarity_boost` are schema-bounded to 0–1, so values outside fail validation. The OpenAPI-level code (400 vs 422) is [unverified]; the errors page maps `invalid_voice_settings` to type `validation_error`, HTTP 400 [16].
- `speed` is checked per model at runtime, with no clamping [S8]. Do not rely on server clamping anywhere; validate in the resolver.

**Resolver rule** (input to 07 §11.2 "capabilities endpoint"). These are the per-model allow-lists of fields to **send**:

| Model | Send | Strip |
|---|---|---|
| `eleven_v4`, `eleven_v4_turbo` (TTS HTTP) | `stability`, `similarity_boost` | `style`, `speed`, `use_speaker_boost` |
| `eleven_v3` (TTS HTTP) | `stability` | everything else |
| `eleven_multilingual_v2` | all five; speed 0.7–1.2, style 0–1 | — |
| `eleven_flash_v2_5` | `stability`, `similarity_boost`, `speed` 0.7–1.2 | `style`, `use_speaker_boost` (harmless, but no effect) |
| TTD HTTP (any model) | one global `settings: {stability, similarity}` | all per-character settings |
| TTD WS | first message `voice_settings: {stability}` | everything else |

## 5. Language selection (G8)

### 5.1 Facts

| Fact | Source |
|---|---|
| `language_code` is "ISO 639-1 … used to enforce a language for the model and text normalization. If the model does not support the provided language code, it will be ignored. This parameter is not supported for multilingual_v2 models." The same text appears on TTS HTTP and TTD HTTP. | [verified: OpenAPI][9] |
| **Live, the "ignored" claim does not hold for Flash.** `eleven_flash_v2_5` with `"fa"` returns **400** `{"detail":{"message":"Model 'eleven_flash_v2_5' does not support language_code 'fa'."}}`. `eleven_v3` with `"fa"` returns 200. | [secondary: S10, probed 2026-08-20] |
| `eleven_v4_turbo` accepts the v3 set plus `ast`, `mi`, `mn`, `mt`, `my`, `oc`, `or`, `tg`, `uz`, `yue`. **Cantonese is `yue`** (it has no ISO 639-1 code) and **Mandarin is `zh`**. The accepted set "differs from the list ElevenLabs documents". | [secondary: S11, Pipecat commit 2026-09-28] |
| The models page lists v4 languages with ISO 639-3 names, e.g. "Cantonese (yue)", "Mandarin Chinese (cmn)". These are **names, not request codes**. | [verified][10] |
| v4 renders a target language "fluent, natural-sounding … rather than carrying over the reference voice's accent". When the language matches the reference voice, the accent is preserved. | [verified][1] |
| `apply_language_text_normalization` exists but is "Currently only supported for Japanese" and "can heavily increase the latency". | [verified: OpenAPI][9] |
| Scribe (STT) accepts ISO 639-1 or 639-3. A region-tagged `"en-US"` is rejected on realtime STT with a 1008 `invalid_request` close. | [verified SDK types]; [secondary: S12] |
| TTS/TTD WebSockets accept `language_code` as a query parameter. | [verified][7][13] |

### 5.2 Recommended request-time policy

This is input for the plan; the decision belongs there.

1. **Source of truth: the adventure's narration language**, falling back to the world's language. The UI locale (en/es) is a user preference, not the story's language, so do not use it. Do not use the per-voice legacy `language_boost` either, because one voice serves several stories.
2. **Format:** a lower-case ISO 639-1 code (`es`, `en`) with no region suffix. Use `yue` for Cantonese and `zh` for Mandarin. Never send `cmn`/`spa`-style 639-3 codes to TTS; acceptance of those is [unverified].
3. **Per-model allow-list.** Send the code only when the target model's list includes it: v4, v4_turbo and v3 lists, plus the Flash v2.5 list (`GET /v1/models` → `languages[].language_id`). Omit it entirely on `eleven_multilingual_v2`. Never let an unsupported code reach Flash, because the result is a 400, not a no-op.
4. **Mixed-language turns.** Omit `language_code` for a segment whose detected language differs from the story language, or set it per segment. Per-segment TTS HTTP allows this; one TTD request carries a single `language_code` for all inputs.
5. **Reuse hash.** Include the effective `language_code` (after the allow-list) in the 08 §12.4 cache key, because it changes normalization and accent.

## 6. Text normalization (C17)

| Source | Claim |
|---|---|
| Models page | "By default, normalization is disabled for Flash v2.5 to maintain the low latency. However, Enterprise customers can now enable text normalization for v2.5 models by setting `apply_text_normalization` to 'on'" [verified][10] |
| Best-practices page | "Normalization is enabled by default for all TTS models" [verified][14] |
| Changelog 2025-09-08 | Normalization "has been enabled for Eleven v3, Flash, and Turbo models" [verified][17] |
| Changelog 2025-12-08 | The `apply_text_normalization` description was simplified and a "plan-specific note" removed [verified][17] |
| Changelog 2026-02-09 | Normalizer upgraded (v3.1) [verified][17] |
| OpenAPI today | Enum `auto`/`on`/`off`, **default `auto`**: "the system will automatically decide whether to apply text normalization". There is no plan restriction in the text [verified][9] |
| Speech Engine | `text_normalisation_type`: `system_prompt` (default; the LLM normalizes) or `elevenlabs` [verified][9] |

**Reading.** The models-page sentence predates the 2025-09/12 changes and is probably stale. Even so, `auto` makes no promise that Flash normalizes any given string. Multilingual v2 is still recommended "for phone numbers and other cases where number normalization is important" [10].

**What the code assumes.** The current voice sanitizer keeps digits because "MiniMax provider-side text normalization reads numbers, money and percentages". See `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/transcript_sanitizer.py:170-180`. That assumption does not carry over to Flash.

**Decision available now.**

- For Flash in calls, use the Speech Engine pattern and normalize upstream: the callbot prompt spells out numbers, and the sanitizer expands the remaining digits for the story language.
- Send `apply_text_normalization: "auto"` explicitly. CT-08 records whether `"on"` is refused on our plan.
- v3/v4 normalize well under `auto` [14].

## 7. Bracketed text and markup

| Model family | `[ … ]` | `< … >` / SSML | Markdown | Other |
|---|---|---|---|---|
| `eleven_v4`, `eleven_v4_turbo`, `eleven_v3` | **Audio tags.** "Audio tags are natural-language instructions, not an enum parameter" [verified][18], so any bracketed text is a candidate instruction. **No escape mechanism is documented.** v4 "can read a tag as a sound effect" [verified][14]. Tag characters stay in `alignment` with **non-zero duration** (`[quietly, under his breath]` spanned 0.62 s) [S1] | **SSML is not supported** on v4 [1]. `<break>` is not supported on v3/v4 [verified][19]. Use punctuation and tags | No documented handling; the characters are read or sound odd | IPA inside `/…/` on v4 [14] |
| `eleven_multilingual_v2`, `eleven_flash_v2_5` | No tag semantics. `[`, `]`, `{`, `}`, `<`, `>` "will usually result in low quality speech" [verified][20] | `<break time="1.5s" />` supported up to 3 s [verified][19]. On the TTS WebSocket SSML is parsed only with `enable_ssml_parsing=true` [verified][13]. Phoneme tags work on Flash v2 / Turbo v2, English only [19] | Not handled; strip | — |

**What the code does today.** `normalize_text_for_tts` turns Markdown links and images into their visible text and strips emphasis, headings and bullets. Empty brackets go, but bare `[text]` survives: `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/transcript_sanitizer.py:206-219`. `validate_spoken_text` fails closed only on angle-bracket tags, chat tokens and role markers: `transcript_sanitizer.py:116-123`. So `[Chapter 2]` or an OOC note in square brackets reaches v3/v4 as an audio tag.

**Rule to adopt.** This is input for G11 and the sanitizer.

- On v3/v4, keep only allow-listed tags, in the exact `[word]` or `[word word]` form the prompt emits.
- Rewrite every other `[x]` to plain `x` with sentence punctuation, or drop it when it is out-of-character (OOC) material.
- On v2/Flash, strip every bracket character.
- CT-09 confirms what v4 does with a non-tag bracket and whether `( … )` is a safe fallback.

## 8. Realtime protocol fact sheet (G14)

### 8.1 TTS WebSocket: `wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input`

**Models.** Flash and Multilingual v2 (§2). v3 and v4 are rejected at the handshake with 400 `unsupported_model`.

**Query parameters** [13]:

- `model_id`, `language_code`, `enable_logging`, `enable_ssml_parsing`, `output_format`;
- `inactivity_timeout`: default 20, maximum 180 s;
- `sync_alignment`, `auto_mode`, `apply_text_normalization`, `seed`;
- `authorization` / `single_use_token`.

**First message.** `{"text": " ", "voice_settings": {...}, "generation_config": {"chunk_length_schedule": [...]}, "xi_api_key"?}`.

**Changing `voice_settings` mid-stream.** Sources disagree:

- The AsyncAPI says `voice_settings` must be in the first message and "either be not provided or not change".
- A live change produced 1008 "voice_settings field must be provided in the first message and then either be not provided or not change." [S13].
- The realtime-TTS guide says settings "can be overridden on a per-message basis" [12].

Trust the AsyncAPI and the live behaviour: **never change settings mid-socket** (CT-18).

**Ending and keepalive.**

- `{"text": ""}` is end-of-stream and closes the socket.
- Keepalive is `{"text": " "}` (a single space) [verified][21].

**Server messages** [13]:

- `{audio, normalizedAlignment, alignment}` and `{isFinal: true}`. The AsyncAPI is camelCase.
- No error message type is defined.

**Concurrency.** Only generation time counts [10].

### 8.2 TTS multi-context: `…/{voice_id}/multi-stream-input`

- **Same model rule:** v3, v4, v4_turbo and v3_conversational all return 400 [S3][S5].
- **Contexts.** Every message carries `context_id`. **At most 5 concurrent contexts per connection** [verified][22].
- **Inactivity** is socket-wide (default 20 s, up to 180 s). Keep a context alive with `{"context_id": X, "text": ""}`. On multi-context an empty text is a keepalive, not end-of-stream [22]. A keepalive sent to a context **before its initialising message** (the one carrying `voice_settings`) leads to a later 1008 [secondary: S14].
- **Closing.** `{"context_id": X, "close_context": true}`: "If it has already been set to flush it will continue flushing. The same context id can be used again but will not be linked to the previous context" [verified][23]. `{"close_socket": true}` closes the socket after flushing contexts.
- **Server messages.** `{audio, alignment, normalizedAlignment, contextId}` and `{isFinal, contextId}` per the AsyncAPI [23]. LiveKit notes "ElevenLabs currently sends snake_case context IDs … older responses … camelCase", so **accept both `context_id` and `contextId`, and `is_final` and `isFinal`** [S5].
- **`is_final_audio_for_turn`.** The 2026-09-21 changelog lists it under "Text to Speech: Multi-context" ("emitted after every buffered byte for that turn, including MP3 and Opus output") [verified][17]. The current TTS multi-context AsyncAPI does **not** define it; only the TTD schemas do [8][23]. Do not depend on it on the TTS socket without CT-12. Pipecat observes that on TTD it arrives several times per turn, once per generation batch, so it **cannot** mark the end of a context; only `is_final` can [S14].

### 8.3 TTD WebSocket: `wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input`

All [verified][6][7] unless noted.

- **Models.** `eleven_v4` (up to 10 voices), `eleven_v4_turbo` (exactly 1 voice), `eleven_v3` (10), `eleven_v3_conversational` (1, the default in the reference).
- **Query parameters.** `model_id`, `output_format`, `language_code`, `sync_alignment` (default false), `apply_text_normalization`, `seed` (1–4294967295), `enable_logging` (default true).
- **Authentication.** `xi-api-key` or `Authorization` header, `single_use_token` query parameter, or `xi_api_key` / `authorization` / `single_use_token` in the first message. Anonymous sessions are rejected.
- **First message.** **Must** include `voices: [voice_id, …]`. It may include `voice_settings: {stability}` and `pronunciation_dictionary_locators`. Both are accepted **only** on the first message.
- **Text.** `{"inputs": [{"text": "…", "voice_id": "…", "new_turn": true?}]}`. Setting `new_turn` or switching `voice_id` ends the prosody segment.
- **Buffering.** The server buffers until about **40 characters and 8 words**, unless the client sends `{"flush": true}`.
- **Control.** `{"flush": true}`, `{"close_socket": true}` (flush, final message, close), `{"keep_alive": true}` (resets the **fixed 20 s** receive timeout; no generation).
- **Server messages.**
  - `{audio, alignment: {chars, char_start_times_ms, char_durations_ms}, normalized_alignment}`, all snake_case;
  - `{is_final_audio_for_turn: true}`;
  - `{is_final: true}`;
  - **error** `{message, error, code, param}`, where `code` is "WebSocket close code that will follow this payload".
- **Metering.** One open connection is one dialogue session for its whole life. Over the limit, the connection is rejected with `too_many_concurrent_requests` [10].
- **No per-input or per-voice settings.**

### 8.4 TTD multi-context: `wss://api.elevenlabs.io/v1/text-to-dialogue/multi-stream-input`

All [verified][8] unless noted.

- **`context_id`.** Every message carries one; the only exception is a message with just `close_socket`. The first message for a new `context_id` creates the context and **must** include `voices`. Optional `voice_settings` and pronunciation dictionaries are accepted only on that first message.
- **At most 5 simultaneous contexts.** Close one to free a slot.
- **`close_context`:** "flush the context's remaining audio, emit its `is_final` message, and close it. Other contexts stay open."
- **`keep_alive`** resets that context's 20 s timeout. "A context idle for longer is automatically flushed and closed (its `is_final` message is sent)."
- **Protocol errors close the whole connection.** The listed cases are a missing `context_id`, an unregistered voice, messaging a context that is closing, and exceeding the context limit. Each sends an error payload and then closes.
- **Live notes:**
  - A slot stays held until `is_final`, which arrived about 5 s after `close_context` [S15].
  - When the limit is exhausted the error can be the misleading 1008 "voices can only be set in the first message" [S15].
  - More than 5 contexts produce a 1008 [S16].
  - Pipecat keeps one dedicated keepalive context open [S14].

### 8.5 `close_context` semantics compared (C8)

| | TTS multi-context | TTD multi-context |
|---|---|---|
| Text already flushed | Keeps generating ("will continue flushing") | Keeps generating |
| Text buffered but not flushed | Not stated (likely dropped; CT-12) | **Generated.** "flush the context's remaining audio" |
| Messages after close | `isFinal` / `is_final` for that context | `is_final` for that context |
| Reusing the id | Allowed; not linked to the old context | A message to a *closing* context is a protocol error that **closes the connection** |
| Slot freed | At final [S15] | At `is_final` |

**Barge-in recipe** (both sockets):

1. Mark the old `context_id` dead locally and drop every audio and alignment frame tagged with it. LiveKit unregisters the context before closing: "the audio the server flushes after close_context() isn't pushed" [S5]. Pipecat stops forwarding as well [S14].
2. Send `close_context` to free the slot.
3. Start the reply on a **new** `context_id`.
4. Never send to the old id again.
5. Budget for up to 5 contexts per connection and about 5 s of slot hold time.

Whether the drained audio is **billed** is undocumented. Assume it is (CT-11).

### 8.6 Error and close-frame shapes

| Surface | Handshake failure | In-band error frame | Close code / reason |
|---|---|---|---|
| TTS WS (single and multi) | HTTP 400 `{"detail":{type, code, message}}`, e.g. `unsupported_model` [S3] | None documented. Integrations defensively handle a JSON `error` field [S5] | **1008** with a text reason: unknown voice [S17], settings change [S13], `input_timeout_exceeded` on inactivity [S5] |
| TTD WS (single and multi) | HTTP 403 for a non-dialogue model such as Flash [S3]; `too_many_concurrent_requests` when out of sessions [10] | `{message, error, code, param}`: `error` is machine-readable (e.g. `authentication_required`), `code` is the close code that follows [verified][7][8] | `code` from the payload; 1008 seen for the context limit [S16] |
| Scribe v2 Realtime | — | `{message_type: <error type>, error: "…"}`. Types: `auth_error`, `quota_exceeded`, `commit_throttled`, `unaccepted_terms`, `rate_limited`, `queue_overflow`, `resource_exhausted`, `session_time_limit_exceeded`, `input_error`, `invalid_request`, `chunk_size_exceeded`, `insufficient_audio_activity`, `transcriber_error` [verified][24] | 1008 for `invalid_request` [S12] |
| HTTP (all) | — | `{"detail": {type, code, message, status (legacy), request_id, param}}` [verified][16] | — |

### 8.7 Inactivity and keepalive

| Surface | Timeout | Keepalive |
|---|---|---|
| TTS WS single-context | 20 s default, `inactivity_timeout` up to **180 s** [21] | `{"text": " "}`. A fully empty string is end-of-stream |
| TTS WS multi-context | Same, socket-wide, applied per context [22] | `{"context_id": X, "text": ""}` |
| TTD WS (single and multi) | **Fixed 20 s**, not configurable [6][8] | `{"keep_alive": true}` (multi: with `context_id`) |
| Scribe v2 Realtime | Closes about 15 s after audio stops; keep streaming silence frames [24] | Optional `keepalive_interval_ms` (500–10000, echoed in `session_started.config`) drives server-side keepalive transcripts. It is not a ping, and it has no billing impact [24] |

### 8.8 Unknown or unusable `voice_id`

| Surface | Behaviour |
|---|---|
| HTTP TTS | `voice_not_found`, type `not_found` (404). A malformed id returns `invalid_voice_id` (400) [verified][16] |
| TTS WS | Close **1008** with reason "A voice with voice_id X does not exist." [secondary: S17]. The close arrives after the handshake, so the client sees a successful open and then the close |
| TTD WS | Undocumented for an unknown id in `voices`. Using an **unregistered** id in `inputs` is a protocol error that closes the connection [8]. Expect `{message, error, code: 1008, param: "voices"}`; [unverified] (CT-10) |

### 8.9 MP3 frame alignment

- ElevenLabs makes **no statement** that WebSocket audio chunks or HTTP `/stream` chunks start or end on MP3 frame boundaries. HTTP `/stream` is raw chunked transfer of the encoder output [verified][25]; chunk boundaries there are transport-defined.
- The 2026-09-21 change ("`is_final_audio_for_turn` … emitted after every buffered byte for that turn, including MP3 and Opus output") shows the encoder buffers across message boundaries [17]. That points against per-message frame alignment, and it says nothing about `flush`.
- **Treat chunks as unaligned.** The code consequences are in §12.1, and CT-15 measures the actual behaviour.

### 8.10 Maximum contexts and voices

| Socket | Contexts per connection | Voices |
|---|---|---|
| TTS multi-context | 5 [22] | 1 (path `voice_id`) |
| TTD single | 1 | 10 (v4, v3) / 1 (v4_turbo, v3_conversational) |
| TTD multi-context | 5 [8] | Per context: 10 / 1 as above |

## 9. Speech Engine (C18)

- **What it is.** Launched 2026-05-25 [17]. ElevenLabs runs STT, turn-taking and interruption detection, TTS and browser playback over WebRTC. **Our server supplies the LLM** through an inverted WebSocket: ElevenLabs connects *to* a **publicly reachable** `wss://` endpoint that we host (the SDK `attach` on `/ws`). Each connection is one conversation [verified][26][27].
- **Status.** No beta or alpha marker appears on the docs, the pricing page or the OpenAPI (no `x-fern-availability`). Treat it as GA but young; the config fields keep changing, e.g. `cascade_timeout_seconds` 2–15, default 4, added 2026-09-21 [17].
- **Pricing.**
  - **$0.08 per minute**, burst **$0.16 per minute**.
  - Included minutes and concurrent calls per tier: 15 min/4, 75/6, 275/10, 1,238/20, 3,738/30, 12,375/40 [verified: pricing/api][28].
  - LLM cost is ours on top.
- **3.5x vs 4x.** Both are derived ratios: $0.08 ÷ $0.0225 ≈ 3.6 (note 02, against Option B) and $0.08 ÷ $0.0189–0.0213 ≈ 3.8–4.2 (note 05). Neither includes the STT or TTS savings in our own code. Use $0.08/min and the measured DIY cost.
- **Voices.**
  - TTS defaults to `eleven_v4_turbo`. Default `agent_output_audio_format` is `pcm_16000`. `text_normalisation_type` defaults to `system_prompt` [9].
  - Only `first_message` is client-overridable at conversation start (`SpeechEngineConversationInitiationClientDataConfig`).
  - `supported_voices[]` exists in the shared TTS config, with per-voice `stability`, `speed` and `similarity_boost`, switched by `<Label>text</Label>` markup in the LLM output. The Agents multi-voice feature caps it at 10 voices [9][29].
  - Whether Speech Engine honours `supported_voices` is **[unverified]** (CT-20). If it does not, we need one Speech Engine per character voice.
- **Privacy defaults.** `record_voice: true` and `retention_days: -1` (unlimited) per 02 §10.2 [9]. Override both at creation.

## 10. Scribe v2 Realtime

All [verified][24][30] unless noted.

| Item | Fact |
|---|---|
| Endpoint | `wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&…` |
| Models | `scribe_v2_realtime` only |
| Audio formats | `pcm_8000`, `pcm_16000` (default), `pcm_22050`, `pcm_24000`, `pcm_44100`, `pcm_48000`, `ulaw_8000`. **Mono only.** Chunks of 0.1–1 s |
| Commit | `commit_strategy`: `manual` (default), `vad` (`vad_silence_threshold_secs`, `min_speech_duration_ms`, …), `turn_prediction` (only for turn-predicting models; `session_started` echoes `manual` or `vad`) |
| Timing | Processing starts after the first 2 s of audio. The model auto-commits after about **36 s** of uncommitted audio. Commit every 20–30 s is recommended |
| Context | `previous_text` only on the **first** audio chunk; a later one is an error |
| Language | `language_code` ISO 639-1 or 639-3. A region suffix is rejected (1008) [S12] |
| Max session length | **Undocumented.** `session_time_limit_exceeded`: "Maximum session time has been reached. Please start a new session or upgrade your subscription". An aggregator lists **10 min** with a refunded pre-charge [secondary: S18]. [unverified]; CT-17 |
| Pricing | **$0.39/h**; keyterms +$0.08/h; transcript editing +$0.12/h. Batch Scribe v2 is $0.22/h, +$0.05/h, +$0.07/h [28] |
| Concurrency | Realtime STT: Pro 30, Scale/Business 45 [10] |

**Design consequence.** A call can outlive the session cap. The STT client must handle `session_time_limit_exceeded` by opening a new session without dropping audio. Send `previous_text` (the last committed transcript) on the new session's first chunk, and commit at least every 30 s.

## 11. Response headers and error envelope

| Header | Status | Use |
|---|---|---|
| `request-id` | Shown on TTS responses in the API introduction [verified][2] | Log it. Support asks for it |
| `x-request-id` | The JS SDK `ElevenLabsError` reads it (`sdk/js/src/errors/ElevenLabsError.ts:41`) [secondary] | Read `request-id`, then `x-request-id`, then `detail.request_id` from the body |
| `x-trace-id` | Shown in the API introduction [2] | Log it |
| `character-cost` | Shown on TTS in the API introduction [2]. The OpenAPI declares it only on `/v1/sound-generation` [9] | Billing reconciliation. Absent on WebSocket |
| `x-character-count` | **No official source** | Do not use |
| `current-concurrent-requests`, `maximum-concurrent-requests` | [verified: models page][10] | Back-pressure and metrics |
| `Retry-After` | **Undocumented.** The Fern-generated SDK retry logic parses `retry-after-ms`, `retry-after` and `x-ratelimit-reset` generically and retries 408, 409, 429 and 5xx (`sdk/py/src/elevenlabs/core/http_client.py:26-123`). That is not evidence the server sends it | Honour it if present; otherwise use exponential backoff with jitter |

**Error envelope.** `{"detail": {"type", "code", "message", "status" (legacy), "request_id", "param"}}` [16]. The fields to branch on:

- **429.** The errors page uses `code` `rate_limit_exceeded` / `concurrent_limit_exceeded` / `system_busy` (type `rate_limit_error`) [16]. The help center uses the legacy `status` values `too_many_concurrent_requests` and `system_busy` [31]. **Match both fields.** `system_busy` is retryable at once; concurrency waits for in-flight requests to finish.
- **400** `unsupported_model`, `invalid_voice_settings` (check `param`), `invalid_voice_id`. **404** `voice_not_found`. **402** `payment_required`.
- **`quota_exceeded`** has been observed as a **401**, not 402 [secondary: S19] [32]. Map it to "out of ElevenLabs credits" and do not retry.

## 12. Codebase implications

### 12.1 Backend per-sentence TTS billing does not survive unaligned MP3

How it works today (`/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py`):

- Every chunk is appended to `assistant_audio` (line 1616).
- After each sentence, `bill_delivered_tts` runs (line 1659). It takes `pending = bytes(assistant_audio[billed_audio_bytes:])` and then sets `billed_audio_bytes = len(assistant_audio)` **before** parsing (lines 1583–1587).
- `_mp3_duration_ms` (lines 2286–2306) counts only whole frames. It skips bytes one at a time until it finds a sync word, and stops at a frame that runs past the end of the slice.

The failure mode if a sentence's audio ends mid-frame:

1. The partial trailing frame is marked billed but never counted.
2. The next slice starts mid-frame, so the parser resynchronises by byte scanning. It loses that frame too and could lock onto a false sync inside frame data.
3. The loss is about one frame (≈26 ms at 44.1 kHz) per sentence, plus a small risk of miscounting.

Today's MiniMax client sends one `task_continue` per sentence on a shared per-turn socket (`/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:140,315`), so the same pattern carries over to an ElevenLabs socket.

**Fix (cheap, safe either way):** advance `billed_audio_bytes` only by the byte length of the whole frames parsed, and carry the tail into the next slice. That means returning `(duration_ms, consumed_bytes)` from the parser. On the final bill of a turn, parse the remainder as is.

### 12.2 Frontend playback is already safe

`completeMp3Length` (`/home/andres/WebstormProjects/magic-worlds/src/features/interaction/audio/voicePlaybackBuffer.ts:694-709`) and `mp3FrameLengthAt` (`:668-687`) play only the leading run of whole frames mid-turn. The tail waits for the next group (`:341`). No change is needed for ElevenLabs MP3.

### 12.3 Socket client requirements derived from §8

- Route by model family:
  - v3/v4/v4_turbo go to the TTD socket (calls) or TTS HTTP (narration);
  - Flash and Multilingual v2 go to the TTS sockets.
  - Treat a handshake 400 `unsupported_model` as a configuration error, never retryable.
- Accept both snake_case and camelCase (`context_id`/`contextId`, `is_final`/`isFinal`).
- End a context only on `is_final`. Ignore `is_final_audio_for_turn` for lifecycle.
- Barge-in follows §8.5. Keep at most 4 live contexts plus one spare. Expect the connection to close on any protocol error on TTD sockets, and reconnect with fresh contexts.
- Keepalive: every ≤15 s, `{"keep_alive": true}` (TTD) or `{"context_id", "text": ""}` (TTS multi). On TTS multi, send a context's keepalive only after its initialising message.
- Never change `voice_settings` on an open TTS socket. On TTD, settings live in a context's first message, so a voice-settings change needs a new context.

## 13. Contract tests to run in staging

**Conventions:**

- `$EL` is the staging API key, held by whoever runs the tests; it is never committed.
- `$V1` and `$V2` are two library voices already added to the staging account.
- Use `output_format=mp3_44100_128` unless stated otherwise.
- Record the HTTP status, the full response headers, the error body and the audio SHA-256 and duration for every call.
- To separate "ignored" from "honoured", send `"seed": 4242` and run the baseline twice, so seed noise is measured before any comparison.

Estimated total spend is under 25,000 characters (about $2 at list price) plus about 75 Scribe minutes (about $0.50).

| ID | Closes | Exact request(s) | Expected observation | Decision fed |
|---|---|---|---|---|
| **CT-01** | v4_turbo limit, language sets, concurrency pool | `curl -s https://api.elevenlabs.io/v1/models -H "xi-api-key: $EL"` (free) | For `eleven_v4`, `eleven_v4_turbo`, `eleven_v3`, `eleven_flash_v2_5` and `eleven_multilingual_v2`: record `maximum_text_length_per_request`, `can_use_style`, `can_use_speaker_boost`, `concurrency_group`, `languages[].language_id`, `requires_alpha_access`. Expected: v4 10000, v3 5000, Flash 40000; v4 `can_use_style:false` | Segment chunk size; per-model language allow-list (§5.2); concurrency budgeting |
| **CT-02** | C7 / G14.a on our account | `POST /v1/text-to-speech/$V1?output_format=mp3_44100_128` body `{"text":"La puerta se abrió despacio.","model_id":M}` for M in `eleven_v4`, `eleven_v4_turbo`; repeat on `/stream`, `/with-timestamps`, `/stream/with-timestamps` | 200 everywhere; `audio/mpeg`, or JSON `{audio_base64, alignment, normalized_alignment}` on timestamps. Headers include `request-id` and `character-cost` | Narration on TTS HTTP; v4_turbo as an HTTP fallback for calls |
| **CT-03** | TTS socket rejection shape | `wscat -c "wss://api.elevenlabs.io/v1/text-to-speech/$V1/multi-stream-input?model_id=eleven_v4_turbo" -H "xi-api-key: $EL"`; repeat on `stream-input` with `eleven_v4`; control: `eleven_flash_v2_5` | v4 family: HTTP 400 at upgrade, body `detail.code == "unsupported_model"`. Flash: 101 | Error mapping: config error, no retry |
| **CT-04** | TTD HTTP limits and model gate | (a) `POST /v1/text-to-dialogue/stream` `{"model_id":"eleven_v4","inputs":[{"text":T1,"voice_id":"$V1"},{"text":T2,"voice_id":"$V2"}],"settings":{"stability":0.5,"similarity":0.75}}` with T1+T2 = 1,900 characters, then 2,400 characters. (b) The same with `model_id: eleven_flash_v2_5` and 50 characters | (a) 1,900: complete audio. 2,400: record whether it truncates (audio duration much shorter than expected) or returns 4xx. (b) 4xx; record `code` | C6: viability of TTD per turn |
| **CT-05** | G9 settings matrix | `POST /v1/text-to-speech/$V1/with-timestamps` text "Uno, dos, tres. La lluvia caía sin prisa." (40 characters), `seed: 4242`, for each model in {v4, v4_turbo, v3, multilingual_v2, flash_v2_5} × each of these `voice_settings` variants: `{}`; `{"speed":0.69}`; `{"speed":0.7}`; `{"speed":1.2}`; `{"speed":1.21}`; `{"speed":0.25}`; `{"speed":4.0}`; `{"style":0.8}`; `{"style":1.5}`; `{"use_speaker_boost":false}`; `{"similarity_boost":0.1}`; `{"stability":1.01}` | Per cell: status + `detail.code`/`param`; duration and SHA vs baseline. Expected: multilingual_v2 speed outside 0.7–1.2 → 400 `invalid_voice_settings`. v4: speed and style give 200 with duration equal to baseline. `stability:1.01` → 400/422. Flash and v3 cells are unknowns to record | Resolver allow-list (§4.2); Studio slider set per model |
| **CT-06** | v3 discrete stability | v3, `seed: 4242`, same text, `stability` ∈ {0.0, 0.3, 0.5, 0.7, 1.0}, each twice | If 0.3 matches 0.5 (and 0.7 matches 0.5 or 1.0) beyond seed noise, the server snaps to 3 stops. Otherwise it is continuous | v3 stability UI: three stops or a slider |
| **CT-07** | G8 language | Text `El 12 de marzo de 2026 pagué 1.250 € a las 15:30.` on {v4, v4_turbo, flash_v2_5, multilingual_v2} × `language_code` ∈ {omitted, `"es"`, `"spa"`, `"es-ES"`}; plus v4_turbo with `"yue"` and `"zh"` on a short Chinese line | Status per cell; `normalized_alignment.chars` shows how numbers were expanded. Expected: multilingual_v2 with a code → 4xx or ignored (record which); Flash `"spa"`/`"es-ES"` → 400 if unsupported | Language policy §5.2; code format |
| **CT-08** | C17 | Flash v2.5, `/with-timestamps`, text `Llama al 555-0134 a las 3:45 pm; total: $1,250.50 (12/03/2026).`, `apply_text_normalization` ∈ {omitted, `auto`, `on`, `off`}, `language_code: "es"` | `normalized_alignment.chars` reveals whether numbers were spelled out under each mode. `on` → 200 or a plan error (record `code`) | Whether the sanitizer must expand digits for Flash |
| **CT-09** | Bracket handling (G11) | v4 and v3 `/with-timestamps`: `[Chapter 2] The door opened. [OOC: roll a d20] (She whispers) Run.`; Flash with the same text | Listen and inspect alignment durations of the bracket spans. Record: spoken literally / silent / performed as delivery / sound effect | Sanitizer rule §7 |
| **CT-10** | Unknown voice, all surfaces | HTTP: `POST /v1/text-to-speech/AAAAAAAAAAAAAAAAAAAA` (Flash). TTS WS: `stream-input` on that id, then send `{"text":" "}` and `{"text":"Hola. ","flush":true}`. TTD WS (`eleven_v4_turbo`): first message `{"voices":["AAAAAAAAAAAAAAAAAAAA"]}`, then `{"inputs":[{"text":"Hola.","voice_id":"AAAAAAAAAAAAAAAAAAAA"}],"flush":true}` | HTTP 404 `voice_not_found`. TTS WS: close 1008 with reason "A voice with voice_id … does not exist.". TTD: record the error payload `{message, error, code, param}` and the close code | Error mapping per surface |
| **CT-11** | C8 billing of drained audio | TTD multi-context, `eleven_v4_turbo`: read `GET /v1/user/subscription` `character_count`. Open ctx `a` with `voices:[$V1]`, send 300 characters **without** flush, then send 300 characters with `flush:true`. On the first audio, send `{"context_id":"a","close_context":true}`. Count audio bytes and time until `is_final`. Read `character_count` again after 60 s | Audio continues after the close; bytes and time to `is_final` recorded. Character delta tells whether the unflushed 300 were synthesized and billed (delta ≈600) or not (≈300). Also send one more message to ctx `a` after the close → expect error + connection close | Barge-in cost; whether to send text in smaller flushed batches |
| **CT-12** | TTS multi-context close and turn markers | Flash on `multi-stream-input`: the same script as CT-11. Also log any `is_final_audio_for_turn` and the casing of `context_id`/`contextId` and `is_final`/`isFinal` | Whether unflushed text is dropped; casing actually sent; whether the turn marker exists on TTS | Parser tolerance; barge-in |
| **CT-13** | Context limit | TTD multi-context: open contexts `c1`…`c6`, each with `voices:[$V1]` and a 10-character input | 6th: error payload + connection close; record `code` and `error` | Context pool sizing |
| **CT-14** | Inactivity | (a) TTS WS Flash with `inactivity_timeout=180`: idle 185 s. (b) TTD WS: idle 21 s; then a new socket with `{"keep_alive":true}` every 15 s for 60 s | (a) Close at about 180 s; record the code/reason (expect 1008 `input_timeout_exceeded`). (b) Close at about 20 s; the keepalive socket stays open | Keepalive cadence |
| **CT-15** | MP3 frame alignment | For HTTP `/stream`, TTS WS (Flash) and TTD WS (`eleven_v4_turbo`), output `mp3_44100_128`, a 3-sentence text with `flush` after each sentence: save each chunk separately | Offline: for each chunk, does it start with an `0xFFE` sync and contain only whole frames? Is every flush boundary frame-aligned? | §12.1 fix urgency (the fix is recommended regardless) |
| **CT-16** | Headers | Record all headers on a 200, a 400 (CT-03), a 404 (CT-10) and a 429. For the 429, fire `concurrency_limit + 3` parallel Flash requests of 5 characters | Presence of `request-id`, `x-request-id`, `x-trace-id`, `character-cost`, `current-concurrent-requests`, `maximum-concurrent-requests`, `Retry-After`; 429 `detail.code` vs `detail.status` | Retry policy, logging |
| **CT-17** | Scribe session cap | `wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&audio_format=pcm_16000&commit_strategy=vad&keepalive_interval_ms=5000`; stream silence plus a spoken 5 s phrase every 2 min for up to 75 min. Also try `language_code=es`, `spa` and `es-ES` on 3 short sessions | Time and payload of `session_time_limit_exceeded` (if any); billing for silence; language-code acceptance | Session-rollover logic |
| **CT-18** | TTS WS settings change | Flash `stream-input`: first message with `voice_settings:{stability:0.5,similarity_boost:0.75}`, then a text message carrying `voice_settings:{stability:0.9,...}` | Expect close 1008 "voice_settings field must be provided in the first message…". If accepted, record whether audio changes | Socket reuse across characters |
| **CT-19** | `previous_text` on v3/v4 HTTP | v4, v4_turbo and v3 `convert` with `previous_text: "Él dijo:"` | 200 vs 4xx (Pipecat reports that v3 rejects it) | Continuity strategy for per-segment narration |
| **CT-20** | Speech Engine per-character voices | Create a Speech Engine with `tts.supported_voices: [{label:"Mara", voice_id:$V2, stability:0.4}]` and default voice `$V1`, `record_voice:false`, `retention_days:0`. Have the upstream LLM reply `Hola. <Mara>Soy Mara.</Mara>`. Also try a conversation-initiation override of `tts.voice_id` | Whether the second sentence is in `$V2`; whether the voice override is rejected. Measure mouth-to-ear latency. Cost: about 3 min at $0.08 | Speech Engine viability for multi-character calls |

## 14. Still open after this note

| Item | Why it is open | Test |
|---|---|---|
| v3 stability discreteness | Undocumented; only community mapping | CT-06 |
| `eleven_v4_turbo` per-request character limit | Not on the models page | CT-01 (free) |
| `eleven_v4_turbo` on TTS HTTP | Works live [S2][S4] but is undocumented; could be withdrawn | CT-02 |
| MP3 frame alignment on WS and `/stream` | No vendor statement | CT-15 |
| Scribe v2 Realtime max session length | Only an error code and an aggregator claim | CT-17 |
| `Retry-After` and other 429 headers | Not in the docs or spec | CT-16 |
| Literal bracket behaviour on v4/v3 | No escape mechanism documented | CT-09 |
| Flash normalization under `auto`, and Enterprise gating of `on` | Contradictory official pages | CT-08 |
| Billing of audio drained after `close_context` | Undocumented | CT-11 |
| Speech Engine `supported_voices` honoured | Schema only | CT-20 |
| TTS WS in-band error frame shape | No AsyncAPI error type | CT-10, CT-12 |
| TTD HTTP over 2,000 characters | "Can terminate early … or return a validation error" | CT-04 |

## Sources

### Official ElevenLabs (read 2026-10-12)

1. [1] https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/what-is-eleven-v4 and https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4
2. [2] https://elevenlabs.io/docs/api-reference/introduction
3. [3] https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets
4. [4] https://elevenlabs.io/docs/changelog/2026/9/28 ("Use eleven_v4 through the Text to Dialogue API… Use eleven_v4_turbo through the Text to Dialogue WebSocket")
5. [5] https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert
6. [6] https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd
7. [7] https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket
8. [8] https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-multi-websocket
9. [9] https://api.elevenlabs.io/openapi.json (VoiceSettingsResponseModel, ToDialogueSettingsResponseModel, DialogueInput, Body_Text_to_dialogue_*, ModelResponseModel, Flows TTS unions, TTSConversationalConfig, SpeechEngine schemas)
10. [10] https://elevenlabs.io/docs/overview/models (character limits, concurrency table, response headers, Text to Dialogue concurrency, normalization note, v4 languages)
11. [11] https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/whats-the-maximum-amount-of-characters-and-text-i-can-generate
12. [12] https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tts
13. [13] https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input
14. [14] https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices
15. [15] https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech
16. [16] https://elevenlabs.io/docs/eleven-api/resources/errors
17. [17] Changelogs: https://elevenlabs.io/docs/changelog/2025/9/8, https://elevenlabs.io/docs/changelog/2025/12/8, https://elevenlabs.io/docs/changelog/2026/2/9, https://elevenlabs.io/docs/changelog/2026/5/25, https://elevenlabs.io/docs/changelog/2026/8/17, https://elevenlabs.io/docs/changelog/2026/9/21
18. [18] https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue and https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-do-audio-tags-work-with-eleven-v3-and-v4
19. [19] https://elevenlabs.io/docs/help-center/technical/do-pauses-and-ssml-phoneme-tags-work-with-the-api
20. [20] https://elevenlabs.io/docs/help-center/troubleshooting/what-characters-are-accepted-when-generating-audio
21. [21] https://elevenlabs.io/docs/help-center/technical/how-can-i-keep-the-websocket-open
22. [22] https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/multi-context-web-socket
23. [23] https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input
24. [24] https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/transcripts-and-commit-strategies and https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/event-reference
25. [25] https://elevenlabs.io/docs/api-reference/streaming
26. [26] https://elevenlabs.io/docs/overview/capabilities/speech-engine
27. [27] https://elevenlabs.io/docs/eleven-api/guides/cookbooks/speech-engine and https://elevenlabs.io/docs/api-reference/speech-engine/create
28. [28] https://elevenlabs.io/pricing/api
29. [29] https://elevenlabs.io/docs/eleven-agents/customization/voice/multi-voice-support
30. [30] https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime
31. [31] https://elevenlabs.io/docs/help-center/technical/api-error-code-429
32. [32] https://elevenlabs.io/docs/help-center/technical/api-error-code-400-or-401
33. Language help: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-do-i-select-the-language-and-accent and https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/why-are-numbers-dates-symbols-and-acronyms-not-properly-pronounced-or-spoken-in-the-correct-language
34. SDKs (cloned read-only): https://github.com/elevenlabs/elevenlabs-python (HEAD fbe5daf, 2026-10-07) and https://github.com/elevenlabs/elevenlabs-js (HEAD ec61f8e, 2026-10-05)

### Secondary (third-party live observations)

1. [S1] https://github.com/dougiefresh49/comic-reader/issues/213: probe of 2026-09-28. v4 `/with-timestamps` 200 with alignment; `style`/`speed` ignored; `GET /v1/models` fields.
2. [S2] https://github.com/NousResearch/hermes-agent/pull/126844 and https://github.com/NousResearch/hermes-agent/issues/126676: v4 and v4_turbo 200 via `text_to_speech.convert` with an IVC voice.
3. [S3] https://github.com/SpekoAI/gateway/pull/94: live 2026-09-28 matrix; the `unsupported_model` body; Flash on TTD gives 403.
4. [S4] https://github.com/dograh-hq/dograh/pull/864: v4, v4_turbo and v3 on `/stream/with-timestamps`; TTS WS 400 for v4_turbo.
5. [S5] https://github.com/livekit/agents/pull/7516: TTS multi-stream-input 400; barge-in on the TTD multi-context socket; also the snake_case/camelCase note and the `close_context` comment in the LiveKit ElevenLabs plugin source.
6. [S6] https://github.com/livekit/agents/pull/7519: `/v1/text-to-dialogue/stream` and TTD multi-stream-input return audio for v4 and v4_turbo.
7. [S7] https://github.com/KevinEdry/runelite-quest-voiceover/pull/323: v4 `can_use_style`/`can_use_speaker_boost` false, GA, multiplier 1; style and speaker boost accepted.
8. [S8] https://github.com/harry0703/MoneyPrinterTurbo/pull/1578#issuecomment-6040107858: maintainer, 2026-10-07. Multilingual v2 speed outside 0.7–1.2 gives 400 `invalid_voice_settings`; v3 with speed 1.5 gives 200.
9. [S9] https://github.com/elevenlabs/skills/blob/main/text-to-speech/references/voice-settings.md: the only source of "0.25-4.0"; "Flash models ignore some voice settings".
10. [S10] https://github.com/pipecat-ai/pipecat/issues/5395: Flash 400 on an unsupported `language_code`; v3 200.
11. [S11] Pipecat commit 47c28a04 (2026-09-28), https://github.com/pipecat-ai/pipecat: v4_turbo language set including `yue`.
12. [S12] https://github.com/pipecat-ai/pipecat/issues/5822: realtime STT rejects `en-US` with 1008 `invalid_request`.
13. [S13] https://github.com/pipecat-ai/pipecat/issues/4520: 1008 on a mid-stream `voice_settings` change.
14. [S14] Pipecat ElevenLabs TTS and dialogue service sources, https://github.com/pipecat-ai/pipecat (`services/elevenlabs/`): keepalive-before-init 1008; `is_final_audio_for_turn` arrives per batch; `close_context` generates buffered text.
15. [S15] https://github.com/pipecat-ai/pipecat/issues/5601: slot held until `is_final` (about 5 s); misleading 1008 at the context limit.
16. [S16] https://github.com/livekit/agents/issues/5844: 1008 with more than 5 contexts.
17. [S17] https://github.com/pipecat-ai/pipecat/issues/1006: 1008 "A voice with voice_id … does not exist."
18. [S18] https://ominigate.ai/en/models/elevenlabs/scribe-v2-realtime: Scribe realtime 10-minute session (aggregator, unconfirmed).
19. [S19] https://github.com/michaeljosiah/ArkeStudio/issues/1622: `quota_exceeded` returned as 401.

### Codebase (read-only)

- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:1579-1599` (`bill_delivered_tts`), `:1616` (append), `:1659` (bill per sentence), `:2286-2306` (`_mp3_duration_ms`)
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:140,315` (one `task_continue` per sentence on a shared socket)
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/transcript_sanitizer.py:116-123` (`_contains_unspeakable_structure`), `:170-219` (`normalize_text_for_tts`)
- `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/audio/voicePlaybackBuffer.ts:341`, `:668-687` (`mp3FrameLengthAt`), `:694-709` (`completeMp3Length`)
- `/home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/research/02_elevenlabs_streaming_dialogue_realtime_agents.md:92,866` (3.5x basis), `/home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/research/05_elevenlabs_platform_pricing_limits_policy.md:885-897` (4x basis)
- `/home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/research/09_research_critic_gaps.md:112-197,262-342` (gap and contradiction definitions)
