# Runbook operativo de perfiles LLM

**Reconciliación documental 2026-10-14: procedimientos disponibles; ejecución por entorno WIP/TBD.** No aplicar cortes de revisión antigua sobre un schema posterior: el bootstrap BFF actual exige `2026_10_voice_native`. Revisar inspección/preflight y cadena real antes de ejecutar. Este documento no acredita migración, provisión ni publicación; [16](16_current_status_and_roadmap.md) registra el estado actual.

Procedimientos para operar el contrato de perfiles una vez desplegado. El corte de datos está en [09](09_migration_and_rollout.md), los controles de secretos en [05](05_security_and_secrets.md) y el avance local en [12](12_implementation_status.md). Ningún paso de este documento se ha ejecutado contra `.90`.

Regla general: nunca imprimir, pegar ni registrar el valor de una credencial. Los comandos y reportes usan nombres de variables, alias y conteos.

## 1. Gates antes de activar

Los flags `LLM_EXECUTION_ENABLED` (API LLM) y `LLM_PROFILES_ENABLED` (BFF) arrancan en `false`. Activarlos solo después de completar esta lista en el entorno de despliegue:

- **TLS:** HTTPS/WSS de SPA a BFF y HTTPS de BFF a API LLM. BYOK viaja en el body y exige HTTPS también en el tramo BFF → ejecutor.
- **Egress:** API LLM solo puede salir hacia los targets HTTPS provisionados en el catálogo. El BFF no necesita salida directa a proveedores LLM: solo hacia API LLM, `api.auth`, los proveedores de media y sus servicios internos existentes. Los redirects van bloqueados.
- **Logging/APM/proxies:** ningún componente captura bodies de request ni headers `Authorization` (proxy, balanceador, APM, exporters, dumps). Los flags `MAGIC_LLM_DEBUG_PAYLOAD*` de magic-llm solo registran un resumen en ejecuciones protegidas, pero deben seguir apagados en producción.
- **Canary:** en staging, ejecutar cada feature con una clave BYOK ficticia contra un target mock. Después buscar esa cadena en DB, snapshots, checkpoints, auditoría, logs, APM, exporters y archivos temporales; debe haber cero apariciones. Cubrir éxito, error de validación 422, cancelación y retry ([05](05_security_and_secrets.md#verificación-exigida)).
- **Handshake:** el BFF consulta `/v1/llm-execution/capabilities` antes de enviar credenciales. Si la versión no es 1, falta una capability o el servicio está deshabilitado, rechaza el camino nuevo antes de la inferencia.

## 2. Provisión inicial

1. **Catálogo API LLM.** `python -m scripts.provision_execution_catalog` (preflight) y luego `--apply` con `--target-file`, `--connection-file` y `--metadata-file` ([catálogo](/home/andres/PycharmProjects/api.magic_llm/docs/llm_execution_catalog.md)).
2. **Custodia.** `LLM_EXECUTION_CREDENTIAL_CUSTODY` asocia proyecto+target+alias a un nombre de variable. El valor existe solo en esa variable o en el gestor del ejecutor.
3. **Perfiles system.** Root crea y publica los perfiles system. Después fija el default global y las recomendaciones por feature en la consola root (`PUT /admin/llm/policy`).
   - Sin default global la política no se guarda (`SYSTEM_DEFAULT_REQUIRED`).
   - Sin perfil resoluble, la ejecución falla cerrada. No hay modelo de respaldo en env.
4. **Verificación.** `GET /admin/llm/connections` debe mostrar cada conexión `available`, sin revelar la custodia. Después ejecutar la prueba explícita del perfil publicado (`POST /admin/llm/profiles/{id}/test`). Esa prueba es una inferencia real: se hace solo con la credencial platform provisionada.

## 3. Rotación de la credencial platform

API LLM lee la credencial desde su entorno al crear el primer cliente de cada ejecución, después del snapshot. Todos los roles y retries de esa ejecución comparten ese valor. Una restauración crea un contexto nuevo y lee el valor vigente. Por eso:

1. Crear la clave nueva en el proveedor sin revocar la anterior.
2. Actualizar el valor en el gestor o variable de la custodia, con el mismo nombre de variable.
3. Hacer un rolling restart de API LLM. Las réplicas nuevas usan la clave nueva.
4. Drenar las réplicas anteriores hasta que no tengan streams activos. Una ejecución ya iniciada conserva la clave con la que empezó. El `timeout_seconds` de cada rol tiene un máximo de 600 s.
5. Verificar `available` en `/admin/llm/connections` y lanzar una prueba explícita de un perfil que use esa conexión.
6. Revocar la clave anterior en el proveedor y registrar la rotación en el sistema de cambios, sin el valor.

Si la clave se ha filtrado, revocarla primero en el proveedor (las ejecuciones con esa clave fallarán) y repetir los pasos 2–5. Después auditar el alcance según [09](09_migration_and_rollout.md#rollback-concreto). BYOK no participa en la rotación: esas claves nunca llegan al servidor de forma persistente.

Las claves de media del BFF (`FAL_KEY`, `ELEVENLABS_*`) siguen su propio contrato. Se rotan del mismo modo: valor nuevo, rolling restart del BFF y revocación de la anterior tras terminar los jobs en curso.

## 4. Eliminar una asignación

Todas las escrituras exigen `If-Match: "<row_version>"`, obtenido del ETag de la lectura. Una versión desactualizada devuelve `PROFILE_VERSION_CONFLICT` (409).

- **Usuario:** `DELETE /user/llm/preferences/features/{feature}` quita el override de esa feature. La feature vuelve a heredar en este orden: default personal → recomendación root → default global. También se puede reemplazar la preferencia completa con `PUT /user/llm/preferences`.
- **Root, recomendación por feature:** `PUT /admin/llm/policy` con `feature_profiles` sin esa feature. La feature pasa a heredar el default global.
- **Root, default global:** no se puede dejar vacío (`SYSTEM_DEFAULT_REQUIRED`). Solo se reemplaza por otro perfil system publicado.
- **Archivar un perfil:** falla con `PROFILE_IN_USE` (409) mientras cualquier default o asignación del proyecto lo use, incluidas las preferencias de usuarios. No existe reasignación forzada: antes de archivar, root debe publicar el sustituto y retirar sus propias asignaciones, y los usuarios deben cambiar las suyas.

Una ejecución en curso conserva la revisión que congeló al admitirse. Los cambios de asignación afectan solo a ejecuciones nuevas.

## 5. Recarga, cuenta y BYOK

La matriz completa por evento está en [08](08_web_client_root_and_user.md) («Comportamiento implementado por evento»). Resumen operativo:

- La clave BYOK vive solo en memoria de la pestaña. Recargar, cerrar sesión, cambiar de cuenta o caducar la sesión la borra, y el usuario debe introducirla otra vez.
- El perfil y las preferencias persisten en servidor y se recuperan tras recargar.
- Una ejecución BYOK interrumpida no se reanuda automáticamente. Se reanuda con una clave nueva contra el mismo plan y revisión (`BYOK_CREDENTIAL_REQUIRED`). Nunca cambia a platform por su cuenta.
- Un reintento con el mismo request ID de una ejecución terminada no ejecuta ni cobra otra vez: devuelve el resultado retenido o `LLM_EXECUTION_FINISHED`.

## 6. Media

Imagen, canción y voz consumen créditos app por operación según el plan de membership (`image_generation`, `theme_song_generation`, `tts_generation`). Usan las credenciales de media de la plataforma. Seleccionar BYOK para texto no autoriza una clave de fal.ai ni de ElevenLabs. Los writers LLM de media resuelven perfiles system.

## 7. Retención

No hay purga automática de:

- planes de ejecución, recibos ni reservas del BFF;
- snapshots y eventos de API LLM;
- facts de uso.

Ninguno de esos almacenes guarda credenciales, pero sí prompts y resultados del usuario. Antes del release, decidir y documentar:

- plazos por tabla;
- retención de backups;
- tratamiento de backups previos al corte, que pueden contener configuración anterior (paso 5 de «Preparación» en [09](09_migration_and_rollout.md)).

## 8. Corte de datos

Seguir [09](09_migration_and_rollout.md#corte-de-workflows-poblados-implementado): inspección de solo lectura, revisión explícita, preflight y `--apply`. Antes del corte hay que parar los escritores anteriores y hacer backup de MySQL y de `THEME_SONG_STORAGE_ROOT`.

```bash
python scripts/migrations/20261009_llm_profiles.py --inspect-workflows > workflows.json
python scripts/migrations/20261009_llm_profiles.py --inspect-theme-songs > canciones.json
# revisar y editar ambos documentos
python scripts/migrations/20261009_llm_profiles.py --workflow-review-file workflows.json --theme-song-review-file canciones.json
python scripts/migrations/20261009_llm_profiles.py --apply --workflow-review-file workflows.json --theme-song-review-file canciones.json
```

Cada revisión es opcional e independiente. La de workflows solo aplica mientras existan las tablas retiradas de Agent Studio; la de canciones, solo si hay canciones retiradas. El preflight valida las dos antes de cualquier DDL. El apply convierte workflows/cards y deja el borrado de canciones para el final, antes de avanzar el marker.

- **Operaciones de cards `in_flight`:** se rechazan mientras su lease siga vivo.
- **Leases vencidos:** el campo de revisión `cards.reconcile_stale_in_flight: true` los convierte en recibos `failed`, fechados al vencimiento. Es el mismo resultado que el servicio anterior registraba.
- **Workflows sin current:** se retiran del runtime tras revisión explícita. La inspección los marca con `has_current: false` y `retire_unpublished: false`; hay que poner `retire_unpublished: true` en cada uno. Se convierten sin current: el draft y las revisiones guardadas se conservan, ningún runtime los selecciona y Studio los muestra sin publicar (`current: null`). El root puede publicarlos después desde Studio; el corte nunca publica un draft. Sin el acknowledgment, o con marcas que no coinciden con la fuente, el corte se rechaza sin cambios.
- **Canciones de modelos retirados:** se borran tras revisión explícita. Son los jobs de `music_2_6`/`music_3_0` (cualquier alias fuera de `ace_step`/`minimax_music_3`) o del optimizador de letras retirado, más sus assets. No tienen proyección pública: con ellos `/tasks` y las listas de canciones fallarían, y uno sin terminar abortaría la recuperación al arrancar.
  - **Revisión:** `--inspect-theme-songs` emite solo conteos y una huella de identidades, con `delete_retired: false`. Poner `delete_retired: true` sin tocar conteos ni huella. Sin revisión, o con una desactualizada, el corte se rechaza sin borrar filas, como antes.
  - **Storage:** el proceso de migración necesita `THEME_SONG_STORAGE_ROOT`, el mismo directorio del API, si hay assets. Si falta o no existe, el corte se rechaza antes de borrar nada.
  - **Referencias:** cada `theme_song_url` que apunta a un asset retirado pasa a `null`, como al quitar la canción de una card. Se limpian cards, drafts y versiones, snapshots de sesiones, lorebooks e historias, recibos y turnos de asistente, de todos los owners, sin cambiar sus timestamps. También se borran las notificaciones de esos jobs. Las copias importadas son assets propios y se conservan, igual que los jobs actuales.
  - **Archivos:** se eliminan después del commit con el storage de la app, contenidos en la raíz; un archivo ausente cuenta como eliminado. Las filas se borran al final, cuando no queda ninguna referencia.
  - **Resultado:** el apply imprime solo conteos (`jobs`, `assets`, `documents`, `references`, `notifications`, `files_removed`, `files_missing`). No cambia uso, créditos ni ledgers: no guardan IDs de canciones.
  - **Interrupción:** repetir el mismo apply con la misma revisión. Si la conversión de workflows ya borró las tablas retiradas, repetirlo sin `--workflow-review-file`.

### Turnos que el servicio anterior dejó en vuelo

El runtime de perfiles solo recupera turnos con plan de ejecución. Un turno de chat o de asistente admitido antes del corte mantendría su conversación ocupada para siempre. Después del corte de esquema y antes de habilitar `LLM_PROFILES_ENABLED`:

```bash
python scripts/migrations/20261010_interrupted_turns.py
python scripts/migrations/20261010_interrupted_turns.py --review-file revisado.json
python scripts/migrations/20261010_interrupted_turns.py --apply --review-file revisado.json
```

1. **Inspección** (sin flags): solo lectura. Devuelve la base y los conteos `chat_turns`, `chat_guards`, `chat_reservations`, `card_assistant_guards` y `lorebook_assistant_guards`, sin contenido.
2. **Revisión:** guardar esa salida y poner `acknowledge_previous_recovery: true`.
3. **Preflight y apply:** ambos vuelven a contar bajo lock y rechazan cualquier diferencia.
4. **Apply:** aplica las reglas del servicio anterior en una sola transacción:
   - **Chat:** la respuesta en streaming pasa a `interrupted` con `error_category: stale_stream`. Se reembolsan los créditos reservados con referencia `chat_turn:<turn_id>` y se libera el guard, subiendo la versión de la conversación.
   - **Asistentes:** se libera el guard vencido y sube la versión. No se inventa ninguna respuesta.

Rechaza sin cambios en estos casos:

- un lease todavía vivo: chat < 300 s o asistente < 10 min;
- una respuesta `pending`;
- un guard inconsistente;
- conteos distintos de los revisados.

Los turnos y guards que pertenecen a un plan de ejecución nunca se tocan. Usa el mismo lock advisory que el corte de esquema.

### Columna `id_model` de agentes en API LLM

La escritura de `id_model=150` ya se retiró de `create_identity`, y el verificador SQL crea identidades sin ese campo. El DDL del corte está en [20261010_retire_agent_model_reference.sql](/home/andres/PycharmProjects/api.magic_llm/scripts/migrations/20261010_retire_agent_model_reference.sql). Debe aplicarse durante el mismo despliegue, con los escritores detenidos, antes de iniciar el writer nuevo sobre una tabla antigua con `id_model NOT NULL`.

1. Confirmar con `SHOW CREATE TABLE magic_manage.tb_agent_flow` la columna, el índice `tb_agent_flow_cat_model_id_model_fk` y la ausencia de FK sobre esa columna.
2. Terminar la inicialización/versionado y revisar su evidencia: el verificador anterior hashea todas las columnas de la identidad, por lo que retirar una columna cambia su fingerprint. No presentar esa prueba previa como fingerprint posterior al corte.
3. Ejecutar el DDL revisado: elimina el índice y la columna en un único ALTER de MySQL 8. Conserva metadatos, revisiones y asociaciones.
4. Desplegar el writer sin `id_model` y comprobar creación de una identidad nueva.

Calificación local: tres casos SQL sobre MySQL propio sin red verifican conservación de datos, creación nueva y rechazo atómico cuando existe una FK no revisada. El verificador completo de versionado también pasa. No se ejecutó el DDL en `.90`.

### Defaults elegidos: OpenRouter

La elección vigente es OpenRouter con Opus/Sonnet y caché de prompt. La preparación de catálogo, custodia y cinco drafts root está en [15](15_openrouter_defaults.md). El transporte vigente sigue siendo el compatible con Chat Completions de `magic-llm`; no se instaló ningún SDK ni se aplicaron los cambios de Anthropic directo preparados en staging.
