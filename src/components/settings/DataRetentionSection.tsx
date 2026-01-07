import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { 
  Database, 
  Clock, 
  Trash2, 
  Shield,
  History,
  Play,
  Settings
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const CATEGORY_LABELS: Record<string, string> = {
  time_events: 'Registros de jornada',
  corrected_events: 'Eventos corregidos',
  correction_requests: 'Solicitudes de corrección',
  absence_requests: 'Solicitudes de ausencias',
  audit_log: 'Logs de auditoría',
  employee_documents_health: 'Justificantes médicos',
  dt_evidences: 'Evidencias QTSP',
  document_acknowledgments: 'Aceptaciones de documentos',
  contingency_records: 'Registros de contingencia',
};

export function DataRetentionSection() {
  const { companyId, company } = useCompany();
  const queryClient = useQueryClient();
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: configs, isLoading } = useQuery({
    queryKey: ['data-retention-config', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('data_retention_config')
        .select('*')
        .eq('company_id', companyId)
        .order('data_category');
      if (error) throw error;
      
      if (!data || data.length === 0) {
        await supabase.rpc('seed_default_retention_config', { p_company_id: companyId });
        const { data: newData } = await supabase
          .from('data_retention_config')
          .select('*')
          .eq('company_id', companyId)
          .order('data_category');
        return newData || [];
      }
      
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: purgeLogs } = useQuery({
    queryKey: ['data-purge-logs', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('data_purge_log')
        .select('*')
        .eq('company_id', companyId)
        .order('purged_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const updateMutation = useMutation({
    mutationFn: async (config: { id: string; retention_years: number; is_active: boolean }) => {
      const { error } = await supabase
        .from('data_retention_config')
        .update({
          retention_years: config.retention_years,
          is_active: config.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Configuración actualizada');
      queryClient.invalidateQueries({ queryKey: ['data-retention-config'] });
      setEditDialogOpen(false);
      setEditingConfig(null);
    },
    onError: () => {
      toast.error('Error al actualizar');
    },
  });

  const purgeMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const { data, error } = await supabase.functions.invoke('data-retention-purge', {
        body: { company_id: companyId, dry_run: dryRun }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, dryRun) => {
      if (dryRun) {
        if (data.summary.total_records_found === 0) {
          toast.info('No hay registros que superen el plazo de retención');
        } else {
          toast.info(`Simulación: ${data.summary.total_records_found} registros serían eliminados`, {
            description: 'Ejecuta la purga real para eliminar los datos'
          });
        }
      } else {
        toast.success(`Purga completada: ${data.summary.total_records_purged} registros eliminados`);
        queryClient.invalidateQueries({ queryKey: ['data-purge-logs'] });
      }
    },
    onError: () => {
      toast.error('Error al ejecutar la purga');
    },
  });

  const openEditDialog = (config: any) => {
    setEditingConfig({ ...config });
    setEditDialogOpen(true);
  };

  const totalPurged = purgeLogs?.reduce((sum, log) => sum + log.records_purged, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Retención de Datos</h2>
          <p className="text-sm text-muted-foreground">
            Configura los plazos de conservación y gestiona la purga automática
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => purgeMutation.mutate(true)}
            disabled={purgeMutation.isPending}
          >
            <Play className="h-4 w-4 mr-2" />
            Simular Purga
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={purgeMutation.isPending}>
                <Trash2 className="h-4 w-4 mr-2" />
                Ejecutar Purga
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Ejecutar purga de datos?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción eliminará permanentemente todos los registros que hayan superado
                  su plazo de retención. Esta operación no se puede deshacer.
                  <br /><br />
                  Se recomienda ejecutar primero una simulación para verificar los datos afectados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => purgeMutation.mutate(false)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Confirmar Purga
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorías Configuradas</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{configs?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorías Activas</CardTitle>
            <Shield className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {configs?.filter(c => c.is_active).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Purgas Ejecutadas</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{purgeLogs?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registros Purgados</CardTitle>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPurged.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuración de Retención
          </CardTitle>
          <CardDescription>
            Define los plazos de conservación para cada categoría de datos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoría</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Retención</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs?.map(config => (
                <TableRow key={config.id}>
                  <TableCell className="font-medium">
                    {CATEGORY_LABELS[config.data_category] || config.data_category}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {config.description}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      <Clock className="h-3 w-3 mr-1" />
                      {config.retention_years} años
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {config.is_active ? (
                      <Badge className="bg-green-600">Activo</Badge>
                    ) : (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditDialog(config)}
                    >
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de Purgas
          </CardTitle>
          <CardDescription>
            Registro de las operaciones de eliminación ejecutadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {purgeLogs?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No se han ejecutado purgas todavía
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Registros Eliminados</TableHead>
                  <TableHead>Rango de Fechas</TableHead>
                  <TableHead>Hash de Evidencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purgeLogs?.map(log => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {format(new Date(log.purged_at), "dd/MM/yyyy HH:mm", { locale: es })}
                    </TableCell>
                    <TableCell>
                      {CATEGORY_LABELS[log.data_category] || log.data_category}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.records_purged}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.oldest_record_date} - {log.newest_record_date}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.content_hash_before?.substring(0, 16)}...
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Configuración de Retención</DialogTitle>
            <DialogDescription>
              {CATEGORY_LABELS[editingConfig?.data_category] || editingConfig?.data_category}
            </DialogDescription>
          </DialogHeader>
          {editingConfig && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="years">Años de Retención</Label>
                <Input
                  id="years"
                  type="number"
                  min="1"
                  max="15"
                  value={editingConfig.retention_years}
                  onChange={(e) => setEditingConfig((prev: any) => ({
                    ...prev,
                    retention_years: parseInt(e.target.value) || 4
                  }))}
                />
                <p className="text-xs text-muted-foreground">
                  Los registros más antiguos que este plazo serán eliminados en la purga
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="active">Purga Activa</Label>
                  <p className="text-xs text-muted-foreground">
                    Si está desactivado, esta categoría no se incluirá en las purgas
                  </p>
                </div>
                <Switch
                  id="active"
                  checked={editingConfig.is_active}
                  onCheckedChange={(checked) => setEditingConfig((prev: any) => ({
                    ...prev,
                    is_active: checked
                  }))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => updateMutation.mutate({
                id: editingConfig.id,
                retention_years: editingConfig.retention_years,
                is_active: editingConfig.is_active,
              })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
