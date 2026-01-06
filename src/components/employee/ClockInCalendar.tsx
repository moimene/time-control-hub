import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isFuture, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimeEvent {
  id: string;
  timestamp: string;
  event_type: 'entry' | 'exit';
}

interface ClockInCalendarProps {
  events: TimeEvent[];
  currentDate: Date;
}

type DayStatus = 'complete' | 'incomplete' | 'no-events' | 'future' | 'weekend';

export function ClockInCalendar({ events, currentDate }: ClockInCalendarProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Group events by date and determine status
  const dayStatuses = useMemo(() => {
    const statusMap: Record<string, { status: DayStatus; entries: number; exits: number }> = {};

    // Group events by date
    const eventsByDate: Record<string, TimeEvent[]> = {};
    events.forEach(event => {
      const date = format(new Date(event.timestamp), 'yyyy-MM-dd');
      if (!eventsByDate[date]) {
        eventsByDate[date] = [];
      }
      eventsByDate[date].push(event);
    });

    // Calculate status for each day
    daysInMonth.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const dayOfWeek = getDay(day);
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (isFuture(day)) {
        statusMap[dateKey] = { status: 'future', entries: 0, exits: 0 };
      } else if (isWeekend) {
        const dayEvents = eventsByDate[dateKey] || [];
        const entries = dayEvents.filter(e => e.event_type === 'entry').length;
        const exits = dayEvents.filter(e => e.event_type === 'exit').length;
        if (entries > 0 || exits > 0) {
          statusMap[dateKey] = { 
            status: entries === exits && entries > 0 ? 'complete' : 'incomplete', 
            entries, 
            exits 
          };
        } else {
          statusMap[dateKey] = { status: 'weekend', entries: 0, exits: 0 };
        }
      } else {
        const dayEvents = eventsByDate[dateKey] || [];
        const entries = dayEvents.filter(e => e.event_type === 'entry').length;
        const exits = dayEvents.filter(e => e.event_type === 'exit').length;

        if (entries === 0 && exits === 0) {
          statusMap[dateKey] = { status: 'no-events', entries: 0, exits: 0 };
        } else if (entries === exits && entries > 0) {
          statusMap[dateKey] = { status: 'complete', entries, exits };
        } else {
          statusMap[dateKey] = { status: 'incomplete', entries, exits };
        }
      }
    });

    return statusMap;
  }, [events, daysInMonth]);

  // Count incomplete days (excluding today)
  const incompleteDays = useMemo(() => {
    return Object.entries(dayStatuses)
      .filter(([date, data]) => 
        data.status === 'incomplete' && 
        !isToday(new Date(date))
      ).length;
  }, [dayStatuses]);

  const getStatusIcon = (status: DayStatus) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'incomplete':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'no-events':
        return <XCircle className="h-4 w-4 text-muted-foreground/40" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: DayStatus) => {
    switch (status) {
      case 'complete':
        return 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800';
      case 'incomplete':
        return 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800';
      case 'no-events':
        return 'bg-muted/50 border-muted';
      case 'weekend':
      case 'future':
      default:
        return 'bg-background border-border/50';
    }
  };

  const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  // Calculate offset for the first day of the month
  const firstDayOffset = (getDay(monthStart) + 6) % 7; // Convert Sunday=0 to Monday=0

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Calendario de Fichajes
          </CardTitle>
          {incompleteDays > 0 && (
            <Badge variant="destructive">
              {incompleteDays} día{incompleteDays > 1 ? 's' : ''} incompleto{incompleteDays > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-muted-foreground">Completo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-muted-foreground">Incompleto</span>
          </div>
          <div className="flex items-center gap-1.5">
            <XCircle className="h-4 w-4 text-muted-foreground/40" />
            <span className="text-muted-foreground">Sin fichajes</span>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Week day headers */}
          {weekDays.map((day, i) => (
            <div
              key={day}
              className={cn(
                "text-center text-xs font-medium py-2",
                i >= 5 ? "text-muted-foreground" : "text-foreground"
              )}
            >
              {day}
            </div>
          ))}

          {/* Empty cells for offset */}
          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {/* Days */}
          {daysInMonth.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const data = dayStatuses[dateKey];
            const status = data?.status || 'future';
            const dayOfWeek = getDay(day);
            const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;

            return (
              <TooltipProvider key={dateKey}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "aspect-square flex flex-col items-center justify-center rounded-md border text-sm transition-colors",
                        getStatusColor(status),
                        isToday(day) && "ring-2 ring-primary ring-offset-1",
                        isWeekendDay && status === 'weekend' && "opacity-50"
                      )}
                    >
                      <span className={cn(
                        "font-medium",
                        isFuture(day) && "text-muted-foreground"
                      )}>
                        {format(day, 'd')}
                      </span>
                      {status !== 'future' && status !== 'weekend' && (
                        <div className="mt-0.5">
                          {getStatusIcon(status)}
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <div className="text-center">
                      <p className="font-medium">
                        {format(day, 'EEEE d', { locale: es })}
                      </p>
                      {status === 'complete' && (
                        <p className="text-green-600 dark:text-green-400">
                          ✓ {data.entries} entrada{data.entries > 1 ? 's' : ''}, {data.exits} salida{data.exits > 1 ? 's' : ''}
                        </p>
                      )}
                      {status === 'incomplete' && (
                        <p className="text-amber-600 dark:text-amber-400">
                          ⚠ {data.entries} entrada{data.entries !== 1 ? 's' : ''}, {data.exits} salida{data.exits !== 1 ? 's' : ''}
                        </p>
                      )}
                      {status === 'no-events' && (
                        <p className="text-muted-foreground">Sin fichajes</p>
                      )}
                      {status === 'weekend' && (
                        <p className="text-muted-foreground">Fin de semana</p>
                      )}
                      {status === 'future' && (
                        <p className="text-muted-foreground">Día futuro</p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
