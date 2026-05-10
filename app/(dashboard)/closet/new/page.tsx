import Link from "next/link";
import { ChevronLeft, Sparkles } from "lucide-react";
import { AddItemForm } from "./AddItemForm";
import { findActiveCampaignForAsin } from "@/lib/campaigns/queries";
import { fetchAmazonProductBlocking } from "@/lib/amazon/products";
import { extractAsin } from "@/lib/closet/asin";
import type { AddItemDraft } from "@/lib/closet/mutations";

export const metadata = { title: "Add piece" };

type PageProps = {
  searchParams: {
    // ?prefill=<encoded-url> — legacy; URL prefilled into the URL stage.
    prefill?: string;
    // ?campaignAsin=<asin> — campaign-tile shortcut. We resolve the
    // campaign + cached product info server-side and drop the user
    // straight into the editable review form with everything pre-filled.
    campaignAsin?: string;
  };
};

export default async function NewClosetItemPage({ searchParams }: PageProps) {
  const prefill = searchParams.prefill?.trim() ?? "";
  const campaignAsinParam = searchParams.campaignAsin?.trim().toUpperCase() ?? "";

  // ── Campaign tile shortcut ────────────────────────────────────────────
  // When the creator taps a Featured Product on the dashboard widget, we
  // resolve everything server-side so the page lands with a fully-filled
  // review form. No URL stage, no Fetch button, no waiting on a scraper
  // that may or may not work — the Microlink-backed cache already has
  // the title + image for campaign ASINs (see fetchAmazonProductBlocking).
  let initialDraft: AddItemDraft | undefined;
  let usedCampaignShortcut = false;
  let campaignBrandName: string | null = null;

  if (campaignAsinParam && /^B[0-9A-Z]{9}$/.test(campaignAsinParam)) {
    const campaign = await findActiveCampaignForAsin(campaignAsinParam);
    if (campaign) {
      const product = await fetchAmazonProductBlocking(campaignAsinParam);
      const campaignUrl =
        campaign.asinLinks?.[campaignAsinParam] ??
        `https://www.amazon.com/dp/${campaignAsinParam}`;
      initialDraft = {
        name: product?.title ?? "",
        brand: campaign.brandName ?? "",
        price: "",
        category: "",
        url: campaignUrl,
        defaultWornSize: "",
        photoUrl: product?.imageUrl ?? "",
        originalPhotoUrl: product?.imageUrl ?? "",
      };
      usedCampaignShortcut = true;
      campaignBrandName = campaign.brandName;
    }
  }

  // Fallback: if creator pasted/clicked a URL with an extractable ASIN
  // that we happen to have in cache, also pre-fill from cache. Saves them
  // the Fetch click + handles Amazon's flaky scrape responses gracefully.
  if (!initialDraft && prefill) {
    const asin = extractAsin(prefill);
    if (asin) {
      const product = await fetchAmazonProductBlocking(asin);
      if (product && (product.title || product.imageUrl)) {
        initialDraft = {
          name: product.title ?? "",
          brand: "",
          price: "",
          category: "",
          url: prefill,
          defaultWornSize: "",
          photoUrl: product.imageUrl ?? "",
          originalPhotoUrl: product.imageUrl ?? "",
        };
      }
    }
  }

  return (
    <div className="max-w-3xl">
      <Link
        href="/closet"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-text mb-4"
      >
        <ChevronLeft size={14} strokeWidth={2} /> Closet
      </Link>

      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Add piece
      </p>
      <h1 className="font-display text-4xl">
        {usedCampaignShortcut ? "Tag this product." : "Drop in a URL."}
      </h1>
      <p className="mt-3 text-muted leading-relaxed max-w-prose">
        {usedCampaignShortcut && campaignBrandName ? (
          <>
            We pulled the photo and title from {campaignBrandName}'s campaign.
            Review the details below, then save — your closet item will use
            the campaign-tagged URL so commissions attribute correctly.
          </>
        ) : (
          <>
            Paste a product link from any retailer. We pull the photo,
            brand, and price for review — and for Amazon Creator Connections
            campaigns, the campaign-tagged URL auto-applies.
          </>
        )}
      </p>

      {usedCampaignShortcut ? (
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-rose/10 border border-rose/30 text-rose px-3 py-1 text-xs">
          <Sparkles size={12} strokeWidth={2.25} />
          Campaign auto-fill applied
        </div>
      ) : null}

      <div className="mt-10 editorial-divider" />

      <div className="mt-8">
        <AddItemForm initialUrl={prefill} initialDraft={initialDraft} />
      </div>
    </div>
  );
}
