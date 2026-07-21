/**
 * Canonical public share URL for a look.
 *
 * ★ SINGLE SOURCE OF TRUTH. Three surfaces used to build this string inline
 * (ShareLookMenu, ShareLookButton, the look detail "Public link" callout) and
 * all three drifted onto a domain we do not own. Import from here instead.
 *
 * WHY NOT styled.in:
 * `https://styled.in/<code>` was referenced aspirationally across the codebase
 * because it reads as "styled in" — but the domain belongs to a third party
 * (registered 2007-10-28 via GoDaddy, WHOIS-confirmed 2026-06-29) and parks
 * every path to /lander. Links built on it went to a stranger's parking page.
 *
 * The iOS app never shipped it — see mobile/src/lib/share-captions.ts, which
 * emits the /n/ link below and documents the same decision. As of 2026-07-21
 * web matches iOS.
 *
 * WHERE IT GOES:
 * app.styledinmotion.app/n/<code> → app-subdomain/api/n.js → resolves the code
 * via the `resolve_look_short_code` RPC → 302 to
 * shop.styledinmotion.studio/look/<id>, where products route through
 * /api/shop so affiliate attribution stays intact.
 *
 * Accepts both live code formats: legacy 6-char lowercase hex and current
 * 7-char base62 (case-sensitive — never lowercase a short code).
 */
export function buildLookShareUrl(shortCode: string): string {
  return `https://app.styledinmotion.app/n/${shortCode}`;
}

/** Same link, minus the scheme — for display in UI ("Public link" callouts). */
export function buildLookShareUrlDisplay(shortCode: string): string {
  return `app.styledinmotion.app/n/${shortCode}`;
}
