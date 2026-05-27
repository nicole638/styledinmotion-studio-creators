import ConfirmHandler from "./ConfirmHandler";

export const metadata = { title: "Confirming…" };

/**
 * Landing page for the Supabase signup-confirmation flow.
 *
 * The user gets here by tapping the link in their welcome email.
 * Supabase appends one of:
 *   - `?token_hash=XXX&type=signup` (PKCE-ish, default for @supabase/ssr)
 *   - `?code=XXX` (PKCE OAuth-ish)
 *   - `#access_token=...&refresh_token=...&type=signup` (implicit fallback)
 *
 * `ConfirmHandler` validates whichever shape arrived, sets the session,
 * and bounces the user into the dashboard. If the link is bad or
 * already used, it shows a clean error with a path back to login.
 */
export default function AuthConfirmPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
          Studio
        </p>
        <h1 className="font-display text-4xl mb-4">Confirming your email…</h1>
        <ConfirmHandler />
      </div>
    </div>
  );
}
