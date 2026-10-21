# Gap audit: segment POST abort, pre-ready close, playback rate limit, resend/idempotency

Subsystem: voice-call control plane (HTTP segment upload and WebSocket lifecycle edges).
Finding prefix: `GAP-SEGMENT-POST-AND-CONTROL-PLANE-UNKNOWNS-` (written below as `GAP-SP-NN` for short; the
full id is in each heading).

This note settles open questions left by earlier audits:

- `fe-playback-transport.md` §7, Q6-Q8.
- `be-route-transport.md`: BE-ROUTE-TRANSPORT-04 and -07.
- `be-engine-turntaking.md`: BE-ENGINE-TURNTAKING-06.

Labels: **FACT** means seen in code or reproduced by the local probe in §1.4. **INFERENCE** means reasoned
from facts. **UNKNOWN** means it cannot be settled from the repositories.

Repositories (read-only; no source file was changed):

- Backend: `/home/andres/PycharmProjects/magic-worlds-api` (abbreviated `BE`). HEAD is `9d75cf4`.
  `route_voice_call.py` was last changed on 2026-10-18 (`70c9c27`).
- Frontend: `/home/andres/WebstormProjects/magic-worlds` (abbreviated `FE`).

Path abbreviations used below:

| Short | Full path |
|---|---|
| `route` | `BE/src/routes/user/route_voice_call.py` |
| `engine` | `BE/src/services/voice_orchestration/engine.py` |
| `delivery` | `BE/src/services/voice_orchestration/delivery.py` |
| `quota` | `BE/src/services/voice_orchestration/quota.py` |
| `admission` | `BE/src/services/voice_orchestration/admission.py` |
| `ctrl` | `FE/src/features/interaction/hooks/useVoiceCallController.ts` |
| `vsock` | `FE/src/infrastructure/api/voiceSocket.ts` |
| `api` | `FE/src/infrastructure/api/index.ts` |
| `uv/` | `BE/.venv/lib/python3.13/site-packages/uvicorn/` |
| `st/` | `BE/.venv/lib/python3.13/site-packages/starlette/` |

---

## 0. TL;DR (answers)

| Q | Answer | Confidence |
|---|---|---|
| **Q1.** Is the turn cancelled when the browser aborts or loses the segment POST? | **No.** Neither uvicorn protocol (h11, which is the one deployed, nor httptools) cancels the ASGI task on disconnect. Starlette and FastAPI do not either, there is no `BaseHTTPMiddleware`, and the voice code never calls `request.is_disconnected()`. Two windows exist. **(a)** Abort *before* `request.form()`: the parse raises `ClientDisconnect`, the segment never exists, and uvicorn logs an ERROR traceback. **(b)** Abort *after* the form is parsed: `accept_segment` and `_run_voice_turn` run to completion. STT, LLM, TTS, billing, frames over the WS and history all happen; the HTTP response is silently dropped, with no access-log line. Reproduced locally (§1.4). The only thing that stops a running turn is the engine's cooperative `cancel_event`: a supersede, a barge-in or `end_call`. | high |
| **Q2.** Client closes 1000 before `voice_ready` | The reservation is **not orphaned**. The handler never reads the socket during admission, so the whole admission runs anyway: start token, Free activation, supersede of the user's other calls, quota reservation, session row, TTS socket. What happens next depends on timing. If the close was processed before `voice_ready` was sent, the send fails, the failure is swallowed, and the route's next `receive_json()` raises `RuntimeError`, so the call is ended as **status=failed, end_reason=internal** with an ERROR traceback (reproduced, §2.4). If `voice_ready` went out first, the close is seen as `WebSocketDisconnect(1000)` and the call ends cleanly with `disconnected`. Only a crash, SIGKILL or task cancellation between reserve and register orphans a reservation (BE-ROUTE-TRANSPORT-04 path). | high |
| **Q3.** Is the `voice_playback` limit per turn or per call? | **Per call.** A sliding 1 s window (`runtime.playback_frames`) allows 4 frames per second. Excess frames are **silently ignored**: no frame back, not fatal, no metric. The client sends 2 frames per second (every 500 ms). A malformed frame is still fatal (strict schema). | high |
| **Q4.** Do the resend and the Idempotency-Key yield `duplicate` while the original turn continues? | **Yes.** After a fetch `TypeError`, one resend fires after 300 ms. The server dedupes on the DB row `(voice_session_id, seq, role)`; the Idempotency-Key is only checked for consistency, and there is no response cache. The resend waits on the call's `intake_lock` while the original is in STT, then returns `{status: duplicate, reason: <row status>}`, usually with no `turn_id`, while the original turn keeps streaming. The client's `finally` then clears `serverTurnActiveRef`, `serverTurnIdRef` and the turn phase mid-turn. A second network failure, or an HTTP 5xx/504 from a proxy, shows `VOICE_UPLOAD_FAILED` although the turn completes and plays. | high |

**Verdict on the turn-bound-to-POST design** (BE-ROUTE-TRANSPORT-07, BE-ENGINE-TURNTAKING-06):

- **It orphans turns but rarely loses them.** The POST is neither a cancellation channel nor a reliable
  completion signal. Everything the user experiences (frames, audio, history) travels over the WebSocket
  and the DB, so a lost POST response is mostly cosmetic. The exception is the client's turn state.
- **Real losses come from elsewhere:**
  - the pre-form abort window;
  - the WS being down while the orphaned turn streams (BE-ROUTE-TRANSPORT-08 / FE-PLAYBACK-TRANSPORT-01);
  - **mislabelled ends**. A dropped socket whose last server send failed is ended as `failed/internal`
    with no resume grace (GAP-SP-03). That path feeds "internal" and "disconnected" counts in real call
    data.

---

## 1. Q1: what happens when the segment POST is aborted or lost

### 1.1 Stack and versions (FACT)

| Component | Version / setting | Evidence |
|---|---|---|
| fastapi / starlette / uvicorn / h11 | 0.116.1 / 0.47.2 / 0.35.0 / 0.16.0 | `BE/requirements.txt:10,12,25,28`; confirmed in `.venv` |
| websockets | 16.0 (`>=16.0,<17`) | `BE/requirements.txt:29` |
| httptools, uvloop | **not installed**; not in requirements; no `uvicorn[standard]` | `.venv` import check; `requirements.txt` |
| HTTP protocol in use | `http="auto"` → `H11Protocol`, because httptools cannot be imported | `uv/protocols/http/auto.py:6-14`; `uv/config.py:186` |
| WS protocol in use | `ws="auto"` → `websockets_impl.WebSocketProtocol` (websockets legacy API) | `uv/protocols/websockets/auto.py:7-20` |
| Launcher | `uvicorn.run("src.main:app", host, port)` with no overrides (keep-alive 5 s, ws ping 20/20 s, `timeout_graceful_shutdown=None`) | `BE/src/serve.py:28-33`; `uv/config.py:189-216`; `BE/Dockerfile:87` |
| Middlewares | CORS, `ProviderRequestContextMiddleware`, `VoiceGeoMiddleware`, `ModerationCallerContextMiddleware`. **All pure ASGI**; none is `BaseHTTPMiddleware` and there is no `@app.middleware("http")` | `BE/src/main.py:1463-1479`; `provider_request_context.py:163-181`; `speech/geo.py:336-362`; `speech/moderation_transport.py:202-223`; grep shows no `BaseHTTPMiddleware` in `src` |
| Exception handlers | only `FeatureFlagError`, `ProviderApiError` and the workspace handler; **nothing for `ClientDisconnect`** | `BE/src/main.py:1455,1482,1485`; grep shows no `ClientDisconnect` in `src` |
| `request.is_disconnected()` | used only by the feature-flag SSE route, never in voice code | `BE/src/routes/feature_flags.py:71` |

Why the middleware type matters (INFERENCE): `BaseHTTPMiddleware` runs the downstream app in an anyio task
group, which can cancel it on a client disconnect. A pure-ASGI chain has no such watcher, so nothing above
the endpoint observes `http.disconnect`.

### 1.2 Request timeline of `POST /character-chats/{id}/voice-segments` (FACT)

| Step | What | Where |
|---|---|---|
| 0 | `_mark_segment_received` stamps the receipt time; `require_features("calls")` | `route:1120-1122,1130` |
| 1 | `get_authenticated_user` → `AuthAdapter.validate_token`: TTLCache with **TTL 30 s** (`VALIDATION_CACHE_TTL`); a miss is an HTTP call to api.auth with a 2 s timeout | `BE/src/services/auth_adapter.py:1509-1540,349`; `BE/src/main.py:740-747` |
| 2 | `_http_user_context` (local user), `resolve_workspace_context(intent="new_work")`, `get_user_chat` | `route:1144-1148` |
| 3 | `build_admission_context(require_capacity=False)`: a consent read, deliberately **before** the body is parsed | `route:1149-1157`; `admission:189-215` |
| 4 | Content-Length gate: 411/400/413 above `max_segment_bytes + 64 KiB` | `route:1158,1226-1243`; `route:80` |
| 5 | **`form = await request.form()`**. The body is consumed here, and only here can a disconnect be observed. | `route:1159` |
| 6 | Field validation; `upload.read(max_segment_bytes+1)`; Idempotency-Key header (format only) | `route:1160-1193` |
| 7 | `await engine.accept_segment(...)`, which runs the **whole turn** | `route:1194-1220` |
| 8 | `return result.as_response()`, or a `VoiceOrchestrationError` mapped to an HTTPException | `route:1221-1223` |

Inside `accept_segment` (FACT):

1. `get_session` (DB) and an active check, then the runtime check (`engine:2021-2035`).
2. sha256 of the body, `_validate_idempotency_key`, then the cap of `MAX_INFLIGHT_SEGMENTS_PER_CALL=3`
   (`engine:2037-2042`, `engine:83`).
3. The turn object `_VoiceTurn(task=asyncio.current_task())`. **The request task is the turn task**
   (`engine:2046`).
4. `touch_call` (DB UPDATE), then **`async with runtime.intake_lock`** around `_intake_segment`:
   find, create the row, ack, VAD validate, STT, bill STT, mark the row completed (`engine:2050-2067`,
   `engine:2112-2284`).
5. Supersede of the previous turn, waiting on `previous.finished` (`engine:2069-2088`).
6. `await self._run_voice_turn(...)` (`engine:2092-2104`). It returns only after the TTS drain
   (paced by flush-ahead, `call_tts_elevenlabs.py:55-58,164-170`), `voice_turn_end`, asset
   persistence and the final segment update (`engine:2682-2766`).
7. `finally`: discard the turn, clear `current_turn`, set `turn.finished` (`engine:2105-2110`).

**Turn cancellation is cooperative only.** `_cancel_turn` sets `turn.cancel_event`, freezes the ledger,
marks the turn cancelled in delivery and stops the speaker (`engine:1958-1976`). `turn.task` is read only
by `_drain_turns` to exclude the caller (`engine:1884`). No code path calls `turn.task.cancel()` (grep).

### 1.3 What the server transport does on a client disconnect (FACT)

**uvicorn h11** (the deployed protocol):

- `connection_lost` sets `cycle.disconnected = True`, sets `message_event`, resumes writing and
  closes the transport. **It does not cancel the request task** (`uv/protocols/http/h11_impl.py:103-127`).
  The task was created with a plain `loop.create_task(self.cycle.run_asgi(app))` (`:250-252`).
- `receive()`: once disconnected it returns `{"type": "http.disconnect"}` **even if body bytes are
  already buffered** (`:521-541`, the check is at `:534`).
- `send()`: `if self.disconnected: return`. The response is dropped silently, **before** the
  access-log line is written (`:447-454` vs the access log at `:472-480`).

**uvicorn httptools** (not installed, checked for completeness): same behaviour
(`uv/protocols/http/httptools_impl.py:113-130` connection_lost, `:456-457` send, `:556-570` receive).

**uvicorn server:** tasks are cancelled only when `timeout_graceful_shutdown` expires
(`uv/server.py:276-289`), and the launcher does not set it.

**Starlette 0.47.2:**

- `request_response` awaits the endpoint and then the response, with no disconnect listener
  (`st/routing.py`, `request_response`).
- `Request.stream()` raises `ClientDisconnect` when it receives `http.disconnect` (`st/requests.py:219-236`).
- `is_disconnected()` is opt-in (`st/requests.py:303-315`).
- `ServerErrorMiddleware` re-raises unhandled exceptions after trying a 500, so uvicorn logs
  "Exception in ASGI application" (`st/middleware/errors.py` `__call__`; `uv/.../h11_impl.py:401-409`).

### 1.4 Local probe (FACT, reproduced)

Script: `/tmp/claude-1000/-home-andres-WebstormProjects-magic-worlds/9c4c3da7-06b7-4cee-a58b-d2b1e4f9477c/scratchpad/asgi_disconnect/probe.py`
(run with `BE/.venv/bin/python -I`, the same installed libraries; uvicorn `http="auto"`, `ws="auto"`).

Shapes it mirrors:

- a pure-ASGI middleware;
- `/late-abort`: `request.form()`, then a 2 s "turn";
- `/early-abort`: a 1 s "pre-form gate chain", then `request.form()`;
- `/ws-send-first`: accept, receive `voice_start`, a 1 s "admission", `send_json(voice_ready)`, then
  `receive_json()`;
- `/ws-receive-first`: the same without the send.

The HTTP client sends the full multipart body over a raw socket and closes it. The WS client sends
`voice_start` and closes with 1000 after 0.2 s.

Output (verbatim):

```
  0.05s server http protocol=H11Protocol
  0.05s late-abort: form parsed fields=['audio', 'seq']
  0.55s client: /late-abort socket closed after 0.5s
  0.55s late-abort: turn step 0 still running
  1.06s late-abort: turn step 1 still running
  1.56s late-abort: turn step 2 still running
  2.06s late-abort: turn step 3 still running
  2.06s late-abort: turn COMPLETED is_disconnected=True
  3.36s client: /early-abort socket closed after 0.3s
  4.06s early-abort: pre-form awaits done; calling request.form()
  4.06s early-abort: request.form() raised ClientDisconnect
  4.87s ws-send-first: handshake voice_start
  5.07s client: /ws-send-first closed 1000 before voice_ready
  5.87s ws-send-first: voice_ready send raised WebSocketDisconnect code=1006 app_state=DISCONNECTED
  5.87s ws-send-first: receive_json -> RuntimeError: WebSocket is not connected. Need to call "accept" first.
  6.77s client: /ws-receive-first closed 1000 before voice_ready
  7.57s ws-receive-first: receive_json -> WebSocketDisconnect code=1000
```

The early-abort case also printed `ERROR: Exception in ASGI application` with a `starlette.requests.ClientDisconnect`
traceback that runs through `starlette/middleware/errors.py`.

### 1.5 The two abort windows

**(a) Pre-form window:** steps 0-4 of §1.2.

- Size (INFERENCE): about 5-25 ms warm, which is roughly 4-6 DB round trips plus a cached auth check.
  Add about 5-50 ms on an auth-cache miss, which happens when more than 30 s passed since the last
  validation of this token.
- What happens (FACT): `request.form()` raises `ClientDisconnect` (`st/requests.py:234-236`). The route
  catches only `VoiceOrchestrationError` (`route:1222`), so the exception propagates and uvicorn logs an
  ERROR traceback (probe).
- No segment row is created and no STT runs. The utterance is dropped, which is correct on hang-up, and
  a resend after a network blip goes through cleanly.

**(b) Post-form window:** from step 5 to the end of the turn. This is seconds to minutes, because the
POST lives through STT, the LLM and playback-paced TTS.

- Nothing observes the disconnect. The turn completes and returns its `VoiceSegmentResult` into a no-op
  `send`.

INFERENCE: with a reverse proxy that buffers request bodies (nginx `proxy_request_buffering on` by
default), the upstream request starts only after the proxy has the whole body. Window (a) then moves
to the proxy, which never forwards the request (UNKNOWN: the production topology).

### 1.6 Consequences by scenario (billing and history)

| Scenario | Server turn | Billing | History / rows | Client |
|---|---|---|---|---|
| **User hangs up** while a turn is in flight. `teardownForEnd` sends WS `voice_end` (`ctrl:1101`, `vsock:234-239`), then `stopLocalResources` → `abortUploads` + `close(1000)` (`ctrl:478-483,501-521`), then HTTP `voice-end` keepalive (`ctrl:1113-1120`). | The POST abort is ignored. `end_call` cancels the turn cooperatively (`engine:1129-1133`) and waits at most `VOICE_END_CALL_DRAIN_SECONDS=2.0` (`engine:87,1883-1894`). A turn that runs longer **keeps running after the call ended**, e.g. a slow STT (timeout 30 s, `config.py:47`) or slow DB writes. | STT billed at intake has **no cancel/ending check** (`engine:2228-2251`). If that lands after the 2 s drain, credits are charged (`engine:3404-3410`), but quota was already released with the snapshot (`engine:1135-1141`), and `_persist_billing_metadata` is a no-op on an ended row (`models.py:7364-7371`, `status IN ('starting','active','ending')`). → **GAP-SP-08** | The user message may be persisted, and the assistant row ends interrupted (normal end path). | The abort is silent (`ctrl:616`). |
| **Network blip, WS survives** (POST connection reset mid-turn) | Runs to completion (probe). | Correct: everything was actually delivered over the WS. | Correct. | `TypeError` → one resend after 300 ms (`ctrl:597-608`) → `duplicate` (§4) → `finally` clears the turn state early (**GAP-SP-05**). |
| **Network loss, WS also drops** | Runs to completion. Frames go to `runtime.socket=None` → `DROPPED`. | Billed and stored as delivered (`engine:2486-2497`; BE-ENGINE-TURNTAKING-08). | Stored as if heard. | Resend fails again → `VOICE_UPLOAD_FAILED` notice (`ctrl:615-618`). Resume gives only a snapshot (BE-ROUTE-TRANSPORT-08). |
| **Proxy read timeout** (for example nginx 60 s on a long reply; UNKNOWN whether a proxy exists) | Upstream close → `disconnected` → runs to completion. | Correct. | Correct. | 504 is an `ApiError`, not a `TypeError`, so there is **no resend**. A false `VOICE_UPLOAD_FAILED` notice shows while the reply still plays, and the turn state is cleared (**GAP-SP-05**). |
| **Abort inside the pre-form window** (any cause) | Never starts. | None. | No row. | On hang-up: none. On a blip: the resend is processed normally (no row exists). |
| **Rejected / no_speech outcome with a lost response** | Ends early. | STT billed. | Row `rejected`. | `no_speech` is reported **only** in the HTTP body (`engine:2252-2275`; no ack frame), so the client never learns it. Harmless: the reason is silent and the phase is settled by `finally`. |

---

## 2. Q2: client closes 1000 before `voice_ready`

### 2.1 When the client does this (FACT)

- `voice_start` carries **no `voice_session_id`** (`ctrl:1255-1273`). The server mints the uuid
  (`engine:797-801`), so before `voice_ready` the client cannot send `voice_end` (`vsock:235` returns
  false without an id) or HTTP `voice-end` (`ctrl:1096-1100`, which needs `voiceSessionIdRef`).
- The client closes pre-ready on:
  - the **ready timeout** of `VOICE_READY_TIMEOUT_MS = 15_000` (`ctrl:127,1082-1088`), via
    `stopLocalResources({closeSocket:true})` → `vsock.close(1000)` (`vsock:255-271`);
  - the user pressing End while connecting (`ctrl:1093-1110`);
  - unmount (`ctrl:1202-1214`).

### 2.2 What the server does during admission (FACT)

`voice_call_ws` accepts, receives the handshake and then awaits `_create_admitted_voice_session`. It does
**not** read the socket until that returns (`route:1464-1493`). The admission chain runs serially:

1. `_ws_user_context`, `resolve_workspace_context(new_work)`, `get_user_chat` (`route:935-940`).
2. `_require_call_access`, `_require_call_surface`, plus `preflight_call_model` started as a parallel
   HTTP task (`route:947-956`).
3. Voice override and resolution, consent; then `await model_check` (`route:957-976`).
4. `engine.preflight_start`: credits and quota preflight (`route:980`; `engine:735-739`;
   `quota:512-547`).
5. **`_take_call_start_token`**: 3 per 600 s per account, in memory (`route:830-840,981`;
   `speech/token_buckets.py:73`).
6. **`_record_call_free_activation`** (`route:760-773,982`).
7. **`_supersede_active_voice_calls`**: ends **every other active call of the user**, then
   `release_orphaned_reservations` (`route:880-916,985`).
8. `build_admission_context(require_consent=False)`, which reaps idle rows and checks capacity
   (`route:986-992`; `admission:161-186`).
9. `engine.start_call`:
   - credits (`engine:804`);
   - **`quota_service.reserve_call`** (`engine:805`);
   - `create_session` (`engine:826-849`);
   - build `voice_ready` (`engine:859-879`);
   - **`speech_provider.open_call`**, which opens the TTS socket (`engine:882-893`);
   - register the runtime and the watchdog (`engine:894-925`);
   - `_send(voice_ready)` and `_send(listening)` (`engine:926-929`).

Every `Exception` between the reserve and registration releases the reservation through
`_release_failed_start` (`engine:806-817,848,879,885`; `engine:1896-1919`).
`asyncio.CancelledError` is **not** caught there (it is a `BaseException`), but nothing cancels this
task short of a configured graceful-shutdown timeout (§1.3).

### 2.3 The send-failure mechanics (FACT)

- `engine._send` → `_send_to` → `delivery.send_frame` → `websocket.send_json`.
- In Starlette, `WebSocket.send` catches `OSError`, sets `application_state = DISCONNECTED` and raises
  `WebSocketDisconnect(1006)` (`st/websockets.py:87-89`). uvicorn raises
  `ClientDisconnected(OSError)` from `asgi_send` when websockets says `ConnectionClosed`
  (`uv/protocols/websockets/websockets_impl.py:323-345`; `uv/protocols/utils.py:9`).
- `delivery.send_frame` catches every `Exception`, unregisters the socket lock and raises
  `VoiceDeliveryDisconnected(ConnectionError)` (`delivery:212-231,162`).
- `_send_to` swallows that and returns False (`engine:1946-1953`). `runtime.socket` stays pointed at the
  dead socket.
- The route then calls `websocket.receive_json()`. Starlette checks `application_state != CONNECTED`
  first and raises **`RuntimeError('WebSocket is not connected. Need to call "accept" first.')`**
  (`st/websockets.py:130-136`, raise at `:134`). It does **not** raise `WebSocketDisconnect`.

### 2.4 Outcomes

| Timing | Path | Stored result | Logs / metrics |
|---|---|---|---|
| A. The close is processed before `voice_ready` is sent (typical, since admission takes 100s of ms to seconds) | `RuntimeError` → `except Exception` (`route:1588-1598`) → `_end_failed_socket_call(category="internal")` → `engine.release_socket(reason="disconnected", failure_category="internal")` (`route:1605-1628`; `engine:1043-1068`) → `end_call(outcome="failed", stored_reason="internal")` → quota released with consumed=0 and the TTS call closed (`engine:1122-1157`) | `voice_session.status='failed'`, `end_reason='internal'`, `consumed_seconds=0` | `logger.exception("[VOICE_INTERNAL] voice call failed ... error_type=RuntimeError")` with a traceback (`route:1591-1595`), plus a `[VOICE_INTERNAL] voice call closing socket` warning (`route:431-447`). `voice_call_ended` has category **`disconnected`** (`engine:1188-1195`). **The DB and the metrics disagree.** |
| B. `voice_ready` went out before the close arrived | `receive_json` → `WebSocketDisconnect(1000)` (uvicorn returns the peer's `close_code`: `websockets_impl.py:374-382`) → `socket_disconnected(code=1000)` → `end_call(reason="disconnected")` (`route:1549-1566`; `engine:1012-1033`; `engine:98-99` `_NORMAL_CLOSE_CODES={1000}`) | `status='ended'`, `end_reason='disconnected'` | Info log `[VOICE_DISCONNECT]` |
| C. Closed before the `voice_start` frame was read | `_receive_voice_handshake` → `WebSocketDisconnect` (`route:499-510`); `voice_session_id` is None, so nothing is allocated (`route:1554`) | none | Info only |
| D. Abnormal drop (no close frame) during admission | Same as A, because the send fails on the closed transport | failed/internal | Same as A |

**Is the reservation orphaned (BE-ROUTE-TRANSPORT-04)?** No for any client-initiated close. Outcome A
releases it immediately and B releases it through `end_call`. Orphans need the admission task itself to
die between `reserve_call` (`engine:805`) and `_calls[...] = runtime` (`engine:924`): a process crash,
SIGKILL, or a `CancelledError` (graceful-shutdown timeout, which is not configured). Those are left to
the 60 s maintenance sweep and the stale or max-duration expiry (`quota:549-580`), with the
wall-clock-charge problem described in BE-ROUTE-TRANSPORT-04.

**Wasted work and side effects on abandonment (FACT):** the steps marked in bold in §2.2 all happen for
a caller who has already left:

- a call-start token is burned. After 3 ready-timeouts in 10 minutes the user's next "Call" is refused
  with `RATE_LIMITED` (`route:830-840`);
- a Free activation is recorded;
- other live calls of the user are **superseded**, e.g. one in a second tab;
- a voice_session row is written;
- a TTS provider socket is opened and closed.

### 2.5 The same mechanism hits resumed and live sockets (FACT, generalised)

- **Resume.** `resume_call` cancels the pending grace end, rebinds `runtime.socket = websocket`, and then
  sends the snapshot with failures swallowed (`engine:983-1003`). If the resumed socket closes before
  that send, which is exactly the flaky-network case resume exists for, the route's next `receive_json`
  raises `RuntimeError` → `release_socket` → the call is **ended failed/internal with no new grace
  window** (`route:1588-1598`).
- **In the main loop:**
  - `voice_ping` → `engine.delivery.send_frame(websocket, voice_pong)` (`route:1496-1499`);
  - the in-loop `voice_resume` conflict frame (`route:1530-1535`);
  - `voice_segment_meta` (`route:1544-1548`).

  These call `delivery.send_frame` directly, which **raises** `VoiceDeliveryDisconnected`
  (a `ConnectionError`, not `WebSocketDisconnect`; `delivery:162,226-231`). That is caught by
  `except Exception` → `internal` → the call ends as failed with no grace. The window is the time between
  reading the ping and sending the pong, which includes a `touch_call` DB UPDATE (`route:1498`;
  `engine:1070-1078`). It is short (ms), but it repeats every 25 s.
- By contrast, a drop observed while the loop is **blocked in `receive_json`** correctly yields
  `WebSocketDisconnect(code)` → grace (`route:1549-1566`).

---

## 3. Q3: `voice_playback` rate limit

FACT (`engine:1267-1297`, constants at `engine:118-121`, runtime fields at `engine:610,630`):

- The state is **per call**: `runtime.playback_frames` is a `deque` of monotonic timestamps on
  `_VoiceCallRuntime`. It is not per turn and not per socket.
- The algorithm:
  1. drop timestamps 1.0 s or older;
  2. if 4 or more remain (`VOICE_PLAYBACK_MAX_FRAMES_PER_SECOND = 4`), **`return`**: silently ignored;
  3. otherwise append. Then look up the turn among `current_turn` and `last_turn` (`engine:1327-1330`)
     and keep the **max** `played_ms` per turn (`runtime.playback`, capped at 4 turns by
     `VOICE_PLAYBACK_TURNS_KEPT`). Finally wake the turn's flush-ahead speaker.
- The limit runs **before** the turn lookup. Frames for unknown or old turns use up the call's budget too.
- Frames from a stale socket are ignored (`engine:1277-1278`). Ended calls are ignored (`engine:1275-1276`).
- **Exceeding the limit is not fatal.** No error frame is sent, no log line is written and nothing is
  counted.
- What **is** fatal: a frame that fails the strict schema (`extra="forbid"`, `strict=True`, `StrictInt`,
  turn-id pattern; `route:233-240,216-217`) → `_parse_voice_frame` raises a fatal `conflict`
  (`route:320-330`), which ends the call (BE-ROUTE-TRANSPORT-06).
- The client sends `voice_playback` every `PLAYBACK_PROGRESS_MS = 500` (`ctrl:150,493-499`) with an
  integer `played_ms` (`vsock:228-232`, `wholeMs`). The interval is restarted per turn (`stopPlaybackProgress`
  first), so the steady rate is 2 frames per second, and at most about 3 can land in one second at a
  turn switch. **It never hits the limit today.**

INFERENCE: one call carries one playing turn at a time, so a per-call limit is the right granularity.
Dropping silently is safe because the server keeps the max. The only cost is that truncation and
flush-ahead resolution stay at the 500 ms report cadence (±500 ms error on "what was heard").

---

## 4. Q4: resend and idempotency interplay

### 4.1 Client (FACT)

- Idempotency key: `` `voice:${voice_session_id}:${seq}:${audio_sha256}` ``, sent as the `Idempotency-Key`
  header (`api:5437,5441`). There is no client timeout for this call: `timeoutMs` is unset and the abort
  timer only exists when it is set (`api:1072-1086`).
- `send()` (`ctrl:597-608`) works like this:
  - On a **`TypeError`** only, and not aborted: wait `UPLOAD_RETRY_DELAY_MS = 300` (`ctrl:154`), re-check
    the abort flag and `lifecycle === 'live'`, then resend **once** with the same body and the same
    `AbortController`.
  - Any other error (`ApiError` for 4xx/5xx, including 504) is thrown and goes to the
    `VOICE_UPLOAD_FAILED` notice (`ctrl:615-618`).
- A 401 has its own replay with a refreshed token (`api:1121-1140`). Auth fails before `request.form()`,
  so that path cannot produce a duplicate.
- Response handling: only `status === 'rejected'` is acted on (`ctrl:614`). Then the **`finally`**
  (`ctrl:619-628`) deletes the controller and, if no other upload is in flight, sets
  `serverTurnActiveRef=false`, `serverTurnIdRef=null` and `setTurnPhase('none')`. The comment there says
  "The POST resolves only after the server turn finished" (`ctrl:622-623`).

### 4.2 Server (FACT)

- The Idempotency-Key is **only validated**: it must equal `voice:{vsid}:{seq}:{sha}` or a 409 conflict
  is returned (`engine:3847-3852`, called at `engine:2040`). There is **no idempotency response store**:
  no replay of the original response and no "in progress" answer.
- Dedupe is the segment row. `find_segment(vsid, seq, role="user")`, and when the row exists,
  `_duplicate_segment_result` (`engine:2124-2126`). The concurrent-insert fallback catches
  `IntegrityError` on `uq_voice_segment_seq (voice_session_id, seq, role)` (`engine:2138-2145`;
  `BE/src/database/mysql/db.sql:537`).
- A different sha for the same seq gives a 409 `conflict` (`engine:3811-3813`).
- The duplicate answer is `status="duplicate"` and `reason=<stored row status>`, plus `turn_id`,
  `user_message_id` and `assistant_message_id` **only if already written to the row**
  (`engine:3811-3828`). The user row gets `turn_id` and the message ids only at the **end** of the turn
  (`engine:2747-2756`). During the turn the row reads `completed` (set after STT, `engine:2275-2281`),
  so a mid-turn duplicate is `{status: duplicate, reason: completed}` with **no turn_id**.
- **Serialisation.** The resend runs `accept_segment` up to `async with runtime.intake_lock`
  (`engine:2051`). The original holds that lock through validation, STT and STT billing
  (`engine:2051-2067`). The resend therefore blocks until the original's STT completes (about
  0.2-1.0 s typical; up to the 30 s STT timeout), then sees the row and returns `duplicate`
  (`engine:2062-2064`: "Rejected, duplicate or cancelled: never supersedes anything").
- No double billing. The duplicate returns before any billing. STT billing also has its own key
  `voice_call:{vsid}:stt:{seq}:{sha}` (`engine:2245-2251`).

### 4.3 Resulting sequence (FACT + INFERENCE where marked)

```
t0      POST#1 (seq N) parsed -> intake_lock -> STT ............ turn streams over WS ......... POST#1 returns (dropped)
t0+x    connection reset -> fetch TypeError (client)
t0+x+300ms POST#2 (same body, same key) -> pre-form gates -> blocks on intake_lock
t0+STT  POST#1 releases lock -> POST#2: find_segment -> duplicate{reason: completed}
        client: finally -> serverTurnActiveRef=false, serverTurnIdRef=null, phase 'none'
        (INFERENCE) if transcript_final arrived first, the "thinking" phase is cleared until the first
        audio chunk sets 'streaming' (ctrl:821-825); later turn frames still work (ctrl:844-857 accepts
        a turn_end when serverTurnIdRef is null).
```

The same applies when the original failed in intake (FACT). STT errors propagate out of
`_intake_segment` with no row update (`engine:2228-2233`; the `try` in `accept_segment` has only a
`finally`, `engine:2049-2110`), so the row stays `accepted`. A resend after a lost error response
returns `duplicate{reason: accepted}`. The client does not treat that as a failure (only `rejected` is
handled), so the utterance is **silently lost** (GAP-SP-07). This needs two coincidences, so it is
low severity.

---

## 5. Latency contributions on or near the critical path

| Stage | Estimate (ms) | Type | Evidence | Notes |
|---|---|---|---|---|
| Segment POST pre-form gate chain (auth cache hit + about 5 DB reads + feature check) | 5-25 warm | INFERENCE (DB RTT 1-5 ms as in be-route-transport) | `route:1130-1158` | On every segment. It lies between speech end and STT start. |
| Auth validation on cache miss (TTL 30 s) | +5-50 (LAN api.auth), up to the 2 s timeout | INFERENCE | `auth_adapter.py:349`; `main.py:740-747` | Hits any segment that comes more than 30 s after the last validation of that token, which is common in calls with long replies. |
| `accept_segment` pre-intake (`get_session`, sha256, `touch_call` UPDATE) | 3-10 | INFERENCE | `engine:2021-2050` | Serial DB work before STT. |
| Intake bookkeeping before STT (`find_segment`, `create_segment`, ack send, `update_segment(accepted)`) | 4-15 | INFERENCE | `engine:2124-2209` | 3 DB round trips plus 1 frame before the STT request starts. |
| Resend after `TypeError` | 300 constant + gate chain + wait on `intake_lock` (≤ original STT time) | FACT (constant) + INFERENCE | `ctrl:154,605`; `engine:2051` | Not on the happy path. It changes only the client state, not audio latency. |
| HTTP disconnect detection | none (never observed) | FACT | §1.3 | No early stop, so no saved compute. |
| POST lifetime | STT + LLM TTFT + (reply audio − up to 8 s flush-ahead lead) + persistence | FACT (gate constants) | `call_tts_elevenlabs.py:55-58,164-170`; `engine:2682-2766` | Not latency, but it sets the exposure to proxy timeouts and resends. |
| Call setup before `voice_ready` | serial chain of §2.2; the client gives up at 15,000 | FACT (timeout) | `route:926-1035`; `ctrl:127` | No early abort: if the client leaves, the chain still finishes. |
| `voice_playback` cadence (truncation precision) | 500 | FACT | `ctrl:150` | Heard-position error up to about 500 ms. The rate limit (4/s per call) never applies. |

---

## 6. Configuration and defaults touched by this note

| Setting | Default | Where |
|---|---|---|
| uvicorn http / ws protocol | auto → h11 / websockets-legacy | `uv/protocols/http/auto.py:6-14`; `uv/protocols/websockets/auto.py:7-20` |
| `timeout_keep_alive` | 5 s | `uv/config.py:214` |
| `ws_ping_interval` / `ws_ping_timeout` / `ws_max_queue` | 20 s / 20 s / 32 | `uv/config.py:189-191` |
| `timeout_graceful_shutdown` | None (waits forever; the only place tasks get cancelled) | `uv/config.py:216`; `uv/server.py:276-289` |
| `MAX_INFLIGHT_SEGMENTS_PER_CALL` | 3 (HTTP 429 beyond) | `engine:83` |
| `VOICE_END_CALL_DRAIN_SECONDS` | 2.0 s | `engine:87` |
| `VOICE_PLAYBACK_MAX_FRAMES_PER_SECOND` / `VOICE_PLAYBACK_TURNS_KEPT` | 4 per call / 4 | `engine:119,121` |
| `_NORMAL_CLOSE_CODES` | {1000} | `engine:98-99` |
| Segment form overhead allowance | 64 KiB | `route:80` |
| Auth `VALIDATION_CACHE_TTL` / `AUTH_API_TIMEOUT` | 30 s / 2.0 s | `BE/src/main.py:740-747` |
| Call-start token bucket | 3 per 600 s per account (in memory) | `BE/src/services/speech/token_buckets.py:73` |
| STT timeout | 30 s (max 120 s) | `BE/src/services/voice_orchestration/config.py:47-49` |
| `VOICE_READY_TIMEOUT_MS` | 15,000 | `ctrl:127` |
| `UPLOAD_RETRY_DELAY_MS` | 300 (one resend, `TypeError` only) | `ctrl:154,597-608` |
| `PLAYBACK_PROGRESS_MS` | 500 | `ctrl:150` |
| `QUEUED_UPLOAD_SPACING_MS` | 120 | `ctrl:152` |

---

## 7. Findings

### GAP-SEGMENT-POST-AND-CONTROL-PLANE-UNKNOWNS-01: A segment POST disconnect neither cancels nor reports the turn; the turn runs orphaned (medium, robustness)

- **FACT.** §1.3 and §1.4. The h11 and httptools `connection_lost` handlers do not cancel the task. The
  middlewares are pure ASGI. `request.is_disconnected` is unused in voice code. The turn task is the
  request task (`engine:2046`) and is cancelled only cooperatively (`engine:1958-1976`). A lost response
  is dropped by `send()` before the access log (`h11_impl.py:447-454`).
- **Impact.** No compute is saved on abort. The server has no signal that a turn's HTTP result was lost:
  no metric and no access-log line, so lost POSTs are invisible in request logs. The client's notion of
  "turn over" is wrong whenever the response is lost (GAP-SP-05). The turn's real effects (WS frames,
  history, billing) stay correct while the WS is up.
- **Recommendation.**
  - Short term: after `accept_segment` returns, `if await request.is_disconnected(): record("voice_segment_response_lost", ...)`.
  - Structural (aligns with BE-ROUTE-TRANSPORT-07): return 202 right after the segment row is created
    (or after STT), and run the turn as an engine-owned task tied to the **call** lifetime, not the
    HTTP request. Drive client state only from WS frames (`voice_turn_end`, `voice_cancelled`, a new
    `voice_segment_result`). A further option is to stream segment audio over the existing WS as binary
    frames, removing the HTTP leg; that is what LiveKit and Pipecat transports do. External practice:
    a transport disconnect propagates a cancel through the pipeline.

### GAP-SEGMENT-POST-AND-CONTROL-PLANE-UNKNOWNS-02: A pre-ready client close is recorded as `failed/internal` with an ERROR traceback; the DB and the metrics disagree (medium, observability)

- **FACT.** §2.3 and §2.4 outcome A. Reproduced in the probe (`ws-send-first`).
  - Stored: `status='failed'`, `end_reason='internal'`, `consumed_seconds=0` (`route:1588-1598`,
    `engine:1043-1068,1142-1149`).
  - Emitted: `voice_call_ended.category="disconnected"` (`engine:1188-1195`).
  - Logged: `[VOICE_INTERNAL] ... RuntimeError` with a stack trace.
- **Impact.**
  - Every user who gives up while connecting (including all 15 s ready timeouts) inflates the "internal
    failure" counts and pages on-call with tracebacks.
  - Real failures are harder to see. In real call data this looks like zero-second
    "disconnected"/"internal" calls.
  - Not a quota leak: the reservation is released immediately.
- **Recommendation.**
  - In the route loop, check `websocket.application_state`/`client_state` before `receive_json()`.
  - Or have `delivery.send_frame` failures on the call's current socket call
    `engine.socket_disconnected(code=1006)`.
  - Or catch `RuntimeError` and `VoiceDeliveryDisconnected` next to `WebSocketDisconnect` and route them
    to `socket_disconnected`.
  - Store a distinct reason for pre-ready abandonment (for example `client_abandoned`) with status
    `ended`.
  - Verify with the SQL in §9.

### GAP-SEGMENT-POST-AND-CONTROL-PLANE-UNKNOWNS-03: A send failure on a resumed or live socket ends the call immediately, bypassing resume grace (medium, robustness)

- **FACT.** §2.5.
  - `resume_call` swallows the snapshot send failure (`engine:983-1003`), so the next `receive_json` raises
    `RuntimeError` → `release_socket` → failed/internal.
  - `voice_ping`/pong, the in-loop `voice_resume` conflict frame and `voice_segment_meta` call
    `delivery.send_frame` directly. That raises `VoiceDeliveryDisconnected(ConnectionError)` →
    `except Exception` → the call ends (`route:1496-1499,1530-1535,1544-1548,1588-1598`;
    `delivery:162,226-231`).
- **Impact.** Resume exists for flaky networks, yet a reconnect whose socket blips again during
  `resume_call` (DB `get_session` + `touch_call` + snapshot) kills the call instead of re-arming the 20 s
  grace. The pong race kills a healthy-but-dropping call that could have resumed. Both appear as
  `failed/internal`, never as `disconnected`.
- **Recommendation.** Treat any send failure on the current socket as a socket drop: `runtime.socket=None`,
  then start or re-arm grace through `socket_disconnected(code=1006)`. Make the route loop exit through the
  same disconnect branch. Add a test that resumes and then closes before the snapshot.

### GAP-SEGMENT-POST-AND-CONTROL-PLANE-UNKNOWNS-04: An abandoned call start still runs the full admission with irreversible side effects (low, cost)

- **FACT.** The handler does not watch the socket during `_create_admitted_voice_session`
  (`route:1474-1493`). The steps that still run (§2.2):
  - burn a call-start token (3 per 10 min, `route:830-840`);
  - record a Free activation (`route:760-773`);
  - **supersede the user's other active calls** (`route:880-916`);
  - reserve quota and create the session (`engine:805-849`);
  - open the TTS provider socket (`engine:882-893`);
  - then tear everything down.
- **Impact.** A user who hits the 15 s ready timeout three times is rate-limited from calling. A start in
  a second tab that is abandoned still hangs up the first tab's live call. Provider sockets churn.
- **Recommendation.**
  - Run admission concurrently with a disconnect watcher, for example a task awaiting
    `websocket.receive()`. Cancel admission on disconnect. Make the `start_call` cleanup handle
    `BaseException` (`CancelledError`) as well as `Exception`, so a cancelled start cannot orphan a
    reservation.
  - At minimum, check for a disconnect before supersede and before `reserve_call`.
  - Refund the start token when the call never became ready.

### GAP-SEGMENT-POST-AND-CONTROL-PLANE-UNKNOWNS-05: A resend `duplicate` (or a 5xx/504) ends the client's turn state while the original turn is still running (low, ux)

- **FACT.** §4.1-§4.3.
  - The resend returns `duplicate{reason: completed}` with no `turn_id` once the original releases
    `intake_lock` (`engine:2051-2064,3811-3828`).
  - `finally` clears `serverTurnActiveRef`, `serverTurnIdRef` and the phase (`ctrl:619-628`).
  - Proxy 5xx/504 and a second `TypeError` show `VOICE_UPLOAD_FAILED` (`ctrl:615-618`), although the
    server turn finishes (§1.6).
- **Impact.**
  - The "thinking" indicator can vanish mid-turn (INFERENCE: it comes back at the first audio chunk).
  - A false error toast appears while the reply plays, on long replies behind a proxy read timeout
    (UNKNOWN whether one exists).
  - The client cannot tell "turn failed" from "response lost".
- **Recommendation.**
  - Client: do not settle turn state from the HTTP result. Settle it from `voice_turn_end` /
    `voice_cancelled` / segment acks. Treat `duplicate` as "in progress". Show `VOICE_UPLOAD_FAILED`
    only when no `voice_segment_ack` arrived for that seq.
  - Server: either return `{status: "in_progress", turn_id}` for a duplicate of a running seq (record
    `turn_id` on the user row at `voice_turn_start`), or decouple as in GAP-SP-01.

### GAP-SEGMENT-POST-AND-CONTROL-PLANE-UNKNOWNS-06: A pre-form abort raises an unhandled `ClientDisconnect` (an ERROR traceback per abort) (low, observability)

- **FACT.** `request.form()` → `ClientDisconnect` (`st/requests.py:234-236`). The route catches only
  `VoiceOrchestrationError` (`route:1222`). No exception handler is registered for it
  (`main.py:1455,1485`). uvicorn logs `Exception in ASGI application` (probe).
- **Impact.** Log noise and false error-rate signals from benign hang-ups and blips. Aborted segment
  uploads are never counted as such.
- **Recommendation.** Catch `ClientDisconnect` in `upload_voice_segment`. Record a
  `voice_segment_upload_aborted` event (stage `pre_form`) and return quietly; the response is unsendable
  anyway.

### GAP-SEGMENT-POST-AND-CONTROL-PLANE-UNKNOWNS-07: An intake failure leaves the segment row `accepted`, so a later resend is a silent `duplicate` (low, correctness)

- **FACT.**
  - STT errors propagate out of `_intake_segment` with no row update (`engine:2228-2233`).
  - `accept_segment` has only a `finally` (`engine:2049-2110`).
  - The duplicate path returns `duplicate{reason: accepted}` (`engine:2124-2126,3811-3828`).
  - The client ignores any status other than `rejected` (`ctrl:614`).
- **Impact.** It needs the original's error response to be lost (a `TypeError`) before the resend.
  Rare, but then the user's utterance vanishes with no notice and no turn.
- **Recommendation.**
  - Mark the row `failed` with the error category on an intake exception, and let a resend of a
    `failed` or stale-`accepted` seq be processed again.
  - Or return `duplicate` with `reason=failed` and have the client surface it.

### GAP-SEGMENT-POST-AND-CONTROL-PLANE-UNKNOWNS-08: Turns that outlive `end_call`'s 2 s drain keep billing credits after quota release (low, cost)

- **FACT.**
  - `end_call` cancels cooperatively and waits at most 2 s (`engine:1129-1133,1883-1894`).
  - It then releases quota using the billing snapshot (`engine:1135-1141`) and ends the session.
  - A turn still in STT later calls `_record_billable_audio` with no cancel or ending check
    (`engine:2245-2251`). That charges credits through `record_call_usage` (`engine:3404-3410`).
  - `_persist_billing_metadata` then updates 0 rows on an ended session
    (`models.py:7364-7371`, `status IN ('starting','active','ending')`).
- **Impact.** The credit ledger can exceed `voice_session.consumed_seconds` and `metadata.billing` for
  calls ended mid-STT. That is a reconciliation anomaly, small in amount. It requires an STT or DB stall
  of more than 2 s after hang-up.
- **Recommendation.** Make the drain wait for intake to finish (STT is bounded), or take the quota
  snapshot after all turns have finished. Or skip credit charges for turns cancelled with `end_call`
  before their transcript was used, while still logging provider cost for COGS.

### GAP-SEGMENT-POST-AND-CONTROL-PLANE-UNKNOWNS-09: The `voice_playback` limit is per call and silent (info, observability)

- **FACT.** §3: a 4/s sliding window per call (`engine:119,1281-1287,630`). Excess frames are dropped
  silently before the turn lookup. Not fatal. The client sends 2/s (`ctrl:150`).
- **Impact.** None today. A future client that reports faster, or a bug, would degrade truncation
  silently.
- **Recommendation.** Count dropped reports in observability. Keep the per-call granularity.

---

## 8. Strengths

1. **The body is read after every admission gate** (`route:1138-1159`): no microphone bytes are parsed for
   unauthorized or disabled traffic. A side effect is that a pre-form abort cleanly prevents the turn.
2. **Pure-ASGI middlewares** (`main.py:1463-1479`) keep context variables in the endpoint task and avoid
   `BaseHTTPMiddleware`'s cancellation and streaming pitfalls.
3. **Layered idempotency for segments:**
   - a deterministic key bound to vsid, seq and sha, checked against the metadata (`engine:3847-3852`);
   - a DB unique key with an `IntegrityError` fallback (`engine:2138-2145`; `db.sql:537`);
   - a sha mismatch is a 409 (`engine:3811-3813`);
   - duplicates never supersede (`engine:2062-2064`);
   - STT billing has its own idempotency key (`engine:2245-2251`).
4. **Start cleanup releases the reservation on every `Exception` path** (`_release_failed_start`,
   `engine:806-817,848,879,885`), and pre-ready aborts do not leak quota (§2.4).
5. **Delivery is best-effort inside the engine** (`engine:1946-1956`): a dead socket never aborts turn
   logic or billing bookkeeping.
6. **The playback limiter cannot break a call**: it is non-fatal and keeps a monotonic max per turn with
   bounded memory (`engine:1267-1297`).
7. **The client resend is disciplined**: one attempt, `TypeError` only, abort-aware, with the same key
   (`ctrl:597-608`). Teardown aborts uploads and also ends the call over the WS and over HTTP keepalive
   (`ctrl:1093-1120`).

---

## 9. Open questions (UNKNOWN) and how to settle them

1. **Production front proxy.** Does it buffer request bodies, what is the read timeout, and does it
   propagate client aborts upstream (nginx `proxy_ignore_client_abort`)? This sets whether window (a)
   exists at the BFF and whether 504s hit long turns. Nothing in `docker-compose.yml:31-60` shows a
   proxy.
2. **Real-data signature of GAP-SP-02/03.** Count pre-ready abandonments and no-grace ends:

   ```sql
   -- zero-second "internal" failures without any user segment = pre-ready abandonment (GAP-SP-02)
   SELECT DATE(vs.started_at) AS d, COUNT(*) AS n
   FROM voice_session vs
   WHERE vs.status = 'failed' AND vs.end_reason = 'internal' AND vs.consumed_seconds = 0
     AND NOT EXISTS (SELECT 1 FROM voice_transcript_segment s WHERE s.voice_session_id = vs.voice_session_id)
   GROUP BY d ORDER BY d;
   -- mid-call "internal" failures (candidates for GAP-SP-03): same filter but EXISTS segments
   ```

   Cross-check against log lines `[VOICE_INTERNAL] voice call failed ... error_type=RuntimeError` and
   `error_type=VoiceDeliveryDisconnected`.
3. **How often resends happen and how often responses are lost.** The client has no metric for
   `TypeError` resends and the server has none for lost responses (GAP-SP-01). Add both before deciding
   on the 202 redesign.
4. **Admission duration p95** compared with the 15 s ready timeout. This is the main driver of GAP-SP-02
   and -04. The serial chain is in §2.2.
5. **Graceful shutdown in production.** Is `timeout_graceful_shutdown` or a SIGKILL deadline used? A
   cancelled `start_call` between reserve and register orphans the reservation, because
   `except Exception` does not catch `CancelledError`.
6. Does a browser's automatic retry of a POST on a stale keep-alive socket (uvicorn closes idle
   connections after 5 s) ever reach the server twice? The DB unique key makes that safe either way.

---

## Verification (adversarial)

Second pass on 2026-10-20. Every cited line in `BE` (HEAD `9d75cf4`), its `.venv` (uvicorn 0.35.0, starlette 0.47.2,
fastapi 0.116.1, websockets 16.0, no httptools) and `FE` was re-opened, and the §1.4 probe was re-run with
`BE/.venv/bin/python -I`. The output matched §1.4 line for line. No source file was changed. Scope: GAP-SP-01 to -03.

| id | verdict | corrected severity | evidence / note |
|---|---|---|---|
| GAP-SEGMENT-POST-AND-CONTROL-PLANE-UNKNOWNS-01 | adjusted | low | **Mechanism confirmed.** `uv/protocols/http/h11_impl.py:103-127`: `connection_lost` only sets `cycle.disconnected` and the event, with no task cancel. The task is a plain `create_task` (`:250-252`). `send()` returns at `:453-454`, before the access log at `:472`. httptools behaves the same (`:113-130`). All four middlewares are pure ASGI classes (`main.py:1463-1479`, `geo.py:336`, `moderation_transport.py:202`, `provider_request_context.py:163`). `is_disconnected` appears only at `feature_flags.py:71`. `engine.py:2046` makes the request task the turn task. No `turn.task.cancel()` exists (grep). `_cancel_turn` is cooperative (`engine.py:1958-1976`). The probe's `/late-abort` completed with `is_disconnected=True`. **Severity lowered.** The only deliberate client abort is `abortUploads` inside `stopLocalResources` (`ctrl:478-483,501-505`). That always runs with WS `voice_end` and/or HTTP `voice-end` (`ctrl:1093-1120,1202-1212`), which reach `end_call` and cancel the turn (`engine.py:1129-1133`), so compute is saved through that channel. In the blip case, finishing the turn is the desired behaviour, because the reply reaches the user over the WS. What remains is a missing "response lost" signal (observability) plus the client-state effect, which GAP-SP-05 already counts. Turn loss while the WS is also down belongs to BE-ENGINE-TURNTAKING-08. |
| GAP-SEGMENT-POST-AND-CONTROL-PLANE-UNKNOWNS-02 | confirmed | medium | **Client.** `buildVoiceStartFrame` has no `voice_session_id` (`ctrl:1255-1273`). `vsock.end()` returns false without one (`voiceSocket.ts:234-236`). `close(1000)` is the default (`:255`). The ready timeout calls `stopLocalResources({closeSocket:true})` (`ctrl:1082-1088`). **Server.** The route does not read the socket during `_create_admitted_voice_session` (`route:1474-1493`). `start_call` sends `voice_ready` through `_send` → `_send_to`, which swallows `VoiceDeliveryDisconnected` (`engine.py:926-929,1946-1953`). The code comment there expects "the route's disconnect path" to handle it. Starlette `send` sets `application_state=DISCONNECTED` on `OSError` (`st/websockets.py:84-89`), and uvicorn raises `ClientDisconnected(OSError)` on `ConnectionClosed` (`websockets_impl.py:343-344`). `receive_json` then raises `RuntimeError` (`st/websockets.py:131-134`), not `WebSocketDisconnect`. That lands in `except Exception` (`route:1588-1598`): `logger.exception("[VOICE_INTERNAL]...")`, then `release_socket(reason="disconnected", failure_category="internal")` (`route:1617-1622`). The socket check passes because `runtime.socket` still points at the dead socket. `end_call(outcome="failed", stored_reason="internal")` follows (`engine.py:1059-1068,1142-1149`), while the metric records `category=reason="disconnected"` (`engine.py:1188-1195`). The probe `ws-send-first` reproduced the `RuntimeError`. Quota is released by `end_call`, so there is no orphan. No test asserts otherwise. |
| GAP-SEGMENT-POST-AND-CONTROL-PLANE-UNKNOWNS-03 | adjusted | low | **Mechanism confirmed.** `resume_call` cancels `pending_end`, rebinds `runtime.socket` and sends the snapshot via the swallowing `_send` (`engine.py:983-1003`). A failed send leaves `application_state=DISCONNECTED`, so the next `receive_json` raises `RuntimeError`, leading to `release_socket` and failed/internal, with no grace re-armed. The pong, the in-loop resume conflict frame and `voice_segment_meta` call `delivery.send_frame` directly (`route:1496-1499,1530-1535,1544-1548`). That function re-raises every failure as `VoiceDeliveryDisconnected(ConnectionError)` (`delivery.py:162,218-231`), which the generic `except Exception` catches. The `voice_ping` branch awaits a `touch_call` DB update before the pong. Heartbeat is 25 s (`voiceSocket.ts:20`). **Details widened.** (a) The resume window is the whole resume handshake: `_resume_admitted_voice_session` does about 4 DB reads before `resume_call` (`route:1038-1081`), and the rebind happens however early the new socket died. (b) Any swallowed engine send (`barge_in`, `report_playback`, turn frames) that fails while the loop is between `receive_json` calls takes the same `RuntimeError` path. **Severity lowered.** Each window lasts milliseconds to tens of milliseconds, and the bug needs a close that the server has already *detected* (a close frame or FIN/RST) inside that window. An abrupt network loss usually produces neither in time: the send lands in the kernel buffer and the drop surfaces later as `WebSocketDisconnect(1006)` → grace (`route:1549-1566`). Realistic triggers are rare double blips or a user End or unload during reconnect, where the call would end anyway. So the main cost is mislabelled `failed/internal` ends plus ERROR tracebacks, and only rarely a lost resumable call. |
