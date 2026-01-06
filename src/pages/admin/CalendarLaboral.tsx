import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { CalendarEditor } from '@/components/calendar/CalendarEditor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Save, Download, CheckCircle2, Clock, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Holiday {
  date: string;
  type: 'nacional' | 'autonomico' | 'local';
  description: string;
}

interface IntensivePeriod {
  start_date: string;
  end_date: string;
  hours_day: number;
}

interface ShiftSummary {
  name: string;
  start: string;
  end: string;
}

interface LaborCalendar {
  id: string;
  company_id: string;
  center_id: string | null;
  year: number;
  name: string;
  holidays: Holiday[];
  shifts_summary: ShiftSummary[];
  intensive_periods: IntensivePeriod[];
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

const currentYear = new Date().getFullYear();
const years = [currentYear - 1, currentYear, currentYear + 1];

const holidayTypeLabels: Record<string, string> = {
  nacional: 'Nacional',
  autonomico: 'Autonómico',
  local: 'Local',
};

export default function CalendarLaboral() {
  const { company } = useCompany();
  const { isAdmin, isResponsible, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  
  // Local state for editing
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [intensivePeriods, setIntensivePeriods] = useState<IntensivePeriod[]>([]);
  const [shiftsSummary, setShiftsSummary] = useState<ShiftSummary[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Check if user can edit (admin, responsible/asesor, or super admin)
  const canEdit = isAdmin || isResponsible || isSuperAdmin;

  // Fetch calendar
  const { data: calendar, isLoading } = useQuery({
    queryKey: ['labor-calendar', company?.id, selectedYear],
    queryFn: async () => {
      if (!company?.id) return null;
      
      const { data, error } = await supabase
        .from('labor_calendars')
        .select('*')
        .eq('company_id', company.id)
        .eq('year', selectedYear)
        .is('center_id', null)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        const holidaysData = (data.holidays || []) as unknown as Holiday[];
        const intensiveData = (data.intensive_periods || []) as unknown as IntensivePeriod[];
        const shiftsData = (data.shifts_summary || []) as unknown as ShiftSummary[];
        
        setHolidays(holidaysData);
        setIntensivePeriods(intensiveData);
        setShiftsSummary(shiftsData);
        setHasChanges(false);
      } else {
        // Initialize with defaults
        setHolidays([]);
        setIntensivePeriods([]);
        setShiftsSummary([
          { name: 'Jornada completa', start: '09:00', end: '18:00' }
        ]);
        setHasChanges(false);
      }
      
      return data;
    },
    enabled: !!company?.id
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!company?.id) throw new Error('No company');
      
      const calendarData = {
        company_id: company.id,
        center_id: null as string | null,
        year: selectedYear,
        name: `Calendario Laboral ${selectedYear}`,
        holidays: holidays as unknown as any,
        intensive_periods: intensivePeriods as unknown as any,
        shifts_summary: shiftsSummary as unknown as any
      };

      if (calendar?.id) {
        const { error } = await supabase
          .from('labor_calendars')
          .update(calendarData)
          .eq('id', calendar.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('labor_calendars')
          .insert(calendarData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labor-calendar'] });
      setHasChanges(false);
      toast.success('Calendario guardado correctamente');
    },
    onError: (error: any) => {
      toast.error('Error al guardar: ' + error.message);
    }
  });

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!calendar?.id) throw new Error('Guarda primero el calendario');
      
      const { error } = await supabase
        .from('labor_calendars')
        .update({ published_at: new Date().toISOString() })
        .eq('id', calendar.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labor-calendar'] });
      toast.success('Calendario publicado');
    },
    onError: (error: any) => {
      toast.error('Error al publicar: ' + error.message);
    }
  });

  const handleHolidaysChange = (newHolidays: Holiday[]) => {
    setHolidays(newHolidays);
    setHasChanges(true);
  };

  const handleIntensivePeriodsChange = (newPeriods: IntensivePeriod[]) => {
    setIntensivePeriods(newPeriods);
    setHasChanges(true);
  };

  const handleShiftsSummaryChange = (newShifts: ShiftSummary[]) => {
    setShiftsSummary(newShifts);
    setHasChanges(true);
  };

  // Export calendar as PDF
  const exportCalendarPDF = () => {
    const doc = new jsPDF();
    const now = new Date();
    
    // Title
    doc.setFontSize(20);
    doc.text(`Calendario Laboral ${selectedYear}`, 14, 20);
    
    // Company info
    doc.setFontSize(12);
    doc.text(`Empresa: ${company?.name || 'N/A'}`, 14, 30);
    doc.setFontSize(10);
    doc.text(`Generado: ${format(now, "dd/MM/yyyy HH:mm", { locale: es })}`, 14, 38);
    
    // Holidays table
    doc.setFontSize(14);
    doc.text('Festivos', 14, 52);
    
    if (holidays.length > 0) {
      autoTable(doc, {
        startY: 56,
        head: [['Fecha', 'Tipo', 'Descripción']],
        body: holidays.map(h => [
          format(new Date(h.date), 'dd/MM/yyyy'),
          holidayTypeLabels[h.type] || h.type,
          h.description
        ]),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
      });
    } else {
      doc.setFontSize(10);
      doc.text('No hay festivos configurados', 14, 62);
    }

    // Intensive periods table
    const y1 = (doc as any).lastAutoTable?.finalY || 70;
    doc.setFontSize(14);
    doc.text('Períodos de Jornada Intensiva', 14, y1 + 15);
    
    if (intensivePeriods.length > 0) {
      autoTable(doc, {
        startY: y1 + 20,
        head: [['Fecha Inicio', 'Fecha Fin', 'Horas/Día']],
        body: intensivePeriods.map(p => [
          format(new Date(p.start_date), 'dd/MM/yyyy'),
          format(new Date(p.end_date), 'dd/MM/yyyy'),
          `${p.hours_day}h`
        ]),
        theme: 'striped',
        headStyles: { fillColor: [34, 197, 94] },
      });
    } else {
      doc.setFontSize(10);
      doc.text('No hay períodos intensivos configurados', 14, y1 + 26);
    }

    // Shifts table
    const y2 = (doc as any).lastAutoTable?.finalY || y1 + 40;
    doc.setFontSize(14);
    doc.text('Turnos Configurados', 14, y2 + 15);
    
    if (shiftsSummary.length > 0) {
      autoTable(doc, {
        startY: y2 + 20,
        head: [['Nombre', 'Hora Inicio', 'Hora Fin']],
        body: shiftsSummary.map(s => [s.name, s.start, s.end]),
        theme: 'striped',
        headStyles: { fillColor: [168, 85, 247] },
      });
    } else {
      doc.setFontSize(10);
      doc.text('No hay turnos configurados', 14, y2 + 26);
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(
        `Calendario Laboral ${selectedYear} - ${company?.name || ''} - Página ${i} de ${pageCount}`,
        14,
        doc.internal.pageSize.height - 10
      );
    }

    doc.save(`calendario_laboral_${selectedYear}.pdf`);
    toast.success('Calendario exportado como PDF');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Calendario Laboral
            </h1>
            <p className="text-muted-foreground">
              Configura festivos, turnos y jornada intensiva para tu empresa
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Status card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Estado del Calendario {selectedYear}</CardTitle>
              <div className="flex items-center gap-2">
                {calendar?.published_at ? (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Publicado
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <Clock className="h-3 w-3 mr-1" />
                    Borrador
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex gap-4 text-sm">
                <span>
                  <strong>{holidays.length}</strong> festivos
                </span>
                <span>
                  <strong>{intensivePeriods.length}</strong> períodos intensivos
                </span>
                <span>
                  <strong>{shiftsSummary.length}</strong> turnos
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportCalendarPDF}>
                  <FileText className="h-4 w-4 mr-1" />
                  Exportar PDF
                </Button>
                {canEdit && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => saveMutation.mutate()}
                      disabled={!hasChanges || saveMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
                    </Button>
                    {calendar && !calendar.published_at && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => publishMutation.mutate()}
                        disabled={hasChanges || publishMutation.isPending}
                      >
                        Publicar
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {hasChanges && (
          <Alert>
            <AlertDescription>
              Tienes cambios sin guardar. Recuerda guardar antes de salir.
            </AlertDescription>
          </Alert>
        )}

        {/* Calendar Editor */}
        {isLoading ? (
          <Card>
            <CardContent className="py-8">
              <div className="space-y-4">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Editor de Calendario</CardTitle>
              <CardDescription>
                {canEdit 
                  ? 'Añade festivos, configura la jornada intensiva y define los turnos'
                  : 'Vista de solo lectura. Contacta con un administrador para realizar cambios.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CalendarEditor
                year={selectedYear}
                holidays={holidays}
                intensivePeriods={intensivePeriods}
                shiftsSummary={shiftsSummary}
                onHolidaysChange={canEdit ? handleHolidaysChange : undefined}
                onIntensivePeriodsChange={canEdit ? handleIntensivePeriodsChange : undefined}
                onShiftsSummaryChange={canEdit ? handleShiftsSummaryChange : undefined}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}