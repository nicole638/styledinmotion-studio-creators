"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateShortCode } from "./short-code";

export interface ComposerItem {
  /** creator_items.id */
  itemId: string;
  /** Free-text size label, e.g. "M", "8", "32B". Empty → null. */
  wornSize: string;
}

export interface ComposerDraft {
  /** Set when editing; absent when creating. */
  id?: string;
  title: string;
  caption: string;
  coverPhotoUrl: string;
  items: ComposerItem[];
}

export interface SaveResult {
  ok: boolean;
  error?: string;
  lookId?: string;
}

/**
 * Create a new look. `publish=true` sets published_at=now(), `publish=false`
 * leaves it NULL (draft). short_code is generated server-side with retry on
 * the (rare) unique-violation collision.
 */
export async function createLookAction(
  draft: ComposerDraft,
  publish: boolean,
): Promise<SaveResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const title = draft.title.trim();
  if (!title) return { ok: false, error: "Title is required." };

  // Try inserting up to 3 times on short_code collision.
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const shortCode = generateShortCode();
    const { data, error } = await supabase
      .from("looks")
      .insert({
        creator_id: user.id,
        title,
        caption: draft.caption.trim() || "",
        cover_photo_url: draft.coverPhotoUrl.trim() || "",
        short_code: shortCode,
        published_at: publish ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    if (!error && data) {
      const lookId = data.id;
      const itemErr = await replaceLookItems(lookId, draft.items);
      if (itemErr) return { ok: false, error: itemErr };
      revalidatePath("/looks");
      return { ok: true, lookId };
    }

    lastError = error?.message ?? "Unknown insert error";
    // Only retry on unique-violation against short_code; otherwise bail.
    if (!/short_code|duplicate key/i.test(lastError)) break;
  }

  return { ok: false, error: lastError ?? "Could not create look." };
}

/** Update an existing look's fields + replace its tagged items. */
export async function updateLookAction(
  draft: ComposerDraft,
): Promise<SaveResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!draft.id) return { ok: false, error: "Missing look id." };

  const title = draft.title.trim();
  if (!title) return { ok: false, error: "Title is required." };

  const { error } = await supabase
    .from("looks")
    .update({
      title,
      caption: draft.caption.trim() || "",
      cover_photo_url: draft.coverPhotoUrl.trim() || "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", draft.id)
    .eq("creator_id", user.id);

  if (error) return { ok: false, error: error.message };

  const itemErr = await replaceLookItems(draft.id, draft.items);
  if (itemErr) return { ok: false, error: itemErr };

  revalidatePath("/looks");
  revalidatePath(`/looks/${draft.id}`);
  revalidatePath(`/looks/${draft.id}/edit`);
  return { ok: true, lookId: draft.id };
}

/** Replace the look_items rows for a look. RLS scopes via look ownership. */
async function replaceLookItems(
  lookId: string,
  items: ComposerItem[],
): Promise<string | null> {
  const supabase = createClient();
  const { error: delErr } = await supabase
    .from("look_items")
    .delete()
    .eq("look_id", lookId);
  if (delErr) return `Could not clear old items: ${delErr.message}`;

  if (items.length === 0) return null;

  const rows = items.map((it, idx) => ({
    look_id: lookId,
    creator_item_id: it.itemId,
    sort_order: idx,
    worn_size: it.wornSize.trim() || null,
  }));

  const { error: insErr } = await supabase.from("look_items").insert(rows);
  if (insErr) return `Could not save items: ${insErr.message}`;
  return null;
}

export async function publishLookAction(
  lookId: string,
  publish: boolean,
): Promise<SaveResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("looks")
    .update({
      published_at: publish ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lookId)
    .eq("creator_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/looks");
  revalidatePath(`/looks/${lookId}`);
  return { ok: true, lookId };
}

export async function archiveLookAction(
  lookId: string,
  archived: boolean,
): Promise<SaveResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("looks")
    .update({
      archived,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lookId)
    .eq("creator_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/looks");
  revalidatePath(`/looks/${lookId}`);
  return { ok: true, lookId };
}
