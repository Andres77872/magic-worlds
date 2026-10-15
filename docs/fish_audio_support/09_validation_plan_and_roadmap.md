# Validation plan and implementation roadmap

This plan is proposed future work. No item below is marked passed by this report. The current application and provider documentation justify feasibility; deployment requires contract, integration and listening evidence.

## Phase 0 — Contract and quality discovery

Use synthetic approved scripts and authorized voices. Keep the experiment outside production user sessions, but shaped like their narration/call workload. Assign one owner for backend contract evidence and one for voice quality review before starting; calendar estimates depend on these results.

| Probe | Evidence to retain | Exit criterion |
| --- | --- | --- |
| Exact `model: drama-3` HTTP request | Dated request metadata, output format and selected-model evidence available from supplier | No reliance on silent default or obsolete preview identifier |
| Target MP3 configuration | Actual rate/channels/codec, byte/duration validation | Mono 44.1 kHz output works with the browser validator |
| Direction and scope | Neutral/directed takes, word correctness and reviewer scores | Direction changes delivery without changing intended words/identity |
| Spanish/English voices | Accent, numbers, names, short/long script results | A usable initial cast with declared language/model eligibility |
| Optional controls | One-at-a-time A/B evidence | Expose only controls with meaningful, acceptable behavior |
| Dictionary application | Valid and intentionally missing version fixtures | Known pronunciation works; silent unresolved reference does not masquerade as success |
| Price units | Known text-size variants and balance/debit observations | Count rule and applicable price documented for the account |
| Timestamp socket | Wire fixtures and event sequence | Drama generation, trailing metadata, stop/finish behavior verified |
| Socket closure/reuse | Cancellation/restart traces and slot/debit observations | Lifecycle and account occupancy measured; no speculative reuse |
| Design persistence | Candidate/persistence provenance fields and saved-voice render | A documented reproducible save path, or feature remains disabled |
| Retention/account eligibility | Account settings/order and feature-specific confirmation | Approved data handling and disclosure for enabled surfaces |

Capture redacted metadata and approved demo audio under the project's normal artifact rules. Do not commit credentials or private reference recordings. Do not turn a provider's benchmark into a passed application latency result.

## Phase 1 — Provider-aware foundation and HTTP

Implement and review the schema/capability proposal in [05](05_architecture_and_integration_approach.md), then the native HTTP adapter. Reuse moderation, jobs, ownership and quota infrastructure.

Dependencies and exit criteria:

1. Database checks/enums and backend/frontend readers support the new record shape while preserving v2 ElevenLabs records.
2. Catalogue and resolver validate provider identity and the approved voice/profile/surface combination.
3. Capabilities select controls/operations without hardcoding an ElevenLabs route.
4. HTTP synthesis has bounded requests/output, typed errors, exact model selection and provider-specific configuration.
5. Cache keys include the effective Fish request and applied dictionary/recipe versions.
6. Supplier concurrency/spend are accounted separately; existing application refunds and asset scope remain correct.
7. Privacy copy and account settings match the enabled data flow.
8. Fish previews and per-segment narration pass the acceptance corpus. Calls remain disabled.

Backend-first enablement does not mean an old SPA can safely consume unknown provider records. Coordinate reader compatibility before new writes, and test rollback with Fish records and completed assets present.

## Phase 2 — Native performance and scenes

Implement a trusted direction/span/event representation and source-aware compiler. Retain canonical text independently of provider syntax. Add pronunciation only after version resolution and the intended alphabet pass.

Whole-scene generation is optional after per-segment narration succeeds. Prove deterministic cast ordering, same-provider eligibility, logical line metadata, output ownership and a safe retry boundary. Mixed-provider casts keep the segment planner.

Acceptance includes normal/scoped/normal delivery, events without spoken marker leakage, words around dictionary substitutions, repeated names, Unicode boundaries and short/long multilingual text. Do not expose experimental language switching or unverified quality flags as established features.

## Phase 3 — Native calls

Implement the application timing event contract from [06](06_streaming_calls_and_alignment.md). Preserve the existing microphone uplink, Groq transcription, conversation engine and browser MP3 envelope.

Call enablement depends on: concurrent send/receive, metadata-only updates, revision replacement, canonical-text matching, bounded queues, epoch isolation, barge-in, exact-once admission release, partial failure behavior and real device playback. Keep first deployment to one supplier session per turn until connection reuse is proven.

Also resolve the existing conversation readiness blocker described in the [voice roadmap](/home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/00_current_status_and_roadmap.md). A call that fails in LLM tool collection before TTS cannot establish either provider's synthesis readiness.

## Later independent work

| Feature | Additional decision and proof |
| --- | --- |
| Designed/public catalogue | Save provenance/signatures, visibility workflow, rights and lifecycle policy |
| Native Fish ASR | Pro selection, event/speaker stripping, multilingual accuracy, new quality gates and microphone privacy |
| Hosted Agents | LiveKit/WebRTC client, scoped token minting, session ownership, custom LLM bridge and tool policy |
| Hosted audio editing | Published endpoint/entitlement, take ownership and timing/asset replacement |
| Self-hosted Drama | Exact license/revenue scope, GPU/runtime capacity, observability, serving/security and cost |

Do not quietly expand the first provider addition into these projects. Their gaps are documented because they are real opportunities, not because they are required for HTTP Drama narration.

## Test strategy

Use the existing backend/frontend test suites and fake transports for implementation. Add meaningful boundary tests for changed contracts; do not recreate vendor inference behavior in unit tests. A small controlled provider smoke suite proves selected hosted contracts, while listening and device tests cover behavior mocks cannot establish.

| Layer | Important cases |
| --- | --- |
| Data compatibility | v2 read/write, v3 Fish, mismatched provider/key, unknown record preservation, old-reader rollout |
| Compiler | Literal untrusted brackets, provider tokens, disallowed nesting, word boundaries, numbers, events, dictionaries and speaker indices |
| HTTP adapter | Binary success, JSON error, media-type mismatch, empty/malformed audio, timeout, cancellation and uncertain retry |
| Catalogue/resolver | Complete pagination, rights/provenance, unknown versus absent voice, locale/profile eligibility and substitutions |
| Usage/admission | Multiple workers/keys, shared account limit, expiry, cancelled attempts, insufficient balance, refunds and cache hits |
| Streaming | Partial/repeated chunks, null/empty alignment, final correction, offsets, closure, stop/finish and epoch isolation |
| Transcript ledger | Repeated words, normalized numbers, phonemes, events, uncertain trailing word and interrupted prefix |
| Browser | 44.1 kHz MP3, sequence integrity, cancellation, reconnect/replay, slow consumer and fallback playback |
| Privacy/operations | No secrets/raw content in logs, real scoped asset access, unsupported retention operations and rollback |

Run repository-required tests/builds when application implementation happens. This documentation pass does not need a frontend production build and does not claim the current application's tests passed.

## Listening corpus and proposed targets

Start with two approved voices, 12 original lines per language in English and Spanish, neutral/directed conditions and three takes per condition: **288 renders**. At an assumed average 120 logical characters, that is 34,560 logical characters before control syntax. This is an experiment-size estimate, not an invoice prediction. Expand to the intended six-voice cast only after the pilot identifies usable recipes.

Cover: calm explanation, restrained happiness, sadness without crying, controlled anger, fear without unwanted screaming, surprise, private thought, local emphasis, a positioned sigh, a pause, a recurring name and a number/question. Extend with long narration and a three-speaker scene after the short corpus works.

The following are **proposed initial acceptance targets**, to agree before measurement:

- No spoken control tokens, unauthorized speaker routing or cross-turn audio in accepted takes.
- No critical name/number errors in the approved-name test set; at least 99% intended-word correctness across the small reviewed corpus.
- Median reviewer score at least 4/5 for identity and intelligibility; direction following rated separately with examples of expected intent.
- Scoped effects end at their approved boundaries in the reviewed scope corpus; failures cannot be hidden by averaging.
- For calls, no old-epoch frames accepted after cancellation, and a device-measured target of no more than 250 ms from application barge-in cancellation to silencing buffered playback.
- Metadata-only corrections update timing without changing audio duration or billing; every approximate transcript result is labeled in internal evidence.
- A p50/p95 end-to-end call latency budget is set from an actual healthy application baseline before promotion. Provider TTFA alone is insufficient.

Small-corpus pass rates are release evidence for those cases, not a universal accuracy claim. Track failures per voice/locale and retain counterexamples; those determine whether a feature should stay experimental.

## Unresolved question register

| ID | Question | Why it matters | Resolution owner/type |
| --- | --- | --- | --- |
| Q01 | What exactly is a billed Drama character, including control text? | Correct spend and margins | Backend usage probe/vendor confirmation |
| Q02 | Is the quoted introductory/list price applicable to the account and native WS? | Price configuration | Account/billing check |
| Q03 | Which optional schema controls affect Drama? | Honest capabilities | One-at-a-time listening probe |
| Q04 | Is timestamp connection restart reliable after stop/finish? | Pooling and latency | Protocol probe |
| Q05 | How fast does close cancel compute/release a slot, and what is charged? | Barge-in capacity and spend | Protocol plus billing probe |
| Q06 | What is the hosted Drama speaker ceiling? | Scene admission | Small-to-limit contract probe |
| Q07 | How is a design candidate persisted with verified signatures? | Generated voice provenance | Vendor/schema clarification |
| Q08 | Which Drama endpoints/features qualify for the account's ZDR? | User disclosure and data handling | Account/order confirmation |
| Q09 | Which licensed/owned voices meet Spanish/English acceptance? | Initial catalogue | Rights review plus listening |
| Q10 | Is a hosted editing API actually available and entitled? | Future infilling | Published contract; defer until available |
| Q11 | What rights/license apply to the exact self-hosted artifact? | Self-host option | Pinned license/order review |
| Q12 | Are existing conversation and mandatory moderation profiles ready? | Calls before TTS | Current application readiness work |

## Rollout and rollback gates

Enable provider-aware reads, then limited new writes, then approved HTTP previews, then narration. Rich scenes and calls each get separate flags and acceptance. Make provider/surface status visible to operations and expose only supported controls to users.

Before each gate, record actual contract fixtures, tests, listening results, charge/retention evidence, owner and rollback action. Rollback disables new work and preserves readable records/assets; it must not delete voices, rewrite provider IDs or silently turn Fish failures into a different character voice.

The research recommendation is to proceed with Phase 0 and design the HTTP foundation. A schedule or production commitment should follow the contract/quality evidence, not the age of an API example.
