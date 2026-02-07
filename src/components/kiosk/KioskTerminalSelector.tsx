import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Monitor, MapPin, Loader2, Building2, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Terminal {
  id: string;
  name: string;
  location: string | null;
}

interface KioskTerminalSelectorProps {
  onSelect: (terminalId: string) => void;
  companyName: string;
  deviceToken: string;
  onLogout: () => void;
}

export function KioskTerminalSelector({ onSelect, companyName, deviceToken, onLogout }: KioskTerminalSelectorProps) {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    const fetchTerminals = async () => {
      try {
        const { data, error: invokeError } = await supabase.functions.invoke('kiosk-auth', {
          body: { action: 'list_terminals', deviceToken },
        });

        if (invokeError) throw invokeError;
        if (data?.error) throw new Error(data.error);

        setTerminals(data?.terminals || []);
      } catch (err) {
        console.error('Error fetching terminals:', err);
        setError('Error al cargar los terminales');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTerminals();
  }, [deviceToken]);

  const handleSelect = async (terminalId: string) => {
    setSelecting(terminalId);
    await onSelect(terminalId);
    setSelecting(null);
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
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()}>Reintentar</Button>
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar sesión
          </Button>
        </div>
      </div>
    );
  }

  if (terminals.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col items-center justify-center p-4">
        <Monitor className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-xl font-medium mb-2">No hay terminales disponibles</p>
        <p className="text-muted-foreground mb-6 text-center">
          No hay terminales activos configurados para {companyName}.
          <br />
          Contacta con el administrador para configurar un terminal.
        </p>
        <Button variant="outline" onClick={onLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Cerrar sesión
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Building2 className="h-6 w-6 text-primary" />
          <span className="text-lg font-medium text-primary">{companyName}</span>
        </div>
        <div className="flex items-center justify-center gap-3 mb-4">
          <Monitor className="h-10 w-10 text-primary" />
          <h1 className="text-3xl font-bold">Selecciona Terminal</h1>
        </div>
        <p className="text-muted-foreground">
          Elige el terminal de fichaje para esta ubicación
        </p>
      </div>

      <div className="w-full max-w-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {terminals.map((terminal) => (
            <Card
              key={terminal.id}
              className={`cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg hover:border-primary ${
                selecting === terminal.id ? 'border-primary' : ''
              }`}
              onClick={() => !selecting && handleSelect(terminal.id)}
            >
              <CardContent className="flex items-center gap-4 p-6">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {selecting === terminal.id ? (
                    <Loader2 className="h-7 w-7 text-primary animate-spin" />
                  ) : (
                    <Monitor className="h-7 w-7 text-primary" />
                  )}
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

      <div className="mt-8 flex flex-col items-center gap-3">
        <div className="text-xs text-muted-foreground">
          Esta selección se guardará para futuras sesiones
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={onLogout}
        >
          <LogOut className="h-3 w-3 mr-1" />
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
