// Legal Document Templates for Spanish PYME compliance
// These templates contain variable fields marked with {{FIELD_NAME}} that will be replaced with company data

export interface LegalDocumentTemplate {
  code: string;
  name: string;
  category: 'privacy' | 'internal_rules' | 'labor_compliance' | 'contracts' | 'employee_docs';
  description: string;
  requiresEmployeeAcceptance: boolean;
  priority: 'high' | 'medium' | 'low';
  variableFields: string[];
  contentMarkdown: string;
}

export const LEGAL_DOCUMENT_TEMPLATES: LegalDocumentTemplate[] = [
  // ==================== CATEGORY 1: Privacy and Data Protection (GDPR) ====================
  {
    code: 'DOC-01',
    name: 'Cláusula de Información a Empleados sobre Control Horario',
    category: 'privacy',
    description: 'Informar a la plantilla del tratamiento de datos de fichaje y registro de jornada',
    requiresEmployeeAcceptance: true,
    priority: 'high',
    variableFields: ['EMPRESA_NOMBRE', 'EMPRESA_CIF', 'EMPRESA_DIRECCION', 'EMPRESA_CIUDAD', 'EMPRESA_CP', 'EMAIL_CONTACTO_DPD', 'CONTACTO_PRIVACIDAD', 'PROVEEDOR_PLATAFORMA', 'QTSP_NOMBRE', 'FECHA_GENERACION'],
    contentMarkdown: `# CLÁUSULA INFORMATIVA SOBRE CONTROL HORARIO (RGPD/LOPDGDD)

**Responsable del tratamiento:** {{EMPRESA_NOMBRE}}, con CIF {{EMPRESA_CIF}} y domicilio en {{EMPRESA_DIRECCION}}, {{EMPRESA_CIUDAD}} ({{EMPRESA_CP}}). Contacto de privacidad/DPD: {{CONTACTO_PRIVACIDAD}} {{EMAIL_CONTACTO_DPD}}.

## Finalidades:

- Registrar diariamente el inicio y fin de la jornada, y, en su caso, pausas, para el cumplimiento de obligaciones legales y laborales.
- Facilitar el acceso a la Inspección de Trabajo y a las personas trabajadoras a sus registros.
- Gestionar incidencias, correcciones y auditoría interna del sistema.

## Base jurídica:

- Cumplimiento de obligación legal (Estatuto de los Trabajadores, registro diario de jornada).
- Interés legítimo en la organización y seguridad del sistema (trazabilidad y antifraude), ponderado y proporcional.

## Datos tratados:

- Identificativos y profesionales (nombre, identificador interno, centro).
- Eventos de fichaje (fecha/hora, tipo de evento, terminal, factor de autenticación QR/PIN).
- Trazabilidad técnica (logs, integridad, huellas criptográficas). **No se tratan datos biométricos ni de geolocalización.**

## Destinatarios:

- Inspección de Trabajo y Seguridad Social, cuando sea requerido.
- Representación legal de las personas trabajadoras, en los términos legales.
- Encargados de tratamiento que prestan servicios tecnológicos (p. ej., {{PROVEEDOR_PLATAFORMA}}) y servicios de confianza cualificados ({{QTSP_NOMBRE}}), con contratos de encargo.

## Conservación:

- Registros de jornada: **4 años**.
- Logs y evidencias de integridad asociados: por el mismo plazo o el que resulte de las obligaciones legales y de auditoría.

## Derechos:

- Puede ejercer acceso, rectificación, supresión, limitación, oposición y demás derechos aplicables dirigiéndose a {{CONTACTO_PRIVACIDAD}}.
- Tiene derecho a presentar reclamación ante la autoridad de control competente.

## Información adicional:

El sistema utiliza un terminal fijo en modo kiosco; no se exige el uso de dispositivos personales. No se efectúa perfilado.

---

*Fecha de emisión: {{FECHA_GENERACION}}*`
  },
  {
    code: 'DOC-02',
    name: 'Cláusula de Información sobre Gestión de Ausencias',
    category: 'privacy',
    description: 'Informar del tratamiento de datos en vacaciones, permisos y bajas (incluidos datos de salud en IT)',
    requiresEmployeeAcceptance: true,
    priority: 'high',
    variableFields: ['EMPRESA_NOMBRE', 'EMPRESA_CIF', 'EMPRESA_DIRECCION', 'CONTACTO_PRIVACIDAD', 'EMAIL_CONTACTO_DPD', 'PROVEEDOR_PLATAFORMA', 'FECHA_GENERACION'],
    contentMarkdown: `# CLÁUSULA INFORMATIVA SOBRE GESTIÓN DE AUSENCIAS (VACACIONES, PERMISOS, BAJAS)

**Responsable:** {{EMPRESA_NOMBRE}} (CIF {{EMPRESA_CIF}}), {{EMPRESA_DIRECCION}}. Contacto de privacidad: {{CONTACTO_PRIVACIDAD}} {{EMAIL_CONTACTO_DPD}}.

## Finalidades:

- Gestionar solicitudes y disfrute de vacaciones y permisos.
- Tramitar ausencias por incapacidad temporal (IT) y otras suspensiones, conforme a ley y convenio.
- Acreditar, planificar y justificar ausencias a efectos laborales y de cumplimiento.

## Bases jurídicas:

- Ejecución del contrato de trabajo y cumplimiento de obligaciones legales y convencionales.
- Interés legítimo en la organización del trabajo y cobertura operativa.
- En datos de salud (IT): cumplimiento de obligaciones en materia de Seguridad Social y prevención de riesgos; tratamiento limitado al mínimo necesario.

## Datos tratados:

- Identificativos y profesionales.
- Datos de solicitud (tipo de permiso/ausencia, fechas, motivo).
- Documentación justificativa (p. ej., partes de baja/alta). En su caso, datos de salud, tratados con especial confidencialidad.

## Destinatarios:

- Mutua colaboradora/INSS y Seguridad Social, cuando proceda.
- Proveedores tecnológicos ({{PROVEEDOR_PLATAFORMA}}) en calidad de encargados de tratamiento.

## Conservación:

- Solicitudes y resoluciones: **4 años** desde cierre del expediente/periodo.
- Documentos con datos de salud: hasta **5 años** o el plazo estrictamente necesario según obligación legal y prescripción de responsabilidades, aplicando minimización.

## Derechos:

Puede ejercer sus derechos RGPD en {{CONTACTO_PRIVACIDAD}} y reclamar ante la autoridad de control.

## Información adicional:

Se aplican medidas de seguridad reforzadas y acceso restringido a datos de salud. No se usan datos para finalidades incompatibles ni se realiza perfilado.

---

*Fecha de emisión: {{FECHA_GENERACION}}*`
  },
  {
    code: 'DOC-03',
    name: 'Política de Retención y Purga de Datos',
    category: 'privacy',
    description: 'Definir plazos, procedimientos de purga y evidencias de destrucción',
    requiresEmployeeAcceptance: false,
    priority: 'high',
    variableFields: ['EMPRESA_NOMBRE', 'RESPONSABLE_CUMPLIMIENTO', 'CONTACTO_PRIVACIDAD', 'QTSP_NOMBRE', 'FECHA_GENERACION'],
    contentMarkdown: `# POLÍTICA DE RETENCIÓN Y PURGA DE DATOS

## Objeto y alcance

Esta política establece los plazos de conservación y los procedimientos de purga segura de los datos tratados por {{EMPRESA_NOMBRE}} en materia de control horario, ausencias y documentación de soporte.

## Plazos de conservación

| Categoría de datos | Plazo de retención |
|-------------------|-------------------|
| Registros de jornada | 4 años |
| Solicitudes de ausencias y resoluciones | 4 años desde su cierre |
| Justificantes médicos/IT | Hasta 5 años, o el plazo estrictamente necesario según obligaciones legales |
| Logs de auditoría del sistema | 4 años |
| Evidencias QTSP (sellos de tiempo y referencias) | 10 años o el plazo contractual con {{QTSP_NOMBRE}}, lo que sea mayor |
| Documentación de políticas y manuales | Mientras estén vigentes y 5 años adicionales tras su sustitución |

## Purga automatizada y segura

- Se ejecuta un proceso de revisión mensual que identifica elementos con plazo vencido.
- La purga se realiza mediante borrado seguro y, cuando aplique, sobreescritura o eliminación criptográfica.
- Se excluyen de purga los datos sujetos a bloqueo por litigios, auditorías o requerimientos abiertos.

## Evidencias de destrucción

Se genera un log de purga con:
- Identificador de dataset/documento
- Fecha y hora
- Responsable/tarea automatizada
- Algoritmo
- Huella (hash) previa a la eliminación

Los logs de purga se conservan por **4 años**.

## Responsabilidades y revisión

- **Responsable de cumplimiento:** {{RESPONSABLE_CUMPLIMIENTO}}
- Revisión anual de la política o cuando cambie el marco legal.
- **Contacto de privacidad:** {{CONTACTO_PRIVACIDAD}}

---

*Fecha de emisión: {{FECHA_GENERACION}}*`
  },
  {
    code: 'DOC-04',
    name: 'Registro de Actividades de Tratamiento (RAT) – Control Horario',
    category: 'privacy',
    description: 'Cumplir el art. 30 RGPD para el tratamiento "Control Horario"',
    requiresEmployeeAcceptance: false,
    priority: 'medium',
    variableFields: ['EMPRESA_NOMBRE', 'EMPRESA_CIF', 'EMPRESA_DIRECCION', 'CONTACTO_PRIVACIDAD', 'PROVEEDOR_PLATAFORMA', 'QTSP_NOMBRE', 'FECHA_GENERACION'],
    contentMarkdown: `# REGISTRO DE ACTIVIDADES DE TRATAMIENTO (RAT)

## Tratamiento: Control de Jornada/Registro Horario

| Campo | Valor |
|-------|-------|
| **Responsable** | {{EMPRESA_NOMBRE}} ({{EMPRESA_CIF}}), {{EMPRESA_DIRECCION}} |
| **Finalidad** | Registrar inicio/fin de jornada y, en su caso, pausas, para cumplimiento legal, acceso de la ITSS y de las personas trabajadoras, y gestión de incidencias |
| **Categorías de interesados** | Personas trabajadoras y asimiladas |
| **Categorías de datos** | Identificativos básicos; datos de fichaje (fecha/hora, terminal, factor autenticación); trazabilidad técnica; correcciones (motivo y aprobación) |
| **Base jurídica** | Obligación legal (registro diario de jornada); interés legítimo (trazabilidad antifraude) |
| **Destinatarios** | ITSS; representantes legales; encargados ({{PROVEEDOR_PLATAFORMA}}, {{QTSP_NOMBRE}}) |
| **Transferencias** | No se prevén fuera del EEE. Si existieran, se documentarán garantías adecuadas |
| **Plazos** | 4 años (registros horarios) y plazos asociados a logs/evidencias indicados en la política de retención |

## Medidas técnicas y organizativas

- Control de acceso y RLS
- 2FA para administradores
- Cifrado en tránsito y reposo
- Encadenado hash/Merkle con evidencias de tiempo cualificadas
- Auditoría de exportaciones
- Minimización (sin biometría ni geolocalización)

---

*Fecha de emisión: {{FECHA_GENERACION}}*`
  },
  {
    code: 'DOC-05',
    name: 'Registro de Actividades de Tratamiento (RAT) – Gestión de Ausencias',
    category: 'privacy',
    description: 'RAT específico para vacaciones, permisos y bajas (incluye datos de salud)',
    requiresEmployeeAcceptance: false,
    priority: 'medium',
    variableFields: ['EMPRESA_NOMBRE', 'EMPRESA_CIF', 'EMPRESA_DIRECCION', 'CONTACTO_PRIVACIDAD', 'PROVEEDOR_PLATAFORMA', 'FECHA_GENERACION'],
    contentMarkdown: `# REGISTRO DE ACTIVIDADES DE TRATAMIENTO (RAT)

## Tratamiento: Gestión de Ausencias, Vacaciones y Bajas

| Campo | Valor |
|-------|-------|
| **Responsable** | {{EMPRESA_NOMBRE}} ({{EMPRESA_CIF}}), {{EMPRESA_DIRECCION}} |
| **Finalidad** | Tramitación y control de vacaciones, permisos y suspensiones; planificación de recursos; cumplimiento de convenios y Seguridad Social |
| **Categorías de interesados** | Personas trabajadoras |
| **Categorías de datos** | Identificativos; tipo de ausencia; fechas; justificantes; en su caso, datos de salud (IT) estrictamente necesarios |
| **Base jurídica** | Ejecución del contrato; cumplimiento de obligaciones legales/convencionales; en datos de salud, cumplimiento de Seguridad Social y PRL; interés público en salud laboral (limitado) |
| **Destinatarios** | Mutuas, INSS/Seguridad Social (cuando proceda); encargados ({{PROVEEDOR_PLATAFORMA}}) |
| **Transferencias** | No previstas fuera del EEE sin garantías |
| **Plazos** | 4 años (solicitudes/resoluciones) y hasta 5 años para soportes con datos de salud, aplicando minimización |

## Medidas

- Acceso restringido
- Registros y documentación segregados
- Cifrado
- Políticas de conservación diferenciadas
- Trazabilidad de accesos

---

*Fecha de emisión: {{FECHA_GENERACION}}*`
  },

  // ==================== CATEGORY 2: Internal Use Rules ====================
  {
    code: 'DOC-06',
    name: 'Norma Interna de Uso del Sistema de Control Horario',
    category: 'internal_rules',
    description: 'Establecer reglas de uso del sistema por parte de la plantilla',
    requiresEmployeeAcceptance: true,
    priority: 'high',
    variableFields: ['EMPRESA_NOMBRE', 'CENTRO_NOMBRE', 'UBICACION_TERMINAL', 'CANAL_CORRECCIONES', 'PLAZO_CORRECCIONES_HORAS', 'FECHA_GENERACION'],
    contentMarkdown: `# NORMA INTERNA DE USO DEL SISTEMA DE CONTROL HORARIO

## 1. Obligación de registro

Toda persona trabajadora de {{EMPRESA_NOMBRE}} debe registrar su hora de entrada y salida, y, en su caso, las pausas, mediante el terminal habilitado.

## 2. Punto de fichaje autorizado

El fichaje se realiza exclusivamente en el terminal en modo kiosco situado en **{{UBICACION_TERMINAL}}** del **{{CENTRO_NOMBRE}}**. No se admiten fichajes remotos.

## 3. Credenciales personales

Las credenciales (QR y/o PIN) son **personales e intransferibles**. Queda prohibido su préstamo, cesión o uso por terceros.

## 4. Incidencias y correcciones

Los olvidos o errores deberán comunicarse a través de **{{CANAL_CORRECCIONES}}** en un plazo máximo de **{{PLAZO_CORRECCIONES_HORAS}} horas**, indicando motivo y, en su caso, aportando justificante.

## 5. Contingencias

En caso de indisponibilidad del sistema (caída de red/terminal), se utilizará el parte en papel y se transcribirá posteriormente conforme al procedimiento de contingencias.

## 6. Consecuencias

El incumplimiento de estas normas, el falseamiento de registros o la cesión de credenciales podrá dar lugar a medidas disciplinarias conforme a la normativa aplicable.

---

*Fecha de emisión: {{FECHA_GENERACION}}*`
  },
  {
    code: 'DOC-07',
    name: 'Procedimiento de Contingencias (Registro en Papel)',
    category: 'internal_rules',
    description: 'Fijar el protocolo cuando el sistema no esté disponible',
    requiresEmployeeAcceptance: true,
    priority: 'high',
    variableFields: ['CENTRO_NOMBRE', 'RESPONSABLE_CUSTODIA', 'LUGAR_ARCHIVO_PARTES', 'PLAZO_TRANSCRIPCION_HORAS', 'FECHA_GENERACION'],
    contentMarkdown: `# PROCEDIMIENTO DE CONTINGENCIAS – REGISTRO EN PAPEL

## 1. Escenarios

Se activará este procedimiento ante: caída de red, fallo del terminal, corte eléctrico o cualquier imposibilidad material de fichar.

## 2. Parte en papel

Se utilizará el parte oficial de contingencia, con los campos:
- Nombre y apellidos
- DNI/NIE
- Fecha
- Hora de entrada
- Pausas (si procede)
- Hora de salida
- Firma del empleado y del responsable

## 3. Custodia

El responsable de custodia es **{{RESPONSABLE_CUSTODIA}}**. Los partes se guardarán en **{{LUGAR_ARCHIVO_PARTES}}** bajo llave hasta su transcripción.

## 4. Transcripción y validación

Los partes se transcribirán al sistema en un plazo máximo de **{{PLAZO_TRANSCRIPCION_HORAS}} horas** desde el restablecimiento del servicio. La transcripción será revisada y validada por la persona responsable y quedará auditada.

## 5. Archivo

Una vez transcritos, los partes en papel se conservarán el plazo previsto en la política de retención y, llegado su término, se destruirán con evidencia de eliminación.

---

## Plantilla de parte (campos mínimos):

| Campo | Valor |
|-------|-------|
| Empleado | _________________________ |
| DNI/NIE | _________________________ |
| Fecha | ____/____/________ |
| Entrada | ____:____ |
| Pausa inicio | ____:____ |
| Pausa fin | ____:____ |
| Salida | ____:____ |
| Firma trabajador/a | _________________________ |
| Firma responsable | _________________________ |

---

*Fecha de emisión: {{FECHA_GENERACION}}*`
  },
  {
    code: 'DOC-08',
    name: 'Acuse de Recibo de Credenciales (QR/PIN)',
    category: 'internal_rules',
    description: 'Acreditar la entrega y compromisos de custodia de QR/PIN',
    requiresEmployeeAcceptance: true,
    priority: 'high',
    variableFields: ['EMPRESA_NOMBRE', 'EMPLEADO_NOMBRE', 'EMPLEADO_DNI', 'FECHA_ENTREGA', 'TIPO_CREDENCIAL', 'CANAL_AVISO_PERDIDA', 'FECHA_GENERACION'],
    contentMarkdown: `# ACUSE DE RECIBO DE CREDENCIALES DE CONTROL HORARIO

En **{{EMPRESA_NOMBRE}}**, a **{{FECHA_ENTREGA}}**, yo, **{{EMPLEADO_NOMBRE}}** con DNI/NIE **{{EMPLEADO_DNI}}**, declaro haber recibido la/s siguiente/s credencial/es de control horario: **{{TIPO_CREDENCIAL}}** (QR y/o PIN).

## Me comprometo a:

1. **Custodiar** mis credenciales y no cederlas ni permitir su uso por terceros.
2. **Comunicar de inmediato** su pérdida o sustracción a través de **{{CANAL_AVISO_PERDIDA}}** para su revocación y sustitución.
3. **Usar el sistema** conforme a la norma interna de uso.

---

| | |
|---|---|
| **Firma del empleado/a:** | ______________________________ |
| **Firma de la empresa:** | ______________________________ |

---

*Fecha de emisión: {{FECHA_GENERACION}}*`
  },

  // ==================== CATEGORY 3: Labor Compliance Documents ====================
  {
    code: 'DOC-09',
    name: 'Manual de Control Horario (Extracto para ITSS)',
    category: 'labor_compliance',
    description: 'Documento resumido del sistema para Inspección de Trabajo',
    requiresEmployeeAcceptance: false,
    priority: 'high',
    variableFields: ['EMPRESA_NOMBRE', 'DESCRIPCION_TERMINAL', 'FORMATO_EXPORT', 'CONTACTO_ITSS', 'QTSP_NOMBRE', 'FECHA_GENERACION'],
    contentMarkdown: `# MANUAL DE CONTROL HORARIO – EXTRACTO PARA INSPECCIÓN DE TRABAJO

## 1. Descripción del sistema

{{EMPRESA_NOMBRE}} utiliza un sistema de registro de jornada basado en terminal fijo en modo kiosco (**{{DESCRIPCION_TERMINAL}}**). La identificación se realiza mediante QR, PIN o ambos según política. **No se emplea biometría ni geolocalización.**

## 2. Inalterabilidad y trazabilidad

- Los registros se sellan con hora de servidor
- Cada evento se encadena criptográficamente (hash chain)
- Se agregan raíces diarias (árbol de Merkle)
- Las evidencias de tiempo son emitidas por un prestador cualificado (**{{QTSP_NOMBRE}}**)

## 3. Conservación y acceso

Los registros se conservan **4 años** y están disponibles para su acceso inmediato en el centro y para las personas trabajadoras que lo soliciten.

## 4. Exportaciones

El sistema permite exportar en **{{FORMATO_EXPORT}}** y generar un paquete probatorio con manifiesto e identificación de evidencias.

## 5. Correcciones

Cualquier corrección se realiza mediante flujo aprobado, con preservación del asiento original y registro de:
- Motivo
- Fecha
- Aprobador

## 6. Contacto para inspección

**{{CONTACTO_ITSS}}**

---

*Fecha de emisión: {{FECHA_GENERACION}}*`
  },
  {
    code: 'DOC-10',
    name: 'Política de Gestión de Ausencias, Permisos y Vacaciones',
    category: 'labor_compliance',
    description: 'Procedimiento de solicitud, aprobación, documentación y planificación',
    requiresEmployeeAcceptance: true,
    priority: 'medium',
    variableFields: ['CANAL_SOLICITUD_AUSENCIAS', 'SLA_APROBACION_HORAS', 'REGLA_SOLAPES', 'CONTACTO_RRHH', 'FECHA_GENERACION'],
    contentMarkdown: `# POLÍTICA DE GESTIÓN DE AUSENCIAS, PERMISOS Y VACACIONES

## 1. Alcance y catálogo

Se aplican los permisos y ausencias previstos en la ley y en el convenio aplicable, así como vacaciones anuales según condiciones vigentes. El catálogo detallado y parámetros (duración, cómputo, justificante) se publica en la consola de RR. HH.

## 2. Solicitud y canal

Las solicitudes se realizan a través de **{{CANAL_SOLICITUD_AUSENCIAS}}**, indicando tipo, fechas y, en su caso, justificante.

## 3. Aprobación y plazos

El plazo estándar de resolución es de **{{SLA_APROBACION_HORAS}} horas** salvo causa justificada. Las solicitudes de vacaciones se realizan con antelación suficiente, conforme a la planificación anual.

## 4. Documentación

Los permisos tasados requieren acreditación específica; los datos de salud (IT) se tratan con especial confidencialidad y acceso restringido.

## 5. Planificación y solapes

Se evitarán solapes críticos conforme a **{{REGLA_SOLAPES}}** para garantizar la cobertura operativa mínima.

## 6. Integración con control horario

Las ausencias aprobadas se integran en el sistema de control horario para evitar incidencias injustificadas de fichaje.

## 7. Contacto

**{{CONTACTO_RRHH}}**

---

*Fecha de emisión: {{FECHA_GENERACION}}*`
  },
  {
    code: 'DOC-11',
    name: 'Calendario Laboral Anual',
    category: 'labor_compliance',
    description: 'Documento oficial de calendario por centro',
    requiresEmployeeAcceptance: false,
    priority: 'medium',
    variableFields: ['EMPRESA_NOMBRE', 'CENTRO_NOMBRE', 'AÑO', 'MUNICIPIO', 'PROVINCIA', 'FESTIVOS_LISTA', 'TURNOS_RESUMEN', 'FECHA_GENERACION'],
    contentMarkdown: `# CALENDARIO LABORAL – {{CENTRO_NOMBRE}} – {{AÑO}}

| Campo | Valor |
|-------|-------|
| **Empresa** | {{EMPRESA_NOMBRE}} |
| **Centro** | {{CENTRO_NOMBRE}} ({{MUNICIPIO}}, {{PROVINCIA}}) |

## Festivos oficiales

Relación de festivos estatales, autonómicos y locales aplicables:

{{FESTIVOS_LISTA}}

## Jornada/Turnos

Resumen de turnos/jornadas tipo y, en su caso, periodos de jornada intensiva:

{{TURNOS_RESUMEN}}

## Observaciones

Cualquier ajuste será comunicado y archivado en actualización del calendario.

---

| | |
|---|---|
| **Fecha de publicación:** | ____/____/________ |
| **Firma responsable:** | ______________________________ |

---

*Fecha de emisión: {{FECHA_GENERACION}}*`
  },

  // ==================== CATEGORY 4: Contracts and Processing Agreements ====================
  {
    code: 'DOC-12',
    name: 'Cláusula de Encargo de Tratamiento (Plantilla Genérica)',
    category: 'contracts',
    description: 'Regular el tratamiento por proveedores tecnológicos (SaaS, hosting, QTSP)',
    requiresEmployeeAcceptance: false,
    priority: 'low',
    variableFields: ['RESPONSABLE_NOMBRE', 'RESPONSABLE_CIF', 'ENCARGADO_NOMBRE', 'ENCARGADO_CIF', 'OBJETO_SERVICIO', 'UBICACION_DATOS', 'SUBENCARGADOS', 'PLAZO_VIGENCIA', 'FECHA_GENERACION'],
    contentMarkdown: `# CLÁUSULA/CONTRATO DE ENCARGO DE TRATAMIENTO DE DATOS (ART. 28 RGPD)

Entre **{{RESPONSABLE_NOMBRE}}** ({{RESPONSABLE_CIF}}), en calidad de **Responsable del tratamiento**, y **{{ENCARGADO_NOMBRE}}** ({{ENCARGADO_CIF}}), en calidad de **Encargado**, se acuerda:

## 1. Objeto

El Encargado prestará **{{OBJETO_SERVICIO}}** que implica acceso a datos de empleados, registros de jornada, ausencias y documentación asociada.

## 2. Instrucciones

El Encargado tratará los datos según instrucciones documentadas del Responsable, sin destinarlos a fines propios.

## 3. Subencargados

Podrá intervenir subencargados identificados: **{{SUBENCARGADOS}}**, con contratos que ofrezcan garantías equivalentes. El Responsable será informado de cambios.

## 4. Confidencialidad

El Encargado garantiza confidencialidad y formación de su personal.

## 5. Seguridad

Aplicará medidas técnicas y organizativas apropiadas:
- Cifrado
- Control de acceso
- Registro de actividades
- Pruebas de continuidad

## 6. Localización y transferencias

La ubicación principal de los datos será **{{UBICACION_DATOS}}**. No se realizarán transferencias fuera del EEE sin garantías adecuadas.

## 7. Asistencia

El Encargado asistirá al Responsable en el cumplimiento de derechos, seguridad y notificación de violaciones.

## 8. Fin del servicio

A la finalización, el Encargado suprimirá o devolverá los datos y suprimirá copias, salvo obligación de conservación.

## 9. Auditorías

El Responsable podrá realizar auditorías razonables para verificar el cumplimiento.

---

**Entrada en vigor y vigencia:** {{PLAZO_VIGENCIA}}

| | |
|---|---|
| **Firma Responsable:** | ______________________________ |
| **Firma Encargado:** | ______________________________ |

---

*Fecha de emisión: {{FECHA_GENERACION}}*`
  },

  // ==================== CATEGORY 5: Employee Documents ====================
  {
    code: 'DOC-13',
    name: 'Guía Rápida del Empleado – Sistema de Fichaje',
    category: 'employee_docs',
    description: 'Instrucciones de uso sencillas para empleados',
    requiresEmployeeAcceptance: true,
    priority: 'low',
    variableFields: ['UBICACION_TERMINAL', 'MODOS_FICHAJE', 'CANAL_SOPORTE', 'CANAL_CORRECCIONES', 'FECHA_GENERACION'],
    contentMarkdown: `# GUÍA RÁPIDA – CÓMO FICHAR TU JORNADA

## 1. ¿Dónde ficho?

Acude al terminal de fichaje situado en **{{UBICACION_TERMINAL}}**.

## 2. ¿Cómo ficho?

Modos disponibles: **{{MODOS_FICHAJE}}** (QR, PIN o ambos según política). Sigue las indicaciones en pantalla.

## 3. Confirmación

Tras fichar, verás un mensaje de "OK" y un aviso sonoro. Si aparece error, repite la operación.

## 4. Entradas, salidas y pausas

Registra tu entrada y salida; si tu puesto incluye pausa obligatoria, sigue las instrucciones del responsable.

## 5. Olvidos/errores

Si olvidaste fichar o detectas un error, solicita una corrección desde **{{CANAL_CORRECCIONES}}** indicando la hora real y el motivo.

## 6. Soporte

Si el terminal no funciona, informa a **{{CANAL_SOPORTE}}** y usa, si se indica, el parte en papel.

---

> ⚠️ **Recuerda:** tu QR/PIN es personal e intransferible.

---

*Fecha de emisión: {{FECHA_GENERACION}}*`
  },
  {
    code: 'DOC-14',
    name: 'Consentimiento para Comunicaciones Electrónicas',
    category: 'employee_docs',
    description: 'Recabar consentimiento para notificaciones electrónicas no estrictamente necesarias',
    requiresEmployeeAcceptance: true,
    priority: 'low',
    variableFields: ['EMPRESA_NOMBRE', 'EMPLEADO_NOMBRE', 'EMPLEADO_DNI', 'CANAL_COMUNICACIONES', 'FECHA_GENERACION'],
    contentMarkdown: `# CONSENTIMIENTO PARA COMUNICACIONES ELECTRÓNICAS

Yo, **{{EMPLEADO_NOMBRE}}**, con DNI/NIE **{{EMPLEADO_DNI}}**, autorizo a **{{EMPRESA_NOMBRE}}** a enviarme comunicaciones electrónicas relacionadas con:

- ✅ Notificaciones informativas sobre solicitudes de ausencias, aprobaciones y recordatorios.
- ✅ Avisos de cierre mensual de horas y otras comunicaciones operativas no estrictamente necesarias.

**Canales autorizados:** {{CANAL_COMUNICACIONES}}

---

Puedo retirar este consentimiento en cualquier momento dirigiéndome a la empresa a través de los canales de privacidad establecidos, sin efectos sobre la licitud del tratamiento previo.

---

| | |
|---|---|
| **Fecha:** | {{FECHA_GENERACION}} |
| **Firma:** | ______________________________ |

---

> ℹ️ **Nota:** Este consentimiento no es necesario para comunicaciones estrictamente necesarias para el cumplimiento de obligaciones legales o contractuales (p. ej., acceso a registros de jornada, gestión de correcciones obligatorias).`
  }
];

// Helper function to get templates by category
export function getTemplatesByCategory(category: LegalDocumentTemplate['category']): LegalDocumentTemplate[] {
  return LEGAL_DOCUMENT_TEMPLATES.filter(t => t.category === category);
}

// Helper function to get templates requiring employee acceptance
export function getEmployeeAcceptanceTemplates(): LegalDocumentTemplate[] {
  return LEGAL_DOCUMENT_TEMPLATES.filter(t => t.requiresEmployeeAcceptance);
}

// Helper function to get high priority templates
export function getHighPriorityTemplates(): LegalDocumentTemplate[] {
  return LEGAL_DOCUMENT_TEMPLATES.filter(t => t.priority === 'high');
}

// Helper to substitute variables in template content
export function substituteVariables(content: string, values: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(values)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value || `[${key}]`);
  }
  return result;
}

// Category display names
export const CATEGORY_LABELS: Record<LegalDocumentTemplate['category'], string> = {
  privacy: 'Privacidad y Protección de Datos',
  internal_rules: 'Normas Internas de Uso',
  labor_compliance: 'Cumplimiento Laboral',
  contracts: 'Contratos y Encargos',
  employee_docs: 'Documentos para Empleados'
};

// Priority display names and colors
export const PRIORITY_CONFIG: Record<LegalDocumentTemplate['priority'], { label: string; className: string }> = {
  high: { label: 'Alta', className: 'bg-destructive text-destructive-foreground' },
  medium: { label: 'Media', className: 'bg-amber-500 text-white' },
  low: { label: 'Baja', className: 'bg-muted text-muted-foreground' }
};
