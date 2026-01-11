import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks.
 * Uses DOMPurify to strip dangerous tags and attributes.
 *
 * @param html The potentially unsafe HTML string
 * @returns The sanitized HTML string
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true }, // Only allow HTML
    ADD_ATTR: ['target'], // Allow target attribute for links (e.g. target="_blank")
  });
}
