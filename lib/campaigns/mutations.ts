"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/auth";
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
}

export interface CampaignWriteResult {
  ok: boolean;
  error?: string;
  id?: string;
}

/**
 * Permissive ASIN parser. Accepts pasted lists separated by commas, newlines,
 * spaces, or semicolons. Strips whitespace, dedupes, uppercases. Validates
 * each looks like an Amazon ASIN (B-prefix, 10 chars alphanumeric — Amazon's
 * standard format).
 */
function parseAsins(raw: string): { asins: string[]; rejected: string[] } {
  const tokens = raw
    .split(/[\s,;]+/)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
  const asinPattern = /^B[0-9A-Z]{9}$/;
  const asins: string[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    if (seen.has(t)) continue;
    seen.add(t);
    if (asinPattern.test(t)) asins.push(t);
    else rejected.push(t);
  }
  return { asins, rejected };
}

export async function createCampaignAction(
  draft: CampaignDraft,
): Promise<CampaignWriteResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.reason ?? "Forbidden" };

  const validation = validateDraft(draft);
  if (!validation.ok) return { ok: false, error: validation.error };

  const { asins } = parseAsins(draft.asinsRaw);

  const supabase = createAdminClient();
  const payload = {
    brand_name: draft.brandName.trim(),
    brand_logo_url: draft.brandLogoUrl?.trim() || null,
    asins,
    start_date: draft.startDate,
    end_date: draft.endDate,
    commission_rate_pct: draft.commissionRatePct,
    campaign_type: draft.campaignType,
    source: draft.source,
    notes: draft.notes?.trim() || null,
    budget_total_usd: draft.budgetTotalUsd ?? null,
    budget_remaining_usd: draft.budgetRemainingUsd ?? null,
    campaign_url: draft.campaignUrl?.trim() || null,
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

  const { asins } = parseAsins(draft.asinsRaw);
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("campaigns")
    .update({
      brand_name: draft.brandName.trim(),
      brand_logo_url: draft.brandLogoUrl?.trim() || null,
      asins,
      start_date: draft.startDate,
      end_date: draft.endDate,
      commission_rate_pct: draft.commissionRatePct,
      campaign_type: draft.campaignType,
      source: draft.source,
      notes: draft.notes?.trim() || null,
      budget_total_usd: draft.budgetTotalUsd ?? null,
      budget_remaining_usd: draft.budgetRemainingUsd ?? null,
      campaign_url: draft.campaignUrl?.trim() || null,
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

  const { asins, rejected } = parseAsins(d.asinsRaw);
  if (asins.length === 0)
    return {
      ok: false,
      error: rejected.length
        ? `No valid ASINs found. Rejected: ${rejected.slice(0, 3).join(", ")}${rejected.length > 3 ? "…" : ""}. ASINs look like B0XXXXXXXX (B + 9 alphanumeric).`
        : "Paste at least one ASIN. ASINs look like B0XXXXXXXX (B + 9 alphanumeric).",
    };
  return { ok: true };
}
