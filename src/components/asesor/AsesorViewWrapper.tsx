import { ReactNode } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { CompanyOverrideProvider, useCompany } from '@/hooks/useCompany';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Company } from '@/types/database';

interface AsesorViewWrapperProps {
    children: ReactNode;
}

export function AsesorViewWrapper({ children }: AsesorViewWrapperProps) {
    const [searchParams] = useSearchParams();
    const companyId = searchParams.get('company');

    const { data: company, isLoading } = useQuery({
        queryKey: ['company-detail', companyId],
        queryFn: async () => {
            if (!companyId) return null;
            const { data, error } = await supabase
                .from('company')
                .select('*')
                .eq('id', companyId)
                .single();
            if (error) throw error;
            return data as Company;
        },
        enabled: !!companyId,
    });

    if (!companyId) {
        return <Navigate to="/asesor" replace />;
    }

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    return (
        <CompanyOverrideProvider companyId={companyId} company={company || null}>
            {children}
        </CompanyOverrideProvider>
    );
}
