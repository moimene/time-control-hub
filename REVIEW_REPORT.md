# Informe de Revisión de Código - Time Control Hub

## 1. Resumen Ejecutivo
El código base representa una aplicación completa y funcional para el control horario con características avanzadas como integración QTSP, modo offline (PWA) y gestión de cumplimiento. La arquitectura general es sólida, utilizando Supabase para backend/base de datos y React para el frontend.

Sin embargo, existen **deudas técnicas significativas** relacionadas principalmente con la seguridad de tipos (TypeScript) y la consistencia en el manejo de errores, especialmente en las funciones críticas de servidor (Edge Functions).

**Estado para Producción:** ⚠️ **Precaución**
Se recomienda resolver los problemas de tipado y estandarizar el manejo de errores antes de un despliegue masivo en producción real, especialmente para las funciones que interactúan con servicios legales (QTSP).

---

## 2. Hallazgos Principales

### 2.1 Calidad del Código y TypeScript
*   **Uso excesivo de `any`:** Se detectaron **279 problemas de linting**, la gran mayoría (264 errores) son del tipo `@typescript-eslint/no-explicit-any`. Esto es especialmente crítico en `supabase/functions/qtsp-notarize/index.ts`, donde se manejan datos legales y respuestas de APIs externas sin validación de tipos estricta.
    *   *Riesgo:* Errores en tiempo de ejecución no detectados durante la compilación, posibles fallos en la integración con Digital Trust si la API cambia ligeramente.
*   **Scripts faltantes:** El `package.json` original no incluía un script `type-check`, lo que sugiere que la verificación de tipos no era parte del flujo de trabajo habitual.

### 2.2 Integración QTSP (`supabase/functions/qtsp-notarize`)
*   **Fragilidad de Tipos:** La función utiliza `any` para el cliente Supabase y payloads de solicitud/respuesta.
*   **Valores "Hardcoded":** Proveedores como "EADTrust" y tipos de firma "PADES_LTV" están escritos directamente en el código.
    *   *Recomendación:* Mover estos valores a variables de entorno o configuración de base de datos para permitir cambios sin redeploy.
*   **Manejo de Errores:** En varios puntos se captura el error y se loguea solo `error.message`. Esto puede ocultar la traza de la pila (stack trace) y dificultar la depuración de problemas en producción.
*   **Idempotencia:** La lógica de reintentos y verificación de existencia es compleja y podría simplificarse.

### 2.3 Seguridad y Autenticación
*   **Almacenamiento de Claves Offline:** `src/lib/offlineCrypto.ts` almacena `kiosk_device_secret` y `kiosk_encryption_key` en `localStorage`.
    *   *Observación:* Esto es estándar para PWAs que no pueden usar Secure Enclave, pero implica que si un atacante tiene acceso físico al dispositivo desbloqueado o logra un XSS, puede extraer las claves.
*   **Race Condition en `useAuth`:** En `src/hooks/useAuth.tsx`, se utiliza un `setTimeout(() => { fetchUserData(...) }, 0)` dentro de `onAuthStateChange`. Esto parece ser un "hack" para evitar conflictos de estado o esperar a que la sesión se establezca completamente. Es propenso a fallos en condiciones de red lentas o dispositivos lentos.

### 2.4 Inconsistencias
*   **Variables de Entorno:** Se observa una mezcla en el acceso a variables de entorno (`Deno.env.get` en backend vs `import.meta.env` en frontend). Esto es esperado por la arquitectura, pero se debe asegurar que no se filtren secretos de backend al frontend.
*   **Logging:** No hay un sistema de logging estructurado unificado. Algunas funciones usan `console.log/error` y otras escriben en tablas de auditoría.

---

## 3. Recomendaciones

1.  **Refactorización de Tipos (Prioridad Alta):**
    *   Definir interfaces estrictas para `qtsp-notarize` (Request/Response de Digital Trust).
    *   Eliminar gradualmente los `any` en las Edge Functions críticas.

2.  **Mejora en `useAuth` (Prioridad Media):**
    *   Investigar la causa raíz del uso de `setTimeout` y reemplazarlo por un manejo de estado más robusto (ej. usar `isLoading` correctamente o `useEffect` dependiente de la sesión).

3.  **Configuración Centralizada (Prioridad Media):**
    *   Extraer constantes de QTSP (proveedores, tipos de firma) a una configuración centralizada o variables de entorno.

4.  **Hardenización de Seguridad Offline (Prioridad Baja/Media):**
    *   Considerar el uso de `IndexedDB` con claves no exportables (Web Crypto API `extractable: false`) si el navegador del kiosco lo soporta, para dificultar la extracción de claves.

5.  **Limpieza de Build:**
    *   Revisar la configuración de Vite para reducir el tamaño de los chunks (actualmente > 500kB).

---

## 4. Conclusión
El proyecto tiene una base sólida y funcional. La principal barrera para una "producción real" robusta es la deuda técnica en TypeScript. Resolver los problemas de tipado en el módulo QTSP debería ser la prioridad número uno para garantizar la integridad legal de los datos procesados.
