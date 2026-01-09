import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, Save, CheckCircle2, Clock, FileText, Download, AlertTriangle, Globe, MapPin, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { AUTONOMOUS_COMMUNITIES, getAutonomousCommunityName } from '@/lib/autonomousCommunities';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface CalendarHoliday {
  id: string;
  holiday_date: string;
  holiday_type: 'nacional' | 'autonomico' | 'local' | 'empresa' | 'estatal';
  description: string | null;
  center_id: string | null;
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

const currentYear = new Date().getFullYear();
const years = [currentYear - 1, currentYear, currentYear + 1];

const holidayTypeLabels: Record<string, string> = {
  nacional: 'Nacional',
  estatal: 'Nacional',
  autonomico: 'Autonómico',
  local: 'Local',
  empresa: 'Empresa',
};

const holidayTypeColors: Record<string, string> = {
  estatal: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  nacional: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  autonomico: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  local: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  empresa: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
};

export function CalendarLaboralSection() {
  const { company } = useCompany();
  const { isAdmin, isResponsible, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState<string>('');
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  const canEdit = isAdmin || isResponsible || isSuperAdmin;

  // Fetch holidays from normalized table
  const { data: holidays, isLoading: holidaysLoading } = useQuery({
    queryKey: ['calendar-holidays-section', company?.id, selectedYear],
    queryFn: async () => {
      if (!company?.id) return [];
      
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      
      const { data, error } = await supabase
        .from('calendar_holidays')
        .select('*')
        .eq('company_id', company.id)
        .gte('holiday_date', startDate)
        .lte('holiday_date', endDate)
        .order('holiday_date');
      
      if (error) throw error;
      return data as CalendarHoliday[];
    },
    enabled: !!company?.id
  });

  // Fetch labor_calendars for intensive periods and shifts only
  const { data: calendar, isLoading: calendarLoading } = useQuery({
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
      return data;
    },
    enabled: !!company?.id
  });

  // Fetch available national holidays from global table
  const { data: availableNationalHolidays } = useQuery({
    queryKey: ['national-holidays', selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('national_holidays')
        .select('*')
        .eq('year', selectedYear)
        .order('holiday_date');
      
      if (error) throw error;
      return data;
    }
  });

  const intensivePeriods = (calendar?.intensive_periods || []) as unknown as IntensivePeriod[];
  const shiftsSummary = (calendar?.shifts_summary || []) as unknown as ShiftSummary[];

  // Split holidays by type
  const nationalHolidays = holidays?.filter(h => 
    h.holiday_type === 'nacional' || h.holiday_type === 'estatal' || h.holiday_type === 'autonomico'
  ) || [];
  const localHolidays = holidays?.filter(h => 
    h.holiday_type === 'local' || h.holiday_type === 'empresa'
  ) || [];

  // Count available holidays
  const availableNational = availableNationalHolidays?.filter(h => h.type === 'nacional') || [];
  const availableAutonomic = availableNationalHolidays?.filter(h => h.type === 'autonomico') || [];
  const uniqueRegions = [...new Set(availableAutonomic.map(h => h.region).filter(Boolean))];

  // Check if holidays need to be imported
  const needsHolidayImport = nationalHolidays.length === 0 && availableNational.length > 0;

  // Import holidays mutation
  const importHolidaysMutation = useMutation({
    mutationFn: async ({ type, region }: { type: 'nacional' | 'autonomico'; region?: string }) => {
      if (!company?.id) throw new Error("No company");
      if (!availableNationalHolidays?.length) throw new Error("No hay festivos disponibles");

      let holidaysToImport = availableNationalHolidays.filter(h => h.type === type);
      if (type === 'autonomico' && region) {
        holidaysToImport = holidaysToImport.filter(h => h.region === region);
      }

      if (holidaysToImport.length === 0) {
        throw new Error(`No hay festivos ${type === 'nacional' ? 'nacionales' : 'autonómicos'} disponibles`);
      }

      const existingDates = new Set(holidays?.map(h => h.holiday_date) || []);

      const toInsert = holidaysToImport
        .filter(h => !existingDates.has(h.holiday_date))
        .map(h => ({
          company_id: company.id,
          holiday_date: h.holiday_date,
          holiday_type: h.type,
          description: h.region ? `[${getAutonomousCommunityName(h.region)}] ${h.name}` : h.name,
        }));

      if (toInsert.length === 0) {
        throw new Error("Todos los festivos ya están importados");
      }

      const { error } = await supabase.from('calendar_holidays').insert(toInsert);
      if (error) throw error;
      return toInsert.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-holidays-section'] });
      toast.success(`${count} festivos importados correctamente`);
      setIsImportDialogOpen(false);
      setSelectedCommunity('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  // Bootstrap company (for initial setup)
  const handleBootstrap = async () => {
    if (!company?.id) return;
    
    setIsBootstrapping(true);
    try {
      const { data, error } = await supabase.functions.invoke('company-bootstrap', {
        body: { 
          company_id: company.id,
          autonomous_community: selectedCommunity || undefined
        }
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['calendar-holidays-section'] });
      queryClient.invalidateQueries({ queryKey: ['company-config-status'] });
      toast.success('Configuración inicial completada');
    } catch (error: any) {
      toast.error('Error al inicializar: ' + error.message);
    } finally {
      setIsBootstrapping(false);
    }
  };

  const exportCalendarPDF = () => {
    const doc = new jsPDF();
    const now = new Date();
    
    doc.setFontSize(20);
    doc.text(`Calendario Laboral ${selectedYear}`, 14, 20);
    
    doc.setFontSize(12);
    doc.text(`Empresa: ${company?.name || 'N/A'}`, 14, 30);
    doc.setFontSize(10);
    doc.text(`Generado: ${format(now, "dd/MM/yyyy HH:mm", { locale: es })}`, 14, 38);
    
    doc.setFontSize(14);
    doc.text('Festivos', 14, 52);
    
    const allHolidays = holidays || [];
    if (allHolidays.length > 0) {
      autoTable(doc, {
        startY: 56,
        head: [['Fecha', 'Tipo', 'Descripción']],
        body: allHolidays.map(h => [
          format(parseISO(h.holiday_date), 'dd/MM/yyyy'),
          holidayTypeLabels[h.holiday_type] || h.holiday_type,
          h.description || '-'
        ]),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
      });
    } else {
      doc.setFontSize(10);
      doc.text('No hay festivos configurados', 14, 62);
    }

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

  const isLoading = holidaysLoading || calendarLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendario Laboral
          </h2>
          <p className="text-sm text-muted-foreground">
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

      {/* Alert if holidays need import */}
      {needsHolidayImport && (
        <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-amber-700 dark:text-amber-300">
              No hay festivos nacionales configurados. Hay {availableNational.length} festivos disponibles para importar.
            </span>
            <Button size="sm" onClick={() => setIsImportDialogOpen(true)}>
              <Download className="h-4 w-4 mr-2" />
              Importar festivos
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Estado del Calendario {selectedYear}</CardTitle>
            <div className="flex items-center gap-2">
              {calendar?.published_at ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
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
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex gap-4 text-sm flex-wrap">
              <span>
                <strong>{nationalHolidays.length}</strong> festivos nacionales/autonómicos
              </span>
              <span>
                <strong>{localHolidays.length}</strong> festivos locales
              </span>
              <span>
                <strong>{intensivePeriods.length}</strong> períodos intensivos
              </span>
              <span>
                <strong>{shiftsSummary.length}</strong> turnos
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
                <Download className="h-4 w-4 mr-1" />
                Importar festivos
              </Button>
              <Button variant="outline" size="sm" onClick={exportCalendarPDF}>
                <FileText className="h-4 w-4 mr-1" />
                Exportar PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-8">
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* National/Autonomic Holidays */}
          {nationalHolidays.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Globe className="h-4 w-4" />
                  Festivos Nacionales y Autonómicos ({nationalHolidays.length})
                </CardTitle>
                <CardDescription>
                  Festivos oficiales importados (no editables)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descripción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nationalHolidays.map((holiday) => (
                      <TableRow key={holiday.id} className="bg-muted/30">
                        <TableCell className="font-medium">
                          {format(parseISO(holiday.holiday_date), "EEEE, d 'de' MMMM", { locale: es })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={holidayTypeColors[holiday.holiday_type]}>
                            {holidayTypeLabels[holiday.holiday_type]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {holiday.description || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Local/Company Holidays */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" />
                Festivos Locales y de Empresa ({localHolidays.length})
              </CardTitle>
              <CardDescription>
                Festivos específicos de tu localidad o empresa
              </CardDescription>
            </CardHeader>
            <CardContent>
              {localHolidays.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descripción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {localHolidays.map((holiday) => (
                      <TableRow key={holiday.id}>
                        <TableCell className="font-medium">
                          {format(parseISO(holiday.holiday_date), "EEEE, d 'de' MMMM", { locale: es })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={holidayTypeColors[holiday.holiday_type]}>
                            {holidayTypeLabels[holiday.holiday_type]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {holiday.description || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay festivos locales configurados para {selectedYear}</p>
                  <p className="text-sm">Usa el editor de festivos para añadir días festivos locales</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Festivos</DialogTitle>
            <DialogDescription>
              Importa festivos nacionales y autonómicos al calendario de la empresa para {selectedYear}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* National holidays */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-medium">Festivos Nacionales</p>
                  <p className="text-sm text-muted-foreground">
                    {availableNational.length} festivos disponibles
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => importHolidaysMutation.mutate({ type: 'nacional' })}
                disabled={importHolidaysMutation.isPending || availableNational.length === 0}
              >
                {importHolidaysMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Importar'
                )}
              </Button>
            </div>

            {/* Autonomic holidays */}
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="font-medium">Festivos Autonómicos</p>
                  <p className="text-sm text-muted-foreground">
                    Selecciona la comunidad autónoma
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={selectedCommunity} onValueChange={setSelectedCommunity}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleccionar comunidad..." />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTONOMOUS_COMMUNITIES.map((comm) => {
                      const count = availableAutonomic.filter(h => h.region === comm.code).length;
                      return (
                        <SelectItem key={comm.code} value={comm.code}>
                          {comm.name} ({count})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => importHolidaysMutation.mutate({ type: 'autonomico', region: selectedCommunity })}
                  disabled={!selectedCommunity || importHolidaysMutation.isPending}
                >
                  {importHolidaysMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Importar'
                  )}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
