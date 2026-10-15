# Perfiles LLM: reporte y plan de implementación

Fecha de revisión inicial: **2026-10-08**. **Revisión de estado: 2026-10-14 — WIP operativo, código implementado localmente.** Ver [estado actual y roadmap](16_current_status_and_roadmap.md) y [gates de producto](../FEATURE_STATUS.md). [12](12_implementation_status.md) conserva el historial de implementación y pruebas fechadas; no es un estado de despliegue actualizado automáticamente.

**Decisión del usuario, 2026-10-09:** eliminar toda compatibilidad legacy del refactor LLM. La entrega final debe usar exclusivamente perfiles, catálogo seguro, bindings y admisión nuevos; retirar aliases antiguos, hydrators, env de configuración de modelos, lectura de credenciales en DB y fallbacks. Esta decisión reemplaza las propuestas iniciales de conservar consumidores o contratos antiguos. Se preparan los cambios de datos y despliegue; no se aplican automáticamente a la instancia `.90`.

El objetivo es guardar en base de datos los perfiles LLM y sus asignaciones por feature. Existen dos ámbitos: perfiles de sistema creados por root y perfiles personales creados por cada usuario. Las claves personales BYOK se introducen en el navegador y se transportan de forma transitoria para ejecutar una solicitud; **no se guardan en el servidor**. Los únicos secretos persistentes del servidor son los de la plataforma, en variables de entorno del backend o en un gestor de secretos.

## Requisitos confirmados

- Root administra un catálogo de perfiles de sistema y un default global, con recomendaciones específicas por feature.
- Cada usuario puede seleccionar perfiles de sistema o crear perfiles personales, establecer su default y sobrescribirlo para novela, RP, asistentes u otras features.
- Una feature sin selección explícita hereda su perfil; no se copian defaults a todas las filas.
- BYOK no tiene cargo de plataforma por ahora. El proveedor puede cobrar a la cuenta del usuario. Se conservan límites de concurrencia y de abuso.
- Se guarda la configuración del perfil personal, pero ninguna API key personal, ni siquiera cifrada en el servidor.
- La propuesta inicial conserva la clave únicamente en memoria del cliente. No incorpora localStorage, sessionStorage, IndexedDB ni cookies para BYOK.
- No hay fallback automático de una clave personal a una credencial de plataforma.
- Los grafos, herramientas, validaciones de salida y límites máximos siguen bajo control del backend.

## Orden de resolución

```text
Selección del usuario para la feature
  → default personal del usuario
  → recomendación root para la feature
  → default global root
```

Este orden se aplica a las features configurables por el usuario cuando una asignación **no existe**. Una selección existente pero incompatible, archivada, no autorizada o sin clave debe devolver un error accionable. No se omite silenciosamente para elegir otro pagador o proveedor. Las features todavía no habilitadas para selección personal, como media writers y callbot en la primera fase, resuelven únicamente recomendaciones/default root; la API y la UI declaran ese alcance.

Ejemplo: root publica `General`; el usuario elige `Mi novela` para novela y `Mi RP` para conversación. Cards y lorebooks heredan `General` mientras el usuario no configure un default personal. Si luego establece `Mi general` como default personal, las demás features pasan a heredarlo.

## Documentos

| Documento | Contenido |
|---|---|
| [01_findings.md](01_findings.md) | Estado real de frontend, BFF, catálogo, runtime, base y cobro; evidencia local |
| [02_gaps_and_risks.md](02_gaps_and_risks.md) | Brechas, riesgos, prioridades y bloqueos de lanzamiento |
| [03_architecture_and_approach.md](03_architecture_and_approach.md) | ADR, ámbitos, resolución, roles internos y flujos de ejecución |
| [04_model_catalog_and_best_practices.md](04_model_catalog_and_best_practices.md) | Catálogo, capacidades, selección, evaluaciones y mantenimiento |
| [05_security_and_secrets.md](05_security_and_secrets.md) | Modelo de amenazas y ciclo de vida de claves de usuario y plataforma |
| [06_database_changes.md](06_database_changes.md) | Tablas, integridad, índices, transacciones y cambios en las dos bases |
| [07_api_changes.md](07_api_changes.md) | APIs root/usuario, transporte BYOK, streaming, WS, errores e idempotencia |
| [08_web_client_root_and_user.md](08_web_client_root_and_user.md) | Pantallas, permisos, memoria de credenciales y cambios por feature |
| [09_migration_and_rollout.md](09_migration_and_rollout.md) | Migración desde env y catálogo actual, despliegue y recuperación |
| [10_implementation_plan_and_acceptance.md](10_implementation_plan_and_acceptance.md) | Trabajo por repositorio, dependencias, pruebas y definición de terminado |
| [11_sources_and_open_decisions.md](11_sources_and_open_decisions.md) | Fuentes, alcance de verificación y decisiones pendientes |
| [12_implementation_status.md](12_implementation_status.md) | Avance local del refactor, pruebas, capacidades desplegadas y alcance pendiente |
| [13_historical_provenance.md](13_historical_provenance.md) | Decisión sobre recibos históricos, idempotencia y capacidad sin procedencia verificable |
| [14_operations_runbook.md](14_operations_runbook.md) | Gates de activación, provisión, rotación platform, asignaciones, BYOK tras recarga, media, retención y corte |
| [15_openrouter_defaults.md](15_openrouter_defaults.md) | Preparación offline y elección fechada de defaults; requiere evaluaciones/provisión |
| [16_current_status_and_roadmap.md](16_current_status_and_roadmap.md) | Estado de fuentes/configuración al 2026-10-14, WIP operativo y aceptación pendiente |

## Hallazgos históricos que motivaron el plan (2026-10-08)

El inventario siguiente describe el baseline previo al refactor. Las variables, hydrators y riesgos del camino anterior no deben interpretarse como el routing de perfiles actual. La factory protegida y el ejecutor genérico tienen límites distintos; consultar 16 y el audit antes de afirmar cierre de seguridad.

1. La configuración actual está repartida entre `CARD_LLM_*`, `ADVENTURE_CHAT_LLM_*`, asistentes y extracción. Novela reutiliza la configuración de cards.
2. Agent Studio administra agentes, no perfiles por usuario. Publicar un custom agent no cambia los grafos productivos de las features.
3. `api.magic_llm` ya tiene catálogo de modelos, capacidades, precios y grupos. Su tabla de proveedores admite credenciales JSON; no debe convertirse en un almacén BYOK.
4. El BFF hidrata claves en el grafo enviado. El runtime conserva el grafo authored y puede persistirlo como snapshot exacto. Es un riesgo concreto que debe corregirse antes de introducir BYOK.
5. Cobro, cuotas y uso deben distinguir `platform` y `user_byok` en ambos backends; no basta con ocultar el costo en la UI.

## Límites de la revisión inicial

Estos límites corresponden al reporte inicial del 2026-10-08: se revisaron archivos de esquema y persistencia, rutas, DTOs, grafos y bibliotecas locales, sin consultar una DB ni ejecutar proveedores. La implementación posterior tiene pruebas con MySQL efímero y mocks, descritas en [12](12_implementation_status.md). No se han inspeccionado claves reales, contenido de bases/backups/logs desplegados ni infraestructura de observabilidad. Las rutas/tablas propuestas se consideran disponibles solo cuando lo prueba el estado actual.

La promesa de seguridad es ausencia de persistencia intencional de claves personales, con controles para demostrarla. El backend ve la clave temporalmente al llamar al proveedor. Impedir incluso el acceso del operador requeriría un ejecutor controlado por el usuario y otra arquitectura.
