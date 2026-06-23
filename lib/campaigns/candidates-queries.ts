import { createAdminClient } from "@/lib/supabase/admin";
import {
  rowToCandidate,
  type CampaignCandidate,
  type CampaignCandidateRow,
} from "@/types/campaigns";

/** Max candidate cards rendered per page load. The has_acc feed can surface
 *  ~1.5k eligible products; rendering them all at once is slow and unusable.
 *  Newest + highest-commission rise to the top, so the freshest batch shows
 *  first and the rest clear as Nicole/Kerri approve/deny and the daily run
 *  re-sorts. */
export const PENDING_CANDIDATES_PAGE_SIZE = 300;

export interface PendingCandidatesPage {
  candidates: CampaignCandidate[];
  total: number;
  shown: number;
}

/**
 * Pending campaign candidates — Amazon-bonus-eligible products auto-discovered
 * from the PartnerBoost `has_acc` feed, awaiting Nicole/Kerri's approve/deny.
 * Sorted newest-discovered first, then highest commission (longest-running
 * rises as it re-appears in each daily run, keeping its row fresh). Capped at
 * PENDING_CANDIDATES_PAGE_SIZE; `total` reports the full pending count so the
 * page can show "showing N of total". Admin-only (service role).
 */
export async function listPendingCandidates(): Promise<PendingCandidatesPage> {
  const supabase = createAdminClient();
  const { data, error, count } = await supabase
    .from("campaign_candidates")
    .select("*", { count: "exact" })
    .eq("status", "pending")
    .order("discovered_at", { ascending: false })
    .order("commission_rate_pct", { ascending: false, nullsFirst: false })
    .limit(PENDING_CANDIDATES_PAGE_SIZE);
  if (error) throw new Error(`listPendingCandidates: ${error.message}`);
  const candidates = (data as CampaignCandidateRow[]).map(rowToCandidate);
  return {
    candidates,
    total: count ?? candidates.length,
    shown: candidates.length,
  };
}
