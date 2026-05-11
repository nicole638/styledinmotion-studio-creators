import Link from "next/link";
import { Sparkles, Clock, Plus } from "lucide-react";
import { listActiveCampaignsForCreator } from "@/lib/campaigns/queries";
import {
  fetchAmazonProductsForAsins,
  type AmazonProduct,
} from "@/lib/amazon/products";
import {
  CAMPAIGN_TYPE_LABEL,
  type Campaign,
} from "@/types/campaigns";

/** Max ASINs shown inline before we collapse behind a "View all" link. */
const ASINS_PREVIEW = 6;
/**
 * Resolve the share URL for an ASIN inside a campaign. Prefers the
 * campaign-specific URL (campaignId + linkId + tag baked in — required
 * for Amazon Creator Connections attribution) and falls back to the bare
 * canonical URL when the admin hasn't pasted per-ASIN URLs yet.
 */
const urlForCampaignAsin = (campaign: Campaign, asin: string): string =>
  campaign.asinLinks?.[asin] ?? `https://www.amazon.com/dp/${asin}`;

/**
 * Active brand campaigns surfaced on the creator dashboard. Highest
 * commission rate first, with end-date urgency. Empty state intentionally
 * hidden — if no active campaigns, the widget renders nothing rather than
 * a placeholder, so dashboards stay clean during quiet weeks.
 */
// Display cap on the dashboard widget. Holds enough campaigns that
// admins don't silently hide ones they just added, but stops short of
// flooding the page when the roster grows. Raise if the active count
// regularly exceeds this — the layout flows fine vertically.
const MAX_CAMPAIGNS_ON_DASHBOARD = 20;

export async function ActiveCampaignsWidget() {
  const campaigns = await listActiveCampaignsForCreator(
    MAX_CAMPAIGNS_ON_DASHBOARD,
  );
  if (campaigns.length === 0) return null;

  // One enrichment pass for ALL ASINs across all visible campaigns. The
  // helper dedupes and fires PA-API for misses in the background — we
  // render with whatever's already cached on this pass.
  const allAsins = Array.from(
    new Set(campaigns.flatMap((c) => c.asins.slice(0, ASINS_PREVIEW))),
  );
  const products = await fetchAmazonProductsForAsins(allAsins);

  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-rose">
            Brand campaigns this week
          </p>
          <h2 className="font-display text-2xl mt-1">
            Earn bonus commission on these.
          </h2>
        </div>
        <p className="text-xs text-muted leading-relaxed max-w-xs">
          Feature any of these products in a look. We've opted in on the
          platform's behalf — the bonus commission applies automatically.
        </p>
      </div>

      {/* Horizontal-scroll shelf so the dashboard's content underneath
          (closet snapshot, recent looks, etc.) stays close to the fold
          even when the active-campaign roster grows past 4-5. Each
          card is fixed-width so they don't squish; the row scrolls
          left-right. -mx + px pattern lets the cards bleed to the
          viewport edge while keeping the section heading aligned with
          the dashboard's content column.

          Mobile and desktop both get the same shelf — on wide
          screens you can typically see 3 cards at once; on smaller
          viewports, 1-2 cards visible, swipe for the rest. */}
      <div className="-mx-4 px-4 md:-mx-6 md:px-6">
        <div className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2">
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="snap-start shrink-0 w-[min(85vw,22rem)]"
            >
              <CampaignCard campaign={c} products={products} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CampaignCard({
  campaign,
  products,
}: {
  campaign: Campaign;
  products: Map<string, AmazonProduct>;
}) {
  const daysLeft = daysUntil(campaign.endDate);
  const urgent = daysLeft !== null && daysLeft <= 7;
  // Truncated preview list — large campaigns can have 50+ ASINs and a wall of
  // them buries the rest of the dashboard. Show the first 6 inline; the rest
  // collapse behind a "View all N" link.
  const asinsPreview = campaign.asins.slice(0, ASINS_PREVIEW);
  const remaining = campaign.asins.length - asinsPreview.length;

  return (
    <div className="block rounded-2xl border border-border bg-card p-4 hover:border-rose transition-colors">
      <div className="flex items-start gap-3">
        <BrandMark
          name={campaign.brandName}
          logoUrl={campaign.brandLogoUrl}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="font-display text-lg leading-tight truncate">
              {campaign.brandName}
            </h3>
            <span className="text-[10px] uppercase tracking-widest text-muted shrink-0">
              {CAMPAIGN_TYPE_LABEL[campaign.campaignType]}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-3 flex-wrap text-xs">
            <span className="inline-flex items-center gap-1 text-rose font-medium">
              <Sparkles size={12} strokeWidth={2.25} />
              +{campaign.commissionRatePct}% bonus
            </span>
            <span className="text-muted">
              {campaign.asins.length} product
              {campaign.asins.length === 1 ? "" : "s"}
            </span>
            <span
              className={`inline-flex items-center gap-1 ${
                urgent ? "text-[#B53D2A] font-medium" : "text-muted"
              }`}
            >
              <Clock size={12} strokeWidth={2.25} />
              {daysLeft === null
                ? `Ends ${campaign.endDate}`
                : daysLeft === 0
                  ? "Ends today"
                  : daysLeft === 1
                    ? "Ends tomorrow"
                    : `${daysLeft} days left`}
            </span>
          </div>

          {campaign.notes ? (
            <p className="mt-2 text-xs text-muted leading-relaxed line-clamp-2">
              {campaign.notes}
            </p>
          ) : null}
        </div>
      </div>

      {/* Featured products — direct path from "see campaign" to "tag the
          item." Each row prefills the Add Item URL field so the creator
          doesn't have to copy/paste anything; scrape kicks in automatically.
          Enriched via PA-API: shows real title + thumbnail when cached,
          falls back to ASIN code while enrichment is pending. */}
      {campaign.asins.length > 0 ? (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[10px] uppercase tracking-widest text-muted mb-2">
            Featured products
          </p>
          <ul className="space-y-1.5">
            {asinsPreview.map((asin) => (
              <li key={asin}>
                <ProductRow
                  asin={asin}
                  product={products.get(asin)}
                  campaign={campaign}
                />
              </li>
            ))}
          </ul>
          {remaining > 0 ? (
            <p className="mt-2 text-[11px] text-muted">
              + {remaining} more product{remaining === 1 ? "" : "s"} in this
              campaign — see the brand brief for the full list.
            </p>
          ) : null}
        </div>
      ) : null}

      {campaign.campaignUrl ? (
        <div className="mt-3 pt-3 border-t border-border">
          <Link
            href={campaign.campaignUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-rose hover:underline"
          >
            View brand brief →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Single product row inside a campaign card. Three render states:
 *
 *   1. Enriched (`product.title + product.imageUrl`) — show thumbnail + title.
 *   2. Pending (no row in cache, or fetch_status='pending') — show ASIN code
 *      with a small "loading" treatment. PA-API takes a few seconds; the
 *      next render will show the enriched data.
 *   3. Failed or no-data — show ASIN code (same as pending visually). Don't
 *      surface the error to creators; they can still click through to add it.
 *
 * Tap target navigates to /closet/new with the URL pre-populated, regardless
 * of enrichment state.
 */
function ProductRow({
  asin,
  product,
  campaign,
}: {
  asin: string;
  product: AmazonProduct | undefined;
  campaign: Campaign;
}) {
  const enriched = product?.fetchStatus === "complete" && product.title;
  // ?campaignAsin=<asin> tells /closet/new to:
  //   1. Look up the campaign + per-ASIN share URL server-side
  //   2. Read the cached Microlink title + image
  //   3. Land the creator directly on the editable review form with
  //      everything pre-filled — no scrape, no Fetch button, no waiting.
  // The bare ?prefill=<url> path is still supported for non-campaign Adds.
  const href = `/closet/new?campaignAsin=${asin}`;
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-bg transition-colors"
      title={`Add ${product?.title ?? asin} to your closet`}
    >
      {/* Thumbnail or ASIN-code fallback. Amazon images are fetched from m.media-amazon.com.
          We use unoptimized so Next doesn't proxy through its image optimizer
          (Amazon CDN is already fast and we don't want to consume Vercel image bandwidth). */}
      {enriched && product?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt={product.title ?? ""}
          className="w-12 h-12 rounded-md bg-bg object-contain p-0.5 shrink-0 border border-border"
        />
      ) : (
        <div className="w-12 h-12 rounded-md bg-bg border border-border grid place-items-center shrink-0">
          <span className="font-mono text-[9px] text-muted">{asin.slice(-4)}</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        {enriched ? (
          <p className="text-xs text-text leading-tight line-clamp-2">
            {product!.title}
          </p>
        ) : (
          <p className="font-mono text-[11px] text-muted truncate">{asin}</p>
        )}
      </div>
      <span className="inline-flex items-center gap-1 text-xs text-rose font-medium shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
        <Plus size={11} strokeWidth={2.5} />
        Add
      </span>
    </Link>
  );
}

function BrandMark({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string | null;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className="w-12 h-12 rounded-xl object-cover bg-bg shrink-0"
      />
    );
  }
  return (
    <div className="w-12 h-12 rounded-xl bg-bg border border-border grid place-items-center shrink-0">
      <span className="font-display text-lg text-rose">
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

function daysUntil(isoDate: string): number | null {
  try {
    const end = new Date(`${isoDate}T23:59:59`);
    const now = new Date();
    const ms = end.getTime() - now.getTime();
    if (ms < 0) return null;
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}
