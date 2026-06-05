"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { BrandStatus, StorefrontWithMemberCount } from "@/types/storefronts";

type Filter = "all" | BrandStatus;

const FILTER_LABELS: Record<Filter, string> = {
  all: "All",
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

export function StorefrontsList({
  storefronts,
}: {
  storefronts: StorefrontWithMemberCount[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [showTest, setShowTest] = useState(false);

  const visible = useMemo(() => {
    return storefronts.filter((s) => {
      if (filter !== "all" && s.status !== filter) return false;
      if (!showTest && s.isTest) return false;
      return true;
    });
  }, [storefronts, filter, showTest]);

  return (
    <div>
      {/* Filter pills + test toggle */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors border ${
              filter === f
                ? "bg-ink text-white border-ink"
                : "bg-white text-ink border-border hover:border-ink/40"
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
        <label className="ml-auto inline-flex items-center gap-2 text-sm text-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showTest}
            onChange={(e) => setShowTest(e.target.checked)}
            className="w-4 h-4 rounded border-border accent-rose"
          />
          Show test brands
        </label>
      </div>

      {/* Table */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg/60 border-b border-border">
            <tr className="text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3 w-14"></th>
              <th className="px-4 py-3">Brand</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3 text-right">Comm. %</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Members</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-b-0 hover:bg-bg/30 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/admin/storefronts/${s.id}`} className="block">
                    {s.logoUrl ? (
                      <Image
                        src={s.logoUrl}
                        alt={s.name}
                        width={36}
                        height={36}
                        className="rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-bg-alt border border-border flex items-center justify-center text-muted text-xs">
                        {s.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </Link>
                </td>
                <td className="px-4 py-3 font-medium">
                  <Link href={`/admin/storefronts/${s.id}`} className="hover:text-rose">
                    {s.name}
                    {s.isTest ? (
                      <span className="ml-2 inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider bg-amber-100 text-amber-800 rounded-full">
                        test
                      </span>
                    ) : null}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted font-mono text-xs">{s.slug}</td>
                <td className="px-4 py-3 text-right tabular-nums">{s.commissionPct}%</td>
                <td className="px-4 py-3">
                  <StatusPill status={s.status} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted">
                  {s.memberCount}
                </td>
                <td className="px-4 py-3 text-muted text-xs">
                  {new Date(s.updatedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted">
                  No storefronts match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: BrandStatus }) {
  const styles: Record<BrandStatus, string> = {
    active: "bg-emerald-100 text-emerald-800",
    paused: "bg-amber-100 text-amber-800",
    archived: "bg-gray-200 text-gray-700",
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${styles[status]}`}>
      {status}
    </span>
  );
}
