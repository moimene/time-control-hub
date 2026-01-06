import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface TimeEvent {
  id: string;
  timestamp: string;
  event_type: 'entry' | 'exit';
}

interface DailyActivityChartProps {
  events: TimeEvent[];
  days?: number;
  isLoading?: boolean;
}

interface DailyData {
  date: string;
  dateLabel: string;
  entries: number;
  exits: number;
  total: number;
}

export function DailyActivityChart({ events, days = 7, isLoading }: DailyActivityChartProps) {
  const dailyData = useMemo(() => {
    const result: DailyData[] = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(today, i);
      const start = startOfDay(date);
      const end = endOfDay(date);

      const dayEvents = events.filter(e => {
        const eventDate = new Date(e.timestamp);
        return eventDate >= start && eventDate <= end;
      });

      const entries = dayEvents.filter(e => e.event_type === 'entry').length;
      const exits = dayEvents.filter(e => e.event_type === 'exit').length;

      result.push({
        date: format(date, 'yyyy-MM-dd'),
        dateLabel: format(date, 'EEE d', { locale: es }),
        entries,
        exits,
        total: entries + exits,
      });
    }

    return result;
  }, [events, days]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Actividad Diaria</CardTitle>
          <CardDescription>Fichajes de los últimos {days} días</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground">Cargando datos...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actividad Diaria</CardTitle>
        <CardDescription>Fichajes de los últimos {days} días</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dailyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorEntries" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorExits" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="dateLabel" 
              className="text-xs fill-muted-foreground"
              tick={{ fontSize: 11 }}
            />
            <YAxis className="text-xs fill-muted-foreground" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--popover))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
              labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
              formatter={(value: number, name: string) => [
                value,
                name === 'entries' ? 'Entradas' : 'Salidas'
              ]}
            />
            <Area 
              type="monotone" 
              dataKey="entries" 
              stroke="hsl(var(--chart-1))" 
              fillOpacity={1} 
              fill="url(#colorEntries)" 
              name="entries"
            />
            <Area 
              type="monotone" 
              dataKey="exits" 
              stroke="hsl(var(--chart-2))" 
              fillOpacity={1} 
              fill="url(#colorExits)" 
              name="exits"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}