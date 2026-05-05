/**
 * Closet item shape served to the creator web UI. Mirrors the mobile
 * app's ClothingItem (mobile/src/lib/state/lookStore.ts) but trimmed
 * to the columns the web v1 actually surfaces.
 *
 * Photo priority for display: cutout_photo_url > photo_url > original_photo_url.
 */
export type Category =
  | "Top"
  | "Pants"
  | "Dress"
  | "Shoes"
  | "Bag"
  | "Jewelry"
  | "Accessory"
  | "Outerwear"
  | "Other";

export interface ClosetItem {
  id: string;
  name: string | null;
  brand: string | null;
  category: Category | null;
  price: string | null; // numeric-as-string from Postgres; format on render
  url: string | null;
  affiliateUrl: string | null;
  photoUrl: string | null; // resolved (cutout > photo > original)
  archived: boolean;
  defaultWornSize: string | null;
  createdAt: string;
}

/** Raw Supabase row shape (snake_case). Internal — don't export from app code. */
export interface ClosetItemRow {
  id: string;
  name: string | null;
  brand: string | null;
  category: string | null;
  price: string | null;
  url: string | null;
  affiliate_url: string | null;
  photo_url: string | null;
  cutout_photo_url: string | null;
  original_photo_url: string | null;
  archived: boolean;
  default_worn_size: string | null;
  created_at: string;
}

export function rowToClosetItem(row: ClosetItemRow): ClosetItem {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    category: (row.category as Category | null) ?? null,
    price: row.price,
    url: row.url,
    affiliateUrl: row.affiliate_url,
    photoUrl:
      row.cutout_photo_url || row.photo_url || row.original_photo_url || null,
    archived: row.archived,
    defaultWornSize: row.default_worn_size,
    createdAt: row.created_at,
  };
}

export function formatPrice(raw: string | null): string {
  if (!raw) return "—";
  const n = Number.parseFloat(raw);
  if (Number.isNaN(n)) return "—";
  return n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`;
}
