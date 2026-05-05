"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateShortCode } from "@/lib/looks/short-code";
import type { CollageLayout } from "@/types/collage";

export interface SaveCollageInput {
  /** Set when editing; absent when creating a new look. */
  lookId?: string;
  title: string;
  /** Public URL of the flattened PNG already uploaded to look-photos bucket. */
  coverPhotoUrl: string;
  layout: CollageLayout;
  publish: boolean;
}

export interface SaveCollageResult {
  ok: boolean;
  error?: string;
  lookId?: string;
}

/**
 * Persist a collage as a look. The flattened PNG should already be in
 * look-photos via client-side upload (saves a roundtrip). This action
 * just inserts/updates the looks row and the look_items rows.
 *
 * - Creates a new looks row with collage_layout JSONB + cover_photo_url
 * - Inserts look_items rows for each itemId in the layout (so the
 *   shopper-facing detail page can render the tagged pieces grid)
 * - publish=true sets published_at; false leaves NULL (draft)
 */
export async function saveCollageAction(
  input: SaveCollageInput,
): Promise<SaveCollageResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const title = input.title.trim() || "Untitled collage";

  if (input.lookId) {
    // Edit path — update existing look's cover + layout, replace look_items
    const { error: updErr } = await supabase
      .from("looks")
      .update({
        title,
        cover_photo_url: input.coverPhotoUrl,
        collage_layout: input.layout,
        published_at: input.publish
          ? new Date().toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.lookId)
      .eq("creator_id", user.id);

    if (updErr) return { ok: false, error: updErr.message };

    const itemErr = await replaceLookItems(input.lookId, input.layout);
    if (itemErr) return { ok: false, error: itemErr };

    revalidatePath("/looks");
    revalidatePath(`/looks/${input.lookId}`);
    return { ok: true, lookId: input.lookId };
  }

  // Create path — try inserting up to 3 times on short_code collision
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const shortCode = generateShortCode();
    const { data, error } = await supabase
      .from("looks")
      .insert({
        creator_id: user.id,
        title,
        cover_photo_url: input.coverPhotoUrl,
        collage_layout: input.layout,
        short_code: shortCode,
        published_at: input.publish ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    if (!error && data) {
      const lookId = data.id;
      const itemErr = await replaceLookItems(lookId, input.layout);
      if (itemErr) return { ok: false, error: itemErr };
      revalidatePath("/looks");
      return { ok: true, lookId };
    }

    lastError = error?.message ?? "Unknown insert error";
    if (!/short_code|duplicate key/i.test(lastError)) break;
  }

  return { ok: false, error: lastError ?? "Could not save collage." };
}

async function replaceLookItems(
  lookId: string,
  layout: CollageLayout,
): Promise<string | null> {
  const supabase = createClient();

  const { error: delErr } = await supabase
    .from("look_items")
    .delete()
    .eq("look_id", lookId);
  if (delErr) return `Could not clear old items: ${delErr.message}`;

  if (layout.items.length === 0) return null;

  const rows = layout.items.map((it, idx) => ({
    look_id: lookId,
    creator_item_id: it.itemId,
    sort_order: idx,
  }));

  const { error: insErr } = await supabase.from("look_items").insert(rows);
  if (insErr) return `Could not save items: ${insErr.message}`;
  return null;
}
