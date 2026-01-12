import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface HolidayImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportStats {
  total: number;
  inserted: number;
  skipped: number;
  errors: number;
  byLevel: {
    national: number;
    autonomous: number;
    local: number;
  };
}

export function HolidayImportDialog({ open, onOpenChange }: HolidayImportDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("2026");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!csvContent) {
        throw new Error("No se ha cargado ningún archivo CSV");
      }

      const { data, error } = await supabase.functions.invoke('import-holidays-csv', {
        body: {
          csvContent,
          year: parseInt(selectedYear),
          replaceExisting
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      setImportStats(data.stats);
      queryClient.invalidateQueries({ queryKey: ['global-national-holidays'] });
      toast.success(`Importación completada: ${data.stats.inserted} festivos añadidos`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error al importar festivos");
    }
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error("El archivo debe ser un CSV");
      return;
    }

    setSelectedFile(file);
    setImportStats(null);

    try {
      const content = await file.text();
      setCsvContent(content);
      toast.success(`Archivo cargado: ${file.name}`);
    } catch (err) {
      toast.error("Error al leer el archivo");
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setCsvContent("");
    setImportStats(null);
    onOpenChange(false);
  };

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1, currentYear + 2];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Festivos desde CSV
          </DialogTitle>
          <DialogDescription>
            Sube un archivo CSV con los festivos nacionales, autonómicos y locales.
            El formato debe incluir columnas: anio, fecha, nombre, nivel, comunidad_autonoma, provincia, municipio, isla, fuente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File upload */}
          <div className="space-y-2">
            <Label>Archivo CSV</Label>
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText className="h-4 w-4 mr-2" />
                {selectedFile ? selectedFile.name : "Seleccionar archivo..."}
              </Button>
            </div>
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>

          {/* Year filter */}
          <div className="space-y-2">
            <Label>Filtrar por año</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
                <SelectItem value="0">Todos los años</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Replace existing checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="replace"
              checked={replaceExisting}
              onCheckedChange={(checked) => setReplaceExisting(checked as boolean)}
            />
            <Label htmlFor="replace" className="text-sm">
              Reemplazar festivos existentes del año seleccionado
            </Label>
          </div>

          {/* CSV Preview */}
          {csvContent && (
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                CSV cargado correctamente. {csvContent.split('\n').length - 1} filas detectadas.
              </AlertDescription>
            </Alert>
          )}

          {/* Import results */}
          {importStats && (
            <Alert variant={importStats.errors > 0 ? "destructive" : "default"} className="bg-muted">
              {importStats.errors > 0 ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <AlertDescription className="space-y-1">
                <div className="font-medium">Resultados de la importación:</div>
                <ul className="text-sm space-y-0.5">
                  <li>✅ Insertados: {importStats.inserted}</li>
                  <li>⏭️ Omitidos (duplicados): {importStats.skipped}</li>
                  {importStats.errors > 0 && <li>❌ Errores: {importStats.errors}</li>}
                </ul>
                <div className="text-xs text-muted-foreground mt-2">
                  Por nivel: {importStats.byLevel.national} nacionales, {importStats.byLevel.autonomous} autonómicos, {importStats.byLevel.local} locales
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {importStats ? "Cerrar" : "Cancelar"}
          </Button>
          {!importStats && (
            <Button
              onClick={() => importMutation.mutate()}
              disabled={!csvContent || importMutation.isPending}
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
