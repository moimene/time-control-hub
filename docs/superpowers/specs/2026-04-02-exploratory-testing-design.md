# Exploratory Testing AI-Driven - Design Spec

**Date:** 2026-04-02
**Status:** Draft
**Goal:** Establecer un ciclo de pruebas exploratorias exhaustivas simulando frontend con agentes AI, ejecutado contra produccion, cubriendo todos los roles.

## Context

La aplicacion Time Control Hub esta en fase final de desarrollo con tests unitarios (5), integracion (14 ciclos), y E2E (8+ Playwright) ejecutandose. Sin embargo, falta testing exploratorio - un agente AI que navegue la app como un usuario real, descubra bugs, edge cases y problemas de UX que los tests escritos no cubren.

Se evaluo `millionco/expect` pero se descarto porque esta orientado a regression testing (analiza diffs de codigo), no a exploracion libre.

## Approach: Two-Phase

### Phase A: Claude Code + Playwright MCP (Inmediato)

Usar Claude Code como agente explorador con el Playwright MCP ya conectado. Cero dependencias nuevas.

**Flujo:**
1. Abrir Playwright via MCP, navegar a produccion
2. Login con credenciales del rol (de `.env.integration`)
3. Recorrer paginas del rol, ejecutando checklist de validaciones
4. Generar reporte Markdown con hallazgos clasificados

### Phase B: Framework Custom con AI SDK (Posterior)

Construir un mini-framework reproducible en `tests/exploratory/` que usa AI SDK + Playwright programaticamente. Ejecutable en CI.

Solo se construye tras validar que la Fase A produce resultados utiles.

## Exploration Sessions (5 roles)

| Session | Role | Login | Key Pages |
|---------|------|-------|-----------|
| S1 | admin | `/login` | Dashboard, empleados, registros, plantillas, calendario, comunicaciones, incidencias, configuracion |
| S2 | employee | `/login` | Dashboard, mis registros, correcciones, ausencias, documentos, cierre mensual, notificaciones |
| S3 | kiosk | `/kiosk` | Terminal de fichaje (QR + PIN), offline mode |
| S4 | asesor | `/login` | Vista multi-empresa, compliance, reporting |
| S5 | super_admin | `/login` | Gestion global, QTSP health, configuracion sistema, actividad |

## Validation Checklist (per page)

1. **Renderizado**: Carga sin errores de consola JS, sin peticiones 404/500
2. **Formularios**: Datos validos → exito; edge cases (vacio, 500+ chars, `<script>alert(1)</script>`, `' OR 1=1 --`) → validacion correcta
3. **Permisos**: Intentar navegar a rutas de otros roles → redirect o 403
4. **Estados vacios**: Pagina sin datos → muestra empty state, no error
5. **Acciones destructivas**: Borrar/desactivar → dialogo de confirmacion
6. **Responsive**: Viewport 375px → layout no roto
7. **Errores de red**: Comportamiento degradado, no pantalla blanca

## Finding Classification

| Category | Description |
|----------|-------------|
| `BUG` | Funcionalidad rota, error no manejado |
| `UX_ISSUE` | Funciona pero confuso, lento, o mal disenado |
| `SECURITY` | Permiso no enforceado, datos expuestos, XSS/injection |
| `PERFORMANCE` | Carga lenta (>3s), memoria excesiva |
| `ACCESSIBILITY` | Falta de labels, contraste, navegacion por teclado |

## Report Format

```markdown
# Exploratory Test Report: {Role}
Date: YYYY-MM-DD | Environment: production | Duration: ~Xmin

## Summary
- Pages explored: X/Y
- Findings: N bugs, N UX issues, N security, N a11y

## Findings

### [{CATEGORY}] Short description
- **Page:** /path
- **Steps:** 1. ... 2. ... 3. ...
- **Expected:** ...
- **Actual:** ...
- **Severity:** Critical | High | Medium | Low
```

Reports saved to: `docs/superpowers/exploratory/YYYY-MM-DD-{role}-report.md`

## Phase B Structure (future)

```
tests/exploratory/
  runner.ts          # Orchestrator: launches Playwright, iterates roles
  explorer.ts        # LLM logic: given a snapshot, decides action
  reporter.ts        # Generates markdown findings
  roles.config.ts    # Credentials and pages per role
  findings.schema.ts # Zod schema for structured findings
```

- Uses AI SDK with AI Gateway for LLM decisions
- Playwright navigates and captures accessible snapshots
- LLM receives: snapshot + role context + action history
- Decides: navigate, click, fill, or report finding
- Run with `npm run test:explore`

## Credentials

Uses existing `.env.integration` variables:
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- `EMPLOYEE_EMAIL` / `EMPLOYEE_PASSWORD`
- `KIOSK_TERMINAL_ID` / `KIOSK_PIN`
- `ASESOR_EMAIL` / `ASESOR_PASSWORD`
- `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`

## Success Criteria

- Phase A: At least 3 genuine findings per role session that existing tests didn't catch
- Phase B: Framework runs unattended, produces consistent reports, executable in CI

## Decision: millionco/expect

**Descartado.** Orientado a regression testing (analiza code diffs, genera tests especificos). No hace exploracion libre. Nuestros 14 integration tests + 8 E2E ya cubren esa necesidad de regression.
