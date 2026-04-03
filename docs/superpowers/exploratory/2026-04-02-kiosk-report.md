# Exploratory Test Report: Kiosk Role

**Date:** 2026-04-02
**Environment:** Production (time-control-hub.vercel.app)
**User:** integration.admin@timecontrol.test (activación terminal) + BAR001 (fichaje)
**Agent:** Claude Code + Playwright MCP
**Duration:** ~10 min

## Summary

- **Pages explored:** Terminal activation, terminal selection, main kiosk, code+PIN flow, QR scanner
- **Console errors:** 1 persistent (IndexedDB queue), 1 on invalid employee code
- **Findings:** 2 bugs, 1 UX issue

## Kiosk Flow Map

| Step | Screen | Status | Notes |
|------|--------|--------|-------|
| 1. Auth > Tab "Terminal" | Formulario activación | OK | Email admin + password + nombre dispositivo |
| 2. Selección terminal | Lista de terminales | OK | 2 terminales: "Kiosco E2E", "Kiosco Integración" |
| 3. Pantalla principal | Reloj + 2 opciones (QR/PIN) | OK | Indicador "Conectado", controles admin |
| 4. Código + PIN > Código empleado | Teclado numérico + BAR___ | OK | Prefijo fijo, 3 dígitos, botón deshabilitado |
| 5. Código + PIN > PIN | Teclado numérico + ●●●● | OK | Saludo personalizado, tipo fichaje configurable |
| 6. Confirmación fichaje | Pantalla éxito | OK | Nombre, código, hora, countdown automático |
| 7. QR Scanner | Cámara | OK (parcial) | "Iniciando cámara..." - no testable en headless |

---

## Findings

### [BUG] F1: Error IndexedDB en cola offline - `IDBKeyRange.only()` con parámetro inválido

- **Page:** `/kiosk` (todas las pantallas)
- **Observed:** Error persistente en consola: `Error getting queue size: DataError: Failed to execute 'only' on 'IDBKeyRange': The parameter is not a valid key.` en `KioskHome-Cvakxs_R.js`
- **Expected:** La cola offline debería inicializarse sin errores
- **Severity:** Medium
- **Impact:** La funcionalidad de cola offline (fichajes sin conexión) podría no funcionar correctamente. El kiosk funciona online, pero en modo offline los fichajes podrían perderse.
- **Root cause probable:** El parámetro pasado a `IDBKeyRange.only()` es undefined, null, o un tipo no válido (ej: object en vez de string/number). Revisar la inicialización de la cola de fichajes pendientes.

### [UX_ISSUE] F2: Código de empleado inexistente no muestra mensaje de error

- **Page:** `/kiosk` > Código + PIN > Nº de Empleado
- **Steps:** 1. Seleccionar "Código + PIN" 2. Introducir código 999 (inexistente) 3. Click "Siguiente"
- **Expected:** Mensaje de error visible: "Empleado no encontrado" o similar, con shake animation o toast
- **Actual:** La pantalla se queda igual, sin feedback. Solo error en consola. El usuario en el kiosk no sabe que el código no existe.
- **Severity:** High (en contexto kiosk - usuarios no técnicos)
- **Impact:** Empleados en un bar/restaurante intentando fichar no sabrán por qué no funciona. Podrían pensar que el terminal está roto.

### [BUG] F3: PIN por defecto demasiado simple (1234) permitido sin restricciones

- **Page:** `/kiosk` > PIN
- **Observed:** El PIN "1234" funciona como PIN válido para el empleado BAR001. Si este es el PIN por defecto del seed, no se obliga al empleado a cambiarlo.
- **Expected:** PINs triviales (1234, 0000, 1111, etc.) deberían ser rechazados o al menos advertidos. El empleado debería ser obligado a cambiar el PIN por defecto en su primer acceso.
- **Severity:** Low (solo afecta a entornos de test, pero indica falta de política de PINs)
- **Notes:** Verificar si el seed establece PINs aleatorios o fijos. Si fijos, asegurar que el flujo de onboarding obligue al cambio.

---

## Pages with Good Behavior

- **Activación terminal**: Formulario claro con alert informativo. Redirección automática tras activación exitosa.
- **Selección terminal**: Cards visuales con nombre y ubicación. Mensaje "Esta selección se guardará para futuras sesiones".
- **Pantalla principal**: Diseño limpio orientado a kiosk. Reloj en tiempo real. Indicador de conexión. Opciones QR y PIN claramente diferenciadas.
- **Flujo Código + PIN**: Teclado numérico grande, prefijo de empresa automático, dígitos van apareciendo, botón Siguiente deshabilitado hasta completar.
- **Pantalla PIN**: Saludo personalizado ("Hola Integration 👋"), tipo de fichaje visible y configurable, PIN enmascarado.
- **Confirmación**: Checkmark verde, nombre completo, código, hora exacta, countdown de retorno.
- **QR Scanner**: Pantalla de inicialización de cámara con instrucciones y botón cancelar.

## Responsive (375px)

- **Kiosk responsive: EXCELENTE** - Layout perfectamente adaptado. Reloj grande legible. Cards apiladas verticalmente. Ideal para tablet o smartphone como terminal de fichaje.

## Console Warnings (persistent)

2 warnings presentes en todas las páginas (no investigados).

## Data Cleanup

- El fichaje de test (ENTRADA BAR001 15:21:24) fue eliminado de la BD tras la exploración.

## Next Steps

1. **Fix F1 (IndexedDB)** - Revisar inicialización de cola offline en KioskHome
2. **Fix F2 (feedback código)** - Añadir toast/shake cuando el código no existe
3. **Verificar F3 (política PIN)** - Revisar si hay validación de PINs triviales
4. **Session S4: Asesor**
