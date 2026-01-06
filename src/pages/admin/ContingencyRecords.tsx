import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
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
import { 
  FileText, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Download,
  Printer
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function ContingencyRecords() {
  const { companyId, company } = useCompany();
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

  // Fetch employees
  const { data: employees } = useQuery({
    queryKey: ['employees-list', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, employee_code')
        .eq('company_id', companyId)
        .eq('status', 'active')
        .order('last_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Fetch contingency records
  const { data: records, isLoading } = useQuery({
    queryKey: ['contingency-records', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('contingency_records')
        .select(`
          *,
          employees(first_name, last_name, employee_code)
        `)
        .eq('company_id', companyId)
        .order('contingency_date', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Get current user's employee ID for transcribed_by
  const { data: currentEmployee } = useQuery({
    queryKey: ['current-employee', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Create contingency record mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!companyId) throw new Error('No company');
      
      const { data: record, error } = await supabase
        .from('contingency_records')
        .insert({
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
        })
        .select()
        .single();
      
      if (error) throw error;
      return record;
    },
    onSuccess: () => {
      toast.success('Registro de contingencia creado');
      queryClient.invalidateQueries({ queryKey: ['contingency-records'] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      console.error('Create error:', error);
      toast.error('Error al crear el registro');
    },
  });

  // Validate contingency record mutation
  const validateMutation = useMutation({
    mutationFn: async (recordId: string) => {
      const { error } = await supabase
        .from('contingency_records')
        .update({
          validated_by: currentEmployee?.id || user?.id,
          validated_at: new Date().toISOString(),
        })
        .eq('id', recordId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Registro validado');
      queryClient.invalidateQueries({ queryKey: ['contingency-records'] });
    },
    onError: () => {
      toast.error('Error al validar');
    },
  });

  const resetForm = () => {
    setFormData({
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
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employee_id || !formData.reason) {
      toast.error('Completa los campos obligatorios');
      return;
    }
    createMutation.mutate(formData);
  };

  const pendingValidation = records?.filter(r => !r.validated_at) || [];
  const validated = records?.filter(r => r.validated_at) || [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Registros de Contingencia</h1>
            <p className="text-muted-foreground">
              Transcripción de partes en papel cuando el sistema no está disponible
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir Plantilla
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Registro
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Transcribir Parte de Contingencia</DialogTitle>
                  <DialogDescription>
                    Introduce los datos del parte en papel
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="employee">Empleado *</Label>
                      <Select
                        value={formData.employee_id}
                        onValueChange={(v) => setFormData(prev => ({ ...prev, employee_id: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar empleado" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees?.map(emp => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.employee_code} - {emp.first_name} {emp.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date">Fecha *</Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.contingency_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, contingency_date: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="entry">Entrada</Label>
                      <Input
                        id="entry"
                        type="time"
                        value={formData.entry_time}
                        onChange={(e) => setFormData(prev => ({ ...prev, entry_time: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pause_start">Inicio Pausa</Label>
                      <Input
                        id="pause_start"
                        type="time"
                        value={formData.pause_start}
                        onChange={(e) => setFormData(prev => ({ ...prev, pause_start: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pause_end">Fin Pausa</Label>
                      <Input
                        id="pause_end"
                        type="time"
                        value={formData.pause_end}
                        onChange={(e) => setFormData(prev => ({ ...prev, pause_end: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="exit">Salida</Label>
                      <Input
                        id="exit"
                        type="time"
                        value={formData.exit_time}
                        onChange={(e) => setFormData(prev => ({ ...prev, exit_time: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason">Motivo de la Contingencia *</Label>
                    <Select
                      value={formData.reason}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, reason: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar motivo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="network_failure">Caída de red</SelectItem>
                        <SelectItem value="terminal_failure">Fallo del terminal</SelectItem>
                        <SelectItem value="power_outage">Corte eléctrico</SelectItem>
                        <SelectItem value="system_maintenance">Mantenimiento del sistema</SelectItem>
                        <SelectItem value="other">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reference">Referencia del Parte en Papel</Label>
                    <Input
                      id="reference"
                      value={formData.paper_form_reference}
                      onChange={(e) => setFormData(prev => ({ ...prev, paper_form_reference: e.target.value }))}
                      placeholder="Ej: CONT-2026-001"
                    />
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="emp_sig"
                        checked={formData.employee_signature_confirmed}
                        onCheckedChange={(c) => setFormData(prev => ({ ...prev, employee_signature_confirmed: c as boolean }))}
                      />
                      <label htmlFor="emp_sig" className="text-sm">Firma del empleado confirmada</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="sup_sig"
                        checked={formData.supervisor_signature_confirmed}
                        onCheckedChange={(c) => setFormData(prev => ({ ...prev, supervisor_signature_confirmed: c as boolean }))}
                      />
                      <label htmlFor="sup_sig" className="text-sm">Firma del responsable confirmada</label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notas adicionales</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Observaciones..."
                    />
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? 'Guardando...' : 'Guardar Registro'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendientes de Validar</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingValidation.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Validados</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{validated.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Registros</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{records?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Records Table */}
        <Card>
          <CardHeader>
            <CardTitle>Registros de Contingencia</CardTitle>
            <CardDescription>
              Historial de partes en papel transcritos al sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Salida</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records?.map(record => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {format(new Date(record.contingency_date), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      {record.employees?.employee_code} - {record.employees?.first_name} {record.employees?.last_name}
                    </TableCell>
                    <TableCell>{record.entry_time || '-'}</TableCell>
                    <TableCell>{record.exit_time || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {record.reason === 'network_failure' && 'Caída de red'}
                        {record.reason === 'terminal_failure' && 'Fallo terminal'}
                        {record.reason === 'power_outage' && 'Corte eléctrico'}
                        {record.reason === 'system_maintenance' && 'Mantenimiento'}
                        {record.reason === 'other' && 'Otro'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {record.validated_at ? (
                        <Badge className="bg-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Validado
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                          <Clock className="h-3 w-3 mr-1" />
                          Pendiente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!record.validated_at && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => validateMutation.mutate(record.id)}
                          disabled={validateMutation.isPending}
                        >
                          Validar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {records?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No hay registros de contingencia
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Printable Paper Form Template */}
        <Card className="print:block hidden">
          <CardHeader>
            <CardTitle>PARTE DE FICHAJE POR CONTINGENCIA</CardTitle>
            <CardDescription>{company?.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p><strong>Empleado:</strong> _____________________________</p>
                <p><strong>DNI/NIE:</strong> _____________________________</p>
              </div>
              <div>
                <p><strong>Fecha:</strong> ____/____/________</p>
                <p><strong>Centro:</strong> _____________________________</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <p><strong>Entrada:</strong> ____:____</p>
              <p><strong>Pausa ini:</strong> ____:____</p>
              <p><strong>Pausa fin:</strong> ____:____</p>
              <p><strong>Salida:</strong> ____:____</p>
            </div>
            <div>
              <p><strong>Motivo contingencia:</strong></p>
              <p>☐ Caída de red ☐ Fallo terminal ☐ Corte eléctrico ☐ Otro: __________</p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-8">
              <div className="text-center">
                <p>_____________________________</p>
                <p className="text-sm">Firma trabajador/a</p>
              </div>
              <div className="text-center">
                <p>_____________________________</p>
                <p className="text-sm">Firma responsable</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
