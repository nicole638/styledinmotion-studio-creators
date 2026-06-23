"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, ExternalLink } from "lucide-react";
import type { CampaignCandidate, FashionPrediction } from "@/types/campaigns";
import type { CandidateFilter } from "@/lib/campaigns/candidates-queries";
import {
  approveCandidateAction,
  denyCandidateAction,
  denyAllNonFashionAction,
} from "@/lib/campaigns/candidates-mutations";

const BADGE: Record<FashionPrediction, { label: string; cls: string }> = {
  fashion: { label: "Fashion", cls: "bg-emerald-100 text-emerald-800" },
  accessory: { label: "Accessory", cls: "bg-violet-100 text-violet-800" },
  non_fashion: { label: "Non-fashion", cls: "bg-slate-200 text-slate-600" },
  unsure: { label: "Unsure", cls: "bg-amber-100 text-amber-800" },
};

export function CampaignCandidatesList({
  candidates,
  filter,
  bulkCount,
}: {
  candidates: CampaignCandidate[];
  filter: CandidateFilter;
  bulkCount: number;
}) {
  return (
    <div className="space-y-2">
      {filter === "non_fashion" && bulkCount > 0 ? (
        <BulkDenyBar count={bulkCount} />
      ) : null}
      {candidates.map((c) => (
        <Row key={c.asin} candidate={c} />
      ))}
    </div>
  );
}

function BulkDenyBar({ count }: { count: number }) {
  const router = useRouter();
  const [isBusy, startTransition] = useTransition();

  const handleBulk = () => {
    if (
      !window.confirm(
        `Deny all ${count} items the learner flagged as non-fashion? ` +
          `You can re-approve any of them individually afterward.`,
      )
    )
      return;
    startTransition(async () => {
      await denyAllNonFashionAction();
      router.refresh();
    });
  };

  return (
    <div className="mb-2 flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-sm text-muted">
        <span className="font-medium text-text">{count.toLocaleString()}</span>{" "}
        items look non-fashion. Clear them in one go — it also teaches the
        learner.
      </p>
      <button
        type="button"
        onClick={handleBulk}
        disabled={isBusy}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-rose text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-60 shrink-0"
      >
        <X size={12} strokeWidth={2} />
        {isBusy ? "Denying…" : `Deny all ${count.toLocaleString()}`}
      </button>
    </div>
  );
}

function Row({ candidate: c }: { candidate: CampaignCandidate }) {
  const router = useRouter();
  const [isBusy, startTransition] = useTransition();

  const handleApprove = () => {
    startTransition(async () => {
      await approveCandidateAction(c.asin);
      router.refresh();
    });
  };
  const handleDeny = () => {
    startTransition(async () => {
      await denyCandidateAction(c.asin);
      router.refresh();
    });
  };

  const badge = BADGE[c.predicted ?? "unsure"];

  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex flex-wrap gap-4 items-center">
      {/* Thumbnail */}
      {c.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={c.imageUrl}
          alt=""
          className="w-14 h-14 rounded-lg object-contain bg-white shrink-0"
        />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-bg shrink-0" />
      )}

      {/* Product */}
      <div className="flex-1 min-w-[220px]">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${badge.cls}`}
          >
            {badge.label}
          </span>
          {c.category ? (
            <span className="text-[11px] text-muted">{c.category}</span>
          ) : null}
        </div>
        <div className="font-medium text-sm line-clamp-1 mt-1">
          {c.productName ?? c.asin}
        </div>
        <div className="text-xs text-muted mt-0.5">
          {c.brandName ?? "—"} · {c.asin}
          {c.variantCount > 1 ? (
            <span className="text-rose">
              {" "}
              · {c.variantCount} variants roll up
            </span>
          ) : null}
        </div>
      </div>

      {/* Commission */}
      <div className="text-sm text-right">
        <div className="font-medium text-rose">
          {c.commissionRatePct != null
            ? `+${c.commissionRatePct}%`
            : c.commissionRaw ?? "—"}
        </div>
        <div className="text-[11px] text-muted uppercase tracking-widest">
          bonus
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <a
          href={`https://www.amazon.com/dp/${c.asin}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-border text-xs hover:border-rose transition-colors"
        >
          <ExternalLink size={12} strokeWidth={2} />
          View
        </a>
        <button
          type="button"
          onClick={handleDeny}
          disabled={isBusy}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-border text-xs hover:border-rose transition-colors disabled:opacity-60"
        >
          <X size={12} strokeWidth={2} />
          Deny
        </button>
        <button
          type="button"
          onClick={handleApprove}
          disabled={isBusy}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-rose text-white text-xs hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          <Check size={12} strokeWidth={2} />
          Approve
        </button>
      </div>
    </div>
  );
}
