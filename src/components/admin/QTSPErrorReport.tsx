import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileText, 
  Download, 
  Copy, 
  AlertCircle,
  Clock,
  Server,
  TrendingUp
} from "lucide-react";
import { format, subDays, subHours } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

interface QTSPLog {
  id: string;
  created_at: string;
  action: string;
  status: string;
  duration_ms?: number | null;
  error_message?: string | null;
  request_payload?: Record<string, unknown> | null;
  response_payload?: Record<string, unknown> | null;
  company?: { name: string } | null;
}

interface QTSPErrorReportProps {
  logs: QTSPLog[];
  healthCheckLogs: QTSPLog[];
}

type ErrorCategory = 'DNS_ERROR' | 'TIMEOUT' | 'HTTP_4XX' | 'HTTP_5XX' | 'CONNECTION_REFUSED' | 'SSL_ERROR' | 'UNKNOWN';

function categorizeError(message: string | undefined | null): ErrorCategory {
  if (!message) return 'UNKNOWN';
  
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('dns') || lowerMessage.includes('name or service not known') || lowerMessage.includes('lookup')) {
    return 'DNS_ERROR';
  }
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return 'TIMEOUT';
  }
  if (lowerMessage.includes('401') || lowerMessage.includes('403') || lowerMessage.includes('404') || lowerMessage.includes('unauthorized') || lowerMessage.includes('forbidden')) {
    return 'HTTP_4XX';
  }
  if (lowerMessage.includes('500') || lowerMessage.includes('502') || lowerMessage.includes('503') || lowerMessage.includes('504') || lowerMessage.includes('internal server')) {
    return 'HTTP_5XX';
  }
  if (lowerMessage.includes('connection refused') || lowerMessage.includes('connect error') || lowerMessage.includes('econnrefused')) {
    return 'CONNECTION_REFUSED';
  }
  if (lowerMessage.includes('ssl') || lowerMessage.includes('certificate') || lowerMessage.includes('tls')) {
    return 'SSL_ERROR';
  }
  
  return 'UNKNOWN';
}

function extractErrorMessage(log: QTSPLog): string | null {
  const responsePayload = log.response_payload as Record<string, unknown> | null;
  if (responsePayload?.message && typeof responsePayload.message === 'string') {
    return responsePayload.message;
  }
  return log.error_message || null;
}

const categoryLabels: Record<ErrorCategory, string> = {
  DNS_ERROR: 'Error de resolución DNS',
  TIMEOUT: 'Timeout de conexión',
  HTTP_4XX: 'Error de cliente HTTP (4xx)',
  HTTP_5XX: 'Error de servidor HTTP (5xx)',
  CONNECTION_REFUSED: 'Conexión rechazada',
  SSL_ERROR: 'Error de certificado SSL/TLS',
  UNKNOWN: 'Error no clasificado',
};

const categoryColors: Record<ErrorCategory, string> = {
  DNS_ERROR: 'bg-orange-500',
  TIMEOUT: 'bg-yellow-500',
  HTTP_4XX: 'bg-amber-500',
  HTTP_5XX: 'bg-red-600',
  CONNECTION_REFUSED: 'bg-red-500',
  SSL_ERROR: 'bg-purple-500',
  UNKNOWN: 'bg-muted',
};

export function QTSPErrorReport({ logs, healthCheckLogs }: QTSPErrorReportProps) {
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');

  const getFilterDate = () => {
    switch (timeRange) {
      case '1h': return subHours(new Date(), 1);
      case '6h': return subHours(new Date(), 6);
      case '24h': return subDays(new Date(), 1);
      case '7d': return subDays(new Date(), 7);
    }
  };

  const filterDate = getFilterDate();
  
  // Filter logs by time range
  const filteredLogs = logs.filter(log => new Date(log.created_at) >= filterDate);
  const filteredHealthLogs = healthCheckLogs.filter(log => new Date(log.created_at) >= filterDate);
  
  // Get only error logs
  const errorLogs = filteredLogs.filter(log => log.status !== 'success');
  const errorHealthLogs = filteredHealthLogs.filter(log => log.status !== 'success');
  
  // Combine and categorize errors
  const allErrorLogs = [...errorLogs, ...errorHealthLogs];
  
  const errorsByCategory = allErrorLogs.reduce((acc, log) => {
    const message = extractErrorMessage(log);
    const category = categorizeError(message);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push({ ...log, errorMessage: message });
    return acc;
  }, {} as Record<ErrorCategory, (QTSPLog & { errorMessage: string | null })[]>);

  // Get unique error messages for the report
  const uniqueErrors = new Map<string, { count: number; lastSeen: string; category: ErrorCategory }>();
  allErrorLogs.forEach(log => {
    const message = extractErrorMessage(log) || 'Error desconocido';
    const existing = uniqueErrors.get(message);
    if (existing) {
      existing.count++;
      if (new Date(log.created_at) > new Date(existing.lastSeen)) {
        existing.lastSeen = log.created_at;
      }
    } else {
      uniqueErrors.set(message, {
        count: 1,
        lastSeen: log.created_at,
        category: categorizeError(message),
      });
    }
  });

  // Sort by frequency
  const sortedErrors = Array.from(uniqueErrors.entries())
    .sort((a, b) => b[1].count - a[1].count);

  const generateTextReport = (): string => {
    const lines = [
      '═══════════════════════════════════════════════════════════════',
      '                INFORME TÉCNICO DE ERRORES QTSP                ',
      '═══════════════════════════════════════════════════════════════',
      '',
      `Generado: ${format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: es })}`,
      `Período analizado: ${timeRange === '1h' ? 'Última hora' : timeRange === '6h' ? 'Últimas 6 horas' : timeRange === '24h' ? 'Últimas 24 horas' : 'Últimos 7 días'}`,
      `Rango de fechas: ${format(filterDate, "dd/MM/yyyy HH:mm", { locale: es })} - ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`,
      '',
      '───────────────────────────────────────────────────────────────',
      '                         RESUMEN                               ',
      '───────────────────────────────────────────────────────────────',
      '',
      `Total de errores: ${allErrorLogs.length}`,
      `Operaciones afectadas: ${errorLogs.length}`,
      `Health checks fallidos: ${errorHealthLogs.length}`,
      '',
      'Errores por categoría:',
      ...Object.entries(errorsByCategory).map(([cat, logs]) => 
        `  • ${categoryLabels[cat as ErrorCategory]}: ${logs.length} ocurrencias`
      ),
      '',
      '───────────────────────────────────────────────────────────────',
      '                   ERRORES ÚNICOS                              ',
      '───────────────────────────────────────────────────────────────',
      '',
      ...sortedErrors.map(([message, info], idx) => [
        `${idx + 1}. [${info.category}] (${info.count}x)`,
        `   Última vez: ${format(new Date(info.lastSeen), "dd/MM/yyyy HH:mm:ss", { locale: es })}`,
        `   Mensaje: ${message}`,
        '',
      ]).flat(),
      '───────────────────────────────────────────────────────────────',
      '              ÚLTIMOS 10 ERRORES DETALLADOS                    ',
      '───────────────────────────────────────────────────────────────',
      '',
      ...allErrorLogs.slice(0, 10).map((log, idx) => [
        `${idx + 1}. ${format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: es })}`,
        `   Acción: ${log.action}`,
        `   Estado: ${log.status}`,
        `   Duración: ${log.duration_ms || 'N/A'}ms`,
        `   Empresa: ${log.company?.name || 'N/A'}`,
        `   Error: ${extractErrorMessage(log) || 'No disponible'}`,
        '',
      ]).flat(),
      '═══════════════════════════════════════════════════════════════',
      '                    FIN DEL INFORME                            ',
      '═══════════════════════════════════════════════════════════════',
    ];
    
    return lines.join('\n');
  };

  const generateJsonReport = () => ({
    generated_at: new Date().toISOString(),
    time_range: timeRange,
    date_range: {
      from: filterDate.toISOString(),
      to: new Date().toISOString(),
    },
    summary: {
      total_errors: allErrorLogs.length,
      operations_affected: errorLogs.length,
      failed_health_checks: errorHealthLogs.length,
      by_category: Object.entries(errorsByCategory).map(([cat, logs]) => ({
        category: cat,
        label: categoryLabels[cat as ErrorCategory],
        count: logs.length,
      })),
    },
    unique_errors: sortedErrors.map(([message, info]) => ({
      message,
      category: info.category,
      category_label: categoryLabels[info.category],
      occurrences: info.count,
      last_seen: info.lastSeen,
    })),
    recent_errors: allErrorLogs.slice(0, 10).map(log => ({
      timestamp: log.created_at,
      action: log.action,
      status: log.status,
      duration_ms: log.duration_ms,
      company: log.company?.name,
      error_message: extractErrorMessage(log),
      request_payload: log.request_payload,
      response_payload: log.response_payload,
    })),
  });

  const copyReport = (format: 'text' | 'json') => {
    const content = format === 'text' 
      ? generateTextReport() 
      : JSON.stringify(generateJsonReport(), null, 2);
    navigator.clipboard.writeText(content);
    toast.success(`Informe ${format.toUpperCase()} copiado al portapapeles`);
  };

  const downloadReport = (reportFormat: 'text' | 'json') => {
    const content = reportFormat === 'text' 
      ? generateTextReport() 
      : JSON.stringify(generateJsonReport(), null, 2);
    const blob = new Blob([content], { type: reportFormat === 'text' ? 'text/plain' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = format(new Date(), 'yyyyMMdd-HHmmss');
    a.download = `qtsp-error-report-${timestamp}.${reportFormat === 'text' ? 'txt' : 'json'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Informe ${reportFormat.toUpperCase()} descargado`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Informe de Errores para QTSP
            </CardTitle>
            <CardDescription>
              Genera un informe técnico para compartir con el proveedor Digital Trust
            </CardDescription>
          </div>
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Última hora</SelectItem>
              <SelectItem value="6h">Últimas 6h</SelectItem>
              <SelectItem value="24h">Últimas 24h</SelectItem>
              <SelectItem value="7d">Últimos 7 días</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{allErrorLogs.length}</p>
            <p className="text-xs text-muted-foreground">Errores totales</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{errorLogs.length}</p>
            <p className="text-xs text-muted-foreground">Operaciones</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{errorHealthLogs.length}</p>
            <p className="text-xs text-muted-foreground">Health checks</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{sortedErrors.length}</p>
            <p className="text-xs text-muted-foreground">Tipos únicos</p>
          </div>
        </div>

        <Separator />

        {/* Error categories breakdown */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Errores por categoría
          </h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(errorsByCategory).map(([category, logs]) => (
              <Badge 
                key={category} 
                className={`${categoryColors[category as ErrorCategory]} text-white`}
              >
                {categoryLabels[category as ErrorCategory]}: {logs.length}
              </Badge>
            ))}
            {Object.keys(errorsByCategory).length === 0 && (
              <p className="text-sm text-muted-foreground">No hay errores en este período</p>
            )}
          </div>
        </div>

        {/* Top errors */}
        {sortedErrors.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Errores más frecuentes (Top 5)
              </h4>
              <div className="space-y-2">
                {sortedErrors.slice(0, 5).map(([message, info], idx) => (
                  <div key={idx} className="bg-muted/30 rounded-md p-2 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">{info.count}x</Badge>
                      <Badge className={categoryColors[info.category]}>{info.category}</Badge>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(info.lastSeen), "dd/MM HH:mm", { locale: es })}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-muted-foreground truncate">{message}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Export buttons */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => copyReport('text')}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar Texto
          </Button>
          <Button variant="outline" size="sm" onClick={() => copyReport('json')}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar JSON
          </Button>
          <Button variant="default" size="sm" onClick={() => downloadReport('text')}>
            <Download className="h-4 w-4 mr-2" />
            Descargar .txt
          </Button>
          <Button variant="default" size="sm" onClick={() => downloadReport('json')}>
            <Download className="h-4 w-4 mr-2" />
            Descargar .json
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
