/**
 * Eligibility + payout estimation for the "Consign with The RealReal"
 * affordance on closet items. v1 is intentionally narrow: a curated
 * luxury brand list + a price floor. Items outside this scope simply
 * don't show the badge — keeps the closet from getting noisy and avoids
 * setting expectations TRR couldn't fulfill.
 *
 * Payout estimates are heuristic, NOT real TRR numbers. They're tuned
 * to be conservative-but-aspirational so the modal feels real without
 * promising specific dollar amounts. Once we have a real TRR API or
 * payout calculator, swap this for their authoritative values.
 */

/** Luxury brands TRR routinely accepts for consignment. Match is
 *  case-insensitive and substring — `gucci` matches `Gucci`, `GUCCI`,
 *  `Gucci Marmont`, etc. */
const LUXURY_BRANDS = [
  "chanel",
  "louis vuitton",
  "lv ",
  "hermès",
  "hermes",
  "gucci",
  "prada",
  "bottega veneta",
  "bottega",
  "dior",
  "saint laurent",
  "ysl",
  "fendi",
  "balenciaga",
  "céline",
  "celine",
  "givenchy",
  "loewe",
  "valentino",
  "miu miu",
  "alexander mcqueen",
  "burberry",
  "cartier",
  "tiffany",
  "van cleef",
  "rolex",
  "patek philippe",
  "audemars",
  "the row",
  "khaite",
  "max mara",
  "moncler",
  "stella mccartney",
  "isabel marant",
  "jacquemus",
  "off-white",
  "off white",
];

/** Items under this list price aren't worth consigning through TRR (their
 *  intake bar is roughly $100 retail; we set $200 to filter casual finds). */
const MIN_PRICE_USD = 200;

const MONEY_RE = /(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/;

function parsePrice(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(MONEY_RE);
  if (!m) return null;
  const n = Number.parseFloat(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function isLuxuryBrand(brand: string | null | undefined): boolean {
  if (!brand) return false;
  const lower = brand.toLowerCase();
  return LUXURY_BRANDS.some((b) => lower.includes(b));
}

export interface ConsignEligibility {
  /** Whether the Consign affordance should render on the closet card. */
  eligible: boolean;
  /** When eligible, a min/max payout estimate to show in the modal. */
  payoutMinUsd: number | null;
  payoutMaxUsd: number | null;
}

/**
 * Decide whether a closet item should surface the Consign pill, and
 * compute the payout estimate range we'll show in the modal if so.
 *
 * Heuristic: TRR consignor payout rates are typically 50-85% of the
 * listed resale value, depending on category, condition, and brand
 * tier. We model that as a flat 50-65% range applied to the creator's
 * `price` field (which is the merchant retail price — TRR's listing
 * would be lower, so this skews conservative).
 */
export function consignEligibility(
  brand: string | null | undefined,
  category: string | null | undefined,
  priceText: string | null | undefined,
): ConsignEligibility {
  const price = parsePrice(priceText);
  if (!price || price < MIN_PRICE_USD) {
    return { eligible: false, payoutMinUsd: null, payoutMaxUsd: null };
  }
  if (!isLuxuryBrand(brand)) {
    return { eligible: false, payoutMinUsd: null, payoutMaxUsd: null };
  }

  // Bag / outerwear / fine jewelry skew higher recovery; clothing skews
  // lower. We approximate via category text — exact match isn't required,
  // a casual contains() is fine for the demo's purposes.
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
