# R06: Transport and client audio for realtime voice agents

**Scope:** network transport between the browser and the voice backend (WebSocket, HTTP, WebRTC, WebTransport/MoQ), codecs and loss handling, browser audio capture (AEC, noise suppression, AGC), AudioWorklet practice, low-latency playback of streamed TTS, measuring playback position for truncation, iOS Safari and Android Chrome quirks, server placement, and reconnection.

**Date of research:** 2026-10-20.
**Method:** about 25 web searches plus about 45 primary-source fetches (vendor docs, engineering blogs, WebKit/Chromium bug trackers, MDN, caniuse, IETF-related posts), and a read of the current Magic Worlds client and backend code paths.
**Labels used below:**
- **[vendor]**: a vendor's own number or claim, not independently verified.
- **[stale]**: the source is more than 12 months old, so treat details as possibly outdated.
- **[unverified]**: from prior knowledge, not re-checked in this session.

**Limits of this research:** the shared web-search budget ran out partway through. After that, only direct fetches of known primary URLs were possible. Some points therefore rest on fewer sources than ideal: Bluetooth HFP behaviour, iOS background capture, and the Fish Audio format list. These are marked [unverified].

---

## 0. TL;DR

1. **For browser-to-server voice, the industry consensus in 2025-2026 is WebRTC (UDP + Opus + jitter buffer + browser AEC). WebSocket is for server-to-server, telephony, or text.** OpenAI, Google (through its partners), Pipecat/Daily, LiveKit and Cloudflare all say this. Most of them sell WebRTC infrastructure, but OpenAI's own documentation also says WebRTC gives "more consistent performance" for browser and mobile clients.
2. **The case is real but not absolute.** Some credible engineers push back. Luke Curley (MoQ) argues that WebRTC's jitter buffer is too aggressive and that setup takes about 8 RTTs. Helix moved to WebSocket + WebCodecs to get through firewalls, then later abandoned that approach. On good networks, a well-built WebSocket pipeline performs acceptably. The gap shows up under packet loss, on mobile, at long distances, and in echo handling.
3. **Magic Worlds today is a hybrid that is not well suited to low latency.** The microphone audio is uploaded as a whole WAV utterance (PCM16 16 kHz, 256 kbps) over HTTP only after the client VAD declares end of speech. The reply comes back as base64 MP3 (default `mp3_44100_128`, about 171 kbps after base64) inside JSON WebSocket frames, and plays through MSE/ManagedMediaSource on an `<audio>` element. Every utterance pays its full upload time after the user stops talking, and STT cannot start until the upload finishes.
4. **Echo cancellation is the biggest client-side risk for barge-in.**
   - Chromium historically used only WebRTC remote audio as the AEC reference, so Web Audio output was not cancelled.
   - Since about M111, desktop Chrome's "Chrome-wide AEC" (a feature-flag default, not guaranteed) uses Chrome's own rendered output as the reference. Microsoft Edge may not get this.
   - Firefox and Safari cancel all of the browser's output.
   - Mobile operating systems use platform voice processing.
   - Chrome desktop now also ships a neural residual-echo estimator. In webrtcHacks' test it roughly halves near-end WER during double-talk (0.500 to 0.235, Oct 2026).
   - The robust fix is to receive the agent's audio as a WebRTC remote track. Failing that, use the WebRTC-loopback workaround.
5. **For streamed TTS playback, the current low-latency best practice is PCM or Opus decoded into an AudioWorklet ring buffer.** This gives sample-accurate gapless playback and an exact count of "samples heard", which is what truncation needs. MSE-with-MP3 works but has opaque start-up buffering and imprecise position tracking, and it is fragile on iPhone (ManagedMediaSource). Playing a WebRTC remote track avoids all of this, and the server knows how much it has sent.
6. **iOS is the riskiest platform right now.**
   - WebKit bug 326286 (filed 2026-10-04): an iOS 26.2→27 regression where audio crackles whenever a getUserMedia track with `echoCancellation: true` is open, for both Web Audio and `<audio>` output.
   - WebKit bug 311451: output quality drops (lower sample rate, mono) whenever the mic is open.
   - Neither bug has a fix or workaround. Magic Worlds requests `echoCancellation: true`, so iPhone users on iOS 27 are probably affected.
7. **Noise and background voices hurt VAD and STT more than people expect.** Krisp is said to report that background voices push WER from 5% to over 30% [vendor] (unverified: neither cited Krisp article, SpeechTechMag 2026-05 or SiliconANGLE 2025-07, contains this figure; fact-check 2026-10-20). Best practice is a voice-isolation or noise-suppression model on the server, before VAD and STT (Krisp VIVA, ai-coustics, or RNNoise as a free baseline), without stacking a second enhancement model on the client.
8. **WebTransport became Baseline when Safari 26.4 shipped it on 2026-03-24.** Media over QUIC is still an IETF draft (`draft-ietf-moq-transport-22`, 2026-10-01; the WG milestone to request IESG publication is Dec 2026), though Pipecat already ships a MoQ transport. Raw WebTransport gives you no AEC coupling, no jitter buffer and no media-aware congestion control. Pipecat's MoQ client adds its own jitter buffer (`audioLatencyMs`, default 80 ms) but says nothing about AEC. Neither is yet a better default than WebRTC for 1:1 voice agents. Re-evaluate in 2027.
9. **Placement matters.** Physics alone puts Singapore↔US-East at about 150 ms RTT, and about 230-280 ms in practice [vendor: LiveKit]. Daily reports a P50 first hop of 13 ms to its edge across about 75 PoPs [vendor]. ElevenLabs Flash TTFB is about 100-150 ms in NA/EU/SEA and 150-200 ms in South and Northeast Asia [vendor]. Put the voice gateway in the same region as the STT, LLM and TTS endpoints, and keep upstream connections warm.

---

## 1. What Magic Worlds does today (transport-relevant facts from the code)

These facts come from reading the code on 2026-10-20. The research brief described uploads "over a WebSocket", but the code does something different.

| Aspect | Current implementation | Evidence |
|---|---|---|
| Mic capture | `getUserMedia({echoCancellation:true, noiseSuppression:true, autoGainControl:true})` (processed constraints), with a raw-constraints variant also present. AudioContext is forced to 16 kHz, falling back to the native rate on Firefox ≤147, which cannot connect a mic stream to a context at a different rate. | `src/features/interaction/hooks/useMicrophoneCapture.ts` (lines 80-83, 105-145, 331-343) |
| Client VAD | An AudioWorklet VAD segments each utterance into an Int16Array at 16 kHz. | `src/features/interaction/audio/voiceVadWorklet.ts` (`VOICE_VAD_SAMPLE_RATE = 16_000`) |
| Uplink transport | **The whole utterance goes as a WAV (`audio/wav;codec=pcm_s16le`) over an HTTP POST** to the voice-segments route after the segment closes. The socket explicitly forbids audio payloads from the client. | `voiceSocket.ts` header comment ("microphone bytes are uploaded through the HTTP voice-segments route"); `FORBIDDEN_CLIENT_PAYLOAD_KEYS`; `useVoiceCallController.ts` `uploadSegment` |
| Downlink transport | WebSocket JSON frames `voice_audio_chunk { content_type:'audio/mpeg', data_b64, seq, sample_rate }`. | `src/shared/types/voice.types.ts` |
| TTS format | ElevenLabs default `mp3_44100_128`. Fish Audio: `format:'mp3', sample_rate:44100, mp3_bitrate:128, latency:'balanced'`. | backend `admin_voice_catalog.py:436`, `fish_audio/timestamp_ws.py:211` |
| Playback | A single reusable `<audio>` element with (1) MediaSource, (2) ManagedMediaSource on iPhone (falls back if no playback within 2 s), and (3) sequential Blob groups as a last resort. | `src/features/interaction/audio/voicePlaybackBuffer.ts` |
| Truncation position | `playedMs` is derived from `audio.currentTime`. | `voicePlaybackBuffer.ts:147, 312` |
| Resilience | 25 s heartbeat, liveness timeout of 2×. After `voice_ready`, the client reconnects with `voice_resume` inside a 15 s window, which is below the server's 20 s grace. | `voiceSocket.ts` constants |

**What this costs in latency (arithmetic, not measured):**

- PCM16 mono at 16 kHz is 256 kbps, or 32 KB/s. A 4 s utterance is about 128 KB.
- On a 2 Mbps mobile uplink, the body alone takes about 0.5 s. On 10 Mbps it takes about 0.1 s.
- On top of that come HTTP request overhead (≥1 RTT on a warm connection, 2-3 RTT on a cold TLS connection) and the server VAD gate. Batch Whisper STT only starts after all of it.
- Opus at 24-32 kbps would be about 8-10× smaller.
- Streaming the audio while the user speaks removes the post-speech upload from the critical path almost entirely, because only the last 20-100 ms is in flight at end of speech.
- Base64 on the downlink adds 33% (128 kbps MP3 becomes about 171 kbps) plus JSON parsing on the main thread. Bandwidth is tolerable, but this is pure waste.

---

## 2. WebRTC vs WebSocket: mechanics

### 2.1 Why TCP hurts realtime audio

- **Head-of-line (HOL) blocking.** TCP delivers bytes in order. One lost segment holds back everything behind it until the retransmission arrives, which takes at least 1 RTT and often more with RTO backoff. LiveKit describes a single loss stalling playback "possibly for hundreds of milliseconds", whereas a lost 20 ms RTP frame is "nearly imperceptible" because the receiver conceals it ([LiveKit, 2026-03-23] [vendor]).
- **Congestion response.** After loss, TCP's congestion window regrows over several RTTs. The application cannot see this and keeps writing. Data queues in the kernel send buffer, so latency balloons until "speech echoes back seconds later" ([Kausthub, 2025-07-10]).
- **No media timing.** The application has to timestamp, pace and jitter-buffer the audio itself. Pipecat's transport guide lists no automatic timestamping, no built-in echo cancellation and reconnection complexity as WebSocket costs, and says: "Do not use it for browser-to-server voice interactions" ([Pipecat docs: Choosing a transport], accessed 2026-10-20).
- **Opus loss tools are designed for UDP.** Pipecat says Opus FEC and PLC are designed for UDP's delivery model and that on TCP "that machinery either doesn't help or actively hurts" ([Pipecat docs]). Pipecat does not mention RED; the same reasoning applies to it, because TCP never shows the application a loss.

### 2.2 What WebRTC gives you (browser side, for free)

| Mechanism | What it does | Notes / numbers |
|---|---|---|
| UDP/SRTP + **NetEQ adaptive jitter buffer** | Reorders and absorbs jitter. A late packet is concealed, not waited for. | Dynamic range of about 20-200 ms, which Curley calls "aggressively small". Audio is rendered by arrival time, not sender timestamps ([moq.dev, 2026-05-06]). |
| **PLC** (packet loss concealment) | Synthesises the missing 10-20 ms. | Built into Opus/NetEQ. |
| **Opus in-band FEC (LBRR)** | Carries a low-bitrate copy of the previous frame. | Enabled by default in Chrome, but only switches on in response to observed loss, is capped around 25% expected loss, and takes bits from the main stream. In a 2020 test it reduced concealment only from 20% to 18% at 20% loss ([webrtcHacks RED, 2020-08-20] [stale]). |
| **RED (RFC 2198)** | Sends whole redundant frames. | Distance 2 cut concealment from 18% to 0.7% at 20% loss and from 60% to 18% at 60% loss, at roughly 2-3× audio bitrate ([webrtcHacks, 2020] [stale]). In that 2020 article RED was **off by default**, behind the `WebRTC-Audio-Red-For-Opus` field trial and negotiated via SDP. The libwebrtc field-trial registry still lists that trial (policy-exempt, expiry 2024-04-01). A secondary source claims Chrome enabled RED for Opus by default in M96 ([GStreamer issue 3550], access-blocked on re-check) (unverified). Check SDP for `red/48000/2` rather than assuming. LiveKit uses RED ([BlogGeek, 2026]). |
| **Opus DRED** (Deep REDundancy, Opus 1.5) | Neural redundancy carrying up to about 1 s of past audio for bursts of 200 ms or more. | The draft says it allows "up to one second or more" of redundancy per packet "using a bitrate about 1/50 of the regular Opus bitrate". The "about 12-32 kbps, about 1% CPU" figures are (unverified). **Not in libwebrtc or Chrome** (no DRED field trial in the libwebrtc registry, 2026-10-20). IETF draft `draft-ietf-mlcodec-opus-dred-07` (revision dated 2026-08-04, datatracker updated 2026-08-27; in WG Last Call, intended Proposed Standard updating RFC 6716) ([IETF datatracker]; [BlogGeek DRED glossary, updated Oct 2026]). |
| **Audio NACK** | Retransmission for audio. | Hard to enable in browsers. BlogGeek's table notes "No audio NACK seen" for LiveKit, "unlike Google Meet" ([BlogGeek, 2026]). Curley writes that it "might be possible to enable audio NACKs, but we couldn't figure out the correct SDP munging" ([moq.dev, 2026]). |
| **GCC congestion control** | Detects congestion from one-way-delay growth before loss happens and adapts the bitrate. | ([LiveKit, 2026]) |
| **AEC/NS/AGC coupled to the remote track** | The remote track is always the AEC reference. | See §4. |
| **ICE restart** | Recovers from network changes such as Wi-Fi→LTE. | WebSocket needs custom resume logic. |
| **Data channel** | SCTP over DTLS carries events. | OpenAI uses the `oai-events` channel. Pipecat's aiortc chunk-size setting is about 1100 bytes, and values above about 1175 can exceed the 1280-byte MTU on IPv6, Tailscale and VPNs ([Pipecat SmallWebRTC docs]). |

### 2.3 Bandwidth reality check

| Payload | Bitrate | Over base64/JSON |
|---|---|---|
| PCM16 mono 16 kHz (current uplink) | 256 kbps | 341 kbps |
| PCM16 mono 24 kHz (OpenAI/Gemini output) | 384 kbps | 512 kbps |
| MP3 44.1 kHz 128 kbps (current downlink) | 128 kbps | 171 kbps |
| Opus voice (WebRTC default target 32 kbps, ~20 kbps average from clients) | 20-32 kbps | n/a (binary RTP) |

BlogGeek's 2026 survey calls base64 PCM over WebSocket (about 512 kbps) "pragmatism, not design", roughly 10× the Opus bitrate. It recommends 32 kbps mono Opus, no default stereo from server to client, no DTX when the server runs VAD, noise suppression before VAD, WebRTC AEC, and no SFU for 1:1 bot sessions ([BlogGeek "WebRTC for Voice AI", c. June 2026]).

### 2.4 The counter-arguments (take these seriously)

- **Luke Curley / moq.dev ("WebRTC is the problem", 2026-05-06).**
  - WebRTC setup costs about 8 RTTs: 3 for signalling over TCP/TLS/HTTP, then 5 for ICE, DTLS 1.2 and SCTP. QUIC plus TLS takes 1 RTT.
  - Port-per-session media termination does not scale (Kubernetes NodePort ranges).
  - Routing breaks on client IP or port changes, whereas QUIC connection IDs survive them.
  - The jitter buffer is too small for an LLM-generated stream that is produced faster than realtime: the sender has to pace audio or "sleep" it out.
  - He concedes that WebSockets would be the simpler starting point. His actual wording: "if I was working at OpenAI, I'd start by stream[ing] audio over WebSockets." (Corrected 2026-10-20: the earlier quoted phrase "a simpler starting point" does not appear in the post.)
- **Helix (2025-12-11).** Replaced WebRTC with WebSocket + WebCodecs (H.264 + Opus) because enterprise firewalls often allow only 443/TCP. One customer saw only about 80% connection success, and ICE failed silently. They report 20-30 ms lower latency and simpler operations, but no adaptive bitrate and full exposure to HOL blocking. **The post later says this approach was abandoned**, with a follow-up promised.
- **TURN is mandatory, not optional.** Without STUN/TURN, WebRTC fails behind symmetric/CGNAT and on corporate networks. On UDP-blocking networks the relay rate is "effectively 100%". Recommended: `turn:...:443?transport=tcp` plus `turns:...:443`, short-lived credentials, and testing with `iceTransportPolicy:"relay"` ([Metered dev.to, 2026-07-16] [vendor]).

**Synthesis.** WebSocket is acceptable when:
- (a) the client is on a decent, stable network close to the server;
- (b) the audio is streamed continuously in small binary frames with application-level pacing and a jitter buffer;
- (c) echo is handled, for example because users wear headphones or the platform AEC covers playback;
- (d) you build resume/reconnect logic.

It degrades sharply under loss above about 1-2%, bufferbloat, Wi-Fi↔LTE handover, and long RTTs. Those conditions are common for mobile companion-app users.

### 2.5 Connection setup latency

- WebRTC adds signalling plus ICE/DTLS round trips before the first audio flows. Mitigations:
  - Pre-connect when the call screen opens, not when the user starts speaking.
  - Run signalling over an already-open WebSocket.
  - Use the "unified interface" pattern, where the server posts the SDP for the client, as OpenAI does.
- OpenAI's Realtime docs now point to **WARP ("WebRTC Abridged Roundtrip Protocol")** to cut session-start time for GPT-Live and the Realtime API ([OpenAI realtime-webrtc-warp guide], accessed 2026-10-20). What it is, per that page:
  - It combines **DTLS 1.3**, **SNAP** (an SCTP setup optimisation, judging by its field-trial name), **SPED** (DTLS folded into the ICE handshake, judging by its field-trial name; expansions not given on the page) and a **pre-negotiated data channel** (`negotiated: true`, sent to the server as `dcid`).
  - Each part can be enabled on its own. In native libwebrtc they are the field trials `WebRTC-ForceDtls13`, `WebRTC-Sctp-Snap` and `WebRTC-IceHandshakeDtls`.
  - Browser support: Chrome has DTLS 1.3 with no origin trial. SNAP is an origin trial in **Chrome 151-156**. **SPED has no browser origin trial**, so full WARP is not available in stock browsers. Firefox, Safari and iOS fall back to standard WebRTC. The pre-negotiated data channel alone needs no trial and "can reduce the wait for server events".
  - The page gives no number for round trips or milliseconds saved. Treat WARP as emerging. These are the same handshake round trips Curley counts above.
- OpenAI GPT-Live WebRTC session creation (`POST /v1/live/sessions`) bills 15 s of voice at initialisation. That amount is **credited against duration charges** once the session runs, so it is not an extra 15 s ([OpenAI realtime-webrtc guide]). The GPT-Live session model in the examples is `gpt-live-1`, and the Realtime API examples use `gpt-realtime-2.1`. Not relevant for a cascaded build.

---

## 3. How the leaders build it

### 3.1 OpenAI (ChatGPT voice + Realtime API)

- Engineering post "How OpenAI delivers low-latency voice AI at scale" (2026-05-04). The page returned 403 to the fetcher (again on 2026-10-20); details are from the [SWE Quiz summary, 2026-05-04]. The summary's title cites 900M users, but its body says only "hundreds of millions of weekly users". The exact "900M weekly" figure is (unverified).
- **Split relay/transceiver.** A thin UDP relay with a small fixed public port footprint forwards packets without decrypting them. The transceiver on the internal network owns ICE, DTLS, SRTP and session state, plus the upstream connection to inference.
- **Routing.** The target transceiver is encoded in the ICE ufrag, so the relay routes the first STUN packet statelessly.
- **Ingress.** Global ingress uses Cloudflare geo-steering DNS, then OpenAI's backbone.
- **Implementation.** Go with `SO_REUSEPORT`, no DPDK/io_uring. They chose a transceiver over an SFU because the AI must decode the audio.
- **Client guidance.** The developer docs recommend WebRTC for browser and mobile ("For browser and mobile clients, we recommend connecting via WebRTC"), WebSocket for Realtime API server-to-server, and "WebRTC for GPT-Live audio connections, including server-to-server integrations" ([realtime-websockets guide]). The "more consistent performance" wording is in the [realtime-webrtc guide].
- **Truncation.** With WebRTC/SIP, "the server manages a buffer of output audio, so it knows how much has played" and auto-truncates on interruption. With WebSocket, the client must stop playback, measure the played ms, and send `conversation.item.truncate { audio_end_ms }` ([realtime-conversations guide]). This is exactly the problem Magic Worlds solves by hand with `played_ms`.

### 3.2 Google Gemini Live

- The native protocol is a stateful **WebSocket** (WSS). Input is PCM16 16 kHz; output is PCM16 24 kHz. The docs say client-to-server "generally offers better performance for streaming audio and video", and recommend ephemeral tokens instead of API keys in production.
- **WebRTC is available only through partner integrations.** The docs list LiveKit, Pipecat by Daily, Fishjam (Software Mansion), Vision Agents (Stream), Voximplant, Agora and the Firebase AI SDK, and say they support the Live API "over WebRTC or WebSockets" without saying which uses which ([Gemini Live API docs, updated 2026-10-06]). Not every partner on that list is a WebRTC path; Firebase AI SDK in particular should not be assumed to be WebRTC (unverified).
- BlogGeek reports that the Gemini native app uses raw QUIC/UDP ([BlogGeek, 2026]).

### 3.3 Transport/platform options for a cascaded agent

| Option | Kind | Strengths | Weaknesses | Price (as of Oct 2026) |
|---|---|---|---|---|
| **Pipecat SmallWebRTCTransport** | Self-hosted, serverless P2P WebRTC (aiortc, Python; the `webrtc` extra installs `aiortc`). The SmallWebRTC page documents only a JS client SDK; iOS, Android, RN, C++ and ESP32 clients (unverified). | No SFU hop; open source; Daily's Kwindla recommends it for anyone self-hosting: "you should almost certainly use the serverless approach" ([Daily blog, 2025-07-21]). | 1:1 only. Pipecat says avoid it for geographically distributed users, network resilience at scale, or "more than a handful of concurrent sessions" ([Pipecat docs]). You run TURN yourself. aiortc is less battle-tested than libwebrtc. | Free (plus TURN) |
| **Daily / Pipecat Cloud** | Managed WebRTC cloud. | About 75 PoPs, 10 regions, **P50 first hop 13 ms**, mesh routing ([Daily, 2025-07-21] [vendor]). Included with Pipecat Cloud. Krisp integrated. | Vendor lock-in; Daily TURN uses Twilio and/or Cloudflare ([BlogGeek]). | Bundled in Pipecat Cloud |
| **LiveKit (Cloud or OSS server + Agents)** | SFU + agents framework. | Mature libwebrtc clients on all platforms, RED, turn detector, Krisp/ai-coustics noise cancellation and voice isolation, self-hostable OSS. | SFU hop (mitigated by a global mesh in Cloud); agent-framework opinions. | Build $0 (1,000 agent-min, 5,000 WebRTC-min, 50 GB, 100 voice-isolation min). Ship from $50/mo (includes 5,000 agent-min, 150,000 WebRTC-min, 250 GB, 1,000 VI-min; then agent sessions $0.01/min, WebRTC $0.0005/min, bandwidth $0.12/GB, voice isolation $0.0012/min). Scale from $500/mo (WebRTC $0.0004/min, bandwidth $0.10/GB after inclusions) ([LiveKit pricing], re-checked 2026-10-20) |
| **Cloudflare Realtime SFU + WebSocket adapter** | Anycast SFU across 330+ cities. The adapter turns WebRTC Opus into PCM over WebSocket to your backend and back into a WebRTC track. | **Hybrid: the client gets WebRTC, and the backend keeps a WebSocket PCM interface**, which fits a FastAPI backend. Cheap. Turn detection via Pipecat smart-turn-v2 on Workers AI ([Cloudflare blog, 2025-08-29, mod 2026-07-15]). Workers AI now also lists Deepgram **Flux** (conversational STT for voice agents), Nova-3, and Aura-2 TTS (`aura-2-en`, `aura-2-es`), so STT and TTS can sit next to the SFU ([Workers AI models], accessed 2026-10-20) [vendor]. Smart-turn on Workers AI is still listed only as v2. | PCM details are underspecified: the blog says only "PCM audio at the original sample rate". You still build the bot logic; newer product. | SFU/TURN $0.05/GB egress, first 1,000 GB/mo free (shared by SFU and TURN), ingest free, including audio ingested from a WebSocket endpoint ([CF pricing, 2026-09-22]). RealtimeKit $0.0005/min per audio-only participant, $0.002/min audio/video ([CF RealtimeKit pricing, updated 2026-10-19]). |
| **OpenAI Realtime WebRTC** | Speech-to-speech only. | Server-side playout tracking, auto-truncate, global relay. | Not usable for a custom cascaded pipeline; vendor model. | Per model |
| **Pion (Go) / libdatachannel / own gateway** | Build your own WebRTC termination, as OpenAI did. | Full control; Pion is the usual DIY choice ([BlogGeek]). | Significant engineering: ICE, TURN, ports, observability. | Infra only |
| **Pipecat MoqTransport** | Media over QUIC via a relay that both sides dial (the docs show only a placeholder relay URL; `cdn.moq.dev` as the relay is (unverified)) or direct "serve" mode with certificate pinning (`serverCertificateHashes`). Opus broadcast, 48 kHz by default; WebTransport with a raced WebSocket fallback (`@moq/net`). Audio only. | QUIC 1-RTT setup, connection migration, no UDP port per session. The client has its own jitter buffer (`audioLatencyMs`, default 80 ms floor; `audioBufferMaxMs`, default 30 s cap on TTS run-ahead), and an interruption flushes it. | Draft protocol; AEC not covered in the docs; no maturity label either way ([Pipecat MoQ docs]). | Free / relay |
| **FastRTC (Hugging Face)** | Python WebRTC/WebSocket streaming helper [unverified]. | Quick prototypes. | Not a production media plane [unverified]. | Free |

---

## 4. Browser capture: AEC, NS, AGC

### 4.1 Constraints

- `echoCancellation`, `noiseSuppression` and `autoGainControl` are on by default in Chromium and Safari for getUserMedia ([addpipe, updated 2026-05-21]; per-browser tests from Chrome 62 era [stale]).
- `sampleRate` requests are effectively ignored: capture runs at the device or engine rate (48 kHz Chrome/Firefox, 44.1 or 48 kHz Safari), and you resample yourself.
- `getSupportedConstraints()` gives false positives. Verify with `track.getSettings()`. Magic Worlds already records `echoCancellation` from `getSettings()`.
- **New `echoCancellation` string values (Media Capture spec):**
  - `"all"`: cancel all system-generated audio, including screen readers and notifications.
  - `"remote-only"`: cancel only RTCPeerConnection remote audio.
  - `true` must cancel at least `remote-only` and "should attempt" `all` ([MDN, modified 2026-10-08]).
  - A WPT test for `remote-only` exists (Firefox tree). **Chrome shipping status could not be confirmed.** Feature-detect via `getSettings()`.
- `voiceIsolation: true` is a non-standard hint reportedly honoured on iOS/macOS Safari ([VDO.Ninja docs]). MDN has no page for it (404), so treat it as experimental.
- Chrome's old `echoCancellationType: 'browser'|'system'` was an origin trial in 2018 ([Chrome blog, 2018] [stale]). Do not rely on it.

### 4.2 The "Web Audio output is not the AEC reference" problem

- **Classic Chromium behaviour.** Chrome's AEC only considered audio "played from the webrtc remote peer connection" as the far-end reference (W3C public-webrtc-logs, 2019 [stale]; crbug 687574, long open). Audio played through Web Audio (and, by most reports, local media elements) leaks back into the mic. The agent then hears itself, which causes false barge-ins and the bot transcribing its own words.
- **Firefox and Safari** are reported to cancel all of the browser's output, including Web Audio ([atmoky known-issues, via search snippet]; HN thread with a Mozilla engineer, 2024-07 [stale]).
- **"Chrome-wide echo cancellation"** (`chrome://flags#chrome-wide-echo-cancellation`, `BUILDFLAG(CHROME_WIDE_ECHO_CANCELLATION)`):
  - Audio processing moves into Chrome's audio service, so any audio Chrome renders, including `AudioContext` output, can act as the reference (Chromium review, 2022-07 [stale]).
  - Zoom's Web SDK reportedly gates its AudioContext playback path on Chrome ≥111 on macOS/Windows/Linux and ChromeOS ≥116, otherwise falling back to media element + peer connection ([Zoom dev forum, 2026-08-04..17]). These versions come from the forum poster's reading of the minified SDK, not from Zoom documentation.
  - The forum author's caution: this is a **feature-flag default**, "not a guaranteed property of a Chromium version". Zoom staff neither confirmed nor denied that. Microsoft Edge on Windows may not ship it. Zoom staff: "Edge can only cancel the audio played through Edge", and "browsers do not expose an API to detect whether AEC is supported or enabled". There is **no API to detect AEC coverage**.
  - A Chromium security issue (513765687, 2026) mentions a loopback-based AEC reference on Windows/macOS, which suggests system-loopback reference modes are arriving. Details were behind sign-in.
- **The neural residual echo estimator in Chrome desktop (webrtcHacks, 2026-10-06).**
  - A 425 KB TFLite model with about 256k int8 parameters replaces AEC3's residual echo estimator. It is on by default, downloaded at runtime through the optimisation-guide pipeline, and not exposed to script.
  - In the author's test, median near-end WER during echo dropped from **0.500 to 0.235**.
  - **Edge, Electron, Firefox and Safari do not get it**, so behaviour now differs across Chromium-based browsers. Edge runs the same code with the flag on, but it is not a client of Google's model-delivery service, so it never downloads the model.
  - The gain is smallest where echo is worst: in the 0-15 dB baseline-ERLE bucket, WER only drops from 0.600 to 0.545. Speakerphone-heavy setups should not count on it.
  - `echoReturnLossEnhancement` in getStats measures the linear stage only, so it reads lower (about 0.5 dB in the article's example) even though more echo is removed.
- **Workarounds, in order of robustness:**
  1. **Receive the agent's audio as a WebRTC remote track** and play it with `<audio>.srcObject = remoteStream`. This is AEC-correct everywhere and is the main client-side argument for WebRTC.
  2. **WebRTC loopback.** Route your Web Audio graph into a `MediaStreamAudioDestinationNode`, send it through a local `RTCPeerConnection` pair, and play the received track in an `<audio>` element. Stereo needs SDP munging ([atmoky known-issues]). It adds a few ms of jitter-buffer latency.
  3. **Play through an HTMLMediaElement** (MSE or Blob), as Magic Worlds does today. It is covered on Firefox and Safari, and on desktop Chrome where Chrome-wide AEC is active. Reports conflict on whether non-WebRTC media elements are covered without Chrome-wide AEC. **Test on Edge.**
  4. Server-side protection: an echo/self-speech guard that compares STT text with recent TTS text, and requires a minimum speech duration and energy for barge-in. Deepgram's Voice Agent offers "adaptive echo cancellation" server-side ([Deepgram docs, in search results]).
- **Mobile.** Android and iOS route capture through platform voice processing: iOS VPIO; Android VOICE_COMMUNICATION/hardware AEC [unverified for Android specifics]. These generally cancel all device output, but the voice-processing path itself introduces the iOS issues in §8.

### 4.3 Noise suppression and voice isolation

| Option | Where | Added latency | Licence / cost | Notes |
|---|---|---|---|---|
| Browser NS (WebRTC APM) | Client | Small (in the APM) | Free | On by default. LiveKit: "Leaving these WebRTC settings on is strongly recommended when you are not using enhanced noise cancellation" ([LiveKit NC docs, 2026-10]). |
| RNNoise | Client (WASM) or server | About 10 ms | BSD | Good on stationary noise, weak on background voices ([Fora Soft, 2026-06-04, consultancy]). Jitsi ships a WASM build with "very little added latency". |
| DeepFilterNet 3 | Server (or WASM) | About 40 ms algorithmic (2-frame look-ahead, 20 ms windows) | MIT/Apache | Best open-source quality in a 2026 academic comparison; RTF about 0.19 on one laptop thread ([arXiv 2205.05474, 2022, stale]; [Fora Soft]). |
| Krisp NC / BVC / **VIVA** (voice isolation; Turn Prediction v3; Interrupt Prediction v1) | Server, before VAD/STT (VIVA); client JS (BVC) | About 15-25 ms [vendor] (the 2025 launch coverage says VIVA "processes audio in under 20 milliseconds" [SiliconANGLE]) | Commercial | VIVA 2.0 launched 2026-05-06: Voice Isolation v3, Turn Prediction v3, Interrupt Prediction v1, plus TTS, accent and gender "signal detectors". More than 12B min/yr, embedded in more than 130 voice-AI products, integrated in Daily, Vapi, LiveKit, Ultravox, Telnyx and others ([SpeechTechMag, 2026-05-06] [vendor]). The "background voices raise WER from 5% to over 30%" figure is not in that article (unverified). LiveKit charges $0.0012/min for voice isolation. |
| ai-coustics Quail / Voice Focus | Server | About 30 ms [vendor] (unverified) | Commercial | Up to 25% lower WER claimed [vendor] (unverified). Tuned for STT, not human listeners. LiveKit Cloud offers `QUAIL_L` for background-noise suppression at no extra cost and **Voice Focus 2.1** (`QUAIL_VF_S` / `QUAIL_VF_L`) as paid voice isolation, alongside Krisp VIVA and a Krisp VIVA telephony variant ([LiveKit NC docs]). |

**Placement and stacking rules:**
- Run enhancement **on the server, before VAD and STT** ([BlogGeek, 2026]; [Fora Soft]).
- **Do not stack** a client-side enhanced model with a server-side one. LiveKit: it "might produce unexpected results if the input has already been processed by a noise cancellation model in the frontend". Standard browser NS/AEC can stay on.
- Use voice isolation for 1:1 calls, because it removes TV and household voices that otherwise trigger false barge-ins.

### 4.4 AGC

- Browser AGC changes input levels over time. That breaks fixed-energy VAD thresholds and can pump background noise up during silence.
- Prefer a model-based VAD (Silero/WebRTC VAD style) that is robust to gain, or normalise on the server.
- Safari historically did not expose AGC or NS toggles ([addpipe] [stale]).
- On macOS, Safari's voice processing lowers other apps' capture levels while active ([Apple dev forum 832452]).

---

## 5. AudioWorklet best practices and sample-rate conversion

- **Render quantum is 128 frames**, about 2.7 ms at 48 kHz. `process()` must never allocate, block, or post a message per quantum.
- **Use a lock-free SPSC ring buffer on a SharedArrayBuffer** between the main thread or a Worker and the worklet. Do the heavy DSP (resampling, decoding, VAD models) in a Worker or WASM, and keep the worklet as a thin "audio sink" ([Chrome AudioWorklet design pattern, 2018 [stale] but still canonical]; [ringbuf.js]).
- SharedArrayBuffer requires **cross-origin isolation** (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp` or `credentialless`). This affects third-party embeds and OAuth popups, so check the impact before enabling it. A `MessagePort` with transferable buffers in 20-40 ms batches is an acceptable fallback.
- **Underrun behaviour.** Once a worklet falls behind it cannot catch up at its fixed rate. Your choices are a larger permanent buffer or adaptive time-stretching ([W3C public-webrtc-logs, 2025-12, guidou]). Pre-roll a small target buffer (40-120 ms) and output silence (not stale data) on underrun.
- **Sample-rate conversion.**
  - Let the AudioContext run at the hardware rate for playback.
  - For capture, either do what Magic Worlds does (a 16 kHz AudioContext; the browser resamples the MediaStreamSource) or capture at the native rate and decimate with a proper low-pass filter (polyphase/sinc) in the worklet or WASM. Naive sample dropping aliases and hurts STT.
  - Firefox ≤147 cannot connect a mic stream to a context running at a different rate; Magic Worlds already handles this.
  - For TTS playback, request the provider's native rate (e.g. `pcm_24000`) and let one AudioContext resample, rather than resampling twice.
- **Use one shared AudioContext per call.** Creating many contexts is costly and, on iOS, interacts badly with audio-session switching.
- **Glitch telemetry.** `AudioContext.playbackStats` (WICG "Playout Statistics", a standalone WICG proposal, not yet in the Web Audio spec; marked experimental on MDN, modified 2026-05-16) returns an `AudioPlaybackStats` object. Its fields in the proposal are `fallbackFramesDuration` and `fallbackFramesEvents` (underruns, played as silence in Chromium), `totalFramesDuration`, and `averageLatency` / `minimumLatency` / `maximumLatency` (reset with `resetLatency()`). The proposal *suggests*, as privacy mitigations, updating only once per second and only when the page is visible or has getUserMedia permission ([WICG web_audio_playout]). Shipping status in Chrome was not confirmed (MDN's compat table did not load); feature-detect it.

---

## 6. Low-latency playback of streamed TTS

### 6.1 Options

| Approach | Start-up latency | Gapless | Position accuracy (for truncation) | AEC (desktop Chrome) | iOS | Verdict |
|---|---|---|---|---|---|---|
| **MSE + MP3 chunks on `<audio>`** (current) | Opaque. The element must buffer enough to start; an MP3 decoder needs whole frames (about 26 ms at 44.1 kHz) plus encoder delay and padding [unverified exact]. Partial MP3 to an element "tends to stall" ([smallest.ai]). | Yes within a SourceBuffer | `currentTime` is coarse; output latency is not included | Media element: covered where Chrome-wide AEC is active | ManagedMediaSource (17.1+) only appends while `streaming`; Magic Worlds already needs a 2 s stall fallback to Blob | Works; hard to tune; weakest on iPhone |
| **`decodeAudioData` per chunk + scheduled AudioBufferSourceNodes** | Low if chunks are self-contained (WAV/PCM) | **No** for MP3/AAC chunks: each decode has priming and padding, so you get clicks or gaps unless split on frame boundaries ([musicat discussion]) | Good (scheduled times) | Web Audio: depends on Chrome-wide AEC | OK | Use only for PCM/WAV chunks |
| **PCM (16/24 kHz) → AudioWorklet ring buffer** | Lowest. Plays as soon as the pre-roll target (40-100 ms) is filled. | Yes, by construction | **Sample-exact.** Played = samples consumed − `outputLatency`×rate | Web Audio: needs Chrome-wide AEC or a loopback | Works; subject to the iOS voice-processing bugs (§8) | **Recommended for WebSocket transport** |
| **Opus packets → WebCodecs `AudioDecoder` → worklet** | Low; about 8-10× less bandwidth than PCM | Yes | Sample-exact | Same as above | `AudioDecoder` in Safari/iOS **26.0+**, Chrome 94+, Firefox 130+ ([caniuse], 2026-10-20) | Best WebSocket option if the TTS can emit raw Opus. ElevenLabs offers `opus_48000_{32..192}` ([ElevenLabs convert API]); the container may be Ogg and need demuxing [unverified]. |
| **WebRTC remote track → `<audio>.srcObject`** | Jitter buffer about 20-200 ms; the server paces audio | Yes | The server knows how much it sent; played ≈ sent − jitter buffer. OpenAI auto-truncates with this. | **Correct everywhere** (remote track is the AEC reference) | Good | **Best overall** if you adopt WebRTC |

TTS provider formats relevant here:
- **ElevenLabs:** `pcm_{8000,16000,22050,24000,32000,44100,48000}`, `ulaw_8000`, `alaw_8000`, `mp3_*`, `opus_48000_{32,64,96,128,192}`, `wav_*`. `pcm_44100` needs the Pro tier ([ElevenLabs convert API]). "Higher-quality audio output formats can increase latency" ([ElevenLabs latency doc]).
- **Fish Audio:** supports `pcm`/`wav`/`mp3`/`opus` [unverified; docs URL 404].
- **Gemini Live / OpenAI:** both output PCM16 24 kHz.

### 6.2 Jitter-buffer sizing for a WebSocket PCM player

- TTS generally produces audio faster than realtime. After the first chunk the buffer fills quickly, so underruns mostly come from **TTS first-chunk gaps between sentences** and **TCP stalls**, not steady-state rate.
- A pre-roll target of about 60-100 ms of audio before starting is a reasonable default. Start immediately if `is_final` arrives earlier. Grow the target adaptively after an underrun, for example +40 ms up to 250 ms.
- Between sentences, play silence rather than "stopping and restarting", so the playback clock stays continuous and the played-samples count is exact.
- On barge-in, flush the ring buffer (drop the read pointer to the write pointer) with a 5-10 ms fade-out to avoid a click. The truncation position is then the samples consumed at that moment.

### 6.3 Measuring what the user actually heard

- `heardMs = (framesConsumedByWorklet − framesOfPrerollSilence) / sampleRate × 1000 − outputLatency × 1000`. Here `AudioContext.outputLatency` is supported in Chrome/Edge 102+, Firefox 70+ and Safari/iOS 18.4+, and is Baseline 2025 (newly available since March 2025) ([web.dev audio-output-latency]; [caniuse]; [MDN]).
- `getOutputTimestamp()` maps context time to `performance.now()` and is Baseline. Use it to timestamp barge-in against playback.
- Bluetooth output adds 100-300 ms of device latency [unverified range]. `outputLatency` may or may not report it accurately; Firefox with `resistFingerprinting` reports a generic value.
- For the existing MSE path: `audio.currentTime` lags real audible output by the device output latency and moves in coarse steps. Subtract an estimated `outputLatency` from a shared AudioContext when available.
- For WebRTC: the receiver's `getStats()` `inbound-rtp` exposes `jitterBufferDelay`/`jitterBufferEmittedCount`, which gives the current playout delay. Played ≈ last sent timestamp − (jitter buffer delay + output latency).

### 6.4 Gapless and autoplay

- **Unlock audio on the user gesture that starts the call.** Resume the shared AudioContext and `play()` a primed element inside the click handler. Chrome applies its autoplay policy to Web Audio: a context created before a gesture starts `suspended` ([Chrome autoplay policy, 2017/updated for M71] [stale but current behaviour]). Magic Worlds already has a priming owner and a `blocked` state; keep it.
- Keep **one** element or context alive for the whole call. Do not swap `src` mid-reply (it restarts from 0); Magic Worlds already avoids this.

---

## 7. WebTransport and MoQ status (October 2026)

- **WebTransport is Baseline.** Supported in Chrome 97+, Edge 98+, Firefox 114+, Safari/iOS **26.4+** (2026-03-24) and Samsung Internet 18+ ([caniuse]; [WebKit Safari 26.4 post]). It is a focus area of Interop 2026 (alongside WebRTC) ([WPT interop 2026 README]). Safari's implementation can run "over HTTP/2 and TCP as a fallback with the same API" ([WebKit 26.4]). The spec is still a W3C Working Draft.
- **What you get:** QUIC streams without cross-stream HOL blocking, unreliable datagrams, 1-RTT setup, and connection migration. On the HTTP/2 fallback you are back on TCP, with HOL blocking.
- **What you don't get:**
  - no media-aware congestion control ("does not have equivalent algorithms yet" to GCC, [webrtc.ventures, 2026-04-23]);
  - **no AEC/NS/AGC coupling** ([webrtc.ventures]);
  - no jitter buffer, and you encode and decode yourself with WebCodecs. These two follow from the API design; webrtc.ventures does not state them explicitly.
- **MoQ** (Media over QUIC) is still an IETF draft. webrtc.ventures cites draft-17 in March 2026. The datatracker shows **`draft-ietf-moq-transport-22`** (2026-10-01), a WG document with a milestone to request IESG publication in Dec 2026. Production use exists in controlled environments, and "universal browser-based MoQ" is projected as "a 2026 to 2027 story" ([webrtc.ventures]). Pipecat ships a MoqTransport (WebTransport with a raced WebSocket fallback, Opus broadcast, an 80 ms default client jitter buffer) ([Pipecat MoQ docs]). Curley himself writes that "MoQ isn't a perfect fit for Voice AI either" and that its cache and fan-out semantics "are useless for 1:1 audio" ([moq.dev]).
- **Assessment:** WebTransport + WebCodecs + a worklet is a valid "WebSocket done right" upgrade path for client-server audio, because it removes TCP HOL blocking. But it still needs your own jitter buffer and an AEC strategy. Watch, prototype if you like, and do not bet the roadmap on it.

---

## 8. iOS Safari and Android Chrome quirks

### 8.1 iOS / iPadOS Safari (all iOS browsers use WebKit)

- **Crackle regression (WebKit 326286, filed 2026-10-04, status NEW, P2/Major, rdar://189580741).**
  - On iOS 26.2→27, page audio crackles while a getUserMedia track with `echoCancellation:true` is open. It affects both Web Audio and `<audio>`.
  - Reproduced on iPhone 16 and iPhone 16 Pro (iOS 27.0.1) and on iPhone 17/18 demo units on iOS 27; clean on iPhone SE with iOS 18.7 and 26.2; clean on macOS and Android. A second reporter confirmed it with a 440 Hz tone through an AudioWorklet (2026-10-08).
  - `latencyHint:'playback'`, a single context, and creating the context after the mic opens all fail to help. Audio state persists across reloads; only fully closing Safari makes results consistent.
  - With EC off, playback is clean but routes to the earpiece at much lower volume.
  - A native app using `AVAudioSession` `playAndRecord` + `defaultToSpeaker` **without voice processing** plays cleanly on the same device, which points at WebKit's voice-processing path.
  - As of the last modification (2026-10-09) it is unassigned, with no patch.
  - **This affects the Magic Worlds call experience directly on current iPhones.**
- **Degraded output with mic open (WebKit 311451, filed 2026-04-03, NEW, component WebRTC, severity Normal, last modified 2026-10-08).** After getUserMedia, playback drops sample rate and stereo becomes mono for the rest of the session. The reporter says it is more pronounced on higher-quality output devices; a commenter describes tinny audio with static on AirPods. `echoCancellation:false` does not help. The original report says macOS Safari is unaffected, but a later comment says it persists on the macOS 27 public beta, so macOS status is inconsistent. Expect TTS voice fidelity (which matters for character voices) to be lower on iPhone during calls.
- **Volume drop after capture starts** (WebKit 262759, closed WONTFIX). Setting `navigator.audioSession.type='play-and-record'` before getUserMedia did not reliably fix it. A WebKit engineer pointed to the audio-category switch at capture start. Anecdotal workaround: suspend and resume the AudioContext after capture starts (WebKit 219424 [stale]).
- **Audio Session API** (`navigator.audioSession.type` = `auto|playback|transient|transient-solo|ambient|play-and-record`, plus a `statechange` event for interruptions). It is WebKit-only and "limited availability/experimental" ([MDN, 2026-08-19]). Set `play-and-record` before getUserMedia and listen for interruptions such as phone calls and Siri, so a call can show "paused".
- **ManagedMediaSource** (Safari macOS 17.0+, iOS 17.1+, the only MSE on iPhone; not in Chrome, Edge or Firefox per caniuse) appends only while `streaming === true`. Magic Worlds already detects a stall and falls back to Blob after 2 s, which is a 2 s penalty when it triggers.
- **Background and lock screen.** Capture is typically suspended when Safari is backgrounded or the screen locks [unverified for iOS 27]. Handle `track.onmute`/`onended` and AudioContext `interrupted`/`suspended`, and show a "call paused" state rather than letting VAD time out.
- **WebTransport (26.4+) and WebCodecs `AudioDecoder` (26.0+)** are now available. Safari 26.4 also improved echo cancellation for multi-mic capture on macOS and fixed EC-disable leaking across tracks ([WebKit 26.4]).

### 8.2 Android Chrome

- **Bluetooth.** Opening the mic on a Bluetooth headset switches it from A2DP (high-quality stereo) to HFP/HSP (narrowband or wideband mono, 8/16 kHz). TTS playback then sounds like a phone call. Web apps cannot control this; LE Audio (LC3) headsets do better [unverified; well-known platform behaviour]. The same applies on iOS.
- **Platform AEC.** Chrome on Android generally relies on the platform's voice-communication AEC [unverified specifics], which covers all device output but varies in quality across OEMs. Test on Samsung, Pixel and a low-end device.
- **Autoplay.** Requires a gesture unless the site is installed to the home screen ([Chrome autoplay policy]).
- Chrome for Android only shows `AudioDecoder` and WebTransport at v155 on caniuse, probably a data artefact. Feature-detect.

### 8.3 Background tabs (desktop)

- Chrome's intensive timer throttling (wake-ups limited to once per minute after 5 min hidden) is **not applied while a `MediaStreamTrack` is live, an RTCPeerConnection has an open data channel, or audio played in the last 30 s** ([Chrome 88 throttling post, 2021] [stale]). A live call with an open mic is therefore safe. But a WebSocket heartbeat timer during a long silent period without a live track could be throttled.
- Firefox and Safari have their own throttling. Prefer server pings with client pongs, plus a liveness timeout, which Magic Worlds already uses (25 s heartbeat / 50 s liveness).

### 8.4 Mic-on indicators and privacy

- Browsers show a recording indicator (Chrome tab and address-bar icon; the iOS orange dot; macOS menu-bar) while any audio track is live. `track.enabled = false` keeps the device open (and, in Chrome, the indicator lit). `track.stop()` releases it.
- **Good practice:**
  - Stop all tracks when the call ends or is paused for long.
  - Show an in-app mic state that matches the OS indicator.
  - Never keep the mic open outside a call.
  - Re-acquire on resume. Permission persists per origin, though iOS may re-prompt [unverified].

---

## 9. Server placement, network resilience, reconnection

### 9.1 Placement

- **Physics.** Light in fibre travels about 200,000 km/s. Singapore↔US-East is about 150 ms RTT in theory and 230-280 ms in practice ([LiveKit, 2026] [vendor]). The ITU-T G.114 target is 150 ms one-way mouth-to-ear ([Fora Soft]).
- **First hop.** Managed WebRTC edges give a short, well-peered first hop: Daily P50 13 ms across about 75 PoPs; Cloudflare 330+ cities; OpenAI global relays plus its backbone. For WebRTC servers without mesh routing, Daily says the extra server-to-agent hop adds 10-100 ms, depending on deployment and user location ([Daily, 2025-07-21] [vendor]).
- **Co-location.** The cascaded pipeline makes several sequential upstream calls per turn: BFF → STT, BFF → LLM service → provider, BFF → TTS. Each **first-byte** pays the RTT to that provider.
  - Put the voice gateway in the **same cloud region as the STT, LLM and TTS endpoints**. ElevenLabs serves from the USA, the Netherlands and Singapore (check the `x-region` header; `api.us.elevenlabs.io` pins the US). Flash WebSocket TTFB is about 100-150 ms in NA/EU/SEA and 150-200 ms in South and Northeast Asia ([ElevenLabs latency doc] [vendor]).
  - **Keep TTS WebSockets, HTTP/2 connections to STT and LLM, and TLS sessions warm.** Open the TTS context when the turn starts (or speculatively during STT), not after the first LLM token.
- **Users.** For English and Spanish users across the US, LatAm and Spain, US-East is a reasonable single region. Expected RTTs are roughly 20-80 ms within the US, 110-180 ms from South America, and 80-110 ms from Spain [unverified typical values]. A managed edge (Daily, LiveKit or Cloudflare) can cut the jitter and loss on the long-haul part even when compute stays in one region.

### 9.2 Resilience

- **WebSocket:** session resume by id + seq (Magic Worlds has `voice_resume`, a 15 s window, and 20 s server grace). Also needed:
  - replay of un-acked downlink audio chunks by `seq`, or a clean "turn lost, regenerate" path;
  - listening to `online`/`offline` and `navigator.connection` change events to reconnect proactively;
  - jittered exponential backoff (already capped at 4 s during resume).
- **WebRTC:** ICE restart on network change. TURN over TLS 443 is the final fallback for corporate and hotel networks ([Metered, 2026] [vendor]). Measure call setup time and data-channel open time ([BlogGeek]).
- **QUIC/WebTransport:** connection migration across IP changes (Wi-Fi↔LTE) without renegotiation ([moq.dev]).
- **Observability to add** ([BlogGeek, 2026]):
  - per-call RTT, loss, jitter, bitrate, setup time;
  - client underruns and `outputLatency`;
  - upload duration per segment;
  - first-audio-chunk-received → audible delay;
  - the AEC settings actually applied (`getSettings()`);
  - browser, OS and output device type (Bluetooth or not).

---

## 10. Classification

### (a) Established best practice
- WebRTC (UDP/Opus) for client↔server realtime voice; WebSocket for server↔server and telephony ([OpenAI], [Pipecat], [Daily], [Cloudflare], [LiveKit]).
- Stream audio continuously in 20 ms frames. **Never upload whole utterances after end of speech** in a latency-critical path.
- Binary frames, not base64/JSON, for audio over WebSocket.
- Opus mono about 24-32 kbps for speech; no DTX if the server does VAD ([BlogGeek]).
- Browser AEC/NS/AGC on by default; agent audio delivered as a WebRTC remote track (AEC-correct) or via the loopback workaround.
- Noise suppression or voice isolation before VAD/STT on the server; no double-stacking of enhancement models.
- An AudioWorklet with a ring buffer for both capture and playback; no allocation in `process()`; heavy DSP in a Worker or WASM.
- Unlock audio on the call-start gesture; one AudioContext per call.
- TURN on TCP/TLS 443 provisioned from day one.
- Co-locate the voice gateway with model providers; keep upstream connections warm.

### (b) Current SOTA / leading options
- OpenAI's relay/transceiver WebRTC architecture (2026-05) and server-side playout tracking with auto-truncation.
- Managed WebRTC agent platforms: LiveKit (Cloud/OSS), Daily/Pipecat Cloud. Self-hosted serverless WebRTC: Pipecat SmallWebRTC. Hybrid: Cloudflare Realtime SFU + WebSocket adapter.
- Chrome desktop's neural residual-echo estimator (2026-10).
- Krisp VIVA 2.0 (voice isolation + turn/interrupt prediction), ai-coustics Quail and Voice Focus.
- RED (distance 2) for audio loss resilience.

### (c) Emerging / experimental
- WebTransport (Baseline since 2026-03) + WebCodecs audio pipelines; MoQ (IETF draft; Pipecat MoqTransport).
- WARP (faster WebRTC setup for OpenAI's voice APIs: DTLS 1.3 + SNAP + SPED + pre-negotiated data channel; SNAP is a Chrome 151-156 origin trial, SPED has no browser trial).
- Opus DRED (neural redundancy; IETF draft in WG Last Call; not in browsers).
- `echoCancellation: "all" | "remote-only"`; system-loopback AEC references.
- `AudioContext.playbackStats` (playout statistics).
- `navigator.audioSession` (WebKit).

### (d) Pitfalls / anti-patterns
- Playing agent audio through Web Audio on desktop Chromium and assuming AEC covers it. This is not guaranteed (Edge, Electron, flag-dependent) and causes self-barge-in.
- Uploading whole utterances or files after the VAD end; base64 PCM in JSON at 10× the Opus bitrate.
- `decodeAudioData` on arbitrary MP3 chunk boundaries (clicks and gaps).
- Using `audio.currentTime` (without output latency) as "what the user heard" for truncation.
- No TURN (or UDP-only TURN), which leads to silent connection failures for a meaningful share of users (the "5-15%" figure is (unverified): the Metered post gives no sourced percentage and explicitly rejects blanket relay-rate numbers) and effectively 100% on UDP-blocking corporate networks.
- Stacking client Krisp and server Krisp/VIVA, or enabling DTX with server-side VAD.
- Creating AudioContexts before a user gesture; swapping `<audio>.src` mid-reply.
- Running the voice gateway far from TTS and STT regions; opening the TTS socket only after the first LLM token.
- Ignoring iOS: no handling of audio-session interruptions, assuming EC works cleanly on iOS 27, and Bluetooth HFP degradation.

---

## 11. Implications for Magic Worlds (prioritised)

Context: the cascaded pipeline is kept for now. The team may later adopt a speech-to-speech model.

### P0: highest impact, compatible with the current WebSocket architecture

1. **Stream the uplink instead of uploading utterances (biggest latency win on the transport side).**
   - Send mic audio continuously, as soon as client VAD detects speech onset (with 200-300 ms pre-roll), as **binary WebSocket frames** of 20-40 ms on the existing voice socket, or on a dedicated media socket.
   - Use PCM16 16 kHz to start; use Opus via WebCodecs `AudioEncoder` where available for about 8× less uplink.
   - Keep client VAD as a hint and the server VAD as the authority.
   - This removes "full utterance upload + HTTP overhead" from the post-speech critical path, which is likely 100-600 ms on mobile uplinks (arithmetic in §1; measure it). It is also the prerequisite for streaming STT with partials and smarter turn detection (see the STT/turn-taking research topics).
   - Relax the client "no audio over socket" guard deliberately and document why.
2. **Measure before and after.** Add client telemetry for:
   - segment upload duration and bytes;
   - downlink first-chunk-received → `playing` delay (MSE start-up);
   - underruns;
   - `outputLatency`;
   - applied `getSettings()` (EC/NS/AGC);
   - output device class (Bluetooth or not);
   - browser and OS.

   Aggregate p50/p95 per platform. Without this, it is not possible to tell whether MSE start-up or upload time dominates.
3. **iOS 26.2-27 crackle and quality bugs.**
   - Reproduce on an iPhone running iOS 27.
   - Set `navigator.audioSession.type = 'play-and-record'` before getUserMedia (feature-detected).
   - Handle audio-session `statechange` and track mute as "call paused".
   - Consider offering a "headphones mode" (EC off) on iOS when wired or Bluetooth output is detected. Follow WebKit 326286 and 311451, and file or upvote with a Magic Worlds repro.
4. **Downlink: drop base64-in-JSON.**
   - Send audio chunks as binary WebSocket frames with a tiny header (turn id, seq), or JSON control frames plus binary payload frames.
   - At minimum, this saves 33% bytes and main-thread JSON parsing per chunk.

### P1: playback engine and echo robustness (weeks)

5. **Add a PCM/Opus → AudioWorklet ring-buffer player** as the primary path, keeping the MSE/Blob path as fallback.
   - Request `pcm_24000` from ElevenLabs (or `pcm_16000` to save bandwidth), and the PCM option from Fish. Optionally use `opus_48000_32/64` plus WebCodecs `AudioDecoder` (Safari/iOS 26+, Chrome 94+, Firefox 130+) for low bandwidth. Prototype the Opus container handling first.
   - **Benefits:**
     - deterministic start after about 60-100 ms of pre-roll, instead of MSE's opaque buffering and the iPhone 2 s stall fallback;
     - true gapless playback across sentences and providers;
     - **sample-exact `played_ms`** for truncation (frames consumed − `outputLatency`), which makes "truncate reply to what was heard" accurate;
     - a fast fade-out flush on barge-in.
   - **Echo safeguard (required with this change):** on desktop Chromium, route the worklet output through a `MediaStreamAudioDestinationNode` → **local RTCPeerConnection loopback** → `<audio>` element, at least on Edge and when Chrome-wide AEC cannot be assumed. Firefox and Safari can play directly.
   - A/B test self-barge-in rates by browser.
6. **Server-side echo and self-speech guard.** Before accepting a barge-in, require a minimum speech duration and energy. Reject STT results that fuzzy-match the last 3-5 s of the agent's own TTS text. This is a cheap backstop for any AEC leak, including Bluetooth and speakerphone cases.
7. **Server-side noise suppression or voice isolation before the server VAD gate and Groq STT.**
   - Start with RNNoise (BSD, about 10 ms) as a free baseline on the backend.
   - Evaluate Krisp VIVA or ai-coustics if false barge-ins from TVs and background voices show up in telemetry.
   - Keep browser NS on, and do not add a client-side enhancement model.

### P2: adopt WebRTC for the media plane (1-2 months; strongest long-term fix)

8. **Move media to WebRTC and keep the WebSocket (or a data channel) for control.** Cheapest path for the FastAPI backend: **Cloudflare Realtime SFU + WebSocket adapter.**
   - The browser speaks WebRTC (Opus, FEC/RED, NetEQ, AEC-correct remote track, ICE restart).
   - The backend keeps receiving and sending PCM over a WebSocket.
   - About $0.05/GB egress with 1 TB/month free [vendor]. At about 40-60 kbps of audio per direction, 1 TB covers tens of thousands of call-hours.

   Alternatives:
   - **Pipecat SmallWebRTC (aiortc)** inside the voice service, plus TURN (Cloudflare TURN or coturn on 443/TLS). Good for self-hosting, but limited at scale.
   - **LiveKit Cloud/OSS** if the team wants the agents framework, Krisp integration and global mesh (agent sessions $0.01/min after included minutes).

   With WebRTC, the server paces audio at realtime and knows how much it has sent. `played_ms` then becomes "sent − jitter-buffer delay − output latency" (OpenAI does this server-side). Truncation stays accurate without client cooperation.
9. **This also prepares the speech-to-speech future.** OpenAI Realtime and GPT-Live recommend WebRTC, and Gemini Live is reachable over WebRTC through LiveKit, Pipecat and Daily. A WebRTC media plane with a server-side bridge lets the team swap a cascaded pipeline for an S2S model per character without changing the client.

### P3: placement and resilience

10. **Co-locate the voice gateway** (the BFF voice routes plus the agent-graph service) in the same region as Groq STT, the LLM providers behind `api.magic_llm`, and ElevenLabs or Fish. Pin ElevenLabs to the matching region (`api.us.elevenlabs.io` if US).
    - Pre-open the TTS WebSocket context at turn start.
    - Keep HTTP/2 keep-alive to STT and LLM.
    - Measure per-hop TTFB in traces.
    - If a large LatAm or Spain user base materialises, use a managed WebRTC edge (Daily, LiveKit or Cloudflare) rather than multi-region compute first.
11. **Reconnection.**
    - Add proactive reconnect on `online` and connection-type change.
    - On resume, replay missed downlink audio chunks by `seq`, or cleanly regenerate.
    - For WebRTC, implement ICE restart and force-relay testing.
    - Keep the current 15 s resume window below the 20 s server grace.
12. **Mic indicator hygiene.** Stop tracks at call end and on long pause, and re-acquire on resume. Show in-app mic state that matches the OS indicator. Never keep capture running outside a call. This matters for user trust on an 18+ companion app.

### Watch list (re-evaluate in about 6 months)
- WebTransport + WebCodecs (Baseline) and MoQ (Pipecat MoqTransport).
- WARP setup acceleration (whether SPED ships by default in Chrome; the SNAP origin trial ends at Chrome 156). Even without full WARP, the pre-negotiated data channel trick is usable today.
- `echoCancellation:"all"` shipping in Chrome; Chrome-wide AEC behaviour in Edge.
- Whether RED for Opus is on by default in Chrome (status unconfirmed; check SDP).
- `AudioContext.playbackStats` shipping.
- Fixes for WebKit 326286 and 311451.
- Opus DRED in libwebrtc.

---

## Sources

Dates are publication or last-update dates where shown; "accessed" means no date was shown and the page was read on 2026-10-20. [vendor] = vendor-authored. [stale] = more than 12 months old.

1. BlogGeek.me, "WebRTC for Voice AI: How the transport layer works in 2026 (and where it's headed)": https://bloggeek.me/voice-ai/ (c. June 2026, inferred from image paths and copyright)
2. Luke Curley (kixelated), "WebRTC is the problem", moq.dev: https://moq.dev/blog/webrtc-is-the-problem (2026-05-06)
3. LiveKit, "Why WebRTC beats WebSockets for voice AI agents": https://livekit.com/blog/why-webrtc-beats-websockets-for-voice-ai-agents (2026-03-23) [vendor]
4. OpenAI, "How OpenAI delivers low-latency voice AI at scale": https://openai.com/index/delivering-low-latency-voice-ai-at-scale/ (2026-05-04; 403 to fetcher). Summary used: https://www.swequiz.com/articles/openai-low-latency-voice-ai (2026-05-04)
5. OpenAI developer docs, Realtime/GPT-Live WebSockets guide: https://developers.openai.com/api/docs/guides/realtime-websockets (accessed 2026-10-20)
6. OpenAI developer docs, Realtime WebRTC guide (incl. WARP mention): https://developers.openai.com/api/docs/guides/realtime-webrtc (accessed 2026-10-20)
7. OpenAI developer docs, Realtime conversations (truncation): https://developers.openai.com/api/docs/guides/realtime-conversations (accessed 2026-10-20)
8. InfoQ, OpenAI GPT-Live: https://infoq.com/news/2026/09/openai-gpt-live (2026-09)
9. Pipecat docs, "Choosing a transport": https://docs.pipecat.ai/client/concepts/choosing-a-transport (accessed 2026-10-20)
10. Pipecat docs, SmallWebRTCTransport: https://docs.pipecat.ai/server/services/transport/small-webrtc (accessed 2026-10-20)
11. Pipecat docs, Transports guide: https://docs.pipecat.ai/guides/learn/transports (accessed 2026-10-20)
12. Pipecat docs, MoQ transport (JS client / server): https://docs.pipecat.ai/api-reference/client/js/transports/moq ; https://docs.pipecat.ai/api-reference/server/services/transport/moq.md (accessed 2026-10-20)
13. Daily (Kwindla Hultman Kramer), "You don't need a WebRTC server for your voice agents": https://www.daily.co/blog/you-dont-need-a-webrtc-server-for-your-voice-agents/ (2025-07-21) [vendor]
14. Cloudflare blog, realtime voice AI (Realtime SFU WebSocket adapter, smart-turn on Workers AI): https://blog.cloudflare.com/cloudflare-realtime-voice-ai (2025-08-29, modified 2026-07-15) [vendor]
15. Cloudflare Realtime SFU pricing: https://developers.cloudflare.com/realtime/sfu/platform/pricing/ (2026-09-22) [vendor]
16. Cloudflare RealtimeKit pricing: https://developers.cloudflare.com/realtime/realtimekit/pricing/ (updated 2026-10-19) [vendor]. (The product page https://www.cloudflare.com/products/realtime shows no prices; corrected 2026-10-20.)
17. LiveKit pricing: https://livekit.com/pricing (accessed 2026-10-20) [vendor]
18. LiveKit docs, Noise & echo cancellation: https://docs.livekit.io/home/cloud/noise-cancellation/ (accessed 2026-10-20) [vendor]
19. Google, Gemini Live API docs: https://ai.google.dev/gemini-api/docs/live-api (2026-10-06)
20. webrtc.ventures, "WebTransport Is Now Baseline…": https://webrtc.ventures/2026/04/webtransport-is-now-baseline-what-it-means-for-real-time-media/ (2026-04-23)
21. WebKit, "WebKit Features for Safari 26.4": https://webkit.org/blog/17862/webkit-features-for-safari-26-4/ (2026-03-24)
22. caniuse, WebTransport: https://caniuse.com/webtransport (accessed 2026-10-20)
23. caniuse, WebCodecs AudioDecoder: https://caniuse.com/mdn-api_audiodecoder (accessed 2026-10-20)
24. webrtcHacks (Philipp Hancke), "Google Chrome downloads a new neural AEC while you are not looking": https://webrtchacks.com/chrome-neural-echo-cancellation/ (2026-10-06)
25. Zoom Developer Forum, "isSupportChromeWideAEC() sniffs browser name + version…": https://devforum.zoom.us/t/issupportchromewideaec-sniffs-browser-name-version-breaking-echo-cancellation-on-microsoft-edge/145288 (2026-08-04 to 2026-08-17)
26. Chromium code review, "Chrome-wide echo cancellation: Allow all sample rates…": https://groups.google.com/a/chromium.org/g/feature-media-reviews/c/4zL3X_JYH3Y (2022-07-04) [stale]
27. Chromium issue 513765687 (loopback AEC reference security report): https://issues.chromium.org/issues/513765687 (2026; details behind sign-in)
28. Hacker News, "Ask HN: How do browsers isolate internal audio from microphone input?": https://news.ycombinator.com/item?id=40918152 (2024-07-09) [stale]
29. atmoky, Known Issues & Workarounds (Chromium AEC + WebAudio loopback workaround): https://docs.atmoky.com/known-issues (undated; read via search snippet, TLS error on fetch)
30. W3C public-webrtc-logs (Chrome only cancels remote peer audio): https://lists.w3.org/Archives/Public/public-webrtc-logs/2019Apr/0232.html (2019-04) [stale]
31. MDN, MediaTrackConstraints.echoCancellation: https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/echoCancellation (2026-10-08)
32. MDN, Audio Session API: https://developer.mozilla.org/en-US/docs/Web/API/Audio_Session_API (2026-08-19)
33. MDN, AudioContext.playbackStats: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/playbackStats (2026-05-16)
34. WICG, Web Audio Playout Statistics proposal: https://github.com/WICG/web_audio_playout (accessed 2026-10-20)
35. WebKit Bugzilla 326286, "REGRESSION (iOS 26.2 - 27): Audio output crackles while getUserMedia mic capture with echo cancellation is active": https://bugs.webkit.org/show_bug.cgi?id=326286 (2026-10-04, modified 2026-10-09)
36. WebKit Bugzilla 311451, "Degraded audio quality with microphone enabled": https://bugs.webkit.org/show_bug.cgi?id=311451 (2026-04-03, modified 2026-10-08)
37. WebKit Bugzilla 262759 (play-and-record volume drop, WONTFIX): https://bugs.webkit.org/show_bug.cgi?id=262759 (c. 2023) [stale]
38. WebKit Bugzilla 219424 (suspend/resume workaround): https://bugs.webkit.org/show_bug.cgi?id=219424 (c. 2020) [stale]
39. Apple Developer Forums 832452, "Microphone Gain on Safari/MacOS": https://developer.apple.com/forums/thread/832452 (undated)
40. addpipe, "getUserMedia() Audio Constraints": https://blog.addpipe.com/getusermedia-audio-constraints/ (2017-11-08, updated 2026-05-21; test data from the Chrome 62 era) [stale data]
41. VDO.Ninja docs, voiceIsolation: https://docs.vdo.ninja/advanced-settings/audio-parameters/and-voiceisolation (undated)
42. Chrome for Developers, "More native echo cancellation" (echoCancellationType OT): https://developer.chrome.com/blog/more-native-echo-cancellation (2018-06-19) [stale]
43. Chrome for Developers, "Audio Worklet design pattern": https://developer.chrome.com/blog/audio-worklet-design-pattern (2018-06-18) [stale, still canonical]
44. ringbuf.js (SPSC lock-free ring buffer for AudioWorklet): https://npmjs.com/package/ringbuf.js (accessed 2026-10-20)
45. W3C public-webrtc-logs (guidou on AudioWorklet catch-up): https://lists.w3.org/Archives/Public/public-webrtc-logs/2025Dec/0002.html (2025-12)
46. web.dev, "Synchronize audio and video playback on the web" (outputLatency support): https://web.dev/articles/audio-output-latency (2022-06-01; support table includes Safari 18.4) [stale text]
47. Chrome for Developers, Autoplay policy: https://developer.chrome.com/blog/autoplay (2017, updated for M71) [stale]
48. Chrome for Developers, "Heavy throttling of chained JS timers beginning in Chrome 88": https://developer.chrome.com/blog/timer-throttling-in-chrome-88 (2021-01-18) [stale]
49. ElevenLabs docs, Latency optimization: https://elevenlabs.io/docs/best-practices/latency-optimization (accessed 2026-10-20) [vendor]
50. ElevenLabs API, Text-to-speech convert (output_format enum): https://elevenlabs.io/docs/api-reference/text-to-speech/convert.md (accessed 2026-10-20) [vendor]
51. ElevenLabs API, stream-input WebSocket: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input.md (accessed 2026-10-20) [vendor]
52. Krisp VIVA 2.0 launch coverage, SpeechTechMag: https://speechtechmag.com/Articles/News/Speech-Technology-News/Krisp-Launches-VIVA-2.0-an-Infrastructure-for-Voice-AI-Agents%C2%A0-174689.aspx (2026-05) [vendor claims]
53. SiliconANGLE, Krisp VIVA launch: https://siliconangle.com/2025/07/16/exclusive-krisp-launches-viva-development-kit-enhance-accuracy-voice-ai-agents/ (2025-07-16)
54. Fora Soft, "RNNoise vs DeepFilterNet vs Krisp: Noise Suppression 2026": https://www.forasoft.com/learn/ai-for-video-engineering/articles-ai/real-time-noise-suppression-krisp-rnnoise-deepfilternet (2026-06-04, updated 2026-10) [consultancy]
55. Schröter et al., DeepFilterNet2 (arXiv 2205.05474): https://arxiv.org/pdf/2205.05474 (2022) [stale]
56. Jitsi, "Enhanced noise suppression in Jitsi Meet" (RNNoise WASM): https://jitsi.org/?p=2335 (c. 2021) [stale]
57. BlogGeek glossary, DRED: https://bloggeek.me/webrtcglossary/dred/ (updated Oct 2026)
58. webrtcHacks, "RED: Improving Audio Quality with Redundancy": https://webrtchacks.com/red-improving-audio-quality-with-redundancy/ (2020-08-20) [stale]
59. GStreamer issue 3550 (Chrome RED default since M96, secondary): https://gitlab.freedesktop.org/gstreamer/gstreamer/-/issues/3550 (undated)
60. Metered (dev.to), "TURN for AI voice agents: why agent traffic is almost 100% relay": https://dev.to/alakkadshaw/turn-for-ai-voice-agents-why-agent-traffic-is-almost-100-relay-3meo (2026-07-16) [vendor]
61. Helix, "We killed WebRTC and nobody noticed": https://blog.helix.ml/p/we-killed-webrtc-and-nobody-noticed (2025-12-11)
62. Kausthub, "Deploying voice agents": https://kausthub.substack.com/p/deploying-voice-agents (2025-07-10)
63. AI Engineer World's Fair 2025, "Your realtime AI is NGMI" (Sean DuBois / Kwindla Hultman Kramer): https://ai.engineer/talks/your-realtime-ai-is-ngmi-sean-dubois-openai-kwindla-hultman-kramer-daily (2025-06)
64. smallest.ai, "Streaming TTS in Node.js: transport, codec & buffering guide": https://smallest.ai/blog/streaming-tts-in-nodejs-transport-codec-and-buffering-guide (undated) [vendor]
65. Speechify, "Streaming TTS directly to the browser with Web Audio API": https://speechify.ai/blog/streaming-tts-to-the-browser-with-web-audio-api (undated) [vendor]
66. musicat discussion #6 (chunked MP3 decoding at frame boundaries): https://github.com/basharovV/musicat/discussions/6 (undated)

Added during the 2026-10-20 fact-check:

67. OpenAI developer docs, WARP guide: https://developers.openai.com/api/docs/guides/realtime-webrtc-warp (accessed 2026-10-20)
68. IETF datatracker, draft-ietf-mlcodec-opus-dred: https://datatracker.ietf.org/doc/draft-ietf-mlcodec-opus-dred/ (rev -07 dated 2026-08-04, updated 2026-08-27)
69. IETF datatracker, draft-ietf-moq-transport: https://datatracker.ietf.org/doc/draft-ietf-moq-transport/ (rev -22, 2026-10-01)
70. WPT Interop 2026 focus areas: https://github.com/web-platform-tests/interop/blob/main/2026/README.md (accessed 2026-10-20)
71. Cloudflare Workers AI model catalogue: https://developers.cloudflare.com/workers-ai/models/ (accessed 2026-10-20) [vendor]
72. caniuse, ManagedMediaSource: https://caniuse.com/mdn-api_managedmediasource (accessed 2026-10-20)
73. caniuse, AudioContext.outputLatency: https://caniuse.com/mdn-api_audiocontext_outputlatency (accessed 2026-10-20)
74. MDN, AudioContext.outputLatency: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/outputLatency (Baseline 2025)
75. libwebrtc field-trial registry: https://webrtc.googlesource.com/src/+/main/experiments/field_trials.py (accessed 2026-10-20)

**Code read (Magic Worlds, 2026-10-20):**
- `src/infrastructure/api/voiceSocket.ts`
- `src/features/interaction/hooks/useMicrophoneCapture.ts`
- `src/features/interaction/hooks/useVoiceCallController.ts`
- `src/features/interaction/audio/voiceVadWorklet.ts`
- `src/features/interaction/audio/voicePlaybackBuffer.ts`
- `src/features/interaction/audio/audioFormat.ts`
- `src/shared/types/voice.types.ts`
- backend `magic-worlds-api/src/models/admin_voice_catalog.py`
- backend `src/services/speech/providers/fish_audio/timestamp_ws.py`
- backend `src/routes/user/route_voice_call.py`

---

## Fact-check log (2026-10-20)

An independent pass re-checked the most load-bearing and error-prone claims against primary sources. The shared web-search budget was already used up when this pass started, so every check below is a direct fetch of a primary or near-primary URL. Corrections have been applied in place above; items still not verified are marked "(unverified)" in the body.

**Verdicts:** confirmed = the source matches the note; corrected = the note was wrong, imprecise or stale and has been fixed; unverifiable = no primary source could confirm it (marked "(unverified)" above).

| # | Claim (as originally written) | Verdict | What changed / evidence | Source |
|---|---|---|---|---|
| 1 | WebTransport Baseline when Safari/iOS 26.4 shipped it (2026-03-24); Chrome 97+, Edge 98+, Firefox 114+, Samsung 18+; HTTP/2 fallback; part of Interop 2026 | confirmed | All versions match caniuse. The WebKit post (Jen Simmons, 2026-03-24) confirms WebTransport and the HTTP/2+TCP fallback. The Interop 2026 README lists WebTransport (and WebRTC) as focus areas. The spec is still a W3C Working Draft. | https://caniuse.com/webtransport ; https://webkit.org/blog/17862/webkit-features-for-safari-26-4/ ; https://github.com/web-platform-tests/interop/blob/main/2026/README.md |
| 2 | WebCodecs `AudioDecoder`: Safari/iOS 26.0+, Chrome 94+, Firefox 130+ | confirmed | Edge 94+, Samsung 17+ also listed. | https://caniuse.com/mdn-api_audiodecoder |
| 3 | `AudioContext.outputLatency`: Chrome 102+, Firefox 70+, Safari 18.4+ | confirmed | Edge 102+ and iOS 18.4+ too. MDN marks it Baseline 2025. | https://caniuse.com/mdn-api_audiocontext_outputlatency ; https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/outputLatency |
| 4 | WebKit 326286: iOS 26.2→27 crackle with EC-on getUserMedia, filed 2026-10-04, NEW, P2/Major, rdar://189580741, no fix | confirmed | Added: reproduced on iOS 27.0.1, second reporter confirmed with an AudioWorklet tone, a native non-voice-processing app is clean (points at WebKit voice processing), still unassigned at the last modification on 2026-10-09. | https://bugs.webkit.org/show_bug.cgi?id=326286 |
| 5 | WebKit 311451: output degrades with mic open; "worse on AirPods"; EC off does not help | corrected | The reporter says it is "more pronounced on higher-quality output devices"; the AirPods remark is from a commenter. Severity Normal, component WebRTC. The original report says macOS is unaffected, but a later comment reports it on the macOS 27 beta. | https://bugs.webkit.org/show_bug.cgi?id=311451 |
| 6 | Chrome desktop neural residual echo estimator: 425 KB TFLite, ~256k int8 params, default-on, median near-end WER 0.500→0.235; Edge/Electron/Firefox/Safari do not get it (webrtcHacks 2026-10-06) | confirmed | Added: Edge has the flag but is not a client of the model-delivery service; the gain in the worst echo bucket (0-15 dB ERLE) is only 0.600→0.545; ERLE stat reads about 0.5 dB lower. | https://webrtchacks.com/chrome-neural-echo-cancellation/ |
| 7 | LiveKit pricing: Build free (1,000 agent-min, 5,000 WebRTC-min); Ship $50/mo, agent $0.01/min after 5k, WebRTC $0.0005/min, $0.12/GB, voice isolation $0.0012/min | confirmed | Added the Ship inclusions (150k WebRTC-min, 250 GB, 1,000 VI-min) and the Scale tier ($500/mo, $0.0004/min WebRTC, $0.10/GB). | https://livekit.com/pricing |
| 8 | Cloudflare Realtime SFU/TURN $0.05/GB egress, 1,000 GB/mo free, ingest free; RealtimeKit $0.0005/min audio-only | confirmed (source corrected) | The SFU page (updated 2026-09-22) confirms all of it; the free tier is shared by SFU and TURN, and WebSocket-ingested audio is not charged. The RealtimeKit price is on the RealtimeKit pricing page (updated 2026-10-19), not on the product page the notes cited. | https://developers.cloudflare.com/realtime/sfu/platform/pricing/ ; https://developers.cloudflare.com/realtime/realtimekit/pricing/ |
| 9 | Gemini Live: WebSocket; PCM16 16 kHz in / 24 kHz out; "WebRTC is available only through partners: LiveKit, Pipecat/Daily, Fishjam, Stream, Voximplant, Agora, Firebase" | corrected | Protocol and formats confirmed. The docs list those partners as supporting the Live API "over WebRTC or WebSockets" without saying which uses which, so the list is not a list of WebRTC paths. "Recommended for streaming performance" was a paraphrase; the docs say client-to-server "generally offers better performance". | https://ai.google.dev/gemini-api/docs/live-api |
| 10 | OpenAI docs: WebRTC for browser/mobile ("more consistent performance"), WebSocket for server-to-server, WebRTC even for GPT-Live server-to-server | confirmed | The "more consistent performance" phrase is in the WebRTC guide, not the WebSockets guide; the citation has been adjusted. | https://developers.openai.com/api/docs/guides/realtime-webrtc ; https://developers.openai.com/api/docs/guides/realtime-websockets |
| 11 | With WebRTC/SIP, OpenAI's server tracks played audio and auto-truncates; with WebSocket the client sends `conversation.item.truncate { audio_end_ms }` | confirmed | Exact wording: "the server manages a buffer of output audio, and thus knows how much audio has been played at a given moment." | https://developers.openai.com/api/docs/guides/realtime-conversations |
| 12 | WARP: details of round trips saved and browser support "not retrievable" | corrected (new detail added) | A dedicated WARP page exists. WARP = DTLS 1.3 + SNAP + SPED + a pre-negotiated data channel. SNAP is a Chrome 151-156 origin trial, SPED has no browser trial (so no full WARP in stock browsers), Firefox and Safari fall back. No ms or RTT savings number is published. | https://developers.openai.com/api/docs/guides/realtime-webrtc-warp |
| 13 | GPT-Live WebRTC session creation "bills 15 s of voice at initialisation" | corrected | The 15 s is credited against duration charges once the session runs, so it is not extra. Model ids in the docs: `gpt-live-1` (GPT-Live) and `gpt-realtime-2.1` (Realtime API). | https://developers.openai.com/api/docs/guides/realtime-webrtc |
| 14 | OpenAI voice infrastructure serves "about 900M weekly users" | unverifiable | The OpenAI post still returns 403. The SWE Quiz summary's title says 900M users, but its body says "hundreds of millions of weekly users". The architecture details (relay/transceiver, ICE-ufrag routing, Go + SO_REUSEPORT, Cloudflare geo-steering, transceiver instead of SFU) match the summary. | https://openai.com/index/delivering-low-latency-voice-ai-at-scale/ (403) ; https://www.swequiz.com/articles/openai-low-latency-voice-ai |
| 15 | ElevenLabs formats: `pcm_{8000..48000}`, `opus_48000_{32,64,96,128,192}`, `mp3_*`, `wav_*`, `ulaw/alaw_8000`; `pcm_44100` needs Pro; default `mp3_44100_128` | confirmed | `wav_44100` also needs Pro; `mp3_44100_192` needs Creator or above. | https://elevenlabs.io/docs/api-reference/text-to-speech/convert.md |
| 16 | ElevenLabs Flash WebSocket TTFB about 100-150 ms in NA/EU/SEA and 150-200 ms in South and Northeast Asia; serves from US/NL/SG; `x-region`; `api.us.elevenlabs.io` | confirmed | Flash inference about 75 ms; the example model is still `eleven_flash_v2_5` (no newer Flash model on the page). | https://elevenlabs.io/docs/best-practices/latency-optimization |
| 17 | Opus DRED: `draft-ietf-mlcodec-opus-dred-07` (2026-08-27); adds about 12-32 kbps; not in libwebrtc | corrected / partly unverifiable | Revision -07 is dated 2026-08-04 (the datatracker page was updated 2026-08-27); it is in WG Last Call, intended Proposed Standard. The draft says about 1/50 of the regular Opus bitrate for its redundancy; the 12-32 kbps / 1% CPU figures are (unverified). There is no DRED field trial in the libwebrtc registry. | https://datatracker.ietf.org/doc/draft-ietf-mlcodec-opus-dred/ ; https://webrtc.googlesource.com/src/+/main/experiments/field_trials.py |
| 18 | MoQ "draft-17 in March 2026; later revisions exist" | corrected (updated) | The latest is `draft-ietf-moq-transport-22` (2026-10-01), with a WG milestone to request IESG publication in Dec 2026. webrtc.ventures' draft-17 citation linked to a different draft. | https://datatracker.ietf.org/doc/draft-ietf-moq-transport/ ; https://webrtc.ventures/2026/04/webtransport-is-now-baseline-what-it-means-for-real-time-media/ |
| 19 | Chrome enabled RED for Opus by default in M96 | unverifiable | The secondary source (GStreamer issue) is access-blocked. The primary 2020 article says RED is off by default behind `WebRTC-Audio-Red-For-Opus`; that trial is still in the libwebrtc registry (policy-exempt, expiry 2024-04-01). The RED loss numbers (18%→0.7% at 20% loss; 60%→18% at 60% loss) are confirmed. | https://webrtchacks.com/red-improving-audio-quality-with-redundancy/ ; https://webrtc.googlesource.com/src/+/main/experiments/field_trials.py |
| 20 | Krisp VIVA 2.0 launched 2026-05-06; "background voices raise WER from 5% to over 30%"; 12B min/yr | confirmed / unverifiable | The launch date, 12B+ min/yr and the integrations are confirmed. Added the contents: Voice Isolation v3, Turn Prediction v3, Interrupt Prediction v1, signal detectors, 130+ products. The 5%→30% WER figure is in neither cited article (unverified). | https://speechtechmag.com/Articles/News/Speech-Technology-News/Krisp-Launches-VIVA-2.0-an-Infrastructure-for-Voice-AI-Agents%C2%A0-174689.aspx ; https://siliconangle.com/2025/07/16/exclusive-krisp-launches-viva-development-kit-enhance-accuracy-voice-ai-agents/ |
| 21 | Curley (moq.dev, 2026-05-06): about 8 RTT setup; jitter buffer 20-200 ms; WebSockets "a simpler starting point"; MoQ "isn't a perfect fit for 1:1 audio" | corrected | The RTT breakdown and jitter-buffer range are confirmed. Both quotes were inexact and have been replaced with the actual wording ("I'd start by stream audio over WebSockets"; "MoQ isn't a perfect fit for Voice AI either"; cache/fan-out "useless for 1:1 audio"). Curley does not attribute audio NACK to Google Meet or LiveKit; that comparison is BlogGeek's. | https://moq.dev/blog/webrtc-is-the-problem ; https://bloggeek.me/voice-ai/ |
| 22 | Pipecat: "Don't use it for browser-to-server voice"; SmallWebRTC SDKs for JS, iOS, Android, RN, C++, ESP32; SCTP chunk size about 1100 / MTU warning | corrected / partly unverifiable | The exact quote is "Do not use it for browser-to-server voice interactions." Pipecat does not mention RED. The chunk-size default of 1100 and the >1175 vs 1280 MTU warning are confirmed. The SmallWebRTC page documents only a JS client, so the other SDKs are (unverified). | https://docs.pipecat.ai/client/concepts/choosing-a-transport ; https://docs.pipecat.ai/server/services/transport/small-webrtc |
| 23 | Pipecat MoqTransport: relay `cdn.moq.dev`; "no stated AEC/jitter-buffer handling" | corrected | The docs show only a placeholder relay. The client has a jitter buffer (`audioLatencyMs`, default 80 ms) and a TTS run-ahead cap (`audioBufferMaxMs`, 30 s), flushed on interruption. It is audio only; AEC is not covered. | https://docs.pipecat.ai/api-reference/client/js/transports/moq |
| 24 | Helix (2025-12-11) replaced WebRTC with WebSocket + WebCodecs (H.264 + Opus) for 443-only firewalls, about 80% connection success before, 20-30 ms lower latency, later abandoned | confirmed | "This solution worked so well that we eventually threw it away too." | https://blog.helix.ml/p/we-killed-webrtc-and-nobody-noticed |
| 25 | Daily: about 75 PoPs, 10 regions, P50 first hop 13 ms; "you should almost certainly use the serverless approach"; an SFU without mesh adds 10-100 ms | confirmed (nuance corrected) | Daily says WebRTC servers without mesh routing add a 10-100 ms server-to-agent hop; it does not say "SFU". | https://www.daily.co/blog/you-dont-need-a-webrtc-server-for-your-voice-agents/ |
| 26 | LiveKit (2026-03-23): a TCP loss stalls "possibly for hundreds of milliseconds"; Singapore↔US-East about 150 ms theoretical, 230-280 ms in practice; GCC | confirmed | The article also says "250+ ms" elsewhere. | https://livekit.com/blog/why-webrtc-beats-websockets-for-voice-ai-agents |
| 27 | Chrome 88 intensive throttling exempts pages with audio in the last 30 s or WebRTC (open data channel / live track); starts after 5 min hidden, once per minute | confirmed | — | https://developer.chrome.com/blog/timer-throttling-in-chrome-88 |
| 28 | `echoCancellation` accepts `"all"` / `"remote-only"`; `true` must cancel at least remote-only and should attempt all (MDN 2026-10-08) | confirmed | MDN has no per-value compatibility data, so Chrome shipping status remains unknown. | https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/echoCancellation |
| 29 | `AudioContext.playbackStats` exposes underrun duration and events plus average, min and max latency, updated once per second, only when visible or with mic permission | corrected | The real field names are `fallbackFramesDuration`, `fallbackFramesEvents`, `totalFramesDuration` and the three latencies. The once-per-second and visibility/gUM-permission rules are proposed mitigations in a standalone WICG proposal, not shipped behaviour. | https://github.com/WICG/web_audio_playout ; https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/playbackStats |
| 30 | Zoom Web SDK gates Chrome-wide AEC on Chrome ≥111 (mac/Win/Linux), ChromeOS ≥116; Edge caveat; no AEC-detection API | corrected (attribution) | The versions come from the forum poster's reading of the minified SDK, not from Zoom staff. Staff confirmed the Edge limitation and that no detection API exists. | https://devforum.zoom.us/t/issupportchromewideaec-sniffs-browser-name-version-breaking-echo-cancellation-on-microsoft-edge/145288 |
| 31 | LiveKit NC docs: "strongly recommends" keeping WebRTC NS; stacking "may produce unexpected results on already-processed input" | corrected (wording) | Both quotes replaced with the exact text. Added the current model menu (Krisp NC, BVC, VIVA, VIVA telephony, ai-coustics QUAIL_L, Voice Focus 2.1 S/L). | https://docs.livekit.io/home/cloud/noise-cancellation/ |
| 32 | ManagedMediaSource "Safari 17.1+" | corrected | macOS Safari 17.0+, iOS Safari 17.1+; not in Chrome, Edge or Firefox. | https://caniuse.com/mdn-api_managedmediasource |
| 33 | No TURN causes silent failures for "5-15% or more of users" | unverifiable | The Metered post gives no sourced percentage and rejects blanket relay-rate claims; it confirms "effectively 100%" only for UDP-blocking corporate networks, and the 443 TCP/TLS + short-lived credentials + `iceTransportPolicy:"relay"` advice. | https://dev.to/alakkadshaw/turn-for-ai-voice-agents-why-agent-traffic-is-almost-100-relay-3meo |

**Newer developments added by this pass:**
- OpenAI WARP is now documented in detail (DTLS 1.3, SNAP origin trial in Chrome 151-156, SPED, pre-negotiated data channel).
- OpenAI model ids in the current docs: `gpt-live-1` and `gpt-realtime-2.1`.
- MoQ transport is at draft-22 (2026-10-01), and Opus DRED is in WG Last Call.
- Cloudflare Workers AI now hosts Deepgram Flux (voice-agent STT), Nova-3 and Aura-2 (en/es) next to the Realtime SFU, which makes an all-Cloudflare cascaded edge plausible [vendor].
- LiveKit Cloud now offers ai-coustics Voice Focus 2.1 and Krisp VIVA telephony as voice-isolation options.

**Not re-checked (search budget exhausted):** Fish Audio output formats, Bluetooth HFP behaviour, iOS background capture, Firefox ≤147 mic/context rate limitation, the Opus FEC "about 25% expected loss" cap, Chromium issue 513765687, and Android platform AEC specifics. They keep their existing labels.
