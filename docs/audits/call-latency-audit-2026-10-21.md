# Auditoría: cuellos de botella y latencia de la llamada de voz

**Fecha:** 2026-10-21. **Alcance:** un turno de llamada, desde la última muestra con voz del usuario hasta la primera muestra audible de la respuesta (V2V). También cubre el barge-in, el turno siguiente, las colas y la concurrencia. Revisé el código actual de las seis piezas: el SPA (este repo), `magic-worlds-api` (BFF), `api.magic_llm`, `magic-agents`, `magic-llm` y `api.auth`. Incluye los commits del 2026-10-21 y el working tree, con las correcciones de Phase 0 sin commitear.

**Método:**
- Lectura del código, con cinco auditorías en paralelo: navegador, BFF antes del LLM, BFF del LLM al audio, la pila del LLM y la cobertura de métricas.
- Pruebas offline: el codificador WAV y el decodificador base64 en node; el render de `CallScreen` en jsdom; `SentenceBuffer` con respuestas reales en inglés y español; el pipeline real de `api.magic_llm` contra un proveedor SSE falso; y handshakes TLS sin credenciales.
- Las afirmaciones de más peso las verifiqué yo en el código. Van marcadas con ✔.
- No edité código, no escribí en ninguna base de datos y no envié peticiones autenticadas.

**Etiquetas:**
- **FACT:** leído en el código o medido.
- **INFERENCE:** derivado de hechos más una suposición explícita.
- **UNKNOWN:** sin evidencia.

Todos los ms medidos vienen de dev: LAN, usuario root, `uvicorn --reload` y un MySQL compartido saturado. La línea base es [`02_turn_lifecycle_and_latency.md`](../call_realtime/02_turn_lifecycle_and_latency.md) §4 (filas 1-15), del 2026-10-20.

Los scripts de las pruebas están en `/tmp/claude-1000/-home-andres-WebstormProjects-magic-worlds/5a2ec06b-a6a7-4baf-a1ff-bbac6afec0f7/scratchpad/latency/{spa,bff_pre,bff_post,llm}/`.

---

## 1. Veredicto

- **Hoy el p50 está entre 3,8 y 4,7 s** (carril ElevenLabs, LAN, sin moderación). La investigación daba ~3,9 s. La diferencia está casi toda en una cifra que nadie ha medido: el TTFT real del proveedor. La fila 9 supone ~600-680 ms. El intercepto de 1,85 s de los datos de dev, una vez restado el overhead fijo que ahora se puede localizar (§4, LLM-L14), apunta a **~1,45-1,6 s**. El carril Fish suma +0,5-0,9 s. Con WAN o móvil, la subida añade +0,1-0,4 s.
- **El mayor cuello de botella controlable sigue siendo `api.magic_llm`.**
  - Antes de enviar la petición al proveedor ejecuta **21 transacciones en serie**, unas 625 sentencias SQL. Eso son ~900 ms p50, y el CPU de Python es solo ~55 ms, así que casi todo es I/O de base de datos.
  - Después del stream hay **1,0-2,5 s** más: el poll de uso de OpenRouter y 12 commits. Ocurren antes de `[DONE]`, así que la cola **sí está en el camino crítico** en tres casos: las frases sin puntuación final, la finalización del turno y el turno siguiente. La investigación decía que no.
- **El resto del presupuesto p50:**

  | Etapa | ms p50 | Tipo |
  |---|---|---|
  | Hang-over del VAD | 552 | Fijo |
  | STT por lotes de Groq | 526 | ~80 son TLS en frío evitable |
  | Primera frase completa | ~350 | Incluye +120 ms en las respuestas de una frase |
  | Primer audio de TTS | ~250 | |
  | Contabilidad del BFF | ~200 | Unas 25 transacciones en serie |

- **Lo que la investigación no vio:**
  - un lock exclusivo global por proyecto, tomado 3 veces por turno;
  - una escritura en base de datos **por cada delta** del LLM en `api.magic_llm`;
  - sin deadline de TTFT ni de conexión: el peor caso es **~362 s**, no 92;
  - el turno siguiente espera al anterior sin tope general;
  - el perfil de LLM fijado al inicio de la llamada falla con un 409 en cada turno si alguien publica una revisión a mitad de llamada.
- **Sin cambiar de proveedor**, las correcciones P0 y P1 (§9) llevan el p50 a **~2,3-2,7 s**. Con la grabación de `api.magic_llm` resuelta, el factor dominante pasa a ser el TTFT del modelo. Eso hace el perfil de voz con TTFAT bajo (LAT-11) más importante de lo que pensaba la investigación.
- **Medición:** Phase 0 va a medir V2V con un solo reloj, pero seguirá sin ver justo la parte más grande: el reparto de las filas 7-9 dentro de `api.magic_llm`. También tiene marcas mal etiquetadas y consultas de dashboard que no calculan lo que dicen (§7).

---

## 2. Presupuesto reconciliado (código actual)

Carril ElevenLabs, LAN, moderación off, STT en su p50. La columna «Investigación» es la fila de 02 §4.

| # | Etapa | Hoy (central / rango, ms) | Investigación | Etiqueta | Evidencia | Cambio |
|---|---|---|---|---|---|---|
| 1 | Hang-over del VAD | **552** / 549-~650 | 550 | FACT | `CallScreen.tsx:114`; worklet `:45-50, 281` (69 quantums de 128 a 16 kHz). La histéresis cuenta como voz la cola que decae (≥0,8×gate) | Igual. La cola por histéresis es INFERENCE |
| 2 | Worklet → hilo principal, WAV + SHA-256 | **~1** / 0,3-2 (20 con un render) | 5 | FACT (medido: 0,28 ms con 2,75 s de audio, 2,0 ms con 29,5 s) | `voiceVadWorklet.ts:184-212`; controller `:599-646` | Era más alto. No vale la pena optimizarlo |
| 3 | Subida multipart | **~5 LAN** / WAN 80-240; móvil 300-600 | 60 | INFERENCE | uvicorn HTTP/1.1, keep-alive de 5 s (por defecto, sin override ✔). El POST queda abierto todo el turno, así que el siguiente casi siempre abre TCP/TLS nuevo. Preflight CORS en la primera subida (`max_age` por defecto, 600 s ✔). Slow start: 86-150 KB ≈ 3-4 RTT | Más baja en LAN, más alta fuera de LAN |
| 4 | Auth + preámbulo + intake previo al STT | **~45** / 30-100 | 60 | INFERENCE (con suelos medidos) | `auth_adapter.py:383, 441-455`: TTL de 30 s desde la inserción y un acierto no lo renueva, así que entre 1/3 y todos los segmentos fallan la caché (+10-30 ms). `route_voice_call.py:1229-1256`; `engine.py:2075-2274` | Confirma la fila; añade la tasa de fallos de caché |
| 5 | STT por lotes de Groq, dentro de `intake_lock` | **526** / 422-1.481; p95 1.002 | 526 | FACT (n=23) | `stt_groq_client.py:90-109, 138-145`: cliente compartido, keep-alive de 5 s (casi siempre en frío, ~80 ms), 1 intento, 30 s | Igual |
| 6 | Débito STT, `completed`, preparación, catálogo, admisión, despacho | **~150** / 85-400 | 240 | El código da ~85-130 en caliente; dev midió [208, 400] para 4+6 con resolución de 1 s | `engine.py:2314-2350, 3640-3717`; `callbot_execution.py:85-99, 159-207`; `llm_execution_admission.py:457-585`; `llm_turn_runner.py:168-171` | La diferencia con la medición es UNKNOWN; lo probable son los turnos que refrescan el catálogo (+30-300 ms en 1/6-1/2 de los turnos) |
| 7 | `api.magic_llm`: auth, admisión, claim | **~100** / 65-137 | 100 | FACT (admit→claim); auth INFERENCE | `completion_auth.py:370-400`: 2 llamadas a api.auth sin caché más un SELECT síncrono en el event loop (16-20 en prod, 60-80 en dev). `interaction_admission.py:28-84` | La etiqueta «admisión» engaña: esos 65-137 ms son admit→claim |
| 8 | `api.magic_llm`: grabación durable antes del proveedor | **~900** / 768-1.233 | 880 | FACT (p50 898, n=19) | 21 transacciones, unas 625 sentencias, ~40 ms cada una. Checkpoint de 3,6 → 65 KB, con ModelChat guardado 4 veces. `native_execution.py:129-353, 987-1032`; `recorder.py:186-259` | El número es el mismo, la explicación no: domina el I/O de base de datos, no el fsync (2-4 de ~40 ms). El checkpoint pesa ~65 KB antes del proveedor, no 48-123 |
| 9 | Conexión al proveedor + TTFT | **81 + (600…1.500)** | 680 | TLS: FACT (medido hoy, TCP 39 + TLS 42). TTFT: INFERENCE en ambos escenarios | `engine_openai.py:264`: una `ClientSession` nueva por stream, sin keep-alive ni caché DNS. Más +3-4,5 ms por la escritura del primer delta (LLM-L6) | El TTFT probablemente está subestimado (LLM-L14) |
| 10 | Primera frase completa | **~350** / 80-610; +120 en las respuestas de una frase; 0,67-1,36 s en frases largas sin punto | 350 | FACT (prueba) | `sentence_buffer.py:154-180` ✔: un signo al final del buffer espera al siguiente delta o a la pausa de 120 ms (`engine.py:104` ✔). El prompt pide «una o dos frases cortas» | Añade la penalización de 120 ms que la fila no tenía |
| 11 | Moderación de la frase 1 | **0 en dev** / ≤300 | 0-300 | FACT | `engine.py:3555-3611`. `check_ahead` existe pero no se usa. Con los valores por defecto del código (REQUIRED=true y sin clasificador) **no sale audio** (C04) | Corrige 02 §7: la «moderación anticipada» no ocurre |
| 12 | Primer audio de ElevenLabs | **~250** / 150-350 | 250 | INFERENCE | `tts_multicontext_ws.py:74-89, 621-645`: `flush:true` por frase, `mp3_44100_64`, `sync_alignment` | Igual |
| 13 | Bajada: base64 en JSON por WS | **~15** / 10-40 | 25 | El framing es FACT (<0,1 ms por chunk, +35-40 % de bytes); la red es INFERENCE | `delivery.py:212-268` | Es red, no framing |
| 14 | Append a MSE + latencia del dispositivo | **~100** / 20-150; ~400 con Bluetooth | 100 | UNKNOWN; Phase 0 lo va a medir (`first_chunk_to_playing_ms`) | `voicePlaybackBuffer.ts:195-233`: append y `play()` inmediatos, sin prebuffer | Igual |
| 15 | Silencio inicial del MP3 | **~80** / ElevenLabs 71-86; Fish 92-153 | 80 | FACT (assets decodificados) | — | Igual; ninguna métrica lo cubre |
| | **Total, escenario A (TTFT 600)** | **≈3,76 s** | 3,83-3,91 | INFERENCE | | |
| | **Total, escenario B (TTFT 1.500)** | **≈4,66 s** | — | INFERENCE | coincide con la reconstrucción de dev de 4,4-5,4 s | |

**Reparto (escenario A):**

| Etapa | % del total |
|---|---|
| Grabación de `api.magic_llm` | 24 % |
| TTFT del proveedor | 16 % (32 % en el escenario B) |
| Hang-over | 15 % |
| STT | 14 % |
| Primera frase | 9 % |
| Contabilidad del BFF y de `api.magic_llm` (filas 4, 6, 7) | 8 % |
| TTS | 7 % |
| Borde: subida, bajada, dispositivo, silencio (filas 2, 3, 13-15) | 6 % |

**Variantes:**
- **Fish:** primer audio de 700-1.200 ms, más una transacción por frase (`FOR UPDATE` en la fila de la cuenta, un `SUM` diario y un upsert) que serializa todas las llamadas Fish: 10-70 ms (`fish_audio/streaming.py:166-190`, `admission.py:103-142`). Suma ≈ +0,5-0,9 s.
- **WAN/móvil:** subida de +80-400 ms. En unas 2/3 de las llamadas, un turno además paga un refresh de token en serie más una segunda subida: +250-600 ms (§4, FE-L5).

---

## 3. Cuellos de botella p50, en orden

| # | Cuello de botella | Coste p50 | Controlable sin cambiar de proveedor | IDs |
|---|---|---|---|---|
| 1 | **Grabación antes del proveedor en `api.magic_llm`:** 21 transacciones en serie con el lock del recorder, cada una relee snapshot y checkpoint y reescribe el checkpoint | ~900 ms | Sí: agrupar en ≤2 commits (`effect_prepared` y `llm_start` tienen que ser durables antes de despachar) o un modo efímero para el callbot que posee el BFF. **−650-850 ms** | LLM-L3, L4, L5 |
| 2 | **TTFT del proveedor:** sin medir; probablemente ~1,5 s | 600-1.500 ms | En parte: un perfil de voz sin razonamiento, con prefijo cacheado y elegido por TTFAT. Primero hay que medirlo | LLM-L14; LAT-11 |
| 3 | **Hang-over de 552 ms** | 552 ms | Sí: bajarlo a 300 ms con un modelo de fin de turno; el servidor ya fusiona los turnos cortados. **−250 ms** | FE-L1; LAT-07 |
| 4 | **STT por lotes** dentro de `intake_lock` | 526 ms | ~80 ms: keep-alive de 120 s y abrir la conexión al recibir el segmento, en paralelo con las filas 3-4. El resto pide STT en streaming (otro proveedor) | BE-P5 |
| 5 | **Esperar una frase completa:** no hay corte por cláusula; el signo final espera al siguiente delta o 120 ms | ~350 ms (+120 en las respuestas de una frase) | Sí: soltar con `finish_reason` o con una pausa de 30-40 ms cuando el buffer termina en `[.!?]`; cortar la primera unidad en `, ; —` a partir de ~30 caracteres. **−100-300 ms** | BE-A1, A2 |
| 6 | **Contabilidad en serie del BFF:** ~25 transacciones y 9-10 commits de escritura por turno (~150 sentencias para un usuario no root); débito y `completed` dentro del lock; `find_admission`, que en voz siempre vuelve vacío; refresco del catálogo con el perfil ya fijado; `started` en una transacción aparte | ~150 ms | Sí: ejecutar en paralelo y quitar lo redundante. **−50-120 ms**, y fuera los picos de catálogo | BE-P2…P10 |
| 7 | **Conexiones en frío:** Groq, OpenRouter y BFF→`api.magic_llm` (un `httpx.AsyncClient` nuevo por petición, `llm_execution_transport.py:277`) | ~165 ms | Sí: pools por base_url, precalentados en paralelo con la grabación | BE-P5, P10; LLM-L7 |
| 8 | **Escritura por delta en `api.magic_llm`:** `audited_events` espera un `UPDATE tb_interaction SET conversation_id` antes de reenviar cada evento que lleva `id_conversation` ✔ (`interaction_admission.py:157-158`) | +3-4,5 ms al primer delta; en la prueba, el último delta salió ~730 ms tarde con escrituras de 10 ms | Sí: escribirlo una sola vez | LLM-L6 |
| 9 | **TTS:** ElevenLabs ~250 ms; Fish 700-1.200 ms más la transacción por frase | 250 (EL) | En parte: reservar el presupuesto de caracteres al tomar el lease (Fish); probar en A/B a quitar normalización y `sync_alignment` (EL, UNKNOWN) | BE-A5, A6 |

**No son cuellos de botella:**
- el CPU del navegador: ~1 ms por turno en escritorio;
- el framing de la bajada: <0,1 ms por chunk;
- la serialización JSON del payload: <0,3 ms con 37 KB;
- el escaneo de MP3: 31 µs por chunk;
- la telemetría de Phase 0: marcas síncronas, filas escritas en tareas de fondo (`turn_metrics.py:415-431, 507-562`).

---

## 4. Riesgos de cola, en orden

| # | Riesgo | Peor caso | Disparador | Evidencia | Corrección |
|---|---|---|---|---|---|
| 1 | **El LLM no tiene deadline de TTFT ni de conexión** | **~362 s** (3 intentos × `sock_read` de 120 s + 1 s entre intentos), con la conexión sin límite. El timeout de lectura de 60 s del BFF nunca salta, porque `api.magic_llm` manda un keep-alive cada 10 s. Nadie le dice nada al usuario | El proveedor se cuelga antes del primer token | ✔ `magic-llm/magic_llm/util/http.py:261-262` (`sock_read` = `timeout`); ✔ `base_chat.py:64` (`retries=3`); ✔ BFF `magic_llm_config.py:24` (120 s); `completions.py:80` | Deadline de TTFT de 3-4 s, conexión de 2 s, un reintento con hedging y una frase de relleno hablada (LAT-08). Cambia la cifra de la investigación: 92 s era el valor viejo |
| 2 | **El turno siguiente espera al anterior.** `await previous.finished.wait()` no tiene tope ✔ (`engine.py:2130`). `finished` se activa cuando termina todo `_run_voice_turn` ✔ (`engine.py:2171`): `_finish_safely` (≤10 s), `reconcile` (sin tope), el guardado a mitad de stream (≤3 s), facturación, `_settled_truncation` ×2 (≤3 s cada una), el asset de audio (sin tope). Después viene `_await_pending_truncation` (≤3 s ✔, `engine.py:2397`) | 9 s solo con los topes de truncado, +10 s, + lo que no tiene tope. Dev midió 0,7-6,4 s extra en 4 de 19 turnos | Supersede, barge-in, respuestas rápidas | BE-A11 | Un tope general; persistir después de admitir el turno siguiente (LAT-05). La investigación decía «dos topes de 3 s ≈ 6 s» |
| 3 | **Cola post-stream de `api.magic_llm` en el camino crítico.** El poll de uso de OpenRouter se espera dentro del generador, tras el último chunk ✔ (`engine_openai.py:283-292`; el comentario dice «non-blocking», pero no lo es). Luego van 12 commits; `stop` y `[DONE]` salen al final ✔ (`interaction_admission.py:180-188`) | 1,0-2,5 s, a veces más (el poll tiene 120 s de timeout total) | Siempre. Retrasa la finalización del turno y, con eso, el riesgo 2. También retrasa la **última frase** si termina en `…`, `...`, `no.`, un dígito con punto, `»`, sin puntuación o en CJK, y la **única** frase en ese mismo caso | LLM-L10, L11; BE-A3 ✔ (`sentence_buffer.py:103-113`) | Emitir `stop` y `[DONE]` cuando termina el proveedor, grabar en asíncrono, quitar el poll (el uso ya llega en el stream). **−1,0-2,5 s** en la finalización |
| 4 | **El STT tiene un solo intento con timeout de 30 s, dentro de `intake_lock`** | 30 s de silencio y error; mientras tanto se bloquean los segmentos siguientes de la llamada | Groq lento | BE-P5; `config.py:47` | Deadline de 3-5 s y un reintento con hedging (LAT-09) |
| 5 | **Se agotan los slots de ElevenLabs.** `MAX_LIVE_CONTEXTS = 4` ✔. El 5.º `begin_turn` espera 3 s (`QUEUE_WAIT_RECONNECT_S` ✔) y gasta el único reconexión. Un contexto muerto solo se libera con `isFinal`, o 5 s después del **último frame tardío** | +3,3-3,7 s; un fallo más y la llamada se queda sin voz | Barge-ins rápidos seguidos (frecuencia INFERENCE) | BE-A13; `tts_multicontext_ws.py:73-77` | Contar solo los contextos abiertos |
| 6 | **Conexiones en frío lentas** | 0,5-1,5 s en el 4-20 % de las conexiones; hay 2 conexiones en frío por turno | Keep-alive de 5 s vencido | topología GAP-02; LLM-L7 | Pools + precalentamiento |
| 7 | **Token caducado durante la llamada.** No hay refresh proactivo en la subida ✔ (`index.ts:1121-1137`; solo `chatSocket` lee `exp`). El access token dura 15 min ✔ y una llamada hasta 10 min | +50 ms LAN; +250-600 ms WAN, una vez en ~2/3 de las llamadas | Expiración | FE-L5 | Refrescar al ~80 % del TTL o en `speech_start` |
| 8 | **api.auth lento o caído** | Hasta 2 s por segmento; con el breaker abierto, 503 en todos los segmentos durante 60 s | api.auth degradado | BE-P1 | Validar el JWT localmente o renovar la caché antes de que caduque |
| 9 | **iOS / ManagedMediaSource** | +2 s (`MANAGED_STALL_MS`) y huecos entre grupos Blob | Stall en Safari | FE-L9 | Timer de stall de ~600 ms |
| 10 | **La subida no tiene deadline.** Solo reenvía ante `TypeError`; un 429 se descarta | Turno perdido en una conexión medio abierta | Red móvil | FE-L6 | Watchdog: sin `voice_segment_ack` en ~2 s, reenviar con la misma clave |
| 11 | **Perfil fijado + revisión nueva.** `expected_revision_id` se fija en el preflight ✔ (`callbot_execution.py:131-133`); una revisión distinta da `PROFILE_REVISION_CHANGED` 409 ✔ (`llm_profile_resolution.py:82-83`) | Cada turno restante de la llamada falla, con el STT ya cobrado (consecuencia: INFERENCE) | Publicar una revisión a mitad de llamada | BE-P15 | Volver a fijar ante el 409 |
| 12 | **Fish sin watchdog de primer audio** | Detección por ping en ≤40 s; el timeout de 90 s envuelve toda la generación | Fish colgado | BE-A12; §9 de 02 | LAT-10 |

---

## 5. Concurrencia y escala

| # | Riesgo | Evidencia | Efecto | Corrección |
|---|---|---|---|---|
| S1 | **Lock exclusivo global por proyecto en el BFF.** `INSERT … ON DUPLICATE KEY UPDATE` sobre la única fila `tb_llm_project_state` del proyecto ✔. Lo toman `find_admission`, `admit`, `started`, `renew` y `finish`, para **todos los usuarios y todas las funciones LLM** (también el chat de texto) | ✔ `llm_profile_models.py:104-109`; ✔ `llm_execution_admission.py:171, 489, 790` | Unos 30-50 ms retenido por turno, 3 veces por turno. Quien espera ocupa una conexión del pool (10, sin timeout de adquisición). El tope de 8 llamadas (`DEFAULT_VOICE_GLOBAL_CONCURRENCY` ✔) lo esconde | Lock compartido o comprobación de versión; quitarlo de `find`, `started` y `renew` |
| S2 | **`api.magic_llm` en un solo proceso** y un solo event loop, con ~0,3 s de CPU por turno (sobre todo en la cola) y un pool aiomysql de 10 compartido entre admisión, el store nativo, las escrituras por delta y los hooks. Hay pymysql síncrono en el loop | `Dockerfile:123`; `connection.py:203-204`; `agt_flow.py:1029` | ≥5 turnos en streaming a la vez saturan el pool (INFERENCE). ~120 commits de escritura y ~3-8 MB de binlog por turno | LLM-L3, L6 y L11 quitan ~120 commits por turno |
| S3 | **Event loop del BFF:** validación O(n²) por delta ✔ (`llm_turn_runner.py:183-189` revalida todo `collected` en cada delta); VAD de ~1 ms por segundo de audio en el loop | prueba: 10 ms por turno de 600 caracteres; 1,8 s por turno de 7,9k | Despreciable en respuestas cortas; con respuestas largas bloquea todas las llamadas del proceso | Validar solo el sufijo nuevo; VAD en un thread |
| S4 | **Fish:** `FOR UPDATE` por frase en la fila de la cuenta, más un `SUM` diario que crece con el volumen de la plataforma | `fish_audio/streaming.py:166-190` | Serializa todas las llamadas Fish | Reservar en el lease y liquidar al final |
| S5 | **Limitador de ElevenLabs en el proceso:** un permiso `ttd_session` por llamada mientras dura; su capacidad usa el tamaño de `flash` (24) | ✔ `speech/limiter.py:1-12, 159` | Sin efecto mientras el tope sea 8 llamadas; es por proceso (se pierde al escalar en horizontal) | Mover al lease compartido (ya previsto en su docstring) |
| S6 | **Facturación en el bucle de envío:** `deliver` espera la facturación en el primer audio de cada frase y cada 2 s (≈8-12 sentencias `FOR UPDATE` bajo `billing_lock`, que también toma el débito STT del segmento siguiente) | `engine.py:2599-2617, 3640-3701` | 10-40 ms de hueco después del chunk 1; esperas de pool con carga | Tarea de fondo ordenada |

---

## 6. Barge-in y turno siguiente

- **Silenciar al personaje:** el SPA corta en local (`pause` y quitar `src`) en cuanto suma ≥500 ms de voz acumulada durante la reproducción. El onset ya se fecha hacia atrás con `onset_lag_ms`. Con ElevenLabs, el servidor cancela en 1-5 ms. Con Fish, la cancelación espera, dentro del bucle de recepción del WS, el commit de liberación del lease y el cierre del socket: de ~81 ms a ≥3 s. Durante ese tiempo no se leen más frames del WS (BE-A12). Un `voice_ping` también espera un `UPDATE` antes de leer el frame siguiente.
- **Calentamiento del AEC:** el barge-in queda bloqueado 3 s después del primer `playing` de la llamada, y solo se vuelve a comprobar cuando arranca la reproducción. Una frase que empezó dentro de ese calentamiento nunca interrumpe, y entra el supersede del servidor (FE-L11).
- **Turno siguiente:** el supersede cancela el turno anterior **después del STT del segmento nuevo** y luego espera el `finished` del anterior sin tope (riesgo 2). Del lado del cliente no hay espera, pero el POST del turno interrumpido sigue abierto, así que la subida nueva suele necesitar otra conexión: +1-2 RTT en WAN (FE-L12).
- **Inicio de llamada** (FE-L13): todo en serie. `getUserMedia` → AudioContext + `addModule` → consentimiento POST → `/llm/features/callbot/resolve` POST → apertura del WS → `voice_start` → `voice_ready`. Son 4-7 RTT más el trabajo del servidor. El consentimiento, la resolución del LLM y la apertura del WS se pueden lanzar en paralelo (−1-2 RTT).

---

## 7. Medición: qué va a ver Phase 0 y qué no

**Lo que sí va a quedar medido:**
- V2V de un solo reloj (`client_v2v_ms`);
- `speech_end_lag_ms`;
- `intake_ms`;
- `stt_ms`;
- `llm_ttft_ms`, que suma las filas 7, 8 y 9 más la conexión del BFF;
- `first_sentence_ms`;
- `tts_first_audio_ms`;
- `first_chunk_to_playing_ms`;
- stalls;
- `barge_in_onset_to_pause_ms`.

**Lo que queda a ciegas** (las 5 brechas más graves primero):
1. **El reparto dentro de `api.magic_llm`** (filas 7-9, ~1,6-2,5 s): `llm_first_byte` ≈ `llm_headers`, porque el frame `interaction` sale antes de que arranque la ejecución (`interaction_admission.py:143`). Cierre: el plan 03 (intervalos en ms junto a `usage_details`).
2. **No hay modelo ni perfil de LLM por fila, ni build del SPA, ni hang-over**, y `config_fingerprint` deja fuera el carril y formato de TTS, el tope del LLM y los límites del buffer de frases (`turn_metrics.py:105-113`). Sin eso no se puede atribuir el efecto de LAT-07 ni de LAT-11.
3. **Conexión en frío o en caliente:** no hay ningún campo. `owned_client` se captura pero nunca se guarda (`llm_exchange_timing.py:30, 103-110`), aunque 03 dice que se registra.
4. **Esperas del supersede y del truncado** (riesgo 2): no tienen marcas propias, quedan dentro de `claim_ms` y `pre_dispatch_ms`.
5. **Bordes:** la conexión de la subida (usar `PerformanceResourceTiming`), la bajada, el silencio inicial, y la latencia real de salida. Esta última se lee del AudioContext de **captura**, no del de reproducción (`useMicrophoneCapture.ts:599-606`).

**Marcas mal etiquetadas o mal colocadas:**
- `claim_ms` incluye el débito STT y `update_segment(completed)`; la espera del supersede no tiene marca (`engine.py:2121-2126, 2313-2349`).
- `pre_dispatch_ms` incluye la espera del truncado, el paso sincronizado de `VoiceLlmTurnStarted` (spend check y 2 envíos por WS) y la escritura `started`.
- `tts_first_audio_ms` incluye la espera de `begin_turn` y la moderación (`call_tts_elevenlabs.py:183-190, 237`).
- `first_audio_sent` se marca también en envíos descartados o cancelados (`engine.py:2593-2596`).
- `llm_stream_ms` incluye la contrapresión del engine.
- Los segmentos rechazados antes de `begin_turn` (auth, flags, consentimiento, formulario, hash, capacidad) no tienen fila. Así, la condición de G0 «cada segmento tiene una fila» no se puede comprobar.

**Consultas de 02 §9:**
- La consulta «V2V por día y carril» no calcula percentiles. Su cobertura cuenta como fallo los turnos donde V2V falta a propósito (corte por longitud, bloqueado por tap, `no_audio`) y no excluye las llamadas de un SPA v1.
- La consulta «dónde se va el tiempo» no particiona por carril y promedia etapas sobre conjuntos no nulos distintos, así que no descompone ni el p50 ni el p95.
- El heard-ratio cuenta como oída la reproducción desconocida.

**Datos reales:** no hay ningún dato de latencia posterior al 2026-10-20 en disco. La migración no se ha aplicado contra un MySQL real. Los únicos artefactos nuevos son 9 MP3 en `.tts_storage/2026/10/` del 2026-10-21, que sirven para medir la fila 15 offline.

---

## 8. Correcciones a la investigación (2026-10-20)

1. **La cola post-stream no está fuera del camino crítico:** retrasa la finalización, el turno siguiente y las frases sin puntuación final (riesgo 3).
2. **Peor caso del LLM:** ~362 s más la conexión sin límite, no ~92 s. El timeout por defecto ahora es de 120 s.
3. **El poll de uso de OpenRouter sí corre** en cada stream de OpenRouter, y su resultado nunca llega a `tb_usage_fact`. El uso se copia en profundidad durante el bucle, y `after_attempt` lee esa copia.
4. **Fila 8:** la cuenta de commits es correcta, pero el coste es I/O de base de datos (~40 ms por transacción), no fsync. El checkpoint pesa ~65 KB antes del proveedor; 123 KB es después.
5. **Fila 7:** la «admisión ~100 ms» es en realidad admit→claim; la auth (2 llamadas a api.auth) no estaba contada.
6. **be-llm:** los «~19 hook writes» ya no existen; queda 1. Faltaban las ~85 escrituras por delta.
7. **Fila 9:** probablemente subestimada; el TTFT inferido es ~1,45-1,6 s.
8. **Fila 10:** faltaban los +120 ms de las respuestas de una frase, que es lo que pide el prompt.
9. **02 §7, «moderación anticipada»:** `check_ahead` no se usa.
10. **02 §9, esperas del turno siguiente:** son tres esperas de 3 s más esperas sin tope, no dos de 3 s.
11. **Filas 2 y 3:** el coste en el navegador es ~0,3 ms, no 5. La subida cuesta ~5 ms en LAN; fuera de LAN faltaban el preflight CORS, el slow start y el refresh del 401.
12. **Fila 6:** el código explica ~85-130 ms en caliente, frente a los 240 ms de la tabla. La diferencia queda pendiente de los `stages_ms` de Phase 0.
13. **Lo que ya no aplica:** «el first-audible del cliente nunca sale del navegador» y «no hay listeners de `waiting`/`stalled`». Las dos quedaron resueltas con Phase 0.
14. **Referencias de línea:** se movieron (route 1130 → 1229, intake_lock 2051 → 2107, STT 2228 → 2294, facturación 3389 → 3640, `begin_turn` → 2700, moderación → 3555-3611).

---

## 9. Plan recomendado (sin cambiar de proveedor)

Ahorros p50 estimados (INFERENCE), carril ElevenLabs, LAN. Dos escenarios: A con TTFT de 600 ms y B con TTFT de 1.500 ms.

| Paso | Contenido | Ahorro | p50 A | p50 B |
|---|---|---|---|---|
| Hoy | §2 | — | **3,76 s** | **4,66 s** |
| **P0, días** | <ul><li>`api.magic_llm` con ≤2 commits antes del proveedor, o modo efímero para el callbot (−750)</li><li>pools y precalentamiento: Groq con keep-alive de 120 s abierto al recibir el segmento, sesión del proveedor por base_url, cliente BFF→`api.magic_llm` (−160)</li><li>`SentenceBuffer`: soltar con `finish_reason` o pausa de 30-40 ms, cortar la primera cláusula, arreglar los finales retenidos (−150)</li><li>`conversation_id` escrito una sola vez (−4)</li></ul> | ≈ −1,06 s | **≈2,70 s** | **≈3,60 s** |
| **P0, colas** (el p50 no cambia) | <ul><li>`stop` y `[DONE]` al terminar el proveedor, sin poll de uso, grabación asíncrona</li><li>deadlines de TTFT y conexión, reintento con hedging y frase de relleno</li><li>deadline de STT con hedging</li><li>tope general a la espera del turno anterior</li><li>volver a fijar el perfil ante el 409</li><li>slots de ElevenLabs que cuenten solo los contextos abiertos</li></ul> | colas: −1-2,5 s en la finalización; 362 s → ~4 s; 30 s → ~5 s | = | = |
| **P1, semanas** | <ul><li>hang-over de 300 ms con modelo de fin de turno (−250)</li><li>contabilidad del BFF en paralelo; catálogo congelado en el preflight; `started` dentro de la admisión; caché de auth en el BFF y en `api.magic_llm` (−110)</li><li>perfil de voz elegido por TTFAT: −90 en A; −500-900 en B si el TTFT real es ~1,5 s</li><li>WAN: conexión precalentada en `speech_start`, `max_age` de CORS, refresh proactivo (0 en LAN; −100-400 en WAN/móvil)</li></ul> | A ≈ −0,45 s; B ≈ −0,9-1,3 s | **≈2,25 s** | **≈2,3-2,7 s** |
| P1, escala | lock por proyecto → por usuario o compartido; facturación de Fish y del bucle de envío en segundo plano; validación por sufijo | escala, no p50 | | |
| P2+ | subida en streaming, STT en streaming, especulación, host rápido: ver 02 §10 y 16 | −0,75 s, luego −0,6 s | ~1,5 s | |

**Orden sugerido:**
1. **Medir el TTFT real.** Es la mayor incertidumbre: ~0,9 s de diferencia entre A y B. Basta con añadir intervalos en ms a `api.magic_llm` (plan 03) y guardar modelo y perfil en la fila.
2. Hacer después los dos cambios de `api.magic_llm` (precommit y post-stream). Juntos son el mayor ahorro controlable, en p50 y en colas, y además alivian la escala (S2).
3. Por último, los pools de conexiones y el `SentenceBuffer`: son baratos y de bajo riesgo.

---

## 10. No ejecutado y límites

- No probé ninguna llamada real, ningún proveedor en vivo ni un MySQL real. Todos los ms de dev vienen de las muestras del 2026-10-20 (8 llamadas, 23 STT, 19 turnos LLM, casi todos con Fish).
- Las pruebas de CPU se hicieron en un Ryzen 9950X3D; en un móvil de gama media, calcular 4-8× más lento (INFERENCE).
- La topología de producción (regiones, proxy, keep-alive real) no está definida en los repos. Los números WAN son de modelo, no medidos.
- Los ahorros de §9 son estimaciones sobre los valores centrales de §2; se pueden solapar.
