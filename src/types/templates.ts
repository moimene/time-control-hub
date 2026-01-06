export interface TemplatePayload {
  meta?: {
    sector?: string;
    convenio?: string;
    vigencia?: string;
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
  };
  leaves_catalog?: LeaveType[];
  overtime?: {
    thresholds?: OvertimeThreshold[];
  };
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
  oficinas: 'Oficinas y Despachos',
  sanitario: 'Sanitario Privado',
};

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
  },
  leaves_catalog: [
    { type: 'marriage', label: 'Matrimonio', days: 15, paid: true, proof_required: true },
    { type: 'birth', label: 'Nacimiento', days: 5, paid: true, proof_required: true },
    { type: 'death_close', label: 'Fallecimiento familiar cercano', days: 3, paid: true, proof_required: true },
    { type: 'death_extended', label: 'Fallecimiento familiar extendido', days: 2, paid: true, proof_required: true },
    { type: 'moving', label: 'Mudanza', days: 1, paid: true, proof_required: false },
  ],
  overtime: {
    thresholds: [
      { percent: 75, severity: 'warn' },
      { percent: 90, severity: 'critical' },
    ],
  },
};
