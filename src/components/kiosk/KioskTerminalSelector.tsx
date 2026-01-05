import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Monitor, Building2, MapPin, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Terminal {
  id: string;
  name: string;
  location: string | null;
  company_name: string;
  employee_code_prefix: string;
}

interface KioskTerminalSelectorProps {
  onSelect: (terminalId: string) => void;
  savedTerminalId?: string | null;
}

export function KioskTerminalSelector({ onSelect, savedTerminalId }: KioskTerminalSelectorProps) {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTerminals = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('terminals')
          .select(`
            id,
            name,
            location,
            company:company_id (
              name,
              employee_code_prefix
            )
          `)
          .eq('status', 'active')
          .order('name');

        if (fetchError) throw fetchError;

        const formattedTerminals: Terminal[] = (data || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          location: t.location,
          company_name: t.company?.name || 'Sin empresa',
          employee_code_prefix: t.company?.employee_code_prefix || 'EMP',
        }));

        setTerminals(formattedTerminals);

        // If there's a saved terminal and it exists, auto-select it
        if (savedTerminalId && formattedTerminals.some(t => t.id === savedTerminalId)) {
          onSelect(savedTerminalId);
        }
      } catch (err) {
        console.error('Error fetching terminals:', err);
        setError('Error al cargar los terminales');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTerminals();
  }, [savedTerminalId, onSelect]);

  const handleSelect = (terminalId: string) => {
    // Save to localStorage for persistence
    localStorage.setItem('kiosk_terminal_id', terminalId);
    onSelect(terminalId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col items-center justify-center p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Cargando terminales...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col items-center justify-center p-4">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={() => window.location.reload()}>Reintentar</Button>
      </div>
    );
  }

  if (terminals.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col items-center justify-center p-4">
        <Monitor className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-xl font-medium mb-2">No hay terminales disponibles</p>
        <p className="text-muted-foreground">Contacta con el administrador para configurar un terminal.</p>
      </div>
    );
  }

  // Group terminals by company
  const terminalsByCompany = terminals.reduce((acc, terminal) => {
    if (!acc[terminal.company_name]) {
      acc[terminal.company_name] = [];
    }
    acc[terminal.company_name].push(terminal);
    return acc;
  }, {} as Record<string, Terminal[]>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Monitor className="h-10 w-10 text-primary" />
          <h1 className="text-3xl font-bold">Selecciona Terminal</h1>
        </div>
        <p className="text-muted-foreground">
          Elige el terminal de fichaje para esta ubicación
        </p>
      </div>

      <div className="w-full max-w-3xl space-y-6">
        {Object.entries(terminalsByCompany).map(([companyName, companyTerminals]) => (
          <div key={companyName}>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">{companyName}</h2>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">
                {companyTerminals[0].employee_code_prefix}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {companyTerminals.map((terminal) => (
                <Card
                  key={terminal.id}
                  className="cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg hover:border-primary"
                  onClick={() => handleSelect(terminal.id)}
                >
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Monitor className="h-7 w-7 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{terminal.name}</h3>
                      {terminal.location && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{terminal.location}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 text-xs text-muted-foreground">
        Esta selección se guardará para futuras sesiones
      </div>
    </div>
  );
}
