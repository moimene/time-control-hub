# Integración QTSP - Time Control Hub

[![eIDAS](https://img.shields.io/badge/eIDAS-Compliant-green)](https://digital-strategy.ec.europa.eu/en/policies/eidas-regulation)
[![QTSP](https://img.shields.io/badge/QTSP-EADTrust-red)](https://esignature.ec.europa.eu/efda/tl-browser/)
[![RFC 3161](https://img.shields.io/badge/RFC_3161-TSA-blue)](https://datatracker.ietf.org/doc/html/rfc3161)

**Documentación técnica completa de la integración con Prestadores Cualificados de Servicios de Confianza (QTSP)** para sellado de tiempo, firma electrónica y notificaciones certificadas conforme al Reglamento eIDAS.

---

## Tabla de Contenidos

1. [Visión General](#-visión-general)
2. [Arquitectura QTSP](#-arquitectura-qtsp)
3. [API Reference](#-api-reference)
4. [Tipos de Evidencia](#-tipos-de-evidencia)
5. [Flujos de Sellado](#-flujos-de-sellado)
6. [Modelo de Datos](#-modelo-de-datos)
7. [Monitorización](#-monitorización)
8. [Tests de Integración](#-tests-de-integración)
9. [Gestión de Errores](#-gestión-de-errores)
10. [Configuración](#-configuración)

---

## Visión General

Time Control Hub integra servicios QTSP para proporcionar **evidencia legal irrefutable** de todos los registros horarios y transacciones críticas del sistema.

### Servicios Integrados

| Servicio | Proveedor | Estándar | Uso Principal |
|----------|-----------|----------|---------------|
| **Sellado de Tiempo** | EADTrust | RFC 3161 | Hash diario de fichajes |
| **Firma Electrónica Simple** | EADTrust | PAdES-LTV | Informes mensuales |
| **Custodia Documental** | Digital Trust | eIDAS | Documentos legales |
| **Hash Evidence** | EADTrust | RFC 3161 | Mensajes y notificaciones |

### Niveles de Firma

```mermaid
graph LR
    subgraph "Niveles eIDAS"
        SIMPLE["SIMPLE\n1 factor"]
        ADVANCED["ADVANCED\n2+ factores"]
        QUALIFIED["QUALIFIED\nCertificado cualificado"]
    end

    subgraph "Uso en Time Control Hub"
        S1["Informes mensuales"]
        S2["Cierres firmados"]
        S3["Documentos legales"]
    end

    SIMPLE --> S1
    SIMPLE --> S2
    SIMPLE --> S3
```

> **Nota**: Time Control Hub utiliza **firma simple (SIMPLE)** basada en un solo factor de autenticación, conforme a las necesidades del registro de jornada. El formato es **PAdES-LTV** para validación a largo plazo.

---

## Arquitectura QTSP

### Diagrama de Componentes

```mermaid
graph TB
    subgraph "Time Control Hub"
        subgraph "Edge Functions"
            SCHED["qtsp-scheduler\nOrquestador horario"]
            GDR["generate-daily-root\nMerkle Tree"]
            NOTARIZE["qtsp-notarize\nAPI Gateway QTSP"]
            RETRY["qtsp-retry\nReintentos"]
            HEALTH["qtsp-health-monitor\nMonitorización"]
            EXPORT["qtsp-export-package\nExportación"]
            TOGGLE["qtsp-toggle-alerts\nGestión alertas"]
        end

        subgraph "Base de Datos"
            DR["daily_roots\nHash Merkle diario"]
            CF["dt_case_files\nExpedientes"]
            EG["dt_evidence_groups\nGrupos mensuales"]
            EV["dt_evidences\nEvidencias selladas"]
            LOG["qtsp_audit_log\nAuditoría"]
            ESC["escalation_history\nEscalados"]
        end
    end

    subgraph "Digital Trust API"
        AUTH["OAuth 2.0\nAutenticación"]
        CASES["/case-files\nExpedientes"]
        GROUPS["/evidence-groups\nGrupos"]
        EVIDENCES["/evidences\nEvidencias"]
        TSP["TSP Server\nRFC 3161"]
        SIGN["Firma PAdES-LTV"]
    end

    SCHED --> GDR
    GDR --> NOTARIZE
    NOTARIZE --> AUTH
    AUTH --> CASES
    CASES --> GROUPS
    GROUPS --> EVIDENCES
    EVIDENCES --> TSP
    EVIDENCES --> SIGN

    NOTARIZE --> DR
    NOTARIZE --> CF
    NOTARIZE --> EG
    NOTARIZE --> EV
    NOTARIZE --> LOG

    HEALTH --> NOTARIZE
    RETRY --> NOTARIZE
    EXPORT --> EV
```

### Flujo de Autenticación OAuth 2.0

```mermaid
sequenceDiagram
    participant EF as Edge Function
    participant DT as Digital Trust
    
    EF->>DT: POST /oauth/token
    Note right of EF: grant_type: client_credentials\nclient_id, client_secret\nscope: token
    DT-->>EF: access_token (Bearer)
    Note left of DT: expires_in: 3600s
    EF->>DT: GET/POST con Bearer Token
    DT-->>EF: Response
```

---

## API Reference

### Edge Function: `qtsp-notarize`

Endpoint principal que gestiona todas las operaciones QTSP.

**URL**: `POST /functions/v1/qtsp-notarize`

#### Acciones Disponibles

| Action | Descripción | Parámetros Requeridos |
|--------|-------------|----------------------|
| `health_check` | Verificar conectividad API | - |
| `timestamp_daily` | Sellar hash diario Merkle | `company_id`, `daily_root_id`, `root_hash`, `date` |
| `seal_pdf` | Firmar PDF con PAdES-LTV | `company_id`, `pdf_base64`, `report_month`, `file_name` |
| `check_status` | Verificar estado evidencia | `company_id`, `evidence_id` (opcional) |
| `retry_failed` | Reintentar evidencias fallidas | `company_id` |
| `timestamp_message` | Sellar mensaje | `company_id`, `message_id`, `content_hash` |
| `timestamp_acknowledgment` | Sellar acuse de recibo | `company_id`, `recipient_id`, `content_hash` |
| `timestamp_notification` | Sellar notificación | `company_id`, `notification_id`, `content_hash` |

#### Ejemplo: Health Check

```bash
curl -X POST https://[PROJECT_ID].supabase.co/functions/v1/qtsp-notarize \
  -H "Authorization: Bearer [ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"action": "health_check"}'
```

**Respuesta**:
```json
{
  "success": true,
  "status": "healthy",
  "auth": true,
  "api": true,
  "latency_ms": 245,
  "message": "Digital Trust API is operational"
}
```

#### Ejemplo: Timestamp Daily

```bash
curl -X POST https://[PROJECT_ID].supabase.co/functions/v1/qtsp-notarize \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "timestamp_daily",
    "company_id": "uuid-empresa",
    "daily_root_id": "uuid-daily-root",
    "root_hash": "abc123def456...",
    "date": "2026-01-06"
  }'
```

**Respuesta**:
```json
{
  "success": true,
  "message": "Daily root timestamped",
  "already_exists": false,
  "evidence": {
    "id": "uuid-evidencia",
    "external_id": "dt-uuid",
    "status": "completed",
    "tsp_token": "MIIxxxxx..."
  }
}
```

#### Ejemplo: Seal PDF

```bash
curl -X POST https://[PROJECT_ID].supabase.co/functions/v1/qtsp-notarize \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "seal_pdf",
    "company_id": "uuid-empresa",
    "pdf_base64": "JVBERi0xLjQK...",
    "report_month": "2026-01",
    "file_name": "informe_mensual_enero.pdf"
  }'
```

**Respuesta**:
```json
{
  "success": true,
  "sealed_pdf_path": "2026-01/informe_mensual_enero_sealed.pdf",
  "already_exists": false,
  "signature_config": {
    "provider": "EADTRUST",
    "type": "PADES_LTV",
    "level": "SIMPLE",
    "authenticationFactor": 1
  }
}
```

### Edge Function: `qtsp-scheduler`

Orquestador que ejecuta el sellado diario por zona horaria.

**Trigger**: `pg_cron` cada hora (`0 * * * *`)

```mermaid
sequenceDiagram
    participant CRON as pg_cron
    participant SCHED as qtsp-scheduler
    participant DB as PostgreSQL
    participant GDR as generate-daily-root

    CRON->>SCHED: HTTP POST (cada hora)
    SCHED->>DB: SELECT empresas por timezone
    Note right of SCHED: Ventana 2:00-5:00 AM local
    
    loop Cada empresa elegible
        SCHED->>GDR: POST company_id, date=ayer
    end
    
    SCHED-->>CRON: { processed: N, errors: M }
```

### Edge Function: `generate-daily-root`

Genera el Merkle Root diario de fichajes.

**Algoritmo**:
1. Obtener todos los `time_events` del día
2. Extraer `event_hash` de cada evento
3. Construir árbol Merkle con SHA-256
4. Insertar en `daily_roots`
5. Invocar `qtsp-notarize` para sellar

```typescript
// Algoritmo Merkle Tree
async function buildMerkleRoot(hashes: string[]): Promise<string> {
  if (hashes.length === 0) return '';
  if (hashes.length === 1) return hashes[0];

  const nextLevel: string[] = [];
  for (let i = 0; i < hashes.length; i += 2) {
    const left = hashes[i];
    const right = hashes[i + 1] || left;
    const combined = await computeHash(left + right);
    nextLevel.push(combined);
  }

  return buildMerkleRoot(nextLevel);
}
```

### Edge Function: `qtsp-health-monitor`

Monitoriza la salud del servicio QTSP.

**Trigger**: `pg_cron` cada 5 minutos

**Métricas**:
- Latencia de autenticación
- Disponibilidad de API
- Tasa de éxito de sellados
- Evidencias pendientes

### Edge Function: `qtsp-export-package`

Exporta paquete probatorio de evidencias QTSP.

**Contenido del paquete**:
```
qtsp_export_[empresa]_[fecha]/
├── manifest.json           # Índice con hashes
├── daily_roots/            # Merkle roots por día
│   ├── 2026-01-01.json
│   └── ...
├── evidences/              # Tokens TSP
│   ├── [id]_tsp_token.txt
│   └── ...
├── sealed_pdfs/            # PDFs firmados
│   └── 2026-01/
│       └── informe_sealed.pdf
└── audit_log.json          # Log de operaciones
```

---

## Tipos de Evidencia

### 1. Daily Timestamp (`daily_timestamp`)

Sellado del hash Merkle root diario de todos los fichajes.

```mermaid
graph LR
    subgraph "Fichajes del día"
        E1["08:00 Entry"]
        E2["14:00 Exit"]
        E3["15:00 Entry"]
        E4["18:30 Exit"]
    end

    subgraph "Hash Chain"
        H1["hash_1"]
        H2["hash_2"]
        H3["hash_3"]
        H4["hash_4"]
    end

    subgraph "Merkle Tree"
        M1["H(H1+H2)"]
        M2["H(H3+H4)"]
        ROOT["Merkle Root"]
    end

    E1 --> H1
    E2 --> H2
    E3 --> H3
    E4 --> H4

    H1 --> M1
    H2 --> M1
    H3 --> M2
    H4 --> M2

    M1 --> ROOT
    M2 --> ROOT

    ROOT --> TSP["Token RFC 3161"]
```

### 2. Monthly Report (`monthly_report`)

Firma digital PAdES-LTV de informes mensuales.

| Campo | Valor |
|-------|-------|
| Tipo | PAdES-LTV |
| Nivel | SIMPLE |
| Factores | 1 (autenticación sistema) |
| Validez | Largo plazo (LTV) |
| Proveedor | EADTrust |

### 3. Message Hash (`message_hash`)

Sellado de contenido de mensajes empresa-empleado.

```typescript
// Cálculo del hash de mensaje
const contentToHash = JSON.stringify({
  id: message.id,
  subject: message.subject,
  body: message.body,
  created_at: message.created_at,
  sender_type: message.sender_type,
});
const hash = await crypto.subtle.digest('SHA-256', encoder.encode(contentToHash));
```

### 4. Acknowledgment (`acknowledgment`)

Sellado de acuses de recibo de mensajes.

### 5. Notification Hash (`notification_hash`)

Sellado de notificaciones de cumplimiento.

---

## Flujos de Sellado

### Flujo 1: Sellado Diario Automático

```mermaid
sequenceDiagram
    autonumber
    participant CRON as pg_cron
    participant SCHED as qtsp-scheduler
    participant GDR as generate-daily-root
    participant DB as PostgreSQL
    participant QTSP as qtsp-notarize
    participant DT as Digital Trust

    Note over CRON: Cada hora en punto

    CRON->>SCHED: Trigger HTTP
    SCHED->>DB: SELECT empresas con timezone en ventana 2-5 AM
    
    loop Por cada empresa
        SCHED->>GDR: POST { company_id, date: ayer }
        GDR->>DB: SELECT time_events del día
        GDR->>GDR: Construir Merkle Tree
        GDR->>DB: INSERT daily_roots
        GDR->>QTSP: POST timestamp_daily
        
        QTSP->>DT: POST /oauth/token
        DT-->>QTSP: access_token
        
        QTSP->>DT: POST /case-files (si no existe)
        DT-->>QTSP: case_file_id
        
        QTSP->>DT: POST /evidence-groups (si no existe)
        DT-->>QTSP: evidence_group_id
        
        QTSP->>DT: POST /evidences
        DT-->>QTSP: evidence_id
        
        loop Polling (max 10 intentos)
            QTSP->>DT: GET /evidences/{id}
            DT-->>QTSP: { tspToken: "..." }
        end
        
        QTSP->>DB: UPDATE dt_evidences status=completed
        QTSP->>DB: INSERT qtsp_audit_log
    end
```

### Flujo 2: Firma de Informe Mensual

```mermaid
sequenceDiagram
    participant ADMIN as Admin
    participant UI as Frontend
    participant API as generate-legal-reports
    participant QTSP as qtsp-notarize
    participant DT as Digital Trust
    participant STORAGE as Supabase Storage

    ADMIN->>UI: Generar informe mensual
    UI->>API: POST { month, employees }
    API->>API: Generar PDF
    API->>QTSP: POST seal_pdf { pdf_base64, report_month }
    
    QTSP->>DT: POST /evidences con signature config
    Note right of QTSP: type: PADES_LTV\nlevel: SIMPLE\nauthenticationFactor: 1
    
    DT->>DT: Firma digital
    
    loop Polling (max 30 intentos)
        QTSP->>DT: GET /evidences/{id}
        DT-->>QTSP: { signedFile: { content: base64 } }
    end
    
    QTSP->>STORAGE: Upload PDF firmado
    QTSP-->>API: { sealed_pdf_path }
    API-->>UI: URL del PDF firmado
```

### Flujo 3: Sellado de Mensaje

```mermaid
sequenceDiagram
    participant ADMIN as Admin
    participant UI as MessageComposer
    participant DB as PostgreSQL
    participant QTSP as qtsp-notarize

    ADMIN->>UI: Redactar mensaje
    UI->>DB: INSERT company_messages
    DB-->>UI: message_id
    
    UI->>UI: Calcular content_hash
    UI->>QTSP: POST timestamp_message
    
    QTSP->>QTSP: Crear evidencia
    QTSP->>DB: UPDATE company_messages SET qtsp_evidence_id
    
    QTSP-->>UI: { success, evidence }
```

---

## Modelo de Datos

### Diagrama ER QTSP

```mermaid
erDiagram
    COMPANY ||--o{ DT_CASE_FILES : "tiene"
    DT_CASE_FILES ||--o{ DT_EVIDENCE_GROUPS : "contiene"
    DT_EVIDENCE_GROUPS ||--o{ DT_EVIDENCES : "agrupa"
    DAILY_ROOTS ||--o| DT_EVIDENCES : "sella"
    COMPANY ||--o{ QTSP_AUDIT_LOG : "registra"
    COMPANY ||--o{ ESCALATION_RULES : "configura"
    ESCALATION_RULES ||--o{ ESCALATION_HISTORY : "dispara"

    DT_CASE_FILES {
        uuid id PK
        uuid company_id FK
        text external_id "ID en Digital Trust"
        text name
        text description
        timestamp created_at
    }

    DT_EVIDENCE_GROUPS {
        uuid id PK
        uuid case_file_id FK
        text external_id "ID en Digital Trust"
        text name
        text year_month "YYYY-MM"
        timestamp created_at
    }

    DT_EVIDENCES {
        uuid id PK
        uuid evidence_group_id FK
        uuid daily_root_id FK
        text external_id "ID en Digital Trust"
        enum evidence_type "daily_timestamp, monthly_report, message_hash, acknowledgment, notification_hash"
        enum status "pending, processing, completed, failed"
        text tsp_token "Token RFC 3161"
        timestamp tsp_timestamp
        text original_pdf_path
        text sealed_pdf_path
        jsonb signature_data
        text report_month
        text error_message
        int retry_count
        timestamp completed_at
    }

    DAILY_ROOTS {
        uuid id PK
        uuid company_id FK
        date date
        text root_hash "Merkle Root SHA-256"
        int event_count
        timestamp created_at
    }

    QTSP_AUDIT_LOG {
        uuid id PK
        uuid company_id FK
        text action
        uuid evidence_id FK
        jsonb request_payload
        jsonb response_payload
        enum status "success, failed, pending"
        text error_message
        int duration_ms
        timestamp created_at
    }

    ESCALATION_RULES {
        uuid id PK
        uuid company_id FK
        int level
        text severity_threshold
        int time_threshold_minutes
        int consecutive_failures_threshold
        text[] notify_emails
        boolean notify_in_app
        boolean is_active
    }

    ESCALATION_HISTORY {
        uuid id PK
        uuid company_id FK
        uuid rule_id FK
        uuid qtsp_log_id FK
        int escalation_level
        text error_category
        text error_message
        boolean notification_sent
        text notification_channel
        timestamp triggered_at
        timestamp acknowledged_at
        timestamp resolved_at
    }
```

### Estados de Evidencia

```mermaid
stateDiagram-v2
    [*] --> pending: Creación
    pending --> processing: Envío a QTSP
    processing --> completed: Token/Firma recibida
    processing --> failed: Error API
    failed --> pending: Retry programado
    completed --> [*]

    note right of pending
        Evidencia creada localmente
        Pendiente de envío
    end note

    note right of processing
        Enviada a Digital Trust
        Esperando respuesta
    end note

    note right of completed
        Token TSP recibido
        o PDF firmado
    end note

    note right of failed
        Error en API
        Retry con backoff
        Max 10 intentos
    end note
```

---

## Monitorización

### Panel Super Admin

**Ubicación**: `/super-admin/qtsp`

#### Tabs Disponibles

| Tab | Contenido |
|-----|-----------|
| **Estado** | Health check, métricas en tiempo real |
| **Evidencias** | Calendario de sellados por empresa |
| **Logs** | Auditoría de operaciones QTSP |
| **Tendencias** | Gráficos de éxito/fallos |
| **Escalados** | Gestión de alertas |
| **Errores** | Análisis de fallos por categoría |
| **Exportar** | Generación de paquetes probatorios |
| **Tests** | Tests de integración en vivo |

### Métricas Principales

```mermaid
graph TB
    subgraph "KPIs QTSP"
        M1["Tasa de Éxito\n% evidencias completadas"]
        M2["Latencia Media\nms por operación"]
        M3["Pendientes\nevidencias en processing"]
        M4["Fallos Acumulados\núltimas 24h"]
    end

    subgraph "Alertas"
        A1["🔴 Crítico\n> 3 fallos consecutivos"]
        A2["🟡 Warning\nLatencia > 10s"]
        A3["🟢 OK\nOperativo"]
    end
```

### Integración en Procesos

| Proceso | Integración QTSP |
|---------|------------------|
| **Fichaje Diario** | Merkle root sellado cada noche |
| **Cierre Mensual** | Firma PAdES-LTV del informe |
| **Paquete ITSS** | Manifiesto con tokens TSP |
| **Aceptación Documentos** | Hash sellado por empleado |
| **Mensajes Empresa** | Sellado opcional de contenido |
| **Notificaciones Compliance** | Hash sellado para evidencia |
| **Purga de Datos** | Hash previo a eliminación |

---

## Tests de Integración

### Panel de Tests

**Ubicación**: `/super-admin/qtsp` → Tab "Tests"

#### Tests Disponibles

| Test | Descripción | Validaciones |
|------|-------------|--------------|
| `health_check` | Conectividad API | Auth OK, API OK, Latencia < 5s |
| `timestamp_daily` | Sellado de hash | Token TSP presente |
| `timestamp_notification` | Sellado notificación | Evidence ID generado |
| `seal_pdf` | Firma PAdES-LTV | Config: SIMPLE, factor=1 |
| `check_status` | Verificar estado | Status actualizado |

#### Ejemplo de Resultado

```json
{
  "test": "seal_pdf",
  "status": "success",
  "duration_ms": 1234,
  "validations": {
    "signature_type": "PADES_LTV ✓",
    "signature_level": "SIMPLE ✓",
    "authentication_factor": "1 ✓",
    "provider": "EADTRUST ✓"
  },
  "response": {
    "success": true,
    "test_mode": true,
    "signature_config": {
      "provider": "EADTRUST",
      "type": "PADES_LTV",
      "level": "SIMPLE",
      "authenticationFactor": 1
    }
  }
}
```

---

## Gestión de Errores

### Categorías de Error

| Categoría | Causa | Acción |
|-----------|-------|--------|
| `AUTH_FAILED` | Credenciales inválidas | Verificar secrets |
| `API_UNAVAILABLE` | Digital Trust caído | Retry automático |
| `RATE_LIMITED` | Exceso de peticiones | Backoff exponencial |
| `INVALID_REQUEST` | Parámetros incorrectos | Revisar payload |
| `TIMEOUT` | Polling agotado | Retry en siguiente ciclo |

### Estrategia de Reintentos

```mermaid
graph LR
    subgraph "Backoff Exponencial"
        R1["Retry 1\n2 segundos"]
        R2["Retry 2\n4 segundos"]
        R3["Retry 3\n8 segundos"]
        R4["Retry 4\n16 segundos"]
        RN["Retry 10\n~17 minutos"]
    end

    R1 --> R2 --> R3 --> R4 --> RN
```

### Escalado de Alertas

```mermaid
stateDiagram-v2
    [*] --> Nivel1: 1 fallo
    Nivel1 --> Nivel2: 3 fallos consecutivos
    Nivel2 --> Nivel3: > 30 min sin resolver
    
    Nivel1: Email a admin técnico
    Nivel2: Email a admin + responsable
    Nivel3: SMS urgente + notificación in-app
```

---

## Configuración

### Secretos Requeridos

| Secreto | Descripción | Ejemplo |
|---------|-------------|---------|
| `DIGITALTRUST_API_URL` | URL base API | `https://api.eadtrust.eu` |
| `DIGITALTRUST_LOGIN_URL` | Endpoint OAuth | `https://auth.eadtrust.eu/oauth/token` |
| `DIGITALTRUST_CLIENT_ID` | ID cliente OAuth | `time-control-hub-prod` |
| `DIGITALTRUST_CLIENT_SECRET` | Secret OAuth | `xxx-secret-xxx` |

### Configuración por Empresa

```typescript
interface QTSPSettings {
  enabled: boolean;
  alert_emails: string[];
  escalation_enabled: boolean;
  retry_max_attempts: number;
  notify_on_failure: boolean;
}
```

### Cron Jobs QTSP

| Job | Schedule | Función |
|-----|----------|---------|
| `qtsp-scheduler-hourly` | `0 * * * *` | Sellado por timezone |
| `qtsp-health-check` | `*/5 * * * *` | Monitorización |
| `qtsp-retry-failed` | `30 * * * *` | Reintentos |

---

## Apéndice: Conformidad Legal

### Normativa Aplicable

| Normativa | Artículo | Requisito | Implementación |
|-----------|----------|-----------|----------------|
| **eIDAS** | Art. 41 | Sello de tiempo cualificado | RFC 3161 vía EADTrust |
| **eIDAS** | Art. 25 | Firma electrónica simple | PAdES-LTV nivel SIMPLE |
| **RD-ley 8/2019** | Art. 10 | Registro de jornada | Merkle root diario |
| **ET** | Art. 34.9 | Conservación 4 años | Custodia QTSP |

### Verificación de Firmas

Los tokens TSP y PDFs firmados pueden verificarse mediante:

1. **Herramientas online**: [EU eSignature Validator](https://ec.europa.eu/digital-building-blocks/DSS/webapp-demo/validation)
2. **Adobe Acrobat**: Verificación integrada de firmas PAdES
3. **API Digital Trust**: Endpoint `/verify`

---

<p align="center">
  <strong>Time Control Hub - Integración QTSP</strong><br/>
  Servicios de Confianza Cualificados conforme a eIDAS<br/>
  <br/>
  Proveedor: EADTrust (Digital Trust)
</p>
