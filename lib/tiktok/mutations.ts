"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Disconnect the signed-in creator's TikTok account: best-effort revoke
 * the token at TikTok, then clear tokens + mark revoked in our DB.
 * Uses the admin client for the write (tiktok_accounts has no client
 * write policy), but scopes strictly to the caller's own auth.uid().
 */
export async function disconnectTikTokAction(): Promise<{ ok: boolean }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const admin = createAdminClient();

  // Best-effort revoke at TikTok using the stored token.
  const { data: acct } = await admin
    .from("tiktok_accounts")
    .select("access_token")
    .eq("creator_id", user.id)
    .maybeSingle();

  if (acct?.access_token) {
    try {
      const { data: sec } = await admin.rpc("get_tiktok_secrets").single();
      if (sec) {
        await fetch("https://open.tiktokapis.com/v2/oauth/revoke/", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_key: (sec as { client_key: string }).client_key,
            client_secret: (sec as { client_secret: string }).client_secret,
            token: acct.access_token,
          }),
        });
      }
    } catch {
      // ignore revoke failures — we still clear our side below
    }
  }

  await admin
    .from("tiktok_accounts")
    .update({ revoked: true, access_token: null, refresh_token: null })
    .eq("creator_id", user.id);

  revalidatePath("/profile");
  return { ok: true };
}
