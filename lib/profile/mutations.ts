"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SocialPlatform } from "@/types/profile";

export interface ProfileDraft {
  username: string;
  firstName: string;
  lastName: string;
  bio: string;
  photoUrl: string;
  location: string;
  socials: Array<{
    platform: SocialPlatform;
    handle: string;
    enabled: boolean;
  }>;
  heightCm: number | null;
  weightKg: number | null;
  measurementUnit: "us" | "metric";
  topSize: string;
  bottomSize: string;
  dressSize: string;
  shoeSize: string;
  braSize: string;
  bodyTypeSelfTags: string[];
  amazonAssociatesTag: string;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

/**
 * Persist the full profile editor form. RLS scopes the UPDATE via
 * creator_id = auth.uid(). Validates username + height/weight ranges
 * before hitting the DB so the user gets a useful error instead of a
 * Postgres CHECK violation.
 */
export async function updateProfileAction(
  draft: ProfileDraft,
): Promise<SaveResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const username = draft.username.trim().toLowerCase();
  if (username) {
    if (username.length < 3 || username.length > 24) {
      return { ok: false, error: "Username must be 3–24 characters." };
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      return { ok: false, error: "Username: letters, numbers, underscore only." };
    }
  }

  if (
    draft.heightCm !== null &&
    (draft.heightCm < 100 || draft.heightCm > 230)
  ) {
    return { ok: false, error: "Height must be between 100 and 230 cm." };
  }
  if (
    draft.weightKg !== null &&
    (draft.weightKg < 30 || draft.weightKg > 250)
  ) {
    return { ok: false, error: "Weight must be between 30 and 250 kg." };
  }

  // Amazon Associates tag — light validation. Multiple regional store
  // suffixes are valid (-20 US, -21 UK, -22 ES, etc.) and the format may
  // evolve; we just enforce non-whitespace alphanumeric+dash so paste
  // mistakes get caught at the door.
  const amazonTag = draft.amazonAssociatesTag.trim().toLowerCase();
  if (amazonTag && !/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(amazonTag)) {
    return {
      ok: false,
      error:
        "Amazon Associates tag should be lowercase letters, numbers, and dashes (e.g. 'mycreator-20').",
    };
  }

  // Look up handles by platform for column writes
  const handle = (p: SocialPlatform) =>
    draft.socials.find((s) => s.platform === p)?.handle.trim() ?? "";
  const enabled = (p: SocialPlatform) =>
    draft.socials.find((s) => s.platform === p)?.enabled ?? false;

  const payload = {
    username: username || null,
    first_name: draft.firstName.trim() || null,
    last_name: draft.lastName.trim() || null,
    bio: draft.bio.trim() || "",
    photo_url: draft.photoUrl.trim() || "",
    location: draft.location.trim() || null,
    instagram_handle: handle("instagram"),
    instagram_enabled: enabled("instagram"),
    tiktok_handle: handle("tiktok"),
    tiktok_enabled: enabled("tiktok"),
    youtube_handle: handle("youtube"),
    youtube_enabled: enabled("youtube"),
    pinterest_handle: handle("pinterest"),
    pinterest_enabled: enabled("pinterest"),
    height_cm: draft.heightCm,
    weight_kg: draft.weightKg,
    measurement_unit: draft.measurementUnit,
    top_size: draft.topSize.trim() || null,
    bottom_size: draft.bottomSize.trim() || null,
    dress_size: draft.dressSize.trim() || null,
    shoe_size: draft.shoeSize.trim() || null,
    bra_size: draft.braSize.trim() || null,
    body_type_self_tags: draft.bodyTypeSelfTags,
    amazon_associates_tag: amazonTag || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("creator_profiles")
    .update(payload)
    .eq("creator_id", user.id);

  if (error) {
    // Friendlier messages for common collisions
    if (/unique_username/i.test(error.message) || /username.*duplicate/i.test(error.message)) {
      return { ok: false, error: "That username is already taken." };
    }
    return { ok: false, error: error.message };
  }

  // Mirror first/last name onto the creators parent row so iOS sees a
  // consistent display name. Best-effort — don't fail the whole save if
  // this errors (e.g. the row was somehow missing).
  await supabase
    .from("creators")
    .update({
      first_name: draft.firstName.trim() || null,
      last_name: draft.lastName.trim() || null,
    })
    .eq("id", user.id);

  revalidatePath("/profile");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Mark profile as completed (sets profile_completed_at = now()). Called by
 * the editor when the creator hits the Save button after meeting all 8
 * completion criteria. Idempotent — re-running just touches updated_at.
 */
export async function markProfileCompletedAction(): Promise<SaveResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("creator_profiles")
    .update({ profile_completed_at: new Date().toISOString() })
    .eq("creator_id", user.id)
    .is("profile_completed_at", null);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
