# Catálogo de modelos y best practices

**Lifecycle: diseño/requisitos y decisiones conservados. Revisado 2026-10-15.** Este archivo define el objetivo, no un inventario de lo ya instalado. El [ledger 16](16_current_status_and_roadmap.md), la [API actual 07](07_api_changes.md) y el [registro F01–F11](../security/README.md) tienen precedencia. La custodia end-to-end sigue abierta.

## Separar identidad, conexión y política

Reutilizar el catálogo de `api.magic_llm` como fuente de verdad; el BFF mantiene una proyección segura o caché, no otro catálogo administrado a mano. Añadir la separación entre:

1. **Vendor:** organización que desarrolla/provee modelos.
2. **Provider target:** adapter, protocolo y destino aprobado, sin secrets.
3. **Model descriptor:** ID real del proveedor, identidad estable de catálogo, lifecycle, límites, parámetros y capacidades.
4. **Platform connection:** proyecto, target y alias interno de credencial de la app.
5. **Profile revision:** modelos/settings seleccionados para una feature o default.

El perfil referencia exclusivamente un descriptor estable de modelo y un target. Se retira el alias `@id_founder/model` junto con sus lectores y DTOs de compatibilidad. El descriptor nuevo no tiene FK ni enlace a identidades de catálogo retiradas.

La identidad del target debe fijar su destino/adapter de forma inmutable o versionada. Cambiar una URL requiere un target/revisión nueva y reevaluación de bindings; no enviar una clave ya introducida para un destino a otro por editar metadata con el mismo ID.

## Contrato del descriptor propuesto

| Campo | Uso |
|---|---|
| `catalog_model_key`, `catalog_revision` | Identidad independiente de conexión y versión de metadata |
| `provider_target_key`, `provider_model_id` | Adapter y nombre enviado al proveedor |
| `display_name`, vendor, tags | Selección legible; no hardcodear nombres comerciales en todas las pantallas |
| `status`, `deprecated_at`, `retirement_at` | Lifecycle; distinguir desconocido, deprecado, retirado y bloqueado |
| `context_window`, `max_output_tokens` | Presupuesto de entrada/salida |
| `capabilities` | Tools, streaming, JSON/schema, imágenes, etc., con detalle de implementación |
| `supported_parameters` | Parámetros, rango, exclusiones y traducción de tokens/temperature/endpoint |
| `compatible_endpoints` | Chat completions/Responses u otro protocolo soportado por el adapter |
| `pricing_revision`, precios con unidad y moneda | Estimar costo por rol e intento; independiente de cargo app |
| `source`, `last_checked_at`, `confidence` | Procedencia y frescura de datos |
| `feature_compatibility` | Resultado derivado de contratos y pruebas, con reason codes |

No duplicar capacidades/precios completos en cada perfil. La ejecución sí conserva el snapshot de información necesario para explicar sus límites/costo y la revisión de catálogo usada.

## Descubrimiento y actualización

Los endpoints `/models` no deben tratarse como una especificación universal de capacidades ni de precio. Cada proveedor expone información diferente; completar con documentación oficial, adapter y evaluaciones del workflow. Referencias: [OpenAI Models API](https://developers.openai.com/api/reference/resources/models/methods/list), [Anthropic Models API](https://platform.claude.com/docs/en/api/models).

Propuesta de mantenimiento:

- Root importa/revisa metadata con jobs de catálogo que usan credenciales de plataforma, sin inferencia por defecto.
- Guardar procedencia y fecha; reportar cambios de lifecycle/límites y perfiles afectados.
- Un sync actualiza metadata; no cambia el modelo seleccionado ni publica perfiles automáticamente.
- Un modelo nuevo queda disponible para evaluación antes de recomendarlo en producción.
- Un modelo retirado deja de aceptar nuevas ejecuciones y devuelve motivo; root publica reemplazo explícito.
- Mantener revisión conocida durante indisponibilidad breve del catálogo según TTL de política; nunca reactivar un modelo bloqueado conocido por usar una caché vieja.

Para BYOK inicial, el usuario elige targets permitidos y modelos del catálogo curado. La disponibilidad real de su cuenta se verifica transitoriamente al probar/ejecutar. No se publica una lista de modelos de esa cuenta como catálogo global. Soportar model IDs privados no catalogados queda para una ampliación con límites y procedencia definidos.

## Validación de compatibilidad

El contrato nuevo exige capacidades, credential_modes y evaluación de feature antes de ejecutar. Se retira la política antigua que trataba las capacidades solo como metadata de presentación. Los consumidores deben usar los descriptores y gates nuevos.

Una combinación feature+rol+modelo+adapter debe satisfacer:

- Forma de salida y schema/tools del grafo.
- Modo streaming solicitado y traducción de eventos.
- Contexto y salida dentro de los límites admitidos.
- Parámetros soportados, incluyendo modelos que rechazan temperature o usan otro campo de salida.
- Identidad de target y credencial compatibles.
- Herramientas/reintentos dentro del presupuesto de llamadas.
- Latencia y calidad suficientes para el uso, evaluadas sobre ejemplos del proyecto.

Estado recomendado: `verified`, `unsupported`, `unverified`, con explicación. No sustituir `unknown` por `true`. La primera entrega publica perfiles para features críticas solo con combinaciones verificadas; BYOK puede necesitar igualmente comprobar acceso de cuenta. Una lista de capacidades declara posibilidad, no garantiza calidad.

## Evaluación por feature

| Feature | Casos de evaluación |
|---|---|
| Cards | Schema, extras rechazados, campos obligatorios, coherencia y longitud |
| Card/lorebook assistant | Tools correctas, patch válido, cambios no autorizados, respuesta sin patch |
| Novela | Continuidad con cards, voz, selección/offsets, Markdown y candidato sin aplicación automática |
| RP | Personajes, límites de contexto, lorebook activation, respuesta progresiva y metadata parseable |
| Extracción | Fidelidad a fuente, schema, inventar datos, contenido adversarial |
| Writers de media | Formato por modelo musical/visual y límites del proveedor de media |
| Todos | Cancelación, 429, timeouts, provider error, presupuesto e idempotencia |

Usar conjuntos de casos versionados, resultados repetidos cuando importa la variación y revisión humana de calidad literaria. No promover solo por un benchmark general. La guía de [evaluaciones de OpenAI](https://developers.openai.com/api/docs/guides/evaluation-best-practices) respalda la evaluación ligada a tareas; aquí se propone implementarla con los tests/fixtures del proyecto, sin depender de un servicio concreto de evaluación.

## Versiones y despliegue de configuración

Separar draft, revisión inmutable y puntero publicado. Las ejecuciones fijan revisión; publicación/rollback mueve el puntero para futuras solicitudes. El patrón también aparece en [Langfuse, versiones y labels](https://langfuse.com/docs/prompt-management/data-model); no es una propuesta de migrar prompts a esa herramienta.

Los perfiles personales generan una revisión al guardar una edición validada. Un test opcional usa la clave de la sesión y registra solo estado/fecha/códigos seguros asociados a esa revisión. Guardar un perfil no requiere guardar o comprobar permanentemente su clave.

No validar claves con una generación costosa sin explicarlo. Diferenciar un check de autenticación/listado, cuando exista, de una prueba de inferencia que el proveedor puede facturar. Ambas tienen rate limits y resultados sanitizados.

## Consistencia y costos

Mantener una política única de reintentos y fallbacks por ejecución, con máximo de intentos, backoff y respeto de Retry-After. Para la primera entrega BYOK, no hay cambio automático de modelo/proveedor; se permite retry del mismo target dentro del presupuesto. Tampoco usar claves personales para llamadas de otro usuario.

Separar en telemetry:

- Uso real por llamada/rol e intento.
- Estimación de factura del proveedor, cuando exista precio conocido.
- Cargo app: cero para BYOK; política vigente para platform.
- Payer y fuente de credencial validados por servidor.
- Costo de media y otros servicios independientes.

No poner precio cero al descriptor de modelo para representar BYOK gratuito: el proveedor sigue pudiendo cobrar y la estimación debe seguir visible. No llamar gratis al conjunto imagen+música+TTS porque el escritor de texto use BYOK.

## Alcance de estas recomendaciones

No se seleccionan nombres comerciales de modelos ni precios definitivos en este reporte. Esos datos cambian y deben verificarse en el catálogo y con evaluaciones al implementar. Los contratos, defaults y límites propuestos pertenecen a Magic Worlds; las fuentes externas se usan como apoyo de prácticas generales, no como prueba del comportamiento del código local.
