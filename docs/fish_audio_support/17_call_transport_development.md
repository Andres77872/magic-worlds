# Native call transport foundation

October 15, 2026. This records the transport/source-matching foundation checkpoint.
The subsequent [engine handoff](18_call_engine_development.md) now connects these
components to calls, shared admission and the browser UI. **R4 remains unaccepted.**
`FISH_AUDIO_CALLS_ENABLED=false` remains the default and explicit development
setting; Gabriel remains narration-only.

## Completed foundation

The [timestamp transport](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/providers/fish_audio/timestamp_ws.py)
uses one native socket per generation with the exact `model: drama-3` header.
MessagePack is an explicit dependency. A concurrent sender accepts complete
approved units, sends text/flush, then stop. The receiver drains through finish.
Packet/audio/text/chunk/timeline bounds are explicit. Timeout or cancellation
closes the owned socket; it does not drain as an interruption strategy,
reconnect or replay. Empty/disabled input opens no socket. Caller-side moderation,
account admission, source registration and delivery epoch checks remain required
at the integration boundary and are now wired by the M6 bridge/engine.

The decoder separates audio sequence from provider chunk sequence. Every nonempty
audio payload is retained in arrival order. Metadata-only snapshots are accepted;
each non-null chunk snapshot replaces its prior version, while null preserves
the store. Relative milliseconds and chunk offsets are separate. Native error
bodies and content/bytes never appear in object representations or public errors.

The provider-neutral [word timeline](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/word_timing.py)
matches the expected spoken sequence monotonically through compiler source maps.
It handles repeated words, Unicode code points/graphemes, number expansion,
spoken pronunciation substitutions, paired controls and optional event labels.
Expanded numbers are atomic: hearing “twenty” alone does not commit “24”.
Direction/event text adds no dialogue characters. Unknown words and CMU output
without verified orthographic matching report `unmatched`, rather than guessing.

Snapshots are revisable. Prefix queries use the latest evidence and can retract
a prior provisional prefix after a correction; no live prefix is irreversibly
committed by this component. The newest trailing word remains provisional until
finish. Queries cap progress at accepted/delivered audio, and metadata updates
append/bill no audio. Stale epochs/revisions and cancelled-generation updates
are ignored. The Fish call ledger now selects this strategy; the ElevenLabs
character-ledger strategy remains in place.

## Native evidence

One new synthetic Spanish generation used the development account's shared
admission/spend ledger. The complete MP3 passed the same mono 44.1 kHz, 128 kbps
validation as HTTP. It contained 111,176 bytes / 6,949 ms. First audio arrived at
1,686 ms; total receipt/cleanup took 2,516 ms. This is one provider-side sample,
not browser end-to-end latency or p50/p95 evidence. Socket close count was one.
Audio SHA-256: `a3664028fcc94e72e83bd6074b1d137d93967aa3b5bf956f9f0c140affbf8cb8`.

The native capture had ten nonempty audio events and a normal stop/finish,
with two chunk identities and five alignment revisions each. Chunk 1's offset
was 2,786.3946 ms. A correction changed the first word's start from 80 ms to zero,
confirming the need for revisions. An offline pass projected all 71 original
Spanish code points, including “24” pronounced “veinticuatro”.

Private packets/audio/reports are under the backend's
`.dev/fish-call-contract/2026-10-15/`. The checked-in
`tests/fixtures/fish_timestamp_words_v1.json` retains original synthetic text and
timestamp metadata only: audio, credentials and reference IDs are absent.
Its regression test replays the metadata through the zero-byte path.

Foundation-checkpoint regression: **13,992 passed**, 754 skipped and ten live-provider
cases deselected. This includes 16 timestamp transport cases and ten word/source
timeline cases. The current frontend suite passed 4,186 tests across 399 files;
production build, story typecheck, scoped lint and both diff checks pass. The
development API is ready, the schema verifies, and Gabriel is the only active
public Fish voice. See [machine-readable evidence](evidence/2026-10-15-call-foundation.json).

The native probe made no catalogue entries/models and did not enable public
calls. Supplier estimates remain recorded; no actual debit reconciliation or
acoustic approval is claimed. Primary contract:
[native timestamp WebSocket](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech-live-with-timestamps).
Its current model enum includes `drama-3`; an older cached guide's preview alias
is not used. The documented socket-reuse contradiction is avoided by closing
each generation.

## Remaining M6/R4 work

Bridge, shared admission, ledger, provider eligibility, expanded consent and
browser timing are now implemented and tested in the subsequent handoff.
The configured database expansion and two native engine completion/cancellation
probes now pass. Full authenticated application flow, actual debit/occupancy,
independently verified conversation/tool and
moderation execution, slow-playback/disconnect/device acceptance and agreed
p50/p95/silence targets remain open. A short native transport probe does not
satisfy those gates. See [current implementation and evidence](18_call_engine_development.md).

M5 scene enablement remains independent and blocked on the observed long-response
MP3 tail issue. M7 voice creation and Gabriel's approved development narration
remain enabled independently. The overall integration goal is still active.
