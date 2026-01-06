import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, X } from 'lucide-react';

const messageSchema = z.object({
  subject: z.string().min(1, 'El asunto es requerido').max(200),
  body: z.string().min(1, 'El mensaje es requerido'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  recipient_type: z.enum(['company', 'employee', 'department', 'all_employees']),
  recipient_employee_id: z.string().optional(),
  recipient_department: z.string().optional(),
  requires_acknowledgment: z.boolean(),
});

export type MessageFormData = z.infer<typeof messageSchema>;

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  department: string | null;
}

interface MessageComposerProps {
  mode: 'admin' | 'employee';
  employees?: Employee[];
  departments?: string[];
  replyTo?: {
    id: string;
    subject: string;
    sender_name: string;
  };
  onSubmit: (data: MessageFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function MessageComposer({
  mode,
  employees = [],
  departments = [],
  replyTo,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: MessageComposerProps) {
  const form = useForm<MessageFormData>({
    resolver: zodResolver(messageSchema),
    defaultValues: {
      subject: replyTo ? `Re: ${replyTo.subject}` : '',
      body: '',
      priority: 'normal',
      recipient_type: mode === 'employee' ? 'company' : 'all_employees',
      requires_acknowledgment: false,
    },
  });

  const recipientType = form.watch('recipient_type');

  const handleSubmit = async (data: MessageFormData) => {
    await onSubmit(data);
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {replyTo ? 'Responder mensaje' : 'Nuevo mensaje'}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {replyTo && (
          <p className="text-sm text-muted-foreground">
            Respondiendo a: {replyTo.sender_name}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {mode === 'admin' && !replyTo && (
              <>
                <FormField
                  control={form.control}
                  name="recipient_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Destinatario</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona destinatario" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all_employees">Todos los empleados</SelectItem>
                          <SelectItem value="department">Departamento</SelectItem>
                          <SelectItem value="employee">Empleado específico</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {recipientType === 'employee' && (
                  <FormField
                    control={form.control}
                    name="recipient_employee_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Empleado</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona empleado" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {employees.map((emp) => (
                              <SelectItem key={emp.id} value={emp.id}>
                                {emp.first_name} {emp.last_name}
                                {emp.department && ` (${emp.department})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {recipientType === 'department' && (
                  <FormField
                    control={form.control}
                    name="recipient_department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departamento</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona departamento" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {departments.map((dept) => (
                              <SelectItem key={dept} value={dept}>
                                {dept}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </>
            )}

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
                      className="min-h-[150px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mode === 'admin' && (
              <div className="flex flex-wrap gap-6">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem className="flex-1 min-w-[200px]">
                      <FormLabel>Prioridad</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Baja</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                          <SelectItem value="urgent">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requires_acknowledgment"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 flex-1 min-w-[200px]">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Confirmación de lectura</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          El empleado debe confirmar que ha leído el mensaje
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
