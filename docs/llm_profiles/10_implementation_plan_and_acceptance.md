# Plan de implementación y criterios de aceptación

**Reconciliación documental 2026-10-14: diseño/contratos del dossier original.** El código de perfiles existe y varios entregables se cerraron localmente después. Las propuestas y criterios de este archivo no acreditan rollout; usar [16](16_current_status_and_roadmap.md) para implementación actual, WIP operativo y TBD, y 12 para historia de pruebas.

Este backlog conserva el alcance completo; el avance local y sus límites se registran en [12](12_implementation_status.md). Se ordena por dependencias y riesgo; no se asignan fechas sin estimar el trabajo en cada repositorio. La secuencia de rollout está en [09](09_migration_and_rollout.md).

**Criterio adicional obligatorio del usuario (2026-10-09):** retirar todo legacy del refactor LLM. No entregar aliases antiguos, hydrators, configuración de modelos por feature en env, provider_key en DB, DTOs/wrappers ni caminos de ejecución/cobro/restore de compatibilidad. El código anterior que aún aparece en el working tree es trabajo pendiente de eliminación, no una excepción aceptada.

## Entregables por repositorio

| Repositorio | Cambios necesarios |
|---|---|
| magic-worlds-api | Schema/migrations/queries de perfiles, ownership, resolver, planes/capacidad, root/user APIs, payloads de features, defaults, idempotencia, cobro y redacción |
| api.magic_llm | Targets/connections/catalog DTOs, servicio de credenciales, gate de delegación, envelope seguro, admisión/snapshots, billing BYOK=0, usage y errores |
| magic-agents | Binding/dependency de clientes sin serializar secret, lifecycle de cliente y restore sin credencial; tests hooks/debug/checkpoints |
| magic-llm | Verificar/adaptar parámetros por provider, aislamiento auth/transport, errores sanitizados y cliente que recibe credencial transitoria; no añadir DB/owner policy |
| magic-worlds | Pantallas root/usuario, tipos/API, memoria BYOK, selectores por feature, HTTP/streams/WS, auth lifecycle, i18n, stories y pruebas |
| api.auth | Reusar identidad/delegación actual; cambio solo si faltan capabilities de servicio, sin almacenar claves personales |
| Despliegue | Env/gestor platform, egress, TLS, límites/logging/APM/dumps, provisión de aliases y rotación |

## Backlog ordenado

### P0: contrato seguro de ejecución

- [ ] Definir `ResolvedLlmExecution`, client bindings y `ExecutionCredentials` separados.
- [ ] Proteger envelope en API LLM con identidad/capabilities de BFF y contexto de proyecto/usuario.
- [ ] Exigir handshake de versión/capacidades antes de reenviar credenciales y fallar explícitamente ante réplicas legacy; readiness no prueba soporte del envelope.
- [ ] Evitar dumps/fingerprints/persistencia del secret antes de admisión; error handlers seguros incluso para JSON inválido/422.
- [ ] Inyectar clientes mediante dependency/factory después del snapshot; cubrir aliases y subgraphs.
- [ ] Evitar secretos en hooks/debug/usage y shared client caches.
- [ ] Migrar envío platform del BFF; revisar todas las funciones de hidratación actuales, no solo content_generation.
- [ ] Retirar headers sensibles de catálogo y preparar conexiones platform externas a DB.
- [ ] Ensayar canary y configurar infraestructura sin captura de bodies.

**Salida verificable:** una solicitud real en entorno de prueba usa una clave ficticia en el adapter mock y esa clave no aparece en artefactos persistidos ni eventos. Se preserva el hash/reconstrucción del grafo sin secrets.

### P1: datos, catálogo y perfiles system

- [ ] Implementar tablas/constraints/índices, migrations upgrade y schema fresh.
- [ ] Sustituir catálogo por target/model descriptor/connection y retirar aliases, credenciales en DB, APIs y lectores anteriores.
- [ ] Registro de features/roles, caps, supported params y flags de selección/BYOK.
- [ ] Resolver cadena de herencia, autorización, revisión congelada e invalidación de caché.
- [ ] APIs root draft/validate/test/publish/rollback/policy/audit.
- [ ] Provisionar explícitamente perfiles/defaults nuevos sin importar secretos ni conservar un importer/runtime de configuración anterior.
- [ ] Pantallas root con componentes Reverie y permisos backend.
- [ ] Separar Studio de perfiles, corregir default marker y documentar qué cambia al publicar.

**Salida verificable:** root configura novel y RP de forma independiente; las features sin override heredan el default; publish/rollback no altera llamadas en curso.

### P1: preferencias personales y BYOK

- [ ] APIs propias de perfil/revisiones/defaults/asignaciones con owner y optimistic concurrency.
- [ ] Capacidad independiente de débito, cargo cero BYOK y adaptación de la reserva de chat.
- [ ] Asegurar que saldo cero no bloquea BYOK ni descuenta saldo en API LLM.
- [ ] UI de perfiles propios/system, compatibilidad, herencia y coste; clave volátil aislada.
- [ ] Validar revisión esperada antes de enviar key al target; nunca cambiar payer por error.
- [ ] Adaptar cards, novel, card/lorebook assistant, extraction y tres variantes de chat.
- [ ] Adaptar HTTP y stream en pareja, WS, retries y cancelación; todas las llamadas helper usan plan.
- [ ] Registrar provenance y usage seguro por perfil/revisión/rol/intento.
- [ ] Ajustar respuestas y vistas membership/usage root/usuario para separar cupos BYOK, créditos app y costo de proveedor.
- [ ] Declarar comportamiento tras recarga, auth expired, cambio de cuenta y restart.

**Salida verificable:** usuario A usa su perfil novel/RP, cards heredan el default configurado; perfil persiste al recargar pero la clave no; usuario B no accede a A.

### P2: ampliación y operación

- [ ] Activar por cohorts/features con telemetry segura y evals.
- [ ] Retirar todos los paths/env/provider_key legacy, shims, wrappers y DTOs de compatibilidad antes de entregar.
- [ ] Ejecutar runbook de rotación platform y revisión de retención.
- [ ] Añadir pruebas/contratos de media writers y voz antes de ofrecer BYOK allí.
- [ ] Revisar modelo de IDs privados, nuevos targets o varios proveedores solo con ADR adicional.

## Matriz de pruebas funcionales

| Área | Casos obligatorios |
|---|---|
| Herencia | Sin prefs; user default; user feature; root recommendation; default global; quitar override; preset RP atómico |
| Selección inválida | Perfil archivado/ajeno; revisión ajena; feature desconocida; incompatible; no key; no fallback |
| Publicación | Draft no afecta runtime, revisión nueva, rollback mismo perfil, concurrent edit 409, archivo con referencias bloqueado |
| Roles | Primary/metadata/preflight; override ausente; proveedor homogéneo; calls ocultas bloqueadas |
| Catalog | Modelo retirado, capability unknown, supported params, destino correcto, cache expiry e invalidación |
| Output | Cards schema; assistants tools/patch; novel candidate; chat metadata y streaming; extracción schema |
| Transporte | POST y stream equivalentes, WS frame nuevo, cliente antiguo sin llm, auth refresh vs provider rejection |
| Corte de contrato | Capability/version handshake, rechazo de contrato/alias antiguo, sin shim ni fallback que ejecute el camino retirado |
| Identidad | Ownership por project/user, cross-project, root API scope, direct API caller no autorizado |
| Idempotencia | Doble click, timeout, refresh, reconnect, retry tras publish, key distinta con mismo intent, replay completed |
| Cancelación | Liberar slot una vez; no doble refund/débito; key no retenida en pending queue |
| Cobro | BYOK saldo cero, cargo app cero, contador/caps, helper/retry, platform billing sin regresión, media separado |
| Restore | Restart sin key, reingreso autorizado, nunca recuperar desde env/root para BYOK |

## Pruebas de seguridad

Tests con adapter mock y canarias, sin llamadas ni claves reales por defecto. Verificar cuerpos/errores JSON malformados y 422; DB logs/snapshots/checkpoints; debug SSE; request fingerprints; audit/usage; exporters/frontend analytics; requests nested/aliases y tools. Probar credencial personal adjunta a perfil platform y connection/env ref inyectado en perfil personal: deben rechazarse antes de una llamada externa.

Probar SSRF/redirects/destinos privados en catálogo/discovery, key en URL/headers y acceso por servicio no autorizado. Una prueba unit de SecretStr/repr no basta: la ausencia de key se verifica en serializers y sink reales de test.

La auditoría de deployment incluye buffers temporales de proxy, agentes de APM y dumps. CI puede cubrir el código; el release checklist debe cubrir también esa infraestructura. No buscar ni imprimir secrets reales en producción para demostrar la prueba.

## Validación de base y cuentas

- Fresh install y upgrade producen estructura equivalente según bootstrap.
- Revisión/roles/current nunca mezclan perfiles; defaults no cruzan proyecto/owner.
- Datos de usuario/agente/idempotencia/chat migrados al contrato actual cuando corresponda; ningún lector runtime del contrato retirado.
- BYOK no produce débitos en membership_usage_day, PAYG ni ledger monetario de API LLM.
- Capacity under concurrent admission no excede cap, y lease expiry no deja slots permanentemente ocupados.
- Contadores/refunds/idempotencia funcionan exclusivamente con el contrato nuevo; histórico convertido una vez, sin lectores de compatibilidad.
- Archivo/borrado no destruye provenance y sigue la política de privacidad de usuario.

## Comandos de validación al implementar

Frontend: `pnpm build` es la señal principal. Ejecutar tests relevantes con `pnpm test` en modo no-watch según configuración; `pnpm typecheck:stories` si cambia una story y lint con baseline conocido de errores existentes. No cambiar package manager.

Backend: ejecutar suites específicas de schemas/repositorios/rutas, reserva y cobro, graph contracts/security, inline completion/admission/native snapshots, usage y adapters. Usar los entornos locales ya instalados de cada repo y respetar [instrucciones api.magic_llm](/home/andres/PycharmProjects/api.magic_llm/AGENTS.md); no reinstalar paquetes editable para una tarea de configuración.

Pruebas de integración con DB efímera y proveedores mock; pruebas de calidad con proveedor real solo de forma explícita y con credenciales de plataforma provisionadas para evaluación. Ejecutar ambas rutas streaming/no streaming cuando se modifique un consumidor. Las suites locales ya ejecutadas y las pendientes están en [12](12_implementation_status.md); no equivalen a validación del despliegue ni de la entrega completa.

## Definición de terminado

La entrega inicial está lista cuando root administra perfiles system y defaults; el usuario administra sus perfiles/overrides; las features habilitadas resuelven y registran el perfil efectivo; BYOK conserva claves solo de manera transitoria; los roles usan la credencial/payer correctos; saldo cero funciona; ownership y destinos están protegidos; HTTP/WS/stream/retry/cancel/restore tienen resultados definidos; y la verificación canaria end-to-end pasa.

La documentación operativa debe explicar rotación platform, cómo eliminar una asignación, qué pasa al recargar, qué cuesta media y por qué BYOK no se reanuda automáticamente tras perder su clave. No declarar terminada la entrega por tener solo CRUD de perfiles o una pantalla de settings.

La entrega tampoco está terminada mientras quede código, configuración, esquema fresh o pruebas que dependan de un camino LLM legacy. El rollback permitido usa un artefacto con el contrato nuevo; jamás restaura la hidratación de secretos ni el catálogo retirado.
