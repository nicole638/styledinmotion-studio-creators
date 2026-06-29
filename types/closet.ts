/**
 * Closet item shape served to the creator web UI. Mirrors the mobile
 * app's ClothingItem (mobile/src/lib/state/lookStore.ts) but trimmed
 * to the columns the web v1 actually surfaces.
 *
 * Photo priority for display: cutout_photo_url > photo_url > original_photo_url.
 */
export type Category =
  | "Top"
  | "Pants"
  | "Dress" // combined "Dresses & Skirts" bucket (skirts fold in here)
  | "Shoes"
  | "Bag"
  | "Jewelry"
  | "Accessory"
  | "Outerwear"
  | "Intimates"
  | "Swimwear"
  | "Other";

/**
 * Async-fetch lifecycle for a closet item. The Add Item flow inserts rows with
 * fetch_status='pending', a Postgres trigger fires the scrape-product Edge
 * Function, and the EF flips it to 'complete'/'partial'/'failed' on its own.
 *   pending  → scrape in flight; UI shows "Fetching…" placeholder card.
 *   complete → all metadata populated.
 *   partial  → some fields populated, others failed (e.g. name+price, no image).
 *   failed   → scrape errored; fetchError carries a human-readable reason.
 */
export type FetchStatus = "pending" | "complete" | "partial" | "failed";

export interface ClosetItem {
  id: string;
  name: string | null;
  brand: string | null;
  category: Category | null;
  price: string | null; // numeric-as-string from Postgres; format on render
  url: string | null;
  affiliateUrl: string | null;
  photoUrl: string | null; // resolved (cutout > photo > original)
  /**
   * Up to 6 candidate image URLs from the scrape pipeline, in merchant
   * priority order. Surfaces in the Edit form as a picker so creators
   * can swap to a different image without re-fetching. Empty array =
   * only one usable image, picker doesn't render.
   */
  candidatePhotoUrls: string[];
  archived: boolean;
  defaultWornSize: string | null;
  createdAt: string;
  fetchStatus: FetchStatus;
  fetchError: string | null;
  /**
   * Whether this item's brand + category passes TheRealReal's consignment
   * intake (per `trr_accepted_brands`). Populated by a Postgres trigger
   * on insert/update. The Consign pill renders when true.
   */
  trrEligible: boolean;
}

/** Raw Supabase row shape (snake_case). Internal — don't export from app code. */
export interface ClosetItemRow {
  id: string;
  name: string | null;
  brand: string | null;
  category: string | null;
  price: string | null;
  url: string | null;
  affiliate_url: string | null;
  photo_url: string | null;
  cutout_photo_url: string | null;
  original_photo_url: string | null;
  candidate_photo_urls: string[] | null;
  archived: boolean;
  default_worn_size: string | null;
  created_at: string;
  fetch_status: FetchStatus | null;
  fetch_error: string | null;
  trr_eligible: boolean | null;
}

export function rowToClosetItem(row: ClosetItemRow): ClosetItem {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    category: (row.category as Category | null) ?? null,
    price: row.price,
    url: row.url,
    affiliateUrl: row.affiliate_url,
    photoUrl:
      row.cutout_photo_url || row.photo_url || row.original_photo_url || null,
    candidatePhotoUrls: row.candidate_photo_urls ?? [],
    archived: row.archived,
    defaultWornSize: row.default_worn_size,
    createdAt: row.created_at,
    // Pre-async-pipeline rows have fetch_status NULL; treat those as complete
    // so legacy items don't suddenly render as "Fetching…" placeholders.
    fetchStatus: (row.fetch_status ?? "complete") as FetchStatus,
    fetchError: row.fetch_error,
    trrEligible: row.trr_eligible ?? false,
  };
}

export function formatPrice(raw: string | null): string {
  if (!raw) return "—";
  const n = Number.parseFloat(raw);
  if (Number.isNaN(n)) return "—";
  return n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`;
}
