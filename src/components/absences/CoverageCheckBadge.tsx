import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Users, Ban } from 'lucide-react';
import { format } from 'date-fns';

interface CoverageCheckResult {
  team_available_pct: number;
  conflicts: Array<{
    date: string;
    type: string;
    message: string;
  }>;
  can_approve: boolean;
  rule_id: string | null;
  blackout_dates: string[];
  team_size: number;
  absent_count: number;
}

interface CoverageCheckBadgeProps {
  companyId: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  centerId?: string | null;
  department?: string | null;
  onResult?: (result: CoverageCheckResult | null) => void;
  autoCheck?: boolean;
}

export function CoverageCheckBadge({
  companyId,
  employeeId,
  startDate,
  endDate,
  centerId,
  department,
  onResult,
  autoCheck = false
}: CoverageCheckBadgeProps) {
  const [manualCheck, setManualCheck] = useState(false);

  const { data: coverageResult, isLoading, refetch, error } = useQuery({
    queryKey: ['coverage-check', companyId, employeeId, startDate, endDate, centerId, department],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('coverage-check', {
        body: {
          company_id: companyId,
          employee_id: employeeId,
          start_date: startDate,
          end_date: endDate,
          center_id: centerId,
          department: department
        }
      });
      
      if (error) throw error;
      
      const result = data as CoverageCheckResult;
      onResult?.(result);
      return result;
    },
    enabled: (autoCheck || manualCheck) && !!companyId && !!startDate && !!endDate,
  });

  const handleCheck = () => {
    setManualCheck(true);
    refetch();
  };

  if (!startDate || !endDate) {
    return null;
  }

  if (isLoading) {
    return (
      <Badge variant="outline" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Verificando cobertura...
      </Badge>
    );
  }

  if (error) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        Error al verificar
      </Badge>
    );
  }

  if (!coverageResult && !autoCheck) {
    return (
      <Button variant="outline" size="sm" onClick={handleCheck} className="gap-1">
        <Users className="h-3 w-3" />
        Verificar cobertura
      </Button>
    );
  }

  if (!coverageResult) {
    return null;
  }

  const hasBlackouts = coverageResult.blackout_dates.length > 0;
  const hasConflicts = coverageResult.conflicts.length > 0;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            {coverageResult.can_approve ? (
              <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Cobertura OK ({Math.round(coverageResult.team_available_pct)}%)
              </Badge>
            ) : hasBlackouts ? (
              <Badge variant="destructive" className="gap-1">
                <Ban className="h-3 w-3" />
                Fecha bloqueada
              </Badge>
            ) : (
              <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 gap-1">
                <AlertTriangle className="h-3 w-3" />
                Conflicto ({Math.round(coverageResult.team_available_pct)}%)
              </Badge>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => refetch()}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[300px]">
          <div className="space-y-2">
            <p className="font-medium">Análisis de Cobertura</p>
            <div className="text-sm space-y-1">
              <p>Equipo: {coverageResult.team_size} personas</p>
              <p>Ausentes en periodo: {coverageResult.absent_count}</p>
              <p>Disponibilidad: {Math.round(coverageResult.team_available_pct)}%</p>
            </div>
            {hasBlackouts && (
              <div className="text-sm">
                <p className="font-medium text-destructive">Fechas bloqueadas:</p>
                <ul className="list-disc list-inside">
                  {coverageResult.blackout_dates.slice(0, 5).map(date => (
                    <li key={date}>{format(new Date(date), 'dd/MM/yyyy')}</li>
                  ))}
                  {coverageResult.blackout_dates.length > 5 && (
                    <li>...y {coverageResult.blackout_dates.length - 5} más</li>
                  )}
                </ul>
              </div>
            )}
            {hasConflicts && (
              <div className="text-sm">
                <p className="font-medium text-yellow-600">Conflictos:</p>
                <ul className="list-disc list-inside">
                  {coverageResult.conflicts.slice(0, 3).map((c, i) => (
                    <li key={i}>{c.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
