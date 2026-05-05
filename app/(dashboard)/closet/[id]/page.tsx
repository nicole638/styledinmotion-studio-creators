import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  type ClosetItemRow,
  rowToClosetItem,
} from "@/types/closet";
import { EditItemForm } from "./EditItemForm";

export const metadata = { title: "Edit piece" };

const COLUMNS =
  "id, name, brand, category, price, url, affiliate_url, photo_url, cutout_photo_url, original_photo_url, archived, default_worn_size, created_at";

export default async function ClosetItemEditPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data, error } = await supabase
    .from("creator_items")
    .select(COLUMNS)
    .eq("id", params.id)
    .eq("creator_id", user.id)
    .maybeSingle();

  if (error || !data) notFound();

  const item = rowToClosetItem(data as ClosetItemRow);

  return (
    <div className="max-w-3xl">
      <Link
        href="/closet"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-text mb-4"
      >
        <ChevronLeft size={14} strokeWidth={2} /> Closet
      </Link>

      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Edit piece
      </p>
      <h1 className="font-display text-4xl">
        {item.name ?? "Untitled piece"}
      </h1>
      {item.archived ? (
        <p className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full bg-card border border-border text-xs uppercase tracking-widest text-muted">
          Archived
        </p>
      ) : null}

      <div className="mt-10 editorial-divider" />

      <div className="mt-8">
        <EditItemForm item={item} />
      </div>
    </div>
  );
}
