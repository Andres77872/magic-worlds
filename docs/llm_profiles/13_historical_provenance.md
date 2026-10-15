# ADR: procedencia del historial de cards y uso LLM

**Reconciliación documental 2026-10-14: diseño/contratos del dossier original.** El código de perfiles existe y varios entregables se cerraron localmente después. Las propuestas y criterios de este archivo no acreditan rollout; usar [16](16_current_status_and_roadmap.md) para implementación actual, WIP operativo y TBD, y 12 para historia de pruebas.

Estado: implementación local calificada; release pendiente. Fecha: 2026-10-09.

## Contexto

El historial, la idempotencia y las cuotas anteriores no registraban un plan de perfiles ni un pagador verificable. El corte debe conservar resultados y capacidad consumida, eliminar sus tablas y evitar ejecutar o cobrar otra vez una solicitud histórica. No se conservarán lectores de compatibilidad, configuración de proveedores ni hashes de credenciales.

## Decisión

Convertir esos registros una sola vez a recibos de operación con procedencia `unattributed`, sin execution ID ni plan ejecutable. Los resultados deben validar el contrato actual de cards. Los recibos nuevos apuntan al plan y al resultado originales; no duplican el contenido. Una solicitud histórica se rechaza al intentar admitirla nuevamente.

La identidad de operación conserva el SHA-256 de la clave de idempotencia, separado del ID de correlación HTTP. Ambos contratos calculan ese digest sobre el texto exacto de la clave. Es identidad de solicitud, no una huella de credenciales. Participa en la huella revisada de la migración y en el bloqueo de nuevas admisiones; no requiere un lector de las tablas retiradas.

La capacidad diaria usa una tabla común, separada por proyecto, usuario, grupo, operación y pagador. Los contadores históricos permanecen `unattributed`; no se convierten en consumos platform/BYOK ni en cargos. La migración conserva saldos y ledgers. Los registros en vuelo requieren reconciliación previa; no se marcan terminados ni se reembolsan automáticamente.

El operador revisa los conteos y huellas de los campos públicos que serán convertidos. La fuente se verifica antes del DDL y de nuevo bajo locks. La conversión se confirma antes del único DROP de las seis tablas retiradas. Si la conversión ya está confirmada, el siguiente intento exige igualdad exacta y no sobrescribe los destinos.

## Alternativas y consecuencias

- Asignar perfiles o pagadores actuales al pasado fabricaría procedencia y podría alterar cobros; se descarta.
- Descartar el historial perdería resultados e idempotencia; se descarta.
- Mantener las tablas y lectores anteriores incumpliría el corte solicitado; se descarta.

Los recibos históricos se pueden consultar por su propietario, pero no continuar. La falta de un resultado válido exige reconciliación antes del corte. La tabla de capacidad conserva una categoría explícita de procedencia desconocida, sin fallback de ejecución o facturación.

## Acciones de release

Calificar migración poblada, interrupción/reanudación, aislamiento y separación por pagador con MySQL efímero. Revisar y provisionar perfiles/defaults mediante el contrato nuevo antes de habilitar ejecución. La validación local no autoriza ni implica una migración de `.90`.


## Uso histórico del ejecutor

La misma decisión se aplica a los facts físicos del API. El histórico tiene intento/run/proveedor/modelo observado, tokens y correcciones, pero no un plan de perfiles ni pagador verificable. La conversión única conserva sus identidades, contadores y fechas, verifica el owner existente y los publica como `provenance=unattributed`, `payer_mode=unattributed`, `cost_state=unknown`. No deduce perfiles/proyectos ni reasigna el pagador.

El destino es el ledger actual `tb_usage_fact`. CHECKs condicionales exigen atribución completa a cada nueva ejecución y todos los campos privados/precios NULL al histórico; no hay ejecución ni cobro de compatibilidad. Se eliminan el nombre `model_alias` y las dos vistas anteriores. La fuente de 25 columnas solo se describe en el artefacto de conversión, fuera del fresh y runtime.

Costo/moneda/quote, raw usage, reasoning y request ID del proveedor anteriores se descartan tras acknowledgement explícito y no entran en huellas/reviews. Saldos y ledgers monetarios permanecen intactos. Las llamadas sin owner se incluyen únicamente en agregaciones root. La admisión rechaza el esquema parcial antes de persistir un snapshot ejecutable. Interrupción/reanudación y uso mixto histórico/nativo están calificados con MySQL efímero y proveedor mock; no implica aplicar una migración desplegada.
