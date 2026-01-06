import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Shield, 
  FileText, 
  Bell, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Download, 
  Clock,
  FileBadge,
  History,
  Moon,
  Coffee,
  Timer,
  Plus
} from "lucide-react";
import { format, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

interface CertificateRequestPanelProps {
  defaultTab?: "reports" | "notifications" | "legal" | "history";
}

interface EvidenceItem {
  id: string;
  type: "report" | "notification" | "overtime" | "breaks" | "night_work";
  title: string;
  date: string;
  status: "completed" | "pending" | "processing" | "failed";
  sealed_pdf_path?: string | null;
  tsp_timestamp?: string | null;
  description?: string;
}

interface DownloadRecord {
  id: string;
  downloaded_at: string;
  downloaded_by: string;
  download_type: string;
  document_title: string;
  user_email?: string;
}

export function CertificateRequestPanel({ defaultTab = "reports" }: CertificateRequestPanelProps) {
  const { company } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState(() => format(new Date(), 'yyyy-MM'));
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EvidenceItem | null>(null);
  const [selectedReportType, setSelectedReportType] = useState<'overtime' | 'breaks' | 'night_work'>('overtime');

  // Get available months for selector (last 12 months)
  const availableMonths = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: es }),
    };
  });

  // Fetch sealed reports (monthly_report evidences)
  const { data: sealedReports, isLoading: loadingReports } = useQuery({
    queryKey: ['sealed-reports', company?.id, selectedPeriod],
    queryFn: async () => {
      if (!company?.id) return [];
      
      const { data: caseFile } = await supabase
        .from('dt_case_files')
        .select('id')
        .eq('company_id', company.id)
        .maybeSingle();

      if (!caseFile) return [];

      const { data: groups } = await supabase
        .from('dt_evidence_groups')
        .select('id')
        .eq('case_file_id', caseFile.id);

      if (!groups || groups.length === 0) return [];

      const groupIds = groups.map(g => g.id);
      
      const { data, error } = await supabase
        .from('dt_evidences')
        .select('*')
        .in('evidence_group_id', groupIds)
        .eq('evidence_type', 'monthly_report')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(e => ({
        id: e.id,
        type: 'report' as const,
        title: `Informe Mensual - ${e.report_month || 'Sin fecha'}`,
        date: e.created_at,
        status: e.status as EvidenceItem['status'],
        sealed_pdf_path: e.sealed_pdf_path,
        tsp_timestamp: e.tsp_timestamp,
        description: `Informe de registro de jornada certificado con sello de tiempo cualificado`,
      }));
    },
    enabled: !!company?.id,
  });

  // Fetch legal reports (overtime, breaks, night_work)
  const { data: legalReports, isLoading: loadingLegalReports } = useQuery({
    queryKey: ['legal-reports', company?.id, selectedPeriod],
    queryFn: async () => {
      if (!company?.id) return [];
      
      const { data: caseFile } = await supabase
        .from('dt_case_files')
        .select('id')
        .eq('company_id', company.id)
        .maybeSingle();

      if (!caseFile) return [];

      const { data: groups } = await supabase
        .from('dt_evidence_groups')
        .select('id')
        .eq('case_file_id', caseFile.id);

      if (!groups || groups.length === 0) return [];

      const groupIds = groups.map(g => g.id);
      
      const { data, error } = await supabase
        .from('dt_evidences')
        .select('*')
        .in('evidence_group_id', groupIds)
        .in('evidence_type', ['overtime_report', 'breaks_report', 'night_work_report'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const getReportTypeLabel = (type: string) => {
        switch (type) {
          case 'overtime_report': return { label: 'Horas Extraordinarias', type: 'overtime' as const };
          case 'breaks_report': return { label: 'Pausas Intrajornada', type: 'breaks' as const };
          case 'night_work_report': return { label: 'Trabajo Nocturno', type: 'night_work' as const };
          default: return { label: 'Informe Legal', type: 'report' as const };
        }
      };

      return (data || []).map(e => {
        const { label, type } = getReportTypeLabel(e.evidence_type);
        return {
          id: e.id,
          type,
          title: `${label} - ${e.report_month || 'Sin fecha'}`,
          date: e.created_at,
          status: e.status as EvidenceItem['status'],
          sealed_pdf_path: e.sealed_pdf_path,
          tsp_timestamp: e.tsp_timestamp,
          description: `Informe de ${label.toLowerCase()} con sello QTSP`,
        };
      });
    },
    enabled: !!company?.id,
  });

  // Fetch sealed notifications
  const { data: sealedNotifications, isLoading: loadingNotifications } = useQuery({
    queryKey: ['sealed-notifications', company?.id, selectedPeriod],
    queryFn: async () => {
      if (!company?.id) return [];
      
      const { data, error } = await supabase
        .from('compliance_notifications')
        .select('*, compliance_violations(*), compliance_incidents(*)')
        .eq('company_id', company.id)
        .not('sent_at', 'is', null)
        .order('sent_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return (data || []).map(n => ({
        id: n.id,
        type: 'notification' as const,
        title: n.subject || n.notification_type,
        date: n.sent_at || n.created_at,
        status: n.sent_at ? 'completed' : (n.failed_at ? 'failed' : 'pending') as EvidenceItem['status'],
        description: `Notificación de ${n.notification_type} enviada por ${n.channel}`,
      }));
    },
    enabled: !!company?.id,
  });

  // Fetch download history
  const { data: downloadHistory, isLoading: loadingHistory } = useQuery({
    queryKey: ['certificate-downloads', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      
      const { data, error } = await supabase
        .from('certificate_downloads')
        .select('*')
        .eq('company_id', company.id)
        .order('downloaded_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return (data || []).map(d => ({
        id: d.id,
        downloaded_at: d.downloaded_at,
        downloaded_by: d.downloaded_by,
        download_type: d.download_type,
        document_title: d.document_title,
      }));
    },
    enabled: !!company?.id,
  });

  // Generate legal report mutation
  const generateReportMutation = useMutation({
    mutationFn: async ({ reportType, month }: { reportType: string; month: string }) => {
      if (!company?.id) throw new Error('No company');
      
      const { data, error } = await supabase.functions.invoke('generate-legal-reports', {
        body: {
          company_id: company.id,
          report_type: reportType,
          month,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Informe generado: ${data.report_title}`);
      queryClient.invalidateQueries({ queryKey: ['legal-reports'] });
      setGenerateDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Error al generar informe: ${error.message}`);
    },
  });

  // Request certificate mutation
  const requestCertificateMutation = useMutation({
    mutationFn: async (item: EvidenceItem) => {
      if (!company?.id) throw new Error('No company');
      
      const { data, error } = await supabase.functions.invoke('qtsp-notarize', {
        body: {
          action: item.type === 'report' ? 'request_report_certificate' : 'request_notification_certificate',
          company_id: company.id,
          evidence_id: item.id,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Certificado solicitado correctamente');
      queryClient.invalidateQueries({ queryKey: ['sealed-reports'] });
      queryClient.invalidateQueries({ queryKey: ['sealed-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['legal-reports'] });
      setRequestDialogOpen(false);
      setSelectedItem(null);
    },
    onError: (error: Error) => {
      toast.error(`Error al solicitar certificado: ${error.message}`);
    },
  });

  // Download sealed PDF and log it
  const downloadCertificate = async (item: EvidenceItem) => {
    if (!item.sealed_pdf_path || !company?.id || !user?.id) return;

    try {
      const { data, error } = await supabase.storage
        .from('sealed-reports')
        .download(item.sealed_pdf_path);
      
      if (error) throw error;

      // Log the download
      await supabase.from('certificate_downloads').insert({
        company_id: company.id,
        evidence_id: item.type !== 'notification' ? item.id : null,
        notification_id: item.type === 'notification' ? item.id : null,
        downloaded_by: user.id,
        download_type: item.type,
        document_title: item.title,
      });

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificado_${item.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Certificado descargado');
      queryClient.invalidateQueries({ queryKey: ['certificate-downloads'] });
    } catch (error) {
      console.error('Error downloading certificate:', error);
      toast.error('Error al descargar el certificado');
    }
  };

  const getStatusBadge = (status: EvidenceItem['status']) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Certificado</Badge>;
      case 'processing':
        return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Procesando</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pendiente</Badge>;
    }
  };

  const getTypeIcon = (type: EvidenceItem['type']) => {
    switch (type) {
      case 'overtime': return <Timer className="h-4 w-4 text-orange-500" />;
      case 'breaks': return <Coffee className="h-4 w-4 text-blue-500" />;
      case 'night_work': return <Moon className="h-4 w-4 text-purple-500" />;
      case 'notification': return <Bell className="h-4 w-4 text-muted-foreground" />;
      default: return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'overtime': return <Badge variant="outline" className="text-orange-600 border-orange-200">Horas Extra</Badge>;
      case 'breaks': return <Badge variant="outline" className="text-blue-600 border-blue-200">Pausas</Badge>;
      case 'night_work': return <Badge variant="outline" className="text-purple-600 border-purple-200">Nocturno</Badge>;
      case 'notification': return <Badge variant="outline" className="text-green-600 border-green-200">Notificación</Badge>;
      case 'report': return <Badge variant="outline" className="text-gray-600 border-gray-200">Informe</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  const openRequestDialog = (item: EvidenceItem) => {
    setSelectedItem(item);
    setRequestDialogOpen(true);
  };

  const renderTable = (items: EvidenceItem[] | undefined, showTypeColumn = false) => {
    if (!items || items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No hay documentos con evidencia QTSP</p>
          <p className="text-xs text-muted-foreground mt-2">
            Los certificados se generan automáticamente cuando se crean informes sellados
          </p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Documento</TableHead>
            {showTypeColumn && <TableHead>Tipo</TableHead>}
            <TableHead>Fecha</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Sello QTSP</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getTypeIcon(item.type)}
                  <div>
                    <p className="font-medium">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    )}
                  </div>
                </div>
              </TableCell>
              {showTypeColumn && (
                <TableCell>{getTypeBadge(item.type)}</TableCell>
              )}
              <TableCell>
                {format(new Date(item.date), 'dd/MM/yyyy HH:mm', { locale: es })}
              </TableCell>
              <TableCell>{getStatusBadge(item.status)}</TableCell>
              <TableCell>
                {item.tsp_timestamp ? (
                  <span className="text-xs text-muted-foreground font-mono">
                    {format(new Date(item.tsp_timestamp), 'dd/MM/yyyy HH:mm:ss')}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {item.status === 'completed' && item.sealed_pdf_path ? (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => downloadCertificate(item)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Descargar
                    </Button>
                  ) : item.status === 'pending' || item.status === 'failed' ? (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => openRequestDialog(item)}
                    >
                      <FileBadge className="h-4 w-4 mr-1" />
                      Solicitar certificado
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" disabled>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Procesando
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const completedReports = sealedReports?.filter(r => r.status === 'completed').length || 0;
  const completedLegalReports = legalReports?.filter(r => r.status === 'completed').length || 0;
  const completedNotifications = sealedNotifications?.filter(n => n.status === 'completed').length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Certificados QTSP</CardTitle>
                <CardDescription>
                  Solicita certificados de sello de tiempo cualificado para informes y notificaciones
                </CardDescription>
              </div>
            </div>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-center gap-4 rounded-lg border p-4">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{completedReports}</p>
                <p className="text-sm text-muted-foreground">Informes mensuales</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-lg border p-4">
              <Timer className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{completedLegalReports}</p>
                <p className="text-sm text-muted-foreground">Informes legales</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-lg border p-4">
              <Bell className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{completedNotifications}</p>
                <p className="text-sm text-muted-foreground">Notificaciones</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-lg border p-4">
              <History className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{downloadHistory?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Descargas</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Informes ({sealedReports?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="legal" className="flex items-center gap-2">
            <Timer className="w-4 h-4" />
            Legales ({legalReports?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notificaciones ({sealedNotifications?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informes Mensuales con Evidencia QTSP</CardTitle>
              <CardDescription>
                Informes mensuales de jornada sellados con sello de tiempo cualificado
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingReports ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                renderTable(sealedReports)
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="legal">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Informes Legales con Evidencia QTSP</CardTitle>
                  <CardDescription>
                    Informes de horas extraordinarias, pausas intrajornada y trabajo nocturno
                  </CardDescription>
                </div>
                <Button onClick={() => setGenerateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Generar informe
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingLegalReports ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                renderTable(legalReports, true)
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notificaciones de Cumplimiento con Evidencia QTSP</CardTitle>
              <CardDescription>
                Comunicaciones de cumplimiento (incidencias, violaciones) con registro cualificado
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingNotifications ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                renderTable(sealedNotifications)
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Historial de Descargas de Certificados</CardTitle>
              <CardDescription>
                Registro de auditoría de quién y cuándo accedió a cada certificado
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : downloadHistory && downloadHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Documento</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Fecha de descarga</TableHead>
                      <TableHead>Usuario</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {downloadHistory.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Download className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{record.document_title}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getTypeBadge(record.download_type)}</TableCell>
                        <TableCell>
                          {format(new Date(record.downloaded_at), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono text-muted-foreground">
                            {record.downloaded_by.substring(0, 8)}...
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <History className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No hay descargas registradas</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Request Certificate Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileBadge className="h-5 w-5" />
              Solicitar Certificado QTSP
            </DialogTitle>
            <DialogDescription>
              Se solicitará un certificado de sello de tiempo cualificado para este documento.
            </DialogDescription>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  {getTypeIcon(selectedItem.type)}
                  <span className="font-medium">{selectedItem.title}</span>
                </div>
                {selectedItem.description && (
                  <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Fecha: {format(new Date(selectedItem.date), 'dd/MM/yyyy HH:mm', { locale: es })}
                </p>
              </div>
              
              <div className="rounded-lg bg-muted p-4 text-sm">
                <p className="font-medium mb-2">¿Qué incluye el certificado?</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Sello de tiempo cualificado (eIDAS)</li>
                  <li>Hash criptográfico del documento</li>
                  <li>Identificador único del QTSP</li>
                  <li>Metadatos de la empresa y periodo</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => selectedItem && requestCertificateMutation.mutate(selectedItem)}
              disabled={requestCertificateMutation.isPending}
            >
              {requestCertificateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Solicitando...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Solicitar certificado
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Legal Report Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Generar Informe Legal
            </DialogTitle>
            <DialogDescription>
              Genera un informe legal con sellado QTSP automático.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de informe</label>
              <Select value={selectedReportType} onValueChange={(v: 'overtime' | 'breaks' | 'night_work') => setSelectedReportType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overtime">
                    <div className="flex items-center gap-2">
                      <Timer className="h-4 w-4 text-orange-500" />
                      Horas Extraordinarias (Art. 35 ET)
                    </div>
                  </SelectItem>
                  <SelectItem value="breaks">
                    <div className="flex items-center gap-2">
                      <Coffee className="h-4 w-4 text-blue-500" />
                      Pausas Intrajornada (Art. 34.4 ET)
                    </div>
                  </SelectItem>
                  <SelectItem value="night_work">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4 text-purple-500" />
                      Trabajo Nocturno (Art. 36 ET)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Periodo</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg bg-muted p-4 text-sm">
              <p className="font-medium mb-2">El informe incluirá:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                {selectedReportType === 'overtime' && (
                  <>
                    <li>Detalle de horas extraordinarias por empleado</li>
                    <li>Cálculo sobre jornada estándar de 8 horas</li>
                    <li>Referencia legal: Art. 35 Estatuto de los Trabajadores</li>
                  </>
                )}
                {selectedReportType === 'breaks' && (
                  <>
                    <li>Análisis de pausas intrajornada</li>
                    <li>Detección de jornadas sin pausa mínima de 15 min</li>
                    <li>Referencia legal: Art. 34.4 Estatuto de los Trabajadores</li>
                  </>
                )}
                {selectedReportType === 'night_work' && (
                  <>
                    <li>Horas trabajadas en periodo nocturno (22:00-06:00)</li>
                    <li>Detalle por empleado y día</li>
                    <li>Referencia legal: Art. 36 Estatuto de los Trabajadores</li>
                  </>
                )}
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => generateReportMutation.mutate({ 
                reportType: selectedReportType, 
                month: selectedPeriod 
              })}
              disabled={generateReportMutation.isPending}
            >
              {generateReportMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Generar con sellado QTSP
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
