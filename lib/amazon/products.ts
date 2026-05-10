/**
 * Amazon product enrichment cache layer.
 *
 * Reads from public.amazon_product_cache (populated by the enrich-amazon-asin
 * Edge Function via PA-API). Lazy strategy: when the dashboard renders, we
 * pull cache rows for the campaign ASINs. Misses get fired off to the EF
 * asynchronously — we don't await — so the user sees raw ASIN codes on this
 * render and enriched cards on the next refresh.
 *
 * Why not block? PA-API has tight TPS limits (1-10 depending on account
 * age) and is sometimes slow. Blocking the dashboard fetch on it would make
 * `/` jittery for no immediate benefit.
 */

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AmazonProduct {
  asin: string;
  title: string | null;
  imageUrl: string | null;
  detailPageUrl: string | null;
  fetchStatus: "pending" | "complete" | "failed";
  fetchError: string | null;
  lastFetchedAt: string | null;
}

interface CacheRow {
  asin: string;
  title: string | null;
  image_url: string | null;
  detail_page_url: string | null;
  fetch_status: "pending" | "complete" | "failed";
  fetch_error: string | null;
  last_fetched_at: string | null;
}

function rowToProduct(row: CacheRow): AmazonProduct {
  return {
    asin: row.asin,
    title: row.title,
    imageUrl: row.image_url,
    detailPageUrl: row.detail_page_url,
    fetchStatus: row.fetch_status,
    fetchError: row.fetch_error,
    lastFetchedAt: row.last_fetched_at,
  };
}

// Cache rows older than this are eligible for re-enrichment so prices /
// images stay fresh-ish. PA-API rate limits make truly-fresh impractical;
// 7 days is a reasonable middle ground for shopping commerce.
const CACHE_TTL_DAYS = 7;
// Failed rows retry much sooner — Microlink is flaky on Amazon (occasional
// Captchas / promo pages return no product data) and a 7-day wait would
// strand campaign ASINs as bare codes. 1 hour gives transient failures
// time to clear without hammering the API on every dashboard render.
const FAILED_RETRY_MS = 60 * 60 * 1000;

/**
 * Look up enriched product info for a list of ASINs. Returns a Map keyed by
 * ASIN. ASINs not yet cached map to undefined; the caller should render a
 * fallback (e.g. raw ASIN code) for those.
 *
 * Side effect: fires off enrich-amazon-asin in the background for ASINs
 * that are missing OR have a stale `last_fetched_at`. Returns immediately —
 * doesn't wait for enrichment to complete.
 */
export async function fetchAmazonProductsForAsins(
  asins: string[],
): Promise<Map<string, AmazonProduct>> {
  const dedupedAsins = Array.from(
    new Set(asins.map((a) => a.toUpperCase())),
  ).filter(Boolean);
  if (dedupedAsins.length === 0) return new Map();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("amazon_product_cache")
    .select(
      "asin, title, image_url, detail_page_url, fetch_status, fetch_error, last_fetched_at",
    )
    .in("asin", dedupedAsins);

  if (error) {
    console.warn("[amazon] fetchAmazonProductsForAsins error:", error.message);
    return new Map();
  }

  const map = new Map<string, AmazonProduct>();
  for (const row of (data ?? []) as CacheRow[]) {
    map.set(row.asin, rowToProduct(row));
  }

  // Identify which ASINs need (re-)enrichment. Two TTLs:
  //   - complete rows refresh after CACHE_TTL_DAYS
  //   - failed rows retry after FAILED_RETRY_MS (much sooner — Microlink
  //     flakiness is the dominant failure mode and recovers within minutes)
  const completeStaleCutoff = new Date(
    Date.now() - CACHE_TTL_DAYS * 86400 * 1000,
  );
  const failedStaleCutoff = new Date(Date.now() - FAILED_RETRY_MS);
  const toEnrich: string[] = [];
  for (const asin of dedupedAsins) {
    const cached = map.get(asin);
    if (!cached) {
      toEnrich.push(asin);
      continue;
    }
    const last = cached.lastFetchedAt ? new Date(cached.lastFetchedAt) : null;
    if (cached.fetchStatus === "complete") {
      if (!last || last < completeStaleCutoff) toEnrich.push(asin);
    } else if (cached.fetchStatus === "failed") {
      if (!last || last < failedStaleCutoff) toEnrich.push(asin);
    }
    // pending: another render is already enriching; don't pile on
  }

  if (toEnrich.length > 0) {
    // Fire-and-forget. We don't await; the EF runs server-side and the
    // result lands in the cache for the next dashboard render.
    void triggerEnrichment(toEnrich);
  }

  return map;
}

/**
 * Invoke enrich-amazon-asin without waiting. Splits >10 ASINs into batches
 * (PA-API GetItems caps at 10 per call). Best-effort; errors logged.
 */
async function triggerEnrichment(asins: string[]): Promise<void> {
  const supabase = createAdminClient();
  // Use Supabase's functions.invoke — service-role-keyed, doesn't need the
  // public anon key. Fires the call and resolves when the EF returns; we
  // intentionally don't propagate errors back to the caller.
  const batches: string[][] = [];
  for (let i = 0; i < asins.length; i += 10) {
    batches.push(asins.slice(i, i + 10));
  }
  await Promise.allSettled(
    batches.map((batch) =>
      supabase.functions
        .invoke("enrich-amazon-asin", { body: { asins: batch } })
        .catch((e) => {
          console.warn("[amazon] enrich invoke failed:", e);
        }),
    ),
  );
}
