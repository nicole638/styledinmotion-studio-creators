"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/auth";

// NOTE: "use server" module — only async functions may be exported. The result
// shape is declared inline rather than as an exported interface.
type CandidateActionResult = {
  ok: boolean;
  error?: string;
  campaignId?: string;
  denied?: number;
};

/**
 * Approve a product → roll ALL its color/size variant ASINs into ONE campaign
 * (the Bonuses bucket) and mark every variant candidate approved. Dates are
 * placeholders (today → +90d) and asin_links is empty: Nicole/Kerri still opt
 * in on Amazon Creator Connections, then paste the CC share URL on the campaign
 * edit page. Grouping + insert + relearn happen atomically in Postgres
 * (`approve_candidate_group`). `asin` is any variant of the product.
 */
export async function approveCandidateAction(
  asin: string,
): Promise<CandidateActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.reason ?? "Forbidden" };

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("approve_candidate_group", {
    p_asin: asin,
    p_reviewer: auth.userId ?? null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/campaign-candidates");
  revalidatePath("/admin/campaigns");
  return { ok: true, campaignId: typeof data === "string" ? data : undefined };
}

/** Deny a product → deny every one of its variant ASINs. */
export async function denyCandidateAction(
  asin: string,
): Promise<CandidateActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.reason ?? "Forbidden" };

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("deny_candidate_group", {
    p_asin: asin,
    p_reviewer: auth.userId ?? null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/campaign-candidates");
  return { ok: true };
}

/**
 * Bulk-deny every product the learner currently reads as non-fashion in the
 * visible queue (respects the department blocklist). One Postgres call does the
 * update across all variant ASINs + relearn. Returns how many ASIN rows were
 * denied so the UI can confirm.
 */
export async function denyAllNonFashionAction(): Promise<CandidateActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.reason ?? "Forbidden" };

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("deny_visible_non_fashion", {
    p_reviewer: auth.userId ?? null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/campaign-candidates");
  return { ok: true, denied: typeof data === "number" ? data : 0 };
}
