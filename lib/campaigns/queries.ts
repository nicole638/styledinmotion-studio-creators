import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { rowToCampaign, type Campaign, type CampaignRow } from "@/types/campaigns";

/**
 * List all campaigns (admin scope — includes archived + ended).
 * Sorted: pinned first (newest pin first), then active / upcoming / ended /
 * archived, and within each group newest end_date first. Pin a campaign by
 * setting campaigns.pinned_at (used to surface freshly-added ones up top).
 */
export async function listCampaignsForAdmin(): Promise<Campaign[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("pinned_at", { ascending: false, nullsFirst: false })
    .order("archived_at", { ascending: true, nullsFirst: true })
    .order("end_date", { ascending: false });
  if (error) throw new Error(`listCampaignsForAdmin: ${error.message}`);
  return (data as CampaignRow[]).map(rowToCampaign);
}

export async function getCampaignById(id: string): Promise<Campaign | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getCampaignById: ${error.message}`);
  return data ? rowToCampaign(data as CampaignRow) : null;
}

/**
 * Currently-active campaigns visible to creators (today is in [start, end] window
 * AND not archived). RLS allows authenticated users SELECT on active campaigns.
 * Sorted: highest commission rate first; within an equal rate, by category bucket
 * (campaigns.category_priority: 0=clothing, 1=shoes, 2=jewelry, 3=other — computed
 * server-side from infer_department, the same classifier as the Brands tab, and
 * refreshed nightly); then earliest end_date (urgency). Mirrors the iOS home sort.
 */
export async function listActiveCampaignsForCreator(
  limit = 10,
): Promise<Campaign[]> {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .lte("start_date", today)
    .gte("end_date", today)
    .is("archived_at", null)
    .order("commission_rate_pct", { ascending: false })
    .order("category_priority", { ascending: true, nullsFirst: false })
    .order("end_date", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`listActiveCampaignsForCreator: ${error.message}`);
  return (data as CampaignRow[]).map(rowToCampaign);
}

/**
 * Find any active campaign that includes the given ASIN. Used by the closet
 * add flow to surface "this product is in a +X% campaign" banners.
 * Returns the highest-rate match if multiple campaigns include the ASIN
 * (mirrors Amazon CC behavior: creator earns the highest applicable rate).
 */
export async function findActiveCampaignForAsin(
  asin: string,
): Promise<Campaign | null> {
  if (!asin) return null;
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .contains("asins", [asin.toUpperCase()])
    .lte("start_date", today)
    .gte("end_date", today)
    .is("archived_at", null)
    .order("commission_rate_pct", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findActiveCampaignForAsin: ${error.message}`);
  return data ? rowToCampaign(data as CampaignRow) : null;
}
