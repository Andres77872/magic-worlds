# Cliente web: root y usuario

**Reconciliación documental 2026-10-14: diseño/contratos del dossier original.** El código de perfiles existe y varios entregables se cerraron localmente después. Las propuestas y criterios de este archivo no acreditan rollout; usar [16](16_current_status_and_roadmap.md) para implementación actual, WIP operativo y TBD, y 12 para historia de pruebas.

Este documento especifica pantallas y comportamiento, sin implementar componentes. Se basa en la SPA actual, sus contexts y el router manual. Reutilizar Reverie: [ui-components](/home/andres/WebstormProjects/magic-worlds/.agents/skills/ui-components/SKILL.md) y [ui-design-system](/home/andres/WebstormProjects/magic-worlds/.agents/skills/ui-design-system/SKILL.md).

## Root: consola «Perfiles LLM»

Agregar una sección root junto a Agentes/Membership. La consola de Agentes conserva prompts/workflows; esta consola administra proveedor, modelos, settings y recomendaciones. No renombrar la página de agentes como si ya administrara perfiles.

### Catálogo de perfiles system

- Listado con nombre, modelo principal, proveedor, estado draft/publicado/archivado, revisión, compatibilidad por feature y marca de default global.
- Filtros por proveedor/feature/estado y paginación; no cargar todo el catálogo en un selector gigante.
- Crear/duplicar perfil system, abrir draft, comparar cambios, validar, probar, publicar, rollback y archivar.
- Mostrar cuántas asignaciones afecta una publicación o archivo, sin enumerar configuraciones privadas ajenas.
- Diferenciar cambios guardados en draft de revisión usada por nuevas solicitudes.

### Editor root

Campos: nombre/descripción, target aprobado, conexión platform provisionada, modelo primary, settings soportados y overrides de metadata/preflight. El selector muestra límites/capacidades y por qué una combinación no está disponible.

No hay input para API key en esta pantalla. Se muestra «Conexión de plataforma configurada» o un estado de indisponibilidad seguro. La instalación/rotación del secret se realiza fuera de la web. No exponer nombres completos de secrets del gestor ni headers de autenticación.

Validación estática y test de inferencia son acciones distintas. Test tiene costo/usage y cupo propios; informar que usa credenciales de plataforma. Publicar muestra impacto y exige ausencia de errores de compatibilidad. Conflicto de edición no sobrescribe draft de otra sesión.

### Defaults de aplicación

Una vista de política muestra:

| Feature | Selección root | Perfil efectivo | Estado |
|---|---|---|---|
| Novela | Heredar default global o perfil system | Nombre/modelo/revisión | Compatible/error |
| RP aventura/personaje/grupo | Selección independiente o acción masiva | Nombre/modelo/revisión | Compatible/error |
| Cards/asistentes/lorebook | Mismo patrón | Nombre/modelo/revisión | Compatible/error |

«Heredar» elimina la recomendación explícita, no copia el default global en la fila. Guardar política atómicamente. Advertir/bloquear default global incompatible con features activas que carecen de recomendación propia.

### Modelos, conexiones y salud

Root puede revisar catálogo/lifecycle, solicitar sync de metadata y ver targets/conexiones autorizadas. Modelos retirados muestran perfiles afectados y ruta para publicar reemplazo. Métricas incluyen tokens, latencia, fallos y payer; no mostrar claves, prompts privados ni provider errors raw.

## Usuario: «Modelos y perfiles»

Ubicación propuesta: sección de ajustes accesible desde Profile, con página propia si el contenido lo requiere. Listar «Perfiles de la aplicación» y «Mis perfiles» con propiedad y modo de cobro claros.

### Seleccionar perfiles system

El usuario puede usar un perfil system permitido como default personal o para una feature. Es de solo lectura: ver nombre, modelos, compatibilidad y política de créditos platform. Para editar configuración debe crear un perfil personal que exige su propia clave; la copia no comparte la conexión del sistema.

### Crear un perfil personal

1. Elegir target aprobado y modelo del catálogo disponible.
2. Configurar nombre y parámetros soportados; campos avanzados solo cuando aplican.
3. Mostrar compatibilidad por feature antes de guardar.
4. Guardar configuración sin clave.
5. Probar opcionalmente con clave temporal o usar directamente al ejecutar.

No ofrecer URL arbitraria, env ref, custom graph, headers de autenticación ni herramienta propia en el formulario. «Perfil creado» no significa que el servidor conserve una clave ni que la cuenta del proveedor tenga acceso al modelo.

### Defaults y overrides personales

El panel distingue:

- **Mi default:** «Usar recomendaciones de la aplicación» o un perfil propio/system.
- **Por feature:** «Heredar» o un perfil propio/system compatible.
- **Perfil efectivo:** nombre, origen de herencia, modelo y modo de cobro calculado por API.

Un preset RP asigna las tres features de conversación, mostrando cada cambio antes de guardarlo. Un override novel no modifica RP. Un cambio al default personal mantiene overrides explícitos. Restablecer elimina selección; no elimina el perfil.

El default personal solo aplica a features que la API marque configurables por el usuario. En la primera entrega los escritores de media y callbot conservan selección root hasta habilitar su integración personal; debe explicarse en la pantalla, sin anunciar BYOK para todo el pipeline.

### Entrada y estado de claves

La API devuelve `credential_mode`; el cliente calcula `credential_available` consultando su almacén volátil. No enviar `has_key` al servidor como estado persistente ni recibir «key guardada» desde profile DTO.

Textos propuestos:

- «Añadir clave para esta sesión».
- «La clave se procesa temporalmente para llamar al proveedor y no se almacena en nuestros servidores. Al recargar tendrás que introducirla otra vez».
- «Sin cargo de plataforma para BYOK. Tu proveedor puede facturar el uso».
- «Olvidar clave de esta sesión».

Usar Input con contraseña, label accesible y revelación voluntaria. Al cerrar el diálogo limpiar su valor; si el usuario confirmó uso en sesión, conservar solo la copia del almacén volátil. Evitar analytics/session replay de campos, eventos y red con secretos. No registrar la clave en form errors, breadcrumbs, console ni feedback.

El slot se identifica por subject+proyecto+target aprobado. No deducir compatibilidad solo del nombre del vendor: dos targets pueden apuntar a destinos distintos. Cambio de target, logout o cambio de cuenta invalida el slot correspondiente. No sincronizarlo por BroadcastChannel/storage entre pestañas.

## Almacén volátil y contexts

Propuesta: un servicio/context de sesión autenticada separado del estado de perfiles. Los hooks consumen configuración y presencia de credencial, mientras el request builder obtiene el valor solo al despachar una ejecución. Evitar que la key entre a DataProvider, Navigation, BackgroundTasks, objetos de perfil o caches serializables.

Si se agrega `LlmSessionProvider`, ubicarlo dentro de Auth y conservar el orden relativo actual ApiStatus→Auth→Navigation→Data→BackgroundTasks→AudioPlaylist. No introducir Redux/Zustand ni una dependencia de estado nueva para esta funcionalidad.

Limpieza en logout, auth terminal expired, cambio de user/project, olvido manual y unmount de sesión. Un refresh exitoso del mismo subject puede conservar memoria. Un logout en otra pestaña debe invalidar la sesión local según el mecanismo de auth existente, sin comunicar secrets.

Los handlers de red mantienen la credencial solo durante el intento autorizado. No almacenar el JSON serializado con key en un historial de requests. `ChatSocket.pendingChat` hoy conserva un frame serializado para conexión/refresh: adaptar ese diseño con cancelación/limpieza y materialización tardía de credencial, para no retenerla indefinidamente en una cola de reconnect.

No prometer que React DevTools o una extensión maliciosa no puedan leer memoria. Ocultar el input reduce exposición visual, no da aislamiento criptográfico.

## Cambios de transporte y DTO

| Archivo/área actual | Cambio propuesto |
|---|---|
| `src/shared/types/llmProfile.types.ts` (nuevo) | DTOs seguros de profile/revision/catalog/preferences/effective plan y códigos de error |
| `src/infrastructure/api/index.ts` | Métodos root/usuario, bloque llm en POST/stream, extracción de error seguro y preservación de request ID |
| `src/infrastructure/api/chatSocket.ts` | Bloque llm en chat, materialización temporal de clave, metadata efectiva, manejo de errores y reconnect |
| `src/features/llmProfiles/` (nuevo) | Settings personales, hooks de catálogo/perfiles/resolución, selectors y key dialog |
| `src/features/admin/llmProfiles/` (nuevo) | Consola system, editor/publish/default policy/audit |
| `src/features/profile/` | Entrada de navegación y resumen de perfil efectivo |
| `src/app/router/AppRouter.tsx`, PageType y mapping de hashes | Páginas lazy y gates root/autenticación con router existente |
| Sidebar / navegación admin | Enlaces por rol; visibilidad UI no sustituye autorización backend |
| `src/app/i18n/locales/en.ts`, `es.ts` | Copy, labels, errors y descripciones de herencia/costo |
| `src/shared/types/agent.types.ts`, AdminAgentsPage | Corregir placeholder legacy y aclarar prueba de agente vs perfil |

Los tipos de perfil no tienen campo key. El tipo transitorio `LlmExecutionCredentials` pertenece al builder de ejecución y se mantiene separado de los DTOs de datos. No exportar secret desde un hook general de perfil ni meterlo en `TextGenerationOptions` si esas opciones se almacenan/debuggean completas.

## Integración por feature

- Creadores: resumen del perfil efectivo junto al disparador AI, selector opcional e ingreso de key previo a POST.
- Novela: perfil en el panel de asistente, no en cada toolbar; conservar selección y candidato si falla la credencial. Accept/stash/discard no necesitan key.
- RP: configuración en controles del chat; generar con request estable; metadata/preflight toman mismo plan. Nunca enviar key como mensaje ni guardarla en transcript.
- Asistentes: perfil efectivo por turno; no incluir la clave al crear/listar conversación. Mantener revisión de patch.
- Lorebook extraction: pedir credencial al iniciar extracción, límites claros y sin secretos en archivos/resources.
- Media y voz: indicar alcance de perfil de texto y cobros separados; no asumir que seleccionar BYOK autoriza una key fal/ElevenLabs.

MembershipSection y UsageSection muestran cupo/uso BYOK separado de los créditos diarios/PAYG y del uso platform. La consola de membership/usage root filtra payer y no presenta el costo estimado de la cuenta personal como costo de la aplicación. Los saldos actuales conservan su significado.

## Estados y recuperación

| Estado | Comportamiento |
|---|---|
| Perfil heredado sin key necesaria | Acción normal y perfil efectivo visible |
| BYOK sin key en esta pestaña | Abrir diálogo antes de ejecutar |
| Recarga/cambio de dispositivo | Recuperar perfil/preferencias desde API, pedir clave de nuevo |
| Clave rechazada | Error local de proveedor; conservar contenido; permitir corrección |
| Perfil/revisión cambió | Releer resolución y pedir nuevo despacho; no reenviar la clave a un target distinto |
| Límite app/proveedor | Mensaje y tiempo/cupo cuando disponible; preservar contenido |
| Auth app expiró | Auth flow existente; limpiar clave al terminar la sesión |
| Stream cortado | Consultar/reconciliar request antes de reejecutar; misma idempotencia |
| Operación ya terminada | Recuperar resultado sin una nueva llamada ni clave |
| Restart de job BYOK | Pedir clave para nueva ejecución autorizada; nunca fallback platform |

Para ejecutar BYOK, la UI debe enviar la revisión esperada obtenida de la resolución; el backend la valida antes de forward de key. No basta una preview antigua ni el perfil seleccionado en un estado desactualizado.

### Comportamiento implementado por evento

| Evento | Clave BYOK (`credentialSession`, memoria) | Target congelado por request (`llmIntents`, memoria, sin clave) | Request sin terminar |
|---|---|---|---|
| Recarga de la pestaña | Se pierde | Se pierde | Extracción: el recibo local reanuda con su request ID y target. Chat: el historial del servidor muestra el turno, y un turno interrumpido se reconcilia por request ID al reintentar desde esta pestaña. Las demás superficies inician una solicitud nueva |
| Token expirado (mismo usuario) | Se borra: el ámbito exige sesión `authenticated` | Se conserva para el mismo dueño | Tras el refresh, el reintento reenvía el target congelado sin clave; si el servidor pide clave, se solicita solo para el mismo perfil y revisión |
| Logout, cambio de cuenta o de proyecto, otra pestaña cambia el token | Se borra | Se borra | Nada se reenvía; el siguiente intento es una solicitud nueva de la cuenta actual |
| Restart o lease vencido en el servidor | No aplica: el servidor nunca la persistió | Se conserva en la pestaña | El reintento con el mismo request ID recupera la ejecución congelada sin pagarla dos veces. Si es BYOK y el servidor pide la clave, se solicita de nuevo; nunca cambia a platform. Un fallo terminal confirmado ofrece un intento nuevo enlazado (`retry_of_execution_id`) |

## Componentes y calidad UI

Reusar PageHeader, Card, Field/Input/Select, Badge, Modal/Drawer, Button y ConfirmDialog de los barrels actuales. Usar tokens de theme.css para todos los valores visuales. Ember para acciones/selección y arcane para presencia de AI, según Reverie. No añadir CSS ad hoc ni glows por página.

Labels, navegación por teclado, focus al abrir/cerrar dialogs, estados anunciados y errores asociados al campo. Selectores de perfil muestran propiedad y compatibilidad sin depender solo de color. ES/EN completos.

Crear stories de estados representativos con fixtures ficticias y sin claves con apariencia real. Si se modifican stories, leer ui-storybook y ejecutar typecheck de stories. React 19: cuidar el phantom submit al intercambiar botones de footer. Ver [plan de pruebas](10_implementation_plan_and_acceptance.md).
