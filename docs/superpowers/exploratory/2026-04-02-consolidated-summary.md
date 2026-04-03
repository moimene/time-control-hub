# Exploratory Testing - Consolidated Summary

**Date:** 2026-04-02
**Environment:** Production (time-control-hub.vercel.app)
**Agent:** Claude Code + Playwright MCP
**Total Duration:** ~60 min (5 sessions)
**Phase:** A (manual exploration with AI agent)

---

## Coverage Matrix

| Session | Role | Pages | Errors Found | Findings |
|---------|------|-------|-------------|----------|
| S1 | Admin | 12 routes | 0 console errors | 2 bugs, 4 UX, 1 security, 1 a11y |
| S2 | Employee | 9 routes | 4 (HTTP 406) | 2 bugs, 1 UX |
| S3 | Kiosk | 7 screens | 1 (IndexedDB) | 2 bugs, 1 UX |
| S4 | Asesor | 4 routes | 0 | 1 UX |
| S5 | Super Admin | 5 routes | 0 | 1 bug, 1 UX |
| **Total** | **5 roles** | **37 routes/screens** | **5 unique errors** | **7 bugs, 8 UX, 1 security, 1 a11y** |

---

## All Findings by Priority

### 🔴 Critical / High

| ID | Role | Category | Description | Impact |
|----|------|----------|-------------|--------|
| S1-F1 | Admin | UX | Login sin feedback de error | Todos los usuarios afectados |
| S2-F1 | Employee | BUG | Dropdown "Tipo de ausencia" vacío | Empleados no pueden solicitar ausencias |
| S2-F2 | Employee | BUG | HTTP 406 por empleados duplicados | Cascada de errores en múltiples páginas |
| S3-F2 | Kiosk | UX | Código empleado inexistente sin feedback | Usuarios de kiosk no sabrán por qué falla |

### 🟡 Medium

| ID | Role | Category | Description | Impact |
|----|------|----------|-------------|--------|
| S1-F2 | Admin | BUG | Empleados duplicados (INTEMP/BAR prefixes) | Datos inconsistentes en toda la app |
| S1-F3 | Admin | SECURITY | Formulario acepta XSS/SQLi sin validación | Riesgo en exports PDF/email |
| S1-F4 | Admin | UX | Formulario nuevo empleado sin feedback validación email | UX pobre en creación |
| S3-F1 | Kiosk | BUG | Error IndexedDB en cola offline | Fichajes offline podrían perderse |
| S5-F1 | Super Admin | BUG | UUIDs truncados en vez de emails | Super admin no identifica usuarios |

### 🟢 Low

| ID | Role | Category | Description | Impact |
|----|------|----------|-------------|--------|
| S1-F5 | Admin | A11Y | Botones sin aria-label en tabla empleados | Accesibilidad reducida |
| S1-F6 | Admin | BUG | SetupGate inconsistente | Puede ser intencional |
| S1-F7 | Admin | UX | Tabla empleados no responsive | Overflow horizontal en mobile |
| S1-F8 | Admin | UX | Credenciales test hardcodeadas | Solo afecta developers |
| S2-F3 | Employee | UX | Notificaciones sin empty state visual | Menor |
| S3-F3 | Kiosk | BUG | PIN trivial (1234) permitido | Solo test, verificar política |
| S4-F1 | Asesor | UX | Email truncado en header mobile | Puramente visual |
| S5-F2 | Super Admin | UX | Columna "Usuario" muestra "-" | Relacionado con S5-F1 |

---

## Root Cause Analysis

### Empleados duplicados (afecta S1-F2, S2-F1, S2-F2)
**Root cause:** La tabla `employees` no tiene UNIQUE constraint en `user_id`. El seed fue ejecutado múltiples veces con prefijos distintos (INTEMP vs BAR), creando 2 registros por empleado. Esto causa:
1. HTTP 406 en queries `.single()` que esperan 1 resultado
2. Dropdown de ausencias vacío (la query falla antes de cargar tipos)
3. Datos inconsistentes visibles en tablas de admin y asesor

**Fix recomendado:**
1. `ALTER TABLE employees ADD CONSTRAINT employees_user_id_unique UNIQUE (user_id);`
2. Limpiar duplicados: `DELETE FROM employees WHERE employee_code LIKE 'INTEMP%';`
3. En el código: usar `.maybeSingle()` en vez de `.single()` como fallback

### Falta de feedback en errores (afecta S1-F1, S1-F4, S3-F2)
**Root cause:** Patrón común en formularios: el error se captura pero no se muestra al usuario. El login, nuevo empleado (email inválido), y kiosk (código inexistente) comparten el mismo problema.

**Fix recomendado:** Añadir toast de error en todos los catch blocks de formularios.

---

## Security Highlights

### ✅ Bien implementado
- **RLS (Row Level Security)**: Datos de empresas correctamente aislados
- **Cross-role protection**: Todas las rutas redirigen correctamente al panel del rol
- **time_events inmutables**: Trigger DB impide modificación/eliminación de fichajes
- **PIN hasheado**: PIN almacenado con hash + salt, no en texto plano
- **seed-v1-fixtures deshabilitada**: Edge function protegida en producción (403)
- **React XSS protection**: HTML escapado en render (aunque datos sucios en BD)

### ⚠️ A mejorar
- **Input sanitization**: Formularios aceptan payloads XSS/SQLi (stored XSS risk en exports)
- **UNIQUE constraints**: Falta constraint en `employees.user_id`
- **PIN policy**: No hay validación de PINs triviales (1234, 0000)

---

## Responsive Summary

| Role | Mobile (375px) | Rating |
|------|---------------|--------|
| Admin | Tabla con overflow horizontal | ⚠️ Malo |
| Employee | Sidebar hamburguesa, layout adaptado | ✅ Excelente |
| Kiosk | Diseño perfecto para tablet/móvil | ✅ Excelente |
| Asesor | Funcional, header apretado | ✅ Bueno |
| Super Admin | Sidebar hamburguesa, cards OK | ✅ Bueno |

---

## Pages with Best Implementation

1. **Monitor QTSP** (`/super-admin/qtsp`) - La página más completa: API health, gráficos en tiempo real, SLA, tendencias, exportación
2. **Cierre Mensual** (`/employee/closure`) - Flujo legal completo con checkbox obligatorio y diálogo de confirmación
3. **Terminal de Fichaje** (`/kiosk`) - UX excelente para kiosk: reloj, teclado numérico, confirmación visual, countdown
4. **Panel Asesor** (`/asesor`) - Badge "Solo Lectura" claro, métricas útiles, acciones correctamente limitadas

---

## Recommendations for Pilot Release

### Must Fix (bloqueantes para piloto)
1. **Limpiar empleados duplicados** y añadir UNIQUE constraint
2. **Feedback en login fallido** - toast de error visible
3. **Feedback en kiosk** - error cuando código empleado no existe

### Should Fix (importantes pero no bloqueantes)
4. **Input sanitization** en formularios (Zod regex para nombres)
5. **Dropdown de tipos de ausencia** - investigar por qué no carga (probablemente resuelto con fix #1)
6. **Emails en tabla super admin** - mostrar emails reales en vez de UUIDs

### Nice to Have
7. Tabla admin responsive en mobile
8. Aria-labels en botones de acción
9. Empty state visual en notificaciones
10. Política de PINs (rechazar triviales)

---

## Phase B Readiness

La Fase A ha cumplido su objetivo: **17 hallazgos genuinos en 5 sesiones** (vs objetivo de 3 por sesión = 15). Los hallazgos son reales, reproducibles, y varios son críticos para el piloto.

**Decisión para Phase B:** Proceder con el framework automatizado en `tests/exploratory/` después de corregir los bugs críticos del piloto. El framework puede codificar las validaciones descubiertas en esta fase como checks automáticos.

---

## Reports Generated

- `docs/superpowers/exploratory/2026-04-02-admin-report.md`
- `docs/superpowers/exploratory/2026-04-02-employee-report.md`
- `docs/superpowers/exploratory/2026-04-02-kiosk-report.md`
- `docs/superpowers/exploratory/2026-04-02-asesor-report.md`
- `docs/superpowers/exploratory/2026-04-02-superadmin-report.md`
- `docs/superpowers/exploratory/2026-04-02-consolidated-summary.md` (este archivo)
