import { Wifi, WifiOff, RefreshCw, CloudOff, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface OfflineIndicatorProps {
  isOnline: boolean;
  queueSize: number;
  isSyncing: boolean;
  lastSync: Date | null;
}

export function OfflineIndicator({ 
  isOnline, 
  queueSize, 
  isSyncing,
  lastSync 
}: OfflineIndicatorProps) {
  if (isOnline && queueSize === 0 && !isSyncing) {
    return (
      <div className="fixed top-4 right-4 flex items-center gap-2">
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
          <Wifi className="h-3 w-3 mr-1" />
          Conectado
        </Badge>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 flex flex-col items-end gap-2">
      {/* Connection Status */}
      <Badge 
        variant="outline" 
        className={cn(
          isOnline 
            ? "bg-green-500/10 text-green-600 border-green-500/30" 
            : "bg-amber-500/10 text-amber-600 border-amber-500/30"
        )}
      >
        {isOnline ? (
          <>
            <Wifi className="h-3 w-3 mr-1" />
            Conectado
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3 mr-1" />
            Sin conexión
          </>
        )}
      </Badge>

      {/* Pending Events */}
      {queueSize > 0 && (
        <Badge 
          variant="outline" 
          className={cn(
            "bg-blue-500/10 text-blue-600 border-blue-500/30",
            isSyncing && "animate-pulse"
          )}
        >
          {isSyncing ? (
            <>
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <CloudOff className="h-3 w-3 mr-1" />
              {queueSize} pendiente{queueSize !== 1 ? 's' : ''}
            </>
          )}
        </Badge>
      )}

      {/* Last Sync Success */}
      {lastSync && queueSize === 0 && !isSyncing && (
        <Badge 
          variant="outline" 
          className="bg-muted text-muted-foreground border-border text-xs"
        >
          <Check className="h-3 w-3 mr-1" />
          Sincronizado
        </Badge>
      )}
    </div>
  );
}
