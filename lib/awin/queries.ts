import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  rowToAwinMerchant,
  normalizeMerchantDomain,
  type AwinMerchant,
  type AwinMerchantRow,
} from "@/types/awin";

/**
 * Admin list — every Awin merchant, ordered by status priority (active
 * first, then pending, paused, terminated), with most recently updated
 * at the top within each bucket.
 */
export async function listAwinMerchantsForAdmin(): Promise<AwinMerchant[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("awin_merchants")
    .select("*")
    .order("archived_at", { ascending: true, nullsFirst: true })
    .order("status", { ascending: true })
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`listAwinMerchantsForAdmin: ${error.message}`);
  return (data as AwinMerchantRow[]).map(rowToAwinMerchant);
}

export async function getAwinMerchantById(
  id: string,
): Promise<AwinMerchant | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("awin_merchants")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getAwinMerchantById: ${error.message}`);
  return data ? rowToAwinMerchant(data as AwinMerchantRow) : null;
}

/**
 * Used by the closet Add flow to detect "this brand is on Awin" matches
 * on the URL the creator just pasted. Returns the active merchant whose
 * `domain` or any `alt_domains` entry matches the URL's host.
 *
 * Domain normalization (lowercase, strip leading www.) happens inside.
 */
export async function findAwinMerchantForUrl(
  url: string,
): Promise<AwinMerchant | null> {
  const host = normalizeMerchantDomain(url);
  if (!host) return null;

  const supabase = createClient();
  // alt_domains is a GIN-indexed text[]; we use the contains operator (cs)
  // so the index does the heavy lifting. We also OR against the primary
  // `domain` column. PostgREST .or() needs explicit parenthesized predicates.
  const { data, error } = await supabase
    .from("awin_merchants")
    .select("*")
    .eq("status", "active")
    .is("archived_at", null)
    .or(`domain.eq.${host},alt_domains.cs.{${host}}`)
    .limit(1)
    .maybeSingle();
  if (error) {
    // Soft-fail — auto-wrap is an enhancement, never break the form.
    console.warn("findAwinMerchantForUrl:", error.message);
    return null;
  }
  return data ? rowToAwinMerchant(data as AwinMerchantRow) : null;
}
