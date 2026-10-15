# ElevenLabs voices: catalog, Voice Library, cloning, design

> **Research scope (reviewed 2026-10-14):** Historical evidence from the dates stated below, including the retired MiniMax baseline. Vendor prices, model/API facts and policy claims were not reverified in this documentation pass. Current application status is **WIP** and is tracked in [00](../00_current_status_and_roadmap.md); later native ElevenLabs code/cutover supersedes migration-era implementation assumptions here.

Research date: **2026-10-12**. Read-only research. No code was changed.

**Scope.** This note covers the ElevenLabs *voice* ecosystem for the MiniMax → ElevenLabs migration of magic-worlds: the kinds of voice, the listing and search APIs, the Voice Library (shared voices), Instant and Professional Voice Cloning, Voice Design and Voice Remix, voice management, preview audio, and the safety and policy rules. It ends with a target **voice catalog** design for magic-worlds. That design covers what users see, a DB schema, a sync job, free previews, filters, slot budgeting, how the root admin console maps to ElevenLabs, and how user presets ("recipes") change. Text-to-speech synthesis, streaming and realtime calls are covered only where they affect the catalog. Other files in this folder cover them in full.

Baseline for the current MiniMax stack: [00_current_tts_review.md](./00_current_tts_review.md).

**How claims are tagged**

| Tag | Meaning |
|---|---|
| `[verified: url]` | Read on an official ElevenLabs page (docs, API reference, help center, pricing, changelog, official GitHub) on 2026-10-12. |
| `[verified: live probe]` | Seen directly in a live, unauthenticated call to the public ElevenLabs API on 2026-10-12. The exact request is listed in §9.2. |
| `[secondary: url]` | Non-official source, such as a forum, a third-party article, or a search-engine summary. |
| `[unverified]` | From memory or inference. Must be confirmed before anyone relies on it. |

Codebase facts cite absolute paths with line numbers.

---

## Contents

0. [TL;DR: decisions that matter](#0-tldr-decisions-that-matter)
1. [Today's catalog and studio (MiniMax)](#1-todays-catalog-and-studio-minimax)
2. [Voice types and categories](#2-voice-types-and-categories)
3. [Listing, lookup and search APIs](#3-listing-lookup-and-search-apis)
4. [Voice Library (shared voices)](#4-voice-library-shared-voices)
5. [Instant Voice Cloning (IVC)](#5-instant-voice-cloning-ivc)
6. [Professional Voice Cloning (PVC)](#6-professional-voice-cloning-pvc)
7. [Voice Design and Voice Remix](#7-voice-design-and-voice-remix)
8. [Voice management, sharing, slots and quotas](#8-voice-management-sharing-slots-and-quotas)
9. [Voice previews](#9-voice-previews)
10. [Moderation, safety and policy](#10-moderation-safety-and-policy)
11. [Model compatibility that affects the catalog](#11-model-compatibility-that-affects-the-catalog)
12. [Target catalog design for magic-worlds](#12-target-catalog-design-for-magic-worlds)
13. [Best-practice checklist](#13-best-practice-checklist)
14. [Open questions](#14-open-questions)
15. [Sources](#15-sources)
16. [Verification log (2026-10-12)](#verification-log-2026-10-12)

---

## 0. TL;DR: decisions that matter

1. **Do not build on ElevenLabs "Default" (premade) voices.** They expire on **31 December 2026**. Accounts created after March 2026 never get them [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-are-default-voices]. A brand-new magic-worlds account would have no premade voices at all. The successor to MiniMax "system voices" is a **curated set of Voice Library voices**, added to our account.
2. **Library voices do not use custom voice slots.** Only voices we *create* do: Voice Design, Remix, IVC and PVC [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-library] [verified: https://elevenlabs.io/docs/overview/administration/billing]. A large curated catalog is therefore cheap in slots. Adding and editing voices still uses the monthly **voice add/edit quota** (Pro 290, Scale/Business 1,040) [verified: https://elevenlabs.io/docs/help-center/account/general/how-many-voice-slots-do-i-get-per-tier-and-how-can-i-increase-it].
3. **The Voice Library is not available through the API on the free tier** [verified: https://elevenlabs.io/docs/overview/capabilities/voices]. Production needs a paid plan. Pro (160 slots) or Scale (660 slots) fits.
4. **Library voices can disappear.** The owner sets a notice period of 30 days to 2 years, or none. With no notice period, access ends at once [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-a-notice-period]. Curate only voices with `notice_period ≥ 365` days. Track `sharing.disable_at_unix` and subscribe to the removal webhooks.
5. **Always add curated library voices to our account** (`POST /v1/voices/add/{public_user_id}/{voice_id}`). The docs say the *web UI* can use library voices without saving them. Whether the *API* allows that is not documented, and a community report says paid API users must add them first ([secondary], §4.4). Adding costs no slot and records the notice period for us. *(Added during verification.)* The Voice Library Addendum says notice-period access is kept for users "that added that User Voice Model to their account prior to removal", which is one more reason to add every curated voice [verified: https://elevenlabs.io/vla].
6. **Fix today's gap.** Admin-created voices (designed, cloned, remixed) go into a **DB-backed `voice_catalog`** with a publish step. The user picker then reads only from that table, never straight from the provider.
7. **Previews should be free.** Use `preview_url` and `verified_languages[].preview_url`, downloaded once by the sync job and served from our storage. For voices we design, keep the design preview audio. Paid "recipe previews" become metered, rate-limited and cached by a recipe hash. This closes baseline issue #1 (the unmetered paid preview).
8. **Recipes must be rebuilt.** MiniMax `speed/vol/pitch/emotion/language_boost` do not map 1:1. ElevenLabs offers `stability`, `similarity_boost`, `style`, `speed` (0.7–1.2) and `use_speaker_boost`, with support that varies by model. **Eleven v4 exposes only Stability and Similarity**: no Style, no Speed, no SSML [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4]. Emotion becomes audio tags such as `[sad]` and `[whispers]`. Pitch has no equivalent; use Voice Remix to make a variant voice instead. Volume becomes playback or loudness normalization.
9. **PVC is not a path for third-party voices.** You can only PVC **your own** voice, behind a voice CAPTCHA [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/can-i-create-a-professional-voice-clone-of-someone-elses-voice]. The admin console should offer **Voice Design, Remix and IVC (with a recorded consent)**, plus a **Library browser**.

---

## 1. Today's catalog and studio (MiniMax)

What exists now. Every item must be replaced or mapped.

| Piece | Where | What it does today | Migration impact |
|---|---|---|---|
| System voice catalog (user) | `GET /voice-presets/system-voices`, `/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:87-96` | Proxies MiniMax `/v1/get_voice` for **system voices only**, cached 5 minutes per process (`/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:46`, `:243-263`). | Replace with a read of the DB-backed `voice_catalog` (§12). |
| Paid preview (user) | `POST /voice-presets/preview`, `/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:99-118` | MiniMax `t2a_v2`, ≤400 characters (`:19-20`), returns hex. No quota and no rate limit (baseline issue #1). | Use free `preview_url` for "hear the voice", and a metered, cached synth only for "hear my recipe" (§12.4). |
| Presets CRUD | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:62-151`; model `/home/andres/PycharmProjects/magic-worlds-api/src/models/voice_preset.py:8-21` | `name, description, base_voice_id, base_voice_name, speed 0.5–2, volume (0,10], pitch -12..12, emotion, language_boost`. | New recipe schema (§12.8). |
| Preset table | `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:1276-1309` | `voice_preset`; global presets have `user_id NULL, is_global=1` and are read-only. No API creates them. | Add provider, catalog FK and EL settings; add a root API to create global presets. |
| Character voice (snapshot-safe) | `/home/andres/PycharmProjects/magic-worlds-api/src/models/character.py:11-40`, `:62`; resolver `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:36-101` | `{voice_id, speed, vol, pitch, emotion, language_boost, preset_id, preset_name}`, copied into cards and frozen into chat snapshots. | Versioned v2 shape, plus a legacy MiniMax-id → catalog mapping at resolve time (§12.9). |
| Root admin console API | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:75-196` | `design`, `test`, `clone-file`, `clone`, list, delete, all on MiniMax. | Re-map to ElevenLabs (§12.7). |
| MiniMax admin service | `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:218-236` (design), `:368-421` (clone), `:615-641` (test payload) | MiniMax voice ids are chosen by us (`_VOICE_ID_PATTERN`, `/home/andres/PycharmProjects/magic-worlds-api/src/models/admin_voice.py:55-57`). | ElevenLabs assigns voice ids, so our id rules go away. |
| Voice picker | `/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/VoicePickerDialog.tsx:20-31` (preset → `CharacterVoice`), `:59-62` (loads presets + `groups.system`), `:88-91` (system pick stores `{voice_id}` only) | Tabs "My presets" and "System voices". | Tabs become "Presets" and "Catalog", with filters (§12.5). |
| System voice browser | `/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/SystemVoicePicker.tsx:16-34` | Client-side search and language filter. The language is *derived from the MiniMax id prefix* (`/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/voiceLanguage.ts:15-21`). | Use real labels (`language`, `accent`, `gender`, `age`, `use_case`, `descriptive`) and `verified_languages`. |
| Recipe controls | `/home/andres/WebstormProjects/magic-worlds/src/features/voices/recipe.ts:4-18`; `/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/PresetRecipeControls.tsx:12-61` | Speed, volume and pitch sliders, plus emotion and language_boost selects. | Model-aware ElevenLabs controls (§12.8). |
| Preview hook | `/home/andres/WebstormProjects/magic-worlds/src/features/voices/usePreviewVoice.ts:12-37` | Always calls paid synthesis, with a default English sentence. | Play the cached `preview_url` first; synthesize only for a custom recipe. |
| Admin constants | `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/constants.ts:18-23` (clone limits 10 s–5 min, 20 MB), `:60-63` (MiniMax models), `:66-75` (emotions), `:92-105` (`language_boost`), `:108` (interjection tags) | All MiniMax-specific. | Replace with ElevenLabs model, tag and format lists. |
| Admin id rules | `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/voiceIdRules.ts:13` | MiniMax custom voice-id regex. | Delete. ElevenLabs assigns ids. |
| Clone form | `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/VoiceCloneForm.tsx:60-69`, `:286` | Noise reduction, `clone_prompt`, and a demo URL from the provider CDN. | IVC multipart (§5). |
| Design form | `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/VoiceDesignForm.tsx:47-51` | One call creates the voice right away. | Two steps: preview, then save (§7). |
| Feature flag | `/home/andres/WebstormProjects/magic-worlds/src/features/creation/character/components/CharacterCreator.tsx:130-132`, `:249` | `isVoicesFeatureEnabled()` gates the voice field on cards. | Keep it. |
| Narrator voice | `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/InteractionLeftPanel.tsx:173-175` | `snapshot.narrator_voice` uses the same `CharacterVoice` shape. | Same v2 shape. |

**The gap today.** Cloned and designed voices cannot be reached by users, because the user picker reads only `groups.system` (`/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/VoicePickerDialog.tsx:61`). MiniMax also deletes unused clones after 7 days ([00_current_tts_review.md](./00_current_tts_review.md) §2, Path C).

---

## 2. Voice types and categories

### 2.1 Concepts

| Concept | What it is | API marker | Slot? | Shareable to Library? |
|---|---|---|---|---|
| **Default / premade** | ElevenLabs-owned stock voices, such as George, Sarah and Brian. | `category: "premade"`; `voice_type=default` in `/v2/voices` | No [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-delete-voices-from-my-voices] | n/a |
| **Legacy** | Former defaults below the current quality bar. Fully removed; their API ids **auto-route** to replacements. | `is_legacy: true` (field exists) [verified: https://elevenlabs.io/docs/api-reference/voices/search] | No | n/a |
| **Generated (Voice Design)** | Made from a text prompt. | `category: "generated"` | **Yes** ("will take up one of your voice slots") [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-design] | **No**. Workspace sharing only. |
| **Cloned (IVC)** | Few-shot clone from about 1–2 minutes of audio. | `category: "cloned"` | **Yes** | **No**. Workspace sharing only. |
| **Professional (PVC)** | Fine-tuned clone. Your own voice only. | `category: "professional"` | Yes, plus PVC slots | **Yes**. The only type that can be published. |
| **Library / community** | Other users' PVCs, shared in the Voice Library. | `category` of `professional`, `high_quality` or `famous`; `voice_type=community` once added; `sharing.status: "copied"` | **No** [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-library] | n/a |
| **High quality / "Studio Quality"** | Library PVCs reviewed by QA as studio grade. | `category: "high_quality"`; `/v2/voices?high_quality=true` | No | already shared |
| **Famous** | A Voice Library category added in June 2025. | `category: "famous"` | No | [verified: https://elevenlabs.io/docs/changelog/2025/6/23] |
| **Iconic Marketplace** | Licensed celebrity and historical voices (Michael Caine, and others). | Sales and approval workflow. No public API found. | n/a | [secondary: https://the-decoder.com/elevenlabs-opens-a-marketplace-for-iconic-ai-voices/] [verified: https://elevenlabs.io/iconic-marketplace]. Launched November 2025. Each request is reviewed by the rights holder. **Not relevant** to a roleplay catalog. |

The `category` enum on voice objects is `generated | cloned | premade | professional | famous | high_quality` [verified: https://elevenlabs.io/docs/api-reference/voices/search].

### 2.2 The Default-voice deprecation (critical)

- "All our Default voices will expire on **December 31, 2026**, and they will no longer be accessible after this date. … Default voices are only available for accounts that were created **before March 2026**." [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-access-eleven-labs-default-voices]
- The overview page repeats the warning [verified: https://elevenlabs.io/docs/overview/capabilities/voices].
- Unlike Legacy voices, **no automatic id routing is promised** for Default voices after the deadline. Legacy ids "automatically route to their replacement voice IDs" [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-are-legacy-voices]. Whether expired Default ids will also be routed is **[unverified]**, so assume they will fail.
- The official examples still use a Default voice: the quickstart calls `voice_id="JBFqnCBsd6RMkjVDRZzb"  # "George"` with `model_id="eleven_v4"` [verified: https://elevenlabs.io/docs/eleven-api/quickstart]. Copy-pasted sample ids are a trap.

ElevenLabs suggests these replacements. They are "not a strict 1-to-1 replacement" [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-are-default-voices]:

| Old Default | Suggested replacement | Old Default | Suggested replacement |
|---|---|---|---|
| Roger | Darian - Warm Grounded Storyteller | Will | Warren - Effortless and Cool |
| Sarah | Talia - Warm Soft Guide | Jessica | Jade - Upbeat and Natural |
| Laura | Elara - Crisp Pro Narrator | Eric | Eddie - Helpful and Comforting |
| Charlie | Baxter - Dry Calm Aussie | Chris | Caleb - Trusted Guide |
| George | Eldrin - Crisp British Baritone | Brian | Sawyer - Midnight Storyteller |
| Callum | Kellan - Casual Friendly Speaker | Daniel | Finley - Articulate Anchor |
| River | Elowen - Upbeat Modern Narrator | Lily | Florence - Atmospheric Storyteller |
| Harry | Kaelen - Amateur Warrior | Bill | Wyatt - Seasoned Mentor |
| Liam | Lawrence - Bright and Informative | Alice | Alicia - Polished Global Anchor |
| Matilda | Maisie - Friendly Casual Neighbor | | |

The help page links to these voices, but its table does not give voice ids. A LiveKit community thread (March–May 2026) lists ids for them and reports that they behave like **shared library voices** ("only available through the 'explore' tab"). The poster later said some of those ids may be wrong [secondary: https://community.livekit.io/t/new-default-elevenlabs-voices/459]. **Resolve the real ids with an authenticated `GET /v1/shared-voices?search=…` during implementation.** Do not copy ids from forums.

**Implication.** The magic-worlds "system voice" concept maps to *curated Voice Library voices*. Premade voices may appear in `/v2/voices` for older accounts. Treat them as `premade_deprecated` and never publish them to users.

---

## 3. Listing, lookup and search APIs

### 3.1 `GET /v2/voices`: the account's voices (search, filter, paginate)

Source: [verified: https://elevenlabs.io/docs/api-reference/voices/search].

| Query param | Notes |
|---|---|
| `next_page_token` | Cursor. Use it with `has_more`. |
| `page_size` | Default 10, max 100. "Page 0 may include more voices due to default voices being included." |
| `search` | Searches name, description, labels and category. |
| `sort`, `sort_direction` | `created_at_unix` or `name`; `asc` or `desc`. `created_at_unix` "may not be available for older voices." |
| `voice_type` | `personal`, `community`, `default`, `workspace`, `non-default`, `non-community`, `saved`. `non-community` means personal plus workspace, so it excludes library copies. `saved` means non-default plus any default voices added to a collection. `saved` was added 2026-01-05 [verified: https://elevenlabs.io/docs/changelog/2026/1/5]. |
| `category` | `premade`, `cloned`, `generated`, `professional`. |
| `fine_tuning_state` | PVC only: `draft`, `not_verified`, `not_started`, `queued`, `fine_tuning`, `fine_tuned`, `failed`, `delayed`. |
| `collection_id` | Filter by a voice collection. |
| `gender`, `age`, `accent` (string); `language`, `use_cases` (list) | Label filters, **added 2026-08-10** [verified: https://elevenlabs.io/docs/changelog/2026/8/10]. |
| `min_notice_period_days`, `include_custom_rates`, `include_live_moderated`, `high_quality` | Library-related filters on the account's own list. `include_custom_rates` and `include_live_moderated` default to *including* such voices, and `high_quality=true` returns only `category == high_quality`. These four were **also added on 2026-08-10**, in the same release as the label filters (corrected during verification) [verified: https://elevenlabs.io/docs/changelog/2026/8/10] [verified: https://elevenlabs.io/docs/api-reference/voices/search]. |
| `include_total_count` | Default true. It "incurs a performance cost", so the docs advise relying on `has_more` instead. |
| `voice_ids` | Look up specific ids. **Max 100.** This is the right way to refresh the state of curated voices in bulk. |

Response: `{voices[], has_more, total_count, next_page_token}`.

**`VoiceResponseModel` fields that matter for a catalog** (same source):

| Field | Use |
|---|---|
| `voice_id`, `name`, `description`, `category` | Identity and display. |
| `labels` (map) | `accent`, `age`, `gender`, `language`, `descriptive`, `use_case`. For our own voices the writable keys are only **language, accent, gender, age** [verified: https://elevenlabs.io/docs/api-reference/voices/ivc/create] [verified: https://elevenlabs.io/docs/changelog/2026/1/19]. |
| `preview_url` | Free preview audio (§9). |
| `verified_languages[]` | `{language, model_id, accent, locale, preview_url}`, one entry per language and model, often with a per-language preview. |
| `high_quality_base_model_ids` | Models the voice is high-quality on. |
| `fine_tuning` | PVC per-model state map, progress and verification attempts. |
| `settings` | Stored default voice settings: `stability` 0.5, `similarity_boost` 0.75, `style` 0, `speed` 1, `use_speaker_boost` true. |
| `sharing` | `status` (`enabled`, `disabled`, `copied`, `copied_disabled`), `public_owner_id`, `original_voice_id`, `notice_period`, **`disable_at_unix`**, `rate`, `fiat_rate`, `free_users_allowed`, `live_moderation_enabled`, `voice_mixing_allowed`, `featured`, `category`, `review_status`, `enabled_in_library`, `liked_by_count`, `cloned_by_count`, `labels`, `image_url`, and others. |
| `available_for_tiers` | Plan gating. |
| `safety_control` | `NONE`, `BAN`, `CAPTCHA`, `ENTERPRISE_BAN`, `ENTERPRISE_CAPTCHA`. |
| `voice_verification` | `requires_verification`, `is_verified`, failures, attempts. |
| `is_owner`, `is_legacy`, `is_mixed`, `permission_on_resource`, `collection_ids`, `created_at_unix`, `favorited_at_unix`, `is_bookmarked` | Ownership and organization. |
| `recording_quality` (`studio`, `good`, `ok`, `poor`, `bad`), `labelling_status`, `recording_quality_reason` | Review-pipeline quality signals. Useful for curation. |

### 3.2 Other lookup endpoints

| Endpoint | Purpose | Source |
|---|---|---|
| `GET /v1/voices/{voice_id}` | One voice with full metadata. `with_settings` is deprecated and ignored. **The docs point here for `disable_at_unix`.** | [verified: https://elevenlabs.io/docs/api-reference/voices/get] |
| `GET /v1/voices` (legacy, `show_legacy`) | Old list. SDK docstring: "**Stops working once the user's workspace exceeds 500 voices.**" Do not use. | [verified: https://github.com/elevenlabs/elevenlabs-python/blob/main/reference.md] |
| `GET /v1/voices/settings/default` | Global default settings. | [verified: https://elevenlabs.io/docs/api-reference/voices/settings/get-default] |
| `GET /v1/voices/{id}/settings` and `POST /v1/voices/{id}/settings/edit` | Per-voice stored defaults (stability, similarity_boost, style, speed, use_speaker_boost). | [verified: https://elevenlabs.io/docs/api-reference/voices/settings/update] |
| `POST /v1/similar-voices` | Multipart `audio_file`, `similarity_threshold` (0–2; smaller means more similar), `top_k` (1–100). Returns **Voice Library** voices. Ideal for finding a replacement when a curated voice is being removed, and for mapping MiniMax voices to ElevenLabs. | [verified: https://elevenlabs.io/docs/api-reference/voices/find-similar-voices] |
| `GET /v1/voices/accents` | Accents in the shared library. Optional `language` and `model_id` filters. Returns `accent`, `language`, `code` and `name`. Added 2026-07-27. Feed `accent` to `/v1/shared-voices?accent=`. | [verified: https://elevenlabs.io/docs/api-reference/voices/accents/get] [verified: https://elevenlabs.io/docs/changelog/2026/7/27] |
| Collections: `GET/POST /v1/voices/collections`, `POST /v1/voices/collections/{collection_id}/voice/{voice_id}`, plus get, update, delete and remove-voice | Named groups of voices (title and icon). Useful for mirroring our "curated" set inside ElevenLabs. Optional. | [verified: https://elevenlabs.io/docs/api-reference/voices/collections/create] [verified: https://elevenlabs.io/docs/api-reference/voices/collections/add-voice] |
| Data residency hosts | `api.elevenlabs.io`, `api.us.elevenlabs.io`, `api.eu.residency.elevenlabs.io`, `api.in.residency…`, `api.sg.residency…` | [verified: https://elevenlabs.io/docs/api-reference/voices/search] |

SDKs: the Python and JS SDKs are at **v2.71.0** (released 2026-10-05) and expose `voices.search`, `voices.get`, `voices.share` (add shared voice), `voices.get_shared`, `voices.find_similar_voices`, `voices.ivc.create`, `voices.pvc.*`, `text_to_voice.design/create/remix`, `text_to_voice.preview.stream`, `voices.settings.*` and `voices.accents.get` [verified: https://github.com/elevenlabs/elevenlabs-python/blob/main/reference.md] [verified: https://elevenlabs.io/docs/changelog/2026/10/5]. The magic-worlds BFF uses raw `httpx` today, so we can keep doing that. Note that `/v1/voices/add/{public_user_id}/{voice_id}` is called `voices.share` in the SDK. The naming is confusing.

---

## 4. Voice Library (shared voices)

### 4.1 `GET /v1/shared-voices`

Source: [verified: https://elevenlabs.io/docs/api-reference/voices/voice-library/get-shared].

| Param | Notes |
|---|---|
| `page_size` | Default 30, max 100. |
| `page` | Default 0. This is offset paging, not a cursor. |
| `category` | `professional`, `famous`, `high_quality`. |
| `gender`, `age`, `accent`, `language`, `locale`, `search` | Strings. Use `GET /v1/voices/accents` for valid accents. |
| `use_cases`, `descriptives` | Lists. |
| `featured` | Bool, default false. |
| `min_notice_period_days` | Int. **Use ≥ 365.** |
| `include_custom_rates` | Bool. **Use `false`.** |
| `include_live_moderated` | Bool. Consider `false`; see §4.6. |
| `reader_app_enabled` | Bool, default false. |
| `owner_id` | Public owner id. |
| `sort` | `created_date` (default), `usage_character_count_1y`, `trending`, `cloned_by_count`. The explicit enum arrived 2026-06-15 [verified: https://elevenlabs.io/docs/changelog/2026/6/15]. |

Response: `{voices[], has_more, total_count, last_sort_id}`. `total_count` was added on 2026-04-01 [verified: https://elevenlabs.io/docs/changelog/2026/4/1].

`LibraryVoiceResponseModel` fields: `public_owner_id`, `voice_id`, `date_unix`, `name`, `accent`, `gender`, `age`, `descriptive`, `use_case`, `category`, `usage_character_count_1y`, `usage_character_count_7d`, `play_api_usage_character_count_1y`, `cloned_by_count`, `free_users_allowed`, `live_moderation_enabled`, `featured`, `language`, `locale`, `description`, `preview_url`, `rate`, `fiat_rate` (USD per 1,000 credits; null means default), `verified_languages[]`, `notice_period`, `instagram/twitter/youtube/tiktok_username`, `image_url`, `is_added_by_user`, `is_bookmarked`.

**Live probe observations** (unauthenticated; request in §9.2) [verified: live probe]:

- **Without an API key** the endpoint returns at most **3** voices. Larger pages fail with `401 … "You must be logged in to fetch more than 3 voices."` `search=` also fails, with `401 "You must be logged in to use filters."`, although `language` and `sort` worked. Every sync and admin browse must be **authenticated**.
- `total_count` for `language=es` was **8,788**. The library is far too big to mirror. Mirror only the curated set.
- The three top trending Spanish voices were all `category: "high_quality"`, `notice_period: 730`, `rate: 1.0`, `fiat_rate: null` and `free_users_allowed: true`. Their labels used snake_case values such as `age: "middle_aged"`, `use_case: "narrative_story"`, `descriptive: "classy"` and `accent: "latin american"`. There was also `locale: "es-AR"`.
- `verified_languages` contained **many internal or experimental `model_id` values**: `eleven_v4_exp`, `eleven_v4_hq`, `eleven_v4_post_trained`, `eleven_v4_eval`, `eleven_v4_turbo_exp`, `eleven_multilingual_v2_exp`, `test_m2` and `eleven_v2_5_flash`, next to real ones (`eleven_v4`, `eleven_v4_turbo`, `eleven_multilingual_v2`, `eleven_flash_v2_5`, `eleven_turbo_v2_5`, `eleven_multilingual_sts_v2`). **Our sync must keep only model ids on an allowlist.**
- A single voice listed verified entries in many languages (es, el, hi, no, ta, hr, ms, ro, ar, it, tr, en, de, pt), each with an accent such as `es-mexican`, `pt-brazilian` or `ar-levantine`.
- *(Added during verification; probe re-run on 2026-10-12.)* **Eleven v4 coverage in `verified_languages` is partial.** Of the same three top trending Spanish voices, only one (`YqZLNYWZm98oKaaLZkUA`) listed `eleven_v4` and `eleven_v4_turbo`. The other two listed only v2-generation ids (`eleven_multilingual_v2`, `eleven_flash_v2_5`, `eleven_turbo_v2_5`, …). If the curation rule requires "verified on v4", the candidate pool shrinks a lot. Treat a missing v4 entry as "not verified", not as "unsupported", and judge by ear. The re-run also returned the deprecated `eleven_turbo_v2_5` id (see §11) [verified: live probe].

### 4.2 `POST /v1/voices/add/{public_user_id}/{voice_id}`: add to our account

- Body: `new_name` (required, our display name inside ElevenLabs) and `bookmarked` (bool, default true). Response: `{voice_id}` [verified: https://elevenlabs.io/docs/api-reference/voices/voice-library/share].
- After adding, the voice shows in `/v2/voices` with `voice_type=community` ("library copies"). Its `sharing.status` is `copied`, and `original_voice_id` and `public_owner_id` are filled [verified: https://elevenlabs.io/docs/api-reference/voices/search].
- **Does the returned `voice_id` equal the library `voice_id`?** The docs do not say. Their examples use different placeholder ids. The existence of `original_voice_id` hints that it can differ. **[unverified]** Store both ids.

### 4.3 Who can use library voices, and what it costs

| Question | Answer | Confidence |
|---|---|---|
| Usable via API on the **free** tier? | **No.** "Voice Library voices are not available via the API to free tier users." | [verified: https://elevenlabs.io/docs/overview/capabilities/voices] [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-library] |
| Do added library voices use **custom voice slots**? | **No.** "Custom voice slots are only used for voices you create with Voice Design or Voice Cloning." | [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-library] [verified: https://elevenlabs.io/docs/overview/administration/billing] [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-delete-voices-from-my-voices] |
| Do **premade/Default** voices count? | **No.** "Default and Legacy voices cannot be deleted, but these voices do not take up your custom voice slots." | [verified: https://elevenlabs.io/docs/help-center/account/general/how-many-voice-slots-do-i-get-per-tier-and-how-can-i-increase-it] |
| Does adding a voice use the monthly **voice add/edit quota**? | "Adding and editing voices are voice operations": Free 55, Starter 65, Creator 95, Pro 290, Scale 1,040, Business 1,040, Enterprise unlimited. It is likely that adding a *shared* voice counts too. | [verified: same page] [verified: https://elevenlabs.io/docs/help-center/account/general/is-there-a-limit-on-how-many-times-i-can-edit-add-voices]; shared-add counting is [unverified] |
| **Extra cost** per voice? | Some voices carry a **credit multiplier**, a legacy "custom rate" feature that is closed to newly shared voices. Example: a 2x multiplier costs twice the credits. It is shown as `rate` and `fiat_rate`. Filter with `include_custom_rates=false`. | [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-are-custom-rates-and-credit-multipliers] [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/why-cant-i-use-some-voices-from-the-voice-library] |
| Gated voices | An owner can **exclude free users**. This affects only *new* additions. | [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-share-a-voice] |
| Commercial use | All paid plans include a commercial license, unless Beta Services are used. The free plan does not, and needs attribution. | [verified: https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform] |
| Library-specific terms | The Voice Library Addendum (last updated 6 March 2026) leaves user rights to the Terms of Service. It does **not** say whether a third-party app may let *its* end users pick library voices. The page text was re-read during verification: the date, the notice-period terms and the Live Moderation terms all match. | [verified: https://elevenlabs.io/vla] |

### 4.4 Can a library voice be used by `voice_id` without adding it to My Voices?

- **Web UI: yes.** "You can use voices from the Voice Library directly without saving them to My Voices. When you use a voice, the notice period will be saved for your account…" [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-library]
- **API: not documented.**
  - The TTS reference only says the path `voice_id` is "the ID of the voice to be used" [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert].
  - The API pricing FAQ says "You can reference any voice in your library by ID, including professional voices, cloned voices, and voices you've designed". This was re-read from the page HTML during verification. "Your library" most naturally means My Voices, so it does not settle the question [verified: https://elevenlabs.io/pricing/api].
  - *(Added during verification.)* The Voice Library Addendum keeps notice-period access only for users who **added** the voice before it was removed [verified: https://elevenlabs.io/vla]. The help article grants the same protection to users who "used it previously" [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-a-notice-period]. Adding the voice satisfies both readings.
  - A LiveKit staff member (March 2026) said a library PVC is not available "to paid users unless they add it to their library" [secondary: https://community.livekit.io/t/new-default-elevenlabs-voices/459].
  - Vapi and Retell support threads give the same advice to add the voice first [secondary: https://support.vapi.ai/t/26977579/voice-not-found] [secondary: https://community.retellai.com/t/when-adding-a-voice-resource-not-found/728].
- **Recommendation.** **Always add** curated voices through `POST /v1/voices/add/...`. It costs no slot and makes the notice-period protection explicit. Run one authenticated staging test (TTS on an un-added library id) to settle this. It is listed in §14.

### 4.5 When a library voice is removed (owner stops sharing)

- **Notice period.** The owner picks 30 days to 2 years, or none. "If no notice period is set, their voice will be removed immediately … and anyone who has saved the voice will immediately lose access." With a notice period, the voice leaves the Library listing at once but "will remain available for the duration of the notice period for users who saved or used it previously." Users get email and in-app notices [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-a-notice-period].
  - The older help-center site is reported (by a search summary) to say the minimum is **3 months** [secondary: https://help.elevenlabs.io/hc/en-us/articles/33533163659921-What-is-a-notice-period]. That page returned 403 to us. Use the docs value of 30 days and curate at ≥ 365 days anyway.
- **Owners cannot shorten** a notice period, only lengthen it. Outputs made before the end stay usable [verified: https://elevenlabs.io/vla].
- **API signals:**
  - `sharing.disable_at_unix` on `GET /v1/voices/{voice_id}`. It is null or absent when no removal is pending [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-a-notice-period].
  - Webhooks: `voice_removal_notice` (a shared voice is scheduled for removal), `voice_removal_notice_withdrawn`, and `voice_removed` ("no longer useable") [verified: https://elevenlabs.io/docs/eleven-api/resources/webhooks].
  - Workspace webhook subscriptions accept `events: ["voice_library_removal_notice", …]` (since 2026-07-20) [verified: https://elevenlabs.io/docs/api-reference/webhooks/update] [verified: https://elevenlabs.io/docs/changelog/2026/7/20].
  - Webhooks are HMAC-signed (`ElevenLabs-Signature` header; the SDKs provide `construct_event` / `constructEvent`). Retries are off by default; when on, there are up to 5 attempts. **Corrected during verification:** the page says retries "are supported for ElevenAgents post-call webhooks" (`post_call_transcription`, `post_call_audio`, `call_initiation_failure`). It does **not** list the voice-removal events, so assume a failed `voice_removal_notice` delivery is **not retried**. The daily health check (Job B, §12.3) is therefore required, not optional. A webhook is auto-disabled after 10 or more consecutive failures when the last success was over 7 days ago (or never happened). **Handlers must be idempotent** [verified: https://elevenlabs.io/docs/eleven-api/resources/webhooks].
- **Do not delete a removed voice in haste.** "If you remove a voice that has been removed from the Voice Library, you will not be able to save it to My Voices again in the future." [verified: https://elevenlabs.io/docs/help-center/account/general/how-many-voice-slots-do-i-get-per-tier-and-how-can-i-increase-it]
- **Hedge.** Voice Remix accepts "Voice Library voices with an **infinite notice period**". Remixing such a voice creates an *owned* variant, which uses a slot but cannot be withdrawn by the owner [verified: https://elevenlabs.io/docs/overview/capabilities/voice-remixing]. **Docs conflict (added during verification):** the TTS playground guide says "you can't remix voices from the Voice Library; you can only remix voices that you have created yourself or the default voices" [verified: https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech]. The Voices overview also lists only owned IVC, PVC and Voice Design voices as remix inputs [verified: https://elevenlabs.io/docs/overview/capabilities/voices]. Test this before relying on the hedge. How an "infinite" notice period is represented in the API is **[unverified]**: the documented maximum is 2 years and the probe showed `730`. Check `sharing.voice_mixing_allowed` too.

### 4.6 Live Moderation

Owners may turn on Live Moderation. Requests using that voice are then checked against prohibited text categories, which "may result in extra latency" [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-live-moderation]. The VLA adds that these tools are "not guaranteed", and that a change applies only to users who add the voice afterwards [verified: https://elevenlabs.io/vla].

For a **roleplay** app, moderated voices raise two risks. They add latency to realtime calls, and they may block legitimate dark-fantasy prose. **Curate with `include_live_moderated=false`** by default. Allow moderated voices only for narration if needed.

### 4.7 Discovery features worth using in the admin browser

- **Handpicked collections, Trending, Latest, Most users and Character usage sorts**, plus filters for language, accent, category, gender, age, notice period, live moderation and **Quality = Studio Quality** [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-library].
- **Search by audio** ("drag and drop an audio file"). In the API this is `POST /v1/similar-voices` (§3.2) [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/how-can-i-identify-the-voice-used-to-generate-audio].
- Library **naming convention**: "Name - Trait, Trait" (≤ 40 characters) [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-share-a-voice]. Our catalog should keep its own `display_name` and treat the provider name as source data.
- **Children's and child-like voices cannot be in the Library** [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/can-childrens-or-child-like-voices-be-added-to-the-voice-library]. Child characters in roleplay will need Voice Design, which carries its own policy risk (§10).

---

## 5. Instant Voice Cloning (IVC)

**API: `POST /v1/voices/add`** (multipart) [verified: https://elevenlabs.io/docs/api-reference/voices/ivc/create]

| Field | Notes |
|---|---|
| `name` | Required. |
| `files` | Required. Audio recordings, sent as repeated `files` multipart parts. The reference names the field `files`, not `files[]` (corrected during verification). |
| `remove_background_noise` | Bool. Uses the isolation model. "If the samples do not include background noise, it can make the quality worse." |
| `description` | Optional. |
| `labels` | Keys limited to `language`, `accent`, `gender`, `age`. |
| **Response** | `{voice_id, requires_verification}`. |

**Editing:** `POST /v1/voices/{voice_id}/edit` (multipart) takes `name` (required), `files` (adds samples), `remove_background_noise`, `description`, `labels`, and `moderate_metadata` (feature-flagged LLM moderation of name and description) [verified: https://elevenlabs.io/docs/api-reference/voices/update]. Sample endpoints are `GET /v1/voices/{voice_id}/samples/{sample_id}/audio` and `DELETE /v1/voices/{voice_id}/samples/{sample_id}` [verified: https://elevenlabs.io/docs/api-reference/voices/samples/get] [verified: https://elevenlabs.io/docs/api-reference/voices/samples/delete].

**Plan.** Starter and above. "Cloning is only available on the Starter tier and above." [verified: https://elevenlabs.io/docs/overview/administration/billing]

**Audio requirements and best practices**

| Topic | Guidance | Source |
|---|---|---|
| Length | About **1–2 minutes** of clean audio. More than 3 minutes "will yield little improvement and can … be detrimental". | [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning] |
| Count | "The number of samples is irrelevant; what's important is the total run time." | same |
| Format | **MP3 at 192 kbps or higher** recommended. WAV "usually do not improve clone quality, and … can cause problems with the upload process". *(Nuance added during verification.)* The IVC guide is looser: "MP3 at 128 kbps and above is advised. Higher bitrates don't have a significant impact on the quality of the clone." Accept ≥ 128 kbps and recommend 192 kbps. | [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/what-files-do-you-accept-for-voice-cloning] [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning] |
| Levels | −23 to −18 dB RMS, true peak −3 dB. | [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning] |
| Consistency | One speaker and one performance style. The model "will attempt to mimic everything it hears", including noise, breaths and mouth clicks. | same |
| Accents | IVC "may struggle with uncommon accents". You "cannot change the accent or tone of a clone after it is created". | same (FAQ) |
| Eleven v4 | IVC accuracy is "significantly" upgraded on v4. v4 reproduces source flaws faithfully, so recording quality "matters more than ever". | [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4] |
| File size and count limits | **Not documented** in the API reference. A third-party guide claims 100 MB per file for the web UI. | [secondary: https://aiproductivity.ai/guides/elevenlabs-voice-cloning-tutorial/]. Keep our own cap; today it is 20 MB, at `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:50`. |
| Export | Clones cannot be exported. **Keep the original samples** if you want to recreate a clone later. | [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning] (FAQ) |

**How IVC works:** few-shot conditioning at inference time. There is no training step, the clone is available at once, it generalizes less well across speech styles, and the reference audio sets the quality ceiling [verified: https://elevenlabs.io/docs/eleven-api/concepts/voice-cloning].

**Consent and verification**
- In the UI you must "confirm that you have the right and consent to clone the voice" [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning].
- "Both IVC and PVC include a voice verification step … voice-captcha technology" [verified: https://elevenlabs.io/docs/eleven-api/concepts/voice-cloning]. The API returns `requires_verification`, and voices carry `voice_verification` and `safety_control` (`CAPTCHA`, `BAN`, …) [verified: https://elevenlabs.io/docs/api-reference/voices/search]. **The API reference does not say when an IVC requires verification, or how to complete it via API.** PVC has CAPTCHA endpoints; IVC does not appear to have any. **[unverified]** Handle `requires_verification=true` by marking the voice `blocked_verification` and showing the admin a "complete in ElevenLabs dashboard" instruction.
- The **no-go voices** safeguard blocks clones that "approximate the voices of prominent public figures"; such voices are "blocked and are no longer usable" [verified: https://elevenlabs.io/docs/help-center/legal/what-are-no-go-voices].
- Sharing: IVCs can only be shared inside the workspace, never to the Library [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-share-a-voice].
- Zero-retention mode does not apply to IVC or PVC samples ("Voice cloning requires storing the clone") [verified: https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode].

**How MiniMax clone options map to IVC**

| MiniMax (today) | ElevenLabs IVC |
|---|---|
| Upload a file to get `file_id`, then `voice_clone` with our own `voice_id` | One multipart call. **ElevenLabs assigns** `voice_id`. |
| `need_noise_reduction` | `remove_background_noise` |
| `need_volume_normalization` | None. Normalize before upload (−23 to −18 dB RMS). |
| `clone_prompt` (≤ 8 s prompt audio plus transcript) | None. Quality comes from 1–2 minutes of consistent audio. |
| Preview `text` plus `model` → demo URL | None. Run one TTS call after creation and store it as the catalog preview (§12.4). |
| 10 s–5 min duration check (`/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/constants.ts:20-21`) | Recommend 60–180 s. Warn above 3 minutes. |
| Clone deleted after 7 days if unused (MiniMax) | No such auto-deletion is documented for ElevenLabs **[unverified]**. The voice stays until deleted, but uses a slot. |

---

## 6. Professional Voice Cloning (PVC)

| Aspect | Fact | Source |
|---|---|---|
| Plan | Creator or above. PVC slots: Creator, Pro and legacy Scale have **1**; Scale and legacy Business have **3**; Business has **10**; Enterprise is custom. Extra slots can be earned when shared PVCs are rated Studio Quality. | [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/how-many-professional-voice-clones-pv-cs-can-i-have] |
| Whose voice | **Only your own.** "Even with their consent, you cannot clone someone else's voice." A voice actor must create and verify the PVC in *their* account, then share it with us by link or Library. | [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/can-i-create-a-professional-voice-clone-of-someone-elses-voice] |
| Audio | Minimum 30 minutes; ideally 2–3 hours; one style; no singing; split into ~30-minute files. | [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/professional-voice-cloning] |
| API flow | `POST /v1/voices/pvc` (`name`, `language` required, `description`, `labels`) → `POST /v1/voices/pvc/{voice_id}/samples` (multipart `files`, `remove_background_noise`) → optional speaker separation (`POST …/samples/{sample_id}/separate-speakers`, then status and audio endpoints) → verification (`GET` and `POST /v1/voices/pvc/{voice_id}/captcha` with a `recording`, or manual `POST /v1/voices/pvc/{voice_id}/verification` with documents) → `POST /v1/voices/pvc/{voice_id}/train` (optional `model_id`). | [verified: https://elevenlabs.io/docs/api-reference/voices/pvc/create] [verified: https://elevenlabs.io/docs/api-reference/voices/pvc/samples/create] [verified: https://elevenlabs.io/docs/api-reference/voices/pvc/train] [verified: https://elevenlabs.io/docs/api-reference/voices/pvc/verification/captcha/verify] [verified: https://elevenlabs.io/docs/api-reference/voices/pvc/verification/request] [verified: https://elevenlabs.io/docs/api-reference/voices/pvc/samples/separate-speakers] |
| Training time | Docs say "usually 3–6 hours", but another help page says the fine-tuning step "can take between 6-24 hours". Plan for up to a day. | [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/when-will-my-professional-voice-clone-pvc-be-ready] [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/what-does-the-status-of-my-professional-voice-clone-mean] |
| Models | Trains automatically on Flash v2.5, Turbo v2.5 and Multilingual v2 (plus Flash v2 and Turbo v2 for English). Other models are opt-in per model. **v4 support was "rolling out to everyone"** at the time of reading. | [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/how-do-i-add-or-upgrade-the-models-used-to-train-my-professional-voice-clone] [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4] |
| States | `fine_tuning.state` per model: `not_started`, `queued`, `fine_tuning`, `fine_tuned`, `failed`, `delayed`. **Unverified** PVCs "cannot be deleted" without support. *(Corrected during verification: the help page names only unverified PVCs, not drafts.)* | [verified: https://elevenlabs.io/docs/api-reference/voices/search] [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-delete-voices-from-my-voices] |
| Languages | All Eleven v4 languages (90+). | [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/what-languages-are-supported-with-professional-voice-cloning-pvc] |
| v3 caveat | PVCs are "not fully optimized for Eleven v3". Prefer v4 for PVCs and Library voices. | [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices] |
| Text to Dialogue | `use_pvc_as_ivc` uses the IVC version of a PVC, which "may improve expressiveness and reduce latency". | [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert] |
| Downgrade | A PVC stays but cannot be used below Creator. Voices above the slot count become inaccessible until an upgrade. | [verified: https://elevenlabs.io/docs/help-center/account/general/what-happens-to-my-cloned-voices-when-i-downgrade-the-tier] |

**For magic-worlds:** PVC is **out of scope** for the admin console. The one valid use is a commissioned voice actor who builds a PVC in their own account and shares it with us. Shared by link, it lands in our account as a "community"-type copy and flows through the same curation path as a library voice.

---

## 7. Voice Design and Voice Remix

### 7.1 `POST /v1/text-to-voice/design`: generate previews

Source: [verified: https://elevenlabs.io/docs/api-reference/text-to-voice/design].

| Field | Notes |
|---|---|
| `voice_description` | Required. 20–1,000 characters [verified: https://elevenlabs.io/docs/overview/capabilities/voices]. |
| `model_id` | `eleven_multilingual_ttv_v2` (default) or `eleven_ttv_v3`. The v3 design model launched 2025-06-30 [verified: https://elevenlabs.io/docs/changelog/2025/6/30]. **Use `eleven_ttv_v3`.** |
| `text` | 100–1,000 characters, or set `auto_generate_text: true`. Auto-generated text "include[s] relevant audio tags" [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-design/how-much-does-voice-design-cost]. |
| `loudness` | −1 to 1; 0 ≈ −24 LUFS; default 0.5. It affects the saved voice too. |
| `seed` | Same seed and inputs give the same voice. Use it for reproducible admin work. |
| `guidance_scale` | Default 5. Higher means stricter prompt adherence but can sound robotic; use lower values for long prompts. |
| `quality` | Higher means better output and less variety. |
| `should_enhance` | An LLM expands short prompts. |
| `reference_audio_base64` + `prompt_strength` | **`eleven_ttv_v3` only.** Design from a reference clip; `prompt_strength` 0 means the reference dominates, 1 means the prompt dominates. |
| `stream_previews` | Returns only ids. Stream each with `GET /v1/text-to-voice/{generated_voice_id}/stream` [verified: https://elevenlabs.io/docs/api-reference/text-to-voice/stream]. |
| `remixing_session_id`, `remixing_session_iteration_id` | Iteration bookkeeping. |
| `output_format` (query) | `mp3_*`, `pcm_*`, `ulaw_8000`, `alaw_8000`, `opus_48000_*`. 192 kbps MP3 needs Creator+; 44.1 kHz PCM needs Pro+. |
| **Response** | `{previews: [{audio_base_64, generated_voice_id, media_type, duration_secs, language}], text}`. Three previews per call [verified: https://elevenlabs.io/docs/overview/capabilities/voices]. |

**`POST /v1/text-to-voice`: save a preview as a voice.** Fields: `voice_name`, `voice_description` (both required), `generated_voice_id` (required), `labels`, and `played_not_selected_voice_ids` ("Used for RLHF"). It returns a full voice object [verified: https://elevenlabs.io/docs/api-reference/text-to-voice/create]. Saving **uses one custom voice slot** [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-design].

**Deprecated or removed endpoints to avoid:**
- `POST /v1/text-to-voice/create-previews` was deprecated on 2026-05-13 [verified: https://elevenlabs.io/docs/changelog/2026/5/13].
- `/v1/text-to-voice/create-voice-from-preview` and `/v1/text-to-voice/remixing-sessions/*` were removed [verified: https://elevenlabs.io/docs/changelog/2025/7/28].
- The legacy `/v1/voice-generation/*` endpoints were removed [verified: https://elevenlabs.io/docs/changelog/2026/2/23].

**Cost.** You are charged only for the characters of the preview text, once per call, even though you get three previews [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-design] [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-design/how-much-does-voice-design-cost].

**How long does `generated_voice_id` stay valid?** Not documented **[unverified]**. Save in the same admin session, and keep the returned `audio_base_64` as our preview asset.

**Prompting guide, condensed** [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-design]
- Recommended template:
  `Native <Language>. <Gender>, <Age range>. <Quality level>. Persona: <2–5 words>. Emotion: <2–3 adjectives>. <1–2 sentences about timbre, pacing, delivery>`
- State the language and dialect in the first sentence. Avoid FX words such as "reverb", "echo", "phone" or "tape". Do not say "accent" when you mean intonation. "Thick" works better than "strong" for accents.
- Quality phrases: "Ok/Good/Very good/Excellent/Studio/Broadcast quality" and "perfect audio quality". These can lower prompt accuracy for niche voices.
- Fantasy works: "An elf with a proper thick British accent… regal and lyrical"; "A goblin with a raspy Eastern European accent"; and examples such as "Evil Ogre" (guidance ≈ 30%) and "Angry Pirate".
- The preview text should **match** the persona. Longer text is more stable.
- Voice Design is "still experimental"; PVCs give the highest consistency. Designed voices work on v4 "but may not be as performative" as on earlier models [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-design/what-is-voice-design] [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4].

### 7.2 Voice Remix: `POST /v1/text-to-voice/{voice_id}/remix`

Source: [verified: https://elevenlabs.io/docs/api-reference/text-to-voice/remix] [verified: https://elevenlabs.io/docs/overview/capabilities/voice-remixing].

- Body: `voice_description` (the *changes*, for example "make him older and raspier"), `text` (100–1,000 characters) or `auto_generate_text`, `loudness`, `seed`, `guidance_scale` (default **2**), `prompt_strength` (ttv_v3 only), `stream_previews`, and the session ids.
- Returns previews with `generated_voice_id`, which are saved through `POST /v1/text-to-voice` like a design.
- Eligible inputs: voices you own (IVC, PVC, designed), and "**Voice Library voices with an infinite notice period**". The original is never modified, and remixes can be remixed again with no limit. Prompt strength runs Low, Medium, High, Max. Pricing is based on the length of the test script. The output is "full-quality voice model in v3 (but backwards compatibility to all other models)".
- Quality: remixes "will be closer to that of an Instant Voice Clone" [verified: https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech].
- **Use in magic-worlds.** Remix replaces MiniMax `pitch` and timbre hacks. Admins create *variants* ("Old Mentor – gruff") as first-class catalog voices instead of keeping per-user pitch offsets.

---

## 8. Voice management, sharing, slots and quotas

### 8.1 Endpoints

| Action | Endpoint | Notes | Source |
|---|---|---|---|
| Delete | `DELETE /v1/voices/{voice_id}` | Permanent. Shared voices must stop sharing first. Unverified PVCs cannot be deleted without support (corrected during verification: drafts are not named). | [verified: https://elevenlabs.io/docs/api-reference/voices/delete] [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-delete-voices-from-my-voices] |
| Edit metadata or samples | `POST /v1/voices/{voice_id}/edit` | Multipart; `name` required. | [verified: https://elevenlabs.io/docs/api-reference/voices/update] |
| Stored default settings | `GET /v1/voices/{voice_id}/settings`, `POST …/settings/edit` | `stability`, `similarity_boost`, `style`, `speed`, `use_speaker_boost`. Prefer **sending explicit `voice_settings` per request**, so behavior does not depend on account-side state. | [verified: https://elevenlabs.io/docs/api-reference/voices/settings/update] |
| Workspace sharing | `POST /v1/workspace/resources/{resource_id}/share` with `resource_type: "voice"`, `role` (`admin`, `editor`, `commenter`, `viewer`), and one of `user_email`, `group_id` (`default` sets the baseline role) or `workspace_api_key_id` (service account). Also `GET` and `unshare` on the same path. | Needed only with several service accounts or seats. | [verified: https://elevenlabs.io/docs/api-reference/workspace/resources/share] [verified: https://elevenlabs.io/docs/api-reference/workspace/resources/get] |
| Disable external sharing | Workspace groups can disable external sharing and Library publishing (2025-10-27). | | [verified: https://elevenlabs.io/docs/changelog/2025/10/27] |
| Replicate across residency | `POST /v1/voices/{voice_id}/replicate-to-isolated-environment` (`target_workspace_id`, `preserve_voice_id`=true). IVC and Voice Design voices only, within one consolidated billing group. | Useful if we ever run EU/US workspaces. | [verified: https://elevenlabs.io/docs/api-reference/voices/replicate-to-isolated-environment] [verified: https://elevenlabs.io/docs/changelog/2026/8/3] |
| Collections | §3.2 | Can mirror "curated" in the dashboard. | |
| Publish to Library | Dashboard only. PVC only, with human review. | Not relevant. | [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-share-a-voice] |

**API key scopes.** "By default, API keys are restricted." Voices need **Voices (read)**, and synthesis needs **Text to Speech** [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/why-cant-i-access-my-voices-via-third-party-services]. Use **two keys or service accounts**:
- a *runtime* key with TTS and Voices read;
- an *admin* key with Voices write and Voice Design.

Service-account keys support a monthly `character_limit`. The 2026-06-15 entry shows it as an editable key field, and the 2026-07-20 entry adds `"clear"` to remove it [verified: https://elevenlabs.io/docs/changelog/2026/6/15] [verified: https://elevenlabs.io/docs/changelog/2026/7/20]. That gives a hard spend cap on the admin key.

### 8.2 Slots, quotas and plan limits

| Plan | Custom voice slots | Voice add/edit ops per month | PVC slots | IVC | Concurrency (pricing page) |
|---|---|---|---|---|---|
| Free | 3 | 55 | 0 | No | 2 |
| Starter | 10 | 65 | 0 | Yes | 3 |
| Creator | 30 | 95 | 1 | Yes | 5 |
| Pro | 160 | 290 | 1 | Yes | 10 |
| Scale | 660 | 1,040 | 3 | Yes | 15 |
| Business | **660 (help center) vs 2,200 (pricing page)** | 1,040 | 10 | Yes | 25 |
| Enterprise | custom | unlimited | custom | Yes | elevated |

Sources:
- Slots and ops: [verified: https://elevenlabs.io/docs/help-center/account/general/how-many-voice-slots-do-i-get-per-tier-and-how-can-i-increase-it] [verified: https://elevenlabs.io/docs/help-center/account/general/is-there-a-limit-on-how-many-times-i-can-edit-add-voices]
- PVC slots: [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/how-many-professional-voice-clones-pv-cs-can-i-have]
- Business 2,200 slots, concurrency and IVC: [verified: https://elevenlabs.io/pricing]. This was re-read from the page HTML during verification. The comparison table gives custom voice slots of 3 / 10 / 30 / 160 / 660 / **2,200**, PVC of – / – / 1 / 1 / 3 / 10 and concurrency of 2 / 3 / 5 / 10 / 15 / 25 (Free → Business). The help center still says Business has 660. The conflict is real; see §14.
- *(Added during verification.)* Plan prices on 2026-10-12: Starter $6, Creator $22, Pro $99, Scale $299, Business $990 per month. The billing guide now separates "legacy" Creator, Pro, Scale and Business plans from current ones, so a legacy subscription can have different slot and PVC counts. For example, legacy Scale has 1 PVC slot and legacy Business has 3 [verified: https://elevenlabs.io/pricing] [verified: https://elevenlabs.io/docs/overview/administration/billing] [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/how-many-professional-voice-clones-pv-cs-can-i-have]. This is one more reason to read limits from `/v1/user/subscription`.

**Read limits from the API rather than hard-coding them.** `GET /v1/user/subscription` returns `voice_slots_used`, `voice_limit`, `voice_add_edit_counter`, `max_voice_add_edits`, `professional_voice_slots_used`, `professional_voice_limit`, `can_use_instant_voice_cloning`, `can_use_professional_voice_cloning` and `can_extend_voice_limit` [verified: https://elevenlabs.io/docs/api-reference/user/subscription/get].

**Pricing context.** On 2026-10-12 the API pricing page showed per-1k-character prices: v4 $0.022 and v4 Turbo $0.011, marked "72% off **until Oct 12**" (list $0.08 and $0.04); v3 and Multilingual v2 $0.08; **v3 Conversational $0.04** (added during verification); Flash/Turbo $0.04 [verified: https://elevenlabs.io/pricing/api]. This was re-read from the page HTML during verification. The same FAQ says "API usage is billed in US dollars, not credits". The promotion ends **today**. Re-check pricing before budgeting. Detailed pricing is out of scope for this file.

---

## 9. Voice previews

### 9.1 What the docs say

- Each voice object has `preview_url`. `verified_languages[]` entries add a per-language `preview_url` [verified: https://elevenlabs.io/docs/api-reference/voices/search].
- In the Library UI: "If a voice has multiple previews for different languages, you can select the language you want to preview" [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-library].
- Owners of shared PVCs can set a **custom preview** from a 70–150 character generation [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/how-do-i-add-a-custom-preview-for-my-shared-voice]. Preview content is owner-controlled and can change.
- The docs say **nothing** about hotlinking, CDN guarantees or URL lifetime. **[unverified]**

### 9.2 What the live probe showed

Requests:
- `GET https://api.elevenlabs.io/v1/shared-voices?page_size=3&language=es&sort=trending`, unauthenticated, then `HEAD` and `GET` of the returned URLs.
- `HEAD` of the example URL from the API reference.

[verified: live probe] There are **two URL shapes**:

| Shape | Example host and path | Observed headers |
|---|---|---|
| Static GCS object | `https://storage.googleapis.com/eleven-public-prod/database/workspace/<ws>/voices/<voice_id>/<file>.mp3` (the docs example uses `…/eleven-public-prod/<uid>/voices/<voice_id>/<uuid>.mp3`) | `200`, `cache-control: public, max-age=3600`, ETag present. **Corrected during verification (re-probed with `GET` and an `Origin` header):** the `content-type` **varies per object**. The docs-example object is `text/plain`, while the trending library voice's object is `audio/mpeg`. Both returned `access-control-allow-origin: *` on a `GET` with a foreign Origin. The original "no CORS header" finding does not hold. |
| API preview endpoint | `https://api.us.elevenlabs.io/v1/voices/<voice_id>/previews/audio?payload=<base64 JSON>` | `GET`: `200`, `content-type: audio/mpeg`, `access-control-allow-origin: *`. `HEAD` returns **405** (added during verification), so availability checks must use `GET` (or a ranged `GET`). |

- The `payload` decodes to `{"voice_source":"custom","workspace_id":"…","filename":"….mp3","timestamp":1791799200000000}`. That timestamp is **2026-10-12 10:00:00 UTC**, which suggests a **time-bucketed URL**. Its lifetime is **unknown** **[unverified]**. Treat `preview_url` values as **ephemeral**: never store them in snapshots, and refresh them on every sync.
- Some GCS objects come back as `text/plain`, while others come back as `audio/mpeg`. A plain `<audio src>` copes with either, but MIME sniffing of `text/plain` is browser-dependent. CORS headers were present on `GET` during re-verification. Header behavior is clearly not uniform, so do not depend on it (corrected during verification). There is no CSP in this repo today (no `Content-Security-Policy` in `/home/andres/WebstormProjects/magic-worlds/index.html`), so hotlinking would technically work.

### 9.3 Recommendation

**Download previews server-side during sync** into our own storage. Use the same storage root and pattern as `tts_asset`. Serve them from the BFF with `Content-Type: audio/mpeg` and long caching keyed by a content hash. Benefits:
- previews survive URL rotation and stay playable during a notice period;
- we do not depend on ElevenLabs' CDN behavior;
- playback is free;
- users' IPs and referrers do not leak to Google Cloud Storage.

Whether ToS allows caching provider preview audio is **[unverified]**. It is ElevenLabs-served marketing audio for the voice, and we show it only to illustrate that voice. Confirm with ElevenLabs if you are unsure (§14).

---

## 10. Moderation, safety and policy

| Topic | Rule | Source |
|---|---|---|
| Consent for cloning | IVC: you must confirm rights and consent. PVC: your own voice only, with voice CAPTCHA. Verification "cannot guarantee" ownership, and responsibility stays with the creator. | [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning] [verified: https://elevenlabs.io/docs/eleven-api/concepts/voice-cloning] |
| No-go voices | Clones that approximate prominent public figures are blocked and become unusable. | [verified: https://elevenlabs.io/docs/help-center/legal/what-are-no-go-voices] |
| Prohibited use | The Prohibited Use Policy and Terms apply to all generation. Evading guardrails (such as the verification CAPTCHA) can lead to a ban. | [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/can-i-share-an-ai-generated-voice-in-the-voice-library] |
| Traceability | "All audio generated by our models can be instantly traced back to the user responsible for the generation." Every user's generation is attributed to **our** account, so we must keep our own per-user audit trail. | [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning] (FAQ) |
| Watermarking | ElevenLabs embeds imperceptible watermarks, with "no audible quality degradation" and "zero latency in nearly all cases". The **Audio Detector** checks for the watermark first and then falls back to the legacy **AI Speech Classifier**. Third-party models served through ElevenLabs are generally not watermarked. | [verified: https://elevenlabs.io/docs/help-center/legal/audio-detector/what-is-watermarking-and-why-is-eleven-labs-using-it] [verified: https://elevenlabs.io/docs/eleven-creative/audio-tools/audio-detector] [verified: https://elevenlabs.io/docs/help-center/legal/audio-detector/does-watermarking-affect-my-audio-quality-or-add-latency-to-my-generations] |
| Live moderation | Opt-in by the voice owner. Adds latency. Not guaranteed. | §4.6 |
| Children's voices | Not allowed in the Library. Voice Design of child voices is not explicitly banned in the pages we read, but carries a high policy risk under the Prohibited Use Policy. **Our recommendation:** no child-voice designs in the public catalog. | [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/can-childrens-or-child-like-voices-be-added-to-the-voice-library] |
| Metadata moderation | `moderate_metadata` on edit runs LLM moderation on name and description (feature-flagged). | [verified: https://elevenlabs.io/docs/api-reference/voices/update] |
| Commercial | Paid plan required for commercial output. | §4.3 |

**Implications for magic-worlds**
- IVC must stay **root-only**. Each IVC needs a stored **consent record**: who, when, a document reference and the scope.
- Do not offer user-side cloning until there is a consent and verification flow, an abuse process and a legal review.
- Keep a per-user generation audit: `user_id`, `voice_key`, a hash of the text, `request_id`, and the time. Under the provider's traceability policy, abuse traces back to *our* account.

---

## 11. Model compatibility that affects the catalog

Full model coverage is in the TTS research files. This section covers only the voice and catalog consequences.

| Model | Voice settings available | Tags and pauses | Notes for catalog and recipes | Source |
|---|---|---|---|---|
| `eleven_v4` | **Stability and Similarity only**. No Style, no Speed, no SSML. | Audio tags (`[whispering]`, `[laughs]`, `[sighs]`, `[strong French accent]`…); ellipses; CAPS for emphasis; IPA written as `/…/` in the text. | 90+ languages; 10,000 characters per request. **Native accent handling**: across languages it speaks fluent target-language speech *without* carrying the voice's accent. Designed voices may be "less performative". PVC v4 support was rolling out. Available via TTS `convert`/`stream` with `model_id: eleven_v4` and via Text to Dialogue. | [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4] [verified: https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech] [verified: https://elevenlabs.io/docs/overview/models] |
| `eleven_v4_turbo` | Same as v4. | Same as v4. | Median inference latency about 100 ms; meant for realtime. **Transport caveat (added during verification):** the docs place it on the **Text to Dialogue WebSocket** (`wss://…/v1/text-to-dialogue/stream-input`), where `eleven_v4_turbo` "allows only one registered voice". The classic **TTS WebSocket** (`/v1/text-to-speech/{voice_id}/stream-input`) takes "**No** `eleven_v3` or `eleven_v4`". Whether `eleven_v4_turbo` is accepted by the HTTP `convert`/`stream` endpoints is not stated **[unverified]**. | [verified: https://elevenlabs.io/docs/overview/models] [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets] [verified: https://elevenlabs.io/docs/changelog/2026/9/28] |
| `eleven_v3` | Stability. "Similarity is not available for the Eleven v3 model"; "Speaker Boost is not available". | Audio tags; no `<break>`. | 70+ languages; 5,000 characters. PVCs are not fully optimized for it. | [verified: https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech] [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices] |
| `eleven_v3_conversational` *(added during verification)* | As v3. | Audio tags. | Low-latency v3 (about 280 ms) for the Text to Dialogue WebSocket; 70+ languages; $0.04 per 1k characters. Described as "previous generation" now that v4 Turbo exists. | [verified: https://elevenlabs.io/docs/overview/models] [verified: https://elevenlabs.io/pricing/api] |
| `eleven_multilingual_v2` | Stability, similarity_boost, style, speed (0.7–1.2), use_speaker_boost. | `<break time="x.xs"/>` up to 3 s. **No phoneme tags** (corrected during verification): "Phoneme tags are only compatible with the `eleven_flash_v2` model", and Multilingual v2 "doesn't support phoneme tags". Use **alias** rules in pronunciation dictionaries instead. | 29 languages; `language_code` is **not** supported. This is the default model when none is sent. | [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert] [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices] [verified: https://elevenlabs.io/docs/help-center/technical/why-does-my-voice-sound-different-in-the-api-compared-to-the-website] |
| `eleven_flash_v2_5` | As v2. | `<break>` as v2. **No phoneme tags**; use alias dictionaries (only `eleven_flash_v2`, English, takes phoneme tags). | 32 languages; about 75 ms; 40,000 characters. | [verified: https://elevenlabs.io/docs/overview/models] [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices] |
| `eleven_turbo_v2_5`, `eleven_turbo_v2` *(added during verification)* | — | — | **Deprecated.** Listed under "Deprecated models" as functionally equal to `eleven_flash_v2_5` / `eleven_flash_v2` with higher latency. They still appear in `verified_languages` (probe), so normalize them to the Flash id when ingesting, and never offer them. | [verified: https://elevenlabs.io/docs/overview/models] |

- Speed range: "Values below 1.0 will slow the voice down, to a minimum of 0.7… to a maximum of 1.2." [verified: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/can-i-change-the-pace-of-the-voice]. **Docs conflict (added during verification):** that help page also says speed "is available for all voices and all models", but the v4 page says "Style and Speed sliders are not available in Eleven v4" [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4]. Treat the v4 page as authoritative, and test API behavior (open question 11).
- Common starting point for v2 models: stability about 0.5, similarity about 0.75, style 0. "We recommend keeping [style] at 0 at all times." [verified: https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech]
- **Catalog consequence.** Store `supported_model_ids` (from `verified_languages[].model_id` ∩ allowlist ∪ `high_quality_base_model_ids`) and a per-language `models` list. Then the picker can show "great for narration (v4)" and "works in calls (v4 Turbo / Flash)", and the backend can refuse invalid recipe and model combinations.
- **Language consequence.** "The language is determined by the text, the accent and pronunciation is determined by the voice." [verified: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/can-i-use-the-same-cloned-designed-voice-across-languages] With v4's native accent handling, a voice's *primary* language matters less than it did for MiniMax `language_boost`. It still matters for v2 and Flash.
- **Caution.** One help page says "All pre-made voices and generated voices are English" [verified: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/which-voices-in-the-voice-library-are-native-to-a-specific-language]. That looks outdated, because Voice Design now uses a "Native <Language>" prompt. Verify each designed voice by ear.

---

## 12. Target catalog design for magic-worlds

### 12.1 (a) What the user-facing catalog contains

| Tier | Source | Count target | Curation rule |
|---|---|---|---|
| **Core library voices** | Voice Library, added to our account | 40–120 at launch, covering narrators, heroes, villains, mentors, creatures-adjacent and companions in EN and ES, then other languages on demand | `category ∈ {high_quality, professional}`; `notice_period ≥ 365` (prefer 730); `rate == 1` and `fiat_rate == null` (no custom rates); `live_moderation_enabled == false` for call-eligible voices; has `eleven_v4` and/or `eleven_v4_turbo` / `eleven_flash_v2_5` in verified models; `recording_quality ∈ {studio, good}`; names and descriptions pass our content review; no child-like voices. |
| **House voices (designed and remixed)** | Voice Design (`eleven_ttv_v3`) and Remix, created by root | 10–40, bounded by slots | Fantasy archetypes the Library lacks (ogre, ancient dragon, spectral narrator, goblin, android). Each uses one slot. |
| **Licensed clones (IVC)** | Root-only, with a consent record | 0–10 | Only voice talent under a signed release. Each uses one slot. |
| **Commissioned PVCs** | Shared to us by voice actors | Optional | Treated like library voices, but `notice_period` comes from the contract. |
| **Premade/Default** | `/v2/voices?voice_type=default` | **0 public** | Never published. They expire on 2026-12-31. Use them only for internal A/B comparison before they expire. |

Users do **not** create provider voices in v1. Per-user Design or IVC would exhaust slots (160–2,200 per *account*), raises consent issues, and needs abuse handling. Users personalize through **presets** layered on catalog voices (§12.8). A future premium feature for user-designed voices is an open product question (§14).

### 12.2 (b) DB design (MySQL, raw SQL, same conventions as `voice_preset`)

This follows the column conventions of `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:1279-1309`: `utf8mb4_bin` ids, JSON object checks, and datetime timestamps.

```sql
-- One row per provider voice the app knows about (curated or candidate).
create table voice_catalog
(
    voice_key              varchar(64)  character set utf8mb4 collate utf8mb4_bin primary key, -- our stable id (uuid)
    provider               varchar(32)  character set utf8mb4 collate utf8mb4_bin not null default 'elevenlabs',
    provider_voice_id      varchar(64)  character set utf8mb4 collate utf8mb4_bin not null,   -- id usable in TTS (the account copy)
    source                 varchar(24)  character set utf8mb4 collate utf8mb4_bin not null,   -- library|designed|remixed|ivc|pvc_shared|premade
    provider_category      varchar(24)  character set utf8mb4 collate utf8mb4_bin null,       -- premade|cloned|generated|professional|high_quality|famous
    library_voice_id       varchar(64)  character set utf8mb4 collate utf8mb4_bin null,       -- id in /v1/shared-voices (may equal provider_voice_id)
    library_public_owner_id varchar(128) character set utf8mb4 collate utf8mb4_bin null,
    parent_voice_key       varchar(64)  character set utf8mb4 collate utf8mb4_bin null,       -- remix lineage
    provider_name          varchar(255) not null,
    display_name           varchar(255) not null,                                              -- curated, i18n key optional
    description            text null,
    gender                 varchar(16)  character set utf8mb4 collate utf8mb4_bin null,       -- male|female|neutral
    age                    varchar(16)  character set utf8mb4 collate utf8mb4_bin null,       -- young|middle_aged|old
    accent                 varchar(64)  null,
    primary_language       varchar(8)   character set utf8mb4 collate utf8mb4_bin null,       -- ISO 639-1
    locale                 varchar(16)  character set utf8mb4 collate utf8mb4_bin null,
    use_case               varchar(64)  character set utf8mb4 collate utf8mb4_bin null,
    descriptive            varchar(64)  character set utf8mb4 collate utf8mb4_bin null,
    tags                   json null,                                                          -- our taxonomy: ["narrator","villain","fantasy"]
    provider_labels        json null,                                                          -- raw labels map
    supported_model_ids    json null,                                                          -- allowlisted model ids
    default_settings       json null,                                                          -- {stability, similarity_boost, style, speed, use_speaker_boost}
    preview_asset_id       varchar(64)  character set utf8mb4 collate utf8mb4_bin null,       -- our cached MP3 (default language)
    preview_source_hash    char(64)     character set utf8mb4 collate utf8mb4_bin null,       -- sha256 of downloaded bytes
    notice_period_days     int null,
    disable_at             datetime null,                                                      -- from sharing.disable_at_unix
    rate_multiplier        double null,
    fiat_rate              double null,
    live_moderation        tinyint(1) not null default 0,
    recording_quality      varchar(16)  character set utf8mb4 collate utf8mb4_bin null,
    uses_custom_slot       tinyint(1) not null default 0,                                      -- designed/remixed/ivc = 1
    status                 varchar(16)  character set utf8mb4 collate utf8mb4_bin not null default 'draft',
        -- draft|active|hidden|deprecating|removed|blocked|failed
    visibility             varchar(16)  character set utf8mb4 collate utf8mb4_bin not null default 'admin',
        -- admin|public|plan_gated
    min_plan               varchar(32)  character set utf8mb4 collate utf8mb4_bin null,
    call_eligible          tinyint(1) not null default 0,                                      -- realtime-safe (no live moderation, turbo/flash verified)
    replacement_voice_key  varchar(64)  character set utf8mb4 collate utf8mb4_bin null,
    consent_record_id      varchar(64)  character set utf8mb4 collate utf8mb4_bin null,       -- required when source='ivc'
    sort_rank              int not null default 1000,
    created_by_user_id     int null,
    provider_created_at    datetime null,
    last_synced_at         datetime null,
    last_seen_at           datetime null,                                                      -- last time sync saw it in /v2/voices
    missing_sync_count     int not null default 0,
    sync_hash              char(64) character set utf8mb4 collate utf8mb4_bin null,           -- hash of normalized provider payload
    metadata               json null,
    created_at             datetime default CURRENT_TIMESTAMP not null,
    updated_at             datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP,
    unique key uq_voice_catalog_provider (provider, provider_voice_id),
    key idx_voice_catalog_public (visibility, status, primary_language, gender, age, sort_rank),
    key idx_voice_catalog_disable (status, disable_at),
    fulltext key ftx_voice_catalog_text (display_name, description),
    constraint chk_voice_catalog_tags_array check (tags is null or json_schema_valid('{"type":"array"}', tags)),
    constraint chk_voice_catalog_settings_object check (default_settings is null or json_schema_valid('{"type":"object"}', default_settings)),
    constraint chk_voice_catalog_ivc_consent check (source <> 'ivc' or consent_record_id is not null)
) engine = InnoDB default character set = utf8mb4 collate = utf8mb4_0900_ai_ci;

-- Per-language capability and preview (normalized from verified_languages).
create table voice_catalog_language
(
    voice_key        varchar(64) character set utf8mb4 collate utf8mb4_bin not null,
    language         varchar(8)  character set utf8mb4 collate utf8mb4_bin not null,
    locale           varchar(16) character set utf8mb4 collate utf8mb4_bin null,
    accent           varchar(64) null,
    model_ids        json not null,                       -- allowlisted models verified for this language
    preview_asset_id varchar(64) character set utf8mb4 collate utf8mb4_bin null,
    primary key (voice_key, language),
    key idx_vcl_language (language, voice_key)
) engine = InnoDB default character set = utf8mb4 collate = utf8mb4_0900_ai_ci;

-- Audit / lifecycle events (sync, webhook, admin actions).
create table voice_catalog_event
(
    event_id    varchar(64) character set utf8mb4 collate utf8mb4_bin primary key,
    voice_key   varchar(64) character set utf8mb4 collate utf8mb4_bin null,
    event_type  varchar(40) character set utf8mb4 collate utf8mb4_bin not null,
        -- synced|added_from_library|designed|remixed|cloned|published|hidden|removal_notice|
        -- removal_withdrawn|removed|replaced|deleted|webhook_received|sync_missing
    actor_user_id int null,
    payload     json null,
    dedupe_key  varchar(128) character set utf8mb4 collate utf8mb4_bin null,   -- webhook idempotency
    created_at  datetime default CURRENT_TIMESTAMP not null,
    unique key uq_voice_catalog_event_dedupe (dedupe_key),
    key idx_vce_voice (voice_key, created_at)
) engine = InnoDB default character set = utf8mb4 collate = utf8mb4_0900_ai_ci;

-- Consent evidence for IVC (root-only).
create table voice_consent_record
(
    consent_record_id varchar(64) character set utf8mb4 collate utf8mb4_bin primary key,
    subject_name      varchar(255) not null,
    subject_contact   varchar(255) null,
    scope             text not null,                 -- what the voice may be used for
    document_ref      varchar(512) null,             -- storage key of signed release
    signed_at         datetime not null,
    revoked_at        datetime null,
    recorded_by_user_id int not null,
    created_at        datetime default CURRENT_TIMESTAMP not null
) engine = InnoDB default character set = utf8mb4 collate = utf8mb4_0900_ai_ci;

-- Legacy (MiniMax) voice ids -> catalog voice, used by the resolver for frozen snapshots.
create table voice_legacy_mapping
(
    provider        varchar(32) character set utf8mb4 collate utf8mb4_bin not null,  -- 'minimax'
    legacy_voice_id varchar(256) character set utf8mb4 collate utf8mb4_bin not null,
    voice_key       varchar(64) character set utf8mb4 collate utf8mb4_bin not null,
    recipe_overrides json null,                                                        -- e.g. default tags for an emotion
    primary key (provider, legacy_voice_id)
) engine = InnoDB default character set = utf8mb4 collate = utf8mb4_0900_ai_ci;
```

The `voice_preset` changes are in §12.8. The catalog is **global per deployment**, because one ElevenLabs account serves all projects. If a project needs a restricted catalog later, add a `voice_catalog_scope(voice_key, project_hash)` table rather than scoping columns.

### 12.3 (c) Sync job strategy

**Job A: account inventory sync.** Runs every 6 h, after each admin mutation, and on demand from the admin "Sync" button.
1. Page through `GET /v2/voices?page_size=100&include_total_count=false&voice_type=non-default`, following `next_page_token` until `has_more=false` [verified: https://elevenlabs.io/docs/api-reference/voices/search]. Run a separate `voice_type=default` pass only to mark premade voices as `premade` and `visibility=admin`.
2. Normalize each voice. Filter `verified_languages[].model_id` through an **allowlist** (`eleven_v4`, `eleven_v4_turbo`, `eleven_v3`, `eleven_v3_conversational`, `eleven_multilingual_v2`, `eleven_flash_v2_5`, `eleven_flash_v2`), because the live probe returned experimental ids. Map the deprecated `eleven_turbo_v2_5` → `eleven_flash_v2_5` and `eleven_turbo_v2` → `eleven_flash_v2` before filtering (added during verification; see §11). Compute `sync_hash`.
3. Upsert by `(provider, provider_voice_id)`. **New voices arrive as `status='draft'` and `visibility='admin'`.** Nothing becomes public without a human.
4. For catalog rows not seen in this run, increment `missing_sync_count`. After **2** consecutive misses, set `status='removed'` and write a `voice_catalog_event`. Never hard-delete rows: frozen snapshots reference them.
5. Update `disable_at` from `sharing.disable_at_unix`. If it is set and in the future, set `status='deprecating'` and notify root.
6. If `preview_url` changed (compare the downloaded bytes' sha256, because URLs rotate), re-download into storage. Do the same for each `verified_languages[].preview_url` of the languages we care about.

**Job B: curated health check.** Runs daily. Call `GET /v2/voices?voice_ids=<≤100 curated ids>` (batch). For any `deprecating` voice, also call `GET /v1/voices/{id}` to confirm `disable_at_unix`.

**Job C: subscription and limits.** Runs hourly or after mutations. Read `GET /v1/user/subscription` and store `voice_slots_used/voice_limit`, `voice_add_edit_counter/max_voice_add_edits` and the PVC counters, for the admin budget widget and pre-flight checks [verified: https://elevenlabs.io/docs/api-reference/user/subscription/get].

**Webhook receiver.** `POST /webhooks/elevenlabs`:
- verify the HMAC signature;
- dedupe on `(type, event_timestamp, voice id)` into `voice_catalog_event.dedupe_key`;
- handle `voice_removal_notice`, `voice_removal_notice_withdrawn` and `voice_removed` by triggering Job B for that voice;
- return 200 quickly.

Subscribe via `PATCH /v1/workspace/webhooks/{webhook_id}` with `events: ["voice_library_removal_notice"]`. The body also requires `name` and `is_disabled`, and accepts `retry_enabled`. The allowed values are `voice_library_removal_notice`, `speech_to_text`, `agent_qa` and `flows` [verified: https://elevenlabs.io/docs/eleven-api/resources/webhooks] [verified: https://elevenlabs.io/docs/api-reference/webhooks/update]. The exact payload schema for voice events was not documented on the page we read **[unverified]**. Only the generic envelope (`type`, `data`, `event_timestamp`) is documented. The handler should therefore treat the webhook as a *trigger to re-fetch*, not as the source of truth. Retries are documented only for agent post-call events (§4.5), so a missed voice webhook may never be re-sent (added during verification).

**Library discovery is not a sync.** The admin "Library browser" proxies `GET /v1/shared-voices` live, with the curated filters as defaults: `min_notice_period_days=365`, `include_custom_rates=false`, `include_live_moderated=false`, `category=high_quality`. Only voices an admin *adds* enter `voice_catalog`.

**Implementation notes**
- Run the jobs in the API process with a DB advisory lock: `GET_LOCK('voice_catalog_sync', 0)`. This is single-worker safe now and stays correct with more workers later. The baseline notes that the API is single-process today ([00_current_tts_review.md](./00_current_tts_review.md), issue 19).
- Respect `Retry-After` and back off on 429 and 5xx. This fixes the same class of bug as baseline issue 12.

### 12.4 (d) Previews without paid synthesis

| Need | Mechanism | Cost |
|---|---|---|
| "What does this voice sound like?" (picker, studio, admin) | `GET /voices/catalog/{voice_key}/preview.mp3?lang=es` → serves the cached `voice_catalog_language.preview_asset_id`, falling back to `voice_catalog.preview_asset_id`. Response: `Content-Type: audio/mpeg`, `Cache-Control: public, max-age=86400, immutable` (URL carries the content hash), authenticated but not owner-scoped. | Free |
| Preview for a **designed or remixed** voice | Keep one of the three `audio_base_64` previews from the design or remix call that produced the saved voice, and store it as the preview asset. | Already paid during design |
| Preview for an **IVC** (often no `preview_url`) | On creation, the admin flow runs **one** TTS call with a fixed per-language showcase text and stores it. | Once per voice |
| "How does *my recipe* sound?" (stability, style, tags…) | `POST /voice-presets/preview`, **metered**: quota op `voice_preview`, per-user rate limit, a fixed set of server-side preview texts per language (no free text for non-root users), and a **shared cache** keyed by `sha256(provider_voice_id, model_id, normalized settings, tag prefix, text_id, output_format)`. Identical recipes then reuse audio across users. | Paid only on cache miss |

This replaces `usePreviewVoice`, which today always synthesizes (`/home/andres/WebstormProjects/magic-worlds/src/features/voices/usePreviewVoice.ts:22-37`). It also closes baseline issue #1: the preview route has no quota today (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:99-118`).

### 12.5 (e) Filters and search UX

**Server-side** filtering on `voice_catalog`. No live provider calls per user keystroke.

| Filter | Backing column or source | Values |
|---|---|---|
| Language | `voice_catalog_language.language` (from verified languages) plus `primary_language` | ISO codes, shown localized; "native" badge when `language == primary_language` |
| Accent / locale | `voice_catalog_language.accent/locale`; names from `GET /v1/voices/accents` (cached) | For example `es-mexican` → "Mexican Spanish" |
| Gender | `gender` | male, female, neutral |
| Age | `age` | young, middle_aged, old |
| Use case | `use_case` | narrative_story, characters_animation, conversational, … |
| Character / descriptive | `descriptive` plus our `tags` | calm, classy, raspy…; and our roleplay tags: narrator, villain, mentor, creature, companion, noble, rogue |
| Works in calls | `call_eligible` | toggle |
| Model | `supported_model_ids` | hidden from users by default; used for validation |
| Text search | `FULLTEXT(display_name, description)` | |

UI building blocks:
- The `Chip`/`Select` primitives already used in `/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/SystemVoicePicker.tsx:44-86`.
- A "play preview" button per row that plays the cached MP3. It must not call synthesis.
- A "Recommended for this character" sort: match the card's gender, age, language and tags. A later idea is to use LLM-extracted traits from the character description against the `descriptive` and `tags` columns.
- Badges: "Leaving soon" (when `status='deprecating'`, showing `disable_at`); "House voice" (designed, remixed or IVC).

### 12.6 (f) Slot budgeting and lifecycle

**Budget.**
- Library voices use **0** slots. Designed, remixed and IVC voices use **1** slot each.
- Keep `uses_custom_slot` in the table and show `voice_slots_used/voice_limit` and `voice_add_edit_counter/max_voice_add_edits` from Job C.
- **Pre-flight block**: refuse design-save, remix-save or IVC when `voice_limit - voice_slots_used < 2`, keeping a safety margin. Refuse library-add or edit when the add/edit quota left is under 5.
- **Plan suggestion:** **Pro** (160 slots, 290 ops per month) is enough for a catalog of about 100 library voices plus about 40 house voices. **Scale** (660 slots, 1,040 ops) if heavy design iteration is expected. Each saved iteration is a slot, so design many previews and save few.

**Lifecycle state machine.**

```
 (admin add/design/clone)        publish            disable_at set / removal_notice
 draft ───────────────────────▶ active ───────────────────────────────▶ deprecating
   │  hide ▲ │ unhide                    │ withdrawn ◀──────────────────┘     │
   ▼       │ ▼                           │                                    │ disable_at passed /
 hidden ◀──┘ active                      │                                    │ voice_removed / 2 sync misses
                                         ▼                                    ▼
                                      blocked (safety_control BAN/CAPTCHA, requires_verification)   removed
```

**Handling a disappearing voice**
1. On `deprecating`:
   - notify root;
   - compute candidates with `POST /v1/similar-voices`, feeding it our cached preview MP3, with `top_k=10` [verified: https://elevenlabs.io/docs/api-reference/voices/find-similar-voices];
   - the admin picks `replacement_voice_key`.
2. If the voice has "infinite" notice and `voice_mixing_allowed`, the admin may **remix it into an owned house voice** as a permanent copy (§7.2).
3. On `removed`, the resolver uses `replacement_voice_key` for every reference: presets, cards and frozen snapshots. If there is none, it uses the language-default narrator voice. Log the substitution in the TTS job metadata so playback history stays truthful.
4. **Never delete** a removed library copy from the ElevenLabs account until all references are migrated. Once deleted, it cannot be re-added [verified: https://elevenlabs.io/docs/help-center/account/general/how-many-voice-slots-do-i-get-per-tier-and-how-can-i-increase-it].
5. Reference tracking: keep a `voice_reference_count` cache refreshed by a nightly scan of presets, character cards and active snapshots. Alternatively, keep a `voice_reference(voice_key, ref_type, ref_id)` table written on save. That makes it safe to say "this voice is used by N characters."

### 12.7 (g) Admin console mapping (MiniMax → ElevenLabs)

| Today (file) | ElevenLabs replacement | Notes |
|---|---|---|
| `SystemVoiceBrowser` / "system" group (`/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/VoiceLibraryPanel.tsx:107`) | **Library browser**: live `GET /v1/shared-voices` with curated default filters. An "Add to catalog" action calls `POST /v1/voices/add/{public_owner_id}/{voice_id}` (`new_name` = display name), then Job A upserts the row as `draft`. | Show `notice_period`, `rate`, live moderation, `recording_quality`, per-language previews, and `cloned_by_count` as a popularity signal. |
| `VoiceLibraryPanel` inventory (`useVoiceStudio`, `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/hooks/useVoiceStudio.ts:1-40`) | **Catalog manager** over `voice_catalog` joined with live `/v2/voices` state. Columns: source, status, visibility, languages, slot use, references, `disable_at`. Actions: **Publish**, Hide, Edit display metadata and tags, Set replacement, Sync, Delete (only when references are 0 and the source is not a removed library voice). | **This fixes the gap**: admin-created voices become user-visible through *Publish*. |
| `VoiceDesignForm` (`/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/VoiceDesignForm.tsx:47-51`) | Two steps. (1) `POST /v1/text-to-voice/design` with `model_id: eleven_ttv_v3`, `voice_description` (the prompt template from §7.1), `text` or `auto_generate_text`, `guidance_scale`, `loudness`, `seed`, `should_enhance`, and optional `reference_audio_base64` and `prompt_strength`. Show the 3 previews. (2) "Save" calls `POST /v1/text-to-voice` with `generated_voice_id`, `labels {language, accent, gender, age}` and `played_not_selected_voice_ids`. Store the chosen preview as the preview asset. The row starts as `draft`. | The custom voice id input and `voiceIdRules.ts` go away. A slot is used only on save. |
| (new) **Remix** panel | `POST /v1/text-to-voice/{voice_id}/remix`, then save as above, with `parent_voice_key` lineage. | Replaces pitch, timbre and emotion hacks with real variants. |
| `VoiceCloneForm` (`/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/VoiceCloneForm.tsx:60-69,165-170,286`) | `POST /v1/voices/add` (multipart repeated `files`, `name`, `description`, `labels`, `remove_background_noise`). Needs a **consent record** (required FK). Handle `requires_verification`. Then run one showcase TTS for the preview. | Remove `clone_prompt`, volume normalization and the custom voice id. Client-side checks: total duration 60–180 s (warn above 180 s); MP3 at 192 kbps or higher recommended; levels hint. |
| `SynthLabPanel` + `SynthControls` | TTS lab with: model select (`eleven_v4`, `eleven_v4_turbo`, `eleven_v3`, `eleven_multilingual_v2`, `eleven_flash_v2_5`); **model-aware** settings (v4: stability and similarity only; v3: stability; v2/Flash: all five plus speed 0.7–1.2); `language_code` (not for multilingual_v2); `seed`; `output_format`; `apply_text_normalization`; and pronunciation dictionary locators (≤ 3). | Settings and params per [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert]. |
| `TextArtifactToolbar` (MiniMax `<#0.4#>`, `(laughs)`, `word/(ipa)`) | v3/v4: audio tags `[whispers]`, `[laughs]`, `[sighs]`, `[excited]`, `[sarcastic]`, `[strong X accent]`; ellipses for pauses; CAPS for emphasis; IPA as `/…/` (v4). v2/Flash: `<break time="0.4s" />` (≤ 3 s; too many cause instability). Phoneme tags work **only on `eleven_flash_v2`** (English); on Multilingual v2 and Flash v2.5, use pronunciation-dictionary **alias** rules (corrected during verification). | [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices]. The toolbar inserts different syntax depending on the selected model. |
| `MiniMaxReferenceDrawer` | "ElevenLabs reference" drawer: model matrix (§11), tag cheat sheet, design prompt template, curation rules. | |
| `hexAudio.ts` | Decode base64 (design previews) or binary MP3 (TTS). Hex is MiniMax-only. | |
| `voiceLanguage.ts` (language from MiniMax id prefix) | Delete. Use labels and `verified_languages`. | |
| Root routes `/admin/voices/*` (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:75-196`) | `GET /admin/voices/catalog`, `PATCH /admin/voices/catalog/{voice_key}`, `POST /admin/voices/sync`, `GET /admin/voices/library` (proxy), `POST /admin/voices/library/add`, `POST /admin/voices/design`, `POST /admin/voices/design/save`, `POST /admin/voices/{voice_key}/remix`, `POST /admin/voices/ivc` (multipart and `consent_record_id`), `POST /admin/voices/consents`, `POST /admin/voices/test`, `DELETE /admin/voices/catalog/{voice_key}`, `POST /admin/voice-presets/global` (new: creates global presets). | All root-only (`require_root_user`, `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:42-48`). Use the **admin API key** (§8.1). |
| User routes `/voice-presets/system-voices` (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:87-96`) | `GET /voices/catalog?language=&gender=&age=&accent=&use_case=&tags=&call_eligible=&q=&page=` and `GET /voices/catalog/{voice_key}` (DB only), plus `GET /voices/catalog/{voice_key}/preview.mp3`. | Users never touch the provider. |

**How admin-created voices reach users (end-to-end)**

```
root: Design/Remix/IVC/Library-add ──▶ ElevenLabs voice exists ──▶ Job A upsert (draft, admin)
      ──▶ root edits display_name/tags, checks preview ──▶ Publish (status=active, visibility=public)
      ──▶ appears in GET /voices/catalog ──▶ VoicePickerDialog "Catalog" tab + Voice Studio base-voice picker
      ──▶ optional: root creates a GLOBAL preset on it (POST /admin/voice-presets/global)
```

### 12.8 (h) User presets ("recipes") on ElevenLabs

**Why MiniMax recipes don't port.** The MiniMax recipe is `speed 0.5–2, vol (0,10], pitch -12..12 semitones, emotion enum, language_boost` (`/home/andres/WebstormProjects/magic-worlds/src/features/voices/recipe.ts:4-18`; `/home/andres/PycharmProjects/magic-worlds-api/src/models/voice_preset.py:17-21`). ElevenLabs has no pitch or volume parameter in TTS, and its speed range is narrower.

| MiniMax field | ElevenLabs equivalent | Strategy |
|---|---|---|
| `speed` 0.5–2.0 | `voice_settings.speed` **0.7–1.2** (v2, Flash, v3?); **not on v4** | Clamp into [0.7, 1.2]. On v4, drop it and optionally add pacing tags ("[slowly]", "[quickly]") **[unverified that v4 honours them reliably]**. |
| `vol` (0,10] | None in TTS. Voice Design `loudness` affects only designed voices at creation. | Server-side **loudness normalization** of all outputs to about −16 LUFS is a TTS-pipeline concern. Keep an optional per-preset `gain_db` (−6..+6) applied at playback with `audio.volume` or a GainNode, never at synthesis. |
| `pitch` −12..12 | None. | **Drop.** Offer admin-made **Remix variants** ("higher", "deeper") as separate catalog voices. Migrate existing non-zero pitch presets to the nearest variant if one exists, otherwise drop with a notice. |
| `emotion` (happy, sad, angry, fearful, disgusted, surprised, calm; `/home/andres/PycharmProjects/magic-worlds-api/src/models/admin_voice.py:28-37`) | v3/v4 **audio tags** | Map to a `tag_prefix`: happy→`[cheerful]`, sad→`[sad]`, angry→`[angry]`, fearful→`[nervous]`, disgusted→`[disgusted]`, surprised→`[surprised]`, calm→`[calm]`. The exact tag wording is **[unverified]**; validate by ear on v4, since "a tag can occasionally be interpreted as a request for a sound effect" [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices]. On v2/Flash, approximate with lower stability and an optional `style`. |
| `language_boost` ("auto", "English", …) | `language_code` (ISO 639-1), ignored by multilingual_v2 | Map names to codes; "auto" means omit. |
| (new) | `stability` 0–1 (all models) | Default 0.5. Lower is more expressive. |
| (new) | `similarity_boost` 0–1 (not v3) | Default 0.75. |
| (new) | `style` 0–1 (v2 family only) | Default 0. The docs recommend 0. |
| (new) | `use_speaker_boost` (not v3) | Default true. |
| (new) | `model_policy` | `auto` (server picks per surface: narration → `eleven_v4`, calls → `eleven_v4_turbo` or `eleven_flash_v2_5`) or `pinned:<model_id>` (root only). **Transport caveat (added during verification):** `eleven_v4_turbo` streams over the Text to Dialogue WebSocket (one registered voice per connection for v4 Turbo). `eleven_flash_v2_5` uses the classic TTS WebSocket, which rejects v3 and v4 [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets]. `call_eligible` must therefore record which transport the voice was tested on. |

**New preset shape** (API and DB). Add the columns, keep the legacy columns until migration finishes, then drop them.

```json
{
  "preset_id": "…",
  "name": "Grim narrator",
  "voice_key": "vk_…",                 // FK to voice_catalog (replaces base_voice_id)
  "provider": "elevenlabs",
  "settings": { "stability": 0.4, "similarity_boost": 0.8, "style": 0.0, "speed": 0.95, "use_speaker_boost": true },
  "tag_prefix": "[low, gravelly voice]",   // v3/v4 only; ≤ 64 chars, allowlisted characters
  "language_code": null,
  "gain_db": 0,
  "model_policy": "auto",
  "schema_version": 2,
  "is_global": false
}
```

Validation rules:
- The server rejects settings the resolved model does not support, or strips them with a warning. Do this in one place, the resolver.
- `tag_prefix` is sanitized: brackets only, a small character allowlist, and no newlines.
- `voice_key` must exist with `status in (active, deprecating)` and `visibility='public'` (or root). This also fixes baseline issue 10: "voice_id is checked only by length."

**New `CharacterVoice` v2** (snapshot-safe, copied into cards and frozen into chats):

```json
{
  "schema_version": 2,
  "provider": "elevenlabs",
  "voice_key": "vk_…",
  "provider_voice_id": "…",              // denormalized for speed; resolver re-checks catalog
  "settings": { "stability": 0.5, "similarity_boost": 0.75, "style": 0, "speed": 1, "use_speaker_boost": true },
  "tag_prefix": null,
  "language_code": null,
  "gain_db": 0,
  "preset_id": "…", "preset_name": "…"
}
```

**v3/v4 tag defaults per narration role.** This is applied by the TTS pipeline, not stored per user:
- narrator: no tag (neutral);
- thoughts: `[whispers]` or `[softly]`, which replaces today's `vol*0.6` thought trick in the baseline (`route_chat.py:1137-1171`);
- shouting dialogue: let the LLM emit tags.
Other research files cover this.

### 12.9 Migrating existing data (MiniMax ids in presets, cards and frozen snapshots)

1. **Build `voice_legacy_mapping`** for every MiniMax system voice id seen in `voice_preset.base_voice_id`, character cards, and `adventure`/`character-chat` snapshots (`narrator_voice` and `character.voice`).
   - Choose the ElevenLabs target by language (from the MiniMax id prefix, as `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/voiceLanguage.ts:15-21` does now), gender and descriptive.
   - Optionally use `POST /v1/similar-voices` with a MiniMax sample of each voice to rank candidates. That is a one-time admin task, paid for in MiniMax credits while the account still exists.
2. **Resolver rule** (replaces `build_resolved_voice`, `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:71-101`):
   - `schema_version==2`: use `voice_key`, follow `replacement_voice_key` if `removed`, then validate settings against the model.
   - Otherwise (legacy MiniMax shape): look up `voice_legacy_mapping`; translate speed (clamp) and emotion (to `tag_prefix`); drop pitch and vol.
   - Fallback: the per-language default narrator voice from config (`ELEVENLABS_DEFAULT_NARRATOR_VOICE_KEY`), replacing `TTS_DEFAULT_VOICE_ID` and `VOICE_MINIMAX_TTS_VOICE_ID`.
   - **One bad voice must never break the whole session**; fall back per segment (baseline issue 10).
3. **Rewrite presets** in place, recording the original MiniMax values in `metadata.legacy_minimax`. Do **not** rewrite frozen snapshots. The resolver translates them at read time, keeping the snapshot semantics the code relies on.
4. **Reuse cache keys.** The narration reuse hash (`voice_signature_sha256`, `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:104-110`) must include `provider`, `provider_voice_id`, `model_id`, settings and `tag_prefix`. Then MiniMax-era audio is never reused for ElevenLabs requests, and the other way round.

### 12.10 Frontend change map (no code here; planning only)

| File | Change |
|---|---|
| `src/features/voices/components/VoicePickerDialog.tsx` | Tabs "Presets" and "Catalog". Catalog lists from `GET /voices/catalog` with filters. A pick stores `CharacterVoice` v2 (`voice_key` plus default settings). Preview plays the cached MP3. |
| `src/features/voices/components/SystemVoicePicker.tsx` | Becomes `CatalogVoicePicker`: server-side filters (§12.5), "Leaving soon" badge, play button. |
| `src/features/voices/recipe.ts`, `PresetRecipeControls.tsx` | New recipe type. Model-aware sliders for stability, similarity, style (hidden on v4 and v3) and speed (0.7–1.2, hidden on v4); emotion becomes a tag select; `gain_db`. Pitch removed. |
| `src/features/voices/usePreviewVoice.ts` | Split into `useCatalogPreview` (free, cached URL) and `useRecipePreview` (metered; shows remaining quota; handles 429). Fixes the preview race in the baseline "Lower" list. |
| `src/features/voices/components/VoiceStudioPage.tsx`, `PresetEditor.tsx` | Base-voice picker becomes the catalog picker; chips show the new recipe fields. |
| `src/features/admin/voices/*` | Per §12.7. Delete `voiceIdRules.ts`, `voiceLanguage.ts`, `hexAudio.ts` (hex parts), `MiniMaxReferenceDrawer.tsx`, and the MiniMax option lists in `constants.ts`. |
| `src/shared/types/voicePreset.types.ts`, `adminVoice.types.ts` | New `CatalogVoice`, `CharacterVoiceV2`, `VoicePresetV2`, and admin DTOs. Keep a legacy `CharacterVoice` union for reading old snapshots. |
| i18n (`src/app/i18n/locales/en.ts`, `es.ts`) | New strings: catalog filters, deprecation badges, consent form. Replace MiniMax copy. |

---

## 13. Best-practice checklist

**Catalog and curation**
- [ ] Never ship premade/Default voice ids. Check with `voice_type=default` that nothing public uses them before **2026-12-31**.
- [ ] Curate library voices with `min_notice_period_days ≥ 365`, `include_custom_rates=false`, `include_live_moderated=false` for call voices, Studio Quality preferred, and verified for the target model and language.
- [ ] Always **add** curated voices to the account. Store both the library id and the account id.
- [ ] Allowlist model ids when ingesting `verified_languages` (the probe found experimental ids).
- [ ] Keep our own `display_name`, `tags` and i18n. Provider names follow "Name - Trait" conventions and can be changed by owners.

**Lifecycle**
- [ ] Subscribe to `voice_library_removal_notice`. Handle `voice_removal_notice`, `voice_removal_notice_withdrawn` and `voice_removed` idempotently and treat them as re-fetch triggers.
- [ ] Re-check `disable_at_unix` daily for curated voices. Pick replacements with `/v1/similar-voices`.
- [ ] Never delete a removed library copy while references exist. It cannot be re-added.
- [ ] Use `/v2/voices` (cursor, `voice_ids` batch ≤ 100). Never use `/v1/voices` (breaks above 500 voices).

**Previews and cost**
- [ ] Serve previews from our storage. Never synthesize to "hear a voice".
- [ ] Meter, rate-limit and cache recipe previews by hash. Fixed texts only for non-root users.
- [ ] Design many previews but save few: each save is a slot, and every add or edit is an op.
- [ ] Read limits from `/v1/user/subscription`, not from constants.

**Quality**
- [ ] IVC: 1–2 minutes, one speaker, one style, MP3 at 192 kbps or higher, −23 to −18 dB RMS, `remove_background_noise` only if there is noise.
- [ ] Design: use the "Native <Language>. <Gender>, <Age>. <Quality>. Persona… Emotion…" template; avoid FX words; use `seed` for reproducibility.
- [ ] Send explicit `voice_settings` per request. Do not rely on account-side stored settings.
- [ ] Use model-aware settings: v4 takes stability and similarity only; v3 has no similarity or speaker boost; speed is 0.7–1.2 on the models that support it.
- [ ] *(Added during verification.)* Pick the streaming transport per model. v4 and v4 Turbo use the Text to Dialogue WebSocket; Flash and Multilingual v2 use the TTS WebSocket. Never offer the deprecated `eleven_turbo_v2*` ids.
- [ ] *(Added during verification.)* Do not count on webhook retries for voice-removal events. The daily `disable_at_unix` check is the safety net.

**Safety and legal**
- [ ] IVC is root-only, with a signed consent record. No public figures (no-go voices). No child-like voices in the public catalog.
- [ ] Keep a per-user generation audit, because provider traceability points at our account.
- [ ] Use a paid plan, for the commercial license and for Library API access.
- [ ] Split runtime and admin API keys. Put a `character_limit` on the admin service account.

---

## 14. Open questions

1. **Library voice without adding (API).** Does `POST /v1/text-to-speech/{library_voice_id}` work on a paid account when the voice is not in My Voices? To test: one staging call with a paid key. The recommendation (always add) holds either way.
2. **Account copy id.** Does `POST /v1/voices/add/{public_user_id}/{voice_id}` return the *same* `voice_id`? To test: in staging, compare `original_voice_id`.
3. **Shared-add and the add/edit quota.** Does adding a shared voice increment `voice_add_edit_counter`? To test: watch `/v1/user/subscription` before and after.
4. **Business slots.** 660 (help center) or 2,200 (pricing page)? Ask sales if Business is considered.
5. **Preview URL lifetime.** How long do `api.us.elevenlabs.io/v1/voices/{id}/previews/audio?payload=…` URLs stay valid? Does ToS allow caching preview MP3s on our servers? Ask support or legal. Caching is the design default.
6. **Default-voice replacement ids.** Resolve the real ids of "Darian", "Talia" and the others (official names only). Are they library voices with an "infinite" notice period, and how does the API show "infinite"?
7. **IVC verification over the API.** When is `requires_verification=true` returned for an IVC, and how is it completed outside the dashboard?
8. **`generated_voice_id` lifetime** after `/text-to-voice/design`, before `/text-to-voice` save.
9. **Third-party end-user exposure.** Do the VLA and ToS allow our end users to pick from curated Library voices inside magic-worlds (B2C), and must they see owner attribution? Ask legal@elevenlabs.io.
10. **Pacing and emotion tags on v4.** Do `[slowly]` and emotion tags reliably stand in for MiniMax `speed` and `emotion`? Needs listening tests per voice.
11. **API behavior of unsupported settings.** On `eleven_v4`, are `style`, `speed` and `use_speaker_boost` silently ignored or rejected with 422? Decides whether the resolver must strip them.
12. **Pricing after 2026-10-12.** The v4 promotional pricing ended today. Re-read https://elevenlabs.io/pricing/api before budgeting.
13. **Product decision.** Should paying users ever get their own designed voices (slot-metered)? Not recommended for v1.
14. **Webhook payload schema** for `voice_removal_notice`, `voice_removal_notice_withdrawn` and `voice_removed`. It is not on the page we read. The handler re-fetches anyway.
15. *(Added during verification.)* **`eleven_v4_turbo` over HTTP.** The docs name only the Text to Dialogue WebSocket for v4 Turbo. Does `POST /v1/text-to-speech/{voice_id}` (or `/stream`) accept `model_id=eleven_v4_turbo`? One staging call settles it.
16. *(Added during verification.)* **Remixing library voices.** The voice-remixing page allows "Voice Library voices with an infinite notice period". The TTS playground guide and the Voices overview say only owned voices can be remixed. Test with one added library voice before promising the "remix as a permanent copy" hedge (§4.5, §12.6).
17. *(Added during verification.)* **Webhook retries for voice events.** Retries are documented only for agent post-call events. Ask support whether `retry_enabled` covers `voice_library_removal_notice`.

---

## 15. Sources

### Official ElevenLabs documentation (read 2026-10-12)
- https://elevenlabs.io/docs/llms.txt
- https://elevenlabs.io/docs/overview/capabilities/voices
- https://elevenlabs.io/docs/overview/capabilities/voice-remixing
- https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4
- https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices
- https://elevenlabs.io/docs/overview/models
- https://elevenlabs.io/docs/overview/administration/billing
- https://elevenlabs.io/docs/eleven-creative/voices/voice-library
- https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning
- https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning
- https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/professional-voice-cloning
- https://elevenlabs.io/docs/eleven-creative/voices/voice-design
- https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech
- https://elevenlabs.io/docs/eleven-creative/audio-tools/audio-detector
- https://elevenlabs.io/docs/eleven-api/quickstart
- https://elevenlabs.io/docs/eleven-api/concepts/voice-cloning
- https://elevenlabs.io/docs/eleven-api/guides/how-to/voices/instant-voice-cloning
- https://elevenlabs.io/docs/eleven-api/guides/how-to/voices/professional-voice-cloning
- https://elevenlabs.io/docs/eleven-api/guides/how-to/voices/voice-design
- https://elevenlabs.io/docs/eleven-api/guides/how-to/voices/remix-a-voice
- https://elevenlabs.io/docs/eleven-api/resources/webhooks
- https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode
- https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets (added during verification)

### API reference
- https://elevenlabs.io/docs/api-reference/voices/search
- https://elevenlabs.io/docs/api-reference/voices/get
- https://elevenlabs.io/docs/api-reference/voices/update
- https://elevenlabs.io/docs/api-reference/voices/delete
- https://elevenlabs.io/docs/api-reference/voices/samples/get
- https://elevenlabs.io/docs/api-reference/voices/samples/delete
- https://elevenlabs.io/docs/api-reference/voices/settings/get-default
- https://elevenlabs.io/docs/api-reference/voices/settings/get
- https://elevenlabs.io/docs/api-reference/voices/settings/update
- https://elevenlabs.io/docs/api-reference/voices/find-similar-voices
- https://elevenlabs.io/docs/api-reference/voices/accents/get
- https://elevenlabs.io/docs/api-reference/voices/collections/list
- https://elevenlabs.io/docs/api-reference/voices/collections/create
- https://elevenlabs.io/docs/api-reference/voices/collections/add-voice
- https://elevenlabs.io/docs/api-reference/voices/replicate-to-isolated-environment
- https://elevenlabs.io/docs/api-reference/voices/voice-library/get-shared
- https://elevenlabs.io/docs/api-reference/voices/voice-library/share
- https://elevenlabs.io/docs/api-reference/voices/ivc/create
- https://elevenlabs.io/docs/api-reference/voices/pvc/create
- https://elevenlabs.io/docs/api-reference/voices/pvc/update
- https://elevenlabs.io/docs/api-reference/voices/pvc/train
- https://elevenlabs.io/docs/api-reference/voices/pvc/samples/create
- https://elevenlabs.io/docs/api-reference/voices/pvc/samples/update
- https://elevenlabs.io/docs/api-reference/voices/pvc/samples/separate-speakers
- https://elevenlabs.io/docs/api-reference/voices/pvc/verification/request
- https://elevenlabs.io/docs/api-reference/voices/pvc/verification/captcha
- https://elevenlabs.io/docs/api-reference/voices/pvc/verification/captcha/verify
- https://elevenlabs.io/docs/api-reference/text-to-voice/design
- https://elevenlabs.io/docs/api-reference/text-to-voice/create
- https://elevenlabs.io/docs/api-reference/text-to-voice/remix
- https://elevenlabs.io/docs/api-reference/text-to-voice/stream
- https://elevenlabs.io/docs/api-reference/text-to-speech/convert
- https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert
- https://elevenlabs.io/docs/api-reference/workspace/resources/share
- https://elevenlabs.io/docs/api-reference/workspace/resources/get
- https://elevenlabs.io/docs/api-reference/workspace/resources/unshare
- https://elevenlabs.io/docs/api-reference/user/subscription/get
- https://elevenlabs.io/docs/api-reference/webhooks/create
- https://elevenlabs.io/docs/api-reference/webhooks/update
- https://elevenlabs.io/docs/api-reference/models/list

### Help center (docs-hosted)
- https://elevenlabs.io/docs/help-center/account/general/how-many-voice-slots-do-i-get-per-tier-and-how-can-i-increase-it
- https://elevenlabs.io/docs/help-center/account/general/is-there-a-limit-on-how-many-times-i-can-edit-add-voices
- https://elevenlabs.io/docs/help-center/account/general/what-happens-to-my-cloned-voices-when-i-downgrade-the-tier
- https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-access-eleven-labs-default-voices
- https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-are-default-voices
- https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-are-legacy-voices
- https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-delete-voices-from-my-voices
- https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-share-a-voice
- https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-is-my-voices
- https://elevenlabs.io/docs/help-center/product/voices/my-voices/who-has-access-to-my-voices
- https://elevenlabs.io/docs/help-center/product/voices/my-voices/why-cant-i-access-my-voices-via-third-party-services
- https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-the-voice-library
- https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-a-notice-period
- https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-live-moderation
- https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-are-custom-rates-and-credit-multipliers
- https://elevenlabs.io/docs/help-center/product/voices/voice-library/why-cant-i-use-some-voices-from-the-voice-library
- https://elevenlabs.io/docs/help-center/product/voices/voice-library/how-are-voices-updated-changed
- https://elevenlabs.io/docs/help-center/product/voices/voice-library/how-can-i-identify-the-voice-used-to-generate-audio
- https://elevenlabs.io/docs/help-center/product/voices/voice-library/how-do-i-add-a-custom-preview-for-my-shared-voice
- https://elevenlabs.io/docs/help-center/product/voices/voice-library/how-do-i-delete-a-voice-ive-shared-with-the-voice-library
- https://elevenlabs.io/docs/help-center/product/voices/voice-library/can-childrens-or-child-like-voices-be-added-to-the-voice-library
- https://elevenlabs.io/docs/help-center/product/voices/voice-library/can-i-share-an-ai-generated-voice-in-the-voice-library
- https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/can-i-create-a-professional-voice-clone-of-someone-elses-voice
- https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/how-many-professional-voice-clones-pv-cs-can-i-have
- https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/what-does-the-status-of-my-professional-voice-clone-mean
- https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/when-will-my-professional-voice-clone-pvc-be-ready
- https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/what-languages-are-supported-with-professional-voice-cloning-pvc
- https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/how-do-i-add-or-upgrade-the-models-used-to-train-my-professional-voice-clone
- https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/what-files-do-you-accept-for-voice-cloning
- https://elevenlabs.io/docs/help-center/product/voices/voice-design/how-much-does-voice-design-cost
- https://elevenlabs.io/docs/help-center/product/voices/voice-design/what-is-voice-design
- https://elevenlabs.io/docs/help-center/product/voices/voice-design/what-kind-of-voices-can-i-create-using-voice-design
- https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/can-i-change-the-pace-of-the-voice
- https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/can-i-use-the-same-cloned-designed-voice-across-languages
- https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/which-voices-in-the-voice-library-are-native-to-a-specific-language
- https://elevenlabs.io/docs/help-center/technical/how-do-i-find-the-voice-id-of-my-voices-via-the-website-and-api
- https://elevenlabs.io/docs/help-center/technical/why-does-my-voice-sound-different-in-the-api-compared-to-the-website
- https://elevenlabs.io/docs/help-center/legal/what-are-no-go-voices
- https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform
- https://elevenlabs.io/docs/help-center/legal/audio-detector/what-is-watermarking-and-why-is-eleven-labs-using-it
- https://elevenlabs.io/docs/help-center/legal/audio-detector/does-watermarking-affect-my-audio-quality-or-add-latency-to-my-generations
- https://elevenlabs.io/docs/help-center/legal/audio-detector/is-content-generated-by-third-party-models-available-through-eleven-labs-watermarked
- https://elevenlabs.io/docs/help-center/legal/audio-detector/what-is-the-difference-between-the-eleven-labs-ai-speech-classifier-and-the-new-audio-detector-tool

### Changelog entries
- https://elevenlabs.io/docs/changelog/llms.txt
- https://elevenlabs.io/docs/changelog/2025/6/23
- https://elevenlabs.io/docs/changelog/2025/6/30
- https://elevenlabs.io/docs/changelog/2025/7/14
- https://elevenlabs.io/docs/changelog/2025/7/28
- https://elevenlabs.io/docs/changelog/2025/9/15
- https://elevenlabs.io/docs/changelog/2025/10/27
- https://elevenlabs.io/docs/changelog/2026/1/5
- https://elevenlabs.io/docs/changelog/2026/1/19
- https://elevenlabs.io/docs/changelog/2026/2/23
- https://elevenlabs.io/docs/changelog/2026/4/1
- https://elevenlabs.io/docs/changelog/2026/5/13
- https://elevenlabs.io/docs/changelog/2026/6/15
- https://elevenlabs.io/docs/changelog/2026/7/6
- https://elevenlabs.io/docs/changelog/2026/7/20
- https://elevenlabs.io/docs/changelog/2026/7/27
- https://elevenlabs.io/docs/changelog/2026/8/3
- https://elevenlabs.io/docs/changelog/2026/8/10
- https://elevenlabs.io/docs/changelog/2026/9/28
- https://elevenlabs.io/docs/changelog/2026/10/5

### Pricing, legal and product pages
- https://elevenlabs.io/pricing
- https://elevenlabs.io/pricing/api
- https://elevenlabs.io/vla
- https://elevenlabs.io/iconic-marketplace

### Official GitHub
- https://github.com/elevenlabs/elevenlabs-python/blob/main/reference.md
- https://api.github.com/repos/elevenlabs/elevenlabs-python/releases/latest (v2.71.0, 2026-10-05)

### Live probes (unauthenticated, 2026-10-12)
- `GET https://api.elevenlabs.io/v1/shared-voices?page_size=3&language=es&sort=trending`
- `GET https://api.elevenlabs.io/v1/shared-voices?page_size=5…` (401, over 3 voices) and `…&search=…` (401, filters need login)
- `GET https://api.elevenlabs.io/v2/voices?page_size=3` (401, needs key)
- `HEAD https://storage.googleapis.com/eleven-public-prod/wqkMCd9huxXHX1dy5mLJn4QEQHj1/voices/sB1b5zUrxQVAFl2PhZFp/55e71aac-5cb7-4b3d-8241-429388160509.mp3`
- `GET https://api.us.elevenlabs.io/v1/voices/YqZLNYWZm98oKaaLZkUA/previews/audio?payload=…` (headers only)

### Secondary sources
- https://community.livekit.io/t/new-default-elevenlabs-voices/459
- https://support.vapi.ai/t/26977579/voice-not-found
- https://community.retellai.com/t/when-adding-a-voice-resource-not-found/728
- https://help.elevenlabs.io/hc/en-us/articles/33533163659921-What-is-a-notice-period (403; content known only from a search summary)
- https://the-decoder.com/elevenlabs-opens-a-marketplace-for-iconic-ai-voices/
- https://aiproductivity.ai/guides/elevenlabs-voice-cloning-tutorial/

### Codebase files read
- /home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/research/00_current_tts_review.md
- /home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py
- /home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py
- /home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py
- /home/andres/PycharmProjects/magic-worlds-api/src/models/admin_voice.py
- /home/andres/PycharmProjects/magic-worlds-api/src/models/voice_preset.py
- /home/andres/PycharmProjects/magic-worlds-api/src/models/character.py
- /home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py
- /home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql (lines 1276-1309)
- /home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py (lines 14858, 15099-15160)
- /home/andres/PycharmProjects/magic-worlds-api/src/main.py (lines 946-948)
- /home/andres/WebstormProjects/magic-worlds/src/features/voices/recipe.ts
- /home/andres/WebstormProjects/magic-worlds/src/features/voices/usePreviewVoice.ts
- /home/andres/WebstormProjects/magic-worlds/src/features/voices/components/VoicePickerDialog.tsx
- /home/andres/WebstormProjects/magic-worlds/src/features/voices/components/SystemVoicePicker.tsx
- /home/andres/WebstormProjects/magic-worlds/src/features/voices/components/PresetRecipeControls.tsx
- /home/andres/WebstormProjects/magic-worlds/src/features/voices/components/VoiceStudioPage.tsx
- /home/andres/WebstormProjects/magic-worlds/src/features/voices/components/PresetEditor.tsx
- /home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/constants.ts
- /home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/voiceLanguage.ts
- /home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/voiceIdRules.ts
- /home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/hooks/useVoiceStudio.ts
- /home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/AdminVoicesPage.tsx
- /home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/VoiceDesignForm.tsx
- /home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/VoiceCloneForm.tsx
- /home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/VoiceLibraryPanel.tsx
- /home/andres/WebstormProjects/magic-worlds/src/shared/types/voicePreset.types.ts
- /home/andres/WebstormProjects/magic-worlds/src/features/creation/character/components/CharacterCreator.tsx (lines 130-132, 249)
- /home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/InteractionLeftPanel.tsx (lines 173-175)
- /home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/index.ts (lines 1584-1620, 1922-1960, 2066-2077)

---

## Verification log (2026-10-12)

An adversarial re-check against live official sources on 2026-10-12. Each page was fetched as raw Markdown (`<page>.md`) or as HTML for the pricing pages and the VLA. The unauthenticated public probe was re-run. The codebase citations spot-checked (`voice_presets.py:19-20,87-99`, `minimax_voice_admin.py:46,50`, `admin_voices.py:42-48`, `db.sql:1276-1280`, `admin_voice.py:28-37`, `VoicePickerDialog.tsx:59-62`, `constants.ts:18-23`, `voiceLanguage.ts:15-21`) all matched.

| # | Claim | Status | Source |
|---|---|---|---|
| 1 | Default voices expire 2026-12-31; only accounts created before March 2026 get them | confirmed | https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-are-default-voices |
| 2 | Default → replacement name table (19 rows) | confirmed | same |
| 3 | Legacy voice ids auto-route to replacements; no such promise for Default ids | confirmed | https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-are-legacy-voices |
| 4 | Quickstart still uses George `JBFqnCBsd6RMkjVDRZzb` with `eleven_v4` | confirmed | https://elevenlabs.io/docs/eleven-api/quickstart |
| 5 | Library voices use no custom slots; slots only for Design and Cloning | confirmed | https://elevenlabs.io/docs/eleven-creative/voices/voice-library ; https://elevenlabs.io/docs/overview/administration/billing |
| 6 | Voice add/edit ops: 55/65/95/290/1,040/1,040/unlimited | confirmed | https://elevenlabs.io/docs/help-center/account/general/is-there-a-limit-on-how-many-times-i-can-edit-add-voices |
| 7 | Slots: 3/10/30/160/660; Business 660 (help) vs 2,200 (pricing) | confirmed (conflict persists) | https://elevenlabs.io/docs/help-center/account/general/how-many-voice-slots-do-i-get-per-tier-and-how-can-i-increase-it ; https://elevenlabs.io/pricing |
| 8 | Concurrency 2/3/5/10/15/25 | confirmed | https://elevenlabs.io/pricing |
| 9 | Voice Library not available via API on free tier | confirmed | https://elevenlabs.io/docs/overview/capabilities/voices |
| 10 | Notice period 30 days–2 years or none; `disable_at_unix` on Get Voice | confirmed | https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-a-notice-period |
| 11 | Owners cannot reduce a notice period; notice-period access is for users who *added* the voice | confirmed + added | https://elevenlabs.io/vla |
| 12 | Removed library voice that you delete cannot be re-saved | confirmed | https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-delete-voices-from-my-voices |
| 13 | Eleven v4: Stability and Similarity only; no Style, Speed or SSML | confirmed | https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4 |
| 14 | Speed 0.7–1.2 "for all models" vs v4 having no Speed | corrected (docs conflict noted) | https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/can-i-change-the-pace-of-the-voice |
| 15 | `eleven_v4_turbo` "via the Text to Dialogue websocket"; TTS WebSocket rejects v3/v4; v4 Turbo is one voice per TTD connection | confirmed + added | https://elevenlabs.io/docs/overview/models ; https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets |
| 16 | `eleven_v4_turbo` accepted on HTTP convert/stream | unverified | not stated in docs |
| 17 | Character limits: v4 10,000; v3 5,000; Flash v2.5 40,000; Multilingual v2 10,000 | confirmed | https://elevenlabs.io/docs/overview/models |
| 18 | `eleven_turbo_v2_5` / `eleven_turbo_v2` deprecated (Flash equivalents) | added | https://elevenlabs.io/docs/overview/models |
| 19 | Default TTS model `eleven_multilingual_v2`; `language_code` unsupported on it | confirmed | https://elevenlabs.io/docs/api-reference/text-to-speech/convert |
| 20 | Phoneme tags on Multilingual v2 / Flash v2.5 | corrected (only `eleven_flash_v2`) | https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices |
| 21 | v3: no Similarity, no Speaker Boost; style recommended 0 | confirmed | https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech |
| 22 | `GET /v2/voices` params (page_size ≤ 100, `voice_type` enum incl. `saved`, `voice_ids` ≤ 100, `include_total_count` default true) | confirmed | https://elevenlabs.io/docs/api-reference/voices/search ; https://elevenlabs.io/docs/changelog/2026/1/5 |
| 23 | Label filters added 2026-08-10; library filters undated | corrected (all nine added 2026-08-10) | https://elevenlabs.io/docs/changelog/2026/8/10 |
| 24 | `VoiceResponseModel` fields (`sharing.*`, `safety_control` enum, `recording_quality` enum, default settings 0.5/0.75/0/1/true) | confirmed | https://elevenlabs.io/docs/api-reference/voices/search |
| 25 | Legacy `GET /v1/voices` stops working above 500 voices; SDK v2.71.0 released 2026-10-05 | confirmed | https://github.com/elevenlabs/elevenlabs-python/blob/main/reference.md ; https://api.github.com/repos/elevenlabs/elevenlabs-python/releases/latest |
| 26 | `GET /v1/shared-voices` params (page_size default 30 max 100, offset `page`, `sort` enum, category enum) and response (`total_count`, `last_sort_id`) | confirmed | https://elevenlabs.io/docs/api-reference/voices/voice-library/get-shared |
| 27 | `POST /v1/voices/add/{public_user_id}/{voice_id}` body `new_name`, `bookmarked` (default true) → `{voice_id}` | confirmed | https://elevenlabs.io/docs/api-reference/voices/voice-library/share |
| 28 | Returned id equals library id; shared-add counts toward add/edit quota | unverified | — |
| 29 | `POST /v1/similar-voices`: `similarity_threshold` 0–2, `top_k` 1–100, returns library voices | confirmed | https://elevenlabs.io/docs/api-reference/voices/find-similar-voices |
| 30 | `GET /v1/voices/accents` (`language`, `model_id`; returns accent/language/code/name), added 2026-07-27 | confirmed | https://elevenlabs.io/docs/api-reference/voices/accents/get ; https://elevenlabs.io/docs/changelog/2026/7/27 |
| 31 | IVC `POST /v1/voices/add` fields; labels keys language/accent/gender/age; response `{voice_id, requires_verification}` | confirmed; `files[]` corrected to `files` | https://elevenlabs.io/docs/api-reference/voices/ivc/create |
| 32 | IVC 1–2 min, > 3 min detrimental, −23 to −18 dB RMS, MP3 ≥ 192 kbps | confirmed; bitrate nuance added (guide says ≥ 128 kbps) | https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning ; https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/what-files-do-you-accept-for-voice-cloning |
| 33 | Cloning Starter+; PVC Creator+; PVC slots 1/1/3/10 (+ legacy plan variants) | confirmed | https://elevenlabs.io/docs/overview/administration/billing ; https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/how-many-professional-voice-clones-pv-cs-can-i-have |
| 34 | PVC own voice only, even with consent | confirmed | https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/can-i-create-a-professional-voice-clone-of-someone-elses-voice |
| 35 | "Draft and unverified PVCs cannot be deleted" | corrected (help page names only unverified) | https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-delete-voices-from-my-voices |
| 36 | PVC API flow paths (`/v1/voices/pvc`, `/samples`, `/captcha`, `/verification`, `/train`, `separate-speakers`) | confirmed | https://elevenlabs.io/docs/api-reference/voices/pvc/create (and sibling pages) |
| 37 | Voice Design `POST /v1/text-to-voice/design` params (`eleven_multilingual_ttv_v2` default / `eleven_ttv_v3`, text 100–1,000, loudness default 0.5, guidance_scale default 5, `reference_audio_base64` + `prompt_strength` ttv_v3 only), 3 previews | confirmed | https://elevenlabs.io/docs/api-reference/text-to-voice/design ; https://elevenlabs.io/docs/overview/capabilities/voices |
| 38 | Save via `POST /v1/text-to-voice` (`voice_name`, `voice_description`, `generated_voice_id`, `labels`, `played_not_selected_voice_ids`); uses one slot | confirmed | https://elevenlabs.io/docs/api-reference/text-to-voice/create ; https://elevenlabs.io/docs/eleven-creative/voices/voice-design |
| 39 | Remix `POST /v1/text-to-voice/{voice_id}/remix`, guidance_scale default 2 | confirmed | https://elevenlabs.io/docs/api-reference/text-to-voice/remix |
| 40 | Remix accepts library voices with infinite notice | confirmed on one page, contradicted on two (conflict added) | https://elevenlabs.io/docs/overview/capabilities/voice-remixing ; https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech |
| 41 | `create-previews` deprecated 2026-05-13; `create-voice-from-preview` and `remixing-sessions` removed 2025-07-28; `/v1/voice-generation/*` removed 2026-02-23 | confirmed | https://elevenlabs.io/docs/changelog/2026/5/13 ; https://elevenlabs.io/docs/changelog/2025/7/28 ; https://elevenlabs.io/docs/changelog/2026/2/23 |
| 42 | Voice Design charges preview-text characters once per 3 previews | confirmed | https://elevenlabs.io/docs/help-center/product/voices/voice-design/how-much-does-voice-design-cost |
| 43 | `/v1/user/subscription` voice fields | confirmed | https://elevenlabs.io/docs/api-reference/user/subscription/get |
| 44 | Webhook events `voice_removal_notice`, `_withdrawn`, `voice_removed`; `events: ["voice_library_removal_notice"]` on update | confirmed | https://elevenlabs.io/docs/eleven-api/resources/webhooks ; https://elevenlabs.io/docs/api-reference/webhooks/update |
| 45 | Webhook retries apply to voice events | corrected (documented only for agent post-call events) | https://elevenlabs.io/docs/eleven-api/resources/webhooks |
| 46 | Custom rates are legacy and multiply credits; Live Moderation adds latency; child-like voices barred from Library | confirmed | https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-are-custom-rates-and-credit-multipliers ; https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-live-moderation ; https://elevenlabs.io/docs/help-center/product/voices/voice-library/can-childrens-or-child-like-voices-be-added-to-the-voice-library |
| 47 | IVC and Design voices shareable only within workspace; only PVCs to Library; Library name ≤ 40 characters | confirmed | https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-share-a-voice |
| 48 | API keys restricted by default; Voices (read) + Text to Speech needed | confirmed | https://elevenlabs.io/docs/help-center/product/voices/my-voices/why-cant-i-access-my-voices-via-third-party-services |
| 49 | Replicate endpoint: IVC and Voice Design only, `target_workspace_id`, `preserve_voice_id` default true | confirmed | https://elevenlabs.io/docs/api-reference/voices/replicate-to-isolated-environment |
| 50 | API pricing: v4 $0.022 / v4 Turbo $0.011 "72% off until Oct 12" (list $0.08 / $0.04); v3 Conversational $0.04 | confirmed + added | https://elevenlabs.io/pricing/api |
| 51 | Paid plans include commercial license (not Beta Services); free requires attribution | confirmed | https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform |
| 52 | Unauthenticated `/v1/shared-voices` capped at 3; filters such as `search` need login; ES total 8,788; experimental model ids in `verified_languages` | confirmed (live probe re-run) | live probe |
| 53 | Not every trending library voice is verified on `eleven_v4` | added (live probe) | live probe |
| 54 | GCS preview objects return `text/plain` and no CORS header | corrected (content-type varies per object; `ACAO: *` returned on GET) | live probe |
| 55 | API preview URL works with `HEAD` | corrected (`HEAD` → 405; use `GET`) | live probe |
| 56 | Preview URL lifetime; ToS on caching previews; `generated_voice_id` lifetime; IVC verification flow over API; v4 handling of unsupported settings; library voice usable via API without adding | unverified | — |
