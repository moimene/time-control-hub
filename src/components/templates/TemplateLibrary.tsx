import { useState } from 'react';
import { useTemplates } from '@/hooks/useTemplates';
import { RuleSetWithVersions, SECTOR_LABELS, STATUS_LABELS, DEFAULT_TEMPLATE_PAYLOAD, TemplatePayload } from '@/types/templates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, FileText, Building2, Search, Filter, Archive, Sparkles, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SeedTemplateSelector } from './SeedTemplateSelector';

interface TemplateLibraryProps {
  onSelect: (ruleSet: RuleSetWithVersions) => void;
}

export function TemplateLibrary({ onSelect }: TemplateLibraryProps) {
  const { ruleSets, isLoading, createRuleSet, archiveRuleSet } = useTemplates();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sectorFilter, setSectorFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSeedSelectorOpen, setIsSeedSelectorOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    sector: '',
    convenio: '',
  });

  const filteredRuleSets = (ruleSets || []).filter(rs => {
    const matchesSearch = rs.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rs.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || rs.status === statusFilter;
    const matchesSector = sectorFilter === 'all' || rs.sector === sectorFilter;
    return matchesSearch && matchesStatus && matchesSector;
  });

  const companyTemplates = filteredRuleSets.filter(rs => rs.company_id !== null);
  const globalTemplates = filteredRuleSets.filter(rs => rs.company_id === null && rs.is_template);

  const handleCreate = async () => {
    if (!newTemplate.name.trim()) return;
    
    await createRuleSet.mutateAsync({
      name: newTemplate.name,
      description: newTemplate.description,
      sector: newTemplate.sector || undefined,
      convenio: newTemplate.convenio || undefined,
      payload: DEFAULT_TEMPLATE_PAYLOAD,
    });
    
    setIsCreateDialogOpen(false);
    setNewTemplate({ name: '', description: '', sector: '', convenio: '' });
  };

  const handleCreateFromSeed = async (payload: TemplatePayload, name: string, sector: string, convenio: string) => {
    await createRuleSet.mutateAsync({
      name: `${name} (Personalizada)`,
      description: `Basada en plantilla seed de ${sector}. ⚠️ Requiere verificación con convenio aplicable.`,
      sector: sector,
      convenio: convenio,
      payload: payload,
    });
  };

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (status) {
      case 'published':
      case 'active':
        return 'default';
      case 'draft':
        return 'secondary';
      case 'archived':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar plantillas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="draft">Borrador</SelectItem>
              <SelectItem value="published">Publicado</SelectItem>
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="archived">Archivado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sectorFilter} onValueChange={setSectorFilter}>
            <SelectTrigger className="w-[160px]">
              <Building2 className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Sector" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="hosteleria">Hostelería</SelectItem>
              <SelectItem value="comercio">Comercio</SelectItem>
              <SelectItem value="comercio_alimentacion">Comercio Alimentación</SelectItem>
              <SelectItem value="servicios_profesionales">Oficinas</SelectItem>
              <SelectItem value="salud">Sanidad</SelectItem>
              <SelectItem value="veterinaria">Veterinaria</SelectItem>
              <SelectItem value="metal">Metal</SelectItem>
              <SelectItem value="construccion">Construcción</SelectItem>
              <SelectItem value="limpieza">Limpieza</SelectItem>
              <SelectItem value="consultoria">Consultoría</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsSeedSelectorOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Desde Plantilla Seed
          </Button>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nueva en Blanco
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nueva Plantilla</DialogTitle>
                <DialogDescription>
                  Define las reglas de cumplimiento para tu empresa desde cero
                </DialogDescription>
              </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Reglas Hostelería 2026"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe el propósito de esta plantilla..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sector">Sector</Label>
                  <Select 
                    value={newTemplate.sector} 
                    onValueChange={(value) => setNewTemplate(prev => ({ ...prev, sector: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hosteleria">Hostelería</SelectItem>
                      <SelectItem value="comercio">Comercio</SelectItem>
                      <SelectItem value="oficinas">Oficinas</SelectItem>
                      <SelectItem value="sanitario">Sanitario</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="convenio">Convenio</Label>
                  <Input
                    id="convenio"
                    value={newTemplate.convenio}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, convenio: e.target.value }))}
                    placeholder="Ej: CC Hostelería Madrid"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={!newTemplate.name.trim() || createRuleSet.isPending}>
                {createRuleSet.isPending ? 'Creando...' : 'Crear'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Company Templates */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Mis Plantillas</h2>
        {companyTemplates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No tienes plantillas creadas</p>
              <p className="text-sm text-muted-foreground">Crea una nueva o usa una plantilla de sector como base</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {companyTemplates.map((ruleSet) => {
              const needsVerification = ruleSet.description?.includes('⚠️ Requiere verificación') || 
                                        ruleSet.name?.includes('(Personalizada)');
              return (
                <Card 
                  key={ruleSet.id} 
                  className={`cursor-pointer transition-shadow hover:shadow-md ${needsVerification ? 'border-warning/50' : ''}`}
                  onClick={() => onSelect(ruleSet)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg">{ruleSet.name}</CardTitle>
                      <div className="flex items-center gap-1">
                        {needsVerification && (
                          <Badge variant="outline" className="text-xs border-warning text-warning bg-warning/10">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Verificar
                          </Badge>
                        )}
                        <Badge variant={getStatusVariant(ruleSet.status)}>
                          {STATUS_LABELS[ruleSet.status] || ruleSet.status}
                        </Badge>
                      </div>
                    </div>
                    {ruleSet.description && (
                      <CardDescription className="line-clamp-2">
                        {ruleSet.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        {ruleSet.sector && (
                          <Badge variant="outline" className="text-xs">
                            {SECTOR_LABELS[ruleSet.sector] || ruleSet.sector}
                          </Badge>
                        )}
                        {ruleSet.rule_versions && (
                          <span>{ruleSet.rule_versions.length} versiones</span>
                        )}
                      </div>
                      <span>
                        {format(new Date(ruleSet.updated_at), 'dd MMM yyyy', { locale: es })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Global Templates */}
      {globalTemplates.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Plantillas de Sector</h2>
          <p className="text-sm text-muted-foreground">
            Plantillas predefinidas por sector que puedes usar como base
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {globalTemplates.map((ruleSet) => (
              <Card 
                key={ruleSet.id} 
                className="cursor-pointer transition-shadow hover:shadow-md border-dashed"
                onClick={() => onSelect(ruleSet)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{ruleSet.name}</CardTitle>
                    <Badge variant="secondary">Plantilla</Badge>
                  </div>
                  {ruleSet.description && (
                    <CardDescription className="line-clamp-2">
                      {ruleSet.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {ruleSet.sector && (
                      <Badge variant="outline" className="text-xs">
                        {SECTOR_LABELS[ruleSet.sector] || ruleSet.sector}
                      </Badge>
                    )}
                    {ruleSet.convenio && (
                      <span className="truncate">{ruleSet.convenio}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Seed Template Selector */}
      <SeedTemplateSelector
        open={isSeedSelectorOpen}
        onOpenChange={setIsSeedSelectorOpen}
        onSelect={handleCreateFromSeed}
      />
    </div>
  );
}
