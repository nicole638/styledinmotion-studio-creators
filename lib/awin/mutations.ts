"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/auth";
import { normalizeMerchantDomain, type AwinMerchantStatus } from "@/types/awin";

export interface AwinMerchantDraft {
  awinmid: string;
  merchantName: string;
  domain: string;
  altDomainsRaw: string; // textarea — comma/newline separated
  commissionMin?: number | null;
  commissionMax?: number | null;
  cookieLength?: number | null;
  awinIndex?: number | null;
  status: AwinMerchantStatus;
  awinJoinUrl?: string | null;
  notes?: string | null;
}

export interface AwinMerchantWriteResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function parseAltDomains(raw: string): {
  domains: string[];
  rejected: string[];
} {
  const tokens = (raw ?? "")
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const domains: string[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    const n = normalizeMerchantDomain(t);
    if (!n) {
      rejected.push(t);
      continue;
    }
    if (seen.has(n)) continue;
    seen.add(n);
    domains.push(n);
  }
  return { domains, rejected };
}

function validateDraft(
  d: AwinMerchantDraft,
): { ok: true; domain: string; altDomains: string[] } | { ok: false; error: string } {
  if (!d.awinmid?.trim()) return { ok: false, error: "Awin merchant ID (awinmid) is required." };
  if (!/^\d+$/.test(d.awinmid.trim()))
    return { ok: false, error: "Awin merchant ID must be numeric." };
  if (!d.merchantName?.trim()) return { ok: false, error: "Merchant name is required." };

  const domain = normalizeMerchantDomain(d.domain);
  if (!domain)
    return {
      ok: false,
      error: "Domain is required and must be a valid hostname (e.g. collinastrada.com).",
    };

  const { domains: altDomains, rejected } = parseAltDomains(d.altDomainsRaw);
  if (rejected.length)
    return {
      ok: false,
      error: `Invalid alt domain${rejected.length === 1 ? "" : "s"}: ${rejected.slice(0, 3).join(", ")}${rejected.length > 3 ? "…" : ""}`,
    };

  if (
    d.commissionMin !== null &&
    d.commissionMin !== undefined &&
    (!Number.isFinite(d.commissionMin) || d.commissionMin < 0 || d.commissionMin > 100)
  )
    return { ok: false, error: "Commission min must be between 0 and 100." };

  if (
    d.commissionMax !== null &&
    d.commissionMax !== undefined &&
    (!Number.isFinite(d.commissionMax) || d.commissionMax < 0 || d.commissionMax > 100)
  )
    return { ok: false, error: "Commission max must be between 0 and 100." };

  if (
    d.commissionMin !== null &&
    d.commissionMin !== undefined &&
    d.commissionMax !== null &&
    d.commissionMax !== undefined &&
    d.commissionMax < d.commissionMin
  )
    return { ok: false, error: "Commission max must be greater than or equal to commission min." };

  return { ok: true, domain, altDomains };
}

export async function createAwinMerchantAction(
  draft: AwinMerchantDraft,
): Promise<AwinMerchantWriteResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.reason ?? "Forbidden" };

  const v = validateDraft(draft);
  if (!v.ok) return { ok: false, error: v.error };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("awin_merchants")
    .insert({
      awinmid: draft.awinmid.trim(),
      merchant_name: draft.merchantName.trim(),
      domain: v.domain,
      alt_domains: v.altDomains,
      commission_min: draft.commissionMin ?? null,
      commission_max: draft.commissionMax ?? null,
      cookie_length: draft.cookieLength ?? null,
      awin_index: draft.awinIndex ?? null,
      status: draft.status,
      awin_join_url: draft.awinJoinUrl?.trim() || null,
      notes: draft.notes?.trim() || null,
      created_by: auth.userId ?? null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.message.includes("awin_merchants_awinmid_key"))
      return { ok: false, error: `An Awin merchant with awinmid ${draft.awinmid} already exists.` };
    if (error.message.includes("awin_merchants_domain_key"))
      return { ok: false, error: `An Awin merchant with domain ${v.domain} already exists.` };
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/awin-merchants");
  return { ok: true, id: data.id };
}

export async function updateAwinMerchantAction(
  id: string,
  draft: AwinMerchantDraft,
): Promise<AwinMerchantWriteResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.reason ?? "Forbidden" };

  const v = validateDraft(draft);
  if (!v.ok) return { ok: false, error: v.error };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("awin_merchants")
    .update({
      awinmid: draft.awinmid.trim(),
      merchant_name: draft.merchantName.trim(),
      domain: v.domain,
      alt_domains: v.altDomains,
      commission_min: draft.commissionMin ?? null,
      commission_max: draft.commissionMax ?? null,
      cookie_length: draft.cookieLength ?? null,
      awin_index: draft.awinIndex ?? null,
      status: draft.status,
      awin_join_url: draft.awinJoinUrl?.trim() || null,
      notes: draft.notes?.trim() || null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/awin-merchants");
  revalidatePath(`/admin/awin-merchants/${id}`);
  return { ok: true, id };
}

export async function archiveAwinMerchantAction(
  id: string,
  archived: boolean,
): Promise<AwinMerchantWriteResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.reason ?? "Forbidden" };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("awin_merchants")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/awin-merchants");
  return { ok: true, id };
}
