import DOMPurify from 'dompurify';

/**
 * Sanitizes an HTML string to prevent XSS attacks.
 * It removes malicious scripts and attributes while preserving safe HTML content.
 *
 * @param html - The potentially unsafe HTML string
 * @returns The sanitized HTML string
 */
export function sanitizeHtml(html: string): string {
  // Configured to allow standard rich text formatting but strip dangerous tags
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true }, // Only allow HTML
    ADD_ATTR: ['target'], // Allow target attribute for links
  });
}
