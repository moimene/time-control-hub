import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Search, Shield, Building2, Edit, Trash2, Loader2, Key, Copy, Check, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

type AppRole = 'super_admin' | 'admin' | 'responsible' | 'employee';

export default function SuperAdminUsers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [editingRole, setEditingRole] = useState<{ userId: string; currentRole: AppRole } | null>(null);
  const [newRole, setNewRole] = useState<AppRole>('employee');
  const [resetPasswordUser, setResetPasswordUser] = useState<{ userId: string; email: string } | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  // Get all user roles with user_company for company association
  const { data: userRoles, isLoading } = useQuery({
    queryKey: ['super-admin-user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Get user-company associations
  const { data: userCompanies } = useQuery({
    queryKey: ['super-admin-user-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_company')
        .select('user_id, company_id');
      if (error) throw error;
      
      const map: Record<string, string> = {};
      data.forEach((uc) => {
        map[uc.user_id] = uc.company_id;
      });
      return map;
    },
  });

  // Get employee info for email lookup
  const { data: employees } = useQuery({
    queryKey: ['super-admin-employees-info'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('user_id, email, first_name, last_name, company_id');
      if (error) throw error;
      
      const map: Record<string, any> = {};
      data.forEach((emp) => {
        if (emp.user_id) {
          map[emp.user_id] = emp;
        }
      });
      return map;
    },
  });

  // Get all companies for filter and display
  const { data: companies } = useQuery({
    queryKey: ['super-admin-companies-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Rol actualizado correctamente');
      queryClient.invalidateQueries({ queryKey: ['super-admin-user-roles'] });
      setEditingRole(null);
    },
    onError: (error: Error) => {
      toast.error(`Error al actualizar rol: ${error.message}`);
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Usuario eliminado del sistema');
      queryClient.invalidateQueries({ queryKey: ['super-admin-user-roles'] });
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar: ${error.message}`);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('admin-password-reset', {
        body: { user_id: userId }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setGeneratedPassword(data.tempPassword);
      toast.success('Contraseña reseteada correctamente');
    },
    onError: (error: Error) => {
      toast.error(`Error al resetear contraseña: ${error.message}`);
    },
  });

  const getRoleBadge = (role: AppRole) => {
    switch (role) {
      case 'super_admin':
        return <Badge variant="destructive" className="gap-1"><Shield className="w-3 h-3" />Super Admin</Badge>;
      case 'admin':
        return <Badge variant="default" className="gap-1">Admin</Badge>;
      case 'responsible':
        return <Badge variant="secondary" className="gap-1">Responsable</Badge>;
      case 'employee':
        return <Badge variant="outline" className="gap-1">Empleado</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const getCompanyName = (userId: string) => {
    // First check user_company
    const companyId = userCompanies?.[userId];
    if (companyId) {
      return companies?.find(c => c.id === companyId)?.name || 'Desconocida';
    }
    // Then check employee
    const employee = employees?.[userId];
    if (employee?.company_id) {
      return companies?.find(c => c.id === employee.company_id)?.name || 'Desconocida';
    }
    return '-';
  };

  const getUserEmail = (userId: string) => {
    const employee = employees?.[userId];
    return employee?.email || userId.substring(0, 8) + '...';
  };

  const getUserName = (userId: string) => {
    const employee = employees?.[userId];
    if (employee?.first_name || employee?.last_name) {
      return `${employee.first_name || ''} ${employee.last_name || ''}`.trim();
    }
    return '-';
  };

  const handleResetPasswordClick = (userId: string) => {
    const email = getUserEmail(userId);
    setResetPasswordUser({ userId, email });
    setGeneratedPassword(null);
    setShowPassword(false);
    setCopied(false);
  };

  const copyCredentials = () => {
    if (generatedPassword && resetPasswordUser) {
      navigator.clipboard.writeText(
        `Email: ${resetPasswordUser.email}\nContraseña: ${generatedPassword}`
      );
      setCopied(true);
      toast.success('Credenciales copiadas al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const filteredUsers = userRoles?.filter((ur) => {
    // Role filter
    if (roleFilter !== 'all' && ur.role !== roleFilter) return false;
    
    // Company filter
    if (companyFilter !== 'all') {
      const companyId = userCompanies?.[ur.user_id] || employees?.[ur.user_id]?.company_id;
      if (companyId !== companyFilter) return false;
    }
    
    // Search filter
    if (search) {
      const email = getUserEmail(ur.user_id).toLowerCase();
      const name = getUserName(ur.user_id).toLowerCase();
      const searchLower = search.toLowerCase();
      if (!email.includes(searchLower) && !name.includes(searchLower)) return false;
    }
    
    return true;
  });

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            Gestión de Usuarios
          </h1>
          <p className="text-muted-foreground">
            Administra usuarios, roles y contraseñas de todas las empresas
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por email o nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los roles</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="responsible">Responsable</SelectItem>
              <SelectItem value="employee">Empleado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las empresas</SelectItem>
              {companies?.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Usuarios ({filteredUsers?.length || 0})</CardTitle>
            <CardDescription>
              Lista de todos los usuarios registrados en la plataforma
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers?.map((ur) => (
                    <TableRow key={ur.id}>
                      <TableCell className="font-medium">
                        {getUserName(ur.user_id)}
                      </TableCell>
                      <TableCell>{getUserEmail(ur.user_id)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {getCompanyName(ur.user_id)}
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(ur.role as AppRole)}</TableCell>
                      <TableCell>
                        {format(new Date(ur.created_at), 'dd/MM/yyyy', { locale: es })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {/* Reset Password Button */}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            title="Resetear contraseña"
                            onClick={() => handleResetPasswordClick(ur.user_id)}
                          >
                            <Key className="h-4 w-4" />
                          </Button>

                          {/* Edit Role Button */}
                          <Dialog 
                            open={editingRole?.userId === ur.user_id} 
                            onOpenChange={(open) => !open && setEditingRole(null)}
                          >
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => {
                                  setEditingRole({ userId: ur.user_id, currentRole: ur.role as AppRole });
                                  setNewRole(ur.role as AppRole);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Cambiar Rol</DialogTitle>
                                <DialogDescription>
                                  Selecciona el nuevo rol para {getUserEmail(ur.user_id)}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="py-4">
                                <Label>Nuevo Rol</Label>
                                <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                                  <SelectTrigger className="mt-2">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="super_admin">Super Admin</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="responsible">Responsable</SelectItem>
                                    <SelectItem value="employee">Empleado</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setEditingRole(null)}>
                                  Cancelar
                                </Button>
                                <Button 
                                  onClick={() => updateRoleMutation.mutate({ userId: ur.user_id, newRole })}
                                  disabled={updateRoleMutation.isPending}
                                >
                                  {updateRoleMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                  Guardar
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          
                          {ur.role !== 'super_admin' && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm('¿Estás seguro de eliminar este usuario del sistema?')) {
                                  deleteRoleMutation.mutate(ur.user_id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Reset Password Dialog */}
        <Dialog 
          open={!!resetPasswordUser} 
          onOpenChange={(open) => !open && setResetPasswordUser(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resetear Contraseña</DialogTitle>
              <DialogDescription>
                {resetPasswordUser?.email}
              </DialogDescription>
            </DialogHeader>
            
            {generatedPassword ? (
              <div className="space-y-4 py-4">
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
                  <h4 className="font-semibold text-green-800 dark:text-green-200 mb-3">
                    ✓ Contraseña reseteada
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <p className="font-mono">{resetPasswordUser?.email}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Nueva contraseña</Label>
                      <div className="flex items-center gap-2">
                        <p className="font-mono">
                          {showPassword ? generatedPassword : '••••••••••••'}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  ⚠️ Guarda estas credenciales ahora. No se mostrarán de nuevo.
                </p>
                <Button onClick={copyCredentials} className="w-full" variant="outline">
                  {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? 'Copiadas' : 'Copiar credenciales'}
                </Button>
              </div>
            ) : (
              <>
                <div className="py-4">
                  <p className="text-sm text-muted-foreground">
                    Se generará una nueva contraseña temporal para este usuario.
                    El usuario deberá cambiarla cuando inicie sesión.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setResetPasswordUser(null)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={() => resetPasswordMutation.mutate(resetPasswordUser!.userId)}
                    disabled={resetPasswordMutation.isPending}
                    variant="destructive"
                  >
                    {resetPasswordMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Resetear Contraseña
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </SuperAdminLayout>
  );
}
