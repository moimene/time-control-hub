import { describe, it, expect } from 'vitest';

// Pure logic: resolve latest rule_version_id from a rule_set's versions array
function resolveLatestVersionId(
  versions: { id: string; published_at: string | null }[]
): string | null {
  if (!versions || versions.length === 0) return null;
  const sorted = [...versions].sort((a, b) => {
    if (!a.published_at) return 1;
    if (!b.published_at) return -1;
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  });
  return sorted[0].id;
}

describe('resolveLatestVersionId', () => {
  it('returns null for empty versions', () => {
    expect(resolveLatestVersionId([])).toBeNull();
  });

  it('returns the id of the version with the latest published_at', () => {
    const versions = [
      { id: 'old', published_at: '2026-01-01T00:00:00Z' },
      { id: 'newest', published_at: '2026-03-01T00:00:00Z' },
      { id: 'mid', published_at: '2026-02-01T00:00:00Z' },
    ];
    expect(resolveLatestVersionId(versions)).toBe('newest');
  });

  it('sorts null published_at to the end', () => {
    const versions = [
      { id: 'draft', published_at: null },
      { id: 'published', published_at: '2026-01-01T00:00:00Z' },
    ];
    expect(resolveLatestVersionId(versions)).toBe('published');
  });
});
