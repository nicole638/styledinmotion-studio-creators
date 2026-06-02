import { createClient } from "@/lib/supabase/server";
import type {
  AffiliateNetwork,
  BrandDepartment,
  BrandProduct,
  Merchant,
} from "@/types/brands";

/**
 * Brands index — every active merchant from the `affiliate_merchants` view
 * (Awin + Rakuten + CJ UNION ALL). Already filtered to status='active'
 * AND archived_at IS NULL inside the view, but we keep the explicit guard
 * here in case the view changes shape. Sorted by name so the grid is
 * predictable and search-by-eye is fast.
 *
 * Search: ilike on merchant_name (case-insensitive prefix anywhere). Keep
 * it server-side so we don't ship 300+ merchant rows to the client.
 */
export async function fetchMerchants(opts: {
  search?: string;
} = {}): Promise<Merchant[]> {
  const supabase = createClient();
  let q = supabase
    .from("affiliate_merchants")
    .select(
      "id, network, network_mid, merchant_name, domain, logo_url, description, " +
        "commission_min, commission_max, cookie_length, primary_sector, country_code, " +
        "feed_last_product_count, feed_last_synced_at, status, archived_at",
    )
    .eq("status", "active")
    .is("archived_at", null)
    .order("merchant_name", { ascending: true });

  const search = (opts.search ?? "").trim();
  if (search.length > 0) {
    q = q.ilike("merchant_name", `%${search}%`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (data ?? []).map(rowToMerchant);
}

/** Single merchant lookup — used by /brands/[id] page header. */
export async function fetchMerchant(id: string): Promise<Merchant | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("affiliate_merchants")
    .select(
      "id, network, network_mid, merchant_name, domain, logo_url, description, " +
        "commission_min, commission_max, cookie_length, primary_sector, country_code, " +
        "feed_last_product_count, feed_last_synced_at, status, archived_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToMerchant(data);
}

export interface FetchBrandProductsOpts {
  merchantId: string;
  /** Free-text query — ilike against product name. Trigram-equivalent UX
   *  without needing the pg_trgm extension on the client side. */
  search?: string;
  /** Filter to a single department chip. Empty = "All". */
  department?: BrandDepartment | "";
  /** Page index, 0-based. */
  page?: number;
  /** Rows per page. Defaults to 48 (8x6 grid). */
  pageSize?: number;
}

export interface BrandProductsPage {
  items: BrandProduct[];
  total: number;
  hasMore: boolean;
}

/**
 * Per-brand catalog query. Filters: merchant_id (always), department
 * (optional), search (optional). Returns only in-stock, non-removed rows.
 *
 * The matview already collapses Rakuten variants and dedupes by SKU. Sort
 * key matches the iOS Brands-tab catalog: `created_at DESC` so the most
 * recently-added products surface first. Both `(merchant_id, created_at
 * DESC)` and `(merchant_id, first_seen_at DESC)` composites exist (tasks
 * #115/#116) so this is a sub-100ms query even for the 38K-row brands.
 */
export async function fetchBrandProducts(
  opts: FetchBrandProductsOpts,
): Promise<BrandProductsPage> {
  const supabase = createClient();
  const page = Math.max(0, opts.page ?? 0);
  const pageSize = Math.max(1, Math.min(100, opts.pageSize ?? 48));
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("affiliate_products")
    .select(
      "id, network, merchant_id, name, brand, department, category, price, " +
        "currency, in_stock, product_url, deep_link, image_urls",
      { count: "exact" },
    )
    .eq("merchant_id", opts.merchantId)
    .eq("in_stock", true)
    .is("removed_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  const search = (opts.search ?? "").trim();
  if (search.length > 0) {
    q = q.ilike("name", `%${search}%`);
  }

  const dept = (opts.department ?? "").trim();
  if (dept.length > 0) {
    q = q.eq("department", dept);
  }

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const items = (data ?? []).map(rowToBrandProduct);
  const total = count ?? items.length;
  return { items, total, hasMore: to + 1 < total };
}

/**
 * Single-product fetch by id — used by the Add-to-closet server action to
 * resolve all the fields it needs (raw URL, wrapped URL, image array,
 * brand) from one matview row keyed by id. Keeps the action small.
 */
export async function fetchBrandProductById(
  id: string,
): Promise<BrandProduct | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("affiliate_products")
    .select(
      "id, network, merchant_id, name, brand, department, category, price, " +
        "currency, in_stock, product_url, deep_link, image_urls",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToBrandProduct(data);
}

/**
 * For the per-brand catalog page: which of the visible product URLs is the
 * creator already showing in their closet? Returned as a Set of `url`
 * strings — matches `creator_items.url`, which is the raw or feed-wrapped
 * URL the Add-to-closet action stores. Used to morph the per-card pill
 * from "+ Add" to "✓ Added" without a per-card round-trip.
 *
 * Dedupe key is the `product_url` from the matview. Since the same
 * product across multiple "Add" taps produces the same `url`, a string-
 * equality match is precise enough until we add a proper foreign key
 * (`creator_items.source_product_id` — future migration).
 */
export async function fetchCreatorAddedUrls(
  creatorId: string,
  productUrls: string[],
): Promise<Set<string>> {
  if (productUrls.length === 0) return new Set();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("creator_items")
    .select("url")
    .eq("creator_id", creatorId)
    .eq("archived", false)
    .in("url", productUrls);
  if (error) {
    // Non-fatal — fall back to an empty set so the page still renders.
    console.warn("[brands] fetchCreatorAddedUrls failed:", error.message);
    return new Set();
  }
  const set = new Set<string>();
  for (const r of data ?? []) {
    if (r.url) set.add(r.url as string);
  }
  return set;
}

// ─── Row mappers ────────────────────────────────────────────────────────

function rowToMerchant(r: any): Merchant {
  return {
    id: r.id,
    network: r.network as AffiliateNetwork,
    networkMid: r.network_mid ?? null,
    merchantName: r.merchant_name,
    domain: r.domain ?? null,
    logoUrl: r.logo_url ?? null,
    description: r.description ?? null,
    commissionMin: r.commission_min ?? null,
    commissionMax: r.commission_max ?? null,
    cookieLength: r.cookie_length ?? null,
    primarySector: r.primary_sector ?? null,
    countryCode: r.country_code ?? null,
    feedLastProductCount: r.feed_last_product_count ?? null,
    feedLastSyncedAt: r.feed_last_synced_at ?? null,
  };
}

function rowToBrandProduct(r: any): BrandProduct {
  const images = Array.isArray(r.image_urls) ? (r.image_urls as string[]) : [];
  return {
    id: r.id,
    network: r.network as AffiliateNetwork,
    merchantId: r.merchant_id,
    name: r.name,
    brand: r.brand ?? null,
    department: r.department ?? null,
    category: r.category ?? null,
    price: r.price !== null && r.price !== undefined ? Number(r.price) : null,
    currency: r.currency ?? null,
    inStock: r.in_stock ?? null,
    productUrl: r.product_url ?? null,
    deepLink: r.deep_link ?? null,
    imageUrls: images,
    primaryImageUrl: images[0] ?? null,
  };
}
