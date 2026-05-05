import Link from "next/link";
import { Camera } from "lucide-react";
import { fetchLookCounts, fetchLooks } from "@/lib/looks/queries";
import { LookCard } from "@/components/looks/LookCard";
import { LooksToolbar } from "@/components/looks/LooksToolbar";
import type { LookStatus } from "@/types/look";

export const metadata = { title: "Looks" };

type SearchParams = {
  q?: string;
  view?: LookStatus;
};

export default async function LooksPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const view: LookStatus =
    searchParams.view === "draft" || searchParams.view === "archived"
      ? searchParams.view
      : "published";
  const search = searchParams.q ?? "";

  const [looks, counts] = await Promise.all([
    fetchLooks({ view, search: search || undefined }),
    fetchLookCounts(),
  ]);

  return (
    <div className="max-w-6xl">
      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Looks
      </p>
      <h1 className="font-display text-4xl">Your published library.</h1>
      <p className="mt-3 text-muted leading-relaxed max-w-prose">
        Every look you've published or saved as a draft, across iOS and web.
        Drop a cover photo, tag pieces from your closet, and ship.
      </p>

      <div className="mt-10 editorial-divider" />

      <div className="mt-8">
        <LooksToolbar
          initialSearch={search}
          initialView={view}
          publishedCount={counts.published}
          draftsCount={counts.drafts}
          archivedCount={counts.archived}
        />
      </div>

      <div className="mt-8">
        {looks.length === 0 ? (
          <EmptyState view={view} hasFilters={Boolean(search)} />
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {looks.map((look) => (
              <li key={look.id}>
                <LookCard look={look} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  view,
  hasFilters,
}: {
  view: LookStatus;
  hasFilters: boolean;
}) {
  if (hasFilters) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <p className="text-muted">
          No looks match your search. Try clearing it.
        </p>
      </div>
    );
  }

  if (view === "archived") {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <p className="text-muted">No archived looks.</p>
      </div>
    );
  }

  if (view === "draft") {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <p className="text-muted">
          No drafts. Start a look and tap Save Draft to land it here.
        </p>
        <Link
          href="/looks/new"
          className="inline-flex items-center justify-center mt-5 rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Start a look
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-12 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-bg flex items-center justify-center mb-5">
        <Camera size={20} strokeWidth={1.5} className="text-rose" />
      </div>
      <h2 className="font-display text-2xl">No looks yet.</h2>
      <p className="mt-3 text-sm text-muted max-w-md mx-auto leading-relaxed">
        Looks are how shoppers find you. Drop a cover photo, tag the pieces
        you're wearing, and publish. You can save as a draft and finish later.
      </p>
      <Link
        href="/looks/new"
        className="inline-flex items-center justify-center mt-6 rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        + Create your first look
      </Link>
    </div>
  );
}
