# Best practices and operations

The practices here are proposed Magic Worlds operating rules. Provider facts are linked where relevant. They apply after the architecture and surface gates in [05](05_architecture_and_integration_approach.md) exist.

## Start with a stable quality baseline

Use approved reference voices, exact model selection, neutral text and one compatible output configuration. Keep sampling and optional processing controls at documented defaults until their Drama behavior is evaluated. Add direction one dimension at a time and compare several takes.

Maintain a small reference corpus with short dialogue, long narration, questions, numbers, Spanish accents, names, thoughts and interruptions. Separate text correctness, identity, accent, direction following and loudness; one aggregate “good voice” score hides different failure modes.

For cloned references, prefer clean, natural, accurately transcribed recordings with no music or competing speech. Do not aggressively process away the vocal characteristics the model should preserve. Fish recommends short clear references; treat a usable reference as something proven by target-model samples, not merely a recording that meets a duration range. [Reference practices](https://docs.fish.audio/developer-guide/best-practices/voice-cloning).

Approve samples against the intended model and locale. A voice that passes neutral S2 speech has not automatically passed Drama whispering or Spanish calls. Retain the effective model/recipe and reviewed samples in catalogue acceptance metadata.

## Controls and normalization

Use curated semantic controls for routine users. Reserve arbitrary director text for an explicit authoring workflow with length, trust and moderation rules. Reject unexpected control tokens before compilation, and validate scoped spans before inserting provider tags.

Have one owner for each transformation: numbers, abbreviations, pronunciation, gain and loudness. Applying both application number expansion and provider normalization without tracking it can create mismatched text/alignment. Applying provider gain plus catalogue attenuation plus browser volume without calibration can produce inconsistent loudness.

Measure owned audio loudness/peaks and set conservative per-voice attenuation using the existing catalogue mechanism. Do not treat a dramatic shout as permission to exceed the playback safety target. Keep emotional intent and output gain separate.

Use pauses/events sparsely. If precise silence is required, compose it in owned audio with explicit duration. If a render pronounces a tag, crosses a scope boundary, switches identity or adds unrequested sounds, reject it rather than increasing control complexity blindly.

## Account-wide concurrency

Fish's documented native request limits are account-wide, shared across API keys and transcription: 5, 15 or 50 concurrent requests at the published prepaid thresholds, with enterprise customization. Native refusal is 429 without a documented `Retry-After` header. [Rate limits](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits).

Use a supplier-account admission coordinator across all BFF workers. A separate local semaphore per process/key can exceed the account limit as soon as multiple workers run. Implement lease/token expiry and exact-once release; measure the supplier's actual release delay after cancellation before assuming a slot is reusable.

Divide internal demand by surface without pretending separate keys create separate vendor capacity. Reserve a controlled portion for interactive calls, limit background narration, and make preview requests cheap to shed. Long ASR or narration requests can occupy a slot for much longer than a short call turn.

For example, an **application planning estimate** with five slots and average eight-second occupied time gives roughly 37.5 completed requests per minute. It is not a rate promise: long-tail duration, reserved slots, retry load and idle-stream accounting reduce practical throughput. Measure request occupancy, not only first-byte latency.

Avoid copying the current ElevenLabs Flash/nonflash pool sizes or automatic header-based shrinking into Fish. Keep health, concurrency and circuit state separated by supplier account so a failure in one provider does not disable the other.

## Retry and error policy

The following table proposes normalized application behavior; final error names should align with the existing domain error contract.

| Condition | Proposed behavior |
| --- | --- |
| Invalid request/model/reference | Fail validation or catalogue resolution; no automatic retry |
| Invalid API key/account access | Disable the affected provider route, alert operations; never expose credentials |
| Insufficient supplier credit | Stop new supplier admission; distinguish from user's application credits |
| Concurrency refusal | Queue/backoff with jitter under a deadline; adjust admission, not unlimited retry |
| Transient failure before audio | Retry only when allowed by surface policy; record uncertain duplicate-spend risk |
| HTTP timeout after generation may have started | Mark attempt uncertain; check available evidence before resubmitting |
| Partial streaming failure | End/cancel the turn cleanly; never replay the whole audible reply automatically |
| Voice confirmed unavailable/taken down | Mark catalogue status; use only an approved substitution policy |
| Malformed audio/timing/control leakage | Treat as contract/quality failure; retain safe diagnostic dimensions |

Bound attempts and total elapsed time. A successful application retry can still mean two supplier generations. Avoid presenting an application idempotency key as if Fish has a documented TTS deduplication contract.

On cancelled calls, separate local playback suppression from supplier compute/account-slot termination. Capture termination timing and unexpected post-close spend for reconciliation. Cancellation success is not established by closing a Python task alone.

## Cache, ownership and retention

Use the full effective request identity described in [05](05_architecture_and_integration_approach.md#cache-and-idempotency). Cache approved results before another supplier dispatch. Version changes to direction rendering, dictionaries or normalization invalidate acoustic equivalence even when display text is unchanged.

Do not cache private reference recordings or submitted directions in an unrestricted shared store. Keep finished assets under existing authorization and deletion rules. If asset reuse spans users/workspaces, its ownership/privacy semantics need explicit approval and implementation, not merely a matching hash.

Persist enough metadata to audit a render: effective profile, provider/model/voice, recipe/compiler, dictionary version, attempt status, output format/duration and supplier estimate. Avoid routine logs containing full private dialogue, raw audio, authorization headers or base64 payloads. Use request/turn IDs and compact error categories for correlation.

Supplier retention and local asset retention are separate. The [existing ElevenLabs history sweeper](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/ops/history_sweep.py:1) is provider-specific and disabled by default unless configured. Do not run it against Fish or tell users it deletes Fish content.

## Catalogue lifecycle and voice rights

Keep private supplier creation distinct from publication in the Magic Worlds deployment catalogue. Record origin, ownership/permission, source-model ID, visibility, languages, licensed status, review evidence and availability state.

Public discoverability is not proof of commercial permission. Fish's licensed filter is useful evidence, but inspect applicable voice terms and revocation/takedown metadata as well. A personal clone needs the speaker's authorization; a designed voice needs a verified design/persistence provenance path. [Model inventory](https://docs.fish.audio/api-reference/endpoint/model/list-models), [creation metadata](https://docs.fish.audio/api-reference/endpoint/model/create-model).

Refresh inventory with complete pagination and a reconciliation record. A missing item on one failed/incomplete page is not confirmed deletion. Separate transient fetch failure, private visibility, confirmed absence and rights revocation. Make new-job eligibility react to actual state while preserving historical asset metadata.

The current ElevenLabs gate checks its own source kinds, rate/notice terms and model-language samples. Fish should get its own policy, not forged metadata that passes an unrelated gate. Provider rights and application curation are independently necessary.

## Observability

| Signal | Purpose |
| --- | --- |
| Requested/effective provider, model and profile version | Detect model selection mistakes and substitutions |
| Queue wait and account-slot occupancy | Find admission bottlenecks and leaked reservations |
| Provider first byte/full completion, categorized by surface | Separate latency from total capacity cost |
| First audible browser output and barge-in silence | Measure actual user experience |
| Logical/provider text sizes and estimated billing units | Reconcile different supplier units |
| Received/delivered duration and cancelled/uncertain attempts | Distinguish generation spend from user credits |
| Alignment revisions, empty-audio updates and mapping quality | Detect lost corrections or approximate transcript commits |
| Quality failures and dictionary/reference resolution | Catch structurally valid but incorrect audio |
| Supplier balance/debit versus estimates | Find price/usage drift |

Use bounded dimensions: provider, profile, surface, locale and error category. Do not turn every private voice ID or dialogue string into an unbounded metric label. Existing server timing/VAD instrumentation remains useful; add browser audibility measurement rather than replacing it with vendor latency claims.

## Operational response and rollback

Keep independent flags for Fish previews, narration, scene rendering, calls and design. A low-risk HTTP enablement does not authorize all surfaces. Restrict an early pilot to approved voices/accounts while retaining existing authentication, consent and moderation.

For poor audio or rising errors, disable new affected work, allow safe in-flight completion or cancel under the established policy, and preserve owned assets. Investigate model selection, reference availability, compiler changes and provider incidents before broad failover. An outage in Fish should leave ElevenLabs budgets, keys and catalogue state intact.

Before promoting the provider, verify actual account configuration, privacy copy, balance monitoring, alert ownership, rollback behavior and device acceptance. These are concrete rollout dependencies, not claims that they were checked by this documentation pass.
