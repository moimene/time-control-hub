import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from './useCompany';

export type SetupCategory = 'critical' | 'recommended';

export interface SetupCheck {
  key: string;
  category: SetupCategory;
  completed: boolean;
  auto_provided?: boolean;
  label: string;
  hint: string;
  path: string;
}

export interface CompanySetupStatus {
  company_id: string;
  evaluated_at: string;
  checks: SetupCheck[];
}

export interface UseCompanySetupResult {
  status: CompanySetupStatus | null;
  isLoading: boolean;
  isReady: boolean;
  criticalPending: SetupCheck[];
  recommendedPending: SetupCheck[];
  progressPercent: number;
}

export function useCompanySetup(): UseCompanySetupResult {
  const { companyId, isLoading: companyLoading } = useCompany();

  const { data: status, isLoading } = useQuery<CompanySetupStatus | null>({
    queryKey: ['company-setup-status', companyId],
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_company_setup_status', { p_company_id: companyId });
      if (error) throw error;
      return data as CompanySetupStatus;
    },
  });

  if (!status) {
    return {
      status: null,
      isLoading: companyLoading || isLoading,
      isReady: false,
      criticalPending: [],
      recommendedPending: [],
      progressPercent: 0,
    };
  }

  const criticalPending = status.checks.filter(
    c => c.category === 'critical' && !c.completed
  );
  const recommendedPending = status.checks.filter(
    c => c.category === 'recommended' && !c.completed
  );
  const completedCount = status.checks.filter(c => c.completed).length;
  const progressPercent = status.checks.length === 0
    ? 0
    : Math.round((completedCount / status.checks.length) * 100);

  return {
    status,
    isLoading,
    isReady: criticalPending.length === 0,
    criticalPending,
    recommendedPending,
    progressPercent,
  };
}
