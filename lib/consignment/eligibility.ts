/**
 * Eligibility + payout estimation for the "Consign with The RealReal"
 * affordance on closet items.
 *
 * v2 (2026-05-31): replaced the hardcoded luxury-brand list + $200 price
 * gate with the TRR-approved brand list (~900 brands in
 * `trr_accepted_brands`). The gate is now PURE BRAND (+ optional
 * category restriction per brand). Price no longer matters — TheRealReal
 * accepts these brands across the full price range.
 *
 * Two surfaces consume this module:
 *   - Closet card (`ClosetItemsList`) — reads `item.trrEligible` (boolean
 *     computed by a Postgres trigger on creator_items) to decide
 *     whether to show the Consign pill. Cheap; no extra round-trip.
 *   - Consignment modal — calls `resolveTrrBrandAction` to surface
 *     restriction text ("TRR accepts this brand for: Coats, Dresses")
 *     and computes payout estimates.
 *
 * Payout estimates are heuristic, NOT real TRR numbers. They model
 * 45-65% recovery on `price`, adjusted per category. Once TRR exposes
 * a payout calculator API we swap for authoritative values.
 */

const MONEY_RE = /(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/;

function parsePrice(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(MONEY_RE);
  if (!m) return null;
  const n = Number.parseFloat(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export interface ConsignEligibility {
  /** Whether the Consign affordance should render. Mirror of item.trrEligible. */
  eligible: boolean;
  /** Payout estimate range (NULL when no price is set — we can still consign,
   *  the modal just shows "—" until the creator adds a price). */
  payoutMinUsd: number | null;
  payoutMaxUsd: number | null;
}

/**
 * Compute payout estimate range for an item. `trrEligible` comes from the
 * server-side trigger; this helper only handles the price math + category
 * recovery heuristic. If the item isn't TRR-eligible, returns false fast.
 */
export function consignEligibility(
  trrEligible: boolean,
  category: string | null | undefined,
  priceText: string | null | undefined,
): ConsignEligibility {
  if (!trrEligible) {
    return { eligible: false, payoutMinUsd: null, payoutMaxUsd: null };
  }

  const price = parsePrice(priceText);
  if (!price) {
    // Brand is eligible but we don't have a price to estimate against.
    // The Consign button still appears; modal shows "—" for the range.
    return { eligible: true, payoutMinUsd: null, payoutMaxUsd: null };
  }

  // Bag / outerwear / fine jewelry skew higher recovery; clothing skews
  // lower. Approximate via category text — exact match isn't required.
  const cat = (category ?? "").toLowerCase();
  let lowRatio = 0.45;
  let highRatio = 0.65;
  if (cat.includes("bag")) {
    lowRatio = 0.55;
    highRatio = 0.75;
  } else if (cat.includes("jewelry") || cat.includes("watch")) {
    lowRatio = 0.5;
    highRatio = 0.7;
  } else if (cat.includes("outerwear")) {
    lowRatio = 0.45;
    highRatio = 0.6;
  } else if (cat.includes("shoes")) {
    lowRatio = 0.35;
    highRatio = 0.5;
  }

  // Round to nearest $25 — feels like a published payout estimate, not
  // a calculator output.
  const round25 = (n: number) => Math.round(n / 25) * 25;
  const payoutMinUsd = round25(price * lowRatio);
  const payoutMaxUsd = round25(price * highRatio);

  return { eligible: true, payoutMinUsd, payoutMaxUsd };
}
