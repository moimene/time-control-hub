import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';
import { format, parseISO, eachDayOfInterval, isWeekend } from 'date-fns';
import { es } from 'date-fns/locale';

interface HolidayIndicatorProps {
  companyId: string;
  centerId?: string | null;
  startDate: string;
  endDate: string;
  computeOn: 'dias_naturales' | 'dias_laborables' | 'horas';
  onHolidaysCalculated?: (count: number) => void;
}

export function HolidayIndicator({
  companyId,
  centerId,
  startDate,
  endDate,
  computeOn,
  onHolidaysCalculated
}: HolidayIndicatorProps) {
  const { data: holidays } = useQuery({
    queryKey: ['holidays-in-range', companyId, centerId, startDate, endDate],
    queryFn: async () => {
      if (!startDate || !endDate) return [];
      
      let query = supabase
        .from('calendar_holidays')
        .select('*')
        .eq('company_id', companyId)
        .gte('holiday_date', startDate)
        .lte('holiday_date', endDate)
        .eq('is_working_day', false);
      
      if (centerId) {
        query = query.or(`center_id.eq.${centerId},center_id.is.null`);
      } else {
        query = query.is('center_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      if (data && onHolidaysCalculated) {
        onHolidaysCalculated(data.length);
      }
      
      return data || [];
    },
    enabled: !!companyId && !!startDate && !!endDate
  });

  // Calculate days breakdown
  const daysBreakdown = () => {
    if (!startDate || !endDate) return null;
    
    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      const allDays = eachDayOfInterval({ start, end });
      
      const weekendDays = allDays.filter(d => isWeekend(d)).length;
      const holidayDates = new Set(holidays?.map(h => h.holiday_date) || []);
      const holidayCount = holidays?.length || 0;
      
      // Natural days
      const naturalDays = allDays.length;
      
      // Working days (excluding weekends and holidays)
      let workingDays = 0;
      allDays.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (!isWeekend(day) && !holidayDates.has(dateStr)) {
          workingDays++;
        }
      });
      
      return {
        naturalDays,
        workingDays,
        weekendDays,
        holidayCount
      };
    } catch {
      return null;
    }
  };

  const breakdown = daysBreakdown();

  if (!breakdown || !holidays?.length) {
    return null;
  }

  return (
    <div className="space-y-2">
      {holidays.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {holidays.map(holiday => (
            <Badge key={holiday.id} variant="secondary" className="text-xs gap-1">
              <Calendar className="h-3 w-3" />
              {format(parseISO(holiday.holiday_date), 'd MMM', { locale: es })}
              {holiday.description && `: ${holiday.description}`}
            </Badge>
          ))}
        </div>
      )}
      
      <div className="text-xs text-muted-foreground space-y-1 p-2 rounded bg-muted/50">
        <p>Días naturales: {breakdown.naturalDays}</p>
        <p>Días laborables: {breakdown.workingDays}</p>
        {breakdown.weekendDays > 0 && <p>Fines de semana: {breakdown.weekendDays} días</p>}
        {breakdown.holidayCount > 0 && <p>Festivos: {breakdown.holidayCount}</p>}
        <p className="font-medium pt-1 border-t border-border mt-1">
          Cómputo: {computeOn === 'dias_naturales' 
            ? `${breakdown.naturalDays} días naturales` 
            : computeOn === 'horas' 
              ? 'Por horas' 
              : `${breakdown.workingDays} días laborables`}
        </p>
      </div>
    </div>
  );
}
