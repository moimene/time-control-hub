# Exploratory Test Report: Employee Role

**Date:** 2026-04-02
**Environment:** Production (time-control-hub.vercel.app)
**User:** integration.employee@timecontrol.test (Bar El Rincón)
**Agent:** Claude Code + Playwright MCP
**Duration:** ~15 min

## Summary

- **Pages explored:** 9/9 employee routes tested
- **Pages accessible:** 9/9 rendered content
- **Console errors:** 4 (HTTP 406 on employee lookup - duplicate employee records)
- **Findings:** 2 bugs, 1 UX issue

## Page Navigation Map

| Route | Accessible? | Notes |
|-------|------------|-------|
| `/employee` (Mis Fichajes) | YES | Empty state correcto, 0 errores |
| `/employee/absences` | YES | Calendario + saldo + formulario nueva solicitud |
| `/employee/closure` | YES | Cierre mensual completo con firma legal |
| `/employee/legal-documents` | YES | Normativa y cumplimiento, **4 errores consola** |
| `/employee/communications` | YES | Layout split recibidos/enviados, **4 errores consola** |
| `/employee/corrections` | YES | Formulario corrección con validación |
| `/employee/requests` | YES | Historial con tabs (correcciones/ausencias) |
| `/employee/notifications` | YES | Centro de notificaciones, empty state |
| `/employee/settings` | YES | Cambiar PIN + código QR |

### Cross-role access (logged in as employee):
| Route | Result |
|-------|--------|
| `/admin` | Redirected to `/employee` (correct) |
| `/super-admin` | Redirected to `/employee` (correct) |

---

## Findings

### [BUG] F1: Dropdown "Tipo de ausencia" no carga opciones en formulario de nueva solicitud

- **Page:** `/employee/absences` > Nueva Solicitud
- **Steps:** 1. Click "Nueva Solicitud" 2. Click en el combobox "Tipo de ausencia"
- **Expected:** Lista de tipos de ausencia (Vacaciones, Matrimonio, Fallecimiento, etc.) - hay 10+ registros en la tabla `absence_types`
- **Actual:** El dropdown se abre pero el listbox está vacío. No se muestran opciones.
- **Severity:** High
- **Impact:** El empleado no puede solicitar ninguna ausencia. Funcionalidad completamente bloqueada.
- **Root cause probable:** Posible problema de RLS policy o de la query que filtra `absence_types` por `company_id`. Los tipos existen en BD (`company_id = 503702bc-...`) pero no se cargan en el frontend.

### [BUG] F2: HTTP 406 en query de employee - empleados duplicados causan error en múltiples páginas

- **Page:** `/employee/legal-documents`, `/employee/communications` (y potencialmente otras)
- **Steps:** 1. Navegar a cualquier página que consulte datos del empleado
- **Observed:** Error 406 en `employees?select=id,company_id,first_name,last_name&user_id=eq.{id}`. PostgREST devuelve 406 (Not Acceptable) cuando una query con `Accept: application/vnd.pgrst.object+json` (`.single()`) retorna múltiples filas.
- **Expected:** Una sola fila de empleado por `user_id`
- **Actual:** 2 filas: `INTEMP001` y `BAR001` para el mismo `user_id` (mismo problema que F2 del reporte admin)
- **Severity:** High
- **Impact:** Datos de empleado no se cargan correctamente. Afecta documentos legales, comunicaciones, y probablemente ausencias (F1).
- **Root cause:** Seed ejecutado múltiples veces con prefijos distintos (INTEMP vs BAR). La app no tiene UNIQUE constraint en `employees(user_id)`.
- **Remediation:**
  1. Añadir UNIQUE constraint en `employees.user_id`
  2. En la query, usar `.maybeSingle()` o manejar el caso de múltiples registros
  3. Limpiar duplicados de la BD

### [UX_ISSUE] F3: Página de notificaciones sin empty state visual

- **Page:** `/employee/notifications`
- **Steps:** Navegar a notificaciones sin tener ninguna
- **Expected:** Icono ilustrativo + mensaje claro tipo "No tienes notificaciones" (como en Mis Fichajes que tiene un reloj)
- **Actual:** Solo muestra el heading "Centro de Notificaciones" con descripción. No hay indicador visual de que está vacío.
- **Severity:** Low
- **Impact:** El usuario puede pensar que la página no cargó correctamente.

---

## Pages with Good Behavior

- `/employee` (Mis Fichajes) - Empty state con icono de reloj y mensaje claro
- `/employee/closure` - Página muy completa: selector de mes, métricas (4 cards), resumen, firma digital con checkbox legal obligatorio y diálogo de confirmación
- `/employee/corrections` - Formulario con validación: toast de error "Por favor completa todos los campos" al enviar vacío
- `/employee/requests` - Tabs funcionales, counters en cards, empty state correcto
- `/employee/settings` - PIN con 3 campos (actual/nuevo/confirmar) + toggle mostrar + código QR con empty state claro

## Responsive (375px)

- **Portal empleado responsive: EXCELENTE** - Sidebar colapsada en menú hamburguesa, layout adaptado, todos los elementos visibles y funcionales. Mucho mejor que el panel admin.

## Console Warnings (persistent, non-blocking)

2 warnings presentes en todas las páginas (no investigados).

## Cross-Role Security

- `/admin` → redirige a `/employee` ✓
- `/super-admin` → redirige a `/employee` ✓
- Permisos correctamente enforceados.

## Next Steps

1. **Fix F2 (employee duplicados)** - Prioridad CRÍTICA. Causa cascada de errores (F1 probablemente también). Añadir UNIQUE constraint + limpiar datos.
2. **Investigar F1 (tipos de ausencia)** - Podría resolverse automáticamente al fix F2 (si la query de employee falla antes de cargar absence_types).
3. **Session S3: Kiosk** - Terminal de fichaje
