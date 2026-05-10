"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type SessionState =
  | { kind: "loading" }
  // Recovery session active — render password form
  | { kind: "ready" }
  // Token missing/expired/already used — link is dead, send user back
  // through the forgot-password flow rather than letting them flounder
  | { kind: "invalid"; reason: string };

const MIN_PASSWORD = 8;

/**
 * Password-reset form. Assumes the user has already passed through
 * /auth/callback?next=/auth/reset, which exchanged the PKCE code for
 * a session server-side. By the time we render here, supabase.auth
 * .getUser() should return a real user — that's the recovery session.
 *
 * If there's no user (someone navigated here directly, the link
 * expired, or the cookies got cleared between hops), we show an error
 * with a path to request a new link.
 */
export default function ResetForm() {
  const router = useRouter();
  const [session, setSession] = useState<SessionState>({ kind: "loading" });
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  // Check that the recovery session is active. The exchange happened
  // server-side at /auth/callback before we got here.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data, error: getErr }) => {
      if (cancelled) return;
      if (getErr || !data.user) {
        setSession({
          kind: "invalid",
          reason:
            "This reset link has expired or already been used. Request a new one.",
        });
        return;
      }
      setSession({ kind: "ready" });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (pw1.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (pw1 !== pw2) {
      setError("Passwords don't match.");
      return;
    }

    startSubmit(async () => {
      const supabase = createClient();
      const { error: updateErr } = await supabase.auth.updateUser({
        password: pw1,
      });
      if (updateErr) {
        setError(updateErr.message);
        return;
      }
      // Sign out the recovery session so the user has to log in fresh
      // with the new password.
      await supabase.auth.signOut();
      router.replace("/login?reset=ok");
    });
  };

  if (session.kind === "loading") {
    return (
      <p className="text-sm text-muted text-center">Validating your link…</p>
    );
  }

  if (session.kind === "invalid") {
    return (
      <div className="space-y-4">
        <div
          role="alert"
          className="text-sm text-[#B53D2A] bg-[#FBE9E5] border border-[#F4C7BF] rounded-2xl px-4 py-3"
        >
          {session.reason}
        </div>
        <Link
          href="/forgot-password"
          className="block text-center rounded-full bg-rose text-white px-5 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Request a new reset link
        </Link>
        <div className="text-center text-sm text-muted">
          <Link
            href="/login"
            className="underline underline-offset-2 hover:text-rose transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">
          New password
        </label>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          value={pw1}
          onChange={(e) => setPw1(e.target.value)}
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-rose"
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">
          Confirm new password
        </label>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-rose"
        />
      </div>

      {error ? (
        <div
          role="alert"
          className="text-sm text-[#B53D2A] bg-[#FBE9E5] border border-[#F4C7BF] rounded-2xl px-4 py-3"
        >
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting || pw1.length === 0 || pw2.length === 0}
        className="w-full inline-flex items-center justify-center rounded-full bg-rose text-white px-5 py-3 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {submitting ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
