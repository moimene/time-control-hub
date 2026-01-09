import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Plus, Trash2, Calendar as CalendarIcon, Download, Loader2, Globe, MapPin, RefreshCw } from "lucide-react";

interface NationalHoliday {
  id: string;
  year: number;
  holiday_date: string;
  name: string;
  type: "nacional" | "autonomico";
  region: string | null;
  created_at: string;
}

const SPAIN_NATIONAL_HOLIDAYS: Record<number, Array<{ date: string; name: string }>> = {
  2025: [
    { date: "2025-01-01", name: "Año Nuevo" },
    { date: "2025-01-06", name: "Epifanía del Señor" },
    { date: "2025-04-18", name: "Viernes Santo" },
    { date: "2025-05-01", name: "Fiesta del Trabajo" },
    { date: "2025-08-15", name: "Asunción de la Virgen" },
    { date: "2025-10-12", name: "Fiesta Nacional de España" },
    { date: "2025-11-01", name: "Todos los Santos" },
    { date: "2025-12-06", name: "Día de la Constitución" },
    { date: "2025-12-08", name: "Inmaculada Concepción" },
    { date: "2025-12-25", name: "Navidad" },
  ],
  2026: [
    { date: "2026-01-01", name: "Año Nuevo" },
    { date: "2026-01-06", name: "Epifanía del Señor" },
    { date: "2026-04-03", name: "Viernes Santo" },
    { date: "2026-05-01", name: "Fiesta del Trabajo" },
    { date: "2026-08-15", name: "Asunción de la Virgen" },
    { date: "2026-10-12", name: "Fiesta Nacional de España" },
    { date: "2026-11-01", name: "Todos los Santos" },
    { date: "2026-12-06", name: "Día de la Constitución" },
    { date: "2026-12-07", name: "Día de la Constitución (traslado)" },
    { date: "2026-12-08", name: "Inmaculada Concepción" },
    { date: "2026-12-25", name: "Navidad" },
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
  nacional: "bg-red-100 text-red-800",
  autonomico: "bg-orange-100 text-orange-800",
};

export function NationalHolidaysManager() {
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<"nacional" | "autonomico">("nacional");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [name, setName] = useState("");
  const [selectedCommunity, setSelectedCommunity] = useState("");

  // Fetch from global national_holidays table
  const { data: holidays, isLoading } = useQuery({
    queryKey: ['global-national-holidays', selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('national_holidays')
        .select('*')
        .eq('year', selectedYear)
        .order('holiday_date');
      
      if (error) throw error;
      return data as NationalHoliday[];
    }
  });

  const addHolidayMutation = useMutation({
    mutationFn: async (holiday: { date: string; type: "nacional" | "autonomico"; name: string; region?: string }) => {
      const { error } = await supabase
        .from('national_holidays')
        .insert({
          year: parseInt(holiday.date.substring(0, 4)),
          holiday_date: holiday.date,
          name: holiday.name,
          type: holiday.type,
          region: holiday.region || null
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-national-holidays'] });
      toast.success("Festivo añadido. Se propagará a las empresas en su próximo bootstrap.");
      resetForm();
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        toast.error("Ya existe un festivo en esa fecha");
      } else {
        toast.error("Error al añadir festivo");
      }
    }
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('national_holidays')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-national-holidays'] });
      toast.success("Festivo eliminado de la tabla global");
    },
    onError: () => {
      toast.error("Error al eliminar festivo");
    }
  });

  const importNationalHolidaysMutation = useMutation({
    mutationFn: async (year: number) => {
      const holidaysData = SPAIN_NATIONAL_HOLIDAYS[year];
      if (!holidaysData) throw new Error("No hay datos para ese año");
      
      const toInsert = holidaysData.map(h => ({
        year,
        holiday_date: h.date,
        name: h.name,
        type: 'nacional' as const,
        region: null
      }));

      // Insert with upsert-like behavior
      for (const holiday of toInsert) {
        const { error } = await supabase
          .from('national_holidays')
          .insert(holiday);
        
        // Ignore duplicate errors
        if (error && !error.message.includes('duplicate') && !error.message.includes('unique')) {
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-national-holidays'] });
      toast.success("Festivos nacionales importados a la tabla global");
    },
    onError: (err) => {
      console.error("Import error:", err);
      toast.error("Error al importar festivos");
    }
  });

  const propagateToCompaniesMutation = useMutation({
    mutationFn: async () => {
      // Get all companies
      const { data: companies, error: companiesError } = await supabase
        .from('company')
        .select('id');
      
      if (companiesError) throw companiesError;
      
      // Get all national holidays for current year
      const { data: nationalHolidays, error: holidaysError } = await supabase
        .from('national_holidays')
        .select('*')
        .eq('year', selectedYear);
      
      if (holidaysError) throw holidaysError;
      if (!nationalHolidays?.length) {
        throw new Error("No hay festivos para propagar");
      }

      let propagatedCount = 0;
      
      for (const company of companies || []) {
        // Check existing holidays for this company - calendar_holidays uses holiday_type
        const { data: existing } = await supabase
          .from('calendar_holidays')
          .select('holiday_date, holiday_type, description')
          .eq('company_id', company.id)
          .in('holiday_type', ['nacional', 'autonomico']);

        const existingSet = new Set(
          (existing || []).map((h: { holiday_date: string; holiday_type: string }) => `${h.holiday_date}-${h.holiday_type}`)
        );

        // Map national_holidays (type, name, region) to calendar_holidays (holiday_type, description)
        const holidaysToInsert = nationalHolidays
          .filter(h => !existingSet.has(`${h.holiday_date}-${h.type}`))
          .map(h => ({
            company_id: company.id,
            holiday_date: h.holiday_date,
            holiday_type: h.type, // nacional or autonomico
            description: h.region ? `[${h.region}] ${h.name}` : h.name,
          }));

        if (holidaysToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('calendar_holidays')
            .insert(holidaysToInsert);
          
          if (!insertError) {
            propagatedCount += holidaysToInsert.length;
          }
        }
      }
      
      return propagatedCount;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-holidays'] });
      toast.success(`${count} festivos propagados a las empresas`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al propagar festivos");
    }
  });

  const resetForm = () => {
    setIsDialogOpen(false);
    setSelectedDate(undefined);
    setName("");
    setSelectedCommunity("");
  };

  const handleAddHoliday = () => {
    if (!selectedDate) {
      toast.error("Selecciona una fecha");
      return;
    }
    if (!name.trim()) {
      toast.error("Introduce un nombre para el festivo");
      return;
    }
    
    addHolidayMutation.mutate({
      date: format(selectedDate, 'yyyy-MM-dd'),
      type: activeTab,
      name: name.trim(),
      region: activeTab === 'autonomico' ? selectedCommunity : undefined
    });
  };

  const nationalHolidays = holidays?.filter(h => h.type === 'nacional') || [];
  const autonomicHolidays = holidays?.filter(h => h.type === 'autonomico') || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Festivos Nacionales y Autonómicos (Global)
            </CardTitle>
            <CardDescription>
              Gestión centralizada de festivos. Se propagan automáticamente a nuevas empresas.
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
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "nacional" | "autonomico")}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <TabsList>
              <TabsTrigger value="nacional" className="gap-2">
                <Globe className="h-4 w-4" />
                Nacionales ({nationalHolidays.length})
              </TabsTrigger>
              <TabsTrigger value="autonomico" className="gap-2">
                <MapPin className="h-4 w-4" />
                Autonómicos ({autonomicHolidays.length})
              </TabsTrigger>
            </TabsList>

            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => propagateToCompaniesMutation.mutate()}
                disabled={propagateToCompaniesMutation.isPending || !holidays?.length}
              >
                {propagateToCompaniesMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Propagar a empresas
              </Button>
              {activeTab === 'nacional' && (
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
                  Importar {selectedYear}
                </Button>
              )}
              <Button size="sm" onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Añadir
              </Button>
            </div>
          </div>

          <TabsContent value="nacional" className="mt-4">
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
              showRegion
            />
          </TabsContent>
        </Tabs>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Añadir Festivo {activeTab === 'nacional' ? 'Nacional' : 'Autonómico'}
              </DialogTitle>
              <DialogDescription>
                {activeTab === 'nacional' 
                  ? 'Añade un festivo a nivel nacional (se propaga a todas las empresas)'
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
                <Label>Nombre del festivo</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Día de la Constitución"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button 
                onClick={handleAddHoliday}
                disabled={!selectedDate || !name.trim() || addHolidayMutation.isPending || (activeTab === 'autonomico' && !selectedCommunity)}
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
  emptyMessage,
  showRegion = false
}: { 
  holidays: NationalHoliday[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  deleteLoading: boolean;
  emptyMessage: string;
  showRegion?: boolean;
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

  const getCommunityName = (code: string | null) => {
    if (!code) return "-";
    const community = AUTONOMOUS_COMMUNITIES.find(c => c.code === code);
    return community?.name || code;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Tipo</TableHead>
          {showRegion && <TableHead>Comunidad</TableHead>}
          <TableHead>Nombre</TableHead>
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
              <Badge variant="secondary" className={holidayTypeColors[holiday.type]}>
                {holiday.type === 'nacional' ? 'Nacional' : 'Autonómico'}
              </Badge>
            </TableCell>
            {showRegion && (
              <TableCell className="text-muted-foreground">
                {getCommunityName(holiday.region)}
              </TableCell>
            )}
            <TableCell className="text-muted-foreground">
              {holiday.name}
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
