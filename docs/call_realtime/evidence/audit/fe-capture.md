# Audit evidence: frontend microphone capture, client VAD and utterance segmentation

Subsystem: **FE-CAPTURE** (browser mic → AudioWorklet VAD → utterance segment → upload).
Audit date: 2026-10-20. Code is read-only; nothing was modified.
Convention: **FACT** = seen in code at the cited line; **INFERENCE** = reasoned from code/known platform behaviour; **UNKNOWN** = needs measurement or a device test. A small offline simulation of the real worklet source was run (see §9) and its output is quoted as **SIM**.

Primary files:

| File | Role |
|---|---|
| `src/features/interaction/hooks/useMicrophoneCapture.ts` (621 lines) | getUserMedia, AudioContext, worklet wiring, mute, liveness watchdog, raw fallback, device-loss restart |
| `src/features/interaction/audio/voiceVadProcessor.worklet.js` (427 lines) | The AudioWorklet processor: resampler, energy VAD, pre-roll, segmentation, level meter |
| `src/features/interaction/audio/voiceVadWorklet.ts` (349 lines) | Main-thread half: message types, WAV PCM16 builder, SHA-256, `VoiceVadWorkletSegmenter` (seq + speech-end stamping) |
| `src/features/interaction/audio/speechEndLag.ts` (44 lines) | `vad.speech_end_lag_ms` telemetry attached to each upload |
| `src/features/interaction/hooks/useVoiceCallController.ts` (1318 lines) | Capture/VAD consumer: segment queue & upload, auto barge-in, min-speech switching, segment limit |
| `src/features/call/components/CallScreen.tsx` | Production tuning (`vad: { silenceMsToEnd: 550, minSpeechMs: 250 }`) |
| `src/infrastructure/api/index.ts:5418-5446` | `uploadVoiceSegment` (multipart HTTP POST) |
| Backend cross-checks | `magic-worlds-api/src/routes/user/route_voice_call.py:1130-1214`, `src/services/voice_orchestration/server_vad.py`, `config.py:42-43`, `engine.py:83, 2000-2110, 1414-1424` |

---

## 1. TL;DR

* The uplink is **not streamed**. The browser runs an **energy (RMS) VAD inside an AudioWorklet**, waits for **550 ms of silence**, then builds a **whole-utterance 16 kHz mono PCM16 WAV**, SHA-256 hashes it, and sends it as a **multipart HTTP POST** (`/character-chats/{id}/voice-segments`). The voice WebSocket carries **no audio** from the client (FACT: `VoiceSocketClientFrame` types are `voice_start | voice_resume | voice_barge_in | voice_playback | voice_end | voice_ping`, `src/shared/types/voice.types.ts:114-138`). *(The audit brief's "mic → WebSocket → backend" is therefore inaccurate for the uplink.)*
* Client-attributable critical path from the user's last voiced audio to the segment being at the BFF: **≈ 550 ms constant hang-over + ~5-10 ms processing + 60-700 ms upload transfer** (uncompressed PCM, 32 KB per second of audio) + per-request BFF auth/admission. STT cannot start before all of this completes.
* Barge-in is detected by the same energy VAD (≥ 500 ms cumulative voiced energy while the character is audible), cancels playback **locally and immediately**, and sends `voice_barge_in{turn_id, played_ms}` — a good design, but with **no false-interruption recovery** and **no speech/non-speech discrimination**.
* Biggest risks: (1) with echo cancellation off (raw fallback) or during the 3 s AEC warm-up, the **character's own voice is uploaded as a user segment and supersedes its own reply** (the barge-in guard only gates the barge-in frame, not the upload); (2) **non-stationary noise (TV, babble, typing) opens turns, fires barge-in, and holds segments open up to the 29.5 s max cut** (SIM-confirmed); (3) fixed-silence end-of-turn with no semantic model.
* Many things are done well: audio-thread processing, exact fractional resampler, pre-roll, trailing-silence trim, adaptive noise floor with hysteresis, raised interruption threshold while speaking, AEC warm-up, truncate-to-heard barge-in, idempotent uploads, generation counters against stale async work, mic opened inside the click, pre-ready segment queue.
* The project's own roadmap already lists most of the structural gaps as backlog (V-07 streaming STT/audio transport + semantic end-of-turn; neural VAD such as Silero; pause-then-confirm barge-in) — `docs/voice_refactor/00_current_status_and_roadmap.md:83, :95`.

---

## 2. Architecture walkthrough (as built)

```
 click "Start call" (CallScreen.acceptConsent)
   └─ useVoiceCallController.startCall()                       useVoiceCallController.ts:995
        ├─ playback.unlock()  (inside the gesture, iOS)           :997
        ├─ capture.start()  ── getUserMedia BEFORE any network    :1018-1024
        │     └─ useMicrophoneCapture.startWithConstraints(PROCESSED) useMicrophoneCapture.ts:464
        │          ├─ navigator.audioSession.type = 'play-and-record' (Safari)  :471-481
        │          ├─ getUserMedia({audio:{echoCancellation,noiseSuppression,autoGainControl:true}}) :485
        │          ├─ new AudioContext({sampleRate:16000})  (fallback: device rate)  :331-346, :109-150
        │          ├─ context.resume(); audioWorklet.addModule(worklet.js)          :134-142
        │          ├─ MediaStreamSource → AudioWorkletNode('voice-vad-processor') → Gain(0) → destination :358-363
        │          ├─ port.onmessage: level | vad(speech_start/speech_end) | segment  :377-398
        │          └─ arm 3 s liveness watchdog (raw-constraints fallback)          :408-439, :524-525
        ├─ ensureSession(); POST voice-consent  → limits → configure({maxSegmentMs: 30000-500})  :1040-1058, :544-548
        ├─ socket.start(voice_start{audio:{wav pcm_s16le 16k mono, vad balanced}}) :1077-1078, :1255-1273
        └─ 15 s voice_ready timeout                                               :1081-1088

 AudioWorklet (audio render thread, per 128-frame quantum)    voiceVadProcessor.worklet.js:256-286
   RMS of the source quantum → level EMA (posted every ~50 ms)
   resample to 16 kHz (pass-through when ctx is 16 kHz) → Int16
   gate = max(speechThreshold, 3 × noiseFloor); voiced = rms ≥ gate (or ≥ 0.8·gate while in speech)
   idle: keep 300 ms pre-roll ring;  speech: append to segment buffer
   announce `speech_start` once ≥ minSpeechMs of (cumulative) voiced audio
   close on silenceMsToEnd consecutive unvoiced quanta  → post `segment` (+200 ms tail) then `speech_end`
   or on maxSegmentMs → post `segment` then `speech_end{ended_by_silence:false}`

 Main thread
   segment → VoiceVadWorkletSegmenter.handleMessage → WAV(44-byte header + PCM16) + SHA-256 (crypto.subtle)
           → onSegment → controller.handleCapturedSegment → uploadSegment                 :920-935, :564-630
   speech_end → segmenter.noteSpeechEnd (stamps speech_end_perf_ms = arrival − silence_tail_ms)
   speech_start → controller.handleVadState → userSpeaking = true → maybeAutoBargeIn()    :907-918, :676-687

 uploadSegment (HTTP)                                         index.ts:5418-5446
   multipart: voice_session_id, client_call_id, seq, started_at_ms, duration_ms, encoding, sample_rate,
              channels, audio_sha256, vad_json{speech_ms,silence_ms,rms,peak,source,aggressiveness,speech_end_lag_ms}, audio
   header Idempotency-Key: voice:{voice_session_id}:{seq}:{sha256}
   one resend on network TypeError after 300 ms; the POST resolves only when the server turn finishes
```

### 2.1 getUserMedia constraints (FACT)

| Mode | Constraints | Where |
|---|---|---|
| Default ("processed") | `{ echoCancellation: true, noiseSuppression: true, autoGainControl: true }` | `useMicrophoneCapture.ts:80`, used at `:568` |
| Raw fallback | `{ echoCancellation: false, noiseSuppression: false, autoGainControl: false }` | `:83`, triggered by the liveness watchdog `:430-434` |

* No `channelCount`, `sampleRate`, `deviceId`, `latency` or `voiceIsolation` constraints (FACT, `:80-83`). The worklet only reads input channel 0 (`voiceVadProcessor.worklet.js:257`).
* `video: false` (`:485`). Errors: `NotAllowedError`/`SecurityError` → `permission_denied`, anything else → `capture_failed` (`:486-491`).
* The track's reported `echoCancellation` setting is read once after start (`:90-93`, `:523`) and drives `echoCancellationOff` (controller `:978`) → auto barge-in disabled + "use headphones" hint (`CallScreen.tsx:529-534`, copy `src/app/i18n/locales/en.ts:6150`).
* Safari: `navigator.audioSession.type = 'play-and-record'` while capturing, previous type restored on stop (`:471-481`, `:282-290`).

### 2.2 AudioContext and resampling (FACT)

* First tries `new AudioContext({ sampleRate: 16000 })` so the browser does the resampling and the worklet is a pass-through (`:329-331`). If `createMediaStreamSource` throws (Firefox ≤ 147 / ESR 140 cannot connect a gUM stream to a non-default-rate context, per the comment), the context is rebuilt at the device rate and the worklet resamples (`:333-346`).
* The context is created **after** `await getUserMedia` (outside the user-gesture window), so the code resumes it and fails if it does not reach `running` (`:130-140`). A failure surfaces as `unsupported` / "This browser does not support the required voice capture path." (`:528-537`).
* `latencyHint` not set → browser default `'interactive'` (INFERENCE from absence at `:119-125`).
* Worklet loaded per capture start via `addModule(new URL('../audio/voiceVadProcessor.worklet.js', import.meta.url))` (`:142`); plain JS by design (header comment of the worklet, `:1-8`).
* Graph: `source → worklet → GainNode(gain 0) → destination` (`:358-363`) — the zero-gain sink only keeps the worklet pulled.
* In-worklet resampler (`voiceVadProcessor.worklet.js:110-177`): streaming fractional resampler, 33-tap Hamming-windowed sinc low-pass at the input rate, cutoff 0.9 × 8 kHz (`:50-53`, `:122`), linear interpolation between two filtered neighbours; carries `taps` samples of history so N s in → N × 16 000 samples out (tested at 44.1/48 kHz, `voiceVadProcessor.worklet.test.ts:124-158`).

### 2.3 Frame sizes (FACT + arithmetic)

| Context rate | Render quantum | Quantum duration | Level message every | Silence quanta for 550 ms |
|---|---|---|---|---|
| 16 000 Hz (normal Chrome/Safari path) | 128 | 8.0 ms | round(50/8)=6 quanta → 48 ms (~21 Hz) | round(550/8)=69 → 552 ms |
| 48 000 Hz (Firefox fallback) | 128 | 2.67 ms | round(50/2.67)=19 → 50.7 ms | round(550/2.67)=206 → 549 ms |

`RENDER_QUANTUM = 128` (`worklet.js:41`), `frameMs` (`:186`), `levelFrameInterval` (`:191-192`), `silenceFramesToEnd` (`:241-243`).
The VAD decision is made **per quantum** on the RMS of 2.7-8 ms of audio, with no smoothing window (`:260-277`).

### 2.4 VAD algorithm (FACT)

Energy gate with an adaptive noise floor (`voiceVadProcessor.worklet.js:256-305`):

```js
const gate = Math.max(this.speechThreshold, this.noiseFloor * NOISE_FLOOR_MULTIPLIER)            // :276
const voiced = !calibrating && rms >= (this.speaking ? gate * STAY_IN_SPEECH_RATIO : gate)       // :277
```

* `speechThreshold` 0.01 RMS (≈ −40 dBFS) default (`:224`); `NOISE_FLOOR_MULTIPLIER` 3, `STAY_IN_SPEECH_RATIO` 0.8 (hysteresis) (`:57-58`); floor capped at `NOISE_FLOOR_MAX` 0.05 → max gate 0.15 (`:60`).
* Noise-floor EMA time constants: rise 1 s while idle, creep 4 s while in speech, fall 200 ms whenever rms < floor, calibration τ 100 ms for the first `CALIBRATION_MS` 400 ms during which nothing can be voiced (`:65-71`, `:298-305`).
* Onset: first voiced quantum starts a segment and prepends up to 300 ms pre-roll (`:307-325`).
* `speech_start` is posted only after `speechSamples ≥ minSpeechSamples` — **cumulative** voiced samples inside the open segment, not contiguous (`:334-342`).
* End: `silenceFrames` counts **consecutive** unvoiced quanta; any single voiced quantum resets it (`:352-353`).
* Max length: `maxSegmentMs` (pre-roll included) cuts mid-speech; the remainder of that quantum seeds the next pre-roll; no audio duplicated or lost (`:344-349`, `:391-392`; test `voiceVadProcessor.worklet.test.ts:236`).
* Flush (`:372-416`): segments that never announced are discarded silently (no `segment`, no `speech_end`); a pause-ended segment keeps only `TRAILING_SILENCE_KEEP_MS` = 200 ms of the pause (`:48`, `:378-379`), but the full pause re-seeds the pre-roll.
* No neural VAD, no spectral/zero-crossing/pitch features, no speech-probability model (FACT: the only features are per-quantum RMS and its EMA).

### 2.5 State machine (worklet)

```
            calibrating (first 400 ms: floor learning only, never voiced)
                    │
                    ▼
   ┌────────── IDLE (pre-roll ring 300 ms) ◄──────────────────────────────┐
   │   voiced quantum                                                     │
   ▼                                                                      │
 IN_SEGMENT (not announced) ── silence ≥ silenceMsToEnd ──► discard ──────┤ (blip < minSpeechMs)
   │ cumulative voiced ≥ minSpeechMs                                      │
   ▼  post vad:speech_start                                               │
 IN_SEGMENT (announced) ── silence ≥ silenceMsToEnd ──► post segment(+200 ms tail), speech_end{true, tail} ─┤
   │                                                                      │
   └── length ≥ maxSegmentMs ──► post segment, speech_end{false, 0} ──────┘ (next voiced quantum re-opens)
```

### 2.6 Worklet ↔ main-thread messages (FACT, `worklet.js:27-37`, typed in `voiceVadWorklet.ts:42-64`)

* → worklet: `{ type:'configure', maxSegmentMs?, minSpeechMs?, silenceMsToEnd?, speechThreshold? }` (applied next quantum; lowering `maxSegmentMs` below the current length cuts immediately, `worklet.js:244-253`).
* ← worklet: `{type:'level', rms}` (smoothed 0..1, ~20 Hz); `{type:'vad', state:'speech_start', at_ms, rms}`; `{type:'segment', samples:Int16Array (transferred), sample_rate:16000, started_at_ms, speech_ms, silence_ms}`; then `{type:'vad', state:'speech_end', at_ms, rms, ended_by_silence, silence_tail_ms}`.
* `at_ms`/`started_at_ms` are a **worklet clock** (`frameIndex × 128 / rate`, `worklet.js:422-424`) that restarts at 0 on every internal capture restart and pauses if the context is suspended.

### 2.7 Segment format and upload (FACT)

* WAV RIFF, PCM format 1, mono, 16 000 Hz, 16-bit, 44-byte header; bulk copy on little-endian (`voiceVadWorklet.ts:119-157`). MIME `audio/wav;codec=pcm_s16le` (the only `VoiceAudioEncoding`, `src/shared/types/voice.types.ts:14`). **32 000 bytes per second of audio, no compression.**
* SHA-256 via `crypto.subtle.digest` over the exact uploaded bytes (`:175-181`, `:316-322`); fallback FNV-1a "hash" when `crypto.subtle` is missing (`:324-331`) — the BFF recomputes SHA-256 and rejects mismatches (`engine.py:2037-2039`), but `crypto.subtle` and `getUserMedia` are both secure-context-only, so that fallback is unreachable in practice (INFERENCE).
* Metrics `rms`/`peak` computed over the whole segment on the main thread (`:159-173`).
* `uploadVoiceSegment` builds a `FormData` (11 fields + audio blob) and POSTs with `Idempotency-Key` (`index.ts:5418-5446`); the generic `request()` adds `Authorization`, `Accept`, `X-MW-Voice-Contract: 5`, workspace headers; no timeout for this call (`index.ts:1048-1110`).
* Server limits: `max_segment_duration_ms` default **30 000** (`magic-worlds-api/src/services/voice_orchestration/config.py:42`), `max_segment_bytes` 2 000 000 (`:43`), min duration 250 ms, 16 kHz/mono/16-bit required, energy gate **disabled by default** (only digital-silence peak < 0.002 rejected) (`server_vad.py:17-37`, `:236-246`). Server allows **3 in-flight segments per call** (`engine.py:83`, `:2041-2042` → HTTP 429 `busy`, `errors.py:185-189`).
* The BFF route authenticates, resolves the workspace, loads the chat and builds the admission context **before** reading the multipart body (`route_voice_call.py:1130-1158`), and `accept_segment` only returns after the whole voice turn (`_run_voice_turn`) completes (`engine.py:2090-2103`). The client relies on this (`useVoiceCallController.ts:622-628`).

### 2.8 Controller integration (FACT)

* **Pre-ready queue:** segments captured before `voice_ready` (or while there is no session id) are queued (`:564-571`) and flushed in seq order with 120 ms spacing on `voice_ready`/`voice_state_snapshot` (`:632-642`, `:152`, `:743`, `:759`).
* **Segment limit:** 7 500 ms until the server advertises one, then `max_segment_duration_ms − 500` (`:128-131`, `:544-548`); with the default server config this becomes **29 500 ms** (test `useVoiceCallController.test.ts:308-318`).
* **Interruption threshold switching:** when playback becomes `playing`, `minSpeechMs` → max(500, configured) (`:137`, `:704-706`); back to 250 on `idle` (`:709-710`).
* **Auto barge-in** (`:676-687`): only when live, `autoBargeIn !== false`, AEC not off and not raw fallback, playback audibly `playing` (a mid-reply stall counts), and > 3 s since the call's **first** audible reply (`AEC_WARMUP_MS` `:143`, `firstPlaybackAtRef ??=` `:705`). Also fired when audio becomes audible while the user is already mid-utterance (`:708`).
* **sendBargeIn** (`:644-673`): reads `played_ms` before cancelling, cancels local playback immediately, sends `voice_barge_in{reason, turn_id, played_ms}`, shows `barge_in` state ≤ 2 s.
* **No VAD frames to the server:** "we intentionally do NOT send a `voice_vad` frame" (`:907-910`). The server has no `voice_vad` handler (grep, backend) — it learns about the user's speech only when the segment POST arrives.
* **Upload errors:** network `TypeError` → one resend after 300 ms with the same body (`:597-609`); any other error (incl. 429) → non-fatal notice, utterance dropped (`:615-618`). `no_speech`/`too_short` rejections are silent (`:179`, `:550-562`).
* **Mic errors mid-call:** `no_input`/`device_lost` become **non-fatal** notices (`:981-988`) that auto-clear after 8 s (`:147-148`, `:430-436`).

---

## 3. Configuration and defaults

| Parameter | Effective value in production | Default / where defined | Overridden at |
|---|---|---|---|
| AEC / NS / AGC | true / true / true | `useMicrophoneCapture.ts:80` | raw fallback `:83` |
| AudioContext rate | 16 000 requested; device rate on failure | `:331`, `VOICE_VAD_SAMPLE_RATE` `voiceVadWorklet.ts:16` | `:343` |
| Render quantum | 128 frames (8 ms @16k) | `worklet.js:41` | — |
| `speechThreshold` | 0.01 RMS | `worklet.js:224` | none (CallScreen comment suggests it) |
| `silenceMsToEnd` (hang-over) | **550 ms** | worklet 800 (balanced) / 450 (strict) `worklet.js:225`; hook doc says ~800 `voiceVadWorklet.ts:23` | `CallScreen.tsx:114` |
| `minSpeechMs` | 250 ms; 500 ms while character audible | worklet 250 `:226`; `DEFAULT_MIN_SPEECH_MS` 250 controller `:144`; `BARGE_IN_MIN_SPEECH_MS` 500 `:137` | `CallScreen.tsx:114`, controller `:706`, `:710` |
| `maxSegmentMs` | 7 500 → **29 500** after consent/ready | worklet 7 500 `:43`; controller `:129`, margin 500 `:131` | `:544-548` from server 30 000 `config.py:42` |
| `preRollMs` | 300 ms | `worklet.js:44`, `voiceVadWorklet.ts:20` | not passed by the hook (`:351-357`) |
| Trailing silence kept | 200 ms | `worklet.js:48` | — |
| Noise floor ×, stay ratio, cap | 3, 0.8, 0.05 | `worklet.js:57-60` | — |
| Floor τ rise / creep / fall | 1 000 / 4 000 / 200 ms | `worklet.js:65-67` | — |
| Calibration | 400 ms, τ 100 ms | `worklet.js:70-71` | — |
| Level interval | 50 ms worklet; ≤15 Hz & Δ≥0.02 hook; ≤12.5 Hz & Δ≥0.02 controller | `worklet.js:45`; hook `:86-88`; controller `:159-160` | — |
| Liveness watchdog | 3 000 ms | `useMicrophoneCapture.ts:85` | — |
| AEC warm-up (no auto barge-in) | 3 000 ms after the call's first audible reply | controller `:143` | — |
| Barge-in display settle | 2 000 ms | controller `:146` | — |
| voice_ready timeout | 15 000 ms | controller `:127` | — |
| Pre-ready upload spacing | 120 ms | controller `:152` | — |
| Upload resend delay | 300 ms (once, network errors only) | controller `:154` | — |
| Notice TTL (non-fatal) | 8 000 ms | controller `:148` | — |
| Aggressiveness | always `balanced` | hook `:350`, voice_start `:1265` | never set |
| Encoding | `audio/wav;codec=pcm_s16le`, 16 kHz, mono | `voice.types.ts:14`, voice_start `:1262-1264` | — |
| Server: max segment / bytes / in-flight | 30 000 ms / 2 000 000 B / 3 | `config.py:42-43`, `engine.py:83` | env `VOICE_MAX_SEGMENT_DURATION_MS`, `VOICE_MAX_SEGMENT_BYTES` |
| Server energy gate | off (digital-silence peak < 0.002 only) | `server_vad.py:31-37` | — |
| CORS preflight cache | 600 s (Starlette default) | `magic-worlds-api/src/main.py:1464-1472`, starlette `cors.py:25` | — |

---

## 4. Latency on the critical path (user stops speaking → segment at the BFF)

| # | Stage | Estimate (ms) | Evidence / reasoning | Type |
|---|---|---|---|---|
| 1 | Mic + OS + browser capture + WebRTC APM (10 ms frames) | 10-40 | Not measured anywhere; `speechEndLag.ts:8-10` explicitly excludes "mic input latency" | UNKNOWN |
| 2 | AudioContext input buffering + render quantum | 3-20 | 8 ms quanta @16 kHz (`worklet.js:41`, `:186`); context input buffer browser-dependent | INFERENCE |
| 3 | Stay-in-speech hysteresis (soft word endings above 0.8·gate still count as voice) | 0-100 | `worklet.js:277` | INFERENCE |
| 4 | **VAD silence hang-over** | **550 (constant)** — SIM: 552 @16k, 549 @48k | `CallScreen.tsx:114`, `worklet.js:241-243`, `:352-353` | FACT + SIM |
| 5 | Worklet → main-thread `postMessage` | <1-5 (more if the main thread is busy rendering) | `worklet.js:398-415`, handler `useMicrophoneCapture.ts:377-398` | INFERENCE |
| 6 | WAV build + SHA-256 of ~80 KB | ~1-2 | `voiceVadWorklet.ts:175-181` | INFERENCE |
| 7 | Pre-ready queue (only utterances spoken before `voice_ready`) | 0 normally; 120 × index when queued | controller `:632-642` | FACT |
| 8 | FormData + fetch dispatch | ~1 | `index.ts:5418-5446` | INFERENCE |
| 9 | CORS preflight (cross-origin deployment) | 0 usually; +1 RTT on the first upload after 600 s | Starlette `max_age=600` | FACT + INFERENCE |
| 10 | New TCP/TLS connection when no idle pooled connection (previous turn's POST is still held open, HTTP/1.1) | 0 (HTTP/2) to 1-3 RTT | `engine.py:2090-2103` (POST lives for the whole turn) | UNKNOWN (deployment protocol) |
| 11 | **Upload transfer of uncompressed PCM** (2.5 s utterance = 80 KB; 8.5 s = 272 KB) | **60-700** (≈3 RTT of TCP slow start on an idle connection + 64-640 ms at 10-1 Mbps uplink) | 32 KB/s (`voiceVadWorklet.ts:126-157`) | INFERENCE |
| 12 | BFF route work before the body is read (auth, workspace, chat, admission) + multipart parse | 10-100 | `route_voice_call.py:1130-1158` | UNKNOWN |
| 13 | STT start | only after (4)…(12): no streaming STT | `engine.py:2051-2061` | FACT |

**Client-attributable subtotal:** ≈ 620-1 300 ms between last voiced audio and the BFF owning the complete segment, of which 550 ms is a constant design choice and most of the rest is the uncompressed whole-utterance upload. For comparison, streaming cascades (audio frames over a persistent socket into streaming STT + semantic end-of-turn) typically have the final transcript ~150-300 ms after end of speech.

The project's only recorded sample: "first audio 4.9 s after upload" for one local call (`docs/voice_refactor/00_current_status_and_roadmap.md:61`), against a stated 1-1.5 s end-to-end goal (same line).

### 4.1 Barge-in latency (user starts talking over the character → character stops)

| Stage | Estimate | Evidence |
|---|---|---|
| Onset → `speech_start` with `minSpeechMs` 500 | ~540 ms (SIM: onset 1 000 ms → speech_start 1 544 ms) | controller `:706`, `worklet.js:339-342` |
| `speech_start` → local `playback.cancel` | 1-5 ms | controller `:913`, `:661` |
| Audio already in the output pipeline (device latency; Bluetooth much more) | 20-250 ms | UNKNOWN |
| First reply of the call: suppressed for 3 s after first audible | up to 3 000 ms (user must wait or press Interrupt) | controller `:143`, `:685` |

---

## 5. Findings

Severity: critical / high / medium / low / info.

### FE-CAPTURE-01 — Character's own voice is uploaded as a user segment and supersedes its reply when AEC is off or warming up (HIGH, correctness)

* FACT: auto barge-in is suppressed when echo cancellation is off / raw fallback (`useVoiceCallController.ts:679-681`) and during the 3 s AEC warm-up (`:684-685`). But **segment upload is unconditional**: `handleCapturedSegment` → `uploadSegment` (`:920-935`) with no check of playback state, AEC status or warm-up.
* FACT: the BFF treats any non-empty transcript as superseding the in-flight turn (`engine.py:2068-2088`), and its docstring states the SPA sends no barge-in frame when AEC is off "so the user's speech arrives only as a superseding segment" (`engine.py:1419-1421`). There is no echo/self-transcript filter (grep for `echo|half.duplex` in `voice_orchestration` finds only that docstring).
* FACT: the raw fallback is exactly the path that runs without AEC (`useMicrophoneCapture.ts:83`, `:430-434`) and is permanent for the session (§FE-CAPTURE-08).
* SIM: a speaker-leaked "voice" at 0.03 RMS for 4 s (`minSpeechMs` 500) produced a 4 372 ms segment with `speech_start` (§9).
* Failure scenario: laptop speakers + Linux Chrome APM silent-stream bug → raw fallback → character says a sentence → mic hears it → segment uploaded → Whisper transcribes the character's words → server cancels the character's turn as `superseded` and the character answers itself. With AEC on, the same happens if residual echo during the first 3 s exceeds the gate for ≥ 500 ms (warm-up only blocks the barge-in frame, not the upload).
* Recommendation: when AEC is off/unverified, run **half-duplex**: do not open/upload segments while playback is audible (or require a much higher, playback-relative threshold), or tag segments with `captured_during_playback` + overlap ms so the server can discard self-transcripts (text similarity against the reply being spoken). Longer term: measure echo directly (cross-correlate mic with the playback signal via a `MediaElementAudioSourceNode` tap) and prefer `echoCancellation: 'all'`/system AEC where available. Keep the headphones hint.

### FE-CAPTURE-02 — Energy-only VAD: non-stationary noise opens turns, fires barge-in, and holds segments open up to 29.5 s (HIGH, robustness/UX)

* FACT: speech = per-quantum RMS above an adaptive gate (`worklet.js:276-277`); onset needs only **cumulative** voiced samples ≥ `minSpeechMs` (`:339`); end needs **consecutive** unvoiced quanta and any voiced quantum resets the counter (`:352-353`). The floor falls quickly (200 ms) on every dip (`:67`, `:301`), so fluctuating noise keeps the gate low.
* FACT: max segment is raised to 29 500 ms once the server advertises 30 000 ms (`:544-548`, test `useVoiceCallController.test.ts:308-318`; server `config.py:42`).
* SIM (§9): distant TV/babble at 0.01 RMS with nobody talking → `speech_start` after 0.59 s and the segment was still open 10 s later; babble at 0.02 RMS after a real utterance → a second `speech_start` and a segment still open 22 s later; keyboard-like clicks every 150 ms → `speech_start` after ~3.1 s and never closed.
* Impact: in rooms with TV/music/other talkers or while typing, (a) the user's real end-of-turn is not detected until the 29.5 s cut, so the character does not answer for up to ~30 s; (b) during playback, ≥ 500 ms of accumulated noise triggers a barge-in that cuts the character; (c) noise segments cost STT and can produce Whisper hallucinations that trigger real LLM turns.
* Tests use only pure tones and stationary uniform noise (`voiceVadProcessor.worklet.test.ts:50-69`, `:281-304`); no real speech, babble, music, clicks or echo fixtures.
* Recommendation: add a **neural VAD** (Silero VAD v5 ONNX via onnxruntime-web/`@ricky0123/vad-web`, or TEN VAD / WebRTC VAD in WASM) on 30-32 ms frames in the worklet or a worker, with probability thresholds + contiguous-speech onset; keep the energy gate as a cheap pre-filter and fallback (already a roadmap candidate, `00_current_status_and_roadmap.md:95`). Lower the client max segment (e.g. 12-15 s) until a neural VAD lands, and require contiguous voiced time for onset.

### FE-CAPTURE-03 — Whole-utterance, uncompressed, HTTP batch uplink puts hang-over + full upload in front of STT (HIGH, latency)

* FACT: audio is only sent after the segment closes (`worklet.js:372-415`), as a WAV (`voiceVadWorklet.ts:119-203`) in a multipart POST (`index.ts:5418-5446`); the WebSocket has no audio frames (`voice.types.ts:114-138`). Encoding union has a single member, PCM WAV (`voice.types.ts:14`).
* INFERENCE: 32 KB/s means a typical 2.5 s segment is 80 KB → 60-700 ms of upload depending on uplink and TCP slow start, plus a per-request BFF auth/admission path (`route_voice_call.py:1130-1158`), all before STT starts. Server STT is batch Whisper (backend scope) — it can only start on the complete file.
* Recommendation (in order of effort): (1) start transmitting at `speech_start` (with pre-roll) instead of at segment close — e.g. stream 20 ms binary frames over the existing voice WebSocket; (2) compress with Opus (WebCodecs `AudioEncoder`, ~16-24 kbps → ~10× fewer bytes) or at least keep PCM but stream it; (3) feed a **streaming STT** with interim results so the final transcript is ready ~150-300 ms after end of speech; (4) keep the HTTP segment path as a fallback for clients without WebCodecs/WS. Roadmap item V-07 already names this (`00_current_status_and_roadmap.md:83`).

### FE-CAPTURE-04 — Fixed 550 ms silence end-of-turn, no semantic turn detection (MEDIUM, latency/UX)

* FACT: end-of-turn is purely `silenceMsToEnd` = 550 ms (`CallScreen.tsx:114`); comment acknowledges breaths are cut and rely on the server merging superseded turns (`CallScreen.tsx:109-113`; merge at `engine.py:2075-2087`).
* SIM: a 600 ms mid-sentence pause produced two segments (§9).
* Impact: complete short answers ("yes", "go on") still wait 550 ms; thinking pauses > 550 ms trigger a premature STT + LLM (+ maybe TTS) that is then cancelled and merged — wasted provider spend and occasional "character starts, then gets cut" artefacts.
* Recommendation: semantic end-of-turn (LiveKit turn-detector model, Pipecat Smart Turn v3, Deepgram Flux EoT, or an LLM/heuristic "is the utterance complete?" check on interim transcripts) with a **dynamic hang-over** (≈200-300 ms when complete, 800-1 500 ms when incomplete) and speculative LLM start on the interim transcript.

### FE-CAPTURE-05 — False barge-in has no recovery (MEDIUM, UX)

* FACT: on `speech_start` the reply is cancelled locally and irrevocably (`useVoiceCallController.ts:660-664`) and the server truncates the turn; if the triggering segment is then rejected as `no_speech`/`too_short` the rejection is silent (`:179`, `:553`) and nothing resumes.
* Combined with FE-CAPTURE-02 (any 500 ms of accumulated non-speech energy), coughs-in-series, a door, a TV or a passing conversation can silently kill a reply mid-sentence; the call then sits on "Listening".
* Recommendation: **pause-then-confirm** — on `speech_start` duck or pause playback, confirm with STT words (or a neural VAD probability) within ~1-1.5 s, then send `voice_barge_in`; otherwise resume from the paused position (LiveKit `resume_false_interruption`, Pipecat min-words interruption strategy). Listed as backlog in `00_current_status_and_roadmap.md:95`.

### FE-CAPTURE-06 — Mute/unmute (and noise starting mid-call) produce fake "speech" turns (MEDIUM, robustness)

* FACT: `mute()` only sets `track.enabled = false` (`useMicrophoneCapture.ts:571-580`); the worklet keeps running on zeros, so the noise floor decays toward 0 with the 200 ms fall constant (`worklet.js:301`). Calibration happens only in the first 400 ms of a capture (`:275`), never on unmute.
* SIM: steady fan at 0.02 RMS, 5 s mute, unmute → a 2 812 ms segment with 2 152 ms "speech" and `speech_start` (§9).
* Impact: after every unmute in a non-silent room the client uploads a noise turn (STT cost; possible hallucinated transcript → LLM reply) and may barge in on the character.
* Recommendation: send a `pause`/`mute` message to the worklet that freezes the floor and discards any open segment; re-calibrate (or fast-rise the floor) on unmute.

### FE-CAPTURE-07 — Weak mid-call mic failure handling: no `mute`/`statechange`/`devicechange` listeners; failures shown as self-clearing notices (MEDIUM, robustness/UX)

* FACT: only the track `ended` event is observed (`useMicrophoneCapture.ts:520-522`, `:441-462`). No listener for `MediaStreamTrack` `mute`/`unmute`, `AudioContext` `statechange` (`suspended`/`interrupted` on iOS), `navigator.mediaDevices` `devicechange`, or Permissions API `change` (grep over `src/features/interaction` and `src/features/call`).
* FACT: `no_input` and `device_lost` become **non-fatal** controller errors (`useVoiceCallController.ts:981-988`) that clear after `NOTICE_TTL_MS` 8 s (`:148`, `:430-436`); the call stays `live`/`listening`. `CallScreen` does not read `micStatus` (grep). The effect only reports errors raised while `lifecycleRef.current === 'live'` (`:982`); a capture error raised while still `connecting` is never surfaced.
* INFERENCE: iOS phone call / Siri / app switch interrupts the capture context or mutes the track; nothing resumes it, so the call looks healthy but the mic is dead. A permission revoked mid-call ends the track → restart fails with `NotAllowedError` → `device_lost` notice for 8 s → silent dead mic.
* Recommendation: subscribe to track `mute`/`unmute` and context `statechange` (resume on `visibilitychange`/`unmute`), show a persistent mic-problem state (or end the call) when restart fails, offer device switching on `devicechange`, and make mic errors sticky until resolved.

### FE-CAPTURE-08 — Liveness watchdog can misclassify a live stream and the raw fallback is permanent (MEDIUM, robustness)

* FACT: `dead = maxObservedLevelRef.current === 0 || track?.muted === true` (`useMicrophoneCapture.ts:421`), where the observed level is the worklet's smoothed level **rounded to 3 decimals** (`worklet.js:269-271`, `roundMetric` `:82-84`) → any input below ≈ 8e-5 RMS (≈ −82 dBFS) reads as exactly 0. A transiently `muted` track at the 3 s mark also counts as dead.
* FACT: the fallback restarts with `RAW_AUDIO_CONSTRAINTS` (`:430-434`), stores them in `constraintsRef` (`:468`) so device restarts reuse raw, and only a user-facing `start()` resets it (`:559`, `:568`). Raw disables AEC/NS/AGC and auto barge-in (`:978`, controller `:681`) and enables FE-CAPTURE-01.
* INFERENCE: aggressive noise suppression in a very quiet room, or OS-level mic mute, could trip it; frequency is UNKNOWN (no telemetry of fallback events beyond `console.warn`).
* Recommendation: use the un-rounded max RMS/peak, check `context.state` and `track.muted` separately (wait for `unmute`), retry processed constraints once before going raw, and report fallback events to telemetry.

### FE-CAPTURE-09 — End-to-end client timing is measured but never reported; speech-end stamp can miss the upload (MEDIUM, observability)

* FACT: `CallPlaybackTiming` computes `speech_end_to_first_audible_ms` but only emits a local `performance.mark` (`callPlaybackTiming.ts:28-33`, `:62-72`); nothing consumes `FIRST_AUDIBLE_MARK` (grep).
* FACT: `speech_end_lag_ms` covers hang-over + hashing + queueing to `fetch()` dispatch only; mic/APM latency and network transit are excluded (`speechEndLag.ts:1-16`), so the server's `user_stop_ttfb_ms` is a lower bound.
* INFERENCE (race): the worklet posts `segment` then `speech_end` (`worklet.js:398-415`); the segment is emitted after an async `crypto.subtle.digest` (`voiceVadWorklet.ts:180`) and uploaded synchronously on emit (`useVoiceCallController.ts:934`, lag read at `:590`). If the digest resolves before the `speech_end` task runs, the upload carries no lag and `CallPlaybackTiming.segmentSent` gets `undefined` (`:574`). The stamp-in-place path (`voiceVadWorklet.ts:277`) does not help an upload already sent.
* Recommendation: ship client marks (speech_end, segment_built, upload_start, ack, first chunk received, first audible, barge-in detect → playback stopped) to the BFF over the socket or a beacon; post `speech_end` **before** `segment` from the worklet (or carry `silence_tail_ms` inside the segment message) so the pairing cannot race; add counters for VAD rejections, superseded turns, false barge-ins, raw fallbacks.

### FE-CAPTURE-10 — Long-held upload POSTs, 3-in-flight server cap and no 429 retry (MEDIUM, latency/robustness)

* FACT: each POST stays open until the server turn finishes (`engine.py:2090-2103`; client comment `useVoiceCallController.ts:622-623`). Server rejects a 4th concurrent segment with 429 `busy` (`engine.py:83`, `:2041-2042`, `errors.py:185-189`). Client resends only on network `TypeError` (`:604`); a 429 becomes a generic "upload failed" notice and the utterance is lost (`:615-618`).
* INFERENCE: every barge-in utterance overlaps the previous turn's still-open POST; on HTTP/1.1 it needs another pooled/new connection (+RTTs), and rapid short utterances during a long reply can hit 429.
* Recommendation: have the upload return on acceptance (202 + segment ack) and drive the turn entirely over the socket; honour `retry_after` on 429; or move uplink audio onto the WebSocket (FE-CAPTURE-03).

### FE-CAPTURE-11 — No early "user is speaking" signal to the server (MEDIUM, latency)

* FACT: `handleVadState` deliberately sends nothing (`useVoiceCallController.ts:907-910`); server warm-ups (TTS socket reopen, moderation plan) run only when the segment arrives (`engine.py:2043-2044`, `:3267-3291`).
* Impact: the 1-3 s while the user is talking are unused for pre-warming (STT connection, TTS socket, moderation, LLM session/prefix cache), and the server cannot hold a reply that is about to start while the user is mid-utterance.
* Recommendation: send a lightweight `voice_vad{speech_start|speech_end}` hint over the socket; trigger warm-ups and "user is speaking, hold output" on the server.

### FE-CAPTURE-12 — Premature cuts multiply STT requests (MEDIUM, cost)

* FACT (doc): the roadmap records Groq's 10 s per-request STT billing floor as a tracking item (`00_current_status_and_roadmap.md:95`). FACT (code): every pause ≥ 550 ms closes a segment (`CallScreen.tsx:114`) and each segment is one STT request on the server.
* INFERENCE: typical 2-3 s utterances are billed as 10 s (3-5× overbilling), and split utterances double it; noise segments (FE-CAPTURE-02/06) add more.
* Recommendation: streaming STT billed per audio second, or a longer/semantic hang-over; reject noise client-side with a neural VAD.

### FE-CAPTURE-13 — Speech in the first 400 ms of any capture (re)start is learned as noise (LOW, UX)

* FACT: calibration frames are never voiced and learn the floor with τ 100 ms up to the 0.05 cap (gate 0.15) (`worklet.js:68-71`, `:275-278`, `:300`). Every internal restart (raw fallback, device restart) re-runs calibration (`useMicrophoneCapture.ts:464-538`).
* SIM: a 2 s utterance starting 100 ms after capture start produced **no segment at all** (§9).
* Recommendation: carry the floor across internal restarts, use a percentile-based calibration that ignores high-energy frames, or cap the calibration-learned floor.

### FE-CAPTURE-14 — Mute does not discard an utterance in progress (LOW, UX)

* FACT: muting zeroes the track (`useMicrophoneCapture.ts:571-580`); the open segment closes after 550 ms of zeros and is uploaded as a turn (`worklet.js:352-353`, `:372-416`).
* Recommendation: on mute, tell the worklet to drop the open segment (user intent of muting mid-sentence is usually "don't send that").

### FE-CAPTURE-15 — Call-setup capture path is serial and per-restart (LOW, latency at call start)

* FACT: `AudioContext` is created after `await getUserMedia` (`useMicrophoneCapture.ts:485`, `:331`), resumed, then `addModule` fetches the worklet (`:142`), all per capture start/restart; a context that cannot reach `running` is reported as `unsupported` (`:138-140`, `:534-536`), a misleading message for an autoplay-policy failure.
* Recommendation: create/resume the context synchronously inside the click, run `addModule` in parallel with `getUserMedia`, reuse one context per call, and map a resume failure to its own error code.

### FE-CAPTURE-16 — In-worklet resampler has a wide transition band (LOW, audio-quality)

* FACT: 33-tap Hamming FIR evaluated at the input rate (`worklet.js:52-53`, `:95-108`, `:122`). INFERENCE: Hamming transition width ≈ 3.3/N cycles/sample → ≈ 4.8 kHz at 48 kHz around a 7.2 kHz cutoff, so attenuation at 8 kHz is modest and some 8-10 kHz energy aliases into 6-8 kHz. Only used when the 16 kHz context is rejected (Firefox). Negligible for Whisper; worth noting if a neural VAD or another STT is added.
* Recommendation: a longer polyphase filter (64-128 taps) or a WASM resampler (speexdsp/soxr) when the path is active.

### FE-CAPTURE-17 — Stereo/multi-channel inputs: only channel 0 is read and no `channelCount` constraint (LOW, robustness)

* FACT: `inputs[0][0]` (`worklet.js:257`); constraints set no `channelCount` (`useMicrophoneCapture.ts:80-83`). INFERENCE: on the raw path with a stereo interface whose mic is on input 2, the VAD sees silence → `no_input`.
* Recommendation: request `channelCount: 1` (or downmix all channels in the worklet).

### FE-CAPTURE-18 — Stale comments / dead configuration (LOW, maintainability)

* `voiceVadWorklet.ts:17` says "the server rejects segments over 8 s"; server default is 30 s (`config.py:42`) and the client raises to 29.5 s.
* `aggressiveness: 'strict'` (450 ms) is unreachable: the hook never receives an aggressiveness from the controller (`useVoiceCallController.ts:966-972`) and `voice_start` hard-codes `balanced` (`:1265`).
* `voiceVadWorklet.ts:23` documents the default as ~800 ms; production is 550 ms (`CallScreen.tsx:114`).
* Controller comment says the worklet reports the level "~30×/s" (`useVoiceCallController.ts:156`); it is ~20 Hz (`worklet.js:45`, `:191-192`).
* `onVadState` forwards `seq: data.seq` (`useMicrophoneCapture.ts:389`) but the worklet never sends `seq`.
* `started_at_ms` restarts at 0 after an internal capture restart (`worklet.js:402`, `:422-424`) — fine for the server's range check but not monotonic within a call.

### FE-CAPTURE-19 — Echo-reference coverage of the playback path is unverified (INFO, audio-quality)

* FACT: replies play through an `HTMLAudioElement` fed by MediaSource/Blob (`voicePlaybackBuffer.ts:47-58`, `:115`), not through WebRTC; AEC is the browser's `getUserMedia` echo canceller.
* UNKNOWN: whether each target browser/OS uses media-element output as the AEC reference (Chrome's audio-service-wide echo cancellation vs older renderer-only behaviour; Safari's voice-processing I/O with `play-and-record`; Firefox). `getSettings().echoCancellation === true` (`useMicrophoneCapture.ts:90-93`) only reports that AEC was requested, not that it is effective. Needs an echo-return-loss measurement per device class.

### FE-CAPTURE-20 — Privacy posture of the uplink (INFO, security-privacy)

* FACT: raw mic bytes are only held in memory until the upload; the socket hook "never stores raw microphone Blob/bytes" (`useVoiceCallSocket.ts:52-57`); the server stores user lines as transcript text only (`route_voice_call.py` `_transcript_segment_payload` docstring). Upload integrity is bound by SHA-256 + `Idempotency-Key`. Moving to streaming must keep these properties (no client-side buffering beyond the active utterance; no audio persistence).

---

## 6. Strengths (keep these)

1. **All audio DSP on the audio render thread** (AudioWorklet), preallocated buffers, segment buffer transferred zero-copy (`worklet.js:206-208`, `:397-407`); trivial CPU (~1 M MAC/s even on the 48 kHz resampling path).
2. **Correct resampling strategy**: let the browser resample into a 16 kHz context; exact fractional fallback resampler with no pitch/speed drift, tested at 44.1/48 kHz (`voiceVadProcessor.worklet.test.ts:124-158`).
3. **Pre-roll (300 ms)** prevents clipped onsets; **trailing-silence trim to 200 ms** saves upload bytes and STT seconds; pause re-seeds the next pre-roll; max-length cuts neither duplicate nor lose audio (tests `:175-257`).
4. **Adaptive noise floor with hysteresis + calibration**, and a cap so loud stretches cannot deafen the gate (`worklet.js:55-71`); stationary noise present from the start never opens a segment (test `:281`).
5. **Interruption hygiene aligned with industry defaults**: min speech raised to 500 ms while the character is audible (LiveKit-style min interruption duration), 3 s AEC warm-up, auto barge-in disabled when AEC is off, manual Interrupt button, headphones hint.
6. **Truncate-to-heard barge-in**: `played_ms` read before the local cancel and sent with the turn id; local playback stops immediately without waiting for the server (`useVoiceCallController.ts:644-673`).
7. **Low setup latency for the user**: `getUserMedia` runs directly from the consent click before any network (`:1018-1024`); utterances spoken before `voice_ready` are queued and flushed in order instead of being lost (`:564-571`, `:632-642`).
8. **Robust async lifecycle**: `captureGenRef`/`sessionGenRef` invalidate stale async work; seq continuity across internal restarts and reset on user start; mute survives restarts; single device-loss restart; Firefox rate fallback; Safari audio session; wake lock; `pagehide` keepalive end.
9. **Idempotent, integrity-checked uploads** (SHA-256 + Idempotency-Key) with exactly one safe network resend.
10. **Latency telemetry exists**: `speech_end_lag_ms` includes the hang-over by definition (`speechEndLag.ts`), feeding the server's `user_stop_ttfb_ms`.
11. **Good unit coverage** of DSP and lifecycle: 14 capture-hook tests, 12 worklet tests, 10 segmenter tests, 6 lag tests, plus controller tests for queueing, segment cap, barge-in warm-up and AEC-off behaviour.

---

## 7. Deviations from state-of-the-art realtime voice-agent practice

| SOTA practice | This implementation | Gap |
|---|---|---|
| Continuous streaming of 20 ms frames over a persistent socket (WebRTC/WS) | Whole utterance after 550 ms silence, HTTP POST | FE-CAPTURE-03 |
| Compressed uplink (Opus 16-32 kbps) | PCM16 WAV 256 kbps | FE-CAPTURE-03 |
| Streaming STT with interim/final results | Batch STT on the full file (backend) | FE-CAPTURE-03 |
| Neural VAD (Silero/TEN/WebRTC VAD) | RMS energy gate | FE-CAPTURE-02 |
| Semantic / model-based end-of-turn, dynamic hang-over | Fixed 550 ms silence | FE-CAPTURE-04 |
| Interruption with false-interruption recovery and min-words confirmation | Irrevocable cancel at 500 ms of energy | FE-CAPTURE-05 |
| Echo-robust barge-in (AEC + reference check / half-duplex fallback) | AEC assumed; echo segments still uploaded when AEC is off | FE-CAPTURE-01, -19 |
| Server-side prewarm on speech start | Warm-ups only on segment arrival | FE-CAPTURE-11 |
| Per-stage latency metrics from mic to speaker, collected centrally | Lag to upload dispatch + local-only first-audible mark | FE-CAPTURE-09 |
| Device/interruption resilience (track mute, context interruption, device change) | Only track `ended` | FE-CAPTURE-07 |

---

## 8. Test coverage notes

* Covered (FACT): consent gating, worklet-required fail-closed, segment building, Firefox rate fallback, watchdog vs mute, raw-restart mute persistence, device-loss restart, configure re-apply, seq monotonicity, speech-end stamping, level throttling (`useMicrophoneCapture.test.ts`); resampling exactness, pre-roll, pause re-seed, max-cut, configure, stationary noise, level (`voiceVadProcessor.worklet.test.ts`); WAV/hash/pairing (`voiceVadWorklet.test.ts`); controller queueing, segment cap, AEC warm-up, AEC-off, upload resend, lag (`useVoiceCallController.test.ts:308-760`).
* Not covered: real speech recordings; non-stationary noise (babble/TV/music/typing); echo/self-transcript scenario; mute→unmute noise; speech during calibration; `speech_end`-after-upload race; 429 handling; track `mute`, context `interrupted`, `devicechange`; any browser-level (Playwright/WebDriver with fake media) or device-matrix test of AEC effectiveness and iOS routing.

---

## 9. Simulation (SIM) — real worklet source, synthetic signals

Method: the unmodified `voiceVadProcessor.worklet.js` was evaluated in Node 24 with stubbed `AudioWorkletProcessor`/`registerProcessor`/`sampleRate` (same technique as the repo's own test) and fed 128-sample quanta. "Speech-like" = noise carrier with a 4 Hz syllabic envelope; options `{silenceMsToEnd:550, minSpeechMs:250, maxSegmentMs:29500}` unless stated. Times are stream time.

| Scenario | Result |
|---|---|
| 16 kHz: quiet room, 2 s speech (0.08 RMS) from t=1.0 s | `speech_start` 1 256 ms; `segment` 2 500 ms + `speech_end{tail 552}` at 3 552 ms |
| 48 kHz: same | `speech_start` 1 251 ms; segment at 3 549 ms, tail 549 ms |
| Barge-in threshold (`minSpeechMs` 500), onset 1.0 s | `speech_start` 1 544 ms (≈ 540 ms detection) |
| Quiet speaker 0.012 RMS | detected (`speech_start` 1 528 ms), segment 2 356 ms |
| 600 ms mid-sentence pause | split into 2 segments (2 004 ms each) |
| 2 s speech then TV-like babble 0.02 RMS for 35 s | first turn OK; babble opened a new turn at 15.5 s, still open at end (≥ 22 s) |
| Distant TV babble 0.01 RMS, nobody talking, 10 s | `speech_start` at 1 592 ms; never closed within 10 s |
| Keyboard-like clicks (5 ms every 150 ms), 5 s | `speech_start` at 4 152 ms; never closed |
| Fan 0.02 RMS, 5 s mute (zeros), unmute | 2 812 ms segment (2 152 ms "speech") + `speech_start` after unmute |
| Leaked character voice 0.03 RMS for 4 s (`minSpeechMs` 500) | `speech_start` at 1 616 ms; 4 372 ms segment uploaded |
| User speaks from t=0.1 s (inside 400 ms calibration) | **no events at all** (utterance lost) |

Harness (condensed):

```js
const SRC = readFileSync('src/features/interaction/audio/voiceVadProcessor.worklet.js', 'utf8')
let Ctor; class AWP { constructor() { this.port = { posted: [], postMessage(m) { this.posted.push(m) } } } }
new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate', SRC)(AWP, (_n, c) => { Ctor = c }, 16000)
const p = new Ctor({ processorOptions: { silenceMsToEnd: 550, minSpeechMs: 250, maxSegmentMs: 29500 } })
for (let off = 0; off + 128 <= signal.length; off += 128) p.process([[signal.subarray(off, off + 128)]])
```

---

## 10. Open questions

1. Does the AEC in each target browser/OS (Chrome desktop Win/Mac/Linux, Android Chrome, iOS/macOS Safari, Firefox) use `HTMLAudioElement`/MSE output as its echo reference? What is the measured echo return loss with laptop speakers? (FE-CAPTURE-19)
2. How often does the raw fallback fire in production, and on which platforms? (only `console.warn` today)
3. Production distributions of `speech_end_lag_ms`, `user_stop_ttfb_ms`, segment duration, `no_speech` rejections and `superseded` turns (proxies for VAD false positives and premature cuts)?
4. Is the BFF served over HTTP/2 or HTTP/3 in production (connection reuse while turn POSTs are held open)?
5. iOS Safari: does `createMediaStreamSource` into a 16 kHz context behave correctly on iOS 17/18, and does `audioSession.type = 'play-and-record'` route playback to the earpiece instead of the speaker?
6. Bluetooth headsets: opening the mic forces HFP (narrow-band output). Is a "use built-in mic, keep BT output" option wanted?
7. Groq's per-request minimum billing — confirm the current rule and the real billed/actual ratio for call segments.
8. Is a half-duplex mode acceptable product-wise for AEC-off devices (no talking over the character), or should echo be filtered server-side by transcript similarity?

---

## Verification (adversarial)

Second-pass check of FE-CAPTURE-01 to FE-CAPTURE-12 (2026-10-20). Each cited line was re-opened in the frontend and BFF. The SIM claims were reproduced independently: the unmodified worklet was run in Node at 16 kHz and 48 kHz with signals generated separately from section 9 (syllabic-envelope babble, 5 ms click bursts, Gaussian fan, mute window of zeros). No source code was changed.

| id | verdict | corrected severity | evidence/note |
|---|---|---|---|
| FE-CAPTURE-01 | confirmed | high | `maybeAutoBargeIn` (controller:676-687) returns early when AEC is off or the stream is on the raw fallback, and during the first 3 s of the call's first reply. `handleCapturedSegment` (920-935) uploads every segment with no playback or AEC check. In the BFF, `accept_segment` (engine.py:2068-2088) supersedes any unfinished turn once intake returns text, and there is no echo or self-transcript filter (grep for echo/similar finds only the docstring at 1419, which describes this path on purpose). Re-sim: 0.03 RMS leaked speech for 4 s produced a 4.5 s segment with `speech_start` at both rates. Extra: the AEC-off hint (`call.screen.headphonesHint`, CallScreen:529) says "interrupting by voice is disabled". That is wrong, because the uploaded segment still interrupts through supersede. If the server turn already finished (TTS generates faster than real time), nothing is cancelled, but the character still answers its own words. The warm-up part (AEC on) is weaker than the AEC-off case. |
| FE-CAPTURE-02 | confirmed | high | worklet:276-277 is a per-quantum RMS gate. 339: onset counts cumulative `speechSamples`, not contiguous voiced time. 352-353: one voiced quantum resets `silenceFrames`. 301: the floor falls with a 200 ms time constant on every dip. config.py:42 is 30 000, and `applySegmentLimit` makes the client max 29 500 ms. Tests (281-304) use only tones and stationary uniform noise. Re-sim: babble 0.01 RMS gave `speech_start` at 1.5 s (16 kHz) / 1.8 s (48 kHz) and was still open at 12 s. Babble 0.02 after a real turn was still open at 25 s. Clicks every 150 ms gave `speech_start` at 4.1 s / 6.1 s and never closed. |
| FE-CAPTURE-03 | confirmed | high | Audio is posted only after `flushSegment` (worklet:372-415) and sent as a whole WAV (`createPcm16WavBuffer`, voiceVadWorklet.ts). `VoiceAudioEncoding` is only `audio/wav;codec=pcm_s16le` (voice.types.ts:14). The upload is multipart FormData (index.ts:5418-5446). In the route (route_voice_call.py:1130-1158), feature, auth, workspace, chat ownership, admission and content-length checks all run before `request.form()`. The socket accepts no audio frame types (route:257-259). The 4.9 s upload-to-first-audio sample is roadmap line 61. The 620-1300 ms client share is an estimate. |
| FE-CAPTURE-04 | confirmed | medium | CallScreen:114 sets `silenceMsToEnd: 550`. There is no semantic EoT anywhere; roadmap V-07 lists it as TBD. Re-sim: a 600 ms mid-sentence pause gave two 2.0 s segments. The server merges the text only when the superseded turn's user message was not yet persisted (engine.py:2075-2087). Otherwise the turns stay separate. |
| FE-CAPTURE-05 | confirmed | medium | `sendBargeIn` (644-673) cancels playback and sends `voice_barge_in` at once. `SILENT_REJECTIONS` (179) and `handleRejection` (550-562) drop no_speech and too_short silently. The playback buffer has no resume or duck path; its `resume()` is only for autoplay. During playback, onset needs 500 ms of cumulative energy (706). |
| FE-CAPTURE-06 | confirmed | medium | `mute()` (useMicrophoneCapture:571-580) only sets `track.enabled=false`, so the worklet keeps processing zeros. The floor falls (worklet:301), and calibration runs only while `frameIndex < calibrationFrames`, which is never reset. Re-sim: fan 0.02 RMS, mute 3-8 s, then unmute gave `speech_start` at 8.25 s and a 2.9-3.05 s segment with about 2.1 s of "speech", at both rates. The same fan with no mute gave no events. Nuance: in processed mode, browser NS lowers a stationary fan, so the effect is strongest with raw capture or non-stationary noise. |
| FE-CAPTURE-07 | confirmed | medium | Only `ended` listeners are attached (521-522). Grep finds no track mute/unmute, `statechange`, `devicechange` or permissions listeners. The only `visibilitychange` handler (controller:1194) just re-acquires the wake lock. Mic errors are mapped to non-fatal notices (981-988) that clear after `NOTICE_TTL_MS` 8 s (147-148, 430-436). The effect returns when lifecycle is not `live`, and its deps do not re-fire later. `micStatus` is not read by CallScreen. `segment_failed` is never surfaced. The liveness watchdog fires once, so it cannot catch a later suspended or interrupted context. |
| FE-CAPTURE-08 | confirmed | medium | Dead means `maxObservedLevelRef === 0 \|\| track.muted` (421). The level is EMA(min(1, 6·rms)) rounded to 3 decimals (worklet:269-271), so input below about 8.3e-5 RMS reads as 0. Likely trigger: noise-gated virtual mics or OS voice isolation output digital zeros while the user stays silent during the first 3 s. `startWithConstraints` stores RAW in `constraintsRef` (468), device restarts reuse it (459), and only `start()` resets it (559, 568). The fallback is not reported in `voice_start` capabilities or any telemetry, only via `console.warn`. |
| FE-CAPTURE-09 | confirmed | medium | `emitMark` (callPlaybackTiming:28-33) writes `performance.mark` only; grep finds no reader of `FIRST_AUDIBLE_MARK`. `speech_end_lag_ms` is measured at dispatch (speechEndLag.ts, controller:590). The worklet posts `segment` before `speech_end` (398-415). `uploadSegment` builds its body synchronously when the hash resolves, so a digest that resolves before the `speech_end` message gives an upload with no lag. In practice that race is unlikely: the `speech_end` port message is already queued before the digest task. The synchronous fallback hash runs only in insecure contexts, where getUserMedia is not available anyway. The server records segment rejections, so the "no counters" gap applies to the client side only. |
| FE-CAPTURE-10 | adjusted | low | Real: the POST stays open until `_run_voice_turn` returns (engine.py:2090-2103). The cap is 3 (83, 2041-2042), and the 429 `busy` carries `retry_after_seconds=1` (errors.py:185-189). The client resends only on TypeError (controller:604), `authenticatedRequest` retries only 401, so a 429 utterance is dropped with a generic notice. Overstated: barge-in POSTs do not "always" overlap an open POST. The server turn finishes when LLM+TTS generation ends, usually well before playback ends. A superseded turn is cancelled and leaves `runtime.segments`. A 4th concurrent segment needs about 3 segments inside one STT and cancel window, which is rare and mostly comes from noise segments (FE-02). Extra RTTs happen only when no idle pooled connection exists. |
| FE-CAPTURE-11 | adjusted | low | Real: the client sends no VAD hint (907-910), and the server accepts no such frame (route_voice_call.py:257-259 accepts only ping/barge_in/playback plus start/resume/end). `_warm_call_speech` and `_warm_call_moderation` run only inside `accept_segment` (2043-2044). Severity lowered: both warm-ups already overlap the STT call, and no measurement shows them on the critical path. The larger gains, such as streaming STT and speculative LLM, are covered by FE-03 and FE-04. The "hold output" part matters mainly for the AEC-off case (FE-01). |
| FE-CAPTURE-12 | adjusted | low | Real: Groq is the only STT provider (config.py:91, 120). Each segment is one request, and the roadmap (line 95) records Groq's 10 s per-request billing floor. Severity lowered: Groq Whisper-large-v3 lists at about $0.111 per audio hour (verify current pricing), so the 10 s floor is about $0.0003 per request. A 3-5x multiplier on that is small next to TTS and LLM cost per turn. The bigger cost of premature or noise segments is the extra LLM and TTS turns (FE-02, FE-04, FE-06). |
