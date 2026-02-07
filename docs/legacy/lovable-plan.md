# Plan: Sistema de Documentos Legales con Aceptacion Electronica QTSP

## Resumen Ejecutivo

Implementar el sistema completo de cumplimiento legal para pymes espanolas:
1. **14 documentos legales** con plantillas y campos variables
2. **Aceptacion electronica** via portal de empleado con sellado QTSP
3. **Sistema de retencion y purga** automatica de 4 anos
4. **Bloqueo de fichaje** durante ausencias activas
5. **Procedimiento de contingencias** con registro en papel

---

## FASE 1: Migracion de Base de Datos

### 1.1 Tabla `legal_document_templates`
Almacena las 14 plantillas maestras del sistema.

```sql
CREATE TABLE public.legal_document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  category VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  content_markdown TEXT NOT NULL,
  required_variables JSONB DEFAULT '[]',
  is_employee_acceptance BOOLEAN DEFAULT false,
  priority VARCHAR(10) DEFAULT 'medium',
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 1.2 Tabla `legal_documents`
Documentos generados por empresa con campos variables sustituidos.

```sql
CREATE TABLE public.legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id),
  template_id UUID NOT NULL REFERENCES legal_document_templates(id),
  title VARCHAR(200) NOT NULL,
  content_html TEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  variable_values JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  published_by UUID,
  qtsp_evidence_id UUID REFERENCES dt_evidences(id),
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 1.3 Tabla `document_acknowledgments`
Registro de aceptaciones con sellado QTSP.

```sql
CREATE TABLE public.document_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id),
  document_id UUID NOT NULL REFERENCES legal_documents(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  acknowledgment_type VARCHAR(30) NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  content_hash VARCHAR(64) NOT NULL,
  signature_data JSONB,
  qtsp_evidence_id UUID REFERENCES dt_evidences(id),
  qtsp_timestamp TIMESTAMPTZ,
  qtsp_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, employee_id)
);
```

### 1.4 Tabla `data_retention_config`
Configuracion de plazos de retencion por categoria.

```sql
CREATE TABLE public.data_retention_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id),
  data_category VARCHAR(50) NOT NULL,
  retention_years INTEGER NOT NULL DEFAULT 4,
  purge_enabled BOOLEAN DEFAULT true,
  last_purge_at TIMESTAMPTZ,
  next_purge_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, data_category)
);
```

### 1.5 Tabla `data_purge_log`
Registro de purgas con evidencia de destruccion.

```sql
CREATE TABLE public.data_purge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id),
  data_category VARCHAR(50) NOT NULL,
  purge_date DATE NOT NULL,
  records_before_count INTEGER NOT NULL,
  records_purged_count INTEGER NOT NULL,
  cutoff_date DATE NOT NULL,
  content_hash_before VARCHAR(64),
  content_hash_after VARCHAR(64),
  executed_by VARCHAR(50) DEFAULT 'system',
  qtsp_evidence_id UUID REFERENCES dt_evidences(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 1.6 Tabla `contingency_records`
Registro de fichajes manuales por contingencia.

```sql
CREATE TABLE public.contingency_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  contingency_date DATE NOT NULL,
  entry_time TIME,
  exit_time TIME,
  pause_start TIME,
  pause_end TIME,
  reason VARCHAR(200) NOT NULL,
  paper_form_reference VARCHAR(100),
  employee_signature_confirmed BOOLEAN DEFAULT false,
  responsible_signature_confirmed BOOLEAN DEFAULT false,
  transcribed_by UUID,
  transcribed_at TIMESTAMPTZ,
  validated_by UUID,
  validated_at TIMESTAMPTZ,
  time_event_ids JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## FASE 2: Plantillas de Documentos Legales

### Archivo: `src/lib/legalDocumentTemplates.ts`

Contendra las 14 plantillas completas con los textos proporcionados:

| Codigo | Nombre | Categoria | Acepta Empleado | Prioridad |
|--------|--------|-----------|-----------------|-----------|
| DOC-01 | Clausula Informacion Control Horario | privacy | SI | ALTA |
| DOC-02 | Clausula Informacion Ausencias | privacy | SI | ALTA |
| DOC-03 | Politica Retencion y Purga | privacy | NO | ALTA |
| DOC-04 | RAT Control Horario | privacy | NO | MEDIA |
| DOC-05 | RAT Ausencias | privacy | NO | MEDIA |
| DOC-06 | Norma Interna Sistema | internal_rules | SI | ALTA |
| DOC-07 | Procedimiento Contingencias | internal_rules | SI | ALTA |
| DOC-08 | Acuse Recibo Credenciales | employee_docs | SI | ALTA |
| DOC-09 | Manual Control Horario ITSS | labor_compliance | NO | ALTA |
| DOC-10 | Politica Gestion Ausencias | labor_compliance | SI | MEDIA |
| DOC-11 | Calendario Laboral Anual | labor_compliance | NO | MEDIA |
| DOC-12 | Clausula Encargo Tratamiento | contracts | NO | BAJA |
| DOC-13 | Guia Rapida Empleado | employee_docs | SI | BAJA |
| DOC-14 | Consentimiento Comunicaciones | employee_docs | SI | BAJA |

### Campos Variables Globales (de tabla `company`):
- `{{EMPRESA_NOMBRE}}` -> company.name
- `{{EMPRESA_CIF}}` -> company.cif
- `{{EMPRESA_DIRECCION}}` -> company.address
- `{{EMPRESA_CIUDAD}}` -> company.city
- `{{EMPRESA_CP}}` -> company.postal_code
- `{{FECHA_GENERACION}}` -> fecha actual

### Campos Variables Adicionales (de `company.settings`):
- `{{CONTACTO_PRIVACIDAD}}`
- `{{EMAIL_CONTACTO_DPD}}`
- `{{PROVEEDOR_PLATAFORMA}}` -> "Time Control Hub"
- `{{QTSP_NOMBRE}}` -> "EADTrust"
- `{{RESPONSABLE_CUMPLIMIENTO}}`
- `{{CENTRO_NOMBRE}}`
- `{{UBICACION_TERMINAL}}`
- `{{CANAL_CORRECCIONES}}`
- `{{PLAZO_CORRECCIONES_HORAS}}`
- `{{RESPONSABLE_CUSTODIA}}`
- `{{LUGAR_ARCHIVO_PARTES}}`
- `{{PLAZO_TRANSCRIPCION_HORAS}}`
- etc.

---

## FASE 3: Edge Functions

### 3.1 Modificar `kiosk-clock/index.ts`
Bloquear fichaje durante ausencias activas.

**Insertar despues de la autenticacion del empleado (linea ~410):**

```typescript
// ========== CHECK ACTIVE ABSENCES ==========
const today = new Date().toISOString().split('T')[0];

const { data: activeAbsence } = await supabase
  .from('absence_requests')
  .select(`
    id,
    start_date,
    end_date,
    absence_types!inner(code, name, blocks_clocking)
  `)
  .eq('employee_id', employee.id)
  .eq('status', 'approved')
  .lte('start_date', today)
  .gte('end_date', today)
  .maybeSingle();

if (activeAbsence) {
  const absenceType = activeAbsence.absence_types as any;
  if (absenceType.blocks_clocking) {
    console.log(`Clocking blocked for ${employee.employee_code}: active absence ${absenceType.code}`);
    
    return new Response(
      JSON.stringify({
        success: false,
        blocked_by_absence: true,
        error: `No puedes fichar. Tienes una ausencia activa: ${absenceType.name} (${activeAbsence.start_date} - ${activeAbsence.end_date})`,
        absence: {
          type: absenceType.name,
          code: absenceType.code,
          start_date: activeAbsence.start_date,
          end_date: activeAbsence.end_date,
        }
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
```

### 3.2 Nueva `acknowledge-document/index.ts`
Registrar aceptacion de documento con sellado QTSP.

**Flujo:**
1. Recibe: document_id, employee_id, acknowledgment_type
2. Verifica documento publicado y empleado valido
3. Verifica no existe aceptacion previa
4. Genera hash: SHA256(content_hash + employee_id + timestamp)
5. Crea registro en document_acknowledgments
6. Llama a qtsp-notarize para sellar el hash
7. Actualiza registro con qtsp_token y qtsp_timestamp
8. Retorna confirmacion con datos del sellado

### 3.3 Nueva `generate-legal-document/index.ts`
Generar PDF de documento legal.

**Flujo:**
1. Recibe: template_code, company_id
2. Obtiene plantilla de legal_document_templates
3. Obtiene datos de company
4. Sustituye todos los campos variables
5. Convierte Markdown a HTML
6. Genera PDF con jsPDF
7. Calcula content_hash
8. Guarda en storage
9. Crea/actualiza registro en legal_documents
10. Retorna URL de descarga

### 3.4 Nueva `data-retention-purge/index.ts`
Ejecutar purga automatica de datos.

**Flujo (ejecutar via cron diario):**
1. Obtiene empresas con purge_enabled=true
2. Para cada empresa y categoria:
   - Calcula cutoff_date (hoy - retention_years)
   - Cuenta registros anteriores a cutoff
   - Genera hash de integridad del conjunto
   - Ejecuta DELETE
   - Registra en data_purge_log
   - Actualiza last_purge_at
3. Opcionalmente sella el log de purga con QTSP

**Categorias y plazos por defecto:**
- time_events: 4 anos
- absence_requests: 4 anos
- correction_requests: 4 anos
- audit_log: 4 anos
- employee_documents: 5 anos
- document_acknowledgments: 10 anos
- dt_evidences: 10 anos (no purgar, solo archivar)

---

## FASE 4: Paginas de Administracion

### 4.1 `src/pages/admin/LegalDocuments.tsx`
Gestion completa de documentos legales.

**Funcionalidades:**
- Tabs por categoria (Privacidad, Normas, Laboral, Contratos, Empleados)
- Lista de plantillas disponibles
- Card por documento con:
  - Nombre y descripcion
  - Estado (borrador/publicado/archivado)
  - Fecha de publicacion
  - Numero de aceptaciones
  - Acciones: Ver, Editar campos, Publicar, Descargar PDF
- Formulario de edicion de campos variables
- Preview del documento con datos sustituidos
- Historial de versiones

### 4.2 `src/pages/admin/DataRetention.tsx`
Configuracion de retencion y registro de purgas.

**Funcionalidades:**
- Tabla de categorias de datos con:
  - Nombre de categoria
  - Plazo de retencion (editable)
  - Purga automatica (on/off)
  - Ultima purga ejecutada
  - Proxima purga programada
  - Registros pendientes de purgar
- Boton "Ejecutar purga manual" (con confirmacion)
- Historico de purgas ejecutadas con:
  - Fecha
  - Categoria
  - Registros purgados
  - Hash de integridad
  - Evidencia QTSP (si aplica)

### 4.3 `src/pages/admin/ContingencyRecords.tsx`
Registro de fichajes manuales por contingencia.

**Funcionalidades:**
- Boton "Descargar plantilla parte en papel" (PDF)
- Formulario de transcripcion:
  - Selector de empleado
  - Fecha de contingencia
  - Hora entrada / Hora salida
  - Pausas (opcional)
  - Motivo (dropdown: Fallo red, Corte electrico, Fallo terminal, Otro)
  - Referencia del parte en papel
  - Checkboxes: Firma empleado confirmada, Firma responsable confirmada
- Lista de registros pendientes de validar
- Lista de registros validados
- Al validar: genera time_events con source='manual_contingency'

---

## FASE 5: Portal del Empleado

### 5.1 Nueva `src/pages/employee/LegalDocuments.tsx`
Documentos legales para el empleado.

**Funcionalidades:**
- Seccion "Documentos pendientes de aceptar" (destacados)
- Seccion "Documentos aceptados"
- Para cada documento:
  - Nombre y fecha de publicacion
  - Boton "Ver documento" (abre modal con contenido)
  - Estado de aceptacion
  - Si aceptado: fecha, token QTSP
- Al hacer click en "Ver documento":
  - Modal con contenido completo (scroll)
  - Checkbox "He leido y comprendido este documento"
  - Boton "Acepto los terminos" (deshabilitado hasta marcar checkbox)
- Al aceptar:
  - Llamada a acknowledge-document
  - Spinner mientras se procesa
  - Confirmacion con token QTSP

### 5.2 Modificar `src/components/layout/EmployeeLayout.tsx`
Anadir badge de documentos pendientes en navegacion.

### 5.3 Modificar `src/pages/employee/Settings.tsx`
Anadir seccion con resumen de documentos pendientes/aceptados.

---

## FASE 6: Componentes UI

### Nuevos componentes:

1. **`src/components/admin/LegalDocumentCard.tsx`**
   - Tarjeta de documento con acciones
   - Muestra estado, aceptaciones, fechas

2. **`src/components/admin/DocumentPreview.tsx`**
   - Modal de preview con campos variables resaltados
   - Permite editar valores antes de publicar

3. **`src/components/admin/ContingencyForm.tsx`**
   - Formulario de transcripcion de parte en papel
   - Validacion de horas coherentes

4. **`src/components/admin/PaperFormTemplate.tsx`**
   - Componente para generar PDF del parte en papel
   - Incluye logo empresa y campos para rellenar

5. **`src/components/employee/DocumentAcceptanceDialog.tsx`**
   - Dialog de aceptacion con scroll del contenido
   - Checkbox de confirmacion y boton de aceptar

6. **`src/components/employee/QTSPAcceptanceBadge.tsx`**
   - Badge que muestra estado de sellado QTSP
   - Verde con checkmark si sellado, gris si pendiente

---

## FASE 7: Flujo de Aceptacion con QTSP

```
Empleado accede a Portal > Documentos Legales
                |
                v
    Ve documentos pendientes (destacados en amarillo)
                |
                v
    Hace click en "Ver documento"
                |
                v
    Modal con contenido completo + scroll
                |
                v
    Marca checkbox "He leido y comprendido"
                |
                v
    Click en "Acepto los terminos"
                |
                v
    Sistema captura:
    - content_hash del documento
    - employee_id
    - timestamp ISO
    - IP address
    - User agent
                |
                v
    Llamada POST a /acknowledge-document
                |
                v
    Edge function:
    1. Valida datos
    2. Genera signature_hash = SHA256(content_hash + employee_id + timestamp)
    3. Inserta en document_acknowledgments
    4. Llama a qtsp-notarize con signature_hash
    5. Espera token TSP (polling hasta 20s)
    6. Actualiza registro con qtsp_token y qtsp_timestamp
                |
                v
    Respuesta al frontend:
    {
      success: true,
      acknowledgment_id: "uuid",
      qtsp_token: "...",
      qtsp_timestamp: "2026-01-06T12:34:56Z"
    }
                |
                v
    Modal de confirmacion:
    "Documento aceptado correctamente"
    "Sellado QTSP: [token abreviado]"
    "Fecha: 06/01/2026 12:34"
```

---

## FASE 8: Archivos a Crear

| Archivo | Descripcion |
|---------|-------------|
| `src/lib/legalDocumentTemplates.ts` | 14 plantillas con textos completos |
| `src/pages/admin/LegalDocuments.tsx` | Gestion documentos legales |
| `src/pages/admin/DataRetention.tsx` | Configuracion retencion |
| `src/pages/admin/ContingencyRecords.tsx` | Registro contingencias |
| `src/pages/employee/LegalDocuments.tsx` | Documentos para empleado |
| `src/components/admin/LegalDocumentCard.tsx` | Card de documento |
| `src/components/admin/DocumentPreview.tsx` | Preview con campos |
| `src/components/admin/ContingencyForm.tsx` | Form transcripcion |
| `src/components/admin/PaperFormTemplate.tsx` | PDF parte papel |
| `src/components/employee/DocumentAcceptanceDialog.tsx` | Dialog aceptacion |
| `src/components/employee/QTSPAcceptanceBadge.tsx` | Badge sellado |
| `supabase/functions/acknowledge-document/index.ts` | Aceptacion QTSP |
| `supabase/functions/generate-legal-document/index.ts` | Generar PDF |
| `supabase/functions/data-retention-purge/index.ts` | Purga automatica |

---

## FASE 9: Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `supabase/functions/kiosk-clock/index.ts` | Anadir bloqueo por ausencia activa |
| `supabase/config.toml` | Registrar 3 nuevas edge functions |
| `src/components/layout/AppLayout.tsx` | Anadir navegacion admin |
| `src/components/layout/EmployeeLayout.tsx` | Anadir navegacion + badge |
| `src/App.tsx` | Anadir 4 nuevas rutas |

---

## Critical Files for Implementation

- `supabase/functions/kiosk-clock/index.ts` - Modificar linea ~410 para bloqueo ausencias
- `supabase/functions/qtsp-notarize/index.ts` - Referencia para integracion QTSP
- `src/integrations/supabase/types.ts` - Tipos existentes de tablas
- `src/pages/admin/Settings.tsx` - Patron para paginas de configuracion
- `src/pages/employee/Settings.tsx` - Patron para paginas de empleado
- `src/components/admin/AbsenceApprovalPanel.tsx` - Patron para paneles admin

---

## Orden de Implementacion Recomendado

1. **Migracion DB** - Crear 6 tablas con RLS
2. **Plantillas** - Crear legalDocumentTemplates.ts con los 14 documentos
3. **Bloqueo fichaje** - Modificar kiosk-clock (impacto inmediato)
4. **acknowledge-document** - Edge function para sellado QTSP
5. **Pagina admin LegalDocuments** - Gestion de documentos
6. **Pagina employee LegalDocuments** - Aceptacion con QTSP
7. **generate-legal-document** - Generacion de PDFs
8. **data-retention-purge** - Sistema de purga
9. **Pagina admin DataRetention** - Configuracion retencion
10. **Pagina admin ContingencyRecords** - Registro contingencias
11. **PDF parte contingencia** - Plantilla imprimible

---

## Metricas de Exito

- [ ] Todos los empleados activos tienen DOC-01, DOC-06, DOC-08 aceptados
- [ ] Aceptaciones selladas con token QTSP valido
- [ ] Bloqueo de fichaje funcionando para ausencias con blocks_clocking=true
- [ ] Sistema de purga ejecutandose sin errores
- [ ] Historico de purgas con evidencia de destruccion
- [ ] Registros de contingencia transcritos en menos de 48h
- [ ] Documentos descargables como PDF para ITSS
