import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CheckCircle, AlertCircle, Clock, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, getDay, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface DailyRoot {
  id: string;
  date: string;
  root_hash: string;
  event_count: number;
}

interface Evidence {
  id: string;
  status: string;
  daily_roots: DailyRoot | null;
}

interface EvidenceCalendarProps {
  evidences: Evidence[];
  dailyRoots?: DailyRoot[];
}

export function EvidenceCalendar({ evidences, dailyRoots = [] }: EvidenceCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Map evidences by date
  const evidenceByDate = useMemo(() => {
    const map = new Map<string, { status: string; eventCount: number }>();
    
    evidences.forEach((evidence) => {
      if (evidence.daily_roots?.date) {
        const dateStr = evidence.daily_roots.date;
        map.set(dateStr, {
          status: evidence.status,
          eventCount: evidence.daily_roots.event_count || 0,
        });
      }
    });

    // Also check daily_roots without evidences (pending timestamp)
    dailyRoots.forEach((root) => {
      if (!map.has(root.date)) {
        map.set(root.date, {
          status: 'pending',
          eventCount: root.event_count || 0,
        });
      }
    });

    return map;
  }, [evidences, dailyRoots]);

  const getDayStatus = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return evidenceByDate.get(dateStr);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/50';
      case 'processing':
        return 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/50';
      case 'failed':
        return 'bg-destructive/20 text-destructive border-destructive/50';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/50';
      default:
        return '';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-3 h-3" />;
      case 'processing':
        return <Loader2 className="w-3 h-3 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-3 h-3" />;
      case 'pending':
        return <Clock className="w-3 h-3" />;
      default:
        return null;
    }
  };

  // Calculate stats for current month
  const monthStats = useMemo(() => {
    let completed = 0;
    let failed = 0;
    let pending = 0;
    let processing = 0;
    let noActivity = 0;

    days.forEach((day) => {
      if (isBefore(day, new Date()) || isToday(day)) {
        const dateStr = format(day, "yyyy-MM-dd");
        const status = evidenceByDate.get(dateStr);
        if (status) {
          switch (status.status) {
            case 'completed': completed++; break;
            case 'failed': failed++; break;
            case 'pending': pending++; break;
            case 'processing': processing++; break;
          }
        } else if (isBefore(day, new Date())) {
          noActivity++;
        }
      }
    });

    return { completed, failed, pending, processing, noActivity };
  }, [days, evidenceByDate]);

  // Get day of week for first day (0 = Sunday, 1 = Monday, etc.)
  const startDay = getDay(monthStart);
  // Adjust for Monday start (European standard)
  const adjustedStartDay = startDay === 0 ? 6 : startDay - 1;

  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Calendario de Evidencias</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-medium min-w-[140px] text-center">
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Completado ({monthStats.completed})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>Pendiente ({monthStats.pending})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Procesando ({monthStats.processing})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span>Fallido ({monthStats.failed})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-muted" />
            <span>Sin actividad ({monthStats.noActivity})</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Week day headers */}
          {weekDays.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}

          {/* Empty cells for days before month start */}
          {Array.from({ length: adjustedStartDay }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {/* Days */}
          {days.map((day) => {
            const status = getDayStatus(day);
            const isFuture = !isBefore(day, new Date()) && !isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "aspect-square p-1 rounded-lg border flex flex-col items-center justify-center text-sm transition-colors",
                  isToday(day) && "ring-2 ring-primary",
                  isFuture && "opacity-40",
                  status ? getStatusColor(status.status) : "border-border bg-muted/30"
                )}
              >
                <span className={cn(
                  "font-medium",
                  isToday(day) && "text-primary"
                )}>
                  {format(day, 'd')}
                </span>
                {status && (
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {getStatusIcon(status.status)}
                    {status.eventCount > 0 && (
                      <span className="text-[10px]">{status.eventCount}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
