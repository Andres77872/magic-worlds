# Cambios requeridos de API

**Revisado 2026-10-15. Estado: referencia de interfaces actuales y brecha de transporte.** El control de perfiles existe. El protocolo protegido, su handshake y la continuación upstream descritos por la especificación anterior no son el camino usado por este BFF. [16](16_current_status_and_roadmap.md) mantiene el estado.

## Interfaces presentes en el BFF

La [ruta de perfiles](../../../../PycharmProjects/magic-worlds-api/src/routes/llm_profiles.py) es la fuente del inventario exacto. Sus DTOs seguros, permisos y precondiciones están en [modelos](../../../../PycharmProjects/magic-worlds-api/src/models/llm_profiles.py) y [contexto autenticado](../../../../PycharmProjects/magic-worlds-api/src/services/llm_profile_api.py).

| Familia | Rutas presentes / propósito |
|---|---|
| Catálogo y selección | `GET /llm/features`, `/llm/models`, `/llm/profiles`, `/llm/profiles/{profile_id}`; effective-profile y `POST .../resolve` por feature |
| Ejecuciones propias | `GET /llm/features/{feature}/executions/{request_id}` y `/profile`; `GET .../retry-profiles/{execution_id}` |
| Root | `/admin/llm/profiles`: crear, compatibility, detalle, draft, validate, test, publish, rollback y archive; policy, connections, catalog/sync y audit |
| Usuario | `/user/llm/profiles`: crear, compatibility, detalle, editar, test y archive; preferences y quitar override por feature |
| Uso | `/llm/receipts`, detalle propio y `/llm/capacity-usage`; `/admin/llm/provider-usage` para root |

Las rutas admin requieren sesión root. La API obtiene identidad/proyecto del actor, aplica ownership y versiones de escritura; una selección inválida no habilita otro pagador. Los tests explícitos pueden ejecutar inferencia/cobrar y no forman parte de una inspección de lectura.

Cards, novela, assistants, extracción, chats, writers y callbot tienen sus propios contratos de ejecución y resultados. Consultar sus rutas/DTOs y el registro [llm_features.py](../../../../PycharmProjects/magic-worlds-api/src/services/llm_features.py), que hoy también incluye `app_assistant` y el clasificador de speech anterior. No usar la antigua tabla propuesta como inventario de features instalado.

## Transporte BFF → API LLM realmente usado

1. El BFF admite/congela el plan y payload simbólicos, revisiones, pagador y reserva.
2. [render_outbound](../../../../PycharmProjects/magic-worlds-api/src/services/llm_execution_transport.py) copia el grafo, transforma `client_binding` a `engine/model/api_info` y publica **`{agt, messages, stream}`** en `/v1/chat/completions`.
3. Platform envía un placeholder de entorno del target. BYOK envía **la clave literal dentro de `agt`**. Los [tests de transporte](../../../../PycharmProjects/magic-worlds-api/tests/services/test_llm_execution_transport.py) afirman esta forma.
4. El HTTP usa la sesión Bearer del usuario y, cuando se configura, `X-Delegation-API-Key`. Eso autentica/delega; no prueba custodia segura.
5. El ejecutor inline conserva el grafo authored en su [snapshot](../../../../PycharmProjects/api.magic_llm/src/util/execution_snapshot.py). F04 sigue abierto en el [registro de seguridad](../security/README.md).

`LLM_PROFILES_ENABLED` habilita el transporte BFF; sin configuración devuelve `LLM_PROFILES_DISABLED`. El transporte consulta `/models` y `/providers`. No negocia el handshake `/v1/llm-execution/capabilities` ni envía el envelope protegido descrito por el diseño original. Que exista una factory segura separada en el ejecutor no cambia este hecho.

En API LLM `d86273d`, [`src/routes/__init__.py`](../../../../PycharmProjects/api.magic_llm/src/routes/__init__.py) no registra el router [`llm_execution_recovery`](../../../../PycharmProjects/api.magic_llm/src/routes/llm_execution_recovery.py) (`/v1/llm-execution/requests/...`) y ninguna ruta importa [`services/profile_admission.py`](../../../../PycharmProjects/api.magic_llm/src/services/profile_admission.py): el camino protegido no es alcanzable por HTTP. `PrivateOutputGuard` solo se usa en ese camino ([`services/llm_execution.py`](../../../../PycharmProjects/api.magic_llm/src/services/llm_execution.py)).

El grafo outbound tampoco conserva `client_binding` (lo afirma el [test de transporte](../../../../PycharmProjects/magic-worlds-api/tests/services/test_llm_execution_transport.py)). Por eso la privacidad de salida de helpers por rol simbólico de API LLM `d86273d` no se activa para grafos del BFF; el filtrado narrativo de ese camino depende del BFF `2c2973d`.

## Resultados perdidos, replay y nuevos intentos

El transporte actual trata respuesta perdida/inválida como fallo terminal. No tiene recuperación upstream pendiente automática ni conecta los endpoints remotos `requests/.../resume` del diseño anterior. Los planes, recibos, GET de dominio, reconciliación y nuevos intentos explícitos del BFF son mecanismos diferentes; verificar cada consumidor sin deducir equivalencia.

La selección/revisión e intención quedan congeladas según el contrato de cada feature. BYOK requiere credencial transitoria nueva cuando el retry lo pide; no sustituir por platform. La aceptación pendiente incluye no duplicación de efectos/cargos, respuesta tardía, recarga y aislamiento de cuenta/proyecto/workspace. La corrección del planner narrativo `mw_read_card` existe en `2c2973d`; no es un endpoint pendiente.

## Contrato de seguridad aún requerido

[05](05_security_and_secrets.md) y la [ADR](03_architecture_and_approach.md) definen la meta: credencial fuera del grafo/fingerprint/persistencia, autorización del destino y cliente privado runtime. El camino protegido no registrado de API LLM (`services/llm_execution.py`, `routes/llm_execution_recovery.py`, `services/profile_admission.py`) y el handshake `/v1/llm-execution/capabilities` del diseño anterior (sin ruta en `d86273d`) son una propuesta de solución, no un soporte que este BFF haya adoptado. Cualquier implementación que cierre la brecha requiere evidencia end-to-end por el camino real y actualización de este inventario.

La privacidad del contenido es independiente de la custodia BYOK: prompts y contexto pueden conservarse intencionalmente en `frozen_payload` para replay. Ver [retención](../security/README.md#content-retention-is-a-separate-contract).
