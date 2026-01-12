import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModuleStatusCardProps {
  moduleNumber: string;
  title: string;
  description: string;
  status: 'passed' | 'pending' | 'failed' | 'loading' | 'unknown';
  details?: Record<string, any>;
}

export function ModuleStatusCard({ 
  moduleNumber, 
  title, 
  description, 
  status, 
  details 
}: ModuleStatusCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusConfig = {
    passed: {
      icon: CheckCircle2,
      label: 'Passed',
      bgClass: 'bg-emerald-500/10 border-emerald-500/30',
      textClass: 'text-emerald-400',
      glowClass: 'shadow-[0_0_20px_hsl(142,76%,36%,0.2)]',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    },
    pending: {
      icon: Clock,
      label: 'Pending',
      bgClass: 'bg-amber-500/10 border-amber-500/30',
      textClass: 'text-amber-400',
      glowClass: 'shadow-[0_0_20px_hsl(45,93%,47%,0.2)]',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    },
    failed: {
      icon: AlertCircle,
      label: 'Failed',
      bgClass: 'bg-rose-500/10 border-rose-500/30',
      textClass: 'text-rose-400',
      glowClass: 'shadow-[0_0_20px_hsl(0,84%,60%,0.2)]',
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    },
    loading: {
      icon: Loader2,
      label: 'Loading',
      bgClass: 'bg-blue-500/10 border-blue-500/30',
      textClass: 'text-blue-400',
      glowClass: 'shadow-[0_0_20px_hsl(217,91%,60%,0.2)]',
      badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30'
    },
    unknown: {
      icon: Clock,
      label: 'Not Run',
      bgClass: 'bg-muted/50 border-border/50',
      textClass: 'text-muted-foreground',
      glowClass: '',
      badgeClass: 'bg-muted text-muted-foreground border-border'
    }
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  return (
    <Card className={cn(
      'backdrop-blur-md border transition-all duration-300 hover:scale-[1.02]',
      config.bgClass,
      config.glowClass
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded">
              M{moduleNumber}
            </span>
            <Badge variant="outline" className={cn('text-xs', config.badgeClass)}>
              <StatusIcon className={cn('h-3 w-3 mr-1', status === 'loading' && 'animate-spin')} />
              {config.label}
            </Badge>
          </div>
        </div>
        <CardTitle className="text-sm font-semibold mt-2">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground mb-3">{description}</p>
        
        {details && Object.keys(details).length > 0 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  View Details
                </>
              )}
            </Button>
            
            {isExpanded && (
              <div className="mt-3 p-2 bg-background/30 rounded-md border border-border/50 max-h-48 overflow-auto">
                <dl className="space-y-1.5 text-xs">
                  {Object.entries(details).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-2">
                      <dt className="text-muted-foreground font-mono truncate">{key}:</dt>
                      <dd className={cn('font-medium text-right', config.textClass)}>
                        {formatValue(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
