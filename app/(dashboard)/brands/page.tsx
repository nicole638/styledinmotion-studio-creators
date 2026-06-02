import { Store } from "lucide-react";
import { fetchMerchants } from "@/lib/brands/queries";
import { BrandsGrid } from "./BrandsGrid";

export const metadata = { title: "Brands" };

type SearchParams = { q?: string };

/**
 * Brands index — every active merchant from `affiliate_merchants`. Mirrors
 * iOS Brands tab (grid of merchant cards, tap → /brands/{id} drilldown).
 * Search is server-rendered via ?q= so the URL is shareable and back-
 * navigation keeps state.
 */
export default async function BrandsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const search = (searchParams.q ?? "").trim();
  const merchants = await fetchMerchants({ search: search || undefined });

  return (
    <div className="max-w-6xl">
      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Brands
      </p>
      <h1 className="font-display text-4xl">Browse brands.</h1>
      <p className="mt-3 text-muted leading-relaxed max-w-prose">
        Every brand we&apos;ve partnered with. Tap a brand to browse its
        catalog, then add pieces straight to your closet — affiliate
        links and tracking are wired automatically.
      </p>

      <div className="mt-10 editorial-divider" />

      <div className="mt-8">
        <BrandsGrid initialSearch={search} merchants={merchants} />
      </div>

      {merchants.length === 0 ? (
        <EmptyState search={search} />
      ) : null}
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="mt-16 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-card border border-border">
        <Store size={20} className="text-muted" strokeWidth={1.5} />
      </div>
      <p className="mt-4 text-sm text-muted">
        {search
          ? `No brands match "${search}".`
          : "No brands are active yet. Check back soon."}
      </p>
    </div>
  );
}
