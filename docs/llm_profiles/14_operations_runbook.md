# Runbook operativo de perfiles LLM

**Revisado: 2026-10-15. Estado: referencia operativa activa; aceptación de custodia bloqueada.** Los perfiles y la admisión existen. El BFF actual transforma los clientes simbólicos en `engine`, `model` y `api_info`, y publica `{agt, messages, stream}` en `/v1/chat/completions`. No usa el handshake del diseño protegido. [Estado actual](16_current_status_and_roadmap.md) y [hallazgos de seguridad](../security/README.md) tienen precedencia.

## 1. Identificar el contrato realmente instalado

Registrar las revisiones del frontend, BFF, API LLM y runtime instalado, la configuración permitida y el schema. Comparar el paquete/runtime utilizado por el servicio con el checkout inspeccionado; la existencia de una factory protegida en otro módulo no demuestra su uso en esta ruta.

- [Carga del transporte](../../../../PycharmProjects/magic-worlds-api/src/services/llm_profile_api.py): `LLM_PROFILES_ENABLED` controla el transporte BFF; ausente devuelve `503 LLM_PROFILES_DISABLED`.
- [Transporte vigente](../../../../PycharmProjects/magic-worlds-api/src/services/llm_execution_transport.py): consulta `/models` y `/providers`, valida los targets configurados y renderiza el grafo al despachar.
- [Cliente de perfiles](../../src/features/llmProfiles/LlmSessionProvider.tsx) y [credenciales de pestaña](../../src/features/llmProfiles/credentialSession.ts): configuración persistible separada de memoria BYOK del navegador.
- [Bootstrap](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py): el source exige la revisión nombrada por `CONTENT_SCHEMA_REVISION` en el bootstrap BFF (propiedad de la ejecución activa de Fish/voz; no se afirma aquí). La revisión realmente desplegada debe verificarse por separado.

## 2. Gate de custodia pendiente

El transporte actual coloca la clave BYOK en `agt` antes de serializar. La ruta inline del ejecutor conserva una copia del grafo authored en el snapshot nativo. Limpiar el diccionario del BFF después del envío no elimina la copia recibida. Por tanto, **no está acreditada la promesa de no persistencia end-to-end**.

Antes de declarar esa garantía, ejecutar un canario ficticio por la ruta completa BFF → admisión → runtime → snapshot, incluyendo éxito, fallo, cancelación y retry. El criterio es ausencia del valor y de derivados prohibidos en persistencia, historial, diagnósticos y telemetría. El diseño deseado permanece en [05](05_security_and_secrets.md); F04 y F05 permanecen abiertos en [seguridad](../security/README.md).

Antes de habilitar BYOK en un entorno, corregir el copy de UI que afirma que la clave no se guarda en servidores ([`llmProfiles.ts`](../../src/app/i18n/locales/llmProfiles.ts) `key.explanation` y `byok.body`, EN/ES; F11).

No usar `LLM_EXECUTION_ENABLED`, `/v1/llm-execution/capabilities` ni `LLM_EXECUTION_CREDENTIAL_CUSTODY` como prueba de que este BFF negocia el transporte protegido. Son controles de otro contrato; su adopción necesita implementación y aceptación explícitas.

En producción, `MAGIC_LLM_DEBUG_PAYLOAD` y `MAGIC_LLM_DEBUG_PAYLOAD_FULL` (magic-llm) deben estar apagados: fuera de ejecuciones protegidas, el primero registra previews de resultados de tools y el segundo los mensajes y tools completos. Ningún proxy, balanceador, APM, exporter o dump debe capturar bodies de request ni headers `Authorization`; con el transporte actual, el body BFF → API LLM lleva la clave BYOK dentro de `agt`.

## 3. Catálogo, perfiles y asignaciones

Revisar el catálogo seguro que realmente proyecta el BFF, los targets/conexiones de la configuración actual, las capacidades de cada feature y las revisiones publicadas. Usar [las rutas vigentes](../../../../PycharmProjects/magic-worlds-api/src/routes/llm_profiles.py) y los ETags de lectura para escrituras con control de versión.

- Las modificaciones de perfiles, policy y preferencias existentes (editar draft/perfil, publish, rollback, archive, `PUT` de policy/preferencias y `DELETE` del override) envían `If-Match` con el ETag leído; sin él devuelven 428 `PROFILE_VERSION_REQUIRED` y con una versión desactualizada, 409 `PROFILE_VERSION_CONFLICT`.
- Usuario: `DELETE /user/llm/preferences/features/{feature}` quita el override; la feature hereda default personal → recomendación root → default global. Root: `PUT /admin/llm/policy` sin esa feature la devuelve al default global.
- El default global no puede quedar vacío (422 `SYSTEM_DEFAULT_REQUIRED`); solo se reemplaza por otro perfil system publicado.
- Archivar falla con 409 `PROFILE_IN_USE` mientras cualquier default o asignación del proyecto lo use, incluidas preferencias de usuarios. No hay reasignación forzada: publicar el sustituto y retirar antes las asignaciones (root las suyas; los usuarios las propias).
- Una ejecución en curso conserva la revisión congelada al admitirse; los cambios de asignación solo afectan a ejecuciones nuevas.

Una selección incompatible, archivada, no autorizada o sin credencial debe fallar de forma accionable. No omitirla para elegir otro pagador. Retirar un override permite herencia; no equivale a omitir una selección inválida. Las pruebas explícitas de perfiles pueden producir inferencia y costo, y quedan fuera de una inspección de solo lectura.

Los defaults/precios preparados el 2026-10-10 son históricos (ver [ledger 16](16_current_status_and_roadmap.md#evidencia-y-precedencia)), no perfiles publicados ni evaluaciones actuales. La publicación requiere evidencia del grafo/feature/modelo/configuración, no solo el nombre de un modelo.

## 4. BYOK, fallos y reintentos

La memoria de la pestaña y los controles HTTPS del frontend reducen retención del cliente, pero no certifican custodia del ejecutor. El transporte BFF permite HTTPS o HTTP de loopback hacia API LLM; esa excepción local no habilita BYOK en una SPA/API pública HTTP.

Una respuesta upstream perdida o inválida es terminal para el transporte actual; no hay recuperación upstream pendiente automática. El BFF conserva sus propios planes/recibos y puede ofrecer reconciliación o retry explícito según la feature. Distinguir replay de un resultado, nuevo intento y recuperación de un stream; no inferir que un retry usa el grafo corregido después de congelar el plan. Probar no duplicación de efectos y cargos, reentrada de credencial y cambios de cuenta/proyecto/workspace.

Comportamiento implementado en la SPA (base de aceptación de LLM-R5). La clave vive en [`credentialSession`](../../src/features/llmProfiles/credentialSession.ts) y el target congelado por request ID, sin clave, en `llmIntents` ([`llmIntent.ts`](../../src/infrastructure/api/llmIntent.ts)); ambos solo en memoria:

| Evento | Clave | Target congelado | Request sin terminar |
|---|---|---|---|
| Recarga de la pestaña | Se pierde | Se pierde | Extracción: el recibo local reanuda con su request ID y target. Chat: el historial del servidor muestra el turno, y un turno interrumpido se reconcilia por request ID al reintentar desde esta pestaña. Las demás superficies inician una solicitud nueva |
| Token expirado (mismo usuario) | Se borra | Se conserva | Tras el refresh, el reintento reenvía el target sin clave; si el servidor la pide, se solicita solo para el mismo perfil y revisión |
| Logout, cambio de cuenta/proyecto u otra pestaña cambia el token | Se borra | Se borra | Nada se reenvía; el siguiente intento es una solicitud nueva |
| Restart o lease vencido en el servidor | El BFF no la guarda; el snapshot del ejecutor puede conservarla mientras F04 siga abierto | Se conserva | El reintento con el mismo request ID recupera la ejecución congelada sin doble cobro. Si es BYOK y el servidor pide la clave, se solicita otra vez; nunca cambia a platform. Un fallo terminal confirmado ofrece un intento enlazado (`retry_of_execution_id`) |

## 5. Rotación y retención

El transporte platform envía referencias de entorno al ejecutor y el runtime actual materializa clientes. Verificar en el servicio real cuándo se cargan y retienen esos valores antes de planificar rotación. Coordinar sustitución, reinicio/drenaje y verificación con el operador; este documento no acredita una rotación ni promete resolución lazy por ejecución.

Snapshots, mensajes, checkpoints, auditoría, recibos y backups necesitan una política de retención. **No afirmar que todos esos almacenes excluyen credenciales mientras F04 siga abierto.** Hoy no hay purga automática de planes, recibos y reservas del BFF, snapshots y eventos de API LLM ni facts de uso, que guardan prompts y resultados del usuario. Antes del release, decidir plazos por tabla, retención de backups y el tratamiento de backups anteriores al corte, que pueden contener configuración antigua. Las claves de media tienen ciclos de vida separados; la selección BYOK de texto no cambia automáticamente el costo ni la autorización de imagen, música o voz.

## 6. Migraciones y handoff de revisión

Usar la [guía de base actual](../../../../PycharmProjects/magic-worlds-api/docs/database.md), el bootstrap y las herramientas de la revisión desplegada. Los cortes antiguos de perfiles, workflows, turnos y columnas tenían precondiciones específicas y algunos borraban datos. Las herramientas de corte vigentes están en esa guía y en el [catálogo de API LLM](../../../../PycharmProjects/api.magic_llm/docs/llm_execution_catalog.md).

API LLM: [`20261010_retire_agent_model_reference.sql`](../../../../PycharmProjects/api.magic_llm/scripts/migrations/20261010_retire_agent_model_reference.sql) elimina `magic_manage.tb_agent_flow.id_model` y su índice en un único ALTER. Aplicarlo en el mismo despliegue, tras terminar la inicialización/verificación del versionado de agentes, con los escritores anteriores detenidos y `SHOW CREATE TABLE` revisado (sin FK sobre la columna), antes de arrancar el writer nuevo sobre una tabla con `id_model NOT NULL`. Retirar la columna cambia el fingerprint del verificador de identidades; no reutilizar la prueba previa. Antes de aplicarlo, retirar o corregir `eval_user_model_access_for_agent` en `api.magic_llm/src/db/user.py` (hoy sin llamadores), que todavía hace JOIN sobre `tb_agent_flow.id_model`. Pendiente de verificar por entorno (no aplicado en `.90` según el registro del 2026-10-10).

Inspeccionar primero la revisión existente, los preflights soportados, escritores activos, backups/restauración y el orden de despliegue. Una base posterior no debe recibir otra vez un corte predecessor. La ejecución Fish está fuera de este cleanup: cualquier avance o handoff de esa integración corresponde a [su ledger](../fish_audio_support/11_implementation_status.md).

## 7. Evidencia para cerrar aceptación

Registrar revisiones y entorno, canarios de custodia, catálogo/perfiles publicados, matriz feature/pagador/fallo/retry, conciliación de uso/créditos y comportamiento de límites. Los conteos de logs anteriores no se suman como cobertura única ni prueban el entorno actual.

Este cambio documental no ejecutó inferencia, consultas de base, migraciones, cambios de configuración ni despliegue.
