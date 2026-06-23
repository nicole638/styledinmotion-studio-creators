import { createAdminClient } from "@/lib/supabase/admin";
import {
  rowToCandidate,
  type CampaignCandidate,
  type CampaignCandidateRow,
} from "@/types/campaigns";

/** Max candidate cards rendered per page load. */
export const PENDING_CANDIDATES_PAGE_SIZE = 300;

/** Which learned bucket to show. "all" = no filter. */
export type CandidateFilter =
  | "all"
  | "fashion"
  | "accessory"
  | "non_fashion"
  | "unsure";

export interface CandidateCounts {
  total: number;
  fashion: number;
  accessory: number;
  non_fashion: number;
  unsure: number;
}

export interface PendingCandidatesPage {
  candidates: CampaignCandidate[];
  /** Cards actually returned (after the page-size cap). */
  shown: number;
  /** Pending count for the active filter (what `shown` is a slice of). */
  filterTotal: number;
  /** Counts per learned bucket across the whole (post-exclusion) queue. */
  counts: CandidateCounts;
  /** Amazon departments Nicole/Kerri have blocked from the queue. */
  excludedCategories: string[];
}

async function getCounts(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<CandidateCounts> {
  const { data, error } = await supabase.rpc("pending_candidate_counts");
  if (error) throw new Error(`pending_candidate_counts: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    total: Number(row?.total ?? 0),
    fashion: Number(row?.fashion ?? 0),
    accessory: Number(row?.accessory ?? 0),
    non_fashion: Number(row?.non_fashion ?? 0),
    unsure: Number(row?.unsure ?? 0),
  };
}

async function getExcludedCategories(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("campaign_category_exclusions")
    .select("category")
    .order("category");
  if (error) return []; // non-fatal: the queue still works without the label
  return (data ?? [])
    .map((r: { category: string | null }) => r.category ?? "")
    .filter((c) => c.length > 0);
}

/**
 * The campaign review queue: Amazon-bonus-eligible products from the
 * PartnerBoost `has_acc` feed, MINUS the departments Nicole/Kerri have blocked
 * (Pet Supplies, Electronics, etc. — see campaign_category_exclusions). Reads
 * the `v_pending_products` view: one row per product, with color/size ASIN
 * variants rolled up (so 28 wader ASINs show as one card; approving covers
 * all of them).
 *
 * `filter` narrows to a learned bucket. The guess comes from each product's
 * words + category overrides and sharpens every time something is approved or
 * denied. Sorted by department priority, then newest, then highest commission.
 * Admin-only.
 */
export async function listPendingCandidates(
  filter: CandidateFilter = "all",
): Promise<PendingCandidatesPage> {
  const supabase = createAdminClient();

  let q = supabase.from("v_pending_products").select("*");
  if (filter !== "all") q = q.eq("predicted", filter);

  // Department priority (Clothing → Sports & Outdoors → rest), then newest,
  // then highest commission. One row per product (variants rolled up).
  const { data, error } = await q
    .order("category_rank", { ascending: true })
    .order("discovered_at", { ascending: false })
    .order("commission_rate_pct", { ascending: false, nullsFirst: false })
    .limit(PENDING_CANDIDATES_PAGE_SIZE);
  if (error) throw new Error(`listPendingCandidates: ${error.message}`);

  const [counts, excludedCategories] = await Promise.all([
    getCounts(supabase),
    getExcludedCategories(supabase),
  ]);

  const candidates = (data as CampaignCandidateRow[]).map(rowToCandidate);
  const filterTotal =
    filter === "all" ? counts.total : counts[filter];

  return {
    candidates,
    shown: candidates.length,
    filterTotal,
    counts,
    excludedCategories,
  };
}
