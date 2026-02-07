import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, FileText, Image, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadedFile {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
}

interface JustificationUploadProps {
  companyId: string;
  employeeId: string;
  requestId?: string;
  onFilesChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  acceptedTypes?: string[];
  required?: boolean;
  isMedical?: boolean;
}

export function JustificationUpload({
  companyId,
  employeeId,
  requestId,
  onFilesChange,
  maxFiles = 5,
  acceptedTypes = ['application/pdf', 'image/jpeg', 'image/png'],
  required = false,
  isMedical = false
}: JustificationUploadProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const bucket = isMedical ? 'medical-docs' : 'absence-justifications';

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const uploadFile = async (file: File): Promise<UploadedFile | null> => {
    // Validate file type
    if (!acceptedTypes.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Tipo de archivo no permitido',
        description: `Solo se permiten: ${acceptedTypes.map(t => t.split('/')[1]).join(', ')}`
      });
      return null;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Archivo demasiado grande',
        description: 'El tamaño máximo es 10MB'
      });
      return null;
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${companyId}/${employeeId}/${requestId || 'temp'}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Upload error:', error);
      toast({
        variant: 'destructive',
        title: 'Error al subir archivo',
        description: error.message
      });
      return null;
    }

    return {
      id: data.path,
      name: file.name,
      path: data.path,
      size: file.size,
      type: file.type
    };
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    await processFiles(droppedFiles);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files);
    await processFiles(selectedFiles);
    e.target.value = '';
  };

  const processFiles = async (newFiles: File[]) => {
    if (files.length + newFiles.length > maxFiles) {
      toast({
        variant: 'destructive',
        title: 'Límite de archivos',
        description: `Máximo ${maxFiles} archivos permitidos`
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const uploadedFiles: UploadedFile[] = [];
    for (let i = 0; i < newFiles.length; i++) {
      const uploaded = await uploadFile(newFiles[i]);
      if (uploaded) {
        uploadedFiles.push(uploaded);
      }
      setUploadProgress(((i + 1) / newFiles.length) * 100);
    }

    const allFiles = [...files, ...uploadedFiles];
    setFiles(allFiles);
    onFilesChange(allFiles);
    setUploading(false);
  };

  const removeFile = async (fileToRemove: UploadedFile) => {
    // Remove from storage
    await supabase.storage.from(bucket).remove([fileToRemove.path]);
    
    const newFiles = files.filter(f => f.id !== fileToRemove.id);
    setFiles(newFiles);
    onFilesChange(newFiles);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
          uploading && "pointer-events-none opacity-50"
        )}
      >
        {uploading ? (
          <div className="space-y-2">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Subiendo archivos...</p>
            <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
              Arrastra archivos aquí o{' '}
              <label className="text-primary cursor-pointer hover:underline">
                selecciona
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept={acceptedTypes.join(',')}
                  onChange={handleFileSelect}
                />
              </label>
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, JPG o PNG (máx. {maxFiles} archivos, 10MB cada uno)
            </p>
          </>
        )}
      </div>

      {/* Required indicator */}
      {required && files.length === 0 && (
        <p className="text-sm text-destructive">* Se requiere al menos un justificante</p>
      )}

      {/* Uploaded files list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(file => (
            <div
              key={file.id}
              className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getFileIcon(file.type)}
                <span className="text-sm truncate">{file.name}</span>
                <Badge variant="outline" className="text-xs shrink-0">
                  {formatFileSize(file.size)}
                </Badge>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeFile(file)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
