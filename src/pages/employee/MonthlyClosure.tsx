import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EmployeeLayout } from '@/components/layout/EmployeeLayout';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { FileSignature, Clock, CheckCircle2, AlertCircle, Loader2, Calendar, Moon, Timer, Info } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function MonthlyClosure() {
  const { employee } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Default to previous month (only previous months can be signed)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const prev = subMonths(new Date(), 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const [year, month] = selectedMonth.split('-').map(Number);

  // Fetch existing closures
  const { data: closures, isLoading: closuresLoading } = useQuery({
    queryKey: ['monthly-closures', employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];
      const { data, error } = await supabase
        .from('monthly_closures')
        .select('*')
        .eq('employee_id', employee.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!employee?.id,
  });

  // Fetch time events for selected month
  const { data: timeEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ['time-events-month', employee?.id, year, month],
    queryFn: async () => {
      if (!employee?.id) return [];
      const startDate = startOfMonth(new Date(year, month - 1));
      const endDate = endOfMonth(new Date(year, month - 1));
      
      const { data, error } = await supabase
        .from('time_events')
        .select('*')
        .eq('employee_id', employee.id)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!employee?.id && !!year && !!month,
  });

  // Calculate hours summary
  const calculateSummary = () => {
    if (!timeEvents || timeEvents.length === 0) {
      return { totalHours: 0, regularHours: 0, overtimeHours: 0, nightHours: 0, daysWorked: 0 };
    }

    let totalMinutes = 0;
    let nightMinutes = 0;
    const dailyMinutes: Record<string, number> = {};

    for (let i = 0; i < timeEvents.length; i++) {
      const event = timeEvents[i];
      if (event.event_type === 'entry' && i + 1 < timeEvents.length) {
        const nextEvent = timeEvents[i + 1];
        if (nextEvent.event_type === 'exit') {
          const entryTime = new Date(event.timestamp);
          const exitTime = new Date(nextEvent.timestamp);
          const minutes = (exitTime.getTime() - entryTime.getTime()) / (1000 * 60);
          
          totalMinutes += minutes;
          
          // Check for night hours (22:00-06:00)
          const entryHour = entryTime.getHours();
          const exitHour = exitTime.getHours();
          if (entryHour >= 22 || entryHour < 6 || exitHour >= 22 || exitHour < 6) {
            nightMinutes += Math.min(minutes, 480);
          }
          
          const dateKey = entryTime.toISOString().split('T')[0];
          dailyMinutes[dateKey] = (dailyMinutes[dateKey] || 0) + minutes;
          
          i++;
        }
      }
    }

    // Calculate regular vs overtime (>8h/day = overtime)
    let regularMinutes = 0;
    let overtimeMinutes = 0;
    const dailyRegularLimit = 480; // 8 hours

    Object.values(dailyMinutes).forEach((dayMinutes) => {
      if (dayMinutes > dailyRegularLimit) {
        regularMinutes += dailyRegularLimit;
        overtimeMinutes += dayMinutes - dailyRegularLimit;
      } else {
        regularMinutes += dayMinutes;
      }
    });

    return {
      totalHours: Math.round(totalMinutes / 60 * 100) / 100,
      regularHours: Math.round(regularMinutes / 60 * 100) / 100,
      overtimeHours: Math.round(overtimeMinutes / 60 * 100) / 100,
      nightHours: Math.round(nightMinutes / 60 * 100) / 100,
      daysWorked: Object.keys(dailyMinutes).length,
    };
  };

  const summary = calculateSummary();
  const existingClosure = closures?.find(c => c.year === year && c.month === month);

  // Sign monthly hours mutation
  const signMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sign-monthly-hours', {
        body: { year, month },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({ 
        title: 'Cierre firmado correctamente',
        description: `Total: ${data.data?.total_hours?.toFixed(2)} horas`
      });
      queryClient.invalidateQueries({ queryKey: ['monthly-closures'] });
      setIsDialogOpen(false);
      setConfirmChecked(false);
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  // Generate month options - ONLY PREVIOUS MONTHS (not current month)
  const monthOptions = [];
  const now = new Date();
  // Start from index 1 (previous month), not 0 (current month)
  for (let i = 1; i <= 12; i++) {
    const date = subMonths(now, i);
    monthOptions.push({
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
    });
  }

  return (
    <EmployeeLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cierre Mensual</h1>
          <p className="text-muted-foreground">
            Revisa y firma el cierre de tus horas trabajadas
          </p>
        </div>

        <Alert className="bg-primary/5 border-primary/20">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Solo puedes firmar el cierre de meses anteriores. El mes en curso no está disponible para firma hasta que termine.
          </AlertDescription>
        </Alert>

        <div className="flex items-center gap-4">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {existingClosure?.status === 'signed' ? (
            <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Firmado
            </Badge>
          ) : (
            <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
              <AlertCircle className="h-4 w-4 mr-1" />
              Pendiente de firma
            </Badge>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Horas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{summary.totalHours}h</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Horas Ordinarias
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold">{summary.regularHours}h</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Horas Extra
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                <span className="text-2xl font-bold">{summary.overtimeHours}h</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Horas Nocturnas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Moon className="h-5 w-5 text-indigo-500" />
                <span className="text-2xl font-bold">{summary.nightHours}h</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Events Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Resumen del Mes
              </CardTitle>
              <CardDescription>
                {monthNames[month - 1]} {year}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {eventsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : timeEvents?.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No hay fichajes registrados este mes</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Días trabajados</span>
                    <span className="font-medium">{summary.daysWorked} días</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Total fichajes</span>
                    <span className="font-medium">{timeEvents?.length || 0} registros</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Media diaria</span>
                    <span className="font-medium">
                      {summary.daysWorked > 0 
                        ? (summary.totalHours / summary.daysWorked).toFixed(2) 
                        : 0}h
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Signature Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSignature className="h-5 w-5" />
                Firma del Cierre
              </CardTitle>
              <CardDescription>
                Confirma que los datos son correctos y firma digitalmente
              </CardDescription>
            </CardHeader>
            <CardContent>
              {existingClosure?.status === 'signed' ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-2 text-green-600 mb-2">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">Cierre firmado</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Firmado el {format(parseISO(existingClosure.signed_at!), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
                    </p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total horas:</span>
                      <span>{existingClosure.total_hours}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Horas extra:</span>
                      <span>{existingClosure.overtime_hours}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Hash de firma:</span>
                      <span className="font-mono text-xs">{existingClosure.signature_hash?.substring(0, 16)}...</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <div className="flex items-center gap-2 text-yellow-600 mb-2">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-medium">Pendiente de firma</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Revisa los datos y firma el cierre mensual para confirmar tus horas trabajadas.
                    </p>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={() => setIsDialogOpen(true)}
                    disabled={timeEvents?.length === 0}
                  >
                    <FileSignature className="h-4 w-4 mr-2" />
                    Firmar Cierre Mensual
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Previous Closures */}
        <Card>
          <CardHeader>
            <CardTitle>Historial de Cierres</CardTitle>
            <CardDescription>Tus cierres mensuales anteriores</CardDescription>
          </CardHeader>
          <CardContent>
            {closuresLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : closures?.length === 0 ? (
              <div className="text-center py-8">
                <FileSignature className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No hay cierres firmados</p>
              </div>
            ) : (
              <div className="space-y-2">
                {closures?.map((closure) => (
                  <div
                    key={closure.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <span className="font-medium">
                        {monthNames[closure.month - 1]} {closure.year}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        • {closure.total_hours}h totales
                      </span>
                    </div>
                    <Badge className={
                      closure.status === 'signed' 
                        ? 'bg-green-500/10 text-green-600 border-green-500/20'
                        : 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                    }>
                      {closure.status === 'signed' ? 'Firmado' : 'Pendiente'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Signature Confirmation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Firma del Cierre</DialogTitle>
            <DialogDescription>
              Vas a firmar el cierre de horas de {monthNames[month - 1]} {year}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-muted space-y-2">
              <div className="flex justify-between">
                <span>Total horas:</span>
                <span className="font-bold">{summary.totalHours}h</span>
              </div>
              <div className="flex justify-between">
                <span>Horas ordinarias:</span>
                <span>{summary.regularHours}h</span>
              </div>
              <div className="flex justify-between">
                <span>Horas extra:</span>
                <span>{summary.overtimeHours}h</span>
              </div>
              <div className="flex justify-between">
                <span>Horas nocturnas:</span>
                <span>{summary.nightHours}h</span>
              </div>
            </div>
            
            <div className="flex items-start space-x-2">
              <Checkbox 
                id="confirm" 
                checked={confirmChecked}
                onCheckedChange={(checked) => setConfirmChecked(checked === true)}
              />
              <Label htmlFor="confirm" className="text-sm leading-relaxed">
                Confirmo que he revisado los datos y que las horas registradas son correctas. 
                Entiendo que esta firma tiene validez legal probatoria.
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => signMutation.mutate()}
              disabled={!confirmChecked || signMutation.isPending}
            >
              {signMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Firmando...
                </>
              ) : (
                <>
                  <FileSignature className="h-4 w-4 mr-2" />
                  Firmar Cierre
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EmployeeLayout>
  );
}
