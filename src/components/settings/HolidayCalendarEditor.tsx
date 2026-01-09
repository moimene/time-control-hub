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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Trash2, Calendar as CalendarIcon, Loader2, Info } from "lucide-react";

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

// Solo tipos que puede gestionar el admin de empresa
const ADMIN_HOLIDAY_TYPES = ['local', 'empresa'] as const;

export function HolidayCalendarEditor() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [holidayType, setHolidayType] = useState<string>("local");
  const [description, setDescription] = useState("");

  // Fetch ALL holidays (to show national/autonomic as read-only)
  const { data: allHolidays, isLoading } = useQuery({
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

  // Split holidays by editability
  const nationalHolidays = allHolidays?.filter(h => h.holiday_type === 'estatal' || h.holiday_type === 'autonomico') || [];
  const localHolidays = allHolidays?.filter(h => h.holiday_type === 'local' || h.holiday_type === 'empresa') || [];

  const addHolidayMutation = useMutation({
    mutationFn: async (holiday: { date: string; type: string; description: string }) => {
      if (!company?.id) throw new Error("No company");
      
      // Admin can only add local/empresa types
      if (!ADMIN_HOLIDAY_TYPES.includes(holiday.type as typeof ADMIN_HOLIDAY_TYPES[number])) {
        throw new Error("No tiene permisos para añadir este tipo de festivo");
      }
      
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
        toast.error(error.message || "Error al añadir festivo");
      }
    }
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check if holiday is local/empresa before deleting
      const holiday = localHolidays.find(h => h.id === id);
      if (!holiday) {
        throw new Error("Solo puede eliminar festivos locales o de empresa");
      }
      
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
    onError: (error: Error) => {
      toast.error(error.message || "Error al eliminar festivo");
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

  const holidayDates = allHolidays?.map(h => parseISO(h.holiday_date)) || [];

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
              Festivos Locales y de Empresa
            </CardTitle>
            <CardDescription>
              Gestiona los días festivos locales que afectan al cómputo de ausencias
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
            <Button size="sm" onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Añadir Festivo Local
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Show national/autonomic holidays as read-only info */}
        {nationalHolidays.length > 0 && (
          <div className="space-y-2">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Los festivos nacionales y autonómicos son gestionados por el super administrador.
                A continuación se muestran los configurados para su empresa.
              </AlertDescription>
            </Alert>
            <div className="rounded-md border">
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
            </div>
          </div>
        )}

        {/* Local/Empresa holidays - editable */}
        <div>
          <h4 className="text-sm font-medium mb-3">Festivos Locales y de Empresa</h4>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : localHolidays.length > 0 ? (
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
            <div className="text-center py-8 text-muted-foreground border rounded-md">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay festivos locales configurados para {selectedYear}</p>
              <p className="text-sm">Añade festivos locales o de empresa</p>
            </div>
          )}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Añadir Festivo Local</DialogTitle>
              <DialogDescription>
                Añade un nuevo día festivo local o de empresa al calendario
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
                    <SelectItem value="local">Local (municipio)</SelectItem>
                    <SelectItem value="empresa">Empresa (convenio)</SelectItem>
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
