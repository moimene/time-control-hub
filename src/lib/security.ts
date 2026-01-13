import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks.
 * Uses DOMPurify to strip out dangerous tags and attributes.
 *
 * @param html - The potentially unsafe HTML string.
 * @returns The sanitized HTML string.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target'], // Allow target="_blank" for links
  });
}
