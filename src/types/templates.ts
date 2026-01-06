export interface TemplatePayload {
  meta?: {
    template_name?: string;
    sector?: string;
    convenio?: string;
    scope?: string;
    version?: string;
    vigencia?: string;
    effective_from?: string;
    effective_to?: string;
  };
  calendar?: {
    week_start_day?: string;
    timezone?: string;
    period_closures?: {
      daily?: boolean;
      weekly?: boolean;
      monthly?: boolean;
      annual?: boolean;
    };
  };
  working_time?: {
    hours_per_year?: number;
    max_daily_hours?: number;
    max_weekly_hours?: number;
    irregular_distribution_pct?: number;
    rest_daily_hours_min?: number;
    rest_weekly_hours_min?: number;
  };
  limits?: {
    max_daily_hours?: number;
    min_daily_rest?: number;
    min_weekly_rest?: number;
    max_overtime_yearly?: number;
    max_weekly_hours?: number;
  };
  breaks?: {
    required_after_hours?: number;
    min_break_minutes?: number;
    break_threshold_hours?: number;
    break_duration_minutes_min?: number;
    break_counts_as_work?: boolean;
    break_enforcement?: string;
  };
  overtime?: {
    thresholds?: OvertimeThreshold[];
    overtime_yearly_cap?: number;
    overtime_compensation?: string;
    overtime_alert_thresholds?: {
      warn?: number;
      critical?: number;
    };
  };
  night_work?: {
    night_band?: string;
    night_premium_policy?: string;
  };
  holidays?: {
    work_on_holiday_requires_auth?: boolean;
    holiday_recargo_pct?: number;
    holiday_rest_substitute_hours?: number;
  };
  vacations?: {
    vacation_unit?: string;
    vacation_days_year?: number;
    vacation_devengo?: string;
  };
  part_time?: {
    part_time_extras_allowed?: boolean;
    complementary_hours_allowed?: boolean;
    complementary_hours_max_pct?: number;
    complementary_hours_notice_hours?: number;
  };
  shifts?: {
    shift_templates?: ShiftTemplate[];
    rotation_patterns?: RotationPattern[];
    planned_vs_worked_policy?: string;
  };
  notifications?: {
    notify_channels?: string[];
    quiet_hours?: {
      from?: string;
      to?: string;
    };
    allow_critical_outside_quiet?: boolean;
  };
  evaluation?: {
    evaluation_windows?: {
      realtime?: boolean;
      daily?: boolean;
      weekly?: boolean;
      monthly?: boolean;
    };
    severity_map?: Record<string, string>;
  };
  remote_work?: {
    remote_allowed?: boolean;
    disconnection_hours?: {
      from?: string;
      to?: string;
    };
  };
  leaves_catalog?: LeaveType[];
}

export interface ShiftTemplate {
  name: string;
  start: string;
  end: string;
  start2?: string;
  end2?: string;
  break_minutes?: number;
  break_policy?: string;
}

export interface RotationPattern {
  name: string;
  cycle_days: number;
}

export interface LeaveType {
  type: string;
  label?: string;
  days: number;
  paid: boolean;
  proof_required: boolean;
}

export interface OvertimeThreshold {
  percent: number;
  severity: 'info' | 'warn' | 'critical';
}

export interface RuleSet {
  id: string;
  company_id: string | null;
  name: string;
  description: string | null;
  sector: string | null;
  convenio: string | null;
  is_template: boolean;
  status: 'draft' | 'validating' | 'published' | 'active' | 'archived';
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RuleVersion {
  id: string;
  rule_set_id: string;
  version: string;
  payload_json: TemplatePayload;
  payload_hash: string | null;
  effective_from: string | null;
  effective_to: string | null;
  published_at: string | null;
  published_by: string | null;
  dt_evidence_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RuleSetWithVersions extends RuleSet {
  rule_versions?: RuleVersion[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  legal_reference?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  summary: {
    total_issues: number;
    blocking_errors: number;
    warnings: number;
  };
}

export interface SimulationViolation {
  rule_code: string;
  employee_id: string;
  employee_name: string;
  violation_date: string;
  severity: string;
  details: string;
}

export interface SimulationResult {
  violations: SimulationViolation[];
  summary: {
    total: number;
    by_rule: Record<string, number>;
    by_severity: Record<string, number>;
    employees_affected: number;
  };
  period: {
    start: string;
    end: string;
    days: number;
  };
  template_limits: {
    max_daily_hours: number;
    min_daily_rest: number;
    min_weekly_rest: number;
    max_overtime_yearly: number;
  };
}

export interface DiffItem {
  path: string;
  type: 'added' | 'removed' | 'changed';
  oldValue?: unknown;
  newValue?: unknown;
}

export interface DiffResult {
  version_a: { id: string; version: string; created_at: string; published_at: string | null };
  version_b: { id: string; version: string; created_at: string; published_at: string | null };
  total_differences: number;
  differences: DiffItem[];
  categorized: {
    limits: DiffItem[];
    breaks: DiffItem[];
    leaves_catalog: DiffItem[];
    overtime: DiffItem[];
    meta: DiffItem[];
    other: DiffItem[];
  };
  summary: {
    added: number;
    removed: number;
    changed: number;
  };
}

export const SECTOR_LABELS: Record<string, string> = {
  hosteleria: 'Hostelería',
  comercio: 'Comercio',
  comercio_alimentacion: 'Comercio Alimentación',
  salud: 'Sanidad',
  veterinaria: 'Veterinaria',
  servicios_profesionales: 'Oficinas y Despachos',
  metal: 'Metal',
  construccion: 'Construcción',
  logistica: 'Logística',
  limpieza: 'Limpieza',
  consultoria: 'Consultoría',
  oficinas: 'Oficinas y Despachos',
  sanitario: 'Sanitario Privado',
  otros: 'Otra actividad',
};

// Sector options with icons for company setup wizard
export interface SectorOption {
  id: string;
  label: string;
  icon: string;
  description: string;
}

export const SECTOR_OPTIONS: SectorOption[] = [
  { id: 'hosteleria', label: 'Hostelería', icon: '🍽️', description: 'Restaurantes, bares, hoteles' },
  { id: 'comercio', label: 'Comercio', icon: '🏪', description: 'Tiendas, retail, distribución' },
  { id: 'comercio_alimentacion', label: 'Alimentación', icon: '🛒', description: 'Supermercados, tiendas alimentación' },
  { id: 'salud', label: 'Sanidad', icon: '🏥', description: 'Clínicas, centros médicos' },
  { id: 'veterinaria', label: 'Veterinaria', icon: '🐕', description: 'Clínicas veterinarias' },
  { id: 'servicios_profesionales', label: 'Oficinas', icon: '💼', description: 'Oficinas, despachos, asesorías' },
  { id: 'metal', label: 'Metal', icon: '🔧', description: 'Industria metalúrgica' },
  { id: 'construccion', label: 'Construcción', icon: '🏗️', description: 'Obras, reformas' },
  { id: 'limpieza', label: 'Limpieza', icon: '🧹', description: 'Limpieza de edificios' },
  { id: 'logistica', label: 'Logística', icon: '🚚', description: 'Transporte, almacenes' },
  { id: 'consultoria', label: 'Consultoría', icon: '📊', description: 'Consultoría, IT' },
  { id: 'otros', label: 'Otra actividad', icon: '❓', description: 'Describir manualmente' },
];

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  validating: 'Validando',
  published: 'Publicado',
  active: 'Activo',
  archived: 'Archivado',
};

export const DEFAULT_TEMPLATE_PAYLOAD: TemplatePayload = {
  meta: {
    sector: '',
    convenio: '',
    vigencia: '',
  },
  calendar: {
    week_start_day: 'monday',
    timezone: 'Europe/Madrid',
    period_closures: {
      daily: true,
      weekly: true,
      monthly: true,
    },
  },
  working_time: {
    hours_per_year: 1780,
    max_daily_hours: 9,
    max_weekly_hours: 40,
    irregular_distribution_pct: 10,
    rest_daily_hours_min: 12,
    rest_weekly_hours_min: 36,
  },
  limits: {
    max_daily_hours: 9,
    min_daily_rest: 12,
    min_weekly_rest: 36,
    max_overtime_yearly: 80,
    max_weekly_hours: 40,
  },
  breaks: {
    required_after_hours: 6,
    min_break_minutes: 15,
    break_threshold_hours: 6,
    break_duration_minutes_min: 15,
    break_counts_as_work: false,
    break_enforcement: 'required',
  },
  overtime: {
    overtime_yearly_cap: 80,
    overtime_compensation: 'mixto',
    thresholds: [
      { percent: 75, severity: 'warn' },
      { percent: 90, severity: 'critical' },
    ],
    overtime_alert_thresholds: {
      warn: 0.75,
      critical: 0.9,
    },
  },
  vacations: {
    vacation_unit: 'dias_naturales',
    vacation_days_year: 30,
    vacation_devengo: 'anual',
  },
  leaves_catalog: [
    { type: 'marriage', label: 'Matrimonio', days: 15, paid: true, proof_required: true },
    { type: 'birth', label: 'Nacimiento', days: 5, paid: true, proof_required: true },
    { type: 'death_close', label: 'Fallecimiento familiar cercano', days: 3, paid: true, proof_required: true },
    { type: 'death_extended', label: 'Fallecimiento familiar extendido', days: 2, paid: true, proof_required: true },
    { type: 'moving', label: 'Mudanza', days: 1, paid: true, proof_required: false },
  ],
};

// Seed templates for different sectors
export const SEED_TEMPLATES: { sector: string; name: string; description: string; convenio: string; payload: TemplatePayload }[] = [
  {
    sector: 'hosteleria',
    name: 'Hostelería base',
    description: 'Plantilla base para sector hostelería. Referencia ALEH/estatales y provinciales; jornadas partidas, festivos frecuentes, nocturnidad habitual.',
    convenio: 'ALEH VI (Estatal)',
    payload: {
      meta: { template_name: 'Hostelería base', sector: 'hosteleria', scope: 'estatal_seed', version: 'v1.0' },
      calendar: { week_start_day: 'monday', timezone: 'Europe/Madrid', period_closures: { daily: true, weekly: true, monthly: true } },
      working_time: { hours_per_year: 1780, max_daily_hours: 9, max_weekly_hours: 40, irregular_distribution_pct: 10, rest_daily_hours_min: 12, rest_weekly_hours_min: 36 },
      breaks: { break_threshold_hours: 6, break_duration_minutes_min: 15, break_counts_as_work: false, break_enforcement: 'required' },
      overtime: { overtime_yearly_cap: 80, overtime_compensation: 'mixto', overtime_alert_thresholds: { warn: 0.75, critical: 0.9 } },
      night_work: { night_band: '22:00-06:00', night_premium_policy: 'recargo' },
      holidays: { work_on_holiday_requires_auth: true, holiday_recargo_pct: 75, holiday_rest_substitute_hours: 8 },
      vacations: { vacation_unit: 'dias_naturales', vacation_days_year: 30, vacation_devengo: 'anual' },
      part_time: { part_time_extras_allowed: false, complementary_hours_allowed: true, complementary_hours_max_pct: 30, complementary_hours_notice_hours: 3 },
      shifts: { shift_templates: [{ name: 'Partida', start: '10:00', end: '14:00', start2: '18:00', end2: '22:00', break_minutes: 60 }, { name: 'Continuada', start: '08:00', end: '16:00', break_minutes: 20 }], planned_vs_worked_policy: 'tolerant' },
      notifications: { notify_channels: ['inapp', 'email'], quiet_hours: { from: '22:00', to: '08:00' }, allow_critical_outside_quiet: false },
      evaluation: { evaluation_windows: { realtime: true, daily: true, weekly: true, monthly: true }, severity_map: { descanso_diario: 'critical', exceso_diario: 'major', pausa: 'minor' } },
    },
  },
  {
    sector: 'comercio',
    name: 'Comercio minorista base',
    description: 'Plantilla para comercio general/retail. Gran atomización; sábados y algunos festivos; pausas variables.',
    convenio: 'Convenio Provincial Comercio',
    payload: {
      meta: { template_name: 'Comercio minorista base', sector: 'comercio', scope: 'provincial_seed', version: 'v1.0' },
      calendar: { week_start_day: 'monday', timezone: 'Europe/Madrid' },
      working_time: { hours_per_year: 1780, max_daily_hours: 9, max_weekly_hours: 40, irregular_distribution_pct: 5, rest_daily_hours_min: 12, rest_weekly_hours_min: 36 },
      breaks: { break_threshold_hours: 6, break_duration_minutes_min: 15, break_counts_as_work: false, break_enforcement: 'required' },
      overtime: { overtime_yearly_cap: 80, overtime_compensation: 'mixto', overtime_alert_thresholds: { warn: 0.75, critical: 0.9 } },
      holidays: { work_on_holiday_requires_auth: true, holiday_recargo_pct: 75 },
      vacations: { vacation_unit: 'dias_naturales', vacation_days_year: 30, vacation_devengo: 'prorrata_mensual' },
      part_time: { part_time_extras_allowed: false, complementary_hours_allowed: true, complementary_hours_max_pct: 40, complementary_hours_notice_hours: 3 },
      shifts: { shift_templates: [{ name: 'Comercial', start: '10:00', end: '14:00', start2: '17:00', end2: '20:30', break_minutes: 90 }] },
      evaluation: { evaluation_windows: { daily: true, weekly: true, monthly: true } },
    },
  },
  {
    sector: 'comercio_alimentacion',
    name: 'Comercio alimentación base',
    description: 'Plantilla para supermercados y tiendas de alimentación. Ampliación horaria y domingos; turnos partidos.',
    convenio: 'Convenio Provincial Alimentación',
    payload: {
      meta: { template_name: 'Comercio alimentación base', sector: 'comercio_alimentacion', scope: 'provincial_seed', version: 'v1.0' },
      calendar: { week_start_day: 'monday', timezone: 'Europe/Madrid' },
      working_time: { hours_per_year: 1780, max_daily_hours: 9, max_weekly_hours: 40, rest_daily_hours_min: 12, rest_weekly_hours_min: 36 },
      breaks: { break_threshold_hours: 6, break_duration_minutes_min: 15, break_counts_as_work: false, break_enforcement: 'required' },
      overtime: { overtime_yearly_cap: 80, overtime_compensation: 'mixto' },
      holidays: { work_on_holiday_requires_auth: true, holiday_recargo_pct: 75 },
      vacations: { vacation_unit: 'dias_naturales', vacation_days_year: 30 },
      part_time: { part_time_extras_allowed: false, complementary_hours_allowed: true, complementary_hours_max_pct: 40, complementary_hours_notice_hours: 3 },
      shifts: { shift_templates: [{ name: 'Supermercado', start: '07:00', end: '14:30', start2: '16:30', end2: '20:30', break_minutes: 120 }] },
    },
  },
  {
    sector: 'salud',
    name: 'Sanidad privada base',
    description: 'Plantilla para clínicas y centros sanitarios privados. Turnos 24/7, guardias, nocturnidad, pausas asistenciales computables.',
    convenio: 'Convenio Sanidad Privada',
    payload: {
      meta: { template_name: 'Sanidad privada base', sector: 'salud', scope: 'estatal_seed', version: 'v1.0' },
      calendar: { week_start_day: 'monday', timezone: 'Europe/Madrid' },
      working_time: { hours_per_year: 1750, max_daily_hours: 9, max_weekly_hours: 40, rest_daily_hours_min: 12, rest_weekly_hours_min: 36 },
      breaks: { break_threshold_hours: 6, break_duration_minutes_min: 15, break_counts_as_work: true, break_enforcement: 'required' },
      overtime: { overtime_yearly_cap: 80, overtime_compensation: 'descanso' },
      night_work: { night_band: '22:00-06:00', night_premium_policy: 'recargo' },
      holidays: { work_on_holiday_requires_auth: true, holiday_rest_substitute_hours: 8 },
      vacations: { vacation_unit: 'dias_naturales', vacation_days_year: 30 },
      shifts: { shift_templates: [{ name: 'Mañana', start: '08:00', end: '15:00' }, { name: 'Tarde', start: '15:00', end: '22:00' }, { name: 'Noche', start: '22:00', end: '08:00' }] },
    },
  },
  {
    sector: 'veterinaria',
    name: 'Clínicas veterinarias base',
    description: 'Plantilla para clínicas veterinarias. Similar a sanidad por turnicidad, guardias y fines de semana.',
    convenio: 'Convenio Veterinaria',
    payload: {
      meta: { template_name: 'Clínicas veterinarias base', sector: 'veterinaria', scope: 'estatal_seed', version: 'v1.0' },
      calendar: { week_start_day: 'monday', timezone: 'Europe/Madrid' },
      working_time: { hours_per_year: 1750, max_daily_hours: 9, max_weekly_hours: 40, rest_daily_hours_min: 12, rest_weekly_hours_min: 36 },
      breaks: { break_threshold_hours: 6, break_duration_minutes_min: 15, break_counts_as_work: true, break_enforcement: 'required' },
      overtime: { overtime_yearly_cap: 80, overtime_compensation: 'descanso' },
      night_work: { night_band: '22:00-06:00', night_premium_policy: 'recargo' },
      holidays: { work_on_holiday_requires_auth: true, holiday_rest_substitute_hours: 8 },
      vacations: { vacation_unit: 'dias_naturales', vacation_days_year: 30 },
      shifts: { shift_templates: [{ name: 'Guardia', start: '20:00', end: '08:00', break_minutes: 30 }] },
    },
  },
  {
    sector: 'servicios_profesionales',
    name: 'Oficinas y Despachos base',
    description: 'Plantilla para oficinas y despachos. Jornada regular, intensiva en verano; teletrabajo y desconexión digital.',
    convenio: 'Convenio Oficinas y Despachos',
    payload: {
      meta: { template_name: 'Oficinas y Despachos base', sector: 'servicios_profesionales', scope: 'provincial_seed', version: 'v1.0', effective_from: '2025-01-01', effective_to: '2026-12-31' },
      calendar: { week_start_day: 'monday', timezone: 'Europe/Madrid', period_closures: { daily: true, weekly: true, monthly: true, annual: true } },
      working_time: { hours_per_year: 1765, max_daily_hours: 8, max_weekly_hours: 40, irregular_distribution_pct: 5, rest_daily_hours_min: 12, rest_weekly_hours_min: 36 },
      breaks: { break_threshold_hours: 6, break_duration_minutes_min: 15, break_counts_as_work: true, break_enforcement: 'required' },
      overtime: { overtime_yearly_cap: 80, overtime_compensation: 'mixto' },
      vacations: { vacation_unit: 'dias_laborables', vacation_days_year: 23, vacation_devengo: 'anual' },
      shifts: { shift_templates: [{ name: 'Normal', start: '08:00', end: '17:00', break_policy: '15min_computable' }, { name: 'Intensivo Verano', start: '08:00', end: '15:00' }] },
      remote_work: { remote_allowed: true, disconnection_hours: { from: '18:00', to: '09:00' } },
    },
  },
  {
    sector: 'metal',
    name: 'Metal base (CEM seed)',
    description: 'Plantilla para industria del metal. Sector amplio con convenio estatal (CEM) y provinciales; pluses, nocturnidad y turnos.',
    convenio: 'CEM (Convenio Estatal Metal)',
    payload: {
      meta: { template_name: 'Metal base (CEM seed)', sector: 'metal', scope: 'estatal_seed', version: 'v1.0' },
      calendar: { week_start_day: 'monday', timezone: 'Europe/Madrid' },
      working_time: { hours_per_year: 1760, max_daily_hours: 9, max_weekly_hours: 40, rest_daily_hours_min: 12, rest_weekly_hours_min: 36 },
      breaks: { break_threshold_hours: 6, break_duration_minutes_min: 15, break_counts_as_work: false, break_enforcement: 'required' },
      overtime: { overtime_yearly_cap: 80, overtime_compensation: 'mixto' },
      night_work: { night_band: '22:00-06:00', night_premium_policy: 'recargo' },
      shifts: { shift_templates: [{ name: 'Turno industrial', start: '06:00', end: '14:00' }, { name: 'Tarde', start: '14:00', end: '22:00' }, { name: 'Noche', start: '22:00', end: '06:00' }], rotation_patterns: [{ name: 'M-T-N', cycle_days: 6 }] },
      evaluation: { evaluation_windows: { daily: true, weekly: true, monthly: true } },
    },
  },
  {
    sector: 'construccion',
    name: 'Construcción base',
    description: 'Plantilla para construcción. Convenio general estatal con provinciales robustos; alta regulación de PRL.',
    convenio: 'Convenio General Construcción',
    payload: {
      meta: { template_name: 'Construcción base', sector: 'construccion', scope: 'estatal_seed', version: 'v1.0' },
      calendar: { week_start_day: 'monday', timezone: 'Europe/Madrid' },
      working_time: { hours_per_year: 1730, max_daily_hours: 9, max_weekly_hours: 40, rest_daily_hours_min: 12, rest_weekly_hours_min: 36 },
      breaks: { break_threshold_hours: 6, break_duration_minutes_min: 15, break_counts_as_work: false, break_enforcement: 'required' },
      overtime: { overtime_yearly_cap: 80, overtime_compensation: 'descanso' },
      holidays: { work_on_holiday_requires_auth: true },
      shifts: { shift_templates: [{ name: 'Obra', start: '08:00', end: '17:00', break_minutes: 60 }], planned_vs_worked_policy: 'strict' },
      evaluation: { evaluation_windows: { daily: true, weekly: true, monthly: true } },
    },
  },
  {
    sector: 'limpieza',
    name: 'Limpieza de Edificios base',
    description: 'Plantilla para limpieza de edificios y locales. Jornadas parciales frecuentes; franjas nocturnas/madrugada.',
    convenio: 'Convenio Limpieza de Edificios',
    payload: {
      meta: { template_name: 'Limpieza de Edificios base', sector: 'limpieza', scope: 'estatal_seed', version: 'v1.0' },
      calendar: { week_start_day: 'monday', timezone: 'Europe/Madrid' },
      working_time: { hours_per_year: 1750, max_daily_hours: 8, max_weekly_hours: 40, rest_daily_hours_min: 12, rest_weekly_hours_min: 36 },
      breaks: { break_threshold_hours: 6, break_duration_minutes_min: 15, break_counts_as_work: false, break_enforcement: 'required' },
      overtime: { overtime_yearly_cap: 80, overtime_compensation: 'mixto' },
      night_work: { night_band: '22:00-06:00', night_premium_policy: 'recargo' },
      part_time: { part_time_extras_allowed: false, complementary_hours_allowed: true, complementary_hours_max_pct: 30, complementary_hours_notice_hours: 3 },
      shifts: { shift_templates: [{ name: 'Oficinas Madrugada', start: '05:00', end: '09:00' }] },
    },
  },
  {
    sector: 'consultoria',
    name: 'Consultoría base',
    description: 'Plantilla para consultoría y servicios profesionales. Jornada anual ~1790h; teletrabajo y desconexión habituales.',
    convenio: 'Convenio Consultorías 2025-2027',
    payload: {
      meta: { template_name: 'Consultoría base', sector: 'consultoria', scope: 'estatal_seed', version: 'v1.0' },
      calendar: { week_start_day: 'monday', timezone: 'Europe/Madrid' },
      working_time: { hours_per_year: 1790, max_daily_hours: 9, max_weekly_hours: 40, rest_daily_hours_min: 12, rest_weekly_hours_min: 36 },
      breaks: { break_threshold_hours: 6, break_duration_minutes_min: 15, break_counts_as_work: true, break_enforcement: 'required' },
      overtime: { overtime_yearly_cap: 80, overtime_compensation: 'mixto' },
      remote_work: { remote_allowed: true, disconnection_hours: { from: '18:00', to: '09:00' } },
    },
  },
];
