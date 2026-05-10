"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/auth";
import { extractAsin } from "@/lib/closet/asin";
import type { CampaignType, CampaignSource } from "@/types/campaigns";

export interface CampaignDraft {
  brandName: string;
  brandLogoUrl?: string | null;
  asinsRaw: string; // textarea / comma / newline / space separated
  startDate: string; // yyyy-mm-dd
  endDate: string;
  commissionRatePct: number;
  campaignType: CampaignType;
  source: CampaignSource;
  notes?: string | null;
  budgetTotalUsd?: number | null;
  budgetRemainingUsd?: number | null;
  campaignUrl?: string | null;
  /** Amazon Sponsored Products keyword. Becomes &kw=<value> on the redirect
   *  URL at click-through. Only set for sponsored_products campaigns. */
  kw?: string | null;
}

export interface CampaignWriteResult {
  ok: boolean;
  error?: string;
  id?: string;
}

/**
 * Permissive parser that accepts EITHER:
 *   - Bare ASINs (e.g. "B09YCYYHB6") separated by commas/spaces/newlines, OR
 *   - Full Amazon Creator Connections share URLs (one per line) like
 *     https://www.amazon.com/dp/B0F2H81T8V?campaignId=…&linkId=…&tag=…
 *
 * For URL inputs, extracts the ASIN and stores the full URL in asinLinks
 * so /api/shop can serve the campaign-attributed URL on click. The bare-
 * ASIN path is kept for legacy admin entry but yields no attribution
 * (rejected loudly in the form copy).
 */
function parseAsinsAndLinks(raw: string): {
  asins: string[];
  asinLinks: Record<string, string>;
  rejected: string[];
  /** Bare ASINs entered without a URL — they'll work for surfacing the
   *  campaign banner but won't actually pay out commission until a real
   *  campaign URL is added. The form copy nudges admins to paste URLs. */
  asinsWithoutLinks: string[];
} {
  // Split on whitespace/commas/semicolons. A URL with `?` or `&` won't
  // get split because those characters aren't separators here.
  const tokens = raw
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const asinPattern = /^B[0-9A-Z]{9}$/i;
  const asins: string[] = [];
  const asinLinks: Record<string, string> = {};
  const rejected: string[] = [];
  const asinsWithoutLinks: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    // Looks like a URL → extract ASIN, store full URL.
    if (/^https?:\/\//i.test(token)) {
      const asin = extractAsin(token);
      if (!asin) {
        rejected.push(token);
        continue;
      }
      if (seen.has(asin)) {
        // Duplicate ASIN — keep the URL from the FIRST occurrence (admin
        // intent). Don't reject, just skip.
        continue;
      }
      seen.add(asin);
      asins.push(asin);
      asinLinks[asin] = token;
      continue;
    }

    // Looks like a bare ASIN.
    const upper = token.toUpperCase();
    if (asinPattern.test(upper)) {
      if (seen.has(upper)) continue;
      seen.add(upper);
      asins.push(upper);
      asinsWithoutLinks.push(upper);
      continue;
    }

    rejected.push(token);
  }

  return { asins, asinLinks, rejected, asinsWithoutLinks };
}

export async function createCampaignAction(
  draft: CampaignDraft,
): Promise<CampaignWriteResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.reason ?? "Forbidden" };

  const validation = validateDraft(draft);
  if (!validation.ok) return { ok: false, error: validation.error };

  const { asins, asinLinks } = parseAsinsAndLinks(draft.asinsRaw);

  const supabase = createAdminClient();
  const payload = {
    brand_name: draft.brandName.trim(),
    brand_logo_url: draft.brandLogoUrl?.trim() || null,
    asins,
    asin_links: asinLinks,
    start_date: draft.startDate,
    end_date: draft.endDate,
    commission_rate_pct: draft.commissionRatePct,
    campaign_type: draft.campaignType,
    source: draft.source,
    notes: draft.notes?.trim() || null,
    budget_total_usd: draft.budgetTotalUsd ?? null,
    budget_remaining_usd: draft.budgetRemainingUsd ?? null,
    campaign_url: draft.campaignUrl?.trim() || null,
    // kw is only meaningful for sponsored_products. Defensive: drop on
    // affiliate_plus so a stale value from the form can't leak through.
    kw:
      draft.campaignType === "sponsored_products"
        ? draft.kw?.trim() || null
        : null,
    created_by: auth.userId ?? null,
  };

  const { data, error } = await supabase
    .from("campaigns")
    .insert(payload)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/campaigns");
  return { ok: true, id: data.id };
}

export async function updateCampaignAction(
  id: string,
  draft: CampaignDraft,
): Promise<CampaignWriteResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.reason ?? "Forbidden" };

  const validation = validateDraft(draft);
  if (!validation.ok) return { ok: false, error: validation.error };

  const { asins, asinLinks } = parseAsinsAndLinks(draft.asinsRaw);
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("campaigns")
    .update({
      brand_name: draft.brandName.trim(),
      brand_logo_url: draft.brandLogoUrl?.trim() || null,
      asins,
      asin_links: asinLinks,
      start_date: draft.startDate,
      end_date: draft.endDate,
      commission_rate_pct: draft.commissionRatePct,
      campaign_type: draft.campaignType,
      source: draft.source,
      notes: draft.notes?.trim() || null,
      budget_total_usd: draft.budgetTotalUsd ?? null,
      budget_remaining_usd: draft.budgetRemainingUsd ?? null,
      campaign_url: draft.campaignUrl?.trim() || null,
      kw:
        draft.campaignType === "sponsored_products"
          ? draft.kw?.trim() || null
          : null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${id}`);
  return { ok: true, id };
}

export async function archiveCampaignAction(
  id: string,
  archived: boolean,
): Promise<CampaignWriteResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.reason ?? "Forbidden" };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("campaigns")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/campaigns");
  return { ok: true, id };
}

function validateDraft(d: CampaignDraft): { ok: true } | { ok: false; error: string } {
  if (!d.brandName?.trim()) return { ok: false, error: "Brand name is required." };
  if (!d.startDate || !d.endDate)
    return { ok: false, error: "Start and end dates are required." };
  if (d.endDate < d.startDate)
    return { ok: false, error: "End date must be on or after start date." };
  if (
    typeof d.commissionRatePct !== "number" ||
    !Number.isFinite(d.commissionRatePct) ||
    d.commissionRatePct < 0 ||
    d.commissionRatePct > 100
  )
    return {
      ok: false,
      error: "Commission rate must be a number between 0 and 100.",
    };
  if (!d.campaignType) return { ok: false, error: "Campaign type is required." };
  if (!d.source) return { ok: false, error: "Source is required." };

  const { asins, rejected } = parseAsinsAndLinks(d.asinsRaw);
  if (asins.length === 0)
    return {
      ok: false,
      error: rejected.length
        ? `No valid ASINs found. Rejected: ${rejected.slice(0, 3).join(", ")}${rejected.length > 3 ? "…" : ""}. Paste full Amazon Creator Connections share URLs (one per line) — we extract the ASIN and store the URL so commissions attribute correctly.`
        : "Paste at least one Amazon Creator Connections share URL. Bare ASINs are accepted but won't pay out — Amazon needs the campaignId + linkId baked into the URL.",
    };
  return { ok: true };
}
