import { TimeEvent } from '@/types/database';

export interface TimeRecord extends Partial<TimeEvent> {
  employees?: {
    first_name?: string;
    last_name?: string;
    employee_code?: string;
  };
}

export function filterTimeRecords(records: TimeRecord[], search: string) {
  if (!records) return [];
  if (!search) return records;
  const searchLower = search.toLowerCase();
  return records.filter((record) => {
    return (
      record.employees?.first_name?.toLowerCase().includes(searchLower) ||
      record.employees?.last_name?.toLowerCase().includes(searchLower) ||
      record.employees?.employee_code?.toLowerCase().includes(searchLower)
    );
  });
}
