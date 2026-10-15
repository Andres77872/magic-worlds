# Integration seams and limits on refactoring

Date: **2026-10-15**. Proposed work only. The latest scope includes actual audio/image evaluation and default-on controls on both profile families.

## 1. Ownership and scope

The moderator executes only in **`/home/andres/PycharmProjects/magic-worlds-api`**, with direct Clef requests. Profile metadata chooses whether an operation invokes it. Do not create a moderation generation feature/profile, graph, or api.magic_llm execution.

The two profile fields, existing editor switches, media checks, and necessary release holds are now related feature work. Keep these changes local; do not refactor unrelated business logic, provider frameworks, billing, reporting, or companion features.

## 2. Backend changes

| Existing/new seam | Necessary change | Limit |
|---|---|---|
| New `src/services/moderation.py` and `moderation_openrouter.py` | Common text/image/audio result and direct Decisions client | No profile lookup or generation dependency inside service |
| [main.py](/home/andres/PycharmProjects/magic-worlds-api/src/main.py) | Reuse/close one dedicated HTTP client; replace active legacy speech classifier wiring | No moderation graph/profile execution |
| [LLM DTOs](/home/andres/PycharmProjects/magic-worlds-api/src/models/llm_profiles.py), [API DTOs](/home/andres/PycharmProjects/magic-worlds-api/src/models/llm_profile_api.py), [repository](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/llm_profile_models.py) | Default-on config/revision field, BFF view, publish/rollback/draft/retry propagation | No provider_options field or gateway plan expansion |
| [Image DTOs](/home/andres/PycharmProjects/magic-worlds-api/src/models/image_profiles.py), [repository](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/image_profile_models.py) | Default-on mutation/view/resolved field, seed/update/resolve support | Preserve existing selection, ownership, and billing |
| Existing migration mechanism | One column in LLM revisions and one in image profiles; missing draft/job JSON defaults on | No new moderation tables or historical execution rewrite |
| [speech gate](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/moderation.py), [transport](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/moderation_transport.py), [synthesis](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/synthesis.py) | Native dependency; authorized operation flag; text and actual-audio checks | Preserve public refusal and billing contracts |
| [voice engine](/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py), [callbot context](/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/callbot_execution.py), [audio drainer](/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/call_tts_elevenlabs.py) | Same-turn profile attribution, raw-audio/input checks, output-audio release hold | No new voice provider runtime or ledger |
| [image engine](/home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/engine.py), [uploads](/home/andres/PycharmProjects/magic-worlds-api/src/routes/images.py) | Snapshot flag; prompt/reference/result checks; private staging then asset commit | Only necessary split around current finalizer lock |
| [previews](/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_preview.py), [root lab](/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py), [music engine](/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/engine.py) | Default-on actual-audio release checks, including cached/downloaded assets | No new audio profile selector or capture feature |

The serialized execution contract is strict. Keep application flags in local context or revision lookups, not in the `**resolved` object sent to `ResolvedLlmExecution`. Detailed persistence and compatibility rules are in [13](13_profile_moderation_controls.md).

## 3. Generation boundary inventory

Apply the resolved LLM profile's setting to input and released output at current shared domain seams. Keep existing feature behavior and frame formats; add a small release wrapper rather than redesigning the streaming engine.

| Current backend seam | Content and scope |
|---|---|
| [conversation_execution.py](/home/andres/PycharmProjects/magic-worlds-api/src/services/conversation_execution.py) | Chat/group/adventure/call content; supported media inputs; replies before WS/HTTP delivery |
| [card_execution.py](/home/andres/PycharmProjects/magic-worlds-api/src/services/card_execution.py) | Request fields and generated card text after schema validation |
| [story_execution.py](/home/andres/PycharmProjects/magic-worlds-api/src/services/story_execution.py) | Instruction/selection and generated candidate before SSE/user release |
| [assistant execution](/home/andres/PycharmProjects/magic-worlds-api/src/services/assistants/execution.py) | Instruction and generated text/effect content; existing tool authorization remains |
| [extraction](/home/andres/PycharmProjects/magic-worlds-api/src/services/lorebook_extraction_execution.py) | Source and generated entries before applying them |
| [system writers](/home/andres/PycharmProjects/magic-worlds-api/src/services/system_writer_execution.py) | Parent instructions and generated image/music prompt/lyrics before the next provider |
| [profile tests](/home/andres/PycharmProjects/magic-worlds-api/src/services/llm_profile_execution.py) | Honor saved draft/published flag for arbitrary content generation; no privileged moderation bypass |
| Existing recovery/regeneration paths | Reuse the selected revision/setting for new inference; do not invent a permanent approval from a retained result |

Avoid duplicate checks on routes sharing the same execution boundary. Parent LLM settings cannot disable an independently enabled image operation. Unprofiled media defaults on.

Existing final validation occurs after some streaming callbacks; enabled output protection therefore requires holding content before those callbacks expose it. This is necessary moderation work, not a new SSE/WS protocol. Preserve heartbeat/cancellation/terminal errors.

## 4. Frontend profile controls only

Add one switch to each existing LLM/image profile editor, for system and personal profiles. Update their DTO contracts, draft constructors, dirty comparisons, save payloads, and read displays. Missing legacy data displays on; provider/model switching preserves false. [13](13_profile_moderation_controls.md) links exact seams.

Follow existing UI primitives/design/story instructions during implementation. No new dashboard, settings page, reporting UI, media-management feature, or provider selector is proposed.

## 5. Related corrections and exclusions

Necessary local corrections include total deadline ownership, complete media/unit coverage, proper flag omission handling, and preventing unchecked bytes from being exposed. Existing profile publication/versioning and job ownership/idempotency remain.

Keep report eligibility/concurrency/cursors, companion detection, account-penalty attribution/delivery, warnings, and public-card text review workflows as separate backlog. Do not add outboxes, receipts, moderation ledgers, distributed caches, a provider framework, broad historical data migrations, or cross-service code changes.

Remove only obsolete active moderation graph/caller-token wiring after direct cutover. No wholesale deletion of old profile feature entries, schemas, or history is required.
