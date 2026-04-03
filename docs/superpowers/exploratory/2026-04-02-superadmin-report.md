# Exploratory Test Report: Super Admin Role

**Date:** 2026-04-02
**Environment:** Production (time-control-hub.vercel.app)
**User:** integration.superadmin@timecontrol.test
**Agent:** Claude Code + Playwright MCP
**Duration:** ~8 min

## Summary

- **Pages explored:** 5 super-admin routes tested
- **Pages accessible:** 5/5 rendered correctly
- **Console errors:** 0
- **Findings:** 1 bug, 1 UX issue

## Super Admin Navigation Map

| Route | Accessible? | Notes |
|-------|------------|-------|
| `/super-admin` (Dashboard Global) | YES | Métricas globales, distribución roles, empresas recientes, diagnóstico plantillas |
| `/super-admin/companies` | YES | Tabla empresas con provisioning, configuración |
| `/super-admin/users` | YES | Tabla usuarios con reset password, roles |
| `/super-admin/activity` | YES | Log de actividad (tabla grande) |
| `/super-admin/qtsp` | YES | Monitor QTSP completo con gráficos, SLA, health checks |

### Cross-role access (logged in as super_admin):
| Route | Result |
|-------|--------|
| `/employee` | Redirected to `/super-admin` (correct) |
| `/admin` | Accessible (expected - super admin can access admin panel via "Panel Admin Normal" link) |

---

## Findings

### [BUG] F1: Tabla de usuarios muestra UUIDs truncados en vez de emails reales

- **Page:** `/super-admin/users`
- **Observed:** La columna "Email" muestra hashes UUID truncados (ej: "af3aa9da...", "267cd6d9...", "4d074640...", "a0f25df8...", "1918e16a...") para 5 de 6 usuarios. Solo "integration.employee@timecontrol.test" muestra el email real.
- **Expected:** Todos los emails deberían mostrarse completos
- **Severity:** Medium
- **Impact:** El super admin no puede identificar a los usuarios por email, lo que dificulta la gestión (ej: resetear contraseña del usuario correcto).
- **Root cause probable:** La query obtiene `id` en vez de `email` de `auth.users`, o hay un fallback que muestra el UUID cuando el email no está disponible por permisos RLS.

### [UX_ISSUE] F2: Columna "Usuario" muestra "-" para la mayoría de usuarios

- **Page:** `/super-admin/users`
- **Observed:** La columna "Usuario" muestra "-" para 5 de 6 usuarios. Solo "Integration Employee" muestra nombre.
- **Expected:** Nombre del usuario (first_name + last_name de la tabla employees, o email como fallback)
- **Severity:** Low
- **Impact:** Relacionado con F1. Si el usuario no tiene registro en `employees`, no hay nombre que mostrar. Pero al menos debería mostrar el email como fallback.

---

## Pages with Good Behavior

### Dashboard Global (`/super-admin`)
- 4 métricas globales: Empresas (2), Empleados (5, todos activos), Fichajes 7d (1), Evidencias QTSP (2) ✓
- Distribución de roles con conteo: 1 Super Admin, 2 Admins, 1 Responsable, 1 Empleado ✓
- Empresas recientes con CIF, ciudad, empleados activos, fichajes 7d ✓
- Diagnóstico de plantillas: "Todas las plantillas están correctamente configuradas" ✓
- 0 errores consola ✓

### Gestión de Empresas (`/super-admin/companies`)
- 2 botones de creación: "Provisionar Empresa + Admin" y "Solo Empresa" ✓
- Tabla completa: Empresa, CIF, Admin(s), Empleados, Fichajes, Creada, Acciones ✓
- Búsqueda por nombre, CIF o ciudad ✓
- Acciones por empresa: Configurar + eliminar ✓

### Monitor QTSP Global (`/super-admin/qtsp`)
- Estado API en tiempo real: "Operativo" con Auth OK, API OK ✓
- Gráfico de latencia en tiempo real (15 min, muestreo 30s) ✓
- Umbrales de latencia: Saludable (<200ms), Degradado (200-500ms), Crítico (>500ms) ✓
- Estado por empresa con tabla: Case File, Grupos, Completadas, Pendientes, Fallidas ✓
- 5 tabs: Tendencias (gráficos 12 semanas + 30 días), Métricas SLA, Tests, Escalado, Exportar ✓
- Toggle de emails + Toast notifications ✓
- Health checks automáticos (cron) con tabla de historial ✓
- Operaciones recientes (últimas 50) con detalles técnicos ✓
- **Esta es la página más completa y profesional de toda la aplicación**

### Actividad (`/super-admin/activity`)
- Log de actividad con muchos registros (tabla grande) ✓
- 0 errores consola ✓

## Responsive (375px)

- **Super Admin responsive: BUENO** - Sidebar en hamburguesa, cards apiladas, contenido legible.

## Security Assessment

- **Cross-role protection: CORRECTO** - `/employee` redirige a `/super-admin`
- **Admin access: CORRECTO** - Super admin puede acceder al panel admin normal via link directo (intencionado)
- **Datos sensibles visibles**: Emails y UUIDs de usuarios visibles (apropiado para super admin)
- **time_events inmutables**: Trigger DB impide DELETE/UPDATE de fichajes (verificado en S3) ✓

## Console

- 0 errores en todas las páginas del super admin.
- 2 warnings persistentes (no investigados).

## Next Steps

1. **Fix F1 (emails truncados)** - Revisar query de usuarios para mostrar emails completos
2. **Generar resumen consolidado** de las 5 sesiones
