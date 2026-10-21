# Audit evidence: runtime topology and measured network / DB round trips (gap closure)

Finding prefix: `GAP-TOPOLOGY-RTT-MEASUREMENTS-`

Scope: turn the INFERENCE-level latency claims in the backend notes (DB tax per turn, connection setup, process topology) into measured numbers. This note measures from the dev host and reads code and deployment files. It changes no source file.

Path aliases used below:

- `API` = `/home/andres/PycharmProjects/magic-worlds-api`
- `MLLM` = `/home/andres/PycharmProjects/api.magic_llm`
- `AUTH` = `/home/andres/PycharmProjects/api.auth`
- `LLM` = `/home/andres/PycharmProjects/magic-llm`
- `MAC` = `/home/andres/PycharmProjects/magic_auth_client/src/magic_auth_client`
- `UV35` = `API/.venv/lib/python3.13/site-packages/uvicorn` (uvicorn 0.35.0, BFF)
- `UV47` = `MLLM/.venv/lib/python3.14/site-packages/uvicorn` (uvicorn 0.47.0, api.magic_llm dev venv)

Labels: **FACT** (seen in code, config or a process listing), **MEASURED** (a number produced in this audit, with method), **INFERENCE** (derived from facts and measurements), **UNKNOWN**.

---

## 1. Summary

1. **The LAN DB round trip is small, and it is not the main DB cost.** MEASURED from the dev host (192.168.1.13) to MySQL 8.1.0 on 192.168.1.90 over aiomysql: one `SELECT 1` takes 0.24 ms p50 (0.31 ms p95). An `execute_query`-shaped unit (statement plus `COMMIT`) takes 0.48 ms p50. The backend notes assumed 0.3-1.5 ms per round trip; the real figure is at the low end.
2. **The per-turn DB tax comes from statement count and fsync'd write commits.** The server-side `performance_schema` digest histograms (about 9 days of real dev traffic) show the following. Read-only commits take about 0.09 ms. Write commits take p50 ≤2.3 ms, p90 ≤19 ms and p99 ≤26 ms in `magic_worlds`, and p50 ≤3.5 ms, p90 ≤11 ms and p99 ≤60 ms in `magic_messages` (the api.magic_llm store). Both sit on `innodb_flush_log_at_trx_commit=1` and `sync_binlog=1`.
   - Recomputed BFF DB tax from segment receipt to the LLM POST: about **60-80 ms p50 for a root user, 75-100 ms for a normal user, and 100-140 ms p90** (INFERENCE from measured unit costs).
   - Only about 25 ms of that is network round trips. The rest is server execution and 8 write commits.
3. **api.magic_llm writes 32 durable commits per voice turn (FACT, 19 of 19 recent voice turns).** Each turn also writes 65 event rows and rewrites a 48-123 KB JSON checkpoint on every commit, with `binlog_row_image=FULL`. Using the measured per-statement server times, about 16 commits before the provider call cost **about 250-420 ms** (INFERENCE). This is the largest controllable DB cost, and it quantifies BE-LLM-02.
4. **Cold provider connections cost about +55-100 ms p50 each, with a heavy tail.** MEASURED Python cold-versus-pooled penalty: Groq +80 ms, ElevenLabs +54 ms, Fish +100 ms, OpenRouter +79 ms (httpx) and +86 ms (aiohttp new session). In an 80-sample run, 4-20% of cold TCP+TLS setups took more than 500 ms, with about 1.1-1.5 s outliers (1 s initial-RTO retransmits).
   - All four provider edges kept an idle HTTP/1.1 connection open for **at least 125 s**. The 5 s client keep-alive is therefore the only reason connections are cold.
   - Recorded gaps between user utterances in real dev calls were 10-31 s (FACT from DB timestamps). So **every Groq STT request after a call's first one opens a new TLS connection** under the current `keepalive_expiry=5 s`, and OpenRouter is always cold (two new sessions per turn).
5. **New measured bug: `uvicorn --reload` (and `--workers`) disables TCP_NODELAY.** Every reused keep-alive request then pays **about 41 ms** of Nagle plus delayed-ACK stall.
   - MEASURED A/B on the same code: 0.07 ms versus 41.5 ms per reused request.
   - All three dev services run with `--reload`. So dev measurements overstate production for every pooled hop: api.magic_llm → api.auth (second delegated validation), the BFF catalog's second GET, BFF → api.auth, and the moderation client.
   - Production launchers use uvicorn's standard path, which is not affected. Adding `--workers N` later would reintroduce the stall.
6. **Topology (FACT).** In dev, each of BFF :8010, api.magic_llm :7000 and api.auth :5000 (127.0.0.1 only) runs as one uvicorn `--reload` supervisor with a single worker. They run on 192.168.1.13, and MySQL, Redis and Qdrant are on 192.168.1.90.
   - The browser talks to the BFF directly over plain HTTP/1.1 and WebSocket on :8010. There is no proxy and no TLS.
   - In the repos, the production BFF is `python -m src.serve`, which calls `uvicorn.run` with no workers, h11 + asyncio, the websockets WS implementation, 5 s keep-alive and no graceful-shutdown timeout.
   - **No reverse proxy, TLS terminator or HTTP/2 is defined in any repo.**
7. **Normal (non-root) users pay hidden SQL that dev never exercises.** `require_features("calls")` installs a per-request SQL validator that adds 2 `FOR SHARE` reads to **every** transaction of the segment request. The whole voice turn runs inside that request. The dependency also performs a second shadow-user upsert.
   - MEASURED +0.47 ms per transaction, which comes to about +12-15 ms per turn.
   - All 8 dev voice sessions in the last 7 days were made by a `root` user, which bypasses this.

---

## 2. Method and safety

- **Host.** Dev workstation 192.168.1.13, `eno1` at 2.5 Gb/s. Load at measurement time was about 6.6 Mbit/s rx and 2.6 Mbit/s tx (2 s sample from `/proc/net/dev`). WAN ping to 1.1.1.1 averaged 37.9 ms (n=10). Measurements ran on 2026-10-20 at about 23:20-23:55 DB time.
- **DB.** Read-only use, through scripts that load `MYSQL_*` from `API/.env` and never print credentials. Statements used:
  - `SELECT 1`, `SELECT @@…`, and `COMMIT`/`ROLLBACK` of read-only transactions;
  - `performance_schema` (digest summaries and histograms, file I/O summaries, global status and variables);
  - `information_schema` column listings;
  - metadata-only aggregates over `tb_run`, `tb_execution_event`, `voice_transcript_segment`, `voice_session` and `tb_user`: counts, timestamps, `native_revision`, payload byte sizes and `user_type` counts. No transcript text or payload content was read.
- **Providers.** No credentials were sent. Requests went to endpoints that answer 401/404 (or a public 200), for timing only. WebSocket probes opened the provider endpoints without keys.
- **Local services.** Unauthenticated `/health`, `/system/ping`, unknown paths, and `GET /auth/validate` without a token (401).
- **A/B harness.** Throwaway uvicorn apps on ports 18081-18088, run from the BFF venv and killed afterwards.
- Scripts were kept in the session scratchpad: `mysql_rtt.py`, `aiomysql_rtt.py`, `ps_digest.py`, `commit_split.py`, `tcp_rtt.py`, `curl_probe.sh`, `py_tls.py`, `tcp_tail.py`, `idle_probe.py`, `ws_handshake.py`, `nodelay_ab.py`, `ws_ab.py`, `sse_ab.py`, `reuse_probe.py`, `client_ctor.py`. Their essential logic is restated in §12, so the note stands alone.
- **Caveat.** WAN numbers describe this dev network at this hour. The tails varied a lot between runs: ElevenLabs TCP p50 was 29.7 ms in one run and 13.7 ms in another. Production network numbers are UNKNOWN.

---

## 3. Runtime topology

### 3.1 Dev processes (FACT, `ps`, `ss`, `/proc/<pid>/cwd`, `/proc/<pid>/environ`)

| Service | Supervisor PID (cmd) | Worker PID (age) | Listen | cwd / module |
|---|---|---|---|---|
| BFF magic-worlds-api | 45106 `python -m uvicorn main:app --reload --port 8010 --host 0.0.0.0` | 1603372 (started 5,254 s ago; supervisor 100,609 s, so **a reload restarted it about 1.5 h earlier**) | `0.0.0.0:8010` | cwd `API`; `PYTHONPATH` includes `API/src`, so `main:app` is `src/main.py` imported as top-level `main` (Docker imports `src.main:app`) |
| api.magic_llm | 44992 `python -m uvicorn main:app --reload --port 7000 --host 0.0.0.0` | 45026 | `0.0.0.0:7000` | cwd `MLLM` |
| api.auth | 44881 `python -m uvicorn main:app --reload --port 5000` | 44914 | **`127.0.0.1:5000` only** | cwd `AUTH` |

Each supervisor also has a `multiprocessing.resource_tracker` child. There is exactly one serving worker per service, so process-local call state is consistent in dev (FACT).

Sockets of the workers at measurement time (FACT, `ss -tanp`):

- **BFF (1603372):**
  - 2 MySQL connections to 192.168.1.90:3306 and 2 Redis connections to 192.168.1.90:6379;
  - 1 ESTAB and 2 **CLOSE-WAIT** connections to 34.8.184.191:443 (`api.elevenlabs.io`). CLOSE-WAIT means the peer closed and the BFF has not closed its end yet. INFERENCE: idle pooled or WS sockets that are not reaped until the next use.
- **api.magic_llm (45026):**
  - **0 MySQL connections**, although its async pool is created at startup with `minsize=2` (`MLLM/src/main.py:242`, `MLLM/src/db/connection.py:202-241`). The cause is UNKNOWN; possibly closed after errors or idle, see §6.3.
  - 1 CLOSE-WAIT connection to Qdrant 192.168.1.90:6333.
- **api.auth (44914):** 21-23 MySQL connections (the count changed between two listings) and 2 Redis connections to 192.168.1.90.

The dev DB server is shared with many other apps (FACT, digest schemas): `colwrite_app`, `magic_auth`, `magic_messages`, `findit_app`, `booru_spyder`, `magic_llm`, `magic_worlds`, test schemas and others. A background `migrate_images.py` job was also talking to Qdrant on .90.

The BFF connects to the DB as `MYSQL_USER=root` (`API/.env:14`), and so does api.magic_llm (`DB_USER=root`, `MLLM/.env:9`). FACT for dev; least-privilege concern, production UNKNOWN.

### 3.2 Repo-defined production launch (FACT)

| Service | Launcher | Effective uvicorn config |
|---|---|---|
| BFF | `CMD ["python", "-m", "src.serve"]` (`API/Dockerfile:87`) → `uvicorn.run("src.main:app", host="0.0.0.0", port=APP_PORT)` (`API/src/serve.py:28-33`) | Single process, no `workers`, no `reload`, so **the standard host/port path** (`UV35/main.py:580` → `server.py:161-169`). http `auto` gives **h11**, because `httptools` is not installed (requirements pin plain `uvicorn==0.35.0`; `UV35/protocols/http/auto.py:5-15`). Loop is asyncio (no uvloop). WS uses `websockets` 16 (`UV35/protocols/websockets/auto.py`). `timeout_keep_alive=5`, `ws_ping_interval=20`, `ws_ping_timeout=20`, `ws_max_size=16 MiB`, `backlog=2048`, `limit_concurrency=None`, `timeout_graceful_shutdown=None` (`UV35/config.py:188-216`) |
| api.magic_llm | `CMD ["sh","-c","exec uvicorn src.main:app --host 0.0.0.0 --port ${APP_PORT:-8000}"]` (`MLLM/Dockerfile:123`); comment: "add --forwarded-allow-ips=<proxy ip> when running behind a reverse proxy" (`:121-122`) | Single process, standard path, h11 (dev venv also has no `httptools`), asyncio |
| api.auth | `uvicorn src.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips …` plus sibling worker processes (`AUTH/scripts/docker-entrypoint.sh:61`) | Single API process, standard path |

Compose and proxy (FACT):

- `API/docker-compose.yml` defines only `app` (ports `${APP_PORT}:${APP_PORT}`, `:32-35`) and `mysql:8` (`:275-291`). There is **no proxy, no TLS and no HTTP/2**.
- The `app` service takes `MYSQL_HOST=${MYSQL_HOST}` from `./.env` (`:246`), and the dev `.env` points at `192.168.1.90` (`API/.env:12`). INFERENCE: compose would use the LAN DB, not its own `mysql` service, unless `.env` is changed.
- `FORWARDED_ALLOW_IPS` defaults to `127.0.0.1` (`:49`), which assumes a local proxy that the repo does not define.
- `MLLM/docker-compose.test.yml:1-8` is marked deprecated and only runs MySQL and Redis for debugging.
- No `nginx*`, `Caddyfile`, `traefik*`, `Procfile` or `fly.toml` exists in the four repos (`find` on the API, MLLM, AUTH and SPA repos). The SPA has `public/_headers`, which suggests static hosting with a headers file.
- The dev SPA calls `VITE_API_BASE_URL=http://{hostname}:8010` (`magic-worlds/.env:2`), and `vite.config.ts` defines no proxy. So browser → BFF is direct HTTP/1.1 and WS with no TLS in dev.

HTTP/2 (FACT): uvicorn does not serve h2. No client uses `http2=True` (grep over `API/src`, `MLLM/src`, `LLM/magic_llm`, `MAC`). The BFF venv does not have `h2` installed, so httpx HTTP/2 is not available without adding a dependency. The MLLM venv does have `h2 4.3.0`. All four providers negotiate **h2 and TLS 1.3** with curl and Python (MEASURED).

Shutdown behaviour (FACT):

- uvicorn's shutdown fails every open WebSocket with **1012** (`UV35/protocols/websockets/websockets_impl.py:148-151`).
- In-flight HTTP responses complete. A voice turn is an in-flight segment POST.
- With `timeout_graceful_shutdown=None`, shutdown waits without limit (`UV35/server.py:263-293`).
- INFERENCE: every dev `--reload` and every production deploy drops all live calls. Call state is process-local, so a resume to the new process ends the call (be-route-transport, BE-ROUTE-TRANSPORT-02).

### 3.3 Dev/prod drift (FACT)

| Item | Dev | Repo pin or Docker |
|---|---|---|
| BFF Python | 3.13.16 (`/usr/lib/python3.13`) | `python:3.12-slim` (`API/Dockerfile:31,49`) |
| api.magic_llm Python | 3.14 | 3.12 (`MLLM/Dockerfile:33`) |
| api.magic_llm uvicorn / starlette / fastapi | 0.47.0 / 1.0.1 / 0.136.1 (venv metadata) | 0.53.0 / 1.6.0 / 0.141.1 (`MLLM/requirements.txt`) |
| Module path | `main:app` (PYTHONPATH includes `src`) | `src.main:app` |
| HTTP impl | h11 (no httptools in any venv) | h11 |

Correction to `be-llm.md:366`: it cites `httptools_impl.py:227` for ASGI `spec_version "2.3"`, but `httptools` is not installed, so h11 is used. h11 reports the same `"spec_version": "2.3"` (`UV47/protocols/http/h11_impl.py:206`). Starlette 1.0.1 (the version actually installed) still takes the `listen_for_disconnect` branch for spec < 2.4 (`MLLM/.venv/.../starlette/responses.py:265-281`). The conclusion of be-llm §10 holds.

---

## 4. Measurements: MySQL (192.168.1.90:3306)

### 4.1 Client-observed (MEASURED)

ICMP: min/avg/max 0.122 / 0.174 / 0.312 ms (n=20, `ping -i 0.2`).

pymysql 1.1.1 (sync), single connection:

| Probe | n | p50 | p95 | max (ms) |
|---|---|---|---|---|
| TCP connect only | 10 | 0.179 | 1.039 | 1.039 |
| TCP + server greeting (no credentials) | 10 | 0.794 | 1.724 | 1.724 |
| Full connect (TCP + handshake + auth + db) | 10 | 1.818 | 2.288 | 2.288 |
| `SELECT 1` (one round trip) | 50 | 0.238 | 0.366 | 0.415 |
| `COMMIT` of a read-only transaction | 50 | 0.226 | 0.278 | 0.297 |
| `SELECT 1` + `COMMIT` | 50 | 0.472 | 0.615 | 0.690 |
| `SELECT @@version, @@max_allowed_packet, @@transaction_isolation` | 50 | 0.296 | 0.456 | 0.509 |

aiomysql 0.2.0 (the BFF driver) on asyncio, two independent runs:

| Probe (shape) | p50 | p95 | max (ms) |
|---|---|---|---|
| `create_pool(minsize=1)` | 1.75-1.96 (one-off) | | |
| `execute_query` shape: `acquire` → DictCursor → execute → fetch → `commit` → release | 0.469-0.492 | 0.597-0.620 | 0.717-0.740 |
| Bare `SELECT 1` on a held connection | 0.237-0.241 | 0.292-0.314 | 0.352-0.444 |
| Feature-flag validator shape (3 SELECTs + `COMMIT`) | 0.940-0.988 | 1.062-1.207 | 1.106-1.296 |
| New connection (`aiomysql.connect`) | 1.31-1.38 | 1.76-2.01 | 1.76-2.01 |

**Unit costs used below** (MEASURED unless marked):

| Symbol | Meaning | Value |
|---|---|---|
| R | One SQL statement round trip (network + driver), trivial statement | 0.24 ms p50, 0.31 ms p95 |
| U_read | `execute_query` read: statement + COMMIT, trivial | 0.48 ms p50, 0.62 ms p95; with real point reads (server 0.2-0.9 ms, §4.2) **≈0.7-1.4 ms** (INFERENCE) |
| U_write | DML + COMMIT with a durable fsync | 2R + DML server (0.2-1.6) + write-commit server (2.3 p50 / 19 p90) ≈ **3-4.5 ms p50, about 13-21 ms p90** (INFERENCE from §4.2) |
| U_ff | Extra per transaction for non-root users (2 `FOR SHARE` reads) | **+0.47 ms p50** (0.94-0.99 vs 0.47-0.49) |
| U_conn | New MySQL connection | 1.3-1.8 ms |

### 4.2 Server-side, from `performance_schema` (MEASURED, digests first seen 2026-10-11, server uptime 830,291 s ≈ 9.6 days)

Server configuration (FACT, `performance_schema.global_variables` and `global_status`):

- **Version and durability:** MySQL 8.1.0, `REPEATABLE-READ`, `innodb_flush_log_at_trx_commit=1`, `sync_binlog=1`, `log_bin=ON`, `binlog_format=ROW`, **`binlog_row_image=FULL`**, `binlog_row_value_options=''` (no partial JSON), `innodb_flush_method=fsync`, `innodb_doublewrite=ON`.
- **Memory:** **`innodb_buffer_pool_size=128 MiB`** (the default). The buffer-pool miss ratio is 56.2 M / 1.91 G ≈ 2.9%.
- **Connections:** **`max_connections=151`, `Max_used_connections=152`, `Connection_errors_max_connections=24`** (the server has refused connections). `Threads_connected` was 131 at measurement.
- **Connection churn:** `Connections=3,141,743` (about 3.8 new connections per second on average), `Threads_created=16,152` with `thread_cache_size=9`.
- **Redo:** `innodb_redo_log_capacity=100 MiB`.
- **fsync cost** (`file_summary_by_instance`, `AVG_TIMER_MISC`, which is dominated by fsync): redo files 1.5-1.95 ms, binlog files 1.5-1.94 ms.

COMMIT latency histograms (server time, `events_statements_histogram_by_digest`):

| Schema | COMMITs | All p50 | All p90 | All p99 | Write commits (≥0.5 ms bucket) | Write p50 | Write p90 | Write p99 |
|---|---|---|---|---|---|---|---|---|
| `magic_worlds` (BFF) | 565,932 | ≤0.091 | ≤1.202 | ≤19.06 | 62,641 (11.1%) | **≤2.29** | **≤19.06** | **≤26.3** |
| `magic_messages` (api.magic_llm native store) | 49,826 | ≤0.087 | ≤4.57 | ≤28.8 | 14,375 (28.9%) | **≤3.47** | **≤10.97** | **≤60.3** |

The distribution is bimodal. Read-only commits cluster at 0.06-0.17 ms. Write commits cluster at about 1.1-5.5 ms, with 2.5-3% above 10 ms and a 100-200 ms maximum.

Hot statements on the voice and LLM path (server time, ms):

| Statement (normalized digest) | n | avg | p50 | p90/p95 | p99 | max |
|---|---|---|---|---|---|---|
| `INSERT INTO tb_user … ON DUPLICATE KEY UPDATE` (shadow-user projection, every authenticated request) | 55,667 | 1.61 | ≤0.72 | p90 ≤2.0 | ≤25.1 | **1,439.5** |
| `SELECT … FROM tb_user WHERE …` (projection read-back) | 55,668 | 0.30 | | p95 0.44 | 0.58 | 8.0 |
| `SELECT voice_session_id, client_call_id, … FROM voice_session` (`get_owned_session`, 20.4 rows examined average) | 16,965 | 0.87 | | p95 1.20 | 1.82 | 21.8 |
| `UPDATE magic_messages.tb_execution_event SET event_payload = JSON_OBJECT(…)` (**native checkpoint rewrite**) | 13,275 | **6.29** | ≤2.40 | p90 ≤14.45 | ≤34.7 | 530.6 |
| `INSERT INTO magic_messages.tb_execution_event` | 26,991 | 1.04 | | p95 1.66 | 7.24 | 630.6 |
| `SELECT event_payload FROM tb_execution_event WHERE native_run_id=? AND id_event=?` | 26,757 | 0.84 | | p95 2.75 | 5.75 | 14.0 |
| `SELECT event_type, native_payload_bytes, … FROM tb_execution_event` | 26,757 | 0.75 | | p95 2.19 | 4.79 | 12.5 |
| `UPDATE tb_run SET status=?, native_revision=?, …` | 13,540 | 0.45 | | p95 0.63 | 0.83 | 5.2 |
| `UPDATE tb_interaction SET conversation_id=? WHERE run_id=?` | 34,835 | 0.28 | | p95 0.44 | 0.58 | 38.8 |
| `SELECT credits_used FROM membership_usage_day … FOR UPDATE` (debit) | 12,083 | 0.23 | | p95 0.32 | 0.44 | 1.0 |
| `BEGIN` (magic_messages) | 49,542 | 0.08 | | | | 2.4 |

### 4.3 api.magic_llm native recording per voice turn (FACT, metadata-only queries)

The 19 most recent `tb_run` rows (2026-10-20 21:39-22:23) line up one-to-one with the user segments of 5 dev voice calls in `voice_transcript_segment` (each run starts within about 1 s of the user segment's completion).

| Metric (19 of 19 voice-turn runs) | Value |
|---|---|
| `tb_run.native_revision` (native commits per turn) | **32** in every run |
| Event rows per run | 65: 1 `native.snapshot`, 1 `native.checkpoint`, 1 `native.claim`, 31 `native.event`, 31 `native.receipt` |
| Largest payload per run (`native_payload_bytes`, the snapshot or checkpoint size) | 47.9-123.3 KB, growing with history |
| Stored payload bytes per run | p50 156 KB, max 209 KB |
| Run duration (`started_at`→`completed_at`, includes generation) | p50 5,228 ms (min 3,396, max 7,497) |

INFERENCE: the checkpoint row is rewritten on every commit (`_save` → `UPDATE … event_payload`, `MLLM/src/db/native_execution.py:313-353`). With ROW/FULL binlog images, each rewrite logs the before and after JSON. At 32 commits × 50-120 KB × 2 images, that is about **3-8 MB of binlog per voice turn**, all on fsync'd commits.

### 4.4 Real voice-call data (FACT, metadata only)

- **STT latency** (`voice_transcript_segment.stt_summary.latency_ms`, Groq `whisper-large-v3`, n=21 user segments): 422, 451, 453, 456, 459, 468, 472, 474, 494, 505, 520, 526, 553, 556, 562, 576, 585, 761, 868, 1017, 1481 ms. That is **p50 520 ms, p90 ≈868 ms, max 1,481 ms**. These requests include the cold-connection cost of §5.2.
- **Gaps between consecutive user segments in a call** (`created_at`, 1 s resolution, 16 gaps across 6 calls): **10-31 s; all of them are larger than the 5 s httpx keep-alive.**
- **TTS lanes:** 6 calls used `fish_audio_streaming` and 1 used `elevenlabs_streaming`.
- **Users:** all 8 voice sessions in the last 7 days belong to `user_type='root'`.

---

## 5. Measurements: local services, Redis and providers

### 5.1 Redis and local HTTP (MEASURED)

| Target | Probe | p50 | p90 | max (ms) |
|---|---|---|---|---|
| Redis 192.168.1.90:6379 | TCP connect | 0.158 | 0.272 | 0.956 |
| Redis | unauthenticated `PING` (reply `-NOAUTH`, one RTT) | 0.162 | 0.255 | 0.414 |
| api.magic_llm :7000 `/health` | new connection each (curl TTFB) | 0.9 | 1.7 | 1.9 |
| api.magic_llm :7000 `/v1/models` (no key) | curl TTFB | 7.6 | 9.0 | 127.2 |
| BFF :8010 `/health` | curl TTFB | 1.2 | 2.6 | 3.8 |
| api.auth :5000 `/system/ping` | curl TTFB | **8.2** | 23.6 | 56.1 |
| api.auth :5000 `GET /auth/validate` (no token → 401) | curl TTFB | **9.5** | 10.5 | 10.8 |

api.auth carries an **8-10 ms floor per request**, even on a public ping. INFERENCE: its stack of `BaseHTTPMiddleware` layers and audit middleware (`AUTH/src/main.py:115-137`) costs this much. api.magic_llm calls api.auth **twice in sequence per completion**: `validate_api_key` then `validate` (`MAC/client.py:1418`, `:1442`). So the auth floor on every LLM turn is **at least 16-20 ms**, before any real token lookup (the authenticated cost is UNKNOWN; no credentials were used). In dev, add 41 ms for the reused second call (§7).

`localhost` resolves to 127.0.0.1 first (`getent ahosts localhost`), and `http://localhost:7000` costs the same as `127.0.0.1` (1.15 ms vs 1.13 ms p50). The dev `AUTH_API_URL=http://localhost:5000` and `MAGIC_LLM_API_URL=http://localhost:7000` (`API/.env:7,19`) are fine.

### 5.2 Providers: cold connection phases (MEASURED with `curl -w`, a fresh process per sample, no keys)

First run, n=15 per host, 0.3 s spacing (ms):

| Host (endpoint, status, ALPN) | DNS done p50 (max) | TCP p50 (p90, max) | TLS p50 (p90, max) | DNS+TCP+TLS p50 (p90, max) | Server wait p50 | TTFB p50 (p90, max) |
|---|---|---|---|---|---|---|
| api.groq.com (`/openai/v1/models`, 401, h2) | 0.6 (126.5) | 57.3 (453.8, 1068) | 66.7 (370.6, 403) | 126.9 (588, 1260) | 125.3 | 296.5 (707, 1387) |
| api.elevenlabs.io (`/v1/models`, 404, h2) | 8.8 (83.0) | 29.7 (329.4, 331) | 61.6 (306.6, 846) | 105.6 (397.8, 1184) | 82.2 | 190.9 (512, 1264) |
| api.fish.audio (`/v1/tts` GET, 404, h2) | 0.7 (1.5) | 53.9 (55.1, 453) | 64.7 (483.9, 499) | 121.2 (538, 542) | 104.5 | 236.7 (643, 660) |
| openrouter.ai (`/api/v1/key`, 401, h2) | 0.6 (19.2) | 54.5 (458.7, 1099) | 60.4 (274, 353) | 126.4 (520, 1453) | 66.2 | 231.6 (584, 1577) |

`api.fish.audio/model` (a public listing) had a 2,608 ms p50 server wait. That endpoint is slow, and the figure is not representative of TTS.

Warm request on a reused connection (curl multi-URL, same connection, 11 samples) — TTFB in ms:

- Groq: 103-124, one 265;
- ElevenLabs: 77-84, one 115;
- Fish: 103-113;
- OpenRouter: 58-67, with 132, 234 and 133 outliers.

Tail sampling, Python `socket` + `ssl`, TCP+TLS only, n=80, 0.1 s spacing (ms):

| Host | p50 | p90 | p95 | max | >500 ms |
|---|---|---|---|---|---|
| openrouter.ai | 114.7 | 568.7 | 1,170.7 | 1,503.5 | **13/80** |
| api.groq.com | 117.6 | 1,108.0 | 1,169.4 | 1,484.2 | **16/80** |
| api.elevenlabs.io | 92.1 | 352.7 | 421.8 | 1,152.9 | 3/80 |
| api.fish.audio | 117.8 | 344.2 | 1,156.3 | 1,521.4 | 7/80 |

All connections negotiated TLSv1.3. In a separate n=40 run the TCP-only p50s were Groq 38.6, EL 13.7, Fish 39.3 and OpenRouter 55.3 ms, and TLS took 44-60 ms. The ~1.1 s outliers match a SYN or ClientHello retransmit at Linux's 1 s initial RTO. An established connection retransmits at its measured RTO, about 200 ms or more, instead.

### 5.3 Python client cold-versus-pooled penalty (MEASURED, n=10, 0.3 s spacing)

| Host | httpx new client per request (p50 / p90) | httpx pooled, warm (p50 / p90) | **Cold penalty p50** |
|---|---|---|---|
| api.groq.com | 199.8 / 218.0 | 119.8 / 133.4 | **+80.0** |
| api.elevenlabs.io | 129.1 / 132.0 | 74.8 / 100.2 | **+54.3** |
| api.fish.audio | 194.4 / 208.0 | 94.9 / 99.5 | **+99.5** |
| openrouter.ai (httpx) | 131.5 / 146.4 | 52.5 / 57.3 | **+79.0** |
| openrouter.ai (aiohttp new `ClientSession` per request, the magic-llm pattern) | 134.0 / 166.0 | 48.4 / 52.3 (shared session) | **+85.7** |

Client object construction (MEASURED, n=30):

- `httpx.AsyncClient()`: 2.48 ms p50 (BFF venv, Python 3.13) and 3.33 ms p50 (MLLM venv, Python 3.14), max 28-64 ms. It is synchronous CPU on the event loop (SSL context and CA bundle load), and it happens even for plain-HTTP targets.
- `aiohttp.ClientSession()`: about 0.00 ms.

### 5.4 Provider idle keep-alive (MEASURED, `idle_probe.py`)

A TLS connection to each host sent one HTTP/1.1 keep-alive request, idled N seconds, then sent a second request on the same socket.

| Host | 10 s | 30 s | 65 s | 125 s |
|---|---|---|---|---|
| api.groq.com | reused (111 ms) | reused (131) | reused (131) | reused (262) |
| api.elevenlabs.io | reused (102) | reused (80) | reused (78) | reused (78) |
| api.fish.audio | reused (108) | reused (106) | reused (108) | reused (111) |
| openrouter.ai | reused (66) | reused (64) | reused (69) | reused (60) |

**All provider edges keep idle connections for at least 125 s.** The binding limit is the client side: httpx `keepalive_expiry=5.0` (`API/.venv/.../httpx/_config.py:178`), or a new aiohttp session per request.

### 5.5 Provider WebSocket handshakes (MEASURED, n=12, no key)

| Endpoint | TCP+TLS+upgrade p50 / p90 / max | Outcome |
|---|---|---|
| `wss://api.elevenlabs.io/v1/text-to-dialogue/multi-stream-input` (`tts_multicontext_ws.py:93`) | **125 / 136 / 148 ms** | Upgrade accepted without a key, then the socket idled |
| `wss://api.fish.audio/v1/tts/live/with-timestamp` (`fish_audio/timestamp_ws.py:25`) | **274 / 281 / 299 ms** | Rejected with 401 at the upgrade (auth is checked during the handshake) |

INFERENCE: the authenticated Fish handshake is at least 274 ms. be-tts reports that both lanes open early (`connect_early`, EL prewarm at segment upload), so these numbers stay off the critical path only while STT and LLM take longer than the handshake.

---

## 6. Code facts that set round-trip counts

### 6.1 BFF DB helpers (FACT)

- **Pool.** `init_db_pool` → `aiomysql.create_pool(**load_mysql_config(...))` (`API/src/database/mysql/connection.py:149-152`). The config sets no `minsize`, `maxsize` or `pool_recycle` (`API/src/runtime_config.py:526-534`), so the aiomysql defaults apply: **minsize 1, maxsize 10, recycle -1** (`API/.venv/.../aiomysql/pool.py:13`). `pool.acquire()` has no timeout (`connection.py:195`).
- **`autocommit: False`** (`runtime_config.py:533`). So **every `execute_query` is at least 2 round trips**: the statement plus `COMMIT`. `connection.py:208-233` shows `await validate(cursor)`, `await cursor.execute(...)`, then `await conn.commit()`.
- `transaction_cursor` costs N statements plus `COMMIT` (`connection.py:236-260`).
- `validate(cursor)` runs every validator in the `validators` ContextVar before each transaction (`transaction_hooks.py:30-32`; called at `connection.py:220`, `:245`).

### 6.2 Feature-flag validators on the voice segment request (FACT, with INFERENCE on runtime propagation)

- **Root bypass.** The segment route is `@router.post(".../voice-segments", dependencies=[..., Depends(require_features("calls"))])` (`API/src/routes/user/route_voice_call.py:1130`). `require_features` returns early for `root` (`API/src/services/feature_flags/enforcement.py:47-50`).
- **Non-root path, in order:**
  1. `get_shadow_user_for_session`, which is an `INSERT … ON DUPLICATE KEY UPDATE` plus a `SELECT` (`API/src/database/mysql/models.py:5669-5693`);
  2. `scoped_permission`: `get_runtime().require` makes 2 Redis `EVAL`s through `cache.read` (`API/src/services/feature_flags/service.py:27-62`, `cache.py:79-92`);
  3. a validation transaction of 2 `FOR SHARE` reads plus `COMMIT`;
  4. it then **adds a validator to the ContextVar** for the rest of the request (`enforcement.py:16-43`).
- **What each validator costs.** The validator is `FeatureFlagStore.assert_context`: `SELECT … FROM user_membership … FOR SHARE` plus `SELECT feature_revision,is_active FROM membership_plan … FOR SHARE` (`API/src/database/mysql/feature_flags.py:15-27`, `:62-70`).
- **The whole turn runs inside that request.** The route then projects the shadow user a second time (`_http_user_context` → `route_chat._project_local_user` → `get_or_create_shadow_user`, `route_voice_call.py:265-268`, `route_chat.py:325-337`). It awaits `engine.accept_segment`, and `accept_segment` awaits `_run_voice_turn` inline (`API/src/services/voice_orchestration/engine.py:2092`). So intake, STT billing, LLM admission and persistence all run in the request task, under the validator.
- INFERENCE: asyncio tasks spawned from that task copy the context, so they inherit the validator too.
- **Measured cost:** U_ff = +0.47 ms per transaction. The dependency adds about 4-5 ms of fixed cost.
- **Dev never exercises this path** because every dev voice session in the last 7 days was made by `root` (§4.4).

### 6.3 api.magic_llm DB and HTTP clients (FACT)

- **Sync DB pool.** `SyncPool` wraps DBUtils `PersistentDB(ping=1, closeable=False)`, which keeps one connection per thread (`MLLM/src/db/connection.py:69-86`). `ping=1` means a **`COM_PING` round trip on every borrow** (`dbutils/persistent_db.py:221` → `steady_db.py:335-360`).
- **Thread-local connections die with their thread.** anyio worker threads exit after `MAX_IDLE_TIME = 10` s (`anyio/_backends/_asyncio.py:951`). INFERENCE: thread-local connections in threadpool workers are lost after 10 s idle and pay U_conn (1.3-1.8 ms) on the next use.
- **Async pool.** `minsize 2`, `maxsize 10`, `autocommit=True`, `pool_recycle=3600` (`MLLM/src/db/connection.py:202-241`). The native repository wraps each operation in `BEGIN … COMMIT` and closes the connection on any error (`MLLM/src/db/native_execution.py:129-178`).
- **One native commit runs 15-20 statements** (`native_execution.py:975-1034`):
  - `_lock`;
  - receipt lookup;
  - `_now`;
  - `_record`, which reads the snapshot and the checkpoint, 2 SELECTs each;
  - `_visible_output`;
  - per event, `_native_lifecycle` plus an `INSERT`;
  - `_save`: checkpoint `UPDATE`, then `UPDATE`s of `tb_run`, `tb_interaction`, `tb_execution` and `tb_message`;
  - `_write_receipt`;
  - `COMMIT`.
- **Auth client.** Process-wide `MagicAuthClient` with a pooled internal `httpx.AsyncClient` (`MLLM/src/auth/client.py:71-81`, `MAC/client.py:127-131`). The two sequential validation calls are at `MAC/client.py:1418` and `:1442`.
- **Provider client.** magic-llm opens a **new aiohttp session per call**: `AsyncHttpClient.__aenter__` → `aiohttp.ClientSession()` (`LLM/magic_llm/util/http.py:100-101`). That covers the stream (`LLM/magic_llm/engine/engine_openai.py:264`) and the OpenRouter usage poll, which opens another new session (`:171-177`, called at `:286`). api.magic_llm imports this local checkout (`MLLM/.venv` → `/home/andres/PycharmProjects/magic-llm/magic_llm/__init__.py`).

### 6.4 BFF HTTP clients on the turn path (FACT)

| Hop | Client | Reuse |
|---|---|---|
| BFF → Groq STT | `httpx.AsyncClient(timeout=…, follow_redirects=False)`, created lazily, process-wide (`API/src/services/voice_orchestration/stt_groq_client.py:139-145`) | Pooled, but library defaults: `keepalive_expiry=5.0`, `max_keepalive_connections=20` (`httpx/_config.py:178,247`). No warm-up |
| BFF → api.magic_llm (callbot stream) | `CallbotExecutionService(...)` built without `client` (`engine.py:3793-3795`) → `async with _client(config)` per stream (`API/src/services/llm_execution_transport.py:276-277`, `:315-322`) | **New client per turn** (2.5-3.3 ms of CPU to construct; localhost connect about 0.1 ms in dev) |
| BFF → api.magic_llm (catalog, 60 s TTL) | One owned client per refresh, then **2 sequential GETs** (`llm_execution_transport.py:375-387`) | The second GET reuses the first GET's connection (dev Nagle: +41 ms, §7) |
| BFF → api.magic_llm (moderation) | Cached `httpx.AsyncClient` (`API/src/services/speech/moderation_transport.py:322-327`) | Pooled (dev Nagle: +41 ms per reuse) |
| BFF → api.auth | Shared `httpx.AsyncClient` lent to `MagicAuthClient` (`API/src/services/auth_adapter.py:329-343`), 30 s validation cache | Pooled |

Server-side keep-alive: every uvicorn server closes idle client connections after **5 s** (`timeout_keep_alive=5`, `UV35/config.py:214`; `UV47/config.py:216`). A pooled BFF → api.magic_llm client would therefore still reconnect after 5 s idle unless api.magic_llm raises `--timeout-keep-alive`. The same applies to browser → BFF uploads: they arrive 10-31 s apart (§4.4), so each opens a new TCP connection, plus TLS in production unless a proxy holds it open.

---

## 7. Measured: the uvicorn `--reload` / `--workers` Nagle stall

**Mechanism (FACT).**

- With `reload` or `workers`, `uvicorn.main.run` calls `config.bind_socket()` and passes the socket to `server.run(sockets=[sock])` (`UV35/main.py:574-578`).
- `bind_socket` creates it with **`socket.socket(family=family)`**, so `proto` is 0 (`UV35/config.py:513`; same code at `UV47/config.py:570` and `AUTH/.venv/.../uvicorn/config.py:512`).
- Accepted sockets inherit `proto=0`. asyncio sets `TCP_NODELAY` only when `sock.proto == socket.IPPROTO_TCP` (`/usr/lib/python3.13/asyncio/base_events.py:192-196`, called from `selector_events.py:948`). So **Nagle stays on**.
- uvicorn's h11 server writes the response headers and the body in separate writes. On a reused connection, the client sits in delayed-ACK mode, and the body waits for that ACK: about 40 ms on Linux.
- The standard path (`server.run()` → `loop.create_server(host=, port=)`, `UV35/server.py:161-169`) gets `proto=6` from getaddrinfo and is not affected.

**A/B (MEASURED)**, same minimal ASGI app (JSON 200), uvicorn 0.35.0, curl reusing one connection for 10 requests:

| Startup path | Request 1 | Requests 2-10 |
|---|---|---|
| Standard (`server.run()`) | 0.68 ms | 0.06-0.15 ms |
| `bind_socket()` (the reload/workers path; `listen proto: 0`) | 0.76 ms | **40.9-42.1 ms each** |

**On the real dev services (MEASURED):**

| Probe | Result |
|---|---|
| curl keep-alive on `:7000/health` | 0.89 ms, then 41.0-41.96 ms per request |
| Raw socket, headers versus full body | `:7000`: headers 0.70 ms, full body 41.98 ms. `:8010`: headers 1.59 ms, full body 42.92 ms |
| httpx reused client | `:7000/health` 43.0, `:8010/health` 42.8, `:5000/system/ping` 51.0 ms p50 |

Setting `TCP_NODELAY` on the client socket did not help (43.0 vs 42.96 ms). The stall is on the server side.

**Patterns that did not stall (MEASURED, Linux loopback client):**

- WebSocket server → client frames, 20 ms apart or bursty with client chatter: p50 0.29 ms and max ≤3.7 ms on both paths.
- SSE chunks 15 ms apart after a 300 ms TTFT gap: p50 0.10-0.24 ms on both paths, fresh or reused connection.
- UNKNOWN for browsers that apply a different delayed-ACK policy (for example Windows' 200 ms timer).

**Where it hits the voice path in dev (INFERENCE):**

- the second api.auth call of every api.magic_llm completion: +41 ms per turn, plus the first call when it reuses a connection younger than 5 s;
- api.magic_llm's auth on every moderation request: +41-82 ms against a 300 ms budget, when the classifier is enabled;
- the BFF catalog's second GET: +41 ms on refresh turns;
- BFF → api.auth when its cache misses within 5 s of an earlier call.

So dev time to first audio is overstated by about 41-82 ms or more compared with the production launchers, and the BE-LLM-03 advice to pool every hop would *add* 41 ms per pooled hop in dev. If production ever adds `--workers N`, the same stall returns in production.

---

## 8. Recomputed per-turn overhead with measured unit costs

Assumptions (INFERENCE):

- Operation counts come from the cited code and the existing notes.
- Unit costs come from §4.1 and §4.2.
- "p90" is a rough tail. With k write commits, the chance that at least one exceeds its p90 is 1-0.9^k. That is 47% for 6 commits, 57% for 8, and 92% for 24.

### 8.1 be-stt BE-STT-05 / step 4 + step 7 ("8-12 round trips under `intake_lock`")

Operations (FACT): `get_session` (R) and `touch_call` (W: `UPDATE voice_quota_reservation`, `API/src/services/voice_orchestration/quota.py:327-332`), outside the lock. Inside `intake_lock` (`engine.py:2051`):

- `find_segment` (R);
- `create_segment`: INSERT (W) + `get_by_id` (R) (`models.py:7469-7608`);
- `update_segment(accepted)` (W);
- STT;
- `_record_billable_audio`: debit, a write transaction of about 10-15 statements (`models.py:2871-3060`); `get_session` (R); `update_session_metadata` (W) (`engine.py:3378-3455`);
- `update_segment(completed)` (W).

| Part | Count | p50 estimate | p90-ish |
|---|---|---|---|
| Pre-STT (get_session, touch, find, create+read-back, accepted) | 3 R + 3 W, about 12 statements | **≈13-14 ms** | 25-35 ms |
| Post-STT (debit txn, get_session, metadata, completed) | 1 R + 3 W, about 22 statements | **≈17-18 ms** | 30-45 ms |
| Total | 4 R + 6 W, about 33 statements | **≈30-32 ms** (root); +5 ms non-root | 45-60 ms |

The original estimate was 15-90 ms. **Measured basis: about 30 ms p50 and 45-60 ms p90 on a 0.24 ms LAN DB.** Network round trips are only about 8 ms of that (33 × 0.24). The rest is server execution and **6 fsync'd write commits**.

### 8.2 be-engine BE-ENGINE-TURNTAKING-03 ("≈15 serialized DB round trips before the LLM request")

From segment receipt to the LLM HTTP POST, with every part serial:

| Part | Root user | Non-root user |
|---|---|---|
| Route pre-checks: shadow projection (INSERT ODKU + SELECT), workspace (1-2 R), chat (1 R), consent/admission (1-2 R) (`route_voice_call.py:1141-1157`) | 6-8 transactions ≈ **6-10 ms** | + `require_features`: second projection, 2 Redis EVALs (0.16 ms each), validation transaction, U_ff on each ≈ **13-18 ms** |
| Intake and STT billing (§8.1) | ≈30 ms | ≈35 ms |
| LLM prep: `get_scoped_session` + `find_admission` (2 R), prompt render reads (3-6 R), admission (about 25-30 statements + write commit), `started` (W) (be-llm stages 3, 4, 6, 8) | ≈25-40 ms | ≈30-45 ms |
| **Total BFF DB tax** | **≈60-80 ms p50; ≈100-140 ms p90** (about 23-29 transactions, 8 write commits, about 90-105 statements) | **≈75-100 ms p50** |

The original estimate was 20-80 ms on a local MySQL and 100-200 ms or more remote. On this 0.24 ms LAN the measured basis is **about 60-80 ms p50**. Only about 22-25 ms is round-trip time. Moving the DB onto the same host (RTT about 0.05 ms) would save only about 20 ms.

**The levers are fewer statements, fewer write commits, and moving non-blocking writes off the path.** A managed DB at about 1 ms RTT would add about 70 ms more (INFERENCE).

### 8.3 be-llm §9 stage 6 (admission transaction)

About 25-30 statements in one transaction (`llm_execution_admission.py:457-585`, `conversation_turn_store.py:94-116`, `336-381`):

- network: 28 × 0.24 ≈ 7 ms;
- server: `FOR UPDATE` over the session and 100 message rows, plus an INSERT of the plan with a frozen JSON payload (graph and up to 100 messages; size UNKNOWN), ≈ 5-15 ms;
- one write commit: 2.3 ms p50, 19 ms p90.

Result: **≈15-25 ms p50, ≈35-50 ms p90.** This sits inside be-llm's 15-80 ms range and narrows it.

### 8.4 be-llm §9 stage 13 (durable recording before the provider call)

Per native commit, using measured server averages (INFERENCE):

| Component | ms |
|---|---|
| 15-18 statements × R | 3.6-4.3 |
| Lock, now, receipt, BEGIN | ≈0.6-0.8 |
| 4 payload reads | ≈1.5 (p50-ish) to ≈3.2 (avg) |
| Checkpoint UPDATE | 2.4 (p50) to 6.3 (avg) |
| Event INSERT | ≈0.7-1.0 |
| 4 state UPDATEs | ≈1.5-1.8 |
| Write COMMIT | 3.5 (p50) to about 4.5 (avg) |
| **Per commit** | **≈14 ms p50-ish, ≈20 ms mean, ≥40 ms p90** |

The 32 commits per turn are FACT (§4.3). The ~16 before the provider call are be-llm INFERENCE. The sum of 16 commits concentrates near the mean, which gives **≈250-350 ms**. Adding about 19 autocommit persistence-hook writes (be-llm) at about 1-4 ms each gives **stage 13 ≈ 270-420 ms**.

The remaining ~16 commits form the post-stream tail, about 250-350 ms, which matches be-llm's 200-1,000 ms tail.

This is now the best-supported estimate for BE-LLM-02. It is comparable to provider TTFT, and it grows with history, because the checkpoint and snapshot are 48-123 KB and rewritten on every commit.

### 8.5 Connection setup (BE-STT-04, BE-LLM-03, BE-LLM-04)

| Hop | Today (FACT) | Measured cost of a cold connection | Per-turn effect (INFERENCE) |
|---|---|---|---|
| BFF → Groq STT | Pooled, 5 s keep-alive. Every recorded inter-utterance gap was 10-31 s | +80 ms p50 (Python); TCP+TLS >500 ms in 20% of 80 samples; outliers about 1.1-1.5 s | **+80 ms p50 on every turn after the first** (single call per process); about 1 in 5-10 turns gains +0.5-1.4 s. The edge keeps idle connections ≥125 s, so `keepalive_expiry≥60-120 s` would remove it |
| magic-llm → OpenRouter (stream) | New aiohttp session per call | +86 ms p50; >500 ms in 16% of samples | **+86 ms p50 every turn** |
| magic-llm → OpenRouter usage poll (after the stream, before `[DONE]`) | New session | Cold GET ≈ 115-130 ms TCP+TLS + about 60 ms request | **≈180-250 ms added to the post-stream tail** (warm would be about 50-65 ms) |
| BFF → api.magic_llm | New httpx client per turn | 2.5-3.3 ms of loop CPU + 0.1 ms connect (localhost) | Small in dev. Production with TLS across hosts: + one handshake (UNKNOWN topology) |
| api.magic_llm → api.auth | Pooled; two sequential calls | 8-10 ms floor each (unauthenticated); +41 ms dev Nagle on reuse | ≥16-20 ms per turn (prod); ≈60-80 ms (dev) |
| BFF → EL WS / Fish WS | Opened early per call or turn (be-tts) | 125 ms / ≈274 ms p50 | Hidden while STT+LLM take longer; otherwise on the path |

Total controllable connection cost per turn on the critical path (Groq + OpenRouter stream): **≈165 ms p50**. A **1-1.5 s retransmit tail** hits roughly 1 in 4 turns on this network (INFERENCE: two cold connects, each with a 4-20% chance above 500 ms).

---

## 9. Latency table (critical path: user stops speaking → first audio)

Only the stages this note measured or re-sized. Other stages are in the subsystem notes.

| Stage | Estimate (ms) | Evidence | Status |
|---|---|---|---|
| Route DB pre-checks (root / non-root) | 6-10 / 13-18 | `route_voice_call.py:1130-1157`; §4.1; §6.2 | INFERENCE on measured units |
| Engine pre-STT bookkeeping (5 transactions, 3 write commits) | ≈13-14 p50; 25-35 p90 | `engine.py:2024-2209`; `quota.py:327-332` | INFERENCE on measured units |
| Groq cold connection (every turn after the first) | +80 p50; +500-1,400 in about 20% | `stt_groq_client.py:139-145`; §5.3, §5.2, §4.4 | MEASURED (this network) |
| STT request as recorded | p50 520; p90 ≈868; max 1,481 | `voice_transcript_segment.stt_summary.latency_ms` (n=21) | FACT |
| STT billing + segment completion | ≈17-18 p50; 30-45 p90 | `engine.py:2243-2281`, `3378-3455` | INFERENCE |
| BFF LLM prep + admission + started | ≈25-40 p50 | be-llm stages 3/4/6/8; §8.3 | INFERENCE |
| Feature-flag validators (non-root) | +0.47 per transaction; ≈+12-15 per turn | `enforcement.py:16-56`; `connection.py:220,245` | MEASURED unit, INFERENCE count |
| BFF → api.magic_llm per-turn client | 2.5-3.3 (CPU) + 0.1 | `llm_execution_transport.py:276-277`; §5.3 | MEASURED |
| api.magic_llm delegated auth (2 sequential calls) | ≥16-20 (prod); +41 dev | `MAC/client.py:1418,1442`; §5.1; §7 | MEASURED floor |
| api.magic_llm durable recording before provider | ≈270-420 | §4.2-4.3, §8.4 | FACT count 32, INFERENCE split |
| OpenRouter new session per call | +86 p50; >500 in 16% | `LLM/magic_llm/util/http.py:100-101`; `engine_openai.py:264` | MEASURED |
| EL WS handshake (normally overlapped) | 125 p50 | §5.5 | MEASURED |
| Fish WS handshake (normally overlapped) | ≈274 p50 (to 401) | §5.5 | MEASURED |
| Dev-only Nagle stall per reused HTTP hop | +41 each | §7 | MEASURED |
| Post-stream: OpenRouter usage poll on new session | ≈180-250 | `engine_openai.py:171-177,286` | INFERENCE on measured |

---

## 10. Findings

### GAP-TOPOLOGY-RTT-MEASUREMENTS-01: `--reload` and `--workers` start uvicorn without TCP_NODELAY, adding about 41 ms to every reused keep-alive request (medium, latency; confidence high)

- **FACT.**
  - `bind_socket()` creates the listener with `socket.socket(family=family)`, so `proto` is 0 (`UV35/config.py:513`, `UV47/config.py:570`).
  - That path is used for `--reload` and `--workers` (`UV35/main.py:574-578`).
  - asyncio only sets `TCP_NODELAY` when `proto == IPPROTO_TCP` (`asyncio/base_events.py:192-196`).
  - All three dev services run with `--reload` (`ps`).
- **MEASURED.** A/B on the same app: reused-connection requests take 0.06-0.15 ms on the standard path and 40.9-42.1 ms on the `bind_socket` path. On the dev services: `:7000` 41-43 ms, `:8010` 42.8 ms, `:5000` 51 ms per reused request. Setting NODELAY on the client does not help.
- **Impact.**
  - Dev latency numbers for every pooled hop are inflated by about 41 ms per reuse (§7). In dev that means about +41-82 ms per turn in api.magic_llm auth, +41 ms per catalog refresh, and +41 ms or more per moderation call.
  - Pooling BFF → api.magic_llm, as BE-LLM-03 recommends, would cost +41 ms per turn in dev.
  - Scaling production with `--workers N` (or any pre-bound-socket launcher) would bring the stall to production.
  - WS and SSE streaming showed no stall on a Linux loopback client. Remote browsers are UNKNOWN.
- **Recommendation.**
  - Measure latency with the production launcher (`python -m src.serve`, no reload), or start dev with a socket created as `socket.socket(AF_INET, SOCK_STREAM, IPPROTO_TCP)` and passed through `fd=`.
  - For scale-out, use separate single-worker processes behind a load balancer, or verify `TCP_NODELAY` on accepted sockets with a small test.
  - Add a startup self-check that asserts `TCP_NODELAY` on the first accepted connection.

### GAP-TOPOLOGY-RTT-MEASUREMENTS-02: Client keep-alive settings force a new TLS connection to Groq and OpenRouter on almost every turn (+165 ms p50, with 0.5-1.5 s tails) (high, latency; confidence high for the mechanism, medium for production magnitude)

- **FACT.**
  - Groq client: httpx defaults, `keepalive_expiry=5.0` (`stt_groq_client.py:139-145`, `httpx/_config.py:178`).
  - Recorded gaps between user utterances: 10-31 s in 16 of 16 cases (§4.4).
  - magic-llm opens a new `aiohttp.ClientSession` for every stream and for the usage poll (`LLM/magic_llm/util/http.py:100-101`, `engine_openai.py:171-177,264,286`).
  - No prewarm exists for STT (be-stt BE-STT-04).
- **MEASURED.**
  - Cold penalty p50: Groq +80 ms, OpenRouter +86 ms (aiohttp).
  - TCP+TLS above 500 ms in 16/80 (Groq) and 13/80 (OpenRouter) samples, with outliers of 1.1-1.5 s.
  - Every provider edge kept an idle connection for at least 125 s, so the cost is purely client-side.
- **Impact (INFERENCE).**
  - About +165 ms p50 on the critical path of every turn after the first.
  - About 1 in 4 turns sees a 0.5-1.5 s retransmit stall.
  - About +180-250 ms on the post-stream tail (usage poll).
  - The recorded STT p50 of 520 ms already includes the cold connect.
- **Recommendation.**
  - One process-wide `httpx.AsyncClient(limits=httpx.Limits(keepalive_expiry=120))` per provider.
  - A shared aiohttp `TCPConnector` and session per provider in magic-llm, with `ttl_dns_cache` and `keepalive_timeout≥60 s`.
  - Prewarm (open, or send an idle `HEAD`) at `voice_start` and on client `speech_start`.
  - Optionally HTTP/2, since all four providers negotiate h2. The `h2` package is needed in the BFF.
  - Stream usage instead of polling it (BE-LLM-04).

### GAP-TOPOLOGY-RTT-MEASUREMENTS-03: The BFF's serialized DB tax before the LLM request is about 60-100 ms p50, and it is set by statement and write-commit count, not by DB distance (medium, latency; confidence medium)

- **FACT.**
  - The pool runs `autocommit=False`, so each `execute_query` is a statement plus `COMMIT` (`connection.py:208-233`, `runtime_config.py:533`).
  - About 23-29 transactions and 8 write commits run serially from segment receipt to the LLM POST (§8.2).
  - The DB has `innodb_flush_log_at_trx_commit=1` and `sync_binlog=1`.
- **MEASURED.**
  - R = 0.24 ms.
  - Write-commit server time: p50 ≤2.3 ms, p90 ≤19 ms, p99 ≤26 ms (BFF schema).
  - The shadow-user upsert on every authenticated request has p99 25 ms and a maximum of 1.44 s.
- **Impact (INFERENCE).** About 60-80 ms p50 for root and 75-100 ms p50 for other users, and about 100-140 ms p90. Network round trips are only about 25 ms of it. Relocating the DB saves little; cutting statements and commits saves the most.
- **Recommendation.**
  - Start LLM admission immediately after the transcript.
  - Move segment status, STT billing and session-metadata writes into one ordered per-call background writer (join before turn completion).
  - Fold `find_segment`/`create_segment`/read-back into one `INSERT … ON DUPLICATE KEY` without the read-back.
  - Cache the session, consent, workspace and shadow-user rows per call.
  - Use `autocommit=True` for single-statement reads, which removes the `COMMIT` round trip.
  - Merge `touch_call` into the segment write.

### GAP-TOPOLOGY-RTT-MEASUREMENTS-04: api.magic_llm performs 32 fsync'd commits and rewrites a 48-123 KB checkpoint per voice turn, about 270-420 ms before the provider request (high, latency/cost; confidence medium)

- **FACT.**
  - 19 of 19 recent voice-turn runs have `native_revision = 32` and 65 event rows, with checkpoint/snapshot sizes of 47.9-123.3 KB (§4.3).
  - Each commit runs 15-20 statements (`native_execution.py:975-1034`).
  - The binlog is `ROW` with `binlog_row_image=FULL` and no `PARTIAL_JSON`.
- **MEASURED (server).** The checkpoint UPDATE averages 6.29 ms (p90 ≤14.5 ms, p99 ≤34.7 ms). Write commits run p50 ≤3.5 ms, p90 ≤11 ms and p99 ≤60 ms in `magic_messages`.
- **Impact (INFERENCE).**
  - About 14-20 ms per native commit.
  - About 16 commits before the provider call come to about 270-420 ms; another 250-350 ms falls in the post-stream tail.
  - About 3-8 MB of binlog per turn.
  - The cost grows with history. This quantifies BE-LLM-02 and BE-LLM-21.
- **Recommendation.**
  - An ephemeral, non-durable execution mode for BFF-owned callbot graphs, with a single commit after the stream (be-llm).
  - If durability must stay, append-only events instead of rewriting the checkpoint, `binlog_row_value_options=PARTIAL_JSON` with `binlog_row_image=MINIMAL`, and batched commits.

### GAP-TOPOLOGY-RTT-MEASUREMENTS-05: Normal users pay feature-flag SQL validators on every transaction of the voice turn, plus a second shadow-user upsert; dev testing as root never sees it (medium, latency/observability; confidence medium)

- **FACT.**
  - `require_features("calls")` on the segment route sets up the following for non-root users: a shadow-user upsert, 2 Redis EVALs, a validation transaction, and a validator that adds 2 `FOR SHARE` reads to every later transaction (`route_voice_call.py:1130`, `enforcement.py:16-56`, `feature_flags.py:15-27,62-70`, `transaction_hooks.py:30-32`).
  - The whole voice turn runs inside the request (`engine.py:2092`).
  - All 8 dev voice sessions in the last 7 days were `root` (§4.4).
- **MEASURED.** U_ff = +0.47 ms per transaction. The upsert has p99 25 ms and a maximum of 1.44 s.
- **Impact (INFERENCE).**
  - About +12-15 ms per turn plus about 4-5 ms fixed cost, for production users only.
  - Shared locks on `user_membership` and `membership_plan` in every transaction can block or be blocked by membership mutations during a call.
  - Dev latency numbers understate production.
- **Recommendation.**
  - Run latency tests with a non-root account.
  - Validate the flag once per call (at `voice_start` and resume), and clear `validators` before entering the engine turn.
  - Cache the shadow-user projection per process with a short TTL instead of upserting on every request.

### GAP-TOPOLOGY-RTT-MEASUREMENTS-06: The shared dev MySQL is saturated and tuned for durability, not latency (medium, robustness; confidence high for dev, production UNKNOWN)

- **FACT.** The server hosts many apps. `max_connections=151` with `Max_used_connections=152` and `Connection_errors_max_connections=24` (refusals have happened). The buffer pool is the 128 MiB default. Settings are `sync_binlog=1`, `innodb_flush_log_at_trx_commit=1`, ROW/FULL binlog, and `thread_cache_size=9` against about 3.8 connections per second.
- **MEASURED.** Write-commit p90 is 11-19 ms and p99 is 26-60 ms. fsync averages 1.5-1.95 ms.
- **Impact.**
  - A voice turn crosses about 24 write commits (8 in the BFF, about 16 in api.magic_llm before the provider). The chance of at least one commit above p90 is about 92%. Commit tails, not round trips, set DB jitter.
  - A refused connection during pool growth fails the turn.
- **Recommendation.**
  - A dedicated DB, or at least dedicated `max_connections` headroom, for the voice path.
  - A larger buffer pool.
  - Measure and record the production DB RTT and commit latency.
  - Consider group-commit tuning (`binlog_group_commit_sync_delay` is 0).

### GAP-TOPOLOGY-RTT-MEASUREMENTS-07: The 5 s server keep-alive everywhere defeats connection pooling between services and for browser uploads (low, latency; confidence high)

- **FACT.** uvicorn `timeout_keep_alive=5` on the BFF, api.magic_llm and api.auth (`UV35/config.py:214`, `UV47/config.py:216`). No launcher overrides it (`serve.py:28-33`, `MLLM/Dockerfile:123`, `AUTH/scripts/docker-entrypoint.sh:61`). Browser segment uploads arrive 10-31 s apart (§4.4).
- **Impact (INFERENCE).**
  - A pooled BFF → api.magic_llm client would still reconnect each turn.
  - Each segment upload opens a new TCP connection. In production that adds 1 TCP RTT plus 1 TLS RTT unless a proxy keeps the client connection.
- **Recommendation.** Raise `timeout_keep_alive` to about 75-120 s on internal services, or put a proxy in front that holds client connections. Upload audio over the existing call WebSocket instead of a new POST.

### GAP-TOPOLOGY-RTT-MEASUREMENTS-08: Per-turn `httpx.AsyncClient` construction blocks the single event loop for 2.5-3.3 ms (max 28-64 ms) (low, latency/scalability; confidence high)

- **FACT.** A new client is built for each callbot stream and each catalog refresh (`llm_execution_transport.py:276-277,315-322,382`; `engine.py:3793-3795`). The process is single (§3).
- **MEASURED.** `httpx.AsyncClient()` takes 2.48 ms p50 on Python 3.13 and 3.33 ms on 3.14, with a maximum of 28-64 ms. An aiohttp session costs about 0 ms.
- **Impact.** Every concurrent call stalls by that much on each turn start, and outliers reach tens of ms.
- **Recommendation.** One shared client created at lifespan start, as be-llm BE-LLM-03 already recommends.

### GAP-TOPOLOGY-RTT-MEASUREMENTS-09: DB pools are small, unbounded on wait, and not kept warm (low, robustness; confidence medium)

- **FACT.**
  - The BFF aiomysql pool is maxsize 10 (default) with no acquire timeout (`connection.py:149-152,195`; `aiomysql/pool.py:13`).
  - api.magic_llm: async pool maxsize 10; `PersistentDB(ping=1)` adds a `COM_PING` on every borrow; thread-local connections are lost when anyio threads idle out (10 s).
  - At measurement time the api.magic_llm worker held **zero** MySQL connections despite `minsize=2`.
- **Impact (INFERENCE).**
  - Under concurrent calls (each turn holds connections for multi-statement transactions), pool exhaustion queues turns with no deadline.
  - Cold pools add 1.3-1.8 ms per new connection, plus a `COM_PING` round trip on every sync borrow.
- **Recommendation.** Size the pools to the concurrency target, set an acquire timeout, keep `minsize` warm with a keep-alive ping on an idle timer (not on every borrow), and expose pool-wait metrics.

### GAP-TOPOLOGY-RTT-MEASUREMENTS-10: The repos do not define the production network topology (low, observability/robustness; confidence high)

- **FACT.**
  - No reverse proxy, TLS terminator or HTTP/2 config exists in any repo.
  - `FORWARDED_ALLOW_IPS=127.0.0.1` (`API/docker-compose.yml:49`) and `--proxy-headers` in api.auth assume a proxy that is not defined.
  - The compose `app` inherits `MYSQL_HOST` from `.env`, which is the LAN DB in dev, although compose ships a `mysql` service.
  - Both the BFF and api.magic_llm connect as DB `root` in dev.
  - On SIGTERM or reload, uvicorn closes every WS with 1012 and waits without limit for in-flight turns (`timeout_graceful_shutdown=None`). The dev BFF worker was restarted by `--reload` about 1.5 h before measurement.
- **Impact.**
  - Production RTTs (BFF ↔ api.magic_llm ↔ DB ↔ providers), proxy idle timeouts, WS keep-alive through the proxy and deploy behaviour (all calls dropped) cannot be verified from code.
  - Every dev code save kills live calls.
- **Recommendation.** Write down the production topology: hosts, regions, proxy, timeouts, h2, DB placement. Add a "connection and DB RTT" startup log line or health metric. Set `timeout_graceful_shutdown` and a call-draining strategy for deploys. Use a least-privilege DB user.

### GAP-TOPOLOGY-RTT-MEASUREMENTS-11: The dev environment drifts from the pinned versions (info, maintainability; confidence high)

- **FACT.**
  - The api.magic_llm venv has uvicorn 0.47.0, starlette 1.0.1 and fastapi 0.136.1, while `requirements.txt` pins 0.53.0, 1.6.0 and 0.141.1.
  - Python is 3.13 or 3.14 in dev and 3.12 in Docker.
  - Dev imports `main:app` through `PYTHONPATH=src`; Docker imports `src.main:app`.
  - `be-llm.md:366` cites `httptools_impl.py`, but httptools is not installed; h11 gives the same `spec_version` 2.3 (`UV47/protocols/http/h11_impl.py:206`).
- **Recommendation.** Rebuild the dev venvs from the pins, and measure latency with the container image.

### GAP-TOPOLOGY-RTT-MEASUREMENTS-12: Data recorded in the DB answers several open questions in the other notes (info; confidence high)

- **FACT.**
  - STT latency in real calls: p50 520 ms, p90 about 868 ms, max 1,481 ms (n=21).
  - Gaps between user utterances: 10-31 s.
  - 32 native commits per voice turn.
  - api.magic_llm run duration p50 5.2 s.
  - Provider WS handshakes: EL 125 ms, Fish about 274 ms.
- **Recommendation.** Persist per-stage timings per turn (STT connect versus inference, admission DB ms, native-commit ms before the first provider byte, provider TTFB) so production can be checked the same way. `tb_execution_event.created_at` and the segment timestamps have only 1 s resolution.

---

## 11. Strengths

- **The production launchers avoid the Nagle stall.** `python -m src.serve` and the api.magic_llm and api.auth Docker CMDs use uvicorn's standard host/port path, so accepted sockets get `TCP_NODELAY` (MEASURED A/B: 0.07 ms per reused request).
- **The LAN DB is fast at the network level:** 0.24 ms per statement, 1.3-1.8 ms per new connection, 0.16 ms Redis RTT. The DB cost is fixable in code; no infrastructure move is required.
- **The BFF uses a real connection pool** (aiomysql) and **shared pooled clients** for STT, api.auth and moderation. api.magic_llm shares its auth client.
- **All four providers support HTTP/2 and TLS 1.3, and keep idle connections ≥125 s**, so client-side pooling and prewarm will work.
- **The TTS WebSockets are opened early or prewarmed** (be-tts), so the measured 125 ms (EL) and about 274 ms (Fish) handshakes normally overlap STT and LLM.
- **Durability is real.** fsync on every commit plus `sync_binlog=1` mean the BFF and the agent store do not lose turns on a crash. The cost is latency, now quantified.
- **The single-process design matches the process-local call state** in both dev and the repo's production launch, and it is documented (be-route-transport).

---

## 12. Reproduction (essential logic of the scripts)

1. **DB round trip (read-only).** Load `MYSQL_*` from `API/.env`. With pymysql, time `socket.create_connection` (×10), `pymysql.connect` (×10), then N=50 × `SELECT 1`, `COMMIT`, and `SELECT 1`+`COMMIT`. With aiomysql, `create_pool(minsize=1,maxsize=10,autocommit=False)`, then N=50 × (acquire → `DictCursor` → `SELECT 1` → `commit`). Run with `API/.venv/bin/python -I`.
2. **Server-side digests.** Read `performance_schema.events_statements_summary_by_digest` and `events_statements_histogram_by_digest` filtered on `DIGEST_TEXT='COMMIT'`, then split buckets at 0.5 ms into read-only and write commits. Also read `file_summary_by_instance` for the redo and binlog fsync averages, and `global_variables`/`global_status`.
3. **Run shape.** `SELECT native_revision, COUNT(events), MAX(native_payload_bytes), TIMESTAMPDIFF(MICROSECOND, started_at, completed_at) FROM magic_messages.tb_run … ORDER BY started_at DESC LIMIT 25`. Correlate with `voice_transcript_segment.created_at` (metadata only).
4. **Providers.** `curl -s -o /dev/null -w '%{time_namelookup} %{time_connect} %{time_appconnect} %{time_pretransfer} %{time_starttransfer} %{time_total} %{http_code} %{http_version}'` with a fresh process per sample against no-key endpoints. Then a multi-URL curl for warm reuse. Python `socket`+`ssl` with n=80 for tails. httpx/aiohttp fresh-versus-shared clients. A raw TLS socket idled 10/30/65/125 s between two keep-alive requests.
5. **Nagle A/B.** A minimal ASGI app returning JSON. Run `uvicorn.Server(config).run()` against `server.run(sockets=[config.bind_socket()])` on two ports, then 10 keep-alive requests with curl.

---

## 13. Open questions (UNKNOWN)

1. **Production topology.** Hosts and regions for the BFF, api.magic_llm, api.auth and MySQL; whether a proxy or LB sits in front (idle timeouts, WS support, h2); TLS between services; managed-DB commit latency and RTT. These set the real multipliers for §8.
2. **The split of the 32 native commits before and after the first provider byte.** It needs ms-resolution timestamps per commit, or `performance_schema.events_transactions_history_long` enabled during a test call.
3. **Authenticated api.auth `validate` and `validate-api-key` latency.** Credentials are needed; only the 8-10 ms unauthenticated floor was measured.
4. **Browser → BFF upload and WS frame timing**, including Windows and macOS delayed-ACK interplay with dev Nagle. A browser-side test is needed.
5. **Whether `INSERT … ON DUPLICATE KEY UPDATE` on an unchanged `tb_user` row triggers a durable commit.** This decides whether the shadow-user projection is a read cost or a write cost.
6. **Whether the commit tail comes from other tenants of the shared dev DB or from the disk.** Production may differ completely.
7. **Why the api.magic_llm worker held no MySQL connections despite `minsize=2`.** Errors close connections in `_transaction`; recycling and idle causes are UNKNOWN.

---

## Verification (adversarial)

Verifier pass on 2026-10-20. Method: read the cited code, re-ran the Nagle A/B and the cold-versus-pooled provider probes, and ran read-only metadata queries against the dev DB (`performance_schema`, `tb_run`, `tb_execution_event` timestamps and event kinds, `tb_usage_fact` usage keys, `voice_transcript_segment` timestamps). No source file was changed.

| id | verdict | corrected severity | evidence/note |
|---|---|---|---|
| GAP-TOPOLOGY-RTT-MEASUREMENTS-01 | confirmed | medium | `UV35/config.py:513` uses `socket.socket(family=family)`, and the A/B printed `proto 0`. `main.py:574-578` routes `--reload` and `--workers` through it. The asyncio `_set_nodelay` guard needs `proto == IPPROTO_TCP` (`base_events.py:192-196`). **Re-measured A/B:** the standard path took 0.08-0.25 ms per reused request; the `bind_socket` path took 41.0-42.1 ms. `ps` shows all three dev services on `--reload`. The production launchers do not take this path: `src/serve.py` calls `uvicorn.run` with no reload or workers, and `MLLM/Dockerfile:123` passes no `--workers`. `MAC/client.py:1418,1442` runs two uncached sequential validations, so the second one reuses the connection and stalls in dev. |
| GAP-TOPOLOGY-RTT-MEASUREMENTS-02 | adjusted | high | **Core confirmed.** The engine builds the Groq client once per process (`engine.py:3792`) with httpx's default `keepalive_expiry=5.0`. STT has no prewarm: only speech and moderation are warmed (`engine.py:2043-2044`). The 16 gaps on 2026-10-20 were 10-31 s; one 2026-10-19 call had a 6 s gap. `latency_ms` includes the connect (`stt_groq_client.py:89-97`). **Re-measured cold penalty:** Groq +78 ms, OpenRouter +95 ms. **Corrections:** (a) The callbot runs with `private_transport=True` (`MLLM/src/services/llm_execution.py:285-287`), which forces `ProviderOpenAI` (`engine_openai.py:69-71`). So `isinstance(self.base, ProviderOpenRouter)` is false and **the OpenRouter usage poll never runs on the voice path**. The DB agrees: 19/19 voice runs record `usage_source=provider` with `provider_extra=null` and `provider_request_id=null`. Drop the "+180-250 ms post-stream poll" impact. (b) The client in use is `PrivateAsyncHttpClient` (`LLM/magic_llm/util/private_http.py:66-68`), not `util/http.py:101`. It still builds a new session per call, and also a new `TCPConnector` with `use_dns_cache=False`, so every call repeats DNS resolution. (c) Two cold connects at 20% and 16% >500 ms give about 1 in 3 turns, not 1 in 4. That rate holds for this network only. |
| GAP-TOPOLOGY-RTT-MEASUREMENTS-03 | confirmed | medium | `runtime_config.py:533` sets `autocommit: False`. `connection.py:208-233` runs validate, execute and then `commit`. The call order is verified: `touch_call` (`quota.py:327`), then `intake_lock` (`engine.py:2050`), then find, create plus read-back, accepted, STT, debit (`models.py:2871`), metadata, completed, then `_run_voice_turn` awaited inline. Server stats were re-read: the BFF `COMMIT` digest has p99 19.05 ms, and the `tb_user` upsert has p99 25.12 ms and a max of 1,439.5 ms. The totals are INFERENCE on measured unit costs, and nothing contradicts them. Minor issues: the list names 9 writes for "8 write commits", and the `intake_lock` line is off by one. |
| GAP-TOPOLOGY-RTT-MEASUREMENTS-04 | adjusted | critical | **The mechanism is confirmed and the magnitude is understated about 2-3x.** `tb_execution_event.created_at` is `datetime(3)`, so the statement above that it has 1 s resolution is wrong, and Open question 2 is answerable. In 19/19 voice runs, `llm_start` is committed at **revision 20**, after `graph_start`, the user_input, client and chat nodes, `node_start(NodeLLM)` and `effect_prepared`. Then comes the stream gap, then `llm_end` at rev 21 (`tb_usage_fact.recorded_at` falls about 14-30 ms before it). **Run start → `llm_start` commit: p50 874 ms (747-1,311).** That covers 19 native commits plus the snapshot, checkpoint and claim inserts, a wall cadence of about 39-69 ms per commit. It is not ~16 commits and not 270-420 ms. **Post-stream:** 12 commits (rev 21-32), and `llm_end` → `completed_at` took 1.0-2.5 s (p50 about 1.75 s), not 250-350 ms. Part of each commit interval is likely Python serialization and validation of the 50-120 KB checkpoint, not DB time; that split is UNKNOWN. Every server stat was re-confirmed: checkpoint UPDATE avg 6.29 ms, p99 34.67 ms; ROW/FULL binlog; `binlog_row_value_options=''`. Severity is raised because about 0.9 s p50 sits before the provider request on every turn. That exceeds the STT p50 (520 ms), making it the largest controllable latency in the pipeline. |
| GAP-TOPOLOGY-RTT-MEASUREMENTS-05 | adjusted | low | **Mechanism confirmed.** The segment route has `Depends(require_features("calls"))` (`route_voice_call.py:1130`). For non-root users it runs a shadow upsert, `scoped_permission` and a validation transaction, then pushes a ContextVar validator (`enforcement.py:16-56`). `validate()` runs it before every transaction (`transaction_hooks.py:30-32`, `connection.py:220,245`). The validator makes 2 `FOR SHARE` reads (`feature_flags.py:62-70`). The route projects the shadow user again (`route_voice_call.py:1144` → `_project_local_user` at `route_chat.py:325-337`). The DB shows 7/7 voice sessions with segments in the last 7 days were `root`. **Severity lowered:** about 12-20 ms per turn is under 2% of a turn now dominated by the ~0.9 s native recording. Not covered by the finding: if a membership or plan revision changes mid-call, the validator raises `FEATURE_FLAG_REVISION_CHANGED` (409) inside the turn, after partial writes. That needs its own robustness check. |
| GAP-TOPOLOGY-RTT-MEASUREMENTS-06 | adjusted | medium | **Re-read:** MySQL 8.1.0; `max_connections=151`; `Max_used_connections=152`; `Connection_errors_max_connections` **29**, up from 24 about 37 minutes earlier, so refusals are ongoing; buffer pool 128 MiB; `sync_binlog=1`; `innodb_flush_log_at_trx_commit=1`; ROW/FULL; `binlog_group_commit_sync_delay=0`; Connections 3,148,364 over 832,509 s ≈ 3.8/s. **Corrections:** (a) `thread_cache_size=9` is not a real problem. `Threads_created` is 16,172 against 3.15 M connections, a 99.5% thread-cache hit rate. (b) A turn crosses about 28 write commits before the provider (about 8 in the BFF plus about 20 in api.magic_llm, per -04), so P(at least one above p90) ≈ 95%. Production is still UNKNOWN. |

**Additional observations from this pass (not part of the verified findings):**

- Dev api.magic_llm sets `SSE_BUFFER_INTERVAL_MS=300` (default 0, `MLLM/src/util/const.py:264`). Content tokens are then flushed every 300 ms, which is more dev/prod drift that can delay the first delta. Whether it applies on the callbot route was not verified.
- Segment `completed_at` (1 s resolution) to `tb_run.started_at` spans about 0.3-1.1 s (upper bound) in most turns. That window covers BFF LLM prep, admission, moderation and the api.magic_llm auth hops. A ms-resolution BFF timestamp is needed to split it.
