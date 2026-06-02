"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import type { Merchant } from "@/types/brands";

interface BrandsGridProps {
  initialSearch: string;
  merchants: Merchant[];
}

/**
 * Client wrapper for the brands index. Owns the search box (debounced into
 * the URL so the server can re-fetch with a fresh ilike) and renders the
 * merchant grid.
 *
 * We re-route via ?q=... rather than mutating state in place. That keeps
 * the server as the source of truth and means the back button restores
 * the prior search.
 */
export function BrandsGrid({ initialSearch, merchants }: BrandsGridProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [, startTransition] = useTransition();

  // Debounced URL update — 220ms feels snappy without thrashing the DB
  // on every keystroke for the largest merchant lists.
  useEffect(() => {
    if (search === initialSearch) return;
    const handle = setTimeout(() => {
      const params = new URLSearchParams();
      if (search.trim().length > 0) params.set("q", search.trim());
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `/brands?${qs}` : "/brands");
      });
    }, 220);
    return () => clearTimeout(handle);
  }, [search, initialSearch, router]);

  return (
    <>
      <div className="relative mb-6 max-w-md">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search brands…"
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-border bg-bg text-sm focus:outline-none focus:border-rose"
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted hover:text-text"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {merchants.map((m) => (
          <li key={m.id}>
            <BrandCard merchant={m} />
          </li>
        ))}
      </ul>
    </>
  );
}

function BrandCard({ merchant }: { merchant: Merchant }) {
  const commission = formatCommissionRange(
    merchant.commissionMin,
    merchant.commissionMax,
  );
  const productCount = merchant.feedLastProductCount;

  return (
    <Link
      href={`/brands/${merchant.id}`}
      className="group block rounded-2xl border border-border bg-card hover:border-rose transition-colors overflow-hidden"
    >
      <div className="aspect-square bg-bg flex items-center justify-center p-6">
        {merchant.logoUrl ? (
          <Image
            src={merchant.logoUrl}
            alt={merchant.merchantName}
            width={180}
            height={180}
            className="max-w-full max-h-full object-contain"
            unoptimized
          />
        ) : (
          <div className="text-center">
            <p className="font-display text-2xl text-text">
              {merchant.merchantName}
            </p>
          </div>
        )}
      </div>
      <div className="px-4 py-3 border-t border-border">
        <p className="font-medium text-sm text-text truncate">
          {merchant.merchantName}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-xs text-muted truncate">
            {commission ?? "Live"}
          </p>
          {productCount ? (
            <p className="text-[11px] text-muted shrink-0">
              {formatCount(productCount)} pieces
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function formatCommissionRange(
  min: number | null,
  max: number | null,
): string | null {
  if (min === null && max === null) return null;
  if (min === max && min !== null) return `${min}% commission`;
  if (min !== null && max !== null) return `${min}–${max}% commission`;
  return `${max ?? min}% commission`;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}
