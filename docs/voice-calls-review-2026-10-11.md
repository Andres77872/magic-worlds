# Voice calls review — 2026-10-11

> **Historical review; source/status refreshed 2026-10-14.** Calls remain **WIP default rollout** (`VITE_FEATURE_CALLS_ENABLED=false` in `.env.example`), locally opted in. The original findings/test totals describe the 2026-10-11 MiniMax implementation; current call synthesis is ElevenLabs-only. [Voice current status/roadmap](voice_refactor/00_current_status_and_roadmap.md) owns current availability, remaining gates and TBD work. Source fixes are not deployment or real-device acceptance.

## Current source reconciliation (2026-10-14)

- The call path now uses Groq batch STT, reply-only callbot execution and ElevenLabs multi-context streaming TTS. Retired MiniMax socket/protocol/tuning recommendations below are historical; there is no MiniMax speech fallback.
- The frontend retains 550 ms silence endpointing, buffered/truncated upload handling and playback fallbacks. Client `speech_end_lag_ms` and server `user_stop_ttfb_ms` already add a speech-end/first-server-audio baseline, with admission/first-delta/first-sentence timing. Browser first-audible and full transport measurement, earlier transcript timing, streaming STT/transport and semantic end-of-turn remain acceptance/backlog work; the original suggested savings are estimates.
- Backend effective voice availability is env AND DB, plus provider readiness, owned workspace, attestation/consent, eligibility, quota/budget and moderation gates. The frontend flag alone cannot prove a usable call.
- [15 §13](voice_refactor/15_implementation_plan_and_acceptance.md#13-native-catalog-and-legacy-removal-2026-10-14) records one local diagnostic provider smoke: correct Groq transcript, completed ElevenLabs turn, stored transcript and settlement; 149 ms TTS TTFB and 4.9 s from upload to first audio. That single sample establishes neither end-to-end speech-end-to-audible latency nor P50/P95.
- The local smoke used optional moderation (`VOICE_MODERATION_REQUIRED=false`, classifier off). Required moderation/model latency and deployed-URL smoke remain open. Real iPhone/Firefox checks and the documented single-process delivery constraint must remain visible until evidenced.

This refresh reads source and retains dated evidence; it does not rerun the original tests, alter code, make provider calls or deploy anything.

Scope: the character voice-call feature end to end. The frontend lives in this repo
(`src/features/call/`, `src/features/interaction/{hooks,audio}/`,
`src/infrastructure/api/voiceSocket.ts`, `src/shared/types/voice.types.ts`). The
backend lives in `magic-worlds-api` (`src/routes/user/route_voice_call.py`,
`src/services/voice_orchestration/`).

Method: the frontend was reviewed by reading the code. The frontend and backend
contracts were then compared, and the voice test suites were run (10 files, 70 tests,
all passing). The backend was reviewed in a separate pass, and its two most severe
findings were checked again directly against the code.

## Status legend

| Field | Values |
| --- | --- |
| **Status** | `Open` (not fixed) · `In progress` · `Fixed` · `Partially fixed` · `Documented` (accepted constraint, written down) · `Won't fix` |
| **Verification** | `Reproduced`: shown failing in a test. `Verified`: confirmed by reading the code on both sides that matter. `Reported`: found in the backend review pass with file:line references, not checked again yet. `Verified (fixed with regression tests)`: confirmed against the code before fixing, with tests that fail on the old code. |

Every finding was `Open` as of this review. All of them were worked through the same day, and each finding now has a **Resolution**. See [Fix status](#fix-status-2026-10-11) for the summary and the verification run.

## Summary

| ID | Sev | Area | Finding | Status | Verification |
| --- | --- | --- | --- | --- | --- |
| FE-01 | High | Frontend | Access-token refresh during a call silently kills the call | Fixed | Reproduced |
| FE-02 | High | Front/Back | Client cuts segments at 10 s; the server rejects anything over 8 s | Fixed | Verified |
| FE-03 | High | Front/Back | A second utterance during an in-flight turn gets a 409/500 error | Fixed | Verified (tests on both sides) |
| FE-04 | High | Frontend | Firefox cannot capture audio (16 kHz AudioContext) | Fixed | Verified (code + unit tests). Not yet run in a real Firefox. |
| FE-05 | Medium | Frontend | "Speaking" state follows server frames, not playback; the state falls back to "transcribing" | Fixed | Verified |
| FE-06 | Medium | Frontend | After a barge-in, stale chunks switch the state back to speaking, and a second barge-in is sent | Fixed | Verified |
| FE-07 | Medium | Frontend | Without MediaSource (iPhone), playback restarts on every chunk | Fixed | Verified (code + unit tests). Not yet run on an iPhone. |
| FE-08 | Medium | Frontend | Error UX: errors never clear, raw codes are shown, strings are not translated, mute is disabled during errors | Fixed | Verified |
| FE-09 | Medium | Frontend | The end reason and the call limits are never shown; end-reason types have drifted from the server | Fixed | Verified |
| FE-10 | Medium | Frontend | Muting within the first 3 s can reopen the mic unmuted, with echo cancellation off | Fixed | Verified |
| FE-11 | Medium | Front/Back | Auth failures before ready arrive as 1006, so the client retries and then shows a generic timeout | Fixed | Verified (tests on both sides) |
| FE-12 | Low | Frontend | No pre-roll buffer, so speech onsets are clipped | Fixed | Verified |
| FE-13 | Low | Frontend | The mic level updates React state at ~30 Hz | Fixed | Verified |
| FE-14 | Low | Frontend | Dead code, stale comments, a duplicate state machine, and a useless `voice_segment_meta` round trip | Fixed | Verified |
| FE-15 | Low | Frontend | The voice-end request sent on unmount has no `keepalive` | Fixed | Verified |
| FE-16 | Low | Frontend | The transcript view fetches every audio clip as soon as it opens | Fixed | Verified |
| FE-17 | Low | Frontend | "Call again" always creates a new chat; call history has no pagination | Fixed | Verified |
| FE-18 | Low | Frontend | Queued segments are uploaded in parallel, so their order is not guaranteed | Fixed | Verified |
| FE-19 | Low | Front/Back | Any network blip after ready ends the call (there is no resume) | Fixed | Verified (tests on both sides) |
| BE-01 | High | Backend | All calls share one MiniMax TTS client, so calls cut off each other's audio | Fixed | Verified |
| BE-02 | High | Backend | Quota reservations leak on WebSocket error paths, which permanently locks users as "busy" | Fixed | Verified (fixed with regression tests) |
| BE-03 | High | Backend | Resume ends the very call it resumes; the voice resets; nothing is replayed | Fixed | Verified (fixed with regression tests) |
| BE-04 | High | Backend | Max call duration and idle timeout are never enforced during a call | Fixed | Verified (fixed with regression tests) |
| BE-05 | Medium | Backend | The spoken-text sanitizer rejects digits and symbols, so the whole turn fails | Fixed | Verified (fixed with regression tests) |
| BE-06 | Medium | Backend | A turn that fails midway gets no cleanup and sends no `turn_end` or `voice_error` | Fixed | Verified (fixed with regression tests) |
| BE-07 | Medium | Backend | Segments within one call are not serialized | Fixed | Verified (fixed with regression tests) |
| BE-08 | Medium | Backend | `end_call` changes another user's in-memory state before checking ownership | Fixed | Verified (fixed with regression tests) |
| BE-09 | Medium | Backend | Latency: the last sentence waits for the metadata LLM, TTS blocks the LLM, and every sentence opens a new socket | Fixed | Verified (fixed with regression tests) |
| BE-10 | Medium | Backend | In-memory maps grow without bound | Fixed | Verified (fixed with regression tests) |
| BE-11 | Medium | Backend | A billing read-modify-write race corrupts totals, which then 500s the history endpoints | Fixed | Verified (fixed with regression tests) |
| BE-12 | Medium | Backend | Upload abuse: no body cap, and no per-call in-flight limit | Fixed | Verified (fixed with regression tests) |
| BE-13 | Medium | Backend | Supersede ends the old call before the new call's checks pass | Fixed | Verified (fixed with regression tests) |
| BE-14 | Medium | Backend | No `no_speech_prob` threshold, so Whisper hallucinations start full turns | Fixed | Verified (fixed with regression tests) |
| BE-15 | Medium | Backend | Delivery depends on a single process (the socket map lives in that process) | Documented | Verified (code) |
| BE-16 | Low | Backend | Server-VAD threshold arithmetic bug (`speech_ratio` ≈ 0) | Fixed | Verified (fixed with regression tests) |
| BE-17 | Low | Backend | The Groq STT parser requires an exact set of fields | Fixed | Verified (fixed with regression tests) |
| BE-18 | Low | Backend | MiniMax `recv()` has no timeout | Fixed | Verified (fixed with regression tests) |
| BE-19 | Low | Backend | Zero-duration STT, and concurrent uploads with the same seq, both return 500 | Fixed | Verified (fixed with regression tests) |
| BE-20 | Low | Backend | CPU-bound pure-Python audio loops run on the event loop | Fixed | Verified (fixed with regression tests) |
| BE-21 | Low | Backend | Error mapping: `unavailable` becomes `internal`, `llm_timeout` returns 400, a bad `limit` returns 500 | Fixed | Verified (fixed with regression tests) |
| BE-22 | Low | Backend | TTS is streamed before it is billed; the credit-exhaustion test is misleading | Fixed | Verified (fixed with regression tests) |

Totals: 41 findings — 8 High · 18 Medium · 15 Low.

## Fix status (2026-10-11)

**40 Fixed · 1 Documented (BE-15).** Every High finding is fixed.

- **How the fixes were made.** The High findings were mostly two halves of one contract problem, so client and server were changed together against a shared contract: [protocol v2](#6-protocol-v2-agreed-and-implemented-on-both-sides). Every fix comes with regression tests.
- **Verification run** (after all changes, both repos):

  | Check | Result |
  | --- | --- |
  | Frontend `pnpm build` (typecheck + bundle) | ✅ green |
  | Frontend `pnpm test` | ✅ 239 files, 2,191 tests |
  | Frontend `pnpm typecheck:stories` | ✅ clean |
  | Frontend ESLint on the changed voice files | ✅ clean (only errors already on HEAD remain in untouched code: `no-explicit-any` in `index.ts`, and two `set-state-in-effect` in the calls page and transcript view) |
  | Backend `pytest tests/voice` | ✅ 596 passed (342 before) |
  | Backend `pytest` (full) | ✅ 6,591 passed, 703 skipped; 6 failures in `tests/test_integration.py::TestAuthProxyChain` (register/login 422) **also fail on a clean checkout of HEAD**, so they predate this work |
  | Call screen in Storybook (desktop + 375×812) | ✅ checked the end panel, notices and the tap-to-listen prompt; fixed the end panel and notices scrolling out of view on short screens, and a long error code overflowing the screen |

- **Integration bugs found while wiring the two sides** (fixed, with tests):
  - The server's new C3 auth frame (`voice_error{auth_required}` sent *before* the 4401 close) reached the call first and tore it down. The close-driven refresh never ran, so a resume with an expired token killed the call. `VoiceSocket` now leaves `auth_required` to the 4401 handler.
  - Segment seq restarted at 1 after internal capture restarts, and two back-to-back segments could share a seq. The server rejects a reused seq.
  - After a barge-in, a late `voice_cancelled` or `voice_turn_end` left the screen stuck on "Thinking". The controller now tracks the server turn by id.
  - A failed turn produced three notices (typed error, `turn_end{failed}`, HTTP error); the generic ones overwrote the specific one. The first, most specific notice now wins.
  - Emoji ZWJ sequences (🧙‍♀️) still failed the whole turn in the relaxed sanitizer. Joiners are now allowed inside emoji sequences only.
  - In dev, React StrictMode re-mounted the controller with a disposed playback buffer, so "Speaking" never fired. The buffer is now owned per mount.
  - **Found in live testing:** after BE-09 (one MiniMax task per turn, one `task_continue` per sentence), every sentence ends with an `is_final` frame whose `data.audio` is empty. The strict parser called that malformed hex and failed the turn (`VOICE_UPSTREAM_CONTRACT`, "malformed MP3 hex audio"). MiniMax documents `data` as nullable, and its sample plays `audio` only when non-empty. Frames without audio (`data: null`, `{}`, `audio: ""`/`null`) now carry no audio, and the documented `subtitle` sibling is accepted. Non-hex audio and alias keys are still rejected.
- **Not yet verified on real devices:** Firefox capture (FE-04) and iPhone playback (FE-07) are covered by unit tests and the documented browser behaviour, but they have not been run on real hardware. An end-to-end call against live Groq and MiniMax was not run.

---

## 1. How the feature works

1. **Start.**
   - The Calls page, a gallery card, or the chat header calls `useStartCall`.
   - `useStartCall` creates a local draft chat. A persona picker opens first if the character has no default persona.
   - It then calls `resumeCharacterChat(chat, { mode: 'voice' })`, and `CharacterChat` mounts `CallScreen`.
2. **Consent and connect** (`useVoiceCallController.startCall`).
   - Calls `getUserMedia` with AEC, NS and AGC on.
   - Creates a 16 kHz `AudioContext` and the `voice-vad-processor` AudioWorklet.
   - `ensureSession` creates the chat, then the client sends `POST /character-chats/{id}/voice-consent`.
   - Opens the WebSocket at `/character-chats/{id}/ws-voice`, with the bearer token passed through the `mw.bearer.v1` subprotocol.
   - Sends `voice_start` and waits up to 15 s for `voice_ready`.
3. **User turn.**
   - The worklet uses RMS-energy VAD: threshold 0.01, at least 250 ms of speech, 800 ms of silence ends the turn, and a 10 s cap.
   - Each segment becomes a WAV (PCM16, 16 kHz, mono) plus a sha256.
   - The client sends `voice_segment_meta` over the WebSocket, then a multipart `POST /character-chats/{id}/voice-segments` over HTTP. The WebSocket never carries audio.
4. **Server turn.** It runs entirely inside the segment POST handler:
   - It validates the WAV, then transcribes it with Groq `whisper-large-v3`.
   - It runs the `callbot` LLM graph: streaming output plus a non-streaming metadata LLM.
   - A sentence buffer feeds MiniMax `speech-2.8-turbo`, with one provider WebSocket per sentence.
   - Frames are pushed to the call's socket: `transcript_final`, `voice_turn_start`, `voice_assistant_delta`, `voice_audio_chunk` (base64 MP3, 32 kHz), `voice_audio_final`, `voice_turn_end`.
   - The POST only returns when the turn is complete.
5. **Playback.**
   - Audio plays through `VoicePlaybackBuffer`: a MediaSource `audio/mpeg` SourceBuffer, with a Blob-URL fallback.
   - **Barge-in:** a VAD `speech_start` while the state is `assistant_speaking` cancels playback locally and sends `voice_barge_in`. The server cancels the LLM and TTS and replies `voice_cancelled`.
6. **End.**
   - The client sends a `voice_end` frame and `POST /voice-end`.
   - A socket disconnect also ends the call on the server.
   - The client has no post-ready reconnect.
7. **Billing.**
   - Credits are charged at 1 per 10 s of combined STT and TTS audio, with idempotent ledger keys.
   - The daily quota is reserved at start (up to 600 s) and reconciled at the end.
8. **History.**
   - `GET /voice-calls` and `GET /character-chats/{id}/calls` list calls.
   - `GET /voice-calls/{id}/transcript` returns the user's STT text and the assistant's text with its saved TTS MP3.
   - Raw microphone audio is never stored, only its sha256.

### Contract notes (frontend ↔ backend)

> This table describes the contract **as reviewed**. The current contract is
> [protocol v2](#6-protocol-v2-agreed-and-implemented-on-both-sides).

| Topic | Backend behaviour | Frontend impact |
| --- | --- | --- |
| Segment length | 250–8000 ms (`config.py:32`); the consent response returns `max_segment_duration_ms` | Client caps at 10 s and ignores the limit → FE-02 |
| `started_at_ms` | Must be 0..86,400,000 | OK: the worklet sends time relative to call start |
| `vad_json` | `speech_ms`/`silence_ms` must be integers | OK: values are `Math.round`ed |
| Upload response | Returns only after STT, LLM and TTS finish; `status` is never `"received"` | Triggers the state regression in FE-05 |
| `voice_status` | Only `listening` and `uploading_segment` are ever sent | The controller ignores `voice_status` (fine) |
| `voice_turn_end.status` | `failed` is never sent; failures surface as HTTP errors | The client's `failed` branch is dead code |
| `voice_ended.reason` | Sends `user`, `quota`, `superseded`, `disconnected`; never `idle_timeout`, `max_duration` or `server_shutdown` | The type union is out of date → FE-09 |
| `voice_ready.limits` | `remaining_voice_credits` / `seconds_per_credit` are dropped | Optional in the client types; not used |
| Close codes 4401/4403 | Sent before accept, so the browser sees 1006 | The client's auth-recovery path never runs → FE-11 |
| Client frames | Strict pydantic models with `extra="forbid"`; anything unknown is fatal (4408) | The client's frames currently match |

---

## 2. Frontend findings

### FE-01 — Access-token refresh during a call silently kills the call

- **Status:** Fixed (2026-10-11) · **Severity:** High · **Verification:** Reproduced
- **Location:**
  - `src/features/interaction/hooks/useVoiceCallSocket.ts:162`: the effect depends on `authKey`.
  - `src/features/call/components/CallScreen.tsx:50`: `authKey: token ?? null`.
  - `src/app/providers/AuthProvider.tsx:125`: `setToken` runs on every `auth:refreshed`.
- **Problem:** access tokens live 15 minutes. Any refresh replaces the token, which re-runs the effect:
  - The live `VoiceSocket` is closed with code 1000.
  - A new one is constructed but never connected, because `pendingStartRef` is empty.
  - The backend ends the call when the socket disconnects.
  - The controller is never told, so the UI stays on "Listening".
  - The next upload is rejected with `call_not_active`.
- **Trigger:** a call crosses the token's expiry, or any other part of the app triggers a refresh.
- **Fix:** follow `useAdventureChatSocket.ts:180-184`. Gate only on `authKey === null`, and let the socket read the stored token fresh. Replace the test at `useVoiceCallSocket.test.ts:171`, which pins the current wrong behaviour.
- **Resolution:**
  - `useVoiceCallSocket` now depends on `authDisabled` (`authKey === null`) instead of the token value. A rotated token leaves the live socket alone. `VoiceSocket` still reads the stored token fresh on each connect, and the backend only authenticates the handshake (`route_voice_call.py:844`).
  - The old test was replaced with two new ones:
    - The socket survives a rotation mid-call: no close, no second socket, `voice_session_id` and state kept.
    - The socket closes when auth becomes unavailable.

### FE-02 — Client cuts segments at 10 s; the server rejects anything over 8 s

- **Status:** Fixed (2026-10-11) · **Severity:** High · **Verification:** Verified
- **Location:**
  - `src/features/interaction/audio/voiceVadProcessor.worklet.js:50`: `maxSegmentMs` defaults to 10000.
  - `CallScreen.tsx:55`: does not override it.
  - `magic-worlds-api/src/services/voice_orchestration/config.py:32`: `DEFAULT_VOICE_MAX_SEGMENT_DURATION_MS = 8_000`.
- **Problem:** each segment also carries up to 800 ms of trailing silence. Any utterance longer than about 7.2 s is rejected as `unsupported_media`, and the state becomes `error` with the raw reason text.
- **Fix:** read `max_segment_duration_ms` from the consent response, which needs adding to `VoiceCallLimits`. Pass it, minus a margin, into the VAD's `maxSegmentMs`.
- **Resolution:**
  - Contract C1: the server cap is now 30 s, advertised as `max_segment_duration_ms` in both the consent response and `voice_ready.limits`.
  - The controller calls `capture.configure({ maxSegmentMs: max - 500 })` from both responses (`applySegmentLimit`). Before the server answers, it uses `VOICE_VAD_DEFAULT_MAX_SEGMENT_MS` = 7.5 s.
  - Tests: `useVoiceCallController.test.ts` ("caps VAD segments below the server limit").

### FE-03 — A second utterance during an in-flight turn gets a 409/500 error

- **Status:** Fixed (2026-10-11) · **Severity:** High · **Verification:** Verified (tests on both sides)
- **Location:**
  - `src/features/interaction/hooks/useVoiceCallController.ts:330-351`: auto barge-in only fires when the state is `assistant_speaking`.
  - `src/features/interaction/hooks/useVoiceCallController.ts:195-239`: there is no per-call upload serialization.
- **Problem:** a pause of more than 800 ms mid-thought splits the speech into two segments. Segment N+1 is uploaded while turn N is still in STT or LLM admission. The server answers `CHAT_CONVERSATION_BUSY` (409, mapped to `conflict`) or raises a ValueError (500). STT is billed either way. This will happen often in natural conversation.
- **Fix:** pick one policy and implement it on both sides. Either cancel the previous turn (barge-in during `transcribing`/`assistant_thinking` too), or hold and merge segments until the turn ends.
- **Resolution:**
  - Contract C2 ("supersede and merge"). The server serializes intake and turns per session. A new non-empty transcript cancels the in-flight turn and carries forward its un-admitted text, so 409/500 can no longer happen (see BE-07).
  - The client uploads every segment immediately. It treats `status:'cancelled'` as part of the next turn rather than as an error.
  - It sends `voice_barge_in` only while assistant audio is audible.
  - The controller follows the server turn by `turn_id`. A cancelled or superseded turn's late `voice_cancelled`/`voice_turn_end` can no longer settle the turn that replaced it.

### FE-04 — Firefox cannot capture audio

- **Status:** Fixed (2026-10-11) · **Severity:** High · **Verification:** Verified (code + unit tests). Not yet run in a real Firefox.
- **Location:**
  - `src/features/interaction/hooks/useMicrophoneCapture.ts:166-192`.
  - `voiceVadProcessor.worklet.js:39`.
- **Problem:**
  - Firefox does not allow connecting a getUserMedia stream to an `AudioContext` with a non-default sample rate. `new AudioContext({ sampleRate: 16000 })` succeeds, then `createMediaStreamSource` throws.
  - The `try/catch` only covers the constructor, so capture ends as `unsupported`.
  - The worklet's fallback downsampler uses an integer ratio. At 44.1 kHz, `round(2.76) = 3`, so the audio is really 14.7 kHz while labelled 16 kHz, which shifts pitch and speed.
- **Fix:**
  - On a `createMediaStreamSource` failure, rebuild the context at the default rate.
  - Resample properly in the worklet: a fractional-step linear or polyphase resampler with a low-pass filter.
- **Refs:** [Firefox mochitest `test_getUserMedia_nonDefaultRate.html`](https://searchfox.org/firefox-main/source/dom/media/webrtc/tests/mochitests/test_getUserMedia_nonDefaultRate.html)
- **Resolution:**
  - `useMicrophoneCapture` still asks for a 16 kHz context first, so Chrome and Safari do the resampling. When `createMediaStreamSource` throws (Firefox ≤ 147 / ESR 140), it closes that context and rebuilds it at the device rate.
  - The worklet resamples any input rate to 16 kHz with a 33-tap windowed-sinc low-pass filter (7.2 kHz cutoff) and fractional-step interpolation, with filter state carried across render quanta. Measured: about −1.5 dB at 6 kHz and more than 54 dB of rejection above 10 kHz. 16 kHz input passes through unchanged.
  - Tests: `voiceVadProcessor.worklet.test.ts` (44.1/48 kHz duration and pitch stay correct), `useMicrophoneCapture.test.ts` (the Firefox `NotSupportedError` path).

### FE-05 — "Speaking" state follows server frames, not playback

- **Status:** Fixed (2026-10-11) · **Severity:** Medium · **Verification:** Verified
- **Location:** `useVoiceCallController.ts:229` sets `transcribing` when the HTTP upload resolves; `:292-301` handles `handleTurnEnd`.
- **Problem:**
  - `voice_turn_end` arrives as soon as the server finishes sending, while local audio is still playing.
  - The upload POST resolves only after the whole turn, and then sets the state to `transcribing`.
  - The result: the UI says "Transcribing" while the character is audibly talking, the Interrupt button disappears, and auto barge-in is disabled for the rest of the playback.
- **Fix:**
  - Derive `assistant_speaking` from the audio element's `playing`/`ended` events.
  - Apply the HTTP result only if the state is still `uploading_segment`.
- **Resolution:**
  - The visible state is now derived from one function, `deriveVoiceCallState`, which takes lifecycle, reconnecting, barge-in, user speech, playback status and turn phase. "Speaking" follows actual playback via `VoicePlaybackBuffer.addStateListener` (`playing` comes from the media element's `playing` event, or when `play()` resolves).
  - A late upload response or `voice_turn_end` can no longer move a playing reply back to "Transcribing".
  - A buffer stall mid-reply, after audio was heard in the same turn, still counts as speaking, so the Interrupt button no longer flickers.
  - Tests: "derives speaking from playback, not from server frames (FE-05)"; "does not interrupt a reply that is only buffering, but treats a mid-reply stall as speaking".

### FE-06 — After a barge-in, stale chunks switch the state back to speaking

- **Status:** Fixed (2026-10-11) · **Severity:** Medium · **Verification:** Verified
- **Location:** `useVoiceCallController.ts:281-286`.
- **Problem:** after a local barge-in, chunks already in flight for the cancelled turn still call `updateState('assistant_speaking')`, even though `appendChunk` drops them and returns `false`. A later `speech_start`, for example after the 10 s cut, then sends a second `voice_barge_in`.
- **Fix:** update the state and the active turn only when `appendChunk` returns `true`, or when the turn is not in a local cancelled set.
- **Resolution:**
  - `handleAudioChunk` changes state and the active turn only when `appendChunk` returns `true`. The buffer drops chunks of cancelled turns, and `startTurn` ignores a cancelled turn.
  - Test: "ignores stale chunks of an interrupted turn instead of resurrecting speaking (FE-06)" also checks that a later utterance does not send a second barge-in.

### FE-07 — Without MediaSource, playback restarts on every chunk

- **Status:** Fixed (2026-10-11) · **Severity:** Medium · **Verification:** Verified (code + unit tests). Not yet run on an iPhone.
- **Location:** `src/features/interaction/audio/voicePlaybackBuffer.ts:109-123, 154-159`.
- **Problem:** iPhone Safari exposes `ManagedMediaSource`, not `MediaSource`, so it takes the fallback path. The fallback rebuilds a Blob URL and reassigns `audio.src` for each chunk. That resets `currentTime` to 0, so the start of the reply repeats.
- **Fix:** use `ManagedMediaSource` when available. Otherwise play chunks sequentially, e.g. decode each sentence with Web Audio, or buffer until `voice_audio_final`. Also surface a rejected autoplay instead of swallowing it (`:161-170`).
- **Resolution:**
  - Playback tries `MediaSource` first. It then tries `ManagedMediaSource`, with `disableRemotePlayback` set and appends only while `streaming`; if nothing plays within 2 s it falls back to the Blob path.
  - The last resort plays sequential Blob groups split on whole MP3 frames, so playback no longer restarts from 0 on every chunk.
  - A rejected autoplay now produces a `blocked` state. The call screen shows a "Tap to hear …" button, which calls `resume()`; `unlock()` runs synchronously inside the Start click.
  - Tests: `voicePlaybackBuffer.test.ts` (15 tests).

### FE-08 — Error UX

- **Status:** Fixed (2026-10-11) · **Severity:** Medium · **Verification:** Verified
- **Location:** `useVoiceCallController.ts:226, 261, 402`; `src/features/interaction/voiceCallLabels.ts:11-22, 75`; `voiceSocket.ts` messages.
- **Problems:**
  - Errors are only cleared in `startCall`. A transient error stays on screen for the rest of the call.
  - Rejection reasons show as raw codes (`no_speech`, `too_long`, `call_not_active`), because `callErrorCopy` falls back to `error.message`.
  - Several user-facing strings are hard-coded in English and skip i18n (the `es` locale exists).
  - `error` is not in `ACTIVE_CALL_STATES`. During a non-fatal error the call keeps running, but Mute is disabled and the timer is hidden.
- **Fix:**
  - Clear non-fatal errors on the next successful frame.
  - Map the rejection reasons to i18n keys.
  - Keep non-fatal errors in an "active" state.
- **Resolution:**
  - Non-fatal errors are notices. They clear themselves after 8 s, can be dismissed, are cleared by the next transcript, and never stop the call or disable Mute.
  - Every code and category maps to an i18n key in both EN and ES (`voiceCallLabels.ts`). Raw provider messages and rejection reasons are never shown.
  - `no_speech` and `too_short` rejections are silent.
  - Fatal errors show on the end-of-call panel with their code, plus "Call again" and "Back to chat".
  - On short screens, notices and the end panel stay pinned above the controls (checked in Storybook at 375×812).

### FE-09 — End reason and limits are never shown

- **Status:** Fixed (2026-10-11) · **Severity:** Medium · **Verification:** Verified
- **Location:** `useVoiceCallController.ts:325` (`handleEnded` ignores `reason`); `src/shared/types/voice.types.ts:166`.
- **Problem:**
  - Quota exhaustion, superseded and disconnected all show a plain "Call ended".
  - `limits` (`max_call_seconds`, `remaining_daily_seconds`) is stored but never rendered, so there is no warning before a limit is hit.
  - The type union lacks `superseded` and `disconnected`, and lists three reasons the server never sends.
- **Fix:** show per-reason copy, add a remaining-time indicator, and sync the union with the server.
- **Resolution:**
  - The end reason is shown on the end panel for all seven reasons (`endReasonCopy`, EN and ES).
  - `remainingSeconds` is derived from `limits.max_call_seconds`, and a "m:ss left" warning shows in the last minute.
  - The `VoiceEndReason`/`VoiceCancelReason` unions match the server (contract C4).
  - Tests: `CallScreen.test.tsx` (each end reason, final-minute warning); controller "reports why the server ended the call", "counts down the remaining call time".

### FE-10 — Muting within the first 3 s can reopen the mic unmuted

- **Status:** Fixed (2026-10-11) · **Severity:** Medium (privacy) · **Verification:** Verified
- **Location:** `useMicrophoneCapture.ts:252-278` (watchdog), `:111-153` (`stop()` resets `isMuted` at `:151`).
- **Problem:**
  - Muting sets `track.enabled = false`, so the level reads exactly 0.
  - The no-input watchdog treats that as a dead stream and restarts capture with raw constraints.
  - `stop()` then sets `isMuted` to false and the new track is live: the mic is open after the user muted it.
  - The raw fallback also disables AEC, so the character's own TTS from the speakers can trigger auto barge-in or be transcribed as user speech.
- **Fix:**
  - Skip the watchdog while muted, and carry the mute state across restarts.
  - In raw mode, disable auto barge-in, or suggest headphones.
- **Resolution:**
  - The no-input watchdog never arms or fires while muted.
  - Internal restarts carry the mute state over: a new track starts with `enabled = !muted`. Only a user-facing `stop()` resets mute.
  - Without echo cancellation (raw fallback, or the browser reports `echoCancellation: false`), auto barge-in is disabled and the screen suggests headphones. Auto barge-in also waits out a 3 s echo-cancellation warm-up after the first reply becomes audible, and asks for at least 500 ms of speech while the character is audible. The manual Interrupt button always works.
  - Tests: `useMicrophoneCapture.test.ts` (mute across a watchdog restart); controller "never auto-interrupts without echo cancellation", "auto-interrupts audible playback after the echo-cancellation warm-up".

### FE-11 — Auth failures before ready end in a generic timeout

- **Status:** Fixed (2026-10-11) · **Severity:** Medium · **Verification:** Verified (tests on both sides)
- **Location:** `src/infrastructure/api/voiceSocket.ts:269-299`; `magic-worlds-api/src/routes/user/route_voice_call.py:838-845`.
- **Problem:**
  - The server closes with 4401/4403 *before* accepting the socket, which ASGI turns into an HTTP 403. The browser sees close code 1006.
  - The client's refresh-and-retry path is never reached. It backs off and reconnects until the 15 s ready timeout, then shows "voice service did not respond".
- **Fix:** have the server accept, send a typed `voice_error`, and then close with 4401/4403. Alternatively, on the client, treat a 1006 before any frame has arrived as a cue to refresh once.
- **Resolution:**
  - Server (contract C3): the socket is accepted first, then the server sends a typed `voice_error {category:'auth'}` and closes 4401/4403.
  - Client: a 4401 before ready, or while resuming, triggers one token refresh and a reconnect. A 1006 before any frame also refreshes once, for older servers. Auth failures show as "Your session expired" instead of a timeout.
  - Test: `voiceSocket.test.ts` ("refreshes the token once on a pre-frame 1006").

### FE-12 — No pre-roll; speech onsets are clipped

- **Status:** Fixed (2026-10-11) · **Severity:** Low · **Verification:** Verified
- **Location:** `voiceVadProcessor.worklet.js:86-92`.
- **Problem:** buffering starts at the first frame above the threshold. Soft leading consonants are lost, which hurts STT accuracy.
- **Fix:** keep a ring buffer of about 200–300 ms and prepend it when speech starts.
- **Resolution:**
  - The worklet keeps a pre-roll ring buffer (`VOICE_VAD_DEFAULT_PRE_ROLL_MS`) and prepends it when speech starts. Pre-roll counts as `silence_ms`, so `speech_ms + silence_ms` equals the duration.
  - It also gained an adaptive noise floor with hysteresis: it learns the floor during the first 400 ms, adapts slowly, and is capped at 0.05. A steady fan or hum no longer produces maximum-length segments.

### FE-13 — The mic level drives React state at ~30 Hz

- **Status:** Fixed (2026-10-11) · **Severity:** Low · **Verification:** Verified
- **Location:** `useVoiceCallController.ts:391`; `voiceVadProcessor.worklet.js:51`.
- **Problem:** `setInputLevel` re-renders the controller and the whole `CallScreen` about 30 times a second.
- **Fix:** push the level into a ref and animate the waveform with `requestAnimationFrame`, or throttle it to about 10 Hz.
- **Resolution:**
  - The worklet posts a throttled level, and `useMicrophoneCapture` forwards it at about 15 Hz, skipping changes under 0.02.
  - The controller adds a second guard: it publishes to React state at most every 80 ms, and silence is always published so the meter never sticks.
  - Tests: "throttles onLevel to ~15 Hz and skips changes under 0.02" and "throttles mic level updates instead of re-rendering on every worklet frame (FE-13)".

### FE-14 — Dead code, stale comments, duplicated state

- **Status:** Fixed (2026-10-11) · **Severity:** Low · **Verification:** Verified
- **Items:**
  - `vadActive` is hard-coded to `true` (`useVoiceCallController.ts:107`), so the `vadDegraded` banner never shows.
  - Several comments still describe the removed MediaRecorder path (`voiceVadProcessor.worklet.js:5-8`, `CallScreen.tsx:114`).
  - `useVoiceCallSocket` keeps its own `voiceState`/`ready`/`error` state machine, which the controller ignores.
  - The `voice_turn_end` `failed` branch is dead code (the server never sends it).
  - `voice_segment_meta` (`useVoiceCallController.ts:204`) only makes the server echo back a `voice_status` that the client ignores.
- **Fix:** delete the unused paths, or wire them up deliberately.
- **Resolution:**
  - Removed:
    - `vadActive` and the `vadDegraded` banner;
    - the MediaRecorder comments;
    - the duplicate `voiceState`/`ready`/`error` state machine in `useVoiceCallSocket`, which is now a typed frame router plus `socketStatus`;
    - the `voice_segment_meta` round trip (contract C6).
  - The `voice_turn_end` `failed` branch is now live: the server sends it when a turn fails (BE-06), and it shows a "That reply failed" notice.
  - The controller also no longer reads refs during render (React Compiler lint is clean for the file).

### FE-15 — The voice-end request sent on unmount has no `keepalive`

- **Status:** Fixed (2026-10-11) · **Severity:** Low · **Verification:** Verified
- **Location:** `useVoiceCallController.ts:521`.
- **Problem:** when the tab closes, the fetch is dropped. The server's disconnect handler covers this today, but the HTTP escape hatch doesn't help in exactly the case it exists for.
- **Fix:** send it with `fetch(..., { keepalive: true })`, and add a `pagehide` handler.
- **Resolution:**
  - `apiService.endVoiceCall(..., { keepalive: true })` is used on unmount and on `pagehide` (when not persisted), together with a socket `voice_end`.
  - The call also holds a screen wake lock while live and re-acquires it on `visibilitychange`.
  - Test: "ends the call with a keepalive request when the page is torn down".

### FE-16 — The transcript view fetches every clip as soon as it opens

- **Status:** Fixed (2026-10-11) · **Severity:** Low · **Verification:** Verified
- **Location:** `src/features/call/components/CallTranscriptView.tsx:27`.
- **Problem:** every assistant line mounts `useAuthenticatedMediaUrl` straight away. A long call means dozens of parallel authenticated MP3 downloads.
- **Fix:** fetch a clip only when the user presses play, or when its line scrolls into view.
- **Resolution:**
  - Each assistant line fetches its clip only once it is within 200 px of the viewport (a one-shot `IntersectionObserver`, the same approach as the lazy `Portrait`).
  - Test: `CallTranscriptView.test.tsx` ("defers fetching a clip until its line nears the viewport").

### FE-17 — "Call again" creates a new chat; history has no pagination

- **Status:** Fixed (2026-10-11) · **Severity:** Low · **Verification:** Verified
- **Location:** `src/features/call/components/CallsPage.tsx:51, 215`; `src/features/call/useStartCall.ts` (`resumeCall` is unused by the page).
- **Problem:** each "Call again" creates a brand-new chat session instead of reusing `chat_id`, which clutters the chat list. The history is capped at 30 calls with no way to load more.
- **Fix:** resume the call's `chat_id` (or offer that choice), and add "load more".
- **Resolution:**
  - "Call again" resumes the call's own chat (`useStartCall.resumeCall`) when it is still in the chat list. Otherwise it starts a new chat with the character.
  - The history pages 30 at a time with "Load more calls", deduplicating by `voice_session_id`; the badge shows "30+" while more exist.
  - Tests: `CallsPage.test.tsx` (resume, fallback, pagination).

### FE-18 — Queued segments are uploaded in parallel

- **Status:** Fixed (2026-10-11) · **Severity:** Low · **Verification:** Verified
- **Location:** `useVoiceCallController.ts:241-247`.
- **Problem:** segments captured before `voice_ready` are flushed with `forEach(void upload)`. They are uploaded concurrently, so they can arrive out of order and collide (see FE-03).
- **Fix:** upload them sequentially, or merge them into one segment.
- **Resolution:**
  - Segments queued before `voice_ready` are uploaded sequentially, 120 ms apart, in seq order. The server also serializes intake per session (C2).
  - Related bug found during the fix: the segment seq restarted at 1 after internal capture restarts, so the server rejected those segments as a reused seq. It also gave two back-to-back segments the same seq. Internal restarts now carry the seq on; only a user-facing start resets it.

### FE-19 — Any network blip after ready ends the call

- **Status:** Fixed (2026-10-11) · **Severity:** Low · **Verification:** Verified (tests on both sides)
- **Location:** `voiceSocket.ts:291-296`.
- **Problem:** after `voice_ready`, any abnormal close is fatal. On mobile, switching networks ends the call. This is deliberate, because the backend's resume is broken (BE-03).
- **Fix:** fix BE-03 first, then implement `voice_resume` on the client.
- **Resolution:**
  - Contract C5. After `voice_ready`, an abnormal close or a missed heartbeat starts a 15 s resume window. `VoiceSocket` reconnects with backoff and sends `voice_resume {voice_session_id, last_segment_seq}` instead of `voice_start`, and the server answers `voice_state_snapshot`. The UI shows "Reconnecting…" meanwhile; a half-played reply is dropped if the server is back to listening.
  - If the window expires, the call ends with `VOICE_CONNECTION_LOST`.
  - Tests: `voiceSocket.test.ts` (resume after a transient close, after missed heartbeats, give up after the window, a fresh call after an ended one sends `voice_start`).

---

## 3. Backend findings (`magic-worlds-api`)

Paths are relative to the `magic-worlds-api` repo.

### BE-01 — All calls share one MiniMax TTS client

- **Status:** Fixed (2026-10-11) · **Severity:** High · **Verification:** Verified
- **Location:** `src/services/voice_orchestration/streaming_tts_minimax.py:120-121, 137-138, 160`; the single client is built in `engine.py` (~1257) and used by every call.
- **Problem:**
  - `_stream_epoch` and `_active_ws` are instance-wide. Whenever any user's sentence starts synthesizing, the epoch is bumped, and every other user's in-flight sentence silently stops (the loop breaks at `:160`).
  - Any user's barge-in or `end_call` closes whichever provider socket started most recently, which may belong to someone else.
- **Fix:** hold cancel state per synthesis (pass a token into `synthesize`), or create one client per call.
- **Resolution:**
  - The MiniMax client keeps no instance-wide `_stream_epoch` or `_active_ws`. Each `synthesize(text, *, turn_id, voice, cancel_event)` owns its cancel state, registered under its `turn_id`, and races every provider wait against the cancel.
  - `cancel(reason, turn_id)` only affects that turn.
  - Tests: two concurrent turns; a barge-in or a new sentence on one does not stop or close the other.

### BE-02 — Quota reservations leak, permanently locking users as "busy"

- **Status:** Fixed (2026-10-11) · **Severity:** High · **Verification:** Verified (fixed with regression tests)
- **Location:** `src/routes/user/route_voice_call.py:948-983`; `src/services/voice_orchestration/quota.py:228-239`.
- **Problem:**
  - The `HTTPException`, `VoiceOrchestrationError` and generic `Exception` handlers call `VoiceSessionModel.end_session` directly, never `engine.end_call` or `quota_service.release_call`.
  - Triggers include an invalid frame, a binary or non-JSON frame, or `VoiceDeliveryDisconnected` while sending a pong or cancel.
  - The `voice_quota_reservation` row survives, and the per-user count has no date filter. Every later start fails with `busy` forever.
  - The global cap (default 8) also fills up, blocking everyone. A process restart leaks reservations the same way.
  - `expire_stale_reservations` / `touch_call` have no production caller.
- **Fix:**
  - Release through `engine.end_call` in a `finally`.
  - Run the stale-reservation sweeper at startup and periodically.
  - Have supersede also release orphaned reservations.
- **Resolution:**
  - Every socket exit path (protocol error, binary or non-JSON frame, delivery failure, disconnect) now ends through `engine.end_call`, which releases the quota reservation.
  - A maintenance task runs at startup and every 60 s. It sweeps stale reservations, and active sessions with no reservation, after a 60 s grace.
  - `touch_call` now runs on `voice_ping` and on every segment.
  - Supersede also releases orphaned reservations.
  - On a protocol error the order is `voice_error` → `voice_ended{disconnected}` → close 4408, and the session is stored as `failed`.

### BE-03 — Resume ends the call it resumes

- **Status:** Fixed (2026-10-11) · **Severity:** High · **Verification:** Verified (fixed with regression tests)
- **Location:** `route_voice_call.py:904-910, 926-938`; `engine.py:587-589`.
- **Problem:**
  - The `WebSocketDisconnect` handler always ends the call. If the client reconnects first, the old socket's later disconnect ends the resumed session.
  - `voice_resume` on an open socket omits `resolved_voice`, so the voice resets to the global default.
  - `last_audio_seq` is always 0, and nothing is replayed.
- **Fix:**
  - End the call only if the socket map still points at *this* socket.
  - Add a grace period.
  - Pass the resolved voice.
- **Resolution:**
  - Contract C5. A non-1000 drop starts a `VOICE_RESUME_GRACE_SECONDS` (default 20) grace timer instead of ending the call.
  - `voice_resume` rebinds the socket and keeps the call's resolved voice, billing state and in-flight turn, then answers `voice_state_snapshot`.
  - Only the session's *current* socket can end the call: a stale socket's late disconnect returns `stale`.
  - Resuming a session that is not live in this process (restart, other instance) returns a fatal `not_found` and releases that orphaned session.
  - Client side: FE-19.

### BE-04 — Max duration and idle timeout are never enforced during a call

- **Status:** Fixed (2026-10-11) · **Severity:** High · **Verification:** Verified (fixed with regression tests)
- **Location:** `route_voice_call.py:359-370, 873-874`; `quota.py`.
- **Problem:**
  - `max_call_duration_seconds` and `idle_timeout_seconds` only size the reservation and fill in `voice_ready`.
  - There is no watchdog and no receive timeout, and the `idle_timeout`/`max_duration` end reasons are never sent.
  - The daily quota is reconciled only at the end, so one call can run until credits run out.
- **Fix:** add a per-call watchdog task.
- **Resolution:**
  - A per-call watchdog (1 s tick) ends the call with `max_duration` at `max_call_seconds`. It ends it with `idle_timeout` after `VOICE_IDLE_TIMEOUT_SECONDS` (default now 120) with no segment or turn activity (heartbeat pings keep the reservation fresh, but do not count as activity).
  - When billable audio reaches the call's reserved seconds, it sends `voice_error{quota_exceeded, fatal}` followed by `voice_ended{quota}`.

### BE-05 — The spoken-text sanitizer rejects instead of repairing

- **Status:** Fixed (2026-10-11) · **Severity:** Medium (high UX impact) · **Verification:** Verified (fixed with regression tests)
- **Location:** `src/services/voice_orchestration/transcript_sanitizer.py:57, 100, 126-127`.
- **Problem:** any digit, any of `/ % + = _ $ @ #`, or a `*` mid-stream fails the whole turn fatally, sometimes after part of the reply was already spoken. "I'm 25" is enough to break a turn.
- **Fix:** normalize the text instead, e.g. turn numbers into words and strip markdown, and tell the callbot prompt to avoid these characters.
- **Resolution:**
  - The validators now accept digits, symbols, Markdown, emoji (including ZWJ sequences such as 🧙‍♀️) and URLs. They still fail closed on control and zero-width characters outside emoji sequences, markup tags (pause markers allowed), chat role markers and special tokens, private payloads, and blank, padded or oversize text.
  - `normalize_text_for_tts` strips written formatting for the provider only; the saved reply keeps the exact completion.
  - MiniMax `task_start` sends `text_normalization_mode: "basic"`, so digits are spoken natively.
  - The callbot prompt also forbids numbered lists (graph hash updated).

### BE-06 — A turn that fails midway gets no cleanup

- **Status:** Fixed (2026-10-11) · **Severity:** Medium · **Verification:** Verified (fixed with regression tests)
- **Location:** `engine.py:802-1033`.
- **Problem:**
  - There is no `try/finally`.
  - On a TTS error, a sanitizer rejection, a metadata-LLM failure or a WebSocket send failure, no `voice_turn_end` or `voice_error` is sent.
  - The `_active_turns` entry goes stale, so later barge-ins target it.
  - Audio that was already sent is never billed.
  - The runner's async generator is never `aclose()`d.
- **Fix:** wrap the turn in `contextlib.aclosing`, and add a `finally` that sends `voice_error` and `turn_end` and pops the turn.
- **Resolution:**
  - The turn runs in `try/finally`, with the runner wrapped in `contextlib.aclosing` and TTS synthesis also `aclosing`.
  - On failure it sends a non-fatal `voice_error` plus `voice_turn_end{failed, partial:true}`. The client keeps the specific server reason rather than letting the generic "turn failed" or HTTP error overwrite it (test: "keeps the specific server reason…").
  - The active turn is always popped, `close_turn` always runs, and audio already delivered is billed.

### BE-07 — Segments within one call are not serialized

- **Status:** Fixed (2026-10-11) · **Severity:** Medium · **Verification:** Verified (fixed with regression tests)
- **Location:** `engine.py` (`accept_segment`, `:957-959`).
- **Problem:**
  - A segment uploaded during turn N's STT or admission gets a 409 `CHAT_CONVERSATION_BUSY`, or overwrites `_active_turns` and causes a 500.
  - STT is billed in both cases.
  - Barge-in has no effect until `VoiceLlmTurnStarted`.
- **Fix:** register the turn and its cancel token at the start of `accept_segment`, and use a per-session lock with cancel-previous semantics. This pairs with FE-03.
- **Resolution:**
  - Contract C2. Intake (validation + STT) and turns are serialized per session. A non-empty transcript supersedes the in-flight turn at any stage and carries forward its un-admitted text (capped at 4,000 characters).
  - An admitted-but-unpublished superseded turn returns `cancelled/superseded`; its text is already in history.
  - Segment rows keep their own text; only the LLM input and `transcript_final` carry the merged text.
  - The old exception at `engine.py` ~957 is gone: callbot re-raises `CancelledError` when reconcile finds no admission.
  - At most 3 segments may be in flight per call; beyond that, 429 `busy` with `retry_after_seconds: 1`.

### BE-08 — `end_call` changes another user's in-memory state before checking ownership

- **Status:** Fixed (2026-10-11) · **Severity:** Medium (mitigated by UUIDv4 ids) · **Verification:** Verified (fixed with regression tests)
- **Location:** `engine.py:1206-1232`; `quota.py:346-425`.
- **Problem:** a `POST voice-end` with another user's `voice_session_id` does all of the following before the user-scoped DB update runs:
  - cancels that user's turn and TTS;
  - releases their reservation;
  - sends `voice_ended` to their socket;
  - wipes their in-memory state.
- **Fix:** load the session, scoped to the owner, before touching anything.
- **Resolution:**
  - `end_call` loads the owner-scoped session before cancelling turns, releasing quota, sending frames or clearing state. A foreign `voice_session_id` gets `not_found` and touches nothing.

### BE-09 — Latency

- **Status:** Fixed (2026-10-11) · **Severity:** Medium · **Verification:** Verified (fixed with regression tests)
- **Location:** `sentence_buffer.py:97-100`; `llm_turn_runner.py:106-115`; `streaming_tts_minimax.py:151-157`.
- **Problem:**
  - The final sentence is held until the completion event, which waits for the metadata LLM. For a one-sentence reply, first audio waits for both LLM calls.
  - TTS runs inline with the queue at `maxsize=1`, so the LLM stream stalls while each sentence is synthesized.
  - Every sentence opens a new MiniMax WebSocket.
- **Fix:**
  - Flush the buffer when the stream ends.
  - Run TTS as its own task fed by a bounded queue.
  - Reuse the provider socket.
- **Resolution:**
  - TTS now runs as its own consumer task fed by a bounded queue (size 4), so the LLM stream no longer stalls while each sentence is synthesized.
  - Each turn reuses one MiniMax socket and task, with one `task_continue` per sentence (see the leaf fixes).
  - The final sentence no longer waits for a metadata LLM: voice calls stopped generating anything after the reply (no metadata role, no suggestions, no image prompt). The engine also speaks a finished last sentence once the reply has been quiet for 120 ms, instead of waiting for the turn to be persisted. Details and the remaining latency work are in [voice-calls-latency-review-2026-10-11.md §7](voice-calls-latency-review-2026-10-11.md).

### BE-10 — In-memory maps grow without bound

- **Status:** Fixed (2026-10-11) · **Severity:** Medium · **Verification:** Verified (fixed with regression tests)
- **Location:** `delivery.py:85-86, 143, 167`; `observability.py:69, 77`; `engine.py:1227-1232`.
- **Problem:**
  - `_last_audio_seq`, `_cancelled_turns` and `observability._events` are never pruned.
  - On normal disconnect, `end_call` raises while sending `voice_ended` to the dead socket, so the in-memory cleanup is skipped.
  - `_send_locks` is not unregistered on the end and error paths.
- **Fix:** prune per call in a `finally`, and send to dead sockets best-effort.
- **Resolution:**
  - Per-call runtime state is pruned in `finally`.
  - Delivery tracking (`_last_audio_seq`, `_cancelled_turns`, send locks) is cleared per turn and per call.
  - Sends to dead sockets are best-effort.
  - Observability keeps at most 2,048 events.

### BE-11 — Billing race

- **Status:** Fixed (2026-10-11) · **Severity:** Medium · **Verification:** Verified (fixed with regression tests)
- **Location:** `engine.py:1054-1113`; `models.py:5441`; `route_voice_call.py:786-793`; `engine.py:1361-1366`.
- **Problem:**
  - `_record_billable_audio` / `_persist_billing_metadata` do read-modify-write without a lock, so concurrent turns over-debit or persist inconsistent totals.
  - The strict validators then raise, and the history list, transcript and resume endpoints return 500.
  - A turn that is still running after `end_call` re-inserts `_call_billing`.
- **Fix:** take a per-call lock, or use atomic SQL increments.
- **Resolution:**
  - Billing state lives on the call runtime, behind a per-call lock, so concurrent turns cannot interleave the read-modify-write, and a turn that finishes after `end_call` cannot re-insert billing state.

### BE-12 — Upload abuse surface

- **Status:** Fixed (2026-10-11) · **Severity:** Medium · **Verification:** Verified (fixed with regression tests)
- **Location:** `route_voice_call.py:584, 602`.
- **Problem:**
  - `request.form()` spools the whole multipart body to disk before the size check, and there is no body-size cap.
  - With no per-call in-flight limit, N parallel uploads mean N Groq calls before any debit is checked.
- **Fix:** cap the request body (`Content-Length`/stream limit), and allow one in-flight segment per call.
- **Resolution:**
  - The upload is checked before the multipart body is parsed: 411 without `Content-Length`, 400 when malformed, 413 above `max_segment_bytes` + 64 KiB.
  - At most 3 segments may be in flight per call (429 `busy`).

### BE-13 — Supersede ends the old call before the new call's checks

- **Status:** Fixed (2026-10-11) · **Severity:** Medium · **Verification:** Verified (fixed with regression tests)
- **Location:** `route_voice_call.py:451`; `engine.py:468-486`.
- **Problem:** the existing call is ended before the credit and global-capacity checks. If the new start then fails, the user has lost both calls.
- **Fix:** run the checks first, then supersede.
- **Resolution:**
  - The credit and global-capacity checks run first; the existing call is superseded only once the new one can start.

### BE-14 — No `no_speech_prob` threshold

- **Status:** Fixed (2026-10-11) · **Severity:** Medium · **Verification:** Verified (fixed with regression tests)
- **Location:** `stt_groq_client.py`; `engine.py` (STT handling).
- **Problem:** `no_speech_prob` is recorded but never used. Whisper hallucinations on noise ("Thank you.") start full LLM and TTS turns, and are billed.
- **Fix:** reject the transcript when `no_speech_prob` is high and the transcript is short, or matches known hallucination phrases.
- **Resolution:**
  - A transcript is rejected (`no_speech_reason`, empty text) when `no_speech_prob > 0.6` AND `avg_logprob < -1.0`, or when `compression_ratio > 2.4`.
  - A hallucination-phrase filter applies only when the whole transcript is one known phrase: credit lines are always dropped; "thank you", "bye" and the like are dropped only when the model is unsure.
  - The raw text is never logged.

### BE-15 — Delivery depends on a single process

- **Status:** Documented (2026-10-11) · **Severity:** Medium (architecture) · **Verification:** Verified (code)
- **Location:** `engine.py:423` (`_sockets_by_voice_session_id`).
- **Problem:** turns run inside the HTTP upload handler and push frames to sockets held in an in-process map. With more than one worker or replica, an upload landing on a different process delivers nothing.
- **Fix:** document the single-process constraint now. Later, use sticky routing or a pub/sub hop.
- **Resolution:**
  - `docs/api_usage/voice.md` now states the constraint: live calls are process-local, so run the voice API as a single process or use sticky routing on `voice_session_id`.
  - The resume grace timer is also in memory, which makes this a hard requirement. A pub/sub hop is the long-term fix (Recommendation 10).

### BE-16 … BE-22 — Low

| ID | Finding | Location | Status |
| --- | --- | --- | --- |
| BE-16 | `int(max(1, min(t, 1.0)) * 32767)` always gives 32767, so `speech_ratio` ≈ 0 and the opt-in energy gate rejects everything. Fix: `max(1, int(min(t, 1.0) * 32767))` | `server_vad.py:179`; `test_server_vad.py:132` doesn't catch it | Fixed: `max(1, int(min(max(t, 0), 1) * 32767))`, plus a threshold table and a test that the strict gate accepts speech. |
| BE-17 | The Groq parser requires an exact field set, so any new provider field breaks all STT | `stt_groq_client.py:179-181, 199, 217, 243` | Fixed: requires only `text`, `duration`, `segments` and the three per-segment scores; other fields are optional but type-checked. |
| BE-18 | MiniMax `recv()` has no timeout, so a stalled provider hangs the upload request | `streaming_tts_minimax.py:313-315` | Fixed: each provider wait has a timeout (15 s to first audio, 10 s between messages) and raises `tts_timeout`. |
| BE-19 | STT duration 0 → ValueError → 500 (`engine.py:753`); concurrent uploads with the same seq → IntegrityError → 500 (`uq_voice_segment_seq`) | `engine.py:753`; `db.sql` | Fixed: a zero-duration STT result is rejected as `no_speech`; a concurrent upload with the same seq returns `duplicate` instead of 500. |
| BE-20 | `_pcm16_stats` / `_mp3_duration_ms` are pure-Python loops on the event loop (the latter runs twice per turn) | `server_vad.py`; `engine.py` | Fixed: `array("h")` + `math.sumprod` (about 2× faster), with exact-parity tests against the old loop. |
| BE-21 | `'unavailable'` is not a public category, so it becomes `internal`; `llm_timeout` returns HTTP 400; history `limit` outside 1..50 → 500 instead of 422 | `callbot_execution.py:308`; `models.py:5977, 6017` | Fixed: errors map to proper statuses (`stt_rate_limited` → 429, timeouts → 504, provider and contract errors → 502, `internal` → 500); history `limit` outside 1..50 or `skip < 0` → 422. |
| BE-22 | TTS chunks reach the client before TTS is billed; `test_credit_exhaustion_ends_call_without_sending_unbilled_tts` only checks the ledger | `engine.py:855-865` vs `969-978` | Fixed: TTS is billed per sentence before it is sent (at most one unbilled sentence in flight); the test was renamed and now asserts this. |

---

## 4. Test coverage (after the fixes)

Every gap listed in the original review now has tests, with one exception: the close codes are still tested through fake sockets, not a real ASGI stack. The main additions:

**Frontend**

- `useVoiceCallController.test.ts` (rewritten, 25 tests) covers:
  - the derived state machine;
  - a late upload or `turn_end` during playback (FE-05), and stale chunks after a barge-in (FE-06);
  - auto barge-in gating (echo cancellation, warm-up, buffering versus audible);
  - the segment limit coming from the server;
  - superseded uploads;
  - notices and end reasons;
  - resume snapshots;
  - `pagehide` keepalive;
  - the remaining-time countdown and the mic level throttle.
- `voiceSocket.test.ts` (19 tests) covers resume after a close or missed heartbeats, the resume window running out, the pre-frame 1006 refresh, the C3 auth frame with 4401 (at start and during a resume), and a fresh `voice_start` after an ended call.
- `voiceVadProcessor.worklet.test.ts` (new) covers resampling at 44.1 and 48 kHz, pre-roll, the max cut including pre-roll, live configure, and the noise floor.
- `voicePlaybackBuffer.test.ts` (15 tests) covers MediaSource, ManagedMediaSource, sequential Blob fallback, blocked autoplay with `resume()`, `unlock()`, and dispose with reuse.
- `useMicrophoneCapture.test.ts` covers the Firefox context rebuild, mute across watchdog restarts, `device_lost`, configure persistence, and seq continuity.
- `CallScreen`, `CallsPage` and `CallTranscriptView` tests cover each end reason, the end panel, dismissible notices, the final-minute warning, tap-to-listen, the headphones hint, call-again resume, pagination, and lazy clips.

**Backend**

- `tests/voice/test_voice_call_lifecycle.py` (new, 33 tests) covers:
  - supersede and merge;
  - resume, the grace period, and disconnects from stale sockets;
  - the watchdog limits;
  - the sweeper;
  - turn cleanup when a turn fails.
- Further coverage across the existing suites:
  - two concurrent turns on the TTS client (BE-01);
  - the relaxed sanitizer, including emoji sequences;
  - Whisper thresholds and the phrase filter;
  - the parser accepting unknown fields;
  - server-VAD threshold arithmetic;
  - parity of the audio stats rewrite;
  - billing per sentence;
  - route status codes;
  - history `limit`/`skip` validation.

**Still not covered:**

- close codes 4401/4403/4408 through a real ASGI stack (the route tests use fake sockets);
- an end-to-end call through a real browser and the live providers;
- multi-instance delivery (BE-15, by design).

---

## 5. Remaining work

1. **Latency.** BE-09 is fixed. The follow-up latency work, applied and deferred, is tracked in [voice-calls-latency-review-2026-10-11.md §7](voice-calls-latency-review-2026-10-11.md). The `magic-worlds-api` and `api.magic_llm` changes must be deployed together.
2. **BE-15.** Keep the voice API on one process, or add sticky routing or a Redis pub/sub hop before scaling out. The in-memory resume grace (C5) makes this a hard requirement.
3. **Device checks.** Make a real call in Firefox (FE-04) and on an iPhone (FE-07, autoplay unlock), and run one end-to-end call against live Groq and MiniMax.
4. **Pre-existing, unrelated to voice:** the 6 `TestAuthProxyChain` failures (register/login → 422) on master.

---

## 6. Protocol v2 (agreed and implemented on both sides)

Several High findings were two halves of one contract problem. The client and server
were changed together to this contract:

| # | Topic | Contract |
| --- | --- | --- |
| C1 | Segment length | The server's default segment cap went from 8 s to 30 s (Whisper's native window; 30 s of PCM16 at 16 kHz is about 960 KB, under the 2 MB byte cap). The server advertises `max_segment_duration_ms` in the consent response and in `voice_ready.limits`. The client cuts segments at that value minus 500 ms, and uses 7.5 s until it hears from the server. |
| C2 | Overlapping utterances: "supersede and merge" | The server serializes intake (validation + STT) and turns per voice session. A new **non-empty** transcript cancels the in-flight turn at any stage. If that turn was not yet admitted (no user message saved), its text is carried forward and prepended, so a sentence split by a pause becomes one turn. A superseded upload returns `200 {status:'cancelled', reason:'superseded'|'end_call'}`. `voice_cancelled.reason` gains `superseded`. `voice_barge_in` only cancels an admitted turn. Empty or rejected segments never cancel anything. |
| C3 | Auth failures before ready | The server accepts the socket, sends `voice_error {category:'auth', code:'auth_required'|'origin_forbidden', fatal:true}`, then closes 4401/4403, so the browser sees a real code instead of 1006. The client also refreshes once on a 1006 before any frame, for older servers. |
| C4 | End reasons and limits | `voice_ended.reason` ∈ `user · quota · superseded · disconnected · idle_timeout · max_duration · server_shutdown`. A per-call server watchdog enforces max duration, idle time (default raised from 30 s to 120 s) and the call's reserved quota. |
| C5 | Resume | After `voice_ready`, an abnormal disconnect no longer ends the call. The server keeps it for `VOICE_RESUME_GRACE_SECONDS` (default 20). The client reconnects within 15 s with `voice_resume {voice_session_id, last_segment_seq}`, and the server answers `voice_state_snapshot`. Only the session's *current* socket can end the call when it disconnects. |
| C6 | Cleanup | The client no longer sends `voice_segment_meta` (the server still accepts it). The HTTP voice-end is sent with `fetch(..., {keepalive:true})` on `pagehide` and unmount. |

## 7. Recommendations (research-backed)

These go beyond the findings. They are ordered by expected impact on how the call
*feels*, and none is required for correctness.

1. **Replace energy VAD with a neural VAD.**
   - The RMS threshold (0.01) is noise-sensitive: fans, music or a TV trigger false turns, and quiet speakers get cut.
   - Silero VAD (`@ricky0123/vad-web`, ONNX in a worklet, about 1 ms per 30 ms frame) is the de-facto standard used by LiveKit, Pipecat and Vapi.
   - Keep the current worklet as the fallback when the model fails to load.
2. **Make barge-in "pause, then confirm".**
   - Today a confirmed `speech_start` of at least 500 ms cancels the reply.
   - LiveKit and Pipecat instead *pause* playback on speech onset. They cancel only if the user keeps talking, and they resume the reply if it was a false interruption: a cough, a "mm-hm", or echo.
   - The playback buffer can already pause, so this only needs a short "resume if no transcript within ~1.5 s" timer plus a server-side "interrupted but resumed" path.
3. **Keep what was actually heard in history.**
   - On barge-in, the assistant message should contain only the text whose audio was played, not the full generated reply. Otherwise the character "remembers" saying things the user never heard.
   - The client knows the played position. Send it on `voice_barge_in` (an optional `played_ms`), and the server can truncate at the sentence boundary.
4. **Lease quota instead of reserving it all at start.**
   - Reserving up to 600 s per call blocks the daily quota of users who make several short calls.
   - Lease 60 s chunks and renew them while the call is active. The watchdog added for BE-04 is the natural place to do this.
5. **Play PCM through an AudioWorklet instead of MP3 through MediaSource.**
   - MSE has about 100–300 ms of startup latency, and it differs between Safari's `ManagedMediaSource` and Chrome. On iOS it needs `disableRemotePlayback`, and it may only append while streaming.
   - MiniMax can return PCM (`format: 'pcm'`). A small ring-buffer playback worklet gives sample-accurate barge-in and the same behaviour on every browser.
   - Keep MP3 for the saved transcript asset.
6. **Use binary WebSocket frames for audio.** Base64 MP3 in JSON adds 33% bandwidth and a decode on the main thread. A binary frame with a small header (turn id, seq) removes both.
7. **Play an earcon while thinking.**
   - For gaps over ~700 ms between the end of user speech and the first audio, a soft "thinking" tone or breath reduces perceived latency (Vapi and Retell both do this).
   - This is cheap to add on the client: start it on `transcript_final`, stop it on the first chunk.
8. **Use preemptive generation.**
   - Start the LLM on the STT result while the endpoint is still being confirmed, and discard it if the user keeps talking.
   - This works together with C2's supersede: the cancel path already exists.
9. **Know the STT billing floor.**
   - Groq bills each request for a minimum of 10 s. Many short segments, such as "yes" or "ok", therefore cost 10 s each.
   - Merging short segments (C2), or a local "too short" gate of about 300 ms, keeps cost honest. Track billed versus actual seconds in observability.
10. **Run in a single process, or add a pub/sub hop (BE-15).**
    - Delivery still assumes the upload handler and the socket live in the same process.
    - Until there is sticky routing on `voice_session_id` or a Redis pub/sub hop, deploy the voice routes with one worker. The resume grace (C5) makes this a hard requirement, because the grace timer is in memory.
11. **Warn before the server ends a call.**
    - The client now counts down the last 60 s itself.
    - A server `voice_status {state:'warning', remaining_seconds}` at T−60 and T−10 would cover quota-based ends too, which the client cannot predict.
12. **Tune the hallucination gate.** The Whisper community thresholds now used (BE-14) are `no_speech_prob > 0.6` AND `avg_logprob < −1.0`, plus `compression_ratio > 2.4`. Collect real call data before tightening them.
