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
    name: draft.name.trim() || null,
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
    name: d.name.trim() || null,
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
      name: draft.name.trim() || null,
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
