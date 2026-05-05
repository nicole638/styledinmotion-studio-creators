"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import Link from "next/link";
import type { LookStatus } from "@/types/look";

interface Props {
  initialSearch: string;
  initialView: LookStatus;
  publishedCount: number;
  draftsCount: number;
  archivedCount: number;
}

export function LooksToolbar({
  initialSearch,
  initialView,
  publishedCount,
  draftsCount,
  archivedCount,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [, startTransition] = useTransition();

  const updateParams = (next: Record<string, string | null>) => {
    const sp = new URLSearchParams(params?.toString() ?? "");
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    startTransition(() => {
      router.push(`/looks?${sp.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ q: search.trim() || null });
  };

  const Tab = ({
    view,
    label,
    count,
  }: {
    view: LookStatus;
    label: string;
    count: number;
  }) => {
    const isActive = initialView === view;
    return (
      <button
        type="button"
        onClick={() =>
          updateParams({ view: view === "published" ? null : view })
        }
        className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
          isActive
            ? "bg-rose text-white"
            : "bg-card border border-border hover:border-rose"
        }`}
      >
        {label} ({count})
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 flex-wrap">
        <Tab view="published" label="Published" count={publishedCount} />
        <Tab view="draft" label="Drafts" count={draftsCount} />
        <Tab view="archived" label="Archived" count={archivedCount} />
        <div className="flex-1" />
        <Link
          href="/looks/new"
          className="inline-flex items-center justify-center rounded-full bg-rose text-white px-4 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Create look
        </Link>
      </div>

      <form onSubmit={handleSearchSubmit} className="relative max-w-md">
        <Search
          size={14}
          strokeWidth={2}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title or caption"
          className="w-full rounded-full border border-border bg-card pl-9 pr-9 py-2 text-sm outline-none focus:border-rose"
        />
        {search ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setSearch("");
              updateParams({ q: null });
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
          >
            <X size={14} strokeWidth={2} />
          </button>
        ) : null}
      </form>
    </div>
  );
}
