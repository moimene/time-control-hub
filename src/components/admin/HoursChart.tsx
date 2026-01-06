import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TimeEvent {
  id: string;
  employee_id: string;
  event_type: 'entry' | 'exit';
  timestamp: string;
  employees?: {
    first_name: string;
    last_name: string;
    department: string | null;
  };
}

interface HoursChartProps {
  events: TimeEvent[];
  isLoading?: boolean;
}

interface EmployeeHours {
  name: string;
  hours: number;
  department: string;
}

interface DepartmentHours {
  name: string;
  hours: number;
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

function calculateHoursWorked(events: TimeEvent[]): { byEmployee: EmployeeHours[]; byDepartment: DepartmentHours[] } {
  // Group events by employee
  const eventsByEmployee: Record<string, TimeEvent[]> = {};
  
  for (const event of events) {
    if (!eventsByEmployee[event.employee_id]) {
      eventsByEmployee[event.employee_id] = [];
    }
    eventsByEmployee[event.employee_id].push(event);
  }

  const employeeHours: EmployeeHours[] = [];
  const departmentTotals: Record<string, number> = {};

  for (const employeeId of Object.keys(eventsByEmployee)) {
    const empEvents = eventsByEmployee[employeeId].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let totalMinutes = 0;
    let entryTime: Date | null = null;

    for (const event of empEvents) {
      if (event.event_type === 'entry') {
        entryTime = new Date(event.timestamp);
      } else if (event.event_type === 'exit' && entryTime) {
        const exitTime = new Date(event.timestamp);
        const diffMinutes = (exitTime.getTime() - entryTime.getTime()) / (1000 * 60);
        if (diffMinutes > 0 && diffMinutes < 24 * 60) { // Max 24h shift
          totalMinutes += diffMinutes;
        }
        entryTime = null;
      }
    }

    const firstEvent = empEvents[0];
    const employeeName = firstEvent?.employees 
      ? `${firstEvent.employees.first_name} ${firstEvent.employees.last_name}`
      : 'Desconocido';
    const department = firstEvent?.employees?.department || 'Sin departamento';
    const hours = Math.round(totalMinutes / 60 * 10) / 10; // Round to 1 decimal

    if (hours > 0) {
      employeeHours.push({ name: employeeName, hours, department });
      departmentTotals[department] = (departmentTotals[department] || 0) + hours;
    }
  }

  const byDepartment = Object.entries(departmentTotals).map(([name, hours]) => ({
    name,
    hours: Math.round(hours * 10) / 10,
  }));

  return { 
    byEmployee: employeeHours.sort((a, b) => b.hours - a.hours), 
    byDepartment: byDepartment.sort((a, b) => b.hours - a.hours) 
  };
}

export function HoursChart({ events, isLoading }: HoursChartProps) {
  const { byEmployee, byDepartment } = useMemo(() => calculateHoursWorked(events), [events]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Horas Trabajadas</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center">
          <p className="text-muted-foreground">Cargando datos...</p>
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Horas Trabajadas</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center">
          <p className="text-muted-foreground">No hay datos para mostrar</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Horas Trabajadas</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="employees" className="space-y-4">
          <TabsList>
            <TabsTrigger value="employees">Por Empleado</TabsTrigger>
            <TabsTrigger value="departments">Por Departamento</TabsTrigger>
          </TabsList>

          <TabsContent value="employees" className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={byEmployee.slice(0, 10)}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" unit="h" className="text-xs fill-muted-foreground" />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  width={90}
                  className="text-xs fill-muted-foreground"
                  tick={{ fontSize: 11 }}
                />
                <Tooltip 
                  formatter={(value: number) => [`${value}h`, 'Horas']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                  labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                />
                <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="departments" className="h-[350px]">
            <div className="flex h-full">
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byDepartment}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="hours"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {byDepartment.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [`${value}h`, 'Horas']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-48 flex flex-col justify-center space-y-2">
                {byDepartment.map((dept, index) => (
                  <div key={dept.name} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                    />
                    <span className="text-sm">{dept.name}</span>
                    <span className="text-sm text-muted-foreground ml-auto">{dept.hours}h</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}