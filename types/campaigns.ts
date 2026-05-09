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
