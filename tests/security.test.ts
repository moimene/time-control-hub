import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../src/lib/security';

describe('sanitizeHtml', () => {
  it('should return empty string for null/undefined', () => {
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
    expect(sanitizeHtml('')).toBe('');
  });

  it('should return safe HTML unchanged', () => {
    const safe = '<p>Hello world</p>';
    expect(sanitizeHtml(safe)).toBe(safe);
  });

  it('should strip script tags', () => {
    const dirty = '<p>Hello <script>alert("xss")</script>world</p>';
    const clean = '<p>Hello world</p>';
    expect(sanitizeHtml(dirty)).toBe(clean);
  });

  it('should strip onclick attributes', () => {
    const dirty = '<button onclick="alert(\'xss\')">Click me</button>';
    const clean = '<button>Click me</button>';
    expect(sanitizeHtml(dirty)).toBe(clean);
  });

  it('should allow target="_blank"', () => {
    const link = '<a href="https://example.com" target="_blank">Link</a>';
    expect(sanitizeHtml(link)).toBe(link);
  });
});
