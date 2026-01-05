import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
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
import { Plus, Search, Edit, Trash2, QrCode, KeyRound } from 'lucide-react';
import { EmployeeQrDialog } from '@/components/employees/EmployeeQrDialog';
import { EmployeePinDialog } from '@/components/employees/EmployeePinDialog';
import type { Employee, EmployeeStatus } from '@/types/database';

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
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [qrEmployee, setQrEmployee] = useState<Employee | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [pinEmployee, setPinEmployee] = useState<Employee | null>(null);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('last_name', { ascending: true });
      if (error) throw error;
      return data as Employee[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { employee_code: string; first_name: string; last_name: string; email?: string | null; phone?: string | null; department?: string | null; position?: string | null; status: EmployeeStatus }) => {
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
    mutationFn: async ({ id, data }: { id: string; data: Partial<Employee> }) => {
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

  const filteredEmployees = employees?.filter(
    (e) =>
      e.first_name.toLowerCase().includes(search.toLowerCase()) ||
      e.last_name.toLowerCase().includes(search.toLowerCase()) ||
      e.employee_code.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      employee_code: formData.get('employee_code') as string,
      first_name: formData.get('first_name') as string,
      last_name: formData.get('last_name') as string,
      email: formData.get('email') as string || null,
      phone: formData.get('phone') as string || null,
      department: formData.get('department') as string || null,
      position: formData.get('position') as string || null,
      status: (formData.get('status') as EmployeeStatus) || 'active',
    };

    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, data });
    } else {
      createMutation.mutate(data);
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Apellidos *</Label>
                    <Input
                      id="last_name"
                      name="last_name"
                      defaultValue={editingEmployee?.last_name}
                      required
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
                <Button type="submit" className="w-full">
                  {editingEmployee ? 'Guardar cambios' : 'Crear empleado'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
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
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
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
                    <TableCell>{employee.email || '-'}</TableCell>
                    <TableCell>{employee.department || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[employee.status]}>
                        {statusLabels[employee.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          title="Ver QR"
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
                          onClick={() => {
                            if (confirm('¿Eliminar este empleado?')) {
                              deleteMutation.mutate(employee.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
      </div>
    </AppLayout>
  );
}
