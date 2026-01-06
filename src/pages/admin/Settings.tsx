import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/hooks/useCompany';
import { Building2 } from 'lucide-react';
import { NotificationSettings } from '@/components/admin/NotificationSettings';

export default function Settings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { company, isLoading } = useCompany();

  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; cif?: string | null; address?: string | null; city?: string | null; postal_code?: string | null; timezone: string }) => {
      if (!company) throw new Error('No hay empresa configurada');
      
      const { error } = await supabase
        .from('company')
        .update(data)
        .eq('id', company.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      queryClient.invalidateQueries({ queryKey: ['user-company'] });
      toast({ title: 'Configuración guardada correctamente' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    saveMutation.mutate({
      name: formData.get('name') as string,
      cif: formData.get('cif') as string || null,
      address: formData.get('address') as string || null,
      city: formData.get('city') as string || null,
      postal_code: formData.get('postal_code') as string || null,
      timezone: 'Europe/Madrid',
    });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (!company) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No hay empresa configurada</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
          <p className="text-muted-foreground">Configura los datos de la empresa</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <CardTitle>Datos de la Empresa</CardTitle>
            </div>
            <CardDescription>
              Información general de la empresa para los informes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre de la empresa *</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={company.name || ''}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cif">CIF</Label>
                  <Input
                    id="cif"
                    name="cif"
                    defaultValue={company.cif || ''}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  name="address"
                  defaultValue={company.address || ''}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">Ciudad</Label>
                  <Input
                    id="city"
                    name="city"
                    defaultValue={company.city || ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postal_code">Código Postal</Label>
                  <Input
                    id="postal_code"
                    name="postal_code"
                    defaultValue={company.postal_code || ''}
                  />
                </div>
              </div>

              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Guardando...' : 'Guardar configuración'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <NotificationSettings />
      </div>
    </AppLayout>
  );
}
