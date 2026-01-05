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
import { Building2, Plus, Search, Users, Clock, Edit, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export default function SuperAdminCompanies() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    cif: "",
    address: "",
    city: "",
    postal_code: "",
    timezone: "Europe/Madrid",
  });

  const { data: companies, isLoading } = useQuery({
    queryKey: ['super-admin-all-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: employeeCounts } = useQuery({
    queryKey: ['super-admin-employee-counts-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('company_id, status');
      if (error) throw error;
      
      const counts: Record<string, { total: number; active: number }> = {};
      data.forEach((emp) => {
        if (!emp.company_id) return;
        if (!counts[emp.company_id]) {
          counts[emp.company_id] = { total: 0, active: 0 };
        }
        counts[emp.company_id].total++;
        if (emp.status === 'active') counts[emp.company_id].active++;
      });
      return counts;
    },
  });

  const { data: eventCounts } = useQuery({
    queryKey: ['super-admin-event-counts-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_events')
        .select('company_id');
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data.forEach((event) => {
        if (!event.company_id) return;
        counts[event.company_id] = (counts[event.company_id] || 0) + 1;
      });
      return counts;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: newCompany, error } = await supabase
        .from('company')
        .insert([data])
        .select()
        .single();
      if (error) throw error;
      return newCompany;
    },
    onSuccess: () => {
      toast.success('Empresa creada correctamente');
      queryClient.invalidateQueries({ queryKey: ['super-admin-all-companies'] });
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(`Error al crear empresa: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: typeof formData & { id: string }) => {
      const { error } = await supabase
        .from('company')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Empresa actualizada correctamente');
      queryClient.invalidateQueries({ queryKey: ['super-admin-all-companies'] });
      setEditingCompany(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(`Error al actualizar: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      cif: "",
      address: "",
      city: "",
      postal_code: "",
      timezone: "Europe/Madrid",
    });
  };

  const handleEdit = (company: any) => {
    setEditingCompany(company);
    setFormData({
      name: company.name || "",
      cif: company.cif || "",
      address: company.address || "",
      city: company.city || "",
      postal_code: company.postal_code || "",
      timezone: company.timezone || "Europe/Madrid",
    });
  };

  const handleSubmit = () => {
    if (editingCompany) {
      updateMutation.mutate({ id: editingCompany.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredCompanies = companies?.filter((company) => 
    company.name.toLowerCase().includes(search.toLowerCase()) ||
    company.cif?.toLowerCase().includes(search.toLowerCase()) ||
    company.city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6" />
              Gestión de Empresas
            </h1>
            <p className="text-muted-foreground">
              Administra todas las empresas de la plataforma
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setEditingCompany(null); }}>
                <Plus className="w-4 h-4 mr-2" />
                Nueva Empresa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nueva Empresa</DialogTitle>
                <DialogDescription>
                  Añade una nueva empresa a la plataforma
                </DialogDescription>
              </DialogHeader>
              <CompanyForm formData={formData} setFormData={setFormData} />
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending || !formData.name}>
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Crear
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, CIF o ciudad..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Companies Table */}
        <Card>
          <CardHeader>
            <CardTitle>Empresas ({filteredCompanies?.length || 0})</CardTitle>
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
                    <TableHead>Empresa</TableHead>
                    <TableHead>CIF</TableHead>
                    <TableHead>Ciudad</TableHead>
                    <TableHead>Timezone</TableHead>
                    <TableHead>Empleados</TableHead>
                    <TableHead>Fichajes</TableHead>
                    <TableHead>Creada</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies?.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>{company.cif || '-'}</TableCell>
                      <TableCell>{company.city || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{company.timezone}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{employeeCounts?.[company.id]?.active || 0}</span>
                          <span className="text-muted-foreground">
                            / {employeeCounts?.[company.id]?.total || 0}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {eventCounts?.[company.id] || 0}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(company.created_at), 'dd/MM/yyyy', { locale: es })}
                      </TableCell>
                      <TableCell>
                        <Dialog open={editingCompany?.id === company.id} onOpenChange={(open) => !open && setEditingCompany(null)}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(company)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Editar Empresa</DialogTitle>
                            </DialogHeader>
                            <CompanyForm formData={formData} setFormData={setFormData} />
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setEditingCompany(null)}>
                                Cancelar
                              </Button>
                              <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
                                {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Guardar
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}

function CompanyForm({ formData, setFormData }: { formData: any; setFormData: (data: any) => void }) {
  return (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Nombre *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Nombre de la empresa"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="cif">CIF</Label>
          <Input
            id="cif"
            value={formData.cif}
            onChange={(e) => setFormData({ ...formData, cif: e.target.value })}
            placeholder="B12345678"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="timezone">Zona Horaria</Label>
          <Input
            id="timezone"
            value={formData.timezone}
            onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
            placeholder="Europe/Madrid"
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="address">Dirección</Label>
        <Input
          id="address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder="Calle, número..."
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="city">Ciudad</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder="Madrid"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="postal_code">Código Postal</Label>
          <Input
            id="postal_code"
            value={formData.postal_code}
            onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
            placeholder="28001"
          />
        </div>
      </div>
    </div>
  );
}
