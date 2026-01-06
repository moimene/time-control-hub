import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, Plus, AlertTriangle, CheckCircle, Clock, Users, Trash2, Edit } from 'lucide-react';

interface EscalationRule {
  id: string;
  company_id: string | null;
  level: number;
  severity_threshold: string;
  time_threshold_minutes: number;
  consecutive_failures_threshold: number;
  notify_emails: string[];
  notify_in_app: boolean;
  is_active: boolean;
  created_at: string;
}

interface EscalationHistory {
  id: string;
  company_id: string | null;
  escalation_level: number;
  triggered_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  error_category: string | null;
  error_message: string | null;
  notification_sent: boolean;
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'L1 - Soporte Básico',
  2: 'L2 - Soporte Avanzado',
  3: 'L3 - Ingeniería',
};

const SEVERITY_LABELS: Record<string, string> = {
  info: 'Información',
  warn: 'Advertencia',
  critical: 'Crítico',
};

export function EscalationManager() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRule, setNewRule] = useState({
    level: 1,
    severity_threshold: 'critical',
    time_threshold_minutes: 30,
    consecutive_failures_threshold: 5,
    notify_emails: '',
    notify_in_app: true,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch escalation rules
  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ['escalation-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('escalation_rules')
        .select('*')
        .order('level', { ascending: true });
      if (error) throw error;
      return data as EscalationRule[];
    },
  });

  // Fetch active escalations
  const { data: activeEscalations, isLoading: escalationsLoading } = useQuery({
    queryKey: ['active-escalations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('escalation_history')
        .select('*')
        .is('resolved_at', null)
        .order('triggered_at', { ascending: false });
      if (error) throw error;
      return data as EscalationHistory[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Create rule mutation
  const createRuleMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('escalation_rules')
        .insert({
          level: newRule.level,
          severity_threshold: newRule.severity_threshold,
          time_threshold_minutes: newRule.time_threshold_minutes,
          consecutive_failures_threshold: newRule.consecutive_failures_threshold,
          notify_emails: newRule.notify_emails.split(',').map(e => e.trim()).filter(e => e),
          notify_in_app: newRule.notify_in_app,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalation-rules'] });
      setIsCreateOpen(false);
      setNewRule({
        level: 1,
        severity_threshold: 'critical',
        time_threshold_minutes: 30,
        consecutive_failures_threshold: 5,
        notify_emails: '',
        notify_in_app: true,
      });
      toast({ title: 'Regla creada', description: 'La regla de escalado se ha creado correctamente.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: 'No se pudo crear la regla.', variant: 'destructive' });
    },
  });

  // Toggle rule mutation
  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('escalation_rules')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalation-rules'] });
    },
  });

  // Delete rule mutation
  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('escalation_rules')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalation-rules'] });
      toast({ title: 'Regla eliminada' });
    },
  });

  // Acknowledge escalation mutation
  const acknowledgeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('escalation_history')
        .update({ 
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user?.id,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-escalations'] });
      toast({ title: 'Escalado reconocido' });
    },
  });

  // Resolve escalation mutation
  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('escalation_history')
        .update({ resolved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-escalations'] });
      toast({ title: 'Escalado resuelto' });
    },
  });

  return (
    <div className="space-y-6">
      {/* Active Escalations */}
      <Card className={activeEscalations && activeEscalations.length > 0 ? 'border-destructive' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${activeEscalations && activeEscalations.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            Escalados Activos
            {activeEscalations && activeEscalations.length > 0 && (
              <Badge variant="destructive">{activeEscalations.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>Alertas que requieren atención inmediata</CardDescription>
        </CardHeader>
        <CardContent>
          {escalationsLoading ? (
            <div className="animate-pulse h-20 bg-muted rounded" />
          ) : activeEscalations && activeEscalations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nivel</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Mensaje</TableHead>
                  <TableHead>Hace</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeEscalations.map((esc) => (
                  <TableRow key={esc.id}>
                    <TableCell>
                      <Badge variant={esc.escalation_level >= 3 ? 'destructive' : esc.escalation_level >= 2 ? 'secondary' : 'outline'}>
                        {LEVEL_LABELS[esc.escalation_level] || `Nivel ${esc.escalation_level}`}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{esc.error_category || 'UNKNOWN'}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={esc.error_message || ''}>
                      {esc.error_message || '-'}
                    </TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(esc.triggered_at), { addSuffix: true, locale: es })}
                    </TableCell>
                    <TableCell>
                      {esc.acknowledged_at ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle className="h-3 w-3" /> Reconocido
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <Clock className="h-3 w-3" /> Pendiente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {!esc.acknowledged_at && (
                          <Button size="sm" variant="outline" onClick={() => acknowledgeMutation.mutate(esc.id)}>
                            Reconocer
                          </Button>
                        )}
                        <Button size="sm" onClick={() => resolveMutation.mutate(esc.id)}>
                          Resolver
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
              <p>No hay escalados activos</p>
              <p className="text-sm">Todos los sistemas funcionan correctamente</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Escalation Rules */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Reglas de Escalado
            </CardTitle>
            <CardDescription>Configuración de niveles y notificaciones automáticas</CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Regla
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Regla de Escalado</DialogTitle>
                <DialogDescription>Define cuándo y a quién notificar según la severidad del error</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nivel de escalado</Label>
                    <Select 
                      value={String(newRule.level)} 
                      onValueChange={(v) => setNewRule(r => ({ ...r, level: parseInt(v) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">L1 - Soporte Básico</SelectItem>
                        <SelectItem value="2">L2 - Soporte Avanzado</SelectItem>
                        <SelectItem value="3">L3 - Ingeniería</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Severidad mínima</Label>
                    <Select 
                      value={newRule.severity_threshold} 
                      onValueChange={(v) => setNewRule(r => ({ ...r, severity_threshold: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Cualquiera (info+)</SelectItem>
                        <SelectItem value="warn">Advertencia o superior</SelectItem>
                        <SelectItem value="critical">Solo críticos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tiempo sin resolver (min)</Label>
                    <Input 
                      type="number" 
                      value={newRule.time_threshold_minutes}
                      onChange={(e) => setNewRule(r => ({ ...r, time_threshold_minutes: parseInt(e.target.value) || 30 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fallos consecutivos</Label>
                    <Input 
                      type="number" 
                      value={newRule.consecutive_failures_threshold}
                      onChange={(e) => setNewRule(r => ({ ...r, consecutive_failures_threshold: parseInt(e.target.value) || 5 }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Emails de notificación (separados por coma)</Label>
                  <Input 
                    placeholder="soporte@empresa.com, admin@empresa.com"
                    value={newRule.notify_emails}
                    onChange={(e) => setNewRule(r => ({ ...r, notify_emails: e.target.value }))}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="notify_in_app" 
                    checked={newRule.notify_in_app}
                    onCheckedChange={(checked) => setNewRule(r => ({ ...r, notify_in_app: checked }))}
                  />
                  <Label htmlFor="notify_in_app">Notificar también en la aplicación</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                <Button onClick={() => createRuleMutation.mutate()} disabled={createRuleMutation.isPending}>
                  Crear Regla
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {rulesLoading ? (
            <div className="animate-pulse h-40 bg-muted rounded" />
          ) : rules && rules.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nivel</TableHead>
                  <TableHead>Severidad</TableHead>
                  <TableHead>Tiempo (min)</TableHead>
                  <TableHead>Fallos</TableHead>
                  <TableHead>Notificaciones</TableHead>
                  <TableHead>Activa</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <Badge variant={rule.level >= 3 ? 'destructive' : rule.level >= 2 ? 'secondary' : 'outline'}>
                        {LEVEL_LABELS[rule.level]}
                      </Badge>
                    </TableCell>
                    <TableCell>{SEVERITY_LABELS[rule.severity_threshold]}</TableCell>
                    <TableCell>{rule.time_threshold_minutes}</TableCell>
                    <TableCell>{rule.consecutive_failures_threshold}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {rule.notify_emails.length > 0 && <Badge variant="outline">Email ({rule.notify_emails.length})</Badge>}
                        {rule.notify_in_app && <Badge variant="outline">In-App</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch 
                        checked={rule.is_active}
                        onCheckedChange={(checked) => toggleRuleMutation.mutate({ id: rule.id, is_active: checked })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => deleteRuleMutation.mutate(rule.id)}
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
              <Users className="h-12 w-12 mx-auto mb-3" />
              <p>No hay reglas de escalado configuradas</p>
              <p className="text-sm">Crea una regla para comenzar a recibir notificaciones automáticas</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
