import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
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
  RefreshCw
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

interface CertificateRequestPanelProps {
  defaultTab?: "reports" | "notifications";
}

interface EvidenceItem {
  id: string;
  type: "report" | "notification";
  title: string;
  date: string;
  status: "completed" | "pending" | "processing" | "failed";
  sealed_pdf_path?: string | null;
  tsp_timestamp?: string | null;
  description?: string;
}

export function CertificateRequestPanel({ defaultTab = "reports" }: CertificateRequestPanelProps) {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState(() => format(new Date(), 'yyyy-MM'));
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EvidenceItem | null>(null);

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
      
      // Get evidence groups for this company
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

  // Fetch sealed notifications (from compliance_notifications with evidence)
  const { data: sealedNotifications, isLoading: loadingNotifications } = useQuery({
    queryKey: ['sealed-notifications', company?.id, selectedPeriod],
    queryFn: async () => {
      if (!company?.id) return [];
      
      // Get notifications that have been sent (they are evidence of communication)
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
      setRequestDialogOpen(false);
      setSelectedItem(null);
    },
    onError: (error: Error) => {
      toast.error(`Error al solicitar certificado: ${error.message}`);
    },
  });

  // Download sealed PDF
  const downloadCertificate = async (path: string, filename: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('sealed-reports')
        .download(path);
      
      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Certificado descargado');
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

  const openRequestDialog = (item: EvidenceItem) => {
    setSelectedItem(item);
    setRequestDialogOpen(true);
  };

  const renderTable = (items: EvidenceItem[] | undefined, type: "reports" | "notifications") => {
    if (!items || items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          {type === "reports" ? (
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          ) : (
            <Bell className="h-12 w-12 text-muted-foreground mb-4" />
          )}
          <p className="text-muted-foreground">
            No hay {type === "reports" ? "informes" : "notificaciones"} con evidencia QTSP
          </p>
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
                  {type === "reports" ? (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Bell className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    )}
                  </div>
                </div>
              </TableCell>
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
                      onClick={() => downloadCertificate(item.sealed_pdf_path!, `certificado_${item.id}.pdf`)}
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
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-4 rounded-lg border p-4">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{completedReports}</p>
                <p className="text-sm text-muted-foreground">Informes certificados</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-lg border p-4">
              <Bell className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{completedNotifications}</p>
                <p className="text-sm text-muted-foreground">Notificaciones certificadas</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for reports and notifications */}
      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Informes ({sealedReports?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notificaciones ({sealedNotifications?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informes con Evidencia QTSP</CardTitle>
              <CardDescription>
                Informes mensuales de jornada sellados con sello de tiempo cualificado para presentación a terceros
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingReports ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                renderTable(sealedReports, "reports")
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notificaciones con Evidencia QTSP</CardTitle>
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
                renderTable(sealedNotifications, "notifications")
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
              El certificado tendrá validez legal para presentación ante terceros.
            </DialogDescription>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  {selectedItem.type === 'report' ? (
                    <FileText className="h-5 w-5 text-primary" />
                  ) : (
                    <Bell className="h-5 w-5 text-primary" />
                  )}
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
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Shield className="h-4 w-4 mr-2" />
              )}
              Solicitar Certificado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
