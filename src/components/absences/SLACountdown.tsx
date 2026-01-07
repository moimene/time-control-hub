import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { differenceInHours, differenceInMinutes, parseISO, addHours } from 'date-fns';

interface SLACountdownProps {
  requestedAt: string;
  slaHours: number | null;
  status: string;
}

export function SLACountdown({ requestedAt, slaHours, status }: SLACountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number } | null>(null);
  const [percentage, setPercentage] = useState(0);

  useEffect(() => {
    if (status !== 'pending' || !slaHours) {
      setTimeLeft(null);
      return;
    }

    const calculateTimeLeft = () => {
      const requestDate = parseISO(requestedAt);
      const deadline = addHours(requestDate, slaHours);
      const now = new Date();
      
      const hoursLeft = differenceInHours(deadline, now);
      const totalMinutesLeft = differenceInMinutes(deadline, now);
      const minutesLeft = totalMinutesLeft % 60;
      
      // Calculate percentage of SLA used
      const totalSLAMinutes = slaHours * 60;
      const usedMinutes = totalSLAMinutes - totalMinutesLeft;
      const pct = Math.min(100, Math.max(0, (usedMinutes / totalSLAMinutes) * 100));
      
      setPercentage(pct);
      
      if (totalMinutesLeft <= 0) {
        setTimeLeft({ hours: 0, minutes: 0 });
      } else {
        setTimeLeft({ hours: hoursLeft, minutes: Math.abs(minutesLeft) });
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [requestedAt, slaHours, status]);

  if (status !== 'pending') {
    return (
      <Badge variant="outline" className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Procesada
      </Badge>
    );
  }

  if (!slaHours || !timeLeft) {
    return (
      <Badge variant="outline" className="gap-1">
        <Clock className="h-3 w-3" />
        Sin SLA
      </Badge>
    );
  }

  const isExpired = timeLeft.hours <= 0 && timeLeft.minutes <= 0;
  const isWarning = percentage >= 75;
  const isCritical = percentage >= 90;

  const getVariant = () => {
    if (isExpired) return 'destructive';
    if (isCritical) return 'destructive';
    if (isWarning) return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    return 'bg-green-500/10 text-green-600 border-green-500/20';
  };

  const formatTime = () => {
    if (isExpired) return 'SLA vencido';
    if (timeLeft.hours > 24) {
      const days = Math.floor(timeLeft.hours / 24);
      return `${days}d ${timeLeft.hours % 24}h`;
    }
    return `${timeLeft.hours}h ${timeLeft.minutes}m`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`gap-1 ${typeof getVariant() === 'string' && getVariant().includes('bg-') ? getVariant() : ''}`} variant={getVariant() === 'destructive' ? 'destructive' : 'outline'}>
            {isExpired || isCritical ? (
              <AlertTriangle className="h-3 w-3" />
            ) : (
              <Clock className="h-3 w-3" />
            )}
            {formatTime()}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">SLA: {slaHours} horas</p>
            <p className="text-sm">Uso: {Math.round(percentage)}%</p>
            {isExpired ? (
              <p className="text-sm text-destructive">La solicitud ha excedido el SLA y requiere escalación</p>
            ) : isCritical ? (
              <p className="text-sm text-yellow-600">SLA crítico - requiere acción inmediata</p>
            ) : isWarning ? (
              <p className="text-sm text-yellow-600">SLA próximo a vencer</p>
            ) : (
              <p className="text-sm text-green-600">Dentro del SLA</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
