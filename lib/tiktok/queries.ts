import { createClient } from "@/lib/supabase/server";

export interface TikTokConnection {
  connected: boolean;
  revoked: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  isVerified: boolean | null;
  followerCount: number | null;
  likesCount: number | null;
  videoCount: number | null;
  scopes: string[];
}

/**
 * Read the signed-in creator's TikTok connection for the dashboard
 * connected-state card. RLS (tiktok_accounts_own_select) scopes this to
 * creator_id = auth.uid(). Tokens are never selected — read-only stats only.
 */
export async function fetchTikTokConnection(): Promise<TikTokConnection> {
  const empty: TikTokConnection = {
    connected: false,
    revoked: false,
    displayName: null,
    avatarUrl: null,
    isVerified: null,
    followerCount: null,
    likesCount: null,
    videoCount: null,
    scopes: [],
  };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const { data, error } = await supabase
    .from("tiktok_accounts")
    .select(
      "revoked, display_name, avatar_url, is_verified, follower_count, likes_count, video_count, scopes",
    )
    .eq("creator_id", user.id)
    .maybeSingle();

  if (error || !data) return empty;

  return {
    connected: !data.revoked,
    revoked: !!data.revoked,
    displayName: data.display_name ?? null,
    avatarUrl: data.avatar_url ?? null,
    isVerified: data.is_verified ?? null,
    followerCount: data.follower_count ?? null,
    likesCount: data.likes_count ?? null,
    videoCount: data.video_count ?? null,
    scopes: (data.scopes as string[] | null) ?? [],
  };
}
