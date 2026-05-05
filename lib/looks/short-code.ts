/**
 * 7-character base62 short codes for shareable look URLs (styled.in/<code>).
 * 62^7 ≈ 3.5 trillion combinations — collisions are vanishingly rare, but
 * we still retry up to 3 times on conflict to be safe.
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
