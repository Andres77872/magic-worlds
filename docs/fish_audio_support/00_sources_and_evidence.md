# Sources and evidence

Research snapshot: **2026-10-14**. This document makes the report's claims reviewable and distinguishes provider contracts from proposed Magic Worlds behavior.

## Evidence labels

| Label | Meaning |
| --- | --- |
| Documented | A current primary Fish page describes the feature or protocol; it was not exercised with this project's account |
| Source observed | The inspected local working tree contains the behavior or restriction |
| Recorded elsewhere | Existing project documentation reports an earlier check; this research did not repeat it |
| Proposal | A design recommendation, data shape, initial limit or acceptance target introduced by this report |
| Unverified | Needs a live contract probe, listening test, account check or vendor clarification |
| Vendor benchmark | A result published by Fish, under its measurement conditions; not a Magic Worlds measurement |

A documented request field proves schema availability, not that every model honors that field, that the account has access, or that its quality is suitable. A successfully rendered MP3 would prove neither correct speaker identity nor successful direction following without a listening test.

## Primary source register

All links below were consulted as primary sources during the research. The topic documents cite the relevant page beside the factual claim rather than reproducing complete vendor manuals.

| ID | Primary source | Use in this report |
| --- | --- | --- |
| F01 | [Drama 3 guide](https://docs.fish.audio/features/text-to-speech/drama-3) | Exact model identifier, directions, scoped delivery, multilingual and multi-speaker controls |
| F02 | [Emotion control](https://docs.fish.audio/developer-guide/core-features/emotions) | Bracket cues, placement and practical emotion vocabulary |
| F03 | [Native TTS API](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech) | Request fields, output formats and references |
| F04 | [OpenAPI schema](https://docs.fish.audio/api-reference/openapi.json) | Field constraints, dictionaries, candidates and wallet schema |
| F05 | [Plain WebSocket TTS](https://docs.fish.audio/api-reference/endpoint/websocket/tts-live) | MessagePack lifecycle without timestamps |
| F06 | [Timestamp WebSocket](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech-live-with-timestamps) | Revision snapshots, metadata-only events and chunk offsets |
| F07 | [Timestamp HTTP/SSE](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech-stream-with-timestamps) | Completed-text request with streamed audio and timestamps |
| F08 | [Pricing and rate limits](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits) | S2/ASR/design prices and account concurrency |
| F09 | [Drama 3 launch](https://fish.audio/blog/fish-audio-drama-3/) | October release, introductory/list prices and hosted editing status |
| F10 | [Changelog](https://docs.fish.audio/developer-guide/getting-started/changelog) | Recent releases and S1 retirement |
| F11 | [Model overview](https://docs.fish.audio/developer-guide/models-pricing/models-overview) | Production S2.1 alternative and model family context |
| F12 | [Voice design API](https://docs.fish.audio/api-reference/endpoint/openapi-v1/voice-design) | Stateless candidate generation and limits |
| F13 | [Create voice model](https://docs.fish.audio/api-reference/endpoint/model/create-model) | Multipart persistence, visibility and provenance |
| F14 | [List voice models](https://docs.fish.audio/api-reference/endpoint/model/list-models) | Owned inventory, pagination and licensed filtering |
| F15 | [Voice cloning practices](https://docs.fish.audio/developer-guide/best-practices/voice-cloning) | Reference recording quality |
| F16 | [Pronunciation dictionaries](https://docs.fish.audio/developer-guide/core-features/fine-grained-control/pronunciation-dictionaries) | Immutable versions and supported phoneme systems |
| F17 | [ElevenLabs migration compatibility](https://docs.fish.audio/developer-guide/compat/migrate-from-elevenlabs) | Scope and limitations of compatibility routes |
| F18 | [Compatibility capabilities](https://docs.fish.audio/developer-guide/compat/capabilities) | Placeholder STT metrics and format limitations |
| F19 | [Native speech-to-text](https://docs.fish.audio/api-reference/endpoint/openapi-v1/speech-to-text) | Batch transcription and Pro behavior |
| F20 | [Hosted Agents overview](https://docs.fish.audio/agents/overview) | Separate managed conversation product |
| F21 | [Agents protocol](https://docs.fish.audio/agents/deploy/protocol) | LiveKit/WebRTC transport |
| F22 | [Agents custom LLM](https://docs.fish.audio/agents/build/custom-llm) | External LLM bridge and session context |
| F23 | [Python SDK overview](https://docs.fish.audio/api-reference/sdk/python/overview) | SDK naming and asynchronous clients |
| F24 | [Drama 3 model card](https://huggingface.co/fishaudio/drama-3) | Model architecture, source-model speaker ceiling and benchmark conditions |
| F25 | [Fish Speech repository](https://github.com/fishaudio/fish-speech) | Self-hosting and infilling context |
| F26 | [Current repository license](https://github.com/fishaudio/fish-speech/blob/main/LICENSE) | Drama community-license scope |
| F27 | [S2 Pro model card](https://huggingface.co/fishaudio/s2-pro) | Different weights/license context |
| F28 | [Customer agreement](https://fish.audio/enterprise-terms/) | Customer content, ZDR and account contract |
| F29 | [General terms](https://fish.audio/terms/) | General service/content rules |
| F30 | [Privacy policy](https://fish.audio/privacy/) | General retention and processing disclosures |
| F31 | [Self-hosted inference reference](https://speech.fish.audio/inference/) | Distinguishing local inference from hosted API parameters |

## Local source baseline

The frontend commit at inspection was `81d0cf278e50da8c9c39867d1c1925b7bc38bf36`; the backend commit was `a3f1b530c7ad6ae9221a27fe71b45527b0221087`. Both working trees also contained existing changes. Those commit IDs identify the checkouts, not an assertion that every inspected line belongs to a clean commit.

The review concentrated on frontend voice domain types, effective-voice parsing, capability normalization, recipe controls, voice sockets, playback and published privacy copy; backend speech interfaces/types/providers, catalogue and resolver, TTS jobs and hashing, moderation/compiler, call orchestration/ledger, STT, limits, operations and canonical SQL constraints.

The precise local anchors appear in [01](01_current_integration_and_gaps.md) and [06](06_streaming_calls_and_alignment.md). The [existing voice roadmap](/home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/00_current_status_and_roadmap.md) is a useful readiness record, but source behavior takes precedence when describing integration seams.

## Documentation conflicts and resolutions

| Conflict | Resolution used here | Required follow-up |
| --- | --- | --- |
| Indexed documentation returned `drama-3-preview`; current Drama guide and native reference say `drama-3` | Use `drama-3`; reject obsolete identifiers locally | Probe exact header and retain dated model configuration |
| Model overview/general pricing lag the new release | Use the Drama-specific guide and dated launch for Drama; generic tables for S2 | Confirm current account pricing and model entitlement |
| Emotion page says 13 languages; current release advertises 83 | Do not impose the old count on Drama | Test the actual target locales and voice accents |
| Emotion page makes broad token/latency assertions | Do not treat them as Drama billing or latency guarantees | Measure payload, actual debit and end-to-end timing |
| Timestamp guide permits restart after finish; generated stop description mentions closing | Treat connection reuse as unverified | Test both orderly closure and successful reuse |
| Voice-design narrative says a longer preview is allowed; endpoint/schema cap is 150 | Use the stricter 150-character endpoint limit | Recheck before introducing UI validation |
| Create-model accepts design signatures; published candidate schema does not expose one | Do not fabricate a signature or substitute candidate ID | Obtain a documented persistence/provenance contract |
| Model-card metadata and body describe different licenses | Pin and review the actual license attached to chosen weights/revision | Resolve exact artifact license before self-hosting |
| Shared TTS schema contains controls documented for other models | Keep Drama baseline minimal | Test each optional knob before exposing it |

Current primary pages outrank stale search indexes and SDK examples. OpenAPI is useful for syntax, but a generated example that contradicts the declared media type does not override it. For example, a JSON-looking generated success sample does not turn native TTS audio bytes into a JSON response.

## Research limits

No credentials were read, packages installed, paid requests sent, recordings uploaded, databases inspected or application files edited. No acoustic quality, real account rate limit, geographic routing, retention setting, model-specific optional control or precise cancellation charge was independently verified.

The report can justify an integration plan; it cannot establish production readiness from documentation alone. The unresolved questions are explicit acceptance tasks in [09](09_validation_plan_and_roadmap.md), rather than assumptions hidden in code examples.
