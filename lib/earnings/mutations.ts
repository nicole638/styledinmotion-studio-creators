"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/auth";
import { parseAmazonReport, type ParsedAmazonRow } from "./ingest";

export interface IngestSummary {
  ok: boolean;
  error?: string;
  /** rows the parser returned with valid uuid subtags */
  parsedRows: number;
  /** rows skipped during parsing (no subtag, not a uuid, no money) */
  skippedDuringParse: number;
  /** how many rows we matched to a click_events row */
  matched: number;
  /** how many rows we couldn't find a click_events row for */
  unmatchedClick: number;
  /** how many commissions rows actually inserted (vs upsert no-op) */
  inserted: number;
  /** dollar total of commissions inserted/upserted */
  totalCommissionUsd: number;
  /** sample of skipped rows for debugging */
  skipExamples: Array<{ reason: string; row: Record<string, string> }>;
  /** detected header → logical field map for QA */
  headerMap: Record<string, string>;
  /** false when the CSV has no subtag column at all — bigger signal */
  hasSubtagColumn: boolean;
}

/**
 * Parse + ingest an Amazon Associates CSV report.
 *
 * Idempotency: we use (creator_id, affiliate_transaction_id) when
 * transactionId is set, otherwise (creator_id, click_event_id, status).
 * Re-running the same report is safe — existing rows get UPDATEd to the
 * latest status (so a "pending" sale becomes "confirmed" when Amazon
 * confirms it on a later report).
 */
export async function ingestAmazonReportAction(
  csvText: string,
): Promise<IngestSummary> {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return baseSummary({ ok: false, error: auth.reason ?? "Forbidden" });
  }

  const parsed = parseAmazonReport(csvText);

  if (!parsed.hasSubtagColumn) {
    return baseSummary({
      ok: false,
      error:
        "No subtag column detected in this CSV. Make sure you're exporting the Orders Report (or SubTag-aware variant) — the aggregate Earnings/Tracking ID reports don't include per-click attribution.",
      parsedRows: parsed.rows.length,
      skippedDuringParse: parsed.skipped.length,
      headerMap: parsed.headerMap,
      hasSubtagColumn: false,
      skipExamples: parsed.skipped.slice(0, 5).map((s) => ({
        reason: s.reason,
        row: s.raw,
      })),
    });
  }

  const supabase = createAdminClient();

  // Resolve click_events for the parsed subtags in one round-trip
  const subtags = parsed.rows.map((r) => r.subtag).filter((v): v is string => !!v);
  const { data: clickRows, error: clickErr } = await supabase
    .from("click_events")
    .select("id, creator_id, look_id, item_id, item_url")
    .in("id", subtags);

  if (clickErr) {
    return baseSummary({
      ok: false,
      error: `Could not resolve click events: ${clickErr.message}`,
      parsedRows: parsed.rows.length,
      skippedDuringParse: parsed.skipped.length,
      headerMap: parsed.headerMap,
      hasSubtagColumn: true,
    });
  }

  const clickById = new Map<string, {
    id: string;
    creator_id: string;
    look_id: string | null;
    item_id: string | null;
    item_url: string | null;
  }>();
  for (const c of (clickRows ?? []) as Array<{
    id: string;
    creator_id: string;
    look_id: string | null;
    item_id: string | null;
    item_url: string | null;
  }>) {
    clickById.set(c.id, c);
  }

  let matched = 0;
  let unmatched = 0;
  let inserted = 0;
  let totalCommissionUsd = 0;
  const unmatchedExamples: Array<{ reason: string; row: Record<string, string> }> = [];

  for (const row of parsed.rows) {
    const click = row.subtag ? clickById.get(row.subtag) : null;
    if (!click) {
      unmatched++;
      if (unmatchedExamples.length < 5) {
        unmatchedExamples.push({
          reason: `subtag ${row.subtag} not found in click_events`,
          row: rowToRaw(row),
        });
      }
      continue;
    }

    matched++;
    const commissionAmount = row.commissionTotal ?? 0;
    totalCommissionUsd += commissionAmount;

    // Upsert by (creator_id, click_event_id, affiliate_transaction_id) so
    // a re-run of the same report is idempotent. We use Postgres' ON
    // CONFLICT semantics via Supabase's `upsert` with onConflict; since
    // there's no unique index on that combination in prod yet, we
    // emulate with a select-first-then-update pattern.
    const { data: existing } = await supabase
      .from("commissions")
      .select("id")
      .eq("creator_id", click.creator_id)
      .eq("click_event_id", click.id)
      .eq("affiliate_network", "amazon")
      .maybeSingle();

    const payload = {
      creator_id: click.creator_id,
      click_event_id: click.id,
      affiliate_network: "amazon",
      affiliate_transaction_id: row.transactionId,
      merchant_name: "Amazon",
      merchant_domain: "amazon.com",
      sale_amount: row.saleAmount,
      commission_total: commissionAmount,
      // creator_share defaults to commission_total when no platform fee
      // configured. Adjust here if/when revenue split lands.
      creator_share: commissionAmount,
      status: row.status,
      order_date: row.orderDate,
      confirmed_at:
        row.status === "confirmed" || row.status === "paid"
          ? new Date().toISOString()
          : null,
      paid_at: row.status === "paid" ? new Date().toISOString() : null,
    };

    if (existing) {
      const { error } = await supabase
        .from("commissions")
        .update(payload)
        .eq("id", existing.id);
      if (error) {
        unmatchedExamples.push({
          reason: `update failed: ${error.message}`,
          row: rowToRaw(row),
        });
      }
    } else {
      const { error } = await supabase.from("commissions").insert(payload);
      if (error) {
        unmatchedExamples.push({
          reason: `insert failed: ${error.message}`,
          row: rowToRaw(row),
        });
      } else {
        inserted++;
      }
    }
  }

  revalidatePath("/earnings");

  return baseSummary({
    ok: true,
    parsedRows: parsed.rows.length,
    skippedDuringParse: parsed.skipped.length,
    matched,
    unmatchedClick: unmatched,
    inserted,
    totalCommissionUsd,
    headerMap: parsed.headerMap,
    hasSubtagColumn: true,
    skipExamples: [
      ...parsed.skipped.slice(0, 3).map((s) => ({
        reason: s.reason,
        row: s.raw,
      })),
      ...unmatchedExamples,
    ].slice(0, 8),
  });
}

function rowToRaw(r: ParsedAmazonRow): Record<string, string> {
  return {
    subtag: r.subtag ?? "",
    transactionId: r.transactionId ?? "",
    asin: r.asin ?? "",
    productTitle: r.productTitle ?? "",
    orderDate: r.orderDate ?? "",
    saleAmount: r.saleAmount?.toString() ?? "",
    commissionTotal: r.commissionTotal?.toString() ?? "",
    rawStatus: r.rawStatus ?? "",
    status: r.status,
    trackingId: r.trackingId ?? "",
  };
}

function baseSummary(partial: Partial<IngestSummary>): IngestSummary {
  return {
    ok: false,
    parsedRows: 0,
    skippedDuringParse: 0,
    matched: 0,
    unmatchedClick: 0,
    inserted: 0,
    totalCommissionUsd: 0,
    skipExamples: [],
    headerMap: {},
    hasSubtagColumn: false,
    ...partial,
  };
}
