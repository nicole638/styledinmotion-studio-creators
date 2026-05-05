"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import Link from "next/link";

interface Props {
  initialSearch: string;
  initialView: "active" | "archived";
  initialCategory: string;
  activeCount: number;
  archivedCount: number;
}

const CATEGORIES = [
  "All",
  "Top",
  "Pants",
  "Dress",
  "Shoes",
  "Bag",
  "Jewelry",
  "Accessory",
  "Outerwear",
];

export function ClosetToolbar({
  initialSearch,
  initialView,
  initialCategory,
  activeCount,
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
      router.push(`/closet?${sp.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ q: search.trim() || null });
  };

  return (
    <div className="space-y-4">
      {/* Tab row: active vs archived */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => updateParams({ view: null })}
          className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
            initialView === "active"
              ? "bg-rose text-white"
              : "bg-card border border-border hover:border-rose"
          }`}
        >
          Closet ({activeCount})
        </button>
        <button
          type="button"
          onClick={() => updateParams({ view: "archived" })}
          className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
            initialView === "archived"
              ? "bg-rose text-white"
              : "bg-card border border-border hover:border-rose"
          }`}
        >
          Archived ({archivedCount})
        </button>
        <div className="flex-1" />
        <Link
          href="/closet/new"
          className="inline-flex items-center justify-center rounded-full bg-rose text-white px-4 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Add piece
        </Link>
      </div>

      {/* Search + category filter */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[220px]">
          <Search
            size={14}
            strokeWidth={2}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or brand"
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

        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((cat) => {
            const value = cat === "All" ? null : cat;
            const active = (initialCategory || "All") === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => updateParams({ category: value })}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${
                  active
                    ? "bg-text text-white"
                    : "bg-card border border-border hover:border-rose"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
