/**
 * 7-character base62 short codes for shareable look URLs
 * (app.styledinmotion.app/n/<code> — see lib/looks/share-url.ts).
 * 62^7 ≈ 3.5 trillion combinations — collisions are vanishingly rare, but
 * we still retry up to 3 times on conflict to be safe.
 *
 * ★ These codes are CASE-SENSITIVE. Never lowercase one in a resolver or
 * comparison — 'aB1cD2e' and 'ab1cd2e' are different looks. The /n/ handler
 * in app-subdomain/api/n.js folds case ONLY for legacy 6-char hex codes.
 */

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function generateShortCode(length = 7): string {
  let out = "";
  // crypto.getRandomValues is available in Node 19+ and all modern runtimes
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback for ancient runtimes — shouldn't trigger on Vercel/Node ≥18
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
