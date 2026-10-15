# Advanced voice performance development

October 15, 2026. This extends the owner-prioritized [voice creation studio](13_voice_creation_development.md). Gabriel remains the only starter. No additional catalogue voices are required for this work.

The optional advanced editor, compiler and pronunciation storage are implemented. `FISH_AUDIO_PERFORMANCE_ENABLED=false` keeps them separate from the enabled development creation workflow. R2 listening acceptance is still open; whole-scene narration and native Fish calls remain M5/M6 work.

## Authoring and persistence

Fish recipes can carry `performance: {version: 1, direction, dictionary_refs}` separately from dialogue and numeric settings. Direction is bounded to 300 plain characters. Each dictionary reference names an exact immutable version. Presets store this metadata in their existing JSON column; assignment copies it into the character or narrator snapshot. Unchanged recipes round-trip when advanced performance is paused.

The editor adds selected-phrase delivery, removable annotations and positioned reactions/pauses. These utterance annotations apply to the explicit comparison preview; reusable direction and dictionary versions are saved in the recipe. Editing comparison text clears its old offset annotations. English and Spanish copy uses existing Reverie primitives. Keyboard selection was verified in Storybook.

Offsets are zero-based Unicode code points with exclusive ends. The browser converts textarea UTF-16 selections and refuses partial graphemes. The backend independently checks combining marks, emoji sequences, overlap, bounds and pronunciation/number replacement boundaries. Canonical text remains unchanged; the compiler retains ranges through number expansion, spoken substitutions, phonemes and inserted controls/events. Inserted events have no transcript range.

## Pronunciation dictionaries

Two additive tables hold account/project/group-scoped dictionaries and immutable versions. There are at most 50 active dictionaries per owner and 64 rules per version. Writes use an account lock and optimistic version checks. Editing creates a new version; the UI requires an explicit selection to move a pinned recipe to it. Archiving hides a dictionary from new selection while existing owner pins still resolve. Account-data deletion removes archived and active dictionaries and cascades their versions.

Spanish supports spoken substitutions. English additionally has validated CMU syntax; its acoustic acceptance is still open. The compiler implements literal leftmost-longest matching, dictionary-order tie breaking and no recursive substitution. It resolves and validates local version contents before render admission/cache reuse. A missing, foreign-owner or wrong-language reference fails explicitly. Shared cards with someone else's private pins require replacement with the reader's own pronunciation references.

The application does not forward unresolved managed Fish dictionary references: the [native dictionary guide](https://docs.fish.audio/developer-guide/core-features/fine-grained-control/pronunciation-dictionaries) documents that unresolved references can otherwise be silently ignored. Paired phrase tags, directions, events and the evaluated language systems follow the [Drama 3 guide](https://docs.fish.audio/features/text-to-speech/drama-3).

## Preview and synthesis contract

`X-MW-Voice-Contract: 4` negotiates the additive performance extension; stored Fish recipes remain schema version 3 and legacy ElevenLabs recipes remain version 2. Contract-3 clients receive an upgrade response for owned recipes containing advanced metadata. Capability responses retain their compatible provider envelope.

The authenticated `/voice-performance` API exposes capabilities, dictionary create/list/update/archive and an explicit `POST /preview`. Authored preview text is bounded to 600 code points, 16 delivery spans, 12 events and three dictionaries. The stock `/voice-presets/preview` still accepts only a fixed `text_id`; a performance recipe can affect that fixed text, but it cannot turn the route into an arbitrary-text endpoint.

Both paths use the existing voice access/attestation checks, token bucket, application credits, preview limits, owned storage and refund handling. New authored renders consume the same allowance: three free daily, then one credit within the plan's limit. They always pass through the meter, including a neutral comparison. Cache keys include the actor, exact logical text, metadata, dictionary versions/content and compiler version. Replays of an identical accepted render are free. Fixed R1 cache identities are unchanged.

Required moderation sees dialogue, direction and pronunciation readings. Native controls are compiled only after an allow verdict. A caller's plain-dialogue verdict cannot bypass metadata moderation. Native supplier admission reserves the compiled request size. Narration resolves dictionary pins before job reuse/admission, includes their identity in the voice hash and bills canonical text through the existing turn settlement.

## Database handoff

The canonical schema is `2026_10_fish_performance` with 101 tables. The previous 99-table design schema is frozen at `src/database/mysql/migrations/2026_10_fish_design.sql`. Historical native/Fish/design upgrades continue to target their frozen contracts.

The development expansion is applied. Its private backup contains 99 tables and 3,142 rows, restored into a temporary database and verified against every row fingerprint before applying. All pre-existing rows except the revision marker remained unchanged. Backup SHA-256: `5e04fa5f4edc6cc50cb466e2db976a6b9102408ac9081484f54922420824ac02`. The current schema verifies and the API is ready; Gabriel remains the single active public Fish voice in development.

`scripts/migrations/20261015_fish_performance.py` checks by default. The expansion creates only the two pronunciation tables and updates the revision marker; it is resumable and performs no voice/content rewrites. All workers must first use the compatible reader, which verifies the exact previous schema while performance is off. Back up and restore-check the database before applying with `--apply`. Keep the advanced flag off during expansion. Rollback keeps compatible readers and the additive tables and disables the feature.

## Validation and remaining acceptance

The full backend suite passes: 13,956 tests, with 754 skipped and nine live-provider cases deselected. The final focused frontend run passes 57 tests across four files.

The isolated MySQL application test covers dictionary edits, stale-write rejection, owner isolation, recipe round trips, metered previews, free cache hits, archived pins in narration, owned audio, narration reuse and self-service deletion. The native variant passed with five bounded Gabriel renders: four previews and one narration job. It recorded preview costs `[0, 0, 0, 1]`; cached/reused work made no additional supplier requests. Auth, moderation and catalogue acceptance in these disposable databases are explicit synthetic fixtures, not production approval.

Private comparison files and the native report are under `/home/andres/PycharmProjects/magic-worlds-api/.dev/fish-performance-validation/2026-10-15-native-01/`. The text is original synthetic Spanish narration. These are performance checks of Gabriel, not additional catalogue entries.

The production build, story typecheck, focused behavior tests and new-component lint pass. Full frontend runs each passed 4,173 tests and hit one timing-sensitive test in an unrelated feature: interaction-history reload in one run, theme-song playback in the other. Both files passed isolated reruns; neither was changed for this work. See the accompanying [machine-readable evidence](evidence/2026-10-15-performance.json) for final backend counts and database backup verification.

R2 still requires reviewed listening for word accuracy, identity, scoped delivery, event rendering and pronunciation. English CMU needs its own acoustic check. Browser audio/device acceptance and production account/privacy approval remain separate. Advanced performance stays off until its gate is met; EN/ES root voice creation and Gabriel's approved Spanish development narration continue independently.
