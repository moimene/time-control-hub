import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Building2 } from 'lucide-react';

export default function CompanySetup() {
  const [companyName, setCompanyName] = useState('');
  const [cif, setCif] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const setupMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user');

      // Create company
      const { data: company, error: companyError } = await supabase
        .from('company')
        .insert({
          name: companyName,
          cif: cif || null,
        })
        .select()
        .single();

      if (companyError) throw companyError;

      // Link user to company
      const { error: linkError } = await supabase
        .from('user_company')
        .insert({
          user_id: user.id,
          company_id: company.id,
        });

      if (linkError) throw linkError;

      // Assign admin role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'admin',
        });

      if (roleError) throw roleError;

      return company;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-company'] });
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      toast({ title: 'Empresa creada correctamente' });
      // Force page reload to refresh auth state
      window.location.href = '/admin';
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'El nombre de la empresa es obligatorio' });
      return;
    }
    setupMutation.mutate();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Configurar Empresa</CardTitle>
          <CardDescription>
            Configura tu empresa para comenzar a usar el sistema de control horario
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Nombre de la empresa *</Label>
              <Input
                id="company-name"
                placeholder="Mi Empresa S.L."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={setupMutation.isPending}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cif">CIF (opcional)</Label>
              <Input
                id="cif"
                placeholder="B12345678"
                value={cif}
                onChange={(e) => setCif(e.target.value)}
                disabled={setupMutation.isPending}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={setupMutation.isPending}
            >
              {setupMutation.isPending ? 'Creando...' : 'Crear empresa'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
