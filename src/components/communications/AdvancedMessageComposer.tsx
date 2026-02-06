import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Send, X, Clock, Users, User, Building2, FileText, 
  Shield, CalendarIcon, Paperclip, Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const threadTypes = [
  { value: 'informativa', label: 'Informativa', description: 'Avisos generales, noticias' },
  { value: 'notificacion', label: 'Notificación oficial', description: 'Cambios de turno, políticas' },
  { value: 'requerimiento', label: 'Requerimiento', description: 'Solicitud de documentos' },
  { value: 'formal', label: 'Comunicación formal', description: 'Amonestaciones, sanciones' },
  { value: 'convocatoria', label: 'Convocatoria', description: 'Reuniones, formaciones' },
  { value: 'encuesta', label: 'Encuesta/Formulario', description: 'Consultas, evaluaciones' },
];

const certificationLevels = [
  { value: 'none', label: 'Sin certificar', description: 'Sin sello QTSP' },
  { value: 'basic', label: 'Básica', description: 'Sello de envío' },
  { value: 'complete', label: 'Completa', description: 'Envío + lectura + respuesta' },
  { value: 'reinforced', label: 'Reforzada', description: 'Con firma del empleado' },
];

const messageSchema = z.object({
  subject: z.string().min(1, 'El asunto es requerido').max(200),
  body: z.string().min(1, 'El mensaje es requerido'),
  thread_type: z.string().default('notificacion'),
  priority: z.enum(['baja', 'normal', 'alta', 'urgente']),
  audience_type: z.enum(['all', 'department', 'individual', 'custom']),
  audience_department: z.string().optional(),
  audience_employee_ids: z.array(z.string()).optional(),
  requires_read_confirmation: z.boolean(),
  requires_response: z.boolean(),
  requires_signature: z.boolean(),
  response_deadline: z.date().optional(),
  certification_level: z.string().default('complete'),
  send_now: z.boolean().default(true),
  scheduled_at: z.date().optional(),
});

export type AdvancedMessageFormData = z.infer<typeof messageSchema>;

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  department: string | null;
}

interface AdvancedMessageComposerProps {
  employees?: Employee[];
  departments?: string[];
  onSubmit: (data: AdvancedMessageFormData) => Promise<void>;
  onCancel: () => void;
  onSaveDraft?: (data: AdvancedMessageFormData) => Promise<void>;
  isSubmitting?: boolean;
  templates?: Array<{ id: string; name: string; subject_template: string; body_template: string }>;
}

export function AdvancedMessageComposer({
  employees = [],
  departments = [],
  onSubmit,
  onCancel,
  onSaveDraft,
  isSubmitting = false,
  templates = [],
}: AdvancedMessageComposerProps) {
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const form = useForm<AdvancedMessageFormData>({
    resolver: zodResolver(messageSchema),
    defaultValues: {
      subject: '',
      body: '',
      thread_type: 'notificacion',
      priority: 'normal',
      audience_type: 'all',
      requires_read_confirmation: true,
      requires_response: false,
      requires_signature: false,
      certification_level: 'complete',
      send_now: true,
    },
  });

  const audienceType = form.watch('audience_type');
  const sendNow = form.watch('send_now');
  const threadType = form.watch('thread_type');
  const requiresResponse = form.watch('requires_response');
  const requiresSignature = form.watch('requires_signature');

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      form.setValue('subject', template.subject_template);
      form.setValue('body', template.body_template);
    }
  };

  const handleEmployeeToggle = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
    form.setValue('audience_employee_ids', 
      selectedEmployees.includes(employeeId)
        ? selectedEmployees.filter(id => id !== employeeId)
        : [...selectedEmployees, employeeId]
    );
  };

	  const getRecipientCount = () => {
	    switch (audienceType) {
	      case 'all':
	        return employees.length;
	      case 'department': {
	        const dept = form.watch('audience_department');
	        return employees.filter(e => e.department === dept).length;
	      }
	      case 'individual':
	      case 'custom':
	        return selectedEmployees.length;
	      default:
	        return 0;
    }
  };

  const handleSubmit = async (data: AdvancedMessageFormData) => {
    data.audience_employee_ids = selectedEmployees;
    await onSubmit(data);
  };

  return (
    <Card className="h-[calc(100vh-220px)] flex flex-col">
      <CardHeader className="pb-2 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">Nueva Comunicación Certificada</CardTitle>
            <Badge variant="outline" className="gap-1">
              <Shield className="h-3 w-3" />
              QTSP
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowPreview(!showPreview)}>
              <Eye className="h-4 w-4 mr-1" />
              {showPreview ? 'Editar' : 'Previsualizar'}
            </Button>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <ScrollArea className="flex-1">
        <CardContent className="p-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <Tabs defaultValue="content" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="content">Contenido</TabsTrigger>
                  <TabsTrigger value="recipients">Destinatarios</TabsTrigger>
                  <TabsTrigger value="settings">Configuración</TabsTrigger>
                </TabsList>

                <TabsContent value="content" className="space-y-4 mt-4">
                  {/* Thread Type */}
                  <FormField
                    control={form.control}
                    name="thread_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de comunicación</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {threadTypes.map(type => (
                              <SelectItem key={type.value} value={type.value}>
                                <div className="flex flex-col">
                                  <span>{type.label}</span>
                                  <span className="text-xs text-muted-foreground">{type.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  {/* Template selector */}
                  {templates.length > 0 && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <Select onValueChange={handleTemplateSelect}>
                        <SelectTrigger className="w-[250px]">
                          <SelectValue placeholder="Usar plantilla..." />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Subject */}
                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asunto</FormLabel>
                        <FormControl>
                          <Input placeholder="Asunto de la comunicación" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Body */}
                  <FormField
                    control={form.control}
                    name="body"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contenido</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Escribe el contenido del mensaje..."
                            className="min-h-[200px] font-mono text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Variables disponibles: {"{{nombre}}"}, {"{{centro}}"}, {"{{fecha}}"}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Priority */}
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prioridad</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="baja">🔵 Baja</SelectItem>
                            <SelectItem value="normal">⚪ Normal</SelectItem>
                            <SelectItem value="alta">🟡 Alta</SelectItem>
                            <SelectItem value="urgente">🔴 Urgente</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="recipients" className="space-y-4 mt-4">
                  {/* Audience Type */}
                  <FormField
                    control={form.control}
                    name="audience_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Destinatarios</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona destinatarios" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="all">
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Todos los empleados ({employees.length})
                              </div>
                            </SelectItem>
                            <SelectItem value="department">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                Por departamento
                              </div>
                            </SelectItem>
                            <SelectItem value="individual">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                Selección manual
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  {/* Department selector */}
                  {audienceType === 'department' && (
                    <FormField
                      control={form.control}
                      name="audience_department"
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
                              {departments.map(dept => (
                                <SelectItem key={dept} value={dept}>
                                  {dept} ({employees.filter(e => e.department === dept).length})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Individual employee selector */}
                  {(audienceType === 'individual' || audienceType === 'custom') && (
                    <div className="space-y-2">
                      <FormLabel>Empleados seleccionados ({selectedEmployees.length})</FormLabel>
                      <ScrollArea className="h-[200px] border rounded-md p-2">
                        <div className="space-y-1">
                          {employees.map(emp => (
                            <div
                              key={emp.id}
                              onClick={() => handleEmployeeToggle(emp.id)}
                              className={cn(
                                'flex items-center justify-between p-2 rounded cursor-pointer transition-colors',
                                selectedEmployees.includes(emp.id)
                                  ? 'bg-primary/10 border border-primary/20'
                                  : 'hover:bg-muted'
                              )}
                            >
                              <span className="text-sm">
                                {emp.first_name} {emp.last_name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {emp.department || 'Sin departamento'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {/* Recipient summary */}
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">
                      Se enviará a <strong>{getRecipientCount()}</strong> destinatarios
                    </span>
                  </div>
                </TabsContent>

                <TabsContent value="settings" className="space-y-4 mt-4">
                  {/* Requirements */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Requisitos</h4>
                    
                    <FormField
                      control={form.control}
                      name="requires_read_confirmation"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <FormLabel className="text-sm">Confirmación de lectura</FormLabel>
                            <FormDescription className="text-xs">
                              El empleado debe confirmar que ha leído el mensaje
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="requires_response"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <FormLabel className="text-sm">Requiere respuesta</FormLabel>
                            <FormDescription className="text-xs">
                              El empleado debe responder al mensaje
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="requires_signature"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <FormLabel className="text-sm">Requiere firma</FormLabel>
                            <FormDescription className="text-xs">
                              El empleado debe firmar el documento
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Response deadline */}
                  {(requiresResponse || requiresSignature) && (
                    <FormField
                      control={form.control}
                      name="response_deadline"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Plazo de respuesta</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button variant="outline" className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}>
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {field.value ? format(field.value, 'PPP', { locale: es }) : 'Seleccionar fecha'}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date < new Date()}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Certification level */}
                  <FormField
                    control={form.control}
                    name="certification_level"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nivel de certificación QTSP</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {certificationLevels.map(level => (
                              <SelectItem key={level.value} value={level.value}>
                                <div className="flex flex-col">
                                  <span>{level.label}</span>
                                  <span className="text-xs text-muted-foreground">{level.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  {/* Scheduling */}
                  <div className="space-y-3 pt-2 border-t">
                    <h4 className="text-sm font-medium">Programación</h4>
                    
                    <FormField
                      control={form.control}
                      name="send_now"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <FormLabel className="text-sm">Enviar ahora</FormLabel>
                            <FormDescription className="text-xs">
                              Desactiva para programar el envío
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {!sendNow && (
                      <FormField
                        control={form.control}
                        name="scheduled_at"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fecha de envío programado</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant="outline" className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}>
                                    <Clock className="mr-2 h-4 w-4" />
                                    {field.value ? format(field.value, 'PPP HH:mm', { locale: es }) : 'Seleccionar fecha y hora'}
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) => date < new Date()}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              {/* Actions */}
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  Certificación: {certificationLevels.find(l => l.value === form.watch('certification_level'))?.label}
                </div>
                <div className="flex gap-2">
                  {onSaveDraft && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => onSaveDraft(form.getValues())}
                    >
                      Guardar borrador
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={onCancel}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting || getRecipientCount() === 0}>
                    <Send className="h-4 w-4 mr-2" />
                    {isSubmitting ? 'Enviando...' : sendNow ? 'Enviar ahora' : 'Programar envío'}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
