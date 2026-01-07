import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  AlertCircle, 
  Info, 
  Scale, 
  FileText, 
  Clock, 
  Car,
  Calendar
} from 'lucide-react';
import { format, addDays, differenceInDays, differenceInBusinessDays, parseISO } from 'date-fns';
import { CoverageCheckBadge } from './CoverageCheckBadge';
import { JustificationUpload } from './JustificationUpload';
import { HolidayIndicator } from './HolidayIndicator';

const legalOriginLabels: Record<string, string> = {
  ley: 'Estatuto de los Trabajadores',
  convenio: 'Convenio Colectivo',
  empresa: 'Política de Empresa',
};

interface UploadedFile {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
}

interface AbsenceRequestFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AbsenceRequestForm({ open, onOpenChange }: AbsenceRequestFormProps) {
  const { employee } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Form state
  const [selectedType, setSelectedType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startHalfDay, setStartHalfDay] = useState(false);
  const [endHalfDay, setEndHalfDay] = useState(false);
  const [totalHours, setTotalHours] = useState<number | null>(null);
  const [travelKm, setTravelKm] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [coverageResult, setCoverageResult] = useState<any>(null);
  const [holidayCount, setHolidayCount] = useState(0);

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
    enabled: !!employee?.company_id && open,
  });

  // Get selected type info
  const selectedTypeInfo = absenceTypes?.find(t => t.id === selectedType);

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
    enabled: !!employee?.id && open,
  });

  // Auto-fill end date when selecting a type with fixed duration
  useEffect(() => {
    if (selectedTypeInfo?.duration_value && startDate && !selectedTypeInfo.duration_is_range) {
      const daysToAdd = selectedTypeInfo.duration_value - 1;
      const computeOn = selectedTypeInfo.compute_on;
      const start = new Date(startDate);
      
      if (computeOn === 'dias_naturales') {
        setEndDate(format(addDays(start, daysToAdd), 'yyyy-MM-dd'));
      } else {
        let currentDate = start;
        let daysAdded = 0;
        while (daysAdded < daysToAdd) {
          currentDate = addDays(currentDate, 1);
          const dayOfWeek = currentDate.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            daysAdded++;
          }
        }
        setEndDate(format(currentDate, 'yyyy-MM-dd'));
      }
    }
  }, [selectedType, startDate, selectedTypeInfo]);

  // Calculate total days
  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    const computeOn = selectedTypeInfo?.compute_on || 'dias_laborables';
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    let days = computeOn === 'dias_naturales'
      ? differenceInDays(end, start) + 1
      : differenceInBusinessDays(end, start) + 1;
    
    // Subtract holidays for laborables
    if (computeOn === 'dias_laborables' && holidayCount > 0) {
      days = Math.max(1, days - holidayCount);
    }
    
    // Adjust for half days
    if (startHalfDay) days -= 0.5;
    if (endHalfDay && startDate !== endDate) days -= 0.5;
    
    return Math.max(0, days);
  };

  // Check if travel days apply
  const extraTravelDays = () => {
    if (!selectedTypeInfo?.travel_threshold_km || !travelKm) return 0;
    if (travelKm > selectedTypeInfo.travel_threshold_km) {
      return selectedTypeInfo.extra_travel_days || 0;
    }
    return 0;
  };

  // Create request mutation using edge function
  const createRequestMutation = useMutation({
    mutationFn: async () => {
      if (!employee || !selectedType || !startDate || !endDate) {
        throw new Error('Faltan datos requeridos');
      }

      const { data, error } = await supabase.functions.invoke('absence-create', {
        body: {
          company_id: employee.company_id,
          employee_id: employee.id,
          absence_type_id: selectedType,
          start_date: startDate,
          end_date: endDate,
          start_half_day: startHalfDay,
          end_half_day: endHalfDay,
          total_hours: totalHours,
          travel_km: travelKm,
          reason: reason || null,
          justification_files: uploadedFiles
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Solicitud enviada correctamente' });
      queryClient.invalidateQueries({ queryKey: ['absence-requests'] });
      queryClient.invalidateQueries({ queryKey: ['vacation-balance'] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const resetForm = () => {
    setSelectedType('');
    setStartDate('');
    setEndDate('');
    setStartHalfDay(false);
    setEndHalfDay(false);
    setTotalHours(null);
    setTravelKm(null);
    setReason('');
    setUploadedFiles([]);
    setCoverageResult(null);
    setHolidayCount(0);
  };

  // Calculate remaining balance after this request
  const remainingBalance = () => {
    if (!vacationBalance || selectedTypeInfo?.absence_category !== 'vacaciones') return null;
    const available = vacationBalance.entitled_days + vacationBalance.carried_over_days - vacationBalance.used_days - vacationBalance.pending_days;
    const requested = calculateDays() + extraTravelDays();
    return Math.max(0, available - requested);
  };

  const isValidRequest = () => {
    if (!selectedType || !startDate || !endDate) return false;
    if (selectedTypeInfo?.requires_justification && uploadedFiles.length === 0) return false;
    if (selectedTypeInfo?.compute_on === 'horas' && (!totalHours || totalHours <= 0)) return false;
    
    // Check vacation balance
    const balance = remainingBalance();
    if (balance !== null && balance < 0) return false;
    
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Solicitud de Ausencia</DialogTitle>
          <DialogDescription>
            Completa el formulario para solicitar una ausencia
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Type selector */}
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
                </AlertDescription>
              </Alert>
            ) : (
              <Select value={selectedType} onValueChange={(value) => {
                setSelectedType(value);
                setEndDate('');
                setStartHalfDay(false);
                setEndHalfDay(false);
                setTotalHours(null);
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
                    {selectedTypeInfo.travel_threshold_km && (
                      <Badge variant="outline" className="text-xs">
                        <Car className="h-3 w-3 mr-1" />
                        +{selectedTypeInfo.extra_travel_days} días si {'>'}{selectedTypeInfo.travel_threshold_km}km
                      </Badge>
                    )}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Date selectors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha inicio</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              {selectedTypeInfo?.half_day_allowed && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="startHalfDay"
                    checked={startHalfDay}
                    onCheckedChange={(checked) => setStartHalfDay(checked as boolean)}
                  />
                  <Label htmlFor="startHalfDay" className="text-sm text-muted-foreground">
                    Medio día (tarde)
                  </Label>
                </div>
              )}
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
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                disabled={selectedTypeInfo?.duration_value && !selectedTypeInfo.duration_is_range}
              />
              {selectedTypeInfo?.half_day_allowed && startDate !== endDate && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="endHalfDay"
                    checked={endHalfDay}
                    onCheckedChange={(checked) => setEndHalfDay(checked as boolean)}
                  />
                  <Label htmlFor="endHalfDay" className="text-sm text-muted-foreground">
                    Medio día (mañana)
                  </Label>
                </div>
              )}
            </div>
          </div>

          {/* Hours input for hourly absences */}
          {selectedTypeInfo?.compute_on === 'horas' && (
            <div className="space-y-2">
              <Label>Total horas</Label>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                value={totalHours || ''}
                onChange={(e) => setTotalHours(parseFloat(e.target.value) || null)}
                placeholder="Ej: 2.5"
              />
            </div>
          )}

          {/* Travel distance input */}
          {selectedTypeInfo?.travel_threshold_km && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Car className="h-4 w-4" />
                Distancia desplazamiento (km)
              </Label>
              <Input
                type="number"
                min="0"
                value={travelKm || ''}
                onChange={(e) => setTravelKm(parseInt(e.target.value) || null)}
                placeholder="Ej: 350"
              />
              {travelKm && travelKm > (selectedTypeInfo.travel_threshold_km || 0) && (
                <p className="text-sm text-green-600">
                  +{selectedTypeInfo.extra_travel_days} días adicionales por desplazamiento
                </p>
              )}
            </div>
          )}

          {/* Holiday indicator and days calculation */}
          {startDate && endDate && employee?.company_id && (
            <>
              <HolidayIndicator
                companyId={employee.company_id}
                startDate={startDate}
                endDate={endDate}
                computeOn={selectedTypeInfo?.compute_on as any || 'dias_laborables'}
                onHolidaysCalculated={setHolidayCount}
              />
              
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  Total solicitado: <strong>{calculateDays() + extraTravelDays()} día(s)</strong>
                  {extraTravelDays() > 0 && (
                    <span className="text-green-600 ml-1">(+{extraTravelDays()} por desplazamiento)</span>
                  )}
                </span>
              </div>
            </>
          )}

          {/* Vacation balance warning */}
          {selectedTypeInfo?.absence_category === 'vacaciones' && vacationBalance && (
            <Alert className={remainingBalance()! < 0 ? 'border-destructive' : 'border-green-500/20'}>
              <AlertDescription>
                <div className="flex justify-between items-center">
                  <span>Saldo disponible: {vacationBalance.entitled_days + vacationBalance.carried_over_days - vacationBalance.used_days - vacationBalance.pending_days} días</span>
                  <span className={remainingBalance()! < 0 ? 'text-destructive' : 'text-green-600'}>
                    Saldo restante: {remainingBalance()} días
                  </span>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Coverage check */}
          {startDate && endDate && employee?.company_id && (
            <div className="space-y-2">
              <Label>Verificación de cobertura</Label>
              <CoverageCheckBadge
                companyId={employee.company_id}
                employeeId={employee.id}
                startDate={startDate}
                endDate={endDate}
                department={employee.department}
                onResult={setCoverageResult}
                autoCheck={true}
              />
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label>
              Motivo {selectedTypeInfo?.requires_justification ? '(obligatorio)' : '(opcional)'}
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe brevemente el motivo de la solicitud..."
              rows={3}
            />
          </div>

          {/* Justification upload */}
          {selectedTypeInfo?.requires_justification && employee && (
            <div className="space-y-2">
              <Label>Justificante(s)</Label>
              <JustificationUpload
                companyId={employee.company_id!}
                employeeId={employee.id}
                onFilesChange={setUploadedFiles}
                required={selectedTypeInfo.requires_justification}
                isMedical={selectedTypeInfo.absence_category === 'suspension'}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={() => createRequestMutation.mutate()}
            disabled={!isValidRequest() || createRequestMutation.isPending}
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
  );
}
