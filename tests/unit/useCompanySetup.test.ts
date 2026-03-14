import { describe, it, expect } from 'vitest';
import type { CompanySetupStatus, SetupCheck } from '@/hooks/useCompanySetup';

// Helper: builds a CompanySetupStatus for testing
function buildStatus(completedMap: Partial<Record<string, boolean>> = {}): CompanySetupStatus {
  const defs: { key: string; category: 'critical' | 'recommended'; defaultCompleted: boolean }[] = [
    { key: 'jornada_rules', category: 'critical', defaultCompleted: false },
    { key: 'convenio', category: 'critical', defaultCompleted: false },
    { key: 'calendar_published', category: 'critical', defaultCompleted: false },
    { key: 'employees', category: 'critical', defaultCompleted: false },
    { key: 'holidays', category: 'recommended', defaultCompleted: true },
    { key: 'coverage', category: 'recommended', defaultCompleted: false },
    { key: 'absence_types', category: 'recommended', defaultCompleted: true },
    { key: 'terminals', category: 'recommended', defaultCompleted: true },
  ];

  return {
    company_id: 'test-company',
    evaluated_at: new Date().toISOString(),
    checks: defs.map(d => ({
      key: d.key,
      category: d.category,
      completed: d.key in completedMap ? !!completedMap[d.key] : d.defaultCompleted,
      label: d.key,
      hint: d.key,
      path: '/admin/test',
    })),
  };
}

// Pure helpers extracted from hook logic (for testing without react-query)
function computeResult(status: CompanySetupStatus) {
  const criticalPending = status.checks.filter(c => c.category === 'critical' && !c.completed);
  const recommendedPending = status.checks.filter(c => c.category === 'recommended' && !c.completed);
  const completedCount = status.checks.filter(c => c.completed).length;
  const progressPercent = Math.round((completedCount / status.checks.length) * 100);
  return { criticalPending, recommendedPending, progressPercent, isReady: criticalPending.length === 0 };
}

describe('useCompanySetup — computed values', () => {
  it('isReady=false when any critical check is incomplete', () => {
    const { isReady } = computeResult(buildStatus({ jornada_rules: false }));
    expect(isReady).toBe(false);
  });

  it('isReady=true when all critical checks are complete', () => {
    const { isReady } = computeResult(buildStatus({
      jornada_rules: true, convenio: true, calendar_published: true, employees: true,
    }));
    expect(isReady).toBe(true);
  });

  it('progressPercent reflects completed/total ratio', () => {
    // all criticals complete + holidays=true(default), absence_types=true(default), terminals=true(default), coverage=false(default)
    const { progressPercent } = computeResult(buildStatus({
      jornada_rules: true, convenio: true, calendar_published: true, employees: true,
    }));
    // 7 of 8 complete
    expect(progressPercent).toBe(Math.round((7 / 8) * 100));
  });

  it('criticalPending contains only critical incomplete checks', () => {
    const { criticalPending } = computeResult(buildStatus({ jornada_rules: false, convenio: false }));
    expect(criticalPending.every(c => c.category === 'critical')).toBe(true);
    expect(criticalPending.map(c => c.key)).toContain('jornada_rules');
    expect(criticalPending.map(c => c.key)).toContain('convenio');
  });

  it('recommendedPending excludes completed recommended checks', () => {
    const { recommendedPending } = computeResult(buildStatus());
    // defaults: holidays=true, absence_types=true, terminals=true, coverage=false
    expect(recommendedPending.map(c => c.key)).toEqual(['coverage']);
  });

  it('progressPercent=0 when all checks are incomplete', () => {
    const allFalse = Object.fromEntries(
      ['jornada_rules','convenio','calendar_published','employees','holidays','coverage','absence_types','terminals']
        .map(k => [k, false])
    );
    const { progressPercent } = computeResult(buildStatus(allFalse));
    expect(progressPercent).toBe(0);
  });
});
