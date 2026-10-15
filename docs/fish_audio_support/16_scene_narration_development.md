# Scene narration development handoff

October 15, 2026. M5's planner, owned job/API and session controls are implemented.
**R3 is unaccepted and `FISH_AUDIO_SCENE_ENABLED=false`.** Scene transport now
uses native PCM with owned MP3 encoding after longer native MP3 requests had
incomplete tails. The four-speaker/1,200-character boundary and a fresh isolated
application flow passed with PCM; acoustic/device review remains open.
Gabriel remains the only development starter. English/Spanish root voice
creation continues independently.

## Behavior

The [scene decision](15_scene_narration_decision.md) is implemented as one explicit
recording of an owned completed assistant reply. The server resolves selected
voices and immutable pins, orders the cast deterministically, moderates dialogue
and metadata, then compiles speaker routing. The safe manifest preserves logical
source ranges/hashes, cast/utterance indices, voice keys and gain. Native IDs stay
private. Cache identity includes cast, order, performance, compiler and renderer
version. Older recordings remain readable as saved alternatives.

One scene has one job, charge and complete owned asset. Existing admission,
reuse and settlement apply. Failures refund application credits; uncertain
supplier spend remains recorded. No partial output, automatic generation retry
or silent voice replacement occurs. Explicit retry may incur supplier spend.
Status recovery prioritizes running/reusable work over earlier failed attempts,
including attempts created in the same timestamp second.

The fragment queue, message metadata, snapshots and earlier assets are preserved.
Adventure and character-chat cast controls have separate cost, saved-cast,
recovery and playback controls with English/Spanish copy. Recovery performs GETs;
playback applies user volume/mute and cast attenuation. Mixed casts retain
individual narration. Voiced thoughts remain individual because binary HTTP
provides no verified timings for their separate volume factor. Disabled and
archived origins retain owned audio reads.

Planned bounds are four speaker slots including narrator, 64 passages and 1,200
compiled code points. The long-text bound passed the native PCM/MP3 encoding
contract, with listening acceptance still open. These are application bounds,
not vendor maxima. Job JSON stores the manifest. The current configured schema
is `2026_10_fish_calls` (101 tables); this codec change needs no migration.

## Native evidence

The original probes below explicitly selected `drama-3` and requested mono
44.1 kHz, 128 kbps MP3. Primary contracts: [Drama dialogue](https://docs.fish.audio/features/text-to-speech/drama-3),
[native HTTP](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech).

| Independent case | Observation |
| --- | --- |
| One-speaker reference array | Valid MP3. |
| Two distinct licensed references | Valid MP3. |
| Four distinct references, 319 compiled code points | Valid MP3, 21,943 ms; supports the development cast bound, not a vendor maximum. |
| Seven references | Definitive invalid-request refusal; no replay. |
| Six references; separate five-reference case | HTTP 502; uncertain spend retained, neither retried. |
| Four references, 1,200 compiled code points | Strict MP3 validation rejected the native response; uncertain outcome retained. |
| New diagnostic case, four references, 600 compiled code points | HTTP 200, 929,188 bytes, 2,223 complete frames/58,070 ms, then only 66 bytes of a required 418-byte frame. No garbage or ID3 tags. Partial tail rejected. |
| Real application scene, two speakers, 130 compiled code points | One native request, one owned MP3; reuse generated no extra native request. SHA-256 `baeff95e8abc67b810f1d036919e33c1566395a3f20b3c3b057e7bf886cfa387`. |

The diagnostic response is stored privately for offline analysis. It demonstrates
an incomplete response, without proving a particular vendor limit or cause.
The adapter does not strip its tail to disguise partial output. No uncertain
request was replayed and these probes created no catalogue entries or models.

### PCM renderer follow-up

A new four-speaker/1,200-character WAV probe returned HTTP 200, but its RIFF/data
lengths were streaming placeholders. Strict validation rejected it and retained
uncertain spend; its header was not rewritten to claim success.

A separate new PCM probe at the same application bounds returned `audio/pcm`,
7,258,112 whole sample bytes in 11,182 ms. Encoding all received samples produced
3,152 complete mono 44.1 kHz / 128 kbps MP3 frames, 82,338 ms, 1,317,407 bytes.
MP3 SHA-256: `aeac4d0cbae86da9cc0faabbef4ab77101b51ebec34ea3114f1773ebf6080881`.
This is a synthetic boundary fixture, not proof of word or identity quality.

The implemented scene adapter now selects PCM from its first request. It
requires the exact media type, successful EOF, nonempty whole 16-bit samples,
the existing 20 MiB/60-second limits, and complete validated encoded MP3. No
encoding occurs after a transport failure/cancellation; no failed MP3 request
is retried as PCM. Renderer `pcm_s16le_44100_lame_128_v1` changes scene reuse
identity independently from compiler/source-map semantics.

The fresh real-adapter application test passed one native two-speaker scene,
owned MP3 access and reuse without another request/charge, followed by three
fake-provider requests for fragment preservation, failure/refund and explicit
recovery. Native MP3 SHA-256:
`9099c2b9bdfbe02804c5245a5dfe073bbe83b2f1c491821fbda5c945b6992c98`.
Its auth/moderation/voice acceptance fixtures are explicitly synthetic; the
temporary database was removed. See [codec evidence](evidence/2026-10-15-scene-codec.json).

Native spend/capacity uses the shared configured development account ledger.
Application fixtures use disposable MySQL content with synthetic auth,
moderation and acceptance; that content is removed afterward. Supplier attempt
and spend entries remain in the shared ledger. Estimates are not actual debits.

## Verification and remaining gate

- Full backend after the PCM renderer and catalogue negotiation fix: **14,062 passed**, 754 skipped, eleven live cases deselected. Focused codec/scene/HTTP/route checks: 64 passed.
- Historical scene handoff frontend after updating the two session-slot wiring assertions:
  **4,186 passed across 399 files**. Focused scene/session/API checks: 47 passed.
- Isolated MySQL/native application flow passed. Fake-provider follow-up passed
  retry ordering, full failure refund, owner isolation, preserved fragment
  assets/metadata and archived playback.
- Production build, story typecheck and new-component lint passed.
- Browser fixture verified keyboard actions, cost, separate recording controls
  and mixed-cast explanation. Its silent WAV is UI evidence, not acoustic/device
  acceptance. Screenshot: `/home/andres/PycharmProjects/magic-worlds-api/.dev/fish-scene-validation/scene-preview.png`.

Native evidence is private under `.dev/fish-scene-contract/2026-10-15/` and
`.dev/fish-scene-validation/2026-10-15-native-01/` in the backend. See
[machine-readable evidence](evidence/2026-10-15-scene.json) and the
[API contract](/home/andres/PycharmProjects/magic-worlds-api/docs/api_usage/voice_scene.md).

Before enabling R3, review identity/order, words and supported-device playback
using the new renderer. The new bounded requests prove transport/encoding;
HTTP EOF and complete sample frames alone do not establish complete dialogue.
Hosted absolute limits and actual debit reconciliation remain open. Native
calls (M6) are independent of scene enablement and remain required by the plan.
