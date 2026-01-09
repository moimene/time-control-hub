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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Trash2, Calendar as CalendarIcon, Download, Loader2, Globe, MapPin } from "lucide-react";

interface Holiday {
  id: string;
  holiday_date: string;
  holiday_type: string;
  description: string | null;
  center_id: string | null;
}

const SPAIN_NATIONAL_HOLIDAYS: Record<number, Array<{ date: string; description: string }>> = {
  2025: [
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
  ],
  2026: [
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
  ],
};

const AUTONOMOUS_COMMUNITIES = [
  { code: "AND", name: "Andalucía" },
  { code: "ARA", name: "Aragón" },
  { code: "AST", name: "Asturias" },
  { code: "BAL", name: "Baleares" },
  { code: "CAN", name: "Canarias" },
  { code: "CNT", name: "Cantabria" },
  { code: "CYL", name: "Castilla y León" },
  { code: "CLM", name: "Castilla-La Mancha" },
  { code: "CAT", name: "Cataluña" },
  { code: "EXT", name: "Extremadura" },
  { code: "GAL", name: "Galicia" },
  { code: "MAD", name: "Madrid" },
  { code: "MUR", name: "Murcia" },
  { code: "NAV", name: "Navarra" },
  { code: "PVA", name: "País Vasco" },
  { code: "RIO", name: "La Rioja" },
  { code: "VAL", name: "Comunidad Valenciana" },
  { code: "CEU", name: "Ceuta" },
  { code: "MEL", name: "Melilla" },
];

const holidayTypeColors: Record<string, string> = {
  estatal: "bg-red-100 text-red-800",
  autonomico: "bg-orange-100 text-orange-800",
};

export function NationalHolidaysManager() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<"estatal" | "autonomico">("estatal");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [description, setDescription] = useState("");
  const [selectedCommunity, setSelectedCommunity] = useState("");

  const { data: holidays, isLoading } = useQuery({
    queryKey: ['national-holidays', company?.id, selectedYear],
    queryFn: async () => {
      if (!company?.id) return [];
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      
      const { data, error } = await supabase
        .from('calendar_holidays')
        .select('*')
        .eq('company_id', company.id)
        .in('holiday_type', ['estatal', 'autonomico'])
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
      queryClient.invalidateQueries({ queryKey: ['national-holidays'] });
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
      queryClient.invalidateQueries({ queryKey: ['national-holidays'] });
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
      
      const holidays = SPAIN_NATIONAL_HOLIDAYS[year];
      if (!holidays) throw new Error("No hay datos para ese año");
      
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
      queryClient.invalidateQueries({ queryKey: ['national-holidays'] });
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
    setDescription("");
    setSelectedCommunity("");
  };

  const handleAddHoliday = () => {
    if (!selectedDate) {
      toast.error("Selecciona una fecha");
      return;
    }
    
    const desc = activeTab === 'autonomico' && selectedCommunity
      ? `[${selectedCommunity}] ${description}`
      : description;
    
    addHolidayMutation.mutate({
      date: format(selectedDate, 'yyyy-MM-dd'),
      type: activeTab,
      description: desc
    });
  };

  const nationalHolidays = holidays?.filter(h => h.holiday_type === 'estatal') || [];
  const autonomicHolidays = holidays?.filter(h => h.holiday_type === 'autonomico') || [];
  const currentHolidays = activeTab === 'estatal' ? nationalHolidays : autonomicHolidays;

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
              <Globe className="h-5 w-5" />
              Festivos Nacionales y Autonómicos
            </CardTitle>
            <CardDescription>
              Gestión de festivos estatales y de comunidades autónomas (solo super admin)
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
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "estatal" | "autonomico")}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="estatal" className="gap-2">
                <Globe className="h-4 w-4" />
                Nacionales ({nationalHolidays.length})
              </TabsTrigger>
              <TabsTrigger value="autonomico" className="gap-2">
                <MapPin className="h-4 w-4" />
                Autonómicos ({autonomicHolidays.length})
              </TabsTrigger>
            </TabsList>

            <div className="flex gap-2">
              {activeTab === 'estatal' && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => importNationalHolidaysMutation.mutate(selectedYear)}
                  disabled={importNationalHolidaysMutation.isPending || !SPAIN_NATIONAL_HOLIDAYS[selectedYear]}
                >
                  {importNationalHolidaysMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Importar Nacionales {selectedYear}
                </Button>
              )}
              <Button size="sm" onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Añadir {activeTab === 'estatal' ? 'Nacional' : 'Autonómico'}
              </Button>
            </div>
          </div>

          <TabsContent value="estatal" className="mt-4">
            <HolidayTable 
              holidays={nationalHolidays} 
              isLoading={isLoading}
              onDelete={(id) => deleteHolidayMutation.mutate(id)}
              deleteLoading={deleteHolidayMutation.isPending}
              emptyMessage={`No hay festivos nacionales configurados para ${selectedYear}`}
            />
          </TabsContent>

          <TabsContent value="autonomico" className="mt-4">
            <HolidayTable 
              holidays={autonomicHolidays} 
              isLoading={isLoading}
              onDelete={(id) => deleteHolidayMutation.mutate(id)}
              deleteLoading={deleteHolidayMutation.isPending}
              emptyMessage={`No hay festivos autonómicos configurados para ${selectedYear}`}
            />
          </TabsContent>
        </Tabs>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Añadir Festivo {activeTab === 'estatal' ? 'Nacional' : 'Autonómico'}
              </DialogTitle>
              <DialogDescription>
                {activeTab === 'estatal' 
                  ? 'Añade un festivo a nivel nacional'
                  : 'Añade un festivo de comunidad autónoma'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  locale={es}
                />
              </div>
              
              {activeTab === 'autonomico' && (
                <div className="space-y-2">
                  <Label>Comunidad Autónoma</Label>
                  <Select value={selectedCommunity} onValueChange={setSelectedCommunity}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar comunidad" />
                    </SelectTrigger>
                    <SelectContent>
                      {AUTONOMOUS_COMMUNITIES.map(c => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Día de la Comunidad"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button 
                onClick={handleAddHoliday}
                disabled={!selectedDate || addHolidayMutation.isPending || (activeTab === 'autonomico' && !selectedCommunity)}
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

function HolidayTable({ 
  holidays, 
  isLoading, 
  onDelete, 
  deleteLoading,
  emptyMessage 
}: { 
  holidays: Holiday[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  deleteLoading: boolean;
  emptyMessage: string;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (holidays.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
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
                {holiday.holiday_type === 'estatal' ? 'Nacional' : 'Autonómico'}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {holiday.description || "-"}
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(holiday.id)}
                disabled={deleteLoading}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
