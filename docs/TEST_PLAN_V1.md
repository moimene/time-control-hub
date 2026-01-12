# TEST_PLAN_V1 — Time Control Hub (Estabilización Primera Versión)

## Objetivo
Estabilizar la V1 con foco microempresa:
- 1 centro de trabajo
- 1–2 terminales tipo kiosk
- 3–20 empleados
- Cumplimiento legal mínimo + evidencias (QTSP) + auditoría
- Portal empleado ampliado (jornada + correcciones + documentación/comunicaciones)
- Admin preconfigurado (defaults cargados por super-admin; override por empresa)

## Principio clave de configuración
### Ownership de configuración
- Super Admin (plataforma):
  - Carga "defaults" de: reglas mínimas legales, plantillas sectoriales, calendarios base, tipos de ausencia base, plantillas de documentos legales.
  - Define versionado/vigencia de defaults y política de actualización.
- Empresa (Admin):
  - Puede modificar/ajustar (override) sin poder rebajar mínimos legales.
  - Debe quedar trazado: quién cambió, cuándo, versión previa, motivo.
- Asesor laboral:
  - Acceso limitado y auditado a empresas autorizadas.
  - Puede revisar, comentar, proponer, preparar ITSS; no debe poder “romper” configuración.

### Reglas de precedencia (para pruebas)
Ley → Convenio → Contrato → Excepción (solo puede mejorar mínimos, nunca empeorarlos).

---

# Entornos de prueba

## E0 — Local (dev)
- Supabase local + datos semilla.
- QTSP en modo stub/mock (respuestas deterministas).
- Emails desactivados o a sandbox.

## E1 — Staging (preproducción)
- Supabase remoto staging.
- QTSP sandbox real (si existe) o credenciales de test.
- Emails a sandbox (Resend test domain).

## E2 — Producción (solo smoke controlado)
- Sin datos reales al inicio.
- Feature flags: activar módulos progresivamente.

---

# Dataset mínimo (fixtures)
Crear 3 empresas para probar multi-tenant y defaults:

- Empresa A: "Bar Pepe" (hostelería), timezone Europe/Madrid.
- Empresa B: "Clínica Vet" (sanidad privada), timezone Europe/Madrid.
- Empresa C: "Tienda Centro" (comercio), timezone Atlantic/Canary (para probar TZ/DST).

Cada empresa:
- 4 empleados: 1 admin, 1 responsable, 2 empleados
- 1 asesor asignado a A y B, NO asignado a C
- 1 terminal kiosk activo
- Calendario anual publicado (con festivos base + local)
- Plantilla/reglas activas (default super-admin) y 1 override controlado por empresa

---

# Ciclos de Prueba (Acceptance Cycles)

## Ciclo 0 — Smoke + Build Integrity
### Objetivo
Verificar que el sistema arranca, navega y no rompe flujos básicos.

### Casos
- Login/logout.
- Acceso a rutas por rol (kiosk/admin/employee/super-admin/advisor).
- Cargar dashboards sin errores JS.
- Crear empresa (super-admin) y entrar como admin de esa empresa.

### Criterio de salida
- 0 errores bloqueantes de navegación.
- 0 pantallas en blanco.
- Tiempo de carga aceptable (<3s primera carga en staging).

---

## Ciclo 1 — Multi-tenant + Roles + RLS (P0)
### Objetivo
Eliminar errores de lógica de permisos y aislamiento: el fallo típico más crítico.

### Casos (mínimos obligatorios)
- Usuario admin de Empresa A:
  - No puede ver datos Empresa B/C.
  - CRUD empleados solo dentro de A.
- Asesor asignado a A y B:
  - Puede ver compliance/reporting solo de A y B.
  - No puede acceder a C.
- Super-admin:
  - Puede ver listado global.
  - NO puede leer datos personales sin flow de soporte autorizado (si aplica).
- Empleado:
  - Solo ve sus fichajes, sus correcciones, sus documentos/mensajes.

### Pruebas negativas (imprescindibles)
- Intentar forzar `company_id` ajeno en queries.
- Intentar abrir rutas directas por URL sin permiso.
- Cambiar `company_id` en payloads hacia edge functions (si aplica).

### Criterio de salida
- 0 fugas cross-tenant.
- 0 escalados de privilegio.
- Logs de auditoría registran accesos críticos.

---

## Ciclo 2 — Onboarding Empresa “preconfigurado” (Defaults por super-admin)
### Objetivo
Garantizar que una empresa nueva “ya nace” cumpliendo, con mínimos listos.

### Casos
- Al crear empresa:
  - Se crean settings por defecto.
  - Se asigna plantilla/reglas por sector (default).
  - Se crean tipos de ausencia base.
  - Se habilitan plantillas de documentos legales (sin publicar aún).
  - Se habilita calendario base (pendiente de publicar por admin).
- Override empresa:
  - El admin cambia un umbral permitido (sin rebajar mínimos).
  - El sistema impide guardar una configuración que rebaje mínimos.

### Criterio de salida
- 100% de empresas nuevas “operables” sin configuración manual extensa.
- Validaciones anti-“rebajar mínimos” funcionando.

---

## Ciclo 3 — Empleados + Credenciales + PIN/QR (P0)
### Objetivo
Evitar incoherencias de identidad/credenciales.

### Casos
- Alta empleado: genera código empleado, QR activo, PIN (hash+salt).
- Rotación/revocación QR.
- Reset PIN (con trazabilidad).
- Bloqueo por intentos fallidos en PIN (y desbloqueo por tiempo o admin).

### Criterio de salida
- No hay duplicados de códigos en una empresa.
- No hay posibilidad de enumeración de empleados vía mensajes de error.
- El bloqueo funciona y queda auditado.

---

## Ciclo 4 — Kiosk: fichaje QR / PIN / QR+PIN (P0)
### Objetivo
Estabilizar el núcleo: registrar entrada/salida (y pausas si activas).

### Casos
- Fichaje QR (empleado correcto).
- Fichaje PIN (número empleado + PIN).
- Fichaje QR+PIN (si política activa).
- Evento sugerido “inteligente” (entry/exit) y validación de secuencia.
- Terminal no autorizado: rechazo.

### Casos borde (altamente recomendados)
- Doble entrada seguida → inconsistencia.
- Entrada sin salida > umbral → inconsistencia.
- Fichaje con hora local desfasada: debe prevalecer hora servidor.

### Criterio de salida
- Confirmación <1s en condiciones normales.
- 0 duplicados por doble click/scan.
- Secuencias incoherentes detectadas de forma consistente.

---

## Ciclo 5 — Offline PWA + Sync + Idempotencia (P0)
### Objetivo
Evitar el “infierno” de duplicados y orden incorrecto al reconectar.

### Casos
- Fichar offline 10 eventos (QR y PIN).
- Cerrar pestaña/app y reabrir offline.
- Reconectar:
  - Sincroniza 1 vez.
  - No duplica.
  - Respeta orden lógico y crea evidencias consistentes.

### Criterio de salida
- Idempotencia garantizada (mismo evento no se registra 2 veces).
- Cola offline cifrada y limpia tras sync.
- Manejo de conflictos (si el server detecta duplicado, respuesta clara).

---

## Ciclo 6 — Correcciones + Workflow aprobación + Auditoría (P0)
### Objetivo
Corregir sin romper inmutabilidad.

### Casos
- Empleado solicita corrección (entrada/salida/pausa).
- Responsable/aprobador aprueba o rechaza con comentario.
- Registro original se mantiene; corrección genera evento/registro derivado.
- Export refleja “original + corrección” y trazabilidad.

### Criterio de salida
- Nunca se borra ni edita `time_events` original.
- Toda corrección queda auditada (quién/cuándo/motivo).

---

## Ciclo 7 — Inconsistencias + Alertas (P1)
### Objetivo
Hacer el sistema proactivo, sin ruido y respetando ventanas de silencio.

### Casos
- Se detectan inconsistencias en dashboard empleado.
- Email al empleado si está activado.
- Resumen semanal a responsables.
- Respeto de “desconexión digital” (si existe o se añade).

### Criterio de salida
- 0 spam (no duplicar emails por la misma inconsistencia).
- Audit log registra envíos.

---

## Ciclo 8 — Compliance Engine + Incidencias (P1/P0 según alcance V1)
### Objetivo
Estabilizar la lógica de reglas y su evaluación.

### Casos mínimos
- Reglas base: max horas diarias/semanales, descanso mínimo, pausa >6h, nocturnidad, horas extra YTD.
- Ventanas de evaluación:
  - post-evento
  - cierre diario
  - cierre semanal
  - cierre mensual

### Casos borde obligatorios
- Turnos que cruzan medianoche.
- Cambio horario verano/invierno.
- Festivo vs no festivo por centro.
- Tiempo parcial / horas complementarias (si aplica).

### Criterio de salida
- Misma entrada de datos → mismo resultado (determinismo).
- Resultados trazables (evidencia + recomendación).

---

## Ciclo 9 — Documentos + Aceptación + Evidencia QTSP (P1/P0 si entra en V1)
### Objetivo
Dar valor legal real a la relación empresa-empleado.

### Casos
- Admin publica documento legal (plantilla).
- Empleado recibe notificación, visualiza y acepta.
- Se genera evidencia (hash + sello tiempo QTSP) y queda accesible.
- Exportación de documento + evidencia verificable.

### Criterio de salida
- Evidencias verificables y accesibles por rol autorizado.
- No hay “documento aceptado” sin registro de evidencia.

---

## Ciclo 10 — Reporting + ITSS Package + Export probatorio (P1)
### Objetivo
Que la empresa pueda responder a inspección con un click.

### Casos
- Generar CSV/PDF por periodo y empleado.
- Generar paquete ITSS con índice + manifiesto + hashes.
- Verificación: el paquete contiene referencias de evidencias.

### Criterio de salida
- Export reproducible (mismo periodo → mismo contenido).
- Integridad: hashes correctos y consistentes.

---

## Ciclo 11 — QTSP Scheduler + Daily Roots + Monitorización (P0 para evidencia)
### Objetivo
Estabilizar el sellado diario sin bloquear la operación.

### Casos
- Generación daily_root (por empresa y fecha).
- Sellado timestamp_daily.
- Reintentos y backoff.
- Monitor health_check y alertas.

### Criterio de salida
- No se pisa daily_root entre empresas (clave compuesta correcta).
- Estados de evidencias consistentes (pending/processing/completed/failed).

---

## Ciclo 12 — Retención 4 años + Purga segura (P2)
### Objetivo
Cumplir retención y limitar riesgo RGPD.

### Casos
- Simular datos >4 años.
- Ejecutar purge.
- Confirmar que antes de purgar existe evidencia probatoria sellada (si la política lo requiere).

### Criterio de salida
- Purga no rompe reportes ni integridad de evidencias.

---

# Criterios globales de “Release Candidate V1”
- 0 bugs P0 abiertos (multi-tenant, fichaje, offline, correcciones, QTSP diario).
- Suite de regresión mínima pasada (Ciclos 1,3,4,5,6,11).
- Manual UAT microempresa completado (empresa A) con evidencia de export.
- Documentación mínima de operación (cómo crear empresa, terminal, empleados, resolver incidencias).
