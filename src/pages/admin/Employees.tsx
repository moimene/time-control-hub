import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCompany } from '@/hooks/useCompany';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Edit, Trash2, QrCode, KeyRound, UserCog, Briefcase } from 'lucide-react';
import { z } from 'zod';
import { EmployeeQrDialog } from '@/components/employees/EmployeeQrDialog';
import { EmployeePinDialog } from '@/components/employees/EmployeePinDialog';
import { EmployeeCredentialsDialog } from '@/components/employees/EmployeeCredentialsDialog';
import { EmployeeTemplateDialog } from '@/components/employees/EmployeeTemplateDialog';
import { AUTONOMOUS_COMMUNITIES, getAutonomousCommunityName } from '@/lib/autonomousCommunities';
import type { EmployeeStatus } from '@/types/database';

interface EmployeeWithLocation {
  id: string;
  user_id: string | null;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  position: string | null;
  status: EmployeeStatus;
  hire_date: string | null;
  termination_date: string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
  autonomous_community: string | null;
  locality: string | null;
  pin_hash: string | null;
  pin_salt: string | null;
  pin_failed_attempts: number | null;
  pin_locked_until: string | null;
  is_department_responsible: boolean | null;
}

// Regex to reject dangerous characters (XSS/SQLi payloads)
const safeTextRegex = /^[a-zA-ZÀ-ÿñÑ0-9\s\-'.,()/]+$/;
const employeeCodeRegex = /^[A-Za-z0-9\-_]+$/;

const employeeFormSchema = z.object({
  employee_code: z.string()
    .min(1, 'El código es obligatorio')
    .max(20, 'El código no puede exceder 20 caracteres')
    .regex(employeeCodeRegex, 'El código solo puede contener letras, números, guiones y guiones bajos'),
  first_name: z.string()
    .min(1, 'El nombre es obligatorio')
    .max(100, 'Máximo 100 caracteres')
    .regex(safeTextRegex, 'El nombre contiene caracteres no permitidos'),
  last_name: z.string()
    .min(1, 'Los apellidos son obligatorios')
    .max(150, 'Máximo 150 caracteres')
    .regex(safeTextRegex, 'Los apellidos contienen caracteres no permitidos'),
  email: z.union([
    z.string().email('Email inválido'),
    z.literal(''),
  ]).optional().transform(v => v || null),
  phone: z.string()
    .max(20, 'Máximo 20 caracteres')
    .regex(/^[0-9+\-\s()]*$/, 'Formato de teléfono inválido')
    .optional()
    .transform(v => v || null),
  department: z.string()
    .max(100, 'Máximo 100 caracteres')
    .regex(safeTextRegex, 'Contiene caracteres no permitidos')
    .optional()
    .or(z.literal(''))
    .transform(v => v || null),
  position: z.string()
    .max(100, 'Máximo 100 caracteres')
    .regex(safeTextRegex, 'Contiene caracteres no permitidos')
    .optional()
    .or(z.literal(''))
    .transform(v => v || null),
  locality: z.string()
    .max(100, 'Máximo 100 caracteres')
    .regex(safeTextRegex, 'Contiene caracteres no permitidos')
    .optional()
    .or(z.literal(''))
    .transform(v => v || null),
});

const statusLabels: Record<EmployeeStatus, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  suspended: 'Suspendido',
  on_leave: 'De baja',
};

const statusColors: Record<EmployeeStatus, string> = {
  active: 'bg-green-500/10 text-green-700 border-green-200',
  inactive: 'bg-gray-500/10 text-gray-700 border-gray-200',
  suspended: 'bg-red-500/10 text-red-700 border-red-200',
  on_leave: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
};

export default function Employees() {
  const { isAdmin, isAsesor } = useAuth();
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithLocation | null>(null);
  const [qrEmployee, setQrEmployee] = useState<EmployeeWithLocation | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [pinEmployee, setPinEmployee] = useState<EmployeeWithLocation | null>(null);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [credentialsEmployee, setCredentialsEmployee] = useState<EmployeeWithLocation | null>(null);
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [templateEmployee, setTemplateEmployee] = useState<EmployeeWithLocation | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { companyId } = useCompany();

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('last_name', { ascending: true });
      if (error) throw error;
      return data as EmployeeWithLocation[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { employee_code: string; first_name: string; last_name: string; email?: string | null; phone?: string | null; department?: string | null; position?: string | null; status: EmployeeStatus; company_id: string }) => {
      const { error } = await supabase.from('employees').insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsOpen(false);
      toast({ title: 'Empleado creado correctamente' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EmployeeWithLocation> }) => {
      const { error } = await supabase.from('employees').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsOpen(false);
      setEditingEmployee(null);
      toast({ title: 'Empleado actualizado correctamente' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast({ title: 'Empleado eliminado' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    if (!search) return employees;

    const searchLower = search.toLowerCase();
    return employees.filter(
      (e) =>
        e.first_name.toLowerCase().includes(searchLower) ||
        e.last_name.toLowerCase().includes(searchLower) ||
        e.employee_code.toLowerCase().includes(searchLower)
    );
  }, [employees, search]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const autonomousCommunity = formData.get('autonomous_community') as string;

    // Validate with Zod schema (sanitizes XSS/SQLi)
    const validation = employeeFormSchema.safeParse({
      employee_code: (formData.get('employee_code') as string)?.trim(),
      first_name: (formData.get('first_name') as string)?.trim(),
      last_name: (formData.get('last_name') as string)?.trim(),
      email: (formData.get('email') as string)?.trim(),
      phone: (formData.get('phone') as string)?.trim(),
      department: (formData.get('department') as string)?.trim(),
      position: (formData.get('position') as string)?.trim(),
      locality: (formData.get('locality') as string)?.trim(),
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast({
        variant: 'destructive',
        title: 'Error de validación',
        description: firstError.message,
      });
      return;
    }

    const data = {
      ...validation.data,
      status: (formData.get('status') as EmployeeStatus) || 'active',
      autonomous_community: autonomousCommunity === '_none_' ? null : (autonomousCommunity || null),
    };

    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, data });
    } else {
      if (!companyId) {
        toast({ variant: 'destructive', title: 'Error', description: 'No hay empresa configurada' });
        return;
      }
      createMutation.mutate({ ...data, company_id: companyId });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Empleados</h1>
            <p className="text-muted-foreground">Gestiona los empleados de la empresa</p>
          </div>
          {!isAsesor && (
            <Dialog open={isOpen} onOpenChange={(open) => {
              setIsOpen(open);
              if (!open) setEditingEmployee(null);
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Empleado
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingEmployee
                      ? 'Modifica los datos del empleado'
                      : 'Añade un nuevo empleado al sistema'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="employee_code">Código *</Label>
                      <Input
                        id="employee_code"
                        name="employee_code"
                        defaultValue={editingEmployee?.employee_code}
                        required
                        maxLength={20}
                        placeholder="EMP001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Estado</Label>
                      <Select name="status" defaultValue={editingEmployee?.status || 'active'}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">Nombre *</Label>
                      <Input
                        id="first_name"
                        name="first_name"
                        defaultValue={editingEmployee?.first_name}
                        required
                        maxLength={100}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Apellidos *</Label>
                      <Input
                        id="last_name"
                        name="last_name"
                        defaultValue={editingEmployee?.last_name}
                        required
                        maxLength={150}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      defaultValue={editingEmployee?.email || ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      maxLength={20}
                      defaultValue={editingEmployee?.phone || ''}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="department">Departamento</Label>
                      <Input
                        id="department"
                        name="department"
                        defaultValue={editingEmployee?.department || ''}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="position">Puesto</Label>
                      <Input
                        id="position"
                        name="position"
                        defaultValue={editingEmployee?.position || ''}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="autonomous_community">Comunidad Autónoma</Label>
                      <Select name="autonomous_community" defaultValue={editingEmployee?.autonomous_community || '_none_'}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar CC.AA." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none_">Sin especificar</SelectItem>
                          {AUTONOMOUS_COMMUNITIES.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="locality">Localidad</Label>
                      <Input
                        id="locality"
                        name="locality"
                        placeholder="Municipio"
                        defaultValue={editingEmployee?.locality || ''}
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full">
                    {editingEmployee ? 'Guardar cambios' : 'Crear empleado'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar empleado..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Departamento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">{!isAsesor && 'Acciones'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : filteredEmployees?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No hay empleados registrados
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees?.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-mono">{employee.employee_code}</TableCell>
                    <TableCell>
                      {employee.first_name} {employee.last_name}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{employee.email || '-'}</TableCell>
                    <TableCell className="hidden lg:table-cell">{employee.department || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[employee.status]}>
                        {statusLabels[employee.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {!isAsesor && (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Credenciales de acceso"
                            aria-label={`Credenciales de ${employee.first_name} ${employee.last_name}`}
                            onClick={() => {
                              setCredentialsEmployee(employee);
                              setCredentialsDialogOpen(true);
                            }}
                          >
                            <UserCog className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Ver QR"
                            aria-label={`Ver QR de ${employee.first_name} ${employee.last_name}`}
                            onClick={() => {
                              setQrEmployee(employee);
                              setQrDialogOpen(true);
                            }}
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Cambiar PIN"
                            aria-label={`Cambiar PIN de ${employee.first_name} ${employee.last_name}`}
                            onClick={() => {
                              setPinEmployee(employee);
                              setPinDialogOpen(true);
                            }}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Asignar jornada"
                            aria-label={`Asignar jornada a ${employee.first_name} ${employee.last_name}`}
                            onClick={() => {
                              setTemplateEmployee(employee);
                              setTemplateDialogOpen(true);
                            }}
                          >
                            <Briefcase className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Editar empleado"
                            aria-label={`Editar ${employee.first_name} ${employee.last_name}`}
                            onClick={() => {
                              setEditingEmployee(employee);
                              setIsOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Eliminar empleado"
                            aria-label={`Eliminar ${employee.first_name} ${employee.last_name}`}
                            onClick={() => {
                              if (confirm('¿Eliminar este empleado?')) {
                                deleteMutation.mutate(employee.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <EmployeeQrDialog
          employee={qrEmployee}
          open={qrDialogOpen}
          onOpenChange={setQrDialogOpen}
        />

        <EmployeePinDialog
          employee={pinEmployee}
          open={pinDialogOpen}
          onOpenChange={setPinDialogOpen}
        />

        <EmployeeCredentialsDialog
          employee={credentialsEmployee}
          open={credentialsDialogOpen}
          onOpenChange={setCredentialsDialogOpen}
        />

        <EmployeeTemplateDialog
          employee={templateEmployee}
          open={templateDialogOpen}
          onOpenChange={setTemplateDialogOpen}
        />
      </div>
    </AppLayout>
  );
}
