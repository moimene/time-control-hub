import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ChevronLeft, 
  ChevronRight, 
  Loader2,
  Users,
  AlertTriangle,
  Calendar as CalendarIcon
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isWeekend,
  addMonths,
  subMonths,
  parseISO,
  isWithinInterval,
  getDay
} from 'date-fns';
import { es } from 'date-fns/locale';

interface AbsenceRequest {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  status: string;
  employees: {
    first_name: string;
    last_name: string;
    department: string | null;
  } | null;
  absence_types: {
    name: string;
    color: string;
  } | null;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  department: string | null;
}

export function TeamCalendarView() {
  const { company } = useCompany();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  // Fetch employees
  const { data: employees } = useQuery({
    queryKey: ['employees', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, department')
        .eq('company_id', company.id)
        .eq('status', 'active')
        .order('first_name');
      if (error) throw error;
      return (data || []) as Employee[];
    },
    enabled: !!company?.id,
  });

  // Fetch absences for the month
  const { data: absences, isLoading } = useQuery({
    queryKey: ['team-absences', company?.id, format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      if (!company?.id) return [];
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      
      const { data, error } = await supabase
        .from('absence_requests')
        .select(`
          id, employee_id, start_date, end_date, status,
          employees(first_name, last_name, department),
          absence_types(name, color)
        `)
        .eq('company_id', company.id)
        .in('status', ['approved', 'pending'])
        .lte('start_date', format(monthEnd, 'yyyy-MM-dd'))
        .gte('end_date', format(monthStart, 'yyyy-MM-dd'));
      
      if (error) throw error;
      return (data || []) as AbsenceRequest[];
    },
    enabled: !!company?.id,
  });

  // Get unique departments
  const departments = useMemo(() => {
    if (!employees) return [];
    const depts = new Set(employees.map(e => e.department).filter(Boolean));
    return Array.from(depts) as string[];
  }, [employees]);

  // Filter employees by department
  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    if (departmentFilter === 'all') return employees;
    return employees.filter(e => e.department === departmentFilter);
  }, [employees, departmentFilter]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return eachDayOfInterval({ start: monthStart, end: monthEnd });
  }, [currentMonth]);

  // Get absences for a specific employee and day
  const getAbsenceForDay = (employeeId: string, day: Date) => {
    if (!absences) return null;
    return absences.find(a => 
      a.employee_id === employeeId &&
      isWithinInterval(day, {
        start: parseISO(a.start_date),
        end: parseISO(a.end_date)
      })
    );
  };

  // Count absences per day for conflict detection
  const absenceCountPerDay = useMemo(() => {
    if (!absences || !filteredEmployees) return {};
    const counts: Record<string, number> = {};
    
    calendarDays.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      counts[dateStr] = filteredEmployees.filter(emp => 
        getAbsenceForDay(emp.id, day)?.status === 'approved'
      ).length;
    });
    
    return counts;
  }, [absences, filteredEmployees, calendarDays]);

  // Detect conflicts (more than 50% of team absent)
  const conflictDays = useMemo(() => {
    if (!filteredEmployees || filteredEmployees.length === 0) return new Set<string>();
    const threshold = Math.ceil(filteredEmployees.length * 0.5);
    return new Set(
      Object.entries(absenceCountPerDay)
        .filter(([_, count]) => count >= threshold)
        .map(([date]) => date)
    );
  }, [absenceCountPerDay, filteredEmployees]);

  const dayNames = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Calendario del Equipo</CardTitle>
            <CardDescription>
              Vista mensual de ausencias aprobadas y pendientes
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[180px]">
                <Users className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium min-w-[150px] text-center">
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredEmployees?.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No hay empleados en este departamento</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Conflict Warning */}
            {conflictDays.size > 0 && (
              <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <span className="text-sm text-yellow-700">
                  {conflictDays.size} día(s) con posible falta de cobertura (≥50% del equipo ausente)
                </span>
              </div>
            )}

            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-background z-10 border-b p-2 text-left min-w-[150px]">
                    Empleado
                  </th>
                  {calendarDays.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isConflict = conflictDays.has(dateStr);
                    const dayOfWeek = getDay(day);
                    const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
                    
                    return (
                      <th
                        key={dateStr}
                        className={`border-b p-1 text-center min-w-[32px] ${
                          isWeekendDay ? 'bg-muted/50' : ''
                        } ${isConflict ? 'bg-yellow-500/20' : ''}`}
                      >
                        <div className="text-xs text-muted-foreground">
                          {dayNames[(dayOfWeek + 6) % 7]}
                        </div>
                        <div className={`font-medium ${isConflict ? 'text-yellow-700' : ''}`}>
                          {format(day, 'd')}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees?.map(employee => (
                  <tr key={employee.id} className="hover:bg-muted/30">
                    <td className="sticky left-0 bg-background z-10 border-b p-2">
                      <div className="font-medium truncate">
                        {employee.first_name} {employee.last_name}
                      </div>
                      {employee.department && (
                        <div className="text-xs text-muted-foreground truncate">
                          {employee.department}
                        </div>
                      )}
                    </td>
                    {calendarDays.map(day => {
                      const absence = getAbsenceForDay(employee.id, day);
                      const dayOfWeek = getDay(day);
                      const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const isConflict = conflictDays.has(dateStr);
                      
                      return (
                        <td
                          key={dateStr}
                          className={`border-b p-0.5 text-center ${
                            isWeekendDay ? 'bg-muted/50' : ''
                          } ${isConflict && !absence ? 'bg-yellow-500/10' : ''}`}
                        >
                          {absence && (
                            <div
                              className={`w-full h-6 rounded-sm flex items-center justify-center ${
                                absence.status === 'pending' ? 'opacity-50 border border-dashed' : ''
                              }`}
                              style={{ backgroundColor: absence.absence_types?.color || '#6b7280' }}
                              title={`${absence.absence_types?.name} (${absence.status === 'pending' ? 'Pendiente' : 'Aprobada'})`}
                            >
                              {absence.status === 'pending' && (
                                <span className="text-white text-xs">?</span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Legend */}
            <div className="mt-4 flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Leyenda:</span>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-sm bg-green-500" />
                <span>Aprobada</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-sm bg-green-500 opacity-50 border border-dashed" />
                <span>Pendiente</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-sm bg-yellow-500/30" />
                <span>Posible conflicto</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-sm bg-muted" />
                <span>Fin de semana</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
