import Image from "next/image";
import Link from "next/link";
import { type Look, formatLookDate } from "@/types/look";
import { ShareLookButton } from "./ShareLookButton";

interface Props {
  look: Look;
}

export function LookCard({ look }: Props) {
  const photo = look.coverPhotoUrl;
  const title = look.title || "Untitled look";

  return (
    <Link
      href={`/looks/${look.id}`}
      className="group block rounded-2xl border border-border bg-card overflow-hidden hover:border-rose transition-colors"
    >
      <div className="relative aspect-[4/5] bg-bg">
        {photo ? (
          <Image
            src={photo}
            alt={title}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-xs uppercase tracking-widest text-muted">
            No cover
          </div>
        )}
        <StatusBadge status={look.status} />
        {/* Share affordance — only meaningful for published looks (drafts +
            archived have no public URL). Sits top-right so the status badge
            (top-left) stays its own beat. */}
        {look.status === "published" ? (
          <div className="absolute top-2 right-2">
            <ShareLookButton
              shortCode={look.shortCode}
              title={title}
              variant="overlay"
            />
          </div>
        ) : null}
      </div>
      <div className="p-3">
        <div className="text-sm font-medium truncate">{title}</div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted">
          <span>
            {look.itemCount} {look.itemCount === 1 ? "piece" : "pieces"}
          </span>
          <span>
            {look.status === "draft"
              ? `Updated ${formatLookDate(look.updatedAt)}`
              : look.status === "archived"
                ? `Archived`
                : formatLookDate(look.publishedAt)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: Look["status"] }) {
  if (status === "published") return null;
  const label = status === "draft" ? "Draft" : "Archived";
  return (
    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-bg/90 backdrop-blur text-[10px] uppercase tracking-widest text-muted border border-border">
      {label}
    </div>
  );
}
