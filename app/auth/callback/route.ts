import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Universal auth callback handler.
 *
 * Supabase email links land here with `?code=<pkce_code>` after the
 * server has verified the email token. We exchange the code for a
 * session using the SERVER client — important because @supabase/ssr
 * stores the PKCE verifier as an HttpOnly cookie, which browser-side
 * JavaScript cannot read. Server client can.
 *
 * After the session is set in cookies, redirect to `?next=<path>`
 * (defaults to `/`). Used by:
 *   - Password recovery →  /auth/callback?next=/auth/reset
 *   - Signup confirm     →  /auth/callback?next=/
 *   - Future OAuth flows →  /auth/callback?next=/wherever
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";
  const errorDescription = url.searchParams.get("error_description");

  // Some flows append ?error_description=... when the link is dead.
  // Don't try to exchange — bounce to login with the message visible.
  if (errorDescription) {
    const back = new URL("/login", url.origin);
    back.searchParams.set("authError", errorDescription);
    return NextResponse.redirect(back);
  }

  if (!code) {
    const back = new URL("/login", url.origin);
    back.searchParams.set(
      "authError",
      "This link is missing its code. Try signing in or requesting a new link.",
    );
    return NextResponse.redirect(back);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const back = new URL("/login", url.origin);
    back.searchParams.set(
      "authError",
      error.message || "Couldn't validate this link. Request a new one.",
    );
    return NextResponse.redirect(back);
  }

  // Only allow same-origin paths in `next` to prevent open-redirect.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
