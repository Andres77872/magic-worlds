# Target architecture: native, agnostic, profile controlled

Date: **2026-10-15**. Owner requirements accepted; implementation proposed.

## 1. Separate execution from configuration

Moderation execution belongs in **`/home/andres/PycharmProjects/magic-worlds-api`**. A small direct client calls OpenRouter Decisions using **`cloudflare/clef-omni`** and a dedicated platform credential.

LLM/image profiles expose **`moderation_enabled: true`** by default. This is application metadata controlling whether a caller invokes moderation. It is not a moderator model profile, an agent node, a generation feature contract, or execution through api.magic_llm.

The native service must construct and work without generation profiles or api.magic_llm. Its callers may read their normal generation profile's boolean; the service does not import or invoke profile resolution.

## 2. Small implementation shape

~~~text
src/services/moderation_openrouter.py  # direct Decisions payload/parser, text and media encoding
src/services/moderation.py             # local questions/thresholds, common results and deadline
~~~

Use existing HTTPX/lifespan conventions. Add a small media preparation helper only if existing image/audio utilities cannot supply validated bytes. Reuse existing profile DTOs, repositories, editors, and job metadata. No provider registry, plugin framework, policy CRUD service, or new workflow engine.

The generation caller checks the authorized effective setting. The moderator receives text/context plus optional typed media parts: kind, owned bytes, content type, and necessary decoded properties such as duration. It does not receive arbitrary fetch URLs or generation-provider payloads.

## 3. Ordering and common behavior

~~~mermaid
flowchart TD
    A[Existing authenticated operation] --> B[Resolve governing generation profile or default on]
    B --> C{Moderation enabled?}
    C -->|yes| D[Native input text and media check]
    D -->|allow| E[Existing generation provider]
    D -->|block or unavailable| X[Stop operation]
    C -->|explicitly no| E
    E --> F{Moderation enabled?}
    F -->|yes| G[Hold actual output and check its content]
    G -->|allow| H[Existing delivery or asset commit]
    G -->|block or unavailable| Y[Withhold output]
    F -->|explicitly no: record skipped| H
~~~

LLM inference still uses api.magic_llm; image/audio generation keeps its current providers. The native moderator is called before protected inference and before release. No speculative generation on enabled input, no image URL or audio frame released while its required output check is pending.

Use ordinary local results: allow, block, unavailable, categories, and safe timing/error metadata. A caller's explicit `skipped_profile_disabled` state stays separate from classifier allows. Do not add signed receipts, approval tokens, or durable per-request allow records.

## 4. Agnostic means testable behavior

- **Provider/model:** apply the same checks to fal/OpenRouter image generation, platform/BYOK, and supported speech providers; generation model capability labels do not switch moderation off.
- **Feature:** chat, cards, stories, assistants, extraction, writers, profile tests, and media entrypoints use the same setting semantics at their existing boundaries.
- **Modality:** text, actual image bytes, and actual audio bytes normalize to the same allow/block/unavailable result. A text verdict does not substitute for a media verdict.
- **Profile:** system/personal, explicit/inherited, default/feature assignment, and legacy profiles all default on. Unprofiled operations default on.
- **Transport isolation:** Clef is the fixed moderator for now; only its small HTTP adapter knows the Decisions envelope. Agnosticism does not require multiple moderator adapters.

Provider-specific parsing remains in the generation adapters already responsible for it. They expose owned content to the common check; they do not choose whether moderation applies.

## 5. Minimal profile persistence, without gateway changes

Add the application boolean to LLM profile configuration and its existing immutable revision storage, and to image profile fields/storage/resolution. Existing legacy values default true. Reuse image job `input_summary` to freeze the image profile's ID/version/boolean for asynchronous completion.

Keep LLM moderation metadata **outside the serialized api.magic_llm execution plan and provider_options**. Current admission expands resolved fields into the strict `ResolvedLlmExecution`; blindly adding the boolean to that dictionary would break validation. Carry it in BFF-local context or read the immutable profile revision by the execution's existing IDs. See [13](13_profile_moderation_controls.md).

Do not modify api.magic_llm, magic-agents, magic-llm, generation graphs, or their contracts. Only the two profile-field persistence additions and directly necessary existing media metadata are in scope.

## 6. Media release and concurrency

Image/audio checks run over validated owned bytes outside database write locks. Current image finalization holds a row lock while mirroring; split only its necessary preparation/check step from its short final commit. Stage privately, check, reacquire the existing lock, verify job ownership/state, and publish asset rows/links only on the winning allowed completion. Clean up cancelled/losing attempts.

For audio, preserve text checks before TTS and add actual-audio checks before playback/download/cache exposure. Non-live clips can be held completely. Live calls require bounded reviewed windows compatible with their existing playback-driven look-ahead; holding a whole turn can stall production. Separate first provider receipt from first approved release. A raw network chunk is not a decision unit. [12](12_audio_image_coverage.md) details the narrow changes and cross-window limits.

For generated text, enabled moderation requires a release hold at existing HTTP/SSE/WS callbacks until the chosen output unit is checked. Prefer complete outputs initially where semantics require whole-message review; retain existing wire envelopes. Do not claim final validation protects text already streamed.

## 7. Failure and scope

Missing configuration, invalid media/scores, timeout, unsupported size/format, or incomplete unit coverage makes an enabled check unavailable and withholds the affected operation. No conversion to disabled, graph fallback, model substitution, or borrowed user credential.

An authorized saved profile false disables the native checks for its operation; it does not disable authentication, restrictions, deterministic validation, or upstream provider policy. An outage cannot create that setting.

Keep changes limited to native moderation, the requested profile field/editors, actual media/content guards, and focused tests. Reporting, companion safety, penalty redesign, profile framework rewrites, distributed caching, outboxes, ledgers, and unrelated features remain excluded.
