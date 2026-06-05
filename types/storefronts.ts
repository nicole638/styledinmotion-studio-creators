// Brand storefronts + memberships — row shapes + camelCase domain types.
// Mirrors the schema applied 2026-06-05 (see Supabase migrations
// 20260605210000_brand_storefronts_memberships.sql and 210500/211000/220000).

export type BrandRole = "owner" | "stylist" | "analyst";
export type BrandStatus = "active" | "paused" | "archived";
export type MembershipStatus = "active" | "paused" | "revoked";
export type FulfillmentChannel = "etsy" | "ebay" | "shopify";

// brand_storefronts.fulfillment jsonb shape.
export interface FulfillmentEntry {
  channel: FulfillmentChannel | string; // free-form for future channels
  url: string;
}

// snake_case row exactly as Postgres returns.
export interface BrandStorefrontRow {
  id: string;
  storefront_creator_id: string;
  name: string;
  slug: string;
  brand_story: string | null;
  logo_url: string | null;
  commission_pct: number | string; // numeric — Postgres returns string for safety
  promo_code: string | null;
  fulfillment: FulfillmentEntry[] | null;
  contact_email: string | null;
  status: BrandStatus;
  is_test: boolean;
  created_at: string;
  updated_at: string;
}

// camelCase view consumed by components.
export interface BrandStorefront {
  id: string;
  storefrontCreatorId: string;
  name: string;
  slug: string;
  brandStory: string | null;
  logoUrl: string | null;
  commissionPct: number;
  promoCode: string | null;
  fulfillment: FulfillmentEntry[];
  contactEmail: string | null;
  status: BrandStatus;
  isTest: boolean;
  createdAt: string;
  updatedAt: string;
}

export function rowToBrandStorefront(row: BrandStorefrontRow): BrandStorefront {
  // commission_pct comes back as a string from numeric columns. Coerce safely.
  const pct =
    typeof row.commission_pct === "string"
      ? parseFloat(row.commission_pct)
      : row.commission_pct;
  return {
    id: row.id,
    storefrontCreatorId: row.storefront_creator_id,
    name: row.name,
    slug: row.slug,
    brandStory: row.brand_story,
    logoUrl: row.logo_url,
    commissionPct: isFinite(pct) ? pct : 15,
    promoCode: row.promo_code,
    fulfillment: Array.isArray(row.fulfillment) ? row.fulfillment : [],
    contactEmail: row.contact_email,
    status: row.status,
    isTest: row.is_test ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// brand_memberships row + a joined view that carries the human's basic identity
// (used for the memberships table on the detail page).
export interface BrandMembershipRow {
  id: string;
  creator_id: string;
  brand_id: string;
  role: BrandRole;
  status: MembershipStatus;
  assigned_by: string | null;
  assigned_at: string;
}

export interface MembershipWithMember {
  id: string;
  creatorId: string;
  brandId: string;
  role: BrandRole;
  status: MembershipStatus;
  assignedBy: string | null;
  assignedAt: string;
  // Joined fields from creator_profiles / creators / auth — populated by
  // listMembershipsForBrand.
  memberName: string | null;
  memberEmail: string | null;
  memberUsername: string | null;
  memberPhotoUrl: string | null;
}

// Per-storefront summary cell on the list view.
export interface StorefrontWithMemberCount extends BrandStorefront {
  memberCount: number;
}
