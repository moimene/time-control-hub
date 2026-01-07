import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, FileJson, FileText, Shield, CheckCircle, Loader2 } from 'lucide-react';

interface EvidenceExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string;
  threadSubject: string;
  certificationLevel?: string;
  evidenceCount?: number;
}

export function EvidenceExportDialog({
  open,
  onOpenChange,
  threadId,
  threadSubject,
  certificationLevel = 'basic',
  evidenceCount = 0
}: EvidenceExportDialogProps) {
  const [format, setFormat] = useState<'json' | 'pdf'>('pdf');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('message-export-evidence', {
        body: { thread_id: threadId, format }
      });

      if (error) throw error;

      // Handle the response based on format
      if (format === 'pdf') {
        // For PDF, data comes as base64 or we need to handle differently
        const blob = new Blob([data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `certificado-${threadId.slice(0, 8)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // For JSON
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `evidencia-${threadId.slice(0, 8)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      toast.success('Evidencia exportada correctamente');
      onOpenChange(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Error al exportar la evidencia');
    } finally {
      setIsExporting(false);
    }
  };

  const certLevelConfig = {
    basic: { label: 'Básico', color: 'secondary', icon: CheckCircle },
    timestamped: { label: 'Sellado temporal', color: 'default', icon: Shield },
    qualified: { label: 'Cualificado QTSP', color: 'default', icon: Shield },
  };

  const config = certLevelConfig[certificationLevel as keyof typeof certLevelConfig] || certLevelConfig.basic;
  const CertIcon = config.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar Evidencia
          </DialogTitle>
          <DialogDescription>
            Descarga el paquete de evidencias certificadas para esta comunicación
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted/50 p-3 rounded-lg space-y-2">
            <p className="font-medium text-sm">{threadSubject}</p>
            <div className="flex items-center gap-2">
              <Badge variant={config.color as any} className="gap-1">
                <CertIcon className="h-3 w-3" />
                {config.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {evidenceCount} eventos registrados
              </span>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-sm font-medium">Formato de exportación</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as 'json' | 'pdf')}>
              <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="pdf" id="pdf" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="pdf" className="flex items-center gap-2 cursor-pointer font-medium">
                    <FileText className="h-4 w-4 text-red-600" />
                    Certificado PDF
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Documento formal con resumen de la comunicación y cadena de evidencias
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="json" id="json" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="json" className="flex items-center gap-2 cursor-pointer font-medium">
                    <FileJson className="h-4 w-4 text-blue-600" />
                    Paquete JSON
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Datos estructurados completos, ideal para verificación técnica o integración
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {certificationLevel === 'qualified' && (
            <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg text-sm">
              <Shield className="h-4 w-4 text-primary" />
              <span>Este paquete incluye sellos de tiempo cualificados QTSP</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Descargar {format.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
