import { createClient } from "@/lib/supabase/server";
import {
  type ClosetItem,
  type ClosetItemRow,
  rowToClosetItem,
} from "@/types/closet";

const ITEM_COLUMNS =
  "id, name, brand, category, price, url, affiliate_url, photo_url, cutout_photo_url, original_photo_url, candidate_photo_urls, archived, default_worn_size, created_at, fetch_status, fetch_error, trr_eligible";

export interface FetchClosetOptions {
  archivedOnly?: boolean;
  search?: string;
  category?: string;
}

/**
 * Fetch the signed-in creator's closet. RLS scopes by creator_id automatically
 * (creator_items.creator_id = auth.uid()).
 */
export async function fetchClosetItems(
  options: FetchClosetOptions = {},
): Promise<ClosetItem[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from("creator_items")
    .select(ITEM_COLUMNS)
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  query = options.archivedOnly
    ? query.eq("archived", true)
    : query.eq("archived", false);

  if (options.category) {
    query = query.eq("category", options.category);
  }

  if (options.search && options.search.trim()) {
    const term = options.search.trim().replace(/[%,]/g, "");
    // Case-insensitive match on name, brand, OR category (so typing
    // "swim", "alo", or "cap" all work). name/brand are gin_trgm-indexed.
    query = query.or(
      `name.ilike.%${term}%,brand.ilike.%${term}%,category.ilike.%${term}%`,
    );
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[closet] fetchClosetItems error:", error.message);
    return [];
  }

  return ((data ?? []) as ClosetItemRow[]).map(rowToClosetItem);
}

/**
 * Distinct brands the signed-in creator has previously used. Powers the
 * brand-autocomplete on Add/Edit Item forms — most creators reuse a small
 * set of brands across many items, so a typeahead pulled from their own
 * history is more useful than any curated global brand list.
 *
 * Sorted alphabetically, case-insensitive. Empty/null brands filtered out.
 */
export async function fetchCreatorBrands(): Promise<string[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("creator_items")
    .select("brand")
    .eq("creator_id", user.id)
    .not("brand", "is", null)
    .neq("brand", "");

  if (error) {
    console.warn("[closet] fetchCreatorBrands error:", error.message);
    return [];
  }

  const set = new Set<string>();
  for (const row of (data ?? []) as Array<{ brand: string | null }>) {
    const b = row.brand?.trim();
    if (b) set.add(b);
  }
  return Array.from(set).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

export async function fetchClosetCounts(): Promise<{
  active: number;
  archived: number;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { active: 0, archived: 0 };

  const [active, archived] = await Promise.all([
    supabase
      .from("creator_items")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", user.id)
      .eq("archived", false),
    supabase
      .from("creator_items")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", user.id)
      .eq("archived", true),
  ]);

  return {
    active: active.count ?? 0,
    archived: archived.count ?? 0,
  };
}
