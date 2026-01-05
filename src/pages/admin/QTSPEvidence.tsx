import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Shield, Clock, FileText, CheckCircle, AlertCircle, Loader2, Download, RefreshCw, Package, RotateCcw } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export default function QTSPEvidence() {
  const { company, isLoading: loadingCompany } = useCompany();
  const queryClient = useQueryClient();
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState(() => 
    format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')
  );
  const [exportEndDate, setExportEndDate] = useState(() => 
    format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')
  );

  const { data: caseFile, isLoading: loadingCaseFile } = useQuery({
    queryKey: ['dt-case-file', company?.id],
    queryFn: async () => {
      if (!company?.id) return null;
      const { data, error } = await supabase
        .from('dt_case_files')
        .select('*')
        .eq('company_id', company.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!company?.id,
  });

  const { data: evidenceGroups, isLoading: loadingGroups } = useQuery({
    queryKey: ['dt-evidence-groups', caseFile?.id],
    queryFn: async () => {
      if (!caseFile?.id) return [];
      const { data, error } = await supabase
        .from('dt_evidence_groups')
        .select('*')
        .eq('case_file_id', caseFile.id)
        .order('year_month', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!caseFile?.id,
  });

  const { data: evidences, isLoading: loadingEvidences, refetch: refetchEvidences } = useQuery({
    queryKey: ['dt-evidences', evidenceGroups],
    queryFn: async () => {
      if (!evidenceGroups || evidenceGroups.length === 0) return [];
      const groupIds = evidenceGroups.map(g => g.id);
      const { data, error } = await supabase
        .from('dt_evidences')
        .select(`
          *,
          daily_roots (date, root_hash, event_count)
        `)
        .in('evidence_group_id', groupIds)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!evidenceGroups && evidenceGroups.length > 0,
  });

  const { data: auditLogs } = useQuery({
    queryKey: ['qtsp-audit-log', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      const { data, error } = await supabase
        .from('qtsp_audit_log')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!company?.id,
  });

  const retryMutation = useMutation({
    mutationFn: async () => {
      if (!company?.id) throw new Error('No company');
      const { data, error } = await supabase.functions.invoke('qtsp-notarize', {
        body: {
          action: 'retry_failed',
          company_id: company.id,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Reintentados: ${data.succeeded} exitosos, ${data.failed} fallidos`);
      queryClient.invalidateQueries({ queryKey: ['dt-evidences'] });
      queryClient.invalidateQueries({ queryKey: ['qtsp-audit-log'] });
    },
    onError: (error: Error) => {
      toast.error(`Error al reintentar: ${error.message}`);
    },
  });

  const checkPendingMutation = useMutation({
    mutationFn: async () => {
      if (!company?.id) throw new Error('No company');
      const { data, error } = await supabase.functions.invoke('qtsp-notarize', {
        body: {
          action: 'check_status',
          company_id: company.id,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Verificados: ${data.checked} pendientes, ${data.completed} completados`);
      queryClient.invalidateQueries({ queryKey: ['dt-evidences'] });
    },
    onError: (error: Error) => {
      toast.error(`Error al verificar: ${error.message}`);
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!company?.id) throw new Error('No company');
      const { data, error } = await supabase.functions.invoke('qtsp-export-package', {
        body: {
          company_id: company.id,
          start_date: exportStartDate,
          end_date: exportEndDate,
          include_pdfs: true,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evidencia_${company?.name?.replace(/\s+/g, '_')}_${exportStartDate}_${exportEndDate}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Paquete de evidencia exportado');
      setExportDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Error al exportar: ${error.message}`);
    },
  });

  const dailyTimestamps = evidences?.filter(e => e.evidence_type === 'daily_timestamp') || [];
  const monthlyReports = evidences?.filter(e => e.evidence_type === 'monthly_report') || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Completado</Badge>;
      case 'processing':
        return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Procesando</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pendiente</Badge>;
    }
  };

  const downloadSealedPDF = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('sealed-reports')
        .download(path);
      
      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = path.split('/').pop() || 'sealed_report.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Error al descargar el PDF sellado');
    }
  };

  const stats = {
    totalTimestamps: dailyTimestamps.length,
    completedTimestamps: dailyTimestamps.filter(e => e.status === 'completed').length,
    failedTimestamps: dailyTimestamps.filter(e => e.status === 'failed').length,
    totalReports: monthlyReports.length,
    completedReports: monthlyReports.filter(e => e.status === 'completed').length,
  };

  if (loadingCompany || loadingCaseFile || loadingGroups || loadingEvidences) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6" />
              Evidencias QTSP
            </h1>
            <p className="text-muted-foreground">
              Registro de evidencias cualificadas con EADTrust - {company?.name}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setExportDialogOpen(true)}>
              <Package className="w-4 h-4 mr-2" />
              Exportar
            </Button>
            <Button 
              variant="outline" 
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending || stats.failedTimestamps === 0}
            >
              {retryMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              Reintentar fallidos ({stats.failedTimestamps})
            </Button>
            <Button 
              variant="outline" 
              onClick={() => checkPendingMutation.mutate()}
              disabled={checkPendingMutation.isPending}
            >
              {checkPendingMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Verificar pendientes
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Case File</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {caseFile ? '1' : '0'}
              </div>
              <p className="text-xs text-muted-foreground">
                {caseFile?.name || 'No configurado'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Grupos de Evidencia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{evidenceGroups?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Meses registrados</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Timestamps Diarios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.completedTimestamps}/{stats.totalTimestamps}
              </div>
              <p className="text-xs text-muted-foreground">
                Completados {stats.failedTimestamps > 0 && `(${stats.failedTimestamps} fallidos)`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Informes Sellados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.completedReports}/{stats.totalReports}
              </div>
              <p className="text-xs text-muted-foreground">PDFs firmados</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="timestamps" className="space-y-4">
          <TabsList>
            <TabsTrigger value="timestamps" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Timestamps Diarios
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Informes Mensuales
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Auditoría
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timestamps">
            <Card>
              <CardHeader>
                <CardTitle>Sellos de Tiempo Diarios</CardTitle>
                <CardDescription>
                  Cada día se genera un hash Merkle de todos los fichajes y se sella con timestamp cualificado
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dailyTimestamps.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay timestamps registrados aún
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Eventos</TableHead>
                        <TableHead>Hash Merkle</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Token TSP</TableHead>
                        <TableHead>Timestamp</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyTimestamps.map((evidence: any) => (
                        <TableRow key={evidence.id}>
                          <TableCell className="font-medium">
                            {evidence.daily_roots?.date ? 
                              format(new Date(evidence.daily_roots.date), 'dd MMM yyyy', { locale: es }) :
                              '-'
                            }
                          </TableCell>
                          <TableCell>{evidence.daily_roots?.event_count || 0}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {evidence.daily_roots?.root_hash?.substring(0, 16)}...
                          </TableCell>
                          <TableCell>{getStatusBadge(evidence.status)}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {evidence.tsp_token ? 
                              `${evidence.tsp_token.substring(0, 20)}...` : 
                              '-'
                            }
                          </TableCell>
                          <TableCell>
                            {evidence.tsp_timestamp ? 
                              format(new Date(evidence.tsp_timestamp), 'dd/MM/yyyy HH:mm', { locale: es }) :
                              '-'
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Informes Mensuales Sellados</CardTitle>
                <CardDescription>
                  PDFs de informes mensuales con firma electrónica cualificada PAdES-LTV
                </CardDescription>
              </CardHeader>
              <CardContent>
                {monthlyReports.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay informes sellados aún. Los informes se sellan al exportar desde la sección de Informes.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mes</TableHead>
                        <TableHead>Archivo Original</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Completado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyReports.map((evidence: any) => (
                        <TableRow key={evidence.id}>
                          <TableCell className="font-medium">
                            {evidence.report_month}
                          </TableCell>
                          <TableCell>{evidence.original_pdf_path || '-'}</TableCell>
                          <TableCell>{getStatusBadge(evidence.status)}</TableCell>
                          <TableCell>
                            {evidence.completed_at ? 
                              format(new Date(evidence.completed_at), 'dd/MM/yyyy HH:mm', { locale: es }) :
                              '-'
                            }
                          </TableCell>
                          <TableCell>
                            {evidence.sealed_pdf_path && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadSealedPDF(evidence.sealed_pdf_path)}
                              >
                                <Download className="w-4 h-4 mr-1" />
                                Descargar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle>Registro de Auditoría QTSP</CardTitle>
                <CardDescription>
                  Historial de operaciones con el servicio de timestamp cualificado
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!auditLogs || auditLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay registros de auditoría aún
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Acción</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Duración</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
                          </TableCell>
                          <TableCell className="font-medium">
                            {log.action}
                          </TableCell>
                          <TableCell>
                            <Badge variant={log.status === 'success' ? 'default' : log.status === 'failed' ? 'destructive' : 'secondary'}>
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {log.duration_ms ? `${log.duration_ms}ms` : '-'}
                          </TableCell>
                          <TableCell className="text-xs text-destructive max-w-xs truncate">
                            {log.error_message || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Evidence Groups */}
        <Card>
          <CardHeader>
            <CardTitle>Grupos de Evidencia por Mes</CardTitle>
            <CardDescription>
              Organización de evidencias en Digital Trust
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!evidenceGroups || evidenceGroups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay grupos de evidencia creados aún
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {evidenceGroups.map((group: any) => (
                  <Card key={group.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{group.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(group.year_month + '-01'), 'MMMM yyyy', { locale: es })}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {evidences?.filter(e => e.evidence_group_id === group.id).length || 0} evidencias
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar Paquete de Evidencia</DialogTitle>
            <DialogDescription>
              Genera un archivo JSON con todas las evidencias y hashes del período seleccionado
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="start-date" className="text-right">
                Desde
              </Label>
              <Input
                id="start-date"
                type="date"
                value={exportStartDate}
                onChange={(e) => setExportStartDate(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="end-date" className="text-right">
                Hasta
              </Label>
              <Input
                id="end-date"
                type="date"
                value={exportEndDate}
                onChange={(e) => setExportEndDate(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
            >
              {exportMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Package className="w-4 h-4 mr-2" />
              )}
              Exportar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
