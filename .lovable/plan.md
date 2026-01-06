# Plan: Prioridades Altas de Cumplimiento Legal

## Resumen Ejecutivo

Implementar las 4 prioridades altas de cumplimiento legal:
1. Sistema de retencion y purga automatica de 4 anos
2. Bloqueo de fichaje durante ausencias activas
3. Procedimiento de contingencias con registro en papel
4. Documentos de privacidad RGPD descargables

---

## DOCUMENTOS LEGALES REQUERIDOS

A continuacion se listan todos los documentos que debes entregarme en formato texto (Markdown o Word). Yo los convertire en plantillas PDF descargables con campos variables que se rellenaran automaticamente con los datos de cada empresa.

### CATEGORIA 1: Privacidad y Proteccion de Datos (RGPD)

#### DOC-01: Clausula de Informacion a Empleados sobre Control Horario
**Proposito:** Informar a empleados del tratamiento de sus datos de fichaje
**Contenido requerido:**
- Responsable del tratamiento (nombre, CIF, direccion, contacto DPD si aplica)
- Finalidades del tratamiento (registro jornada, cumplimiento ET, gestion RRHH)
- Base juridica (obligacion legal art. 34.9 ET, interes legitimo para gestion)
- Destinatarios de datos (Inspeccion de Trabajo, representantes legales, proveedores tecnologicos)
- Plazos de conservacion (4 anos para registros horarios)
- Derechos del interesado (acceso, rectificacion, supresion, oposicion, portabilidad)
- Procedimiento para ejercer derechos

**Campos variables a sustituir:**
- `{{EMPRESA_NOMBRE}}`
- `{{EMPRESA_CIF}}`
- `{{EMPRESA_DIRECCION}}`
- `{{EMPRESA_CIUDAD}}`
- `{{EMPRESA_CP}}`
- `{{FECHA_GENERACION}}`
- `{{EMAIL_CONTACTO_DPD}}` (opcional)

---

#### DOC-02: Clausula de Informacion sobre Gestion de Ausencias
**Proposito:** Informar del tratamiento de datos en solicitudes de permisos/vacaciones/bajas
**Contenido requerido:**
- Ampliacion de finalidades (gestion de ausencias, cumplimiento convenio)
- Categorias especiales de datos (datos de salud en bajas IT)
- Destinatarios adicionales (mutuas, Seguridad Social si aplica)
- Plazos diferenciados (4 anos general, 5 anos datos de salud si aplica por convenio)

**Campos variables adicionales:**
- `{{CONVENIO_APLICABLE}}` (si existe)
- `{{MUTUA_NOMBRE}}` (si aplica)

---

#### DOC-03: Politica de Retencion y Purga de Datos
**Proposito:** Documentar los plazos de conservacion y procedimientos de destruccion
**Contenido requerido:**
- Tabla de categorias de datos y plazos:
  - Registros de jornada: 4 anos
  - Solicitudes de ausencias: 4 anos desde cierre
  - Justificantes medicos: 5 anos
  - Logs de auditoria: 4 anos
  - Evidencias QTSP: 10 anos (o segun contrato QTSP)
- Procedimiento de purga automatica
- Evidencia de destruccion (log con hash)
- Excepciones (litigios pendientes, requerimientos abiertos)

**Campos variables:**
- `{{EMPRESA_NOMBRE}}`
- `{{FECHA_APROBACION}}`
- `{{RESPONSABLE_RRHH}}`

---

#### DOC-04: Registro de Actividades de Tratamiento (RAT) - Control Horario
**Proposito:** Cumplir art. 30 RGPD con registro interno de tratamientos
**Contenido requerido:**
- Nombre del tratamiento: "Control de Jornada y Tiempo de Trabajo"
- Responsable del tratamiento
- Categorias de interesados (empleados, trabajadores temporales)
- Categorias de datos personales (identificacion, fichajes, IP si aplica)
- Finalidades
- Base juridica
- Destinatarios
- Transferencias internacionales (si las hay)
- Plazos de supresion
- Medidas de seguridad (cifrado, RLS, 2FA)

**Campos variables:**
- `{{EMPRESA_NOMBRE}}`
- `{{EMPRESA_CIF}}`
- `{{DPD_NOMBRE}}` (si existe)
- `{{DPD_EMAIL}}` (si existe)
- `{{FECHA_ULTIMA_REVISION}}`

---

#### DOC-05: Registro de Actividades de Tratamiento (RAT) - Ausencias
**Proposito:** RAT especifico para gestion de ausencias (incluye datos de salud)
**Contenido adicional:**
- Categorias especiales de datos (salud)
- Medidas reforzadas para datos sensibles
- Acceso restringido a personal autorizado

---

### CATEGORIA 2: Normas Internas de Uso

#### DOC-06: Norma Interna de Uso del Sistema de Control Horario
**Proposito:** Establecer reglas de uso del sistema para empleados
**Contenido requerido:**
- Obligacion de fichar entrada, salida y pausas
- Puntos de fichaje autorizados (terminal kiosko, ubicacion)
- Prohibicion de prestamo/cesion de credenciales (QR/PIN)
- Procedimiento ante incidencias (olvidos, errores)
- Canal de solicitud de correcciones
- Procedimiento de contingencias (caida del sistema)
- Consecuencias del incumplimiento

**Campos variables:**
- `{{EMPRESA_NOMBRE}}`
- `{{UBICACION_TERMINALES}}`
- `{{EMAIL_INCIDENCIAS}}`
- `{{RESPONSABLE_CONTROL_HORARIO}}`
- `{{FECHA_ENTRADA_VIGOR}}`

---

#### DOC-07: Procedimiento de Contingencias (Registro en Papel)
**Proposito:** Protocolo cuando el sistema no esta disponible
**Contenido requerido:**
- Escenarios de contingencia (caida red, fallo terminal, corte electrico)
- Plantilla de parte en papel (campos: empleado, fecha, hora entrada, hora salida, pausas, firma)
- Responsable de custodia de partes en papel
- Plazo maximo para transcripcion al sistema (24-48h)
- Procedimiento de validacion y archivo
- Ubicacion de partes en papel de reserva

**Campos variables:**
- `{{EMPRESA_NOMBRE}}`
- `{{RESPONSABLE_CONTINGENCIAS}}`
- `{{UBICACION_PARTES_PAPEL}}`
- `{{PLAZO_TRANSCRIPCION_HORAS}}`

---

#### DOC-08: Acuse de Recibo de Credenciales (QR/PIN)
**Proposito:** Documentar entrega de credenciales al empleado
**Contenido requerido:**
- Datos del empleado receptor
- Tipo de credencial entregada
- Obligaciones de custodia
- Compromiso de no cesion
- Procedimiento de comunicacion de perdida/robo
- Firma del empleado

**Campos variables:**
- `{{EMPRESA_NOMBRE}}`
- `{{EMPLEADO_NOMBRE}}`
- `{{EMPLEADO_CODIGO}}`
- `{{TIPO_CREDENCIAL}}`
- `{{FECHA_ENTREGA}}`

---

### CATEGORIA 3: Documentos de Cumplimiento Laboral

#### DOC-09: Manual de Control Horario (Extracto para ITSS)
**Proposito:** Documento resumido para presentar ante Inspeccion de Trabajo
**Contenido requerido:**
- Descripcion del sistema de registro
- Metodos de fichaje disponibles
- Garantias de inalterabilidad (hash chain, QTSP)
- Plazos de conservacion
- Procedimiento de acceso a registros
- Formato de exportacion disponible
- Contacto del responsable

**Campos variables:**
- `{{EMPRESA_NOMBRE}}`
- `{{EMPRESA_CIF}}`
- `{{SISTEMA_NOMBRE}}` (Time Control Hub)
- `{{QTSP_PROVEEDOR}}`
- `{{RESPONSABLE_NOMBRE}}`
- `{{RESPONSABLE_CONTACTO}}`

---

#### DOC-10: Politica de Gestion de Ausencias, Permisos y Vacaciones
**Proposito:** Documentar el procedimiento de solicitud y aprobacion
**Contenido requerido:**
- Catalogo de tipos de ausencia (referencia a configuracion del sistema)
- Procedimiento de solicitud (canales, plazos de preaviso)
- Flujo de aprobacion (responsable directo, RRHH)
- Documentacion justificativa requerida por tipo
- Plazos de resolucion (SLA)
- Impacto en control horario
- Reglas de no solapamiento
- Derechos de vacaciones y calculo

**Campos variables:**
- `{{EMPRESA_NOMBRE}}`
- `{{CONVENIO_APLICABLE}}`
- `{{DIAS_VACACIONES_ANUALES}}`
- `{{EMAIL_SOLICITUDES}}`
- `{{RESPONSABLE_RRHH}}`

---

#### DOC-11: Calendario Laboral Anual
**Proposito:** Documento oficial del calendario laboral del centro
**Contenido requerido:**
- Ano aplicable
- Centro de trabajo
- Dias festivos nacionales
- Dias festivos autonomicos
- Dias festivos locales
- Horario general (si aplica)
- Periodos de cierre (si aplica)
- Firma del responsable

**Campos variables:**
- `{{EMPRESA_NOMBRE}}`
- `{{CENTRO_TRABAJO}}`
- `{{ANO}}`
- `{{FESTIVOS_NACIONALES}}` (lista)
- `{{FESTIVOS_AUTONOMICOS}}` (lista)
- `{{FESTIVOS_LOCALES}}` (lista)
- `{{FECHA_PUBLICACION}}`

---

### CATEGORIA 4: Contratos y Encargos de Tratamiento

#### DOC-12: Clausula de Encargo de Tratamiento (Plantilla Generica)
**Proposito:** Plantilla para contratos con proveedores tecnologicos
**Contenido requerido:**
- Identificacion de las partes
- Objeto del encargo
- Duracion
- Naturaleza y finalidad del tratamiento
- Tipo de datos personales
- Categorias de interesados
- Obligaciones del encargado (art. 28 RGPD)
- Subencargados autorizados
- Transferencias internacionales
- Medidas de seguridad
- Devolucion/destruccion al finalizar
- Auditoria

**Campos variables:**
- `{{EMPRESA_NOMBRE}}` (responsable)
- `{{PROVEEDOR_NOMBRE}}` (encargado)
- `{{SERVICIOS_CONTRATADOS}}`
- `{{FECHA_CONTRATO}}`

---

### CATEGORIA 5: Documentos para Empleados

#### DOC-13: Guia Rapida del Empleado - Sistema de Fichaje
**Proposito:** Manual sencillo de uso para empleados
**Contenido requerido:**
- Como fichar (QR, PIN)
- Como consultar mis fichajes
- Como solicitar una correccion
- Como solicitar vacaciones/permisos
- Como firmar el cierre mensual
- Preguntas frecuentes
- Contacto de soporte

**Campos variables:**
- `{{EMPRESA_NOMBRE}}`
- `{{URL_PORTAL_EMPLEADO}}`
- `{{EMAIL_SOPORTE}}`

---

#### DOC-14: Consentimiento para Comunicaciones Electronicas
**Proposito:** Obtener consentimiento para notificaciones por email/app
**Contenido requerido:**
- Tipos de comunicaciones (alertas, recordatorios, aprobaciones)
- Canales (email, app, SMS si aplica)
- Derecho a revocar
- Ventanas de silencio (desconexion digital)

**Campos variables:**
- `{{EMPRESA_NOMBRE}}`
- `{{EMPLEADO_NOMBRE}}`
- `{{FECHA}}`

---

## ESTRUCTURA DE IMPLEMENTACION

### Fase 1: Base de Datos y Almacenamiento

#### 1.1 Nueva tabla `legal_documents`
```sql
CREATE TABLE legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES company(id),
  document_type TEXT NOT NULL, -- 'privacy_clause', 'internal_rules', etc.
  document_code TEXT NOT NULL, -- 'DOC-01', 'DOC-02', etc.
  title TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  content_template TEXT NOT NULL, -- Markdown con placeholders
  generated_content TEXT, -- Contenido final generado
  generated_pdf_path TEXT, -- Ruta en storage
  status TEXT DEFAULT 'draft', -- 'draft', 'active', 'archived'
  effective_from DATE,
  effective_to DATE,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### 1.2 Nueva tabla `document_acknowledgments`
```sql
CREATE TABLE document_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES legal_documents(id),
  employee_id UUID REFERENCES employees(id),
  acknowledged_at TIMESTAMPTZ DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  signature_hash TEXT -- Hash de la firma digital si aplica
);
```

#### 1.3 Nueva tabla `data_retention_config`
```sql
CREATE TABLE data_retention_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES company(id),
  data_category TEXT NOT NULL, -- 'time_events', 'absences', 'audit_log', etc.
  retention_years INTEGER NOT NULL DEFAULT 4,
  retention_reason TEXT,
  purge_enabled BOOLEAN DEFAULT true,
  last_purge_at TIMESTAMPTZ,
  next_purge_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### 1.4 Nueva tabla `data_purge_log`
```sql
CREATE TABLE data_purge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES company(id),
  data_category TEXT NOT NULL,
  records_purged INTEGER,
  date_range_start DATE,
  date_range_end DATE,
  purged_at TIMESTAMPTZ DEFAULT now(),
  purged_by TEXT, -- 'system' o user_id
  integrity_hash TEXT, -- Hash de los datos purgados como evidencia
  qtsp_evidence_id UUID -- Referencia a evidencia QTSP si se sella
);
```

### Fase 2: Sistema de Retencion y Purga (4 anos)

#### 2.1 Edge Function `data-retention-purge`
- Ejecutar diariamente via cron
- Para cada empresa con purge_enabled:
  - Calcular fecha limite (hoy - retention_years)
  - Seleccionar registros a purgar por categoria
  - Generar hash de integridad del conjunto
  - Crear evidencia de destruccion
  - Ejecutar DELETE
  - Registrar en data_purge_log
  - Opcionalmente sellar con QTSP

#### 2.2 Pagina de configuracion de retencion
- Admin Settings > Retencion de Datos
- Mostrar categorias y plazos configurados
- Permitir ver historico de purgas
- Mostrar proxima purga programada

### Fase 3: Bloqueo de Fichaje durante Ausencias

#### 3.1 Modificar Edge Function `kiosk-clock`
- Antes de registrar fichaje, verificar:
  ```sql
  SELECT * FROM absence_requests
  WHERE employee_id = $1
    AND status = 'approved'
    AND blocks_clocking = true
    AND start_date <= CURRENT_DATE
    AND end_date >= CURRENT_DATE
  ```
- Si existe ausencia activa con blocks_clocking=true:
  - Rechazar fichaje con mensaje descriptivo
  - Registrar intento en audit_log

#### 3.2 Actualizar tabla absence_types
- Verificar que `blocks_clocking` existe y esta configurado:
  - IT (baja medica): blocks_clocking = true
  - Vacaciones: blocks_clocking = true
  - Permiso por horas: blocks_clocking = false
  - etc.

### Fase 4: Procedimiento de Contingencias

#### 4.1 Nueva tabla `contingency_records`
```sql
CREATE TABLE contingency_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES company(id),
  employee_id UUID REFERENCES employees(id),
  contingency_date DATE NOT NULL,
  entry_time TIME,
  exit_time TIME,
  break_minutes INTEGER,
  reason TEXT, -- 'network_failure', 'power_outage', 'terminal_failure'
  notes TEXT,
  paper_form_path TEXT, -- Scan del parte en papel si existe
  transcribed_by UUID, -- Quien lo transcribio
  transcribed_at TIMESTAMPTZ,
  validated_by UUID,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### 4.2 Pagina de registro de contingencias
- Admin > Registros > Contingencias
- Formulario para transcribir partes en papel:
  - Seleccionar empleado
  - Fecha de la contingencia
  - Horas (entrada, salida, pausas)
  - Motivo de la contingencia
  - Notas adicionales
  - Opcion de adjuntar scan del parte
- Al guardar: crear time_events correspondientes marcados como source='manual_contingency'

#### 4.3 Plantilla PDF de parte en papel
- Generar PDF descargable con campos:
  - Logo empresa
  - Fecha
  - Nombre empleado / Codigo
  - Hora entrada (campo para escribir)
  - Hora salida (campo para escribir)
  - Pausas (campo para escribir)
  - Firma empleado
  - Firma responsable

### Fase 5: Documentos RGPD Descargables

#### 5.1 Pagina de gestion de documentos legales
- Admin > Configuracion > Documentos Legales
- Listar documentos disponibles por categoria
- Para cada documento:
  - Ver preview con datos de la empresa
  - Descargar PDF
  - Ver historial de versiones
  - Registrar quien descargo/consulto

#### 5.2 Edge Function `generate-legal-document`
- Recibir: document_code, company_id
- Cargar plantilla del documento
- Sustituir placeholders con datos de company
- Generar PDF usando jspdf
- Guardar en storage
- Devolver URL de descarga

#### 5.3 Seeder de plantillas por defecto
- Al crear empresa, insertar en legal_documents las plantillas base
- Marcar como 'draft' hasta que el admin las revise y active

---

## ARCHIVOS A CREAR/MODIFICAR

### Nuevos archivos:
1. `supabase/functions/data-retention-purge/index.ts`
2. `supabase/functions/generate-legal-document/index.ts`
3. `src/pages/admin/LegalDocuments.tsx`
4. `src/pages/admin/DataRetention.tsx`
5. `src/pages/admin/ContingencyRecords.tsx`
6. `src/components/admin/LegalDocumentCard.tsx`
7. `src/components/admin/ContingencyForm.tsx`
8. `src/components/admin/PaperFormTemplate.tsx`
9. `src/lib/documentTemplates.ts` - Plantillas en formato Markdown

### Archivos a modificar:
1. `supabase/functions/kiosk-clock/index.ts` - Anadir verificacion de ausencias
2. `src/components/layout/AppLayout.tsx` - Anadir enlaces de navegacion
3. `src/App.tsx` - Anadir rutas
4. `supabase/config.toml` - Anadir nuevas edge functions

---

## FLUJO DE TRABAJO RECOMENDADO

1. **Tu me proporcionas** los textos de los documentos DOC-01 a DOC-14 (o los que apliquen)
2. **Yo los convierto** en plantillas con placeholders
3. **Implemento** el sistema de generacion automatica
4. **El admin de cada empresa** revisa, personaliza si es necesario, y activa los documentos
5. **Los empleados** pueden consultar y firmar acuse de recibo de los documentos que les apliquen

---

## CAMPOS VARIABLES DISPONIBLES (desde datos existentes)

| Placeholder | Fuente | Tabla |
|-------------|--------|-------|
| `{{EMPRESA_NOMBRE}}` | company.name | company |
| `{{EMPRESA_CIF}}` | company.cif | company |
| `{{EMPRESA_DIRECCION}}` | company.address | company |
| `{{EMPRESA_CIUDAD}}` | company.city | company |
| `{{EMPRESA_CP}}` | company.postal_code | company |
| `{{FECHA_GENERACION}}` | now() | sistema |
| `{{ANO_ACTUAL}}` | year(now()) | sistema |
| `{{EMPLEADO_NOMBRE}}` | employees.first_name + last_name | employees |
| `{{EMPLEADO_CODIGO}}` | employees.employee_code | employees |
| `{{TERMINAL_NOMBRE}}` | terminals.name | terminals |
| `{{TERMINAL_UBICACION}}` | terminals.location | terminals |

### Campos a anadir en company_settings:
- `email_dpd` - Email del DPD si existe
- `nombre_dpd` - Nombre del DPD
- `responsable_rrhh` - Nombre del responsable de RRHH
- `email_incidencias` - Email para incidencias de fichaje
- `convenio_aplicable` - Convenio colectivo aplicable
- `mutua_nombre` - Nombre de la mutua
- `plazo_transcripcion_contingencias` - Horas para transcribir partes en papel

---

## RESUMEN DE DOCUMENTOS A ENTREGAR

| Codigo | Documento | Prioridad |
|--------|-----------|-----------|
| DOC-01 | Clausula informacion empleados - Control Horario | ALTA |
| DOC-02 | Clausula informacion empleados - Ausencias | ALTA |
| DOC-03 | Politica de retencion y purga | ALTA |
| DOC-06 | Norma interna de uso del sistema | ALTA |
| DOC-07 | Procedimiento de contingencias | ALTA |
| DOC-08 | Acuse de recibo de credenciales | ALTA |
| DOC-09 | Manual de control horario (ITSS) | ALTA |
| DOC-04 | RAT - Control Horario | MEDIA |
| DOC-05 | RAT - Ausencias | MEDIA |
| DOC-10 | Politica de ausencias y vacaciones | MEDIA |
| DOC-11 | Calendario laboral anual | MEDIA |
| DOC-12 | Clausula encargo de tratamiento | BAJA |
| DOC-13 | Guia rapida del empleado | BAJA |
| DOC-14 | Consentimiento comunicaciones | BAJA |

**Recomendacion:** Empieza por los documentos de prioridad ALTA. Yo puedo generar borradores iniciales basados en modelos estandar espanoles si prefieres partir de una base.
