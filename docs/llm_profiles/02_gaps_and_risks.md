# Gaps y riesgos

**Revisado 2026-10-15. Estado: riesgos y aceptación activos.** Este mapa conserva los IDs G01–G17 de la matriz original del 8 de octubre con su disposición actual; [16](16_current_status_and_roadmap.md) mantiene el trabajo restante y [seguridad](../security/README.md) la disposición de custodia.

## Brechas y mitigaciones

| ID original | Disposición actual | Trabajo / evidencia pendiente |
|---|---|---|
| G01 / G11 / G12 | Perfiles, resolución y consola propia implementados | Aceptación por feature/entorno y retiro de confusión con Agent Studio |
| G02 | **Abierto; F04 fuente-confirmado** | BYOK fuera del grafo outbound, admisión, snapshot y hashes; canario por ruta real |
| G03 / G04 | Configuración segura del perfil y proyección BFF existen; no acredita custodia del catálogo upstream | Verificar todas las lecturas/escrituras, credenciales/headers y catálogo realmente instalado |
| G05 | Tablas/rutas de perfiles personales y ownership implementados | Mantener negativos cross-user/project/workspace y root scope |
| G06 / G09 | Target y modo homogéneo por plan BFF; selección sin fallback implementados | Validar dependencia/rol real upstream y no uso oculto de secretos de plataforma; F03/F05/F08 |
| G07 | Compatibilidad/caps y registro de features implementados | Evals por workflow/modelo/adapter; unknown no acredita soporte/calidad |
| G08 | Admisión BFF separa capacidad, cargo platform y BYOK=0 | Reconciliación por intento y comportamiento del camino upstream actual; no inferirlo del helper protegido |
| G10 | **Abierto; F09/F10** | Todos los sinks, diagnósticos y configuración real de infraestructura |
| G13 / G14 | Plan/revisión congelados, recibos y retry explícito BFF existen | Perdida/recarga/terminal/replay por consumidor; no hay recuperación upstream automática en el transporte actual |
| G15 | Schema y herramientas existen, con revisiones posteriores | Cadena exacta, preflight, saldos, restore y aceptación del entorno; [09](09_migration_and_rollout.md) |
| G16 | Targets curados y transporte BFF restringido | Egress y destinos de ejecución genérica/conexiones, redirects y pruebas negativas |
| G17 | Provenance/usage BFF implementados | Calidad de datos por pagador/rol y revisión desplegada; sin secretos/prompts en métricas |

## Riesgos de producto y operación

| Riesgo | Regla vigente |
|---|---|
| Anunciar que el servidor nunca guarda BYOK | La promesa ya está publicada en el copy de UI ([`llmProfiles.ts`](../../src/app/i18n/locales/llmProfiles.ts) `key.explanation` y `byok.body`, EN/ES). Mientras F04 siga abierto debe retirarse o reducirse a la memoria de pestaña verificada; seguimiento en LLM-R3 ([16](16_current_status_and_roadmap.md)) y F11 ([seguridad](../security/README.md)) |
| Confundir configuración con liberación | Separar fuente implementada, gates locales, provisión, smoke fechado y aceptación del entorno |
| Reusar un plan después de corregir fuente | El payload congelado puede conservar el graph anterior; verificar intención/revisión y efectos del intento |
| Prometer recuperación remota automática | El transporte actual falla de forma terminal ante respuesta upstream perdida/inválida |
| Perder contexto privado de vista en retención | `frozen_payload` puede conservar prompts/digest; documentar acceso, TTL y borrado independientemente de BYOK |
| Tratar BYOK como media gratuita | Imagen, voz y música mantienen su cobro/autorización independientes |

## Condiciones de no lanzamiento

La garantía de no persistencia exige cerrar el camino real de F04 y su superficie de nodos/sinks aplicable. También requieren aceptación ownership/destinos, límites, cobro sin doble efecto, publicación/defaults evaluados, recuperación por consumidor y operación compatible con el schema instalado. Un gate encendido o una suite histórica no sustituyen esa evidencia.

## Qué queda fuera de la primera entrega

Selección personal de writers/callbot donde el registro actual la deshabilita, URLs arbitrarias de proveedor, secretos personales durables y cambios automáticos de proveedor/pagador. El [plan actualizado](10_implementation_plan_and_acceptance.md) distingue implementación y aceptación.
