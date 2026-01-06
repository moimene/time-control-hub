import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Inconsistency {
  type: 'consecutive_same_type' | 'orphan_entry';
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  eventType: 'entry' | 'exit';
  timestamp: string;
  previousTimestamp?: string;
}

interface InconsistencyAlertProps {
  inconsistencies: Inconsistency[];
  maxDisplay?: number;
}

export function InconsistencyAlert({ inconsistencies, maxDisplay = 5 }: InconsistencyAlertProps) {
  if (inconsistencies.length === 0) return null;

  const displayed = inconsistencies.slice(0, maxDisplay);
  const remaining = inconsistencies.length - maxDisplay;

  const getTypeLabel = (type: Inconsistency['type']) => {
    switch (type) {
      case 'consecutive_same_type':
        return 'Fichajes consecutivos del mismo tipo';
      case 'orphan_entry':
        return 'Entrada sin salida (>12h)';
      default:
        return 'Inconsistencia';
    }
  };

  return (
    <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        Inconsistencias detectadas
        <Badge variant="destructive" className="ml-2">
          {inconsistencies.length}
        </Badge>
      </AlertTitle>
      <AlertDescription>
        <div className="mt-2 space-y-1 text-sm">
          {displayed.map((inc, idx) => (
            <div key={idx} className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs bg-muted px-1 rounded">
                {inc.employeeCode}
              </span>
              <span className="font-medium">{inc.employeeName}</span>
              <span className="text-muted-foreground">—</span>
              <span>{getTypeLabel(inc.type)}</span>
              <span className="text-muted-foreground">
                ({format(new Date(inc.timestamp), "dd/MM HH:mm", { locale: es })})
              </span>
            </div>
          ))}
          {remaining > 0 && (
            <p className="text-muted-foreground mt-2">
              Y {remaining} inconsistencia{remaining > 1 ? 's' : ''} más...
            </p>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
