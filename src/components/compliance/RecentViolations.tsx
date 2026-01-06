import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, Clock, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Employee {
  first_name: string;
  last_name: string;
  employee_code: string;
}

interface Violation {
  id: string;
  rule_code: string;
  severity: string;
  violation_date: string;
  created_at: string;
  employees?: Employee;
  evidence_json: Record<string, unknown>;
}

interface RecentViolationsProps {
  violations: Violation[];
  loading?: boolean;
}

const RULE_LABELS: Record<string, string> = {
  MAX_DAILY_HOURS: 'Jornada máxima',
  MIN_DAILY_REST: 'Descanso diario',
  MIN_WEEKLY_REST: 'Descanso semanal',
  BREAK_REQUIRED: 'Pausa requerida',
  OVERTIME_YTD_75: 'Horas extra 75%',
  OVERTIME_YTD_90: 'Horas extra 90%',
  OVERTIME_YTD_CAP: 'Límite horas extra'
};

export function RecentViolations({ violations, loading }: RecentViolationsProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Violaciones Recientes</CardTitle>
            <CardDescription>Últimas incidencias detectadas</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/compliance/incidents">
              Ver Todas
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {violations.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No hay violaciones recientes
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Regla</TableHead>
                <TableHead>Severidad</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {violations.map((violation) => {
                const evidence = violation.evidence_json || {};
                let detail = '';
                
                if (evidence.actual && evidence.limit) {
                  detail = `${evidence.actual}h / ${evidence.limit}h`;
                } else if (evidence.percentage) {
                  detail = `${evidence.percentage}%`;
                } else if (evidence.actual_hours && evidence.required_hours) {
                  detail = `${evidence.actual_hours}h / ${evidence.required_hours}h`;
                }

                return (
                  <TableRow key={violation.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {violation.employees?.first_name} {violation.employees?.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {violation.employees?.employee_code}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {RULE_LABELS[violation.rule_code] || violation.rule_code}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={violation.severity === 'critical' ? 'destructive' : 'secondary'}
                      >
                        {violation.severity === 'critical' ? (
                          <AlertTriangle className="mr-1 h-3 w-3" />
                        ) : (
                          <Clock className="mr-1 h-3 w-3" />
                        )}
                        {violation.severity === 'critical' ? 'Crítico' : 'Advertencia'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(violation.violation_date), 'dd MMM yyyy', { locale: es })}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {detail}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
