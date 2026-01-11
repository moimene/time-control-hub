import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmployeeLayout } from "@/components/layout/EmployeeLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Shield,
  Eye,
  FileCheck
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { sanitizeHtml } from "@/lib/security";

export default function EmployeeLegalDocuments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [hasRead, setHasRead] = useState(false);

  // Get employee info
  const { data: employee } = useQuery({
    queryKey: ['employee-self', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('employees')
        .select('id, company_id, first_name, last_name')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch documents requiring acceptance
  const { data: documents, isLoading } = useQuery({
    queryKey: ['employee-legal-documents', employee?.company_id],
    queryFn: async () => {
      if (!employee?.company_id) return [];
      const { data, error } = await supabase
        .from('legal_documents')
        .select(`
          *,
          document_acknowledgments(
            id,
            acknowledged_at,
            tsp_token,
            signature_hash
          )
        `)
        .eq('company_id', employee.company_id)
        .eq('is_published', true)
        .order('code');
      if (error) throw error;
      
      // Filter acknowledgments to only include current employee's
      return data?.map(doc => ({
        ...doc,
        myAcknowledgment: doc.document_acknowledgments?.find(
          (ack: any) => true // We'll filter properly with employee_id check
        ) || null,
        document_acknowledgments: undefined
      })) || [];
    },
    enabled: !!employee?.company_id,
  });

  // Fetch my acknowledgments
  const { data: myAcknowledgments } = useQuery({
    queryKey: ['my-acknowledgments', employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];
      const { data, error } = await supabase
        .from('document_acknowledgments')
        .select('*')
        .eq('employee_id', employee.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!employee?.id,
  });

  // Accept document mutation
  const acceptMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const { data, error } = await supabase.functions.invoke('acknowledge-document', {
        body: { document_id: documentId }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success('Documento aceptado correctamente', {
        description: `Hash de firma: ${data.acknowledgment.signature_hash.substring(0, 16)}...`
      });
      queryClient.invalidateQueries({ queryKey: ['employee-legal-documents'] });
      queryClient.invalidateQueries({ queryKey: ['my-acknowledgments'] });
      setAcceptDialogOpen(false);
      setSelectedDocument(null);
      setHasRead(false);
    },
    onError: (error: any) => {
      toast.error('Error al aceptar el documento', {
        description: error.message
      });
    },
  });

  const isAcknowledged = (docId: string) => {
    return myAcknowledgments?.some(ack => ack.document_id === docId);
  };

  const getAcknowledgment = (docId: string) => {
    return myAcknowledgments?.find(ack => ack.document_id === docId);
  };

  const pendingDocs = documents?.filter(doc => !isAcknowledged(doc.id)) || [];
  const acceptedDocs = documents?.filter(doc => isAcknowledged(doc.id)) || [];

  const openAcceptDialog = (doc: any) => {
    setSelectedDocument(doc);
    setHasRead(false);
    setAcceptDialogOpen(true);
  };

  return (
    <EmployeeLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Normativa y Cumplimiento</h1>
          <p className="text-muted-foreground">
            Revisa y acepta los documentos requeridos por la empresa
          </p>
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingDocs.length}</div>
              <p className="text-xs text-muted-foreground">requieren tu aceptación</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aceptados</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{acceptedDocs.length}</div>
              <p className="text-xs text-muted-foreground">documentos firmados</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{documents?.length || 0}</div>
              <p className="text-xs text-muted-foreground">documentos publicados</p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Documents */}
        {pendingDocs.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Documentos Pendientes de Aceptación
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {pendingDocs.map(doc => (
                <Card key={doc.id} className="border-amber-200 bg-amber-50/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <Badge variant="outline" className="text-xs mb-1">
                          {doc.code}
                        </Badge>
                        <CardTitle className="text-base">{doc.name}</CardTitle>
                      </div>
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                        <Clock className="h-3 w-3 mr-1" />
                        Pendiente
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Este documento requiere tu revisión y aceptación.
                    </p>
                    <Button onClick={() => openAcceptDialog(doc)} className="w-full">
                      <Eye className="h-4 w-4 mr-2" />
                      Revisar y Aceptar
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Accepted Documents */}
        {acceptedDocs.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Documentos Aceptados
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {acceptedDocs.map(doc => {
                const ack = getAcknowledgment(doc.id);
                return (
                  <Card key={doc.id} className="border-green-200 bg-green-50/50">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <Badge variant="outline" className="text-xs mb-1">
                            {doc.code}
                          </Badge>
                          <CardTitle className="text-base">{doc.name}</CardTitle>
                        </div>
                        <Badge className="bg-green-600">
                          <FileCheck className="h-3 w-3 mr-1" />
                          Aceptado
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {ack && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>
                            <strong>Fecha:</strong>{' '}
                            {format(new Date(ack.acknowledged_at), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
                          </p>
                          <p className="font-mono text-[10px] break-all">
                            <strong>Hash:</strong> {ack.signature_hash}
                          </p>
                          {ack.tsp_token && (
                            <div className="flex items-center gap-1 text-green-600">
                              <Shield className="h-3 w-3" />
                              <span>Sellado con QTSP</span>
                            </div>
                          )}
                        </div>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedDocument(doc);
                          setAcceptDialogOpen(true);
                        }}
                        className="w-full mt-2"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Ver Documento
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* No documents */}
        {documents?.length === 0 && !isLoading && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No hay documentos disponibles</h3>
              <p className="text-muted-foreground">
                Tu empresa aún no ha publicado documentos legales.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Accept/View Dialog */}
        <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedDocument?.code}: {selectedDocument?.name}
              </DialogTitle>
              <DialogDescription>
                {isAcknowledged(selectedDocument?.id)
                  ? 'Documento aceptado'
                  : 'Lee el documento completo antes de aceptar'
                }
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="h-[50vh] border rounded-md p-4 bg-muted/30">
              <div className="prose prose-sm max-w-none">
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: sanitizeHtml(selectedDocument?.content_markdown
                      ?.replace(/\n/g, '<br>')
                      .replace(/#{1,6}\s(.+)/g, '<strong>$1</strong>')
                      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                      || '')
                  }} 
                />
              </div>
            </ScrollArea>

            {!isAcknowledged(selectedDocument?.id) && (
              <>
                <Separator />
                <div className="flex items-start space-x-3 py-2">
                  <Checkbox
                    id="accept-terms"
                    checked={hasRead}
                    onCheckedChange={(checked) => setHasRead(checked as boolean)}
                  />
                  <label
                    htmlFor="accept-terms"
                    className="text-sm leading-tight cursor-pointer"
                  >
                    He leído y comprendido el contenido de este documento y acepto sus términos.
                  </label>
                </div>
              </>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setAcceptDialogOpen(false);
                setSelectedDocument(null);
                setHasRead(false);
              }}>
                Cerrar
              </Button>
              {!isAcknowledged(selectedDocument?.id) && (
                <Button
                  onClick={() => acceptMutation.mutate(selectedDocument?.id)}
                  disabled={!hasRead || acceptMutation.isPending}
                >
                  {acceptMutation.isPending ? (
                    'Procesando...'
                  ) : (
                    <>
                      <FileCheck className="h-4 w-4 mr-2" />
                      Acepto los términos
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </EmployeeLayout>
  );
}
