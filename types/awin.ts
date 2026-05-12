/**
 * Awin partnered merchants.
 *
 * One row per merchant we've been approved for. Drives /api/shop URL
 * recognition (backend wraps recognized merchant URLs into Awin tracked
 * links with clickref=<creator slug>) and the closet Add auto-wrap hint
 * surfaced to creators on paste.
 */
export type AwinMerchantStatus = "active" | "paused" | "pending" | "terminated";

export const AWIN_STATUS_LABEL: Record<AwinMerchantStatus, string> = {
  active: "Active",
  paused: "Paused",
  pending: "Pending approval",
  terminated: "Terminated",
};

export interface AwinMerchant {
  id: string;
  awinmid: string;
  merchantName: string;
  domain: string;
  altDomains: string[];
  commissionMin: number | null;
  commissionMax: number | null;
  cookieLength: number | null;
  awinIndex: number | null;
  status: AwinMerchantStatus;
  awinJoinUrl: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

/** Raw row shape returned by Supabase. */
export interface AwinMerchantRow {
  id: string;
  awinmid: string;
  merchant_name: string;
  domain: string;
  alt_domains: string[];
  commission_min: number | string | null;
  commission_max: number | string | null;
  cookie_length: number | null;
  awin_index: number | null;
  status: AwinMerchantStatus;
  awin_join_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export function rowToAwinMerchant(r: AwinMerchantRow): AwinMerchant {
  return {
    id: r.id,
    awinmid: r.awinmid,
    merchantName: r.merchant_name,
    domain: r.domain,
    altDomains: r.alt_domains ?? [],
    commissionMin: r.commission_min === null ? null : Number(r.commission_min),
    commissionMax: r.commission_max === null ? null : Number(r.commission_max),
    cookieLength: r.cookie_length,
    awinIndex: r.awin_index,
    status: r.status,
    awinJoinUrl: r.awin_join_url,
    notes: r.notes,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    archivedAt: r.archived_at,
  };
}

/**
 * Normalize a hostname to the form we store in `domain`:
 *   - lowercased
 *   - leading "www." stripped
 *   - port stripped (Awin merchants never run on non-default ports)
 *
 * Returns null if the input doesn't parse as a URL OR a bare hostname.
 */
export function normalizeMerchantDomain(input: string): string | null {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return null;
  // Try URL parse first
  let host: string;
  try {
    const u = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    host = u.hostname;
  } catch {
    return null;
  }
  host = host.toLowerCase().replace(/^www\./, "");
  // Empty or pseudo-domain check (no dot ⇒ not a real registered domain)
  if (!host.includes(".")) return null;
  return host;
}
