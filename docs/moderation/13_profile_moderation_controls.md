# Default-on moderation controls for LLM and image profiles

**Lifecycle: active implementation proposal, unimplemented native integration. Reviewed 2026-10-15.** Requirements and examples below define the intended feature; they do not establish current support. Use [00](00_current_status_and_findings.md) for source status and [10](10_rollout_risks_and_decisions.md) for scope/delivery.

Date: **2026-10-15**. Feature specification and limited implementation plan; not implemented.

## 1. Meaning of the feature

Add **`moderation_enabled`**, a strict boolean defaulting to **true**, to both existing profile families:

~~~json
{
  "llm_profile_config": { "moderation_enabled": true },
  "image_profile": { "moderation_enabled": true }
}
~~~

This fragment shows field placement, not complete valid profile mutations. LLM placement is `ProfileConfig.moderation_enabled`; image placement is `ImageProfileFields.moderation_enabled`, exposed in its view and resolved profile.

The flag controls native application content checks for that operation's input and released output, using actual text/image/audio content. It applies to every role and compatible feature using that profile; no per-provider allow-list or separate per-feature matrix is introduced.

**Moderation remains independent native code in magic-worlds-api.** The flag does not select a moderation LLM profile, register a moderator generation feature, configure a graph, or send execution to api.magic_llm.

## 2. Defaults, strictness, and permissions

| Situation | Required behavior |
|---|---|
| New system/user/BYOK/seeded profile; create field omitted | Enabled |
| Legacy profile/revision/draft/job snapshot missing the field | Enabled |
| Explicit authorized saved boolean false | Disabled for that profile's operation |
| Null, string, number, malformed stored value | Reject invalid configuration; never coerce to disabled |
| Existing profile updated by a client that omits the field | Preserve its stored value; if historically absent, use true |
| Provider/model switched in an existing editor | Preserve the chosen flag; never reset it from provider capabilities |
| Moderator failure, timeout, unsupported media, or missing key | Unavailable for an enabled operation; never rewrite the profile false |
| No applicable profile | Enabled |

Use existing edit permissions: root edits system profiles; a user edits their own personal profile. Those permissions govern explicit disabling as well as enabling; no new role system is proposed. A request-level boolean, provider_options entry, prompt instruction, or generation credential cannot override the persisted setting. Reject or ignore untrusted override fields according to the existing strict endpoint contract.

Omission and explicit false must remain distinguishable during updates. Use the parsed field-presence information before applying DTO defaults; a default factory alone will overwrite an existing false during an old client's full update.

## 3. LLM lifecycle and BFF-only propagation

Current [ProfileConfig](/home/andres/PycharmProjects/magic-worlds-api/src/models/llm_profiles.py) holds the provider/roles configuration. System drafts use JSON; published and root draft-test revisions are reconstructed from relational columns in [LlmProfileRepository](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/llm_profile_models.py).

Necessary changes:

1. Add the strict default-on config field, include it in detail/draft/effective BFF views, and preserve it in create/update/publish/rollback/root draft tests.
2. Add one `moderation_enabled NOT NULL DEFAULT 1` column to `tb_llm_profile_revision`, using the project's existing migration conventions. Existing rows become on; missing draft JSON keys normalize to true without rewriting unrelated history.
3. Read/write the field in revision reconstruction/insertion. Keep the existing publication and optimistic-concurrency rules.
4. Read the selected revision's flag for the operation, including all normal selection sources. For retries/recovery, use the retained execution's profile/revision IDs, not today's unrelated default.
5. Carry the boolean in BFF-local call/turn context or load it from that immutable revision. Do not forward it into the gateway execution plan, agent graph, provider settings, or provider_options.

**Important implementation trap:** [admission](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/llm_execution_admission.py:490) constructs the strict [ResolvedLlmExecution](/home/andres/PycharmProjects/magic-worlds-api/src/models/llm_execution.py:95) with `**resolved`. Simply adding a new key to the current resolver dictionary will break that contract or leak application policy upstream. Separate the BFF metadata before plan construction; no api.magic_llm change is required.

A turn uses one selected profile revision for input and output. If selection changes before admission, use the existing conflict/retry behavior and check under the selected revision; do not check using one profile's false and generate under another profile's true. No new signed receipt or revision framework is required.

## 4. Image lifecycle and asynchronous completion

Add the same strict default-on field to image mutation/view/resolved-profile types, and one `moderation_enabled NOT NULL DEFAULT 1` column to `tb_image_profile`.

Update the existing repository's create/update/list/detail/resolve and seed paths. Return the flag and current row_version; preserve it when switching fal/OpenRouter models or platform/BYOK mode.

At enqueue, freeze `profile_id`, `row_version`, and the effective boolean in the existing job `input_summary`. Completion, webhook, polling, restart, and direct execution use that saved operation setting. Editing or archiving the profile later does not silently change an already accepted job. Legacy jobs without the field default on.

The flag stays outside image `settings`, provider_options, and provider payloads. Existing ownership, job idempotency, asset/card association, and billing stay intact. Actual-image release checks are in [12](12_audio_image_coverage.md).

## 5. Independent controls across a mixed operation

| LLM flag | Image flag | Behavior |
|---|---|---|
| true | true | Check LLM input/output and image prompt/actual result |
| false | true | Skip the parent LLM's native checks; still check image prompt/actual result |
| true | false | Check the LLM stage; skip native checks only for the image operation |
| false | false | Skip both native operations, recording each as explicitly disabled |

Never inherit a parent false across independently resolved child profiles. An image created under false must still be inspected if later supplied as input to an enabled LLM operation. Moderation status is scoped to content/configuration and operation, not a permanent trust label.

Call audio inherits the selected call-turn LLM profile. Narration may use a verified originating revision; absent trustworthy attribution defaults on. Standalone uploads, previews, lab audio, and music output have no new profile selector and default on. A music prompt writer's LLM flag governs its own text stage, not the unprofiled audio renderer.

Provider safety policies, authorization, restrictions, content-type validation, and resource ownership continue even when the native application check is disabled.

## 6. Existing editor changes only

Add one “Moderation” switch, on by default, to both existing system/personal profile editors. Explain its scope with brief text: “Check text, images, and audio for this profile.” Show a disabled state clearly where profile summaries already show settings; do not build a dashboard.

Frontend seams:

- [LLM types](/home/andres/WebstormProjects/magic-worlds/src/shared/types/llmProfile.types.ts), [contract parser](/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/llmProfileContract.ts), [draft helpers](/home/andres/WebstormProjects/magic-worlds/src/features/llmProfiles/llmProfileModel.ts), [ProfileEditor](/home/andres/WebstormProjects/magic-worlds/src/features/llmProfiles/ProfileEditor.tsx).
- [Image types](/home/andres/WebstormProjects/magic-worlds/src/shared/types/imageProfile.types.ts), [draft helpers](/home/andres/WebstormProjects/magic-worlds/src/features/imageProfiles/imageProfileModel.ts), [ImageProfileEditor](/home/andres/WebstormProjects/magic-worlds/src/features/imageProfiles/ImageProfileEditor.tsx).

Normalize missing legacy values to true in reads/drafts. Dirty-state comparison must consider missing equivalent to true and false distinct. Preserve false on model/provider changes and include the field in save payloads. Use existing UI primitives/design/story conventions during future implementation; this task edits no UI.

## 7. Focused migration and tests

The two columns, draft compatibility, DTOs, existing editor controls, and job metadata are directly related feature work. No new moderation tables, role system, profile framework rewrite, or historical execution migration is needed.

Test new/legacy/default/explicit-false values across system/personal profiles, all selection sources, revision publish/rollback/draft tests, image seed/update/restart paths, unsupported override attempts, same-revision input/output, and the mixed-operation truth table.

Test that enabled operations fail closed, disabled operations make zero native provider calls, and skipped checks never increment allow/checked metrics. Keep moderator independence tests with generation profiles/services unavailable. The full acceptance matrix is [09](09_validation_and_benchmarks.md).
