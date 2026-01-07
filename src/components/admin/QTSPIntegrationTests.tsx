import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  PlayCircle, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Clock, 
  FileSignature,
  Bell,
  FileText,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";

interface TestResult {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'warning';
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  response?: Record<string, unknown>;
  error?: string;
  validations?: ValidationResult[];
}

interface ValidationResult {
  field: string;
  expected: string;
  actual: string;
  passed: boolean;
}

const TESTS_CONFIG = [
  {
    id: 'health_check',
    name: 'Health Check',
    description: 'Verifica conectividad y autenticación con Digital Trust API',
    action: 'health_check',
    icon: Clock,
    validations: [
      { field: 'status', expected: 'healthy | degraded', validator: (v: string) => ['healthy', 'degraded'].includes(v) },
      { field: 'auth', expected: 'true', validator: (v: boolean) => v === true },
      { field: 'api', expected: 'true', validator: (v: boolean) => v === true },
    ]
  },
  {
    id: 'timestamp_daily',
    name: 'Sellado de Tiempo (Daily Root)',
    description: 'Crea un timestamp para el hash diario de eventos',
    action: 'timestamp_daily',
    icon: Clock,
    requiresCompany: true,
    validations: [
      { field: 'tsp_token', expected: 'string (no vacío)', validator: (v: string) => typeof v === 'string' && v.length > 0 },
      { field: 'status', expected: 'completed | processing', validator: (v: string) => ['completed', 'processing'].includes(v) },
    ]
  },
  {
    id: 'timestamp_notification',
    name: 'Sellado de Notificación',
    description: 'Timestamp de una notificación de compliance',
    action: 'timestamp_notification',
    icon: Bell,
    requiresCompany: true,
    validations: [
      { field: 'evidence_id', expected: 'UUID válido', validator: (v: string) => /^[0-9a-f-]{36}$/i.test(v) },
      { field: 'status', expected: 'completed | processing', validator: (v: string) => ['completed', 'processing'].includes(v) },
    ]
  },
  {
    id: 'seal_pdf_simple',
    name: 'Firma PDF (PADES_LTV SIMPLE)',
    description: 'Genera firma simple con un factor de autenticación',
    action: 'seal_pdf',
    icon: FileSignature,
    requiresCompany: true,
    validations: [
      { field: 'signature.level', expected: 'SIMPLE', validator: (v: string) => v === 'SIMPLE' },
      { field: 'signature.type', expected: 'PADES_LTV', validator: (v: string) => v === 'PADES_LTV' },
      { field: 'signature.authenticationFactor', expected: '1', validator: (v: number) => v === 1 },
      { field: 'sealed_pdf_path', expected: 'string (path válido)', validator: (v: string) => typeof v === 'string' && v.length > 0 },
    ]
  },
  {
    id: 'check_status',
    name: 'Verificar Estado de Evidencias',
    description: 'Consulta el estado de evidencias pendientes en QTSP',
    action: 'check_status',
    icon: RefreshCw,
    requiresCompany: true,
    validations: [
      { field: 'checked', expected: 'number >= 0', validator: (v: number) => typeof v === 'number' && v >= 0 },
      { field: 'updated', expected: 'number >= 0', validator: (v: number) => typeof v === 'number' && v >= 0 },
    ]
  }
];

export function QTSPIntegrationTests() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [runningAll, setRunningAll] = useState(false);

  // Get companies for selection
  const { data: companies } = useQuery({
    queryKey: ['companies-for-qtsp-test'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Get company's daily roots for testing
  const { data: dailyRoots } = useQuery({
    queryKey: ['daily-roots-for-test', selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const { data, error } = await supabase
        .from('daily_roots')
        .select('id, date, root_hash')
        .eq('company_id', selectedCompanyId)
        .order('date', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompanyId
  });

  const runTest = async (testConfig: typeof TESTS_CONFIG[0]): Promise<TestResult> => {
    const startedAt = new Date();
    const testResult: TestResult = {
      id: testConfig.id,
      name: testConfig.name,
      description: testConfig.description,
      status: 'running',
      startedAt,
    };

    setTestResults(prev => {
      const existing = prev.findIndex(t => t.id === testConfig.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = testResult;
        return updated;
      }
      return [...prev, testResult];
    });

    try {
      let requestBody: Record<string, unknown> = { action: testConfig.action };

      // Add company-specific data for tests that require it
      if (testConfig.requiresCompany && selectedCompanyId) {
        requestBody.company_id = selectedCompanyId;

        // Special handling for different test types
        if (testConfig.action === 'timestamp_daily' && dailyRoots && dailyRoots.length > 0) {
          requestBody.daily_root_id = dailyRoots[0].id;
          requestBody.date = dailyRoots[0].date;
          requestBody.root_hash = dailyRoots[0].root_hash;
        }

        if (testConfig.action === 'seal_pdf') {
          // Create a test PDF request
          const currentMonth = format(new Date(), 'yyyy-MM');
          requestBody.report_month = currentMonth;
          requestBody.test_mode = true; // Signal that this is a test
        }

        if (testConfig.action === 'timestamp_notification') {
          requestBody.test_mode = true;
        }
      }

      const { data, error } = await supabase.functions.invoke('qtsp-notarize', {
        body: requestBody,
      });

      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      if (error) {
        throw new Error(error.message);
      }

      // Run validations
      const validations: ValidationResult[] = [];
      let hasFailedValidation = false;

      for (const validation of testConfig.validations) {
        const fieldPath = validation.field.split('.');
        let actualValue: unknown = data;
        for (const key of fieldPath) {
          actualValue = (actualValue as Record<string, unknown>)?.[key];
        }

        const passed = validation.validator(actualValue as never);
        if (!passed) hasFailedValidation = true;

        validations.push({
          field: validation.field,
          expected: validation.expected,
          actual: actualValue !== undefined ? String(actualValue) : 'undefined',
          passed,
        });
      }

      // Special validation for seal_pdf - check the request that was sent
      if (testConfig.id === 'seal_pdf_simple') {
        // Add validation for signature configuration from response metadata
        if (data?.signature_config) {
          const sigLevel = data.signature_config.level;
          const sigType = data.signature_config.type;
          const sigFactor = data.signature_config.authenticationFactor;

          validations.push({
            field: 'request.signature.level',
            expected: 'SIMPLE',
            actual: sigLevel || 'no configurado',
            passed: sigLevel === 'SIMPLE',
          });
          validations.push({
            field: 'request.signature.type',
            expected: 'PADES_LTV',
            actual: sigType || 'no configurado',
            passed: sigType === 'PADES_LTV',
          });
          validations.push({
            field: 'request.signature.authenticationFactor',
            expected: '1',
            actual: String(sigFactor ?? 'no configurado'),
            passed: sigFactor === 1,
          });
        }
      }

      const finalResult: TestResult = {
        ...testResult,
        status: hasFailedValidation ? 'warning' : 'success',
        completedAt,
        durationMs,
        response: data,
        validations,
      };

      setTestResults(prev => {
        const idx = prev.findIndex(t => t.id === testConfig.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = finalResult;
          return updated;
        }
        return prev;
      });

      return finalResult;

    } catch (err) {
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';

      const failedResult: TestResult = {
        ...testResult,
        status: 'failed',
        completedAt,
        durationMs,
        error: errorMessage,
      };

      setTestResults(prev => {
        const idx = prev.findIndex(t => t.id === testConfig.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = failedResult;
          return updated;
        }
        return prev;
      });

      return failedResult;
    }
  };

  const runSingleTest = async (testId: string) => {
    const testConfig = TESTS_CONFIG.find(t => t.id === testId);
    if (!testConfig) return;

    if (testConfig.requiresCompany && !selectedCompanyId) {
      toast.error('Selecciona una empresa para ejecutar este test');
      return;
    }

    await runTest(testConfig);
  };

  const runAllTests = async () => {
    if (!selectedCompanyId) {
      toast.error('Selecciona una empresa para ejecutar los tests');
      return;
    }

    setRunningAll(true);
    setTestResults([]);

    let passed = 0;
    let failed = 0;
    let warnings = 0;

    for (const testConfig of TESTS_CONFIG) {
      const result = await runTest(testConfig);
      if (result.status === 'success') passed++;
      else if (result.status === 'warning') warnings++;
      else failed++;
    }

    setRunningAll(false);

    if (failed === 0 && warnings === 0) {
      toast.success(`✅ Todos los tests pasaron (${passed}/${TESTS_CONFIG.length})`);
    } else if (failed === 0) {
      toast.warning(`⚠️ Tests completados con advertencias: ${warnings} warnings`);
    } else {
      toast.error(`❌ Tests fallidos: ${failed}, Warnings: ${warnings}`);
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pendiente</Badge>;
      case 'running':
        return <Badge variant="secondary" className="gap-1"><Loader2 className="w-3 h-3 animate-spin" />Ejecutando</Badge>;
      case 'success':
        return <Badge className="bg-green-600 gap-1"><CheckCircle className="w-3 h-3" />Éxito</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Fallido</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-500 text-white gap-1"><AlertTriangle className="w-3 h-3" />Advertencia</Badge>;
    }
  };

  const getTestResult = (testId: string) => testResults.find(t => t.id === testId);

  return (
    <div className="space-y-6">
      {/* Test Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="w-5 h-5" />
            Tests de Integración QTSP
          </CardTitle>
          <CardDescription>
            Valida las invocaciones al QTSP: sellado de tiempo, notificaciones y firma PADES_LTV simple
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Empresa para Tests</label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empresa..." />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map(company => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={runAllTests} 
              disabled={!selectedCompanyId || runningAll}
              className="gap-2"
            >
              {runningAll ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PlayCircle className="w-4 h-4" />
              )}
              Ejecutar Todos
            </Button>
          </div>

          {/* Info about signature config */}
          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
            <p className="font-medium flex items-center gap-2">
              <FileSignature className="w-4 h-4" />
              Configuración de Firma Actual
            </p>
            <ul className="text-muted-foreground text-xs list-disc list-inside space-y-1">
              <li><strong>Tipo:</strong> PADES_LTV (firma de larga validación)</li>
              <li><strong>Nivel:</strong> SIMPLE (un solo factor de autenticación)</li>
              <li><strong>authenticationFactor:</strong> 1</li>
              <li><strong>Proveedor:</strong> EADTRUST</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Tests List */}
      <Card>
        <CardHeader>
          <CardTitle>Suite de Tests</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Test</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Validaciones</TableHead>
                <TableHead className="w-[100px]">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TESTS_CONFIG.map(test => {
                const result = getTestResult(test.id);
                const Icon = test.icon;
                const isRunning = result?.status === 'running';

                return (
                  <TableRow key={test.id}>
                    <TableCell>
                      <Icon className="w-5 h-5 text-muted-foreground" />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{test.name}</p>
                        <p className="text-xs text-muted-foreground">{test.description}</p>
                        {test.requiresCompany && (
                          <Badge variant="outline" className="mt-1 text-xs">Requiere empresa</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {result ? getStatusBadge(result.status) : <Badge variant="outline">No ejecutado</Badge>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {result?.durationMs ? `${result.durationMs}ms` : '-'}
                    </TableCell>
                    <TableCell>
                      {result?.validations && (
                        <div className="text-xs space-y-1">
                          {result.validations.map((v, i) => (
                            <div key={i} className={`flex items-center gap-1 ${v.passed ? 'text-green-600' : 'text-destructive'}`}>
                              {v.passed ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              <span>{v.field}: {v.actual}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {result?.error && (
                        <span className="text-xs text-destructive">{result.error}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runSingleTest(test.id)}
                        disabled={isRunning || runningAll || (test.requiresCompany && !selectedCompanyId)}
                      >
                        {isRunning ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <PlayCircle className="w-4 h-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detailed Results */}
      {testResults.some(t => t.response || t.error) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Respuestas Detalladas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {testResults.filter(t => t.response || t.error).map(result => (
                <div key={result.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{result.name}</h4>
                    {getStatusBadge(result.status)}
                  </div>
                  {result.response && (
                    <pre className="bg-muted p-3 rounded text-xs overflow-x-auto max-h-[200px]">
                      {JSON.stringify(result.response, null, 2)}
                    </pre>
                  )}
                  {result.error && (
                    <div className="bg-destructive/10 text-destructive p-3 rounded text-xs">
                      {result.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
