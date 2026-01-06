import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  Copy, 
  Clock, 
  Server, 
  AlertCircle, 
  CheckCircle, 
  Wifi,
  FileCode,
  Timer
} from "lucide-react";
import { toast } from "sonner";

interface QTSPLogDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: {
    id: string;
    created_at: string;
    action: string;
    status: string;
    duration_ms?: number | null;
    error_message?: string | null;
    request_payload?: Record<string, unknown> | null;
    response_payload?: Record<string, unknown> | null;
    company?: { name: string } | null;
  } | null;
}

type ErrorCategory = 'DNS_ERROR' | 'TIMEOUT' | 'HTTP_4XX' | 'HTTP_5XX' | 'CONNECTION_REFUSED' | 'SSL_ERROR' | 'UNKNOWN';

function categorizeError(message: string | undefined | null): { category: ErrorCategory; label: string; color: string } {
  if (!message) return { category: 'UNKNOWN', label: 'Desconocido', color: 'bg-muted' };
  
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('dns') || lowerMessage.includes('name or service not known') || lowerMessage.includes('lookup')) {
    return { category: 'DNS_ERROR', label: 'Error DNS', color: 'bg-orange-500' };
  }
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return { category: 'TIMEOUT', label: 'Timeout', color: 'bg-yellow-500' };
  }
  if (lowerMessage.includes('401') || lowerMessage.includes('403') || lowerMessage.includes('404') || lowerMessage.includes('unauthorized') || lowerMessage.includes('forbidden')) {
    return { category: 'HTTP_4XX', label: 'Error HTTP 4xx', color: 'bg-amber-500' };
  }
  if (lowerMessage.includes('500') || lowerMessage.includes('502') || lowerMessage.includes('503') || lowerMessage.includes('504') || lowerMessage.includes('internal server')) {
    return { category: 'HTTP_5XX', label: 'Error HTTP 5xx', color: 'bg-red-600' };
  }
  if (lowerMessage.includes('connection refused') || lowerMessage.includes('connect error') || lowerMessage.includes('econnrefused')) {
    return { category: 'CONNECTION_REFUSED', label: 'Conexión rechazada', color: 'bg-red-500' };
  }
  if (lowerMessage.includes('ssl') || lowerMessage.includes('certificate') || lowerMessage.includes('tls')) {
    return { category: 'SSL_ERROR', label: 'Error SSL/TLS', color: 'bg-purple-500' };
  }
  
  return { category: 'UNKNOWN', label: 'Otro error', color: 'bg-muted' };
}

function extractErrorMessage(log: QTSPLogDetailModalProps['log']): string | null {
  if (!log) return null;
  
  // Try to get message from response_payload first
  const responsePayload = log.response_payload as Record<string, unknown> | null;
  if (responsePayload?.message && typeof responsePayload.message === 'string') {
    return responsePayload.message;
  }
  
  // Fall back to error_message
  return log.error_message || null;
}

export function QTSPLogDetailModal({ open, onOpenChange, log }: QTSPLogDetailModalProps) {
  if (!log) return null;

  const errorMessage = extractErrorMessage(log);
  const errorCategory = categorizeError(errorMessage);
  
  const copyToClipboard = (content: string, label: string) => {
    navigator.clipboard.writeText(content);
    toast.success(`${label} copiado al portapapeles`);
  };

  const formatPayload = (payload: Record<string, unknown> | null | undefined): string => {
    if (!payload) return 'No disponible';
    return JSON.stringify(payload, null, 2);
  };

  const getStatusIcon = () => {
    if (log.status === 'success') return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (log.status === 'partial') return <Wifi className="h-5 w-5 text-yellow-500" />;
    return <AlertCircle className="h-5 w-5 text-destructive" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            Detalle Técnico de Operación QTSP
          </DialogTitle>
          <DialogDescription>
            Información completa para diagnóstico y reporte al proveedor
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Fecha y hora
                </label>
                <p className="font-mono text-sm">
                  {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss.SSS", { locale: es })}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Server className="h-3 w-3" />
                  Acción
                </label>
                <Badge variant="outline" className="font-mono">{log.action}</Badge>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Estado</label>
                <div className="flex items-center gap-2">
                  {getStatusIcon()}
                  <Badge 
                    variant={log.status === 'success' ? 'default' : 'destructive'}
                    className={log.status === 'success' ? 'bg-green-600' : ''}
                  >
                    {log.status === 'success' ? 'Exitoso' : log.status === 'partial' ? 'Parcial' : 'Error'}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  Duración
                </label>
                <p className="font-mono text-sm">{log.duration_ms ? `${log.duration_ms}ms` : 'N/A'}</p>
              </div>
              {log.company?.name && (
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Empresa</label>
                  <p className="text-sm">{log.company.name}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Error Analysis */}
            {log.status !== 'success' && (
              <>
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    Análisis del Error
                  </h4>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Categoría:</span>
                    <Badge className={errorCategory.color}>{errorCategory.label}</Badge>
                    <span className="text-xs text-muted-foreground">({errorCategory.category})</span>
                  </div>
                  
                  {errorMessage && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-muted-foreground">Mensaje técnico completo</label>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => copyToClipboard(errorMessage, 'Mensaje de error')}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copiar
                        </Button>
                      </div>
                      <pre className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-xs font-mono whitespace-pre-wrap text-destructive overflow-x-auto">
                        {errorMessage}
                      </pre>
                    </div>
                  )}

                  {/* Diagnostic suggestion */}
                  <div className="bg-muted/50 rounded-md p-3">
                    <p className="text-xs font-medium mb-1">💡 Sugerencia de diagnóstico:</p>
                    <p className="text-xs text-muted-foreground">
                      {errorCategory.category === 'DNS_ERROR' && 
                        'Este error indica un problema de resolución de nombres DNS. Verificar conectividad de red y configuración DNS del servidor.'
                      }
                      {errorCategory.category === 'TIMEOUT' && 
                        'La solicitud tardó demasiado en responder. Posible sobrecarga del servidor QTSP o problemas de red.'
                      }
                      {errorCategory.category === 'HTTP_4XX' && 
                        'Error de cliente HTTP. Verificar credenciales, permisos o formato de la solicitud.'
                      }
                      {errorCategory.category === 'HTTP_5XX' && 
                        'Error del servidor QTSP. Reportar al proveedor Digital Trust con los detalles de esta operación.'
                      }
                      {errorCategory.category === 'CONNECTION_REFUSED' && 
                        'El servidor rechazó la conexión. Verificar que el servicio QTSP esté activo y accesible.'
                      }
                      {errorCategory.category === 'SSL_ERROR' && 
                        'Problema con el certificado SSL/TLS. Verificar validez del certificado del servidor.'
                      }
                      {errorCategory.category === 'UNKNOWN' && 
                        'Error no categorizado. Revisar los payloads completos para más información.'
                      }
                    </p>
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Request Payload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Request Payload</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => copyToClipboard(formatPayload(log.request_payload), 'Request payload')}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copiar
                </Button>
              </div>
              <pre className="bg-muted rounded-md p-3 text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-[200px]">
                {formatPayload(log.request_payload)}
              </pre>
            </div>

            {/* Response Payload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Response Payload</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => copyToClipboard(formatPayload(log.response_payload), 'Response payload')}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copiar
                </Button>
              </div>
              <pre className="bg-muted rounded-md p-3 text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-[200px]">
                {formatPayload(log.response_payload)}
              </pre>
            </div>

            {/* Copy All for Report */}
            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  const reportData = {
                    timestamp: log.created_at,
                    action: log.action,
                    status: log.status,
                    duration_ms: log.duration_ms,
                    error_category: errorCategory.category,
                    error_message: errorMessage,
                    company: log.company?.name,
                    request_payload: log.request_payload,
                    response_payload: log.response_payload,
                  };
                  copyToClipboard(JSON.stringify(reportData, null, 2), 'Informe completo');
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar Informe Completo (JSON)
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
