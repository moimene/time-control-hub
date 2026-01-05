import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Check, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const TestCredentials = () => {
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [setupResult, setSetupResult] = useState<Record<string, unknown> | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(label);
    toast.success(`${label} copiado`);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const runSetupTestData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('setup-test-data');
      if (error) throw error;
      setSetupResult(data);
      toast.success('Datos de prueba creados correctamente');
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const CopyButton = ({ text, label }: { text: string; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => copyToClipboard(text, label)}
      className="h-6 w-6 p-0"
    >
      {copiedItem === label ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Credenciales de Prueba</h1>
            <p className="text-muted-foreground mt-1">
              Datos de acceso para testing de todas las historias de usuario
            </p>
          </div>
          <Button onClick={runSetupTestData} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Ejecutar setup-test-data
          </Button>
        </div>

        {setupResult && (
          <Card className="border-green-500/50 bg-green-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-green-600">✅ Setup completado</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs overflow-auto max-h-48">
                {JSON.stringify(setupResult, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="superadmin" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="superadmin">Super Admin</TabsTrigger>
            <TabsTrigger value="admin">Admin</TabsTrigger>
            <TabsTrigger value="responsible">Responsable</TabsTrigger>
            <TabsTrigger value="employee">Empleado</TabsTrigger>
            <TabsTrigger value="kiosk">Kiosk</TabsTrigger>
          </TabsList>

          <TabsContent value="superadmin" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Super Administrador
                  <Badge variant="destructive">Acceso Total</Badge>
                </CardTitle>
                <CardDescription>
                  Gestión de todas las empresas y usuarios del sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Password</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-mono">admin@test.com</TableCell>
                      <TableCell className="font-mono">admin123</TableCell>
                      <TableCell><Badge variant="outline">/super-admin</Badge></TableCell>
                      <TableCell>
                        <CopyButton text="admin@test.com" label="super-email-1" />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono">superadmin@timecontrol.com</TableCell>
                      <TableCell className="font-mono">super123</TableCell>
                      <TableCell><Badge variant="outline">/super-admin</Badge></TableCell>
                      <TableCell>
                        <CopyButton text="superadmin@timecontrol.com" label="super-email-2" />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admin" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Administradores de Empresa
                  <Badge>Gestión Completa</Badge>
                </CardTitle>
                <CardDescription>
                  Un administrador por cada empresa de prueba
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Password</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Bar El Rincón</Badge></TableCell>
                      <TableCell className="font-mono">admin@elrincon.com</TableCell>
                      <TableCell className="font-mono">bar123</TableCell>
                      <TableCell><CopyButton text="admin@elrincon.com" label="admin-bar" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Zapatería López</Badge></TableCell>
                      <TableCell className="font-mono">admin@zapateria-lopez.com</TableCell>
                      <TableCell className="font-mono">zap123</TableCell>
                      <TableCell><CopyButton text="admin@zapateria-lopez.com" label="admin-zap" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Clínica Dental Sonrisas</Badge></TableCell>
                      <TableCell className="font-mono">admin@dentalsonrisas.com</TableCell>
                      <TableCell className="font-mono">den123</TableCell>
                      <TableCell><CopyButton text="admin@dentalsonrisas.com" label="admin-den" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Fisioterapia Wellness</Badge></TableCell>
                      <TableCell className="font-mono">admin@fisio-wellness.com</TableCell>
                      <TableCell className="font-mono">fis123</TableCell>
                      <TableCell><CopyButton text="admin@fisio-wellness.com" label="admin-fis" /></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="responsible" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Responsables
                  <Badge variant="outline">Supervisión</Badge>
                </CardTitle>
                <CardDescription>
                  Pueden ver fichajes y aprobar/rechazar correcciones
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Password</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Bar El Rincón</Badge></TableCell>
                      <TableCell className="font-mono">responsable@elrincon.com</TableCell>
                      <TableCell className="font-mono">resp123</TableCell>
                      <TableCell><CopyButton text="responsable@elrincon.com" label="resp-bar" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Zapatería López</Badge></TableCell>
                      <TableCell className="font-mono">responsable@zapateria-lopez.com</TableCell>
                      <TableCell className="font-mono">resp123</TableCell>
                      <TableCell><CopyButton text="responsable@zapateria-lopez.com" label="resp-zap" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Clínica Dental Sonrisas</Badge></TableCell>
                      <TableCell className="font-mono">responsable@dentalsonrisas.com</TableCell>
                      <TableCell className="font-mono">resp123</TableCell>
                      <TableCell><CopyButton text="responsable@dentalsonrisas.com" label="resp-den" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Fisioterapia Wellness</Badge></TableCell>
                      <TableCell className="font-mono">responsable@fisio-wellness.com</TableCell>
                      <TableCell className="font-mono">resp123</TableCell>
                      <TableCell><CopyButton text="responsable@fisio-wellness.com" label="resp-fis" /></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="employee" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Empleados con Portal
                  <Badge variant="outline">Acceso Personal</Badge>
                </CardTitle>
                <CardDescription>
                  Pueden ver sus fichajes y solicitar correcciones
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Password</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Bar El Rincón</Badge></TableCell>
                      <TableCell className="font-mono">juan.martinez@elrincon.com</TableCell>
                      <TableCell className="font-mono">BAR001</TableCell>
                      <TableCell className="font-mono">emp123</TableCell>
                      <TableCell><CopyButton text="juan.martinez@elrincon.com" label="emp-bar1" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Bar El Rincón</Badge></TableCell>
                      <TableCell className="font-mono">ana.lopez@elrincon.com</TableCell>
                      <TableCell className="font-mono">BAR002</TableCell>
                      <TableCell className="font-mono">emp123</TableCell>
                      <TableCell><CopyButton text="ana.lopez@elrincon.com" label="emp-bar2" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Zapatería López</Badge></TableCell>
                      <TableCell className="font-mono">lucia.moreno@zapateria-lopez.com</TableCell>
                      <TableCell className="font-mono">ZAP001</TableCell>
                      <TableCell className="font-mono">emp123</TableCell>
                      <TableCell><CopyButton text="lucia.moreno@zapateria-lopez.com" label="emp-zap" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Clínica Dental</Badge></TableCell>
                      <TableCell className="font-mono">alberto.ruiz@dentalsonrisas.com</TableCell>
                      <TableCell className="font-mono">DEN001</TableCell>
                      <TableCell className="font-mono">emp123</TableCell>
                      <TableCell><CopyButton text="alberto.ruiz@dentalsonrisas.com" label="emp-den" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Fisioterapia</Badge></TableCell>
                      <TableCell className="font-mono">david.molina@fisio-wellness.com</TableCell>
                      <TableCell className="font-mono">FIS001</TableCell>
                      <TableCell className="font-mono">emp123</TableCell>
                      <TableCell><CopyButton text="david.molina@fisio-wellness.com" label="emp-fis" /></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="kiosk" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Kiosk - Fichaje por PIN
                  <Badge variant="outline">/kiosk</Badge>
                </CardTitle>
                <CardDescription>
                  Códigos de empleado y PINs para fichaje en terminal
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>PIN</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Bar El Rincón</Badge></TableCell>
                      <TableCell className="font-mono font-bold">BAR001</TableCell>
                      <TableCell className="font-mono font-bold">1234</TableCell>
                      <TableCell>Juan Martínez</TableCell>
                      <TableCell><CopyButton text="BAR001" label="kiosk-bar1" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Bar El Rincón</Badge></TableCell>
                      <TableCell className="font-mono font-bold">BAR002</TableCell>
                      <TableCell className="font-mono font-bold">2345</TableCell>
                      <TableCell>Ana López</TableCell>
                      <TableCell><CopyButton text="BAR002" label="kiosk-bar2" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Zapatería López</Badge></TableCell>
                      <TableCell className="font-mono font-bold">ZAP001</TableCell>
                      <TableCell className="font-mono font-bold">1111</TableCell>
                      <TableCell>Lucía Moreno</TableCell>
                      <TableCell><CopyButton text="ZAP001" label="kiosk-zap" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Clínica Dental</Badge></TableCell>
                      <TableCell className="font-mono font-bold">DEN001</TableCell>
                      <TableCell className="font-mono font-bold">1212</TableCell>
                      <TableCell>Dr. Alberto Ruiz</TableCell>
                      <TableCell><CopyButton text="DEN001" label="kiosk-den" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Fisioterapia</Badge></TableCell>
                      <TableCell className="font-mono font-bold">FIS001</TableCell>
                      <TableCell className="font-mono font-bold">6666</TableCell>
                      <TableCell>David Molina</TableCell>
                      <TableCell><CopyButton text="FIS001" label="kiosk-fis" /></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Todos los PINs por Empresa</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Bar El Rincón</h4>
                  <ul className="text-sm font-mono space-y-1">
                    <li>BAR001: 1234</li>
                    <li>BAR002: 2345</li>
                    <li>BAR003: 3456</li>
                    <li>BAR004: 4567</li>
                    <li>BAR005: 5678</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Zapatería López</h4>
                  <ul className="text-sm font-mono space-y-1">
                    <li>ZAP001: 1111</li>
                    <li>ZAP002: 2222</li>
                    <li>ZAP003: 3333</li>
                    <li>ZAP004: 4444</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Clínica Dental Sonrisas</h4>
                  <ul className="text-sm font-mono space-y-1">
                    <li>DEN001: 1212</li>
                    <li>DEN002: 2323</li>
                    <li>DEN003: 3434</li>
                    <li>DEN004: 4545</li>
                    <li>DEN005: 5656</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Fisioterapia Wellness</h4>
                  <ul className="text-sm font-mono space-y-1">
                    <li>FIS001: 6666</li>
                    <li>FIS002: 7777</li>
                    <li>FIS003: 8888</li>
                    <li>FIS004: 9999</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>Historias de Usuario Cubiertas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">Empleado</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>✅ Fichar entrada/salida con QR</li>
                  <li>✅ Fichar con código+PIN</li>
                  <li>✅ Ver historial de fichajes</li>
                  <li>✅ Solicitar corrección</li>
                  <li>✅ Ver estado de solicitudes</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Admin/Responsable</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>✅ Dashboard tiempo real</li>
                  <li>✅ Gestionar empleados</li>
                  <li>✅ Aprobar/rechazar correcciones</li>
                  <li>✅ Generar reportes sellados</li>
                  <li>✅ Ver calendario QTSP</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Super Admin</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>✅ Ver todas las empresas</li>
                  <li>✅ Gestionar usuarios cross-tenant</li>
                  <li>✅ Estadísticas globales</li>
                  <li>✅ Configurar QTSP</li>
                  <li>✅ Auditoría del sistema</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TestCredentials;
