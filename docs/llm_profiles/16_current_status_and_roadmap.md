# Estado actual y roadmap de perfiles LLM

**Revisión de fuentes: 2026-10-14. Estado: WIP operativo; implementación local presente.** Este documento distingue el código actual del reporte inicial del 8 de octubre y del historial de ejecuciones de [12](12_implementation_status.md). No acredita configuración ni migración de una instalación desplegada.

## Estado verificable

| Área | Estado actual / evidencia | Límite |
| --- | --- | --- |
| Catálogo/perfiles root y personales | Consolas en `src/features/llmProfiles`, DTOs/cliente y `src/routes/llm_profiles.py` del BFF | Tener pantallas no prueba perfiles publicados ni conexiones utilizables |
| Resolución / ejecución | `llm_profile_resolution.py`, `llm_profile_execution.py`, transporte protegido y grafos con bindings; no se encontraron las antiguas variables `CARD_LLM_*`/`ADVENTURE_CHAT_LLM_*` en los servicios/grafos revisados | La tabla antigua de 01 es un baseline histórico, no configuración vigente |
| Gate del BFF | `LLM_PROFILES_ENABLED` carga transporte una vez; sin transporte devuelve `503 LLM_PROFILES_DISABLED` | Local `.env` = true; ejemplo = false. No hay fallback legacy por desactivar el gate |
| BYOK | `LlmSessionProvider.tsx` y `credentialSession.ts`: memoria transitoria, reentrada, aislamiento por cuenta/proyecto y HTTPS obligatorio | Una API local HTTP no habilita BYOK aunque profiles esté activo; no se certificó custodia/retención desplegada |
| Reintento / recuperación | Preparación y reconciliación retienen feature/perfil/request; las claves se vuelven a proporcionar según el flujo | Reintento puede conservar un grafo congelado: no asumir que usa una corrección publicada después |
| Assistants | Registry actual: `card`, `lorebook`, `app` | No existe assistant kind `novel`; el roadmap de novela necesita otro contrato |
| Media / callbot | Features y writers resuelven política/perfiles; selección personal depende del contrato de cada feature | BYOK de texto no convierte imagen, música o voz en operaciones gratuitas |

Evidencia: [provider cliente](../../src/features/llmProfiles/LlmSessionProvider.tsx), [credenciales cliente](../../src/features/llmProfiles/credentialSession.ts), [API](../../src/infrastructure/api/index.ts), [gate BFF](../../../../PycharmProjects/magic-worlds-api/src/services/llm_profile_api.py), [resolución](../../../../PycharmProjects/magic-worlds-api/src/services/llm_profile_resolution.py), [ejecución](../../../../PycharmProjects/magic-worlds-api/src/services/llm_profile_execution.py), [registry assistant](../../../../PycharmProjects/magic-worlds-api/src/services/assistants/registry.py).

La factory protegida de `api.magic_llm/src/services/llm_execution.py` separa credenciales del envelope persistible y usa `client_binding`. Esto no cierra por sí solo la política de todos los nodos del ejecutor genérico. El [audit de secretos](../security/secret-resolution-audit-2026-10-11.md) tiene otro alcance y requiere reconciliación por hallazgo.

## Roadmap / decisiones pendientes

| ID / prioridad | Estado | Trabajo pendiente | Criterio de cierre |
| --- | --- | --- | --- |
| LLM-R1 / P0 | **WIP — aceptación operativa** | Matriz de features/payer/reintento/admisión/cobro en versiones y schema realmente desplegados | Catálogo/custodia/perfiles publicados, resultado y reconciliación verificados por feature, sin doble cargo |
| LLM-R2 / P0 | **WIP — provisión/rollout TBD por entorno** | Revisar cuts de datos existentes, referencias retiradas, workflows y turnos retenidos antes de aplicar migraciones | Inspección/preflight/aplicación revisados para la revisión real, conservación de saldos y rollback probado; [runbook](14_operations_runbook.md) |
| LLM-R3 / P0 | **WIP — seguridad** | Revalidar promesa BYOK y diferencias entre ejecución protegida y nodos genéricos | Canarios sin red en persistencia/stream/diagnósticos/restore y política de nodos/destinos; cierre explícito de hallazgos |
| LLM-R4 / P1 | **WIP — calidad/configuración** | Evaluaciones por grafo/feature, capacidades y precios revisados antes de publicar defaults | Evidence real `verified_features`/evaluations; no promover por identidad de modelo ni por JSON generado offline |
| LLM-R5 / P1 | **WIP — recuperación** | Validar pérdida de clave, recarga, token/account/workspace switch, terminal retry, credentials reentry y resultados tardíos | La ejecución mantiene su intención sin reutilizar credenciales ni efectos externos de otra cuenta/intento |
| LLM-R6 / P1 | **Resuelto en el despliegue de prueba, 2026-10-14** | BFF `2c2973d` filtra los eventos `mw_read_card` consumidos por el grafo solo bajo el contrato narrativo, con validación estricta | El smoke posterior de chat/narración pasó; ver [estado de voz](../voice_refactor/00_current_status_and_roadmap.md) y [voz §13](../voice_refactor/15_implementation_plan_and_acceptance.md). La aceptación de producción sigue en LLM-R1 |
| LLM-R7 / P2 | **TBD** | Responsable, entorno, fechas, retención y ampliación de selección personal para writers/callbot | Decisión explícita y política visible; no ampliar alcance por inferencia |

Los resultados de pruebas de 12 tienen fecha y alcance propios; los conteos se solapan. Sus frases sobre `.90`, objetivos activos, cambios “pendientes” y cierres locales son historia de aquellas tandas, no estado continuo de este chat. Los defaults/precios de [15](15_openrouter_defaults.md) son una preparación fechada, no una recomendación de compra vigente ni prueba de cache hits.

Roadmap global: [LLM-01 / SEC-01](../ROADMAP.md). Este review no activó flags, publicó perfiles, modificó DBs ni llamó proveedores.
