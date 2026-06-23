/**
 * Brand campaigns the platform admins (Nicole/Kerri) opt into on behalf of
 * the platform — Amazon Creator Connections + future affiliate networks.
 *
 * Hub-and-spoke model: opt-in is centralized under the platform's master
 * Associates tag. Creators discover and feature the products via the
 * dashboard widget; URL routing through /api/shop with the platform tag
 * earns the bonus commission during the campaign window.
 */

export type CampaignType = "affiliate_plus" | "sponsored_products";
export type CampaignSource = "amazon_cc" | "cj" | "rakuten" | "awin" | "manual";

export interface Campaign {
  id: string;
  brandName: string;
  brandLogoUrl: string | null;
  asins: string[];
  /** ASIN -> full Amazon Creator Connections share URL with campaignId,
   *  linkId, tag, and linkCode baked in. The linkId has a per-link
   *  timestamp Amazon won't accept us reconstructing, so storing the URL
   *  verbatim is the source of truth for attribution. Empty object means
   *  per-ASIN URLs haven't been set (legacy rows). */
  asinLinks: Record<string, string>;
  startDate: string; // ISO date (yyyy-mm-dd)
  endDate: string;
  commissionRatePct: number;
  campaignType: CampaignType;
  source: CampaignSource;
  notes: string | null;
  budgetTotalUsd: number | null;
  budgetRemainingUsd: number | null;
  campaignUrl: string | null;
  /** Amazon Sponsored Products keyword. Appended as &kw=<value> to the
   *  affiliate redirect URL by /api/shop. NULL for affiliate_plus campaigns. */
  kw: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface CampaignRow {
  id: string;
  brand_name: string;
  brand_logo_url: string | null;
  asins: string[] | null;
  asin_links: Record<string, string> | null;
  start_date: string;
  end_date: string;
  commission_rate_pct: string | number; // numeric arrives as string from PostgREST
  campaign_type: CampaignType;
  source: CampaignSource;
  notes: string | null;
  budget_total_usd: string | number | null;
  budget_remaining_usd: string | number | null;
  campaign_url: string | null;
  kw: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export function rowToCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    brandName: row.brand_name,
    brandLogoUrl: row.brand_logo_url,
    asins: row.asins ?? [],
    asinLinks: row.asin_links ?? {},
    startDate: row.start_date,
    endDate: row.end_date,
    commissionRatePct: Number.parseFloat(String(row.commission_rate_pct)),
    campaignType: row.campaign_type,
    source: row.source,
    notes: row.notes,
    budgetTotalUsd:
      row.budget_total_usd === null
        ? null
        : Number.parseFloat(String(row.budget_total_usd)),
    budgetRemainingUsd:
      row.budget_remaining_usd === null
        ? null
        : Number.parseFloat(String(row.budget_remaining_usd)),
    campaignUrl: row.campaign_url,
    kw: row.kw,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

/**
 * Active = not archived AND today is within [start_date, end_date].
 * Today = JS Date in the user's locale; for the admin view this is fine,
 * but server-side queries should compare to a Postgres `current_date`.
 */
export function isActive(c: Campaign): boolean {
  if (c.archivedAt) return false;
  const today = new Date().toISOString().slice(0, 10);
  return c.startDate <= today && c.endDate >= today;
}

export function isUpcoming(c: Campaign): boolean {
  if (c.archivedAt) return false;
  const today = new Date().toISOString().slice(0, 10);
  return c.startDate > today;
}

export function isEnded(c: Campaign): boolean {
  if (c.archivedAt) return false;
  const today = new Date().toISOString().slice(0, 10);
  return c.endDate < today;
}

export const CAMPAIGN_TYPE_LABEL: Record<CampaignType, string> = {
  affiliate_plus: "Affiliate+",
  sponsored_products: "Sponsored Products",
};

export const CAMPAIGN_SOURCE_LABEL: Record<CampaignSource, string> = {
  amazon_cc: "Amazon Creator Connections",
  cj: "CJ Affiliate",
  rakuten: "Rakuten",
  awin: "Awin",
  manual: "Manual",
};

/* ───────────────────────── Campaign candidates ─────────────────────────
 * Amazon-bonus-eligible products auto-discovered from PartnerBoost's
 * `has_acc` feed, sitting in a review queue. Nicole/Kerri approve (→ creates
 * a `campaigns` row) or deny. They still opt in on the Amazon side.
 * ─────────────────────────────────────────────────────────────────────── */

export type CampaignCandidateStatus =
  | "pending"
  | "approved"
  | "denied"
  | "expired";

/** Learned guess at what a candidate is, from the words in its product name +
 *  category overrides (pet → non_fashion; hats/bags/jewelry → accessory).
 *  Improves as Nicole/Kerri approve/deny (see relearn_candidate_fashion()). */
export type FashionPrediction =
  | "fashion"
  | "accessory"
  | "non_fashion"
  | "unsure";

export interface CampaignCandidate {
  asin: string;
  productName: string | null;
  brandName: string | null;
  brandId: string | null;
  commissionRatePct: number | null;
  commissionRaw: string | null;
  imageUrl: string | null;
  productUrl: string | null;
  category: string | null;
  subcategory: string | null;
  status: CampaignCandidateStatus;
  /** + = leans fashion, − = leans non-fashion, ~0 = unsure. */
  fashionScore: number | null;
  predicted: FashionPrediction | null;
  /** Color/size ASIN variants this product rolls up (approve covers all). */
  variantCount: number;
  discoveredAt: string;
  lastSeenAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  campaignId: string | null;
}

export interface CampaignCandidateRow {
  asin: string;
  product_name: string | null;
  brand_name: string | null;
  brand_id: string | null;
  commission_rate_pct: string | number | null;
  commission_raw: string | null;
  image_url: string | null;
  product_url: string | null;
  category: string | null;
  subcategory: string | null;
  status: CampaignCandidateStatus;
  fashion_score: string | number | null;
  predicted: string | null;
  variant_count: number | null;
  discovered_at: string;
  last_seen_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  campaign_id: string | null;
}

export function rowToCandidate(
  row: CampaignCandidateRow,
): CampaignCandidate {
  return {
    asin: row.asin,
    productName: row.product_name,
    brandName: row.brand_name,
    brandId: row.brand_id,
    commissionRatePct:
      row.commission_rate_pct === null
        ? null
        : Number.parseFloat(String(row.commission_rate_pct)),
    commissionRaw: row.commission_raw,
    imageUrl: row.image_url,
    productUrl: row.product_url,
    category: row.category,
    subcategory: row.subcategory,
    status: row.status,
    fashionScore:
      row.fashion_score === null
        ? null
        : Number.parseFloat(String(row.fashion_score)),
    predicted: (row.predicted as FashionPrediction | null) ?? null,
    variantCount: Number(row.variant_count ?? 1),
    discoveredAt: row.discovered_at,
    lastSeenAt: row.last_seen_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    campaignId: row.campaign_id,
  };
}
