"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShoppingBag, ArrowUpRight } from "lucide-react";
import { acknowledgePlatformTagAction } from "@/lib/profile/mutations";

/**
 * Surfaced on the dashboard for creators who haven't yet decided how to
 * handle Amazon Associates attribution. Two paths:
 *   - Connect own Associates account → /profile (anchor on Channels section)
 *   - Use platform tag → fires acknowledgePlatformTagAction
 *
 * Once the creator has acknowledged either way, this component renders
 * nothing (the parent server component skips it via the
 * fetchAmazonSetupAcknowledged check).
 */
export function AmazonSetupBanner() {
  const router = useRouter();
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleUsePlatform = () => {
    setError(null);
    startBusy(async () => {
      const r = await acknowledgePlatformTagAction();
      if (!r.ok) {
        setError(r.error ?? "Could not save.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="mb-8 rounded-2xl border border-rose/30 bg-rose/5 p-5">
      <div className="flex items-start gap-4">
        <div className="shrink-0 mt-0.5 text-rose">
          <ShoppingBag size={20} strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-[0.25em] text-rose mb-1">
            One quick decision
          </p>
          <h3 className="font-display text-xl">
            How should we attribute your Amazon shop earnings?
          </h3>
          <p className="mt-2 text-sm text-muted leading-relaxed max-w-prose">
            If you have your own Amazon Associates account, link it and
            commissions go straight to you. Otherwise the platform's tag is
            used and we attribute your earnings via report reconciliation.
            Pick whichever earns the better rate — you can change this
            anytime in your profile.
          </p>
          {error ? (
            <p className="mt-2 text-xs text-[#B53D2A]">{error}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/profile#channels"
              className="inline-flex items-center gap-2 rounded-full bg-rose text-white px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              I have my own Associates account
              <ArrowUpRight size={14} strokeWidth={2} />
            </Link>
            <button
              type="button"
              onClick={handleUsePlatform}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm hover:border-rose disabled:opacity-60 transition-colors"
            >
              {busy ? "Saving…" : "Use platform tag"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
