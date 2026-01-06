import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FileText, FileSpreadsheet, Shield, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { IntegrityBadge } from './IntegrityBadge';

interface Deliverable {
  name: string;
  type: string;
  sha256: string;
  rows?: number;
}

interface PreCheck {
  type: 'error' | 'warning' | 'info';
  message: string;
  details?: any[];
}

interface QTSPEvidence {
  date: string;
  daily_root_hash: string;
  tsp_token: string;
  tsp_timestamp: string;
}

interface PackagePreviewProps {
  manifest: {
    version: string;
    company: { id: string; name: string; cif: string };
    period: { start: string; end: string };
    itss_reference?: {
      expedient_id: string;
      request_date: string;
      contact_person: string;
    };
    deliverables: Deliverable[];
    qtsp_evidences: QTSPEvidence[];
    integrity: { algorithm: string; package_hash: string };
    generated_at: string;
  };
  preChecks: PreCheck[];
}

export function PackagePreview({ manifest, preChecks }: PackagePreviewProps) {
  const getFileIcon = (type: string) => {
    switch (type) {
      case 'csv':
        return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
      case 'json':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'markdown':
        return <FileText className="h-4 w-4 text-purple-500" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getCheckIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Resumen del Paquete</CardTitle>
            <IntegrityBadge hash={manifest.integrity.package_hash} />
          </div>
          <CardDescription>
            {manifest.company.name} ({manifest.company.cif})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Período</span>
              <p className="font-medium">
                {manifest.period.start} - {manifest.period.end}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Archivos</span>
              <p className="font-medium">{manifest.deliverables.length}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Evidencias QTSP</span>
              <p className="font-medium">{manifest.qtsp_evidences.length}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Generado</span>
              <p className="font-medium">
                {new Date(manifest.generated_at).toLocaleString('es-ES')}
              </p>
            </div>
          </div>
          
          {manifest.itss_reference && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Referencia ITSS</p>
              <p className="text-sm text-muted-foreground">
                Expediente: {manifest.itss_reference.expedient_id}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pre-checks */}
      {preChecks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Verificaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {preChecks.map((check, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-2 rounded-lg bg-muted/50"
                >
                  {getCheckIcon(check.type)}
                  <div>
                    <p className="text-sm font-medium">{check.message}</p>
                    {check.details && check.details.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {check.details.slice(0, 3).map((d, j) => (
                          <span key={j} className="block">
                            {d.employee} - {d.date}
                          </span>
                        ))}
                        {check.details.length > 3 && (
                          <span>... y {check.details.length - 3} más</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deliverables */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Contenido del Paquete</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="deliverables">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {manifest.deliverables.length} archivos
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {manifest.deliverables.map((d, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        {getFileIcon(d.type)}
                        <span className="text-sm font-medium">{d.name}</span>
                        {d.rows !== undefined && (
                          <Badge variant="secondary" className="text-xs">
                            {d.rows} registros
                          </Badge>
                        )}
                      </div>
                      <code className="text-xs text-muted-foreground">
                        {d.sha256?.substring(0, 12)}...
                      </code>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="evidences">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  {manifest.qtsp_evidences.length} evidencias QTSP
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {manifest.qtsp_evidences.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No hay evidencias QTSP en el período seleccionado
                    </p>
                  ) : (
                    manifest.qtsp_evidences.slice(0, 20).map((e, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{e.date}</span>
                        </div>
                        <code className="text-xs text-muted-foreground">
                          {e.tsp_token?.substring(0, 16)}...
                        </code>
                      </div>
                    ))
                  )}
                  {manifest.qtsp_evidences.length > 20 && (
                    <p className="text-sm text-muted-foreground text-center">
                      ... y {manifest.qtsp_evidences.length - 20} más
                    </p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
