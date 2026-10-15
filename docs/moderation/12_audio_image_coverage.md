# Audio and image review and integration plan

Reviewed: **2026-10-15**. Static repository review and primary-source research; no provider inference or new application code executed.

## 1. Current gaps

| Finding | Inspected evidence | Consequence |
|---|---|---|
| M01 Speech gate evaluates text | [moderation.py](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/moderation.py), [synthesis.py](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/synthesis.py) | Pre-TTS checks do not establish that generated audio was inspected |
| M02 Call input is validated then transcribed | [voice engine intake](/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:2101), [STT](/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/stt.py) | No native raw-audio moderation before the next LLM turn |
| M03 Image safety is provider metadata | [image finalizer](/home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/engine.py:896) | Stored flags do not inspect or withhold actual image content |
| M04 Upload bypasses generation entirely | [image upload](/home/andres/PycharmProjects/magic-worlds-api/src/routes/images.py:276) | A generation-only guard misses user-supplied images |
| M05 Audio has multiple release paths | [call audio drainer](/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/call_tts_elevenlabs.py:247), [preview download](/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_preview.py:519), [theme-song engine](/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/engine.py:617) | Guarding one TTS call misses playback, cached clips, and music |
| M06 Providers and completion modes differ | [image engine](/home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/engine.py), [speech synthesis](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/synthesis.py) | fal-webhook-only or ElevenLabs-only moderation would leave other paths unchecked |
| M07 Profiles have no moderation field | [LLM config](/home/andres/PycharmProjects/magic-worlds-api/src/models/llm_profiles.py), [image fields/view](/home/andres/PycharmProjects/magic-worlds-api/src/models/image_profiles.py) | Neither profile family can persist or enforce the requested default-on control |
| M08 Live production depends on playback | [flush gate and drainer](/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/call_tts_elevenlabs.py:156) | Holding an entire long turn can stall production before end_turn; current first_chunk_at is set before delivery |

The current call drainer delivers provider audio chunks as they arrive. Strict audio moderation requires a release hold, not a post-playback check. The image finalizer performs storage and asset/card-link writes under its completion transaction; adding another awaited external request inside that lock would increase contention.

## 2. Required coverage

“Enabled” below means the backend resolved the controlling flag as true. Missing flags and operations with no governing profile use true. [13](13_profile_moderation_controls.md) defines control ownership.

| Operation | Input checks when enabled | Output/release checks when enabled | Governing setting |
|---|---|---|---|
| LLM generation, any supported feature/provider | Text and any actual image/audio content the existing operation accepts | Generated text or returned media before delivery | Selected LLM profile |
| Live voice turn | Validated uploaded audio; final/merged transcript before LLM inference | Candidate speech text before TTS; actual audio before client frames/playback | LLM profile/revision selected for that turn |
| Narration from an attributed LLM result | Text and necessary context | Actual generated clip before asset/download release | Verified originating LLM profile/revision; otherwise default on |
| Voice preview and root lab | Fixed/arbitrary text; any existing reference media | Actual generated clip before cache/grant/download | Default on where no governing LLM/image profile exists |
| Profile-driven image generation | Prompt, negative prompt, and reference images where supported | Every returned image's actual bytes before completed asset/link/event | Selected image profile |
| Custom image upload | Validated uploaded image bytes | Withhold registered/readable asset and URL until allow | Default on; upload has no generation profile |
| Theme songs/music | Prompt/lyrics and existing reference media, if any | Entire audio asset, including instrumental output, before card link/download | Default on for the audio operation; writer's LLM profile governs its own stage only |
| Cached/replayed media and completion recovery | Preserve original operation attribution | Require an eligible actual-content result or recheck before new exposure | Frozen governing setting; missing legacy snapshot means on |

This inventory does not add an image-input feature to an LLM that cannot accept images, add a new audio profile type, or add video capture. Where a feature already accepts media, moderation must not fall back to prompt/transcript-only inspection.

## 3. One provider-independent contract

The native service accepts bounded text/context and typed image/audio bytes with validated content type. Callers supply only authorized media they already own or have fetched through existing trusted provider-storage controls.

Use one common result contract. The generation provider name, model ID, billing mode, feature name, or absence of a provider safety flag cannot imply an allow or turn the service off. Run checks outside provider adapters where possible, after their existing response normalization.

OpenRouter's current guide documents actual image/audio inputs for Clef Omni. Exact payload shapes and limits are centralized in [04](04_openrouter_decisions_integration.md). Model capability is not evidence of moderation accuracy, and this review did not test the hosted media route. [Official multimodal Decisions guide](https://openrouter.ai/docs/guides/community/multimodal-decisions).

## 4. Image implementation, limited to existing paths

1. Resolve/snapshot the selected image profile's boolean before generation. Check its text and supported input image content before provider submission when enabled.
2. Normalize fal queue/webhook/poll and direct/OpenRouter/BYOK outputs through the existing image engine. Retrieve/decode bounded owned candidate bytes using the existing storage/security controls.
3. Stage candidates where no public asset URL, card link, gallery row, or completion event exposes them. Check every returned image, not merely a thumbnail or the first item.
4. Outside the provider/network check, reacquire the existing completion lock and revalidate job/provider identity and terminal state. Only the winning allowed attempt creates releasable asset rows and links.
5. On block/unavailable, use existing failure/error/cleanup paths. For a multi-image job, initially withhold the whole job if any required candidate is blocked/unavailable; avoid a new partial-success protocol.
6. Apply the same actual-byte check to custom uploads before their asset registration/response. They default on without selecting a generation profile.

Reuse existing pending/mirroring/failure states and JSON metadata where sufficient. No review queue, new moderation tables, or publication platform is required. A small preparation-versus-commit split in this finalizer is related work required to avoid network checks under its row lock.

Upstream safety flags remain additional evidence. Do not turn provider filters off when native moderation is disabled, and do not reinterpret an upstream refusal as successful media.

## 5. Audio implementation and honest latency

Validate container/codec, decoded duration, sample rate/channels, and size using existing intake/transcode utilities. A filename or client-supplied duration is not enough. Wrap raw PCM in a supported container for the decision request without changing the audio ultimately played.

For call input, start native audio inspection after validation. STT may run concurrently if permitted by the existing processor contract, but await both the audio allow and the final/merged text allow before LLM inference. Bind both to the same turn/profile revision; cancel obsolete work on barge-in.

For output, retain the pre-TTS text guard and add an audio release hold after synthesis. Use complete bounded clip review for narration/previews/music and other non-live assets. No client chunk, asset URL, cache grant, or playback occurs until the relevant audio unit is allowed.

For live calls, use bounded decodable review windows that can finish before end_turn, with overlap and needed context, ordered release, final-tail coverage, and stop on block/unavailable. The existing producer waits on unheard-sentence/audio look-ahead; a naive whole-turn hold can prevent end_turn and therefore prevent its own verdict. Pick window bounds below the producer's progress boundary and test long turns. Do not rewrite the provider runtime or billing ledger to bypass that boundary.

Current first_chunk_at is set on provider receipt before delivery. Keep receipt and approved-release timing separate, and start playback estimation from actual release; held audio must not be counted as played. This is a small related timing correction at the release wrapper. Full-turn approval cannot be claimed from independent short windows. If whole-turn policy is required, withhold live availability until a bounded compatible design is validated. Never send an HTTP request for every small PCM/network frame.

Cached previews, narration assets, call downloads, and theme songs need the same release invariant. Reuse current media metadata for content/config identity when retaining approvals; a text-cache entry is insufficient. If no eligible result exists, recheck or withhold. This is not a bulk retrospective library reclassification project.

## 6. Evaluation and acceptance

Test actual safe image/audio fixtures, not only text labels: benign pictures, text embedded in pictures, orientation/compression/resizing, audio language/codec/noise variants, speech/music/instrumental clips, and cross-boundary context. Use authorized reviewed material for harmful-category evaluation; no unsafe fixtures reach downstream generation or playback.

Record original/processed media identity and bounds so an approved small preview cannot authorize different bytes. Avoid inferring a person's verified age, identity, consent, or account status from a media score.

Measure media validation/encoding, remote time, complete gate latency, first audible playback, memory, and error/timeout share. Existing 300 ms text-classifier timing is not a measured audio-review SLA. If a required media check misses its budget, withhold that operation rather than silently downgrade to text-only moderation.

The relevant profile on/off, provider/mode, lifecycle, and release tests are in [09](09_validation_and_benchmarks.md). No actual media moderation capability is claimed implemented by this document.
