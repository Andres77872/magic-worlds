# Gaps y riesgos

**Reconciliación documental 2026-10-14: matriz histórica de descubrimiento.** Los G01–G17 y sus condiciones no son un backlog actualizado: algunos tienen cierres locales posteriores en 12. No reabrirlos ni declararlos cerrados sin comprobar la evidencia. El backlog WIP/TBD vigente y los límites de despliegue están en [16](16_current_status_and_roadmap.md).

Este registro distingue hechos encontrados, riesgos inferidos de esos hechos y cambios propuestos. La evidencia está en [findings](01_findings.md). Prioridades: **P0** bloquea BYOK; **P1** bloquea la funcionalidad completa; **P2** mejora posterior.

## Brechas y mitigaciones

| ID | Prioridad | Brecha / riesgo | Consecuencia | Cambio requerido | Prueba de cierre |
|---|---|---|---|---|---|
| G01 | P1 | Modelos y settings dispersos en env y grafos | No hay default heredable ni configuración personal consistente | Resolver común de perfiles y revisión de todos los consumidores | Matriz de resolución por feature y comparación con configuración legacy |
| G02 | P0 | Clave hidratada dentro del grafo recibido por API LLM | El snapshot exacto puede guardar la clave | Credencial fuera del grafo y fuera del input durable; inyección después de admisión/snapshot | Clave canaria ausente en todos los registros y artefactos |
| G03 | P0 | `provider_key` JSON en catálogo | Se podría guardar BYOK como proveedor global y dar acceso operativo a la clave | Prohibir BYOK en CRUD de catálogo; conexiones de plataforma con aliases env/gestor | Rechazo de campos secretos en perfiles y ausencia de filas BYOK con claves |
| G04 | P0 | Headers de proveedor salen sin filtro de secretos | Posible exposición de Authorization u otros headers sensibles | Allowlist de headers públicos; separar headers secretos de metadata | Respuestas de catálogo no contienen canarias ni headers de autenticación |
| G05 | P0 | No existe ownership personal en las tablas de agentes | IDOR, publicación o lectura cruzada si se reutilizan como perfiles | Tablas de perfiles privadas y consultas con proyecto+owner | Usuario B y root sin endpoint personal no pueden leer/usar perfil A |
| G06 | P1 | Alias de modelo enlaza proveedor y conexión actuales | Un perfil BYOK podría acabar usando una clave global por resolver el alias | Descriptor de modelo separado de modo de credencial | Resolver BYOK nunca llama al getter de credencial global |
| G07 | P1 | Capabilities son solo metadata; validación comprueba ID | Modelos inválidos para JSON, tools o streaming llegan a ejecución | Contratos por feature/rol, adapter y evaluaciones | Incompatibilidad detectada antes de una llamada externa |
| G08 | P0 | Cobro/reserva mezclados; caminos legacy en API LLM | BYOK puede descontar créditos de app o fallar por saldo cero | Payer validado por servidor; política BYOK=0 en ambos servicios | Saldo cero permite BYOK dentro de cuotas; saldo no cambia |
| G09 | P0 | Helpers podrían conservar credenciales de plataforma | Una ejecución personal cobra al operador o cambia pagador sin mostrarlo | Plan completo de roles/llamadas; BYOK homogéneo inicial | Narrativa, metadata, preflight y retries usan mismo modo |
| G10 | P0 | Logs, APM, errores de validación y debug pueden capturar cuerpo | Persistencia fuera de MySQL aunque el perfil no tenga clave | Exclusión por ruta/campo y DTOs de persistencia por allowlist | Auditoría canaria incluye 422, excepciones, reverse proxy y tracing |
| G11 | P1 | Default frontend usa placeholder distinto al compilador | Opción de servidor inválida o comportamiento divergente | DTO estructurado de herencia; adaptación de Studio | Seleccionar default no envía un placeholder obsoleto |
| G12 | P1 | Publicar custom agent no cambia rutas productivas | Confusión entre administrar agentes y administrar perfiles | UI y APIs independientes; binding del perfil aplicado a built-ins | Perfil novel cambia proveedor/settings sin sustituir workflow |
| G13 | P1 | Retries y reconnect sin identidad de perfil/revisión | Solicitud duplicada o cambio de perfil durante el mismo request | Plan congelado e idempotencia independiente de clave | Retry tras publicación/rechazo conserva identidad y revisión |
| G14 | P1 | Jobs reanudables necesitan credenciales disponibles | Intento de guardar claves en cola para soportar reinicio | BYOK interactivo inicial; recuperación requiere reingreso de clave | Restart no restaura clave ni usa platform como fallback |
| G15 | P1 | Bootstrap valida esquema exacto | Despliegue falla o anuncia revisión incompleta | Migración versionada, schema, contracts y seed coordinados | Fresh DB y upgrade convergen al mismo esquema |
| G16 | P1 | Catálogo no define destinos personales seguros | SSRF, redirección o exfiltración si se aceptan URLs arbitrarias | Targets allowlisted de API LLM, validación de egress | Bloqueo de URLs privadas, credenciales en URL y redirects peligrosos |
| G17 | P2 | Sin telemetry de perfil efectivo | Difícil evaluar calidad/costo y rollback | IDs de perfil/revisión/rol/payer en usage | Trazabilidad sin prompts ni claves en métricas |

## Riesgos de producto y operación

| Riesgo | Regla de diseño |
|---|---|
| Usuario cree que BYOK evita todo acceso del operador | Texto preciso: no se almacena; se procesa temporalmente en nuestros servidores |
| Se pierde la clave al recargar | Estado local explícito y reingreso; perfil permanece en DB |
| Default personal no sirve para todas las features | Mostrar compatibilidad antes de asignar; error de selección incompatible, sin fallback silencioso |
| Root archiva un perfil usado por usuarios | Mostrar impacto y bloquear archivo mientras tenga asignaciones activas; migración explícita |
| Modelo desaparece o cambia capacidades | Estado lifecycle, reevaluación, sustitución publicada y trazable |
| Límite de contexto o salida demasiado alto | Caps de servidor por feature/rol y límites reales del adapter/modelo |
| BYOK gratuito aumenta carga y abuso | Rate limits, body limits, concurrencia, timeouts y cupos de solicitudes sin débito de créditos |
| Un intento fallido sí se factura en proveedor | Contabilizar intentos y advertir al reintentar; no prometer refund del proveedor |
| BYOK texto usado para lanzar media cobrada | Mostrar que imagen/música/TTS mantiene política y confirmación existente separadas |
| Caché cruza usuarios o proyectos | Keys con subject/proyecto/versiones de política; nunca cachear secret o disponibilidad personal globalmente |

## Condiciones de no lanzamiento

No habilitar BYOK mientras G02, G03, G04, G05, G08, G09, G10 y G16 sigan abiertas. Una pantalla funcional no prueba ausencia de persistencia ni cobro correcto.

La ruta legacy que inyecta claves en grafos no es un fallback aceptable para BYOK. Antes de declarar cerrado G02 hay que validar también snapshots históricos, debug y las bibliotecas usadas por la versión desplegada. Si se demuestra persistencia previa de claves de plataforma, debe revisarse acceso, rotación y retención de esos registros mediante un procedimiento operativo; esta revisión no ejecutó esa limpieza.

## Qué queda fuera de la primera entrega

No se incluye custodia cifrada de claves personales, sincronización de claves entre dispositivos, ejecución directa navegador→proveedor, endpoints arbitrarios del usuario, perfiles personales públicos, cadenas de proveedores múltiples por perfil BYOK ni jobs personales durables que se reanuden sin intervención. Cada ampliación cambia el modelo de seguridad y necesita su propia decisión.
