# ElevenLabs beyond core TTS: other products and their fit for magic-worlds

> **Research scope (reviewed 2026-10-14):** Historical evidence from the dates stated below, including the retired MiniMax baseline. Vendor prices, model/API facts and policy claims were not reverified in this documentation pass. Current application status is **WIP** and is tracked in [00](../00_current_status_and_roadmap.md); later native ElevenLabs code/cutover supersedes migration-era implementation assumptions here.

Research date: **2026-10-12**. Read-only research. No code was changed.

## Scope

This note covers ElevenLabs products **other than** core TTS, the voice catalog, voice design and cloning, and realtime speech. Each of those has its own note in this folder. Products covered here:

- Studio (formerly Projects) and GenFM podcasts
- Sound Effects
- Eleven Music, assessed as a replacement for the fal.ai `minimax/music-3` and `ace-step` theme songs
- Batch Speech-to-Text (Scribe v2)
- Voice Changer, Voice Isolator, Dubbing, Forced Alignment and Audio Native
- History, usage and subscription endpoints
- Workspaces, service accounts, API keys, single-use tokens and webhooks
- Safety tooling: Audio Detector / AI Speech Classifier, watermarking, C2PA, moderation, and the Prohibited Use Policy

For each product the note records:

- what it is
- endpoints and models
- key parameters and limits
- output formats
- pricing
- commercial terms
- a **fit assessment** for magic-worlds, with an integration idea and an effort estimate

It ends with a ranked opportunity backlog. Baseline for the current stack: [00_current_tts_review.md](./00_current_tts_review.md).

**Confidence tags:**
- `[verified: url]`: read on an official ElevenLabs page today (2026-10-12).
- `[secondary: url]`: a non-official source.
- `[unverified]`: from memory, or not confirmed.
- `[derived]`: arithmetic or inference from the cited facts.

Codebase facts cite `absolute/path:line`.

**Effort scale:** **S** is ≤ 1 dev-week, **M** is 1–3 dev-weeks, **L** is more than 3 dev-weeks. Each estimate covers backend, frontend and tests.

---

## Contents

0. [Executive summary](#0-executive-summary)
1. [magic-worlds surfaces considered](#1-magic-worlds-surfaces-considered)
2. [Cross-cutting facts (billing model, plans, concurrency, SDKs, regions)](#2-cross-cutting-facts)
3. [ElevenCreative Studio (formerly Projects) + GenFM](#3-elevencreative-studio-formerly-projects--genfm)
4. [Sound Effects](#4-sound-effects)
5. [Eleven Music (theme-song replacement)](#5-eleven-music-theme-song-replacement)
6. [Speech-to-Text batch (Scribe v2)](#6-speech-to-text-batch-scribe-v2)
7. [Voice Changer (speech-to-speech)](#7-voice-changer-speech-to-speech)
8. [Voice Isolator (audio isolation)](#8-voice-isolator-audio-isolation)
9. [Dubbing](#9-dubbing)
10. [Forced Alignment](#10-forced-alignment)
11. [Audio Native](#11-audio-native)
12. [History API and provider-side data retention](#12-history-api-and-provider-side-data-retention)
13. [Usage, analytics and subscription endpoints](#13-usage-analytics-and-subscription-endpoints)
14. [Workspaces, service accounts, API keys, single-use tokens, webhooks](#14-workspaces-service-accounts-api-keys-single-use-tokens-webhooks)
15. [Safety: detector/classifier, watermarking, C2PA, moderation, policy](#15-safety-detectorclassifier-watermarking-c2pa-moderation-policy)
16. [Briefly noted (low fit or covered elsewhere)](#16-briefly-noted-low-fit-or-covered-elsewhere)
17. [Opportunity backlog (ranked)](#17-opportunity-backlog-ranked)
18. [Discrepancies found in official sources](#18-discrepancies-found-in-official-sources)
19. [Open questions](#19-open-questions)
20. [Sources](#20-sources)
21. [Verification log (2026-10-12)](#verification-log-2026-10-12)

---

## 0. Executive summary

1. **Eleven Music can technically replace both fal.ai theme-song models. The catch is commercial terms, not capability.**
   - **Capability.** Music v2/v2.5 offers:
     - chunk-based composition plans with per-section lyrics and styles;
     - `force_instrumental`;
     - lengths from 3 s up to 600 s on the API;
     - direct MP3 output up to 48 kHz/320 kbps;
     - word timestamps and waveform data;
     - inpainting;
     - C2PA signing.

     [verified: https://elevenlabs.io/docs/api-reference/music/compose] [verified: https://elevenlabs.io/docs/api-reference/music/compose-detailed]
   - **Commercial terms.** The Music Terms (updated 2026-10-09) impose:
     - per-plan **monthly generation caps**: Pro 304 min, Business 4,800 min;
     - **Music concurrency of 2 to 5**;
     - eligibility limits: Free–Pro are "For Individual Use Only";
     - a **Model Resale** ban that explicitly covers "offering any Music Model alongside third-party models".

     [verified: https://elevenlabs.io/music-terms]
   - **The model picker is a problem.** Today's picker offers `minimax_music_3` vs `ace_step` (`/home/andres/WebstormProjects/magic-worlds/src/features/creation/common/components/MediaStudioSection.tsx:449-450`). Putting "Eleven Music" next to ACE-Step in that picker matches the wording the terms use to define a Reseller ("offering any Music Model alongside third-party models"), and Model Resale is "Prohibited" on every self-serve plan. The Reseller definition also has a carve-out for "generating and distributing Output through its own product", so whether an in-app picker counts is a **legal question**. The safe design is not to expose the choice [verified: https://elevenlabs.io/music-terms] [derived].
   - **Eligibility (corrected during verification).** Free, Starter, Creator and Pro are "For Individual Use Only". A company running magic-worlds is eligible only for **Scale** (fewer than 10 employees), **Business** (fewer than 50) or Enterprise Music. The realistic self-serve monthly generation caps are therefore **1,100 min** (Scale) or **4,800 min** (Business), not Pro's 304 min [verified: https://elevenlabs.io/music-terms].
   - **Cost.** About **$0.15 per 60 s song**, versus about **$0.012 per 60 s on ACE-Step** (fal, $0.0002/s) [verified: https://elevenlabs.io/pricing/api] [verified: https://fal.ai/models/fal-ai/ace-step] [derived].
   - **Recommendation:** replace `minimax_music_3` with Eleven Music as the single "premium" engine, hidden behind our own alias. Keep or drop ACE-Step as a business decision. Get legal sign-off on the Music Terms before shipping.
2. **The Studio API is sales-gated.** "The ElevenCreative Studio API is only available upon request" [verified: https://elevenlabs.io/docs/api-reference/studio-api-information].
   - For a Story Studio or adventure audiobook export, the recommended **default path** is to assemble audio ourselves from the TTS / Text-to-Dialogue endpoints we will already integrate.
   - Adventure logs already carry speaker-attributed segments (`/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_segments.py:13`) and often already have narrated MP3s. An "export adventure as audio" feature can therefore be close to free.
   - Studio remains an optional enterprise path.
3. **Sound Effects (`eleven_text_to_sound_v2`) is the best new user-facing feature.** It offers:
   - 0.5–30 s clips;
   - seamless loops (`loop=true`);
   - royalty-free output on paid plans.

   This makes **per-world / per-location ambience loops**, generated once per card like theme songs, cheap and high-impact [verified: https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert] [verified: https://elevenlabs.io/docs/overview/capabilities/sound-effects].
4. **Scribe v2 batch STT** strengthens two features:
   - **push-to-talk dictation** in the text chat composer;
   - **audio/video lorebook import**.

   It costs $0.22/h. **Keyterm prompting** (up to 1,000 terms, +20%) suits roleplay proper nouns. `file_format=pcm_s16le_16` matches the call uplink's 16 kHz PCM16 mono WAV exactly. [verified: https://elevenlabs.io/docs/api-reference/speech-to-text/convert] `scribe_v1` is deprecated. Its announced removal date, **2026-07-09, has already passed**, so treat it as unavailable and use `scribe_v2` only [verified: https://elevenlabs.io/docs/changelog/2026/6/8] [verified: https://elevenlabs.io/docs/overview/models].
5. **Privacy hygiene is mandatory, not optional.**
   - By default ElevenLabs **retains TTS/STT text and audio in History**.
   - Zero Retention Mode (`enable_logging=false`) is **Enterprise-only**.
   - Music, Dubbing and Studio are **not ZRM-eligible** at all.

   [verified: https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode] Plan a **History deletion sweep** (`DELETE /v1/history/{id}`, `DELETE /v1/speech-to-text/transcripts/{id}`) for roleplay content.
6. **Ops endpoints worth adopting from day 1:**
   - `POST /v1/workspace/analytics/query/usage-by-product-over-time`, which replaces the **deprecated** `/v1/usage/character-stats`;
   - `GET /v1/user/subscription`;
   - per-key **credit quotas, endpoint scopes and IP allowlists**;
   - the `character-cost` / `request-id` response headers;
   - HMAC **workspace webhooks**, including `voice_removal_notice` for Voice-Library voices our characters may depend on.

   [verified: https://elevenlabs.io/docs/api-reference/analytics/workspace/usage] [verified: https://elevenlabs.io/docs/overview/administration/workspaces/api-keys] [verified: https://elevenlabs.io/docs/eleven-api/resources/webhooks]
7. **Low fit for now:** Dubbing, Audio Native, Voice Changer and the standalone Voice Isolator. Instant Voice Clone creation already has `remove_background_noise`. Image & Video / Avatars is out of scope.

---

## 1. magic-worlds surfaces considered

| Surface | Where | Relevance |
|---|---|---|
| Theme songs (cards: character/world/item/adventure template) | Backend engine `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/` (config `config.py:20-39`, registry `registry.py:27-96`, writer `prompt_agent.py:44-47`, fal adapter `fal_adapter.py:148-198`, transcode `transcode.py:18,43`, storage `storage.py:108`); target types `/home/andres/PycharmProjects/magic-worlds-api/src/models/theme_song.py:11-15`; request model `theme_song.py:67-104`; UI `/home/andres/WebstormProjects/magic-worlds/src/features/creation/common/components/MediaStudioSection.tsx:113,417,446-450`; FE alias type `/home/andres/WebstormProjects/magic-worlds/src/shared/types/media.types.ts:80` | Eleven Music (§5) |
| Writer graphs for music text | `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/runtime/theme_song_prompt_ace_step.v2.json`, `.../theme_song_prompt_minimax_music_3.v2.json` | Would need a new `eleven_music` writer graph (§5.6) |
| Card sharing clones theme songs (card PNG export does not include audio) | `/home/andres/PycharmProjects/magic-worlds-api/src/services/card_resource_clone.py:51,98-103`; storages wired in `/home/andres/PycharmProjects/magic-worlds-api/src/routes/card_sharing.py:20-31`; export is a PNG render only, `/home/andres/PycharmProjects/magic-worlds-api/src/services/card_export/content.py:48-53` | Music Terms "Music Library" restriction (§5.4) |
| Story Studio (novel, TipTap) | FE `/home/andres/WebstormProjects/magic-worlds/src/features/novel/components/NovelStudio.tsx:38`; BE chapter model `/home/andres/PycharmProjects/magic-worlds-api/src/routes/stories.py:140-149` (`body: str`, `povCardId`, `locationCardId`), chapters list `stories.py:192` | Audiobook export (§3) |
| Adventure play loop + narration | Segment kinds `narrator`/`speech`/`thought` `/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_segments.py:13`; per-segment TTS (baseline §2 path A); player `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/TurnNarration.tsx:45` | Adventure audio export (§3), SFX/ambience (§4), alignment (§10) |
| Chat composer (text) | `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/ChatComposer.tsx:52` | Dictation via Scribe (§6) |
| Voice calls STT (Groq) | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:23-24,123`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/stt_groq_client.py:53-59`; transcript UI `/home/andres/WebstormProjects/magic-worlds/src/features/call/components/CallTranscriptView.tsx:93` | Scribe batch option (§6); realtime is covered in another note |
| Lorebook resources (PDF import today) | PDF-only gate `/home/andres/PycharmProjects/magic-worlds-api/src/services/lorebook_pdf.py:79`; FE `/home/andres/WebstormProjects/magic-worlds/src/features/lorebook/lorebookResourceFiles.ts:7` | Audio/video import via Scribe (§6) |
| Admin voice clone form | `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/VoiceCloneForm.tsx:60,166` (`need_noise_reduction`) | Voice Isolator / IVC noise removal (§8) |
| Background tasks | FE union `/home/andres/WebstormProjects/magic-worlds/src/shared/types/task.types.ts:11`; BE `/home/andres/PycharmProjects/magic-worlds-api/src/routes/tasks.py:73` | New job kinds (audiobook export, ambience) |
| Membership ops + quotas | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:57-67`; seeds `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py:25-48` (e.g. theme songs free 5/day `:30`) | New operations + cost guardrails |
| Provider cost console | `/home/andres/WebstormProjects/magic-worlds/src/features/admin/membership/components/ProviderCostByPayer.tsx:2-4,90` | Surface ElevenLabs spend (§13) |
| Provider webhooks | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/webhooks/fal.py:17-28` (verified fal webhook) | Pattern for `/webhooks/elevenlabs` (§14) |

---

## 2. Cross-cutting facts

### 2.1 Two billing views: credits (ElevenCreative UI) vs USD (ElevenAPI)

- The API pricing page states: "API usage is billed in US dollars, not credits." It lists the following rates [verified: https://elevenlabs.io/pricing/api]:

  | Product | Rate |
  |---|---|
  | TTS, multilingual models | $0.08 / 1K chars |
  | TTS, Flash/Turbo | $0.04 / 1K chars |
  | Scribe v2 | $0.22 / h |
  | Scribe v2 Realtime | $0.39 / h |
  | Keyterms (batch) | +$0.05 / h |
  | Transcript editing (batch) | +$0.07 / h |
  | Music | $0.15 / min |
  | Voice Changer and Isolator | $0.12 / min |
  | Sound Effects | $0.12 / min |
  | Dubbing v1 | $0.33–0.50 / min |
  | Dubbing v2 | $2.20 / min |

  *Added during verification:* the API pricing page now also lists **Eleven v4** at $0.08 / 1K chars and **v4 Turbo** at $0.04 / 1K chars, with a launch promotion ("72% off until Oct 12") that ends on the research date. Price TTS on list rates, not the promotion. Model choice is covered in the TTS note [verified: https://elevenlabs.io/pricing/api]. The same page says "Music and Sound Effects are billed per generation" and "Dubbing is billed per source audio minute" [verified: https://elevenlabs.io/pricing/api].
- **Each API plan includes usage equal to its fee.** Examples [derived from https://elevenlabs.io/pricing/api]:
  - Creator: 147 Music minutes × $0.15 ≈ $22.
  - Pro: 660 min × $0.15 = $99.
  - Creator: 100 STT hours × $0.22 = $22.
- The main pricing page lists **credit** costs for the UI [verified: https://elevenlabs.io/pricing]:

  | Product | Credits |
  |---|---|
  | TTS | 1 credit per character |
  | STT | 330 credits / min |
  | Music | 900 credits / min |
  | Sound Effects | 200 credits / generation |
  | Voice Changer and Isolator | 1,000 credits / min |
  | Dubbing | 2,000–10,000 credits / min |

  The billing doc says credit use depends on "whether you're generating via the website or API" [verified: https://elevenlabs.io/docs/overview/administration/billing].
- **Plans (monthly)** [verified: https://elevenlabs.io/pricing]:

  | Plan | Price | Credits | Seats |
  |---|---|---|---|
  | Free | $0 | 10k | |
  | Starter | $6 | 30k | |
  | Creator | $22 | 121k | |
  | Pro | $99 | 600k | |
  | Scale | $299 | 1.8M | 3 |
  | Business | $990 | 6M | 10 |
  | Enterprise | custom | | |

  - The commercial license starts at **Starter**.
  - Using the services commercially on a free plan is prohibited [verified: https://elevenlabs.io/use-policy].
- **Measure, do not assume.** Capture the per-request `character-cost` and `request-id` response headers [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/request-stitching]. Reconcile them against workspace analytics (§13).

### 2.2 Concurrency (per plan)

| Plan | STT batch | STT realtime | Music | Dubbing |
|---|---|---|---|---|
| Free | 8 | 6 | 0 | 3 |
| Starter | 12 | 9 | 2 | 3 |
| Creator | 20 | 15 | 2 | 3 |
| Pro | 40 | 30 | 2 | 3 |
| Scale | 60 | 45 | 5 | 3 |
| Business | 60 | 45 | 5 | 3 |
| Enterprise | elevated | elevated | highest | 10 |

Sources:
- STT, realtime STT and Music columns [verified: https://elevenlabs.io/docs/overview/models]
- Dubbing column [verified: https://elevenlabs.io/docs/overview/capabilities/dubbing]

Responses carry the `current-concurrent-requests` and `maximum-concurrent-requests` headers [verified: https://elevenlabs.io/docs/overview/models].

### 2.3 SDKs, base URLs, residency

- **SDKs.** Python `elevenlabs` **2.71.0** (PyPI, 2026-10-05) and JS `@elevenlabs/elevenlabs-js` **2.71.0** [verified: https://pypi.org/pypi/elevenlabs/json] [verified: https://registry.npmjs.org/@elevenlabs/elevenlabs-js/latest].
- **The backend uses raw `httpx` today** (e.g. `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/stt_groq_client.py:11`). If we stay with raw HTTP for `POST /v1/music/detailed`, parse `multipart/mixed` defensively. The SDKs themselves needed a CRLF parsing fix for that endpoint [verified: https://elevenlabs.io/docs/changelog/2026/3/9].
- **Servers:**
  - default `https://api.elevenlabs.io`
  - US `https://api.us.elevenlabs.io`
  - EU `https://api.eu.residency.elevenlabs.io`
  - India `https://api.in.residency.elevenlabs.io`
  - Singapore `https://api.sg.residency.elevenlabs.io`

  [verified: https://elevenlabs.io/docs/api-reference/music/compose]
- **Deprecated base URL.** The opt-in `api-global-preview.elevenlabs.io` is deprecated [verified: https://elevenlabs.io/docs/changelog/2026/2/9].

---

## 3. ElevenCreative Studio (formerly Projects) + GenFM

### 3.1 What it is
- **What it is.** A long-form editor. Its Audio projects cover:
  - narration, podcasts and audiobooks;
  - a Chapters sidebar;
  - Actor Mode;
  - generation history and paragraph locking;
  - MP3/WAV export.

  Video projects add a timeline, captions and Studio Agent. "Studio 4.0 combines a prompt-first workflow with timeline editing" [verified: https://elevenlabs.io/docs/api-reference/studio-api-information].
- **Plans.** Studio is on all plans, including Free. **GenFM "Create a podcast" requires a paid plan** [verified: same page].
- **Access gate (critical):** "The ElevenCreative Studio API is only available upon request. To get access, contact sales." [verified: https://elevenlabs.io/docs/api-reference/studio-api-information]

### 3.2 API endpoints (Studio)

| Method / path | Purpose | Notable params |
|---|---|---|
| `POST /v1/studio/projects` (multipart) | Create project blank / from URL / from document (`.epub`, `.pdf`, `.txt`…) / from `from_content_json` | `default_model_id`, `default_title_voice_id`, `default_paragraph_voice_id`, `quality_preset` (`standard` 128 kbps/44.1 kHz, `high` 192 kbps, `ultra` 192 kbps, `ultra_lossless` 705.6 kbps), `title`, `author`, `isbn_number`, `genres`, `target_audience`, `language`, `mature_content`, `fiction`, `volume_normalization`, `pronunciation_dictionary_locators`, `callback_url`, `apply_text_normalization`, `auto_convert`, `auto_assign_voices` (**alpha**), `voice_settings` (per-voice JSON overrides), `create_publishing_read` [verified: https://elevenlabs.io/docs/api-reference/studio/add-project] |
| `POST /v1/studio/projects/{id}/content` | Replace content (`from_url` / `from_document` / `from_content_json`, `auto_convert`) | [verified: https://elevenlabs.io/docs/api-reference/studio/update-content] |
| `POST /v1/studio/projects/{id}/chapters` | Add chapter (`name`, `from_url`) | [verified: https://elevenlabs.io/docs/api-reference/studio/add-chapter] |
| `POST /v1/studio/projects/{id}/convert` | Convert whole project (returns `{"status":"ok"}`) | [verified: https://elevenlabs.io/docs/api-reference/studio/convert-project] |
| `GET …/chapters/{chapter_id}/snapshots` | List chapter snapshots ("Whenever a chapter is converted a snapshot will automatically be created") | [verified: https://elevenlabs.io/docs/api-reference/studio/get-chapter-snapshots] |
| `POST …/chapters/{chapter_id}/snapshots/{snapshot_id}/stream` | Stream chapter audio, `convert_to_mpeg` | [verified: https://elevenlabs.io/docs/api-reference/studio/stream-chapter-snapshot] |
| `POST …/snapshots/{project_snapshot_id}/stream` | Stream project audio, `convert_to_mpeg` | [verified: https://elevenlabs.io/docs/api-reference/studio/stream-snapshot] |
| `POST …/snapshots/{project_snapshot_id}/archive` | Compressed archive of project audio | [verified: https://elevenlabs.io/docs/api-reference/studio/archive-snapshot] |
| `POST /v1/studio/projects/{id}/pronunciation-dictionaries` | Attach pronunciation dictionaries | [verified: https://elevenlabs.io/docs/api-reference/studio/create-pronunciation-dictionaries] |
| `POST /v1/studio/podcasts` | GenFM podcast: `mode` `conversation` (two voices) or `bulletin`, `duration_scale` `short` (<3 min) / `default` (3–7) / `long` (>7), `intro`, `outro`, `instructions_prompt`, `highlights` (10–70 chars), `callback_url`; header `safety-identifier` ("Used for moderation. Your workspace must be allowlisted") | [verified: https://elevenlabs.io/docs/api-reference/studio/create-podcast] |

**Content model.** `from_content_json` is `[ {name, blocks:[ {sub_type:"p"|"h1"|"h2", nodes:[{type:"tts_node", voice_id, text}]} ]} ]` [verified: https://elevenlabs.io/docs/api-reference/studio/add-project].
- **Per-node `voice_id`** gives per-character voices inside a paragraph.
- The help center confirms that multiple voices can share one paragraph [verified: https://elevenlabs.io/docs/help-center/product/studio/studio/can-i-assign-more-than-one-voice-to-a-paragraph-in-studio].

**Conversion callbacks.** `callback_url` receives `project_conversion_status` / `chapter_conversion_status` events with `conversion_status`, `project_snapshot_id` / `chapter_snapshot_id` and `error_details` [verified: https://elevenlabs.io/docs/api-reference/studio/add-project].

### 3.3 Limits, quality, pricing
- **Size limits.** Up to **500 chapters/project**, **400 paragraphs/chapter** and **5,000 chars/paragraph** [verified: https://elevenlabs.io/docs/help-center/product/studio/studio/are-there-any-limitations-to-the-size-of-a-project-in-studio].
- **Project count per plan** [verified: same page]:

  | Plan | Projects |
  |---|---|
  | Free | 5 |
  | Starter | 20 |
  | Creator | 1,000 |
  | Pro | 3,000 |
  | Scale / Business | 20,000 |

  The pricing page says Free "3 Projects in Studio"; see §18 [verified: https://elevenlabs.io/pricing].
- **Export quality** is set by plan [verified: https://elevenlabs.io/docs/eleven-creative/products/studio]:
  - Free, Starter and Creator: 128 kbps MP3, or WAV made from a 128 kbps source.
  - Pro and above: 16-bit 44.1 kHz WAV or 192 kbps MP3.
- **Multi-chapter export** produces either a single file or a ZIP of chapters [verified: same page].
- **Pricing.**
  - Narration is billed at TTS rates.
  - Exporting already-generated paragraphs costs nothing extra.
  - Up to **two free regenerations** are allowed if the text, voice and settings are unchanged.

  [verified: https://elevenlabs.io/docs/api-reference/studio-api-information] [verified: https://elevenlabs.io/docs/eleven-creative/products/studio]
- **Voice settings per project.** The Studio UI allows speed 0.7–1.2 and volume −30 to +5 dB. The API `voice_settings` overrides are **keyed per `voice_id`**: stability, similarity_boost, style, speed, use_speaker_boost [verified: https://elevenlabs.io/docs/eleven-creative/products/studio] [verified: https://elevenlabs.io/docs/api-reference/studio/add-project].
- **Music and SFX** can be placed on the Studio timeline **in the UI**. However, "Sound effects are not supported in ElevenReader exports, or when streaming the project using the ElevenCreative Studio API" [verified: https://elevenlabs.io/docs/eleven-creative/products/studio]. The API content model only carries `tts_node`s, so **music/SFX placement is effectively UI-only** [derived].
- **Retention.** Studio is **not eligible for Zero Retention Mode** ("Studio is an editor that works with large project files that must be retained") [verified: https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode].

### 3.4 Catalog/Studio interaction (important for the voice refactor)

- **Our presets collapse in Studio.** Our `CharacterVoice` is a *recipe over a base voice* (baseline §2 path C). Two characters can share one base `voice_id` with different speed or emotion. Studio's API overrides `voice_settings` **per voice_id per project**, so two characters on the same base voice cannot keep distinct settings through the API. They would need distinct voice IDs, for example Voice Design variants or library voices [derived from https://elevenlabs.io/docs/api-reference/studio/add-project].
- **Per-node voice IDs must be real ElevenLabs voice IDs** visible to the workspace or service account that owns the project [derived].

### 3.5 Fit for magic-worlds: **Medium (as a product); Low (as an API dependency now)**

**Use cases:**
1. **Story Studio "Export as audiobook".**
   - Chapters map to Studio chapters.
   - The narrator voice is the book voice, or the POV character's voice (`povCardId`, `/home/andres/PycharmProjects/magic-worlds-api/src/routes/stories.py:148`).
   - Dialogue lines map to character voices.
   - **Gap:** chapter `body` is unattributed prose (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/stories.py:144`). Per-character voices need an attribution pass. Options are an LLM pass that emits the same `narrator`/`speech`/`thought` segment format as chat (`/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_segments.py:13`), or Studio's `auto_assign_voices` (alpha).
2. **Adventure log "audiobook / recap".** Adventure messages already have speaker-attributed segments with frozen per-character voices. Many turns already have narration MP3s (baseline §2 path A, `tts_segments`). **Stitching existing assets avoids re-synthesis cost** [derived].
3. **GenFM "Previously on…" recap podcast** from an adventure log.
   - Fun, but it is sales-gated and paid-only.
   - ElevenLabs' own LLM summarizes our (possibly mature) content.
   - It is not ZRM-eligible.

**Two implementation paths:**

| | Path A: Studio API | Path B: self-assembled (recommended default) |
|---|---|---|
| Access | Sales request required | Same TTS / Text-to-Dialogue endpoints we already integrate (see TTS notes) |
| Voices | Real voice IDs, per-voice settings only | Full recipe per character (our model) |
| Structure | Chapters / paragraphs / snapshots, free regenerations, ISBN/author metadata, `volume_normalization` for audiobook loudness | Our own chapter jobs; request stitching (`previous_request_ids`) for continuity [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert]; per-character alignment from `/with-timestamps` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps] |
| Data retention | Not ZRM-eligible; content stored in the project | Same as TTS (History sweep, §12) |
| Effort | M–L, plus a sales dependency | M (adventure export, reusing existing MP3s); L (novel with attribution pass) |
| Billing | TTS rates plus project-count limits | TTS rates; we control caching and reuse |

**Recommendation:** go with Path B.
- Add a `BackgroundTaskOperation` such as `audio_export` (`/home/andres/WebstormProjects/magic-worlds/src/shared/types/task.types.ts:11`).
- Concatenate per-segment MP3s on the server. Use a single codec and sample rate across the export so frame-level MP3 concatenation stays valid [derived].
- Keep Path A as an option if the business later wants ElevenReader publishing or Studio's editor UX.

---

## 4. Sound Effects

### 4.1 API

`POST /v1/sound-generation` [verified: https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert]

| Param | Values |
|---|---|
| `text` | required prompt |
| `model_id` | `eleven_text_to_sound_v2` (only allowed value; default) |
| `duration_seconds` | 0.5–30 (null = model guesses) |
| `loop` | bool, default false; "Only available for the `eleven_text_to_sound_v2` model" |
| `prompt_influence` | 0–1, default 0.3 |
| `output_format` (query) | `mp3_22050_32` … `mp3_44100_192` (192 needs Creator+), `pcm_8000`…`pcm_48000` (44.1 kHz PCM needs Pro+), `opus_48000_*`, `ulaw_8000`, `alaw_8000` |

- **Response:** the audio file (MP3 by default).
- **Prompt length:** the UI caps prompts at **450 characters** [verified: https://elevenlabs.io/docs/eleven-creative/playground/sound-effects].
- **Loop parameter:** added 2025-09 [verified: https://elevenlabs.io/docs/changelog/2025/9/1].

### 4.2 Capabilities, limits and pricing
- **Uses.** Foley, ambience, impacts, whooshes, drones, musical one-shots and loops.
- **Prompting.** Sequenced prompts are understood ("Footsteps on gravel, then a metallic door opens") [verified: https://elevenlabs.io/docs/overview/capabilities/sound-effects].
- **Key facts:** max **30 s per generation**; "Looping effects: Designed for seamless repeat playback". For long atmospheres, generate about 30 s with `loop=true` and repeat it client-side [verified: same page].
- **Output format caveat (added during verification).** The capability page says "MP3 for all effects; WAV at 48 kHz for non-looping effects". Request MP3 (or PCM, then encode it ourselves) for `loop=true` ambience, and test that the loop point survives our storage and playback path [verified: https://elevenlabs.io/docs/overview/capabilities/sound-effects].
- **Cost.** The figures disagree:

  | Source | Figure |
  |---|---|
  | Capability doc | "40 credits per second when duration is specified" |
  | Pricing FAQ | "200 credits per generation" |
  | API pricing page | $0.12/min, with "included generations" of 8 / 150 / 605 / 3,000 / 9,000 / 30,000 (Free → Business) |

  [verified: https://elevenlabs.io/docs/overview/capabilities/sound-effects] [verified: https://elevenlabs.io/pricing] [verified: https://elevenlabs.io/pricing/api]

  The included generations imply about **$0.033–0.036 per auto-length generation** on Creator/Pro ($22/605, $99/3,000) [derived]. Budget conservatively and confirm with `character-cost` / analytics.
- **License.** "Royalty-free sound effects from a text prompt" [verified: https://elevenlabs.io/pricing/api]. Commercial use needs a paid plan [verified: https://elevenlabs.io/pricing].
- **No retrieval.** SFX generations are **not** retrievable through the History API [verified: https://elevenlabs.io/docs/api-reference/history/list]. Store our own copy.

### 4.3 Fit for magic-worlds: **High (ambience) / Medium (per-turn SFX) / Low (UI sounds at runtime)**

**Integration ideas:**
1. **World / location ambience loops (recommended first).**
   - Add an "Ambience" generator next to the theme song in the card Media Studio (`/home/andres/WebstormProjects/magic-worlds/src/features/creation/common/components/MediaStudioSection.tsx:152`) for world and adventure-template cards. Possibly also location cards, which stories reference via `locationCardId`, `/home/andres/PycharmProjects/magic-worlds-api/src/routes/stories.py:149`.
   - An LLM writer turns card facts into a ≤450-character SFX prompt, much like the theme-song writer.
   - Generate one 20–30 s `loop=true` clip per card. Store it as an owned asset like theme songs, and clone it with shared cards.
   - In adventures, play it under narration through Web Audio with ducking.
   - **One-time cost per card**, not per turn.
   - Effort: **M**.
2. **Per-turn SFX cues.**
   - The adventure LLM emits optional sound cues (for example a `<sfx>` tag next to the existing `<narrator>/<say>/<think>` segment tags, `/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_segments.py:225,272`).
   - The backend normalizes each cue and caches it by prompt hash across users, so popular sounds ("door creaks", "sword clash") are paid for once [derived].
   - Effort: **M–L**. The main risk is cost and latency. It needs a per-plan quota (new `MEMBERSHIP_OPERATIONS` entry, `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:57-66`).
3. **UI sounds** (dice, page turn, notification).
   - Generate once at design time and ship them as static assets. Runtime generation is not needed.
   - Effort: **S**.

---

## 5. Eleven Music (theme-song replacement)

### 5.1 Models and status
- **Model IDs:**
  - `music_v1`: "Outclassed by `music_v2` and `music_v2_5`".
  - `music_v2`
  - `music_v2_5`: "Our most advanced music model".

  [verified: https://elevenlabs.io/docs/overview/models]
- **API default is still `music_v1`** during the transition. **Always pass `model_id` explicitly** [verified: https://elevenlabs.io/docs/api-reference/music/compose] [verified: https://elevenlabs.io/docs/overview/capabilities/music].
- **Release dates:**
  - Music v2 reached the API on 2026-06-15 [verified: https://elevenlabs.io/docs/changelog/2026/6/15].
  - Music v2.5 was announced 2026-09-11 and is "live in ElevenCreative and the ElevenLabs API" [verified: https://elevenlabs.io/blog/music-v2-5-model].
- **Features.** Vocals or instrumental, multilingual (en, es, de, ja…), section editing (inpainting), Audio Reference (≈30 s uploads, copyright-screened, Music v2/v2.5, paid plans), and Music Finetunes [verified: https://elevenlabs.io/docs/overview/capabilities/music].
- **The Music API is for paid users only** [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/music/streaming].

### 5.2 Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /v1/music` | Compose; returns the audio file. Body: `prompt` **or** `composition_plan`, `music_length_ms` (3,000–600,000, prompt only), `model_id`, `seed` (plan only), `force_instrumental` (prompt only), `finetune_id`, `respect_sections_durations` (v1 only), `store_for_inpainting`, `sign_with_c2pa` (MP3 only). Query `output_format`: `auto` (v1 → `mp3_44100_128`, v2 → `mp3_48000_192`), `mp3_48000_128/192/240/320`, `mp3_44100_*`, `pcm_*`, `opus_48000_*`… [verified: https://elevenlabs.io/docs/api-reference/music/compose] |
| `POST /v1/music/detailed` | Same body plus `with_timestamps` (word timestamps of the song) and `with_waveform_visual`. Returns `multipart/mixed`: JSON (`composition_plan`, `song_metadata` {title, description, genres, languages, `is_explicit`}) plus binary audio [verified: https://elevenlabs.io/docs/api-reference/music/compose-detailed] |
| `POST /v1/music/stream` | Streamed audio [verified: https://elevenlabs.io/docs/api-reference/music/stream] |
| `POST /v1/music/detailed/stream` | SSE: audio chunks (base64) plus plan, metadata and timestamps [verified: https://elevenlabs.io/docs/changelog/2026/7/6] |
| `POST /v1/music/plan` | Create a composition plan from a prompt; "does not cost any credits but is subject to rate limiting" [verified: https://elevenlabs.io/docs/api-reference/music/create-composition-plan] |
| `POST /v1/music/upload` | Upload a song for inpainting. "Price for uploading is the same as the one for song generation"; copyrighted uploads are still charged half; optional `extract_composition_plan` (now takes a model id, `music_v1`/`music_v2`/`music_v2_5`, to pick the plan format; passing `true`/`false` is deprecated), `with_timestamps`, `with_waveform_visual` [verified: https://elevenlabs.io/docs/api-reference/music/upload] |
| `POST /v1/music/stem-separation` | ZIP of stems; `stem_variation_id`, `sign_with_c2pa` [verified: https://elevenlabs.io/docs/api-reference/music/separate-stems] |
| `POST /v1/music/video-to-music` | Up to 10 videos, 200 MB, 600 s; `description` ≤4,100 chars, ≤10 `tags` [verified: https://elevenlabs.io/docs/api-reference/music/video-to-music] |
| `/v1/music/finetunes` (CRUD) | Train on owned, non-copyrighted audio; status `pending…completed/failed/blocked`; `failure_reason` includes `copyright_violation`; $1.50 per finetune [verified: https://elevenlabs.io/docs/api-reference/music/finetunes/create] [verified: https://elevenlabs.io/pricing/api] |

**Composition plans.**
- **v1 plans:** `positive_global_styles` / `negative_global_styles` plus `sections[]`. Each section has `section_name`, local styles, `duration_ms` 3,000–120,000 and `lines` (≤30 lines, ≤200 chars each).
- **v2 / v2.5 plans:** `chunks[]`. Each chunk has:
  - `text`: `[Section]` header plus lyric lines, with inline `{directions}`;
  - `duration_ms`: 3–120 s;
  - `positive_styles` (aim for "6–7 styles in early chunks") and `negative_styles`;
  - `context_adherence`: low/medium/high;
  - optional `conditioning_ref` {song_id, range} with `condition_strength`.

[verified: https://elevenlabs.io/docs/api-reference/music/compose] [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/music/composition-plans]

**Inpainting.** Store a song (`store_for_inpainting`), then reference its slices as *audio reference chunks* to keep them and regenerate other chunks [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/music/inpainting].
- *Added during verification:* the `song_id` that inpainting and `conditioning_ref` need is returned **in the response headers** of a generation ("You can find the song ID in the response headers when you generate a song"). The adapter must persist that header next to our asset, or later edits are impossible [verified: https://elevenlabs.io/docs/api-reference/music/compose].
- `respect_sections_durations` defaults to `true` and only affects `music_v1`. For `music_v2`/`music_v2_5`, chunk durations are always enforced [verified: https://elevenlabs.io/docs/api-reference/music/compose].

**Copyright guardrails (API).**
- Mentioning a band or musician by name, or using copyrighted lyrics, returns `bad_prompt` with `data.prompt_suggestion`.
- A plan with copyrighted styles returns `bad_composition_plan` with `composition_plan_suggestion`.
- For harmful material, "no suggested prompt will be returned".

[verified: https://elevenlabs.io/docs/eleven-api/guides/cookbooks/music]

**Changelog-only params.** These appeared in the changelog but are **absent from today's API reference**. Absence was re-checked against the compose reference on 2026-10-12 [verified: https://elevenlabs.io/docs/api-reference/music/compose]. Their current status is still [unverified]:
- `use_phonetic_names` [verified changelog: https://elevenlabs.io/docs/changelog/2026/3/2]
- `generation_mode` = `track|loop|ambience` [verified changelog: https://elevenlabs.io/docs/changelog/2026/5/25]

### 5.3 Current pipeline vs Eleven Music

| Aspect | Current (fal.ai) | Eleven Music v2.5 |
|---|---|---|
| Engines | `ace_step` → `fal-ai/ace-step`; `minimax_music_3` → `minimax/music-3` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/registry.py:29-36`) | `music_v2_5` (or `music_v2`) via `api.elevenlabs.io` |
| Text inputs | Writer LLM graph per model writes `tags` (ACE, ≤600 chars) or `prompt` (MiniMax, ≤1,500) plus `lyrics` (≤3,500 / ≤3,000) (`registry.py:58-96`, `prompt_agent.py:44-50`) | Either `prompt` (free text; lyrics embedded) **or** a v2 `composition_plan` with chunk-level lyrics (≤30 lines × 200 chars per chunk) and styles. The plan maps naturally onto our structured writer output [derived] |
| Instrumental | ACE: lyrics `"[inst]"` (`registry.py:31,195`); MiniMax: tag-only structure fallback (`prompt_agent.py:102`); request flag `instrumental` (`/home/andres/PycharmProjects/magic-worlds-api/src/models/theme_song.py:76`) | `force_instrumental: true` (prompt mode only; "guarantees" instrumental). With plans: section headers only plus `negative_styles: ["vocals"]` [verified: compose ref; derived] |
| User lyrics | `lyrics` verbatim (`theme_song.py:67-70`) | Put verbatim lines in chunk `text`. Lyrics must not reproduce existing songs (Music Terms §2.1g) |
| Duration | Default 60 s, range 10–240 s shared (`/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/config.py:25-29`); MiniMax cap 300 s (`registry.py:88`) | 3 s – 600 s on the API (`music_length_ms`); the capability page and pricing say **max 5 min** (§18). Keep ≤ 240 s |
| Transport | fal queue submit → poll every 3 s → fetch WAV URL (`fal_adapter.py:148-198`; `config.py:32-35`, provider timeout 1,200 s) | **Synchronous HTTP** returning the file (or a stream / SSE). No provider job ID. Keep our own job table; run the request in a background task with a generous read timeout. Generation time is not documented; a third-party reseller reports 30–90 s [secondary: https://docs.magnific.com/api-reference/music-generation/overview] |
| Output | WAV 44.1/48 kHz → in-process MP3 192 kbps via `lameenc` (`transcode.py:3-7,18,43`; `storage.py:108`) | MP3 directly (`mp3_48000_192` default for v2; up to 320 kbps). **The transcode step disappears for this engine**. 192 kbps music downloads are Pro+ under the Music Terms (§5.4) |
| Extras | Seed echoed; tags/lyrics dropped (`fal_adapter.py:221-226`) | `song_id` (for edits), `song_metadata` (`title`, `genres`, `is_explicit`, `languages`), **word timestamps** (lyric karaoke), **waveform** (4 values/s), C2PA signing, inpainting ("regenerate chorus"), stems |
| Cost / 60 s song | ACE-Step **$0.012** ($0.0002/s) [verified: https://fal.ai/models/fal-ai/ace-step]; MiniMax Music 3 on fal: **not published on the static page** [unverified] | **$0.15** ($0.15/min API) or 900 credits [verified: https://elevenlabs.io/pricing/api] [verified: https://elevenlabs.io/pricing] |
| Concurrency | `THEME_SONG_GLOBAL_CONCURRENCY` default 8 (`config.py:30`) | Music concurrency **2** (Starter–Pro) or **5** (Scale/Business) [verified: https://elevenlabs.io/docs/overview/models]. Lower our semaphore to ≤ the plan limit, shared across environments |
| Error mapping | fal statuses | `bad_prompt` (+suggestion), `bad_composition_plan` (+suggestion), 422 validation, 403 (subscription), 429 / concurrency |

### 5.4 Commercial terms that change the product decision (Music Terms, updated 2026-10-09)

[verified: https://elevenlabs.io/music-terms]

| Item (Exhibit A) | Free | Starter | Creator | Pro | Scale | Business | Ent. Music Lite | Ent. Music |
|---|---|---|---|---|---|---|---|---|
| Eligibility | Individual only | Individual only | Individual only | Individual only | <10 employees | <50 employees | none | none |
| Monthly **generation** limit | 11 min | 17 min | 62 min | 304 min | 1,100 min | 4,800 min | custom | custom |
| Monthly **download** limit | not permitted | 30 min | 250 min | 500 min | 1,500 min | 4,000 min | custom | custom |
| Streaming distribution | prohibited | prohibited | permitted | permitted | permitted | permitted | permitted | permitted |
| Media rights | all except film, TV, radio, **Studio Games** | ← same | ← same | ← same | ← same | ← same | ← same | all commercial use |
| Model Resale | prohibited | prohibited | prohibited | prohibited | prohibited | prohibited | custom | custom |
| Music Library creation | prohibited | prohibited | prohibited | prohibited | prohibited | prohibited | custom | custom |
| Attribution | required | not required | not required | not required | not required | not required | not required | not required |
| Concurrency | 0 | 2 | 2 | 2 | 5 | 5 | 5 | 10+ |
| HQ downloads (lossless WAV / 192 kbps) | No | No | No | Yes | Yes | Yes | Yes | Yes |
| API access | No | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

**Implications for magic-worlds** [derived unless stated]:

1. **Capacity ceiling.**
   - Theme songs are seeded at 5/day (free), 25/day (plus) and 100/day (pro) per user (`/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py:30,38,46`).
   - At 60 s per song, a Pro workspace (304 min/month) supports about **300 songs per month for the whole app**. Pro is "For Individual Use Only", though, so a company is limited to Scale (about **1,100 songs**/month, fewer than 10 employees) or Business (about **4,800**, fewer than 50 employees) [verified: https://elevenlabs.io/music-terms] [derived].
   - A per-user daily quota alone cannot protect the provider cap. A **global monthly music budget** is required in our membership layer.
2. **Model Resale.** The definition includes "offering any Music Model alongside third-party models".
   - The reseller carve-out reads: "an entity does not become a Reseller solely by generating and distributing Output through its own product, provided it does not make the Music Models or API access to them available to any third party".
   - The Model Resale definition is "any resale, repackaging, redistribution, aggregation, or other making available of Music Models through your or any third-party platform or application". That wording is broad enough to catch an end-user model picker [verified: https://elevenlabs.io/music-terms].
   - **Do not show Eleven Music as a selectable model next to ACE-Step** (current picker: `MediaStudioSection.tsx:449-450`).
   - Prefer **one engine per tier** behind our own product name, or drop ACE-Step entirely. **Legal review required.**
3. **Studio Games.** "Studio Game" means "a video game or other interactive or playable experience made available to the public… commercialized". It excludes Indie Games: less than $500k game revenue and less than $1M entity game revenue.
   - An AI roleplay app with paid plans may qualify as an "interactive or playable experience".
   - Above the indie thresholds, only **Enterprise Music** grants that media right. **Legal review required.**
4. **Music Library.** This means a collection of Output "made available to third parties for those third parties to use, license, download, or incorporate into their content".
   - Card sharing clones theme-song assets (`/home/andres/PycharmProjects/magic-worlds-api/src/services/card_resource_clone.py:51,98-103`).
   - Card export does **not** include audio today: it renders a PNG card (`/home/andres/PycharmProjects/magic-worlds-api/src/services/card_export/content.py:48-53`). Keep it that way unless legal approves.
   - These are probably "distribution through our own product", but a **public gallery of downloadable songs** edges toward a library. Legal should rule on this.
5. **Pass-through terms.** Our user terms must not be more permissive than ElevenLabs' terms. The Prohibited Use Policy forbids "Making our Services or Output available to your own end users… on terms more permissive than those that apply to you" [verified: https://elevenlabs.io/use-policy]. Concretely, users may not put theme songs on streaming services on Free/Starter-equivalent tiers, and may not use them in film/TV/radio.
6. **Prohibited prompts.** The input must not contain any of the following (Music Terms §2.1):
   - a real artist or songwriter name;
   - a song or album title;
   - a publisher or label;
   - distinctive lyrics.

   Card names can collide with real artists. Two guards are needed:
   - The writer graph must strip or forbid them.
   - The adapter must handle `bad_prompt` by retrying **once** with `prompt_suggestion`, and never loop.

### 5.5 Fit: **High (capability) / gated by legal + cost**

**Recommended migration design (summary):**
- **Registry.** Add `eleven_music_v2_5` to the registry (`registry.py:58-96`).
  - Provider: `elevenlabs`.
  - `style_field`: a v2 composition plan.
  - Duration cap: 240 s.
  - Locked arguments: `model_id`, `output_format=mp3_48000_192` (or 128 on Starter/Creator), `sign_with_c2pa=true`, `store_for_inpainting=false` initially.
- **Writer graph.** New graph `theme_song_prompt_eleven_music.v1.json`. It outputs `chunks[]` directly, with English styles ("Use English language for best results"), lyric lines ≤200 chars and ≤30 per chunk. Alternatively, call `POST /v1/music/plan` (free) and patch in lyrics.
- **Adapter.** Synchronous `POST /v1/music/detailed` (to get `song_metadata.is_explicit` and word timestamps) inside the existing job runner.
  - Map `bad_prompt` / `bad_composition_plan` to a new `ThemeSongErrorCategory`.
  - Drop the WAV transcode for this provider.
- **Billing and quotas.**
  - Add a **global monthly minutes budget** check before `reserve_media_operation` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/engine.py:797-800`).
  - Refund on provider failure. This also fixes baseline issue #7 for media.
- **Frontend.**
  - Remove the MiniMax option from the `ThemeSongModelAlias` union (`/home/andres/WebstormProjects/magic-worlds/src/shared/types/media.types.ts:80`) and the picker.
  - Optional lyric karaoke from `with_timestamps`.
- **Effort: M** for the engine swap; **+S** for karaoke / waveform; **+M** for "edit a section" via inpainting.

### 5.6 Further music opportunities
- **Instrumental "bed" of a character's theme for adventures.** Two options:
  - generate an instrumental variant conditioned on the original (`conditioning_ref` with the stored `song_id`);
  - use stem separation (ZIP of stems).

  Price of stem separation: **not listed** [unverified]. Effort **M**. Fit **Medium**.
- **Adventure background music** per world: an instrumental loop of 60–120 s. This overlaps with SFX ambience (§4). Prefer SFX loops for ambience (cheaper) and Music for themes. Fit **Medium**.
- **A "house sound" Finetune** for the app ($1.50 per finetune; only owned, non-copyrighted training audio). Fit **Low** until a brand need exists.

---

## 6. Speech-to-Text batch (Scribe v2)

### 6.1 Models and status
- **Models.**
  - `scribe_v2`: 90+ languages, keyterms, entity detection, transcript editing, word timestamps, diarization up to 32 speakers, dynamic audio tagging.
  - `scribe_v2_medical`
  - `scribe_v2_realtime`: about 150 ms; covered in the realtime note.

  [verified: https://elevenlabs.io/docs/overview/capabilities/speech-to-text]
- **`scribe_v1` is deprecated.** Removal was announced for **2026-07-09**, which is before the research date, so do not plan on it. The models page still lists it under "Deprecated models" with `scribe_v2` as the replacement [verified: https://elevenlabs.io/docs/changelog/2026/6/8] [verified: https://elevenlabs.io/docs/overview/models].
- *Added during verification:* `scribe_v2_medical` went GA on 2026-09-11 (same API and price as Scribe v2). It is not relevant to roleplay, so ignore it [verified: https://elevenlabs.io/docs/changelog/2026/9/11].
- **Launch.** Scribe v2 launched 2026-01-12 [verified: https://elevenlabs.io/docs/changelog/2026/1/12].

### 6.2 `POST /v1/speech-to-text` (multipart)

[verified: https://elevenlabs.io/docs/api-reference/speech-to-text/convert]

| Param | Notes |
|---|---|
| `model_id` | `scribe_v2` |
| `file` **or** `source_url` | File < 5.0 GB (raised from 3 GB on 2026-06-01, [verified: https://elevenlabs.io/docs/changelog/2026/6/1]). `cloud_storage_url` is **deprecated** in favour of `source_url` (also YouTube/TikTok URLs) |
| `file_format` | `pcm_s16le_16` (raw 16-bit, 16 kHz, mono, little-endian; "Latency will be lower") or `other` |
| `language_code` | ISO-639-1/3, else auto-detect |
| `diarize`, `num_speakers` (≤32), `diarization_threshold` | Speaker labels |
| `timestamps_granularity` | `word` or `character` |
| `tag_audio_events` | (laughter), (footsteps)… |
| `keyterms` | ≤1,000 terms, <50 chars, ≤5 words each; **+20% cost**; 20 s minimum billable if >100 terms |
| `no_verbatim` | Removes fillers and false starts (scribe_v2) |
| `entity_detection` / `entity_redaction` (+ `entity_redaction_mode`) | Categories `pii`, `phi`, `pci`, `other`, **`offensive_language`** |
| `transcript_edit` | Natural-language post-edit (≤2,000 chars); **+30%**; not combinable with entities or multichannel |
| `detect_speaker_roles` | agent / customer; +10% |
| `use_multi_channel` (+ `multichannel_output_style`) | ≤5 channels, each billed at full duration |
| `webhook`, `webhook_id`, `webhook_metadata` (≤16 KB JSON) | Async: returns 202, result is delivered to a workspace webhook (`speech_to_text_transcription`) [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/batch/webhooks] |
| `temperature`, `seed` | Determinism controls (`temperature` 0.0–2.0, default is model-based and usually 0) |
| `additional_formats` | Extra transcript exports returned inline (for example subtitle formats). Useful for call-transcript downloads (*added during verification*) |
| `use_speaker_library` | Matches diarized speakers against the workspace's registered speaker library. Not needed by us (*added during verification*) |
| `enable_logging=false` (query) | ZRM, **Enterprise only** |
| `token` (query) | **Single-use token** from `POST /v1/single-use-token/batch_scribe`; expires in 15 min; lets a browser call STT without our key [verified: https://elevenlabs.io/docs/api-reference/tokens/create] [verified: https://elevenlabs.io/docs/changelog/2026/7/20] |

**Other endpoints and limits.**
- `GET` / `DELETE /v1/speech-to-text/transcripts/{transcription_id}` [verified: https://elevenlabs.io/docs/api-reference/speech-to-text/get] [verified: https://elevenlabs.io/docs/api-reference/speech-to-text/delete].
- Limits: **10 h** (standard) or **1 h** (multichannel, per the page's "Key facts"). The same page's FAQ says instead that multichannel audio must total less than 10 h across all channels; see §18 [verified: https://elevenlabs.io/docs/overview/capabilities/speech-to-text].
- Files over 8 min are processed with up to 4-way internal parallelism [verified: same].

**Accuracy.**
- Language tiers: **≤5% WER** for English, Spanish, French, German, Italian, Portuguese, Japanese and others [verified: https://elevenlabs.io/docs/overview/capabilities/speech-to-text].
- Third-party benchmark AA-WER [secondary: https://artificialanalysis.ai/speech-to-text/models/elevenlabs-scribe-v2]:

  | Model | AA-WER |
  |---|---|
  | Scribe v2 | **2.2%** |
  | Whisper Large v3 on fal | 4.1% |
  | Whisper Large v3 Turbo on Groq | 4.6% |

**Price.**
- $0.22/h, which is about $0.0037/min [verified: https://elevenlabs.io/pricing/api] [derived].
- Groq `whisper-large-v3` is roughly $0.111/h [unverified]. groq.com/pricing did not show STT rates when fetched on 2026-10-12; check the Groq console.

### 6.3 Fit for magic-worlds: **High**

1. **Push-to-talk dictation in the text chat composer** (`/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/ChatComposer.tsx:52`). Flow:
   1. The browser records via `MediaRecorder`.
   2. It posts to the BFF.
   3. The BFF calls Scribe v2 with `keyterms` built from the session's character names, persona name and world terms (lorebook keys).
   4. The transcript goes into the composer for editing.
   - A 10 s clip costs about $0.0006 [derived].
   - Proxy through the BFF so membership metering applies. The browser single-use token is possible but bypasses our quota.
   - Alternative: realtime streaming dictation via `@elevenlabs/react` `useScribe` with a `realtime_scribe` token [verified: https://elevenlabs.io/docs/eleven-api/resources/libraries/scribe-stt/react-scribe]. Covered in the realtime note.
   - Effort **S–M**.
2. **Call STT consolidation (optional).** Uplink segments are already 16 kHz PCM16 mono WAV (baseline §2 path B).
   - Strip the 44-byte RIFF header and send `file_format=pcm_s16le_16` to Scribe v2 for lower latency [derived].
   - Add `keyterms` for character names.
   - The provider gate today is `stt_provider == "groq"` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:123`) and the Groq client is at `stt_groq_client.py:53-59`.
   - Effort **S–M**. This removes one provider key if Groq is retired. The realtime note decides between batch and streaming.
3. **Audio/video lorebook import.**
   - Users upload a session recording, podcast or lore video.
   - Scribe v2 runs with `diarize=true`.
   - The diarized transcript feeds the existing extraction pipeline.
   - This mirrors the PDF import (PDF-only gate at `/home/andres/PycharmProjects/magic-worlds-api/src/services/lorebook_pdf.py:79`).
   - Use the async `webhook=true` mode for long files.
   - Effort **M**.
4. **Call transcripts / moderation.** Use `tag_audio_events` and `entity_detection: offensive_language` on stored call audio to enrich `CallTranscriptView` (`/home/andres/WebstormProjects/magic-worlds/src/features/call/components/CallTranscriptView.tsx:93`). Fit **Low–Medium**.

---

## 7. Voice Changer (speech-to-speech)

- **API.** `POST /v1/speech-to-speech/{voice_id}` (multipart) and `/stream`. Params:
  - `audio`
  - `model_id`: `eleven_multilingual_sts_v2` (29 languages) or `eleven_english_sts_v2`
  - `voice_settings` (JSON)
  - `seed`
  - `remove_background_noise`
  - `file_format=pcm_s16le_16|other`
  - `output_format`: MP3/PCM/WAV/Opus/μ-law; 192 kbps needs Creator+, 44.1 kHz PCM/WAV needs Pro+
  - `enable_logging`

  [verified: https://elevenlabs.io/docs/api-reference/speech-to-speech/convert]
- **Limits and pricing.**
  - Max segment is **5 minutes**.
  - Billed as "1,000 characters per minute of processed audio".
  - "`eleven_multilingual_sts_v2` often outperforms `eleven_english_sts_v2` even for English".
  - API price $0.12/min.

  [verified: https://elevenlabs.io/docs/overview/capabilities/voice-changer] [verified: https://elevenlabs.io/pricing/api]
- **Fit: Low–Medium.**
  - **Admin "performance capture".** A root admin records the delivery of a signature line (a greeting or catchphrase) and converts it into a character's voice to make a hand-directed preview or greeting clip. It is Actor Mode in spirit. Effort **S** in the admin console.
  - **User-facing persona voice** (the user speaks in their persona's voice in calls): adds latency and cost, and is a policy-sensitive impersonation surface. **Not recommended**.

---

## 8. Voice Isolator (audio isolation)

- **API.** `POST /v1/audio-isolation` (+ `/stream`) with `audio` and `file_format`. History is at `GET /v1/audio-isolation/history`, and items can be deleted (added 2026-04-27) [verified: https://elevenlabs.io/docs/api-reference/audio-isolation/convert] [verified: https://elevenlabs.io/docs/api-reference/audio-isolation/list].
- **Limits and pricing.** Up to **500 MB / 1 h**. Billed at 1,000 characters per minute ($0.12/min API). "Not specifically optimized for isolating vocals from music" [verified: https://elevenlabs.io/docs/overview/capabilities/voice-isolator] [verified: https://elevenlabs.io/pricing/api].
- **Clone-sample cleaning is already built in.** The Instant Voice Clone endpoint `POST /v1/voices/add` has `remove_background_noise`, which uses "our audio isolation model". Its caveat: "If the samples do not include background noise, it can make the quality worse." [verified: https://elevenlabs.io/docs/api-reference/voices/ivc/create]
- **Fit: Low (standalone).**
  - Map the admin form's existing `need_noise_reduction` toggle (`/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/VoiceCloneForm.tsx:60,166`) to IVC `remove_background_noise`.
  - Optional nicety: a "Preview cleaned sample" button that calls `/v1/audio-isolation` before cloning, so the admin hears the result. Effort **S**.
  - Do not run the isolator on call uplink audio: it costs too much per minute and adds latency.

---

## 9. Dubbing

- **API (new project model).** `POST /v1/dubbing/project` with:
  - `file` (≤3 GiB) or `source_url`
  - `source_language` (BCP-47) and `target_language`
  - `model_id`: `dubbing_v1` or `dubbing_v2` (**default v2**, fixed at create)
  - `keyterms` (≤1,000)
  - `webhook_ids` (≤3)
  - `transcript` (Enterprise only)

  Status runs `queued → preparing → ready/failed`, with a **minimum charge of one language at creation** [verified: https://elevenlabs.io/docs/api-reference/dubbing/create-project].
- **Status and features.**
  - Dubbing v2 is **alpha**.
  - 90+ languages; up to 32 speakers; 3 concurrent jobs on self-serve.
  - Dubbing Studio (v1) is "in maintenance mode".
  - For v2, transcript editing and regeneration via the API are Enterprise-only.

  [verified: https://elevenlabs.io/docs/overview/capabilities/dubbing]
- **Deprecations.** The legacy dubbing resource-editing endpoints were deprecated 2026-04-20 [verified: https://elevenlabs.io/docs/changelog/2026/4/20].
- **Pricing.** v1 $0.33/min (watermarked) or $0.50/min; v2 $2.20/min [verified: https://elevenlabs.io/pricing/api].
- **Fit: Low.**
  - Our narration is generated text-first, so a translated version is cheaper to produce by re-running TTS in the target language. Character chats already run in the user's language.
  - Dubbing would only make sense for user-uploaded media, which the app does not have.
  - **Skip.**

---

## 10. Forced Alignment

- **API.** `POST /v1/forced-alignment` (multipart: `file` < 1 GB, `text`). Returns `characters[]` and `words[]` {text, start, end} plus `loss` (confidence) [verified: https://elevenlabs.io/docs/api-reference/forced-alignment/create].
- **Capability page.**
  - Max 3 GB and 10 h; max text **675,000 characters**.
  - "Diarization: Not supported".
  - "Pricing: Same rate as the Speech to Text API".
  - 29 languages.

  [verified: https://elevenlabs.io/docs/overview/capabilities/forced-alignment] (The file-size limit conflicts with the API reference; see §18.)
- **When it is needed.** New ElevenLabs TTS already returns character alignment via `/with-timestamps` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps]. Generated music returns word timestamps via `with_timestamps` [verified: https://elevenlabs.io/docs/api-reference/music/compose-detailed]. Forced alignment is therefore only needed for **audio we did not synthesize with timestamps**.
- **Fit: Low–Medium.**
  1. **Backfill read-along** for legacy MiniMax narration MP3s (`tts_asset`, baseline §2 path A) if we add word highlighting to `TurnNarration` (`/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/TurnNarration.tsx:45`). Since narration is tied to chat turns, it is cheaper to **re-generate on demand** [derived].
  2. **Synced call-history replay**: align stored assistant call audio with the persisted assistant text for highlighted playback in `CallTranscriptView`. Effort **S**; cost negligible ($0.22/h).
  3. **Lyrics for legacy fal theme songs.** Forced alignment is not designed for sung vocals [unverified quality]. `POST /v1/music/upload` with `with_timestamps` works, but costs a generation.

---

## 11. Audio Native

- **What it is.** An embeddable ElevenLabs-hosted player that narrates a web page or embeds pre-generated project audio. It has an **allowlist** of domains or pages and built-in metrics [verified: https://elevenlabs.io/docs/eleven-creative/audio-tools/audio-native].
- **API.** `POST /v1/audio-native` with `name`, `voice_id`, `model_id`, `file` (txt/HTML), `auto_convert`, colours, `apply_text_normalization` and `pronunciation_dictionary_locators`. Returns `project_id` and `html_snippet` [verified: https://elevenlabs.io/docs/api-reference/audio-native/create]. Content can be updated from a URL (`POST /v1/audio-native/content`) [verified: https://elevenlabs.io/docs/changelog/2026/3/2].
- **Fit: Low.**
  - Our content lives behind authentication and is per-user.
  - The player is third-party UI, which conflicts with the Reverie design system.
  - The only candidates are public static pages (landing/docs/legal), where the value is marginal.
  - **Skip.**

---

## 12. History API and provider-side data retention

### 12.1 What ElevenLabs keeps

- **Default retention.** "By default, ElevenLabs retains data, in accordance with the Privacy Policy". "Customers by default have history preservation enabled." [verified: https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode]
- **Zero Retention Mode** (`enable_logging=false`) is **Enterprise only**. It covers TTS, Text-to-Dialogue, Voice Changer and STT. **Not eligible:**
  - Music
  - Image & Video
  - IVC/PVC samples
  - Dubbing
  - Studio

  [verified: same page]
- **Deletion.** "All customers can use the API to delete generations at any time. This action will immediately remove the corresponding audio and text from our database; however, debugging and moderation logs may still retain data". Backups keep deleted items for up to **30 days** [verified: same page].

### 12.2 History endpoints

[verified: https://elevenlabs.io/docs/api-reference/history/list] [verified: https://elevenlabs.io/docs/api-reference/history/delete] [verified: https://elevenlabs.io/docs/api-reference/history/download]

| Endpoint | Notes |
|---|---|
| `GET /v1/history` | `page_size` ≤1,000 (default 100), `start_after_history_item_id`, `voice_id`, `model_id` (if set, `source` becomes required), `date_before_unix`, `date_after_unix`, `sort_direction`, `search`, `source` (`TTS`, `STS`, `Flows`). Items include **`text`**, `voice_id`, `model_id`, `settings`, `request_id`, `alignments`, `dialogue`, `source` (TTS/STS/Projects/AN/Dubbing/ConvAI/…). "Music and SFX generations are not included and cannot currently be retrieved via the API." |
| `GET /v1/history/{id}`, `GET /v1/history/{id}/audio` | Item and audio |
| `DELETE /v1/history/{id}` | Delete one item |
| `POST /v1/history/download` | One file or ZIP; `output_format` wav/default |

Related deletes:
- `DELETE /v1/speech-to-text/transcripts/{id}` [verified: https://elevenlabs.io/docs/api-reference/speech-to-text/delete]
- `DELETE /v1/audio-isolation/history/{id}` [verified: https://elevenlabs.io/docs/changelog/2026/4/27]

### 12.3 Fit: **High (ops/privacy), not user-facing**

**Problem.** Roleplay narration text (possibly mature or personal) and call audio would accumulate in the shared ElevenLabs workspace history, readable by anyone with dashboard access [derived].

**Recommendation:**
1. **Correlate.** Persist the `request-id` response header on each `tts_job` / call turn. It matches history `request_id`.
2. **Sweep.** After our own asset is durably stored, delete the provider history item, either inline (best-effort) or with a periodic job that pages `GET /v1/history?date_before_unix=now-1h` and deletes. For STT, delete transcripts by ID after use.
3. **Respect user deletion.** Our own deletion of a chat, message or user (baseline issue #9) should also delete provider items that are still stored.
4. **Effort S–M.** Cross-check the history rate limits [unverified].
5. **Enterprise later.** If the business moves to Enterprise, switch to `enable_logging=false`, which removes the need for the sweep for TTS, STT and STS. The tradeoff is limited support ("we will not be able to diagnose issues").

---

## 13. Usage, analytics and subscription endpoints

| Endpoint | Use | Status |
|---|---|---|
| `POST /v1/workspace/analytics/query/usage-by-product-over-time` | Credit usage over time. `group_by` ∈ `product_type`, `model`, `voice_id`, `user_id`, **`hashed_xi_api_key`**, `request_source`, `surface`, `actor`, `fiat_currency`, `region`…; `interval_seconds`, `time_zone`, `filters`; tabular response with `column_units` (credits/usd/…) | Current. Added 2026-04-20 [verified: https://elevenlabs.io/docs/api-reference/analytics/workspace/usage] [verified: https://elevenlabs.io/docs/changelog/2026/4/20] |
| `POST /v1/workspace/analytics/requests` | Request log (filters, search, sort) | Current [verified: https://elevenlabs.io/docs/api-reference/analytics/workspace/requests] |
| `GET /v1/usage/character-stats` | Legacy usage metrics | **Deprecated**; do not build on it [verified: https://elevenlabs.io/docs/api-reference/legacy/usage/get] |
| `GET /v1/user/subscription` | `tier`, `character_count`, `character_limit`, `next_character_count_reset_unix`, `max_credit_limit_extension`, `can_extend_character_limit`, `current_overage`, `status` (`active`, `past_due`, `free_disabled`…), voice slot counts, `open_invoices` | Current [verified: https://elevenlabs.io/docs/api-reference/user/subscription/get] |
| Response headers `character-cost`, `request-id` | Per-request cost and correlation | [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/request-stitching] |

**Fit: High (ops).**
- **Readiness.** Feed `GET /v1/user/subscription` into the API readiness/health check. Warn when remaining credits fall below N days of burn, or when `status != active`.
- **Admin cost view.** Feed hourly `usage-by-product-over-time` (grouped by `product_type` and `hashed_xi_api_key`) into the admin provider-cost view (`/home/andres/WebstormProjects/magic-worlds/src/features/admin/membership/components/ProviderCostByPayer.tsx:2-4,90`). Reconcile it against our membership ledger.
- **Per-job cost.** Record `character-cost` per job row.
- **Voice Library credit multipliers (added during verification).** Some shared Voice Library voices carry a legacy "custom rate", which works as a **credit multiplier**. Generating with them costs more credits, and the multiplier depends on both the owner's rate and our plan. The analytics `group_by` includes `voice_multiplier`, so the admin cost view can flag characters bound to expensive voices. The catalog note should filter or label such voices [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-are-custom-rates-and-credit-multipliers] [verified: https://elevenlabs.io/docs/api-reference/analytics/workspace/usage].
- Effort **S–M**.

---

## 14. Workspaces, service accounts, API keys, single-use tokens, webhooks

- **Service accounts.** "Currently only available for multi-seat customers" (Scale+ has seats), and workspace-admin managed. Their keys **do not expire**.
  - The API supports creating service accounts (`POST /v1/service-accounts`, added 2026-07-13) and CRUD on their keys.
  - Recommended practice: **one service account per environment** (production / testing / UAT).

  [verified: https://elevenlabs.io/docs/overview/administration/workspaces/service-accounts] [verified: https://elevenlabs.io/docs/changelog/2026/7/13] [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/security]
- **API key controls** (user and service keys) [verified: https://elevenlabs.io/docs/overview/administration/workspaces/api-keys]:
  - **endpoint scope restriction**;
  - **credit quota per key**;
  - **IP allowlisting**: 1–100 public IPs/CIDRs; private ranges are rejected;
  - user-key expiry (15 min – 30 days);
  - rotation (create new, switch, delete old);
  - GitHub secret scanning auto-disables leaked keys (`disable_reason = exposed_publicly`);
  - self-disable endpoint.
- **Resource-level permissions.** ElevenLabs recommends that apps enforce their own `user_id | voice_id | permission_level` checks so users only use voices they own [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/security]. This matters directly to baseline issue #1 (preview accepts any `voice_id`).
- **Single-use tokens.** `POST /v1/single-use-token/{realtime_scribe|batch_scribe|tts_websocket}`. 15-minute expiry, consumed on use [verified: https://elevenlabs.io/docs/api-reference/tokens/create].
- **Workspace webhooks.** HMAC auth, HTTPS URL, optional custom headers (`POST /v1/workspace/webhooks`) [verified: https://elevenlabs.io/docs/api-reference/webhooks/create].
  - Retries are opt-in (disabled by default): up to 5 attempts at 0 s / 30 s / 2 m / 8 m / 30 m with up to 10% jitter. They fire on 5xx, 429, 408, **and on connection errors or request timeouts**. Other 4xx responses are not retried. Each webhook holds at most 100 pending retries (*corrected during verification*).
  - The webhook auto-disables after 10 consecutive failures with no success in 7 days.
  - Handlers must be idempotent.

  [verified: https://elevenlabs.io/docs/eleven-api/resources/webhooks]
- **Webhook events relevant to us:**
  - `speech_to_text_transcription` (async STT; the STT webhook is selected in settings as "Transcription completed") [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/batch/webhooks]
  - dubbing events (`dubbing_project_ready` / `_failed`, `dubbing_language_completed` / `_failed`) [verified: https://elevenlabs.io/docs/api-reference/dubbing/create-project]
  - Studio `callback_url` (a per-project URL, not a workspace webhook)
  - **`voice_removal_notice` / `voice_removal_notice_withdrawn` / `voice_removed`**: "A shared voice is scheduled to be removed"

  [verified: https://elevenlabs.io/docs/eleven-api/resources/webhooks]

**Fit: High (ops).** Recommended setup:
- Separate keys per path (narration, calls, music/SFX, admin console). This gives:
  - per-path **credit quotas**, a hard blast-radius limit that complements our membership quotas;
  - attribution via `hashed_xi_api_key` in analytics;
  - minimal endpoint scopes (for example, the admin key alone may call voice design and clone).
- Add an `/webhooks/elevenlabs` route modelled on the verified fal webhook (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/webhooks/fal.py:17-28`).
  - `voice_removal_notice` lets the voice catalog warn owners and pick fallbacks **before** a Voice-Library voice used by characters disappears. Cross-reference the catalog notes.
  - **Caveat (added during verification).** Voice owners may set a notice period of 30 days to 2 years. If they set **none**, the voice is removed immediately when sharing stops, so we may only ever receive `voice_removed`. While a notice period is active, `GET /v1/voices/{voice_id}` exposes `disable_at_unix`. Poll it in a periodic catalog health check as a backstop to the webhook [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-a-notice-period].
- Effort **S** (keys) + **S–M** (webhook route).

---

## 15. Safety: detector/classifier, watermarking, C2PA, moderation, policy

| Tool | What | API? | Fit |
|---|---|---|---|
| **Audio Detector** | Checks for an "imperceptible watermark embedded in ElevenLabs-generated audio", then falls back to the classifier. Free for signed-in users. Cannot detect other platforms' watermarks. "content generated by third-party models available through ElevenLabs is generally not watermarked" [verified: https://elevenlabs.io/docs/eleven-creative/audio-tools/audio-detector] | **UI only.** No API reference is listed in the docs index [verified: https://elevenlabs.io/docs/llms.txt] | Low (support/abuse investigations only) |
| **AI Speech Classifier** | Legacy statistical detector, no sign-in. "may produce false positives" [verified: same page] | UI only | Low |
| **C2PA signing** | `sign_with_c2pa` on music compose (MP3 only, default `false`), stem separation and video-to-music. Added 2025-12-08 [verified: https://elevenlabs.io/docs/api-reference/music/compose] [verified: https://elevenlabs.io/docs/changelog/2025/12/8]. Music Terms §3.4: ElevenLabs "does not warrant that any Output carries a watermark or provenance signal", and marking does not satisfy our own disclosure duties [verified: https://elevenlabs.io/music-terms] | Yes (music family) | **Medium**: enable for theme songs, but keep our own AI-disclosure label. No extra price is documented. Size/latency impact [unverified] |
| **Provider moderation** | ElevenLabs monitors with "AI classifiers, human reviewers, and internal investigations" [verified: https://elevenlabs.io/safety]. No public text-moderation API for our inputs [unverified: none found in the docs index]. STT `entity_detection` supports `offensive_language` [verified: https://elevenlabs.io/docs/api-reference/speech-to-text/convert] | Partial | Medium (calls/dictation) |
| **Live Moderation** (shared PVC voices) | Voice owners can enable it; requests are checked against prohibited categories; "may result in extra latency" [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-live-moderation] | Implicit | Catalog note: characters using such library voices may see extra latency or blocked lines |
| **`safety-identifier` header** | End-user identifier "Used for moderation. Your workspace must be allowlisted". Seen only on the podcast endpoint [verified: https://elevenlabs.io/docs/api-reference/studio/create-podcast] | Allowlist | Ask the account manager whether it exists for TTS/Music (open question) |

**Prohibited Use Policy (last updated 2026-10-09), the clauses that matter for an AI roleplay app** [verified: https://elevenlabs.io/use-policy]:
- **Minors.**
  - No sexualization of minors.
  - "You must be at least 18 to have an ElevenLabs account."
  - "Apps, products, or experiences directed at individuals under 18 are prohibited unless we have assessed and approved them in writing."
  - **Our age gate and content rules must align.**
- **Sexual and graphic content.** Prohibited:
  - "Visual depictions of explicit sexual acts";
  - "Erotic material involving incest, bestiality, or necrophilia";
  - non-consensual intimate content;
  - gratuitous gore.

  Audio erotica is not blanket-banned by this list, but the policy says categories are "not exhaustive". **Narration of mature content needs a legal/policy check** [derived].
- **Manipulation.** "creating harmful emotional dependency or undue influence" is prohibited. This is relevant to companion-style character chats and calls.
- **AI transparency.**
  - Disclose AI where required.
  - "must not remove, alter, or conceal ElevenLabs watermarks, metadata or other provenance signals". The full clause continues "for the purpose of disguising AI-generated content or evading detection", so it targets intent, not transcoding as such (*clarified during verification*).
  - **Best practice:** store provider bytes as-is, and avoid unnecessary re-encoding of ElevenLabs audio (the theme-song WAV→MP3 transcode is not needed with direct MP3 output) [derived].
- **Commercial restrictions.**
  - No commercial use on a free plan.
  - No "operating a client, wrapper, or proxy that gives anyone else access to our Services outside the terms that apply".
  - No making Output available to end users "on terms more permissive than those that apply to you".
  - No using Output to train models.

**Fit.** Adopt C2PA for music. Write a policy-alignment checklist (age gate, mature narration rules, AI disclosure in calls, pass-through terms). Add `offensive_language` entity detection where we transcribe user speech.

---

## 16. Briefly noted (low fit or covered elsewhere)

- **Text to Dialogue** (`/v1/text-to-dialogue/*`, incl. `with-timestamps` and WebSockets) [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert]. This is core to multi-voice narration and to the self-assembled audiobook (Path B, §3.5). It is covered in the TTS notes.
- **Pronunciation dictionaries** (`/v1/pronunciation-dictionaries/*`) [verified: https://elevenlabs.io/docs/api-reference/pronunciation-dictionaries/create-from-rules]. Studio and Audio Native accept locators. They are the replacement for MiniMax inline IPA and are covered in the TTS / Studio-console notes.
- **Image & Video / Avatars.**
  - Talking-head avatars pair any voice with a visual identity.
  - Restrictions (*corrected during verification*):
    - Image & Video generation through the API requires **Pro or above**, and ByteDance models are disabled by default for API requests until approved.
    - **Avatars have no API yet** ("Not available at launch; planned for future release").
    - Some Avatar models and reference-image uploads are restricted in the US.

  [verified: https://elevenlabs.io/docs/overview/capabilities/image-video] [verified: https://elevenlabs.io/docs/overview/capabilities/image-video/avatars]

  Out of scope (we have our own image pipeline). Possible future "animated character portrait" idea.
- **Flows async generation APIs** (image, video, speech) with webhook targets, added 2026-08-17 [verified: https://elevenlabs.io/docs/changelog/2026/8/17]. Not needed.
- **ElevenReader Publishing / Music Marketplace.** These are creator-monetization programmes run from the creator's own ElevenLabs account [verified: https://elevenlabs.io/docs/llms.txt index entries]. Not applicable to a multi-tenant app.
- **ElevenAgents / Speech Engine.** Covered by the realtime note.

---

## 17. Opportunity backlog (ranked)

**Ranking.** Order is by (user value × feasibility) ÷ (cost risk + dependency risk).

**Column legend:**
- **Cost risk:** the chance that provider spend outgrows our membership pricing if misused.
- **Phase:**
  - P0 = must ship with the MiniMax removal.
  - P1 = first follow-up.
  - P2 = later.
  - P3 = backlog.

| # | Feature | User value | Effort | Cost risk | Dependencies | Phase |
|---|---|---|---|---|---|---|
| 1 | **Theme songs on Eleven Music v2.5** (replace `minimax/music-3`; single engine behind our alias; composition-plan writer; direct MP3; C2PA; `bad_prompt` handling; global monthly minutes budget; lower concurrency to plan limit) | High: removes the last MiniMax-family model; better quality and multilingual vocals | M | **High**: $0.15 per 60 s song vs $0.012 ACE-Step; hard plan caps (Scale 1,100 / Business 4,800 min/mo for a company; Free–Pro are individual-only) | **Legal sign-off on Music Terms** (Model Resale, Studio Games, Music Library, eligibility); Scale (fewer than 10 employees) or Business (fewer than 50) for company use | P0 (or P1 if legal is pending: keep ACE-Step only, drop MiniMax) |
| 2 | **History / transcript deletion sweep + `request-id`/`character-cost` capture** | Indirect (privacy, trust, compliance) | S–M | None (saves risk) | TTS/STT adapters in place | P0 |
| 3 | **Per-path API keys with credit quotas, scopes, IP allowlist; webhook route (`voice_removal_notice`, STT async)** | Indirect (blast radius, catalog resilience) | S–M | Lowers risk | Public HTTPS BFF endpoint; Scale+ for service accounts (else user keys) | P0 |
| 4 | **Usage analytics + subscription readiness in the admin console** | Indirect (cost visibility) | S–M | Lowers risk | #3 (per-key attribution) | P0–P1 |
| 5 | **Push-to-talk dictation in chat (Scribe v2 + keyterms)** | High (mobile, accessibility) | S–M | Low (~$0.0006 per 10 s) | New membership op (`stt_dictation`) in `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:57-66` | P1 |
| 6 | **World / location ambience loops (SFX `loop=true`)** generated once per card in Media Studio | High (immersion) | M | Low–Medium (≈$0.03–0.06 per clip, one-time per card) | Owned asset storage like theme songs; card-share cloning (`card_resource_clone.py`) | P1 |
| 7 | **Adventure "export as audio"** stitching existing narration MP3s (synthesize only missing segments) | Medium–High | M | Low (mostly reuse) | TTS migration done; new `BackgroundTaskOperation` | P1 |
| 8 | **Call STT on Scribe v2 (`pcm_s16le_16`, keyterms)** to consolidate providers | Medium (accuracy on names) | S–M | Low | Realtime note decision (batch vs streaming) | P1 |
| 9 | **Theme-song lyric karaoke + waveform** (`/v1/music/detailed` `with_timestamps`, `with_waveform_visual`) | Medium | S | None extra | #1 | P1 |
| 10 | **Audio/video lorebook import (Scribe v2, diarized, async webhook)** | Medium | M | Low–Medium (long files: cap duration per plan) | #3 webhook route; lorebook extraction pipeline | P2 |
| 11 | **Story Studio audiobook (Path B self-assembled; attribution pass → per-character voices)** | Medium–High (novelists) | L | Medium (long books; needs quota per chapter) | TTS + Text-to-Dialogue migration; attribution LLM graph | P2 |
| 12 | **Per-turn SFX cues with cross-user cache** | Medium | M–L | Medium–High without caching | #6; LLM output contract change | P2 |
| 13 | **Theme-song section edit ("regenerate chorus") via inpainting** | Medium | M | Medium (each edit is a generation) | #1 with `store_for_inpainting` | P2 |
| 14 | **Instrumental "bed" of character themes for adventures (conditioning or stems)** | Medium | M | Medium (stem pricing unknown) | #1 | P3 |
| 15 | **Admin: IVC `remove_background_noise` + isolator preview; STS "performance capture"** | Low (admin only) | S | Low | Catalog/admin console migration | P2 |
| 16 | **Synced call-history replay via Forced Alignment** | Low–Medium | S | Low | Stored call audio + text | P3 |
| 17 | **Studio API path (audiobook editor, GenFM recap podcasts)** | Medium | M–L | Medium | **Sales access**, paid plan, not ZRM-eligible | P3 |
| 18 | Dubbing, Audio Native, user-facing Voice Changer, Avatars | Low | n/a | n/a | n/a | Skip |

---

## 18. Discrepancies found in official sources

| Topic | Source A | Source B | Handling |
|---|---|---|---|
| Music max length | API: `music_length_ms` up to **600,000 ms** [verified: https://elevenlabs.io/docs/api-reference/music/compose] | Capability FAQ and pricing: **5 minutes** max [verified: https://elevenlabs.io/docs/overview/capabilities/music] [verified: https://elevenlabs.io/pricing/api] | Cap at 240 s (current product max) |
| Music caps vs API "included minutes" | Music Terms monthly generation limit, e.g. Pro **304 min** [verified: https://elevenlabs.io/music-terms] | API pricing "Minutes included", e.g. Pro **660 min** [verified: https://elevenlabs.io/pricing/api] | Assume the stricter Music Terms cap; ask the account manager |
| SFX duration minimum | API: 0.5–30 s [verified: https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert] | Capability: 0.1–30 s [verified: https://elevenlabs.io/docs/overview/capabilities/sound-effects] | Use ≥0.5 s |
| SFX cost | 40 credits/s with duration; 200 credits/generation | $0.12/min API + "included generations" | Measure with `character-cost` |
| Forced alignment file size | API: < 1 GB [verified: https://elevenlabs.io/docs/api-reference/forced-alignment/create] | Capability: 3 GB [verified: https://elevenlabs.io/docs/overview/capabilities/forced-alignment] | Use < 1 GB |
| STT file size | API: < 5.0 GB [verified: https://elevenlabs.io/docs/api-reference/speech-to-text/convert] | Capability FAQ: 3 GB [verified: https://elevenlabs.io/docs/overview/capabilities/speech-to-text] | Changelog confirms 5 GB since 2026-06-01 |
| Studio project count (Free) | Help center: 5 [verified: https://elevenlabs.io/docs/help-center/product/studio/studio/are-there-any-limitations-to-the-size-of-a-project-in-studio] | Pricing: 3 [verified: https://elevenlabs.io/pricing] | Irrelevant unless Path A |
| Music params `use_phonetic_names`, `generation_mode` | Changelog 2026-03-02 / 2026-05-25 | Absent from current compose reference | Do not rely on them |
| STT multichannel duration (*added during verification*) | Capability "Key facts": 1 hour multichannel [verified: https://elevenlabs.io/docs/overview/capabilities/speech-to-text] | Same page FAQ: combined duration of all channels under 10 hours [verified: same page] | Not used by us; assume 1 h if ever needed |
| Music download allowances (*added during verification*) | Music Terms: Free downloads "Not permitted"; Pro 500 min/month; HQ (lossless/192 kbps) Pro+ [verified: https://elevenlabs.io/music-terms] | Music v2.5 blog (consumer ElevenMusic app): Free "five lossless downloads a day" with commercial use if credited; Pro "400 lossless downloads per month" [verified: https://elevenlabs.io/blog/music-v2-5-model] | The blog describes the ElevenMusic consumer app. Plan API usage on the Music Terms table |
| Music output quality (*added during verification*) | Compose API: `mp3_48000_*` up to 320 kbps; `auto` = `mp3_48000_192` for v2 [verified: https://elevenlabs.io/docs/api-reference/music/compose] | API pricing card: "44.1kHz, 128-192kbps audio" [verified: https://elevenlabs.io/pricing/api] | Trust the API reference; HQ download rights still follow the Music Terms |

---

## 19. Open questions

1. **Music Terms (legal).**
   - Does a theme-song generator inside an AI roleplay app count as "Model Resale"?
   - Is the app a "Studio Game" above the indie thresholds?
   - Is card sharing (which clones songs) or a public song gallery a "Music Library"?
   - Which plan is required given company size (eligibility row)?
2. **Music capacity.**
   - Does the Music Terms "Monthly Generation Limit" apply to API generations, on top of USD billing?
   - Does each API response count against the "Download Limit"?
   - What Enterprise Music terms and caps are available?
3. **Product.** Keep ACE-Step as a cheap tier, or go single-engine? If kept, it must not appear "alongside" Eleven Music as a selectable model.
4. **Account access.**
   - Will we request Studio API access (Path A), or commit to Path B?
   - Is `safety-identifier` (per-end-user moderation ID) available for TTS/Music on our workspace?
5. **Operations.**
   - What are the History API rate limits for a deletion sweep at our volume?
   - Does deleting a history item affect request stitching (`previous_request_ids`) for later chapters? Probably yes, so sweep only after a session or export completes.
6. **Content policy.** What is the policy position on mature (non-visual) narration and companion-style calls under the Prohibited Use Policy ("harmful emotional dependency")? Should we request written confirmation?
7. **Unpublished pricing and latency.**
   - Stem separation price.
   - Eleven Music generation latency (not documented). Measure p50/p95 on 60 s and 240 s songs before sizing timeouts.
   - Exact fal pricing of `minimax/music-3`, for a fair before/after cost comparison.
8. **Organisation.** Is a multi-seat plan (Scale+) acceptable, so we get service accounts, `hashed_xi_api_key` attribution and per-environment isolation?

---

## 20. Sources

### Official ElevenLabs docs (read 2026-10-12; `.md` variants fetched via `https://elevenlabs.io/docs/llms.txt`)

1. https://elevenlabs.io/docs/llms.txt
2. https://elevenlabs.io/docs/api-reference/studio-api-information
3. https://elevenlabs.io/docs/api-reference/studio/add-project
4. https://elevenlabs.io/docs/api-reference/studio/update-content
5. https://elevenlabs.io/docs/api-reference/studio/add-chapter
6. https://elevenlabs.io/docs/api-reference/studio/convert-project
7. https://elevenlabs.io/docs/api-reference/studio/get-chapter-snapshots
8. https://elevenlabs.io/docs/api-reference/studio/stream-chapter-snapshot
9. https://elevenlabs.io/docs/api-reference/studio/stream-snapshot
10. https://elevenlabs.io/docs/api-reference/studio/archive-snapshot
11. https://elevenlabs.io/docs/api-reference/studio/create-pronunciation-dictionaries
12. https://elevenlabs.io/docs/api-reference/studio/create-podcast
13. https://elevenlabs.io/docs/eleven-creative/products/studio
14. https://elevenlabs.io/docs/help-center/product/studio/studio/are-there-any-limitations-to-the-size-of-a-project-in-studio
15. https://elevenlabs.io/docs/help-center/product/studio/studio/can-i-assign-more-than-one-voice-to-a-paragraph-in-studio
16. https://elevenlabs.io/docs/help-center/product/studio/studio/what-happens-to-my-studio-projects-if-i-downgrade-my-subscription
17. https://elevenlabs.io/docs/help-center/product/studio/studio/which-file-formats-can-i-import-with-studio
18. https://elevenlabs.io/docs/help-center/product/studio/audiobooks/how-many-voices-can-i-use-in-an-audiobook
19. https://elevenlabs.io/docs/help-center/product/studio/audiobooks/what-is-character-casting
20. https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert
21. https://elevenlabs.io/docs/overview/capabilities/sound-effects
22. https://elevenlabs.io/docs/eleven-creative/playground/sound-effects
23. https://elevenlabs.io/docs/eleven-api/guides/cookbooks/sound-effects
24. https://elevenlabs.io/docs/overview/capabilities/music
25. https://elevenlabs.io/docs/overview/capabilities/music/best-practices
26. https://elevenlabs.io/docs/api-reference/music/compose
27. https://elevenlabs.io/docs/api-reference/music/compose-detailed
28. https://elevenlabs.io/docs/api-reference/music/stream
29. https://elevenlabs.io/docs/api-reference/music/create-composition-plan
30. https://elevenlabs.io/docs/api-reference/music/upload
31. https://elevenlabs.io/docs/api-reference/music/separate-stems
32. https://elevenlabs.io/docs/api-reference/music/video-to-music
33. https://elevenlabs.io/docs/api-reference/music/finetunes/create
34. https://elevenlabs.io/docs/eleven-api/guides/how-to/music/composition-plans
35. https://elevenlabs.io/docs/eleven-api/guides/how-to/music/inpainting
36. https://elevenlabs.io/docs/eleven-api/guides/how-to/music/streaming
37. https://elevenlabs.io/docs/eleven-api/guides/cookbooks/music
38. https://elevenlabs.io/docs/eleven-creative/products/music
39. https://elevenlabs.io/docs/overview/capabilities/speech-to-text
40. https://elevenlabs.io/docs/api-reference/speech-to-text/convert
41. https://elevenlabs.io/docs/api-reference/speech-to-text/get
42. https://elevenlabs.io/docs/api-reference/speech-to-text/delete
43. https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/batch/webhooks
44. https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/batch/keyterm-prompting
45. https://elevenlabs.io/docs/eleven-api/resources/libraries/scribe-stt/react-scribe
46. https://elevenlabs.io/docs/overview/capabilities/forced-alignment
47. https://elevenlabs.io/docs/api-reference/forced-alignment/create
48. https://elevenlabs.io/docs/overview/capabilities/voice-changer
49. https://elevenlabs.io/docs/api-reference/speech-to-speech/convert
50. https://elevenlabs.io/docs/api-reference/speech-to-speech/stream
51. https://elevenlabs.io/docs/overview/capabilities/voice-isolator
52. https://elevenlabs.io/docs/api-reference/audio-isolation/convert
53. https://elevenlabs.io/docs/api-reference/audio-isolation/list
54. https://elevenlabs.io/docs/api-reference/audio-isolation/stream
55. https://elevenlabs.io/docs/api-reference/voices/ivc/create
56. https://elevenlabs.io/docs/overview/capabilities/dubbing
57. https://elevenlabs.io/docs/api-reference/dubbing/create-project
58. https://elevenlabs.io/docs/eleven-creative/audio-tools/audio-native
59. https://elevenlabs.io/docs/api-reference/audio-native/create
60. https://elevenlabs.io/docs/api-reference/history/list
61. https://elevenlabs.io/docs/api-reference/history/get
62. https://elevenlabs.io/docs/api-reference/history/delete
63. https://elevenlabs.io/docs/api-reference/history/download
64. https://elevenlabs.io/docs/api-reference/analytics/workspace/usage
65. https://elevenlabs.io/docs/api-reference/analytics/workspace/requests
66. https://elevenlabs.io/docs/api-reference/legacy/usage/get
67. https://elevenlabs.io/docs/api-reference/user/get
68. https://elevenlabs.io/docs/api-reference/user/subscription/get
69. https://elevenlabs.io/docs/overview/administration/usage-analytics
70. https://elevenlabs.io/docs/overview/administration/billing
71. https://elevenlabs.io/docs/overview/administration/pay-as-you-go
72. https://elevenlabs.io/docs/overview/administration/workspaces/overview
73. https://elevenlabs.io/docs/overview/administration/workspaces/service-accounts
74. https://elevenlabs.io/docs/overview/administration/workspaces/api-keys
75. https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/security
76. https://elevenlabs.io/docs/eleven-api/resources/webhooks
77. https://elevenlabs.io/docs/api-reference/webhooks/create
78. https://elevenlabs.io/docs/api-reference/tokens/create
79. https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode
80. https://elevenlabs.io/docs/eleven-creative/audio-tools/audio-detector
81. https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-live-moderation
82. https://elevenlabs.io/docs/overview/models
83. https://elevenlabs.io/docs/api-reference/text-to-speech/convert
84. https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps
85. https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/request-stitching
86. https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert
87. https://elevenlabs.io/docs/api-reference/pronunciation-dictionaries/create-from-rules
88. https://elevenlabs.io/docs/overview/capabilities/image-video
89. https://elevenlabs.io/docs/overview/capabilities/image-video/avatars

### Official ElevenLabs changelog entries

90. https://elevenlabs.io/docs/changelog/llms.txt
91. https://elevenlabs.io/docs/changelog/2025/9/1
92. https://elevenlabs.io/docs/changelog/2025/12/8
93. https://elevenlabs.io/docs/changelog/2026/1/12
94. https://elevenlabs.io/docs/changelog/2026/2/9
95. https://elevenlabs.io/docs/changelog/2026/3/2
96. https://elevenlabs.io/docs/changelog/2026/3/9
97. https://elevenlabs.io/docs/changelog/2026/4/20
98. https://elevenlabs.io/docs/changelog/2026/4/27
99. https://elevenlabs.io/docs/changelog/2026/5/25
100. https://elevenlabs.io/docs/changelog/2026/6/1
101. https://elevenlabs.io/docs/changelog/2026/6/8
102. https://elevenlabs.io/docs/changelog/2026/6/15
103. https://elevenlabs.io/docs/changelog/2026/6/22
104. https://elevenlabs.io/docs/changelog/2026/7/6
105. https://elevenlabs.io/docs/changelog/2026/7/13
106. https://elevenlabs.io/docs/changelog/2026/7/20
107. https://elevenlabs.io/docs/changelog/2026/8/17
108. https://elevenlabs.io/docs/changelog/2026/9/11 (Scribe v2 Medical GA; it does **not** cover Music v2.5, whose source is the blog post below)

### Official ElevenLabs web pages

109. https://elevenlabs.io/pricing
110. https://elevenlabs.io/pricing/api
111. https://elevenlabs.io/music-terms
112. https://elevenlabs.io/use-policy
113. https://elevenlabs.io/safety
114. https://elevenlabs.io/blog/music-v2-5-model

### Package registries (official SDK metadata)

115. https://pypi.org/pypi/elevenlabs/json
116. https://registry.npmjs.org/@elevenlabs/elevenlabs-js/latest

### Secondary sources

117. https://fal.ai/models/fal-ai/ace-step (ACE-Step price; official for fal, secondary for ElevenLabs comparisons)
118. https://fal.ai/models/minimax/music-3 (model listing; price not in static page)
119. https://artificialanalysis.ai/speech-to-text/models/elevenlabs-scribe-v2 (AA-WER benchmark)
120. https://docs.magnific.com/api-reference/music-generation/overview (third-party reseller latency estimate)
121. https://musicbusinessworldwide.com/elevenlabs-launched-music-v2-5-shortly-after-announcing-its-umg-licensing-deal (Music v2.5 launch context)

### Codebase files (read-only)

- `/home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/research/00_current_tts_review.md`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/config.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/registry.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/prompt_agent.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/fal_adapter.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/transcode.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/storage.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/engine.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/models/theme_song.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/runtime/theme_song_prompt_ace_step.v2.json`
- `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/runtime/theme_song_prompt_minimax_music_3.v2.json`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/card_resource_clone.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/card_export/content.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/card_sharing.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/stories.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_segments.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/stt_groq_client.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/lorebook_pdf.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/tasks.py`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/webhooks/fal.py`
- `/home/andres/WebstormProjects/magic-worlds/src/features/creation/common/components/MediaStudioSection.tsx`
- `/home/andres/WebstormProjects/magic-worlds/src/shared/types/media.types.ts`
- `/home/andres/WebstormProjects/magic-worlds/src/shared/types/task.types.ts`
- `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/ChatComposer.tsx`
- `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/TurnNarration.tsx`
- `/home/andres/WebstormProjects/magic-worlds/src/features/call/components/CallTranscriptView.tsx`
- `/home/andres/WebstormProjects/magic-worlds/src/features/novel/components/NovelStudio.tsx`
- `/home/andres/WebstormProjects/magic-worlds/src/features/lorebook/lorebookResourceFiles.ts`
- `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/VoiceCloneForm.tsx`
- `/home/andres/WebstormProjects/magic-worlds/src/features/admin/membership/components/ProviderCostByPayer.tsx`

---

## Verification log (2026-10-12)

An adversarial re-check against live official sources: docs `.md` pages fetched via `https://elevenlabs.io/docs/llms.txt`, the pricing pages, the Music Terms, the Prohibited Use Policy, the changelog and the package registries. 36 claims were checked. Each was compared with its live source with the aim of refuting it.

| # | Claim | Status | Source |
|---|---|---|---|
| 1 | SFX `POST /v1/sound-generation`, `model_id` only `eleven_text_to_sound_v2` (default), `duration_seconds` 0.5–30, `loop` default false, `prompt_influence` 0–1 default 0.3, 192 kbps MP3 Creator+, 44.1 kHz PCM Pro+ | confirmed | https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert |
| 2 | SFX capability: 30 s max, 40 credits/s with duration, 0.1–30 s, sequenced prompts | confirmed (+ added: WAV 48 kHz only for non-looping effects) | https://elevenlabs.io/docs/overview/capabilities/sound-effects |
| 3 | SFX UI prompt cap 450 chars | confirmed | https://elevenlabs.io/docs/eleven-creative/playground/sound-effects |
| 4 | SFX `loop` added in the 2025-09 changelog | confirmed | https://elevenlabs.io/docs/changelog/2025/9/1 |
| 5 | Music model ids `music_v1`/`music_v2`/`music_v2_5`; API default still `music_v1` | confirmed | https://elevenlabs.io/docs/api-reference/music/compose · https://elevenlabs.io/docs/overview/capabilities/music |
| 6 | `music_length_ms` 3,000–600,000 (prompt only); `seed` plan-only; `force_instrumental` prompt-only; `sign_with_c2pa` MP3 only; `output_format` `auto` → v1 `mp3_44100_128`, v2 `mp3_48000_192`; up to `mp3_48000_320` | confirmed (+ added: `song_id` is returned in response headers) | https://elevenlabs.io/docs/api-reference/music/compose |
| 7 | v2 composition-plan chunks: `duration_ms` 3–120 s, ≤30 lines × 200 chars, 6–7 styles, `context_adherence` low/medium/high, `conditioning_ref` + `condition_strength` | confirmed (`condition_strength` also allows `xhigh`) | https://elevenlabs.io/docs/api-reference/music/compose |
| 8 | `/v1/music/detailed` returns multipart/mixed with `song_metadata` incl. `is_explicit`; `with_timestamps`, `with_waveform_visual` | confirmed | https://elevenlabs.io/docs/api-reference/music/compose-detailed |
| 9 | `/v1/music/detailed/stream` (SSE) added 2026-07-06 | confirmed | https://elevenlabs.io/docs/changelog/2026/7/6 |
| 10 | `/v1/music/plan` costs no credits but is rate limited | confirmed | https://elevenlabs.io/docs/api-reference/music/create-composition-plan |
| 11 | Music upload priced as a generation; half charge if copyrighted | confirmed (+ `extract_composition_plan` now takes a model id; boolean deprecated) | https://elevenlabs.io/docs/api-reference/music/upload |
| 12 | Video-to-music: ≤10 videos, 200 MB, 600 s, description ≤4,100 chars, ≤10 tags | confirmed | https://elevenlabs.io/docs/api-reference/music/video-to-music |
| 13 | Finetune statuses incl. `blocked`, failure `copyright_violation`; $1.50 per finetune | confirmed | https://elevenlabs.io/docs/api-reference/music/finetunes/create · https://elevenlabs.io/pricing/api |
| 14 | Music v2 on API 2026-06-15; v2.5 announced 2026-09-11 and live in the API | confirmed | https://elevenlabs.io/docs/changelog/2026/6/15 · https://elevenlabs.io/blog/music-v2-5-model |
| 15 | Music API paid users only | confirmed | https://elevenlabs.io/docs/eleven-api/guides/how-to/music/streaming |
| 16 | `bad_prompt` + `prompt_suggestion`; `bad_composition_plan` + `composition_plan_suggestion`; no suggestion for harmful content | confirmed | https://elevenlabs.io/docs/eleven-api/guides/cookbooks/music |
| 17 | Music Terms updated 2026-10-09; Exhibit A table (eligibility, generation/download caps, concurrency, HQ downloads, API access, Model Resale, Music Library, Studio Games, indie thresholds $500k/$1M) | confirmed | https://elevenlabs.io/music-terms |
| 18 | "A Pro workspace supports about 300 songs/month for the whole app" as the planning number | corrected: Pro is individual-only; a company needs Scale (1,100 min) or Business (4,800 min) | https://elevenlabs.io/music-terms |
| 19 | The current picker is "the pattern the terms prohibit" | corrected (softened): matches the Reseller definition wording, but the own-product carve-out makes it a legal question | https://elevenlabs.io/music-terms |
| 20 | Concurrency per plan (STT 8/12/20/40/60/60, realtime 6/9/15/30/45/45, Music 0/2/2/2/5/5); `current-concurrent-requests` / `maximum-concurrent-requests` headers | confirmed | https://elevenlabs.io/docs/overview/models |
| 21 | API rates: TTS $0.08/$0.04 per 1K, Scribe $0.22/h, realtime $0.39/h, keyterms +$0.05/h, editing +$0.07/h, Music $0.15/min, STS/Isolator/SFX $0.12/min, Dubbing v1 $0.33–0.50, v2 $2.20; included Music minutes 3/40/147/660/1,993/6,600; SFX generations 8/150/605/3,000/9,000/30,000 | confirmed (+ added: Eleven v4 listings and promotion) | https://elevenlabs.io/pricing/api |
| 22 | Plans: Free 10k, Starter $6/30k, Creator $22/121k, Pro $99/600k, Scale $299/1.8M/3 seats, Business $990/6M/10 seats; credits TTS 1/char, STT 330/min, Music 900/min, SFX 200/gen, STS/Isolator 1,000/min, Dubbing 2,000–10,000/min; Free "3 Projects in Studio" | confirmed | https://elevenlabs.io/pricing |
| 23 | Studio API "only available upon request"; Studio on all plans; GenFM paid only; two free regenerations | confirmed | https://elevenlabs.io/docs/api-reference/studio-api-information |
| 24 | Studio `add-project` params (quality presets incl. `ultra_lossless` 705.6 kbps, `auto_assign_voices` alpha, per-voice `voice_settings`, `from_content_json` tts_node model, callback event shapes) | confirmed | https://elevenlabs.io/docs/api-reference/studio/add-project |
| 25 | Studio limits 500 chapters / 400 paragraphs / 5,000 chars; projects 5/20/1,000/3,000/20,000 | confirmed | https://elevenlabs.io/docs/help-center/product/studio/studio/are-there-any-limitations-to-the-size-of-a-project-in-studio |
| 26 | Studio export quality by plan; speed 0.7–1.2; volume −30 to +5 dB; SFX not supported via Studio API streaming | confirmed | https://elevenlabs.io/docs/eleven-creative/products/studio |
| 27 | GenFM podcast params (`mode`, `duration_scale`, `highlights` 10–70 chars, `safety-identifier` allowlist) | confirmed | https://elevenlabs.io/docs/api-reference/studio/create-podcast |
| 28 | STT params: file < 5.0 GB, `cloud_storage_url` deprecated → `source_url`, `pcm_s16le_16`, keyterms ≤1,000 / <50 chars / ≤5 words / +20% / 20 s minimum if >100, `transcript_edit` +30%, `detect_speaker_roles` +10%, multichannel ≤5, `webhook_metadata` ≤16 KB, `token` single-use 15 min, `enable_logging` Enterprise | confirmed (+ added `additional_formats`, `use_speaker_library`) | https://elevenlabs.io/docs/api-reference/speech-to-text/convert |
| 29 | STT 5 GB since 2026-06-01; single-use batch token 2026-07-20 | confirmed | https://elevenlabs.io/docs/changelog/2026/6/1 · https://elevenlabs.io/docs/changelog/2026/7/20 |
| 30 | `scribe_v1` deprecated, removal 2026-07-09 | confirmed; updated to say that date has passed | https://elevenlabs.io/docs/changelog/2026/6/8 · https://elevenlabs.io/docs/overview/models |
| 31 | STT capability: 10 h / 1 h multichannel, >8 min parallelised into 4, ≤5% WER tier includes en/es/fr/de/it/pt/ja | confirmed (+ multichannel discrepancy added to §18) | https://elevenlabs.io/docs/overview/capabilities/speech-to-text |
| 32 | Voice Changer: `eleven_multilingual_sts_v2`/`eleven_english_sts_v2`, 5 min segments, 1,000 chars/min; Isolator 500 MB/1 h; IVC `remove_background_noise` caveat | confirmed | https://elevenlabs.io/docs/overview/capabilities/voice-changer · https://elevenlabs.io/docs/overview/capabilities/voice-isolator · https://elevenlabs.io/docs/api-reference/voices/ivc/create |
| 33 | Dubbing `POST /v1/dubbing/project` (≤3 GiB, default `dubbing_v2`, keyterms ≤1,000, minimum one-language charge, Enterprise-only transcript); v2 alpha; 3 concurrent self-serve; Dubbing Studio maintenance mode; resource-editing endpoints deprecated 2026-04-20 | confirmed | https://elevenlabs.io/docs/api-reference/dubbing/create-project · https://elevenlabs.io/docs/overview/capabilities/dubbing · https://elevenlabs.io/docs/changelog/2026/4/20 |
| 34 | Forced alignment: API < 1 GB vs capability 3 GB; 675,000 chars; no diarization; STT price | confirmed | https://elevenlabs.io/docs/api-reference/forced-alignment/create · https://elevenlabs.io/docs/overview/capabilities/forced-alignment |
| 35 | ZRM Enterprise only; Music, Image & Video, IVC/PVC, Dubbing and Studio not eligible; deletion leaves debug/moderation logs; 30-day backups | confirmed | https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode |
| 36 | History: Music and SFX not retrievable; `page_size` ≤1,000; `source` enum TTS/STS/Flows | confirmed (+ `model_id` filter needs `source`) | https://elevenlabs.io/docs/api-reference/history/list |
| 37 | `usage-by-product-over-time` added 2026-04-20, replaces deprecated `/v1/usage/character-stats`; `group_by` incl. `hashed_xi_api_key` | confirmed (+ added `voice_multiplier` use) | https://elevenlabs.io/docs/api-reference/analytics/workspace/usage · https://elevenlabs.io/docs/api-reference/legacy/usage/get |
| 38 | `GET /v1/user/subscription` fields and `status` values | confirmed | https://elevenlabs.io/docs/api-reference/user/subscription/get |
| 39 | API keys: scopes, credit quota, IP allowlist 1–100 public entries, user-key expiry 15 min–30 days, `exposed_publicly`; service accounts multi-seat only, keys do not expire, `POST /v1/service-accounts` 2026-07-13 | confirmed | https://elevenlabs.io/docs/overview/administration/workspaces/api-keys · https://elevenlabs.io/docs/overview/administration/workspaces/service-accounts · https://elevenlabs.io/docs/changelog/2026/7/13 |
| 40 | Single-use token types `realtime_scribe` / `batch_scribe` / `tts_websocket`, 15 min | confirmed | https://elevenlabs.io/docs/api-reference/tokens/create |
| 41 | Webhook retries "on 5xx/429/408 only" | corrected: connection errors and timeouts are also retried; 100 pending-retry cap | https://elevenlabs.io/docs/eleven-api/resources/webhooks |
| 42 | Webhook auto-disable after 10 consecutive failures and no success in 7 days; voice-removal event names | confirmed (+ notice-period / `disable_at_unix` caveat added) | https://elevenlabs.io/docs/eleven-api/resources/webhooks · https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-a-notice-period |
| 43 | Prohibited Use Policy (updated 2026-10-09): 18+ accounts, under-18 apps need written approval, sexual-content list, "harmful emotional dependency", free-plan commercial ban, wrapper/proxy, "more permissive" pass-through, no training | confirmed | https://elevenlabs.io/use-policy |
| 44 | Watermark clause quoted without its purpose qualifier | corrected (qualifier added) | https://elevenlabs.io/use-policy |
| 45 | Avatars: "API requires Pro+" | corrected: Image & Video API needs Pro+; Avatars have no API yet | https://elevenlabs.io/docs/overview/capabilities/image-video · https://elevenlabs.io/docs/overview/capabilities/image-video/avatars |
| 46 | Audio Detector UI-only, ElevenLabs watermarks only; third-party models generally not watermarked | confirmed | https://elevenlabs.io/docs/eleven-creative/audio-tools/audio-detector |
| 47 | Live Moderation on shared PVC voices may add latency | confirmed | https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-live-moderation |
| 48 | SDK versions Python/JS 2.71.0 (PyPI upload 2026-10-05); SDK CRLF fix for music detailed (v2.38.1) | confirmed | https://pypi.org/pypi/elevenlabs/json · https://registry.npmjs.org/@elevenlabs/elevenlabs-js/latest · https://elevenlabs.io/docs/changelog/2026/3/9 |
| 49 | `api-global-preview.elevenlabs.io` deprecated | confirmed | https://elevenlabs.io/docs/changelog/2026/2/9 |
| 50 | ACE-Step $0.0002/s on fal | confirmed (fal official page; secondary for ElevenLabs) | https://fal.ai/models/fal-ai/ace-step |
| 51 | Groq whisper-large-v3 about $0.111/h | unverified (Groq pricing page showed no STT rates) | https://groq.com/pricing |
| 52 | `use_phonetic_names` / `generation_mode` current status | unverified (changelog only; absent from the reference) | https://elevenlabs.io/docs/changelog/2026/3/2 · https://elevenlabs.io/docs/changelog/2026/5/25 |
| 53 | Stem-separation price; Music latency; C2PA size/latency impact | unverified (not published) | https://elevenlabs.io/pricing/api |

Codebase spot-checks made during verification:
- the theme-song picker options are at `/home/andres/WebstormProjects/magic-worlds/src/features/creation/common/components/MediaStudioSection.tsx:449-450`;
- the free/plus/pro theme-song quotas 5/25/100 are at `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py:30,38,46`;
- the duration bounds 60/10/240 s and concurrency 8 are at `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/config.py:25-30`;
- `reserve_media_operation` is at `/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/engine.py:797-800`;
- `SegmentKind` is at `/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_segments.py:13`;
- the `ThemeSongModelAlias` union is at `/home/andres/WebstormProjects/magic-worlds/src/shared/types/media.types.ts:80`.

All of them matched.
