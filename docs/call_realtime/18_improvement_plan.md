# Plan de mejora de las llamadas de voz (SPA, BFF, proveedores)

**Fecha:** 2026-10-21.

**Alcance:** todo lo que no es `api.magic_llm`. Incluye:
- el SPA (este repo);
- `magic-worlds-api` (BFF);
- los proveedores (Groq, ElevenLabs, Fish);
- operación, seguridad y los plazos legales.

Las optimizaciones internas de `api.magic_llm` / `magic-agents` / `magic-llm` van en un plan aparte, que no cambia ningún contrato: [`api.magic_llm/docs/performance_optimization_plan.md`](/home/andres/PycharmProjects/api.magic_llm/docs/performance_optimization_plan.md). Aquí solo aparecen como dependencias.

**Base:**
- la investigación del 2026-10-20 (`00`-`17`);
- la [auditoría de Phase 0](../audits/call-realtime-audit-2026-10-21.md);
- la [auditoría de latencia](../audits/call-latency-audit-2026-10-21.md);
- una revisión, ítem por ítem, del estado actual de R01-R87 y TA-01..TA-15 contra el código.

Las estimaciones son INFERENCE salvo que se cite una medición. Las fechas legales y de proveedores vienen de la investigación: confirmarlas antes de comprometerse.

---

## 1. Resumen

- **Punto de partida.**
  - p50 V2V estimado: **3,8-4,7 s** (carril ElevenLabs, LAN). Lo que dé el TTFT real decide en qué punto del rango cae.
  - Las colas no tienen límite: el LLM ~362 s, el STT ~65 s, el turno siguiente sin tope.
  - Del roadmap R09-R87 **no hay ningún ítem terminado**. Están parciales R11 (prompt corto), R20, R25, R32, R43, R46 (medición), R59, R71 y R72. Phase 0 (R01-R08) está casi lista, con correcciones sin commitear.
- **Objetivos:**

  | Fase | V2V p50 | V2V p95 | Cola sin audio |
  |---|---|---|---|
  | 1 | ≤ 3,4 s | ≤ 5 s | ≤ 5 s |
  | 2 | ≤ 2,5 s, junto con el plan de `api.magic_llm` | < 4 s | — |
  | 3 | ≤ 1,5 s | < 2 s | — |

  Son los mismos objetivos que 17 §9, ahora con el estado real del código.
- **Lo que cambia respecto al roadmap 17:**
  1. **Suben de prioridad:**
     - acotar todas las esperas (R18, R19, R16);
     - medir el TTFT real y forzar «sin razonamiento» en el callbot (R04, R10);
     - re-fijar el perfil ante un 409;
     - la cuenta de slots de ElevenLabs;
     - el refresh proactivo del token;
     - el lock global por proyecto;
     - la marca de procedencia de la UE (R64, 2026-12-02).
  2. **Pasa a otro plan:** todo lo de `api.magic_llm` (R38, la cola post-stream y la escritura por delta). En este plan solo queda la parte del BFF.
  3. **Bajan de prioridad:** WebRTC (R81, TA-10), los carriles por precio (R85, mientras Fish siga en Drama 3), R17 (severidad media con AEC activo) y R20 (Fish está apagado por defecto).
  4. **Siguen bloqueados:** la investigación de STT en streaming (R48, R77, TA-05, TA-08) espera el consentimiento del corpus EN/ES (R07).
- **Postura de la investigación, que se mantiene:**
  - Cascada para los personajes; nada de S2S.
  - WebSocket bien hecho antes que WebRTC.
  - Ruta **A → B**; C solo si las métricas de transporte lo piden.

---

## 2. Mejores prácticas que guían el plan

Cada práctica sale de [04 §4](04_cascaded_pipeline_sota.md), [04 §6.1](04_cascaded_pipeline_sota.md) y de los documentos 05-12. La columna «Plan» apunta a los ítems de este documento.

| # | Práctica | Estado hoy | Plan |
|---|---|---|---|
| BP1 | **Medir V2V en un solo reloj**, con el reparto por etapa y el primer turno aparte | Phase 0 casi listo; el interior de `api.magic_llm` sigue sin verse | F0 |
| BP2 | **Acotar cada espera**: deadline de TTFT, del turno, del STT y del turno siguiente; nunca un turno sin cerrar; frase de relleno hablada | Nada acotado | F1-B |
| BP3 | **Conexiones persistentes y precalentadas**: ningún TLS en el camino del turno | Solo el socket de ElevenLabs, y el proveedor lo cierra tras 20 s sin actividad. El resto de saltos (subida, Groq, `api.magic_llm`, proveedor del LLM, moderación, `api.auth`) abre una conexión en frío casi en cada turno | §4.7, F1-L1, y en el plan de `api.magic_llm` |
| BP3b | **Cada recurso de la llamada tiene dueño y se libera en `finally`**, con verificación por métricas y tests en cada ruta de fin | Las rutas principales sí liberan. Hay fugas en rutas de error del BFF y del SPA | §4.7 |
| BP4 | **No esperar frases completas**: primer chunk por cláusula | Corta solo en `. ! ?`, y +120 ms en las respuestas de una frase | F1-L2 |
| BP5 | **Solapar etapas**: nada de contabilidad en el camino crítico | ~25 transacciones en serie en el BFF | F1-L3 |
| BP6 | **Respuestas cortas y sin razonamiento** en la voz | Prompt corto ✔; tope de 1.536 tokens; razonamiento sin forzar | F1-B8 |
| BP7 | **Endpointing en cadena**: VAD aprendido → modelo de fin de turno → tope | Silencio RMS fijo de 552 ms | F2-T1 |
| BP8 | **Barge-in recuperable**: pausar, confirmar, reanudar ante una falsa alarma | Inmediato e irreversible | F2-T2 |
| BP9 | **Una sola primitiva de cancelación**, más un **registro de lo oído** | Varios mecanismos; el registro existe pero va por frase entera en ElevenLabs | F2-T3, F3 |
| BP10 | **Streaming en cada etapa**: subida, STT, reproducción PCM | Solo la bajada | F2-S, F3 |
| BP11 | **Primer turno rápido**: saludo o ringback, sockets calientes | Arranque en serie, sin saludo | F1-E1 |
| BP12 | **Despliegue server-first** y protocolo tolerante | Ya es regla (B1) | Todas las fases |
| BP13 | **Evals con presupuesto de latencia en CI** e inyección de fallos | No hay | F1-Q, F2-Q |

---

## 3. Fase 0: cerrar la medición (días)

Sin esto, ningún ahorro de este plan se puede comprobar.

| ID | Acción | Por qué | Repos | Hecho cuando |
|---|---|---|---|---|
| F0-1 | Commitear las correcciones B1-B2 y M1-M5. Hacer `git add` del script de migración `scripts/migrations/20261020_voice_turn_metrics.py`. Aplicar la migración en un entorno real | Nada de esto se ha ejecutado contra un MySQL real | BFF, SPA | Filas reales en `voice_turn_metrics` |
| F0-2 | **El BFF primero, luego el SPA** (regla dura, [phase0 README](phase0/README.md)) | El BFF anterior es `extra="forbid"` | ops | El SPA se publica solo cuando `voice_ready.protocol` se ve en producción |
| F0-3 | **Dimensiones que faltan en la fila:** modelo y perfil LLM (alias + revisión); build del SPA y hang-over (en `voice_start` o en el frame del cliente, server-first); `owned_client`; una bandera de conexión fría o caliente por etapa; `config_fingerprint` completo (02 §5) | Sin ellas no se puede atribuir el efecto de LAT-07, LAT-11 ni del pooling | BFF, SPA | Columnas pobladas en el 100 % de las filas |
| F0-4 | **Marcas nuevas:** espera del supersede (`engine.py:2126`), débito hecho, truncado resuelto (`:2397`), recepción del barge-in → cancelación hecha, refresco del catálogo, commit de admisión, fallo de caché de auth | Hoy quedan escondidas en `claim_ms` y `pre_dispatch_ms` | BFF | Marcas presentes; las etiquetas `claim_ms` y `pre_dispatch_ms` corregidas en 02 |
| F0-5 | **Corregir las marcas mal colocadas:** `first_audio_sent` no debe marcarse en envíos descartados; `tts_first_audio_ms` separado de la espera de `begin_turn` y de la moderación; la latencia de salida leída del contexto de **reproducción** | §7 de la auditoría de latencia | BFF, SPA | Tests de las marcas |
| F0-6 | **Filas para los segmentos rechazados antes de `begin_turn`** (auth, flags, hash, capacidad), o un contador | Si no, G0 («cada segmento tiene una fila») no se puede comprobar | BFF | Contador por motivo |
| F0-7 | **Arreglar las consultas de 02 §9:** percentiles de `client_v2v_ms` por carril; cobertura medida sobre `client_outcome IS NOT NULL` y solo en llamadas v2; reparto de etapas dentro de la cohorte p95 | Hoy no calculan lo que dicen | docs | Consultas probadas contra datos |
| F0-8 | **Unificar la definición de G0** (16 §5.2, 17 §9 y phase0) en una sola, sin mezclar relojes | Hay tres definiciones distintas | docs | Una sola definición |
| F0-9 | **Medir el TTFT real del proveedor.** Depende del plan de `api.magic_llm` (sus intervalos internos). Mientras tanto, usar `llm_ttft_ms` (filas 7+8+9) por modelo | Es la mayor incertidumbre: decide si el p50 es 3,8 o 4,7 s | BFF + `api.magic_llm` | TTFT por modelo con p50 y p95 |

**Salida (G0):** cobertura del frame del cliente ≥ 90 % de los turnos completados o interrumpidos en llamadas v2, durante dos semanas, con modelo y perfil en cada fila.

---

## 4. Fase 1: victorias rápidas y límites (días; sin cambio de proveedor ni de `api.magic_llm`)

### 4.1 Latencia (p50)

| ID | Acción | Práctica | Ahorro estimado | Repos | Contrato |
|---|---|---|---|---|---|
| F1-L1 | **Conexiones calientes en el BFF:** <ul><li>Groq con keep-alive de 120 s y conexión abierta al recibir el segmento, en paralelo con auth e intake (`stt_groq_client.py:139-145`, `:548-556`)</li><li>un `httpx.AsyncClient` compartido hacia `api.magic_llm`, pasado al executor (`engine.py:4185`, `llm_execution_transport.py:277`)</li><li>uvicorn `timeout_keep_alive` ≥ 75 s para las subidas (`serve.py:28-33`)</li><li>CORS `max_age` 7200</li></ul> | BP3 | −80-165 ms; quita la mayoría de los cuelgues de 0,5-1,5 s. **Detalle y validación en §4.7** | BFF, ops | No |
| F1-L2 | **`SentenceBuffer`:** <ul><li>soltar al recibir `finish_reason`, o tras una pausa de 30-40 ms cuando el buffer termina en `[.!?]`</li><li>cortar la primera unidad en `, ; —` a partir de unos 30 caracteres</li><li>quitar `no` y `am` de las abreviaturas</li><li>aceptar como final `…`, `»` y `。！？`</li></ul> | BP4 | −100-300 ms; −120 ms en las respuestas de una frase | BFF | No |
| F1-L3 | **Contabilidad del BFF fuera del camino:** <ul><li>soltar el `intake_lock` o el `billing_lock` tras el STT, y hacer el débito en paralelo con la preparación del LLM</li><li>quitar `find_admission` en el callbot (siempre vuelve vacío)</li><li>congelar el catálogo en el preflight (el perfil ya está fijado)</li><li>meter `started` dentro de la transacción de admisión</li><li>enviar `transcript_final` antes de admitir</li><li>caché de auth que se renueve antes de caducar</li></ul> | BP5 | −50-120 ms; quita los picos de catálogo (+30-300 ms) | BFF | No |
| F1-L4 | **Subida:** <ul><li>refrescar el token de forma proactiva al ~80 % del TTL, o en `speech_start`</li><li>precalentar la conexión en `speech_start` (un `fetch` HEAD o `OPTIONS` con el mismo origen)</li></ul> | BP3 | 0 en LAN; −100-400 ms en WAN o móvil; quita los +250-600 ms del refresh en ~2/3 de las llamadas. **Detalle en §4.7** | SPA | No |
| F1-L5 | **Precalentar al empezar la llamada:** lanzar en paralelo el consentimiento, `/llm/features/callbot/resolve` y la apertura del WS (FE-L13) | BP11 | −1-2 RTT en el primer turno | SPA | No |

### 4.2 Límites y robustez (colas)

| ID | Acción | Práctica | Efecto | Repos | Contrato |
|---|---|---|---|---|---|
| F1-B1 | **Watchdog de pared del LLM en el BFF:** <ul><li>TTFT de 3-4 s → frase de espera en personaje</li><li>turno de 10-15 s → cancelar el request a `api.magic_llm` y cerrar el turno con una línea de recuperación</li></ul> `LLM_TOTAL_TIMEOUT` hoy no hace nada (`magic_llm_config.py:87-124`): sustituirlo por un deadline real | BP2 | ~362 s → ≤ 15 s; silencio > 4 s → relleno | BFF | No |
| F1-B2 | **STT:** deadline de 3-5 s más un reintento con hedging; el `intake_lock` solo para ordenar, no alrededor del HTTP; contabilizar los fallos | BP2 | ~65 s → ~5 s; los segmentos siguientes ya no se bloquean | BFF | No |
| F1-B3 | **Turno siguiente:** un tope general (por ejemplo 1,5 s) a `previous.finished` (`engine.py:2130`); una sola espera de truncado; persistir el turno anterior después de admitir el nuevo | BP2 | quita 0,7-6,4 s (dev) y el peor caso de 9+ s | BFF | No |
| F1-B4 | **Re-fijar el perfil ante un 409** `PROFILE_REVISION_CHANGED`: resolver una vez y seguir; nunca fallar el resto de la llamada (`callbot_execution.py:131-133`) | BP2 | quita un modo de fallo de llamada entera | BFF | No |
| F1-B5 | **Slots de ElevenLabs:** contar solo los contextos abiertos; liberar en la cancelación; no gastar la reconexión en una espera de slot (`tts_multicontext_ws.py:73-77, 343, 978`) | BP2 | quita +3,3-3,7 s y el corte de voz tras barge-ins seguidos | BFF | No |
| F1-B6 | **Tolerar `total_tokens` ≠ prompt + completion** en el BFF (`llm_completion_metadata.py:18-26`). `api.magic_llm` reenvía el total del proveedor (`usage_extractor.py:140-143`). Guardarlo tal cual, o recalcularlo | — | quita fallos `RESULT_INVALID` espurios, que hoy reembolsan el turno | BFF | No (cambia solo la validación del BFF) |
| F1-B7 | **iOS:** bajar `MANAGED_STALL_MS` de 2 s a ~600 ms (`voicePlaybackBuffer.ts:60`) | BP2 | −1,4 s de cola en Safari | SPA | No |
| F1-B8 | **Callbot sin razonamiento, forzado:** el feature `callbot` exige `reasoning_effort: none`, o rechaza los perfiles con razonamiento; el selector por llamada solo ofrece perfiles sin razonamiento (`llm_features.py:70-75`). Tope de salida de 1.536 → ~200-300 tokens | BP6 | −0,5-1,3 s si hoy razona (UNKNOWN; F0-9 lo resuelve); menos audio sin oír | BFF | No |
| F1-B9 | **Subida sin deadline:** watchdog en el cliente, que reenvía con la misma clave si no llega `voice_segment_ack` en ~2 s; tratar el 429 | BP2 | no se pierden turnos en conexiones medio abiertas | SPA | No |
| F1-B10 | **Cancelación en Fish fuera del bucle de recepción**, y el `touch_call` del `voice_ping` como tarea (BE-A12) | BP9 | el WS no se bloquea hasta 3 s | BFF | No |
| F1-B11 | **Tolerar los frames de replay** de `api.magic_llm` (`replayed`, `status`) cuando se reintenta con la misma `Idempotency-Key`. Hoy los rechaza el allowlist de `llm_completion_metadata.py` (D8 del plan de `api.magic_llm`) | BP2 | quita un fallo latente en los reintentos | BFF | No |

### 4.3 Escala y event loop

| ID | Acción | Por qué | Repos |
|---|---|---|---|
| F1-S1 | **Lock por proyecto:** convertirlo en lock compartido, o por usuario y feature, y quitarlo de `find_admission`, `started` y `renew` (`llm_profile_models.py:104-109`) | Serializa **todo el LLM de la plataforma**, chat de texto incluido. Quien espera ocupa conexiones de un pool de 10 sin timeout de adquisición | BFF |
| F1-S2 | **Validación incremental del texto hablado:** solo el sufijo nuevo, con una ventana de solapamiento (`llm_turn_runner.py:183-189`) | O(n²) por delta: 1,8 s de CPU por cada respuesta de 7,9k caracteres | BFF |
| F1-S3 | **VAD del servidor y construcción de clientes fuera del event loop** | Bloquea a todas las llamadas del proceso | BFF |
| F1-S4 | **Facturación del bucle de envío y `FOR UPDATE` por frase de Fish → tarea de fondo ordenada;** para Fish, reservar en el lease | Huecos de 10-40 ms tras el chunk 1; serializa todas las llamadas Fish | BFF |

### 4.4 Experiencia

| ID | Acción | Práctica |
|---|---|---|
| F1-E1 | **Saludo o ringback** pregrabado por personaje mientras se calientan los sockets (R30) | BP11 |
| F1-E2 | **Guardia de eco** cuando no hay AEC verificado (R22). Resolver antes el conflicto con R23 (respuestas cortas durante la reproducción) | BP8 |
| F1-E3 | **Interrupciones visibles para el LLM:** marcar en el historial el mensaje que se cortó (R24) | BP9 |
| F1-E4 | **Revisar el crash del ledger de Fish con las etiquetas activadas por defecto** desde `1faf8a1`, y hacer una prueba de escucha (R71) | — |

### 4.5 Calidad y pruebas

| ID | Acción |
|---|---|
| F1-Q1 | Tests con inyección de fallos en CI: LLM sin primer token (362 s → deadline), STT colgado, 409 de perfil, agotamiento de slots de ElevenLabs, subida sin ack |
| F1-Q2 | Presupuesto de latencia en CI: un turno completo con proveedores falsos, con umbrales por etapa (BP13) |

### 4.6 Seguridad y legal (con fecha)

| ID | Acción | Fecha (según la investigación) |
|---|---|---|
| F1-G1 | **Procedencia y marcado del audio sintético**, art. 50(2) de la UE (R64) | **2026-12-02** |
| F1-G2 | **Fish Drama 3:** decidir precio o modelo (R32). El default `drama-3` pasa a costar más que ElevenLabs | **2026-11-12** |
| F1-G3 | Listas firmadas, números de crisis y cribado de autolesión en el transcript (R33, R34) | Antes del lanzamiento |
| F1-G4 | Moderación en dos etapas (R57): la etapa A, local, fuera del camino del primer audio. Con la configuración por defecto (REQUIRED sin clasificador) **no sale audio** (C04). La etapa A **no** debe pasar por `api.magic_llm` | Antes del lanzamiento |
| F1-G5 | Revisar si algún perfil de callbot usa modelos que se retiran (GPT-4o y 4.1: 2027-01-14) y la actualización de la política de uso de Anthropic | 2026-11-12 / 2027-01-14 |

### 4.7 Conexiones durante la llamada: calientes de principio a fin, liberadas al colgar

Auditoría del 2026-10-22 sobre el código actual. El SPA se leyó con los cambios de Phase 0 sin commitear. Los paths del BFF son relativos a `magic-worlds-api/src/`.

**Reglas:**
1. **Conectar al empezar la llamada**, en paralelo con `voice_ready`, nunca en el primer turno.
2. **Ninguna conexión fría dentro de un turno** desde el segundo turno.
   - El keep-alive de cada salto tiene que superar la pausa máxima entre turnos (el idle timeout de la llamada es de 120 s).
   - Donde el otro extremo corte antes, mantener la conexión activa o reabrirla en la primera señal del turno: `speech_start` en el SPA, `voice_segment_meta` en el BFF. Hoy ese frame no se usa para nada (`route_voice_call.py:1652-1656`) y llega antes que la subida.
3. **El keep-alive del cliente va algo por debajo del idle timeout del servidor** (por ejemplo, servidor 130 s y cliente 120 s). Si no, el cliente reutiliza una conexión que el servidor acaba de cerrar. Es la causa probable del reenvío de 300 ms del SPA (`useVoiceCallController.ts:636-644`). Con los proveedores externos, el timeout se mide, no se supone.
4. **Cada recurso tiene un dueño** (el proceso o la llamada) y **se cierra en `finally`.** Nada depende del recolector de basura.
5. **Se verifica con datos:** una bandera de conexión fría por etapa y turno (F0-3), gauges de recursos por llamada y un test por cada ruta de fin.

#### 4.7.1 Conexiones por salto: estado actual y acción

| Salto | Hoy (FACT) | Riesgo en mitad de la llamada | Acción |
|---|---|---|---|
| SPA → BFF: subida HTTP del segmento | <ul><li>Cross-origin y con preflight CORS (`Authorization`, `Idempotency-Key`, `X-MW-Voice-Contract`, `X-Workspace-Id`)</li><li>`max_age` por defecto: 600 s</li><li>uvicorn con keep-alive de 5 s (`serve.py:28-33`)</li><li>sin precalentar (`index.html` solo hace preconnect a Google Fonts)</li><li>refresh del token solo tras un 401</li><li>la subida va sin credenciales y el refresh con ellas, así que probablemente usan pools de sockets distintos</li><li>el POST queda retenido todo el turno (`useVoiceCallController.ts:658-659`)</li></ul> | <ul><li>Con pausas > 5 s, TCP nuevo (y TLS en producción) **casi en cada turno**</li><li>preflight en la primera subida de cada llamada</li><li>un segundo segmento durante el turno abre otra conexión en frío (HTTP/1.1)</li><li>con el token caducado: subida perdida + 401 + refresh + reenvío en el mismo turno</li></ul> | <ul><li>uvicorn `timeout_keep_alive` ≈ 130 s, y el proxy o el balanceador con un idle mayor</li><li>CORS `max_age` 7200</li><li>precalentar en `speech_start` con una petición barata al mismo origen y **con el mismo modo de credenciales que la subida**, para que caiga en el mismo pool</li><li>refresh proactivo al ~80 % del TTL (F1-L4)</li><li>a medio plazo, quitar el CORS sirviendo la API bajo el mismo origen, o subir por el WS (F2-S1), que elimina este salto entero</li></ul> |
| SPA ↔ BFF: WS de voz | <ul><li>Un handshake por llamada, al empezar ✔</li><li>`voice_ping` cada 25 s; se da por muerto tras 50 s sin frames (`voiceSocket.ts:24-25, 628-642`)</li><li>resume con una ventana de 15 s</li></ul> | La detección (50-75 s) es más lenta que la gracia de resume del servidor (20 s), así que el resume llega tarde y la llamada se pierde. Con la pestaña oculta, el throttling de timers puede estirar el ping (INFERENCE) | Ping cada ~10 s y muerte a los ≤ 15 s, por debajo de la gracia. Liveness basada en cualquier frame entrante. Valorar que sea el servidor quien hace el ping (F2-O1) |
| BFF → Groq STT | <ul><li>Un cliente por proceso, creado en la primera transcripción (`voice_orchestration/stt_groq_client.py:139-145`)</li><li>sin `Limits`, así que httpx usa un keep-alive de 5 s</li><li>sin precalentar y sin reintento</li></ul> | Con pausas de 10-120 s, **frío en prácticamente todos los turnos**, y es el primer salto de red del turno | <ul><li>`httpx.Limits(keepalive_expiry≈120 s)`, por debajo del idle de Groq (hay que medirlo)</li><li>abrir o validar la conexión en `voice_segment_meta`, en paralelo con la subida</li><li>reintento con hedging solo ante conexiones obsoletas (F1-B2)</li></ul> |
| BFF → `api.magic_llm` | <ul><li>Un `httpx.AsyncClient` **nuevo por petición** (`services/llm_execution_transport.py:277-278`); el ejecutor del callbot recibe `None` (`voice_orchestration/engine.py:4186-4187`)</li><li>la caché del catálogo dura 60 s; al caducar, otro cliente nuevo y dos GET dentro del turno (`voice_orchestration/callbot_execution.py:70, 85-99`)</li><li>el preflight de `voice_start` solo llena esa caché, no abre conexión</li></ul> | Frío **en cada turno**, y en serie con el handshake del proveedor de abajo | <ul><li>Un cliente compartido por proceso con keep-alive ≈ 120 s, pasado al ejecutor</li><li>`GET /health` con ese cliente en `voice_segment_meta` si lleva más de N s sin uso</li><li>catálogo congelado durante la llamada (F1-L3) o refrescado en segundo plano antes de caducar</li></ul> |
| `api.magic_llm` → proveedor del LLM | Una `aiohttp.ClientSession` **por petición** (`magic_llm/util/http.py:100-102`); la caché de DNS muere con ella | DNS + TCP + TLS **en cada turno**. El BFF no puede calentarlo sin cambiar el contrato | Plan de `api.magic_llm`, **OPT-8**: pool por origen con keep-alive ≥ 120 s y **pre-conexión en paralelo con la grabación previa**. Es interno y no cambia el contrato |
| BFF → ElevenLabs (WS multi-context) | <ul><li>Se abre en `start_call`, junto con `voice_ready` ✔ (`voice_orchestration/engine.py:912`)</li><li>`prewarm` en cada subida, en paralelo con el STT ✔</li><li>**el proveedor cierra tras 20 s de inactividad** (`speech/providers/elevenlabs/tts_multicontext_ws.py:82`), y entre turnos no se envía nada</li><li>solo hay 1 reconexión por llamada</li></ul> | <ul><li>Si `prewarm` ve el socket aún abierto y el cierre de los 20 s llega durante `begin_turn`, el handshake cae en el camino crítico o se gasta la única reconexión. Sin esa reconexión, el resto de la llamada es solo texto</li><li>una espera de slot ≥ 3 s también fuerza la reconexión</li></ul> | <ul><li>En `prewarm`, si al socket le quedan < 3-5 s para los 20 s, **reemplazarlo** (abrir el nuevo antes de que caiga el viejo) en vez de fiarse</li><li>un cierre por inactividad nunca gasta la reconexión</li><li>adelantar el `prewarm` a `voice_segment_meta`</li><li>evaluar un contexto en reposo con `keep_alive` cada ~15 s mientras la llamada esté viva, si ElevenLabs no lo cobra (hay que verificarlo)</li><li>corregir los comentarios que dicen 180 s (`engine.py:682-683`, `config.py:427`, `test_call_path_real_adapter.py:231-233`); el valor real es 20 s</li></ul> |
| BFF → Fish (WS) | <ul><li>Un WS **por turno**, por diseño (`speech/providers/fish_audio/streaming.py:166-224`)</li><li>antes espera el lease `FOR UPDATE` (sondeo cada 100 ms, hasta 5 s), y cada frase espera un `extend` `FOR UPDATE`</li></ul> | Frío en cada turno, detrás de bloqueos de base de datos que serializan todas las llamadas Fish | <ul><li>Abrir el WS en `voice_segment_meta`, en paralelo con el STT</li><li>reservar el lease por llamada (F1-S4)</li><li>Fish está apagado por defecto: prioridad baja hasta D1</li></ul> |
| BFF → clasificador de moderación | <ul><li>Un cliente por proceso con keep-alive de 5 s (`speech/moderation_transport.py:320-327`)</li><li>presupuesto de **300 ms** por frase, que también cubre las consultas de plan y de hash (`speech/moderation.py:73`)</li><li>si falla, la frase **no se dice**</li><li>`warm_soon` no abre conexión cuando el plan ya está en caché</li></ul> | La primera frase de cada turno llega en frío y puede pasarse del presupuesto: **silencio**, no solo retraso. Además, un timeout descarta la conexión y la siguiente frase también llega en frío | <ul><li>Keep-alive ≈ 120 s</li><li>`warm_soon` tiene que abrir o validar la conexión de verdad si lleva > 5 s sin uso</li><li>que un timeout no descarte la conexión, o que la reabra en segundo plano</li><li>F1-G4: la etapa A local quita este salto del camino del primer audio</li></ul> |
| BFF → `api.auth` | <ul><li>Un cliente por proceso con keep-alive de 5 s; la caché de validación dura 30 s</li><li>cada subida valida el token</li></ul> | Tras una pausa > 30 s, una validación en frío **antes de leer el formulario**, que además retrasa el `prewarm` de ElevenLabs | <ul><li>Keep-alive ≈ 120 s</li><li>durante una llamada viva, renovar la validación antes de que caduque (F1-L3)</li><li>que el `prewarm` dependa de `voice_segment_meta`, que ya llega autenticado por el WS</li></ul> |
| BFF → MySQL | Pool por proceso: `minsize=1`, `maxsize=10`, sin `pool_recycle` (`database/mysql/connection.py:152`) | Con concurrencia, conexiones nuevas en mitad del turno. Sin `recycle`, pueden quedar conexiones caducadas por `wait_timeout` | `minsize` según las llamadas concurrentes esperadas, `pool_recycle` < `wait_timeout` y pre-ping. Prioridad baja |

#### 4.7.2 Liberación al colgar: fugas encontradas

| ID | Dónde | Hallazgo (FACT salvo que se indique) | Corrección |
|---|---|---|---|
| R-1 | BFF `voice_orchestration/engine.py:1164-1200` (`end_call`) | `_close_speech_call`, `release_call` (la cuota) y `end_session` van en el `try`, no en el `finally`. Si cancelar o drenar un turno lanza una excepción, quedan vivos el socket de ElevenLabs, la tarea `_watch` y el permiso `ttd_session`. Por la misma razón, la cuota y la sesión en la base de datos pueden quedarse sin cerrar (INFERENCE). `_forget_call` (`:1923-1932`) no cierra nada de eso | Cada paso del cierre en su propio bloque protegido, dentro del `finally`, siempre en el mismo orden: cancelar turnos → cerrar el habla → liberar la cuota → cerrar la sesión → olvidar la llamada |
| R-2 | BFF `engine.py:1147`, `:1875-1887` | Si falla `get_session`, `end_call` sale antes de limpiar nada. El watchdog captura la excepción fuera del bucle, así que el primer fallo lo mata para siempre: llamada zombi con el permiso retenido hasta reiniciar el proceso | `try` por iteración en el watchdog. Si falla la lectura de la sesión, cerrar igualmente el runtime local |
| R-3 | BFF `engine.py:1148-1153`, `:1882-1883` | Con `not_found` y un runtime vivo, sale sin limpiar, y el watchdog también termina: otra zombi (caso límite) | Si existe runtime, se cierra siempre |
| R-4 | BFF `tts_multicontext_ws.py:879-907` | Tras `_fail_leg` (llamada solo con texto), el socket se cierra pero **el permiso y `_watch` se quedan** hasta el fin de la llamada (máximo 600 s). El pool es compartido, así que puede dejar sin hueco a llamadas nuevas (el `acquire` de `open_call` tiene un timeout de 3 s) | Liberar el permiso y parar `_watch` al fallar la pierna |
| R-5 | BFF `engine.py:963-968`, `route_voice_call.py:1728-1729` | Si `start_call` falla después de registrar la llamada, la ruta no tiene el id de sesión y solo el idle timeout (120 s) la termina (INFERENCE) | Limpiar el registro en el propio `start_call` |
| R-6 | BFF apagado (`main.py:1372-1379`) | Las llamadas se cierran una a una, con 2 s de drenaje más hasta 10 s de cierre del WS cada una. Las tareas `_warming` de moderación no se cancelan y las `_resolving` no se esperan (INFERENCE) | Cerrar las llamadas en paralelo con `close_timeout` acotado (2-3 s) y cancelar y esperar las tareas de moderación |
| R-7 | `magic-llm/magic_llm/engine/base_chat.py:303` | Sin attempt control, el generador interno del stream no recibe `aclose()`, así que la sesión aiohttp se cierra solo por GC («Unclosed client session»; INFERENCE) | Plan de `api.magic_llm`, OPT-8 (cierre determinista) |
| S-1 | SPA `useVoiceCallController.ts:943-947, 955-959, 1256-1262` | Tras `voice_ended`, un error fatal o `auth:expired`, **`voiceSessionIdRef` no se limpia.** Al desmontar se reenvía un `voice-end` HTTP de una llamada ya cerrada, incluso con el token caducado (fijado en `useVoiceCallController.test.ts:702-711`). Al «llamar otra vez», los segmentos capturados mientras arranca la nueva llamada se suben a la sesión vieja y esas palabras se pierden (INFERENCE) | **Hecho el 2026-10-22, sin commit:** `stopLocalResources` olvida la sesión de voz. Se corrigieron los dos tests que fijaban el `voice-end` duplicado y hay tests nuevos (incluido el de «llamar otra vez») |
| S-2 | SPA `CallScreen.tsx:101, 104`; `useVoiceCallSocket.ts:87, 95, 156-160`; `useVoiceCallController.ts:811-815` | Si se pierde la auth sin evento `auth:expired`, el socket se cierra en silencio y el controlador ignora el estado `closed`. El micrófono, el `AudioContext`, el wake lock, el temporizador y las subidas siguen activos | **Hecho el 2026-10-22, sin commit:** si `authKey` pasa a `null` con la llamada activa, el controlador la termina con un error `auth`, igual que con `auth:expired` |
| S-3 | SPA `voiceSocket.ts:419` | Si el servidor cierra con 1000 sin `voice_ended`, el controlador sigue «en llamada» (riesgo bajo hoy) | **Hecho el 2026-10-22, sin commit:** `VoiceSocket` emite un `voice_error` fatal (`VOICE_CONNECTION_LOST`). El cierre limpio que sigue a su propio `voice_end` sigue en silencio |
| S-4 | SPA `useVoiceCallController.ts:1273-1283` | `pagehide` nunca llama a `stopLocalResources`. Si la página entra en el bfcache sale antes de tiempo, y como no hay `pageshow`, al volver se muestra una llamada viva con el socket y la captura muertos | **Hecho el 2026-10-22, sin commit:** `pagehide` cuelga como el botón Colgar (`voice_end`, end HTTP con keepalive, liberación local y estado `ended`), también al entrar en el bfcache. No hace falta `pageshow` |
| S-5 | SPA `voicePlaybackBuffer.ts:250, 618-664` | Al cancelar no hay `endOfStream` ni `audio.load()`. Si el `turn_id` no coincide, `cancel` sale sin hacer nada. `dispose` lo arregla al desmontar | Hacer `cancel` incondicional en el fin de llamada, y añadir `load()` tras quitar el `src` |
| S-6 | SPA `voiceSocket.ts:338` | `openSocket` quita los handlers del socket anterior sin cerrarlo, así que puede quedar un socket huérfano (INFERENCE, bajo) | Cerrar el anterior antes de abrir |
| S-7 | SPA `useMicrophoneCapture.ts:244-256`, worklet | Nunca se llama a `port.close()` y el `GainNode` no se desconecta; dependen del cierre del contexto (bajo) | Cerrar el puerto y desconectar el nodo en `teardown` |

Prioridad:
- **Fase 1:** las filas de la tabla 4.7.1 que hoy pagan frío en cada turno (subida, Groq, `api.magic_llm`, moderación, `api.auth`, y la carrera de ElevenLabs), más R-1 a R-4 y S-1 a S-4.
- **Fase 2:** el resto, junto con F2-S1 y F2-O1.

Ahorro estimado (INFERENCE): **−80-250 ms por turno** según la red. Además desaparecen los silencios por moderación fría y el paso a solo texto por la reconexión de ElevenLabs.

#### 4.7.3 Validación

| Qué | Cómo | Criterio |
|---|---|---|
| Conexión fría por etapa | <ul><li>BFF, httpx: extensión `trace` (eventos `connection.connect_tcp` y `start_tls`)</li><li>`api.magic_llm`: `aiohttp.TraceConfig` (`on_connection_create_*` frente a `on_connection_reuseconn`)</li><li>WS: marca de handshake</li><li>SPA: Resource Timing (`connectStart`/`connectEnd`; necesita `Timing-Allow-Origin`)</li></ul> Una columna por etapa en `voice_turn_metrics` (F0-3) | **0 % de turnos ≥ 2 con conexión fría en el camino crítico**, salvo reconexiones tras un fallo, que se marcan aparte. En el primer turno, solo se permiten handshakes hechos antes de `voice_ready` |
| Recursos por llamada (BFF) | Gauges por proceso: llamadas vivas, sockets de ElevenLabs, permisos `ttd_session`, sockets Fish, tareas `_watch` y de la llamada, conexiones prestadas del pool MySQL. Alerta ante cualquier aviso «Unclosed client session» o «Task was destroyed» | Tras cada fin de llamada, todos los gauges vuelven a su valor anterior en ≤ 5 s, o ≤ 25 s en la ruta con gracia |
| Tests de liberación (BFF) | Un test por ruta de fin: `voice_end` por WS y por HTTP, navegación, cierre 1000, cierre ≠ 1000 tras la gracia, idle, duración máxima, cuota, créditos, pausa de seguridad, supersede, apagado, excepción dentro de `end_call`, fallo de `get_session` y fallo de `start_call`. En cada uno se comprueba `close_call`, la liberación del permiso, las tareas canceladas, la cuota liberada y la sesión cerrada | Hoy ninguna de esas rutas comprueba `close_call` (solo el corte por gasto y el apagado con un fake) |
| Tests de liberación (SPA) | <ul><li>Tests con la captura y la reproducción **reales**, sobre fakes de las APIs del navegador (hoy todo está mockeado en `useVoiceCallController.test.ts:49-61`)</li><li>se comprueba: pistas paradas, `AudioContext` cerrado, puerto cerrado, `src` vacío y URL revocada, `vi.getTimerCount() === 0`, subidas abortadas, WS cerrado y wake lock liberado</li><li>rutas: colgar, desmontar, E, F, T, cambio de workspace, A, A0, X, `pagehide` y bfcache</li></ul> | Todos los recursos a cero en cada ruta |
| Soak | 1 h de llamadas con pausas de 5, 19, 21, 60 y 119 s entre turnos (los 19 y 21 s cruzan la inactividad de ElevenLabs), más cortes de red simulados | Tasa de conexión fría por etapa dentro del criterio; ningún gauge crece; ninguna llamada pasa a solo texto sin un fallo real |

**Resultado esperado de la Fase 1, solo con BFF y SPA:** p50 ≈ **3,4 s** en el escenario de TTFT de 600 ms (escenario A; ≈ 3,5-4,2 s con un TTFT de 1,5 s, escenario B, según F1-B8). Ningún silencio de más de ~5 s sin audio. Turnos rotos por el 409, por `RESULT_INVALID` y por los slots: 0.

---

## 5. Fase 2: semanas

| ID | Acción | Práctica | Ahorro | Repos | Contrato SPA↔BFF |
|---|---|---|---|---|---|
| F2-T1 | **Endpointing en cadena:** pausa candidata de 250-300 ms, luego un modelo de fin de turno (LiveKit v1-mini o Smart Turn fp32; mejor v1-mini en español), luego un tope de ~2,5 s. El servidor ya fusiona los turnos cortados (R41) | BP7 | −250 ms | SPA, BFF | Aditivo (server-first) |
| F2-T2 | **VAD aprendido** (Silero) en el cliente y en el servidor, y **barge-in en dos fases**: bajar volumen o pausar, confirmar y reanudar, con manejo de backchannels en inglés y español (R40, R42) | BP7, BP8 | menos falsos barge-ins (objetivo ~−50 %) | SPA, BFF | Aditivo |
| F2-T3 | **Truncado por palabra en ElevenLabs** con alineación y guardia de deriva (R43) | BP9 | historial fiel a lo que se oyó | BFF | No |
| F2-S1 | **Subida en streaming por el WS existente:** frames PCM binarios desde `speech_start`; el POST queda como respaldo (R47). Requiere el protocolo v2 server-first | BP10 | −65-150 ms en LAN; hasta −700 ms en móvil; requisito del STT en streaming | SPA, BFF | **Sí, aditivo**, negociado con `voice_ready.protocol` |
| F2-S2 | **Bajada binaria** con deadline de envío, y **reproductor PCM con AudioWorklet** con `played_ms` exacto al sample. MSE queda de respaldo (R50, R51) | BP10 | quita el stall de 2 s de MMS; base para el truncado por palabra y para facturar lo oído | SPA, BFF | Sí, aditivo |
| F2-S3 | **Investigación de STT en streaming** (Soniox, Deepgram Flux, Scribe v2 Realtime), con Groq por lotes como respaldo, sobre audio propio de roleplay en inglés y español (R48). **Bloqueada por R07** (consentimiento del corpus) | BP10 | −250-550 ms cuando se adopte | BFF | No |
| F2-L1 | **Elegir el modelo de voz por TTFAT** (R44), con los datos de F0-9 | BP6 | −90 ms (A) a −500-900 ms (B) | BFF, producto | No |
| F2-L2 | **Prefijo de prompt estable y cacheable:** el lorebook y el codex fuera del bloque de sistema por turno (R46; ya se mide `llm_cached_tokens`) | BP6 | menos TTFT por prefill | BFF | No |
| F2-O1 | **Liveness del socket y reanudación** (50-75 s → ~10-15 s), **drenaje en los despliegues** (R29, R52, R56) | BP2 | menos llamadas caídas | SPA, BFF | Aditivo |
| F2-O2 | **Alertas reales** (R03): la parte que no depende de OD12 ya se puede publicar | BP1 | — | BFF, ops | No |
| F2-Q | **Arnés de reproducción en inglés y español** (R07) y **loopback acústico sintético semanal** (12 §6) | BP13 | — | todos | No |

**Resultado esperado de la Fase 2, junto con el plan de `api.magic_llm`:** p50 ≈ **2,3-2,7 s**, p95 < 4 s.

---

## 6. Fase 3: un trimestre (arquitectura B)

1. **STT en streaming como fuente del transcript**, con sus señales de turno (R77).
2. **Especulación retenida:** el LLM arranca con una pausa candidata y su salida se retiene. **Solo después de** la ruta rápida de `api.magic_llm`, porque hoy cada ejecución descartada cuesta 21 transacciones (R78).
3. **Adaptador de engine y máquina de estados del turno** (R76, TA-07), con eventos con la forma de OpenAI Realtime.
4. **Escalado horizontal:** sacar el estado de la llamada del proceso, después de F1-S1 (R79, R80).
5. **WebRTC** solo si saltan los disparadores TR-01, medidos sobre B (R81, TA-10).

Objetivo: **≤ 1,5 s p50, < 2 s p95**. Para bajar de 1 s hace falta co-ubicación y streaming directo (TA-11).

---

## 7. Dependencias con el plan de `api.magic_llm`

| Necesidad del BFF | Lo que aporta el plan de `api.magic_llm` | Sin él |
|---|---|---|
| Medir el TTFT real (F0-9) | Tiempos internos por etapa, fuera del stream por defecto | Solo `llm_ttft_ms` agregado |
| p50 ≤ 2,5 s | Grabación previa al proveedor de 21 → 2 transacciones (−650-850 ms); sesiones del proveedor en pool (−80 ms); escritura por delta eliminada | Techo de ~3,4 s |
| Cerrar antes el turno y desbloquear el siguiente (F1-B3) | Cola post-stream de 1,0-2,5 s → ~0,3-0,5 s (commits agrupados, sin poll en las ejecuciones inline) | La cola se queda; F1-B3 la acota pero no la quita |
| Especulación (F3) | Ejecuciones baratas | No viable |
| Ningún frío en mitad de la llamada (§4.7) | OPT-8: pool hacia el proveedor con keep-alive ≥ 120 s, pre-conexión en paralelo con la grabación y cierre determinista del stream | DNS + TCP + TLS hacia el proveedor en cada turno |

Nada de este plan cambia el contrato BFF↔`api.magic_llm`. El BFF es hoy el cliente más estricto (`extra` prohibido en el stream y en usage; `model == 'inline-agt'`). Cualquier campo nuevo del lado de `api.magic_llm` tiene que ser opt-in y llegar antes al BFF.

---

## 8. Decisiones del dueño

| # | Decisión | Fecha límite | Bloquea |
|---|---|---|---|
| D1 | Fish: Drama 3 al nuevo precio, cambiar a S2.1-Pro, o apagar el carril | 2026-11-12 | F1-G2 |
| D2 | Postura legal sobre el art. 50(2) de la UE (marcado del audio sintético) | 2026-12-02 | F1-G1 |
| D3 | Consentimiento para el corpus de llamadas EN/ES | — | F2-S3, F2-Q, F3-1 |
| D4 | Unidad de facturación: conectado, entregado u oído (R26) | — | F2-S2 (facturar lo oído) |
| D5 | Proveedor de STT en streaming | Tras F2-S3 | F3-1 |
| D6 | Modelo y host de voz | Tras F0-9 | F2-L1 |
| D7 | Si la Fase 2 de `api.magic_llm` incluye la ruta opt-in para el BFF (véase ese plan) | — | — |

---

## 9. Cómo se publica cada cambio

- **Protocolo SPA↔BFF:** siempre server-first. El SPA solo usa lo que anuncia `voice_ready.protocol`. Solo cambios aditivos, y los campos que sobran se toleran.
- **Flags y kill switch** por ítem de latencia, para poder hacer A/B con `experiment_arm` (hoy reservado y siempre nulo).
- **Verificación con Phase 0:** cada ítem dice qué columna debe moverse. Ningún ahorro se da por bueno sin dos semanas de filas.
- **Ruta de vuelta atrás:** acordar antes de la migración el acoplamiento entre el marcador de esquema y la versión del BFF (B3 de la auditoría de Phase 0).
