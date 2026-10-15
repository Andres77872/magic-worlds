# Fuentes, alcance y decisiones abiertas

**Reconciliación documental 2026-10-14: diseño/contratos del dossier original.** El código de perfiles existe y varios entregables se cerraron localmente después. Las propuestas y criterios de este archivo no acreditan rollout; usar [16](16_current_status_and_roadmap.md) para implementación actual, WIP operativo y TBD, y 12 para historia de pruebas.

Fecha de investigación: 2026-10-08. La documentación técnica pública puede cambiar. Las recomendaciones no dependen de nombres/precios de modelos concretos ni de instalar una herramienta nueva.

## Revisión local

Se leyeron archivos del working tree. HEAD identifica la base de referencia, pero no demuestra que no existan cambios locales en esos repositorios. No se evaluó el contenido de `.env`, no se accedió a datos de MySQL ni a secretos reales.

| Repositorio | HEAD observado |
|---|---|
| magic-worlds | `9ae1e36381ab510c0a4a920edd19d7846350aa48` |
| magic-worlds-api | `6529536d05b04de754cd96cab6fef3dc21577d89` |
| api.magic_llm | `c116e4599089b9dcf2d649a7b676b8eb884e5d95` |
| magic-agents | `2fe4007768282242b46a0b1ffcad1c3bcdc996d0` |
| magic-llm | `03e20b40fc3ca15c5f4edb0381cb6ca0b563d542` |

Las referencias locales detalladas están junto a cada hallazgo en [01](01_findings.md). Rutas principales:

- [BFF schema](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql) y [bootstrap](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py).
- [Persistencia/reservas de BFF](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py).
- [Catálogo DDL API LLM](/home/andres/PycharmProjects/api.magic_llm/scripts/schemas/catalog/01_create_tables.sql), capacidades, lifecycle y pricing migrations del mismo directorio.
- [Repositorio catálogo](/home/andres/PycharmProjects/api.magic_llm/src/repositories/catalog.py), [servicio catálogo](/home/andres/PycharmProjects/api.magic_llm/src/services/catalog.py), [acceso modelos](/home/andres/PycharmProjects/api.magic_llm/src/db/model.py).
- [Completion routes](/home/andres/PycharmProjects/api.magic_llm/src/routes/completions.py), [admisión](/home/andres/PycharmProjects/api.magic_llm/src/services/interaction_admission.py), [snapshot](/home/andres/PycharmProjects/api.magic_llm/src/util/execution_snapshot.py) y [persistencia nativa](/home/andres/PycharmProjects/api.magic_llm/src/db/native_execution.py).
- [Cliente nodo](/home/andres/PycharmProjects/magic-agents/magic_agents/node_system/NodeClientLLM.py), [schema cliente](/home/andres/PycharmProjects/magic-agents/magic_agents/models/factory/Nodes/ClientNodeModel.py) y [diagnósticos protegidos](/home/andres/PycharmProjects/magic-llm/magic_llm/util/request_privacy.py).
- [API web](/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/index.ts), [WS](/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/chatSocket.ts), tipos y vistas de admin/profile/novel.

La revisión estática encontró un camino que puede persistir el grafo con clave hidratada. No prueba presencia de claves en una DB real ni una exfiltración histórica. La verificación en ambiente controlado forma parte del plan.

## Fuentes externas utilizadas

| Fuente primaria | Aplicación al reporte |
|---|---|
| [OWASP HTML5 Security](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html) | Riesgo de scripts y almacenamiento cliente; no recomendar Web Storage para BYOK |
| [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) | Ciclo de vida, mínimo privilegio y evitar exposición de secrets |
| [OWASP Multi Tenant Security](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html) | Contexto derivado de auth y aislamiento por propietario/proyecto |
| [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) | Targets/egress/redirects al permitir routing a proveedores |
| [AWS Secrets Manager best practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html) | Referencia opcional para secrets platform con IAM/rotación |
| [Vite env and mode](https://vite.dev/guide/env-and-mode) | Variables VITE visibles en build cliente; no poner secrets platform allí |
| [OpenAI authentication](https://developers.openai.com/api/reference/overview#authentication) | Secrets de aplicación backend y separación de autenticación |
| [OpenAI Models API](https://developers.openai.com/api/reference/resources/models/methods/list) | Catálogo de identidad no equivale a compatibilidad de features |
| [Anthropic Models API](https://platform.claude.com/docs/en/api/models) | Descubrimiento/capacidades tienen contrato específico del proveedor |
| [OpenAI evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices) | Evaluar tareas representativas antes de promover defaults |
| [Langfuse data model](https://langfuse.com/docs/prompt-management/data-model) | Patrón de revisiones inmutables y puntero/label publicado |

Las decisiones de schema, API y UI son propuestas originales para esta arquitectura, no contratos prescritos por estas fuentes. No se copian precios de documentos anteriores del repo: requieren validación vigente cuando se seleccionen modelos.

## Decisiones ya fijadas por el usuario

Dos ámbitos system/user; default y override por feature; perfiles personales en DB sin sus secrets; solo secrets de plataforma persistentes en backend; BYOK sin cargo de plataforma por ahora. La autorización del refactor original correspondía a aquel trabajo, no a una instrucción operativa permanente de estos documentos. El 2026-10-09 el usuario exigió retirar todo legacy, incluidos aliases, env de modelos, hydrators, credenciales en DB y wrappers/caminos de compatibilidad. El historial está en [12](12_implementation_status.md); el review actual en [16](16_current_status_and_roadmap.md).

## Decisiones técnicas propuestas como base de implementación

- BFF controla perfiles/selección; API LLM controla catálogo/conexión y ejecuta plan autorizado.
- Memoria cliente inicial; sin «recordar clave en este dispositivo».
- Un target/credencial por perfil BYOK y todas sus llamadas LLM internas.
- Sin fallback automático que cambie pagador/proveedor.
- Targets y modelos curados; sin URLs arbitrarias ni grafos personales.
- Grafo persistible sin claves y client dependency runtime separado.
- Revisiones inmutables y current pointer; ejecución congela revisión.
- BYOK interactivo primero; media writers/callbot conservan selección root hasta completar su integración personal.
- Payer independiente de uso/costo estimado, y capacidad independiente de débito.

## Decisiones que deben cerrarse durante implementación

| Decisión | Default propuesto | Qué falta verificar |
|---|---|---|
| Gestor platform | Env backend en dev; gestor administrado en prod | Infraestructura disponible e identidad de workload |
| Destinos/modelos iniciales | Allowlist curada | Adapters realmente compatibles con cada grafo y cuenta de plataforma |
| BYOK cupos diarios | Separados por payer, mismos caps base y concurrencia global | Semántica actual de membership y carga permitida; no saldo ni PAYG |
| Política de default personal incompatible | Error visible; no fallback | UX de validación al asignar default para múltiples features |
| Etapas internas embeddings/moderación | Declaradas en plan; no root implícito en BYOK | Qué dependencias existen en la versión desplegada y cuáles habilitar |
| Tabla de reserva común | Adoptar por consumidor, sin doble conteo | Integración con guards/current turns e históricos |
| Pruebas personales de cuenta | Transitorias con cupo; inferencia explícita | Qué endpoints de auth/model listing ofrece cada proveedor |
| Retención de uso/auditoría | Datos mínimos sin secrets | Política de privacidad, borrado de usuario y obligaciones operativas |
| API envelope | Extensión protegida del camino actual | Schema/model_dump y semántica de delegation capabilities desplegadas |
| Rollback compatible con schema | Versión previamente preparada | Bootstrap exacto y orden real de deploys |
| Settings de helpers | Caps por rol, no 16k por defecto | Evals de metadata/preflight/extracción |

Estos puntos no bloquean la creación del reporte. Sí condicionan decisiones de código o lanzamiento; no se resolvieron suponiendo credenciales, schema real o infraestructura inexistentes.

## Relación con documentación existente

[Novela](../novel_refactor/README.md) y [Story Studio](../story_telling/README.md) distinguen el editor actual del target de escenas/asistente; este plan cambia la selección/credencial del LLM sin implementar todo ese target. [Billing](../billing/README.md) contiene propuestas de precios anteriores: aquí se fija explícitamente cargo app BYOK=0, sin modificar precios de media ni asumir que aquellas propuestas están implementadas.

Cuando se implemente cada fase, actualizar este reporte con su estado real, migrations/endpoints disponibles y resultados de validación. No convertir una propuesta en «implementado» por haber guardado estos archivos.
