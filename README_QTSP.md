# Documentación de Integración QTSP (Digital Trust API)

Este documento detalla la integración con la API del Qualified Trust Service Provider (QTSP) "Digital Trust" para la certificación y sellado de evidencias digitales.

## 📋 Descripción General

La integración permite generar evidencias legales (sellado de tiempo cualificado y firma electrónica) para diversos eventos en la plataforma, asegurando la integridad y el no repudio de los datos.

La funcionalidad principal reside en la Edge Function de Supabase `qtsp-notarize`, que actúa como middleware entre nuestra aplicación y la API de Digital Trust.

## 🏗 Arquitectura

El sistema sigue una jerarquía de datos impuesta por la API de Digital Trust:

1.  **Case File (Expediente)**: Contenedor principal asociado a una Empresa (`Company`).
    *   Se crea uno por empresa.
    *   Formato código: `RH-{COMPANY_ID_PREFIX}`.
    *   Almacenado localmente en `dt_case_files`.

2.  **Evidence Group (Grupo de Evidencias)**: Agrupación temporal de evidencias (mensual).
    *   Se crea uno por mes y año (`YYYY-MM`).
    *   Formato código: `GRP-{YYYYMM}`.
    *   Almacenado localmente en `dt_evidence_groups`.

3.  **Evidence (Evidencia)**: El registro individual certificado (hash, PDF, etc.).
    *   Tipos: `daily_timestamp`, `monthly_report`, `message_hash`, `acknowledgment`, `notification_hash`.
    *   Almacenado localmente en `dt_evidences`.

## ⚙️ Configuración

Para que la integración funcione, se requieren las siguientes variables de entorno (Secrets) en Supabase:

| Nombre Variable | Descripción |
|-----------------|-------------|
| `DIGITALTRUST_LOGIN_URL` | URL para obtener el token OAuth2. |
| `DIGITALTRUST_CLIENT_ID` | Client ID para autenticación. |
| `DIGITALTRUST_CLIENT_SECRET` | Client Secret para autenticación. |
| `DIGITALTRUST_API_URL` | URL base de la API de Digital Trust. |

## 🚀 Funcionalidad de la Edge Function (`qtsp-notarize`)

La función `qtsp-notarize` es el punto de entrada único. Acepta solicitudes POST con un cuerpo JSON que debe incluir `action` y `company_id`.

### Acciones Disponibles

#### 1. `timestamp_daily`
Genera un sello de tiempo para el Merkle Root diario de los fichajes.

*   **Parámetros:** `daily_root_id`, `root_hash`, `date` (YYYY-MM-DD).
*   **Comportamiento:** Crea una evidencia tipo `daily_timestamp` y espera el `tsp_token`.

#### 2. `seal_pdf`
Firma digitalmente (PAdES-LTV) un informe mensual en PDF.

*   **Parámetros:** `pdf_base64`, `report_month` (YYYY-MM), `file_name`.
*   **Comportamiento:** Sube el PDF, solicita la firma cualificada, espera el documento firmado y lo guarda en Supabase Storage (`sealed-reports`).

#### 3. `timestamp_message`
Certifica el contenido de un mensaje corporativo.

*   **Parámetros:** `message_id`, `content_hash`.
*   **Comportamiento:** Crea evidencia `message_hash`.

#### 4. `timestamp_acknowledgment`
Certifica el acuse de recibo de un mensaje por parte de un empleado.

*   **Parámetros:** `recipient_id`, `content_hash`, `message_id`.
*   **Comportamiento:** Crea evidencia `acknowledgment`.

#### 5. `timestamp_notification`
Certifica una notificación enviada.

*   **Parámetros:** `notification_id`, `content_hash`, `notification_type`.
*   **Comportamiento:** Crea evidencia `notification_hash`.

#### 6. `check_status`
Verifica y actualiza el estado de evidencias pendientes (`processing`).

*   **Parámetros:** `evidence_id` (opcional). Si no se envía, revisa todas las pendientes de la empresa.

#### 7. `retry_failed`
Reintenta procesar evidencias que fallaron anteriormente.

*   **Parámetros:** Ninguno adicional.

#### 8. `health_check`
Verifica la conectividad con la API externa.

*   **Parámetros:** No requiere `company_id`.

## 💾 Modelo de Datos (Base de Datos)

*   **`dt_case_files`**: Mapeo entre `company_id` y el expediente externo.
*   **`dt_evidence_groups`**: Agrupaciones mensuales vinculadas a un `case_file`.
*   **`dt_evidences`**: Registro central de evidencias. Contiene:
    *   `external_id`: ID en Digital Trust.
    *   `tsp_token`: Token de sello de tiempo (si aplica).
    *   `sealed_pdf_path`: Ruta al PDF firmado en Storage (si aplica).
    *   `status`: `processing`, `completed`, `failed`.
*   **`qtsp_audit_log`**: Registro detallado de cada operación (request/response, duración, errores).

## 🛡 Manejo de Errores e Idempotencia

*   **Idempotencia**: Antes de crear cualquier entidad en la API externa, el sistema verifica si ya existe localmente (`dt_*` tables) o en la API remota (mediante búsqueda por código/hash) para evitar duplicados.
*   **Recuperación**: Si la API devuelve un error 409 (Conflict), el sistema intenta buscar la entidad existente y sincronizarla.
*   **Reintentos**: Las evidencias fallidas se marcan con estado `failed` y pueden ser reprocesadas masivamente con la acción `retry_failed`.

## 💻 Ejemplos de Uso (cURL)

**Health Check:**
```bash
curl -X POST "https://[PROJECT_ID].supabase.co/functions/v1/qtsp-notarize" \
  -H "Authorization: Bearer [ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"action": "health_check"}'
```

**Sellar PDF:**
```bash
curl -X POST "https://[PROJECT_ID].supabase.co/functions/v1/qtsp-notarize" \
  -H "Authorization: Bearer [ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "seal_pdf",
    "company_id": "uuid-empresa",
    "report_month": "2024-01",
    "file_name": "informe_enero.pdf",
    "pdf_base64": "JVBERi0xLjQK..."
  }'
```
