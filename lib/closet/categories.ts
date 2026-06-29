/**
 * Single source of truth for closet category chips (web).
 *
 * `value` is the stored `creator_items.category` string; `label` is what the
 * creator sees. They differ for the combined Dresses & Skirts bucket: skirts
 * are folded into the `Dress` value (no separate Skirt category in the DB), so
 * the chip shows "Dresses & Skirts" but filters/sets `category = 'Dress'`.
 *
 * Keep in sync with the DB classifier `set_default_item_category()` and the iOS
 * picker. Order here drives chip order in the toolbar + collage pickers.
 */
export interface ClosetCategory {
  label: string;
  value: string;
}

export const CLOSET_CATEGORIES: ClosetCategory[] = [
  { label: "Top", value: "Top" },
  { label: "Pants", value: "Pants" },
  { label: "Dresses & Skirts", value: "Dress" },
  { label: "Outerwear", value: "Outerwear" },
  { label: "Shoes", value: "Shoes" },
  { label: "Bag", value: "Bag" },
  { label: "Accessory", value: "Accessory" },
  { label: "Jewelry", value: "Jewelry" },
  { label: "Intimates", value: "Intimates" },
  { label: "Swimwear", value: "Swimwear" },
  { label: "Other", value: "Other" },
];

/** Display label for a stored category value (falls back to the raw value). */
export function closetCategoryLabel(value?: string | null): string {
  if (!value) return "";
  return CLOSET_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
