import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, LogIn, LogOut } from 'lucide-react';

interface ClockResult {
  employee: {
    first_name: string;
    last_name: string;
    employee_code: string;
  };
  event: {
    id: string;
    type: 'entry' | 'exit';
    timestamp: string;
  };
}

interface KioskSuccessProps {
  result: ClockResult;
  onClose: () => void;
}

export function KioskSuccess({ result, onClose }: KioskSuccessProps) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onClose]);

  const isEntry = result.event.type === 'entry';
  const eventTime = new Date(result.event.timestamp);

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${
      isEntry 
        ? 'bg-gradient-to-br from-green-500/20 to-green-600/10' 
        : 'bg-gradient-to-br from-red-500/20 to-red-600/10'
    }`}>
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          {/* Success Icon */}
          <div className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full ${
            isEntry ? 'bg-green-500/20' : 'bg-red-500/20'
          }`}>
            <CheckCircle2 className={`h-14 w-14 ${
              isEntry ? 'text-green-500' : 'text-red-500'
            }`} />
          </div>

          {/* Event Type */}
          <div className="flex items-center justify-center gap-2">
            {isEntry ? (
              <>
                <LogIn className="h-6 w-6 text-green-500" />
                <span className="text-2xl font-bold text-green-500">ENTRADA</span>
              </>
            ) : (
              <>
                <LogOut className="h-6 w-6 text-red-500" />
                <span className="text-2xl font-bold text-red-500">SALIDA</span>
              </>
            )}
          </div>

          {/* Employee Name */}
          <div>
            <p className="text-3xl font-bold">
              {result.employee.first_name} {result.employee.last_name}
            </p>
            <p className="text-muted-foreground font-mono">
              {result.employee.employee_code}
            </p>
          </div>

          {/* Time */}
          <div className="bg-muted rounded-lg p-4">
            <p className="text-5xl font-mono font-bold tabular-nums">
              {format(eventTime, 'HH:mm:ss')}
            </p>
            <p className="text-muted-foreground mt-1">
              {format(eventTime, "d 'de' MMMM 'de' yyyy", { locale: es })}
            </p>
          </div>

          {/* Countdown */}
          <p className="text-muted-foreground">
            Volviendo en {countdown} segundos...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
