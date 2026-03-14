import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCompanySetup } from '@/hooks/useCompanySetup';

// Routes that must remain accessible even when setup is incomplete
const SETUP_EXEMPT_PATHS = [
  '/admin/setup',
  '/admin/settings',
  '/admin/templates',
  '/admin/employees',
  '/admin/terminals',
];

interface SetupGateProps {
  children: ReactNode;
}

export function SetupGate({ children }: SetupGateProps) {
  const location = useLocation();
  const { isLoading, isReady } = useCompanySetup();

  // Do not block while loading (avoids premature redirect before company resolves)
  if (isLoading) return <>{children}</>;
  if (isReady) return <>{children}</>;

  const isExempt = SETUP_EXEMPT_PATHS.some(p => location.pathname.startsWith(p));
  if (isExempt) return <>{children}</>;

  return <Navigate to="/admin/setup" replace state={{ from: location.pathname }} />;
}
