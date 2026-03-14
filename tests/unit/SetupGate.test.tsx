import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Pure logic extracted from SetupGate for testability.
//
// SetupGate redirects to /admin/setup when:
//   - NOT loading AND NOT ready AND pathname is NOT in EXEMPT list
//
// EXEMPT paths (any startsWith match):
//   /admin/setup | /admin/settings | /admin/templates | /admin/employees | /admin/terminals | /admin/calendar-laboral
// ---------------------------------------------------------------------------

const EXEMPT = [
  '/admin/setup',
  '/admin/settings',
  '/admin/templates',
  '/admin/employees',
  '/admin/terminals',
  '/admin/calendar-laboral',
];

function shouldRedirect({
  isLoading,
  isReady,
  pathname,
}: {
  isLoading: boolean;
  isReady: boolean;
  pathname: string;
}): boolean {
  if (isLoading || isReady) return false;
  return !EXEMPT.some(p => pathname.startsWith(p));
}

describe('SetupGate — redirect logic', () => {
  it('does not redirect when isLoading=true (renders children)', () => {
    expect(shouldRedirect({ isLoading: true, isReady: false, pathname: '/admin/dashboard' })).toBe(false);
  });

  it('does not redirect when isReady=true (renders children)', () => {
    expect(shouldRedirect({ isLoading: false, isReady: true, pathname: '/admin/dashboard' })).toBe(false);
  });

  it('redirects when !isReady and path is not exempt', () => {
    expect(shouldRedirect({ isLoading: false, isReady: false, pathname: '/admin/dashboard' })).toBe(true);
  });

  it('does not redirect when path is exempt (/admin/settings)', () => {
    expect(shouldRedirect({ isLoading: false, isReady: false, pathname: '/admin/settings' })).toBe(false);
  });

  it('does not redirect when path is exempt (/admin/setup)', () => {
    expect(shouldRedirect({ isLoading: false, isReady: false, pathname: '/admin/setup' })).toBe(false);
  });

  it('does not redirect when path is exempt (/admin/templates)', () => {
    expect(shouldRedirect({ isLoading: false, isReady: false, pathname: '/admin/templates' })).toBe(false);
  });

  it('does not redirect when path is exempt (/admin/employees)', () => {
    expect(shouldRedirect({ isLoading: false, isReady: false, pathname: '/admin/employees' })).toBe(false);
  });

  it('does not redirect when path is exempt (/admin/terminals)', () => {
    expect(shouldRedirect({ isLoading: false, isReady: false, pathname: '/admin/terminals' })).toBe(false);
  });

  it('does not redirect for sub-paths of exempt routes', () => {
    expect(shouldRedirect({ isLoading: false, isReady: false, pathname: '/admin/settings/profile' })).toBe(false);
    expect(shouldRedirect({ isLoading: false, isReady: false, pathname: '/admin/employees/123' })).toBe(false);
  });

  it('redirects for non-exempt admin sub-paths', () => {
    expect(shouldRedirect({ isLoading: false, isReady: false, pathname: '/admin/reports' })).toBe(true);
    expect(shouldRedirect({ isLoading: false, isReady: false, pathname: '/admin/attendance' })).toBe(true);
  });

  it('does not redirect when path is /admin/calendar-laboral', () => {
    expect(shouldRedirect({ isLoading: false, isReady: false, pathname: '/admin/calendar-laboral' })).toBe(false);
  });
});
