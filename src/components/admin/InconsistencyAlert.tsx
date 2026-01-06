import { AlertTriangle, Send } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

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
  showCorrectionButton?: boolean;
}

export function InconsistencyAlert({ 
  inconsistencies, 
  maxDisplay = 5,
  showCorrectionButton = false 
}: InconsistencyAlertProps) {
  const navigate = useNavigate();
  
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

  const handleRequestCorrection = (inconsistency: Inconsistency) => {
    const date = new Date(inconsistency.timestamp);
    const eventType = inconsistency.type === 'orphan_entry' ? 'exit' : 
      (inconsistency.eventType === 'entry' ? 'exit' : 'entry');
    
    // Navigate with state to pre-fill the correction form
    navigate('/employee/request-correction', {
      state: {
        prefillDate: date.toISOString(),
        prefillEventType: eventType,
        prefillReason: `Corrección automática: ${getTypeLabel(inconsistency.type)} detectada el ${format(date, "dd/MM/yyyy 'a las' HH:mm", { locale: es })}`
      }
    });
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
        <div className="mt-2 space-y-2 text-sm">
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
              {showCorrectionButton && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs ml-auto"
                  onClick={() => handleRequestCorrection(inc)}
                >
                  <Send className="h-3 w-3 mr-1" />
                  Solicitar corrección
                </Button>
              )}
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
