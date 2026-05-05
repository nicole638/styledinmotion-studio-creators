import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { type ClosetItem, formatPrice } from "@/types/closet";

interface Props {
  item: ClosetItem;
}

export function ItemCard({ item }: Props) {
  const display = item.name ?? item.category ?? "Untitled piece";
  const photo = item.photoUrl;
  const outbound = item.affiliateUrl ?? item.url;

  return (
    <Link
      href={`/closet/${item.id}`}
      className="group block rounded-2xl border border-border bg-card overflow-hidden hover:border-rose transition-colors"
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
            No photo
          </div>
        )}
      </div>
      <div className="p-3">
        {item.brand ? (
          <div className="text-[11px] uppercase tracking-widest text-muted truncate">
            {item.brand}
          </div>
        ) : null}
        <div className="mt-1 text-sm font-medium truncate">{display}</div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted">
          <span>{formatPrice(item.price)}</span>
          {outbound ? (
            <span className="text-rose flex items-center gap-1">
              <ExternalLink size={11} strokeWidth={2} />
              Shop
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
