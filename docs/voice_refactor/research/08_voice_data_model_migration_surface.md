# 08 — Voice data model and migration surface (MiniMax → ElevenLabs)

> **Research scope (reviewed 2026-10-14):** Historical evidence from the dates stated below, including the retired MiniMax baseline. Vendor prices, model/API facts and policy claims were not reverified in this documentation pass. Current application status is **WIP** and is tracked in [00](../00_current_status_and_roadmap.md); later native ElevenLabs code/cutover supersedes migration-era implementation assumptions here.

Research date: **2026-10-12**. Read-only review of both repositories plus the live ElevenLabs documentation. No code, schema, or data was changed. No SQL in this file was executed.

**Scope.** This file maps **every place where voice data is persisted, copied, hashed, or validated** across the backend (`/home/andres/PycharmProjects/magic-worlds-api`) and the frontend (`/home/andres/WebstormProjects/magic-worlds`), so the team can plan the data migration from MiniMax voice ids and recipes (`voice_id`, `speed`, `vol`, `pitch`, `emotion`, `language_boost`) to ElevenLabs voices and settings. For each storage location it gives the copy semantics (live vs frozen), a row-count query to run before the cutover, the migration action, the runtime failure if an unmapped MiniMax id reaches ElevenLabs, and whether old MiniMax MP3s can stay playable. It ends with a single **MIGRATION SURFACE** table. Provider integration, the Voice Studio UX, and realtime streaming are covered in other files in this folder; they are mentioned here only where they touch stored data.

Read first: [00_current_tts_review.md](./00_current_tts_review.md) (baseline of the MiniMax stack and its known bugs).

## Contents

1. [Key findings](#1-key-findings)
2. [Confidence conventions](#2-confidence-conventions)
3. [The voice object today (`CharacterVoice`)](#3-the-voice-object-today-charactervoice)
4. [Where voice objects are persisted or copied](#4-where-voice-objects-are-persisted-or-copied)
5. [The `voice_preset` table](#5-the-voice_preset-table)
6. [Voice-call storage](#6-voice-call-storage)
7. [`tts_job`, `tts_asset`, and narration metadata](#7-tts_job-tts_asset-and-narration-metadata)
8. [Export, import, sharing, generation and other negative checks](#8-export-import-sharing-generation-and-other-negative-checks)
9. [Defaults, seeds, fixtures, and user-facing copy](#9-defaults-seeds-fixtures-and-user-facing-copy)
10. [Read paths that validate voice ids](#10-read-paths-that-validate-voice-ids)
11. [ElevenLabs facts that shape the target model](#11-elevenlabs-facts-that-shape-the-target-model)
12. [Target data model (proposal)](#12-target-data-model-proposal)
13. [Recipe translation rules](#13-recipe-translation-rules)
14. [Migration strategy: lazy vs one-shot, ordering, rollback](#14-migration-strategy-lazy-vs-one-shot-ordering-rollback)
15. [What breaks if an unmapped MiniMax id reaches ElevenLabs](#15-what-breaks-if-an-unmapped-minimax-id-reaches-elevenlabs)
16. [Old MiniMax MP3 assets: keep vs purge](#16-old-minimax-mp3-assets-keep-vs-purge)
17. [Pre-existing defects that interact with the migration](#17-pre-existing-defects-that-interact-with-the-migration)
18. [MIGRATION SURFACE table](#18-migration-surface-table)
19. [Open questions](#19-open-questions)
20. [Sources](#20-sources)

---

## 1. Key findings

1. **One voice object, many copies.** The same denormalized `CharacterVoice` recipe is stored in at least **nine JSON locations** (live card body, draft, version history, adventure-template cast, three snapshot shapes, codex cards, adventure narrator voice), plus the `voice_preset` table and two env-var defaults. Snapshots are **frozen copies**; they do not follow the library card. They must be migrated separately from cards.
2. **Strict validation makes a bad migration fatal.** Every reader validates with Pydantic `strict=True, extra="forbid"` (`/home/andres/PycharmProjects/magic-worlds-api/src/models/character.py:38-40`). One unknown key or unknown emotion value in a stored voice makes the whole character list fail (`/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:11128-11131`), makes a session snapshot unreadable, and breaks narration for the whole turn (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:1311-1323`). The code that **reads** the new shape must ship **before** any data is rewritten (expand → migrate → contract).
3. **The frontend silently strips unknown voice fields.** `readCharacterVoice` and `snapshotVoice` copy only the eight MiniMax fields (`/home/andres/WebstormProjects/magic-worlds/src/utils/cardTransforms.ts:57-72`, `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/utils/adventureSnapshot.ts:81-96`). If the backend adds `provider` or `settings` without a matching frontend release, every card save from the editor writes the voice back **without** them.
4. **Hard-coded `minimax` in the schema.** `tts_job` has a CHECK constraint `provider = 'minimax'` (`/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:670`). Python validators pin `provider == "minimax"`, `model_alias == "speech_2_8_turbo"`, `tts_provider == "minimax_streaming"`, and 32 kHz audio on both write **and read** paths (section 10). An ElevenLabs job cannot be inserted until these are widened. If they are switched instead of widened, old history becomes unreadable.
5. **Do not map to ElevenLabs "Default" voices.** ElevenLabs states that all Default voices expire on **December 31, 2026**, and that they are only available to accounts created before March 2026 [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-are-default-voices]. Map to voices the account owns (Voice Design / IVC / PVC), or to Voice Library voices with a long notice period and removal monitoring.
6. **Character chats have no snapshot edit route.** Unlike adventures (`PUT /adventure-sessions/{id}/template-snapshot`), a character chat's frozen voice cannot be changed by the user (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_character_chat.py`: the mutating routes at lines 1025, 1083, 1147, 1218, 1277, 1321, 1374, 1424, 1516 and 1624 cover message edit/activate/delete, codex add/patch/delete, chat create and chat delete; none of them edits the snapshot's character card). Voice calls read exactly that frozen voice (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_voice_call.py:404-431`). Server-side migration of chat snapshots is **mandatory**.
7. **Recipe fields do not translate one-to-one.** ElevenLabs speed is 0.7–1.2, while MiniMax is 0.5–2.0. ElevenLabs has no per-request volume or pitch, and v3/v4 drop speed (and v3 drops similarity) [verified: https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech]. Emotion becomes an audio tag on v3/v4 only.
8. **Old audio can stay playable.** MP3 serving is provider-agnostic (`/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:9055-9071`). Only the job-status serializers pin the legacy model alias (`/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py:980`).
9. **Pre-existing data-loss risk.** The card assistant's patch and replace paths appear to drop the `voice` field when they write the card draft (section 17.1). If this is not fixed, migrated voices will keep disappearing after assistant edits.

---

## 2. Confidence conventions

- `[verified: <url>]`: read today (2026-10-12) on an official ElevenLabs page.
- `[secondary: <url>]`: a non-official source, or an official page known only through a search summary (some `help.elevenlabs.io` pages return HTTP 403 to the fetcher).
- `[unverified]`: from memory or inference. Must be checked before production.
- `[inference]`: reasoning from verified facts and the code, not stated anywhere.
- Codebase facts cite `absolute/path:line`. Every one was read in the source during this review.

---

## 3. The voice object today (`CharacterVoice`)

### 3.1 Backend model

`/home/andres/PycharmProjects/magic-worlds-api/src/models/character.py:11-40`

| Field | Type / validation | Line | MiniMax meaning |
|---|---|---|---|
| `voice_id` | `str`, 1–256 chars, no format check | :17 | MiniMax system or custom voice id (e.g. `English_Warm_Narrator`, `Chinese (Mandarin)_…`) |
| `speed` | `float \| None`, 0.5–2.0 | :18 | `voice_setting.speed` |
| `vol` | `float \| None`, (0, 10] | :19 | `voice_setting.vol` |
| `pitch` | `int \| None`, −12..12 | :20 | `voice_setting.pitch` (semitones) |
| `emotion` | `AdminVoiceEmotion \| None` | :21, enum at `/home/andres/PycharmProjects/magic-worlds-api/src/models/admin_voice.py:30-37` | `happy, sad, angry, fearful, disgusted, surprised, calm` |
| `language_boost` | `str \| None`, ≤64 | :22 | MiniMax `language_boost` (`auto`, `English`, …) |
| `preset_id` | `str \| None`, ≤64 | :23 | display-only link to `voice_preset.preset_id` |
| `preset_name` | `str \| None`, ≤255 | :24 | display-only copy of the preset name |

- `Config: extra = "forbid", strict = True` (:38-40). Unknown keys are rejected on write **and** on read.
- Docstring: "Denormalized voice recipe … must be snapshot-safe … Omitted recipe fields fall back to MiniMax defaults" (:12-15).
- `Character.voice: Optional[CharacterVoice]` (:62). `None` means "use the global default voice".
- The synthesis-time copy is `ResolvedVoice` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:35-68`), built by `build_resolved_voice` (:71-101). It is **stricter** than `CharacterVoice`: it rejects ints for `speed`/`vol` (:77-80), surrounding whitespace in `voice_id` (:88-89), and an empty `language_boost` (:90-93). This mismatch is issue #10 in the baseline review.
- `preset_id` and `preset_name` are **not** part of `ResolvedVoice`, so they never affect synthesis or the reuse hash (`registry.py:104-119`).

### 3.2 Stored JSON shapes

| Where | Serializer | Shape |
|---|---|---|
| Live card props (`tb_card_body`, `tb_card_draft`, `tb_card_version`) | `model_dump(mode="json")`, **no** `exclude_none` (`/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/card_body.py:149-150,165-176`) | All 8 keys present, with unused ones as JSON `null`. `props.voice` itself is `null` when no voice is assigned. The props key set must match `CARD_PROPS` exactly (`card_body.py:200-211`). |
| Session snapshots (`adventure_session.template_snapshot`) | `model_dump(mode="json", exclude_none=True)` (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_adventure_session.py:955-962`, `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_character_chat.py:349,371-380`) | Only the keys that are set. A missing `voice` key means no voice. |

Migration scripts must handle both shapes: explicit `null`s, and absent keys.

### 3.3 Frontend types and transforms

| File | Lines | Role |
|---|---|---|
| `/home/andres/WebstormProjects/magic-worlds/src/shared/types/voicePreset.types.ts` | 8-18 | `CharacterVoice` interface (same 8 fields; `emotion` typed as `AdminVoiceEmotion`) |
| `/home/andres/WebstormProjects/magic-worlds/src/shared/types/character.types.ts` | 40-41 | `Character.voice?: CharacterVoice` |
| `/home/andres/WebstormProjects/magic-worlds/src/shared/types/adventure.types.ts` | 75-76, 104-105 | `SnapshotCard.voice`, `AdventureSnapshot.narrator_voice` |
| `/home/andres/WebstormProjects/magic-worlds/src/utils/cardTransforms.ts` | 57-72, 92 | `readCharacterVoice`: whitelists the 8 fields and trims `voice_id`. **Drops any other key.** |
| `/home/andres/WebstormProjects/magic-worlds/src/utils/cardTransforms.ts` | 124-141 | `transformTemplates` passes `persona`/`characters` through raw (no whitelist), which is inconsistent with the above |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/utils/adventureSnapshot.ts` | 81-96, 112, 204, 287 | `snapshotVoice` (same whitelist) when converting snapshot cards. A raw `voice` pass-through when adding a library card to a snapshot |
| `/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/VoicePickerDialog.tsx` | 20-31 | `voiceFromPreset` copies the preset recipe into the card (`vol: preset.volume`) |
| same | 88-91 | Choosing a system voice stores `{ voice_id }` only |
| same | 35-39 | `presetMatchesVoice` matches by `preset_id`, else by `voice_id === base_voice_id` |
| `/home/andres/WebstormProjects/magic-worlds/src/features/creation/character/components/CharacterCreator.tsx` | 130, 249 | Editor state, then `voice: voice ?? null` on save |
| `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/InteractionLeftPanel.tsx` | 171-175, 217-266 | Adventure narrator-voice picker writes `snapshot.narrator_voice` |
| `/home/andres/WebstormProjects/magic-worlds/src/features/call/components/CallsPage.tsx` | 25-27 | `hasVoice = Boolean(character.voice?.voice_id)` (provider-agnostic) |

No voice data is cached in browser storage. Only the auto-narrate toggle is stored (`/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/InteractionCenterPanel.tsx:185,228`).

### 3.4 Copy semantics

A preset is **copied by value** into the card. Editing or deleting a preset never updates cards (no code path reads `voice.preset_id` back; the only readers are UI matchers at `VoicePickerDialog.tsx:35-39`). Cards are then **cloned by value** into snapshots when a session is created. So a MiniMax recipe can exist in up to four generations of copies:

```
voice_preset row ──copy──▶ tb_card_body.props.voice ──copy──▶ adventure_session.template_snapshot.*.voice
                                   │                                   (frozen; per session)
                                   ├──copy──▶ tb_card_draft / tb_card_version (history)
                                   ├──copy──▶ adventure_template props.characters[*].voice (display copy)
                                   └──copy──▶ other users' clones (public/shared import)
```

---

## 4. Where voice objects are persisted or copied

### 4.1 Live library cards

| Location | Evidence | Notes |
|---|---|---|
| `tb_card_body.props` → `$.voice` (`card_type='character'`) | `CARD_PROPS["character"]` includes `"voice"` (`/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/card_body.py:33-45`). Table DDL at `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:997-1013` | Both `role='character'` and `role='persona'` cards can hold a voice. Persona voices are **never used** for narration (`speaker_voice_map` skips personas, `/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_segments.py:111-127`). |
| `tb_card_body.props` → `$.persona.voice`, `$.characters[*].voice` (`card_type='adventure_template'`) | `CARD_PROPS["adventure_template"]` includes `persona`, `characters` (`card_body.py:47`), typed as full `Character` models (`/home/andres/PycharmProjects/magic-worlds-api/src/models/adventure_template.py:18-20`) | **Display copy only.** At session creation every embedded card is re-resolved from the **current library card** by `source_card_id` (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_adventure_session.py:831-866`, line 846). The voice therefore comes from the live character card, not from the template copy. The copy is still strictly validated on read, so it must stay parseable. |
| `tb_card_draft.props` (`card_type` ∈ character/world/item) | DDL `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:1046-1063` | Owner-only pending edits. Same props shape. |
| `tb_card_version.props` | DDL `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:1018-1039` | Immutable version history. Restoring a version copies its props, including an old MiniMax voice, back into the body. |

### 4.2 Session snapshots (frozen copies) — `adventure_session.template_snapshot`

DDL: `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:73-135` (`template_snapshot json not null`, `conversation_kind` enum at :85).

| `conversation_kind` | JSON paths holding a voice | Model evidence | Editable by user? |
|---|---|---|---|
| `adventure` | `$.template.characters[*].voice`, `$.template.persona.voice`, **`$.narrator_voice`** | `SnapshotCharacter(Character)` (`route_adventure_session.py:46-53`); `AdventureSnapshotEnvelope.narrator_voice: Optional[CharacterVoice]` (:87-93) | Yes: `PUT /adventure-sessions/{id}/template-snapshot` (`route_adventure_session.py:1620-1672`). The narrator voice is validated with `build_resolved_voice` (:1661-1666). The update bumps `conversation_version` (`/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:9520-9523`). |
| `character` (1:1 chat) | `$.character.voice`, `$.persona.voice`, `$.codex_cards[*].snapshot.voice` (kind `character`), `$.codex_cards[*].snapshot.persona.voice` and `$.codex_cards[*].snapshot.characters[*].voice` (kind `adventure_template`) | `SingleCharacterChatSnapshot` (`route_character_chat.py:178-198`); codex card models (:74-150) | **No.** There is no route that edits a character chat's character card. Only codex rows can be added or toggled (:1147, :1218). |
| `character_group` | `$.characters[*].voice`, `$.persona.voice`, plus codex paths as above | `CharacterGroupChatSnapshot` (`route_character_chat.py:201-227`) | No |

**Copy-time semantics.**
- Snapshots are built from the **current library document** (`build_character_chat_snapshot`, `route_character_chat.py:352-380`; `build_cloned_session_snapshot`, `route_adventure_session.py:869-962`). This is a one-time copy, after which the snapshot is frozen.
- Snapshots are capped at `MAX_TEMPLATE_SNAPSHOT_BYTES = 1_000_000` (`route_character_chat.py:61`). The extra fields proposed in section 12 are small.

**Read-time consumers of snapshot voices.**

| Consumer | Location | Behaviour |
|---|---|---|
| Chat narration | `_build_segment_voice_resolver` (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:1137-1171`) | Any `ValueError` fails the **whole** TTS request as `invalid` (:1311-1323). |
| Voice calls | `_resolve_snapshot_voice` (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_voice_call.py:404-421`) | Reads only `snapshot.character.voice`. |
| Roster metadata | `response_speaker_roster[*].has_voice = character.get("voice") is not None` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_segments.py:105`) | Frozen into each assistant message. Provider-agnostic, so no migration is needed. |

### 4.3 Prompt context (not a voice consumer)

The LLM card context renders a whitelist of text fields (for example `/home/andres/PycharmProjects/magic-worlds-api/src/services/card_context.py:156`), and the voice object is not used in prompts. Rewriting a snapshot's voice does not change LLM context. This is why section 14 recommends **not** bumping `conversation_version` during the migration [inference].

---

## 5. The `voice_preset` table

**DDL:** `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:1276-1309`

| Column | Type | MiniMax coupling |
|---|---|---|
| `preset_id` | varchar(64) PK (uuid4, `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:15134`) | none |
| `user_id` | int NULL | NULL plus `is_global=1` means a global preset |
| `project_hash`, `user_group_hash` | varchar(64) | both `''` for global (CHECK at :1304-1308) |
| `name`, `description` | | none |
| `base_voice_id` | varchar(255), utf8mb4_bin | **MiniMax system voice id** |
| `base_voice_name` | varchar(255) | display cache of the MiniMax name |
| `speed` | float, default 1 | MiniMax 0.5–2.0 |
| `volume` | float, default 1 | MiniMax (0, 10]. **Column is `volume`, while the card field is `vol`.** |
| `pitch` | int, default 0 | MiniMax −12..12 |
| `emotion` | varchar(32) | MiniMax enum (validated against `_EMOTIONS` on read, `models.py:14862,14919-14926`) |
| `language_boost` | varchar(64), default `'auto'` | MiniMax |
| `is_global` | tinyint(1) | |
| `metadata` | json NULL | **always written as NULL** (`models.py:15158`). Free for migration notes. |

**User vs global presets.**
- **Listing** returns the user's own rows plus all `is_global=1` rows (`models.py:15096-15106`).
- **Global rows are read-only.** Update and delete require `is_global = 0` (`models.py:15176-15187,15226-15238`), and **no API creates them** ("operator-provisioned", `models.py:14858-14860`). No seed `INSERT` for `voice_preset` exists in `db.sql`, `bootstrap.py` or `scripts/` (grep, this review). Any global rows in production were inserted by hand and must be migrated by the operator.

**Validation strictness.**
- Every read runs `_from_row` (`models.py:14993-15076`), and the list call uses `_required_normalized_rows` (`models.py:15107`). One malformed row (for example an emotion outside the 7 MiniMax values) makes **the whole preset list fail** for every user, because global rows appear in every list.
- The create and update payloads (`/home/andres/PycharmProjects/magic-worlds-api/src/models/voice_preset.py:8-78`) reuse the MiniMax ranges.

**How presets are referenced.**
- Only by value: the frontend copies `preset_id`, `preset_name` and the recipe into `CharacterVoice` (`VoicePickerDialog.tsx:20-31`).
- There is no foreign key and no back-reference. Deleting a user's data deletes their presets (`models.py:5118`), but cards keep the copied recipe and a dangling `preset_id`.

**Preview path.** `POST /voice-presets/preview` accepts any `voice_id` (1–256 chars) and the MiniMax ranges (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:23-42,99-118`). It stores nothing.

**System catalog.** `GET /voice-presets/system-voices` returns the MiniMax `AdminVoiceListResponse` shape (groups `system/voice_cloning/voice_generation`) (`voice_presets.py:87-96`). The frontend type `AdminVoiceEntry` (`/home/andres/WebstormProjects/magic-worlds/src/shared/types/adminVoice.types.ts:10-17`) is a MiniMax-shaped contract and must change. It is not persisted.

---

## 6. Voice-call storage

### 6.1 `voice_session`

DDL: `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:250-299`

| Column | Value today | Coupling |
|---|---|---|
| `stt_provider` / `stt_model` | `'groq'` / `'whisper-large-v3'` | STT unchanged by this migration |
| `tts_provider` | default **`'minimax_streaming'`** (:263) | Validated on **insert** (`/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:5842-5848`) **and on read** (`models.py:5343-5353`: "Stored voice_session provider/audio identity is invalid"). Config also pins it (`/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:91,153-156,344-348`). |
| `metadata` | `{raw_audio_retention, billing, client?}` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:591-596`) | **No voice snapshot** is stored on the session. |

The voice is resolved at call start from the chat's frozen snapshot (`route_voice_call.py:486`). It is held only in memory (`_VoiceCallRuntime.voice`, `engine.py:649`), falling back to `VOICE_MINIMAX_TTS_VOICE_ID` (`engine.py:512-515`).

**Migration.**
- Do not rewrite historical rows; they record the truth.
- Widen both validators to accept `{'minimax_streaming', 'elevenlabs_streaming'}` (name to be decided).
- New rows get the ElevenLabs value.
- If only the literal is switched, **call history** (`GET /voice-calls`, `models.py:5413+`) fails on old rows.

### 6.2 `voice_transcript_segment`

DDL: `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:301-356`

- `tts_summary` JSON (:318) for assistant lines is `{"status","asset_id","duration_ms","voice_id"}`. The **raw MiniMax `voice_id` is stored in plaintext** (`/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:2077-2082`). It is not exposed by the API (`route_voice_call.py:740-766` returns `audio_url` only).
- `transcript_text` is the agent's spoken text "persisted and displayed as-is" (`/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/transcript_sanitizer.py:126-131`; persisted at `engine.py:1818`). It **contains MiniMax inline syntax**: pause markers `<#0.5#>` (pattern at `transcript_sanitizer.py:51`) and interjections such as `(laughs)`, which are kept for TTS (`transcript_sanitizer.py:170-181`). The same text is the call turn's `adventure_message.content`.

**Migration.**
- Keep the rows. `tts_summary.voice_id` is useful provenance.
- Do **not** rewrite `transcript_text`. Strip MiniMax markers at **display** time and convert them at **TTS** time:
  - `<#x#>` becomes `<break time="xs"/>` on models that support break tags, which are limited to 3 s [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices], or an ellipsis on v3/v4, which do not support SSML breaks (same source).
  - `(laughs)` becomes `[laughs]` on v3/v4 [verified: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-do-audio-tags-work-with-eleven-v3-and-v4].
- *(Added during verification.)* The markers originate in the callbot graph prompt, which tells the LLM to write `(laughs)`/`(sighs)` and `<#0.5#>` when `CALLBOT_INTERJECTIONS_ENABLED` is on (`/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/runtime/callbot_chat.v2.json:32`; flag at `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:114-118`; graph hash pinned at `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/builtin_agents.v1.json:40`). The sanitizer treats MiniMax pause markers as the **only** allowed angle-bracket markup and fails closed on any XML/HTML-shaped tag (`/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/transcript_sanitizer.py:46-52,118-120`). So the prompt must **not** be changed to emit ElevenLabs `<break/>` tags; keep a neutral marker in stored text and convert after validation. Changing the prompt changes the graph hash recorded in new execution records.
- *(Added during verification.)* No display-time stripping exists today: the call transcript renders `segment.text` raw (`/home/andres/WebstormProjects/magic-worlds/src/features/call/components/CallTranscriptView.tsx:63,87`), and a frontend grep for `<#` finds only the admin synthesis-lab files.

### 6.3 Stored call audio

The assistant's MP3 per call turn is saved as a `tts_job` plus `tts_asset` with `source='call_character_tts'` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:2346-2444`). Hard-coded values in that function:

| Line | Hard-coded value |
|---|---|
| :2385 | `voice_id_hash = voice_signature_sha256(voice)` |
| :2394 | `sample_rate=32_000` |
| :2406-2408 | `model_alias="speech_2_8_turbo"`, `provider="minimax"`, `provider_model_id="speech-2.8-turbo"` |
| :2391 *(added during verification)* | `hex_payload=audio_bytes.hex()`: storage only ingests hex (`/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/storage.py:53-58,82-112,191-202`), a MiniMax artefact; ElevenLabs returns binary, so the storage API should take bytes |
| :2414 *(added during verification)* | `input_summary.model_alias = "speech_2_8_turbo"` (a second literal in the same call) |

ElevenLabs offers **no 32 kHz MP3**. The MP3 formats are 22.05/24/44.1 kHz [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert]. Every 32 kHz literal must become data-driven:
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/delivery.py:342-353` rejects chunks that are not 32 kHz, and `send_audio_chunk` defaults to 32 kHz (`delivery.py:159`, added during verification);
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:22` (`MINIMAX_SAMPLE_RATE = 32_000`), `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:29` (`sample_rate: Literal[32000]`) and `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:48` (added during verification);
- `/home/andres/WebstormProjects/magic-worlds/src/shared/types/voice.types.ts:165-170` types `sample_rate: 32000`.

### 6.4 Call-turn messages and execution records

| Location | Content | Validation |
|---|---|---|
| `adventure_message.metadata.voice` | `{voice_session_id, segment_seq, stt_provider:'groq', tts_provider:'minimax_streaming', partial}` (written at `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/callbot_execution.py:123-124`) | Strictly checked in `validate_output` and `finish` (`/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/conversation_turn_store.py:388-397,597-606`). `validate_output` also runs on **replay** (`conversation_turn_store.py:463-494`). |
| `tb_llm_execution_plan.frozen_payload` / `result` | Callbot plan payload with `agt.metadata.conversation_context.voice`, and the output metadata. **In addition (added during verification), every chat, group-chat, adventure and callbot turn freezes a full copy of the session's `template_snapshot` — including every voice object — under `agt.metadata.conversation_snapshot`** (`/home/andres/PycharmProjects/magic-worlds-api/src/services/conversation_execution.py:118-121`) | Immutable; DDL at `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:1834-1872`. Retry and recovery compare that frozen copy byte-for-byte with the live snapshot (section 14.4). |

**Migration.**
- Do not rewrite. The values are part of frozen, hashed execution records.
- Change the validators to accept the legacy literal **and** the new one.
- If only the literal is switched, reconciling an old call turn (`GET /character-chats/{id}/voice-turns/{request_id}`, `route_character_chat.py:957`) raises `CHAT_EXECUTION_RECORD_INVALID` (500).

### 6.5 `voice_consent`

`consent_version` (DDL `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:195-206`, default `voice-v1` at `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:26`) records acceptance of a disclosure that **names MiniMax as the TTS processor**:
- `/home/andres/WebstormProjects/magic-worlds/src/app/i18n/locales/en.ts:4823` ("…replies are spoken with MiniMax text-to-speech.");
- the privacy page at `/home/andres/WebstormProjects/magic-worlds/src/app/i18n/locales/en.ts:2047`.

Changing the processor should bump `VOICE_CONSENT_VERSION`. The existing stale-consent flow then re-prompts users (`en.ts:4816`). Legal review is needed.

---

## 7. `tts_job`, `tts_asset`, and narration metadata

### 7.1 `tts_job` columns tied to provider, model, or voice

DDL: `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:624-698`

| Column | Today | Coupling / constraint |
|---|---|---|
| `source` | enum `chat_tts_request`, `call_character_tts` (:635) | provider-agnostic |
| `model_alias` | `speech_2_8_turbo` | free varchar(128) in SQL, but pinned in code: `TtsJobPublic.model_alias: Literal["speech_2_8_turbo"]` (`/home/andres/PycharmProjects/magic-worlds-api/src/models/tts.py:61`), `tts_job_public_from_row` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py:980-981,997`), `_validated_tts_job` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_tts_delivery.py:536`) |
| `provider` | `'minimax'` default (:639) | **CHECK `provider = 'minimax'`** (:670). Python allow-list `{"minimax"}` (`/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:8497-8502`). Asset creation requires the parent job's provider to be `"minimax"` (`models.py:8991-8996` via `_required_asset_parent_job`, `models.py:653-679`). |
| `provider_model_id` | `speech-2.8-turbo` | registry `Literal` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:24-32`); config guard (`/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:88-92`) |
| `voice_id_hash` | sha256 of the **full MiniMax recipe** (`registry.py:104-119`), or of the bare default id (`registry.py:183-186,260-261`) | part of the reuse key |
| `normalized_text_sha256` | sha256 of the normalized text | part of the reuse key |
| `input_summary` JSON | `{operation, model_alias, provider_model_id, text_length_chars, text_sha256, voice_id_sha256, segment_index, segment_count, kind, speaker_id, speaker_name}` (`registry.py:193-200` plus `engine.py:259-260,817-849`) | No raw voice id or text. `speaker_name` is stored. |
| `result_summary` JSON | MiniMax-specific `provider_status`, `status_code`, `status_msg` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:185,198,237-243`) | Analytics on old and new rows must branch on `provider`. |
| `error_provider_status_code` | MiniMax `base_resp.status_code` (1026, 2056, …) | Semantics differ from ElevenLabs HTTP status and `detail.code` [verified: https://elevenlabs.io/docs/eleven-api/resources/errors] |
| `provider_trace_id_hash` | sha256 of the MiniMax trace id | would hold the ElevenLabs `request_id` (its errors carry `detail.request_id`, same source) |
| (no FK to `adventure_session`) | only `fk_tts_job_user` (:656) | Jobs and assets **outlive** deleted chats, leaving orphans (section 16) |

Row normalization on read (`models.py:723-741`) does **not** check `provider`, so old rows read fine once the public serializers accept the legacy alias.

### 7.2 The reuse/dedupe query and what happens when ids change

`find_reusable_chat_job` (`/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:8650-8716`) matches on `(user, project, group, adventure_id, assistant_message_id, turn_id, segment_index, model_alias, provider_model_id, voice_id_hash, normalized_text_sha256, provider)`. It returns a job that is either in flight, or completed with a live MP3 asset. It is called **before** quota (`engine.py:226-258`). Index: `idx_tts_job_reuse` (`db.sql:694`).

After the migration:
- `provider`, `model_alias`, `provider_model_id` and `voice_id_hash` all change. **No old MiniMax job will ever be reused** for a new request. This is correct: the audio would be in a different voice.
- Re-requesting narration of an old message creates a new ElevenLabs job, which costs quota as usual. On completion it **overwrites** `adventure_message.metadata.tts_segments[index]` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_tts_delivery.py:503-525`). The old job and asset become unreferenced but stay on disk.
- **Hash v2 requirement.** The voice hash must include provider, model, ElevenLabs settings, `language_code` and the emotion/tag mapping (section 12.4). Otherwise changing `stability` would reuse stale audio.
- **Note (pre-existing).** The query does not filter `source`. A narration request for a call-turn message with matching keys could reuse the `call_character_tts` job. This is harmless but surprising.

### 7.3 `tts_asset`

DDL: `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:700-719`

| Column | Notes |
|---|---|
| `storage_backend` | enum `local_fs` |
| `storage_path` | `YYYY/MM/{job_id}/{asset_id}.mp3`. Validated only as a relative `.mp3` path (`/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:395-408`), so it is provider-agnostic. |
| `content_type`, `output_format` | must be `audio/mpeg` / `mp3` on write (`models.py:8956-8962`) and read (`models.py:744-754`). The ElevenLabs default output is `mp3_44100_128` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert], so this is compatible. |
| `sample_rate` | 32000 today. Read bounds 8 000–48 000 (`/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py:1031`, `/home/andres/PycharmProjects/magic-worlds-api/src/models/tts.py:49`). 22 050, 24 000 and 44 100 are accepted. |
| `bitrate` | 128000 today. Read bounds 32 000–320 000 (`engine.py:1033`, `/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_tts_delivery.py:598-602`). ElevenLabs `mp3_22050_32` gives 32 kbps, exactly the floor. |
| `provider_url_hash` | sha256 of the **hex payload** (`engine.py:664`), which is misnamed. For ElevenLabs it would hash the binary or the `request_id`. Nullable. |

### 7.4 `adventure_message.metadata.tts_segments` and frontend hydration

- **Writer:** `_metadata_patch_for_job` (`chat_tts_delivery.py:503-525`) and the failure patch (:343-371).
- **Entry shape:** `{segment_index, segment_count, kind, speaker_id, speaker_name, job_id, status, url, assets:[{asset_id, url, content_type, file_size_bytes, output_format, duration_ms?, sample_rate?, channels?, bitrate?}], error}`.
- **No voice id is stored** in `tts_segments`, only job and asset references. `speaker_id` is the public card id used for routing.
- **Editing** an assistant message drops these sidecars (`/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:19277-19291`).
- **Frontend:** `storedMessagesToTurns` casts `metadata.tts_segments` values to `ChatTtsSegmentClip` without validation and sorts them by `segment_index` (`/home/andres/WebstormProjects/magic-worlds/src/features/interaction/chatSessionConfig.ts:71-84,120`; types at `/home/andres/WebstormProjects/magic-worlds/src/shared/types/interaction.types.ts:116-154`). It plays `url` and `assets[0].url` through authenticated blob fetches.

**Migration.** None needed. Old clips stay playable while the asset rows and files exist. If the team later adopts Text to Dialogue (one request for a whole multi-voice turn; up to 10 unique voices; about 2 000 characters total [verified: https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert]), the per-segment job model (`segment_index` in the reuse key) changes. `tts_segments` would then hold one clip per turn, and the frontend already handles a list of length 1.

---

## 8. Export, import, sharing, generation and other negative checks

| Surface | Carries `voice`? | Evidence |
|---|---|---|
| Card export | **No.** PNG only (`GET /{card_type}/{card_id}/export.png`, `/home/andres/PycharmProjects/magic-worlds-api/src/routes/card_exports.py:25-58`). The "Voice" section in the render is the text category group (Speech Style, Catchphrase), not the TTS voice (`/home/andres/PycharmProjects/magic-worlds-api/src/services/card_export/content.py:124-137`). No JSON is embedded in the PNG (grep for `tEXt`/`PngInfo`/`json` in `card_export/`: none). | — |
| Public gallery, share links, import, clone, duplicate | **Yes.** Public and shared reads hydrate full props (`card_body.py:179-268`). Only `default_persona_id` is stripped (`/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:9656,10077-10088`). Clones copy the body, including `voice` (`models.py:10930-10951`). | A cloned voice keeps the **original owner's** `preset_id`, which dangles. A public card's MiniMax id propagates into every importer's library. |
| AI card generation (`character.v2.json`, `adventure_template.v2.json`) | Produces `voice: null`. The "voice" mentions in the prompts refer to the text persona voice (grep in `/home/andres/PycharmProjects/magic-worlds-api/src/agent_graphs/content_generation/`). The replay record `tb_llm_card_generation.output_snapshot` (`db.sql:1966`) must contain every `CARD_PROPS` key, including `voice` (`card_body.py:271-321`). | Keep `voice` as **a single props key** so replay validators are unaffected. |
| Card assistant | Cannot write `voice` (it is not in `_ALLOWED_ROOT_FIELDS`, `/home/andres/PycharmProjects/magic-worlds-api/src/services/assistants/card.py:41-55`), but appears to **erase** it (section 17.1). `tb_llm_assistant_turn.output_snapshot` (`db.sql:1987`) stores the planned target. | Read-tolerant validators needed. No rewrite. |
| Story Studio (`story_card_ref.snapshot`) | **No.** `StoryCardSnapshot` whitelists fields with `extra="forbid"`, and there is no `voice` (`/home/andres/PycharmProjects/magic-worlds-api/src/models/story.py:49-65`). `_clone_snapshot` filters keys to the model fields (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/stories.py:316-332`). | Verify with the negative-count query in section 18. |
| Lorebooks (`lorebook_attachment.snapshot`) | Not expected (lorebook documents) | Verify with the negative-count query. |
| `tb_operation_receipt.result_snapshot` | Legacy AI-card results. `voice` is null (`db.sql:2000-2036`). | None |
| LLM prompts | No (`card_context.py:156` whitelists fields) | — |

The theme-song cutover already enumerated the same set of card-derived JSON documents, and it is the best precedent for this migration (`/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/theme_song_cutover.py:44-58`, `REFERENCE_DOCUMENTS`).

---

## 9. Defaults, seeds, fixtures, and user-facing copy

| Item | Location | Migration |
|---|---|---|
| `TTS_DEFAULT_VOICE_ID` (narration default; used whenever a voice is absent) | parsed at `/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:205-208`; listed in settings at :38-49; documented at `/home/andres/PycharmProjects/magic-worlds-api/.env.example:424` and `/home/andres/PycharmProjects/magic-worlds-api/docker-compose.yml:133` | Replace with an ElevenLabs id the account **owns** (not a Default voice; section 11.2). Validate it at startup (readiness) with `GET /v1/voices/{voice_id}`. |
| `VOICE_MINIMAX_TTS_VOICE_ID` (call default) | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:51,94,160,356-359`; startup check "requires a valid MiniMax default voice_id" (`/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:512-515`); `.env.example:497`; `docker-compose.yml:155` | Rename (for example `VOICE_TTS_DEFAULT_VOICE_ID`) and consider merging it with the narration default. |
| Frontend recipe defaults | `DEFAULT_SPEED=1`, `DEFAULT_VOL=1`, `DEFAULT_PITCH=0` (`/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/constants.ts:34-36`); `LANGUAGE_BOOST_OPTIONS` (:92-105); MiniMax interjections (:108); MiniMax id-prefix languages (:113-137) | Replace with ElevenLabs settings defaults (stability 0.5, similarity 0.75, style 0, speaker boost true, speed 1.0 [verified: https://elevenlabs.io/docs/api-reference/voices/get]). |
| Seed presets | none in code (section 5) | Operator inventory query |
| Fixtures / stories / tests | `/home/andres/WebstormProjects/magic-worlds/src/features/admin/playAdminAuditFixtures.tsx:33-34` (`English_Warm_Narrator`); 68 backend test files contain the literal `minimax` (`grep -rli minimax tests`). Frontend: 7 test files contain the literal `minimax` (4 of them are theme-song tests for the fal-hosted `minimax_music_3` alias, which stays), and 13 test files match the broader MiniMax data patterns (`minimax`, `language_boost`, `English_*` ids, `<#`, `minimax_streaming`) *(corrected during verification: "13 reference MiniMax" only holds for the broader pattern)*. Stories: see section 18.1 | Rewrite with neutral 20-character fixture ids |
| Consent and privacy copy | `en.ts:2047,4823`; `es.ts` equivalents at `/home/andres/WebstormProjects/magic-worlds/src/app/i18n/locales/es.ts:2057,4833` (lines added during verification); backend operator note at `/home/andres/PycharmProjects/magic-worlds-api/.env.example:478-480` (`VOICE_CONSENT_VERSION=voice-v1`, disclosure names "MiniMax streaming TTS") | Rewrite, then bump the consent version (section 6.5) |
| Docs screenshots | `/home/andres/WebstormProjects/magic-worlds/src/assets/marketing/index.ts:35-36,91-92` (voice-presets and voice images) | Re-shoot after the Studio change |
| Feature flag | `VITE_FEATURE_VOICES_ENABLED` (`/home/andres/WebstormProjects/magic-worlds/src/shared/featureFlags.ts:30-31`) | Can gate the Studio during the cutover window |

---

## 10. Read paths that validate voice ids

Nothing in either repo checks a voice id against a provider catalog (baseline review §2, "Validation"). Most checks are **length-only**, so they accept both MiniMax ids and ElevenLabs ids. That is the problem: **nothing stops a stale MiniMax id from reaching ElevenLabs.**

| # | Repo | Location | Rule | Accepts MiniMax ids? | Accepts ElevenLabs ids? | Action |
|---|---|---|---|---|---|---|
| 1 | BE | `CharacterVoice.voice_id` (`/home/andres/PycharmProjects/magic-worlds-api/src/models/character.py:17`) | 1–256 chars | yes | yes | Add a `provider` discriminator. Optionally warn (do not reject) when an ElevenLabs id does not match `^[A-Za-z0-9]{20}$`, since ElevenLabs does not document the format (section 11.1). |
| 2 | BE | `ResolvedVoice.__post_init__` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:47-53`) | non-empty, stripped, ≤256 | yes | yes | Carry `provider`. Resolve legacy ids through the mapping (lazy safety net). |
| 3 | BE | `build_resolved_voice` (`registry.py:71-101`) | strict types, MiniMax ranges via `CharacterVoice` | yes | yes | Becomes the provider-aware resolver |
| 4 | BE | `VoicePresetCreatePayload` / `UpdatePayload` `base_voice_id` (`/home/andres/PycharmProjects/magic-worlds-api/src/models/voice_preset.py:15,47`) | 1–255, stripped | yes | yes | Add `provider` and the ElevenLabs settings |
| 5 | BE | `VoicePresetModel._validate_write_data` / `_from_row` (`/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:14964-14967,15051-15053`) | ≤255 | yes | yes | Same as #4. Emotion allow-list at :14862. |
| 6 | BE | `VoicePresetPreviewPayload.voice_id` (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:28`) | 1–256 | yes | yes | Validate against the account catalog. Add a quota (baseline issue #1). |
| 7 | BE | `AdminVoiceTestRequest.voice_id` (`/home/andres/PycharmProjects/magic-worlds-api/src/models/admin_voice.py:100`) | 1–256 | yes | yes | Replace |
| 8 | BE | `AdminVoiceCloneRequest.voice_id` with `_VOICE_ID_PATTERN` (`admin_voice.py:57,219,227-236`) | MiniMax custom-id rule: starts with a letter, 8–256 chars | yes | **no** (many ElevenLabs ids start with a digit, for example `21m00Tcm4TlvDq8ikWAM` [secondary: https://developer.signalwire.com/voice/tts/elevenlabs]) | **Remove.** ElevenLabs assigns ids; callers never choose them. |
| 9 | BE | `AdminVoiceDesignRequest.voice_id` (`admin_voice.py:74`) | optional, 1–128 | yes | yes | Remove. ElevenLabs Design returns a `generated_voice_id` [verified: https://elevenlabs.io/docs/api-reference/text-to-voice/design]. |
| 10 | BE | Default-voice config (`/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:73-78`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:157-163`; `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:512-515`) | non-empty text | yes | yes | Add a readiness probe against the ElevenLabs catalog |
| 11 | BE | `admin_voices` DELETE path param (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:182-194`) | none | yes | yes | Replace with an ElevenLabs delete |
| 12 | FE | `validateVoiceId` (`/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/voiceIdRules.ts:13-20`) | MiniMax custom-id rule | yes | **no** (leading digit) | Remove with the MiniMax clone/design forms |
| 13 | FE | `deriveVoiceLanguage` (`/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/voiceLanguage.ts:15-21`) | parses the MiniMax id prefix | yes | every ElevenLabs id lands in "Other" | Use ElevenLabs `labels` / `verified_languages` [verified: https://elevenlabs.io/docs/api-reference/voices/search] |
| 14 | FE | `readCharacterVoice` / `snapshotVoice` (`cardTransforms.ts:57-72`, `adventureSnapshot.ts:81-96`) | non-empty after trim | yes | yes | **Whitelist drops new fields.** Must ship in lockstep with the backend expand. |
| 15 | FE | `presetMatchesVoice` (`VoicePickerDialog.tsx:35-39`) | `voice_id === base_voice_id` | — | — | Also compare `provider` |
| 16 | BE | `voice_session.tts_provider` (`models.py:5343-5353,5842-5848`) | `== 'minimax_streaming'` | — | — | Widen (section 6.1) |
| 17 | BE | `adventure_message.metadata.voice.tts_provider` (`conversation_turn_store.py:395,604`) | `== 'minimax_streaming'` | — | — | Widen (section 6.4) |
| 18 | BE | `tts_job.provider` (`db.sql:670`; `models.py:8501,8994`) and `model_alias` (`models/tts.py:61`; `engine.py:980`; `chat_tts_delivery.py:536`) | `minimax` / `speech_2_8_turbo` | — | — | Widen the CHECK and the literals to unions |
| 19 | BE | Call audio frames (`delivery.py:352`) and the FE frame type (`voice.types.ts:170`) | 32 kHz only | — | — | Make data-driven (section 6.3) |

---

## 11. ElevenLabs facts that shape the target model

### 11.1 Voice identity

- **Voice ids are opaque path parameters.** `POST /v1/text-to-speech/{voice_id}` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert]. Ids seen in docs are 20-character alphanumeric strings (`21m00Tcm4TlvDq8ikWAM`, `29vD33N1CtxCmqQRPOHJ`) [secondary: https://developer.signalwire.com/voice/tts/elevenlabs], but no official page states a format. **Do not hard-reject on format** [inference].
- **Error codes.** `voice_not_found` is 404, `invalid_voice_id` is 400, `voice_access_denied` is 403, and `invalid_voice_settings` is 400. Error bodies are `detail.{type, code, message, request_id, param}`, and `status` is legacy [verified: https://elevenlabs.io/docs/eleven-api/resources/errors]. An older SDK issue reports a 400 `voice_does_not_exist` [secondary: https://github.com/elevenlabs/elevenlabs-python/issues/293].
- **Voice categories:** `generated, cloned, premade, professional, famous, high_quality`. The voice object also has `is_legacy`, `sharing`, `verified_languages`, `labels`, `preview_url`, `settings`, `available_for_tiers`, and `safety_control` [verified: https://elevenlabs.io/docs/api-reference/voices/search; https://elevenlabs.io/docs/api-reference/voices/get].
- **Adding a Voice Library voice:** `POST /v1/voices/add/{public_user_id}/{voice_id}` with `new_name`. The response returns a `voice_id`, and the docs example returns a **different id** from the one passed in [verified: https://elevenlabs.io/docs/api-reference/voices/voice-library/share]. The mapping table must store the id **returned by this call**, not the library id. Whether the ids really differ is an open question (section 19).

### 11.2 Catalog stability (most important for the mapping table)

| Fact | Source |
|---|---|
| "All our Default voices will expire on December 31, 2026, and they will no longer be accessible after this date." Default voices are "only available for accounts that were created before March 2026". Replacements are listed by name (e.g. Roger → Darian, Sarah → Talia), and are "not a strict 1-to-1 replacement". | [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-are-default-voices] |
| Legacy voices (former Default voices) are "fully deprecated", and "Legacy voice IDs will automatically route to their replacement voice IDs" for API users (e.g. Rachel → Janet). | [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-are-legacy-voices] |
| Voice Library notice period runs from 30 days to 2 years. With a notice period, users who saved or used a voice keep access until it ends. Without one, "anyone who has saved the voice will immediately lose access." `disable_at_unix` appears in Get Voice when a notice is active. Removal webhooks are available. Library voices "do not use custom voice slots". "Voice Library voices are not available via the API to free tier users." | [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-library] |
| Webhook events `voice_removal_notice`, `voice_removal_notice_withdrawn`, `voice_removed`. Envelope `{type, event_timestamp, data}`, signed with the `ElevenLabs-Signature` header. | [verified: https://elevenlabs.io/docs/eleven-api/resources/webhooks] |
| Shared-voice listing exposes `notice_period`, `rate` (custom pricing), `free_users_allowed`, `live_moderation_enabled`, `verified_languages`, and a `min_notice_period_days` filter. | [verified: https://elevenlabs.io/docs/api-reference/voices/voice-library/get-shared] |
| Custom voice slots per plan (Starter 10, Creator 30, Pro 160, Scale/Business 660) | [secondary: https://help.elevenlabs.io/hc/en-us/articles/24351056337937] |

**Consequence for the mapping.** Map each referenced MiniMax voice to either:
- (a) a voice **the account owns**, made with Voice Design (`eleven_ttv_v3` / `eleven_multilingual_ttv_v2` [verified: https://elevenlabs.io/docs/api-reference/text-to-voice/design]) or IVC/PVC. These use custom slots and do not expire; or
- (b) a Voice Library voice with `notice_period` ≥ 365 days and no custom `rate`, saved to the account, with the removal webhooks wired up.

**Never** map to a Default voice.

### 11.3 Settings and model support (constraints on the recipe)

| Setting | Range / default | Model support |
|---|---|---|
| `stability` | default 0.5 | all models. On v3 it is the main control; on v4 it is one of only two settings. |
| `similarity_boost` | default 0.75 | not on v3 [verified: https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech]. On v4, Text to Dialogue exposes `similarity` [verified: https://elevenlabs.io/docs/changelog/2026/9/28]. |
| `style` | default 0; the docs recommend keeping it at 0 | not on v4 [verified: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/what-is-eleven-v4] |
| `use_speaker_boost` | default true | not on v3 [verified: https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech] |
| `speed` | **0.7–1.2**, default 1.0 | not on v3 [verified: https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech] and not on v4 [verified: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/what-is-eleven-v4] |
| `language_code` | ISO 639-1 | ignored on `multilingual_v2` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert] |
| Volume, pitch | **no per-request equivalent** | — [inference from the request schema at the convert reference] |
| Audio tags (`[whispers]`, `[laughs]`, `[sighs]`, `[curious]`, …) | inline in the text | v3, v4 and v4 Turbo [verified: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-do-audio-tags-work-with-eleven-v3-and-v4] |
| Break tags `<break time="x.xs"/>` (≤3 s) | inline | not on v3/v4 [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices] |

Current models [verified: https://elevenlabs.io/docs/overview/models]:
- `eleven_v4`, `eleven_v4_turbo` (released 2026-09-28 [verified: https://elevenlabs.io/docs/changelog/2026/9/28]);
- `eleven_v3`, `eleven_v3_conversational`, `eleven_multilingual_v2`, `eleven_flash_v2_5`, `eleven_flash_v2`;
- `eleven_turbo_v2_5` and `eleven_turbo_v2` are **deprecated**.

**Consequence.** The stored voice should hold **provider-neutral intent plus ElevenLabs voice settings**. The server decides the model. Unsupported settings are dropped **at request time**, not at storage time, so changing the model later needs no data migration.

---

## 12. Target data model (proposal)

### 12.1 `CharacterVoice` v2

Keep a **single `voice` props key** so that `CARD_PROPS` (`card_body.py:33-45`), card-generation replays (`card_body.py:271-321`) and snapshot shapes keep their key sets. Evolve the inner object with a discriminator:

```jsonc
// v2 (ElevenLabs). Proposed; all names to be confirmed by the implementation plan.
{
  "provider": "elevenlabs",          // discriminator; absent => legacy MiniMax v1 (read-only)
  "schema_version": 2,
  "voice_id": "<elevenlabs voice id>",
  "voice_name": "Darian",            // display cache (the catalog name may change)
  "settings": {                      // all optional; omitted => voice/account defaults
    "stability": 0.5,                // 0..1
    "similarity_boost": 0.75,        // 0..1
    "style": 0.0,                    // 0..1
    "use_speaker_boost": true,
    "speed": 1.0                     // 0.7..1.2
  },
  "language_code": "en",             // ISO 639-1 or null (replaces language_boost)
  "emotion": "calm",                 // provider-neutral intent; same 7-value enum as today
  "preset_id": "…",                  // unchanged, display-only
  "preset_name": "…"
}
```

Design notes:
- **Union type.** Use `Annotated[Union[MiniMaxVoiceV1, ElevenLabsVoiceV2], Discriminator(callable)]`, where a missing `provider` selects V1. V1 stays **readable** in frozen records (`tb_llm_*`, replays) but is **rejected on new writes** after the contract phase.
- **Keep `emotion` as neutral intent.** It is translated to an audio-tag prefix only on tag-capable models, and to a stability hint otherwise (section 13). This avoids storing model-specific tags in cards.
- **Do not store the model id per voice.** The registry stays locked server-side, as today (`registry.py:133-140`). An optional future `model_hint` should be justified separately.
- **Keep migration provenance out of the voice object.** Record it in an audit table (12.3) so strict models stay small.
- **Mirror on the frontend.** Update `voicePreset.types.ts:8-18`, `cardTransforms.ts:57-72`, `adventureSnapshot.ts:81-96` and `VoicePickerDialog.tsx:20-31` **in the same release** as the backend expand.

### 12.2 `voice_preset` v2

Expand-only DDL in a cutover module, following the `*_cutover.py` plus `scripts/migrations/2026MMDD_*.py --apply` convention (`/home/andres/PycharmProjects/magic-worlds-api/scripts/migrations/20261012_image_profiles.py:1-5,34-37`) and the `CONTENT_SCHEMA_REVISION` marker (`/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py:17`; `db.sql:2067-2076`):

| Change | Purpose |
|---|---|
| `provider varchar(32) not null default 'minimax'`, then flip the default to `'elevenlabs'` after the migration | discriminator |
| `settings json null` (CHECK object) | ElevenLabs settings |
| `language_code varchar(8) null` | replaces `language_boost` |
| Keep `speed` (re-ranged on write to 0.7–1.2 for ElevenLabs rows), `emotion` | neutral fields |
| Keep `volume`, `pitch`, `language_boost` **nullable**, written only for `provider='minimax'` rows, then drop them in the contract phase | legacy |
| `metadata.migration` (existing JSON column, always NULL today) | per-row review flags, e.g. `{"pitch_dropped": -4, "needs_review": true}` |

### 12.3 New tables

```sql
-- Curated, human-approved mapping (one row per legacy voice actually referenced).
create table voice_provider_mapping (
    legacy_provider    varchar(32)  not null,            -- 'minimax'
    legacy_voice_id    varchar(256) not null,            -- utf8mb4_bin (ids are case-sensitive)
    target_provider    varchar(32)  not null,            -- 'elevenlabs'
    target_voice_id    varchar(64)  not null,            -- id usable in OUR account (after /voices/add)
    target_voice_name  varchar(255) null,
    target_origin      enum('designed','ivc','pvc','library') not null,   -- never 'default'
    library_public_owner_id varchar(64) null,
    library_notice_period_days int null,
    default_settings   json null,                        -- stability/similarity/style/boost/speed
    default_language_code varchar(8) null,
    status             enum('proposed','approved','retired') not null,
    reviewed_by_user_id int null, reviewed_at datetime null, notes text null,
    primary key (legacy_provider, legacy_voice_id)
);

-- Reversible audit of every rewritten JSON path / preset row.
create table voice_migration_audit (
    run_id char(36) not null, table_name varchar(64) not null, row_key varchar(64) not null,
    json_path varchar(255) not null,          -- '$.voice', '$.template.characters[2].voice', 'row'
    old_voice json not null, new_voice json null, outcome enum('mapped','unmapped_nulled','unmapped_kept','skipped_active_stream') not null,
    applied_at datetime not null default current_timestamp,
    primary key (run_id, table_name, row_key, json_path)
);
```

### 12.4 Reuse hash v2

`voice_signature_sha256` (`registry.py:104-119`) must hash:
- `{provider, provider_model_id, voice_id, settings (only those the model supports), language_code, emotion→tag mapping version, output_format}`.

In addition:
- Widen the CHECK at `db.sql:670` to `provider in ('minimax','elevenlabs')` (drop `minimax` in the contract phase).
- Widen the Python allow-lists at `models.py:8501,8994`.

---

## 13. Recipe translation rules

| MiniMax field (card `CharacterVoice` / preset column) | ElevenLabs target | Rule | Data loss / review |
|---|---|---|---|
| `voice_id` / `base_voice_id` | `voice_id` | Look it up in `voice_provider_mapping` (status `approved`). The mapping is chosen by **audition**, by a human. | Unmapped ids go to the fallback policy (section 14.5) |
| `speed` 0.5–2.0 (`character.py:18`; `voice_preset.py:17`) | `settings.speed` 0.7–1.2 | `clamp(speed, 0.7, 1.2)`. Ignored at request time on v3/v4. | Flag `speed < 0.7 or > 1.2` (the distinction between 1.5 and 2.0 is lost) |
| `vol` (0,10] / `volume` | — | **Drop.** Replace narration "thought dimming" (`vol*0.6`, `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:1129-1134`) with client playback gain per `kind=='thought'` (`tts_segments[].kind` is already stored), or a `[whispers]` tag on v3/v4 [inference] | Flag `vol` ≠ 1 |
| `pitch` −12..12 | — | **Drop.** If \|pitch\| ≥ 3, mark `needs_review`: the perceived timbre differs, and another target voice may fit better (consider a per-preset mapping override). | Flag non-zero pitch |
| `emotion` (7 values) | keep `emotion` as neutral intent | At request time on v3/v4/v4-turbo, prefix the text with a tag (e.g. `sad→[sad]`, `angry→[angry]`, `happy→[happily]`, `calm→[calmly]`, `surprised→[surprised]`, `fearful→[nervously]`, `disgusted→[disgusted]`). Only `[sad]`, `[angry]`, `[happily]` and the reaction tags appear in ElevenLabs material; the rest are **[unverified]** and must be auditioned. On Flash and Multilingual v2 (no tags), optionally lower `stability` (e.g. 0.35) for strong emotions [inference]. | None at storage |
| `language_boost` (`auto`, `English`, …; the UI offers `auto` plus 11 languages at `/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/constants.ts:92-105`, but the backend accepts any string ≤64 chars, so the mapping below covers the 23-entry `KNOWN_VOICE_LANGUAGES` superset at `constants.ts:113-137`) *(clarified during verification)* | `language_code` | `auto` → null. `English`→`en`, `Chinese`→`zh`, `Japanese`→`ja`, `Korean`→`ko`, `Spanish`→`es`, `French`→`fr`, `German`→`de`, `Portuguese`→`pt`, `Italian`→`it`, `Russian`→`ru`, `Arabic`→`ar`, `Indonesian`→`id`, `Vietnamese`→`vi`, `Dutch`→`nl`, `Turkish`→`tr`, `Thai`→`th`, `Ukrainian`→`uk`, `Polish`→`pl`, `Romanian`→`ro`, `Greek`→`el`, `Czech`→`cs`, `Finnish`→`fi`, `Hindi`→`hi`. Ignored on `multilingual_v2` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert]. Unknown values → null. | Check each code against the chosen model's language list |
| `preset_id`, `preset_name` | same | Keep. Presets are migrated **in place** (same `preset_id`), so links stay valid. Clear `preset_id` on clones whose preset belongs to another user (optional hygiene). | — |
| — | `stability`, `similarity_boost`, `style`, `use_speaker_boost` | Take them from `voice_provider_mapping.default_settings`, else omit (the voice's stored settings apply) | — |
| Inline text: `<#x#>`, `(laughs)`, `word/(ipa)` (admin lab and callbot) | break tag / ellipsis / `[laughs]` / v4 IPA in slashes | Convert at TTS time, never in stored text. v4 accepts IPA written inside forward slashes in the text [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices]. | — |

---

## 14. Migration strategy: lazy vs one-shot, ordering, rollback

### 14.1 Per-location decision

| Location | One-shot rewrite | Lazy (on read/synthesis) | Never rewrite |
|---|---|---|---|
| Live cards (`tb_card_body`, `tb_card_draft`) | **Yes.** Users see the voice in editors, and lists fail on bad data. | safety net | |
| `tb_card_version` | **Yes.** Precedent: the theme-song cutover lists `tb_card_version.props` as a reference document with no auto-updated timestamp (`theme_song_cutover.py:50-53`) and nulls retired `theme_song_url` references inside it *(clarified during verification: it nulls one reference field rather than rewriting whole props)*. | safety net when restoring | |
| Adventure-template cast copies | **Yes** (cheap, keeps strict reads happy) | | |
| Session snapshots (all kinds) | **Yes.** Chats are not user-editable, and calls read them. | safety net | |
| `voice_preset` | **Yes** (schema expand plus rewrite) | | |
| `tts_job`, `tts_asset`, `voice_session`, `voice_transcript_segment` | | | **Yes.** Historical truth; widen validators. |
| `adventure_message.metadata.voice`, `tb_llm_execution_plan`, `tb_llm_*` snapshots, receipts | | | **Yes.** Frozen, hashed execution records; widen validators. |
| Stored text with MiniMax markers | | convert at display/TTS | **Yes** |

**Why both.** A one-shot rewrite gives a clean dataset and predictable UX. A lazy resolver in `build_resolved_voice` (legacy V1 → mapping lookup → V2) covers what the batch missed:
- restored versions;
- clones of stale public cards;
- races with in-flight edits;
- rows skipped because a stream was active.

The lazy resolver must **never write back** implicitly, to keep reads side-effect-free [inference].

### 14.2 Ordering (expand → migrate → switch → contract)

1. **Release N (expand).**
   - **Backend:**
     - reads V1 and V2 voices everywhere and writes V2 only when the voice is ElevenLabs;
     - provider literals become unions (section 10, rows 16-19);
     - the `tts_job` CHECK is widened;
     - the mapping and audit tables are created.
   - **Frontend:** whitelists pass V2 fields through, and types are updated. The Voice Studio can stay on MiniMax behind the flag.
   - **Gate:** advance `CONTENT_SCHEMA_REVISION` (`bootstrap.py:17`) only after the DDL.
2. **Inventory (`--check`).** Run the read-only counts (section 18). Export the distinct legacy voice ids with reference counts and recipe-field usage. **Without** `--apply`, nothing changes.
3. **Curate the mapping.** Audition, then approve. Create or design owned voices; add library voices with `POST /v1/voices/add/…` and store the returned id.
4. **Apply (`--apply`).** Use a reviewed run, as in the theme-song "review with exact counts" pattern (`theme_song_cutover.py:1-25`):
   - batch by primary key;
   - keep `updated_at` / `adventure_last_update` unchanged (precedent comment at `theme_song_cutover.py:47-49`);
   - for snapshots, **do not bump** `conversation_version`, but use an optimistic `WHERE conversation_version = <read>` and **skip rows with `active_stream_id IS NOT NULL`** (retry later);
   - write one audit row per rewritten path.
5. **Switch the provider.**
   - Drain or terminalize non-terminal `tts_job` rows.
   - End active calls.
   - Set ElevenLabs defaults (`TTS_DEFAULT_VOICE_ID`, call default).
   - Flip config to ElevenLabs.
   - Bump `VOICE_CONSENT_VERSION`.
6. **Release N+1 (contract).**
   - Reject V1 on writes.
   - Drop MiniMax preset columns.
   - Narrow the CHECK to `'elevenlabs'` **only if** no legacy rows must stay readable. Otherwise keep the union for history.
   - Remove the MiniMax code.

### 14.3 Rollback

- Before step 5: reverse the rewrite from `voice_migration_audit.old_voice` (V1 objects stay valid for release-N readers).
- After step 5: rollback means re-enabling MiniMax, which contradicts the goal. Keep the audit table for one release cycle, then drop it [inference].

### 14.4 Concurrency hazards

| Hazard | Mitigation |
|---|---|
| User saves a card with the old frontend during the window | Ship the frontend whitelist change in release N, before `--apply` |
| Snapshot PUT racing the rewrite | Optimistic version check (above) |
| `tts_job` created with a MiniMax voice right before the switch | Stale cleanup terminalizes it (`/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py:296-316`). Baseline issue #8 notes the cleanup is per-user and late, so run a global sweep at the switch. |
| In-process caches | The system-voice list cache (5 min, `SYSTEM_VOICE_CACHE_TTL_SECONDS`, `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:46,214-216,243-257`) and call runtimes are in memory. Restart the API (single process, baseline issue #19). |
| Retry / recovery of a turn frozen before the rewrite *(added during verification)* | Every chat execution freezes the session's full `template_snapshot` in `tb_llm_execution_plan.frozen_payload` → `$.agt.metadata.conversation_snapshot` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/conversation_execution.py:118-121`). `prepare_retry` requires the live `template_snapshot` to be byte-equal to the parent's frozen copy (`/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/conversation_turn_store.py:124-137`) and otherwise raises `CHAT_RETRY_CONFLICT` 409 (`conversation_turn_store.py:177-178`); `restore` (crash recovery of an in-flight turn) requires full equality too (`conversation_turn_store.py:241-252`). Consequence: after a snapshot voice rewrite, "retry" on a failed/cancelled turn from before the migration is rejected with 409, whether or not `conversation_version` is bumped. Mitigation: skip sessions with `active_stream_id IS NOT NULL` (already planned), accept or announce the 409 for old failed turns, and count them first: `SELECT feature_key, COUNT(*) FROM tb_llm_execution_plan WHERE status IN ('failed','cancelled') AND JSON_EXTRACT(frozen_payload,'$.agt.metadata.conversation_snapshot.template_snapshot**.voice_id') IS NOT NULL GROUP BY feature_key;` |
| Live request racing the rewrite *(added during verification)* | `prepare` compares `conversation_version` and `template_snapshot` against the session read at request start and returns `CHAT_CONTEXT_STALE` 409 on mismatch (`conversation_turn_store.py:90-91`). This is safe: the user retries. |

### 14.5 Unmapped-id policy (needs a product decision)

| Option | Effect |
|---|---|
| A: Null the voice and fall back to the default voice | Narration keeps working in a different voice; `has_voice` becomes false for future turns |
| B: Keep the V1 voice; the lazy resolver substitutes the default voice at synthesis and logs it | No data loss; recoverable if a mapping is added later |
| C: Keep V1 and fail synthesis with a clear category (`voice_unavailable`) | Explicit but user-hostile |

Recommendation: **B for snapshots** (frozen history) and **A or B for live cards**, with an in-app badge "voice needs re-selection" [inference].

---

## 15. What breaks if an unmapped MiniMax id reaches ElevenLabs

| Path | Request | Expected ElevenLabs answer | Current app behaviour (with the error mapping ported naively) | User impact |
|---|---|---|---|---|
| A. Chat narration (one job per segment) | `POST /v1/text-to-speech/{minimax_id}` | 404 `voice_not_found` [verified: https://elevenlabs.io/docs/eleven-api/resources/errors]. Ids with spaces or parentheses (e.g. `Chinese (Mandarin)_…`) must be URL-encoded and will likely return 400 `invalid_voice_id` or 404 [inference]. | The job becomes terminal-failed, `tts_failed` is broadcast, and a "Narration failed" notification is created. Segment 0 already reserved quota and failures are not refunded (baseline #7). A failed segment halts the multi-voice player (baseline #3). | The user pays a narration credit for silence. The other segments' voices may also fail. |
| A'. Recipe out of range | speed 1.5 sent as-is | 400 `invalid_voice_settings` is plausible, or the value is clamped [unverified] | same as A | same |
| A''. `TTS_DEFAULT_VOICE_ID` left as a MiniMax id | every voiceless segment | 404 | **Every** narration without an assigned voice fails. The startup config check only verifies non-empty text (`/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:73-78`), and the per-request check only verifies a stripped string of at most 256 characters (`/home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/registry.py:264-276`) *(corrected during verification: registry.py:264-276 is a per-request check, not a startup check)*. | Global outage of default narration |
| B. Voice call | WS `/v1/text-to-speech/{id}/stream-input` [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input] | handshake or first-message error, or close [unverified exact behaviour] | `tts_unavailable` / `tts_timeout` after the 15 s first-audio timeout (baseline §2 Path B). STT audio is already billed (1 credit per 10 s, counting STT + TTS). | The character never speaks. The call may end. |
| C. Studio preview | `POST /voice-presets/preview` | 404 | HTTP error surfaced as a preview error | Confusing but harmless |
| Library voice on a free-tier key | any | 403 `voice_access_denied` (inference from [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-library]) | as A/B | Applies only if the production key were free tier |

**Guards to add** [inference]:
1. Resolve and validate before enqueue: legacy id → mapping → else fallback (section 14.5). Never call ElevenLabs with a V1 voice.
2. Map 404/400 voice codes to a new non-retryable category (`voice_unavailable`) and **refund** the reservation.
3. Readiness probe for the default voice ids.
4. Subscribe to `voice_removal_notice` / `voice_removed` and record `disable_at_unix` on mapping rows.

---

## 16. Old MiniMax MP3 assets: keep vs purge

**What keeps working with no data change.**
- `GET /tts/assets/{asset_id}.mp3` is owner-checked and does not look at the provider (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/tts.py:103-141`; `/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:9055-9071`).
- Narration clips in `tts_segments` and call-history audio (`route_voice_call.py:740-766`) therefore stay playable.

**What must be adjusted.** `GET /tts/jobs/{id}` (and any `tts_complete` replays) serialize through `tts_job_public_from_row`, which requires `model_alias == "speech_2_8_turbo"` (`engine.py:980`). When ElevenLabs aliases are added this must become a set that **keeps** the legacy alias, and the same goes for `models/tts.py:61` and `chat_tts_delivery.py:536`. *(Added during verification.)* The same serializer feeds the background-tasks drawer (`/tasks`): `/home/andres/PycharmProjects/magic-worlds-api/src/services/media_tasks.py:11,15` maps `text_to_speech` tasks through `tts_job_public_from_row` and `task_from_tts_job` (`/home/andres/PycharmProjects/magic-worlds-api/src/models/task.py:98-109`), and generation notifications require a `TtsJobPublic` DTO (`/home/andres/PycharmProjects/magic-worlds-api/src/services/notifications.py:48-49,144-154`). If the alias literal were switched instead of widened, a user's task list would fail on any old MiniMax job.

**Purge considerations.**
- There is no retention today, and deleting a chat or message leaves the files (baseline #9).
- `tts_job` has **no FK** to `adventure_session` (`db.sql:656`), so jobs and assets of deleted chats remain as orphans.
- `delete_all_user_data` deletes `tts_job` rows, and therefore `tts_asset` by cascade (`models.py:5131`; `db.sql:716`), but not the files.
- Whether MiniMax terms restrict keeping generated audio after the contract ends is **[unverified]** and needs a legal check.

**Recommendation** [inference]:
- **Keep** MiniMax audio that is still referenced by an existing message or transcript, so history stays audible.
- In the same cutover, run a **reviewed orphan sweep**:
  1. assets whose job's `adventure_id` no longer exists;
  2. files under `TTS_STORAGE_ROOT` with no `tts_asset` row;
  3. assets no longer referenced by any `tts_segments` or `tts_summary`.
- Reuse the theme-song pattern: mark deleted, remove files, then delete rows (`theme_song_cutover.py:14-25`).
- Optionally add an age-based retention for unreferenced assets afterwards.

---

## 17. Pre-existing defects that interact with the migration

1. **The card assistant appears to erase `voice`** (code reading; no test covers it).
   - **Patch path:** `_merge_patch` keeps only `_ALLOWED_ROOT_FIELDS ∪ _OWNER_PRESERVED_ROOT_FIELDS`, and `voice` is in neither (`/home/andres/PycharmProjects/magic-worlds-api/src/services/assistants/card.py:41-55,97-102,361-378`).
   - **Replace path:** builds the card from the LLM payload, which has no voice (`card.py:584-605`).
   - **Result:** the planned card dumps `voice: null`, and `_apply_card_assistant_target` writes those props into `tb_card_draft` (`/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:17073-17169`).
   - **Fix before the migration:** add `voice` to the owner-preserved fields. Otherwise migrated voices vanish after any assistant edit.
2. **Frontend whitelists strip unknown voice fields** (sections 3.3 and 10, row 14).
3. **One bad voice breaks everything nearby.**
   - Card lists fail as a whole (`models.py:11128-11131`) and preset lists fail as a whole (`models.py:15107`).
   - Narration fails for the whole turn (`route_chat.py:1311-1323`).
   - `CharacterVoice` and `ResolvedVoice` disagree on validity (baseline #10).
4. **Dangling `preset_id` after clone or import** (section 8).
5. **32 kHz assumptions** in call audio and frame types (section 6.3).
6. **MiniMax markup persisted in transcripts and message content** (section 6.2).
7. **`chat_tts_delivery` private-text markers** contain `"minimax"` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/chat_tts_delivery.py:28-49`). A speaker name containing "minimax" fails delivery (baseline #6). Revisit the list (e.g. add `xi-api-key`) without adding plain words that can appear in character names.
8. **Orphaned TTS jobs and assets** (section 16).

---

## 18. MIGRATION SURFACE table

SQL targets MySQL 8.0 (the schema already uses `json_schema_valid` and `regexp_like`). `->` / `->>` are `JSON_EXTRACT` / `JSON_UNQUOTE(JSON_EXTRACT())`. A wildcard path such as `$**.voice_id` returns an array of every matching value. **None of these queries were run.** If a comparison between `->>` output and a `utf8mb4_bin` column raises a collation error, append `COLLATE utf8mb4_bin`.

| # | Location | Repo | Storage (table.column / JSON path / file) | Copy semantics | Approx. volume query (do NOT run blind) | Migration action | Risk |
|---|---|---|---|---|---|---|---|
| 1 | Character card voice | BE | `tb_card_body.props` → `$.voice` (`card_type='character'`, both roles) | **Live** (editable) | `SELECT props->>'$.role' AS role, COUNT(*) AS cards, COUNT(DISTINCT props->>'$.voice.voice_id') AS ids FROM tb_card_body WHERE card_type='character' AND JSON_TYPE(props->'$.voice')='OBJECT' GROUP BY role;` | One-shot V1→V2 through the mapping; keep `updated_at`; audit | **High**: strict read; one bad row breaks the user's card list |
| 2 | Adventure-template cast copies | BE | `tb_card_body.props` → `$.persona.voice`, `$.characters[*].voice` (`card_type='adventure_template'`) | Live display copy (sessions re-resolve the live card) | `SELECT COUNT(*) FROM tb_card_body b, JSON_TABLE(JSON_EXTRACT(b.props,'$**.voice_id'),'$[*]' COLUMNS(vid VARCHAR(256) PATH '$')) jt WHERE b.card_type='adventure_template';` | One-shot rewrite | Medium |
| 3 | Card drafts | BE | `tb_card_draft.props` → `$.voice` | Live, owner-private | `SELECT COUNT(*) FROM tb_card_draft WHERE card_type='character' AND JSON_TYPE(props->'$.voice')='OBJECT';` | One-shot rewrite (keep `updated_at`) | Medium |
| 4 | Card version history | BE | `tb_card_version.props` → `$.voice` | Frozen history, restorable | `SELECT COUNT(*) FROM tb_card_version WHERE card_type='character' AND JSON_TYPE(props->'$.voice')='OBJECT';` | One-shot rewrite (precedent: theme-song cutover) plus lazy translation on restore | Medium: a restore brings back V1 otherwise |
| 5 | Public / shared cards (propagation) | BE | same rows as #1 where `tb_card.card_public=1` or there is an active `card_share_link` | Live; clones copy by value | `SELECT c.card_public, COUNT(*) FROM tb_card c JOIN tb_card_body b ON b.card_id=c.card_id WHERE b.card_type='character' AND JSON_TYPE(b.props->'$.voice')='OBJECT' GROUP BY c.card_public;` | Covered by #1. Optionally clear foreign `preset_id`. | Low–Medium: stale ids spread to importers until migrated |
| 6 | Dangling preset links | BE | `$.voice.preset_id` with no matching `voice_preset` row | Live | `SELECT COUNT(*) FROM tb_card_body b LEFT JOIN voice_preset p ON p.preset_id=(b.props->>'$.voice.preset_id') WHERE b.card_type='character' AND JSON_TYPE(b.props->'$.voice.preset_id')='STRING' AND p.preset_id IS NULL;` | Optional cleanup (display only) | Low |
| 7 | Adventure session snapshot | BE | `adventure_session.template_snapshot` → `$.template.characters[*].voice`, `$.template.persona.voice`, **`$.narrator_voice`** (`conversation_kind='adventure'`) | **Frozen** (user-editable via PUT) | `SELECT COUNT(*) AS sessions, SUM(JSON_LENGTH(JSON_EXTRACT(template_snapshot,'$**.voice_id'))) AS refs, SUM(JSON_TYPE(template_snapshot->'$.narrator_voice')='OBJECT') AS narrators, SUM(active_stream_id IS NOT NULL) AS active FROM adventure_session WHERE conversation_kind='adventure' AND JSON_EXTRACT(template_snapshot,'$**.voice_id') IS NOT NULL;` | One-shot rewrite; no `conversation_version` bump; optimistic check; skip active streams; keep `adventure_last_update` | **High**: strict snapshot validation; narration fails per turn |
| 8 | 1:1 character chat snapshot | BE | `template_snapshot` → `$.character.voice`, `$.persona.voice`, `$.codex_cards[*].snapshot{.voice,.persona.voice,.characters[*].voice}` (`conversation_kind='character'`) | **Frozen, not user-editable** | same as #7 with `conversation_kind='character'` (drop `narrators`) | One-shot rewrite (mandatory). The lazy resolver covers misses. | **High**: voice calls and narration read this; users cannot fix it |
| 9 | Group chat snapshot | BE | `template_snapshot` → `$.characters[*].voice`, `$.persona.voice`, codex paths (`conversation_kind='character_group'`) | Frozen, not editable | same as #7 with `conversation_kind='character_group'` | One-shot rewrite | High |
| 10 | Legacy voice-id inventory (input to the mapping) | BE | all of #1–#9 plus `voice_preset.base_voice_id` | — | `SELECT vid, COUNT(*) n FROM (SELECT jt.vid FROM tb_card_body b, JSON_TABLE(JSON_EXTRACT(b.props,'$**.voice_id'),'$[*]' COLUMNS(vid VARCHAR(256) PATH '$')) jt UNION ALL SELECT jt.vid FROM adventure_session s, JSON_TABLE(JSON_EXTRACT(s.template_snapshot,'$**.voice_id'),'$[*]' COLUMNS(vid VARCHAR(256) PATH '$')) jt UNION ALL SELECT base_voice_id FROM voice_preset) x GROUP BY vid ORDER BY n DESC;` | Feeds `voice_provider_mapping` curation | — |
| 11 | Voice presets | BE | `voice_preset` (`base_voice_id`, `speed`, `volume`, `pitch`, `emotion`, `language_boost`, `is_global`, `metadata`) | Live (user CRUD); global rows read-only and operator-owned | `SELECT is_global, COUNT(*) presets, COUNT(DISTINCT base_voice_id) voices, SUM(pitch<>0) pitch_used, SUM(ABS(volume-1)>0.001) vol_used, SUM(speed<0.7 OR speed>1.2) speed_clamped, SUM(emotion IS NOT NULL) emotion_used, SUM(COALESCE(language_boost,'auto')<>'auto') lang_used FROM voice_preset GROUP BY is_global;` | Expand DDL (`provider`, `settings`, `language_code`), rewrite in place (same `preset_id`), flags in `metadata.migration` | **High**: one bad row breaks every user's preset list (global rows are in every list) |
| 12 | Default voices | BE | env `TTS_DEFAULT_VOICE_ID`, `VOICE_MINIMAX_TTS_VOICE_ID` (`.env`, `/home/andres/PycharmProjects/magic-worlds-api/docker-compose.yml:133,155`) | Config | n/a | Replace with **owned** ElevenLabs ids (not Default voices, which expire 2026-12-31); rename the call var; add a readiness probe | **High**: all voiceless narration and calls fail |
| 13 | TTS jobs | BE | `tts_job` (`provider` CHECK, `model_alias`, `provider_model_id`, `voice_id_hash`, `input_summary`, `result_summary`, `error_provider_status_code`, `provider_trace_id_hash`) | Immutable history | `SELECT source, provider, model_alias, status, COUNT(*) FROM tts_job GROUP BY source, provider, model_alias, status;` plus in-flight: `SELECT COUNT(*) FROM tts_job WHERE status IN ('pending','in_progress','synthesizing','mirroring');` | No rewrite. Widen the CHECK to `('minimax','elevenlabs')` and the Python literals to unions. Hash v2. Terminalize in-flight jobs at the switch. | **High**: the CHECK blocks every ElevenLabs insert; narrowing breaks history reads |
| 14 | TTS assets (files) | BE | `tts_asset` rows plus `{TTS_STORAGE_ROOT}/YYYY/MM/{job}/{asset}.mp3` | Immutable | `SELECT j.source, COUNT(*) assets, ROUND(SUM(a.file_size_bytes)/1048576) mib, MIN(a.created_at), MAX(a.created_at) FROM tts_asset a JOIN tts_job j ON j.job_id=a.job_id WHERE a.deleted_at IS NULL GROUP BY j.source;` orphans: `SELECT COUNT(*) FROM tts_asset a JOIN tts_job j ON j.job_id=a.job_id LEFT JOIN adventure_session s ON s.adventure_id=j.adventure_id WHERE a.deleted_at IS NULL AND s.adventure_id IS NULL;` | Keep referenced audio; reviewed orphan sweep | Low (disk); legal [unverified] |
| 15 | Narration clip map | BE+FE | `adventure_message.metadata.tts_segments.{i}` (job and asset refs, no voice id); FE `chatSessionConfig.ts:71-84` | Derived cache | `SELECT COUNT(*) FROM adventure_message WHERE role='assistant' AND JSON_CONTAINS_PATH(metadata,'one','$.tts_segments');` | None; re-narration overwrites entries | Low |
| 16 | Call-turn message metadata | BE | `adventure_message.metadata.voice.tts_provider='minimax_streaming'` | Frozen execution record | `SELECT COUNT(*) FROM adventure_message WHERE metadata->>'$.voice.tts_provider'='minimax_streaming';` | No rewrite; validators accept the legacy and new literals | Medium: replay/reconcile returns 500 if narrowed |
| 17 | Stored spoken text with MiniMax markup | BE | `adventure_message.content` (call turns), `voice_transcript_segment.transcript_text` | User-visible history | `SELECT COUNT(*) FROM voice_transcript_segment WHERE role='assistant' AND transcript_text REGEXP '<#[0-9]+(\\.[0-9]+)?#>';` and `SELECT COUNT(*) FROM adventure_message WHERE metadata->>'$.conversation_mode'='voice_call' AND content REGEXP '<#[0-9]+(\\.[0-9]+)?#>';` | No rewrite; strip at display, convert at TTS time | Low–Medium: ElevenLabs would read markers literally on re-narration |
| 18 | Voice sessions | BE | `voice_session.tts_provider` (+ `stt_*`, `sample_rate` 16 kHz upload) | History | `SELECT tts_provider, status, COUNT(*) FROM voice_session GROUP BY tts_provider, status;` | No rewrite; widen insert and read validators; new value for new calls | **High**: call history and new calls fail if only switched |
| 19 | Call transcript TTS summary | BE | `voice_transcript_segment.tts_summary` → `$.voice_id` (raw MiniMax id), `$.asset_id` | History | `SELECT COUNT(*), COUNT(DISTINCT tts_summary->>'$.voice_id') FROM voice_transcript_segment WHERE role='assistant' AND tts_summary->>'$.asset_id' IS NOT NULL;` | Keep as provenance | Low |
| 20 | Callbot execution records | BE | `tb_llm_execution_plan.frozen_payload` / `result` (voice context with `tts_provider`) | Immutable | `SELECT COUNT(*) FROM tb_llm_execution_plan WHERE feature_key='callbot';` | No rewrite; tolerant validators | Medium |
| 21 | AI-generation and assistant replay snapshots | BE | `tb_llm_card_generation.output_snapshot`, `tb_operation_receipt.result_snapshot`, `tb_llm_assistant_turn.output_snapshot` | Immutable replay | `SELECT 'gen', COUNT(*) FROM tb_llm_card_generation WHERE JSON_EXTRACT(output_snapshot,'$**.voice_id') IS NOT NULL UNION ALL SELECT 'assist', COUNT(*) FROM tb_llm_assistant_turn WHERE JSON_EXTRACT(output_snapshot,'$**.voice_id') IS NOT NULL;` | None (expected ≈0); keep V1 readable | Low |
| 22 | Negative checks (should be 0) | BE | `story_card_ref.snapshot`, `lorebook_attachment.snapshot` | Frozen | `SELECT (SELECT COUNT(*) FROM story_card_ref WHERE JSON_EXTRACT(snapshot,'$**.voice_id') IS NOT NULL) AS stories, (SELECT COUNT(*) FROM lorebook_attachment WHERE snapshot IS NOT NULL AND JSON_EXTRACT(snapshot,'$**.voice_id') IS NOT NULL) AS lore;` | None if 0 | Low |
| 23 | Voice consent | BE+FE | `voice_consent.consent_version`; copy at `/home/andres/WebstormProjects/magic-worlds/src/app/i18n/locales/en.ts:2047,4823` (+ `es.ts`) | Records | `SELECT consent_version, COUNT(*) FROM voice_consent WHERE revoked_at IS NULL GROUP BY consent_version;` | Update copy; bump `VOICE_CONSENT_VERSION` to force re-consent | Medium (legal) |
| 24 | Frontend voice types and whitelists | FE | `voicePreset.types.ts:8-18`, `cardTransforms.ts:57-72`, `adventureSnapshot.ts:81-96`, `VoicePickerDialog.tsx:20-39`, `adminVoice.types.ts:10-17,47-63`, `voice.types.ts:165-170` | Code | n/a | Ship in lockstep with the backend expand (release N) | **High**: silent stripping of V2 fields on save |
| 25 | Frontend MiniMax-only helpers | FE | `voiceIdRules.ts:13-20`, `voiceLanguage.ts:15-21`, `constants.ts:34-36,92-137` | Code | n/a | Remove or replace (ElevenLabs labels and `verified_languages`) | Low |
| 26 | Fixtures, stories, tests, docs images | FE+BE | `playAdminAuditFixtures.tsx:33-34`; 13 FE and 68 BE test files; `assets/marketing/index.ts:35-36,91-92`; `/home/andres/PycharmProjects/magic-worlds-api/docs/api_usage/tts.md` | Code / docs | `grep -rli minimax` counts | Rewrite | Low |
| 27 | Card assistant voice drop | BE | `assistants/card.py:41-55,361-378,584-605` → `tb_card_draft.props.voice` | Writes live drafts | (detect after the fact) `SELECT COUNT(*) FROM tb_card_draft d JOIN tb_card_body b ON b.card_id=d.card_id WHERE d.card_type='character' AND JSON_TYPE(b.props->'$.voice')='OBJECT' AND JSON_TYPE(d.props->'$.voice')='NULL';` | Fix before the migration (preserve `voice`) | Medium: silently undoes migrated voices |
| 28 | Membership / quotas | BE | `membership_plan_limit` `tts_generation`, `voice_call` (`db.sql:923-941`) | Config data | `SELECT * FROM membership_plan_limit WHERE operation IN ('tts_generation','voice_call');` | Re-tune credit costs to ElevenLabs pricing (v4 $0.022/1k chars promo; Flash $0.04/1k [verified: https://elevenlabs.io/pricing/api]) | Low–Medium (cost) |
| 29 | In-memory state | BE | 5-min system-voice cache; `_VoiceCallRuntime.voice` | Process memory | n/a | Restart at the switch (single process) | Low |
| 30 | Frozen session snapshot inside **every** chat execution record *(added during verification)* | BE | `tb_llm_execution_plan.frozen_payload` → `$.agt.metadata.conversation_snapshot.template_snapshot` (all voice paths of #7–#9), written at `/home/andres/PycharmProjects/magic-worlds-api/src/services/conversation_execution.py:118-121` | Immutable, compared on retry/recovery (`conversation_turn_store.py:124-137,241-252`) | `SELECT feature_key, status, COUNT(*) FROM tb_llm_execution_plan WHERE JSON_EXTRACT(frozen_payload,'$.agt.metadata.conversation_snapshot.template_snapshot**.voice_id') IS NOT NULL GROUP BY feature_key, status;` | No rewrite (hashed record). Quiesce in-flight turns before rewriting #7–#9; accept `CHAT_RETRY_CONFLICT` 409 for retries of pre-migration failed turns (section 14.4) | Medium: retries of old failed turns stop working |
| 31 | `/tasks` drawer and notifications for TTS jobs *(added during verification)* | BE | `media_tasks.py:11,15`, `models/task.py:98-109`, `notifications.py:48-49,144-154` (all through `TtsJobPublic` with the pinned alias) | Read path over #13 | covered by #13 | Widen `model_alias` to a union that keeps `speech_2_8_turbo` | **High** if narrowed: task list fails for users with old jobs |
| 32 | `theme_song_job.provider` *(added during verification; out of TTS scope)* | BE | default `'minimax'` and CHECK `provider in ('minimax','fal')` (`/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:558,582`); Python allow-list (`/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:7654`); alias `minimax_music_3` (`/home/andres/PycharmProjects/magic-worlds-api/src/models/theme_song.py:36-37,172`; `/home/andres/WebstormProjects/magic-worlds/src/shared/types/media.types.ts:80-82`; `en.ts:3289-3290`, `es.ts:3299-3300`) | History + live (fal) | `SELECT provider, model_alias, COUNT(*) FROM theme_song_job GROUP BY provider, model_alias;` | **Leave alone.** MiniMax Music 3 runs on fal, not the MiniMax API; a "remove all MiniMax" grep must not touch these | Low (risk is an over-eager cleanup) |

### 18.1 Additional code, config and copy touchpoints (added during verification)

These were found by case-insensitive greps for `minimax`, `t2a`, `speech-2`, `language_boost`, `emotion`, `pitch`, `voice_id`, `voiceId`, `voice_preset`, `narrator_voice`, `tts`, `hex`, `<#`, `interjection`, `MINIMAX_` and `base_resp` across `src/`, `tests/`, `scripts/`, agent graphs, `db.sql`, `.env.example`, `docker-compose.yml`, `docs/`, i18n and stories in both repositories. They hold no user data, but each carries a MiniMax-shaped contract that the data model above depends on. Paths are relative to `/home/andres/PycharmProjects/magic-worlds-api` (BE) or `/home/andres/WebstormProjects/magic-worlds` (FE).

| # | Repo | Location | What is MiniMax-specific | Action |
|---|---|---|---|---|
| A1 | BE | `src/services/minimax_credentials.py:8-16`; `.env.example:384-403,418-424`; `docker-compose.yml:124-129` | `MINIMAX_AUDIO_API_KEY`, `MINIMAX_BASE_URL`, `MINIMAX_VOICE_ADMIN_TIMEOUT_SECONDS`, `MINIMAX_VOICE_CLONE_TIMEOUT_SECONDS`, `MINIMAX_VOICE_CLONE_MAX_UPLOAD_BYTES` | Replace with `ELEVENLABS_API_KEY` (+ base URL / residency); remove clone-upload vars or re-tune for IVC |
| A2 | BE | `src/services/voice_orchestration/config.py:41,49-51,91-94,153-160,344-359`; `.env.example:495-497`; `docker-compose.yml:153-155` | `VOICE_TTS_PROVIDER=minimax_streaming`, `VOICE_MINIMAX_TTS_WS_URL` (default `wss://api.minimax.io/ws/v1/t2a_v2`, `config.py:25`), `VOICE_MINIMAX_TTS_VOICE_ID` | Rename; the provider literal must become a union (section 6.1) |
| A3 | BE | `.env.example:528-539,646-653` | `RUN_MINIMAX_PROVIDER_CONTRACT_TESTS`, `live_minimax_provider` marker, `tests/voice/test_live_minimax_tts_contract.py` | Replace with ElevenLabs live contract tests (open questions 9) |
| A4 | BE | `src/main.py:83,101,767,920-950` | App wiring: `MiniMaxT2AProvider`, `MiniMaxVoiceAdminService`, startup error text listing `MINIMAX_AUDIO_API_KEY, TTS_DEFAULT_VOICE_ID` | Rewire to the ElevenLabs adapter |
| A5 | BE | `src/models/admin_voice.py:53,63-64`; `src/services/minimax_voice_admin.py:78,226-236,626` | `base_resp` envelope (`status_code`, `status_msg`), MiniMax sample-rate set incl. 32 kHz, default `sample_rate or 32000` | Replace with ElevenLabs `detail.{type,code,message,request_id}` errors |
| A6 | FE | `src/shared/types/adminVoice.types.ts:5-8,47,63,79-81,122` | `AdminVoiceBaseResponse {status_code,status_msg}`, `AdminVoiceModel = speech-2.8-*`, sample rates, `audio_hex`, `demo_audio_hex` | Replace the admin contract (Studio note) |
| A7 | FE | `src/features/admin/voices/hexAudio.ts:10-28`; `src/infrastructure/api/index.ts:1950-1964` | Preview and studio audio arrive as hex (`previewVoice` returns `AdminVoiceTestResponse`) | Switch to binary/blob or base64 |
| A8 | FE | `src/shared/types/voicePreset.types.ts:20-60` | `VoicePreset`, `VoicePresetCreatePayload`, `VoicePresetPreviewRequest` mirror the MiniMax recipe (`volume`, `pitch`, `language_boost`) — not only `CharacterVoice` (:8-18) | Update with the preset v2 shape (section 12.2) |
| A9 | FE | `src/features/voices/recipe.ts:4-18`; `src/features/voices/components/PresetRecipeControls.tsx:3,17,58-59`; `PresetEditor.tsx:56-110`; `VoiceStudioPage.tsx:21-29,80-90`; `SystemVoicePicker.tsx:16` | Voice Studio recipe model, controls, chips and preview payload use MiniMax fields and defaults | Rebuild on ElevenLabs settings |
| A10 | FE | `src/features/admin/voices/constants.ts:30,53,84`; `TextArtifactToolbar.tsx:11`; `MiniMaxReferenceDrawer.tsx` (whole file); `SynthLabPanel.tsx:75,82`; `AdminVoicesPage.tsx:9,122` | Sample text with `<#0.4#> (sighs)`, 32 kHz default, MiniMax reference drawer | Replace with v3/v4 audio-tag tooling |
| A11 | FE | `src/app/i18n/locales/en.ts:1400,5240,5246,5310,5353,5408-5460,5827-5866`; `es.ts:5250,5256,5320,5363` (and matching recipe-label blocks) | In-app docs copy ("speed, volume, pitch, emotion, and language boost"), admin studio copy naming MiniMax, synth and preset-editor labels for pitch / language boost / 32 kHz | Rewrite with the Studio redesign |
| A12 | FE | `src/features/admin/voices/components/SystemVoiceBrowser.stories.tsx:11,29`; `src/features/voices/components/SystemVoicePicker.stories.tsx:10,23,47`; `TextArtifactToolbar.stories.tsx:14`; `VoiceResultCard.stories.tsx:49` | MiniMax-style ids (`English_voice_1`) and MiniMax descriptions in stories | Rewrite fixtures; run `pnpm typecheck:stories` |
| A13 | BE | `src/services/chat_image_delivery.py:25,32`; `src/services/image_generation/errors.py:28-30,45,56`; `src/services/theme_song_generation/engine.py:1227` | Redaction / private-marker lists that name `minimax` and `MINIMAX_*_KEY` (same pattern as `chat_tts_delivery.py:28-49`) | Add ElevenLabs key names (`xi-api-key`, `ELEVENLABS_API_KEY`); keep `minimax` for the fal theme-song model names |
| A14 | BE | `src/services/chat_segments.py:116`; `src/services/tts_generation/registry.py:37,135-140`; `db.sql:1276-1278` | Docstrings / DDL comment stating voices are MiniMax recipes | Update with the code change |
| A15 | BE | `docs/api_usage/tts.md`, `docs/api_usage/voice.md`, `docs/configuration.md`, `docs/database.md`, `docs/architecture.md`, `docs/operations.md`, `docs/development.md`, `docs/README.md` (all contain `minimax`; `docs/api_usage/theme_songs.md` refers to the fal model and stays) | Operator and API docs | Rewrite after the cutover |
| A16 | FE | `docs/voice-calls-review-2026-10-11.md`, `docs/voice-calls-latency-review-2026-10-11.md`, `docs/ui-audit-2026-09-19-play-admin.md`, `docs/llm_profiles/*.md` | Historical reviews that name MiniMax | Keep as history; no action needed |

---

## 19. Open questions

1. **Inventory size.** How many distinct MiniMax voice ids are referenced in production? This drives curation effort. Run query #10.
2. **Add-shared-voice id.** Does `POST /v1/voices/add/{public_user_id}/{voice_id}` return a **new** id, or the library id? The docs example shows a different id [verified: https://elevenlabs.io/docs/api-reference/voices/voice-library/share]. Test in staging before filling `target_voice_id`.
3. **Library voices without saving.** Can the API use Voice Library voices **without** adding them to the account (the app can [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-library])? If so, should we still add them, to lock in the notice period?
4. **Unmapped-voice policy.** Fallback-to-default (B) or null (A)? Is a user-visible "voice needs re-selection" badge required?
5. **Thought dimming.** Client-side gain vs `[whispers]` tag. This is a product audio decision.
6. **Per-preset target overrides.** Should strong pitch or emotion presets get their own mapping row, keyed by preset, instead of by base voice?
7. **Model choice.** Does `eleven_v4` / `eleven_v4_turbo` work on `/v1/text-to-speech` and `stream-input`, or only through Text to Dialogue as the 2026-09-28 changelog positions it [verified: https://elevenlabs.io/docs/changelog/2026/9/28]? This decides which settings fields matter at request time (speed and style are not supported on v4).
8. **Legal.** May MiniMax-generated MP3s be retained after the MiniMax contract ends? Does ElevenLabs as a sub-processor require a consent version bump? Zero-retention `enable_logging=false` is enterprise-only [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert].
9. **Exact errors.** What does ElevenLabs return for invalid settings (out-of-range speed): 400 `invalid_voice_settings`, or a silent clamp? What does the `stream-input` socket do on an unknown `voice_id`? Both need a live contract test.
10. **Card assistant voice drop** (section 17.1). Is it reproducible? It needs a regression test before the migration.
11. **Global presets.** Who owns the `is_global=1` rows in production, and should they be re-seeded as curated ElevenLabs presets instead of migrated?

---

## 20. Sources

### External (ElevenLabs official; read 2026-10-12 unless marked secondary)

1. https://elevenlabs.io/docs/api-reference/text-to-speech/convert
2. https://elevenlabs.io/docs/eleven-api/resources/errors
3. https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech
4. https://elevenlabs.io/docs/api-reference/voices/settings/update
5. https://elevenlabs.io/docs/overview/models
6. https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/what-is-eleven-v4
7. https://elevenlabs.io/docs/changelog/2026/9/28
8. https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert
9. https://elevenlabs.io/docs/api-reference/voices/search
10. https://elevenlabs.io/docs/api-reference/voices/get
11. https://elevenlabs.io/docs/api-reference/voices/voice-library/get-shared
12. https://elevenlabs.io/docs/api-reference/voices/voice-library/share
13. https://elevenlabs.io/docs/eleven-creative/voices/voice-library
14. https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-are-default-voices
15. https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-are-legacy-voices
16. https://elevenlabs.io/docs/overview/capabilities/voices
17. https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input
18. https://elevenlabs.io/docs/api-reference/text-to-voice/design
19. https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices
20. https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-do-audio-tags-work-with-eleven-v3-and-v4
21. https://elevenlabs.io/docs/eleven-api/resources/webhooks
22. https://elevenlabs.io/pricing/api
23. https://elevenlabs.io/docs/changelog/2026/10/5 (secondary: search summary only; v4 becomes the Agents default)
24. https://help.elevenlabs.io/hc/en-us/articles/24351056337937 (secondary: voice slots per plan; page returns 403 to the fetcher)
25. https://help.elevenlabs.io/hc/en-us/articles/19572237925521-API-Error-Code-400-or-401 (secondary)

### External (non-official, secondary)

26. https://developer.signalwire.com/voice/tts/elevenlabs (example 20-character voice ids)
27. https://github.com/elevenlabs/elevenlabs-python/issues/293 (`voice_does_not_exist` 400)
28. https://github.com/home-assistant/home-assistant.io/issues/47697 (free-tier API impact of the Default-voice replacement)
29. https://techcrunch.com/2026/09/28/elevenlabs-new-v4-speech-model-supports-more-expression-control-and-90-languages/ (v4 launch context)

### Backend files (`/home/andres/PycharmProjects/magic-worlds-api`)

- `src/models/character.py`, `src/models/admin_voice.py`, `src/models/voice_preset.py`, `src/models/adventure_template.py`, `src/models/tts.py`, `src/models/story.py`
- `src/database/mysql/db.sql`, `src/database/mysql/models.py`, `src/database/mysql/card_body.py`, `src/database/mysql/conversation_turn_store.py`, `src/database/mysql/bootstrap.py`, `src/database/mysql/theme_song_cutover.py`
- `src/routes/voice_presets.py`, `src/routes/admin_voices.py`, `src/routes/tts.py`, `src/routes/card_exports.py`, `src/routes/card_sharing.py`, `src/routes/stories.py`, `src/routes/user/route_chat.py`, `src/routes/user/route_adventure_session.py`, `src/routes/user/route_character_chat.py`, `src/routes/user/route_voice_call.py`
- `src/services/tts_generation/registry.py`, `src/services/tts_generation/engine.py`, `src/services/tts_generation/config.py`, `src/services/tts_generation/minimax_adapter.py`, `src/services/tts_generation/storage.py`
- `src/services/voice_orchestration/engine.py`, `src/services/voice_orchestration/config.py`, `src/services/voice_orchestration/delivery.py`, `src/services/voice_orchestration/callbot_execution.py`, `src/services/voice_orchestration/transcript_sanitizer.py`
- `src/services/chat_tts_delivery.py`, `src/services/chat_segments.py`, `src/services/card_context.py`, `src/services/card_export/content.py`, `src/services/assistants/card.py`
- `src/agent_graphs/content_generation/character.v2.json`, `src/agent_graphs/content_generation/adventure_template.v2.json`, `src/agent_graphs/runtime/card_assistant_character_patch.v2.json`
- `scripts/migrations/20261012_image_profiles.py`, `.env.example`, `docker-compose.yml`, `docs/api_usage/tts.md`

### Frontend files (`/home/andres/WebstormProjects/magic-worlds`)

- `src/shared/types/voicePreset.types.ts`, `src/shared/types/character.types.ts`, `src/shared/types/adventure.types.ts`, `src/shared/types/adminVoice.types.ts`, `src/shared/types/voice.types.ts`, `src/shared/types/interaction.types.ts`
- `src/utils/cardTransforms.ts`, `src/features/interaction/utils/adventureSnapshot.ts`, `src/features/interaction/chatSessionConfig.ts`, `src/features/interaction/components/InteractionLeftPanel.tsx`, `src/features/interaction/components/InteractionCenterPanel.tsx`
- `src/features/voices/components/VoicePickerDialog.tsx`, `src/features/voices/components/PresetEditor.tsx`, `src/features/voices/recipe.ts`
- `src/features/creation/character/components/CharacterCreator.tsx`, `src/features/call/components/CallsPage.tsx`
- `src/features/admin/voices/voiceIdRules.ts`, `src/features/admin/voices/voiceLanguage.ts`, `src/features/admin/voices/constants.ts`, `src/features/admin/playAdminAuditFixtures.tsx`
- `src/infrastructure/api/index.ts`, `src/shared/featureFlags.ts`, `src/app/i18n/locales/en.ts`, `src/assets/marketing/index.ts`
- `docs/voice_refactor/research/00_current_tts_review.md`

---

## Verification log (2026-10-12)

An adversarial fact-check of this note against both repositories. It was read-only: no code was edited, no build or test was run, and no SQL was executed. External ElevenLabs claims were **not** re-checked in this pass; only codebase citations and coverage were checked.

**Citations checked: about 120 file:line references, all opened in the source.** Priority went to the checklist tables (sections 3, 4, 5, 6, 7, 10 and 18). Areas covered:
- `models/character.py`, `admin_voice.py` and `voice_preset.py`;
- `card_body.py`;
- the `route_adventure_session.py` snapshot models and PUT route;
- the `route_character_chat.py` snapshot models, builder and the full list of mutating routes;
- `route_voice_call.py`;
- `tts_generation/registry.py`, `config.py` and `engine.py`;
- `voice_orchestration/engine.py`, `config.py`, `delivery.py`, `callbot_execution.py` and `transcript_sanitizer.py`;
- `chat_tts_delivery.py` and `conversation_turn_store.py`;
- every cited `models.py` range (TTS job and asset validators, the reuse query, voice-session validators, `VoicePresetModel`, clone and strip-private paths, the assistant apply path, message-edit sidecar drop, and delete-all-user-data);
- every cited `db.sql` DDL range;
- the card assistant, story snapshot, card export, the theme-song cutover precedent, the migration script and `bootstrap.py`;
- all cited frontend types, transforms, the picker, creator, narrator panel, calls page, admin helpers, fixtures, marketing assets, the feature flag and i18n lines.

The large majority were accurate to the line.

**Corrected in place:**
1. Section 15 A'': `registry.py:264-276` is a per-request check, not a startup check. The startup check is `tts_generation/config.py:73-78`.
2. Sections 9 and 18 #26: "13 frontend test files reference MiniMax" is wrong for the literal string. Only 7 contain it, and 4 of those are fal theme-song tests. 13 is the count for the broader MiniMax data patterns.
3. Section 6.4: the `tb_llm_execution_plan` DDL ends at `db.sql:1872`, not 1852.
4. Section 14.1: the theme-song cutover precedent nulls one reference field (`theme_song_url`) in `tb_card_version.props`. It does not "rewrite version props". The citation is now `theme_song_cutover.py:50-53`.
5. Section 13: the UI's `LANGUAGE_BOOST_OPTIONS` has only `auto` plus 11 languages. The 23-language mapping comes from `KNOWN_VOICE_LANGUAGES`, and the backend accepts any string.

**Added (missed touchpoints):**
- **Frozen snapshot copy in every chat execution record** (`conversation_execution.py:118-121`; new row #30, new hazard in section 14.4). Retry and recovery require the live `template_snapshot` to be byte-equal to the frozen copy (`conversation_turn_store.py:124-137,177-178,241-252`). After the voice rewrite, retrying a failed or cancelled turn from before the migration returns `CHAT_RETRY_CONFLICT` 409. This happens whether or not `conversation_version` is bumped. It is the most consequential gap found.
- **`/tasks` drawer and notifications** also go through the pinned `speech_2_8_turbo` serializer (`media_tasks.py:11,15`, `models/task.py:98-109`, `notifications.py:48-49,144-154`; new row #31 and a paragraph in section 16).
- **`theme_song_job.provider` `'minimax'` default and CHECK**, plus the `minimax_music_3` alias. Both are fal-hosted and out of scope, but a blanket MiniMax cleanup must not touch them (row #32).
- **Callbot prompt and sanitizer interplay.** The graph prompt (`callbot_chat.v2.json:32`) emits the markers. The sanitizer fails closed on any XML tag (`transcript_sanitizer.py:46-52,118-120`), so ElevenLabs `<break/>` tags must not come from the LLM. No display-time marker stripping exists in the frontend today (section 6.2).
- **Hex-only storage ingest** (`storage.py`, `engine.py:2391`), a second alias literal (`engine.py:2414`), and further 32 kHz literals (`delivery.py:159`, `streaming_tts_minimax.py:22`, `registry.py:29`, `minimax_adapter.py:48`). All are in section 6.3.
- **Exact lines for the system-voice cache TTL** (section 14.4), the `es.ts` consent lines, and the `.env.example` consent note (section 9).
- **New section 18.1 (A1–A16)** covers:
  - MiniMax env vars and wiring;
  - `base_resp`-shaped admin DTOs;
  - hex preview audio;
  - the full `voicePreset.types.ts` contract;
  - Voice Studio recipe components;
  - admin lab constants and the reference drawer;
  - i18n copy beyond consent;
  - stories;
  - redaction marker lists;
  - docstrings;
  - backend and frontend docs.

**Confirmed negative checks:** `voice_preset` has no seed `INSERT` anywhere (only `models.py:15138`). The frontend does not validate the TTS `model_alias` or `tts_provider`. `StoryCardSnapshot` has no `voice` field.
