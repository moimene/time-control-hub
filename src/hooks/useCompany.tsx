import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Company } from '@/types/database';

export function useCompany() {
  const { user } = useAuth();

  const { data: company, isLoading, error } = useQuery({
    queryKey: ['user-company', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // First check if user is an employee
      const { data: employeeData } = await supabase
        .from('employees')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (employeeData?.company_id) {
        const { data: companyData } = await supabase
          .from('company')
          .select('*')
          .eq('id', employeeData.company_id)
          .single();
        return companyData as Company | null;
      }

      // Then check user_company table (for admins/responsibles)
      const { data: userCompanyData } = await supabase
        .from('user_company')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (userCompanyData?.company_id) {
        const { data: companyData } = await supabase
          .from('company')
          .select('*')
          .eq('id', userCompanyData.company_id)
          .single();
        return companyData as Company | null;
      }

      return null;
    },
    enabled: !!user?.id,
  });

  return {
    company,
    companyId: company?.id ?? null,
    isLoading,
    error,
    hasCompany: !!company,
  };
}
