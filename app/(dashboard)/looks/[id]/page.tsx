import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  type LookRow,
  type LookItemRow,
  rowToLook,
  rowToLookItem,
  formatLookDate,
} from "@/types/look";
import {
  type ClosetItemRow,
  rowToClosetItem,
} from "@/types/closet";

export const metadata = { title: "Look" };

const LOOK_COLUMNS =
  "id, title, caption, cover_photo_url, short_code, archived, published_at, clicks, created_at, updated_at";
const ITEM_COLUMNS =
  "id, name, brand, category, price, url, affiliate_url, photo_url, cutout_photo_url, original_photo_url, archived, default_worn_size, created_at";

export default async function LookDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: lookData, error: lookErr } = await supabase
    .from("looks")
    .select(LOOK_COLUMNS)
    .eq("id", params.id)
    .eq("creator_id", user.id)
    .maybeSingle();

  if (lookErr || !lookData) notFound();

  const { data: itemRows } = await supabase
    .from("look_items")
    .select(`id, look_id, creator_item_id, sort_order, worn_size, creator_items(${ITEM_COLUMNS})`)
    .eq("look_id", params.id)
    .order("sort_order", { ascending: true });

  // Supabase's TS types treat foreign-table joins as arrays even when the
  // FK is 1:1; collapse to first element. Cast through unknown because the
  // generated types don't know cardinality.
  type RawRow = LookItemRow & { creator_items: ClosetItemRow | ClosetItemRow[] | null };
  const items = ((itemRows ?? []) as unknown as RawRow[]).map((row) => {
    const ci = Array.isArray(row.creator_items)
      ? row.creator_items[0] ?? null
      : row.creator_items;
    return {
      lookItem: rowToLookItem(row),
      closetItem: ci ? rowToClosetItem(ci) : null,
    };
  });

  const look = rowToLook(lookData as LookRow, items.length);

  return (
    <div className="max-w-3xl">
      <Link
        href="/looks"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-text mb-4"
      >
        <ChevronLeft size={14} strokeWidth={2} /> Looks
      </Link>

      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        {look.status === "draft"
          ? "Draft"
          : look.status === "archived"
            ? "Archived look"
            : "Published look"}
      </p>
      <h1 className="font-display text-4xl">
        {look.title || "Untitled look"}
      </h1>
      {look.caption ? (
        <p className="mt-3 text-muted leading-relaxed max-w-prose">
          {look.caption}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {look.publishedAt ? (
          <span>Published {formatLookDate(look.publishedAt)}</span>
        ) : null}
        {look.updatedAt && look.status === "draft" ? (
          <span>Last edited {formatLookDate(look.updatedAt)}</span>
        ) : null}
        {look.status === "published" ? (
          <span>{look.clicks} clicks</span>
        ) : null}
        <span>{look.itemCount} pieces</span>
      </div>

      <div className="mt-10 editorial-divider" />

      {look.coverPhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={look.coverPhotoUrl}
          alt={look.title}
          className="mt-8 w-full rounded-2xl border border-border bg-card"
        />
      ) : null}

      <h2 className="mt-10 font-display text-2xl">Pieces</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          No pieces tagged on this look yet.
        </p>
      ) : (
        <ul className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map(({ lookItem, closetItem }) => (
            <li
              key={lookItem.id}
              className="rounded-2xl border border-border bg-card overflow-hidden"
            >
              <div className="aspect-[4/5] bg-bg relative">
                {closetItem?.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={closetItem.photoUrl}
                    alt={closetItem.name ?? "Piece"}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-xs uppercase tracking-widest text-muted">
                    No photo
                  </div>
                )}
              </div>
              <div className="p-3">
                {closetItem?.brand ? (
                  <div className="text-[11px] uppercase tracking-widest text-muted truncate">
                    {closetItem.brand}
                  </div>
                ) : null}
                <div className="mt-1 text-sm font-medium truncate">
                  {closetItem?.name ?? "Untitled piece"}
                </div>
                {lookItem.wornSize ? (
                  <div className="mt-1 text-xs text-muted">
                    Worn size: {lookItem.wornSize}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-12 bg-card border border-border rounded-2xl p-6">
        <p className="text-xs uppercase tracking-[0.25em] text-rose mb-2">
          Edit ships next
        </p>
        <p className="text-sm text-muted leading-relaxed">
          Editing the cover photo, retagging pieces, publishing a draft, and
          archiving land in Batch 2 of Phase 1C. For now, edits go through
          the iOS app and reflect here on next refresh.
        </p>
        <a
          href={`https://styled.in/${look.shortCode}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-sm text-rose underline underline-offset-2"
        >
          Public link <ExternalLink size={12} strokeWidth={2} />
        </a>
      </div>
    </div>
  );
}
