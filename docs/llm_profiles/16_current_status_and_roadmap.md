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
| Admisión / ejecución | El BFF conserva planes y grafos simbólicos, luego renderiza clientes al transporte original `/v1/chat/completions` | El payload outbound es `{agt,messages,stream}` con `engine/model/api_info`, más `request_credentials` cuando el plan es BYOK; no conserva el binding privado en el límite upstream |
| Gate BFF | `LLM_PROFILES_ENABLED` controla carga del transporte; sin él hay `503 LLM_PROFILES_DISABLED` | Desactivar el gate no aporta fallback de routing ni prueba el transporte protegido |
| BYOK navegador | Memoria transitoria, aislamiento por identidad y controles HTTPS en cliente | Esa propiedad del navegador no acredita no persistencia en ejecutor/DB |
| Custodia BFF → ejecutor | Para BYOK, `_render_clients` deja `credential_binding: "request.byok"` en cada cliente y la clave viaja en `request_credentials` (v1, o v2 para custom providers; BFF `7f7eac7`). api.magic_llm lo marca transitorio y lo descarta antes de la admisión y del snapshot (`be1ab64`). Las claves de plataforma siguen dentro de `api_info` del grafo | **F04 implementado en fuente; aceptación abierta:** pruebas unitarias cubren snapshots, runtimes anidados, errores y cancelación; falta el canario end-to-end. No se escanearon claves/DBs reales |
| Runtime genérico | El checkout `NodeClientLLM` aún resuelve configuración y crea el cliente durante construcción | **F05 abierto:** no presentar el cierre histórico de cliente simbólico como estado instalado actual |
| Retry / recuperación | Planes/recibos BFF y flujos de reconciliación por feature existen | Transporte upstream perdido/inválido es terminal. Verificar replay, retry explícito, credencial reingresada y efectos/cargos por intento |
| Assistants | Registry `card`, `lorebook`, `app`; el digest de app entra al payload congelado | No existe kind `novel`; el contexto no se guarda en conversación/turn, pero sí puede persistir en el plan de ejecución; [retención](../security/README.md#content-retention-is-a-separate-contract) |
| Media / callbot | Features y writers resuelven política/perfiles. El registro aún incluye `moderation`, contrato legacy de clasificador de speech (interno: sin selección personal, BYOK ni créditos platform) que el [plan de moderación nativa](../moderation/README.md) debe retirar | BYOK de texto no hace gratuitas las operaciones de media ni habilita selección personal donde el contrato no la permite |

Fuentes: [transporte BFF](../../../../PycharmProjects/magic-worlds-api/src/services/llm_execution_transport.py), [test del cuerpo outbound](../../../../PycharmProjects/magic-worlds-api/tests/services/test_llm_execution_transport.py), [carga/configuración](../../../../PycharmProjects/magic-worlds-api/src/services/llm_profile_api.py), [snapshot](../../../../PycharmProjects/api.magic_llm/src/util/execution_snapshot.py), [cliente runtime](../../../../PycharmProjects/magic-agents/magic_agents/node_system/NodeClientLLM.py), [sesión frontend](../../src/features/llmProfiles/LlmSessionProvider.tsx), [memoria BYOK](../../src/features/llmProfiles/credentialSession.ts).

La factory protegida de `api.magic_llm/src/services/llm_execution.py` existe, pero su presencia no establece que este BFF la use. Para BYOK la credencial ya no entra en `agt`; las claves de plataforma sí, y limpiar diccionarios después de serializar no elimina la copia del receptor. El [registro F01–F11](../security/README.md) mantiene los límites y criterios de cierre. La promesa de [05](05_security_and_secrets.md) es un requisito pendiente, no una garantía implementada end-to-end.

Ese camino protegido tampoco es alcanzable por HTTP: `src/routes/__init__.py` de API LLM no registra el router `llm_execution_recovery` y ninguna ruta importa `services/profile_admission.py`. `PrivateOutputGuard` solo se usa en `llm_execution.py` (`assert_safe_output`) dentro de ese camino. El BFF retira `client_binding` del grafo outbound, así que la privacidad simbólica de helpers de `d86273d` no se aplica a grafos del BFF; ese filtrado depende del BFF `2c2973d`. Detalle en [07](07_api_changes.md).

## Roadmap / decisiones pendientes

| ID / prioridad | Estado | Trabajo pendiente | Criterio de cierre |
|---|---|---|---|
| LLM-R1 / P0 | WIP operativo | Matriz feature/pagador/admisión/retry/cobro en revisiones realmente desplegadas | Catálogo/perfiles/evaluaciones y reconciliación de éxito/fallo sin doble cargo |
| LLM-R2 / P0 | WIP por entorno | Verificar cadena de schema, referencias y workflows/turnos retenidos antes de un corte | Preflight exacto, conservación de saldos/datos, recuperación y revisión de apply; [runbook](14_operations_runbook.md) |
| LLM-R3 / P0 | **Canal separado implementado; aceptación de custodia abierta** | BYOK ya viaja fuera del grafo (BFF `7f7eac7`, api.magic_llm `be1ab64`) y el copy EN/ES está limitado a propiedades locales verificadas (SPA `692e56bb`). Falta: canario end-to-end por BFF y ejecutor reales, revisión de copias en snapshots históricos anteriores al cambio, mantener BYOK apagado hasta desplegar el ejecutor compatible, y revalidar nodos/destinos (F03) | Canario ficticio por BFF y runtime reales, ausencia en todos los límites durables/públicos, cierre por hallazgo; copy limitado a memoria de pestaña verificada con prueba de regresión (F11) |
| LLM-R4 / P1 | WIP calidad | Evaluaciones por grafo/feature/capacidad y precios revisados | Evidencia real antes de publicar defaults; JSON offline no acredita un modelo |
| LLM-R5 / P1 | WIP recuperación | Pérdida de clave, recarga, cambio de cuenta/workspace, retry terminal y resultados tardíos | Intención preservada, credencial reingresada, aislamiento y efectos idempotentes |
| LLM-R6 / P1 | **Resuelto en fuente y smoke de prueba registrado** | BFF `2c2973d` filtra `mw_read_card` consumido por el grafo bajo el contrato narrativo | Evidencia del 14 de octubre en [voz](../voice_refactor/00_current_status_and_roadmap.md); mantener regresión y aceptación de producción en LLM-R1 |
| LLM-R7 / P2 | TBD | Responsables, entorno, retención y selección personal adicional. Borrado de cuenta: coordinar perfiles, preferencias, planes, recibos, uso y auditoría LLM según la política de privacidad, sin CASCADE general y conservando solo datos mínimos permitidos; el perfil se archiva (soft archive) y las revisiones usadas por ejecuciones se conservan con FKs `NO ACTION`/RESTRICT; nunca se borran | Decisión explícita y política visible |
| LLM-R8 / P1 | **Implementado en fuente; aceptación abierta** | Custom providers OpenAI-compatible (Chat Completions y Responses) con URL e ID de modelo manuales, sin catálogo ni prueba obligatoria: SPA `07d67b9a` (`src/shared/llmCustomProvider.ts`, `ProfileEditor`), BFF `96585b4`/`bac5650` (`custom_provider` en el `db.sql` base), executor `request_credentials` v2 y transporte privado de magic-llm `fb6250b` (sin destinos privados ni redirects; routing por hostname exacto). Contrato: BFF `docs/custom_llm_profiles.md`. Pendiente: desplegar runtime y executor antes de aceptar custom en el BFF y luego publicar la UI (un executor viejo debe fallar cerrado); aceptación con proveedor real; flujos completos por feature habilitada (solo hay pruebas focalizadas); suites legadas del BFF y magic-llm con fallos preexistentes (CP11); `vitest.config.ts` no excluye `.claude/worktrees` | Matriz de aceptación del plan retirado (protocolos, composición de URL, política de red, ciclo de perfil, credenciales, sin dependencia de catálogo, recuperación, contabilidad, UX) con evidencia por entorno |

El bootstrap BFF exige la revisión nombrada por `CONTENT_SCHEMA_REVISION` (`2026_10_db_refactor` en el cleanup de docs del 2026-10-26); eso no establece el marker de la base en ejecución. La capacidad workspace sigue en `2026_10_workspace_r1`. Los gates de release de Fish están en [V-14](../voice_refactor/00_current_status_and_roadmap.md).

## Evidencia y precedencia

Los cierres de logs locales anteriores no sustituyen esta inspección; la evidencia de aceptación futura necesita conservación durable, no referencias `/tmp/`. La elección del propietario del 2026-10-10 (target OpenRouter; Opus para `primary`, Sonnet para `metadata`/`preflight`; caché de prompt) se preparó offline con `api.magic_llm/scripts/prepare_openrouter_defaults.py`, que genera JSON sin claves ni evaluaciones; no está publicada ni evaluada y sus precios son históricos. LLM-R4 decide los defaults.

Estado global: [matriz](../STATUS_MATRIX.md), [LLM-01 / SEC-01](../ROADMAP.md). Este cleanup cambió documentación; no corrigió el transporte ni certificó persistencia, paquetes instalados o despliegues.
