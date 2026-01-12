import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Check, RefreshCw, Users, Building2, Shield, Key } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

type AppRole = 'super_admin' | 'admin' | 'responsible' | 'employee' | 'asesor';

interface UserWithRole {
  user_id: string;
  role: AppRole;
  email: string | null;
  company_id: string | null;
  company_name: string | null;
  employee_code: string | null;
  employee_name: string | null;
  pin: string | null;
}

const passwordMap: Record<string, string> = {
  'admin@test.com': 'admin123',
  'superadmin@timecontrol.com': 'super123',
  'moises.menendez@icam.es': 'icam2024',
  'responsable@test.com': 'resp123',
  // Bar El Rincón
  'admin@elrincon.com': 'bar123',
  'responsable@elrincon.com': 'resp123',
  'juan.martinez@elrincon.com': 'emp123',
  'ana.lopez@elrincon.com': 'emp123',
  'pedro.sanchez@elrincon.com': 'emp123',
  'maria.garcia@elrincon.com': 'emp123',
  'carlos.fernandez@elrincon.com': 'emp123',
  // Zapatería López
  'admin@zapateria-lopez.com': 'zap123',
  'responsable@zapateria-lopez.com': 'resp123',
  'lucia.moreno@zapateria-lopez.com': 'emp123',
  'miguel.torres@zapateria-lopez.com': 'emp123',
  'carmen.jimenez@zapateria-lopez.com': 'emp123',
  'antonio.ruiz@zapateria-lopez.com': 'emp123',
  // Clínica Dental Sonrisas
  'admin@dentalsonrisas.com': 'den123',
  'responsable@dentalsonrisas.com': 'resp123',
  'alberto.ruiz@dentalsonrisas.com': 'emp123',
  'elena.morales@dentalsonrisas.com': 'emp123',
  'raul.diaz@dentalsonrisas.com': 'emp123',
  'laura.navarro@dentalsonrisas.com': 'emp123',
  'sergio.castro@dentalsonrisas.com': 'emp123',
  // Fisioterapia Wellness
  'admin@fisio-wellness.com': 'fis123',
  'responsable@fisio-wellness.com': 'resp123',
  'david.molina@fisio-wellness.com': 'emp123',
  'patricia.vega@fisio-wellness.com': 'emp123',
  'jorge.ramos@fisio-wellness.com': 'emp123',
  'isabel.ortiz@fisio-wellness.com': 'emp123',
};

// Known PINs from seeding scripts
const pinMap: Record<string, string> = {
  'BAR001': '1234', 'BAR002': '2345', 'BAR003': '3456', 'BAR004': '4567', 'BAR005': '5678',
  'ZAP001': '1111', 'ZAP002': '2222', 'ZAP003': '3333', 'ZAP004': '4444',
  'DEN001': '1212', 'DEN002': '2323', 'DEN003': '3434', 'DEN004': '4545', 'DEN005': '5656',
  'FIS001': '6666', 'FIS002': '7777', 'FIS003': '8888', 'FIS004': '9999',
  'EMP001': '1234', 'EMP002': '2345', 'EMP003': '3456',
};

const TestCredentials = () => {
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  // Fetch all user roles with email
  const { data: userRoles, isLoading: loadingRoles, refetch: refetchRoles } = useQuery({
    queryKey: ['test-credentials-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (error) throw error;
      return data;
    }
  });

  // Fetch user companies
  const { data: userCompanies, isLoading: loadingCompanies } = useQuery({
    queryKey: ['test-credentials-user-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_company')
        .select('user_id, company_id, company:company_id(id, name)');
      if (error) throw error;
      return data;
    }
  });

  // Fetch all companies
  const { data: companies } = useQuery({
    queryKey: ['test-credentials-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company')
        .select('id, name, cif, timezone, sector, employee_code_prefix')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch employees with user_id linked
  const { data: employees, isLoading: loadingEmployees } = useQuery({
    queryKey: ['test-credentials-employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, user_id, company_id, employee_code, first_name, last_name, email, pin_hash')
        .order('employee_code');
      if (error) throw error;
      return data;
    }
  });

  const isLoading = loadingRoles || loadingCompanies || loadingEmployees;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(label);
      toast.success(`${label} copiado`);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  const renderCopyButton = (text: string, label: string) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => copyToClipboard(text, label)}
      className="h-6 w-6 p-0"
    >
      {copiedItem === label ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  );

  // Build user lookup maps
  const getCompanyForUser = (userId: string) => {
    const uc = userCompanies?.find(u => u.user_id === userId);
    return uc?.company as { id: string; name: string } | null;
  };

  const getEmployeeForUser = (userId: string) => {
    return employees?.find(e => e.user_id === userId);
  };

  const getEmailForUser = (userId: string) => {
    const emp = employees?.find(e => e.user_id === userId);
    return emp?.email || null;
  };

  // Filter users by role
  const superAdmins = userRoles?.filter(u => u.role === 'super_admin') || [];
  const admins = userRoles?.filter(u => u.role === 'admin') || [];
  const responsables = userRoles?.filter(u => u.role === 'responsible') || [];
  const employeeUsers = userRoles?.filter(u => u.role === 'employee') || [];
  const asesores = userRoles?.filter(u => u.role === 'asesor') || [];

  // Employees with PIN (for kiosk)
  const employeesWithPin = employees?.filter(e => e.pin_hash) || [];

  const getRoleBadge = (role: AppRole) => {
    const variants: Record<AppRole, { variant: "default" | "destructive" | "outline" | "secondary"; label: string }> = {
      super_admin: { variant: "destructive", label: "Super Admin" },
      admin: { variant: "default", label: "Admin" },
      responsible: { variant: "secondary", label: "Responsable" },
      employee: { variant: "outline", label: "Empleado" },
      asesor: { variant: "secondary", label: "Asesor" },
    };
    const config = variants[role] || { variant: "outline", label: role };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const renderUserTable = (
    users: typeof userRoles,
    showCompany = true,
    showEmployeeCode = false
  ) => {
    if (isLoading) {
      return (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      );
    }

    if (!users?.length) {
      return <p className="text-muted-foreground text-sm">No hay usuarios de este tipo</p>;
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Password</TableHead>
            {showCompany && <TableHead>Empresa</TableHead>}
            {showEmployeeCode && <TableHead>Código</TableHead>}
            <TableHead>URL</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user, idx) => {
            const company = getCompanyForUser(user.user_id);
            const employee = getEmployeeForUser(user.user_id);
            const email = employee?.email || getEmailForUser(user.user_id) || `user-${user.user_id.slice(0, 8)}`;
            const password = passwordMap[email] || 'emp123';
            const url = user.role === 'super_admin' ? '/super-admin' : 
                       user.role === 'employee' ? '/employee' : '/admin';

            return (
              <TableRow key={`${user.user_id}-${idx}`}>
                <TableCell className="font-mono text-sm">{email}</TableCell>
                <TableCell className="font-mono text-sm">{password}</TableCell>
                {showCompany && (
                  <TableCell>
                    {company ? (
                      <Badge variant="secondary">{company.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                )}
                {showEmployeeCode && (
                  <TableCell className="font-mono font-bold">
                    {employee?.employee_code || '-'}
                  </TableCell>
                )}
                <TableCell>
                  <Badge variant="outline">{url}</Badge>
                </TableCell>
                <TableCell>
                  {renderCopyButton(email, `email-${user.user_id}`)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  const renderKioskTable = () => {
    if (isLoading) {
      return (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      );
    }

    // Group by company
    const byCompany = new Map<string, typeof employeesWithPin>();
    employeesWithPin.forEach(emp => {
      const companyName = companies?.find(c => c.id === emp.company_id)?.name || 'Sin empresa';
      if (!byCompany.has(companyName)) {
        byCompany.set(companyName, []);
      }
      byCompany.get(companyName)!.push(emp);
    });

    return (
      <div className="space-y-6">
        {Array.from(byCompany.entries()).map(([companyName, emps]) => (
          <div key={companyName}>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {companyName}
            </h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>PIN</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emps.map(emp => {
                  const pin = pinMap[emp.employee_code] || '????';
                  return (
                    <TableRow key={emp.id}>
                      <TableCell className="font-mono font-bold">{emp.employee_code}</TableCell>
                      <TableCell className="font-mono font-bold">{pin}</TableCell>
                      <TableCell>{emp.first_name} {emp.last_name}</TableCell>
                      <TableCell>
                        {renderCopyButton(`${emp.employee_code}:${pin}`, `kiosk-${emp.employee_code}`)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8" />
              Credenciales de Prueba
            </h1>
            <p className="text-muted-foreground mt-1">
              Datos de acceso reales para testing del Plan de Pruebas V1
            </p>
          </div>
          <Button onClick={() => refetchRoles()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-2xl font-bold">{superAdmins.length}</p>
                  <p className="text-xs text-muted-foreground">Super Admins</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{admins.length}</p>
                  <p className="text-xs text-muted-foreground">Admins</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-secondary-foreground" />
                <div>
                  <p className="text-2xl font-bold">{responsables.length}</p>
                  <p className="text-xs text-muted-foreground">Responsables</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <div>
                  <p className="text-2xl font-bold">{employeeUsers.length}</p>
                  <p className="text-xs text-muted-foreground">Empleados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold">{employeesWithPin.length}</p>
                  <p className="text-xs text-muted-foreground">PINs Kiosk</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="superadmin">Super Admin</TabsTrigger>
            <TabsTrigger value="admin">Admin</TabsTrigger>
            <TabsTrigger value="responsible">Responsable</TabsTrigger>
            <TabsTrigger value="employee">Empleado</TabsTrigger>
            <TabsTrigger value="asesor">Asesor</TabsTrigger>
            <TabsTrigger value="kiosk">Kiosk</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Todos los Usuarios de Test
                  <Badge variant="secondary">{userRoles?.length || 0} usuarios</Badge>
                </CardTitle>
                <CardDescription>
                  Tabla consolidada de todos los usuarios del sistema ordenados por rol
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rol</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Password</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>URL</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...superAdmins, ...admins, ...asesores, ...responsables, ...employeeUsers].map((user, idx) => {
                        const company = getCompanyForUser(user.user_id);
                        const employee = getEmployeeForUser(user.user_id);
                        const email = employee?.email || getEmailForUser(user.user_id) || `user-${user.user_id.slice(0, 8)}`;
                        const password = passwordMap[email] || 'emp123';
                        const url = user.role === 'super_admin' ? '/super-admin' : 
                                   user.role === 'employee' ? '/employee' : '/admin';

                        return (
                          <TableRow key={`all-${user.user_id}-${idx}`}>
                            <TableCell>{getRoleBadge(user.role as AppRole)}</TableCell>
                            <TableCell className="font-mono text-sm">{email}</TableCell>
                            <TableCell className="font-mono text-sm">{password}</TableCell>
                            <TableCell>
                              {company ? (
                                <Badge variant="outline" className="text-xs">{company.name}</Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell className="font-mono font-bold text-xs">
                              {employee?.employee_code || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">{url}</Badge>
                            </TableCell>
                            <TableCell>
                              {renderCopyButton(`${email}`, `all-email-${user.user_id}`)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="superadmin" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Super Administrador
                  <Badge variant="destructive">Acceso Total</Badge>
                </CardTitle>
                <CardDescription>
                  Gestión de todas las empresas y usuarios del sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderUserTable(superAdmins, false)}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admin" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Administradores de Empresa
                  <Badge>Gestión Completa</Badge>
                </CardTitle>
                <CardDescription>
                  Un administrador por cada empresa de prueba
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderUserTable(admins, true)}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="responsible" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Responsables
                  <Badge variant="secondary">Supervisión</Badge>
                </CardTitle>
                <CardDescription>
                  Pueden ver fichajes y aprobar/rechazar correcciones
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderUserTable(responsables, true)}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="employee" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Empleados con Portal
                  <Badge variant="outline">Acceso Personal</Badge>
                </CardTitle>
                <CardDescription>
                  Pueden ver sus fichajes y solicitar correcciones
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderUserTable(employeeUsers, true, true)}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="asesor" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Asesores Laborales
                  <Badge variant="secondary">Consultoría</Badge>
                </CardTitle>
                <CardDescription>
                  Acceso de solo lectura a múltiples empresas asignadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {asesores.length > 0 ? (
                  renderUserTable(asesores, true)
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No hay asesores configurados.</p>
                    <p className="text-sm mt-1">
                      Ejecutar <code className="bg-muted px-1 rounded">seed-v1-fixtures</code> para crear usuarios de prueba.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="kiosk" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Kiosk - Fichaje por PIN
                  <Badge variant="outline">/kiosk</Badge>
                </CardTitle>
                <CardDescription>
                  Códigos de empleado y PINs para fichaje en terminal
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderKioskTable()}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Companies table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Empresas Disponibles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>CIF</TableHead>
                  <TableHead>Prefijo</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>Timezone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies?.map(company => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell className="font-mono text-sm">{company.cif || '-'}</TableCell>
                    <TableCell className="font-mono">{company.employee_code_prefix}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{company.sector || '-'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{company.timezone}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* User Stories Card */}
        <Card>
          <CardHeader>
            <CardTitle>Ciclos de Prueba V1 Cubiertos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
                <h4 className="font-semibold mb-2">Ciclo 0-1: Auth + RLS</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>✅ Login/logout por rol</li>
                  <li>✅ Aislamiento multi-tenant</li>
                  <li>✅ Políticas RLS estrictas</li>
                  <li>✅ Rol asesor implementado</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Ciclo 3-4: Kiosk</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>✅ Fichaje PIN/QR</li>
                  <li>✅ Bloqueo intentos fallidos</li>
                  <li>✅ Terminal autorizado</li>
                  <li>✅ Modo offline</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Ciclo 6-8: Compliance</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>✅ Correcciones workflow</li>
                  <li>✅ Detección inconsistencias</li>
                  <li>✅ Motor cumplimiento dinámico</li>
                  <li>✅ Precedencia reglas (Ley→Convenio→Contrato)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Ciclo 9-11: QTSP</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>✅ Evidencias selladas</li>
                  <li>✅ Daily roots</li>
                  <li>✅ Paquete ITSS</li>
                  <li>✅ Retención 4 años</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TestCredentials;
