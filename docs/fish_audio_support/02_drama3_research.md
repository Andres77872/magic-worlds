# Drama 3: capabilities and boundaries

## Assessment

Drama 3 is a good candidate for Magic Worlds' expressive narration and character performance because direction can be authored alongside the script and localized to a phrase. This advantage is broader than another natural-sounding voice: the application could preserve character intent, deliver a private thought softly, emphasize a discovered name and position a reaction within a scene.

That is a product opportunity, not a quality result from this project. The model launched on October 13, 2026. The initial decision should be an evaluated HTTP narration lane, with call eligibility earned separately. [Launch announcement](https://fish.audio/blog/fish-audio-drama-3/), [Drama guide](https://docs.fish.audio/features/text-to-speech/drama-3).

## Capability inventory

The following distinctions prevent hosted API support, model-level support and announced features from becoming interchangeable requirements.

| Capability | Evidence state | Magic Worlds use | Acceptance needed |
| --- | --- | --- | --- |
| Natural-language performance direction | Documented in Drama guide | Character intent and narration style | Repeatability, intelligibility and reference identity |
| Positioned human sounds and pauses | Documented | Reactions and scene rhythm | No spoken control text; no unintended long silence |
| Local delivery spans | Documented | Whisper a secret or emphasize a clue | Scope ends where intended |
| Direction language different from script | Documented | Spanish creators using English or Spanish directions | Equivalent results for the target script |
| Phrase-level language switching | Experimental | Bilingual dialogue/tutoring | Each voice/language pair; reliable fallback |
| Explicit pronunciation | Documented for listed symbol systems | English fantasy names and recurring terms | Correct symbols, locale and voice |
| Multi-speaker scene in one request | Documented hosted request shape | Narrator plus cast | Speaker continuity, order, segment ownership |
| Incremental TTS with timestamps | Documented native transport | Calls and later captions | Drama-specific latency and lifecycle probe |
| Voice design | Separate hosted endpoint | Curated synthetic cast | Candidate format, persistence and provenance |
| Partial take editing/infilling | Hosted API announced as forthcoming; self-hosted examples exist | Later narration repair | A published hosted contract or a separate local deployment |

Directions, scope, pronunciation and speaker usage are described in the [Drama guide](https://docs.fish.audio/features/text-to-speech/drama-3). Transport availability is described by the [timestamp WebSocket reference](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech-live-with-timestamps). Voice design is a [separate operation](https://docs.fish.audio/api-reference/endpoint/openapi-v1/voice-design); it is not a Drama TTS body field.

## Model selection is an application responsibility

The native API uses a `model` header, independent of the reference voice ID. A Fish voice model identifies a voice; the speech model identifies the engine. Store both explicitly. Use `drama-3` for the reviewed model and do not let a caller select a guessed name.

The documented fallback on an invalid/missing model header is particularly dangerous for evaluation: an experiment might return playable audio from S2.1 Pro while being labeled Drama 3. Require a local model allowlist, include the selected model in cache/usage/quality records and keep a dated contract fixture. A requested model label alone is not proof of the engine that generated a result. [Native TTS reference](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech).

## Shared schema is not shared control behavior

The native request schema includes sampling, prosody, normalization, chunking, context-conditioning and optional feature fields. Some descriptions are explicitly tied to S2. Keep those out of a Drama capability promise until individual behavior has been measured. An accepted field that has no audible effect is not a useful slider.

Start with text, reference voice, exact model and compatible output format. Introduce one additional control at a time, compare neutral and directed takes, and preserve the effective request in the evaluation record. Do not import voice-design `seed`, local inference `seed`, or ElevenLabs `stability` into a native Drama TTS body. [Native schema](https://docs.fish.audio/api-reference/openapi.json), [self-hosted inference reference](https://speech.fish.audio/inference/).

`chunk_length` describes internal text processing, not a documented maximum total script length. Magic Worlds still needs its own request-size and scene-duration admission limits. `quality-guard` is a schema feature whose actual backend/model availability must be established before presenting it as a production quality gate.

## Language and pronunciation

Fish advertises 83 languages for the release, but a language count does not establish a particular accent, code-switching quality or pronunciation alphabet. This project should prioritize its actual Spanish/English content and six-voice curation goals before testing a broad list of locales. [Launch](https://fish.audio/blog/fish-audio-drama-3/), [existing project status](/home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/00_current_status_and_roadmap.md).

The documented phoneme systems cover English CMU Arpabet, Chinese pinyin and Japanese romaji. Spanish support in speech does not imply a documented Spanish phoneme alphabet. For Spanish fantasy terms, compare natural spelling, vetted spoken aliases and voice selection; do not send generic IPA and assume it will work. Experimental language tags should remain hidden or explicitly experimental until a specific pair passes. [Pronunciation dictionaries](https://docs.fish.audio/developer-guide/core-features/fine-grained-control/pronunciation-dictionaries).

## Multi-speaker generation

Native scene generation takes an ordered list of voice references and zero-based speaker markers. The Drama model card describes up to 16 speakers, but the hosted deployment's effective ceiling and account limits still need confirmation. A small two- or three-speaker pilot is enough to test Magic Worlds' scene use. [Drama model card](https://huggingface.co/fishaudio/drama-3).

Whole-scene generation may improve continuity and reduce orchestration requests. It also changes asset ownership and retry granularity: one response can contain several characters, and a faulty later line may require regenerating the scene. Keep a deterministic mapping from application cast identity to speaker index. Mixed Fish/ElevenLabs scenes should use the existing per-segment path; they cannot be sent as one native Fish reference array.

## Hosted API, SDK and compatibility

The recommended first adapter is native backend HTTP/MessagePack WebSocket. The current backend already uses asynchronous HTTP and WebSockets; it needs a MessagePack codec, not a browser Fish SDK or GPU runtime. The vendor SDK has sync/async clients, but adoption should depend on whether it exposes the new model's required controls and events. [Python SDK](https://docs.fish.audio/api-reference/sdk/python/overview).

Fish's ElevenLabs-compatible routes are useful for isolated comparisons with existing clients. Their documented engine is S2.1 Pro; several ElevenLabs settings are ignored, and the documented streaming route is single stream-input rather than this project's multi-stream-input. Compatibility therefore cannot establish native Drama coverage. The native adapter should retain Fish's own words, revisions and control semantics. [Migration compatibility](https://docs.fish.audio/developer-guide/compat/migrate-from-elevenlabs).

## Self-hosting and latency claims

Drama's model card describes a 35B-parameter MoE with about 3B parameters active per token, rather than a small 3B model that needs only 3B weights. Serving uses a specialized runtime and audio codec path. This would be a separate GPU service with capacity planning, operational responsibility and license review, not a package imported into the FastAPI BFF. [Model card](https://huggingface.co/fishaudio/drama-3), [source repository](https://github.com/fishaudio/fish-speech).

Fish's reported H200 benchmark has approximately 89 ms median first audio at concurrency one, rising to approximately 450 ms at concurrency 64, with pre-encoded references. These are vendor model-serving measurements, not hosted internet response guarantees. Magic Worlds additionally pays for microphone segmentation, transcription, conversation generation, moderation, queueing, network delivery and browser buffering. Judge calls by measured first audible output after the user stops speaking, with component timings retained.

Self-hosted examples containing `previous_takes` or `audio_path` do not make those fields valid hosted `/v1/tts` parameters. The launch says hosted interactive editing is invite-only and its editing API is forthcoming. Plan complete approved-segment regeneration first. [Launch status](https://fish.audio/blog/fish-audio-drama-3/).

## Adjacent capabilities: transcription and hosted Agents

Native Fish transcription is a separate batch API, not evidence of continuous microphone streaming. The current Pro endpoint supports long recordings, speaker/word timing options and audio-event annotations. Select `transcribe-1-pro` explicitly; the documented fallback on an absent/unrecognized header is the older transcription model. Its default event annotations and speaker markers require deliberate cleanup before text enters the current conversation engine. [Native ASR reference](https://docs.fish.audio/api-reference/endpoint/openapi-v1/speech-to-text).

Replacing Groq therefore needs more than a URL/key change: compare recognition quality, define usable confidence/empty-speech gates, strip or separately represent nonverbal events, and verify the intended single-speaker behavior. Do not use neutral compatibility metrics as acoustic confidence. This work can follow TTS adoption without blocking it.

Fish's hosted Agents additionally manage conversation turn-taking and offer tools/knowledge/telephony, but use a LiveKit/WebRTC media/data protocol. Their custom LLM bridge accepts an external streaming endpoint with session/user metadata. Magic Worlds would need scoped token minting and a BFF bridge preserving its authorized workspace, published profiles and tool permissions; routing a raw public LLM endpoint around those checks would lose application ownership. [Agents overview](https://docs.fish.audio/agents/overview), [protocol](https://docs.fish.audio/agents/deploy/protocol), [custom LLM](https://docs.fish.audio/agents/build/custom-llm).

## Decision

Proceed to a controlled hosted API evaluation. Adopt Drama for HTTP content when direction following, voice quality, billing and retention meet the project's requirements. Preserve a separately configured S2.1 option if it proves useful, but do not silently relabel fallback audio as Drama. Defer calls until the lifecycle and timing work in [06](06_streaming_calls_and_alignment.md) passes, and defer infilling until an actual deployable contract exists.
