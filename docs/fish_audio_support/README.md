# Fish Audio support research

**Research date:** 2026-10-14. **Scope:** Magic Worlds frontend and its sibling `magic-worlds-api` backend. The research observations below describe that original review.

**Implementation update, 2026-10-15:** the first HTTP release and the owner-prioritized voice-creation workflow are implemented in both working trees. English/Spanish candidate generation, signed private persistence and fresh Drama 3 speech passed the real application flow. The confirmed development database is upgraded; Gabriel is the only selected starter, with Spanish preview/narration and EN/ES root creation enabled for development. Production rollout and later performance/call releases remain gated. See [implementation status](11_implementation_status.md), [development evidence](12_development_validation.md) and the [voice-creation handoff](13_voice_creation_development.md).

**Example voices, 2026-10-15:** at the owner's request, twelve original Fish voices (six Spanish, six English roleplay archetypes) were designed, automatically accepted on Drama 3 and published beside Gabriel. Nobody has listened to them yet; the development `.env` now approves `en`, effective after the API restarts. See [example voice set](19_example_voice_set.md).

**Planning addendum, 2026-10-15:** [Coordinated frontend/backend implementation plan](10_frontend_backend_implementation_plan.md), including the UI/UX changes, API/data contracts, dependencies, delivery slices and rollout gates.

**Advanced implementation, 2026-10-15:** direction, phrase annotations, pinned pronunciation versions and metered authored previews are implemented separately from voice creation. The advanced expansion is `2026_10_fish_performance` (101 tables), followed by the current M6 expansion below; the advanced flag remains off pending R2 listening. See [advanced handoff](14_advanced_performance_development.md).

**Scene implementation, 2026-10-15:** M5's planner, owned job/API and session controls are implemented behind a disabled flag. Native PCM with owned MP3 encoding now passed four speakers at 1,200 compiled characters and fresh application reuse, after incomplete native MP3 tails. R3 remains unaccepted pending identity/order, word and device review. See [scene handoff](16_scene_narration_development.md).

**Call implementation, 2026-10-15:** M6 now connects the native bridge, word ledger,
shared account admission and provider-aware call/consent UI. The configured schema
is `2026_10_fish_calls` (101 tables), applied with verified backup/restore and
compatible readers for every DDL shape. Native engine completion and cancellation
passed with explicit application fixtures. Real root authentication/profile
resolution and the callbot graph/reply collector also passed. Required moderation
timed out at its preview deadline; public calls remain off pending R4.
See [call engine handoff](18_call_engine_development.md).

Fish Audio can be added as a second speech provider. The strongest initial use is **Drama 3 for voice previews and generated narration**, followed by richer performance direction and multi-speaker scenes. Calls are feasible, but require a streaming adapter and a revision-aware alignment contract. Keeping the existing Groq transcription and Magic Worlds conversation engine makes the first integration smaller and preserves session ownership.

The current architecture provides useful speech interfaces, an opaque voice catalogue, asynchronous media jobs, moderation, quotas, caches and browser MP3 playback. Its working implementation still assumes ElevenLabs throughout the stored voice schema, model registry, catalogue workflows, call transport, operational jobs and price estimates. A factory entry alone would not provide working Fish support.

The requested model is selected with the exact native API header **`model: drama-3`**. Fish documents silent fallback to S2.1 Pro when this header is absent or unrecognized. Validate the model identifier before sending requests. The release is recent: Fish's launch announcement is dated October 13, one day before this review. Documentation and contract probes therefore both matter. [Drama 3 guide](https://docs.fish.audio/features/text-to-speech/drama-3), [launch announcement](https://fish.audio/blog/fish-audio-drama-3/).

## Read the report

| Document | Purpose |
| --- | --- |
| [00 — Sources and evidence](00_sources_and_evidence.md) | Research provenance, source hierarchy, documentation conflicts and limits |
| [01 — Current integration and gaps](01_current_integration_and_gaps.md) | Actual ElevenLabs integration, reusable components and provider assumptions |
| [02 — Drama 3 research](02_drama3_research.md) | Hosted capabilities, model maturity, self-hosting and feature boundaries |
| [03 — Emotions and performance](03_emotions_and_performance.md) | Detailed direction guide, original scripts, existing emotion mapping and safe compilation |
| [04 — API usage and examples](04_api_usage_and_examples.md) | Native HTTP and MessagePack WebSocket examples, dictionaries, scenes and voice design |
| [05 — Architecture and approach](05_architecture_and_integration_approach.md) | Provider-aware data, capabilities, routing, compilation and staged adoption |
| [06 — Calls and alignment](06_streaming_calls_and_alignment.md) | Streaming lifecycle, interruption, timing corrections, source offsets and playback |
| [07 — Best practices and operations](07_best_practices_and_operations.md) | Quality calibration, concurrency, retries, caching, metrics and catalogue lifecycle |
| [08 — Cost, privacy and licensing](08_cost_privacy_and_licensing.md) | Dated prices, billing units, retention, voice rights and self-hosting terms |
| [09 — Validation and roadmap](09_validation_plan_and_roadmap.md) | Concrete discovery work, acceptance criteria, dependencies and unresolved questions |
| [10 — Frontend/backend implementation plan](10_frontend_backend_implementation_plan.md) | Paired implementation milestones, contracts, UI flows, repository touchpoints, tests and deployment |
| [11 — Implementation status](11_implementation_status.md) | Implemented first-release scope, validation results and remaining live rollout gates |
| [12 — Development validation](12_development_validation.md) | Actual API access, Free-plan/prepaid-credit verification, audio, billing observations and isolated MySQL evidence |
| [13 — Voice creation development](13_voice_creation_development.md) | Owner-prioritized English/Spanish creation, candidate comparison, signed private save and development release configuration |
| [14 — Advanced performance development](14_advanced_performance_development.md) | Optional direction/phrase editor, immutable pronunciation versions, private metered previews, narration integration and R2 acceptance gate |
| [15 — Scene decision](15_scene_narration_decision.md) | Independent scene asset, volume, retry and spend boundaries |
| [16 — Scene development](16_scene_narration_development.md) | Planner/API/player, native short-scene evidence and unresolved longer-response failures |
| [17 — Call transport foundation](17_call_transport_development.md) | Native timestamp transport, revisable word/source matching and remaining engine/R4 work |
| [18 — Call engine development](18_call_engine_development.md) | Integrated call bridge/ledger/accounting, gated eligibility/consent, schema handoff and remaining R4 acceptance |
| [19 — Example voice set](19_example_voice_set.md) | Twelve original EN/ES designed voices published after automatic checks, pitch-based candidate choice, English gate and listening review |

For implementation planning, start with 10, then use 01, 05, 06 and 09 as supporting evidence. For Drama 3 authoring and API experiments, read 02, 03 and 04. All examples are original research examples; none are assertions that Magic Worlds already exposes those features.

## Recommended sequence

1. Prove the exact hosted Drama 3 HTTP request, acceptable owned voices, Spanish/English performance, formats, actual charge units and account eligibility.
2. Add provider-aware voice data and capabilities, then Fish HTTP previews and single-speaker narration. Preserve the existing ElevenLabs path and stored v2 records.
3. Add a trusted performance representation, pronunciation dictionaries and optional whole-scene rendering. Retain a per-speaker fallback for mixed-provider casts.
4. Add native Fish WebSocket calls only after timing revisions and cancellation pass the call acceptance tests.
5. Evaluate Fish transcription, hosted Agents and self-hosting as separate decisions; each changes additional contracts.

## Findings that affect the decision

- **Performance controls need a richer representation.** Seven emotions and ElevenLabs sliders cannot express local word delivery, positioned sound events, character intent or ordered scene speakers.
- **Timing updates need their own path.** The original call engine discarded audio-less timing events. M6 now applies Fish word revisions before the audio-only branch; metadata appends/bills no audio. See [the baseline gap](06_streaming_calls_and_alignment.md#the-current-timing-gap) and [current engine handoff](18_call_engine_development.md).
- **Calls do not have the same transport semantics.** Fish's native input is MessagePack with start/text/flush/stop events; the current adapter uses ElevenLabs JSON multi-context input. Ending input and cancelling an interrupted turn need different handling.
- **Compatibility endpoints provide partial migration support.** They serve S2.1 Pro and ignore several ElevenLabs controls. They do not establish native Drama 3 support or the current multi-context contract.
- **Pricing is model-specific.** The Drama launch quotes characters, while the general S2 pricing page uses UTF-8 bytes. A generic Fish or ElevenLabs character estimator would be misleading.
- **Editing is not a verified hosted feature.** The launch announces an editing API as forthcoming; self-hosted infilling examples do not establish a callable hosted editing endpoint.

## Evidence and verification

This suite combines primary Fish documentation and vendor source/model cards with a read-only review of both repositories. Source observations describe the working trees on the research date. Existing voice documentation also records prior local smoke runs; those records are attributed and are not presented as tests run for this report.

The original research pass was documentation only. Document structure, internal/local links, JSON payload syntax, Python example syntax and shell example syntax passed offline checks. The WebSocket example's event order, audio concatenation and timestamp replacement/offset logic also passed synthetic-frame checks with a stubbed transport/codec. Cost and corpus arithmetic were checked. These research checks do not exercise Fish's real protocol or inference; model quality, billing, cancellation and account-specific privacy settings still require the validation work in [09](09_validation_plan_and_roadmap.md). Application implementation and its separate verification are recorded in [11](11_implementation_status.md).

**Maintenance:** revisit the model identifier, Drama pricing, timestamp lifecycle, optional controls and voice-design persistence before implementation, and revisit promotional pricing before November 13, 2026.
