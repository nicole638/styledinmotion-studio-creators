"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ExternalLink } from "lucide-react";
import {
  AWIN_STATUS_LABEL,
  type AwinMerchant,
  type AwinMerchantStatus,
} from "@/types/awin";
import { archiveAwinMerchantAction } from "@/lib/awin/mutations";

export function AwinMerchantsList({ merchants }: { merchants: AwinMerchant[] }) {
  const active = merchants.filter(
    (m) => m.status === "active" && m.archivedAt === null,
  );
  const pending = merchants.filter(
    (m) => m.status === "pending" && m.archivedAt === null,
  );
  const paused = merchants.filter(
    (m) => m.status === "paused" && m.archivedAt === null,
  );
  const terminated = merchants.filter(
    (m) => m.status === "terminated" && m.archivedAt === null,
  );
  const archived = merchants.filter((m) => m.archivedAt !== null);

  return (
    <div className="space-y-10">
      <Section title="Active" status="active" merchants={active} badge="rose" />
      <Section
        title="Pending approval"
        status="pending"
        merchants={pending}
        badge="muted"
      />
      <Section
        title="Paused"
        status="paused"
        merchants={paused}
        badge="muted"
      />
      <Section
        title="Terminated"
        status="terminated"
        merchants={terminated}
        badge="muted"
      />
      <Section
        title="Archived"
        status="archived"
        merchants={archived}
        badge="muted"
        dim
      />
    </div>
  );
}

function Section({
  title,
  merchants,
  badge,
  dim = false,
}: {
  title: string;
  status: AwinMerchantStatus | "archived";
  merchants: AwinMerchant[];
  badge: "rose" | "muted";
  dim?: boolean;
}) {
  if (merchants.length === 0) return null;
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
          {merchants.length}
        </span>
      </div>
      <div className={`space-y-2 ${dim ? "opacity-60" : ""}`}>
        {merchants.map((m) => (
          <Row key={m.id} merchant={m} />
        ))}
      </div>
    </section>
  );
}

function Row({ merchant }: { merchant: AwinMerchant }) {
  const router = useRouter();
  const [isBusy, startTransition] = useTransition();

  const isArchived = merchant.archivedAt !== null;
  const handleToggleArchive = () => {
    startTransition(async () => {
      await archiveAwinMerchantAction(merchant.id, !isArchived);
      router.refresh();
    });
  };

  const commission =
    merchant.commissionMin !== null && merchant.commissionMax !== null
      ? merchant.commissionMin === merchant.commissionMax
        ? `${merchant.commissionMin}%`
        : `${merchant.commissionMin}–${merchant.commissionMax}%`
      : merchant.commissionMax !== null
        ? `${merchant.commissionMax}%`
        : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex flex-wrap gap-4 items-center">
      {/* Merchant */}
      <div className="flex-1 min-w-[220px]">
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/awin-merchants/${merchant.id}`}
            className="font-medium text-sm hover:text-rose transition-colors"
          >
            {merchant.merchantName}
          </Link>
          <span className="text-[10px] uppercase tracking-widest text-muted">
            awinmid {merchant.awinmid}
          </span>
        </div>
        <div className="text-xs text-muted mt-0.5 truncate">
          {merchant.domain}
          {merchant.altDomains.length > 0
            ? ` · +${merchant.altDomains.length} alt`
            : ""}
        </div>
      </div>

      {/* Commission + cookie */}
      <div className="text-sm min-w-[110px]">
        {commission ? (
          <div className="font-medium text-rose">{commission}</div>
        ) : (
          <div className="text-muted">—</div>
        )}
        <div className="text-[11px] text-muted uppercase tracking-widest">
          {merchant.cookieLength ? `${merchant.cookieLength}-day cookie` : "cookie n/a"}
        </div>
      </div>

      {/* Awin Index */}
      <div className="text-sm text-right min-w-[80px]">
        {merchant.awinIndex !== null ? (
          <>
            <div className="text-text">{merchant.awinIndex}</div>
            <div className="text-[11px] text-muted uppercase tracking-widest">
              Awin idx
            </div>
          </>
        ) : (
          <div className="text-muted text-xs">—</div>
        )}
      </div>

      {/* Status pill */}
      <div className="text-xs">
        <span
          className={`px-2 py-1 rounded-full ${
            merchant.status === "active"
              ? "bg-rose/15 text-rose"
              : merchant.status === "pending"
                ? "bg-card border border-border text-text"
                : "bg-card border border-border text-muted"
          }`}
        >
          {AWIN_STATUS_LABEL[merchant.status]}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {merchant.awinJoinUrl ? (
          <a
            href={merchant.awinJoinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-border text-xs hover:border-rose transition-colors"
            title="Open in Awin dashboard"
          >
            <ExternalLink size={12} strokeWidth={2} />
            Awin
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
