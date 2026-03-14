import { describe, it, expect } from 'vitest';
import type { CompanySetupStatus, SetupCheck } from '@/hooks/useCompanySetup';

// ---------------------------------------------------------------------------
// Pure logic extracted from SetupReminderBanner for testability.
//
// The component renders null when:
//   isLoading=true  |  !status  |  isReady=true
// Otherwise it renders the alert banner, including a badge with the count of
// criticalPending items.
// ---------------------------------------------------------------------------

function shouldRenderBanner({
  isLoading,
  status,
  isReady,
}: {
  isLoading: boolean;
  status: CompanySetupStatus | null;
  isReady: boolean;
}): boolean {
  if (isLoading || !status || isReady) return false;
  return true;
}

function buildStatus(checks: Pick<SetupCheck, 'key' | 'category' | 'completed'>[]): CompanySetupStatus {
  return {
    company_id: 'test-company',
    evaluated_at: new Date().toISOString(),
    checks: checks.map(c => ({
      ...c,
      label: c.key,
      hint: c.key,
      path: '/admin/test',
    })),
  };
}

function computeCriticalPending(status: CompanySetupStatus): SetupCheck[] {
  return status.checks.filter(c => c.category === 'critical' && !c.completed);
}

describe('SetupReminderBanner — render logic', () => {
  it('does not render when isReady=true', () => {
    const status = buildStatus([{ key: 'employees', category: 'critical', completed: true }]);
    expect(shouldRenderBanner({ isLoading: false, status, isReady: true })).toBe(false);
  });

  it('does not render when isLoading=true', () => {
    const status = buildStatus([{ key: 'employees', category: 'critical', completed: false }]);
    expect(shouldRenderBanner({ isLoading: true, status, isReady: false })).toBe(false);
  });

  it('does not render when status is null', () => {
    expect(shouldRenderBanner({ isLoading: false, status: null, isReady: false })).toBe(false);
  });

  it('renders when criticalPending items exist', () => {
    const status = buildStatus([
      { key: 'employees', category: 'critical', completed: false },
      { key: 'convenio', category: 'critical', completed: false },
    ]);
    expect(shouldRenderBanner({ isLoading: false, status, isReady: false })).toBe(true);
  });

  it('criticalPending.length is correctly reflected', () => {
    const status = buildStatus([
      { key: 'jornada_rules', category: 'critical', completed: false },
      { key: 'convenio', category: 'critical', completed: false },
      { key: 'employees', category: 'critical', completed: true },
      { key: 'holidays', category: 'recommended', completed: false },
    ]);
    const criticalPending = computeCriticalPending(status);
    // Only the two incomplete critical checks should appear
    expect(criticalPending.length).toBe(2);
    expect(criticalPending.map(c => c.key)).toContain('jornada_rules');
    expect(criticalPending.map(c => c.key)).toContain('convenio');
  });
});
