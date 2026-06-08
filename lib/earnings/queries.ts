import { createClient } from "@/lib/supabase/server";
import {
  type CommissionRow,
  type CommissionStatus,
  type EarningsSummary,
} from "@/types/earnings";

const COMMISSION_COLUMNS =
  "id, affiliate_network, affiliate_transaction_id, merchant_name, merchant_domain, sale_amount, commission_total, creator_share, status, order_date, confirmed_at, paid_at, created_at, click_event_id";

interface CommissionRowRaw {
  id: string;
  affiliate_network: string | null;
  affiliate_transaction_id: string | null;
  merchant_name: string | null;
  merchant_domain: string | null;
  sale_amount: string | null;
  commission_total: string | null;
  creator_share: string | null;
  status: CommissionStatus;
  order_date: string | null;
  confirmed_at: string | null;
  paid_at: string | null;
  created_at: string;
  click_event_id: string | null;
}

interface ClickEventJoin {
  id: string;
  look_id: string | null;
  item_id: string | null;
}

/**
 * Aggregate earnings for the current creator. RLS scopes via creator_id.
 * Uses commission_total for revenue numbers (the gross commission we earn
 * from the affiliate network); creator_share is what gets passed through
 * to the creator after platform fees.
 */
export async function fetchEarningsSummary(): Promise<EarningsSummary> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return emptySummary();

  // Sum + count by status in one query each
  const { data: rows, error } = await supabase
    .from("commissions")
    .select("commission_total, creator_share, status")
    .eq("creator_id", user.id);

  if (error) {
    console.warn("[earnings] summary error:", error.message);
    return emptySummary();
  }

  const summary: EarningsSummary = emptySummary();
  for (const row of rows ?? []) {
    const status = row.status as CommissionStatus;
    const amount = Number.parseFloat(
      // Prefer creator_share if set; else commission_total (assumes platform
      // hasn't yet split). Both are nullable.
      (row.creator_share || row.commission_total || "0") as string,
    );
    if (Number.isNaN(amount)) continue;

    summary.total += amount;
    summary.countsByStatus[status] = (summary.countsByStatus[status] ?? 0) + 1;

    if (status === "paid") summary.paid += amount;
    if (status === "confirmed") summary.confirmedUnpaid += amount;
    if (status === "pending") summary.pending += amount;
    if (status === "rejected") summary.rejectedAmount += amount;
    if (status === "confirmed" || status === "paid") summary.earned += amount;
  }

  // Click totals — every click_events row scoped to this creator. We use
  // the total click count for conversion-rate math; if you ever want
  // platform-wide stats add a separate view.
  const { count: totalClicks } = await supabase
    .from("click_events")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", user.id);

  summary.totalClicks = totalClicks ?? 0;

  const totalCommissions =
    (summary.countsByStatus.pending ?? 0) +
    (summary.countsByStatus.confirmed ?? 0) +
    (summary.countsByStatus.paid ?? 0);
  summary.conversionRate =
    summary.totalClicks > 0
      ? totalCommissions / summary.totalClicks
      : 0;

  return summary;
}

function emptySummary(): EarningsSummary {
  return {
    total: 0,
    earned: 0,
    paid: 0,
    confirmedUnpaid: 0,
    pending: 0,
    rejectedAmount: 0,
    countsByStatus: { pending: 0, confirmed: 0, paid: 0, rejected: 0 },
    totalClicks: 0,
    conversionRate: 0,
  };
}

/**
 * Recent commissions list with look + item context joined via the
 * click_events row that drove the sale. Newest first by order_date
 * (falls back to created_at when order_date hasn't been set yet —
 * Amazon's report fills it in on a delay).
 */
export async function fetchRecentCommissions(
  limit = 25,
): Promise<CommissionRow[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: commissionRows, error } = await supabase
    .from("commissions")
    .select(COMMISSION_COLUMNS)
    .eq("creator_id", user.id)
    .order("order_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[earnings] recent error:", error.message);
    return [];
  }

  const raw = (commissionRows ?? []) as CommissionRowRaw[];
  if (raw.length === 0) return [];

  // Resolve look + item context via click_events for rows that have it
  const clickIds = raw
    .map((r) => r.click_event_id)
    .filter((id): id is string => !!id);

  const clickById = new Map<string, ClickEventJoin>();
  if (clickIds.length > 0) {
    const { data: clicks } = await supabase
      .from("click_events")
      .select("id, look_id, item_id")
      .in("id", clickIds);
    for (const c of (clicks ?? []) as ClickEventJoin[]) {
      clickById.set(c.id, c);
    }
  }

  const lookIds = Array.from(
    new Set(
      Array.from(clickById.values())
        .map((c) => c.look_id)
        .filter((v): v is string => !!v),
    ),
  );
  const itemIds = Array.from(
    new Set(
      Array.from(clickById.values())
        .map((c) => c.item_id)
        .filter((v): v is string => !!v),
    ),
  );

  const lookById = new Map<
    string,
    { title: string; cover_photo_url: string | null }
  >();
  if (lookIds.length > 0) {
    const { data: looks } = await supabase
      .from("looks")
      .select("id, title, cover_photo_url")
      .in("id", lookIds);
    for (const l of (looks ?? []) as Array<{
      id: string;
      title: string;
      cover_photo_url: string | null;
    }>) {
      lookById.set(l.id, { title: l.title, cover_photo_url: l.cover_photo_url });
    }
  }

  const itemById = new Map<
    string,
    { name: string | null; brand: string | null }
  >();
  if (itemIds.length > 0) {
    const { data: items } = await supabase
      .from("creator_items")
      .select("id, name, brand")
      .in("id", itemIds);
    for (const it of (items ?? []) as Array<{
      id: string;
      name: string | null;
      brand: string | null;
    }>) {
      itemById.set(it.id, { name: it.name, brand: it.brand });
    }
  }

  return raw.map((row) => {
    const click = row.click_event_id ? clickById.get(row.click_event_id) : null;
    const look = click?.look_id ? lookById.get(click.look_id) : null;
    const item = click?.item_id ? itemById.get(click.item_id) : null;

    return {
      id: row.id,
      affiliateNetwork: row.affiliate_network,
      affiliateTransactionId: row.affiliate_transaction_id,
      merchantName: row.merchant_name,
      merchantDomain: row.merchant_domain,
      saleAmount: row.sale_amount,
      commissionTotal: row.commission_total,
      creatorShare: row.creator_share,
      status: row.status,
      orderDate: row.order_date,
      confirmedAt: row.confirmed_at,
      paidAt: row.paid_at,
      createdAt: row.created_at,
      lookId: click?.look_id ?? null,
      lookTitle: look?.title ?? null,
      lookCoverPhotoUrl: look?.cover_photo_url ?? null,
      itemName: item?.name ?? null,
      itemBrand: item?.brand ?? null,
    } satisfies CommissionRow;
  });
}

/**
 * Top-earning looks for this creator, all-time. Grouped client-side after
 * a single fetch since we expect this to be small (most creators won't
 * have hundreds of distinct looks driving sales).
 */
/**
 * Per-look performance table data. Combines:
 *   - looks (one row per published look, scoped by RLS to the signed-in creator)
 *   - looks.clicks (denormalized, already on the row)
 *   - earnings rollup (from fetchEarningsByLookMap)
 *   - look_items count (so the table can show "5 pieces" alongside the perf)
 *
 * Used by the /earnings per-look table. Sorted server-side by clicks desc
 * (highest-traffic looks first); the table component re-sorts client-side
 * if the user toggles a column.
 *
 * Returns published looks only — drafts have zero shopper traffic by
 * definition and would just pollute the table with $0/0-click rows.
 */
export async function fetchLookPerformance(): Promise<
  Array<{
    lookId: string;
    title: string;
    coverPhotoUrl: string | null;
    itemCount: number;
    clicks: number;
    earnings: number;
    commissionCount: number;
    publishedAt: string | null;
  }>
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Earnings rollup + the looks query run in parallel — same pattern as the
  // /looks grid uses, kept independent here so this helper stays standalone
  // (the earnings page renders before the /looks grid in the user journey).
  const [{ data: rows, error }, earningsMap] = await Promise.all([
    supabase
      .from("looks")
      .select(
        "id, title, cover_photo_url, clicks, published_at, look_items(count)",
      )
      .eq("creator_id", user.id)
      .eq("archived", false)
      .not("published_at", "is", null)
      .order("clicks", { ascending: false, nullsFirst: false }),
    fetchEarningsByLookMap(),
  ]);
  if (error) {
    console.warn("[earnings] fetchLookPerformance error:", error.message);
    return [];
  }

  type RawRow = {
    id: string;
    title: string;
    cover_photo_url: string | null;
    clicks: number | null;
    published_at: string | null;
    look_items?: Array<{ count: number }>;
  };

  return ((rows ?? []) as unknown as RawRow[]).map((row) => {
    const earnings = earningsMap[row.id];
    return {
      lookId: row.id,
      title: row.title || "Untitled look",
      coverPhotoUrl: row.cover_photo_url ?? null,
      itemCount: Array.isArray(row.look_items) && row.look_items[0]
        ? row.look_items[0].count
        : 0,
      clicks: row.clicks ?? 0,
      earnings: earnings?.earnings ?? 0,
      commissionCount: earnings?.commissionCount ?? 0,
      publishedAt: row.published_at,
    };
  });
}

/**
 * Per-look earnings rollup keyed by look_id. Used by:
 *   - The /looks grid: render a $ badge under each card.
 *   - The /earnings per-look performance table: full sortable list.
 *
 * Counts confirmed + paid commissions. Pending is intentionally excluded
 * here — those are still "unconfirmed by the affiliate network" and
 * showing them as earnings would over-promise. The earnings-summary tile
 * separately surfaces pending.
 *
 * Returns Record<lookId, {earnings, commissionCount}>. Looks with zero
 * commissions are NOT in the map; callers should default to 0.
 */
export async function fetchEarningsByLookMap(): Promise<
  Record<string, { earnings: number; commissionCount: number }>
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  // Same two-step pattern as fetchTopLooksByEarnings: commissions →
  // click_events (look_id resolver). We can't pull look_id directly
  // because commissions has no FK to looks — it links via click_events.
  const { data: rows, error } = await supabase
    .from("commissions")
    .select("creator_share, commission_total, status, click_event_id")
    .eq("creator_id", user.id)
    .in("status", ["confirmed", "paid"]);
  if (error || !rows || rows.length === 0) return {};

  const clickIds = rows
    .map((r) => r.click_event_id)
    .filter((id): id is string => !!id);
  if (clickIds.length === 0) return {};

  const { data: clicks } = await supabase
    .from("click_events")
    .select("id, look_id")
    .in("id", clickIds);

  const clickToLook = new Map<string, string>();
  for (const c of (clicks ?? []) as Array<{ id: string; look_id: string | null }>) {
    if (c.look_id) clickToLook.set(c.id, c.look_id);
  }

  const out: Record<string, { earnings: number; commissionCount: number }> = {};
  for (const r of rows) {
    if (!r.click_event_id) continue;
    const lookId = clickToLook.get(r.click_event_id);
    if (!lookId) continue;
    const amount = Number.parseFloat(
      (r.creator_share || r.commission_total || "0") as string,
    );
    if (Number.isNaN(amount)) continue;
    const existing = out[lookId] ?? { earnings: 0, commissionCount: 0 };
    out[lookId] = {
      earnings: existing.earnings + amount,
      commissionCount: existing.commissionCount + 1,
    };
  }
  return out;
}

export async function fetchTopLooksByEarnings(
  limit = 5,
): Promise<Array<{ lookId: string; title: string; coverPhotoUrl: string | null; total: number; count: number }>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: rows, error } = await supabase
    .from("commissions")
    .select("creator_share, commission_total, status, click_event_id")
    .eq("creator_id", user.id)
    .in("status", ["confirmed", "paid"]);
  if (error || !rows || rows.length === 0) return [];

  const clickIds = rows
    .map((r) => r.click_event_id)
    .filter((id): id is string => !!id);
  if (clickIds.length === 0) return [];

  const { data: clicks } = await supabase
    .from("click_events")
    .select("id, look_id")
    .in("id", clickIds);
  const clickToLook = new Map<string, string>();
  for (const c of (clicks ?? []) as Array<{ id: string; look_id: string | null }>) {
    if (c.look_id) clickToLook.set(c.id, c.look_id);
  }

  const byLook = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    if (!r.click_event_id) continue;
    const lookId = clickToLook.get(r.click_event_id);
    if (!lookId) continue;
    const amount = Number.parseFloat(
      (r.creator_share || r.commission_total || "0") as string,
    );
    if (Number.isNaN(amount)) continue;
    const existing = byLook.get(lookId) ?? { total: 0, count: 0 };
    byLook.set(lookId, {
      total: existing.total + amount,
      count: existing.count + 1,
    });
  }

  if (byLook.size === 0) return [];

  const lookIds = Array.from(byLook.keys());
  const { data: looks } = await supabase
    .from("looks")
    .select("id, title, cover_photo_url")
    .in("id", lookIds);

  const sorted = (looks ?? [])
    .map((l) => {
      const stats = byLook.get(l.id) ?? { total: 0, count: 0 };
      return {
        lookId: l.id,
        title: (l as { title: string }).title,
        coverPhotoUrl: (l as { cover_photo_url: string | null }).cover_photo_url,
        total: stats.total,
        count: stats.count,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);

  return sorted;
}
