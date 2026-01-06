import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { FileText, Plus, CheckCircle2, Clock, Send } from "lucide-react";
import { format } from "date-fns";

export function ManualRegistrationContent() {
  const { companyId } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: '',
    contingency_date: format(new Date(), 'yyyy-MM-dd'),
    entry_time: '',
    exit_time: '',
    pause_start: '',
    pause_end: '',
    reason: '',
    paper_form_reference: '',
    employee_signature_confirmed: false,
    supervisor_signature_confirmed: false,
    notes: '',
  });

  const { data: employees } = useQuery({
    queryKey: ['employees-list', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase.from('employees').select('id, first_name, last_name, employee_code').eq('company_id', companyId).eq('status', 'active').order('last_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: records, isLoading } = useQuery({
    queryKey: ['contingency-records', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase.from('contingency_records').select(`*, employees(first_name, last_name, employee_code)`).eq('company_id', companyId).order('contingency_date', { ascending: false }).limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: currentEmployee } = useQuery({
    queryKey: ['current-employee', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from('employees').select('id').eq('user_id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!companyId) throw new Error('No company');
      const { error } = await supabase.from('contingency_records').insert({
        company_id: companyId,
        employee_id: data.employee_id,
        contingency_date: data.contingency_date,
        entry_time: data.entry_time || null,
        exit_time: data.exit_time || null,
        pause_start: data.pause_start || null,
        pause_end: data.pause_end || null,
        reason: data.reason,
        paper_form_reference: data.paper_form_reference || null,
        employee_signature_confirmed: data.employee_signature_confirmed,
        supervisor_signature_confirmed: data.supervisor_signature_confirmed,
        transcribed_by: currentEmployee?.id || user?.id,
        notes: data.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Registro manual creado');
      queryClient.invalidateQueries({ queryKey: ['contingency-records'] });
      setDialogOpen(false);
      setFormData({ employee_id: '', contingency_date: format(new Date(), 'yyyy-MM-dd'), entry_time: '', exit_time: '', pause_start: '', pause_end: '', reason: '', paper_form_reference: '', employee_signature_confirmed: false, supervisor_signature_confirmed: false, notes: '' });
    },
    onError: () => toast.error('Error al crear el registro'),
  });

  const validateMutation = useMutation({
    mutationFn: async (recordId: string) => {
      const { error } = await supabase.from('contingency_records').update({ validated_by: currentEmployee?.id || user?.id, validated_at: new Date().toISOString() }).eq('id', recordId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Registro validado');
      queryClient.invalidateQueries({ queryKey: ['contingency-records'] });
    },
  });

  const sendToEmployeeMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase.from('employee_notifications').insert({
        employee_id: employeeId,
        company_id: companyId,
        notification_type: 'manual_registration_request',
        title: 'Registro de jornada pendiente',
        message: 'Tiene un registro de jornada pendiente de cumplimentar. Por favor, acceda a su portal para completarlo.',
        action_url: '/employee/manual-registration',
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success('Notificación enviada al empleado'),
    onError: () => toast.error('Error al enviar notificación'),
  });

  const pendingValidation = records?.filter(r => !r.validated_at) || [];
  const validated = records?.filter(r => r.validated_at) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nuevo Registro Manual</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Transcribir Parte Manual</DialogTitle>
              <DialogDescription>Introduce los datos del parte en papel</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); if (formData.employee_id && formData.reason) createMutation.mutate(formData); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Empleado *</Label>
                  <Select value={formData.employee_id} onValueChange={(v) => setFormData(prev => ({ ...prev, employee_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{employees?.map(emp => (<SelectItem key={emp.id} value={emp.id}>{emp.employee_code} - {emp.first_name} {emp.last_name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fecha *</Label>
                  <Input type="date" value={formData.contingency_date} onChange={(e) => setFormData(prev => ({ ...prev, contingency_date: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2"><Label>Entrada</Label><Input type="time" value={formData.entry_time} onChange={(e) => setFormData(prev => ({ ...prev, entry_time: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Inicio Pausa</Label><Input type="time" value={formData.pause_start} onChange={(e) => setFormData(prev => ({ ...prev, pause_start: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Fin Pausa</Label><Input type="time" value={formData.pause_end} onChange={(e) => setFormData(prev => ({ ...prev, pause_end: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Salida</Label><Input type="time" value={formData.exit_time} onChange={(e) => setFormData(prev => ({ ...prev, exit_time: e.target.value }))} /></div>
              </div>
              <div className="space-y-2">
                <Label>Motivo *</Label>
                <Select value={formData.reason} onValueChange={(v) => setFormData(prev => ({ ...prev, reason: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="network_failure">Caída de red</SelectItem>
                    <SelectItem value="terminal_failure">Fallo del terminal</SelectItem>
                    <SelectItem value="power_outage">Corte eléctrico</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox id="emp_sig" checked={formData.employee_signature_confirmed} onCheckedChange={(c) => setFormData(prev => ({ ...prev, employee_signature_confirmed: c as boolean }))} />
                  <label htmlFor="emp_sig" className="text-sm">Firma empleado</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="sup_sig" checked={formData.supervisor_signature_confirmed} onCheckedChange={(c) => setFormData(prev => ({ ...prev, supervisor_signature_confirmed: c as boolean }))} />
                  <label htmlFor="sup_sig" className="text-sm">Firma responsable</label>
                </div>
              </div>
              <div className="space-y-2"><Label>Notas</Label><Textarea value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} /></div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Guardando...' : 'Guardar'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pendientes</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{pendingValidation.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Validados</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{validated.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{records?.length || 0}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Registros Manuales</CardTitle><CardDescription>Historial de partes transcritos</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Salida</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records?.map(record => (
                <TableRow key={record.id}>
                  <TableCell>{format(new Date(record.contingency_date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{record.employees?.first_name} {record.employees?.last_name}</TableCell>
                  <TableCell>{record.entry_time || '-'}</TableCell>
                  <TableCell>{record.exit_time || '-'}</TableCell>
                  <TableCell>{record.validated_at ? <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Validado</Badge> : <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {!record.validated_at && <Button size="sm" variant="ghost" onClick={() => validateMutation.mutate(record.id)}><CheckCircle2 className="h-4 w-4" /></Button>}
                      <Button size="sm" variant="ghost" onClick={() => sendToEmployeeMutation.mutate(record.employee_id)}><Send className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
