"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchBrandProductById } from "./queries";
import type { AddBrandProductResult } from "@/types/brands";

/**
 * Map the matview's `department` taxonomy onto the closet's `category`
 * controlled vocabulary. The closet edit form uses a narrower set than
 * the catalog: { Top, Pants, Dress, Shoes, Bag, Jewelry, Accessory,
 * Outerwear, Other }. Anything that doesn't map cleanly drops to "Other"
 * — the creator can re-categorize from the edit form.
 *
 * Two-step on purpose: catalogs use richer departments (Activewear,
 * Beauty, Lingerie, Sunglasses, Watches), the closet doesn't need that
 * granularity for collage filtering, which is what category actually
 * gates today.
 */
function departmentToCategory(department: string | null): string | null {
  if (!department) return null;
  const d = department.toLowerCase();
  if (d === "clothing") return "Top"; // safest default for ambiguous
  if (d === "outerwear") return "Outerwear";
  if (d === "activewear") return "Top";
  if (d === "bags") return "Bag";
  if (d === "shoes") return "Shoes";
  if (d === "jewelry" || d === "watches") return "Jewelry";
  if (d === "accessories" || d === "sunglasses") return "Accessory";
  if (d === "lingerie") return "Top";
  if (d === "beauty") return "Other";
  return "Other";
}

/**
 * Format the matview's numeric price + currency into the text shape the
 * closet stores (`creator_items.price` is text — kept that way so brands
 * can deliver "From $89" / "€59,90" / "Sold out" without us parsing).
 */
function formatPrice(price: number | null, currency: string | null): string | null {
  if (price === null || price === undefined) return null;
  const cur = currency ?? "USD";
  // Common currency symbols inline; everything else gets ISO-3 prefix.
  const symbol: Record<string, string> = {
    USD: "$",
    CAD: "$",
    GBP: "£",
    EUR: "€",
    AUD: "$",
  };
  const sigil = symbol[cur] ?? `${cur} `;
  // Trim trailing .00 for cleaner display; keep cents when present.
  const formatted =
    price % 1 === 0 ? String(price.toFixed(0)) : String(price.toFixed(2));
  return `${sigil}${formatted}`;
}

/**
 * Add a brand-catalog product to the signed-in creator's closet.
 *
 * Idempotent: if the creator already has a closet item pointing at the
 * same `product_url`, returns the existing itemId with `alreadyAdded: true`
 * instead of inserting a duplicate. The pill morph on the catalog card
 * uses this to flip straight to "Added" on second-tap.
 *
 * Side effect: fire-and-forget Photoroom cutout via the `cutout-item-photo`
 * Edge Function. Same pattern as the paste-URL Add flow — Realtime on
 * `creator_items` updates the closet card when Photoroom completes.
 *
 * What we DON'T fire here: `scrape-product`. The matview already gave us
 * name + brand + price + the full `image_urls` array from the merchant's
 * own product feed, which is higher-fidelity than the scraper would
 * produce. Saving that round-trip keeps the Add UX snappy.
 */
export async function addBrandProductToClosetAction(
  productId: string,
): Promise<AddBrandProductResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const product = await fetchBrandProductById(productId);
  if (!product) {
    return { ok: false, error: "Product not found in catalog." };
  }

  // Pick the URL we'll write to creator_items.url. For Rakuten + CJ the
  // `product_url` and `deep_link` collapse to the same wrapped click URL;
  // for Awin they're two different wrappers. Either way, the wrapped URL
  // is what the shopper-side /api/shop redirect resolves at click time,
  // so storing it directly is correct. We deliberately don't try to
  // un-wrap to a "raw" merchant URL — that's a per-network exercise that
  // the iOS RPC handles differently and would be out of scope here.
  const url = product.productUrl || product.deepLink;
  if (!url) {
    return { ok: false, error: "Catalog row is missing a usable URL." };
  }

  // Idempotency check — same creator + same URL ⇒ return the existing row.
  const { data: existing } = await supabase
    .from("creator_items")
    .select("id")
    .eq("creator_id", user.id)
    .eq("url", url)
    .eq("archived", false)
    .maybeSingle();
  if (existing?.id) {
    return { ok: true, itemId: existing.id as string, alreadyAdded: true };
  }

  const photo = product.primaryImageUrl;

  const { data: inserted, error } = await supabase
    .from("creator_items")
    .insert({
      creator_id: user.id,
      name: product.name?.trim() || "Untitled piece",
      brand: product.brand?.trim() || null,
      category: departmentToCategory(product.department),
      price: formatPrice(product.price, product.currency),
      url,
      affiliate_url: product.deepLink ?? null,
      affiliate_provider: product.network,
      affiliate_wrapped_at: new Date().toISOString(),
      photo_url: photo,
      original_photo_url: photo,
      candidate_photo_urls: product.imageUrls.filter(
        (u) => typeof u === "string" && u.trim().length > 0,
      ),
      archived: false,
      // Skip the scrape-product trigger — feed data is the source of
      // truth here, no need to re-scrape and risk overwriting it with
      // a worse OG-tag result.
      fetch_status: "complete",
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  // Fire-and-forget cutout. Required for the item to be selectable in
  // /collage (the collage editor filters cutout_photo_url IS NOT NULL).
  if (photo) {
    void triggerItemCutout(inserted.id as string);
  }

  // Revalidate the closet so the new card appears on the next /closet
  // visit. The catalog page itself is intentionally NOT revalidated —
  // the pill morph is driven by the action's return value, not a
  // re-render of the catalog row.
  revalidatePath("/closet");

  return { ok: true, itemId: inserted.id as string };
}

/**
 * Service-role invoke of the cutout EF — same pattern as the paste-URL
 * Add flow (lib/closet/mutations.ts). We use the admin client so we
 * don't have to attach the user's JWT, and we don't await long enough
 * to block the Add response. Realtime handles the UI refresh once
 * Photoroom returns.
 */
async function triggerItemCutout(itemId: string): Promise<void> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    await admin.functions
      .invoke("cutout-item-photo", { body: { item_id: itemId } })
      .catch((e) => {
        console.warn("[brands] cutout invoke failed:", e);
      });
  } catch (e) {
    console.warn("[brands] cutout trigger failed:", e);
  }
}
