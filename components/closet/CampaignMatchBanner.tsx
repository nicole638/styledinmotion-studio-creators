"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Clock, ExternalLink } from "lucide-react";
import { findCampaignForUrlAction } from "@/lib/campaigns/lookup";
import type { Campaign } from "@/types/campaigns";
import { CAMPAIGN_TYPE_LABEL } from "@/types/campaigns";

/**
 * When the user pastes/types an Amazon URL whose ASIN is in an active
 * campaign, surface a banner above the form with the bonus commission rate.
 * Debounced so we don't hit the server on every keystroke.
 */
export function CampaignMatchBanner({ url }: { url: string }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!url || !url.trim()) {
      setCampaign(null);
      return;
    }

    const trimmed = url.trim();
    // Cheap pre-filter — only hit server for plausibly-Amazon URLs.
    if (!/amazon\.com|a\.co|amzn\./i.test(trimmed)) {
      setCampaign(null);
      return;
    }

    const handle = setTimeout(async () => {
      setLoading(true);
      const r = await findCampaignForUrlAction(trimmed);
      if (!cancelled) {
        setCampaign(r.campaign);
        setLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [url]);

  if (loading || !campaign) return null;

  const daysLeft = daysUntil(campaign.endDate);

  return (
    <div className="rounded-2xl border border-rose/40 bg-rose/5 px-4 py-3 flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-rose/15 grid place-items-center shrink-0">
        <Sparkles size={16} strokeWidth={2} className="text-rose" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text leading-snug">
          This product is in a{" "}
          <span className="text-rose">+{campaign.commissionRatePct}% bonus</span>{" "}
          campaign with{" "}
          <span className="font-display text-base">{campaign.brandName}</span>.
        </p>
        <p className="mt-1 text-xs text-muted flex items-center gap-3 flex-wrap">
          <span>{CAMPAIGN_TYPE_LABEL[campaign.campaignType]}</span>
          <span className="inline-flex items-center gap-1">
            <Clock size={11} strokeWidth={2.25} />
            {daysLeft === null
              ? `Ends ${campaign.endDate}`
              : daysLeft === 0
                ? "Ends today"
                : daysLeft === 1
                  ? "Ends tomorrow"
                  : `${daysLeft} days left`}
          </span>
          {campaign.campaignUrl ? (
            <Link
              href={campaign.campaignUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-rose hover:underline"
            >
              <ExternalLink size={11} strokeWidth={2.25} />
              View brand brief
            </Link>
          ) : null}
        </p>
      </div>
    </div>
  );
}

function daysUntil(isoDate: string): number | null {
  try {
    const end = new Date(`${isoDate}T23:59:59`);
    const now = new Date();
    const ms = end.getTime() - now.getTime();
    if (ms < 0) return null;
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}
