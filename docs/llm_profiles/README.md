# Perfiles LLM: implementación y aceptación pendiente

**Revisión de fuentes/documentación: 2026-10-15. Estado: fundamento implementado; custodia end-to-end y aceptación operativa abiertas.** El [ledger 16](16_current_status_and_roadmap.md) es la autoridad de estado. No confundir la implementación de perfiles con una garantía de que las claves personales nunca se persisten.

Frontend y BFF implementan perfiles de sistema/personales, revisiones, selección por feature, admisión y pagador. La SPA conserva BYOK en memoria transitoria. Sin embargo, el BFF actual coloca esa clave dentro de `agt` al llamar al completion original, y el ejecutor conserva el graph authored. **F04 sigue abierto.** La factory protegida de otro módulo no acredita que este camino la use. Ver [API vigente](07_api_changes.md) y [seguridad](../security/README.md).

## Requisitos que siguen vigentes

- Root administra perfiles system y recomendaciones/defaults; cada usuario administra sus perfiles personales y selecciones autorizadas.
- Resolución por asignación presente: feature del usuario → default personal → recomendación root → default global. Una selección inválida falla; no cambia silenciosamente proveedor/pagador.
- Configuración personal persistible, clave personal transitoria separada; sin custodia BYOK durable, incluso cifrada, como requisito todavía pendiente end-to-end.
- BYOK tiene cargo de plataforma cero; conserva límites de capacidad/abuso. El proveedor puede cobrar al usuario. Media tiene cobro y autorización independientes.
- Grafos, herramientas, validaciones y límites permanecen bajo control del backend.
- La decisión del usuario del 2026-10-09 exige retirar compatibilidad antigua del refactor. Es criterio de entrega, no prueba de que cada checkout/paquete/entorno ya lo cumpla.

Writers de media/callbot no ofrecen selección personal donde el registro la deshabilita. El [registro de features](../../../../PycharmProjects/magic-worlds-api/src/services/llm_features.py) y los DTOs/rutas son el contrato instalado; las tablas propuestas del dossier original son diseño.

## Documentos y ciclo de vida

| Documento | Disposición / uso |
|---|---|
| [02 Gaps](02_gaps_and_risks.md) | Riesgos/requisitos; 16 mantiene disposición actual |
| [03 Arquitectura](03_architecture_and_approach.md) | ADR y contrato objetivo; no prueba de custodia implementada |
| [04 Catálogo](04_model_catalog_and_best_practices.md) | Requisitos/diseño y evaluación; no catálogo desplegado |
| [05 Seguridad](05_security_and_secrets.md) | Garantía requerida y canarios; garantía aún incumplida por el camino actual |
| [07 API](07_api_changes.md) | Rutas y transporte usados |
| [09 Rollout](09_migration_and_rollout.md) | Preparación por revisión/entorno y rollback |
| [10 Aceptación](10_implementation_plan_and_acceptance.md) | Entregables y criterios aún aplicables |
| [14 Runbook](14_operations_runbook.md) | Referencia operativa del transporte actual |
| [16 Ledger](16_current_status_and_roadmap.md) | Estado, riesgos y trabajo restante mantenidos |

## Evidencia y límites

Esta revisión inspeccionó fuentes de frontend/BFF y los checkouts de ejecutor/runtime, incluidos rendering BYOK, snapshot, templates y cliente. Las revisiones de referencia y los límites están en 16. No se ejecutaron proveedores, consultas de base, migraciones, configuración, despliegues ni suites de aplicación.

El copy actual de las pantallas Modelos/BYOK ([`llmProfiles.ts`](../../src/app/i18n/locales/llmProfiles.ts), `key.explanation` y `byok.body`, EN/ES) ya afirma que la clave no se guarda en nuestros servidores. Eso contradice F04 abierto; su corrección se registra como F11 en [seguridad](../security/README.md) y en LLM-R3 del [ledger 16](16_current_status_and_roadmap.md).

El contenido del usuario puede conservarse intencionalmente en prompts/payloads congelados para replay, incluido el digest del app assistant. Esa política de privacidad/retención es independiente del requisito de excluir claves; [seguridad](../security/README.md#content-retention-is-a-separate-contract) mantiene el límite. El operador puede observar una clave durante ejecución; cumplir no persistencia tampoco equivale a impedir acceso al proceso.

Estado global: [matriz](../STATUS_MATRIX.md), [gates](../FEATURE_STATUS.md) y [roadmap](../ROADMAP.md). La ejecución [Fish](../fish_audio_support/11_implementation_status.md) conserva su propio estado y no se modificó.

<details>
<summary>Established section anchors retained after reconciliation</summary>

<a id="documentos"></a>
<a id="hallazgos-históricos-que-motivaron-el-plan-2026-10-08"></a>
<a id="límites-de-la-revisión-inicial"></a>
<a id="orden-de-resolución"></a>
<a id="perfiles-llm-reporte-y-plan-de-implementación"></a>
<a id="requisitos-confirmados"></a>

The maintained source/status sections above replace the older headings.

</details>
