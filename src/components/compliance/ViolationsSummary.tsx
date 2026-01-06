import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface Violation {
  id: string;
  rule_code: string;
  severity: string;
}

interface ViolationsSummaryProps {
  violations: Violation[];
  loading?: boolean;
}

const RULE_LABELS: Record<string, string> = {
  MAX_DAILY_HOURS: 'Jornada máxima diaria',
  MIN_DAILY_REST: 'Descanso diario mínimo',
  MIN_WEEKLY_REST: 'Descanso semanal mínimo',
  BREAK_REQUIRED: 'Pausa intrajornada',
  OVERTIME_YTD_75: 'Horas extra 75%',
  OVERTIME_YTD_90: 'Horas extra 90%',
  OVERTIME_YTD_CAP: 'Límite horas extra'
};

export function ViolationsSummary({ violations, loading }: ViolationsSummaryProps) {
  // Group by rule code
  const groupedByRule = violations.reduce((acc, v) => {
    acc[v.rule_code] = (acc[v.rule_code] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalViolations = violations.length;
  const sortedRules = Object.entries(groupedByRule).sort((a, b) => b[1] - a[1]);

  // Count by severity
  const criticalCount = violations.filter(v => v.severity === 'critical').length;
  const warnCount = violations.filter(v => v.severity === 'warn').length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Resumen de Incidencias</CardTitle>
            <CardDescription>Distribución por tipo de regla</CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="destructive">{criticalCount} críticas</Badge>
            <Badge variant="secondary">{warnCount} advertencias</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {sortedRules.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No hay incidencias abiertas. ¡Excelente cumplimiento!
          </p>
        ) : (
          <div className="space-y-4">
            {sortedRules.map(([ruleCode, count]) => {
              const percentage = Math.round((count / totalViolations) * 100);
              const ruleSeverity = violations.find(v => v.rule_code === ruleCode)?.severity;
              
              return (
                <div key={ruleCode} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {RULE_LABELS[ruleCode] || ruleCode}
                    </span>
                    <span className="text-muted-foreground">
                      {count} ({percentage}%)
                    </span>
                  </div>
                  <Progress 
                    value={percentage} 
                    className={ruleSeverity === 'critical' ? '[&>div]:bg-red-500' : '[&>div]:bg-yellow-500'}
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
