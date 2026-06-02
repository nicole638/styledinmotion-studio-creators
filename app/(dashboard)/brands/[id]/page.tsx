import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import {
  fetchBrandProducts,
  fetchCreatorAddedUrls,
  fetchMerchant,
} from "@/lib/brands/queries";
import { createClient } from "@/lib/supabase/server";
import { BRAND_DEPARTMENTS, type BrandDepartment } from "@/types/brands";
import { CatalogBrowser } from "./CatalogBrowser";

export const metadata = { title: "Brand catalog" };

const PAGE_SIZE = 48;

type SearchParams = {
  q?: string;
  dept?: string;
  page?: string;
};

export default async function BrandCatalogPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: SearchParams;
}) {
  const search = (searchParams.q ?? "").trim();
  const departmentRaw = (searchParams.dept ?? "").trim();
  const department = (BRAND_DEPARTMENTS as readonly string[]).includes(
    departmentRaw,
  )
    ? (departmentRaw as BrandDepartment)
    : ("" as const);
  const page = Math.max(0, Number(searchParams.page ?? "0") || 0);

  const merchant = await fetchMerchant(params.id);
  if (!merchant) notFound();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { items, total, hasMore } = await fetchBrandProducts({
    merchantId: params.id,
    search: search || undefined,
    department: department || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  // Build the "already in your closet" set from the visible product URLs
  // only — narrower payload, fast lookup. Falls back to empty Set on any
  // RLS / schema quirk so the page still renders without an "Added" hint.
  const visibleUrls = items
    .map((p) => p.productUrl)
    .filter((u): u is string => !!u);
  const addedUrls = user
    ? await fetchCreatorAddedUrls(user.id, visibleUrls)
    : new Set<string>();

  const commission = formatCommissionRange(
    merchant.commissionMin,
    merchant.commissionMax,
  );

  return (
    <div className="max-w-6xl">
      {/* Back link — mirrors iOS nav-bar back chevron pattern. */}
      <Link
        href="/brands"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text mb-6"
      >
        <ArrowLeft size={14} /> All brands
      </Link>

      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        {merchant.network === "awin"
          ? "Awin partner"
          : merchant.network === "rakuten"
            ? "Rakuten partner"
            : "CJ partner"}
      </p>
      <h1 className="font-display text-4xl">{merchant.merchantName}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        {commission ? <span>{commission}</span> : null}
        {merchant.cookieLength ? (
          <span>{merchant.cookieLength}-day cookie</span>
        ) : null}
        {merchant.domain ? (
          <a
            href={`https://${merchant.domain.replace(/^https?:\/\//, "")}`}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-flex items-center gap-1 text-rose hover:underline"
          >
            {merchant.domain.replace(/^https?:\/\//, "")}
            <ExternalLink size={11} />
          </a>
        ) : null}
      </div>

      <div className="mt-10 editorial-divider" />

      <div className="mt-8">
        <CatalogBrowser
          merchantId={merchant.id}
          initialSearch={search}
          initialDepartment={department}
          initialPage={page}
          items={items}
          total={total}
          hasMore={hasMore}
          pageSize={PAGE_SIZE}
          addedUrls={Array.from(addedUrls)}
        />
      </div>
    </div>
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
