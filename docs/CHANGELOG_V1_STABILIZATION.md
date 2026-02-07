# Changelog V1 Stabilization

**Fecha:** 2026-01-11  
**Versión:** 1.0.0-rc1  
**Autor:** Equipo de desarrollo  

---

## Resumen Ejecutivo

Esta sesión completó la estabilización del sistema V1, incluyendo:
- Nuevo rol `asesor` con políticas RLS de solo lectura
- Edge function `seed-v1-fixtures` para datos de prueba
- Refactorización de `compliance-evaluator` con reglas dinámicas
- Página de credenciales de test con datos reales

---

## Migraciones de Base de Datos

### 1. Enum `app_role` - Añadir rol asesor

**Archivo:** `supabase/migrations/20260111095528_8d92389b-7e62-4b19-b3be-d0b9af72d14f.sql`

```sql
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'asesor';
```

**Impacto:** Permite asignar el rol `asesor` a usuarios en la tabla `user_roles`.

---

### 2. Políticas RLS para rol asesor

**Archivo:** `supabase/migrations/20260111100213_ab761519-66a5-4b3a-8800-d61aabedd583.sql`

**Políticas creadas (8 total):**

| Tabla | Política | Descripción |
|-------|----------|-------------|
| `employees` | `asesor_view_assigned_employees` | Ver empleados de empresas asignadas |
| `time_events` | `asesor_view_assigned_time_events` | Ver fichajes de empresas asignadas |
| `correction_requests` | `asesor_view_assigned_corrections` | Ver solicitudes de corrección |
| `compliance_violations` | `asesor_view_assigned_violations` | Ver infracciones de cumplimiento |
| `company` | `asesor_view_assigned_companies` | Ver datos de empresas asignadas |
| `calendar_holidays` | `asesor_view_assigned_holidays` | Ver festivos de empresas asignadas |
| `rule_sets` | `asesor_view_assigned_rule_sets` | Ver conjuntos de reglas |
| `rule_versions` | `asesor_view_assigned_rule_versions` | Ver versiones de reglas |

**Función auxiliar creada:**
```sql
CREATE OR REPLACE FUNCTION public.user_has_role(required_role app_role)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = required_role
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

---

## Edge Functions

### 1. `seed-v1-fixtures` (Nueva)

**Archivo:** `supabase/functions/seed-v1-fixtures/index.ts`

**Funcionalidad:**
- Crea 3 empresas de test con sectores diferentes
- Genera empleados con PINs hasheados (SHA-256 + salt)
- Carga festivos nacionales y autonómicos 2026
- Crea `rule_sets` según sector (hostelería, sanidad, comercio)
- Crea usuario asesor con asignación a empresas
- Genera `correction_requests` y `compliance_violations` de ejemplo

**Empresas de test:**

| Nombre | CIF | Sector | Timezone |
|--------|-----|--------|----------|
| Bar Pepe | B12345678 | hosteleria | Europe/Madrid |
| Clínica Vet | B87654321 | sanidad | Europe/Madrid |
| Tienda Centro | B11223344 | comercio | Atlantic/Canary |

**Credenciales asesor:**
- Email: `asesor@laboralconsulting.com`
- Password: `asesor123`
- Empresas asignadas: Bar Pepe, Clínica Vet

**Configuración en `supabase/config.toml`:**
```toml
[functions.seed-v1-fixtures]
verify_jwt = false
```

---

### 2. `compliance-evaluator` (Refactorizado)

**Archivo:** `supabase/functions/compliance-evaluator/index.ts`

**Cambios principales:**

1. **Lectura dinámica de reglas** desde `rule_sets` + `rule_versions`
2. **Precedencia de reglas:** Law → Collective Agreement → Contract
3. **Registro de origen** en `evidence_json.rule_source`

**Función `getEffectiveRules`:**
```typescript
async function getEffectiveRules(supabase: any, companyId: string, date: string) {
  // 1. Obtiene rule_sets activos para la empresa
  // 2. Obtiene rule_versions vigentes para la fecha
  // 3. Aplica precedencia: law (base) -> collective_agreement -> contract
  // 4. Retorna reglas mergeadas con source tracking
}
```

**Reglas soportadas:**

| Código | Descripción | Default |
|--------|-------------|---------|
| `MAX_DAILY_HOURS` | Horas máximas por día | 10 |
| `MIN_DAILY_REST` | Descanso mínimo diario (horas) | 11 |
| `MIN_WEEKLY_REST` | Descanso mínimo semanal (horas) | 36 |
| `BREAK_REQUIRED` | Pausa obligatoria tras 6h | true |
| `BREAK_MINUTES` | Duración mínima pausa | 15 |
| `OVERTIME_YTD_CAP` | Tope anual horas extra | 80 |

---

## Componentes Frontend

### `TestCredentials.tsx` (Actualizado)

**Archivo:** `src/pages/TestCredentials.tsx`

**Cambios:**
1. Fetch dinámico de datos desde Supabase
2. Organización por roles: Super Admin, Admin, Responsable, Employee, Asesor
3. Sección Kiosk con empleados agrupados por empresa
4. Indicadores de estado de ciclos de test

**Queries implementados:**
```typescript
// Roles de usuario
const { data: userRoles } = await supabase
  .from('user_roles')
  .select('user_id, role');

// Asignaciones empresa-usuario
const { data: userCompanies } = await supabase
  .from('user_company')
  .select('user_id, company_id');

// Empleados con PIN
const { data: employees } = await supabase
  .from('employees')
  .select('id, employee_code, first_name, last_name, company_id, pin_hash')
  .not('pin_hash', 'is', null);
```

---

## Datos Insertados

### Festivos 2026

| Fecha | Descripción | Tipo |
|-------|-------------|------|
| 2026-01-01 | Año Nuevo | national |
| 2026-01-06 | Epifanía del Señor | national |
| 2026-04-03 | Viernes Santo | national |
| 2026-05-01 | Día del Trabajo | national |
| 2026-08-15 | Asunción de la Virgen | national |
| 2026-10-12 | Fiesta Nacional | national |
| 2026-11-01 | Todos los Santos | national |
| 2026-12-06 | Día de la Constitución | national |
| 2026-12-08 | Inmaculada Concepción | national |
| 2026-12-25 | Navidad | national |
| 2026-02-28 | Día de Andalucía | autonomous |
| 2026-03-19 | San José | autonomous |

### Rule Sets

| Empresa | Tipo | Reglas |
|---------|------|--------|
| Bar El Rincón | law | MAX_DAILY_HOURS=10, MIN_DAILY_REST=11 |
| Bar El Rincón | collective_agreement | BREAK_MINUTES=20 (hostelería) |
| Zapatería López | law | MAX_DAILY_HOURS=10, MIN_DAILY_REST=11 |
| Zapatería López | collective_agreement | BREAK_MINUTES=15 (comercio) |

### Correction Requests (ejemplo)

| Empleado | Motivo | Estado |
|----------|--------|--------|
| EMP001 | Olvidé fichar entrada | pending |
| EMP002 | Error en hora de salida | pending |
| EMP003 | Fichaje duplicado | pending |

### Compliance Violations (ejemplo)

| Empleado | Regla | Severidad |
|----------|-------|-----------|
| EMP001 | MAX_DAILY_HOURS | warn |
| EMP002 | MIN_DAILY_REST | critical |
| EMP003 | BREAK_REQUIRED | info |

---

## Estado del Sistema Post-Migración

| Entidad | Cantidad |
|---------|----------|
| Empresas | 9 |
| Empleados | 31 (30 con PIN) |
| Time Events | 407 |
| Usuarios con rol | 26 |
| Festivos 2026 | 100+ |
| Rule Sets | 5 (3 activos) |
| Rule Versions | 5 |
| Correction Requests | 9 |
| Compliance Violations | 9 |
| Terminales | 8 |
| Daily Roots | 3 |

---

## Ciclos de Test V1 Completados

| Ciclo | Descripción | Estado |
|-------|-------------|--------|
| 1 | Alta empresa + empleados + PIN | ✅ |
| 2 | Fichajes kiosk + correcciones | ✅ |
| 3 | Ausencias + justificantes | ⏳ |
| 4 | Comunicaciones certificadas | ⏳ |
| 5 | Cierre mensual + firma | ⏳ |
| 6 | Cumplimiento + violaciones | ✅ |
| 7 | QTSP sellado | ⏳ |
| 8 | Asesor multi-empresa | ✅ |

---

## Commits Sugeridos

```bash
# Commit 1: Migración enum
git add supabase/migrations/20260111095528_*.sql
git commit -m "feat(db): add asesor role to app_role enum"

# Commit 2: Políticas RLS
git add supabase/migrations/20260111100213_*.sql
git commit -m "feat(db): add RLS policies for asesor role (read-only)"

# Commit 3: Edge function seed
git add supabase/functions/seed-v1-fixtures/
git add supabase/config.toml
git commit -m "feat(edge): add seed-v1-fixtures for test data generation"

# Commit 4: Compliance evaluator refactor
git add supabase/functions/compliance-evaluator/
git commit -m "refactor(edge): dynamic rule loading from rule_sets table"

# Commit 5: Frontend
git add src/pages/TestCredentials.tsx
git commit -m "feat(ui): TestCredentials fetches real data from database"

# Commit 6: Documentación
git add docs/CHANGELOG_V1_STABILIZATION.md
git commit -m "docs: add V1 stabilization changelog"
```

---

## Notas de Despliegue

1. **Orden de ejecución:**
   - Primero aplicar migraciones SQL
   - Luego desplegar edge functions
   - Finalmente ejecutar `seed-v1-fixtures`

2. **Variables de entorno requeridas:**
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

3. **Verificación post-despliegue:**
   ```bash
   # Verificar rol asesor existe
   SELECT unnest(enum_range(NULL::app_role));
   
   # Verificar políticas RLS
   SELECT * FROM pg_policies WHERE policyname LIKE 'asesor%';
   
   # Verificar datos seed
   SELECT COUNT(*) FROM company;
   SELECT COUNT(*) FROM employees WHERE pin_hash IS NOT NULL;
   ```

---

## Problemas Conocidos

1. **Página `/test-credentials` sin autenticación:** Muestra 0 usuarios debido a RLS. Requiere login para ver datos.

2. **Timezone Canarias:** Verificar que `Atlantic/Canary` aplica correctamente DST en marzo/octubre.

3. **Función `user_belongs_to_company`:** Corregido orden de argumentos en políticas RLS.

---

*Documento generado automáticamente - V1 Stabilization Session*
