# Code review, gaps, and remediation criteria

Review date: **2026-10-15**. Severity describes the broader project's exposure, not whether an intentional testing exception is a coding mistake. All fixes below are **proposed**.

**Scope:** this is a broad audit backlog. The latest integration includes native text/image/audio checks, default-on LLM/image profile controls, and necessary release guards. Report fixes, companion safety, penalty redesign, and separate public-card text review stay outside it. [07](07_surface_integration_and_refactor.md) and [10](10_rollout_risks_and_decisions.md) define the boundary.

## 1. Findings register

| ID | Priority | Finding | Evidence | Completion criterion |
|---|---|---|---|---|
| G01 | P1 release blocker | Local voice output is permitted without classification | Runtime optional mode; empty lists; reproduced allow without classifier | Required mode, an available Clef adapter, enforced-mode health, and domain/latency acceptance |
| G02 | P1 defect | Automatic restrictions do not stop live calls | Real engine plus real gate/abuse service with fake storage: ban created, later sentence spoken | Restriction commit ends affected calls and subsequent uploads recheck access |
| G03 | P1 gap | Flagged successful images remain usable | Finalizer stores safety metadata without quarantine; client DTO accepts flagged completed asset | Pending/allow/block media lifecycle; protected reads and card attachments refuse pending/blocked assets |
| G04 | P1 coverage | Speech moderation is not BFF request moderation | Generation services dispatch without an input content check; public publish changes visibility | Input checks before protected inference dispatch in the native plan; publication coverage is a separate follow-up |
| G05 | Release dependency | Companion detector is inert | Empty lists and no classifier in startup wiring | Tested distress classifier/questions, distinct protective action, approved UI resources |
| G06 | P2 operational gap | Default minor-report eligibility can never place a hold | Production reader returns unknown email verification; default requires true | Trusted verification fact or an explicit replacement eligibility policy |
| G07 | P2 defect | Report allowance is vulnerable to concurrent count/insert races | Four parallel submissions with the same count snapshot passed limit three | Atomic DB-backed reporter allowance; concurrent integration test |
| G08 | P2 defect | Queue cursor skips timestamp ties larger than a page | 51 reports in one second: 50 returned, next page empty | Composite timestamp/ID cursor; no skips or duplicates across arbitrary ties |
| G09 | P2 defect | Failed abuse writes suppress retries | Dedup marker written before callback; retry never calls recovered writer | Durable idempotent event write or marker only after success with safe retry coordination |
| G10 | P2 defect | More than 32 uncached narration units are refused together | 33 synthetic units returned unavailable before any transport invocation | Supported bounded partitioning, ordered results, one overall deadline, no bypass |
| G11 | P2 assurance gap | Unmoderated allows disappear into allow metrics | Log has count; emitted metrics event omits it | Explicit unmoderated unit counter, mode gauge, alerts, and release checks |
| G12 | P2 UX gap | Privacy text promises a check before every spoken output | English voice privacy copy versus optional runtime mode | Copy and rollout mode agree; no enforcement promise in a bypassed release |
| G13 | P2 delivery gap | Three-event warnings have no visible delivery from moderation callback | Callback discards AbuseOutcome, including warning flag | User notification contract and once-per-threshold delivery test |
| G14 | Design risk | Existing cache does not bind verdict to context, surface, model deployment, or question/threshold revision | Text/language/policy key only | Versioned context-aware identity and invalidation on every decision-relevant change |
| G15 | Validation gap | No application-domain Clef accuracy or latency evidence exists | Research is documentation-only; old smoke used a different classifier | Frozen en/es corpus, held-out calibration, measured end-to-end distributions |
| G16 | P2 latency defect | Call classifier timeout does not bound the whole gate, including block persistence | A 350 ms fake block callback made a check take about 352 ms against a 300 ms classifier budget | One overall deadline; bounded action handling; never continue a restricted operation because persistence was deferred |

Additional static review for the latest request:

| ID | Priority | Finding | Necessary planned correction |
|---|---|---|---|
| G17 | Feature gap | LLM/image DTOs, resolved views, storage paths and existing editors have no moderation switch | Default-on boolean, legacy/read/update/revision compatibility, two columns, existing editor controls |
| G18 | Coverage gap | Speech moderation evaluates text; actual incoming/generated audio is not inspected | Raw-audio and final-text input checks; actual-audio check before playback/cache/download |
| G19 | Coverage gap | Images/uploads/provider completion can register readable assets without a native actual-image verdict | Stage/check outside locks, commit allowed asset only; cover fal/OpenRouter/BYOK and uploads |
| G20 | Integration risk | BFF admission expands resolved fields into a strict gateway plan | Carry profile moderation metadata locally; do not blindly add to resolved dictionary/provider_options |
| G21 | Release gap | Current call audio drainer emits chunks immediately; final verdicts cannot retract them | Bounded audio release hold; explicit whole-clip versus evaluated-window semantics |
| G22 | Integration risk | A whole-turn audio hold can stall the existing playback-driven look-ahead; first_chunk_at currently starts at provider receipt | Review bounded live windows before end_turn; track actual release/playback timing separately |

These findings are static evidence, not new runtime reproductions. Exact current seams and the provider-independent coverage matrix are in [12](12_audio_image_coverage.md); G17/G20 propagation details are in [13](13_profile_moderation_controls.md).

## 2. Primary code anchors

- G01/G11: [optional conversion and event payload](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/moderation.py:636), [health representation](/home/andres/PycharmProjects/magic-worlds-api/src/main.py:2172).
- G02/G13: [discarded abuse outcome](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/abuse.py:144), [call sentence decision](/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:3160), [call admission](/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_voice_call.py:653).
- G03: [asset mirroring and storage](/home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/engine.py:933), [provider flag normalization](/home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/fal_adapter.py:270).
- G04: [conversation execution](/home/andres/PycharmProjects/magic-worlds-api/src/services/conversation_execution.py), [shared execution](/home/andres/PycharmProjects/magic-worlds-api/src/services/llm_workflow_execution.py), [public publish](/home/andres/PycharmProjects/magic-worlds-api/src/routes/card_sharing.py:412).
- G05: [startup detector wiring](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/safety_wiring.py:94), [empty phrases](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/companion_safety_lists.py), [draft crisis resources](/home/andres/WebstormProjects/magic-worlds/src/features/safety/crisisResources.ts).
- G06/G07/G08: [identity reader](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/minor_reports.py:159), [submit](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/minor_reports.py:362), [pagination](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/minor_reports.py:468).
- G09/G14: [block event deduplication](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/moderation.py:753), [cache lookup](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/moderation.py:606).
- G10: [classifier bounds](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/moderation.py:337).
- G16: [callback awaited after classification](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/moderation.py:642), [block callback awaiting](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/moderation.py:769).
- G12: [voice privacy copy](/home/andres/WebstormProjects/magic-worlds/src/app/i18n/locales/en.ts).

Line numbers describe the review snapshot and can move with concurrent edits. Function/module names are the more durable anchors.

## 3. Controlled reproduction details

The preceding review exercised the real implementation with existing test harnesses; no provider received prohibited content.

### G02: restriction created while a call continues

Use the real ModerationGate with a synthetic deterministic marker assigned to a severe category, the real VoiceAbuse over fake repositories, and `tests/voice/elevenlabs_call_harness.py`. Produce a marker sentence followed by a benign sentence. The first is withheld and an `abuse_disable_24h` row appears. The next sentence is still pushed to the speech provider fake, the segment is accepted, and the call remains live.

This reproduction establishes missing enforcement of a stored restriction, not failure to block the marker sentence itself. Ending calls for operator/minor-report/safety actions already has working hooks; automatic abuse restrictions need equivalent integration.

### G07: concurrent report allowance

Make four concurrent submissions against a configured limit of three. A barrier in the fake count repository makes each transaction observe the same initial count. All four submissions succeed. This reproduces a possible read/insert interleaving; a real MySQL concurrency test remains required. Existing count queries do not lock a reporter allowance row.

### G08: timestamp-only pagination

Create 51 reports with one shared timestamp using the minor-report harness. Request 50 rows, then follow `next_before`. The next page is empty although one report remains. The stored timestamp has second precision, so increasing precision alone would only reduce, not remove, the need for a unique cursor tie-breaker.

### G09: event persistence failure

Make the block callback fail once, then recover. Submit the same synthetic blocked input twice. Both verdicts block, but the callback is attempted only once because the reported marker precedes the failed write. Any eventual retry design must also prevent double counting after an ambiguous commit.

### G10: oversized narration batch

Use the real MagicLlmModerationClassifier with a fake successful transport. Send 33 unique safe units to the gate. All verdicts become unavailable and transport call count stays zero. Required mode refuses the batch; optional mode converts it to unmoderated allows. The replacement must define supported bounds and refuse or locally partition oversized speech batches; it should not change unrelated JSON-generation limits or redesign narration.

### G03: flagged asset response

Build an otherwise valid completed image job with an asset safety flag set to true. The real `_job_public` still returns it as a completed job with that asset. Combined with the inspected finalizer, this supports the absence of an application quarantine boundary. It is not a claim that any harmful image was generated during the review.

### G16: classifier deadline versus whole-gate latency

Use a synthetic deterministic blocking rule and an async block callback that sleeps 350 ms. The real call-surface gate returns a block after about 352 ms although `timeout_for('call')` reports 300 ms. The callback executes after the classifier deadline scope. This probe was run during the documentation task and used neither a database nor a provider. The same design must account for caller resolution, which also has its own timeout scope.

## 4. Integration hazards and separate enforcement work

The old gate treats generated-output blocks as user abuse events. A new probabilistic classifier can increase false positives and expose this attribution problem. Do not expand automated penalties merely because Clef returns a high score. The attribution distinctions in [06](06_policy_thresholds_and_context.md) inform evaluation; redesigning penalties or durable actions is separate from native client integration.

Do not remove SQL/workspace ownership, tool allow-lists, text escaping, secret checks, or provider URL validation after adding moderation. They enforce different properties and remain necessary even after an allow decision.
