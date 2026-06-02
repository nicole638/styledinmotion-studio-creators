"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import {
  BRAND_DEPARTMENTS,
  type BrandDepartment,
  type BrandProduct,
} from "@/types/brands";
import { AddToClosetButton } from "./AddToClosetButton";

interface Props {
  merchantId: string;
  initialSearch: string;
  initialDepartment: BrandDepartment | "";
  initialPage: number;
  items: BrandProduct[];
  total: number;
  hasMore: boolean;
  pageSize: number;
  /** Set of product URLs the creator already has in their closet — used
   *  to seed each card's pill straight to "✓ Added" without a per-card
   *  round-trip. */
  addedUrls: string[];
}

/**
 * Search + department-chip toolbar + product grid for one brand. Mirrors
 * iOS Brands-tab catalog: search box, chip row, paginated grid below.
 *
 * State sync follows the same pattern as the brands index — URL is the
 * source of truth, the inputs debounce into a router.replace. Means the
 * back button and link-sharing both work.
 */
export function CatalogBrowser({
  merchantId,
  initialSearch,
  initialDepartment,
  initialPage,
  items,
  total,
  hasMore,
  pageSize,
  addedUrls,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);
  const [department, setDepartment] = useState<BrandDepartment | "">(
    initialDepartment,
  );

  const addedSet = useMemo(() => new Set(addedUrls), [addedUrls]);

  // Debounced URL sync for search. Department changes flush immediately
  // because chip taps are deliberate.
  useEffect(() => {
    if (search === initialSearch) return;
    const handle = setTimeout(() => {
      pushUrl({ search, department, page: 0 });
    }, 220);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function pushUrl(next: {
    search: string;
    department: BrandDepartment | "";
    page: number;
  }) {
    const params = new URLSearchParams();
    if (next.search.trim()) params.set("q", next.search.trim());
    if (next.department) params.set("dept", next.department);
    if (next.page > 0) params.set("page", String(next.page));
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `/brands/${merchantId}?${qs}` : `/brands/${merchantId}`);
    });
  }

  function onChipClick(dept: BrandDepartment | "") {
    setDepartment(dept);
    pushUrl({ search, department: dept, page: 0 });
  }

  function onPageChange(delta: number) {
    const next = Math.max(0, initialPage + delta);
    pushUrl({ search, department, page: next });
  }

  return (
    <>
      {/* Search box. */}
      <div className="relative mb-4 max-w-md">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search this brand…"
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-border bg-bg text-sm focus:outline-none focus:border-rose"
        />
        {search ? (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              pushUrl({ search: "", department, page: 0 });
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted hover:text-text"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      {/* Department chips — All + 12 fixed departments matching iOS. */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        <Chip
          label="All"
          active={department === ""}
          onClick={() => onChipClick("")}
        />
        {BRAND_DEPARTMENTS.map((dept) => (
          <Chip
            key={dept}
            label={dept}
            active={department === dept}
            onClick={() => onChipClick(dept)}
          />
        ))}
      </div>

      {/* Result count. */}
      <p className="text-xs text-muted mb-4">
        {total === 0
          ? "No matching pieces."
          : `${formatCount(total)} ${total === 1 ? "piece" : "pieces"}`}
      </p>

      {/* Product grid. */}
      {items.length > 0 ? (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((p) => (
            <li key={p.id}>
              <ProductCard
                product={p}
                alreadyAdded={!!p.productUrl && addedSet.has(p.productUrl)}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {/* Pagination. */}
      {total > pageSize ? (
        <div className="mt-8 flex items-center justify-between max-w-md mx-auto">
          <button
            type="button"
            onClick={() => onPageChange(-1)}
            disabled={initialPage === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-text disabled:text-muted disabled:cursor-not-allowed hover:bg-card"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <p className="text-xs text-muted">
            Page {initialPage + 1} of {Math.max(1, Math.ceil(total / pageSize))}
          </p>
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={!hasMore}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-text disabled:text-muted disabled:cursor-not-allowed hover:bg-card"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      ) : null}
    </>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        active
          ? "bg-rose text-white"
          : "bg-card border border-border text-text hover:border-rose"
      }`}
    >
      {label}
    </button>
  );
}

function ProductCard({
  product,
  alreadyAdded,
}: {
  product: BrandProduct;
  alreadyAdded: boolean;
}) {
  const photo = product.primaryImageUrl;
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col">
      <div className="aspect-square bg-bg relative">
        {photo ? (
          // Brand-feed CDNs are too many to enumerate in next.config — use
          // a vanilla img so we don't get tripped by Image's domain allowlist.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-contain p-2"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted">
            No photo
          </div>
        )}
      </div>
      <div className="px-3 py-3 flex-1 flex flex-col gap-2">
        <p
          className="text-sm text-text line-clamp-2 leading-snug"
          title={product.name}
        >
          {product.name}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2">
          <p className="text-xs text-muted shrink-0">
            {formatPrice(product.price, product.currency)}
          </p>
          <AddToClosetButton
            productId={product.id}
            initiallyAdded={alreadyAdded}
          />
        </div>
      </div>
    </div>
  );
}

function formatPrice(price: number | null, currency: string | null): string {
  if (price === null || price === undefined) return "";
  const cur = currency ?? "USD";
  const symbol: Record<string, string> = {
    USD: "$",
    CAD: "$",
    GBP: "£",
    EUR: "€",
    AUD: "$",
  };
  const sigil = symbol[cur] ?? `${cur} `;
  const formatted =
    price % 1 === 0 ? price.toFixed(0) : price.toFixed(2);
  return `${sigil}${formatted}`;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}
