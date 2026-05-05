import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  type ClosetItemRow,
  rowToClosetItem,
} from "@/types/closet";
import { CollageEditor } from "@/components/collage/CollageEditor";

export const metadata = { title: "Collage builder" };

const ITEM_COLUMNS =
  "id, name, brand, category, price, url, affiliate_url, photo_url, cutout_photo_url, original_photo_url, archived, default_worn_size, created_at";

export default async function CollagePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Cutout-ready: archived=false AND cutout_photo_url IS NOT NULL.
  // Items without a cutout will have backgrounds and look wrong composited,
  // so we filter strictly. The empty-state UI tells the creator to run
  // cutout generation on iOS for the missing items.
  const { data: rows } = await supabase
    .from("creator_items")
    .select(ITEM_COLUMNS)
    .eq("creator_id", user.id)
    .eq("archived", false)
    .not("cutout_photo_url", "is", null)
    .order("created_at", { ascending: false });

  const cutoutItems = ((rows ?? []) as ClosetItemRow[]).map(rowToClosetItem);

  // Total non-archived count for the header copy
  const { count: totalActiveCount } = await supabase
    .from("creator_items")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", user.id)
    .eq("archived", false);

  const cutoutReadyCount = cutoutItems.length;
  const totalCount = totalActiveCount ?? 0;

  return (
    <div className="max-w-6xl">
      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Collage builder
      </p>
      <h1 className="font-display text-4xl">Compose a collage.</h1>
      <p className="mt-3 text-muted leading-relaxed max-w-prose">
        Pick from your cutout-ready closet, choose a template, then drag,
        scale, and rotate pieces on the 1080×1080 canvas. We flatten it
        to a high-res PNG when you save.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
        <span>
          {cutoutReadyCount} of {totalCount} pieces are cutout-ready
        </span>
        {cutoutReadyCount < totalCount ? (
          <Link
            href="/closet"
            className="text-rose underline underline-offset-2"
          >
            View closet →
          </Link>
        ) : null}
      </div>

      <div className="mt-10 editorial-divider" />

      <div className="mt-8">
        <CollageEditor creatorId={user.id} cutoutItems={cutoutItems} />
      </div>
    </div>
  );
}
