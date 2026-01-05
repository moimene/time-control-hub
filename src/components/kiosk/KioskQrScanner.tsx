import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, QrCode, Camera } from 'lucide-react';

interface KioskQrScannerProps {
  onScan: (qrToken: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function KioskQrScanner({ onScan, onCancel, isLoading }: KioskQrScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    const startScanner = async () => {
      if (!containerRef.current) return;

      try {
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        const cameras = await Html5Qrcode.getCameras();
        if (cameras.length === 0) {
          setError('No se encontró ninguna cámara');
          setIsStarting(false);
          return;
        }

        // Prefer back camera
        const backCamera = cameras.find(
          cam => cam.label.toLowerCase().includes('back') || 
                 cam.label.toLowerCase().includes('trasera') ||
                 cam.label.toLowerCase().includes('environment')
        );
        const cameraId = backCamera?.id || cameras[0].id;

        await scanner.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          (decodedText) => {
            if (mounted && !isLoading) {
              scanner.stop().catch(console.error);
              onScan(decodedText);
            }
          },
          () => {
            // Ignore scan failures
          }
        );

        if (mounted) {
          setIsStarting(false);
        }
      } catch (err: any) {
        console.error('Scanner error:', err);
        if (mounted) {
          setError(err.message || 'Error al iniciar la cámara');
          setIsStarting(false);
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onScan, isLoading]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-4"
            onClick={onCancel}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <QrCode className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Escanear Código QR</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Scanner Container */}
          <div 
            ref={containerRef}
            className="relative aspect-square bg-muted rounded-lg overflow-hidden"
          >
            {isStarting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Camera className="h-12 w-12 text-muted-foreground animate-pulse mb-4" />
                <p className="text-muted-foreground">Iniciando cámara...</p>
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                <p className="text-destructive text-center">{error}</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => window.location.reload()}
                >
                  Reintentar
                </Button>
              </div>
            )}
            <div id="qr-reader" className="w-full h-full" />
          </div>

          {isLoading && (
            <div className="text-center text-muted-foreground">
              Procesando fichaje...
            </div>
          )}

          <p className="text-center text-muted-foreground text-sm">
            Coloca tu código QR frente a la cámara
          </p>

          <Button
            variant="outline"
            className="w-full"
            onClick={onCancel}
          >
            Cancelar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
