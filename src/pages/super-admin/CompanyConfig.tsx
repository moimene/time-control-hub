import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, Building2, Users, Calendar, Clock, FileText, 
  Bell, Settings, Scale, Database,
  AlertTriangle, CheckCircle, Loader2
} from "lucide-react";

// Import settings sections (reuse from admin Settings)
import { CalendarLaboralSection } from "@/components/settings/CalendarLaboralSection";
import { NotificationSettings } from "@/components/admin/NotificationSettings";
import { MarcoNormativoSection } from "@/components/settings/MarcoNormativoSection";
import { DataRetentionSection } from "@/components/settings/DataRetentionSection";
import { LegalDocumentsSection } from "@/components/settings/LegalDocumentsSection";
import { CoverageRulesEditor } from "@/components/settings/CoverageRulesEditor";
import { NationalHolidaysManager } from "@/components/admin/NationalHolidaysManager";
import { AbsenceTypesCatalog } from "@/components/admin/AbsenceTypesCatalog";

// Company override provider
import { CompanyOverrideProvider } from "@/hooks/useCompany";
import type { Company } from "@/types/database";

export default function SuperAdminCompanyConfig() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch company details
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ['super-admin-company-detail', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from('company')
        .select('*')
        .eq('id', companyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Fetch employee count
  const { data: employeeStats } = useQuery({
    queryKey: ['super-admin-company-employees', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from('employees')
        .select('id, status')
        .eq('company_id', companyId);
      if (error) throw error;
      return {
        total: data.length,
        active: data.filter(e => e.status === 'active').length,
      };
    },
    enabled: !!companyId,
  });

  // Fetch configuration status
  const { data: configStatus } = useQuery({
    queryKey: ['super-admin-company-config-status', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      // Check for various configurations
      const [
        { count: absenceTypesCount },
        { count: calendarCount },
        { count: templatesCount },
        { count: coverageRulesCount },
        { count: retentionConfigCount },
        { count: notificationSettingsCount },
      ] = await Promise.all([
        supabase.from('absence_types').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('labor_calendars').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('rule_sets').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('coverage_rules').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('data_retention_config').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('company_settings').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
      ]);

      return {
        absenceTypes: (absenceTypesCount || 0) > 0,
        calendar: (calendarCount || 0) > 0,
        templates: (templatesCount || 0) > 0,
        coverageRules: (coverageRulesCount || 0) > 0,
        retentionConfig: (retentionConfigCount || 0) > 0,
        notificationSettings: (notificationSettingsCount || 0) > 0,
      };
    },
    enabled: !!companyId,
  });

  if (companyLoading) {
    return (
      <SuperAdminLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </SuperAdminLayout>
    );
  }

  if (!company) {
    return (
      <SuperAdminLayout>
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Empresa no encontrada</h2>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/super-admin/companies')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a empresas
          </Button>
        </div>
      </SuperAdminLayout>
    );
  }

  const ConfigStatusBadge = ({ configured }: { configured: boolean }) => (
    configured ? (
      <Badge variant="default" className="bg-green-500">
        <CheckCircle className="h-3 w-3 mr-1" />
        Configurado
      </Badge>
    ) : (
      <Badge variant="outline" className="text-amber-600 border-amber-300">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Pendiente
      </Badge>
    )
  );

  return (
    <CompanyOverrideProvider companyId={companyId!} company={company as Company}>
      <SuperAdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/super-admin/companies')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <Building2 className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">{company.name}</h1>
                <Badge variant="outline">{company.cif || 'Sin CIF'}</Badge>
              </div>
              <p className="text-muted-foreground">
                Configuración integral de la empresa
              </p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {employeeStats?.active || 0} / {employeeStats?.total || 0} empleados
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
              <TabsTrigger value="overview">Resumen</TabsTrigger>
              <TabsTrigger value="calendar">Calendario</TabsTrigger>
              <TabsTrigger value="absences">Ausencias</TabsTrigger>
              <TabsTrigger value="templates">Normativa</TabsTrigger>
              <TabsTrigger value="coverage">Cobertura</TabsTrigger>
              <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
              <TabsTrigger value="legal">Documentos</TabsTrigger>
              <TabsTrigger value="retention">Retención</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Company Info Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Datos de Empresa
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div><strong>Nombre:</strong> {company.name}</div>
                    <div><strong>CIF:</strong> {company.cif || '-'}</div>
                    <div><strong>Dirección:</strong> {company.address || '-'}</div>
                    <div><strong>Ciudad:</strong> {company.city || '-'}</div>
                    <div><strong>CP:</strong> {company.postal_code || '-'}</div>
                    <div><strong>Zona horaria:</strong> {company.timezone}</div>
                  </CardContent>
                </Card>

                {/* Configuration Status Card */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Estado de Configuración
                    </CardTitle>
                    <CardDescription>
                      Revisa qué secciones están configuradas para esta empresa
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div 
                        className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                        onClick={() => setActiveTab('calendar')}
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>Calendario Laboral</span>
                        </div>
                        <ConfigStatusBadge configured={configStatus?.calendar || false} />
                      </div>
                      <div 
                        className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                        onClick={() => setActiveTab('absences')}
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>Tipos de Ausencia</span>
                        </div>
                        <ConfigStatusBadge configured={configStatus?.absenceTypes || false} />
                      </div>
                      <div 
                        className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                        onClick={() => setActiveTab('templates')}
                      >
                        <div className="flex items-center gap-2">
                          <Scale className="h-4 w-4 text-muted-foreground" />
                          <span>Marco Normativo</span>
                        </div>
                        <ConfigStatusBadge configured={configStatus?.templates || false} />
                      </div>
                      <div 
                        className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                        onClick={() => setActiveTab('coverage')}
                      >
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>Reglas Cobertura</span>
                        </div>
                        <ConfigStatusBadge configured={configStatus?.coverageRules || false} />
                      </div>
                      <div 
                        className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                        onClick={() => setActiveTab('notifications')}
                      >
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4 text-muted-foreground" />
                          <span>Notificaciones</span>
                        </div>
                        <ConfigStatusBadge configured={configStatus?.notificationSettings || false} />
                      </div>
                      <div 
                        className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                        onClick={() => setActiveTab('retention')}
                      >
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-muted-foreground" />
                          <span>Retención Datos</span>
                        </div>
                        <ConfigStatusBadge configured={configStatus?.retentionConfig || false} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Acciones Rápidas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setActiveTab('calendar')}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Configurar Calendario
                    </Button>
                    <Button variant="outline" onClick={() => setActiveTab('absences')}>
                      <Clock className="h-4 w-4 mr-2" />
                      Gestionar Ausencias
                    </Button>
                    <Button variant="outline" onClick={() => setActiveTab('templates')}>
                      <Scale className="h-4 w-4 mr-2" />
                      Marco Normativo
                    </Button>
                    <Button variant="outline" onClick={() => setActiveTab('legal')}>
                      <FileText className="h-4 w-4 mr-2" />
                      Documentos Legales
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Calendar Tab */}
            <TabsContent value="calendar" className="space-y-6">
              <NationalHolidaysManager />
              <CalendarLaboralSection />
            </TabsContent>

            {/* Absences Tab */}
            <TabsContent value="absences">
              <AbsenceTypesCatalog />
            </TabsContent>

            {/* Templates Tab */}
            <TabsContent value="templates">
              <MarcoNormativoSection />
            </TabsContent>

            {/* Coverage Tab */}
            <TabsContent value="coverage">
              <CoverageRulesEditor />
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications">
              <NotificationSettings />
            </TabsContent>

            {/* Legal Documents Tab */}
            <TabsContent value="legal">
              <LegalDocumentsSection />
            </TabsContent>

            {/* Data Retention Tab */}
            <TabsContent value="retention">
              <DataRetentionSection />
            </TabsContent>
          </Tabs>
        </div>
      </SuperAdminLayout>
    </CompanyOverrideProvider>
  );
}
