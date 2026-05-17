"use client";

import { useEffect, useState } from "react";
import { Sparkles, ExternalLink } from "lucide-react";
import { wrapAwinUrlAction } from "@/lib/awin/wrap";
import type { AwinMerchant } from "@/types/awin";

/**
 * When the user pastes/types a merchant URL whose host matches an active
 * Awin merchant in `awin_merchants`, surface a banner above the form and
 * call onMatch with the Awin-wrapped URL so the parent can auto-swap the
 * URL field. Click attribution then flows through `/api/shop` exactly the
 * same as the Amazon campaign flow.
 *
 * Mirrors the shape of `CampaignMatchBanner` so the two banners stack
 * cleanly when both would fire (different merchants, so they won't —
 * but the JSX is parallel).
 *
 * Debounced 350ms, pre-filters non-merchant junk (file://, mailto:, etc.),
 * and skips Awin-wrapped URLs entirely so we don't double-wrap.
 */
export function AwinMatchBanner({
  url,
  onMatch,
}: {
  url: string;
  onMatch?: (wrappedUrl: string, merchant: AwinMerchant) => void;
}) {
  const [merchant, setMerchant] = useState<AwinMerchant | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!url || !url.trim()) {
      setMerchant(null);
      return;
    }
    const trimmed = url.trim();

    // Cheap pre-filter — must look like a real http(s) URL we can wrap.
    if (!/^https?:\/\//i.test(trimmed)) {
      setMerchant(null);
      return;
    }
    // Already an Awin URL — nothing to do, would only double-wrap.
    if (/(^|\.)awin1\.com\//i.test(trimmed)) {
      setMerchant(null);
      return;
    }
    // Amazon has its own banner / campaign flow — don't double up.
    if (/amazon\.com|a\.co|amzn\./i.test(trimmed)) {
      setMerchant(null);
      return;
    }

    const handle = setTimeout(async () => {
      setLoading(true);
      const r = await wrapAwinUrlAction(trimmed);
      if (!cancelled) {
        setMerchant(r?.merchant ?? null);
        setLoading(false);
        if (r && onMatch) onMatch(r.wrappedUrl, r.merchant);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [url, onMatch]);

  if (loading || !merchant) return null;

  return (
    <div className="rounded-2xl border border-rose/40 bg-rose/5 px-4 py-3 flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-rose/15 grid place-items-center shrink-0">
        <Sparkles size={16} strokeWidth={2} className="text-rose" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text leading-snug">
          <span className="font-display text-base">{merchant.merchantName}</span>{" "}
          is on <span className="text-rose">Awin</span>. We swapped your link
          to the tracked URL so this click earns commission.
        </p>
        <p className="mt-1 text-xs text-muted flex items-center gap-3 flex-wrap">
          {merchant.commissionMax ? (
            <span>
              Up to{" "}
              <span className="text-text">{merchant.commissionMax}% commission</span>
            </span>
          ) : null}
          {merchant.cookieLength ? (
            <span>{merchant.cookieLength}-day cookie</span>
          ) : null}
          <span className="inline-flex items-center gap-1 text-muted">
            <ExternalLink size={11} strokeWidth={2.25} />
            {merchant.domain}
          </span>
        </p>
      </div>
    </div>
  );
}
