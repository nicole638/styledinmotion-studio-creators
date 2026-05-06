"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateShortCode } from "@/lib/looks/short-code";
import {
  type CollageLayout,
  type CutoutLayer,
  layoutToJson,
} from "@/types/collage";

export interface SaveCollageInput {
  /** Set when editing; absent when creating a new look. */
  lookId?: string;
  title: string;
  /** Public URL of the flattened PNG already uploaded to look-photos. */
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
 * Persist a collage as a look. The flattened PNG is already in look-photos
 * via client-side upload; this action just inserts/updates rows.
 *
 * - Creates/updates a looks row with collage_layout JSONB + cover_photo_url
 * - Inserts look_items rows ONLY for cutout layers (photo + text layers
 *   don't represent closet pieces)
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
  const layoutJson = layoutToJson(input.layout);
  const cutouts = input.layout.layers.filter(
    (l): l is CutoutLayer => l.kind === "cutout",
  );

  if (input.lookId) {
    // Edit path
    const { error: updErr } = await supabase
      .from("looks")
      .update({
        title,
        cover_photo_url: input.coverPhotoUrl,
        collage_layout: layoutJson,
        published_at: input.publish ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.lookId)
      .eq("creator_id", user.id);

    if (updErr) return { ok: false, error: updErr.message };

    const itemErr = await replaceLookItems(input.lookId, cutouts);
    if (itemErr) return { ok: false, error: itemErr };

    revalidatePath("/looks");
    revalidatePath(`/looks/${input.lookId}`);
    return { ok: true, lookId: input.lookId };
  }

  // Create path — retry on rare short_code collision
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const shortCode = generateShortCode();
    const { data, error } = await supabase
      .from("looks")
      .insert({
        creator_id: user.id,
        title,
        cover_photo_url: input.coverPhotoUrl,
        collage_layout: layoutJson,
        short_code: shortCode,
        published_at: input.publish ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    if (!error && data) {
      const lookId = data.id;
      const itemErr = await replaceLookItems(lookId, cutouts);
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
  cutouts: CutoutLayer[],
): Promise<string | null> {
  const supabase = createClient();

  const { error: delErr } = await supabase
    .from("look_items")
    .delete()
    .eq("look_id", lookId);
  if (delErr) return `Could not clear old items: ${delErr.message}`;

  if (cutouts.length === 0) return null;

  const rows = cutouts.map((c, idx) => ({
    look_id: lookId,
    creator_item_id: c.itemId,
    sort_order: idx,
  }));

  const { error: insErr } = await supabase.from("look_items").insert(rows);
  if (insErr) return `Could not save items: ${insErr.message}`;
  return null;
}
