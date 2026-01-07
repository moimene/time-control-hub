import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  ChevronLeft, 
  ChevronRight, 
  Loader2,
  Users,
  AlertTriangle,
  Calendar as CalendarIcon,
  Ban,
  Star
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
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

interface Holiday {
  id: string;
  holiday_date: string;
  holiday_type: string;
  description: string | null;
}

interface BlackoutBlock {
  id: string;
  block_date: string;
  block_reason: string;
  department: string | null;
  min_staff_required: number | null;
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

  // Fetch holidays
  const { data: holidays } = useQuery({
    queryKey: ['calendar-holidays', company?.id, format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      if (!company?.id) return [];
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      
      const { data, error } = await supabase
        .from('calendar_holidays')
        .select('*')
        .eq('company_id', company.id)
        .gte('holiday_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('holiday_date', format(monthEnd, 'yyyy-MM-dd'))
        .eq('is_working_day', false);
      
      if (error) throw error;
      return (data || []) as Holiday[];
    },
    enabled: !!company?.id,
  });

  // Fetch blackout blocks
  const { data: blackouts } = useQuery({
    queryKey: ['blackout-blocks', company?.id, format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      if (!company?.id) return [];
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      
      const { data, error } = await supabase
        .from('absence_calendar_blocks')
        .select('*')
        .eq('company_id', company.id)
        .gte('block_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('block_date', format(monthEnd, 'yyyy-MM-dd'));
      
      if (error) throw error;
      return (data || []) as BlackoutBlock[];
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

  // Create sets for quick lookup
  const holidayDates = useMemo(() => {
    return new Set(holidays?.map(h => h.holiday_date) || []);
  }, [holidays]);

  const blackoutDates = useMemo(() => {
    const map = new Map<string, BlackoutBlock>();
    blackouts?.forEach(b => map.set(b.block_date, b));
    return map;
  }, [blackouts]);

  // Create a map for O(1) absence lookup
  // Key format: `${employeeId}_${dateStr}`
  const absencesMap = useMemo(() => {
    const map = new Map<string, AbsenceRequest>();
    if (!absences) return map;

    absences.forEach(absence => {
      // Parse dates once per absence
      const start = parseISO(absence.start_date);
      const end = parseISO(absence.end_date);

      // Get all days in the range
      // We rely on the fact that absences are filtered by the query to overlap with the current month,
      // so even if an absence is long, it is relevant. Clamping might hide padding days.
      try {
        const days = eachDayOfInterval({ start, end });
        days.forEach(day => {
          const key = `${absence.employee_id}_${format(day, 'yyyy-MM-dd')}`;
          // If multiple absences on same day, this logic matches the previous .find() behavior (first match wins if we don't overwrite)
          // But since .find() found the first one in the array, and we iterate the array in order here,
          // simply setting it will make the LAST one win.
          // To preserve behavior of "first match in the list", we only set if not exists.
          if (!map.has(key)) {
             map.set(key, absence);
          }
        });
      } catch (e) {
        console.error('Invalid absence date range', absence, e);
      }
    });
    return map;
  }, [absences]);

  // Get absences for a specific employee and day using the optimized map
  const getAbsenceForDay = (employeeId: string, day: Date) => {
    const key = `${employeeId}_${format(day, 'yyyy-MM-dd')}`;
    return absencesMap.get(key) || null;
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

  const getDayClass = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayOfWeek = getDay(day);
    const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidayDates.has(dateStr);
    const isBlackout = blackoutDates.has(dateStr);
    const isConflict = conflictDays.has(dateStr);
    
    let classes = 'border-b p-1 text-center min-w-[32px]';
    
    if (isBlackout) classes += ' bg-red-500/20';
    else if (isHoliday) classes += ' bg-blue-500/20';
    else if (isWeekendDay) classes += ' bg-muted/50';
    else if (isConflict) classes += ' bg-yellow-500/20';
    
    return classes;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle>Calendario del Equipo</CardTitle>
            <CardDescription>
              Vista mensual de ausencias, festivos y bloqueos
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
            {/* Warnings */}
            <div className="flex flex-wrap gap-2 mb-4">
              {conflictDays.size > 0 && (
                <Badge className="bg-yellow-500/10 text-yellow-700 border-yellow-500/20 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {conflictDays.size} día(s) con posible falta de cobertura
                </Badge>
              )}
              {blackouts && blackouts.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <Ban className="h-3 w-3" />
                  {blackouts.length} día(s) bloqueados
                </Badge>
              )}
              {holidays && holidays.length > 0 && (
                <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1">
                  <Star className="h-3 w-3" />
                  {holidays.length} festivo(s)
                </Badge>
              )}
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-background z-10 border-b p-2 text-left min-w-[150px]">
                    Empleado
                  </th>
                  {calendarDays.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isConflict = conflictDays.has(dateStr);
                    const isHoliday = holidayDates.has(dateStr);
                    const blackout = blackoutDates.get(dateStr);
                    const dayOfWeek = getDay(day);
                    const holiday = holidays?.find(h => h.holiday_date === dateStr);
                    
                    return (
                      <TooltipProvider key={dateStr}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <th className={getDayClass(day)}>
                              <div className="text-xs text-muted-foreground">
                                {dayNames[(dayOfWeek + 6) % 7]}
                              </div>
                              <div className={`font-medium ${isConflict ? 'text-yellow-700' : ''} ${isHoliday ? 'text-blue-600' : ''} ${blackout ? 'text-red-600' : ''}`}>
                                {format(day, 'd')}
                              </div>
                              {blackout && <Ban className="h-3 w-3 text-red-500 mx-auto" />}
                              {isHoliday && !blackout && <Star className="h-3 w-3 text-blue-500 mx-auto" />}
                            </th>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-sm">
                              {format(day, "EEEE, d 'de' MMMM", { locale: es })}
                              {holiday && <p className="text-blue-500">🎉 {holiday.description || 'Festivo'}</p>}
                              {blackout && <p className="text-red-500">🚫 {blackout.block_reason}</p>}
                              {isConflict && <p className="text-yellow-600">⚠️ Posible falta de cobertura</p>}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
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
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const dayOfWeek = getDay(day);
                      const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
                      const isHoliday = holidayDates.has(dateStr);
                      const isBlackout = blackoutDates.has(dateStr);
                      const isConflict = conflictDays.has(dateStr);
                      
                      let cellClass = 'border-b p-0.5 text-center';
                      if (isBlackout) cellClass += ' bg-red-500/10';
                      else if (isHoliday) cellClass += ' bg-blue-500/10';
                      else if (isWeekendDay) cellClass += ' bg-muted/50';
                      else if (isConflict && !absence) cellClass += ' bg-yellow-500/10';
                      
                      return (
                        <td key={dateStr} className={cellClass}>
                          {absence && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`w-full h-6 rounded-sm flex items-center justify-center cursor-help ${
                                      absence.status === 'pending' ? 'opacity-50 border border-dashed' : ''
                                    }`}
                                    style={{ backgroundColor: absence.absence_types?.color || '#6b7280' }}
                                  >
                                    {absence.status === 'pending' && (
                                      <span className="text-white text-xs">?</span>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-medium">{absence.absence_types?.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {absence.status === 'pending' ? 'Pendiente de aprobar' : 'Aprobada'}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
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
                <span>Conflicto cobertura</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-sm bg-blue-500/30" />
                <span>Festivo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-sm bg-red-500/30" />
                <span>Bloqueado</span>
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
