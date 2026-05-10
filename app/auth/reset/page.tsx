import ResetForm from "./ResetForm";

export const metadata = { title: "Set a new password" };

/**
 * Landing page for the Supabase password recovery flow.
 *
 * The user gets here by tapping the reset link in their email. Supabase
 * appends either:
 *   - `?code=XXX` (PKCE flow — what @supabase/ssr defaults to), or
 *   - `#access_token=XXX&refresh_token=XXX&type=recovery` (implicit flow)
 *
 * `ResetForm` (client component) handles both — it exchanges/sets the
 * recovery session on mount, then shows two password fields. On submit
 * it calls supabase.auth.updateUser({ password }), signs the recovery
 * session out, and redirects back to /login with a success notice.
 */
export default function AuthResetPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
            Studio
          </p>
          <h1 className="font-display text-4xl">Set a new password.</h1>
          <p className="mt-3 text-sm text-muted">
            Pick something at least 8 characters. You'll be signed in
            after.
          </p>
        </div>

        <ResetForm />
      </div>
    </div>
  );
}
