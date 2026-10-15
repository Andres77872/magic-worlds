# Seguridad y secretos

**Lifecycle: diseño/requisitos y decisiones conservados. Revisado 2026-10-15.** Este archivo define el objetivo, no un inventario de lo ya instalado. El [ledger 16](16_current_status_and_roadmap.md), la [API actual 07](07_api_changes.md) y el [registro F01–F11](../security/README.md) tienen precedencia. La custodia end-to-end sigue abierta.

## Promesa y límites

**Requisito objetivo: ninguna clave personal debe persistirse en infraestructura de la aplicación. No está cumplido end-to-end por el transporte actual.** El BFF inserta la clave en el graph outbound y el ejecutor captura ese graph; F04 sigue abierto. Las reglas siguientes describen la garantía que falta implementar/aceptar, no el comportamiento ya certificado. La memoria del navegador sí es transitoria; ausencia de un endpoint de recuperación no demuestra ausencia en snapshots.

Eso no hace invisible la clave al operador: un proceso o infraestructura controlados por el operador pueden observarla durante el tránsito/ejecución. Python y JavaScript tampoco permiten garantizar borrado físico de todas las copias de un string. Se eliminan referencias y se limita su duración, sin prometer zeroization. Para que la infraestructura nunca reciba la clave se necesitaría otro flujo con ejecutor controlado por el usuario.

Memoria del cliente reduce persistencia, pero sigue expuesta a XSS o scripts maliciosos del origen. [OWASP HTML5](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html) documenta el acceso de scripts a almacenamiento web. Por este motivo el MVP no usa localStorage, sessionStorage, IndexedDB ni cookies para BYOK.

## Información y ubicación

La tabla define ubicaciones **permitidas por el contrato objetivo**; no es un resultado de escaneo de persistencia. En particular, «Nunca» para BYOK exige remediar F04.

| Información | DB | Cliente | Servidor |
|---|---|---|---|
| Perfil system, revisión y asignaciones | Sí | Proyección pública autorizada | Configuración/cache sin secrets |
| Perfil personal, revisión y asignaciones | Sí, privado | Configuración del propietario | Configuración/cache sin secrets |
| Clave personal | Nunca | Memoria volátil | Solo memoria de request/cliente LLM |
| Alias de conexión de plataforma | Sí, metadata interna | No en DTO normal de usuario | Resolución autorizada |
| Clave de plataforma | No en nuevas tablas/catalog rows de esta integración | Nunca | Backend env en desarrollo o gestor de secretos en producción |
| Uso, errores, auditoría | Allowlist sin claves | Datos seguros | Allowlist sin cuerpos/headers sensibles |

No guardar tampoco claves cifradas, hashes de claves, prefijos/sufijos, fingerprints, request bodies o dumps de clientes como sustituto del secreto. El identificador del slot local puede derivarse de provider target/perfil y subject; no de la clave.

## Ciclo de vida BYOK

Secuencia requerida. Los pasos 6–8 no se acreditan por la implementación actual; ver [07](07_api_changes.md).

1. El usuario guarda un perfil **sin secret**.
2. Al usarlo, la UI solicita la clave en un input oculto y confirma el destino autorizado.
3. La clave entra en un almacén volátil separado del estado persistible de perfiles. Puede reutilizarse en esa sesión de la pestaña hasta olvido/logout/recarga.
4. Cada ejecución envía un campo transitorio `llm.credentials.api_key` por HTTPS/WSS, separado de contenido de usuario y de la autenticación de app.
5. El BFF valida subject/proyecto, selección efectiva y modo BYOK. No acepta alias de conexión de plataforma en perfiles personales.
6. El BFF envía credenciales en un envelope separado a API LLM. Se retiran del objeto que entra en admisión, fingerprint, snapshots y telemetry **antes** de serializarlo.
7. API LLM crea un cliente aislado para la ejecución. No comparte un cliente autenticado entre usuarios ni conserva un pool global indexado por clave.
8. Al finalizar, fallar o cancelar, se cierran clientes y se sueltan referencias. No se guarda un handle recuperable de la clave en Redis/DB/colas.

BYOK exige `expected_revision_id` del perfil resuelto y un target de destino fijado por esa revisión. Si la selección efectiva o el destino cambió, el BFF rechaza antes de reenviar la credencial y pide resolver otra vez. Los cambios de URL/adapter de target también necesitan identidad/revisión nueva; no reinterpretar el slot de memoria para otro destino.

La conexión HTTP puede reutilizar transporte sin secreto si la biblioteca lo permite, pero no headers/default auth que crucen requests. Inspeccionar el comportamiento real del adapter.

### Errores y ausencia de clave

- Perfil BYOK sin clave: `BYOK_KEY_REQUIRED`, sin llamada externa y sin reserva de crédito.
- Clave rechazada: `BYOK_KEY_REJECTED`; no convertirlo en 401 de sesión app ni disparar refresh infinito.
- Timeout/429: retry acotado del mismo target; no usar clave root.
- Cambiar la clave tras un fallo permite un nuevo intento autorizado sin incluirla en el fingerprint durable. La idempotencia distingue un replay de resultado terminado de una reejecución con nueva clave.
- Perfil platform con credencial personal adjunta: rechazo de combinación; no ignorar el secreto silenciosamente.

## Secrets de plataforma

Recomendación operativa: env del backend para desarrollo; en producción un gestor de secretos con identidad de workload y privilegios mínimos. [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html) es una referencia de cifrado, IAM, rotación y acceso auditado, no una dependencia obligatoria.

La conexión guarda un alias interno como `platform_text_primary`. El mapping a nombre de variable o referencia del gestor está en configuración de despliegue allowlisted. Root web selecciona una conexión configurada y ve estado/fecha de chequeo; no lee ni escribe secretos desde esa pantalla.

Objetivo final: API LLM es custodio de las claves de plataforma para texto. Durante transición el BFF puede conservar sus env actuales, pero después del cambio de transporte no las incorpora al grafo persistible. Evitar duplicar innecesariamente la misma credencial en ambos servicios.

Separar claves por entorno y proyecto, scopes y límites del proveedor, rotación y revocación. Cache de secreto de plataforma, si se usa, solo en memoria con TTL e invalidación; no meter BYOK en ese mecanismo. La guía de [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) respalda mínimo privilegio y gestión del ciclo de vida.

Nunca usar `VITE_*` para secretos de plataforma: se incorpora al bundle cliente. Ver [Vite env](https://vite.dev/guide/env-and-mode). OpenAI también recomienda mantener las claves de aplicación en backend/env o gestor: [autenticación](https://developers.openai.com/api/reference/overview#authentication). El formulario BYOK es una decisión específica para una clave aportada por su propietario y con exposición temporal; no debe describirse como garantía de aislamiento del navegador.

## Threat model y controles concretos del proyecto

| Amenaza | Control requerido |
|---|---|
| Usuario B intenta perfil personal A | Consultas y autorización por project+owner; devolver no disponible sin enumeración |
| Usuario inyecta `credential_mode=platform` o env ref | Scope/mode resuelto en backend; esquema rechaza campos no permitidos |
| Consumidor externo llama API LLM con connection alias | Gate de identidad del servicio delegador, proyecto, usuario y política; no basta conocer alias |
| URL personalizada roba una clave o accede a red interna | Targets curados, egress restringido, HTTPS, redirects bloqueados/validados y sin userinfo/query secret |
| Metadata/header contiene secret | Schemas por allowlist y rechazo de headers auth; no devolver headers sensibles |
| Prompt injection pide la clave | Secret fuera de prompts/tools/context; herramientas no pueden recuperar credenciales |
| Logging/exception filtra input | No serializar request completo, secrets con repr oculto, error mapper por código |
| XSS lee memoria | Revisar render Markdown/HTML, CSP y scripts de terceros; input/key fuera de telemetry y replay de sesiones |
| Volcado de proceso/swap guarda memoria | Deshabilitar core/crash dumps con datos; revisar swap/hibernación del host y agentes de diagnóstico |
| Retry o job reutiliza secreto de otro request | Contexto aislado por ejecución, cancelación y TTL; no variables globales con BYOK |

La allowlist de destinos aplica tanto al routing de la API como a su descubrimiento de modelos. Bloquear IPs privadas/reservadas y redirecciones a destinos no permitidos donde existan resoluciones variables. Estas defensas son una aplicación al proyecto de [OWASP SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html). No abrir endpoints arbitrary «OpenAI compatible» en el MVP.

El contexto de usuario proviene de autenticación, y se propaga a cachés/jobs sin aceptar un tenant del request como autoridad. Referencia: [OWASP Multi Tenant Security](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html).

## Superficies que deben excluir secrets

El contrato cubre **todo el recorrido**, no solo la tabla de perfiles:

- Acceso HTTP, reverse proxy/WAF, logs de headers/cuerpo y buffering de request a archivos temporales.
- APM, tracing, session replay y grabación de formularios del frontend.
- Errores Pydantic 422, que pueden incluir `input`, errores de parsing y excepciones del SDK.
- Grafo authored, `api_info`, `config`, `credentials`, `extra_data`, `extras`, subgraphs, snapshots y checkpoints.
- Admission intents, fingerprint/hash de intención, idempotency store y colas de reintento.
- Debug SSE, dumps de nodos, tools y resultado de provider health checks.
- Logs de infraestructura, Redis, cachés persistentes, backups y soporte/exportaciones.

Usar DTOs distintos para transporte y persistencia. La serialización durable se construye por allowlist, no con `request.model_dump()` seguido de borrado parcial. En grafos de esta integración, client bindings simbólicos; no secretos literales ni placeholders env elegidos por usuario. Inspeccionar también aliases y grafos anidados.

## WebSocket, streaming y jobs

La clave viaja en el frame de ejecución `chat`, nunca en URL, query string, `Sec-WebSocket-Protocol`, ping ni eventos del servidor. El subprotocol de app sigue reservado al token de sesión. Reconexión no significa reejecutar automáticamente una operación que quizá ya llegó al proveedor.

En SSE/HTTP, la clave va en el body de un POST, no en un EventSource URL. Responses y streams no devuelven key ni bytes del request original. Cancelación suelta referencias y confirma el estado de request para reintentos seguros.

Un worker activo puede conservar BYOK solo mientras realiza la operación admitida. La política inicial no lo deja esperando indefinidamente en memoria ni lo encola de forma durable. Si pierde la clave por restart, devuelve `credential_required` o fallo recuperable que exige reingreso. No reanuda usando platform. Cuando la etapa BYOK ya terminó y un job media tiene un provider request ID, puede seguir la recuperación de media existente sin necesitar aquella clave.

## Verificación exigida

Usar una clave canaria ficticia en tests: buscarla en DB de pruebas, snapshots, checkpoints, auditoría, outputs SSE/WS, archivos temporales, logs y exporters de telemetry. Cubrir éxito, 422, JSON inválido, provider error, timeout, cancelación, retry, helpers, subgraphs y restart. La verificación de infraestructura se hace en un entorno controlado con instrumentación; no requiere ni debe exponer claves reales.

La frase «La clave se usa temporalmente para esta sesión y no se almacena en nuestros servidores» solo puede publicarse cuando el camino real y su infraestructura satisfagan esta garantía. Mientras F04 permanezca abierto, no anunciar ausencia de persistencia end-to-end. El copy debe limitarse a propiedades verificadas, como la memoria de la pestaña y la necesidad de reingreso tras recargar. No afirmar «solo tú puedes verla» ni «jamás llega a nuestros servidores». Un resultado de test no prueba que todas las instalaciones futuras mantengan esa propiedad: convertir estos controles en pruebas de regresión y requisitos de despliegue.

Estado 2026-10-15: el copy actual de la UI ya incumple esta regla. [`llmProfiles.ts`](../../src/app/i18n/locales/llmProfiles.ts) (`key.explanation` y `byok.body`, EN/ES; renderizado en [`LlmSessionProvider.tsx`](../../src/features/llmProfiles/LlmSessionProvider.tsx) y [`ByokKeyPanel.tsx`](../../src/features/llmProfiles/ByokKeyPanel.tsx)) afirma que la clave no se guarda en nuestros servidores. Debe corregirse a las propiedades verificadas de memoria de pestaña; seguimiento en LLM-R3 ([16](16_current_status_and_roadmap.md)) y F11 ([seguridad](../security/README.md)).
