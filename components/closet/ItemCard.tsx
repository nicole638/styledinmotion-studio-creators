"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ExternalLink,
  Loader2,
  AlertCircle,
  Sparkles,
  BadgeCheck,
} from "lucide-react";
import { type ClosetItem, formatPrice } from "@/types/closet";
import { consignEligibility } from "@/lib/consignment/eligibility";

interface Props {
  item: ClosetItem;
  /** True when this item already has an open consignment_requests row —
   *  the card swaps the active "Consign" pill for a quiet "Consigning ✓"
   *  state so the creator sees their submission persisted on refresh. */
  isConsigning?: boolean;
  /** Tap handler for the Consign pill. Parent opens the modal. */
  onConsignTap?: (item: ClosetItem) => void;
}

export function ItemCard({ item, isConsigning, onConsignTap }: Props) {
  const display = item.name ?? item.category ?? "Untitled piece";
  const photo = item.photoUrl;
  const outbound = item.affiliateUrl ?? item.url;
  const isPending = item.fetchStatus === "pending";
  const isFailed = item.fetchStatus === "failed";
  const isPartial = item.fetchStatus === "partial";

  // Eligibility for the Consign affordance: luxury brand + $200+ price.
  // Pending/failed items skip the check — no need to surface a consign
  // CTA before the metadata has even landed.
  const elig =
    !isPending && !isFailed
      ? consignEligibility(item.brand, item.category, item.price)
      : { eligible: false, payoutMinUsd: null, payoutMaxUsd: null };

  const showConsignPill = elig.eligible && !!onConsignTap;

  return (
    <div
      className={`group relative rounded-2xl border bg-card overflow-hidden transition-colors ${
        isFailed
          ? "border-[#F4C7BF] hover:border-[#B53D2A]"
          : "border-border hover:border-rose"
      }`}
    >
      <Link href={`/closet/${item.id}`} className="block">
        <div className="relative aspect-[4/5] bg-bg">
          {photo ? (
            <Image
              src={photo}
              alt={display}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 20vw"
              className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-xs uppercase tracking-widest text-muted">
              {isPending ? "" : "No photo"}
            </div>
          )}

          {isPending ? (
            <div className="absolute inset-0 grid place-items-center bg-black/35 backdrop-blur-[1px]">
              <div className="flex flex-col items-center gap-2 text-white">
                <Loader2 size={20} strokeWidth={2} className="animate-spin" />
                <span className="text-[11px] uppercase tracking-widest">
                  Fetching…
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="p-3">
          {item.brand ? (
            <div className="text-[11px] uppercase tracking-widest text-muted truncate">
              {item.brand}
            </div>
          ) : null}
          <div className="mt-1 text-sm font-medium truncate">{display}</div>

          {isFailed ? (
            <div className="mt-1.5 flex items-start gap-1.5 text-xs text-[#B53D2A]">
              <AlertCircle
                size={12}
                strokeWidth={2}
                className="mt-px shrink-0"
              />
              <span className="truncate font-medium">
                Tap to fill in details
              </span>
            </div>
          ) : (
            <div className="mt-1 flex items-center justify-between text-xs text-muted">
              <span>{isPending ? "Fetching…" : formatPrice(item.price)}</span>
              {outbound && !isPending ? (
                <span className="text-rose flex items-center gap-1">
                  <ExternalLink size={11} strokeWidth={2} />
                  Shop
                </span>
              ) : null}
            </div>
          )}

          {isPartial ? (
            <div className="mt-1 flex items-start gap-1.5 text-[11px] text-rose">
              <AlertCircle
                size={11}
                strokeWidth={2}
                className="mt-px shrink-0"
              />
              <span>Tap to fill in missing details</span>
            </div>
          ) : null}
        </div>
      </Link>

      {/* Consign pill — overlays the photo's bottom-right corner.
          Lives OUTSIDE the Link so taps don't navigate to /closet/<id>;
          the pill triggers the consignment modal via the parent. */}
      {showConsignPill ? (
        isConsigning ? (
          <div
            className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-card border border-rose/40 px-2.5 py-1 text-[11px] font-medium text-rose shadow-sm pointer-events-none"
            aria-label="Consignment submitted"
            title={
              elig.payoutMinUsd && elig.payoutMaxUsd
                ? `Estimated payout $${elig.payoutMinUsd.toLocaleString()}–$${elig.payoutMaxUsd.toLocaleString()}`
                : "Consignment submitted"
            }
          >
            <BadgeCheck size={11} strokeWidth={2.5} />
            Consigning
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onConsignTap?.(item);
            }}
            className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-rose text-white px-2.5 py-1 text-[11px] font-medium shadow-md hover:opacity-95 transition-opacity"
            aria-label="Consign with The RealReal"
            title={
              elig.payoutMinUsd && elig.payoutMaxUsd
                ? `Estimated payout $${elig.payoutMinUsd.toLocaleString()}–$${elig.payoutMaxUsd.toLocaleString()}`
                : "Consign with The RealReal"
            }
          >
            <Sparkles size={11} strokeWidth={2.5} />
            Consign
          </button>
        )
      ) : null}
    </div>
  );
}
