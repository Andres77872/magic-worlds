# Moderation: review and native multimodal integration plan

Reviewed: **2026-10-15, America/Mexico_City**. **Lifecycle: active proposal and open findings; native integration unimplemented.** [00](00_current_status_and_findings.md) owns current evidence, [01](01_code_review_and_gaps.md) owns findings, and [10](10_rollout_risks_and_decisions.md) owns delivery scope. This cleanup changes Markdown only.

Current application moderation is mainly a text gate before TTS. Local speech configuration allows unclassified output. Actual image/audio inspection and profile moderation switches are missing.

## Implementation disposition

| Component | Status after source recheck | Remaining evidence |
|---|---|---|
| Pre-TTS text gate | Implemented; working tree (uncommitted, 2026-10-15): Fish dispatch through the shared synthesis boundary | Required-mode deployment and domain/latency acceptance; text allow is not audio review |
| Native Clef client and service | **Planned; not present in inspected source** | MOD-01 and safe provider contract/evaluation |
| LLM/image `moderation_enabled` | **Planned; absent from those DTO/repository families** | MOD-02/03, defaults/revisions/update/editor tests |
| General input/output and actual media release guards | **Planned** | MOD-04/05; checks before exposure across providers/modes |
| Product acceptance | **Open** | MOD-06; backend-region latency, policy and all relevant release paths |
| Broader audit findings | **Open, separate ownership where excluded** | G02/G05–G09/G13 (owner TBD) do not disappear because the native slice excludes their repair |
| Legacy `moderation` generation feature (current classifier path) | Present, legacy path only: api.magic_llm `c1afb8a` (feature contract); BFF `6d6138d` (`moderation_transport.py`, `speech_moderation.v1.json` graph, `FeatureKey` literal and seed row) and `a3f1b53` (`unmoderated` count in logs only); frontend `946961c` ('Speech moderation' profile feature) | Replaced at the MOD-04 cutover; retiring these entries is TBD ([07](07_surface_integration_and_refactor.md) §5) |

Source recheck 2026-10-15: native moderation has not started in any repository. No native client, Clef/Decisions call or `moderation_enabled` profile field exists in any backend or frontend working tree; the 2026-10-13/14 commits above only strengthened the legacy api.magic_llm classifier path.

Existing ElevenLabs catalog `live_moderation_enabled` is provider-sharing metadata, not the requested application profile switch. The active Fish execution is outside this cleanup; no files in its dossier were changed.

## Accepted requirements

1. The moderator runs natively inside **`/home/andres/PycharmProjects/magic-worlds-api`**, calling **`cloudflare/clef-omni`** directly through OpenRouter Decisions.
2. Moderation execution stays independent of api.magic_llm, generation graphs, model catalogs, generation credentials, and published moderation profiles.
3. **Every LLM profile and image profile has a `moderation_enabled` boolean, default `true`**, including existing, system, personal/BYOK, seeded, and newly created profiles.
4. The profile field controls whether its operation uses the native moderator. It does not make the moderator an LLM profile or change how the moderator executes.
5. The integration is **provider, model, feature, and modality agnostic** at application boundaries. Inspect actual images and audio as well as text; a prompt/transcript alone does not approve media.
6. Keep changes limited to this feature: native client/service, the profile field and existing editors, necessary content/release guards, small persistence additions, and focused tests. Avoid unrelated refactors.

This scope incorporates the latest request for audio/image evaluation and per-profile controls. Earlier exclusions of these specific items are superseded. Reporting, companion safety, penalty redesign, billing frameworks, and unrelated features remain separate work.

## Intended behavior

Resolve the normal generation profile and read its server-owned switch. If enabled, check input before generation, and check generated content before delivery in its actual modality. If explicitly disabled, skip that native check and record a disabled outcome. Missing legacy fields mean enabled; timeout, invalid media, or provider failure never mean disabled.

The image profile governs image generation independently of a parent LLM profile. Call audio associated with an LLM turn uses that turn's profile setting. Uploads, previews, music/audio, or other operations without a governing profile default to enabled. Exact ownership, revision, and mixed-operation rules are in [13](13_profile_moderation_controls.md).

The native service itself never resolves profiles. It receives bounded authorized text/media and returns allow, block, or unavailable. A skipped check is not a classifier allow.

## Reading order

| Document | Purpose |
|---|---|
| [00 Current status](00_current_status_and_findings.md) | Observed behavior and evidence limits |
| [01 Findings and gaps](01_code_review_and_gaps.md) | Broad audit, including new profile/media gaps |
| [02 Clef Omni research](02_clef_omni_research.md) | Model fit, cost, capability and latency evidence |
| [03 Target architecture](03_target_architecture.md) | Native service, agnostic contract, profile-control separation |
| [04 Direct Decisions protocol](04_openrouter_decisions_integration.md) | Verified text/image/audio request shape and strict parsing |
| [05 Latency design](05_low_latency_design.md) | Pooling, budgets, media preparation, and release buffering |
| [06 Local policy](06_policy_thresholds_and_context.md) | Category definitions, thresholds, and modality evaluation |
| [07 Integration seams](07_surface_integration_and_refactor.md) | Necessary backend/frontend file changes and exclusions |
| [08 Data and operations](08_data_security_and_operations.md) | Defaults, minimal migrations, credentials, media privacy |
| [09 Validation](09_validation_and_benchmarks.md) | Profile, media, agnosticism, ordering, and latency acceptance |
| [10 Delivery plan](10_rollout_risks_and_decisions.md) | Bounded work packages, rollout, risks, and completion |
| [12 Audio/image review](12_audio_image_coverage.md) | Actual media gaps, coverage matrix, and release plan |
| [13 Profile controls](13_profile_moderation_controls.md) | Default-on field, lifecycle, ownership, and provider-independent semantics |

## Evidence and limits

The cleanup rechecked sources only and did not rerun the earlier runtime/test/provider research. “Current” in retained dated evidence means its inspected code/runtime snapshot. “Reproduced” means a controlled offline probe. Provider claims are not deployment measurements. No paid multimodal contract test, accuracy evaluation, or production benchmark was run here. Primary sources are cited inline where used (mainly 02, 04, 05, 06 and 08).

Existing [voice](../voice_refactor/00_current_status_and_roadmap.md) and [LLM profile](../llm_profiles/16_current_status_and_roadmap.md) ledgers maintain their own current state. Their earlier moderation-through-api.magic_llm design is superseded for this integration. Content moderation does not remediate [credential custody findings](../security/README.md).

The proposed first transport is OpenRouter Decisions. Cloudflare-native hosting remains a same-model alternative; no second adapter, automatic fallback, generic provider framework, new moderation platform, receipts, outbox, or billing ledger is required.
