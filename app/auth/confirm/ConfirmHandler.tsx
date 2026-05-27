"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Status =
  | { kind: "loading" }
  | { kind: "ok" }
  | { kind: "error"; reason: string };

/**
 * Handles all three Supabase confirmation URL shapes:
 *   1. `?token_hash=XXX&type=signup` — verifyOtp({ token_hash, type })
 *   2. `?code=XXX`                    — exchangeCodeForSession(code)
 *   3. `#access_token=...&type=signup` — setSession({ ... })
 *
 * On success, redirect to `/` (which the layout will swap for the
 * dashboard via the existing auth redirect rules). On any failure,
 * surface an error and a path back to /login — the user can sign in
 * normally if Supabase already verified the account.
 */
export default function ConfirmHandler() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function run() {
      const url = new URL(window.location.href);
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type");
      const code = url.searchParams.get("code");

      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : "";
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      try {
        if (tokenHash && type) {
          // Cast: Supabase types `type` as a finite enum; "signup",
          // "email_change", "magiclink", etc. all flow through here.
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            type: type as any,
          });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else {
          // No token at all. This page should never be hit without one;
          // most likely the user navigated to /auth/confirm directly or
          // the email link was malformed.
          throw new Error(
            "This confirmation link is missing its token. Try signing in directly.",
          );
        }

        // Strip the token from the URL so a back-button or refresh
        // doesn't try to re-consume an already-spent token.
        window.history.replaceState({}, "", "/auth/confirm");
        if (!cancelled) setStatus({ kind: "ok" });

        // Hand off to the dashboard. router.replace avoids leaving
        // /auth/confirm in the back stack.
        router.replace("/");
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof Error
            ? e.message
            : "We couldn't confirm your email. Try signing in.";
        setStatus({ kind: "error", reason: msg });
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status.kind === "loading") {
    return <p className="text-sm text-muted">Hold tight…</p>;
  }

  if (status.kind === "ok") {
    return <p className="text-sm text-muted">Signed in. Redirecting…</p>;
  }

  return (
    <div className="space-y-4 text-left">
      <div
        role="alert"
        className="text-sm text-[#B53D2A] bg-[#FBE9E5] border border-[#F4C7BF] rounded-2xl px-4 py-3"
      >
        {status.reason}
      </div>
      <Link
        href="/login"
        className="block text-center rounded-full bg-rose text-white px-5 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Go to sign in
      </Link>
    </div>
  );
}
