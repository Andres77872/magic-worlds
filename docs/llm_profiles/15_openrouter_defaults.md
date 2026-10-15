# Defaults iniciales en OpenRouter

**Reconciliación documental 2026-10-14: elección/preparación fechada del 2026-10-10.** IDs, capacidades, precios y caché aquí son el snapshot de aquella preparación, no datos del catálogo desplegado ni precios verificados nuevamente. Generar JSON offline no publica ni evalúa perfiles. Activación y aceptación siguen WIP según [16](16_current_status_and_roadmap.md).

Elección del usuario (2026-10-10): OpenRouter, Opus para `primary`, Sonnet para `metadata` y `preflight`, caché de prompt activado.

| Configuración | Valor |
| --- | --- |
| Target | `openrouter-claude-20261010` |
| URL | `https://openrouter.ai/api/v1` |
| Modelo primary | `anthropic/claude-opus-5.5` |
| Modelo metadata/preflight | `anthropic/claude-sonnet-5.5` |
| Custodia platform | `OPENROUTER_API_KEY`, alias `openrouter-platform` |
| Endpoint | `chat_completions` |
| Caché | `cache_control: {"type":"ephemeral"}`, TTL 5 minutos |

IDs, contexto de 1.000.000 tokens, salida máxima de 128.000 y parámetros comprobados en el [catálogo público de OpenRouter](https://openrouter.ai/api/v1/models). No se configuran temperature/top_p para estos modelos. Se usa reasoning_effort medium.

La API LLM añade el caché al construir clientes para modelos `anthropic/*` del target exacto OpenRouter. Los grafos no pueden reemplazarlo. El SDK conserva `prompt_tokens_details.cached_tokens` y normaliza `cache_write_tokens` a `cached_tokens_write`, tanto en streaming como sin streaming. Los contadores proceden de la respuesta, sin consultas extra de generación. [Contrato de usage](https://openrouter.ai/docs/cookbook/administration/usage-accounting).

La primera llamada puede escribir un prefijo; las siguientes pueden reutilizarlo mientras coincida y no expire. La activación no garantiza un hit en prompts cortos o cambiantes. El caché automático limita el upstream a Anthropic según la [documentación de OpenRouter](https://openrouter.ai/docs/guides/best-practices/prompt-caching). La cotización preparada usa las tarifas de escritura de 5 minutos: Opus input/output/read/write = 4/20/0,20/5 USD por millón; Sonnet = 2/10/0,10/2,50. Se conserva la revisión de precio en cada plan.

## Preparación offline

Desde api.magic_llm, usando el hash público real del proyecto y un directorio nuevo:

```bash
python -B -m scripts.prepare_openrouter_defaults --project-hash '<project_hash>' --output-dir '<directorio_nuevo>'
```

El script genera nueve JSON sin valores de claves: registro de target, conexión, referencia de custodia, propuesta de asignaciones y cinco drafts (`general`, `novel`, `chat_adventure`, `chat_character`, `chat_group`). General define los tres roles para las demás features; novela solo primary. Preflight tiene timeout de 30 segundos.

Los drafts cumplen los DTOs actuales del BFF. `assignments.json` identifica drafts por nombre; después de crearlos/publicarlos hay que usar los UUID devueltos por root para configurar la política. No es un body de preferencias listo para enviar.

Las capacidades documentadas llevan provenance reviewed y **no** inventan evaluaciones de las features: `verified_features` y `evaluations` están vacíos. Antes de publicar/asignar los defaults, registrar evidencia real de las features, provisionar la conexión, proporcionar la clave en custodia y completar el corte/despliegue del [runbook](14_operations_runbook.md). El generador no conecta a una DB, no llama al proveedor ni publica perfiles. Esta preparación no acredita activación en `.90`.
