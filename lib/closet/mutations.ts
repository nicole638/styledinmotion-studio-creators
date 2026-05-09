"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchProductInfo, ScrapeError } from "./scrape";

export interface AddItemDraft {
  name: string;
  brand: string;
  price: string;
  category: string;
  url: string;
  defaultWornSize: string;
  photoUrl: string;
  originalPhotoUrl: string;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
  itemId?: string;
}

// ─── Async/queued add (post-insert reveal) ─────────────────────────────
//
// Replaces the synchronous scrape-then-preview flow. The client just
// INSERTs a row with fetch_status='pending'; a Postgres trigger fires the
// scrape-product Edge Function, which populates name/brand/price/photo and
// flips fetch_status to 'complete' (or 'partial'/'failed'). The closet
// page subscribes to Realtime for live updates.

export interface QuickAddResult {
  ok: boolean;
  error?: string;
  itemId?: string;
}

/**
 * Insert a single placeholder row from just a URL. The trigger handles the
 * scrape; the closet UI shows a "Fetching…" card until the EF writes back.
 * Returns the new item id so the client can optimistically navigate or scroll.
 */
export async function quickAddItemPendingAction(
  url: string,
): Promise<QuickAddResult> {
  if (!url || !/^https?:\/\//i.test(url.trim())) {
    return { ok: false, error: "Enter a full URL starting with http(s)://" };
  }
  const cleaned = url.trim();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase
    .from("creator_items")
    .insert({
      creator_id: user.id,
      name: safeName("", cleaned),
      url: cleaned,
      fetch_status: "pending",
      archived: false,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/closet");
  return { ok: true, itemId: data.id };
}

export interface BulkQuickAddResult {
  ok: boolean;
  inserted: number;
  error?: string;
}

/**
 * Bulk paste variant: insert many pending rows in one statement, all under
 * the same creator. The trigger fires per-row, so each one independently
 * scrapes in the background. UI shows them all as "Fetching…" cards.
 */
export async function bulkQuickAddItemsPendingAction(
  urls: string[],
): Promise<BulkQuickAddResult> {
  const cleaned = Array.from(
    new Set(
      urls
        .map((u) => u.trim())
        .filter((u) => /^https?:\/\//i.test(u)),
    ),
  );
  if (cleaned.length === 0) {
    return { ok: false, inserted: 0, error: "No valid URLs to insert." };
  }
  if (cleaned.length > 30) {
    return {
      ok: false,
      inserted: 0,
      error: "Max 30 URLs per batch. Paste fewer.",
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, inserted: 0, error: "Not signed in." };

  const rows = cleaned.map((url) => ({
    creator_id: user.id,
    name: safeName("", url),
    url,
    fetch_status: "pending",
    archived: false,
  }));

  const { error, data } = await supabase
    .from("creator_items")
    .insert(rows)
    .select("id");

  if (error) return { ok: false, inserted: 0, error: error.message };

  revalidatePath("/closet");
  return { ok: true, inserted: data?.length ?? 0 };
}

/**
 * Manual re-fetch: flip an existing item's fetch_status back to 'pending'
 * to retrigger the scrape-product EF. Useful when a previous scrape failed
 * or a merchant updated their photo / metadata.
 */
export async function refetchItemAsyncAction(
  itemId: string,
): Promise<SaveResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("creator_items")
    .update({
      fetch_status: "pending",
      fetch_started_at: null,
      fetch_completed_at: null,
      fetch_error: null,
    })
    .eq("id", itemId)
    .eq("creator_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/closet");
  revalidatePath(`/closet/${itemId}`);
  return { ok: true, itemId };
}

// ─── Synchronous (legacy) add — kept during the transition ─────────────

/** Insert a single closet item from a fully-formed draft. */
export async function addClosetItemAction(
  draft: AddItemDraft,
): Promise<SaveResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const payload = {
    creator_id: user.id,
    name: safeName(draft.name, draft.url),
    brand: draft.brand.trim() || null,
    category: draft.category.trim() || null,
    price: draft.price.trim() || null,
    url: draft.url.trim() || null,
    photo_url: draft.photoUrl.trim() || null,
    original_photo_url: draft.originalPhotoUrl.trim() || null,
    default_worn_size: draft.defaultWornSize.trim() || null,
    archived: false,
  };

  const { data, error } = await supabase
    .from("creator_items")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/closet");
  return { ok: true, itemId: data.id };
}

/**
 * Server action: scrape a URL and return the product info so the
 * client can render a review form before final save.
 */
export interface ScrapeActionResult {
  ok: boolean;
  data?: AddItemDraft;
  error?: string;
}

export async function scrapeUrlAction(url: string): Promise<ScrapeActionResult> {
  if (!url || !/^https?:\/\//i.test(url.trim())) {
    return { ok: false, error: "Enter a full URL starting with http(s)://" };
  }

  try {
    const product = await fetchProductInfo(url.trim());
    // Treat empty-payload scrapes as failures. If the backend returns 200
    // but couldn't extract anything useful (no name AND no photo), the row
    // would otherwise land in the closet as an unnamed/imageless ghost.
    if (!product.name && !product.imageUrl) {
      return {
        ok: false,
        error:
          "Scraper returned 200 but no product details. The page might require login, be a search result, or be blocked by the merchant. Try the canonical product page URL.",
      };
    }
    return {
      ok: true,
      data: {
        name: product.name ?? "",
        brand: product.brand ?? "",
        price: product.price ?? "",
        category: "",
        url: product.canonicalUrl ?? url.trim(),
        defaultWornSize: "",
        photoUrl: product.imageUrl ?? "",
        originalPhotoUrl:
          product.originalImageUrl ?? product.imageUrl ?? "",
      },
    };
  } catch (e: any) {
    if (e instanceof ScrapeError) {
      return { ok: false, error: `${e.message}${e.detail ? ` — ${e.detail}` : ""}` };
    }
    return { ok: false, error: e?.message ?? "Scrape failed" };
  }
}

/**
 * NOT NULL fallback for creator_items.name. Tries to derive a useful
 * label from the URL when the user hasn't named the item — never empty
 * string or null, so the DB constraint can't bite.
 */
function safeName(rawName: string, rawUrl: string): string {
  const trimmed = rawName.trim();
  if (trimmed) return trimmed;
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.replace(/^www\./, "").split(".")[0];
    if (host) {
      const pretty = host[0].toUpperCase() + host.slice(1);
      return `${pretty} item`;
    }
  } catch {
    // fall through
  }
  return "Untitled piece";
}

/** Bulk variant: scrape an array of URLs in parallel; returns one slot per URL. */
export interface BulkScrapeRow {
  url: string;
  ok: boolean;
  data?: AddItemDraft;
  error?: string;
}
export async function bulkScrapeAction(
  urls: string[],
): Promise<BulkScrapeRow[]> {
  const cleaned = urls
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//i.test(u));

  return Promise.all(
    cleaned.map(async (url): Promise<BulkScrapeRow> => {
      const r = await scrapeUrlAction(url);
      return { url, ok: r.ok, data: r.data, error: r.error };
    }),
  );
}

/** Bulk insert (called after the bulk scrape review screen). */
export async function bulkAddClosetItemsAction(
  drafts: AddItemDraft[],
): Promise<{ ok: boolean; inserted: number; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, inserted: 0, error: "Not signed in." };

  if (drafts.length === 0) {
    return { ok: false, inserted: 0, error: "No items to insert." };
  }

  const rows = drafts.map((d) => ({
    creator_id: user.id,
    name: safeName(d.name, d.url),
    brand: d.brand.trim() || null,
    category: d.category.trim() || null,
    price: d.price.trim() || null,
    url: d.url.trim() || null,
    photo_url: d.photoUrl.trim() || null,
    original_photo_url: d.originalPhotoUrl.trim() || null,
    default_worn_size: d.defaultWornSize.trim() || null,
    archived: false,
  }));

  const { error, data } = await supabase
    .from("creator_items")
    .insert(rows)
    .select("id");

  if (error) {
    return { ok: false, inserted: 0, error: error.message };
  }

  revalidatePath("/closet");
  return { ok: true, inserted: data?.length ?? 0 };
}

// ---- Edit ----

export interface UpdateItemDraft {
  id: string;
  name: string;
  brand: string;
  price: string;
  category: string;
  url: string;
  defaultWornSize: string;
  photoUrl: string;
}

export async function updateClosetItemAction(
  draft: UpdateItemDraft,
): Promise<SaveResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("creator_items")
    .update({
      name: safeName(draft.name, draft.url),
      brand: draft.brand.trim() || null,
      category: draft.category.trim() || null,
      price: draft.price.trim() || null,
      url: draft.url.trim() || null,
      photo_url: draft.photoUrl.trim() || null,
      default_worn_size: draft.defaultWornSize.trim() || null,
    })
    .eq("id", draft.id)
    .eq("creator_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/closet");
  revalidatePath(`/closet/${draft.id}`);
  return { ok: true, itemId: draft.id };
}

export async function archiveClosetItemAction(
  itemId: string,
  archived: boolean,
): Promise<SaveResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("creator_items")
    .update({ archived })
    .eq("id", itemId)
    .eq("creator_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/closet");
  return { ok: true, itemId };
}

/**
 * Permanently delete a closet item. Refuses if the item is referenced by
 * any look_items rows — those would orphan published looks. Caller should
 * fall back to archiveClosetItemAction in that case (UI surfaces this as
 * "this piece is in {N} look(s) — archive instead").
 *
 * RLS on creator_items + the eq("creator_id", user.id) check ensure
 * creators can only delete their own items.
 */
export interface DeleteResult extends SaveResult {
  /** Number of looks that reference this item (only set when ok=false because of references). */
  referencedByLooks?: number;
}

export async function deleteClosetItemAction(
  itemId: string,
): Promise<DeleteResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Check whether this item is in any looks.
  const { count: lookRefs, error: countErr } = await supabase
    .from("look_items")
    .select("id", { count: "exact", head: true })
    .eq("creator_item_id", itemId);

  if (countErr) return { ok: false, error: countErr.message };

  if ((lookRefs ?? 0) > 0) {
    return {
      ok: false,
      referencedByLooks: lookRefs ?? 0,
      error: `This piece is tagged in ${lookRefs} look${lookRefs === 1 ? "" : "s"}. Archive it instead, or remove it from those looks first.`,
    };
  }

  const { error } = await supabase
    .from("creator_items")
    .delete()
    .eq("id", itemId)
    .eq("creator_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/closet");
  return { ok: true, itemId };
}

/**
 * Persist a creator-edited crop. The client uploads the cropped PNG to
 * the item-photos bucket first (gets a public URL), then calls this to
 * point creator_items.photo_url at the new asset. We leave
 * original_photo_url alone so a future Re-fetch can restore.
 */
export async function applyEditedPhotoAction(
  itemId: string,
  newPhotoUrl: string,
): Promise<SaveResult> {
  if (!newPhotoUrl || !/^https?:\/\//i.test(newPhotoUrl)) {
    return { ok: false, error: "Invalid photo URL." };
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("creator_items")
    .update({ photo_url: newPhotoUrl })
    .eq("id", itemId)
    .eq("creator_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/closet");
  revalidatePath(`/closet/${itemId}`);
  return { ok: true, itemId };
}

/** Re-scrape an item's URL and update its photo. */
export async function refetchItemPhotoAction(
  itemId: string,
  url: string,
): Promise<SaveResult> {
  if (!url || !/^https?:\/\//i.test(url.trim())) {
    return { ok: false, error: "Item has no valid URL to refetch from." };
  }
  try {
    const product = await fetchProductInfo(url.trim());
    if (!product.imageUrl) {
      return { ok: false, error: "Scrape returned no photo." };
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not signed in." };

    const { error } = await supabase
      .from("creator_items")
      .update({
        photo_url: product.imageUrl,
        original_photo_url: product.originalImageUrl ?? product.imageUrl,
      })
      .eq("id", itemId)
      .eq("creator_id", user.id);

    if (error) return { ok: false, error: error.message };
    revalidatePath(`/closet/${itemId}`);
    revalidatePath("/closet");
    return { ok: true, itemId };
  } catch (e: any) {
    if (e instanceof ScrapeError) {
      return { ok: false, error: `${e.message}${e.detail ? ` — ${e.detail}` : ""}` };
    }
    return { ok: false, error: e?.message ?? "Refetch failed" };
  }
}
