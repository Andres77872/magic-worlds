# ElevenLabs streaming, Text to Dialogue, realtime STT and the Agents platform

> **Research scope (reviewed 2026-10-14):** Historical evidence from the dates stated below, including the retired MiniMax baseline. Vendor prices, model/API facts and policy claims were not reverified in this documentation pass. Current application status is **WIP** and is tracked in [00](../00_current_status_and_roadmap.md); later native ElevenLabs code/cutover supersedes migration-era implementation assumptions here.

**Research date:** 2026-10-12

## Scope

This document covers the parts of ElevenLabs that would replace our two realtime and near-realtime speech paths:

- **Voice calls:** the MiniMax `t2a_v2` WebSocket TTS, plus the Groq batch STT.
- **Chat narration:** MiniMax `t2a_v2` HTTP jobs, one job per segment.

It covers ten areas:

1. HTTP streaming TTS.
2. The TTS `stream-input` WebSocket.
3. The TTS multi-context WebSocket.
4. Text buffering, and what replaces our `SentenceBuffer`.
5. Text to Dialogue: HTTP, WebSocket and multi-context WebSocket.
6. Alignment and timestamps.
7. Realtime speech to text (Scribe v2 Realtime).
8. The hosted options: ElevenAgents with a custom LLM, and Speech Engine.
9. Latency best practices.
10. Concurrency and pricing as they affect the design.

It ends with a concrete protocol design for calls and for narration.

Out of scope, and covered by sibling documents in `docs/voice_refactor/research/`:

- the voice catalog and Voice Library;
- voice cloning and design;
- Studio/Projects;
- the batch STT details.

**Confidence tags.** Every external fact carries one of three tags:

| Tag | Meaning |
|---|---|
| `[verified: <url>]` | Read in the live ElevenLabs docs, API reference, changelog or SDK source on 2026-10-12 |
| `[secondary: <url>]` | A third-party source, or a page summary that was not re-read line by line |
| `[unverified]` | From memory or inference; spike before relying on it |

**Other labels.**

- Lines marked *(analysis)* or *(estimate)* are our own reasoning, not vendor facts.
- Codebase facts cite `absolute/path:line`.
- Backend paths are under `/home/andres/PycharmProjects/magic-worlds-api/src/`.
- Frontend paths are under `/home/andres/WebstormProjects/magic-worlds/src/`.

---

## 0. TL;DR

1. **Two TTS WebSocket families.**
   - **TTS family** (`/v1/text-to-speech/{voice_id}/stream-input` and `/multi-stream-input`):
     - one voice per connection;
     - Flash and Multilingual v2 models;
     - chunk schedules;
     - multi-context barge-in;
     - only generation time counts toward concurrency.
   - **Text to Dialogue (TTD) family** (`/v1/text-to-dialogue/stream-input` and `/multi-stream-input`):
     - v3 and v4 models;
     - per-input `voice_id`;
     - fixed buffering (about 40 characters and 8 words);
     - one open connection holds one "dialogue session" from a separate pool.

   [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets] [verified: https://elevenlabs.io/docs/overview/models]
2. **`eleven_v4_turbo` (about 100 ms median inference) is documented only on the single-context TTD WebSocket.**
   - The TTD **multi-context** socket is documented as v3-only.
   - The TTS sockets reject v3 and v4.

   [verified: https://elevenlabs.io/docs/overview/models] [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-multi-websocket] [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tts]

   This shapes the call design. The only documented interruption primitive (`close_context`) exists on the multi-context sockets, so the lowest-risk documented barge-in path today is the **TTS multi-context socket with `eleven_flash_v2_5`** *(analysis)*.

   **Correction added during verification:** `close_context` is not a "discard" primitive. On the TTS multi-context socket, a context that was already flushed "will continue flushing" after `close_context` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input]. On the TTD multi-context socket, `close_context` explicitly "flush[es] the context's remaining audio" [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-multi-websocket]. Barge-in therefore always needs **client/server-side frame dropping by `contextId`**. Audio that was already scheduled may still be generated and billed *(analysis; billing [unverified])*.
3. **For narration, use Text to Dialogue HTTP with `eleven_v4` and `/with-timestamps`.** It returns one audio file plus `voice_segments`, which map back to our segment indices.
   - Limits: at most 10 unique voices, and about 2,000 characters per request.
   - This lets us replace "one paid job per segment" with "one job per turn". That removes known bugs #2, #3 and #5 from `00_current_tts_review.md`.

   [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps]
4. **Scribe v2 Realtime replaces "VAD, WAV upload, Groq" with a streaming WebSocket.**
   - Model latency is about 150 ms.
   - Commit strategies: manual, VAD or turn prediction.
   - Costs $0.39/h.
   - Plan concurrency is low: Pro 30, Scale/Business 45. **This caps concurrent calls if we hold one STT session per call.**

   [verified: https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime] [verified: https://elevenlabs.io/docs/overview/models] [verified: https://elevenlabs.io/pricing/api]
5. **Recommendation: Option B, staged.**
   - **Stage 1 (Option A1):** swap MiniMax for the TTS multi-context WebSocket.
   - **Stage 2:** swap Groq for a Scribe v2 Realtime relay.
   - **Alongside:** time-box a spike of **Speech Engine** (Option C2), which hands STT, turn-taking, TTS and browser playback to ElevenLabs. Use it only if B misses the 1.1–1.5 s target, or if `eleven_v4_turbo` quality is a must-have for calls.
   - **Avoid ElevenAgents with a custom LLM (C1).** It would move call billing, persistence and our agent graph behind a hosted agent config. It also costs about 3.5x per minute *(estimate)*.

---

## 1. Baseline: what we are replacing

### 1.1 Calls (realtime)

| Stage | Today | Code |
|---|---|---|
| Endpointing | Client AudioWorklet VAD at 16 kHz. Silence wait is 550 ms and minimum speech is 250 ms. | `/home/andres/WebstormProjects/magic-worlds/src/features/call/components/CallScreen.tsx:60`; `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/audio/voiceVadProcessor.worklet.js:36` |
| Upload | The segment is posted as WAV over HTTP | `/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/index.ts:3523`, `:3544` |
| STT | Groq `whisper-large-v3`, batch | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:24`, `:85` |
| LLM | Callbot graph via `api.magic_llm` | `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/runtime/callbot_chat.v2.json:32` |
| Text buffering | `SentenceBuffer`: soft cap 160, splits on sentences, protects `<#x#>` and `(...)` markers | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/sentence_buffer.py:17`, `:66`, `:97`, `:126`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:1567` |
| TTS queue | At most 4 queued sentences; 0.12 s idle flush; per-sentence `speak_sentence` and `tts_worker` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:63`, `:66`, `:1601`, `:1651` |
| TTS provider | MiniMax `speech-2.8-turbo` WebSocket at 32 kHz. One `task_continue` per sentence; `task_finish`; socket reused per turn with prewarm | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:21`, `:22`, `:244`, `:268`, `:315`, `:317`, `:593` |
| Barge-in | `_cancel_turn` calls `tts_client.cancel` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:1239`, `:1246`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:392` |
| Delivery frame | `voice_audio_chunk_frame` is hard-coded to 32 kHz mono `audio/mpeg`, sent as base64 `data_b64` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/delivery.py:342`, `:352`, `:359`, `:362` |
| Playback | MSE / `ManagedMediaSource`, using `addSourceBuffer('audio/mpeg')` | `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/audio/voicePlaybackBuffer.ts:31`, `:261` |
| Client socket | Bearer token via the `mw.bearer.v1` subprotocol; non-string frames are dropped | `/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/voiceSocket.ts:18`, `:376` |
| Billing | Delivered audio seconds, from parsed MP3 duration, at 10 s per credit | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:59`, `:1587`, `:2286` |

**Known call issues these APIs can fix:**

- **Bug #17.** On barge-in after the LLM has finished, the turn is persisted as completed with the full text but only truncated audio.
  - Code: `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:1785`–`1821`.
  - Source: `/home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/research/00_current_tts_review.md:217`.
- **Latency.** The latency review estimates 2.5–7 s mouth-to-ear for replies of two or more sentences, against a 1.1–1.5 s target (`/home/andres/WebstormProjects/magic-worlds/docs/voice-calls-latency-review-2026-10-11.md:27`, `:29`).
  - It says the 1–1.5 s target needs the "Phase 3" streaming STT/TTS architecture (`/home/andres/WebstormProjects/magic-worlds/docs/voice-calls-latency-review-2026-10-11.md:43`).

### 1.2 Narration (asynchronous jobs)

- **Segmentation.** `_narrated_segments` splits a turn into speaker segments, capped at 32 segments (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:1174`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_segments.py:15`).
- **Jobs.** Each segment becomes its own MiniMax job. Only segment 0 reserves quota: `enforce_quota=(clip["segment_index"] == 0)` at `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:1433`. This is bug #5, free re-synthesis (`00_current_tts_review.md:201`).
- **Thought dimming.** Thoughts are dimmed by scaling MiniMax `vol` by 0.6 (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:1129`).
- **Voice recipe.** The recipe carries `speed`, `vol`, `pitch`, `emotion` and `language_boost` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:36`–`44`).
- **Player.** The frontend chains one `<audio>` per segment. It gets stuck on pause, and one failed segment halts the rest. These are bugs #2 and #3 (`00_current_tts_review.md:192`–`196`; `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/TurnNarration.tsx`).

---

## 2. Model matrix for streaming

| Model ID | Latency (vendor) | Where it is usable | Voices per request | Settings | List price per 1K chars |
|---|---|---|---|---|---|
| `eleven_v4` | Quality model | TTD HTTP (documented) | Up to 10 | Stability and Similarity only. No Style or Speed. No SSML. Audio tags; IPA in `/…/` | $0.08 |
| `eleven_v4_turbo` | about 100 ms median | TTD WebSocket, single context (documented) | Exactly 1 per connection | Same as v4 | $0.04 |
| `eleven_v3` | — | TTD HTTP/WS; TTD multi-context; also TTS HTTP ("can also be used with the Text to Speech API"), but **not** the TTS WebSockets | Up to 10 | Stability | $0.08 |
| `eleven_v3_conversational` | about 280 ms [verified: https://elevenlabs.io/docs/overview/models] | TTD WS and TTD multi-context (its default) | 1 | Stability | $0.04 |
| `eleven_flash_v2_5` | about 75 ms | TTS HTTP, TTS WS, TTS multi-context | 1 (voice in URL) | Full `voice_settings`, speed 0.7–1.2, `<break>` | $0.04 |
| `eleven_multilingual_v2` | Higher | TTS HTTP and WS | 1 | Full | $0.08 |
| `eleven_turbo_v2(_5)` | — | Deprecated; use Flash | — | — | — |

Sources:

- [verified: https://elevenlabs.io/docs/overview/models]
- [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4]
- [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets]
- [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-multi-websocket]
- [verified: https://elevenlabs.io/pricing/api]
- [verified: https://elevenlabs.io/docs/changelog/2026/9/28]

**Model notes:**

- **Launch.** `eleven_v4` and `eleven_v4_turbo` launched on 2026-09-28. The changelog says: "Use `eleven_v4` through the Text to Dialogue API … Use `eleven_v4_turbo` through the Text to Dialogue WebSocket" [verified: https://elevenlabs.io/docs/changelog/2026/9/28].
- **Agents default.** On 2026-10-05 the ElevenAgents conversational TTS default changed from `eleven_flash_v2` to `eleven_v4_turbo` [verified: https://elevenlabs.io/docs/changelog/2026/10/5].
- **Accents.** v4 changes cross-language behavior. Generating in a language other than the reference voice's language yields a native-sounding accent, not the voice's original accent [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4]. For a multilingual roleplay app this is mostly a win, but a character's "foreign accent" will not carry over.
- **Promo pricing.** The pricing page showed v4 at $0.022 and v4 Turbo at $0.011 per 1K characters, "72% off until Oct 12" — that is, until today. The same page advertises "3x credits included on Creator+ until October 12". Plan on list price [verified: https://elevenlabs.io/pricing/api].
- **PVCs must be fine-tuned per model (added during verification).** An existing Professional Voice Clone is not automatically a v4 voice: "If you already have a Professional Voice Clone and want to train it on Eleven v4 … Click the plus button next to Eleven v4 to start fine-tuning." PVC support for v4 is still "rolling out". IVCs need no training step [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4]. *Implication:* the voice catalog must track per-voice, per-model readiness, not only a `voice_id`.
- **Voice Design voices on v4 (added during verification).** "Voice Design voices work with Eleven v4, but they may not be as performative or sound as good as with earlier models" [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4]. This matters for any admin "design a voice" flow that replaces MiniMax `voice_design`.
- **v3 vs v4 timbre (added during verification).** "An Eleven v4 clone … may sound quite different from its Eleven v3 version" [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4]. Expect audible timbre differences between Flash (calls) and v4 (narration) for the same `voice_id`.
- **Accent workaround (added during verification).** The v4 prompting guide lists an experimental `[strong X accent]` tag ("may be less consistent across different voices") [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices]. This is the only documented lever for keeping a character's foreign accent on v4.
- **Rule of thumb.** About 1K characters is about 1 minute of speech [verified: https://elevenlabs.io/pricing/api].
- **Character limits per request:**
  - `eleven_v4`: 10,000.
  - `eleven_v3`: 5,000.
  - `eleven_flash_v2_5`: 40,000.

  [verified: https://elevenlabs.io/docs/overview/models]

**Ambiguity: is `eleven_v4` accepted on `/v1/text-to-speech/*`?**

- Some JS samples on the v4 and best-practices pages call `textToSpeech` with `eleven_v4`. The best-practices IPA example `curl`s `/v1/text-to-speech/{voice_id}` [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices].
- The model and changelog pages say v4 is "available via the Text to Dialogue API".

Treat TTS HTTP + v4 as **[unverified]**. Check `GET /v1/models` (`can_do_text_to_speech`) in the spike.

*Re-checked during verification:* the best-practices page still shows `curl -X POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}` with `"model_id": "eleven_v4"` [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices], while the models page says v4 "is available via the Text to Dialogue API" [verified: https://elevenlabs.io/docs/overview/models]. The latest changelog entry is 2026-10-05, and nothing after it resolves this [verified: https://elevenlabs.io/docs/changelog/llms.txt]. The ambiguity stands.

---

## 3. HTTP streaming TTS

**Endpoints:**

- `POST /v1/text-to-speech/{voice_id}/stream` returns raw audio bytes as they are generated, via chunked transfer encoding [verified: https://elevenlabs.io/docs/api-reference/streaming] [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/stream].
- `POST /v1/text-to-speech/{voice_id}/stream/with-timestamps` streams JSON objects. Each has:
  - `audio_base64`;
  - `alignment`;
  - `normalized_alignment`, with `{characters[], character_start_times_seconds[], character_end_times_seconds[]}`.

  [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/stream-with-timestamps]
- Non-streaming equivalents: `POST /v1/text-to-speech/{voice_id}` and `/with-timestamps` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert] [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps].

**Useful request fields** [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/stream]:

- **Continuity:**
  - `previous_text` / `next_text`.
  - `previous_request_ids` / `next_request_ids` (max 3 each). These condition prosody across separately generated clips. **This is the vendor answer to our "segments sound disconnected" problem when we must split.**
  - *Added during verification:* "In case both previous_text and previous_request_ids is send, previous_text will be ignored" (the same applies to `next_text`). Results are "best when the same model is used across the generations" [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/stream].
  - *Added during verification:* with `enable_logging=false` (ZRM), "history features are unavailable for this request, including request stitching" [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/stream]. So ZRM and `previous_request_ids` are mutually exclusive.
- **Language (added during verification):** `language_code` "is not supported for multilingual_v2 models" [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/stream]. That matters for the Multilingual v2 narration fallback (§13.3).
- **Latency-costly settings (added during verification):** `style` other than 0 "might increase latency", and `use_speaker_boost` (default `true`) "requires a slightly higher computational load, which in turn increases latency" [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/stream]. For calls, consider `style: 0` and `use_speaker_boost: false`, and A/B the quality.
- **Determinism:** `seed` (0..4294967295), best effort.
- **Normalization:** `apply_text_normalization` (`auto` | `on` | `off`) and `language_code`.
- **Voices:** `use_pvc_as_ivc`, a fallback that uses a PVC voice's IVC version for lower latency.
- **Deprecated:** `optimize_streaming_latency`. Do not use it.
- **Logging:** `enable_logging=false` turns on zero-retention mode, which is **Enterprise only** [verified: https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode].

**Output formats** [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/stream]:

| Family | Values | Plan gate |
|---|---|---|
| MP3 | `mp3_22050_32`, `mp3_24000_48`, `mp3_44100_32`, `mp3_44100_64`, `mp3_44100_96`, `mp3_44100_128`, `mp3_44100_192` | 192 kbps needs Creator+ |
| PCM | `pcm_8000` … `pcm_48000` | 44.1 kHz needs Pro+ |
| Telephony | `ulaw_8000`, `alaw_8000` | — |
| Opus | `opus_48000_32` … `opus_48000_192` | — |

**Hosts.** `api.elevenlabs.io` is the global default. `api.us.elevenlabs.io` forces US routing. The data-residency hosts are EU, India and Singapore (`api.{eu,in,sg}.residency.elevenlabs.io`). They are **an Enterprise feature**: completely separate workspaces with a different API key and a blank voice library [verified: https://elevenlabs.io/docs/overview/administration/data-residency] [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization].

**Default output format (added during verification).** If `output_format` is omitted, it defaults to `mp3_44100_128` on both TTS HTTP and TTD HTTP [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/stream] [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps].

**Transport wording (added during verification).** The streaming reference says HTTP streaming returns "raw audio bytes … using chunked transfer encoding" [verified: https://elevenlabs.io/docs/api-reference/streaming]. The latency guide describes the streaming endpoint as "Server-sent events" [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization]. For plain `/stream` with MP3, treat the body as a raw byte stream; only `/with-timestamps` variants carry JSON objects.

**When to use HTTP streaming.** Use it when the full text is known up front, as in narration. The concept page notes that network transfer adds about 50–200 ms, and that client players commonly buffer around 500 ms before starting [verified: https://elevenlabs.io/docs/eleven-api/concepts/audio-streaming] [verified: https://elevenlabs.io/docs/eleven-api/concepts/latency].

**Implications for magic-worlds** *(analysis)*:

- **Calls:** HTTP streaming per sentence would recreate today's sentence pipeline with an extra request per sentence. Do not use it.
- **Narration:** the TTD HTTP variant (§7) beats per-segment TTS HTTP. Keep per-segment TTS HTTP with `previous_text`/`next_text` as the **fallback** path.

---

## 4. The TTS `stream-input` WebSocket (single context)

**Connection:**

```
wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input
```

**Query parameters** [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input]:

| Param | Default | Notes |
|---|---|---|
| `model_id` | `eleven_multilingual_v2` | Flash, Multilingual v2 and others. **No `eleven_v3` or `eleven_v4`** [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tts] |
| `output_format` | mp3 | Same families as §3 |
| `language_code` | — | ISO 639-1 |
| `inactivity_timeout` | 20 | Seconds, max 180 |
| `sync_alignment` | false | The parameter exists (boolean, default false) in the live spec, and the comparison page lists "Optional `sync_alignment`" for the TTS socket [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets]. Its exact semantics (alignment shipped in the same message as its audio) are not described in the spec *[secondary]* |
| `auto_mode` | false | "automatically handles generation triggers, removing the need to manually manage chunk strategies" [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization]. The concept page says it "attempts to find a good balance automatically by analysing the incoming text. For most applications this produces good results" [verified: https://elevenlabs.io/docs/eleven-api/concepts/audio-streaming]. Older guidance said it is meant for full sentences or phrases *[unverified]* |
| `apply_text_normalization` | auto | `on` for Flash v2.5 is Enterprise only (§11) |
| `seed` | — | 0..4294967295 |
| `enable_ssml_parsing` | false | Needed for SSML phoneme dictionaries |
| `enable_logging` | true | `false` means ZRM, Enterprise only |
| `authorization`, `single_use_token` | — | Alternatives to the `xi-api-key` header |

**Client messages** [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input] [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tts]:

```jsonc
// 1. initializeConnection: must be the first message; text is a single space
{ "text": " ",
  "voice_settings": { "stability": 0.5, "similarity_boost": 0.75, "style": 0,
                      "use_speaker_boost": true, "speed": 1.0 },      // speed 0.7–1.2
  "generation_config": { "chunk_length_schedule": [120, 160, 250, 290] }, // each 50–500
  "pronunciation_dictionary_locators": [ { "pronunciation_dictionary_id": "…", "version_id": "…" } ],
  "xi_api_key": "…"            // only if no header
}
// 2. sendText: each text should end with a single space
{ "text": "Hola, ¿cómo ", "try_trigger_generation": false }
// 3. flush: force generation of whatever is buffered (end of turn)
{ "text": " ", "flush": true }
// 4. close: an EMPTY string closes the connection
{ "text": "" }
```

**Server messages:**

```jsonc
{ "audio": "<base64>",
  "normalizedAlignment": { "charStartTimesMs": [...], "charDurationsMs": [...], "chars": [...] },
  "alignment":           { "charStartTimesMs": [...], "charDurationsMs": [...], "chars": [...] } }
{ "isFinal": true }
```

Alignment times "are relative to the returned chunk" [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input]. **The consumer must keep a running offset.**

**Chunk schedule semantics:**

- The model generates once the buffered text reaches the next threshold in `chunk_length_schedule`. The default is `[120, 160, 250, 290]`.
- With `auto_mode` off, "the model will wait for enough text to match the chunk schedule". A 125-character first threshold with only 50 characters received stalls [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization].
- The concept page frames this as a trade-off: generating too early hurts prosody at phrase boundaries, too late hurts latency. `auto_mode` "attempts to find a good balance automatically" [verified: https://elevenlabs.io/docs/eleven-api/concepts/audio-streaming].
- The official Python SDK's `convert_realtime` sends:
  - `chunk_length_schedule=[50]`;
  - `try_trigger_generation=True` on every chunk;
  - text through a `text_chunker` that splits on `. , ? ! ; : — - ( ) [ ] }` and space, adding a trailing space.

  [verified: https://github.com/elevenlabs/elevenlabs-python/blob/main/src/elevenlabs/realtime_tts.py]

  This is a sensible low-latency profile for streaming LLM output *(analysis)*.

**Lifecycle and errors:**

- **Inactivity.** The connection closes after `inactivity_timeout` seconds without input (default 20, max 180) [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input].
- **Keepalive.** Send `{"text": " "}` (a single space). **Never send `""` as a keepalive on this socket: it closes the connection** [verified: https://elevenlabs.io/docs/help-center/technical/how-can-i-keep-the-websocket-open].
- **Close codes.** Integrations report:
  - close code 1008 with `input_timeout_exceeded` after inactivity;
  - 1008 `detected_unusual_activity` on free-tier keys.

  [secondary: https://github.com/livekit/agents/issues/5844]
- **Concurrency.** Only the time the model is generating audio counts toward the concurrency limit, so an idle open socket costs nothing [verified: https://elevenlabs.io/docs/overview/models].

**Fit for magic-worlds** *(analysis)*:

- It is a near drop-in for the MiniMax socket: one socket per call, one voice per call.
- But **barge-in on a single-context socket means closing it** and reconnecting, which costs a TLS and WebSocket handshake.
- The multi-context variant (§5) exists to solve exactly that.

---

## 5. The TTS multi-context WebSocket

**Connection:**

```
wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/multi-stream-input
```

It takes the same query parameters as §4 [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input].

**Protocol** [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/multi-context-web-socket]:

```jsonc
// create a context: the first message carrying a new context_id
{ "text": " ", "context_id": "turn_42", "voice_settings": { … }, "generation_config": { … } }
// stream text into it
{ "text": "Claro, te cuento ", "context_id": "turn_42" }
// force generation (end of the LLM reply)
{ "context_id": "turn_42", "flush": true }
// keep a context alive without generating
{ "context_id": "turn_42", "text": "" }
// interruption, or done: close it
{ "context_id": "turn_42", "close_context": true }
// end of call
{ "close_socket": true }
```

Server frames carry `contextId`:

- `{ "audio": "<b64>", "alignment": {…}, "normalizedAlignment": {…}, "contextId": "turn_42" }`
- `{ "isFinal": true, "contextId": "turn_42" }`

**Field-name inconsistency.** The guide's sample code reads `is_final` while the schema says `isFinal`. **Accept both** [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/multi-context-web-socket] [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input].

**Limits and rules:**

- At most **5 concurrent contexts** per connection.
- Contexts time out after the default 20 s of inactivity. `inactivity_timeout` is socket-wide, max 180 s.
- Recommended pattern: **one socket per user session**. On interruption, close the old context and start a new one.
- **Flush placement (corrected during verification).** The guide says to "stream the text in smaller chunks and use the `flush: true` flag at the end of complete sentences", not only at the end of the utterance. This "improves the quality of the generated audio and improves responsiveness".

[verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/multi-context-web-socket]

**`close_context` semantics (added during verification).** From the schema: "If set to true, the context will close. If it has already been set to flush it will continue flushing. The same context id can be used again but will not be linked to the previous context with the same name." `close_socket` likewise lets flushing contexts finish [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input]. Consequences:

- After a per-sentence `flush`, a barge-in `close_context` does **not** stop audio already queued. The server keeps streaming it.
- Our backend must **drop every later frame for that `contextId`** and never forward it to the browser.
- Billing of that discarded audio is [unverified]. Assume it is billed.

**Gotchas:**

- **`isFinal` timing.** `isFinal` for a context appears to arrive after `close_context`, not after `flush` [secondary: web search results; to confirm in spike]. Our turn-end detection must therefore send `flush`, then `close_context`, and treat the context's `isFinal` as "turn audio complete".
- **Context leaks.** LiveKit hit 1008 disconnects under frequent interruptions when contexts were not closed, which exceeded the 5-context cap [secondary: https://github.com/livekit/agents/issues/5844]. **Always `close_context` on barge-in, and never reuse a `context_id`.**
- **Keepalive differs from §4.** Here `{"context_id": X, "text": ""}` is a keepalive. On the single-context socket, `{"text": ""}` closes the connection. Keep the two clients separate.

**Fit for magic-worlds** *(analysis)*. This is the best documented match for calls:

- One socket per call, prewarmed at call start. That removes today's per-turn connect (`streaming_tts_minimax.py:38`–`42`, `:593`).
- One context per assistant turn (`context_id = turn_id`).
- `close_context` on barge-in replaces `tts_client.cancel` (`engine.py:1246`).
- Concurrency counts only generation time, so a Pro plan's Flash limit of 20 supports far more than 20 calls (§12).

---

## 6. Buffering: what replaces `SentenceBuffer`

### 6.1 What `SentenceBuffer` does today

`SentenceBuffer` exists because MiniMax WebSocket `task_continue` messages were treated as sentence-sized synthesis units:

- It accumulates LLM deltas.
- It cuts at sentence boundaries (`_find_boundary`, `sentence_buffer.py:97`–`123`) or at a soft cap of 160 characters (`:17`).
- It refuses to cut inside `<#…#>` pause markers or `(...)` cues (`:126`–`132`).

`engine.py` adds:

- a 0.12 s idle flush (`:66`);
- a 4-sentence queue (`:63`);
- per-sentence normalize and validate (`:1603`);
- per-sentence billing (`:1659`).

### 6.2 What ElevenLabs expects instead

| Socket | Server-side buffering | What the client should send |
|---|---|---|
| TTS `stream-input` / `multi-stream-input` | Character thresholds from `chunk_length_schedule`, or `auto_mode` | Word-sized or phrase-sized text ending in a space; `flush` at end of turn. The SDK pattern is `[50]` plus `try_trigger_generation` [verified: https://github.com/elevenlabs/elevenlabs-python/blob/main/src/elevenlabs/realtime_tts.py] |
| TTD `stream-input` / `multi-stream-input` | Fixed: "about 40 characters and 8 words"; no schedule | `inputs` items as they arrive; `flush` at end of turn; `new_turn` at speaker change [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd] |

### 6.3 Recommendation *(analysis)*

Replace `SentenceBuffer` with a thin **`SpeechTextStreamer`** with these responsibilities:

1. **Word-boundary emission.**
   - Hold the trailing partial word.
   - Emit everything up to the last whitespace or punctuation (the SDK `text_chunker` set).
   - Always end with a single space.
   - **Do not wait for sentence ends.** The provider's schedule handles prosody.
2. **Marker integrity.** Keep the existing "do not cut inside an open marker" rule (`sentence_buffer.py:126`), but apply it to the **target** markup (§11.4).
   - Flash: `<break time="0.5s" />`.
   - v3/v4: `[laughs]`.
3. **Streaming-safe sanitization.**
   - `transcript_sanitizer.normalize_text_for_tts` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/transcript_sanitizer.py:170`) runs on whole sentences today. Run it per emitted chunk.
   - Keep a small look-behind window for multi-token patterns.
   - Fix the false positives listed as bug #16 (`00_current_tts_review.md:213`–`216`) before streaming smaller units. Smaller units make sentence-scoped heuristics less reliable.
4. **First-chunk latency profile** (calls), using TTS sockets:
   - `chunk_length_schedule: [50, 120, 160, 250]`, or `auto_mode=true` (A/B in the spike).
   - `try_trigger_generation: true` on the first 1–2 chunks.
   - Send `flush` on LLM completion. This replaces the `flush()` at turn end (`engine.py:1763`).
   - *Added during verification:* the vendor guide also recommends `flush: true` "at the end of complete sentences" on the multi-context socket [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/multi-context-web-socket]. A/B per-sentence flush against end-of-turn-only flush in the spike. A per-sentence flush makes barge-in slightly worse, because flushed audio keeps generating after `close_context` (§5).
5. **Billing moves off sentences.** Bill from provider audio duration per context: the sum of the per-chunk alignment end times, or MP3 frame duration as today (`engine.py:1587`). Do not bill per sentence.
6. **Delete the TTS sentence queue** (`VOICE_TTS_QUEUE_MAX_SENTENCES`, `engine.py:63`). The provider socket is the queue. Backpressure becomes "stop reading LLM deltas if the socket's write buffer grows" *(analysis)*.

This also removes the root cause of latency issue L-01: the last sentence is held until `flush()`, because a reply never ends in whitespace (`docs/voice-calls-latency-review-2026-10-11.md:74`–`80`). Word-level streaming plus a final `flush` makes the tail release immediate.

---

## 7. Text to Dialogue (TTD)

### 7.1 HTTP

**Endpoints** [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert] [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/stream] [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps] [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/stream-with-timestamps]:

- `POST /v1/text-to-dialogue`
- `/stream`
- `/with-timestamps`
- `/stream/with-timestamps`

**Request fields:**

- `inputs: [{ text, voice_id }]`. "The maximum number of unique voice IDs is 10." Keep the total `inputs[].text` "at or below 2,000 characters per request". Longer requests "can terminate early in streaming responses or return a validation error" [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps].
- `model_id`: defaults to `eleven_v3`; use `eleven_v4`.
- `settings: { stability, similarity }`. These are **global**, not per voice. **Corrected during verification:** the field is `similarity` (default 0.75, "Not supported by every model"), **not** `similarity_boost` as in the TTS `voice_settings` object. `stability` defaults to 0.5.
- `pronunciation_dictionary_locators`: up to 3 per request *(added during verification)*.
- `seed`, `language_code`, `apply_text_normalization`, `use_pvc_as_ivc`.
- `previous_text` / `future_text`: max 100 characters each.
- `previous_request_ids` / `next_request_ids`: max 3 each, "Not supported by every model".
- `output_format`: includes `wav_*` and `opus_48000_*`.

[verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps]

**`/with-timestamps` response:**

```jsonc
{ "audio_base64": "…",
  "alignment": { "characters": [...], "character_start_times_seconds": [...], "character_end_times_seconds": [...] },
  "normalized_alignment": { … },
  "voice_segments": [
    { "voice_id": "…", "start_time_seconds": 0.0, "end_time_seconds": 3.42,
      "character_start_index": 0, "character_end_index": 57,   // end is exclusive
      "dialogue_input_index": 0 } ] }
```

`dialogue_input_index` maps each audio span back to the `inputs[]` element [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps].

**Inconsistencies and limits:**

- **Speaker cap.** The capability page also says there is "no limit to the number of speakers", which contradicts the 10-voice cap. **Design for 10** [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue].
- **Determinism.** Output is nondeterministic; use `seed` for more consistent results [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue].
- **Regenerations.** Free regenerations exist only in the web UI, not the API [secondary: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/what-is-dialogue-mode].
- **Pricing.** TTD is not listed as its own line item. Assume the per-model per-character rate *[unverified]*. *Note from verification:* `eleven_v4` is reachable only through TTD (per the models page), and the API pricing page lists "Text to Speech (v4)" at $0.08 per 1K characters. TTD on v4 is therefore almost certainly billed at that rate, but no page states it explicitly [verified: https://elevenlabs.io/pricing/api].
- **ZRM (added during verification).** The TTD HTTP endpoints accept `enable_logging=false` (Enterprise-only ZRM). It disables request stitching [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps] [verified: https://elevenlabs.io/docs/changelog/2026/6/8].

### 7.2 TTD WebSocket (single context)

**Connection:**

```
wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input?model_id=eleven_v4_turbo&output_format=…&language_code=…&sync_alignment=…&apply_text_normalization=…&seed=…&enable_logging=…
```

**Model.** `model_id` must start with `eleven_v3` or `eleven_v4` [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd].

- The API reference page still describes this socket as v3-only, defaulting to `eleven_v3_conversational`.
- The guide, the comparison page and the changelog document `eleven_v4` and `eleven_v4_turbo` on it.

**Treat v4 on this socket as supported but spike-gated** [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket] [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets].

**First message:**

- `voices` (required): exactly one for `eleven_v4_turbo` and `eleven_v3_conversational`, up to 10 for `eleven_v4` and `eleven_v3`.
- Optional `voice_settings` (stability only) and pronunciation dictionaries, accepted **only on the first message**.
- Credentials, unless sent in the header.

**Input and controls:**

- **Inputs:** `{ "inputs": [ { "text": "…", "voice_id": "…", "new_turn": true } ] }`. `new_turn`, or a change of `voice_id`, resets prosody for a new speaker turn.
- **Buffering:** fixed at about 40 characters and 8 words. There is no `chunk_length_schedule`; use `flush` to force output.
- **`flush`:** forces generation of the buffer.
- **`keep_alive`:** resets the fixed **20 s** inactivity timer.
- **`close_socket`:** flushes everything, sends `is_final`, then closes.

**Server messages:**

- `audio`, with snake_case `alignment {chars, char_start_times_ms, char_durations_ms}`.
- `is_final_audio_for_turn`.
- `is_final`.
- Errors `{message, error, code, param}`, for example `authentication_required`.

[verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket] [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd]

**Auth:** an `xi-api-key` or `Authorization` header, a `single_use_token` query parameter, or credentials in the first message. Anonymous sessions are rejected [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket].

**There is no interruption primitive.** Neither the single-context TTD socket guide nor its reference documents a "cancel current turn" message. `close_socket` *flushes* the remaining audio rather than discarding it. So barge-in means dropping the TCP connection and reconnecting, or keeping a hot spare connection *(analysis; the behavior on abrupt close, and whether flushed but undelivered audio is billed, is [unverified])*.

### 7.3 TTD multi-context WebSocket

**Connection:** `wss://api.elevenlabs.io/v1/text-to-dialogue/multi-stream-input`, at most **5** contexts.

**Rules** [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-multi-websocket]:

- Every message needs `context_id`, except `close_socket`.
- A context's first message must include `voices`.
- `close_context` flushes the remaining audio, emits that context's `is_final`, and closes it.
- `keep_alive` is per context. A context idle for 20 s is auto-flushed and closed.
- **Protocol errors close the whole connection:**
  - a missing `context_id`;
  - an unregistered voice;
  - messaging a closing context;
  - exceeding the context limit.

**Models.** The reference says "Eleven v3 dialogue models only (`model_id` must start with `eleven_v3`)", with default `eleven_v3_conversational`. **`eleven_v4_turbo` is not documented here** [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-multi-websocket].

**Implication** *(analysis)*:

- Expressive calls on the v3/v4 family **with** clean barge-in are documented only for `eleven_v3_conversational` on TTD multi-context.
- `eleven_v4_turbo` with barge-in requires either:
  - undocumented use of v4 on multi-context (try it in the spike); or
  - the reconnect / hot-spare pattern on the single-context socket.
- Even on TTD multi-context, `close_context` *flushes* the remaining audio rather than discarding it (see the rules above). "Clean" barge-in there still means dropping that context's frames on our side *(verified rule, analysis of consequence)*.

### 7.4 TTD concurrency (important for calls)

- TTD **HTTP** counts against the standard concurrency limit only while generating.
- TTD **WebSockets** are metered as **dialogue sessions**: "An open connection holds a dialogue session for as long as it stays open, whether or not audio is currently being generated."

| Plan | TTD WebSocket sessions |
|---|---|
| Free | 14 |
| Starter | 21 |
| Creator | 35 |
| Pro | 70 |
| Scale | 105 |
| Business | 105 |
| Enterprise | Elevated |

When the pool is exhausted, new connections are rejected with `too_many_concurrent_requests` [verified: https://elevenlabs.io/docs/overview/models].

**Consequence** *(analysis)*:

- A call on TTD WS holds one session for its whole duration, so Pro caps us at **70 concurrent calls**.
- The hot-spare barge-in pattern doubles that to two sessions per call, which caps Pro at **35**.
- The TTS multi-context socket has no such cap (§12).

---

## 8. Alignment and timestamps

| Source | Shape | Units | Notes |
|---|---|---|---|
| TTS HTTP `/with-timestamps` and `/stream/with-timestamps` | `alignment` and `normalized_alignment`: `{characters, character_start_times_seconds, character_end_times_seconds}` | seconds, absolute | [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/stream-with-timestamps] |
| TTS `stream-input` / `multi-stream-input` | `alignment` and `normalizedAlignment`: `{chars, charStartTimesMs, charDurationsMs}` | ms, **relative to the chunk** | `sync_alignment=true` sends alignment with its audio [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input] |
| TTD HTTP `/with-timestamps` | `alignment`, `normalized_alignment` and **`voice_segments`** | seconds | Segment-to-input mapping [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps] |
| TTD WS | `alignment {chars, char_start_times_ms, char_durations_ms}` (snake_case); `normalized_alignment` unused | ms | [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket] |
| Forced alignment | `POST /v1/forced-alignment` (multipart `file` and `text`) returns `characters[]`, `words[]` and `loss` | seconds | Priced like STT; 10 h, 675K characters; 29 languages. **File-size limit corrected during verification:** the capability page says 3 GB, but the API reference says "The file size must be less than 1GB". Design for 1 GB [verified: https://elevenlabs.io/docs/api-reference/forced-alignment/create] [verified: https://elevenlabs.io/docs/overview/capabilities/forced-alignment] |
| ElevenAgents client `audio` event | Includes alignment, but **not sent over WebRTC** | — | [verified: https://elevenlabs.io/docs/eleven-agents/customization/events/client-events] |

**Uses in magic-worlds** *(analysis)*:

1. **Barge-in truncation (fixes bug #17).**
   - The backend keeps a per-turn character timeline: `cumulative_offset_ms + charStartTimesMs[i]`.
   - The client reports `played_ms` (the playback position of that turn) when it detects barge-in.
   - The server persists only the text whose characters started before `played_ms`, with status `interrupted`.
   - This mirrors ElevenAgents' `agent_response_correction` event, which sends the truncated text after an interruption [verified: https://elevenlabs.io/docs/eleven-agents/customization/events/client-events].
2. **Live captions (calls).** Forward a compact `{turn_id, seq, words:[{t_ms, text}]}` to highlight the word being spoken. Our call captions are not live regions today (`00_current_tts_review.md`, Lower/Accessibility).
3. **Narration karaoke.** Use `voice_segments` to highlight the active speaker segment in the single narration player. Character alignment can drive word highlighting.
4. **Billing.** The audio duration of a context is the last `start + duration` plus the cumulative offset. That works for PCM too, where MP3 frame parsing (`engine.py:2286`) does not apply.
5. **Migration aid.** Forced alignment can backfill alignment JSON for existing MiniMax narration assets if we want karaoke on old turns. This is low priority.

**Caveats:**

- `normalizedAlignment` reflects text after normalization ("3" becomes "three"). Use `alignment` (the original characters) to cut persisted text.
- Whether audio tags (`[laughs]`) appear in `alignment` with zero or non-zero duration is **[unverified]**. Strip them from persisted text regardless.

---

## 9. Realtime STT: Scribe v2 Realtime

**Connection:**

```
wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&audio_format=pcm_16000&language_code=es&commit_strategy=manual&include_timestamps=true
```

**Auth:** the `xi-api-key` header (server side), or `token=<single-use token>` (client side).

**Query parameters** [verified: https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime]:

- **Audio:** `audio_format` is `pcm_8000`, `pcm_16000` (default), `pcm_22050`, `pcm_24000`, `pcm_44100`, `pcm_48000` or `ulaw_8000`. Audio is mono only.
- **Language:** `language_code`, `secondary_languages`, `include_language_detection`.
- **Commit strategy** (`commit_strategy`):
  - `manual` (the default);
  - `vad`;
  - `turn_prediction`, which "additionally commits as soon as the model predicts the speaker has finished their turn (only for models that predict turns, where it is the default)".
- **VAD tuning:** `vad_threshold`, `vad_silence_threshold_secs`, `min_speech_duration_ms`, `min_silence_duration_ms`.
- **Output and vocabulary:**
  - `include_timestamps`.
  - `keyterms`: realtime allows 50 terms of at most 20 characters each (batch allows 1,000 terms of up to 50 characters). Good for character, place and item names. Keyterms cost extra [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/batch/keyterm-prompting].
  - `no_verbatim`.
  - `entity_detection`.
- **Transcript editing** (`transcript_edit`): a natural-language edit instruction of up to 2,000 characters. It is labelled **experimental**, costs +30%, bills at least 10 s per committed transcript, and is incompatible with `entity_detection` [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/transcript-editing].
- **Other:** `filter_background_audio`, `keepalive_interval_ms` (500–10000), `enable_logging`.

**Messages:**

```jsonc
// client → server
{ "message_type": "input_audio_chunk", "audio_base_64": "<pcm16 b64>", "commit": false,
  "sample_rate": 16000, "previous_text": "…" }   // previous_text only on the first chunk; best under 50 chars
// server → client
{ "message_type": "session_started", "session_id": "…", "config": { … } }
{ "message_type": "partial_transcript", "text": "…" }
{ "message_type": "committed_transcript", "text": "…" }
{ "message_type": "committed_transcript_with_timestamps", "text": "…", "language_code": "es",
  "words": [ { "text": "…", "start": 0.12, "end": 0.4, "type": "word", "speaker_id": "…", "logprob": -0.1 } ] }
```

Other server events:

- `committed_transcript_entities`, `edited_transcript`, `warning`.
- Errors:
  - `auth_error`, `quota_exceeded`, `commit_throttled`, `unaccepted_terms`;
  - `rate_limited`, `queue_overflow`, `resource_exhausted`, `session_time_limit_exceeded`;
  - `input_error`, `invalid_request`, `chunk_size_exceeded`, `insufficient_audio_activity`, `transcriber_error`.

[verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/event-reference]

*Added during verification:*

- "`committed_transcript` is the stable, final event for each segment. The public API does not emit a separate `final_transcript` event" (some SDK changelogs mention a final-transcript event) [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/event-reference].
- `previous_text` sent on any chunk other than the first is an **error**, not ignored [verified: https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime].
- `model_id` accepts only `scribe_v2_realtime` [verified: https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime].
- The `session_started.config.commit_strategy` enum lists only `manual` and `vad`, although the query parameter also accepts `turn_prediction` "(only for models that predict turns)". Whether `scribe_v2_realtime` predicts turns stays [unverified].

**Behavior to design around** [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/transcripts-and-commit-strategies]:

- **Startup.** "Transcript processing starts after the first 2 seconds of audio are sent."
  - Open the session at call start, not per utterance.
  - The cost of per-utterance sessions on first-partial latency is **[unverified]**.
- **Commits.**
  - Manual commits "every 20-30 seconds is good practice".
  - The model auto-commits after about 36 s of accumulated audio.
  - Commit during silences or at turn boundaries.
  - Rapid commits are throttled (the `commit_throttled` error).
- **Keepalive.** It "is not a free-running ping: you must keep streaming audio (silence frames are fine)". The server "closes the connection after 15 seconds without any client messages. This server limit is not configurable."
- **VAD example values:** `vad_silence_threshold_secs: 1.5`, `vad_threshold: 0.4`, `min_speech_duration_ms: 100`, `min_silence_duration_ms: 100`. These suit dictation; calls need roughly 0.5 s silence *(analysis)*.

**Further facts:**

- **Chunk sizes.** Chunks should be 0.1–1 s; 16 kHz is recommended; mono only [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/transcripts-and-commit-strategies]. *(Source corrected during verification: this lives on the commit-strategies page, not the server-side streaming page.)*
- **Latency.** About 150 ms model latency [verified: https://elevenlabs.io/docs/overview/models]. Spanish is in the "Excellent" tier, at 5% WER or better [verified: https://elevenlabs.io/docs/overview/capabilities/speech-to-text].
- **Session cap.** Maximum session length is reported as 10 minutes **[unverified]**; the live docs give no number as of 2026-10-12. The `session_time_limit_exceeded` error confirms some cap exists. Its description, "Please start a new session or upgrade your subscription", suggests the cap is **plan-dependent** [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/event-reference]. Long calls need a rolling reconnect with `previous_text`.
- **Single-use tokens.**
  - Created with `POST /v1/single-use-token/{realtime_scribe | batch_scribe | tts_websocket}`.
  - They expire after 15 minutes and are consumed on use.

  [verified: https://elevenlabs.io/docs/api-reference/tokens/create]
- **Client SDKs:**
  - `@elevenlabs/client` `Scribe.connect(...)`.
  - `@elevenlabs/react` `useScribe()`, including microphone capture and self-hostable AudioWorklets for strict CSP.

  [verified: https://elevenlabs.io/docs/eleven-api/resources/libraries/scribe-stt/javascript-scribe] [verified: https://elevenlabs.io/docs/eleven-api/resources/libraries/scribe-stt/react-scribe] [verified: https://elevenlabs.io/docs/changelog/2026/8/17]
- **Pricing.** Scribe v2 Realtime costs $0.39/h, plus $0.08/h with keyterms and $0.12/h with transcript editing. Batch Scribe v2 costs $0.22/h, plus $0.05/h for keyterms and $0.07/h for transcript editing [verified: https://elevenlabs.io/pricing/api].
- **Concurrency.**

  | Plan | Realtime STT concurrency |
  |---|---|
  | Free | 6 |
  | Starter | 9 |
  | Creator | 15 |
  | Pro | 30 |
  | Scale | 45 |
  | Business | 45 |
  | Enterprise | Elevated |

  [verified: https://elevenlabs.io/docs/overview/models]. Whether an idle open session counts against this limit is **[unverified]**. Assume it does, which makes realtime STT **the binding cap on concurrent calls in Option B** *(analysis)*.
- **Model history (corrected during verification).** The 2026-06-08 changelog says `scribe_v1` "is deprecated and will be removed on July 9, 2026". The same entry schedules removal of `eleven_monolingual_v1` and `eleven_multilingual_v1` [verified: https://elevenlabs.io/docs/changelog/2026/6/8]. The models page still lists `scribe_v1` under "Deprecated models", replaced by `scribe_v2` [verified: https://elevenlabs.io/docs/overview/models]. Whether the removal actually happened was not confirmed by a later changelog. Either way, do not use it.

**Relay vs direct** *(analysis)*:

| | Server relay (browser → our WS → Scribe) | Direct (browser → Scribe with a single-use token) |
|---|---|---|
| Latency | One extra hop (about 10–40 ms) | Lowest |
| Security | API key never leaves the server; we see all audio | Token is single-use and 15-minute; the browser can submit any transcript |
| Billing control | Exact audio seconds metered server side | Client-reported; harder to audit |
| Changes needed | Accept binary upstream frames on the voice socket; the client stops uploading WAV | A Scribe SDK in the client, then a `user_transcript` frame to our WS |
| Barge-in coupling | Server sees partials and can cancel TTS immediately | Client must forward partials or VAD events |

**Recommendation:** relay first. It keeps one authenticated socket per call (`voiceSocket.ts:18`) and server-side metering.

---

## 10. The Agents platform: Options A, B and C

### 10.1 ElevenAgents (hosted agent) with a custom LLM

**Architecture.** ASR, LLM, TTS and a proprietary turn-taking model, with WebRTC as the browser transport [verified: https://elevenlabs.io/docs/eleven-agents/overview].

**Custom LLM:**

- An OpenAI-compatible `/v1/chat/completions` or `/v1/responses` endpoint that streams SSE (`data: {json}\n\n` … `data: [DONE]`).
- Requests include:
  - `elevenlabs_extra_body`, set from the client's `customLlmExtraBody` or ConversationInitiationData `extra_body`;
  - `user_id`.
- System tools (`end_call`, `skip_turn`, `language_detection`, …) arrive as OpenAI tools.
- Ending a chunk with "... " acts as a buffer word.

[verified: https://elevenlabs.io/docs/eleven-agents/customization/llm/custom-llm]

- **Retries.** A custom LLM is retried "with the *same* Custom LLM multiple times (matching the standard minimum retry count)", which is at least 3 attempts. There is no fallback to ElevenLabs-hosted models [verified: https://elevenlabs.io/docs/eleven-agents/customization/llm/llm-cascading]. Our endpoint must be idempotent for billing.

**Overrides** (each must be enabled in the agent's security settings):

- system prompt, first message, language;
- **voice ID**, LLM, tools, knowledge base;
- text-only mode;
- stability, speed, similarity;
- ASR keywords (max 50).

[verified: https://elevenlabs.io/docs/eleven-agents/customization/personalization/overrides]

**Dynamic variables:** `system__conversation_id` and similar. `secret__*` variables are redacted [verified: https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables].

**Auth:**

- A signed URL (valid 15 min) or a conversation (WebRTC) token, plus domain allowlists [verified: https://elevenlabs.io/docs/eleven-agents/customization/authentication].
- The token endpoint: `GET /v1/convai/conversation/token?agent_id=…` [verified: https://elevenlabs.io/docs/api-reference/conversations/get-webrtc-token] [verified: https://elevenlabs.io/docs/api-reference/conversations/get-signed-url].

**Conversation flow:**

- Max duration 60–7200 s (default 600).
- `turn_timeout` 1–30 s.
- Soft-timeout fillers of 0.5–8 s (3 s recommended).
- Interruption toggle; turn eagerness modes.

[verified: https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow]

**Events:**

- Client events: `audio` (alignment; not over WebRTC), `interruption`, `agent_response`, `agent_response_correction`, `user_transcript`, `tentative_user_transcript`, `vad_score`, `ping` [verified: https://elevenlabs.io/docs/eleven-agents/customization/events/client-events].
- Client-to-server events: `contextual_update`, `user_message`, `user_activity` [verified: https://elevenlabs.io/docs/eleven-agents/customization/events/client-to-server-events].

**Post-call webhooks:**

- Types: `post_call_transcription`, `post_call_audio` (base64) and `call_initiation_failure`.
- Signed with HMAC in the `ElevenLabs-Signature` header; must return 200.
- Auto-disabled after 10 or more consecutive failures if the last success was over 7 days ago.
- `exclude_transcript` option.

[verified: https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks]

**Retention and privacy:**

- Conversation retention defaults to 2 years and is configurable (`-1` unlimited, `0` scheduled deletion) [verified: https://elevenlabs.io/docs/eleven-agents/customization/privacy/retention].
- Per-agent zero-retention mode means no recordings or PII stored; webhooks are then the only record [verified: https://elevenlabs.io/docs/eleven-agents/customization/privacy/zrm].
- Whether per-agent ZRM is plan-gated is **[unverified]**. The per-agent ZRM page states no plan requirement; it applies "for workspaces that do not have ZRM enforced globally" [verified: https://elevenlabs.io/docs/eleven-agents/customization/privacy/zrm]. API-level ZRM (`enable_logging=false`) is explicitly Enterprise-only [verified: https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode].

**Pricing:**

- About $0.08 per call minute; burst calls (up to 3x concurrency, cap 300) cost 2x [verified: https://elevenlabs.io/docs/eleven-agents/guides/burst-pricing].
- *Added during verification:* burst calls "are deprioritized and may experience higher latency for speech processing, similar to anonymous-tier requests" [verified: https://elevenlabs.io/docs/eleven-agents/guides/burst-pricing].
- A 95% discount applies to silence over 10 s. Call length is measured on connection duration, so an open but idle tab is billed. Text messages are charged separately [verified: https://elevenlabs.io/docs/help-center/product/eleven-agents/how-much-does-eleven-agents-cost]. Text messages cost $0.003 each [verified: https://elevenlabs.io/pricing/agents].
- LLM cost is "passed through separately" [verified: https://elevenlabs.io/docs/help-center/product/eleven-agents/how-much-does-eleven-agents-cost]. That it is zero for a custom LLM is our inference *[unverified]*.
- Included minutes and concurrent calls for Free, Starter, Creator, Pro, Scale and Business: 15/4, 75/6, 275/10, 1,238/20, 3,738/30 and 12,375/40. Additional minutes cost $0.08 and burst minutes $0.16 [verified: https://elevenlabs.io/pricing/agents].

### 10.2 Speech Engine (launched 2026-05-25)

**What it is.** "ElevenLabs handles speech-to-text, turn-taking, text-to-speech and browser playback while your server owns the agent logic and streams response text over a Speech Engine WebSocket" [verified: https://elevenlabs.io/docs/changelog/2026/5/25].

**The inverted socket.** ElevenLabs connects to **our** `ws_url` [verified: https://elevenlabs.io/docs/api-reference/speech-engine/speech-engine-upstream].

- **Auth header.** `X-Elevenlabs-Speech-Engine-Authorization` carries a JWT:
  - HS256, keyed with the SHA-256 of our API key;
  - `iss` `https://api.elevenlabs.io/convai/speech-engine`;
  - `sub` `convai_speech_engine_upstream`.
- **Inbound messages:** `init {conversation_id}`, `user_transcript {user_transcript:[{role, content}], event_id}`, `ping`, `close`, `error`.
- **Outbound messages:** `agent_response {content, event_id, is_final}`, with a final empty `content` and `is_final: true`; `pong`.
- **Stale replies.** "`agent_response` messages sent with an outdated `event_id` are silently discarded." Interruption handling is therefore built in [verified: https://elevenlabs.io/docs/api-reference/speech-engine/speech-engine-upstream] *(source corrected during verification: this quote is on the upstream reference, not the capability page)*. The SDKs cancel the in-flight LLM call via `AbortSignal` or task cancellation [verified: https://elevenlabs.io/docs/overview/capabilities/speech-engine].
- **Python SDK.** It can mount in FastAPI (`engine.serve` / `create_session`). It auto-cancels the previous handler and extracts OpenAI, Anthropic and Gemini streaming formats [verified: https://elevenlabs.io/docs/eleven-api/resources/libraries/speech-engine/python-sdk-reference].

**Config (`POST /v1/speech-engine`)** [verified: https://elevenlabs.io/docs/api-reference/speech-engine/create]:

- `speech_engine {ws_url, request_headers}`.
- `asr {provider: scribe_realtime | scribe_v2_turbo | elevenlabs, user_input_audio_format, keywords}`.
- `tts {model_id (default eleven_v4_turbo; also flash, v3_conversational, v4), voice_id, supported_voices, expressive_mode, agent_output_audio_format, stability, speed, similarity_boost, text_normalisation_type, pronunciation dictionaries, enable_phoneme_tags, audio_effects}`.
- `turn {turn_timeout (7), turn_eagerness patient|normal|eager, speculative_turn, turn_model turn_v2|turn_v3 (default turn_v3), interruption_ignore_terms, …}`.
  - `speculative_turn` "starts generating LLM responses during silence before full turn confidence is reached … May increase LLM costs."
- `vad`.
- `conversation {max_duration_seconds (600), client_events, monitoring}`.
- `privacy {record_voice, retention_days, delete_audio, delete_transcript_and_pii, zero_retention_mode}`.
  - **Defaults (added during verification):** `record_voice: true` and `retention_days: -1` ("no retention limit"). A Speech Engine created with defaults therefore **records and keeps call audio indefinitely**. That conflicts with the 2-year default stated on the agents retention page. Set both explicitly.
- `call_limits {agent_concurrency_limit, daily_limit, bursting_enabled}`.
  - **Defaults (added during verification):** `bursting_enabled: true`, so double-rate burst calls are on by default; `agent_concurrency_limit: -1`; `daily_limit: 100000`.
  - `turn.retranscribe_on_turn_timeout` "Disables silence discount billing while enabled".

  [verified: https://elevenlabs.io/docs/api-reference/speech-engine/create] [verified: https://elevenlabs.io/docs/eleven-agents/customization/privacy/retention]
- `language`, `cascade_timeout_seconds` (2–15, default 4).
- `overrides`: only `first_message`.

**Client side:**

- `GET /v1/convai/conversation/token?agent_id=seng_…` returns `{token, conversation_id}`, so we can correlate with our call session before audio flows.
- The browser uses `@elevenlabs/react` `useConversation().startSession({conversationToken})`, over WebRTC (LiveKit-based) by default.

[verified: https://elevenlabs.io/docs/eleven-api/guides/cookbooks/speech-engine] [verified: https://elevenlabs.io/docs/eleven-agents/libraries/react]

**Pricing:** $0.08/min, with burst at $0.16/min. Included minutes and concurrent calls per tier are the same as agents: 15/4 through 12,375/40 [verified: https://elevenlabs.io/pricing/api] (the "Speech Engine API" table).

**Open point: per-character voices.** `voice_id` and `supported_voices` live on the engine config, and only `first_message` is overridable per session. Using a different character voice per call needs one of:

- one engine per voice;
- a voice switch mechanism through `supported_voices`;
- an undocumented override.

**[unverified]**.

### 10.3 Options compared

**Option definitions:**

- **A1:** keep our orchestrator. Replace MiniMax with the TTS multi-context WS on `eleven_flash_v2_5`. Keep Groq batch STT and client VAD.
- **A2:** like A1, but use the TTD WS with `eleven_v4_turbo`.
- **B:** A1 (or A2) plus Scribe v2 Realtime relayed by our backend.
- **C1:** ElevenAgents with a custom LLM. ElevenLabs owns transport, ASR, turns and TTS, and calls our OpenAI-compatible adapter.
- **C2:** Speech Engine. ElevenLabs owns transport, ASR, turns and TTS, and connects to our WS for the text.

**Comparison** (every row is analysis):

| Dimension | A1 | A2 | B | C1 | C2 |
|---|---|---|---|---|---|
| What we keep | All of the orchestrator, VAD, upload, billing and persistence | Same as A1 | The orchestrator. The upload and Groq are removed | The LLM graph, behind an adapter | The LLM graph, plus our WS server |
| Mouth-to-ear (estimate) | 1.6–2.5 s | 1.6–2.6 s | **1.1–1.8 s** | 1.0–1.6 s | 1.0–1.6 s |
| Biggest remaining latency | 550 ms VAD wait, WAV upload, Groq batch (P99 1.54 s) | Same as A1, plus reconnect on barge-in | LLM time to first token | Our LLM TTFT through an extra hop | Same as C1 |
| Barge-in | `close_context` (documented) | Reconnect or hot spare (not documented) | Same as A1, plus server partials | Built in | Built in (`event_id`) |
| Per-character voice | Voice in URL, one socket per call | `voices` per connection | Same as A1 | `voice_id` override | **Unclear** (engine-level) |
| Cost per call-minute (estimate) | about $0.016 TTS, plus Groq | about $0.016 | **about $0.0225** | about $0.08, plus our LLM | about $0.08, plus our LLM |
| Concurrent calls on Pro (estimate) | Hundreds; TTS counts only while generating | 70 sessions (35 with a hot spare) | **30** (realtime STT limit) | 20 (agent concurrency, burst 60) | 20 (burst 60) |
| Data control | Full | Full | Full; audio passes through us | Hosted transcripts and audio; webhooks needed | Hosted, with privacy knobs |
| Product billing fit | Unchanged (audio seconds) | Unchanged | Unchanged | Wall-clock minutes, so the credit model must change | Same as C1 |
| Effort | Small: provider adapter only | Small, plus barge-in workaround | Medium: binary upstream and an STT client | Large: transport rewrite, webhooks, an adapter endpoint | Medium to large: a new transport on the frontend, inverted WS |
| Risk | Low | Medium: documentation drift on v4 WS | Medium: STT concurrency, session cap | High: platform lock-in, retries hitting billing | Medium: young product (4.5 months), voice-per-call unknown |

**Notes on the estimates:**

- **A latency.** A removes the MiniMax stage (0.5–1.4 s per `voice-calls-latency-review-2026-10-11.md`) and replaces it with roughly 100–150 ms TTFB on a warm socket [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization].
- **B latency.** B additionally removes the WAV encode and upload (0.1–0.6 s on mobile) and replaces batch STT (Groq, P99 1.54 s) with a commit-to-final of about 150–300 ms *(estimate)*.
- **C latency.** The C figures assume ElevenLabs' turn model and WebRTC. They are **not measured**.
- **Cost.** The arithmetic assumes the agent speaks 40% of the call:
  - 0.4 min × about 1K characters/min × $0.04/1K = $0.016.
  - Realtime STT for the whole call: $0.39/60 = $0.0065/min.
  - C prices are list prices before included plan minutes.

---

## 11. Latency best practices (vendor guidance)

1. **Model.** Use Flash for realtime: about 75 ms inference [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization]. `eleven_v4_turbo` is about 100 ms median [verified: https://elevenlabs.io/docs/overview/models].
2. **Transport.** Stream. Use WebSockets when text arrives incrementally. Reuse connections, because the handshake is avoidable latency.
   - Flash WebSocket TTFB is about 100–150 ms in North America, Europe and Southeast Asia, and 150–200 ms in South and Northeast Asia.

   [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization]
3. **Region.**
   - Serving regions are the USA, the Netherlands and Singapore.
   - An `x-region` response header reports the region.
   - `api.us.elevenlabs.io` pins the US.
   - **Colocate our API with the serving region.**

   [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization] [verified: https://elevenlabs.io/docs/overview/administration/data-residency]
4. **Voice type.** Default, synthetic and IVC voices are faster than PVC. `use_pvc_as_ivc` is the escape hatch [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization] [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/stream].
5. **Output format.** Higher-quality formats add modest latency. Prefer `mp3_22050_32`, `mp3_44100_64` or `pcm_16000`/`pcm_24000` for calls [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization].
6. **Chunking.** Use `auto_mode` or a small first threshold, and avoid stalls caused by an unmet first threshold [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization].
7. **Normalization.** It is off by default on Flash, and `apply_text_normalization=on` for Flash v2.5 is Enterprise only. The recommended practice is to normalize in the LLM [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization] [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices].
   - Our callbot prompt already tells the model to "spell out numbers, money, dates, times, and ordinals in words" (`/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/runtime/callbot_chat.v2.json:32`). Today we also set MiniMax `text_normalization_mode` (`streaming_tts_minimax.py:28`, `:753`); drop that.
8. **Measure.** The `elevenlabs-latency` npm tool exists for benchmarking TTFB [secondary: https://www.npmjs.com/package/elevenlabs-latency]. Use `current-concurrent-requests` and `maximum-concurrent-requests` response headers to watch queueing; queueing adds about 50 ms [verified: https://elevenlabs.io/docs/overview/models].

### 11.4 Markup mapping (MiniMax to ElevenLabs)

Today the callbot may emit `(laughs)`, `(sighs)` and `<#0.5#>` when interjections are enabled (`callbot_chat.v2.json:32`; `config.py:41`; `transcript_sanitizer.py:51`).

| MiniMax | Flash / Multilingual v2 (TTS WS) | v3/v4 (TTD) |
|---|---|---|
| `<#0.5#>` | `<break time="0.5s" />`, up to 3 s; too many cause instability | `…` or `—`. **No SSML break support** |
| `(laughs)` / `(sighs)` | Strip. Flash does not interpret audio tags *[unverified: may be spoken literally]* | `[laughs]` / `[sighs]` |
| Thought dimming (`vol*0.6`) | `voice_settings` has no volume; use client gain | `[whispers]`, or client/server gain over `voice_segments` |
| `speed` | `voice_settings.speed` 0.7–1.2 | Not available on v4 |
| `pitch`, `emotion`, `language_boost` | No equivalent; use `language_code` | Audio tags for emotion; `language_code` |

Sources:

- [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices]
- [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4]
- The registry fields are at `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:36`–`44`.

**Action:** make the prompt fragment model-aware. It should ask for `[laughs]` with v4 and no cues with Flash, rather than post-translating.

---

## 12. Concurrency, quotas and cost summary

| Resource | How it is metered | Pro | Scale/Business | Source |
|---|---|---|---|---|
| TTS (Flash) | Generation time only (an idle WS is free) | 20 | 30 | [verified: https://elevenlabs.io/docs/overview/models] |
| TTS (Multilingual v2) | Generation time only | 10 | 15 | same |
| TTD WebSocket | Open connection = 1 session | 70 | 105 | same |
| Realtime STT | Concurrent sessions *[assumed per open session]* | 30 | 45 | same |
| Batch STT | Per request | 40 | 60 | same |
| Agents / Speech Engine | Concurrent conversations, burst 3x at 2x price (burst is on by default for Speech Engine) | 20 | 30 / 40 | [verified: https://elevenlabs.io/pricing/agents] [verified: https://elevenlabs.io/pricing/api] |

**Rule of thumb:** "a concurrency limit of 5 can typically support up to approximately 100 simultaneous audio broadcasts" [verified: https://elevenlabs.io/docs/overview/models].

**IP allowlisting.** These are ElevenLabs egress IPs, relevant to Speech Engine and custom-LLM callbacks into our API [verified: https://elevenlabs.io/docs/eleven-api/resources/ip-allowlisting]:

- US: 34.67.146.145, 34.59.11.47.
- EU: 35.204.38.71, 34.147.113.54.
- Asia: 35.185.187.110, 35.247.157.189.

---

## 13. Recommendations for magic-worlds

### 13.1 Decision

1. **Provider adapter first.**
   - Introduce a `StreamingSpeechProvider` interface in `voice_orchestration` with context-per-turn semantics: `open_call`, `begin_turn(turn_id, voice)`, `push_text`, `end_turn`, `cancel_turn`, `close_call`.
   - Implement it once for **TTS multi-context WS** (default) and once for **TTD WS** (spike).
   - This replaces the MiniMax-specific `prepare_turn`, `synthesize`, `cancel` and `close_turn` (`streaming_tts_minimax.py:244`, `:268`, `:392`, `:404`).
2. **Stage 1 (A1): calls TTS.**
   - Model `eleven_flash_v2_5`, `language_code` from the session.
   - Delete MiniMax streaming and `SentenceBuffer`.
   - Generalize delivery frames.
3. **Stage 2 (B): calls STT.**
   - Scribe v2 Realtime via a server relay, with `commit_strategy=manual` driven by our VAD end-of-speech.
   - Use partials for early cancel on barge-in.
   - Keep Groq as a fallback provider behind the existing `stt_provider` switch (`config.py:85`) until the spike passes.
4. **Narration: TTD HTTP + `eleven_v4`.**
   - One job per turn.
   - Fallback: per-segment TTS HTTP with `eleven_multilingual_v2` and `previous_text`/`next_text`.
5. **Spikes, in parallel and time-boxed:**
   - (a) `eleven_v4_turbo` on TTD multi-context; barge-in cost on TTD single context.
   - (b) Speech Engine prototype for one character, measuring mouth-to-ear and per-call voice selection.
   - (c) Scribe session-length cap and idle-concurrency semantics.

   Switch the call default to v4 turbo or Speech Engine only on measured wins.

### 13.2 Call protocol design (Stages 1 and 2)

**Backend to ElevenLabs TTS: one socket per call, opened at call accept.** This prewarms in parallel with consent and first STT, as latency fix L-02 intended.

```
WSS wss://api.elevenlabs.io/v1/text-to-speech/{character_voice_id}/multi-stream-input
    ?model_id=eleven_flash_v2_5
    &output_format=mp3_44100_64        # or pcm_24000, see the delivery notes
    &language_code=<session lang>
    &inactivity_timeout=180
    &sync_alignment=true
    &auto_mode=<A/B in spike>
    &apply_text_normalization=auto
Header: xi-api-key: <server key>        # never sent to the browser
```

**Per-turn state machine** (`ctx = "t_" + turn_id`, never reused):

| Event | Our message to ElevenLabs |
|---|---|
| Turn accepted (STT final) | `{"context_id": ctx, "text": " ", "voice_settings": {...recipe}, "generation_config": {"chunk_length_schedule": [50,120,160,250]}}` |
| Each `SpeechTextStreamer` chunk | `{"context_id": ctx, "text": "<words> ", "try_trigger_generation": <first two chunks>}` |
| LLM completed | `{"context_id": ctx, "flush": true}`, then `{"context_id": ctx, "close_context": true}` |
| Barge-in (client VAD or STT partial during playback) | `{"context_id": ctx, "close_context": true}` if the context is still open. Drop all later frames whose `contextId == ctx`. *Verification note:* `close_context` does not cancel audio that was already flushed ("it will continue flushing"), so after "LLM completed" the context is already closing and frames keep arriving. **Frame dropping is the real cancel.** Do not send a second `close_context` to a closed context: messaging a closing context is a connection-killing protocol error on the TTD multi-context socket, and the TTS behavior is [unverified] |
| Idle between turns, socket near 150 s idle | Create the next turn's context early (`ctx_next`) and send `{"context_id": ctx_next, "text": ""}` every 15 s. This doubles as a "warm context" |
| Call end | `{"close_socket": true}` |

**Invariants** *(analysis)*:

- At most 2 live contexts per call: the closing one and the active one. The documented cap is 5.
- Treat `isFinal`/`is_final` for `ctx` as "provider audio complete".
- On a 1008 close, reconnect once with the same URL, re-create the active context, and replay the not-yet-acknowledged text.

**Backend to browser frames** (extending `delivery.py`):

- `voice_audio_chunk_frame` gains `content_type`, `sample_rate`, `channels` and `codec` from the provider format, replacing the hard-coded `32_000` (`delivery.py:352`).
- Phase 1 keeps MP3 and the MSE player (`voicePlaybackBuffer.ts:261`). `audio/mpeg` at 44.1 kHz works there unchanged.
- Optional phase 2 sends `pcm_24000` to an AudioWorklet player. That removes MSE decode priming and iOS `ManagedMediaSource` quirks, at about 48 KB/s per call.
- Opus in MSE needs a WebM/Ogg container. Whether ElevenLabs' `opus_48000_*` is raw or containerized is **[unverified]**.
- New `voice_caption_frame {turn_id, seq, words:[{t_ms, text}]}`, built from alignment with a cumulative offset.

**Barge-in persistence (fixes bug #17):**

- The client's interrupt frame carries `{turn_id, played_ms}`, where `played_ms` comes from the player's position for that turn.
- The server cuts the persisted assistant text at the last character whose cumulative start is less than or equal to `played_ms`.
- It stores the turn as `interrupted`.
- It sends the truncated text to the LLM history for the next turn. This is the same idea as ElevenAgents' `agent_response_correction`.

**Billing:**

- Keep "delivered audio seconds" (`engine.py:59`), but compute per context from alignment or audio duration, and **bill only audio delivered before the interruption**.
- Do not use per-sentence charges (`engine.py:1659`).

**STT relay (Stage 2):**

- **Browser to our socket.**
  - Binary frames of PCM16 mono 16 kHz, 100 ms each (3,200 bytes).
  - The worklet already resamples to 16 kHz (`voiceVadProcessor.worklet.js:36`).
  - Our VAD continues to emit `speech_start` and `speech_end` control frames (JSON).
  - The WAV upload path (`index.ts:3523`) is retired.
- **Our server to Scribe.** One session per call: `model_id=scribe_v2_realtime`, `audio_format=pcm_16000`, `commit_strategy=manual`, `include_timestamps=true`, `keyterms=<character, world and lorebook names (≤50, ≤20 chars)>`, `language_code`.
  - The first chunk carries `previous_text` = the last assistant line (under 50 characters).
  - Silence frames keep flowing to avoid the 15 s close.
  - On `speech_end` from our VAD, send `commit: true`. The resulting `committed_transcript` starts the LLM turn.
  - Partials during assistant playback trigger barge-in (with a minimum-words guard) before the commit.
  - Reconnect on `session_time_limit_exceeded`.
- **Tuning.** Later, try `commit_strategy=vad` with `vad_silence_threshold_secs≈0.5`, or `turn_prediction` if `scribe_v2_realtime` supports it. Either could replace our fixed 550 ms wait (`CallScreen.tsx:60`).

**Removal list (calls), after Stage 1:**

- `streaming_tts_minimax.py`.
- MiniMax constants in `config.py` (`:25`, `:91`, `:125`–`127`).
- `sentence_buffer.py`.
- The sentence queue in `engine.py` (`:63`, `:66`, `:1570`, `:1601`–`:1706`).
- `<#x#>` handling in `transcript_sanitizer.py:51`, replaced by model-aware markup.

### 13.3 Narration protocol design

**Request.** One request per assistant turn (a background job, as today), using `POST /v1/text-to-dialogue/with-timestamps`:

```jsonc
{ "model_id": "eleven_v4",
  "inputs": [ { "text": "[whispers] …thought…", "voice_id": "<narrator>" },
              { "text": "…dialogue…",           "voice_id": "<character A>" } ],
  "settings": { "stability": 0.5, "similarity": 0.75 },   // TTD uses `similarity`, not `similarity_boost`
  "language_code": "es",
  "seed": <stable hash of turn_id>,
  "apply_text_normalization": "auto",
  "output_format": "mp3_44100_128" }
```

**Building `inputs`:**

- One entry per `_narrated_segments` item (`route_chat.py:1174`), keeping `segment_index` order.
- Map each segment's voice to an ElevenLabs `voice_id`.

**Splitting.** If unique voices exceed 10 or the total exceeds 2,000 characters:

- Split at segment boundaries into consecutive requests.
- Chain them with `previous_request_ids` (max 3) and `previous_text`/`future_text` (max 100 characters each). Both are "Not supported by every model"; verify on v4.
- Concatenate the MP3s server side, offsetting `voice_segments` times.

**Result storage:**

- One audio asset.
- A sidecar JSON with:
  - `segments: [{segment_index, voice_id, start_s, end_s, char_start, char_end}]`, built from `voice_segments[].dialogue_input_index`;
  - optionally `alignment` for word highlighting.

**Quota and billing:**

- Reserve once per turn for the **total character count** before the request, and settle after.
- Reuse requires an exact `(model, voices, text, seed, settings)` hash match. This fixes bug #5.
- Refund on failure, which fixes bug #7.

**Thought dimming without per-voice volume:**

- **Default:** prefix thought segments with `[whispers]` (v4 audio tag).
- **Optionally:** apply a server-side gain of −4 dB (about 0.6x) over the thought spans in the concatenation/transcode step, using `voice_segments` times. We already transcode provider audio for theme songs.

**Player:**

- One `<audio>` element per turn, with `timeupdate` mapped to `segments[]` for the active-speaker highlight.
- This replaces the segment chain in `TurnNarration.tsx`, removing the stuck-pause and halt-on-failed-segment classes of bugs (#2 and #3).

**Fallback:**

- Use it when TTD returns 422 or times out, or for a voice that v4 rejects (a PVC still rolling out).
- It generates per-segment `POST /v1/text-to-speech/{voice_id}` with `eleven_multilingual_v2`, `previous_text`/`next_text` and `previous_request_ids`, then concatenates.
  - *Verification note:* `language_code` is "not supported for multilingual_v2 models", so drop it on this path.
  - When `previous_request_ids` is sent, `previous_text` is ignored.
  - Request stitching is unavailable under ZRM (`enable_logging=false`).

  [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/stream]
- Same storage contract.

**Progressive playback (later):**

- Switch to `/v1/text-to-dialogue/stream/with-timestamps` to start playing before the full turn is synthesized.
- Note the warning that streaming responses over 2,000 characters "can terminate early".

### 13.4 Acceptance criteria for the spikes

| Spike | Pass if |
|---|---|
| Stage 1 TTS | p50 first audio byte under 250 ms after the first LLM token, measured at our server in the target region. No 1008 errors across 200 barge-ins. `isFinal` semantics confirmed |
| v4 turbo | Either it works on `/v1/text-to-dialogue/multi-stream-input`, or single-socket drop-and-reconnect p95 is under 300 ms. Session-pool headroom fits target concurrency |
| Scribe relay | Commit-to-final p50 under 300 ms. Spanish WER on our test set no worse than Groq. Session cap and idle-concurrency behavior documented |
| Speech Engine | Mouth-to-ear p50 under 1.3 s. Per-call voice selection possible without one engine per character. Data retention configurable to our policy |
| Narration TTD | 10-voice, 2,000-character turn under 15 s. `voice_segments` mapping exact. Thought tag audible but subtle |

---

## 14. Open questions

1. Does `eleven_v4` (or `eleven_v4_turbo`) work on `/v1/text-to-speech/*` HTTP? Samples suggest yes; the model pages say TTD only.
2. Does `eleven_v4_turbo` work on the TTD **multi-context** WebSocket, which is documented as v3-only?
3. The TTD single-context WebSocket reference says v3-only, while the guide and changelog say v3 and v4. Which is current?
4. What exactly does `auto_mode` do with partial phrases? Is it safe for word-level LLM streaming, or meant for whole sentences?
5. Does the TTS multi-context socket emit `isFinal` after `flush`, or only after `close_context`?
6. Is audio generated after `close_context` or an abrupt socket close billed?
7. How can Speech Engine use a different voice per call or character? Only `first_message` is overridable.
8. What are the measured mouth-to-ear latencies of Speech Engine and ElevenAgents? There are no vendor numbers for full-loop latency.
9. What auth header format does ElevenAgents use when calling a custom LLM (Bearer secret, custom header)?
10. What is the Scribe v2 Realtime maximum session duration (reportedly 10 minutes)? Does an idle open session count against realtime STT concurrency?
11. Does `scribe_v2_realtime` support `commit_strategy=turn_prediction` ("only for models that predict turns")?
12. Do audio tags appear in `alignment` (characters and timings)?
13. Is the `opus_48000_*` output containerized (Ogg/WebM) and so playable via MSE?
14. Is Text to Dialogue priced exactly at the per-model TTS character rate?
15. Is per-agent zero-retention mode plan-gated?
16. Will v4 behavior drift (audio-tag reliability is "still being fine-tuned"), and when will PVC support for v4 finish rolling out? Do Flash and v4 timbres of the same `voice_id` sound close enough for call/narration consistency?
17. Do `previous_request_ids` and `previous_text`/`future_text` work with `eleven_v4` on TTD ("Not supported by every model")?

---

## Sources

### ElevenLabs documentation (read 2026-10-12)

1. https://elevenlabs.io/docs/overview/models
2. https://elevenlabs.io/docs/overview/capabilities/text-to-speech
3. https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4
4. https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices
5. https://elevenlabs.io/docs/eleven-api/choosing-the-right-model
6. https://elevenlabs.io/docs/api-reference/streaming
7. https://elevenlabs.io/docs/api-reference/text-to-speech/convert
8. https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps
9. https://elevenlabs.io/docs/api-reference/text-to-speech/stream
10. https://elevenlabs.io/docs/api-reference/text-to-speech/stream-with-timestamps
11. https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input
12. https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input
13. https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tts
14. https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/multi-context-web-socket
15. https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets
16. https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd
17. https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/streaming
18. https://elevenlabs.io/docs/eleven-api/concepts/audio-streaming
19. https://elevenlabs.io/docs/eleven-api/concepts/latency
20. https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization
21. https://elevenlabs.io/docs/help-center/technical/can-i-reduce-api-latency
22. https://elevenlabs.io/docs/help-center/technical/how-can-i-keep-the-websocket-open
23. https://elevenlabs.io/docs/help-center/technical/what-is-the-text-to-speech-web-sockets-api
24. https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert
25. https://elevenlabs.io/docs/api-reference/text-to-dialogue/stream
26. https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps
27. https://elevenlabs.io/docs/api-reference/text-to-dialogue/stream-with-timestamps
28. https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket
29. https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-multi-websocket
30. https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue
31. https://elevenlabs.io/docs/eleven-api/guides/cookbooks/text-to-dialogue
32. https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/what-is-dialogue-mode
33. https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime
34. https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/client-side-streaming
35. https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/server-side-streaming
36. https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/event-reference
37. https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/transcripts-and-commit-strategies
38. https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/transcript-editing
39. https://elevenlabs.io/docs/eleven-api/guides/cookbooks/speech-to-text
40. https://elevenlabs.io/docs/overview/capabilities/speech-to-text
41. https://elevenlabs.io/docs/eleven-api/resources/libraries/scribe-stt/javascript-scribe
42. https://elevenlabs.io/docs/eleven-api/resources/libraries/scribe-stt/react-scribe
43. https://elevenlabs.io/docs/api-reference/tokens/create
44. https://elevenlabs.io/docs/overview/capabilities/speech-engine
45. https://elevenlabs.io/docs/api-reference/speech-engine/create
46. https://elevenlabs.io/docs/api-reference/speech-engine/speech-engine-upstream
47. https://elevenlabs.io/docs/eleven-api/guides/cookbooks/speech-engine
48. https://elevenlabs.io/docs/eleven-api/resources/libraries/speech-engine/python-sdk-reference
49. https://elevenlabs.io/docs/eleven-api/resources/libraries/speech-engine/javascript-sdk-reference
50. https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-engine/livekit-integration
51. https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-engine/pipecat-integration
52. https://elevenlabs.io/docs/eleven-agents/overview
53. https://elevenlabs.io/docs/eleven-agents/customization/llm
54. https://elevenlabs.io/docs/eleven-agents/customization/llm/custom-llm
55. https://elevenlabs.io/docs/eleven-agents/customization/llm/llm-cascading
56. https://elevenlabs.io/docs/eleven-agents/customization/llm/optimizing-costs
57. https://elevenlabs.io/docs/eleven-agents/customization/personalization
58. https://elevenlabs.io/docs/eleven-agents/customization/personalization/overrides
59. https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables
60. https://elevenlabs.io/docs/eleven-agents/customization/authentication
61. https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow
62. https://elevenlabs.io/docs/eleven-agents/customization/events/client-events
63. https://elevenlabs.io/docs/eleven-agents/customization/events/client-to-server-events
64. https://elevenlabs.io/docs/eleven-agents/customization/voice
65. https://elevenlabs.io/docs/eleven-agents/customization/privacy/retention
66. https://elevenlabs.io/docs/eleven-agents/customization/privacy/zrm
67. https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks
68. https://elevenlabs.io/docs/eleven-agents/guides/burst-pricing
69. https://elevenlabs.io/docs/eleven-agents/libraries/python
70. https://elevenlabs.io/docs/eleven-agents/libraries/react
71. https://elevenlabs.io/docs/eleven-agents/libraries/web-sockets
72. https://elevenlabs.io/docs/eleven-agents/api-reference/eleven-agents/websocket
73. https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/custom-llm-integration
74. https://elevenlabs.io/docs/api-reference/conversations/get-signed-url
75. https://elevenlabs.io/docs/api-reference/conversations/get-webrtc-token
76. https://elevenlabs.io/docs/help-center/product/eleven-agents/how-much-does-eleven-agents-cost
77. https://elevenlabs.io/docs/api-reference/forced-alignment/create
78. https://elevenlabs.io/docs/overview/capabilities/forced-alignment
79. https://elevenlabs.io/docs/eleven-api/resources/ip-allowlisting
80. https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode
81. https://elevenlabs.io/docs/overview/administration/data-residency
82. https://elevenlabs.io/docs/overview/administration/billing

### ElevenLabs changelog, pricing and SDK

83. https://elevenlabs.io/docs/changelog/2026/2/9 (`eleven_v3_conversational` for agents)
84. https://elevenlabs.io/docs/changelog/2026/5/25 (Speech Engine launch)
85. https://elevenlabs.io/docs/changelog/2026/6/8 (`scribe_v1` removal on 2026-07-09)
86. https://elevenlabs.io/docs/changelog/2026/8/17 (client SDK: self-hosted Scribe worklets, realtime STT options)
87. https://elevenlabs.io/docs/changelog/2026/9/28 (Eleven v4 and v4 Turbo; transcript editing)
88. https://elevenlabs.io/docs/changelog/2026/10/5 (agents TTS default changed to `eleven_v4_turbo`)
89. https://elevenlabs.io/pricing/api
90. https://elevenlabs.io/pricing/agents
91. https://github.com/elevenlabs/elevenlabs-python/blob/main/src/elevenlabs/realtime_tts.py

### Third-party (secondary)

92. https://github.com/livekit/agents/issues/5844 (1008 disconnects when multi-context contexts are not closed)
93. https://www.npmjs.com/package/elevenlabs-latency

### Codebase (read-only)

94. `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py` (:21, :22, :28, :38–42, :244, :268, :315, :317, :392, :404, :593, :605, :610, :753)
95. `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py` (:59, :63, :66, :1239, :1246, :1567, :1587, :1601, :1651, :1659, :1763, :1785–1821, :1869, :2286)
96. `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/sentence_buffer.py` (:17, :66, :97–123, :126–132)
97. `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py` (:24, :25, :41, :85, :91, :123, :153)
98. `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/delivery.py` (:342, :352, :359, :362)
99. `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/transcript_sanitizer.py` (:51, :170)
100. `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py` (:1129, :1174, :1433)
101. `/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_segments.py` (:15)
102. `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py` (:36–44)
103. `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/runtime/callbot_chat.v2.json` (:32)
104. `/home/andres/WebstormProjects/magic-worlds/src/features/call/components/CallScreen.tsx` (:60)
105. `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/audio/voicePlaybackBuffer.ts` (:31, :261)
106. `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/audio/voiceVadProcessor.worklet.js` (:36)
107. `/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/voiceSocket.ts` (:18, :376)
108. `/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/index.ts` (:3523, :3544)
109. `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/TurnNarration.tsx`
110. `/home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/research/00_current_tts_review.md` (:187–240)
111. `/home/andres/WebstormProjects/magic-worlds/docs/voice-calls-latency-review-2026-10-11.md` (:27, :29, :43, :74–80, :101)

### Sources added during verification (2026-10-12)

112. https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/batch/keyterm-prompting (realtime keyterm limits 50 × 20 characters)
113. https://elevenlabs.io/docs/changelog/llms.txt (latest changelog entry is 2026-10-05)
114. https://elevenlabs.io/docs/eleven-agents/customization/privacy/zrm (per-agent ZRM)
115. https://raw.githubusercontent.com/elevenlabs/elevenlabs-python/main/src/elevenlabs/realtime_tts.py (re-read; `chunk_length_schedule=[50]`, `try_trigger_generation=True`, splitter set)

---

## Verification log (2026-10-12)

An adversarial re-check against live official sources, fetched on 2026-10-12 as `.md` pages from elevenlabs.io/docs and as HTML from elevenlabs.io/pricing. "Corrected" means the note was edited in place above.

| # | Claim | Status | Source |
|---|---|---|---|
| 1 | Model IDs `eleven_v4`, `eleven_v4_turbo`, `eleven_v3`, `eleven_v3_conversational`, `eleven_flash_v2_5`, `eleven_multilingual_v2` exist; Turbo v2/v2.5 deprecated in favor of Flash | confirmed | https://elevenlabs.io/docs/overview/models |
| 2 | Latencies: v4 Turbo about 100 ms median, v3 Conversational about 280 ms (was [secondary]), Flash about 75 ms, Scribe v2 Realtime about 150 ms | confirmed | https://elevenlabs.io/docs/overview/models |
| 3 | Character limits: v4 10,000; v3 5,000; Flash v2.5 40,000 | confirmed | https://elevenlabs.io/docs/overview/models |
| 4 | v4 via the TTD API; v4 Turbo via the TTD WebSocket; launched 2026-09-28 | confirmed | https://elevenlabs.io/docs/changelog/2026/9/28 |
| 5 | TTS WebSockets reject `eleven_v3`/`eleven_v4` | confirmed | https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets ; https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tts |
| 6 | `eleven_v3` usable only via TTD | corrected: v3 also works on TTS HTTP, but not on the TTS WS | https://elevenlabs.io/docs/overview/models |
| 7 | TTD WS reference says v3-only (default `eleven_v3_conversational`), while the guide/comparison say v3 or v4; v4 Turbo allows 1 voice, v4 up to 10 | confirmed (documentation drift still present) | https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket ; https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd |
| 8 | TTD multi-context: v3-only, 5 contexts, protocol errors close the connection, 20 s per-context idle | confirmed | https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-multi-websocket |
| 9 | `close_context` is a clean interruption primitive | corrected: it flushes / "continue[s] flushing" already-flushed audio; barge-in requires frame dropping | https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input ; https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-multi-websocket |
| 10 | TTS multi-context: 5 contexts, 20 s default, `inactivity_timeout` max 180, `{"text":""}` is a context keepalive | confirmed | https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/multi-context-web-socket |
| 11 | Flush only at end of utterance | corrected: the guide recommends `flush` at the end of complete sentences | https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/multi-context-web-socket |
| 12 | TTS WS query params: `model_id` default `eleven_multilingual_v2`, `inactivity_timeout` 20/max 180, `auto_mode`/`sync_alignment` default false, seed 0..4294967295 | confirmed | https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input |
| 13 | Default `chunk_length_schedule` [120,160,250,290], items 50–500; `try_trigger_generation` semantics | confirmed | https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input |
| 14 | Single-context keepalive is `" "`; `""` closes (EOS) | confirmed | https://elevenlabs.io/docs/help-center/technical/how-can-i-keep-the-websocket-open |
| 15 | Python SDK `convert_realtime` uses `[50]`, `try_trigger_generation=True` and the splitter set | confirmed | https://github.com/elevenlabs/elevenlabs-python/blob/main/src/elevenlabs/realtime_tts.py |
| 16 | TTS WS concurrency counts only generation time; TTD WS holds 1 session per open connection; session pool 14/21/35/70/105/105 | confirmed | https://elevenlabs.io/docs/overview/models |
| 17 | Concurrency (Multilingual v2 / Flash / STT / Realtime STT): Pro 10/20/40/30, Scale and Business 15/30/60/45 | confirmed | https://elevenlabs.io/docs/overview/models |
| 18 | TTD HTTP: 10 unique voices, ≤2,000 characters recommended, `model_id` default `eleven_v3`, `previous_text`/`future_text` ≤100, request ids ≤3 | confirmed | https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps |
| 19 | TTD `settings: {stability, similarity_boost}` | corrected: the field is `similarity` | https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps |
| 20 | `voice_segments` shape (end index exclusive, `dialogue_input_index`) | confirmed | https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps |
| 21 | v4: Stability + Similarity only, no Style/Speed, no SSML; IPA in `/…/`; native-accent behavior | confirmed | https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4 ; https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices |
| 22 | `<break>` up to 3 s on v2 models; not supported on v3/v4; `[laughs]`, `[whispers]`, `[sighs]` are listed tags | confirmed | https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices |
| 23 | Flash v2.5 normalization off by default; `apply_text_normalization=on` for v2.5 is Enterprise only | confirmed | https://elevenlabs.io/docs/overview/models |
| 24 | Pricing: v4 $0.08, v4 Turbo $0.04, v3 $0.08, v3 Conversational $0.04, Multilingual v2 $0.08, Flash $0.04 per 1K characters; promo 72% off until Oct 12 | confirmed | https://elevenlabs.io/pricing/api |
| 25 | Scribe v2 Realtime $0.39/h (+$0.08 keyterms, +$0.12 editing); batch $0.22/h | confirmed (batch add-ons $0.05/$0.07 added) | https://elevenlabs.io/pricing/api |
| 26 | Realtime STT params, `audio_format` enum, `commit_strategy` manual/vad/turn_prediction, `keepalive_interval_ms` 500–10000 | confirmed | https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime |
| 27 | Manual commit is the default; auto-commit after about 36 s; processing starts after 2 s; 15 s server close without client messages | confirmed | https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/transcripts-and-commit-strategies |
| 28 | Realtime keyterms 50 × ≤20 characters | confirmed (source added) | https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/batch/keyterm-prompting |
| 29 | Chunks 0.1–1 s, 16 kHz recommended (cited to the server-side streaming page) | corrected (source moved) | https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/transcripts-and-commit-strategies |
| 30 | Transcript editing: 2,000 characters, +30%, minimum 10 s, not with `entity_detection` | confirmed (also flagged experimental) | https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/transcript-editing |
| 31 | Single-use tokens: `realtime_scribe` / `batch_scribe` / `tts_websocket`, 15 min, consumed on use | confirmed | https://elevenlabs.io/docs/api-reference/tokens/create |
| 32 | `scribe_v1` "was removed on 2026-07-09" | corrected: the changelog announced deprecation with removal scheduled for 2026-07-09; actual removal not confirmed | https://elevenlabs.io/docs/changelog/2026/6/8 |
| 33 | Scribe realtime max session 10 min | unverified (no number in the docs; the error text implies a plan-dependent cap) | https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/event-reference |
| 34 | Agents conversational TTS default changed `eleven_flash_v2` → `eleven_v4_turbo` on 2026-10-05 | confirmed | https://elevenlabs.io/docs/changelog/2026/10/5 |
| 35 | Speech Engine launched 2026-05-25; inverted WS; JWT HS256 / `iss` / `sub` | confirmed | https://elevenlabs.io/docs/changelog/2026/5/25 ; https://elevenlabs.io/docs/api-reference/speech-engine/speech-engine-upstream |
| 36 | Stale `event_id` discard (cited to the capability page) | corrected (source moved to the upstream reference) | https://elevenlabs.io/docs/api-reference/speech-engine/speech-engine-upstream |
| 37 | Speech Engine config: TTS default `eleven_v4_turbo`, ASR `scribe_realtime`/`scribe_v2_turbo`, `turn_model` default `turn_v3`, `cascade_timeout_seconds` 2–15 (default 4), overrides only `first_message` | confirmed | https://elevenlabs.io/docs/api-reference/speech-engine/create |
| 38 | Speech Engine privacy/burst defaults | added: `record_voice` true, `retention_days` -1 (unlimited), `bursting_enabled` true | https://elevenlabs.io/docs/api-reference/speech-engine/create |
| 39 | Speech Engine/Agents $0.08/min, burst $0.16, included minutes/concurrency 15/4 … 12,375/40 (was [secondary]) | confirmed | https://elevenlabs.io/pricing/api ; https://elevenlabs.io/pricing/agents |
| 40 | Burst up to 3x (cap 300) at 2x price | confirmed (added: burst calls are deprioritized) | https://elevenlabs.io/docs/eleven-agents/guides/burst-pricing |
| 41 | Agents: 95% silence discount >10 s; LLM passed through; "zero for custom LLM" | confirmed / unverified (the custom-LLM zero cost is our inference) | https://elevenlabs.io/docs/help-center/product/eleven-agents/how-much-does-eleven-agents-cost |
| 42 | Custom LLM retried on the same endpoint, no fallback (was [secondary]) | confirmed | https://elevenlabs.io/docs/eleven-agents/customization/llm/llm-cascading |
| 43 | Conversation flow: max duration 60–7,200 s (default 600), `turn_timeout` 1–30 s, soft timeout 0.5–8 s (3 s recommended) | confirmed | https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow |
| 44 | Post-call webhooks: types, HMAC `ElevenLabs-Signature`, auto-disable after ≥10 failures and >7 days | confirmed | https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks |
| 45 | Overrides incl. voice ID, ASR keywords ≤50; signed URL 15 min | confirmed | https://elevenlabs.io/docs/eleven-agents/customization/personalization/overrides ; https://elevenlabs.io/docs/eleven-agents/customization/authentication |
| 46 | Agents retention default 2 years; `audio` client event not sent over WebRTC | confirmed (conflicts with the Speech Engine API default of -1; see #38) | https://elevenlabs.io/docs/eleven-agents/customization/privacy/retention ; https://elevenlabs.io/docs/eleven-agents/customization/events/client-events |
| 47 | ZRM (`enable_logging=false`) is Enterprise only | confirmed (added: disables request stitching) | https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode ; https://elevenlabs.io/docs/api-reference/text-to-speech/stream |
| 48 | Data-residency hosts EU/IN/SG | corrected/expanded: an Enterprise feature with separate workspaces and keys | https://elevenlabs.io/docs/overview/administration/data-residency |
| 49 | Forced alignment limits 3 GB / 10 h / 675K characters | corrected: the API reference says the file must be <1 GB (the capability page says 3 GB) | https://elevenlabs.io/docs/api-reference/forced-alignment/create ; https://elevenlabs.io/docs/overview/capabilities/forced-alignment |
| 50 | Flash WS TTFB 100–150 ms (NA/EU/SEA), 150–200 ms (S/NE Asia); `x-region`; `api.us.elevenlabs.io`; PVC slower than IVC | confirmed | https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization |
| 51 | IP allowlist egress IPs (US/EU/Asia) | confirmed | https://elevenlabs.io/docs/eleven-api/resources/ip-allowlisting |
| 52 | TTS v4 on `/v1/text-to-speech/*` | unverified (docs still contradict each other; no later changelog) | https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices ; https://elevenlabs.io/docs/overview/models |
| 53 | PVCs need per-model fine-tuning for v4; Voice Design voices may underperform on v4 | added | https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4 |
| 54 | `language_code` unsupported on Multilingual v2; `previous_text` ignored when `previous_request_ids` is present | added | https://elevenlabs.io/docs/api-reference/text-to-speech/stream |
| 55 | Codebase spot-checks: `sentence_buffer.py:17` (soft cap 160), `engine.py:63`/`:66` (queue 4, 0.12 s), `route_chat.py:1433` (`enforce_quota` on segment 0), `delivery.py:352` (32 kHz), `streaming_tts_minimax.py:21`–`22` | confirmed | /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/sentence_buffer.py:17 ; /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:63 ; /home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:1433 ; /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/delivery.py:352 ; /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:21 |

**Still open after verification:**

- Billing of audio generated after `close_context` or flush.
- `isFinal` timing on TTS multi-context.
- v4 on the TTD multi-context socket and on TTS HTTP.
- The Scribe session cap value and idle-session concurrency.
- `turn_prediction` support on `scribe_v2_realtime`.
- Whether `opus_48000_*` is containerized.
- Speech Engine per-call voice selection.
