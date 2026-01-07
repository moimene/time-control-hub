import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, parseISO, getYear } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Trash2, Calendar as CalendarIcon, Download, Loader2 } from "lucide-react";

interface Holiday {
  id: string;
  holiday_date: string;
  holiday_type: 'estatal' | 'autonomico' | 'local' | 'empresa';
  description: string | null;
  center_id: string | null;
}

const holidayTypeLabels: Record<string, string> = {
  estatal: "Nacional",
  autonomico: "Autonómico",
  local: "Local",
  empresa: "Empresa"
};

const holidayTypeColors: Record<string, string> = {
  estatal: "bg-red-100 text-red-800",
  autonomico: "bg-orange-100 text-orange-800",
  local: "bg-blue-100 text-blue-800",
  empresa: "bg-green-100 text-green-800"
};

// Festivos nacionales de España (fijos)
const SPAIN_NATIONAL_HOLIDAYS_2025 = [
  { date: "2025-01-01", description: "Año Nuevo" },
  { date: "2025-01-06", description: "Epifanía del Señor" },
  { date: "2025-04-18", description: "Viernes Santo" },
  { date: "2025-05-01", description: "Fiesta del Trabajo" },
  { date: "2025-08-15", description: "Asunción de la Virgen" },
  { date: "2025-10-12", description: "Fiesta Nacional de España" },
  { date: "2025-11-01", description: "Todos los Santos" },
  { date: "2025-12-06", description: "Día de la Constitución" },
  { date: "2025-12-08", description: "Inmaculada Concepción" },
  { date: "2025-12-25", description: "Navidad" },
];

const SPAIN_NATIONAL_HOLIDAYS_2026 = [
  { date: "2026-01-01", description: "Año Nuevo" },
  { date: "2026-01-06", description: "Epifanía del Señor" },
  { date: "2026-04-03", description: "Viernes Santo" },
  { date: "2026-05-01", description: "Fiesta del Trabajo" },
  { date: "2026-08-15", description: "Asunción de la Virgen" },
  { date: "2026-10-12", description: "Fiesta Nacional de España" },
  { date: "2026-11-01", description: "Todos los Santos" },
  { date: "2026-12-06", description: "Día de la Constitución" },
  { date: "2026-12-07", description: "Día de la Constitución (traslado)" },
  { date: "2026-12-08", description: "Inmaculada Concepción" },
  { date: "2026-12-25", description: "Navidad" },
];

export function HolidayCalendarEditor() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [holidayType, setHolidayType] = useState<string>("local");
  const [description, setDescription] = useState("");

  const { data: holidays, isLoading } = useQuery({
    queryKey: ['calendar-holidays', company?.id, selectedYear],
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
      return data as Holiday[];
    },
    enabled: !!company?.id
  });

  const addHolidayMutation = useMutation({
    mutationFn: async (holiday: { date: string; type: string; description: string }) => {
      if (!company?.id) throw new Error("No company");
      
      const { error } = await supabase
        .from('calendar_holidays')
        .insert({
          company_id: company.id,
          holiday_date: holiday.date,
          holiday_type: holiday.type,
          description: holiday.description || null
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-holidays'] });
      toast.success("Festivo añadido correctamente");
      resetForm();
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast.error("Ya existe un festivo en esa fecha");
      } else {
        toast.error("Error al añadir festivo");
      }
    }
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('calendar_holidays')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-holidays'] });
      toast.success("Festivo eliminado");
    },
    onError: () => {
      toast.error("Error al eliminar festivo");
    }
  });

  const importNationalHolidaysMutation = useMutation({
    mutationFn: async (year: number) => {
      if (!company?.id) throw new Error("No company");
      
      const holidays = year === 2025 ? SPAIN_NATIONAL_HOLIDAYS_2025 : SPAIN_NATIONAL_HOLIDAYS_2026;
      
      const toInsert = holidays.map(h => ({
        company_id: company.id,
        holiday_date: h.date,
        holiday_type: 'estatal',
        description: h.description
      }));

      const { error } = await supabase
        .from('calendar_holidays')
        .upsert(toInsert, { 
          onConflict: 'company_id,holiday_date',
          ignoreDuplicates: true 
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-holidays'] });
      toast.success("Festivos nacionales importados");
    },
    onError: () => {
      toast.error("Error al importar festivos");
    }
  });

  const resetForm = () => {
    setIsDialogOpen(false);
    setSelectedDate(undefined);
    setHolidayType("local");
    setDescription("");
  };

  const handleAddHoliday = () => {
    if (!selectedDate) {
      toast.error("Selecciona una fecha");
      return;
    }
    
    addHolidayMutation.mutate({
      date: format(selectedDate, 'yyyy-MM-dd'),
      type: holidayType,
      description
    });
  };

  const holidayDates = holidays?.map(h => parseISO(h.holiday_date)) || [];

  if (!company) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Cargando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Calendario de Festivos
            </CardTitle>
            <CardDescription>
              Gestiona los días festivos que afectan al cómputo de ausencias
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2027">2027</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => importNationalHolidaysMutation.mutate(selectedYear)}
              disabled={importNationalHolidaysMutation.isPending || ![2025, 2026].includes(selectedYear)}
            >
              {importNationalHolidaysMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Importar Nacionales
            </Button>
            <Button size="sm" onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Añadir Festivo
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : holidays && holidays.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holidays.map((holiday) => (
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
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteHolidayMutation.mutate(holiday.id)}
                      disabled={deleteHolidayMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay festivos configurados para {selectedYear}</p>
            <p className="text-sm">Importa los festivos nacionales o añade festivos manualmente</p>
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Añadir Festivo</DialogTitle>
              <DialogDescription>
                Añade un nuevo día festivo al calendario
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  locale={es}
                  modifiers={{ holiday: holidayDates }}
                  modifiersStyles={{
                    holiday: { backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))' }
                  }}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Tipo de festivo</Label>
                <Select value={holidayType} onValueChange={setHolidayType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="estatal">Nacional</SelectItem>
                    <SelectItem value="autonomico">Autonómico</SelectItem>
                    <SelectItem value="local">Local</SelectItem>
                    <SelectItem value="empresa">Empresa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Descripción (opcional)</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Fiesta patronal"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button 
                onClick={handleAddHoliday}
                disabled={!selectedDate || addHolidayMutation.isPending}
              >
                {addHolidayMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Añadir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
