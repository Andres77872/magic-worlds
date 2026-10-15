# Native multimodal and profile-control validation

**Lifecycle: active implementation proposal, unimplemented native integration. Reviewed 2026-10-15.** Requirements and examples below define the intended feature; they do not establish current support. Use [00](00_current_status_and_findings.md) for source status and [10](10_rollout_risks_and_decisions.md) for scope/delivery.

Date: **2026-10-15**. Acceptance plan only; no new application tests or paid provider evaluation were run for these documents.

## 1. Native integration invariants

| ID | Acceptance evidence |
|---|---|
| N01 | Service constructs/classifies with generation profiles disabled and api.magic_llm unavailable |
| N02 | Direct selected-model Decisions request; service performs no profile resolution, graph execution, generation BYOK, or user-token lookup |
| N03 | Enabled input block/unavailable causes zero downstream LLM/image/TTS generation dispatches; explicitly permitted STT overlap is recorded separately |
| N04 | Enabled output block/unavailable causes zero unchecked user-visible text, image URLs/assets, or audio playback/frames |
| N05 | One client is reused/closed; deadlines, cancellation, disconnect, and supersede leave no leaked checks, staging files, or released late results |
| N06 | Missing/malformed scores, invalid media, HTTP faults, credentials/budget errors, and unsupported sizes/formats become unavailable |
| N07 | Every changed feature, retry/recovery, media read, and completion route reaches the correct boundary; shared routes avoid duplicate checks |

Use recording fakes at actual generation, asset creation/linking, frame delivery, and TTS boundaries. Asserting that a helper ran does not establish ordering.

## 2. Profile default and lifecycle matrix

| ID | Cases to verify |
|---|---|
| P01 | Every new, seeded, migrated, system, and personal/BYOK LLM/image profile defaults true |
| P02 | Missing legacy config/revision/draft/job field means true; malformed/null/string/numeric API values are rejected |
| P03 | Explicit authorized false causes zero native requests for its operation and records skipped, not allowed/checked |
| P04 | Omitted field on update preserves an existing false; provider/model changes do not reset the switch |
| P05 | LLM create/update/publish/rollback, root draft tests, explicit/feature/default selection, and retained retries preserve selected revision semantics |
| P06 | Image view/resolve/seed/update and enqueue/webhook/poll/direct/BYOK/restart paths use the saved profile version/flag |
| P07 | The four LLM/image on/off combinations in [13](13_profile_moderation_controls.md) work independently |
| P08 | Request overrides, provider_options, cross-owner/profile access, prompt text, credentials, and provider capability metadata cannot change enforcement |
| P09 | Two calls using the same content but different governing settings/config/context cannot reuse an incompatible cached decision |
| P10 | New flag remains BFF-local; strict serialized gateway plan/agent graph/provider payload stays compatible |
| P11 | No-profile uploads/previews/music and unattributed narration default on; call input/output share one turn's resolved setting |
| P12 | Existing editors read/save both states; missing equals true for dirty comparison, false differs; model switches preserve false |

Independence applies to the service, not to banning an ordinary caller from reading a generation profile's application flag. Do not fail N01 because profile-control integration exists outside the service.

## 3. Actual-media coverage

M01–M11 here are acceptance cases; the M01–M08 IDs in [12](12_audio_image_coverage.md) §1 are gap findings.

| ID | Cases to verify |
|---|---|
| M01 | Send real safe image bytes and decodable audio fixtures to the adapter, not filenames, prompt summaries, or transcripts alone |
| M02 | fal queued/webhook/poll and OpenRouter/direct images, system and BYOK, all inspect every returned candidate when enabled |
| M03 | Upload, portrait, scene/chat, gallery/result/read, card attachment, and completion events expose no unchecked pending image |
| M04 | Generated image staging/check occurs outside write locks; duplicate completion/cancellation exposes only the winning allowed asset and cleans losers |
| M05 | Call input audio plus final/merged STT text must allow before LLM dispatch; mismatched/replaced/superseded bytes cannot inherit a verdict |
| M06 | Narration, previews, lab, ElevenLabs/Fish synthesis, call output, theme-song music, cached/downloaded clips inspect actual output before release |
| M07 | Audio windows cover the complete stream including the final short tail; order, overlap/context, and no first-frame leak are verified |
| M08 | Container/codec/MIME/duration/byte bounds, invalid media, orientation/resizing, multi-image/clip counts, and long tails fail explicitly |
| M09 | Prompt allow with blocked image, transcript allow with blocked audio, and provider safety metadata absent/positive exercise independent evidence |
| M10 | Replayed/legacy assets without an eligible actual-content result are rechecked or withheld when enabled; explicit historical skips are not labeled approved |
| M11 | Live review windows complete without waiting for end_turn; long turns exceed the current look-ahead safely; playback/first-audio clocks advance only after approved release |

The provider/model agnosticism matrix crosses generation provider, model family, credential mode, feature, selection source, modality, and flag. Use representative pairs plus the real shared boundary; do not write a new test for every interchangeable model ID.

## 4. Contract and domain evaluation

Capture a small safe real canary for text, image, and audio at the exact selected endpoint before activation. Fake tests cover valid finite `noul` probabilities, exact question IDs, malformed/partial responses, duplicated keys, unexpected model substitution, HTTP/network faults, and bounded cancellation.

Media shape/limits are in [04](04_openrouter_decisions_integration.md). Test the actual processed bytes, including safe head/middle/tail markers for text and complete temporal coverage for audio. Unknown limits or unsupported media cannot be treated as inspected.

Evaluate actual questions with reviewed English/Spanish material, harmless fiction, help-seeking/quotation, adversarial state instructions, safe images with embedded text, audio codecs/noise/language variation, and speech/music/instrumental clips. Include harmful-category evaluation only with authorized reviewed material and never route it into generation/playback.

Keep calibration and held-out evaluation separate; report per-category/modality/language recall and false positives. Do not assume text thresholds transfer to pictures or audio. [Calibration research](https://arxiv.org/abs/1706.04599), [XSTest](https://aclanthology.org/2024.naacl-long.301/).

## 5. Latency and release measurements

Begin with short safe fixtures and typical bounded inputs from the actual backend region. Compare cold/warm pooled requests, input sizes, full question set, media preparation, and expected concurrency. Report sample count, P50/P95/P99, timeout/error share, first visible text, and first audible playback.

~~~text
time / backend revision / region / model / local policy revision
modality / purpose / enabled-or-disabled / profile revision-or-job version
safe case ID / bytes-duration-or-text-size / question count / concurrency
prepare_ms / queue_ms / remote_ms / policy_ms / release_hold_ms / total_ms
outcome / timeout-or-error / cache-status / supplied usage-cost
~~~

No raw private media, base64, credentials, or user identifiers belong in the general benchmark artifact. Include failures rather than reporting successful requests only. The current 300 ms call text budget is not proof of an audio SLA.

Full-clip review adds buffering for non-live assets. Live windows require cross-boundary evaluation and cannot be claimed equivalent to full-turn review. Waiting for the whole live turn can stall the current playback-driven producer; test this explicitly. Missing a budget means withholding enabled work, not silently skipping audio/image checks.

## 6. Focused regression and release evidence

Run relevant backend profile/repository/route, moderation, speech/call, image, and music suites after implementation. Run frontend profile-editor/API contract tests and `pnpm build`; typecheck stories only if they change. Tests should target new defaults, wiring, actual-byte inspection, and release ordering rather than unrelated refactors.

The earlier **797 backend tests, 97 frontend tests, and successful build** remain dated historical evidence in [00](00_current_status_and_findings.md), not results for this feature.

Attach N01–N07, P01–P12, M01–M11 results, actual contract fixtures, evaluated policy, measured latency/failure share, migration compatibility, and configuration/rollback evidence. Reporting, companion detection, warning/penalty redesign, and separate publication workflows are not made prerequisites.

Recheck the Decisions protocol, modality support, price, endpoint policy and model identity again at rollout, not only before implementation. Keep the dated contract fixtures and benchmark artifacts with the deployed adapter/policy version.
