import Link from "next/link";
import { Shirt } from "lucide-react";
import {
  fetchClosetCounts,
  fetchClosetItems,
} from "@/lib/closet/queries";
import { createClient } from "@/lib/supabase/server";
import { ClosetItemsList } from "@/components/closet/ClosetItemsList";
import { ClosetToolbar } from "@/components/closet/ClosetToolbar";

export const metadata = { title: "Closet" };

type SearchParams = {
  q?: string;
  view?: "archived" | "active";
  category?: string;
};

export default async function ClosetPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const view = searchParams.view === "archived" ? "archived" : "active";
  const search = searchParams.q ?? "";
  const category = searchParams.category ?? "";

  const supabase = createClient();
  const [{ data: { user } }, items, counts] = await Promise.all([
    supabase.auth.getUser(),
    fetchClosetItems({
      archivedOnly: view === "archived",
      search: search || undefined,
      category: category || undefined,
    }),
    fetchClosetCounts(),
  ]);

  return (
    <div className="max-w-6xl">
      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Closet
      </p>
      <h1 className="font-display text-4xl">Your pieces.</h1>
      <p className="mt-3 text-muted leading-relaxed max-w-prose">
        Every piece you've added across iOS and web. Drop a URL to add new
        ones, or tap any piece to edit its photo, size, or details.
      </p>

      <div className="mt-10 editorial-divider" />

      <div className="mt-8">
        <ClosetToolbar
          initialSearch={search}
          initialView={view}
          initialCategory={category}
          activeCount={counts.active}
          archivedCount={counts.archived}
        />
      </div>

      <div className="mt-8">
        {items.length === 0 ? (
          <EmptyState view={view} hasFilters={Boolean(search || category)} />
        ) : user ? (
          <ClosetItemsList
            initialItems={items}
            creatorId={user.id}
            archivedView={view === "archived"}
          />
        ) : null}
      </div>
    </div>
  );
}

function EmptyState({
  view,
  hasFilters,
}: {
  view: "active" | "archived";
  hasFilters: boolean;
}) {
  if (hasFilters) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <p className="text-muted">
          No pieces match those filters. Try clearing search or category.
        </p>
      </div>
    );
  }

  if (view === "archived") {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <p className="text-muted">No archived pieces.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-12 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-bg flex items-center justify-center mb-5">
        <Shirt size={20} strokeWidth={1.5} className="text-rose" />
      </div>
      <h2 className="font-display text-2xl">Your closet is empty.</h2>
      <p className="mt-3 text-sm text-muted max-w-md mx-auto leading-relaxed">
        Drop in a product URL — Amazon, a brand site, anywhere — and we'll
        pull the photo, brand, and price for you. You can paste one or a
        whole list.
      </p>
      <Link
        href="/closet/new"
        className="inline-flex items-center justify-center mt-6 rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        + Add your first piece
      </Link>
    </div>
  );
}
