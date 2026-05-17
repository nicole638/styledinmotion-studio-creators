import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchClosetItems } from "@/lib/closet/queries";
import { LookComposer } from "@/components/looks/LookComposer";
import { CollageEditor } from "@/components/collage/CollageEditor";
import { ShareLookMenu } from "@/components/looks/ShareLookMenu";
import type { ComposerItem } from "@/lib/looks/mutations";
import { type LookRow, deriveStatus } from "@/types/look";
import { jsonToLayout } from "@/types/collage";
import { rowToClosetItem, type ClosetItemRow } from "@/types/closet";

export const metadata = { title: "Edit look" };

// collage_layout JSONB lets us tell collages from photo-cover looks. Cover/
// short_code/clicks etc. come along for the LookComposer path.
const LOOK_COLUMNS =
  "id, title, caption, cover_photo_url, short_code, archived, published_at, clicks, created_at, updated_at, collage_layout";

const CUTOUT_ITEM_COLUMNS =
  "id, name, brand, category, price, url, affiliate_url, photo_url, cutout_photo_url, original_photo_url, candidate_photo_urls, archived, default_worn_size, created_at";

export default async function EditLookPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("looks")
    .select(LOOK_COLUMNS)
    .eq("id", params.id)
    .eq("creator_id", user.id)
    .maybeSingle();

  if (error || !data) notFound();

  const look = data as LookRow & { collage_layout: unknown };
  const isDraft = !look.published_at;

  // Collage detection: if the look has a non-null collage_layout JSONB that
  // parses into our shape, it's a collage and edits go through CollageEditor.
  // Otherwise it's a photo-cover look and the regular LookComposer handles it.
  const collageLayout = look.collage_layout
    ? jsonToLayout(look.collage_layout)
    : null;
  const isCollage = collageLayout !== null;

  if (isCollage) {
    // Cutout-ready closet items for the picker — same filter as /collage create.
    // Without `cutout_photo_url`, an item can't be composited onto the canvas.
    const { data: rows } = await supabase
      .from("creator_items")
      .select(CUTOUT_ITEM_COLUMNS)
      .eq("creator_id", user.id)
      .eq("archived", false)
      .not("cutout_photo_url", "is", null)
      .order("created_at", { ascending: false });

    const cutoutItems = ((rows ?? []) as ClosetItemRow[]).map(rowToClosetItem);

    const lookStatus = deriveStatus(look as LookRow);
    return (
      <div className="max-w-7xl">
        <Link
          href={`/looks/${look.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-text mb-4"
        >
          <ChevronLeft size={14} strokeWidth={2} /> Look detail
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
              Edit collage
            </p>
            <h1 className="font-display text-4xl">
              {look.title || "Untitled collage"}
            </h1>
            <p className="mt-2 text-xs uppercase tracking-widest text-muted">
              {lookStatus === "published"
                ? "Published"
                : lookStatus === "draft"
                  ? "Draft"
                  : "Archived"}
            </p>
          </div>
          {lookStatus === "published" ? (
            <ShareLookMenu
              shortCode={look.short_code}
              title={look.title || "Untitled collage"}
              coverPhotoUrl={look.cover_photo_url ?? null}
            />
          ) : null}
        </div>
        <p className="mt-3 text-muted leading-relaxed max-w-prose">
          Add or remove pieces, rearrange the layout, change the background
          or template. Saving re-renders the flattened cover image.
        </p>

        <div className="mt-10 editorial-divider" />

        <div className="mt-8">
          <CollageEditor
            creatorId={user.id}
            cutoutItems={cutoutItems}
            initial={{
              lookId: look.id,
              title: look.title ?? "",
              layout: collageLayout,
              isDraft,
            }}
          />
        </div>
      </div>
    );
  }

  // ───── Non-collage (photo-cover) look — original LookComposer flow ─────

  const { data: itemRows } = await supabase
    .from("look_items")
    .select("creator_item_id, sort_order, worn_size")
    .eq("look_id", look.id)
    .order("sort_order", { ascending: true });

  const initialItems: ComposerItem[] = ((itemRows ?? []) as Array<{
    creator_item_id: string;
    sort_order: number;
    worn_size: string | null;
  }>).map((row) => ({
    itemId: row.creator_item_id,
    wornSize: row.worn_size ?? "",
  }));

  const closet = await fetchClosetItems({ archivedOnly: false });

  const lookStatus = deriveStatus(look as LookRow);
  return (
    <div className="max-w-3xl">
      <Link
        href={`/looks/${look.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-text mb-4"
      >
        <ChevronLeft size={14} strokeWidth={2} /> Look detail
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
            Edit look
          </p>
          <h1 className="font-display text-4xl">
            {look.title || "Untitled look"}
          </h1>
          <p className="mt-2 text-xs uppercase tracking-widest text-muted">
            {lookStatus === "published"
              ? "Published"
              : lookStatus === "draft"
                ? "Draft"
                : "Archived"}
          </p>
        </div>
        {lookStatus === "published" ? (
          <ShareLookMenu
            shortCode={look.short_code}
            title={look.title || "Untitled look"}
            coverPhotoUrl={look.cover_photo_url ?? null}
          />
        ) : null}
      </div>

      <div className="mt-10 editorial-divider" />

      <div className="mt-8">
        <LookComposer
          mode="edit"
          creatorId={user.id}
          closet={closet}
          initialLook={{
            id: look.id,
            title: look.title,
            caption: look.caption ?? "",
            coverPhotoUrl: look.cover_photo_url ?? "",
            archived: look.archived,
            isDraft,
          }}
          initialItems={initialItems}
        />
      </div>
    </div>
  );
}
