"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, ExternalLink } from "lucide-react";
import type { CampaignCandidate } from "@/types/campaigns";
import {
  approveCandidateAction,
  denyCandidateAction,
} from "@/lib/campaigns/candidates-mutations";

export function CampaignCandidatesList({
  candidates,
}: {
  candidates: CampaignCandidate[];
}) {
  return (
    <div className="space-y-2">
      {candidates.map((c) => (
        <Row key={c.asin} candidate={c} />
      ))}
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
        <div className="font-medium text-sm line-clamp-1">
          {c.productName ?? c.asin}
        </div>
        <div className="text-xs text-muted mt-0.5">
          {c.brandName ?? "—"} · {c.asin}
          {c.category ? ` · ${c.category}` : ""}
        </div>
      </div>

      {/* Commission */}
      <div className="text-sm">
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
