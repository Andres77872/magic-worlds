# Phase 0 · Call socket protocol v2

**Date:** 2026-10-20. **Roadmap items:** R02 (tolerant protocol) and the transport half of R01 (the client turn timeline). **Applies to:** the voice WebSocket `/character-chats/{id}/ws-voice` between this SPA (`src/infrastructure/api/voiceSocket.ts`) and `magic-worlds-api` (`src/routes/user/route_voice_call.py`). The segment upload (`POST …/voice-segments`) does not change.

## 1. Why

- **Version skew kills calls today.** Every client model is `extra="forbid"`, and `_parse_voice_frame` raises a *fatal* `conflict` for:
  - an unknown `type`;
  - any extra field;
  - any invalid value.

  The route then closes the call with 4408. A text frame that is not JSON, and any binary frame, ends up in the generic handler as `internal`, also fatal. A client one release ahead of the server therefore loses the call on its first new frame (C29 in [03](../03_audit_findings.md)).
- **Mouth-to-ear latency is not measured.** The client already knows when the reply became audible (`callPlaybackTiming.ts`), but nothing reads that value and no frame carries it (C13).

## 2. Rules

### 2.1 Versions

| Side | Field | Meaning |
|---|---|---|
| Client → server | `voice_start.protocol_version` (int ≥ 1, optional) | The highest protocol the client speaks. Absent = 1. Stored on the call (`voice_call_metrics.protocol_version`). |
| Server → client | `voice_ready.protocol` (object, optional on read) | `{ "version": 2, "client_metrics": 1 }`. `client_metrics` is the `voice_turn_client_metrics` version the server accepts. |

The client sends a frame type or a reason that is newer than v1 only if `voice_ready.protocol` advertises it. An older SPA ignores `protocol`, because the client already drops unknown server fields and unknown server frame types (`SERVER_FRAME_TYPES` in `voiceSocket.ts`).

**Every rollout is server-first, with no exception: deploy the BFF, then the SPA.** The new fields ride in `voice_start` itself (`protocol_version`, and `llm` from the LLM-profile work). A v1 BFF parses `voice_start` with `extra="forbid"`, and an invalid handshake is fatal, so a new SPA loses every call to a v1 BFF with 4408 before `voice_ready`. The client cannot learn the server's version any earlier than `voice_ready`, so it cannot fall back on its own.

- **`voice_end.reason: "navigation"`** is a v2 reason. The client sends it when the caller leaves the call screen in the app, and only to a server that advertised `protocol`. A v1 server gets `user`.

### 2.2 Server tolerance (after the handshake)

| Input | v1 behaviour | v2 behaviour | Counted as |
|---|---|---|---|
| Binary frame | Generic exception → `internal`, fatal | Ignored until R47 (streamed uplink) | `binary` |
| Text that is not JSON, or JSON that is not an object | Generic exception → `internal`, fatal | Ignored | `invalid_json` |
| Unknown `type` | Fatal `conflict`, 4408 | Ignored | `unknown_type` |
| Known `type` with extra fields | Fatal `conflict`, 4408 | Extra fields dropped; the frame is processed | `extra_fields` (not toward the abuse bound) |
| Known `type` with an invalid value | Fatal `conflict`, 4408 | Ignored | `invalid_frame` |
| `voice_turn_client_metrics` for a turn the call does not know (or a second one for a turn) | n/a | Ignored | `unknown_turn`, `duplicate_metrics` |

- **Handshake frames stay strict.** The first `voice_start` or `voice_resume` defines the call, so an invalid one remains a fatal `conflict`, though extra fields are still dropped. Before the handshake, unknown types, non-JSON and binary frames are ignored and counted, the same as after it.
- **Counters are per call.** They are kept on the call runtime, written to `voice_call_metrics.ignored_frames`, and logged once per kind per call as `voice_frame_ignored`. Nothing is sent to the client.
- **Abuse bound.** A call that sends more than 1,000 ignored frames is ended as a protocol `conflict`. That is the only remaining fatal path for malformed traffic. `extra_fields` is counted but never trips the bound: those frames were processed, and a newer client sends them all call long (a `voice_playback` with one new field arrives about twice a second).

### 2.3 Client tolerance

- **Unknown server frames:** already ignored (unchanged).
- **`voice_ready.protocol`:** read defensively. Any shape other than an object with integer fields means "v1 server", and the client sends no metrics frame.
- **Sending:** a metrics frame is best-effort. When the socket is closed it is dropped, never queued across a resume.

## 3. `voice_turn_client_metrics` (client → server, v1)

### 3.1 When it is sent

The client sends at most one frame per server turn, once the turn has settled from the caller's point of view:

| Settles when | `outcome` |
|---|---|
| `voice_turn_end` arrived and the turn's playback went idle after playing | `played` |
| The caller barged in during the turn's audio (auto or the Interrupt button) | `interrupted` |
| `voice_cancelled` named the turn (superseded, end of call, provider) | `cancelled` |
| `voice_turn_end` arrived and no chunk of the turn ever played: text-only, TTS unavailable, or a failed turn | `no_audio` |
| Autoplay was blocked when the turn's audio arrived | `blocked` |
| The turn's chunks could not be decoded (`isPlayableCallChunk` false) | `unsupported` |

A turn that never settles, because the socket dropped or the call ended mid-turn, is sent at call end when the socket is still open, and dropped otherwise:
- **The caller ends the call:** open turns are sent before `voice_end`.
- **The caller leaves the call screen in the app:** open turns are sent, then `voice_end{reason:"navigation"}`, before the socket closes.
- **The server ends the call:** open turns are sent when `voice_ended` arrives. The server takes them for 10 s after the end, from the same socket ([02](02_turn_metrics.md) §7).

A dropped frame leaves the server row with empty `client_*` columns. That is the coverage gap the G0 gate measures.

### 3.2 Fields

All times are whole milliseconds on the client's `performance.now()` clock and are intervals, never absolute times. Each is optional. A missing value means "did not happen", or "not measurable on this browser".

| Field | Type, range | Definition |
|---|---|---|
| `type` | `"voice_turn_client_metrics"` | |
| `v` | `1` | Frame version |
| `turn_id` | server turn id | From `voice_turn_start` |
| `segment_seq` | int ≥ 1 | The uploaded segment that opened the turn (`voice_turn_start.segment_seq`) |
| `outcome` | see §3.1 | |
| `speech_end_to_upload_ms` | 0..600,000 | Last voiced audio (`speech_end_perf_ms`) → upload sent. The same value as the upload's `vad.speech_end_lag_ms`; the hang-over is included |
| `upload_to_ack_ms` | 0..600,000 | Upload sent → `voice_segment_ack{status:"received"}` |
| `speech_end_to_turn_start_ms` | 0..600,000 | t0 → `voice_turn_start` received |
| `speech_end_to_first_chunk_ms` | 0..600,000 | t0 → first `voice_audio_chunk` of the turn received |
| `speech_end_to_playing_ms` | 0..600,000 | t0 → the audio element's `playing` event for the turn (the existing `mw.voice.first_audible` mark) |
| `turn_start_to_first_chunk_ms` | 0..600,000 | `voice_turn_start` → first chunk |
| `first_chunk_to_playing_ms` | 0..600,000 | First chunk → `playing`: MSE append, decode and element start-up |
| `output_latency_ms` | 0..2,000 | The capture `AudioContext.outputLatency` (or `baseLatency`) when the browser exposes it |
| `v2v_ms` | 0..600,000 | `speech_end_to_playing_ms + output_latency_ms`: **the voice-to-voice number** (R01). Leading silence in the first MP3 frames is not counted (unknown until R73) |
| `played_ms` | 0..2³¹−1 | The turn's played audio when it settled (`VoicePlaybackBuffer.playedMs`) |
| `chunks` | 0..100,000 | Audio chunks of the turn received |
| `stalls` | 0..10,000 | `waiting` and `stalled` events on the element after the turn started playing |
| `stall_ms` | 0..600,000 | Time spent stalled: `waiting` → next `playing` |
| `barge_in_onset_to_pause_ms` | 0..60,000 | Speech onset → playback cancelled, for an automatic barge-in. The onset is the segment's first voiced frame: `speech_start` fires only after `minSpeechMs` (500 ms during playback), and carries `onset_lag_ms` to date it back. When the caller began talking before the turn became audible, the interval starts at `playing` instead |
| `playback_path` | `media_source` \| `managed_media_source` \| `blob` \| `none` | How the turn played |
| `aec` | `on` \| `off` \| `unknown` | The capture track's `echoCancellation` setting (`off` covers the raw fallback) |
| `autoplay_blocked` | bool | Playback reported `blocked` during the turn |

**t0** is `CapturedVoiceSegment.speech_end_perf_ms` of the segment that opened the turn: the last voiced audio, before the hang-over. A segment cut at the maximum length has no t0, so every `speech_end_to_*` field and `v2v_ms` is absent for it.

**A turn that was blocked before it first played** (autoplay, then the caller's tap) has no `speech_end_to_playing_ms`, `first_chunk_to_playing_ms` or `v2v_ms`: its `playing` waited for a human. Its other intervals are sent, and `autoplay_blocked` is true. A turn blocked after it had played keeps its start-up times.

### 3.3 Server handling

- The frame is validated by `VoiceTurnClientMetricsFrame` (extra fields ignored, every bound enforced) and handed to `VoiceCallEngine.record_client_turn_metrics`.
- The engine attaches it to the turn's in-memory record by `turn_id`. If the server row was already written, it updates the row's `client_*` columns.
- The frame never changes the call's behaviour. It is telemetry only, and is never answered.
- **Rate bound:** one accepted frame per turn, and at most 8 per second per call. Anything else is counted and dropped.

## 4. Example

```json
{"type":"voice_turn_client_metrics","v":1,"turn_id":"6c1d…","segment_seq":4,
 "outcome":"interrupted","speech_end_to_upload_ms":612,"upload_to_ack_ms":148,
 "speech_end_to_turn_start_ms":1931,"speech_end_to_first_chunk_ms":2874,
 "speech_end_to_playing_ms":3042,"turn_start_to_first_chunk_ms":943,
 "first_chunk_to_playing_ms":168,"output_latency_ms":21,"v2v_ms":3063,
 "played_ms":4180,"chunks":19,"stalls":0,"stall_ms":0,
 "barge_in_onset_to_pause_ms":530,"playback_path":"media_source","aec":"on",
 "autoplay_blocked":false}
```

## 5. Not in v2 (later R02 items)

The following stay as they are and are tracked in [README](README.md) §4:
- splitting the mid-call 4408 close codes;
- storing a pre-ready close as `abandoned`;
- re-checking access on resume.

The tolerant parser already removes the main source of mid-call 4408s: protocol mismatches.
