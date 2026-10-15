# Migración, despliegue y recuperación

**Reconciliación documental 2026-10-14: diseño/contratos del dossier original.** El código de perfiles existe y varios entregables se cerraron localmente después. Las propuestas y criterios de este archivo no acreditan rollout; usar [16](16_current_status_and_roadmap.md) para implementación actual, WIP operativo y TBD, y 12 para historia de pruebas.

## Reglas de transición

El usuario exige un corte completo de contrato LLM, sin mantener legacy. La entrega retira configuración antigua, aliases, hydrators, credenciales en DB, DTOs/wrappers y caminos de ejecución/cobro/restore anteriores. No activar BYOK hasta que transporte, persistencia, autorización y cobro hayan pasado pruebas. El avance local está en [12](12_implementation_status.md); no se aplicaron migrations ni cambios de entorno a `.90`.

El rollback de seguridad nunca vuelve a introducir claves BYOK en grafos. Si falla la integración personal, deshabilitar nuevas ejecuciones BYOK y mostrar indisponibilidad. El usuario puede seleccionar explícitamente un perfil platform si quiere; el servidor no hace ese cambio automáticamente.

## Preparación

1. Registrar revisiones desplegadas de los cinco repositorios, DB version/schema y consumidor de cada conexión del catálogo.
2. Revisar presencia y nombres de env legacy sin imprimir valores.
3. Enumerar features/graphs productivos, defaults actuales, parámetros y dependencias internas.
4. Verificar infraestructura: TLS/WSS, body buffering, logs, APM, dumps, exporters y retención. No habilitar BYOK en un deployment con captura de bodies.
5. Revisar en entorno controlado el camino de snapshots de grafos hidratados. Si se demuestra persistencia histórica de secretos, rotar claves de plataforma y tratar los registros/backups afectados según procedimiento operativo.
6. Definir cuotas BYOK y scope de catálogo/conexiones; enumerar todos los consumidores que deben pasar al contrato nuevo antes del corte.

## Orden de despliegue recomendado

| Fase | Cambio | Condición para avanzar |
|---|---|---|
| A | API LLM soporta plan/bindings seguros y credencial externa al grafo; feature flag desactivado | Canary secret ausente de admisión/snapshot/debug, auth y adapter tests verdes |
| B | Todos los consumidores usan transporte nuevo y perfiles; retirar envío/hydrators anteriores | Handshake y acknowledgement por request; ningún secreto en grafo outbound ni ejecución del contrato retirado |
| C | Bases, catálogo, servicios de perfiles/defaults, root API y provisión explícita | Fresh/upgrade convergen; catálogo independiente del esquema retirado |
| D | Root UI y resolución platform por feature | Root puede validar/publicar/rollback; system usage/cargo no cambia por accidente |
| E | Preferencias de usuario usando perfiles system | Ownership/gates/herencia e idempotencia probados |
| F | Perfiles personales, clave volátil, admisión BYOK=0 y consumers interactivos | Seguridad end-to-end, saldo cero, helpers, streams/WS/retry/restart probados |
| G | Corte definitivo y activación por usuario/feature | Ningún legacy en código/schema fresh/env/consumidores; telemetry y rollback del contrato nuevo probados |
| H | Writers de media/callbot BYOK, si se desea | Nueva validación de jobs, voz, costos y recuperación; fuera de primera activación |

Estas fases ordenan el trabajo local y las verificaciones, no habilitan dos runtimes. El despliegue corta al contrato nuevo después de convertir todos los consumidores. Una feature no preparada permanece indisponible; no vuelve a un hydrator ni a un alias retirado. Eliminar también pruebas y fixtures que solo mantengan compatibilidad con el camino anterior.

## Provisión explícita

Provisionar targets HTTPS, descriptores evaluados y grants de proyecto en el catálogo nuevo. Registrar conexiones con alias opaco y provisionar aparte la custodia project+target+alias en env/gestor del ejecutor. No copiar claves ni identidades antiguas, ni conservar un importer de configuración por feature dentro del runtime.

Root crea/publica los perfiles system y asigna un default y recomendaciones explícitas. Primary, metadata y preflight se validan contra el catálogo y el contrato de cada feature. Una conexión o un default ausente impide ejecutar; ningún env del BFF suministra un modelo o una clave alternativa.

Retirar las variables antiguas de modelos, sampling y credenciales LLM del BFF, y quitar `provider_key`/headers secretos del catálogo instalado. Las claves de servicios de media mantienen su propio contrato. La API devuelve disponibilidad de conexión sin divulgar la custodia.

## Upgrade de base

Preparar migrations independientes por repositorio:

- BFF: tablas nuevas/links, reservas de capacidad, cambios de provenance e índices, seeds sin secrets, schema revision nuevo y contracts bootstrap.
- API LLM: targets/conexiones, identidad nueva de modelos, precios/uso y snapshots seguros; retirar tablas/columnas y lectores del catálogo anterior.

Usar prechecks, backups conforme a retención y migrations con marcador final. Probar sobre copia sanitizada que ninguna FK/índice/check deja defaults huérfanos o altera saldos. Fresh install y upgrade deben converger en un schema válido. No esconder diferencias desactivando el bootstrap exacto.

El catálogo API tiene un corte explícito separado del uso histórico y del BFF: después de provisionar/evaluar las cinco tablas nuevas y detener los escritores anteriores, `python -m scripts.retire_provider_catalog` devuelve el nombre de base y conteos de sus ocho tablas retiradas, sin leer valores de configuración/credenciales. `python -m scripts.retire_provider_catalog --retirement-file retirement.json --apply` exige ese preflight revisado, bloquea ambos catálogos, revalida conteos/contratos/dependencias y elimina las ocho tablas en un solo DROP. Conserva las seis tablas de identidad y sus saldos. Los tests SQL aislados comprueban el corte poblado, cambios concurrentes, metadata inválida, dependencias externas y cancelación; no se ejecutó sobre `.90`. Los cortes de uso histórico y datos BFF están implementados y deben operarse de forma explícita antes del release.

No escribir ALTERs en el `db.sql` de fresh install si su validador solo acepta el DDL canónico. Seguir el patrón de scripts/migrations existente y actualizar el contrato final. Planificar locking/tiempo de ALTER sobre tablas de alto volumen antes de production.

## Contrato nuevo y Agent Studio

Todos los requests usan el schema nuevo. Omitir una selección explícita significa heredar el perfil efectivo; no significa utilizar configuración antigua. Si la selección efectiva necesita BYOK, devolver `BYOK_KEY_REQUIRED` antes de admitir o cobrar. Clientes que usan campos/aliases retirados reciben error; no hay shim de traducción ni cambio de pagador.

Antes de enviar una credencial, el BFF consulta `/v1/llm-execution/capabilities` mediante su delegación autorizada y exige versión 1, `enabled`, `symbolic_clients` y `transient_credentials`. Un 404, versión desconocida, capability ausente o servicio deshabilitado rechaza el nuevo camino antes de inferencia. Readiness general no sustituye este contrato. En despliegues con réplicas de distintas versiones, la misma versión debe declararse y validarse también en cada request; ningún cliente puede interpretar una respuesta legacy como ejecución del plan autorizado.

Mientras se corrige Studio, mapear su opción de default a una selección estructurada en UI/backend y retirar el placeholder `env.CARD_LLM_MODEL`. No permitir que una copia custom con modelo fijo quede presentada como herencia dinámica. Mantener los built-ins productivos como fuente de topology y validar los hashes cuando se adapten bindings/model slots.

Convertir también Studio al contrato de perfiles y retirar sus campos/tests de sampling y auth anteriores. El workflow sigue versionando prompts/topología; el perfil versiona modelo/settings. La conversión no publica ni reasigna un workflow sin revisión.

## Rollout y observabilidad

Flags por capacidad: profile resolver platform, UI root, preferencias personales, BYOK y BYOK por feature. El flag del servidor decide soporte real; el del cliente solo controla presentación.

Monitorear por feature y payer: fallos de compatibilidad, provider auth/rate limit, latencia, tokens, retries, cancelación, utilización de capacidad y cargo app. Usar IDs de request/profile/revision; evitar high-cardinality innecesaria de nombres de usuario y cualquier secreto en labels. Quality evals por perfil publicado antes de ampliar tráfico.

Evaluar contratos y calidad con fixtures versionadas del workflow nuevo. No entregar modo shadow, comparación dual ni inferencia duplicada para sostener el runtime retirado.

## Rollback concreto

- Problema de calidad: root mueve current a revisión previa del **mismo perfil**. Solicitudes nuevas usan esa revisión; en curso conservan la suya.
- Problema de resolver: pausar nuevas ejecuciones afectadas; restaurar policy previa con auditoría. No perder overrides personales ni resolverlos con pagador distinto.
- Problema BYOK: deshabilitar BYOK para la feature, limpiar memoria activa cuando corresponda y devolver error. No debit/forward nuevo en modo platform.
- Problema de migración: no activar ejecuciones afectadas y reparar/verificar el esquema nuevo. Un rollback de app solo puede usar un artefacto con perfiles/bindings/custodia nuevos, sin reinstalar el catálogo ni la ejecución retirados.
- Problema de secreto platform: revocar/rotar en proveedor y gestor, invalidar cache/clients y auditar alcance. No mostrar el valor en UI ni reporte.

No ejecutar DOWN destructivo sobre tablas con planes/profiles de usuarios para recuperar servicio. SQL DDL y rollback lógico de perfil son operaciones distintas.

## Jobs y restart

La entrega inicial BYOK interactiva no persiste credenciales para restart. Una operación interrumpida puede conservar su plan/estado seguro y pedir reingreso; el reinicio no debe convertirla en platform. La reanudación se autoriza con el mismo subject/proyecto, se revalida destino y usa una credencial nueva.

En canciones, la recuperación actual reanuda etapas synthesizing/mirroring con trace ID y falla etapas no reanudables. Si el escritor BYOK ya acabó, puede seguir la etapa de media existente usando credenciales de media propias. No guardar la key LLM en input_summary para cubrir la etapa previa. Ampliar el drawer de tareas solo cuando exista un contrato backend para esos nuevos estados.


## Corte de workflows poblados implementado

El script `magic-worlds-api/scripts/migrations/20261009_llm_profiles.py` trabaja sobre la base explícitamente configurada para ese proceso. `--inspect-workflows` inicia una transacción de solo lectura, verifica el esquema anterior y devuelve una plantilla con `version`, `database`, `counts`, `source_sha256` y `workflows`; no muestra prompts, modelos, routing ni credenciales. Cada workflow requiere un `project_hash` y `creator_user_id` root existentes, revisados explícitamente. Las huellas cubren solo los campos públicos que serán convertidos. Un workflow sin current (solo draft) aparece marcado con `has_current: false` y `retire_unpublished: false`.

Guardar y revisar la plantilla; rellenar todas las asignaciones y conservar base/conteos/huellas. Con el mismo entorno, ejecutar primero `python scripts/migrations/20261009_llm_profiles.py --workflow-review-file /ruta/revisada.json` para el preflight. Solo el comando con `--apply --workflow-review-file /ruta/revisada.json` aplica la conversión. Las inspecciones son incompatibles con apply y con los review-files. Los errores del CLI imprimen la clase, sin dumps del documento o conexión.

El corte preserva prompts/output, IDs, números de revisión y current. Reemplaza los compiled graphs con el grafo canónico del contrato actual; toda configuración LLM anterior se descarta. Las asignaciones revisadas proporcionan la atribución que el esquema anterior no registraba. Los autores registrados deben existir. No publica drafts ni provisiona modelos/perfiles/defaults; eso requiere provisión explícita del contrato nuevo antes de habilitar ejecuciones.

Workflows sin current se retiran del runtime tras revisión explícita: cada uno exige `retire_unpublished: true` junto a su marca `has_current: false`. Se convierten sin fila en `tb_llm_workflow_current`; su draft y sus revisiones guardadas se conservan en `tb_llm_workflow` y `tb_llm_workflow_revision`. El corte nunca publica un draft. Ningún runtime los selecciona; Studio los lista con `current: null` y `current_version_number: null`, solo prueba su draft (`source: "current"` devuelve `WORKFLOW_UNPUBLISHED`) y el root puede publicarlos después. Sin el acknowledgment, o si las marcas no coinciden con los current de la fuente, el preflight y el apply se rechazan sin cambios.

Las canciones de modelos retirados tienen su propia revisión, independiente de la de workflows y válida con o sin las tablas retiradas de Agent Studio. `--inspect-theme-songs` devuelve `version`, `database`, `delete_retired: false`, `counts` (`jobs`, `assets`) e `identity_sha256`, una huella de los IDs de jobs y assets y sus rutas guardadas; no muestra letras, prompts, rutas ni contenido. El borrado es irreversible y exige `delete_retired: true` en `--theme-song-review-file`, además de `THEME_SONG_STORAGE_ROOT` cuando hay audio. Sin revisión, o con conteos/huella desactualizados, el corte se rechaza sin borrar filas.

Preflight valida fuente y destinatario; la fuente se vuelve a verificar bajo locks. Una inserción interrumpida sin commit se revierte; datos confirmados se verifican exactamente en el siguiente apply, sin upsert ni duplicación. El DROP de las seis tablas retiradas es atómico y los metadata locks tienen timeout de cinco segundos, restaurado al cerrar la operación. Una interrupción deja el marker anterior hasta completar la verificación de esquema.

Orden del apply: preflight de todas las revisiones antes del DDL, creación de tablas y seeds, conversión revisada de workflows/cards (o retiro de tablas vacías) y, al final, el borrado de canciones retiradas, justo antes de verificar el esquema y avanzar el marker. El borrado ocurre en tres pasos. Primero, bajo locks, vuelve a comprobar conteos y huella, pone a `null` cada `theme_song_url` que apunta a un asset retirado y borra las notificaciones de esos jobs. Las referencias están en cards, drafts y versiones, snapshots de sesión, lorebook e historia, y en recibos/turnos; se buscan en todos los owners y se conservan sus timestamps. También marca los assets como borrados. Después del commit elimina los archivos con el storage de la app, contenidos en su raíz; un archivo ausente cuenta como eliminado. Por último, bajo locks, vuelve a comprobar las mismas identidades, prueba que no queda ninguna referencia y borra las filas de assets y jobs. Uso, créditos y ledgers no cambian: no guardan IDs de canciones. Una interrupción conserva las identidades revisadas, así que repetir el apply con la misma revisión termina el borrado. Si la conversión de workflows ya eliminó las tablas retiradas, se repite sin `--workflow-review-file`.

Las cards pobladas requieren además la sección `cards` de la plantilla: huellas exactas de las tres fuentes y `acknowledge_unattributed: true` tras revisar la procedencia desconocida. No borrar registros para pasar el preflight. La conversión conserva resultados validados y estados terminales como recibos sin plan ejecutable; los contadores históricos permanecen separados de platform/BYOK y no alteran créditos. Cualquier request/cuota en vuelo exige reconciliación antes del DDL. Con los escritores anteriores detenidos, `cards.reconcile_stale_in_flight: true` (falso por defecto en la plantilla) aplica la regla del servicio anterior: cada operación cuyo lease venció pasa a recibo `failed` fechado en ese vencimiento, sin card, resultado ni cargo, y los contadores en vuelo se descartan. Un lease vivo sigue rechazando el preflight y el apply. Los turnos de chat/asistentes que el servicio anterior dejó en vuelo se reconcilian después del corte con `scripts/migrations/20261010_interrupted_turns.py`. Las canciones de modelos retirados se borran solo con su revisión ([runbook](14_operations_runbook.md#8-corte-de-datos)).

El digest de la clave de idempotencia se convierte a la identidad actual de operación, separado del ID de correlación. Su reutilización devuelve `OPERATION_HAS_NO_EXECUTION_PLAN` antes del catálogo/proveedor. Los inputs/configs, hashes del contenido de request y errores privados anteriores no se importan. Los nuevos GET `/llm/receipts`, `/llm/receipts/{receipt_id}` y `/llm/capacity-usage` consultan únicamente el proyecto/usuario/grupo autenticados y responden con `no-store`. [ADR de procedencia](13_historical_provenance.md).

El upgrade exige la revisión de origen exacta `2026_09_theme_song_fal`. Un prototipo ya marcado `2026_10_llm_profiles` con tablas diferentes falla la verificación; no se corrige silenciosamente. La validación usó únicamente MySQL local efímero y proveedores mock, sin conectar ni migrar `.90`. La entrega completa sigue sujeta a [10](10_implementation_plan_and_acceptance.md) y [12](12_implementation_status.md).


## Corte del uso histórico API

`scripts.upgrade_usage_profiles` exige `--socket`, `--database` y `--catalog-database` explícitos. Sin `--apply` inspecciona/prevalida; apply requiere `--review-file` con conteos/huellas y los cuatro acknowledgements verdaderos. El origen soportado es el contrato anterior de 25 columnas; un prototipo o drift distinto requiere reconciliación. El runbook completo está en [catálogo API](/home/andres/PycharmProjects/api.magic_llm/docs/llm_execution_catalog.md).

El corte conserva IDs físicos, proveedor/modelo observado, tokens, fecha, estados y correcciones. Verifica el owner existente, sin inventar proyecto/perfil/revisión/rol/pagador. Convierte esos facts a procedencia/pagador `unattributed`, con costo desconocido. La revisión acepta eliminar irreversiblemente metadata privada y cotizaciones no verificables; saldos/ledgers no cambian. [Decisión de procedencia](13_historical_provenance.md).

Fresh y upgrade convergen en 41 columnas, índices/FKs/CHECKs y la única vista `v_request_usage`. La admisión nativa verifica ese contrato antes de acceder o crear un run ejecutable y rechaza estados parciales. El corte se reanuda con la misma revisión; libera locks y restaura el timeout. Cambios en agrupación AND/OR de los CHECKs se rechazan aunque tengan los mismos términos.

Este código se calificó en MySQL local aislado; no se ejecutó el corte en `.90`. La operación del release y el cierre del objetivo completo siguen pendientes.
