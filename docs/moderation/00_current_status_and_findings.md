# Current status and findings

Review date: **2026-10-15**. **Lifecycle: maintained status; implementation is partial and the native replacement is planned.** Read [README](README.md) for scope and evidence labels. [01](01_code_review_and_gaps.md) maintains the findings and [10](10_rollout_risks_and_decisions.md) the proposed delivery.

**Cleanup source recheck:** frontend HEAD `5a29ad5` and BFF `2c2973d`, with concurrent working-tree edits. The direct Clef/Decisions adapter and requested `moderation_enabled` fields are still absent from LLM/image DTOs/repositories. In the BFF working tree (uncommitted, 2026-10-15) the shared synthesis boundary also dispatches Fish after the existing text gate; this is not raw-audio moderation. Vendor `live_moderation_enabled` metadata does not implement the requested profile switch. [Synthesis](../../../../PycharmProjects/magic-worlds-api/src/services/speech/synthesis.py), [LLM DTO](../../../../PycharmProjects/magic-worlds-api/src/models/llm_profiles.py), [image DTO](../../../../PycharmProjects/magic-worlds-api/src/models/image_profiles.py). Recent moderation commits are legacy-path only: api.magic_llm `c1afb8a` registers the `moderation` feature ([llm_features.py](../../../../PycharmProjects/api.magic_llm/src/services/llm_features.py)); BFF `6d6138d` adds the classifier transport, `speech_moderation.v1.json` graph, `FeatureKey` literal and `db.sql` seed row; frontend `946961c` exposes 'Speech moderation' in the profile voice group ([llmProfileModel.ts](../../src/features/llmProfiles/llmProfileModel.ts)); and BFF `a3f1b53` logs `unmoderated` counts while the metrics event still omits them (G11 in progress). Native work has not started in any repository (recheck 2026-10-15).

The runtime response, offline probes and test counts below belong to the preceding dated review. This cleanup did not rerun them, read local configuration again, call a runtime/provider or inspect a database. The optional-mode and metrics mechanisms remain in current source; configuration observations do not certify a running deployment.

This is a broad audit of current behavior. The latest plan adds actual text/image/audio checks and default-on controls on LLM/image profiles, while keeping execution native inside magic-worlds-api. Historical moderator-profile execution below is the path to replace. Reporting, companion safety, and unrelated enforcement work remain separate.

## 1. Assessment

Moderation is **partly implemented and operationally incomplete**. The strongest existing component is a shared pre-TTS gate. It is not a general BFF admission gate, and the observed local configuration bypasses classification when the classifier is absent.

Baseline commits inspected were frontend **a158e90** and backend **2c2973d**. Local untracked documents and environment files existed. Additional voice-related edits in both repositories appeared during the preceding documentation research; they were not made or reverted by that review or this cleanup. Test evidence below belongs to the preceding review snapshot, not a certification of later concurrent edits.

## 2. Capability inventory

| Area | Implemented today | Actual limitation |
|---|---|---|
| Speech gate | Deterministic layer, classifier seam, strict verdict parsing, caching, per-surface deadlines | Optional mode converts unavailable verdicts into allows |
| Deterministic policy | Versioned English/Spanish structure for eight categories | Every shipped term list is empty, pending policy sign-off |
| Classifier transport | Published system profile, graph execution through api.magic_llm, identity/plan caching | Not Clef; depends on generation infrastructure and is locally disabled |
| Narration | Batched checks before turn reservation; blocked clips receive zero billed characters | More than 32 uncached units exceed classifier request bounds |
| Calls | Each candidate sentence checked before provider text submission | A new automatic abuse restriction does not terminate an existing call |
| Preview and root lab | Speech checks and sanitized refusal paths | Do not establish general input or public-content screening |
| Abuse handling | Rolling counters and warning/disable/review thresholds | Failed writes can be suppressed by deduplication; warning outcomes are discarded by the moderation callback |
| Companion safety | Detector interface, pause restrictions, live-call ending hooks, frontend notices | Empty phrase lists; no classifier wired; enabling the flag alone cannot detect a signal |
| Minor reports | Submission, limits, eligibility, hold/review/escalation, root queue, expiry sweeper | Default verified-email rule has no usable verified-email fact; concurrency and cursor gaps |
| Image generation | Provider safety flags normalized and stored; fal and OpenRouter profile paths | No native actual-image check or default-on profile switch |
| Actual audio inspection | Existing input validation/STT and text checks before synthesis | No native raw-audio verdict or required audio release hold |
| Profile moderation controls | LLM revision/profile and image profile CRUD exist | Neither DTO/repository family exposes moderation_enabled |
| Public cards | Ownership/workspace checks and publish/unpublish | Public publishing is a visibility change without a content moderation step |
| General generation | Shared admission, execution, streaming, persistence, and billing | No shared content authorization before api.magic_llm |
| Observability | Counts, latency histograms, structured logs, root voice metrics | Optional-mode allows are not distinguished in the metrics event; healthy does not mean enforced |

Relevant source anchors: [speech gate](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/moderation.py), [lists](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/moderation_lists.py), [transport](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/moderation_transport.py), [safety wiring](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/safety_wiring.py), [public publishing](/home/andres/PycharmProjects/magic-worlds-api/src/routes/card_sharing.py), [image finalization](/home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/engine.py).

## 3. Observed local runtime

The local backend environment contained these nonsecret settings during the review:

~~~dotenv
LLM_PROFILES_ENABLED=true
VOICE_MODERATION_CLASSIFIER_ENABLED=false
VOICE_MODERATION_REQUIRED=false
~~~

At **2026-10-15T08:18:45Z**, a read-only request to the running local API's `/health/dependencies` returned overall `ok`; the speech-provider moderation component was also `ok`, with message `voice_moderation_optional`. Narration, calls, and previews were reported healthy. This establishes the local runtime's declared mode, not a production configuration audit.

An offline call through the real gate builder, with no classifier and required mode disabled, returned `allow`. Since the default deterministic lists contain no terms, that mode provides no application classifier verdict for nonblank uncached speech text.

The current implementation logs this bypass on startup. It is an explicit testing exception, not evidence that moderation was silently enabled by a published profile.

## 4. Existing speech contract

- Surfaces: narration, call, preview, and admin lab.
- Categories: sexual, sexual minors, sexual violence, self-harm, hate, real people, gore, and private data.
- Current classifier deadlines: **2 seconds** for narration/preview/lab; **300 milliseconds** per call sentence.
- Required mode: timeout, malformed output, classifier absence, and transport failure refuse speech.
- Optional mode: the same unavailable result becomes an uncached allow; known blocks still block.
- Verdict cache: process-local, 10,000 entries, 24-hour TTL; keyed by text, base language, and policy version.
- Block deduplication: per user and text key, also process-local and time limited.

The classifier deadline does not currently bound the whole call gate: a slow block callback can extend the check. A dated offline probe in the preceding review confirmed this separately from provider latency; see G16 in [01](01_code_review_and_gaps.md).

These are implementation facts from [moderation.py](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/moderation.py), not proposed Clef settings. Any retained cache must match the actual checked evidence. A new cache, receipt system, or distributed cache is not required for the native integration.

## 5. What passing tests establish

The preceding review ran three backend groups: **377**, **266**, and **154** tests, totaling **797 passed**. The frontend moderation/safety/reporting selection passed **97 tests in 13 files**, and `pnpm build` succeeded. The final backend group covered image engine/catalog/fake flow behavior as the review scope expanded.

The principal backend selections included moderation gate/transport/synthesis/calls, companion safety, minor reports and identity, chat/call access, abuse thresholds, speech metrics, voice access, attestation, image engine/catalog, and route fakes. Frontend selections included safety notices/hooks, minor reporting, the root queue, moderation metrics, pause behavior, and API adapters.

These tests use mocks or fakes. Some intentionally assert that policy lists are empty and features are dark. They establish control-flow contracts and failure handling; they do **not** establish Clef compatibility, multilingual recall, threshold calibration, or current deployment readiness. No new application tests are added in this documentation-only task.

## 6. Previously recorded provider evidence

The October 14 voice smoke (kept as a dated baseline under V-01 in the [voice status](../voice_refactor/00_current_status_and_roadmap.md)) recorded approximately **2.3 seconds** per old classifier batch against a 2-second budget, with intermittent transport errors. That test used the old generation-profile classifier, not Clef Omni. It explains the testing bypass but is not a benchmark of the proposed transport.

The model and latency research in [02](02_clef_omni_research.md) is external evidence. No paid OpenRouter/Cloudflare inference or prohibited-content-to-TTS testing was performed for this documentation task.

## 7. Current architecture versus requested architecture

~~~text
CURRENT SPEECH CLASSIFICATION
BFF speech gate -> api.magic_llm "moderation" feature -> published moderation graph/profile -> classifier

REQUESTED DIRECTION
BFF request moderation -> direct Clef adapter -> allow decision
                                            -> only then api.magic_llm generation

REQUESTED PROFILE CONTROL
Resolved LLM/image profile -> moderation_enabled, missing defaults true

REQUESTED MEDIA RELEASE
Actual generated image/audio -> native moderator when enabled -> asset/playback
~~~

The revised plan adds default-on profile controls and actual image/audio inspection before release, alongside input/output text checks. None is implemented by these documents. The detailed new review is [12](12_audio_image_coverage.md) and the profile contract is [13](13_profile_moderation_controls.md). Only directly necessary profile/media changes are in scope; no generation-framework, reporting, or companion refactor is required.
