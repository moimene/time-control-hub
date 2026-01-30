import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import Employees from './Employees';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';

// Mock hooks
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ isAdmin: true, isAsesor: false }),
  AuthProvider: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/hooks/useCompany', () => ({
  useCompany: () => ({ companyId: 'test-company' })
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}));

// Mock React Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockReturnValue({
    data: [
      {
        id: '1',
        employee_code: 'EMP001',
        first_name: 'John',
        last_name: 'Doe',
        status: 'active',
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      }
    ],
    isLoading: false
  }),
  useMutation: vi.fn().mockReturnValue({ mutate: vi.fn() }),
  useQueryClient: vi.fn().mockReturnValue({ invalidateQueries: vi.fn() })
}));

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    order: vi.fn(),
  }
}));

// Mock UI components that might cause issues
vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: any) => <div>{children}</div>
}));

describe('Employees Page', () => {
  it('renders search input with aria-label', () => {
    render(
      <BrowserRouter>
        <Employees />
      </BrowserRouter>
    );
    const searchInput = screen.getByLabelText('Buscar empleado');
    expect(searchInput).toBeInTheDocument();
  });

  it('renders action buttons with aria-labels', () => {
    render(
      <BrowserRouter>
        <Employees />
      </BrowserRouter>
    );

    expect(screen.getByLabelText('Credenciales de acceso')).toBeInTheDocument();
    expect(screen.getByLabelText('Ver código QR')).toBeInTheDocument();
    expect(screen.getByLabelText('Cambiar PIN')).toBeInTheDocument();
    expect(screen.getByLabelText('Editar empleado')).toBeInTheDocument();
    expect(screen.getByLabelText('Eliminar empleado')).toBeInTheDocument();
  });
});
