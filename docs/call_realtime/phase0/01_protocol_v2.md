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

The client sends a frame type that is newer than v1 only if `voice_ready.protocol` advertises it. That makes every rollout **server-first**: deploy the BFF, then the SPA. An older BFF never advertises `protocol`, so a newer SPA stays silent. An older SPA ignores `protocol`, because the client already drops unknown server fields and unknown server frame types (`SERVER_FRAME_TYPES` in `voiceSocket.ts`).

### 2.2 Server tolerance (after the handshake)

| Input | v1 behaviour | v2 behaviour | Counted as |
|---|---|---|---|
| Binary frame | Generic exception → `internal`, fatal | Ignored until R47 (streamed uplink) | `binary` |
| Text that is not JSON, or JSON that is not an object | Generic exception → `internal`, fatal | Ignored | `invalid_json` |
| Unknown `type` | Fatal `conflict`, 4408 | Ignored | `unknown_type` |
| Known `type` with extra fields | Fatal `conflict`, 4408 | Extra fields dropped; the frame is processed | `extra_fields` |
| Known `type` with an invalid value | Fatal `conflict`, 4408 | Ignored | `invalid_frame` |
| `voice_turn_client_metrics` for a turn the call does not know (or a second one for a turn) | n/a | Ignored | `unknown_turn`, `duplicate_metrics` |

- **Handshake frames stay strict.** The first `voice_start` or `voice_resume` defines the call, so an invalid one remains a fatal `conflict`, though extra fields are still dropped. Before the handshake, unknown types, non-JSON and binary frames are ignored and counted, the same as after it.
- **Counters are per call.** They are kept on the call runtime, written to `voice_call_metrics.ignored_frames`, and logged once per kind per call as `voice_frame_ignored`. Nothing is sent to the client.
- **Abuse bound.** A call that sends more than 1,000 ignored frames is ended as a protocol `conflict`. That is the only remaining fatal path for malformed traffic.

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

A turn that never settles, because the socket dropped or the call ended mid-turn, is sent at call end when the socket is still open, and dropped otherwise. The server row then keeps empty `client_*` columns. That is the coverage gap the G0 gate measures.

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
| `barge_in_onset_to_pause_ms` | 0..60,000 | VAD `speech_start` → playback cancelled, for an automatic barge-in |
| `playback_path` | `media_source` \| `managed_media_source` \| `blob` \| `none` | How the turn played |
| `aec` | `on` \| `off` \| `unknown` | The capture track's `echoCancellation` setting (`off` covers the raw fallback) |
| `autoplay_blocked` | bool | Playback reported `blocked` during the turn |

**t0** is `CapturedVoiceSegment.speech_end_perf_ms` of the segment that opened the turn: the last voiced audio, before the hang-over. A segment cut at the maximum length has no t0, so every `speech_end_to_*` field and `v2v_ms` is absent for it.

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
- a `voice_end{reason:"navigation"}` reason;
- splitting the mid-call 4408 close codes;
- storing a pre-ready close as `abandoned`;
- re-checking access on resume.

The tolerant parser already removes the main source of mid-call 4408s: protocol mismatches.
