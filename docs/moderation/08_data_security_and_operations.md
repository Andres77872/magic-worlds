# Profile data, media privacy, and operations

Date: **2026-10-15**. Proposed changes only. The requested profile controls need two small schema additions; this does not create a moderation persistence platform.

## 1. Native credential and local configuration

Use a dedicated backend `MODERATION_OPENROUTER_API_KEY` through the existing secret mechanism. Keep `cloudflare/clef-omni`, endpoint, questions, and evaluated thresholds server-owned.

Generation profiles supply only their authorized `moderation_enabled` boolean to the caller. The native service never reads a published moderation profile, generation BYOK, user JWT, generation catalog, or api.magic_llm configuration.

Reuse one lifespan-owned HTTPX client, existing logging, and existing request limits. No automatic model/graph/credential fallback or new policy control plane.

## 2. Minimal persistence and rollout compatibility

| Existing storage | Proposed addition/behavior |
|---|---|
| `tb_llm_profile_revision` | Strict logical boolean `moderation_enabled NOT NULL DEFAULT 1`; read/write with immutable revision |
| `tb_llm_profile.draft_config` JSON | Default missing key to true; preserve explicit false and field presence on update |
| `tb_image_profile` | Same default-on column; seed/create/update/view/resolve support |
| Image job `input_summary` JSON | Snapshot governing profile ID, row_version, and boolean; missing legacy value means on |
| Existing media metadata/result_summary | Minimal application review outcome/content/config identity when needed for safe read/replay |
| Existing profile audit/version machinery | Record normal configuration changes and selected revision/version; no raw media or secrets |

Use existing migration conventions; normalize supported DB 0/1 values at the boundary and reject malformed public booleans. Defaults alone do not fix update omission, root draft tests, rollback, or retry propagation; [13](13_profile_moderation_controls.md) specifies those cases.

Deploy default-on schema compatibility before dependent reads/writes. Preserve immutable historical execution plans. Do not insert the flag into the gateway plan or provider_options.

No new moderation tables, per-sentence decision rows, outbox, billing ledger, policy registry, or bulk history rewrite is required. Private temporary media must not become servable merely because a file exists.

## 3. Enabled, disabled, and unavailable are different

All new/legacy profiles default on. Only an authorized saved false disables native moderation for that operation. The existing profile editor permission model applies; a generation request cannot override the setting.

Record explicit disables as `skipped_profile_disabled`. They are neither checked nor allowed by the classifier. Missing keys, timeouts, provider errors, old speech optional flags, and invalid inputs cannot create an implicit disable for an enabled profile.

No governing profile means on. A parent false cannot suppress an independent child image profile's true. Authentication, account restrictions, byte/type bounds, ownership, and provider safety policies remain active.

## 4. Content and media isolation

Validate and bound the actual media before encoding. Only use authorized uploads, owned assets, or trusted provider output fetched through existing controls. Do not send arbitrary client URLs to the moderator or add fetch capability to its input contract.

Stage generated images/audio privately until checked. Block/unavailable prevents asset registration/linking, cache grants, completion events, and streaming bytes where those would expose the candidate. Reuse current failure cleanup and retention rather than inventing a review queue.

Audio inspection adds a direct processor path for already captured segments. Keep input audio ephemeral according to the existing raw-audio retention contract; base64 request construction and diagnostics must not create retained copies. Output holds need bounded memory/disk and cancellation cleanup. No new microphone capture, recording archive, or video collection is authorized.

## 5. Provider privacy and cost checks

Verify actual OpenRouter account logging/improvement settings and selected endpoint retention filters before live use. The review did not inspect those settings. [OpenRouter data collection](https://openrouter.ai/docs/guides/privacy/data-collection), [provider logging](https://openrouter.ai/docs/guides/privacy/provider-logging), [ZDR](https://openrouter.ai/docs/guides/features/zdr).

Cloudflare's Workers AI policy does not establish every OpenRouter configuration or region guarantee. [Workers AI data usage](https://developers.cloudflare.com/workers-ai/platform/data-usage/).

Moderation is platform cost even for personal/BYOK generation. Use the dedicated key budget and existing limits; record supplied usage/cost safely. Do not manufacture normal generation execution rows, change credit pricing, or promise refunds for output already generated but withheld. A timeout can still cost money.

Update directly affected processing/coverage copy accurately. No broad legal-page or billing refactor is required.

## 6. Minimal observability

Use existing structured logs/metrics with bounded dimensions: modality, surface, required/disabled state, outcome, total/remote/preparation/release latency, and safe error class. Track checked units separately from explicit skips; include blocked/unavailable and media byte/duration bounds. Never log base64, private transcripts/images/audio, keys, or full provider responses.

A safe canary should exercise text, image, and audio contracts before activation, not on every health poll. Existing health detail must distinguish configured versus functioning versus explicitly disabled/unavailable. Do not infer “all media moderated” from a healthy text gate.

## 7. Rollback and remaining backlog

Keep the last tested native Omni implementation/configuration. Profile default columns and existing metadata must remain readable across rollback. An older binary that ignores the fields/media checks is not an enforcement-safe rollback; withhold affected operations until a compatible version is restored.

Do not reset saved false values, silently turn true into optional mode, restore the old graph classifier, or weaken privacy filters. Reporting, companion safety, penalty delivery, and unrelated infrastructure remain separate work.
