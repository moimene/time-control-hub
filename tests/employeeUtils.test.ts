
import { describe, it, expect } from 'vitest';
import { filterEmployees } from '../src/lib/employeeUtils';

describe('filterEmployees', () => {
  const employees = [
    { employee_code: 'EMP001', first_name: 'John', last_name: 'Doe' },
    { employee_code: 'EMP002', first_name: 'Jane', last_name: 'Smith' },
    { employee_code: 'EMP003', first_name: 'Alice', last_name: 'Johnson' },
    { employee_code: 'EMP004', first_name: 'Bob', last_name: 'Doe' },
  ];

  it('should return all employees when search is empty', () => {
    const result = filterEmployees(employees, '');
    expect(result).toBe(employees); // Reference equality optimization
    expect(result).toHaveLength(4);
  });

  it('should filter by first name', () => {
    const result = filterEmployees(employees, 'Jane');
    expect(result).toHaveLength(1);
    expect(result[0].first_name).toBe('Jane');
  });

  it('should filter by last name', () => {
    const result = filterEmployees(employees, 'Doe');
    expect(result).toHaveLength(2);
    expect(result.map(e => e.first_name)).toContain('John');
    expect(result.map(e => e.first_name)).toContain('Bob');
  });

  it('should filter by employee code', () => {
    const result = filterEmployees(employees, 'EMP003');
    expect(result).toHaveLength(1);
    expect(result[0].first_name).toBe('Alice');
  });

  it('should be case insensitive', () => {
    const result = filterEmployees(employees, 'john');
    expect(result).toHaveLength(2); // John Doe, Alice Johnson
  });

  it('should return empty array if no match', () => {
    const result = filterEmployees(employees, 'Xenomorph');
    expect(result).toHaveLength(0);
  });

  it('should handle partial matches', () => {
     const result = filterEmployees(employees, '002');
     expect(result).toHaveLength(1);
     expect(result[0].employee_code).toBe('EMP002');
  });
});
