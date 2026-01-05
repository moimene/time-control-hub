import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EmployeeLayout } from '@/components/layout/EmployeeLayout';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, Download, FileText, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { EventType, EventSource } from '@/types/database';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

const eventTypeLabels: Record<EventType, string> = {
  entry: 'Entrada',
  exit: 'Salida',
};

const eventSourceLabels: Record<EventSource, string> = {
  qr: 'QR',
  pin: 'PIN',
  manual: 'Manual',
};

const overrideReasonLabels: Record<string, string> = {
  forgot_mark: 'Olvidé fichar',
  system_error: 'Error del sistema',
  authorized_exception: 'Excepción autorizada',
  other: 'Otro motivo',
};

export default function EmployeeDashboard() {
  const { employee } = useAuth();
  const today = new Date();

  const { data: recentEvents, isLoading } = useQuery({
    queryKey: ['my-events', employee?.id],
    enabled: !!employee?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_events')
        .select('*')
        .eq('employee_id', employee!.id)
        .gte('timestamp', startOfMonth(today).toISOString())
        .lte('timestamp', endOfMonth(today).toISOString())
        .order('timestamp', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Group events by date
  const groupedEvents = recentEvents?.reduce((acc: any, event: any) => {
    const date = format(new Date(event.timestamp), 'yyyy-MM-dd');
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(event);
    return acc;
  }, {});

  // Calculate hours for a day
  const calculateHours = (dayRecords: any[]): number => {
    let totalMinutes = 0;
    const entries = dayRecords.filter((r) => r.event_type === 'entry').sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const exits = dayRecords.filter((r) => r.event_type === 'exit').sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (let i = 0; i < Math.min(entries.length, exits.length); i++) {
      const entry = new Date(entries[i].timestamp);
      const exit = new Date(exits[i].timestamp);
      totalMinutes += (exit.getTime() - entry.getTime()) / 1000 / 60;
    }

    return totalMinutes;
  };

  const formatMinutes = (totalMinutes: number): string => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    return `${hours}h ${minutes}m`;
  };

  // Log export to audit_log
  const logExport = async (exportFormat: 'csv' | 'pdf') => {
    try {
      await supabase.functions.invoke('log-export', {
        body: {
          format: exportFormat,
          entity_type: 'time_events',
          date_range: {
            start: startOfMonth(today).toISOString(),
            end: endOfMonth(today).toISOString(),
          },
          employee_id: employee?.id,
          record_count: recentEvents?.length || 0,
          filters: {
            month: format(today, 'yyyy-MM'),
            self_export: true,
          },
        },
      });
    } catch (error) {
      console.error('Error logging export:', error);
    }
  };

  const exportCSV = async () => {
    if (!recentEvents) return;

    const headers = ['Fecha', 'Tipo', 'Hora', 'Origen'];
    const rows = recentEvents
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((event: any) => [
        format(new Date(event.timestamp), 'dd/MM/yyyy'),
        eventTypeLabels[event.event_type as EventType],
        format(new Date(event.timestamp), 'HH:mm:ss'),
        eventSourceLabels[event.event_source as EventSource],
      ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mis_fichajes_${format(today, 'yyyy-MM')}.csv`;
    a.click();

    await logExport('csv');
    toast.success('Fichajes exportados a CSV');
  };

  const exportPDF = async () => {
    if (!recentEvents) return;

    const doc = new jsPDF();
    const monthStr = format(today, 'MMMM yyyy', { locale: es });
    const now = new Date();
    
    // Header
    doc.setFontSize(18);
    doc.text('Mis Fichajes', 14, 20);
    doc.setFontSize(12);
    doc.text(`Período: ${monthStr}`, 14, 30);
    doc.setFontSize(10);
    doc.text(`Generado: ${format(now, 'dd/MM/yyyy HH:mm:ss')}`, 14, 38);
    
    // Calculate total hours
    let totalMinutes = 0;
    if (groupedEvents) {
      Object.values(groupedEvents).forEach((dayRecords: any) => {
        totalMinutes += calculateHours(dayRecords);
      });
    }
    
    doc.text(`Total horas del mes: ${formatMinutes(totalMinutes)}`, 14, 46);

    // Events table
    const sortedEvents = [...recentEvents].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    autoTable(doc, {
      startY: 55,
      head: [['Fecha', 'Tipo', 'Hora', 'Origen']],
      body: sortedEvents.map((event: any) => [
        format(new Date(event.timestamp), 'dd/MM/yyyy'),
        eventTypeLabels[event.event_type as EventType],
        format(new Date(event.timestamp), 'HH:mm:ss'),
        eventSourceLabels[event.event_source as EventSource],
      ]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(
        `Documento generado automáticamente. Conservar durante 4 años según normativa laboral. Página ${i} de ${pageCount}`,
        14,
        doc.internal.pageSize.height - 10
      );
    }

    doc.save(`mis_fichajes_${format(today, 'yyyy-MM')}.pdf`);

    await logExport('pdf');
    toast.success('Fichajes exportados a PDF');
  };

  return (
    <EmployeeLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mis Fichajes</h1>
            <p className="text-muted-foreground">
              {format(today, 'MMMM yyyy', { locale: es })}
            </p>
          </div>
          {recentEvents && recentEvents.length > 0 && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button size="sm" onClick={exportPDF}>
                <FileText className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : groupedEvents && Object.keys(groupedEvents).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(groupedEvents)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([date, events]: [string, any]) => (
                <Card key={date}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {format(new Date(date), 'EEEE, d MMMM', { locale: es })}
                      </CardTitle>
                      <span className="text-sm font-mono text-muted-foreground">
                        {formatMinutes(calculateHours(events))}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {events
                        .sort((a: any, b: any) => 
                          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                        )
                                        .map((event: any) => {
                                          const overrideReason = event.raw_payload?.override_reason;
                                          return (
                                            <div
                                              key={event.id}
                                              className="flex items-center justify-between rounded-lg border p-3"
                                            >
                                              <div className="flex items-center gap-3">
                                                <div
                                                  className={`h-2 w-2 rounded-full ${
                                                    event.event_type === 'entry' ? 'bg-green-500' : 'bg-red-500'
                                                  }`}
                                                />
                                                <div>
                                                  <div className="flex items-center gap-2">
                                                    <p className="font-medium">
                                                      {eventTypeLabels[event.event_type as EventType]}
                                                    </p>
                                                    {overrideReason && (
                                                      <TooltipProvider>
                                                        <Tooltip>
                                                          <TooltipTrigger>
                                                            <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300 bg-amber-50">
                                                              <AlertTriangle className="h-3 w-3" />
                                                              Override
                                                            </Badge>
                                                          </TooltipTrigger>
                                                          <TooltipContent>
                                                            <p className="font-medium">Fichaje con override</p>
                                                            <p className="text-sm text-muted-foreground">
                                                              {overrideReasonLabels[overrideReason] || overrideReason}
                                                            </p>
                                                          </TooltipContent>
                                                        </Tooltip>
                                                      </TooltipProvider>
                                                    )}
                                                  </div>
                                                  <p className="text-sm text-muted-foreground">
                                                    {eventSourceLabels[event.event_source as EventSource]}
                                                  </p>
                                                </div>
                                              </div>
                                              <span className="font-mono text-lg">
                                                {format(new Date(event.timestamp), 'HH:mm')}
                                              </span>
                                            </div>
                                          );
                                        })}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No tienes fichajes registrados este mes
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </EmployeeLayout>
  );
}
