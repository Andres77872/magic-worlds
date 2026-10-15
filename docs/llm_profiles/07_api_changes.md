# Cambios requeridos de API

**Reconciliación documental 2026-10-14: diseño/contratos del dossier original.** El código de perfiles existe y varios entregables se cerraron localmente después. Las propuestas y criterios de este archivo no acreditan rollout; usar [16](16_current_status_and_roadmap.md) para implementación actual, WIP operativo y TBD, y 12 para historia de pruebas.

El control de perfiles está implementado y verificado localmente. Los cierres de ejecución, recuperación, intentos y usage por consumidor se registran en [estado](12_implementation_status.md); la activación del entorno real sigue pendiente. El cliente web llama exclusivamente a `magic-worlds-api`. Los ejemplos no contienen claves reales; los IDs y modelos son ilustrativos.

## Auth y permisos

- Endpoints admin requieren `require_root_user`, no cualquier admin.
- Endpoints `/user/...` derivan owner y project de sesión/config de aplicación. No admiten `owner_user_id`, `scope=system` ni connection/env refs como campos editables.
- Lectura personal: propio perfil o system disponible. Rechazo uniforme 404 para objeto ajeno/no disponible.
- Root administra system, policy y metadata de conexiones, no necesita listar perfiles privados ajenos. Puede ver métricas agregadas sin exponer configuración/contenido personal.
- `api.magic_llm` admite el envelope especial solo desde el BFF autorizado, preservando sesión y contexto del usuario. Proteger su frontera de servicio con delegación validada y allowlist de capacidades/proyectos; mTLS puede reforzarla, pero no sustituye autorización.

## Catálogo seguro y resolución

| Método/ruta BFF propuesta | Acceso | Respuesta/efecto |
|---|---|---|
| `GET /llm/features` | Usuario autenticado | Features, roles, user_selection_enabled, byok_enabled y requisitos públicos |
| `GET /llm/models?feature=novel&provider_target=...` | Usuario autenticado | Descriptores compatibles, lifecycle, caps, restricciones y precio orientativo; paginado |
| `GET /llm/profiles?scope=available` | Usuario autenticado | System autorizados y propios; filtros/paginación; sin drafts root ni secrets |
| `GET /llm/features/{feature}/effective-profile` | Usuario autenticado | Perfil/revisión, origen de herencia, roles y modo; no estado de clave server-side |
| `POST /llm/features/{feature}/resolve` | Usuario autenticado | Preview sin inferencia; puede recibir selección explícita para mostrar conflictos |

La resolución pública incluye `project_hash` obtenido del actor autenticado para vincular la sesión volátil de la SPA; no se acepta como selección del cliente ni se deduce del JWT. La preview no reserva ni congela definitivamente el plan. El request de ejecución resuelve otra vez y usa `expected_revision_id` para rechazar cambios no vistos; es obligatorio al adjuntar BYOK y opcional para platform. No usar `/v1/models` sin normalización como DTO completo de perfiles.

## API root

| Método/ruta | Efecto |
|---|---|
| `GET /admin/llm/profiles` | Listado de system con estado, draft/current, impacto y auditoría |
| `POST /admin/llm/profiles` | Crear system draft seguro |
| `GET /admin/llm/profiles/{id}` | Detalle system y revisiones |
| `PATCH /admin/llm/profiles/{id}/draft` | Editar con If-Match/row_version |
| `POST /admin/llm/profiles/{id}/validate` | Compatibilidad/config; no inferencia automática |
| `POST /admin/llm/profiles/{id}/test` | Prueba explícita con conexión platform y límites; resultado seguro. Body: `feature` y exactamente un destino, `expected_revision_id` (publicada) o `expected_draft_version` (borrador guardado). El borrador se congela como revisión `draft_test` inmutable, sin número, que nunca puede ser current ni rollback |
| `POST /admin/llm/profiles/{id}/publish` | Nueva revisión inmutable y current; conflicto si draft cambió |
| `POST /admin/llm/profiles/{id}/rollback` | Cambiar current a revisión propia previa y auditar |
| `POST /admin/llm/profiles/{id}/archive` | Archivar si no tiene asignaciones activas; nunca borrar provenance |
| `GET /admin/llm/policy` | Default global, recomendaciones por feature y versión |
| `PUT /admin/llm/policy` | Cambiar política de forma atómica con If-Match |
| `GET /admin/llm/connections` | Conexiones configuradas, target/estado; sin clave ni referencia interna completa |
| `POST /admin/llm/catalog/sync` | Solicitar refresh controlado de metadata; resultado/job seguro |
| `GET /admin/llm/audit` | Eventos paginados y filtrados |
| `GET /admin/llm/provider-usage` | Solo root, `no-store`. Estimaciones del proveedor por pagador (`platform`, `user_byok`, `unattributed`) del proyecto, para `from_date`..`to_date` (por defecto, del inicio del mes UTC a hoy; rango < 366 días). Tokens, llamadas sin precio (costo desconocido, nunca cero) y montos decimales por moneda; nunca créditos app ni cargo BYOK. Fuente: `GET /admin/usage/project-summary` de API LLM. Errores `PROVIDER_USAGE_RANGE_INVALID` 422, `PROVIDER_USAGE_UNAVAILABLE` 503, `PROVIDER_USAGE_INVALID` 502 |

No hay endpoint «mostrar API key» ni «guardar secret» para el usuario o root web. Las credenciales platform se provisionan en configuración de despliegue/gestor. Crear un perfil root selecciona una conexión ya autorizada; publicar verifica que pertenece al proyecto y funciona con ese target.

## API personal

| Método/ruta | Efecto |
|---|---|
| `GET /user/llm/profiles` | Solo propios |
| `POST /user/llm/profiles` | Crear user profile con primera revisión validada |
| `GET /user/llm/profiles/{id}` | Detalle propio sin secret |
| `PATCH /user/llm/profiles/{id}` | Config/metadata; nueva revisión con optimistic concurrency |
| `POST /user/llm/profiles/{id}/test` | Clave transitoria en request; test seguro, no guardar disponibilidad como garantía permanente. Body: `feature` con BYOK habilitado y `expected_revision_id`; los perfiles personales no tienen borrador |
| `POST /user/llm/profiles/{id}/archive` | Archivar propio; resolver/bloquear asignaciones activas explícitamente |
| `GET /user/llm/preferences` | Default y overrides explícitos, versión y resumen de herencia |
| `PUT /user/llm/preferences` | Sustituir preferencias completas atómicamente con If-Match |
| `DELETE /user/llm/preferences/features/{feature}` | Quitar override para heredar |

Ejemplo de creación personal, sin credencial:

```json
{
  "name": "Mi novela",
  "provider_target_key": "approved_provider",
  "roles": {
    "primary": {
      "catalog_model_key": "approved_provider/writer_model",
      "settings": {"max_output_tokens": 4096, "timeout_seconds": 120}
    }
  }
}
```

Ejemplo de preferencias:

```json
{
  "default_profile_id": null,
  "feature_profiles": {
    "novel": "profile-novel",
    "chat_adventure": "profile-rp",
    "chat_character": "profile-rp",
    "chat_group": "profile-rp"
  }
}
```

El PUT reemplaza el mapa completo: keys omitidas vuelven a heredar. Para evitar pérdidas por edición concurrente, If-Match obligatorio. El default null mantiene recomendaciones root. Validar cada perfil, feature y compatibilidad antes de guardar; no aceptar un mapa parcial y dejar cambios intermedios.

## Envelope de ejecución público

Añadir un bloque opcional `llm` a payloads de generación/turno, con shape común. Nombre snake_case dentro del bloque aunque el recurso existente use camelCase; documentarlo en OpenAPI y tipos TS.

```json
{
  "chapterId": "chapter-example",
  "command": "continue",
  "llm": {
    "selection": {"mode": "inherit"},
    "expected_revision_id": "revision-example",
    "credentials": {"api_key": "<clave-transitoria-del-usuario>"}
  }
}
```

Selección `inherit` es el default y usa preferencias. Selección puntual alternativa: `{"mode":"profile","profile_id":"profile-example"}`; no modifica preferencias. No permitir model/base_url/graph/headers/credential_mode/payer dentro de esta selección.

`credentials` se admite solo para el perfil personal efectivo y debe estar completamente separado de cualquier DTO persistible. Para platform se omite. Si falta en BYOK, pedir clave antes de admitir la operación. El servidor no confía en qué modo cree estar usando la UI.

Con BYOK exigir que `expected_revision_id` corresponda al perfil/target efectivo antes de forward. Un target de destino no cambia de URL manteniendo la misma identidad/revisión. Una feature con user_selection_enabled=false no admite selección puntual personal; resuelve root y la respuesta explica ese alcance. Las preferencias no admiten overrides sobre features deshabilitadas para selección personal.

### Consumidores actuales a modificar

| Rutas actuales | Cambio |
|---|---|
| `/characters/ai/`, `/worlds/ai/`, `/items/ai/`, `/adventure-templates/ai/` y `/ai/stream` | `description` + `LlmRequest` obligatorios, resolver card_generation, plan/reserva nuevos; Idempotency-Key y X-Request-Id requeridos; persistencia atómica y previews de texto validadas por path |
| `GET /{card-kind}/ai/result` | Consultar plan pendiente o snapshot completado del owner/proyecto/grupo/workflow; sin admitir, cobrar ni reenviar generación |
| `/stories/{id}/generate` y `/generate/stream` | LlmRequest, resolver novel, candidato+ejecución en commit único; preservar accept/stash/discard |
| `GET /stories/{id}/generation-requests/{request_id}` | Consultar candidato completado y provenance, owner/proyecto/grupo; no reservar, inferir ni cobrar |
| `/stories/{id}/context-preview` | Payload de contexto separado; rechazar `llm` y credentials con errores sanitizados |
| `/assistant/conversations/{id}/messages/stream` (`kind` card \| lorebook \| app) | Resolver `${kind}_assistant` por turno; no guardar credentials en conversación/history; card y lorebook resuelven también tools y revisión de cambios |
| Rutas de extracción de lorebook resources | Resolver lorebook_extraction antes de llamada; no copiar request completo a resource |
| WS de aventura/personaje/grupo | Extender WsChatFrame, identidad de request y run; todos los roles usan el plan |
| Escritores de imagen/canciones y callbot | Migrar platform a resolver común; rechazar BYOK hasta feature habilitada end-to-end |

Los schemas actuales `extra=forbid` requieren cambios explícitos. También hay validators que comprueban claves del provider hidratado: deben aceptar el nuevo binding seguro sin relajar validaciones de topology, tools o salida.

### WebSocket propuesto

```json
{
  "type": "chat",
  "content": "Continúa la escena",
  "request_id": "request-example",
  "llm": {
    "selection": {"mode": "inherit"},
    "expected_revision_id": "revision-example",
    "credentials": {"api_key": "<clave-transitoria>"}
  }
}
```

La clave va solo en este frame de ejecución. Eventos de salida actuales se conservan; agregar metadata de perfil/revisión/payer a un evento tipado o resultado ya existente. Rechazar frames con combinación inválida mediante código de error seguro. Evitar log del frame recibido o ValidationError completo.

## Transporte BFF → API LLM

Recomendación: extender el camino existente `/v1/chat/completions` con un envelope versionado `llm_execution` para la integración autorizada. No abrir otro runtime paralelo. Proteger este bloque por capacidad del servicio delegador; rechazarlo a consumidores sin dicha autorización.

El envelope contiene plan resuelto seguro y `credentials` separado para BYOK. `agt` contiene bindings simbólicos de clientes/roles y nunca claves, connection secrets ni env placeholders de usuario. Campos internos de conexión no regresan a la SPA.

Orden obligatorio en API LLM:

1. Validar sesión, delegador permitido y scope del proyecto.
2. Extraer la credencial transitoria a un contexto aislado; construir intent seguro que la excluye de dumps/hashes/errores.
3. Validar plan, target/modelo, permiso de conexión y binding de todos los client nodes/subgraphs. En BYOK no buscar claves globales de catálogo.
4. Admitir request, persistir grafo y plan sin secrets y crear snapshot exacto de esa estructura.
5. Crear clientes mediante dependency/factory runtime usando el contexto transitorio. No modificar el grafo authored para inyectar la key.
6. Ejecutar, registrar usage/roles/payer y devolver eventos/resultados sanitizados.
7. Cerrar clientes y liberar referencias incluso en cancellation/error.

Si la librería solo admite `api_info` dentro del grafo, implementar un mecanismo de client dependency/resolver antes de habilitar BYOK. Pasar un grafo con clave y confiar en un filtro posterior no cumple el requisito. Los tests deben demostrar que snapshots/checkpoints/debug nunca serializan el objeto cliente autenticado.

Para reportes, API LLM expone `GET /admin/usage/project-summary` (admin/root, token con proyecto): el resumen de usage facts filtrado por el `project_hash` del token; sin proyecto responde 403. El BFF lo consume con los mismos headers de ejecución y solo reenvía los totales por pagador.

La API ya diferencia auth app (`Authorization`, `X-Delegation-API-Key`) de credencial del proveedor. Mantener esa separación: el usuario no pone su key de OpenAI/etc. como Bearer de la aplicación.

## Respuestas, errores y reintentos

Resultados incluyen `llm_execution` con execution/profile/revision, origen de herencia, credential_mode y replayed. Catálogo y resolución exponen los nombres/modelos seguros para la selección. No incluir key, secret_ref, request completo ni headers de proveedor. En streams comunicar provenance en el resultado final con el mismo request ID.

En cards, la primera admisión congela el workflow y su modalidad de entrega; SSE requiere capability streaming antes de reservar/cobrar. Un replay HTTP de una ejecución SSE devuelve el mismo snapshot sin catálogo, clave ni nueva llamada al proveedor. Las previews son hojas de texto del schema de la card; el JSON completo se valida antes del commit. La recuperación GET consulta el estado del plan nuevo (`admitted`, `running` o terminal) y señala `recovery_required` ante lease perdido; no conserva el status/lector anterior de idempotencia.

API LLM dispone ahora del contrato local de continuación nativa para ejecuciones inline admitidas por el BFF:

- `GET /v1/llm-execution/requests/{execution_id}` consulta estado, versión e identidad segura. Cuando está completada, incluye `result` con el texto/herramientas públicos y tokens agregados desde los hechos finales del run raíz y sus hijos, en la misma transacción autorizada. Proyecta los handles públicos del checkpoint sin reconstruir clientes, chats ni recursos. No admite ni ejecuta; comprueba subject, proyecto y admisión original. No exige clave BYOK ni que el modelo siga disponible para despachar.
- `POST /v1/llm-execution/requests/{execution_id}/resume` recibe únicamente `expected_version` y `credentials` transitorias cuando corresponda, con `X-LLM-Execution-Version: 1`. Reautoriza el plan guardado contra el catálogo/conexión actual y continúa el grafo/checkpoint original mediante claim/fencing nativos. No recibe graph, prompt, plan ni selección nuevos. BYOK exige una nueva clave; platform rechaza una clave personal.
- Una lease activa, versión distinta, checkpoint no recuperable o ejecución terminal rechazan la continuación. Una respuesta de proveedor ya confirmada se reutiliza sin otra llamada. La respuesta devuelve el texto y herramientas públicos completos, incluidos outputs de nodos que ya habían terminado; no devuelve el checkpoint.

El BFF consulta una vez el resultado guardado tras perder la respuesta HTTP. Si está completado, valida y persiste el resultado de dominio con la reserva original. Si el estado es incierto, expira la capacidad y conserva plan, pagador, cuota y cargo para recovery; no inventa un fallo ni un reembolso. Una nueva solicitud con el mismo intent recupera el resultado completado sin clave, o reclama capacidad y continúa un checkpoint recuperable con una clave recién enviada. El claim serializa los consumidores y cambia la lease; no vuelve a resolver el perfil, crear el plan, incrementar cuota ni debitar. Un fallo/cancelación remoto confirmado permite compensar exclusivamente los ledgers de esa ejecución.

Esta conexión está implementada para cards, novel, prueba publicada de perfil, Agent Studio, card/lorebook assistants, extracción y writers de sistema. Los casos HTTP/SQL de recovery nuevo califican cuatro tipos de card y ambos pagadores, más ambos assistants y extracción independiente/embebida con BYOK. La novela congela también el contextTrace usado al persistir el candidato; la extracción conserva y revalida su fuente y los assistants mantienen el mensaje de usuario ya admitido y el guard/CAS del turno. No se reconstruye un prompt desde el estado nuevo durante la continuación.

Los cierres locales posteriores de chat/callbot, SPA, intentos terminales y membership/usage están registrados en [12](12_implementation_status.md). Una ejecución API terminal no se reanuda; su resultado o fallo se concilia. El soporte local y estas pruebas no acreditan un despliegue habilitado.

| Código | HTTP propuesto | Acción del cliente |
|---|---:|---|
| `BYOK_KEY_REQUIRED` | 409 | Pedir clave sin cambiar perfil |
| `BYOK_KEY_REJECTED` | 422 | Corregir clave; no refresh de sesión app |
| `PROFILE_UNAVAILABLE` | 404 | Elegir/asignar perfil disponible |
| `PROFILE_INCOMPATIBLE` | 422 | Mostrar rol/requisito que no se cumple |
| `PROFILE_REVISION_CHANGED` | 409 | Recargar preview/confirmar selección actual |
| `PROVIDER_MODEL_UNAVAILABLE` | 422 | Revisar modelo/acceso de cuenta |
| `PROVIDER_RATE_LIMITED` | 429 | Retry acotado con Retry-After |
| `OPERATION_LIMIT_REACHED` | 429 | Mostrar cupo/concurrencia; no ofrecer débito BYOK |
| `PLATFORM_CONNECTION_UNAVAILABLE` | 503 | Estado de servicio; no solicitar clave usuario para sustituirla |
| `PROVIDER_UNAVAILABLE` | 502/504 | Fallo/retry con identidad estable y sin cambio de pagador |
| `IDEMPOTENCY_CONFLICT` | 409 | No reenviar con intención distinta bajo la misma key |
| `LLM_EXECUTION_IN_PROGRESS` | 409 | La lease sigue viva: conservar el request ID y reintentar más tarde |
| `LLM_EXECUTION_RECOVERY_REQUIRED` | 409/502 | Resultado incierto: reintentar con el mismo request ID y target congelado, sin clave salvo que el servidor la pida |
| `BYOK_CREDENTIAL_REQUIRED` | 409 | Pedir la clave solo para el mismo perfil/revisión congelados y reenviar el mismo request ID |
| `LLM_EXECUTION_FINISHED` | 409 | El request ID terminó `failed`/`cancelled`: no se reutiliza; el siguiente intento es una petición nueva (enlazada con `retry_of_execution_id` donde aplique) |
| `LLM_EXECUTION_INTENT_CHANGED` | 409 | Selección/revisión/contenido distintos del original: descartar el request ID y despachar de nuevo |

En WS/SSE estos son códigos de eventos, no respuestas HTTP después de comenzar el stream. Mensajes públicos no incluyen error raw del proveedor. Auth app conserva sus 401/403 y su refresh existente.

## Idempotencia y revisión congelada

Scope: proyecto+subject+operación/workflow+idempotency key. Fingerprint: contenido, selección/perfil fijado, revisión y parámetros efectivos permitidos; **excluye la clave y todo derivado suyo**.

Consultar la admisión existente antes de resolver un plan nuevo para el mismo retry. Si ya existe, revalidar acceso y usar su revisión congelada; si terminó, devolver resultado permitido sin otra llamada ni clave. Si sigue ejecutándose, devolver estado/reconectar al resultado. Si requiere nueva ejecución tras fallo recuperable, mantener plan/autorización y solicitar nueva credencial según la política de retry. Cambiar contenido/perfil explícito con la misma key genera conflicto.

No ejecutar dos llamadas externas por refresh de sesión, reconnect, POST stream→fallback o confirmación doble. Retries de la misma operación liberan/reservan capacidad sin duplicar cobro ni contadores. No prometer que el proveedor soporta la misma idempotencia; registrar cada intento real.

## Cobro y límites

El modo lo decide el perfil autorizado. BYOK: platform_credit_cost=0, sin débito diario/PAYG ni chequeo de saldo en BFF/API LLM; sí aplica capacidad, cupos y límites. Platform: política actual con billing link desde operación. Los contratos de reserva/compensación se adaptan para admitir cargo cero sin ledger ficticio.

Tests de perfil y discovery también consumen infraestructura: cupo propio y resultado seguro. Media conserva su cobro separado; un perfil BYOK de novela no cambia permisos/costo de un endpoint de TTS.

Las respuestas de membership/usage y agregaciones admin usan el contrato nuevo con modo/payer y contadores BYOK separados; retirar DTOs y aliases de compatibilidad anteriores. El usuario debe ver solicitudes/cupo BYOK y créditos platform como cantidades distintas. Root debe distinguir costo platform, uso pagado por el proveedor del usuario y cargo app, sin sumar el costo estimado BYOK como factura propia. Retirar también cualquier decremento anterior disparado al guardar usage facts, no solo el precheck de saldo.

### Nuevo intento después de un fallo terminal

`llm.retry_of_execution_id` identifica la ejecución `failed` o `cancelled` que ya fue reconciliada y tiene la reserva liberada. La llamada lleva un nuevo `X-Request-Id` y una nueva `Idempotency-Key` donde la ruta la exige. Conserva exactamente la intención, selección y revisión originales. No se admite para trabajo en vuelo, resultado incierto o resultado completado.

El BFF revalida ownership, proyecto/grupo, estado del perfil, revisión retenida, identidad/lifecycle del modelo, conexión, compatibilidad y límites actuales. Conserva el grafo, mensajes, roles, ajustes, cotización y revisiones congelados. El nuevo plan solo cambia `execution_id` y añade `attempt_parent_execution_id`; recibe una reserva y un cargo propios según el pagador. Cada intento terminal tiene un único hijo; repetir la misma petición reproduce ese hijo y otro ID de petición para el mismo padre se rechaza. Si el hijo también falla, el siguiente intento referencia al hijo.

`GET /llm/features/{feature}/retry-profiles/{execution_id}` prepara el perfil retenido del owner sin admitir, cobrar ni llamar al proveedor. La admisión vuelve a verificarlo dentro de la transacción. BYOK exige una credencial transitoria nueva; la SPA descarta la clave anterior para ese target antes de abrir el diálogo. La API LLM anuncia `retained_plan_attempts: true`; si no lo anuncia, el BFF bloquea el intento antes de enviar la clave.

Integración actual: tarjetas, candidatos de novela, extracción de lorebook, asistentes de tarjetas/lorebook, chats, Agent Studio y pruebas explícitas de perfiles consumen la orden. La SPA de tarjetas ofrece el nuevo intento mediante el siguiente clic de generar solo después de que GET confirme el fallo. Un timeout o trabajo en vuelo conserva el ID original. Los contratos de chat y pruebas explícitas se detallan abajo; los casos verificados y los gates pendientes se registran en 12.


Los asistentes de tarjetas y lorebook también consumen esta orden. No insertan otro mensaje de usuario ni reescriben la respuesta fallida. La nueva respuesta añade `metadata.execution_attempt` con exactamente `execution_id`, `parent_execution_id`, `user_message_id` y `origin_request_id`. El mensaje de usuario conserva su ID, secuencia y request ID originales; assistant/tool pertenecen al nuevo request y siguen siendo contiguos. El GET de turno no completado devuelve `execution_id`; solo un terminal con reserva liberada permite ofrecer el intento nuevo. Un turno posterior, un origen alterado o un target/CAS cambiado bloquean la orden antes de despachar.

La SPA conserva el body original en memoria junto al comando sin credenciales, crea otro request ID al pulsar Reintentar, solicita la clave nueva a través de la preparación del perfil retenido y deduplica el usuario reconocido por SSE. Un corte del intento hijo recupera su propio plan y reserva. Cambiar la entrega HTTP/SSE conserva el grafo: un grafo sin streaming produce el final por SSE sin reconstruir sus nodos. Los chats también consumen nuevos intentos terminales mediante el contrato WS descrito abajo. Studio y las pruebas explícitas de perfiles también admiten nuevos intentos con el plan retenido.


### Asociación de nuevos intentos de chat

Las órdenes WS de chat pueden declarar `llm.retry_of_execution_id` junto con un `request_id` nuevo y la selección/revisión original. El backend admite la orden únicamente para el último intento terminal propio y con origen/contexto sin cambios. Conserva el usuario y las respuestas previas; el frame `turn_started` identifica el usuario original y la respuesta nueva e incluye `execution_attempt: {parent_execution_id, user_message_id, accepted_conversation_version}`. La metadata persistida de la respuesta conserva la misma asociación. El GET propio `/adventure-sessions/{id}/turns/{request_id}` o `/character-chats/{id}/turns/{request_id}` incluye el `execution_id` retenido para confirmar el estado antes de crear una orden nueva. Repetir el hijo con su mismo request y padre recupera/reproduce su ejecución sin otra admisión. Origen, versión o contexto alterados devuelven `CHAT_RETRY_CONFLICT`; recuperar una asociación pendiente alterada devuelve `CHAT_RECOVERY_CONFLICT`.

Este contrato está implementado en el BFF y conectado al botón de reintento de la SPA. El GET no completado incluye además `dispatch: {content, existing_user_message_id, llm}`, reconstruido exclusivamente de los mensajes propios y del hash de la intención retenida. No resuelve otra selección ni devuelve credenciales. Esto permite recuperar la orden original después de recargar, incluida una regeneración explícita y un intento hijo pendiente.

La SPA consulta ese estado antes de reintentar. Una ejecución incierta conserva su request ID y se reenvía sin clave; un fallo terminal confirmado permite otro request ID con `retry_of_execution_id` y una clave BYOK nueva preparada contra el perfil original. La respuesta nueva se añade sin borrar ni reescribir el usuario o los fallos previos. Un cambio de cuenta, cancelación, selección/revisión distinta o asociación de respuesta alterada bloquea el envío. El lector HTTP rechaza respuestas incompletas, campos privados y órdenes ajenas; no admite el contrato anterior.


### Estado y preparación de ejecuciones retenidas; pruebas explícitas

`GET /llm/features/{feature}/executions/{request_id}` devuelve exactamente `execution_id`, `request_id`, `status` y `recovery_required`, para el propietario/proyecto/grupo actuales. No resuelve perfiles, admite, cobra ni devuelve payload/credenciales. La SPA ofrece un nuevo intento únicamente después de confirmar failed/cancelled y la liberación; un error de transporte o un terminal no confirmado conserva el ID original.

`GET /llm/features/{feature}/executions/{request_id}/profile` reautoriza el plan pendiente contra el catálogo y devuelve su perfil efectivo congelado, sin el execution ID, graph/payload, subject privado o credencial. Solo admite admitted/running/awaiting_credential. La preparación de BYOK usa este perfil al continuar, en lugar de resolver las preferencias o revisión publicadas hoy; abortar/cambiar de cuenta impide materializar la clave. El replay completado no solicita esta preparación.

Agent Studio declara el padre en `llm.retry_of_execution_id`; una prueba de perfil lo declara como `retry_of_execution_id` en su body, junto con su feature y expected_revision_id o expected_draft_version originales. Ambos admiten un hijo por padre terminal, con nuevo request ID, plan/payload inmutables y nueva capacidad/cargo según el pagador. El test de draft conserva su revisión draft_test no publicable y el límite original de 64 tokens por rol. Cambiar el source/input/target o usar otro ámbito impide admitir el hijo. Un workflow editado o eliminado no sustituye el grafo de una ejecución ya admitida. La SPA conserva el request tras una respuesta incierta y usa otro ID/enlace solo en el siguiente clic tras confirmar el fallo.
