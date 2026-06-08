/**
 * Look shape served to the creator web UI. Mirrors the mobile app's
 * Look type but trimmed to columns the web v1 surfaces.
 *
 * Status derivation:
 *   archived = true                     → "archived"
 *   archived = false, published_at NULL → "draft"
 *   archived = false, published_at SET  → "published"
 */
export type LookStatus = "published" | "draft" | "archived";

export interface Look {
  id: string;
  title: string;
  caption: string | null;
  coverPhotoUrl: string | null;
  shortCode: string;
  status: LookStatus;
  itemCount: number;
  clicks: number;
  /** Sum of `creator_share` across confirmed + paid commissions on this look.
   * Populated by fetchLooks via fetchEarningsByLookMap. Undefined when the
   * caller hasn't asked for earnings (keeps lighter fetches cheap). */
  earningsUsd?: number;
  /** Distinct commission count contributing to earningsUsd. */
  commissionCount?: number;
  createdAt: string;
  publishedAt: string | null;
  updatedAt: string | null;
}

/** Raw Supabase row shape (snake_case). Internal — don't export from app code. */
export interface LookRow {
  id: string;
  title: string;
  caption: string | null;
  cover_photo_url: string | null;
  short_code: string;
  archived: boolean;
  published_at: string | null;
  clicks: number | null;
  created_at: string;
  updated_at: string | null;
}

export function rowToLook(
  row: LookRow,
  itemCount: number,
): Look {
  return {
    id: row.id,
    title: row.title,
    caption: row.caption,
    coverPhotoUrl: row.cover_photo_url || null,
    shortCode: row.short_code,
    status: deriveStatus(row),
    itemCount,
    clicks: row.clicks ?? 0,
    createdAt: row.created_at,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

export function deriveStatus(row: {
  archived: boolean;
  published_at: string | null;
}): LookStatus {
  if (row.archived) return "archived";
  if (!row.published_at) return "draft";
  return "published";
}

export interface LookItem {
  id: string;
  lookId: string;
  creatorItemId: string;
  sortOrder: number;
  wornSize: string | null;
}

export interface LookItemRow {
  id: string;
  look_id: string;
  creator_item_id: string;
  sort_order: number;
  worn_size: string | null;
}

export function rowToLookItem(row: LookItemRow): LookItem {
  return {
    id: row.id,
    lookId: row.look_id,
    creatorItemId: row.creator_item_id,
    sortOrder: row.sort_order,
    wornSize: row.worn_size,
  };
}

export function formatLookDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}
