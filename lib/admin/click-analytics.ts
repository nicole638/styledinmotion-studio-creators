import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin click analytics — quantify what's logged in click_events so we
 * can see where shopper traffic is actually being captured (and where
 * it's being lost).
 *
 * Current known gaps in the logging pipeline:
 *  1. Web /looks/* pages only log clicks via the Vibecode /api/shop
 *     redirect, and `web/lib/affiliate.ts` deliberately bypasses
 *     /api/shop for CJ deeplinks and brand-direct shortlinks. CJ
 *     merchants (Camper, Mytheresa, Quay, Rebag) will show 0 web
 *     clicks until /api/shop also handles those URLs.
 *  2. Non-affiliated retailers (Zara, Target, Adidas, Free People,
 *     etc.) are not routed through /api/shop on the web side at all —
 *     they pass through raw. iOS app DOES log these.
 *  3. Until 2026-05-30, click_events had no `source` column, so we
 *     cannot separate web from iOS on historical rows. Rows logged
 *     after this date will have `source` populated.
 */

export type ClickTotals = {
  clicks_7d: number;
  clicks_30d: number;
  clicks_90d: number;
};

export type CreatorClicks = {
  creator_id: string;
  creator_label: string;
  c7: number;
  c30: number;
  c30_affil: number;
  c30_unaffil: number;
};

export type MerchantClicks = {
  merchant_domain: string;
  affiliate_network: string | null;
  clicks_30d: number;
  creators: number;
};

export type NetworkBreakdown = {
  affiliate_network: string;
  clicks_30d: number;
  creators: number;
};

export type SourceBreakdown = {
  source: string; // 'web' | 'ios' | 'android' | 'unknown'
  clicks_30d: number;
};

export type MerchantGap = {
  merchant_id: string;
  network: string;
  merchant_name: string;
  domain: string | null;
  product_count: number;
  clicks_30d: number;
};

export async function getClickTotals(): Promise<ClickTotals> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("admin_click_totals");
  if (error) throw error;
  return (
    (data as ClickTotals) ?? { clicks_7d: 0, clicks_30d: 0, clicks_90d: 0 }
  );
}

export async function getCreatorClicks(): Promise<CreatorClicks[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("admin_click_by_creator");
  if (error) throw error;
  return (data ?? []) as CreatorClicks[];
}

export async function getMerchantClicks(): Promise<MerchantClicks[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("admin_click_by_merchant");
  if (error) throw error;
  return (data ?? []) as MerchantClicks[];
}

export async function getNetworkBreakdown(): Promise<NetworkBreakdown[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("admin_click_by_network");
  if (error) throw error;
  return (data ?? []) as NetworkBreakdown[];
}

export async function getSourceBreakdown(): Promise<SourceBreakdown[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("admin_click_by_source");
  if (error) throw error;
  return (data ?? []) as SourceBreakdown[];
}

/**
 * Affiliate merchants that have a catalog (products) but received
 * zero clicks in the last 30 days. Strong signal of a logging-pipeline
 * gap — especially anything on CJ, which is currently bypassed on the
 * web side by design.
 */
export async function getSuspectedLoggingGaps(): Promise<MerchantGap[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("admin_click_gap_merchants");
  if (error) throw error;
  return (data ?? []) as MerchantGap[];
}
