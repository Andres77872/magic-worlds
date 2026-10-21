# Audit evidence: Frontend WebSocket transport, frame protocol, playback buffer and call state machine

Subsystem: `FE-PLAYBACK-TRANSPORT`. Audit date: 2026-10-20. Code is read-only; nothing was modified.

Legend: **FACT** means seen in code at the cited `file:line`. **INFERENCE** means reasoning from code plus platform knowledge. **UNKNOWN** means it cannot be settled from the repositories.

Abbreviations:
- FE = `/home/andres/WebstormProjects/magic-worlds/src`
- BE = `/home/andres/PycharmProjects/magic-worlds-api/src`

---

## 1. Scope and files read

| Layer | File | Role |
|---|---|---|
| Transport | FE `infrastructure/api/voiceSocket.ts` (641 lines) | Imperative `VoiceSocket`: connect, auth subprotocol, heartbeat, reconnect/resume, stale-frame filter, client frame senders |
| Transport hook | FE `features/interaction/hooks/useVoiceCallSocket.ts` (174) | React wrapper; routes typed frames to handlers; lifecycle of the socket object |
| Controller | FE `features/interaction/hooks/useVoiceCallController.ts` (1318) | Call lifecycle + turn phase + derived UI state, upload queue, barge-in, playback progress, end/teardown |
| Playback | FE `features/interaction/audio/voicePlaybackBuffer.ts` (830) | Per-turn MP3 player on one `<audio>` element: MSE, ManagedMediaSource, Blob-group fallback |
| Format guard | FE `features/interaction/audio/audioFormat.ts` (74) | Chunk playability and sink choice (`mse` / `blob`) |
| Timing | FE `features/interaction/audio/callPlaybackTiming.ts` (84), `speechEndLag.ts` (44) | First-audible marks; `speech_end_lag_ms` sent with uploads |
| Types | FE `shared/types/voice.types.ts` (329) | Wire contract: client and server frames, upload request/response |
| REST | FE `infrastructure/api/index.ts:5406-5467` | `saveVoiceConsent`, `uploadVoiceSegment` (multipart), `endVoiceCall` (keepalive) |
| UI caller | FE `features/call/components/CallScreen.tsx:100-174` | VAD tuning passed in (`silenceMsToEnd: 550`), start gesture |
| Server, for contract checks | BE `routes/user/route_voice_call.py`, `services/voice_orchestration/delivery.py`, `engine.py`, `config.py`, `serve.py` | Frame validation, send path, resume semantics, defaults |
| Tests | `voiceSocket.test.ts` (573), `useVoiceCallSocket.test.ts` (239), `voicePlaybackBuffer.test.ts` (623), `useVoiceCallController.test.ts` (1046), `callPlaybackTiming.test.ts` (46), `audioFormat.test.ts` (66) | Unit tests (jsdom + mocks) |

---

## 2. Architecture walkthrough (how it works today)

### 2.1 Two channels, not one

The call uses **two separate transports**:

1. **One WebSocket per call** for control frames and assistant output: `{ws}/character-chats/{id}/ws-voice?workspace_id=…` (FACT, `voiceSocket.ts:288`). It carries JSON text frames only. Inbound binary frames are ignored: `if (typeof data !== 'string') return` (FACT, `voiceSocket.ts:424`).
2. **HTTP multipart POST per VAD segment** for microphone audio: `POST /character-chats/{id}/voice-segments` with a 16 kHz mono PCM16 WAV Blob, SHA-256, VAD metadata JSON and `Idempotency-Key: voice:{vsid}:{seq}:{sha}` (FACT, `index.ts:5418-5445`). The header comment at `voiceSocket.ts:4-6` says this is deliberate: "microphone bytes are uploaded through the HTTP voice-segments route instead".

The server runs the **whole turn inside that POST** (STT, then LLM, then TTS delivery). `accept_segment` stores `task=asyncio.current_task()` and then `return await self._run_voice_turn(...)` (FACT, BE `engine.py:2046`, `2092`). The client depends on this: "The POST resolves only after the server turn finished" (FACT, `useVoiceCallController.ts:622-628`).

### 2.2 Sequence of one call

```
Click "Call" (user gesture)
 ├─ playback.unlock()  → silent 10 ms WAV primes the <audio> element (iOS autoplay)        controller:997, buffer:220-259
 ├─ capture.start()    → getUserMedia + AudioContext + VAD worklet                         controller:1024
 ├─ ensureSession()?   → creates draft chat when none                                      controller:1044-1049
 ├─ POST voice-consent → limits                                                            controller:1052-1058
 ├─ socket.start(voice_start) → new WebSocket(url, ['mw.bearer.v1', token])                controller:1078, voiceSocket:291
 │    onopen → send voice_start {client_call_id, audio prefs, capabilities, voice?}        voiceSocket:301-314, controller:1255-1273
 │    ← voice_ready {voice_session_id, limits, upload_url, audio, effective_voice, …}     controller:721-744
 │    ← voice_status {state:'listening'}  (ignored by the controller)                      BE engine:929
 │  15 s ready timeout → fatal VOICE_READY_TIMEOUT                                         controller:1082-1088
 └─ lifecycle 'live'; wake lock; flush segments queued before ready (120 ms apart)          controller:741-743, 632-642

Per user turn
 VAD speech_start (local only; no WS frame)                                                controller:907-918
 VAD segment (silence 550 ms) → WAV + SHA-256 → POST voice-segments (HTTP)                 controller:564-630
 ← voice_segment_ack {received|accepted|rejected}                                          controller:768-774
 ← transcript_final {turn_id, text}        (sent only once the LLM turn is admitted)       BE engine:2586-2595
 ← voice_turn_start {turn_id, segment_seq} → buffer.startTurn() creates the MediaSource    controller:785-800
 ← voice_assistant_delta {content}*        → captions (render on arrival)                  controller:944-948
 ← voice_audio_chunk {seq, data_b64 (MP3), sample_rate, gain_db, …}* → buffer.appendChunk  controller:802-826
 → voice_playback {turn_id, played_ms} every 500 ms while playing                          controller:493-499
 ← voice_audio_final {last_seq} → buffer.finalize → endOfStream → 'ended' → idle           controller:828-830
 ← voice_turn_end {status, truncated?, played_ms?, kept_chars?}                            controller:844-856
 HTTP POST resolves (turn finished server-side)                                            controller:619-628

Barge-in
 VAD speech_start while audible (≥500 ms voiced, after 3 s AEC warm-up of the first reply)
   → read played_ms, buffer.cancel (pause + drop src), send voice_barge_in{turn_id, played_ms}
 ← voice_cancelled {turn_id, reason, truncated?, kept_chars?} → captions cut to kept_chars

End
 voice_end over WS + POST voice-end (keepalive) + close(1000)                              controller:1093-1134
```

### 2.3 Frame protocol: client to server (all JSON text)

FACT, types at `voice.types.ts:112-138`; server models at BE `route_voice_call.py:186-262` (`extra="forbid", strict=True`).

| Frame | Fields | When sent | Server handling |
|---|---|---|---|
| `voice_start` | `client_call_id`, `audio{preferred_encoding:'audio/wav;codec=pcm_s16le', sample_rate:16000, channels:1, vad{source:'audio_worklet', aggressiveness:'balanced'}}`, `capabilities{media_source_mp3, audio_worklet, media_recorder:false}`, `voice?` | On `onopen` when there is no `voiceSessionId` yet (`voiceSocket.ts:394-399`) | Admission, then `voice_ready` (BE `route_voice_call.py:1475-1490`) |
| `voice_resume` | `voice_session_id`, `last_segment_seq` | On `onopen` after a drop once a call exists | `resume_call`, then `voice_state_snapshot` (BE `engine.py:940-1010`) |
| `voice_ping` | `voice_session_id?` | Every 25 s while open (`voiceSocket.ts:586-600`) | `touch_call` (quota reservation) plus `voice_pong` (BE `route_voice_call.py:1496-1499`) |
| `voice_barge_in` | `reason:'barge_in'`, `turn_id?`, `played_ms?` (int ms) | Manual Interrupt button or auto barge-in (`controller:644-673`) | `engine.barge_in`, which drives the truncation (BE `route_voice_call.py:1500-1508`) |
| `voice_playback` | `turn_id`, `played_ms` | Every 500 ms while status is `playing` (`controller:493-499`) | Max per turn kept, limited to 4 frames/s (BE `engine.py:119`, `1267-1297`); feeds the flush-ahead gate and supersede truncation |
| `voice_end` | `reason:'user'` | End button, pagehide (`voiceSocket.ts:234-239`) | `end_call` plus close 1000 |
| (`voice_segment_meta`) | — | Never sent by the FE | Server answers with `voice_status uploading_segment` (BE `route_voice_call.py:1544-1548`) |

A client-side guard rejects any frame holding raw audio or provider credentials: Blob/ArrayBuffer values, or keys like `audio_b64` or `xi_api_key` (FACT, `voiceSocket.ts:69-86`, `132-144`, `245-249`). Any frame the server cannot validate is **fatal**: `VoiceOrchestrationError("conflict", "Invalid voice frame.", fatal=True)`, which ends the call and closes with 4408 (FACT, BE `route_voice_call.py:320-330`, `1584-1587`).

### 2.4 Frame protocol: server to client (all JSON text)

FACT, types at `voice.types.ts:164-250`; builders at BE `delivery.py:297-520`. The allow-list is mirrored on both sides (`voiceSocket.ts:52-67`, BE `delivery.py:17-34`).

| Frame | Key fields | FE handler |
|---|---|---|
| `voice_ready` | `voice_session_id`, `server_time_ms`, `limits{max_call_seconds, idle_timeout_seconds, remaining_daily_seconds, max_segment_duration_ms?}`, `upload_url` (ignored by FE), `audio{content_type:'audio/mpeg', codec:'mp3', sample_rate, channels:1}`, `effective_voice`, `original_voice_name`, `ai_voice` | `handleReady` (controller:721-744) |
| `voice_state_snapshot` | `state`, `status`, `last_segment_seq`, `last_audio_seq`, `server_time_ms` | `handleStateSnapshot` (controller:746-760). **`last_audio_seq` is never read** (grep: only in types) |
| `voice_status` | `state`, `message?`, `retry_after_seconds?` | Routed by the hook (`useVoiceCallSocket.ts:104-106`) but **the controller passes no `onStatus`**, so it is ignored (controller:937-955) |
| `voice_segment_ack` | `seq`, `status`, `reason?` | Phase goes uploading → transcribing, or rejection handling (controller:768-774) |
| `transcript_final` | `seq`, `turn_id`, `text`, `confidence?`, `no_speech_prob?` | Phase 'thinking'; transcript line (controller:776-783) |
| `voice_turn_start` | `turn_id`, `user_message_id`, `assistant_message_id`, `segment_seq?` | `startTurn` (prewarms the MediaSource), timing mark (controller:785-800) |
| `voice_assistant_delta` | `turn_id`, `content` | Captions, only when `turn_id === activeTurnIdRef` (controller:944-948) |
| `voice_audio_chunk` | `seq` (1-based per turn), `content_type:'audio/mpeg'`, `codec:'mp3'`, `sample_rate ∈ {22050,24000,44100}`, `channels:1`, **`data_b64`** (base64 MP3), `is_final:false`, `gain_db`, `substitution_reason`, `voice_name?` | `handleAudioChunk`, then `appendChunk` (controller:802-826) |
| `voice_audio_final` | `last_seq` | `buffer.finalize` (controller:828-830) |
| `voice_turn_end` | `status ∈ completed/interrupted/failed`, `partial`, `duration_ms`, `truncated?`, `played_ms?`, `kept_chars?` | Captions truncation, settle phase (controller:844-856) |
| `voice_cancelled` | `turn_id?`, `reason ∈ barge_in/end_call/superseded/provider_disconnected`, `truncated?`, `kept_chars?`, `played_ms?` | Cancel playback, settle (controller:858-876) |
| `voice_error` | `category`, `code?`, `message`, `retry_after_seconds?`, `fatal?` | Fatal ends the call; non-fatal is a notice that ends only the turn (controller:878-899) |
| `voice_ended` | `reason` | Teardown, including **playback cancel** (controller:901-905) |
| `voice_pong` | `voice_session_id?` | Only refreshes `lastFrameAt` (voiceSocket:434) |

Audio format on the wire (FACT): MP3 bytes, base64 encoded inside a JSON text frame (BE `delivery.py:464`). There is one frame per provider chunk (BE `engine.py:2441-2509`). ElevenLabs call lane uses `mp3_44100_64` (BE `services/speech/capabilities.py:65`, `159`). The Fish lane uses MP3 44.1 kHz at 128 kbps through a frame re-aligner (BE `services/speech/providers/fish_audio/streaming.py:61`, `209`; `stream_mp3.py:30`).

### 2.5 Auth handshake

- FACT: the Bearer token travels as the second WebSocket subprotocol: `new WebSocket(url, ['mw.bearer.v1', token])` (`voiceSocket.ts:19`, `291`). The server echoes only `mw.bearer.v1` (BE `route_voice_call.py:1464`).
- FACT: the token is read fresh from `localStorage` on every connect (`voiceSocket.ts:118-122`, `280`). The hook deliberately does not recreate the socket on token rotation (`useVoiceCallSocket.ts:76-80`).
- FACT: the server accepts first and then closes 4401/4403 with a typed `voice_error`, so browsers see a real code instead of 1006 (BE `route_voice_call.py:450-470`). The FE swallows the typed `auth_required` frame and lets the close drive recovery (`voiceSocket.ts:437-440`).
- FACT: recovery refreshes the token once on 4401 before ready or during resume, and on a bare 1006 before open (`voiceSocket.ts:337-347`, `381-385`, `500-532`). 4401 after ready is terminal (`voiceSocket.ts:343-345`).
- FACT: an auth-owner check (`authSession.isCurrent`) retires the socket when the account or auth epoch changed (`voiceSocket.ts:301-306`, `316-321`, `615-617`).

### 2.6 Heartbeat, reconnect, resume

| Item | Value | Where |
|---|---|---|
| Ping interval | 25 000 ms | `voiceSocket.ts:20` |
| Liveness timeout | 50 000 ms (2 × ping), checked on each 25 s tick, so detection takes 50–75 s | `voiceSocket.ts:21`, `586-600` |
| Pre-ready reconnect backoff | 1 s × 2^n, max 30 s | `voiceSocket.ts:22`, `626-635` |
| Resume window (client) | 15 000 ms | `voiceSocket.ts:24`, `407-421` |
| Resume backoff | 500 ms × 2^n, max 4 s (about 5 attempts in 15 s) | `voiceSocket.ts:25`, `420` |
| Server resume grace | 20 s default, max 300 s | BE `config.py:45-46`; `engine.py:1036-1041`, `1838-1853` |
| Server WS ping | uvicorn defaults (`uvicorn.run` sets no `ws_ping_*`, so 20 s / 20 s) — INFERENCE from uvicorn defaults | BE `serve.py:28-33` |

Resume semantics (FACT):
- On reconnect, `voice_resume{voice_session_id, last_segment_seq}` is sent (`voiceSocket.ts:394-397`).
- The server rebinds the socket and answers `voice_state_snapshot`. `state` is `listening` if the current turn finished, `assistant_speaking` if it had audio, otherwise `assistant_thinking`. `last_audio_seq` is the current turn's last seq, or 0 (BE `engine.py:985-1003`, `1865-1870`).
- **There is no replay.** While the socket was away, server frames are dropped: `_send_to` returns False when the socket is None (BE `engine.py:1946-1956`). Audio chunks still consume their seq: `turn.audio_last_seq += 1`, then `send_audio_chunk` records the seq and returns `DROPPED` (BE `engine.py:2455`, `2486-2487`; `delivery.py:250-267`).
- FE on snapshot: if `state==='listening'` and either a server turn is active or playback is not idle, it **cancels playback** and clears turn refs (controller:746-760).

### 2.7 Playback buffer (how MP3 is decoded and scheduled)

FACT, `voicePlaybackBuffer.ts`:
- **One reusable `HTMLAudioElement`** (`new Audio()`, `:115`). There is no Web Audio graph, no `decodeAudioData` per chunk and no AudioWorklet for playback.
- **Mode selection per turn** (`setupMediaSource`, `:316-358`), in order:
  1. `MediaSource` with `audio/mpeg` support: a SourceBuffer gets chunks appended in seq order (`pump`, `:371-398`).
  2. `ManagedMediaSource` (iPhone, Safari 17.1+): sets `disableRemotePlayback=true` and appends only while `streaming` (`:336-342`, `:385`). A 2 s stall timer falls back to Blob playback if the element never starts (`:44`, `:553-564`).
  3. **Blob groups** (`startNextGroup`, `:419-436`): everything queued since the last group becomes one `audio/mpeg` Blob URL. The next group starts only on `ended`. Mid-turn groups are cut at whole MP3 frame boundaries (`completeMp3Length`, `:786-801`).
- **Prewarm**: the MediaSource and object URL are created at `voice_turn_start`, before the first audio arrives (`startTurn`, `:155-163`; controller:798). So `sourceopen` is usually done by the first chunk (INFERENCE: LLM TTFT + TTS TTFB is much longer than `sourceopen` latency).
- **Ordering**: `pendingChunks: Map<seq, bytes>`; `drainInOrder` moves only **contiguous** seqs starting at `expectedSeq = 1` (`:360-368`). Duplicates and stale seqs are rejected (`:173-177`). The socket layer also drops `seq <= highest` per turn (`voiceSocket.ts:452-456`).
- **Start of playback**: `playIfAllowed()` runs on every accepted chunk (`:191`). `play()` resolving marks `playing` (`:486-489`), as does the `playing` event (`:511-514`). There is no prebuffer or jitter target: playback starts with whatever was appended.
- **End of turn**: `voice_audio_final` sets `finalSeq`. When `expectedSeq > finalSeq` and the queue is drained, `endOfStream()` runs (`:400-416`), then `ended` leads to `finishTurn` and `idle` (`:516-526`, `:545-551`). A turn with no audio finishes immediately (`:405-408`).
- **Interruption flush** (`cancel`, `:205-212`, then `cancelActiveTurn`/`resetActivePlayback`, `:573-601`): marks the turn cancelled (bounded to 64 entries, `:45`, `:680-686`), detaches the MediaSource, clears queues, `audio.pause()`, removes `src` and revokes the URL (`:604-617`). This is immediate and local, with no fade-out.
- **Playback position** (`playedMs`, `:147-153`): `playedBeforeGroupMs + audio.currentTime*1000`. This is the element's media clock, not hardware output.
- **Gain**: `audio.volume = clipVolume(1, gain_db)` from the turn's first chunk with `gain_db` (`:284-294`).
- **Autoplay**: `unlock()` plays a silent WAV data-URI muted then unmuted inside the click (`:220-259`, `:806-830`). `NotAllowedError` gives state `blocked`, and the UI offers `resume()` (`:496-503`, `:262-270`).
- **Errors**: an element `error` in MSE mode switches to Blob replay of the turn (`:528-533`). An `appendBuffer` throw does the same (`:389-396`, `:444-470`). `NotSupportedError` on `play()` before audio also switches (`:505-507`).
- **Listeners attached**: `play`, `pause`, `playing`, `ended`, `error` (`:632-640`). There is **no `waiting`/`stalled`/`timeupdate` listener**, so underruns are invisible.

### 2.8 Call state machine (controller)

The visible state is derived from independent refs, not set per frame (FACT, `deriveVoiceCallState`, controller:222-239):

```
lifecycle != live → lifecycle (disabled|idle|consent_required|requesting_permission|connecting|ending|ended|error)
live:
  reconnecting           → 'reconnecting'
  bargingIn              → 'barge_in'   (cleared by server cancel/turn_end or after 2 s)
  playback playing|blocked (or buffering of the already-audible turn) → 'assistant_speaking'
  userSpeaking (VAD)     → 'user_speaking'
  turnPhase uploading    → 'uploading_segment'
            transcribing → 'transcribing'
            thinking|streaming → 'assistant_thinking'
            none         → buffering ? 'assistant_thinking' : 'listening'
```

Lifecycle transitions (FACT):
- `idle` → `requesting_permission` (controller:1023)
- → `connecting` (:1077)
- → `live` (on `voice_ready`, :741)
- → `ending` (`teardownForEnd`, :1095)
- → `ended` (:1133, or `voice_ended` :904)
- Any state → `error` on a fatal `voice_error` (:889-892), ready timeout (:1082-1088), consent failure (:1059-1068), capture failure (:1030-1037), or `auth:expired` (:1167-1176).

Turn phase (FACT):
- `uploading` (upload start, :578)
- → `transcribing` (ack, :773)
- → `thinking` (transcript_final / turn_start, :782, :799)
- → `streaming` (first accepted chunk, :825)
- → `none` (`settleTurnPhase` when no uploads in flight and no server turn, :380-382; or the POST finally block, :624-628).

Edge cases (FACT unless marked):
- **Double start**: no re-entrancy guard in `startCall`. The UI blocks it with `isAccepting` (CallScreen.tsx:162-174). `VoiceSocket.openSocket` detaches but does not close a previous `ws` (`voiceSocket.ts:297`).
- **End during speak**: `teardownForEnd` sends `voice_end`, then `stopLocalResources` cancels playback immediately and closes 1000. Then HTTP `voice-end` with keepalive (controller:1093-1134).
- **Network drop**: the socket reports `connecting`, so `reconnecting=true` (controller:762-766). Uploads **continue** during reconnect (the intended queueing condition is unreachable; see finding 02). The snapshot clears `reconnecting`.
- **Page hide**: `voice_end` plus keepalive POST, unless `persisted` (bfcache) (controller:1184-1193).
- **Unmount**: close 1000 plus keepalive end (controller:1202-1216).

### 2.9 Timing telemetry on the client

- FACT: `CallPlaybackTiming` correlates `segmentSent(speech_end_perf_ms)` → `turnStarted(performance.now())` → `playing(performance.now())`. It emits `turn_start_to_first_audible_ms` and `speech_end_to_first_audible_ms` as a **`performance.mark('mw.voice.first_audible', {detail})`** (`callPlaybackTiming.ts:28-33`, `62-73`). The file says `playing` is "a playback proxy, not a hardware audio measurement" (`:1`).
- FACT: nothing in `src/` consumes or uploads that mark. A grep for `FIRST_AUDIBLE_MARK|first_audible` outside tests finds only the defining file. **The client E2E number never reaches the server.**
- FACT: `speech_end_lag_ms` (client clock, VAD speech end → upload send, hang-over included) is sent with every upload (`speechEndLag.ts:28-44`; controller:590). The server adds its own `segment_received → first chunk handed to socket` (BE `engine.py:2906-2910`, `user_stop_ttfb_ms`). That excludes upload network transit before the request headers arrive (receipt is stamped in a dependency, BE `route_voice_call.py:1125-1130`), downstream WS transit, client decode/buffer/play-start and device output latency.

---

## 3. Configuration and defaults table

| Setting | Value | Defined at |
|---|---|---|
| WS subprotocol | `mw.bearer.v1` + token | FE `voiceSocket.ts:19` |
| Heartbeat ping | 25 s | FE `voiceSocket.ts:20` |
| Liveness timeout | 50 s | FE `voiceSocket.ts:21` |
| Max reconnect backoff (pre-ready) | 30 s | FE `voiceSocket.ts:22` |
| Resume window | 15 s ("must stay below server 20 s") | FE `voiceSocket.ts:23-24` |
| Max resume backoff | 4 s (base 500 ms) | FE `voiceSocket.ts:25`, `420` |
| voice_ready timeout | 15 s | FE `useVoiceCallController.ts:127` |
| Default max segment | 7 500 ms (server value minus a 500 ms margin once advertised) | FE controller `:129-131`, `:544-548` |
| Barge-in min speech | 500 ms (while audible) | FE controller `:137`, `:706` |
| Default min speech | 250 ms | FE controller `:144`; CallScreen `:114` |
| AEC warm-up (first reply only) | 3 000 ms | FE controller `:143`, `:684-685` |
| Barge-in settle | 2 000 ms | FE controller `:146` |
| Notice TTL | 8 000 ms | FE controller `:148` |
| Playback progress cadence | 500 ms | FE controller `:150` |
| Pre-ready upload spacing | 120 ms | FE controller `:152` |
| Upload network retry delay | 300 ms (one resend on TypeError) | FE controller `:154`, `:597-608` |
| VAD silence to end turn | 550 ms | FE `CallScreen.tsx:114` |
| VAD pre-roll / trailing keep | 300 ms / 200 ms | FE `voiceVadProcessor.worklet.js:44`, `:48` |
| Capture constraints | `echoCancellation/noiseSuppression/autoGainControl: true` | FE `useMicrophoneCapture.ts:80` |
| Mic upload format | `audio/wav;codec=pcm_s16le`, 16 kHz, mono | FE controller `:1262-1264`; BE `route_voice_call.py:1180-1186` |
| MMS stall fallback | 2 000 ms | FE `voicePlaybackBuffer.ts:44` |
| Remembered cancelled turns | 64 | FE `voicePlaybackBuffer.ts:45` |
| Timing records kept | 64 | FE `callPlaybackTiming.ts:3` |
| Playable sample rates | 22 050 / 24 000 / 44 100 | FE `audioFormat.ts:17` |
| Default call audio | audio/mpeg mp3 44.1 kHz mono | FE `audioFormat.ts:23-28` |
| EL call output format | `mp3_44100_64` (EL v4 turbo, multi-context WS) | BE `services/speech/capabilities.py:65`, `:159` |
| Fish call output | MP3 44.1 kHz 128 kbps | BE `fish_audio/streaming.py:61`, `timestamp_ws.py:212` |
| Server resume grace | 20 s (max 300) | BE `config.py:45-46` |
| Max call duration | 600 s | BE `config.py:31` |
| Idle timeout | 120 s | BE `config.py:32` |
| Server playback frame limit | 4 per s | BE `engine.py:119` |
| Truncation window grace / wait | 2 000 ms / 3.0 s | BE `engine.py:108-109` |
| Flush-ahead gate | 3 free sentences; ≤ 3 unheard sentences and < 8 s audio ahead of reported playback | BE `call_tts_elevenlabs.py:14-21`, `:55-57`, `:148-167` |
| WS close codes | 4401 auth, 4403 origin, 4408 admission / any fatal, 4404 chat not in workspace, 4422 workspace required | FE `voiceSocket.ts:33-50`; BE `admission.py:18-20` |
| `X-MW-Voice-Contract` header | `5` on every REST call | FE `index.ts:1097` |
| Segment upload HTTP timeout | none (no `timeoutMs`) | FE `index.ts:5439-5444` |
| Server HTTP keep-alive | uvicorn default (5 s) — INFERENCE, since `uvicorn.run` sets no `timeout_keep_alive` | BE `serve.py:28-33` |

---

## 4. Latency on the critical path (user stops speaking → first audio heard)

Only the FE transport and playback hops are estimated in detail. Server STT/LLM/TTS are other subsystems and are listed only for continuity.

| # | Stage | Estimate (ms) | Evidence | Notes |
|---|---|---|---|---|
| 1 | VAD silence hang-over | **550 (constant)** | `CallScreen.tsx:114` | Energy VAD; capture subsystem. Largest fixed client cost. |
| 2 | WAV build + SHA-256 (`crypto.subtle.digest`) | 1–5 | `voiceVadWorklet.ts:176-180` | About 64 KB per 2 s utterance. |
| 3 | HTTP connection setup when keep-alive expired | 0 or 50–300 | `index.ts:5418-5445`; BE `serve.py:28-33` | INFERENCE: uvicorn keep-alive 5 s. After a reply over 5 s the next POST needs a new TCP+TLS (1–2 RTT) unless a proxy keeps it warm. |
| 4 | Upload body transfer (whole utterance after the end of speech) | 30–400 | `index.ts:5425-5436` | 2 s speech plus 0.5 s pre-roll/trailing ≈ 80 KB. That is about 64 ms at 10 Mbit/s up and about 320 ms at 2 Mbit/s up. Streaming upload during speech would hide it. |
| 5 | Server admission, form parse, server VAD, STT, LLM TTFT, first sentence, TTS TTFB | (other subsystems) | BE `engine.py:2000-2110`, `2292-2640` | Not estimated here. |
| 6 | Downstream WS one-way for the first `voice_audio_chunk` | 20–150 | BE `delivery.py:212-268` | 0.5 RTT. Base64 adds 33 % bytes (negligible at 64 kbps). |
| 7 | JSON.parse + `atob` + `Uint8Array.from(binary, cb)` | < 2 | `voicePlaybackBuffer.ts:729-732` | Main thread; small chunks. |
| 8 | `appendBuffer` → `updateend` | 1–10 | `voicePlaybackBuffer.ts:386-397` | MediaSource is already open from `voice_turn_start` (prewarmed). |
| 9 | Element start (readyState → `playing`) | 20–150 | `voicePlaybackBuffer.ts:472-494` | INFERENCE: browser dependent. No explicit prebuffer. |
| 10 | Device output latency (not measured) | 10–50 wired/speaker; 100–300 Bluetooth | `callPlaybackTiming.ts:1` | INFERENCE. Not included in any metric. |
| 11 | iOS ManagedMediaSource stall fallback (failure mode) | +2 000 | `voicePlaybackBuffer.ts:44`, `553-564` | Only when MMS never starts. |
| 12 | Blob-group fallback inter-group gaps (non-MSE browsers) | 50–250 per group boundary | `voicePlaybackBuffer.ts:419-436`, `516-524` | INFERENCE: load + decode of each new Blob src. Choppy rather than delayed at start. |
| 13 | Upload network retry (failure mode) | +300 + re-upload | controller `:154`, `:597-608` | One resend on `TypeError`. |
| 14 | Segments queued before `voice_ready` (call start only) | 120 × (n-1) | controller `:152`, `:632-642` | Only the first utterance(s) of a call. |

Approximate FE-attributable budget for a typical turn on a good desktop network: **550 (VAD) + 5 + 60–150 (upload) + 20–150 (down) + 30–160 (append + start) ≈ 0.67–1.0 s**, before any server work. On mobile with an expired keep-alive it is ≈ 0.9–1.5 s.

Other user-felt latencies:
- **Barge-in reaction** (user starts talking → character stops): about 500–550 ms (VAD 500 ms min speech + 128-sample quanta), plus 0 ms local stop. Blocked entirely for the first 3 s of the call's first reply (controller `:137`, `:143`, `:676-687`, `:706`).
- **Dead socket detection**: 50–75 s (`voiceSocket.ts:20-21`, `586-600`).
- **Resume attempts**: 0.5, 1, 2, 4, 4 s within 15 s (`voiceSocket.ts:24-25`, `407-421`, `626-635`).
- **Call setup**: serial chain mic → (draft chat) → consent POST → WS open → voice_start → admission → voice_ready (controller `:1018-1078`), several RTTs plus server admission. UNKNOWN p50.

---

## 5. Findings

Severity: critical / high / medium / low / info.

### FE-PLAYBACK-TRANSPORT-01 — Resume mid-reply leaves a permanent seq gap: the rest of the reply is silent and the turn never ends (high, robustness)

FACT:
- Server: while the socket is away, audio chunks still increment `turn.audio_last_seq` (BE `engine.py:2455`). `send_audio_chunk` records the seq and returns `DROPPED` when `websocket is None` (BE `delivery.py:250-267`). `VoiceDeliveryDisconnected` is also turned into `DROPPED` (BE `engine.py:2486-2487`). Nothing is buffered for replay. `resume_call` only sends a snapshot with `last_audio_seq` (BE `engine.py:991-1003`).
- Client: `voice_resume` carries only `last_segment_seq`, not the last audio seq received (`voiceSocket.ts:394-397`). `last_audio_seq` is never read (grep). The buffer drains **contiguous** seqs only (`voicePlaybackBuffer.ts:360-368`). `finalize` prunes seqs above `last_seq` but does not skip gaps (`:195-203`). `allReceived()` stays false (`:672-674`), so `endOfStream()` never runs (`:400-416`), `ended` never fires and the turn never finishes. `handleStateSnapshot` acts only on `state==='listening'` (controller `:750`).

Failure scenario: the reply is streaming, Wi-Fi blips for 2 s, and resume succeeds with snapshot `assistant_speaking`. Chunks 6–9 were dropped server-side and 10+ arrive. The buffer holds 10+ in `pendingChunks` forever. The user hears the reply stop mid-sentence. The UI keeps showing "speaking": `audiblePlaybackStatus` maps the audible turn's `buffering` to `playing` (controller `:214-220`). `voice_playback` keeps reporting a frozen position, which also freezes the server flush-ahead gate. Auto barge-in stays armed against silence with the 500 ms threshold. The turn recovers only when the user speaks again and a new `voice_turn_start` resets the buffer. A turn whose `voice_turn_start` was dropped during the gap gets `startTurn` from a chunk with seq > 1 (`:185`), so it is never audible at all.

Recommendation: send `last_audio_seq_received` per turn in `voice_resume`. Keep a short server-side ring buffer of outbound frames (for example the last 10–20 s per call, cleared when the turn ends) and replay from that seq. If the server cannot replay, the client should skip the gap: on snapshot or `voice_audio_final`, jump `expectedSeq` past missing seqs, append what is present, and always end the turn. Add a gap timer (for example 1.5 s without progress → finalize at the highest contiguous seq).

### FE-PLAYBACK-TRANSPORT-02 — "Hold uploads while reconnecting" is unreachable, so utterances spoken during a drop produce replies the client never receives (high, correctness)

FACT: `uploadSegment` queues only when `!voiceSessionId || sessionId === null || reconnectingRef.current && lifecycleRef.current !== 'live'` (controller `:567`). `reconnectingRef` is set to true **only while lifecycle is `live`** (`:762-766`). Every exit from `live` goes through `stopLocalResources`, which resets it to false (`:519`). So the third clause is never true. Meanwhile `handleStateSnapshot` calls `flushPendingSegments()` after a resume (`:759`), which shows the queue was meant to hold segments during reconnect.

Failure scenario: the socket drops (status `connecting`, UI "Reconnecting"). The user keeps talking. The segment POST goes out over HTTP (a separate connection, which may work). The server runs the full STT/LLM/TTS turn with `runtime.socket=None`, so `transcript_final`, `voice_turn_start`, deltas and audio are all silently dropped (`_send_to` returns False, BE `engine.py:1946-1956`). The reply is billed and persisted as delivered (`assistant_audio.extend` after `DROPPED`, BE `engine.py:2494-2497`). The user never hears it. If resume lands mid-turn, finding 01 applies.

Recommendation: fix the condition to `reconnectingRef.current || lifecycleRef.current !== 'live'` (queue while reconnecting) and flush after `voice_state_snapshot`. Better still, move mic upload onto the call socket (see 06) so ordering and liveness are shared. On the server, defer a turn's audio while the call has no socket, or replay (01).

### FE-PLAYBACK-TRANSPORT-03 — Dead-socket detection (50–75 s) is longer than the resume windows (client 15 s, server 20 s), so half-open connections can never be resumed (high, robustness)

FACT: ping every 25 s; the socket is declared dead only when `Date.now() - lastFrameAt >= 50 000` on a 25 s tick (`voiceSocket.ts:20-21`, `586-600`). The client resume window is 15 s from detection (`:24`, `:407-421`). The server grace is 20 s from the server's own detection (BE `config.py:45`; `engine.py:1036-1041`, `1838-1853`). The server uses uvicorn defaults (BE `serve.py:28-33`), so ping is 20 s with a 20 s timeout (INFERENCE). There is no `online`/`offline`/`visibilitychange` trigger for the socket (grep: none in voice code).

Failure scenario: a NAT rebinding or a mobile handover silently kills the TCP flow. The server notices in ≤ 40 s and ends the call 20 s later (about 60 s). The client notices at 50–75 s, resumes and gets `not_found`, which is fatal. During that minute the UI says "live". If the user speaks, the HTTP upload may succeed and the reply goes into a dead socket, so they hear nothing.

Recommendation: an application-level ping every 5 s (or `voice_pong` RTT tracking) with a 2-miss threshold of about 10–12 s. React immediately to `navigator.onLine`/`offline`/`online` and to `visibilitychange` (probe on return). Make the server grace at least 30 s and the client window just under it. Record RTT for observability.

### FE-PLAYBACK-TRANSPORT-04 — A `listening` snapshot after resume cancels a reply the user is still hearing, even when it was fully delivered (medium, correctness/ux)

FACT: `if (frame.state === 'listening' && (serverTurnActiveRef.current || playbackStatusRef.current !== 'idle')) playbackRef.current?.cancel(...)` (controller `:750-756`). The server reports `listening` whenever the current turn is finished (BE `engine.py:1866-1869`). TTS streams faster than real time, so the server finishes long before the client stops playing. The test enshrines this ("drops a half-played turn afterwards", `useVoiceCallController.test.ts:565-576`).

Failure scenario: the whole reply is buffered and 6 s of it is still playing. A 1 s network blip and resume returns `listening`. The client cuts the audio mid-sentence and sends no `voice_barge_in`/`played_ms`, so the server keeps the full reply as heard in history.

Recommendation: on a `listening` snapshot, keep playing what is buffered. Finalize the turn at the highest contiguous seq instead of cancelling. If the turn is cut, report `played_ms` (`voice_barge_in` or `voice_playback`) so history matches what was heard.

### FE-PLAYBACK-TRANSPORT-05 — The client E2E latency (speech end → first audible) is computed but never reported; there are no client playback-health metrics (medium, observability)

FACT: `CallPlaybackTiming` emits only a local `performance.mark` (`callPlaybackTiming.ts:28-33`). No consumer exists in `src/` (grep for `FIRST_AUDIBLE_MARK|first_audible` matches only the definition file). Server `user_stop_ttfb_ms = speech_end_lag + route_lead + segment→first chunk handed to the socket` (BE `engine.py:2906-2910`). It misses the request transit before headers arrive (receipt is stamped by a dependency, BE `route_voice_call.py:1125-1130`), the downstream WS transit, append/decode/play-start and output latency. The buffer has no `waiting`/`stalled` listeners (`voicePlaybackBuffer.ts:632-640`), so underruns, MMS fallbacks, Blob fallbacks and decode errors are not counted (the MMS fallback is only a `console.warn`, `:561`).

Impact: the headline realtime KPI (p50/p95 user-stop → audible) cannot be measured in production. Stalls, fallbacks and reconnects are invisible, and tuning (VAD hang-over, prebuffer, ping) is guesswork. Doc 17 lists "slow-playback/disconnect/device acceptance and agreed p50/p95" as still open (`docs/fish_audio_support/17_call_transport_development.md:84-88`).

Recommendation: send a `voice_client_metrics` frame (or batch in `voice_playback`) per turn with `speech_end_to_first_audible_ms`, `turn_start_to_first_audible_ms`, first-chunk-received time, underrun count/duration, playback mode (mse/mms/blob), fallback reason, resume count/duration, ping RTT, and barge-in reaction time. Optionally add `AudioContext.outputLatency` as an estimate. Join on the server by turn_id.

### FE-PLAYBACK-TRANSPORT-06 — Mic audio is uploaded as a whole utterance by HTTP POST after the end of speech, and the turn runs inside that request (medium, latency)

FACT: one multipart POST per VAD segment after `speech_end` (`index.ts:5418-5445`; controller `:564-630`). The whole turn runs inside the request handler (BE `engine.py:2046`, `2092`; `route_voice_call.py:1194-1221`). The client relies on the POST resolving at turn end (controller `:622-628`). There is no timeout on the upload (`index.ts:5439-5444`). The server keep-alive is the uvicorn default (`serve.py:28-33`), 5 s per INFERENCE.

Impact (INFERENCE):
- Upload transfer (30–400 ms) sits fully on the critical path because nothing is sent during speech.
- After any reply longer than about 5 s the HTTP connection may be gone, which adds a TCP+TLS handshake (50–300 ms).
- Streaming/partial STT, server-side or semantic turn detection, and early LLM speculation are impossible because the server sees audio only after the client VAD fired.
- Long turns are exposed to proxy read timeouts.
- The WS liveness and the upload path can disagree (finding 02).

Recommendation: stream 20–40 ms PCM16 or Opus frames over the existing call WebSocket (binary frames) or WebRTC from speech start. Keep client VAD only as a hint. Let the server run streaming STT and a semantic end-of-turn model. Decouple turn execution from an HTTP request, and keep HTTP upload only as a fallback.

### FE-PLAYBACK-TRANSPORT-07 — Barge-in is immediate and destructive, with no false-interruption recovery and an abrupt cut (medium, ux)

FACT: any VAD `speech_start` while audible (≥ 500 ms voiced, after the 3 s warm-up of the first reply) calls `sendBargeIn` (controller `:676-687`, `:907-918`, `:137`, `:143`). It tears down the turn's MediaSource with `audio.pause()` and `removeAttribute('src')` (`voicePlaybackBuffer.ts:573-617`) and asks the server to truncate. The detector is energy-only (worklet RMS gate, `voiceVadProcessor.worklet.js:13-19`). The AEC warm-up is only for the call's first reply (`firstPlaybackAtRef ??=`, controller `:705`).

Failure scenario: a cough, a door, a TV, or echo leaking past AEC on speakers kills the reply permanently, and history is truncated to that point. The cut has no fade, so a click is likely (INFERENCE).

Recommendation (SOTA, e.g. LiveKit `false_interruption_timeout`/`resume_false_interruption`, Pipecat interruption strategies, OpenAI Realtime `interrupt_response` with semantic VAD): on speech start, pause or duck playback but keep the buffer. Confirm the interruption only when the STT returns words (or N words). Otherwise resume from the paused position and do not send truncation. Fade out over 10–30 ms. Consider a word-count or semantic interruption policy, and a backchannel filter ("mm-hm").

### FE-PLAYBACK-TRANSPORT-08 — Control frames are dropped while the socket is reconnecting (barge-in, playback progress, end) (medium, correctness)

FACT: `sendFrame` returns false when not open and nothing is queued (`voiceSocket.ts:245-253`). `sendBargeIn` cancels local playback first and ignores the return value for state (controller `:660-672`).

Failure scenario: the user interrupts during a reconnect. Audio stops locally, but the server never gets `voice_barge_in`. It keeps synthesizing (cost, plus the flush-ahead gate frozen at the last report), persists the full reply as heard, and `voice_cancelled` never comes. The UI clears `barge_in` after 2 s.

Recommendation: queue critical control frames (`voice_barge_in`, the latest `voice_playback` per turn, `voice_end`) and flush them right after `voice_state_snapshot`, or include a "pending interruption {turn_id, played_ms}" in `voice_resume`.

### FE-PLAYBACK-TRANSPORT-09 — Fallback playback paths are choppy or slow: Blob groups gap at every boundary, and MMS failure costs 2 s (medium, audio-quality)

FACT: without MSE (`sink==='blob'` or no MediaSource), every group plays as a separate Blob `src`, and the next group starts only after `ended` (`voicePlaybackBuffer.ts:419-436`, `516-524`). The first group can be a single chunk. With ManagedMediaSource, a 2 s stall timer is the only fallback trigger (`:44`, `:553-564`).

Impact (INFERENCE): each group boundary gives an audible gap (load + decode, about 50–250 ms) and a possible click. iPhones on iOS below 17.1 always take this path. A stalling MMS adds 2 s to the first audio.

Recommendation: for non-MSE browsers, decode MP3 frames through WebCodecs `AudioDecoder` (where available) or `decodeAudioData` on frame-aligned groups. Schedule them gaplessly in an `AudioContext` (or an AudioWorklet ring buffer) with a small jitter target (for example 80–120 ms). Better, have the server offer PCM/Opus for such clients (the `capabilities.media_source_mp3` flag is sent but unused: controller `:1267-1271`; the server is MP3-only, BE `delivery.py:67-69`).

### FE-PLAYBACK-TRANSPORT-10 — No jitter or prebuffer policy and no underrun handling on the MSE path (low, audio-quality)

FACT: `play()` runs as soon as the first chunk is appended (`voicePlaybackBuffer.ts:185-193`). There is no target buffer and no `waiting` listener (`:632-640`).

Impact (INFERENCE): on jittery mobile links, a late second chunk causes a stall with an abrupt cut to silence, then a restart, which the user hears as a stutter. Nothing measures it.

Recommendation: an adaptive start threshold (for example start at ≥ 120–200 ms buffered, or immediately when the network is good). Track `buffered.end - currentTime`. Count `waiting` events, and expose them in metrics (05).

### FE-PLAYBACK-TRANSPORT-11 — `openSocket` replaces a live or connecting WebSocket without closing it (low, robustness)

FACT: `this.detach(this.ws); this.ws = ws` with no `close()` (`voiceSocket.ts:297-298`). `connect()` can be called at any time (`:177-197`). `startCall` has no re-entrancy guard (controller `:995-1090`); only the UI's `isAccepting` protects it (`CallScreen.tsx:162-174`).

Failure scenario: two starts racing (or a programmatic `start` during reconnect) leave an orphaned open socket with detached handlers. The server holds a second admitted call or reservation until it is superseded or idles out. The browser keeps the connection.

Recommendation: in `openSocket`, call `retireSocket()` (close 1000) on any previous `ws` before creating a new one. Add a `startingRef` guard in `startCall`.

### FE-PLAYBACK-TRANSPORT-12 — Socket closures that don't go through `connecting` leave the UI "live" on a dead call (low, robustness)

FACT: an owner change runs `retireSocket()`, which emits only `closed` (`voiceSocket.ts:301-306`, `602-613`). The controller reacts only to `connecting` (controller `:762-766`). The hook closes the socket with 1000 whenever `sessionId`, `authKey === null`, `basePath` or `workspaceId` change (`useVoiceCallSocket.ts:87-154`). The server ends the call immediately on 1000 (BE `engine.py:1028-1035`).

Failure scenario: an account switch, or a transient `token`/`isAuthenticated` flip that makes `sessionId` null (`CallScreen.tsx:101`), closes the socket. The controller stays `live` with no socket and no error.

Recommendation: emit a typed `voice_error` (or `onClosed` with a reason) from `retireSocket` and the effect cleanup, and have the controller end or error the call. Also guard the effect dependencies so they cannot change mid-call.

### FE-PLAYBACK-TRANSPORT-13 — `played_ms` uses `audio.currentTime` and ignores output latency (low, correctness)

FACT: `playedMs = playedBeforeGroupMs + audio.currentTime*1000` (`voicePlaybackBuffer.ts:147-153`, `311-314`). The timing file admits `playing` is only a proxy (`callPlaybackTiming.ts:1`).

Impact (INFERENCE): with Bluetooth (100–300 ms output latency) the server keeps a few words the user had not heard yet. That is minor but systematic.

Recommendation: subtract an output latency estimate (`AudioContext.outputLatency`/`baseLatency` from the capture context, or a per-device calibration) before reporting.

### FE-PLAYBACK-TRANSPORT-14 — Implicit cuts (`voice_ended`, `voice_turn_start` of a new turn, fatal errors) don't report what was heard and cut final words (low, ux)

FACT: `handleEnded` cancels playback (controller `:901-905`, via `stopLocalResources`, `:501-510`). `startTurn` cancels the previous turn without any `played_ms` report (`voicePlaybackBuffer.ts:155-163`).

Impact: when the server ends a call for `max_duration` or `quota` right after sending the last reply, the character's goodbye is cut. When a new turn starts while the old reply is still playing (no barge-in sent, for example echo cancellation off, where auto barge-in is disabled), history keeps the full old reply.

Recommendation: on `voice_ended` for non-user reasons, let the buffered reply finish (bounded, for example ≤ 10 s) before teardown. Send a final `voice_playback` for any turn cut implicitly.

### FE-PLAYBACK-TRANSPORT-15 — Audio is base64 inside JSON text frames (low, cost)

FACT: `data_b64: base64.b64encode(...)` (BE `delivery.py:464`). The client JSON-parses each frame and decodes with `Uint8Array.from(atob(s), cb)` (`voicePlaybackBuffer.ts:729-732`). Binary frames are ignored (`voiceSocket.ts:424`).

Impact: +33 % bytes plus per-frame parse and copy on the main thread. Small at 64 kbps, but avoidable, and it rules out higher bitrates or PCM later.

Recommendation: binary WS frames with a small header (turn id index, seq, flags), or WebRTC audio. If you stay with JSON, decode with a loop or `Uint8Array.fromBase64` where available.

### FE-PLAYBACK-TRANSPORT-16 — Captions are not synced to speech (low, ux)

FACT: deltas are appended to `assistantText` on arrival (controller `:944-948`). Captions are trimmed only afterwards via `kept_chars` (`:832-842`).

Impact: text runs ahead of the voice, which spoils the line and shows words that may never be spoken.

Recommendation: reveal captions by playback position using the server's alignment ledger (send per-chunk character or word offsets with `voice_audio_chunk`, or `voice_alignment` frames).

### FE-PLAYBACK-TRANSPORT-17 — iOS audio session and gain specifics are unhandled (low, audio-quality)

FACT: per-voice gain uses `HTMLMediaElement.volume` (`voicePlaybackBuffer.ts:284-294`). There is no `navigator.audioSession` use and no `setSinkId` (grep: none).

INFERENCE: iOS ignores the element `volume`, so D16 loudness trims don't apply on iPhone. While the mic is active, iOS may route or duck output (play-and-record), so the volume can be low. There is no output-device selection.

Recommendation: route playback through a `GainNode` (`MediaElementAudioSourceNode`) or Web Audio scheduling. Set `navigator.audioSession.type = 'play-and-record'` where supported. Test the speaker route on devices.

### FE-PLAYBACK-TRANSPORT-18 — Any malformed client frame is fatal, and the 4408 fallback copy is misleading mid-call (low, robustness)

FACT:
- Server: unknown or invalid frames raise `conflict` with `fatal=True`, which ends the call with 4408 (BE `route_voice_call.py:320-330`, `1584-1587`). The same 4408 is used for every fatal error after admission.
- Client: the fallback for 4408 is `busy` with "The call could not start" (`voiceSocket.ts:355-361`), even mid-call.

Impact: a client bug in a non-critical telemetry frame such as `voice_playback` would kill live calls. Error copy and categories are confusing.

Recommendation: make non-control frames non-fatal (ignore and log). Use distinct close codes for "fatal protocol error mid-call" and "admission refused", and adjust the fallback copy.

### FE-PLAYBACK-TRANSPORT-19 — The JWT travels in `Sec-WebSocket-Protocol` (low, security-privacy)

FACT: `new WebSocket(url, ['mw.bearer.v1', token])` (`voiceSocket.ts:291`).

INFERENCE: reverse proxies and CDNs that log request headers will store live access tokens. This is common practice but carries that risk.

Recommendation: exchange the bearer for a short-lived, single-use WS ticket via REST, and put only the ticket in the subprotocol. Make sure proxies redact `Sec-WebSocket-Protocol`.

### FE-PLAYBACK-TRANSPORT-20 — Call setup is fully serial (low, latency)

FACT: mic → (draft chat) → consent POST → only then `socket.start(voice_start)` (controller `:1018-1078`). The server then does admission before `voice_ready`.

Impact: time-to-ready includes WS TCP/TLS/auth after the consent RTT. Segments captured meanwhile queue and are spaced 120 ms apart (`:632-642`).

Recommendation: open the WS (and auth) in parallel with the consent save and send `voice_start` when consent resolves. Pre-connect on call-screen mount. Prewarm server-side TTS/LLM connections at `voice_start`.

### FE-PLAYBACK-TRANSPORT-21 — Small unbounded or long-lived state (low, maintainability)

FACT:
- `VoiceSocket.cancelledTurns` and `highestAudioSeqByTurn` grow for the whole call and are cleared only on a new start (`voiceSocket.ts:165-166`, `183-190`, `479-491`).
- `turnBytes` keeps every MSE chunk of a turn after successful playback (`voicePlaybackBuffer.ts:84`, `366`).
- A finished turn's MediaSource and object URL live until the next turn (`finishTurn` doesn't reset, `:545-551`).

Impact: negligible at 600 s calls (about 60 turns, at most a few hundred KB) but unbounded in principle.

Recommendation: bound the maps (as the buffer already does at 64), and drop `turnBytes` once `hasPlayed`.

### FE-PLAYBACK-TRANSPORT-22 — Tests are jsdom/mock only; the risky paths are untested (medium, maintainability)

FACT: the playback tests use `MockMediaSource` and mocked `play`/`pause` (`voicePlaybackBuffer.test.ts:1-3`, `76-90`). The socket tests use `MockWebSocket` (`voiceSocket.test.ts`). There is no real-browser call test (`tests/browser/` has only feature-flag and voice-console scripts). The following have no test: a resume with an audio seq gap, a snapshot while a fully delivered reply plays, `connect()` while a socket is open, underrun/`waiting`, barge-in during reconnect, and the dead `reconnectingRef` upload-queue clause.

Impact: findings 01–04, 08 and 11 slipped through even though there are about 130 well-written unit tests.

Recommendation: add unit tests for those cases. Add a Playwright suite with real Chromium and WebKit using fake media (`--use-fake-device-for-media-stream`), a scripted fake BFF that emits MP3 chunks, and network throttling or drops via CDP, asserting audible continuity (via `timeupdate` progress) and state transitions.

### FE-PLAYBACK-TRANSPORT-23 — Minor protocol leftovers (info)

FACT:
- `voice_status` frames are routed but the controller provides no `onStatus` (controller `:937-955`; `useVoiceCallSocket.ts:104-106`).
- `voice_ready.upload_url` is ignored; the client builds its own path (`index.ts:5439`).
- `capabilities.media_source_mp3`/`audio_worklet` are informational only (the server is MP3-only).
- `ws.onerror` is a no-op (`voiceSocket.ts:391`).
- `transcript_final` is sent only once the LLM turn is admitted (BE `engine.py:2586-2595`), so the user sees "Transcribing" through STT plus LLM admission.

---

## 6. Strengths (done well)

1. **Typed, mirrored, allow-listed protocol**: discriminated unions on the FE (`voice.types.ts:112-250`), strict pydantic (`extra="forbid"`) on the BE (`route_voice_call.py:186-262`), and the same frame allow-list on both sides (`voiceSocket.ts:52-67`; `delivery.py:17-34`).
2. **Stale-frame defence in depth**: per-turn monotonic seq plus cancelled-turn sets at the socket layer (`voiceSocket.ts:448-493`) and again in the buffer (`voicePlaybackBuffer.ts:166-193`, `680-699`). Late chunks of an interrupted turn cannot resurrect "speaking" (controller `:818-820`, tested at `useVoiceCallController.test.ts:375`).
3. **Derived UI state**: `deriveVoiceCallState` builds the state from playback, VAD, turn phase and lifecycle (controller `:207-239`). "Speaking" follows real playback events, not server frames.
4. **Streaming MP3 through MSE with a prewarmed MediaSource**: created at `voice_turn_start` (`voicePlaybackBuffer.ts:155-163`, `316-358`). Decoding happens off the main thread with no per-chunk `decodeAudioData`, and chunks play gaplessly on the main path.
5. **iPhone support**: ManagedMediaSource with `disableRemotePlayback`, `startstreaming`-driven appends, stall detection and a frame-aligned Blob fallback (`:336-342`, `:385`, `:553-564`, `:786-801`).
6. **Autoplay handled properly**: a silent primer inside the gesture before any `await` (controller `:996-997`; buffer `:220-259`), plus an explicit `blocked` state with tap-to-resume.
7. **Truncation to what was heard**: the barge-in carries `turn_id` and `played_ms` read *before* the cancel (controller `:644-673`), and periodic `voice_playback` reports feed both supersede truncation and the server's flush-ahead TTS gate (BE `call_tts_elevenlabs.py:14-21`, `148-167`). That is SOTA-style "truncate to heard" plus cost control.
8. **Immediate local flush on interruption**: it does not wait for a server round-trip (`voicePlaybackBuffer.ts:573-617`).
9. **AEC-aware auto barge-in**: disabled when the track reports no echo cancellation or raw fallback (controller `:678-681`). It uses a 500 ms minimum interruption (LiveKit-like) and a 3 s AEC warm-up.
10. **Resume protocol** with a server grace period, bounded client window, backoff, token refresh on 4401/1006, auth-epoch owner checks and a clear close-code taxonomy (`voiceSocket.ts:325-392`, `500-575`).
11. **Idempotent uploads** (`Idempotency-Key` with seq and SHA) with exactly one safe network resend (controller `:597-608`).
12. **Robust ending**: `voice_end` over WS plus HTTP `voice-end` with `keepalive`, `pagehide` handling, unmount cleanup and a registered active call for workspace switches (controller `:1093-1216`). Wake lock is held during live calls.
13. **Client-side privacy guard** that refuses frames with raw audio or credential keys (`voiceSocket.ts:69-86`, `132-144`).
14. **Latency instrumentation groundwork**: `speech_end_lag_ms` is sent with each upload and first-audible marks are correlated by `segment_seq` (`speechEndLag.ts`, `callPlaybackTiming.ts`).
15. **Bounded per-turn memory** in the buffer and timing (64 entries) and object URL revocation per group or turn.
16. **Broad unit coverage** of the happy paths and many edge cases: about 130 tests across the socket, hook, controller, buffer, format and timing files.

---

## 7. Open questions / UNKNOWN

1. What is the size and duration of the first and subsequent ElevenLabs multi-context MP3 chunks (and Fish chunks)? This sets start latency, Blob-group size and underrun risk.
2. Does each EL `flush: true` sentence begin a new MP3 encoder stream (encoder delay/padding, Xing/LAME info frame) whose concatenation adds micro-gaps under MSE `sequence` mode?
3. Deployment: is there a reverse proxy or CDN in front of the BFF (WS idle timeout, HTTP keep-alive, HTTP/2 for uploads, header logging)? That affects findings 03, 06 and 19.
4. Which browsers are supported (Firefox MSE `audio/mpeg`, Android Chrome, iOS below 17.1 share)? How many calls run the Blob fallback today? There is no metric (05).
5. Does Chrome's or Safari's echo cancellation subtract `<audio>`-element output on all target platforms? Only `getSettings().echoCancellation` is checked.
6. When the client aborts an in-flight segment POST (`abortUploads` on end), does Starlette cancel the turn task, or does the turn run to completion?
7. What happens server-side when the client closes 1000 before `voice_ready` while admission is still running (orphaned reservation)?
8. Is the server's 4-frames/s `voice_playback` limit per turn or per call? The client sends 2/s, so it is fine today.

---

## Verification (adversarial)

A second pass tried to refute each finding below by reopening the cited code and looking for guards, tests or defaults that contradict it. Source code was not modified. Verdicts: **confirmed** means the claim was re-verified in code. **adjusted** means the core issue is real but the severity or a detail was wrong. **refuted** means the code contradicts the claim.

| id | verdict | corrected severity | evidence / note |
|---|---|---|---|
| FE-PLAYBACK-TRANSPORT-01 | confirmed | high | BE `engine.py:2455` increments `turn.audio_last_seq` before `delivery.send_audio_chunk`. `delivery.py:250-267` records the seq and returns `DROPPED` when the socket is `None`, and `engine.py:2486-2487` maps a send failure to `DROPPED`. There is no outbound replay: `resume_call` (`engine.py:940-1009`) only sends a snapshot, and the route (`route_voice_call.py:1073`) does nothing more. FE `voiceSocket.ts:396` resumes with `last_segment_seq` only, and `last_audio_seq` is never read outside `voice.types.ts:186`. `voicePlaybackBuffer.ts:360-368` drains only contiguous seqs, `finalize` (`:195-203`) does not skip gaps, and `allReceived` (`:672-674`) stays false. As a result `endOfStream` and `ended` never fire, and the MSE element just stalls with no `waiting` handler. Recovery comes only from a new turn or a barge-in. Nuance: if only `voice_turn_start` was lost and chunk 1 arrives after the resume, the reply still plays (`appendChunk` starts the turn), so "never audible" applies only when chunks were lost too. The flush-ahead gate (`call_tts_elevenlabs.py:148-167`) can also stall the server turn, because `delivered_ms` counts the dropped audio while the reported playback stops at the gap. |
| FE-PLAYBACK-TRANSPORT-02 | adjusted | medium | The mechanism is exact. In `useVoiceCallController.ts:567` the clause `reconnectingRef.current && lifecycleRef.current !== 'live'` is effectively never true: `reconnectingRef` is set only while `live` (`:762-766`), and every exit from `live` runs `stopLocalResources` (`:519`) in the same synchronous step (`:1095-1102`, `:889-891`, `:902-904`). The only exception is the feature-flag effect at `:990-993`. The server accepts the segment with no socket check (`engine.py:2030-2046`), `_send` returns False when `socket is None` (`:1946-1956`), and the code comment at `:2494` bills and stores the dropped audio. The impact was overstated: whether the user gets no answer depends on timing. If the resume lands before the first audio chunk, the reply plays (captions before the first chunk are lost). If it lands mid-audio, finding 01 applies. The window is limited to the few seconds of backoff in which HTTP works but the WS is still reconnecting, hence medium. |
| FE-PLAYBACK-TRANSPORT-03 | adjusted | medium | The core is verified. `voiceSocket.ts:20-21` pings every 25 s with a 50 s liveness limit, checked only on each tick (`:586-600`), and there are no online/offline/visibility hooks on the socket. The server uses uvicorn 0.35 + websockets 16 defaults (`ws_ping_interval=20`, `ws_ping_timeout=20`, `timeout_keep_alive=5`), because `serve.py:28-33` passes no overrides. The resume grace is 20 s (`config.py:45`, not overridden in `.env.example`). The timing details were wrong. Client detection is 50-75 s after the last frame, so 25-75 s after the drop when the call is idle and about 50-75 s when it is mid-reply. The client's 15 s window starts after detection, so it is not the limit. The real comparison is with the server end time: drop + 20-40 s detection + 20 s grace = 40-60 s. Mid-reply half-open drops therefore mostly fail with `not_found`, while idle ones can still resume. A reverse proxy (UNKNOWN) may change server detection. Only half-open drops are affected; a clean close resumes within the window. |
| FE-PLAYBACK-TRANSPORT-04 | confirmed | medium | `useVoiceCallController.ts:750-756` cancels whenever a `listening` snapshot arrives and `playbackStatusRef !== 'idle'`, even if `voice_audio_final` was received and every seq drained. It sends no barge-in or `played_ms`. The server reports `listening` once `turn.finished` is set (`engine.py:1866-1869`, set at `:2109` when `_run_voice_turn` returns). That can be well before client playback ends: the flush-ahead allows up to 3 sentences or 8 s ahead (`call_tts_elevenlabs.py:14-21`), and the truncation window after `audio_final` (`engine.py:1337-1352`) exists precisely because the turn ends before playback does. The behaviour is deliberate (the test at `useVoiceCallController.test.ts:565-576` asserts the cancel), but it does not tell a fully received turn from one with lost frames. |
| FE-PLAYBACK-TRANSPORT-05 | confirmed | medium | `callPlaybackTiming.ts:28-33` only calls `performance.mark` and nothing reads it (grep: no `PerformanceObserver`/`getEntriesByName`/beacon). The server's `user_stop_ttfb_ms` (`engine.py:2906-2910`) is `speech_end_lag + route_lead + segment_to_audio`, where `route_lead` starts at a route dependency stamp (`route_voice_call.py:1120-1122`). It therefore excludes the time before the request reaches the route, WS downstream transit and client append/play. `_record_first_audio` even runs before the chunk is sent (`engine.py:2458-2470`). The buffer has no `waiting`/`stalled` listener (`voicePlaybackBuffer.ts:632-640`), and fallbacks only reach `console.warn`. |
| FE-PLAYBACK-TRANSPORT-06 | confirmed | medium | `index.ts:5418-5445` uploads multipart with no `timeoutMs` (`request` adds a timeout only when one is given, `:1072`). The turn runs inside the POST (`engine.py:2046`, `:2092`), and the client relies on it resolving (`useVoiceCallController.ts:622-628`). Two small nuances. First, utterances longer than `maxSegmentMs` (7 s) are cut and uploaded while the user is still speaking (`voiceVadProcessor.worklet.js:339-345`), so "nothing is sent while speaking" holds for typical short turns only. Second, uvicorn serves no TLS (`serve.py`), so whether a new TLS handshake happens depends on the TLS-terminating proxy's keep-alive (UNKNOWN). The 5 s figure applies only between the proxy and uvicorn, or in dev. |
| FE-PLAYBACK-TRANSPORT-07 | confirmed | medium | The worklet's energy gate (RMS against an adaptive floor) emits `speech_start` after `minSpeechMs` of voiced audio (`voiceVadProcessor.worklet.js:276-341`), and the controller raises that minimum to 500 ms while a reply is audible (`useVoiceCallController.ts:706`). `maybeAutoBargeIn` then runs `sendBargeIn` (`:676-687`, `:644-673`), which remembers the turn as cancelled and runs `resetActivePlayback` (pause + remove `src`, `voicePlaybackBuffer.ts:573-617`). There is no pause-and-confirm or resume path. The AEC warm-up uses `firstPlaybackAtRef ??=`, so it covers only the call's first reply (`:705`). Clicks are still INFERENCE. |
| FE-PLAYBACK-TRANSPORT-08 | adjusted | low | `voiceSocket.ts:245-253` returns false when the socket is not open and queues nothing (the test 'sends nothing while closed', `voiceSocket.test.ts:569`, asserts this). The local cancel in `sendBargeIn` happens before the send (`useVoiceCallController.ts:660-672`). The impact was overstated in three ways. (a) If the user's words follow, the uploaded segment supersedes the running turn, and `_supersede_heard_prefix` (`engine.py:1414-1445`) truncates it using the last `voice_playback` report, so truncation does happen unless the turn had already published its end. (b) A user end also goes out by HTTP `voice-end` with keepalive (`:1113-1120`), so a lost `voice_end` is covered. (c) Server synthesis stays bounded by the flush-ahead gate, because playback reports freeze. What remains is a pure-noise barge-in, or one after `end_published`, during the few seconds of a reconnect. |
| FE-PLAYBACK-TRANSPORT-09 | adjusted | medium | The core is verified. Blob groups start only from `ended` (`voicePlaybackBuffer.ts:516-524`) with a new `src` each time (`:419-436`). The first group can be a single chunk, because `appendChunk` pumps right away. The server is MP3-only (`delivery.py:67-69`), and `capabilities` is only stored as metadata (`route_voice_call.py:315-316`). One detail was wrong: the 2 s stall timer (`:44`, `:553-564`) is not the only ManagedMediaSource fallback trigger. `NotSupportedError` from `play()` (`:505-507`), an element `error` (`:528-533`), and `addSourceBuffer`/`appendBuffer` exceptions (`:347-351`, `:389-395`) also switch to Blob. The timer is the trigger only for a silent stall, and that costs +2 s. Gap sizes remain INFERENCE, and the share of browsers on the fallback paths is UNKNOWN. |
| FE-PLAYBACK-TRANSPORT-22 | confirmed | medium | The six test files hold 127 `it` cases: socket 26, hook 10, buffer 25, controller 55, timing 3, format 8. They use `MockMediaSource` and mocked `play`/`pause` (`voicePlaybackBuffer.test.ts:1-3`, `:76-90`). No test covers a permanent seq gap, a snapshot while a fully received turn is playing, or a barge-in during a reconnect. The snapshot test (`useVoiceCallController.test.ts:565-576`) asserts the cancel. `tests/browser/*.py` covers voice presets and the admin console only, not calls. `17_call_transport_development.md:84-88` lists slow-playback/disconnect/device acceptance as open. |
