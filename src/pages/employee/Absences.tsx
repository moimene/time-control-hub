import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EmployeeLayout } from '@/components/layout/EmployeeLayout';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Calendar as CalendarIcon, Clock, CheckCircle2, XCircle, Loader2, Palmtree, AlertCircle, Info, Scale, FileText } from 'lucide-react';
import { format, addDays, parseISO, differenceInDays, differenceInBusinessDays } from 'date-fns';
import { AbsenceRequestForm } from '@/components/absences/AbsenceRequestForm';
import { es } from 'date-fns/locale';

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  approved: 'bg-green-500/10 text-green-600 border-green-500/20',
  rejected: 'bg-red-500/10 text-red-600 border-red-500/20',
  cancelled: 'bg-muted text-muted-foreground',
};

const legalOriginLabels: Record<string, string> = {
  ley: 'Estatuto de los Trabajadores',
  convenio: 'Convenio Colectivo',
  empresa: 'Política de Empresa',
};

export default function EmployeeAbsences() {
  const { employee } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [reason, setReason] = useState('');

  // Fetch absence types
  const { data: absenceTypes, isLoading: typesLoading } = useQuery({
    queryKey: ['absence-types', employee?.company_id],
    queryFn: async () => {
      if (!employee?.company_id) return [];
      const { data, error } = await supabase
        .from('absence_types')
        .select('*')
        .eq('company_id', employee.company_id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!employee?.company_id,
  });

  // Get selected type info
  const selectedTypeInfo = absenceTypes?.find(t => t.id === selectedType);

  // Auto-fill end date when selecting a type with fixed duration
  useEffect(() => {
    if (selectedTypeInfo?.duration_value && startDate && !selectedTypeInfo.duration_is_range) {
      const daysToAdd = selectedTypeInfo.duration_value - 1;
      const computeOn = selectedTypeInfo.compute_on;
      
      if (computeOn === 'dias_naturales') {
        // Natural days - simple addition
        setEndDate(addDays(startDate, daysToAdd));
      } else {
        // Business days - need to skip weekends
        let currentDate = startDate;
        let daysAdded = 0;
        while (daysAdded < daysToAdd) {
          currentDate = addDays(currentDate, 1);
          const dayOfWeek = currentDate.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            daysAdded++;
          }
        }
        setEndDate(currentDate);
      }
    }
  }, [selectedType, startDate, selectedTypeInfo]);

  // Fetch employee's absence requests
  const { data: absenceRequests, isLoading } = useQuery({
    queryKey: ['absence-requests', employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];
      const { data, error } = await supabase
        .from('absence_requests')
        .select(`
          *,
          absence_types(name, color, category)
        `)
        .eq('employee_id', employee.id)
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!employee?.id,
  });

  // Fetch vacation balance
  const { data: vacationBalance } = useQuery({
    queryKey: ['vacation-balance', employee?.id],
    queryFn: async () => {
      if (!employee?.id) return null;
      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase
        .from('vacation_balances')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('year', currentYear)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!employee?.id,
  });

  // Create absence request mutation
  const createRequestMutation = useMutation({
    mutationFn: async () => {
      if (!employee || !selectedType || !startDate || !endDate) {
        throw new Error('Faltan datos requeridos');
      }

      const computeOn = selectedTypeInfo?.compute_on || 'dias_laborables';
      const totalDays = computeOn === 'dias_naturales' 
        ? differenceInDays(endDate, startDate) + 1
        : differenceInBusinessDays(endDate, startDate) + 1;

      const { error } = await supabase.from('absence_requests').insert({
        company_id: employee.company_id,
        employee_id: employee.id,
        absence_type_id: selectedType,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        total_days: totalDays,
        reason,
        status: 'pending',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Solicitud enviada correctamente' });
      queryClient.invalidateQueries({ queryKey: ['absence-requests'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  // Cancel request mutation
  const cancelRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('absence_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Solicitud cancelada' });
      queryClient.invalidateQueries({ queryKey: ['absence-requests'] });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const resetForm = () => {
    setSelectedType('');
    setStartDate(undefined);
    setEndDate(undefined);
    setReason('');
  };

  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    const computeOn = selectedTypeInfo?.compute_on || 'dias_laborables';
    return computeOn === 'dias_naturales'
      ? differenceInDays(endDate, startDate) + 1
      : differenceInBusinessDays(endDate, startDate) + 1;
  };

  const approvedDates = absenceRequests
    ?.filter(r => r.status === 'approved')
    .flatMap(r => {
      const dates: Date[] = [];
      let current = parseISO(r.start_date);
      const end = parseISO(r.end_date);
      while (current <= end) {
        dates.push(current);
        current = addDays(current, 1);
      }
      return dates;
    }) || [];

  const pendingDates = absenceRequests
    ?.filter(r => r.status === 'pending')
    .flatMap(r => {
      const dates: Date[] = [];
      let current = parseISO(r.start_date);
      const end = parseISO(r.end_date);
      while (current <= end) {
        dates.push(current);
        current = addDays(current, 1);
      }
      return dates;
    }) || [];

  return (
    <EmployeeLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mis Ausencias</h1>
            <p className="text-muted-foreground">
              Gestiona tus vacaciones, permisos y bajas
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Solicitud
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px]">
              <DialogHeader>
                <DialogTitle>Nueva Solicitud de Ausencia</DialogTitle>
                <DialogDescription>
                  Completa el formulario para solicitar una ausencia
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Tipo de ausencia</Label>
                  {typesLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : absenceTypes?.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No hay tipos de ausencia configurados para tu empresa. 
                        Contacta con tu administrador para que configure los tipos de ausencia disponibles.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Select value={selectedType} onValueChange={(value) => {
                      setSelectedType(value);
                      // Reset dates when changing type
                      setEndDate(undefined);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {absenceTypes?.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: type.color || '#6b7280' }}
                              />
                              <span>{type.name}</span>
                              {type.legal_origin === 'ley' && (
                                <Scale className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Selected type information */}
                {selectedTypeInfo && (
                  <Alert className="bg-primary/5 border-primary/20">
                    <Info className="h-4 w-4 text-primary" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-medium">{selectedTypeInfo.name}</p>
                        {selectedTypeInfo.description && (
                          <p className="text-sm text-muted-foreground">{selectedTypeInfo.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {selectedTypeInfo.duration_value && (
                            <Badge variant="outline" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {selectedTypeInfo.duration_value} {selectedTypeInfo.compute_on === 'dias_naturales' ? 'días naturales' : 'días laborables'}
                            </Badge>
                          )}
                          {selectedTypeInfo.legal_origin && (
                            <Badge variant="secondary" className="text-xs">
                              <Scale className="h-3 w-3 mr-1" />
                              {legalOriginLabels[selectedTypeInfo.legal_origin] || selectedTypeInfo.legal_origin}
                            </Badge>
                          )}
                          {selectedTypeInfo.requires_justification && (
                            <Badge variant="destructive" className="text-xs">
                              <FileText className="h-3 w-3 mr-1" />
                              Requiere justificante
                            </Badge>
                          )}
                          {selectedTypeInfo.is_paid ? (
                            <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                              Retribuido
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              No retribuido
                            </Badge>
                          )}
                        </div>
                        {selectedTypeInfo.convenio_reference && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Ref: {selectedTypeInfo.convenio_reference}
                          </p>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fecha inicio</Label>
                    <Input
                      type="date"
                      value={startDate ? format(startDate, 'yyyy-MM-dd') : ''}
                      onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : undefined)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Fecha fin
                      {selectedTypeInfo?.duration_value && !selectedTypeInfo.duration_is_range && (
                        <span className="text-xs text-muted-foreground ml-1">(auto)</span>
                      )}
                    </Label>
                    <Input
                      type="date"
                      value={endDate ? format(endDate, 'yyyy-MM-dd') : ''}
                      onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : undefined)}
                      min={startDate ? format(startDate, 'yyyy-MM-dd') : ''}
                      disabled={selectedTypeInfo?.duration_value && !selectedTypeInfo.duration_is_range}
                    />
                  </div>
                </div>

                {startDate && endDate && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Total: <strong>{calculateDays()} {selectedTypeInfo?.compute_on === 'dias_naturales' ? 'día(s) natural(es)' : 'día(s) laborable(s)'}</strong>
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Motivo {selectedTypeInfo?.requires_justification ? '(obligatorio)' : '(opcional)'}</Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Describe brevemente el motivo de la solicitud..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={() => createRequestMutation.mutate()}
                  disabled={
                    !selectedType || 
                    !startDate || 
                    !endDate || 
                    createRequestMutation.isPending ||
                    (selectedTypeInfo?.requires_justification && !reason.trim())
                  }
                >
                  {createRequestMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar Solicitud'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Vacation Balance Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Palmtree className="h-5 w-5 text-green-600" />
                Saldo de Vacaciones
              </CardTitle>
              <CardDescription>{new Date().getFullYear()}</CardDescription>
            </CardHeader>
            <CardContent>
              {vacationBalance ? (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Días totales:</span>
                    <span className="font-medium">{vacationBalance.entitled_days}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Días usados:</span>
                    <span className="font-medium">{vacationBalance.used_days}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pendientes aprobación:</span>
                    <span className="font-medium">{vacationBalance.pending_days}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span className="font-medium">Disponibles:</span>
                    <span className="font-bold text-green-600">{vacationBalance.available_days}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No hay saldo configurado para este año
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Calendar */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Calendario de Ausencias
              </CardTitle>
              <CardDescription>
                <span className="inline-flex items-center gap-1 mr-4">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span> Aprobadas
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span> Pendientes
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                locale={es}
                className="rounded-md border"
                modifiers={{
                  approved: approvedDates,
                  pending: pendingDates,
                }}
                modifiersStyles={{
                  approved: { backgroundColor: 'hsl(var(--chart-2) / 0.3)', borderRadius: '0' },
                  pending: { backgroundColor: 'hsl(var(--chart-4) / 0.3)', borderRadius: '0' },
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Requests List */}
        <Card>
          <CardHeader>
            <CardTitle>Historial de Solicitudes</CardTitle>
            <CardDescription>Todas tus solicitudes de ausencia</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : absenceRequests?.length === 0 ? (
              <div className="text-center py-8">
                <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No tienes solicitudes de ausencia</p>
              </div>
            ) : (
              <div className="space-y-3">
                {absenceRequests?.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: request.absence_types?.color || '#6b7280' }}
                      />
                      <div>
                        <div className="font-medium">
                          {request.absence_types?.name || 'Ausencia'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(parseISO(request.start_date), 'dd MMM', { locale: es })}
                          {request.start_date !== request.end_date && (
                            <> - {format(parseISO(request.end_date), 'dd MMM yyyy', { locale: es })}</>
                          )}
                          {request.start_date === request.end_date && (
                            <> {format(parseISO(request.start_date), 'yyyy', { locale: es })}</>
                          )}
                          <span className="mx-2">•</span>
                          {request.total_days} día(s)
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={statusColors[request.status]}>
                        {request.status === 'approved' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {request.status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
                        {statusLabels[request.status]}
                      </Badge>
                      {request.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelRequestMutation.mutate(request.id)}
                          disabled={cancelRequestMutation.isPending}
                        >
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </EmployeeLayout>
  );
}
