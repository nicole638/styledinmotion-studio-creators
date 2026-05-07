"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ExternalLink } from "lucide-react";
import {
  type Campaign,
  CAMPAIGN_TYPE_LABEL,
  CAMPAIGN_SOURCE_LABEL,
  isActive,
  isUpcoming,
  isEnded,
} from "@/types/campaigns";
import { archiveCampaignAction } from "@/lib/campaigns/mutations";

export function CampaignsList({ campaigns }: { campaigns: Campaign[] }) {
  const active = campaigns.filter((c) => isActive(c));
  const upcoming = campaigns.filter((c) => isUpcoming(c));
  const ended = campaigns.filter((c) => isEnded(c));
  const archived = campaigns.filter((c) => c.archivedAt !== null);

  return (
    <div className="space-y-10">
      <Section title="Active" badge="rose" campaigns={active} />
      <Section title="Upcoming" badge="muted" campaigns={upcoming} />
      <Section title="Ended" badge="muted" campaigns={ended} />
      <Section title="Archived" badge="muted" campaigns={archived} dim />
    </div>
  );
}

function Section({
  title,
  badge,
  campaigns,
  dim = false,
}: {
  title: string;
  badge: "rose" | "muted";
  campaigns: Campaign[];
  dim?: boolean;
}) {
  if (campaigns.length === 0) return null;
  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <h2 className="font-display text-2xl">{title}</h2>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            badge === "rose"
              ? "bg-rose/15 text-rose"
              : "bg-card border border-border text-muted"
          }`}
        >
          {campaigns.length}
        </span>
      </div>
      <div className={`space-y-2 ${dim ? "opacity-60" : ""}`}>
        {campaigns.map((c) => (
          <Row key={c.id} campaign={c} />
        ))}
      </div>
    </section>
  );
}

function Row({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const [isBusy, startTransition] = useTransition();

  const isArchived = campaign.archivedAt !== null;

  const handleToggleArchive = () => {
    startTransition(async () => {
      await archiveCampaignAction(campaign.id, !isArchived);
      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex flex-wrap gap-4 items-center">
      {/* Brand */}
      <div className="flex-1 min-w-[200px]">
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/campaigns/${campaign.id}`}
            className="font-medium text-sm hover:text-rose transition-colors"
          >
            {campaign.brandName}
          </Link>
          <span className="text-[10px] uppercase tracking-widest text-muted">
            {CAMPAIGN_TYPE_LABEL[campaign.campaignType]}
          </span>
        </div>
        <div className="text-xs text-muted mt-0.5">
          {CAMPAIGN_SOURCE_LABEL[campaign.source]} ·{" "}
          {campaign.asins.length} ASIN
          {campaign.asins.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* Commission */}
      <div className="text-sm">
        <div className="font-medium text-rose">+{campaign.commissionRatePct}%</div>
        <div className="text-[11px] text-muted uppercase tracking-widest">
          bonus
        </div>
      </div>

      {/* Window */}
      <div className="text-sm text-right min-w-[140px]">
        <div className="text-text">
          {formatDate(campaign.startDate)} → {formatDate(campaign.endDate)}
        </div>
        {campaign.budgetRemainingUsd !== null &&
        campaign.budgetTotalUsd !== null ? (
          <div className="text-[11px] text-muted">
            ${campaign.budgetRemainingUsd.toLocaleString()} of $
            {campaign.budgetTotalUsd.toLocaleString()} left
          </div>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {campaign.campaignUrl ? (
          <a
            href={campaign.campaignUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-border text-xs hover:border-rose transition-colors"
          >
            <ExternalLink size={12} strokeWidth={2} />
            Brief
          </a>
        ) : null}
        <button
          type="button"
          onClick={handleToggleArchive}
          disabled={isBusy}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-border text-xs hover:border-rose transition-colors disabled:opacity-60"
          title={isArchived ? "Unarchive" : "Archive"}
        >
          {isArchived ? (
            <>
              <ArchiveRestore size={12} strokeWidth={2} />
              Restore
            </>
          ) : (
            <>
              <Archive size={12} strokeWidth={2} />
              Archive
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  // iso = yyyy-mm-dd; render as Jan 15
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
