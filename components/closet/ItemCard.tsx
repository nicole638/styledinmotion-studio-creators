import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { type ClosetItem, formatPrice } from "@/types/closet";

interface Props {
  item: ClosetItem;
}

export function ItemCard({ item }: Props) {
  const display = item.name ?? item.category ?? "Untitled piece";
  const photo = item.photoUrl;
  const outbound = item.affiliateUrl ?? item.url;
  const isPending = item.fetchStatus === "pending";
  const isFailed = item.fetchStatus === "failed";
  const isPartial = item.fetchStatus === "partial";

  return (
    <Link
      href={`/closet/${item.id}`}
      className={`group block rounded-2xl border bg-card overflow-hidden transition-colors ${
        isFailed
          ? "border-[#F4C7BF] hover:border-[#B53D2A]"
          : "border-border hover:border-rose"
      }`}
    >
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
            <AlertCircle size={12} strokeWidth={2} className="mt-px shrink-0" />
            <span className="truncate">
              {item.fetchError
                ? "Couldn't fetch — open to retry"
                : "Fetch failed — open to retry"}
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
          <div className="mt-1 text-[11px] text-muted">
            Some details missing — open to fill in.
          </div>
        ) : null}
      </div>
    </Link>
  );
}
