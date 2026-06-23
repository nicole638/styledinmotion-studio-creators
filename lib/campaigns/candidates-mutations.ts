"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/auth";

// NOTE: this file is a "use server" module, so it may only export async
// functions (server actions). The action result shape is declared inline
// rather than as an exported interface to keep that contract.
type CandidateActionResult = {
  ok: boolean;
  error?: string;
  campaignId?: string;
};

/**
 * Approve a discovered candidate → create a real `campaigns` row (the Bonuses
 * bucket) and mark the candidate approved. Dates are placeholders (today →
 * +90d) and asin_links is empty: Nicole/Kerri still opt in on Amazon Creator
 * Connections, then paste the CC share URL on the campaign edit page so
 * attribution pays out. This step only removes the manual data-entry.
 */
export async function approveCandidateAction(
  asin: string,
): Promise<CandidateActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.reason ?? "Forbidden" };

  const supabase = createAdminClient();

  const { data: cand, error: cErr } = await supabase
    .from("campaign_candidates")
    .select("*")
    .eq("asin", asin)
    .maybeSingle();
  if (cErr) return { ok: false, error: cErr.message };
  if (!cand) return { ok: false, error: "Candidate not found." };

  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

  const { data: camp, error: insErr } = await supabase
    .from("campaigns")
    .insert({
      brand_name: cand.brand_name ?? cand.product_name ?? "Amazon brand",
      brand_logo_url: cand.image_url ?? null,
      asins: [cand.asin],
      asin_links: {},
      start_date: today,
      end_date: end,
      commission_rate_pct: cand.commission_rate_pct ?? 0,
      campaign_type: "affiliate_plus",
      source: "amazon_cc",
      notes:
        `Auto-discovered from the Amazon bonus feed (ASIN ${cand.asin}). ` +
        `Opt in on Amazon Creator Connections, then paste the share URL here so commissions attribute.`,
      campaign_url: cand.product_url ?? null,
      created_by: auth.userId ?? null,
    })
    .select("id")
    .single();
  if (insErr) return { ok: false, error: insErr.message };

  await supabase
    .from("campaign_candidates")
    .update({
      status: "approved",
      reviewed_by: auth.userId ?? null,
      reviewed_at: new Date().toISOString(),
      campaign_id: camp.id,
    })
    .eq("asin", asin);

  revalidatePath("/admin/campaign-candidates");
  revalidatePath("/admin/campaigns");
  return { ok: true, campaignId: camp.id };
}

/** Deny a candidate → hidden from the queue, won't re-surface. */
export async function denyCandidateAction(
  asin: string,
): Promise<CandidateActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.reason ?? "Forbidden" };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("campaign_candidates")
    .update({
      status: "denied",
      reviewed_by: auth.userId ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("asin", asin);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/campaign-candidates");
  return { ok: true };
}
