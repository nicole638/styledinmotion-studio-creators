import { createClient } from "@/lib/supabase/server";
import {
  type Look,
  type LookRow,
  rowToLook,
  type LookStatus,
} from "@/types/look";

const LOOK_COLUMNS =
  "id, title, caption, cover_photo_url, short_code, archived, published_at, clicks, created_at, updated_at";

export interface FetchLooksOptions {
  view?: LookStatus;
  search?: string;
}

/**
 * Fetch the signed-in creator's looks. RLS scopes by creator_id automatically.
 * Returned rows are joined with their look_items count so the card can show
 * "5 pieces" without N+1 round-trips.
 */
export async function fetchLooks(
  options: FetchLooksOptions = {},
): Promise<Look[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from("looks")
    .select(`${LOOK_COLUMNS}, look_items(count)`)
    .eq("creator_id", user.id);

  // Apply status-driven filters
  const view = options.view ?? "published";
  if (view === "archived") {
    query = query.eq("archived", true);
  } else if (view === "draft") {
    query = query.eq("archived", false).is("published_at", null);
  } else {
    // published
    query = query.eq("archived", false).not("published_at", "is", null);
  }

  // Order: drafts by updated_at desc, others by published_at desc fallback created_at
  query = query.order(
    view === "draft" ? "updated_at" : "published_at",
    { ascending: false, nullsFirst: false },
  );

  if (options.search && options.search.trim()) {
    const term = options.search.trim().replace(/[%,]/g, "");
    query = query.or(`title.ilike.%${term}%,caption.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[looks] fetchLooks error:", error.message);
    return [];
  }

  // Cast through unknown — Supabase's generated types don't carry the
  // foreign-table count aggregate shape correctly.
  type RawRow = LookRow & { look_items?: Array<{ count: number }> };
  return ((data ?? []) as unknown as RawRow[]).map((row) => {
    const itemCount =
      Array.isArray(row.look_items) && row.look_items[0]
        ? row.look_items[0].count
        : 0;
    return rowToLook(row, itemCount);
  });
}

export async function fetchLookCounts(): Promise<{
  published: number;
  drafts: number;
  archived: number;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { published: 0, drafts: 0, archived: 0 };

  const [published, drafts, archived] = await Promise.all([
    supabase
      .from("looks")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", user.id)
      .eq("archived", false)
      .not("published_at", "is", null),
    supabase
      .from("looks")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", user.id)
      .eq("archived", false)
      .is("published_at", null),
    supabase
      .from("looks")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", user.id)
      .eq("archived", true),
  ]);

  return {
    published: published.count ?? 0,
    drafts: drafts.count ?? 0,
    archived: archived.count ?? 0,
  };
}
