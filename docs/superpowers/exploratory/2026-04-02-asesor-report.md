# Exploratory Test Report: Asesor Role

**Date:** 2026-04-02
**Environment:** Production (time-control-hub.vercel.app)
**User:** integration.asesor@timecontrol.test
**Agent:** Claude Code + Playwright MCP
**Duration:** ~8 min

## Summary

- **Pages explored:** 4 asesor routes tested (dashboard, time-records, employees, reports link)
- **Pages accessible:** All rendered correctly
- **Console errors:** 0
- **Findings:** 1 UX issue (minor)

## Asesor Navigation Map

| Route | Accessible? | Notes |
|-------|------------|-------|
| `/asesor` (Dashboard) | YES | Panel con métricas, selector empresa, acciones rápidas |
| `/asesor/time-records` | YES | Tabla de registros con filtros y export CSV |
| `/asesor/employees` | YES | Tabla de empleados (readonly - sin acciones) |
| `/asesor/reports` | Not explored (link in sidebar) | - |

### Cross-role access (logged in as asesor):
| Route | Result |
|-------|--------|
| `/admin/employees` | Redirected to `/asesor` (correct) |
| `/super-admin` | Redirected to `/asesor` (correct) |
| `/employee` | Not tested |

---

## Findings

### [UX_ISSUE] F1: Header del asesor trunca email en mobile (375px)

- **Page:** `/asesor` (dashboard)
- **Steps:** 1. Redimensionar viewport a 375px 2. Observar header
- **Expected:** Email completo visible o truncado con ellipsis elegante
- **Actual:** Email "integration.asesor@timeco..." truncado sin ellipsis, layout apretado entre "Panel Asesor", badge "Vista Solo Lectura" y email
- **Severity:** Low
- **Impact:** Puramente visual. El asesor sabe quién es.

---

## Pages with Good Behavior

### Dashboard Asesor (`/asesor`)
- Badge "Vista Solo Lectura" - excelente UX para dejar claro que no puede modificar datos ✓
- Selector de empresas asignadas con combobox ✓
- 4 métricas: Empleados Activos (4), Fichajes Hoy (1), Correcciones Pendientes (1), Empresas Totales (1) ✓
- Acciones rápidas: Ver Registros, Ver Informes, Ver Empleados, Ver Correcciones ✓
- Todas etiquetadas como "Solo Lectura" ✓

### Registros de Jornada (`/asesor/time-records`)
- Tabla con datos reales del fichaje de test (BAR001, Entrada, 15:21:24, PIN) ✓
- Filtros: búsqueda por empleado, rango de fechas, tipo ✓
- Botón "Exportar CSV" disponible ✓
- Sidebar reducida: solo Dashboard, Registros, Informes ✓
- 0 errores consola ✓

### Empleados (`/asesor/employees`)
- Tabla readonly - sin botones de acción en las filas ✓
- Sin botón "Nuevo Empleado" (correctamente oculto para asesor) ✓
- Búsqueda funcional ✓
- Confirma bug de duplicados (INTEMP001/BAR001, INTEMP002/BAR002) del S1

## Responsive (375px)

- **Dashboard responsive: BUENO** - Cards apiladas, selector funcional, métricas legibles. Header algo apretado pero funcional.

## Security Assessment

- **Read-only enforcement: CORRECTO** - El asesor no tiene botones de edición, creación o eliminación en ninguna vista. Las acciones están correctamente ocultas.
- **Cross-role protection: CORRECTO** - Acceso a `/admin/employees` y `/super-admin` redirige al panel asesor.

## Console

- 0 errores en todas las páginas del asesor.
- 2 warnings persistentes (no investigados).

## Next Steps

1. **Session S5: Super Admin** - Explorar panel de super administración
