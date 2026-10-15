# Monitoreo en vivo y debug con el tool Monitor de Claude Code

**Alcance reconciliado 2026-10-14: historia operativa de otra herramienta/sesión.** No es una feature de monitoreo integrada en Magic Worlds ni una automatización activa creada por este review. Los eventos/modelos/servidores descritos son evidencia de aquella puesta en marcha; no acreditan estado continuo ni todos los perfiles/features desplegados. El contrato actual y sus pendientes están en [perfiles](llm_profiles/16_current_status_and_roadmap.md) y [roadmap](ROADMAP.md).

Los nombres de herramientas y scripts son ejemplos del entorno original. Revalidar disponibilidad de herramientas, schema, permisos y campos de contenido antes de reutilizarlos; no convertir los ejemplos de resultados recortados en un registro de prompts/datos de usuarios. Este review no arrancó watchers ni consultó bases.

Este documento explica cómo se vigilaron en vivo las ejecuciones LLM durante la puesta en marcha de los perfiles de modelos (`docs/llm_profiles`). Cubre cómo funciona la técnica, cómo se aplicó en magic-worlds y cómo trasladarla a cualquier otro proyecto.

## Resumen

- **El problema.** El BFF (`magic-worlds-api`) y `api.magic_llm` corren dentro de PyCharm, y su consola no se puede leer desde fuera del IDE. Hacía falta saber, en el momento, si cada mensaje de chat o cada carta que lanzabas terminaba bien o fallaba, y por qué.
- **La idea.** No se observa el proceso, sino su efecto persistente. Cada ejecución LLM deja una fila en `tb_llm_execution_plan` con un `status`. Un script consulta esa tabla cada 2 s e imprime una línea solo cuando una ejecución cambia de estado.
- **El mecanismo.** El tool **Monitor** de Claude Code ejecuta ese script en segundo plano y convierte **cada línea de stdout en una notificación** dentro de la conversación. Cuando la UI dispara algo, Claude recibe `exec 2444439d chat_character … status=completed` sin que nadie copie logs a mano.
- **El ciclo de debug.** Llega un evento `failed`. Claude consulta el detalle en modo solo lectura (error en `api.magic_llm`, cadena de reintentos, payload congelado), corrige el código, fuerza la recarga del servidor y vuelves a intentarlo. El monitor confirma el resultado.

---

## 1. Cómo funciona el tool Monitor

### 1.1 Modelo mental

```
┌──────────────── script / comando (proceso en segundo plano) ────────────────┐
│  while true: consulta estado → si cambió, print("una línea") → sleep         │
└───────────────┬─────────────────────────────────────────────────────────────┘
                │ stdout (cada línea = 1 evento)
                ▼
        Tool Monitor (Claude Code) ── agrupa líneas con < 200 ms de diferencia
                │
                ▼
   Notificación en la conversación → Claude reacciona (investiga, corrige, informa)
```

- **stdout es el flujo de eventos.** Cada línea se convierte en una notificación, y las líneas que llegan con menos de 200 ms de diferencia se agrupan en una sola.
- **stderr no genera notificaciones.** Va a un archivo de salida que se puede leer después. Si quieres ver los errores del propio script, redirígelos con `2>&1` y fíltralos.
- **El script sigue mientras no termine.** Cuando termina, Claude recibe su código de salida, y eso también es una señal útil: si el script muere, te enteras.
- **Tiene caducidad.** Por defecto un monitor dura 5 minutos y como máximo 30. Al caducar llega un único aviso con el número de eventos y hay que **re-armarlo** si todavía hace falta.
- **Se puede cancelar** antes de tiempo con `TaskStop`.
- **Un evento no es una respuesta tuya.** Claude lo trata como un dato del sistema, no como una instrucción.
- **El volumen está limitado.** Si un monitor produce demasiadas líneas, se detiene automáticamente. El filtro debe dejar pasar solo lo accionable.

### 1.2 Monitor o `Bash` en segundo plano

| Necesidad | Herramienta | Ejemplo |
|---|---|---|
| **Una** notificación ("avísame cuando esté listo") | `Bash` con `run_in_background` y un `until` que termina | `until curl -sf localhost:8010/health; do sleep 1; done` |
| **Una por evento**, sin fin conocido | `Monitor` con un bucle infinito | el watcher de ejecuciones de este documento |
| **Una por evento** hasta un final conocido | `Monitor` con un script que sale al terminar | emitir cada check de CI y salir cuando ya no quede ninguno pendiente |
| Eventos *push* por WebSocket | `Monitor` con fuente `ws` (sin shell) | un stream de eventos de despliegue |

### 1.3 Reglas de calidad del script

1. **Vaciar el buffer en cada línea.**
   - En Python: `print(..., flush=True)` o `python -u`.
   - Con `grep`: `--line-buffered`.
   - Con `awk`: `fflush()`.
   - Nunca uses `| head`: no vacía el buffer y además corta el flujo.
2. **El silencio no significa éxito.** El filtro tiene que dejar pasar **todos** los estados terminales (`completed`, `failed`, `cancelled`, …) y los errores del propio watcher. Un filtro que solo busca `completed` se queda mudo ante una caída, y eso parece igual que "sigue corriendo".
3. **Emitir solo transiciones**, nunca el estado completo en cada vuelta del bucle.
4. **Sembrar en silencio al arrancar.** Lo que ya existía antes de armar el monitor no es un evento.
5. **Tolerar fallos transitorios.** Una desconexión de la base de datos o un `curl` fallido no debe matar el bucle: reconecta y sigue.
6. **Intervalos de sondeo razonables:** de 0,5 a 2 s para recursos locales o de la LAN, y 30 s o más para APIs remotas con límite de peticiones.

---

## 2. Cómo se usó en magic-worlds

### 2.1 Por qué la base de datos y no los logs

- Los dos uvicorn (`magic-worlds-api` en `:8010` y `api.magic_llm` en `:7000`) se lanzan desde configuraciones de ejecución de PyCharm.
- Su stdout es una *pipe* que solo lee el IDE. No hay archivo que seguir con `tail` y leer esa pipe desde fuera le robaría la salida a la consola.
- Lo que sí es observable desde fuera es lo que el sistema **persiste**:

```
SPA (tu navegador)
  └─ POST /character-chats/…, /cards/…  ─▶  magic-worlds-api (BFF, :8010)
                                              ├─ INSERT/UPDATE tb_llm_execution_plan   ◀── el watcher consulta aquí (MySQL .90)
                                              └─ POST /v1/chat/completions ─▶ api.magic_llm (:7000)
                                                                               └─ magic_messages.tb_interaction (error_json)  ◀── detalle del fallo
```

`tb_llm_execution_plan` es la fuente de verdad de cada ejecución LLM del BFF:

| Columna | Uso en el watcher |
|---|---|
| `execution_id` | clave de la ejecución (se muestran 8 caracteres) |
| `execution_sequence` | autoincremental con índice único, para ordenar lo más reciente |
| `feature_key` | `chat_character`, `card_generation`, … |
| `status` | `admitted` → `running` → `completed` / `failed` / `cancelled` / `awaiting_credential` |
| `resolution_source` | de dónde salió el perfil (`system_default`, `user_feature`, …) |
| `effective_config` (JSON) | perfil congelado; de aquí sale `roles.primary.provider_model_id` |
| `result` (JSON) | resultado; el esquema garantiza que solo existe si `status = 'completed'` |
| `updated_at` | `ON UPDATE CURRENT_TIMESTAMP`, sirve para un cursor incremental (ver §3.2) |

### 2.2 El watcher

Se ejecutaba desde el checkout del BFF para reutilizar su propio cargador de configuración (`load_repo_dotenv`). Así las credenciales salen del `.env` del proyecto sin pasar por la línea de comandos y sin imprimirse nunca.

```python
# watch_new_exec.py — se ejecuta con cwd = magic-worlds-api
import os, sys, time, pymysql
sys.path.insert(0, os.getcwd())
from src.runtime_config import load_repo_dotenv
load_repo_dotenv()                       # .env del proyecto → os.environ (nada se imprime)

def conn():
    return pymysql.connect(host=os.environ['MYSQL_HOST'], port=int(os.environ.get('MYSQL_PORT') or 3306),
                           user=os.environ['MYSQL_USER'], password=os.environ['MYSQL_PASSWORD'],
                           database=os.environ.get('MYSQL_DATABASE') or os.environ.get('MYSQL_DB'),
                           autocommit=True)  # ← imprescindible, ver nota
seen = {}
first = True
c = conn()
while True:
    try:
        with c.cursor() as cur:
            cur.execute("""SELECT e.execution_id, e.feature_key, e.status, u.username, e.resolution_source,
                           JSON_UNQUOTE(JSON_EXTRACT(e.effective_config,'$.roles.primary.provider_model_id')),
                           LEFT(CAST(e.result AS CHAR),300)
                           FROM tb_llm_execution_plan e JOIN tb_user u ON u.user_id=e.user_id
                           ORDER BY e.execution_sequence DESC LIMIT 20""")
            for eid, feat, status, user, src, model, result in cur.fetchall():
                if first: seen[eid] = status; continue          # siembra silenciosa
                if seen.get(eid) != status:                     # solo transiciones
                    seen[eid] = status
                    print(f"exec {eid[:8]} {feat} user={user[:14]} {src} model={model} "
                          f"status={status} result={result}", flush=True)
    except Exception as exc:
        print(f"watch error {type(exc).__name__}", flush=True)  # el tipo, nunca str(exc)
        time.sleep(5); c = conn()
    first = False
    time.sleep(2)
```

> **Nota sobre `autocommit=True`.** pymysql abre una transacción implícita en el primer `SELECT`. Con el aislamiento por defecto de InnoDB (`REPEATABLE READ`), las lecturas siguientes de esa misma transacción ven **la misma foto** de la base de datos. Sin `autocommit`, el watcher nunca vería filas nuevas: el monitor quedaría en silencio y parecería que no pasa nada. Es el error más fácil de cometer con un poller de base de datos.

Así se armó el monitor:

```text
Monitor(
  description = "new LLM executions on .90 (card e2e)",
  timeout_ms  = 1800000,          # el máximo: 30 min; se re-arma al caducar
  command     = "cd /home/andres/PycharmProjects/magic-worlds-api && \
                 .venv/bin/python -u <scratchpad>/watch_new_exec.py 2>&1 \
                 | grep --line-buffered -E '^exec |watch error|Traceback|Error'"
)
```

- `-u` desactiva el buffer de Python y `2>&1` junta stderr para que un `Traceback` del propio script también llegue como evento.
- El `grep` deja pasar las transiciones (`^exec `) **y** cualquier fallo del watcher, para que el silencio nunca tenga dos significados.
- Cada línea es corta (8 caracteres de ID, 14 de usuario, 300 de resultado) para no inundar la conversación.

### 2.3 El ciclo de debug

```
 tú: envías un mensaje / generas una carta en la SPA
        │
        ▼
 monitor:  exec 3c92ae1c chat_character … status=failed
        │
        ▼
 Claude: consultas de detalle, solo lectura
   ├─ exec_detail.py           → busca el execution_id/request_id en TODAS las tablas que tienen esas columnas
   │                             (vía information_schema.columns) e imprime las filas relacionadas, recortadas
   ├─ llm_last_interaction.py  → magic_messages.tb_interaction de api.magic_llm: status y error_json de las
   │                             últimas ejecuciones del runtime de agentes
   ├─ plan_parents.py          → sigue attempt_parent_execution_id: ¿es un reintento? ¿de qué plan?
   └─ plan_payload.py          → inspecciona el payload congelado (payload['agt']) del plan
        │
        ▼
 Claude: causa raíz → corrección en el código del BFF
        │
        ▼
 recarga: uvicorn --reload solo vigila *.py → `touch` de un .py del BFF fuerza el reinicio
        │
        ▼
 tú: reintentas (un mensaje NUEVO; ver el caso de los reintentos)  →  monitor: status=completed
```

Lo que sale de las consultas de detalle se trata como **dato**: se recorta y nunca se imprimen columnas con secretos ni payloads completos.

### 2.4 Casos reales de esta puesta en marcha

| Síntoma | Dónde se vio | Causa | Corrección |
|---|---|---|---|
| Chat rechazado con `LLM_EXECUTION_UPSTREAM_REJECTED` y 403 de `api.magic_llm` | ejecución `failed` + log de uvicorn pegado en el chat | `api.magic_llm` rechaza las sesiones no root de otro proyecto | el BFF envía `X-Delegation-API-Key` (sesión delegada) junto al Bearer del usuario |
| `TemplateAssertionError: no filter named 'tool_lookup'` | `error_json` en `magic_messages.tb_interaction` | los grafos de chat usaban un filtro Jinja que el runtime no registra | plantillas reescritas en Jinja estándar y pines SHA-256 del catálogo actualizados |
| Los reintentos seguían fallando después de la corrección | `plan_parents.py` / `plan_payload.py` | un reintento (`attempt_parent_execution_id`) reutiliza el `payload['agt']` **congelado** del plan original, con el grafo roto | enviar un mensaje nuevo, que usa el grafo actual (limitación de diseño documentada) |
| Prueba de punta a punta correcta | monitor: `exec 2444439d chat_character … status=completed` | — | Sonnet 5.5 como modelo principal y Haiku 5.5 en metadata/preflight; mensaje guardado con el formato normal |

---

## 3. Llevarlo a cualquier proyecto

### 3.1 La receta

1. **Elegir la fuente de verdad.** ¿Dónde deja huella el trabajo que te interesa? Una tabla de jobs, una cola, un endpoint de estado, un archivo de log, un check de CI.
2. **Identificar una clave y un estado:** `job_id` + `status`, `run_id` + `conclusion`, ruta de archivo + evento.
3. **Sembrar en silencio** todo lo que ya existe al arrancar.
4. **Emitir una línea por transición**: corta, con la clave abreviada, el estado nuevo y un detalle recortado.
5. **Cubrir los estados terminales y los errores del watcher** en el filtro.
6. **Elegir el intervalo** según el coste de la fuente.
7. **Armar con Monitor** (`timeout_ms` de hasta 30 min) y re-armar al caducar.
8. **Tener preparadas las consultas de detalle** (solo lectura) que vas a lanzar cuando llegue un `failed`.

### 3.2 Plantilla genérica: varias tablas con cursor incremental

La versión de §2.2 usa una ventana `LIMIT 20` sobre lo más reciente. Funciona con poco tráfico, pero si entran más de 20 filas en un intervalo se pierden transiciones. Esta versión usa un cursor sobre `updated_at` con el **reloj de la base de datos**, así que no le afecta la desincronización con tu máquina. Además vigila varias tablas a la vez:

```python
#!/usr/bin/env python3
"""Emite una línea por cada transición de estado en una o varias tablas.

Configuración solo por variables de entorno (los argumentos aparecen en `ps`):
  WATCH_DB_HOST, WATCH_DB_PORT, WATCH_DB_USER, WATCH_DB_PASSWORD, WATCH_DB_NAME, WATCH_POLL_SECONDS
Usa un usuario de solo lectura si puedes.
"""
import os
import time
from datetime import timedelta

import pymysql

# etiqueta → SQL. Cada consulta devuelve (clave, estado, updated_at, *detalle)
# y recibe un único parámetro: el corte inferior de updated_at.
SOURCES = {
    'exec': """SELECT execution_id, status, updated_at, feature_key
               FROM tb_llm_execution_plan WHERE updated_at >= %s ORDER BY updated_at LIMIT 500""",
    'image': """SELECT job_id, status, updated_at, error_category, error_public_detail
                FROM image_job WHERE updated_at >= %s ORDER BY updated_at LIMIT 500""",
}
TERMINAL = {'completed', 'failed', 'cancelled', 'canceled'}
OVERLAP = timedelta(seconds=2)  # updated_at tiene resolución de segundos: se relee un margen y se deduplica


def connect():
    return pymysql.connect(
        host=os.environ['WATCH_DB_HOST'], port=int(os.environ.get('WATCH_DB_PORT', '3306')),
        user=os.environ['WATCH_DB_USER'], password=os.environ['WATCH_DB_PASSWORD'],
        database=os.environ['WATCH_DB_NAME'],
        autocommit=True,  # sin esto, REPEATABLE READ congela la vista y nunca verás filas nuevas
        connect_timeout=5, read_timeout=10,
    )


def main():
    poll = float(os.environ.get('WATCH_POLL_SECONDS', '2'))
    conn = connect()
    with conn.cursor() as cur:
        cur.execute('SELECT NOW()')
        armed = cutoff = cur.fetchone()[0]  # reloj de la DB, no el del host
    print(f'watch armed {armed}', flush=True)
    seen = {}
    while True:
        try:
            newest = cutoff
            for label, sql in SOURCES.items():
                with conn.cursor() as cur:
                    cur.execute(sql, (cutoff - OVERLAP,))
                    for key, status, updated_at, *detail in cur.fetchall():
                        newest = max(newest, updated_at)
                        if updated_at < armed:           # existía antes de armar: siembra silenciosa
                            seen.setdefault((label, key), status)
                            continue
                        if seen.get((label, key)) == status:
                            continue
                        seen[(label, key)] = status
                        info = ' '.join(str(item)[:200] for item in detail if item is not None)
                        end = ' END' if status in TERMINAL else ''
                        print(f'{label} {str(key)[:8]} {status}{end} {info}'.rstrip(), flush=True)
            cutoff = newest
        except pymysql.Error as exc:
            print(f'watch error {type(exc).__name__}', flush=True)  # nunca str(exc): puede llevar host o usuario
            time.sleep(5)
            try:
                conn.close()
            except Exception:
                pass
            conn = connect()  # si esto falla, el script termina y Monitor informa del código de salida
        time.sleep(poll)


if __name__ == '__main__':
    main()
```

Antes de usarla, comprueba dos cosas en tu esquema:

- **`updated_at` cambia en cada transición**, sea con `ON UPDATE CURRENT_TIMESTAMP` o porque el código la fija. Si no, una transición no movería el cursor.
- **Su coste.** Sin índice sobre `updated_at`, cada vuelta recorre la tabla entera. En tablas pequeñas da igual; en tablas grandes, añade el índice o usa un autoincremental como cursor de filas nuevas (`id > último_visto`) más una relectura de las claves que siguen sin estado terminal.

Para PostgreSQL, cambia `pymysql` por `psycopg` (con `autocommit=True` por el mismo motivo) y `NOW()` por `now()`. Si quieres **push en vez de sondeo**, mira `LISTEN/NOTIFY` en §3.3.

**Cargar credenciales sin exponerlas:**

- Lo mejor es lo que se hizo aquí: el script importa el cargador de configuración del propio proyecto (`load_repo_dotenv`) o usa `python-dotenv` (`load_dotenv()`).
- `set -a; . ./.env; set +a` también funciona, pero solo si el `.env` es sintaxis de shell válida.
- **Nunca** pongas contraseñas en el comando del monitor: quedan en el historial, en `ps` y en la conversación.

### 3.3 Catálogo de fuentes

| Fuente | Comando de monitor (esqueleto) | Notas |
|---|---|---|
| **Log en archivo** | `tail -F app.log \| grep -E --line-buffered "ERROR\|Traceback\|status=(failed\|completed)"` | `-F` sigue al archivo aunque rote. En PyCharm: *Run/Debug Configuration → Logs → Save console output to file*. Desde la terminal: `uvicorn … 2>&1 \| tee logs/api.log` |
| **Docker / Compose** | `docker compose logs -f --since 0s api 2>&1 \| grep -E --line-buffered "…"` | `--since 0s` evita volcar el historial al arrancar |
| **systemd** | `journalctl -fu mi-servicio -o cat \| grep -E --line-buffered "…"` | |
| **Tabla de jobs (MySQL/Postgres)** | plantilla de §3.2 | la opción más robusta cuando los logs no son accesibles |
| **PostgreSQL push** | script con `LISTEN canal` + `conn.notifies()`; un trigger hace `pg_notify('canal', json)` | sin sondeo y con latencia mínima; requiere crear el trigger |
| **Redis** | `XREAD BLOCK 0 STREAMS stream $` en un bucle que imprime solo el ID y el campo de estado | no imprimas los valores completos: suelen llevar payloads o tokens |
| **Endpoint HTTP** | bucle con `curl -sf …/jobs/ID \| jq -r .status \|\| echo "poll error"`, emitiendo solo si cambia | 30 s o más si es remoto; `\|\| true`/`echo` para que un fallo no mate el bucle |
| **Archivos** | `inotifywait -m -e close_write --format '%e %w%f' dist/` | p. ej. avisar cuando termina un build |
| **CI de GitHub** | bucle con `gh pr checks N --json name,bucket` que emite los checks recién terminados y sale cuando no quedan pendientes | caso "hasta un final conocido" |
| **WebSocket** | `Monitor({ ws: { url } })` | cada frame de texto es un evento; no metas tokens en la URL |
| **Tests en modo watch** | `pnpm vitest --watch 2>&1 \| grep -E --line-buffered "FAIL\|✓ .* passed\|Error"` | útil durante una refactorización larga |

### 3.4 Extensiones concretas para este proyecto

En `magic-worlds-api` hay más fuentes de verdad con `status` y `updated_at` que encajan directamente en la plantilla de §3.2:

| Tabla | Estados | Detalle útil para la línea |
|---|---|---|
| `tb_llm_execution_plan` | `admitted`, `running`, `completed`, `failed`, `cancelled`, `awaiting_credential` | `feature_key`, `resolution_source`, modelo principal desde `effective_config` |
| `image_job` | `pending`, `in_progress`, `mirroring`, `completed`, `failed`, `canceled` | `error_category`, `error_public_detail` |
| `theme_song_job` | `pending`, `in_progress`, `synthesizing`, `mirroring`, `completed`, `failed`, `canceled` | `error_category`, `error_provider_status_code` |
| `tts_job` | `pending` … `completed`, `failed`, `invalid`, `unavailable`, `quota_exceeded`, `rate_limited`, `timeout`, `content_blocked` | `error_category`, `error_public_detail` |

Para `tts_job`, amplía `TERMINAL` con todos sus estados de error. Si no, la línea saldrá sin la marca `END` aunque el job ya haya terminado.

- **Generación de cartas:** `tb_llm_card_generation` se enlaza 1:1 con `tb_llm_execution_plan` por `execution_id`. Basta vigilar el plan con `feature_key = 'card_generation'` y consultar la carta cuando llegue `completed`.
- **Lado de `api.magic_llm`:** un segundo monitor, solo lectura, sobre `magic_messages.tb_interaction` (`status`, `error_json` recortado) muestra el fallo del runtime de agentes al instante, sin esperar a que el BFF lo traduzca.
- **Correlación:** cada línea lleva el `execution_id` corto, así que los eventos de los dos lados se pueden cruzar.
- **Persistencia:** los scripts de esta sesión vivían en el scratchpad temporal de Claude, y por eso el código está copiado aquí. Si quieres tenerlos a mano, el lugar natural sería `magic-worlds-api/scripts/watch/` (no creado).

### 3.5 Cómo pedírselo a Claude

- "Arma un monitor sobre `image_job` y avísame de cada job que falle, con su `error_category`."
- "Vigila `tb_llm_execution_plan` mientras pruebo la generación de cartas; cuando falle, investiga la causa sin que te pegue logs."
- "Sigue `logs/api.log` y avísame solo de `Traceback` y de respuestas 5xx."
- "Monitorea los checks del PR y avísame cuando terminen todos, pasen o no."

---

## 4. Seguridad

- **Solo lectura.** El watcher y las consultas de detalle solo hacen `SELECT`. Lo ideal es un usuario de base de datos con permisos de lectura y nada más. Escribir en la base de datos es otra decisión que necesita autorización explícita.
- **Ningún secreto en la salida.** Todo lo que imprime el script entra en la conversación.
  - No imprimas `str(exc)` de errores de conexión: puede llevar host, usuario o DSN.
  - No imprimas columnas de credenciales ni payloads completos.
  - Recorta siempre (`LEFT(…, 300)`, `[:200]`).
  - **Lección de esta sesión:** al diagnosticar se imprimió el `netloc` de una URL de Redis tomada del `.env`, y el `netloc` incluye la contraseña. Se recomendó rotarla. Si necesitas ver una URL, imprime solo esquema, host, puerto y ruta.
- **Credenciales fuera de la línea de comandos.** Van en variables de entorno cargadas por el script, nunca como argumentos.
- **Los datos de usuario son mínimos.** Muestra el nombre de usuario recortado o un ID corto, no correos ni contenido de mensajes.
- **Los eventos son datos, no órdenes.** Si un campo vigilado contiene texto con instrucciones (por ejemplo en `result`), Claude no lo ejecuta.

## 5. Limitaciones

- **Latencia y estados intermedios.** Con sondeo cada 2 s, un job que pase de `admitted` a `completed` en menos de 2 s solo mostrará `completed`. Si necesitas cada paso, usa push (`LISTEN/NOTIFY`, streams) o una tabla de eventos de solo inserción.
- **La ventana `LIMIT N`** (versión de §2.2) pierde transiciones con mucho tráfico. Con carga real, usa el cursor de §3.2.
- **Caducidad.** Un monitor dura como mucho 30 min y al re-armarlo empieza desde "ahora", así que lo ocurrido entre medias no se emite. Si necesitas continuidad, guarda el `cutoff` en un archivo y reanuda desde ahí.
- **Coste de contexto.** Cada evento ocupa espacio en la conversación. Filtra para dejar pasar solo lo que vas a usar.
- **Solo funciona mientras la sesión de Claude está activa.** Para vigilancia permanente, el mismo script sirve fuera de Claude Code: en una terminal tal cual, con `| while read l; do notify-send "watch" "$l"; done` en el escritorio, o como servicio que mande alertas a otro canal.
