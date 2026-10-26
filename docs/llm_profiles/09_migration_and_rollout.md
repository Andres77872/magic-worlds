# Migración, despliegue y recuperación

**Revisado 2026-10-15. Estado: aceptación operativa abierta; instrucciones históricas retiradas del flujo activo.** Esta referencia prepara una revisión de entorno. No ejecuta una migración ni acredita provisión/despliegue. Los comandos de cortes antiguos no deben copiarse sobre una base posterior.

## Precedencia de revisión

- El [bootstrap BFF actual](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py) espera la revisión nombrada por `CONTENT_SCHEMA_REVISION` (propiedad de la ejecución activa de Fish/voz; no se afirma aquí); el marker de capacidad workspace conserva `2026_10_workspace_r1`.
- La revisión fuente, el binario/paquete instalado y el marker real de una base son datos distintos. Los gates de release de Fish están en [V-14](../voice_refactor/00_current_status_and_roadmap.md).
- El [runbook vigente](14_operations_runbook.md) y la [guía de base del BFF](../../../../PycharmProjects/magic-worlds-api/docs/database.md) prevalecen para determinar precondiciones y cadena soportada.

## Preparación por entorno

| Paso | Evidencia necesaria antes de aplicar |
|---|---|
| Identificar artefactos | Revisiones frontend/BFF/API/runtime, paquetes realmente cargados, configuración permitida y escritores activos |
| Inspeccionar schema | Marker y estructura exacta; preflight de la revisión instalada; nunca asumir vacío por un log anterior |
| Revisar transición | Cadena soportada, conteos/huellas públicas, conservación de balances, ownership, procedencia y reconciliación en vuelo |
| Preparar recuperación | Backup/restauración ensayados, retención, locks/drain y artefacto compatible con el schema destino |
| Provisionar | Targets/modelos evaluados, conexiones autorizadas, perfiles publicados y asignaciones; los JSON offline no equivalen a provisión |
| Aceptar operación | Matriz feature/pagador, cuotas/cargos, fallos/retry/cancelación y seguridad; ninguna suite histórica certifica el entorno |

La decisión de procedencia se mantiene: el historial de cards y los facts de uso del ejecutor se convierten una sola vez con procedencia `unattributed` ([corte BFF](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/card_history_cutover.py), [catálogo API LLM](../../../../PycharmProjects/api.magic_llm/docs/llm_execution_catalog.md)); no fabricar perfil, proyecto o pagador del histórico; resultados sin plan ejecutable no se convierten en nuevas inferencias. Los cortes de datos tienen precondiciones y acknowledgements explícitos. Este documento no autoriza borrados ni el replay de un corte ya aplicado.

## Bloqueos vigentes

La custodia end-to-end permanece abierta: el BFF materializa BYOK dentro del grafo outbound. No presentar el gate, el catálogo o una factory alternativa como cierre de seguridad. Ver [F01–F11](../security/README.md), [API actual](07_api_changes.md) y [LLM-R3](16_current_status_and_roadmap.md).

El handshake/restore upstream y la cadena de catálogo del diseño protegido no conectado son alcance de diseño, no comportamiento actual de este transporte. La respuesta upstream perdida es terminal; la recuperación de resultados y nuevos intentos BFF debe verificarse por consumidor.

## Rollback

- Calidad: root mueve current a una revisión previa del **mismo perfil**. Las solicitudes nuevas usan esa revisión; las ejecuciones en curso conservan la suya.
- Resolución: pausar nuevas ejecuciones afectadas y restaurar la policy previa con auditoría, sin perder overrides personales ni resolverlos con otro pagador.
- BYOK: deshabilitar BYOK de la feature (`byok_enabled` del registro de features), limpiar la memoria activa cuando corresponda y devolver error. Nunca reenviar ni debitar en platform.
- Esquema: no activar ejecuciones afectadas; reparar y verificar el esquema nuevo. Un rollback de app solo puede usar un artefacto compatible con perfiles, bindings y custodia nuevos, sin reinstalar el catálogo ni la ejecución retirados. Nunca ejecutar un DOWN destructivo sobre tablas con planes o perfiles de usuarios: DDL y rollback lógico de perfil son operaciones distintas.
- Secreto platform: revocar/rotar en proveedor y gestor, invalidar caches/clientes y auditar el alcance, sin mostrar el valor en UI ni en reportes.

## Registro de aceptación

Por cada entorno, guardar fecha, revisión, operador responsable, preflight revisado, resultado aplicado, verificaciones de saldos/ownership, pruebas de producto y rollback compatible. No actualizar los viejos conteos o frases de `.90` como si se hubieran comprobado hoy. [16](16_current_status_and_roadmap.md) es el estado mantenido.
