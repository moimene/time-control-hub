import { describe, it, expect } from 'vitest';
import { filterTimeRecords } from '../src/lib/timeRecordsUtils';

describe('filterTimeRecords', () => {
  const mockRecords = [
    {
      id: 1,
      employees: {
        first_name: 'John',
        last_name: 'Doe',
        employee_code: 'EMP001'
      }
    },
    {
      id: 2,
      employees: {
        first_name: 'Jane',
        last_name: 'Smith',
        employee_code: 'EMP002'
      }
    },
    {
      id: 3,
      employees: {
        first_name: 'Bob',
        last_name: 'Jones',
        employee_code: 'EMP003'
      }
    }
  ];

  it('should return all records if search is empty', () => {
    expect(filterTimeRecords(mockRecords, '')).toEqual(mockRecords);
  });

  it('should filter by first name (case insensitive)', () => {
    expect(filterTimeRecords(mockRecords, 'john')).toHaveLength(1);
    expect(filterTimeRecords(mockRecords, 'JOHN')).toHaveLength(1);
    expect(filterTimeRecords(mockRecords, 'john')[0].id).toBe(1);
  });

  it('should filter by last name', () => {
    expect(filterTimeRecords(mockRecords, 'Smith')).toHaveLength(1);
    expect(filterTimeRecords(mockRecords, 'Smith')[0].id).toBe(2);
  });

  it('should filter by employee code', () => {
    expect(filterTimeRecords(mockRecords, 'EMP003')).toHaveLength(1);
    expect(filterTimeRecords(mockRecords, 'EMP003')[0].id).toBe(3);
  });

  it('should return empty array if no match found', () => {
    expect(filterTimeRecords(mockRecords, 'XYZ')).toHaveLength(0);
  });

  it('should handle null records', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(filterTimeRecords(null as any, 'test')).toEqual([]);
  });

  it('should handle undefined records', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(filterTimeRecords(undefined as any, 'test')).toEqual([]);
  });
});
