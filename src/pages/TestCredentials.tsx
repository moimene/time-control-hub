import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Check, RefreshCw, Shield, Users, Building2, UserCircle, Monitor } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const TestCredentials = () => {
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(label);
      toast.success(`${label} copiado`);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed-v1-fixtures');
      if (error) throw error;
      toast.success("Datos de prueba regenerados correctamente");
    } catch (err) {
      console.error(err);
      toast.error("Error al regenerar datos de prueba");
    } finally {
      setIsRegenerating(false);
    }
  };

  const renderCopyButton = (text: string, label: string) => (
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
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Credenciales de Prueba</h1>
            <p className="text-muted-foreground mt-1">
              Datos de acceso para testing de todas las historias de usuario V1
            </p>
          </div>
          <Button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`} />
            Regenerar Datos de Prueba
          </Button>
        </div>

        <Tabs defaultValue="superadmin" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="superadmin" className="gap-2"><Shield className="h-4 w-4" /> Super Admin</TabsTrigger>
            <TabsTrigger value="admin" className="gap-2"><Building2 className="h-4 w-4" /> Admin</TabsTrigger>
            <TabsTrigger value="responsible" className="gap-2"><Users className="h-4 w-4" /> Responsable</TabsTrigger>
            <TabsTrigger value="employee" className="gap-2"><UserCircle className="h-4 w-4" /> Empleado</TabsTrigger>
            <TabsTrigger value="kiosk" className="gap-2"><Monitor className="h-4 w-4" /> Kiosk</TabsTrigger>
            <TabsTrigger value="additional">Otros</TabsTrigger>
          </TabsList>

          <TabsContent value="superadmin" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Super Administradores
                  <Badge variant="destructive">Acceso Total</Badge>
                </CardTitle>
                <CardDescription>
                  Gestión global del sistema (Super Admin)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Password</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-mono">superadmin@timecontrol.com</TableCell>
                      <TableCell className="font-mono">super123</TableCell>
                      <TableCell>{renderCopyButton("superadmin@timecontrol.com", "sa-1")}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono">admin@test.com</TableCell>
                      <TableCell className="font-mono">admin123</TableCell>
                      <TableCell>{renderCopyButton("admin@test.com", "sa-2")}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono">moises.menendez@icam.es</TableCell>
                      <TableCell className="font-mono text-muted-foreground italic">Consultar manual</TableCell>
                      <TableCell>{renderCopyButton("moises.menendez@icam.es", "sa-3")}</TableCell>
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
                  Acceso administrativo para cada una de las 4 empresas de prueba
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
                      <TableCell>{renderCopyButton("admin@elrincon.com", "adm-bar")}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Zapatería López</Badge></TableCell>
                      <TableCell className="font-mono">admin@zapateria-lopez.com</TableCell>
                      <TableCell className="font-mono">zap123</TableCell>
                      <TableCell>{renderCopyButton("admin@zapateria-lopez.com", "adm-zap")}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Clínica Dental Sonrisas</Badge></TableCell>
                      <TableCell className="font-mono">admin@dentalsonrisas.com</TableCell>
                      <TableCell className="font-mono">den123</TableCell>
                      <TableCell>{renderCopyButton("admin@dentalsonrisas.com", "adm-den")}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Fisioterapia Wellness</Badge></TableCell>
                      <TableCell className="font-mono">admin@fisio-wellness.com</TableCell>
                      <TableCell className="font-mono">fis123</TableCell>
                      <TableCell>{renderCopyButton("admin@fisio-wellness.com", "adm-fis")}</TableCell>
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
                  Responsables (Managers)
                  <Badge variant="outline">Supervisión</Badge>
                </CardTitle>
                <CardDescription>
                  Gestión de equipos y aprobación de fichajes
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
                      <TableCell>{renderCopyButton("responsable@elrincon.com", "res-bar")}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Zapatería López</Badge></TableCell>
                      <TableCell className="font-mono">responsable@zapateria-lopez.com</TableCell>
                      <TableCell className="font-mono">resp123</TableCell>
                      <TableCell>{renderCopyButton("responsable@zapateria-lopez.com", "res-zap")}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Clínica Dental Sonrisas</Badge></TableCell>
                      <TableCell className="font-mono">responsable@dentalsonrisas.com</TableCell>
                      <TableCell className="font-mono">resp123</TableCell>
                      <TableCell>{renderCopyButton("responsable@dentalsonrisas.com", "res-den")}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Fisioterapia Wellness</Badge></TableCell>
                      <TableCell className="font-mono">responsable@fisio-wellness.com</TableCell>
                      <TableCell className="font-mono">resp123</TableCell>
                      <TableCell>{renderCopyButton("responsable@fisio-wellness.com", "res-fis")}</TableCell>
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
                  Empleados (Portal Personal)
                  <Badge variant="outline">Autogestión</Badge>
                </CardTitle>
                <CardDescription>
                  Acceso para ver fichajes propios y solicitar correcciones
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
                      <TableCell className="font-mono font-bold">BAR001</TableCell>
                      <TableCell className="font-mono">emp123</TableCell>
                      <TableCell>{renderCopyButton("juan.martinez@elrincon.com", "e-bar1")}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Bar El Rincón</Badge></TableCell>
                      <TableCell className="font-mono">ana.lopez@elrincon.com</TableCell>
                      <TableCell className="font-mono font-bold">BAR002</TableCell>
                      <TableCell className="font-mono">emp123</TableCell>
                      <TableCell>{renderCopyButton("ana.lopez@elrincon.com", "e-bar2")}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Zapatería López</Badge></TableCell>
                      <TableCell className="font-mono">lucia.moreno@zapateria-lopez.com</TableCell>
                      <TableCell className="font-mono font-bold">ZAP001</TableCell>
                      <TableCell className="font-mono">emp123</TableCell>
                      <TableCell>{renderCopyButton("lucia.moreno@zapateria-lopez.com", "e-zap1")}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Zapatería López</Badge></TableCell>
                      <TableCell className="font-mono">roberto.navarro@zapateria-lopez.com</TableCell>
                      <TableCell className="font-mono font-bold">ZAP002</TableCell>
                      <TableCell className="font-mono">emp123</TableCell>
                      <TableCell>{renderCopyButton("roberto.navarro@zapateria-lopez.com", "e-zap2")}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Clínica Dental</Badge></TableCell>
                      <TableCell className="font-mono">alberto.ruiz@dentalsonrisas.com</TableCell>
                      <TableCell className="font-mono font-bold">DEN001</TableCell>
                      <TableCell className="font-mono">emp123</TableCell>
                      <TableCell>{renderCopyButton("alberto.ruiz@dentalsonrisas.com", "e-den1")}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Clínica Dental</Badge></TableCell>
                      <TableCell className="font-mono">sofia.herrera@dentalsonrisas.com</TableCell>
                      <TableCell className="font-mono font-bold">DEN003</TableCell>
                      <TableCell className="font-mono">emp123</TableCell>
                      <TableCell>{renderCopyButton("sofia.herrera@dentalsonrisas.com", "e-den3")}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Fisioterapia</Badge></TableCell>
                      <TableCell className="font-mono">david.molina@fisio-wellness.com</TableCell>
                      <TableCell className="font-mono font-bold">FIS001</TableCell>
                      <TableCell className="font-mono">emp123</TableCell>
                      <TableCell>{renderCopyButton("david.molina@fisio-wellness.com", "e-fis1")}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="secondary">Fisioterapia</Badge></TableCell>
                      <TableCell className="font-mono">laura.gutierrez@fisio-wellness.com</TableCell>
                      <TableCell className="font-mono font-bold">FIS002</TableCell>
                      <TableCell className="font-mono">emp123</TableCell>
                      <TableCell>{renderCopyButton("laura.gutierrez@fisio-wellness.com", "e-fis2")}</TableCell>
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
                  Kiosk (Terminal de Fichaje)
                  <Badge variant="outline">Pin Access</Badge>
                </CardTitle>
                <CardDescription>
                  Acceso mediante Código de Empleado + PIN (Sin contraseña)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-bold flex items-center gap-2 mb-3"><Badge variant="secondary">Bar El Rincón</Badge></h4>
                    <ul className="space-y-2 font-mono text-sm">
                      <li className="flex justify-between items-center p-2 bg-muted rounded"><span>BAR001: <b>1234</b> (Juan)</span> {renderCopyButton("1234", "k-b1")}</li>
                      <li className="flex justify-between items-center p-2 bg-muted rounded"><span>BAR002: <b>2345</b> (Ana)</span> {renderCopyButton("2345", "k-b2")}</li>
                      <li className="flex justify-between items-center p-2 bg-muted rounded"><span>BAR003: <b>3456</b> (Pedro)</span> {renderCopyButton("3456", "k-b3")}</li>
                      <li className="flex justify-between items-center p-2 bg-muted rounded"><span>BAR004: <b>4567</b> (María)</span> {renderCopyButton("4567", "k-b4")}</li>
                      <li className="flex justify-between items-center p-2 bg-muted rounded"><span>BAR005: <b>5678</b> (Carlos)</span> {renderCopyButton("5678", "k-b5")}</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold flex items-center gap-2 mb-3"><Badge variant="secondary">Zapatería López</Badge></h4>
                    <ul className="space-y-2 font-mono text-sm">
                      <li className="flex justify-between items-center p-2 bg-muted rounded"><span>ZAP001: <b>1111</b> (Lucía)</span> {renderCopyButton("1111", "k-z1")}</li>
                      <li className="flex justify-between items-center p-2 bg-muted rounded"><span>ZAP002: <b>2222</b> (Roberto)</span> {renderCopyButton("2222", "k-z2")}</li>
                      <li className="flex justify-between items-center p-2 bg-muted rounded"><span>ZAP003: <b>3333</b> (Elena)</span> {renderCopyButton("3333", "k-z3")}</li>
                      <li className="flex justify-between items-center p-2 bg-muted rounded"><span>ZAP004: <b>4444</b> (Miguel)</span> {renderCopyButton("4444", "k-z4")}</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold flex items-center gap-2 mb-3"><Badge variant="secondary">Clínica Dental</Badge></h4>
                    <ul className="space-y-2 font-mono text-sm">
                      <li className="flex justify-between items-center p-2 bg-muted rounded"><span>DEN001: <b>1212</b> (Alberto)</span> {renderCopyButton("1212", "k-d1")}</li>
                      <li className="flex justify-between items-center p-2 bg-muted rounded"><span>DEN002: <b>2323</b> (Carmen)</span> {renderCopyButton("2323", "k-d2")}</li>
                      <li className="flex justify-between items-center p-2 bg-muted rounded"><span>DEN003: <b>3434</b> (Sofía)</span> {renderCopyButton("3434", "k-d3")}</li>
                      <li className="flex justify-between items-center p-2 bg-muted rounded"><span>DEN004: <b>4545</b> (Pablo)</span> {renderCopyButton("4545", "k-d4")}</li>
                      <li className="flex justify-between items-center p-2 bg-muted rounded"><span>DEN005: <b>5656</b> (Marta)</span> {renderCopyButton("5656", "k-d5")}</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold flex items-center gap-2 mb-3"><Badge variant="secondary">Fisioterapia</Badge></h4>
                    <ul className="space-y-2 font-mono text-sm">
                      <li className="flex justify-between items-center p-2 bg-muted rounded"><span>FIS001: <b>6666</b> (David)</span> {renderCopyButton("6666", "k-f1")}</li>
                      <li className="flex justify-between items-center p-2 bg-muted rounded"><span>FIS002: <b>7777</b> (Laura)</span> {renderCopyButton("7777", "k-f2")}</li>
                      <li className="flex justify-between items-center p-2 bg-muted rounded"><span>FIS003: <b>8888</b> (Javier)</span> {renderCopyButton("8888", "k-f3")}</li>
                      <li className="flex justify-between items-center p-2 bg-muted rounded"><span>FIS004: <b>9999</b> (Claudia)</span> {renderCopyButton("9999", "k-f4")}</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="additional" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Usuarios Adicionales / Legados</CardTitle>
                <CardDescription>Usuarios específicos creados manualmente o para propósitos especiales</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-mono">moises.menendez@garrigues.com</TableCell>
                      <TableCell><Badge variant="outline">admin</Badge></TableCell>
                      <TableCell>Canal_García_Comunidad</TableCell>
                      <TableCell>{renderCopyButton("moises.menendez@garrigues.com", "add-1")}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono">moises.menendez@teras.capital</TableCell>
                      <TableCell><Badge variant="outline">admin</Badge></TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>{renderCopyButton("moises.menendez@teras.capital", "add-2")}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono">coco@empresaprueba.com</TableCell>
                      <TableCell><Badge variant="outline">admin</Badge></TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>{renderCopyButton("coco@empresaprueba.com", "add-3")}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono">responsable@test.com</TableCell>
                      <TableCell><Badge variant="outline">responsible</Badge></TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>{renderCopyButton("responsable@test.com", "add-4")}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono">carlos.garcia@empresa.com</TableCell>
                      <TableCell><Badge variant="outline">employee</Badge></TableCell>
                      <TableCell>EMP001 (Desarrollo)</TableCell>
                      <TableCell>{renderCopyButton("carlos.garcia@empresa.com", "add-5")}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>Historias de Usuario Cubiertas V1</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">Empleado / Kiosk</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>✅ Fichar Pin (Kiosk Offline Support)</li>
                  <li>✅ Fichar QR Emp</li>
                  <li>✅ Portal: Ver historial y corregir</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Admin / Pymes</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>✅ Multi-tenant (Aislado)</li>
                  <li>✅ Notarización QTSP (V1)</li>
                  <li>✅ Auditoría Laboral (Control horario)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Infraestructura</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>✅ RLS Enforcement</li>
                  <li>✅ Deterministic Seeding</li>
                  <li>✅ Forensic Ledger</li>
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
