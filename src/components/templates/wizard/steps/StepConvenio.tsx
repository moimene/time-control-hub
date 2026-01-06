import { useState, useEffect } from 'react';
import { useWizard } from '../WizardContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SEED_TEMPLATES, SECTOR_LABELS } from '@/types/templates';
import { getSuggestedSector } from '@/lib/cnaeMapping';
import { Search, MapPin, Building2, AlertTriangle, ExternalLink } from 'lucide-react';

const TERRITORIAL_SCOPES = [
  { value: 'empresa', label: 'Convenio de empresa', description: 'Prioridad máxima si existe' },
  { value: 'provincial', label: 'Provincial', description: 'Convenio provincial del sector' },
  { value: 'autonomico', label: 'Autonómico', description: 'Convenio de comunidad autónoma' },
  { value: 'estatal', label: 'Estatal', description: 'Convenio estatal del sector o Estatuto' },
];

const REGIONS = [
  'Andalucía', 'Aragón', 'Asturias', 'Baleares', 'Canarias', 'Cantabria',
  'Castilla-La Mancha', 'Castilla y León', 'Cataluña', 'Extremadura',
  'Galicia', 'La Rioja', 'Madrid', 'Murcia', 'Navarra', 'País Vasco', 'Valencia'
];

export function StepConvenio() {
  const { state, selectSeed, setTerritorialScope, setRegion, updateNestedPayload } = useWizard();
  const [cnaeInput, setCnaeInput] = useState('');
  const [suggestedSector, setSuggestedSector] = useState<{ sector: string; confidence: string } | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    if (cnaeInput.length >= 2) {
      const suggestion = getSuggestedSector(cnaeInput);
      setSuggestedSector(suggestion);
      if (suggestion && suggestion.confidence === 'high') {
        selectSeed(suggestion.sector);
      }
    } else {
      setSuggestedSector(null);
    }
  }, [cnaeInput, selectSeed]);

  const filteredTemplates = SEED_TEMPLATES.filter(template => {
    const searchLower = searchFilter.toLowerCase();
    return (
      template.name.toLowerCase().includes(searchLower) ||
      template.description.toLowerCase().includes(searchLower) ||
      (SECTOR_LABELS[template.sector] || '').toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Paso 1: Identificación del Convenio</h3>
        <p className="text-muted-foreground text-sm">
          El asistente aplicará la jerarquía normativa: convenio empresa → provincial → autonómico → estatal → Estatuto de los Trabajadores.
        </p>
      </div>

      {/* CNAE Input */}
      <div className="space-y-3">
        <Label>Código CNAE de la actividad</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ej: 5610 (Restaurantes), 4711 (Supermercados)..."
            value={cnaeInput}
            onChange={(e) => setCnaeInput(e.target.value)}
            className="pl-10"
          />
        </div>
        {suggestedSector && (
          <Alert className={suggestedSector.confidence === 'high' ? 'border-primary' : 'border-warning'}>
            <AlertDescription className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Sector sugerido: <Badge variant="secondary">{SECTOR_LABELS[suggestedSector.sector] || suggestedSector.sector}</Badge>
              <Badge variant={suggestedSector.confidence === 'high' ? 'default' : 'outline'}>
                Confianza {suggestedSector.confidence}
              </Badge>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Territorial Scope */}
      <div className="space-y-3">
        <Label>Ámbito territorial del convenio</Label>
        <RadioGroup
          value={state.territorialScope}
          onValueChange={(value) => setTerritorialScope(value as any)}
          className="grid grid-cols-2 gap-3"
        >
          {TERRITORIAL_SCOPES.map((scope) => (
            <div key={scope.value} className="flex items-start space-x-3">
              <RadioGroupItem value={scope.value} id={scope.value} />
              <div className="grid gap-0.5">
                <Label htmlFor={scope.value} className="font-medium cursor-pointer">
                  {scope.label}
                </Label>
                <p className="text-xs text-muted-foreground">{scope.description}</p>
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Region Selector */}
      {(state.territorialScope === 'autonomico' || state.territorialScope === 'provincial') && (
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Comunidad Autónoma
          </Label>
          <select
            className="w-full border rounded-md p-2 bg-background"
            value={state.region}
            onChange={(e) => setRegion(e.target.value)}
          >
            <option value="">Seleccione comunidad...</option>
            {REGIONS.map((region) => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
        </div>
      )}

      {/* Seed Templates Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Plantilla base por sector</Label>
          <Input
            placeholder="Filtrar plantillas..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-48"
          />
        </div>

        <Alert variant="default" className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            Las plantillas seed son orientativas. <strong>DEBE verificar y adaptar</strong> los valores a su convenio específico y situación particular.
          </AlertDescription>
        </Alert>

        <div className="grid md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
          {filteredTemplates.map((template) => (
            <Card
              key={template.sector}
              className={`cursor-pointer transition-all hover:border-primary ${
                state.selectedSeedSector === template.sector ? 'border-primary ring-2 ring-primary/20' : ''
              }`}
              onClick={() => selectSeed(template.sector)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {SECTOR_LABELS[template.sector] || template.sector}
                  </Badge>
                </div>
                <CardDescription className="text-xs line-clamp-2">
                  {template.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{template.convenio}</span>
                  <a
                    href="#"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    Ver texto <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Convenio Name Override */}
      {state.selectedSeedSector && (
        <div className="space-y-2">
          <Label>Nombre del convenio aplicable (editable)</Label>
          <Input
            value={state.payload.meta?.convenio || ''}
            onChange={(e) => updateNestedPayload('meta', { convenio: e.target.value })}
            placeholder="Ej: Convenio Colectivo de Hostelería de Madrid"
          />
        </div>
      )}
    </div>
  );
}
