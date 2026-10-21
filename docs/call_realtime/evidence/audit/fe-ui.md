# Audit evidence: frontend call UI/UX (`src/features/call/`)

Subsystem: the user-visible live voice call surface of Magic Worlds and how it consumes
`useVoiceCallController`. Scope: `src/features/call/**` (CallScreen, CallSetup, CallsPage,
CallLiveTranscript, CallTranscriptView/Lines, CallWaveform, CallHistoryRow, liveTranscript,
activeVoiceCall, useStartCall, callVoicePick, callVoiceNote, callLinks, callTransforms) plus
the parts of `src/features/interaction/` the UI reads (controller, labels, consent modal,
VAD tuning that the call screen sets) and a few backend lines needed to explain what the UI
receives.

Audit date: 2026-10-20. Branch `master` (working tree with unrelated local changes). No
source file was modified. A Storybook instance was started read-only to verify the mobile
layout of `CallScreenView` stories at 375 px width (story container height 680 px); it was
stopped afterwards.

Legend: **FACT** = seen in code at the cited line. **INFERENCE** = reasoned from code, not
executed. **UNKNOWN** = not determinable from the code read. **VERIFIED** = observed in the
rendered Storybook story.

Paths: `FE` = `/home/andres/WebstormProjects/magic-worlds`, `BE` =
`/home/andres/PycharmProjects/magic-worlds-api`.

---

## 1. Architecture walkthrough

### 1.1 Entry points and mounting

| Step | What happens | Evidence |
|---|---|---|
| Launch from Calls page / gallery card / landing / chat | `useStartCall().startCall(character)`: requires auth, resolves the default persona (or opens `PersonaPickerDialog`), calls `startCharacterChat(character, persona)` (a local draft), then `resumeCharacterChat(chat, {mode:'voice'})` + `setPage('character-chat')`. | FE `src/features/call/useStartCall.ts:192-229` |
| Resume an existing chat as a call | `resumeCall(chat)` → `launchVoice(chat)` directly (no persona picker). | FE `useStartCall.ts:231-238` |
| Mount | `CharacterChat` renders `<CallScreen>` instead of the text engine when `mode === 'voice'`, keyed by chat id. The call screen lives inside the app shell's `<main>` (sidebar still visible). | FE `src/features/characterChat/components/CharacterChat.tsx:72-89`; `src/app/router/AppRouter.tsx:251` |
| Container | `CallScreen` owns `useVoiceCallController`, the consent gate, the per-character call-voice pick, availability reads, transcript hydration and the `leave()` helper; renders the pure `CallScreenView`. | FE `src/features/call/components/CallScreen.tsx:66-270` |
| View | `CallScreenView` (pure props) renders top bar, stage (avatar, name, AI badge, voice note, status, waveform, captions), notices, crisis panel, break nudge, controls or end panel, privacy footer, consent modal. | FE `CallScreen.tsx:326-652` |
| Active-call registry | Module-level singleton (`registerActiveVoiceCall`) used by the workspace-switch coordinator to end a call and await quota release before committing a switch. | FE `src/features/call/activeVoiceCall.ts:54-103`; `src/app/providers/NavigationProvider.tsx:347-352` |

### 1.2 Call start sequence (what the user sees)

1. CallScreen mounts with `consentOpen = true` (FACT `CallScreen.tsx:71`). The
   `VoiceConsentModal` shows the call setup (voice + conversation model) and six disclosures
   (FACT `VoiceConsentModal.tsx:25`, `:40-98`). Status line under the modal reads
   "Calling {name}…" (FACT `CallScreen.tsx:402`).
2. "I consent and start call" → `acceptConsent()` → `controller.startCall()` (FACT
   `CallScreen.tsx:162-174`). Inside, sequentially (FACT
   `useVoiceCallController.ts:995-1090`):
   - `playbackRef.current?.unlock()` inside the click (iOS autoplay) (`:997`);
   - lifecycle `requesting_permission`, `capture.start()` = `getUserMedia` (`:1023-1024`);
   - `ensureSession()` for a draft chat (POST) (`:1044-1049`);
   - `saveVoiceConsent()` (POST, wrapped by attestation) on **every** start (`:1051-1058`);
   - lifecycle `connecting`, `socket.start(voice_start)` (`:1077-1078`) which opens the
     WebSocket only now (FE `useVoiceCallSocket.ts:156-159`, `voiceSocket.ts:177-196`,
     `:270-305`);
   - 15 s `VOICE_READY_TIMEOUT` watchdog (`:126-127`, `:1081-1088`).
   `startCall` resolves `true` after `voice_start` is sent; the modal closes and the screen
   shows a spinner + "Connecting" until `voice_ready` (FACT `CallScreen.tsx:166-169`,
   `:370`, `:490`).
3. `voice_ready` → `handleReady`: stores limits/audio format/effective voice, starts the
   client call timer, lifecycle `live`, wake lock, flushes queued segments (FACT
   `useVoiceCallController.ts:721-744`). UI: "Listening" + hint "{name} is listening. Say
   hello whenever you are ready." (FACT `CallScreen.tsx:412-413`, `:517-519`;
   `src/app/i18n/locales/en.ts:6148`). The character never speaks first (FACT: no
   greeting/opening-line logic in `BE src/services/voice_orchestration/` — grep for
   `greet|opening|first_message|hello` returned nothing).

### 1.3 Visible state machine

`VoiceCallState` (FACT `src/shared/types/voice.types.ts:35-51`) is **derived**, not set per
frame (FACT `useVoiceCallController.ts:207-239`):

```
lifecycle != live            -> lifecycle (idle | requesting_permission | connecting | ending | ended | error | disabled | consent_required)
reconnecting                 -> reconnecting
bargingIn (≤2 s)             -> barge_in
playback playing|blocked     -> assistant_speaking
userSpeaking (VAD)           -> user_speaking
turnPhase uploading          -> uploading_segment
turnPhase transcribing       -> transcribing
turnPhase thinking|streaming -> assistant_thinking
none + playback buffering    -> assistant_thinking
otherwise                    -> listening
```

Turn-phase transitions (FACT): segment captured → `uploading` (`:578`); `voice_segment_ack`
(received/accepted) → `transcribing` (`:768-774`); `transcript_final` → `thinking`
(`:776-783`); `voice_turn_start` → `thinking` (`:785-800`); first playable audio chunk →
`streaming` (`:825`); `voice_turn_end` / `voice_cancelled` / upload POST resolve → `none`
(`:844-876`, `:619-628`).

Labels (FACT `src/features/interaction/voiceCallLabels.ts:25-42`, `en.ts:5141-5158`):

| State | Label | Avatar ring / status | Waveform tone | Glow |
|---|---|---|---|---|
| requesting_permission | Requesting microphone (spinner) | ember / none | idle | opacity-80 |
| connecting | Connecting (spinner) | ember / none | idle | opacity-80 |
| reconnecting | Reconnecting (spinner) | ember / none | idle | opacity-80 |
| listening | Listening | ember / live (green dot) | ember (mic level) | — |
| user_speaking | Listening | ember / live | ember (mic level) | ember glow, scale 1.03 |
| uploading_segment | Sending audio | ember / none | idle | — |
| transcribing | Transcribing | ember / none | idle | — |
| assistant_thinking | Thinking | arcane / think (pulse) | arcane static | — |
| assistant_speaking | Speaking (speaker icon) | arcane / none | arcane, CSS-animated | arcane glow, scale 1.04 |
| barge_in | Interrupting | ember / none | idle | — |
| ending/ended/error | Ending call / Call ended / Call error | ember | idle | — |

Mapping code: FACT `CallScreen.tsx:366-402`, `:471-496`.

### 1.4 Controls

| Control | Behavior | Evidence |
|---|---|---|
| Mute / Unmute (M key) | `capture.mute()` sets `track.enabled=false`, pauses the liveness watchdog. Button tone turns danger; label toggles. `M` toggles unless focus is in an input; `aria-keyshortcuts="M"`. No `aria-pressed` passed (label carries state). | FACT `CallScreen.tsx:415-428`, `:620-628`; `useMicrophoneCapture.ts:571-589` |
| Interrupt | Only rendered while `state === 'assistant_speaking'`. Calls `controller.bargeIn()` → `sendBargeIn()`: marks the transcript line interrupted, sends `voice_barge_in{turn_id, played_ms}`, cancels local playback, shows `barge_in` for ≤2 s. | FACT `CallScreen.tsx:629-631`; `useVoiceCallController.ts:644-673`, `:1155-1158` |
| End call | `leave()`: races `controller.endCall()` against 400 ms, then `onSwitchToText()` (back to the text chat). | FACT `CallScreen.tsx:199-209`, `:262` |
| Switch to text (top-left) | Same `leave()` — ends the call. | FACT `CallScreen.tsx:263`, `:438-440` |
| Transcript toggle | Shows `CallLiveTranscript` panel (side panel on `lg`, stacked on mobile with a 72 px avatar). | FACT `CallScreen.tsx:452-463`, `:467-547` |
| Tap to hear {name} | Shown when the playback element is autoplay-blocked; `resumePlayback()`. | FACT `CallScreen.tsx:550-556`; `useVoiceCallController.ts:1162-1164` |
| End panel | Replaces controls when `ended`/`error`: reason copy, error code, voice refresh, Call again, Call settings, Show transcript, Back to chat. | FACT `CallScreen.tsx:586-617` |
| Push-to-talk | None by design ("Turn-taking is automatic (VAD) — there is no push-to-talk"). | FACT `CallScreen.tsx:13` |

### 1.5 Live transcript / captions

- Reducer `reduceLiveTranscript` (FACT `src/features/call/liveTranscript.ts:74-124`), fed by
  the controller: `transcript_final` → `user_final` (`useVoiceCallController.ts:781`),
  `voice_turn_start` → `assistant_start` (`:792`), every `voice_assistant_delta` →
  `assistant_delta` (`:944-948`), truncation (`kept_chars`, code points) →
  `assistant_truncate` (`:833-842`), barge-in/cancel → `assistant_interrupted`
  (`:652`, `:861`), `voice_turn_end` → `assistant_end` (`:846`), teardown → `settle`
  (`:515`). Capped at 200 lines (`liveTranscript.ts:43`).
- Captions = last two transcript lines, markup stripped, older line dimmed, "(interrupted)"
  tag (FACT `CallScreen.tsx:405-411`, `:499-521`).
- **Partial (interim) user transcripts do not exist**: the only user-text frame is
  `transcript_final` (FACT `voice.types.ts:197-205`), and the BFF sends it only when the LLM
  turn is admitted (FACT `BE src/services/voice_orchestration/engine.py:2573-2595`), i.e.
  after STT and after the callbot run has started.
- **Assistant text is rendered as soon as each delta arrives**, independent of audio
  playback; audio chunks carry no alignment (FACT `voice.types.ts:208-222`), even though the
  BFF keeps word/char timing ledgers for truncation (FACT `BE
  src/services/voice_orchestration/call_word_ledger.py:12-97`).
- Panel: follow-scroll with "Jump to latest", `role="log"` with `aria-live="off"`, plus a
  separate polite live region that announces only complete lines (FACT
  `CallLiveTranscript.tsx:166-232`, `:235-296`). After the call ends, saved segments are
  fetched once and attach the character's saved audio clip per `turn_id` (FACT
  `CallScreen.tsx:181-197`, `CallLiveTranscript.tsx:186-195`, `:252`, `:272-278`).

### 1.6 Error / limit / safety surfaces

- Error taxonomy: fatal vs non-fatal; non-fatal notices auto-clear after 8 s
  (`NOTICE_TTL_MS`) or when the next `transcript_final` arrives; the first, most specific
  notice wins (FACT `useVoiceCallController.ts:147-148`, `:423-452`). Terminal categories:
  disabled, consent_required, consent_stale, quota_exceeded, auth, not_found (+ code
  `attestation_required`) (FACT `:162-176`, `:878-899`).
- Copy: `callErrorCopy` maps code → key, else category → generic key; never shows raw
  provider text (FACT `voiceCallLabels.ts:62-162`). The raw code is still shown in mono
  next to the copy and on the end panel (FACT `CallScreen.tsx:563`, `:591`).
- Silent rejections: `no_speech` / `too_short` never shown (FACT
  `useVoiceCallController.ts:178-179`, `:550-562`).
- End reasons → copy (FACT `voiceCallLabels.ts:164-180`, `en.ts:6162-6170`).
- Time left: shown in amber in the last 60 s, computed client-side as
  `limits.max_call_seconds - elapsedSeconds` (FACT `CallScreen.tsx:383`, `:444-448`;
  `useVoiceCallController.ts:1232-1234`).
- Redial rules: hidden for workspace errors, CALLS_UNAVAILABLE, `voice_safety_pause`,
  `voice_region_unavailable`, end reason `voice_restricted`; setup errors swap redial for
  "Call settings" (FACT `CallScreen.tsx:375-382`, `voiceCallLabels.ts:95-114`).
- Safety: `CrisisResourcesPanel` on `voice_safety_pause` (generic lines only; named crisis
  lines empty until counsel signs them) (FACT `CallScreen.tsx:574-582`,
  `src/features/safety/components/CrisisResourcesPanel.tsx:1-63`). `BreakNudge` after
  `break_nudge_minutes` of active call time, dismissible, never stops playback (FACT
  `CallScreen.tsx:583`, `src/features/safety/hooks/useBreakNudge.ts:39-80`).
- AI disclosure: "AI voice" badge always in the header (FACT `CallScreen.tsx:484-487`).
- Availability gates before the socket opens: archived workspace and account-level
  `calls_available=false` (FACT `CallScreen.tsx:138-152`).

### 1.7 History

- `CallsPage`: character rail (voice-configured first, personas excluded, search) + recent
  calls (page size 30, load more), deep link `#/calls?call=<id>`, workspace-scoped (FACT
  `src/features/call/components/CallsPage.tsx:29-425`, `callLinks.ts:1-39`).
- `CallHistoryRow`: name, relative time, duration, line count; Open chat / Call again /
  Transcript (FACT `CallHistoryRow.tsx:445-477`, `callTransforms.ts:286-310`).
- `CallTranscriptView`: saved segments; user lines are STT text only; character lines play
  saved TTS lazily (IntersectionObserver, 200 px margin); end-reason badge (FACT
  `CallTranscriptView.tsx:38-182`, `CallTranscriptLines.tsx:202-260`).
- Saved segments carry no interruption flag (FACT `voice.types.ts:308-320`).

---

## 2. Frames consumed by the UI (summary)

| Server frame | UI effect | Evidence |
|---|---|---|
| `voice_ready` | live, timer, limits, audio format, effective voice | `useVoiceCallController.ts:721-744` |
| `voice_state_snapshot` | end reconnecting; drop half-played turn if server is listening | `:746-760` |
| `voice_status` | **ignored** (controller passes no `onStatus`); BFF sends `listening` after ready and `uploading_segment` on `voice_segment_meta` | `useVoiceCallSocket.ts:104-106`; `useVoiceCallController.ts:937-955`; BE `engine.py:929`, `routes/user/route_voice_call.py:1544-1548` |
| `voice_segment_ack` | rejected → notice (unless silent); else `transcribing` | `:768-774` |
| `transcript_final` | user line + `thinking`; clears notices | `:776-783` |
| `voice_turn_start` | open assistant line; `startTurn` on the player | `:785-800` |
| `voice_assistant_delta` | append caption text immediately | `:944-948` |
| `voice_audio_chunk` | substitution reason / voice name; unsupported → text-only note; append to player; `streaming` | `:802-826` |
| `voice_turn_end` | truncate caption by `kept_chars`; settle; failed → notice | `:844-856` |
| `voice_cancelled` | truncate; mark interrupted; cancel playback | `:858-876` |
| `voice_error` | fatal → teardown + error; non-fatal → notice, end turn | `:878-899` |
| `voice_ended` | teardown (cancels playback immediately) + end reason | `:901-905`, `:501-509` |

Client → server frames from UI actions: `voice_start` (with optional per-call voice pick),
`voice_barge_in{turn_id, played_ms}`, `voice_playback` every 500 ms while playing,
`voice_end` (FACT `useVoiceCallController.ts:1255-1273`, `:644-673`, `:492-499`;
`voiceSocket.ts:206-245`).

---

## 3. Configuration and defaults that shape the UX

| Setting | Value | Where | Notes |
|---|---|---|---|
| VAD end-of-turn silence (hangover) | **550 ms** | FE `CallScreen.tsx:114` | Overrides worklet default 800 ms "balanced" / 450 ms "strict" (FE `voiceVadProcessor.worklet.js:224-227`) |
| VAD min speech to open a turn | 250 ms | FE `CallScreen.tsx:114`; `useVoiceCallController.ts:144` | |
| Min speech while the character is audible | **500 ms** | FE `useVoiceCallController.ts:137`, applied `:704-707`, reset `:709-710` | Also the threshold below which the worklet **discards** a segment (FE `voiceVadProcessor.worklet.js:339-342`, `:394`) |
| AEC warm-up (no auto barge-in) | 3000 ms from first playback of the call | FE `useVoiceCallController.ts:143`, `:684-685` | Manual Interrupt still works |
| Barge-in visual settle | 2000 ms | FE `useVoiceCallController.ts:146`, `:666-671` | |
| Non-fatal notice TTL | 8000 ms | FE `useVoiceCallController.ts:148` | |
| Playback progress cadence | 500 ms | FE `useVoiceCallController.ts:150` | |
| voice_ready timeout | 15000 ms | FE `useVoiceCallController.ts:127` | |
| Max segment (client default) | 7500 ms (server limit − 500 ms once announced) | FE `useVoiceCallController.ts:129-131`, `:543-548` | |
| Mic level → React | ≤15 Hz & Δ≥0.02 in capture, then ≤12.5 Hz (80 ms) & Δ≥0.02 in controller | FE `useMicrophoneCapture.ts:86-88`; `useVoiceCallController.ts:159-160`, `:957-964` | Double throttle; cosmetic |
| Waveform | 28 bars, 100 ms transform transition; speaking = CSS keyframe 0.9 s alternate | FE `CallWaveform.tsx:329-366`; `src/ui/styles/theme.css:86`, `:247-255` | Reduced motion collapses animations (`theme.css:301-309`) |
| Live transcript cap | 200 lines | FE `liveTranscript.ts:43` | |
| Follow threshold | 48 px | FE `CallLiveTranscript.tsx:167` | |
| End-call navigation race | 400 ms | FE `CallScreen.tsx:201-204` | |
| Socket heartbeat / liveness | 25 s / 50 s | FE `voiceSocket.ts:20-21`, `:588-597` | Dead connection undetected for up to 50 s |
| Resume window | 15 s (server grace 20 s) | FE `voiceSocket.ts:23-25` | |
| Max call duration | 600 s | BE `config.py:31` | |
| Idle timeout | 120 s | BE `config.py:32` | No client warning before it fires |
| Quota end | `billable_audio_seconds >= reserved_seconds`, `reserved = min(max_call_seconds, daily remaining)` | BE `engine.py:1855-1863`; `quota.py:268` | Client "time left" ignores this |
| Calls page size | 30 | FE `CallsPage.tsx:29` | |
| Call voice pick storage | `localStorage` key `magic-worlds:call-voice:v1` per API origin + account + character | FE `callVoicePick.ts:139-165` | |

---

## 4. Latency on the critical path (user stops speaking → first audio heard), UI-owned parts

The UI subsystem mostly *displays* latency; it owns one big constant (the VAD hangover) and
several perception factors.

| Stage | Estimate (ms) | Evidence | Notes |
|---|---|---|---|
| VAD hangover before the segment closes | **550 (constant)** | FE `CallScreen.tsx:114` | Set by the call screen. Frame granularity ≈ 2.7 ms at 48 kHz (`voiceVadProcessor.worklet.js:186`). UI keeps showing "Listening" during it. |
| Segment upload, STT, LLM, TTS, playback | — | other subsystems | Not owned here. |
| UI → "Speaking" label | ~0 after real `playing` event | FE `useVoiceCallController.ts:222-239`, `:689-717` | Label follows actual playback (good). |
| User's own words visible | hangover + upload + STT + LLM admission (≈ 0.5–1.5 s after hangover, INFERENCE) | BE `engine.py:2573-2595` | No interim transcript; the "You:" caption appears with/after "Thinking". |
| Caption lead over audio | 0.3 s to several seconds (INFERENCE) | FE `useVoiceCallController.ts:944-948` | Text arrives at LLM speed; audio at TTS speed. |
| Interruption (auto barge-in) reaction | ≥ 500 voiced ms (+ up to 3000 ms warm-up on the first reply) | FE `useVoiceCallController.ts:137`, `:143`, `:676-687`; worklet `:339-342` | Local playback cancel is immediate once fired; server cancel 1 RTT later. |
| Manual Interrupt | ~1 frame (local cancel) + 1 RTT (server) | FE `useVoiceCallController.ts:644-673` | Only available while "Speaking". |
| Time to "Listening" at call start | 0.4–2.5 s (INFERENCE), all sequential, + human time in consent modal / permission prompt | FE `useVoiceCallController.ts:995-1090`; `useVoiceCallSocket.ts:156-159` | getUserMedia → ensureSession → saveVoiceConsent → WS open → voice_start → admission → voice_ready. |
| Hang-up to text chat | ≤ 400 | FE `CallScreen.tsx:199-209` | |
| Dead-connection detection | up to 50 000 | FE `voiceSocket.ts:20-21` | During it the UI shows a normal state. |

Per-turn visual sequence (INFERENCE from the derivation): Listening (≥550 ms hangover) →
Sending audio → Transcribing (STT + LLM start) → Thinking (LLM TTFT + TTS TTFB + buffer) →
Speaking. Four label changes per turn in roughly 1–2 s.

---

## 5. Findings

Severity: critical / high / medium / low / info.

### FE-UI-01 — Short interjections while the character speaks are silently dropped (HIGH, ux)
FACT: when playback becomes audible the controller raises the worklet's `minSpeechMs` to
`max(500, vad.minSpeechMs)` (`useVoiceCallController.ts:137`, `:704-707`), and resets it only
when playback goes idle (`:709-710`). The worklet announces `speech_start` only after
`minSpeechSamples` of voiced audio (`voiceVadProcessor.worklet.js:339-342`) and **discards a
segment that never announced** (`:394`, "Discard sub-threshold blips"). Auto barge-in is
triggered from `speech_start` (`useVoiceCallController.ts:907-918`). So "stop", "wait", "no",
"yes" (typically 200–450 ms voiced) said over the character neither interrupt it nor reach
STT. In the first 3 s of the call's first reply auto barge-in is also off (`:143`, `:685`).
Impact: the most natural interruptions fail; the user repeats themselves louder/longer; the
character feels deaf. Recommendation: decouple "interrupt" from "turn admission": duck
output on a short onset (≈150–250 ms) and confirm or resume (false-interruption recovery, as
in LiveKit/Pipecat), keep `minSpeechMs` at 250 for segment capture during playback, and
let the server decide relevance (keyword/short-utterance allow list, semantic check).
Confidence: high.

### FE-UI-02 — Echo-cancellation-off mode: inaccurate hint and no half-duplex / push-to-talk fallback (MEDIUM, robustness)
FACT: with AEC off (raw fallback or `echoCancellation === false`) the client skips the
barge-in frame (`useVoiceCallController.ts:678-681`) but still uploads every captured
segment (`:920-935`), and the BFF cancels the playing reply when any newer segment arrives
("The SPA sends no barge-in frame when echo cancellation is off ... the user's speech arrives
only as a superseding segment", BE `engine.py:1414-1425`, `:2068-2074`). The UI tells the
user "interrupting by voice is disabled" (FE `en.ts:6150`, shown at `CallScreen.tsx:529-534`).
INFERENCE: on speakers, the character's own voice (≥500 ms voiced) re-enters as a "user"
segment, gets transcribed, supersedes the reply, and the character answers itself.
Recommendation: in no-AEC mode, gate capture during playback (+ ~300 ms tail) or offer
tap-to-talk / push-to-talk; fix the copy. Confidence: medium (echo loop not reproduced).

### FE-UI-03 — Captions run ahead of the audio (MEDIUM, ux)
FACT: deltas are appended to captions/transcript immediately (`useVoiceCallController.ts:944-948`,
`CallScreen.tsx:405-411`); audio chunks carry no alignment (`voice.types.ts:208-222`); the BFF
holds word/char timing only for truncation (BE `call_word_ledger.py:12-97`). Impact: captions
"spoil" the line before it is spoken, show sentences that may later be cut by a barge-in,
and break the phone-call illusion. Recommendation: forward alignment (ElevenLabs char
alignment / Fish word segments) or per-sentence start offsets and reveal text by
`playedMs`; at minimum reveal per sentence when its audio starts and dim unheard text.
Confidence: high.

### FE-UI-04 — Mobile layout hides captions behind a fixed 188 px portrait (MEDIUM, ux)
FACT: the stage renders a 188 px avatar unless the transcript is open (`CallScreen.tsx:471-479`),
plus name, badge, status, a 64 px waveform and captions inside an `overflow-y-auto`
container centered with `justify-center` (`:469-521`); nothing scrolls the stage to the
newest caption. VERIFIED (Storybook `LongCaptions`/`CharacterSpeaking` at 375 px × 680 px):
only ~1 caption line is visible above the controls and it is clipped mid-line; the privacy
footer permanently takes two lines. The real app shell may reduce height further (UNKNOWN).
Recommendation: size the portrait by viewport height (`clamp`), cap captions to the last
2–3 lines in a fixed region that keeps the newest text visible, move the privacy line into
the consent/setup sheet or an info icon. Confidence: high.

### FE-UI-05 — Quota UX: no warning before a quota end, and a dead-end "Call again" after it (MEDIUM, ux/cost)
FACT: the BFF ends a call with reason `quota` when `billable_audio_seconds >= reserved_seconds`
where `reserved_seconds = min(max_call_seconds, daily remaining)` (BE `engine.py:1855-1863`,
`quota.py:268`). The client's "time left" warning uses only `max_call_seconds -
elapsedSeconds` (FE `useVoiceCallController.ts:1232-1234`, `CallScreen.tsx:383`), so a user
with 2 minutes left gets no warning. After a quota end, `canRedial` stays true (only
`voice_restricted` is excluded) and "Call again" is the primary button (FE
`CallScreen.tsx:378-380`, `:597-601`) — VERIFIED in Storybook `EndedByQuota`. No billing /
upgrade link is offered; remaining daily minutes (`limits.remaining_daily_seconds`, FE
`voice.types.ts:140-148`) are never shown before or during a call. Recommendation: have the
server send a remaining-seconds hint (or compute from `remaining_daily_seconds`), warn at
T-60 s/T-15 s, hide redial on quota (show retry-after time + "Get more minutes"), surface
remaining minutes on the Calls page and setup sheet. Confidence: high.

### FE-UI-06 — Server-initiated ends cut the character mid-word; no idle warning (MEDIUM, ux)
FACT: `voice_ended` → `stopLocalResources({closeSocket:true})`, whose default cancels
playback immediately (FE `useVoiceCallController.ts:901-905`, `:501-509`). Max duration
(600 s) and idle timeout (120 s) are server defaults (BE `config.py:31-32`); the UI shows
nothing before an idle end. Impact: abrupt silence mid-sentence; a muted or thinking user
is dropped without notice. Recommendation: for non-user ends let buffered audio drain (with
a short cap), have the server produce a short in-character wrap-up before max duration/quota,
and show "Still there?" at idle T-20 s (or let the character check in). Confidence: high.

### FE-UI-07 — No greeting or ringback: the user must speak first into silence (MEDIUM, ux/perceived latency)
FACT: after `voice_ready` the screen only shows "{name} is listening. Say hello whenever you
are ready." (FE `CallScreen.tsx:412-413`, `:517-519`; `en.ts:6148`); no greeting logic in
the BFF voice orchestration (grep). The "connecting" phase has a spinner but no audio
(ringback) cue. Impact: the first exchange pays the full STT+LLM+TTS latency with nothing to
hide setup; it feels less like a call. Recommendation: per-character cached greeting
(pre-rendered TTS, played on `voice_ready`), optional ringback/earcon during connect.
Confidence: high.

### FE-UI-08 — Status line exposes pipeline internals and flickers; thinking cue missing during upload/STT (MEDIUM, ux)
FACT: labels "Sending audio" / "Transcribing" / "Thinking" / "Speaking" (FE
`voiceCallLabels.ts:25-42`, `en.ts:5141-5158`); in `uploading_segment` and `transcribing`
the avatar status is `none` and the waveform is `idle` (FE `CallScreen.tsx:391-401`), so the
UI looks idle right after the user stops; only `assistant_thinking` pulses. No audible
"thinking" cue exists. INFERENCE: 4 label changes per turn within ~1–2 s. Recommendation:
collapse to Listening / Thinking / Speaking, start a single continuous thinking visual at
end-of-speech (the moment the user expects a response), and add an optional subtle
earcon/backchannel when the gap exceeds ~1.2 s. Confidence: high.

### FE-UI-09 — Text-only degradation is shown as a transient generic error (MEDIUM, ux)
FACT: when the spend circuit cuts TTS, the call continues as text and the BFF sends a
non-fatal `voice_error{category:'tts_unavailable', code:'provider_unavailable'}` once (BE
`engine.py:2842-2849`, `:2858-2876`). `provider_unavailable` has no copy key, so it maps to
the category copy "The voice provider could not complete the request. Please try again."
(FE `voiceCallLabels.ts:63-93`, `:153-158`; `en.ts:5122`), which auto-clears after 8 s or at
the next `transcript_final` (FE `useVoiceCallController.ts:430-436`, `:777`). With no audio,
the state shows "Thinking" while the reply text streams and returns to "Listening". Impact:
the user hears nothing for the rest of the call and is told to "try again". Recommendation:
dedicated copy + persistent "Voice paused — replies show as text" banner, captions
prominent, state "Replying (text)". Confidence: high.

### FE-UI-10 — Live-call privacy footer understates what is saved (MEDIUM, security-privacy)
FACT: with consent `voice-v2` (everyone today) the footer reads "Only transcript text and
metadata are saved. Your microphone audio is never stored." (FE `CallScreen.tsx:636-638`,
`en.ts:6155`). The same flow says "Transcript + AI replies saved" (consent badge, `en.ts:5367`),
"Character audio is saved" (`en.ts:6214`), and replays saved character audio on the end panel
(`CallLiveTranscript.tsx:272-278`). The corrected line exists as a legal draft
(`consentCopy.ts:80-85`) but stays `draft`, so the overlay does not apply (`:73-77`,
`:154-167`). Recommendation: finalize/release the `callPrivacyNote` draft (legal sign-off).
Confidence: high.

### FE-UI-11 — Any navigation silently ends the call; no minimized/background call (MEDIUM, ux)
FACT: the call lives inside the `character-chat` page in `<main>` (FE `AppRouter.tsx:251`,
`CharacterChat.tsx:78-89`); unmount ends the call with a keepalive request (FE
`useVoiceCallController.ts:1202-1216`). "Switch to text" and "End call" both call `leave()`
→ end + navigate (FE `CallScreen.tsx:199-209`, `:262-263`). No confirm dialog, no floating
call dock, no Media Session metadata/handlers (grep: no `mediaSession`). Impact: tapping the
sidebar (or the button labelled "Switch to text") hangs up; users cannot glance at the chat
or another card mid-call. Recommendation: a persistent mini call bar (the app already has a
FloatingWindows provider and a PlaylistDock pattern), or at least a confirm; clearer label
("End call and open chat"). Confidence: high.

### FE-UI-12 — Accessibility gaps in the live surface (LOW, ux/a11y)
FACT: the status line has no live region (FE `CallScreen.tsx:489-493`), so connect /
reconnect / speaking changes are not announced; the Interrupt button mounts/unmounts with
the speaking state (`:629-631`), dropping keyboard focus to `body`; captions have no live
region when the transcript panel is closed (`:499-521`; the only polite region is inside
`CallLiveTranscript.tsx:295`); the waveform is `role="img"` with a static label "Live audio
waveform" (`CallWaveform.tsx:342-346`, `en.ts:6194`) that conveys nothing; focus is not moved
to the end panel when the server ends the call (INFERENCE). Strengths alongside: 56–64 px
targets, focus rings, `aria-keyshortcuts`, reduced-motion global rule. Recommendation:
polite live region for coarse states only (connected, reconnecting, muted, ended), keep the
Interrupt slot mounted (disabled), `aria-hidden` the waveform, move focus to the end panel's
primary action. Confidence: high.

### FE-UI-13 — Interrupt control causes layout shift and is unavailable while "Thinking" (LOW, ux)
FACT: controls are a centered flex row; Interrupt (56 px) is inserted between Mute and End
only in `assistant_speaking` (FE `CallScreen.tsx:619-633`), shifting Mute ≈36 px left and End
≈36 px right (VERIFIED in Storybook `Listening` vs `CharacterSpeaking`). It cannot cancel a
reply that is still being generated, and has no keyboard shortcut (only M). Recommendation:
fixed three-slot layout; show "Stop" in thinking/speaking; Space/Esc-like shortcut for
interrupt (not for end). Confidence: high.

### FE-UI-14 — Muted state not reflected in status or hint (LOW, ux)
FACT: `isMuted` only changes the button (FE `CallScreen.tsx:620-628`); the status line still
derives from `state` ("Listening") and the first-turn hint "…is listening. Say hello…" still
shows (`:402`, `:413`); muting zeros the track (`useMicrophoneCapture.ts:571-580`).
Recommendation: "You're muted" status/hint and a flat muted waveform. Confidence: high.

### FE-UI-15 — Autoplay-blocked replies are labelled "Speaking" (LOW, ux)
FACT: `deriveVoiceCallState` maps playback `blocked` to `assistant_speaking`
(`useVoiceCallController.ts:226`), so the UI shows "Speaking", the animated waveform and the
Interrupt button while nothing is audible; the "Tap to hear {name}" button sits below the
stage (`CallScreen.tsx:550-556`). Recommendation: a distinct "Tap to hear" state that makes
the unlock button the primary affordance. Confidence: high.

### FE-UI-16 — Client merge heuristic can overwrite a real user line (LOW, correctness)
FACT: on `user_final`, if the last line is a user line and the new text *contains* the old
normalized text (plain `includes`, no word boundary), the old line is replaced
(`liveTranscript.ts:90-94`). The BFF merges text only for a superseded turn whose user
message was not persisted (BE `engine.py:2075-2087`) and sends `transcript_final` only at
LLM admission (BE `engine.py:2573-2595`), so an unadmitted utterance never reached the
client; the heuristic mostly fires after a failed reply whose empty line was dropped
(`liveTranscript.ts:116-118`). Example: "no" (failed reply) then "I know that" → "no"
disappears. Live view only (saved transcript is server-side). Recommendation: drop the
heuristic or require a server `merged_from` field / word-boundary prefix match.
Confidence: medium.

### FE-UI-17 — Full consent modal before every new call (LOW, ux)
FACT: `consentOpen` initializes `true` on every mount (`CallScreen.tsx:71`), the modal lists
six disclosures and the setup (`VoiceConsentModal.tsx:25`, `:40-98`), and `saveVoiceConsent`
is POSTed on every start (`useVoiceCallController.ts:1051-1058`). "Call again" skips the
modal (`CallScreen.tsx:250-251`). Impact: an extra read-and-click per call vs one-tap calling
in companion apps. Recommendation: full consent only when missing/stale (server knows
`consent_stale`), otherwise a compact start sheet (voice/model + Call) that still provides the
user gesture for audio unlock. UNKNOWN: whether legal requires per-call display.
Confidence: medium.

### FE-UI-18 — Call setup is fully sequential; the WebSocket is not pre-warmed (LOW, latency)
FACT: getUserMedia → ensureSession → saveVoiceConsent → `socket.start` (WS connect) →
`voice_start` → admission → `voice_ready` run strictly in order
(`useVoiceCallController.ts:1022-1089`); the socket object is created on mount but connects
only on `start(frame)` (`useVoiceCallSocket.ts:87-159`; `voiceSocket.ts:177-196`). INFERENCE:
0.4–2.5 s to "Listening". Recommendation: open/auth the WS while the consent/setup sheet is
shown, send consent in parallel with mic acquisition, play ringback; record time-to-ready.
Confidence: medium.

### FE-UI-19 — Perceived latency is measured but never reported (LOW, observability)
FACT: `CallPlaybackTiming` computes `speech_end_to_first_audible_ms` and emits only a
`performance.mark` (`callPlaybackTiming.ts:1-33`); no `PerformanceObserver` or upload exists
(grep). No client metric for time-to-ready, barge-in reaction, autoplay-blocked rate, or
caption lead. Recommendation: send a `voice_client_metrics` frame or beacon per turn and
per call; dashboard P50/P90 of speech-end→first-audible. Confidence: high.

### FE-UI-20 — No device selection, Media Session, or network-quality cue (LOW, ux)
FACT: no `enumerateDevices` / `devicechange` / `setSinkId` / `mediaSession` usage in `src`
(grep); yet the no-input copy says "Check that the right input device is selected"
(`en.ts:5129`). A silently dead socket is detected only after 50 s (`voiceSocket.ts:20-21`,
`:588-597`) with the UI in a normal state. Recommendation: mic/speaker picker in call
settings, Media Session hang-up/mute handlers, a "poor connection" chip from RTT/missed
pongs, shorter liveness (e.g. 10 s ping during calls). Confidence: high.

### FE-UI-21 — "Call again" silently no-ops when setup is blocked (LOW, correctness)
FACT: `acceptConsent` returns early when `voiceUnavailable || modelUnassigned`
(`CallScreen.tsx:162-163`), while the end panel's "Call again" is gated only by
`canRedial && !setupError` and `disabled={isAccepting}` (`:597-601`); `setupBlocked`
(`:228`) is not used there. Impact: a button that does nothing (e.g. Fish availability
flipped after the call). Recommendation: disable with reason or route to setup.
Confidence: medium.

### FE-UI-22 — User-ended calls never show the end panel (LOW, ux)
FACT: End/Switch to text → `leave()` → `onSwitchToText()` (`CallScreen.tsx:199-209`,
`:262-263`), so the recap, saved-audio replay, "Call settings" and the replaced-voice refresh
(`:586-617`) appear only after server-ended/error calls; the copy "You ended the call."
(`en.ts:6163`) is effectively unreachable via the UI. Recommendation: decide one end
experience (e.g. brief summary sheet with transcript + call again, then chat).
Confidence: high.

### FE-UI-23 — Speaking visual is synthetic; user level hidden while the character talks (LOW, ux)
FACT: during speaking the waveform runs a CSS keyframe independent of output audio
(`CallWaveform.tsx:299-305`, `:349-363`) and the mic level is not shown (tone arcane,
`CallScreen.tsx:401`, `:496`). Recommendation: drive the visual from an `AnalyserNode` on
the output, and show a small mic meter during playback so users see they are being heard.
Confidence: high.

### FE-UI-24 — Interim states of an interrupted line (LOW, correctness)
FACT: a local barge-in marks the line interrupted but keeps the full text until the server's
`kept_chars` arrives (`useVoiceCallController.ts:652`, `liveTranscript.ts:106-115`);
`assistant_truncate` marks interrupted even if nothing was cut (`:110-111`); interrupted
lines are stripped with `partial:false` (`liveTranscript.ts:131-133`), so a cut inside a
markup token (e.g. `<#0.`) would render the fragment (INFERENCE; depends on where the BFF
cuts). Recommendation: truncate locally at `played_ms` estimate immediately; strip with
`partial:true` for interrupted lines. Confidence: medium.

### FE-UI-25 — App audio (playlist) is not paused at call start (LOW, robustness)
INFERENCE: call playback claims the app-wide audio focus only when a reply plays
(`voicePlaybackBuffer.ts:107`, `:477`; `ui/components/audio/audioFocus.ts:11-14`); nothing in
the call start pauses the PlaylistDock, so music can play into the mic during the first
utterance. Recommendation: claim focus (pause playlist/narration) on `requesting_permission`.
Confidence: low.

### FE-UI-26 — Internal error codes shown to end users (INFO, ux)
FACT: notices append `(VOICE_TURN_FAILED)`-style codes and the end panel prints the code
(`CallScreen.tsx:563`, `:591`). Good for support, noisy for users; consider a "details" toggle.

### FE-UI-27 — History lacks interruption markers and end reasons in rows (INFO, ux)
FACT: saved segments have no interrupted flag (`voice.types.ts:308-320`); rows show only
time/duration/lines (`CallHistoryRow.tsx:445-477`); end reason shows only in the detail view
(`CallTranscriptView.tsx:143-150`).

### FE-UI-28 — Avatar "live" dot is clipped by the circular mask (INFO, ux)
FACT: the status dot is absolutely positioned at bottom-right inside an `overflow-hidden
rounded-full` span (`src/ui/primitives/Avatar.tsx:44-50`, `:70-75`). VERIFIED in Storybook
`Listening`: a partially clipped green disc.

---

## 6. Strengths (keep these)

- **Truthful "speaking" state**: derived from actual playback, with a same-turn stall still
  reading as speaking, so late frames never flip the UI (FE `useVoiceCallController.ts:207-239`).
- **Barge-in reports what was heard**: `voice_barge_in{turn_id, played_ms}` read before the
  player resets; captions cut to `kept_chars` (code points like the BFF) and tagged
  "(interrupted)" (FE `:644-673`, `:833-842`, `liveTranscript.ts:106-112`).
- **Stale audio is dropped after interrupts** (buffer refuses chunks of cancelled turns;
  socket filters frames of cancelled turns) (FE `useVoiceCallController.ts:818-820`,
  `voiceSocket.ts:435`, `:448-464`).
- **False-interruption guards modeled on LiveKit** (min interruption duration, AEC warm-up),
  manual Interrupt always available while speaking (FE `useVoiceCallController.ts:132-143`).
- **AEC detection and guidance** (headphones hint) (FE `CallScreen.tsx:529-534`).
- **iOS autoplay unlock inside the click** + "Tap to hear" fallback (FE
  `useVoiceCallController.ts:995-998`, `CallScreen.tsx:550-556`).
- **Robust lifecycle**: wake lock, `pagehide` keepalive end, unmount end, auth-expiry
  teardown, 15 s ready timeout, resume within the server grace window with a state snapshot,
  active-call registry for workspace switches (FE `useVoiceCallController.ts:1167-1216`,
  `voiceSocket.ts:401-421`, `activeVoiceCall.ts`).
- **Error taxonomy and copy**: transient vs fatal, first-specific-notice-wins, never raw
  provider strings, terminal safety/region refusals block redial, setup errors route to
  settings (FE `voiceCallLabels.ts:62-162`, `CallScreen.tsx:375-382`).
- **Safety and disclosure**: always-on AI voice badge, crisis panel on safety pause, break
  nudge, final-minute warning (FE `CallScreen.tsx:484-487`, `:574-583`, `:444-448`).
- **Transcript panel quality**: follow-scroll + jump to latest, screen-reader announcement of
  complete lines only, speech-markup stripping including partial tokens, lazy saved-audio
  clips (FE `CallLiveTranscript.tsx`, `CallTranscriptLines.tsx:202-260`).
- **Responsive transcript layout** (compact 72 px avatar + panel on phones; side panel on
  `lg`) — VERIFIED in Storybook `TranscriptOpen`.
- **Large touch targets, M shortcut with input guard, reduced-motion rule** (FE
  `CallScreen.tsx:415-428`, `:677-726`; `theme.css:301-309`).
- **Good test/story coverage** of the view states (CallScreen*.test.tsx, liveTranscript tests,
  27 stories).

---

## 7. Gap analysis vs best-in-class voice agents (industry knowledge, not verified here)

Products referenced (ChatGPT Advanced Voice, Gemini Live, Sesame Maya/Miles demo,
Character.AI calls) are described from general knowledge as of 2025–2026; treat as
directional.

| Capability | Typical best-in-class | Magic Worlds today | Finding |
|---|---|---|---|
| Interrupt by any word | Yes, fast (≈200–300 ms), false-interruption recovery | ≥500 ms voiced; short words dropped | FE-UI-01 |
| Caption sync | Captions follow audio (or none during speech) | Text leads audio | FE-UI-03 |
| Character speaks first | Common in companion calls | User must start | FE-UI-07 |
| Thinking feedback | One continuous visual; sometimes earcon/backchannel | 4 label flips, no audio cue | FE-UI-08 |
| Audio-reactive visuals | Orb/visual driven by output audio | Synthetic CSS animation | FE-UI-23 |
| Background / minimize | Call continues while browsing / backgrounded | Any navigation hangs up | FE-UI-11 |
| Mute clarity | Clear muted state | Button only | FE-UI-14 |
| Limits | Clear remaining time, graceful wrap-up | Max-duration only; abrupt cut | FE-UI-05, FE-UI-06 |
| Half-duplex/PTT fallback | Available on poor AEC/noisy env | None | FE-UI-02 |
| Device selection | Mic/speaker pickers | None | FE-UI-20 |
| Interim transcript | Live partial captions of the user | Final only, after LLM admission | §1.5 |
| Client RUM | Per-turn latency telemetry | Local mark only | FE-UI-19 |

---

## 8. Open questions

1. Does the BFF send `voice_status` frames with meaningful states/retry hints beyond
   `listening` and `uploading_segment`? The client ignores all of them.
2. Real-app mobile height: how much the app shell (sidebar/top bar) leaves for the call
   screen on phones (only the 680 px story container was checked).
3. Is per-call consent display a legal requirement (D25/I-68), or can a remembered consent
   skip the modal?
4. Can ElevenLabs/Fish alignment be forwarded cheaply to the client for caption sync (the
   ledgers already hold it)?
5. Product intent: should calls survive navigation (mini call bar) and tab backgrounding
   (iOS Safari suspends audio/mic in background; not tested)?
6. Actual distribution of speech-end → first-audible on real devices (no client telemetry).
7. Whether the echo loop in FE-UI-02 happens in practice on the raw-fallback path (Linux
   Chrome) — not reproduced.

---

## Verification (adversarial)

A second pass tried to refute FE-UI-01 to FE-UI-11 by re-reading the cited code and nearby
guards. No source was modified, and Storybook was not re-run (FE-UI-04 was re-checked from
the class geometry only). Paths: `FE` = frontend repo, `BE` = `magic-worlds-api`.

| id | verdict | corrected severity | evidence / note |
|---|---|---|---|
| FE-UI-01 | adjusted | medium | **Mechanism confirmed.** `FE useVoiceCallController.ts:706` raises `minSpeechMs` to 500 when playback starts, and `:710` lowers it back to 250 at idle. The worklet announces only at `speechSamples >= minSpeechSamples` (`voiceVadProcessor.worklet.js:339`) and discards unannounced segments (`:394`). The warmup ref is set once per call (`:705`) and reset at call start (`:998`). **Severity lowered** for three reasons: 500 ms matches LiveKit's default minimum interruption duration; the manual Interrupt button always works; and the threshold drops to 250 ms mid-segment once playback goes idle, so a short reply that overlaps the end of playback still survives. The real defect is that a short utterance said entirely during playback is discarded instead of reaching STT. |
| FE-UI-02 | confirmed | medium | `useVoiceCallController.ts:681` skips auto barge-in when AEC is off, but `uploadSegment` (`:564`) has no playback gate. `BE engine.py:2066-2073`: any non-empty transcript supersedes and cancels the in-flight turn. The `engine.py:1414-1425` docstring says this is the intended no-AEC interruption path. So voice interruption is not "disabled", only slower (after STT), and the hint `en.ts:6150` is wrong. The echo loop is still unproven: the 500 ms playback threshold and server STT gating partly mitigate it. |
| FE-UI-03 | confirmed | medium | `BE engine.py:2612-2620` sends each LLM delta before the sentence goes to TTS. `useVoiceCallController.ts:944-948` appends it to the caption and transcript at once (`liveTranscript.ts:103`). `voice_audio_chunk` has no alignment fields (`voice.types.ts:208-224`). A barge-in later cuts captions back with `kept_chars` (`truncateCaption`, `:833`), so text that was never heard is shown and then removed. |
| FE-UI-04 | confirmed | medium | `CallScreen.tsx:469-473`: the stage is `flex-1 overflow-y-auto` with a `min-h-full justify-center` column containing the 188 px avatar, name, badge and status, the `h-16` waveform (`CallWaveform.tsx:45`) and the captions. Nothing scrolls the stage; only `CallLiveTranscript` auto-follows. The footer at `:636` is always shown. At 680 px tall this leaves room for only about one caption line. Taller phones (about 750 px or more) are less affected, and the transcript panel is a workaround. |
| FE-UI-05 | confirmed | medium | `BE engine.py:1855-1862`: the quota end fires at `billable_audio_seconds >= reserved_seconds`, and `quota.py:268` sets `reserved = min(max_call_seconds, remaining)`. The client warning uses `max_call_seconds - elapsed` only (`useVoiceCallController.ts:1232`). `remaining_daily_seconds` is read nowhere. **Mechanism detail:** an in-call quota end sends a fatal `voice_error{quota_exceeded}` first (`engine.py:1741-1745`), so the client usually lands in `state='error'` with the "voice limit… try again later" copy, not the `ended`/`quota` path the story shows. `canRedial` (`CallScreen.tsx:378`) is still true either way, so "Call again" stays the primary action and there is no billing CTA. |
| FE-UI-06 | adjusted | medium | `handleEnded` (`:901`) and the fatal-error path both call `stopLocalResources`, which cancels playback by default (`:501`). The abrupt cut is real for `max_duration` and `quota`. **Wrong for `idle_timeout`:** that end needs no in-flight segments and 120 s since `last_activity_at`, which is updated when a turn finishes (`engine.py:1861`, `:2110`), so playback is long over and nothing is cut mid-word. The missing idle warning is real: the client never reads `idle_timeout_seconds`. |
| FE-UI-07 | confirmed | medium | `CallScreen.tsx:412` and `en.ts:6148` show only the hint. A grep of `BE src/services/voice_orchestration` and `src/routers` for greeting, opening or ringback logic finds nothing. The connecting state shows only the `Loader2` spinner (`CallScreen.tsx:490`). |
| FE-UI-08 | adjusted | low | `deriveVoiceCallState` (`:222-237`) and the labels (`en.ts:5141-5157`) do produce Listening → Sending audio → Transcribing → Thinking → Speaking. During upload and STT, `avatarStatus` is `none` and `waveTone` is `idle` (`CallScreen.tsx:392,401`). However, the text label keeps changing, so the screen does not look dead. This is perceived-latency polish, not a functional gap. |
| FE-UI-09 | confirmed | medium | `BE engine.py:2858-2873` sends one non-fatal `tts_unavailable` with `code=provider_unavailable` and the message "call continues as text". That code has no entry in `CALL_ERROR_CODE_KEY` (`voiceCallLabels.ts:60-91`), so the screen shows `providerFailed` (`en.ts:5122`, "Please try again") with the raw code. It clears after 8 s (`:431`) or at the next `transcript_final` (`:777`). With no audio chunks, the phase stays `thinking`, so the label reads "Thinking". Rare, because only the spend circuit triggers it. |
| FE-UI-10 | confirmed | medium | `CallScreen.tsx:636` shows `call.screen.privacyNote` unless the consent version is `voice-v3`, and `BE config.py:25` requires `voice-v2`. The note says "Only transcript text and metadata are saved". Elsewhere: the badge says "Transcript + AI replies saved" (`en.ts:5367`), the transcript note says "Character audio is saved" (`en.ts:6214`), and the BE stores assistant audio (`engine.py:3500` `persist_call_audio_asset`). The corrected `callPrivacyNote` draft is `status: 'draft'` (`consentCopy.ts:80`), so `installInAppCopyRelease` never overlays it. |
| FE-UI-11 | confirmed | medium | Unmount calls `endVoiceCall(keepalive)` (`useVoiceCallController.ts:1202-1212`). "Switch to text" and "End call" both call `leave()` (`CallScreen.tsx:199-209,262-263`). The call registers no `registerNavigationInterceptor` guard and has no `mediaSession` usage. `activeVoiceCall.ts` is used only by the workspace-switch coordinator (`NavigationProvider.tsx:349`), which ends the call without confirmation. |
