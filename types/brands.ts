/**
 * Shapes for the /brands surface. Mirrors the unified `affiliate_merchants`
 * view + `affiliate_products` materialized view that iOS's Brands tab also
 * reads from — keeping this naming aligned with the DB columns + the iOS
 * types so we can grep across the codebases.
 */

export type AffiliateNetwork = "awin" | "rakuten" | "cj";

/**
 * Active promo/coupon badge for a brand card, aggregated from awin_offers
 * (auto-synced) + brand_offers (Rakuten/CJ/direct, from the daily email task).
 */
export interface MerchantPromo {
  /** Coupon/voucher code to surface, if the top active offer has one. */
  code: string | null;
  /** Short badge label, e.g. "USE YOUGET20" or "2 deals". */
  label: string;
  /** Number of active offers for this merchant. */
  count: number;
}

export interface Merchant {
  id: string;
  network: AffiliateNetwork;
  networkMid: string | null;
  merchantName: string;
  domain: string | null;
  logoUrl: string | null;
  description: string | null;
  commissionMin: number | null;
  commissionMax: number | null;
  cookieLength: number | null;
  primarySector: string | null;
  countryCode: string | null;
  /** Cached product-feed count from the last sync — surfaces "X items" on the brand card. */
  feedLastProductCount: number | null;
  feedLastSyncedAt: string | null;
  /** Active promo/coupon badge (null when the brand has no live offer). */
  promo?: MerchantPromo | null;
}

/**
 * One product row from `affiliate_products`. We expose only the fields the
 * brand-catalog UI + Add-to-closet action actually consume. `deepLink` is the
 * pre-wrapped click URL we'll store on `creator_items.affiliate_url`. For
 * Rakuten the wrapped + raw URL collapse to the same linksynergy click; for
 * Awin the deep link is the awin1.com `pclick.php` form. Either way it's the
 * "send the shopper here" URL.
 */
export interface BrandProduct {
  id: string;
  network: AffiliateNetwork;
  merchantId: string;
  name: string;
  brand: string | null;
  department: string | null;
  category: string | null;
  price: number | null;
  currency: string | null;
  inStock: boolean | null;
  productUrl: string | null;
  deepLink: string | null;
  imageUrls: string[];
  primaryImageUrl: string | null;
}

/**
 * Department taxonomy that the matview's `department` column rolls up to.
 * Matches the iOS chip set so the look/feel is shared.
 */
export const BRAND_DEPARTMENTS = [
  "Clothing",
  "Outerwear",
  "Activewear",
  "Bags",
  "Shoes",
  "Jewelry",
  "Accessories",
  "Beauty",
  "Lingerie",
  "Sunglasses",
  "Watches",
  "Other",
] as const;

export type BrandDepartment = (typeof BRAND_DEPARTMENTS)[number];

/**
 * Server-action result for adding a brand-catalog product to the creator's
 * closet. `itemId` returned on success so the client can optimistically
 * link to /closet/{id} if it wants.
 */
export interface AddBrandProductResult {
  ok: boolean;
  itemId?: string;
  error?: string;
  /** True when the creator already has this product in their closet — the
   *  action is idempotent: a second tap returns the existing itemId rather
   *  than inserting a duplicate. UI uses this to morph straight to "Added". */
  alreadyAdded?: boolean;
}
