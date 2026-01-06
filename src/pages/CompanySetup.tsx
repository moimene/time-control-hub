import { useState } from 'react';
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
import { Building2, User, Sparkles, AlertTriangle, ChevronLeft, ChevronRight, Check, Search } from 'lucide-react';
import { getSuggestedSector } from '@/lib/cnaeMapping';
import { SECTOR_LABELS, SEED_TEMPLATES, SECTOR_OPTIONS, SectorOption } from '@/types/templates';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type EntityType = 'empresa' | 'autonomo';
type Step = 1 | 2 | 3 | 4;

interface FormData {
  entityType: EntityType;
  // Empresa fields
  denominacionSocial: string;
  cif: string;
  // Autónomo fields
  nombre: string;
  apellidos: string;
  nif: string;
  // Shared
  nombreComercial: string;
  // Activity
  selectedSector: string;
  otherActivityDescription: string;
  cnae: string;
}

const initialFormData: FormData = {
  entityType: 'empresa',
  denominacionSocial: '',
  cif: '',
  nombre: '',
  apellidos: '',
  nif: '',
  nombreComercial: '',
  selectedSector: '',
  otherActivityDescription: '',
  cnae: '',
};

export default function CompanySetup() {
  const [step, setStep] = useState<Step>(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [activityTab, setActivityTab] = useState<'activity' | 'cnae'>('activity');
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get suggested sector from CNAE if entered
  const cnaeSuggestion = formData.cnae.length >= 2 ? getSuggestedSector(formData.cnae) : null;
  
  // Get suggested template based on selected sector or CNAE
  const effectiveSector = formData.selectedSector || cnaeSuggestion?.sector || '';
  const suggestedTemplate = effectiveSector && effectiveSector !== 'otros'
    ? SEED_TEMPLATES.find(t => t.sector === effectiveSector)
    : null;

  const updateFormData = (updates: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const getDisplayName = () => {
    if (formData.entityType === 'autonomo') {
      return `${formData.nombre} ${formData.apellidos}`.trim() || 'Sin nombre';
    }
    return formData.denominacionSocial || 'Sin denominación';
  };

  const getIdentifier = () => {
    return formData.entityType === 'autonomo' ? formData.nif : formData.cif;
  };

  const setupMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user');

      const companyName = formData.entityType === 'autonomo'
        ? `${formData.nombre} ${formData.apellidos}`.trim()
        : formData.denominacionSocial;

      const identifier = formData.entityType === 'autonomo' ? formData.nif : formData.cif;

      // Create company
      const { data: company, error: companyError } = await supabase
        .from('company')
        .insert({
          name: companyName,
          cif: identifier || null,
          entity_type: formData.entityType,
          trade_name: formData.nombreComercial || null,
          sector: formData.selectedSector || null,
          cnae: formData.cnae || null,
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
      window.location.href = '/admin';
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const canProceed = () => {
    switch (step) {
      case 1:
        return !!formData.entityType;
      case 2:
        if (formData.entityType === 'autonomo') {
          return formData.nombre.trim() && formData.apellidos.trim();
        }
        return formData.denominacionSocial.trim();
      case 3:
        if (formData.selectedSector === 'otros') {
          return formData.otherActivityDescription.trim().length > 0;
        }
        return formData.selectedSector || formData.cnae.length >= 2;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceed() && step < 4) {
      setStep((step + 1) as Step);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as Step);
    }
  };

  const handleSubmit = () => {
    setupMutation.mutate();
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3, 4].map((s) => (
        <div
          key={s}
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
            s === step 
              ? "bg-primary text-primary-foreground" 
              : s < step 
                ? "bg-primary/20 text-primary" 
                : "bg-muted text-muted-foreground"
          )}
        >
          {s < step ? <Check className="h-4 w-4" /> : s}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-lg font-semibold">¿Qué tipo de entidad eres?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Selecciona si eres autónomo o empresa
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => updateFormData({ entityType: 'autonomo' })}
          className={cn(
            "flex flex-col items-center gap-3 p-6 rounded-lg border-2 transition-all hover:border-primary/50",
            formData.entityType === 'autonomo'
              ? "border-primary bg-primary/5"
              : "border-border"
          )}
        >
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center text-3xl",
            formData.entityType === 'autonomo' ? "bg-primary/20" : "bg-muted"
          )}>
            👤
          </div>
          <div className="text-center">
            <p className="font-medium">Autónomo</p>
            <p className="text-xs text-muted-foreground">Persona física</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => updateFormData({ entityType: 'empresa' })}
          className={cn(
            "flex flex-col items-center gap-3 p-6 rounded-lg border-2 transition-all hover:border-primary/50",
            formData.entityType === 'empresa'
              ? "border-primary bg-primary/5"
              : "border-border"
          )}
        >
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center text-3xl",
            formData.entityType === 'empresa' ? "bg-primary/20" : "bg-muted"
          )}>
            🏢
          </div>
          <div className="text-center">
            <p className="font-medium">Empresa</p>
            <p className="text-xs text-muted-foreground">Sociedad mercantil</p>
          </div>
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Datos de identificación</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {formData.entityType === 'autonomo' 
            ? 'Introduce tus datos personales' 
            : 'Introduce los datos de tu empresa'}
        </p>
      </div>

      {formData.entityType === 'autonomo' ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                placeholder="Juan"
                value={formData.nombre}
                onChange={(e) => updateFormData({ nombre: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apellidos">Apellidos *</Label>
              <Input
                id="apellidos"
                placeholder="García López"
                value={formData.apellidos}
                onChange={(e) => updateFormData({ apellidos: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nif">NIF (opcional)</Label>
            <Input
              id="nif"
              placeholder="12345678A"
              value={formData.nif}
              onChange={(e) => updateFormData({ nif: e.target.value })}
            />
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="denominacion">Denominación Social *</Label>
            <Input
              id="denominacion"
              placeholder="Restaurantes López S.L."
              value={formData.denominacionSocial}
              onChange={(e) => updateFormData({ denominacionSocial: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cif">CIF (opcional)</Label>
            <Input
              id="cif"
              placeholder="B12345678"
              value={formData.cif}
              onChange={(e) => updateFormData({ cif: e.target.value })}
            />
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="nombreComercial">Nombre comercial (opcional)</Label>
        <Input
          id="nombreComercial"
          placeholder="Café Central"
          value={formData.nombreComercial}
          onChange={(e) => updateFormData({ nombreComercial: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          El nombre con el que operas si es diferente
        </p>
      </div>
    </div>
  );

  const renderSectorCard = (option: SectorOption) => (
    <button
      key={option.id}
      type="button"
      onClick={() => updateFormData({ selectedSector: option.id, cnae: '' })}
      className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all hover:border-primary/50 text-center",
        formData.selectedSector === option.id
          ? "border-primary bg-primary/5"
          : "border-border"
      )}
    >
      <span className="text-2xl">{option.icon}</span>
      <span className="text-sm font-medium">{option.label}</span>
    </button>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold">¿Cuál es tu actividad principal?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Selecciona tu sector o introduce el código CNAE
        </p>
      </div>

      <Tabs value={activityTab} onValueChange={(v) => setActivityTab(v as 'activity' | 'cnae')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="activity">Por actividad</TabsTrigger>
          <TabsTrigger value="cnae">Por código CNAE</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-4">
          <div className="grid grid-cols-3 gap-3">
            {SECTOR_OPTIONS.map(renderSectorCard)}
          </div>

          {formData.selectedSector === 'otros' && (
            <div className="mt-4 space-y-2">
              <Label htmlFor="otherActivity">Describe tu actividad *</Label>
              <Input
                id="otherActivity"
                placeholder="Ej: Fabricación de muebles de madera"
                value={formData.otherActivityDescription}
                onChange={(e) => updateFormData({ otherActivityDescription: e.target.value })}
              />
              <div className="space-y-2 mt-3">
                <Label htmlFor="cnaeFallback">Código CNAE (opcional)</Label>
                <Input
                  id="cnaeFallback"
                  placeholder="3109"
                  value={formData.cnae}
                  onChange={(e) => updateFormData({ cnae: e.target.value })}
                />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="cnae" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cnaeInput">Código CNAE</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="cnaeInput"
                placeholder="Ej: 5610"
                value={formData.cnae}
                onChange={(e) => updateFormData({ cnae: e.target.value, selectedSector: '' })}
                className="pl-9"
              />
            </div>
          </div>

          {cnaeSuggestion && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-sm">Sector detectado</p>
                    <p className="text-sm text-muted-foreground">
                      {SECTOR_LABELS[cnaeSuggestion.sector] || cnaeSuggestion.sector}
                    </p>
                  </div>
                  <Badge variant={cnaeSuggestion.confidence === 'high' ? 'default' : 'secondary'} className="ml-auto">
                    {cnaeSuggestion.confidence === 'high' ? 'Alta' : cnaeSuggestion.confidence === 'medium' ? 'Media' : 'Baja'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Confirmar datos</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Revisa la información antes de crear tu empresa
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Tipo</span>
            <Badge variant="outline">
              {formData.entityType === 'autonomo' ? 'Autónomo' : 'Empresa'}
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {formData.entityType === 'autonomo' ? 'Nombre' : 'Denominación'}
            </span>
            <span className="font-medium text-sm">{getDisplayName()}</span>
          </div>
          {formData.nombreComercial && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Nombre comercial</span>
              <span className="font-medium text-sm">{formData.nombreComercial}</span>
            </div>
          )}
          {getIdentifier() && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {formData.entityType === 'autonomo' ? 'NIF' : 'CIF'}
              </span>
              <span className="font-medium text-sm">{getIdentifier()}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Actividad</span>
            <span className="font-medium text-sm">
              {formData.selectedSector === 'otros' 
                ? formData.otherActivityDescription || 'Otra actividad'
                : SECTOR_LABELS[effectiveSector] || 'No especificada'}
            </span>
          </div>
          {formData.cnae && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">CNAE</span>
              <span className="font-medium text-sm">{formData.cnae}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {suggestedTemplate && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Plantilla sugerida</span>
                  <Badge variant="secondary" className="text-xs">Automática</Badge>
                </div>
                <div>
                  <p className="font-semibold">{suggestedTemplate.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {suggestedTemplate.convenio}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Verificar con convenio aplicable tras crear empresa</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Configurar Empresa</CardTitle>
          <CardDescription>
            Paso {step} de 4
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderStepIndicator()}

          <div className="min-h-[300px]">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
          </div>

          <div className="flex justify-between mt-6 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={step === 1 || setupMutation.isPending}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>

            {step < 4 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!canProceed()}
              >
                Siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={setupMutation.isPending}
              >
                {setupMutation.isPending ? 'Creando...' : 'Crear empresa'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
