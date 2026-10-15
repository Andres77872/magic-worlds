# Cambios de base de datos

**Reconciliación documental 2026-10-14: diseño/contratos del dossier original.** El código de perfiles existe y varios entregables se cerraron localmente después. Las propuestas y criterios de este archivo no acreditan rollout; usar [16](16_current_status_and_roadmap.md) para implementación actual, WIP operativo y TBD, y 12 para historia de pruebas.

Este documento describe el modelo relacional del refactor. El fresh y el upgrade explícito se verifican con MySQL efímero local; no se aplicó una migración a la base desplegada. La comprobación de metadata de `.90`, su alcance y los resultados locales están en [estado de implementación](12_implementation_status.md).

## Distribución de responsabilidades

| Base/servicio | Fuente de verdad |
|---|---|
| magic-worlds-api | Perfiles, revisiones, defaults, asignaciones, compatibilidad de features, admisión/cargo app y plan resuelto |
| api.magic_llm | Targets/modelos, conexiones platform permitidas, precios/capacidades, ejecución y facts de uso |
| api.auth | Identidad y grupos; no almacenar BYOK allí |
| Navegador | Estado volátil de la clave; no tabla ni sincronización de credenciales |

No crear FK entre bases de servicios. El BFF usa `tb_user.user_id` para sus FKs; la comunicación usa subject validado `user_hash` y proyecto, nunca IDs enteros locales intercambiables. Perfiles son de proyecto+usuario; `user_group_hash` controla entitlements al ejecutar, no crea copias del mismo perfil para cada grupo.

## Tablas nuevas en BFF

El DDL actual contiene 20 tablas de perfiles, admisión, workflows, turnos y recibos de cards, dentro de un fresh de 68 tablas. Usar UUID público opaco, tipos/collations consistentes con `db.sql`, InnoDB, timestamps UTC y SQL parametrizado. `project_hash` forma parte de índices y validación incluso si hoy hay un solo proyecto por deployment.

| Tabla | Columnas principales | Integridad e índices |
|---|---|---|
| `cat_llm_feature` | feature_key, nombre, registro/revisión de contrato, user_selection_enabled, byok_enabled | PK feature_key; seeds desde registro de workflows, no CRUD libre de grafos |
| `tb_llm_project_state` | project_hash, versiones de política y preferencias | PK proyecto; lock común para mutaciones y resolución transaccional |
| `tb_llm_profile` | profile_id, project_hash, scope, owner_user_id, name, description, status, draft_config, row_version, created/updated_by, timestamps | PK profile_id; UNIQUE(project_hash,profile_id); CHECK scope/owner; índice(project_hash,scope,status), (project_hash,owner_user_id,status); owner FK tb_user |
| `tb_llm_profile_revision` | revision_id, profile_id, revision_kind (`publication`/`draft_test`), revision_number nullable, draft_row_version nullable, provider_target_key, credential_mode, platform_connection_key nullable, catalog_revision, config_schema_version, created_by, created_at | UNIQUE(profile_id,revision_id), UNIQUE(profile_id,revision_number), UNIQUE(profile_id,draft_row_version), UNIQUE(profile_id,revision_id,revision_kind); FK profile; CHECK modo/conexión; una publicación tiene número y ningún draft_row_version; un `draft_test` solo existe para system, sin número y con la versión exacta del borrador probado; inmutable |
| `tb_llm_profile_role` | profile_id, revision_id, role_key, catalog_model_key, provider_model_id_snapshot, supported settings, provider_parameters JSON validado | PK(revision_id,role_key); FK compuesto(profile_id,revision_id); `primary` obligatorio validado al publicar; modelos del mismo target |
| `tb_llm_profile_current` | profile_id, revision_id, revision_kind fijo `publication`, publication_generation, published_at/by | PK profile_id; FK compuesto(profile_id,revision_id,revision_kind); no revisión ajena ni `draft_test` |
| `tb_llm_system_defaults` | project_hash, default_profile_id, policy_generation, row_version | PK project_hash; FK compuesto(project_hash,profile_id); perfil system activo; uno por proyecto |
| `tb_llm_system_feature_profile` | project_hash, feature_key, profile_id | PK(project_hash,feature_key); FK feature/perfil del mismo proyecto; ausencia = heredar |
| `tb_llm_user_defaults` | project_hash, user_id, default_profile_id nullable, preferences_generation, row_version | PK(project_hash,user_id); FKs usuario/perfil; null = no default personal |
| `tb_llm_user_feature_profile` | project_hash, user_id, feature_key, profile_id | PK(project_hash,user_id,feature_key); FKs; ausencia = heredar |
| `tb_llm_execution_plan` | execution_id, project_hash, user_id, feature_key, operation, request_id, profile_id, revision_id, resolution_source, payer_mode, effective_config JSON, graph_hash/version, policy/catalog revisions, status, timestamps | PK execution_id; FKs perfil/revisión; índices user/time, profile/revision/time; admisión/idempotencia del contrato nuevo |
| `tb_operation_reservation` | reservation_id, execution_id, project/user/group, operation, payer_mode, platform_credit_cost, status, lease_expires_at, released_at | UNIQUE execution_id; índice(project,user,operation,status,lease); CHECK BYOK cost=0; capacidad independiente del ledger |
| `tb_operation_usage_day` | proyecto, usuario, grupo, operación, payer_mode, fecha UTC, request_count | PK compuesta incluye pagador; cupos separados, sin wallet ni ledger monetario BYOK; el histórico sin atribución usa `unattributed` |
| `tb_llm_profile_audit` | event_id, project, actor_user_id, profile_id nullable, event_type, revision_id, change_summary JSON safe, timestamp | Append-only; índices profile/time, project/actor/time; no request completo |
| `tb_llm_workflow` | identidad, proyecto, prompts/topología del draft, row_version | Built-ins verificados en archivos; customs aislados por proyecto, sin modelos ni settings de proveedor |
| `tb_llm_workflow_revision` | workflow_id, revision_id, número y definición compilada | Revisión inmutable; FK al workflow y unicidad por número |
| `tb_llm_workflow_current` | workflow_id, revision_id | Current pertenece al mismo workflow; toda creación tiene revisión/current inicial |
| `tb_llm_card_generation` | execution_id, proyecto/usuario/grupo, card_id/type, request_id, description, output_snapshot | PK execution_id; card_id=execution_id; FKs compuestas a plan y reserva del mismo scope; resultado y creación de card en el commit de finalización |
| `tb_llm_assistant_turn` | execution_id, proyecto/usuario/grupo, assistant_kind, conversación y turno | Asociación del turno de card/lorebook assistant con su plan y reserva; conserva identidad para recuperación |
| `tb_operation_receipt` | receipt_id, execution_id nullable, scope, request_id, status, source_kind, card_id/type, result_snapshot y fechas | Recibos actuales o históricos `unattributed`; los actuales enlazan plan/reserva, sin inventar perfiles o pagadores para el histórico |

`draft_config` solo admite el mismo schema seguro de configuración, sin credenciales. La API de usuario puede ahorrar el ciclo draft/publicación: cada save validado crea revisión y actualiza current. Root edita draft y publica explícitamente. No usar JSON libre para routing, headers, env refs o herramientas.

### Campos de settings

Guardar columnas tipadas para temperature/top_p, max_input_tokens, max_output_tokens, max_messages, timeout_seconds y truncation_strategy. Los parámetros específicos del proveedor pueden estar en JSON con schema versionado, límites de tamaño, keys allowlisted y validación del adapter. No fijar un CHECK de temperature universal que todos los modelos deban usar; permitir null cuando no se soporta y validar semántica con metadata.

La forma de salida, tools y prompts son del workflow, no columnas personalizables del perfil. `provider_model_id_snapshot` registra qué identidad se publicó; API LLM revalida su correspondencia con el descriptor. Los límites efectivos se guardan en execution_plan, ya calculados para la feature.

### Constraints esenciales

```sql
-- Fragmentos de diseño, no DDL listo para ejecutar.
CHECK (
  (scope = 'system' AND owner_user_id IS NULL)
  OR (scope = 'user' AND owner_user_id IS NOT NULL)
);

CHECK (
  (credential_mode = 'platform' AND platform_connection_key IS NOT NULL)
  OR (credential_mode = 'user_byok' AND platform_connection_key IS NULL)
);

-- En tb_llm_profile_current y cualquier vínculo revisión/perfil:
FOREIGN KEY (profile_id, revision_id)
  REFERENCES tb_llm_profile_revision (profile_id, revision_id);
```

El scope del perfil y el modo de su revisión deben coincidir. Los CHECK de una fila no prueban esa regla entre tablas. Validarla en la transacción de escritura/publicación, restringir permisos de escritura directa y cubrirla con pruebas. Igual para asignaciones: el target debe ser system permitido o user del mismo owner; una FK por ID/proyecto no prueba ownership.

Separar tablas de defaults globales y personales evita depender de UNIQUE con owner NULL, ya que MySQL permite varios NULL en índices únicos. No usar un user_id ficticio para representar root/global.

## Transacciones y concurrencia

1. **Guardar/publicar:** bloquear perfil, comprobar row_version, validar draft/roles, crear revisión inmutable y roles, actualizar current/generación, agregar auditoría. Commit conjunto.
2. **Cambiar default/asignaciones:** validar perfil/proyecto/owner y compatibilidad, actualizar filas y generación de preferencias/política en una transacción. Cambio masivo RP atómico.
3. **Admitir ejecución:** comprobar primero admisión/idempotencia existente; si no existe, resolver/fijar revisión, adquirir capacidad y crear plan/reserva. Débito platform y vínculo de ledger en la misma transacción cuando aplica. BYOK no crea débito. Un retry usa la revisión ya admitida.
4. **Finalizar:** marcar resultado terminal y liberar capacidad una vez; aplicar compensación platform según reglas existentes. BYOK libera capacidad sin refund monetario de app.

Usar optimistic concurrency con `row_version`/ETag para ediciones y publicación; conflicto devuelve 409. Definir un orden único de locks que respete conversación→run en paths existentes; no introducir deadlocks al mezclar preferencia, perfil y reserva. No mantener locks de DB durante llamadas al proveedor.

## Cambios a persistencia existente del BFF

| Estructura | Cambio |
|---|---|
| `user_preferences` | Mantener idioma/otras preferencias; perfiles en tablas dedicadas, no JSON de secrets en esta fila |
| `tb_agent_definition/version/current_version` | Retirar del fresh y del runtime; reemplazar por las tres tablas de workflows sin configuración de proveedor |
| `ai_card_idempotency`, `ai_card_quota_day` | Retirar; plan/reserva/cuota BYOK son la autoridad nueva. Hash de intent excluye claves y preserva idempotencia por workflow/scope |
| `adventure_message` y estado del turn en modelos | Asociar execution/reservation; cambiar contrato actual de credit_reservation que exige ledger_ids no vacíos y cost>0 |
| `card_assistant_*`, `lorebook_assistant_*` | Enlace de request/generación a plan/reserva; guards de request activo compatibles con cargo cero |
| `story_generation` | Provenance por ejecución: perfil/revisión/modelo efectivo, sin credenciales; candidato+resultado+release en commit único |
| `card_resource_generation_history` | Retirar lector y writer; usar `tb_llm_card_generation` con snapshot privado y referencias al plan/reserva |
| `lorebook_resource` | Enlace de extracción a plan, cuando usa LLM |
| `membership_operation_usage_day` | Uso financiero platform; capacidad/cupos por pagador en `tb_operation_usage_day` y concurrencia global mediante reservas; BYOK no escribe el contador financiero |
| `membership_usage_day`, PAYG wallets/ledger | Sin incremento/débito para BYOK; platform conserva política vigente |
| `membership_credit_ledger` | Mantener fuente included/payg; no representar BYOK mediante débito ficticio. Vínculo opcional desde reserva platform a ledger |
| `image_job`, `theme_song_job`, `tts_job`, voz | Enlazar etapa escritora LLM donde aplique; no añadir secretos a input_summary/result_summary ni colas |

El cálculo anterior de count_in_flight se retira al adoptar `tb_operation_reservation` en todos los consumidores. La reserva nueva es la única autoridad de capacidad y se prueba bajo concurrencia. Ningún request se cuenta simultáneamente por su estado anterior y por su reserva nueva.

La reserva de chat actual valida `credit_cost > 0` y `ledger_ids` no vacíos: [validación](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:21810). Esa estructura debe pasar a un reservation ID con billing link opcional; bajar el costo a cero por sí solo rompe el contrato.

Los límites diarios BYOK son cupos de solicitudes/infraestructura y no condiciones de saldo. No recurren a PAYG para comprar más capacidad dentro de esta modalidad inicial. Decidir si comparten contador con platform o tienen uno separado y reflejarlo en schema y API; default propuesto: contador separado por payer con los mismos caps de operación, conservando además límite global de concurrencia.

Si se elige ese default, ampliar la PK/queries de `membership_operation_usage_day` para incluir payer o crear una tabla específica de cupos BYOK. No mezclar BYOK con el contador legacy sin querer cambiar la capacidad platform restante. La adquisición debe serializar por usuario/operación en ambos modos; estados y leases permiten liberar capacidad sin ledger monetario. Definir y probar cuándo un fallo anterior a llamar al proveedor compensa el contador, conservando un rate limit independiente para errores/abuso.

## Cambios en catálogo/base de API LLM

Catálogo de ejecución que sustituye el contrato anterior:

- `cat_provider_target`: key estable/revisión de destino, vendor, engine/adapter, HTTPS base aprobada, parámetros/headers **públicos** permitidos y lifecycle. Destino administrado por root de infraestructura; cambio de destino exige identidad/revisión nueva.
- `cat_platform_connection`: project_hash, connection_key, target_key, credential_alias y estado. UNIQUE(project_hash,connection_key). No key ni headers auth literales.
- `cat_llm_model_descriptor`: identidad estable y FK al target nuevo, límites, capacidades, modos de credencial y evaluación por feature. Sin FK ni aliases al modelo anterior. Los precios se versionan con la identidad nueva.
- Extender catálogo seguro para entregar descriptor/target y compatibilidad de adapter, sin metadatos internos del gestor de secretos.
- Retirar `cat_providers.provider_key`, headers de autenticación y sus APIs de escritura/lectura. Las credenciales platform se provisionan en env/gestor y se vinculan por custodia explícita project+target+alias; ninguna fila elige libremente una variable de entorno.
- Eliminar los endpoints, DTOs, wrappers y discovery basados en el contrato anterior. No insertar usuarios BYOK como proveedores con key vacía o falsa.

La instrucción del usuario exige retirar el contrato anterior para todos sus consumidores, sin modo de compatibilidad. El despliegue debe coordinar ese corte y la provisión explícita del catálogo nuevo. La migración de datos se prepara y verifica en una base efímera; no se ejecutan borrados en bases desplegadas durante el trabajo de código.

## Uso, snapshots y recuperación en API LLM

Ampliar las entidades existentes `tb_interaction`/`tb_execution` y `tb_usage_fact` con attribution segura: execution ID del BFF, project, feature, profile/revision, role, payer_mode y modo de credencial; sin FK entre servicios. Seguir usando el ledger de uso existente para cada llamada/intento.

Para BYOK, registrar el modelo real, tokens y precio snapshot si existe; el costo del proveedor puede ser conocido/estimado/desconocido. El cargo app es cero y no debe alterarse el precio de catálogo. Nunca guardar key en `raw_usage_json`, `reasoning_text`, metadata o errores.

La extensión del request de ejecución debe quitar la credencial **antes** del `model_dump()` general/admission fingerprint. El grafo persistido usa bindings simbólicos y el snapshot sigue siendo exacto de ese grafo sin secrets. No «limpiar» el snapshot después de calcular su hash y romper sus garantías de restore. La credencial se inyecta en una instancia runtime que nunca se serializa.

Restore BYOK puede reconstruir el plan, pero no el cliente autenticado. Exige una nueva credencial del mismo subject autorizada para ese request, o declara fallo recuperable. Evitar que un recovery worker pruebe la conexión platform del descriptor como sustituto.

## Borrado, archivo y retención

- Archivo de perfil conserva revisiones y referencias históricas. Bloquear si hay defaults/asignaciones activas; ofrecer sustitución explícita y atómica.
- No borrar revisiones usadas por ejecuciones. Soft archive y FKs RESTRICT para no destruir provenance.
- Eliminar cuenta requiere coordinar perfiles, preferencias y retención de uso/auditoría según política de privacidad; conservar solo datos mínimos permitidos. No asumir CASCADE general.
- TTL de planes/telemetry y de auditoría se define operativamente; no duplicar cuerpos privados por comodidad.
- Claves antiguas que hayan quedado en datos/backups requieren rotación y procedimiento de saneamiento; borrar una columna no elimina versiones previas en backups.

## Migración del contrato de esquema

Actualizar `src/database/mysql/db.sql`, `bootstrap.py`, revision marker, seeds, índices/checks esperados y tests de estructura. El bootstrap verifica tablas/metadata exactas: añadir tablas sin ajustar sus contratos puede fallar readiness. Migración upgrade separada de DDL fresh install, idempotente en sus precondiciones y sin anunciar revisión nueva hasta terminar. Ver [rollout](09_migration_and_rollout.md).

El fresh actual tiene 68 tablas: 48 sin cambios y las 20 del contrato nuevo. El corte retira las seis tablas anteriores de workflows/cards. El upgrade valida su DDL histórico como artefacto de migración y dispone de conversión poblada explícitamente revisada, con preflight/conteos/locks y reglas de reconciliación. El contrato y sus límites están en [09](09_migration_and_rollout.md) y [13](13_historical_provenance.md); la evidencia MySQL local está en [12](12_implementation_status.md). No hay reader de compatibilidad ni importación automática de secretos. No se ejecutó ese corte en `.90`.
