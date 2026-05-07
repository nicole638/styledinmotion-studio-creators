import Link from "next/link";
import { Sparkles, Clock, ArrowUpRight } from "lucide-react";
import { listActiveCampaignsForCreator } from "@/lib/campaigns/queries";
import {
  CAMPAIGN_TYPE_LABEL,
  type Campaign,
} from "@/types/campaigns";

/**
 * Active brand campaigns surfaced on the creator dashboard. Highest
 * commission rate first, with end-date urgency. Empty state intentionally
 * hidden — if no active campaigns, the widget renders nothing rather than
 * a placeholder, so dashboards stay clean during quiet weeks.
 */
export async function ActiveCampaignsWidget() {
  const campaigns = await listActiveCampaignsForCreator(5);
  if (campaigns.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-rose">
            Brand campaigns this week
          </p>
          <h2 className="font-display text-2xl mt-1">
            Earn bonus commission on these.
          </h2>
        </div>
        <p className="text-xs text-muted leading-relaxed max-w-xs">
          Feature any of these products in a look. We've opted in on the
          platform's behalf — the bonus commission applies automatically.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {campaigns.map((c) => (
          <CampaignCard key={c.id} campaign={c} />
        ))}
      </div>
    </section>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const daysLeft = daysUntil(campaign.endDate);
  const urgent = daysLeft !== null && daysLeft <= 7;

  return (
    <div className="group block rounded-2xl border border-border bg-card p-4 hover:border-rose transition-colors">
      <div className="flex items-start gap-3">
        {/* Brand mark */}
        <BrandMark
          name={campaign.brandName}
          logoUrl={campaign.brandLogoUrl}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="font-display text-lg leading-tight truncate">
              {campaign.brandName}
            </h3>
            <span className="text-[10px] uppercase tracking-widest text-muted shrink-0">
              {CAMPAIGN_TYPE_LABEL[campaign.campaignType]}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-3 flex-wrap text-xs">
            <span className="inline-flex items-center gap-1 text-rose font-medium">
              <Sparkles size={12} strokeWidth={2.25} />
              +{campaign.commissionRatePct}% bonus
            </span>
            <span className="text-muted">
              {campaign.asins.length} product
              {campaign.asins.length === 1 ? "" : "s"}
            </span>
            <span
              className={`inline-flex items-center gap-1 ${
                urgent ? "text-[#B53D2A] font-medium" : "text-muted"
              }`}
            >
              <Clock size={12} strokeWidth={2.25} />
              {daysLeft === null
                ? `Ends ${campaign.endDate}`
                : daysLeft === 0
                  ? "Ends today"
                  : daysLeft === 1
                    ? "Ends tomorrow"
                    : `${daysLeft} days left`}
            </span>
          </div>

          {campaign.notes ? (
            <p className="mt-2 text-xs text-muted leading-relaxed line-clamp-2">
              {campaign.notes}
            </p>
          ) : null}
        </div>

        <ArrowUpRight
          size={14}
          strokeWidth={2}
          className="text-muted group-hover:text-rose transition-colors shrink-0"
        />
      </div>

      {campaign.campaignUrl ? (
        <div className="mt-3 pt-3 border-t border-border">
          <Link
            href={campaign.campaignUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-rose hover:underline"
          >
            View brand brief →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function BrandMark({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string | null;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className="w-12 h-12 rounded-xl object-cover bg-bg shrink-0"
      />
    );
  }
  return (
    <div className="w-12 h-12 rounded-xl bg-bg border border-border grid place-items-center shrink-0">
      <span className="font-display text-lg text-rose">
        {name.charAt(0).toUpperCase()}
      </span>
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
