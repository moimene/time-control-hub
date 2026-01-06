import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileEdit, AlertTriangle, ClipboardList } from 'lucide-react';

// Import the content from existing pages as components
import { CorrectionsContent } from '@/components/incidents/CorrectionsContent';
import { OrphanClockInsContent } from '@/components/incidents/OrphanClockInsContent';
import { ManualRegistrationContent } from '@/components/incidents/ManualRegistrationContent';

export default function ClockingIncidents() {
  const [activeTab, setActiveTab] = useState('corrections');

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Incidencias de Fichaje</h1>
          <p className="text-muted-foreground">
            Gestiona correcciones, fichajes huérfanos y registros manuales
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
            <TabsTrigger value="corrections" className="flex items-center gap-2">
              <FileEdit className="h-4 w-4" />
              <span className="hidden sm:inline">Correcciones</span>
            </TabsTrigger>
            <TabsTrigger value="orphan" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">Fichajes Huérfanos</span>
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Registro Manual</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="corrections" className="mt-6">
            <CorrectionsContent />
          </TabsContent>

          <TabsContent value="orphan" className="mt-6">
            <OrphanClockInsContent />
          </TabsContent>

          <TabsContent value="manual" className="mt-6">
            <ManualRegistrationContent />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
