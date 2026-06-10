"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
  // Track whether the <Image> failed so we can fall back to the gradient
  // initial when the upstream logo URL 404s (Awin merchant deletions, dead
  // favicons, etc.). Logo-less brands skip the <Image> entirely and render
  // the fallback on first paint.
  const [logoFailed, setLogoFailed] = useState(false);
  const showFallback = !merchant.logoUrl || logoFailed;

  return (
    <Link
      href={`/brands/${merchant.id}`}
      className="group block rounded-2xl border border-border bg-card hover:border-rose transition-colors overflow-hidden"
    >
      <div className="aspect-square flex items-center justify-center p-6 relative">
        {showFallback ? (
          <BrandFallback name={merchant.merchantName} />
        ) : (
          <>
            {/* Subtle gradient backdrop so favicons/wordmarks sit on a
                consistent surface instead of stark white. */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background: gradientForName(merchant.merchantName).bg,
                opacity: 0.18,
              }}
            />
            <Image
              src={merchant.logoUrl!}
              alt={merchant.merchantName}
              width={180}
              height={180}
              className="relative max-w-full max-h-full object-contain"
              unoptimized
              onError={() => setLogoFailed(true)}
            />
          </>
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

/**
 * Deterministic gradient + display-font initial fallback. Used when a
 * brand has no logo_url (the source table is sparse for newly-onboarded
 * CJ merchants where neither Awin's hosted logos nor a manual upload
 * exists) OR when the logo URL fails to load at runtime.
 *
 * The gradient is picked deterministically from the brand name hash so
 * the same brand always gets the same color — visual continuity across
 * sessions/devices.
 */
function BrandFallback({ name }: { name: string }) {
  const { bg, fg } = useMemo(() => gradientForName(name), [name]);
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: bg }}
    >
      <span
        className="font-display text-7xl leading-none"
        style={{ color: fg }}
      >
        {initial}
      </span>
    </div>
  );
}

// Seven complementary gradient pairs in the SiM rose/cream palette range.
// Foreground (fg) is the initial color — high contrast against bg.
const GRADIENTS: Array<{ bg: string; fg: string }> = [
  { bg: "linear-gradient(135deg, #fde8e8 0%, #f5b7b1 100%)", fg: "#7a2a3a" },
  { bg: "linear-gradient(135deg, #fef3c7 0%, #fbbf77 100%)", fg: "#7c4a14" },
  { bg: "linear-gradient(135deg, #e0e7ff 0%, #a5b4fc 100%)", fg: "#312e81" },
  { bg: "linear-gradient(135deg, #ecfdf5 0%, #6ee7b7 100%)", fg: "#065f46" },
  { bg: "linear-gradient(135deg, #fdf2f8 0%, #f9a8d4 100%)", fg: "#831843" },
  { bg: "linear-gradient(135deg, #f5f5f4 0%, #d6d3d1 100%)", fg: "#44403c" },
  { bg: "linear-gradient(135deg, #ede9fe 0%, #c4b5fd 100%)", fg: "#4c1d95" },
];

function gradientForName(name: string): { bg: string; fg: string } {
  // djb2-style hash — fast, stable, no deps. Just need stable bucketing.
  let h = 5381;
  const s = name ?? "";
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  const idx = Math.abs(h) % GRADIENTS.length;
  return GRADIENTS[idx];
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
