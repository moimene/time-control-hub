import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks.
 * Uses DOMPurify to strip out malicious scripts and attributes.
 *
 * @param dirty - The dirty HTML string.
 * @returns The sanitized HTML string.
 */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return '';

  // Configure DOMPurify to allow standard formatting but strip scripts
  const config = {
    USE_PROFILES: { html: true }, // Only allow HTML, no SVG/MathML by default unless needed
    ADD_ATTR: ['target'], // Allow target="_blank" for links if needed
  };

  return DOMPurify.sanitize(dirty, config);
}
