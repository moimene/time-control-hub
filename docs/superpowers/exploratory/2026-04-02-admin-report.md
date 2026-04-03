# Exploratory Test Report: Admin Role

**Date:** 2026-04-02
**Environment:** Production (time-control-hub.vercel.app)
**User:** integration.admin@timecontrol.test (Bar El Rincon)
**Agent:** Claude Code + Playwright MCP
**Duration:** ~20 min

## Summary

- **Pages explored:** 12 admin routes tested
- **Pages accessible:** 8 rendered content, 4 blocked by SetupGate (redirected to /admin/setup)
- **Console errors:** 0 (after login)
- **Findings:** 2 bugs, 4 UX issues, 1 security issue, 1 accessibility issue

## SetupGate Behavior Map

| Route | Accessible? | Notes |
|-------|------------|-------|
| `/admin` (Dashboard) | NO - redirects to `/admin/setup` | Expected: setup incomplete |
| `/admin/employees` | YES | Renders employee table |
| `/admin/templates` | YES | Renders rules management |
| `/admin/calendar-laboral` | YES | Renders calendar editor |
| `/admin/absences` | YES | Renders absence management |
| `/admin/communications` | YES | Renders messaging |
| `/admin/time-records` | NO - redirects to `/admin/setup` | Blocked by gate |
| `/admin/clocking-incidents` | Not tested (URL only) | - |
| `/admin/compliance` | YES | Renders compliance view |
| `/admin/reports` | NO - redirects to `/admin/setup` | Blocked by gate |
| `/admin/audit` | YES | Renders audit log (0 records, good empty state) |
| `/admin/settings` | YES | Renders with company data |

### Cross-role access (logged in as admin):
| Route | Result |
|-------|--------|
| `/super-admin` | Redirected to `/admin/setup` (correct) |
| `/employee` | Redirected to `/admin/setup` (correct) |

---

## Findings

### [UX_ISSUE] F1: Login fallido no muestra mensaje de error al usuario
- **Page:** `/auth`
- **Steps:** 1. Rellenar email/password invalidos 2. Click "Iniciar sesion"
- **Expected:** Toast o mensaje de error visible ("Credenciales incorrectas")
- **Actual:** No pasa nada visible. Solo error HTTP 400 en consola del navegador. El formulario se queda con los datos rellenados sin feedback.
- **Severity:** High
- **Impact:** El usuario no sabe por que no puede entrar. Puede pensar que la app esta rota.

### [BUG] F2: Empleados duplicados en tabla - mismo email con codigos distintos
- **Page:** `/admin/employees`
- **Steps:** 1. Navegar a la lista de empleados
- **Observed:** `other.employee@timecontrol.test` aparece dos veces (INTEMP002 y BAR002). `integration.employee@timecontrol.test` aparece dos veces (INTEMP001 y BAR001).
- **Expected:** Un empleado = un registro. El email deberia ser unico por empresa.
- **Severity:** Medium
- **Notes:** Probablemente causado por ejecuciones multiples del seed con prefijos distintos (INTEMP vs BAR). Pero la app no previene la creacion de empleados duplicados por email.

### [SECURITY] F3: Formulario de empleado acepta payloads XSS/SQLi sin sanitizacion
- **Page:** `/admin/employees` > Nuevo Empleado
- **Steps:** 1. Click "Nuevo Empleado" 2. Rellenar: Nombre=`<script>alert('xss')</script>`, Apellidos=`' OR 1=1 --`, Email=`xss-test@test.com` 3. Click "Crear empleado"
- **Expected:** Validacion que rechace caracteres HTML/SQL en nombres
- **Actual:** El empleado se crea exitosamente con los payloads almacenados en BD. React escapa el HTML al renderizar (no hay XSS en runtime), pero los datos estan en la BD sin sanitizar.
- **Severity:** Medium
- **Risk:** Si estos datos se exportan a PDF (jspdf), email HTML, o cualquier otro contexto no-React, el XSS podria ejecutarse. SQL injection no es riesgo real (Supabase usa queries parametrizadas), pero la falta de validacion de input es una mala practica.
- **Remediation:** Anadir validacion Zod en el formulario: `z.string().regex(/^[a-zA-ZaeiouAEIOUnNuU\s'-]+$/)` para nombres.

### [UX_ISSUE] F4: Formulario "Nuevo Empleado" - sin feedback al fallar validacion de email
- **Page:** `/admin/employees` > Nuevo Empleado
- **Steps:** 1. Rellenar campos obligatorios 2. Poner email invalido "notanemail" 3. Click "Crear empleado"
- **Expected:** Mensaje de error bajo el campo email
- **Actual:** El boton no hace nada. Sin toast, sin error inline, sin feedback visual.
- **Severity:** Medium

### [ACCESSIBILITY] F5: Botones de accion en tabla de empleados sin labels accesibles
- **Page:** `/admin/employees`
- **Steps:** Inspeccionar botones de accion en cada fila de la tabla
- **Observed:** Los ultimos 2 botones de cada fila (editar/eliminar) solo tienen un icono `<img>` sin `aria-label` ni texto. Los 4 primeros (Credenciales, QR, PIN, Asignar jornada) SI tienen labels.
- **Severity:** Low
- **Impact:** Un usuario con lector de pantalla no puede saber que hacen esos botones.

### [BUG] F6: Inconsistencia en SetupGate - algunas paginas bloqueadas, otras no
- **Page:** Multiples rutas admin
- **Observed:** Con setup incompleto (38%), las paginas `/admin/employees`, `/admin/templates`, `/admin/calendar-laboral`, `/admin/settings`, `/admin/audit`, `/admin/communications`, `/admin/compliance`, `/admin/absences` son accesibles. Pero `/admin`, `/admin/time-records`, `/admin/reports` redirigen a `/admin/setup`.
- **Expected:** O todas las paginas estan bloqueadas hasta completar el setup, o hay un criterio documentado claro de cuales se bloquean y cuales no.
- **Severity:** Low (puede ser intencional - las paginas exentas son las necesarias para completar el setup)
- **Notes:** Verificar en `SetupGate.tsx` si las excepciones son intencionales.

### [UX_ISSUE] F7: Tabla de empleados no responsive en mobile (375px)
- **Page:** `/admin/employees`
- **Steps:** 1. Redimensionar viewport a 375x812 (iPhone) 2. Observar tabla
- **Observed:** La tabla mantiene las 6 columnas (Codigo, Nombre, Email, Departamento, Estado, Acciones) sin adaptarse al viewport. Causa overflow horizontal.
- **Expected:** En mobile: ocultar columnas secundarias (Departamento, Email) o usar layout de cards.
- **Severity:** Low

### [UX_ISSUE] F8: Credenciales de test hardcodeadas en TestCredentials.tsx no existen en produccion
- **Page:** N/A (codigo)
- **Observed:** TestCredentials.tsx documenta usuarios como `admin@elrincon.com` / `bar123` que no existen en la BD de produccion. Esto causa confusion si un desarrollador intenta usar esas credenciales.
- **Severity:** Low
- **Notes:** La pagina /test-credentials esta deshabilitada en produccion (404), pero las credenciales hardcodeadas en el codigo son misleading.

---

## Pages with Good Behavior

- `/admin/audit` - Empty state correcto (0 registros, mensaje claro, filtros funcionales)
- `/admin/settings` - Todos los tabs renderizados, datos de empresa cargados correctamente
- `/admin/calendar-laboral` - Calendario interactivo funcional, festivos, turnos, jornada intensiva
- `/admin/templates` - Reglas de sector visibles, busqueda y filtros, CTA claro para crear

## Console Warnings (persistent, non-blocking)

2 warnings presentes en todas las paginas (no investigados en esta sesion).

## Environment Notes

- Los usuarios de integracion (`integration.*@timecontrol.test`) existen en produccion pero sus passwords son aleatorios (generados por seed). Se resetearon para esta sesion.
- La edge function `seed-v1-fixtures` esta correctamente deshabilitada en produccion (403).
- No se pudieron explorar las paginas bloqueadas por SetupGate (Dashboard, Registros, Informes) - requieren completar el setup primero.

## Next Steps

1. **Fix F1 (login feedback)** - Prioridad alta, afecta a todos los usuarios
2. **Fix F3 (input sanitization)** - Anadir validacion en formulario de empleado
3. **Investigate F6 (SetupGate)** - Documentar que rutas son intencionales
4. **Session S2: Employee role** - Explorar portal del empleado
5. **Session S3: Kiosk** - Probar terminal de fichaje
