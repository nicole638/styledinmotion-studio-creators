/**
 * Extract an Amazon ASIN from a URL string.
 *
 * ASIN format: B + 9 alphanumeric (uppercase). Amazon uses this in:
 *   - /dp/<ASIN>
 *   - /gp/product/<ASIN>
 *   - /gp/aw/d/<ASIN>
 *   - URL params (?asin=...)
 * Short links (a.co, amzn.to) don't contain the ASIN until resolved.
 *
 * Returns the ASIN uppercase, or null if no match. Tolerates URL params,
 * trailing slashes, and uppercase/lowercase paths.
 */
const ASIN_PATTERN = /\/(?:dp|gp\/product|gp\/aw\/d|product)\/(B[0-9A-Z]{9})(?:[\/?#]|$)/i;
const ASIN_PARAM = /[?&]asin=(B[0-9A-Z]{9})\b/i;

export function extractAsin(url: string | null | undefined): string | null {
  if (!url) return null;
  const m1 = url.match(ASIN_PATTERN);
  if (m1?.[1]) return m1[1].toUpperCase();
  const m2 = url.match(ASIN_PARAM);
  if (m2?.[1]) return m2[1].toUpperCase();
  return null;
}

export function isAmazonHost(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    return (
      h === "amazon.com" ||
      h === "www.amazon.com" ||
      h === "smile.amazon.com" ||
      h === "a.co" ||
      h === "amzn.to" ||
      h === "amzn.com" ||
      h === "www.amzn.com"
    );
  } catch {
    return false;
  }
}
