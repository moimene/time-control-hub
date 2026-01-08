import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { createContext, useContext, ReactNode } from 'react';
import type { Company } from '@/types/database';

// Context for company override (used by super admin when configuring companies)
interface CompanyOverrideContextType {
  companyId: string | null;
  company: Company | null;
}

const CompanyOverrideContext = createContext<CompanyOverrideContextType | null>(null);

export function CompanyOverrideProvider({ 
  companyId, 
  company, 
  children 
}: { 
  companyId: string; 
  company: Company | null;
  children: ReactNode;
}) {
  return (
    <CompanyOverrideContext.Provider value={{ companyId, company }}>
      {children}
    </CompanyOverrideContext.Provider>
  );
}

export function useCompany() {
  const { user } = useAuth();
  const override = useContext(CompanyOverrideContext);

  const { data: company, isLoading, error } = useQuery({
    queryKey: ['user-company', user?.id, override?.companyId],
    queryFn: async () => {
      // If we have an override, use that company
      if (override?.companyId) {
        const { data: companyData } = await supabase
          .from('company')
          .select('*')
          .eq('id', override.companyId)
          .single();
        return companyData as Company | null;
      }

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
    enabled: !!user?.id || !!override?.companyId,
  });

  return {
    company: override?.company ?? company ?? null,
    companyId: override?.companyId ?? company?.id ?? null,
    isLoading: override?.companyId ? false : isLoading,
    error,
    hasCompany: !!(override?.companyId || company),
    isOverride: !!override?.companyId,
  };
}
