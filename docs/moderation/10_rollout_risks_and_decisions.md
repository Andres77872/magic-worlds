# Bounded delivery plan and risks

**Lifecycle: active implementation proposal, unimplemented native integration. Reviewed 2026-10-15.** Requirements and examples below define the intended feature; they do not establish current support. Use [00](00_current_status_and_findings.md) for source status; this document owns scope and delivery.

Date: **2026-10-15**. Proposed implementation; Markdown only in this task.

## 1. Accepted requirements

| ID | Requirement |
|---|---|
| D01 | Use `cloudflare/clef-omni` for moderation for now |
| D02 | Native direct moderation execution inside `/home/andres/PycharmProjects/magic-worlds-api` |
| D03 | No moderation generation profile/feature/graph or api.magic_llm execution; service independent of generation infrastructure |
| D04 | Enabled inputs checked before generation and actual outputs before protected release |
| D05 | Every LLM and image profile has an application `moderation_enabled` switch, default true for new and existing profiles |
| D06 | Same behavior across generation providers/models/features, platform/BYOK, and actual text/image/audio modalities |
| D07 | Only directly necessary profile fields/editors, media/content guards, local persistence and tests; no unrelated refactor |

D05/D06 expand the earlier text/speech-only scope. They permit application metadata on generation profiles while D03 keeps moderator execution independent. OpenRouter Decisions remains the proposed first transport; no second adapter is required.

## 2. Six limited work packages

| Package | Deliverable | Acceptance |
|---|---|---|
| MOD-01 | Direct text/image/audio client, small service, local policy, dedicated key, pooling and total deadline | N01/N02/N06; safe contract fixtures |
| MOD-02 | Default-on profile DTO/view/revision/resolution fields, two columns, legacy omission handling, BFF-local flag propagation and image job snapshot | P01–P11; no gateway contract change |
| MOD-03 | One switch in existing LLM/image editors and necessary type/parser/draft/save changes | P12; focused frontend tests/build |
| MOD-04 | Small common input/output guards at current feature boundaries and native replacement of legacy speech classifier | N03/N04/N07; on/off truth table and revision consistency |
| MOD-05 | Actual image/audio checks, private candidate staging/release holds, upload/cache/download/music coverage | M01–M11; no unchecked media exposure or live producer stall |
| MOD-06 | Relevant regressions, safe provider canaries, policy evaluation, measured text/media latency and compatible rollout notes | All [09](09_validation_and_benchmarks.md) evidence; no claims based only on mocks |

The [ROADMAP](../ROADMAP.md) moderation row tracks the whole program; MOD-01–MOD-06 here are its delivery packages, and MOD-01 here means only the client package.

MOD-01/02 establish behavior; MOD-03 exposes the requested control; MOD-04/05 wire content and delivery; MOD-06 verifies the result. These are feature slices, not new services or infrastructure projects.

Every changed file must support this feature directly. Necessary local splitting of image preparation from final commit and audio buffering are moderation changes; rewriting billing, provider runtimes, profile selection, reporting, or generic orchestration is not.

## 3. Sequence and compatibility

1. Add default-on schema/DTO compatibility and native client tests. Defaults must cover old revisions/drafts/jobs, not only newly created profiles.
2. Carry application flags locally; preserve the strict gateway execution payload. Verify normal profile publication, selection, retries, and image job recovery.
3. Add the two existing-editor switches and same-operation input/output guards. Disabled is an explicit saved state, never an outage fallback.
4. Add actual image/audio inspection with release holds. Cover uploads and unprofiled media by default; verify all provider completion and replay paths.
5. Run safe text/image/audio contract probes, reviewed policy evaluation, and backend-region latency measurements. This task performed no paid probes.
6. Enable tested behavior in staging, exercise failures/cancellation and version compatibility, then deploy through the normal process. Describe incomplete surfaces honestly until their tests pass.

Do not activate a “moderated” profile implementation that only checks prompts/transcripts while media is released unchecked. The UI field alone is not feature completion.

## 4. Related storage and explicit exclusions

Allowed persistence changes are the two profile columns, compatible draft JSON handling, image job snapshot, and minimal review metadata in existing structures. No new moderation tables, approval receipts, outbox, policy management platform, quota service, billing ledger, or bulk historical reclassification.

No changes to api.magic_llm, magic-agents, magic-llm, or api.auth. The frontend changes are only the requested profile control and necessary contracts/error handling, not new screens or a dashboard.

Report races/cursors/identity, companion detection, account penalty redesign/delivery, warning notifications, and general public-card text review workflow stay separate. Existing provider safety filters remain unchanged.

## 5. Risk register

| Risk | Necessary mitigation/evidence |
|---|---|
| Missing/omitted legacy field turns moderation off | True defaults at schema/DTO/read boundary; omission/update tests |
| Flag leaks into strict gateway plan or provider fields | BFF-local propagation; serialized-contract regression |
| Input checked under one profile, output generated under another | Same selected revision/operation context; existing conflict handling |
| Parent LLM false bypasses image true | Independent flags; four-way mixed-operation tests |
| BYOK/direct/non-fal/non-ElevenLabs paths escape checks | Common normalized boundary; provider/mode/modality matrix |
| Prompt/transcript is mistaken for media review | Actual-byte fixtures and before-release tests |
| First image URL/audio frame escapes while check is pending | Private staging/release hold; real emission-boundary assertions |
| Audio windows miss later context or final tail | Full non-live clip baseline; evaluated live windows with complete coverage |
| Whole-turn hold stalls playback-driven call producer | Bounded windows finish before end_turn; test look-ahead and approved-release clocks |
| Network classification extends DB locks | Local prepare/check/commit split using existing job locks |
| Cached/legacy asset is labeled safe without inspection | Eligible content/config identity or recheck/withhold |
| Provider latency misses real-time requirements | Warm pooling, small valid media, measured first playback and failures; no bypass |
| Arbitrary thresholds harm accuracy | Per-modality/language evaluation before enforcement |
| Old binary ignores new controls after rollback | Retain compatible native implementation; withhold affected operations |

## 6. Definition of done

The native moderator remains independent; every profile defaults on and supports an authorized explicit off; every selected setting is applied consistently across relevant inputs/outputs/providers; actual images/audio are checked before exposure; and tests/evaluation/latency evidence demonstrate it.

An explicitly disabled operation is reported as skipped, not approved. Unprofiled and legacy missing-field operations default on. No unrelated audit gap is claimed fixed.

Rollback preserves saved flags and schema compatibility, and restores a tested direct Omni version. It must not silently restore graph-based moderation, optional unclassified behavior for enabled profiles, text-only substitution for media, or a different model/credential.
