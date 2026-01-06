import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Building2, Sparkles, AlertTriangle } from 'lucide-react';
import { getSuggestedSector } from '@/lib/cnaeMapping';
import { SECTOR_LABELS, SEED_TEMPLATES } from '@/types/templates';

export default function CompanySetup() {
  const [companyName, setCompanyName] = useState('');
  const [cif, setCif] = useState('');
  const [cnae, setCnae] = useState('');
  const [suggestedSector, setSuggestedSector] = useState<{ sector: string; confidence: 'high' | 'medium' | 'low' } | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update suggested sector when CNAE changes
  useEffect(() => {
    if (cnae.length >= 2) {
      const suggestion = getSuggestedSector(cnae);
      setSuggestedSector(suggestion);
    } else {
      setSuggestedSector(null);
    }
  }, [cnae]);

  const suggestedTemplate = suggestedSector 
    ? SEED_TEMPLATES.find(t => t.sector === suggestedSector.sector) 
    : null;

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

  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return <Badge variant="default" className="text-xs">Alta coincidencia</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="text-xs">Coincidencia media</Badge>;
      case 'low':
        return <Badge variant="outline" className="text-xs">Coincidencia aproximada</Badge>;
    }
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
            <div className="space-y-2">
              <Label htmlFor="cnae">Código CNAE (opcional)</Label>
              <Input
                id="cnae"
                placeholder="5610"
                value={cnae}
                onChange={(e) => setCnae(e.target.value)}
                disabled={setupMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Introduce tu código CNAE para sugerirte una plantilla de cumplimiento
              </p>
            </div>

            {/* Suggested Template */}
            {suggestedSector && suggestedTemplate && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">Plantilla sugerida</span>
                        {getConfidenceBadge(suggestedSector.confidence)}
                      </div>
                      <div>
                        <p className="font-semibold">{suggestedTemplate.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Sector: {SECTOR_LABELS[suggestedSector.sector] || suggestedSector.sector}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {suggestedTemplate.convenio}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-warning">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Verificar con convenio aplicable tras crear empresa</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

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
