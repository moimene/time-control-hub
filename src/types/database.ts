// Types based on database schema
export type AppRole = 'super_admin' | 'admin' | 'responsible' | 'employee';
export type EmployeeStatus = 'active' | 'inactive' | 'suspended' | 'on_leave';
export type EventType = 'entry' | 'exit';
export type EventSource = 'qr' | 'pin' | 'manual';
export type CorrectionStatus = 'pending' | 'approved' | 'rejected';
export type TerminalStatus = 'pending' | 'active' | 'inactive';

export interface Company {
  id: string;
  name: string;
  cif: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  timezone: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Employee {
  id: string;
  user_id: string | null;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  position: string | null;
  status: EmployeeStatus;
  hire_date: string | null;
  termination_date: string | null;
  pin_hash: string | null;
  pin_salt: string | null;
  pin_failed_attempts: number;
  pin_locked_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeQR {
  id: string;
  employee_id: string;
  token_hash: string;
  version: number;
  is_active: boolean;
  created_at: string;
  revoked_at: string | null;
}

export interface Terminal {
  id: string;
  name: string;
  location: string | null;
  pairing_code: string | null;
  pairing_expires_at: string | null;
  auth_token_hash: string | null;
  status: TerminalStatus;
  last_seen_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TimeEvent {
  id: string;
  employee_id: string;
  terminal_id: string | null;
  event_type: EventType;
  event_source: EventSource;
  timestamp: string;
  local_timestamp: string;
  timezone: string;
  offline_uuid: string | null;
  synced_at: string | null;
  qr_version: number | null;
  ip_address: string | null;
  user_agent: string | null;
  raw_payload: Record<string, unknown> | null;
  created_at: string;
}

export interface CorrectionRequest {
  id: string;
  employee_id: string;
  original_event_id: string | null;
  requested_event_type: EventType | null;
  requested_timestamp: string | null;
  reason: string;
  status: CorrectionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CorrectedEvent {
  id: string;
  correction_request_id: string;
  employee_id: string;
  event_type: EventType;
  timestamp: string;
  local_timestamp: string;
  timezone: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_type: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// Extended types with relations
export interface TimeEventWithEmployee extends TimeEvent {
  employee?: Employee;
}

export interface CorrectionRequestWithEmployee extends CorrectionRequest {
  employee?: Employee;
}
