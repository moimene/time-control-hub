import { useState } from 'react';
import { useTemplates } from '@/hooks/useTemplates';
import { RuleSetWithVersions, SimulationResult } from '@/types/templates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Play, AlertTriangle, CheckCircle2, Users, Calendar, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TemplateSimulatorProps {
  ruleSet: RuleSetWithVersions;
}

export function TemplateSimulator({ ruleSet }: TemplateSimulatorProps) {
  const { simulateTemplate } = useTemplates();
  const [periodDays, setPeriodDays] = useState<string>('30');
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  // Get the latest version
  const latestVersion = ruleSet.rule_versions?.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  const handleSimulate = async () => {
    if (!latestVersion) return;
    
    setIsSimulating(true);
    try {
      const simResult = await simulateTemplate(latestVersion.id, parseInt(periodDays));
      setResult(simResult);
    } catch (error) {
      console.error('Simulation error:', error);
    } finally {
      setIsSimulating(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-destructive';
      case 'warn':
        return 'text-amber-600';
      default:
        return 'text-muted-foreground';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">Crítico</Badge>;
      case 'warn':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700">Advertencia</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Simulador de Impacto</CardTitle>
          <CardDescription>
            Ejecuta las reglas de la plantilla sobre los datos históricos para ver qué violaciones se detectarían
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Período de análisis</label>
              <Select value={periodDays} onValueChange={setPeriodDays}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 días</SelectItem>
                  <SelectItem value="14">Últimos 14 días</SelectItem>
                  <SelectItem value="30">Últimos 30 días</SelectItem>
                  <SelectItem value="60">Últimos 60 días</SelectItem>
                  <SelectItem value="90">Últimos 90 días</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSimulate} disabled={isSimulating || !latestVersion}>
              <Play className="mr-2 h-4 w-4" />
              {isSimulating ? 'Simulando...' : 'Ejecutar Simulación'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Violaciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`h-5 w-5 ${result.summary.total > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
                  <span className="text-2xl font-bold">{result.summary.total}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Empleados Afectados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold">{result.summary.employees_affected}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Críticas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <span className="text-2xl font-bold text-destructive">
                    {result.summary.by_severity?.critical || 0}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Advertencias
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <span className="text-2xl font-bold text-amber-600">
                    {result.summary.by_severity?.warn || 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Template Limits Used */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Límites Aplicados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Máx. diario:</span>
                  <Badge variant="outline">{result.template_limits.max_daily_hours}h</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Descanso diario:</span>
                  <Badge variant="outline">{result.template_limits.min_daily_rest}h</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Descanso semanal:</span>
                  <Badge variant="outline">{result.template_limits.min_weekly_rest}h</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Horas extra anuales:</span>
                  <Badge variant="outline">{result.template_limits.max_overtime_yearly}h</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Violations by Rule */}
          {Object.keys(result.summary.by_rule).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Violaciones por Regla</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  {Object.entries(result.summary.by_rule).map(([rule, count]) => (
                    <div key={rule} className="flex items-center gap-2 p-2 rounded-lg border">
                      <Badge variant="outline">{rule}</Badge>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Violations List */}
          {result.violations.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Detalle de Violaciones</CardTitle>
                <CardDescription>
                  Período: {format(new Date(result.period.start), 'dd MMM yyyy', { locale: es })} - {format(new Date(result.period.end), 'dd MMM yyyy', { locale: es })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Empleado</TableHead>
                      <TableHead>Regla</TableHead>
                      <TableHead>Severidad</TableHead>
                      <TableHead>Detalles</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.violations.slice(0, 50).map((violation, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {format(new Date(violation.violation_date), 'dd MMM', { locale: es })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {violation.employee_name}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">
                            {violation.rule_code}
                          </code>
                        </TableCell>
                        <TableCell>
                          {getSeverityBadge(violation.severity)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {violation.details}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {result.violations.length > 50 && (
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    Mostrando 50 de {result.violations.length} violaciones
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Sin violaciones</AlertTitle>
              <AlertDescription>
                No se encontraron violaciones con los límites configurados en el período analizado.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {!result && !isSimulating && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              Ejecuta una simulación para ver qué violaciones detectaría esta plantilla
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Esto no afecta a los datos reales, solo simula las reglas sobre el histórico
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
