
export interface EmployeeFilterable {
  first_name: string;
  last_name: string;
  employee_code: string;
}

/**
 * Filters a list of employees based on a search string.
 * Optimizations:
 * - Returns original list if search is empty.
 * - Computes lowercase search term once.
 * - Uses case-insensitive comparison.
 */
export function filterEmployees<T extends EmployeeFilterable>(
  employees: T[],
  search: string
): T[] {
  if (!search) {
    return employees;
  }

  const searchLower = search.toLowerCase();

  return employees.filter(
    (e) =>
      e.first_name.toLowerCase().includes(searchLower) ||
      e.last_name.toLowerCase().includes(searchLower) ||
      e.employee_code.toLowerCase().includes(searchLower)
  );
}
