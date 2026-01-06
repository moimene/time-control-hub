import { AppLayout } from '@/components/layout/AppLayout';
import { IncidentsList } from '@/components/compliance/IncidentsList';

export default function ComplianceIncidents() {
  return (
    <AppLayout>
      <IncidentsList />
    </AppLayout>
  );
}
