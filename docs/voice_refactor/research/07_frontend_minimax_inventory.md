# 07 — Frontend MiniMax and voice inventory (magic-worlds)

Research date: **2026-10-12**. Read-only: no code was changed.

## Scope

This document lists **every place in the frontend** (`/home/andres/WebstormProjects/magic-worlds`) that is tied to MiniMax or to voice/TTS. That covers `src/**`, `.storybook/`, the i18n locales, the docs and assistant knowledge content, and the stories, fixtures and tests. It is the work list for moving the UI from MiniMax to ElevenLabs.

For each touchpoint it records:
- what MiniMax concept the code encodes;
- what it should become with ElevenLabs;
- an action: **delete**, **rewrite for ElevenLabs**, **rename provider-neutral**, or **keep**.

The baseline review of the current stack is [00_current_tts_review.md](./00_current_tts_review.md). Backend migration is out of scope here, but backend routes are cited where the UI depends on their shape.

### How claims are cited
- **Codebase facts** cite an absolute path and line number.
  - Line numbers match the working tree on 2026-10-12: HEAD `f0f5769` plus the uncommitted changes.
  - `en.ts`, `es.ts` and `src/infrastructure/api/index.ts` have uncommitted edits and were re-checked at the end of this research. Expect small drift (±2 lines) if those files change again. Search by the symbol or key path named in each row.
- **External facts** carry a tag:

  | Tag | Meaning |
  |---|---|
  | `[verified: <url>]` | Read on an official ElevenLabs page today (2026-10-12). |
  | `[secondary: <url>]` | Non-official source. |
  | `[unverified]` | From memory or inference. Confirm before relying on it. |

---

## Contents

0. [Key findings (read first)](#0-key-findings-read-first)
1. [ElevenLabs reference facts used by this inventory](#1-elevenlabs-reference-facts-used-by-this-inventory)
2. [Shared types (`src/shared/types`)](#2-shared-types-srcsharedtypes)
3. [API layer, sockets and feature flags](#3-api-layer-sockets-and-feature-flags)
4. [Admin voices console (`src/features/admin/voices/**`)](#4-admin-voices-console-srcfeaturesadminvoices)
5. [User Voice Studio and voice-assignment surfaces](#5-user-voice-studio-and-voice-assignment-surfaces)
6. [Narration playback and call UI](#6-narration-playback-and-call-ui)
7. [i18n keys (`en.ts` / `es.ts`)](#7-i18n-keys-ents--ests)
8. [Docs, assistant knowledge, legal, marketing and repo docs](#8-docs-assistant-knowledge-legal-marketing-and-repo-docs)
9. [Stories, fixtures and tests](#9-stories-fixtures-and-tests)
10. [Theme songs (MiniMax Music via fal.ai): a separate decision](#10-theme-songs-minimax-music-via-falai-a-separate-decision)
11. [Cross-cutting recommendations for the UI migration](#11-cross-cutting-recommendations-for-the-ui-migration)
12. [CHANGE CHECKLIST](#12-change-checklist)
13. [Open questions](#13-open-questions)
14. [Sources](#14-sources)

---

## 0. Key findings (read first)

1. **The frontend never calls MiniMax directly.**
   - Every speech path goes through the BFF (`apiService`, `ChatSocket`, `VoiceSocket`).
   - The voice socket refuses to send provider payload keys (`/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/voiceSocket.ts:64-79`).
   - So the migration is mostly about **contracts and copy**, not network code.
   - The MiniMax coupling sits in four places: the **types**, the **admin console**, the **user preset recipe**, and the **text and legal copy**.

2. **The voice recipe is MiniMax-shaped end to end.**
   - `CharacterVoice` and `VoicePreset` carry `speed`/`vol`/`pitch`/`emotion`/`language_boost` (`/home/andres/WebstormProjects/magic-worlds/src/shared/types/voicePreset.types.ts:8-48`).
   - ElevenLabs has no `pitch` or `volume` request parameter. Its per-request settings are `stability`, `similarity_boost`, `style`, `use_speaker_boost` and `speed`, plus a top-level `language_code` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert].
   - Emotion is not an enum in ElevenLabs. On v3/v4 it is expressed with inline **audio tags** such as `[whispers]` or `[sighs]` [verified: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-do-audio-tags-work-with-eleven-v3-and-v4.md].

3. **Parsers silently drop unknown voice fields.** Both voice readers rebuild the object from a whitelist of MiniMax fields:
   - `readCharacterVoice` (`/home/andres/WebstormProjects/magic-worlds/src/utils/cardTransforms.ts:57-72`);
   - `snapshotVoice` (`/home/andres/WebstormProjects/magic-worlds/src/features/interaction/utils/adventureSnapshot.ts:81-96`).

   Suppose the backend adds `stability`, `similarity_boost` or a `voice_name`. These readers drop them on read. A save from `CharacterCreator` (`.../CharacterCreator.tsx:249`) or `updateAdventureSnapshot` (`.../infrastructure/api/index.ts:4089-4102`) then **writes the stripped object back**. Both readers must change in the same release as the types.

   *Added during verification:* the opposite direction is also strict. The BFF's `CharacterVoice` Pydantic model declares `extra = "forbid"` and `strict = True` (`/home/andres/PycharmProjects/magic-worlds-api/src/models/character.py:11-24,37-39`), and the preset payloads use `ConfigDict(extra="forbid", strict=True)` (`/home/andres/PycharmProjects/magic-worlds-api/src/models/voice_preset.py:11,43`). If the SPA starts sending ElevenLabs fields before the backend accepts them, every character save and preset save fails with a 422. **Deployment order: backend schema first (accepting both shapes), then the frontend.**

4. **The call audio frame type pins MiniMax output.**
   - `voice_audio_chunk` is typed `content_type: 'audio/mpeg'` and `sample_rate: 32000` (`/home/andres/WebstormProjects/magic-worlds/src/shared/types/voice.types.ts:164-174`).
   - ElevenLabs offers **no 32 kHz MP3**. Its MP3 formats are `mp3_22050_32`, `mp3_24000_48`, and `mp3_44100_{32,64,96,128,192}`. `pcm_32000` and `wav_32000` exist [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert].
   - The literal type must be widened. The browser player (`voicePlaybackBuffer.ts`) handles MPEG-1, MPEG-2 and MPEG-2.5 Layer III frames (44.1/48/32, 22.05/24/16 and 11.025/12/8 kHz) (`/home/andres/WebstormProjects/magic-worlds/src/features/interaction/audio/voicePlaybackBuffer.ts:659-686`). So **any ElevenLabs MP3 format can play without player changes**.
   - *Added during verification:* the BFF enforces the same literal. `build_voice_audio_chunk` raises `"Voice audio settings must be valid 32 kHz mono MP3"` when `sample_rate != 32_000` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/delivery.py:349-353`), and the MiniMax streamer pins `MINIMAX_SAMPLE_RATE = 32_000` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:22`). Widen the backend guard together with `voice.types.ts:170`.

5. **Admin console concepts that have no ElevenLabs equivalent and should be deleted:**
   - MiniMax custom `voice_id` rules (`voiceIdRules.ts`). ElevenLabs assigns `voice_id`; you send a `name` [verified: https://elevenlabs.io/docs/api-reference/voices/ivc/create].
   - Language derived from the id prefix (`voiceLanguage.ts`). ElevenLabs voices carry `labels` and `verified_languages[]` [verified: https://elevenlabs.io/docs/api-reference/voices/search].
   - The two-step clone upload (`file_id`), `clone_prompt`, and `need_volume_normalization`.
   - Hex audio decoding (`hexAudio.ts`). ElevenLabs returns binary audio, or base64 in JSON variants [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps].
   - The MiniMax reference drawer, emotions, `language_boost` names, and the sample-rate and format selectors.

6. **Voice design becomes a two-step flow that returns several previews.**
   - Step 1: `POST /v1/text-to-voice/design` returns `previews[]`. Each has `audio_base_64` and `generated_voice_id`.
   - Step 2: `POST /v1/text-to-voice` saves one preview with `voice_name` + `voice_description` + `generated_voice_id`.
   - The preview text must be **100–1000 characters**.
   - Sources: [verified: https://elevenlabs.io/docs/api-reference/text-to-voice/design], [verified: https://elevenlabs.io/docs/api-reference/text-to-voice/create].
   - The current form expects a single `{voice_id, trial_audio}` (`/home/andres/WebstormProjects/magic-worlds/src/shared/types/adminVoice.types.ts:27-37`).
   - The seeded `DEFAULT_PREVIEW_TEXT` is exactly 100 characters (`.../admin/voices/constants.ts:27-28`), so it passes by a single character.

7. **The catalog model changes from "MiniMax system voices, filtered on the client" to "ElevenLabs voices, paginated on the server".**
   - `GET /v2/voices` takes `page_size` ≤ 100 and `next_page_token`, with filters `search`, `category` and `voice_type` [verified: https://elevenlabs.io/docs/api-reference/voices/search].
   - There is also a Voice Library (`GET /v1/shared-voices`, added to an account with `POST /v1/voices/add/{public_user_id}/{voice_id}`) [verified: https://elevenlabs.io/docs/api-reference/voices/voice-library/get-shared], [verified: https://elevenlabs.io/docs/api-reference/voices/voice-library/share].
   - Every voice has a `preview_url`. The user picker can play it **without paid synthesis**, which also removes the unmetered-preview risk (baseline issue #1) for catalog browsing. Whether `preview_url` costs no credits is [unverified]; it is a hosted sample URL.

8. **ElevenLabs model choice changes which recipe controls apply.**
   - On `eleven_v3`: speed, similarity and speaker boost are not available [verified: https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech].
   - On `eleven_v4`: "Style and Speed sliders are not available … and SSML is not supported" [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4.md].
   - So the preset UI must be **model-aware**. The cleanest design is a BFF "voice capabilities" endpoint that drives the controls; see §11.

9. **The text-artifact syntax depends on the model.**

   | Effect | MiniMax syntax | ElevenLabs syntax |
   |---|---|---|
   | Pause | `<#0.4#>` | SSML `<break time="0.4s" />`, up to 3 s. **Not supported on v3/v4**. |
   | Interjection | `(sighs)` | `[sighs]`, an audio tag on v3/v4/v4 Turbo. |
   | Pronunciation | `word/(ipa)` | v4 native IPA between slashes; SSML `<phoneme>` on `eleven_flash_v2` only; or pronunciation dictionaries. |

   Sources: [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices], [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/pronunciation-dictionaries.md].
   - Today's admin default test text `<#0.4#> (sighs)` (`.../constants.ts:29-30`) would be spoken or mangled on ElevenLabs.
   - The live callbot also emits the MiniMax `<#x#>` and `(laughs)` syntax; see baseline §2 path B.

10. **User-visible and legal copy names MiniMax as the TTS subprocessor.**
    - The consent disclosure: `interaction.voiceConsent.disclosures.processing` (en `src/app/i18n/locales/en.ts:4823`, es `:4833`).
    - The privacy policy: `legal.pages.privacy.sections.voice.body1` (en `:2047`, es `:2057`).
    - The provider change should **bump the backend consent version** (today `DEFAULT_VOICE_CONSENT_VERSION = "voice-v1"`, `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:26`; added during verification). The frontend already supports `consent_stale` and re-consent (`/home/andres/WebstormProjects/magic-worlds/src/shared/types/voice.types.ts:38`, `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/VoiceConsentModal.tsx:28`).
    - ElevenLabs keeps request history by default. `enable_logging=false` ("zero retention") is Enterprise-only [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert]. The "not stored" privacy wording must be reviewed.

11. **The user Voice Studio imports admin-console modules.** These are `constants.ts`, `ControlSlider`, `hexAudio`, and `voiceLanguage`:
    - `/home/andres/WebstormProjects/magic-worlds/src/features/voices/recipe.ts:1`
    - `.../voices/components/PresetRecipeControls.tsx:3-4`
    - `.../voices/components/SystemVoicePicker.tsx:6-7`
    - `.../voices/usePreviewVoice.ts:10`

    Rewriting the admin console therefore breaks the user studio. Extract a provider-neutral shared voice module first.

12. **Scope boundary: theme songs are a separate decision.** "MiniMax Music 3" runs through **fal.ai**, not the MiniMax API (`/home/andres/WebstormProjects/magic-worlds/src/shared/types/media.types.ts:76-82`). Whether it is replaced, for example by ElevenLabs Music `music_v2_5` [verified: https://elevenlabs.io/docs/overview/models], is a product decision. It is listed separately in §10.

---

## 1. ElevenLabs reference facts used by this inventory

These are the facts needed to decide "what each touchpoint becomes". The detailed capability research belongs in the sibling research files. Here each fact is only as deep as the UI mapping requires.

| # | Fact | Confidence |
|---|---|---|
| E1 | `POST /v1/text-to-speech/{voice_id}` returns the **binary audio file**, not JSON or hex. The body takes `text`, `model_id` (default `eleven_multilingual_v2`), `language_code` (ISO 639-1; "Not supported for `multilingual_v2`"), `voice_settings`, `pronunciation_dictionary_locators` (≤ 3), `seed` (0–4294967295), `previous_text`/`next_text`, `previous_request_ids`/`next_request_ids` (≤ 3 each), `apply_text_normalization` (`auto`/`on`/`off`), `apply_language_text_normalization`, and `use_pvc_as_ivc`. The query takes `output_format` (default `mp3_44100_128`) and `enable_logging` (default `true`; `false` = zero retention, Enterprise only). | [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert] |
| E2 | `output_format` values: `mp3_22050_32`, `mp3_24000_48`, `mp3_44100_32/64/96/128/192`, `opus_48000_32/64/96/128/192`, `pcm_8000/16000/22050/24000/32000/44100/48000`, `wav_*` at the same rates, `ulaw_8000`, `alaw_8000`. 192 kbps MP3 needs the Creator tier or above. 44.1 kHz PCM/WAV needs Pro or above. **There is no 32 kHz MP3.** | [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert] |
| E3 | `voice_settings` defaults: `stability` 0.5, `similarity_boost` 0.75, `style` 0, `use_speaker_boost` true, `speed` 1.0. The API reference states no numeric ranges. | [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert], [verified: https://elevenlabs.io/docs/api-reference/voices/settings/update] |
| E4 | Speed range is 0.7–1.2 per the product docs. On Eleven v3, speed, similarity and speaker boost are not available. The SDK reference lists a wider 0.25–4.0 range, which conflicts. | [verified: https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech]; conflicting [secondary: https://www.mintlify.com/elevenlabs/elevenlabs-python/api-reference/voices/settings] |
| E5 | Eleven v4: "Style and Speed sliders are not available in Eleven v4, and SSML is not supported". Stability and similarity apply. It supports audio tags and 70+ languages per the v4 page (the models page says 90+). | [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4.md] |
| E6 | TTS models: `eleven_v4` (10,000 characters), `eleven_v4_turbo` (~100 ms), `eleven_v3` (5,000 characters), `eleven_v3_conversational` (~280 ms), `eleven_multilingual_v2` (10,000 characters, 29 languages), `eleven_flash_v2_5` (40,000 characters, 32 languages, ~75 ms), `eleven_flash_v2` (English). `eleven_turbo_v2_5` and `eleven_turbo_v2` are **deprecated**. Voice design: `eleven_ttv_v3`, `eleven_multilingual_ttv_v2`. STT: `scribe_v2`, `scribe_v2_realtime`. Music: `music_v2_5`, `music_v2`, `music_v1`. | [verified: https://elevenlabs.io/docs/overview/models] |
| E7 | Eleven v4 and v4 Turbo launched around 2026-09-28. | [secondary: https://testingcatalog.com/elevenlabs-launches-eleven-v4-and-v4-turbo-voice-models], [secondary: https://www.vktr.com/ai-platforms/elevenlabs-launches-eleven-v4-and-v4-turbo/] |
| E8 | **Pauses:** `<break time="x.xs" />`, up to 3 s; "Eleven v4 and Eleven v3 do not support SSML break tags". **Phoneme tags:** "only compatible with the `eleven_flash_v2`". **IPA:** v4 has native IPA support written between slashes. **Alias tags** are the fallback for Multilingual v2. | [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices] |
| E9 | Audio tags are inline square brackets, e.g. `[curious]`, `[whispers]`, `[shouts]`, `[laughs]`, `[clears throat]`, `[sighs]`. Supported on `eleven_v4`, `eleven_v3` and `eleven_v4_turbo`. | [verified: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-do-audio-tags-work-with-eleven-v3-and-v4.md] |
| E10 | Pronunciation-dictionary phoneme rules "only work with eleven_v4, eleven_flash_v2 and eleven_v3". Other models use alias rules. Dictionaries are `.pls` files (IPA or CMU) and are case-sensitive. | [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/pronunciation-dictionaries.md] |
| E11 | `GET /v2/voices` takes `page_size` (default 10, max 100), `next_page_token`, `search`, `sort` (`created_at_unix`/`name`), `voice_type` (`personal`, `community`, `default`, `workspace`, `non-default`, `non-community`, `saved`), `category` (`premade`, `cloned`, `generated`, `professional`), `voice_ids` (≤ 100), plus `gender`/`age`/`accent`/`language`/`use_cases` filters. Each voice has `voice_id`, `name`, `description`, `preview_url`, `category`, `labels{}`, `settings`, `verified_languages[{language, model_id, accent?, locale?, preview_url?}]`, `is_owner`, `created_at_unix` and `sharing`. | [verified: https://elevenlabs.io/docs/api-reference/voices/search] |
| E12 | Voice Library: `GET /v1/shared-voices` (`page_size` ≤ 100, default 30; filters `category`/`gender`/`age`/`accent`/`language`/`locale`/`search`/`use_cases`/`descriptives`/`featured`; `sort`). Adding one: `POST /v1/voices/add/{public_user_id}/{voice_id}` with `{new_name, bookmarked}`. | [verified: https://elevenlabs.io/docs/api-reference/voices/voice-library/get-shared], [verified: https://elevenlabs.io/docs/api-reference/voices/voice-library/share] |
| E13 | Custom voice slots: Free 3, Starter 10, Creator 30, Pro 160, Scale 660, Business 660. "Voices saved from the Voice Library do not take up your custom voice slots." | [verified: https://elevenlabs.io/docs/help-center/account/general/how-many-voice-slots-do-i-get-per-tier-and-how-can-i-increase-it] |
| E14 | `DELETE /v1/voices/{voice_id}` returns `{"status":"ok"}`. It takes no voice-type segment. | [verified: https://elevenlabs.io/docs/api-reference/voices/delete] |
| E15 | Voice design: `POST /v1/text-to-voice/design` with `voice_description` (required), `model_id` (default `eleven_multilingual_ttv_v2`, or `eleven_ttv_v3`), `text` (100–1000 characters) or `auto_generate_text`, `loudness` (-1..1, default 0.5), `seed`, `guidance_scale` (default 5), `should_enhance`, `stream_previews`, `reference_audio_base64` and `prompt_strength` (ttv_v3 only), and `output_format` in the query. The response is `previews[{audio_base_64, generated_voice_id, media_type, duration_secs, language}]` plus `text`. | [verified: https://elevenlabs.io/docs/api-reference/text-to-voice/design] |
| E16 | Save a designed voice: `POST /v1/text-to-voice` with `voice_name`, `voice_description`, `generated_voice_id` (all required), plus optional `labels` and `played_not_selected_voice_ids`. It returns a voice object. | [verified: https://elevenlabs.io/docs/api-reference/text-to-voice/create] |
| E17 | Instant Voice Clone: `POST /v1/voices/add` (multipart) with `name`, `files[]`, `remove_background_noise`, `description`, `labels`. It returns `{voice_id, requires_verification}`. | [verified: https://elevenlabs.io/docs/api-reference/voices/ivc/create] |
| E18 | IVC guidance: "approximately 1-2 minutes of clear audio", "Avoid recording more than 3 minutes". The number of files does not matter, only the total length. MP3 at 128 kbps or more (the FAQ says 192 kbps). WAV "usually do[es] not improve clone quality". A consent confirmation is required. | [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning] |
| E19 | Voice remixing works on owned voices and on Library voices with an infinite notice period. It has four prompt-strength levels and its output is a v3 voice. | [verified: https://elevenlabs.io/docs/overview/capabilities/voice-remixing.md] |
| E20 | Text to Dialogue: `POST /v1/text-to-dialogue` with `inputs[{text, voice_id}]`. At most 10 unique voices; keep the total to 2,000 characters or less. Default model `eleven_v3`. `settings{stability, similarity}`. Returns binary audio. | [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert] |
| E21 | WebSockets: `stream-input` does **not** support `eleven_v3` or `eleven_v4`. The Text to Dialogue WebSocket (`/v1/text-to-dialogue/stream-input`) requires a `model_id` starting with `eleven_v3` or `eleven_v4`. The multi-context socket allows 5 concurrent contexts and has `flush` and `close_context`. The server sends base64 `audio` frames plus `isFinal`. | [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets.md], [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/multi-context-web-socket.md], [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tts.md] |
| E22 | `POST /v1/text-to-speech/{voice_id}/with-timestamps` returns `audio_base64` plus `alignment` and `normalized_alignment` (character start and end times). | [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps] |
| E23 | API TTS list price per 1K characters: v3 $0.08, v3 Conversational $0.04, Multilingual v2 $0.08, Flash/Turbo $0.04. **v4 $0.022 and v4 Turbo $0.011 are promotional prices "until Oct 12"** (list $0.08 and $0.04). Music costs $0.15/min. | [verified: https://elevenlabs.io/pricing/api] |
| E24 | ElevenLabs voice IDs are opaque strings. Unlike MiniMax system ids (`English_…`), they carry no language prefix; language comes from `labels` or `verified_languages`. | `labels` and `verified_languages` [verified: https://elevenlabs.io/docs/api-reference/voices/search]; that ids are opaque and unprefixed is [unverified] |

---

## 2. Shared types (`src/shared/types`)

### 2.1 `voicePreset.types.ts`: the recipe model (MiniMax-shaped)

| Line(s) | Symbol / field | MiniMax semantics today | ElevenLabs target | Action |
|---|---|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/shared/types/voicePreset.types.ts:1-5` | File doc comment | "base MiniMax system voice + speed/vol/pitch/emotion/language_boost" | Describe a provider-neutral recipe: a base voice plus ElevenLabs voice settings. | rename provider-neutral |
| `…/voicePreset.types.ts:6` | `import type { AdminVoiceEmotion }` | Couples the user recipe to the MiniMax emotion enum in the admin types. | Remove. | delete |
| `…/voicePreset.types.ts:9` | `CharacterVoice.voice_id` | MiniMax system voice id, e.g. `English_radiant_girl`. | ElevenLabs opaque `voice_id` (E11). Existing values need a **data migration** (§11.4). | keep (data migrates) |
| `…/voicePreset.types.ts:10` | `speed?` | MiniMax 0.5–2.0. | ElevenLabs `voice_settings.speed`, 0.7–1.2 (E4). Ignored on v3/v4 (E4, E5). | rewrite for ElevenLabs |
| `…/voicePreset.types.ts:11` | `vol?` | MiniMax volume, (0, 10]. Thoughts use `vol*0.6` server-side (baseline §2 path A). | No ElevenLabs request parameter (E1). Use loudness normalisation or a client gain if needed. | delete |
| `…/voicePreset.types.ts:12` | `pitch?` | MiniMax -12..12 semitones. | No ElevenLabs equivalent (E1). | delete |
| `…/voicePreset.types.ts:13` | `emotion?: AdminVoiceEmotion` | MiniMax enum of 7 emotions. | No enum. Optionally a default **audio-tag prefix** such as `[calm]` for v3/v4 (E9), or drop it. | delete (or rewrite as optional `delivery_tag`) |
| `…/voicePreset.types.ts:14` | `language_boost?` | MiniMax `'auto'` or a language *name* (`'English'`). | `language_code`, ISO 639-1 (`'en'`). Not supported on Multilingual v2 (E1). | rewrite for ElevenLabs |
| `…/voicePreset.types.ts:15-17` | `preset_id`, `preset_name` | Display linkage. | Same. | keep |
| (new) | — | — | Add `voice_name`, needed because ElevenLabs ids are not human-readable (E24). Add `stability`, `similarity_boost`, `style`, `use_speaker_boost`, an optional `model_id`, and a `provider`/schema version for safe migration. | rewrite for ElevenLabs |
| `…/voicePreset.types.ts:20-36` | `VoicePreset` (`base_voice_id`, `base_voice_name`, `speed`, `volume`, `pitch`, `emotion`, `language_boost`, `is_global`, …) | A MiniMax recipe over a system voice. | `base_voice_id`/`base_voice_name`/`is_global` stay. Replace `volume`/`pitch`/`emotion`/`language_boost` with ElevenLabs settings plus `language_code`. | rewrite for ElevenLabs |
| `…/voicePreset.types.ts:38-50` | `VoicePresetCreatePayload`, `VoicePresetUpdatePayload` | Same MiniMax fields. | Mirror the new `VoicePreset`. | rewrite for ElevenLabs |
| `…/voicePreset.types.ts:52-60` | `VoicePresetPreviewRequest` (`voice_id`, `text`, `speed`, `vol`, `pitch`, `emotion`, `language_boost`) | Sent to MiniMax `t2a_v2` (≤ 400 characters, backend). | ElevenLabs settings plus `language_code`, and optionally `model_id`. Prefer `preview_url` playback for catalog browsing (§11.3). | rewrite for ElevenLabs |

### 2.2 `adminVoice.types.ts`: the root console contract (entirely MiniMax)

| Line(s) | Symbol | MiniMax semantics | ElevenLabs target | Action |
|---|---|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/shared/types/adminVoice.types.ts:1-3` | `AdminVoiceQueryType` / `AdminVoiceConcreteType` = `system`/`voice_cloning`/`voice_generation`/`all` | MiniMax `get_voice` `voice_type`. | ElevenLabs `category` (`premade`/`cloned`/`generated`/`professional`) plus `voice_type` (`personal`/`default`/`workspace`/`community`/…) (E11). | rewrite for ElevenLabs |
| `…/adminVoice.types.ts:5-8` | `AdminVoiceBaseResponse {status_code, status_msg}` | MiniMax `base_resp` envelope leaked to the UI. | ElevenLabs uses HTTP status codes plus a `detail` list on 422. The BFF should map these to its own error envelope. | delete |
| `…/adminVoice.types.ts:10-17` | `AdminVoiceEntry {voice_id, voice_type, voice_name?, description: string[], created_time?, deletable}` | MiniMax returns `description` as an array, plus a string `created_time`. | `{voice_id, name, category, description?: string, labels, preview_url, verified_languages, created_at_unix, is_owner}` (E11). `deletable` is derived (owned and not premade). | rewrite for ElevenLabs |
| `…/adminVoice.types.ts:19-25` | `AdminVoiceGroups`, `AdminVoiceListResponse {voice_type, groups, base_resp}` | One unpaginated grouped dump. | A paginated `{voices, has_more, next_page_token, total_count}` (E11), or a BFF-cached catalog. | rewrite for ElevenLabs |
| `…/adminVoice.types.ts:27-31` | `AdminVoiceDesignRequest {prompt, preview_text, voice_id?}` | MiniMax `voice_design`. The caller may choose the id. | `{voice_description, text (100–1000) or auto_generate_text, model_id, loudness?, guidance_scale?, seed?, should_enhance?, reference_audio_base64?, prompt_strength?}` (E15). No caller-chosen id. | rewrite for ElevenLabs |
| `…/adminVoice.types.ts:33-37` | `AdminVoiceDesignResponse {voice_id, trial_audio (hex), base_resp}` | One designed voice is created immediately. | `{previews[{generated_voice_id, audio_base_64, media_type, duration_secs, language}], text}` (E15), plus a new **save** request and response (E16). | rewrite for ElevenLabs |
| `…/adminVoice.types.ts:39-44` | `AdminVoiceDeleteResponse` (`voice_type` excludes `system`) | MiniMax `delete_voice` needs a type. | ElevenLabs delete takes only `voice_id` and returns `{status:'ok'}` (E14). | rewrite for ElevenLabs |
| `…/adminVoice.types.ts:46-47` | `AdminVoiceModel = 'speech-2.8-hd' \| 'speech-2.8-turbo'` | MiniMax models. | ElevenLabs model ids (E6): `eleven_v4`, `eleven_v4_turbo`, `eleven_v3`, `eleven_multilingual_v2`, `eleven_flash_v2_5`. Prefer a server-provided list. | rewrite for ElevenLabs |
| `…/adminVoice.types.ts:49-58` | `AdminVoiceEmotion` (7 values; the comment says `fluent`/`whisper` need speech-2.6) | MiniMax enum. | No enum. Audio tags are free text (E9). | delete |
| `…/adminVoice.types.ts:60-61` | `AdminVoiceAudioFormat = 'mp3'\|'flac'\|'wav'` | MiniMax `audio_setting.format`. | The single ElevenLabs `output_format` string (E2). FLAC does not exist. | rewrite for ElevenLabs |
| `…/adminVoice.types.ts:63` | `AdminVoiceSampleRate = 8000…44100` | MiniMax `audio_setting.sample_rate`. | Folded into `output_format` (E2). | delete (merged) |
| `…/adminVoice.types.ts:65-77` | `AdminVoiceTestRequest` (comment at L68 cites "MiniMax defaults … mp3 @ 32kHz"; `vol` 0–10, `pitch` ±12, `language_boost`) | MiniMax `t2a_v2`. | `{voice_id, text, model_id?, output_format?, language_code?, voice_settings?{stability, similarity_boost, style, use_speaker_boost, speed}, seed?, apply_text_normalization?, pronunciation_dictionary_ids?}` (E1). | rewrite for ElevenLabs |
| `…/adminVoice.types.ts:79-90` | `AdminVoiceTestResponse {audio_hex, content_type, sample_rate, bitrate, usage_characters, base_resp, …}` | MiniMax hex audio plus `extra_info`. | The BFF returns **binary audio** (Blob) with metadata headers, or JSON with `audio_base64`. Whether ElevenLabs exposes a character count in response headers is [unverified]. | rewrite for ElevenLabs |
| `…/adminVoice.types.ts:92` | `AdminVoiceClonePurpose = 'voice_clone'\|'prompt_audio'` | MiniMax `files/upload` purpose. | No equivalent. | delete |
| `…/adminVoice.types.ts:94-100` | `AdminVoiceCloneUploadResponse {file_id, purpose, …}` | MiniMax two-step upload. | ElevenLabs IVC is one multipart call (E17). | delete |
| `…/adminVoice.types.ts:102-105` | `AdminVoiceClonePrompt {prompt_audio, prompt_text}` | MiniMax `clone_prompt`. | No equivalent. | delete |
| `…/adminVoice.types.ts:107-116` | `AdminVoiceCloneRequest {file_id, voice_id, clone_prompt?, text?, model?, language_boost?, need_noise_reduction?, need_volume_normalization?}` | MiniMax `voice_clone`. | `{name, files[], remove_background_noise?, description?, labels?}` (E17). Send it as multipart to the BFF. | rewrite for ElevenLabs |
| `…/adminVoice.types.ts:118-126` | `AdminVoiceCloneResponse {voice_id, voice_type:'voice_cloning', demo_audio_url?, demo_audio_hex?, input_sensitive, input_sensitive_type?, base_resp}` | MiniMax response. | `{voice_id, requires_verification}` (E17). | rewrite for ElevenLabs |

The barrel `/home/andres/WebstormProjects/magic-worlds/src/shared/types/index.ts:3,25-26` re-exports these types. Keep it; consider renaming the admin types `AdminVoice*` → `VoiceCatalog*`.

### 2.3 `voice.types.ts`: realtime call contract

| Line(s) | Item | MiniMax coupling | ElevenLabs target | Action |
|---|---|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/shared/types/voice.types.ts:11` | `VoiceAudioEncoding = 'audio/wav;codec=pcm_s16le'` | Uplink to Groq STT. Not MiniMax. | Unchanged. If Scribe replaces Groq, it still accepts PCM/WAV (out of scope). | keep |
| `…/voice.types.ts:35-56` | `VoiceErrorCategory` (`tts_unavailable`, `tts_stream_interrupted`, `tts_timeout`, `provider_submission`, `upstream_contract`) | Provider-neutral names. | Same categories. The BFF maps ElevenLabs errors onto them. | keep |
| `…/voice.types.ts:68-72` | `VoiceClientCapabilities {media_source_mp3, audio_worklet, media_recorder}` | `media_source_mp3` exists because MiniMax streams MP3. | Keep. Optionally add `pcm_worklet` so the BFF can choose `pcm_16000`/`pcm_24000` for lower latency (E2). | keep (optionally extend) |
| `…/voice.types.ts:164-174` | `voice_audio_chunk {content_type: 'audio/mpeg', sample_rate: 32000, channels: 1, data_b64}` | **MiniMax `audio_setting{sample_rate:32000, format:"mp3"}`** fixed as a literal type. | ElevenLabs has no 32 kHz MP3 (E2). Widen to `sample_rate: number` and accept `'audio/mpeg'` (plus `'audio/pcm'` if the PCM path is added). | rewrite for ElevenLabs |
| `…/voice.types.ts:235-236` | `CallTranscriptSegment.audio_url` ("Protected `/tts/assets/{id}.mp3`") | Storage path, not provider-specific. | Unchanged while the BFF keeps MP3 assets. | keep |

### 2.4 `interaction.types.ts`: narration frames and clips

| Line(s) | Item | Coupling | Action |
|---|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/shared/types/interaction.types.ts:37` | `ChatResponseSegmentKind = 'narrator'\|'speech'\|'thought'` | Drives per-segment voices. Neutral. | keep |
| `…/interaction.types.ts:59` | `ChatSpeakerRosterEntry.has_voice` | Neutral. | keep |
| `…/interaction.types.ts:97-114` | `TtsLifecycleStatus` (`synthesizing`, `mirroring`, `rate_limited`, `content_blocked`, …) mirrors the backend `TtsJobStatus` | `content_blocked` came from MiniMax codes 1026/1027 (baseline §2). ElevenLabs moderation errors can map to the same value. | keep |
| `…/interaction.types.ts:116-126` | `ChatTtsAsset {content_type: 'audio/mpeg', output_format?: 'mp3', sample_rate, bitrate, …}` | Matches today's MP3 storage. | Keep if the BFF stores ElevenLabs `mp3_44100_*` (recommended). Widen only if Opus or WAV storage is adopted. | keep |
| `…/interaction.types.ts:128-133` | `ChatTtsError {category, detail, code?, retry_after_seconds?}` | Neutral. | keep |
| `…/interaction.types.ts:135-163` | `ChatTtsSegmentClip`, `ChatTtsSegmentFrameFields` | Per-segment multi-voice clips. Neutral, but see the Text to Dialogue open question (§13 Q4). | keep |
| `…/interaction.types.ts:195` | Client frame `{type:'tts', assistant_message_id, turn_id, request_id?}` | Neutral. The client never sends voice or model. | keep |
| `…/interaction.types.ts:210-212` | Server frames `tts_job` / `tts_complete` / `tts_failed` | Neutral. | keep |

### 2.5 Other domain types

| Line(s) | Item | Coupling | Action |
|---|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/shared/types/character.types.ts:7,40-41` | `Character.voice?: CharacterVoice`; comment "system voice or a copied preset recipe" | Inherits the §2.1 shape. "System voice" is MiniMax wording. | rename provider-neutral (comment); type follows §2.1 |
| `/home/andres/WebstormProjects/magic-worlds/src/shared/types/adventure.types.ts:8,75-76` | `SnapshotCard.voice?: CharacterVoice` (a frozen copy) | Frozen MiniMax recipes inside existing snapshots. | keep (data migration, §11.4) |
| `…/adventure.types.ts:104-107` | `AdventureSnapshot.narrator_voice`, `narrate_thoughts` | Same. | keep |
| `…/adventure.types.ts:130-139` | `TurnEntry.tts*` fields and `ttsSegments` | Neutral lifecycle. | keep |
| `/home/andres/WebstormProjects/magic-worlds/src/shared/types/task.types.ts:11,24` | `BackgroundTaskOperation 'text_to_speech'`, `BackgroundTaskResult.tts_assets` | Neutral. | keep |
| `/home/andres/WebstormProjects/magic-worlds/src/shared/types/media.types.ts:66,72` | Theme-song asset `audio/mpeg`/`mp3` | fal.ai theme songs. | keep |
| `…/media.types.ts:76-82` | `ThemeSongModelAlias = 'minimax_music_3' \| 'ace_step'` | MiniMax Music **via fal.ai**. | decision (§10) |
| `/home/andres/WebstormProjects/magic-worlds/src/shared/types/ui.types.ts:30,40-41` | Page ids `'calls'`, `'voice-studio'`, `'admin-voices'` | Neutral. | keep |

### 2.6 Voice field readers (silent data-loss risk)

| Line(s) | Function | Why it matters | Action |
|---|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/utils/cardTransforms.ts:9,41,57-72,92` | `readCharacterVoice` rebuilds the voice from exactly `voice_id, speed, vol, pitch, emotion, language_boost, preset_id, preset_name`. | New ElevenLabs fields would be **dropped on every card read**, then lost on save (`CharacterCreator.tsx:249`). | rewrite for ElevenLabs |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/utils/adventureSnapshot.ts:14,81-96,112,204,287` | `snapshotVoice` has the same whitelist; L112 maps cards and L204 copies a character voice into a snapshot. | Same risk for adventure snapshots and `narrator_voice` round-trips. | rewrite for ElevenLabs |

Recommendation: put one shared `parseCharacterVoice()` in the new provider-neutral voice module. It should keep ElevenLabs settings and read legacy MiniMax fields for display only.

---

## 3. API layer, sockets and feature flags

### 3.1 `apiService` voice methods (`src/infrastructure/api/index.ts`)

| Line(s) | Method | BFF path and payload | MiniMax coupling | ElevenLabs target | Action |
|---|---|---|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/index.ts:26-44` | type imports | `AdminVoice*`, `VoicePreset*` | Follows §2. | Update imports. | rewrite for ElevenLabs |
| `…/index.ts:1585-1593` | `listAdminVoices(voiceType='all')` | `GET /admin/voices?voice_type=…` (backend `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:166`) | MiniMax `get_voice` type filter. | Paginated `category`/`voice_type`/`search`/`next_page_token` (E11). | rewrite for ElevenLabs |
| `…/index.ts:1595-1602` | `designAdminVoice(body)` | `POST /admin/voices/design` (`admin_voices.py:75-76`) | MiniMax `voice_design`; a voice is created at once. | Split into `designAdminVoicePreviews()` (E15) and `saveDesignedVoice()` (E16). | rewrite for ElevenLabs |
| `…/index.ts:1604-1615` | `deleteAdminVoice(voiceType, voiceId)` | `DELETE /admin/voices/{voice_type}/{voice_id}` (`admin_voices.py:182-183`) | MiniMax needs the type. | `DELETE /admin/voices/{voice_id}` (E14). | rewrite for ElevenLabs |
| `…/index.ts:1617-1624` | `testAdminVoice(body)` | `POST /admin/voices/test` (`admin_voices.py:91-92`) returns `audio_hex` | MiniMax `t2a_v2` controls and hex. | ElevenLabs request (§2.2). Return a Blob through `fetchProtectedMediaBlob`-style binary handling, or base64. | rewrite for ElevenLabs |
| `…/index.ts:1919-1948` | `listVoicePresets`, `createVoicePreset`, `updateVoicePreset`, `deleteVoicePreset` | `/voice-presets` CRUD (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:62,74,121,130,145`) | Payload shape is MiniMax (§2.1). | Same routes, new payload. | keep (payload changes) |
| `…/index.ts:1950-1955` | `listSystemVoices()`; comment "catalog of MiniMax system voices" | `GET /voice-presets/system-voices` (`voice_presets.py:87`) | MiniMax system voices, cached for 5 minutes server-side. | A curated ElevenLabs catalog: default/premade plus workspace voices, maybe library picks, with `preview_url`, paginated or BFF-cached. | rewrite for ElevenLabs |
| `…/index.ts:1957-1965` | `previewVoice(body)`; comment "hex audio" | `POST /voice-presets/preview` (`voice_presets.py:99`) | MiniMax synthesis with hex. **Unmetered** (baseline issue #1). | Prefer the `preview_url` sample for catalog browsing (E11). Use metered synthesis for the recipe preview. Return a Blob. | rewrite for ElevenLabs |
| `…/index.ts:2057-2072` | `uploadAdminVoiceCloneSample(file, purpose)` | `POST /admin/voices/clone-file` (`admin_voices.py:107-108`) returns `file_id` | MiniMax `files/upload`. | Not needed. IVC is a single multipart call (E17). | delete |
| `…/index.ts:2075-2082` | `cloneAdminVoice(body)` | `POST /admin/voices/clone` (`admin_voices.py:150-151`), JSON with `file_id` | MiniMax `voice_clone`. | Multipart: `name`, `files[]`, `remove_background_noise`, `description`, `labels` (E17). | rewrite for ElevenLabs |
| (new) | — | — | — | Optional: `searchVoiceLibrary()` and `addLibraryVoice()` (E12), `remixVoice()` (E19), `listPronunciationDictionaries()` (E10). All go through the BFF, root-only. | add |
| `…/index.ts:238-245` | `TtsJobPublicResponse` | — | Neutral. | — | keep |
| `…/index.ts:3576-3581` | `getTtsJob(jobId)` | `GET /tts/jobs/{id}` (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/tts.py:62`) | Neutral. | — | keep |
| `…/index.ts:3583-3591` | `fetchTtsAudioBlob(url)`, Accept `audio/mpeg` | `GET /tts/assets/{id}.mp3` (`tts.py:103`) | Neutral while MP3 is stored. | — | keep |
| `…/index.ts:3646-3656` | `waitForTts()` | — | Dead code (baseline "Lower"). | — | delete |
| `…/index.ts:3513-3572` | `saveVoiceConsent`, `uploadVoiceSegment`, `endVoiceCall` | `/character-chats/{id}/voice-consent`, `/voice-segments`, `/voice-end` | Neutral; uplink goes to STT. | — | keep |
| `…/index.ts:4089-4102` | `updateAdventureSnapshot()` sends `narrator_voice`, `narrate_thoughts` | `PUT /adventure-sessions/{id}/template-snapshot` | Sends whatever `CharacterVoice` holds (see §2.6). | — | keep |
| `…/index.ts:4190-4214` | `getRecentVoiceCalls`, `getCharacterChatCalls` (dead per baseline), `getVoiceCallTranscript` | `/voice-calls…` | Neutral. | — | keep (`getCharacterChatCalls`: delete) |
| `…/index.ts:630-636` | `assertVoicesEnabled`, `assertCallsEnabled` | — | Neutral. | — | keep |

### 3.2 `chatSocket.ts`

| Line(s) | Item | Action |
|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/chatSocket.ts:300-313` | `sendTts(assistantMessageId, turnId, requestId)` sends `{type:'tts', …}`. Neutral; dedupe is server-side by content hash plus voice. | keep |

### 3.3 `voiceSocket.ts`

| Line(s) | Item | MiniMax coupling | Action |
|---|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/voiceSocket.ts:4-6` | Doc: "assistant MP3 chunks" | Accurate if MP3 stays. | keep |
| `…/voiceSocket.ts:18,255-258` | `mw.bearer.v1` subprotocol, `/{basePath}/{id}/ws-voice` | BFF only. | keep |
| `…/voiceSocket.ts:47-62` | Server frame allow-list | Neutral. | keep |
| `…/voiceSocket.ts:64-79` | `FORBIDDEN_CLIENT_PAYLOAD_KEYS` (`raw_audio`, `audio_base64`, `audio_b64`, `audio_hex`, `hex_audio`, `data_b64`, `provider_url`, `provider_key`, `authorization`, `api_key`, …) | Lists MiniMax-era hex keys. `audio_base64` is **already** in the list (L68). | rewrite: add only the ElevenLabs key names `xi_api_key` and `xi-api-key` [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tts.md shows `xi_api_key` in the message body]. *(Corrected during verification: the earlier text also proposed adding `audio_base64`, which is already present at `/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/voiceSocket.ts:68`.)* |
| `…/voiceSocket.ts:400-445` | Seq-based stale-chunk drop | Neutral. | keep |

### 3.4 Media URL helper

| Line(s) | Item | Action |
|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/mediaUrl.ts:3-9` | `PROTECTED_MEDIA_PATH_PREFIXES` includes `/tts/assets/` and `/generated-audio/`. | keep. ElevenLabs `preview_url`s are external CDN URLs. `fetchProtectedMediaBlob` never sends the token to foreign origins (`/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/index.ts:3600-3618`), so they can be played directly or proxied. |

### 3.5 Feature flags

| Line(s) | Item | Action |
|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/shared/featureFlags.ts:30-36` | `isVoicesFeatureEnabled()` (`VITE_FEATURE_VOICES_ENABLED`), `isCallsFeatureEnabled()` (`VITE_FEATURE_CALLS_ENABLED`) | keep. Provider-neutral kill switches. The provider choice must stay server-side; do not add a provider flag to the SPA. |
| `…/featureFlags.ts:88-92` | `voice-studio`/`admin-voices` gated by voices; `calls` gated by calls | keep |
| `/home/andres/WebstormProjects/magic-worlds/src/shared/voiceFeatureFlag.ts:3-5` | `isFrontendVoiceModeEnabled()` → calls flag | keep |
| `/home/andres/WebstormProjects/magic-worlds/.env.example:25-26` | Both flags default `false` | keep |
| Consumers | `CharacterCreator.tsx:15,132`; `InteractionLeftPanel.tsx:6,171`; `landingContent.ts:18,144`; `useStartCall.ts:16,54,83,92`; `DataProvider.tsx:30,996`; `CallScreen.tsx:20,45`; `AppWarningModal.tsx:4,33`; `CharacterChat.tsx:16,61`; `ChatroomPage.tsx:17,55`; `LandingPage.tsx:23,157`; `GalleryPage.tsx:22,153`; `useVoiceCallController.ts:17,200` (added during verification) (all under `/home/andres/WebstormProjects/magic-worlds/src/…`) | keep |

---

## 4. Admin voices console (`src/features/admin/voices/**`)

The root-only "Voice studio" (`AdminVoicesPage`) is the biggest MiniMax surface. It has 32 files (8 at the folder root, 23 in `components/`, 1 in `hooks/`): components, hooks, helpers, stories and tests. *(Corrected during verification from "31".)*

### 4.1 Per-module analysis

#### `constants.ts`: the MiniMax control vocabulary

| Line(s) | Constant | MiniMax concept | ElevenLabs replacement | Action |
|---|---|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/constants.ts:1-4` | File doc: "MiniMax synthesis-control option lists" | — | Provider-neutral wording. | rename provider-neutral |
| `…/constants.ts:14-16` | `PREVIEW_TEXT_LIMIT=500`, `TEST_TEXT_LIMIT=1000`, `PROMPT_TEXT_LIMIT=2000` | MiniMax design and test caps. | Design text 100–1000 (E15). Per-model TTS limits: v4 10,000, v3 5,000, Flash 40,000 (E6). Prefer server-provided limits. | rewrite for ElevenLabs |
| `…/constants.ts:18-23` | `CLONE_MAX_BYTES 20 MB`, `CLONE_MIN_SECONDS 10`, `CLONE_MAX_SECONDS 300`, `PROMPT_AUDIO_MAX_SECONDS 8`, `CLONE_ACCEPT` | MiniMax `voice_clone` limits. | Guidance is about 1–2 min, ≤ 3 min useful, MP3 ≥ 128 kbps (E18). The API page gives no hard size limit, so keep a BFF-enforced cap. Delete the prompt-audio limit. | rewrite for ElevenLabs |
| `…/constants.ts:25-28` | `DEFAULT_PROMPT` (105 characters), `DEFAULT_PREVIEW_TEXT` (100 characters) | Design defaults. | Still valid, but the preview text sits at the 100-character minimum (E15). | keep (enforce a 100 minimum in the UI) |
| `…/constants.ts:29-30` | `DEFAULT_TEST_TEXT` with `<#0.4#> (sighs)` | MiniMax pause and interjection syntax. | Per model: `[sighs]` for v3/v4 (E9), or `<break time="0.4s" />` for non-v3/v4 models (E8). | rewrite for ElevenLabs |
| `…/constants.ts:32-36` | `DEFAULT_SPEED=1`, `DEFAULT_VOL=1`, `DEFAULT_PITCH=0` ("match MiniMax T2A defaults") | MiniMax defaults. | `DEFAULT_SETTINGS = {stability:0.5, similarity_boost:0.75, style:0, use_speaker_boost:true, speed:1}` (E3). Delete VOL and PITCH. | rewrite for ElevenLabs |
| `…/constants.ts:38-58` | `SynthSettings`, `DEFAULT_SYNTH_SETTINGS` (`model:'speech-2.8-turbo'`, `sampleRate:'32000'`, `languageBoost:'auto'`) | MiniMax lab state. | `{modelId, outputFormat:'mp3_44100_128', languageCode:'', voiceSettings, seed?, textNormalization:'auto'}` | rewrite for ElevenLabs |
| `…/constants.ts:60-63` | `MODEL_OPTIONS` (`speech-2.8-hd`, `speech-2.8-turbo`) | MiniMax models. | ElevenLabs models (E6). Exclude deprecated `eleven_turbo_*`. | rewrite for ElevenLabs |
| `…/constants.ts:66-75` | `EMOTION_OPTIONS` (Auto plus 7) | MiniMax emotion enum. | No enum. Replace with an **audio-tag palette** (E9), enabled only for v3/v4/v4 Turbo. | delete (replace with audio tags) |
| `…/constants.ts:77-81` | `FORMAT_OPTIONS` mp3/wav/flac | MiniMax format. | `OUTPUT_FORMAT_OPTIONS` from the E2 enum, browser-playable subset: `mp3_*`, `wav_*`, `opus_48000_*`. Mark tier-gated values (E2). | rewrite for ElevenLabs |
| `…/constants.ts:83-90` | `SAMPLE_RATE_OPTIONS` (incl. `32000`) | MiniMax sample rate. | Merged into `output_format`. | delete |
| `…/constants.ts:92-105` | `LANGUAGE_BOOST_OPTIONS` (`auto` plus 11 language *names*) | MiniMax `language_boost`. | `LANGUAGE_CODE_OPTIONS` (ISO 639-1, `''` = auto). Disabled for Multilingual v2 (E1). | rewrite for ElevenLabs |
| `…/constants.ts:107-108` | `INTERJECTION_TAGS` `(sighs)`, `(laughs)`, `(gasps)`, `(inhale)`, `(exhale)`, `(humming)` | MiniMax speech-2.8 interjections. | `AUDIO_TAGS`, e.g. `[sighs]`, `[laughs]`, `[whispers]`, `[shouts]`, `[clears throat]`, `[curious]` (E9). | rewrite for ElevenLabs |
| `…/constants.ts:110-137` | `KNOWN_VOICE_LANGUAGES` ("Languages MiniMax encodes as the leading token of a system voice_id") | MiniMax id convention. | Not applicable (E24). | delete |
| `…/constants.ts:139-140` | `SYSTEM_VOICE_PAGE_SIZE = 10` | Client paging. | ElevenLabs paging (≤ 100 per page, E11). | rewrite for ElevenLabs |
| `…/constants.ts:142-162` | `VOICE_TYPE_META`, `LIBRARY_FILTERS` (system/cloned/designed) | MiniMax `voice_type`. | `premade`/`cloned`/`generated`/`professional`, plus a "Voice Library" source (E11, E12). | rewrite for ElevenLabs |

#### Other modules

| Module | Line(s) | MiniMax concept encoded | ElevenLabs version | Action |
|---|---|---|---|---|
| `SynthControls.tsx` | `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/SynthControls.tsx:22-97` | Model, Emotion, Audio format, Sample rate selects (L33-54); Language boost (L56-63); sliders for speed 0.5–2 (L65-74), **volume 0.1–10** (L75-84) and **pitch -12..12** (L85-93). | Selects: model, output format, language code. Sliders: stability (0–1), similarity, style, speed (0.7–1.2) (E3, E4); speaker-boost switch. **Hide controls the model does not support** (v3: no speed/similarity/boost; v4: no style/speed, E4/E5). | rewrite for ElevenLabs |
| `SynthLabPanel.tsx` | `…/SynthLabPanel.tsx:6` | Imports MiniMax enums. | New request types. | rewrite for ElevenLabs |
| | `…/SynthLabPanel.tsx:22-29` | `buildMetaLine`: kHz, kbps, `usage_characters` (MiniMax `extra_info`). | Use `output_format` metadata. Character count only if the BFF exposes it [unverified]. | rewrite for ElevenLabs |
| | `…/SynthLabPanel.tsx:40-42` | Voice-id max 256 (MiniMax) and `useEphemeralAudioUrl(tested?.audio_hex…)`. | Opaque id length (BFF validates); Blob or base64 audio. | rewrite for ElevenLabs |
| | `…/SynthLabPanel.tsx:74-83` | Sends only non-default MiniMax controls. | Same "send only the overrides" pattern with ElevenLabs fields. | rewrite for ElevenLabs |
| | `…/SynthLabPanel.tsx:101-156` | **Hard-coded English**: "Synthesis lab", "Voice ID", the placeholder `English_expressive_narrator` (a MiniMax id), "Content input", "Test voice", "Test result", …; the baseline flags this. | Move to i18n; neutral placeholder. | rewrite for ElevenLabs |
| `TextArtifactToolbar.tsx` | `…/TextArtifactToolbar.tsx:5-19` | "Inserts MiniMax T2A text artifacts": pause `<#0.4#>` (L11), interjections (L12-16), IPA `word/(wɜːrd)` (L17). | Model-aware chips. **v3/v4:** audio tags `[sighs]`… (E9); v4 IPA between slashes (E8). **Multilingual v2 / Flash:** `<break time="0.4s" />` (≤ 3 s), and on `eleven_flash_v2` `<phoneme alphabet="ipa" ph="…">word</phoneme>` (E8). Optionally a pronunciation-dictionary picker (E10). | rewrite for ElevenLabs |
| `MiniMaxReferenceDrawer.tsx` | `…/MiniMaxReferenceDrawer.tsx:1-172` | Static MiniMax reference: voice sources (L27-40), text artifacts (L41-52), voice controls (L53-64), audio output (L65-75), cloning (L76-90), support matrix (L91-103), `eyebrow="MiniMax"` (L121). **All hard-coded English**, linking to `platform.minimax.io`. | Replace with an `ElevenLabsReferenceDrawer`, or better a provider-neutral `VoiceReferenceDrawer` with i18n copy. Cover models (E6), settings (E3-E5), audio tags (E9), break/phoneme/dictionaries (E8, E10), output formats (E2), IVC guidance (E18), slots (E13). Link to elevenlabs.io docs. | delete (replace) |
| `hexAudio.ts` | `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/hexAudio.ts:1-37` | `hexToBlob`, `useEphemeralAudioUrl(hex)`: MiniMax hex audio. | ElevenLabs returns binary or base64 (E1, E15, E22). Replace with `base64ToBlob`, or have the BFF return a Blob and hand it to `URL.createObjectURL`. The object-URL lifecycle hook is reusable. | rewrite for ElevenLabs (rename `ephemeralAudio.ts`) |
| | `…/hexAudio.ts:39-65` | `readAudioDuration(file)`, a provider-neutral probe. | Reuse for the IVC duration check. | keep |
| `voiceIdRules.ts` | `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/voiceIdRules.ts:1-21` | MiniMax custom-id rule: 8–256 characters, starts with a letter, `[A-Za-z0-9_-]`, cannot end with `-` or `_`. | ElevenLabs assigns `voice_id` (E16, E17). Replace with **voice name** validation (required, reasonable length). | delete |
| `voiceLanguage.ts` | `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/voiceLanguage.ts:1-52` | `deriveVoiceLanguage` reads the MiniMax id prefix (`English_…`, `Chinese (Mandarin)_…`), with "Other" for legacy ids. | Derive from `labels.language` / `labels.accent` / `verified_languages[].language` (E11), or use the server-side `language` filter (E11). `buildLanguageOptions` (L28-52) can stay with a new language source. | rewrite for ElevenLabs |
| `VoiceCloneForm.tsx` | `…/VoiceCloneForm.tsx:28-41` | Accepted mp3/m4a/wav. | Keep; prefer MP3 (E18). | keep |
| | `…/VoiceCloneForm.tsx:45-46,66,201-212` | **Voice ID** field with MiniMax rules, placeholder `MyClonedVoice01`. | **Voice name** plus optional description and labels (E17). | rewrite for ElevenLabs |
| | `…/VoiceCloneForm.tsx:48-51,81-113` | Upload first and keep `file_id` (`uploadAdminVoiceCloneSample`). Duration check 10 s–5 min (L98). | Keep the selected `File`(s) locally and send them in one multipart IVC call (E17). Duration guidance about 1–3 min (E18). | rewrite for ElevenLabs |
| | `…/VoiceCloneForm.tsx:53-57,121-155,241-268` | **Prompt audio + transcript** (`clone_prompt`, < 8 s). | No ElevenLabs equivalent. Consider allowing **multiple sample files** instead (E18). | delete |
| | `…/VoiceCloneForm.tsx:60,214-220` | `need_noise_reduction`. | `remove_background_noise`. Default **off** (ElevenLabs advises leaving it off for clean samples, E17). | rewrite for ElevenLabs |
| | `…/VoiceCloneForm.tsx:61,221-227` | `need_volume_normalization`. | No equivalent. | delete |
| | `…/VoiceCloneForm.tsx:59,172-175,229-239` | Optional preview `text` with `model: 'speech-2.8-hd'`. | Not part of IVC. Preview by synthesizing afterwards in the lab, or show `preview_url`/samples. | delete (preview moves to the lab) |
| | `…/VoiceCloneForm.tsx:281-291` | Result plays `demo_audio_url` from the MiniMax CDN; ignores `demo_audio_hex` (baseline). The caveat says clones "appear only after first synthesis" (MiniMax activation). | Result shows `voice_id` and `requires_verification` (E17). Drop the activation caveat. Add a **consent checkbox** (E18). | rewrite for ElevenLabs |
| `VoiceDesignForm.tsx` | `…/VoiceDesignForm.tsx:19-20` | `DESIGN_PROMPT_LIMIT=2000`, `DESIGN_VOICE_ID_LIMIT=128`. | No documented description limit (E15); keep a BFF cap. No custom id. | rewrite for ElevenLabs |
| | `…/VoiceDesignForm.tsx:30-38,78-89` | Preview text ≤ 500, no minimum. | **100–1000** characters, or an `auto_generate_text` toggle (E15). | rewrite for ElevenLabs |
| | `…/VoiceDesignForm.tsx:39,113-123` | Single result: `trial_audio` hex. | **A preview grid**: N previews, each with base64 audio and a `generated_voice_id`. Pick one, name it, then **Save** (E15, E16). Pass the unchosen ids in `played_not_selected_voice_ids` (E16). | rewrite for ElevenLabs |
| | `…/VoiceDesignForm.tsx:90-101` | "Custom voice ID (optional)", placeholder `ttv-voice-custom-id`. | Replace with **Voice name** (required on save). | rewrite for ElevenLabs |
| | `…/VoiceDesignForm.tsx:68,92` | Hard-coded English error strings. | i18n. | rewrite for ElevenLabs |
| | (new) | — | Optional controls: model (`eleven_ttv_v3` / `eleven_multilingual_ttv_v2`), loudness, guidance scale, seed, enhance, reference audio (ttv_v3) (E15). | add |
| `VoiceCreatePanel.tsx` | `…/VoiceCreatePanel.tsx:9,18-46` | Design/Clone mode chips. | Same; optionally add a **Remix** mode (E19). | keep |
| `SystemVoiceBrowser.tsx` | `…/SystemVoiceBrowser.tsx:18-21` | Doc: "(large) MiniMax system-voice inventory". | Rewrite the doc. | rename provider-neutral |
| | `…/SystemVoiceBrowser.tsx:28-45` | Client-side search, language filter by id prefix, client paging; haystack `description.join(' ')` (L35). | Server-side `search`/`category`/`language`, `next_page_token` (E11). Add ▶ preview from `preview_url`. Show labels (gender, age, accent, use case). | rewrite for ElevenLabs |
| `VoiceLibraryPanel.tsx` | `…/VoiceLibraryPanel.tsx:19,103-124` | `GROUP_ORDER = voice_generation, voice_cloning, system`. | Groups: `generated`, `cloned`, `professional`, `premade`; optionally a "Voice Library" tab (E12) with add-to-account. Warn about the slot budget (E13). | rewrite for ElevenLabs |
| `VoiceRow.tsx` | `…/VoiceRow.tsx:14-18,22,28,30,32-34,40-52` | Type labels system/cloned/designed; `description[]` join; `created_time` string; `deletable`. | Category label, `description` string, labels chips, `created_at_unix`, ▶ `preview_url`. Deletable = owned and not premade. | rewrite for ElevenLabs |
| `VoiceResultCard.tsx` | `…/VoiceResultCard.tsx:10,52` | "decoded blob or provider demo URL"; hard-coded "Send to lab". | Neutral component; move "Send to lab" to i18n. | keep (i18n fix) |
| `CopyableVoiceId.tsx` | `…/CopyableVoiceId.tsx:7-31` | Neutral. | — | keep |
| `AudioDropzone.tsx` | `…/AudioDropzone.tsx:5,99` | Uses `CLONE_ACCEPT`. | Allow `multiple` files for IVC (E18). | keep (minor change) |
| `ControlSlider.tsx` | `…/ControlSlider.tsx:1-46` | Neutral range row. | Reused for stability, similarity, style and speed. | keep |
| `useVoiceStudio.ts` | `…/hooks/useVoiceStudio.ts:18-22` | `emptyGroups()` with MiniMax types. | New categories. | rewrite for ElevenLabs |
| | `…/hooks/useVoiceStudio.ts:35-59` | `refreshVoices(voiceType)`; the inventory refresh races (baseline). | Paginated loader with an abort signal. | rewrite for ElevenLabs |
| | `…/hooks/useVoiceStudio.ts:61-81` | `confirmDelete` uses `target.voice_type`; refuses `system`. | Delete by id; refuse `premade` and non-owned voices. | rewrite for ElevenLabs |
| `AdminVoicesPage.tsx` | `…/AdminVoicesPage.tsx:9,55-57,122` | Opens `MiniMaxReferenceDrawer`. | The new reference drawer. | rewrite for ElevenLabs |
| | `…/AdminVoicesPage.tsx:14-38` | Root gating. | — | keep |
| `index.ts` | `…/admin/voices/index.ts:1` | Barrel. | — | keep |

### 4.2 Proposed target layout of the root console (UI only)

| Panel | Today (MiniMax) | Proposed (ElevenLabs) |
|---|---|---|
| Create → Design | Description, preview text, optional custom id → one voice | Description (+ enhance) → **3-way preview grid** (E15) → choose → name and description → Save (E16) |
| Create → Clone | Upload → `file_id`; voice id; noise reduction; volume normalisation; prompt audio + transcript; preview text | One or more samples (1–3 min total), name, description, labels, background-noise removal, **consent checkbox** (E17, E18) |
| Create → Remix (new) | — | Pick an owned voice → prompt plus strength → previews → save (E19) |
| Synthesis lab | Model, emotion, format, sample rate, language boost, speed, vol, pitch, MiniMax inline artifacts | Model, output format, language code, stability, similarity, style, speed, speaker boost (model-aware), seed, normalisation, pronunciation dictionary, model-aware tag/break/IPA toolbar |
| Library | System / cloned / designed (one dump, client paging) | Premade / cloned / generated / professional (server paging, ▶ `preview_url`), plus a Voice Library search with "Add to account" (E11, E12) |
| Reference drawer | MiniMax facts, links to `platform.minimax.io` | ElevenLabs facts (i18n), links to elevenlabs.io docs |

---

## 5. User Voice Studio and voice-assignment surfaces

### 5.1 `src/features/voices/**`

| File:line | What it encodes | ElevenLabs version | Action |
|---|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/features/voices/recipe.ts:1` | Imports `DEFAULT_PITCH/SPEED/VOL` from the **admin** constants. | Import from a new shared voice module. | rewrite for ElevenLabs |
| `…/voices/recipe.ts:3-18` | `PresetRecipe {speed, volume, pitch, emotion, language_boost}`, `DEFAULT_RECIPE` | `{stability, similarity_boost, style, use_speaker_boost, speed, language_code}` with E3 defaults. | rewrite for ElevenLabs |
| `/home/andres/WebstormProjects/magic-worlds/src/features/voices/usePreviewVoice.ts:10` | Imports `useEphemeralAudioUrl` from admin `hexAudio`. | Shared ephemeral-audio hook. | rewrite for ElevenLabs |
| `…/voices/usePreviewVoice.ts:12` | `DEFAULT_PREVIEW_TEXT` (48 characters) | Fine for TTS. | keep |
| `…/voices/usePreviewVoice.ts:16-37` | Holds `hex` and `mime`; `runPreview` has **no abort or sequence guard** (the baseline "preview races"). | Blob or base64 result. Add an AbortController or sequence guard. | rewrite for ElevenLabs |
| `/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/PresetRecipeControls.tsx:3-4` | Imports admin `EMOTION_OPTIONS`, `LANGUAGE_BOOST_OPTIONS`, `ControlSlider`. | Shared module. | rewrite for ElevenLabs |
| `…/PresetRecipeControls.tsx:12-13` | Doc: "no model/format/sample-rate; narration fixes those". | Still true for format. The **model** decides which settings apply (E4, E5). | rename provider-neutral |
| `…/PresetRecipeControls.tsx:21-49` | Sliders: speed 0.5–2 (L24-25), **volume 0.1–10** (L34-35), **pitch -12..12** (L44-45). | Speed 0.7–1.2 (E4). Delete volume and pitch. Add stability (Creative ↔ Robust), similarity, style, speaker boost. | rewrite for ElevenLabs |
| `…/PresetRecipeControls.tsx:51-63` | Emotion and Language-boost selects. | Language-code select. Emotion removed, or a "default delivery tag" chip for v3/v4. | rewrite for ElevenLabs |
| `/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/SystemVoicePicker.tsx:6-7` | Imports admin `SYSTEM_VOICE_PAGE_SIZE`, `buildLanguageOptions`, `deriveVoiceLanguage`. | Shared module. | rewrite for ElevenLabs |
| `…/SystemVoicePicker.tsx:16-17` | Doc: "Browse the MiniMax system voice catalog". | Neutral. | rename provider-neutral |
| `…/SystemVoicePicker.tsx:24-40` | Client filter and paging, language from id prefix. | Server search/paging plus labels (E11). | rewrite for ElevenLabs |
| `…/SystemVoicePicker.tsx:101-104` | Shows `voice_name \|\| voice_id` and the raw id in `<code>`. | Show the name plus label chips and ▶ `preview_url`. Hide the opaque id, or move it to a tooltip (E24). | rewrite for ElevenLabs |
| `/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/PresetEditor.tsx:5` | Imports `AdminVoiceEmotion`. | — | rewrite for ElevenLabs |
| `…/PresetEditor.tsx:27-34` | `BaseVoice`; limits name 255, description 2000, **preview 400** (mirrors the backend ≤ 400). | Keep the limits (the backend owns them). | keep |
| `…/PresetEditor.tsx:53-71` | Seeds the recipe (`language_boost: 'auto'`). | ElevenLabs defaults. | rewrite for ElevenLabs |
| `…/PresetEditor.tsx:82-93` | `handlePreview` sends a MiniMax recipe. | ElevenLabs recipe. | rewrite for ElevenLabs |
| `…/PresetEditor.tsx:95-109` | Save payload (`volume`, `pitch`, `emotion`, `language_boost`). | New payload. | rewrite for ElevenLabs |
| `…/PresetEditor.tsx:156,161,196` | Hard-coded English error strings. | i18n. | rewrite for ElevenLabs |
| `…/PresetEditor.tsx:167-191` | Base-voice field via `SystemVoicePicker`. | Same flow, new catalog. | keep (component changes) |
| `/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/VoiceStudioPage.tsx:7` | Imports `AdminVoiceEmotion`. | — | rewrite for ElevenLabs |
| `…/VoiceStudioPage.tsx:21-29` | `recipeChips`: speed, **volume**, **pitch**, emotion, language_boost. | Chips for the speed, stability and language code that are set. | rewrite for ElevenLabs |
| `…/VoiceStudioPage.tsx:63-76` | Loads presets plus `listSystemVoices()` (system group only). | New catalog endpoint. | rewrite for ElevenLabs |
| `…/VoiceStudioPage.tsx:78-89` | `preview(preset)` sends a MiniMax recipe. | New recipe. | rewrite for ElevenLabs |
| `…/VoiceStudioPage.tsx:189` | Shows `base_voice_name \|\| base_voice_id`. | Name is required (E24). | keep |
| `/home/andres/WebstormProjects/magic-worlds/src/features/voices/index.ts:1-2` | Barrel. | — | keep |

### 5.2 `VoicePickerDialog.tsx`

| Line(s) | What it encodes | ElevenLabs version | Action |
|---|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/VoicePickerDialog.tsx:5` | Imports `AdminVoiceEmotion`, `AdminVoiceEntry`. | New types. | rewrite for ElevenLabs |
| `…/VoicePickerDialog.tsx:20-31` | `voiceFromPreset` copies the MiniMax recipe (`vol`/`pitch`/`emotion`/`language_boost`) into `CharacterVoice`. | Copy the ElevenLabs settings plus `voice_name`. | rewrite for ElevenLabs |
| `…/VoicePickerDialog.tsx:33-39` | `presetMatchesVoice` uses `preset_id` or `base_voice_id`. | Same logic. | keep |
| `…/VoicePickerDialog.tsx:53-81` | Loads presets and the system catalog. | New catalog. | rewrite for ElevenLabs |
| `…/VoicePickerDialog.tsx:88-91` | `chooseSystem` stores `{voice_id}` only. | Store `{voice_id, voice_name}` and default settings (E3). | rewrite for ElevenLabs |
| `…/VoicePickerDialog.tsx:93-104` | `previewPreset` runs paid synthesis. | Keep a synthesized preview for presets (recipe-specific). For raw catalog voices use `preview_url`. | rewrite for ElevenLabs |
| `…/VoicePickerDialog.tsx:133,166` | Displays `preset_name \|\| voice_id` and `base_voice_name \|\| base_voice_id`. | Prefer `voice_name`. | rewrite for ElevenLabs |
| `…/VoicePickerDialog.tsx:139-145,198` | Tabs "My presets" / "System voices". | Rename "System voices" to the chosen product term (e.g. "Voice library"). | rename provider-neutral |

### 5.3 Character card voice field (`CharacterCreator.tsx`)

| Line(s) | What | Action |
|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/features/creation/character/components/CharacterCreator.tsx:13,15-16,130-132` | `CharacterVoice` state, voices flag, `VoicePickerDialog` import | keep |
| `…/CharacterCreator.tsx:249` | Payload `voice: voice ?? null`. Persists what the readers in §2.6 produced. | keep (depends on §2.6) |
| `…/CharacterCreator.tsx:782-809` | Shows `preset_name \|\| voice_id` plus the raw `voice_id` in `<code>` (L790-793) | rewrite for ElevenLabs (show `voice_name`; the opaque id adds nothing) |
| `…/CharacterCreator.tsx:812-819` | Picker mount | keep |

### 5.4 Adventure narrator voice and narrate-thoughts (`InteractionLeftPanel.tsx`)

| Line(s) | What | Action |
|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/InteractionLeftPanel.tsx:4,6,9` | Imports | keep |
| `…/InteractionLeftPanel.tsx:171-178` | Mounts `NarrationSection` when editable and voices are enabled; writes `narrator_voice` / `narrate_thoughts` into the snapshot | keep |
| `…/InteractionLeftPanel.tsx:216-233` | Doc: narrator voice for `<narrator>` lines; thoughts are voiced only when enabled. Server-side, thoughts use `vol*0.6` (baseline §2). ElevenLabs has no `vol`, so thought styling must change (e.g. `[whispers]` on v3/v4, or a lower `stability`). | keep (behaviour note for the backend) |
| `…/InteractionLeftPanel.tsx:239-244` | Shows `preset_name \|\| voice_id` | rewrite for ElevenLabs (`voice_name`) |
| `…/InteractionLeftPanel.tsx:255-270` | Narrate-thoughts switch and picker | keep |

### 5.5 Calls page voice badge

| Line(s) | What | Action |
|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/features/call/components/CallsPage.tsx:25-27,189` | `hasVoice` → "Voice set" badge from `character.voice?.voice_id` | keep |

---

## 6. Narration playback and call UI

### 6.1 Chat narration (adventure and character chat)

| File:line | What | Coupling | Action |
|---|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/TurnNarration.tsx:1-22` | Doc: assets via `/tts/assets/{asset_id}.mp3`, never autoplay | Neutral | keep |
| `…/TurnNarration.tsx:31` | `NON_TERMINAL` statuses | Neutral | keep |
| `…/TurnNarration.tsx:117,234` | `apiService.fetchTtsAudioBlob(resolved)` | Neutral | keep |
| `…/TurnNarration.tsx:202,216-218,290-300` | Multi-clip `wantPlayRef` / pause bug (baseline #2) and failed-segment stall (#3) | Not provider-related; fix during the migration | keep (fix bugs) |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/ChatTurn.tsx:16,135-143` | Mounts `TurnNarration` with `ttsStatus` / `ttsUrl` / `ttsSegments` / `ttsError` | Neutral | keep |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/ChatComposer.tsx:22-23,154-161` | Auto-narrate toggle | Neutral | keep |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/InteractionCenterPanel.tsx:69-79,96,105-107` | `RESET_TTS_FIELDS`, 15 s pending watchdog, request id | Neutral | keep |
| `…/InteractionCenterPanel.tsx:179-234` | Auto-narrate in localStorage (`mw:autonarrate:*`) | Neutral | keep |
| `…/InteractionCenterPanel.tsx:331-336` | Hydration merge (baseline #4 bug) | Neutral | keep (fix bug) |
| `…/InteractionCenterPanel.tsx:395-437,560-572,650-700,766-806` | Polling, frame application, auto-request after `done`, manual request | Neutral | keep |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/utils/chatTtsTurnState.ts:9,32` | Frame types, non-terminal set | Neutral | keep |
| `…/chatTtsTurnState.ts:304-317` | `isSafeTtsAudioUrl` requires `/tts/assets/` **and `.mp3`** | Enforces MP3 storage | keep if the BFF keeps MP3 (recommended); otherwise rewrite |
| `…/chatTtsTurnState.ts:319-333` | `safeAssets`/`dedupeAssets` require `content_type === 'audio/mpeg'` | Same | keep if MP3 stays |
| `…/chatTtsTurnState.ts:351-357` | `safeText` drops text containing `secret`, `bearer `, `authorization`, URLs | Neutral (client-side redaction) | keep |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/chatSessionConfig.ts:59-60,81-84,120,156,203` | Hydrates `metadata.tts_segments`; auto-narrate key prefixes | Neutral | keep |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/hooks/useAdventureChatSocket.ts:42-44,65,198,255-265,323-324` | Dispatches `tts_*` frames; `sendTts` | Neutral | keep |
| `/home/andres/WebstormProjects/magic-worlds/src/features/tasks/components/TasksPanel.tsx:60,102,430-441` | Narration tasks: `text_to_speech`, `tts_assets[0]`, shows `output_format` | Neutral | keep |
| `/home/andres/WebstormProjects/magic-worlds/src/ui/components/audio/VoiceClipPlayer.tsx:1-27` | Ephemeral clip player (studio previews, transcripts) | Neutral | keep |
| `/home/andres/WebstormProjects/magic-worlds/src/ui/components/audio/audioFocus.ts:3` | Exclusive audio focus ("TTS narration") | Neutral | keep |

### 6.2 Realtime calls

| File:line | What | MiniMax coupling | ElevenLabs note | Action |
|---|---|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/audio/voicePlaybackBuffer.ts:41-50` | "Plays one streamed MP3 reply per turn"; MSE → ManagedMediaSource → Blob | MP3 because MiniMax streams MP3 | ElevenLabs WS frames carry base64 `audio` (E21). The BFF re-wraps them as `voice_audio_chunk`. | keep |
| `…/voicePlaybackBuffer.ts:261` | `addSourceBuffer('audio/mpeg')` | MP3 | Works for every ElevenLabs `mp3_*` (E2) | keep |
| `…/voicePlaybackBuffer.ts:340-345` | Whole-frame cut (`completeMp3Length`) plus Blob `audio/mpeg` | MP3 | Same | keep |
| `…/voicePlaybackBuffer.ts:611-619` | `resolveMediaSource()` checks `isTypeSupported('audio/mpeg')` | MP3 | Same | keep |
| `…/voicePlaybackBuffer.ts:659-706` | MP3 frame parser (MPEG-1 44.1/48/32 kHz, MPEG-2 22.05/24/16 kHz, MPEG-2.5) | Generic | Covers `mp3_22050_32`, `mp3_24000_48` and `mp3_44100_*` (E2) | keep |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/hooks/useVoiceCallController.ts:990-1012` | `voice_start` capabilities: `media_source_mp3: canStreamMp3()` | Neutral | A future PCM path would add a worklet capability (§13 Q6) | keep |
| `…/useVoiceCallController.ts:124-131` | `TERMINAL_ERROR_CATEGORIES` includes `auth` (baseline #13) | Not provider-related | — | keep (fix bug) |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/hooks/useVoiceCallSocket.ts:14,109` | Dispatches `voice_audio_chunk` | Neutral | — | keep |
| `/home/andres/WebstormProjects/magic-worlds/src/features/call/components/CallTranscriptView.tsx:4-7` | Doc: "play the saved **MiniMax** TTS" | Wording | — | rename provider-neutral |
| `…/CallTranscriptView.tsx:55` | `useAuthenticatedMediaUrl(..., 'audio/mpeg')` | MP3 assets | — | keep |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/VoiceConsentModal.tsx:13-20` | Disclosure keys (copy in i18n §7.4) | Copy names MiniMax | — | keep (copy changes) |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/voiceCallLabels.ts:94-107` | Maps `tts_timeout`, `tts_unavailable`, `tts_stream_interrupted`, `provider_submission` to generic copy | Neutral | — | keep |

### 6.3 Navigation and routing

| File:line | What | Action |
|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/ui/components/Sidebar.tsx:75,95` | Nav items "Calls" and "Voices" (`voice-studio`) | keep |
| `/home/andres/WebstormProjects/magic-worlds/src/ui/components/SidebarAccountMenu.tsx:131-132,330-335` | Root-only "Voice admin" entry | keep |
| `/home/andres/WebstormProjects/magic-worlds/src/app/router/AppRouter.tsx:62-63,179,189-190` | Lazy `AdminVoicesPage` / `VoiceStudioPage` / `CallsPage` | keep |
| `/home/andres/WebstormProjects/magic-worlds/src/features/gallery/galleryLinks.ts:51-52` | `#/voices`, `#/admin/voices` | keep |
| `/home/andres/WebstormProjects/magic-worlds/src/features/landing/components/landingContent.ts:121,138,144` | Landing "voice" feature card gated by the voices flag | keep |
| `/home/andres/WebstormProjects/magic-worlds/src/ui/components/AppWarningModal.tsx:78` | Lists `warning.voice` | keep (copy reviewed in §7.4) |

---

## 7. i18n keys (`en.ts` / `es.ts`)

Files:
- `/home/andres/WebstormProjects/magic-worlds/src/app/i18n/locales/en.ts` (5,897 lines)
- `/home/andres/WebstormProjects/magic-worlds/src/app/i18n/locales/es.ts` (5,907 lines)

Line numbers were extracted with a key-path walker. In the `admin.voices.*`, `voices.*` and most `interaction.*` blocks, the es line is usually the en line + 10.

### 7.1 Keys that name MiniMax explicitly

| Key path | en line | es line | Action |
|---|---|---|---|
| `legal.pages.privacy.sections.voice.body1` ("…may be synthesized with MiniMax text-to-speech") | 2047 | 2057 | rewrite for ElevenLabs (legal review; consent version bump) |
| `interaction.voiceConsent.disclosures.processing` ("…replies are spoken with MiniMax text-to-speech") | 4823 | 4833 | rewrite for ElevenLabs (bump consent version) |
| `admin.voices.page.subtitle` ("Design, clone, and test MiniMax voices…") | 5240 | 5250 | rewrite for ElevenLabs |
| `admin.voices.access.rootOnly` ("…manages MiniMax voices…") | 5246 | 5256 | rename provider-neutral |
| `admin.voices.library.types.system.description` ("Built-in MiniMax voices…") | 5310 | 5320 | rewrite for ElevenLabs ("Default ElevenLabs voices" or neutral) |
| `admin.voices.design.customIdHelper` ("…let MiniMax assign one.") | 5353 | 5363 | delete (no custom id) |
| `creation.common.media.models.minimax_music_3.label` / `.hint` (theme songs via fal.ai) | 3290-3291 | 3300-3301 | decision (§10) |

### 7.2 `admin.voices.*` (root console; en 5239-5462, es 5249-5472; 157 keys)

| Sub-namespace | en lines | es lines | MiniMax concept | Action |
|---|---|---|---|---|
| `admin.voices.page.*` (title, subtitle, reference) | 5239-5241 | 5249-5251 | subtitle names MiniMax | rewrite subtitle; keep the rest |
| `admin.voices.access.*` | 5244-5246 | 5254-5256 | `rootOnly` names MiniMax | rename provider-neutral |
| `admin.voices.errors.*`, `toasts.*`, `deleteDialog.*` | 5249-5258 | 5259-5268 | neutral | keep |
| `admin.voices.create.*` (title, modeAria, design, clone) | 5261-5264 | 5271-5274 | neutral | keep (+ `remix` if added) |
| `admin.voices.language.*` (`all_*`, `other_*`) | 5267-5270 | 5277-5280 | "Other" bucket exists because of MiniMax id prefixes | rewrite for ElevenLabs (language from labels) |
| `admin.voices.copyId.*` | 5273-5274 | 5283-5284 | neutral | keep |
| `admin.voices.voiceIdRules.*` (required, length "8 to 256", startLetter, endChar, charset) | 5277-5281 | 5287-5291 | **MiniMax custom-id rules** | delete (replace with `voiceName.*` rules) |
| `admin.voices.dropzone.*` | 5284-5285 | 5294-5295 | neutral | keep |
| `admin.voices.artifacts.*` (aria, insert, pause, pronounce) | 5288-5291 | 5298-5301 | MiniMax inline syntax | rewrite for ElevenLabs (audio tags, break, IPA/phoneme) |
| `admin.voices.library.*` (title, filters system/cloned/designed, types.*) | 5294-5318 | 5304-5328 | MiniMax `voice_type` groups | rewrite for ElevenLabs (premade/cloned/generated/professional/library) |
| `admin.voices.systemBrowser.*` | 5323-5332 | 5333-5342 | "system voices" wording | rename provider-neutral |
| `admin.voices.row.*` (created, test, protected, `type.system/cloned/designed`) | 5335-5341 | 5345-5351 | MiniMax types | rewrite for ElevenLabs |
| `admin.voices.design.*` (16 keys) | 5345-5363 | 5355-5373 | `customIdLabel`/`customIdHelper` (5352-5353); `previewHelper`/`previewError` assume ≤ 500, no minimum | rewrite for ElevenLabs (100–1000 limit, preview grid, voice name, save) |
| `admin.voices.clone.*` (30 keys) | 5367-5399 | 5377-5409 | `mainDropHint` "10 seconds to 5 minutes · up to 20 MB" (5368); `voiceIdLabel`/`voiceIdHelper` (5369-5370); `volumeNormalization*` (5373-5374); `preview*` (5375-5377); `prompt*`/`transcript*` (5378-5384); `resultCaveat` "only after first synthesis" (5388); `errors.duration` (5396); `errors.promptDuration` (5397) | rewrite for ElevenLabs (name, consent, 1–3 min guidance; delete prompt/transcript/volume-normalisation/caveat keys) |
| `admin.voices.synth.*` (45 keys) | 5403-5462 | 5413-5472 | `chars_*` (5403-5404); `fields.model/emotion/audioFormat/sampleRate/languageBoost/speed/volume/pitch` (5407-5414); `model.hd/turbo` "speech-2.8-*" (5417-5418); `emotion.*` 8 keys (5421-5428); `format.*` mp3/wav/flac (5431-5433); `sampleRate.*` incl. `32000` (5436-5441); `languageBoost.*` 12 keys (5444-5455) | rewrite for ElevenLabs. **Delete**: `fields.volume`, `fields.pitch`, `fields.emotion`, `fields.sampleRate`, `emotion.*`, `sampleRate.*`, `format.flac`. **Add**: `fields.stability/similarity/style/speakerBoost/outputFormat/languageCode/seed`. **Rewrite**: `model.*`, `languageBoost.*` → `languageCode.*` |

### 7.3 `voices.*` (user Voice Studio; en 5802-5892, es 5812-5902; 81 keys)

| Sub-namespace | en lines | es lines | MiniMax concept | Action |
|---|---|---|---|---|
| `voices.editor.*` (21 keys) | 5802-5822 | 5812-5832 | `baseVoiceHelper` "The starting voice this recipe tunes." is neutral | keep |
| `voices.recipe.speed` | 5825 | 5835 | speed (range changes) | keep |
| `voices.recipe.volume` | 5826 | 5836 | MiniMax `vol` | delete |
| `voices.recipe.pitch` | 5827 | 5837 | MiniMax `pitch` | delete |
| `voices.recipe.emotion` | 5828 | 5838 | MiniMax emotion | delete (or rewrite as "Delivery tag") |
| `voices.recipe.languageBoost` | 5829 | 5839 | MiniMax `language_boost` | rewrite → `voices.recipe.language` |
| (new) `voices.recipe.stability/similarity/style/speakerBoost` | — | — | — | add |
| `voices.picker.*` (14 keys) | 5832-5845 | 5842-5855 | `systemVoices` "System voices" (5837) | rename provider-neutral (`systemVoices`); keep others |
| `voices.preview.error` | 5848 | 5858 | neutral | keep |
| `voices.studio.*` (27 keys) | 5851-5877 | 5861-5887 | `chipVolume` (5865), `chipPitch` (5866) | delete `chipVolume`/`chipPitch`; add `chipStability`; keep others |
| `voices.systemPicker.*` (13 keys) | 5880-5892 | 5890-5902 | "system voices" wording in `searchAria` | rename provider-neutral |

### 7.4 Narration, calls, consent, legal and other voice copy

| Key path | en line | es line | Coupling | Action |
|---|---|---|---|---|
| `sidebar.voiceAdmin` | 653 | 663 | neutral | keep |
| `sidebar.nav.calls`, `sidebar.nav.voices` | 680, 691 | 690, 701 | neutral | keep |
| `warning.voice` ("provider STT/TTS processing…") | 888 | 898 | neutral, but check the "store … only" claim against ElevenLabs history (E1) | keep (legal review) |
| `appAssistant.suggestions.voices.{label,hint,prompt}` | 967-969 | 977-979 | neutral | keep |
| `docs.sections.voicePresets.*`, `docs.sections.voice.*` | 1176-1185 | 1186-1195 | neutral | keep |
| `docs.map.items.voiceStudio.{title,body}` | 1271-1272 | 1281-1282 | neutral | keep |
| `docs.guides.play.narration.{title,body}` | 1375-1376 | 1385-1386 | neutral | keep |
| `docs.guides.voicePresets.baseVoice.body` ("Search, filter, and page through the available catalog") | 1396 | 1406 | catalog UX may change | keep / review |
| `docs.guides.voicePresets.tune.body` ("**speed, volume, pitch, emotion, and language boost**") | 1400 | 1410 | MiniMax recipe | rewrite for ElevenLabs |
| `docs.guides.voicePresets.*` (other keys) | 1386-1417 | 1396-1427 | neutral | keep |
| `docs.guides.voice.*` (18 keys) | 1422-1453 | 1432-1463 | `record.body` (1441) says raw audio and "full call recordings" are not stored, but assistant TTS is saved (baseline §1) | keep / legal review |
| `legal.pages.privacy.highlights.voice.*` | 2018-2019 | 2028-2029 | neutral | keep / legal review |
| `legal.pages.privacy.sections.voice.body1` | 2047 | 2057 | **names MiniMax** | rewrite for ElevenLabs |
| `legal.pages.privacy.sections.voice.body2/body3` | 2048-2049 | 2058-2059 | retention claims | legal review |
| `legal.pages.disclaimer.sections.voice.*` | 2095-2097 | 2105-2107 | neutral | keep |
| `tasksDrawer.operations` (inline object incl. `text_to_speech`) | 2396 | 2406 | neutral | keep |
| `tasksDrawer.status.mirroring`, `tasksDrawer.fallback.narration` | 2444, 2473 | 2454, 2483 | neutral | keep |
| `membership.operations.tts_generation` ("TTS"), `membership.operations.voice_call` | 2757-2758 | 2767-2768 | neutral; billing unit may change (§13 Q7) | keep |
| `usage.audioTime` | 2781 | 2791 | neutral | keep |
| `ui.audio.voiceClipFallback` | 2834 | 2844 | neutral | keep |
| `landing.create.voice.*` ("…their own tuned voice") | 2939-2941 | 2949-2951 | neutral | keep |
| `creation.common.media.models.minimax_music_3.*`, `ace_step.*` | 3290-3295 | 3300-3305 | fal.ai theme songs | decision (§10) |
| `creation.character.fieldsForm.voiceLabel/voiceDefault/voiceChange/voiceChoose` | 3530, 3532-3534 | 3540, 3542-3544 | neutral | keep |
| `creation.character.fieldsForm.voiceTooltip` ("Pick a system voice or one of your saved presets.") | 3531 | 3541 | "system voice" wording | rename provider-neutral |
| `interaction.center.narrationFailed` / `narrationUnavailable` | 4708 / 4714 | 4718 / 4719 | neutral | keep |
| `interaction.composer.autoNarrateOff/On` | 4739-4740 | 4749-4750 | neutral | keep |
| `interaction.callError.*` (20 keys) | 4606-4625 | 4616-4635 | `providerFailed` neutral | keep |
| `interaction.callState.*` | 4628-4643 | 4638-4653 | neutral | keep |
| `interaction.narration.*` (16 keys) | 4784-4799 | 4794-4809 | neutral | keep |
| `interaction.voiceConsent.*` (17 keys) | 4809-4826 | 4819-4836 | `disclosures.processing` (4823/4833) names MiniMax; `disclosures.noRecordings` (4825/4835) "full call recordings are not stored" | rewrite `processing`; legal review `noRecordings` |
| `call.page.*`, `call.screen.*`, `call.waveform.*`, `call.history.*`, `call.transcript.*` (64 keys) | 5720-5797 | 5730-5807 | `call.screen.privacyNote` (5755/5765) "Only transcript text and metadata are saved", while assistant TTS audio **is** saved (baseline §1) | keep; legal review of `privacyNote` |

---

## 8. Docs, assistant knowledge, legal, marketing and repo docs

### 8.1 In-app docs and assistant knowledge

| File:line | Content | Coupling | Action |
|---|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/features/docs/components/docsContent.ts:121-122,146-147,195-196` | `voicePresetGuide`, `voiceGuide`, section ids | Keys only; copy lives in i18n | keep |
| `…/docsContent.ts:234` | Map item `voiceStudio` → `voice-studio` | neutral | keep |
| `…/docsContent.ts:268` | Play guide `narration` | neutral | keep |
| `…/docsContent.ts:272-281` | `VOICE_PRESET_GUIDE_SOURCES` incl. `tune` (Gauge) | The `tune` copy (i18n 1400) lists MiniMax controls | keep (copy changes in i18n) |
| `…/docsContent.ts:283-292` | `VOICE_GUIDE_SOURCES` | neutral | keep |
| `…/docsContent.ts:388-389,438-442` | Builds the guides | neutral | keep |
| `/home/andres/WebstormProjects/magic-worlds/src/features/appAssistant/appKnowledge.ts:197-225` (voice at 206-207) | Builds the assistant knowledge from the docs i18n. Inherits the MiniMax wording in `docs.guides.voicePresets.tune.body`. | indirect | keep (follows i18n) |
| `/home/andres/WebstormProjects/magic-worlds/src/features/appAssistant/assistantSuggestions.ts:24` | `voices` suggestion chip | neutral | keep |

### 8.2 Marketing assets

| File:line | Content | Action |
|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/assets/marketing/index.ts:20,35-36,68,91-92` | Imports `features/voice-tts.webp`, `docs/voice-presets.webp`, `docs/voice.webp` | keep. The artwork is illustrative: `voice-presets.webp` was viewed and has no provider text or UI controls. |

### 8.3 Storybook config and MDX

- `.storybook/` (`main.ts`, `preview.tsx`, `preview-head.html`, `tsconfig.json`) has **no** voice or TTS references. `preview.tsx:12,28` only wraps stories in `AudioPlaylistProvider`.
- `/home/andres/WebstormProjects/magic-worlds/src/ui/docs/brand/Voice.mdx` is about the brand "voice and microcopy", not TTS. Keep.

### 8.4 Repo docs and agent instructions that mention MiniMax (non-code)

| File:line | Mention | Action (after the migration lands) |
|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/CLAUDE.md:67-68,76,78` | Architecture: "MiniMax (TTS speech-2.8-turbo)", `MINIMAX_*` env | rewrite for ElevenLabs |
| `/home/andres/WebstormProjects/magic-worlds/AGENTS.md:67-68,76,78` | Same content. `CLAUDE.md` is a **symlink** to `AGENTS.md` (verified with `ls -la`), so this is one edit, not two. | rewrite for ElevenLabs |
| `/home/andres/WebstormProjects/magic-worlds/docs/voice-calls-review-2026-10-11.md` (e.g. :46, :119, :431-440, :506, :747) | MiniMax client, `task_start`, PCM idea | keep as history; add a pointer to this folder |
| `/home/andres/WebstormProjects/magic-worlds/docs/voice-calls-latency-review-2026-10-11.md` (e.g. :38, :62, :101-116, :367-368, :391-399) | MiniMax socket prewarm, bidi endpoint | keep as history |
| `/home/andres/WebstormProjects/magic-worlds/docs/llm_profiles/01_findings.md:14,34-35`; `08_web_client_root_and_user.md:122`; `12_implementation_status.md:109-110,614`; `14_operations_runbook.md:39,63,96` | MiniMax as the media provider and its keys; L109-110 name the `theme_song_prompt_minimax_music_3.v2.json` writer workflow and the rejected "direct-MiniMax" aliases (L109-110 added during verification) | rewrite the provider name once migrated |
| `/home/andres/WebstormProjects/magic-worlds/docs/billing/README.md:75-79,146,271` | **Added during verification.** An existing ElevenLabs plan table (Free/Starter/Creator/Pro credits and $/minute) plus a TTS credit rule and a `character_count` usage field. These figures predate this research and are not sourced. | re-verify against https://elevenlabs.io/pricing and `/pricing/api` (E23) before reuse; feeds §13 Q7 |
| Generated, git-ignored bundles: `/home/andres/WebstormProjects/magic-worlds/ds-bundle/_ds_bundle.js` (+ `ds-bundle/_preview/*.js`), `dist/`, `storybook-static/` | **Added during verification.** Compiled copies of the i18n strings, so they contain "MiniMax". `.gitignore:11,16,23` excludes them. | regenerate after the migration; never hand-edit |
| `/home/andres/WebstormProjects/magic-worlds/docs/ui-audit-2026-09-19-play-admin.md:87` | Lists the admin voices components | keep as history |
| `/home/andres/WebstormProjects/magic-worlds/README.md:7,19,37,53` | "voice narration", "TTS narration" | keep (neutral) |

---

## 9. Stories, fixtures and tests

Effort column: **R** = rewrite for ElevenLabs semantics; **U** = update fixtures only; **K** = keep.

### 9.1 Stories (`*.stories.tsx`)

| File | MiniMax specifics | Effort |
|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/SystemVoiceBrowser.stories.tsx` | MiniMax ids `English_voice_*`, `Chinese (Mandarin)_voice_*` (L11, L14); description "MiniMax system-voice inventory" (L29) | R |
| `…/admin/voices/components/TextArtifactToolbar.stories.tsx` | "MiniMax T2A text artifacts" (L14) | R |
| `…/admin/voices/components/VoiceResultCard.stories.tsx` | `English_expressive_narrator` (L49); `ClonedAwaitingActivation` story with the MiniMax first-synthesis caveat (L57-64) | R |
| `…/admin/voices/components/AudioDropzone.stories.tsx` | Hint "10 seconds to 5 minutes · up to 20 MB" (L26); error copy (L48) | U |
| `…/admin/voices/components/ControlSlider.stories.tsx` | Speed 0.5–2 (args L28-29; interactive L47-48), pitch demo (state L41; slider L54); docs L14 | U |
| `/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/PresetRecipeControls.stories.tsx` | "speed / volume / pitch … emotion & language-boost" (L14); `emotion: 'happy'` (L35) | R |
| `…/voices/components/SystemVoicePicker.stories.tsx` | MiniMax ids (L10, L47); "MiniMax system voice catalog" (L23) | R |
| `/home/andres/WebstormProjects/magic-worlds/src/features/admin/PlayAdminAudit.stories.tsx` | Scenes `voice-studio`, `voice-picker`, `admin-voices` (L17, L27-29, L73-86) | K (fixtures change) |
| `/home/andres/WebstormProjects/magic-worlds/src/features/admin/playAdminAuditFixtures.tsx` | `auditVoices` with MiniMax groups and ids (L27-31); `auditPresets` with a MiniMax recipe (L32-35); mocks `listSystemVoices`, `listAdminVoices`, `listVoicePresets` (L63-65) | R |
| `/home/andres/WebstormProjects/magic-worlds/src/ui/components/audio/VoiceClipPlayer.stories.tsx` | Neutral | K |
| `/home/andres/WebstormProjects/magic-worlds/src/features/call/components/CallScreen.stories.tsx`, `CallHistoryRow.stories.tsx` | Neutral call UI | K |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/ChatTurn.stories.tsx` | Auto-narrate composer (L94, L103) | K |
| `/home/andres/WebstormProjects/magic-worlds/src/features/profile/components/ProfileView.stories.tsx`, `UsageSection.stories.tsx` | `tts_generation` and `voice_call` limits (e.g. ProfileView L26-27, L45-46; UsageSection L74-75) | K (unless the billing unit changes) |
| `/home/andres/WebstormProjects/magic-worlds/src/ui/components/ApiStatusMonitor.stories.tsx:14-15` | Services `tts` "TTS Engine", `voice` | K |
| `/home/andres/WebstormProjects/magic-worlds/src/features/tasks/components/SidebarTasksMenu.stories.tsx` | Task drawer | K |

Run `pnpm typecheck:stories` after the type changes, per the CLAUDE.md commands.

### 9.2 Tests (`*.test.ts(x)`)

| File | What it pins | Effort |
|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/AdminVoicesPage.test.tsx` | MiniMax id (L48); `audio_hex` + `sample_rate: 32000` (L96-100); lab text `<#0.4#> (sighs)` (L168); "opens the MiniMax reference drawer" (L193); design → list → delete flow (L129) | R |
| `…/admin/voices/components/VoiceCloneForm.test.tsx` | Two-step upload, `need_noise_reduction` (L86), `demo_audio_url` (L52), voice-id validation (L96) | R |
| `…/admin/voices/components/SystemVoiceBrowser.test.tsx` | MiniMax-prefixed ids and language filter by prefix (L12-15, L64) | R |
| `…/admin/voices/hexAudio.test.ts` | Hex decoding (L4-13) | R (base64/Blob) or delete |
| `…/admin/voices/voiceIdRules.test.ts` | MiniMax id rules | delete |
| `…/admin/voices/voiceLanguage.test.ts` | Language from the MiniMax id prefix (L20-42) | R |
| `/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/VoicePickerDialog.test.tsx` | MiniMax recipe fixture (L22-33); emits `emotion`/`language_boost` (L60-65); preview `audio_hex` (L121); `vol`/`pitch` in preview (L128) | R |
| `…/voices/components/VoiceStudioPage.test.tsx` | Preset fixtures with `emotion`/`language_boost` (L31-51) | R |
| `/home/andres/WebstormProjects/magic-worlds/src/utils/cardTransforms.test.ts:46-71` | "preserves character voice recipes": MiniMax fields round-trip | R (and add a test that ElevenLabs fields survive) |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/utils/adventureSnapshot.test.ts:45-87,144-168` | Snapshot voice with `emotion`/`language_boost` | R |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/VoiceConsentModal.test.tsx:13` | Asserts `/MiniMax text-to-speech/i` | U (new provider string) |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/VoiceCall.integration.test.tsx:328-353` | Redaction sentinels `MINIMAX_API_KEY`, `api.minimax.io/ws/v1/t2a_v2` (L331, L351-352); chunk `sample_rate: 32000` (L245, L338) | U (add ElevenLabs sentinels such as `xi-api-key` and `api.elevenlabs.io`; keep the MiniMax ones as legacy) |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/audio/voicePlaybackBuffer.test.ts:11-12` | Chunk fixture `audio/mpeg`, `32000` | U (e.g. 44100 or 24000) |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/hooks/useVoiceCallController.test.ts:69` | Chunk fixture | U |
| `/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/voiceSocket.test.ts:439-441` | Chunk fixtures | U |
| `/home/andres/WebstormProjects/magic-worlds/src/features/docs/components/DocsPage.test.tsx:79-92` | Asserts the literal "speed, volume, pitch, emotion, and language boost" (L87) | U |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/utils/chatTtsTurnState.test.ts` | `/tts/assets/*.mp3` + `audio/mpeg` assets (L15, L230, L272, L290) | K (if MP3 stays) |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/InteractionCenterPanel.test.tsx:865-940` | TTS polling single-flight | K |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/hooks/useAdventureChatSocket.test.tsx:91` | Dispatches `tts_*` frames | K |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/chatSessionConfig.test.ts` | Hydrates `tts_segments` | K |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/ChatTurn.test.tsx` | Segments and narrator identity (no TTS assertions) | K. Note: `TurnNarration` has **no tests** (baseline gap). |
| `/home/andres/WebstormProjects/magic-worlds/src/features/tasks/components/TasksDrawer.test.tsx:116-120` | Narration task with a `/tts/assets/voice-1.mp3` asset | K |
| `/home/andres/WebstormProjects/magic-worlds/src/features/call/components/CallTranscriptView.test.tsx`, `CallsPage.test.tsx`, `CallScreen.test.tsx` | Neutral | K |
| `/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/__tests__/voiceApi.test.ts` | Segment upload, consent, end | K |
| `/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/chatSocket.test.ts` | `sendTts` frame | K |
| `/home/andres/WebstormProjects/magic-worlds/src/shared/featureFlags.test.ts:25-26,59-97` | Voices and calls flags | K |
| `/home/andres/WebstormProjects/magic-worlds/src/features/admin/membership/components/AdminMembershipPage.test.tsx:186`; `membership.fixtures.ts:20-22,268-269`; `src/features/profile/components/ProfileView.test.tsx:37-122` | `tts_generation` / `voice_call` | K |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/audio/voiceVad*.test.ts` | Uplink VAD (the `32_000` there is a sample count) | K |
| Theme songs: `src/infrastructure/api/__tests__/themeSongContract.test.ts:8`; `src/features/creation/common/components/MediaStudioSection.test.tsx:339`; `src/features/gallery/media/components/MediaGalleryPage.test.tsx:98`; `src/features/gallery/media/hooks/useMediaGallery.test.tsx:43` | `model_alias: 'minimax_music_3'` | decision (§10) |

### 9.3 Missing tests to add with the migration

1. A voice reader round-trip test: the ElevenLabs fields `stability`, `similarity_boost`, `voice_name` and `language_code` survive `transformCharacters`, `snapshotToCharacter` and a save.
2. Model-aware recipe controls: v4 hides speed and style; v3 hides speed, similarity and boost (E4, E5).
3. The design preview grid: choose one of N previews, save with a name, and send `played_not_selected_voice_ids`.
4. The IVC form: multiple files, consent required, `remove_background_noise`.
5. `TurnNarration` (still untested, baseline gap) before touching the narration audio format.
6. A `voice_audio_chunk` with `sample_rate: 44100` (and `24000`) through `VoicePlaybackBuffer`.

---

## 10. Theme songs (MiniMax Music via fal.ai): a separate decision

This uses MiniMax's *model* but not the MiniMax API or `MINIMAX_AUDIO_API_KEY` (baseline §1). Removing it is a product decision separate from the TTS migration.

| File:line | Item |
|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/shared/types/media.types.ts:76-82` | `ThemeSongModelAlias = 'minimax_music_3' \| 'ace_step'`; `THEME_SONG_MODEL_ALIASES` |
| `/home/andres/WebstormProjects/magic-worlds/src/features/creation/common/components/MediaStudioSection.tsx:113` | `DEFAULT_THEME_MODEL = 'minimax_music_3'` |
| `…/MediaStudioSection.tsx:450` | Model option `minimax_music_3` |
| `/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/themeSongContract.ts:54` | Contract allow-list `['ace_step','minimax_music_3']` |
| `/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/index.ts:3935-3947` | `generateThemeSong` verifies `model_alias` |
| i18n `creation.common.media.models.minimax_music_3.*` | en 3289-3291, es 3299-3301 |
| Tests | See §9.2, last row |

If "remove MiniMax" includes music, ElevenLabs Music is a candidate:
- models `music_v2_5` / `music_v2` [verified: https://elevenlabs.io/docs/overview/models];
- $0.15/min with a 5-minute duration limit [verified: https://elevenlabs.io/pricing/api].

It would be added as a new alias (e.g. `eleven_music_v2_5`) and `minimax_music_3` would be retired. Existing `minimax_music_3` assets must keep rendering; the backend runbook already describes retired-alias handling (`/home/andres/WebstormProjects/magic-worlds/docs/llm_profiles/14_operations_runbook.md:96`).

---

## 11. Cross-cutting recommendations for the UI migration

### 11.1 Extract a provider-neutral voice module before rewriting
- Create `src/features/voices/shared/`, or `src/shared/voice/`, holding:
  - recipe types and defaults;
  - the voice parser (replacing `readCharacterVoice` and `snapshotVoice`);
  - `ControlSlider`;
  - the ephemeral-audio hook (from `hexAudio.ts`);
  - language helpers;
  - the catalog picker.
- Point both the user studio and the admin console at it. This removes the user → admin imports (Key finding 11).

### 11.2 Let the BFF describe the provider's capabilities
- Add an endpoint such as `GET /voice-presets/capabilities` that returns:
  - the narration/call models;
  - the supported `voice_settings` keys and their ranges per model;
  - whether audio tags, `<break>` and IPA are supported;
  - text limits;
  - allowed output formats.
- The UI then renders controls dynamically. This matters because the ElevenLabs controls differ by model (E4, E5, E8) and ElevenLabs ships models quickly (v4 arrived about two weeks ago, E7).
- It also keeps the SPA free of provider strings, which matches the current rule that the client never names a provider (`/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/voiceSocket.ts:64-79`).

### 11.3 Catalog browsing without paid synthesis
- Play `preview_url` (E11) in `SystemVoicePicker` and `SystemVoiceBrowser`.
- Keep `previewVoice` only for "hear my recipe". It should be metered and rate-limited server-side (baseline issue #1).
- Fix the preview race in `usePreviewVoice.ts:22-37`.

### 11.4 Data migration of stored voices (UI impact)
- Existing `CharacterVoice` values hold MiniMax ids and recipes in four places:
  - character cards (`character.types.ts:41`);
  - frozen adventure and character-chat snapshots (`adventure.types.ts:76,105`);
  - presets (`voicePreset.types.ts:20-36`);
  - global presets.
- Recommendation: the backend maps MiniMax ids to chosen ElevenLabs voices and rewrites the stored data, or resolves them at synthesis time.
- The UI must:
  - show `voice_name`, never a raw opaque id;
  - tolerate legacy fields (`vol`, `pitch`, `emotion`, `language_boost`) on read without writing them back;
  - offer a "voice no longer available — choose a new one" state when the backend marks a voice as unmapped.

### 11.5 Consent and privacy copy
- Change the provider named in `interaction.voiceConsent.disclosures.processing` and `legal.pages.privacy.sections.voice.body1`, and **bump the server consent version**. The UI already handles `consent_stale` (`/home/andres/WebstormProjects/magic-worlds/src/shared/types/voice.types.ts:38`, `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/VoiceConsentModal.tsx:28`).
- Review the "not stored" statements:
  - ElevenLabs keeps generation history unless zero retention is used, which is Enterprise-only (E1);
  - the BFF itself stores the assistant call audio (baseline §1).

### 11.6 Audio formats
- **Narration storage:** keep MP3, for example `mp3_44100_128` (the default) or `mp3_44100_64`, so that these need no change:
  - `isSafeTtsAudioUrl` (`chatTtsTurnState.ts:312-317`);
  - `ChatTtsAsset.content_type` (`interaction.types.ts:119`);
  - `fetchTtsAudioBlob`.
- **Calls:** choose `mp3_22050_32`, `mp3_24000_48` or `mp3_44100_64`, all parsed by `voicePlaybackBuffer.ts:659-686`, and widen `voice.types.ts:170`.
  - Opus would need container and MSE checks [unverified for which container ElevenLabs Opus uses].
  - A later PCM + AudioWorklet path (`pcm_16000`/`pcm_24000`, E2) would add a capability flag.

### 11.7 Text-artifact syntax must follow the model
- Replace every MiniMax inline token:
  - the admin toolbar and defaults (`constants.ts:29-30,108`, `TextArtifactToolbar.tsx:11-17`);
  - the callbot prompt and sanitizer on the backend (baseline §2 path B).
- On v3/v4 use audio tags (E9). On v2/Flash use `<break>`, `<phoneme>` or aliases (E8). Pronunciation dictionaries work across models with the E10 caveats.

### 11.8 Hard-coded English found in the voice UI (fix while rewriting)
- `SynthLabPanel.tsx:101-156`
- `VoiceResultCard.tsx:52`
- `VoiceDesignForm.tsx:68,92`
- `PresetEditor.tsx:156,161,196`
- all of `MiniMaxReferenceDrawer.tsx`

All paths are under `/home/andres/WebstormProjects/magic-worlds/src/features/`.

---

## 12. CHANGE CHECKLIST

Actions: **delete** · **rewrite for ElevenLabs** · **rename provider-neutral** · **keep**. Paths are relative to `/home/andres/WebstormProjects/magic-worlds/`.

### 12.1 Types and parsers

| # | Item | file:line | Action | Notes |
|---|---|---|---|---|
| 1 | Recipe doc comment | `src/shared/types/voicePreset.types.ts:1-5` | rename provider-neutral | Drop "MiniMax". |
| 2 | `AdminVoiceEmotion` import | `src/shared/types/voicePreset.types.ts:6` | delete | Decouple from the admin types. |
| 3 | `CharacterVoice.voice_id` | `src/shared/types/voicePreset.types.ts:9` | keep | Values migrate to ElevenLabs ids (§11.4). |
| 4 | `CharacterVoice.speed` | `src/shared/types/voicePreset.types.ts:10` | rewrite for ElevenLabs | 0.7–1.2; n/a on v3/v4 (E4, E5). |
| 5 | `CharacterVoice.vol` | `src/shared/types/voicePreset.types.ts:11` | delete | No ElevenLabs parameter (E1). |
| 6 | `CharacterVoice.pitch` | `src/shared/types/voicePreset.types.ts:12` | delete | No ElevenLabs parameter (E1). |
| 7 | `CharacterVoice.emotion` | `src/shared/types/voicePreset.types.ts:13` | delete | Optional audio-tag field instead (E9). |
| 8 | `CharacterVoice.language_boost` | `src/shared/types/voicePreset.types.ts:14` | rewrite for ElevenLabs | → `language_code` (ISO 639-1). |
| 9 | `CharacterVoice` new fields | `src/shared/types/voicePreset.types.ts:8-18` | rewrite for ElevenLabs | Add `voice_name`, `stability`, `similarity_boost`, `style`, `use_speaker_boost`, `model_id?`, schema/provider version. |
| 10 | `VoicePreset` | `src/shared/types/voicePreset.types.ts:20-36` | rewrite for ElevenLabs | Replace volume, pitch, emotion, language_boost. |
| 11 | Preset create/update payloads | `src/shared/types/voicePreset.types.ts:38-50` | rewrite for ElevenLabs | Mirror item 10. |
| 12 | `VoicePresetPreviewRequest` | `src/shared/types/voicePreset.types.ts:52-60` | rewrite for ElevenLabs | ElevenLabs settings + language code. |
| 13 | `AdminVoiceQueryType` / `ConcreteType` | `src/shared/types/adminVoice.types.ts:1-3` | rewrite for ElevenLabs | category + voice_type (E11). |
| 14 | `AdminVoiceBaseResponse` | `src/shared/types/adminVoice.types.ts:5-8` | delete | MiniMax `base_resp`. |
| 15 | `AdminVoiceEntry` | `src/shared/types/adminVoice.types.ts:10-17` | rewrite for ElevenLabs | name, category, labels, `preview_url`, `verified_languages`, `created_at_unix`, `is_owner`. |
| 16 | `AdminVoiceGroups` / `ListResponse` | `src/shared/types/adminVoice.types.ts:19-25` | rewrite for ElevenLabs | Paginated (E11). |
| 17 | Design request/response | `src/shared/types/adminVoice.types.ts:27-37` | rewrite for ElevenLabs | previews[] + save types (E15, E16). |
| 18 | `AdminVoiceDeleteResponse` | `src/shared/types/adminVoice.types.ts:39-44` | rewrite for ElevenLabs | `{status:'ok'}` (E14). |
| 19 | `AdminVoiceModel` | `src/shared/types/adminVoice.types.ts:46-47` | rewrite for ElevenLabs | ElevenLabs model ids (E6). |
| 20 | `AdminVoiceEmotion` | `src/shared/types/adminVoice.types.ts:49-58` | delete | No ElevenLabs enum. |
| 21 | `AdminVoiceAudioFormat` | `src/shared/types/adminVoice.types.ts:60-61` | rewrite for ElevenLabs | `output_format` string (E2). |
| 22 | `AdminVoiceSampleRate` | `src/shared/types/adminVoice.types.ts:63` | delete | Merged into `output_format`. |
| 23 | `AdminVoiceTestRequest` | `src/shared/types/adminVoice.types.ts:65-77` | rewrite for ElevenLabs | E1 fields; L68 comment cites MiniMax defaults. |
| 24 | `AdminVoiceTestResponse` | `src/shared/types/adminVoice.types.ts:79-90` | rewrite for ElevenLabs | Blob/base64, no `audio_hex`/`base_resp`. |
| 25 | Clone purpose / upload / prompt | `src/shared/types/adminVoice.types.ts:92-105` | delete | MiniMax-only. |
| 26 | `AdminVoiceCloneRequest` | `src/shared/types/adminVoice.types.ts:107-116` | rewrite for ElevenLabs | IVC multipart fields (E17). |
| 27 | `AdminVoiceCloneResponse` | `src/shared/types/adminVoice.types.ts:118-126` | rewrite for ElevenLabs | `{voice_id, requires_verification}`. |
| 28 | Shared barrel | `src/shared/types/index.ts:3,25-26` | keep | Consider renaming the `AdminVoice*` exports. |
| 29 | `voice_audio_chunk.content_type/sample_rate` | `src/shared/types/voice.types.ts:169-170` | rewrite for ElevenLabs | No 32 kHz MP3 in ElevenLabs (E2); widen. |
| 30 | `VoiceClientCapabilities` | `src/shared/types/voice.types.ts:68-72` | keep | Optionally add a PCM worklet capability. |
| 31 | `VoiceErrorCategory` `tts_*` | `src/shared/types/voice.types.ts:48-53` | keep | Provider-neutral. |
| 32 | `CallTranscriptSegment.audio_url` | `src/shared/types/voice.types.ts:235-236` | keep | MP3 assets. |
| 33 | `TtsLifecycleStatus` | `src/shared/types/interaction.types.ts:97-114` | keep | Neutral. |
| 34 | `ChatTtsAsset` mp3 literals | `src/shared/types/interaction.types.ts:116-126` | keep | Only if MP3 storage stays. |
| 35 | TTS clip and frame types | `src/shared/types/interaction.types.ts:135-163,195,210-212` | keep | Neutral. |
| 36 | `Character.voice` comment | `src/shared/types/character.types.ts:40-41` | rename provider-neutral | "system voice" wording. |
| 37 | `SnapshotCard.voice`, `narrator_voice`, `narrate_thoughts` | `src/shared/types/adventure.types.ts:75-76,104-107` | keep | Data migration (§11.4). |
| 38 | `TurnEntry.tts*` | `src/shared/types/adventure.types.ts:130-139` | keep | — |
| 39 | Task `text_to_speech` / `tts_assets` | `src/shared/types/task.types.ts:11,24` | keep | — |
| 40 | `ThemeSongModelAlias` | `src/shared/types/media.types.ts:76-82` | keep (pending decision) | §10. |
| 41 | Page ids | `src/shared/types/ui.types.ts:30,40-41` | keep | — |
| 42 | `readCharacterVoice` whitelist | `src/utils/cardTransforms.ts:57-72` | rewrite for ElevenLabs | Silent field loss (Key finding 3). |
| 43 | `snapshotVoice` whitelist | `src/features/interaction/utils/adventureSnapshot.ts:81-96` | rewrite for ElevenLabs | Same; used at L112, L204. |

### 12.2 API, sockets, flags

| # | Item | file:line | Action | Notes |
|---|---|---|---|---|
| 44 | Voice type imports | `src/infrastructure/api/index.ts:26-44` | rewrite for ElevenLabs | Follow §2. |
| 45 | `listAdminVoices` | `src/infrastructure/api/index.ts:1585-1593` | rewrite for ElevenLabs | Pagination and filters. |
| 46 | `designAdminVoice` | `src/infrastructure/api/index.ts:1595-1602` | rewrite for ElevenLabs | Split into design previews + save. |
| 47 | `deleteAdminVoice` | `src/infrastructure/api/index.ts:1604-1615` | rewrite for ElevenLabs | Drop `voice_type`. |
| 48 | `testAdminVoice` | `src/infrastructure/api/index.ts:1617-1624` | rewrite for ElevenLabs | Blob response. |
| 49 | Preset CRUD | `src/infrastructure/api/index.ts:1919-1948` | keep | Payload types change. |
| 50 | `listSystemVoices` (+ "MiniMax" comment L1950) | `src/infrastructure/api/index.ts:1950-1955` | rewrite for ElevenLabs | Curated catalog with `preview_url`. |
| 51 | `previewVoice` (+ "hex" comment L1957) | `src/infrastructure/api/index.ts:1957-1965` | rewrite for ElevenLabs | Blob; metered server-side. |
| 52 | `uploadAdminVoiceCloneSample` | `src/infrastructure/api/index.ts:2057-2072` | delete | IVC is one call. |
| 53 | `cloneAdminVoice` | `src/infrastructure/api/index.ts:2075-2082` | rewrite for ElevenLabs | Multipart IVC. |
| 54 | New library/remix/dictionary methods | `src/infrastructure/api/index.ts` (new) | rewrite for ElevenLabs | E10, E12, E19; root-only. |
| 55 | `getTtsJob`, `fetchTtsAudioBlob` | `src/infrastructure/api/index.ts:3576-3591` | keep | — |
| 56 | `waitForTts` | `src/infrastructure/api/index.ts:3646-3656` | delete | Dead code (baseline). |
| 57 | `updateAdventureSnapshot` | `src/infrastructure/api/index.ts:4089-4102` | keep | Depends on items 42-43. |
| 58 | `getCharacterChatCalls` | `src/infrastructure/api/index.ts:4198-4203` | delete | Dead code (baseline). |
| 59 | Call HTTP methods | `src/infrastructure/api/index.ts:3513-3572,4190-4214` | keep | — |
| 60 | `assertVoicesEnabled` / `assertCallsEnabled` | `src/infrastructure/api/index.ts:630-636` | keep | — |
| 61 | `ChatSocket.sendTts` | `src/infrastructure/api/chatSocket.ts:300-313` | keep | — |
| 62 | `VoiceSocket` forbidden keys | `src/infrastructure/api/voiceSocket.ts:64-79` | rewrite for ElevenLabs | Add `xi_api_key`, `xi-api-key` (`audio_base64` is already listed at L68; corrected during verification). |
| 63 | `VoiceSocket` MP3 doc | `src/infrastructure/api/voiceSocket.ts:4-6` | keep | — |
| 64 | Protected media prefixes | `src/infrastructure/api/mediaUrl.ts:3-9` | keep | — |
| 65 | Feature flags | `src/shared/featureFlags.ts:30-36,88-92`; `src/shared/voiceFeatureFlag.ts:3-5`; `.env.example:25-26` | keep | No provider flag in the SPA. |

### 12.3 Admin voices console

| # | Item | file:line | Action | Notes |
|---|---|---|---|---|
| 66 | Constants doc | `src/features/admin/voices/constants.ts:1-4` | rename provider-neutral | — |
| 67 | Text limits | `src/features/admin/voices/constants.ts:14-16` | rewrite for ElevenLabs | Design 100–1000; per-model TTS limits. |
| 68 | Clone limits / accept | `src/features/admin/voices/constants.ts:18-23` | rewrite for ElevenLabs | 1–3 min guidance; drop the prompt limit. |
| 69 | Design defaults | `src/features/admin/voices/constants.ts:25-28` | keep | Preview default is exactly 100 characters. |
| 70 | `DEFAULT_TEST_TEXT` | `src/features/admin/voices/constants.ts:29-30` | rewrite for ElevenLabs | Remove `<#0.4#> (sighs)`. |
| 71 | Default speed/vol/pitch | `src/features/admin/voices/constants.ts:32-36` | rewrite for ElevenLabs | ElevenLabs settings defaults (E3). |
| 72 | `SynthSettings` + defaults | `src/features/admin/voices/constants.ts:38-58` | rewrite for ElevenLabs | — |
| 73 | `MODEL_OPTIONS` | `src/features/admin/voices/constants.ts:60-63` | rewrite for ElevenLabs | E6; no deprecated turbo. |
| 74 | `EMOTION_OPTIONS` | `src/features/admin/voices/constants.ts:66-75` | delete | Audio-tag palette instead. |
| 75 | `FORMAT_OPTIONS` | `src/features/admin/voices/constants.ts:77-81` | rewrite for ElevenLabs | `output_format` (E2). |
| 76 | `SAMPLE_RATE_OPTIONS` | `src/features/admin/voices/constants.ts:83-90` | delete | Merged. |
| 77 | `LANGUAGE_BOOST_OPTIONS` | `src/features/admin/voices/constants.ts:92-105` | rewrite for ElevenLabs | ISO 639-1. |
| 78 | `INTERJECTION_TAGS` | `src/features/admin/voices/constants.ts:107-108` | rewrite for ElevenLabs | `[sighs]`, `[laughs]`, … (E9). |
| 79 | `KNOWN_VOICE_LANGUAGES` | `src/features/admin/voices/constants.ts:110-137` | delete | MiniMax id convention. |
| 80 | `SYSTEM_VOICE_PAGE_SIZE` | `src/features/admin/voices/constants.ts:139-140` | rewrite for ElevenLabs | Server paging. |
| 81 | `VOICE_TYPE_META` / `LIBRARY_FILTERS` | `src/features/admin/voices/constants.ts:142-162` | rewrite for ElevenLabs | ElevenLabs categories + library. |
| 82 | `SynthControls` | `src/features/admin/voices/components/SynthControls.tsx:22-97` | rewrite for ElevenLabs | Model-aware sliders; delete volume and pitch. |
| 83 | `SynthLabPanel` request/meta/hex | `src/features/admin/voices/components/SynthLabPanel.tsx:6,22-29,40-42,74-83` | rewrite for ElevenLabs | — |
| 84 | `SynthLabPanel` hard-coded copy | `src/features/admin/voices/components/SynthLabPanel.tsx:101-156` | rewrite for ElevenLabs | i18n; the placeholder is a MiniMax id. |
| 85 | `TextArtifactToolbar` | `src/features/admin/voices/components/TextArtifactToolbar.tsx:5-19` | rewrite for ElevenLabs | Tags / break / phoneme / IPA per model. |
| 86 | `MiniMaxReferenceDrawer` | `src/features/admin/voices/components/MiniMaxReferenceDrawer.tsx:1-172` | delete | Replace with an i18n reference drawer for ElevenLabs. |
| 87 | `hexToBlob` / `useEphemeralAudioUrl` | `src/features/admin/voices/hexAudio.ts:1-37` | rewrite for ElevenLabs | base64/Blob; rename the file. |
| 88 | `readAudioDuration` | `src/features/admin/voices/hexAudio.ts:39-65` | keep | Move to the shared module. |
| 89 | `voiceIdRules` | `src/features/admin/voices/voiceIdRules.ts:1-21` | delete | Name validation instead. |
| 90 | `voiceLanguage` | `src/features/admin/voices/voiceLanguage.ts:1-52` | rewrite for ElevenLabs | Labels / `verified_languages`. |
| 91 | Clone voice-id field | `src/features/admin/voices/components/VoiceCloneForm.tsx:45-46,66,201-212` | rewrite for ElevenLabs | → name. |
| 92 | Clone two-step upload | `src/features/admin/voices/components/VoiceCloneForm.tsx:48-51,81-113` | rewrite for ElevenLabs | Send files with the clone call. |
| 93 | Clone prompt audio + transcript | `src/features/admin/voices/components/VoiceCloneForm.tsx:53-57,121-155,241-268` | delete | No ElevenLabs equivalent. |
| 94 | Noise-reduction switch | `src/features/admin/voices/components/VoiceCloneForm.tsx:60,166,214-220` | rewrite for ElevenLabs | `remove_background_noise`, default off (today defaults `true`, L60). L166 sends `need_noise_reduction` (added during verification). |
| 95 | Volume-normalisation switch | `src/features/admin/voices/components/VoiceCloneForm.tsx:61,167,221-227` | delete | L167 sends `need_volume_normalization` (added during verification). |
| 96 | Clone preview text + `speech-2.8-hd` | `src/features/admin/voices/components/VoiceCloneForm.tsx:59,172-175,229-239` | delete | Preview in the lab. |
| 97 | Clone result + caveat | `src/features/admin/voices/components/VoiceCloneForm.tsx:281-291` | rewrite for ElevenLabs | `requires_verification`; consent checkbox. |
| 98 | Design limits | `src/features/admin/voices/components/VoiceDesignForm.tsx:19-20,30-38` | rewrite for ElevenLabs | 100–1000 preview text. |
| 99 | Design result (single hex) | `src/features/admin/voices/components/VoiceDesignForm.tsx:39,113-123` | rewrite for ElevenLabs | Preview grid + save. |
| 100 | Design custom-id field | `src/features/admin/voices/components/VoiceDesignForm.tsx:90-101` | rewrite for ElevenLabs | → voice name. |
| 101 | Design hard-coded errors | `src/features/admin/voices/components/VoiceDesignForm.tsx:68,92` | rewrite for ElevenLabs | i18n. |
| 102 | `VoiceCreatePanel` | `src/features/admin/voices/components/VoiceCreatePanel.tsx:9-46` | keep | Optional Remix mode (E19). |
| 103 | `SystemVoiceBrowser` | `src/features/admin/voices/components/SystemVoiceBrowser.tsx:18-45` | rewrite for ElevenLabs | Server search/paging; ▶ `preview_url`. |
| 104 | `VoiceLibraryPanel` groups | `src/features/admin/voices/components/VoiceLibraryPanel.tsx:19,103-124` | rewrite for ElevenLabs | Categories + Voice Library tab. |
| 105 | `VoiceRow` | `src/features/admin/voices/components/VoiceRow.tsx:14-52` | rewrite for ElevenLabs | Category, labels, ▶ preview. |
| 106 | `VoiceResultCard` "Send to lab" | `src/features/admin/voices/components/VoiceResultCard.tsx:52` | keep | Move to i18n. |
| 107 | `CopyableVoiceId` | `src/features/admin/voices/components/CopyableVoiceId.tsx:7-31` | keep | — |
| 108 | `AudioDropzone` | `src/features/admin/voices/components/AudioDropzone.tsx:5,99` | keep | Allow `multiple`. |
| 109 | `ControlSlider` | `src/features/admin/voices/components/ControlSlider.tsx:1-46` | keep | Move to the shared module. |
| 110 | `useVoiceStudio` | `src/features/admin/voices/hooks/useVoiceStudio.ts:18-81` | rewrite for ElevenLabs | Groups, paging, delete by id, abort. |
| 111 | `AdminVoicesPage` drawer wiring | `src/features/admin/voices/components/AdminVoicesPage.tsx:9,55-57,122` | rewrite for ElevenLabs | New drawer. |
| 112 | `AdminVoicesPage` root gate | `src/features/admin/voices/components/AdminVoicesPage.tsx:14-38` | keep | — |

### 12.4 User Voice Studio and assignment

| # | Item | file:line | Action | Notes |
|---|---|---|---|---|
| 113 | `recipe.ts` | `src/features/voices/recipe.ts:1-18` | rewrite for ElevenLabs | ElevenLabs settings; shared import. |
| 114 | `usePreviewVoice` | `src/features/voices/usePreviewVoice.ts:10,16-37` | rewrite for ElevenLabs | Blob; race guard. |
| 115 | `PresetRecipeControls` | `src/features/voices/components/PresetRecipeControls.tsx:3-4,12-63` | rewrite for ElevenLabs | Delete volume, pitch, emotion; add stability etc. |
| 116 | `SystemVoicePicker` | `src/features/voices/components/SystemVoicePicker.tsx:6-7,16-40,101-104` | rewrite for ElevenLabs | Server paging, labels, `preview_url`. |
| 117 | `PresetEditor` | `src/features/voices/components/PresetEditor.tsx:5,53-109,156,161,196` | rewrite for ElevenLabs | Payload + i18n. |
| 118 | `PresetEditor` base voice / limits | `src/features/voices/components/PresetEditor.tsx:27-34,167-191` | keep | — |
| 119 | `VoiceStudioPage` chips/preview/load | `src/features/voices/components/VoiceStudioPage.tsx:7,21-29,63-89` | rewrite for ElevenLabs | — |
| 120 | `VoicePickerDialog` recipe copy / system pick / preview | `src/features/voices/components/VoicePickerDialog.tsx:5,20-31,53-104,133,166` | rewrite for ElevenLabs | Store `voice_name`. |
| 121 | `VoicePickerDialog` "System voices" tab | `src/features/voices/components/VoicePickerDialog.tsx:139-145,198` | rename provider-neutral | — |
| 122 | `CharacterCreator` voice display | `src/features/creation/character/components/CharacterCreator.tsx:790-797` | rewrite for ElevenLabs | Show `voice_name`. |
| 123 | `CharacterCreator` voice state / payload / picker | `src/features/creation/character/components/CharacterCreator.tsx:130-132,249,812-819` | keep | Depends on items 42-43. |
| 124 | `NarrationSection` voice display | `src/features/interaction/components/InteractionLeftPanel.tsx:239-244` | rewrite for ElevenLabs | Show `voice_name`. |
| 125 | `NarrationSection` mount / switch / picker | `src/features/interaction/components/InteractionLeftPanel.tsx:171-178,255-270` | keep | Thought styling moves server-side. |
| 126 | Calls "Voice set" badge | `src/features/call/components/CallsPage.tsx:25-27,189` | keep | — |

### 12.5 Narration and calls

| # | Item | file:line | Action | Notes |
|---|---|---|---|---|
| 127 | `TurnNarration` | `src/features/interaction/components/TurnNarration.tsx:1-357` | keep | Fix baseline bugs #2/#3 (L216-218, 290-300). |
| 128 | `ChatTurn` narration mount | `src/features/interaction/components/ChatTurn.tsx:135-143` | keep | — |
| 129 | `ChatComposer` auto-narrate | `src/features/interaction/components/ChatComposer.tsx:22-23,154-161` | keep | — |
| 130 | `InteractionCenterPanel` TTS lifecycle | `src/features/interaction/components/InteractionCenterPanel.tsx:69-107,179-234,331-336,395-437,560-572,650-700,766-806` | keep | Fix the hydration bug #4. |
| 131 | MP3-only asset filter | `src/features/interaction/utils/chatTtsTurnState.ts:304-333` | keep | Rewrite only if narration storage leaves MP3. |
| 132 | `chatSessionConfig` hydration | `src/features/interaction/chatSessionConfig.ts:59-60,81-84,120,156,203` | keep | — |
| 133 | `useAdventureChatSocket` TTS dispatch | `src/features/interaction/hooks/useAdventureChatSocket.ts:42-44,65,198,255-265,323-324` | keep | — |
| 134 | Tasks narration | `src/features/tasks/components/TasksPanel.tsx:60,102,430-441` | keep | — |
| 135 | `VoiceClipPlayer` / `audioFocus` | `src/ui/components/audio/VoiceClipPlayer.tsx:1-27`; `src/ui/components/audio/audioFocus.ts:3` | keep | — |
| 136 | MSE MP3 player | `src/features/interaction/audio/voicePlaybackBuffer.ts:41-50,261,340-345,611-619,659-706` | keep | Supports every ElevenLabs `mp3_*`. |
| 137 | `voice_start` capabilities | `src/features/interaction/hooks/useVoiceCallController.ts:990-1012` | keep | Optional PCM capability. |
| 138 | Terminal `auth` error | `src/features/interaction/hooks/useVoiceCallController.ts:124-131` | keep | Fix baseline #13. |
| 139 | Transcript "MiniMax TTS" doc | `src/features/call/components/CallTranscriptView.tsx:4-7` | rename provider-neutral | — |
| 140 | Transcript audio fetch | `src/features/call/components/CallTranscriptView.tsx:55` | keep | — |
| 141 | Consent modal keys | `src/features/interaction/components/VoiceConsentModal.tsx:13-20` | keep | Copy in i18n. |
| 142 | Call error mapping | `src/features/interaction/voiceCallLabels.ts:94-107` | keep | — |
| 143 | Navigation/routing | `src/ui/components/Sidebar.tsx:75,95`; `src/ui/components/SidebarAccountMenu.tsx:131-132,330-335`; `src/app/router/AppRouter.tsx:62-63,189-190`; `src/features/gallery/galleryLinks.ts:51-52`; `src/features/landing/components/landingContent.ts:138,144`; `src/ui/components/AppWarningModal.tsx:78` | keep | — |

### 12.6 i18n (apply to both `en.ts` and `es.ts`)

| # | Item | file:line (en / es) | Action | Notes |
|---|---|---|---|---|
| 144 | Privacy body names MiniMax | `src/app/i18n/locales/en.ts:2047` / `es.ts:2057` | rewrite for ElevenLabs | Legal review. |
| 145 | Consent "processing" names MiniMax | `en.ts:4823` / `es.ts:4833` | rewrite for ElevenLabs | Bump the consent version. |
| 146 | Retention claims | `en.ts:2048-2049,4824,4825,5755,1441,888` / `es.ts:2058-2059,4834,4835,5765,1451,898` | keep | Legal review against E1 and stored call audio. *(Corrected during verification: `5754`/`5764` is `call.screen.endCall`; `privacyNote` is `5755`/`5765`. Added `disclosures.noRecordings` `4825`/`4835`, listed in §7.4.)* |
| 147 | `admin.voices.page.subtitle` | `en.ts:5240` / `es.ts:5250` | rewrite for ElevenLabs | — |
| 148 | `admin.voices.access.rootOnly` | `en.ts:5246` / `es.ts:5256` | rename provider-neutral | — |
| 149 | `admin.voices.language.*` | `en.ts:5267-5270` / `es.ts:5277-5280` | rewrite for ElevenLabs | Labels-based. |
| 150 | `admin.voices.voiceIdRules.*` | `en.ts:5277-5281` / `es.ts:5287-5291` | delete | Add voice-name rules. |
| 151 | `admin.voices.artifacts.*` | `en.ts:5288-5291` / `es.ts:5298-5301` | rewrite for ElevenLabs | Tags / break / IPA. |
| 152 | `admin.voices.library.*` | `en.ts:5294-5318` / `es.ts:5304-5328` | rewrite for ElevenLabs | L5310/5320 names MiniMax. |
| 153 | `admin.voices.systemBrowser.*` | `en.ts:5323-5332` / `es.ts:5333-5342` | rename provider-neutral | — |
| 154 | `admin.voices.row.type.*` | `en.ts:5339-5341` / `es.ts:5349-5351` | rewrite for ElevenLabs | Categories. |
| 155 | `admin.voices.design.*` | `en.ts:5345-5363` / `es.ts:5355-5373` | rewrite for ElevenLabs | Delete `customId*`; add preview grid, name, save. |
| 156 | `admin.voices.clone.*` | `en.ts:5367-5399` / `es.ts:5377-5409` | rewrite for ElevenLabs | Delete prompt/transcript/volume-normalisation/preview/caveat; add consent and name. |
| 157 | `admin.voices.synth.fields.*` | `en.ts:5407-5414` / `es.ts:5417-5424` | rewrite for ElevenLabs | Delete volume, pitch, emotion, sampleRate; add stability etc. |
| 158 | `admin.voices.synth.model.*` | `en.ts:5417-5418` / `es.ts:5427-5428` | rewrite for ElevenLabs | ElevenLabs model names. |
| 159 | `admin.voices.synth.emotion.*` | `en.ts:5421-5428` / `es.ts:5431-5438` | delete | — |
| 160 | `admin.voices.synth.format.*`, `sampleRate.*` | `en.ts:5431-5441` / `es.ts:5441-5451` | rewrite for ElevenLabs | → `outputFormat.*`. |
| 161 | `admin.voices.synth.languageBoost.*` | `en.ts:5444-5455` / `es.ts:5454-5465` | rewrite for ElevenLabs | → `languageCode.*`. |
| 162 | Other `admin.voices.*` (errors, toasts, deleteDialog, create, copyId, dropzone, synth chars/reset/toasts/errors) | `en.ts:5249-5285,5402-5405,5457-5462` / `es.ts:5259-5295,5412-5415,5467-5472` | keep | — |
| 163 | `voices.recipe.volume`, `voices.recipe.pitch` | `en.ts:5826-5827` / `es.ts:5836-5837` | delete | — |
| 164 | `voices.recipe.emotion` | `en.ts:5828` / `es.ts:5838` | delete | Or rewrite as a delivery tag. |
| 165 | `voices.recipe.languageBoost` | `en.ts:5829` / `es.ts:5839` | rewrite for ElevenLabs | → language. |
| 166 | New `voices.recipe.*` keys | `en.ts`/`es.ts` (new) | rewrite for ElevenLabs | stability, similarity, style, speakerBoost. |
| 167 | `voices.studio.chipVolume`, `chipPitch` | `en.ts:5865-5866` / `es.ts:5875-5876` | delete | — |
| 168 | `voices.picker.systemVoices`, `voices.systemPicker.*` | `en.ts:5837,5879-5892` / `es.ts:5847,5889-5902` | rename provider-neutral | — |
| 169 | `docs.guides.voicePresets.tune.body` | `en.ts:1400` / `es.ts:1410` | rewrite for ElevenLabs | Asserted in DocsPage.test L87. |
| 170 | `creation.character.fieldsForm.voiceTooltip` | `en.ts:3531` / `es.ts:3541` | rename provider-neutral | "system voice". |
| 171 | Theme song `minimax_music_3` copy | `en.ts:3289-3291` / `es.ts:3299-3301` | keep (pending decision) | §10. |
| 172 | Narration / call / consent / tasks / membership / landing / docs neutral keys | §7.4 rows marked keep | keep | — |

### 12.7 Docs, stories, tests, repo docs

| # | Item | file:line | Action | Notes |
|---|---|---|---|---|
| 173 | Docs content wiring | `src/features/docs/components/docsContent.ts:121-122,195-196,234,268,272-292` | keep | Copy is in i18n. |
| 174 | Assistant knowledge | `src/features/appAssistant/appKnowledge.ts:206-207`; `src/features/appAssistant/assistantSuggestions.ts:24` | keep | Inherits i18n. |
| 175 | Marketing images | `src/assets/marketing/index.ts:20,35-36,68,91-92` | keep | No provider text. |
| 176 | `SystemVoiceBrowser.stories` | `src/features/admin/voices/components/SystemVoiceBrowser.stories.tsx:11,14,29` | rewrite for ElevenLabs | — |
| 177 | `TextArtifactToolbar.stories` | `src/features/admin/voices/components/TextArtifactToolbar.stories.tsx:14` | rewrite for ElevenLabs | — |
| 178 | `VoiceResultCard.stories` | `src/features/admin/voices/components/VoiceResultCard.stories.tsx:49,57-64` | rewrite for ElevenLabs | Drop the activation story. |
| 179 | `AudioDropzone.stories` | `src/features/admin/voices/components/AudioDropzone.stories.tsx:26,48` | rewrite for ElevenLabs | New limits copy. |
| 180 | `ControlSlider.stories` | `src/features/admin/voices/components/ControlSlider.stories.tsx:14,28-29,41,47-48,54` | rewrite for ElevenLabs | Speed 0.7–1.2; stability demo replaces pitch. *(Line refs corrected during verification.)* |
| 181 | `PresetRecipeControls.stories` | `src/features/voices/components/PresetRecipeControls.stories.tsx:14,35` | rewrite for ElevenLabs | — |
| 182 | `SystemVoicePicker.stories` | `src/features/voices/components/SystemVoicePicker.stories.tsx:10,23,47` | rewrite for ElevenLabs | — |
| 183 | Play/admin audit fixtures | `src/features/admin/playAdminAuditFixtures.tsx:27-35,63-65` | rewrite for ElevenLabs | — |
| 184 | `PlayAdminAudit.stories` | `src/features/admin/PlayAdminAudit.stories.tsx:17,27-29,73-86` | keep | — |
| 185 | `AdminVoicesPage.test` | `src/features/admin/voices/components/AdminVoicesPage.test.tsx:48,96-100,168,193` | rewrite for ElevenLabs | — |
| 186 | `VoiceCloneForm.test` | `src/features/admin/voices/components/VoiceCloneForm.test.tsx:52,67-106` | rewrite for ElevenLabs | — |
| 187 | `SystemVoiceBrowser.test` | `src/features/admin/voices/components/SystemVoiceBrowser.test.tsx:12-15,64` | rewrite for ElevenLabs | — |
| 188 | `hexAudio.test` | `src/features/admin/voices/hexAudio.test.ts:4-13` | rewrite for ElevenLabs | Base64/Blob. |
| 189 | `voiceIdRules.test` | `src/features/admin/voices/voiceIdRules.test.ts:1-29` | delete | — |
| 190 | `voiceLanguage.test` | `src/features/admin/voices/voiceLanguage.test.ts:20-52` | rewrite for ElevenLabs | — |
| 191 | `VoicePickerDialog.test` | `src/features/voices/components/VoicePickerDialog.test.tsx:22-33,60-65,121,128` | rewrite for ElevenLabs | — |
| 192 | `VoiceStudioPage.test` | `src/features/voices/components/VoiceStudioPage.test.tsx:31-51` | rewrite for ElevenLabs | — |
| 193 | `cardTransforms.test` voice | `src/utils/cardTransforms.test.ts:46-71` | rewrite for ElevenLabs | Plus a survival test. |
| 194 | `adventureSnapshot.test` voice | `src/features/interaction/utils/adventureSnapshot.test.ts:45-87,144-168` | rewrite for ElevenLabs | — |
| 195 | `VoiceConsentModal.test` | `src/features/interaction/components/VoiceConsentModal.test.tsx:13` | rewrite for ElevenLabs | Provider string. |
| 196 | `VoiceCall.integration.test` | `src/features/interaction/components/VoiceCall.integration.test.tsx:245,331,338,351-352` | rewrite for ElevenLabs | ElevenLabs sentinels; sample rate. |
| 197 | 32 kHz chunk fixtures | `src/features/interaction/audio/voicePlaybackBuffer.test.ts:11-12`; `src/features/interaction/hooks/useVoiceCallController.test.ts:69`; `src/infrastructure/api/voiceSocket.test.ts:439-441` | rewrite for ElevenLabs | Use 44100 or 24000. |
| 198 | `DocsPage.test` recipe sentence | `src/features/docs/components/DocsPage.test.tsx:87` | rewrite for ElevenLabs | — |
| 199 | Neutral TTS/call tests | §9.2 rows marked K | keep | — |
| 200 | Theme-song tests | `src/infrastructure/api/__tests__/themeSongContract.test.ts:8`; `src/features/creation/common/components/MediaStudioSection.test.tsx:339`; `src/features/gallery/media/components/MediaGalleryPage.test.tsx:98`; `src/features/gallery/media/hooks/useMediaGallery.test.tsx:43` | keep (pending decision) | §10. |
| 201 | Theme-song code | `src/features/creation/common/components/MediaStudioSection.tsx:113,450`; `src/infrastructure/api/themeSongContract.ts:54` | keep (pending decision) | §10. |
| 202 | Agent/architecture docs | `CLAUDE.md:67-68,76,78`; `AGENTS.md:67-68,76,78` | rewrite for ElevenLabs | After the backend lands. |
| 203 | LLM-profile docs | `docs/llm_profiles/01_findings.md:14,34-35`; `docs/llm_profiles/08_web_client_root_and_user.md:122`; `docs/llm_profiles/12_implementation_status.md:614`; `docs/llm_profiles/14_operations_runbook.md:39,63,96` | rename provider-neutral | — |
| 204 | Voice-call reviews | `docs/voice-calls-review-2026-10-11.md`; `docs/voice-calls-latency-review-2026-10-11.md` | keep | Historical. |
| 205 | Missing tests | §9.3 | rewrite for ElevenLabs | New tests. |

### 12.8 Items added during verification (2026-10-12)

Frontend paths are relative to `/home/andres/WebstormProjects/magic-worlds/`; backend paths are absolute. Backend rows are listed only where the UI contract depends on them. The full backend list is in [06_backend_minimax_inventory.md](./06_backend_minimax_inventory.md).

| # | Item | file:line | Action | Notes |
|---|---|---|---|---|
| 206 | Privacy page renders the MiniMax body | `src/features/legal/components/legalContent.ts:177-178,211-215` | keep | Wires `legal.pages.privacy.highlights.voice.*` and `sections.voice.body1` (item 144). Only the copy changes. |
| 207 | Hard-coded operation label `tts_generation: 'TTS'`, `voice_call: 'Call mode'` | `src/features/profile/components/membership.helpers.ts:12-13` | keep | English fallback used by `membershipFormat.ts:14` when the i18n key is missing. Revisit if the billing unit becomes characters (§13 Q7). |
| 208 | Audio focus shared with TTS narration | `src/app/providers/AudioPlaylistProvider.tsx:11`; tests `AudioPlaylistProvider.test.tsx:272`, `AudioPlaylistProvider.expiry.test.tsx:9` | keep | Neutral; narration claims focus and pauses the playlist. |
| 209 | Protected-media test for `/tts/assets/*.mp3` | `src/infrastructure/api/media.test.ts:44` | keep | Rewrite only if narration storage leaves MP3. |
| 210 | `useVoiceCallController` calls-flag gate | `src/features/interaction/hooks/useVoiceCallController.ts:17,200` | keep | Missing from the §3.5 consumer list. |
| 211 | `voice_call` callbot LLM-profile fixtures | `src/features/profile/llmCapacityUsage.fixtures.ts:21`; `src/infrastructure/api/llmProfileContract.test.ts:23` | keep | LLM side of calls, not TTS. |
| 212 | `chatSocket.test` `tts` frame ordering | `src/infrastructure/api/chatSocket.test.ts:389` | keep | Neutral. |
| 213 | `ApiStatusMonitor` story service `tts` "TTS Engine" | `src/ui/components/ApiStatusMonitor.stories.tsx:14` | keep | Fixture only; no runtime service list names a provider. |
| 214 | BFF `CharacterVoice` model (`extra="forbid"`, `strict=True`, MiniMax ranges speed 0.5–2, vol (0,10], pitch ±12, emotion enum) | `/home/andres/PycharmProjects/magic-worlds-api/src/models/character.py:11-24,26-39` | rewrite for ElevenLabs (backend) | **Blocks** the frontend type change: unknown fields return 422. Ship it first (Key finding 3). |
| 215 | BFF preset payloads (`pitch` ±12, `emotion`, `language_boost` default `'auto'`, `extra="forbid"`) | `/home/andres/PycharmProjects/magic-worlds-api/src/models/voice_preset.py:8-21,40-53` | rewrite for ElevenLabs (backend) | Mirror of `VoicePresetCreatePayload` (item 11). |
| 216 | `voice_preset` table columns `volume`, `pitch`, `emotion`, `language_boost` and the "MiniMax system voice" comment | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:1276-1296` | rewrite for ElevenLabs (backend migration) | Drives the `VoicePreset` shape (item 10). |
| 217 | 32 kHz mono MP3 guard on `voice_audio_chunk` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/delivery.py:349-353`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:22` | rewrite for ElevenLabs (backend) | Must change with item 29. |
| 218 | Consent version `voice-v1` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:26` | rewrite (bump) | Required for items 144-145 to trigger re-consent through `consent_stale`. |
| 219 | System-voice catalog cache (5 min) | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:46,243-253` | rewrite for ElevenLabs (backend) | Confirms the "cached for 5 minutes" claim in §3.1. |
| 220 | `CLAUDE.md` → `AGENTS.md` symlink | `CLAUDE.md` | rewrite once | Item 202 is a single file. |
| 221 | Billing doc ElevenLabs plan table | `docs/billing/README.md:75-79,146,271` | re-verify | Unsourced figures that predate this research. |
| 222 | LLM-profile status doc theme-song writer | `docs/llm_profiles/12_implementation_status.md:109-110` | rename provider-neutral (only if music changes) | Part of the §10 decision. |
| 223 | Generated bundles containing "MiniMax" | `ds-bundle/_ds_bundle.js`, `ds-bundle/_preview/*.js`, `dist/`, `storybook-static/` | regenerate | Git-ignored (`.gitignore:11,16,23`). |

Checked and **excluded** (false positives): the character creator's "voice" section (`src/features/creation/character/fields.ts:84-85,348-353`, i18n `creation.character.sections.voice.*` / `groups.voice`) is about written speech style (catchphrases, example lines), not TTS. `.design/novel-studio/story-studio-rework.html:1054` matched only inside an embedded base64 font.

---

## 13. Open questions

1. **Narration model.** Which model is the narration default? This decides which recipe controls exist (E4, E5) and whether the per-preset "speed" survives.
   - `eleven_v4`: best expressiveness; no speed, no style, no SSML.
   - `eleven_multilingual_v2`: has speed and style.
   - `eleven_flash_v2_5`: cheapest and fastest.
2. **Call model.** Will calls use `eleven_v4_turbo` through the Text-to-Dialogue WebSocket, or `eleven_flash_v2_5` through `stream-input` / multi-context (E21)? The answer decides whether audio tags are allowed in callbot text, and whether `<break>` survives.
3. **Catalog scope for users.** Which catalog do users see?
   - Premade only, or a curated subset?
   - Workspace (admin-created) voices? These would fix the baseline gap where cloned and designed voices are unreachable by users.
   - Voice Library picks, which don't use slots (E13)?
   - The notice period and commercial terms of library voices need checking before exposing them.
4. **Text to Dialogue for multi-voice narration.** Should a multi-voice turn be one Text-to-Dialogue call (≤ 10 voices, ≤ 2,000 characters, E20) instead of N per-segment jobs?
   - That would simplify `TurnNarration`'s multi-clip player into a single clip.
   - It would lose per-segment retries and partial playback.
5. **Migrating stored voices.** How are MiniMax ids in stored cards, presets, global presets and **frozen snapshots** mapped (§11.4)? Is there a fallback voice when an id is unmapped?
6. **Call output format.** Should calls stay on MP3 (`mp3_44100_64` / `mp3_24000_48`), or move to PCM with an AudioWorklet for lower latency and cleaner barge-in? (E2; the earlier review suggested PCM, `docs/voice-calls-review-2026-10-11.md:747`.)
7. **Billing unit.** ElevenLabs bills per character (E23) while `tts_generation` is per request. Should the membership unit change to characters? That would touch `membership.operations.*`, `UsageSection` and the profile fixtures.
8. **v4 pricing.** Do v4 prices hold after the promotional window "until Oct 12" (E23)? The live pricing page should be rechecked after 2026-10-12.
9. **Speed range.** Should the UI clamp speed to 0.7–1.2 (product docs) or allow the wider SDK range (E4)? Recommend the documented 0.7–1.2.
10. **Theme songs.** Should MiniMax Music (via fal.ai) also be removed, and replaced by ElevenLabs Music (§10)?
11. **Privacy and consent.** Is zero retention (Enterprise) required to keep the "not stored" promises, or should the copy change (§11.5)? Who owns the consent-version bump?
12. **Pronunciation dictionaries.** Are fantasy proper nouns (character and world names) in scope? A per-world pronunciation dictionary (E10) could be a new card-level feature.

---

## 14. Sources

### External, official ElevenLabs (read 2026-10-12)
1. https://elevenlabs.io/docs/api-reference/text-to-speech/convert
2. https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps
3. https://elevenlabs.io/docs/api-reference/voices/settings/update
4. https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech
5. https://elevenlabs.io/docs/overview/models
6. https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4.md
7. https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices
8. https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-do-audio-tags-work-with-eleven-v3-and-v4.md
9. https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/pronunciation-dictionaries.md
10. https://elevenlabs.io/docs/api-reference/voices/search
11. https://elevenlabs.io/docs/api-reference/voices/voice-library/get-shared
12. https://elevenlabs.io/docs/api-reference/voices/voice-library/share
13. https://elevenlabs.io/docs/api-reference/voices/delete
14. https://elevenlabs.io/docs/api-reference/text-to-voice/design
15. https://elevenlabs.io/docs/api-reference/text-to-voice/create
16. https://elevenlabs.io/docs/api-reference/voices/ivc/create
17. https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning
18. https://elevenlabs.io/docs/overview/capabilities/voice-remixing.md
19. https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert
20. https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets.md
21. https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/multi-context-web-socket.md
22. https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tts.md
23. https://elevenlabs.io/docs/help-center/account/general/how-many-voice-slots-do-i-get-per-tier-and-how-can-i-increase-it
24. https://elevenlabs.io/pricing/api
25. https://elevenlabs.io/docs/llms.txt (page index used to enumerate the docs)

### External, secondary
26. https://www.mintlify.com/elevenlabs/elevenlabs-python/api-reference/voices/settings (SDK speed range; conflicts with the product docs)
27. https://testingcatalog.com/elevenlabs-launches-eleven-v4-and-v4-turbo-voice-models (v4 launch)
28. https://www.vktr.com/ai-platforms/elevenlabs-launches-eleven-v4-and-v4-turbo/ (v4 launch)
29. https://openrouter.ai/elevenlabs/eleven-v4 (third-party listing; date discrepancy)

### MiniMax links found in the code (not re-read; cited as code facts)
- `https://platform.minimax.io/docs/api-reference/voice-management-get`, `…/faq/system-voice-id.md`, `…/speech-t2a-http.md`, `…/voice-cloning-clone.md`, `…/file-management-upload.md`, `…/voice-design-design`, `…/voice-management-delete`. Referenced in `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/MiniMaxReferenceDrawer.tsx:37-101`.

### Codebase files read (frontend, `/home/andres/WebstormProjects/magic-worlds/`)

| Area | Files |
|---|---|
| Baseline and repo docs | `docs/voice_refactor/research/00_current_tts_review.md`; `CLAUDE.md`; `AGENTS.md`; `README.md`; `.env.example`; `.env` (flag lines only); `docs/voice-calls-review-2026-10-11.md`; `docs/voice-calls-latency-review-2026-10-11.md`; `docs/llm_profiles/{01,08,12,14}_*.md`; `docs/ui-audit-2026-09-19-play-admin.md` |
| Types | `src/shared/types/{voicePreset,adminVoice,voice,interaction,adventure,character,task,media,ui}.types.ts`; `src/shared/types/index.ts` |
| Flags | `src/shared/featureFlags.ts`; `src/shared/voiceFeatureFlag.ts` |
| API | `src/infrastructure/api/{index,chatSocket,voiceSocket,mediaUrl,themeSongContract}.ts` |
| Admin console | `src/features/admin/voices/**` (all 32 files) |
| User studio | `src/features/voices/**` (all 12 files) |
| Interaction | `src/features/interaction/components/{TurnNarration,ChatTurn,ChatComposer,InteractionCenterPanel,InteractionLeftPanel,VoiceConsentModal}.tsx`; `src/features/interaction/utils/{chatTtsTurnState,adventureSnapshot}.ts`; `src/features/interaction/chatSessionConfig.ts`; `src/features/interaction/hooks/{useAdventureChatSocket,useVoiceCallController,useVoiceCallSocket}.ts`; `src/features/interaction/audio/voicePlaybackBuffer.ts`; `src/features/interaction/voiceCallLabels.ts` |
| Calls | `src/features/call/components/{CallsPage,CallTranscriptView,CallScreen}.tsx` |
| Creation, tasks, utils | `src/features/creation/character/components/CharacterCreator.tsx`; `src/features/creation/common/components/MediaStudioSection.tsx`; `src/features/tasks/components/TasksPanel.tsx`; `src/utils/cardTransforms.ts` |
| Docs and assistant | `src/features/docs/components/docsContent.ts`; `src/features/appAssistant/{appKnowledge,assistantSuggestions}.ts` |
| Marketing and UI | `src/assets/marketing/index.ts` (+ `docs/voice-presets.webp` viewed); `src/ui/components/{Sidebar,SidebarAccountMenu,AppWarningModal,ApiStatusMonitor.stories}.tsx`; `src/ui/components/audio/{VoiceClipPlayer.tsx,audioFocus.ts}`; `src/ui/docs/brand/Voice.mdx`; `src/ui/docs/foundations/Typography.mdx` |
| Routing and landing | `src/app/router/AppRouter.tsx`; `src/features/gallery/galleryLinks.ts`; `src/features/landing/components/landingContent.ts` |
| Locales | `src/app/i18n/locales/en.ts`; `src/app/i18n/locales/es.ts` |
| Storybook | `.storybook/{main.ts,preview.tsx,preview-head.html,tsconfig.json}` |
| Stories | `src/features/admin/voices/components/*.stories.tsx`; `src/features/voices/components/*.stories.tsx`; `src/features/admin/PlayAdminAudit.stories.tsx`; `src/features/admin/playAdminAuditFixtures.tsx`; call/profile/ChatTurn stories |
| Tests | Every test listed in §9.2 |

### Codebase files read (backend, cross-reference only)
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py` (route decorators at 75, 91, 107, 150, 166, 182)
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py` (route decorators at 62, 74, 87, 99, 121, 130, 145)
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/tts.py` (route decorators at 62, 103, 143)

---

## Verification log (2026-10-12)

An adversarial fact-check of this note against the working tree of both repos (frontend HEAD `f0f5769` plus uncommitted changes, and the backend `magic-worlds-api`). Read-only: no code was changed. External ElevenLabs facts (§1, E1–E24) were **not** re-fetched in this pass; only codebase citations were checked.

### What was checked (about 190 citations)

| Area | Citations re-read | Result |
|---|---|---|
| `voicePreset.types.ts`, `adminVoice.types.ts` (every row of §2.1–2.2 and items 1–27) | 30 | All correct |
| `voice.types.ts`, `interaction.types.ts`, `character`/`adventure`/`task`/`media`/`ui` types, barrel | 22 | All correct |
| `cardTransforms.ts` and `adventureSnapshot.ts` readers (L57-72, L81-96, L92, L112, L204, L287) | 8 | All correct |
| `apiService` methods (§3.1; 20 methods by `grep -n`), imports, `fetchProtectedMediaBlob` origin check, dead-code claims (`waitForTts` and `getCharacterChatCalls` have no callers outside `index.ts`) | 24 | All correct |
| Backend route decorators (`admin_voices.py`, `voice_presets.py`, `tts.py`) and the 5-minute system-voice cache | 17 | All correct |
| `chatSocket.ts`, `voiceSocket.ts`, `mediaUrl.ts`, feature flags, `.env.example:25-26` | 12 | **1 error** (forbidden keys), consumer list incomplete |
| Admin console: `constants.ts` (every row), `SynthControls`, `SynthLabPanel`, `TextArtifactToolbar`, `MiniMaxReferenceDrawer`, `hexAudio`, `voiceIdRules`, `voiceLanguage`, `VoiceCloneForm`, `VoiceDesignForm`, `AdminVoicesPage` | 45 | **1 error** (file count); clone payload lines added |
| User studio: `recipe.ts`, `usePreviewVoice.ts`, `PresetRecipeControls`, `SystemVoicePicker`, `PresetEditor`, `VoiceStudioPage`, `VoicePickerDialog`; `CharacterCreator`, `InteractionLeftPanel`, `CallsPage` | 35 | All correct (file count 12 confirmed; `DEFAULT_PROMPT` = 105 and `DEFAULT_PREVIEW_TEXT` = 100 characters confirmed) |
| Narration and call UI (`TurnNarration`, `voicePlaybackBuffer`, `useVoiceCallController`, `CallTranscriptView`, `chatTtsTurnState`, `voiceCallLabels`, `VoiceConsentModal`, navigation, tasks, chat-socket hooks) | 30 | All correct |
| i18n `en.ts`/`es.ts`: all 7 lines that name MiniMax in each file, `admin.voices.synth.*` sub-blocks, `voices.recipe.*`, `voices.studio.chip*`, retention keys | 40 | **1 error** (item 146) |
| Stories and tests (§9.1–9.2 line refs) | 30 | **1 error** (`ControlSlider.stories`) |

### Corrections made in place

1. **`voiceSocket.ts` forbidden keys** (§3.3 and item 62). The note said to add `audio_base64`, but it is already in `FORBIDDEN_CLIENT_PAYLOAD_KEYS` (`src/infrastructure/api/voiceSocket.ts:68`). Only `xi_api_key` / `xi-api-key` need adding.
2. **Admin console file count** (§4 intro and §14). The folder has 32 files, not 31: 8 at the root, 23 in `components/`, 1 in `hooks/`.
3. **Item 146, retention claims.** `en.ts:5754` / `es.ts:5764` is `call.screen.endCall`. The `privacyNote` key is at `5755` / `5765`. Also added `disclosures.noRecordings` (`4825` / `4835`).
4. **`ControlSlider.stories` line refs** (§9.1 and item 180). Corrected `L40-47` to `L41, L47-48, L54`.
5. **Key finding 4.** The player's MP3 parser also covers 16 kHz (MPEG-2) and MPEG-2.5 (8, 11.025, 12 kHz). The conclusion is unchanged.

### Additions

- **Key finding 3:** the BFF's `CharacterVoice` and preset models are `extra="forbid"` and `strict`. New ElevenLabs fields sent from the SPA would get a 422, so the backend must ship first.
- **Key finding 4:** the backend also hard-guards 32 kHz in `delivery.py:349-353`.
- **Key finding 10:** the current consent version is `voice-v1` (`config.py:26`).
- **Items 94 and 95:** the payload lines L166-167 in `VoiceCloneForm.tsx`.
- **§3.5:** completed the flag-consumer list. `useVoiceCallController.ts:17,200` was missing, along with second line numbers for several files.
- **§8.4:** `CLAUDE.md` is a symlink to `AGENTS.md`. Added three rows: `docs/llm_profiles/12_implementation_status.md:109-110`, an unsourced ElevenLabs pricing table in `docs/billing/README.md:75-79`, and the git-ignored generated bundles (`ds-bundle/`, `dist/`, `storybook-static/`).
- **§12.8:** a new checklist of items 206–223 (frontend leftovers plus the backend contract rows that block UI changes), and two false positives that were explicitly excluded.

### Searches run to find missed touchpoints

Case-insensitive `grep -rIl` over the frontend repo (excluding `node_modules`, `.git`, `dist`, `storybook-static`) for:

> `minimax`, `t2a`, `speech-2`, `language_boost`, `languageBoost`, `MINIMAX_`, `base_resp`, `<#`, `interjection`

A second pass over `src/` used:

> `tts`, `voice_id`, `voiceId`, `narrator_voice`, `narrate_thoughts`, `text_to_speech`, `CharacterVoice`, `VoicePreset`, `audio_hex`, `has_voice`, `tts_generation`, `voice_call`, `emotion`, `pitch`

Every hit file was then compared against the files this note already names. Other passes:

- `docs/`, `.agents/`, `.claude/`, `README.md` and `scripts/` (no `scripts/` dir exists) for TTS and voice terms.
- `en.ts` for voice vocabulary outside the cited blocks.
- A cross-check in the backend of `src/`, `tests/`, `db.sql`, `.env.example` and the agent graphs, used only for the rows the UI depends on.

The only frontend file containing an ElevenLabs reference is `docs/billing/README.md`. There is no `elevenlabs`/`eleven_` string anywhere in `src/`.

### Not verified in this pass

- The external ElevenLabs facts E1–E24 and their URLs. They were taken as written; see the sibling notes 01–05.
- The line numbers inside `docs/voice-calls-review-2026-10-11.md` and `docs/voice-calls-latency-review-2026-10-11.md` (§8.4). They are historical, so they were not re-read.
- The statement in §8.2 that `voice-presets.webp` has no provider text. The image was not re-opened.
