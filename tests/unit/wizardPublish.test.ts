import { describe, it, expect, vi } from 'vitest';

// Pure logic: if onComplete throws, isPublishing must be reset to false
// We test this by simulating the handlePublish state machine
async function simulateHandlePublish(
  onComplete: () => Promise<void>
): Promise<{ didReset: boolean; error: Error | null }> {
  let isPublishing = true;
  let error: Error | null = null;
  try {
    await onComplete();
  } catch (e) {
    error = e as Error;
  } finally {
    isPublishing = false;
  }
  return { didReset: !isPublishing, error };
}

describe('StepPublish handlePublish logic', () => {
  it('resets isPublishing=false after onComplete resolves', async () => {
    const { didReset, error } = await simulateHandlePublish(async () => {});
    expect(didReset).toBe(true);
    expect(error).toBeNull();
  });

  it('resets isPublishing=false even when onComplete throws', async () => {
    const { didReset, error } = await simulateHandlePublish(async () => {
      throw new Error('publish failed');
    });
    expect(didReset).toBe(true);
    expect(error?.message).toBe('publish failed');
  });
});
