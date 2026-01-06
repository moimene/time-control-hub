import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileDown, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface QTSPLog {
  id: string;
  created_at: string;
  action: string;
  status: string;
  duration_ms: number | null;
  error_message: string | null;
  company_id: string | null;
  response_payload: any;
}

type ErrorCategory = 'DNS_ERROR' | 'TIMEOUT' | 'HTTP_4XX' | 'HTTP_5XX' | 'CONNECTION_REFUSED' | 'SSL_ERROR' | 'UNKNOWN';

function categorizeError(message: string | null | undefined): ErrorCategory {
  if (!message) return 'UNKNOWN';
  const msg = message.toLowerCase();
  if (msg.includes('dns') || msg.includes('name not known') || msg.includes('getaddrinfo')) return 'DNS_ERROR';
  if (msg.includes('timeout') || msg.includes('timed out')) return 'TIMEOUT';
  if (msg.includes('connection refused') || msg.includes('econnrefused')) return 'CONNECTION_REFUSED';
  if (msg.includes('ssl') || msg.includes('certificate') || msg.includes('tls')) return 'SSL_ERROR';
  if (msg.includes('401') || msg.includes('403') || msg.includes('404') || msg.includes('400')) return 'HTTP_4XX';
  if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) return 'HTTP_5XX';
  return 'UNKNOWN';
}

const TIME_RANGES = [
  { value: '7', label: 'Últimos 7 días' },
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
];

export function QTSPPDFExport() {
  const [timeRange, setTimeRange] = useState('30');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeDetails, setIncludeDetails] = useState(true);
  const [includeErrors, setIncludeErrors] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const generatePDF = async () => {
    setIsGenerating(true);
    
    try {
      // Fetch data
      const since = subDays(new Date(), parseInt(timeRange)).toISOString();
      const { data: logs, error } = await supabase
        .from('qtsp_audit_log')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const typedLogs = (logs || []) as QTSPLog[];

      // Calculate metrics
      const successLogs = typedLogs.filter(l => l.status === 'success');
      const errorLogs = typedLogs.filter(l => l.status === 'error');
      const successRate = typedLogs.length > 0 ? (successLogs.length / typedLogs.length) * 100 : 100;
      
      const durations = typedLogs
        .filter(l => l.duration_ms !== null)
        .map(l => l.duration_ms as number)
        .sort((a, b) => a - b);
      
      const avgDuration = durations.length > 0 
        ? durations.reduce((a, b) => a + b, 0) / durations.length 
        : 0;
      const p95Duration = durations.length > 0 
        ? durations[Math.floor(durations.length * 0.95)] 
        : 0;

      // Error breakdown
      const errorBreakdown: Record<ErrorCategory, number> = {
        DNS_ERROR: 0, TIMEOUT: 0, HTTP_4XX: 0, HTTP_5XX: 0, 
        CONNECTION_REFUSED: 0, SSL_ERROR: 0, UNKNOWN: 0
      };
      
      errorLogs.forEach(log => {
        const msg = log.error_message || log.response_payload?.message;
        const category = categorizeError(msg);
        errorBreakdown[category]++;
      });

      // Create PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPos = 20;

      // Header
      doc.setFillColor(59, 130, 246); // Primary blue
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('Informe QTSP', 14, 25);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generado: ${format(new Date(), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}`, 14, 35);

      yPos = 55;
      doc.setTextColor(0, 0, 0);

      // Report period
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Período del Informe', 14, yPos);
      yPos += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Desde: ${format(subDays(new Date(), parseInt(timeRange)), "dd/MM/yyyy", { locale: es })}`, 14, yPos);
      doc.text(`Hasta: ${format(new Date(), "dd/MM/yyyy", { locale: es })}`, 80, yPos);
      yPos += 15;

      // Executive Summary
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumen Ejecutivo', 14, yPos);
      yPos += 10;

      // Summary table
      autoTable(doc, {
        startY: yPos,
        head: [['Métrica', 'Valor', 'Estado']],
        body: [
          ['Total Operaciones', typedLogs.length.toString(), '-'],
          ['Operaciones Exitosas', successLogs.length.toString(), '✓'],
          ['Operaciones Fallidas', errorLogs.length.toString(), errorLogs.length > 0 ? '✗' : '✓'],
          ['Tasa de Éxito', `${successRate.toFixed(1)}%`, successRate >= 95 ? '✓ Cumple SLA' : '✗ No cumple'],
          ['Latencia Promedio', `${avgDuration.toFixed(0)} ms`, '-'],
          ['Latencia P95', `${p95Duration.toFixed(0)} ms`, p95Duration <= 5000 ? '✓ Cumple SLA' : '✗ No cumple'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 10 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;

      // Error breakdown
      if (includeErrors && errorLogs.length > 0) {
        if (yPos > 230) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Desglose de Errores por Categoría', 14, yPos);
        yPos += 10;

        const errorData = Object.entries(errorBreakdown)
          .filter(([_, count]) => count > 0)
          .map(([category, count]) => [
            category,
            count.toString(),
            `${((count / errorLogs.length) * 100).toFixed(1)}%`,
          ]);

        if (errorData.length > 0) {
          autoTable(doc, {
            startY: yPos,
            head: [['Categoría', 'Cantidad', 'Porcentaje']],
            body: errorData,
            theme: 'striped',
            headStyles: { fillColor: [220, 38, 38] }, // Red for errors
            styles: { fontSize: 10 },
          });
          yPos = (doc as any).lastAutoTable.finalY + 15;
        }
      }

      // Detailed operations table
      if (includeDetails) {
        if (yPos > 200) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Últimas Operaciones', 14, yPos);
        yPos += 10;

        const recentLogs = typedLogs.slice(0, 50).map(log => [
          format(new Date(log.created_at), 'dd/MM HH:mm', { locale: es }),
          log.action.length > 25 ? log.action.substring(0, 25) + '...' : log.action,
          log.status,
          log.duration_ms ? `${log.duration_ms} ms` : '-',
          log.error_message ? (log.error_message.length > 30 ? log.error_message.substring(0, 30) + '...' : log.error_message) : '-',
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Fecha', 'Acción', 'Estado', 'Duración', 'Error']],
          body: recentLogs,
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] },
          styles: { fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 45 },
            2: { cellWidth: 20 },
            3: { cellWidth: 22 },
            4: { cellWidth: 60 },
          },
        });
        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      // SLA Compliance section
      if (yPos > 230) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Cumplimiento SLA', 14, yPos);
      yPos += 10;

      const slaData = [
        ['Disponibilidad', '≥ 99.5%', successRate >= 99.5 ? 'Cumple' : 'No cumple', successRate >= 99.5 ? '✓' : '✗'],
        ['Tasa de Éxito', '≥ 95%', successRate >= 95 ? 'Cumple' : 'No cumple', successRate >= 95 ? '✓' : '✗'],
        ['P95 Latencia', '≤ 5000 ms', p95Duration <= 5000 ? 'Cumple' : 'No cumple', p95Duration <= 5000 ? '✓' : '✗'],
      ];

      autoTable(doc, {
        startY: yPos,
        head: [['Objetivo', 'Requisito', 'Estado', '']],
        body: slaData,
        theme: 'striped',
        headStyles: { fillColor: [34, 197, 94] }, // Green
        styles: { fontSize: 10 },
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Página ${i} de ${pageCount} - Informe QTSP - Confidencial`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      // Save
      const fileName = `informe-qtsp-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
      doc.save(fileName);

      toast({
        title: 'PDF generado',
        description: `El informe ${fileName} se ha descargado correctamente.`,
      });

    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Error',
        description: 'No se pudo generar el PDF. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileDown className="h-5 w-5" />
          Exportar Informe PDF
        </CardTitle>
        <CardDescription>
          Genera un informe PDF completo con estadísticas y datos de auditoría QTSP
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Período del informe</Label>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map(range => (
                <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label>Incluir en el informe</Label>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="includeCharts" 
              checked={includeCharts} 
              onCheckedChange={(checked) => setIncludeCharts(checked as boolean)} 
            />
            <label htmlFor="includeCharts" className="text-sm">Gráficos de tendencia</label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="includeDetails" 
              checked={includeDetails} 
              onCheckedChange={(checked) => setIncludeDetails(checked as boolean)} 
            />
            <label htmlFor="includeDetails" className="text-sm">Tabla de operaciones detallada</label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="includeErrors" 
              checked={includeErrors} 
              onCheckedChange={(checked) => setIncludeErrors(checked as boolean)} 
            />
            <label htmlFor="includeErrors" className="text-sm">Desglose de errores</label>
          </div>
        </div>

        <Button 
          onClick={generatePDF} 
          disabled={isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generando PDF...
            </>
          ) : (
            <>
              <FileDown className="mr-2 h-4 w-4" />
              Descargar Informe PDF
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
