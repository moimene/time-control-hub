import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download, RefreshCw, Loader2 } from 'lucide-react';
import type { Employee } from '@/types/database';

interface EmployeeQrDialogProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmployeeQrDialog({ employee, open, onOpenChange }: EmployeeQrDialogProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: qrData, isLoading } = useQuery({
    queryKey: ['employee-qr', employee?.id],
    queryFn: async () => {
      if (!employee) return null;
      const { data, error } = await supabase
        .from('employee_qr')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('is_active', true)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!employee && open,
  });

  const createQrMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      // Revoke existing QR
      await supabase
        .from('employee_qr')
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq('employee_id', employeeId)
        .eq('is_active', true);

      // Create new QR token
      const token = crypto.randomUUID();
      const tokenHash = await hashToken(token);
      
      const { data, error } = await supabase
        .from('employee_qr')
        .insert({
          employee_id: employeeId,
          token_hash: tokenHash,
          version: (qrData?.version || 0) + 1,
          is_active: true,
        })
        .select()
        .single();
      
      if (error) throw error;
      return { ...data, token }; // Return token for QR generation
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-qr', employee?.id] });
      toast({ title: 'Código QR generado correctamente' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  async function hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Generate QR Code using canvas
  useEffect(() => {
    if (!qrData || !employee || !canvasRef.current) return;

    const generateQR = async () => {
      // QR payload contains employee_id and version for validation
      const payload = JSON.stringify({
        eid: employee.id,
        v: qrData.version,
        h: qrData.token_hash.substring(0, 16), // Partial hash for verification
      });

      // Use a simple QR generation approach with canvas
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Generate QR using external API (for simplicity)
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payload)}`;
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        canvas.width = 350;
        canvas.height = 420;
        
        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw QR
        ctx.drawImage(img, 25, 25, 300, 300);
        
        // Add employee info
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${employee.first_name} ${employee.last_name}`, canvas.width / 2, 355);
        
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#666666';
        ctx.fillText(employee.employee_code, canvas.width / 2, 380);
        ctx.fillText(`v${qrData.version}`, canvas.width / 2, 400);
        
        setQrDataUrl(canvas.toDataURL('image/png'));
      };
      img.src = qrApiUrl;
    };

    generateQR();
  }, [qrData, employee]);

  const handleDownload = () => {
    if (!qrDataUrl || !employee) return;
    
    const link = document.createElement('a');
    link.download = `QR_${employee.employee_code}_${employee.last_name}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  const handleRegenerate = () => {
    if (employee && confirm('¿Regenerar el código QR? El código anterior dejará de funcionar.')) {
      createQrMutation.mutate(employee.id);
    }
  };

  const handleCreateNew = () => {
    if (employee) {
      createQrMutation.mutate(employee.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Código QR</DialogTitle>
          <DialogDescription>
            {employee?.first_name} {employee?.last_name} ({employee?.employee_code})
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <canvas ref={canvasRef} className="hidden" />
          
          {isLoading || createQrMutation.isPending ? (
            <div className="flex items-center justify-center h-[300px]">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : qrData && qrDataUrl ? (
            <>
              <img 
                src={qrDataUrl} 
                alt={`QR Code for ${employee?.first_name}`}
                className="rounded-lg border shadow-sm"
              />
              <div className="flex gap-2 w-full">
                <Button onClick={handleDownload} className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Descargar
                </Button>
                <Button variant="outline" onClick={handleRegenerate} aria-label="Regenerar código QR">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 py-8">
              <p className="text-muted-foreground text-center">
                Este empleado no tiene un código QR activo
              </p>
              <Button onClick={handleCreateNew}>
                Generar código QR
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
