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

export default function ResetForm() {
  const router = useRouter();
  const [session, setSession] = useState<SessionState>({ kind: "loading" });
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  // ── Exchange the recovery token for a session on mount ──────────────
  // Two possible token shapes:
  //   PKCE (default for @supabase/ssr): ?code=XXX in the query string
  //   Implicit:                          #access_token=XXX&type=recovery
  // We check both so the page works regardless of how the project is
  // configured. Supabase will reject a malformed or expired token, in
  // which case we kick the user back to /forgot-password.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function exchange() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      // Implicit flow: tokens in URL hash. Hash is everything after `#`.
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : "";
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const hashType = hashParams.get("type");

      try {
        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) throw exErr;
        } else if (accessToken && refreshToken && hashType === "recovery") {
          const { error: setErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setErr) throw setErr;
        } else {
          // Maybe the user is already signed in via a previous link tap
          // and is just hitting /auth/reset directly — allow that.
          const { data, error: getErr } = await supabase.auth.getUser();
          if (getErr || !data.user) {
            throw new Error(
              "This reset link is missing a recovery token. Request a new one.",
            );
          }
        }

        // Strip the token from the URL so a back-button or refresh
        // doesn't try to re-exchange a now-consumed code.
        if (code || hash) {
          window.history.replaceState({}, "", "/auth/reset");
        }

        if (!cancelled) setSession({ kind: "ready" });
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof Error ? e.message : "Couldn't validate your reset link.";
        setSession({ kind: "invalid", reason: msg });
      }
    }

    void exchange();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Submit handler ────────────────────────────────────────────────────
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
      // Sign the recovery session out so the user has to log in fresh
      // with the new password. This avoids landing them straight in
      // the dashboard from a recovery context (which Supabase treats
      // as a temporary session).
      await supabase.auth.signOut();
      router.replace("/login?reset=ok");
    });
  };

  // ── Render ────────────────────────────────────────────────────────────
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
