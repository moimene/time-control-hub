import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { EmployeeLayout } from '@/components/layout/EmployeeLayout';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { EventType } from '@/types/database';

interface PrefillState {
  prefillDate?: string;
  prefillEventType?: EventType;
  prefillReason?: string;
}

export default function RequestCorrection() {
  const { employee } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const prefillState = location.state as PrefillState | null;
  
  const [date, setDate] = useState<Date | undefined>(() => {
    if (prefillState?.prefillDate) {
      return new Date(prefillState.prefillDate);
    }
    return undefined;
  });
  const [time, setTime] = useState(() => {
    if (prefillState?.prefillDate) {
      const d = new Date(prefillState.prefillDate);
      return format(d, 'HH:mm');
    }
    return '09:00';
  });
  const [eventType, setEventType] = useState<EventType>(
    prefillState?.prefillEventType || 'entry'
  );
  const [reason, setReason] = useState(prefillState?.prefillReason || '');
  
  // Clear location state after initial load to prevent re-prefilling on refresh
  useEffect(() => {
    if (prefillState) {
      window.history.replaceState({}, document.title);
    }
  }, [prefillState]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!date || !employee) return;

      const [hours, minutes] = time.split(':').map(Number);
      const requestedTimestamp = new Date(date);
      requestedTimestamp.setHours(hours, minutes, 0, 0);

      const { error } = await supabase.from('correction_requests').insert([{
        employee_id: employee.id,
        requested_event_type: eventType,
        requested_timestamp: requestedTimestamp.toISOString(),
        reason,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-correction-requests'] });
      toast({ title: 'Solicitud enviada correctamente' });
      setDate(undefined);
      setTime('09:00');
      setEventType('entry');
      setReason('');
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !reason.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Por favor completa todos los campos',
      });
      return;
    }
    createMutation.mutate();
  };

  return (
    <EmployeeLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Solicitar Corrección</h1>
          <p className="text-muted-foreground">
            Envía una solicitud para corregir o añadir un fichaje
          </p>
        </div>

        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Nueva solicitud</CardTitle>
            <CardDescription>
              Indica los datos del fichaje que necesitas corregir o añadir
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Fecha *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !date && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, 'dd/MM/yyyy', { locale: es }) : 'Seleccionar fecha'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        locale={es}
                        disabled={(date) => date > new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time">Hora *</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="time"
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tipo de fichaje *</Label>
                <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entry">Entrada</SelectItem>
                    <SelectItem value="exit">Salida</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Motivo *</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explica por qué necesitas esta corrección..."
                  rows={4}
                />
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Enviando...' : 'Enviar solicitud'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </EmployeeLayout>
  );
}
