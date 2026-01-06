import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader2 } from "lucide-react";

/**
 * QTSPEvidence page has been integrated into Reports.
 * This component redirects to the Reports page with the certificates tab active.
 */
export default function QTSPEvidence() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to reports page - certificates functionality is now integrated there
    navigate('/admin/reports', { replace: true });
  }, [navigate]);

  return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Redirigiendo a Informes...</span>
      </div>
    </AppLayout>
  );
}
