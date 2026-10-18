# Estado actual y roadmap de perfiles LLM

> **Actualización local 2026-10-18:** el transporte BYOK separa credenciales de
> `agt`, la admisión/replay exige clave por solicitud y el runtime guarda solo
> bindings sin secreto. Faltantes y claves rechazadas tienen errores específicos;
> no se filtra contenido LLM. Ver el contrato implementado y rollout en [07](07_api_changes.md).
> El inventario fechado debajo describe la inspección histórica del 15 de octubre;
> no representa una certificación del despliegue ni una limpieza de copias previas.


**Revisión de fuentes/documentación: 2026-10-15. Estado: fundamento funcional implementado; custodia y aceptación operativa pendientes.** Este ledger es la autoridad de estado de perfiles LLM; no acredita el runtime/paquete ni la configuración de una instalación desplegada.

## Estado verificable

Fuentes inspeccionadas: frontend HEAD `5a29ad5`, BFF `2c2973d`, API LLM `d86273d` y magic-agents `91fa8d6`, con working trees concurrentes. Los HEAD no identifican por sí solos cambios locales ni paquetes cargados; esta es una revisión de fuentes del 15 de octubre. No se ejecutaron DBs/proveedores ni suites de aplicación.

| Área | Implementación actual | Límite / aceptación pendiente |
|---|---|---|
| Perfiles root/personales y selección | Consolas, DTOs, repositorio, resolución y rutas BFF presentes. Las páginas `#/models` y `#/image-models` no tienen flag de frontend (visibles para usuarios autenticados; el servidor exige `LLM_PROFILES_ENABLED`); los controles de modelo por feature siguen el flag de su feature (`isLlmFeatureEnabled`) | Pantallas y catálogo no prueban publicación, compatibilidad ni calidad por feature |
| Admisión / ejecución | El BFF conserva planes y grafos simbólicos, luego renderiza clientes al transporte original `/v1/chat/completions` | El payload outbound es `{agt,messages,stream}` con `engine/model/api_info`; no conserva el binding privado en el límite upstream |
| Gate BFF | `LLM_PROFILES_ENABLED` controla carga del transporte; sin él hay `503 LLM_PROFILES_DISABLED` | Desactivar el gate no aporta fallback de routing ni prueba el transporte protegido |
| BYOK navegador | Memoria transitoria, aislamiento por identidad y controles HTTPS en cliente | Esa propiedad del navegador no acredita no persistencia en ejecutor/DB |
| Custodia BFF → ejecutor | `_render_clients` coloca la clave suministrada en el grafo; el ejecutor inline captura authored graphs | **F04 abierto:** el camino fuente permite retener la clave. No se escanearon claves/DBs reales en este cleanup |
| Runtime genérico | El checkout `NodeClientLLM` aún resuelve configuración y crea el cliente durante construcción | **F05 abierto:** no presentar el cierre histórico de cliente simbólico como estado instalado actual |
| Retry / recuperación | Planes/recibos BFF y flujos de reconciliación por feature existen | Transporte upstream perdido/inválido es terminal. Verificar replay, retry explícito, credencial reingresada y efectos/cargos por intento |
| Assistants | Registry `card`, `lorebook`, `app`; el digest de app entra al payload congelado | No existe kind `novel`; el contexto no se guarda en conversación/turn, pero sí puede persistir en el plan de ejecución; [retención](../security/README.md#content-retention-is-a-separate-contract) |
| Media / callbot | Features y writers resuelven política/perfiles. El registro aún incluye `moderation`, contrato legacy de clasificador de speech (interno: sin selección personal, BYOK ni créditos platform) que el [plan de moderación nativa](../moderation/README.md) debe retirar | BYOK de texto no hace gratuitas las operaciones de media ni habilita selección personal donde el contrato no la permite |

Fuentes: [transporte BFF](../../../../PycharmProjects/magic-worlds-api/src/services/llm_execution_transport.py), [test del cuerpo outbound](../../../../PycharmProjects/magic-worlds-api/tests/services/test_llm_execution_transport.py), [carga/configuración](../../../../PycharmProjects/magic-worlds-api/src/services/llm_profile_api.py), [snapshot](../../../../PycharmProjects/api.magic_llm/src/util/execution_snapshot.py), [cliente runtime](../../../../PycharmProjects/magic-agents/magic_agents/node_system/NodeClientLLM.py), [sesión frontend](../../src/features/llmProfiles/LlmSessionProvider.tsx), [memoria BYOK](../../src/features/llmProfiles/credentialSession.ts).

La factory protegida de `api.magic_llm/src/services/llm_execution.py` existe, pero su presencia no establece que este BFF la use. La ruta actual renderiza la credencial dentro de `agt`; limpiar diccionarios después de serializar no elimina la copia del receptor. El [registro F01–F11](../security/README.md) mantiene los límites y criterios de cierre. La promesa de [05](05_security_and_secrets.md) es un requisito pendiente, no una garantía implementada end-to-end.

Ese camino protegido tampoco es alcanzable por HTTP: `src/routes/__init__.py` de API LLM no registra el router `llm_execution_recovery` y ninguna ruta importa `services/profile_admission.py`. `PrivateOutputGuard` solo se usa en `llm_execution.py` (`assert_safe_output`) dentro de ese camino. El BFF retira `client_binding` del grafo outbound, así que la privacidad simbólica de helpers de `d86273d` no se aplica a grafos del BFF; ese filtrado depende del BFF `2c2973d`. Detalle en [07](07_api_changes.md).

## Roadmap / decisiones pendientes

| ID / prioridad | Estado | Trabajo pendiente | Criterio de cierre |
|---|---|---|---|
| LLM-R1 / P0 | WIP operativo | Matriz feature/pagador/admisión/retry/cobro en revisiones realmente desplegadas | Catálogo/perfiles/evaluaciones y reconciliación de éxito/fallo sin doble cargo |
| LLM-R2 / P0 | WIP por entorno | Verificar cadena de schema, referencias y workflows/turnos retenidos antes de un corte | Preflight exacto, conservación de saldos/datos, recuperación y revisión de apply; [runbook](14_operations_runbook.md) |
| LLM-R3 / P0 | **Abierto — custodia** | Retirar credenciales de graph/snapshot/fingerprints y revalidar nodos/destinos. El copy EN/ES fue corregido el 2026-10-17 a propiedades locales verificadas; F04 sigue abierto | Canario ficticio por BFF y runtime reales, ausencia en todos los límites durables/públicos, cierre por hallazgo; copy limitado a memoria de pestaña verificada con prueba de regresión (F11) |
| LLM-R4 / P1 | WIP calidad | Evaluaciones por grafo/feature/capacidad y precios revisados | Evidencia real antes de publicar defaults; JSON offline no acredita un modelo |
| LLM-R5 / P1 | WIP recuperación | Pérdida de clave, recarga, cambio de cuenta/workspace, retry terminal y resultados tardíos | Intención preservada, credencial reingresada, aislamiento y efectos idempotentes |
| LLM-R6 / P1 | **Resuelto en fuente y smoke de prueba registrado** | BFF `2c2973d` filtra `mw_read_card` consumido por el grafo bajo el contrato narrativo | Evidencia del 14 de octubre en [voz](../voice_refactor/00_current_status_and_roadmap.md); mantener regresión y aceptación de producción en LLM-R1 |
| LLM-R7 / P2 | TBD | Responsables, entorno, retención y selección personal adicional. Borrado de cuenta: coordinar perfiles, preferencias, planes, recibos, uso y auditoría LLM según la política de privacidad, sin CASCADE general y conservando solo datos mínimos permitidos; el perfil se archiva (soft archive) y las revisiones usadas por ejecuciones se conservan con FKs `NO ACTION`/RESTRICT; nunca se borran | Decisión explícita y política visible |

El bootstrap BFF exige la revisión nombrada por `CONTENT_SCHEMA_REVISION` (propiedad de la ejecución activa de Fish/voz; no se afirma aquí); eso no establece el marker de la base en ejecución. La capacidad workspace sigue en `2026_10_workspace_r1`. La ejecución activa de Fish mantiene [su propio ledger](../fish_audio_support/11_implementation_status.md), excluido de este cleanup.

## Evidencia y precedencia

Los cierres de logs locales anteriores no sustituyen esta inspección; la evidencia de aceptación futura necesita conservación durable, no referencias `/tmp/`. La elección del propietario del 2026-10-10 (target OpenRouter; Opus para `primary`, Sonnet para `metadata`/`preflight`; caché de prompt) se preparó offline con `api.magic_llm/scripts/prepare_openrouter_defaults.py`, que genera JSON sin claves ni evaluaciones; no está publicada ni evaluada y sus precios son históricos. LLM-R4 decide los defaults.

Estado global: [matriz](../STATUS_MATRIX.md), [LLM-01 / SEC-01](../ROADMAP.md). Este cleanup cambió documentación; no corrigió el transporte ni certificó persistencia, paquetes instalados o despliegues.
