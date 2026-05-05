import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchClosetItems } from "@/lib/closet/queries";
import { LookComposer } from "@/components/looks/LookComposer";
import type { ComposerItem } from "@/lib/looks/mutations";
import { type LookRow, deriveStatus } from "@/types/look";

export const metadata = { title: "Edit look" };

const LOOK_COLUMNS =
  "id, title, caption, cover_photo_url, short_code, archived, published_at, clicks, created_at, updated_at";

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

  const look = data as LookRow;
  const isDraft = !look.published_at;

  // Fetch existing tagged items in sort order
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

  // Closet for picker — show non-archived. We don't filter out already-tagged
  // items here; the picker disables them by selectedIds.
  const closet = await fetchClosetItems({ archivedOnly: false });

  return (
    <div className="max-w-3xl">
      <Link
        href={`/looks/${look.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-text mb-4"
      >
        <ChevronLeft size={14} strokeWidth={2} /> Look detail
      </Link>

      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Edit look
      </p>
      <h1 className="font-display text-4xl">
        {look.title || "Untitled look"}
      </h1>
      <p className="mt-2 text-xs uppercase tracking-widest text-muted">
        {deriveStatus(look) === "published"
          ? "Published"
          : deriveStatus(look) === "draft"
            ? "Draft"
            : "Archived"}
      </p>

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
