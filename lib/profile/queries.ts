import { createClient } from "@/lib/supabase/server";
import {
  type CreatorProfile,
  type CreatorProfileRow,
  rowToProfile,
} from "@/types/profile";

const PROFILE_COLUMNS =
  "creator_id, username, first_name, last_name, bio, photo_url, location, instagram_handle, instagram_enabled, tiktok_handle, tiktok_enabled, youtube_handle, youtube_enabled, pinterest_handle, pinterest_enabled, height_cm, weight_kg, measurement_unit, top_size, bottom_size, dress_size, shoe_size, bra_size, body_type_self_tags, is_beta_creator, is_founding_creator, subscription_status, follower_count, follower_count_source, profile_completed_at";

/**
 * Load the signed-in creator's profile. RLS scopes via auth.uid().
 * Returns null if the user is not signed in or has no row yet (the
 * auto_create_profile trigger should always create one on signup).
 */
export async function fetchOwnProfile(): Promise<CreatorProfile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("creator_profiles")
    .select(PROFILE_COLUMNS)
    .eq("creator_id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("[profile] fetchOwnProfile error:", error.message);
    return null;
  }
  if (!data) return null;
  return rowToProfile(data as CreatorProfileRow);
}

/**
 * Username availability check. RLS allows reading other creators' usernames
 * since creator_profiles is publicly viewable (display use), so this is fine
 * as a single direct query. Excludes the current user so they can keep their
 * own username.
 */
export async function isUsernameAvailable(
  username: string,
): Promise<{ available: boolean; reason?: string }> {
  const trimmed = username.trim().toLowerCase();
  if (!trimmed) return { available: false, reason: "Username is required." };
  if (trimmed.length < 3 || trimmed.length > 24) {
    return { available: false, reason: "Username must be 3–24 characters." };
  }
  if (!/^[a-z0-9_]+$/.test(trimmed)) {
    return {
      available: false,
      reason: "Letters, numbers, and underscore only.",
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("creator_profiles")
    .select("creator_id", { count: "exact", head: true })
    .ilike("username", trimmed);

  if (user) {
    query = query.neq("creator_id", user.id);
  }

  const { count, error } = await query;
  if (error) {
    return { available: false, reason: error.message };
  }
  if ((count ?? 0) > 0) {
    return { available: false, reason: "Already taken." };
  }
  return { available: true };
}
