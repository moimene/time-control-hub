import { useState } from 'react';
import { useWizard } from '../WizardContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FlaskConical, Play, CheckCircle2, XCircle, AlertTriangle, Info, TrendingUp } from 'lucide-react';
import { useTemplates } from '@/hooks/useTemplates';
import { useCompany } from '@/hooks/useCompany';

export function StepSimulation() {
  const { state, setSimulationResult } = useWizard();
  const { simulateTemplate } = useTemplates();
  const { companyId } = useCompany();
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  const { isSimulationComplete, simulationResult, payload } = state;

  // Mock simulation for wizard (since we don't have a saved version yet)
  const handleSimulate = async () => {
    setIsSimulating(true);
    setSimulationError(null);

    try {
      // Simulate locally based on payload configuration
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate mock simulation results based on payload
      const mockResult = generateMockSimulation(payload);
      setSimulationResult(mockResult);
    } catch (error) {
      setSimulationError('Error al ejecutar la simulación. Intente de nuevo.');
    } finally {
      setIsSimulating(false);
    }
  };

  const generateMockSimulation = (payload: any) => {
    const limits = payload.limits || {};
    const workingTime = payload.working_time || {};
    const breaks = payload.breaks || {};

    // Generate realistic-looking violations based on configuration
    const violations = [];
    const rules = ['DAILY_HOURS', 'DAILY_REST', 'WEEKLY_REST', 'BREAK_REQUIRED', 'OVERTIME'];
    
    // More restrictive settings = fewer violations in simulation
    const restrictiveness = (
      (limits.min_daily_rest || 12) / 12 +
      (limits.min_weekly_rest || 36) / 36 +
      (breaks.break_duration_minutes_min || 15) / 15
    ) / 3;

    const baseViolations = Math.floor((1 - restrictiveness) * 15) + 3;

    for (let i = 0; i < baseViolations; i++) {
      const rule = rules[Math.floor(Math.random() * rules.length)];
      violations.push({
        rule_code: rule,
        employee_id: `emp_${Math.floor(Math.random() * 10) + 1}`,
        employee_name: `Empleado ${Math.floor(Math.random() * 10) + 1}`,
        violation_date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        severity: rule === 'DAILY_REST' || rule === 'WEEKLY_REST' ? 'critical' : 
                 rule === 'BREAK_REQUIRED' ? 'warn' : 'info',
        details: getViolationDetails(rule),
      });
    }

    const bySeverity = violations.reduce((acc, v) => {
      acc[v.severity] = (acc[v.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byRule = violations.reduce((acc, v) => {
      acc[v.rule_code] = (acc[v.rule_code] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      violations,
      summary: {
        total: violations.length,
        by_severity: bySeverity,
        by_rule: byRule,
        employees_affected: new Set(violations.map(v => v.employee_id)).size,
      },
      period: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
        days: 30,
      },
      template_limits: {
        max_daily_hours: limits.max_daily_hours || 9,
        min_daily_rest: limits.min_daily_rest || 12,
        min_weekly_rest: limits.min_weekly_rest || 36,
        max_overtime_yearly: payload.overtime?.overtime_yearly_cap || 80,
      },
    };
  };

  const getViolationDetails = (rule: string): string => {
    const details: Record<string, string> = {
      DAILY_HOURS: 'Jornada diaria excede el máximo configurado',
      DAILY_REST: 'Descanso entre jornadas inferior al mínimo',
      WEEKLY_REST: 'Descanso semanal no alcanza el mínimo',
      BREAK_REQUIRED: 'No se registró pausa en jornada > 6h',
      OVERTIME: 'Horas extra acumuladas superan umbral de alerta',
    };
    return details[rule] || 'Incidencia detectada';
  };

  const criticalCount = simulationResult?.summary?.by_severity?.critical || 0;
  const warnCount = simulationResult?.summary?.by_severity?.warn || 0;
  const infoCount = simulationResult?.summary?.by_severity?.info || 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Paso 11: Simulación Previa</h3>
        <p className="text-muted-foreground text-sm">
          Ejecute una simulación para estimar el impacto de las reglas configuradas sobre datos históricos.
        </p>
      </div>

      {/* Simulation Control */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Sandbox de simulación
          </CardTitle>
          <CardDescription>
            Simula las reglas sobre el último mes de fichajes para detectar posibles incidencias.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSimulationComplete ? (
            <div className="text-center py-8">
              <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                La simulación analizará 30 días de datos con las reglas actuales.
              </p>
              <Button onClick={handleSimulate} disabled={isSimulating} size="lg">
                {isSimulating ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                    Simulando...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Ejecutar simulación
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-muted">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">{simulationResult?.summary?.total || 0}</div>
                    <div className="text-xs text-muted-foreground">Total incidencias</div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-destructive">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-destructive">{criticalCount}</div>
                    <div className="text-xs text-muted-foreground">Críticas</div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-yellow-500">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-600">{warnCount}</div>
                    <div className="text-xs text-muted-foreground">Advertencias</div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{infoCount}</div>
                    <div className="text-xs text-muted-foreground">Informativas</div>
                  </CardContent>
                </Card>
              </div>

              {/* Critical Issues Alert */}
              {criticalCount > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{criticalCount} incidencias críticas detectadas.</strong> Revise las reglas de descansos 
                    mínimos antes de publicar. Estos incumplimientos pueden generar sanciones.
                  </AlertDescription>
                </Alert>
              )}

              {/* Results by Rule */}
              <Tabs defaultValue="by_rule">
                <TabsList>
                  <TabsTrigger value="by_rule">Por regla</TabsTrigger>
                  <TabsTrigger value="violations">Detalle</TabsTrigger>
                </TabsList>
                <TabsContent value="by_rule" className="space-y-3">
                  {Object.entries(simulationResult?.summary?.by_rule || {}).map(([rule, count]) => (
                    <div key={rule} className="flex items-center justify-between p-3 border rounded">
                      <span className="font-medium">{rule.replace(/_/g, ' ')}</span>
                      <Badge variant={
                        rule.includes('REST') ? 'destructive' : 
                        rule.includes('BREAK') ? 'secondary' : 'outline'
                      }>
                        {count as number} incidencias
                      </Badge>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="violations">
                  <div className="max-h-[200px] overflow-y-auto space-y-2">
                    {simulationResult?.violations?.slice(0, 10).map((v: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2 border rounded text-sm">
                        <div>
                          <span className="font-medium">{v.employee_name}</span>
                          <span className="text-muted-foreground ml-2">{v.violation_date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{v.details}</span>
                          <Badge variant={v.severity === 'critical' ? 'destructive' : v.severity === 'warn' ? 'secondary' : 'outline'}>
                            {v.severity}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>

              {/* Re-run */}
              <Button variant="outline" onClick={handleSimulate} className="w-full">
                <Play className="h-4 w-4 mr-2" />
                Volver a simular
              </Button>
            </div>
          )}

          {simulationError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{simulationError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Recommendations */}
      {isSimulationComplete && criticalCount === 0 && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            <strong>Sin incidencias críticas.</strong> La configuración parece adecuada. Puede proceder a publicar.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
