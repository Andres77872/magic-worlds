# Plan de implementación y criterios de aceptación

**Revisado 2026-10-15. Estado: fundamento implementado, remediación y aceptación abiertas.** El checklist inicial mezclaba tareas ya implementadas con garantías pendientes. El estado de cada pendiente se mantiene en [16](16_current_status_and_roadmap.md), sin usar casillas antiguas como nueva autorización de ejecución.

## Entregables y disposición

| Área | Disposición actual | Aceptación pendiente |
|---|---|---|
| Root/user profiles, revisiones, resolución y selección | Implementados en frontend/BFF | Ownership, compatibilidad y publicación/defaults por entorno |
| Admisión, planes, reservas y pagador | Implementados en BFF | Replay/retry/fallo/cancelación/resultado tardío y conciliación de efectos/cuotas/cargos |
| Memoria BYOK del navegador | Implementada; sin almacenamiento web persistente para la clave | Aislamiento y limpieza en cuenta/proyecto/target, recarga y credencial reingresada |
| Copy de custodia BYOK en UI | Publicado; sobreafirma la no persistencia en servidores (F11) | Limitar a propiedades verificadas de memoria de pestaña hasta cerrar F04; prueba de regresión del copy EN/ES |
| Transporte protegido | **Brecha activa**: BFF usa graph materializado en completion original | Clave fuera de graph/snapshot/hash y cliente privado autorizado; canario end-to-end |
| Runtime/nodos genéricos | **Hallazgos abiertos** | Cierre individual de F01–F11; helper aislado no protege los demás caminos |
| Planner de chat | Corregido en fuente `2c2973d`; smoke fechado registrado en voz | Mantener regresión y aceptación del artefacto desplegado |
| Calidad y defaults | Preparación offline del 2026-10-10, sin publicar ni evaluar ([16](16_current_status_and_roadmap.md#evidencia-y-precedencia)) | Evals por feature/grafo/modelo, provisión y precios actuales |
| Schema y rollout | Herramientas y contratos existen; revisión depende del artefacto | Preflight/restore y aceptación del entorno real; [09](09_migration_and_rollout.md) |
| Media/callbot BYOK personal | Fuera de la activación personal actual | Decisión explícita y contratos completos antes de exponer selección |

La decisión del 2026-10-09 de retirar compatibilidad antigua sigue siendo criterio del refactor, no prueba de que cada runtime instalado la satisfaga. El cleanup no cambia esa decisión ni permite atribuir al camino actual los cierres del log histórico.

## Matriz de aceptación que permanece vigente

| Dimensión | Casos que deben tener evidencia ligada a revisión/entorno |
|---|---|
| Configuración | Herencia, override, selección inválida, publish/rollback, edición concurrente y catálogo incompatible/retirado |
| Identidad | Cross-user/project/workspace, root scope, cliente directo/delegado y bindings/destinos autorizados |
| Ejecución | Feature/rol, HTTP/SSE/WS, salida validada, cancelación, nuevo intento y resultado tardío |
| Cobro | BYOK con saldo cero/cargo app cero, capacidad por pagador, platform sin doble débito/refund y media independiente |
| Seguridad | Canario ficticio en éxito/error/422/timeout/retry/nested/restore; ausencia del valor/derivados en todos los sinks aplicables |
| Retención | Contexto/prompts deliberadamente congelados documentados; TTL, acceso, borrado y backups separados de secretos |
| Operación | Schema exacto, locks/restart/drain, provisión, rotación y rollback compatible |
| Calidad | Evals en/es por workflow y latencia real, sin inferir calidad de un capability o JSON offline |

[El registro de seguridad](../security/README.md) especifica el cierre por hallazgo; [05](05_security_and_secrets.md) conserva el requisito. La verificación canaria debe recorrer **el transporte usado**, no solo una factory alternativa.

## Verificación al implementar

Ejecutar pruebas relevantes de los repositorios modificados y conservar resultados sanitizados con revisiones. En frontend, `pnpm build` es la señal principal; stories requieren `pnpm typecheck:stories` cuando cambian. No sumar grupos históricos solapados ni citar `/tmp/` como única evidencia durable.

Este cleanup solo modifica documentación. No ejecutó suites de aplicación, consultas de DB, inferencia, migraciones, provisión ni despliegue. La validación documental comprueba rutas y anchors; no cierra la aceptación del producto.
