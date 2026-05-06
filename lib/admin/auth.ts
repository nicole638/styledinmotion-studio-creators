import { createClient } from "@/lib/supabase/server";

/**
 * Lightweight admin gate. Uses an email allowlist so we don't have to
 * thread role columns through Supabase Auth right now. When admin needs
 * to scale beyond one or two people, swap to a JWT custom claim and
 * gate via auth.role().
 */
const ADMIN_EMAILS = new Set<string>([
  "nicole@wisewayssolutions.net",
  "nicole@styledinmotion.app",
  "nicole@testcreator.com",
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
  const email = user.email ?? "";
  if (!ADMIN_EMAILS.has(email.toLowerCase())) {
    return { ok: false, reason: "Admin only." };
  }
  return { ok: true, userId: user.id, email };
}

export async function isAdmin(): Promise<boolean> {
  const r = await requireAdmin();
  return r.ok;
}
