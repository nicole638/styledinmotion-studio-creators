import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Sparkles, Camera, Layers, FileEdit, User, ArrowUpRight } from "lucide-react";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const firstName =
    (user?.user_metadata?.first_name as string | undefined) ?? "there";

  // At-a-glance counts. RLS scopes everything to the signed-in creator.
  const [closet, published, drafts] = user
    ? await Promise.all([
        supabase
          .from("creator_items")
          .select("id", { count: "exact", head: true })
          .eq("creator_id", user.id)
          .eq("archived", false),
        supabase
          .from("looks")
          .select("id", { count: "exact", head: true })
          .eq("creator_id", user.id)
          .eq("archived", false)
          .not("published_at", "is", null),
        supabase
          .from("looks")
          .select("id", { count: "exact", head: true })
          .eq("creator_id", user.id)
          .eq("archived", false)
          .is("published_at", null),
      ])
    : [{ count: 0 }, { count: 0 }, { count: 0 }];

  return (
    <div className="max-w-4xl">
      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Welcome
      </p>
      <h1 className="font-display text-4xl">Hi, {firstName}.</h1>
      <p className="mt-3 text-muted leading-relaxed max-w-prose">
        This is your Studio. Manage your closet, compose looks from desktop,
        keep drafts, and edit your profile — all in sync with iOS.
      </p>

      <div className="mt-10 grid gap-3 grid-cols-3 max-w-md">
        <Stat label="Pieces" count={closet.count ?? 0} href="/closet" />
        <Stat label="Published" count={published.count ?? 0} href="/looks" />
        <Stat
          label="Drafts"
          count={drafts.count ?? 0}
          href="/looks?view=draft"
        />
      </div>

      <div className="mt-12 editorial-divider" />

      <p className="mt-10 text-xs uppercase tracking-[0.25em] text-rose mb-4">
        Jump in
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Tile
          href="/closet/new"
          icon={<Sparkles size={18} strokeWidth={1.75} />}
          title="Add a piece"
          copy="Paste a product URL — Amazon, Zara, anywhere — and we'll pull the photo, brand, and price."
        />
        <Tile
          href="/looks/new"
          icon={<Camera size={18} strokeWidth={1.75} />}
          title="Compose a look"
          copy="Drop a cover photo, multi-select pieces from your closet, write a caption, publish or save as draft."
        />
        <Tile
          href="/collage"
          icon={<Layers size={18} strokeWidth={1.75} />}
          title="Build a collage"
          copy="Drag-and-scale cutouts on a 1080×1080 canvas. Add photos, text, pick from four templates."
        />
        <Tile
          href="/profile"
          icon={<User size={18} strokeWidth={1.75} />}
          title="Edit your profile"
          copy="Bio, photo, social handles, sizes, body-type tags — same data shoppers see in your iOS feed."
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  count,
  href,
}: {
  label: string;
  count: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-border bg-card p-4 hover:border-rose transition-colors"
    >
      <div className="text-[10px] uppercase tracking-widest text-muted">
        {label}
      </div>
      <div className="mt-1 font-display text-3xl">{count}</div>
    </Link>
  );
}

function Tile({
  icon,
  title,
  copy,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  copy: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group block bg-card border border-border rounded-2xl p-5 hover:border-rose transition-colors"
    >
      <div className="flex items-center gap-2 mb-2 text-rose">
        {icon}
        <h3 className="font-display text-lg leading-none flex-1">{title}</h3>
        <ArrowUpRight
          size={14}
          strokeWidth={2}
          className="text-muted group-hover:text-rose transition-colors"
        />
      </div>
      <p className="text-sm text-muted leading-relaxed">{copy}</p>
    </Link>
  );
}
