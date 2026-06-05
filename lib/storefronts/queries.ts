import { createAdminClient } from "@/lib/supabase/admin";
import {
  rowToBrandStorefront,
  type BrandStorefront,
  type BrandStorefrontRow,
  type MembershipWithMember,
  type StorefrontWithMemberCount,
} from "@/types/storefronts";

/**
 * Admin list — every storefront, ordered status-priority (active first, then
 * paused, archived) and most-recently-updated within each bucket. Includes
 * member count for the table cell so we don't N+1 against memberships.
 * Uses createAdminClient (service-role) because the route is already gated
 * by isAdmin() — same convention as listAwinMerchantsForAdmin.
 */
export async function listStorefrontsForAdmin(): Promise<
  StorefrontWithMemberCount[]
> {
  const supabase = createAdminClient();

  // 1. Pull storefronts.
  const { data: rows, error } = await supabase
    .from("brand_storefronts")
    .select("*")
    .order("status", { ascending: true })
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`listStorefrontsForAdmin: ${error.message}`);

  const storefronts = (rows as BrandStorefrontRow[]).map(rowToBrandStorefront);
  if (storefronts.length === 0) return [];

  // 2. Member count per storefront in a single GROUP BY pass. PostgREST
  // doesn't expose GROUP BY directly, so we pull all memberships and tally
  // client-side — fine at this scale (handful of brands × handful of
  // members each).
  const { data: memberRows, error: memErr } = await supabase
    .from("brand_memberships")
    .select("brand_id, status")
    .eq("status", "active");
  if (memErr) throw new Error(`listStorefrontsForAdmin/members: ${memErr.message}`);

  const counts = new Map<string, number>();
  for (const r of (memberRows ?? []) as Array<{ brand_id: string }>) {
    counts.set(r.brand_id, (counts.get(r.brand_id) ?? 0) + 1);
  }

  return storefronts.map((s) => ({
    ...s,
    memberCount: counts.get(s.id) ?? 0,
  }));
}

export async function getStorefrontById(id: string): Promise<BrandStorefront | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brand_storefronts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getStorefrontById: ${error.message}`);
  return data ? rowToBrandStorefront(data as BrandStorefrontRow) : null;
}

export async function getStorefrontBySlug(
  slug: string,
): Promise<BrandStorefront | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brand_storefronts")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`getStorefrontBySlug: ${error.message}`);
  return data ? rowToBrandStorefront(data as BrandStorefrontRow) : null;
}

/**
 * Memberships table — one row per (creator, brand) with the joined human
 * identity for display (name, email, username, avatar). Ordered owners first,
 * then stylists, then analysts; revoked rows sink to the bottom.
 */
export async function listMembershipsForBrand(
  brandId: string,
): Promise<MembershipWithMember[]> {
  const supabase = createAdminClient();

  const { data: memRows, error } = await supabase
    .from("brand_memberships")
    .select("*")
    .eq("brand_id", brandId)
    .order("status", { ascending: true })
    .order("role", { ascending: true })
    .order("assigned_at", { ascending: false });
  if (error) throw new Error(`listMembershipsForBrand: ${error.message}`);

  const rows = (memRows ?? []) as Array<{
    id: string;
    creator_id: string;
    brand_id: string;
    role: "owner" | "stylist" | "analyst";
    status: "active" | "paused" | "revoked";
    assigned_by: string | null;
    assigned_at: string;
  }>;

  if (rows.length === 0) return [];

  const creatorIds = Array.from(new Set(rows.map((r) => r.creator_id)));

  // Join sources: creators (for first/last/email) + creator_profiles
  // (for username + photo_url). Two cheap reads, then merge.
  const [creatorsResp, profilesResp] = await Promise.all([
    supabase
      .from("creators")
      .select("id, first_name, last_name, email")
      .in("id", creatorIds),
    supabase
      .from("creator_profiles")
      .select("creator_id, username, photo_url")
      .in("creator_id", creatorIds),
  ]);

  if (creatorsResp.error)
    throw new Error(`listMembershipsForBrand/creators: ${creatorsResp.error.message}`);
  if (profilesResp.error)
    throw new Error(
      `listMembershipsForBrand/profiles: ${profilesResp.error.message}`,
    );

  const creatorById = new Map<
    string,
    { first_name: string | null; last_name: string | null; email: string | null }
  >();
  for (const c of (creatorsResp.data ?? []) as Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  }>) {
    creatorById.set(c.id, {
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
    });
  }

  const profileById = new Map<
    string,
    { username: string | null; photo_url: string | null }
  >();
  for (const p of (profilesResp.data ?? []) as Array<{
    creator_id: string;
    username: string | null;
    photo_url: string | null;
  }>) {
    profileById.set(p.creator_id, {
      username: p.username,
      photo_url: p.photo_url,
    });
  }

  return rows.map((r) => {
    const c = creatorById.get(r.creator_id);
    const p = profileById.get(r.creator_id);
    const name =
      c?.first_name && c?.last_name
        ? `${c.first_name} ${c.last_name}`
        : c?.first_name ?? null;
    return {
      id: r.id,
      creatorId: r.creator_id,
      brandId: r.brand_id,
      role: r.role,
      status: r.status,
      assignedBy: r.assigned_by,
      assignedAt: r.assigned_at,
      memberName: name,
      memberEmail: c?.email ?? null,
      memberUsername: p?.username ?? null,
      memberPhotoUrl: p?.photo_url ?? null,
    };
  });
}

/**
 * Email lookup for the add-member form. Returns the human's creator_id (and
 * basic identity) if they exist as a creator account, null otherwise. We do
 * NOT support adding a brand-storefront content account as a member — only
 * humans. The query enforces that by filtering account_type='creator'.
 */
export async function findCreatorByEmail(email: string): Promise<{
  creatorId: string;
  name: string | null;
  username: string | null;
} | null> {
  const supabase = createAdminClient();
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const { data: cRow, error: cErr } = await supabase
    .from("creators")
    .select("id, first_name, last_name, email")
    .ilike("email", normalized)
    .maybeSingle();
  if (cErr) throw new Error(`findCreatorByEmail: ${cErr.message}`);
  if (!cRow) return null;

  // Filter out partner_brand storefront content accounts — they aren't humans.
  const { data: pRow } = await supabase
    .from("creator_profiles")
    .select("username, account_type")
    .eq("creator_id", cRow.id)
    .maybeSingle();
  if (pRow?.account_type === "partner_brand") return null;

  const name =
    cRow.first_name && cRow.last_name
      ? `${cRow.first_name} ${cRow.last_name}`
      : (cRow.first_name as string | null) ?? null;

  return {
    creatorId: cRow.id as string,
    name,
    username: (pRow?.username as string | null) ?? null,
  };
}

/**
 * Per-stylist YTD earnings for the dashboard. Joins commissions → click_events
 * → looks (where creator_id = storefront's content account), groups by
 * looks.authored_by. Read-only — used in the detail page sidebar.
 *
 * Returns rows sorted by total descending. Empty array if no earnings yet.
 */
export async function getStorefrontEarningsByStylist(
  storefrontCreatorId: string,
): Promise<
  Array<{
    authoredBy: string | null;
    stylistName: string | null;
    totalUsd: number;
    commissionCount: number;
  }>
> {
  const supabase = createAdminClient();

  // Use a year-to-date filter on commissions.created_at.
  const yearStart = new Date(new Date().getUTCFullYear(), 0, 1).toISOString();

  // commissions.creator_id = the storefront content account; we then join
  // click_events for look_id and looks for authored_by. supabase-js can chain
  // the embeds via !inner.
  const { data, error } = await supabase
    .from("commissions")
    .select(
      "creator_share, status, click_events!inner(look_id, looks!inner(authored_by))",
    )
    .eq("creator_id", storefrontCreatorId)
    .in("status", ["pending", "confirmed", "paid"])
    .gte("created_at", yearStart);
  if (error) throw new Error(`getStorefrontEarningsByStylist: ${error.message}`);

  type Row = {
    creator_share: string | number | null;
    click_events?: { looks?: { authored_by: string | null } | null } | null;
  };

  const byStylist = new Map<string | null, { total: number; count: number }>();
  for (const r of (data ?? []) as Row[]) {
    const share = Number(r.creator_share ?? 0);
    if (!isFinite(share) || share === 0) continue;
    const authoredBy = r.click_events?.looks?.authored_by ?? null;
    const cur = byStylist.get(authoredBy) ?? { total: 0, count: 0 };
    byStylist.set(authoredBy, {
      total: cur.total + share,
      count: cur.count + 1,
    });
  }

  if (byStylist.size === 0) return [];

  const stylistIds = Array.from(byStylist.keys()).filter(
    (id): id is string => id !== null,
  );
  const nameById = new Map<string, string>();
  if (stylistIds.length > 0) {
    const { data: nameRows } = await supabase
      .from("creators")
      .select("id, first_name, last_name")
      .in("id", stylistIds);
    for (const n of (nameRows ?? []) as Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
    }>) {
      nameById.set(
        n.id,
        n.first_name && n.last_name
          ? `${n.first_name} ${n.last_name}`
          : n.first_name ?? "Unnamed",
      );
    }
  }

  return Array.from(byStylist.entries())
    .map(([authoredBy, v]) => ({
      authoredBy,
      stylistName: authoredBy ? nameById.get(authoredBy) ?? "Unknown" : "(unattributed)",
      totalUsd: v.total,
      commissionCount: v.count,
    }))
    .sort((a, b) => b.totalUsd - a.totalUsd);
}
