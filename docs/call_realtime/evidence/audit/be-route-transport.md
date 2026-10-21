# Backend audit: WebSocket route, admission, quota, delivery and config

Subsystem: **Backend call transport and control plane** (magic-worlds-api BFF).
Audit date: 2026-10-20. The audit was read-only. No source file was modified.

Labels used in this file:

- **FACT**: seen in code at the cited `file:line`.
- **INFERENCE**: reasoned from facts. The reasoning is given.
- **UNKNOWN**: needs runtime data or deployment information.

Abbreviations for paths:

| Short | Absolute path |
|---|---|
| `route` | `/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_voice_call.py` |
| `admission` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/admission.py` |
| `quota` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/quota.py` |
| `config` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py` |
| `delivery` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/delivery.py` |
| `errors` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/errors.py` |
| `wiring` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/call_wiring.py` |
| `engine` | `/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py` |
| `main` | `/home/andres/PycharmProjects/magic-worlds-api/src/main.py` |
| `serve` | `/home/andres/PycharmProjects/magic-worlds-api/src/serve.py` |
| `envex` | `/home/andres/PycharmProjects/magic-worlds-api/.env.example` |
| `uvicorn/…`, `starlette/…`, `websockets/…` | `/home/andres/PycharmProjects/magic-worlds-api/.venv/lib/python3.13/site-packages/…` (installed: uvicorn 0.35.0, starlette 0.47.2, fastapi 0.116.1, websockets 16.0) |
| `fe-socket` | `/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/voiceSocket.ts` |
| `fe-ctrl` | `/home/andres/WebstormProjects/magic-worlds/src/features/interaction/hooks/useVoiceCallController.ts` |

---

## 1. How it works: architecture

### 1.1 Two transports per call (FACT)

A live call uses **two separate transports**:

1. **One WebSocket per call**, `GET /character-chats/{session_id}/ws-voice?workspace_id=…` (`route:1452`).
   It carries the control plane and the downlink: lifecycle, status, transcript, assistant text deltas and assistant **MP3 audio as base64 inside JSON text frames** (`delivery:442-477`).
   The client never sends microphone audio on this socket.
2. **One HTTP multipart POST per VAD-cut utterance**, `POST /character-chats/{session_id}/voice-segments` (`route:1130-1223`).
   It carries the uplink audio: a complete **16 kHz mono PCM16 WAV** file (`route:1180-1186`).
   The POST stays open while the **whole server turn runs**: STT, then LLM, then TTS generation and delivery over the socket (`route:1194-1221` → `engine:2051-2104`).
   The frontend relies on this ("The POST resolves only after the server turn finished", `fe-ctrl:622`).

The frontend header comment confirms the split ("microphone bytes are uploaded through the HTTP voice-segments route instead", `fe-socket:5-6`).
`envex:656-658` documents the STT leg as "request/response HTTP multipart only — no streaming, no partial transcripts".

Other HTTP routes:

- `POST /character-chats/{id}/voice-consent` (`route:1084-1112`).
- `POST /character-chats/{id}/voice-end`. The frontend sends it with `keepalive` on pagehide (`route:1246-1282`). It has no `require_features("calls")` dependency, so a call can always be ended.
- History reads: `GET /voice-calls`, `GET /character-chats/{id}/calls` and `GET /voice-calls/{id}/transcript` (`route:1317-1382`).

### 1.2 Process model (FACT)

- `serve:28-33` calls `uvicorn.run("src.main:app", host, port)` with no `workers` and no `ws_*` overrides.
  The result is **one process** using the uvicorn defaults:
  - the `websockets` legacy implementation (`uvicorn/protocols/websockets/auto.py:7-21`);
  - `ws_max_size=16 MiB`, `ws_max_queue=32`, `ws_ping_interval=20`, `ws_ping_timeout=20`, `ws_per_message_deflate=True` (`uvicorn/config.py:188-192`);
  - `timeout_graceful_shutdown=None`.
- Live call state is **in memory**:
  - `VoiceCallEngine._calls: dict[str, _VoiceCallRuntime]` (`engine:703`). The runtime docstring says "Process-local state of one live call (single process / sticky routing only)" (`engine:556-557`).
  - `VoiceDelivery` keeps per-socket send locks, per-turn audio sequence numbers and cancelled turns (`delivery:174-181`).
  - The per-call watchdog task (`engine:925`) and the resume-grace task (`engine:1039`).
  - The call-start token bucket (`src/services/speech/token_buckets.py:73,89-101`).
- **Shared (MySQL) state:** `voice_session` rows, `voice_quota_reservation`, `voice_usage_day` and the singleton `voice_quota_capacity` lock row (`quota:109-115,736-742`). Credits live in the membership ledger.
- The API docs require "a single process, or route every request of a call (the WebSocket, its resume and its segment uploads) to the same instance with sticky routing" (`/home/andres/PycharmProjects/magic-worlds-api/docs/api_usage/voice.md:383-385`).
  The roadmap lists this as open item V-12 (`/home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/00_current_status_and_roadmap.md:88`).

### 1.3 Startup wiring (FACT)

- `main:813-818` loads `VoiceConfig` from env. It refuses to boot when voice is enabled but the STT config is incomplete (`config:402-423`).
- `main:1138-1139` requires `LLM_PROFILES_ENABLED` when voice is enabled.
- `wiring:233-251` decides whether the engine can be built: voice enabled, no availability issue, no `elevenlabs_call_idle_issue`, and at least one native call TTS adapter (ElevenLabs `streaming` or `fish_streaming`).
  - If it cannot be built, there is no engine and only a `VoiceCallStaleSweeper` runs (`main:1140-1151`).
  - If it can, `build_default_voice_call_engine` runs (`main:1152-1170`, `engine:3763-3808`), and the `call` surface is enabled on the surface gate (`main:1171-1174`).
- Lifespan start: `engine.start_maintenance()` sweeps once, then every 60 s (`main:1252-1260`, `engine:1771-1779`, `engine:92`).
- Lifespan shutdown: `engine.shutdown()` ends every live call with `server_shutdown` (`main:1381-1391`, `engine:1781-1811`).
- Readiness: `/ready` → `_check_voice_call` (`main:1908-1960`). It is a **structural** check only: config is ok, engine object identity, tts_storage, moderation ready. It sends no live probe and reports no capacity or load.

---

## 2. WebSocket protocol, server side

### 2.1 Handshake and auth (FACT)

Order of steps in `voice_call_ws` (`route:1452-1490`):

1. **Origin check** `_ws_origin_allowed` (`route_chat.py:2734-2758`). An exact match against `CORS_ORIGINS` is required. A missing Origin is allowed because auth is token-based.
   - On failure, `_reject_socket_before_ready` *accepts* the socket (echoing the bearer subprotocol only if the client offered it), sends `voice_error{category:auth, code:origin_forbidden}` and closes with **4403** (`route:450-470`).
   - Accepting first is deliberate. Closing before accept gives HTTP 403, which browsers show only as 1006 (`route:451-455`).
2. **Auth via subprotocol** `authenticate_websocket` (`src/services/auth_adapter.py:1574-1608`).
   - The client offers `["mw.bearer.v1", "<access token>"]`.
   - The token is validated by `AuthAdapter.validate_token`, which has a TTL cache (`VALIDATION_CACHE_TTL` default 30 s, `auth_adapter.py:349,383`) and a circuit breaker.
   - On failure the socket is accepted, `auth_required` is sent, and it closes with **4401**.
3. `websocket.accept(subprotocol="mw.bearer.v1")` (`route:1464`).
4. `ensure_voice_available(config)` (`admission:80-92`). `selector_from_request(..., query=True)` requires `?workspace_id=` (`route:1474`).
5. `_receive_voice_handshake` loops (`route:499-510`):
   - It answers `voice_ping` with `voice_pong`.
   - It returns on `voice_start` or `voice_resume`.
   - Any other frame is a fatal `conflict`.
   - **There is no timeout on this wait.**

The token is validated **once**, at the handshake. It is not checked again during the socket's life, which lasts up to `max_call_seconds`. Turn LLM calls use the **fresh bearer token of each segment POST** (`route:1218`, `_bearer_token_from_request` `route:348-355`). The handshake token is used only for the model preflight (`route:954-956`).

### 2.2 Client → server frames (FACT)

All frames are JSON text. Every model is Pydantic `extra="forbid", strict=True` (`route:162-262`).

| Type | Fields (validation) | Handler |
|---|---|---|
| `voice_start` | `voice_session_id?` (UUID regex), `client_call_id?` (1-64), `audio{preferred_encoding: "audio/wav;codec=pcm_s16le", sample_rate: 16000, channels: 1, vad?{source, aggressiveness}}`, `capabilities?{media_source_mp3, audio_worklet, media_recorder}`, `voice?` (dict, validated as a new voice pick) | handshake → `_create_admitted_voice_session` (`route:926-1035`) |
| `voice_resume` | `voice_session_id` (UUID), `last_segment_seq` 0..10^7 | handshake → `_resume_admitted_voice_session` (`route:1038-1081`); mid-socket → `engine.resume_call` (`route:1526-1543`) |
| `voice_ping` | `voice_session_id?` | `engine.touch_call` (DB UPDATE of the reservation) + `voice_pong` (`route:1496-1499`) |
| `voice_barge_in` | `reason="barge_in"`, `turn_id?` (`^[A-Za-z0-9][A-Za-z0-9_-]{0,35}$`), `played_ms?` 0..2^31-1 | `engine.barge_in` (`route:1500-1508`) |
| `voice_playback` | `turn_id`, `played_ms` | `engine.report_playback`, rate-limited to 4/s (`route:1509-1515`, `engine:1267-1297`, `engine:119`) |
| `voice_end` | `reason="user"` | `engine.end_call` then close 1000 (`route:1516-1525`) |
| `voice_segment_meta` | `{}` | echoes `voice_status{state:"uploading_segment"}` (`route:1544-1548`) |

Parsing is in `_parse_voice_frame` (`route:320-330`). An unknown type, an extra key or a validation error raises `VoiceOrchestrationError("conflict", fatal=True)`. In the live loop that path **ends the call** (`route:1584-1587` → `_end_failed_socket_call` → `engine.release_socket` → `end_call(outcome="failed")`).

A binary frame or invalid JSON fails earlier:

- `starlette/websockets.py:138-142` reads `message["text"]`.
- uvicorn delivers binary frames as `{"bytes": …}` with no `"text"` key (`uvicorn/protocols/websockets/websockets_impl.py:386-387`), so the read raises `KeyError`.
- `json.loads` raises on bad JSON.
- Either way the generic handler runs: it logs `[VOICE_INTERNAL]` with a traceback, sends `internal` and ends the call (`route:1588-1598`).

### 2.3 Server → client frames (FACT)

The allowed set is `SAFE_VOICE_FRAME_TYPES` (`delivery:17-34`):

- lifecycle: `voice_ready`, `voice_state_snapshot`, `voice_status`
- segments and transcript: `voice_segment_ack`, `transcript_final`
- turn: `voice_turn_start`, `voice_assistant_delta`
- audio: `voice_audio_chunk`, `voice_audio_final`
- end of turn and call: `voice_turn_end`, `voice_cancelled`, `voice_error`, `voice_ended`, `voice_pong`

Notable shapes:

- `voice_ready` (`delivery:297-338`) carries:
  - `limits{max_call_seconds, idle_timeout_seconds, remaining_daily_seconds, max_segment_duration_ms?}`
  - `upload_url` (path only)
  - `audio{content_type:"audio/mpeg", codec:"mp3", sample_rate, channels:1}`
  - `effective_voice` (strict model)
  - `original_voice_name`
  - `ai_voice:true`
  - `server_time_ms`
- `voice_audio_chunk` (`delivery:442-477`) carries:
  - `seq` (strictly increasing per turn)
  - `content_type:"audio/mpeg"`, `sample_rate`, `channels`
  - **`data_b64`** (base64 of the provider MP3 bytes)
  - `is_final`, `codec`, `gain_db` (clamped to [-24, 0]), `substitution_reason`, `voice_name?`

  There is **no presentation timestamp or duration per chunk**. The client must sequence by `seq`.
- `voice_state_snapshot` (resume) has `state`, `status`, `last_segment_seq` (echoed from the client) and `last_audio_seq` of the in-flight turn (`delivery:341-358`, `engine:991-1003`).
- `voice_error` is `{type, category, code, message, retry_after_seconds?, fatal?}` (`errors:133-144`).
  - Internal categories `voice_unavailable`, `attestation_required` and `moderation_unavailable` go on the wire as category `tts_unavailable` plus an explicit `code` (`errors:43-49`).
- `voice_ended.reason` is one of `user|quota|superseded|disconnected|idle_timeout|max_duration|server_shutdown|voice_restricted` (`delivery:63-65`).

Every outbound frame goes through `sanitize_voice_frame` (`delivery:590-612`). It runs `redact_sensitive_text` on every string field except `data_b64`; that is about 14 regexes per string (`errors:77-101`). Frames whose type is not in the allowed set raise.

### 2.4 Close codes (FACT)

| Code | Meaning | Where |
|---|---|---|
| 1000 | Normal end (`voice_end`) | `route:1524` |
| 4401 | Auth failed before ready | `admission:18`, `route:1458-1461` |
| 4403 | Origin forbidden | `admission:19`, `route:1454-1456` |
| 4408 | **Every** other fatal close: admission refusals, workspace errors, mid-call protocol errors, internal errors | `admission:20`, `route:1572-1598` |
| 1012 | Sent by **uvicorn** on server shutdown, before the lifespan shutdown runs | `uvicorn/protocols/websockets/websockets_impl.py:148-154`, `uvicorn/server.py:263-293` |

The frontend labels 4404 and 4422 (`fe-socket:43-46`), but the server never sends them. 4408 is labelled `NOT_ADMITTED` even when an established call fails mid-call.

On disconnect (`route:1549-1571` → `engine:1012-1041`):

- **1000**, or `VOICE_RESUME_GRACE_SECONDS=0`: the call ends now (`engine:100,1028-1035`).
- Any other code: the call becomes resumable for `resume_grace_seconds` (default 20 s). `_end_after_grace` then ends it with `disconnected` (`engine:1838-1853`).
- A socket that a resume already replaced returns `"stale"` and never ends the call (`engine:1023-1025`).

---

## 3. Admission (new call)

### 3.1 Gate order (FACT, `route:926-1035`)

1. `get_voice_config`. `_ws_user_context` runs the shadow-user projection, a **DB** read or upsert (`route:486-489`, `route_chat.py:325-349`).
2. `resolve_workspace_context(intent="new_work")` (DB) and `get_user_chat` (DB ownership) (`route:939-940`).
3. `_require_call_access` (`route:744-757`):
   - feature flag `calls`;
   - `voice_access.check`: restriction, env AND DB switch, spend circuit at 100 %, attestation, Free-tier rules, IP activation.
   Refusals map to fatal frames (`route:94-111,730-741`).
4. `_require_call_surface` (`route:799-827`). The surface gate covers geo, moderation configured, breaker, lane, and whether an engine exists.
5. `engine.preflight_call_model` is **started in parallel** as a task (`route:954-956`). It reads the profile catalog over HTTP using the handshake bearer token (`engine:720-733`).
6. `_call_voice_override` validates an optional caller-picked voice as a new pick (`route:617-658`).
7. `_call_voice_for` (`route:661-701`) runs the scoped session read (DB), the snapshot voice, and `_resolve_call_voice`:
   - last turn language (DB);
   - preferred language (DB);
   - `resolver.refresh()`;
   - `resolve_detail(surface="call")`.

   A voice that cannot stream refuses with `voice_unavailable`.
8. Consent (`admission:134-158`) is 1-2 DB reads. Fish voices need `voice-v3`; ElevenLabs accepts `voice-v2` or `voice-v3`.
9. `await model_check` gives the prompt family. If an earlier gate refuses, the task is dropped (`route:975-977`, `route:919-923`).
10. `engine.preflight_start` (`engine:735-739`):
    - credits availability (DB);
    - `quota.preflight_reserve`, which reads **all** reservations, ignores the user's own, and checks global capacity and daily consumed (`quota:512-547`).
11. `_take_call_start_token`: 3 starts per 10 min per account, in memory (`route:830-840`).
12. `_record_call_free_activation` (`route:760-774`).
13. **Supersede** (`route:880-916`):
    - every active session of the user is ended through `engine.end_call(reason="superseded")`;
    - then `release_orphaned_reservations` runs (`engine:1198-1239`).
14. `build_admission_context(require_consent=False)` → `require_voice_capacity` (`admission:161-186`):
    - `expire_idle_for_user` (DB UPDATE);
    - `list_active_for_user`, which must be below `max_inflight_per_user`.
15. `engine.start_call` (`engine:741-938`):
    - credits again (DB);
    - `quota.reserve_call`, the authoritative check in one transaction (§4);
    - `store.create_session` (DB INSERT and `mark_active`);
    - builds `voice_ready`;
    - **opens the TTS call socket** with `speech_provider.open_call` (ElevenLabs WS; Fish defers its socket);
    - registers the runtime and starts the watchdog;
    - sends `voice_ready` and `voice_status{listening}`.

    Each failure after the reservation goes through `_release_failed_start` (`engine:1896-1919`).

**INFERENCE, call setup cost:** about 25-35 sequential DB round trips, plus an optional api.auth validation, the catalog HTTP call (in parallel), and an ElevenLabs WebSocket TLS open. With a LAN MySQL this is estimated at **0.3-1.5 s** to `voice_ready`.

Repeated work in this path:

- Credits are read twice (`engine:738`, `engine:804`).
- The plan daily limit is read twice (`quota:539-541`, `quota:470`).
- All reservations are listed twice (`quota:523`, `engine:1206`).

### 3.2 Resume (FACT, `route:1038-1081`, `engine:940-1010`)

- The resume path rechecks workspace (`control_admitted`), chat ownership and consent (`build_admission_context(require_capacity=False)`).
- It does **not** re-run `_require_call_access`: no feature flag, restriction, switch or attestation check.
- `engine.resume_call` reads the session row. If the call is **not live in this process**, it **ends the call** (`engine:966-978`) and raises `not_found`.
- If the call is live here:
  - the pending grace end is cancelled;
  - the socket is rebound and the previous socket's send lock is unregistered;
  - `touch_call` runs;
  - `voice_state_snapshot` is sent.
- There is no audio replay.
- Frontend timings: resume window `RESUME_WINDOW_MS=15 s` against server grace 20 s (`fe-socket:23-24`). Heartbeat every 25 s, liveness timeout 50 s (`fe-socket:20-21`).

---

## 4. Quotas, capacity and billing hooks

### 4.1 Data model (FACT, `quota`)

- **`voice_quota_capacity`**: a singleton row (`capacity_id=1`) taken `FOR UPDATE` at the start of every reserve and release transaction (`quota:179-180,356,736-742`). This serializes all reserve/release transitions across workers.
- **`voice_usage_day`**: `(user, project, group, usage_date UTC)` → `reserved_seconds`, `consumed_seconds`.
  - `remaining = daily_limit - (reserved + consumed)` (`quota:29-37`).
- **`voice_quota_reservation`**: one row per live call, holding `reserved_seconds`, `started_at_ms`, `last_activity_at_ms`, `max_call_seconds` and `idle_timeout_seconds`.

### 4.2 `reserve_call` (FACT, `quota:150-308`)

One transaction:

1. Capacity lock.
2. Upsert and lock the usage row.
3. An existing reservation with the same id returns `duplicate_reservation`.
4. **Per-user count ≥ `max_inflight_per_user`** → `busy` (`quota:237-248`).
5. **Global count ≥ `global_concurrency`** → `quota_exceeded`, with `retry_after = idle_timeout_seconds` (`quota:250-258`).
6. `remaining <= 0` → `quota_exceeded`, with retry at the next UTC day (`quota:260-267`).
7. `reserved = min(max_call_seconds, remaining)` (`quota:268`). The **whole call is reserved up front**.

### 4.3 Daily limit (FACT, `quota:581-604`)

`min(plan voice_call daily_quantity_limit, VOICE_DAILY_MINUTES_PER_USER*60)`. Defaults are 10 min = 600 s, equal to the 600 s max call. **INFERENCE:** with defaults, a fresh user's first call reserves the whole daily allowance, and `voice_ready.limits.remaining_daily_seconds` shows 0 (`engine:865`, `quota:307`). The frontend type has this field (`voice.types.ts:143`), but nothing in the UI reads it.

### 4.4 Consumption units (FACT)

- **Normal end** (`engine:1135-1141`): consumed = `runtime.billing.billable_audio_seconds`. This is the STT audio plus the delivered TTS audio, in **audio seconds**, not wall time.
- **Release without a value** (`quota:401-404`): consumed = wall-clock elapsed, clamped to the reservation.
- **Stale sweep** (`quota:549-579`): consumed = `min(elapsed wall-clock, reserved)` (`quota:574`).
- **Credits**: 1 credit per 10 s of billable audio (`engine:81,3398`). `record_call_usage` → `MembershipModel.debit_operation_credits`, idempotent per billing slice (`engine:246-266,3378-3439`).

### 4.5 Where billing runs (FACT)

TTS billing is **awaited inline in the audio delivery callback** (`engine:2507-2508`). It runs after each sentence start or each 2 s of delivered audio (`engine:117`), and does the following under `billing_lock`:

- `record_call_usage`, a DB transaction;
- `_persist_billing_metadata`, which is `store.get_session` (SELECT) and `update_session_metadata` (UPDATE of the JSON blob) (`engine:3441-3455`).

**Audio delivered while the socket is away is still billed** (`engine:2486-2497`; `delivery:157-159` comment "Turn audio stays billable/persistable").

### 4.6 Liveness (FACT)

- `touch_call` updates `voice_quota_reservation.last_activity_at_ms`. It runs on every `voice_ping` (client every 25 s) and every segment (`route:1498`, `engine:1070-1078,2050`).
- `voice_session.last_heartbeat_at` is updated only on activation and on metadata updates (`models.py:7335,7366`).

### 4.7 Watchdog (FACT, `engine:1823-1863`)

The per-call task ticks every 1 s (`engine:91`). It ends the call on:

- `max_duration`: wall-clock since start ≥ `max_call_seconds`;
- `quota`: billable audio seconds ≥ reserved seconds. A fatal `quota_exceeded` frame is sent first (`engine:1741-1745`);
- `idle_timeout`: no in-flight segment and `now - last_activity_at ≥ idle_timeout_seconds`. `last_activity_at` changes only on segment accept and finish (`engine:2048,2110`). Pings and playback reports do not count.

No warning frame is sent before any of these ends. The frame set has no warning type (`delivery:17-34`).

### 4.8 Sweeper (FACT, `engine:3637-3698`)

It runs at startup and every 60 s. It:

- expires reservations that are idle ≥ `stale_session_seconds` (900) or over max duration, except calls live **in this process**;
- marks their sessions `expired`;
- then expires "orphaned" active sessions (no reservation, heartbeat older than 60 s, `models.py:7143-7172`).

### 4.9 Per-call and per-request bounds (FACT)

- `MAX_INFLIGHT_SEGMENTS_PER_CALL=3`. Beyond that the route answers HTTP 429 with `retry_after=1` (`engine:83,2041-2042`; `errors:185-189`; `admission:124-125`).
- Segment HTTP: `Content-Length` is required (411). The limit is `max_segment_bytes + 64 KiB` (413) (`route:80,1226-1243`).
- The read is bounded to `max+1` bytes (`route:1177`).
- Encoding must be `audio/wav;codec=pcm_s16le`, 16 kHz, mono (`route:1180-1186`).
- `duration_ms ≤ 2×max_segment_duration_ms` at the route (`route:1203-1208`).
- Starlette spools multipart parts in memory up to 1 MB (`starlette/formparsers.py:126-128`). A maximum 30 s segment is about 960 KB, so in practice it stays in memory.

---

## 5. Delivery (FACT, `delivery`)

- **`VoiceDelivery.send_frame`** (`delivery:212-231`):
  1. sanitize;
  2. check the type against the allowed set;
  3. take the per-socket `asyncio.Lock`, looked up through a global `_lock` (`delivery:183-186`);
  4. `await websocket.send_json(frame)`, with **no timeout**.

  On any exception it unregisters the socket and raises `VoiceDeliveryDisconnected`. `engine._send_to` turns that into `False` (`engine:1946-1956`), so "delivery failures never abort an admitted call" (`engine:926-928`).
- **`send_audio_chunk`** (`delivery:233-268`):
  - drops chunks of cancelled turns (`CANCELLED`);
  - drops non-increasing `seq` (`STALE`; the engine treats that as a fatal `upstream_contract`, `engine:2490-2493`);
  - records `seq` **before** checking the socket, then returns `DROPPED` when the call has no socket (resume grace).
- **Backpressure (FACT, library code):**
  - Starlette `send_json` → uvicorn `asgi_send` → websockets legacy `write_frame` → `await self.drain()` (`websockets/legacy/protocol.py:1164-1184`).
  - The write buffer high-water mark is `write_limit=2**16` (64 KiB) (`websockets/legacy/protocol.py:168`). uvicorn does not override it (`uvicorn/protocols/websockets/websockets_impl.py:105-113`).
  - **INFERENCE:** a slow or stalled client blocks the sender coroutine. The TTS `deliver` callback awaits `send_audio_chunk` inline (`engine:2469-2485`), so the TTS pump stalls too. The stall lasts until either:
    - the peer drains; or
    - websockets keepalive (20 s ping interval + 20 s ping timeout) closes the connection.
- **Audio pacing:** none. Chunks are forwarded as fast as the provider produces them (`engine:2441-2509`). The only flow control is TCP and the 64 KiB buffer. The only server-side read of client playback is `voice_playback` (≤ 4/s), which is used for truncation and the TTS flush-ahead gate (`engine:1267-1297`).
- **Format:** MP3 only (`delivery:67-69,119-122`), base64 inside JSON text, with per-message-deflate on by default (`uvicorn/config.py:192`).
- **Ordering:** one socket, one lock, so frames go out in FIFO order. `voice_cancelled` is queued behind any audio already in the socket and kernel buffers. **INFERENCE:** this is head-of-line blocking on slow links.

---

## 6. Errors (FACT, `errors`, `admission:95-131`)

- `VoiceOrchestrationError(category, message, fatal, retry_after_seconds, code)` carries a redacted message.
  - The category is normalized to the public set (`errors:51-75,196-202`).
  - `code` is an explicit public-enum code or `VOICE_<CATEGORY>` (`errors:104-110,129-131`).
- HTTP status mapping:

  | Category | Status |
  |---|---|
  | `disabled`, `tts_unavailable` | 503 |
  | `auth` | 401 |
  | `not_found` | 404 |
  | `consent_*` | 428 |
  | `quota_exceeded`, `stt_rate_limited` | 429 |
  | `busy`, `conflict` | 409 |
  | `*_timeout` | 504 |
  | provider / contract | 502 |
  | `internal` | 500 |
  | internal `voice_unavailable` | 409 |
  | `attestation_required` | 428 |
  | `moderation_unavailable` | 503 |
  | segment capacity | 429 |
- On the socket, every `VoiceOrchestrationError` reaching the route closes **4408** after the frame, even if `fatal=False` (`route:1584-1587`).
- Non-fatal conflicts inside the loop (resuming a different session) are sent as `voice_error` and the call continues (`route:1530-1535`).

---

## 7. Graceful end, shutdown, restarts, scaling

- **User end, two paths:**
  - WS `voice_end` → `end_call` → close 1000;
  - HTTP `voice-end` with `keepalive` on pagehide.

  `end_call` (`engine:1080-1196`) does the following in order:
  1. verifies ownership against the DB row;
  2. marks `ending`;
  3. cancels the pending end and the watchdog;
  4. cancels every turn;
  5. drains turns (≤ 2 s, `engine:90`);
  6. awaits a pending truncation (≤ 3 s, `engine:109`);
  7. closes the TTS socket;
  8. releases the quota;
  9. ends the session;
  10. sends `voice_ended` to the current socket and the requesting socket;
  11. forgets the call.

  A concurrent second end waits up to 7 s on `runtime.ended`.
- **Shutdown (FACT, library order):**
  1. uvicorn stops accepting connections;
  2. it calls `connection.shutdown()`, and **every WebSocket gets close 1012 right away**;
  3. it waits for HTTP connections, including **in-flight segment POSTs that hold whole turns**;
  4. only then does it run the lifespan shutdown, i.e. `engine.shutdown()` (`uvicorn/server.py:263-293`; `uvicorn/protocols/websockets/websockets_impl.py:148-154`).

  **INFERENCE:**
  - The route sees close 1012, which is not 1000, so it starts resume grace (`engine:1028-1041`).
  - `voice_ended{server_shutdown}` can never reach the client because its socket is already gone.
  - Clients spend up to 15 s trying to resume against a process with no state, or a new process that ends the call on resume (`engine:966-978`).
- **Restart recovery:**
  - Reservations of calls that were live before the restart stay counted against **global capacity and daily remaining** until the sweeper expires them: 600 s from start, or 900 s after the last touch.
  - If the user starts a new call first, supersede releases them correctly, using the session's billing metadata (`engine:1219-1235`).
  - Otherwise the sweeper charges wall-clock seconds up to the full reservation (`quota:574`).
- **Horizontal scaling (FACT and INFERENCE):**
  - A segment POST that reaches the wrong process gets `conflict "Voice call is not active."` (`engine:2033-2035`).
  - A resume that reaches the wrong process ends the live call (`engine:966-978`).
  - Supersede from another process ends the DB session but leaves the remote runtime streaming. The local `end_call` only does DB work when there is no runtime (`engine:1158-1176`).
  - The documented sticky key is `voice_session_id`. It travels only in the JSON `voice_start`/`voice_resume` frame and in the multipart **body** (`route:1163-1166`), so an L7 balancer cannot route on it without reading the body.
  - The chat id **is** in both URL paths (`route:1019,1452`), so hashing on the path is possible.
  - Token buckets are per process.

---

## 8. Configuration table (defaults and where they are defined)

| Setting | Default | Defined at | Notes |
|---|---|---|---|
| `VOICE_MODE_ENABLED` | false | `config:90,256-260` | Every other VOICE_* setting must be absent while this is false (`config:50-71,261-266`) |
| `VOICE_STT_PROVIDER` | groq | `config:91,120-121` | Only `groq` is accepted |
| `VOICE_STT_MODEL` | whisper-large-v3 | `config:20,122-125` | **Must equal** `whisper-large-v3`; turbo or other models are rejected |
| `VOICE_STT_BASE_URL` | https://api.groq.com/openai/v1 | `config:19` | |
| `VOICE_STT_TIMEOUT_SECONDS` | **30.0** (0.1-120) | `config:47,49,94` | Long for realtime |
| `VOICE_MAX_INFLIGHT_PER_USER` | 1 | `config:40` | Also enforced in the reservation transaction |
| `VOICE_DAILY_MINUTES_PER_USER` | 10 | `config:30` | Global ceiling; the plan may lower it |
| `VOICE_MAX_CALL_DURATION_SECONDS` | 600 | `config:31` | Wall clock, watchdog |
| `VOICE_IDLE_TIMEOUT_SECONDS` | 120 | `config:32` | Must be ≤ 150 or no engine is built (`config:38-39,437-439`) |
| `VOICE_GLOBAL_CONCURRENCY` | 8 (max **64**) | `config:41,48` | Platform-wide concurrent calls |
| `VOICE_MAX_SEGMENT_DURATION_MS` | 30 000 (min 250) | `config:42` | |
| `VOICE_MAX_SEGMENT_BYTES` | 2 000 000 (min 1024) | `config:43` | +64 KiB multipart allowance (`route:80`) |
| `VOICE_STALE_SESSION_SECONDS` | 900 (≥ idle) | `config:44,211-219` | Not validated against max call duration |
| `VOICE_RESUME_GRACE_SECONDS` | 20 (0-300) | `config:45-46` | Frontend window 15 s (`fe-socket:24`) |
| `VOICE_VAD_ENERGY_GATE_ENABLED` | false | `config:111` | |
| `VOICE_VAD_SILENCE_FLOOR_PEAK` | 0.002 | `config:112` | |
| `VOICE_VAD_MIN_RMS` / `MIN_PEAK` / `MIN_SPEECH_RATIO` | 0.012 / 0.025 / 0.03 | `config:113-115` | Only with the energy gate on |
| `ELEVENLABS_CALL_SOCKET_INACTIVITY_SECONDS` | 20 | `config:36` | Constant |
| `ELEVENLABS_CALL_MAX_IDLE_SECONDS` | 150 | `config:38` | Constant |
| Consent versions | `voice-v2` required, `voice-v3` (Fish) | `config:25-29` | `envex:651-654` mentions v2 only |
| `MAX_INFLIGHT_SEGMENTS_PER_CALL` | 3 | `engine:83` | Constant |
| `VOICE_TTS_QUEUE_MAX_SENTENCES` | 4 | `engine:85` | Constant |
| `VOICE_TTS_IDLE_FLUSH_SECONDS` | 0.12 | `engine:88` | Constant |
| `VOICE_END_CALL_DRAIN_SECONDS` | 2.0 | `engine:90` | Constant |
| `VOICE_WATCHDOG_INTERVAL_SECONDS` | 1.0 | `engine:91` | Constant |
| `VOICE_SWEEP_INTERVAL_SECONDS` | 60 | `engine:92` | Constant |
| `VOICE_ORPHAN_SESSION_GRACE_SECONDS` / sweep limit | 60 / 200 | `engine:94-95` | Constant |
| `VOICE_TRUNCATION_WINDOW_GRACE_MS` / `WAIT_SECONDS` | 2000 / 3.0 | `engine:108-109` | Constant |
| `VOICE_EL_BILLING_INTERVAL_MS` | 2000 | `engine:117` | Billing cadence on the audio path |
| `VOICE_PLAYBACK_MAX_FRAMES_PER_SECOND` | 4 | `engine:119` | |
| `VOICE_CALL_SECONDS_PER_CREDIT` | 10 | `engine:81` | Strictly checked in history (`route:1408`) |
| `MAX_SPEECH_END_LAG_MS` | 120 000 | `engine:3857` | Bound on the client-reported lag |
| Call start bucket | 3 / 600 s per account, in memory | `token_buckets.py:73` | |
| Auth validation cache TTL | 30 s | `auth_adapter.py:349` | `VALIDATION_CACHE_TTL` |
| uvicorn `ws_max_size` / `ws_ping_interval` / `ws_ping_timeout` / `ws_per_message_deflate` | 16 MiB / 20 s / 20 s / true | `uvicorn/config.py:188-192` | Not overridden (`serve:29-33`) |
| websockets write high-water mark | 64 KiB | `websockets/legacy/protocol.py:168` | |
| Frontend heartbeat / liveness / reconnect max / resume window / resume backoff max | 25 s / 50 s / 30 s / 15 s / 4 s | `fe-socket:20-25` | |
| Frontend upload retry delay / queued upload spacing | 300 ms / 120 ms | `fe-ctrl:152,154` | |

---

## 9. Critical-path latency (user stops speaking → first audio heard)

This covers only the stages owned by this subsystem. The other stages (client VAD hangover, STT, LLM time to first token, TTS time to first byte, client decode) belong to other notes.

| Stage | Estimate (ms) | Evidence | Reasoning |
|---|---|---|---|
| Upload of the full utterance as WAV PCM16 multipart, after VAD end | 50-500 | `route:1159-1186`; `fe-ctrl:575-607` | 32 KB per second of speech: 3 s ≈ 96 KB. About 80 ms at 10 Mbps, about 400 ms at 2 Mbps mobile uplink. Add 1 RTT, or 2-3 RTT for a new TCP/TLS connection (HTTP/1.1 connections are held by in-flight turns). INFERENCE |
| Auth dependency (cache hit vs api.auth round trip) | 0-50 | `auth_adapter.py:349,383,441` | The 30 s TTL means turns more than 30 s apart pay an HTTP validation |
| Route pre-form checks: shadow user, workspace, chat, consent (1-2 queries), feature flag | 5-40 | `route:1141-1158`; `admission:134-158` | About 5-7 sequential DB round trips, consent rechecked on every segment |
| Multipart parse and bounded read (in memory) | 1-5 | `route:1159,1177`; `starlette/formparsers.py:126` | |
| Engine pre-STT: session read, reservation touch UPDATE, find_segment, create_segment, update_segment, 2 ack sends, sha256, server VAD | 5-40 | `engine:2024,2037,2050,2124-2209` | About 5 DB round trips; VAD uses C-level `array` |
| Supersede wait, only when a previous turn is still in flight | 0-500 | `engine:2069-2074` | Waits for the cancel and `finished`, plus heard-prefix bookkeeping. INFERENCE |
| Per-chunk serialization: base64, JSON, sanitize regexes, deflate | <1-2 per chunk | `delivery:442-477,590-612`; `uvicorn/config.py:192` | |
| Billing DB writes inline after the first chunk of each sentence and every 2 s of audio | 5-40 per event | `engine:2507-2508,3378-3455` | Not on the first chunk, but it delays the following chunks. INFERENCE |
| Head-of-line blocking behind already-queued audio of the previous turn on slow downlinks | 0 to several thousand | `delivery:212-231`; `websockets/legacy/protocol.py:168,1164-1184` | No pacing, a single FIFO socket, TCP buffers. INFERENCE |
| **Sum of BE route/transport overhead on a typical turn** | **≈ 60-650** | | Dominated by the batch upload |
| STT timeout worst case | 30 000 | `config:47` | A stalled Groq request holds the turn for 30 s |
| Call setup to `voice_ready` (one time, not per turn) | 300-1500 | `route:926-1035`; `engine:741-938` | 25-35 sequential DB round trips plus the ElevenLabs WS open |

---

## 10. Findings

### BE-ROUTE-TRANSPORT-01: Uplink is batch HTTP per utterance, so STT cannot start before the whole utterance is uploaded (high, latency)

**FACT.** Microphone audio never travels on the call WebSocket. Each VAD-cut utterance is a full WAV PCM16 multipart POST (`route:1130-1223`, `route:1180-1186`; `fe-socket:5-6`; `envex:656-658`).

Every POST repeats the following before STT starts:

- auth;
- shadow-user, workspace, chat-ownership and consent DB reads (`route:1141-1158`);
- multipart parse;
- engine-side session read, reservation touch, and segment insert/update (`engine:2024-2209`).

**Impact.** This adds 50-500 ms of upload transfer plus 15-100 ms of fixed per-turn overhead to every turn. It rules out:

- streaming STT and partial transcripts;
- early or speculative LLM start;
- semantic endpointing that overlaps with speech;
- uncompressed bandwidth savings (WAV is about 256 kbps against about 24-32 kbps for Opus).

**Recommendation.**

- Stream 20-40 ms audio frames (PCM16 or Opus) as **binary frames on the existing call WebSocket**, or move media to WebRTC.
- Run auth, consent and ownership once per call and cache them on the runtime.
- Feed a streaming STT, and keep the HTTP segment path as a fallback.

### BE-ROUTE-TRANSPORT-02: Process-local call state; a misrouted resume ends the live call, and the sticky key cannot be routed on (medium, scalability)

**FACT.**

- The runtime lives in `_calls` (`engine:556-557,703`).
- `resume_call` ends the call when the runtime is not in this process (`engine:966-978`).
- A segment POST to another process gets 409 (`engine:2033-2035`).
- A supersede from another process ends the DB session while the remote runtime keeps streaming (`engine:1158-1176`).
- The docs say to use sticky routing on `voice_session_id` (`voice.md:383-385`). That id is in neither the URL nor a header (`route:1163-1166`).
- Today there is one process (`serve:28-33`).

**Impact.** Safe as a single process. With more than one worker or replica, a reconnect can **kill a healthy call**, segments are lost, and supersede leaves zombie streams that keep billing.

**Recommendation.**

- Route on the chat id in the path, or a call cookie.
- Make a resume on a non-owner process forward the request or refuse it without ending the call.
- Store the owner instance on the session.
- Use pub/sub (Redis) for cross-instance end and supersede.
- Longer term, use a media-server or SFU model (LiveKit / Pipecat-style) where one worker owns the session.

### BE-ROUTE-TRANSPORT-03: Deploys drop every live call; uvicorn closes WebSockets with 1012 before the lifespan shutdown (medium, robustness)

**FACT.**

- uvicorn shutdown calls `connection.shutdown()`, which gives every WebSocket close 1012, then waits for HTTP requests, then runs the lifespan shutdown (`uvicorn/server.py:263-293`; `uvicorn/protocols/websockets/websockets_impl.py:148-154`).
- The route treats 1012 as abnormal and starts grace (`engine:100,1028-1041`).
- `engine.shutdown` later tries to send `voice_ended{server_shutdown}` to sockets that are already gone (`engine:1781-1796`).
- Clients try to resume for 15 s (`fe-socket:24`).
- A resume on the new process ends the call (`engine:966-978`).

**Impact.** Every deploy or restart hard-drops all calls, with a confusing reconnect phase. Turns still in flight keep generating and billing audio nobody hears (see -08).

**Recommendation.** Add a drain mode on SIGTERM:

1. turn the `call` surface and readiness off;
2. send `voice_status`/`voice_ended{server_shutdown}` from a pre-shutdown hook before uvicorn closes sockets;
3. let active calls finish up to a bound (set `timeout_graceful_shutdown`);
4. use rolling deploys with connection draining at the load balancer.

### BE-ROUTE-TRANSPORT-04: After a crash, quota is charged by wall clock up to the full reservation, and global capacity slots leak for up to about 10-15 minutes (medium, correctness)

**FACT.**

- A normal end charges billable audio seconds (`engine:1135-1141`).
- The stale sweep charges `min(elapsed wall-clock, reserved)` (`quota:574`).
- The reservation is the whole call up front (`quota:268`). With defaults that is 600 s, equal to the whole daily allowance (`config:30-31`).
- Dead reservations count against global capacity (`quota:250-258`) until the sweep runs: max duration 600 s from start, or idle 900 s (`quota:567-569`, `config:44`).
- Liveness comes from client pings (`route:1498`). There is no instance ownership or server lease.

**Impact.**

- A user whose call dies in a crash or deploy, and who does not call again within about 10 minutes, loses their whole day's allowance.
- With `VOICE_GLOBAL_CONCURRENCY=8`, a crash with 8 live calls blocks every new call platform-wide for up to about 10 minutes.

**Recommendation.**

- Use lease-based reservations refreshed by the server watchdog every 5-10 s, with an owner instance id.
- At startup, release leases owned by this instance.
- Make the sweeper charge from the session's persisted billing metadata, as `release_orphaned_reservations` already does (`engine:1219-1225`).
- Lease quota in chunks of about 60 s (this is already in the roadmap backlog).

### BE-ROUTE-TRANSPORT-05: No send timeout or slow-consumer policy; unpaced audio causes head-of-line blocking (medium, latency)

**FACT.**

- `send_frame` awaits `websocket.send_json` under the per-socket lock with no timeout (`delivery:212-231`).
- The websockets layer drains at a 64 KiB high-water mark (`websockets/legacy/protocol.py:168,1164-1184`).
- The TTS `deliver` callback awaits each chunk send (`engine:2469-2485`).
- `voice_cancelled` (`engine:1966-1972`) and `voice_ended` (`engine:1150-1155`) use the same FIFO lock.
- Audio is forwarded as fast as it is generated (`engine:2441-2509`).
- Keepalive is 20 s + 20 s (`uvicorn/config.py:190-191`).

**INFERENCE.**

- On a slow link, the previous turn's queued audio delays `voice_cancelled` and the next turn's first audio.
- A stalled peer freezes the TTS pump, barge-in replies and `end_call` for up to about 40 s.

**Recommendation.**

- Wrap sends in `asyncio.wait_for` (1-2 s) and treat a timeout as a disconnect, which starts resume grace.
- Pace audio to real time plus a lead of about 300-500 ms, using `voice_playback` reports.
- Give control frames priority with a separate queue.
- Track bytes in flight per socket.

### BE-ROUTE-TRANSPORT-06: Strict protocol; any unknown, extra-field, binary or malformed frame ends a live call (medium, robustness)

**FACT.**

- Every client model uses `extra="forbid"` (`route:162-262`).
- `_parse_voice_frame` raises fatal (`route:320-330`).
- Any `VoiceOrchestrationError` in the loop closes 4408 and ends the call as failed (`route:1584-1587`).
- A binary frame raises `KeyError` and bad JSON raises in `json.loads`. Both go to `internal` and end the call with a logged traceback (`starlette/websockets.py:138-142`; `uvicorn/protocols/websockets/websockets_impl.py:386-387`; `route:1588-1598`).

**Impact.** There is no forward compatibility. A frontend release that adds a field to `voice_playback` would end every call on the first playback report. A single glitch frame drops the call.

**Recommendation.**

- Ignore unknown types and fields after the handshake, and log them at debug or send a non-fatal `voice_error`.
- Add a protocol version to `voice_start`.
- Keep strict validation for the values that matter.

### BE-ROUTE-TRANSPORT-07: The whole turn runs inside the segment HTTP request (medium, robustness)

**FACT.** `upload_voice_segment` awaits `engine.accept_segment` → `_run_voice_turn` (`route:1194-1221`, `engine:2051-2104`). The frontend relies on the POST resolving only after the turn (`fe-ctrl:622-627`). A superseding segment also waits for the previous turn to finish (`engine:2069-2074`).

**INFERENCE.** Requests last seconds to tens of seconds. That exposes them to:

- reverse-proxy read timeouts (nginx defaults to 60 s);
- the HTTP/1.1 limit of 6 connections per origin;
- spurious "upload failed" notices on a 504 while the server turn continues;
- a loss of a clear ownership boundary for the turn task.

**Recommendation.** Acknowledge the upload right away (202 plus `voice_segment_ack`), run the turn as a task owned by the call runtime, and drive the client only through WebSocket frames.

### BE-ROUTE-TRANSPORT-08: Audio generated during resume grace is dropped, billed and treated as heard; resume has no replay (medium, UX)

**FACT.**

- With no socket, `send_audio_chunk` returns `DROPPED` (`delivery:157-159,266-267`), and the engine still bills and stores that audio (`engine:2486-2497`).
- `socket_disconnected` sets the socket to None and lets the turn continue (`engine:1026,1036-1041`).
- `voice_resume` carries only `last_segment_seq` (`route:199-204`).
- The snapshot reports `last_audio_seq`, but no audio is buffered (`engine:992-1003`).

**Impact.**

- After a network blip of up to 20 s, the user misses part or all of a reply.
- The reply is stored as completed text, so the LLM history assumes the user heard it.
- The user pays for audio they never received.

**Recommendation.**

- On socket loss, pause or cancel the turn at the last reported `played_ms`.
- Or keep a bounded per-turn ring buffer and replay from an acknowledged sequence number on resume.
- Bill only delivered audio, and use `played_ms` as the "heard" boundary.

### BE-ROUTE-TRANSPORT-09: Billing writes are synchronous on the audio delivery path (medium, latency)

**FACT.** `bill_delivered_tts` is awaited inside `deliver` after each sentence start or each 2 s of audio (`engine:2507-2508,117`). Under `billing_lock` it runs `record_call_usage` (a DB transaction) plus `get_session` and `update_session_metadata` (`engine:3378-3455`).

**INFERENCE.** Each event adds about 5-40 ms of stall to the following chunks. A 10-minute call produces about 300 ledger transactions and as many JSON rewrites.

**Recommendation.**

- Keep a running in-memory balance.
- Flush debits asynchronously, off the deliver path, every N seconds with idempotency keys.
- Persist session metadata once per turn or on end.
- Enforce exhaustion from the in-memory balance.

### BE-ROUTE-TRANSPORT-10: STT timeout of 30 s and a pinned STT model block realtime tuning (medium, latency)

**FACT.**

- `DEFAULT_VOICE_STT_TIMEOUT_SECONDS=30.0` (`config:47`).
- `__post_init__` rejects any `VOICE_STT_MODEL` other than `whisper-large-v3` (`config:122-125`) and any provider other than groq (`config:120-121`).

**Impact.**

- A stalled STT request freezes the turn for up to 30 s.
- Ops cannot switch to `whisper-large-v3-turbo` or a streaming STT without a code change.

**Recommendation.**

- Use a 3-5 s timeout with one hedged retry.
- Allow a list of models, including turbo.
- Add a provider abstraction for streaming STT (Deepgram / AssemblyAI / Speechmatics / gpt-4o-transcribe style).

### BE-ROUTE-TRANSPORT-11: Call setup is a long serial gate chain with duplicate reads (low, latency)

**FACT.** The sequence of gates is in §3.1 (`route:926-1035`, `engine:735-939`). Credits are read twice (`engine:738,804`), the plan limit twice (`quota:470,539-541`), and all reservations are listed twice (`quota:523`, `engine:1206`).

**INFERENCE.** It takes about 0.3-1.5 s to `voice_ready`.

**Recommendation.**

- Run the independent gates with `asyncio.gather`; the model preflight already runs in parallel.
- Merge the preflight into the reserve transaction.
- Pre-open the TTS socket while the DB gates run.

### BE-ROUTE-TRANSPORT-12: No handshake timeout or per-user socket cap; frame size limit is far above need (low, security)

**FACT.**

- `_receive_voice_handshake` waits with no timeout (`route:499-510`).
- Pings are answered without rate limiting, and each one triggers a reservation UPDATE after admission (`route:1496-1499`).
- `ws_max_size` is the default 16 MiB (`uvicorn/config.py:188`).

**Recommendation.**

- Wrap the handshake in `wait_for` with about 10 s.
- Cap open voice sockets per user.
- Lower `ws_max_size` for this route, or check the size in the route.
- Rate-limit pings.

### BE-ROUTE-TRANSPORT-13: No warning before a limit ends the call; the idle timer ignores pings and playback (low, UX)

**FACT.**

- The frame set has no warning type (`delivery:17-34`).
- The watchdog ends calls abruptly (`engine:1733-1752,1855-1863`).
- Idle is measured only from segment activity (`engine:2048,2110`).

**Recommendation.**

- Send `voice_status` warnings at T-60 s and T-10 s (already a roadmap backlog item).
- Let the character close gracefully.
- Count playback and presence as activity.

### BE-ROUTE-TRANSPORT-14: Global capacity ceiling and a single lock row; rate-limit state is in memory (low, scalability)

**FACT.**

- `MAX_VOICE_GLOBAL_CONCURRENCY=64`, default 8 (`config:41,48`).
- Every reserve and release locks `voice_quota_capacity` row 1 (`quota:179-180,356,736-742`).
- The call-start bucket is per process (`token_buckets.py:73,89-101`).
- A capacity refusal gives `retry_after=idle_timeout_seconds` (`quota:256`).

**Recommendation.**

- Use sharded or Redis semaphores sized from provider rate limits (Groq / ElevenLabs).
- Move the token buckets to shared storage.
- Return a capacity-aware retry hint.

### BE-ROUTE-TRANSPORT-15: Supersede runs before the new call can actually start (low, robustness)

**FACT.** Supersede (`route:985`) runs before `engine.start_call`. `start_call` can still fail on any of these after the user's old call is gone:

- reservation (`engine:805`);
- `create_session` (`engine:827-849`);
- the TTS `open_call` (`engine:881-893`).

**Recommendation.** Open or prewarm the TTS socket and reserve capacity (excluding the user's own reservation) before superseding, or make the swap one atomic transaction.

### BE-ROUTE-TRANSPORT-16: The TTFB metric is server-side only and coarse (low, observability)

**FACT.**

- `user_stop_ttfb_ms = client speech_end_lag + route_lead + segment→first audio send` (`engine:2906-2910`).
- `route_lead` starts at a dependency that runs after the request headers arrive (`route:1117-1127`).
- Timestamps come from `time.time()` (`observability.py:311-316`).

**INFERENCE.** The metric leaves out:

- connection setup and header transit;
- the downlink transfer;
- client decode and jitter buffer.

The route overhead (auth, DB, form) is not broken down.

**Recommendation.**

- Add per-stage spans: auth, DB gates, form read, STT, LLM TTFT, TTS TTFB, send.
- Have the client report first-audio-played on `voice_playback`, with a clock offset taken from `server_time_ms`.
- Use a monotonic clock for durations.

### BE-ROUTE-TRANSPORT-17: Auth is checked only at the handshake; resume skips access gates (low, security)

**FACT.**

- The token is validated once (`route:1458-1464`; `auth_adapter.py:1574-1608`).
- Resume does not call `_require_call_access` (`route:1038-1081` vs `route:947`).
- The access token rides in `Sec-WebSocket-Protocol`.

**Recommendation.**

- Re-check access on resume.
- Use a short-lived single-use call ticket for the WebSocket instead of the access token.
- Periodically revalidate, or rely on the restriction hooks (`engine:1241-1265`) across instances.

### BE-ROUTE-TRANSPORT-18: Downlink is base64 MP3 in JSON with no timing metadata (info, audio-quality)

**FACT.**

- MP3 only (`delivery:67-69`).
- Base64 in a JSON text frame (`delivery:464`).
- Per-message-deflate is on (`uvicorn/config.py:192`).
- No per-chunk timestamp or duration.

**INFERENCE.**

- Base64 adds about 33 % (partly recovered by deflate, at some CPU cost).
- MP3 needs decoder or MSE buffering on the client.

**Recommendation.** Use binary frames with a small header (turn, seq, sample offset, duration), and consider PCM16 or Opus for lower decode latency and easier jitter buffering.

### BE-ROUTE-TRANSPORT-19: Doc and code drift, dead code (info, maintainability)

**FACT.**

- The `elevenlabs_call_idle_issue` docstring says "180 s inactivity", but the constant is 20 s (`config:33-39,425-439`; also `engine:662-663`).
- `envex:651-654` says one consent version, `voice-v2`, but the code accepts `voice-v3` for Fish (`admission:141`).
- `_send_voice_error_and_close` is unused (`route:421-428`).
- The frontend handles close codes 4404 and 4422, which the server never sends (`fe-socket:43-46`).
- `VOICE_STALE_SESSION_SECONDS` is not validated to be at least `VOICE_MAX_CALL_DURATION_SECONDS` (`config:211-219`). A long call's session row could be expired by `expire_idle_for_user`, because pings do not update `last_heartbeat_at` (`models.py:7289-7319`).

---

## 11. Strengths

- **Clean auth on the socket:**
  - the subprotocol token is validated through the shared TTL-cached adapter;
  - origin is allowlisted;
  - failures before ready accept and then close with typed codes (4401/4403), so browsers see a reason rather than 1006 (`route:450-470`).
- **Strict, typed frames on both sides.** Every outbound frame passes a type allowlist and secret redaction (`delivery:17-34,590-612`). Provider URLs, keys and hex audio cannot leak.
- **The authoritative quota check is atomic across workers.** It uses a DB transaction with a capacity row lock, per-user and global limits, and an idempotent duplicate reservation (`quota:150-308`).
- **Gate order is carefully designed:**
  - every refusal happens before supersede;
  - a rejected start never takes a token or uses up a Free activation (`route:941-985`);
  - the model preflight runs in parallel with the DB gates (`route:954-977`).
- **Robust socket identity handling:**
  - a stale socket can never end or steer a resumed call (`engine:1023-1025,1277-1278,1319-1320`);
  - close is idempotent (`route:405-418`);
  - `end_call` is safe under concurrency (`engine:1116-1120`).
- **Resume grace:** a configurable window, a frontend window kept below it, and a state snapshot on resume (`engine:940-1041`; `fe-socket:23-24`).
- **Dual end paths:** WebSocket `voice_end` and an HTTP `voice-end` with keepalive on pagehide. The HTTP path is never feature-gated (`route:1246-1282`).
- **Upload hardening:**
  - `Content-Length` is checked before parse;
  - admission and ownership are checked before any microphone bytes are parsed;
  - the read is bounded;
  - the sha256 must match;
  - an Idempotency-Key gives exactly-once turns across client retries (`route:1130-1243`; `engine:2037-2040,2124-2144`).
- **Billing is idempotent per slice,** with credit exhaustion ending the call. Only delivered audio is billed, not the generated audio that a cancel dropped (`engine:2486-2497,3378-3439`).
- **Latency instrumentation exists:** the receipt stamp before auth, `user_stop_ttfb_ms`, `voice_turn_audio` with queue wait (`route:1115-1127`; `engine:2878-2924`).
- **Ops hygiene:**
  - the stale sweeper also runs without an engine (`main:1140-1151`);
  - misconfiguration fails at startup;
  - orphan env settings are rejected (`config:254-278`).
- **Extensive tests** in `tests/voice/` (about 60 files), covering route admission, frame widening, delivery, lifecycle, barge-in and the quota store.

---

## 12. Open questions (UNKNOWN)

1. What is the production topology: uvicorn workers or replicas, the reverse proxy (nginx, Cloudflare), its read timeouts, and whether HTTP/2 is enabled toward the BFF? (Roadmap V-12 is still open.)
2. Is MySQL on the same host as the API? This sets the per-round-trip cost, estimated above at 1-5 ms.
3. What are the real `route_lead_ms`, upload durations and `user_stop_ttfb_ms` p50/p95 from production or staging logs? The roadmap says no p50/p95 evidence is recorded yet.
4. Does the frontend drop queued chunks by `turn_id` immediately on a local barge-in? That limits the impact of head-of-line blocking (frontend audit).
5. What are the ElevenLabs and Fish chunk sizes, cadence and MP3 bitrate on the call lane? They set the frame size and the backpressure thresholds.
6. Is the 20 s resume grace enough for mobile network handoffs (Wi-Fi → LTE often takes 5-15 s)?
7. Are binary-frame audio upload and streaming STT planned? The roadmap marks streaming STT and model-based turn detection as "deferred / TBD".
8. What does the deployment do on SIGTERM: is there pre-stop draining at the load balancer, and is `timeout_graceful_shutdown` set?

---

## Verification (adversarial)

A second reviewer re-opened every cited line and looked for code that would contradict each finding: guards elsewhere, config defaults, library internals and the frontend.
No source file was modified.
Verdicts: **confirmed** (verified as stated), **adjusted** (the core issue is real, but the severity, mechanism or details were corrected), **refuted** (not supported by the code).

| id | verdict | corrected severity | evidence / note |
|---|---|---|---|
| BE-ROUTE-TRANSPORT-01 | confirmed | high | `route:1130-1221`: every segment POST does auth (`get_authenticated_user`), `_project_local_user`, `resolve_workspace_context`, `get_user_chat` and `build_admission_context` (consent read, `admission:189-213`) before `request.form()`. Then `engine:2024-2051` reads the session, checks the hash, calls `touch_call` (a reservation UPDATE) and `create_segment`/`update_segment`. The only WS reads are `receive_json` (`route:501,1494`), and no binary audio path exists. `envex:656-658` says "request/response HTTP multipart only". The upload-time and overhead figures are estimates, but the structural claim holds. |
| BE-ROUTE-TRANSPORT-02 | adjusted | low | The mechanics are verified. `engine:966-978`: resume of a DB-active call that is not live in this process ends it with `disconnected`. `engine:2033-2035` returns a 409 conflict (`admission:106`). `route:880-905` supersede calls `end_call`, which on a non-owner takes the `engine:1158-1176` branch, while the remote runtime's in-flight turn keeps running. **Corrections:** (1) `docs/api_usage/voice.md:383-385` asks for "sticky routing" without naming a key; it never says `voice_session_id`. (2) Sticky routing is feasible today on the chat id in both URL paths, or with LB cookie affinity, because the WS upgrade and credentialed fetches both carry cookies. (3) Only the current turn keeps streaming: later segments fail on the DB `status` check. (4) The deployment is single-process (`Dockerfile:87` → `src.serve`, no workers), and the constraint is documented. This is a latent scaling hazard, so low. |
| BE-ROUTE-TRANSPORT-03 | confirmed | medium | `uvicorn/server.py:263-293` closes sockets, calls `connection.shutdown()`, waits for tasks (`timeout_graceful_shutdown=None`), then runs `lifespan.shutdown()`. `websockets_impl.py:148-154` sends `fail_connection(1012)`, and `websockets_impl.py:379-382` returns disconnect code 1012 while `ws_server.closing`. `engine:100` defines `_NORMAL_CLOSE_CODES={1000}`, so 1012 starts grace (`engine:1028-1041`) and sets `runtime.socket=None` (`engine:1026`). `engine.shutdown` → `end_call` then sends `voice_ended` to `runtime.socket`, which is None. A resume against the new process ends the call (`engine:966-978`). |
| BE-ROUTE-TRANSPORT-04 | confirmed | medium | `quota:268` sets `reserved=min(max_call_seconds, remaining)`, and the defaults are 600 s for both (10 min/day, `config:30-31`). The sweep charges `min(elapsed, reserved)` (`quota:568-576`). It sweeps at elapsed ≥ max_call (600 s) or idle ≥ `stale_session_seconds` (900 s, `config:43`, not the 120 s idle timeout), with a 60 s cadence. Global count (`quota:250-258`) includes dead rows. Liveness comes only from `touch_call` on ping and segment (`route:1498`, `engine:2051`). **Nuances:** a clean lifespan shutdown releases correctly with billed seconds (`engine:1781-1796`), so this needs a crash or SIGKILL. That is plausible on deploy, because uvicorn waits on in-flight turns with no timeout. A user who calls again before the sweep is charged correctly through supersede (`_consumed_seconds_from_session`). |
| BE-ROUTE-TRANSPORT-05 | adjusted | medium | Verified: `delivery:212-231` awaits `send_json` under a per-socket lock with no timeout. The `write_limit` default is 64 KiB (`websockets/legacy/protocol.py:168,1459`) and drains in `write_frame` (`:1175-1184`). The `deliver` callback awaits each send serially (`call_tts_elevenlabs.py:275`, `engine:2469-2485`). `voice_cancelled` uses the same lock (`delivery:270-287`). **Corrections:** (1) Generation is not fully unpaced. A flush-ahead gate (`call_tts_elevenlabs.py:14-21,55-58,165-167`) holds text once 3 sentences are unheard or the audio is ≥ 8 s ahead of playback, which bounds the queued lead to about 8 s; only per-chunk forwarding is unpaced. (2) Keepalive does not bound the stall to 40 s. `keepalive_ping` awaits `self.ping()`, which awaits `write_frame` → `drain` before the pong timeout starts (`protocol.py:1233-1242`, `:843`). While the transport is paused the keepalive never fires, so the stall lasts until the client's 50 s liveness timer (`fe-socket:21,590-595`) or a TCP failure. That is worse than stated. |
| BE-ROUTE-TRANSPORT-06 | confirmed | medium | Every frame model has `extra="forbid", strict=True` (`route:160-251`). `_parse_voice_frame` raises a fatal `conflict` for an unknown type or a validation error (`route:320-330`). The live loop goes `except VoiceOrchestrationError` → `_end_failed_socket_call` (the call is ended as failed) → close 4408 (`route:1584-1587`, `admission:20`). Binary frames: Starlette's `receive_json` mode=text does `message["text"]` (`starlette/websockets.py:138-139`); uvicorn delivers binary as `{"bytes":…}` only (`websockets_impl.py:386-387`). The resulting KeyError, like a json.loads error, reaches `except Exception` and the call ends as internal. |
| BE-ROUTE-TRANSPORT-07 | confirmed | medium | `route:1194-1221` awaits `engine.accept_segment`, which awaits `_run_voice_turn` (`engine:2093-2105`). The frontend comment at `fe-ctrl:621-622` relies on the POST ending with the turn. The supersede path waits on `previous.finished` (`engine:2069-2074`), but only after cancelling the previous turn, so that wait is short. Because the flush-ahead gate paces TTS to playback, a long reply keeps the POST open for about its playback length, so a 60 s proxy read timeout is realistic. The frontend retries only on a `TypeError` network error (`fe-ctrl:600-607`), so a 504 surfaces as `VOICE_UPLOAD_FAILED`. |
| BE-ROUTE-TRANSPORT-08 | confirmed | medium | `delivery:266-267` returns DROPPED when the socket is None. `engine:2486-2497` comments "accepted while the socket is away: billable and stored" and runs `assistant_audio.extend`, `tts_meter.feed` and `ledger.on_audio` (`call_ledger.py:250-258` advances `_delivered`). `socket_disconnected` (`engine:1012-1041`) does not cancel turns. `VoiceResumeFrame` carries only `last_segment_seq` (`route:199-204`). `resume_call` sends a snapshot and replays nothing (`engine:992-1003`). Truncation to `played_ms` happens only on barge-in (`engine:1367-1390`). With no playback reports, the flush-ahead gate estimates playback from wall clock, so generation keeps going during grace. |
| BE-ROUTE-TRANSPORT-09 | adjusted | low | The TTS-side mechanism is verified: `engine:2507-2508` awaits `bill_delivered_tts` inside `deliver` every sentence start or 2 s (`engine:117`). `_record_billable_audio` (`engine:3378-3439`) runs `debit_operation_credits` plus `_persist_billing_metadata` (SELECT and UPDATE, `engine:3441-3455`) under `billing_lock`. **Corrections:** (1) The TTS-side delay is mostly hidden from the listener, because audio already leads playback by up to about 8 s (flush-ahead gate), and the first chunk is sent before the first billing. (2) The finding missed the one billing write that is on the TTFA critical path: STT billing (`engine:2243-2251`) runs the same ledger transaction and metadata rewrite serially between STT completion and LLM start. That adds about one ledger round trip to every turn. Overall this is low: tens of ms per turn plus DB load. |
| BE-ROUTE-TRANSPORT-10 | adjusted | low | Verified: `config:47` (30.0), `config:120-125` (provider must be `groq`, model must be `whisper-large-v3`), `stt_groq_client.py:548-556` (httpx read timeout = the setting, single attempt). **Corrections:** the timeout can be tuned through `VOICE_STT_TIMEOUT_SECONDS` (0.1-120 s, `config:135-143,298-304`) with no code change, so only the model and provider pin needs code. It affects tail latency only, on provider stalls. Groq large-v3 is already far faster than real time, and turbo would save little. Low. |
