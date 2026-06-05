import { createClient } from "@/lib/supabase/server";

/**
 * Admin gate. Honors two sources, in order:
 *
 *   1. `creator_profiles.is_admin = true` — DB-backed flag set on
 *      Nicole + Kerri as of 2026-06-05. THIS IS THE SOURCE OF TRUTH
 *      that the brand_storefronts / brand_memberships `*_admin_all`
 *      RLS policies check, so middleware MUST agree with it or admin
 *      reads pass while writes silently fail RLS.
 *
 *   2. Email allowlist — legacy. Kept additive while we transition;
 *      any user matching either source is treated as admin. Safe to
 *      delete once every allowlist entry is also flagged in the DB
 *      (already true for Nicole + Kerri).
 */
const ADMIN_EMAILS = new Set<string>([
  "nicole@wisewayssolutions.net",
  "nicole@styledinmotion.app",
  "nicole@testcreator.com",
  "kerri@styledinmotion.app",
]);

export async function requireAdmin(): Promise<{
  ok: boolean;
  userId?: string;
  email?: string;
  reason?: string;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "Not signed in." };
  const email = (user.email ?? "").toLowerCase();

  // 1. DB-backed flag — preferred. A transient supabase read failure
  // falls through to the allowlist below so middleware never wedges.
  try {
    const { data: profile } = await supabase
      .from("creator_profiles")
      .select("is_admin")
      .eq("creator_id", user.id)
      .maybeSingle();
    if (profile && (profile as { is_admin?: boolean }).is_admin === true) {
      return { ok: true, userId: user.id, email };
    }
  } catch {
    // ignore — fall through
  }

  // 2. Legacy email allowlist.
  if (ADMIN_EMAILS.has(email)) {
    return { ok: true, userId: user.id, email };
  }

  return { ok: false, reason: "Admin only." };
}

export async function isAdmin(): Promise<boolean> {
  const r = await requireAdmin();
  return r.ok;
}
