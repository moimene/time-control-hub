import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Send, X, Building2 } from 'lucide-react';

const employeeMessageSchema = z.object({
  subject: z.string().min(1, 'El asunto es requerido').max(200),
  body: z.string().min(1, 'El mensaje es requerido'),
  category: z.string().optional(),
});

type EmployeeMessageFormData = z.infer<typeof employeeMessageSchema>;

interface EmployeeMessageComposerProps {
  onSubmit: (data: EmployeeMessageFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const messageCategories = [
  { value: 'consulta', label: 'Consulta general' },
  { value: 'solicitud', label: 'Solicitud' },
  { value: 'incidencia', label: 'Incidencia' },
  { value: 'sugerencia', label: 'Sugerencia' },
  { value: 'otro', label: 'Otro' },
];

export function EmployeeMessageComposer({
  onSubmit,
  onCancel,
  isSubmitting = false,
}: EmployeeMessageComposerProps) {
  const form = useForm<EmployeeMessageFormData>({
    resolver: zodResolver(employeeMessageSchema),
    defaultValues: {
      subject: '',
      body: '',
      category: 'consulta',
    },
  });

  const handleSubmit = async (data: EmployeeMessageFormData) => {
    await onSubmit(data);
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Nuevo mensaje</CardTitle>
              <CardDescription>Enviar comunicación a la empresa</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona categoría" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {messageCategories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asunto</FormLabel>
                  <FormControl>
                    <Input placeholder="Asunto del mensaje" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mensaje</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Escribe tu mensaje..."
                      className="min-h-[200px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Enviando...' : 'Enviar mensaje'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
